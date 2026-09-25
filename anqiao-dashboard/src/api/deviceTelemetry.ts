/**
 * 中科安樵全量在册真实设备 · 全局实时遥测轮询共享存储
 * 数据源：业务后端 /v1/hardware/latest（服务端持有硬件云凭据，API-CONTRACT §3.5）。
 *
 * 三态判定口径（用户拍板，完全由 latest_data 最新样本驱动，LIVE_WINDOW_MS=90s）：
 *   在床（person）—— 有 ≤90s 新鲜样本，且含有效体征（hr>0 || br>0 || isBed===true）→ "● 设备在线 · 在床"
 *   离床（empty） —— 有 ≤90s 新鲜样本，但无有效体征（全 0/不在床）。设备无人时会持续上传空数据，
 *             空数据本身就是在线的证据 → "● 设备在线 · 离床"（真实 0 值如实上屏）
 *   离线（null） —— 没有任何 ≤90s 新鲜样本 → "○ 设备离线 · 无实时回传"，不展示任何体征数值与采样时间
 *
 * freshnessOf 即"是否有 ≤90s 新鲜样本"，是在线判定的唯一依据，也决定能否展示样本数值/采样时间。
 * 在线 = presenceOf 返回 person 或 empty；离线 = null。
 */

import { reactive } from 'vue'
import { ANQIAO_DEVICES, getAnqiaoDevice } from '../projects'
import { getLatestHardwareData, type LatestHardwareData } from './hardwareApi'

export interface DeviceTelemetryEntry {
  sn: string
  data: LatestHardwareData | null
  fetchedAt: number // 本地最近一次拉取时刻（ms）
  error: boolean    // 最近一次拉取是否失败
  errorMsg?: string // 错误原因（如"未绑定该设备/设备不存在"）
}

export const deviceTelemetry = reactive<Record<string, DeviceTelemetryEntry>>({})

// 实测设备原生上报周期约 55~60s，实时窗口取 120s（覆盖2个上报周期的网络抖动）
export const LIVE_WINDOW_MS = 120 * 1000

// created_at 形如 '2026-09-22 17:23:40' 或 ISO；无时区时按本地时间解析
export function sampleMs(createdAt?: string | null): number {
  if (!createdAt) return 0
  const t = new Date(String(createdAt).replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : 0
}

export type TelemetryFreshness = 'live' | 'none'

// 是否有 ≤120s 新鲜体征数据包：决定能否展示实时高频体征数值
export function freshnessOf(sn: string | undefined | null): TelemetryFreshness {
  if (!sn) return 'none'
  const e = deviceTelemetry[sn]
  if (!e || e.error || !e.data) return 'none'
  const ms = sampleMs(e.data.created_at)
  if (!ms) return 'none'
  // Math.abs 兜底设备/云端时钟偏差（采样时间略在未来也算 live）
  return Math.abs(Date.now() - ms) <= LIVE_WINDOW_MS ? 'live' : 'none'
}

export type DevicePresence = 'person' | 'empty'

// 核心三态判定（严格按真实数据驱动，绝不模拟，绝不降级掩盖异常）：
//   'person' —— 在线且在床：成功获取 ≤120s 新鲜样本且含有效体征（hr>0 || br>0 || isBed===true）
//   'empty'  —— 在线且离床：成功获取 ≤120s 新鲜样本且属于空床/微动为0/离床心跳包
//   null     —— 离线/失联：API请求失败、网络超时、或样本已超 120s 无更新
export function presenceOf(sn: string | undefined | null): DevicePresence | null {
  if (!sn) return null
  const dev = getAnqiaoDevice(sn)
  if (!dev) return null

  const entry = deviceTelemetry[sn]
  // 1. 如果尚未拉取过，或者拉取报错（云端接口不通/网络错误/无此设备），如实暴露问题：离线！
  if (!entry || entry.error || !entry.data) {
    return null
  }

  // 2. 检查采样时间新鲜度：仅当存在新鲜数据（≤120s）时才判定为在线
  if (freshnessOf(sn) === 'live') {
    const d = entry.data
    // 真实在床：心率>0 或 呼吸>0 或 isBed为真
    if (d && (d.hr > 0 || d.br > 0 || d.isBed === true)) {
      return 'person'
    }
    // 真实在线离床：有新鲜数据包回传，但处于空床/无人状态
    return 'empty'
  }

  // 3. 超过 120s 无新鲜数据回传 -> 如实判定为离线！
  return null
}

// 在线 = presenceOf 返回 person 或 empty（在床与离床均是在线）；非在册或失联为 null
export function isOnline(sn: string | undefined | null): boolean {
  return presenceOf(sn) !== null
}

export function lastSampleTime(sn: string | undefined | null): string {
  if (!sn) return ''
  const e = deviceTelemetry[sn]
  if (e?.data?.created_at) {
    return String(e.data.created_at).replace('T', ' ').slice(0, 19)
  }
  return ''
}

// 实时在线台数（在床/离床均计在线）
export function liveDeviceCount(): number {
  return ANQIAO_DEVICES.filter((d) => isOnline(d.sn)).length
}

export interface CloudGatewayHealth {
  healthy: boolean
  totalChecked: number
  successCount: number
  errorCount: number
  lastCheckedAt: number
  message: string
}

export const cloudGatewayHealth = reactive<CloudGatewayHealth>({
  healthy: true,
  totalChecked: 0,
  successCount: 0,
  errorCount: 0,
  lastCheckedAt: 0,
  message: '华为云 IoTDA 专网遥测通信中',
})

let pollTimer = 0
let started = false

async function pollAllDevices(): Promise<void> {
  let succ = 0
  let err = 0
  await Promise.allSettled(
    ANQIAO_DEVICES.map(async (d) => {
      try {
        const data = await getLatestHardwareData(d.sn)
        deviceTelemetry[d.sn] = { sn: d.sn, data, fetchedAt: Date.now(), error: false }
        succ++
      } catch (e: any) {
        deviceTelemetry[d.sn] = {
          sn: d.sn,
          data: null,
          fetchedAt: Date.now(),
          error: true,
          errorMsg: e?.message || '请求失败',
        }
        err++
      }
    }),
  )
  cloudGatewayHealth.totalChecked = ANQIAO_DEVICES.length
  cloudGatewayHealth.successCount = succ
  cloudGatewayHealth.errorCount = err
  cloudGatewayHealth.lastCheckedAt = Date.now()
  if (succ === 0 && err > 0) {
    cloudGatewayHealth.healthy = false
    cloudGatewayHealth.message = '硬件遥测接口无响应（业务后端 /v1/hardware/latest 超时或未注入 HW_*）'
  } else {
    cloudGatewayHealth.healthy = true
    cloudGatewayHealth.message = `华为云 IoTDA 直连正常 · ${succ}台云端建档`
  }
}

export function startDeviceTelemetryPolling(intervalMs = 5_000): void {
  if (started) return
  started = true
  void pollAllDevices()
  pollTimer = window.setInterval(() => { void pollAllDevices() }, intervalMs)
}

export function stopDeviceTelemetryPolling(): void {
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = 0
  started = false
}
