// 控制台共享展示语义：类型/级别/状态文案 + SLA 响应计时
import type { Alert, AlertStatus } from '../../api/types'

export const TYPE_LABELS: Record<Alert['type'], string> = {
  fall: '跌倒预警',
  off_bed: '离床预警',
  hr: '心率提醒',
  br: '呼吸提醒',
  tp: '体温提醒',
  device_offline: '设备离线',
  device_data: '数据中断',
}

export const LEVEL_LABELS: Record<Alert['level'], string> = { 1: '紧急', 2: '中危', 3: '关注' }

export const STATUS_LABELS: Record<AlertStatus, string> = {
  triggered: '待响应',
  handling: '处理中',
  handled: '已闭环',
  missed: '已超时',
}

// SLA 目标响应时间（分钟）：1 级 3 分钟 / 2 级 10 分钟 / 3 级 30 分钟
export const SLA_TARGET_MIN: Record<Alert['level'], number> = { 1: 3, 2: 10, 3: 30 }

export function slaElapsedMs(a: Alert, now: number): number {
  return Math.max(0, now - Date.parse(a.occurred_at))
}

export function slaOverdue(a: Alert, now: number): boolean {
  return slaElapsedMs(a, now) > SLA_TARGET_MIN[a.level] * 60_000
}

export function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}时${String(m).padStart(2, '0')}分`
  if (m > 0) return `${m}分${String(s).padStart(2, '0')}秒`
  return `${s}秒`
}

export function fmtTime(iso: string): string {
  return iso.slice(5, 16).replace('T', ' ')
}

export function fmtDay(iso: string): string {
  return iso.slice(0, 10)
}
