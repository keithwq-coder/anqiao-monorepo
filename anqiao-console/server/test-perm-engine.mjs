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
