const BASE = 'https://api.health-track.anqiaokj.com'
// 凭据经环境变量注入，禁止硬编码（INTEGRATION-SPEC §6-1）
const token = process.env.HW_TOKEN || ''
if (!token) {
  console.error('缺少凭据：请设置 HW_TOKEN 环境变量')
  process.exit(1)
}

const TARGET_SNS = ['ASH01086', 'ASH01078', 'ASH01092']

async function post(endpoint, body) {
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function run() {
  const anqiaoDevs = await import('../src/assets/anqiaoDevices.ts')
  const registeredSet = new Set(anqiaoDevs.ANQIAO_DEVICES.map(d => d.sn))
  console.log('Suqian ledger size:', registeredSet.size, '(must be 3: ASH01086/078/092)')

  console.log('\n--- latest_data by SN (authoritative; not user_id=55) ---')
  for (const sn of TARGET_SNS) {
    const latestRes = await post('/api/v1/hardware/latest_data', { device_id: sn })
    const d = latestRes.data || {}
    console.log(`\n=== ${sn} ===`)
    console.log('本地台账:', registeredSet.has(sn) ? '已接入 (registered: true)' : '未接入')
    console.log('云端遥测:', latestRes.msg, '| hr=', d.hr, 'br=', d.br, 'tp=', d.tp, 'isBed=', d.isBed, 'at=', d.created_at)
  }

  console.log('\n--- bind lookup user_id 1..250 (list only; telemetry already done by SN) ---')
  const hits = []
  for (let uid = 1; uid <= 250; uid++) {
    const json = await post('/api/v1/device/list', { user_id: uid })
    if (json.code !== 200 || !json.data) continue
    const list = []
    for (const k of Object.keys(json.data)) {
      if (Array.isArray(json.data[k])) list.push(...json.data[k])
    }
    for (const item of list) {
      if (TARGET_SNS.includes(item.device_id)) {
        hits.push({ uid, sn: item.device_id, account: item.account, latest: item.latest_data_time })
        console.log(`HIT ${item.device_id} bound to user_id=${uid} account=${item.account}`)
      }
    }
  }
  if (!hits.length) console.log('三台 SN 未出现在任何 user_id 1..250 的 device/list 中（遥测仍以 latest_data 为准）')
}

run().catch(console.error)
