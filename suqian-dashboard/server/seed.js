// 安守护 SaaS 切片 · 种子数据与账号
// 切片阶段：内存态，重启即重置；生产环境应迁移至数据库（参考 wiki SPEC §1/§2）。
// 数据为确定性伪随机（mulberry32），每次启动一致，便于演示与对账。
// 告警/长者最新体征为可变内存态（处置写操作、WS 实时推送会直接修改），生产换 DB。

import { scryptSync, timingSafeEqual } from 'node:crypto'

// ---------- 确定性 PRNG ----------
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 密码哈希（scrypt；生产建议换 argon2id，见 wiki SPEC §2）----------
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LEN = 64

export function hashPassword(password, salt) {
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex')
  const { N, r, p } = SCRYPT_PARAMS
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, salt, hash] = parts
  const calc = scryptSync(password, salt, KEY_LEN, { N: +N, r: +r, p: +p })
  const expect = Buffer.from(hash, 'hex')
  return calc.length === expect.length && timingSafeEqual(calc, expect)
}

// ---------- 种子账号 ----------
// 初始密码统一由 env SEED_ACCOUNT_PASSWORD 注入，仓库内不保存任何明文口令（INTEGRATION-SPEC §6-4）。
// 切片用固定 salt 保证启动确定性；生产必须改为随机 salt。
// allowed_tenants：多组织切换白名单（POST /v1/auth/switch 校验依据）
const SEED_ACCOUNT_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD
if (!SEED_ACCOUNT_PASSWORD) {
  console.error('[fatal] SEED_ACCOUNT_PASSWORD 未注入，拒绝启动。请经 systemd EnvironmentFile 或进程环境提供（上线后请立即轮换）。')
  process.exit(1)
}
const ALL_ORGS = ['anqiao', 'kaijian']
export const ACCOUNTS = [
  { username: 'ops01', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ops01'), staff_name: '运营管理员', role: 'admin', tenant_id: 'anqiao', allowed_tenants: ALL_ORGS },
  { username: 'hq01', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-hq01'), staff_name: '总部管理员', role: 'admin', tenant_id: 'anqiao', allowed_tenants: ALL_ORGS },
  { username: 'nurse01', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-nurse01'), staff_name: '李晓芳 护士长', role: 'nurse', tenant_id: 'kaijian', allowed_tenants: ALL_ORGS },
  { username: 'admin01', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-admin01'), staff_name: '王建华 院长', role: 'admin', tenant_id: 'kaijian', allowed_tenants: ALL_ORGS },
]


// ---------- 时间工具（东八区 ISO 8601）----------
const TZ8_MS = 8 * 3600 * 1000

export function toIso8(date) {
  const t = new Date(date.getTime() + TZ8_MS)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}+08:00`
}

export function nowIso8() {
  return toIso8(new Date())
}

function todayStr8() {
  return nowIso8().slice(0, 10)
}

// ---------- 床位与楼层布局 ----------
// 凯健护理院与前端大屏 mock 对账一致：87 在住 / 96 床位
const KAIJIAN_OCCUPIED_BEDS = [
  '401-A','401-B','402-A','402-B','403-A','403-B','404-A','404-B','405-A','405-B','406-A','406-B',
  '407-A','407-B','408-A','408-B','409-A','409-B','410-A','410-B','411-A','411-B',
  '301-A','301-B','302-A','302-B','303-A','303-B','304-A','304-B','305-A','305-B','306-A','306-B',
  '307-A','307-B','308-A','308-B','309-A','309-B','310-A','310-B','311-A',
  '201-A','201-B','202-A','202-B','203-A','203-B','204-A','204-B','205-A','205-B','206-A','206-B',
  '207-A','207-B','208-A','208-B','209-A','209-B','210-A','210-B','211-A','211-B',
  '101-A','101-B','102-A','102-B','103-A','103-B','104-A','104-B','105-A','105-B','106-A','106-B',
  '107-A','107-B','108-A','108-B','109-A','109-B','110-A','110-B','111-A','111-B',
]
const KAIJIAN_VACANT_BEDS = ['412-A','412-B','311-B','312-A','312-B','212-A','212-B','112-A','112-B']

const KAIJIAN_FLOOR_WARDS = {
  '4F': '完全失能专区',
  '3F': '认知障碍专区',
  '2F': '术后康复专区',
  '1F': '慢病颐养专区',
}
const KAIJIAN_FLOOR_CARE = { '4F': '特级护理', '3F': '一级护理', '2F': '二级护理', '1F': '二级护理' }

const SURNAMES = ['张','李','王','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗']
const NURSES = ['李晓芳 护士','王芳 护士长','张晓敏 护士','陈宇 护士','赵燕 护师','何丽 护士']
const DOCTORS = ['赵医生 (主治)', '钱主任 (副高)', '孙医生 (主治)', '李主任 (主任医师)']
const DISEASE_TAGS = ['高血压病', '冠心病', '糖尿病', '认知障碍', '脑卒中后', '慢阻肺']

// ---------- 告警文案（养老照护场景，规避 §7 合规红线用语，不写任何精确度数字）----------
const ALERT_TYPE_DEFS = {
  fall: {
    level: 1,
    title: '卫浴跌倒预警',
    details: [
      '毫米波雷达监测到卫浴间姿态突变，请护理人员立即到场查看',
      '走廊雷达监测到体态急速下坠信号，请就近护理员前往确认',
    ],
  },
  off_bed: {
    level: 2,
    title: '夜间离床预警',
    details: [
      '体征床垫监测到离床超过 15 分钟未归，请巡房确认',
      '夜间离床频次高于平时作息，建议到场陪护如厕',
    ],
  },
  hr: {
    level: 2,
    title: '心率波动提醒',
    details: [
      '夜间心率持续偏高，建议巡房关注并复测',
      '午休时段心率波动明显，请护理人员到场查看',
    ],
  },
  br: {
    level: 3,
    title: '呼吸频率提醒',
    details: [
      '睡眠时段呼吸频率较平日波动明显，建议关注',
      '呼吸节律出现短时异常波动，已记录待复核',
    ],
  },
  tp: {
    level: 3,
    title: '体温异常提醒',
    details: [
      '晨起体温偏高，建议复测并补水观察',
      '午后体温较平日偏高，请复测并记录',
    ],
  },
}

const HANDLE_NOTES = [
  '到场排查，体征平稳，已双人过床',
  '已巡房确认，长者已回床休息',
  '已复测体温，通知家属并持续观察',
  '已协助长者翻身，继续观察',
  '已到场陪护，情况平稳，已记录交班',
]

// ---------- 班次（夜班 22:00-06:00 / 早班 06:00-14:00 / 中班 14:00-22:00）----------
export function getShiftInfo(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d || !d.cfg.nurses) return null // 厂商租户无护理班次概念
  const now8 = nowIso8()
  const hour = Number(now8.slice(11, 13))
  const shift =
    hour >= 22 || hour < 6
      ? { shift_name: '夜班', shift_range: '22:00-06:00', startHour: 22 }
      : hour < 14
        ? { shift_name: '早班', shift_range: '06:00-14:00', startHour: 6 }
        : { shift_name: '中班', shift_range: '14:00-22:00', startHour: 14 }

  // 本班开始时刻（夜班在 0-6 点时，班起于前一晚 22:00）
  const today = now8.slice(0, 10)
  let shiftStartMs = Date.parse(`${today}T${String(shift.startHour).padStart(2, '0')}:00:00+08:00`)
  if (shift.startHour === 22 && hour < 6) shiftStartMs -= 24 * 3600 * 1000

  // 上一班遗留：本班开始前发生且至今未闭环的告警
  const carryOver = d.alerts.filter(
    (a) => (a.status === 'triggered' || a.status === 'handling') && Date.parse(a.occurred_at) < shiftStartMs,
  ).length

  return {
    shift_name: shift.shift_name,
    shift_range: shift.shift_range,
    nurses: d.cfg.nurses,
    carry_over_open: carryOver,
    generated_at: now8,
  }
}

// ---------- 租户数据生成 ----------
function floorOfBed(bedId) {
  return bedId.charAt(0) + 'F'
}

function buildPatients(cfg) {
  const wards = cfg.floorWards
  const cares = cfg.floorCare
  return cfg.occupiedBeds.map((bedId, i) => {
    const rnd = mulberry32(cfg.seed ^ (0x5f3a + i * 7919))
    const floor = floorOfBed(bedId)
    const abnormalPlan = cfg.abnormalPlan.find((p) => p.idx === i)
    const types = abnormalPlan ? [abnormalPlan.type] : null

    const vitals = {
      hr: abnormalPlan?.type === 'hr' ? 104 : 62 + Math.floor(rnd() * 33),
      br: 13 + Math.floor(rnd() * 8),
      tp: Math.round((36.2 + Math.floor(rnd() * 7) * 0.1) * 10) / 10,
      in_bed: abnormalPlan?.type === 'off_bed' ? false : rnd() < cfg.inBedRatio,
      body_movement: Math.floor(rnd() * 3),
      recorded_at: nowIso8(),
    }
    if (abnormalPlan?.type === 'tp') vitals.tp = 37.4
    if (abnormalPlan?.type === 'fall') vitals.in_bed = false

    return {
      patient_id: 'P' + String(i + 1).padStart(5, '0'),
      name: SURNAMES[Math.floor(rnd() * SURNAMES.length)] + '*',
      gender: rnd() < 0.47 ? 'male' : 'female',
      age: 68 + Math.floor(rnd() * 28),
      care_level: cares[floor],
      ward: wards[floor],
      bed_id: bedId,
      nurse: NURSES[Math.floor(rnd() * NURSES.length)],
      doctor: DOCTORS[Math.floor(rnd() * DOCTORS.length)],
      vitals,
      abnormal: types ? { fall: types[0] === 'fall', types } : null,
    }
  })
}

function seededShuffle(arr, rnd) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildAlerts(cfg) {
  const rnd = mulberry32(cfg.seed ^ 0xa1e7)
  const today = todayStr8()
  const types = seededShuffle(cfg.alertTypes, rnd)
  const statuses = seededShuffle(cfg.alertStatuses, rnd)
  const beds = seededShuffle(cfg.occupiedBeds, rnd)

  return types.map((type, i) => {
    const def = ALERT_TYPE_DEFS[type]
    const status = statuses[i]
    // 告警时刻均匀分布在今日 00:10 起，间隔约 24h/N
    const minuteOfDay = 10 + Math.floor((i + 0.5) * ((24 * 60 - 20) / types.length))
    const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0')
    const mm = String(minuteOfDay % 60).padStart(2, '0')
    const occurred_at = `${today}T${hh}:${mm}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}+08:00`
    const nurse = NURSES[Math.floor(rnd() * NURSES.length)]

    const alert = {
      alert_id: 'A' + String(cfg.alertIdBase + i),
      bed_id: beds[i % beds.length],
      patient_id: 'P' + String((i % cfg.patientTotal) + 1).padStart(5, '0'),
      type,
      level: def.level,
      status,
      title: def.title,
      detail: def.details[Math.floor(rnd() * def.details.length)],
      occurred_at,
      claimed_by: null,
      claimed_at: null,
      handled_by: null,
      handled_at: null,
      handle_note: null,
    }
    const atMinute = (m) =>
      `${today}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00+08:00`
    if (status === 'handled') {
      // 完整链路：发生 → 接单（1-3 分钟）→ 处置闭环（再 2-12 分钟）
      const claimMinute = minuteOfDay + 1 + Math.floor(rnd() * 3)
      const handledMinute = Math.min(claimMinute + 2 + Math.floor(rnd() * 10), 24 * 60 - 1)
      alert.claimed_by = nurse
      alert.claimed_at = atMinute(claimMinute)
      alert.handled_by = nurse
      alert.handled_at = atMinute(handledMinute)
      alert.handle_note = HANDLE_NOTES[Math.floor(rnd() * HANDLE_NOTES.length)]
    } else if (status === 'handling') {
      const claimMinute = Math.min(minuteOfDay + 1 + Math.floor(rnd() * 3), 24 * 60 - 1)
      alert.claimed_by = nurse
      alert.claimed_at = atMinute(claimMinute)
    }
    return alert
  })
}

// ---------- 厂商租户：中科安樵 · 自营设备运营 ----------
// 真实硬件清单：本公司自营 9 台 AI健康守护仪（全部部署苏州），与前端 src/assets/anqiaoDevices.ts 同源。
// 合规红线：严禁写入长者姓名/年龄/护理等级/家属电话/运维专员姓名，点位仅以 label + SN 标识。
const ANQIAO_CUSTOMER = '中科安樵自营'

// 城市聚合命名与前端 GEO_HIERARCHY / 地图组件保持一致（短名 '苏州'）
const ANQIAO_CITIES = [{ city: '苏州', lon: 120.5853, lat: 31.299 }]

// last_data_time 为 null 表示在线设备，构建时取当前时间；离线设备保留各自最近一次实际上报时刻
// label/address/lon/lat/type 与 src/assets/anqiaoDevices.ts（唯一权威数据源）逐字段一致
const ANQIAO_DEVICES = [
  { sn: "ASH01046", label: "ASH01046", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01038", label: "太湖科创中心·演示台", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "吴中区", community: "石湖金陵广场运维中枢", address: "苏州市吴中区藤器街太湖科创中心A座9层办公区 (运营演示台)", lon: 120.6004, lat: 31.1643, online: true, last_data_time: "2026-09-22T17:28:11+08:00" },
  { sn: "device_001", label: "device_001", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_002", label: "device_002", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_003", label: "device_003", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_004", label: "device_004", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_005", label: "device_005", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_006", label: "device_006", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_007", label: "device_007", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "device_008", label: "device_008", type: "AI健康守护仪 (测试终端)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01129", label: "ASH01129", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01153", label: "ASH01153", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "1C6920D123A0", label: "1C6920D123A0", type: "WiFi摔倒报警器(R1)", category: "fall_detector", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "862944067812863", label: "862944067812863", type: "4G摔倒报警器(R1)", category: "fall_detector", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "58757725", label: "58757725", type: "健康监测仪", category: "health_monitor", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "41981890", label: "41981890", type: "健康监测仪", category: "health_monitor", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01042", label: "ASH01042", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-07-26T01:56:29+08:00" },
  { sn: "ANCE00003", label: "园区康养·613", type: "AI健康守护仪 (ANCE-01)", category: "health_guardian", district: "苏州工业园区", community: "园区康养·613照护示范点", address: "苏州市苏州工业园区星湖街613号康养公寓6幢613室", lon: 120.7196, lat: 31.3085, online: false, last_data_time: "2026-05-22T23:24:41+08:00" },
  { sn: "ANCE00002", label: "石湖金陵广场·301", type: "AI健康守护仪 (ANCE-01)", category: "health_guardian", district: "吴中区", community: "石湖金陵广场运维中枢", address: "苏州市吴中区石湖西路188号石湖金陵广场B座301室 (运维中枢)", lon: 120.5856, lat: 31.2389, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01016", label: "独墅湖科创区·206", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "苏州工业园区", community: "独墅湖科教创新睡眠中心", address: "苏州市苏州工业园区仁爱路独墅湖科教创新区科研楼B栋206室", lon: 120.7315, lat: 31.2752, online: false, last_data_time: "2026-08-14T02:03:42+08:00" },
  { sn: "ASH01076", label: "园区康养·815", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "苏州工业园区", community: "园区康养·815照护示范点", address: "苏州市苏州工业园区星湖街815号康养公寓8幢815室", lon: 120.7208, lat: 31.3152, online: false, last_data_time: "2026-09-18T08:34:58+08:00" },
  { sn: "ASH01118", label: "石湖金陵广场·801", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "吴中区", community: "石湖金陵广场运维中枢", address: "苏州市吴中区石湖西路188号石湖金陵广场A座801室", lon: 120.5861, lat: 31.2394, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01146", label: "太湖科创中心·903", type: "AI健康守护仪 (ASH-01 旗舰机)", category: "health_guardian", district: "吴中区", community: "太湖科创中心·中科展厅", address: "苏州市吴中区藤器街太湖科创中心A座903室 (中科展厅总控)", lon: 120.5998, lat: 31.1638, online: true, last_data_time: null },
  { sn: "X2_S01B05N962", label: "太湖科创中心·901", type: "多模态AI守护仪样机 (X2_S01)", category: "health_guardian", district: "吴中区", community: "石湖金陵广场运维中枢", address: "苏州市吴中区藤器街太湖科创中心A座901室 (研发实验室)", lon: 120.5992, lat: 31.1633, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH010002", label: "ASH010002", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-09-22T23:56:05+08:00" },
  { sn: "ASH01100", label: "ASH01100", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-08-16T23:20:32+08:00" },
  { sn: "ASH01090", label: "ASH01090", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-09-04T04:11:37+08:00" },
  { sn: "ASH01025", label: "ASH01025", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-07-27T04:05:17+08:00" },
  { sn: "ASH01037", label: "ASH01037", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-07-29T20:46:32+08:00" },
  { sn: "ANCE00005", label: "ANCE00005", type: "AI健康守护仪 (ANCE-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01047", label: "ASH01047", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01036", label: "ASH01036", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01006", label: "ASH01006", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-09-22T23:56:07+08:00" },
  { sn: "ASH01023", label: "ASH01023", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-07-31T22:11:05+08:00" },
  { sn: "ASH01028", label: "ASH01028", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-09-13T21:15:33+08:00" },
  { sn: "ASH01059", label: "ASH01059", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01039", label: "ASH01039", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-09-06T08:34:58+08:00" },
  { sn: "ASH01030", label: "ASH01030", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-08-18T23:06:28+08:00" },
  { sn: "ASH01086", label: "ASH01086", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: null },
  { sn: "ASH01078", label: "ASH01078", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: null },
  { sn: "ASH01092", label: "ASH01092", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: null },
  { sn: "ASH01033", label: "ASH01033", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-08-09T20:01:07+08:00" },
  { sn: "ASH01166", label: "ASH01166", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01044", label: "ASH01044", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-08-22T08:34:56+08:00" },
  { sn: "ASH01029", label: "ASH01029", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: '2026-09-20T10:00:00+08:00' },
  { sn: "ASH01156", label: "ASH01156", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "待确认", community: "待确认片区", address: "地址待确认", lon: null, lat: null, online: false, last_data_time: "2026-09-22T17:31:27+08:00" },
  { sn: "ASH01021", label: "太湖科创中心·库房B", type: "AI健康守护仪 (ASH-01)", category: "health_guardian", district: "吴中区", community: "石湖金陵广场运维中枢", address: "苏州市吴中区藤器街太湖科创中心A座9层设备库房B区 (2026-09-22 新装待部署)", lon: 120.601, lat: 31.1648, online: true, last_data_time: '2026-09-20T10:00:00+08:00' },
]

// 设备档案用全称 '苏州市'，城市聚合/前端层级用短名 '苏州'，匹配时视为同一城市
function sameCity(a, b) {
  return a === b || String(a).replace(/市$/, '') === String(b).replace(/市$/, '')
}

function buildVendorDevices() {
  return ANQIAO_DEVICES.map((d) => ({
    device_id: d.sn,
    sn: d.sn,
    label: d.label,
    type: d.type,
    category: d.category,
    customer: ANQIAO_CUSTOMER,
    city: '苏州市',
    district: d.district,
    community: d.community,
    address: d.address,
    lon: d.lon,
    lat: d.lat,
    online: d.online,
    alerting: false,
    last_data_time: d.last_data_time ?? nowIso8(),
  }))
}

// 设备维度告警文案（运维事件，非照护场景），绑定真实 SN
const VENDOR_ALERT_DEFS = {
  device_offline: {
    level: 2,
    title: '设备离线超时',
    details: [
      '终端超过 24 小时未上报数据，请核查设备供电与网络链路',
      '终端心跳信号丢失，请远程排查设备在线状态',
    ],
  },
  device_data: {
    level: 3,
    title: '数据采集中断',
    details: [
      '终端数据采集中断，请检查传感器与固件状态',
      '上报数据流出现异常间隙，建议远程复核采集链路',
    ],
  },
}

// 少量设备维度告警；处置主体统一为「运营中心」，严禁引用护理院护士池（NURSES）
function buildVendorAlerts(cfg) {
  const today = todayStr8()
  const at = (hm) => `${today}T${hm}:00+08:00`
  const mk = (i, sn, type, status, occurred, extra = {}) => ({
    alert_id: 'A' + String(cfg.alertIdBase + i),
    bed_id: sn,
    patient_id: '',
    type,
    level: VENDOR_ALERT_DEFS[type].level,
    status,
    title: VENDOR_ALERT_DEFS[type].title,
    detail: VENDOR_ALERT_DEFS[type].details[0],
    occurred_at: at(occurred),
    claimed_by: null,
    claimed_at: null,
    handled_by: null,
    handled_at: null,
    handle_note: null,
    city: '苏州市',
    customer: ANQIAO_CUSTOMER,
    ...extra,
  })
  return [
    mk(0, 'ASH01076', 'device_offline', 'triggered', '07:42'),
    mk(1, 'X2_S01B05N962', 'device_data', 'handling', '09:15', {
      claimed_by: '运营中心',
      claimed_at: at('09:18'),
    }),
    mk(2, 'ANCE00002', 'device_data', 'handled', '06:28', {
      title: '数据采集中断恢复',
      claimed_by: '运营中心',
      claimed_at: at('06:31'),
      handled_by: '运营中心',
      handled_at: at('06:53'),
      handle_note: '远程重启采集服务后恢复上报，持续观察中',
    }),
    mk(3, 'ASH01118', 'device_offline', 'handled', '10:05', {
      claimed_by: '运营中心',
      claimed_at: at('10:09'),
      handled_by: '运营中心',
      handled_at: at('11:26'),
      handle_note: '现场恢复供电，设备已重新上线',
    }),
  ]
}

function buildTenant(cfg) {
  if (cfg.kind === 'vendor') {
    return { cfg, patients: [], devices: buildVendorDevices(), alerts: buildVendorAlerts(cfg), liveAlertSeq: 0 }
  }
  const patients = buildPatients(cfg)
  const alerts = buildAlerts(cfg)
  return { cfg, patients, alerts, liveAlertSeq: 0 }
}

const TENANT_CONFIGS = {
  kaijian: {
    name: '凯健护理院',
    kind: 'nursing_home',
    seed: 20260914,
    patientTotal: 87,
    bedTotal: 96,
    deviceTotal: 248,
    deviceOnline: 247,
    inBedRatio: 0.52,
    occupiedBeds: KAIJIAN_OCCUPIED_BEDS,
    vacantBeds: KAIJIAN_VACANT_BEDS,
    floorWards: KAIJIAN_FLOOR_WARDS,
    floorCare: KAIJIAN_FLOOR_CARE,
    alertIdBase: 10231,
    alertTypes: ['fall','fall','fall','off_bed','off_bed','off_bed','off_bed','off_bed','hr','hr','hr','hr','br','br','br','tp','tp'],
    alertStatuses: ['triggered','triggered','triggered','triggered','handling','handling','handling','handled','handled','handled','handled','handled','handled','handled','handled','missed','missed'],
    abnormalPlan: [
      { idx: 5, type: 'fall' },
      { idx: 11, type: 'off_bed' },
      { idx: 17, type: 'hr' },
      { idx: 23, type: 'tp' },
      { idx: 31, type: 'br' },
    ],
    // 当值护理组（按楼层分组，班次卡展示用）
    nurses: [
      { name: '李晓芳 护士', floor: '4F' },
      { name: '王芳 护士长', floor: '4F' },
      { name: '张晓敏 护士', floor: '3F' },
      { name: '陈宇 护士', floor: '3F' },
      { name: '赵燕 护师', floor: '2F' },
      { name: '何丽 护士', floor: '1F' },
    ],
  },
  anqiao: {
    name: '中科安樵 · 自营运营中心',
    kind: 'vendor',
    seed: 20260920,
    alertIdBase: 80001,
  },
}

// 租户数据为可变内存态（处置写操作、WS 新告警会直接改 alerts 数组），生产换 DB。
const TENANT_DATA = {
  kaijian: buildTenant(TENANT_CONFIGS.kaijian),
  anqiao: buildTenant(TENANT_CONFIGS.anqiao),
}


export const TENANT_IDS = Object.keys(TENANT_DATA)

export function getTenantData(tenantId) {
  return TENANT_DATA[tenantId] ?? null
}

export function getTenantName(tenantId) {
  return TENANT_CONFIGS[tenantId]?.name ?? tenantId
}

export function getTenantKind(tenantId) {
  return TENANT_CONFIGS[tenantId]?.kind ?? 'nursing_home'
}

// ---------- Overview 实时计算（含处置/新告警后的指标变化），不硬编码 ----------
export function computeOverview(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  const { cfg, patients, alerts } = d
  const closed = alerts.filter((a) => a.status === 'handled' || a.status === 'missed').length

  // 厂商租户：自营设备聚合 + 覆盖城市数（按设备档案实际去重统计）
  if (cfg.kind === 'vendor') {
    const devices = d.devices
    const online = devices.filter((x) => x.online).length
    return {
      device_total: devices.length,
      device_online: online,
      device_online_rate: Math.round((online / devices.length) * 1000) / 10,
      patient_total: 0,
      patient_male: 0,
      patient_female: 0,
      bed_occupied: 0,
      bed_total: 0,
      alerts_today: alerts.length,
      alerts_closed_today: closed,
      in_bed_count: 0,
      in_bed_rate: 0,
      city_count: new Set(devices.map((x) => x.city)).size,
      generated_at: nowIso8(),
    }
  }

  const male = patients.filter((p) => p.gender === 'male').length
  const inBed = patients.filter((p) => p.vitals.in_bed).length
  return {
    device_total: cfg.deviceTotal,
    device_online: cfg.deviceOnline,
    device_online_rate: Math.round((cfg.deviceOnline / cfg.deviceTotal) * 1000) / 10,
    patient_total: patients.length,
    patient_male: male,
    patient_female: patients.length - male,
    bed_occupied: cfg.occupiedBeds.length,
    bed_total: cfg.bedTotal,
    alerts_today: alerts.length,
    alerts_closed_today: closed,
    in_bed_count: inBed,
    in_bed_rate: Math.round((inBed / patients.length) * 1000) / 10,
    city_count: 1,
    generated_at: nowIso8(),
  }
}

// ---------- 厂商 geo 聚合 ----------
export function getGeoCities(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d || d.cfg.kind !== 'vendor') return null
  return ANQIAO_CITIES.map((c) => {
    const devices = d.devices.filter((x) => sameCity(x.city, c.city))
    return {
      city: c.city,
      lon: c.lon,
      lat: c.lat,
      device_total: devices.length,
      device_online: devices.filter((x) => x.online).length,
      alerts_today: d.alerts.filter((a) => a.city && sameCity(a.city, c.city)).length,
      customers: [ANQIAO_CUSTOMER],
    }
  })
}

export function getGeoDevices(tenantId, city) {
  const d = TENANT_DATA[tenantId]
  if (!d || d.cfg.kind !== 'vendor') return null
  return city ? d.devices.filter((x) => sameCity(x.city, city)) : d.devices
}

// ---------- 长者画像详情扩展：24h 曲线 / 睡眠 / 慢病 / 7 天告警历史 ----------
// 曲线/睡眠/慢病由 patient_id 确定性派生（不存储），告警历史合并当日实时告警。
function buildCurves(patient, idx) {
  const rnd = mulberry32(0xc1ae ^ (idx * 2654435761))
  let hr = patient.vitals.hr
  let br = patient.vitals.br
  let tp = patient.vitals.tp
  const points = 96 // 24h，15 分钟一个点
  const hrS = [], brS = [], tpS = []
  const startMs = Date.now() - 24 * 3600 * 1000
  for (let i = 0; i < points; i++) {
    hr = Math.min(120, Math.max(50, hr + Math.round((rnd() - 0.5) * 4)))
    br = Math.min(28, Math.max(10, br + Math.round((rnd() - 0.5) * 2)))
    tp = Math.min(38, Math.max(35.8, Math.round((tp + (rnd() - 0.5) * 0.2) * 10) / 10))
    const t = toIso8(new Date(startMs + i * 15 * 60 * 1000))
    hrS.push({ t, v: hr })
    brS.push({ t, v: br })
    tpS.push({ t, v: tp })
  }
  return { hr: hrS, br: brS, tp: tpS }
}

function buildSleep(patient, idx) {
  const rnd = mulberry32(0x51eef ^ (idx * 97))
  const score = patient.abnormal ? 72 + Math.floor(rnd() * 6) : 80 + Math.floor(rnd() * 16)
  const totalMin = 420 + Math.floor(rnd() * 70)
  const deepMin = Math.round(totalMin * (0.14 + rnd() * 0.1))
  const awakeMin = 25 + Math.floor(rnd() * 20)
  const remMin = Math.round(totalMin * 0.17)
  const lightMin = totalMin - deepMin - awakeMin - remMin
  const p2 = (n) => String(n).padStart(2, '0')
  const leaveCount = patient.abnormal?.types.includes('off_bed') ? 2 : Math.floor(rnd() * 3)
  return {
    score,
    grade: score >= 88 ? '深度恢复良好' : score >= 78 ? '睡眠质量适中' : '片段化需关注',
    totalMin,
    totalHours: `${Math.floor(totalMin / 60)}h ${p2(totalMin % 60)}m`,
    bedTime: '21:' + p2(20 + Math.floor(rnd() * 30)),
    leaveTime: '06:' + p2(10 + Math.floor(rnd() * 25)),
    leaveCount,
    movement: 10 + Math.floor(rnd() * 16),
    deepPct: ((deepMin / totalMin) * 100).toFixed(1) + '%',
    stages: { deep: deepMin, light: lightMin, rem: remMin, awake: awakeMin },
  }
}

function buildDiseases(idx) {
  const rnd = mulberry32(0xd15ea5e ^ (idx * 31))
  const n = Math.floor(rnd() * 4) // 0-3 个标签
  const tags = seededShuffle(DISEASE_TAGS, rnd)
  return tags.slice(0, n)
}

function buildAlertHistory(tenantId, patient, idx) {
  const rnd = mulberry32(0xa711570 ^ (idx * 13))
  const types = Object.keys(ALERT_TYPE_DEFS)
  const history = []
  const count = 2 + (idx % 4)
  for (let k = 0; k < count; k++) {
    const type = types[Math.floor(rnd() * types.length)]
    const def = ALERT_TYPE_DEFS[type]
    const daysAgo = 1 + Math.floor(rnd() * 6)
    const date = new Date(Date.now() - daysAgo * 24 * 3600 * 1000)
    const occurred_at = toIso8(date).slice(0, 11) + `${String(1 + Math.floor(rnd() * 22)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00+08:00`
    const missed = rnd() < 0.2
    history.push({
      alert_id: 'H' + String(70000 + idx * 10 + k),
      bed_id: patient.bed_id,
      patient_id: patient.patient_id,
      type,
      level: def.level,
      status: missed ? 'missed' : 'handled',
      title: def.title,
      detail: def.details[0],
      occurred_at,
      claimed_by: missed ? null : NURSES[Math.floor(rnd() * NURSES.length)],
      claimed_at: missed ? null : occurred_at,
      handled_by: missed ? null : NURSES[Math.floor(rnd() * NURSES.length)],
      handled_at: missed ? null : occurred_at,
      handle_note: missed ? null : HANDLE_NOTES[Math.floor(rnd() * HANDLE_NOTES.length)],
    })
  }
  return history
}

export function getPatientDetail(tenantId, patientId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  const idx = d.patients.findIndex((p) => p.patient_id === patientId)
  if (idx < 0) return null
  const patient = d.patients[idx]
  // 当日实时告警 + 近 7 天历史，按发生时间倒序
  const live = d.alerts.filter((a) => a.patient_id === patientId)
  const history = [...live, ...buildAlertHistory(tenantId, patient, idx)]
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
  return {
    ...patient,
    curves: buildCurves(patient, idx),
    sleep: buildSleep(patient, idx),
    diseases: buildDiseases(idx),
    alert_history: history,
  }
}

// ---------- WS 实时数据源 ----------
// 体征随机游走：在前值附近小幅波动，返回变更payload（契约 §4 vitals 事件形状）
export function walkVitals(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d || d.patients.length === 0) return []
  const rnd = Math.random
  const picks = 1 + Math.floor(rnd() * 3)
  const updates = []
  for (let k = 0; k < picks; k++) {
    const p = d.patients[Math.floor(rnd() * d.patients.length)]
    p.vitals.hr = Math.min(120, Math.max(50, p.vitals.hr + Math.round((rnd() - 0.5) * 4)))
    p.vitals.br = Math.min(28, Math.max(10, p.vitals.br + Math.round((rnd() - 0.5) * 2)))
    p.vitals.tp = Math.min(38, Math.max(35.8, Math.round((p.vitals.tp + (rnd() - 0.5) * 0.2) * 10) / 10))
    p.vitals.body_movement = Math.floor(rnd() * 3)
    p.vitals.recorded_at = nowIso8()
    updates.push({ bed_id: p.bed_id, ...p.vitals })
  }
  return updates
}

// 生成一条新告警并真正插入租户告警数据（REST /v1/alerts 可查），返回该告警
export function generateLiveAlert(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  const rnd = Math.random
  const types = ['fall', 'off_bed', 'off_bed', 'hr', 'hr', 'br', 'tp']
  const type = types[Math.floor(rnd() * types.length)]
  const def = ALERT_TYPE_DEFS[type]

  // 厂商租户：设备维度告警（离线/数据中断），挂在真实在册 SN 上
  if (d.cfg.kind === 'vendor') {
    const dev = d.devices[Math.floor(rnd() * d.devices.length)]
    // 在线设备不产生离线类告警，降级为数据中断/抖动类事件，保持与在线状态自洽
    const vTypes = Object.keys(VENDOR_ALERT_DEFS)
    let vType = vTypes[Math.floor(rnd() * vTypes.length)]
    if (dev.online && vType === 'device_offline') vType = 'device_data'
    const vDef = VENDOR_ALERT_DEFS[vType]
    const alert = {
      alert_id: 'A' + String(d.cfg.alertIdBase + 1000 + d.liveAlertSeq++),
      bed_id: dev.device_id,
      patient_id: '',
      type: vType,
      level: vDef.level,
      status: 'triggered',
      title: vDef.title,
      detail: vDef.details[Math.floor(rnd() * vDef.details.length)],
      occurred_at: nowIso8(),
      claimed_by: null,
      claimed_at: null,
      handled_by: null,
      handled_at: null,
      handle_note: null,
      city: dev.city,
      customer: dev.customer,
    }
    d.alerts.push(alert)
    return alert
  }

  const p = d.patients[Math.floor(rnd() * d.patients.length)]
  const alert = {
    alert_id: 'A' + String(d.cfg.alertIdBase + 1000 + d.liveAlertSeq++),
    bed_id: p.bed_id,
    patient_id: p.patient_id,
    type,
    level: def.level,
    status: 'triggered',
    title: def.title,
    detail: def.details[Math.floor(rnd() * def.details.length)],
    occurred_at: nowIso8(),
    claimed_by: null,
    claimed_at: null,
    handled_by: null,
    handled_at: null,
    handle_note: null,
  }
  d.alerts.push(alert)
  return alert
}
export { SURNAMES, NURSES }
