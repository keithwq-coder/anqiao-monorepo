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

export type TenantKind = 'vendor' | 'nursing_home' | 'platform' | 'anqiao_ops' | 'insurer' | 'bureau' | 'partner' | 'customer_org' | 'assessment_org'

export interface LoginResponse {
  token: string
  staff: { name: string; role: string }
  tenant: { tenant_id: string; name: string; kind: TenantKind }
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
  category?: string
  city: string
  district?: string
  community?: string
  building?: string
  room?: string
  address?: string // 点位详细地址
  customer: string
  lon: number | null
  lat: number | null
  online: boolean
  alerting: boolean
  last_data_time: string
}

export type { DistrictDetail, CommunityDetail, UnitDevice, CityHierarchy } from '../projects'

export interface Rankings {
  sleep: RankingRow[]
  fall_risk: RankingRow[]
  vitals: VitalsRankingRow[]
}

