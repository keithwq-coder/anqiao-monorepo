// W3 设备 ↔ 体验角色群 N:M 分配（PRD §2.3.2/§2.3.5，N20）纯函数契约回归（node --test）
// 运行：node --test server/test-device-assignment.mjs
process.env.SEED_ACCOUNT_PASSWORD ||= `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
process.env.DISABLE_LTC_PERSIST ||= 'true'

const { test } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const {
  setPersistEnabled,
  resetState,
  ctxForAccount,
  LtcError,
  listDeviceAssignments,
  createDeviceAssignment,
  deleteDeviceAssignment,
} = await import('./ltc.js')
const { ACCOUNTS } = await import('./seed.js')

setPersistEnabled(false)

function ctxOf(username) {
  const account = ACCOUNTS.find((a) => a.username === username)
  if (!account) throw new Error('missing account ' + username)
  return ctxForAccount(account)
}

function assertLtcError(fn, status, messagePart) {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof LtcError, `应抛 LtcError，实为 ${e?.name}`)
    assert.equal(e.status, status, `status 应为 ${status}，实为 ${e.status} (${e.message})`)
    if (messagePart) assert.ok(String(e.message).includes(messagePart), `message 应含「${messagePart}」，实为「${e.message}」`)
    return
  }
  throw new Error(`应抛 LtcError(${status})，但未抛出`)
}

test('N20 N:M 分配：同一设备分配到两个不同角色群均成功', () => {
  resetState()
  const admin = ctxOf('admin01')
  const a1 = createDeviceAssignment(admin, { device_id: 'ANCE00001', role_group: 'nursing_home_demo' })
  const a2 = createDeviceAssignment(admin, { device_id: 'ANCE00001', role_group: 'home_care_demo' })
  assert.notEqual(a1.assignment_id, a2.assignment_id)
  const page = listDeviceAssignments(admin, {})
  const forDevice = page.list.filter((x) => x.device_id === 'ANCE00001')
  assert.ok(
    forDevice.some((x) => x.role_group === 'nursing_home_demo') && forDevice.some((x) => x.role_group === 'home_care_demo'),
    '一台设备应同时归属多个角色群',
  )
})

test('N20 同设备同角色群重复分配 → 409', () => {
  resetState()
  const admin = ctxOf('admin01')
  createDeviceAssignment(admin, { device_id: 'ANCE00001', role_group: 'nursing_home_demo' })
  assertLtcError(
    () => createDeviceAssignment(admin, { device_id: 'ANCE00001', role_group: 'nursing_home_demo' }),
    409,
  )
})

test('N20 分配宿迁试点设备 ASH01086 → 403（仅限真实域）', () => {
  resetState()
  assertLtcError(
    () => createDeviceAssignment(ctxOf('admin01'), { device_id: 'ASH01086', role_group: 'nursing_home_demo' }),
    403,
  )
})

test('N20 无 device:write 角色分配 → 403', () => {
  resetState()
  assertLtcError(
    () => createDeviceAssignment(ctxOf('family_demo'), { device_id: 'ANCE00001', role_group: 'nursing_home_demo' }),
    403,
  )
})

test('N20 列表查询返回全部分配关系；DELETE 撤销分配', () => {
  resetState()
  const admin = ctxOf('admin01')
  const a1 = createDeviceAssignment(admin, { device_id: 'ANCE00001', role_group: 'nursing_home_demo' })
  createDeviceAssignment(admin, { device_id: 'ANCE00002', role_group: 'insurer_demo' })
  const page = listDeviceAssignments(admin, {})
  assert.equal(page.total, 2)
  assert.equal(page.list.length, 2)

  deleteDeviceAssignment(admin, a1.assignment_id)
  const after = listDeviceAssignments(admin, {})
  assert.equal(after.total, 1)
  assert.ok(!after.list.some((x) => x.assignment_id === a1.assignment_id))

  assertLtcError(() => deleteDeviceAssignment(admin, 'DA-NOT-EXIST'), 404)
})
