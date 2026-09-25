// SaaS 切片 WebSocket 实时通道（契约 §4）：
// 连接 (ws 协议)//host/v1/ws?token=...（走 vite proxy），断线指数退避自动重连，
// 重连成功后派发 'reconnected' 事件，由各视图重新拉一次 REST 全量补偿。
import { getToken, wsBase } from './http'
import type { Alert, Overview, VitalsEvent } from './types'

export interface RealtimeEventMap {
  vitals: VitalsEvent
  alert: Alert
  overview: Overview
  open: null
  close: null
  reconnected: null
}

type Handler<T> = (data: T) => void

const handlers = new Map<keyof RealtimeEventMap, Set<Handler<never>>>()

let ws: WebSocket | null = null
let started = false
let retry = 0
let reconnectTimer: number | null = null

function emit<K extends keyof RealtimeEventMap>(event: K, data: RealtimeEventMap[K]) {
  const set = handlers.get(event)
  if (!set) return
  for (const h of set) (h as Handler<RealtimeEventMap[K]>)(data)
}

export function onRealtime<K extends keyof RealtimeEventMap>(
  event: K,
  handler: Handler<RealtimeEventMap[K]>,
): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set())
  const set = handlers.get(event)!
  set.add(handler as Handler<never>)
  return () => set.delete(handler as Handler<never>)
}

function scheduleReconnect() {
  if (!started || reconnectTimer !== null) return
  const delay = Math.min(30_000, 1000 * 2 ** retry)
  retry += 1
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

function connect() {
  const token = getToken()
  if (!token || !started) return
  const socket = new WebSocket(`${wsBase()}/v1/ws?token=${encodeURIComponent(token)}`)
  ws = socket

  socket.onopen = () => {
    const wasRetry = retry > 0
    retry = 0
    emit('open', null)
    if (wasRetry) emit('reconnected', null) // 断线重连成功：视图层拉 REST 全量补偿
  }
  socket.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data as string) as { event: keyof RealtimeEventMap; data: unknown }
      emit(m.event, m.data as never)
    } catch {
      // 忽略无法解析的帧
    }
  }
  socket.onclose = () => {
    if (ws === socket) ws = null
    emit('close', null)
    scheduleReconnect()
  }
  socket.onerror = () => {
    socket.close()
  }
}

export function startRealtime() {
  if (started) return
  started = true
  retry = 0
  connect()
}

export function stopRealtime() {
  started = false
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  ws?.close()
  ws = null
}
