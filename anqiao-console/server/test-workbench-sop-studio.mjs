// TDD 红测：SOP 流程树服务化与实时徽标（LTC-WORKBENCH-SPEC §12.4 / API-CONTRACT N16）
// 运行：node --test server/test-workbench-sop-studio.mjs
process.env.SEED_ACCOUNT_PASSWORD ||= `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
process.env.DISABLE_LTC_PERSIST ||= 'true'

const { test } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const {
  setPersistEnabled,
  resetState,
  ctxForAccount,
  getWorkbenchSummary,
  getWorkbenchWorkflowTree,
  listApplications,
  listAssessmentTasks,
  listSettlements,
} = await import('./ltc.js')
const { ACCOUNTS } = await import('./seed.js')
const { validateWorkflowAccess } = await import('./workbench-workflow-tree.js')

setPersistEnabled(false)

function ctxOf(username) {
  const account = ACCOUNTS.find((a) => a.username === username)
  if (!account) throw new Error('missing account ' + username)
  return ctxForAccount(account)
}

function countBy(arr, pred) {
  return arr.filter(pred).length
}

test('T1: insurer01 (insurer_staff) 生成受理派单+结算初审综合树，徽标为实时计数', () => {
  resetState()
  const ctx = ctxOf('insurer01')
  const tree = getWorkbenchWorkflowTree(ctx)

  assert.equal(tree.role, 'insurer_staff')
  assert.ok(tree.domainTitle)
  assert.ok(tree.groups.length >= 2, '综合经办树至少含今日必办与结算初审两组')

  // 受理派单阶段与结算初审阶段并存（insurer_staff 具备两域权限）
  const todayGroup = tree.groups.find((g) => g.groupKey === 'today_queue')
  assert.ok(todayGroup, '必须包含今日必办分组')
  const settlementGroup = tree.groups.find((g) => g.groupKey === 'settlement_audit')
  assert.ok(settlementGroup, 'insurer_staff 须同时可见结算初审流')

  // 徽标 = 本人范围内实时状态计数（与 listApplications 同口径）
  const apps = listApplications(ctx, {})
  const expectedNew = countBy(apps, (a) => a.status === 'submitted')
  const newItem = todayGroup.items.find((i) => i.stageKey === 'new_applications')
  assert.ok(newItem, '必须包含参保资格初验节点')
  assert.equal(newItem.badgeCount, expectedNew)

  const sets = listSettlements(ctx, {})
  const expectedSettlements = countBy(sets, (s) => s.status === 'declared')
  const settleItem = settlementGroup.items.find((i) => i.stageKey === 'pending_settlements')
  assert.ok(settleItem)
  assert.equal(settleItem.badgeCount, expectedSettlements)
})

test('T2: assessor01 树仅含外勤现场评定流，徽标与本人任务实时一致，无专家/经办节点', () => {
  resetState()
  const ctx = ctxOf('assessor01')
  const tree = getWorkbenchWorkflowTree(ctx)

  assert.equal(tree.role, 'assessor')
  const fieldGroup = tree.groups.find((g) => g.groupKey === 'field_evaluation')
  assert.ok(fieldGroup, '必须包含现场评定流')

  const tasks = listAssessmentTasks(ctx, {})
  const expectedPending = countBy(tasks, (t) => t.status === 'assigned')
  const pendingItem = fieldGroup.items.find((i) => i.stageKey === 'pending_visit')
  assert.ok(pendingItem)
  assert.equal(pendingItem.badgeCount, expectedPending)

  // 防混杂：外勤评定师严禁专家会签/经办派单/结算节点
  assert.equal(tree.groups.some((g) => g.groupKey === 'expert_committee'), false)
  assert.equal(tree.groups.some((g) => g.groupKey === 'intake_dispatch'), false)
  assert.equal(tree.groups.some((g) => g.groupKey === 'settlement_audit'), false)
})

test('T3: 树结构符合前端 SDD 契约 workbench-ia.ts DedicatedWorkbenchTree', () => {
  resetState()
  const ctx = ctxOf('insurer01')
  const tree = getWorkbenchWorkflowTree(ctx)

  assert.equal(typeof tree.role, 'string')
  assert.equal(typeof tree.workspaceKey, 'string')
  assert.equal(typeof tree.domainTitle, 'string')
  assert.ok(Array.isArray(tree.groups) && tree.groups.length > 0)

  for (const group of tree.groups) {
    assert.equal(typeof group.groupKey, 'string')
    assert.equal(typeof group.groupLabel, 'string')
    assert.ok(Array.isArray(group.items) && group.items.length > 0)
    for (const item of group.items) {
      assert.equal(typeof item.stageKey, 'string')
      assert.equal(typeof item.label, 'string')
      assert.equal(typeof item.badgeCount, 'number')
      assert.ok(['normal', 'warn', 'danger'].includes(item.badgeTone))
    }
  }
})

test('T4: suqian_expert 树含专家会审流（实时计数），严禁外勤打卡节点', () => {
  resetState()
  const ctx = ctxOf('suqian_expert')
  const tree = getWorkbenchWorkflowTree(ctx)

  assert.equal(tree.role, 'assessor_expert')
  const expertGroup = tree.groups.find((g) => g.groupKey === 'expert_committee')
  assert.ok(expertGroup, '专家树必须含专家委员会会审分组')

  const tasks = listAssessmentTasks(ctx, {})
  const expectedExpert = countBy(tasks, (t) => t.status === 'pending_expert_review')
  const expertItem = expertGroup.items.find((i) => i.stageKey === 'pending_expert_review')
  assert.ok(expertItem)
  assert.equal(expertItem.badgeCount, expectedExpert)

  assert.equal(tree.groups.some((g) => g.groupKey === 'field_evaluation'), false, '专家严禁外勤打卡流')
})

test('T5: 跨角色节点访问防越权：assessor 访问经办节点必须 FORBIDDEN 拦截', () => {
  const assessorUser = { role: 'assessor', permissions: ['task:read', 'task:operate'] }
  assert.throws(
    () => validateWorkflowAccess(assessorUser, 'new_applications'),
    /FORBIDDEN_WORKFLOW_NODE/,
  )

  const insurerUser = { role: 'insurer_staff', permissions: ['application:read', 'task:dispatch', 'settlement:review'] }
  assert.throws(
    () => validateWorkflowAccess(insurerUser, 'pending_visit'),
    /FORBIDDEN_WORKFLOW_NODE/,
  )
})

test('T6: 徽标与 N01 workbench summary 分组同口径联动', () => {
  resetState()
  const ctx = ctxOf('insurer01')
  const tree = getWorkbenchWorkflowTree(ctx)
  const summary = getWorkbenchSummary(ctx, { workspace: ctx.workspace })

  const summaryPendingAccept = summary.groups.find((g) => g.key === 'pending_accept')
  assert.ok(summaryPendingAccept)
  const newItem = tree.groups
    .flatMap((g) => g.items)
    .find((i) => i.stageKey === 'new_applications')
  assert.ok(newItem)
  assert.equal(newItem.badgeCount, summaryPendingAccept.total, 'new_applications 徽标必须等于 N01 待受理分组计数')

  // summaryGroup 字段供前端以 N01 轮询实时刷新徽标
  assert.equal(newItem.summaryGroup, 'pending_accept')
})
