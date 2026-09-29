<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { generateAnqiaoDirectUsers } from '../assets/profileData'
import type { PatrolCardItem } from '../assets/profileData'
import { ANQIAO_DEVICES, getAnqiaoDevice } from '../assets/anqiaoDevices'
import { getLtciArchive, archiveStatusOf, MISSING_TEXT, MISSING_HINT } from '../assets/ltciArchive'
import HoloChannelsOverlay from '../components/HoloChannelsOverlay.vue'
import MedicalHologramFigure from '../components/MedicalHologramFigure.vue'
import {
  getTodayRawData,
  getDailyRawData,
  getSleepStats,
  getReportDates,
  aggregateTodayPoints,
  getHardwareAlarms,
} from '../api/hardwareApi'
import type {
  LatestHardwareData,
  HourlyVitalsAggregate,
  TodayRawDataPoint,
  SleepStatsResult,
  HardwareAlarm,
} from '../api/hardwareApi'
import { deviceTelemetry, freshnessOf, isOnline, offlineReason, presenceOf, lastSampleTime, sampleMs } from '../api/deviceTelemetry'
import { deviceIpGeoOf, ipGeoDisplay, resolveDeviceIpGeo } from '../api/ipGeo'

const props = withDefaults(
  defineProps<{ active: boolean; patientId: string; orgId?: string }>(),
  { orgId: 'anqiao' }
)

// ======================= 在册真实设备数据模型（与 Screen 2 巡查卡片同源） =======================
const genericItems = ref<PatrolCardItem[]>([])

function buildGenericItems(): PatrolCardItem[] {
  return generateAnqiaoDirectUsers()
}

const currentId = ref(props.patientId)
const dropdownOpen = ref(false)
const searchQ = ref('')
const searchQDebounced = ref('')
let searchDebounceTimer = 0
watch(searchQ, (v) => {
  window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = window.setTimeout(() => { searchQDebounced.value = v.trim().toLowerCase() }, 150)
})

// 组合式过滤面板状态（搜索 + 分类 + 状态 + 群体 + 排序 + 分页）
const ddCategory = ref('all')
const ddStatus = ref<'all' | 'alert' | 'inBed' | 'outBed'>('all')
const ddGroup = ref<'' | 'alert' | 'age85' | 'org'>('')
const ddSort = ref<'default' | 'risk' | 'code'>('default')
const ddPage = ref(1)

const gCurrent = computed<PatrolCardItem | null>(() => {
  const items = genericItems.value
  if (!items.length) return null
  return items.find(i => i.patientId === currentId.value) ?? items.find(i => i.id === currentId.value) ?? items[0]
})

const gIndex = computed(() => {
  const c = gCurrent.value
  if (!c) return 0
  const idx = genericItems.value.findIndex(i => i.patientId === c.patientId)
  return idx >= 0 ? idx : 0
})

// ======================= 宿迁医保长护险 · 真实 AI健康守护仪 状态 =======================
// 3 台在册设备全部接入真实硬件链路，最新遥测由全局共享 store（deviceTelemetry，5s 轮询）驱动。
// 在线判定完全由 latest_data 新鲜样本驱动（≤90s：有样本即在床/离床在线，无样本即离线）
const isRealHardware = computed(() => !!gCurrent.value?.isRealHardware)
const realDeviceId = computed(() => gCurrent.value?.realDeviceId || '')
const realHwData = computed<LatestHardwareData | null>(() => (realDeviceId.value ? deviceTelemetry[realDeviceId.value]?.data : null) ?? null)
// rtLive = 设备在线（status ONLINE 或新鲜样本回退）
const rtLive = computed(() => isOnline(realDeviceId.value))
// 是否有 ≤90s 新鲜数值样本（决定能否展示真实数值/样本时间）
const rtHasSample = computed(() => freshnessOf(realDeviceId.value) === 'live' && !!realHwData.value)
// 人体在场三态：'person'=设备在线·在床 / 'empty'=设备在线·离床（全 0 为真实上报的空数据）/ null=离线
const rtPresence = computed(() => presenceOf(realDeviceId.value))
const rtSampleTime = computed(() => lastSampleTime(realDeviceId.value))
const rtArchiveNote = computed(() => offlineReason(realDeviceId.value) || '设备离线 · 暂无实时数据')
const realTodayRawPoints = ref<TodayRawDataPoint[]>([])
const realTodayAgg = ref<HourlyVitalsAggregate[]>([])
// 在床监测窗（20:00 → 次日 08:00，云平台 daily_data 报告窗同口径）连续采样流：
// daily_data(监测窗) 与 today_data 合并去重，覆盖「昨日 20:00 → 当前」，跨零点不中断。
// 本设备为平卧（在床）监测设备：非睡眠监测语义，服务于医保局监管报告。
const realBedStreamPoints = ref<TodayRawDataPoint[]>([])
const realSleepStats = ref<SleepStatsResult | null>(null)
const realReportDates = ref<string[]>([])
const selectedReportDate = ref<string>('')
const realAlarms = ref<HardwareAlarm[]>([])
const realHwLoading = ref(false)

// ======================= 长护险参保档案（字段结构完整保留；个人字段未拿到真实数据，一律"未获取"，严禁模拟/编造） =======================
const ltciArchive = computed(() => getLtciArchive(realDeviceId.value || currentId.value))

// 档案建档状态标签：全缺失 → "参保档案未获取"；部分字段已确认 → "档案部分建档"
const archiveStatusTag = computed(() => {
  const st = archiveStatusOf(ltciArchive.value)
  if (st === 'pending') return { text: `参保档案${MISSING_TEXT}`, cls: 'missing-tag', hint: MISSING_HINT }
  if (st === 'partial') return { text: '档案信息完善中', cls: 's3-archive-tag-partial', hint: '档案信息持续完善中' }
  return { text: '档案已建档', cls: 's3-archive-tag-partial', hint: '' }
})

// ======================= 顶部点位切换（身份信息在台座，此处不重复） =======================
const searchPlaceholder = '搜索点位 / 设备编号 / 姓名'
const emptyText = '未找到匹配的点位'

// ======================= 下拉组合式过滤面板（计数全部实算） =======================
interface DdRow {
  key: string
  code: string
  name: string
  meta: string
  category: string
  isAlert: boolean
  inBed: boolean
  group3: boolean
  badge: string
  search: string
}

const ddRows = computed<DdRow[]>(() => {
  // 设备维度行（分类按在线状态映射，已登记参保人时带出参保人）
  return genericItems.value.map(it => {
    const devShort = it.boundDevices?.map(d => d.sn).join('/') || ''
    const arc = getLtciArchive(it.realDeviceId || it.code)
    const displayName = arc.elderName ? `${it.name} (${arc.elderName})` : it.name
    return {
      key: it.patientId,
      code: it.code,
      name: displayName,
      meta: `${it.tag}${devShort ? ' · ' + devShort : ''}`,
      category: it.presence.inBed ? 'direct' : 'archived',
      isAlert: it.isAlert,
      inBed: it.presence.inBed,
      group3: (it.deviceBadge ?? '').includes('旗舰'),
      badge: it.isAlert ? '预警' : (it.presence.inBed ? '● 在线' : '归档'),
      search: `${it.name} ${it.code} ${it.id} ${it.patientId} ${arc.elderName || ''} ${it.tag} ${it.realDeviceId || ''} ${it.footer.staffText} ${devShort} ${it.isRealHardware ? '真实 硬件' : ''}`.toLowerCase(),
    }
  })
})

const ddTabs = computed(() => {
  const rows = ddRows.value
  const cnt = (c: string) => rows.filter(r => r.category === c).length
  // 全部设备 / 实时遥测 / 在册归档
  return [
    { key: 'all', label: '全部设备', count: rows.length },
    { key: 'direct', label: '实时在线', count: cnt('direct') },
    { key: 'archived', label: '在册归档', count: cnt('archived') },
  ]
})

const ddStatusChips = computed(() => {
  const base = ddRows.value.filter(r => ddCategory.value === 'all' || r.category === ddCategory.value)
  return [
    { key: 'all' as const, label: '全部', count: base.length },
    { key: 'alert' as const, label: '设备告警', count: base.filter(r => r.isAlert).length },
    { key: 'inBed' as const, label: '实时在线', count: base.filter(r => r.inBed).length },
    { key: 'outBed' as const, label: '在册归档', count: base.filter(r => !r.inBed).length },
  ]
})

const ddGroupChips = computed(() => {
  const rows = ddRows.value
  return [
    { key: 'alert' as const, label: '⚠ 设备告警', count: rows.filter(r => r.isAlert).length },
    { key: 'age85' as const, label: '● 实时在线', count: rows.filter(r => r.inBed).length },
    { key: 'org' as const, label: '旗舰机型', count: rows.filter(r => r.group3).length },
  ]
})

const ddFiltered = computed(() => {
  const q = searchQDebounced.value
  return ddRows.value.filter(r => {
    if (ddCategory.value !== 'all' && r.category !== ddCategory.value) return false
    if (ddStatus.value === 'alert' && !r.isAlert) return false
    if (ddStatus.value === 'inBed' && !r.inBed) return false
    if (ddStatus.value === 'outBed' && r.inBed) return false
    if (ddGroup.value === 'alert' && !r.isAlert) return false
    // 'age85' 分组键复用为“实时遥测”筛选
    if (ddGroup.value === 'age85' && !r.inBed) return false
    if (ddGroup.value === 'org' && !r.group3) return false
    if (q && !r.search.includes(q)) return false
    return true
  })
})

const ddSorted = computed(() => {
  const arr = [...ddFiltered.value]
  if (ddSort.value === 'risk') return arr.sort((a, b) => Number(b.isAlert) - Number(a.isAlert))
  if (ddSort.value === 'code') return arr.sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN'))
  return arr
})

const DD_PAGE_SIZE = 20
const ddPageCount = computed(() => Math.max(1, Math.ceil(ddSorted.value.length / DD_PAGE_SIZE)))
const ddPageRows = computed(() => ddSorted.value.slice((ddPage.value - 1) * DD_PAGE_SIZE, ddPage.value * DD_PAGE_SIZE))

watch([ddCategory, ddStatus, ddGroup, ddSort, searchQDebounced], () => { ddPage.value = 1 })

const gPagerText = computed(() => {
  return `${String(gIndex.value + 1).padStart(3, '0')} / ${String(genericItems.value.length).padStart(3, '0')}`
})

// ======================= 头部 Meta 与台座标牌 =======================
// 当前设备台账记录（与 ANQIAO_DEVICES 按 SN 一一对应）
const gCurrentDevice = computed(() => ANQIAO_DEVICES.find(d => d.sn === gCurrent.value?.realDeviceId) ?? null)

// 顶栏切换钮：只显示点位短名（SN/姓名/档案状态在台座）
const gDropdownLabel = computed(() => {
  const it = gCurrent.value
  if (!it) return '—'
  return gCurrentDevice.value?.label || it.name
})

// 画像台座两行：上行=项目·点位·姓名；下行=设备 SN + 档案状态（视觉更舒展）
const gPedestalTop = computed(() => {
  const it = gCurrent.value
  if (!it) return ''
  const rd = gCurrentDevice.value
  const elder = ltciArchive.value.elderName
  const namePart = elder ? ` · ${elder}` : ''
  const site = rd?.label || it.name
  return `宿迁长护险 · ${site}${namePart}`
})

const gPedestalBottom = computed(() => {
  const it = gCurrent.value
  if (!it) return ''
  const rd = gCurrentDevice.value
  return `[SN: ${rd?.sn || it.code}]`
})

// ======================= 中央舞台点缀与动画节律 =======================
const gHeartCycle = computed(() => `${(60 / (holoHr.value || 72)).toFixed(2)}s`)
const gBreatheCycle = computed(() => `${(60 / (holoBr.value || 16)).toFixed(2)}s`)

// ======================= 人体四通道统一数值（真实硬件API驱动） =======================
// 在线+有人且有 ≤90s 新鲜样本 → 真实样本值（含真实 0）；其余一律置 0（离线时 overlay 不渲染），严禁虚构默认体征

// 在床监测窗（20:00 → 次日 08:00）：now ≥ 20:00 时为本窗（进行中），否则为上一窗（00-08 点进行中 / 白天已完结）。
// dateKey 为云平台 daily_data 入参口径：监测窗结束（早晨）所在日期。
// 注：本设备为平卧（在床）监测设备，窗口按云平台报告口径划定，不作睡眠语义解读。
function bedMonitorWindow(now: Date = new Date()): { startMs: number; endMs: number; dateKey: string } {
  const start = new Date(now)
  start.setHours(20, 0, 0, 0)
  if (now.getHours() < 20) start.setDate(start.getDate() - 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setHours(8, 0, 0, 0)
  const dateKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return { startMs: start.getTime(), endMs: end.getTime(), dateKey }
}

interface BedHourSlot {
  label: string // "20:00" .. "08:00"
  moveFreq: number // 体动频次（该小时 body_movement 0→1 跳变次数，次/h）
  count: number
  inBed: boolean
}

// 在床监测窗 13 个小时槽（20,21,...,07,08）的体动聚合；仅统计 ≤ 当前的已流逝时段
const bedWindowHours = computed<BedHourSlot[]>(() => {
  const { startMs, endMs } = bedMonitorWindow()
  const startD = new Date(startMs)
  const slots: BedHourSlot[] = []
  for (let i = 0; i <= 12; i++) {
    const d = new Date(startD)
    d.setHours(startD.getHours() + i)
    slots.push({ label: `${String(d.getHours()).padStart(2, '0')}:00`, moveFreq: 0, count: 0, inBed: false })
  }
  const buckets = slots.map(() => ({ episodes: 0, lastMove: 0, total: 0, inBedCnt: 0 }))
  const limitMs = Math.min(endMs, Date.now())
  for (const pt of realBedStreamPoints.value) {
    const ms = sampleMs(pt.created_at)
    if (!ms || ms < startMs || ms > limitMs) continue
    const idx = Math.floor((ms - startMs) / 3_600_000)
    if (idx < 0 || idx > 12) continue
    const b = buckets[idx]
    b.total++
    if (pt.isBed) b.inBedCnt++
    const cur = pt.body_movement ? 1 : 0
    if (cur === 1 && b.lastMove === 0) b.episodes++
    b.lastMove = cur
  }
  slots.forEach((s, i) => {
    const b = buckets[i]
    s.count = b.total
    s.moveFreq = b.episodes
    s.inBed = b.total > 0 && b.inBedCnt / b.total > 0.3
  })
  return slots
})

// 在床体动指数：监测窗已流逝活跃小时的 moveFreq 均值（与「体动频率」曲线平均体动指数同源，次/h）
const bedMovementIndex = computed(() => {
  const active = bedWindowHours.value.filter(p => p.count > 0 || p.inBed)
  if (!active.length) return 0
  return Number((active.reduce((s, p) => s + p.moveFreq, 0) / active.length).toFixed(1))
})

const holoHr = computed(() => {
  if (rtPresence.value === 'person' && rtHasSample.value && realHwData.value) return Math.round(realHwData.value.hr)
  return 0
})

const holoBr = computed(() => {
  if (rtPresence.value === 'person' && rtHasSample.value && realHwData.value) return Math.round(realHwData.value.br)
  return 0
})

const holoTp = computed(() => {
  if (rtPresence.value === 'person' && rtHasSample.value && realHwData.value) return Number(realHwData.value.tp.toFixed(1))
  return 0
})

const holoMovement = computed(() => {
  // 体动指数取在床监测窗（20:00 → 次日 08:00）均值，跨零点不清零；
  // 真实硬件 body_movement 仅为 0/1，禁止再二值化成 22，否则多台在动设备会显示同一数值
  const dayIndex = bedMovementIndex.value

  // 离线/无人/无新鲜样本：仍展示在床体动指数（低动档案不应贴 0），无记录才是 0
  if (rtPresence.value !== 'person' || !(rtHasSample.value && realHwData.value)) {
    return Math.min(25, dayIndex)
  }

  // 瞬时仅轻度抬升（0/1），主值仍是可区分的在床监测指数
  const bm = Number(realHwData.value.body_movement) || 0
  const boost = bm > 0 ? 2 : 0
  return Math.min(25, Number((dayIndex + boost).toFixed(1)))
})

const holoAlert = computed(() => {
  return realAlarms.value.some(a => a.device_id === realDeviceId.value && a.status === 'triggered')
})
const holoHeartCycle = computed(() => `${(60 / (holoHr.value || 72)).toFixed(2)}s`)
const holoBreatheCycle = computed(() => `${(60 / (holoBr.value || 16)).toFixed(2)}s`)

// ======================= 中央数字人体 · 系统切换/监测层 =======================
const activeSystem = ref<'all' | 'neuro' | 'cardio' | 'resp' | 'temp' | 'skeleton'>('all')
function selectSystem(sys: string) {
  activeSystem.value = (['all', 'neuro', 'cardio', 'resp', 'temp', 'skeleton'] as const).includes(sys as never)
    ? (sys as 'all' | 'neuro' | 'cardio' | 'resp' | 'temp' | 'skeleton')
    : 'all'
}
const SYSTEM_CHIPS: { key: typeof activeSystem.value; label: string }[] = [
  { key: 'all', label: '全身系统' },
  { key: 'neuro', label: '神经系统' },
  { key: 'cardio', label: '心肺循环' },
  { key: 'resp', label: '呼吸系统' },
  { key: 'temp', label: '体温代谢' },
  { key: 'skeleton', label: '骨骼肌体' },
]
const sysInfo = computed(() => {
  const alive = rtLive.value
  const base = {
    all: { name: '全身系统 · 综合评估', desc: '心率、呼吸、体温、体动多通道聚合，当前在床监测稳定。' },
    neuro: { name: '神经系统 · 脑区活动', desc: `额温 ${holoTp.value}℃ · 认知障碍专区关注 · 神经放电节律平稳。` },
    cardio: { name: '心肺循环 · 心脏搏动', desc: `心率 ${holoHr.value} bpm${alive ? '' : '（离线）'} · HRV 自主神经调节正常。` },
    resp: { name: '呼吸系统 · 双肺通气', desc: `呼吸率 ${holoBr.value} 次/分 · 参考范围 12-20，气流节律顺畅。` },
    temp: { name: '体温代谢 · 腹部核心', desc: '核心温度区间正常，夜间热场无持续高亮，代谢平稳。' },
    skeleton: { name: '骨骼肌体 · 体位活动', desc: `体动指数 ${holoMovement.value} · 卧床防护/离床预警联动。` },
  }[activeSystem.value]
  return base
})

// ======================= 体征采集态（在床才有心率/体温/呼吸；离床必须视觉上停表） =======================
const vitalsLive = computed(() => rtPresence.value === 'person' && rtHasSample.value)

const vitalsHold = computed(() => {
  if (!rtLive.value) return { on: true, tone: 'off', text: '设备离线', sub: '暂无采集' }
  if (rtPresence.value === 'empty') return { on: true, tone: 'out', text: '离床 · 体征暂停', sub: '回床后自动恢复' }
  if (!rtHasSample.value) return { on: true, tone: 'wait', text: '等待体征', sub: '尚无新鲜样本' }
  return { on: false, tone: '', text: '', sub: '' }
})

const hrLivePill = computed(() => {
  if (!rtLive.value) return { icon: '○', text: '设备离线', cls: 's3-pill-mute' }
  if (rtPresence.value === 'empty') return { icon: '‖', text: '离床 · 暂停', cls: 's3-pill-amber' }
  if (!rtHasSample.value || holoHr.value <= 0) return { icon: '○', text: '等待体征', cls: 's3-pill-mute' }
  return { icon: '●', text: `当前 ${holoHr.value} bpm`, cls: 's3-pill-cyan' }
})

// ======================= 六卡标题与状态 Pill（静卧体征 · 失能评估辅助口径） =======================
// 四采集：心率 / 体温 / 呼吸 / 体动；两解读：监测窗客观摘要 / 评估辅助核查线索
const gCardTitles = {
  lt: '静卧心率监测',
  lb: '静卧体温监测',
  mt: '静卧体动 · 在床节律',
  rt: '静卧呼吸监测',
  rs: '监测窗客观摘要',
  rb: '评估辅助 · 核查线索',
}

const gPills = computed(() => {
  const ok = { cls: 's3-status-pill s3-pill-cyan', icon: '😊' }
  const blank = {
    lt: { ...ok, text: '' },
    lb: { ...ok, text: '' },
    mt: { ...ok, text: '' },
    rt: { ...ok, text: '' },
    rs: { ...ok, text: '' },
    rb: { ...ok, text: '' },
  }
  const it = gCurrent.value
  if (!it) return blank
  // 非实时在线设备：各卡 Pill 一律离线占位，不渲染起夜/深睡等伪指标
  if (!rtLive.value) {
    const arch = () => ({ cls: 's3-status-pill s3-pill-cyan', icon: '○', text: '设备离线' })
    return { lt: arch(), lb: arch(), mt: arch(), rt: arch(), rs: arch(), rb: arch() }
  }
  return {
    lt: { ...ok, icon: '●', text: '静卧心率监测中' },
    lb: { ...ok, icon: '●', text: '静卧测温中' },
    mt: { ...ok, icon: '●', text: '在床节律统计中' },
    rt: { ...ok, text: '静卧呼吸监测中' },
    rs: { ...ok, icon: '▤', text: '监测窗汇总' },
    rb: { ...ok, icon: '◎', text: '待现场核实' },
  }
})

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

interface ActigraphyPoint {
  time: string
  x: number
  y: number
  val: number
}

interface ActigraphyPeak {
  time: string
  x: number
  y: number
  val: number
  peakLabel: string
}

interface ActigraphyResult {
  linePath: string
  areaPath: string
  points: ActigraphyPoint[]
  peakPoints: ActigraphyPeak[]
  xTicks: { time: string; x: number }[]
  safeBand: { x: number; y: number; w: number; h: number }
  pill: { cls: string; icon: string; text: string }
  footnote: string
}

// ======================= 在床/离床事件（医保局监管报告核心口径） =======================
// 由在床监测流 isBed 跳变实算：最近离床时刻、最近（重新）在床时刻、当前状态持续起点。
const bedEvents = computed(() => {
  const pts = realBedStreamPoints.value
  let lastOffAt = '' // 最近一次 在床→离床 跳变时刻
  let lastOnAt = '' // 最近一次 离床→在床 跳变时刻
  let prev: boolean | null = null
  for (const p of pts) {
    const cur = !!p.isBed
    if (prev !== null && cur !== prev) {
      const t = String(p.created_at).replace('T', ' ').slice(5, 16)
      if (cur) lastOnAt = t
      else lastOffAt = t
    }
    prev = cur
  }
  // 当前状态持续起点 = 最后一次跳变时刻；窗内无跳变则以流起点计
  let sinceAt = ''
  if (prev !== null) {
    const lastTrans = prev ? lastOnAt : lastOffAt
    sinceAt = lastTrans || String(pts[0]?.created_at || '').replace('T', ' ').slice(5, 16)
  }
  return { lastOffAt, lastOnAt, sinceAt }
})

// 当前体动实时状态提示（解决无法直观获知当前体动状态的问题）
// 与 MOVE 卡片 Index 分离：「当前」只反映瞬时 body_movement（0/1），Index 反映在床体动水平
const currentMovementText = computed(() => {
  if (!rtLive.value) return '设备离线'
  if (rtPresence.value !== 'person') {
    const off = bedEvents.value.lastOffAt
    return off ? `离床（${off} 起）` : '离床未监护'
  }
  const bm = Number(realHwData.value?.body_movement) || 0
  if (bm > 0) return `微动活跃 (${holoMovement.value})`
  return holoMovement.value > 0 ? `平卧安稳 (指数 ${holoMovement.value})` : '平卧安稳 (强度 0)'
})

// 顶部中央：在床体动频次时序连续曲线
// 数据口径：在床监测窗（20:00 → 次日 08:00，云平台报告窗同口径），
// 由 daily_data(监测窗) ∪ today_data 的合并流驱动，跨零点曲线不中断、不清零
const actigraphyData = computed<ActigraphyResult>(() => {
  const slots = bedWindowHours.value
  const times = slots.map(s => s.label)
  const n = times.length
  const startX = 48
  const endX = 512
  const stepX = (endX - startX) / (n - 1)

  // 坐标映射：纵轴范围 0 ~ 15 次/小时，高度 86px (Y: 104 -> 18)
  const MAX_FREQ = 15
  const BASE_Y = 104
  const SPAN_Y = 86

  const hasRealStream = isRealHardware.value && realBedStreamPoints.value.length > 50

  const pts: ActigraphyPoint[] = slots.map((s, i) => {
    const x = startX + i * stepX
    const freq = Math.min(MAX_FREQ - 0.2, Number((hasRealStream ? s.moveFreq : 0).toFixed(1)))
    const y = BASE_Y - (freq / MAX_FREQ) * SPAN_Y
    return { time: s.label, x, y, val: freq }
  })

  const linePath = buildSmoothPath(pts)
  const areaPath = `${linePath} L ${endX.toFixed(1)} ${BASE_Y} L ${startX.toFixed(1)} ${BASE_Y} Z`

  // 筛选主要翻身与体动波峰事件 (频次 >= 4.0 且为局部极大值)
  const peakPoints: ActigraphyPeak[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].val >= 4.0 && pts[i].val >= pts[i - 1].val && pts[i].val >= pts[i + 1].val) {
      const v = pts[i].val
      const label = `${pts[i].time} ${v >= 8 ? '翻身微动' : '体位微调'} (体动 ${v.toFixed(1)}次/h)`
      peakPoints.push({
        time: pts[i].time,
        x: pts[i].x,
        y: pts[i].y,
        val: v,
        peakLabel: label,
      })
    }
  }

  // 7个刻度: 20:00, 22:00, 00:00, 02:00, 04:00, 06:00, 08:00
  const xTicks = [0, 2, 4, 6, 8, 10, 12].map(idx => ({
    time: times[idx],
    x: startX + idx * stepX,
  }))

  // 平卧安稳区：≤ 5 次/h (高度 5/15 * 86 = 28.7px)
  const safeH = (5 / MAX_FREQ) * SPAN_Y
  const safeBand = { x: startX, y: BASE_Y - safeH, w: endX - startX, h: safeH }

  const activeHours = slots.filter(p => p.count > 0 || p.inBed)
  const avgFreq = activeHours.length
    ? Number((activeHours.reduce((s, p) => s + p.moveFreq, 0) / activeHours.length).toFixed(1))
    : 0

  const totalTurns = peakPoints.length
  const totalMovements = slots.reduce((s, p) => s + p.moveFreq, 0)

  // 药丸状态判定：均值 ≤5 次/h 正确指示平卧安稳，不再被单次瞬时跳变误报偏高
  const pill = !hasRealStream
    ? { cls: 's3-status-pill s3-pill-cyan', icon: '●', text: '数据同步中' }
    : avgFreq > 8.0
    ? { cls: 's3-status-pill s3-pill-red', icon: '⚠', text: `体动偏频繁 · 均值 ${avgFreq} 次/h` }
    : avgFreq > 5.0
    ? { cls: 's3-status-pill s3-pill-amber', icon: '⚡', text: `体动平稳 · 均值 ${avgFreq} 次/h` }
    : { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: `平卧安稳 · 均值 ${avgFreq} 次/h` }

  const footnote = hasRealStream
    ? `在床体动累计 ${totalMovements} 次 · 平均体动指数 ${avgFreq} 次/h · 翻身微调 ${totalTurns} 次 · 在床监测窗 20:00-08:00`
    : '体征数据感知中 · 正在连续统计在床体动'

  return {
    linePath,
    areaPath,
    points: pts,
    peakPoints,
    xTicks,
    safeBand,
    pill,
    footnote,
  }
})

// ======================= 交互：步进 / 选择 / 键盘 / 点击外部 =======================
function stepPatient(direction: 'prev' | 'next') {
  const items = genericItems.value
  if (!items.length) return
  let idx = items.findIndex(i => i.patientId === (gCurrent.value?.patientId ?? ''))
  if (idx < 0) idx = 0
  idx = direction === 'prev' ? (idx <= 0 ? items.length - 1 : idx - 1) : (idx + 1) % items.length
  currentId.value = items[idx].patientId
}

function selectPatient(id: string) {
  currentId.value = id
  dropdownOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (!props.active) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
  if (e.key === 'ArrowLeft') stepPatient('prev')
  if (e.key === 'ArrowRight') stepPatient('next')
}

function onDocClick(e: MouseEvent) {
  const panel = document.getElementById('s3-dropdown-panel')
  const btn = document.getElementById('s3-patient-select-btn')
  if (dropdownOpen.value && panel && btn && !panel.contains(e.target as Node) && !btn.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

watch(() => props.patientId, (v) => {
  if (!v) return
  const hit = genericItems.value.find(i => i.patientId === v) ?? genericItems.value.find(i => i.id === v)
  if (hit) currentId.value = hit.patientId
})

watch(() => props.orgId, () => {
  dropdownOpen.value = false
  searchQ.value = ''
  searchQDebounced.value = ''
  ddCategory.value = 'all'
  ddStatus.value = 'all'
  ddGroup.value = ''
  ddSort.value = 'default'
  ddPage.value = 1
  genericItems.value = buildGenericItems()
  const hit = genericItems.value.find(i => i.patientId === props.patientId)
    ?? genericItems.value.find(i => i.id === props.patientId)
    ?? genericItems.value[0]
  if (hit) currentId.value = hit.patientId
  if (isRealHardware.value && realDeviceId.value) {
    void loadRealHardwareData(realDeviceId.value)
  }
})

watch(() => props.active, (act) => {
  if (act && isRealHardware.value && realDeviceId.value && !realHwData.value) {
    void loadRealHardwareData(realDeviceId.value)
  }
})

watch(dropdownOpen, (v) => {
  if (v) searchQ.value = ''
})

// ======================= 真实硬件生理体征（心率与在床节律）计算 =======================
// 今日平均心率
const todayAvgHr = computed(() => {
  if (realSleepStats.value?.hr_avg) return realSleepStats.value.hr_avg
  const valid = realTodayAgg.value.filter(p => p.hr > 0)
  if (!valid.length) return holoHr.value || 0
  const sum = valid.reduce((acc, p) => acc + p.hr, 0)
  return Math.round(sum / valid.length)
})

// 今日在床监测小时数
const inBedHours = computed(() => {
  return realTodayAgg.value.filter(p => p.inBed || p.count > 0).length
})

// 心率时序折线 (viewBox 0 0 440 180, X: 45~413, Y: 0~120 bpm, yBottom=150, yTop=25)
const realTodayHrPolyline = computed(() => {
  if (!realTodayAgg.value.length) return ''
  const valid = realTodayAgg.value.filter(p => p.hr > 0)
  if (!valid.length) return ''
  return valid.map(p => {
    const h = parseInt(p.hour, 10)
    const x = 45 + h * 16
    const y = 150 - (Math.min(120, p.hr) / 120) * 125
    return `${x},${y.toFixed(1)}`
  }).join(' ')
})

// 心率渐变面积路径
const realTodayHrAreaPath = computed(() => {
  if (!realTodayAgg.value.length) return ''
  const valid = realTodayAgg.value.filter(p => p.hr > 0)
  if (!valid.length) return ''
  const pts = valid.map(p => {
    const h = parseInt(p.hour, 10)
    const x = 45 + h * 16
    const y = 150 - (Math.min(120, p.hr) / 120) * 125
    return { x, y }
  })
  const startX = pts[0].x
  const endX = pts[pts.length - 1].x
  let line = `M ${pts[0].x} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    line += ` L ${pts[i].x} ${pts[i].y.toFixed(1)}`
  }
  return `${line} L ${endX} 150 L ${startX} 150 Z`
})

// ======================= 静卧体温（采集通道 · 补缺） =======================
// 口径：平卧/静卧状态下的体表温度感知，非临床诊断；范围映射 35~40℃
const todayAvgTp = computed(() => {
  if (realSleepStats.value?.tp_avg) return Number(realSleepStats.value.tp_avg.toFixed(1))
  const valid = realTodayAgg.value.filter(p => p.tp >= 30 && p.tp <= 45)
  if (!valid.length) return holoTp.value || 0
  const sum = valid.reduce((acc, p) => acc + p.tp, 0)
  return Number((sum / valid.length).toFixed(1))
})

const tpStats = computed(() => {
  const valid = realTodayAgg.value.filter(p => p.tp >= 30 && p.tp <= 45)
  if (!valid.length) return { min: 0, max: 0, abnHours: 0 }
  let min = valid[0].tp
  let max = valid[0].tp
  let abnHours = 0
  for (const p of valid) {
    if (p.tp < min) min = p.tp
    if (p.tp > max) max = p.tp
    if (p.tp >= 37.5 || p.tp < 35.5) abnHours++
  }
  return { min: Number(min.toFixed(1)), max: Number(max.toFixed(1)), abnHours }
})

function tpToY(tp: number): number {
  const clamped = Math.min(40, Math.max(35, tp))
  return 150 - ((clamped - 35) / 5) * 125
}

const realTodayTpPolyline = computed(() => {
  const valid = realTodayAgg.value.filter(p => p.tp >= 30 && p.tp <= 45)
  if (!valid.length) return ''
  return valid.map(p => {
    const h = parseInt(p.hour, 10)
    const x = 45 + h * 16
    return `${x},${tpToY(p.tp).toFixed(1)}`
  }).join(' ')
})

const realTodayTpAreaPath = computed(() => {
  const valid = realTodayAgg.value.filter(p => p.tp >= 30 && p.tp <= 45)
  if (!valid.length) return ''
  const pts = valid.map(p => {
    const h = parseInt(p.hour, 10)
    return { x: 45 + h * 16, y: tpToY(p.tp) }
  })
  const startX = pts[0].x
  const endX = pts[pts.length - 1].x
  let line = `M ${pts[0].x} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    line += ` L ${pts[i].x} ${pts[i].y.toFixed(1)}`
  }
  return `${line} L ${endX} 150 L ${startX} 150 Z`
})

const temperaturePill = computed(() => {
  if (!rtLive.value) return { cls: 's3-pill-mute', icon: '○', text: '设备离线' }
  if (rtPresence.value === 'empty') return { cls: 's3-pill-amber', icon: '‖', text: '离床 · 暂停' }
  if (!rtHasSample.value) return { cls: 's3-pill-mute', icon: '○', text: '等待体征' }
  const tp = holoTp.value
  if (tp <= 0) return { cls: 's3-pill-mute', icon: '○', text: '等待体征' }
  if (tp >= 38) return { cls: 's3-pill-red', icon: '⚠', text: `${tp.toFixed(1)}℃` }
  if (tp > 37.2) return { cls: 's3-pill-amber', icon: '⚡', text: `${tp.toFixed(1)}℃` }
  if (tp < 35.5) return { cls: 's3-pill-amber', icon: '⚡', text: `${tp.toFixed(1)}℃` }
  return { cls: 's3-pill-cyan', icon: '●', text: `${tp.toFixed(1)}℃` }
})

// ======================= 监测窗客观摘要（assessment_snapshot.metrics 口径） =======================
// 仅客观计数/比率；conclusion 恒不写入定级或待遇判断
const hrAbnormalHours = computed(() =>
  realTodayAgg.value.filter(p => p.hr > 0 && (p.hr > 100 || p.hr < 50)).length,
)

const fallEventCount = computed(() =>
  realAlarms.value.filter(a => a.device_id === realDeviceId.value && a.alert_type === 'fall').length,
)

const offBedEventCount = computed(() => {
  const fromReport = realSleepStats.value?.sleepReport?.out_of_bed_count
  if (fromReport != null) return fromReport
  const pts = realBedStreamPoints.value
  let cnt = 0
  let prev: boolean | null = null
  for (const p of pts) {
    const cur = !!p.isBed
    if (prev === true && cur === false) cnt++
    prev = cur
  }
  return cnt
})

const windowCoveragePct = computed(() => {
  const total = bedWindowHours.value.length
  if (!total) return 0
  const covered = bedWindowHours.value.filter(s => s.count > 0).length
  return Math.round((covered / total) * 100)
})

const inBedRatePct = computed(() => {
  const slots = bedWindowHours.value.filter(s => s.count > 0)
  if (!slots.length) return 0
  const inCnt = slots.filter(s => s.inBed).length
  return Math.round((inCnt / slots.length) * 100)
})

// ======================= 评估辅助 · 核查线索（assistant_insight / risk_signal，不定级） =======================
// 红线：禁止输出 disability_level / 待遇结论；只给偏离提示与上门核查要点
interface RiskLine {
  level: 'med' | 'info'
  text: string
}

const assessmentHints = computed(() => {
  const risks: RiskLine[] = []
  const checklist: string[] = []
  const claimed = (ltciArchive.value.disabilityLevel || '').trim()
  const moveIdx = bedMovementIndex.value
  const offs = offBedEventCount.value
  const inRate = inBedRatePct.value

  // 等级对照：申报偏高而活动能力接近自理
  if (claimed && (claimed.includes('重') || claimed.includes('中')) && moveIdx > 5) {
    risks.push({
      level: 'med',
      text: `申报「${claimed}」，窗内体动指数 ${moveIdx} 次/h 高于平卧安稳阈值，活动能力与申报表述可能不一致，建议现场重点核实`,
    })
  }
  if (claimed && claimed.includes('重') && offs >= 3) {
    risks.push({
      level: 'med',
      text: `申报「${claimed}」，监测窗内离床 ${offs} 次，建议核实自主移动 / 如厕是否需他人协助`,
    })
  }
  if (claimed && claimed.includes('轻') && moveIdx > 0 && moveIdx <= 2 && inRate >= 85) {
    risks.push({
      level: 'info',
      text: `申报「${claimed}」，窗内体动极低且在床率 ${inRate}%，建议核实实际活动范围是否被低估或近期功能下降`,
    })
  }
  if (fallEventCount.value > 0) {
    risks.push({
      level: 'med',
      text: `窗内跌倒姿态事件 ${fallEventCount.value} 次（设备侧），建议现场核查跌倒风险与防护措施`,
    })
  }
  if (claimed && !risks.length) {
    risks.push({
      level: 'info',
      text: `已对照申报「${claimed}」与静卧活动指标，窗内未见明显等级偏离线索；仍须以现场量表与观察为准`,
    })
  }
  if (!claimed) {
    risks.push({
      level: 'info',
      text: '参保档案失能认定等级未获取，暂无法做申报等级对照；以下核查要点供上门准备使用',
    })
  }

  checklist.push(
    '自主翻身 / 坐起 / 下床是否需协助（对照体动与离床）',
    '床椅转移与如厕路径步态、下肢肌力现场测试',
    '夜间起夜是否需陪护，离床后能否自主返回',
    '进食、穿衣、便溺控制等自理项按量表逐项留证',
  )

  return {
    risks,
    checklist,
    disclaimer: '监测数据为评估辅助材料，失能等级以现场量表与评估结论为准',
  }
})

// ======================= 呼吸监测与呼吸骤停安全感知计算 =======================
// 呼吸骤停事件次数
const apneaCount = computed(() => {
  if (realSleepStats.value?.sleepReport?.apnea_count != null) {
    return realSleepStats.value.sleepReport.apnea_count
  }
  const brAlarms = realAlarms.value.filter(a => a.device_id === realDeviceId.value && a.alert_type === 'br')
  return brAlarms.length
})

// 最长暂停时长
const longestApneaSeconds = computed(() => {
  return realSleepStats.value?.sleepReport?.longest_apnea_seconds ?? 0
})

// 今日平均呼吸率
const todayAvgBr = computed(() => {
  if (realSleepStats.value?.br_avg) return realSleepStats.value.br_avg
  const valid = realTodayAgg.value.filter(p => p.br > 0)
  if (!valid.length) return holoBr.value || 16
  const sum = valid.reduce((acc, p) => acc + p.br, 0)
  return Math.round(sum / valid.length)
})

// 呼吸频率时序折线 (viewBox 0 0 440 180, X: 45~413, Y: 0~30 次/分, yBottom=150, yTop=25)
const realTodayBrPolyline = computed(() => {
  if (!realTodayAgg.value.length) return ''
  const valid = realTodayAgg.value.filter(p => p.br > 0)
  if (!valid.length) return ''
  return valid.map(p => {
    const h = parseInt(p.hour, 10)
    const x = 45 + h * 16
    const y = 150 - (Math.min(30, p.br) / 30) * 125
    return `${x},${y.toFixed(1)}`
  }).join(' ')
})

// 呼吸频率时序平滑面积路径
const realTodayBrAreaPath = computed(() => {
  if (!realTodayAgg.value.length) return ''
  const valid = realTodayAgg.value.filter(p => p.br > 0)
  if (!valid.length) return ''
  const pts = valid.map(p => {
    const h = parseInt(p.hour, 10)
    const x = 45 + h * 16
    const y = 150 - (Math.min(30, p.br) / 30) * 125
    return { x, y }
  })
  const startX = pts[0].x
  const endX = pts[pts.length - 1].x
  let line = `M ${pts[0].x} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    line += ` L ${pts[i].x} ${pts[i].y.toFixed(1)}`
  }
  return `${line} L ${endX} 150 L ${startX} 150 Z`
})

// 呼吸监测状态药丸
const respirationPill = computed(() => {
  if (!rtLive.value) {
    return { cls: 's3-pill-mute', icon: '○', text: '设备离线' }
  }
  if (rtPresence.value === 'empty') {
    return { cls: 's3-pill-amber', icon: '‖', text: '离床 · 暂停' }
  }
  if (!rtHasSample.value) {
    return { cls: 's3-pill-mute', icon: '○', text: '等待体征' }
  }
  if (apneaCount.value > 5) {
    return { cls: 's3-pill-red', icon: '⚠', text: `暂停 ${apneaCount.value} 次` }
  }
  if (apneaCount.value > 0) {
    return { cls: 's3-pill-amber', icon: '⚡', text: `暂停 ${apneaCount.value} 次` }
  }
  return { cls: 's3-pill-cyan', icon: '●', text: holoBr.value > 0 ? `当前 ${holoBr.value} 次/分` : '呼吸平稳' }
})

// 在床监测窗（20:00 → 次日 08:00）连续流加载：daily_data(监测窗) ∪ today_data 按采样时间合并去重。
// today_data 跨零点只剩当日零点后零头，在床监测曲线必须并入 daily_data，否则 00:00 后曲线与体动指数全部清零。
async function refreshBedStream(devId: string): Promise<void> {
  const { dateKey } = bedMonitorWindow()
  const [todayPts, dailyPts] = await Promise.all([
    getTodayRawData(devId).catch(e => { console.warn('hw today err', e); return [] as TodayRawDataPoint[] }),
    getDailyRawData(devId, dateKey).catch(e => { console.warn('hw daily err', e); return [] as TodayRawDataPoint[] }),
  ])
  realTodayRawPoints.value = todayPts || []
  realTodayAgg.value = aggregateTodayPoints(todayPts)
  const map = new Map<string, TodayRawDataPoint>()
  for (const p of [...(dailyPts || []), ...(todayPts || [])]) {
    const k = String(p?.created_at || '').replace(' ', 'T')
    if (k) map.set(k, p)
  }
  realBedStreamPoints.value = [...map.values()].sort((a, b) =>
    String(a.created_at).replace(' ', 'T').localeCompare(String(b.created_at).replace(' ', 'T')),
  )
}

async function loadRealHardwareData(devId: string) {
  if (!devId) return
  realHwLoading.value = true
  try {
    // 最新遥测（latest_data）由全局共享 store 5s 轮询统一维护，此处只加载今日时序/在床监测流/报告日期/告警/睡眠等重数据
    const streamPromise = refreshBedStream(devId)
    const datesPromise = getReportDates(devId).then(dates => {
      realReportDates.value = dates
      if (dates.length && !selectedReportDate.value) {
        selectedReportDate.value = dates[0]
      }
    }).catch(e => console.warn('hw dates err', e))
    const alarmPromise = getHardwareAlarms(devId, 1, 10).then(res => {
      realAlarms.value = (res.items || []).filter((a) => a.device_id === devId)
    }).catch(e => console.warn('hw alarms err', e))

    await Promise.allSettled([streamPromise, datesPromise, alarmPromise])

    if (selectedReportDate.value) {
      try {
        realSleepStats.value = await getSleepStats(devId, selectedReportDate.value)
      } catch (e) {
        console.warn('hw sleep err', e)
      }
    }
  } finally {
    realHwLoading.value = false
  }
}

// 在床监测流 60s 轻量刷新（屏幕激活时），曲线随时间连续生长
let bedStreamTimer = 0

watch(currentId, () => {
  if (isRealHardware.value && realDeviceId.value) {
    void loadRealHardwareData(realDeviceId.value)
  } else {
    realTodayRawPoints.value = []
    realTodayAgg.value = []
    realBedStreamPoints.value = []
    realSleepStats.value = null
  }
})

watch(selectedReportDate, async (newDate) => {
  if (!newDate || !isRealHardware.value || !realDeviceId.value) return
  try {
    realSleepStats.value = await getSleepStats(realDeviceId.value, newDate)
  } catch (e) {
    console.warn('hw date sleep err', e)
  }
})

onMounted(() => {
  void resolveDeviceIpGeo()
  genericItems.value = buildGenericItems()
  const hit = genericItems.value.find(i => i.patientId === props.patientId)
    ?? genericItems.value.find(i => i.id === props.patientId)
    ?? genericItems.value[0]
  if (hit) currentId.value = hit.patientId
  if (isRealHardware.value && realDeviceId.value) {
    void loadRealHardwareData(realDeviceId.value)
  }
  bedStreamTimer = window.setInterval(() => {
    if (props.active && isRealHardware.value && realDeviceId.value) {
      void refreshBedStream(realDeviceId.value)
    }
  }, 60_000)
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  window.clearInterval(bedStreamTimer)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="s3-cyber-floor-grid"><div class="s3-cyber-grid-plane"></div></div>
  <div class="s3-horizon-glow"></div>

  <div class="s3-top-control-bar">
    <div class="s3-search-zone">
      <span class="s3-search-title"><span class="marker"></span>数字画像</span>
      <span class="s3-profile-subtitle">静卧体征 · 失能评估辅助</span>
      <div class="s3-dropdown-wrapper">
        <button class="s3-dropdown-btn" id="s3-patient-select-btn" title="切换点位" @click.stop="dropdownOpen = !dropdownOpen">
          <span>{{ gDropdownLabel }}</span>
          <span class="s3-arrow" :style="{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }">▼</span>
        </button>
        <div class="s3-dropdown-panel" id="s3-dropdown-panel" :class="{ open: dropdownOpen }">
          <div class="s3-dropdown-search-box">
            <input type="text" v-model="searchQ" :placeholder="searchPlaceholder" autocomplete="off" @click.stop />
          </div>
          <div class="s3-dropdown-filter-tabs">
            <button v-for="t in ddTabs" :key="t.key" class="s3-tab" :class="{ active: ddCategory === t.key }" @click.stop="ddCategory = t.key">{{ t.label }} [{{ t.count }}]</button>
          </div>
          <div class="s3-chip-row">
            <button v-for="c in ddStatusChips" :key="c.key" class="s3-chip" :class="{ active: ddStatus === c.key }" @click.stop="ddStatus = c.key">{{ c.label }} [{{ c.count }}]</button>
          </div>
          <div class="s3-chip-row">
            <span class="s3-chip-group-label">群体</span>
            <button v-for="g in ddGroupChips" :key="g.key" class="s3-chip" :class="{ active: ddGroup === g.key }" @click.stop="ddGroup = ddGroup === g.key ? '' : g.key">{{ g.label }} [{{ g.count }}]</button>
            <select class="s3-sort-select" v-model="ddSort" @click.stop>
              <option value="default">默认 (在册序)</option>
              <option value="risk">告警优先</option>
              <option value="code">设备编号</option>
            </select>
          </div>
          <div class="s3-dropdown-items">
            <div v-if="ddPageRows.length === 0" style="text-align:center;padding:16px;font-size:12.5px;color:var(--txt-muted)">{{ emptyText }}</div>
            <div v-for="r in ddPageRows" :key="r.key" class="s3-item-row" :class="{ selected: r.key === currentId }" @click.stop="selectPatient(r.key)">
              <div class="s3-item-left">
                <span class="s3-item-bed">{{ r.code }}</span>
                <span class="s3-item-name">{{ r.name }}</span>
                <span class="s3-item-meta">{{ r.meta }}</span>
              </div>
              <span class="s3-item-badge" :class="r.isAlert ? 'warning' : 'normal'">{{ r.badge }}</span>
            </div>
          </div>
          <div v-if="ddPageCount > 1" class="s3-dd-pagination">
            <button class="s3-dd-page-btn" title="上一页" @click.stop="ddPage = Math.max(1, ddPage - 1)">◀</button>
            <span>{{ ddPage }}/{{ ddPageCount }} · 共 {{ ddSorted.length }} 台</span>
            <button class="s3-dd-page-btn" title="下一页" @click.stop="ddPage = Math.min(ddPageCount, ddPage + 1)">▶</button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div class="s3-main-grid" style="grid-template-rows: 350px 430px;">
    <!-- ======================= 左上：静卧心率（采集通道） ======================= -->
    <div class="s3-card" :class="{ 's3-card-hold': vitalsHold.on }" style="grid-column: 1; grid-row: 1;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isRealHardware ? '静卧心率' : gCardTitles.lt }}</span>
        </div>
        <div class="s3-legend-item" style="margin-left: auto;">
          <span style="display:inline-block; width:12px; height:2px; background:#00ffcc; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">心率 (bpm)</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 8px;">
          <span style="display:inline-block; width:10px; height:6px; background:rgba(0,255,200,0.18); border:1px dashed #00ffcc; border-radius:1px; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">正常范围 60-100</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 8px;">
          <span style="display:inline-block; width:10px; height:4px; background:#00d2ff; border-radius:1px; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">在床平卧</span>
        </div>
        <div class="s3-status-pill" :class="hrLivePill.cls" style="margin-left: 10px;">
          <span>{{ hrLivePill.icon }}</span>
          <span>{{ hrLivePill.text }}</span>
        </div>
      </div>
      <div class="s3-card-body">
        <div v-if="vitalsHold.on" class="s3-hold-banner" :class="'s3-hold-' + vitalsHold.tone">
          <span class="s3-hold-icon">{{ vitalsHold.tone === 'out' ? '‖' : '○' }}</span>
          <span class="s3-hold-text">{{ vitalsHold.text }}</span>
          <span class="s3-hold-sub">{{ vitalsHold.sub }}</span>
        </div>
        <!-- 真实设备：24小时连续微动生理时序图 (心率走势与全天在床时段) -->
        <svg v-if="isRealHardware && realTodayAgg.length" viewBox="0 0 440 185" width="100%" height="100%">
          <defs>
            <linearGradient id="hrAreaGradG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.25"/>
              <stop offset="60%" stop-color="#00ffcc" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="#00f0ff" stop-opacity="0.00"/>
            </linearGradient>
            <linearGradient id="hrLineGradG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#00d2ff"/>
              <stop offset="50%" stop-color="#00ffcc"/>
              <stop offset="100%" stop-color="#00f0ff"/>
            </linearGradient>
          </defs>

          <!-- 坐标轴单位 -->
          <text x="42" y="16" class="s3-axis-label" text-anchor="end" fill="var(--txt-muted)" font-size="8.5">bpm</text>

          <!-- Y 轴刻度与参考网格 -->
          <text x="42" y="29" class="s3-axis-label" text-anchor="end">120</text>
          <line x1="48" y1="25" x2="425" y2="25" class="s3-grid-dash"/>
          <text x="42" y="52" class="s3-axis-label" text-anchor="end">100</text>
          <line x1="48" y1="48" x2="425" y2="48" class="s3-grid-dash"/>
          <text x="42" y="76" class="s3-axis-label" text-anchor="end">80</text>
          <line x1="48" y1="72" x2="425" y2="72" class="s3-grid-dash"/>
          <text x="42" y="99" class="s3-axis-label" text-anchor="end">60</text>
          <line x1="48" y1="95" x2="425" y2="95" class="s3-grid-dash"/>
          <text x="42" y="122" class="s3-axis-label" text-anchor="end">40</text>
          <line x1="48" y1="118" x2="425" y2="118" class="s3-grid-dash"/>
          <text x="42" y="154" class="s3-axis-label" text-anchor="end">0</text>
          <line x1="48" y1="150" x2="425" y2="150" stroke="rgba(0,210,255,0.4)" stroke-width="1.2"/>

          <!-- 正常在床心率参考区间 (60 ~ 100 bpm) -->
          <rect x="48" y="48" width="377" height="47" fill="rgba(0,255,200,0.05)" stroke="rgba(0,255,200,0.22)" stroke-width="0.8" stroke-dasharray="3 3"/>
          <text x="420" y="62" fill="#00ffcc" font-size="9" text-anchor="end" opacity="0.6" font-family="var(--font-mono)">正常参考 (60-100 bpm)</text>

          <!-- 24h 全天在床时段感知带 (根据设备真实在床感知驱动，全天候有效) -->
          <g v-for="(pt, i) in realTodayAgg" :key="'bed'+i">
            <rect
              v-if="pt.inBed || pt.count > 0"
              :x="45 + i * 16 - 5"
              y="153"
              width="10"
              height="3"
              fill="#00d2ff"
              rx="1"
              opacity="0.85"
            >
              <title>{{ pt.hour }} 在床平卧感知 (均值心率: {{ pt.hr }} bpm)</title>
            </rect>
          </g>

          <!-- 心率渐变面积填充 -->
          <path
            v-if="realTodayHrAreaPath"
            :d="realTodayHrAreaPath"
            fill="url(#hrAreaGradG)"
          />

          <!-- 心率连续平滑曲线 -->
          <polyline
            v-if="realTodayHrPolyline"
            :points="realTodayHrPolyline"
            fill="none"
            stroke="url(#hrLineGradG)"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- 采样活跃点光标 -->
          <circle v-for="(pt, i) in realTodayAgg.filter(p => p.hr > 0)" :key="'hr'+i"
            :cx="45 + parseInt(pt.hour) * 16"
            :cy="150 - (Math.min(120, pt.hr) / 120) * 125"
            r="3.2"
            fill="#00ffcc"
            stroke="#071b2e"
            stroke-width="1.2"
          >
            <title>{{ pt.hour }} 心率: {{ pt.hr }} bpm (在床: {{ pt.inBed ? '是' : '否' }})</title>
          </circle>

          <!-- X 轴时间刻度 -->
          <text x="45" y="172" class="s3-axis-label" text-anchor="middle">00:00</text>
          <text x="109" y="172" class="s3-axis-label" text-anchor="middle">04:00</text>
          <text x="173" y="172" class="s3-axis-label" text-anchor="middle">08:00</text>
          <text x="237" y="172" class="s3-axis-label" text-anchor="middle">12:00</text>
          <text x="301" y="172" class="s3-axis-label" text-anchor="middle">16:00</text>
          <text x="365" y="172" class="s3-axis-label" text-anchor="middle">20:00</text>
          <text x="413" y="172" class="s3-axis-label" text-anchor="middle">24:00</text>
        </svg>

        <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
          <span style="font-size:22px">📡</span>
          <span style="font-size:12px;font-family:var(--font-mono)">{{ rtLive ? '在床体征监测中…' : rtArchiveNote }}</span>
        </div>
        <div class="s3-card-footnote">
          {{ rtLive ? `在床监测 ${inBedHours} 小时 · 静卧均值心率 ${todayAvgHr} bpm` : rtArchiveNote }}
        </div>
      </div>
    </div>

    <!-- ======================= 左下：静卧体温（采集通道 · 补缺） ======================= -->
    <div class="s3-card" :class="{ 's3-card-hold': vitalsHold.on }" style="grid-column: 1; grid-row: 2;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isRealHardware ? '静卧体温' : gCardTitles.lb }}</span>
        </div>
        <div class="s3-legend-item" style="margin-left: auto;">
          <span style="display:inline-block; width:12px; height:2px; background:#ffb703; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">体温 (℃)</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 8px;">
          <span style="display:inline-block; width:10px; height:6px; background:rgba(255,183,3,0.18); border:1px dashed #ffb703; border-radius:1px; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">平稳范围 36.0-37.2</span>
        </div>
        <div class="s3-status-pill" :class="temperaturePill.cls" style="margin-left: 10px;">
          <span>{{ temperaturePill.icon }}</span>
          <span>{{ temperaturePill.text }}</span>
        </div>
      </div>
      <div class="s3-card-body">
        <div v-if="vitalsHold.on" class="s3-hold-banner" :class="'s3-hold-' + vitalsHold.tone">
          <span class="s3-hold-icon">{{ vitalsHold.tone === 'out' ? '‖' : '○' }}</span>
          <span class="s3-hold-text">{{ vitalsHold.text }}</span>
          <span class="s3-hold-sub">{{ vitalsHold.sub }}</span>
        </div>
        <div class="s3-hw-stat-grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 4px;">
          <div class="s3-hw-cell" style="padding: 6px 8px;">
            <span class="lbl">实时体温</span>
            <span class="val" :class="vitalsHold.on ? '' : 'amber'" style="font-size: 18px;">{{ vitalsLive && holoTp > 0 ? holoTp.toFixed(1) : '--' }}<small style="font-size: 10px;">℃</small></span>
            <span class="sub">{{ vitalsHold.on ? vitalsHold.text : '在床采集' }}</span>
          </div>
          <div class="s3-hw-cell" style="padding: 6px 8px;">
            <span class="lbl">窗内均值</span>
            <span class="val cyan" style="font-size: 18px;">{{ todayAvgTp > 0 ? todayAvgTp.toFixed(1) : '--' }}<small style="font-size: 10px;">℃</small></span>
            <span class="sub">今日/监测窗</span>
          </div>
          <div class="s3-hw-cell" style="padding: 6px 8px;">
            <span class="lbl">最低 / 最高</span>
            <span class="val" style="font-size: 14px; color: #fff;">{{ tpStats.min > 0 ? tpStats.min.toFixed(1) : '--' }} / {{ tpStats.max > 0 ? tpStats.max.toFixed(1) : '--' }}</span>
            <span class="sub">℃</span>
          </div>
          <div class="s3-hw-cell" style="padding: 6px 8px;" :style="tpStats.abnHours > 0 ? { borderColor: 'rgba(255,170,0,0.5)', background: 'rgba(255,170,0,0.08)' } : {}">
            <span class="lbl">偏离时段</span>
            <span class="val" :class="tpStats.abnHours > 0 ? 'amber' : 'mint'" style="font-size: 18px;">{{ tpStats.abnHours }}<small style="font-size: 10px;">h</small></span>
            <span class="sub">&lt;35.5 或 ≥37.5</span>
          </div>
        </div>

        <svg v-if="isRealHardware && realTodayAgg.length && realTodayTpPolyline" viewBox="0 0 440 185" width="100%" height="100%">
          <defs>
            <linearGradient id="tpAreaGradG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffb703" stop-opacity="0.28"/>
              <stop offset="60%" stop-color="#ff9e00" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="#ffb703" stop-opacity="0.00"/>
            </linearGradient>
            <linearGradient id="tpLineGradG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#ffb703"/>
              <stop offset="50%" stop-color="#ffe066"/>
              <stop offset="100%" stop-color="#ff9e00"/>
            </linearGradient>
          </defs>

          <text x="42" y="16" class="s3-axis-label" text-anchor="end" fill="var(--txt-muted)" font-size="8.5">℃</text>
          <text x="42" y="29" class="s3-axis-label" text-anchor="end">40</text>
          <line x1="48" y1="25" x2="425" y2="25" class="s3-grid-dash"/>
          <text x="42" y="52" class="s3-axis-label" text-anchor="end">38</text>
          <line x1="48" y1="48" x2="425" y2="48" class="s3-grid-dash"/>
          <text x="42" y="76" class="s3-axis-label" text-anchor="end">37</text>
          <line x1="48" y1="72" x2="425" y2="72" class="s3-grid-dash"/>
          <text x="42" y="99" class="s3-axis-label" text-anchor="end">36</text>
          <line x1="48" y1="95" x2="425" y2="95" class="s3-grid-dash"/>
          <text x="42" y="122" class="s3-axis-label" text-anchor="end">35</text>
          <line x1="48" y1="118" x2="425" y2="118" class="s3-grid-dash"/>
          <line x1="48" y1="150" x2="425" y2="150" stroke="rgba(255,183,3,0.35)" stroke-width="1.2"/>

          <!-- 平稳参考带 36.0 ~ 37.2℃ -->
          <rect x="48" :y="tpToY(37.2)" width="377" :height="tpToY(36.0) - tpToY(37.2)" fill="rgba(255,183,3,0.06)" stroke="rgba(255,183,3,0.25)" stroke-width="0.8" stroke-dasharray="3 3"/>
          <text x="420" :y="tpToY(37.2) - 4" fill="#ffb703" font-size="9" text-anchor="end" opacity="0.65" font-family="var(--font-mono)">平稳参考 36.0-37.2℃</text>

          <path v-if="realTodayTpAreaPath" :d="realTodayTpAreaPath" fill="url(#tpAreaGradG)" />
          <polyline
            v-if="realTodayTpPolyline"
            :points="realTodayTpPolyline"
            fill="none"
            stroke="url(#tpLineGradG)"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <circle v-for="(pt, i) in realTodayAgg.filter(p => p.tp >= 30 && p.tp <= 45)" :key="'tp'+i"
            :cx="45 + parseInt(pt.hour) * 16"
            :cy="tpToY(pt.tp)"
            r="3"
            fill="#ffb703"
            stroke="#071b2e"
            stroke-width="1.2"
          >
            <title>{{ pt.hour }} 体温: {{ pt.tp.toFixed(1) }}℃</title>
          </circle>

          <text x="45" y="172" class="s3-axis-label" text-anchor="middle">00:00</text>
          <text x="109" y="172" class="s3-axis-label" text-anchor="middle">04:00</text>
          <text x="173" y="172" class="s3-axis-label" text-anchor="middle">08:00</text>
          <text x="237" y="172" class="s3-axis-label" text-anchor="middle">12:00</text>
          <text x="301" y="172" class="s3-axis-label" text-anchor="middle">16:00</text>
          <text x="365" y="172" class="s3-axis-label" text-anchor="middle">20:00</text>
          <text x="413" y="172" class="s3-axis-label" text-anchor="middle">24:00</text>
        </svg>

        <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
          <span style="font-size:22px">🌡</span>
          <span style="font-size:12px;font-family:var(--font-mono)">{{ rtLive ? '静卧测温采集中…' : rtArchiveNote }}</span>
        </div>
        <div class="s3-card-footnote">
          {{ rtLive ? `静卧体温连续采集 · 均值 ${todayAvgTp > 0 ? todayAvgTp.toFixed(1) : '--'}℃` : '设备离线 · 暂无体温数据' }}
        </div>
      </div>
    </div>

    <!-- ======================= 中上：静卧体动 · 在床节律（活动能力代理 · 核心） ======================= -->
    <div class="s3-card s3-center-top-card">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">{{ isRealHardware ? '静卧体动 · 在床节律' : gCardTitles.mt }}</span></div>
        <div :class="actigraphyData.pill.cls"><span>{{ rtLive ? actigraphyData.pill.icon : '○' }}</span> <span>{{ rtLive ? actigraphyData.pill.text : rtArchiveNote }}</span></div>
        <div class="s3-legend-item" style="margin-left: 12px;">
          <span style="display:inline-block; width:7px; height:7px; background:#00ffcc; border-radius:50%; box-shadow:0 0 5px #00ffcc; vertical-align:middle;"></span>
          <span style="font-size: 11.5px; color: var(--cyan); margin-left: 4px; font-weight: 600;">当前: {{ currentMovementText }}</span>
        </div>
        <div class="s3-legend-item" style="margin-left: auto;">
          <span style="display:inline-block; width:12px; height:6px; background:rgba(0,255,170,0.18); border:1px dashed #00ffaa; border-radius:1px; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">安稳范围 (≤5次/h)</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 10px;">
          <span style="display:inline-block; width:6px; height:6px; background:#00ffcc; border-radius:50%; box-shadow:0 0 4px #00ffcc; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">翻身频点</span>
        </div>
      </div>
      <div class="s3-card-body">
        <svg v-if="isRealHardware" viewBox="0 0 540 140" width="100%" height="100%">
          <defs>
            <linearGradient id="actigraphyAreaGradG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.28" />
              <stop offset="65%" stop-color="#00a8ff" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#0055ff" stop-opacity="0.00" />
            </linearGradient>
            <linearGradient id="actigraphyLineGradG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#00d2ff" />
              <stop offset="50%" stop-color="#00ffcc" />
              <stop offset="100%" stop-color="#00f0ff" />
            </linearGradient>
          </defs>

          <!-- Y 轴刻度与背景网格 (0 ~ 15 次/小时) -->
          <text x="44" y="11" class="s3-axis-label" text-anchor="end" fill="var(--txt-muted)" font-size="8.5">次/h</text>
          <text x="42" y="21" class="s3-axis-label" text-anchor="end">15</text>
          <line x1="48" y1="18" x2="512" y2="18" class="s3-grid-dash" />
          <text x="42" y="50" class="s3-axis-label" text-anchor="end">10</text>
          <line x1="48" y1="46.7" x2="512" y2="46.7" class="s3-grid-dash" />
          <text x="42" y="78" class="s3-axis-label" text-anchor="end">5</text>
          <line x1="48" y1="75.3" x2="512" y2="75.3" class="s3-grid-dash" />
          <text x="42" y="107" class="s3-axis-label" text-anchor="end">0</text>
          <line x1="48" y1="104" x2="512" y2="104" stroke="rgba(0,210,255,0.4)" stroke-width="1.2" />

          <!-- 平卧安稳安全带 (≤5次/h) -->
          <rect :x="actigraphyData.safeBand.x" :y="actigraphyData.safeBand.y" :width="actigraphyData.safeBand.w" :height="actigraphyData.safeBand.h" fill="rgba(0, 255, 170, 0.05)" stroke="rgba(0, 255, 170, 0.25)" stroke-width="0.8" stroke-dasharray="3 3" />
          <text x="506" y="93" fill="#00ffaa" font-size="9.5" text-anchor="end" opacity="0.65" font-family="var(--font-mono)">平卧安稳区 (≤5次/h)</text>

          <!-- 体动频次渐变面积填充 -->
          <path :d="actigraphyData.areaPath" fill="url(#actigraphyAreaGradG)" />

          <!-- 体动频次平滑折线 -->
          <path :d="actigraphyData.linePath" fill="none" stroke="url(#actigraphyLineGradG)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

          <!-- 翻身波峰事件点与微标签 -->
          <g v-for="(pk, idx) in actigraphyData.peakPoints" :key="idx" class="s3-peak-pin">
            <circle :cx="pk.x.toFixed(1)" :cy="pk.y.toFixed(1)" r="5.5" fill="none" :stroke="pk.val >= 8 ? '#ffaa00' : '#00f0ff'" stroke-width="1.2" opacity="0.85">
              <animate attributeName="r" values="4;8;4" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0.2;0.9" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle :cx="pk.x.toFixed(1)" :cy="pk.y.toFixed(1)" r="2.8" :fill="pk.val >= 8 ? '#ffb703' : '#00ffcc'" />
            <text :x="pk.x.toFixed(1)" :y="(pk.y - 7).toFixed(1)" class="s3-axis-label" text-anchor="middle" :style="{ fill: pk.val >= 8 ? '#ffb703' : '#9be9ff', fontSize: '9px' }">
              {{ pk.time }}
            </text>
            <title>{{ pk.peakLabel }}</title>
          </g>

          <!-- X 轴时间刻度 -->
          <text v-for="t in actigraphyData.xTicks" :key="t.time" :x="t.x.toFixed(1)" y="119" class="s3-axis-label" text-anchor="middle">
            {{ t.time }}
          </text>
        </svg>
        <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
          <span style="font-size:22px">📈</span>
          <span style="font-size:12px;font-family:var(--font-mono)">在册归档 · 暂无实时数据</span>
        </div>
        <div class="s3-card-footnote">{{ rtLive ? actigraphyData.footnote : rtArchiveNote }}</div>
      </div>
    </div>

    <!-- ======================= 中央全息舞台 ======================= -->
    <div class="s3-center-stage">
      <div class="s3-stage-box">
        <div class="s3-sysbar" role="tablist" aria-label="系统监测层">
          <button v-for="s in SYSTEM_CHIPS" :key="s.key" role="tab" :aria-selected="activeSystem === s.key"
            class="s3-sysbar-chip" :class="{ active: activeSystem === s.key }" @click="selectSystem(s.key)">
            <span class="s3-sysbar-dot"></span>{{ s.label }}
          </button>
        </div>

        <MedicalHologramFigure v-if="active" :live="vitalsLive" :alert="holoAlert" :heart-cycle="gHeartCycle" :breathe-cycle="gBreatheCycle" variant="sensor"
          :active-system="activeSystem" @select="selectSystem" />

        <HoloChannelsOverlay
          v-if="vitalsLive"
          :hr="holoHr" :br="holoBr" :tp="holoTp" :movement="holoMovement"
          :alert="holoAlert" :heart-cycle="holoHeartCycle" :breathe-cycle="holoBreatheCycle"
          bed-state="in"
          :bed-since="bedEvents.sinceAt" :bed-last-off="bedEvents.lastOffAt" :bed-last-on="bedEvents.lastOnAt"
        />

        <!-- 非在床有效体征：通道挂起，不渲染体征数值与搏动 -->
        <div v-if="vitalsHold.on" style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:8;text-align:center;color:#ffb703;font-family:var(--font-mono);font-size:13px;line-height:1.8;background:rgba(6,18,32,0.82);border:1px dashed rgba(255,183,3,0.55);border-radius:6px;padding:12px 20px;">
          {{ vitalsHold.text }}<br/><span style="font-size:11px;color:var(--txt-secondary)">{{ vitalsHold.sub }}</span>
        </div>

        <div class="s3-sys-info" v-if="activeSystem !== 'all'">
          <b>{{ sysInfo.name }}</b><span>{{ sysInfo.desc }}</span>
        </div>

        <div class="s3-dyn-pedestal-label">
          <div class="s3-pedestal-line1">{{ gPedestalTop }}</div>
          <div class="s3-pedestal-line2">
            <span class="s3-pedestal-sn">{{ gPedestalBottom }}</span>
            <span :class="archiveStatusTag.cls" :title="archiveStatusTag.hint">{{ archiveStatusTag.text }}</span>
          </div>
        </div>

        <div class="s3-dyn-pager-wrap">
          <button class="s3-dyn-pager-arrow" title="上一项" @click="stepPatient('prev')">◀</button>
          <span class="s3-dyn-pager-num">{{ gPagerText }}</span>
          <button class="s3-dyn-pager-arrow" title="下一项" @click="stepPatient('next')">▶</button>
        </div>
      </div>
    </div>

    <!-- ======================= 右上：静卧呼吸（采集通道） ======================= -->
    <div class="s3-card" :class="{ 's3-card-hold': vitalsHold.on }" style="grid-column: 3; grid-row: 1;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isRealHardware ? '静卧呼吸' : gCardTitles.rt }}</span>
        </div>
        <div class="s3-legend-item" style="margin-left: auto;">
          <span style="display:inline-block; width:12px; height:2px; background:#00ffaa; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">呼吸率 (次/分)</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 8px;">
          <span style="display:inline-block; width:10px; height:6px; background:rgba(0,255,170,0.18); border:1px dashed #00ffaa; border-radius:1px; vertical-align:middle;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">正常范围 12-20</span>
        </div>
        <div class="s3-status-pill" :class="respirationPill.cls" style="margin-left: 10px;">
          <span>{{ respirationPill.icon }}</span>
          <span>{{ respirationPill.text }}</span>
        </div>
      </div>
      <div class="s3-card-body" style="padding: 10px 14px 8px 14px; gap: 8px;">
        <div v-if="vitalsHold.on" class="s3-hold-banner" :class="'s3-hold-' + vitalsHold.tone">
          <span class="s3-hold-icon">{{ vitalsHold.tone === 'out' ? '‖' : '○' }}</span>
          <span class="s3-hold-text">{{ vitalsHold.text }}</span>
          <span class="s3-hold-sub">{{ vitalsHold.sub }}</span>
        </div>
        <!-- 呼吸骤停监测与呼吸健康面板 -->
        <div class="s3-hw-stat-grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 2px;">
          <div class="s3-hw-cell" style="padding: 6px 8px;">
            <span class="lbl">静卧呼吸率</span>
            <span class="val" :class="vitalsHold.on ? '' : 'mint'" style="font-size: 18px;">{{ vitalsLive && holoBr > 0 ? holoBr : '--' }}<small style="font-size: 10px;">次/分</small></span>
            <span class="sub" style="font-size: 9.5px;">{{ vitalsHold.on ? vitalsHold.text : '正常 12-20' }}</span>
          </div>
          <div class="s3-hw-cell" style="padding: 6px 8px;" :style="apneaCount > 0 ? { borderColor: 'rgba(255,170,0,0.5)', background: 'rgba(255,170,0,0.08)' } : {}">
            <span class="lbl">呼吸暂停</span>
            <span class="val" :class="apneaCount > 5 ? 'red' : apneaCount > 0 ? 'amber' : 'cyan'" style="font-size: 18px;">{{ apneaCount }}<small style="font-size: 10px;">次</small></span>
            <span class="sub" :style="apneaCount > 0 ? { color: 'var(--amber)' } : {}" style="font-size: 9.5px;">{{ apneaCount > 0 ? '有暂停记录' : '未见暂停' }}</span>
          </div>
          <div class="s3-hw-cell" style="padding: 6px 8px;">
            <span class="lbl">最长暂停</span>
            <span class="val cyan" style="font-size: 18px;">{{ longestApneaSeconds }}<small style="font-size: 10px;">s</small></span>
            <span class="sub" style="font-size: 9.5px;">时长峰值</span>
          </div>
          <div class="s3-hw-cell" style="padding: 6px 8px;">
            <span class="lbl">窗内均值</span>
            <span class="val mint" style="font-size: 18px;">{{ todayAvgBr }}<small style="font-size: 10px;">次/分</small></span>
            <span class="sub" style="font-size: 9.5px;">静卧呼吸</span>
          </div>
        </div>

        <!-- 呼吸频率全天时序连续折线图 -->
        <div style="flex: 1; min-height: 0; position: relative;">
          <svg v-if="isRealHardware && realTodayAgg.length" viewBox="0 0 440 135" width="100%" height="100%">
            <defs>
              <linearGradient id="brAreaGradG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00ffaa" stop-opacity="0.25"/>
                <stop offset="60%" stop-color="#00f0ff" stop-opacity="0.08"/>
                <stop offset="100%" stop-color="#00ffaa" stop-opacity="0.00"/>
              </linearGradient>
              <linearGradient id="brLineGradG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#00f0ff"/>
                <stop offset="50%" stop-color="#00ffaa"/>
                <stop offset="100%" stop-color="#00ffcc"/>
              </linearGradient>
            </defs>

            <!-- 坐标轴单位 -->
            <text x="42" y="14" class="s3-axis-label" text-anchor="end" fill="var(--txt-muted)" font-size="8.5">次/分</text>

            <!-- Y 轴刻度与网格 -->
            <text x="42" y="24" class="s3-axis-label" text-anchor="end">30</text>
            <line x1="48" y1="20" x2="425" y2="20" class="s3-grid-dash"/>
            <text x="42" y="47" class="s3-axis-label" text-anchor="end">20</text>
            <line x1="48" y1="43" x2="425" y2="43" class="s3-grid-dash"/>
            <text x="42" y="69" class="s3-axis-label" text-anchor="end">15</text>
            <line x1="48" y1="65" x2="425" y2="65" class="s3-grid-dash"/>
            <text x="42" y="90" class="s3-axis-label" text-anchor="end">10</text>
            <line x1="48" y1="86" x2="425" y2="86" class="s3-grid-dash"/>
            <text x="42" y="112" class="s3-axis-label" text-anchor="end">0</text>
            <line x1="48" y1="108" x2="425" y2="108" stroke="rgba(0,210,255,0.4)" stroke-width="1.2"/>

            <!-- 正常呼吸频率基线带 (12 ~ 20 次/分) -->
            <rect x="48" y="43" width="377" height="35" fill="rgba(0,255,170,0.06)" stroke="rgba(0,255,170,0.25)" stroke-width="0.8" stroke-dasharray="3 3"/>
            <text x="420" y="55" fill="#00ffaa" font-size="9" text-anchor="end" opacity="0.75" font-family="var(--font-mono)">正常范围 (12-20次/分)</text>

            <!-- 呼吸频率渐变面积 -->
            <path
              v-if="realTodayBrAreaPath"
              :d="realTodayBrAreaPath"
              fill="url(#brAreaGradG)"
            />

            <!-- 呼吸频率平滑折线 -->
            <polyline
              v-if="realTodayBrPolyline"
              :points="realTodayBrPolyline"
              fill="none"
              stroke="url(#brLineGradG)"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- 采样活跃呼吸点 -->
            <circle v-for="(pt, i) in realTodayAgg.filter(p => p.br > 0)" :key="'brpt'+i"
              :cx="45 + parseInt(pt.hour) * 16"
              :cy="150 - (Math.min(30, pt.br) / 30) * 125"
              r="3"
              fill="#00ffaa"
              stroke="#071b2e"
              stroke-width="1.2"
            >
              <title>{{ pt.hour }} 呼吸频率: {{ pt.br }} 次/分 (在床均值)</title>
            </circle>

            <!-- 呼吸骤停无风险状态指示 -->
            <text v-if="apneaCount === 0" x="52" y="32" fill="#00ffaa" font-size="9.5" opacity="0.85" font-family="var(--font-mono)">
              ● 未检出呼吸暂停事件
            </text>

            <!-- X 轴时间刻度 -->
            <text x="45" y="125" class="s3-axis-label" text-anchor="middle">00:00</text>
            <text x="109" y="125" class="s3-axis-label" text-anchor="middle">04:00</text>
            <text x="173" y="125" class="s3-axis-label" text-anchor="middle">08:00</text>
            <text x="237" y="125" class="s3-axis-label" text-anchor="middle">12:00</text>
            <text x="301" y="125" class="s3-axis-label" text-anchor="middle">16:00</text>
            <text x="365" y="125" class="s3-axis-label" text-anchor="middle">20:00</text>
            <text x="413" y="125" class="s3-axis-label" text-anchor="middle">24:00</text>
          </svg>

          <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
            <span style="font-size:22px">🫁</span>
            <span style="font-size:12px;font-family:var(--font-mono)">{{ rtLive ? '在床呼吸监测中…' : rtArchiveNote }}</span>
          </div>
        </div>

        <div class="s3-card-footnote" style="margin-top: auto;">
          {{ rtLive ? `静卧呼吸 · 窗内均值 ${todayAvgBr} 次/分 · 暂停 ${apneaCount} 次` : rtArchiveNote }}
        </div>
      </div>
    </div>

    <!-- ======================= 右下区域：监测窗客观摘要 + 评估辅助·核查线索 ======================= -->
    <div style="grid-column: 3; grid-row: 2; display: flex; flex-direction: column; gap: 16px; min-height: 0;">
      <!-- 监测窗客观摘要（assessment_snapshot.metrics 口径） -->
      <div class="s3-card" style="flex: 0 0 192px;">
        <div class="s3-card-head">
          <div class="s3-card-title-wrap">
            <span class="s3-chevron">»</span>
            <span class="s3-card-title">{{ isRealHardware ? '监测窗客观摘要' : gCardTitles.rs }}</span>
          </div>
          <div :class="gPills.rs.cls"><span>{{ gPills.rs.icon }}</span> <span>{{ gPills.rs.text }}</span></div>
        </div>
        <div class="s3-card-body" style="padding: 6px 12px 8px 12px; gap: 6px;">
          <div class="s3-hw-stat-grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px;">
            <div class="s3-hw-cell" style="padding: 6px 8px;">
              <span class="lbl">在床率</span>
              <span class="val cyan" style="font-size: 18px;">{{ isRealHardware ? inBedRatePct : '--' }}<small style="font-size: 10px;">%</small></span>
              <span class="sub">监测窗 20:00-08:00</span>
            </div>
            <div class="s3-hw-cell" style="padding: 6px 8px;">
              <span class="lbl">离床次数</span>
              <span class="val" :class="offBedEventCount > 0 ? 'amber' : 'mint'" style="font-size: 18px;">{{ isRealHardware ? offBedEventCount : '--' }}<small style="font-size: 10px;">次</small></span>
              <span class="sub">含夜间起夜</span>
            </div>
            <div class="s3-hw-cell" style="padding: 6px 8px;">
              <span class="lbl">体动指数</span>
              <span class="val mint" style="font-size: 18px;">{{ isRealHardware ? bedMovementIndex : '--' }}<small style="font-size: 10px;">次/h</small></span>
              <span class="sub">平卧安稳 ≤5</span>
            </div>
            <div class="s3-hw-cell" style="padding: 6px 8px;" :style="fallEventCount > 0 ? { borderColor: 'rgba(255,51,102,0.5)', background: 'rgba(255,51,102,0.08)' } : {}">
              <span class="lbl">跌倒姿态</span>
              <span class="val" :class="fallEventCount > 0 ? 'red' : 'cyan'" style="font-size: 18px;">{{ isRealHardware ? fallEventCount : '--' }}<small style="font-size: 10px;">次</small></span>
              <span class="sub">设备侧事件</span>
            </div>
          </div>
          <div class="s3-hw-stat-grid" style="grid-template-columns: repeat(3, 1fr); gap: 8px;">
            <div class="s3-hw-cell" style="padding: 5px 8px;">
              <span class="lbl">心率偏离时段</span>
              <span class="val" style="font-size: 14px; color: #fff;">{{ isRealHardware ? hrAbnormalHours : '--' }} h</span>
            </div>
            <div class="s3-hw-cell" style="padding: 5px 8px;">
              <span class="lbl">体温偏离时段</span>
              <span class="val" style="font-size: 14px; color: #fff;">{{ isRealHardware ? tpStats.abnHours : '--' }} h</span>
            </div>
            <div class="s3-hw-cell" style="padding: 5px 8px;">
              <span class="lbl">窗覆盖率</span>
              <span class="val" style="font-size: 14px; color: #fff;">{{ isRealHardware ? windowCoveragePct : '--' }}%</span>
            </div>
          </div>
          <div class="s3-card-footnote" style="font-size: 11px;">
            {{ isRealHardware ? `最近离床 ${bedEvents.lastOffAt || '窗内未发生'}` : rtArchiveNote }}
          </div>
        </div>
      </div>

      <!-- 评估辅助 · 核查线索（assistant_insight / risk_signal，禁止定级） -->
      <div class="s3-card" style="flex: 1; min-height: 0;">
        <div class="s3-card-head">
          <div class="s3-card-title-wrap">
            <span class="s3-chevron">»</span>
            <span class="s3-card-title">{{ isRealHardware ? '评估辅助 · 核查线索' : gCardTitles.rb }}</span>
          </div>
          <div :class="gPills.rb.cls"><span>{{ gPills.rb.icon }}</span> <span>{{ gPills.rb.text }}</span></div>
        </div>
        <div class="s3-card-body" style="padding: 4px 12px 8px 12px; gap: 6px;">
          <div class="s3-edge-sub">风险线索</div>
          <div class="s3-flow-list" style="max-height: 88px; overflow-y: auto;">
            <div
              v-for="(r, i) in assessmentHints.risks"
              :key="'risk'+i"
              class="s3-flow-row"
              :style="r.level === 'med' ? { borderLeftColor: 'rgba(255,170,0,0.75)' } : {}"
            >
              <b>{{ r.level === 'med' ? '线索' : '提示' }}</b>
              <span>{{ r.text }}</span>
            </div>
          </div>

          <div class="s3-edge-sub">上门核查要点</div>
          <div class="s3-flow-list" style="max-height: 72px; overflow-y: auto;">
            <div v-for="(c, i) in assessmentHints.checklist" :key="'chk'+i" class="s3-flow-row">
              <b>□</b>
              <span>{{ c }}</span>
            </div>
          </div>

          <div class="s3-card-footnote" style="font-size: 10.5px; line-height: 1.45; text-align: left; padding-top: 4px;">
            {{ assessmentHints.disclaimer }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.s3-profile-subtitle {
  margin-left: 14px;
  padding: 2px 10px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--cyan);
  border: 1px solid rgba(0, 240, 255, 0.35);
  background: rgba(0, 240, 255, 0.08);
  border-radius: 3px;
  white-space: nowrap;
}

/* 离床/离线：体征卡停表态——曲线压暗，禁止看起来仍在实时测量 */
.s3-card-hold .s3-card-body > svg,
.s3-card-hold .s3-card-body > div > svg {
  opacity: 0.38;
  filter: grayscale(0.55) saturate(0.5);
  transition: opacity 0.35s ease, filter 0.35s ease;
}
.s3-card-hold .s3-hw-cell .val {
  color: var(--txt-muted) !important;
  text-shadow: none !important;
}

.s3-hold-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 6px;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px dashed rgba(255, 183, 3, 0.55);
  background: rgba(255, 183, 3, 0.1);
}
.s3-hold-banner.s3-hold-off {
  border-color: rgba(148, 163, 184, 0.5);
  background: rgba(148, 163, 184, 0.1);
}
.s3-hold-icon {
  font-size: 16px;
  font-weight: 800;
  color: #ffb703;
  animation: s3HoldBlink 1.6s ease-in-out infinite;
}
.s3-hold-off .s3-hold-icon {
  color: #94a3b8;
  animation: none;
}
.s3-hold-text {
  font-size: 14px;
  font-weight: 700;
  color: #ffb703;
  letter-spacing: 1px;
}
.s3-hold-off .s3-hold-text {
  color: #94a3b8;
}
.s3-hold-sub {
  font-size: 11px;
  color: var(--txt-secondary);
  margin-left: auto;
}
@keyframes s3HoldBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.s3-pill-mute {
  background: rgba(100, 116, 139, 0.25);
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #94a3b8;
}

.s3-holo-breathe-g {
  transform-origin: 240px 180px;
  animation: s3-breathe-g 3.6s ease-in-out infinite;
}
@keyframes s3-breathe-g {
  0%, 100% { transform: scale(1); opacity: 0.65; }
  50% { transform: scale(1.14); opacity: 1; }
}
.s3-holo-pulse-g {
  transform-origin: 252px 182px;
  animation: s3-pulse-g 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes s3-pulse-g {
  0% { transform: scale(1); opacity: 0.7; }
  20% { transform: scale(1.35); opacity: 1; }
  45% { transform: scale(0.96); opacity: 0.85; }
  100% { transform: scale(1); opacity: 0.7; }
}

.s3-edge-sub {
  font-size: 11.5px;
  color: var(--txt-secondary);
  margin-top: 4px;
}

.s3-chip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  flex-wrap: wrap;
}
.s3-chip {
  font-size: 11px;
  padding: 2px 9px;
  border: 1px solid rgba(0, 240, 255, 0.25);
  background: rgba(0, 240, 255, 0.05);
  color: var(--txt-secondary);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.s3-chip:hover {
  border-color: rgba(0, 240, 255, 0.6);
  color: #9be9ff;
}
.s3-chip.active {
  color: #00f0ff;
  border-color: #00f0ff;
  background: rgba(0, 240, 255, 0.15);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
}
.s3-chip-group-label {
  font-size: 10px;
  color: var(--txt-muted);
  flex-shrink: 0;
}
.s3-sort-select {
  margin-left: auto;
  background: rgba(4, 18, 38, 0.9);
  border: 1px solid rgba(0, 240, 255, 0.35);
  color: #9be9ff;
  font-size: 11px;
  border-radius: 3px;
  padding: 2px 4px;
  outline: none;
  cursor: pointer;
}
.s3-sort-select option {
  background: #06101e;
  color: #f8fafc;
}
.s3-dd-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 6px;
  border-top: 1px solid rgba(0, 240, 255, 0.12);
  font-size: 11.5px;
  color: var(--txt-secondary);
  font-family: var(--font-mono);
}
.s3-dd-page-btn {
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.3);
  color: #00f0ff;
  border-radius: 3px;
  cursor: pointer;
  padding: 1px 8px;
  font-size: 11px;
}
.s3-dd-page-btn:hover {
  background: rgba(0, 240, 255, 0.2);
}

.s3-flow-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 4px;
  overflow: hidden;
}
.s3-flow-row {
  font-size: 11.5px;
  color: var(--txt-secondary);
  border-left: 2px solid rgba(0, 240, 255, 0.4);
  padding-left: 8px;
  line-height: 1.5;
}
.s3-flow-row b {
  color: var(--cyan);
  font-family: var(--font-mono);
  font-weight: 600;
}

/* ======================= 真实硬件大屏扩展样式 ======================= */
.s3-date-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.s3-real-date-select {
  background: rgba(0, 30, 45, 0.85);
  border: 1px solid rgba(0, 240, 255, 0.4);
  color: var(--cyan);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 6px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}
.s3-real-date-select option {
  background: #061828;
  color: #fff;
}

.s3-hypno-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.s3-hw-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 4px;
}
.s3-hw-cell {
  background: rgba(0, 30, 50, 0.45);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.s3-hw-cell .lbl {
  font-size: 10.5px;
  color: var(--txt-secondary);
}
.s3-hw-cell .val {
  font-size: 16px;
  font-family: var(--font-mono);
  font-weight: 700;
}
.s3-hw-cell .val small {
  font-size: 10px;
  font-weight: normal;
  margin-left: 2px;
}
.s3-hw-cell .val.cyan { color: var(--cyan); }
.s3-hw-cell .val.mint { color: var(--mint); }
.s3-hw-cell .val.amber { color: var(--amber); }
.s3-hw-cell .sub {
  font-size: 9.5px;
  color: var(--txt-muted);
}

.s3-hw-telemetry-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px;
}
.s3-hw-conn-box {
  background: rgba(0, 24, 40, 0.6);
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: 4px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.s3-hw-conn-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.s3-hw-conn-row .k {
  color: var(--txt-secondary);
  width: 58px;
  flex-shrink: 0;
}
.s3-hw-conn-row .v {
  color: #fff;
}
.s3-hw-conn-row .v.code {
  font-family: var(--font-mono);
  color: var(--cyan);
}
.s3-hw-conn-row .tag.online {
  font-size: 9.5px;
  color: #00ff88;
  background: rgba(0, 255, 136, 0.15);
  border: 1px solid rgba(0, 255, 136, 0.35);
  border-radius: 2px;
  padding: 1px 4px;
}

/* ======================= 长护险参保档案区（缺失值统一走全局 .missing-val / .missing-tag） ======================= */
/* 部分建档状态标签：实线边框 + mint 色，与缺失态的虚线灰标签区分 */
.s3-archive-tag-partial {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--mint);
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.4);
  border-radius: 3px;
  padding: 1px 6px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.s3-archive-bind {
  font-size: 10.5px;
  font-family: var(--font-mono);
  color: var(--txt-secondary);
  padding: 4px 8px;
  margin-bottom: 6px;
  background: rgba(0, 30, 50, 0.45);
  border: 1px solid rgba(0, 240, 255, 0.18);
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.s3-archive-bind b {
  color: var(--cyan);
  font-weight: 700;
}
.s3-archive-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px 10px;
  padding: 2px;
}
.s3-archive-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 10.5px;
  line-height: 1.7;
  white-space: nowrap;
  overflow: hidden;
}
.s3-archive-item .k {
  color: var(--txt-secondary);
  flex-shrink: 0;
}
.s3-archive-item .v {
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
