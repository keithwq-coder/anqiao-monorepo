// 中科安樵统一授权核心模块（Node ESM）
// 实现 RBAC + ABAC + PBAC + Data Scope 四层复合授权引擎
// 依据：docs/PLATFORM-SPEC.md §6 与 docs/LTC-INSURANCE-SPEC.md

export const WORKSPACES = {
  SYSTEM_ADMIN: 'system_admin',
  PLATFORM_OPERATIONS: 'platform_operations',
  DEVICE_MONITORING: 'device_monitoring',
  MEDICAL_SUPERVISION: 'medical_supervision',
  INSURER_OPERATIONS: 'insurer_operations',
  ASSESSOR_WORKSPACE: 'assessor_workspace',
  NURSING_HOME_ADMIN: 'nursing_home_admin',
  CARE_DESK: 'care_desk',
  NURSING_STAFF: 'nursing_staff',
  PARTNER_OPERATIONS: 'partner_operations',
  FAMILY_WORKSPACE: 'family_workspace',
}

export const ROLE_WORKSPACE_MAP = {
  su: WORKSPACES.SYSTEM_ADMIN,
  platform_admin: WORKSPACES.PLATFORM_OPERATIONS,
  admin: WORKSPACES.PLATFORM_OPERATIONS, // 兼容别名
  platform_operator: WORKSPACES.PLATFORM_OPERATIONS,
  device_user: WORKSPACES.DEVICE_MONITORING,
  user: WORKSPACES.DEVICE_MONITORING, // 兼容别名
  medical_supervisor: WORKSPACES.MEDICAL_SUPERVISION,
  medical_insurance_staff: WORKSPACES.MEDICAL_SUPERVISION, // 兼容别名
  medical_director: WORKSPACES.MEDICAL_SUPERVISION, // 医保局分管领导
  medical_auditor: WORKSPACES.MEDICAL_SUPERVISION, // 基金监管稽核专员
  medical_finance: WORKSPACES.MEDICAL_SUPERVISION, // 待遇结算财务专员
  medical_assessor_admin: WORKSPACES.MEDICAL_SUPERVISION, // 资格核准评估专员
  insurer_operator: WORKSPACES.INSURER_OPERATIONS,
  insurer_staff: WORKSPACES.INSURER_OPERATIONS, // 兼容别名
  insurer_director: WORKSPACES.INSURER_OPERATIONS, // 经办项目总监
  insurer_intake: WORKSPACES.INSURER_OPERATIONS, // 受理与派单调度
  insurer_inspector: WORKSPACES.INSURER_OPERATIONS, // 巡查与飞检
  insurer_auditor: WORKSPACES.INSURER_OPERATIONS, // 结算初审核销
  insurer_service: WORKSPACES.INSURER_OPERATIONS, // 综合客服与申诉
  assessor: WORKSPACES.ASSESSOR_WORKSPACE,
  assessor_expert: WORKSPACES.ASSESSOR_WORKSPACE, // 临床评审医学专家
  assessor_admin: WORKSPACES.ASSESSOR_WORKSPACE, // 评估机构质控主管
  nursing_admin: WORKSPACES.NURSING_HOME_ADMIN,
  nursing_head: WORKSPACES.CARE_DESK,
  nursing_station: WORKSPACES.CARE_DESK,
  nursing_nurse: WORKSPACES.NURSING_STAFF,
  nursing_caregiver: WORKSPACES.NURSING_STAFF,
  partner_admin: WORKSPACES.PARTNER_OPERATIONS,
  family_contact: WORKSPACES.FAMILY_WORKSPACE,
  elderly_care_admin: 'home_dispatch',
  home_dispatcher: 'home_dispatch',
  grid_caregiver: 'home_dispatch',
  grid_team_leader: 'home_dispatch',
  rehab_specialist: 'home_dispatch',
  home_nurse: 'home_dispatch',
  rehab_therapist: 'home_dispatch',
  dementia_specialist: 'home_dispatch',
  case_manager: 'home_dispatch',
  quality_inspector: 'home_dispatch',
  ltc_biller: 'home_dispatch',
  assistive_specialist: 'home_dispatch',
}

export const ROLE_DATA_SCOPE_MAP = {
  su: 'global',
  platform_admin: 'org',
  admin: 'org',
  platform_operator: 'org',
  device_user: 'org',
  user: 'org',
  medical_supervisor: 'pool',
  medical_insurance_staff: 'pool',
  medical_director: 'pool',
  medical_auditor: 'pool',
  medical_finance: 'pool',
  medical_assessor_admin: 'pool',
  insurer_operator: 'pool',
  insurer_staff: 'pool',
  insurer_director: 'pool',
  insurer_intake: 'pool',
  insurer_inspector: 'pool',
  insurer_auditor: 'pool',
  insurer_service: 'pool',
  assessor: 'task',
  assessor_expert: 'pool',
  assessor_admin: 'pool',
  nursing_admin: 'org',
  nursing_head: 'assigned',
  nursing_station: 'assigned',
  nursing_nurse: 'assigned',
  nursing_caregiver: 'assigned',
  partner_admin: 'channel',
  family_contact: 'applicant',
  elderly_care_admin: 'org',
  home_dispatcher: 'org',
  grid_caregiver: 'assigned',
  grid_team_leader: 'assigned',
  rehab_specialist: 'assigned',
  home_nurse: 'assigned',
  rehab_therapist: 'assigned',
  dementia_specialist: 'assigned',
  case_manager: 'org',
  quality_inspector: 'org',
  ltc_biller: 'org',
  assistive_specialist: 'assigned',
}

export const ROLE_PERMISSIONS = {
  su: ['*'],
  platform_admin: [
    'application:create', 'application:submit', 'application:read',
    'task:dispatch', 'task:read',
    'evidence:read', 'monitoring:read', 'result:read',
    'device:read', 'device:write', 'device:lifecycle',
    'report:generate', 'report:read', 'supervision:read', 'supervision:create', 'supervision:operate', 'assessed_person:read',
    'overview:read', 'geo:read',
  ],
  admin: [
    // 兼容原 admin 权限
    'application:create', 'application:submit', 'application:read',
    'task:dispatch', 'task:read',
    'evidence:read', 'monitoring:read', 'result:read',
    'device:read', 'device:write', 'device:lifecycle',
    'report:generate', 'report:read', 'supervision:read', 'supervision:create', 'supervision:operate', 'assessed_person:read',
    'overview:read', 'geo:read',
  ],
  platform_operator: [
    'device:read', 'device:write', 'device:lifecycle',
    'overview:read', 'geo:read', 'report:read',
  ],
  device_user: [
    'device:read', 'device:write', 'device:lifecycle',
    'overview:read', 'geo:read', 'quality:read', 'quality:operate',
    'report:generate', 'report:read',
  ],
  user: [
    // 兼容原 user 权限
    'application:create', 'application:submit', 'application:read',
    'task:read', 'evidence:read', 'monitoring:read',
    'report:generate', 'report:read',
    'overview:read', 'geo:read',
  ],
  medical_supervisor: [
    'application:read', 'task:read', 'result:read',
    'evidence:read', 'monitoring:read', 'service_evidence:read',
    'report:generate', 'report:read',
    'supervision:create', 'supervision:read', 'supervision:operate',
    'assessed_person:read', 'service_plan:read', 'settlement:read', 'settlement:review',
  ],
  medical_insurance_staff: [
    // 兼容别名
    'application:read', 'task:read', 'result:read',
    'evidence:read', 'monitoring:read', 'service_evidence:read',
    'report:generate', 'report:read',
    'supervision:create', 'supervision:read', 'supervision:operate',
    'assessed_person:read', 'service_plan:read', 'settlement:read', 'settlement:review',
  ],
  medical_director: [
    // 局领导/分管领导：全域治理、重大案件裁决、协议熔断签批
    'application:read', 'task:read', 'result:read',
    'evidence:read', 'monitoring:read', 'service_evidence:read',
    'report:generate', 'report:read',
    'supervision:create', 'supervision:read', 'supervision:operate',
    'assessed_person:read', 'service_plan:read', 'settlement:read', 'settlement:review',
  ],
  medical_auditor: [
    // 基金监督稽核专员：大数据巡查、疑点研判、下发督办函、现场调查、违规拟处
    'application:read', 'task:read', 'result:read',
    'evidence:read', 'monitoring:read', 'service_evidence:read',
    'report:generate', 'report:read',
    'supervision:create', 'supervision:read', 'supervision:operate',
    'assessed_person:read', 'service_plan:read', 'settlement:read',
  ],
  medical_finance: [
    // 待遇结算与财务专员：月度待遇终审复核、违规资金核减、拨付凭证签批
    'application:read', 'evidence:read', 'service_evidence:read',
    'report:generate', 'report:read',
    'supervision:read', 'assessed_person:read', 'settlement:read', 'settlement:review',
  ],
  medical_assessor_admin: [
    // 资格核准与评估管理专员：失能申请门槛前置审查、出院病历复核、评估师回避审查
    'application:read', 'task:read', 'result:read',
    'evidence:read', 'monitoring:read',
    'report:generate', 'report:read',
    'supervision:read', 'assessed_person:read',
  ],
  insurer_operator: [
    'application:create', 'application:submit', 'application:read',
    'task:dispatch', 'task:read', 'result:read',
    'result:approve', 'result:return', 'result:request_more',
    'service_plan:create', 'service_plan:read',
    'service_evidence:read', 'service_evidence:review',
    'settlement:read', 'settlement:review',
    'report:generate', 'report:read', 'supervision:read',
    'assessed_person:read',
  ],
  insurer_staff: [
    // 兼容别名
    'application:create', 'application:submit', 'application:read',
    'task:dispatch', 'task:read', 'result:read',
    'result:approve', 'result:return', 'result:request_more',
    'service_plan:create', 'service_plan:read',
    'service_evidence:read', 'service_evidence:review',
    'settlement:read', 'settlement:review',
    'report:generate', 'report:read', 'supervision:read',
    'assessed_person:read',
  ],
  insurer_director: [
    // 经办项目总监：全盘统揽、各业务终审前签批、转送医保
    'application:create', 'application:submit', 'application:read',
    'task:dispatch', 'task:read', 'result:read',
    'result:approve', 'result:return', 'result:request_more',
    'service_plan:create', 'service_plan:read',
    'service_evidence:read', 'service_evidence:review',
    'settlement:read', 'settlement:review',
    'inspection:create', 'inspection:read', 'inspection:operate',
    'report:generate', 'report:read', 'supervision:read',
    'assessed_person:read', 'appeal:read', 'appeal:handle',
  ],
  insurer_intake: [
    // 业务受理与派单调度专员：申请初审受理、法定回避派单、结果复核
    'application:create', 'application:submit', 'application:read',
    'task:dispatch', 'task:read', 'result:read',
    'result:approve', 'result:return', 'result:request_more',
    'assessed_person:read', 'report:read', 'monitoring:read', 'evidence:read',
  ],
  insurer_inspector: [
    // 现场巡查与质量飞检专员：基于物联异常发起靶向飞检、现场笔录、工单标记
    'service_evidence:read', 'service_evidence:review',
    'inspection:create', 'inspection:read', 'inspection:operate',
    'monitoring:read', 'evidence:read', 'task:read',
    'application:read', 'assessed_person:read', 'report:read', 'supervision:read',
  ],
  insurer_auditor: [
    // 费用核销与结算初审员：结算四步分离之经办初审、物联比对核减
    'settlement:read', 'settlement:review',
    'service_evidence:read', 'service_evidence:review',
    'application:read', 'task:read', 'assessed_person:read',
    'report:generate', 'report:read',
  ],
  insurer_service: [
    // 综合客服与申诉专员：长者咨询、家属申诉受理、满意度回访
    'application:read', 'task:read', 'result:read',
    'appeal:read', 'appeal:handle',
    'assessed_person:read', 'report:read',
  ],
  assessor: [
    'task:operate', 'task:read', 'result:submit',
    'evidence:write', 'evidence:read', 'monitoring:read',
    'insight:handle', 'snapshot:read', 'report:read',
    'assessed_person:read',
  ],
  assessor_expert: [
    // 评定专家委员会医学评审专家：疑难案件集中盲审、双专家复核签认、签署评定结论书、出具评审报告
    'task:operate', 'task:read', 'result:submit', 'result:read', 'result:approve',
    'expert_review:sign', 'evidence:read', 'monitoring:read',
    'insight:handle', 'snapshot:read', 'report:generate', 'report:read',
    'assessed_person:read',
  ],
  assessor_admin: [
    // 评估机构质控主管：机构任务全盘统揽、排班派工质控、偏离度分析、机构公信力大盘
    'task:read', 'task:operate', 'result:read',
    'evidence:read', 'monitoring:read', 'snapshot:read',
    'assessor:manage', 'quality:read', 'quality:audit',
    'report:generate', 'report:read', 'assessed_person:read',
  ],
  nursing_admin: [
    'patient:read', 'patient:write', 'bed:read', 'bed:write',
    'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'shift:read', 'report:read', 'report:generate',
    'device:read', 'device:write', 'monitoring:read',
    'service_record:read', 'service_record:write',
  ],
  nursing_head: [
    'patient:read', 'patient:write', 'bed:read', 'bed:write',
    'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'shift:read', 'shift:write', 'vitals:read',
    'service_record:read', 'service_record:write', 'report:read', 'report:generate',
    'device:read', 'monitoring:read',
  ],
  nursing_station: [
    'patient:read', 'patient:write', 'bed:read', 'bed:write',
    'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'shift:read', 'vitals:read',
    'service_record:read', 'service_record:write',
    'report:read', 'report:generate', 'device:read', 'monitoring:read',
  ],
  nursing_nurse: [
    'patient:read', 'bed:read',
    'alert:read', 'alert:claim', 'alert:handle',
    'shift:read', 'vitals:read',
    'service_record:read', 'service_record:write',
    'report:read', 'device:read', 'monitoring:read',
  ],
  nursing_caregiver: [
    'patient:read', 'bed:read',
    'alert:read', 'alert:claim', 'alert:handle',
    'shift:read', 'vitals:read',
    'service_record:read', 'service_record:write',
    'report:read', 'device:read', 'monitoring:read',
  ],
  partner_admin: [
    'channel:read', 'customer:read', 'device:track',
    'lead:read', 'lead:write', 'report:read',
  ],
  family_contact: [
    'application:create', 'application:submit', 'application:read',
    'evidence:read', 'report:generate', 'report:read', 'appeal:file',
    'family_binding:request', 'family_binding:read_self', 'family_binding:read_request',
    'material:write',
  ],
  elderly_care_admin: [
    'patient:read', 'patient:write', 'bed:read', 'bed:write',
    'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'shift:read', 'report:read', 'report:generate',
    'device:read', 'device:write', 'monitoring:read',
    'service_record:read', 'service_record:write',
    'task:dispatch', 'task:read', 'work_order:read', 'work_order:operate',
  ],
  home_dispatcher: [
    'patient:read', 'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'report:read', 'monitoring:read',
    'task:dispatch', 'task:read', 'work_order:read', 'work_order:operate',
  ],
  grid_team_leader: [
    'patient:read', 'alert:read', 'alert:claim', 'alert:handle',
    'vitals:read', 'service_record:read', 'service_record:write',
    'report:read', 'monitoring:read', 'task:dispatch', 'task:read',
    'work_order:read', 'work_order:operate',
  ],
  grid_caregiver: [
    'patient:read', 'alert:read', 'alert:claim', 'alert:handle',
    'vitals:read', 'service_record:read', 'service_record:write',
    'report:read', 'monitoring:read', 'work_order:read', 'work_order:operate',
  ],
  rehab_specialist: [
    'patient:read', 'vitals:read', 'service_record:read', 'service_record:write',
    'report:read', 'monitoring:read', 'work_order:read',
  ],
  home_nurse: [
    'patient:read', 'alert:read', 'alert:claim', 'alert:handle',
    'vitals:read', 'service_record:read', 'service_record:write',
    'medical_order:read', 'medical_order:write',
    'report:read', 'monitoring:read', 'work_order:read', 'work_order:operate',
  ],
  rehab_therapist: [
    'patient:read', 'vitals:read', 'service_record:read', 'service_record:write',
    'rehab_assessment:read', 'rehab_assessment:write',
    'report:read', 'monitoring:read', 'work_order:read', 'work_order:operate',
  ],
  dementia_specialist: [
    'patient:read', 'vitals:read', 'service_record:read', 'service_record:write',
    'dementia_care:read', 'dementia_care:write',
    'report:read', 'monitoring:read', 'work_order:read', 'work_order:operate',
  ],
  case_manager: [
    'patient:read', 'patient:write', 'care_plan:read', 'care_plan:write',
    'alert:read', 'vitals:read', 'service_record:read',
    'report:read', 'monitoring:read', 'work_order:read', 'work_order:operate',
  ],
  quality_inspector: [
    'patient:read', 'service_record:read', 'monitoring:read', 'work_order:read',
    'quality_audit:read', 'quality_audit:write', 'supervision:read', 'report:read',
  ],
  ltc_biller: [
    'patient:read', 'work_order:read', 'settlement:read', 'settlement:review',
    'service_evidence:read', 'report:read', 'report:generate',
  ],
  assistive_specialist: [
    'patient:read', 'device:read', 'device:write',
    'assistive_device:read', 'assistive_device:write',
    'work_order:read', 'work_order:operate', 'monitoring:read',
  ],
}

export function permissionsOf(role) {
  return ROLE_PERMISSIONS[role] ?? []
}

export function dataScopeOf(role) {
  return ROLE_DATA_SCOPE_MAP[role] ?? 'org'
}

export function workspaceOf(role) {
  return ROLE_WORKSPACE_MAP[role] ?? WORKSPACES.NURSING_HOME_ADMIN
}

/**
 * 统一授权判定引擎: RBAC + PBAC + ABAC + Data Scope
 * @param {object} principal 当前请求主体
 * @param {string} action 操作标识 (如 'patient:read', 'task:dispatch')
 * @param {object|null} resource 目标资源对象
 * @param {object} context 附加上下文
 * @returns {{ allow: boolean, status: number, message: string }}
 */
export function authorize(principal, action, resource = null, context = {}) {
  if (!principal) {
    return { allow: false, status: 401, message: '未登录或登录已过期' }
  }

  // 1. RBAC: 角色能力判定
  const perms = permissionsOf(principal.role)
  const hasPerm = perms.includes('*') || perms.includes(action)
  if (!hasPerm) {
    return { allow: false, status: 403, message: `角色 [${principal.role}] 无权执行操作 [${action}]` }
  }

  // 2. PBAC: 业务策略硬性约束 (回避规则 / 结论红线 / 流程门禁)
  // 策略 A: 评估回避校验 (assessor 所在机构与被评机构一致则阻断 409)
  if (action === 'task:dispatch' && context.assessor && context.application) {
    if (context.assessor.org_id && context.application.tenant_id && context.assessor.org_id === context.application.tenant_id) {
      return { allow: false, status: 409, message: '评估人员与被评估对象所属机构存在利益冲突，禁止派单' }
    }
  }

  // 策略 B: 评估任务锁定 (任务一旦完成或已提交，禁止再写证据)
  if (action === 'evidence:write' && resource && resource.status && resource.status !== 'assessing') {
    return { allow: false, status: 400, message: `任务状态 [${resource.status}] 已锁定，禁止继续录入证据` }
  }

  // 策略 C: 监测证据红线 (监测数据禁止包含待遇或最终等级判定)
  if (action === 'evidence:write' && context.input && context.input.type === 'evidence_monitoring') {
    if (context.input.conclusion !== null && context.input.conclusion !== undefined) {
      return { allow: false, status: 400, message: '监测证据红线：设备数据结论字段必须为 null，禁止直接写入等级结论' }
    }
  }

  // 策略 D: 结算四步分离初审/复核身份核验
  if (action === 'settlement:review' && resource && context.step) {
    if (context.step === 're_review' && resource.pre_reviewed_by === principal.account_id) {
      return { allow: false, status: 403, message: '结算审核四步分离门禁：初审人员与复核人员不得为同一人' }
    }
  }

  // 3. ABAC + Data Scope: 资源属性与可见范围匹配
  if (resource) {
    const scope = principal.data_scope || dataScopeOf(principal.role)

    // 超管全局放行
    if (scope === 'global' || principal.role === 'su') {
      return { allow: true, status: 200, message: 'ok' }
    }

    // 统筹区池 (医保监管、商保经办)
    if (scope === 'pool') {
      // 统筹区内数据允许，跨统筹区 404
      if (resource.pool_id && principal.pool_id && resource.pool_id !== principal.pool_id) {
        return { allow: false, status: 404, message: '资源不存在（跨统筹区）' }
      }
      return { allow: true, status: 200, message: 'ok' }
    }

    // 护士分配视角 (assigned)
    if (scope === 'assigned') {
      const allowedFloors = principal.assigned_floors || []
      const assignedNurse = principal.assigned_nurse || principal.name

      // 长者/床位过滤
      if (resource.bed_id) {
        const floorMatch = allowedFloors.some((f) => resource.bed_id.startsWith(f.replace('F', '')))
        const nurseMatch = resource.nurse && resource.nurse.includes(assignedNurse)
        if (!floorMatch && !nurseMatch) {
          return { allow: false, status: 404, message: '长者不在管辖负责范围内' }
        }
      }
      // 告警过滤
      if (resource.bed_id && resource.type && !resource.gender) {
        // 如果是告警对象
        const floorMatch = allowedFloors.some((f) => resource.bed_id.startsWith(f.replace('F', '')))
        if (!floorMatch) {
          return { allow: false, status: 404, message: '告警不在管辖负责范围内' }
        }
      }
      return { allow: true, status: 200, message: 'ok' }
    }

    // 仅本人任务 (assessor)
    if (scope === 'task') {
      if (resource.assessor && resource.assessor.account_id !== principal.account_id) {
        return { allow: false, status: 404, message: '任务不存在或非本人评估任务' }
      }
      return { allow: true, status: 200, message: 'ok' }
    }

    // 本机构组织范围 (org)
    if (scope === 'org') {
      const resTenant = resource.tenant_id || resource.org_id || resource.customer_org_id
      if (resTenant && resTenant !== principal.tenant_id && resTenant !== principal.org_id) {
        return { allow: false, status: 404, message: '资源不存在（非本组织数据）' }
      }
      return { allow: true, status: 200, message: 'ok' }
    }

    // 家属仅绑定长者 (applicant)
    if (scope === 'applicant') {
      const allowed = principal.applicant_ids || []
      const targetId = resource.applicant_id || resource.person_id || resource.patient_id
      if (targetId && !allowed.includes(targetId)) {
        return { allow: false, status: 404, message: '资源不存在（非绑定被照护对象）' }
      }
      return { allow: true, status: 200, message: 'ok' }
    }

    // 合作伙伴渠道范围 (channel)：仅本渠道组织客户/线索/设备，不见客户数据正文
    // 对齐 PLATFORM-SPEC §2.2 / API-CONTRACT §3.2 红线
    if (scope === 'channel') {
      const partnerOrg = principal.org_id || principal.partner_org_id || principal.tenant_id
      // 渠道账号禁止读取长者/体征/告警正文类资源
      const bodyLike =
        resource.vitals !== undefined ||
        (resource.patient_id && resource.bed_id && (resource.care_level !== undefined || resource.ward !== undefined)) ||
        (resource.type && resource.occurred_at && resource.level !== undefined)
      if (bodyLike) {
        return { allow: false, status: 404, message: '资源不存在（渠道账号不见客户数据正文）' }
      }
      const resPartner =
        resource.partner_org_id || resource.referrer_partner_id || resource.operator_partner_id
      if (resPartner && partnerOrg && resPartner !== partnerOrg) {
        return { allow: false, status: 404, message: '资源不存在（非本渠道组织）' }
      }
      // 客户组织若由其他渠道引荐 → 404（同组织 tenant 校验失败亦 404）
      const resTenant = resource.tenant_id || resource.org_id || resource.customer_org_id
      if (resTenant && resPartner && resPartner !== partnerOrg) {
        return { allow: false, status: 404, message: '资源不存在（非本渠道组织）' }
      }
      return { allow: true, status: 200, message: 'ok' }
    }
  }

  return { allow: true, status: 200, message: 'ok' }
}
