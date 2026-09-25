/**
 * IP 归属地估算模块（仅供展示辅助，非定位依据）。
 *
 * 合规口径（用户拍板）：
 *  - 仅作为「IP归属地（估算）」展示，绝不可当作真实部署地址；
 *  - 使用设备公网 IP 推断省/市/区县，标注估算；无法确认的级别留空，不编造；
 *  - 内网 / 明显无效 IP 一律不发送到公网，按「未解析」处理。
 *
 * 接口：优先 HTTPS 且浏览器 CORS 友好的 ipwho.is（lang=zh-CN 返回中文），
 *      失败时回退 ipapi.co。不引入任何第三方依赖（原生 fetch）。
 * 策略：模块级缓存 + 并发去重，相同 IP 只发一次公网请求；相同 IP 的设备共享结果。
 */

import { reactive } from 'vue'
import { ANQIAO_DEVICES } from '../projects'

export interface IpGeo {
  ip: string
  country: string
  region: string // 省 / 州（ipwho.is zh-CN 为中文，如「江苏省」）
  city: string
  district?: string // 区县（多数免费接口不提供，缺省为空，不编造）
  lat?: number
  lon?: number
  isp?: string
  source: 'ipwho.is' | 'ipapi.co'
}

// 是否为可发往公网查询的合法公网 IP（拦截内网/环回/保留/组播/非法格式）
export function isPublicIp(ip: string | undefined | null): boolean {
  const s = ip?.trim() ?? ''
  if (!s) return false

  if (s.includes(':')) {
    // IPv6
    if (!/^[0-9a-fA-F:]+$/.test(s)) return false
    const lower = s.toLowerCase()
    if (lower === '::' || lower === '::1') return false // 未指定 / 环回
    if (/^fe[89ab]/.test(lower)) return false // fe80::/10 链路本地
    if (/^f[cd]/.test(lower)) return false // fc00::/7 唯一本地
    if (/^ff/.test(lower)) return false // 组播
    return true
  }

  // IPv4
  const parts = s.split('.')
  if (parts.length !== 4) return false
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return false
    const n = Number(p)
    if (n < 0 || n > 255) return false
  }
  const a = Number(parts[0])
  const b = Number(parts[1])
  if (a === 0 || a === 10 || a === 127) return false // 0/8 · 私网 · 环回
  if (a === 100 && b >= 64 && b <= 127) return false // 100.64/10 CGNAT
  if (a === 169 && b === 254) return false // 169.254/16 链路本地
  if (a === 172 && b >= 16 && b <= 31) return false // 172.16/12 私网
  if (a === 192 && (b === 0 || b === 168)) return false // 192.0.0/24 保留 · 192.168/16 私网
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false // 198.18/15 基准测试 · 198.51.100/24 文档
  if (a === 203 && b === 0) return false // 203.0.113/24 文档
  if (a >= 224) return false // 224/4 组播 · 240/4 保留
  return true
}

function toNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

async function queryIpwho(ip: string): Promise<IpGeo | null> {
  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?lang=zh-CN`, {
    mode: 'cors',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`ipwho.is http ${res.status}`)
  const data: unknown = await res.json()
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  if (o.success === false) return null
  const region = str(o.region)
  const city = str(o.city)
  if (!region && !city) return null
  return {
    ip: str(o.ip) || ip,
    country: str(o.country),
    region,
    city,
    lat: toNumber(o.latitude),
    lon: toNumber(o.longitude),
    isp:
      o.connection && typeof o.connection === 'object'
        ? str((o.connection as Record<string, unknown>).isp) || undefined
        : undefined,
    source: 'ipwho.is',
  }
}

async function queryIpapi(ip: string): Promise<IpGeo | null> {
  const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    mode: 'cors',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`ipapi.co http ${res.status}`)
  const data: unknown = await res.json()
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  if (o.error) return null
  const region = str(o.region)
  const city = str(o.city)
  if (!region && !city) return null
  const district = str(o.district)
  return {
    ip: str(o.ip) || ip,
    country: str(o.country_name) || str(o.country),
    region,
    city,
    district: district || undefined,
    lat: toNumber(o.latitude),
    lon: toNumber(o.longitude),
    isp: str(o.org) || undefined,
    source: 'ipapi.co',
  }
}

// 单次公网查询：ipwho.is 优先，ipapi.co 兜底；两者均失败返回 null（未解析，静默不抛错）
async function fetchIpGeo(ip: string): Promise<IpGeo | null> {
  try {
    const geo = await queryIpwho(ip)
    if (geo) return geo
  } catch {
    // fallback
  }
  try {
    const geo = await queryIpapi(ip)
    if (geo) return geo
  } catch {
    // both failed
  }
  return null
}

// ======================= 模块级缓存 + 并发去重 =======================
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 小时
const MAX_CACHE = 200
interface CacheEntry {
  value: IpGeo | null
  ts: number
}
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<IpGeo | null>>()

function pruneCache(): void {
  if (cache.size <= MAX_CACHE) return
  const keys = [...cache.keys()]
  // 简单淘汰最旧的一半（模块为仪表板长期运行，容量极小，无需复杂 LRU）
  for (let i = 0; i < keys.length - MAX_CACHE; i++) {
    cache.delete(keys[i])
  }
}

// 按 IP 查询归属地（内网/无效 IP 直接返回 null，不触发公网请求）
export function getIpGeo(ip: string | undefined | null): Promise<IpGeo | null> {
  const s = ip?.trim() ?? ''
  if (!s || !isPublicIp(s)) return Promise.resolve(null)

  const hit = cache.get(s)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return Promise.resolve(hit.value)

  const pending = inflight.get(s)
  if (pending) return pending // 并发去重：相同 IP 只发一次请求

  const p = fetchIpGeo(s)
    .then((geo) => {
      cache.set(s, { value: geo, ts: Date.now() })
      pruneCache()
      return geo
    })
    .finally(() => {
      inflight.delete(s)
    })
  inflight.set(s, p)
  return p
}

// ======================= ANQIAO_DEVICES 运行时归属地解析（IP 相同共享结果） =======================
export type DeviceIpGeoStatus = 'pending' | 'resolved' | 'unresolved' | 'invalid'

export interface DeviceIpGeoEntry {
  ip: string
  status: DeviceIpGeoStatus
  geo: IpGeo | null
}

// 响应式共享存储：key=设备 SN；原始 address/lon/lat 字段保持不动，仅新增估算派生信息
export const deviceIpGeo = reactive<Record<string, DeviceIpGeoEntry>>({})

export function deviceIpGeoOf(sn: string | undefined | null): DeviceIpGeoEntry | null {
  if (!sn) return null
  return deviceIpGeo[sn] ?? null
}

let deviceResolveStarted = false

// 对全量在册设备做一次归属地解析：相同 IP 合并为一次公网请求，结果共享给所有同 IP 设备。
// 幂等：首次执行后再调用直接返回（getIpGeo 已有缓存，不会重复外呼）。
export async function resolveDeviceIpGeo(): Promise<void> {
  if (deviceResolveStarted) return
  deviceResolveStarted = true

  // 初始化条目（内网/无效 IP 直接标 invalid，不触发公网请求）
  for (const d of ANQIAO_DEVICES) {
    if (deviceIpGeo[d.sn]) continue
    deviceIpGeo[d.sn] = {
      ip: d.ip,
      status: isPublicIp(d.ip) ? 'pending' : 'invalid',
      geo: null,
    }
  }

  // 按公网 IP 分组：IP 相同的设备共享一次查询结果
  const ipToSns = new Map<string, string[]>()
  for (const d of ANQIAO_DEVICES) {
    if (!isPublicIp(d.ip)) continue
    const arr = ipToSns.get(d.ip) ?? []
    arr.push(d.sn)
    ipToSns.set(d.ip, arr)
  }

  await Promise.all(
    [...ipToSns.entries()].map(async ([ip, sns]) => {
      const geo = await getIpGeo(ip)
      const status: DeviceIpGeoStatus = geo ? 'resolved' : 'unresolved'
      for (const sn of sns) {
        deviceIpGeo[sn] = { ip, status, geo }
      }
    }),
  )
}

// ======================= 展示文案 =======================
// 返回不含前缀的地点串：`江苏省 · 苏州`（只拿到哪级就显示哪级；失败返回「未解析」）
export function ipGeoDisplay(geo: IpGeo | null | undefined): string {
  if (!geo) return '未解析'
  const parts: string[] = []
  if (geo.region) parts.push(geo.region)
  if (geo.city) parts.push(geo.city)
  if (geo.district) parts.push(geo.district)
  if (!parts.length && geo.country) parts.push(geo.country)
  return parts.length ? parts.join(' · ') : '未解析'
}

// 完整估算标签：`IP归属地（估算）：江苏省 · 苏州` 或 `IP归属地（估算）：未解析`
export function ipGeoLabel(geo: IpGeo | null | undefined): string {
  return `IP归属地（估算）：${ipGeoDisplay(geo)}`
}
