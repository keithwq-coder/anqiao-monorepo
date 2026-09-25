// WS 通道冒烟脚本（Node >= 22，用全局 WebSocket 客户端）。手动工具，不纳入 `node --test`。
// 前置：WS_ALERT_FAST=1 node server/index.js
// 运行：node server/ws-smoke.mjs
// 验证：错误 token 被拒；vendor 租户（user01/anqiao）收到 alert 事件后该告警能被 REST /v1/alerts 查到。
// 说明：新账号矩阵中无护理院（kaijian）登录账号；anqiao 为厂商租户，无患者体征，故不校验 vitals 推送。

const BASE = 'http://127.0.0.1:8080'

function fail(msg) {
  console.error('FAIL:', msg)
  process.exit(1)
}

// 1) 登录拿 token
const loginResp = await fetch(`${BASE}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'user01', password: process.env.SEED_ACCOUNT_PASSWORD || process.env.SMOKE_PASS }),
}).then((r) => r.json())
if (loginResp.code !== 200) fail('登录失败: ' + JSON.stringify(loginResp))
const token = loginResp.data.token
console.log('1) 登录成功, 组织:', loginResp.data.principal.org_id, loginResp.data.principal.org_name)

// 2) 错误 token 握手应被拒
await new Promise((resolve, reject) => {
  const bad = new WebSocket(`ws://127.0.0.1:8080/v1/ws?token=invalid-token`)
  const timer = setTimeout(() => reject(new Error('错误 token 未被拒绝（3s 未关闭）')), 3000)
  bad.onopen = () => {
    clearTimeout(timer)
    bad.close()
    reject(new Error('错误 token 竟然握手成功'))
  }
  bad.onerror = () => {}
  bad.onclose = (e) => {
    clearTimeout(timer)
    console.log(`2) 错误 token 握手被拒 (close code=${e.code})`)
    resolve()
  }
}).catch((e) => fail(e.message))

// 3) 正确 token：收 alert，并用 REST 交叉验证 alert 已入库
let done = false
const ws = new WebSocket(`ws://127.0.0.1:8080/v1/ws?token=${encodeURIComponent(token)}`)
const overallTimer = setTimeout(() => fail('25s 内未收到 alert 事件'), 25_000)

ws.onopen = () => console.log('   WS 已连接（vendor 租户，无患者体征，仅等待设备 alert 事件）')
ws.onerror = () => fail('WS 连接错误')
ws.onclose = (e) => {
  if (!done) fail(`WS 意外关闭 code=${e.code}`)
}

ws.onmessage = async (e) => {
  const m = JSON.parse(e.data)
  if (m.event === 'alert' && !done) {
    done = true
    clearTimeout(overallTimer)
    const a = m.data
    console.log('3) 收到 alert 事件:', a.alert_id, a.title, a.bed_id, a.status)
    const r = await fetch(`${BASE}/v1/alerts?status=triggered&page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((x) => x.json())
    const found = r.data.list.some((x) => x.alert_id === a.alert_id)
    if (!found) fail(`alert ${a.alert_id} 未出现在 REST /v1/alerts`)
    console.log(`4) REST /v1/alerts 已能查到 ${a.alert_id}（内存态写通）`)
    ws.close()
    console.log('PASS: WS 冒烟全部通过')
    process.exit(0)
  }
}
