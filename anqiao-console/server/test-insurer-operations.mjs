import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 8195
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'aq-test-insurer-secret'
const SEED_PASS = '2026'

let child
let baseUrlReady = false

function postLogin(username, password) {
  return fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(async (res) => ({ httpStatus: res.status, body: await res.json() }))
}

function authGet(pathStr, token) {
  return fetch(`${BASE}${pathStr}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => ({ httpStatus: res.status, body: await res.json() }))
}

function authPost(pathStr, data, token) {
  return fetch(`${BASE}${pathStr}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  }).then(async (res) => ({ httpStatus: res.status, body: await res.json() }))
}

before(async () => {
  await new Promise((resolve) => {
    child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      env: { ...process.env, PORT: String(PORT), TOKEN_SECRET, SEED_ACCOUNT_PASSWORD: SEED_PASS },
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
    child.on('exit', () => { if (!baseUrlReady) resolve() })
  })
})

after(() => {
  if (child) child.kill()
})

test('经办机构多角色矩阵登录与专属数据范围（某某市5大角色 + 宿迁商保经办专班）', async () => {
  const roles = [
    { u: 'demo_insurer_director', role: 'insurer_director', pool: 'moumou' },
    { u: 'demo_insurer_intake', role: 'insurer_intake', pool: 'moumou' },
    { u: 'demo_insurer_inspector', role: 'insurer_inspector', pool: 'moumou' },
    { u: 'demo_insurer_auditor', role: 'insurer_auditor', pool: 'moumou' },
    { u: 'demo_insurer_service', role: 'insurer_service', pool: 'moumou' },
    { u: 'suqian_insurer', role: 'insurer_staff', pool: 'suqian' },
  ]
  for (const r of roles) {
    const { httpStatus, body } = await postLogin(r.u, SEED_PASS)
    assert.equal(httpStatus, 200, `${r.u} 登录应成功 200`)
    assert.equal(body.code, 200)
    assert.equal(body.data.principal.role, r.role)
    assert.equal(body.data.workspace, 'insurer_operations')
    assert.equal(body.data.pool_id, r.pool)
    assert.ok(body.data.token)
  }
})

test('经办综合大盘接口 GET /v1/ltc/insurer/dashboard 满足业务与SLA履约要求', async () => {
  const loginRes = await postLogin('demo_insurer_director', SEED_PASS)
  const token = loginRes.body.data.token

  const res = await authGet('/v1/ltc/insurer/dashboard?pool_id=moumou', token)
  assert.equal(res.httpStatus, 200)
  assert.equal(res.body.code, 200)
  const d = res.body.data
  assert.equal(d.pool_id, 'moumou')
  assert.ok(d.kpis.active_anomalies_pending_flycheck >= 1, '应有待现场飞检的物联异常工单')
  assert.ok(d.kpis.sla_compliance_rate >= 90, 'SLA达标率应在90%以上')
  assert.ok(Array.isArray(d.sla_countdowns) && d.sla_countdowns.length >= 2, '应有SLA倒计时预警')
  assert.equal(d.iot_health.radar_online_rate, 100)
})

test('物联赋能·智能巡查与现场靶向飞检任务查询与结果闭环录入', async () => {
  const loginRes = await postLogin('demo_insurer_inspector', SEED_PASS)
  const token = loginRes.body.data.token

  // 1. 查询飞检任务列表
  const listRes = await authGet('/v1/ltc/insurer/inspections?pool_id=moumou', token)
  assert.equal(listRes.httpStatus, 200)
  const list = listRes.body.data.list
  assert.ok(list.length >= 2, '某某市应有至少2条飞检任务')
  const task01 = list.find((t) => t.inspection_id === 'INSP-MM-001')
  assert.ok(task01, '应存在 INSP-MM-001 王金凤隔空打卡飞检任务')
  assert.equal(task01.status, 'pending_onsite')

  // 2. 巡查主管录入现场飞检结论
  const recordRes = await authPost(`/v1/ltc/insurer/inspections/INSP-MM-001/record`, {
    status: 'onsite_completed',
    conclusion: 'confirmed_fraud',
    conclusion_label: '违规属实·执行工单核减',
    onsite_notes: '经办巡查主管李勇突击上门现场调查询问，长者证实该时段助老员未入户，雷达空房属实。',
    inspector_name: '李勇 (现场巡查主管)',
  }, token)
  assert.equal(recordRes.httpStatus, 200)
  assert.equal(recordRes.body.data.status, 'onsite_completed')
  assert.equal(recordRes.body.data.conclusion, 'confirmed_fraud')
})

test('结算四步分离·经办初审与物联扣减核销闭环 (出具经办初审凭证)', async () => {
  const loginRes = await postLogin('demo_insurer_auditor', SEED_PASS)
  const token = loginRes.body.data.token

  // 1. 获取结算单
  const setsRes = await authGet('/v1/ltc/settlements', token)
  assert.equal(setsRes.httpStatus, 200)
  const sets = setsRes.body.data.list
  const declared = sets.find((s) => s.status === 'declared' && s.pool_id === 'moumou')
  assert.ok(declared, '应有待经办初审的某某市结算单')

  // 2. 经办初审员核减物联违规工单并提交初审
  const reviewRes = await authPost(`/v1/ltc/settlements/${declared.settlement_id}/review`, {
    step: 2,
    action: 'pre_review',
    deducted_amount: 4800,
    deduction_reasons: ['安守护毫米波雷达空房无人隔空打卡核减 (40小时违规)', '体征垫无受力扰动走过场核减'],
    note: '经办初审核减违规工单 4,800 元，通过初审并呈报医保局终审。',
  }, token)
  assert.equal(reviewRes.httpStatus, 200)
  assert.equal(reviewRes.body.data.status, 'pre_reviewed')
  assert.equal(reviewRes.body.data.pre_review_deduction, 4800)
  assert.ok(reviewRes.body.data.pre_review_voucher, '应出具经办初审凭证')
  assert.equal(reviewRes.body.data.pre_review_voucher.status, 'pre_review_passed')
})
