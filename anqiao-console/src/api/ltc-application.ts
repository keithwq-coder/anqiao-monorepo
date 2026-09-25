// 阶段 C：申请动作 / 材料 / 时间线 / SLA 客户端
import { http } from './http'
import type { LtcApplication } from './types'

export interface ActionReceipt {
  receipt_id: string
  object_id: string
  state: string
  version: string | number
  occurred_at: string
  next_owner_role: string | null
}

export interface ApplicationActionResult {
  application: LtcApplication
  receipt: ActionReceipt | null
  next_owner_role: string | null
}

export type ApplicationActionName =
  | 'accept'
  | 'return_materials'
  | 'materials_pass'
  | 'finalize'
  | 'read'

export function applicationAction(
  applicationId: string,
  action: ApplicationActionName,
  extra: { reason?: string; note?: string } = {},
): Promise<ApplicationActionResult> {
  return http.post<ApplicationActionResult>(
    `/v1/ltc/applications/${encodeURIComponent(applicationId)}/actions`,
    { action, ...extra },
  )
}

export interface MaterialItem {
  material_id: string
  template_item: string
  version: number
  status: string
  file_ref: string
  updated_at: string
  return_reason: string | null
}

export interface MaterialList {
  application_id: string
  status: string
  list: MaterialItem[]
  total: number
}

export function getApplicationMaterials(applicationId: string): Promise<MaterialList> {
  return http.get<MaterialList>(`/v1/ltc/applications/${encodeURIComponent(applicationId)}/materials`)
}

export interface TimelineEvent {
  event_id: string
  label: string
  occurred_at: string
  responsible_role: string
  public_description: string
  receipt_id: string | null
}

export interface ApplicationTimeline {
  application_id: string
  public_state: string
  updated_at: string
  next_action: { key: string; label: string; due_at: string | null } | null
  published_result: {
    result_id: string
    version: string | number
    publisher: string
    published_at: string
    summary: string
  } | null
  list: TimelineEvent[]
  total: number
}

export function getApplicationTimeline(applicationId: string): Promise<ApplicationTimeline> {
  return http.get<ApplicationTimeline>(`/v1/ltc/applications/${encodeURIComponent(applicationId)}/timeline`)
}

export interface ApplicationSla {
  application_id: string
  state: string
  due_at: string | null
  sla_status: string
  rule: string
  note: string | null
}

export function getApplicationSla(applicationId: string): Promise<ApplicationSla> {
  return http.get<ApplicationSla>(`/v1/ltc/applications/${encodeURIComponent(applicationId)}/sla`)
}
