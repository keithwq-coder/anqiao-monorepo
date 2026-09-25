const fs = require('fs')

// 1) state-labels material
let sl = fs.readFileSync('src/features/ltc-workbench/state-labels.ts', 'utf8')
if (!sl.includes('const MATERIAL')) {
  sl = sl.replace(
    'const SLA: Record<string, StateLabel> = {',
    `const MATERIAL: Record<string, StateLabel> = {
  pending: { label: '待上传', tone: 'muted' },
  collected: { label: '已收集', tone: 'info' },
  valid: { label: '有效', tone: 'success' },
  invalid: { label: '需补正', tone: 'danger' },
}

const SLA: Record<string, StateLabel> = {`,
  )
  sl = sl.replace(
    '  appeal: APPEAL,\n  sla: SLA,',
    '  appeal: APPEAL,\n  material: MATERIAL,\n  sla: SLA,',
  )
  fs.writeFileSync('src/features/ltc-workbench/state-labels.ts', sl)
  console.log('state-labels material ok')
} else console.log('material exists')

function injectVue(file, importLine, componentTag) {
  let s = fs.readFileSync(file, 'utf8')
  if (s.includes(componentTag)) {
    console.log(file, 'already has', componentTag)
    return
  }
  if (!s.includes(importLine)) {
    if (s.includes('<script setup lang="ts">')) {
      s = s.replace('<script setup lang="ts">', '<script setup lang="ts">\n' + importLine)
    } else if (s.includes('<script setup>')) {
      s = s.replace('<script setup>', '<script setup>\n' + importLine)
    } else {
      throw new Error('no script setup in ' + file)
    }
  }
  // insert after page-header if present, else after first <template> line
  const headerRe = /<div class="page-header">[\s\S]*?<\/div>\n/
  const m = s.match(headerRe)
  if (m) {
    s = s.replace(m[0], m[0] + '  <' + componentTag + ' />\n')
  } else {
    // AssessorApp may use different structure - insert after <template>\n
    if (s.includes('<template>\n')) {
      s = s.replace('<template>\n', '<template>\n  <' + componentTag + ' />\n')
    } else if (s.includes('<template>\r\n')) {
      s = s.replace('<template>\r\n', '<template>\r\n  <' + componentTag + ' />\r\n')
    } else {
      throw new Error('no template insert point in ' + file)
    }
  }
  fs.writeFileSync(file, s)
  console.log('injected', componentTag, 'into', file)
}

injectVue(
  'src/views/console/workspaces/MedicalSupervisionApp.vue',
  "import MedicalToday from '../../features/ltc-workbench/pages/MedicalToday.vue'",
  'MedicalToday',
)
injectVue(
  'src/views/console/workspaces/InsurerOperationsApp.vue',
  "import InsurerToday from '../../features/ltc-workbench/pages/InsurerToday.vue'",
  'InsurerToday',
)
injectVue(
  'src/views/console/workspaces/AssessorApp.vue',
  "import AssessorToday from '../../features/ltc-workbench/pages/AssessorToday.vue'",
  'AssessorToday',
)
