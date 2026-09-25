/**
 * 云端设备扫描：遍历云账号 user_id 1~250 拉取全部绑定设备（/api/v1/device/list），
 * 与本地台账（ANQIAO_DEVICES，首批试点 3 台）比对，发现"云平台存在但未接入看板"的漏接设备。
 * 在线判定复用遥测 store 的 sampleMs/LIVE_WINDOW_MS（≤120s 口径，与三态判定一致）。
 * 红线：扫描结果仅作展示比对，绝不写回本地台账——在册设备恒为试点 3 台（用户拍板）。
 */

import { getAnqiaoDevice } from '../assets/anqiaoDevices'
import { getHardwareDeviceListRaw, type HardwareDevice } from './hardwareApi'
import { LIVE_WINDOW_MS, sampleMs } from './deviceTelemetry'

export interface CloudScanItem {
  userId: number     // 设备绑定的云账号 ID
  deviceId: string
  alias: string
  category: string
  latestDataTime: string
  registered: boolean // 是否在 ANQIAO_DEVICES 本地台账中
  online: boolean     // latestDataTime 距今 ≤90s（含时钟偏差兜底）
}

export interface CloudScanResult {
  items: CloudScanItem[]
  accountsScanned: number // 成功拉取到设备列表的账号数（404/无设备/报错的账号跳过不计失败）
}

// device_category 中文映射（未知类型原样显示）
export const DEVICE_CATEGORY_NAMES: Record<string, string> = {
  health_guardian: 'AI健康守护仪',
  fall_detector: '跌倒报警器',
  health_monitor: '健康监测仪',
  unknown: '未知类型',
}

// 响应列表字段名双形态容错：实现文档为 healthDevice_List / fallDevice_List / healthDeviceBed_List，
// schema 文档为 health_guardian_List / fall_detector_List / health_monitor_List 等，全部尝试合并去重
const LIST_KEYS = [
  'healthDevice_List',
  'fallDevice_List',
  'healthDeviceBed_List',
  'health_guardian_List',
  'fall_detector_List',
  'health_monitor_List',
  'healthGuardian_List',
  'fallDetector_List',
  'healthMonitor_List',
  'list',
  'devices',
]

const SCAN_USER_MIN = 1
const SCAN_USER_MAX = 250
const SCAN_CONCURRENCY = 10

function extractDevices(raw: Record<string, unknown>): HardwareDevice[] {
  const seen = new Set<string>()
  const devices: HardwareDevice[] = []
  const pushAll = (arr: unknown) => {
    if (!Array.isArray(arr)) return
    for (const it of arr as HardwareDevice[]) {
      if (it && it.device_id && !seen.has(it.device_id)) {
        seen.add(it.device_id)
        devices.push(it)
      }
    }
  }
  if (Array.isArray(raw)) pushAll(raw)
  else for (const key of LIST_KEYS) pushAll(raw[key])
  return devices
}

/**
 * 全账号扫描：遍历 user_id 1~250（并发池限流 10），单账号失败跳过；
 * 仅当全部账号都失败时才抛错。onProgress 报告已扫描账号数（成功+失败）。
 */
export async function scanCloudDevices(
  onProgress?: (scanned: number, total: number) => void,
): Promise<CloudScanResult> {
  const userIds: number[] = []
  for (let id = SCAN_USER_MIN; id <= SCAN_USER_MAX; id++) userIds.push(id)
  const total = userIds.length

  let scanned = 0
  let succeeded = 0
  // 按账号收集（保持 userId 升序，设备去重时"保留首个"即最小账号）
  const byUser: { userId: number; devices: HardwareDevice[] }[] = []

  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < userIds.length) {
      const userId = userIds[cursor++]
      try {
        const raw = await getHardwareDeviceListRaw(userId)
        byUser.push({ userId, devices: extractDevices(raw) })
        succeeded++
      } catch {
        // 单个账号 404/无设备/报错：跳过不计失败
      } finally {
        scanned++
        onProgress?.(scanned, total)
      }
    }
  }
  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, () => worker()))

  if (succeeded === 0) {
    throw new Error('云端设备清单暂不可用，请稍后重试')
  }

  // 汇总：同一设备多账号绑定时保留最小账号（按 userId 升序遍历即"保留首个"）
  byUser.sort((a, b) => a.userId - b.userId)
  const seenDevice = new Set<string>()
  const now = Date.now()
  const items: CloudScanItem[] = []
  for (const { userId, devices } of byUser) {
    for (const d of devices) {
      if (seenDevice.has(d.device_id)) continue
      seenDevice.add(d.device_id)
      const ms = sampleMs(d.latest_data_time)
      // 仅展示比对：是否已接入本地试点台账（3 台）；不写回台账
      items.push({
        userId,
        deviceId: d.device_id,
        alias: d.device_alias ?? '',
        category: d.device_category ?? '',
        latestDataTime: d.latest_data_time ?? '',
        registered: !!getAnqiaoDevice(d.device_id),
        online: ms > 0 && Math.abs(now - ms) <= LIVE_WINDOW_MS,
      })
    }
  }

  // 未接入优先 → 在线优先 → userId 升序
  items.sort((a, b) =>
    Number(a.registered) - Number(b.registered)
    || Number(b.online) - Number(a.online)
    || a.userId - b.userId,
  )
  return { items, accountsScanned: succeeded }
}

