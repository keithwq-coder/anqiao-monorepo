// SIM 仿真遥测源 —— 设计文档 docs/SIM-TELEMETRY-DESIGN.md（P-A）的唯一实现。
//
// 目标：`SIM-` 前缀设备在 2.8 六接口上获得与真机观感一致的确定性遥测：
//   同一 (sn, date) 任何进程、任何时刻、任何次重启，历史点逐字段一致（V1）；
//   不同日期自然换新且区间合法（V2/V10）；
//   区间对齐《AI健康守护仪数据指标与医学参考值解读体系规范》（VER-202609-SPEC-04）。
//
// 禁用 Date.now()/Math.random 入种子；latest/today 按"当前时刻切片"推进，
// 历史点永不变。缓存无需持久化——重启后确定性重生成即是一致性保证。
//
// 上游形状参照 server/hw.js 所代理的《AI 健康守护仪对接API（V1.0）》响应
// 与前端类型（anqiao-dashboard/src/api/hardwareApi.ts）：
//   latest: { device_id, account, hr, br, tp, isBed, body_movement, sleepReport, created_at }
//   today/daily: [{ br, hr, tp, isBed, body_movement, created_at }]
//   sleep: { br_avg, hr_avg, tp_avg, count, sleepReport }
//   sleepReport: { hrv_ms, sleep_start, sleep_end, report_start, report_end, sleep_score,
//     breathing_score, apnea_count, avg_apnea_seconds, longest_apnea_seconds,
//     out_of_bed_count, deep_sleep_minutes, light_sleep_minutes, awake_duration_minutes,
//     sleep_duration_minutes, bed_duration_minutes, stage_fields, value_fields }
//   alarms: { items: [{ id, device_id, alert_type, alert_value, trigger_time, handle_time, status }], total }
//   report-dates: [date]

const TZ8_MS = 8 * 3600 * 1000
const WINDOW_START_MIN = 20 * 60 // 夜间窗起点 20:00
const WINDOW_END_MIN = 24 * 60 + 8 * 60 // 夜间窗终点 次日 08:00

// ---------- 种子与 PRNG（与 seed.js 同一 mulberry32 算法，独立复制以免循环依赖）----------
export function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 种子函数：seedOf(sn, date) —— V1 不变量核心。date 为 'YYYY-MM-DD'。 */
export function seedOf(sn, date) {
  return (fnv1a(String(sn)) ^ fnv1a(String(date))) >>> 0
}

// ---------- 医学参考值常量表（VER-202609-SPEC-04 §4.1，V10 断言同源）----------
export const MEDICAL_RANGES = Object.freeze({
  hrAwake: [60, 100], // 静息心率（清醒）
  hrNight: [50, 70], // 夜间心率（下沿即心动过缓预警线）
  br: [12, 20], // 呼吸频率 主区间
  tp: [36.0, 37.2], // 体表体温
  bodyMovement: [0, 2], // 体动等级
  hrHardBounds: [50, 110], // 生成器安全边界（夜间下沿 ~ 心动过速预警线内）
  brHardBounds: [10, 22],
  tpHardBounds: [35.8, 37.2],
})

// ---------- 时间工具（东八区）----------
function now8() {
  return new Date(Date.now() + TZ8_MS)
}

function dateStrOf(now) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`
}

function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function isValidSn(sn) {
  return typeof sn === 'string' && /^SIM-[A-Z0-9]{2,10}$/.test(sn)
}

function prevDateOf(date) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD HH:mm:ss'，分钟数可跨日进位（契约时间格式）*/
function fmtDateTime(dateStr, minuteOfDay, sec = 0) {
  const p = (n) => String(n).padStart(2, '0')
  const total = Math.max(0, Math.round(minuteOfDay)) * 60 + sec
  const day = Math.floor(total / 86400)
  const hh = p(Math.floor((total % 86400) / 3600))
  const mm = p(Math.floor((total % 3600) / 60))
  const ss = p(total % 60)
  if (!day) return `${dateStr} ${hh}:${mm}:${ss}`
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + day)
  return `${d.toISOString().slice(0, 10)} ${hh}:${mm}:${ss}`
}

// ---------- 当日作息曲线（每设备一条，随日种子确定）----------
// 就寝 ~21:00-23:00，起床 ~06:00-07:15，昼间小睡 0-1 段，夜间如厕起身 0-2 次。
// 在床状态全程由这些区间驱动。
function routineOf(sn, date) {
  const rnd = mulberry32(seedOf(sn, date) ^ 0x11bed)
  const bedtime = 21 * 60 + Math.floor(rnd() * 121)
  const wake = 6 * 60 + Math.floor(rnd() * 76)
  const napStart = rnd() < 0.65 ? 13 * 60 + Math.floor(rnd() * 121) : null
  const napLen = napStart !== null ? 30 + Math.floor(rnd() * 61) : 0
  const toilets = []
  const toiletCount = Math.floor(rnd() * 3)
  for (let i = 0; i < toiletCount; i++) {
    toilets.push({ start: 60 * 60 + Math.floor(rnd() * 240), len: 3 + Math.floor(rnd() * 8) })
  }
  return { bedtime, wake, napStart, napLen, toilets }
}

function isInBedAt(routine, minuteOfDay) {
  const { bedtime, wake, napStart, napLen, toilets } = routine
  const nightInBed = minuteOfDay >= bedtime || minuteOfDay < wake
  const napInBed = napStart !== null && minuteOfDay >= napStart && minuteOfDay < napStart + napLen
  if (!(nightInBed || napInBed)) return false
  for (const t of toilets) {
    if (minuteOfDay >= t.start && minuteOfDay < t.start + t.len && minuteOfDay >= bedtime) return false
  }
  return true
}

// ---------- 昼夜节律体征 ----------
// 心率：清醒昼间 62-76，入睡后 45 分钟内从昼间基线滑向夜间区间；呼吸/体温同理小幅回落；
// 每分钟一个独立有界扰动（由该分钟位置派生，非全局随机）。
function vitalAt(sn, date, minuteOfDay) {
  const routine = routineOf(sn, date)
  const rnd = mulberry32((seedOf(sn, date) ^ Math.imul(minuteOfDay + 1, 0x9e3779b1)) >>> 0)
  const inBed = isInBedAt(routine, minuteOfDay)
  const night = minuteOfDay >= routine.bedtime || minuteOfDay < routine.wake

  let hr
  let br
  if (night && inBed) {
    const sinceBed = minuteOfDay >= routine.bedtime ? minuteOfDay - routine.bedtime : 1440 - routine.bedtime + minuteOfDay
    const ramp = Math.min(1, sinceBed / 45)
    hr = 72 - 16 * ramp + (rnd() - 0.5) * 4
    br = 16 - 3 * ramp + (rnd() - 0.5) * 2
  } else if (inBed) {
    hr = 66 + (rnd() - 0.5) * 4
    br = 14 + (rnd() - 0.5) * 2
  } else {
    hr = 70 + (rnd() - 0.5) * 6
    br = 16 + (rnd() - 0.5) * 3
  }
  const tp = 36.4 + (rnd() - 0.5) * 0.4

  const clamp = (v, bounds) => Math.min(bounds[1], Math.max(bounds[0], v))
  return {
    hr: Math.round(clamp(hr, MEDICAL_RANGES.hrHardBounds)),
    br: Math.round(clamp(br, MEDICAL_RANGES.brHardBounds)),
    tp: Number(clamp(tp, MEDICAL_RANGES.tpHardBounds).toFixed(1)),
    isBed: inBed,
    body_movement: inBed ? (rnd() < 0.18 ? (rnd() < 0.3 ? 2 : 1) : 0) : rnd() < 0.1 ? 1 : 0,
  }
}

// ---------- 当日全量序列（懒生成 + 进程内缓存）----------
// daySeries(sn, date)：D 日 00:00-24:00 共 1440 分钟（供 latest/today 切片）。
// nightSeries(sn, date)：D 日 20:00 至 D+1 日 08:00 共 720 分钟（供 daily/sleep）。
// 跨日拼接按设计 §3.4：20:00-24:00 取 D-1 日种子、00:00-08:00 取 D 日种子。
const seriesCache = new Map()

function daySeries(sn, date) {
  const key = `day:${sn}:${date}`
  if (!seriesCache.has(key)) {
    const pts = []
    for (let m = 0; m < 1440; m++) {
      pts.push({ ...vitalAt(sn, date, m), created_at: fmtDateTime(date, m) })
    }
    seriesCache.set(key, { pts })
  }
  return seriesCache.get(key)
}

function nightSeries(sn, date) {
  const key = `night:${sn}:${date}`
  if (!seriesCache.has(key)) {
    const prev = prevDateOf(date)
    const pts = []
    for (let m = 0; m < 720; m++) {
      const minuteOfDay = WINDOW_START_MIN + m
      const srcDate = minuteOfDay < 1440 ? prev : date
      const v = vitalAt(sn, srcDate, minuteOfDay % 1440)
      pts.push({ ...v, created_at: fmtDateTime(prev, minuteOfDay) })
    }
    seriesCache.set(key, { pts })
  }
  return seriesCache.get(key)
}

// ---------- 睡眠分期（对齐规范：1 清醒 / 2 REM / 3 浅睡 / 4 深睡）----------
// 深睡集中前半夜、占比按老龄生理衰减（65-75 岁约 8%-15%，规范 §4.2）；
// 入睡潜伏期 8-30 分钟；段长 4-22 分钟。
function buildStages(sn, date) {
  const rnd = mulberry32(seedOf(sn, date) ^ 0x57a9e)
  const stages = []
  const latency = 8 + Math.floor(rnd() * 23)
  stages.push({ start: 0, end: latency, stage: 1 })
  let i = latency
  while (i < WINDOW_END_MIN - WINDOW_START_MIN) {
    const total = WINDOW_END_MIN - WINDOW_START_MIN
    const deepPhase = i < total / 2
    const r = rnd()
    let stage
    // 深睡集中前半夜；占比目标 8%-15%（老龄生理衰减，规范 §4.2）
    if (r < (deepPhase ? 0.18 : 0.03)) stage = 4
    else if (r < (deepPhase ? 0.72 : 0.6)) stage = 3
    else if (r < (deepPhase ? 0.88 : 0.9)) stage = 2
    else stage = 1
    const len = 4 + Math.floor(rnd() * 19)
    const last = stages[stages.length - 1]
    if (last && last.stage === stage && last.end === i) last.end = Math.min(total, i + len)
    else stages.push({ start: i, end: Math.min(total, i + len), stage })
    i += len
  }
  return stages
}

function sumMinutes(stages, stage) {
  return stages.reduce((acc, s) => (s.stage === stage ? acc + (s.end - s.start) : acc), 0)
}

// ---------- 2.8.2 latest（当前时刻切片）----------
export function simLatestData(sn, { now = now8() } = {}) {
  assertSimSn(sn)
  const date = dateStrOf(now)
  const { pts } = daySeries(sn, date)
  const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes()
  const pt = pts[Math.min(minuteOfDay, pts.length - 1)]
  return {
    device_id: sn,
    account: '',
    hr: pt.hr,
    br: pt.br,
    tp: pt.tp,
    isBed: pt.isBed,
    body_movement: pt.body_movement,
    sleepReport: null,
    created_at: pt.created_at,
  }
}

// ---------- 2.8.4 today：与 latest 同一条曲线的切片 ----------
export function simTodayData(sn, { now = now8() } = {}) {
  assertSimSn(sn)
  const date = dateStrOf(now)
  const { pts } = daySeries(sn, date)
  const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes()
  return pts.slice(0, Math.min(minuteOfDay + 1, pts.length))
}

// ---------- 2.8.3 daily：夜间窗 720 分钟 ----------
export function simDailyData(sn, date) {
  assertSimSn(sn)
  assertDate(date)
  return nightSeries(sn, date).pts
}

// ---------- 2.8.5 sleep stats ----------
export function simSleepStats(sn, date) {
  assertSimSn(sn)
  assertDate(date)
  const prev = prevDateOf(date)
  const { pts } = nightSeries(sn, date)
  const routine = routineOf(sn, prev)
  const stages = buildStages(sn, date)

  const deepMin = sumMinutes(stages, 4)
  const lightMin = sumMinutes(stages, 3)
  const remMin = sumMinutes(stages, 2)
  const awakeMin = sumMinutes(stages, 1)
  const sleepMin = deepMin + lightMin + remMin
  // 卧床时长 = 窗长 - 起夜离床时间（夜间窗内作息决定）
  const offMin = routine.toilets.reduce((a, t) => a + t.len, 0)
  const bedMin = 720 - offMin
  const hrAvg = Math.round(pts.reduce((a, p) => a + p.hr, 0) / pts.length)
  const brAvg = Math.round(pts.reduce((a, p) => a + p.br, 0) / pts.length)
  const tpAvg = Number((pts.reduce((a, p) => a + p.tp, 0) / pts.length).toFixed(1))

  const rnd = mulberry32(seedOf(sn, date) ^ 0xa5c0)
  const apneaCount = rnd() < 0.4 ? 0 : Math.floor(rnd() * 5)
  const apneaAvg = apneaCount ? 11 + Math.floor(rnd() * 8) : 0
  const apneaMax = apneaCount ? apneaAvg + Math.floor(rnd() * 12) : 0
  const hrvMs = 28 + Math.floor(rnd() * 26)
  const outOfBed = routine.toilets.length
  const efficiency = bedMin > 0 ? Math.min(100, Math.round((sleepMin / bedMin) * 100)) : 0

  const firstSleep = stages.find((s) => s.stage !== 1)
  const lastSleep = [...stages].reverse().find((s) => s.stage !== 1)
  const sleepStart = firstSleep ? fmtDateTime(prev, WINDOW_START_MIN + firstSleep.start) : fmtDateTime(prev, WINDOW_START_MIN)
  const sleepEnd = lastSleep ? fmtDateTime(prev, WINDOW_START_MIN + lastSleep.end) : fmtDateTime(prev, WINDOW_END_MIN)

  return {
    br_avg: brAvg,
    hr_avg: hrAvg,
    tp_avg: tpAvg,
    count: pts.length,
    sleepReport: {
      hrv_ms: hrvMs,
      sleep_start: sleepStart,
      sleep_end: sleepEnd,
      report_start: fmtDateTime(prev, WINDOW_START_MIN),
      report_end: fmtDateTime(prev, WINDOW_END_MIN),
      sleep_score: Math.max(55, Math.min(96, 70 + Math.round(efficiency / 6) - outOfBed * 2 - apneaCount * 2)),
      breathing_score: Math.max(60, Math.min(98, 95 - apneaCount * 5 - (apneaMax > 25 ? 8 : 0))),
      apnea_count: apneaCount,
      avg_apnea_seconds: apneaAvg,
      longest_apnea_seconds: apneaMax,
      out_of_bed_count: outOfBed,
      deep_sleep_minutes: deepMin,
      light_sleep_minutes: lightMin,
      awake_duration_minutes: awakeMin,
      sleep_duration_minutes: sleepMin,
      bed_duration_minutes: bedMin,
      stage_fields: stages.flatMap((s) => Array(s.end - s.start).fill(s.stage)),
      value_fields: pts.map((p) => p.hr),
    },
  }
}

// ---------- 2.8.6 report-dates：[今天-30 天, 今天] ----------
export function simReportDates(sn, { now = now8() } = {}) {
  assertSimSn(sn)
  const dates = []
  const today = new Date(`${dateStrOf(now)}T00:00:00Z`)
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

// ---------- 2.7.4 alarms ----------
// 约 0-3 条/日/床；当日 triggered、更早日期 handled；时间点与作息自洽：
// 离床类集中在夜间如厕段，跌倒落在昼间活动段，体征异常偶发。
function simAlarmsForDate(sn, date, nowMinutes, isToday) {
  const rnd = mulberry32(seedOf(sn, date) ^ 0xa1a7)
  const routine = routineOf(sn, date)
  const count = Math.floor(rnd() * 4)
  const alarms = []
  for (let i = 0; i < count; i++) {
    const r = rnd()
    let type
    if (routine.toilets.length && r < 0.45) type = 'off_bed'
    else type = ['hr', 'br', 'tp', 'off_bed', 'fall'][Math.floor(rnd() * 5)]
    let minuteOfDay
    if (type === 'off_bed' && routine.toilets.length) {
      const t = routine.toilets[Math.floor(rnd() * routine.toilets.length)]
      minuteOfDay = t.start + Math.floor(rnd() * t.len)
    } else if (type === 'fall') {
      minuteOfDay = routine.wake + 60 + Math.floor(rnd() * 300)
      if (minuteOfDay >= 1380) minuteOfDay = 900
    } else {
      minuteOfDay = Math.floor(rnd() * 1440)
    }
    if (isToday && minuteOfDay > nowMinutes) continue // 未来告警不出现，历史点保持一致
    const rndV = mulberry32(seedOf(sn, date) ^ Math.imul(minuteOfDay + 7, 0x2f6b) ^ (i + 1))
    const alertValue =
      type === 'hr'
        ? String(101 + Math.floor(rndV() * 20))
        : type === 'br'
          ? String(23 + Math.floor(rndV() * 4))
          : type === 'tp'
            ? (37.3 + Math.floor(rndV() * 5) * 0.1).toFixed(1)
            : type === 'off_bed'
              ? String(30 + Math.floor(rndV() * 16))
              : '1'
    alarms.push({
      id: (fnv1a(`${sn}:${date}:${i}`) % 100000) + 1,
      device_id: sn,
      alert_type: type,
      alert_value: alertValue,
      trigger_time: fmtDateTime(date, minuteOfDay),
      handle_time: isToday ? null : fmtDateTime(date, minuteOfDay + 15),
      status: isToday ? 'triggered' : 'handled',
    })
  }
  return alarms
}

export function simAlarms(sn, { page = 1, pageSize = 20, status, now = now8() } = {}) {
  assertSimSn(sn)
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const today = dateStrOf(now)
  const dates = simReportDates(sn, { now }).slice().reverse() // 升序：31 天前 → 今天
  let all = []
  for (const d of dates) {
    all = all.concat(simAlarmsForDate(sn, d, nowMinutes, d === today))
  }
  if (status) all = all.filter((a) => a.status === status)
  all.sort((a, b) => (a.trigger_time < b.trigger_time ? 1 : -1))
  const total = all.length
  const start = (Math.max(1, page) - 1) * pageSize
  return { items: all.slice(start, start + pageSize), total }
}

// ---------- 参数校验与分流判据 ----------
function assertSimSn(sn) {
  if (!isValidSn(sn)) {
    const err = new Error('SIM 设备 SN 非法（应为 SIM- 前缀 + 2-10 位大写字母数字）')
    err.status = 400
    throw err
  }
}

function assertDate(date) {
  if (!isValidDateStr(date)) {
    const err = new Error('date 非法（应为 YYYY-MM-DD）')
    err.status = 400
    throw err
  }
}

/** 是否为 SIM 仿真设备（代理层分流判据，设计 §3.1）*/
export function isSimDevice(sn) {
  return typeof sn === 'string' && sn.startsWith('SIM-')
}

// ---------- 测试辅助：清空进程内缓存（模拟重启）----------
export function __resetSimCache() {
  seriesCache.clear()
}
