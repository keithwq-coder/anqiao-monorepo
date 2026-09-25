// 安守护 SaaS 切片 · 零依赖 REST + WebSocket 后端（Node ESM，仅 node 内置模块，node >= 18）
// 切片阶段：内存态，重启数据重置；生产环境应迁移至 DB + argon2 + HTTPS（参考 wiki SPEC §1/§2）。
// 启动：node server/index.js（或 npm run server），默认监听 127.0.0.1:8080，env PORT 可改。
// env WS_ALERT_FAST=1 可把 WS 新告警间隔从 45-75s 缩到 5-8s（供 server/test-ws.mjs 冒烟用）。

import http from 'node:http'
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import {
  ACCOUNTS,
  verifyPassword,
  getTenantData,
  getTenantName,
  getTenantKind,
  getPatientDetail,
  getShiftInfo,
  getGeoCities,
  getGeoDevices,
  computeOverview,
  walkVitals,
  generateLiveAlert,
  nowIso8,
  TENANT_IDS,
} from './seed.js'
import { saveState, loadState } from './store.js'

// 启动时还原快照
const persisted = loadState()
if (persisted && typeof persisted === 'object') {
  for (const [tid, alerts] of Object.entries(persisted)) {
    const d = getTenantData(tid)
    if (d && Array.isArray(alerts)) {
      for (const pAlert of alerts) {
        const found = d.alerts.find((a) => a.alert_id === pAlert.alert_id)
        if (found) Object.assign(found, pAlert)
      }
    }
  }
}

function persistTenantAlerts(tenantId) {
  const d = getTenantData(tenantId)
  if (d) {
    const curr = loadState() || {}
    curr[tenantId] = d.alerts
    saveState(curr)
  }
}


const PORT = Number(process.env.PORT ?? 8080)
// 令牌签名密钥：必须经 env TOKEN_SECRET 注入（systemd EnvironmentFile），无默认值，缺失即拒绝启动。
// 对应 INTEGRATION-SPEC §6-3。
const TOKEN_SECRET = process.env.TOKEN_SECRET
if (!TOKEN_SECRET) {
  console.error('[fatal] TOKEN_SECRET 未注入，拒绝启动。请通过 systemd EnvironmentFile 或进程环境提供强随机密钥。')
  process.exit(1)
}
const TOKEN_TTL_SECONDS = 8 * 3600 // 8 小时
// CORS allowlist（生产同源走 nginx 反代其实用不到，留着供跨域调试）
const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://anqiao.aibrain.wiki']

const ALERT_STATUSES = ['triggered', 'handling', 'handled', 'missed']
const PATIENT_STATUS_FILTERS = ['in_bed', 'off_bed', 'abnormal']

// ---------- 令牌：base64url(header).base64url(payload).base64url(HMAC-SHA256) ----------
function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
}

function signToken(payload) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJson(payload)
  const sig = createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verifyToken(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) return null
  const expect = createHmac('sha256', TOKEN_SECRET).update(`${parts[0]}.${parts[1]}`).digest()
  let got
  try {
    got = Buffer.from(parts[2], 'base64url')
  } catch {
    return null
  }
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null
  return payload
}

// ---------- 登录限速：同 IP 60s 内失败 >= 5 次锁 10 分钟 ----------
// 切片阶段内存态；生产应放 Redis 等共享存储。
const loginFails = new Map() // ip -> { count, windowStart, lockedUntil }

function loginLockedRemainingMs(ip) {
  const rec = loginFails.get(ip)
  if (rec?.lockedUntil && Date.now() < rec.lockedUntil) return rec.lockedUntil - Date.now()
  return 0
}

function recordLoginFail(ip) {
  const now = Date.now()
  let rec = loginFails.get(ip)
  if (!rec || now - rec.windowStart > 60_000) {
    rec = { count: 0, windowStart: now, lockedUntil: 0 }
  }
  rec.count += 1
  if (rec.count >= 5) rec.lockedUntil = now + 10 * 60_000
  loginFails.set(ip, rec)
}

function clearLoginFail(ip) {
  loginFails.delete(ip)
}

// ---------- 统一响应包 { code, msg, data } ----------
function corsOrigin(req) {
  const origin = req?.headers?.origin
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

function send(res, httpStatus, code, msg, data = null, req = null) {
  const body = JSON.stringify({ code, msg, data })
  res.writeHead(httpStatus, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  })
  res.end(body)
}

const ok = (res, data) => send(res, 200, 200, 'ok', data)
const badRequest = (res, msg) => send(res, 400, 400, msg)
const unauthorized = (res, msg = '未登录或登录已过期') => send(res, 401, 401, msg)
const notFound = (res, msg = '资源不存在') => send(res, 404, 404, msg)

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 64 * 1024) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

// ---------- 鉴权：从 Bearer 令牌解析 tenant_id / staff_name（前端不传租户参数）----------
function auth(req) {
  const header = req.headers.authorization ?? ''
  const m = /^Bearer\s+(.+)$/.exec(header)
  if (!m) return null
  return verifyToken(m[1])
}

// ---------- 手写参数校验 ----------
function toPositiveInt(v, fallback, max) {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1) return fallback
  return Math.min(n, max)
}

function pageList(list, page, pageSize) {
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, page_size: pageSize }
}

// ---------- 路由：登录 ----------
async function handleLogin(req, res) {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const lockedMs = loginLockedRemainingMs(ip)
  if (lockedMs > 0) {
    return send(res, 429, 429, `尝试次数过多，请 ${Math.ceil(lockedMs / 60000)} 分钟后再试`)
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    return badRequest(res, '请求体格式错误')
  }
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return badRequest(res, '用户名和密码不能为空')
  if (username.length > 64 || password.length > 128) return badRequest(res, '用户名或密码长度超出限制')

  const account = ACCOUNTS.find((a) => a.username === username)
  if (!account || !verifyPassword(password, account.password_hash)) {
    recordLoginFail(ip)
    return unauthorized(res, '用户名或密码错误')
  }

  clearLoginFail(ip)
  const payload = {
    tenant_id: account.tenant_id,
    username: account.username,
    staff_name: account.staff_name,
    role: account.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  return ok(res, {
    token: signToken(payload),
    staff: { name: account.staff_name, role: account.role },
    tenant: { tenant_id: account.tenant_id, name: getTenantName(account.tenant_id), kind: getTenantKind(account.tenant_id) },
  })
}

// ---------- 路由：多租户切换 ----------
async function handleTenantSwitch(req, res, authPayload) {
  let body
  try {
    body = await readBody(req)
  } catch {
    return badRequest(res, '请求体格式错误')
  }
  const targetTenantId = body?.tenant_id
  if (!targetTenantId || !TENANT_IDS.includes(targetTenantId)) {
    return badRequest(res, '目标组织不存在')
  }
  // 目标租户必须在账号的 allowed_tenants 白名单内；账号无该字段（或令牌无 username）时默认仅允许本租户
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  const allowedTenants = account?.allowed_tenants ?? [authPayload.tenant_id]
  if (!allowedTenants.includes(targetTenantId)) {
    return send(res, 403, 403, '无权切换到目标组织')
  }
  const newPayload = {
    tenant_id: targetTenantId,
    username: authPayload.username,
    staff_name: authPayload.staff_name,
    role: authPayload.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  return ok(res, {
    token: signToken(newPayload),
    staff: { name: authPayload.staff_name, role: authPayload.role },
    tenant: {
      tenant_id: targetTenantId,
      name: getTenantName(targetTenantId),
      kind: getTenantKind(targetTenantId),
    },
  })
}


// ---------- 路由：Overview ----------
function handleOverview(req, res, authPayload) {
  const overview = computeOverview(authPayload.tenant_id)
  if (!overview) return notFound(res, '租户不存在')
  return ok(res, overview)
}

// ---------- 路由：告警 ----------
function handleAlertsList(req, res, authPayload, url) {
  const d = getTenantData(authPayload.tenant_id)
  if (!d) return notFound(res, '租户不存在')

  const status = url.searchParams.get('status')
  if (status !== null && !ALERT_STATUSES.includes(status)) {
    return badRequest(res, `status 仅支持 ${ALERT_STATUSES.join('/')}`)
  }
  const levelRaw = url.searchParams.get('level')
  const level = levelRaw === null ? null : Number(levelRaw)
  if (levelRaw !== null && ![1, 2, 3].includes(level)) {
    return badRequest(res, 'level 仅支持 1/2/3')
  }
  const page = toPositiveInt(url.searchParams.get('page'), 1, 100000)
  const pageSize = toPositiveInt(url.searchParams.get('page_size'), 20, 100)

  let list = [...d.alerts].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
  if (status) list = list.filter((a) => a.status === status)
  if (level !== null) list = list.filter((a) => a.level === level)

  return ok(res, pageList(list, page, pageSize))
}

// ---------- 路由：告警状态机 ----------
// triggered 待响应 --(接单 claim)--> handling 处理中 --(处置 handle)--> handled 已闭环
// missed 已超时 为终态；handle 仅接受 handling（体现"先接单再处置"）。
async function handleAlertClaim(req, res, authPayload, alertId) {
  const d = getTenantData(authPayload.tenant_id)
  if (!d) return notFound(res, '租户不存在')
  const alert = d.alerts.find((a) => a.alert_id === alertId)
  if (!alert) return notFound(res, '告警不存在')

  if (alert.status !== 'triggered') {
    return badRequest(res, `该告警当前状态为 ${alert.status}，仅待响应告警可接单`)
  }
  alert.status = 'handling'
  alert.claimed_by = authPayload.staff_name
  alert.claimed_at = nowIso8()
  persistTenantAlerts(authPayload.tenant_id)
  broadcast(authPayload.tenant_id, 'overview', computeOverview(authPayload.tenant_id))
  return ok(res, alert)
}

async function handleAlertHandle(req, res, authPayload, alertId) {
  const d = getTenantData(authPayload.tenant_id)
  if (!d) return notFound(res, '租户不存在')
  const alert = d.alerts.find((a) => a.alert_id === alertId)
  if (!alert) return notFound(res, '告警不存在')

  let body
  try {
    body = await readBody(req)
  } catch {
    return badRequest(res, '请求体格式错误')
  }
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!note) return badRequest(res, '处置备注 note 不能为空')
  if (note.length > 200) return badRequest(res, '处置备注不能超过 200 字')

  if (alert.status === 'triggered') {
    return badRequest(res, '该告警尚未接单，请先接单再处置')
  }
  if (alert.status === 'handled' || alert.status === 'missed') {
    return badRequest(res, `该告警当前状态为 ${alert.status}，不能重复处置`)
  }

  // handling -> handled
  alert.status = 'handled'
  alert.handled_by = authPayload.staff_name
  alert.handled_at = nowIso8()
  alert.handle_note = note
  persistTenantAlerts(authPayload.tenant_id)
  // 处置后 overview 指标变化，推送一版给本租户 WS 客户端
  broadcast(authPayload.tenant_id, 'overview', computeOverview(authPayload.tenant_id))
  return ok(res, alert)
}


// ---------- 路由：班次卡 ----------
function handleShift(req, res, authPayload) {
  const info = getShiftInfo(authPayload.tenant_id)
  if (!info) return notFound(res, '租户不存在或无班次数据')
  return ok(res, info)
}

// ---------- 路由：厂商全国 geo ----------
function handleGeoCities(req, res, authPayload) {
  const cities = getGeoCities(authPayload.tenant_id)
  if (!cities) return send(res, 403, 403, '该租户无全国设备数据')
  return ok(res, cities)
}

function handleGeoDevices(req, res, authPayload, url) {
  const city = url.searchParams.get('city')
  const devices = getGeoDevices(authPayload.tenant_id, city)
  if (!devices) return send(res, 403, 403, '该租户无全国设备数据')
  return ok(res, { list: devices, total: devices.length })
}

// ---------- 路由：长者 ----------
function handlePatientsList(req, res, authPayload, url) {
  const d = getTenantData(authPayload.tenant_id)
  if (!d) return notFound(res, '租户不存在')

  const status = url.searchParams.get('status')
  if (status !== null && !PATIENT_STATUS_FILTERS.includes(status)) {
    return badRequest(res, `status 仅支持 ${PATIENT_STATUS_FILTERS.join('/')}`)
  }
  const floor = url.searchParams.get('floor')
  const ward = url.searchParams.get('ward')
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const page = toPositiveInt(url.searchParams.get('page'), 1, 100000)
  const pageSize = toPositiveInt(url.searchParams.get('page_size'), 20, 100)

  let list = [...d.patients]
  if (floor) list = list.filter((p) => p.bed_id.startsWith(floor.replace('F', '')))
  if (ward) list = list.filter((p) => p.ward === ward)
  if (status === 'in_bed') list = list.filter((p) => p.vitals.in_bed)
  else if (status === 'off_bed') list = list.filter((p) => !p.vitals.in_bed)
  else if (status === 'abnormal') list = list.filter((p) => p.abnormal !== null)
  if (q) {
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.bed_id.toLowerCase().includes(q),
    )
  }
  // 默认排序：异常长者优先，其余按床位号
  list.sort((a, b) => {
    const ab = (b.abnormal ? 1 : 0) - (a.abnormal ? 1 : 0)
    return ab !== 0 ? ab : a.bed_id.localeCompare(b.bed_id)
  })
  return ok(res, pageList(list, page, pageSize))
}

function handlePatientDetail(req, res, authPayload, patientId) {
  // 跨租户访问他人 patient_id：数据按租户隔离，查不到即 404
  const detail = getPatientDetail(authPayload.tenant_id, patientId)
  if (!detail) return notFound(res, '长者不存在')
  return ok(res, detail)
}

// ---------- WebSocket（零依赖手写 RFC6455，契约 §4）----------
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const wsClients = new Map() // tenant_id -> Set<socket>

function wsEncode(payload, opcode = 0x1) {
  const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload
  const len = data.length
  let header
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len])
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x80 | opcode
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x80 | opcode
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([header, data])
}

function wsSend(socket, event, data) {
  if (socket.destroyed) return
  socket.write(wsEncode(JSON.stringify({ event, data })))
}

function broadcast(tenantId, event, data) {
  const set = wsClients.get(tenantId)
  if (!set) return
  const frame = wsEncode(JSON.stringify({ event, data }))
  for (const socket of set) {
    if (!socket.destroyed) socket.write(frame)
  }
}

// 帧解析：客户端帧带 mask 需解；支持 126/127 扩展长度、ping/pong、close、分片拼接
function attachWsParser(socket, onClose) {
  let buf = Buffer.alloc(0)
  let fragments = []
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk])
    while (true) {
      if (buf.length < 2) return
      const fin = (buf[0] & 0x80) !== 0
      const opcode = buf[0] & 0x0f
      const masked = (buf[1] & 0x80) !== 0
      let len = buf[1] & 0x7f
      let offset = 2
      if (len === 126) {
        if (buf.length < 4) return
        len = buf.readUInt16BE(2)
        offset = 4
      } else if (len === 127) {
        if (buf.length < 10) return
        len = Number(buf.readBigUInt64BE(2))
        offset = 10
      }
      const maskLen = masked ? 4 : 0
      if (buf.length < offset + maskLen + len) return
      let payload = buf.subarray(offset + maskLen, offset + maskLen + len)
      if (masked) {
        const mask = buf.subarray(offset, offset + 4)
        const unmasked = Buffer.alloc(len)
        for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i % 4]
        payload = unmasked
      }
      buf = buf.subarray(offset + maskLen + len)

      if (opcode === 0x8) {
        // close：回送 close 帧并结束
        socket.end(wsEncode(Buffer.alloc(0), 0x8))
        onClose()
        return
      }
      if (opcode === 0x9) {
        socket.write(wsEncode(payload, 0xA)) // ping -> pong
        continue
      }
      if (opcode === 0xA) continue // pong
      if (!fin) {
        fragments.push(payload)
        continue
      }
      // 文本/分片结束帧：本切片暂不需要处理客户端消息，仅完成解析保证协议正确
      fragments = []
    }
  })
}

function handleWsUpgrade(req, socket) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/v1/ws') {
    socket.destroy()
    return
  }
  // 鉴权：握手 URL query 携带 ?token=（与 REST 同令牌），无效直接 401 关闭
  const payload = verifyToken(url.searchParams.get('token') ?? '')
  const key = req.headers['sec-websocket-key']
  if (!payload || !key) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  const accept = createHash('sha1').update(key + WS_GUID).digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )
  socket.setNoDelay(true)

  const tenantId = payload.tenant_id
  if (!wsClients.has(tenantId)) wsClients.set(tenantId, new Set())
  const set = wsClients.get(tenantId)
  set.add(socket)

  const cleanup = () => {
    set.delete(socket)
    if (set.size === 0) wsClients.delete(tenantId)
  }
  attachWsParser(socket, cleanup)
  socket.on('close', cleanup)
  socket.on('error', cleanup)

  // 连接建立即推一版 overview，便于前端立即对齐
  wsSend(socket, 'overview', computeOverview(tenantId))
}

// ---------- WS 推送循环（全局租户级，断连客户端自动从注册表清理）----------
// vitals：每 3 秒每租户随机挑 1-3 个床位推一条（厂商租户无床位体征，自动跳过）
setInterval(() => {
  for (const tenantId of TENANT_IDS) {
    const updates = walkVitals(tenantId)
    if (updates.length > 0 && wsClients.has(tenantId)) {
      for (const u of updates) broadcast(tenantId, 'vitals', u)
    }
  }
}, 3000)

// alert：低频新告警（45-75s；WS_ALERT_FAST=1 时 5-8s），插入租户数据并广播 + 推 overview
const ALERT_INTERVAL_RANGE = process.env.WS_ALERT_FAST ? [5000, 8000] : [45000, 75000]
function scheduleLiveAlert(tenantId) {
  const [min, max] = ALERT_INTERVAL_RANGE
  const delay = min + Math.random() * (max - min)
  setTimeout(() => {
    const alert = generateLiveAlert(tenantId)
    if (alert && wsClients.has(tenantId)) {
      broadcast(tenantId, 'alert', alert)
      broadcast(tenantId, 'overview', computeOverview(tenantId))
    }
    scheduleLiveAlert(tenantId)
  }, delay)
}
for (const id of TENANT_IDS) scheduleLiveAlert(id)

// overview：每 30 秒低频推送
setInterval(() => {
  for (const tenantId of wsClients.keys()) {
    broadcast(tenantId, 'overview', computeOverview(tenantId))
  }
}, 30_000)

// ---------- HTTP 服务 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    return res.end()
  }

  try {
    if (method === 'POST' && path === '/v1/auth/login') {
      return await handleLogin(req, res)
    }

    // 以下接口全部要求 Bearer 令牌
    if (path.startsWith('/v1/')) {
      const authPayload = auth(req)
      if (!authPayload) return unauthorized(res)

      if (method === 'POST' && path === '/v1/auth/switch') {
        return await handleTenantSwitch(req, res, authPayload)
      }
      if (method === 'GET' && path === '/v1/overview') {

        return handleOverview(req, res, authPayload)
      }
      if (method === 'GET' && path === '/v1/alerts') {
        return handleAlertsList(req, res, authPayload, url)
      }
      const alertAction = /^\/v1\/alerts\/([A-Za-z0-9_-]+)\/(handle|claim)$/.exec(path)
      if (method === 'POST' && alertAction) {
        return alertAction[2] === 'claim'
          ? await handleAlertClaim(req, res, authPayload, alertAction[1])
          : await handleAlertHandle(req, res, authPayload, alertAction[1])
      }
      if (method === 'GET' && path === '/v1/shift') {
        return handleShift(req, res, authPayload)
      }
      if (method === 'GET' && path === '/v1/geo/cities') {
        return handleGeoCities(req, res, authPayload)
      }
      if (method === 'GET' && path === '/v1/geo/devices') {
        return handleGeoDevices(req, res, authPayload, url)
      }
      if (method === 'GET' && path === '/v1/patients') {
        return handlePatientsList(req, res, authPayload, url)
      }
      const patientMatch = /^\/v1\/patients\/([A-Za-z0-9_-]+)$/.exec(path)
      if (method === 'GET' && patientMatch) {
        return handlePatientDetail(req, res, authPayload, patientMatch[1])
      }
      if (path === '/v1/ws') {
        return badRequest(res, 'WebSocket 通道请使用 Upgrade 握手')
      }
      return notFound(res, '接口不存在')
    }

    return notFound(res, '接口不存在')
  } catch (err) {
    console.error('[server] 未捕获异常:', err)
    return send(res, 500, 500, '服务器内部错误')
  }
})

server.on('upgrade', (req, socket) => {
  try {
    handleWsUpgrade(req, socket)
  } catch (err) {
    console.error('[server] WS 握手异常:', err)
    socket.destroy()
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] 安守护 SaaS 综合后端已启动: http://127.0.0.1:${PORT} (${nowIso8()})`)
  console.log(`[server] 活跃租户: ${TENANT_IDS.map((id) => `${id}(${getTenantName(id)})`).join(', ')}`)
  console.log(`[server] WS 通道: ws://127.0.0.1:${PORT}/v1/ws?token=... (vitals 3s / alert ${ALERT_INTERVAL_RANGE[0] / 1000}-${ALERT_INTERVAL_RANGE[1] / 1000}s / overview 30s)`)
  console.log(`[server] 持久化存储: server/store.json 已激活`)
})

