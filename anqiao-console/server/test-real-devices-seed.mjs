// 验证脚本：真实设备与用户种子数据注入、Mock数据清理校验
// 运行：node --test server/test-real-devices-seed.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 2849
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_SECRET = 'test-seed-verify-secret'
const SEED_PASS = 'seed-pass-123456'

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

test('1. Mock 数据清理：DEVICE_ASSETS 中不包含任何 DEV_STOCK 或 DEV_SHIP 假数据', async () => {
  const { body } = await postLogin('admin01')
  const token = body.data.token

  const res = await fetch(`${BASE}/v1/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(res.status, 200)
  const devices = (await res.json()).data.list

  assert.ok(devices.length > 0, '设备台账不为空')
  const mockDevs = devices.filter(d => d.sn.startsWith('DEV_STOCK') || d.sn.startsWith('DEV_SHIP'))
  assert.equal(mockDevs.length, 0, '不应残留 DEV_STOCK 或 DEV_SHIP 等 Mock 数据')
})

test('2. 宿迁 3 台设备均在线并正确注入种子数据', async () => {
  const { body } = await postLogin('admin01')
  const token = body.data.token

  const res = await fetch(`${BASE}/v1/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const devices = (await res.json()).data.list

  const suqianSns = ['ASH01086', 'ASH01078', 'ASH01092']
  for (const sn of suqianSns) {
    const dev = devices.find(d => d.sn === sn)
    assert.ok(dev, `宿迁设备 ${sn} 应存在于设备资产台账中`)
    assert.equal(dev.online, true, `宿迁设备 ${sn} 必须为在线状态 (online: true)`)
    assert.ok(dev.device_placement_location.includes('宿迁'), `设备 ${sn} 安装位置应位于宿迁`)
  }
})

test('3. 宿迁 3 名真实用户（许丽、何家齐、王雪金）账号建立且能正常登录', async () => {
  const suqianUsers = [
    { username: 'xuli', name: '许丽', sn: 'ASH01086' },
    { username: 'hejiaqi', name: '何家齐', sn: 'ASH01078' },
    { username: 'wangxuejin', name: '王雪金', sn: 'ASH01092' },
  ]

  for (const u of suqianUsers) {
    const { httpStatus, body } = await postLogin(u.username)
    assert.equal(httpStatus, 200, `宿迁真实用户 ${u.username} (${u.name}) 登录应为 200`)
    assert.equal(body.data.staff.name, u.name, `用户名姓名应为 ${u.name}`)
    assert.equal(body.data.workspace, 'device_monitoring', '长者/监护人工作台分流正确')
  }
})

test('4. 虚拟与捏造用户彻底清理校验：严禁包含 user_zhoumin 等捏造用户，仅保留真实长者与在册点位', async () => {
  // 抽样验证捏造用户登录必定被拒 (401)，且避免触发单 IP 5 次防暴破阈值
  const { httpStatus: s1 } = await postLogin('user_zhoumin')
  assert.equal(s1, 401, '捏造用户 user_zhoumin 必须被彻底清除，登录应拒绝并返回 401 Unauthorized')

  const { httpStatus: s2 } = await postLogin('user_chenguizhi')
  assert.equal(s2, 401, '捏造用户 user_chenguizhi 必须被彻底清除，登录应拒绝并返回 401 Unauthorized')
})

test('5. 厂商全国地图与城市下钻：包含苏州与宿迁两地', async () => {
  const { body } = await postLogin('admin01')
  const token = body.data.token

  // 1. 城市列表
  const resCities = await fetch(`${BASE}/v1/geo/cities`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(resCities.status, 200)
  const cities = await resCities.json()
  assert.ok(cities.data.some(c => c.city === '宿迁'), '城市列表必须包含宿迁')
  assert.ok(cities.data.some(c => c.city === '苏州'), '城市列表必须包含苏州')

  // 2. 宿迁设备下钻
  const resSuqian = await fetch(`${BASE}/v1/geo/devices?city=宿迁`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(resSuqian.status, 200)
  const suqianDevices = (await resSuqian.json()).data.list
  assert.equal(suqianDevices.length, 3, '宿迁应有 3 台设备')
  for (const d of suqianDevices) {
    assert.equal(d.online, true, `宿迁设备 ${d.sn} 必须在线`)
  }
})

test('6. LTC 医保档案：包含真实长者与在网设备，全面清除假工单、假申请与假病历', async () => {
  const { body } = await postLogin('medical01')
  const token = body.data.token

  const resPersons = await fetch(`${BASE}/v1/ltc/assessed-persons`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(resPersons.status, 200)
  const persons = (await resPersons.json()).data.list

  for (const name of ['许丽', '何家齐', '王雪金']) {
    const p = persons.find(item => item.name === name)
    assert.ok(p, `医保监管档案中应存在真实长者 ${name}`)
    assert.ok(p.device_id.startsWith('ASH010'), `长者 ${name} 绑定感知设备正确`)
  }

  // 验证宿迁试点不编造虚假工单
  const resWo = await fetch(`${BASE}/v1/ltc/work-orders?pool_id=suqian`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(resWo.status, 200)
  const workOrders = (await resWo.json()).data.list
  assert.equal(workOrders.length, 0, '宿迁试点假工单应完全被清空 (0条)')

  // 验证模拟假病历被完全清除
  const resMed = await fetch(`${BASE}/v1/ltc/medical-records`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(resMed.status, 200)
  const medRecords = (await resMed.json()).data.list
  assert.equal(medRecords.length, 0, '模拟假病历应完全被清空 (0条)')

  // 验证宿迁试点不编造虚假申报案件
  const resApp = await fetch(`${BASE}/v1/ltc/applications?pool_id=suqian`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(resApp.status, 200)
  const applications = (await resApp.json()).data.list
  assert.equal(applications.length, 0, '宿迁申报案件应为0条')
})

test('7. 医保账号矩阵隔离：宿迁医保(3位长者)、某某市医保(演示长者)、中科安樵内部账号(全域协作)', async () => {
  // 1. medical_suqian: 专职监管宿迁统筹区
  const sqLogin = await postLogin('medical_suqian')
  assert.equal(sqLogin.httpStatus, 200)
  assert.equal(sqLogin.body.data.tenant.tenant_id, 'bureau_suqian')
  const sqToken = sqLogin.body.data.token
  const sqRes = await fetch(`${BASE}/v1/ltc/assessed-persons`, {
    headers: { Authorization: `Bearer ${sqToken}` },
  })
  const sqPersons = (await sqRes.json()).data.list
  assert.equal(sqPersons.length, 3, '宿迁医保专员默认仅见宿迁统筹区 3 位长者')
  for (const name of ['许丽', '何家齐', '王雪金']) {
    assert.ok(sqPersons.some(p => p.name === name), `宿迁专员名单应含 ${name}`)
  }

  // 2. demo_medical: 专职监管某某市统筹区（全业务演示区）
  const szLogin = await postLogin('demo_medical')
  assert.equal(szLogin.httpStatus, 200)
  assert.equal(szLogin.body.data.tenant.tenant_id, 'bureau_moumou')
  const szToken = szLogin.body.data.token
  const szRes = await fetch(`${BASE}/v1/ltc/assessed-persons`, {
    headers: { Authorization: `Bearer ${szToken}` },
  })
  const szPersons = (await szRes.json()).data.list
  assert.ok(szPersons.length >= 5, '某某市医保专员应见演示长者群')
  assert.ok(szPersons.some(p => p.name === '赵大有'), '某某市长者名单应包含赵大有')

  // 3. medical01: 中科安樵自营运营内部主管，拥有全域协同漫游能力
  const aqLogin = await postLogin('medical01')
  assert.equal(aqLogin.httpStatus, 200)
  assert.equal(aqLogin.body.data.tenant.tenant_id, 'anqiao', 'medical01 归属于中科安樵自营运营')
  assert.equal(aqLogin.body.data.data_scope, 'global', 'medical01 拥有 global 全域协作范围')
  const aqToken = aqLogin.body.data.token
  const aqRes = await fetch(`${BASE}/v1/ltc/assessed-persons`, {
    headers: { Authorization: `Bearer ${aqToken}` },
  })
  const aqPersons = (await aqRes.json()).data.list
  assert.ok(aqPersons.length >= 8, '中科安樵内部账号拥有全统筹区全景长者数据 (3位宿迁真实长者 + 5位某某市演示长者)')
})

