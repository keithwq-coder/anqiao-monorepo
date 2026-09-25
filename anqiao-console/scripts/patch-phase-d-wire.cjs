const fs = require('fs')

// Fix authorizedWorkspacesFor to be standalone
let s = fs.readFileSync('server/ltc.js', 'utf8')

const broken = s.indexOf('const _origAuthorized = authorizedWorkspacesFor')
if (broken >= 0) {
  // replace from const _origAuthorized to end of that function
  const start = broken
  // find next export after the function or end
  const after = s.indexOf('\nexport function', start + 10)
  // also handle if function is last
  const fnStart = s.indexOf('export function authorizedWorkspacesFor', start)
  const fnEnd = after > fnStart ? after : s.length
  const replacement = `export function authorizedWorkspacesFor(role) {
  const all = [
    'system_admin',
    'platform_operations',
    'device_monitoring',
    'medical_supervision',
    'insurer_operations',
    'assessor_workspace',
    'nursing_home_admin',
    'nursing_staff',
    'partner_operations',
    'family_workspace',
  ]
  if (role === 'su' || role === 'platform_admin') return all
  if (role === 'family_contact') return ['family_workspace']
  const extras = {
    admin: ['platform_operations', 'device_monitoring', 'medical_supervision', 'insurer_operations', 'assessor_workspace', 'nursing_home_admin'],
    user: ['device_monitoring', 'platform_operations'],
    device_user: ['device_monitoring'],
    medical_supervisor: ['medical_supervision'],
    medical_insurance_staff: ['medical_supervision'],
    insurer_operator: ['insurer_operations'],
    insurer_staff: ['insurer_operations'],
    assessor: ['assessor_workspace'],
    nursing_admin: ['nursing_home_admin'],
    nursing_nurse: ['nursing_staff'],
    partner_admin: ['partner_operations'],
  }
  const list = extras[role] || [workspaceOf(role)]
  return list.filter((w, i, arr) => arr.indexOf(w) === i)
}
`
  // Also need to remove the old broken block including _origAuthorized
  // Find start of const _origAuthorized through end of function
  let endSearch = s.indexOf('\nexport function authorizedWorkspacesFor', start)
  if (endSearch < 0) endSearch = start
  // find end of the authorizedWorkspacesFor function that follows
  const fn = s.indexOf('export function authorizedWorkspacesFor', start)
  const afterFn = s.indexOf('\nexport ', fn + 1)
  const end = afterFn > 0 ? afterFn : s.length
  s = s.slice(0, start) + replacement + s.slice(end)
  fs.writeFileSync('server/ltc.js', s)
  console.log('fixed authorizedWorkspacesFor')
} else {
  // ensure family branch exists
  if (!s.includes("role === 'family_contact') return ['family_workspace']")) {
    s = s.replace(
      `export function authorizedWorkspacesFor(role) {`,
      `export function authorizedWorkspacesFor(role) {
  if (role === 'family_contact') return ['family_workspace']`,
    )
    fs.writeFileSync('server/ltc.js', s)
    console.log('added family branch')
  } else console.log('ok')
}

// Wire DEVICE_ASSETS into labels
s = fs.readFileSync('server/ltc.js', 'utf8')
if (!s.includes('globalThis.__ANQIAO_DEVICE_ASSETS__') || !s.includes('import { ACCOUNTS')) {
  // check seed import
  console.log('seed import line:', s.match(/from '\.\/seed\.js'/)?.[0])
}

// Better: inject DEVICE_ASSETS into seed import
if (s.includes('import {\n  ACCOUNTS,\n  nowIso8,\n} from') || s.includes("import { ACCOUNTS, nowIso8 } from './seed.js'")) {
  // ok variants
}
if (s.includes('from \'./seed.js\'') && !s.includes('DEVICE_ASSETS')) {
  s = s.replace(
    /import \{([^}]+)\} from '\.\/seed\.js'/,
    (m, g) => {
      if (g.includes('DEVICE_ASSETS')) return m
      return `import {${g.replace(/\s+$/, '')}, DEVICE_ASSETS } from './seed.js'`
    },
  )
}
// Fix getStateAssets to use DEVICE_ASSETS
s = s.replace(
  `function getStateAssets() {
  // lazy import DEVICE_ASSETS from seed to avoid cycle issues - already imported ACCOUNTS
  try {
    // DEVICE_ASSETS is exported from seed.js - need import
    return { DEVICE_ASSETS: globalThis.__ANQIAO_DEVICE_ASSETS__ || [] }
  } catch {
    return { DEVICE_ASSETS: [] }
  }
}`,
  `function getStateAssets() {
  return { DEVICE_ASSETS: typeof DEVICE_ASSETS !== 'undefined' ? DEVICE_ASSETS : [] }
}`,
)
fs.writeFileSync('server/ltc.js', s)
console.log('device assets wiring done')

// Wire routes in index.js
let idx = fs.readFileSync('server/index.js', 'utf8')
if (!idx.includes('listFamilyBindings')) {
  idx = idx.replace(
    'applicationAction,\n  listApplicationMaterials,\n  listApplicationTimeline,\n  applicationSla,',
    `applicationAction,
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
  deviceBindingAction,`,
  )
}

const routeBlock = `  // ---- 阶段 D N03-N15 ----
  if (path === '/v1/ltc/family/bindings' && method === 'GET') return ok(res, listFamilyBindings(ctx))
  if (path === '/v1/ltc/family/binding-requests') {
    if (method === 'GET') return ok(res, listBindingRequests(ctx, q))
    if (method === 'POST') return ok(res, createBindingRequest(ctx, await body()))
  }
  {
    const br = /^\\/v1\\/ltc\\/family\\/binding-requests\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
    if (method === 'POST' && br) return ok(res, bindingRequestAction(ctx, br[1], await body()))
  }
  if (path === '/v1/ltc/appeals') {
    if (method === 'GET') return ok(res, listAppeals(ctx, q))
    if (method === 'POST') return ok(res, createAppeal(ctx, await body()))
  }
  {
    const ap = /^\\/v1\\/ltc\\/appeals\\/([A-Za-z0-9_-]+)$/.exec(path)
    if (method === 'GET' && ap) return ok(res, getAppeal(ctx, ap[1]))
    const apa = /^\\/v1\\/ltc\\/appeals\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
    if (method === 'POST' && apa) return ok(res, appealAction(ctx, apa[1], await body()))
  }
  if (path === '/v1/ltc/device-labels') {
    if (method === 'GET') return ok(res, listDeviceLabels(ctx, q))
  }
  if (path === '/v1/ltc/device-labels/stats' && method === 'GET') return ok(res, deviceLabelStats(ctx, q))
  {
    const dl = /^\\/v1\\/ltc\\/devices\\/([A-Za-z0-9_-]+)\\/labels$/.exec(path)
    if (method === 'PATCH' && dl) return ok(res, patchDeviceLabels(ctx, dl[1], await body()))
  }
  if (path === '/v1/ltc/device-bindings') {
    if (method === 'GET') return ok(res, listDeviceBindings(ctx, q))
    if (method === 'POST') return ok(res, createDeviceBinding(ctx, await body()))
  }
  {
    const db = /^\\/v1\\/ltc\\/device-bindings\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
    if (method === 'POST' && db) return ok(res, deviceBindingAction(ctx, db[1], await body()))
  }
  // family public timeline (N06) reuse application timeline if role family
  {
    const ft = /^\\/v1\\/ltc\\/family\\/applications\\/([A-Za-z0-9_-]+)\\/timeline$/.exec(path)
    if (method === 'GET' && ft) return ok(res, listApplicationTimeline(ctx, ft[1]))
  }

`

if (!idx.includes('listFamilyBindings')) {
  // insert before return notFound in routeLtc
  const nf = idx.indexOf("return notFound(res, '接口不存在')", idx.indexOf('async function routeLtc'))
  if (nf < 0) throw new Error('notFound not found')
  // only first occurrence after routeLtc
  idx = idx.slice(0, nf) + routeBlock + idx.slice(nf)
  fs.writeFileSync('server/index.js', idx)
  console.log('routes wired')
} else {
  fs.writeFileSync('server/index.js', idx)
  console.log('routes already or import only')
}

// ensure import exists
idx = fs.readFileSync('server/index.js', 'utf8')
if (!idx.includes('listFamilyBindings')) {
  console.error('import missing listFamilyBindings')
  process.exit(1)
}
console.log('import ok', idx.includes('createAppeal'), idx.includes('listDeviceLabels'))
