// One-off: export anqiao-dashboard project packages to console server JSON
// Usage: node scripts/export-project-config.cjs
const fs = require('fs')
const path = require('path')

const DASH = path.join(__dirname, '..', '..', 'anqiao-dashboard', 'src', 'projects')
const OUT = path.join(__dirname, '..', 'server', 'project-config-data.json')

function extractArrayConst(file, name) {
  const src = fs.readFileSync(file, 'utf8')
  const re = new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*\\[`)
  const m = re.exec(src)
  if (!m) throw new Error(`array const ${name} not found in ${file}`)
  const start = src.indexOf('[', m.index + m[0].length - 1)
  let depth = 0
  let i = start
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  const raw = src
    .slice(start, i)
    .replace(/\bas\s+const\b/g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([\]}])/g, '$1')
  const v = (0, eval)('(' + raw + ')')
  if (!Array.isArray(v)) throw new Error(`${name} not array`)
  return v
}

function extractObjectConst(file, name) {
  const src = fs.readFileSync(file, 'utf8')
  const re = new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*\\{`)
  const m = re.exec(src)
  if (!m) throw new Error(`object const ${name} not found in ${file}`)
  const start = src.indexOf('{', m.index + m[0].length - 1)
  let depth = 0
  let i = start
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  const raw = src
    .slice(start, i)
    .replace(/\bas\s+const\b/g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([\]}])/g, '$1')
  return (0, eval)('(' + raw + ')')
}

function extractGeo(file) {
  // GEO_HIERARCHY may call helper functions (suqian makePilotDevice) — handle separately
  try {
    return extractArrayConst(file, 'GEO_HIERARCHY')
  } catch {
    return null
  }
}

function buildSuqianGeo(devices) {
  const vitals = {
    hr: 0,
    br: 0,
    tp: 0,
    in_bed: false,
    status_desc: '在册归档 · 无实时遥测',
    body_movement: 0,
  }
  const unit = (d) => ({
    device_id: d.sn,
    sn: d.sn,
    label: d.label,
    type: d.model,
    category: d.category,
    firmware: '未提供',
    building: '待确认',
    room: '待确认',
    vitals: { ...vitals },
    online: d.online,
    alerting: false,
    last_report_time: '',
    installer: '运营中心',
    installed_at: '待确认',
    ip: d.ip,
    network: d.network,
    userId: d.userId,
    lon: d.lon,
    lat: d.lat,
  })
  return [
    {
      city: '宿迁市',
      lon: 118.2752,
      lat: 33.963,
      device_total: devices.length,
      device_online: devices.filter((d) => d.online).length,
      alerts_today: 0,
      districts: [
        {
          id: 'sq_unconfirmed',
          name: '待确认片区',
          city: '宿迁市',
          lon: 118.2752,
          lat: 33.963,
          device_total: devices.length,
          device_online: devices.filter((d) => d.online).length,
          alerts_today: 0,
          communities: [
            {
              id: 'comm_sq_unconfirmed',
              name: '宿迁长护险首批试点 · 在册待确认点位',
              address: '地址待确认',
              district: '待确认',
              city: '宿迁市',
              device_total: devices.length,
              device_online: devices.filter((d) => d.online).length,
              alerts_today: 0,
              grid_manager: '运营中心',
              nurse_in_charge: '运营中心',
              contact_phone: '运营中心',
              buildings: ['待确认'],
              devices: devices.map(unit),
            },
          ],
        },
      ],
    },
  ]
}

const SQ = ['ASH01086', 'ASH01078', 'ASH01092']
const out = {}

for (const p of ['kaijian', 'suqian']) {
  let devices = extractArrayConst(path.join(DASH, p, 'anqiaoDevices.ts'), 'ANQIAO_DEVICES')
  const orgsRaw = extractObjectConst(path.join(DASH, p, 'orgData.ts'), 'ORG_PROFILES')
  const orgs = Object.values(orgsRaw)
  let geo = extractGeo(path.join(DASH, p, 'geoHierarchy.ts'))
  if (p === 'suqian') {
    devices = devices.filter((d) => SQ.includes(d.sn))
    if (devices.length !== 3) throw new Error(`suqian devices must be 3, got ${devices.length}`)
    geo = buildSuqianGeo(devices)
  }
  if (!geo) throw new Error(`geo missing for ${p}`)
  out[p] = { devices, orgs, geo }
  console.log(p, { devices: devices.length, orgs: orgs.length, geo: geo.length })
}

// red line check
const sn = out.suqian.devices.map((d) => d.sn).sort()
if (JSON.stringify(sn) !== JSON.stringify([...SQ].sort())) {
  throw new Error('suqian SN set mismatch: ' + sn.join(','))
}
if (out.suqian.devices.length !== 3) throw new Error('suqian must be 3')

fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes')
