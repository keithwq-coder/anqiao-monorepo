// SaaS 切片 fetch 封装：统一响应包解包、Bearer 令牌携带、401 跳登录
import type { LoginResponse } from './types'

const TOKEN_KEY = 'anqiao_saas_token'
const SESSION_KEY = 'anqiao_saas_session'

export interface SessionInfo {
  staff: LoginResponse['staff']
  tenant: LoginResponse['tenant']
}

export class ApiError extends Error {
  code: number
  constructor(code: number, msg: string) {
    super(msg)
    this.code = code
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSession(): SessionInfo | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw || !getToken()) return null
  try {
    return JSON.parse(raw) as SessionInfo
  } catch {
    return null
  }
}

export function setSession(token: string, session: SessionInfo): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

const SCREEN_USER_KEY = 'anqiao_saas_screen_user'

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SCREEN_USER_KEY)
}

// 空 baseURL 时走同源相对路径（本地 vite proxy /v1 -> 8080；生产经 nginx 同域反代）
const BASE = import.meta.env.VITE_API_BASE ?? ''

// REST 与 WS 共用的 base 收敛点
export function apiBase(): string {
  return BASE
}

// WS base：吃同一份 VITE_API_BASE（如生产 /saas/api），协议随页面 http→ws / https→wss
export function wsBase(): string {
  if (/^https?:\/\//.test(BASE)) return BASE.replace(/^http/, 'ws')
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${BASE}`
}

// 静默大屏会话防抖承诺（多个并发请求共享同一个静默登录过程）
let silentAuthPromise: Promise<string | null> | null = null

/** 当前公屏租户：宿迁大屏 bureau_suqian，其余 anqiao。不携带口令。 */
export function getScreenTenant(): string {
  const isSuqian =
    (typeof location !== 'undefined' && (location.pathname.includes('suqian') || location.hash.includes('suqian'))) ||
    (typeof __VITE_PROJECT__ !== 'undefined' && __VITE_PROJECT__ === 'suqian')
  return isSuqian ? 'bureau_suqian' : 'anqiao'
}

function screenUsername(tenant: string): string {
  return tenant === 'bureau_suqian' ? 'sq' : 'gp'
}

/**
 * 电视墙/展厅一体机无人值守会话：POST /v1/auth/screen 换受限 screen_viewer 令牌。
 * 前端不再内嵌用户名/密码。
 */
export async function ensureScreenSession(force = false): Promise<string | null> {
  const tenant = getScreenTenant()
  const username = screenUsername(tenant)
  const currentToken = getToken()
  const currentScreenUser = localStorage.getItem(SCREEN_USER_KEY)

  if (!force && currentToken && currentScreenUser === username) {
    return currentToken
  }

  if (silentAuthPromise) return silentAuthPromise

  silentAuthPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/v1/auth/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Screen-Tenant': tenant,
        },
        body: JSON.stringify({ tenant }),
      })
      const body = await res.json()
      if (body.code === 200 && body.data?.token) {
        setSession(body.data.token, { staff: body.data.staff, tenant: body.data.tenant })
        localStorage.setItem(SCREEN_USER_KEY, username)
        return body.data.token as string
      } else {
        console.warn(`[screenSession] 公屏会话响应:`, body.msg)
      }
    } catch (err) {
      console.warn(`[screenSession] 公屏会话网络异常:`, err)
    } finally {
      silentAuthPromise = null
    }
    return null
  })()

  return silentAuthPromise
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Screen-Tenant': getScreenTenant(),
  }
  let token = getToken()
  const isAuthPath = path === '/v1/auth/login' || path === '/v1/auth/screen'
  if (!token && !isAuthPath) {
    token = await ensureScreenSession().catch(() => null)
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let resp: Response
  try {
    resp = await fetch(BASE + path, { ...init, headers })
  } catch {
    throw new ApiError(-1, '网络异常，请确认后端服务已启动')
  }

  let body: { code: number; msg: string; data: unknown }
  try {
    body = await resp.json()
  } catch {
    throw new ApiError(resp.status, `服务响应异常（HTTP ${resp.status}）`)
  }

  if (body.code === 401) {
    clearSession()
    if (retry && !isAuthPath) {
      const refreshedToken = await ensureScreenSession(true).catch(() => null)
      if (refreshedToken) {
        return request<T>(path, init, false)
      }
    }
    throw new ApiError(401, body.msg || '登录已过期，请重新登录')
  }
  if (body.code !== 200) {
    throw new ApiError(body.code, body.msg || `请求失败（${body.code}）`)
  }
  return body.data as T
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
}

