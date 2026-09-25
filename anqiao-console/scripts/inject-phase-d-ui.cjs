const fs = require('fs')

function inject(file, importLine, tag) {
  let s = fs.readFileSync(file, 'utf8')
  if (s.includes(tag)) {
    console.log(file, 'has', tag)
    return
  }
  if (s.includes('<script setup lang="ts">')) {
    s = s.replace('<script setup lang="ts">', '<script setup lang="ts">\n' + importLine)
  } else if (s.includes('<script setup>')) {
    s = s.replace('<script setup>', '<script setup>\n' + importLine)
  }
  if (s.includes('<div class="page-header">')) {
    s = s.replace(/<div class="page-header">[\s\S]*?<\/div>\n/, (m) => m + '  <' + tag + ' />\n')
  } else if (s.includes('<template>\n')) {
    s = s.replace('<template>\n', '<template>\n  <' + tag + ' />\n')
  }
  fs.writeFileSync(file, s)
  console.log('injected', tag, 'into', file)
}

let shell = fs.readFileSync('src/views/console/WorkspaceShell.vue', 'utf8')
if (!shell.includes('FamilyWorkspace')) {
  shell = shell.replace(
    "import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'",
    `import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'
import FamilyWorkspace from '../../features/ltc-workbench/pages/FamilyWorkspace.vue'
import DeviceLabels from '../../features/ltc-workbench/pages/DeviceLabels.vue'`,
  )
  shell = shell.replace(
    `    partner_operations: PartnerOperationsApp,
  }`,
    `    partner_operations: PartnerOperationsApp,
    family_workspace: FamilyWorkspace,
  }`,
  )
  shell = shell.replace(
    `const familyGate = computed(() => {
  if (!isFamily.value) return { canEnter: true, reason: '' }
  return familyAccessState(null)
})`,
    `const familyGate = computed(() => {
  if (!isFamily.value) return { canEnter: true, reason: '' }
  const hasApplicant =
    !!(props.session.principal as any)?.applicant_ids?.length ||
    props.session.data_scope === 'applicant'
  if (hasApplicant) {
    return familyAccessState([{ binding_status: 'active', authorization_status: 'active' }])
  }
  return familyAccessState(null)
})`,
  )
  fs.writeFileSync('src/views/console/WorkspaceShell.vue', shell)
  console.log('shell family map ok')
} else console.log('shell already')

inject(
  'src/views/console/workspaces/PlatformOperationsApp.vue',
  "import DeviceLabels from '../../../features/ltc-workbench/pages/DeviceLabels.vue'",
  'DeviceLabels',
)
inject(
  'src/views/console/workspaces/SystemAdminApp.vue',
  "import DeviceLabels from '../../../features/ltc-workbench/pages/DeviceLabels.vue'",
  'DeviceLabels',
)
inject(
  'src/views/console/workspaces/DeviceMonitoringApp.vue',
  "import DeviceLabels from '../../../features/ltc-workbench/pages/DeviceLabels.vue'",
  'DeviceLabels',
)
inject(
  'src/views/console/workspaces/NursingHomeAdminApp.vue',
  "import InstitutionLtcEntry from '../../../features/ltc-workbench/pages/InstitutionLtcEntry.vue'",
  'InstitutionLtcEntry',
)
inject(
  'src/views/console/workspaces/PlatformOperationsApp.vue',
  "import InstitutionLtcEntry from '../../../features/ltc-workbench/pages/InstitutionLtcEntry.vue'",
  'InstitutionLtcEntry',
)
console.log('done')
