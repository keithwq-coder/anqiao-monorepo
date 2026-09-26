// 多业态租户模型验收（Node 内置 node:test）
// 运行：node --test server/test-multi-vertical.mjs（或随 npm test 全量）
// 覆盖：TENANT_CONFIGS 三字段（vertical/template/deployment）齐备与分组映射（设计 §4.1）；
//       getter 回退语义；康宁演示租户与六职能角色（Task 2/3 起逐步扩充）。
// 说明：直接动态 import seed.js（不发网络请求、不写生产数据）；seed.js 启动即校验
//       SEED_ACCOUNT_PASSWORD，故在本进程先行自注入测试口令（不入库）。
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SEED_ACCOUNT_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD || `t-${Date.now().toString(36)}`

const {
  TENANT_CONFIGS,
  getTenantData,
  getTenantName,
  getTenantVertical,
  getTenantTemplate,
  getTenantDeployment,
  listBeds,
} = await import('./seed.js')

test('TENANT_CONFIGS 全部条目具备 vertical/template/deployment 三字段', () => {
  for (const id of Object.keys(TENANT_CONFIGS)) {
    const cfg = TENANT_CONFIGS[id]
    assert.ok(cfg.vertical, `${id} 缺 vertical`)
    assert.ok('template' in cfg, `${id} 缺 template`)
    assert.equal(cfg.deployment, 'saas', `${id} deployment 应为 saas`)
  }
})

test('业态字段映射符合设计 §4.1 分组', () => {
  assert.equal(TENANT_CONFIGS.platform.vertical, 'platform')
  assert.equal(TENANT_CONFIGS.anqiao.vertical, 'platform')
  assert.equal(TENANT_CONFIGS.bureau.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.bureau_suqian.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.bureau_moumou.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.insurer.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.insurer_suqian.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.assessor_suqian.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.assessor_org.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.partner_p1.vertical, 'partner')
  assert.equal(TENANT_CONFIGS.cust_org01.vertical, 'nursing_home')
})

test('getter 对未知租户回退（与 getTenantKind 同风格）', () => {
  assert.equal(getTenantVertical('no_such_tenant'), 'nursing_home')
  assert.equal(getTenantTemplate('no_such_tenant'), null)
  assert.equal(getTenantDeployment('no_such_tenant'), 'saas')
})

test('康宁演示租户：机构照护型（occupiedBeds 分支），虚构名+演示标识', () => {
  const d = getTenantData('kangning')
  assert.ok(d, 'kangning 未注册进 TENANT_DATA')
  assert.equal(getTenantName('kangning'), '康宁护理院（演示）')
  assert.equal(getTenantVertical('kangning'), 'nursing_home')
  assert.equal(getTenantTemplate('kangning'), 'nursing_home_v1')
  assert.equal(d.cfg.occupiedBeds.length, 87)
  assert.equal(d.cfg.vacantBeds.length, 9)
  assert.equal(d.patients.length, 87)
  assert.ok(d.alerts.length > 0, '演示告警应生成')
})

test('康宁床位呈现：occupied + vacant 双态（listBeds）', () => {
  const beds = listBeds('kangning')
  assert.equal(beds.length, 96)
  assert.ok(beds.some((b) => b.status === 'vacant'), '应存在诚实空床态')
  assert.ok(beds.some((b) => b.status === 'occupied' && b.patient_id), '在住床位应挂长者')
})

test('六职能角色：workspace/permissions/scope 定义齐备（§3.3）', async () => {
  const { workspaceOf, permissionsOf, dataScopeOf } = await import('./auth.js')
  const roles = [
    ['facility_doctor', 'facility_doctor_studio'],
    ['facility_hr', 'facility_hr_studio'],
    ['facility_finance', 'facility_finance_studio'],
    ['facility_marketing', 'facility_marketing_studio'],
    ['facility_admin', 'facility_admin_studio'],
    ['facility_it', 'facility_it_studio'],
  ]
  for (const [role, ws] of roles) {
    assert.equal(workspaceOf(role), ws, `${role} 应映射 ${ws}`)
    assert.ok(permissionsOf(role).length > 0, `${role} permissions 不得为空`)
    assert.equal(dataScopeOf(role), 'org', `${role} data_scope 应为 org`)
  }
})

test('销售席位授权修正：business_user/customer_view 不再错位回退到院长工作台', async () => {
  const { authorizedWorkspacesFor } = await import('./ltc.js')
  const list = authorizedWorkspacesFor('business_user', { workspace: 'customer_view', username: '何丹' })
  assert.ok(list.includes('customer_view'), `应含 customer_view，实际 ${JSON.stringify(list)}`)
  assert.ok(!list.includes('nursing_home_admin'), '不得错位回退到 nursing_home_admin')
})

test('PRD 支撑角色键齐备：patient_dossier/reports_center；康复/认知症默认工作台校正到专属 studio', async () => {
  const { workspaceOf } = await import('./auth.js')
  assert.equal(workspaceOf('patient_dossier'), 'patient_dossier')
  assert.equal(workspaceOf('reports_center'), 'reports_center')
  assert.equal(workspaceOf('rehab_therapist'), 'rehab_studio')
  assert.equal(workspaceOf('dementia_specialist'), 'dementia_studio')
})

test('授权链按 account.workspace 校正业态归属：康宁席位进 studio，居家默认不受影响', async () => {
  const { authorizedWorkspacesFor } = await import('./ltc.js')
  assert.deepEqual(authorizedWorkspacesFor('rehab_therapist', { workspace: 'rehab_studio' }), ['rehab_studio'])
  assert.deepEqual(authorizedWorkspacesFor('dementia_specialist', { workspace: 'dementia_studio' }), ['dementia_studio'])
  assert.ok(authorizedWorkspacesFor('rehab_therapist', { workspace: 'home_dispatch' }).includes('home_dispatch'), '居家域账号保持既有授权')
})

test('康宁 16 演示席位：真实后端逐席登录，workspace/org 正确（设计 §3.1A 全栈）', async () => {
  const { spawn } = await import('node:child_process')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname2 = path.dirname(fileURLToPath(import.meta.url))
  const PORT2 = 2848
  const SEED_PASS2 = `t-kn-${Date.now().toString(36)}`
  const SEATS = [
    ['kangning_station', 'nursing_station', 'care_desk'],
    ['kangning_head', 'nursing_head', 'care_desk'],
    ['kangning_nurse', 'nursing_nurse', 'nursing_staff'],
    ['kangning_caregiver', 'nursing_caregiver', 'nursing_staff'],
    ['kangning_admin', 'nursing_admin', 'nursing_home_admin'],
    ['kangning_dossier', 'patient_dossier', 'patient_dossier'],
    ['kangning_ops', 'device_user', 'device_monitoring'],
    ['kangning_reports', 'reports_center', 'reports_center'],
    ['kangning_rehab', 'rehab_therapist', 'rehab_studio'],
    ['kangning_dementia', 'dementia_specialist', 'dementia_studio'],
    ['kangning_doctor', 'facility_doctor', 'facility_doctor_studio'],
    ['kangning_hr', 'facility_hr', 'facility_hr_studio'],
    ['kangning_finance', 'facility_finance', 'facility_finance_studio'],
    ['kangning_marketing', 'facility_marketing', 'facility_marketing_studio'],
    ['kangning_affairs', 'facility_admin', 'facility_admin_studio'],
    ['kangning_it', 'facility_it', 'facility_it_studio'],
  ]
  const child = spawn(process.execPath, [path.join(__dirname2, 'index.js')], {
    env: { ...process.env, PORT: String(PORT2), TOKEN_SECRET: 'test-kangning-secret', SEED_ACCOUNT_PASSWORD: SEED_PASS2 },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  try {
    await new Promise((resolve, reject) => {
      let buf = ''
      const timer = setTimeout(() => reject(new Error('后端启动超时')), 15000)
      child.stdout.on('data', (d) => {
        buf += d.toString()
        if (buf.includes('[server] 安守护')) { clearTimeout(timer); resolve() }
      })
      child.on('exit', () => { clearTimeout(timer); reject(new Error('后端提前退出')) })
    })
    for (const [username, role, workspace] of SEATS) {
      const res = await fetch(`http://127.0.0.1:${PORT2}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: SEED_PASS2 }),
      })
      const body = await res.json()
      assert.equal(res.status, 200, `${username} 应登录成功`)
      assert.equal(body.data.workspace, workspace, `${username} 工作台应为 ${workspace}`)
      assert.equal(body.data.principal.org_id, 'kangning', `${username} 应归属康宁租户`)
      assert.equal(body.data.principal.role, role, `${username} 角色应为 ${role}`)
      assert.ok((body.data.permissions || []).length > 0, `${username} permissions 非空`)
    }
  } finally {
    child.kill()
  }
})
