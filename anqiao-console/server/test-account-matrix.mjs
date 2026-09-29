// 账号矩阵验收脚本（Node 内置 node:test）
// 运行：node --test server/test-account-matrix.mjs  （或随 node --test 全量）
// 覆盖：旧账号 nurse01/ops01/hq01 登录失败；新账号 su01/admin01/user01/medical01/insurer01/assessor01
//       全部登录成功且 principal/org/role/permissions/data_scope 正确；跨组织租户切换被拒（无越权）；
//       组织内账号可访问受保护接口（overview）。
// 通过 child_process 起真实后端（测试端口），用完即杀；只做登录/切换/overview，不触发任何 LTC/告警写操作，
// 因此不会产生 store.json / ltc-store.json 等生产数据文件。

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2847
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-account-matrix-secret'
// 测试专用种子口令：每次运行随机生成，仅注入子进程，不入库（INTEGRATION-SPEC §6-4）
const SEED_PASS = process.env.SEED_ACCOUNT_PASSWORD || `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

let child
let baseUrlReady

async function postLogin(username, password) {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json()
  return { httpStatus: res.status, body }
}

function startServer() {
  return new Promise((resolve) => {
    child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      env: { ...process.env, PORT: String(PORT), TOKEN_SECRET, SEED_ACCOUNT_PASSWORD: SEED_PASS },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d.toString()
      if (!baseUrlReady && buf.includes('[server] 安守护')) {
        baseUrlReady = true
        resolve()
      }
    })
    child.on('exit', (code) => {
      if (!baseUrlReady) resolve()
    })
  })
}

before(async () => {
  await startServer()
})

after(() => {
  if (child) child.kill()
})

const EXPECTED = {
  su01:           { role: 'su',                    org: 'platform',     org_name: '系统组织',       scope: 'global' },
  admin01:        { role: 'admin',                 org: 'anqiao',       org_name: '中科安樵·自营运营中心', scope: 'global' },
  medical01:      { role: 'medical_insurance_staff',                 org: 'anqiao',       org_name: '中科安樵·自营运营中心', scope: 'global' },
  user01:         { role: 'user',                  org: 'anqiao',       org_name: '中科安樵·自营运营中心', scope: 'org' },
  medical_suqian: { role: 'medical_insurance_staff', org: 'bureau_suqian', org_name: '宿迁市医疗保障局 / 宿迁长护险试点工作组', scope: 'pool' },
  demo_medical:   { role: 'medical_insurance_staff', org: 'bureau_moumou', org_name: '某某市医疗保障局 / 某某市长护险管理服务中心', scope: 'pool' },
  insurer01:      { role: 'insurer_staff',         org: 'insurer',      org_name: '惠生人寿保险股份有限公司（演示）· 某某市长护险受托经办中心', scope: 'pool' },
  assessor01:     { role: 'assessor',              org: 'assessor_org', org_name: '某某市明康第三方失能评定中心', scope: 'task' },
}

test('旧账号 nurse01/ops01/hq01 登录一律失败（401）', async () => {
  for (const u of ['nurse01', 'ops01', 'hq01']) {
    const { httpStatus, body } = await postLogin(u, SEED_PASS)
    assert.equal(httpStatus, 401, `${u} 应 401，实为 ${httpStatus}`)
    assert.notEqual(body.code, 200)
  }
})

test('未知账号登录失败（401）', async () => {
  assert.equal((await postLogin('ghost01', SEED_PASS)).httpStatus, 401)
})

test('新账号全部登录成功，principal/role/org/permissions/data_scope 正确', async () => {
  for (const [u, exp] of Object.entries(EXPECTED)) {
    const { httpStatus, body } = await postLogin(u, SEED_PASS)
    assert.equal(httpStatus, 200, `${u} 登录应 200，实为 ${httpStatus}: ${JSON.stringify(body)}`)
    assert.equal(body.code, 200)
    const data = body.data
    assert.ok(data.token && typeof data.token === 'string', `${u} 应返回 token`)
    assert.equal(data.staff.role, exp.role, `${u} role`)
    assert.equal(data.principal.username, u, `${u} principal.username`)
    assert.equal(data.principal.role, exp.role, `${u} principal.role`)
    assert.equal(data.principal.org_id, exp.org, `${u} principal.org_id`)
    assert.equal(data.principal.org_name, exp.org_name, `${u} principal.org_name`)
    assert.equal(data.principal.tenant_id, exp.org, `${u} principal.tenant_id==org_id`)
    assert.equal(data.data_scope, exp.scope, `${u} data_scope`)
    assert.ok(Array.isArray(data.permissions) && data.permissions.length > 0, `${u} permissions`)
  }
})

test('长护险角色不拥有越权能力（medical 无结果审核，insurer 无监管创建，assessor 无派单）', async () => {
  const { body } = await postLogin('medical_suqian', SEED_PASS)
  assert.ok(!body.data.permissions.includes('result:approve'), 'medical 不应有 result:approve')
  const ins = (await postLogin('insurer01', SEED_PASS)).body.data
  assert.ok(!ins.permissions.includes('supervision:create'), 'insurer 不应有 supervision:create')
  const as = (await postLogin('assessor01', SEED_PASS)).body.data
  assert.ok(!as.permissions.includes('task:dispatch'), 'assessor 不应有 task:dispatch')
  assert.ok(!as.permissions.includes('result:approve'), 'assessor 不应有 result:approve')
})

test('跨组织租户切换被拒（403），杜绝越权', async () => {
  // 任何账号尝试切换到非本组织租户 → 403（当前租户数据域仅余 anqiao，platform/insurer/assessor_org 账号均非其成员）
  for (const u of ['su01', 'insurer01', 'assessor01']) {
    const login = await postLogin(u, SEED_PASS)
    const token = login.body.data.token
    const res = await fetch(`${BASE}/v1/auth/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenant_id: 'anqiao' }),
    })
    const body = await res.json()
    assert.equal(res.status, 403, `${u} 切换到 anqiao 应 403，实为 ${res.status}`)
    assert.equal(body.code, 403)
  }
})

test('组织内账号可访问受保护接口（admin01/user01 GET /v1/overview 200）', async () => {
  for (const u of ['admin01', 'user01']) {
    const token = (await postLogin(u, SEED_PASS)).body.data.token
    const res = await fetch(`${BASE}/v1/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 200, `${u} /v1/overview 应 200`)
  }
})

test('无令牌访问受保护写接口被拒（401），大屏只读接口免登放行（200）', async () => {
  const readRes = await fetch(`${BASE}/v1/overview`)
  assert.equal(readRes.status, 200, '公屏免登打开网址就能看，GET /v1/overview 应 200')
  const writeRes = await fetch(`${BASE}/v1/alerts/A001/handle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'test' }),
  })
  assert.equal(writeRes.status, 401, '无令牌写操作必须 401')
})

test('无令牌访问 LTC / hardware 被拒；公屏会话签发 screen_viewer', async () => {
  const ltcRes = await fetch(`${BASE}/v1/ltc/assessed-persons`)
  assert.equal(ltcRes.status, 401, '匿名不得访问 /v1/ltc')
  const hwRes = await fetch(`${BASE}/v1/hardware/devices`)
  assert.equal(hwRes.status, 401, '匿名不得访问 /v1/hardware')
  const screenRes = await fetch(`${BASE}/v1/auth/screen`, { method: 'POST' })
  assert.equal(screenRes.status, 200, 'POST /v1/auth/screen 应签发公屏令牌')
  const screenBody = await screenRes.json()
  assert.equal(screenBody.data.staff.role, 'screen_viewer')
  const token = screenBody.data.token
  const hwDevices = await fetch(`${BASE}/v1/hardware/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(hwDevices.status, 403, 'screen_viewer 不得走 2.5.1 设备列表')
  const hwLatest = await fetch(`${BASE}/v1/hardware/latest?device_id=ASH01086`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.notEqual(hwLatest.status, 403, '公屏应能查在册 SN 的 2.8 latest')
  assert.ok([200, 502].includes(hwLatest.status), `公屏 latest 应为 200 或上游 502，实为 ${hwLatest.status}`)
  const hwForeign = await fetch(`${BASE}/v1/hardware/latest?device_id=NOT-A-DEVICE`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(hwForeign.status, 403, '公屏不得查不在册 SN')
  const hwAlarmsBare = await fetch(`${BASE}/v1/hardware/alarms`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(hwAlarmsBare.status, 403, '公屏不得无 device_id 拉全量告警')
  const suqianScreenRes = await fetch(`${BASE}/v1/auth/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Screen-Tenant': 'bureau_suqian' },
    body: JSON.stringify({ tenant: 'bureau_suqian' }),
  })
  assert.equal(suqianScreenRes.status, 200)
  const suqianToken = (await suqianScreenRes.json()).data.token
  const sqLatest = await fetch(`${BASE}/v1/hardware/latest?device_id=ASH01086`, {
    headers: { Authorization: `Bearer ${suqianToken}`, 'X-Screen-Tenant': 'bureau_suqian' },
  })
  assert.notEqual(sqLatest.status, 403, '宿迁公屏应能查 ASH01086')
  const sqForeign = await fetch(`${BASE}/v1/hardware/latest?device_id=ASH01146`, {
    headers: { Authorization: `Bearer ${suqianToken}`, 'X-Screen-Tenant': 'bureau_suqian' },
  })
  assert.equal(sqForeign.status, 403, '宿迁公屏不得查非试点 SN')
  const ltcWithScreen = await fetch(`${BASE}/v1/ltc/assessed-persons`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.ok([401, 403].includes(ltcWithScreen.status), 'screen_viewer 不得进入长护险数据面')
})

test('登录席位走 2.8 latest 不得因缺少 HW_* 返回 503；缺 device_id 400；文档未定义的 status 404', async () => {
  const { httpStatus, body } = await postLogin('admin01', SEED_PASS)
  assert.equal(httpStatus, 200)
  const token = body.data.token
  const missing = await fetch(`${BASE}/v1/hardware/latest`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(missing.status, 400, '2.8.2 缺 device_id 应 400')
  const latest = await fetch(`${BASE}/v1/hardware/latest?device_id=ASH01086`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.notEqual(latest.status, 503, '2.8 查询不得因缺少 HW_ACCOUNT 返回 503')
  assert.ok([200, 502].includes(latest.status), `latest 应为 200 或上游 502，实为 ${latest.status}`)
  const dailyMissingDate = await fetch(`${BASE}/v1/hardware/daily?device_id=ASH01086`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(dailyMissingDate.status, 400, '2.8.3 缺 date 应 400')
  const statusRes = await fetch(`${BASE}/v1/hardware/status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(statusRes.status, 404, 'V1.0 未定义 hardware/status，不得代理')
})

test('project/config：kaijian/suqian 字段按契约，suqian 恒 compare_only 且 devices 恒 3 台', async () => {
  const kj = (await postLogin('admin01', SEED_PASS)).body.data
  const kjRes = await fetch(`${BASE}/v1/project/config`, {
    headers: { Authorization: `Bearer ${kj.token}` },
  })
  assert.equal(kjRes.status, 200)
  const kjCfg = (await kjRes.json()).data
  assert.equal(kjCfg.projectId, 'kaijian')
  assert.equal(kjCfg.projectTitle, '凯健护理院安守护驾驶舱')
  assert.equal(kjCfg.basePath, '/dash/')
  assert.equal(kjCfg.multiOrg, true)
  assert.equal(kjCfg.ltciArchivePanel, false)
  assert.equal(kjCfg.ltciScreen, false)
  assert.equal(kjCfg.cloudScanMode, 'writable')
  assert.ok(Array.isArray(kjCfg.devices) && kjCfg.devices.length > 0)
  assert.ok(Array.isArray(kjCfg.orgs))
  assert.ok(Array.isArray(kjCfg.geo))

  const sq = (await postLogin('medical_suqian', SEED_PASS)).body.data
  const sqRes = await fetch(`${BASE}/v1/project/config`, {
    headers: { Authorization: `Bearer ${sq.token}` },
  })
  assert.equal(sqRes.status, 200)
  const sqCfg = (await sqRes.json()).data
  assert.equal(sqCfg.projectId, 'suqian')
  assert.equal(sqCfg.cloudScanMode, 'compare_only')
  assert.equal(sqCfg.multiOrg, false)
  assert.equal(sqCfg.ltciArchivePanel, true)
  assert.equal(sqCfg.ltciScreen, true)
  assert.equal(sqCfg.devices.length, 3, 'suqian devices red line: 恒 3 台')
  const sns = sqCfg.devices.map((d) => d.sn).sort()
  assert.deepEqual(sns, ['ASH01078', 'ASH01086', 'ASH01092'])
})

// floors/wards/beds/stats 凯健 seed 聚合用例已随凯健租户模拟数据移除（PRD §2.3.3/§2.3.5），
// 院舍楼层维度数据与用例于体验域数据系统验收后统一重建。

test('authorize data_scope=channel：本渠道客户可读，跨渠道 404；无能力动作 403', async () => {
  const { authorize, dataScopeOf } = await import('./auth.js')
  assert.equal(dataScopeOf('partner_admin'), 'channel')
  const principal = {
    username: 'partner_admin',
    role: 'partner_admin',
    org_id: 'partner_p1',
    tenant_id: 'partner_p1',
    data_scope: 'channel',
  }

  // 本渠道客户组织 → 放行
  const own = authorize(
    principal,
    'customer:read',
    { org_id: 'cust_org01', referrer_partner_id: 'partner_p1' },
  )
  assert.equal(own.allow, true)

  // 其他渠道引荐 → 404（越权读他人数据）
  const other = authorize(
    principal,
    'customer:read',
    { org_id: 'cust_x', referrer_partner_id: 'partner_p2' },
  )
  assert.equal(other.allow, false)
  assert.equal(other.status, 404)

  // 即便动作有权限，资源形态为客户数据正文 → 404（不见正文红线）
  const bodyViaCustomer = authorize(
    principal,
    'customer:read',
    {
      patient_id: 'P00084',
      bed_id: '404-A',
      care_level: '特级护理',
      ward: '完全失能专区',
      vitals: { hr: 94, br: 22, tp: 36.9 },
    },
  )
  assert.equal(bodyViaCustomer.allow, false)
  assert.equal(bodyViaCustomer.status, 404)

  // partner 无 patient:read / alert:read 能力 → 403（无权限动作）
  const patient = authorize(principal, 'patient:read', { patient_id: 'P00084' })
  assert.equal(patient.allow, false)
  assert.equal(patient.status, 403)
  const alert = authorize(principal, 'alert:read', { type: 'fall', level: 1 })
  assert.equal(alert.allow, false)
  assert.equal(alert.status, 403)
})
