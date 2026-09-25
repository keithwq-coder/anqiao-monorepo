// 领域状态 → 页面中文文案与胶囊色调（LTC-WORKBENCH-SPEC §3.4 / §4）
// 后端原始状态保存在数据模型；本表只服务展示。

export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

export interface StateLabel {
  label: string
  tone: PillTone
}

const APP: Record<string, StateLabel> = {
  draft: { label: '待提交', tone: 'muted' },
  submitted: { label: '已提交', tone: 'info' },
  materials_review: { label: '材料审核中', tone: 'info' },
  materials_rejected: { label: '待补正', tone: 'warning' },
  materials_pass: { label: '待派单', tone: 'info' },
  assess_pending: { label: '评估中', tone: 'info' },
  suspended: { label: '监管暂缓', tone: 'danger' },
  approved: { label: '已核定', tone: 'success' },
}

const TASK: Record<string, StateLabel> = {
  assigned: { label: '待接任务', tone: 'warning' },
  assessing: { label: '评估中', tone: 'info' },
  completed: { label: '已提交审核', tone: 'success' },
  returned: { label: '退回修改', tone: 'danger' },
}

const RESULT: Record<string, StateLabel> = {
  pending_review: { label: '待审核', tone: 'warning' },
  public_notice: { label: '公示中', tone: 'info' },
  approved: { label: '结果已发布', tone: 'success' },
  returned: { label: '退回修改', tone: 'danger' },
  suspended: { label: '监管暂缓', tone: 'danger' },
}

const SETTLEMENT: Record<string, StateLabel> = {
  declared: { label: '待结算初审', tone: 'warning' },
  pre_reviewed: { label: '待复核', tone: 'info' },
  re_reviewed: { label: '待拨付', tone: 'info' },
  disbursed: { label: '已拨付', tone: 'success' },
}

const WORK_ORDER: Record<string, StateLabel> = {
  investigating: { label: '抽审中', tone: 'warning' },
  ratified: { label: '已核准', tone: 'success' },
  suspended: { label: '监管暂缓', tone: 'danger' },
}

const INSIGHT: Record<string, StateLabel> = {
  pending: { label: '待处置', tone: 'warning' },
  confirmed: { label: '已确认', tone: 'success' },
  adopted: { label: '已采纳', tone: 'success' },
  rejected: { label: '已驳回', tone: 'muted' },
  needs_manual_review: { label: '待人工核查', tone: 'warning' },
}

const BINDING: Record<string, StateLabel> = {
  active: { label: '有效', tone: 'success' },
  bound: { label: '已绑定', tone: 'success' },
  valid: { label: '有效', tone: 'success' },
  pending: { label: '待核验', tone: 'warning' },
  pending_review: { label: '待核验', tone: 'warning' },
  revoked: { label: '已撤销', tone: 'danger' },
  expired: { label: '已过期', tone: 'muted' },
}

const APPEAL: Record<string, StateLabel> = {
  appeal_requested: { label: '申诉待受理', tone: 'warning' },
  appeal_reviewing: { label: '申诉处理中', tone: 'info' },
  appeal_approved: { label: '申诉已答复', tone: 'success' },
  appeal_overruled: { label: '申诉已答复', tone: 'muted' },
}

const MATERIAL: Record<string, StateLabel> = {
  pending: { label: '待上传', tone: 'muted' },
  collected: { label: '已收集', tone: 'info' },
  valid: { label: '有效', tone: 'success' },
  invalid: { label: '需补正', tone: 'danger' },
}

const SLA: Record<string, StateLabel> = {
  overdue: { label: '逾期', tone: 'danger' },
  due_soon: { label: '临期', tone: 'warning' },
  open: { label: '待处理', tone: 'info' },
}

const OBJECT_MAP: Record<string, Record<string, StateLabel>> = {
  application: APP,
  task: TASK,
  result: RESULT,
  settlement: SETTLEMENT,
  work_order: WORK_ORDER,
  workOrder: WORK_ORDER,
  insight: INSIGHT,
  binding: BINDING,
  appeal: APPEAL,
  material: MATERIAL,
  sla: SLA,
  supervision_case: WORK_ORDER,
}

export function stateLabel(state: string | null | undefined, objectType?: string): StateLabel {
  if (!state) return { label: '—', tone: 'muted' }
  if (objectType && OBJECT_MAP[objectType]?.[state]) return OBJECT_MAP[objectType][state]
  for (const map of Object.values(OBJECT_MAP)) {
    if (map[state]) return map[state]
  }
  return { label: state, tone: 'neutral' }
}

export function slaLabel(sla: string | null | undefined): StateLabel {
  if (!sla) return { label: '', tone: 'muted' }
  return SLA[sla] || { label: sla, tone: 'neutral' }
}

export function priorityRank(todo: {
  due_at?: string | null
  updated_at?: string
}): number {
  // 逾期0 临期1 今日2 其他3 无期限4
  if (!todo.due_at) return 4
  const due = Date.parse(todo.due_at)
  if (Number.isNaN(due)) return 4
  const now = Date.now()
  if (due < now) return 0
  const dayEnd = new Date()
  dayEnd.setHours(23, 59, 59, 999)
  if (due <= dayEnd.getTime()) return 2
  if (due - now < 48 * 3600 * 1000) return 1
  return 3
}

export function sortTodos<T extends { due_at?: string | null; updated_at?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ra = priorityRank(a)
    const rb = priorityRank(b)
    if (ra !== rb) return ra - rb
    const da = a.due_at ? Date.parse(a.due_at) : Number.MAX_SAFE_INTEGER
    const db = b.due_at ? Date.parse(b.due_at) : Number.MAX_SAFE_INTEGER
    if (da !== db) return da - db
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })
}
