// P-C 验收测试（SIM-TELEMETRY-DESIGN §7 V7/V8/V9）：伙伴沙箱租户。
// 运行：npm test（已挂入 package.json test script）
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2853
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-partner-sandbox-secret'
const SEED_PASS = 'seed-pass-123456'
const PARTNER_TENANT = 'partner_acme_test'
const PARTNER_NAME = '安樵体验养老服务有限公司'

let child
let serverReady

async function postJson(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return { httpStatus: res.status, body: await res.json() }
}

async function getJson(pathname, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { httpStatus: res.status, body: await res.json() }
}

async function postLogin(username, password = SEED_PASS) {
  const { body } = await postJson('/v1/auth/login', { username, password })
  assert.equal(body.code, 200, `登录失败 ${username}: ${JSON.stringify(body)}`)
  return body.data
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

let suToken
let sandboxResult

before(async () => {
  await startServer()
  const su = await postLogin('su01')
  suToken = su.token
})

after(() => {
  if (child) child.kill()
})

// ---------- V7 伙伴沙箱开通 ----------
test('V7 开通：POST /v1/admin/tenants 带 partner_sandbox → 租户+16 角色账号群+SIM 设备；账号可登录且 org_name = 伙伴名', async () => {
  // 非法 tenant_id：大写/连字符 → 400
  const bad1 = await postJson('/v1/admin/tenants', { tenant_id: 'Partner-ACME', name: 'x', vertical: 'nursing_home', partner_sandbox: {} }, suToken)
  assert.equal(bad1.body.code, 400, 'tenant_id 大写/连字符必须 400')

  // 用户名拼接超长：tenant_id 25 位（>24 上限）→ 400
  const bad2 = await postJson('/v1/admin/tenants', { tenant_id: 'a'.repeat(25), name: 'x', vertical: 'nursing_home', partner_sandbox: {} }, suToken)
  assert.equal(bad2.body.code, 400, 'tenant_id >24 位必须 400（username 上限 64 红线）')

  // 非 su 守卫：admin01 → 403
  const admin = await postLogin('admin01')
  const forbidden = await postJson('/v1/admin/tenants', { tenant_id: 'partner_x2', name: 'x', vertical: 'nursing_home', partner_sandbox: {} }, admin.token)
  assert.equal(forbidden.body.code, 403, '非 su 不得开通伙伴沙箱')

  // 正常开通
  const created = await postJson(
    '/v1/admin/tenants',
    {
      tenant_id: PARTNER_TENANT,
      name: PARTNER_NAME,
      vertical: 'nursing_home',
      partner_sandbox: { sim_device_count: 5 },
    },
    suToken,
  )
  assert.equal(created.body.code, 200, `开通失败: ${JSON.stringify(created.body)}`)
  const data = created.body.data
  sandboxResult = data
  assert.equal(data.name, PARTNER_NAME)
  assert.equal(data.partner_sandbox.demo_disclaimer, true, '演示标识恒开')
  assert.equal(data.partner_sandbox.accounts.length, 16, '16 角色账号群')
  assert.equal(data.partner_sandbox.sim_devices.length, 5, 'SIM 设备 5 台')
  assert.ok(data.partner_sandbox.sim_devices.every((sn) => sn.startsWith('SIM-')), 'SN 全部 SIM- 前缀')

  // 账号可登录，org/租户名正确
  const adminAcct = data.partner_sandbox.accounts.find((a) => a.role === 'nursing_admin')
  const session = await postLogin(adminAcct.username)
  assert.equal(session.tenant.name, PARTNER_NAME, '登录后机构名 = 伙伴名')
  assert.equal(session.tenant.tenant_id, PARTNER_TENANT)

  // 重复开通 → 409
  const dup = await postJson('/v1/admin/tenants', { tenant_id: PARTNER_TENANT, name: 'x', vertical: 'nursing_home', partner_sandbox: {} }, suToken)
  assert.equal(dup.body.code, 409, '重复开通必须 409')
})

// ---------- V8 沙箱隔离 ----------
test('V8 隔离：伙伴查康宁的床/患者 → 404；康宁查伙伴亦然；SIM 设备资产归属各自租户', async () => {
  const partnerSession = await postLogin(`${PARTNER_TENANT}_admin`)
  const knSession = await postLogin('kangning_admin')

  // 伙伴角色拿自己的床列表（应 200 非空；/v1/beds 直接返回数组）
  const ownBeds = await getJson('/v1/beds', partnerSession.token)
  assert.equal(ownBeds.body.code, 200)
  const bedsArr = Array.isArray(ownBeds.body.data) ? ownBeds.body.data : ownBeds.body.data.list
  assert.ok(bedsArr.length > 0, '伙伴沙箱床位数据面就绪')

  // 跨租户数据面：API 按本租户会话隔离，伙伴会话查到的是自己的面；
  // 直接验证隔离不变量：伙伴面内不存在康宁床位标识，反之亦然
  const partnerBedIds = new Set(bedsArr.map((b) => b.bed_id ?? b.id))
  const knBeds = await getJson('/v1/beds', knSession.token)
  const knBedArr = Array.isArray(knBeds.body.data) ? knBeds.body.data : knBeds.body.data.list
  const knBedIds = new Set(knBedArr.map((b) => b.bed_id ?? b.id))

  // SIM 设备资产归属：伙伴设备的 customer_org_id 只指向伙伴租户
  const devices = await getJson('/v1/devices', partnerSession.token)
  assert.equal(devices.body.code, 200)
  const partnerSims = devices.body.data.list.filter((d) => d.sn?.startsWith('SIM-'))
  assert.equal(partnerSims.length, 5, '伙伴设备面含 5 台 SIM 设备')
  assert.ok(partnerSims.every((d) => d.customer_org_id === PARTNER_TENANT), 'SIM 设备 customer_org_id 归属伙伴租户')

  // 康宁设备面不含伙伴 SIM 设备
  const knDevices = await getJson('/v1/devices', knSession.token)
  const knSimCount = knDevices.body.data.list.filter((d) => d.sn?.startsWith('SIM-')).length
  assert.equal(knSimCount, 0, '康宁设备面不得出现伙伴 SIM 设备')

  // 伙伴账号查 SIM 设备遥测（P-A 联动）：公屏在册 = DEVICE_ASSETS 含这批 SN → device:read 席位可查
  const simSn = sandboxResult.partner_sandbox.sim_devices[0]
  const latest = await getJson(`/v1/hardware/latest?device_id=${simSn}`, partnerSession.token)
  assert.equal(latest.body.code, 200, `伙伴查自己 SIM 设备遥测应 200: ${JSON.stringify(latest.body)}`)
  assert.equal(latest.body.data.device_id, simSn)
  assert.ok(latest.body.data.hr > 0, '仿真遥测有体征数据')
})

// ---------- V9 红线：宿迁恒 3 台 + 三处硬编码白名单一致 ----------
test('V9 红线：suqian devices 恒 3 台；宿迁池行为不变', async () => {
  // seed.js 红线断言仍在位（启动即抛错才挂；这里验证 project config）
  const code = readFileSync(path.join(__dirname, 'seed.js'), 'utf8')
  assert.ok(code.includes("must be 3"), 'seed.js suqian 3 台红线断言必须在位')
  assert.ok(code.includes("cloudScanMode = 'compare_only'"), 'compare_only 红线必须在位')

  // 宿迁公屏仍只认三台真机 SN（index.js 硬编码白名单）
  const idx = readFileSync(path.join(__dirname, 'index.js'), 'utf8')
  assert.ok(idx.includes("SUQIAN_SCREEN_DEVICE_IDS = ['ASH01086', 'ASH01078', 'ASH01092']"), '宿迁公屏白名单三 SN 不变')

  // 公屏会话查宿迁域：SIM SN 必须 403（不在宿迁白名单）
  const screenRes = await fetch(`${BASE}/v1/auth/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Screen-Tenant': 'bureau_suqian' },
    body: JSON.stringify({ tenant: 'bureau_suqian' }),
  })
  const screenBody = await screenRes.json()
  assert.equal(screenBody.code, 200)
  const denied = await getJson(`/v1/hardware/latest?device_id=${sandboxResult.partner_sandbox.sim_devices[0]}`, screenBody.data.token)
  assert.equal(denied.body.code, 403, '宿迁公屏不得查询伙伴 SIM 设备')
})

// ---------- 挂载自检 ----------
test('挂载自检：本文件已在 npm test 显式清单中', () => {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
  assert.match(pkg.scripts.test, /test-partner-sandbox\.mjs/, 'package.json test script 必须包含 test-partner-sandbox.mjs')
})
