// 阶段 D：家属 / 标签 / 绑定 / 申诉 回归
// 运行：node --test server/test-phase-d.mjs
process.env.SEED_ACCOUNT_PASSWORD ||= `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
process.env.DISABLE_LTC_PERSIST ||= 'true'

const { test } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const {
  setPersistEnabled,
  resetState,
  ctxForAccount,
  createApplication,
  submitApplication,
  approveReview,
  listFamilyBindings,
  createBindingRequest,
  bindingRequestAction,
  listBindingRequests,
  createAppeal,
  listAppeals,
  appealAction,
  getAppeal,
  listDeviceLabels,
  patchDeviceLabels,
  deviceLabelStats,
  createDeviceBinding,
  listDeviceBindings,
  deviceBindingAction,
  authorizedWorkspacesFor,
  getApplication,
  applicationAction,
  createAssessmentTask,
  acceptTask,
  startTask,
  addEvidence,
  submitTask,
} = await import('./ltc.js')
const { ACCOUNTS } = await import('./seed.js')

setPersistEnabled(false)

function ctxOf(username) {
  const account = ACCOUNTS.find((a) => a.username === username)
  if (!account) throw new Error('missing ' + username)
  return ctxForAccount(account)
}

function famCtx() {
  return ctxOf('family_demo')
}

function restoreFamily() {
  const acc = ACCOUNTS.find((a) => a.username === 'family_demo')
  acc.binding_status = 'active'
  acc.authorization_status = 'active'
  acc.applicant_ids = ['P_SQ_01']
}

test('family_demo：workspace 与获授列表', () => {
  assert.deepEqual(authorizedWorkspacesFor('family_contact'), ['family_workspace'])
  const acc = ACCOUNTS.find((a) => a.username === 'family_demo')
  assert.equal(acc.workspace, 'family_workspace')
  assert.equal(acc.scope, 'applicant')
  assert.ok(acc.applicant_ids.includes('P_SQ_01'))
})

test('AC-F01 有效绑定 listFamilyBindings', () => {
  resetState()
  restoreFamily()
  const res = listFamilyBindings(famCtx())
  assert.equal(res.total, 1)
  assert.equal(res.list[0].subject_id, 'P_SQ_01')
  assert.equal(res.list[0].binding_status, 'active')
})

test('AC-F08 越权读其他对象申请 404', () => {
  resetState()
  restoreFamily()
  const insurer = ctxOf('insurer01')
  const app = createApplication(insurer, {
    applicant_id: 'P_OTHER_99',
    type: 'first_apply',
    application_level: '重度失能Ⅰ级',
    tenant_id: 'insurer',
  })
  submitApplication(insurer, app.application_id)
  assert.throws(
    () => getApplication(famCtx(), app.application_id),
    (e) => e.status === 404,
  )
})

test('AC-F03 绑定核验：提交 → 经办 approve', () => {
  resetState()
  restoreFamily()
  const created = createBindingRequest(famCtx(), { subject_id: 'P_SQ_01', relationship: '子女' })
  assert.equal(created.state, 'pending_review')
  const insurer = ctxOf('insurer01')
  assert.ok(listBindingRequests(insurer, {}).total >= 1)
  const acted = bindingRequestAction(insurer, created.binding_request_id, {
    action: 'approve',
    valid_from: '2026-01-01T00:00:00+08:00',
  })
  assert.equal(acted.state, 'approved')
  assert.ok(acted.binding_id)
})

async function seedPublishedResult() {
  resetState()
  restoreFamily()
  const insurer = ctxOf('insurer01')
  const app = createApplication(insurer, {
    applicant_id: 'P_SQ_01',
    type: 'first_apply',
    application_level: '重度失能Ⅱ级',
    tenant_id: 'insurer',
  })
  submitApplication(insurer, app.application_id)
  applicationAction(insurer, app.application_id, { action: 'accept' })
  applicationAction(insurer, app.application_id, { action: 'materials_pass' })
  const task = createAssessmentTask(insurer, {
    application_id: app.application_id,
    assessor_account: 'assessor01',
  })
  const asr = ctxOf('assessor01')
  acceptTask(asr, task.task_id)
  startTask(asr, task.task_id)
  addEvidence(asr, task.task_id, { type: 'evidence_assessment', note: '现场' })
  const sub = submitTask(asr, task.task_id, { assessor_level: '重度失能Ⅱ级' })
  approveReview(insurer, sub.result.result_id, {})
  return { appId: app.application_id, resultId: sub.result.result_id, insurer }
}

test('AC-F09 申诉创建并进入受理队列', async () => {
  const { appId, resultId, insurer } = await seedPublishedResult()
  const created = createAppeal(famCtx(), {
    application_id: appId,
    result_id: resultId,
    reason: '对等级有异议',
  })
  assert.ok(created.appeal_id.startsWith('APL'))
  assert.equal(created.next_owner_role, 'insurer')
  const queue = listAppeals(insurer, {})
  assert.ok(queue.list.some((a) => a.appeal_id === created.appeal_id))
})

test('AC-F07 申诉闭环：受理→决定→发布，家属可见答复', async () => {
  const { appId, resultId, insurer } = await seedPublishedResult()
  const created = createAppeal(famCtx(), {
    application_id: appId,
    result_id: resultId,
    reason: '异议说明',
  })
  appealAction(insurer, created.appeal_id, { action: 'accept' })
  const medical = ctxOf('medical01')
  appealAction(medical, created.appeal_id, { action: 'decide', reason: '维持原结论，书面答复' })
  const pub = appealAction(medical, created.appeal_id, { action: 'publish' })
  assert.equal(pub.state, 'appeal_approved')
  const detail = getAppeal(famCtx(), created.appeal_id)
  assert.ok(detail.public_reply)
  assert.equal(detail.public_reply.publisher, medical.username)
})

test('AC-T01/T05 标签与宿迁在册 3 台', () => {
  resetState()
  restoreFamily()
  const su = ctxOf('su01')
  const page = listDeviceLabels(su, { page_size: 100 })
  assert.ok(page.total > 0)
  const stats = deviceLabelStats(su, { group_by: 'program_stage' })
  assert.equal(stats.suqian_registered, 3)
  assert.equal(typeof stats.scan_record_total, 'number')
})

test('AC-T02/T03 标签版本与越权', () => {
  resetState()
  restoreFamily()
  const su = ctxOf('su01')
  const page = listDeviceLabels(su, { page_size: 1 })
  const id = page.list[0].device_id
  const v0 = page.list[0].version
  const res = patchDeviceLabels(su, id, { program_stage: 'pilot', reason: '试点标记', expected_version: v0 })
  assert.equal(res.device.version, v0 + 1)
  assert.ok(res.receipt.receipt_id)
  const assessor = ctxOf('assessor01')
  assert.throws(
    () => patchDeviceLabels(assessor, id, { program_stage: 'formal', reason: 'x' }),
    (e) => e.status === 403 || e.status === 404,
  )
})

test('AC-T04 相同筛选 total 一致', () => {
  resetState()
  restoreFamily()
  const su = ctxOf('su01')
  const a = listDeviceLabels(su, { program_stage: 'pilot', page_size: 1000 })
  const b = listDeviceLabels(su, { program_stage: 'pilot', page_size: 1000 })
  assert.equal(a.total, b.total)
})

test('AC-O06/O07 设备绑定创建与结束保留区间', () => {
  resetState()
  restoreFamily()
  const admin = ctxOf('kaijian_admin')
  const page = listDeviceLabels(ctxOf('su01'), { page_size: 1 })
  const deviceId = page.list[0].device_id + '-free'
  const created = createDeviceBinding(admin, {
    subject_id: 'P_SQ_01',
    device_id: deviceId,
    project_id: 'suqian',
    reason: '机构代办绑定',
    valid_from: '2026-01-01T00:00:00+08:00',
  })
  assert.equal(created.binding.state, 'active')
  assert.ok(created.binding.valid_from)
  const ended = deviceBindingAction(admin, created.binding.binding_id, {
    action: 'end',
    reason: '迁移',
  })
  assert.equal(ended.binding.state, 'ended')
  assert.ok(ended.binding.valid_until)
  const list = listDeviceBindings(admin, { subject_id: 'P_SQ_01' })
  assert.ok(list.total >= 1)
})

test('AC-F10 撤销授权后绑定状态 revoked', () => {
  resetState()
  restoreFamily()
  const created = createBindingRequest(famCtx(), { subject_id: 'P_SQ_01' })
  bindingRequestAction(ctxOf('insurer01'), created.binding_request_id, {
    action: 'revoke',
    reason: '撤销',
  })
  const acc = ACCOUNTS.find((a) => a.username === 'family_demo')
  assert.equal(acc.binding_status, 'revoked')
  const bindings = listFamilyBindings(famCtx())
  if (bindings.total > 0) {
    assert.equal(bindings.list[0].binding_status, 'revoked')
  }
  restoreFamily()
})
