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

/** 服务端获授工作台（三层权限模型）：以后端下发 workspaces 为唯一真源。
 * 此前与 27 角色前端 fallback 表取并集，后端收窄授权不生效（既有 bug③，本次移除）；
 * 登录/切换/session 三接口均经 authorizedWorkspacesFor 下发。 */
export function allowedWorkspaces(session: {
  workspaces?: string[]
  workspace?: string
}): string[] {
  let list = [...(session.workspaces || [])]
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
