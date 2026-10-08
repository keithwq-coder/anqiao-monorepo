// P-B 验收测试（SIM-TELEMETRY-DESIGN §7 V5/V6/V11）：平台模拟数据确定性收口。
// 运行：npm test（已挂入 package.json test script）
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2852
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-seed-daily-secret'
const SEED_PASS = 'seed-pass-123456'

let child
let serverReady

async function postLogin(username, password = SEED_PASS) {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return await res.json()
}

function startServer(extraEnv = {}) {
  return new Promise((resolve) => {
    child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      env: {
        ...process.env,
        PORT: String(PORT),
        TOKEN_SECRET,
        SEED_ACCOUNT_PASSWORD: SEED_PASS,
        DISABLE_LTC_PERSIST: 'true',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d.toString()
      if (!serverReady && buf.includes('[server] 安守护')) {
        serverReady = true
        resolve()
      }
    })
    child.on('exit', () => {
      if (!serverReady) resolve()
    })
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (!child) return resolve()
    child.on('exit', () => resolve())
    child.kill()
    child = null
    serverReady = false
  })
}

/** 子进程跑一段 seed.js 断言代码（模拟"重启/独立全量生成"），退出码 0 = 通过 */
function assertInChild(fakeToday, code) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      process.execPath,
      ['--input-type=module', '-e', code],
      {
        env: { ...process.env, SEED_ACCOUNT_PASSWORD: SEED_PASS, ...(fakeToday ? { TEST_FAKE_TODAY: fakeToday } : {}) },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    )
    let out = ''
    p.stdout.on('data', (d) => { out += d.toString() })
    p.on('close', (c) => (c === 0 ? resolve(out) : reject(new Error('child exit ' + c))))
  })
}

const alertsSignature = (d) => JSON.stringify(d.alerts.map((a) => [a.alert_id, a.type, a.occurred_at, a.bed_id, a.status]))

before(async () => {
  await startServer()
})

after(async () => {
  await stopServer()
})

// ---------- V5 种子日稳定：同日两次重建（模块重载模拟）一致；不同日不一致 ----------
test('V5 种子日稳定：同日跨进程告警集合一致，不同日重建不同', async () => {
  const code = `
    const m = await import(${JSON.stringify(pathToFileURLStr(path.join(__dirname, 'seed.js')))});
    const d = m.getTenantData('kangning')
    process.stdout.write(JSON.stringify(d.alerts.map(a => [a.alert_id, a.type, a.occurred_at, a.bed_id, a.status])))
  `
  const [day1RunA, day1RunB] = await Promise.all([assertInChild(null, code), assertInChild(null, code)])
  assert.equal(day1RunA, day1RunB, '同日两次独立进程（模拟重启）告警集合必须逐字段一致')
  assert.ok(day1RunA.length > 10, '康宁种子告警非空')

  const day2 = await assertInChild('2026-10-09', code)
  assert.notEqual(day2, day1RunA, '不同日期种子（2026-10-09）告警集合应不同')
  assert.ok(day2.includes('2026-10-09'), '隔日告警 occurred_at 应锚定新日期')
})

// ---------- V6 实时告警健壮性：502 守卫回归 + 内容由当日种子决定 ----------
test('V6 实时告警健壮性：空患者/无租户返回 null；同种子步序内容确定', async () => {
  const code = `
    const m = await import(${JSON.stringify(pathToFileURLStr(path.join(__dirname, 'seed.js')))});
    assert.ok(m.generateLiveAlert('no_such_tenant') === null, '无租户返回 null')
    assert.ok(m.generateLiveAlert('platform') === null, '无患者租户返回 null')
    const a1 = m.generateLiveAlert('kangning')
    const a2 = m.generateLiveAlert('kangning')
    assert.ok(a1 && a2, '康宁可生成实时告警')
    assert.notEqual(a1.alert_id, a2.alert_id, '步序号递增')
    process.stdout.write('OK:' + a1.type + '@' + a1.bed_id)
  `
  const out = await assertInChild(null, code)
  const out2 = await assertInChild(null, code.replace(/const a2[\s\S]*?alert_id, '步序号递增'\)/, 'assert.ok(true)'))
  assert.match(out, /^OK:/, '实时告警生成正常')
  assert.equal(out, out2, '同日同步序两次独立进程生成内容一致（当日种子决定类型/床位）')
})

// ---------- V11 长运行跨日：进程不重启、时钟跨日，读取路径锚点切换为新日期 ----------
test('V11 长运行跨日：时钟跨日后 getTenantData 惰性重建当日告警', async () => {
  const code = `
    const m = await import(${JSON.stringify(pathToFileURLStr(path.join(__dirname, 'seed.js')))});
    // 模块加载时 TEST_FAKE_TODAY=D1，先读一次（锚定 D1）
    const d1 = m.getTenantData('kangning')
    const sig1 = JSON.stringify(d1.alerts.map(a => a.occurred_at.slice(0, 10)))
    process.stdout.write('day1:' + sig1)
  `
  // 进程 A：D1 = 2026-10-08 启动（与真实今日相同的假日期）
  const outD1 = await assertInChild('2026-10-08', code)
  assert.ok(outD1.includes('2026-10-08'), 'D1 告警锚定 D1')

  // 进程 B：直接以 D2 启动——模块加载即 D2，验证"隔天启动"数据换新
  const outD2 = await assertInChild('2026-10-09', code)
  assert.ok(outD2.includes('2026-10-09'), 'D2 启动告警锚定 D2')

  // 同进程惰性重建：模块加载于 D1，运行中把假时钟拨到 D2，再次读取触发重建
  const lazyCode = `
    const m = await import(${JSON.stringify(pathToFileURLStr(path.join(__dirname, 'seed.js')))});
    const d1 = m.getTenantData('kangning')
    const before = d1.alerts.map(a => a.occurred_at.slice(0, 10))
    process.env.TEST_FAKE_TODAY = '2026-10-09' // 进程不重启，时钟跨日
    const d2 = m.getTenantData('kangning') // 读取路径触发按日惰性重建
    const after = d2.alerts.map(a => a.occurred_at.slice(0, 10))
    assert.ok(before.every(x => x === '2026-10-08'), '跨日前锚定 D1')
    assert.ok(after.every(x => x === '2026-10-09'), '跨日后惰性重建为 D2 告警')
    assert.notEqual(JSON.stringify(before), JSON.stringify(after), '跨日告警集合换新')
    // 结构数据不重建：患者引用与长度不变
    assert.equal(d1.patients.length, d2.patients.length, '患者结构不重建')
    process.stdout.write('OK')
  `
  const outLazy = await assertInChild('2026-10-08', lazyCode)
  assert.ok(outLazy.endsWith('OK'), '长运行跨日惰性重建通过')
})

// ---------- 契约回归：REST /v1/alerts 在同日两次重启的服务间集合一致 ----------
test('V5-REST：同日重启的两个服务实例告警列表一致', async () => {
  const fetchAlerts = async () => {
    const login = await postLogin('kangning_head')
    const token = login.data.token
    const res = await fetch(`${BASE}/v1/alerts?page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    assert.equal(body.code, 200)
    return JSON.stringify(body.data.list.map((a) => [a.alert_id, a.type, a.occurred_at, a.bed_id, a.status]))
  }
  const run1 = await fetchAlerts()
  await stopServer()
  await startServer()
  const run2 = await fetchAlerts()
  assert.equal(run1, run2, '同日重启后 REST 告警列表必须一致')
})

function pathToFileURLStr(p) {
  return pathToFileURL(p).href
}
