import type {
  Alert,
  AlertsParams,
  Bed,
  BedsParams,
  CityStat,
  Demographics,
  DeviceDistribution,
  DevicePoint,
  FloorInfo,
  FacilityStats,
  LoginResponse,
  Overview,
  Paged,
  Patient,
  PatientDetail,
  PatientProfile,
  PatientsParams,
  Rankings,
  ShiftInfo,
  WardInfo,
  DeviceAsset,
  DeviceLifecycleLog,
  PartnerChannelData,
  PartnerLead,
  AssessedPerson,
  LtcApplication,
  AssessmentTask,
  AssessmentSnapshot,
  AssistantInsight,
  ServicePlan,
  ServiceVisit,
  ServiceEvidence,
  Settlement,
  QualityEvent,
  SupervisionCase,
  WorkOrder,
  MedicalRecord,
  AssessorProfile,
  AssessmentOrg,
  DeviceLiveTelemetry,
  SupervisionDashboardData,
  SupervisionClue,
  SettlementVoucher,
  PenetrationData,
} from './types'
import * as mock from './mock'
import { http, getToken, getSession, setSession } from './http'

// SaaS 切片：登录走真实后端，成功后会话写入 localStorage
export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await http.post<LoginResponse>('/v1/auth/login', { username, password })
  setSession(data.token, {
    staff: data.staff,
    tenant: data.tenant,
    workspace: data.workspace,
    principal: data.principal,
    permissions: data.permissions,
    data_scope: data.data_scope,
    workspaces: (data as LoginResponse & { workspaces?: string[] }).workspaces,
  })
  return data
}

// 真实 API 仅限控制台路由(#/console):token 存于 localStorage,按源共享,
// 大屏(/dash/ 或本地开发)与控制台同部署源时会被误判"已登录"而请求不存在的 /v1,
// 因此大屏一律走 mock;控制台内真实接口失败时读接口回退 mock 兜底,写接口不兜底。
// 例外:vendor(厂商)租户与护理院数据域完全隔离——接口失败一律不回退演示·康宁 mock,
// 列表/概览返回空结构(UI 走空态),单对象详情直接抛错(UI 走错误态),避免虚构长者数据串租户泄漏。
const isConsole = () => true
const useLocalMock = () =>
  !!import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_MOCK === '1'
const useRealApi = () => !useLocalMock() || !!getToken()
const isVendorTenant = () => getSession()?.tenant.kind === 'vendor'

function emptyOverview(): Overview {
  return {
    device_total: 0,
    device_online: 0,
    device_online_rate: 0,
    patient_total: 0,
    patient_male: 0,
    patient_female: 0,
    bed_occupied: 0,
    bed_total: 0,
    alerts_today: 0,
    alerts_closed_today: 0,
    in_bed_count: 0,
    in_bed_rate: 0,
    city_count: 0,
    generated_at: '',
  }
}

function emptyPaged<T>(params?: { page?: number; page_size?: number }): Paged<T> {
  return { list: [], total: 0, page: params?.page ?? 1, page_size: params?.page_size ?? 20 }
}

function emptyShift(): ShiftInfo {
  return { shift_name: '—', shift_range: '—', nurses: [], carry_over_open: 0, generated_at: '' }
}

export function getOverview(): Promise<Overview> {
  if (!useRealApi()) return mock.getOverview()
  const vendor = isVendorTenant()
  return http.get<Overview>('/v1/overview').catch(() => (vendor ? emptyOverview() : mock.getOverview()))
}

export function getFloors(): Promise<FloorInfo[]> {
  if (!useRealApi()) return mock.getFloors()
  return http.get<FloorInfo[]>('/v1/floors').catch(() => (isVendorTenant() ? [] : mock.getFloors()))
}

export function getWards(floor?: string): Promise<WardInfo[]> {
  if (!useRealApi()) return mock.getWards(floor)
  const qs = floor ? `?floor=${encodeURIComponent(floor)}` : ''
  return http.get<WardInfo[]>(`/v1/wards${qs}`).catch(() => (isVendorTenant() ? [] : mock.getWards(floor)))
}

export function getBeds(params?: BedsParams): Promise<Bed[]> {
  if (!useRealApi()) return mock.getBeds(params)
  const qs = new URLSearchParams()
  if (params?.floor) qs.set('floor', params.floor)
  if (params?.ward) qs.set('ward', params.ward)
  const query = qs.toString()
  return http
    .get<Bed[]>(`/v1/beds${query ? '?' + query : ''}`)
    .catch(() => (isVendorTenant() ? [] : mock.getBeds(params)))
}

export function getPatients(params?: PatientsParams): Promise<Paged<Patient>> {
  if (!useRealApi()) return mock.getPatients(params)
  const qs = new URLSearchParams()
  if (params?.floor) qs.set('floor', params.floor)
  if (params?.ward) qs.set('ward', params.ward)
  if (params?.status) qs.set('status', params.status)
  if (params?.q) qs.set('q', params.q)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  const vendor = isVendorTenant()
  return http
    .get<Paged<Patient>>(`/v1/patients${query ? '?' + query : ''}`)
    .catch(() => (vendor ? emptyPaged<Patient>(params) : mock.getPatients(params)))
}

export function getPatient(patientId: string, date?: string): Promise<Patient> {
  if (!useRealApi()) return mock.getPatient(patientId, date)
  const req = http.get<Patient>(`/v1/patients/${encodeURIComponent(patientId)}`)
  // vendor 租户无长者数据域：失败直接抛错，绝不回退演示·康宁 mock
  return isVendorTenant() ? req : req.catch(() => mock.getPatient(patientId, date))
}

// 长者画像详情（含 24h 曲线/睡眠/慢病/告警历史），仅控制台（已登录）使用
export function getPatientDetail(patientId: string): Promise<PatientDetail> {
  const req = http.get<PatientDetail>(`/v1/patients/${encodeURIComponent(patientId)}`)
  return isVendorTenant() ? req : req.catch(() => mock.getPatientDetail(patientId))
}

export function searchPatients(q: string, params?: Omit<PatientsParams, 'q'>): Promise<Paged<Patient>> {
  return mock.getPatients({ ...params, q })
}

export function getAlerts(params?: AlertsParams): Promise<Paged<Alert>> {
  if (!useRealApi()) return mock.getAlerts(params)
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.level) qs.set('level', String(params.level))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  const vendor = isVendorTenant()
  return http
    .get<Paged<Alert>>(`/v1/alerts${query ? '?' + query : ''}`)
    .catch(() => (vendor ? emptyPaged<Alert>(params) : mock.getAlerts(params)))
}

export function handleAlert(alertId: string, note: string): Promise<Alert> {
  return useRealApi()
    ? http.post<Alert>(`/v1/alerts/${encodeURIComponent(alertId)}/handle`, { note })
    : mock.handleAlert(alertId, note)
}

// 接单：triggered -> handling（仅控制台已登录场景）
export function claimAlert(alertId: string): Promise<Alert> {
  return http.post<Alert>(`/v1/alerts/${encodeURIComponent(alertId)}/claim`)
}

// 班次卡（值班工作台用）；vendor 租户无护理班次，失败返回空结构而非演示·康宁 mock
export function getShift(): Promise<ShiftInfo> {
  const vendor = isVendorTenant()
  return http.get<ShiftInfo>('/v1/shift').catch(() => (vendor ? emptyShift() : mock.getShift()))
}

// 厂商全国 geo（仅 vendor 租户）
export function getGeoCities(): Promise<CityStat[]> {
  return http.get<CityStat[]>('/v1/geo/cities').catch(() => mock.getNationCities())
}

export function getNationHierarchy() {
  return mock.getNationHierarchy()
}

export function getDistrictsByCity(cityName: string) {
  return mock.getDistrictsByCity(cityName)
}

export function getCommunitiesByDistrict(districtIdOrName: string) {
  return mock.getCommunitiesByDistrict(districtIdOrName)
}

export function getGeoDevices(city?: string): Promise<{ list: DevicePoint[]; total: number }> {
  return http
    .get<{ list: DevicePoint[]; total: number }>(
      `/v1/geo/devices${city ? '?city=' + encodeURIComponent(city) : ''}`,
    )
    .catch(async () => {
      const list = await mock.getNationDevices(city)
      return { list, total: list.length }
    })
}

export function getDemographics(): Promise<Demographics> {
  if (!useRealApi()) return mock.getDemographics()
  if (isVendorTenant()) {
    return Promise.resolve({
      male: 0,
      female: 0,
      avg_age: 0,
      max_age: 0,
      by_care_level: [],
      by_age_range: [],
      diseases: [],
    })
  }
  return http.get<Demographics>('/v1/stats/demographics').catch(() => mock.getDemographics())
}

export function getRankings(): Promise<Rankings> {
  if (!useRealApi()) return mock.getRankings()
  if (isVendorTenant()) return Promise.resolve({ sleep: [], fall_risk: [], vitals: [] })
  return http.get<Rankings>('/v1/stats/rankings').catch(() => mock.getRankings())
}

export function getRoutineMeta(patientId: string): { normalNightTrips: number; rehabScheduled: boolean } {
  return mock.getRoutineMeta(patientId)
}

export function getDevices(): Promise<DeviceDistribution> {
  return mock.getDevices()
}

export function getFacilityStats(): Promise<FacilityStats> {
  return mock.getFacilityStats()
}

export function getPatientProfile(patientId: string): Promise<PatientProfile> {
  return mock.getPatientProfile(patientId)
}

// ---------- 设备资产管理与生命周期 ----------
export function getDeviceAssets(params?: { customer?: string; partner?: string; status?: string }): Promise<{ list: DeviceAsset[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.customer) qs.set('customer', params.customer)
  if (params?.partner) qs.set('partner', params.partner)
  if (params?.status) qs.set('status', params.status)
  const q = qs.toString()
  return http.get<{ list: DeviceAsset[]; total: number }>(`/v1/devices${q ? '?' + q : ''}`)
}

export function transitionDeviceLifecycle(deviceId: string, targetStatus: string, note?: string): Promise<DeviceAsset> {
  return http.post<DeviceAsset>(`/v1/devices/${encodeURIComponent(deviceId)}/lifecycle`, {
    target_status: targetStatus,
    note,
  })
}

export function getDeviceLifecycleLogs(deviceId?: string): Promise<{ list: DeviceLifecycleLog[]; total: number }> {
  return http.get<{ list: DeviceLifecycleLog[]; total: number }>(`/v1/devices/lifecycle-logs${deviceId ? '?device_id=' + encodeURIComponent(deviceId) : ''}`)
}

// ---------- 合作伙伴渠道 ----------
export function getPartnerChannels(): Promise<PartnerChannelData> {
  return http.get<PartnerChannelData>('/v1/partner/channels')
}

export function createPartnerLead(input: {
  name: string
  contact?: string
  phone?: string
  estimated_devices?: number
  message?: string
}): Promise<PartnerLead> {
  return http.post<PartnerLead>('/v1/partner/leads', input)
}

export function advancePartnerLead(leadId: string, status?: string): Promise<PartnerLead> {
  return http.post<PartnerLead>(`/v1/partner/leads/${encodeURIComponent(leadId)}/advance`, status ? { status } : {})
}

// ---------- 长护险业务域 ----------
export function getAssessedPersons(): Promise<{ list: AssessedPerson[]; total: number }> {
  return http.get<{ list: AssessedPerson[]; total: number }>('/v1/ltc/assessed-persons')
}

export function getLtcApplications(): Promise<{ list: LtcApplication[]; total: number }> {
  return http.get<{ list: LtcApplication[]; total: number }>('/v1/ltc/applications')
}

export function createLtcApplication(input: Partial<LtcApplication>): Promise<LtcApplication> {
  return http.post<LtcApplication>('/v1/ltc/applications', input)
}

export function submitLtcApplication(applicationId: string): Promise<LtcApplication> {
  return http.post<LtcApplication>(`/v1/ltc/applications/${encodeURIComponent(applicationId)}/submit`)
}

export function getAssessmentTasks(): Promise<{ list: AssessmentTask[]; total: number }> {
  return http.get<{ list: AssessmentTask[]; total: number }>('/v1/ltc/assessment-tasks')
}

export function dispatchAssessmentTask(input: { application_id: string; assessor_account: string }): Promise<AssessmentTask> {
  return http.post<AssessmentTask>('/v1/ltc/assessment-tasks', input)
}

export function acceptAssessmentTask(taskId: string): Promise<AssessmentTask> {
  return http.post<AssessmentTask>(`/v1/ltc/assessment-tasks/${encodeURIComponent(taskId)}/accept`)
}

export function createAssessmentSnapshot(input: { task_id: string; window_days?: number }): Promise<AssessmentSnapshot> {
  return http.post<AssessmentSnapshot>('/v1/ltc/snapshots', input)
}

export function handleAssistantInsight(insightId: string, input: { action: string; note?: string }): Promise<AssistantInsight> {
  return http.post<AssistantInsight>(`/v1/ltc/insights/${encodeURIComponent(insightId)}/handle`, input)
}

export function getServicePlans(): Promise<{ list: ServicePlan[]; total: number }> {
  return http.get<{ list: ServicePlan[]; total: number }>('/v1/ltc/service-plans')
}

export function getServiceVisits(): Promise<{ list: ServiceVisit[]; total: number }> {
  return http.get<{ list: ServiceVisit[]; total: number }>('/v1/ltc/service-visits')
}

export function getServiceEvidences(): Promise<{ list: ServiceEvidence[]; total: number }> {
  return http.get<{ list: ServiceEvidence[]; total: number }>('/v1/ltc/service-evidence')
}

export function getSettlements(): Promise<{ list: Settlement[]; total: number }> {
  return http.get<{ list: Settlement[]; total: number }>('/v1/ltc/settlements')
}

export function reviewSettlement(settlementId: string, input: { step?: number; action?: string; pass?: boolean; note?: string }): Promise<Settlement> {
  return http.post<Settlement>(`/v1/ltc/settlements/${encodeURIComponent(settlementId)}/review`, input)
}

export function getQualityEvents(): Promise<{ list: QualityEvent[]; total: number }> {
  return http.get<{ list: QualityEvent[]; total: number }>('/v1/ltc/quality-events')
}

export function disposeQualityEvent(eventId: string, input: { action: string; note?: string }): Promise<QualityEvent> {
  return http.post<QualityEvent>(`/v1/ltc/quality-events/${encodeURIComponent(eventId)}/dispose`, input)
}

export function getSupervisionCases(): Promise<{ list: SupervisionCase[]; total: number }> {
  return http.get<{ list: SupervisionCase[]; total: number }>('/v1/ltc/supervision-cases')
}

export function createSupervisionCase(input: { target_id: string; action: string; remarks?: string }): Promise<SupervisionCase> {
  return http.post<SupervisionCase>('/v1/ltc/supervision-cases', input)
}

// ---------- 医保监管工单、病历档案、评估师与在线遥测 ----------
export function getWorkOrders(params?: { order_type?: string; status?: string; applicant_id?: string }): Promise<{ list: WorkOrder[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.order_type) qs.set('order_type', params.order_type)
  if (params?.status) qs.set('status', params.status)
  if (params?.applicant_id) qs.set('applicant_id', params.applicant_id)
  const q = qs.toString()
  return http.get<{ list: WorkOrder[]; total: number }>(`/v1/ltc/work-orders${q ? '?' + q : ''}`)
}

export function actionWorkOrder(workOrderId: string, input: { action: string; note?: string }): Promise<WorkOrder> {
  return http.post<WorkOrder>(`/v1/ltc/work-orders/${encodeURIComponent(workOrderId)}/action`, input)
}

export function getMedicalRecord(personId: string): Promise<MedicalRecord> {
  return http.get<MedicalRecord>(`/v1/ltc/assessed-persons/${encodeURIComponent(personId)}/medical-record`)
}

export function getAssessors(orgId?: string): Promise<{ list: AssessorProfile[]; total: number }> {
  return http.get<{ list: AssessorProfile[]; total: number }>(`/v1/ltc/assessors${orgId ? '?org_id=' + encodeURIComponent(orgId) : ''}`)
}

export function getAssessmentOrgs(): Promise<{ list: AssessmentOrg[]; total: number }> {
  return http.get<{ list: AssessmentOrg[]; total: number }>('/v1/ltc/assessment-orgs')
}

export function getDeviceTelemetry(deviceId: string): Promise<DeviceLiveTelemetry> {
  return http.get<DeviceLiveTelemetry>(`/v1/ltc/devices/${encodeURIComponent(deviceId)}/telemetry`)
}

// ---------- 监测与报告系统 (Reports & Analytics) ----------
export interface LtcReport {
  report_id: string
  type: string
  title: string
  owner: string
  role: string
  source: string
  is_simulated: boolean
  applicant_id?: string | null
  patient_id?: string | null
  patient_name?: string | null
  bed_id?: string | null
  ward?: string | null
  nurse_name?: string | null
  period?: string | null
  generated_at: string
  auditor?: string | null
  status?: string
  data?: any
}

export function getReports(params?: { type?: string; period?: string; applicant_id?: string; patient_id?: string }): Promise<{ list: LtcReport[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.type) qs.set('type', params.type)
  if (params?.period) qs.set('period', params.period)
  if (params?.applicant_id) qs.set('applicant_id', params.applicant_id)
  if (params?.patient_id) qs.set('patient_id', params.patient_id)
  const q = qs.toString()
  return http.get<{ list: LtcReport[]; total: number }>(`/v1/ltc/reports${q ? '?' + q : ''}`)
}

export function generateReport(input: { type: string; period?: string; applicant_id?: string; patient_name?: string; bed_id?: string }): Promise<LtcReport> {
  return http.post<LtcReport>('/v1/ltc/reports/generate', input)
}

export function getReportDetail(reportId: string): Promise<LtcReport> {
  return http.get<LtcReport>(`/v1/ltc/reports/${encodeURIComponent(reportId)}`)
}

// ---------- 医保监管专班 (Supervision Platform) ----------
export function getSupervisionDashboard(params?: { pool_id?: string }): Promise<SupervisionDashboardData> {
  const qs = new URLSearchParams()
  if (params?.pool_id) qs.set('pool_id', params.pool_id)
  const q = qs.toString()
  return http.get<SupervisionDashboardData>(`/v1/ltc/supervision/dashboard${q ? '?' + q : ''}`)
}

export function switchGovernanceMode(mode?: 'delegated' | 'direct'): Promise<{ current_mode: 'delegated' | 'direct'; updated_at: string; updated_by: string }> {
  return http.post<{ current_mode: 'delegated' | 'direct'; updated_at: string; updated_by: string }>('/v1/ltc/supervision/mode', { mode })
}

export function getSupervisionClues(params?: { pool_id?: string; risk_level?: string; status?: string }): Promise<{ list: SupervisionClue[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.pool_id) qs.set('pool_id', params.pool_id)
  if (params?.risk_level) qs.set('risk_level', params.risk_level)
  if (params?.status) qs.set('status', params.status)
  const q = qs.toString()
  return http.get<{ list: SupervisionClue[]; total: number }>(`/v1/ltc/supervision/clues${q ? '?' + q : ''}`)
}

export function scanSupervisionClues(input?: { pool_id?: string }): Promise<{ scanned_at: string; scanned_devices: number; mismatches_detected: number; new_clues_added: number; total_active_clues: number }> {
  return http.post('/v1/ltc/supervision/clues/scan', input || {})
}

export function dispatchSupervisionClue(
  clueId: string,
  input?: { dispatched_to?: string; due_hours?: number; inquiry_points?: string },
): Promise<SupervisionClue> {
  return http.post<SupervisionClue>(`/v1/ltc/supervision/clues/${encodeURIComponent(clueId)}/dispatch`, {
    clue_id: clueId,
    ...(input || {}),
  })
}

export function feedbackSupervisionClue(
  clueId: string,
  input: { interview_notes: string; pre_advisory: string; objective_snapshot?: string },
): Promise<SupervisionClue> {
  return http.post<SupervisionClue>(`/v1/ltc/supervision/clues/${encodeURIComponent(clueId)}/feedback`, {
    clue_id: clueId,
    ...input,
  })
}

export function adjudicateSupervisionClue(
  clueId: string,
  input: { decision: string; penalty_amount?: number; remarks?: string },
): Promise<SupervisionClue> {
  return http.post<SupervisionClue>(`/v1/ltc/supervision/clues/${encodeURIComponent(clueId)}/adjudicate`, {
    clue_id: clueId,
    ...input,
  })
}

export function getSupervisionPenetration(params?: { pool_id?: string }): Promise<PenetrationData> {
  const qs = new URLSearchParams()
  if (params?.pool_id) qs.set('pool_id', params.pool_id)
  const q = qs.toString()
  return http.get<PenetrationData>(`/v1/ltc/supervision/penetration${q ? '?' + q : ''}`)
}

export function getSettlementVoucher(settlementId: string): Promise<SettlementVoucher> {
  return http.get<SettlementVoucher>(`/v1/ltc/settlements/${encodeURIComponent(settlementId)}/voucher`)
}

// ---------- 长护险受托商保经办业务中心 (Insurer Operations) ----------
export interface InsurerDashboardData {
  pool_id: string
  pool_name: string
  operator_org: string
  kpis: {
    pending_intake: number
    pending_dispatch: number
    active_evaluations: number
    active_anomalies_pending_flycheck: number
    pending_settlements_stage2: number
    pending_settlements_amount: number
    settlement_deductions_mtd: number
    sla_compliance_rate: number
    total_enrolled_elders: number
    iot_devices_online: number
  }
  sla_countdowns: Array<{
    id: string
    type: string
    target: string
    due_in_hours: number
    status: 'normal' | 'warning' | 'danger'
    desc: string
  }>
  iot_health: {
    radar_online_rate: number
    sensor_mat_vital_rate: number
    today_cross_checked_orders: number
    today_detected_anomalies: number
  }
}

export interface InsurerInspectionTask {
  inspection_id: string
  pool_id: string
  title: string
  source: string
  target_type: string
  target_name: string
  service_org: string
  service_elder: string
  elder_address: string
  device_sn: string
  anomaly_desc: string
  risk_level: 'normal' | 'high' | 'critical'
  assigned_to: string
  status: 'pending_onsite' | 'onsite_completed'
  due_at: string
  created_at: string
  conclusion?: string | null
  conclusion_label?: string | null
  onsite_notes?: string | null
  inspector_name?: string | null
  inspected_at?: string | null
  proof_photos?: string[]
}

export function getInsurerDashboard(params?: { pool_id?: string }): Promise<InsurerDashboardData> {
  const qs = new URLSearchParams()
  if (params?.pool_id) qs.set('pool_id', params.pool_id)
  const q = qs.toString()
  return http.get<InsurerDashboardData>(`/v1/ltc/insurer/dashboard${q ? '?' + q : ''}`)
}

export function getInsurerInspections(params?: { pool_id?: string }): Promise<{ list: InsurerInspectionTask[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.pool_id) qs.set('pool_id', params.pool_id)
  const q = qs.toString()
  return http.get<{ list: InsurerInspectionTask[]; total: number }>(`/v1/ltc/insurer/inspections${q ? '?' + q : ''}`)
}

export function recordInsurerInspection(
  id: string,
  input: { status?: string; conclusion?: string; conclusion_label?: string; onsite_notes?: string; inspector_name?: string; proof_photos?: string[] }
): Promise<InsurerInspectionTask> {
  return http.post<InsurerInspectionTask>(`/v1/ltc/insurer/inspections/${encodeURIComponent(id)}/record`, input)
}
export interface AssessorDashboardData {
  pool_id: string
  pool_title: string
  org_id: string
  org_name: string
  current_user: {
    account_id: string
    name: string
    role: string
    unified_role?: string
    assigned_title?: string
  }
  kpis: {
    total_tasks: number
    assigned_count: number
    assessing_count: number
    pending_expert_count: number
    completed_count: number
    pending_insights_count: number
    severe_disability_rate: number
    city_normal_severe_rate: number
    gaussian_status: 'normal' | 'warning'
    dual_assessor_compliance_pct: number
    dual_expert_compliance_pct: number
    guardian_present_rate_pct: number
    iot_telemetry_consistency_pct: number
    total_elders_in_pool: number
  }
  statutory_red_lines: {
    dual_assessor_mandatory: boolean
    dual_expert_confirmation_mandatory: boolean
    guardian_presence_mandatory: boolean
    iot_telemetry_conclusion_frozen: null
    no_developer_jargon: boolean
  }
  tasks: AssessmentTask[]
  snapshots: AssessmentSnapshot[]
  insights: AssistantInsight[]
  assessors: AssessorProfile[]
  assessment_orgs: AssessmentOrg[]
}

export function getAssessorDashboard(params?: { pool_id?: string }): Promise<AssessorDashboardData> {
  const qs = new URLSearchParams()
  if (params?.pool_id) qs.set('pool_id', params.pool_id)
  const q = qs.toString()
  return http.get<AssessorDashboardData>(`/v1/ltc/assessor/dashboard${q ? '?' + q : ''}`)
}

export function startAssessmentTask(taskId: string): Promise<AssessmentTask> {
  return http.post<AssessmentTask>(`/v1/ltc/tasks/${encodeURIComponent(taskId)}/start`)
}

export function submitAssessmentTask(taskId: string, input: {
  daily_living_score?: number
  cognition_score?: number
  perception_score?: number
  mental_score?: number
  preliminary_level: string
  guardian_present?: boolean
  second_assessor_name?: string
  video_evidence?: string
  remarks?: string
}): Promise<{ task: AssessmentTask; result: any }> {
  return http.post<{ task: AssessmentTask; result: any }>(`/v1/ltc/tasks/${encodeURIComponent(taskId)}/submit`, input)
}

export function expertReviewTask(taskId: string, input: {
  second_expert_id?: string
  second_expert_name?: string
  clinical_diagnosis: string
  recommended_level: string
  expert_opinion: string
  iot_consistency_verdict?: 'consistent' | 'acceptable' | 'deviated'
  iot_clinical_rationale?: string
  sign_off_status?: 'approved' | 'returned'
}): Promise<{ task: AssessmentTask; report: any }> {
  return http.post<{ task: AssessmentTask; report: any }>(`/v1/ltc/tasks/${encodeURIComponent(taskId)}/expert-review`, input)
}

// ==================== N28 租户内账号与权限管理（三层模型：用户-组-颗粒） ====================

export interface OrgUserRow {
  username: string
  display_name: string
  role: string
  unified_role: string
  workspace: string
  scope: string
  granted_perms: string[]
  revoked_perms: string[]
  permissions: string[]
}

export interface OrgUsersResp {
  list: OrgUserRow[]
  total: number
}

export interface OrgUserPatchResp {
  username: string
  granted_perms: string[]
  revoked_perms: string[]
  permissions: string[]
}

/** 本租户账号列表（含每人组归属与颗粒覆盖明细） */
export function getOrgUsers(): Promise<OrgUsersResp> {
  return http.get<OrgUsersResp>('/v1/org/users')
}

/** 权限颗粒目录（全量可开关清单） */
export function getPermissionCatalog(): Promise<{ codes: string[] }> {
  return http.get<{ codes: string[] }>('/v1/org/permission-catalog')
}

/** 账号颗粒微调（granted/revoked 传全量数组；reset_perms 一键回组默认；new_password 重置口令） */
export function patchOrgUser(
  username: string,
  body: { granted_perms?: string[]; revoked_perms?: string[]; reset_perms?: boolean; new_password?: string },
): Promise<OrgUserPatchResp> {
  return http.patch<OrgUserPatchResp>(`/v1/org/users/${encodeURIComponent(username)}`, body)
}

/** 权限变更后的会话刷新：拉最新权限（不必重登） */
export function getAuthSession(): Promise<{
  username: string
  staff: { name: string; role: string; unified_role?: string }
  workspace: string
  permissions: string[]
  data_scope?: string
  granted_perms: string[]
  revoked_perms: string[]
}> {
  return http.get('/v1/auth/session')
}
