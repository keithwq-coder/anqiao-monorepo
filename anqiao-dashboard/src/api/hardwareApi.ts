/**
 * 中科安樵 AI健康守护仪 数据客户端
 * 目标态（API-CONTRACT §3.5 / INTEGRATION-SPEC §6-1）：
 * 浏览器不直连硬件云、不持有硬件云口令/长期 JWT；
 * 一律经业务后端 GET /v1/hardware/* 代理（业务 Bearer 令牌）。
 * 未登录或后端未注入 HW_* 时显式失败，禁止静默 mock。
 */

export interface HardwareDevice {
  device_id: string
  device_alias: string | null
  relation_type: string
  account: string
  device_category: 'health_guardian' | 'fall_detector' | 'health_monitor' | string
  latest_data_time: string | null
}

export interface LatestHardwareData {
  device_id: string
  account: string
  hr: number
  br: number
  tp: number
  isBed: boolean
  body_movement: number
  sleepReport: any | null
  created_at: string
}

export interface TodayRawDataPoint {
  br: number
  hr: number
  tp: number
  isBed: boolean
  body_movement: number
  created_at: string
}

export interface HourlyVitalsAggregate {
  hour: string // "00:00", "01:00", etc.
  hr: number
  br: number
  tp: number
  inBed: boolean
  moveFreq: number // 体动频次 (次/小时，按API body_movement跳变事件聚合)
  count: number
}

export interface SleepReportData {
  hrv_ms: number
  sleep_start: string
  sleep_end: string
  report_start: string
  report_end: string
  sleep_score: number
  breathing_score: number
  apnea_count: number
  avg_apnea_seconds: number
  longest_apnea_seconds: number
  out_of_bed_count: number
  deep_sleep_minutes: number
  light_sleep_minutes: number
  awake_duration_minutes: number
  sleep_duration_minutes: number
  bed_duration_minutes: number
  stage_fields: number[] // 0: 清醒, 1: 浅睡, 2: 深睡, 3: REM/快速呼吸
  value_fields?: number[]
}

export interface SleepStatsResult {
  br_avg: number
  hr_avg: number
  tp_avg: number
  count: number
  sleepReport: SleepReportData | null
}

export interface HardwareAlarm {
  id: number
  device_id: string
  alert_type: 'hr' | 'br' | 'tp' | 'off_bed' | 'fall' | string
  alert_value: string
  trigger_time: string
  handle_time: string | null
  status: 'triggered' | 'handled' | 'missed' | string
}

export interface HardwareStatusItem {
  device_name: string
  device_status: string
  smbd_flag: string
}

// 业务后端同源 base（与 http.ts 一致）；硬件云凭据不在前端
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || ''
const TOKEN_KEY = 'anqiao_saas_token'

function businessToken(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) || ''
}

async function proxyGet<T>(path: string): Promise<T> {
  const token = businessToken()
  if (!token) {
    throw new Error('[hardwareApi] 未登录，无法访问 /v1/hardware/*（业务 Bearer 必填）')
  }
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('[hardwareApi] 网络异常，硬件代理不可达')
  }
  let body: { code: number; msg: string; data: unknown }
  try {
    body = await res.json()
  } catch {
    throw new Error(`[hardwareApi] 服务响应异常（HTTP ${res.status}）`)
  }
  if (body.code !== 200) {
    throw new Error(body.msg || `[hardwareApi] 代理失败（${body.code}）`)
  }
  return body.data as T
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** 兼容旧调用：登录态由业务会话提供；硬件云令牌仅在服务端 */
export async function ensureHardwareToken(): Promise<string> {
  // 阶段四：前端不再持有硬件云 JWT；有业务令牌即可调用代理
  return businessToken() || 'business-session'
}

/** 硬件在册设备列表（原始响应，供云扫描字段容错） */
export async function getHardwareDeviceListRaw(userId?: number): Promise<Record<string, unknown>> {
  return proxyGet<Record<string, unknown>>(`/v1/hardware/devices/raw${qs({ user_id: userId })}`)
}

/** 硬件在册设备列表（展平） */
export async function getHardwareDeviceList(userId?: number): Promise<HardwareDevice[]> {
  const data = await proxyGet<{
    healthDevice_List?: HardwareDevice[]
    fallDevice_List?: HardwareDevice[]
    healthDeviceBed_List?: HardwareDevice[]
  }>(`/v1/hardware/devices${qs({ user_id: userId })}`)
  return [...(data.healthDevice_List || []), ...(data.fallDevice_List || []), ...(data.healthDeviceBed_List || [])]
}

/** 指定设备最新实时遥测 */
export async function getLatestHardwareData(deviceId: string): Promise<LatestHardwareData> {
  return proxyGet<LatestHardwareData>(`/v1/hardware/latest${qs({ device_id: deviceId })}`)
}

/** 设备权威在线/在场状态列表 */
export async function getHardwareDeviceStatus(): Promise<HardwareStatusItem[]> {
  const data = await proxyGet<HardwareStatusItem[] | { list?: HardwareStatusItem[] }>(`/v1/hardware/status`)
  if (Array.isArray(data)) return data
  return data?.list ?? []
}

/** 指定设备今日连续生理数据 */
export async function getTodayRawData(deviceId: string): Promise<TodayRawDataPoint[]> {
  return proxyGet<TodayRawDataPoint[]>(`/v1/hardware/today${qs({ device_id: deviceId })}`)
}

/** 指定设备特定日期睡眠统计 */
export async function getSleepStats(deviceId: string, date?: string): Promise<SleepStatsResult> {
  return proxyGet<SleepStatsResult>(`/v1/hardware/sleep${qs({ device_id: deviceId, date })}`)
}

/** 有睡眠报告的历史日期列表 */
export async function getReportDates(deviceId: string): Promise<string[]> {
  const dates = await proxyGet<string[]>(`/v1/hardware/report-dates${qs({ device_id: deviceId })}`)
  return Array.isArray(dates) ? dates : []
}

/** 云平台告警列表 */
export async function getHardwareAlarms(
  userId?: number,
  page = 1,
  pageSize = 20,
): Promise<{ items: HardwareAlarm[]; total: number }> {
  const res = await proxyGet<{ items?: HardwareAlarm[]; total?: number }>(
    `/v1/hardware/alarms${qs({ user_id: userId, page, page_size: pageSize })}`,
  )
  return { items: res?.items ?? [], total: res?.total ?? 0 }
}

/**
 * 将今日原生采样点聚合为 24 小时微动节律时序（用于大屏 24h 曲线）
 */
export function aggregateTodayPoints(points: TodayRawDataPoint[]): HourlyVitalsAggregate[] {
  const hours: HourlyVitalsAggregate[] = []
  for (let h = 0; h < 24; h++) {
    hours.push({
      hour: `${String(h).padStart(2, '0')}:00`,
      hr: 0,
      br: 0,
      tp: 0,
      inBed: false,
      moveFreq: 0,
      count: 0,
    })
  }

  if (!points || !points.length) {
    return hours
  }

  const hourBuckets: Array<{
    hrSum: number
    hrCnt: number
    brSum: number
    brCnt: number
    tpSum: number
    tpCnt: number
    inBedCnt: number
    moveEpisodes: number
    lastMove: number
    total: number
  }> = Array.from({ length: 24 }, () => ({
    hrSum: 0,
    hrCnt: 0,
    brSum: 0,
    brCnt: 0,
    tpSum: 0,
    tpCnt: 0,
    inBedCnt: 0,
    moveEpisodes: 0,
    lastMove: 0,
    total: 0,
  }))

  for (const pt of points) {
    const timeStr = pt.created_at || ''
    const match = timeStr.match(/T?(\d{2}):\d{2}:\d{2}/)
    if (!match) continue
    const h = parseInt(match[1], 10)
    if (h < 0 || h >= 24) continue

    const b = hourBuckets[h]
    b.total++
    if (pt.isBed) b.inBedCnt++

    const curMove = pt.body_movement ? 1 : 0
    if (curMove === 1 && b.lastMove === 0) {
      b.moveEpisodes++
    }
    b.lastMove = curMove

    const hr = Number(pt.hr) || 0
    if (hr > 0 && hr < 220) {
      b.hrSum += hr
      b.hrCnt++
    }
    const br = Number(pt.br) || 0
    if (br > 0 && br < 60) {
      b.brSum += br
      b.brCnt++
    }
    const tp = Number(pt.tp) || 0
    if (tp >= 30 && tp <= 45) {
      b.tpSum += tp
      b.tpCnt++
    }
  }

  for (let h = 0; h < 24; h++) {
    const b = hourBuckets[h]
    const count = b.total
    const inBed = count > 0 && b.inBedCnt / count > 0.3
    const avgHr = b.hrCnt > 0 ? Math.round(b.hrSum / b.hrCnt) : 0
    const avgBr = b.brCnt > 0 ? Math.round(b.brSum / b.brCnt) : 0
    const avgTp = b.tpCnt > 0 ? Number((b.tpSum / b.tpCnt).toFixed(1)) : 0

    hours[h] = {
      hour: `${String(h).padStart(2, '0')}:00`,
      hr: avgHr,
      br: avgBr,
      tp: avgTp,
      inBed,
      moveFreq: b.moveEpisodes,
      count,
    }
  }

  return hours
}
