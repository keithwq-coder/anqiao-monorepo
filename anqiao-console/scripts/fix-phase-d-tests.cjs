const fs = require('fs')

let s = fs.readFileSync('server/ltc.js', 'utf8')
if (!s.includes('function buildReceipt')) {
  s = s.replace(
    'export function applicationAction(ctx, applicationId, input = {}) {',
    `function buildReceipt(objectId, stateVal, version, nextOwnerRole) {
  return {
    receipt_id: 'RCPT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    object_id: objectId,
    state: stateVal,
    version: version ?? 1,
    occurred_at: nowIso8(),
    next_owner_role: nextOwnerRole ?? null,
  }
}

export function applicationAction(ctx, applicationId, input = {}) {`,
  )
  fs.writeFileSync('server/ltc.js', s)
  console.log('buildReceipt restored')
} else console.log('buildReceipt exists')

s = fs.readFileSync('server/ltc.js', 'utf8')
const before = s
s = s.split("'admin', 'user', 'platform_admin', 'su', 'device_user', 'insurer_operator', 'insurer_staff']").join(
  "'admin', 'user', 'platform_admin', 'su', 'device_user', 'insurer_operator', 'insurer_staff', 'nursing_admin', 'nursing_nurse']",
)
if (s !== before) {
  fs.writeFileSync('server/ltc.js', s)
  console.log('binding roles expanded')
} else console.log('roles already or pattern different')

// fix ltc-family
let f = fs.readFileSync('src/api/ltc-family.ts', 'utf8')
const start = f.indexOf('export function patchDeviceLabel')
const end = f.indexOf('export function getDeviceLabelStats')
if (start >= 0 && end > start) {
  f =
    f.slice(0, start) +
    `export function patchDeviceLabel(
  deviceId: string,
  patch: Partial<DeviceLabel> & { reason: string; expected_version?: number },
): Promise<{ device: DeviceLabel; receipt: any }> {
  return http.patch(
    '/v1/ltc/devices/' + encodeURIComponent(deviceId) + '/labels',
    patch,
  )
}

` +
    f.slice(end)
  fs.writeFileSync('src/api/ltc-family.ts', f)
  console.log('ltc-family rewritten')
}

// fix Institution null
let i = fs.readFileSync('src/features/ltc-workbench/pages/InstitutionLtcEntry.vue', 'utf8')
i = i.replace(
  'v-for="b in bindings.filter((x) => x.subject_id === selectedPerson!.person_id)"',
  'v-for="b in selectedPerson ? bindings.filter((x) => x.subject_id === selectedPerson.person_id) : []"',
)
fs.writeFileSync('src/features/ltc-workbench/pages/InstitutionLtcEntry.vue', i)
console.log('institution fixed')

// http patch
let h = fs.readFileSync('src/api/http.ts', 'utf8')
if (!h.includes('patch:')) {
  h = h.replace(
    "  post: <T>(path: string, data?: unknown) =>\n    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),\n}",
    "  post: <T>(path: string, data?: unknown) =>\n    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),\n  patch: <T>(path: string, data?: unknown) =>\n    request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),\n}",
  )
  fs.writeFileSync('src/api/http.ts', h)
  console.log('http patch added')
} else console.log('http patch ok')
