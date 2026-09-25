// 医保局长护险智能监管工作台与政企协同闭环自动化测试
// 运行：node --test server/test-medical-supervision.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2858
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-medical-supervision-secret'
const SEED_PASS = process.env.SEED_ACCOUNT_PASSWORD || `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

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

// ==========================================
// 1. 医保账号矩阵登录与数据范围
// ==========================================
test('医保监管账号登录与专属数据范围（medical_suqian / medical01）', async () => {
  const sq = await postLogin('medical_suqian')
  assert.equal(sq.httpStatus, 200)
  assert.equal(sq.body.data.workspace, 'medical_supervision')
  assert.equal(sq.body.data.tenant.tenant_id, 'bureau_suqian')
  assert.equal(sq.body.data.data_scope, 'pool')
  assert.equal(sq.body.data.principal.pool_id, 'suqian')

  const sz = await postLogin('medical01')
  assert.equal(sz.httpStatus, 200)
  assert.equal(sz.body.data.principal.role, 'medical_insurance_staff')
  assert.equal(sz.body.data.principal.unified_role, 'medical_supervisor')
  assert.ok(sz.body.data.permissions.includes('supervision:operate'))
})

// ==========================================
// 2. 监管驾驶舱宏观大盘
// ==========================================
test('监管驾驶舱宏观大盘：资金池总盘、月度结余率走势、机构五星信用与预警红黄牌', async () => {
  const sq = await postLogin('medical_suqian')
  const token = sq.body.data.token

  const res = await fetch(`${BASE}/v1/ltc/supervision/dashboard?pool_id=suqian`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(res.status, 200)
  const data = (await res.json()).data
  assert.ok(data.funds)
  assert.ok(data.funds.fund_pool_total > 0)
  assert.ok(data.funds.monthly_pending_disbursement > 0)
  assert.ok(data.funds.fund_balance_rate >= 90)
  assert.ok(Array.isArray(data.funds.balance_trend))

  // 信用机构列表
  assert.ok(Array.isArray(data.institution_credits))
  assert.ok(data.institution_credits.length > 0)
  const spotOrg = data.institution_credits.find((i) => i.org_id === 'bureau_suqian_spot')
  assert.ok(spotOrg)
  assert.equal(spotOrg.star_level, 5)
  assert.equal(spotOrg.compliance_rate, 100)

  // 预警看板
  assert.ok(data.warning_boards)
  assert.ok(Array.isArray(data.warning_boards.red))
  assert.ok(Array.isArray(data.warning_boards.yellow))
  assert.ok(data.warning_boards.red.length > 0)

  // 治理模式
  assert.ok(data.governance_mode)
  assert.ok(data.governance_mode.delegated_powers.length > 0)
  assert.ok(data.governance_mode.statutory_retained_powers.length > 0)
})

// ==========================================
// 3. 治理模式平滑切换
// ==========================================
test('治理模式平滑切换：委托经办协同模式与医保局全权直管模式切换', async () => {
  const sq = await postLogin('medical_suqian')
  const token = sq.body.data.token

  // 切换为直管
  const switch1 = await fetch(`${BASE}/v1/ltc/supervision/mode`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'direct' }),
  })
  assert.equal(switch1.status, 200)
  const res1 = (await switch1.json()).data
  assert.equal(res1.current_mode, 'direct')

  // 再次切换回委托协同
  const switch2 = await fetch(`${BASE}/v1/ltc/supervision/mode`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'delegated' }),
  })
  assert.equal(switch2.status, 200)
  const res2 = (await switch2.json()).data
  assert.equal(res2.current_mode, 'delegated')

  // 非法参数校验
  const switchErr = await fetch(`${BASE}/v1/ltc/supervision/mode`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'invalid_mode' }),
  })
  assert.equal(switchErr.status, 400)
})

// ==========================================
// 4. “委托-督办-终审”线索稽核闭环流转
// ==========================================
test('“委托-督办-终审”线索稽核闭环：AI扫描、督办函下发、经办反馈、医保局行政终审裁决', async () => {
  const sq = await postLogin('medical_suqian')
  const tokenSq = sq.body.data.token

  // 1. AI 规则引擎扫描
  const scanRes = await fetch(`${BASE}/v1/ltc/supervision/clues/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenSq}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pool_id: 'suqian' }),
  })
  assert.equal(scanRes.status, 200)
  const scanData = (await scanRes.json()).data
  assert.ok(scanData.scanned_devices >= 3)

  // 2. 查询线索列表
  const cluesRes = await fetch(`${BASE}/v1/ltc/supervision/clues`, {
    headers: { Authorization: `Bearer ${tokenSq}` },
  })
  assert.equal(cluesRes.status, 200)
  const cluesList = (await cluesRes.json()).data.list
  assert.ok(cluesList.length > 0)

  const pendingClue = cluesList.find((c) => c.status === 'pending_dispatch')
  assert.ok(pendingClue, '必须有一条待交办的疑点线索')

  // 3. 医保专员下发《长护险现场核查督办函》至受托经办机构
  const dispatchRes = await fetch(`${BASE}/v1/ltc/supervision/clues/${pendingClue.clue_id}/dispatch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenSq}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dispatched_to: 'insurer01',
      due_hours: 24,
      inquiry_points: '现场核实服务真实性',
    }),
  })
  assert.equal(dispatchRes.status, 200)
  const dispatchedClue = (await dispatchRes.json()).data
  assert.equal(dispatchedClue.status, 'dispatched')
  assert.ok(dispatchedClue.dispatch_order)
  assert.ok(dispatchedClue.dispatch_order.order_no.includes('督字'))

  // 4. 受托经办机构现场调查后回传核查反馈与初核建议
  const ins = await postLogin('insurer01')
  const tokenIns = ins.body.data.token
  const feedbackRes = await fetch(`${BASE}/v1/ltc/supervision/clues/${pendingClue.clue_id}/feedback`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenIns}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interview_notes: '经办专员上门走访长者家属，证实助老员当日未实际进门提供照护。',
      pre_advisory: 'suggest_deduct',
    }),
  })
  assert.equal(feedbackRes.status, 200)
  const feedbackClue = (await feedbackRes.json()).data
  assert.equal(feedbackClue.status, 'feedback_received')
  assert.ok(feedbackClue.feedback)
  assert.equal(feedbackClue.feedback.pre_advisory, 'suggest_deduct')

  // 5. 医保局专员作出法定行政终审裁决（扣减拨款）
  const adjudicateRes = await fetch(`${BASE}/v1/ltc/supervision/clues/${pendingClue.clue_id}/adjudicate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenSq}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'deduct',
      penalty_amount: 1200,
      remarks: '经医保专班复核，确认虚构工单，扣减拨付款1200元。',
    }),
  })
  assert.equal(adjudicateRes.status, 200)
  const adjudicatedClue = (await adjudicateRes.json()).data
  assert.equal(adjudicatedClue.status, 'adjudicated')
  assert.ok(adjudicatedClue.adjudication)
  assert.equal(adjudicatedClue.adjudication.decision, 'deduct')
  assert.equal(adjudicatedClue.adjudication.penalty_amount, 1200)
  assert.ok(adjudicatedClue.adjudication.doc_no.includes('处字'))
})

// ==========================================
// 5. 机构协议熔断黑名单联动
// ==========================================
test('定点机构协议熔断联动：终审裁决terminate直接将机构列入熔断黑名单（suspended）', async () => {
  const sq = await postLogin('medical_suqian')
  const tokenSq = sq.body.data.token

  const cluesRes = await fetch(`${BASE}/v1/ltc/supervision/clues?status=pending_dispatch`, {
    headers: { Authorization: `Bearer ${tokenSq}` },
  })
  const list = (await cluesRes.json()).data.list
  if (list.length > 0) {
    const clue = list[0]
    // 医保专员直接作出熔断黑名单行政裁决
    const adj = await fetch(`${BASE}/v1/ltc/supervision/clues/${clue.clue_id}/adjudicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenSq}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'terminate',
        penalty_amount: 0,
        remarks: '违规情节恶劣，暂停定点协议并熔断列入黑名单。',
      }),
    })
    assert.equal(adj.status, 200)

    // 检查机构协议状态变为 suspended
    const dash = await fetch(`${BASE}/v1/ltc/supervision/dashboard`, {
      headers: { Authorization: `Bearer ${tokenSq}` },
    })
    const dData = (await dash.json()).data
    const inst = dData.institution_credits.find((i) => i.org_id === clue.target_org_id)
    if (inst) {
      assert.equal(inst.protocol_status, 'suspended')
    }
  }
})

// ==========================================
// 6. 四级穿透式调阅引擎
// ==========================================
test('四级穿透式调阅引擎：统筹区 -> 机构 -> 助老员 -> 长者/在床雷达全息透视证据链', async () => {
  const sq = await postLogin('medical_suqian')
  const token = sq.body.data.token

  const penRes = await fetch(`${BASE}/v1/ltc/supervision/penetration?pool_id=suqian`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(penRes.status, 200)
  const penData = (await penRes.json()).data
  assert.ok(penData.pools.length > 0)
  assert.ok(penData.institutions.length > 0)
  assert.ok(penData.caregivers.length > 0)
  assert.ok(penData.elders.length > 0)

  // 验证四级长者数据具备客观雷达体征与14天在床率
  const elder = penData.elders.find((e) => e.person_id === 'P_SQ_01' || e.name === '许丽')
  assert.ok(elder)
  assert.equal(elder.device_id, 'ASH01086')
  assert.equal(elder.online, true)
  assert.ok(elder.bed_rest_ratio_14d)
  assert.ok(elder.recent_vitals.hr > 0)
})

// ==========================================
// 7. 长护险四步结算终审与官方电子付款凭证
// ==========================================
test('长护险结算终审与官方电子付款凭证生成：四步分离推进与电子印章凭证获取', async () => {
  const sq = await postLogin('medical_suqian')
  const token = sq.body.data.token

  // 查询结算列表
  const sListRes = await fetch(`${BASE}/v1/ltc/settlements`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(sListRes.status, 200)
  const list = (await sListRes.json()).data.list

  // 寻找 pre_reviewed 状态的结算单执行医保行政终审
  const preSet = list.find((s) => s.status === 'pre_reviewed')
  if (preSet) {
    const revRes = await fetch(`${BASE}/v1/ltc/settlements/${preSet.settlement_id}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 3,
        action: 'pass',
        note: '医保长护专班行政终审通过，全额核准拨付。',
      }),
    })
    assert.equal(revRes.status, 200)
    const revBody = (await revRes.json()).data
    assert.equal(revBody.status, 're_reviewed')
    assert.ok(revBody.voucher, '终审通过后必须生成电子核准凭证')
    assert.ok(revBody.voucher.voucher_no.startsWith('YBFUND-PAY-'))
    assert.ok(revBody.voucher.seal_name.includes('医疗保障局'))

    // 调阅凭证专属接口
    const vRes = await fetch(`${BASE}/v1/ltc/settlements/${preSet.settlement_id}/voucher`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(vRes.status, 200)
    const vData = (await vRes.json()).data
    assert.equal(vData.voucher_no, revBody.voucher.voucher_no)
    assert.equal(vData.actual_disbursement, preSet.amount)
  }
})
