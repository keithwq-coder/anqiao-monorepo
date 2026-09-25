const fs = require('fs')

// MedicalToday fixes
let m = fs.readFileSync('src/features/ltc-workbench/pages/MedicalToday.vue', 'utf8')
m = m.replace(
  `const sup = await createSupervisionCase({
      target_id: selected.value.application_id,
      application_id: selected.value.application_id,
      action,`,
  `const sup = await createSupervisionCase({
      target_id: selected.value.application_id,
      action,`,
)
m = m.replace(
  `:responsible="selected.handoff?.to || 'medical'"`,
  `:responsible="(selected as any).handoff?.to || 'medical'"`,
)
fs.writeFileSync('src/features/ltc-workbench/pages/MedicalToday.vue', m)
console.log('medical fixed')

// InsurerToday fixes
let i = fs.readFileSync('src/features/ltc-workbench/pages/InsurerToday.vue', 'utf8')
i = i.replace(
  `v-if="t.status === 'completed' && t.result_id"`,
  `v-if="t.status === 'completed' && (t as any).result_id"`,
)
i = i.replace(
  `@click="runApproveResult(t.result_id!)"`,
  `@click="runApproveResult((t as any).result_id)"`,
)
i = i.split('selected.handoff?.to').join('(selected as any).handoff?.to')
i = i.split('confirmTask.assessor?.account_id').join('(confirmTask as any).assessor?.account_id')
i = i.replace(
  `assessorPick = assessors[0]?.account_id || ''`,
  `assessorPick = (assessors[0] as any)?.account_username || ''`,
)
i = i.replace(`:value="a.account_id"`, `:value="(a as any).account_username || (a as any).account_id"`)
i = i.replace(
  `{{ a.name || a.account_id }}（{{ a.account_id }}）`,
  `{{ a.name || (a as any).account_username }}（{{ (a as any).account_username }}）`,
)
fs.writeFileSync('src/features/ltc-workbench/pages/InsurerToday.vue', i)
console.log('insurer fixed')

// AssessorToday snapshot fields
let a = fs.readFileSync('src/features/ltc-workbench/pages/AssessorToday.vue', 'utf8')
a = a.replace(
  `conclusion: {{ activeSnapshot.conclusion === null ? 'null' : activeSnapshot.conclusion }}`,
  `conclusion: {{ (activeSnapshot as any)?.conclusion == null ? 'null' : (activeSnapshot as any).conclusion }}`,
)
a = a.replace(
  `<p class="disclaimer">{{ activeSnapshot.disclaimer }}</p>`,
  `<p class="disclaimer">{{ (activeSnapshot as any).disclaimer || '设备快照仅作客观证据，不参与定级（conclusion 保持 null）' }}</p>`,
)
fs.writeFileSync('src/features/ltc-workbench/pages/AssessorToday.vue', a)
console.log('assessor fixed')
