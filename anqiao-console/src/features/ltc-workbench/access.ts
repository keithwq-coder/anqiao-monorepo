// 工作台入口与权限可见性（LTC-WORKBENCH-SPEC §3.2）
// 静态权限决定入口是否出现；业务门禁在动作层处理。

export type PermissionList = string[] | undefined | null

export function hasPermission(perms: PermissionList, code: string): boolean {
  if (!perms) return false
  if (perms.includes('*')) return true
  return perms.includes(code)
}

export function hasAnyPermission(perms: PermissionList, codes: string[]): boolean {
  return codes.some((c) => hasPermission(perms, c))
}

export function can(
  perms: PermissionList,
  action: string,
  opts?: { requireAll?: boolean },
): boolean {
  if (!action) return false
  if (opts?.requireAll) {
    return action.split(/\s+/).every((c) => hasPermission(perms, c))
  }
  // 空格分隔 = 任一即可；逗号同义
  return action
    .split(/[,\s]+/)
    .filter(Boolean)
    .some((c) => hasPermission(perms, c))
}

/** 服务端获授工作台；融合服务端 workspaces 字段与各角色基准工作台，确保离线与热更新均不掉工作台 */
export function allowedWorkspaces(session: {
  workspaces?: string[]
  workspace?: string
  principal?: { role?: string }
  staff?: { role?: string }
}): string[] {
  const role = session.principal?.role || session.staff?.role || ''
  const fallback: Record<string, string[]> = {
    su: [
      'system_admin',
      'platform_operations',
      'home_dispatch',
      'home_elderly_dossier',
      'home_device_monitoring',
      'home_supervision_reports',
      'device_monitoring',
      'reports_center',
      'medical_supervision',
      'insurer_operations',
      'assessor_workspace',
      'nursing_home_admin',
      'care_desk',
      'patient_dossier',
      'nursing_staff',
      'partner_operations',
    ],
    platform_admin: [
      'system_admin',
      'platform_operations',
      'home_dispatch',
      'home_elderly_dossier',
      'home_device_monitoring',
      'home_supervision_reports',
      'device_monitoring',
      'reports_center',
      'medical_supervision',
      'insurer_operations',
      'assessor_workspace',
      'nursing_home_admin',
      'care_desk',
      'patient_dossier',
      'nursing_staff',
      'partner_operations',
    ],
    admin: [
      'home_dispatch',
      'home_elderly_dossier',
      'home_device_monitoring',
      'home_supervision_reports',
      'platform_operations',
      'device_monitoring',
      'reports_center',
      'medical_supervision',
      'insurer_operations',
      'assessor_workspace',
      'nursing_home_admin',
      'care_desk',
      'patient_dossier',
    ],
    user: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports', 'device_monitoring', 'reports_center', 'platform_operations'],
    elderly_care_admin: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    home_dispatcher: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    grid_team_leader: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    grid_caregiver: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    rehab_specialist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    home_nurse: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    rehab_therapist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    dementia_specialist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    case_manager: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    quality_inspector: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    ltc_biller: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    assistive_specialist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    device_user: ['device_monitoring', 'reports_center'],
    medical_supervisor: ['medical_supervision', 'reports_center'],
    medical_insurance_staff: ['medical_supervision', 'reports_center'],
    medical_director: ['medical_supervision', 'reports_center'],
    medical_auditor: ['medical_supervision', 'reports_center'],
    medical_finance: ['medical_supervision', 'reports_center'],
    medical_assessor_admin: ['medical_supervision', 'reports_center'],
    insurer_operator: ['insurer_operations', 'reports_center'],
    insurer_staff: ['insurer_operations', 'reports_center'],
    assessor: ['assessor_workspace'],
    nursing_admin: ['nursing_home_admin', 'care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff'],
    nursing_head: ['care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff'],
    nursing_station: ['care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff'],
    nursing_nurse: ['nursing_staff', 'care_desk', 'patient_dossier', 'device_monitoring', 'reports_center'],
    nursing_caregiver: ['nursing_staff', 'care_desk', 'patient_dossier', 'device_monitoring', 'reports_center'],
    partner_admin: ['partner_operations'],
    family_contact: [],
  }

  const roleList = fallback[role] || []
  const sessionList = session.workspaces || []
  let list = Array.from(new Set([...sessionList, ...roleList]))

  if (!list.length && session.workspace) {
    list = [session.workspace]
  }

  // 若 session.workspace 存在且在该列表中，将其提至首位，确保默认定位至该工作台
  if (session.workspace && list.includes(session.workspace)) {
    list = [session.workspace, ...list.filter((w) => w !== session.workspace)]
  }
  return list
}

/** 家属准入：有有效绑定才进工作台；否则准入页 */
export function familyAccessState(bindings: Array<{ binding_status?: string; authorization_status?: string }> | null | undefined): {
  canEnter: boolean
  reason: string
} {
  if (!bindings || bindings.length === 0) {
    return { canEnter: false, reason: '暂无授权对象' }
  }
  const ok = bindings.some(
    (b) =>
      (b.binding_status === 'active' || b.binding_status === 'bound' || b.binding_status === 'valid') &&
      (b.authorization_status === 'active' || b.authorization_status === 'authorized' || b.authorization_status === 'valid' || !b.authorization_status),
  )
  if (!ok) {
    return { canEnter: false, reason: '关系待核验或授权待完成' }
  }
  return { canEnter: true, reason: '' }
}

/** 有权限但前置条件未满足时的禁用原因（阶段 C 动作层复用） */
export function disabledReason(
  perms: PermissionList,
  action: string,
  preconditions: Array<{ ok: boolean; reason: string }>,
): string | null {
  if (!can(perms, action)) return null // 无权限时入口本身不出现
  const failed = preconditions.find((p) => !p.ok)
  return failed ? failed.reason : null
}
