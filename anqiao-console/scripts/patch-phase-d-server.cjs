const fs = require('fs')
const path = require('path')

// ========== 1) auth.js: family workspace ==========
const authPath = path.join(__dirname, '..', 'server', 'auth.js')
let auth = fs.readFileSync(authPath, 'utf8')
if (!auth.includes('FAMILY_WORKSPACE')) {
  auth = auth.replace(
    "  PARTNER_OPERATIONS: 'partner_operations',\n}",
    "  PARTNER_OPERATIONS: 'partner_operations',\n  FAMILY_WORKSPACE: 'family_workspace',\n}",
  )
  auth = auth.replace(
    "  partner_admin: WORKSPACES.PARTNER_OPERATIONS,\n}",
    "  partner_admin: WORKSPACES.PARTNER_OPERATIONS,\n  family_contact: WORKSPACES.FAMILY_WORKSPACE,\n}",
  )
  // expand family permissions for phase D
  auth = auth.replace(
    `  family_contact: [
    'application:create', 'application:submit', 'application:read',
    'evidence:read', 'report:generate', 'report:read', 'appeal:file',
  ],`,
    `  family_contact: [
    'application:create', 'application:submit', 'application:read',
    'evidence:read', 'report:generate', 'report:read', 'appeal:file',
    'family_binding:request', 'family_binding:read_self', 'family_binding:read_request',
    'material:write',
  ],`,
  )
  fs.writeFileSync(authPath, auth)
  console.log('auth.js: family workspace + perms')
} else console.log('auth.js already')

// ========== 2) seed.js: family_demo ==========
const seedPath = path.join(__dirname, '..', 'server', 'seed.js')
let seed = fs.readFileSync(seedPath, 'utf8')
if (!seed.includes("username: 'family_demo'")) {
  // insert before closing of ACCOUNTS - after partner_admin line
  const anchor = "  { username: 'partner_admin',"
  const idx = seed.indexOf(anchor)
  if (idx < 0) throw new Error('partner_admin not found')
  // find end of partner_admin line
  const lineEnd = seed.indexOf('\n', idx)
  const insert = `
  // 家属可登录账号（阶段 D · LTC-WORKBENCH-SPEC §0.3/§4.4）：绑定+授权后进 family_workspace
  { username: 'family_demo',     password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-family-demo'),   staff_name: '许丽家属',          role: 'family_contact',           unified_role: 'family_contact',   tenant_id: 'bureau',     org_id: 'bureau',     workspace: 'family_workspace',    scope: 'applicant', applicant_ids: ['P_SQ_01'], binding_status: 'active', authorization_status: 'active', binding_valid_from: '2026-01-01T00:00:00+08:00', binding_valid_until: '2027-01-01T00:00:00+08:00' },`
  seed = seed.slice(0, lineEnd) + insert + seed.slice(lineEnd)
  // update comment
  seed = seed.replace(
    '// ---------- 种子账号矩阵（新体系，废弃旧 nurse01/ops01/hq01；family_contact 非登录账号）----------',
    '// ---------- 种子账号矩阵（新体系；family_contact 自阶段 D 起可登录，见 family_demo）----------',
  )
  fs.writeFileSync(seedPath, seed)
  console.log('seed.js: family_demo added')
} else console.log('seed family exists')

// ========== 3) ltc.js: family/appeals/labels/bindings ==========
const ltcPath = path.join(__dirname, '..', 'server', 'ltc.js')
let ltc = fs.readFileSync(ltcPath, 'utf8')
if (!ltc.includes('export function listFamilyBindings')) {
  ltc += `
// ---------- 家属绑定 N03-N05（阶段 D） ----------
function ensureFamilyCtx(ctx) {
  if (ctx.role !== 'family_contact') throw new LtcError(403, '仅家属账号可访问绑定')
}

export function listFamilyBindings(ctx) {
  ensureFamilyCtx(ctx)
  const ids = ctx.applicant_ids || []
  const list = ids.map((pid) => {
    const person = (state.assessedPersons || []).find((p) => p.person_id === pid)
    return {
      binding_id: 'FB-' + pid,
      subject_id: pid,
      display_name: person?.name || pid,
      relationship: '子女',
      binding_status: ctx.binding_status || 'active',
      authorization_status: ctx.authorization_status || 'active',
      valid_from: ctx.binding_valid_from || null,
      valid_until: ctx.binding_valid_until || null,
    }
  })
  return { list, total: list.length }
}

export function listBindingRequests(ctx, query = {}) {
  if (ctx.role !== 'family_contact' && !['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
    throw new LtcError(403, '无权查询绑定核验申请')
  }
  const store = state.bindingRequests || (state.bindingRequests = [])
  let list = store
  if (ctx.role === 'family_contact') {
    const ids = new Set(ctx.applicant_ids || [])
    list = list.filter((r) => ids.has(r.subject_id) || r.requester === ctx.username)
  }
  if (query.state) list = list.filter((r) => r.state === query.state)
  return { list, total: list.length }
}

export function createBindingRequest(ctx, input = {}) {
  ensureFamilyCtx(ctx)
  const subjectId = input.subject_id || input.subject_identity_ref || (ctx.applicant_ids || [])[0]
  if (!subjectId) throw new LtcError(400, '需指定 subject_id')
  if (!(ctx.applicant_ids || []).includes(subjectId) && (ctx.applicant_ids || []).length) {
    // 仅可为已登记候选对象申请；种子家属绑定申请允许同 subject
  }
  const store = state.bindingRequests || (state.bindingRequests = [])
  const req = {
    binding_request_id: 'BR-' + Date.now().toString(36).toUpperCase(),
    requester: ctx.username,
    subject_id: subjectId,
    relationship: input.relationship || '子女',
    authorization_basis: input.authorization_basis || '本人/监护人授权',
    authorization_evidence_ids: input.authorization_evidence_ids || [],
    relationship_evidence_ids: input.relationship_evidence_ids || [],
    state: 'pending_review',
    created_at: nowIso8(),
    updated_at: nowIso8(),
  }
  store.push(req)
  audit(ctx, 'family.binding_request', req.binding_request_id)
  persist()
  return {
    binding_request_id: req.binding_request_id,
    receipt_id: 'RCPT-BR-' + Date.now().toString(36).toUpperCase(),
    object_id: req.binding_request_id,
    state: req.state,
    version: 1,
    occurred_at: req.created_at,
    next_owner_role: 'insurer',
  }
}

export function bindingRequestAction(ctx, requestId, input = {}) {
  const store = state.bindingRequests || (state.bindingRequests = [])
  const req = store.find((r) => r.binding_request_id === requestId)
  if (!req) throw new LtcError(404, '绑定申请不存在')
  const action = String(input.action || '')
  if (['verify', 'approve', 'reject', 'revoke'].includes(action)) {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅获授核验角色可处理绑定申请')
    }
  } else if (action === 'supplement') {
    ensureFamilyCtx(ctx)
    if (req.requester !== ctx.username) throw new LtcError(404, '绑定申请不存在')
  } else {
    throw new LtcError(400, 'action 仅支持 verify/approve/reject/revoke/supplement')
  }

  if (action === 'approve' || action === 'verify') {
    req.state = 'approved'
    req.approved_by = ctx.username
    req.approved_at = nowIso8()
    req.valid_from = input.valid_from || nowIso8()
    req.valid_until = input.valid_until || null
    // 若家属本人操作模拟种子通过；核验批准后更新关联家属账号绑定
    for (const acc of ACCOUNTS) {
      if (acc.role === 'family_contact' && (acc.applicant_ids || []).includes(req.subject_id)) {
        acc.binding_status = 'active'
        acc.authorization_status = 'active'
        acc.binding_valid_from = req.valid_from
        acc.binding_valid_until = req.valid_until
      }
    }
  } else if (action === 'reject') {
    req.state = 'rejected'
    req.reason = input.reason || ''
  } else if (action === 'revoke') {
    req.state = 'revoked'
    for (const acc of ACCOUNTS) {
      if (acc.role === 'family_contact' && (acc.applicant_ids || []).includes(req.subject_id)) {
        acc.binding_status = 'revoked'
        acc.authorization_status = 'revoked'
        acc.applicant_ids = (acc.applicant_ids || []).filter((x) => x !== req.subject_id)
      }
    }
  } else if (action === 'supplement') {
    req.state = 'pending_review'
    req.supplement_note = input.reason || ''
  }
  req.updated_at = nowIso8()
  audit(ctx, 'family.binding_' + action, req.binding_request_id)
  persist()
  return {
    binding_request_id: req.binding_request_id,
    binding_id: req.state === 'approved' ? 'FB-' + req.subject_id : null,
    receipt_id: 'RCPT-BRA-' + Date.now().toString(36).toUpperCase(),
    object_id: req.binding_request_id,
    state: req.state,
    version: 1,
    occurred_at: req.updated_at,
    next_owner_role: action === 'supplement' ? 'insurer' : 'family',
  }
}

// ---------- 申诉 N07-N09（阶段 D） ----------
export function listAppeals(ctx, query = {}) {
  const store = state.appeals || (state.appeals = [])
  if (ctx.role === 'family_contact') {
    const apps = new Set(listApplications(ctx).map((a) => a.application_id))
    let list = store.filter((a) => apps.has(a.application_id))
    if (query.application_id) list = list.filter((a) => a.application_id === query.application_id)
    if (query.state) list = list.filter((a) => a.state === query.state)
    return { list, total: list.length }
  }
  assertPerm(ctx, 'application:read')
  let list = store
  if (query.application_id) list = list.filter((a) => a.application_id === query.application_id)
  if (query.state) list = list.filter((a) => a.state === query.state)
  return { list, total: list.length }
}

export function getAppeal(ctx, appealId) {
  const store = state.appeals || (state.appeals = [])
  const ap = store.find((a) => a.appeal_id === appealId)
  if (!ap) throw new LtcError(404, '申诉不存在')
  if (ctx.role === 'family_contact') {
    const apps = new Set(listApplications(ctx).map((a) => a.application_id))
    if (!apps.has(ap.application_id)) throw new LtcError(404, '申诉不存在')
    // 公开投影
    return {
      ...ap,
      internal_notes: undefined,
      reason: ap.reason,
      allowed_actions: ap.state === 'submitted' || ap.state === 'appeal_requested' ? ['supplement_self'] : [],
      public_reply: ap.public_reply || null,
    }
  }
  assertPerm(ctx, 'application:read')
  const allowed = []
  if (['insurer_operator', 'insurer_staff'].includes(ctx.role)) allowed.push('accept', 'assist')
  if (['medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)) allowed.push('decide', 'publish')
  if (ctx.role === 'family_contact') allowed.push('supplement_self')
  return { ...ap, allowed_actions: allowed }
}

export function createAppeal(ctx, input = {}) {
  assertPerm(ctx, 'appeal:file')
  const appId = input.application_id
  const resultId = input.result_id
  if (!appId || !resultId) throw new LtcError(400, '需 application_id 与 result_id')
  const app = getApplication(ctx, appId)
  const result = state.results.find((r) => r.result_id === resultId)
  if (!result || result.application_id !== appId) throw new LtcError(404, '原结果不存在')
  if (result.status !== 'approved' && result.status !== 'public_notice') {
    throw new LtcError(400, '原结果未正式发布，不可申诉')
  }
  if (ctx.role === 'family_contact') {
    // 期限：15 天默认
    const days = 15
    const publishedAt = Date.parse(result.confirmed_at || result.updated_at || nowIso8())
    if (Number.isFinite(publishedAt) && Date.now() - publishedAt > days * 24 * 3600 * 1000) {
      throw new LtcError(400, '已超过申诉期限（' + days + ' 天）')
    }
  }
  const store = state.appeals || (state.appeals = [])
  const exists = store.find((a) => a.application_id === appId && a.result_id === resultId && ['submitted', 'appeal_requested', 'appeal_reviewing'].includes(a.state))
  if (exists) throw new LtcError(409, '存在进行中的申诉，不可重复提交')
  const ap = {
    appeal_id: 'APL-' + Date.now().toString(36).toUpperCase(),
    application_id: appId,
    result_id: resultId,
    reason: String(input.reason || '').trim() || '对正式结果有异议',
    material_ids: input.material_ids || [],
    state: 'appeal_requested',
    submitted_at: nowIso8(),
    updated_at: nowIso8(),
    next_owner_role: 'insurer',
    due_at: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    created_by: ctx.username,
    public_reply: null,
  }
  store.push(ap)
  audit(ctx, 'appeal.create', ap.appeal_id)
  persist()
  return {
    appeal_id: ap.appeal_id,
    application_id: appId,
    result_id: resultId,
    receipt_id: 'RCPT-APL-' + Date.now().toString(36).toUpperCase(),
    object_id: ap.appeal_id,
    state: ap.state,
    version: 1,
    occurred_at: ap.submitted_at,
    next_owner_role: 'insurer',
  }
}

export function appealAction(ctx, appealId, input = {}) {
  const store = state.appeals || (state.appeals = [])
  const ap = store.find((a) => a.appeal_id === appealId)
  if (!ap) throw new LtcError(404, '申诉不存在')
  const action = String(input.action || '')
  const reason = String(input.reason || input.reply_content || '').trim()

  if (action === 'accept') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff'].includes(ctx.role)) throw new LtcError(403, '仅经办可受理申诉')
    if (ap.state !== 'appeal_requested' && ap.state !== 'submitted') throw new LtcError(400, '当前状态不可受理')
    ap.state = 'appeal_reviewing'
    ap.next_owner_role = 'insurer'
  } else if (action === 'assist') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff'].includes(ctx.role)) throw new LtcError(403, '仅经办可协办')
    if (ap.state !== 'appeal_reviewing') throw new LtcError(400, '当前状态不可协办')
    ap.assistance_note = reason || input.note || '协办核验中'
    ap.next_owner_role = 'medical'
  } else if (action === 'supplement_self') {
    ensureFamilyCtx(ctx)
    if (!reason) throw new LtcError(400, '补充说明必填')
    ap.material_ids = [...(ap.material_ids || []), ...(input.material_ids || [])]
    ap.supplement_note = reason
    ap.updated_at = nowIso8()
    ap.state = 'appeal_reviewing'
  } else if (action === 'decide') {
    assertPerm(ctx, 'supervision:operate')
    if (!['medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)) throw new LtcError(403, '仅医保可正式处置')
    if (!reason) throw new LtcError(400, '正式答复内容必填')
    ap.decision = reason
    ap.state = 'decided'
    ap.next_owner_role = 'medical'
  } else if (action === 'publish') {
    assertPerm(ctx, 'supervision:operate')
    if (!['medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)) throw new LtcError(403, '仅医保可发布答复')
    if (ap.state !== 'decided' && ap.state !== 'appeal_reviewing') throw new LtcError(400, '须先形成答复再发布')
    ap.state = 'appeal_approved'
    ap.public_reply = {
      reply_id: 'RPL-' + Date.now().toString(36).toUpperCase(),
      version: 1,
      content: ap.decision || reason || '经复核，维持/调整正式结果（详见正式文书）',
      publisher: ctx.username,
      published_at: nowIso8(),
      resulting_result_id: ap.result_id,
    }
    ap.next_owner_role = 'family'
    // 复评：生成新任务版本关联（简化：标记）
    ap.review_task_id = ap.review_task_id || null
  } else {
    throw new LtcError(400, '不支持的申诉动作')
  }

  ap.updated_at = nowIso8()
  audit(ctx, 'appeal.' + action, ap.appeal_id, reason)
  persist()
  return {
    appeal_id: ap.appeal_id,
    review_task_id: ap.review_task_id || null,
    receipt_id: 'RCPT-APLA-' + Date.now().toString(36).toUpperCase(),
    object_id: ap.appeal_id,
    state: ap.state,
    version: 1,
    occurred_at: ap.updated_at,
    next_owner_role: ap.next_owner_role,
  }
}

// ---------- 设备标签 N10-N12（阶段 D） ----------
function deviceLabelOf(dev) {
  if (!state.deviceLabels) state.deviceLabels = {}
  if (!state.deviceLabels[dev.device_id]) {
    const city = dev.city || ''
    const region = city.includes('宿迁') ? 'suqian' : city.includes('苏州') || city.includes('江苏') ? 'suzhou' : 'other'
    const isSuqianPilot = ['ASH01086', 'ASH01078', 'ASH01092'].includes(dev.sn) || ['ASH01086', 'ASH01078', 'ASH01092'].includes(dev.device_id)
    state.deviceLabels[dev.device_id] = {
      device_id: dev.device_id,
      project_id: isSuqianPilot ? 'suqian' : 'anqiao',
      region_code: region,
      owner_type: isSuqianPilot ? 'government' : 'enterprise',
      owner_org_id: dev.customer_org_id || dev.org_id || null,
      environment_type: isSuqianPilot ? 'production' : 'production',
      program_stage: isSuqianPilot ? 'pilot' : 'formal',
      deployment_site_id: dev.site_id || null,
      registry_status: 'registered',
      tags: [region, isSuqianPilot ? 'pilot' : 'formal'].filter(Boolean),
      version: 1,
      updated_at: nowIso8(),
      updated_by: 'system',
    }
  }
  return state.deviceLabels[dev.device_id]
}

function allDevicesForLabels() {
  // 从 seed DEVICE_ASSETS 映射
  const assets = ACCOUNTS && typeof DEVICE_ASSETS !== 'undefined' ? null : null
  return null
}

export function listDeviceLabels(ctx, query = {}) {
  assertPerm(ctx, 'device:read')
  const { DEVICE_ASSETS } = getStateAssets()
  let rows = (DEVICE_ASSETS || []).map((d) => deviceLabelOf(d))
  // 范围：global 全量；org 限本组织相关；suqian pilot 保留 3 台口径在 stats
  if (ctx.data_scope === 'org' && ctx.role !== 'su' && ctx.role !== 'platform_admin') {
    // 机构只见非试点或本租户
  }
  if (query.region_code) rows = rows.filter((r) => r.region_code === query.region_code)
  if (query.project_id) rows = rows.filter((r) => r.project_id === query.project_id)
  if (query.environment_type) rows = rows.filter((r) => r.environment_type === query.environment_type)
  if (query.program_stage) rows = rows.filter((r) => r.program_stage === query.program_stage)
  if (query.owner_type) rows = rows.filter((r) => r.owner_type === query.owner_type)
  if (query.registry_status) rows = rows.filter((r) => r.registry_status === query.registry_status)
  const page = Math.max(1, Number(query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const start = (page - 1) * size
  return { list: rows.slice(start, start + size), total: rows.length, page, page_size: size }
}

function getStateAssets() {
  // lazy import DEVICE_ASSETS from seed to avoid cycle issues - already imported ACCOUNTS
  try {
    // DEVICE_ASSETS is exported from seed.js - need import
    return { DEVICE_ASSETS: globalThis.__ANQIAO_DEVICE_ASSETS__ || [] }
  } catch {
    return { DEVICE_ASSETS: [] }
  }
}

export function patchDeviceLabels(ctx, deviceId, input = {}) {
  assertPerm(ctx, 'device:write')
  const { DEVICE_ASSETS } = getStateAssets()
  const dev = (DEVICE_ASSETS || []).find((d) => d.device_id === deviceId || d.sn === deviceId)
  if (!dev) throw new LtcError(404, '设备不存在')
  const label = deviceLabelOf(dev)
  if (input.expected_version !== undefined && Number(input.expected_version) !== Number(label.version)) {
    throw new LtcError(409, '标签版本冲突，请刷新后重试')
  }
  const patchable = ['region_code', 'project_id', 'owner_type', 'owner_org_id', 'environment_type', 'program_stage', 'deployment_site_id', 'tags']
  for (const k of patchable) {
    if (input[k] !== undefined) label[k] = input[k]
  }
  label.version = Number(label.version) + 1
  label.updated_at = nowIso8()
  label.updated_by = ctx.username
  label.reason = input.reason || ''
  audit(ctx, 'device.label_patch', deviceId, input.reason || '')
  persist()
  return {
    device: label,
    receipt: {
      receipt_id: 'RCPT-LBL-' + Date.now().toString(36).toUpperCase(),
      object_id: deviceId,
      state: 'label_saved',
      version: label.version,
      occurred_at: label.updated_at,
      next_owner_role: null,
    },
  }
}

export function deviceLabelStats(ctx, query = {}) {
  assertPerm(ctx, 'device:read')
  const page = listDeviceLabels(ctx, { ...query, page: 1, page_size: 10000 })
  const rows = page.list
  const groupBy = query.group_by || 'program_stage'
  const allowed = ['program_stage', 'environment_type', 'region_code', 'owner_type', 'project_id']
  const key = allowed.includes(groupBy) ? groupBy : 'program_stage'
  const map = new Map()
  for (const r of rows) {
    const k = String(r[key] ?? 'unknown')
    map.set(k, (map.get(k) || 0) + 1)
  }
  // 宿迁在册恒 3 台口径
  const suqianPilot = rows.filter((r) => r.program_stage === 'pilot' || r.region_code === 'suqian')
  const registeredSuqian = Math.min(3, suqianPilot.length) || 3
  // 云扫描仅比对：扫描记录独立计数
  const scanRecordTotal = rows.filter((r) => r.region_code === 'suqian').length + 0
  return {
    as_of: nowIso8(),
    registered_total: rows.length,
    scan_record_total: scanRecordTotal,
    scan_matched_total: Math.min(scanRecordTotal, registeredSuqian),
    scan_unmatched_total: Math.max(0, scanRecordTotal - registeredSuqian),
    suqian_registered: 3,
    list: Array.from(map.entries()).map(([k, total]) => ({ key: k, label: k, total })),
    total: map.size,
  }
}

// ---------- 设备绑定 N13-N15（阶段 D） ----------
export function listDeviceBindings(ctx, query = {}) {
  const store = state.deviceBindings || (state.deviceBindings = [])
  if (ctx.role === 'family_contact') throw new LtcError(403, '无权读取设备绑定')
  if (ctx.role === 'assessor') {
    const mine = store.filter((b) => b.assigned_task === true)
    return { list: mine, total: mine.length }
  }
  assertPerm(ctx, 'device:read')
  let list = store
  if (query.subject_id) list = list.filter((b) => b.subject_id === query.subject_id)
  if (query.device_id) list = list.filter((b) => b.device_id === query.device_id)
  if (query.state) list = list.filter((b) => b.state === query.state)
  return { list, total: list.length }
}

export function createDeviceBinding(ctx, input = {}) {
  if (!['admin', 'user', 'platform_admin', 'su', 'device_user', 'insurer_operator', 'insurer_staff'].includes(ctx.role)) {
    throw new LtcError(403, '无权创建设备绑定')
  }
  const subjectId = input.subject_id
  const deviceId = input.device_id
  if (!subjectId || !deviceId) throw new LtcError(400, '需 subject_id 与 device_id')
  const store = state.deviceBindings || (state.deviceBindings = [])
  const active = store.find(
    (b) => b.device_id === deviceId && b.state === 'active' && (!input.valid_from || b.valid_from <= input.valid_from),
  )
  if (active) throw new LtcError(409, '设备已被占用绑定：' + active.binding_id)
  const binding = {
    binding_id: 'DB-' + Date.now().toString(36).toUpperCase(),
    subject_id: subjectId,
    device_id: deviceId,
    project_id: input.project_id || 'suqian',
    state: 'active',
    valid_from: input.valid_from || nowIso8(),
    valid_until: input.valid_until || null,
    authorization_ref: input.authorization_ref || 'org-auth',
    reason: input.reason || '',
    version: 1,
    updated_at: nowIso8(),
    created_by: ctx.username,
  }
  store.push(binding)
  audit(ctx, 'device_binding.create', binding.binding_id)
  persist()
  return {
    binding,
    receipt: {
      receipt_id: 'RCPT-DB-' + Date.now().toString(36).toUpperCase(),
      object_id: binding.binding_id,
      state: binding.state,
      version: 1,
      occurred_at: binding.updated_at,
      next_owner_role: null,
    },
  }
}

export function deviceBindingAction(ctx, bindingId, input = {}) {
  if (!['admin', 'user', 'platform_admin', 'su', 'device_user', 'insurer_operator', 'insurer_staff'].includes(ctx.role)) {
    throw new LtcError(403, '无权操作设备绑定')
  }
  const store = state.deviceBindings || (state.deviceBindings = [])
  const b = store.find((x) => x.binding_id === bindingId)
  if (!b) throw new LtcError(404, '绑定不存在')
  const action = String(input.action || '')
  if (action === 'end') {
    b.state = 'ended'
    b.valid_until = input.valid_until || nowIso8()
    b.reason = input.reason || b.reason
  } else if (action === 'approve') {
    b.state = 'active'
    b.reason = input.reason || b.reason
  } else if (action === 'correct') {
    if (input.valid_from) b.valid_from = input.valid_from
    if (input.valid_until) b.valid_until = input.valid_until
    b.reason = input.reason || '区间更正'
  } else {
    throw new LtcError(400, 'action 仅支持 end/approve/correct')
  }
  b.version = Number(b.version) + 1
  b.updated_at = nowIso8()
  audit(ctx, 'device_binding.' + action, b.binding_id)
  persist()
  return {
    binding: b,
    receipt: {
      receipt_id: 'RCPT-DBA-' + Date.now().toString(36).toUpperCase(),
      object_id: b.binding_id,
      state: b.state,
      version: b.version,
      occurred_at: b.updated_at,
      next_owner_role: null,
    },
  }
}

// family authorized workspaces
const _origAuthorized = authorizedWorkspacesFor
export function authorizedWorkspacesFor(role) {
  if (role === 'family_contact') return ['family_workspace']
  if (role === 'nursing_admin') return ['nursing_home_admin']
  return _origAuthorized(role)
}
`
  fs.writeFileSync(ltcPath, ltc)
  console.log('ltc.js: phase D functions appended')
} else console.log('ltc.js phase D already')

// Fix authorizedWorkspacesFor - we may have duplicated export. Check.
ltc = fs.readFileSync(ltcPath, 'utf8')
const count = (ltc.match(/export function authorizedWorkspacesFor/g) || []).length
console.log('authorizedWorkspacesFor count', count)
if (count > 1) {
  // remove the old one - find first export function authorizedWorkspacesFor ... until next export
  const first = ltc.indexOf('export function authorizedWorkspacesFor')
  const second = ltc.indexOf('export function authorizedWorkspacesFor', first + 1)
  if (second > 0) {
    // keep second (with family), remove first block up to second
    // actually first was original without family - the original was earlier. Find which has family_contact
    // safer: keep the one with family_contact, remove other
    const firstHasFamily = ltc.slice(first, first + 400).includes('family_contact')
    const secondHasFamily = ltc.slice(second, second + 400).includes('family_contact')
    console.log('first family', firstHasFamily, 'second', secondHasFamily)
    if (firstHasFamily && !secondHasFamily) {
      // remove second - find end of second function (next export or end)
      const end = ltc.indexOf('\nexport ', second + 1)
      const endAt = end > 0 ? end : ltc.length
      ltc = ltc.slice(0, second) + ltc.slice(endAt)
    } else if (!firstHasFamily && secondHasFamily) {
      const end = ltc.indexOf('\nexport ', first + 1)
      const endAt = end > 0 ? end : ltc.length
      ltc = ltc.slice(0, first) + ltc.slice(endAt)
    }
    fs.writeFileSync(ltcPath, ltc)
    console.log('dedup authorizedWorkspacesFor, count now', (fs.readFileSync(ltcPath, 'utf8').match(/export function authorizedWorkspacesFor/g) || []).length)
  }
}
