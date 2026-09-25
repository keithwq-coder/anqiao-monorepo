/**
 * 中科安樵在册真实设备 · 全局实时遥测轮询共享存储
 * 数据源：安樵云平台 latest_data + hardware/status（smbd_flag 有人/无人）。
 *
 * 三态判定口径：
 *   在床（person）—— 有 ≤120s 新鲜样本，且（isBed 为真 或 hr>0 或 br>0）
 *                     优先合并 status.smbd_flag：'1' 有人 → 在床
 *   离床（empty） —— 有 ≤120s 新鲜样本，但不在床（空床/无人心跳包）
 *   离线（null） —— 无 ≤120s 新鲜样本，或拉取失败
 *
 * 注意：isBed 必须按 0/1/"1"/true 归一化，禁止 `=== true`（云端常见整型 1）。
 */

import { reactive } from 'vue'
import { ANQIAO_DEVICES, getAnqiaoDevice } from '../assets/anqiaoDevices'
import {
  getLatestHardwareData,
  getHardwareDeviceStatus,
  toBoolFlag,
  type LatestHardwareData,
} from './hardwareApi'

export interface DeviceTelemetryEntry {
  sn: string
  data: LatestHardwareData | null
  fetchedAt: number // 本地最近一次拉取时刻（ms）
  error: boolean    // 最近一次拉取是否失败
  errorMsg?: string // 错误原因（如"未绑定该设备/设备不存在"）
  /** 云端 status.smbd_flag：'1' 有人 / '2' 无人 / '3' 学习中；未知为 null */
  smbdFlag?: string | null
}

export const deviceTelemetry = reactive<Record<string, DeviceTelemetryEntry>>({})

// 实测设备原生上报周期约 55~60s，实时窗口取 120s（覆盖 2 个上报周期的网络抖动）
export const LIVE_WINDOW_MS = 120 * 1000

// created_at 形如 '2026-09-22 17:23:40' 或 ISO；无时区时按本地时间解析
export function sampleMs(createdAt?: string | null): number {
  if (!createdAt) return 0
  const t = new Date(String(createdAt).replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : 0
}

export type TelemetryFreshness = 'live' | 'none'

export function freshnessOf(sn: string | undefined | null): TelemetryFreshness {
  if (!sn) return 'none'
  const e = deviceTelemetry[sn]
  if (!e || e.error || !e.data) return 'none'
  const ms = sampleMs(e.data.created_at)
  if (!ms) return 'none'
  return Math.abs(Date.now() - ms) <= LIVE_WINDOW_MS ? 'live' : 'none'
}

export type DevicePresence = 'person' | 'empty'

// 在床判定：样本 isBed / 有效体征优先；smbd_flag='1' 作补充（体征全 0 但云端标有人）
function sampleLooksInBed(d: LatestHardwareData, smbdFlag?: string | null): boolean {
  if (toBoolFlag(d.isBed) || d.hr > 0 || d.br > 0) return true
  return smbdFlag === '1'
}

export function presenceOf(sn: string | undefined | null): DevicePresence | null {
  if (!sn) return null
  const dev = getAnqiaoDevice(sn)
  if (!dev) return null

  const entry = deviceTelemetry[sn]
  if (!entry || entry.error || !entry.data) {
    return null
  }

  if (freshnessOf(sn) === 'live') {
    return sampleLooksInBed(entry.data, entry.smbdFlag) ? 'person' : 'empty'
  }

  return null
}

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

/**
 * 离线时的说明文案：区分「从未取到样本」与「有样本但采样超时」。
 * 评估师需要知道最后体征时刻，而不是只看到一个「离线」。
 */
export function offlineReason(sn: string | undefined | null): string {
  if (!sn) return '无实时数据'
  const e = deviceTelemetry[sn]
  if (!e || e.error || !e.data) return '暂无实时数据'
  const t = lastSampleTime(sn)
  const short = t ? t.slice(11, 16) : ''
  const inBed = sampleLooksInBed(e.data, e.smbdFlag)
  const tail = inBed ? '在床体征' : '空床样本'
  return short ? `采样超时 · 最后 ${short} ${tail}` : `采样超时 · 有历史${tail}`
}

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
  message: '设备守护服务通信中',
})

let pollTimer = 0
let started = false

async function refreshSmbdFlags(): Promise<void> {
  try {
    const list = await getHardwareDeviceStatus()
    for (const item of list) {
      const sn = item.device_name
      if (!sn || !deviceTelemetry[sn]) continue
      deviceTelemetry[sn].smbdFlag = item.smbd_flag ?? null
    }
  } catch {
    // status 接口不可用时保持 smbdFlag 原值，由 latest_data 回退判定
  }
}

async function pollAllDevices(): Promise<void> {
  let succ = 0
  let err = 0
  await Promise.allSettled([
    ...ANQIAO_DEVICES.map(async (d) => {
      try {
        const data = await getLatestHardwareData(d.sn)
        const prev = deviceTelemetry[d.sn]
        deviceTelemetry[d.sn] = {
          sn: d.sn,
          data,
          fetchedAt: Date.now(),
          error: false,
          smbdFlag: prev?.smbdFlag ?? null,
        }
        succ++
      } catch (e: any) {
        const prev = deviceTelemetry[d.sn]
        deviceTelemetry[d.sn] = {
          sn: d.sn,
          data: null,
          fetchedAt: Date.now(),
          error: true,
          errorMsg: e?.message || '请求失败',
          smbdFlag: prev?.smbdFlag ?? null,
        }
        err++
      }
    }),
    refreshSmbdFlags(),
  ])
  cloudGatewayHealth.totalChecked = ANQIAO_DEVICES.length
  cloudGatewayHealth.successCount = succ
  cloudGatewayHealth.errorCount = err
  cloudGatewayHealth.lastCheckedAt = Date.now()
  const total = ANQIAO_DEVICES.length
  if (succ === 0 && err > 0) {
    cloudGatewayHealth.healthy = false
    cloudGatewayHealth.message = '云端连接暂时中断 · 正在自动重连'
  } else {
    cloudGatewayHealth.healthy = true
    cloudGatewayHealth.message = succ >= total
      ? `云端链路正常 · 回传 ${succ}/${total}`
      : `云端回传 ${succ}/${total} · ${err} 路异常`
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