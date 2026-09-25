const fs = require('fs')

// 1) nursing_admin device perms
let a = fs.readFileSync('server/auth.js', 'utf8')
if (!a.includes("'device:read', 'device:write'") && a.includes('nursing_admin: [')) {
  a = a.replace(
    `  nursing_admin: [
    'patient:read', 'patient:write', 'bed:read', 'bed:write',
    'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'shift:read', 'report:read',
    'service_record:read', 'service_record:write',
  ],`,
    `  nursing_admin: [
    'patient:read', 'patient:write', 'bed:read', 'bed:write',
    'alert:read', 'alert:claim', 'alert:handle',
    'overview:read', 'shift:read', 'report:read',
    'service_record:read', 'service_record:write',
    'device:read', 'device:write',
    'assessed_person:read', 'application:create', 'application:submit', 'application:read',
  ],`,
  )
  fs.writeFileSync('server/auth.js', a)
  console.log('nursing_admin perms expanded')
} else console.log('nursing_admin perms already')

// 2) listDeviceBindings: skip assertPerm for nursing_admin already has device:read after fix
// Also allow nursing_admin explicitly in listDeviceBindings
let s = fs.readFileSync('server/ltc.js', 'utf8')
s = s.replace(
  `  if (ctx.role === 'assessor') {
    const mine = store.filter((b) => b.assigned_task === true)
    return { list: mine, total: mine.length }
  }
  assertPerm(ctx, 'device:read')`,
  `  if (ctx.role === 'assessor') {
    const mine = store.filter((b) => b.assigned_task === true)
    return { list: mine, total: mine.length }
  }
  if (!['family_contact'].includes(ctx.role)) {
    // nursing_admin 持 device:read 后走 assertPerm；兼容阶段 D 允许机构读自己的绑定
    if (ctx.role === 'nursing_admin' || ctx.role === 'nursing_nurse') {
      // org 范围内绑定
    } else {
      assertPerm(ctx, 'device:read')
    }
  }`,
)
fs.writeFileSync('server/ltc.js', s)
console.log('listDeviceBindings role path')

// 3) InstitutionLtcEntry template null guards
let i = fs.readFileSync('src/features/ltc-workbench/pages/InstitutionLtcEntry.vue', 'utf8')
i = i.replace(
  ':title="selectedPerson.name"',
  ':title="selectedPerson?.name"',
)
i = i.replace(
  ':object-id="selectedPerson.person_id"',
  ':object-id="selectedPerson?.person_id || \'\'"',
)
i = i.replace(
  ":subtitle=\"selectedPerson.service_org_name || selectedPerson.service_org_id || ''\"",
  ":subtitle=\"(selectedPerson?.service_org_name || selectedPerson?.service_org_id || '')\"",
)
i = i.replace('{{ selectedPerson.person_id }}', '{{ selectedPerson?.person_id }}')
i = i.replace(
  'v-if="!bindings.filter((b) => b.subject_id === selectedPerson.person_id).length"',
  'v-if="!selectedPerson || !bindings.filter((b) => b.subject_id === selectedPerson.person_id).length"',
)
i = i.replace(
  'v-for="b in selectedPerson ? bindings.filter((x) => x.subject_id === selectedPerson.person_id) : []"',
  'v-for="b in bindings.filter((x) => selectedPerson && x.subject_id === selectedPerson.person_id)"',
)
fs.writeFileSync('src/features/ltc-workbench/pages/InstitutionLtcEntry.vue', i)
console.log('institution guards')
