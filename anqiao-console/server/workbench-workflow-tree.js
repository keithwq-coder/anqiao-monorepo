/**
 * 工作台 SOP 流程树生成引擎与权限裁剪验证器
 * 依据：docs/LTC-WORKBENCH-SPEC.md §12.4 与 §12.5
 */

const ROLE_DOMAIN_MAP = {
  assessor: {
    domainTitle: '失能等级现场评定工作台',
    workspaceKey: 'assessor_field_studio',
    groups: [
      {
        groupKey: 'today_queue',
        groupLabel: '今日必做',
        items: [
          { stageKey: 'pending_visit', label: '待预约与入户', statKey: 'pending_visit', summaryGroup: 'pending_accept', permRequired: 'task:read' },
          { stageKey: 'materials_reject', label: '质控补齐退回件', statKey: 'materials_reject', summaryGroup: 'returned_edit', permRequired: 'evidence:write' },
        ],
      },
      {
        groupKey: 'field_evaluation',
        groupLabel: '现场失能评定流',
        items: [
          { stageKey: 'pending_visit', label: '预约与入户查验', statKey: 'pending_visit', summaryGroup: 'pending_accept', permRequired: 'task:read' },
          { stageKey: 'in_progress', label: '现场四领域量表填报', statKey: 'in_progress', summaryGroup: 'in_field', permRequired: 'evidence:write' },
          { stageKey: 'completed_archive', label: '已完成归档卷宗', statKey: 'completed_archive', summaryGroup: 'submitted', permRequired: 'task:read' },
        ],
      },
      {
        groupKey: 'evidence_support',
        groupLabel: '客观物联质证',
        items: [
          { stageKey: 'sensor_telemetry', label: '安守护客观监测数据包', statKey: 'sensor_telemetry', permRequired: 'monitoring:read' },
        ],
      },
    ],
  },
  assessor_admin: {
    domainTitle: '评估机构质控与公信力中心',
    workspaceKey: 'assessor_workspace',
    groups: [
      {
        groupKey: 'quality_oversight',
        groupLabel: '质控与公信力中心',
        items: [
          { stageKey: 'gaussian_monitor', label: '统筹区高斯偏离监控', statKey: 'gaussian_monitor', permRequired: 'evidence:read' },
          { stageKey: 'completed_archive', label: '已完成归档卷宗', statKey: 'completed_archive', summaryGroup: 'submitted', permRequired: 'task:read' },
        ],
      },
    ],
  },
  assessor_expert: {
    domainTitle: '评定专家委员会医学评审工作台',
    workspaceKey: 'assessor_expert_studio',
    groups: [
      {
        groupKey: 'expert_committee',
        groupLabel: '专家委员会评审流',
        items: [
          { stageKey: 'pending_expert_review', label: '待专家终审案卷', statKey: 'pending_expert_review', permRequired: 'result:approve' },
          { stageKey: 'clinical_verify', label: '临床客观对撞质证室', statKey: 'clinical_verify', permRequired: 'monitoring:read' },
          { stageKey: 'dispute_hearing', label: '争议复核医学听证', statKey: 'dispute_hearing', permRequired: 'expert_review:sign' },
        ],
      },
      {
        groupKey: 'quality_oversight',
        groupLabel: '质控与公信力中心',
        items: [
          { stageKey: 'gaussian_monitor', label: '统筹区高斯偏离监控', statKey: 'gaussian_monitor', permRequired: 'evidence:read' },
        ],
      },
    ],
  },
  insurer_intake: {
    domainTitle: '商保长护经办受理与派单工作台',
    workspaceKey: 'insurer_intake_studio',
    groups: [
      {
        groupKey: 'intake_dispatch',
        groupLabel: '业务受理与派单流',
        items: [
          { stageKey: 'new_applications', label: '参保资格初验待办', statKey: 'new_applications', permRequired: 'application:read' },
          { stageKey: 'dispatch_queue', label: '评估机构回避派单', statKey: 'dispatch_queue', permRequired: 'task:dispatch' },
          { stageKey: 'intake_archive', label: '受理台账历史', statKey: 'intake_archive', permRequired: 'application:read' },
        ],
      },
    ],
  },
  insurer_auditor: {
    domainTitle: '商保长护待遇费用结算初审工作台',
    workspaceKey: 'insurer_auditor_studio',
    groups: [
      {
        groupKey: 'settlement_audit',
        groupLabel: '机构费用申报初审核销流',
        items: [
          { stageKey: 'pending_settlements', label: '机构月度申报待初审', statKey: 'pending_settlements', permRequired: 'settlement:review' },
          { stageKey: 'deduction_audit', label: '物联异常扣减核算', statKey: 'deduction_audit', permRequired: 'settlement:review' },
          { stageKey: 'voucher_generate', label: '医保初审拨付凭证出具', statKey: 'voucher_generate', permRequired: 'settlement:review' },
        ],
      },
    ],
  },
  medical_auditor: {
    domainTitle: '医保基金监管与反欺诈案件中心',
    workspaceKey: 'medical_auditor_studio',
    groups: [
      {
        groupKey: 'fraud_cases',
        groupLabel: '反欺诈案件中心（一案一档）',
        items: [
          { stageKey: 'leads_pool', label: '智能疑点线索研判', statKey: 'leads_pool', permRequired: 'supervision:read' },
          { stageKey: 'case_investigation', label: '立案调查与证据固定', statKey: 'case_investigation', permRequired: 'supervision:operate' },
          { stageKey: 'recovery_punishment', label: '基金追回与行政处罚', statKey: 'recovery_punishment', permRequired: 'supervision:create' },
        ],
      },
    ],
  },
  // insurer_staff / insurer_operator：经办机构登录承载角色（现行账号矩阵 insurer01 即该角色），
  // 在既有 insurer_operations 单工作台内承载受理派单与结算初审双域合法职能（权限并集裁剪）。
  insurer_staff: {
    domainTitle: '商保长护受托经办综合业务工作台',
    workspaceKey: 'insurer_operations',
    groups: [
      {
        groupKey: 'today_queue',
        groupLabel: '今日必办',
        items: [
          { stageKey: 'new_applications', label: '参保资格初验待办', statKey: 'new_applications', summaryGroup: 'pending_accept', permRequired: 'application:read' },
          { stageKey: 'dispatch_queue', label: '评估机构回避派单', statKey: 'dispatch_queue', summaryGroup: 'pending_dispatch', permRequired: 'task:dispatch' },
          { stageKey: 'materials_follow', label: '补正跟进队列', statKey: 'materials_follow', summaryGroup: 'pending_materials', permRequired: 'application:read' },
        ],
      },
      {
        groupKey: 'settlement_audit',
        groupLabel: '结算初审与核销流',
        items: [
          { stageKey: 'pending_settlements', label: '机构月度申报待初审', statKey: 'pending_settlements', summaryGroup: 'pending_pre_review', permRequired: 'settlement:review' },
          { stageKey: 'voucher_archive', label: '初审意见书档案', statKey: 'voucher_archive', permRequired: 'settlement:read' },
        ],
      },
      {
        groupKey: 'supervision_assist',
        groupLabel: '医保督办协查',
        items: [
          { stageKey: 'clue_feedback', label: '督办线索协查回执', statKey: 'clue_feedback', permRequired: 'supervision:read' },
        ],
      },
      {
        groupKey: 'iot_inspection',
        groupLabel: '物联靶向飞检',
        items: [
          { stageKey: 'iot_inspections', label: '物联异常靶向飞检工单', statKey: 'iot_inspections', permRequired: 'supervision:read' },
        ],
      },
    ],
  },
}

export function generateWorkflowTree({ role, permissions = [], summaryStats = {} }) {
  const meta = ROLE_DOMAIN_MAP[role] || {
    domainTitle: '协同工作台',
    workspaceKey: 'default_studio',
    groups: [],
  }

  const permsSet = new Set(permissions)
  const isSuper = permsSet.has('*')

  const filteredGroups = meta.groups.map((group) => {
    const items = group.items
      .filter((item) => isSuper || permsSet.has(item.permRequired))
      .map((item) => {
        const count = summaryStats[item.statKey] ?? 0
        return {
          stageKey: item.stageKey,
          label: item.label,
          badgeCount: count,
          badgeTone: count > 0 ? (item.stageKey.includes('reject') || item.stageKey.includes('fraud') ? 'danger' : 'warn') : 'normal',
          permRequired: item.permRequired,
          ...(item.summaryGroup ? { summaryGroup: item.summaryGroup } : {}),
        }
      })
    return {
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      items,
    }
  }).filter((group) => group.items.length > 0)

  return {
    role,
    workspaceKey: meta.workspaceKey,
    domainTitle: meta.domainTitle,
    groups: filteredGroups,
  }
}

export function validateWorkflowAccess(user, targetStageKey) {
  if (!user || !user.role) {
    throw new Error('UNAUTHORIZED: 未登录用户禁止访问工作流节点')
  }

  const tree = generateWorkflowTree({ role: user.role, permissions: user.permissions || [] })
  const hasNode = tree.groups.some((g) => g.items.some((i) => i.stageKey === targetStageKey))

  if (!hasNode) {
    throw new Error(`FORBIDDEN_WORKFLOW_NODE: 当前角色 [${user.role}] 无权访问业务节点 [${targetStageKey}]，权限已越权拦截`)
  }

  return true
}
