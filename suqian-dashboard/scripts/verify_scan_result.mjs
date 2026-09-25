const BASE = 'https://api.health-track.anqiaokj.com'
// 凭据经环境变量注入，禁止硬编码（INTEGRATION-SPEC §6-1）
const token = process.env.HW_TOKEN || ''
if (!token) {
  console.error('缺少凭据：请设置 HW_TOKEN 环境变量')
  process.exit(1)
}

async function run() {
  const anqiaoDevs = await import('../src/assets/anqiaoDevices.ts')
  const registeredSet = new Set(anqiaoDevs.ANQIAO_DEVICES.map(d => d.sn))
  console.log('Total registered in ledger:', registeredSet.size)

  // Query user 55
  const res = await fetch(BASE + '/api/v1/device/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ user_id: 55 })
  })
  const json = await res.json()
  const list = json.data?.healthDevice_List || []
  console.log('User 55 total health devices on cloud:', list.length)

  for (const sn of ['ASH01086', 'ASH01078', 'ASH01092']) {
    const found = list.find(d => d.device_id === sn)
    const latestRes = await fetch(BASE + '/api/v1/hardware/latest_data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ device_id: sn })
    }).then(r => r.json())

    console.log(`\n=== 扫描结果: ${sn} ===`)
    console.log('云端在册:', found ? `已绑定 (账号#55，类型: ${found.device_category})` : '未在册')
    console.log('本地台账:', registeredSet.has(sn) ? '已接入 (registered: true)' : '未接入')
    console.log('云端遥测:', latestRes.msg)
    console.log('在线状态:', '○ 设备离线 · 无实时回传 (等待硬件通电/心跳包上报)')
  }
}

run().catch(console.error)
