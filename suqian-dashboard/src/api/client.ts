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
} from './types'
import * as mock from './mock'
import { http, getToken, getSession, setSession } from './http'

// SaaS 切片：登录走真实后端，成功后会话写入 localStorage
export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await http.post<LoginResponse>('/v1/auth/login', { username, password })
  setSession(data.token, { staff: data.staff, tenant: data.tenant })
  return data
}

// 真实 API 仅限控制台路由(#/console):token 存于 localStorage,按源共享,
// 大屏(/dash/ 或本地开发)与控制台同部署源时会被误判"已登录"而请求不存在的 /v1,
// 因此大屏一律走 mock;控制台内真实接口失败时读接口回退 mock 兜底,写接口不兜底。
// 例外:vendor(厂商)租户与护理院数据域完全隔离——接口失败一律不回退凯健 mock,
// 列表/概览返回空结构(UI 走空态),单对象详情直接抛错(UI 走错误态),避免虚构长者数据串租户泄漏。
const isConsole = () => typeof location !== 'undefined' && location.hash.startsWith('#/console')
const useRealApi = () => isConsole() && !!getToken()
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
  return mock.getFloors()
}

export function getWards(floor?: string): Promise<WardInfo[]> {
  return mock.getWards(floor)
}

export function getBeds(params?: BedsParams): Promise<Bed[]> {
  return mock.getBeds(params)
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
  // vendor 租户无长者数据域：失败直接抛错，绝不回退凯健 mock
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

// 班次卡（值班工作台用）；vendor 租户无护理班次，失败返回空结构而非凯健 mock
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
  return mock.getDemographics()
}


export function getRankings(): Promise<Rankings> {
  return mock.getRankings()
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
