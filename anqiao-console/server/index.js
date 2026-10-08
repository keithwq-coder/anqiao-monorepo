// 安守护 SaaS 切片 · 零依赖 REST + WebSocket 后端（Node ESM，仅 node 内置模块，node >= 18）
// 切片阶段：内存态，重启数据重置；生产环境应迁移至 DB + argon2 + HTTPS（参考 wiki SPEC §1/§2）。
// 启动：node server/index.js（或 npm run server），默认监听 127.0.0.1:8080，env PORT 可改。
// env WS_ALERT_FAST=1 可把 WS 新告警间隔从 45-75s 缩到 5-8s（供 server/test-ws.mjs 冒烟用）。

import http from 'node:http'
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import {
  ACCOUNTS,
  verifyPassword,
  hashPassword,
  hashPasswordArgon2,
  upgradeSeedPasswordHashes,
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
  DEVICE_ASSETS,
  DEVICE_LIFECYCLE_LOGS,
  transitionDeviceLifecycle,
  PARTNER_CHANNELS,
  listFloors,
  listWards,
  listBeds,
  getDemographics,
  getRankings,
  getProjectConfig,
  TENANT_CONFIGS,
  registerTenant,
  registerPartnerSandbox,
  mulberry32,
  dateSeed,
  todayStr8,
} from './seed.js'
import { saveState, loadState } from './store.js'
import {
  dataLayerMode,
  saveTenantAlerts,
  loadAllTenantAlerts,
  saveAccountHash,
  loadAccountHashes,
  saveLtcState,
  loadLtcState,
  saveTenantVitalsSnapshot,
  saveSaaSUser,
  loadSaaSUsers,
  saveDeviceRegistry,
  savePermGroup,
  loadPermGroups,
  deletePermGroup,
  deleteSaaSUser,
} from './db.js'
import {
  restorePublicLeads,
  mergeChannelLeads,
  clientIp,
  checkPublicLeadRate,
  createWebsiteLead,
  createWorkbenchLead,
  advanceLead,
} from './public-leads.js'
import {
  getDeviceList,
  getLatestData,
  getDailyData,
  getTodayData,
  getSleepStats,
  getReportDates,
  getAlarms,
} from './hw.js'
import {
  isSimDevice,
  simLatestData,
  simDailyData,
  simTodayData,
  simSleepStats,
  simReportDates,
  simAlarms,
} from './sim-telemetry.js'
import {
  LtcError,
  ctxForAccount,
  principalForAccount,
  permissionsOf,
  dataScopeOf,
  workspaceOf,
  authorize,
  effectivePermissionsOf,
  ALL_PERMISSION_CODES,
  registerCustomGroupLookup,
  ROLE_PERMISSIONS,
  createDeviceAsset,
  updateDeviceAsset,
  deleteDeviceAsset,
  listDeviceAssignments,
  createDeviceAssignment,
  deleteDeviceAssignment,
  createApplication,
  listApplications,
  getApplication,
  submitApplication,
  createAssessmentTask,
  listAssessmentTasks,
  getAssessmentTask,
  acceptTask,
  startTask,
  addEvidence,
  submitTask,
  returnTask,
  approveReview,
  createSupervisionCase,
  listSupervisionCases,
  generateReport,
  getReport,
  listReports,
  listAssessedPersons,
  createAssessmentSnapshot,
  getAssessmentSnapshot,
  listAssessmentSnapshots,
  handleInsight,
  listAssessmentInsights,
  expertReviewTask,
  getAssessorDashboard,
  listServicePlans,
  listServiceVisits,
  listServiceEvidence,
  listSettlements,
  reviewSettlement,
  listQualityEvents,
  disposeQualityEvent,
  listEvidence,
  listMedicalRecords,
  getPersonMedicalRecord,
  listAssessors,
  listAssessmentOrgs,
  listWorkOrders,
  actionWorkOrder,
  getDeviceLiveTelemetry,
  getWorkbenchSummary,
  listWorkbenchTodos,
  getWorkbenchWorkflowTree,
  authorizedWorkspacesFor,
  applicationAction,
  listApplicationMaterials,
  listApplicationTimeline,
  applicationSla,
  listFamilyBindings,
  listBindingRequests,
  createBindingRequest,
  bindingRequestAction,
  listAppeals,
  getAppeal,
  createAppeal,
  appealAction,
  listDeviceLabels,
  patchDeviceLabels,
  deviceLabelStats,
  listDeviceBindings,
  createDeviceBinding,
  deviceBindingAction,
  getSupervisionDashboard,
  switchGovernanceMode,
  listSupervisionClues,
  dispatchSupervisionClue,
  feedbackSupervisionClue,
  adjudicateSupervisionClue,
  scanSupervisionClues,
  getSupervisionPenetration,
  getSettlementVoucher,
  getInsurerDashboard,
  listInsurerInspections,
  recordInsurerInspection,
} from './ltc.js'

// 启动时还原快照（持久层优先，回退 store.json 种子模式）；seed 模式不碰持久层
const sqliteAlerts = await loadAllTenantAlerts()
const jsonAlerts = loadState()
const alertSnapshots =
  ['sqlite', 'mysql'].includes(dataLayerMode()) && Object.keys(sqliteAlerts).length > 0 ? sqliteAlerts : (jsonAlerts ?? {})
if (alertSnapshots && typeof alertSnapshots === 'object') {
  for (const [tid, alerts] of Object.entries(alertSnapshots)) {
    const d = getTenantData(tid)
    if (d && Array.isArray(alerts)) {
      for (const pAlert of alerts) {
        const found = d.alerts.find((a) => a.alert_id === pAlert.alert_id)
        if (found) Object.assign(found, pAlert)
      }
    }
  }
}

await restorePublicLeads()

// 阶段四：种子口令升级为 argon2id + 随机 salt；sqlite 模式叠加已保存哈希
const restoredHashes = await loadAccountHashes()
for (const a of ACCOUNTS) {
  if (restoredHashes[a.username]) a.password_hash = restoredHashes[a.username]
}
const passwordUpgradeReady = upgradeSeedPasswordHashes()
  .catch((err) => {
    // argon2 未安装等升级失败不致命：登录走 scrypt 回退（立即挂 catch，防止未处理拒绝杀进程）
    console.error('[server] argon2id 口令升级跳过:', err.message)
    return undefined
  })
  .then(async () => {
    if (['sqlite', 'mysql'].includes(dataLayerMode())) {
      for (const a of ACCOUNTS) await saveAccountHash(a.username, a.password_hash)
    }
  })
  .catch((err) => console.error('[server] 账号哈希持久化失败:', err.message))

// ---------- 中科安樵员工账号（与 CRM/wiki 同名同源；SaaS 为主管理，CRM 后续反向引入） ----------
// 员工播种口令必须经 env 注入，仓库内禁止明文（INTEGRATION-SPEC §6-4）
const EMPLOYEE_INIT_PASSWORD = process.env.EMPLOYEE_INIT_PASSWORD || process.env.SEED_ACCOUNT_PASSWORD || ''
const EMPLOYEE_ACCOUNTS = [
  { username: 'admin', display_name: '系统管理员', unified_role: 'system_admin', role: 'su', tenant_id: 'platform', workspace: 'system_admin', scope: 'global' },
  { username: '赵', display_name: '赵', unified_role: 'platform_admin', role: 'admin', tenant_id: 'anqiao', workspace: 'platform_operations', scope: 'global' },
  { username: '武', display_name: '武', unified_role: 'platform_admin', role: 'admin', tenant_id: 'anqiao', workspace: 'platform_operations', scope: 'global' },
  { username: '吴', display_name: '吴', unified_role: 'platform_admin', role: 'admin', tenant_id: 'anqiao', workspace: 'platform_operations', scope: 'global' },
  { username: '何丹', display_name: '何丹', unified_role: 'sales', role: 'business_user', tenant_id: 'anqiao', workspace: 'customer_view', scope: 'org' },
  { username: '张楠', display_name: '张楠', unified_role: 'sales', role: 'business_user', tenant_id: 'anqiao', workspace: 'customer_view', scope: 'org' },
  { username: 'ceshi', display_name: '测试', unified_role: 'sales', role: 'business_user', tenant_id: 'anqiao', workspace: 'customer_view', scope: 'org' },
  { username: '王海燕', display_name: '王海燕', unified_role: 'sales', role: 'business_user', tenant_id: 'anqiao', workspace: 'customer_view', scope: 'org' },
  { username: '周晶晶', display_name: '周晶晶', unified_role: 'sales', role: 'business_user', tenant_id: 'anqiao', workspace: 'customer_view', scope: 'org' },
]

/** saas_users 颗粒覆盖列容错解析（JSON 字符串 → string[]；坏值回退 []） */
function parsePermColumn(raw) {
  if (Array.isArray(raw)) return raw.filter((c) => typeof c === 'string')
  if (typeof raw === 'string' && raw) {
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.filter((c) => typeof c === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

async function ensureSaasAccounts() {
  try {
    const existing = await loadSaaSUsers()
    const byName = new Map(existing.map((u) => [u.username, u]))
    if (!EMPLOYEE_INIT_PASSWORD) {
      console.warn('[server] EMPLOYEE_INIT_PASSWORD / SEED_ACCOUNT_PASSWORD 未注入，跳过员工账号播种')
    }
    for (const e of EMPLOYEE_ACCOUNTS) {
      if (!byName.has(e.username)) {
        if (!EMPLOYEE_INIT_PASSWORD) continue
        await saveSaaSUser({
          ...e,
          password_hash: hashPassword(EMPLOYEE_INIT_PASSWORD, randomBytes(16).toString('hex')),
          is_seed: true,
          created_by: 'seed',
        })
      }
    }
    const users = await loadSaaSUsers()
    let added = 0
    for (const u of users) {
      const inMem = ACCOUNTS.find((a) => a.username === u.username)
      if (inMem) {
        // 三层权限模型（W6）：既有内存账号回写覆盖列（此前"缺则加"不回写，重启丢失颗粒微调）
        inMem.granted_perms = Array.isArray(u.granted_perms) ? u.granted_perms : parsePermColumn(u.granted_perms)
        inMem.revoked_perms = Array.isArray(u.revoked_perms) ? u.revoked_perms : parsePermColumn(u.revoked_perms)
        continue
      }
      ACCOUNTS.push({
        username: u.username,
        password_hash: u.password_hash,
        staff_name: u.display_name || u.username,
        role: u.role || 'business_user',
        unified_role: u.unified_role || 'business_user',
        tenant_id: u.tenant_id || 'anqiao',
        org_id: u.tenant_id || 'anqiao',
        workspace: u.workspace || 'platform_operations',
        scope: u.scope || 'org',
        granted_perms: Array.isArray(u.granted_perms) ? u.granted_perms : parsePermColumn(u.granted_perms),
        revoked_perms: Array.isArray(u.revoked_perms) ? u.revoked_perms : parsePermColumn(u.revoked_perms),
      })
      added++
    }
    console.log(`[server] SaaS 账号库同步完成: saas_users=${users.length}, 本地新增=${added}`)
  } catch (err) {
    console.error('[server] SaaS 账号同步失败:', err.message)
  }
}
await ensureSaasAccounts()

// ---------- N28 自定义权限组：启动加载全库组表并注入引擎解析器 ----------
// 组键约定 custom:<group_id>；租户私有隔离在 CRUD 守卫层做，group_id 全局唯一。
const permGroupsById = new Map()
let permGroupsLoaded = false

async function loadAllPermGroups() {
  permGroupsById.clear()
  if (!['sqlite', 'mysql'].includes(dataLayerMode())) {
    permGroupsLoaded = true
    return
  }
  try {
    const rows = await loadPermGroups()
    for (const r of rows) permGroupsById.set(r.group_id, r)
  } catch (err) {
    console.error('[server] perm_groups 加载失败（自定义组按空集处理）:', err.message)
  }
  permGroupsLoaded = true
}

registerCustomGroupLookup((groupKey) => {
  const row = permGroupsById.get(String(groupKey).slice('custom:'.length))
  if (!row) return null
  let codes = row.codes
  if (typeof codes === 'string') {
    try {
      codes = JSON.parse(codes)
    } catch {
      codes = []
    }
  }
  return Array.isArray(codes) ? codes : []
})

await loadAllPermGroups()

function persistTenantAlerts(tenantId) {
  const d = getTenantData(tenantId)
  if (!d) return
  if (['sqlite', 'mysql'].includes(dataLayerMode())) {
    Promise.all([
      saveTenantAlerts(tenantId, d.alerts),
      saveTenantVitalsSnapshot(tenantId, d.patients),
    ]).catch((err) => console.error('[db] persist alerts failed:', err.message))
    return
  }
  const curr = loadState() || {}
  curr[tenantId] = d.alerts
  saveState(curr)
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
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://anqiao.aibrain.wiki',
  'https://www.anqiaokj.com',
  'https://anqiaokj.com',
]

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
  // 三层权限模型（W2）：token 只携带身份，颗粒覆盖列以 ACCOUNTS 实时账号为准合并进 payload，
  // 使 authorize() 每请求走 effectivePermissionsOf 合成——颗粒微调后无需重签 token 即时生效。
  const liveAccount = ACCOUNTS.find((a) => a.username === payload.username)
  if (liveAccount) {
    payload.granted_perms = Array.isArray(liveAccount.granted_perms) ? liveAccount.granted_perms : parsePermColumn(liveAccount.granted_perms)
    payload.revoked_perms = Array.isArray(liveAccount.revoked_perms) ? liveAccount.revoked_perms : parsePermColumn(liveAccount.revoked_perms)
  }
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
  if (!origin) return ALLOWED_ORIGINS[0]
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  if (/^https?:\/\/1\.94\.51\.126(:\d+)?$/.test(origin)) return origin
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*anqiaokj\.com(:\d+)?$/.test(origin)) return origin
  return origin
}

function send(res, httpStatus, code, msg, data = null, req = null) {
  const body = JSON.stringify({ code, msg, data })
  const r = req || res?.req
  res.writeHead(httpStatus, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(r),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Screen-Tenant',
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
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    recordLoginFail(ip)
    return unauthorized(res, '用户名或密码错误')
  }

  clearLoginFail(ip)
  const poolId = account.pool_id || (account.tenant_id === 'bureau_suqian' ? 'suqian' : account.tenant_id === 'bureau_moumou' ? 'moumou' : null)
  const payload = {
    tenant_id: account.tenant_id,
    username: account.username,
    staff_name: account.staff_name,
    role: account.role,
    pool_id: poolId,
    unified_role: account.unified_role || account.role,
    workspace: account.workspace || workspaceOf(account.role),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  return ok(res, {
    token: signToken(payload),
    staff: { name: account.staff_name, role: account.role, unified_role: account.unified_role },
    tenant: { tenant_id: account.tenant_id, name: getTenantName(account.tenant_id), kind: getTenantKind(account.tenant_id) },
    workspace: account.workspace || workspaceOf(account.role),
    pool_id: poolId,
    principal: principalForAccount(account),
    permissions: effectivePermissionsOf(account),
    data_scope: account.scope || dataScopeOf(account.role),
    workspaces: authorizedWorkspacesFor(account.role, account),
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
  // 账号矩阵一账号一组织：仅允许切换到账号所属组织（等于原租户，实际为无操作）。
  // 已废弃旧租户切换白名单 allowed_tenants，长护险/机构角色无权跨护理院/厂商租户切换，避免越权。
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  const allowedTenants = account ? [account.tenant_id] : [authPayload.tenant_id]
  if (!allowedTenants.includes(targetTenantId)) {
    return send(res, 403, 403, '无权切换到目标组织（账号仅归属本组织）')
  }
  const newPoolId = account?.pool_id || (targetTenantId === 'bureau_suqian' ? 'suqian' : targetTenantId === 'bureau_moumou' ? 'moumou' : null)
  const newPayload = {
    tenant_id: targetTenantId,
    username: authPayload.username,
    staff_name: account?.staff_name || authPayload.staff_name,
    role: account?.role || authPayload.role,
    unified_role: account?.unified_role || authPayload.unified_role,
    workspace: account?.workspace || workspaceOf(account?.role || authPayload.role),
    pool_id: newPoolId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  return ok(res, {
    token: signToken(newPayload),
    staff: { name: newPayload.staff_name, role: newPayload.role, unified_role: newPayload.unified_role },
    tenant: {
      tenant_id: targetTenantId,
      name: getTenantName(targetTenantId),
      kind: getTenantKind(targetTenantId),
    },
    principal: principalForAccount(account ?? {}),
    // 权限引擎修复：以 ACCOUNTS 实时账号（而非旧 token payload 的 role）合成下发，
    // 此前基于 authPayload.role 查静态表，账号组/微调变更后 switch 不生效（既有 bug①）
    permissions: effectivePermissionsOf(account ?? authPayload),
    data_scope: account?.scope || dataScopeOf(account?.role || authPayload.role),
    workspace: newPayload.workspace,
    workspaces: authorizedWorkspacesFor(account?.role || authPayload.role, account),
  })
}


// ---------- 路由：Overview ----------
function handleOverview(req, res, authPayload) {
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  // 如果是护理员 (assigned)，计算其负责楼层的 overview
  if (account?.scope === 'assigned' && account.assigned_floors?.length) {
    const d = getTenantData(authPayload.tenant_id)
    if (!d) return notFound(res, '租户不存在')
    const myPatients = d.patients.filter((p) => account.assigned_floors.some((f) => p.bed_id.startsWith(f.replace('F', ''))))
    const myAlerts = d.alerts.filter((a) => account.assigned_floors.some((f) => a.bed_id.startsWith(f.replace('F', ''))))
    const closed = myAlerts.filter((a) => a.status === 'handled' || a.status === 'missed').length
    const male = myPatients.filter((p) => p.gender === 'male').length
    const inBed = myPatients.filter((p) => p.vitals.in_bed).length
    return ok(res, {
      device_total: myPatients.length,
      device_online: myPatients.length,
      device_online_rate: 100,
      patient_total: myPatients.length,
      patient_male: male,
      patient_female: myPatients.length - male,
      bed_occupied: myPatients.length,
      bed_total: myPatients.length,
      alerts_today: myAlerts.length,
      alerts_closed_today: closed,
      in_bed_count: inBed,
      in_bed_rate: myPatients.length ? Math.round((inBed / myPatients.length) * 1000) / 10 : 0,
      city_count: 1,
      generated_at: nowIso8(),
    })
  }

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

  // 护士 assigned scope 隔离
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  if (account?.scope === 'assigned' && account.assigned_floors?.length) {
    list = list.filter((a) => account.assigned_floors.some((f) => a.bed_id.startsWith(f.replace('F', ''))))
  }

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

// ---------- 路由：设备资产管理台账与生命周期 ----------
function handleDevicesList(req, res, authPayload, url) {
  const customer = url.searchParams.get('customer')
  const partner = url.searchParams.get('partner')
  const status = url.searchParams.get('status')
  let list = [...DEVICE_ASSETS]
  if (customer) list = list.filter((d) => d.customer_org_id === customer)
  if (partner) list = list.filter((d) => d.partner_org_id === partner)
  if (status) list = list.filter((d) => d.lifecycle_status === status)

  // 租户过滤：partner 角色只能看归属自己的渠道设备
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  if (account?.role === 'partner_admin') {
    list = list.filter((d) => d.partner_org_id === account.org_id)
  } else if (account?.role === 'nursing_admin') {
    list = list.filter((d) => d.customer_org_id === account.org_id)
  }
  return ok(res, { list, total: list.length })
}

// ---------- 路由：销售客户资产视图（N21–N25，多业态设计 §6） ----------
// 机构主数据以 SaaS 侧 device_registry 的 customer_org_id 归属为权威（CRM 为边缘实验项目，仅可选镜像，不做硬依赖）。
// 归属规则：设备带 sales_owner 时仅归属销售与平台侧可见；未分配机构对所有销售可见（与现网行为一致）。
function salesVisibleDevices(account) {
  const isPlatform = ['admin', 'su'].includes(account?.role)
  return DEVICE_ASSETS.filter((d) => {
    if (!d.customer_org_id) return false
    if (isPlatform) return true
    return !d.sales_owner || d.sales_owner === account.username
  })
}

function salesAccountOr404(res, authPayload) {
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  if (!account || !['business_user', 'admin', 'su'].includes(account.role)) {
    notFound(res, '无该数据面')
    return null
  }
  return account
}

function salesDeviceSummary(d) {
  return {
    device_id: d.device_id,
    sn: d.sn,
    label: d.label,
    type: d.type,
    online: !!d.online,
    lifecycle_status: d.lifecycle_status,
    last_data_time: d.last_data_time ?? null,
    sales_owner: d.sales_owner ?? null,
  }
}

/** N21 GET /v1/sales/institutions */
function handleSalesInstitutions(req, res, authPayload) {
  const account = salesAccountOr404(res, authPayload)
  if (!account) return
  const devices = salesVisibleDevices(account)
  const map = new Map()
  for (const d of devices) {
    const org = d.customer_org_id
    if (!map.has(org)) {
      map.set(org, { org_id: org, site: d.installation_site_id || d.device_placement_location || org, devices_count: 0, online_count: 0 })
    }
    const e = map.get(org)
    e.devices_count += 1
    if (d.online) e.online_count += 1
  }
  const list = [...map.values()]
  return ok(res, { list, total: list.length })
}

/** N22 GET /v1/sales/institutions/{org}/devices */
function handleSalesOrgDevices(req, res, authPayload, orgId) {
  const account = salesAccountOr404(res, authPayload)
  if (!account) return
  const exists = DEVICE_ASSETS.some((d) => d.customer_org_id === orgId)
  const devices = salesVisibleDevices(account).filter((d) => d.customer_org_id === orgId)
  if (!exists) return notFound(res, '机构不存在或无权访问')
  return ok(res, { org_id: orgId, list: devices.map(salesDeviceSummary), total: devices.length })
}

/** N23 GET /v1/sales/institutions/{org}/vitals-summary —— 脱敏：设备维度遥测，无身份档案字段 */
async function handleSalesOrgVitals(req, res, authPayload, orgId) {
  const account = salesAccountOr404(res, authPayload)
  if (!account) return
  const exists = DEVICE_ASSETS.some((d) => d.customer_org_id === orgId)
  const devices = salesVisibleDevices(account).filter((d) => d.customer_org_id === orgId)
  if (!exists) return notFound(res, '机构不存在或无权访问')
  const list = []
  for (const d of devices.slice(0, 10)) {
    try {
      const raw = await getLatestData(d.sn)
      list.push({ device_id: d.device_id, label: d.label, vitals: raw ?? null })
    } catch (err) {
      list.push({ device_id: d.device_id, label: d.label, vitals: null, reason: err.message || '遥测拉取失败' })
    }
  }
  return ok(res, { org_id: orgId, list })
}

/** N24 GET /v1/sales/institutions/{org}/alerts —— 告警按设备维度的 SN 映射未定前，诚实返回待映射，严禁跨机构泄漏 */
function handleSalesOrgAlerts(req, res, authPayload, orgId) {
  const account = salesAccountOr404(res, authPayload)
  if (!account) return
  const exists = DEVICE_ASSETS.some((d) => d.customer_org_id === orgId)
  if (!exists) return notFound(res, '机构不存在或无权访问')
  return ok(res, {
    org_id: orgId,
    alarms: null,
    reason: '硬件告警 SN→设备映射确认后启用（避免跨机构告警泄漏）',
  })
}

/** N25 GET /v1/sales/institutions/{org}/telemetry?device_id=&range=today|sleep —— 硬件代理只读转发 */
async function handleSalesOrgTelemetry(req, res, authPayload, orgId, url) {
  const account = salesAccountOr404(res, authPayload)
  if (!account) return
  const deviceId = url.searchParams.get('device_id')
  if (!deviceId) return badRequest(res, 'device_id 必填')
  const dev = salesVisibleDevices(account).find((d) => d.customer_org_id === orgId && (d.device_id === deviceId || d.sn === deviceId))
  if (!dev) return notFound(res, '设备不存在或不属于该机构')
  const range = url.searchParams.get('range') || 'today'
  try {
    const data = range === 'sleep' ? await getSleepStats(dev.sn) : await getTodayData(dev.sn)
    return ok(res, { device_id: dev.device_id, range, data: data ?? null })
  } catch (err) {
    const status = err.status || 502
    return send(res, status, status, err.message || '硬件云代理失败')
  }
}

async function handleDeviceLifecycle(req, res, authPayload, deviceId) {
  let body
  try {
    body = await readBody(req)
  } catch {
    return badRequest(res, '请求体格式错误')
  }
  const account = ACCOUNTS.find((a) => a.username === authPayload.username) || authPayload
  const authRes = authorize(account, 'device:lifecycle')
  if (!authRes.allow) {
    return send(res, authRes.status, authRes.status, authRes.message)
  }

  const toStatus = body?.to_status || body?.target_status
  const remark = body?.remark || body?.note || ''
  const location = body?.location || ''
  const result = transitionDeviceLifecycle(deviceId, toStatus, account, remark, location)
  if (!result.ok) {
    return badRequest(res, result.error)
  }
  return ok(res, result.device)
}

function handlePartnerChannels(req, res, authPayload) {
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  let channels = [...PARTNER_CHANNELS]
  if (account?.role === 'partner_admin') {
    channels = channels.filter((c) => c.partner_org_id === account.org_id)
  }
  const customers = channels.flatMap((c) => c.developed_customers || [])
  const leads = mergeChannelLeads(account, channels)
  return ok(res, {
    partner_id: account?.org_id || channels[0]?.partner_org_id,
    list: channels,
    channels,
    customers,
    leads,
  })
}

const SCREEN_HARDWARE_READONLY = new Set([
  '/v1/hardware/latest',
  '/v1/hardware/daily',
  '/v1/hardware/today',
  '/v1/hardware/sleep',
  '/v1/hardware/report-dates',
  '/v1/hardware/alarms',
])
const SUQIAN_SCREEN_DEVICE_IDS = ['ASH01086', 'ASH01078', 'ASH01092']

function isScreenViewer(authPayload) {
  return !!(authPayload?.kiosk || authPayload?.role === 'screen_viewer' || authPayload?.unified_role === 'screen_viewer')
}

function screenAllowedDeviceIds(authPayload) {
  if (authPayload?.tenant_id === 'bureau_suqian' || authPayload?.pool_id === 'suqian') {
    return SUQIAN_SCREEN_DEVICE_IDS
  }
  return DEVICE_ASSETS.map((d) => d.sn || d.device_id).filter(Boolean)
}

function screenMayReadHardware(authPayload, path, deviceId) {
  if (!SCREEN_HARDWARE_READONLY.has(path)) return false
  if (!deviceId) return false
  return screenAllowedDeviceIds(authPayload).includes(deviceId)
}

/**
 * GET /v1/hardware/* — 服务端代理。2.8 查询按文档只转发 device_id（夜间另加 date），不要求 HW_*。
 * SIM- 前缀设备不转发硬件云，由内置确定性仿真源应答（SIM-TELEMETRY-DESIGN §3.1；
 * 鉴权与公屏在册校验先于分流，对 SIM 设备同等生效；短路在 502 包装之前）。
 */
async function handleHardwareProxy(req, res, authPayload, url, path) {
  const screen = isScreenViewer(authPayload)
  if (screen) {
    if (!SCREEN_HARDWARE_READONLY.has(path)) {
      return send(res, 403, 403, '公屏只读会话不得访问硬件管理接口')
    }
  } else {
    const authRes = authorize(authPayload, 'device:read')
    if (!authRes.allow) {
      return send(res, authRes.status, authRes.status, authRes.message)
    }
  }
  try {
    if (path === '/v1/hardware/devices' || path === '/v1/hardware/devices/raw') {
      const userId = url.searchParams.get('user_id')
      if (!userId) return badRequest(res, 'user_id 必填（对接 API 2.5.1）')
      const data = await getDeviceList(userId)
      if (path === '/v1/hardware/devices/raw') return ok(res, data)
      const list = [
        ...(data?.healthDevice_List || []),
        ...(data?.fallDevice_List || []),
        ...(data?.healthDeviceBed_List || []),
      ]
      return ok(res, list)
    }
    if (path === '/v1/hardware/latest') {
      const deviceId = url.searchParams.get('device_id')
      if (!deviceId) return badRequest(res, 'device_id 必填（对接 API 2.8.2）')
      if (screen && !screenMayReadHardware(authPayload, path, deviceId)) {
        return send(res, 403, 403, '公屏只能查询在册设备体征')
      }
      if (isSimDevice(deviceId)) return ok(res, simLatestData(deviceId))
      return ok(res, await getLatestData(deviceId))
    }
    if (path === '/v1/hardware/daily') {
      const deviceId = url.searchParams.get('device_id')
      if (!deviceId) return badRequest(res, 'device_id 必填（对接 API 2.8.3）')
      const date = url.searchParams.get('date')
      if (!date) return badRequest(res, 'date 必填（对接 API 2.8.3，YYYY-MM-DD）')
      if (screen && !screenMayReadHardware(authPayload, path, deviceId)) {
        return send(res, 403, 403, '公屏只能查询在册设备体征')
      }
      if (isSimDevice(deviceId)) return ok(res, simDailyData(deviceId, date))
      return ok(res, await getDailyData(deviceId, date))
    }
    if (path === '/v1/hardware/today') {
      const deviceId = url.searchParams.get('device_id')
      if (!deviceId) return badRequest(res, 'device_id 必填（对接 API 2.8.4）')
      if (screen && !screenMayReadHardware(authPayload, path, deviceId)) {
        return send(res, 403, 403, '公屏只能查询在册设备体征')
      }
      if (isSimDevice(deviceId)) return ok(res, simTodayData(deviceId))
      return ok(res, await getTodayData(deviceId))
    }
    if (path === '/v1/hardware/sleep') {
      const deviceId = url.searchParams.get('device_id')
      if (!deviceId) return badRequest(res, 'device_id 必填（对接 API 2.8.5）')
      if (screen && !screenMayReadHardware(authPayload, path, deviceId)) {
        return send(res, 403, 403, '公屏只能查询在册设备体征')
      }
      if (isSimDevice(deviceId)) {
        return ok(res, simSleepStats(deviceId, url.searchParams.get('date') || new Date().toISOString().slice(0, 10)))
      }
      return ok(res, await getSleepStats(deviceId, url.searchParams.get('date') || undefined))
    }
    if (path === '/v1/hardware/report-dates') {
      const deviceId = url.searchParams.get('device_id')
      if (!deviceId) return badRequest(res, 'device_id 必填（对接 API 2.8.6）')
      if (screen && !screenMayReadHardware(authPayload, path, deviceId)) {
        return send(res, 403, 403, '公屏只能查询在册设备体征')
      }
      if (isSimDevice(deviceId)) return ok(res, simReportDates(deviceId))
      const dates = await getReportDates(deviceId)
      return ok(res, Array.isArray(dates) ? dates : [])
    }
    if (path === '/v1/hardware/alarms') {
      const deviceId = url.searchParams.get('device_id') || undefined
      if (screen && !screenMayReadHardware(authPayload, path, deviceId)) {
        return send(res, 403, 403, '公屏只能查询在册设备告警')
      }
      const page = Number(url.searchParams.get('page') || 1)
      const pageSize = Number(url.searchParams.get('page_size') || 20)
      const status = url.searchParams.get('status') || undefined
      if (deviceId && isSimDevice(deviceId)) {
        return ok(res, simAlarms(deviceId, { page, pageSize, status }))
      }
      const data = await getAlarms(deviceId, page, pageSize, status)
      return ok(res, data || { items: [], total: 0 })
    }
    return notFound(res, '硬件代理接口不存在')
  } catch (err) {
    const status = err.status || 502
    return send(res, status, status, err.message || '硬件云代理失败')
  }
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

  // 护士 assigned scope 隔离：若指定了 floor 或为护理台席位，允许按目标楼层协同调阅
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  if (!floor && account?.scope === 'assigned' && account.assigned_floors?.length && account.role !== 'nursing_station') {
    list = list.filter((p) => account.assigned_floors.some((f) => p.bed_id.startsWith(f.replace('F', ''))))
  }

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

  // 护士 assigned scope 隔离
  const account = ACCOUNTS.find((a) => a.username === authPayload.username)
  if (account?.scope === 'assigned' && account.assigned_floors?.length) {
    const isAssigned = account.assigned_floors.some((f) => detail.bed_id.startsWith(f.replace('F', '')))
    if (!isAssigned) return notFound(res, '长者不存在或无权访问')
  }

  return ok(res, detail)
}

// ---------- 长护险路由（/v1/ltc/）----------
function ltcCtx(authPayload) {
  const account = ACCOUNTS.find((a) => a.username === authPayload.username) ?? {}
  const poolId = account.pool_id || authPayload.pool_id || (authPayload.tenant_id === 'bureau_suqian' ? 'suqian' : authPayload.tenant_id === 'bureau_moumou' ? 'moumou' : null)
  return ctxForAccount({
    ...account,
    username: authPayload.username,
    tenant_id: authPayload.tenant_id,
    role: authPayload.role,
    pool_id: poolId,
    data_scope: account.scope || authPayload.data_scope || dataScopeOf(account.role || authPayload.role),
    unified_role: authPayload.unified_role || account.unified_role || authPayload.role,
    staff_name: authPayload.staff_name || account.staff_name,
  })
}

function mapLtcError(res, err) {
  if (err instanceof LtcError) return send(res, err.status, err.status, err.message)
  console.error('[server] LTC 未捕获异常:', err)
  return send(res, 500, 500, '服务器内部错误')
}

async function routeLtc(req, res, ctx, url) {
  const path = url.pathname
  const method = req.method
  const q = Object.fromEntries(url.searchParams)
  const body = async () => {
    try {
      return await readBody(req)
    } catch {
      throw new LtcError(400, '请求体格式错误')
    }
  }

  const okList = (arr) => ok(res, { list: arr, total: arr.length })

  // 工作台摘要与待办（N01/N02）
  if (path === '/v1/ltc/workbench/summary') {
    if (method === 'GET') return ok(res, getWorkbenchSummary(ctx, q))
  }
  if (path === '/v1/ltc/workbench/todos') {
    if (method === 'GET') return ok(res, listWorkbenchTodos(ctx, q))
  }
  // SOP 流程树（N16，LTC-WORKBENCH-SPEC §12.4）
  if (path === '/v1/ltc/workbench/workflow-tree') {
    if (method === 'GET') return ok(res, getWorkbenchWorkflowTree(ctx, q))
  }

  // 被评估对象 (AssessedPerson)
  if (path === '/v1/ltc/assessed-persons') {
    if (method === 'GET') return okList(listAssessedPersons(ctx, q))
  }

  // 医保监管工单流 (Work Orders)
  if (path === '/v1/ltc/work-orders') {
    if (method === 'GET') return okList(listWorkOrders(ctx, q))
  }
  const woActionMatch = /^\/v1\/ltc\/work-orders\/([A-Za-z0-9_-]+)\/action$/.exec(path)
  if (method === 'POST' && woActionMatch) {
    return ok(res, actionWorkOrder(ctx, woActionMatch[1], await body()))
  }

  // 评估师与定点评估机构名录
  if (path === '/v1/ltc/assessors') {
    if (method === 'GET') return okList(listAssessors(ctx, q))
  }
  if (path === '/v1/ltc/assessment-orgs') {
    if (method === 'GET') return okList(listAssessmentOrgs(ctx, q))
  }

  // 临床病历档案
  const medRecMatch = /^\/v1\/ltc\/assessed-persons\/([A-Za-z0-9_-]+)\/medical-record$/.exec(path)
  if (method === 'GET' && medRecMatch) {
    return ok(res, getPersonMedicalRecord(ctx, medRecMatch[1]))
  }
  if (path === '/v1/ltc/medical-records') {
    if (method === 'GET') return okList(listMedicalRecords(ctx, q))
  }

  // 在线设备实时动态遥测
  const devTelemMatch = /^\/v1\/ltc\/devices\/([A-Za-z0-9_-]+)\/telemetry$/.exec(path)
  if (method === 'GET' && devTelemMatch) {
    return ok(res, getDeviceLiveTelemetry(devTelemMatch[1]))
  }

  // 申请
  if (path === '/v1/ltc/applications') {
    if (method === 'GET') return okList(listApplications(ctx, q))
    if (method === 'POST') return ok(res, createApplication(ctx, await body()))
  }
  let m = /^\/v1\/ltc\/applications\/([A-Za-z0-9_-]+)\/submit$/.exec(path)
  if (method === 'POST' && m) return ok(res, submitApplication(ctx, m[1]))
  m = /^\/v1\/ltc\/applications\/([A-Za-z0-9_-]+)\/actions$/.exec(path)
  if (method === 'POST' && m) return ok(res, applicationAction(ctx, m[1], await body()))
  m = /^\/v1\/ltc\/applications\/([A-Za-z0-9_-]+)\/materials$/.exec(path)
  if (method === 'GET' && m) return ok(res, listApplicationMaterials(ctx, m[1]))
  m = /^\/v1\/ltc\/applications\/([A-Za-z0-9_-]+)\/timeline$/.exec(path)
  if (method === 'GET' && m) return ok(res, listApplicationTimeline(ctx, m[1]))
  m = /^\/v1\/ltc\/applications\/([A-Za-z0-9_-]+)\/sla$/.exec(path)
  if (method === 'GET' && m) return ok(res, applicationSla(ctx, m[1]))
  m = /^\/v1\/ltc\/applications\/([A-Za-z0-9_-]+)$/.exec(path)
  if (method === 'GET' && m) return ok(res, getApplication(ctx, m[1]))

  // 评估任务
  if (path === '/v1/ltc/assessment-tasks' || path === '/v1/ltc/tasks') {
    if (method === 'GET') return okList(listAssessmentTasks(ctx, q))
    if (method === 'POST') return ok(res, createAssessmentTask(ctx, await body()))
  }
  // 任务详情（API-CONTRACT §3.4；阶段 A 接线 getAssessmentTask）
  m = /^\/v1\/ltc\/(?:assessment-tasks|tasks)\/([A-Za-z0-9_-]+)$/.exec(path)
  if (method === 'GET' && m) return ok(res, getAssessmentTask(ctx, m[1]))
  const taskAction = /^\/v1\/ltc\/(?:assessment-tasks|tasks)\/([A-Za-z0-9_-]+)\/(accept|start|evidence|submit|return|expert-review)$/.exec(path)
  if (method === 'POST' && taskAction) {
    const [, taskId, action] = taskAction
    const b = await body()
    if (action === 'accept') return ok(res, acceptTask(ctx, taskId))
    if (action === 'start') return ok(res, startTask(ctx, taskId))
    if (action === 'evidence') return ok(res, addEvidence(ctx, taskId, b))
    if (action === 'submit') return ok(res, submitTask(ctx, taskId, b))
    if (action === 'return') return ok(res, returnTask(ctx, taskId, b))
    if (action === 'expert-review') return ok(res, expertReviewTask(ctx, taskId, b))
  }

  // 证据查询 (GET /v1/ltc/evidence)
  if (path === '/v1/ltc/evidence') {
    if (method === 'GET') return okList(listEvidence(ctx, q?.task_id))
  }

  // 设备介入数据包快照 (POST /v1/ltc/snapshots, GET /v1/ltc/snapshots/:id, GET /v1/ltc/snapshots)
  if (path === '/v1/ltc/snapshots') {
    if (method === 'GET') return okList(listAssessmentSnapshots(ctx, q))
    if (method === 'POST') return ok(res, createAssessmentSnapshot(ctx, await body()))
  }
  const snapMatch = /^\/v1\/ltc\/snapshots\/([A-Za-z0-9_-]+)$/.exec(path)
  if (method === 'GET' && snapMatch) {
    return ok(res, getAssessmentSnapshot(ctx, snapMatch[1]))
  }

  // 评估师处理 AI 洞察 (GET /v1/ltc/insights, POST /v1/ltc/insights/:id/handle)
  if (path === '/v1/ltc/insights') {
    if (method === 'GET') return okList(listAssessmentInsights(ctx, q))
  }
  const insightMatch = /^\/v1\/ltc\/insights\/([A-Za-z0-9_-]+)\/handle$/.exec(path)
  if (method === 'POST' && insightMatch) {
    return ok(res, handleInsight(ctx, insightMatch[1], await body()))
  }

  // 服务计划与服务执行
  if (path === '/v1/ltc/service-plans') {
    if (method === 'GET') return okList(listServicePlans(ctx, q))
  }
  if (path === '/v1/ltc/service-visits') {
    if (method === 'GET') return okList(listServiceVisits(ctx, q))
  }
  if (path === '/v1/ltc/service-evidence') {
    if (method === 'GET') return okList(listServiceEvidence(ctx, q))
  }

  // 结算 (GET /v1/ltc/settlements, POST /v1/ltc/settlements/:id/review, GET /v1/ltc/settlements/:id/voucher)
  if (path === '/v1/ltc/settlements') {
    if (method === 'GET') return okList(listSettlements(ctx, q))
  }
  const setReviewMatch = /^\/v1\/ltc\/settlements\/([A-Za-z0-9_-]+)\/review$/.exec(path)
  if (method === 'POST' && setReviewMatch) {
    return ok(res, reviewSettlement(ctx, setReviewMatch[1], await body()))
  }
  const setVoucherMatch = /^\/v1\/ltc\/settlements\/([A-Za-z0-9_-]+)\/voucher$/.exec(path)
  if (method === 'GET' && setVoucherMatch) {
    return ok(res, getSettlementVoucher(ctx, setVoucherMatch[1]))
  }

  // 设备质量事件 (GET /v1/ltc/quality-events, POST /v1/ltc/quality-events/:id/dispose)
  if (path === '/v1/ltc/quality-events') {
    if (method === 'GET') return okList(listQualityEvents(ctx, q))
  }
  const qeDisposeMatch = /^\/v1\/ltc\/quality-events\/([A-Za-z0-9_-]+)\/dispose$/.exec(path)
  if (method === 'POST' && qeDisposeMatch) {
    return ok(res, disposeQualityEvent(ctx, qeDisposeMatch[1], await body()))
  }

  // 经办审核通过并定级
  const revApprove = /^\/v1\/ltc\/reviews\/([A-Za-z0-9_-]+)\/approve$/.exec(path)
  if (method === 'POST' && revApprove) return ok(res, approveReview(ctx, revApprove[1], await body()))

  // 监管案件
  if (path === '/v1/ltc/supervision-cases') {
    if (method === 'GET') return ok(res, listSupervisionCases(ctx, q))
    if (method === 'POST') return ok(res, createSupervisionCase(ctx, await body()))
  }

  // 医保专班深度监管体系 (Supervision Platform)
  if (path === '/v1/ltc/supervision/dashboard' && method === 'GET') {
    return ok(res, getSupervisionDashboard(ctx, q))
  }
  if (path === '/v1/ltc/supervision/mode' && method === 'POST') {
    return ok(res, switchGovernanceMode(ctx, await body()))
  }
  if (path === '/v1/ltc/supervision/clues') {
    if (method === 'GET') return okList(listSupervisionClues(ctx, q))
  }
  if (path === '/v1/ltc/supervision/clues/scan' && method === 'POST') {
    return ok(res, scanSupervisionClues(ctx, await body()))
  }
  if (path === '/v1/ltc/supervision/clues/dispatch' && method === 'POST') {
    const b = await body()
    return ok(res, dispatchSupervisionClue(ctx, b.clue_id, b))
  }
  if (path === '/v1/ltc/supervision/clues/feedback' && method === 'POST') {
    const b = await body()
    return ok(res, feedbackSupervisionClue(ctx, b.clue_id, b))
  }
  if (path === '/v1/ltc/supervision/clues/adjudicate' && method === 'POST') {
    const b = await body()
    return ok(res, adjudicateSupervisionClue(ctx, b.clue_id, b))
  }
  const clueActionMatch = /^\/v1\/ltc\/supervision\/clues\/([A-Za-z0-9_-]+)\/(dispatch|feedback|adjudicate)$/.exec(path)
  if (method === 'POST' && clueActionMatch) {
    const [, cId, act] = clueActionMatch
    const b = await body()
    if (act === 'dispatch') return ok(res, dispatchSupervisionClue(ctx, cId, b))
    if (act === 'feedback') return ok(res, feedbackSupervisionClue(ctx, cId, b))
    if (act === 'adjudicate') return ok(res, adjudicateSupervisionClue(ctx, cId, b))
  }
  if (path === '/v1/ltc/supervision/penetration' && method === 'GET') {
    return ok(res, getSupervisionPenetration(ctx, q))
  }

  // 失能评定机构与专家评审大盘 (Assessor & Expert Platform)
  if (path === '/v1/ltc/assessor/dashboard' && method === 'GET') {
    return ok(res, getAssessorDashboard(ctx, q))
  }

  // 受托经办机构业务中心 (Insurer TPA Platform)
  if (path === '/v1/ltc/insurer/dashboard' && method === 'GET') {
    return ok(res, getInsurerDashboard(ctx, q))
  }
  if (path === '/v1/ltc/insurer/inspections') {
    if (method === 'GET') return okList(listInsurerInspections(ctx, q))
  }
  const inspRecordMatch = /^\/v1\/ltc\/insurer\/inspections\/([A-Za-z0-9_-]+)\/record$/.exec(path)
  if (method === 'POST' && inspRecordMatch) {
    return ok(res, recordInsurerInspection(ctx, inspRecordMatch[1], await body()))
  }

  // 报告
  if (path === '/v1/ltc/reports' && method === 'GET') return ok(res, listReports(ctx, q))
  if (path === '/v1/ltc/reports/generate') {
    if (method === 'POST') return ok(res, generateReport(ctx, await body()))
    if (method === 'GET') return ok(res, generateReport(ctx, q))
  }
  m = /^\/v1\/ltc\/reports\/([A-Za-z0-9_-]+)$/.exec(path)
  if (method === 'GET' && m) return ok(res, getReport(ctx, m[1]))

  
  // ---- Phase D N03-N15 ----
  if (path === '/v1/ltc/family/bindings' && method === 'GET') return ok(res, listFamilyBindings(ctx))
  if (path === '/v1/ltc/family/binding-requests') {
    if (method === 'GET') return ok(res, listBindingRequests(ctx, q))
    if (method === 'POST') return ok(res, createBindingRequest(ctx, await body()))
  }
  {
    const br = /^\/v1\/ltc\/family\/binding-requests\/([A-Za-z0-9_-]+)\/actions$/.exec(path)
    if (method === 'POST' && br) return ok(res, bindingRequestAction(ctx, br[1], await body()))
  }
  {
    const ft = /^\/v1\/ltc\/family\/applications\/([A-Za-z0-9_-]+)\/timeline$/.exec(path)
    if (method === 'GET' && ft) return ok(res, listApplicationTimeline(ctx, ft[1]))
  }
  if (path === '/v1/ltc/appeals') {
    if (method === 'GET') return ok(res, listAppeals(ctx, q))
    if (method === 'POST') return ok(res, createAppeal(ctx, await body()))
  }
  {
    const ap = /^\/v1\/ltc\/appeals\/([A-Za-z0-9_-]+)$/.exec(path)
    if (method === 'GET' && ap) return ok(res, getAppeal(ctx, ap[1]))
    const apa = /^\/v1\/ltc\/appeals\/([A-Za-z0-9_-]+)\/actions$/.exec(path)
    if (method === 'POST' && apa) return ok(res, appealAction(ctx, apa[1], await body()))
  }
  if (path === '/v1/ltc/device-labels' && method === 'GET') return ok(res, listDeviceLabels(ctx, q))
  if (path === '/v1/ltc/device-labels/stats' && method === 'GET') return ok(res, deviceLabelStats(ctx, q))
  {
    const dl = /^\/v1\/ltc\/devices\/([A-Za-z0-9_-]+)\/labels$/.exec(path)
    if (method === 'PATCH' && dl) return ok(res, patchDeviceLabels(ctx, dl[1], await body()))
  }
  if (path === '/v1/ltc/device-bindings') {
    if (method === 'GET') return ok(res, listDeviceBindings(ctx, q))
    if (method === 'POST') return ok(res, createDeviceBinding(ctx, await body()))
  }
  {
    const db = /^\/v1\/ltc\/device-bindings\/([A-Za-z0-9_-]+)\/actions$/.exec(path)
    if (method === 'POST' && db) return ok(res, deviceBindingAction(ctx, db[1], await body()))
  }

return notFound(res, '接口不存在')
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

// ---------- 公屏 kiosk 只读投影（禁止冒充医保席位；硬件/LTC/管理面一律要真令牌） ----------
const SCREEN_GET_EXACT = new Set([
  '/v1/overview',
  '/v1/floors',
  '/v1/wards',
  '/v1/beds',
  '/v1/shift',
  '/v1/project/config',
  '/v1/patients',
  '/v1/alerts',
  '/v1/devices',
])
const SCREEN_GET_PREFIX = ['/v1/stats/', '/v1/geo/']
const SCREEN_GET_DETAIL = [
  /^\/v1\/patients\/[A-Za-z0-9_-]+$/,
  /^\/v1\/alerts\/[A-Za-z0-9_-]+$/,
]

function isSuqianScreenRequest(req, url) {
  const screenTenant = String(req.headers['x-screen-tenant'] || url?.searchParams?.get('tenant') || '').trim()
  if (screenTenant === 'anqiao') return false
  if (screenTenant === 'bureau_suqian') return true
  const referer = String(req.headers.referer || req.headers.origin || '')
  return (
    referer.includes('suqian') ||
    url?.searchParams?.get('pool') === 'suqian' ||
    String(url?.pathname || '').includes('suqian')
  )
}

function screenViewerAuth(req, url) {
  const suqian = isSuqianScreenRequest(req, url)
  if (suqian) {
    return {
      tenant_id: 'bureau_suqian',
      username: 'sq',
      staff_name: '宿迁长护险公屏',
      role: 'screen_viewer',
      unified_role: 'screen_viewer',
      workspace: 'device_monitoring',
      pool_id: 'suqian',
      scope: 'pool',
      data_scope: 'pool',
      kiosk: true,
    }
  }
  return {
    tenant_id: 'anqiao',
    username: 'gp',
    staff_name: '中科安樵公屏',
    role: 'screen_viewer',
    unified_role: 'screen_viewer',
    workspace: 'device_monitoring',
    pool_id: null,
    scope: 'org',
    data_scope: 'org',
    kiosk: true,
  }
}

function isScreenPublicGet(method, path) {
  if (method !== 'GET') return false
  if (
    path.startsWith('/v1/ltc/') ||
    path.startsWith('/v1/hardware/') ||
    path.startsWith('/v1/admin/') ||
    path.startsWith('/v1/auth/') ||
    path.startsWith('/v1/partner/') ||
    path.startsWith('/v1/sales/') ||
    path === '/v1/tenants'
  ) {
    return false
  }
  if (SCREEN_GET_EXACT.has(path)) return true
  if (SCREEN_GET_PREFIX.some((p) => path.startsWith(p))) return true
  return SCREEN_GET_DETAIL.some((re) => re.test(path))
}

function canAllocateUsers(authPayload) {
  return authPayload?.role === 'su' || authPayload?.unified_role === 'su'
}

function handleScreenAuth(req, res, url) {
  const payload = {
    ...screenViewerAuth(req, url),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  return ok(res, {
    token: signToken(payload),
    staff: { name: payload.staff_name, role: payload.role, unified_role: payload.unified_role },
    tenant: { tenant_id: payload.tenant_id, name: getTenantName(payload.tenant_id), kind: getTenantKind(payload.tenant_id) },
    workspace: payload.workspace,
    pool_id: payload.pool_id,
    permissions: effectivePermissionsOf(payload),
    data_scope: payload.data_scope,
  })
}

function handleWsUpgrade(req, socket) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/v1/ws') {
    socket.destroy()
    return
  }
  // 鉴权：必须带有效 token；禁止无令牌 / 无效令牌握手
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
  try {
    const ov = computeOverview(tenantId)
    if (ov) wsSend(socket, 'overview', ov)
  } catch (err) {
    console.error(`[ws] push initial overview error for tenant ${tenantId}:`, err && err.message)
  }
}

// ---------- WS 推送循环（全局租户级，断连客户端自动从注册表清理）----------
// vitals：每 3 秒每租户随机挑 1-3 个床位推一条（厂商租户无床位体征，自动跳过）
setInterval(() => {
  for (const tenantId of TENANT_IDS) {
    try {
      const updates = walkVitals(tenantId)
      if (updates.length > 0 && wsClients.has(tenantId)) {
        for (const u of updates) broadcast(tenantId, 'vitals', u)
      }
    } catch (err) {
      console.error(`[ws] walkVitals error for ${tenantId}:`, err && err.message)
    }
  }
}, 3000)

// alert：低频新告警（45-75s；WS_ALERT_FAST=1 时 5-8s），插入租户数据并广播 + 推 overview
// 模拟器故障只记日志，绝不允许杀死 API 进程（2026-09-27 生产 502 事故教训）
// 间隔的随机相位由（租户, 当日, 轮次）种子派生（SIM-TELEMETRY-DESIGN §4.2）——
// 时序间隔本身不属"数据稳定性"承诺，确定性仅用于可复现测试。
const ALERT_INTERVAL_RANGE = process.env.WS_ALERT_FAST ? [5000, 8000] : [45000, 75000]
let alertRoundSeq = 0
function fnv1aHash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
function dateSeedHash(dateStr) {
  return fnv1aHash(String(dateStr))
}
function nextAlertDelay(tenantId) {
  const [min, max] = ALERT_INTERVAL_RANGE
  const rnd = mulberry32((alertRoundSeq++ ^ (fnv1aHash(tenantId) ^ dateSeedHash(todayStr8()))) >>> 0)
  return min + rnd() * (max - min)
}
function scheduleLiveAlert(tenantId) {
  const delay = nextAlertDelay(tenantId)
  setTimeout(() => {
    let alert = null
    try {
      alert = generateLiveAlert(tenantId)
    } catch (err) {
      console.error('[ws] 实时告警生成失败（跳过本轮，服务不受影响）:', err && err.message)
    }
    if (alert && wsClients.has(tenantId)) {
      broadcast(tenantId, 'alert', alert)
      try {
        const ov = computeOverview(tenantId)
        if (ov) broadcast(tenantId, 'overview', ov)
      } catch (err) {
        console.error('[ws] alert broadcast overview error:', err && err.message)
      }
    }
    scheduleLiveAlert(tenantId)
  }, delay)
}
for (const id of TENANT_IDS) scheduleLiveAlert(id)

// overview：每 30 秒低频推送
setInterval(() => {
  for (const tenantId of wsClients.keys()) {
    try {
      const ov = computeOverview(tenantId)
      if (ov) broadcast(tenantId, 'overview', ov)
    } catch (err) {
      console.error('[ws] interval broadcast overview error:', err && err.message)
    }
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Screen-Tenant',
      'Access-Control-Max-Age': '86400',
    })
    return res.end()
  }

  try {
    if (method === 'POST' && path === '/v1/auth/login') {
      return await handleLogin(req, res)
    }
    if (method === 'POST' && path === '/v1/auth/screen') {
      return handleScreenAuth(req, res, url)
    }
    if (method === 'POST' && path === '/v1/public/leads') {
      const ip = clientIp(req)
      const limited = checkPublicLeadRate(ip)
      if (!limited.ok) return send(res, 429, 429, `提交过于频繁，请 ${limited.retryAfter} 秒后重试`)
      let body
      try {
        body = await readBody(req)
      } catch {
        return badRequest(res, '请求体格式错误')
      }
      try {
        const result = await createWebsiteLead({
          body,
          ip,
          referer: typeof req.headers.referer === 'string' ? req.headers.referer : null,
        })
        if (!result.ok) return badRequest(res, result.message)
        return ok(res, result.data)
      } catch (err) {
        console.error('[public-leads] persist failed:', err && err.message)
        return send(res, 500, 500, '提交失败，请稍后重试')
      }
    }

    // 以下接口要求 Bearer 令牌。公屏只读 GET 可注入受限 screen_viewer，禁止冒充医保/LTC；硬件仅在册 2.8 只读。
    if (path.startsWith('/v1/')) {
      let authPayload = auth(req)
      const reqTenant = req.headers['x-screen-tenant']
      if (authPayload && isScreenViewer(authPayload) && reqTenant && authPayload.tenant_id !== reqTenant) {
        authPayload = null
      }
      if (!authPayload) {
        if (!isScreenPublicGet(method, path)) {
          return unauthorized(res, '公屏会话已失效，请重新校验')
        }
        authPayload = screenViewerAuth(req, url)
      }

      if (method === 'POST' && path === '/v1/auth/switch') {
        return await handleTenantSwitch(req, res, authPayload)
      }
      // 权限变更后的会话刷新（W2）：凭当前 token 拉最新账号权限，不必等 8h 过期重登
      if (method === 'GET' && path === '/v1/auth/session') {
        const account = ACCOUNTS.find((a) => a.username === authPayload.username)
        if (!account) return unauthorized(res, '账号不存在或已停用')
        return ok(res, {
          username: account.username,
          staff: { name: account.staff_name, role: account.role, unified_role: account.unified_role },
          tenant: { tenant_id: account.tenant_id, name: getTenantName(account.tenant_id), kind: getTenantKind(account.tenant_id) },
          workspace: account.workspace || workspaceOf(account.role),
          permissions: effectivePermissionsOf(account),
          data_scope: account.scope || dataScopeOf(account.role),
          workspaces: authorizedWorkspacesFor(account.role, account),
          granted_perms: Array.isArray(account.granted_perms) ? account.granted_perms : parsePermColumn(account.granted_perms),
          revoked_perms: Array.isArray(account.revoked_perms) ? account.revoked_perms : parsePermColumn(account.revoked_perms),
        })
      }
      if (method === 'POST' && path === '/v1/auth/change-password') {
        const body = await readBody(req).catch(() => ({}))
        const oldP = typeof body.old_password === 'string' ? body.old_password : ''
        const newP = typeof body.new_password === 'string' ? body.new_password : ''
        if (!oldP || !newP) return badRequest(res, 'old_password/new_password 必填')
        if (newP.length < 6) return badRequest(res, '新口令至少 6 位')
        const account = ACCOUNTS.find((a) => a.username === authPayload.username)
        if (!account) return notFound(res, '账号不存在')
        if (!(await verifyPassword(oldP, account.password_hash))) {
          return badRequest(res, '当前口令不正确')
        }
        account.password_hash = hashPassword(newP, randomBytes(16).toString('hex'))
        await saveAccountHash(account.username, account.password_hash)
        return ok(res, { username: account.username, changed: true })
      }

      // ---------- 租户内账号与权限管理（N28，三层模型：用户-组-颗粒） ----------
      // 守卫：操作者持 user:manage（护理院院长组默认有）+ 目标账号必须同租户。
      // 无创建端点——租户内账号仅来自预置角色栈（业主口径：不支持伙伴自建用户）。
      if (method === 'GET' && path === '/v1/org/users') {
        const authRes = authorize(authPayload, 'user:manage')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        const list = ACCOUNTS.filter((a) => a.tenant_id === authPayload.tenant_id).map((a) => ({
          username: a.username,
          display_name: a.staff_name,
          role: a.role,
          unified_role: a.unified_role,
          workspace: a.workspace,
          scope: a.scope,
          granted_perms: Array.isArray(a.granted_perms) ? a.granted_perms : parsePermColumn(a.granted_perms),
          revoked_perms: Array.isArray(a.revoked_perms) ? a.revoked_perms : parsePermColumn(a.revoked_perms),
          permissions: effectivePermissionsOf(a),
        }))
        return ok(res, { list, total: list.length })
      }
      if (method === 'GET' && path === '/v1/org/permission-catalog') {
        const authRes = authorize(authPayload, 'user:manage')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return ok(res, { codes: ALL_PERMISSION_CODES })
      }

      // ---------- N28a 权限组 CRUD（自定义组，租户私有）----------
      // 守卫：user:manage + 组必须属本租户；内置组（auth.js ROLE_PERMISSIONS 键）只读不可增删改；
      // 组名只是显示名，账号挂组靠 group_id（role 字段存 custom:<group_id> 或内置组键）。
      if (path === '/v1/org/perm-groups' && ['GET', 'POST'].includes(method)) {
        const authRes = authorize(authPayload, 'user:manage')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        if (method === 'GET') {
          const rows = await loadPermGroups(authPayload.tenant_id)
          return ok(res, {
            builtin: Object.keys(ROLE_PERMISSIONS).map((k) => ({ group_id: k, name: k, codes: ROLE_PERMISSIONS[k], builtin: true })),
            custom: rows.map((r) => ({ group_id: r.group_id, name: r.name, codes: r.codes, builtin: false })),
          })
        }
        // POST 新建
        const body = await readBody(req).catch(() => ({}))
        const gName = String(body?.name || '').trim()
        const gCodes = Array.isArray(body?.codes) ? body?.codes : null
        if (!gName || gName.length > 40) return badRequest(res, '组名必填（≤40 字符）')
        if (!gCodes) return badRequest(res, 'codes 必填（颗粒数组）')
        const bad = gCodes.filter((c) => !ALL_PERMISSION_CODES.includes(c))
        if (bad.length) return badRequest(res, `未知权限颗粒: ${bad.join(', ')}`)
        if (Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, gName)) {
          return badRequest(res, '组名与内置组键冲突')
        }
        const groupId = 'pg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
        const group = { group_id: groupId, tenant_id: authPayload.tenant_id, name: gName, codes: [...new Set(gCodes)], created_by: authPayload.username }
        const saved = await savePermGroup(group)
        if (!saved) return send(res, 500, 500, '组保存失败')
        permGroupsById.set(groupId, { ...group, codes: JSON.stringify(group.codes) })
        return ok(res, { group_id: groupId, name: gName, codes: group.codes, builtin: false })
      }
      const permGroupMatch = /^\/v1\/org\/perm-groups\/([A-Za-z0-9_-]+)$/.exec(path)
      if (permGroupMatch && ['PATCH', 'DELETE'].includes(method)) {
        const authRes = authorize(authPayload, 'user:manage')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        const groupId = permGroupMatch[1]
        if (Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, groupId)) {
          return send(res, 403, 403, '内置组只读（代码发版变更），不可运行时增删改')
        }
        const owned = (await loadPermGroups(authPayload.tenant_id)).find((g) => g.group_id === groupId)
        if (!owned) return notFound(res, '权限组不存在')
        if (method === 'DELETE') {
          const refCount = ACCOUNTS.filter((a) => a.tenant_id === authPayload.tenant_id && a.role === `custom:${groupId}`).length
          if (refCount > 0) return badRequest(res, `该组仍被 ${refCount} 个账号引用，先改挂其他组再删除`)
          await deletePermGroup(groupId, authPayload.tenant_id)
          permGroupsById.delete(groupId)
          return ok(res, { group_id: groupId, deleted: true })
        }
        // PATCH 改名/改颗粒
        const body = await readBody(req).catch(() => ({}))
        const next = { ...owned }
        if (typeof body?.name === 'string' && body.name.trim()) next.name = body.name.trim().slice(0, 40)
        if (Array.isArray(body?.codes)) {
          const bad = body.codes.filter((c) => !ALL_PERMISSION_CODES.includes(c))
          if (bad.length) return badRequest(res, `未知权限颗粒: ${bad.join(', ')}`)
          next.codes = [...new Set(body.codes)]
        }
        const saved = await savePermGroup({ ...next, created_by: owned.created_by })
        if (!saved) return send(res, 500, 500, '组保存失败')
        permGroupsById.set(groupId, { ...next, codes: JSON.stringify(next.codes) })
        return ok(res, { group_id: groupId, name: next.name, codes: next.codes, builtin: false })
      }
      const orgUserMatch = /^\/v1\/org\/users\/([A-Za-z0-9_-]+)$/.exec(path)
      if (orgUserMatch && method === 'PATCH') {
        const authRes = authorize(authPayload, 'user:manage')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        const target = ACCOUNTS.find((a) => a.username === orgUserMatch[1])
        if (!target) return notFound(res, '账号不存在')
        if (target.tenant_id !== authPayload.tenant_id) {
          return send(res, 403, 403, '只能管理本组织账号')
        }
        if (target.role === 'su' || target.unified_role === 'su') {
          return send(res, 403, 403, '平台超管账号不受租户级微调约束')
        }
        const body = await readBody(req).catch(() => ({}))

        // 换组（N28a）：group = 内置组键 或 custom:<group_id>（本租户自定义组）
        if (typeof body.group === 'string' && body.group) {
          const g = body.group
          if (g.startsWith('custom:')) {
            const gid = g.slice('custom:'.length)
            const owned = (await loadPermGroups(target.tenant_id)).find((x) => x.group_id === gid)
            if (!owned) return notFound(res, '自定义组不存在或不属本租户')
          } else if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, g)) {
            return badRequest(res, `未知组: ${g}`)
          }
          target.role = g
          target.unified_role = g
          // 换组后清空旧微调，避免跨组语义残留（组已换，旧覆盖不再有意义）
          target.granted_perms = []
          target.revoked_perms = []
        }

        // 颗粒微调：只接受全集内的字符串；reset_perms 一键回组默认
        if (body.reset_perms) {
          target.granted_perms = []
          target.revoked_perms = []
        } else {
          if (Array.isArray(body.granted_perms)) {
            const bad = body.granted_perms.filter((c) => !ALL_PERMISSION_CODES.includes(c))
            if (bad.length) return badRequest(res, `未知权限颗粒: ${bad.join(', ')}`)
            target.granted_perms = [...new Set(body.granted_perms)]
          }
          if (Array.isArray(body.revoked_perms)) {
            const bad = body.revoked_perms.filter((c) => !ALL_PERMISSION_CODES.includes(c))
            if (bad.length) return badRequest(res, `未知权限颗粒: ${bad.join(', ')}`)
            target.revoked_perms = [...new Set(body.revoked_perms)]
          }
        }
        if (typeof body.new_password === 'string' && body.new_password.length >= 6) {
          target.password_hash = hashPassword(body.new_password, randomBytes(16).toString('hex'))
        }
        await saveSaaSUser({
          username: target.username,
          password_hash: target.password_hash,
          display_name: target.staff_name,
          unified_role: target.unified_role,
          role: target.role,
          tenant_id: target.tenant_id,
          workspace: target.workspace,
          scope: target.scope,
          granted_perms: target.granted_perms,
          revoked_perms: target.revoked_perms,
          created_by: authPayload.username,
        })
        return ok(res, {
          username: target.username,
          role: target.role,
          granted_perms: target.granted_perms,
          revoked_perms: target.revoked_perms,
          permissions: effectivePermissionsOf(target),
        })
      }

      // ---------- 用户管理（生产口径：仅 su 角色可开号，禁止按中文名硬编码门闩） ----------
      const isAllocator = canAllocateUsers(authPayload)
      if (isAllocator && path === '/v1/admin/users' && method === 'GET') {
        return ok(res, {
          list: ACCOUNTS.map((a) => ({
            username: a.username,
            display_name: a.staff_name,
            unified_role: a.unified_role,
            role: a.role,
            tenant_id: a.tenant_id,
            workspace: a.workspace,
            scope: a.scope,
          })),
          total: ACCOUNTS.length,
        })
      }
      if (isAllocator && path === '/v1/admin/users' && method === 'POST') {
        const body = await readBody(req).catch(() => ({}))
        const username = typeof body.username === 'string' ? body.username.trim() : ''
        const password = typeof body.password === 'string' ? body.password : ''
        if (!username || password.length < 6) return badRequest(res, 'username 必填，password 至少 6 位')
        if (ACCOUNTS.some((a) => a.username === username)) {
          return ok(res, { code: 409, msg: '用户名已存在', data: null })
        }
        const nu = {
          username,
          password_hash: hashPassword(password, randomBytes(16).toString('hex')),
          staff_name: String(body.display_name || username).slice(0, 40),
          role: String(body.role || 'business_user'),
          unified_role: String(body.unified_role || body.role || 'business_user'),
          tenant_id: String(body.tenant_id || 'anqiao'),
          workspace: String(body.workspace || 'platform_operations'),
          scope: String(body.scope || 'org'),
        }
        ACCOUNTS.push(nu)
        await saveSaaSUser({
          username,
          password_hash: nu.password_hash,
          display_name: nu.staff_name,
          unified_role: nu.unified_role,
          role: nu.role,
          tenant_id: nu.tenant_id,
          workspace: nu.workspace,
          scope: nu.scope,
          created_by: authPayload.username,
        })
        return ok(res, { username, created: true })
      }
      const adminUserMatch = /^\/v1\/admin\/users\/([A-Za-z0-9_-]+)$/.exec(path)
      if (isAllocator && adminUserMatch) {
        const target = adminUserMatch[1]
        const acct = ACCOUNTS.find((a) => a.username === target)
        if (!acct) return notFound(res, '用户不存在')
        if (method === 'PATCH') {
          const body = await readBody(req).catch(() => ({}))
          if (typeof body.display_name === 'string' && body.display_name.trim()) acct.staff_name = body.display_name.trim().slice(0, 40)
          if (typeof body.unified_role === 'string' && body.unified_role) acct.unified_role = body.unified_role
          if (typeof body.workspace === 'string' && body.workspace) acct.workspace = body.workspace
          if (typeof body.tenant_id === 'string' && body.tenant_id) {
            acct.tenant_id = body.tenant_id
            acct.org_id = body.tenant_id
          }
          if (typeof body.new_password === 'string' && body.new_password.length >= 6) {
            acct.password_hash = hashPassword(body.new_password, randomBytes(16).toString('hex'))
          }
          await saveSaaSUser({
            username: acct.username,
            password_hash: acct.password_hash,
            display_name: acct.staff_name,
            unified_role: acct.unified_role,
            role: acct.role,
            tenant_id: acct.tenant_id,
            workspace: acct.workspace,
            scope: acct.scope || 'org',
            created_by: authPayload.username,
          })
          return ok(res, { username: target, updated: true })
        }
        if (method === 'DELETE') {
          if (['su01', 'admin01', 'admin'].includes(target)) return badRequest(res, '核心管理账号不可停用')
          await deleteSaaSUser(target)
          const idx = ACCOUNTS.findIndex((a) => a.username === target)
          if (idx >= 0) ACCOUNTS.splice(idx, 1)
          return ok(res, { username: target, deactivated: true })
        }
      }
      if (method === 'GET' && path === '/v1/overview') {

        return handleOverview(req, res, authPayload)
      }
      // ---------- 平台业务只读面（N28 联动）：颗粒 revoke 需真实拦截 ----------
      // 这些路由历史上仅靠工作台隔离、不前置 authorize——三层模型下颗粒开关必须可感知，
      // 统一补 read 颗粒门控（screen_viewer 公屏注入账号在此前已被推入，同受组权限约束）。
      if (method === 'GET' && path === '/v1/alerts') {
        const authRes = authorize(authPayload, 'alert:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handleAlertsList(req, res, authPayload, url)
      }
      const alertAction = /^\/v1\/alerts\/([A-Za-z0-9_-]+)\/(handle|claim)$/.exec(path)
      if (method === 'POST' && alertAction) {
        const authRes = authorize(authPayload, alertAction[2] === 'claim' ? 'alert:claim' : 'alert:handle')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return alertAction[2] === 'claim'
          ? await handleAlertClaim(req, res, authPayload, alertAction[1])
          : await handleAlertHandle(req, res, authPayload, alertAction[1])
      }
      if (method === 'GET' && path === '/v1/shift') {
        const authRes = authorize(authPayload, 'shift:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handleShift(req, res, authPayload)
      }
      if (method === 'GET' && path === '/v1/geo/cities') {
        const authRes = authorize(authPayload, 'geo:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handleGeoCities(req, res, authPayload)
      }
      if (method === 'GET' && path === '/v1/geo/devices') {
        const authRes = authorize(authPayload, 'geo:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handleGeoDevices(req, res, authPayload, url)
      }
      if (method === 'GET' && path === '/v1/patients') {
        const authRes = authorize(authPayload, 'patient:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handlePatientsList(req, res, authPayload, url)
      }
      const patientMatch = /^\/v1\/patients\/([A-Za-z0-9_-]+)$/.exec(path)
      if (method === 'GET' && patientMatch) {
        // 语义次序：先租户隔离 404（跨机构 patient_id 按租户查不到，账号矩阵 §4 契约），后 read 颗粒 403
        const detail = getPatientDetail(authPayload.tenant_id, patientMatch[1])
        if (!detail) return notFound(res, '长者不存在')
        const authRes = authorize(authPayload, 'patient:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handlePatientDetail(req, res, authPayload, patientMatch[1])
      }
      if (method === 'GET' && path === '/v1/devices') {
        const authRes = authorize(authPayload, 'device:read')
        if (!authRes.allow) return send(res, authRes.status, authRes.status, authRes.message)
        return handleDevicesList(req, res, authPayload, url)
      }
      if (method === 'POST' && path === '/v1/devices') {
        let body
        try {
          body = await readBody(req)
        } catch {
          return badRequest(res, '请求体格式错误')
        }
        try {
          return ok(res, createDeviceAsset(ltcCtx(authPayload), body))
        } catch (err) {
          return mapLtcError(res, err)
        }
      }
      // ---------- 销售客户资产视图（N21–N25）与租户管理（N26–N27，多业态设计 §4/§6） ----------
      if (method === 'GET' && path === '/v1/sales/institutions') {
        return handleSalesInstitutions(req, res, authPayload)
      }
      const salesOrgMatch = /^\/v1\/sales\/institutions\/([A-Za-z0-9_-]+)\/(devices|vitals-summary|alerts|telemetry)$/.exec(path)
      if (method === 'GET' && salesOrgMatch) {
        const [, salesOrgId, salesSub] = salesOrgMatch
        if (salesSub === 'devices') return handleSalesOrgDevices(req, res, authPayload, salesOrgId)
        if (salesSub === 'vitals-summary') return await handleSalesOrgVitals(req, res, authPayload, salesOrgId)
        if (salesSub === 'alerts') return handleSalesOrgAlerts(req, res, authPayload, salesOrgId)
        return await handleSalesOrgTelemetry(req, res, authPayload, salesOrgId, url)
      }
      if (method === 'GET' && path === '/v1/tenants') {
        const tenantViewer = ACCOUNTS.find((a) => a.username === authPayload.username)
        if (!tenantViewer || !['admin', 'su'].includes(tenantViewer.role)) return notFound(res, '无该数据面')
        return ok(res, {
          list: Object.entries(TENANT_CONFIGS).map(([tenant_id, c]) => ({
            tenant_id, name: c.name, kind: c.kind, vertical: c.vertical, template: c.template, deployment: c.deployment,
          })),
        })
      }
      if (method === 'POST' && path === '/v1/admin/tenants') {
        if (!canAllocateUsers(authPayload)) return send(res, 403, 403, '仅平台超管（su）可开租户')
        let body
        try {
          body = await readBody(req)
        } catch {
          return badRequest(res, '请求体格式错误')
        }
        const newTenantId = String(body?.tenant_id || '').trim()
        const newTenantName = String(body?.name || '').trim()
        const newTenantVertical = String(body?.vertical || '').trim()
        const newTenantTemplate = String(body?.template || '').trim()
        if (!/^[a-z0-9_]{3,64}$/.test(newTenantId)) return badRequest(res, 'tenant_id 格式非法（3-64 位小写字母/数字/下划线）')
        if (!newTenantName) return badRequest(res, 'name 必填')
        if (!['nursing_home', 'senior_community', 'home_care', 'health_wellness'].includes(newTenantVertical)) {
          return badRequest(res, 'vertical 必须为四业态之一')
        }

        // N27a 伙伴沙箱（SIM-TELEMETRY-DESIGN §5）：partner_sandbox 字段出现即走沙箱开通
        if (body?.partner_sandbox) {
          if (newTenantVertical !== 'nursing_home') {
            return badRequest(res, '伙伴沙箱首期仅支持 nursing_home 业态')
          }
          const initPassword = process.env.SEED_ACCOUNT_PASSWORD
          if (!initPassword) return send(res, 500, 500, 'SEED_ACCOUNT_PASSWORD 未注入，无法为沙箱账号设初始密码')
          // 用户名 = tenantId_角色后缀，saas_users.username 上限 64；tenant_id ≤24 保证最长角色后缀不超限
          if (newTenantId.length > 24) {
            return badRequest(res, '伙伴沙箱 tenant_id 过长（≤24 位，账号名 = tenantId_角色后缀 且 username 上限 64）')
          }
          const sandbox = registerPartnerSandbox(
            newTenantId,
            { name: newTenantName, vertical: newTenantVertical, template: newTenantTemplate },
            {
              simDeviceCount: Number(body.partner_sandbox.sim_device_count) || 12,
              snExists: (sn) => DEVICE_ASSETS.some((d) => d.sn === sn || d.device_id === sn),
            },
          )
          if (!sandbox) return send(res, 409, 409, '租户已存在或该业态模板未上线')

          // 账号落 ACCOUNTS + saas_users（既有机制，散列同种子策略：argon2id 随机 salt）
          const createdAccounts = []
          for (const acct of sandbox.accounts) {
            if (ACCOUNTS.some((a) => a.username === acct.username)) continue
            const nu = {
              ...acct,
              password_hash: await hashPasswordArgon2(initPassword),
            }
            ACCOUNTS.push(nu)
            await saveSaaSUser({
              username: nu.username,
              password_hash: nu.password_hash,
              display_name: nu.staff_name,
              unified_role: nu.unified_role,
              role: nu.role,
              tenant_id: nu.tenant_id,
              workspace: nu.workspace,
              scope: nu.scope,
              is_seed: true,
              created_by: authPayload.username,
            }).catch((err) => console.error('[server] 沙箱账号落库失败:', nu.username, err.message))
            createdAccounts.push({
              username: nu.username, role: nu.role, workspace: nu.workspace, staff_name: nu.staff_name,
            })
          }

          // SIM 设备登记进 DEVICE_ASSETS（公屏在册白名单同源；生命周期日志 + 持久化走既有机制）
          const createdDevices = []
          for (const sd of sandbox.simDevices) {
            if (DEVICE_ASSETS.some((d) => d.sn === sd.sn || d.device_id === sd.sn)) continue
            const dev = {
              device_id: sd.sn,
              sn: sd.sn,
              label: `${newTenantName} · 演示设备`,
              type: 'health_guardian',
              hardware_asset_owner: sd.hardware_asset_owner,
              customer_org_id: sd.customer_org_id,
              procurement_channel: sd.procurement_channel,
              lifecycle_status: 'monitoring',
              online: true,
              last_data_time: nowIso8(),
            }
            DEVICE_ASSETS.push(dev)
            DEVICE_LIFECYCLE_LOGS.push({
              log_id: 'LOG-' + Date.now().toString(36).toUpperCase() + '-' + String(DEVICE_LIFECYCLE_LOGS.length + 1),
              device_id: dev.device_id,
              from_status: 'created',
              to_status: dev.lifecycle_status,
              operator_id: authPayload.username,
              organization_id: authPayload.tenant_id,
              occurred_at: nowIso8(),
              location: '',
              remark: '伙伴沙箱 SIM 设备开通 (N27a)',
            })
            createdDevices.push(sd.sn)
          }
          // 与 ltc.js persistDeviceRegistry 同构：仅持久层模式生效
          if (['sqlite', 'mysql'].includes(dataLayerMode())) {
            saveDeviceRegistry(DEVICE_ASSETS, DEVICE_LIFECYCLE_LOGS).catch((err) =>
              console.error('[server] 沙箱设备注册表持久化失败:', err.message),
            )
          }

          return ok(res, {
            tenant_id: newTenantId,
            name: sandbox.cfg.name,
            vertical: sandbox.cfg.vertical,
            template: sandbox.cfg.template,
            deployment: sandbox.cfg.deployment,
            partner_sandbox: {
              demo_disclaimer: true, // 常驻演示标识，恒开不可关（SIM-TELEMETRY §5.3）
              accounts: createdAccounts,
              sim_devices: createdDevices,
              persistence_note: '租户配置为内存态：服务重启后账号与设备资产仍在库，租户需重新开通',
            },
          })
        }

        const createdCfg = registerTenant(newTenantId, { name: newTenantName, vertical: newTenantVertical, template: newTenantTemplate })
        if (!createdCfg) return send(res, 409, 409, '租户已存在或该业态模板未上线')
        return ok(res, {
          tenant_id: newTenantId, name: createdCfg.name, vertical: createdCfg.vertical, template: createdCfg.template, deployment: createdCfg.deployment,
        })
      }
      const devAssetMatch = /^\/v1\/devices\/([A-Za-z0-9_-]+)$/.exec(path)
      if (devAssetMatch && (method === 'PATCH' || method === 'DELETE')) {
        let body = {}
        if (method === 'PATCH') {
          try {
            body = await readBody(req)
          } catch {
            return badRequest(res, '请求体格式错误')
          }
        }
        try {
          const result = method === 'PATCH'
            ? updateDeviceAsset(ltcCtx(authPayload), devAssetMatch[1], body)
            : deleteDeviceAsset(ltcCtx(authPayload), devAssetMatch[1])
          return ok(res, result)
        } catch (err) {
          return mapLtcError(res, err)
        }
      }
      if (path === '/v1/device-assignments' && (method === 'GET' || method === 'POST')) {
        try {
          if (method === 'GET') {
            return ok(res, listDeviceAssignments(ltcCtx(authPayload), {
              device_id: url.searchParams.get('device_id') || undefined,
            }))
          }
          const body = await readBody(req)
          return ok(res, createDeviceAssignment(ltcCtx(authPayload), body))
        } catch (err) {
          return mapLtcError(res, err)
        }
      }
      const devAssignmentMatch = /^\/v1\/device-assignments\/([A-Za-z0-9_-]+)$/.exec(path)
      if (devAssignmentMatch && method === 'DELETE') {
        try {
          return ok(res, deleteDeviceAssignment(ltcCtx(authPayload), devAssignmentMatch[1]))
        } catch (err) {
          return mapLtcError(res, err)
        }
      }
      const devLifecycle = /^\/v1\/devices\/([A-Za-z0-9_-]+)\/lifecycle$/.exec(path)
      if (method === 'POST' && devLifecycle) {
        return await handleDeviceLifecycle(req, res, authPayload, devLifecycle[1])
      }
      if (method === 'GET' && path === '/v1/devices/lifecycle-logs') {
        const deviceId = url.searchParams.get('device_id')
        let logs = [...DEVICE_LIFECYCLE_LOGS]
        if (deviceId) logs = logs.filter((l) => l.device_id === deviceId)
        return ok(res, { list: logs, total: logs.length })
      }
      if (method === 'GET' && path === '/v1/partner/channels') {
        return handlePartnerChannels(req, res, authPayload)
      }
      if (method === 'POST' && path === '/v1/partner/leads') {
        const account = ACCOUNTS.find((a) => a.username === authPayload.username)
        if (!account) return unauthorized(res)
        let body
        try {
          body = await readBody(req)
        } catch {
          return badRequest(res, '请求体格式错误')
        }
        const result = await createWorkbenchLead({ account, body, ip: clientIp(req) })
        if (!result.ok) return badRequest(res, result.message)
        return ok(res, result.data)
      }
      const partnerLeadAdvance = /^\/v1\/partner\/leads\/([A-Za-z0-9_-]+)\/advance$/.exec(path)
      if (method === 'POST' && partnerLeadAdvance) {
        const account = ACCOUNTS.find((a) => a.username === authPayload.username)
        if (!account) return unauthorized(res)
        let body = {}
        try {
          body = await readBody(req)
        } catch {
          return badRequest(res, '请求体格式错误')
        }
        const result = await advanceLead({ account, leadId: partnerLeadAdvance[1], status: body.status })
        if (!result.ok) return notFound(res, '线索不存在')
        return ok(res, result.data)
      }
      // 硬件云服务端代理（API-CONTRACT §3.5）。公屏仅 2.8/2.7.4 在册 SN 只读，管理接口仍 403。
      if (path.startsWith('/v1/hardware/')) {
        return await handleHardwareProxy(req, res, authPayload, url, path)
      }
      if (method === 'GET' && path === '/v1/project/config') {
        const cfg = getProjectConfig(authPayload.tenant_id)
        if (!cfg) return notFound(res, '项目配置不存在')
        return ok(res, cfg)
      }
      if (method === 'GET' && path === '/v1/floors') {
        const floors = listFloors(authPayload.tenant_id)
        if (floors === null) return notFound(res, '租户不存在')
        return ok(res, floors)
      }
      if (method === 'GET' && path === '/v1/wards') {
        const wards = listWards(authPayload.tenant_id, url.searchParams.get('floor') || undefined)
        if (wards === null) return notFound(res, '租户不存在')
        return ok(res, wards)
      }
      if (method === 'GET' && path === '/v1/beds') {
        const beds = listBeds(authPayload.tenant_id, {
          floor: url.searchParams.get('floor') || undefined,
          ward: url.searchParams.get('ward') || undefined,
        })
        if (beds === null) return notFound(res, '租户不存在')
        return ok(res, beds)
      }
      if (method === 'GET' && path === '/v1/stats/demographics') {
        const stats = getDemographics(authPayload.tenant_id)
        if (stats === null) return notFound(res, '租户不存在')
        return ok(res, stats)
      }
      if (method === 'GET' && path === '/v1/stats/rankings') {
        const stats = getRankings(authPayload.tenant_id)
        if (stats === null) return notFound(res, '租户不存在')
        return ok(res, stats)
      }
      if (path === '/v1/ws') {
        return badRequest(res, 'WebSocket 通道请使用 Upgrade 握手')
      }
      if (path.startsWith('/v1/ltc/')) {
        if (authPayload.kiosk || authPayload.role === 'screen_viewer' || authPayload.unified_role === 'screen_viewer') {
          return send(res, 403, 403, '公屏只读会话不得访问长护险数据面')
        }
        return await routeLtc(req, res, ltcCtx(authPayload), url).catch((err) => mapLtcError(res, err))
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

// 等 argon2id 口令升级完成再监听，避免首请求读到 scrypt 占位哈希
await passwordUpgradeReady.catch((err) => {
  console.error('[server] argon2id 口令升级失败:', err.message)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] 安守护 SaaS 综合后端已启动: http://127.0.0.1:${PORT} (${nowIso8()})`)
  console.log(`[server] 活跃租户: ${TENANT_IDS.map((id) => `${id}(${getTenantName(id)})`).join(', ')}`)
  console.log(`[server] WS 通道: ws://127.0.0.1:${PORT}/v1/ws?token=... (vitals 3s / alert ${ALERT_INTERVAL_RANGE[0] / 1000}-${ALERT_INTERVAL_RANGE[1] / 1000}s / overview 30s)`)
  console.log(`[server] 数据层: ${dataLayerMode()}${dataLayerMode() === 'sqlite' ? ` (db=${process.env.DB_PATH || 'server/anqiao.sqlite'})` : ' (store.json 回滚/种子模式)'}`)
  console.log(`[server] 硬件云代理: 2.8 按 device_id 转发（不要求 HW_ACCOUNT）`)
})

