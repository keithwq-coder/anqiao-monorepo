// 硬件云服务端代理（API-CONTRACT §3.5 / §5）
// 凭据仅存服务端 env：HW_API_BASE / HW_ACCOUNT / HW_PASSWORD / HW_TOKEN / HW_USER_ID
// 浏览器不直连硬件云、不持有硬件云口令或长期 JWT。

const DEFAULT_BASE = process.env.HW_API_BASE || 'https://api.health-track.anqiaokj.com'

let cachedToken = ''
let tokenExpiresAt = 0

export function hardwareConfigured() {
  return !!(process.env.HW_TOKEN || (process.env.HW_ACCOUNT && process.env.HW_PASSWORD))
}

export function defaultUserId() {
  return Number(process.env.HW_USER_ID || 55)
}

async function ensureToken() {
  if (process.env.HW_TOKEN) return process.env.HW_TOKEN
  const now = Date.now()
  if (cachedToken && tokenExpiresAt > now + 60_000) return cachedToken
  if (!process.env.HW_ACCOUNT || !process.env.HW_PASSWORD) {
    const err = new Error('硬件云凭据未注入（HW_ACCOUNT/HW_PASSWORD 或 HW_TOKEN）')
    err.status = 503
    throw err
  }
  const res = await fetch(`${DEFAULT_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: process.env.HW_ACCOUNT, password: process.env.HW_PASSWORD }),
  })
  if (!res.ok) {
    const err = new Error(`硬件云登录失败 HTTP ${res.status}`)
    err.status = 502
    throw err
  }
  const json = await res.json()
  const token = json?.data?.access_token
  if (!token) {
    const err = new Error(json?.msg || '硬件云登录未返回 access_token')
    err.status = 502
    throw err
  }
  cachedToken = String(token)
  tokenExpiresAt = now + 300 * 86400 * 1000
  return cachedToken
}

export async function hardwarePost(endpoint, payload) {
  if (!hardwareConfigured()) {
    const err = new Error('硬件云凭据未注入，代理不可用（禁止静默 mock）')
    err.status = 503
    throw err
  }
  const token = await ensureToken()
  const res = await fetch(`${DEFAULT_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  })
  if (!res.ok) {
    const err = new Error(`硬件云请求失败 HTTP ${res.status}`)
    err.status = 502
    throw err
  }
  const json = await res.json()
  if (json.code !== 200) {
    const err = new Error(json.msg || `硬件云 code ${json.code}`)
    err.status = 502
    throw err
  }
  return json.data
}

export async function getDeviceList(userId) {
  return hardwarePost('/api/v1/device/list', { user_id: Number(userId || defaultUserId()) })
}

export async function getDeviceStatus(pageSize = 200, pageCurrent = 1) {
  return hardwarePost('/api/v1/hardware/status', { page_size: pageSize, page_current: pageCurrent })
}

export async function getLatestData(deviceId) {
  return hardwarePost('/api/v1/hardware/latest_data', { device_id: deviceId })
}

export async function getTodayData(deviceId) {
  return hardwarePost('/api/v1/hardware/today_data', { device_id: deviceId })
}

export async function getSleepStats(deviceId, date) {
  return hardwarePost('/api/v1/hardware/sleep_stats', {
    device_id: deviceId,
    date: date || new Date().toISOString().slice(0, 10),
  })
}

export async function getReportDates(deviceId) {
  return hardwarePost('/api/v1/hardware/report_dates', { device_id: deviceId })
}

export async function getAlarms(userId, page = 1, pageSize = 20) {
  return hardwarePost('/api/v1/alarm/list', {
    user_id: Number(userId || defaultUserId()),
    page,
    page_size: pageSize,
  })
}
