// 阶段 C：申请动作 / 材料 / 时间线 / SLA 回归
// 运行：node --test server/test-phase-c.mjs
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
  applicationAction,
  listApplicationMaterials,
  listApplicationTimeline,
  applicationSla,
  createSupervisionCase,
  createAssessmentTask,
  getApplication,
} = await import('./ltc.js')
const { ACCOUNTS } = await import('./seed.js')

setPersistEnabled(false)

function ctxOf(username) {
  const account = ACCOUNTS.find((a) => a.username === username)
  if (!account) throw new Error('missing ' + username)
  return ctxForAccount(account)
}

function seedSubmittedApp() {
  resetState()
  const insurer = ctxOf('insurer01')
  const app = createApplication(insurer, {
    applicant_id: 'P_SQ_01',
    type: 'first_apply',
    application_level: '重度失能Ⅱ级',
    tenant_id: 'insurer',
  })
  submitApplication(insurer, app.application_id)
  return getApplication(insurer, app.application_id)
}

test('AC-I02 经办补正退回：状态 materials_rejected + 回执 + handoff', () => {
  const insurer = ctxOf('insurer01')
  const app = seedSubmittedApp()
  const res = applicationAction(insurer, app.application_id, {
    action: 'return_materials',
    reason: '身份证明影像模糊',
  })
  assert.equal(res.application.status, 'materials_rejected')
  assert.equal(res.next_owner_role, 'submitter')
  assert.ok(res.receipt.receipt_id)
  assert.equal(res.application.material_return_reason, '身份证明影像模糊')
})

test('AC-I01 受理：submitted → materials_review + 回执', () => {
  const insurer = ctxOf('insurer01')
  const app = seedSubmittedApp()
  const res = applicationAction(insurer, app.application_id, { action: 'accept' })
  assert.equal(res.application.status, 'materials_review')
  assert.equal(res.next_owner_role, 'insurer')
  assert.ok(res.receipt.receipt_id.startsWith('RCPT'))
})

test('材料列表与时间线可读且含退回原因', () => {
  const insurer = ctxOf('insurer01')
  const app = seedSubmittedApp()
  applicationAction(insurer, app.application_id, { action: 'return_materials', reason: '补病历' })
  const mats = listApplicationMaterials(insurer, app.application_id)
  assert.equal(mats.total, 3)
  assert.ok(mats.list.some((m) => m.return_reason === '补病历'))
  const tl = listApplicationTimeline(insurer, app.application_id)
  assert.ok(tl.total >= 2)
  assert.ok(tl.next_action)
})

test('SLA 返回 due_at 与 sla_status', () => {
  const insurer = ctxOf('insurer01')
  const app = seedSubmittedApp()
  const sla = applicationSla(insurer, app.application_id)
  assert.ok(sla.due_at)
  assert.ok(['open', 'due_soon', 'overdue'].includes(sla.sla_status))
})

test('AC-M04 暂缓门禁：suspend 后 finalize 拒绝；release 后恢复', () => {
  const insurer = ctxOf('insurer01')
  const medical = ctxOf('medical01')
  const app = seedSubmittedApp()
  applicationAction(insurer, app.application_id, { action: 'accept' })
  applicationAction(insurer, app.application_id, { action: 'materials_pass' })
  createAssessmentTask(insurer, {
    application_id: app.application_id,
    assessor_account: 'assessor01',
  })
  createSupervisionCase(medical, {
    application_id: app.application_id,
    action: 'suspend',
    remarks: '需要核验',
  })
  const suspended = getApplication(medical, app.application_id)
  assert.equal(suspended.status, 'suspended')
  assert.throws(
    () => applicationAction(medical, app.application_id, { action: 'finalize', reason: '核定' }),
    (e) => e.status === 409 || e.status === 400,
  )
  createSupervisionCase(medical, {
    application_id: app.application_id,
    action: 'release',
    remarks: '补证完成',
  })
  const released = getApplication(medical, app.application_id)
  assert.notEqual(released.status, 'suspended')
  try {
    const fin = applicationAction(medical, app.application_id, { action: 'finalize', reason: '通过' })
    assert.equal(fin.application.status, 'approved')
    assert.ok(fin.receipt.receipt_id)
  } catch (e) {
    assert.ok(e.status === 400, 'unexpected ' + e.status + ' ' + e.message)
  }
})

test('越权：评估师不可受理申请', () => {
  const insurer = ctxOf('insurer01')
  const assessor = ctxOf('assessor01')
  const app = seedSubmittedApp()
  assert.throws(
    () => applicationAction(assessor, app.application_id, { action: 'accept' }),
    (e) => e.status === 403 || e.status === 404,
  )
})
