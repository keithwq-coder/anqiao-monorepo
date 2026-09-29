// 硬件云只读代理 —— 上游以《AI 健康守护仪对接API（V1.0）》为准。
// Base URL：https://api.health-track.anqiaokj.com（文档 2.2）
// 浏览器不直连硬件云。
//
// 2.8 硬件数据查询（2.8.2–2.8.6）请求体只有 device_id（夜间接口另加 date）。
// 账号/密码属于 2.4.2 用户登录，不是 2.8 的入参，代理不得要求 HW_ACCOUNT / HW_PASSWORD。
// 2.8.1 upload 是设备上报，本代理不转发写接口。

const DEFAULT_BASE = process.env.HW_API_BASE || 'https://api.health-track.anqiaokj.com'

export async function hardwarePost(endpoint, payload) {
  const res = await fetch(`${DEFAULT_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

/** 2.5.1 获取设备列表。请求体必填 user_id。 */
export async function getDeviceList(userId) {
  return hardwarePost('/api/v1/device/list', { user_id: Number(userId) })
}

/** 2.8.2 获取最新一条数据。请求体必填 device_id。 */
export async function getLatestData(deviceId) {
  return hardwarePost('/api/v1/hardware/latest_data', { device_id: deviceId })
}

/** 2.8.3 获取夜间数据（晚 20:00 至次日早 08:00）。请求体必填 date、device_id。 */
export async function getDailyData(deviceId, date) {
  return hardwarePost('/api/v1/hardware/daily_data', {
    device_id: deviceId,
    date: date || new Date().toISOString().slice(0, 10),
  })
}

/** 2.8.4 获取今日数据。请求体必填 device_id。 */
export async function getTodayData(deviceId) {
  return hardwarePost('/api/v1/hardware/today_data', { device_id: deviceId })
}

/** 2.8.5 获取睡眠数据统计。请求体必填 device_id；date 为夜间窗结束日。 */
export async function getSleepStats(deviceId, date) {
  return hardwarePost('/api/v1/hardware/sleep_stats', {
    device_id: deviceId,
    date: date || new Date().toISOString().slice(0, 10),
  })
}

/** 2.8.6 查询有睡眠报告的日期列表。请求体必填 device_id。 */
export async function getReportDates(deviceId) {
  return hardwarePost('/api/v1/hardware/report_dates', { device_id: deviceId })
}

/**
 * 2.7.4 获取报警记录列表。
 * 请求体：device_id 可选（不传则查询所有）、status 可选、page 必填、page_size 必填。
 */
export async function getAlarms(deviceId, page = 1, pageSize = 20, status) {
  const payload = { page, page_size: pageSize }
  if (deviceId) payload.device_id = deviceId
  if (status) payload.status = status
  return hardwarePost('/api/v1/alarm/list', payload)
}
