const BASE = 'https://api.health-track.anqiaokj.com'
const TARGET_SNS = ['ASH01086', 'ASH01078', 'ASH01092']

// 凭据经环境变量注入，禁止硬编码（INTEGRATION-SPEC §6-1）
const HW_ACCOUNT = process.env.HW_ACCOUNT || ''
const HW_PASSWORD = process.env.HW_PASSWORD || ''
const HW_TOKEN = process.env.HW_TOKEN || ''

async function main() {
  console.log('Logging in to cloud API...')
  if (!HW_TOKEN && !(HW_ACCOUNT && HW_PASSWORD)) {
    console.error('缺少凭据：请设置 HW_TOKEN，或 HW_ACCOUNT + HW_PASSWORD 环境变量')
    process.exit(1)
  }
  let token = HW_TOKEN
  if (!token) {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: HW_ACCOUNT, password: HW_PASSWORD }),
      })
      const json = await res.json()
      if (json.data?.access_token) {
        token = json.data.access_token
        console.log('Login OK, got fresh token.')
      }
    } catch (e) {
      console.log('Login failed:', e.message)
      process.exit(1)
    }
  }

  async function post(endpoint, body) {
    const res = await fetch(`${BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    return await res.json().catch(err => ({ error: err.message }))
  }

  console.log('\n--- 1. Querying /api/v1/hardware/latest_data for 3 target devices ---')
  for (const sn of TARGET_SNS) {
    const data = await post('/api/v1/hardware/latest_data', { device_id: sn })
    console.log(`[latest_data] ${sn}:`, JSON.stringify(data))
  }

  console.log('\n--- 2. Scanning users 1..250 via /api/v1/device/list ---')
  const userIds = Array.from({ length: 250 }, (_, i) => i + 1)
  const concurrency = 15
  let cursor = 0
  const allDevices = new Map()
  const targetHits = []

  async function worker() {
    while (cursor < userIds.length) {
      const uid = userIds[cursor++]
      try {
        const res = await post('/api/v1/device/list', { user_id: uid })
        if (res.code === 200 && res.data) {
          const list = []
          for (const key of Object.keys(res.data)) {
            if (Array.isArray(res.data[key])) {
              list.push(...res.data[key])
            }
          }
          for (const item of list) {
            if (item && item.device_id) {
              allDevices.set(item.device_id, { userId: uid, ...item })
              if (TARGET_SNS.includes(item.device_id) || TARGET_SNS.some(t => String(item.device_alias).includes(t))) {
                console.log(`🎯 HIT in userId ${uid}:`, JSON.stringify(item))
                targetHits.push({ userId: uid, item })
              }
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  console.log(`\nScan finished. Total unique devices discovered: ${allDevices.size}`)
  console.log('\n--- Discovered devices summary ---')
  for (const [sn, info] of [...allDevices.entries()].sort()) {
    console.log(`  ${sn.padEnd(16)} | uid:${String(info.userId).padStart(3)} | cat:${info.device_category || 'unknown'} | time:${info.latest_data_time || 'null'} | alias:${info.device_alias}`)
  }

  console.log('\n--- Target devices scan result ---')
  for (const sn of TARGET_SNS) {
    if (allDevices.has(sn)) {
      console.log(`✅ ${sn}: FOUND in userId ${allDevices.get(sn).userId}`)
    } else {
      console.log(`❌ ${sn}: NOT FOUND in any user account (1..250)`)
    }
  }
}

main().catch(console.error)
