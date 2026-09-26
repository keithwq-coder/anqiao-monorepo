// 综合业务测试脚本：设备资产、生命周期状态机、楼层隔离、长护险设备介入与闭环
// 运行：node --test server/test-device-ltc.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2848
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-device-ltc-secret'
// 测试专用种子口令：每次运行随机生成，仅注入子进程，不入库（INTEGRATION-SPEC §6-4）
const SEED_PASS = process.env.SEED_ACCOUNT_PASSWORD || `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

let child
let baseUrlReady

async function postLogin(username, password = SEED_PASS) {
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
      env: { ...process.env, PORT: String(PORT), TOKEN_SECRET, SEED_ACCOUNT_PASSWORD: SEED_PASS, DISABLE_LTC_PERSIST: 'true' },
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

// ==========================================
// 1. 账号矩阵与专属工作台分流
// ==========================================
test('账号工作台映射：各角色登录正确分流专属工作台与数据范围', async () => {
  const accountsToTest = [
    { username: 'su01', role: 'su', workspace: 'system_admin', scope: 'global' },
    { username: 'admin01', role: 'admin', workspace: 'platform_operations', scope: 'global' },
    { username: 'medical01', role: 'medical_insurance_staff', workspace: 'medical_supervision', scope: 'global' },
    { username: 'user01', role: 'user', workspace: 'device_monitoring', scope: 'org' },
    { username: 'medical_suqian', role: 'medical_insurance_staff', workspace: 'medical_supervision', scope: 'pool' },
    { username: 'demo_medical', role: 'medical_insurance_staff', workspace: 'medical_supervision', scope: 'pool' },
    { username: 'insurer01', role: 'insurer_staff', workspace: 'insurer_operations', scope: 'pool' },
    { username: 'assessor01', role: 'assessor', workspace: 'assessor_workspace', scope: 'task' },
    { username: 'partner_admin', role: 'partner_admin', workspace: 'partner_operations', scope: 'channel' },
  ]

  for (const item of accountsToTest) {
    const { httpStatus, body } = await postLogin(item.username)
    assert.equal(httpStatus, 200, `${item.username} 登录应 200`)
    assert.equal(body.data.workspace, item.workspace, `${item.username} workspace 应为 ${item.workspace}`)
    assert.equal(body.data.staff.role, item.role, `${item.username} role 应为 ${item.role}`)
    assert.equal(body.data.data_scope, item.scope, `${item.username} data_scope 应为 ${item.scope}`)
  }
})

// ==========================================
// 2. 凯健护理院租户与护士 assigned 楼层数据隔离
//    （凯健租户账号与楼层长者模拟数据已按 PRD §2.3.3 移除，楼层隔离用例于体验域数据验收后重建）
// ==========================================
test('跨机构租户隔离：外部角色（经办、评估、渠道）查凯健内部长者详情报 404', async () => {
  for (const u of ['insurer01', 'assessor01', 'partner_admin']) {
    const token = (await postLogin(u)).body.data.token
    const res = await fetch(`${BASE}/v1/patients/P00001`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 404, `${u} 越权访问凯健长者应 404`)
  }
})

// ==========================================
// 3. 设备资产中心：7 维归属与 12 阶段生命周期状态机
// ==========================================
test('设备资产：包含 7 维归属模型，渠道发展客户组织独立', async () => {
  const adminToken = (await postLogin('admin01')).body.data.token
  const res = await fetch(`${BASE}/v1/devices`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.equal(res.status, 200)
  const devices = (await res.json()).data.list
  assert.ok(devices.length >= 3, '设备资产台账应有种子数据')

  const d1 = devices.find((d) => d.device_id === 'ANCE00001')
  assert.ok(d1, '应存在 ANCE00001 设备')
  assert.equal(d1.hardware_asset_owner, 'anqiao', '硬件资产所有权归属')
  assert.equal(d1.operator_partner_id, 'partner_p1', '运营合作方渠道')
  assert.equal(d1.procurement_channel, 'direct_sale', '采购渠道')
  assert.equal(d1.service_provider_org_id, 'kaijian', '服务机构')
  assert.equal(d1.custodian_org_id, 'kaijian', '保管组织')
  assert.equal(d1.monitored_subject_id, 'P00084', '监测对象')
  assert.ok(d1.device_placement_location, '设备安装物理点位')
})

test('生命周期状态机：合法流转成功并记录审计日志；非法跳跃拒绝（400）；无权变更拒绝（403）', async () => {
  const adminToken = (await postLogin('admin01')).body.data.token
  const nurseToken = (await postLogin('insurer01')).body.data.token

  // 1. 无权角色 (insurer01 无 device:lifecycle 能力) 变更状态 -> 403
  const resForbidden = await fetch(`${BASE}/v1/devices/ANCE00002/lifecycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({ target_status: 'arrived_onsite' }),
  })
  assert.equal(resForbidden.status, 403, '护士无权流转设备生命周期')

  // 2. 非法跳跃（ANCE00002 当前 in_transit，直接跳到 active_monitoring）-> 400
  const resInvalid = await fetch(`${BASE}/v1/devices/ANCE00002/lifecycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ target_status: 'active_monitoring' }),
  })
  assert.equal(resInvalid.status, 400, '非法状态机跳跃应返回 400')

  // 3. 合法单步流转（in_transit -> arrived_onsite）-> 200
  const resValid = await fetch(`${BASE}/v1/devices/ANCE00002/lifecycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ target_status: 'arrived_onsite', note: '现场签收验货完毕' }),
  })
  assert.equal(resValid.status, 200, '合法状态机流转应 200')
  const updatedDev = (await resValid.json()).data
  assert.equal(updatedDev.lifecycle_status, 'arrived_onsite')

  // 4. 审计日志查询
  const resLogs = await fetch(`${BASE}/v1/devices/lifecycle-logs?device_id=ANCE00002`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.equal(resLogs.status, 200)
  const logs = (await resLogs.json()).data.list
  assert.ok(logs.some((l) => l.to_status === 'arrived_onsite' && l.operator_id === 'admin01'))
})

// ==========================================
// 4. 合作伙伴渠道工作台隔离
// ==========================================
test('合作伙伴：partner_admin 仅能查看自身引荐发展的渠道客户组织，无跨渠道数据', async () => {
  const partnerToken = (await postLogin('partner_admin')).body.data.token
  const res = await fetch(`${BASE}/v1/partner/channels`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  })
  assert.equal(res.status, 200)
  const data = (await res.json()).data
  assert.equal(data.partner_id, 'partner_p1')
  assert.ok(Array.isArray(data.customers))
  // 渠道拓展的客户组织 cust_org01 必须归属本 partner_id
  for (const c of data.customers) {
    assert.equal(c.referrer_partner_id, 'partner_p1')
  }
})

// ==========================================
// 5. 长护险设备介入红线、AI 洞察处置、服务证据与质量事件
// ==========================================
test('长护险独立被评估对象：AssessedPerson 独立于 Patient，多角色按范围查看', async () => {
  const insurerToken = (await postLogin('insurer01')).body.data.token
  const res = await fetch(`${BASE}/v1/ltc/assessed-persons`, {
    headers: { Authorization: `Bearer ${insurerToken}` },
  })
  assert.equal(res.status, 200)
  const list = (await res.json()).data.list
  assert.ok(list.length >= 2)
  const p84 = list.find((p) => p.person_id === 'P00084')
  assert.ok(p84, '长护险域应存在独立被评估对象 P00084')
  assert.ok(p84.guardian_name, '应包含监护人信息')
})

test('设备介入红线：任务冻结快照证据 conclusion 恒为 null，严禁自动定级', async () => {
  const insurerToken = (await postLogin('insurer01')).body.data.token
  const assessorToken = (await postLogin('assessor01')).body.data.token

  // 1. 发起申请
  const resApp = await fetch(`${BASE}/v1/ltc/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${insurerToken}` },
    body: JSON.stringify({
      applicant_id: 'P00084',
      type: 'first_apply',
      period: '2026-Q4',
      application_level: '重度失能Ⅲ级',
      self_assessment_grade: 'F级',
    }),
  })
  assert.equal(resApp.status, 200)
  const app = (await resApp.json()).data

  // 1.1 提交申请进入待受理/待派单状态
  const resSubmit = await fetch(`${BASE}/v1/ltc/applications/${app.application_id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${insurerToken}` },
  })
  assert.equal(resSubmit.status, 200)

  // 2. 派单
  const resTask = await fetch(`${BASE}/v1/ltc/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${insurerToken}` },
    body: JSON.stringify({
      application_id: app.application_id,
      assessor_account: 'assessor01',
    }),
  })
  assert.equal(resTask.status, 200)
  const task = (await resTask.json()).data

  // 3. 评估师接单
  await fetch(`${BASE}/v1/ltc/tasks/${task.task_id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${assessorToken}` },
  })

  // 4. 评估师请求冻结设备监测窗口生成快照
  const resSnap = await fetch(`${BASE}/v1/ltc/snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assessorToken}` },
    body: JSON.stringify({
      task_id: task.task_id,
      window_days: 14,
    }),
  })
  assert.equal(resSnap.status, 200)
  const snap = (await resSnap.json()).data
  assert.ok(snap.snapshot_id)
  assert.equal(snap.task_id, task.task_id)
  assert.equal(snap.disclaimer_acknowledged, true)

  // 5. 验证固化进入证据库的数据，红线必须严格满足：conclusion 恒 null
  const resEv = await fetch(`${BASE}/v1/ltc/evidence?task_id=${task.task_id}`, {
    headers: { Authorization: `Bearer ${assessorToken}` },
  })
  assert.equal(resEv.status, 200)
  const evList = (await resEv.json()).data.list
  const monitoringEv = evList.find((e) => e.type === 'evidence_monitoring')
  assert.ok(monitoringEv, '快照应沉淀为 evidence_monitoring')
  assert.equal(monitoringEv.conclusion, null, '红线：监测证据 conclusion 恒为 null')
  assert.equal(monitoringEv.is_simulated, true, '红线：监测数据来源 mock/simulated')
})

test('AI 助手洞察处置：仅评估师可闭环确认/采纳/驳回/人工核查，留痕操作原因', async () => {
  const assessorToken = (await postLogin('assessor01')).body.data.token
  const nurseToken = (await postLogin('insurer01')).body.data.token

  // 1. 无权角色（insurer01 非评估师）处置洞察 -> 403
  const resForbidden = await fetch(`${BASE}/v1/ltc/insights/INSIGHT-20260920-001/handle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({ action: 'adopted', note: '无权操作' }),
  })
  assert.equal(resForbidden.status, 403)

  // 2. 非法 action 拒绝 -> 400
  const resInvalid = await fetch(`${BASE}/v1/ltc/insights/INSIGHT-20260920-001/handle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assessorToken}` },
    body: JSON.stringify({ action: 'auto_approve' }),
  })
  assert.equal(resInvalid.status, 400)

  // 3. 评估师合法采纳处置并说明理由 -> 200
  const resHandled = await fetch(`${BASE}/v1/ltc/insights/INSIGHT-20260920-001/handle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assessorToken}` },
    body: JSON.stringify({
      action: 'adopted',
      note: '现场核实长者夜间离床确实频繁，采纳体征波动作为失能评估参考',
    }),
  })
  assert.equal(resHandled.status, 200)
  const insight = (await resHandled.json()).data
  assert.equal(insight.handling_status, 'adopted')
  assert.equal(insight.handled_by, 'assessor01')
  assert.ok(insight.handling_note.includes('采纳体征波动'))
})

test('服务证据比对与质量事件处置闭环', async () => {
  const insurerToken = (await postLogin('insurer01')).body.data.token
  const adminToken = (await postLogin('admin01')).body.data.token

  // 1. 查询服务证据比对（到场记录 vs 设备信号）
  const resEvidence = await fetch(`${BASE}/v1/ltc/service-evidence`, {
    headers: { Authorization: `Bearer ${insurerToken}` },
  })
  assert.equal(resEvidence.status, 200)
  const evidenceList = (await resEvidence.json()).data.list
  assert.ok(evidenceList.length > 0)
  const ev1 = evidenceList[0]
  assert.ok(ev1.device_signal_match !== undefined, '必须具有到场与设备比对标识')

  // 2. 查询设备质量事件
  const resEvents = await fetch(`${BASE}/v1/ltc/quality-events`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.equal(resEvents.status, 200)
  const eventList = (await resEvents.json()).data.list
  assert.ok(eventList.length > 0)

  // 3. 处置设备质量事件
  const resDispose = await fetch(`${BASE}/v1/ltc/quality-events/QE-20260920-001/dispose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      action: 'recalibrated',
      note: '完成毫米波雷达天线角度纠偏与灵敏度校准',
    }),
  })
  assert.equal(resDispose.status, 200)
  const disposed = (await resDispose.json()).data
  assert.equal(disposed.disposition_status, 'recalibrated')
  assert.equal(disposed.disposed_by, 'admin01')
})

test('结算审核四步分离：严格按阶段与角色推进，越权或越步返回错误', async () => {
  const medicalToken = (await postLogin('medical_suqian')).body.data.token
  const assessorToken = (await postLogin('assessor01')).body.data.token

  // 1. 评估师无权参与结算审核 -> 403
  const resAssessor = await fetch(`${BASE}/v1/ltc/settlements/SETTLE-20260920-001/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assessorToken}` },
    body: JSON.stringify({ step: 2, pass: true }),
  })
  assert.equal(resAssessor.status, 403)

  // 2. 经办审核当前处于 step 1 (已提交)，医保局跳步执行 step 3 -> 400
  const resSkip = await fetch(`${BASE}/v1/ltc/settlements/SETTLE-20260920-001/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${medicalToken}` },
    body: JSON.stringify({ step: 3, pass: true, note: '医保跳步审批' }),
  })
  assert.equal(resSkip.status, 400, '跳步执行应 400 拒绝')
})
