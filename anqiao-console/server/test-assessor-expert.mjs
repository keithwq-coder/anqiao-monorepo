import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 8196
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'aq-test-assessor-secret'
const SEED_PASS = '2026'

let child
let baseUrlReady = false

function postLogin(username, password = SEED_PASS) {
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
      env: { ...process.env, PORT: String(PORT), TOKEN_SECRET, SEED_ACCOUNT_PASSWORD: SEED_PASS, DISABLE_LTC_PERSIST: 'true' },
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

test('1. 宿迁失能评定师 (suqian_assessor) 权限与试点任务隔离', async () => {
  const { httpStatus, body } = await postLogin('suqian_assessor')
  assert.equal(httpStatus, 200)
  assert.equal(body.data.principal.role, 'assessor')
  assert.equal(body.data.principal.pool_id, 'suqian')
  assert.equal(body.data.principal.tenant_id, 'assessor_suqian')
  assert.equal(body.data.workspace, 'assessor_workspace')

  const token = body.data.token

  // 获取宿迁评估任务列表
  const res = await authGet('/v1/ltc/tasks?pool_id=suqian', token)
  assert.equal(res.httpStatus, 200)
  const tasks = res.body?.data?.list || []
  assert.equal(tasks.length, 3, '宿迁试点必须严格对应3位长者任务')

  const elderNames = tasks.map((t) => t.applicant_name)
  assert.ok(elderNames.includes('许丽'))
  assert.ok(elderNames.includes('何家齐'))
  assert.ok(elderNames.includes('王雪金'))

  // 严禁泄露某某市演示数据
  assert.ok(!elderNames.includes('赵大有'))
})

test('2. 宿迁评定师接单排班 (TASK-SQ-2026-003 王雪金) 与设备快照红线核验', async () => {
  const { body: loginBody } = await postLogin('suqian_assessor')
  const token = loginBody.data.token

  // 接单
  const acceptRes = await authPost('/v1/ltc/tasks/TASK-SQ-2026-003/accept', {}, token)
  assert.equal(acceptRes.httpStatus, 200)
  assert.equal(acceptRes.body?.data?.status, 'assessing')

  // 冻结客观设备快照（遵循合规红线：conclusion 恒为 null）
  const snapRes = await authPost('/v1/ltc/snapshots', {
    task_id: 'TASK-SQ-2026-003',
    device_id: 'ASH01092',
  }, token)
  assert.equal(snapRes.httpStatus, 200)
  assert.strictEqual(snapRes.body?.data?.conclusion, null, '合规红线：设备快照 conclusion 必须恒为 null')

  // 处理 AI 助手洞察
  const handleRes = await authPost('/v1/ltc/insights/INS-SQ-003/handle', {
    action: 'adopted',
    note: '现场已复核，长者起夜需搀扶，客观体征垫离床频次与自理能力评定一致',
  }, token)
  assert.equal(handleRes.httpStatus, 200)
  assert.equal(handleRes.body?.data?.handling_status, 'adopted')
})

test('3. 评定专家委员会医学评审组长 (suqian_expert) 双专家评审与结论书签发', async () => {
  const { body: loginBody } = await postLogin('suqian_expert')
  assert.equal(loginBody.data.principal.role, 'assessor_expert')
  assert.equal(loginBody.data.principal.pool_id, 'suqian')
  const token = loginBody.data.token

  // 专家委员会医学评审大盘
  const dashRes = await authGet('/v1/ltc/assessor/dashboard?pool_id=suqian', token)
  assert.equal(dashRes.httpStatus, 200)
  assert.equal(dashRes.body?.data?.pool_id, 'suqian')
  assert.equal(dashRes.body?.data?.org_name, '宿迁市广济第三方失能等级评定中心')
  assert.equal(dashRes.body?.data?.statutory_red_lines?.dual_assessor_mandatory, true)
  assert.equal(dashRes.body?.data?.statutory_red_lines?.dual_expert_confirmation_mandatory, true)
  assert.strictEqual(dashRes.body?.data?.statutory_red_lines?.iot_telemetry_conclusion_frozen, null)

  // 对何家齐 (TASK-SQ-2026-002) 开展集中医学评审与双专家会签
  const reviewRes = await authPost('/v1/ltc/tasks/TASK-SQ-2026-002/expert-review', {
    second_expert_id: 'exp_sq_neurology',
    second_expert_name: '王德林 主任医师 (老年医学科)',
    clinical_diagnosis: '脑梗死后遗症伴完全性右侧肢体瘫痪、血管性认知障碍',
    recommended_level: '重度失能三级 (完全失能)',
    expert_opinion: '经专家组查验病历、入户双人录音录像及安守护毫米波雷达连续72小时99.2%在床客观遥测，医学依据充分，评定为重度失能三级。',
    iot_consistency_verdict: 'consistent',
    iot_clinical_rationale: '雷达客观离床0次遥测排除欺诈挂床，与完全卧床临床诊断100%吻合。',
    sign_off_status: 'approved',
  }, token)
  assert.equal(reviewRes.httpStatus, 200)
  assert.equal(reviewRes.body?.data?.task?.status, 'completed')
  assert.deepEqual(reviewRes.body?.data?.task?.expert_confirmation, ['suqian_expert', 'exp_sq_neurology'])
  assert.ok(reviewRes.body?.data?.report?.report_no?.startsWith('BG-SUQIAN-'))
  assert.equal(reviewRes.body?.data?.report?.status, 'ratified')
})

test('4. 宿迁评定机构质控主管 (suqian_assessor_admin) 全盘统揽与高斯偏离监管', async () => {
  const { body: loginBody } = await postLogin('suqian_assessor_admin')
  assert.equal(loginBody.data.principal.role, 'assessor_admin')
  assert.equal(loginBody.data.principal.pool_id, 'suqian')
  const token = loginBody.data.token

  const dashRes = await authGet('/v1/ltc/assessor/dashboard?pool_id=suqian', token)
  assert.equal(dashRes.httpStatus, 200)
  assert.equal(dashRes.body?.data?.kpis?.dual_assessor_compliance_pct, 100)
  assert.equal(dashRes.body?.data?.kpis?.dual_expert_compliance_pct, 100)
  assert.equal(dashRes.body?.data?.kpis?.gaussian_status, 'normal')
})

test('5. 某某市演示账户群 (demo_assessor / demo_expert / demo_assessor_admin) 隔离与兼容性', async () => {
  const { body: asrBody } = await postLogin('demo_assessor')
  const asrToken = asrBody.data.token
  const mmTasksRes = await authGet('/v1/ltc/tasks?pool_id=moumou', asrToken)
  assert.equal(mmTasksRes.httpStatus, 200)
  const mmTasks = mmTasksRes.body?.data?.list || []
  assert.ok(mmTasks.some((t) => t.applicant_name === '赵大有'))
  assert.ok(!mmTasks.some((t) => t.applicant_name === '许丽'), '某某市不得包含宿迁试点长者')

  // 兼容老账号 assessor01 正常登录
  const { httpStatus: oldStatus, body: oldBody } = await postLogin('assessor01')
  assert.equal(oldStatus, 200)
  assert.equal(oldBody.data.principal.role, 'assessor')
})
