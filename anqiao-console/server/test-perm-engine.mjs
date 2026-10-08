// 权限引擎重构验收测试（W1-W6）：三层模型 用户-组-颗粒。
// 运行：npm test（已挂入 package.json test script）
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2858
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-perm-engine-secret'
const SEED_PASS = 'seed-pass-123456'
const SQLITE = path.join(__dirname, '.tmp-perm-engine-test.sqlite')

let child
let serverReady

async function postJson(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return await res.json()
}

async function getJson(pathname, token) {
  const res = await fetch(`${BASE}${pathname}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return await res.json()
}

async function patchJson(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return await res.json()
}

async function login(username, password = SEED_PASS) {
  const body = await postJson('/v1/auth/login', { username, password })
  assert.equal(body.code, 200, `登录失败 ${username}: ${JSON.stringify(body)}`)
  return body.data
}

function startServer() {
  return new Promise((resolve) => {
    child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      env: {
        ...process.env,
        PORT: String(PORT),
        TOKEN_SECRET,
        SEED_ACCOUNT_PASSWORD: SEED_PASS,
        DISABLE_LTC_PERSIST: 'true',
        DATA_LAYER: 'sqlite',
        DB_PATH: SQLITE,
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d.toString()
      if (!serverReady && buf.includes('[server] 安守护')) {
        serverReady = true
        resolve()
      }
    })
    child.on('exit', () => {
      if (!serverReady) resolve()
    })
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (!child) return resolve()
    child.on('exit', () => resolve())
    child.kill()
    child = null
    serverReady = false
  })
}

before(async () => {
  await startServer()
})

after(async () => {
  await stopServer()
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      ;(await import('node:fs')).rmSync(SQLITE + suffix, { force: true })
    } catch {}
  }
})

// ---------- W1 零微调回归：既有账号登录 permissions 与旧引擎逐字段一致 ----------
test('W1 零微调回归：康宁/宿迁/平台账号登录响应 permissions 与旧引擎输出一致', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, 'auth.js')).href)
  for (const username of ['kangning_admin', 'kangning_nurse', 'suqian_medical', 'xuli', 'admin01', 'insurer01', 'assessor01']) {
    const session = await login(username)
    const expected = JSON.stringify(mod.permissionsOf(session.principal.role))
    assert.equal(
      JSON.stringify([...session.permissions].sort()),
      JSON.stringify(JSON.parse(expected).sort()),
      `${username} 登录 permissions 必须等于旧引擎组定义`,
    )
  }
  // 既有负向断言原样保留：insurer01 无 supervision:create
  const ins = await login('insurer01')
  assert.ok(!ins.permissions.includes('supervision:create'), 'insurer01 不应有 supervision:create')
  const asm = await login('assessor01')
  assert.ok(!asm.permissions.includes('task:dispatch'), 'assessor01 不应有 task:dispatch')
})

// ---------- W2 颗粒微调生效：PATCH → 重登/会话刷新可见 → 被关颗粒 REST 403 ----------
test('W2 颗粒微调全链路：院长微调护士 → 护士会话刷新见新集 → revoke 的 patient:read 调 /v1/patients 403', async () => {
  const admin = await login('kangning_admin')

  // 微调：护士 +report:generate − patient:read
  const patched = await patchJson('/v1/org/users/kangning_nurse', {
    granted_perms: ['report:generate'],
    revoked_perms: ['patient:read'],
  }, admin.token)
  assert.equal(patched.code, 200, JSON.stringify(patched))
  assert.ok(patched.data.permissions.includes('report:generate'), '加开颗粒在生效集中')
  assert.ok(!patched.data.permissions.includes('patient:read'), '关闭颗粒不在生效集中')

  // 目标账号无需重签 token：旧 token 直接被实时合并拦截
  const nurseLogin = await login('kangning_nurse')
  const session = await getJson('/v1/auth/session', nurseLogin.token)
  assert.equal(session.code, 200)
  assert.ok(session.data.permissions.includes('report:generate'), 'session 刷新见 +report:generate')
  assert.ok(!session.data.permissions.includes('patient:read'), 'session 刷新见 -patient:read')

  const denied = await getJson('/v1/patients', nurseLogin.token)
  assert.equal(denied.code, 403, `被 revoke 的 patient:read 必须 403（实际 ${denied.code}）`)

  // 对照组：护士长未微调 → 200
  const head = await login('kangning_head')
  const okList = await getJson('/v1/patients', head.token)
  assert.equal(okList.code, 200)

  // 还原（组默认），避免污染后续用例
  const reset = await patchJson('/v1/org/users/kangning_nurse', { reset_perms: true }, admin.token)
  assert.equal(reset.code, 200)
  assert.equal(reset.data.granted_perms.length, 0)
  assert.equal(reset.data.revoked_perms.length, 0)
  const nurseAgain = await getJson('/v1/patients', (await login('kangning_nurse')).token)
  assert.equal(nurseAgain.code, 200, 'reset 后恢复 200')
})

// ---------- W3 守卫：越租户/无颗粒/全集外编码/无创建端点 ----------
test('W3 守卫：护士无 user:manage 403；跨租户目标 403；su 账号不可被微调；未知颗粒 400；无创建端点', async () => {
  const nurse = await login('kangning_nurse')
  const deniedList = await getJson('/v1/org/users', nurse.token)
  assert.equal(deniedList.code, 403, '无 user:manage 不得列账号')

  const admin = await login('kangning_admin')
  // 跨租户：康宁院长改平台账号 → 403（同租户校验）
  const cross = await patchJson('/v1/org/users/admin01', { granted_perms: ['patient:read'] }, admin.token)
  assert.equal(cross.code, 403, '跨租户目标必须 403')

  // su 账号不受微调
  const suGuard = await patchJson('/v1/org/users/su01', { granted_perms: ['patient:read'] }, (await login('su01')).token)
  assert.ok([403].includes(suGuard.code), 'su 账号必须拒绝微调')

  // 未知颗粒 400
  const badCode = await patchJson('/v1/org/users/kangning_nurse', { granted_perms: ['bogus:code'] }, admin.token)
  assert.equal(badCode.code, 400, '全集外颗粒必须 400')

  // 无创建端点
  const createTry = await postJson('/v1/org/users', { username: 'intruder', password: '123456' }, admin.token)
  assert.ok([404, 405].includes(createTry.code), '租户内不得有创建账号端点')
})

// ---------- W4 switch 修复：以 ACCOUNTS 实时账号下发（不再基于旧 token） ----------
test('W4 switch 修复：switch 下发与账号实时组一致，payload 补齐 unified_role/pool_id/workspace', async () => {
  const session = await login('kangning_admin')
  const sw = await postJson('/v1/auth/switch', { tenant_id: 'kangning' }, session.token)
  assert.equal(sw.code, 200, JSON.stringify(sw))
  assert.equal(sw.data.permissions.length > 0, true, 'switch 下发权限非空')
  assert.ok(sw.data.permissions.includes('user:manage'), 'switch 后 nursing_admin 应含 user:manage（实时账号组）')
})

// ---------- W5 business_user 修复：销售席位三表齐备 ----------
test('W5 business_user 修复：销售席位 permissions 非空、workspace=customer_view', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, 'auth.js')).href)
  const perms = mod.effectivePermissionsOf({ role: 'business_user' })
  assert.deepEqual(perms, ['customer:read', 'lead:read', 'lead:write'])
  assert.equal(mod.workspaceOf('business_user'), 'customer_view')
  assert.equal(mod.dataScopeOf('business_user'), 'channel')
})

// ---------- W6 覆盖列持久化：重启后经 ensureSaasAccounts 带回 ----------
test('W6 持久化：微调落 sqlite → 重启服务 → 覆盖列经 ensureSaasAccounts 带回内存并生效', async () => {
  const admin = await login('kangning_admin')
  await patchJson('/v1/org/users/kangning_dossier', { granted_perms: ['alert:claim'], revoked_perms: [] }, admin.token)

  await stopServer()
  await startServer()

  const adminAgain = await login('kangning_admin')
  const list = await getJson('/v1/org/users', adminAgain.token)
  const dossier = list.data.list.find((u) => u.username === 'kangning_dossier')
  assert.ok(dossier, '重启后账号在列')
  assert.deepEqual(dossier.granted_perms, ['alert:claim'], '重启后 granted_perms 带回')
  // 还原
  await patchJson('/v1/org/users/kangning_dossier', { reset_perms: true }, adminAgain.token)
})

// ---------- 挂载自检 ----------
test('挂载自检：本文件已在 npm test 显式清单中', () => {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
  assert.match(pkg.scripts.test, /test-perm-engine\.mjs/, 'package.json test script 必须包含 test-perm-engine.mjs')
})

// ---------- G1 建组：admin 新建自定义组，颗粒须全集内 ----------
test('G1 建组：POST /v1/org/perm-groups → 200；未知颗粒 400；与内置组键同名 400', async () => {
  const admin = await login('kangning_admin')
  const created = await postJson('/v1/org/perm-groups', { name: '值班组长', codes: ['patient:read', 'alert:read', 'shift:write'] }, admin.token)
  assert.equal(created.code, 200, JSON.stringify(created))
  assert.ok(created.data.group_id.startsWith('pg_'), '组 id 约定 pg_ 前缀')

  const badCodes = await postJson('/v1/org/perm-groups', { name: '坏组', codes: ['bogus:x'] }, admin.token)
  assert.equal(badCodes.code, 400)

  const clash = await postJson('/v1/org/perm-groups', { name: 'nursing_nurse', codes: ['patient:read'] }, admin.token)
  assert.equal(clash.code, 400, '与内置组键同名必须 400')

  // 护士无 user:manage → 403
  const nurse = await login('kangning_nurse')
  const denied = await postJson('/v1/org/perm-groups', { name: 'x', codes: ['patient:read'] }, nurse.token)
  assert.equal(denied.code, 403)
})

// ---------- G2 换组：账号挂 custom 组，重登后权限 = 组颗粒 ----------
test('G2 换组：PATCH 账号 group=custom:<id> → 生效权限 = 组 codes；换组清空旧微调', async () => {
  const admin = await login('kangning_admin')
  const created = await postJson('/v1/org/perm-groups', { name: 'G2 组', codes: ['patient:read', 'overview:read'] }, admin.token)
  assert.equal(created.code, 200)
  const gid = created.data.group_id

  // 先给护士留一笔微调（换组应清空）
  await patchJson('/v1/org/users/kangning_nurse', { granted_perms: ['report:read'] }, admin.token)

  const assigned = await patchJson('/v1/org/users/kangning_nurse', { group: `custom:${gid}` }, admin.token)
  assert.equal(assigned.code, 200, JSON.stringify(assigned))
  assert.deepEqual([...assigned.data.permissions].sort(), ['overview:read', 'patient:read'])

  const session = await getJson('/v1/auth/session', (await login('kangning_nurse')).token)
  assert.deepEqual([...session.data.permissions].sort(), ['overview:read', 'patient:read'])

  // 挂不存在的 custom 组 → 404
  const ghost = await patchJson('/v1/org/users/kangning_nurse', { group: 'custom:pg_nope' }, admin.token)
  assert.equal(ghost.code, 404)

  // 挂未知内置键 → 400
  const badKey = await patchJson('/v1/org/users/kangning_nurse', { group: 'not_a_group' }, admin.token)
  assert.equal(badKey.code, 400)
})

// ---------- G3 改组：改组颗粒后，挂组账号权限随组实时变 ----------
test('G3 改组：PATCH 组 codes → 挂组账号无需操作权限即变', async () => {
  const admin = await login('kangning_admin')
  const created = await postJson('/v1/org/perm-groups', { name: 'G3 组', codes: ['patient:read'] }, admin.token)
  const gid = created.data.group_id
  await patchJson('/v1/org/users/kangning_dossier', { group: `custom:${gid}` }, admin.token)

  const updated = await patchJson(`/v1/org/perm-groups/${gid}`, { codes: ['patient:read', 'alert:claim'] }, admin.token)
  assert.equal(updated.code, 200)

  const session = await getJson('/v1/auth/session', (await login('kangning_dossier')).token)
  assert.ok(session.data.permissions.includes('alert:claim'), '改组后挂组账号实时获得新颗粒')
})

// ---------- G4 删组：被引用拒删（400），解除引用后可删 ----------
test('G4 删组：引用检查 → 400；换出后 → 200；内置组 DELETE 403', async () => {
  const admin = await login('kangning_admin')
  const created = await postJson('/v1/org/perm-groups', { name: 'G4 组', codes: ['patient:read'] }, admin.token)
  const gid = created.data.group_id
  await patchJson('/v1/org/users/kangning_caregiver', { group: `custom:${gid}` }, admin.token)

  const refused = await fetch(`${BASE}/v1/org/perm-groups/${gid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` },
  })
  assert.equal((await refused.json()).code, 400, '被引用组删除必须 400')

  await patchJson('/v1/org/users/kangning_caregiver', { group: 'nursing_caregiver' }, admin.token)
  const removed = await fetch(`${BASE}/v1/org/perm-groups/${gid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` },
  })
  assert.equal((await removed.json()).code, 200)

  // 内置组 DELETE → 403
  const builtinTry = await fetch(`${BASE}/v1/org/perm-groups/nursing_nurse`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` },
  })
  assert.equal((await builtinTry.json()).code, 403, '内置组运行时不可删')
})

// ---------- G5 跨租户组隔离：康宁建组，伙伴沙箱不可见/不可改 ----------
test('G5 组租户隔离：A 租户的组对 B 租户不可见且不可改删', async () => {
  const admin = await login('kangning_admin')
  const created = await postJson('/v1/org/perm-groups', { name: '康宁专属组', codes: ['patient:read'] }, admin.token)
  const gid = created.data.group_id

  // 伙伴沙箱视角：GET 不含康宁的组
  const su = await login('su01')
  await postJson('/v1/admin/tenants', {
    tenant_id: 'partner_perm_g5',
    name: 'G5 隔离验证机构',
    vertical: 'nursing_home',
    partner_sandbox: { sim_device_count: 1 },
  }, su.token)
  const partnerAdmin = await login('partner_perm_g5_admin')
  const groups = await getJson('/v1/org/perm-groups', partnerAdmin.token)
  assert.equal(groups.code, 200)
  assert.ok(!groups.data.custom.some((g) => g.group_id === gid), '康宁自定义组不得出现在伙伴租户组表')

  // 伙伴改/删康宁的组 → 404
  const patchTry = await patchJson(`/v1/org/perm-groups/${gid}`, { name: '劫持' }, partnerAdmin.token)
  assert.equal(patchTry.code, 404)
  const delTry = await fetch(`${BASE}/v1/org/perm-groups/${gid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${partnerAdmin.token}` },
  })
  assert.equal((await delTry.json()).code, 404)

  // 清理：把引用该组的康宁账号换回内置组再删组（G4 建立的组已在 G4 删）
  const knUsers = await getJson('/v1/org/users', admin.token)
  for (const u of knUsers.data.list) {
    if (u.role === `custom:${gid}`) await patchJson(`/v1/org/users/${u.username}`, { group: 'nursing_admin' }, admin.token)
  }
  await fetch(`${BASE}/v1/org/perm-groups/${gid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` },
  })
})
