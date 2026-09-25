// 居家养老服务机构（苏州市姑苏区智护居家养老服务中心）专属集成测试
// 验证账号矩阵、四层鉴权、角色工作台与片区网格数据范围隔离

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2855
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-home-care-secret'
const SEED_PASS = process.env.SEED_ACCOUNT_PASSWORD || `hc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

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

async function postSwitchTenant(token, tenantId) {
  const res = await fetch(`${BASE}/v1/auth/switch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id: tenantId }),
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
    child.on('exit', () => {
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

test('居家养老中心账号矩阵全部登录成功且角色/租户/范围符合规范', async () => {
  const accounts = [
    { u: 'station_master', role: 'elderly_care_admin', scope: 'org', tenant: 'home_care_gusu', name: '陆振东' },
    { u: 'dispatch_center', role: 'home_dispatcher', scope: 'org', tenant: 'home_care_gusu', name: '苏怡' },
    { u: 'cg_canglang_01', role: 'grid_caregiver', scope: 'assigned', tenant: 'home_care_gusu', name: '林小燕' },
    { u: 'cg_canglang_04', role: 'grid_caregiver', scope: 'assigned', tenant: 'home_care_gusu', name: '周玉兰' },
    { u: 'cg_shuangta_01', role: 'grid_team_leader', scope: 'assigned', tenant: 'home_care_gusu', name: '王惠芬' },
    { u: 'cg_sanxiang_01', role: 'grid_caregiver', scope: 'assigned', tenant: 'home_care_gusu', name: '何丽娜' },
    { u: 'assessor_liming', role: 'assessor', scope: 'task', tenant: 'assessor_org', name: '李明' },
    { u: 'rehab_chen', role: 'rehab_specialist', scope: 'assigned', tenant: 'home_care_gusu', name: '陈主任' },
    // 居家乐 / 福寿康 连锁级 IDT 多学科与质控结算账号
    { u: 'nurse_shenyaping', role: 'home_nurse', scope: 'assigned', tenant: 'home_care_gusu', name: '沈雅萍' },
    { u: 'pt_chenjianxin', role: 'rehab_therapist', scope: 'assigned', tenant: 'home_care_gusu', name: '陈建新' },
    { u: 'dementia_zhufang', role: 'dementia_specialist', scope: 'assigned', tenant: 'home_care_gusu', name: '朱芳' },
    { u: 'cm_xumeiling', role: 'case_manager', scope: 'org', tenant: 'home_care_gusu', name: '徐美玲' },
    { u: 'tech_zhanghongbo', role: 'assistive_specialist', scope: 'assigned', tenant: 'home_care_gusu', name: '张洪波' },
    { u: 'qc_jiangguoqiang', role: 'quality_inspector', scope: 'org', tenant: 'home_care_gusu', name: '蒋国强' },
    { u: 'biller_zhouliping', role: 'ltc_biller', scope: 'org', tenant: 'home_care_gusu', name: '周立平' },
  ]

  for (const acc of accounts) {
    const { httpStatus, body } = await postLogin(acc.u, SEED_PASS)
    assert.equal(httpStatus, 200, `${acc.u} 登录应成功(200)`)
    assert.equal(body.code, 200, `${acc.u} code 应为 200`)
    assert.ok(body.data?.token, `${acc.u} 应返回有效 token`)

    const principal = body.data?.principal
    const tenant = body.data?.principal?.org_id
    const staff = body.data?.staff
    const scope = body.data?.data_scope

    assert.equal(principal.role, acc.role, `${acc.u} 角色应为 ${acc.role}`)
    assert.equal(scope, acc.scope, `${acc.u} 数据范围应为 ${acc.scope}`)
    assert.equal(tenant, acc.tenant, `${acc.u} 机构应为 ${acc.tenant}`)
    assert.ok(staff.name.includes(acc.name), `${acc.u} 真实姓名应包含 ${acc.name}`)
  }
})

test('居家养老机构助老员不可跨租户切换至非所属机构（403 拒绝）', async () => {
  const { body } = await postLogin('cg_canglang_01', SEED_PASS)
  const token = body.data.token

  // 尝试越权切换至院舍机构 kaijian（kaijian 在有效租户列表中，但助老员账号仅归属 home_care_gusu）
  const res1 = await postSwitchTenant(token, 'kaijian')
  assert.equal(res1.httpStatus, 403, '跨机构切换至 kaijian 应报 403')
  assert.equal(res1.body.code, 403)
})

test('居家养老角色权限配置严格，助老员仅具备工单与照护读取处置能力', async () => {
  const { body } = await postLogin('cg_canglang_01', SEED_PASS)
  const permissions = body.data?.permissions || []

  assert.ok(permissions.includes('work_order:read'), '助老员需具备 work_order:read')
  assert.ok(permissions.includes('work_order:operate'), '助老员需具备 work_order:operate')
  assert.ok(permissions.includes('patient:read'), '助老员需具备 patient:read')

  // 严禁拥有全局系统与医保监管终审权
  assert.equal(permissions.includes('supervision:manage'), false, '助老员不可具备 supervision:manage')
  assert.equal(permissions.includes('application:review'), false, '助老员不可具备 application:review')
  assert.equal(permissions.includes('*'), false, '助老员不可拥有通配全权')
})

test('连锁居家多学科团队 (IDT) 专职护士、质控主管与长护险结算员权限精准隔离', async () => {
  // 1. 居家专职护士：具备医嘱处置与上门处置权，不可进行质检终审
  const nurseRes = await postLogin('nurse_shenyaping', SEED_PASS)
  const nursePerms = nurseRes.body.data?.permissions || []
  assert.ok(nursePerms.includes('medical_order:read'), '护士需具备 medical_order:read')
  assert.ok(nursePerms.includes('medical_order:write'), '护士需具备 medical_order:write')
  assert.ok(nursePerms.includes('work_order:operate'), '护士需具备 work_order:operate')
  assert.equal(nursePerms.includes('quality_audit:write'), false, '护士不可越权质检')

  // 2. 康复治疗师：具备康复评估与处置权
  const ptRes = await postLogin('pt_chenjianxin', SEED_PASS)
  const ptPerms = ptRes.body.data?.permissions || []
  assert.ok(ptPerms.includes('rehab_assessment:write'), '康复师需具备 rehab_assessment:write')
  assert.ok(ptPerms.includes('work_order:operate'), '康复师需具备 work_order:operate')

  // 3. 认知症专护师：具备认知症专案制定权
  const demRes = await postLogin('dementia_zhufang', SEED_PASS)
  const demPerms = demRes.body.data?.permissions || []
  assert.ok(demPerms.includes('dementia_care:write'), '认知症专护师需具备 dementia_care:write')

  // 4. 个案管理师：具备照护方案制定权，机构级数据视野
  const cmRes = await postLogin('cm_xumeiling', SEED_PASS)
  const cmPerms = cmRes.body.data?.permissions || []
  assert.ok(cmPerms.includes('care_plan:write'), '个案管理师需具备 care_plan:write')
  assert.equal(cmRes.body.data?.data_scope, 'org', '个案管理师应具备全机构视野')

  // 5. 适老辅具工程师：具备辅具评估与维护权
  const techRes = await postLogin('tech_zhanghongbo', SEED_PASS)
  const techPerms = techRes.body.data?.permissions || []
  assert.ok(techPerms.includes('assistive_device:write'), '辅具顾问需具备 assistive_device:write')

  // 6. 质控督导主管：具备督导飞检、抽检工单审核权，无医嘱下达权
  const qcRes = await postLogin('qc_jiangguoqiang', SEED_PASS)
  const qcPerms = qcRes.body.data?.permissions || []
  assert.ok(qcPerms.includes('quality_audit:write'), '质控主管需具备 quality_audit:write')
  assert.ok(qcPerms.includes('supervision:read'), '质控主管需具备 supervision:read')
  assert.equal(qcPerms.includes('medical_order:write'), false, '质控主管不可下达医疗医嘱')

  // 7. 长护险结算专员：具备长护险待遇核销、服务凭据稽核权，无派单权
  const billerRes = await postLogin('biller_zhouliping', SEED_PASS)
  const billerPerms = billerRes.body.data?.permissions || []
  assert.ok(billerPerms.includes('settlement:review'), '结算专员需具备 settlement:review')
  assert.ok(billerPerms.includes('service_evidence:read'), '结算专员需具备 service_evidence:read')
  assert.equal(billerPerms.includes('task:dispatch'), false, '结算专员不可调度派单')
})
