// 阶段 D：家属/标签/绑定/申诉 API 客户端
import { http } from './http'

export interface FamilyBinding {
  binding_id: string
  subject_id: string
  display_name: string
  relationship: string
  binding_status: string
  authorization_status: string
  valid_from: string | null
  valid_until: string | null
}

export function getFamilyBindings(): Promise<{ list: FamilyBinding[]; total: number }> {
  return http.get('/v1/ltc/family/bindings')
}

export interface BindingRequestResult {
  binding_request_id: string
  receipt_id: string
  object_id: string
  state: string
  version: number
  occurred_at: string
  next_owner_role: string | null
}

export function createFamilyBindingRequest(input: {
  subject_id: string
  relationship?: string
  authorization_basis?: string
}): Promise<BindingRequestResult> {
  return http.post('/v1/ltc/family/binding-requests', input)
}

export function listFamilyBindingRequests(): Promise<{ list: any[]; total: number }> {
  return http.get('/v1/ltc/family/binding-requests')
}

export interface AppealReceipt {
  appeal_id: string
  application_id?: string
  result_id?: string
  receipt_id: string
  object_id: string
  state: string
  version: number
  occurred_at: string
  next_owner_role: string | null
  review_task_id?: string | null
}

export function createAppeal(input: {
  application_id: string
  result_id: string
  reason: string
  material_ids?: string[]
}): Promise<AppealReceipt> {
  return http.post('/v1/ltc/appeals', input)
}

export function listAppeals(query: { application_id?: string; state?: string } = {}): Promise<{ list: any[]; total: number }> {
  const qs = new URLSearchParams()
  if (query.application_id) qs.set('application_id', query.application_id)
  if (query.state) qs.set('state', query.state)
  const q = qs.toString()
  return http.get(`/v1/ltc/appeals${q ? '?' + q : ''}`)
}

export function getAppeal(appealId: string): Promise<any> {
  return http.get(`/v1/ltc/appeals/${encodeURIComponent(appealId)}`)
}

export function appealAction(
  appealId: string,
  action: string,
  extra: { reason?: string; reply_content?: string; material_ids?: string[] } = {},
): Promise<AppealReceipt> {
  return http.post(`/v1/ltc/appeals/${encodeURIComponent(appealId)}/actions`, { action, ...extra })
}

export interface DeviceLabel {
  device_id: string
  project_id: string
  region_code: string | null
  owner_type: string | null
  environment_type: string | null
  program_stage: string | null
  registry_status: string
  tags: string[]
  version: number
  updated_at: string
  updated_by: string
}

export function getDeviceLabels(query: Record<string, string | number | undefined> = {}): Promise<{
  list: DeviceLabel[]
  total: number
  page: number
  page_size: number
}> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return http.get(`/v1/ltc/device-labels${q ? '?' + q : ''}`)
}

export function patchDeviceLabel(
  deviceId: string,
  patch: Partial<DeviceLabel> & { reason: string; expected_version?: number },
): Promise<{ device: DeviceLabel; receipt: any }> {
  return http.patch(
    '/v1/ltc/devices/' + encodeURIComponent(deviceId) + '/labels',
    patch,
  )
}

export function getDeviceLabelStats(query: { group_by?: string } = {}): Promise<any> {
  const qs = new URLSearchParams()
  if (query.group_by) qs.set('group_by', query.group_by)
  const q = qs.toString()
  return http.get(`/v1/ltc/device-labels/stats${q ? '?' + q : ''}`)
}

export function getDeviceBindings(query: { subject_id?: string; device_id?: string; state?: string } = {}): Promise<{
  list: any[]
  total: number
}> {
  const qs = new URLSearchParams()
  if (query.subject_id) qs.set('subject_id', query.subject_id)
  if (query.device_id) qs.set('device_id', query.device_id)
  if (query.state) qs.set('state', query.state)
  const q = qs.toString()
  return http.get(`/v1/ltc/device-bindings${q ? '?' + q : ''}`)
}

export function createDeviceBinding(input: {
  subject_id: string
  device_id: string
  project_id?: string
  valid_from?: string
  valid_until?: string | null
  authorization_ref?: string
  reason: string
}): Promise<{ binding: any; receipt: any }> {
  return http.post('/v1/ltc/device-bindings', input)
}

export function deviceBindingAction(
  bindingId: string,
  action: string,
  extra: { reason?: string; valid_from?: string; valid_until?: string } = {},
): Promise<{ binding: any; receipt: any }> {
  return http.post(`/v1/ltc/device-bindings/${encodeURIComponent(bindingId)}/actions`, { action, ...extra })
}
