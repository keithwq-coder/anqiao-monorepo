// 本文件为演示·康宁护理院（模拟机构）（kaijian）演示口径 mock，与 anqiao 真实设备数据严格分离
import {
  GEO_HIERARCHY,
  type CityHierarchy,
  type DistrictDetail,
  type CommunityDetail,
  type UnitDevice,
} from '../assets/geoHierarchy'
import type {
  Alert,
  AlertsParams,
  Bed,
  BedsParams,
  CityStat,
  Demographics,
  DeviceDistribution,
  DeviceInfo,
  DevicePoint,
  FacilityStats,
  FloorInfo,
  Gender,
  Overview,
  Paged,
  Patient,
  PatientDetail,
  PatientProfile,
  PatientsParams,
  Rankings,
  ShiftInfo,
  Vitals,
  WardInfo,
} from './types'


function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SURNAMES = ['张','李','王','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段']
const ELDER_MALE_NAMES = [
  '张卫国', '李德海', '赵德全', '郭振华', '周秉坤', '杨保国', '胡广德', '钱福祥',
  '徐建业', '林宝山', '罗长青', '梁桂生', '宋明远', '郑树清', '韩世忠', '唐学文',
  '冯守信', '于广厚', '董成志', '萧汉生', '程大伟', '曹定国', '袁有福', '邓建勋',
  '许文山', '傅立人', '沈家栋', '曾庆发', '彭绍华', '苏德良', '卢伯成', '蒋天锡',
  '蔡宏达', '贾耀东', '魏长春', '薛国安', '阎希明', '余保平', '潘文正', '杜绍基',
  '戴有德', '夏敬仁', '钟自强', '汪树荣', '田德全', '任文炳', '范承先', '方海清',
  '石广生', '姚继宗', '谭永昌', '廖德昌', '熊天祥', '金富贵', '陆正安', '郝长治',
]
const ELDER_FEMALE_NAMES = [
  '孙秀珍', '王素芬', '刘桂英', '陈金秀', '马玉兰', '黄淑琴', '高素云', '吴秀荣',
  '朱凤英', '何爱华', '梁桂珍', '唐秀英', '冯佩华', '于桂芬', '董海兰', '萧月娥',
  '程淑贤', '曹秀敏', '袁秀琴', '邓玉兰', '许秋霞', '沈荣华', '曾文英', '彭慧敏',
  '苏春霞', '卢德芳', '蒋佩兰', '贾金凤', '魏宝琴', '薛秀芹', '余秀华', '杜桂兰',
  '戴美华', '夏淑贞', '田玉珍', '任秀娥', '范秀云', '方宝珍', '石素英', '姚秀清',
  '谭玉芬', '廖桂芳', '熊秀荣', '陆淑英', '郝玉兰', '崔秀英', '江秀珍', '顾玉霞',
]
const NURSES = ['李晓芳 护工','王芳 护工主管','张晓敏 护工','陈宇 护工','赵燕 护工组长','何丽 护工']
const DOCTORS = ['赵医生 (主治)', '钱主任 (副高)', '孙医生 (主治)', '李主任 (主任医师)']

const FACILITY_OCCUPIED_BEDS = [
  '401-A','401-B','402-A','402-B','403-A','403-B','404-A','404-B','405-A','405-B','406-A','406-B',
  '407-A','407-B','408-A','408-B','409-A','409-B','410-A','410-B','411-A','411-B',
  '301-A','301-B','302-A','302-B','303-A','303-B','304-A','304-B','305-A','305-B','306-A','306-B',
  '307-A','307-B','308-A','308-B','309-A','309-B','310-A','310-B','311-A',
  '201-A','201-B','202-A','202-B','203-A','203-B','204-A','204-B','205-A','205-B','206-A','206-B',
  '207-A','207-B','208-A','208-B','209-A','209-B','210-A','210-B','211-A','211-B',
  '101-A','101-B','102-A','102-B','103-A','103-B','104-A','104-B','105-A','105-B','106-A','106-B',
  '107-A','107-B','108-A','108-B','109-A','109-B','110-A','110-B','111-A','111-B',
]

const FACILITY_VACANT_BEDS = [
  '412-A','412-B','311-B','312-A','312-B','212-A','212-B','112-A','112-B',
]

const FLOOR_WARDS: Record<string, string> = {
  '4F': '完全失能专区',
  '3F': '认知障碍专区',
  '2F': '术后康复专区',
  '1F': '慢病颐养专区',
}

const FLOOR_CARE_LEVEL: Record<string, Patient['care_level']> = {
  '4F': '特级护理',
  '3F': '一级护理',
  '2F': '二级护理',
  '1F': '二级护理',
}

function floorOfBed(bedId: string): string {
  return bedId.charAt(0) + 'F'
}

function nowIso(): string {
  return new Date().toISOString()
}

interface MockRecord {
  patient: Patient
  bed: Bed
  normalNightTrips: number
  rehabScheduled: boolean
  profile: PatientProfile
}

function buildMockData(): MockRecord[] {
  const records: MockRecord[] = FACILITY_OCCUPIED_BEDS.map((bedId, i) => {
    const floor = floorOfBed(bedId)
    const ward = FLOOR_WARDS[floor]
    const rnd = mulberry32(0x9e37 + i * 7919)

    const isFall = bedId === '404-A'
    const isWander = bedId === '302-B'
    const isTachy = bedId === '203-B'
    const isFever = bedId === '305-B'

    const gender: Gender = i % 3 === 0 || i % 5 === 0 ? 'male' : 'female'
    const age = isFall ? 84 : 68 + (i % 28)

    let hr = 62 + Math.floor(rnd() * 33)
    let br = 13 + Math.floor(rnd() * 8)
    let tp = Math.round((36.2 + Math.floor(rnd() * 7) * 0.1) * 10) / 10
    let abnormal: Patient['abnormal'] = null
    let inBed = true

    if (isFall) {
      hr = 94; br = 22; tp = 36.9
      inBed = false
      abnormal = { fall: true, types: ['fall'] }
    } else if (isTachy) {
      hr = 104
      abnormal = { fall: false, types: ['hr'] }
    } else if (isFever) {
      hr = 92; tp = 37.4
      abnormal = { fall: false, types: ['tp'] }
    } else if (isWander) {
      inBed = false
      abnormal = { fall: false, types: ['off_bed'] }
    } else if (floor === '1F' && i % 8 === 0) {
      inBed = false
    }

    const vitals: Vitals = {
      hr,
      br,
      tp,
      in_bed: inBed,
      body_movement: Math.floor(rnd() * 3),
      recorded_at: nowIso(),
    }

    const isMale = gender === 'male'
    const elderName = isMale
      ? ELDER_MALE_NAMES[(i * 7 + 3) % ELDER_MALE_NAMES.length]
      : ELDER_FEMALE_NAMES[(i * 11 + 5) % ELDER_FEMALE_NAMES.length]

    const patient: Patient = {
      patient_id: 'P' + String(i + 1).padStart(5, '0'),
      name: elderName,
      gender,
      age,
      care_level: FLOOR_CARE_LEVEL[floor],
      ward,
      bed_id: bedId,
      nurse: NURSES[i % NURSES.length],
      doctor: DOCTORS[i % DOCTORS.length],
      vitals,
      abnormal,
    }

    const device: DeviceInfo = {
      device_id: 'HG2024' + String(10000 + i),
      type: 'health_guardian',
      online: true,
      last_data_time: nowIso(),
    }

    const bed: Bed = {
      bed_id: bedId,
      floor,
      ward,
      status: 'occupied',
      patient_id: patient.patient_id,
      device,
    }

    const normalNightTrips = floor === '4F' ? 0 : floor === '3F' ? (isWander ? 2 : i % 3 === 0 ? 1 : 0) : floor === '2F' ? (i % 4 === 0 ? 1 : 0) : i % 3 === 0 ? 2 : i % 5 === 0 ? 3 : 1
    const rehabScheduled = floor === '2F' && i % 2 === 0

    const score = isFall ? 74 : isTachy ? 74 : isFever ? 76 : 80 + (i % 16)
    const totalMin = isFall ? 450 : 420 + (i % 70)
    const deepMin = Math.round(totalMin * (isFall ? 0.14 : 0.18 + (i % 8) * 0.01))
    const awakeMin = isFall ? 35 : 25 + (i % 20)
    const remMin = Math.round(totalMin * 0.17)
    const lightMin = totalMin - deepMin - awakeMin - remMin
    const pad2 = (n: number) => String(n).padStart(2, '0')

    const location: PatientProfile['location'] = isFall
      ? 'bathroom'
      : !inBed
        ? isWander ? 'corridor' : floor === '2F' ? 'rehab_room' : floor === '1F' ? (i % 2 === 0 ? 'dining_room' : 'activity_room') : 'corridor'
        : 'bed'

    const profile: PatientProfile = {
      patient_id: patient.patient_id,
      sleep: {
        score,
        grade: score >= 88 ? '深度恢复良好' : score >= 78 ? '睡眠质量适中' : '片段化需关注',
        totalMin,
        totalHours: `${Math.floor(totalMin / 60)}h ${pad2(totalMin % 60)}m`,
        bedTime: '21:' + pad2(20 + (i % 30)),
        leaveTime: '06:' + pad2(10 + (i % 25)),
        leaveCount: normalNightTrips,
        movement: isFall ? 14 : 10 + (i % 16),
        deepPct: ((deepMin / totalMin) * 100).toFixed(1) + '%',
        stages: { deep: deepMin, light: lightMin, rem: remMin, awake: awakeMin },
      },
      fall_risk: isFall ? 98 : isWander ? 76 : isTachy ? 72 : isFever ? 68 : 40 + ((i * 7) % 20),
      location,
      trip_tolerance: floor === '4F' ? 3 : floor === '3F' ? 10 : floor === '2F' ? 15 : 20,
    }

    return { patient, bed, normalNightTrips, rehabScheduled, profile }
  })
  return records
}

const RECORDS: MockRecord[] = buildMockData()
const PATIENTS: Patient[] = RECORDS.map(r => r.patient)
const BEDS: Bed[] = [
  ...RECORDS.map(r => r.bed),
  ...FACILITY_VACANT_BEDS.map(bedId => {
    const floor = floorOfBed(bedId)
    return {
      bed_id: bedId,
      floor,
      ward: FLOOR_WARDS[floor],
      status: 'vacant' as const,
      patient_id: null,
      device: null,
    }
  }),
]

const ALERTS: Alert[] = PATIENTS.filter(p => p.abnormal).map((p, i) => {
  const type = p.abnormal!.types[0]
  return {
    alert_id: 'A' + String(10231 + i),
    bed_id: p.bed_id,
    patient_id: p.patient_id,
    type,
    level: (type === 'fall' ? 1 : 2) as 1 | 2,
    status: (type === 'fall' ? 'handling' : 'handled') as Alert['status'],
    title: type === 'fall' ? '卫浴跌倒预警' : type === 'off_bed' ? '夜间离床预警' : type === 'hr' ? '心率异常告警' : '体温异常告警',
    detail: '毫米波雷达与体征床垫联合监测触发',
    occurred_at: nowIso(),
    claimed_by: type === 'fall' ? p.nurse : null,
    claimed_at: type === 'fall' ? nowIso() : null,
    handled_by: type === 'fall' ? p.nurse : null,
    handled_at: type === 'fall' ? null : nowIso(),
    handle_note: type === 'fall' ? null : '到场排查，体征平稳',
  }
})

console.log(`[MOCK] 生成 ${PATIENTS.length} 位长者 / ${BEDS.length} 张床位 / ${ALERTS.length} 条当前告警（确定性伪随机数据）`)

export function getPatients(params: PatientsParams = {}): Promise<Paged<Patient>> {
  let list = [...PATIENTS]
  if (params.floor) list = list.filter(p => p.bed_id.startsWith(params.floor!.replace('F', '')))
  if (params.ward) list = list.filter(p => p.ward === params.ward)
  if (params.status === 'in_bed') list = list.filter(p => p.vitals.in_bed)
  else if (params.status === 'off_bed') list = list.filter(p => !p.vitals.in_bed)
  else if (params.status === 'abnormal') list = list.filter(p => p.abnormal !== null)
  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.bed_id.toLowerCase().includes(q) ||
      p.nurse.toLowerCase().includes(q),
    )
  }
  return Promise.resolve(pageList(list, params.page, params.page_size))
}

export function getPatient(patientId: string, _date?: string): Promise<Patient> {
  const p = PATIENTS.find(x => x.patient_id === patientId)
  if (!p) return Promise.reject(new Error('patient not found: ' + patientId))
  return Promise.resolve(p)
}

export function getBeds(params: BedsParams = {}): Promise<Bed[]> {
  let list = [...BEDS]
  if (params.floor) list = list.filter(b => b.floor === params.floor)
  if (params.ward) list = list.filter(b => b.ward === params.ward)
  return Promise.resolve(list)
}

export function getFloors(): Promise<FloorInfo[]> {
  const floors = ['4F', '3F', '2F', '1F']
  return Promise.resolve(floors.map(f => {
    const beds = BEDS.filter(b => b.floor === f)
    return {
      floor: f,
      ward_count: 1,
      bed_total: beds.length,
      bed_occupied: beds.filter(b => b.status === 'occupied').length,
    }
  }))
}

const WARD_NURSE_CONFIG: Record<string, { count: number; ratio: string }> = {
  '4F': { count: 6, ratio: '1:2.5 (特级专班)' },
  '3F': { count: 5, ratio: '1:3.0 (失智专护)' },
  '2F': { count: 4, ratio: '1:4.0 (康复介护)' },
  '1F': { count: 3, ratio: '1:5.5 (活力自理)' },
}

export function getWards(floor?: string): Promise<WardInfo[]> {
  const wards = Object.entries(FLOOR_WARDS).map(([f, ward]) => {
    const ps = PATIENTS.filter(p => p.ward === ward)
    return {
      floor: f,
      ward,
      nurse_count: WARD_NURSE_CONFIG[f].count,
      nurse_ratio: WARD_NURSE_CONFIG[f].ratio,
      patient_count: ps.length,
      in_bed_count: ps.filter(p => p.vitals.in_bed).length,
    }
  })
  return Promise.resolve(floor ? wards.filter(w => w.floor === floor) : wards)
}

export function getOverview(): Promise<Overview> {
  const male = PATIENTS.filter(p => p.gender === 'male').length
  const inBed = PATIENTS.filter(p => p.vitals.in_bed).length
  const deviceTotal = 139 // 守护仪 87 + 跌倒报警器 52（演示·康宁口径）
  const deviceOnline = 136 // 在线 136 / 离线 3 → 97.8%
  return Promise.resolve({
    device_total: deviceTotal,
    device_online: deviceOnline,
    device_online_rate: Math.round((deviceOnline / deviceTotal) * 1000) / 10,
    patient_total: PATIENTS.length,
    patient_male: male,
    patient_female: PATIENTS.length - male,
    bed_occupied: PATIENTS.length,
    bed_total: BEDS.length,
    alerts_today: 17,
    alerts_closed_today: 17,
    in_bed_count: inBed,
    in_bed_rate: Math.round((inBed / PATIENTS.length) * 1000) / 10,
    generated_at: nowIso(),
  })
}

export function getAlerts(params: AlertsParams = {}): Promise<Paged<Alert>> {
  let list = [...ALERTS]
  if (params.status) list = list.filter(a => a.status === params.status)
  if (params.level) list = list.filter(a => a.level === params.level)
  return Promise.resolve(pageList(list, params.page, params.page_size))
}

export function handleAlert(alertId: string, note: string): Promise<Alert> {
  const a = ALERTS.find(x => x.alert_id === alertId)
  if (!a) return Promise.reject(new Error('alert not found: ' + alertId))
  a.status = 'handled'
  a.claimed_by = a.claimed_by ?? NURSES[0]
  a.claimed_at = a.claimed_at ?? nowIso()
  a.handled_by = a.handled_by ?? NURSES[0]
  a.handled_at = nowIso()
  a.handle_note = note
  return Promise.resolve(a)
}

export function getDemographics(): Promise<Demographics> {
  const male = PATIENTS.filter(p => p.gender === 'male').length
  const ages = PATIENTS.map(p => p.age)
  const byLevel = (['特级护理', '一级护理', '二级护理'] as const).map(level => ({
    care_level: level,
    count: PATIENTS.filter(p => p.care_level === level).length,
  }))
  return Promise.resolve({
    male,
    female: PATIENTS.length - male,
    avg_age: Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10,
    max_age: Math.max(...ages),
    by_care_level: byLevel,
    by_age_range: [
      { range: '60-69岁', count: ages.filter(a => a < 70).length },
      { range: '70-79岁', count: ages.filter(a => a >= 70 && a < 80).length },
      { range: '80-89岁', count: ages.filter(a => a >= 80 && a < 90).length },
      { range: '90岁以上', count: ages.filter(a => a >= 90).length },
    ],
    diseases: [
      { name: '高血压病', count: 64 },
      { name: '冠心病', count: 42 },
      { name: '认知障碍', count: 29 },
      { name: '脑卒中后', count: 18 },
    ],
  })
}

export function getDevices(): Promise<DeviceDistribution> {
  const types = [
    { name: 'AI健康守护仪', count: 86, color: '#00f0ff', online_rate: 100 },
    { name: '跌倒雷达监测仪', count: 52, color: '#00ff88', online_rate: 100 },
    { name: '多维体征采集终端', count: 45, color: '#ffb703', online_rate: 100 },
    { name: '生命体征监护仪', count: 38, color: '#c77dff', online_rate: 100 },
    { name: '人体轨迹寻踪仪', count: 27, color: '#ff0055', online_rate: 96.3 },
  ]
  return Promise.resolve({
    total: types.reduce((s, t) => s + t.count, 0),
    online: 247,
    offline: 1,
    online_rate: 99.6,
    running_days: 412,
    types,
  })
}

export function getFacilityStats(): Promise<FacilityStats> {
  return Promise.resolve({
    running_days: 412,
    avg_response_seconds: 19,
    routine_baseline_score: 99.2,
  })
}

export function getPatientProfile(patientId: string): Promise<PatientProfile> {
  const r = RECORDS.find(x => x.patient.patient_id === patientId)
  if (!r) return Promise.reject(new Error('patient not found: ' + patientId))
  return Promise.resolve(r.profile)
}

export function getRankings(): Promise<Rankings> {
  const base = (p: Patient) => ({
    patient_id: p.patient_id,
    name: p.name,
    bed_id: p.bed_id,
  })
  const withDelta = (value: number, seed: number) => ({ value, delta: (seed % 3) - 1 })

  const sleep = [...RECORDS]
    .sort((a, b) => b.profile.sleep.score - a.profile.sleep.score)
    .slice(0, 5)
    .map((r, i) => ({ ...base(r.patient), ...withDelta(r.profile.sleep.score, i + r.profile.sleep.leaveCount) }))

  const fall = [...RECORDS]
    .sort((a, b) => b.profile.fall_risk - a.profile.fall_risk)
    .slice(0, 5)
    .map((r, i) => ({ ...base(r.patient), ...withDelta(r.profile.fall_risk, i * 2 + 1) }))

  const vitalText = (p: Patient): { text: string; abnormal: boolean } => {
    const types = p.abnormal?.types ?? []
    if (types.includes('hr')) return { text: `${p.vitals.hr}bpm`, abnormal: true }
    if (types.includes('tp')) return { text: `${p.vitals.tp.toFixed(1)}℃`, abnormal: true }
    if (types.includes('br')) return { text: `${p.vitals.br}次/分`, abnormal: true }
    if (p.abnormal?.fall) return { text: `${p.vitals.br}次/分`, abnormal: true }
    return { text: `${p.vitals.hr}bpm`, abnormal: false }
  }
  const vitals = [...RECORDS]
    .sort((a, b) => {
      const ab = (b.patient.abnormal ? 1 : 0) - (a.patient.abnormal ? 1 : 0)
      if (ab !== 0) return ab
      return b.patient.vitals.hr - a.patient.vitals.hr
    })
    .slice(0, 5)
    .map((r, i) => {
      const t = vitalText(r.patient)
      const deviation = Math.abs(r.patient.vitals.hr - 72) + (t.abnormal ? 50 : 0)
      return { ...base(r.patient), ...withDelta(deviation, i), text: t.text, abnormal: t.abnormal }
    })

  return Promise.resolve({ sleep, fall_risk: fall, vitals })
}

export function getRoutineMeta(patientId: string): { normalNightTrips: number; rehabScheduled: boolean } {
  const r = RECORDS.find(x => x.patient.patient_id === patientId)
  return r ? { normalNightTrips: r.normalNightTrips, rehabScheduled: r.rehabScheduled } : { normalNightTrips: 0, rehabScheduled: false }
}

function pageList<T>(list: T[], page = 1, pageSize = 20): Paged<T> {
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, page_size: pageSize }
}

// ============================================================
// 厂商（中科安樵）全国运营数据 —— 与 server/seed.js anqiao 租户同构的 mock
// 大屏第五屏"全国态势"无登录态，直接读这里
// ============================================================
const NATION_DEVICES: DevicePoint[] = (() => {
  const devices: DevicePoint[] = []
  for (const c of GEO_HIERARCHY) {
    for (const d of c.districts) {
      for (const m of d.communities) {
        for (let i = 0; i < m.devices.length; i++) {
          const u = m.devices[i]
          // 在区县中心附近微扰经纬度，形成自然真实的社区密集点簇
          const rnd = mulberry32(20260920 ^ (0xc177 + devices.length * 131))
          const lonOffset = (rnd() - 0.5) * 0.08
          const latOffset = (rnd() - 0.5) * 0.08
          devices.push({
            device_id: u.device_id,
            type: u.type,
            city: c.city,
            district: d.name,
            community: m.name,
            building: u.building,
            room: u.room,
            customer: '中科安樵自营',
            lon: Math.round((d.lon + lonOffset) * 10000) / 10000,
            lat: Math.round((d.lat + latOffset) * 10000) / 10000,
            online: u.online,
            alerting: u.alerting,
            last_data_time: nowIso(),
          })
        }
      }
    }
  }
  return devices
})()

export function getNationCities(): Promise<CityStat[]> {
  return Promise.resolve(
    GEO_HIERARCHY.map((c) => {
      const devices = NATION_DEVICES.filter((x) => x.city === c.city)
      return {
        city: c.city,
        lon: c.lon,
        lat: c.lat,
        device_total: devices.length,
        device_online: devices.filter((x) => x.online).length,
        alerts_today: c.alerts_today,
        customers: c.districts.flatMap((d) => d.communities.map((m) => m.name)),
      }
    }),
  )
}

export function getNationHierarchy(): Promise<CityHierarchy[]> {
  return Promise.resolve(GEO_HIERARCHY)
}

export function getDistrictsByCity(cityName: string): Promise<DistrictDetail[]> {
  const c = GEO_HIERARCHY.find((x) => x.city === cityName)
  return Promise.resolve(c ? c.districts : [])
}

export function getCommunitiesByDistrict(districtIdOrName: string): Promise<CommunityDetail[]> {
  for (const c of GEO_HIERARCHY) {
    const d = c.districts.find((x) => x.id === districtIdOrName || x.name === districtIdOrName)
    if (d) return Promise.resolve(d.communities)
  }
  return Promise.resolve([])
}

export function getNationDevices(city?: string): Promise<DevicePoint[]> {
  return Promise.resolve(city ? NATION_DEVICES.filter((x) => x.city === city) : NATION_DEVICES)
}

export function getNationOverview(): Promise<Overview> {
  const total = NATION_DEVICES.length
  const online = NATION_DEVICES.filter((x) => x.online).length
  const alerting = NATION_DEVICES.filter((x) => x.alerting).length
  return Promise.resolve({
    device_total: total,
    device_online: online,
    device_online_rate: Math.round((online / total) * 1000) / 10,
    patient_total: 0,
    patient_male: 0,
    patient_female: 0,
    bed_occupied: 0,
    bed_total: 0,
    alerts_today: alerting + 18,
    alerts_closed_today: 15,
    in_bed_count: 0,
    in_bed_rate: 0,
    city_count: GEO_HIERARCHY.length,
    generated_at: nowIso(),
  })
}


export function getShift(): Promise<ShiftInfo> {
  return Promise.resolve({
    shift_name: '白班 (08:00 - 16:00)',
    shift_range: '08:00 - 16:00',
    nurses: [
      { name: '李晓芳 护工', floor: '4F 完全失能专区' },
      { name: '王芳 护工主管', floor: '3F 认知障碍专区' },
      { name: '张晓敏 护工', floor: '2F 术后康复专区' },
      { name: '何丽 护工', floor: '1F 慢病颐养专区' },
    ],
    carry_over_open: 1,
    generated_at: nowIso(),
  })
}

export async function getPatientDetail(patientId: string): Promise<PatientDetail> {
  const p = await getPatient(patientId)
  const prof = await getPatientProfile(patientId)
  const curves = {
    hr: Array.from({ length: 24 }, (_, i) => ({ t: `${String(i).padStart(2, '0')}:00`, v: p.vitals.hr + Math.round(Math.sin(i * 0.5) * 6) })),
    br: Array.from({ length: 24 }, (_, i) => ({ t: `${String(i).padStart(2, '0')}:00`, v: p.vitals.br + Math.round(Math.cos(i * 0.5) * 3) })),
    tp: Array.from({ length: 24 }, (_, i) => ({ t: `${String(i).padStart(2, '0')}:00`, v: Number((p.vitals.tp + Math.sin(i * 0.4) * 0.3).toFixed(1)) })),
  }
  return {
    ...p,
    curves,
    sleep: prof.sleep,

    diseases: ['高血压病', '冠心病', '脑卒中后康复'],
    alert_history: [
      {
        alert_id: 'alt-mock-hist-1',
        bed_id: p.bed_id,
        patient_id: p.patient_id,
        type: 'off_bed',
        level: 2,
        status: 'handled',
        title: '夜间离床预警',
        detail: '毫米波雷达监测到夜间离床超过 15 分钟',
        occurred_at: new Date(Date.now() - 3600 * 4000).toISOString(),
        claimed_by: '李晓芳 护工',
        claimed_at: new Date(Date.now() - 3600 * 3900).toISOString(),
        handled_by: '李晓芳 护工',
        handled_at: new Date(Date.now() - 3600 * 3800).toISOString(),
        handle_note: '巡视确认老人如厕后已平稳回床安睡',
      },
    ],
  }
}


