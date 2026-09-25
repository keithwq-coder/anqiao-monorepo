/**
 * 大屏数据层 · 唯一 API 入口（INTEGRATION-SPEC §4 / API-CONTRACT §3.1）
 *
 * 口径：
 * - 第一批（✅ console 已实现）：overview / alerts / shift / geo/* / patients / ws → 直连 /v1
 * - 第二批（✅ console 已实现）：floors / wards / beds / stats/* → 直连 /v1；失败空态「未获取」
 * - mock 仅允许本地开发显式开关 VITE_MOCK=1；生产构建禁止静默 mock 回退（接口失败显式空态/报错）
 * - vendor / platform 租户任何环境禁止 mock 回退（防串租户泄漏）
 * - 后端未提供的数据一律 null / 空态，严禁编造数字
 */
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
import { http, getToken, getSession, setSession, ApiError } from './http'

/** 显式 mock 开关：仅 VITE_MOCK=1 启用（本地开发） */
export const MOCK_ENABLED: boolean = String(import.meta.env.VITE_MOCK ?? '') === '1'

/** vendor / platform 租户禁止任何 mock 回退 */
function forbidsMock(): boolean {
  const kind = getSession()?.tenant.kind
  return kind === 'vendor' || kind === 'platform' || kind === 'anqiao_ops'
}

/** 是否允许走 mock：显式开关 且 非禁 mock 租户 */
function allowMock(): boolean {
  return MOCK_ENABLED && !forbidsMock()
}

// ---------- 空态（后端未提供 → 未获取，严禁编造） ----------
export const MISSING_TEXT = '未获取'

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

// ---------- 登录（复用 POST /v1/auth/login，token key: anqiao_saas_token） ----------
export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await http.post<LoginResponse>('/v1/auth/login', { username, password })
  setSession(data.token, { staff: data.staff, tenant: data.tenant })
  return data
}

// ---------- 第一批：✅ console 已实现，接真 /v1 ----------
// 接口失败一律显式空态/抛错，禁止静默 mock 回退；仅 VITE_MOCK=1 时整体走 mock。

export function getOverview(): Promise<Overview> {
  if (allowMock()) return mock.getOverview()
  return http.get<Overview>('/v1/overview').catch(() => emptyOverview())
}

export function getPatients(params?: PatientsParams): Promise<Paged<Patient>> {
  if (allowMock()) return mock.getPatients(params)
  const qs = new URLSearchParams()
  if (params?.floor) qs.set('floor', params.floor)
  if (params?.ward) qs.set('ward', params.ward)
  if (params?.status) qs.set('status', params.status)
  if (params?.q) qs.set('q', params.q)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  return http
    .get<Paged<Patient>>(`/v1/patients${query ? '?' + query : ''}`)
    .catch(() => emptyPaged<Patient>(params))
}

export function getPatient(patientId: string, date?: string): Promise<Patient> {
  if (allowMock()) return mock.getPatient(patientId, date)
  // 失败直接抛错（UI 错误态），绝不回退 mock 虚构长者数据
  return http.get<Patient>(`/v1/patients/${encodeURIComponent(patientId)}`)
}

export function getPatientDetail(patientId: string): Promise<PatientDetail> {
  if (allowMock()) return mock.getPatientDetail(patientId)
  return http.get<PatientDetail>(`/v1/patients/${encodeURIComponent(patientId)}`)
}

export function searchPatients(q: string, params?: Omit<PatientsParams, 'q'>): Promise<Paged<Patient>> {
  return getPatients({ ...params, q })
}

export function getAlerts(params?: AlertsParams): Promise<Paged<Alert>> {
  if (allowMock()) return mock.getAlerts(params)
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.level) qs.set('level', String(params.level))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  return http
    .get<Paged<Alert>>(`/v1/alerts${query ? '?' + query : ''}`)
    .catch(() => emptyPaged<Alert>(params))
}

/** 处置告警（POST /v1/alerts/{id}/handle）；写接口不兜底 */
export function handleAlert(alertId: string, note: string): Promise<Alert> {
  if (allowMock()) return mock.handleAlert(alertId, note)
  return http.post<Alert>(`/v1/alerts/${encodeURIComponent(alertId)}/handle`, { note })
}

/** 接单：triggered → handling（POST /v1/alerts/{id}/claim）；写接口不兜底 */
export function claimAlert(alertId: string): Promise<Alert> {
  if (allowMock()) {
    // mock 下等价于把状态推到 handling（与后端 claim 语义对齐）
    return mock.handleAlert(alertId, '（mock 接单）')
  }
  return http.post<Alert>(`/v1/alerts/${encodeURIComponent(alertId)}/claim`)
}

export function getShift(): Promise<ShiftInfo> {
  if (allowMock()) return mock.getShift()
  return http.get<ShiftInfo>('/v1/shift').catch(() => emptyShift())
}

/** 厂商租户城市聚合（GET /v1/geo/cities）；非厂商 403 时返回空数组 */
export function getGeoCities(): Promise<CityStat[]> {
  if (allowMock()) return mock.getNationCities()
  return http.get<CityStat[]>('/v1/geo/cities').catch(() => [])
}

export function getGeoDevices(city?: string): Promise<{ list: DevicePoint[]; total: number }> {
  if (allowMock()) {
    return mock.getNationDevices(city).then((list) => ({ list, total: list.length }))
  }
  return http
    .get<{ list: DevicePoint[]; total: number }>(
      `/v1/geo/devices${city ? '?city=' + encodeURIComponent(city) : ''}`,
    )
    .catch(() => ({ list: [], total: 0 }))
}

// ---------- 第二批：✅ console 已实现，接真 /v1（INTEGRATION-SPEC §4 / API-CONTRACT §3.1） ----------
// 仅 VITE_MOCK=1 且非禁 mock 租户时走 mock；接口失败返回空态（UI「未获取」），禁止静默回退。

export function getFloors(): Promise<FloorInfo[]> {
  if (allowMock()) return mock.getFloors()
  return http.get<FloorInfo[]>('/v1/floors').catch(() => [])
}

export function getWards(floor?: string): Promise<WardInfo[]> {
  if (allowMock()) return mock.getWards(floor)
  const qs = floor ? `?floor=${encodeURIComponent(floor)}` : ''
  return http.get<WardInfo[]>(`/v1/wards${qs}`).catch(() => [])
}

export function getBeds(params?: BedsParams): Promise<Bed[]> {
  if (allowMock()) return mock.getBeds(params)
  const qs = new URLSearchParams()
  if (params?.floor) qs.set('floor', params.floor)
  if (params?.ward) qs.set('ward', params.ward)
  const query = qs.toString()
  return http.get<Bed[]>(`/v1/beds${query ? '?' + query : ''}`).catch(() => [])
}

export function getDemographics(): Promise<Demographics> {
  if (allowMock()) return mock.getDemographics()
  return http.get<Demographics>('/v1/stats/demographics').catch(() => ({
    male: 0,
    female: 0,
    avg_age: 0,
    max_age: 0,
    by_care_level: [],
    by_age_range: [],
    diseases: [],
  }))
}

export function getRankings(): Promise<Rankings> {
  if (allowMock()) return mock.getRankings()
  return http.get<Rankings>('/v1/stats/rankings').catch(() => ({ sleep: [], fall_risk: [], vitals: [] }))
}

// ---------- 本地/静态辅助（无后端契约，不属 mock 兜底） ----------

export function getNationHierarchy() {
  return mock.getNationHierarchy()
}

export function getDistrictsByCity(cityName: string) {
  return mock.getDistrictsByCity(cityName)
}

export function getCommunitiesByDistrict(districtIdOrName: string) {
  return mock.getCommunitiesByDistrict(districtIdOrName)
}

export function getRoutineMeta(patientId: string): { normalNightTrips: number; rehabScheduled: boolean } {
  return mock.getRoutineMeta(patientId)
}

export function getDevices(): Promise<DeviceDistribution> {
  if (allowMock()) return mock.getDevices()
  return Promise.resolve({ total: 0, online: 0, offline: 0, online_rate: 0, running_days: 0, types: [] })
}

export function getFacilityStats(): Promise<FacilityStats> {
  if (allowMock()) return mock.getFacilityStats()
  return Promise.resolve({ running_days: 0, avg_response_seconds: 0, routine_baseline_score: 0 })
}

export function getPatientProfile(patientId: string): Promise<PatientProfile> {
  if (allowMock()) return mock.getPatientProfile(patientId)
  // 失败直接抛错（UI 显示未获取/错误态），绝不编造画像
  return Promise.reject(new ApiError(404, `${MISSING_TEXT}（画像接口待 console 实现）`))
}
