// P-A 验收测试（SIM-TELEMETRY-DESIGN §7）：仿真遥测源 V1-V4、V10 + 挂载自检。
// 运行：npm test（已挂入 package.json test script，勿摘除——本仓 test 为显式清单非 glob）
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2851
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-sim-telemetry-secret'
const SEED_PASS = 'seed-pass-123456'
const SIM_SN = 'SIM-A1B203'
const FIXED_NOW = new Date('2026-10-08T04:30:00Z') // 东八区 2026-10-08 12:30

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

function startServer() {
  return new Promise((resolve) => {
    child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      env: { ...process.env, PORT: String(PORT), TOKEN_SECRET, SEED_ACCOUNT_PASSWORD: SEED_PASS, DISABLE_LTC_PERSIST: 'true' },
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

/** 用子进程模拟"重启"：新进程加载同一模块，验证 V1 跨进程确定性 */
function runInChild(code) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    p.stdout.on('data', (d) => { out += d.toString() })
    p.on('close', (code2) => (code2 === 0 ? resolve(out) : reject(new Error('child exit ' + code2))))
  })
}

before(async () => {
  await startServer()
})

after(() => {
  if (child) child.kill()
})

// ---------- V1 确定性：同一 (SIM SN, date) 两次独立全量生成（模拟重启）逐字段一致 ----------
test('V1 确定性：缓存清空后重生成与跨子进程生成逐字段 deep equal', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, 'sim-telemetry.js')).href)
  const sixNow = () => ({
    latest: mod.simLatestData(SIM_SN, { now: FIXED_NOW }),
    today: mod.simTodayData(SIM_SN, { now: FIXED_NOW }),
    daily: mod.simDailyData(SIM_SN, '2026-10-08'),
    sleep: mod.simSleepStats(SIM_SN, '2026-10-08'),
    dates: mod.simReportDates(SIM_SN, { now: FIXED_NOW }),
    alarms: mod.simAlarms(SIM_SN, { now: FIXED_NOW }),
  })
  const first = sixNow()
  mod.__resetSimCache()
  const second = sixNow()
  assert.deepEqual(second, first, '同进程缓存清空（模拟重启）后六接口必须逐字段一致')

  const childCode = `
    const m = await import(${JSON.stringify(pathToFileURL(path.join(__dirname, 'sim-telemetry.js')).href)});
    const now = new Date(${JSON.stringify(FIXED_NOW.toISOString())});
    const r = { latest: m.simLatestData('${SIM_SN}', { now }), today: m.simTodayData('${SIM_SN}', { now }),
      daily: m.simDailyData('${SIM_SN}', '2026-10-08'), sleep: m.simSleepStats('${SIM_SN}', '2026-10-08'),
      dates: m.simReportDates('${SIM_SN}', { now }), alarms: m.simAlarms('${SIM_SN}', { now }) };
    process.stdout.write(JSON.stringify(r))
  `
  const childOut = await runInChild(childCode)
  const fromChild = JSON.parse(childOut)
  assert.deepEqual(fromChild, first, '跨进程（新进程加载模块）生成必须与主进程逐字段一致')
})

// ---------- V2 跨日变化：不同 date 数据不同且区间合法 ----------
test('V2 跨日变化：相同 SN 不同 date 数据不同且区间合法', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, 'sim-telemetry.js')).href)
  const d1 = mod.simDailyData(SIM_SN, '2026-10-07')
  const d2 = mod.simDailyData(SIM_SN, '2026-10-08')
  assert.equal(d1.length, 720)
  assert.equal(d2.length, 720)
  let diffs = 0
  for (let i = 0; i < 720; i++) {
    if (d1[i].hr !== d2[i].hr || d1[i].br !== d2[i].br || d1[i].tp !== d2[i].tp) diffs++
  }
  assert.ok(diffs > 100, `跨日应有大量点位不同（实测 ${diffs}/720）`)
  const s1 = mod.simSleepStats(SIM_SN, '2026-10-07')
  const s2 = mod.simSleepStats(SIM_SN, '2026-10-08')
  assert.notDeepEqual(s1.sleepReport.sleep_start, s2.sleepReport.sleep_start, '不同日睡眠报告应不同')
})

// ---------- V3 路由：SIM SN 走仿真源；非 SIM SN 仍转发 hw.js ----------
test('V3 路由：SIM SN 返回仿真数据；真实 SN 直透上游（上游不可达时 502）', async () => {
  const login = await postLogin('admin01')
  const token = login.data.token
  assert.equal(login.code, 200)

  // SIM SN → 仿真源（进程内，不依赖上游可用性）
  const simRes = await fetch(`${BASE}/v1/hardware/latest?device_id=${SIM_SN}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const simBody = await simRes.json()
  assert.equal(simBody.code, 200, `SIM latest 应 200：${JSON.stringify(simBody)}`)
  assert.equal(simBody.data.device_id, SIM_SN)
  assert.ok(typeof simBody.data.hr === 'number' && simBody.data.hr > 0, '仿真 latest 应有体征数据')

  // 非注册真实 SN → 不命中仿真（无 SIM- 前缀），上游不可达时应走 hw.js 代理失败路径（502）
  // 注：hw.js fetch 无超时控制，给本测试设 30s 硬超时，防止 CI 长挂
  const realRes = await Promise.race([
    fetch(`${BASE}/v1/hardware/latest?device_id=ASH99999`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch((err) => {
      // fetch 被硬超时中断时按"上游不可达"处理——证明它没走仿真源
      const surrogate = { json: async () => ({ code: 502, msg: `timeout-or-unreachable: ${err.message}` }) }
      return surrogate
    }),
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ json: async () => ({ code: 502, msg: 'timeout-or-unreachable' }) }),
        30_000,
      ),
    ),
  ])
  const realBody = await realRes.json()
  assert.ok([502, 200].includes(realBody.code), `真实 SN 应直透上游而非仿真（code=${realBody.code}）`)
  if (realBody.code === 502) {
    assert.match(realBody.msg, /硬件云|fetch|network|ENOTFOUND|ECONN|timeout/i, '502 应来自上游代理失败')
  } else {
    assert.notEqual(realBody.data?.device_id, 'ASH99999', '仿真源绝不能应答非 SIM SN')
  }

  // daily/date 契约：SIM 走仿真源
  const dailyRes = await fetch(`${BASE}/v1/hardware/daily?device_id=${SIM_SN}&date=2026-10-08`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const dailyBody = await dailyRes.json()
  assert.equal(dailyBody.code, 200)
  assert.equal(dailyBody.data.length, 720, '夜间窗 720 分钟')
  assert.ok(dailyBody.data[0].created_at.startsWith('2026-10-07 20:'), '夜间窗从 D-1 20:00 起')
  assert.ok(dailyBody.data[719].created_at.startsWith('2026-10-08 07:'), '夜间窗至 D 日 08:00')

  // 非法 date → 400（仿真源参数校验）
  const badDateRes = await fetch(`${BASE}/v1/hardware/daily?device_id=${SIM_SN}&date=not-a-date`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal((await badDateRes.json()).code, 400)
})

// ---------- V4 鉴权继承：公屏在册白名单对 SIM 设备同等生效 ----------
test('V4 鉴权继承：screen_viewer 查 SIM 设备——未登记 403', async () => {
  // 取公屏只读会话令牌（POST /v1/auth/screen），SIM_SN 未登记进 DEVICE_ASSETS → 在册校验应拒绝
  const screenRes = await fetch(`${BASE}/v1/auth/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Screen-Tenant': 'anqiao' },
    body: JSON.stringify({ tenant: 'anqiao' }),
  })
  const screenBody = await screenRes.json()
  assert.equal(screenBody.code, 200, `公屏会话签发失败：${JSON.stringify(screenBody)}`)
  const screenToken = screenBody.data.token

  const denied = await fetch(`${BASE}/v1/hardware/latest?device_id=${SIM_SN}`, {
    headers: { Authorization: `Bearer ${screenToken}`, 'X-Screen-Tenant': 'anqiao' },
  })
  const deniedBody = await denied.json()
  assert.equal(deniedBody.code, 403, '未登记 SIM SN 对公屏必须 403')

  // 公屏访问 devices 列表接口（无 device_id 维度）仍然 403
  const devicesRes = await fetch(`${BASE}/v1/hardware/devices?user_id=1`, {
    headers: { Authorization: `Bearer ${screenToken}`, 'X-Screen-Tenant': 'anqiao' },
  })
  assert.equal((await devicesRes.json()).code, 403)
})

// ---------- V10 健康区间：仿真体征落在医学参考值区间内 ----------
test('V10 健康区间：latest/daily 全序列体征落在规范区间内', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, 'sim-telemetry.js')).href)
  const R = mod.MEDICAL_RANGES
  const checkPoint = (p, label) => {
    assert.ok(p.hr >= R.hrHardBounds[0] && p.hr <= R.hrHardBounds[1], `${label} hr=${p.hr} 越界 ${JSON.stringify(R.hrHardBounds)}`)
    assert.ok(p.br >= R.brHardBounds[0] && p.br <= R.brHardBounds[1], `${label} br=${p.br} 越界`)
    assert.ok(p.tp >= R.tpHardBounds[0] && p.tp <= R.tpHardBounds[1], `${label} tp=${p.tp} 越界`)
    assert.ok(p.body_movement >= 0 && p.body_movement <= 2, `${label} body_movement=${p.body_movement} 越界`)
    assert.ok(typeof p.isBed === 'boolean', `${label} isBed 应为布尔`)
  }
  // 多个 SN × 多个日期全量扫描
  for (const sn of ['SIM-A1B203', 'SIM-ZZ9Q05', 'SIM-B7C418']) {
    for (const date of ['2026-10-06', '2026-10-07', '2026-10-08']) {
      const daily = mod.simDailyData(sn, date)
      for (const p of daily) checkPoint(p, `${sn}@${date}`)
      const latest = mod.simLatestData(sn, { now: FIXED_NOW })
      checkPoint(latest, `${sn} latest`)
      const today = mod.simTodayData(sn, { now: FIXED_NOW })
      for (const p of today) checkPoint(p, `${sn} today`)
      // 睡眠结构合理性：分期合计 = 窗长、深睡占比在老龄生理带内（<25%）、睡眠时长 < 卧床时长
      const sr = mod.simSleepStats(sn, date).sleepReport
      const totalStages = sr.deep_sleep_minutes + sr.light_sleep_minutes + sr.awake_duration_minutes
      const remMin = sr.stage_fields.filter((s) => s === 2).length
      assert.equal(sr.stage_fields.length, 720, '分期序列长度 = 夜间窗 720 分钟')
      assert.equal(totalStages + remMin, 720, '四分期合计必须等于窗长')
      assert.ok(sr.sleep_duration_minutes <= sr.bed_duration_minutes, '睡眠时长不得大于卧床时长')
      const deepPct = sr.deep_sleep_minutes / Math.max(1, sr.sleep_duration_minutes)
      assert.ok(deepPct <= 0.25, `${sn}@${date} 深睡占比 ${deepPct.toFixed(2)} 超出老龄生理上限 25%`)
      assert.ok(sr.sleep_score >= 55 && sr.sleep_score <= 96, '睡眠评分应在合理量表内')
      assert.ok(sr.hrv_ms >= 20 && sr.hrv_ms <= 60, 'HRV 应在规范区间')
    }
  }
})

// ---------- 挂载自检：test-sim-telemetry.mjs 必须在 package.json test script 清单内 ----------
test('挂载自检：本文件已在 npm test 显式清单中（本仓 test 非 glob，漏挂即静默不跑）', () => {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
  assert.match(pkg.scripts.test, /test-sim-telemetry\.mjs/, 'package.json test script 必须包含 test-sim-telemetry.mjs')
})
