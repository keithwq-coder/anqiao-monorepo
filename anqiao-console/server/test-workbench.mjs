// 阶段 B 纯函数/服务端契约回归（node --test）
// 运行：node --test server/test-workbench.mjs
process.env.SEED_ACCOUNT_PASSWORD ||= `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
process.env.DISABLE_LTC_PERSIST ||= 'true'

const { test } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const {
  setPersistEnabled,
  resetState,
  ctxForAccount,
  getWorkbenchSummary,
  listWorkbenchTodos,
  authorizedWorkspacesFor,
} = await import('./ltc.js')
const { ACCOUNTS } = await import('./seed.js')

setPersistEnabled(false)

function ctxOf(username) {
  const account = ACCOUNTS.find((a) => a.username === username)
  if (!account) throw new Error('missing account ' + username)
  return ctxForAccount(account)
}

test('N01 workbench summary：医保角色返回分组与 scope_label', () => {
  resetState()
  const ctx = ctxOf('medical01')
  const s = getWorkbenchSummary(ctx, { workspace: 'medical_supervision' })
  assert.equal(s.workspace, 'medical_supervision')
  assert.ok(s.scope_label)
  assert.ok(Array.isArray(s.groups) && s.groups.length >= 3)
  assert.equal(typeof s.total, 'number')
  assert.ok(Array.isArray(s.recent_receipts))
})

test('N02 workbench todos：分页结构 {list,total,page,page_size}', () => {
  resetState()
  const ctx = ctxOf('insurer01')
  const page = listWorkbenchTodos(ctx, { page: 1, page_size: 10 })
  assert.ok(Array.isArray(page.list))
  assert.equal(typeof page.total, 'number')
  assert.equal(page.page, 1)
  assert.equal(page.page_size, 10)
  assert.ok(page.total >= page.list.length)
})

test('N02 评估师待办对象类型受控', () => {
  resetState()
  const ctx = ctxOf('assessor01')
  const page = listWorkbenchTodos(ctx, { page: 1, page_size: 50 })
  for (const t of page.list) {
    assert.ok(
      ['task', 'application', 'work_order', 'settlement', 'supervision_case'].includes(t.object_type),
      t.object_type,
    )
  }
})

test('authorizedWorkspacesFor：角色获授列表', () => {
  assert.ok(authorizedWorkspacesFor('medical_insurance_staff').includes('medical_supervision'))
  assert.equal(authorizedWorkspacesFor('assessor').length, 1)
  assert.equal(authorizedWorkspacesFor('assessor')[0], 'assessor_workspace')
  assert.ok(authorizedWorkspacesFor('su').length >= 9)
  assert.deepEqual(authorizedWorkspacesFor('family_contact'), ['family_workspace'])
  assert.ok(!authorizedWorkspacesFor('medical_insurance_staff').includes('nursing_staff'))
})
