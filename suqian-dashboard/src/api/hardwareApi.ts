/**
 * 中科安樵 AI健康守护仪 官方硬件对接 API 客户端
 * 数据来源：安樵自研云平台（华为云 api.health-track.anqiaokj.com）
 * 对接规范：AI健康守护仪对接API（V1.0）.pdf
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
  stage_fields: number[] // 0: 清醒, 1: 浅睡, 2: 深睡, 3: REM/快速眼动
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

// 优先直连云平台（云平台自带 CORS: *）；如果当前协议或内网受限，则回退同源代理
const CLOUD_API_BASE = 'https://api.health-track.anqiaokj.com'
const PROXY_API_BASE = '/hardware-api'

// 硬件接入鉴权凭据：仅允许经环境变量注入，禁止任何硬编码兜底（INTEGRATION-SPEC §6-1）
const DEFAULT_ACCOUNT = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_HW_ACCOUNT) || '') as string
const DEFAULT_PASS = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_HW_PASSWORD) || '') as string
const ENV_FALLBACK_TOKEN = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_HW_TOKEN) || '') as string
const DEFAULT_USER_ID = Number((typeof import.meta !== 'undefined' && import.meta.env?.VITE_HW_USER_ID) || 0)

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function request<T>(endpoint: string, payload: any, retryWithProxy = true): Promise<T> {
  const token = await ensureHardwareToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 首选直连云平台
  const primaryUrl = `${CLOUD_API_BASE}${endpoint}`
  try {
    const res = await fetch(primaryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    const json = await res.json()
    if (json.code !== 200) {
      throw new Error(json.msg || `API code ${json.code}`)
    }
    return json.data as T
  } catch (err) {
    if (retryWithProxy) {
      const fallbackUrl = `${PROXY_API_BASE}${endpoint}`
      try {
        const res2 = await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
        if (res2.ok) {
          const json2 = await res2.json()
          if (json2.code === 200) return json2.data as T
        }
      } catch {
        // proxy also failed
      }
    }
    throw err
  }
}

/**
 * 确保获取有效的硬件云平台 JWT Bearer Token
 */
export async function ensureHardwareToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && tokenExpiresAt > now + 60_000) {
    return cachedToken
  }

  // 尝试从 localStorage 读取已缓存的 token
  const storedToken = localStorage.getItem('anqiao_hw_token')
  const storedExp = Number(localStorage.getItem('anqiao_hw_token_exp') ?? 0)
  if (storedToken && storedExp > now + 60_000) {
    cachedToken = storedToken
    tokenExpiresAt = storedExp
    return storedToken
  }

  // 发起登录获取 Token
  if (DEFAULT_ACCOUNT && DEFAULT_PASS) {
    try {
      let res = await fetch(`${CLOUD_API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: DEFAULT_ACCOUNT, password: DEFAULT_PASS }),
      }).catch(() => null)
      if (!res || !res.ok) {
        res = await fetch(`${PROXY_API_BASE}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: DEFAULT_ACCOUNT, password: DEFAULT_PASS }),
        }).catch(() => null)
      }
      if (res && res.ok) {
        const json = await res.json()
        if (json.code === 200 && json.data?.access_token) {
          const tok = String(json.data.access_token)
          cachedToken = tok
          // 令牌有效期为 365 天，此处保留 300 天安全期
          tokenExpiresAt = now + 300 * 86400 * 1000
          localStorage.setItem('anqiao_hw_token', tok)
          localStorage.setItem('anqiao_hw_token_exp', String(tokenExpiresAt))
          return tok
        }
      }
    } catch (e) {
      console.warn('[hardwareApi] Login failed, trying fallback:', e)
    }
  }

  // 备用长期 Token
  if (ENV_FALLBACK_TOKEN) {
    cachedToken = ENV_FALLBACK_TOKEN
    tokenExpiresAt = now + 180 * 86400 * 1000
    return cachedToken
  }

  console.warn('[hardwareApi] 无可用硬件凭据，硬件接口请求将失败')
  throw new Error('[hardwareApi] missing hardware credentials')
}

/**
 * 获取硬件在册设备列表（原始响应）：供云端扫描等场景自行做字段名容错合并
 */
export async function getHardwareDeviceListRaw(userId: number = DEFAULT_USER_ID): Promise<Record<string, unknown>> {
  return await request<Record<string, unknown>>('/api/v1/device/list', { user_id: userId })
}

/**
 * 获取硬件在册设备列表
 */
export async function getHardwareDeviceList(userId: number = DEFAULT_USER_ID): Promise<HardwareDevice[]> {
  const data = await request<{
    healthDevice_List: HardwareDevice[]
    fallDevice_List: HardwareDevice[]
    healthDeviceBed_List: HardwareDevice[]
  }>('/api/v1/device/list', { user_id: userId })
  return [...(data.healthDevice_List || []), ...(data.fallDevice_List || []), ...(data.healthDeviceBed_List || [])]
}

/**
 * 获取指定 AI健康守护仪 的最新一条实时遥测数据
 * （归一化 isBed/body_movement：云端可能回 0/1、"0"/"1"、true/false，统一成 boolean/number）
 */
export async function getLatestHardwareData(deviceId: string): Promise<LatestHardwareData> {
  const raw = await request<Record<string, unknown>>('/api/v1/hardware/latest_data', { device_id: deviceId })
  return normalizeLatestHardwareData(raw)
}

export function toBoolFlag(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

export function normalizeLatestHardwareData(raw: Record<string, unknown> | null | undefined): LatestHardwareData {
  const r = raw || {}
  return {
    device_id: String(r.device_id ?? ''),
    account: String(r.account ?? ''),
    hr: Number(r.hr) || 0,
    br: Number(r.br) || 0,
    tp: Number(r.tp) || 0,
    isBed: toBoolFlag(r.isBed ?? r.is_bed),
    body_movement: Number(r.body_movement) || 0,
    sleepReport: (r.sleepReport ?? r.sleep_report ?? null) as any,
    created_at: String(r.created_at ?? ''),
  }
}

export interface HardwareStatusItem {
  device_name: string   // 设备 SN
  device_status: string // 'UNACTIVE' 未激活 / 'ONLINE' 在线 / 'OFFLINE' 离线
  smbd_flag: string     // '1' 有人 / '2' 无人 / '3' 初始化学习中
}

/**
 * 获取硬件设备权威在线/在场状态（一次拉全量，按 device_name 自行映射）
 * 注意：该接口名义上面向跌倒设备，健康守护仪 SN 是否出现在响应中需运行时验证，
 * 调用方必须保留 latest_data 回退链，不得因列表缺失而误判离线。
 */
export async function getHardwareDeviceStatus(): Promise<HardwareStatusItem[]> {
  const data = await request<HardwareStatusItem[] | { list?: HardwareStatusItem[] }>(
    '/api/v1/hardware/status',
    { page_size: 200, page_current: 1 },
  )
  if (Array.isArray(data)) return data
  return data?.list ?? []
}

/**
 * 获取指定设备的今日连续生理数据
 */
export async function getTodayRawData(deviceId: string): Promise<TodayRawDataPoint[]> {
  return await request<TodayRawDataPoint[]>('/api/v1/hardware/today_data', { device_id: deviceId })
}

/**
 * 获取指定设备特定日期的夜间时段（当日 20:00 至次日 08:00）连续硬件数据。
 * date 口径与云平台一致：夜窗结束（早晨）所在日期，YYYY-MM-DD。
 * 云平台在该夜无数据时返回 data:{}，此处统一归一为 []。
 */
export async function getDailyRawData(deviceId: string, date: string): Promise<TodayRawDataPoint[]> {
  const data = await request<TodayRawDataPoint[]>('/api/v1/hardware/daily_data', {
    device_id: deviceId,
    date,
  })
  return Array.isArray(data) ? data : []
}

/**
 * 获取指定设备的特定日期睡眠统计
 */
export async function getSleepStats(deviceId: string, date?: string): Promise<SleepStatsResult> {
  const targetDate = date || new Date().toISOString().slice(0, 10)
  return await request<SleepStatsResult>('/api/v1/hardware/sleep_stats', {
    device_id: deviceId,
    date: targetDate,
  })
}

/**
 * 获取指定设备有睡眠报告的历史日期列表
 */
export async function getReportDates(deviceId: string): Promise<string[]> {
  const dates = await request<string[]>('/api/v1/hardware/report_dates', { device_id: deviceId })
  return Array.isArray(dates) ? dates : []
}

/**
 * 获取云平台告警列表
 */
export async function getHardwareAlarms(userId: number = DEFAULT_USER_ID, page = 1, pageSize = 20): Promise<{ items: HardwareAlarm[]; total: number }> {
  const res = await request<{ items: HardwareAlarm[]; total: number }>('/api/v1/alarm/list', {
    user_id: userId,
    page,
    page_size: pageSize,
  })
  return res || { items: [], total: 0 }
}

/**
 * 将今日上万条原生采样点聚合为 24 小时微动节律时序（用于大屏 24h 曲线）
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

  // 统计每小时均值与体动频次
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

    // 体动事件检测：0->1 上升沿视为一次离散体动发生
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

  // 生成聚合输出
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
