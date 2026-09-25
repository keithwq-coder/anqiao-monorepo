// 长护险最小闭环验收脚本（Node 内置 node:test）
// 运行：node --test server/test-ltc.mjs
// 覆盖：角色权限、评估提交锁定/退回、复评新版本、监测证据红线、监管暂缓、报告模拟。
// 直接驱动 server/ltc.js；关闭文件持久化，避免测试污染 ltc-store.json。

// 测试专用种子口令：必须在 import seed.js 之前注入（ESM import 提升）
process.env.SEED_ACCOUNT_PASSWORD ||= `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const { test, beforeEach } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const { ACCOUNTS } = await import('./seed.js')
const {
  setPersistEnabled,
  resetState,
  ctxForAccount,
  dataScopeOf,
  permissionsOf,
  createApplication,
  listApplications,
  getApplication,
  submitApplication,
  createAssessmentTask,
  listAssessmentTasks,
  getAssessmentTask,
  acceptTask,
  startTask,
  addEvidence,
  submitTask,
  returnTask,
  approveReview,
  createSupervisionCase,
  generateReport,
  getReport,
  getState,
} = await import('./ltc.js')

setPersistEnabled(false)

function ctxOf(username) {
  const a = ACCOUNTS.find((x) => x.username === username)
  return ctxForAccount(a)
}

// 一位“别的评估员”（未播种，直接构造 ctx）
const OTHER_ASSESSOR = {
  username: 'assessor02',
  role: 'assessor',
  tenant_id: 'assessor_org',
  staff_name: '评估员B',
  org_id: 'assessor_org',
  applicant_ids: [],
}

// 家属联系人 ctx（绑定长者 P00001）
const FAMILY = {
  username: 'fc_001',
  role: 'family_contact',
  tenant_id: 'kaijian',
  staff_name: '孙**',
  org_id: 'kaijian',
  applicant_ids: ['P00001'],
}

// ---------- 辅助：跑完申请→派单→接单→评估→提交→审核的完整链 ----------
function makeSubmittedApplication(byCtx = ctxOf('insurer01')) {
  const app = createApplication(byCtx, { applicant_id: 'P00084', type: 'first_apply' })
  return submitApplication(byCtx, app.application_id)
}

function dispatchAndAssess({ assessor = ctxOf('assessor01'), dispatcher = ctxOf('insurer01') } = {}) {
  const app = makeSubmittedApplication()
  const task = createAssessmentTask(dispatcher, {
    application_id: app.application_id,
    assessor_account: assessor.username,
  })
  acceptTask(assessor, task.task_id)
  startTask(assessor, task.task_id)
  const { result } = submitTask(assessor, task.task_id)
  return { app, task, result }
}

beforeEach(() => {
  resetState()
})

// ---------- 组织 / 角色 / 登录字段基线 ----------
test('组织与角色：太平洋保险组织存在，各角色 data_scope / permissions 合理', () => {
  assert.equal(dataScopeOf('su'), 'global')
  assert.equal(dataScopeOf('admin'), 'org')
  assert.equal(dataScopeOf('user'), 'org')
  assert.equal(dataScopeOf('family_contact'), 'applicant')
  assert.equal(dataScopeOf('medical_insurance_staff'), 'pool')
  assert.equal(dataScopeOf('insurer_staff'), 'pool')
  assert.equal(dataScopeOf('assessor'), 'task')

  const principal = ctxForAccount(ACCOUNTS.find((a) => a.username === 'insurer01'))
  assert.equal(principal.org_id, 'insurer')
  assert.ok(permissionsOf('su').includes('*'))
  assert.ok(permissionsOf('insurer_staff').includes('result:approve'))
  assert.ok(permissionsOf('assessor').includes('task:operate'))
  assert.ok(!permissionsOf('user').includes('result:approve'))
})

// ---------- 申请创建/提交 ----------
test('申请：insurer/admin/user 可创建并提交；assessor 越权创建返回 403', () => {
  const app = createApplication(ctxOf('user01'), { applicant_id: 'P00084' })
  assert.equal(app.status, 'draft')
  const submitted = submitApplication(ctxOf('user01'), app.application_id)
  assert.equal(submitted.status, 'submitted')
  assert.throws(() => createApplication(ctxOf('assessor01'), { applicant_id: 'P00084' }), { status: 403 })
})

test('申请：同一期内同类型重复发起返回 409', () => {
  createApplication(ctxOf('insurer01'), { applicant_id: 'P00084', type: 'first_apply' })
  assert.throws(
    () => createApplication(ctxOf('insurer01'), { applicant_id: 'P00084', type: 'first_apply' }),
    { status: 409 },
  )
})

// ---------- 派单与回避 ----------
test('派单：insurer 可派单，assessor 不可派单返回 403', () => {
  const app = makeSubmittedApplication()
  assert.throws(
    () => createAssessmentTask(ctxOf('assessor01'), { application_id: app.application_id, assessor_account: 'assessor01' }),
    { status: 403 },
  )
  const task = createAssessmentTask(ctxOf('insurer01'), { application_id: app.application_id, assessor_account: 'assessor01' })
  assert.equal(task.status, 'assigned')
})

test('派单回避：评估员与被评者机构利益相关时拒绝 409', () => {
  // 用“评估机构”租户下的申请触发冲突：评估员 org == 申请 tenant
  const app = createApplication({ ...ctxOf('insurer01'), tenant_id: 'assessor_org', org_id: 'assessor_org' }, { applicant_id: 'P00084' })
  submitApplication({ ...ctxOf('insurer01'), tenant_id: 'assessor_org', org_id: 'assessor_org' }, app.application_id)
  assert.throws(
    () => createAssessmentTask(ctxOf('insurer01'), { application_id: app.application_id, assessor_account: 'assessor01' }),
    { status: 409 },
  )
})

// ---------- 评估员只能操作自己的任务 ----------
test('评估员越权操作他人任务返回 404', () => {
  const { task } = dispatchAndAssess()
  assert.throws(() => acceptTask(OTHER_ASSESSOR, task.task_id), { status: 404 })
  assert.throws(() => getAssessmentTask(OTHER_ASSESSOR, task.task_id), { status: 404 })
})

test('评估员仅能在自己任务上录入证据，非评估角色 404', () => {
  const app = makeSubmittedApplication()
  const task = createAssessmentTask(ctxOf('insurer01'), { application_id: app.application_id, assessor_account: 'assessor01' })
  const assessor = ctxOf('assessor01')
  assert.throws(() => addEvidence(assessor, task.task_id, { type: 'evidence_assessment' }), { status: 400 })
  acceptTask(assessor, task.task_id)
  const ev = addEvidence(assessor, task.task_id, { type: 'evidence_assessment', item_id: 'itm-bath', assessed_value: 1, signature_ref: 'sig-1' })
  assert.equal(ev.recorded_by, 'assessor01')
  // 非评估员试图往他人任务录证据 → 404
  assert.throws(() => addEvidence(ctxOf('user01'), task.task_id, { type: 'evidence_assessment' }), { status: 404 })
})

// ---------- 监测证据红线：仅作证据，不得写入等级 ----------
test('监测证据：设备数据仅 evidence，source=mock、is_simulated、conclusion 恒 null', () => {
  const app = makeSubmittedApplication()
  const task = createAssessmentTask(ctxOf('insurer01'), { application_id: app.application_id, assessor_account: 'assessor01' })
  const assessor = ctxOf('assessor01')
  acceptTask(assessor, task.task_id)
  const ev = addEvidence(assessor, task.task_id, {
    type: 'evidence_monitoring',
    metrics: { night_trips: 43, in_bed_rate_pct: 61.2 },
  })
  assert.equal(ev.source, 'mock')
  assert.equal(ev.is_simulated, true)
  assert.equal(ev.conclusion, null)
})

// ---------- 评估提交后锁定、退回必须 reason、复评新版本 ----------
test('评估提交：任务锁定，重复提交/再录证据返回 400', () => {
  const { task } = dispatchAndAssess()
  const assessor = ctxOf('assessor01')
  assert.throws(() => submitTask(assessor, task.task_id), { status: 400 }) // 重复提交
  assert.throws(() => addEvidence(assessor, task.task_id, { type: 'evidence_assessment' }), { status: 400 }) // 锁定
  assert.throws(() => acceptTask(assessor, task.task_id), { status: 400 }) // 已 completed
})

test('退回必须 reason：无 reason 400，有 reason 则任务与结果回退 returned', () => {
  const { task } = dispatchAndAssess()
  assert.throws(() => returnTask(ctxOf('insurer01'), task.task_id, {}), { status: 400 })
  const out = returnTask(ctxOf('insurer01'), task.task_id, { reason: '评估记录缺失签名' })
  assert.equal(out.task.status, 'returned')
  assert.equal(out.result.status, 'returned')
  assert.equal(out.result.return_reason, '评估记录缺失签名')
})

test('复评生成新版本结果，历史轮次全量留存', () => {
  const app = makeSubmittedApplication()
  // 第 1 轮
  const t1 = createAssessmentTask(ctxOf('insurer01'), { application_id: app.application_id, assessor_account: 'assessor01' })
  acceptTask(ctxOf('assessor01'), t1.task_id)
  startTask(ctxOf('assessor01'), t1.task_id)
  const { result: r1 } = submitTask(ctxOf('assessor01'), t1.task_id)
  assert.equal(r1.version, 1)
  // 退回
  returnTask(ctxOf('insurer01'), t1.task_id, { reason: '需补充证据' })
  // 第 2 轮（复评新任务 → 新版本）
  const t2 = createAssessmentTask(ctxOf('insurer01'), { application_id: app.application_id, assessor_account: 'assessor01' })
  acceptTask(ctxOf('assessor01'), t2.task_id)
  startTask(ctxOf('assessor01'), t2.task_id)
  const { result: r2 } = submitTask(ctxOf('assessor01'), t2.task_id)
  assert.equal(r2.version, 2)
  assert.notEqual(r1.result_id, r2.result_id)
  const versions = getState().results.filter((r) => r.application_id === app.application_id)
  assert.equal(versions.length, 2) // 历史轮次全量留存
})

// ---------- 经办审核 ----------
test('审核：insurer 可审核通过；assessor 无权限返回 403', () => {
  const { result } = dispatchAndAssess()
  assert.throws(() => approveReview(ctxOf('assessor01'), result.result_id), { status: 403 })
  const approved = approveReview(ctxOf('insurer01'), result.result_id)
  assert.equal(approved.status, 'approved')
  assert.equal(approved.confirmed_by, 'insurer01')
  // 重复审核返回 400
  assert.throws(() => approveReview(ctxOf('insurer01'), result.result_id), { status: 400 })
})

// ---------- 监管 / 暂缓 ----------
test('监管：medical 可创建监管案件并暂缓结果；他人无权限 403', () => {
  const { result } = dispatchAndAssess()
  assert.throws(() => createSupervisionCase(ctxOf('user01'), { result_id: result.result_id, action: 'suspend' }), { status: 403 })
  const sup = createSupervisionCase(ctxOf('medical01'), { result_id: result.result_id, action: 'suspend', remarks: '抽审存疑' })
  assert.equal(sup.action, 'suspend')
  const res = getState().results.find((r) => r.result_id === result.result_id)
  assert.equal(res.status, 'suspended')
})

// ---------- 报告模拟 ----------
test('报告：user 仅个人报告（user_health），生成 mock/is_simulated；无法生成业务报告 403', () => {
  const user = ctxOf('user01')
  const r = generateReport(user, { type: 'user_health' })
  assert.equal(r.source, 'mock')
  assert.equal(r.is_simulated, true)
  assert.equal(r.owner, 'user01')
  assert.throws(() => generateReport(user, { type: 'long_care_insurance' }), { status: 403 })
})

test('报告：insurer 可生成 long_care_insurance；他人无法读取本人报告 404', () => {
  const insurer = ctxOf('insurer01')
  const rep = generateReport(insurer, { type: 'long_care_insurance', period: '2026-Q3' })
  assert.equal(rep.is_simulated, true)
  assert.equal(getReport(insurer, rep.report_id).report_id, rep.report_id)
  // user 读不到 insurer 的报告（仅个人报告）
  assert.throws(() => getReport(ctxOf('user01'), rep.report_id), { status: 404 })
})

// ---------- 家属联系人数据范围 ----------
test('家属联系人：仅本绑定长者范畴，越权读他人返回 404', () => {
  createApplication(FAMILY, { applicant_id: 'P00001' })
  const mine = createApplication(FAMILY, { applicant_id: 'P00001', type: 'change' })
  assert.equal(getApplication(FAMILY, mine.application_id).applicant_id, 'P00001')
  // 为他人长者建申请 → 403
  assert.throws(() => createApplication(FAMILY, { applicant_id: 'P00099' }), { status: 403 })
  const other = createApplication(ctxOf('insurer01'), { applicant_id: 'P00099' })
  assert.throws(() => getApplication(FAMILY, other.application_id), { status: 404 })
  // 列表仅含本人长者
  assert.ok(listApplications(FAMILY).every((a) => a.applicant_id === 'P00001'))
})

// ---------- 数据范围：user 仅本机构申请；列表过滤生效 ----------
test('数据范围：user 仅本机构申请，insurer 看统筹区全量', () => {
  createApplication(ctxOf('user01'), { applicant_id: 'P00001' }) // anqiao（中科安樵组织）
  createApplication(ctxOf('insurer01'), { applicant_id: 'P00002' }) // insurer
  const userApps = listApplications(ctxOf('user01'))
  assert.ok(userApps.length >= 1 && userApps.every((a) => a.tenant_id === 'anqiao'))
  const insurerTasks = listAssessmentTasks(ctxOf('insurer01'))
  assert.equal(insurerTasks.length, 0)
})
