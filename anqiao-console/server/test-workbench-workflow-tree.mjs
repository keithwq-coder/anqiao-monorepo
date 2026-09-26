/**
 * TDD 单元测试：独立账号工作台流程树生成引擎与权限裁剪（Workflow Tree Generator）
 * 依据：docs/LTC-WORKBENCH-SPEC.md §12.4 与 §12.5
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWorkflowTree, validateWorkflowAccess } from './workbench-workflow-tree.js'

test('TDD 1: 现场评估师 (assessor) 应生成纯粹的外勤现场评定 SOP 树，无专家终审和经办科室', () => {
  const tree = generateWorkflowTree({
    role: 'assessor',
    permissions: ['task:read', 'evidence:write', 'result:submit', 'monitoring:read'],
    summaryStats: {
      pending_visit: 3,
      in_progress: 1,
      materials_reject: 0,
    },
  })

  assert.equal(tree.role, 'assessor')
  assert.equal(tree.domainTitle, '失能等级现场评定工作台')
  assert.ok(tree.groups.length >= 2)

  // 必须有现场评定流
  const fieldGroup = tree.groups.find((g) => g.groupKey === 'field_evaluation')
  assert.ok(fieldGroup, '必须包含现场评定流分组')
  assert.ok(fieldGroup.items.some((i) => i.stageKey === 'pending_visit' && i.badgeCount === 3))
  assert.ok(fieldGroup.items.some((i) => i.stageKey === 'in_progress' && i.badgeCount === 1))

  // 严禁包含医学专家终审或公信力大盘
  assert.equal(tree.groups.some((g) => g.groupKey === 'expert_committee'), false, '外勤评估师严禁出现专家委员会会签节点')
  assert.equal(tree.groups.some((g) => g.groupKey === 'insurer_dispatch'), false, '外勤评估师严禁出现商保派单节点')
})

test('TDD 2: 临床评审医学专家 (assessor_expert) 应生成三甲质证会审树，严禁出现外勤打卡', () => {
  const tree = generateWorkflowTree({
    role: 'assessor_expert',
    permissions: ['evidence:read', 'monitoring:read', 'result:approve', 'expert_review:sign'],
    summaryStats: {
      pending_expert_review: 2,
      dispute_hearing: 1,
    },
  })

  assert.equal(tree.role, 'assessor_expert')
  assert.equal(tree.domainTitle, '评定专家委员会医学评审工作台')

  // 必须有专家会审流
  const expertGroup = tree.groups.find((g) => g.groupKey === 'expert_committee')
  assert.ok(expertGroup, '必须包含专家委员会会审分组')
  assert.ok(expertGroup.items.some((i) => i.stageKey === 'pending_expert_review' && i.badgeCount === 2))

  // 严禁包含现场入户打卡节点
  assert.equal(tree.groups.some((g) => g.groupKey === 'field_evaluation'), false, '医学专家严禁出现外勤上门打卡节点')
})

test('TDD 3: 商保经办受理员 (insurer_intake) 与结算员 (insurer_auditor) 职责严格隔离', () => {
  const intakeTree = generateWorkflowTree({
    role: 'insurer_intake',
    permissions: ['application:read', 'application:verify', 'task:dispatch'],
    summaryStats: { new_applications: 5 },
  })
  assert.ok(intakeTree.groups.some((g) => g.groupKey === 'intake_dispatch'), '受理员必须有受理派单流')
  assert.equal(intakeTree.groups.some((g) => g.groupKey === 'settlement_audit'), false, '受理员严禁出现结算审核流')

  const auditorTree = generateWorkflowTree({
    role: 'insurer_auditor',
    permissions: ['settlement:read', 'settlement:review', 'application:read'],
    summaryStats: { pending_settlements: 4 },
  })
  assert.ok(auditorTree.groups.some((g) => g.groupKey === 'settlement_audit'), '结算员必须有结算审核流')
  assert.equal(auditorTree.groups.some((g) => g.groupKey === 'intake_dispatch'), false, '结算员严禁出现受理派单流')
})

test('TDD 4: 节点访问防越权拦截器：跨角色访问非法节点抛出 403 异常', () => {
  const assessorUser = { role: 'assessor', permissions: ['task:read', 'task:evidence'] }

  // 访问合法的入户节点
  assert.equal(validateWorkflowAccess(assessorUser, 'pending_visit'), true)

  // 越权访问专家终审签字节点
  assert.throws(() => {
    validateWorkflowAccess(assessorUser, 'expert_review_sign')
  }, /FORBIDDEN_WORKFLOW_NODE/, '评估师越权访问专家节点必须被拦截')
})
