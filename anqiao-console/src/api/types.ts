export type Gender = 'male' | 'female'
export type CareLevel = '特级护理' | '一级护理' | '二级护理'
// device_offline / device_data 为厂商租户设备维度告警类型（离线超时 / 数据采集中断）
export type AlertType = 'fall' | 'off_bed' | 'hr' | 'br' | 'tp' | 'device_offline' | 'device_data'
export type AlertStatus = 'triggered' | 'handling' | 'handled' | 'missed'
export type PatientStatusFilter = 'in_bed' | 'off_bed' | 'abnormal'

export interface DeviceInfo {
  device_id: string
  type: string
  online: boolean
  last_data_time: string
}

export interface Bed {
  bed_id: string
  floor: string
  ward: string
  status: 'occupied' | 'vacant'
  patient_id: string | null
  device: DeviceInfo | null
}

export interface Vitals {
  hr: number
  br: number
  tp: number
  in_bed: boolean
  body_movement: number
  recorded_at: string
}

export interface PatientAbnormal {
  fall: boolean
  types: AlertType[]
}

export interface Patient {
  patient_id: string
  name: string
  gender: Gender
  age: number
  care_level: CareLevel
  ward: string
  bed_id: string
  nurse: string
  doctor: string
  floor?: string
  vitals: Vitals
  abnormal: PatientAbnormal | null
}

export interface Alert {
  alert_id: string
  bed_id: string
  patient_id: string
  type: AlertType
  level: 1 | 2 | 3
  status: AlertStatus
  title: string
  detail: string
  occurred_at: string
  claimed_by: string | null
  claimed_at: string | null
  handled_by: string | null
  handled_at: string | null
  handle_note: string | null
  // 厂商租户：设备维度告警附加字段（city 设备部署城市 / customer 客户主体，自营为「中科安樵自营」；护理院租户为 null/缺省）
  city?: string | null
  customer?: string | null
}

export interface Overview {
  device_total: number
  device_online: number
  device_online_rate: number
  patient_total: number
  patient_male: number
  patient_female: number
  bed_occupied: number
  bed_total: number
  alerts_today: number
  alerts_closed_today: number
  in_bed_count: number
  in_bed_rate: number
  city_count?: number
  generated_at: string
}

export interface FloorInfo {
  floor: string
  ward_count: number
  bed_total: number
  bed_occupied: number
}

export interface WardInfo {
  floor: string
  ward: string
  nurse_count: number
  nurse_ratio: string
  patient_count: number
  in_bed_count: number
}

export interface Paged<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export interface PatientsParams {
  floor?: string
  ward?: string
  status?: PatientStatusFilter
  q?: string
  page?: number
  page_size?: number
}

export interface BedsParams {
  floor?: string
  ward?: string
}

export interface AlertsParams {
  status?: AlertStatus
  level?: 1 | 2 | 3
  date?: string
  page?: number
  page_size?: number
}

export interface Demographics {
  male: number
  female: number
  avg_age: number
  max_age: number
  by_care_level: { care_level: CareLevel; count: number }[]
  by_age_range: { range: string; count: number }[]
  diseases: { name: string; count: number }[]
}

export interface DeviceTypeStat {
  name: string
  count: number
  color: string
  online_rate: number
}

export interface DeviceDistribution {
  total: number
  online: number
  offline: number
  online_rate: number
  running_days: number
  types: DeviceTypeStat[]
}

export interface FacilityStats {
  running_days: number
  avg_response_seconds: number
  routine_baseline_score: number
}

export type PatientLocation = 'bed' | 'bathroom' | 'corridor' | 'rehab_room' | 'activity_room' | 'dining_room'

export interface PatientProfile {
  patient_id: string
  sleep: {
    score: number
    grade: string
    totalMin: number
    totalHours: string
    bedTime: string
    leaveTime: string
    leaveCount: number
    movement: number
    deepPct: string
    stages: { deep: number; light: number; rem: number; awake: number }
  }
  fall_risk: number
  location: PatientLocation
  trip_tolerance: number
}

export interface RankingRow {
  patient_id: string
  name: string
  bed_id: string
  value: number
  delta: number
}

export interface VitalsRankingRow extends RankingRow {
  text: string
  abnormal: boolean
}

export type TenantKind = 'vendor' | 'nursing_home' | 'platform' | 'insurer' | 'bureau' | 'partner' | 'customer_org'

export type Workspace =
  | 'platform_operations'
  | 'device_monitoring'
  | 'medical_supervision'
  | 'insurer_operations'
  | 'assessor_workspace'
  | 'nursing_home_admin'
  | 'care_desk'
  | 'nursing_staff'
  | 'partner_operations'
  | 'system_admin'
  | 'family_workspace'

export interface Principal {
  account_id: string
  username: string
  staff_name: string
  role: string
  org_id: string
  org_name: string
  tenant_id: string
  workspace: Workspace
  data_scope: string
  pool_id?: string | null
  assigned_title?: string | null
  assigned_floors?: string[]
  assigned_nurse?: string | null
}

export interface LoginResponse {
  token: string
  staff: { name: string; role: string }
  tenant: { tenant_id: string; name: string; kind: TenantKind }
  workspace?: Workspace
  principal?: Principal
  permissions?: string[]
  data_scope?: string
  workspaces?: string[]
}

// ---------- 设备资产与生命周期 ----------
export interface DeviceAsset {
  device_id: string
  sn: string
  label: string
  type: string
  hardware_asset_owner: string
  operator_partner_id: string | null
  procurement_channel: string
  service_provider_org_id: string
  custodian_org_id: string
  monitored_subject_id: string | null
  device_placement_location: string
  lifecycle_status: string
  online: boolean
  last_data_time: string | null
  category?: string
  scene?: string
  assessment_usage?: string
  lon?: number | null
  lat?: number | null
}

export interface DeviceLifecycleLog {
  log_id: string
  device_id: string
  from_status: string
  to_status: string
  operator_id: string
  organization_id: string
  occurred_at: string
  location: string
  remark: string
}

// ---------- 合作伙伴渠道 ----------
export interface PartnerCustomer {
  org_id: string
  org_name: string
  contact: string
  phone: string
  devices_count: number
  active_monitoring: number
  created_at: string
  referrer_partner_id?: string
}

export interface PartnerLead {
  lead_id: string
  name: string
  contact: string
  status: string
  estimated_devices: number
  updated_at: string
}

export interface PartnerChannelData {
  partner_id: string
  list: any[]
  channels: any[]
  customers: PartnerCustomer[]
  leads: PartnerLead[]
}

// ---------- 长护险业务域 ----------
export interface AssessedPerson {
  person_id: string
  name: string
  gender: Gender
  age: number
  id_card: string
  pool_id: string
  address: string
  guardian_name: string
  guardian_phone: string
  disability_status: string
  disability_level?: string
  service_org_id: string
  service_org_name?: string
  org_id?: string
  bed_id: string
  device_id: string | null
  device_model?: string
  assessment_batch?: string
}

export interface LtcApplication {
  application_id: string
  applicant_id: string
  applicant_name?: string
  applicant_phone?: string
  id_card?: string
  type: string
  application_type?: string
  period: string
  application_level: string
  applied_level?: string
  pool_id?: string
  self_assessment_grade: string
  adl_score?: number
  statutory_duration_months?: number
  diagnosis?: string
  hospital?: string
  attending_doctor?: string
  guardian_name?: string
  guardian_phone?: string
  service_org_id?: string
  service_org_name?: string
  monitored_device_id?: string
  device_model?: string
  assessor_onsite_level?: string
  insurer_suggested_level?: string
  medical_ratified_level?: string
  identity_verification?: boolean
  submitter?: { role: string; account_id: string; name: string; tenant_id: string }
  status: string
  apply_date?: string
  scale_version?: string | null
  tenant_id?: string
  created_at: string
  updated_at: string
}

export interface AssessmentTask {
  task_id: string
  application_id: string
  applicant_id: string
  applicant_name?: string
  gender?: string
  age?: number
  id_card?: string
  address?: string
  guardian_name?: string
  guardian_phone?: string
  status: string
  assessor: { role?: string; account_id: string; name: string; org_id?: string }
  assessor_ids?: string[]
  second_assessor_name?: string
  guardian_present?: boolean
  video_evidence?: string
  device_id?: string
  device_model?: string
  snapshot_id?: string
  assigned_at?: string
  accepted_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  scale_version?: string
  scores?: {
    daily_living: number
    cognition: number
    perception: number
    mental_state: number
    total_score: number
  } | null
  preliminary_level?: string | null
  assessor_level?: string | null
  objective_conflict?: boolean
  conflict_detail?: string | null
  expert_confirmation?: string[] | null
}

export interface AssessmentSnapshot {
  snapshot_id: string
  task_id: string
  assessment_id?: string
  application_id?: string
  applicant_id?: string
  applicant_name?: string
  person_id?: string
  disclaimer_acknowledged?: boolean
  binding_id?: string
  device_id: string
  device_model?: string
  assessment_window?: { from: string; to: string }
  device_status?: string
  conclusion?: string | null
  metrics: {
    night_trips?: number
    in_bed_rate_pct?: number
    bed_leave_15min_count?: number
    fall_pose_events?: number
    hr_abnormal_days?: number
    tp_abnormal_days?: number
    avg_hr?: number
    avg_br?: number
    avg_tp?: number
  }
  cross_validation?: {
    finding: string
    confidence: string
    suggested_focus: string
  } | null
  status?: string
}

export interface AssistantInsight {
  insight_id: string
  task_id?: string
  applicant_id?: string
  type: string
  title: string
  detail: string
  suggested_focus: string
  handling_status: 'pending' | 'confirmed' | 'adopted' | 'rejected' | 'needs_manual_review'
  handled_by: string | null
  handled_at: string | null
  handling_note: string | null
  disclaimer: string
}

export interface ServicePlan {
  service_plan_id: string
  applicant_id: string
  person_id: string
  final_approved_level: string
  service_org_id: string
  care_plan_confirmation: { confirmed_by: string; confirmed_at: string }
  service_items: { item_code: string; name: string; frequency: string; duration_min: number }[]
  status: string
}

export interface ServiceVisit {
  service_visit_id: string
  service_plan_id: string
  person_id: string
  nurse_name: string
  nurse_id: string
  time: string
  location: string
  care_record: string
}

export interface ServiceEvidence {
  service_evidence_id: string
  service_plan_id: string
  service_visit_id: string
  person_id: string
  device_id: string
  visit_time: string
  visit_location: string
  identity_verified: boolean
  device_window: { from: string; to: string; device_status: string; in_bed: boolean; avg_hr: number | null }
  service_evidence_status: string
  device_signal_match: boolean
}

export interface Settlement {
  settlement_id: string
  service_plan_id: string
  applicant_id: string
  period: string
  amount: number
  status: 'declared' | 'pre_reviewed' | 're_reviewed' | 'disbursed'
  declared_by: string
  declared_at: string
  pre_reviewed_by: string | null
  pre_reviewed_at: string | null
  re_reviewed_by: string | null
  re_reviewed_at: string | null
  disbursed_by: string | null
  disbursed_at: string | null
  steps: any
  pool_id?: string
  org_id?: string
  org_name?: string
  pre_review_notes?: string
  pre_review_voucher?: any | null
  deducted_amount?: number
  voucher?: SettlementVoucher | null
}

export interface QualityEvent {
  event_id: string
  device_id: string
  status: string
  detail: string
  reported_at: string
  disposed: boolean
  disposed_by: string | null
  disposed_at?: string | null
  disposal_remark: string | null
  disposition_status?: string
}

export interface SupervisionCase {
  supervision_id: string
  scope: string
  target_id: string
  pattern?: string
  sample?: string
  action: string
  level: string
  result: string
  remarks: string
  created_by: string
  created_at: string
}

export interface VitalsPoint {
  t: string
  v: number
}

// GET /v1/patients/{id} 画像详情（契约 §2.2 Patient + 曲线/睡眠/慢病/告警历史）
export interface PatientDetail extends Patient {
  curves: { hr: VitalsPoint[]; br: VitalsPoint[]; tp: VitalsPoint[] }
  sleep: PatientProfile['sleep']
  diseases: string[]
  alert_history: Alert[]
}

// WS 实时事件（契约 §4）
export interface VitalsEvent {
  bed_id: string
  hr: number
  br: number
  tp: number
  in_bed: boolean
  body_movement: number
  recorded_at: string
}

// GET /v1/shift 班次卡
export interface ShiftInfo {
  shift_name: string
  shift_range: string
  nurses: { name: string; floor: string }[]
  carry_over_open: number
  generated_at: string
}

// GET /v1/geo/cities 城市聚合（厂商租户）
export interface CityStat {
  city: string
  lon: number
  lat: number
  device_total: number
  device_online: number
  alerts_today: number
  customers: string[]
}

// GET /v1/geo/devices 设备点（厂商租户）
export interface DevicePoint {
  device_id: string
  label?: string // 点位短名（如「太湖科创中心·903」）
  type: string
  city: string
  district?: string
  community?: string
  building?: string
  room?: string
  address?: string // 点位详细地址
  customer: string
  lon: number
  lat: number
  online: boolean
  alerting: boolean
  last_data_time: string
}

export type { DistrictDetail, CommunityDetail, UnitDevice, CityHierarchy } from '../assets/geoHierarchy'

export interface Rankings {
  sleep: RankingRow[]
  fall_risk: RankingRow[]
  vitals: VitalsRankingRow[]
}

// ---------- 医保监管与工单流扩展类型 ----------
export interface WorkOrderActionLog {
  time: string
  user: string
  action: string
}

export interface WorkOrder {
  work_order_id: string
  pool_id?: string
  title: string
  order_type: 'medical_ratify' | 'apply_review' | 'supervision_audit' | 'disbursement_fund'
  category_label: string
  priority: 'urgent' | 'high' | 'normal'
  applicant_id: string
  applicant_name: string
  application_id: string
  device_id: string
  device_model: string
  device_status: string
  current_stage: string
  status: 'pending_ratify' | 'processing' | 'investigating' | 'pre_reviewed' | 'ratified' | 'suspended' | 'approved'
  sla_deadline: string
  assigned_role: string
  handler_username: string
  hospital_diagnosis: string
  applied_level: string
  onsite_assessor_level: string
  insurer_suggested_level: string
  objective_evidence_summary: string
  created_at: string
  action_log?: WorkOrderActionLog[]
}

export interface MedicalRecordImaging {
  type: string
  date: string
  hospital: string
  conclusion: string
}

export interface MedicalRecordPrescription {
  drug_name: string
  spec: string
  usage: string
}

export interface MedicalRecord {
  record_id: string
  person_id: string
  patient_name: string
  age: number
  gender: string
  hospital_name: string
  department: string
  admission_no: string
  admission_date: string
  discharge_date: string
  illness_duration_months: number
  statutory_gate_passed: boolean
  attending_doctor: string
  primary_diagnosis: string
  secondary_diagnoses: string[]
  chief_complaint: string
  admission_condition: string
  treatment_course: string
  discharge_summary: string
  barthel_index_score: number
  mmse_score: number
  imaging_reports: MedicalRecordImaging[]
  chronic_prescriptions: MedicalRecordPrescription[]
  assistive_devices_dependency: string[]
  verified_by_bureau: boolean
  verification_agency: string
  patient_id?: string
  hospital_course?: string
  functional_impairment?: {
    muscle_strength_left?: string | number
    muscle_strength_right?: string | number
    adl_score_discharge?: number
  }
}

export interface AssessorProfile {
  assessor_id: string
  id?: string
  id_card?: string
  certificate_no?: string
  account_username: string
  name: string
  gender: string
  age: number
  qualification_cert_no: string
  qualification_level: string
  professional_title: string
  education_background: string
  practicing_years: number
  org_id: string
  org_name: string
  phone: string
  avoidance_org_ids: string[]
  avoidance_org_names: string[]
  active_status: string
  annual_evaluated_count: number
  accuracy_ratification_rate: number
  on_time_sla_rate: number
  current_assigned_tasks: number
  ethics_record: string
}

export interface AssessmentOrg {
  org_id: string
  name: string
  short_name: string
  unified_social_credit_code: string
  license_no: string
  qualification_grade: string
  legal_representative: string
  responsible_person: string
  contact_phone: string
  address: string
  accredited_coverage_areas: string[]
  active_assessors_count: number
  completed_assessments_total: number
  compliance_audit_rate: number
  status: string
}

export interface DeviceTelemetryStats {
  avg_night_off_bed_count: number
  long_off_bed_alerts_14d: number
  fall_radar_events_14d: number
  avg_heart_rate_14d: number
  avg_breath_rate_14d: number
  bed_rest_ratio_14d: string
}

export interface DeviceTelemetryObjective {
  medical_record_correlation: string
  correlation_reason: string
  conclusion: null
  disclaimer: string
}

export interface DeviceLiveTelemetry {
  device_id: string
  model: string
  online: boolean
  in_bed: boolean
  presence?: 'person' | 'empty' | null
  verify_status_text?: string
  service_status_text?: string
  person_id?: string | null
  person_name?: string
  age?: number
  gender?: string
  disability_status?: string
  address?: string
  hospital_name?: string
  primary_diagnosis?: string
  network?: string
  sample_time?: string
  current_heart_rate: number
  current_breath_rate: number
  in_bed_duration_minutes: number
  signal_quality: number
  last_packet_time: string
  window_14d_stats: DeviceTelemetryStats
  objective_consistency_evaluation: DeviceTelemetryObjective
}

// ---------- 统筹区监管驾驶舱与稽核闭环扩展类型 ----------
export interface InstitutionCredit {
  org_id: string
  org_name: string
  pool_id: string
  kind: string
  kind_label: string
  star_level: number
  credit_score: number
  compliance_rate: number
  active_elders_count: number
  radar_coverage_rate: number
  protocol_status: 'normal' | 'probation' | 'suspended'
  protocol_status_label: string
  last_supervision_at: string
}

export interface WarningBoardItem {
  id: string
  pool_id: string
  level: 'red' | 'yellow'
  category: string
  target_name: string
  title: string
  detail: string
  action_advice: string
  created_at: string
  status: string
}

export interface GovernanceModeInfo {
  current_mode: 'delegated' | 'direct'
  mode_title: string
  delegated_partner: string
  mode_desc?: string
  delegated_powers: string[]
  statutory_retained_powers: string[]
}

export interface SupervisionDashboardData {
  pool_id: string
  pool_name: string
  funds: {
    fund_pool_total: number
    monthly_pending_disbursement: number
    deducted_funds_total: number
    fund_balance_rate: number
    trend_months: string[]
    balance_trend: (number | Record<string, any>)[]
  }
  institution_credits: InstitutionCredit[]
  warning_boards: {
    red: WarningBoardItem[]
    yellow: WarningBoardItem[]
  }
  governance_mode: GovernanceModeInfo
}

export interface SupervisionClueDispatchOrder {
  order_no: string
  dispatched_to: string
  dispatched_at: string
  due_hours: number
  inquiry_points: string
  dispatched_by: string
}

export interface SupervisionClueFeedback {
  feedback_by: string
  feedback_at: string
  interview_notes: string
  objective_snapshot: string
  pre_advisory: 'suggest_pass' | 'suggest_deduct' | 'suggest_interview' | 'suggest_rectify' | 'suggest_terminate'
  pre_advisory_label: string
}

export interface SupervisionClueAdjudication {
  adjudicated_by: string
  adjudicated_at: string
  decision: 'pass' | 'deduct' | 'interview' | 'rectify' | 'terminate'
  decision_label: string
  penalty_amount: number
  doc_no: string
  remarks: string
}

export interface SupervisionClue {
  clue_id: string
  pool_id: string
  title: string
  source_type: 'radar_absence' | 'impossible_speed' | 'vital_signs_drift' | 'disability_reversal'
  source_label: string
  risk_level: 'red' | 'yellow'
  target_org_id: string
  target_org_name: string
  target_org?: string
  caregiver_name: string
  elderly_name: string
  target_elder?: string
  person_id: string
  device_id: string
  description: string
  evidence_snapshot: any
  status: 'pending_dispatch' | 'dispatched' | 'feedback_received' | 'adjudicated'
  dispatch_order: SupervisionClueDispatchOrder | null
  feedback: SupervisionClueFeedback | null
  adjudication: SupervisionClueAdjudication | null
  created_at: string
  updated_at?: string
}

export interface SettlementVoucher {
  voucher_no: string
  project_name: string
  org_name: string
  period: string
  declared_amount: number
  deducted_amount: number
  actual_disbursement: number
  insurer_org: string
  insurer_reviewed_by: string
  insurer_reviewed_at: string
  medical_org: string
  medical_reviewed_by: string
  medical_reviewed_at: string
  auth_code: string
  bank_batch_no: string
  seal_name: string
  status: 'generated' | 'disbursed'
}

export interface PenetrationPool {
  pool_id: string
  name: string
  desc: string
  orgs_count: number
  devices_count: number
  elders_count: number
  compliance_rate: number
}

export interface PenetrationCaregiver {
  name: string
  org_id: string
  org_name: string
  role: string
  phone: string
  certificate_no: string
  active_elders: string[]
  punch_accuracy_rate: number
  radar_match_rate: number
  recent_clues_count: number
  last_punch_time: string
}

export interface PenetrationElder {
  person_id: string
  name: string
  org_id: string
  device_id: string | null
  model: string
  online: boolean
  in_bed: boolean
  presence: string
  disability_level: string
  caregiver_name: string
  last_activity_time: string
  bed_rest_ratio_14d: string
  recent_vitals: {
    hr: number
    br: number
  }
}

export interface PenetrationData {
  current_pool: string
  pools: PenetrationPool[]
  institutions: Array<InstitutionCredit & { caregivers: string[] }>
  caregivers: PenetrationCaregiver[]
  elders: PenetrationElder[]
}

