// W2 设备全生命周期 CRUD（PRD §2.3.2/§2.3.5）纯函数契约回归（node --test）
// 运行：node --test server/test-device-crud.mjs
process.env.SEED_ACCOUNT_PASSWORD ||= `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
process.env.DISABLE_LTC_PERSIST ||= 'true'

const { test } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const {
  setPersistEnabled,
  resetState,
  ctxForAccount,
  LtcError,
  createDeviceAsset,
  updateDeviceAsset,
  deleteDeviceAsset,
} = await import('./ltc.js')
const { ACCOUNTS, DEVICE_ASSETS, DEVICE_LIFECYCLE_LOGS } = await import('./seed.js')

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

test('N17 POST 新建设备：admin01 可创建，新 device_id 出现在设备列表', () => {
  resetState()
  const before = DEVICE_ASSETS.length
  const dev = createDeviceAsset(ctxOf('admin01'), {
    device_id: 'TEST-CRUD-001',
    label: '测试新增设备',
    type: 'AI健康守护仪 (ANCE-01)',
  })
  assert.equal(dev.device_id, 'TEST-CRUD-001')
  assert.equal(dev.label, '测试新增设备')
  assert.ok(DEVICE_ASSETS.find((d) => d.device_id === 'TEST-CRUD-001'), '列表应可查到新设备')
  assert.equal(DEVICE_ASSETS.length, before + 1)
})

test('N17 POST 重复 device_id → 409', () => {
  resetState()
  assertLtcError(
    () => createDeviceAsset(ctxOf('admin01'), { device_id: 'ANCE00001', label: '重复设备' }),
    409,
  )
})

test('N17 POST 无 device:write 角色 → 403（family_contact）', () => {
  resetState()
  assertLtcError(
    () => createDeviceAsset(ctxOf('family_demo'), { device_id: 'TEST-CRUD-403' }),
    403,
  )
})

test('N18 PATCH 修改 label/type：读取反映变更且生命周期日志追加一条', () => {
  resetState()
  const logsBefore = DEVICE_LIFECYCLE_LOGS.length
  const dev = updateDeviceAsset(ctxOf('admin01'), 'ANCE00001', {
    label: 'ANCE00001-改',
    type: 'AI健康守护仪 (ANCE-02)',
  })
  assert.equal(dev.label, 'ANCE00001-改')
  assert.equal(dev.type, 'AI健康守护仪 (ANCE-02)')
  const stored = DEVICE_ASSETS.find((d) => d.device_id === 'ANCE00001')
  assert.equal(stored.label, 'ANCE00001-改')
  const newLogs = DEVICE_LIFECYCLE_LOGS.slice(logsBefore)
  assert.equal(newLogs.length, 1, '应追加恰好一条审计日志')
  assert.equal(newLogs[0].device_id, 'ANCE00001')
  assert.equal(newLogs[0].operator_id, 'admin01')
})

test('N18 PATCH 不存在设备 → 404', () => {
  resetState()
  assertLtcError(
    () => updateDeviceAsset(ctxOf('admin01'), 'NO-SUCH-DEVICE', { label: 'x' }),
    404,
  )
})

test('N19 DELETE 普通设备：列表移除且日志留痕', () => {
  resetState()
  const created = createDeviceAsset(ctxOf('admin01'), {
    device_id: 'TEST-CRUD-DEL',
    label: '待删除设备',
  })
  assert.ok(DEVICE_ASSETS.find((d) => d.device_id === 'TEST-CRUD-DEL'))
  const logsBefore = DEVICE_LIFECYCLE_LOGS.length
  const result = deleteDeviceAsset(ctxOf('admin01'), 'TEST-CRUD-DEL')
  assert.equal(result.device_id, 'TEST-CRUD-DEL')
  assert.ok(!DEVICE_ASSETS.find((d) => d.device_id === 'TEST-CRUD-DEL'), '删除后列表应移除')
  const newLogs = DEVICE_LIFECYCLE_LOGS.slice(logsBefore)
  assert.ok(newLogs.some((l) => l.device_id === 'TEST-CRUD-DEL'), '删除应写入审计留痕')
})

test('N19 DELETE 宿迁试点设备 ASH01086 → 403 且提示「宿迁试点设备受保护」', () => {
  resetState()
  assertLtcError(() => deleteDeviceAsset(ctxOf('admin01'), 'ASH01086'), 403, '宿迁试点设备受保护')
  assertLtcError(() => deleteDeviceAsset(ctxOf('admin01'), 'ASH01078'), 403, '宿迁试点设备受保护')
  assertLtcError(() => deleteDeviceAsset(ctxOf('admin01'), 'ASH01092'), 403, '宿迁试点设备受保护')
})
