// 长护险工作台 N01/N02 客户端（LTC-WORKBENCH-SPEC §8.5）
import { http } from './http'

export interface WorkbenchGroup {
  key: string
  label: string
  total: number
  due_soon: number
  overdue: number
}

export interface WorkbenchReceipt {
  receipt_id: string
  object_id: string
  state: string
  version: string | number
  occurred_at: string
  next_owner_role: string | null
}

export interface WorkbenchSummary {
  workspace: string
  scope_label: string
  as_of: string
  total: number
  groups: WorkbenchGroup[]
  recent_receipts: WorkbenchReceipt[]
}

export interface WorkbenchTodo {
  id: string
  object_type: string
  object_id: string
  application_id: string | null
  title: string
  state: string
  assigned_to: string | null
  next_owner_role: string
  due_at: string | null
  updated_at: string
  action_key: string
  route_key: string
  group: string
}

export interface WorkbenchTodoPage {
  list: WorkbenchTodo[]
  total: number
  page: number
  page_size: number
}

export interface WorkbenchQuery {
  workspace?: string
  project_id?: string
  subject_id?: string
  group?: string
  sla_status?: string
  page?: number
  page_size?: number
  sort?: string
}

export function getWorkbenchSummary(query: WorkbenchQuery = {}): Promise<WorkbenchSummary> {
  const qs = new URLSearchParams()
  if (query.workspace) qs.set('workspace', query.workspace)
  if (query.project_id) qs.set('project_id', query.project_id)
  if (query.subject_id) qs.set('subject_id', query.subject_id)
  const q = qs.toString()
  return http.get<WorkbenchSummary>(`/v1/ltc/workbench/summary${q ? '?' + q : ''}`)
}

export function getWorkbenchTodos(query: WorkbenchQuery = {}): Promise<WorkbenchTodoPage> {
  const qs = new URLSearchParams()
  if (query.workspace) qs.set('workspace', query.workspace)
  if (query.group) qs.set('group', query.group)
  if (query.sla_status) qs.set('sla_status', query.sla_status)
  if (query.page) qs.set('page', String(query.page))
  if (query.page_size) qs.set('page_size', String(query.page_size))
  if (query.sort) qs.set('sort', query.sort)
  if (query.subject_id) qs.set('subject_id', query.subject_id)
  const q = qs.toString()
  return http.get<WorkbenchTodoPage>(`/v1/ltc/workbench/todos${q ? '?' + q : ''}`)
}
