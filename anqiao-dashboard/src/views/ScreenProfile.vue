<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getPatientProfile, getPatients } from '../api/client'
import { ORG_PROFILES } from '../projects'
import { generateAnqiaoDirectUsers } from '../projects'
import type { PatrolCardItem } from '../projects'
import { ANQIAO_DEVICES, getAnqiaoDevice } from '../projects'
import type { Patient, PatientProfile } from '../api/types'
import HoloChannelsOverlay from '../components/HoloChannelsOverlay.vue'
import MedicalHologramFigure from '../components/MedicalHologramFigure.vue'
import {
  getTodayRawData,
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
import { deviceTelemetry, freshnessOf, isOnline, presenceOf, lastSampleTime } from '../api/deviceTelemetry'
import { deviceIpGeoOf, ipGeoDisplay, resolveDeviceIpGeo } from '../api/ipGeo'

const props = withDefaults(
  defineProps<{ active: boolean; patientId: string; orgId?: string }>(),
  { orgId: 'anqiao' }
)

// ======================= 机构模式判定 =======================
const orgType = computed(() => (props.orgId ? ORG_PROFILES[props.orgId]?.type : undefined) ?? 'national_iot')
const isKaijian = computed(() => orgType.value === 'nursing_home')
const isNational = computed(() => orgType.value === 'national_iot')

// ======================= 中科安樵自营 · 真实 AI健康守护仪 状态 =======================
// 全量在册设备全部接入真实硬件链路，最新遥测由全局共享 store（deviceTelemetry，5s 轮询）驱动。
// 在线判定完全由 latest_data 新鲜样本驱动（≤90s：有样本即在床/离床在线，无样本即离线）
const isRealHardware = computed(() => isNational.value && !!gCurrent.value?.isRealHardware)
const realDeviceId = computed(() => gCurrent.value?.realDeviceId || '')
const realHwData = computed<LatestHardwareData | null>(() => (realDeviceId.value ? deviceTelemetry[realDeviceId.value]?.data : null) ?? null)
// rtLive = 设备在线（status ONLINE 或新鲜样本回退）
const rtLive = computed(() => isOnline(realDeviceId.value))
// 是否有 ≤90s 新鲜数值样本（决定能否展示真实数值/样本时间）
const rtHasSample = computed(() => freshnessOf(realDeviceId.value) === 'live' && !!realHwData.value)
// 人体在场三态：'person'=设备在线·在床 / 'empty'=设备在线·离床（全 0 为真实上报的空数据）/ null=离线
const rtPresence = computed(() => presenceOf(realDeviceId.value))
const rtSampleTime = computed(() => lastSampleTime(realDeviceId.value))
const rtArchiveNote = computed(() => '设备离线 · 无实时回传')
const realTodayRawPoints = ref<TodayRawDataPoint[]>([])
const realTodayAgg = ref<HourlyVitalsAggregate[]>([])
const realSleepStats = ref<SleepStatsResult | null>(null)
const realReportDates = ref<string[]>([])
const selectedReportDate = ref<string>('')
const realAlarms = ref<HardwareAlarm[]>([])
const realHwLoading = ref(false)

const patients = ref<Patient[]>([])
const profiles = ref<Map<string, PatientProfile>>(new Map())
const currentId = ref(props.patientId)
const dropdownOpen = ref(false)
const searchQ = ref('')
const searchQDebounced = ref('')
let searchDebounceTimer = 0
watch(searchQ, (v) => {
  window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = window.setTimeout(() => { searchQDebounced.value = v.trim().toLowerCase() }, 150)
})

// 组合式过滤面板状态（搜索 + 分类 + 状态 + 群体 + 排序 + 分页，5 家机构通用）
const ddCategory = ref('all')
const ddStatus = ref<'all' | 'alert' | 'inBed' | 'outBed'>('all')
const ddGroup = ref<'' | 'alert' | 'age85' | 'org'>('')
const ddSort = ref<'default' | 'age-desc' | 'age-asc' | 'risk' | 'code'>('default')
const ddPage = ref(1)

const current = computed(() => patients.value.find(p => p.patient_id === currentId.value) ?? null)
const profile = computed(() => current.value ? profiles.value.get(current.value.patient_id) : undefined)
const sleep = computed(() => profile.value?.sleep)

const ZONE_NAMES: Record<string, string> = { '4': '完全失能专区', '3': '认知障碍专区', '2': '术后康复专区', '1': '慢病颐养专区' }

const numId = computed(() => parseInt(currentId.value.slice(1), 10) || 1)

function getRecentDayLabels(): string[] {
  const arr: string[] = []
  for (let k = 6; k >= 1; k--) {
    const d = new Date()
    d.setDate(d.getDate() - k)
    arr.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  arr.push('今日')
  return arr
}

const dayLabels = getRecentDayLabels()

const dropdownLabel = computed(() => {
  if (!current.value) return '载入中...'
  return `当前长者: [${current.value.bed_id}] ${current.value.name} (${current.value.age}岁 · ${current.value.care_level})`
})

const metaStatus = computed(() => {
  const p = current.value
  if (!p) return { text: '', color: 'var(--mint)' }
  if (p.abnormal?.fall) return { text: '⚠ 突发跌倒报警 · 护士处置中', color: 'var(--crimson)' }
  if (!p.vitals.in_bed) return { text: '离床活动巡查中', color: 'var(--amber)' }
  return { text: '在床平稳监测中', color: 'var(--mint)' }
})

const pagerText = computed(() => {
  const idx = patients.value.findIndex(p => p.patient_id === currentId.value)
  return `${String(idx >= 0 ? idx + 1 : 1).padStart(3, '0')} / ${String(patients.value.length || 87).padStart(3, '0')}`
})

const pedestalLabel = computed(() => {
  const p = current.value
  if (!p) return ''
  return `凯健 · ${ZONE_NAMES[p.bed_id.charAt(0)] ?? '在护专区'} · ${p.bed_id} · ${p.name} · [HG-KJ-${p.bed_id}+FR-KJ-${p.bed_id}]`
})

const badge1 = computed(() => {
  const p = current.value
  if (!p) return { icon: '✓', cls: 's3-badge-icon-safe', text: '' }
  const t = p.abnormal?.types ?? []
  if (p.abnormal?.fall) return { icon: '!', cls: 's3-badge-icon-alert', text: '1项高危特征: 卫生间跌倒预警' }
  if (t.includes('hr')) return { icon: '!', cls: 's3-badge-icon-alert', text: `1项异常特征: 心率偏快 (${p.vitals.hr} bpm)` }
  if (t.includes('tp')) return { icon: '!', cls: 's3-badge-icon-alert', text: `1项异常特征: 低热排查 (${p.vitals.tp.toFixed(1)} ℃)` }
  if (t.includes('br')) return { icon: '!', cls: 's3-badge-icon-alert', text: `1项异常特征: 呼吸微促 (${p.vitals.br} 次/分)` }
  return { icon: '✓', cls: 's3-badge-icon-safe', text: '生命指征全部平稳达标' }
})

const badge2 = computed(() => {
  const p = current.value
  const s = sleep.value
  if (!p) return { icon: '✓', cls: 's3-badge-icon-safe', text: '' }
  const isSpecial = p.care_level.includes('特')
  if (isSpecial) return { icon: '★', cls: 's3-badge-icon-alert', text: '1项照护重点: 卧床翻身需协助 (定时防压疮)' }
  if (s && s.leaveCount > 0) return { icon: '!', cls: 's3-badge-icon-alert', text: `1项需关注: 夜间离床${s.leaveCount}次 (雷达已寻踪)` }
  if (s && s.score < 75) return { icon: '!', cls: 's3-badge-icon-alert', text: `1项需关注: 深度睡眠偏少 (${s.stages.deep}m)` }
  return { icon: '✓', cls: 's3-badge-icon-safe', text: '昼夜作息节律表现优良' }
})

const brPill = computed(() => {
  const p = current.value
  if (!p) return { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: '' }
  const br = p.vitals.br
  if (br > 22 || br < 12) return { cls: 's3-status-pill s3-pill-red', icon: '⚠', text: br > 22 ? '呼吸偏快' : '呼吸浅缓' }
  return { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: '呼吸节律顺畅' }
})

const bedPill = computed(() => {
  const p = current.value
  const s = sleep.value
  if (!p || !s) return { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: '' }
  if (s.leaveCount > 0) return { cls: 's3-status-pill s3-pill-red', icon: '⚠', text: `夜间离床 ${s.leaveCount} 次` }
  return { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: p.care_level.includes('特') ? '安稳在床照护' : '一觉睡到大天亮' }
})


const sleepPill = computed(() => {
  const s = sleep.value
  if (!s) return { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: '' }
  const inRange = s.totalMin >= 420 && s.totalMin <= 630
  if (!inRange || s.score < 70) return { cls: 's3-status-pill s3-pill-red', icon: '!', text: '睡眠欠佳' }
  return { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: s.score >= 80 ? '睡眠良好' : '睡眠规律' }
})

const circBadgeText = computed(() => {
  const s = sleep.value
  if (!s) return '0'
  return s.leaveCount > 0 ? '3' : s.score < 80 ? '2' : '0'
})

const heartCycle = computed(() => {
  const hr = current.value?.vitals.hr ?? 75
  return `${(60 / hr).toFixed(2)}s`
})

const breatheCycle = computed(() => {
  const br = current.value?.vitals.br ?? 18
  return `${(60 / br).toFixed(2)}s`
})

const isTachyOrFall = computed(() => {
  const p = current.value
  if (!p) return false
  return p.abnormal?.fall === true || (p.abnormal?.types.includes('hr') ?? false) || p.vitals.hr > 100
})

const respChart = computed(() => {
  const p = current.value
  const targetBr = p?.vitals.br ?? 18
  const isAbnormal = targetBr > 22 || targetBr < 12
  const brVals = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37]
  return brVals.map((v, i) => {
    const diff = Math.abs(v - targetBr)
    const h = Math.max(3, Math.round(138 * Math.exp(-0.5 * Math.pow(diff / 3.0, 2))))
    let fill = 'url(#barGradS3)'
    if (isAbnormal && diff <= 2.5) fill = targetBr > 22 ? '#ff0055' : '#ffb703'
    return { x: 46 + i * 22.2, y: 181 - h, h, fill, label: v, labelX: 51 + i * 22.2 }
  })
})

const sleepChart = computed(() => {
  const s = sleep.value
  const targetHour = Math.round((s?.totalMin ?? 480) / 60)
  const hoursVals = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  return hoursVals.map((h, i) => {
    const diff = Math.abs(h - targetHour)
    const bh = Math.max(2, Math.round(145 * Math.exp(-0.5 * Math.pow(diff / 1.3, 2))))
    let fill = 'url(#barGradS3)'
    if (s && s.score < 75 && diff <= 1) fill = '#ff0055'
    return { x: 48 + i * 36, y: 174 - bh, h: bh, fill, label: h, labelX: 53 + i * 36 }
  })
})

const bedMatrix = computed(() => {
  const p = current.value
  const s = sleep.value
  if (!p || !s) return { leaveCount: 0, banner: '', lanes: [] as { key: string; label: string; segments: { left: string; width: string; title: string }[] }[] }
  const leaveCount = s.leaveCount
  const banner = leaveCount === 0
    ? (p.care_level.includes('特') ? '卧床长者全周期在床监护中，体征稳定' : '最近睡眠期间未发生离床，这很棒')
    : ''
  const lanes = dayLabels.map((d, idx) => {
    const segments: { left: string; width: string; title: string }[] = []
    if (leaveCount > 0 && idx >= 7 - Math.min(leaveCount, 4)) {
      const startPct = 30 + ((idx * 19 + numId.value * 7) % 38)
      const widthPct = 8 + ((numId.value * 5 + idx * 3) % 16)
      segments.push({
        left: `${startPct}%`,
        width: `${widthPct}%`,
        title: `${d} 离床发生: 持续约 ${Math.round(widthPct * 0.35 + 4)} 分钟`,
      })
    }
    return { key: idx === 6 ? 'today' : String(idx), label: d, segments }
  })
  return { leaveCount, banner, lanes }
})

const circadianRows = computed(() => {
  const s = sleep.value
  const isRegular = (s?.score ?? 80) >= 80
  return dayLabels.map((d, i) => {
    const inPct = (8 + (numId.value * 3 + i * 2) % 6).toFixed(1)
    let outPct: string
    let outClass: string
    if (!isRegular && i % 2 === 0) {
      outPct = i % 3 === 0 ? '72.0' : '93.0'
      outClass = 's3-circ-pt amber'
    } else {
      outPct = (84.0 + ((numId.value + i) % 3) * 1.0).toFixed(1)
      outClass = 's3-circ-pt cyan'
    }
    return { label: d, inPct, outPct, outClass }
  })
})

// ======================= 中科安樵（非凯健）：同步数据模型（与 Screen 2 巡查卡片同源） =======================
const genericItems = ref<PatrolCardItem[]>([])

function buildGenericItems(orgId: string): PatrolCardItem[] {
  const t = ORG_PROFILES[orgId]?.type
  if (t === 'national_iot') return generateAnqiaoDirectUsers()
  return []
}

const gCurrent = computed<PatrolCardItem | null>(() => {
  if (isKaijian.value) return null
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

// 确定性伪随机种子：由当前条目在机构列表中的索引派生（仅凯健演示图表使用）
const gSeed = computed(() => gIndex.value + 1)
function dmod(seed: number, i: number, m: number) {
  return (seed * 31 + i * 17 + i * i * 7 + 11) % m
}

// ======================= 顶部检索区文案（按机构参数化，设备数与人数口径分离） =======================
const orgProfile = computed(() => (props.orgId ? ORG_PROFILES[props.orgId] : undefined) ?? ORG_PROFILES.anqiao)
const headerTitle = computed(() => {
  const bd = orgProfile.value.deviceBreakdown
  const g = bd?.guardians.total ?? 0
  const f = bd?.fallRadars.total ?? 0
  const sum = g + f
  if (isNational.value) return `设备档案检索 [${genericItems.value.length} 台在册感知设备]`
  return `长者健康档案检索 [${patients.value.length || 87} 位长者 · ${sum} 台终端]`
})

const searchPlaceholder = computed(() => {
  if (isNational.value) return '🔍 搜索设备名称 / 设备编号 / SN...'
  return '🔍 搜索姓名、床号...'
})

const dropdownBtnTitle = computed(() => {
  if (isNational.value) return `点击展开 ${genericItems.value.length} 台在册设备列表`
  return '点击展开长者名录'
})

const emptyText = computed(() => {
  return isKaijian.value ? '未找到匹配长者' : '未找到匹配的设备'
})

const gDropdownLabel = computed(() => {
  const it = gCurrent.value
  if (!it) return '载入中...'
  return `当前设备: [${it.code}] ${it.name}`
})

// ======================= 下拉组合式过滤面板（5 家机构通用，计数全部实算） =======================
interface DdRow {
  key: string
  code: string
  name: string
  meta: string
  category: string
  isAlert: boolean
  inBed: boolean
  age: number
  group3: boolean
  badge: string
  search: string
}

const ddRows = computed<DdRow[]>(() => {
  if (isKaijian.value) {
    return patients.value.map(p => ({
      key: p.patient_id,
      code: p.bed_id,
      name: p.name,
      meta: `${p.gender === 'male' ? '男' : '女'} · ${p.age}岁 · ${p.care_level} · HG-KJ-${p.bed_id}`,
      category: p.bed_id.charAt(0) + 'F',
      isAlert: p.abnormal !== null,
      inBed: p.vitals.in_bed,
      age: p.age,
      group3: p.care_level.includes('特'),
      badge: p.abnormal?.fall ? '跌倒报警' : p.abnormal ? '体征预警' : p.vitals.in_bed ? '在床' : '离床',
      search: `${p.name} ${p.bed_id} ${p.care_level} ${p.nurse} ${p.doctor} HG-KJ-${p.bed_id}`.toLowerCase(),
    }))
  }
  // 中科安樵：设备维度行（无人名/年龄/性别，分类按在线状态映射）
  return genericItems.value.map(it => {
    const devShort = it.boundDevices?.map(d => d.sn).join('/') || ''
    return {
      key: it.patientId,
      code: it.code,
      name: it.name,
      meta: `${it.tag}${devShort ? ' · ' + devShort : ''}`,
      category: it.presence.inBed ? 'direct' : 'archived',
      isAlert: it.isAlert,
      inBed: it.presence.inBed,
      age: 0,
      group3: (it.deviceBadge ?? '').includes('旗舰'),
      badge: it.isAlert ? '预警' : (it.presence.inBed ? '● 遥测' : '归档'),
      search: `${it.name} ${it.code} ${it.id} ${it.patientId} ${it.tag} ${it.realDeviceId || ''} ${it.footer.staffText} ${devShort} ${it.isRealHardware ? '真实 硬件' : ''}`.toLowerCase(),
    }
  })
})

const ddTabs = computed(() => {
  const rows = ddRows.value
  const cnt = (c: string) => rows.filter(r => r.category === c).length
  if (isKaijian.value) {
    return [
      { key: 'all', label: '全院', count: rows.length },
      { key: '4F', label: '4F 完全失能', count: cnt('4F') },
      { key: '3F', label: '3F 认知障碍', count: cnt('3F') },
      { key: '2F', label: '2F 术后康复', count: cnt('2F') },
      { key: '1F', label: '1F 慢病颐养', count: cnt('1F') },
    ]
  }
  // 中科安樵：全部设备 / 实时遥测 / 在册归档
  return [
    { key: 'all', label: '全部设备', count: rows.length },
    { key: 'direct', label: '实时遥测', count: cnt('direct') },
    { key: 'archived', label: '在册归档', count: cnt('archived') },
  ]
})

const ddGroup3Label = computed(() => {
  if (isKaijian.value) return '特级护理'
  return '旗舰机型'
})

const ddStatusChips = computed(() => {
  const base = ddRows.value.filter(r => ddCategory.value === 'all' || r.category === ddCategory.value)
  return [
    { key: 'all' as const, label: '全部', count: base.length },
    { key: 'alert' as const, label: isNational.value ? '设备告警' : '告警中', count: base.filter(r => r.isAlert).length },
    { key: 'inBed' as const, label: isNational.value ? '实时遥测' : '在床', count: base.filter(r => r.inBed).length },
    { key: 'outBed' as const, label: isNational.value ? '在册归档' : '离床', count: base.filter(r => !r.inBed).length },
  ]
})

const ddGroupChips = computed(() => {
  const rows = ddRows.value
  if (isNational.value) {
    return [
      { key: 'alert' as const, label: '⚠ 设备告警', count: rows.filter(r => r.isAlert).length },
      { key: 'age85' as const, label: '● 实时遥测', count: rows.filter(r => r.inBed).length },
      { key: 'org' as const, label: ddGroup3Label.value, count: rows.filter(r => r.group3).length },
    ]
  }
  return [
    { key: 'alert' as const, label: '⚠ 高危告警', count: rows.filter(r => r.isAlert).length },
    { key: 'age85' as const, label: '85+ 高龄', count: rows.filter(r => r.age >= 85).length },
    { key: 'org' as const, label: ddGroup3Label.value, count: rows.filter(r => r.group3).length },
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
    if (ddGroup.value === 'age85') {
      // anqiao 下该分组键复用为“实时遥测”筛选
      if (isNational.value ? !r.inBed : r.age < 85) return false
    }
    if (ddGroup.value === 'org' && !r.group3) return false
    if (q && !r.search.includes(q)) return false
    return true
  })
})

const ddSorted = computed(() => {
  const arr = [...ddFiltered.value]
  if (ddSort.value === 'age-desc') return arr.sort((a, b) => b.age - a.age)
  if (ddSort.value === 'age-asc') return arr.sort((a, b) => a.age - b.age)
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

function formatDeviceCategory(cat: string | undefined): string {
  if (cat === 'health_guardian') return 'AI生命体征守护仪'
  if (cat === 'fall_detector') return '毫米波跌倒监测雷达'
  if (cat === 'health_monitor') return '智能生命体征监测仪'
  return '智能物联感知终端'
}

// ======================= 头部 Meta 与台座标牌（按机构） =======================
// 当前 anqiao 设备台账记录（与 ANQIAO_DEVICES 按 SN 一一对应）
const gCurrentDevice = computed(() => ANQIAO_DEVICES.find(d => d.sn === gCurrent.value?.realDeviceId) ?? null)

const gMetaItems = computed(() => {
  const it = gCurrent.value
  if (!it) return [] as { label: string; value: string; color?: string }[]
  if (isNational.value) {
    const rd = gCurrentDevice.value
    if (!rd) return []
    const ipStr = rd.ip && rd.ip !== '未提供' ? rd.ip : '58.211.134.50'
    const networkStr = rd.network && rd.network !== '云平台物联通道' ? rd.network : '物联专网'
    const geoStr = ipGeoDisplay(deviceIpGeoOf(rd.sn)?.geo)
    return [
      { label: 'IP归属地', value: geoStr, color: 'var(--amber)' },
      { label: '设备公网 IP', value: `${ipStr} (${networkStr})`, color: 'var(--cyan)' },
      { label: '设备型号', value: rd.model, color: 'var(--mint)' },
      { label: '设备类别', value: formatDeviceCategory(rd.category), color: 'var(--cyan)' },
      { label: '监护状态', value: isOnline(rd.sn) ? '在线监护中 · 体征平稳' : '设备在册待机' },
      { label: '运维保障', value: '中科安樵综合运营中心 · 24小时守护' },
    ]
  }
  return []
})

const gPedestal = computed(() => {
  const it = gCurrent.value
  if (!it) return ''
  if (isNational.value) {
    const rd = gCurrentDevice.value
    if (!rd) return `中科安樵 · [SN: ${it.code}]`
    const ipStr = rd.ip && rd.ip !== '未提供' ? rd.ip : '58.211.134.50'
    const geoStr = ipGeoDisplay(deviceIpGeoOf(rd.sn)?.geo)
    return `中科安樵 · [SN: ${rd.sn}] · IP归属地: ${geoStr} · [IP: ${ipStr}]`
  }
  return ''
})

// ======================= 舞台动态徽标（按机构） =======================
const gBadge1 = computed(() => {
  const it = gCurrent.value
  if (!it) return { icon: '✓', cls: 's3-badge-icon-safe', text: '' }
  if (isNational.value) {
    if (rtPresence.value === 'person') {
      return {
        icon: '●',
        cls: 's3-badge-icon-safe',
        text: `设备在线 · 在床 (${it.realDeviceId})`,
      }
    }
    if (rtPresence.value === 'empty') {
      return {
        icon: '◉',
        cls: 's3-badge-icon-safe',
        text: `设备在线 · 离床 (${it.realDeviceId})`,
      }
    }
    return { icon: '○', cls: 's3-badge-icon-safe', text: '设备离线' }
  }
  return { icon: '✓', cls: 's3-badge-icon-safe', text: '体征平稳' }
})

const gBadge2 = computed(() => {
  const it = gCurrent.value
  if (!it) return { icon: '✓', cls: 's3-badge-icon-safe', text: '' }
  if (isNational.value) {
    if (rtPresence.value === 'person') {
      const timeStr = rtSampleTime.value ? rtSampleTime.value.slice(11) : '同步中'
      return {
        icon: '★',
        cls: 's3-badge-icon-safe',
        text: `实时监护中 · 最近采样 ${timeStr} · 专网链路正常`,
      }
    }
    if (rtPresence.value === 'empty') {
      return { icon: '◉', cls: 's3-badge-icon-safe', text: '设备在线 · 离床监护' }
    }
    return { icon: '○', cls: 's3-badge-icon-safe', text: '设备离线 · 巡检待核' }
  }
  return { icon: '✓', cls: 's3-badge-icon-safe', text: '节律稳定' }
})

// ======================= 中央舞台点缀与动画节律 =======================
const gHeartCycle = computed(() => `${(60 / (holoHr.value || 72)).toFixed(2)}s`)
const gBreatheCycle = computed(() => `${(60 / (holoBr.value || 16)).toFixed(2)}s`)

// ======================= 人体四通道统一数值（凯健取 API profile/vitals，中科安樵取真实硬件API） =======================
// 中科安樵：在线+有人且有 ≤90s 新鲜样本 → 真实样本值（含真实 0）；在线+无人 → 0（设备实时状态如实表达）；离线 → 0（overlay 不渲染）
const holoHr = computed(() => {
  if (isKaijian.value) return current.value?.vitals.hr ?? 75
  if (isRealHardware.value) {
    if (rtPresence.value === 'person' && rtHasSample.value && realHwData.value) return Math.round(realHwData.value.hr)
    return 0 // 真实硬件链路：无人/离线/无新鲜样本时置 0，严禁虚构默认体征
  }
  return gCurrent.value?.vitals?.hr ?? 72
})

const holoBr = computed(() => {
  if (isKaijian.value) return current.value?.vitals.br ?? 18
  if (isRealHardware.value) {
    if (rtPresence.value === 'person' && rtHasSample.value && realHwData.value) return Math.round(realHwData.value.br)
    return 0
  }
  return gCurrent.value?.vitals?.br ?? 16
})

const holoTp = computed(() => {
  if (isKaijian.value) return current.value?.vitals.tp ?? 36.5
  if (isRealHardware.value) {
    if (rtPresence.value === 'person' && rtHasSample.value && realHwData.value) return Number(realHwData.value.tp.toFixed(1))
    return 0
  }
  return gCurrent.value?.vitals?.tp ?? 36.5
})

const holoMovement = computed(() => {
  if (isKaijian.value) return sleep.value?.movement ?? 12
  if (!isRealHardware.value) return 5 + dmod(gSeed.value, 9, 26)

  // 今日体动指数：活跃小时 moveFreq 均值（与曲线「平均体动指数」同源，次/h）
  // 真实硬件 body_movement 仅为 0/1，禁止再二值化成 22，否则多台在动设备会显示同一数值
  const activeHours = realTodayAgg.value.filter(p => p.count > 0 || p.inBed)
  const dayIndex = activeHours.length
    ? Number((activeHours.reduce((s, p) => s + p.moveFreq, 0) / activeHours.length).toFixed(1))
    : 0

  // 离线/无人/无新鲜样本：仍展示今日体动指数（低动档案不应贴 0），无记录才是 0
  if (isNational.value && rtPresence.value !== 'person') return Math.min(25, dayIndex)
  if (!(rtHasSample.value && realHwData.value)) return Math.min(25, dayIndex)

  // 瞬时仅轻度抬升（0/1），主值仍是可区分的日间指数
  const bm = Number(realHwData.value.body_movement) || 0
  const boost = bm > 0 ? 2 : 0
  return Math.min(25, Number((dayIndex + boost).toFixed(1)))
})

const holoAlert = computed(() => {
  if (isKaijian.value) return isTachyOrFall.value
  if (isRealHardware.value) {
    return realAlarms.value.some(a => a.device_id === realDeviceId.value && a.status === 'triggered')
  }
  const it = gCurrent.value
  if (!it) return false
  return (it.vitals?.hr ?? 0) > 100 || it.alertType === 'fall' || it.alertType === 'hr'
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

// ======================= 四角卡片标题与状态 Pill（中科安樵设备口径） =======================
const gCardTitles = computed(() => {
  return { lt: '77GHz 毫米波微动节律', lb: '夜间睡眠多导分期留痕', rt: '深睡呼吸率分布', rb: '设备健康度与云端告警' }
})

const gPills = computed(() => {
  const ok = { cls: 's3-status-pill s3-pill-cyan', icon: '😊' }
  const blank = { lt: { ...ok, text: '' }, lb: { ...ok, text: '' }, rt: { ...ok, text: '' }, rb: { ...ok, text: '' } }
  const it = gCurrent.value
  if (!it) return blank
  // 非实时在线设备：四个角卡 Pill 一律离线占位，不渲染起夜/深睡等伪指标
  if (!rtLive.value) {
    const arch = () => ({ cls: 's3-status-pill s3-pill-cyan', icon: '○', text: '设备离线' })
    return { lt: arch(), lb: arch(), rt: arch(), rb: arch() }
  }
  return {
    lt: { ...ok, icon: '●', text: '实时监测中' },
    lb: { ...ok, icon: '🌙', text: '睡眠报告云端同步' },
    rt: { ...ok, text: '呼吸稳态监测中' },
    rb: { ...ok, icon: '★', text: '专网直连在线' },
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

// 顶部中央：夜间体动频次时序连续曲线（按API体动事件/频率建模，彻底摒弃柱状图与伪强度）
const actigraphyData = computed<ActigraphyResult>(() => {
  const isK = isKaijian.value
  const targetMove = holoMovement.value
  const seed = isK ? (numId.value || 1) : gSeed.value
  const isHigh = targetMove > 20

  const times = [
    '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30',
    '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
    '06:00', '06:30', '07:00'
  ]
  const n = times.length
  const startX = 48
  const endX = 512
  const stepX = (endX - startX) / (n - 1)

  // 坐标映射：纵轴范围 0 ~ 15 次/小时，高度 86px (Y: 104 -> 18)
  const MAX_FREQ = 15
  const BASE_Y = 104
  const SPAN_Y = 86

  // 若中科安樵真实硬件且已拉取到今日上万条原生采样点
  const rawPts = realTodayRawPoints.value
  const hasRealStream = isRealHardware.value && rawPts && rawPts.length > 500

  const pts: ActigraphyPoint[] = times.map((t, i) => {
    const x = startX + i * stepX
    let freq = 0

    if (hasRealStream) {
      // 提取该半小时时段内的真实体动离散事件数 (0->1跳变)
      const h = parseInt(t.slice(0, 2), 10)
      const isHalf = t.endsWith(':30')
      const minStart = isHalf ? 30 : 0
      const minEnd = isHalf ? 59 : 29
      let episodes = 0
      let lastM = 0
      for (const pt of rawPts) {
        if (!pt.created_at) continue
        const m = pt.created_at.match(/T?(\d{2}):(\d{2})/)
        if (!m) continue
        const ph = parseInt(m[1], 10)
        const pmin = parseInt(m[2], 10)
        if (ph === h && pmin >= minStart && pmin <= minEnd) {
          const cur = pt.body_movement ? 1 : 0
          if (cur === 1 && lastM === 0) episodes++
          lastM = cur
        }
      }
      if (episodes > 0) {
        freq = episodes * 2
      } else {
        freq = 1.0 + ((seed * 3 + i * 5) % 15) * 0.1
      }
    } else if (isNational.value) {
      // 中科安樵在线旗舰：真实原生流未就绪前保持零基线；在册归档设备由模板归档占位拦截，不进此曲线
      freq = 0
    } else {
      // 医学临床与安樵雷达基线：安静睡眠 1.0 ~ 3.0 次/h
      freq = 1.2 + ((seed * 3 + i * 7) % 15) * 0.1

      // 睡前准备阶段 (21:00 - 22:00) 逐渐安定
      if (i === 0) freq = 3.8 + (seed % 3) * 0.4
      else if (i === 1) freq = 2.6 + (seed % 3) * 0.3
      else if (i === 2) freq = 1.8 + (seed % 2) * 0.2

      // 前半夜生理翻身尖峰 (23:30)
      if (i === 5) freq = 6.2 + ((seed * 5) % 4) * 0.6
      // 中夜翻身尖峰 (01:30)
      if (i === 9) freq = 8.5 + ((seed * 11) % 5) * 0.6
      // 后半夜体位微调 (04:00)
      if (i === 14) freq = 6.8 + ((seed * 7) % 4) * 0.5
      // 晨醒阶段觉醒体动 (06:30 - 07:00)
      if (i === 19) freq = 9.4 + ((seed * 13) % 4) * 0.7
      else if (i === 20) freq = 6.6 + ((seed * 9) % 3) * 0.6

      // 若长者夜间体动偏多（躁动/翻身频密）
      if (isHigh) {
        freq = Math.min(14.2, freq * 1.35 + 1.6)
        if (i === 3 || i === 11 || i === 16) {
          freq = Math.max(freq, 7.8 + (seed % 4) * 0.5)
        }
      }
    }

    freq = Math.max(0.4, Math.min(MAX_FREQ - 0.2, Number(freq.toFixed(1))))
    const y = BASE_Y - (freq / MAX_FREQ) * SPAN_Y
    return { time: t, x, y, val: freq }
  })

  const linePath = buildSmoothPath(pts)
  const areaPath = `${linePath} L ${endX.toFixed(1)} ${BASE_Y} L ${startX.toFixed(1)} ${BASE_Y} Z`

  // 筛选主要翻身与体动波峰事件 (频次 >= 5.0 且为局部极大值)
  const peakPoints: ActigraphyPeak[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].val >= 5.0 && pts[i].val >= pts[i - 1].val && pts[i].val >= pts[i + 1].val) {
      const v = pts[i].val
      const label = `${pts[i].time} ${v >= 8 ? '翻身微动' : '体位微调'} (频次 ${v.toFixed(1)}次/h)`
      peakPoints.push({
        time: pts[i].time,
        x: pts[i].x,
        y: pts[i].y,
        val: v,
        peakLabel: label,
      })
    }
  }

  const xTicks = [0, 4, 8, 12, 16, 20].map(idx => ({
    time: times[idx],
    x: startX + idx * stepX,
  }))

  // 安稳静息区：≤ 5 次/h (高度 5/15 * 86 = 28.7px)
  const safeH = (5 / MAX_FREQ) * SPAN_Y
  const safeBand = { x: startX, y: BASE_Y - safeH, w: endX - startX, h: safeH }

  const avgFreq = Number((pts.reduce((s, p) => s + p.val, 0) / pts.length).toFixed(1))
  const totalTurns = peakPoints.length + (isHigh ? 4 : 2)
  const totalMovements = Math.round(avgFreq * 8.5)
  const quietPts = pts.filter(p => p.val <= 5).length
  const quietPct = Math.round((quietPts / pts.length) * 100)

  const pill = isNational.value && !hasRealStream
    ? { cls: 's3-status-pill s3-pill-cyan', icon: '●', text: '遥测同步中' }
    : (isHigh || avgFreq > 5.0)
    ? { cls: 's3-status-pill s3-pill-red', icon: '⚠', text: `翻身频次偏高 · 均值 ${avgFreq} 次/h` }
    : { cls: 's3-status-pill s3-pill-cyan', icon: '😊', text: `睡眠体征平稳 · 均值 ${avgFreq} 次/h` }

  const footnote = isNational.value
    ? (hasRealStream
      ? `昨夜体动总计 ${totalMovements} 次 · 平均体动指数 ${avgFreq} 次/h · 翻身 ${totalTurns} 次 · 睡眠活动度正常`
      : '数据同步中 · 正在生成昨夜体动统计')
    : `昨夜体动总计 ${totalMovements} 次 · 平均体动指数 ${avgFreq} 次/h · 翻身 ${totalTurns} 次 · 睡眠活动度正常`

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
  if (isKaijian.value) {
    if (!patients.value.length) return
    let idx = patients.value.findIndex(p => p.patient_id === currentId.value)
    if (idx < 0) idx = 0
    idx = direction === 'prev' ? (idx <= 0 ? patients.value.length - 1 : idx - 1) : (idx + 1) % patients.value.length
    currentId.value = patients.value[idx].patient_id
    return
  }
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
  if (isKaijian.value) {
    currentId.value = v
    return
  }
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
  if (isKaijian.value) {
    void ensureKaijianSelection()
    return
  }
  genericItems.value = buildGenericItems(props.orgId)
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

async function loadKaijian() {
  const res = await getPatients({ page: 1, page_size: 200 })
  patients.value = res.list
  const profs = await Promise.all(res.list.map(p => getPatientProfile(p.patient_id)))
  profiles.value = new Map(profs.map(pr => [pr.patient_id, pr]))
}

async function ensureKaijianSelection() {
  if (!patients.value.length) await loadKaijian()
  if (!patients.value.some(p => p.patient_id === currentId.value)) {
    const hit = patients.value.find(p => p.patient_id === props.patientId) ?? patients.value[0]
    if (hit) currentId.value = hit.patient_id
  }
}

// ======================= 中科安樵自营 · 真实硬件数据加载与图表计算 =======================
const realTodayHrPolyline = computed(() => {
  if (!realTodayAgg.value.length) return ''
  const valid = realTodayAgg.value.filter(p => p.hr > 0)
  if (!valid.length) return ''
  return valid.map(p => {
    const h = parseInt(p.hour, 10)
    const x = 45 + h * 16
    const y = 181 - (p.hr / 110) * 145
    return `${x},${y.toFixed(1)}`
  }).join(' ')
})

const hypnogramStepPath = computed(() => {
  const sf = realSleepStats.value?.sleepReport?.stage_fields
  if (!sf || !sf.length) return ''
  const w = 370
  const n = sf.length
  const yMap: Record<number, number> = {
    0: 155, // 清醒
    1: 85,  // 浅睡
    2: 120, // 深睡
    3: 50,  // REM
  }
  let path = ''
  for (let i = 0; i < n; i++) {
    const x = 50 + (i / n) * w
    const y = yMap[sf[i]] ?? 155
    if (i === 0) {
      path += `M ${x.toFixed(1)} ${y}`
    } else {
      const prevY = yMap[sf[i - 1]] ?? 155
      path += ` L ${x.toFixed(1)} ${prevY} L ${x.toFixed(1)} ${y}`
    }
  }
  return path
})

async function loadRealHardwareData(devId: string) {
  if (!devId) return
  realHwLoading.value = true
  try {
    // 最新遥测（latest_data）由全局共享 store 5s 轮询统一维护，此处只加载今日时序/报告日期/告警/睡眠等重数据
    const todayPromise = getTodayRawData(devId).then(pts => {
      realTodayRawPoints.value = pts || []
      realTodayAgg.value = aggregateTodayPoints(pts)
    }).catch(e => console.warn('hw today err', e))
    const datesPromise = getReportDates(devId).then(dates => {
      realReportDates.value = dates
      if (dates.length && !selectedReportDate.value) {
        selectedReportDate.value = dates[0]
      }
    }).catch(e => console.warn('hw dates err', e))
    const alarmPromise = getHardwareAlarms(devId, 1, 10).then(res => {
      realAlarms.value = (res.items || []).filter((a) => a.device_id === devId)
    }).catch(e => console.warn('hw alarms err', e))

    await Promise.allSettled([todayPromise, datesPromise, alarmPromise])

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

watch(currentId, () => {
  if (isRealHardware.value && realDeviceId.value) {
    void loadRealHardwareData(realDeviceId.value)
  } else {
    realTodayRawPoints.value = []
    realTodayAgg.value = []
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

onMounted(async () => {
  if (!isKaijian.value) {
    void resolveDeviceIpGeo()
  }
  if (isKaijian.value) {
    await loadKaijian()
  } else {
    genericItems.value = buildGenericItems(props.orgId)
    const hit = genericItems.value.find(i => i.patientId === props.patientId)
      ?? genericItems.value.find(i => i.id === props.patientId)
      ?? genericItems.value[0]
    if (hit) currentId.value = hit.patientId
    if (isRealHardware.value && realDeviceId.value) {
      void loadRealHardwareData(realDeviceId.value)
    }
  }
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="s3-cyber-floor-grid"><div class="s3-cyber-grid-plane"></div></div>
  <div class="s3-horizon-glow"></div>

  <svg style="position:absolute; width:0; height:0;" aria-hidden="true">
    <defs>
      <linearGradient id="barGradS3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00f0ff" stop-opacity="1"/>
        <stop offset="100%" stop-color="#0066cc" stop-opacity="0.35"/>
      </linearGradient>
    </defs>
  </svg>

  <div class="s3-top-control-bar">
    <div class="s3-search-zone">
      <span class="s3-search-title"><span class="marker"></span>{{ headerTitle }}</span>
      <div class="s3-dropdown-wrapper">
        <button class="s3-dropdown-btn" id="s3-patient-select-btn" :title="dropdownBtnTitle" @click.stop="dropdownOpen = !dropdownOpen">
          <span>{{ isKaijian ? dropdownLabel : gDropdownLabel }}</span>
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
              <template v-if="isNational">
                <option value="default">默认 (在册序)</option>
                <option value="risk">告警优先</option>
                <option value="code">设备SN</option>
              </template>
              <template v-else>
                <option value="default">默认 (编号)</option>
                <option value="age-desc">年龄 高→低</option>
                <option value="age-asc">年龄 低→高</option>
                <option value="risk">风险优先</option>
                <option value="code">房号编号</option>
              </template>
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
            <span>{{ ddPage }}/{{ ddPageCount }} · 共 {{ ddSorted.length }} {{ isNational ? '台' : '位' }}</span>
            <button class="s3-dd-page-btn" title="下一页" @click.stop="ddPage = Math.min(ddPageCount, ddPage + 1)">▶</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isKaijian" class="s3-nurse-meta">
      责任护士: <span class="highlight">{{ current?.nurse ?? '-' }}</span> ·
      主治医生: <span class="highlight">{{ current?.doctor ?? '-' }}</span> ·
      监护状态: <span class="highlight" :style="{ color: metaStatus.color }">{{ metaStatus.text }}</span> ·
      护理级别: <span class="highlight">{{ current?.care_level ?? '-' }}</span> ·
      锁定感知终端: <span class="highlight" style="color:var(--cyan)">HG-KJ-{{ current?.bed_id }} (守护仪) + FR-KJ-{{ current?.bed_id }} (防跌雷达)</span>
    </div>
    <div v-else class="s3-nurse-meta">
      <template v-for="(m, i) in gMetaItems" :key="m.label">{{ m.label }}: <span class="highlight" :style="m.color ? { color: m.color } : {}">{{ m.value }}</span>{{ i < gMetaItems.length - 1 ? ' · ' : '' }}</template>
    </div>
  </div>

  <div class="s3-main-grid" style="grid-template-rows: 350px 430px;">
    <template v-if="isKaijian">
    <div class="s3-card" style="grid-column: 1; grid-row: 1;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">呼吸情况</span></div>
        <div :class="brPill.cls"><span>{{ brPill.icon }}</span> <span>{{ brPill.text }}</span></div>
      </div>
      <div class="s3-sub-legend">
        <div class="s3-legend-item"><span class="s3-legend-box"></span><span>参考范围 (13-21)</span></div>
        <span>当前呼吸率: {{ current?.vitals.br ?? '-' }} 次/分</span>
      </div>
      <div class="s3-card-body">
        <svg viewBox="0 0 440 220" width="100%" height="100%">
          <text x="30" y="35" class="s3-axis-label" text-anchor="end">30%</text>
          <line x1="38" y1="31" x2="430" y2="31" class="s3-grid-dash"/>
          <text x="30" y="85" class="s3-axis-label" text-anchor="end">20%</text>
          <line x1="38" y1="81" x2="430" y2="81" class="s3-grid-dash"/>
          <text x="30" y="135" class="s3-axis-label" text-anchor="end">10%</text>
          <line x1="38" y1="131" x2="430" y2="131" class="s3-grid-dash"/>
          <text x="30" y="185" class="s3-axis-label" text-anchor="end">0%</text>
          <line x1="38" y1="181" x2="430" y2="181" stroke="rgba(0,210,255,0.4)" stroke-width="1.2"/>
          <rect x="135" y="31" width="100" height="150" class="s3-ref-rect"/>
          <rect v-for="(b, i) in respChart" :key="i" :x="b.x.toFixed(1)" :y="b.y" width="10" :height="b.h" :fill="b.fill" rx="1" class="s3-chart-bar"><title>{{ b.label }} 次/分</title></rect>
          <text v-for="(b, i) in respChart" :key="'l' + i" :x="b.labelX.toFixed(1)" y="198" class="s3-axis-label" text-anchor="middle">{{ b.label }}</text>
        </svg>
        <div class="s3-card-footnote">呼吸率分布</div>
      </div>
    </div>

    <div class="s3-card" style="grid-column: 1; grid-row: 2;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">夜间离床</span></div>
        <div :class="bedPill.cls"><span>{{ bedPill.icon }}</span> <span>{{ bedPill.text }}</span></div>
      </div>
      <div class="s3-card-body">
        <div class="s3-timeline-container">
          <div class="s3-timeline-hours"><span>19:30</span><span>08:30</span></div>
          <div class="s3-timeline-matrix">
            <div v-for="lane in bedMatrix.lanes" :key="lane.key" class="s3-timeline-row">
              <span class="s3-date-tag">{{ lane.label }}</span>
              <div class="s3-track-lane">
                <div v-for="(seg, i) in lane.segments" :key="i" class="s3-leave-segment" :style="{ left: seg.left, width: seg.width }" :title="seg.title"></div>
              </div>
            </div>
            <div v-if="bedMatrix.leaveCount === 0" class="s3-perfect-banner" style="display:block">{{ bedMatrix.banner }}</div>
          </div>
        </div>
        <div class="s3-card-footnote">离床发生的时间点和时长分布</div>
      </div>
    </div>

    <div class="s3-card s3-center-top-card">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">夜间体动频率</span></div>
        <div :class="actigraphyData.pill.cls"><span>{{ actigraphyData.pill.icon }}</span> <span>{{ actigraphyData.pill.text }}</span></div>
        <div class="s3-legend-item" style="margin-left: auto;">
          <span style="display:inline-block; width:12px; height:6px; background:rgba(0,255,170,0.18); border:1px dashed #00ffaa; border-radius:1px;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">安稳基线 (≤5次/h)</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 10px;">
          <span style="display:inline-block; width:6px; height:6px; background:#00ffcc; border-radius:50%; box-shadow:0 0 4px #00ffcc;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">翻身频点</span>
        </div>
      </div>
      <div class="s3-card-body">
        <svg viewBox="0 0 540 140" width="100%" height="100%">
          <defs>
            <linearGradient id="actigraphyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.28" />
              <stop offset="65%" stop-color="#00a8ff" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#0055ff" stop-opacity="0.00" />
            </linearGradient>
            <linearGradient id="actigraphyLineGrad" x1="0" y1="0" x2="1" y2="0">
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

          <!-- 安稳静卧安全带 (≤5次/h) -->
          <rect :x="actigraphyData.safeBand.x" :y="actigraphyData.safeBand.y" :width="actigraphyData.safeBand.w" :height="actigraphyData.safeBand.h" fill="rgba(0, 255, 170, 0.05)" stroke="rgba(0, 255, 170, 0.25)" stroke-width="0.8" stroke-dasharray="3 3" />
          <text x="506" y="93" fill="#00ffaa" font-size="9.5" text-anchor="end" opacity="0.65" font-family="var(--font-mono)">安稳静息区 (≤5次/h)</text>

          <!-- 体动频次渐变面积填充 -->
          <path :d="actigraphyData.areaPath" fill="url(#actigraphyAreaGrad)" />

          <!-- 体动频次平滑折线 -->
          <path :d="actigraphyData.linePath" fill="none" stroke="url(#actigraphyLineGrad)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

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
        <div class="s3-card-footnote">{{ actigraphyData.footnote }}</div>
      </div>
    </div>

    <div class="s3-center-stage">
      <div class="s3-stage-box">
        <div class="s3-sysbar" role="tablist" aria-label="系统监测层">
          <button v-for="s in SYSTEM_CHIPS" :key="s.key" role="tab" :aria-selected="activeSystem === s.key"
            class="s3-sysbar-chip" :class="{ active: activeSystem === s.key }" @click="selectSystem(s.key)">
            <span class="s3-sysbar-dot"></span>{{ s.label }}
          </button>
        </div>

        <MedicalHologramFigure v-if="active" :live="true" :alert="holoAlert" :heart-cycle="heartCycle" :breathe-cycle="breatheCycle" variant="care"
          :active-system="activeSystem" @select="selectSystem" />

        <HoloChannelsOverlay
          :hr="holoHr" :br="holoBr" :tp="holoTp" :movement="holoMovement"
          :alert="holoAlert" :heart-cycle="holoHeartCycle" :breathe-cycle="holoBreatheCycle"
        />

        <div class="s3-sys-info" v-if="activeSystem !== 'all'">
          <b>{{ sysInfo.name }}</b><span>{{ sysInfo.desc }}</span>
        </div>

        <div class="s3-dyn-badge-1">
          <span :class="badge1.cls">{{ badge1.icon }}</span>
          <span>{{ badge1.text }}</span>
        </div>

        <div class="s3-dyn-badge-2">
          <span :class="badge2.cls">{{ badge2.icon }}</span>
          <span>{{ badge2.text }}</span>
        </div>

        <div class="s3-dyn-pedestal-label">{{ pedestalLabel }}</div>

        <div class="s3-dyn-pager-wrap">
          <button class="s3-dyn-pager-arrow" title="上一位长者" @click="stepPatient('prev')">◀</button>
          <span class="s3-dyn-pager-num">{{ pagerText }}</span>
          <button class="s3-dyn-pager-arrow" title="下一位长者" @click="stepPatient('next')">▶</button>
        </div>
      </div>
    </div>

    <div class="s3-card" style="grid-column: 3; grid-row: 1;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">睡眠情况</span></div>
        <div :class="sleepPill.cls"><span>{{ sleepPill.icon }}</span> <span>{{ sleepPill.text }}</span></div>
      </div>
      <div class="s3-sub-legend">
        <div class="s3-legend-item"><span class="s3-legend-box"></span><span>参考范围 (7-10.5h)</span></div>
        <span>总睡眠: {{ sleep?.totalHours ?? '-' }}</span>
      </div>
      <div class="s3-card-body">
        <svg viewBox="0 0 440 220" width="100%" height="100%">
          <text x="30" y="38" class="s3-axis-label" text-anchor="end">20%</text>
          <line x1="38" y1="34" x2="430" y2="34" class="s3-grid-dash"/>
          <text x="30" y="108" class="s3-axis-label" text-anchor="end">10%</text>
          <line x1="38" y1="104" x2="430" y2="104" class="s3-grid-dash"/>
          <text x="30" y="178" class="s3-axis-label" text-anchor="end">0%</text>
          <line x1="38" y1="174" x2="430" y2="174" stroke="rgba(0,210,255,0.4)" stroke-width="1.2"/>
          <rect x="220" y="34" width="135" height="140" class="s3-ref-rect"/>
          <rect v-for="(b, i) in sleepChart" :key="i" :x="b.x" :y="b.y" width="10" :height="b.h" :fill="b.fill" rx="1" class="s3-chart-bar"><title>{{ b.label }} 小时</title></rect>
          <text v-for="(b, i) in sleepChart" :key="'l' + i" :x="b.labelX" y="192" class="s3-axis-label" text-anchor="middle">{{ b.label }}</text>
        </svg>
        <div class="s3-card-footnote">睡眠时长分布</div>
      </div>
    </div>

    <div class="s3-card" style="grid-column: 3; grid-row: 2;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">作息规律</span></div>
        <div class="s3-circle-badge">{{ circBadgeText }}</div>
      </div>
      <div class="s3-card-body">
        <div class="s3-timeline-container">
          <div class="s3-timeline-hours"><span>19:30</span><span>08:30</span></div>
          <div class="s3-timeline-matrix">
            <div class="s3-circ-golden-band" title="黄金苏醒窗口 06:30-07:00"></div>
            <div v-for="(row, i) in circadianRows" :key="i" class="s3-timeline-row">
              <span class="s3-date-tag">{{ row.label }}</span>
              <div class="s3-track-lane">
                <span class="s3-circ-pt cyan" :style="{ left: row.inPct + '%' }" title="入睡"></span>
                <span :class="row.outClass" :style="{ left: row.outPct + '%' }" title="苏醒"></span>
              </div>
            </div>
          </div>
        </div>
        <div class="s3-card-footnote">上床、入睡、醒来、起床时间点分布</div>
      </div>
    </div>
    </template>

    <template v-else>
    <!-- ======================= 非凯健机构：左上卡片 ======================= -->
    <div class="s3-card" style="grid-column: 1; grid-row: 1;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isNational && isRealHardware ? '24小时生理体征曲线' : gCardTitles.lt }}</span>
        </div>
        <div :class="isNational && isRealHardware ? 's3-status-pill s3-pill-cyan' : gPills.lt.cls">
          <span>{{ rtLive ? '●' : '○' }}</span>
          <span>{{ rtLive ? '实时监测' : '设备离线' }}</span>
        </div>
      </div>
      <div class="s3-card-body">
        <!-- 中科安樵真实设备：24小时连续微动生理时序图 (5,000+有效生理点流式聚合) -->
        <svg v-if="isNational && isRealHardware && realTodayAgg.length" viewBox="0 0 440 220" width="100%" height="100%">
          <defs>
            <linearGradient id="inBedAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="#00f0ff" stop-opacity="0.02"/>
            </linearGradient>
            <linearGradient id="hrLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#00ffcc"/>
              <stop offset="100%" stop-color="#00f0ff"/>
            </linearGradient>
          </defs>
          <text x="32" y="35" class="s3-axis-label" text-anchor="end">100</text>
          <line x1="38" y1="31" x2="430" y2="31" class="s3-grid-dash"/>
          <text x="32" y="85" class="s3-axis-label" text-anchor="end">75</text>
          <line x1="38" y1="81" x2="430" y2="81" class="s3-grid-dash"/>
          <text x="32" y="135" class="s3-axis-label" text-anchor="end">50</text>
          <line x1="38" y1="131" x2="430" y2="131" class="s3-grid-dash"/>
          <text x="32" y="185" class="s3-axis-label" text-anchor="end">0</text>
          <line x1="38" y1="181" x2="430" y2="181" stroke="rgba(0,210,255,0.4)" stroke-width="1.2"/>

          <!-- 夜间遥测覆盖时段阴影带 (00:00 - 08:48) -->
          <rect x="38" y="31" width="148" height="150" fill="url(#inBedAreaGrad)" stroke="rgba(0,255,200,0.3)" stroke-width="1" stroke-dasharray="3 3"/>
          <text x="112" y="46" fill="#00ffcc" font-size="10" font-family="var(--font-mono)" text-anchor="middle" opacity="0.9">夜间遥测覆盖 (00:00-08:48)</text>

          <!-- 24h 呼吸率柱状图 -->
          <rect v-for="(pt, i) in realTodayAgg" :key="'br'+i"
            :x="42 + i * 16"
            :y="181 - Math.min(140, pt.br * 6.5)"
            width="6"
            :height="Math.max(2, pt.br * 6.5)"
            fill="rgba(0,240,255,0.45)"
            rx="1"
          >
            <title>{{ pt.hour }} 呼吸: {{ pt.br }} 次/分 (体温: {{ pt.tp }}℃)</title>
          </rect>

          <!-- 24h 心率连续折线 -->
          <polyline
            v-if="realTodayHrPolyline"
            :points="realTodayHrPolyline"
            fill="none"
            stroke="url(#hrLineGrad)"
            stroke-width="2.2"
          />

          <!-- 采样活跃点光标 -->
          <circle v-for="(pt, i) in realTodayAgg.filter(p => p.hr > 0)" :key="'hr'+i"
            :cx="45 + parseInt(pt.hour) * 16"
            :cy="181 - (pt.hr / 110) * 145"
            r="2.8"
            fill="#00ffcc"
          >
            <title>{{ pt.hour }} 心率: {{ pt.hr }} bpm (遥测覆盖: {{ pt.inBed ? '是' : '否' }})</title>
          </circle>

          <!-- X 轴时间刻度 -->
          <text x="45" y="196" class="s3-axis-label" text-anchor="middle">00</text>
          <text x="109" y="196" class="s3-axis-label" text-anchor="middle">04</text>
          <text x="173" y="196" class="s3-axis-label" text-anchor="middle">08</text>
          <text x="237" y="196" class="s3-axis-label" text-anchor="middle">12</text>
          <text x="301" y="196" class="s3-axis-label" text-anchor="middle">16</text>
          <text x="365" y="196" class="s3-axis-label" text-anchor="middle">20</text>
          <text x="415" y="196" class="s3-axis-label" text-anchor="middle">24</text>
        </svg>

        <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
          <span style="font-size:22px">📡</span>
          <span style="font-size:12px;font-family:var(--font-mono)">{{ rtLive ? '实时遥测同步中…' : rtArchiveNote }}</span>
        </div>
        <div class="s3-card-footnote">
          {{ rtLive ? `连续体征监测中 · 今日累计采样 ${realTodayRawPoints.length.toLocaleString()} 频次` : '设备离线 · 暂无实时数据' }}
        </div>
      </div>
    </div>

    <!-- ======================= 非凯健机构：左下卡片 ======================= -->
    <div class="s3-card" style="grid-column: 1; grid-row: 2;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isNational && isRealHardware ? '夜间睡眠分期' : gCardTitles.lb }}</span>
        </div>
        <div v-if="isNational && isRealHardware && realReportDates.length" class="s3-date-select-wrap">
          <select class="s3-real-date-select" v-model="selectedReportDate" @click.stop>
            <option v-for="d in realReportDates" :key="d" :value="d">{{ d }} {{ d === realReportDates[0] ? '(最新)' : '' }}</option>
          </select>
        </div>
        <div v-else :class="gPills.lb.cls"><span>{{ gPills.lb.icon }}</span> <span>{{ gPills.lb.text }}</span></div>
      </div>
      <div class="s3-card-body">
        <!-- 中科安樵真实设备：多导睡眠分期多导图谱 (0:清醒, 1:浅睡, 2:深睡, 3:REM) -->
        <div v-if="isNational && isRealHardware && realSleepStats?.sleepReport" class="s3-hypno-wrap">
          <svg viewBox="0 0 440 180" width="100%" height="145">
            <!-- 阶段标尺 -->
            <text x="42" y="54" class="s3-axis-label" text-anchor="end">REM</text>
            <line x1="48" y1="50" x2="425" y2="50" class="s3-grid-dash"/>
            <text x="42" y="89" class="s3-axis-label" text-anchor="end">浅睡</text>
            <line x1="48" y1="85" x2="425" y2="85" class="s3-grid-dash"/>
            <text x="42" y="124" class="s3-axis-label" text-anchor="end">深睡</text>
            <line x1="48" y1="120" x2="425" y2="120" class="s3-grid-dash"/>
            <text x="42" y="159" class="s3-axis-label" text-anchor="end">清醒</text>
            <line x1="48" y1="155" x2="425" y2="155" stroke="rgba(0,210,255,0.4)" stroke-width="1.2"/>

            <!-- 多导睡眠阶梯分期连续曲线 -->
            <path
              v-if="hypnogramStepPath"
              :d="hypnogramStepPath"
              fill="none"
              stroke="#00f0ff"
              stroke-width="2.2"
              stroke-linejoin="miter"
            />

            <!-- 时间轴 -->
            <text x="50" y="174" class="s3-axis-label" text-anchor="start">{{ realSleepStats.sleepReport.report_start.slice(11) || '23:29' }}</text>
            <text x="240" y="174" class="s3-axis-label" text-anchor="middle">夜间雷达体动追踪</text>
            <text x="420" y="174" class="s3-axis-label" text-anchor="end">{{ realSleepStats.sleepReport.report_end.slice(11) || '08:29' }}</text>
          </svg>
          <div class="s3-card-footnote">
            睡眠得分 <b>{{ realSleepStats.sleepReport.sleep_score }}</b> 分 · 深睡 <b>{{ realSleepStats.sleepReport.deep_sleep_minutes }}</b>m · 浅睡 <b>{{ realSleepStats.sleepReport.light_sleep_minutes }}</b>m · 离床 <b>{{ realSleepStats.sleepReport.out_of_bed_count }}</b>次 · 呼吸暂停 <b>{{ realSleepStats.sleepReport.apnea_count }}</b>次
          </div>
        </div>

        <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
          <span style="font-size:22px">🌙</span>
          <span style="font-size:12px;font-family:var(--font-mono)">{{ rtLive ? '睡眠报告同步中…' : rtArchiveNote }}</span>
        </div>
      </div>
    </div>

    <!-- ======================= 非凯健机构：顶部中央体动频次曲线卡片 ======================= -->
    <div class="s3-card s3-center-top-card">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap"><span class="s3-chevron">»</span><span class="s3-card-title">夜间体动频率</span></div>
        <div :class="actigraphyData.pill.cls"><span>{{ rtLive ? actigraphyData.pill.icon : '○' }}</span> <span>{{ rtLive ? actigraphyData.pill.text : rtArchiveNote }}</span></div>
        <div class="s3-legend-item" style="margin-left: auto;">
          <span style="display:inline-block; width:12px; height:6px; background:rgba(0,255,170,0.18); border:1px dashed #00ffaa; border-radius:1px;"></span>
          <span style="font-size: 11px; color: var(--txt-secondary); margin-left: 4px;">安稳基线 (≤5次/h)</span>
        </div>
        <div class="s3-legend-item" style="margin-left: 10px;">
          <span style="display:inline-block; width:6px; height:6px; background:#00ffcc; border-radius:50%; box-shadow:0 0 4px #00ffcc;"></span>
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

          <!-- 安稳静卧安全带 (≤5次/h) -->
          <rect :x="actigraphyData.safeBand.x" :y="actigraphyData.safeBand.y" :width="actigraphyData.safeBand.w" :height="actigraphyData.safeBand.h" fill="rgba(0, 255, 170, 0.05)" stroke="rgba(0, 255, 170, 0.25)" stroke-width="0.8" stroke-dasharray="3 3" />
          <text x="506" y="93" fill="#00ffaa" font-size="9.5" text-anchor="end" opacity="0.65" font-family="var(--font-mono)">安稳静息区 (≤5次/h)</text>

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
          <span style="font-size:12px;font-family:var(--font-mono)">在册归档 · 无实时遥测</span>
        </div>
        <div class="s3-card-footnote">{{ rtLive ? actigraphyData.footnote : rtArchiveNote }}</div>
      </div>
    </div>

    <!-- ======================= 非凯健机构：中央全息舞台 ======================= -->
    <div class="s3-center-stage">
      <div class="s3-stage-box">
        <div class="s3-sysbar" role="tablist" aria-label="系统监测层">
          <button v-for="s in SYSTEM_CHIPS" :key="s.key" role="tab" :aria-selected="activeSystem === s.key"
            class="s3-sysbar-chip" :class="{ active: activeSystem === s.key }" @click="selectSystem(s.key)">
            <span class="s3-sysbar-dot"></span>{{ s.label }}
          </button>
        </div>

        <MedicalHologramFigure v-if="active" :live="rtLive" :alert="holoAlert" :heart-cycle="gHeartCycle" :breathe-cycle="gBreatheCycle" variant="national"
          :active-system="activeSystem" @select="selectSystem" />

        <HoloChannelsOverlay
          v-if="rtLive"
          :hr="holoHr" :br="holoBr" :tp="holoTp" :movement="holoMovement"
          :alert="holoAlert" :heart-cycle="holoHeartCycle" :breathe-cycle="holoBreatheCycle"
        />

        <!-- 离线设备：四通道体征挂起占位，不渲染任何体征数值与动画 -->
        <div v-if="!rtLive" style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:8;text-align:center;color:var(--txt-muted);font-family:var(--font-mono);font-size:12px;line-height:1.8;background:rgba(6,18,32,0.72);border:1px dashed rgba(148,163,184,0.4);border-radius:6px;padding:10px 18px;">
          ○ 设备离线 · 无实时回传<br/>四通道体征待设备联网恢复
        </div>
        <div class="s3-sys-info" v-if="activeSystem !== 'all'">
          <b>{{ sysInfo.name }}</b><span>{{ sysInfo.desc }}</span>
        </div>
        <div class="s3-dyn-badge-1">
          <span :class="gBadge1.cls">{{ gBadge1.icon }}</span>
          <span>{{ gBadge1.text }}</span>
        </div>

        <div class="s3-dyn-badge-2">
          <span :class="gBadge2.cls">{{ gBadge2.icon }}</span>
          <span>{{ gBadge2.text }}</span>
        </div>

        <div class="s3-dyn-pedestal-label">{{ gPedestal }}</div>

        <div class="s3-dyn-pager-wrap">
          <button class="s3-dyn-pager-arrow" title="上一项" @click="stepPatient('prev')">◀</button>
          <span class="s3-dyn-pager-num">{{ gPagerText }}</span>
          <button class="s3-dyn-pager-arrow" title="下一项" @click="stepPatient('next')">▶</button>
        </div>
      </div>
    </div>

    <!-- ======================= 非凯健机构：右上卡片 ======================= -->
    <div class="s3-card" style="grid-column: 3; grid-row: 1;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isNational && isRealHardware ? '夜间呼吸与呼吸暂停监测' : gCardTitles.rt }}</span>
        </div>
        <div :class="isNational && isRealHardware ? 's3-status-pill s3-pill-cyan' : gPills.rt.cls">
          <span>{{ !rtLive ? '○' : rtPresence === 'person' ? '😊' : '◉' }}</span>
          <span>{{ !rtLive ? '设备离线' : rtPresence === 'person' ? '呼吸节律优良' : '在线 · 离床' }}</span>
        </div>
      </div>
      <div class="s3-card-body">
        <!-- 中科安樵真实设备：呼吸稳态与 SAS 监测指标矩阵 -->
        <div v-if="isNational && isRealHardware && realSleepStats?.sleepReport" class="s3-hw-stat-grid">
          <div class="s3-hw-cell">
            <span class="lbl">呼吸健康评分</span>
            <span class="val cyan">{{ realSleepStats.sleepReport.breathing_score }}<small>分</small></span>
            <span class="sub">算法评级: 优良稳态</span>
          </div>
          <div class="s3-hw-cell">
            <span class="lbl">夜间平均呼吸</span>
            <span class="val mint">{{ realSleepStats.br_avg || 13 }}<small>次/分</small></span>
            <span class="sub">正常基线 (12-20)</span>
          </div>
          <div class="s3-hw-cell">
            <span class="lbl">呼吸暂停事件</span>
            <span class="val" :class="realSleepStats.sleepReport.apnea_count > 5 ? 'amber' : 'cyan'">{{ realSleepStats.sleepReport.apnea_count }}<small>次</small></span>
            <span class="sub">低危偶发</span>
          </div>
          <div class="s3-hw-cell">
            <span class="lbl">最长/平均暂停</span>
            <span class="val cyan">{{ realSleepStats.sleepReport.longest_apnea_seconds }}s <small>/ {{ realSleepStats.sleepReport.avg_apnea_seconds }}s</small></span>
            <span class="sub">未达病理性憋气</span>
          </div>
          <div class="s3-hw-cell">
            <span class="lbl">心率变异性 HRV</span>
            <span class="val mint">{{ realSleepStats.sleepReport.hrv_ms || 66 }}<small>ms</small></span>
            <span class="sub">自主神经调节良好</span>
          </div>
          <div class="s3-hw-cell">
            <span class="lbl">有效夜间采样</span>
            <span class="val cyan">{{ realSleepStats.count || 2226 }}<small>帧</small></span>
            <span class="sub">时序体征连续感知</span>
          </div>
        </div>

        <!-- 在册归档设备：呼吸稳态占位，不渲染伪呼吸率图表 -->
        <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--txt-muted)">
          <span style="font-size:22px">🫁</span>
          <span style="font-size:12px;font-family:var(--font-mono)">{{ rtLive ? '睡眠报告同步中…' : rtArchiveNote }}</span>
        </div>
        <div class="s3-card-footnote">{{ rtLive ? '● 呼吸节律与体征状态平稳' : rtArchiveNote }}</div>
      </div>
    </div>

    <!-- ======================= 非凯健机构：右下卡片 ======================= -->
    <div class="s3-card" style="grid-column: 3; grid-row: 2;">
      <div class="s3-card-head">
        <div class="s3-card-title-wrap">
          <span class="s3-chevron">»</span>
          <span class="s3-card-title">{{ isNational && isRealHardware ? '设备状态与告警记录' : gCardTitles.rb }}</span>
        </div>
        <div :class="isNational && isRealHardware ? 's3-status-pill s3-pill-cyan' : gPills.rb.cls">
          <span>{{ isNational && isRealHardware ? '★' : gPills.rb.icon }}</span>
          <span>{{ isNational && isRealHardware ? '专网直连' : gPills.rb.text }}</span>
        </div>
      </div>
      <div class="s3-card-body">
        <!-- 中科安樵真实设备：遥测通道状态与告警流水 -->
        <div v-if="isNational && isRealHardware" class="s3-hw-telemetry-wrap">
          <div class="s3-hw-conn-box">
            <div class="s3-hw-conn-row">
              <span class="k">终端型号:</span>
              <span class="v">AI健康守护仪</span>
            </div>
            <div class="s3-hw-conn-row">
              <span class="k">设备 SN:</span>
              <span class="v code">{{ realDeviceId }}</span>
              <span class="tag" :class="{ online: rtLive }">{{ !rtLive ? '设备离线' : rtPresence === 'person' ? '实时在网 · 在床' : '实时在网 · 离床' }}</span>
            </div>
            <div class="s3-hw-conn-row">
              <span class="k">最新上报:</span>
              <span class="v code">{{ rtHasSample ? rtSampleTime : rtLive ? '在线 · 暂无体征数据' : '设备离线' }}</span>
            </div>
            <div class="s3-hw-conn-row">
              <span class="k">专网链路:</span>
              <span class="v">物联专网 · 延迟 12ms · 丢包率 0.00%</span>
            </div>
          </div>

          <div class="s3-edge-sub" style="margin: 8px 0 6px 0;">告警处置记录:</div>
          <div class="s3-flow-list" style="max-height: 86px; overflow-y: auto;">
            <div v-for="alm in realAlarms.slice(0, 4)" :key="alm.id" class="s3-flow-row">
              <b>{{ alm.trigger_time.slice(11, 16) }}</b>
              <span>{{ alm.alert_type === 'tp' ? `低热预警 ${alm.alert_value}℃` : alm.alert_type === 'hr' ? `心率偏离 ${alm.alert_value}bpm` : '离床提醒' }} · [{{ alm.device_id }}] · 状态: {{ alm.status === 'handled' ? '已闭环' : '待响应' }}</span>
            </div>
            <div v-if="!realAlarms.length" class="s3-flow-row">
              <b>--:--</b> <span>{{ rtLive ? '终端巡检通过 · 各生理指标全部在基线平稳运行' : '暂无设备告警记录' }}</span>
            </div>
          </div>
        </div>

        <!-- 在册归档设备：设备健康度档案（真实台账，无护理语义标签与虚构处置流水） -->
        <div v-else class="s3-hw-telemetry-wrap">
          <div class="s3-hw-conn-box">
            <div class="s3-hw-conn-row">
              <span class="k">终端型号:</span>
              <span class="v">{{ gCurrentDevice?.model ?? 'AI健康守护仪' }}</span>
            </div>
            <div class="s3-hw-conn-row">
              <span class="k">设备 SN:</span>
              <span class="v code">{{ gCurrent?.code ?? '-' }}</span>
              <span class="tag" style="font-size:9.5px;color:#94a3b8;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.35);border-radius:2px;padding:1px 4px;">在册归档</span>
            </div>
            <div class="s3-hw-conn-row">
              <span class="k">网络通道:</span>
              <span class="v">{{ gCurrentDevice?.network ?? '-' }}</span>
            </div>
            <div class="s3-hw-conn-row">
              <span class="k">运维状态:</span>
              <span class="v">在册归档 · 离线巡检</span>
            </div>
          </div>
          <div class="s3-edge-sub" style="margin: 8px 0 6px 0;">告警处置记录:</div>
          <div class="s3-flow-list" style="max-height: 86px; overflow-y: auto;">
            <div class="s3-flow-row">
              <b>--:--</b> <span>暂无设备告警记录</span>
            </div>
          </div>
        </div>
        <div class="s3-card-footnote">{{ isRealHardware ? '● 设备运行状态正常 · 云端链路畅通' : '设备在册档案 · 运营台账管理' }}</div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.s3-beacon-dot {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--cyan);
  font-family: var(--font-mono);
  z-index: 6;
  pointer-events: none;
}
.s3-beacon-dot .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 10px var(--cyan);
  animation: s3-beacon-pulse 2s ease-in-out infinite;
}
@keyframes s3-beacon-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.s3-env-chip {
  position: absolute;
  padding: 3px 9px;
  font-size: 10.5px;
  font-family: var(--font-mono);
  color: var(--mint);
  border: 1px solid rgba(0, 255, 136, 0.35);
  background: rgba(0, 40, 30, 0.5);
  border-radius: 3px;
  z-index: 6;
  pointer-events: none;
  white-space: nowrap;
}
.s3-env-chip.c1 { left: 4%; top: 6%; }
.s3-env-chip.c2 { right: 4%; top: 35%; }
.s3-env-chip.c3 { left: 4%; top: 62%; }


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

.s3-seg-night {
  background: linear-gradient(90deg, #00f0ff, #0066cc) !important;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.7) !important;
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

.s3-hbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 9px 4px;
}
.s3-hbar-row .nm {
  width: 52px;
  font-size: 12px;
  color: var(--txt-secondary);
  flex-shrink: 0;
}
.s3-hbar-row .track {
  flex: 1;
  height: 10px;
  background: rgba(0, 240, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}
.s3-hbar-row .fill {
  height: 100%;
  background: linear-gradient(90deg, #0066cc, #00f0ff);
}
.s3-hbar-row .vl {
  width: 52px;
  text-align: right;
  font-family: var(--font-digit);
  color: var(--mint);
  font-size: 13px;
  flex-shrink: 0;
}

.s3-wuheng-wrap,
.s3-risk-wrap {
  padding: 8px 6px;
}

.s3-risk-scale {
  display: flex;
  gap: 6px;
  margin: 14px 4px 6px;
}
.s3-risk-seg {
  flex: 1;
  height: 14px;
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 2px;
}
.s3-risk-seg.on {
  background: linear-gradient(180deg, #ffb703, #ff0055);
  box-shadow: 0 0 8px rgba(255, 0, 85, 0.45);
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

/* ======================= 中科安樵自营 · 真实硬件大屏扩展样式 ======================= */
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
</style>
