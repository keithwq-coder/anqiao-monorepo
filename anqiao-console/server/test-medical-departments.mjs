// 宿迁市试点监管席位与某某市医保局演示账号群测试
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2862
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-medical-dept-secret'
const SEED_PASS = '2026'

let child
let baseUrlReady

async function postLogin(username, password = SEED_PASS) {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json()
  return { httpStatus: res.status, body }
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
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d.toString()
      if (!baseUrlReady && buf.includes('[server] 安守护')) {
        baseUrlReady = true
        resolve()
      }
    })
    child.on('exit', () => {
      if (!baseUrlReady) resolve()
    })
  })
}

before(async () => {
  await startServer()
})

after(() => {
  if (child) child.kill()
})

test('宿迁市医保局试点监管席位登录验证 (suqian_medical / medical_suqian · 3台在网终端试点)', async () => {
  const accounts = [
    { u: 'suqian_medical', role: 'medical_insurance_staff', pool: 'suqian', title: '宿迁长护险试点监管席位' },
    { u: 'medical_suqian', role: 'medical_insurance_staff', pool: 'suqian', title: '宿迁长护险试点监管席位' },
  ]

  for (const acc of accounts) {
    const res = await postLogin(acc.u)
    assert.equal(res.httpStatus, 200, `Account ${acc.u} login should succeed`)
    assert.equal(res.body.data.workspace, 'medical_supervision')
    assert.equal(res.body.data.tenant.tenant_id, 'bureau_suqian')
    assert.equal(res.body.data.data_scope, 'pool')
    assert.equal(res.body.data.principal.pool_id, 'suqian')
    assert.equal(res.body.data.principal.role, acc.role)
    assert.ok(res.body.data.token)
  }
})

test('某某市医保局演示账号群登录验证 (副局长/稽查科长/结算主管/资格评估专员/综合席位)', async () => {
  const accounts = [
    { u: 'demo_director', role: 'medical_director', pool: 'moumou' },
    { u: 'demo_audit',    role: 'medical_auditor',  pool: 'moumou' },
    { u: 'demo_finance',  role: 'medical_finance',  pool: 'moumou' },
    { u: 'demo_qual',     role: 'medical_assessor_admin', pool: 'moumou' },
    { u: 'demo_medical',  role: 'medical_insurance_staff', pool: 'moumou' },
  ]

  for (const acc of accounts) {
    const res = await postLogin(acc.u)
    assert.equal(res.httpStatus, 200, `Account ${acc.u} login should succeed`)
    assert.equal(res.body.data.workspace, 'medical_supervision')
    assert.equal(res.body.data.tenant.tenant_id, 'bureau_moumou')
    assert.equal(res.body.data.data_scope, 'pool')
    assert.equal(res.body.data.principal.pool_id, 'moumou')
    assert.equal(res.body.data.principal.role, acc.role)
    assert.ok(res.body.data.token)
  }
})

test('省级医保局指导组账号登录验证 (province_medical / medical01)', async () => {
  const p1 = await postLogin('province_medical')
  assert.equal(p1.httpStatus, 200)
  assert.equal(p1.body.data.workspace, 'medical_supervision')
  assert.equal(p1.body.data.data_scope, 'global')

  const p2 = await postLogin('medical01')
  assert.equal(p2.httpStatus, 200)
  assert.equal(p2.body.data.workspace, 'medical_supervision')
  assert.equal(p2.body.data.data_scope, 'global')
})
