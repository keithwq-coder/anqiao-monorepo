const fs = require('fs')
const path = require('path')

// ---- 1) ltc.js: append application actions ----
const ltcPath = path.join(__dirname, '..', 'server', 'ltc.js')
let ltc = fs.readFileSync(ltcPath, 'utf8')

if (!ltc.includes('export function applicationAction')) {
  const chunk = `
// ---------- 申请统一动作（K04x · 阶段 C） ----------
function buildReceipt(objectId, stateVal, version, nextOwnerRole) {
  return {
    receipt_id: 'RCPT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    object_id: objectId,
    state: stateVal,
    version: version ?? 1,
    occurred_at: nowIso8(),
    next_owner_role: nextOwnerRole ?? null,
  }
}

export function applicationAction(ctx, applicationId, input = {}) {
  const app = getApplication(ctx, applicationId)
  const action = String(input?.action || '').trim()
  const reason = String(input?.reason || input?.note || '').trim()

  if (action === 'accept') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅经办/机构可受理申请')
    }
    if (app.status !== 'submitted') throw new LtcError(400, '当前状态 ' + app.status + ' 不可受理')
    app.status = 'materials_review'
    app.updated_at = nowIso8()
    app.handoff = { from: 'submitter', to: 'insurer', action: 'accept', at: nowIso8(), by: ctx.username }
    audit(ctx, 'application.accept', app.application_id)
    persist()
    return { application: app, receipt: buildReceipt(app.application_id, app.status, 1, 'insurer'), next_owner_role: 'insurer' }
  }

  if (action === 'return_materials') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅经办/机构可退回材料')
    }
    if (!reason) throw new LtcError(400, '退回必须填写 reason/补正要求')
    if (!['submitted', 'materials_review'].includes(app.status)) {
      throw new LtcError(400, '当前状态 ' + app.status + ' 不可退回补正')
    }
    app.status = 'materials_rejected'
    app.material_return_reason = reason
    app.updated_at = nowIso8()
    app.handoff = { from: 'insurer', to: 'submitter', action: 'return_materials', reason, at: nowIso8(), by: ctx.username }
    audit(ctx, 'application.return_materials', app.application_id, reason)
    persist()
    return { application: app, receipt: buildReceipt(app.application_id, app.status, 1, 'submitter'), next_owner_role: 'submitter' }
  }

  if (action === 'materials_pass') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅经办/机构可确认材料齐备')
    }
    if (!['materials_review', 'submitted'].includes(app.status)) {
      throw new LtcError(400, '当前状态 ' + app.status + ' 不可材料通过')
    }
    app.status = 'materials_pass'
    app.updated_at = nowIso8()
    audit(ctx, 'application.materials_pass', app.application_id)
    persist()
    return { application: app, receipt: buildReceipt(app.application_id, app.status, 1, 'insurer'), next_owner_role: 'insurer' }
  }

  if (action === 'finalize') {
    assertPerm(ctx, 'supervision:operate')
    if (!['medical_supervisor', 'medical_insurance_staff', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '终审核定须由医保监管人员执行')
    }
    if (app.status === 'suspended') {
      throw new LtcError(409, '存在有效监管暂缓，须先解除暂缓')
    }
    const ready = state.results.find(
      (r) => r.application_id === app.application_id && ['pending_review', 'public_notice'].includes(r.status),
    )
    const allowed = ['assess_pending', 'materials_pass', 'approved'].includes(app.status) || !!ready
    if (!allowed) throw new LtcError(400, '当前状态 ' + app.status + ' 不可终审核定')
    if (ready) {
      ready.status = 'approved'
      ready.confirmed_by = ctx.username
      ready.confirmed_at = nowIso8()
      ready.final_approved_level = ready.final_approved_level || ready.assessor_level
      ready.updated_at = nowIso8()
    }
    app.status = 'approved'
    app.medical_ratified_level = (ready && ready.final_approved_level) || app.medical_ratified_level || '重度失能Ⅱ级'
    app.ratified_by = ctx.username
    app.ratified_at = nowIso8()
    app.updated_at = nowIso8()
    app.handoff = { from: 'medical', to: 'published', action: 'finalize', at: nowIso8(), by: ctx.username }
    audit(ctx, 'application.finalize', app.application_id, app.medical_ratified_level)
    persist()
    return {
      application: app,
      receipt: buildReceipt(app.application_id, app.status, 1, 'family'),
      next_owner_role: 'family',
      result: ready || null,
    }
  }

  if (action === 'read') {
    return { application: app, receipt: null, next_owner_role: null }
  }

  throw new LtcError(400, 'action 仅支持 accept / return_materials / materials_pass / finalize / read')
}

export function listApplicationMaterials(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  const items = [
    {
      material_id: app.application_id + '-M1',
      template_item: '身份证明',
      version: 1,
      status: app.status === 'materials_rejected' ? 'invalid' : 'valid',
      file_ref: 'mem://material/' + app.application_id + '/id',
      updated_at: app.updated_at || app.created_at,
      return_reason: app.status === 'materials_rejected' ? app.material_return_reason : null,
    },
    {
      material_id: app.application_id + '-M2',
      template_item: '病历摘要',
      version: 1,
      status: 'valid',
      file_ref: 'mem://material/' + app.application_id + '/mr',
      updated_at: app.updated_at || app.created_at,
      return_reason: null,
    },
    {
      material_id: app.application_id + '-M3',
      template_item: '评估申请表',
      version: 1,
      status: app.status === 'draft' ? 'pending' : 'collected',
      file_ref: 'mem://material/' + app.application_id + '/form',
      updated_at: app.updated_at || app.created_at,
      return_reason: null,
    },
  ]
  return { application_id: app.application_id, status: app.status, list: items, total: items.length }
}

export function listApplicationTimeline(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  const events = [
    {
      event_id: 'TL-1',
      label: '创建申请',
      occurred_at: app.created_at || nowIso8(),
      responsible_role: 'submitter',
      public_description: '申请已创建',
      receipt_id: null,
    },
  ]
  if (app.status !== 'draft') {
    events.push({
      event_id: 'TL-2',
      label: '提交申请',
      occurred_at: app.updated_at || nowIso8(),
      responsible_role: 'submitter',
      public_description: '已提交至经办机构',
      receipt_id: null,
    })
  }
  if (app.handoff) {
    events.push({
      event_id: 'TL-3',
      label: app.handoff.action || '交接',
      occurred_at: app.handoff.at,
      responsible_role: app.handoff.to || '—',
      public_description: app.handoff.reason || '办理节点更新',
      receipt_id: null,
    })
  }
  if (app.status === 'suspended') {
    events.push({
      event_id: 'TL-4',
      label: '监管暂缓',
      occurred_at: app.updated_at || nowIso8(),
      responsible_role: 'medical',
      public_description: '审核中（监管核验）',
      receipt_id: null,
    })
  }
  if (app.status === 'approved') {
    events.push({
      event_id: 'TL-5',
      label: '结果已发布',
      occurred_at: app.ratified_at || app.updated_at || nowIso8(),
      responsible_role: 'medical',
      public_description: '正式结果已核定',
      receipt_id: null,
    })
  }
  const results = state.results.filter((r) => r.application_id === applicationId)
  const latest = results[results.length - 1]
  return {
    application_id: applicationId,
    public_state: app.status,
    updated_at: app.updated_at || nowIso8(),
    next_action: {
      key: app.status === 'materials_rejected' ? 'supplement' : app.status === 'draft' ? 'submit' : 'read',
      label: app.status === 'materials_rejected' ? '补正材料' : app.status === 'draft' ? '继续填写' : '查看进度',
      due_at: null,
    },
    published_result:
      app.status === 'approved' && latest
        ? {
            result_id: latest.result_id,
            version: latest.version ?? 1,
            publisher: app.ratified_by || 'medical',
            published_at: app.ratified_at || latest.updated_at,
            summary: app.medical_ratified_level || latest.final_approved_level || latest.assessor_level,
          }
        : null,
    list: events,
    total: events.length,
  }
}

export function applicationSla(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  const base = Date.parse(app.updated_at || app.created_at || nowIso8())
  const due = Number.isNaN(base) ? null : new Date(base + 3 * 24 * 3600 * 1000).toISOString()
  const now = Date.now()
  let sla = 'open'
  if (due) {
    const d = Date.parse(due)
    if (d < now) sla = 'overdue'
    else if (d - now < 24 * 3600 * 1000) sla = 'due_soon'
  }
  return {
    application_id: applicationId,
    state: app.status,
    due_at: due,
    sla_status: sla,
    rule: 'DEFAULT_3D',
    note: due ? null : '时限待配置',
  }
}
`
  ltc = ltc + chunk
  fs.writeFileSync(ltcPath, ltc)
  console.log('ltc.js: applicationAction appended')
} else {
  console.log('ltc.js: applicationAction already present')
}

// ---- 2) supervision release clears suspended ----
if (!ltc.includes("action === 'release'")) {
  ltc = fs.readFileSync(ltcPath, 'utf8')
  const needle = `  if (action === 'suspend') {`
  const insert = `  if (action === 'release') {
    const appR = state.applications.find((a) => a.application_id === targetId)
    const resR = state.results.find((r) => r.result_id === targetId)
    if (appR && appR.status === 'suspended') {
      appR.status = 'assess_pending'
      appR.updated_at = nowIso8()
      appR.hold_released_at = nowIso8()
    }
    if (resR && resR.status === 'suspended') {
      resR.status = 'pending_review'
      resR.updated_at = nowIso8()
    }
    sup.result = '暂缓已解除，恢复原办理条件'
  }
  if (action === 'suspend') {`
  if (!ltc.includes(needle)) throw new Error('suspend block not found')
  ltc = ltc.replace(needle, insert)
  fs.writeFileSync(ltcPath, ltc)
  console.log('ltc.js: release clear suspended')
} else {
  console.log('ltc.js: release already present')
}

// ---- 3) index.js imports + routes ----
const idxPath = path.join(__dirname, '..', 'server', 'index.js')
let idx = fs.readFileSync(idxPath, 'utf8')

if (!idx.includes('applicationAction')) {
  idx = idx.replace(
    'getWorkbenchSummary,\n  listWorkbenchTodos,\n  authorizedWorkspacesFor,',
    'getWorkbenchSummary,\n  listWorkbenchTodos,\n  authorizedWorkspacesFor,\n  applicationAction,\n  listApplicationMaterials,\n  listApplicationTimeline,\n  applicationSla,',
  )
}

if (!idx.includes('listApplicationTimeline')) {
  // fallback insert after authorizedWorkspacesFor import
  idx = idx.replace(
    'authorizedWorkspacesFor,',
    'authorizedWorkspacesFor,\n  applicationAction,\n  listApplicationMaterials,\n  listApplicationTimeline,\n  applicationSla,',
  )
}

const detailOld = `  m = /^\\/v1\\/ltc\\/applications\\/([A-Za-z0-9_-]+)$/.exec(path)
  if (method === 'GET' && m) return ok(res, getApplication(ctx, m[1]))`

const detailNew = `  m = /^\\/v1\\/ltc\\/applications\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
  if (method === 'POST' && m) return ok(res, applicationAction(ctx, m[1], await body()))
  m = /^\\/v1\\/ltc\\/applications\\/([A-Za-z0-9_-]+)\\/materials$/.exec(path)
  if (method === 'GET' && m) return ok(res, listApplicationMaterials(ctx, m[1]))
  m = /^\\/v1\\/ltc\\/applications\\/([A-Za-z0-9_-]+)\\/timeline$/.exec(path)
  if (method === 'GET' && m) return ok(res, listApplicationTimeline(ctx, m[1]))
  m = /^\\/v1\\/ltc\\/applications\\/([A-Za-z0-9_-]+)\\/sla$/.exec(path)
  if (method === 'GET' && m) return ok(res, applicationSla(ctx, m[1]))
  m = /^\\/v1\\/ltc\\/applications\\/([A-Za-z0-9_-]+)$/.exec(path)
  if (method === 'GET' && m) return ok(res, getApplication(ctx, m[1]))`

if (!idx.includes('listApplicationTimeline(ctx')) {
  if (!idx.includes(detailOld)) {
    // try alternate formatting
    const alt = idx.match(/m = \/\^\\\/v1\\\/ltc\\\/applications\\\/\(\[A-Za-z0-9_-\]\+\)\\\$\/\.exec\(path\)\n\s*if \(method === 'GET' && m\) return ok\(res, getApplication\(ctx, m\[1\]\)\)/)
    if (!alt) {
      console.error('detail route pattern not found')
      // show nearby
      const i = idx.indexOf('/v1/ltc/applications/')
      console.log(idx.slice(i - 50, i + 400))
      process.exit(1)
    }
    idx = idx.replace(alt[0], detailNew)
  } else {
    idx = idx.replace(detailOld, detailNew)
  }
  fs.writeFileSync(idxPath, idx)
  console.log('index.js: routes wired')
} else {
  fs.writeFileSync(idxPath, idx)
  console.log('index.js: routes already present')
}
