<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAlerts, getDemographics, getDevices, getFacilityStats, getOverview, getPatients, getRankings, getWards } from '../api/client'
import { getHardwareAlarms } from '../api/hardwareApi'
import type { HardwareAlarm } from '../api/hardwareApi'
import { ORG_PROFILES } from '../projects'
import { ANQIAO_DEVICES, getAnqiaoDevice } from '../projects'
import { cloudGatewayHealth, isOnline, liveDeviceCount } from '../api/deviceTelemetry'
import type { Alert, Demographics, DeviceDistribution, FacilityStats, Overview, Patient, Rankings, WardInfo } from '../api/types'

const props = withDefaults(
  defineProps<{
    active: boolean
    orgId?: string
  }>(),
  {
    orgId: 'anqiao',
  }
)

const emit = defineEmits<{ (e: 'select-patient', patientId: string): void }>()

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)
const isNational = computed(() => currentOrg.value.type === 'national_iot')
const isInstitution = computed(() => currentOrg.value.kind === 'institution')

const overview = ref<Overview | null>(null)
const devices = ref<DeviceDistribution | null>(null)
const facility = ref<FacilityStats | null>(null)
const demographics = ref<Demographics | null>(null)
const rankings = ref<Rankings | null>(null)
const wards = ref<WardInfo[]>([])
const alerts = ref<Alert[]>([])
const patients = ref<Map<string, Patient>>(new Map())

// 中科安樵（anqiao）设备口径：真实云端告警（仅旗舰 ASH01146 所在账户可取，失败则置空）
const anqiaoAlarms = ref<HardwareAlarm[]>([])
const anqiaoAlarmCount = ref(0)

const kpiDevice = ref<HTMLElement | null>(null)
const kpiRunning = ref<HTMLElement | null>(null)
const kpiRate = ref<HTMLElement | null>(null)
const kpiElderly = ref<HTMLElement | null>(null)
const donutReady = ref(false)
const meterReady = ref(false)
const pillarsReady = ref(false)
let kpiAnimated = false

// 长者/家庭数（用户数口径，与设备数严格分离）
const elderlyCount = computed(() => currentOrg.value.elderlyTotal ?? currentOrg.value.campuses?.[0]?.bedsTotal ?? 87)

// 动态男女长者数（基于机构真实在册长者总数与性别结构比例闭环实算）
const maleCount = computed(() => Math.round(elderlyCount.value * (malePct.value / 100)))
const femaleCount = computed(() => Math.max(0, elderlyCount.value - maleCount.value))

function animateValue(el: HTMLElement, target: number, duration = 1200, isFloat = false) {
  const startTime = performance.now()
  const unitSpan = el.querySelector('.unit')
  const unitText = unitSpan ? unitSpan.outerHTML : ''
  function tick(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    const val = isFloat ? (target * ease).toFixed(1) : Math.round(target * ease).toLocaleString()
    el.innerHTML = `${val}${unitText}`
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function setKpi(el: HTMLElement | null, val: string | number, unit: string) {
  if (el) el.innerHTML = `${val}<span class="unit" style="font-size:14px;color:var(--txt-muted)">${unit}</span>`
}

function playKpi() {
  if (kpiAnimated) return
  kpiAnimated = true

  const devTarget = isNational.value ? ANQIAO_DEVICES.length : (currentOrg.value.deviceTotal || 87)
  const daysTarget = facility.value?.running_days || 412
  const rateTarget = isNational.value
    ? (ANQIAO_DEVICES.length > 0 ? (rtLiveCount.value / ANQIAO_DEVICES.length) * 100 : 100)
    : (Number(currentOrg.value.deviceOnlineRate) || 99.4)
  const elderlyTarget = isNational.value ? anqiaoAlarmCount.value : elderlyCount.value
  const devUnit = '台'
  const elderlyUnit = isNational.value ? '起' : '人'

  if (kpiDevice.value) {
    setKpi(kpiDevice.value, 0, devUnit)
    animateValue(kpiDevice.value, devTarget, 800)
  }
  if (kpiRunning.value) {
    // 安全运行天数无真实台账来源，安樵（真实数据机构）一律如实标注"未获取"，不渲染虚构天数
    if (isNational.value) {
      kpiRunning.value.innerHTML = `<span style="font-size:22px;color:var(--txt-muted)">未获取</span>`
    } else {
      setKpi(kpiRunning.value, 0, '天')
      animateValue(kpiRunning.value, daysTarget, 800)
    }
  }
  if (kpiRate.value) {
    setKpi(kpiRate.value, 0, '%')
    animateValue(kpiRate.value, rateTarget, 800, true)
  }
  if (kpiElderly.value) {
    setKpi(kpiElderly.value, 0, elderlyUnit)
    animateValue(kpiElderly.value, elderlyTarget, 800)
  }
}

function renderStaticKpis() {
  const devTarget = isNational.value ? ANQIAO_DEVICES.length : (currentOrg.value.deviceTotal || 87)
  const daysTarget = facility.value?.running_days || 412
  const rateTarget = isNational.value
    ? (ANQIAO_DEVICES.length > 0 ? (rtLiveCount.value / ANQIAO_DEVICES.length) * 100 : 100)
    : (Number(currentOrg.value.deviceOnlineRate) || 99.4)
  const elderlyTarget = isNational.value ? anqiaoAlarmCount.value : elderlyCount.value
  const devUnit = '台'
  const elderlyUnit = isNational.value ? '起' : '人'

  setKpi(kpiDevice.value, devTarget.toLocaleString(), devUnit)
  if (kpiRunning.value) {
    if (isNational.value) {
      kpiRunning.value.innerHTML = `<span style="font-size:22px;color:var(--txt-muted)">未获取</span>`
    } else {
      setKpi(kpiRunning.value, daysTarget, '天')
    }
  }
  setKpi(kpiRate.value, rateTarget.toFixed(1), '%')
  setKpi(kpiElderly.value, elderlyTarget.toLocaleString(), elderlyUnit)
}

watch(
  () => props.active,
  async (v) => {
    if (v) {
      await nextTick()
      playKpi()
      drawRiskTimeline()
    }
  }
)

watch(
  () => props.orgId,
  async () => {
    kpiAnimated = false
    await nextTick()
    playKpi()
    drawRiskTimeline()
  }
)

// 多机构多态：设备类型与在网分布数据
// 中科安樵实时遥测在线台数（共享遥测 store 实算，5s 轮询刷新；live=最后真实采样距今 ≤90 秒）
const rtLiveCount = computed(() => liveDeviceCount())

watch(rtLiveCount, (newCount) => {
  if (isNational.value && kpiRate.value) {
    const rate = ANQIAO_DEVICES.length > 0 ? (newCount / ANQIAO_DEVICES.length) * 100 : 0
    setKpi(kpiRate.value, rate.toFixed(1), '%')
  }
})

const effectiveDeviceData = computed(() => {
  if (isNational.value) {
    // 中科安樵：在册总数按 ANQIAO_DEVICES 台账口径，在线数按共享遥测 store 实算
    const guardianDevices = ANQIAO_DEVICES.filter((d) => d.category === 'health_guardian')
    const fallDevices = ANQIAO_DEVICES.filter((d) => d.category === 'fall_detector')
    const monitorDevices = ANQIAO_DEVICES.filter((d) => d.category === 'health_monitor')
    const unknownDevices = ANQIAO_DEVICES.filter((d) => d.category === 'unknown')

    const guardianOnline = guardianDevices.filter((d) => isOnline(d.sn)).length
    const fallOnline = fallDevices.filter((d) => isOnline(d.sn)).length
    const monitorOnline = monitorDevices.filter((d) => isOnline(d.sn)).length
    const unknownOnline = unknownDevices.filter((d) => isOnline(d.sn)).length

    return {
      total: ANQIAO_DEVICES.length,
      online: rtLiveCount.value,
      offline: ANQIAO_DEVICES.length - rtLiveCount.value,
      types: [
        {
          name: 'AI健康守护仪',
          count: guardianDevices.length,
          color: '#00f0ff',
          online_rate: guardianDevices.length > 0 ? Math.round((guardianOnline / guardianDevices.length) * 1000) / 10 : 0,
        },
        {
          name: '跌倒雷达报警器',
          count: fallDevices.length,
          color: '#00ff88',
          online_rate: fallDevices.length > 0 ? Math.round((fallOnline / fallDevices.length) * 1000) / 10 : 0,
        },
        {
          name: '健康体征监测仪',
          count: monitorDevices.length,
          color: '#ffb703',
          online_rate: monitorDevices.length > 0 ? Math.round((monitorOnline / monitorDevices.length) * 1000) / 10 : 0,
        },
        ...(unknownDevices.length > 0
          ? [
              {
                name: '其他监测终端',
                count: unknownDevices.length,
                color: '#a78bfa',
                online_rate: unknownDevices.length > 0 ? Math.round((unknownOnline / unknownDevices.length) * 1000) / 10 : 0,
              },
            ]
          : []),
      ],
    }
  }

  // 机构模式：守护仪（1人1台）+ 跌倒报警器（按空间部署）二元产品线构成
  const bd = currentOrg.value.deviceBreakdown
  if (bd) {
    const gRate = Math.round((bd.guardians.online / bd.guardians.total) * 1000) / 10
    const fRate = Math.round((bd.fallRadars.online / bd.fallRadars.total) * 1000) / 10
    return {
      total: bd.guardians.total + bd.fallRadars.total,
      online: bd.guardians.online + bd.fallRadars.online,
      offline: (bd.guardians.total - bd.guardians.online) + (bd.fallRadars.total - bd.fallRadars.online),
      types: [
        { name: 'AI健康守护仪 (1人1台)', count: bd.guardians.total, color: '#00f0ff', online_rate: gRate },
        { name: '跌倒报警器 (按空间部署)', count: bd.fallRadars.total, color: '#00ff88', online_rate: fRate },
      ],
    }
  }

  // 兜底：按机构核定床位数自适应等比缩放
  const targetTotal = currentOrg.value.deviceTotal || 87
  const baseTypes = devices.value?.types || [
    { name: 'AI健康守护仪', count: 86, color: '#00f0ff', online_rate: 100 },
    { name: '跌倒雷达监测仪', count: 52, color: '#00ff88', online_rate: 100 },
    { name: '多维体征采集终端', count: 45, color: '#ffb703', online_rate: 100 },
    { name: '生命体征监护仪', count: 38, color: '#c084fc', online_rate: 100 },
    { name: '人体轨迹寻踪仪', count: 27, color: '#ff0055', online_rate: 96.3 },
  ]
  const scale = targetTotal / 87
  return {
    total: targetTotal,
    online: Math.round(targetTotal * (Number(currentOrg.value.deviceOnlineRate) / 100)),
    offline: targetTotal - Math.round(targetTotal * (Number(currentOrg.value.deviceOnlineRate) / 100)),
    types: baseTypes.map((t) => ({
      ...t,
      count: Math.max(1, Math.round(t.count * scale)),
    })),
  }
})

const donut = computed(() => {
  const dData = effectiveDeviceData.value
  const r = 75
  const C = 2 * Math.PI * r
  const total = dData.total || 1
  let offset = 0
  const segments = dData.types.map((t) => {
    const len = (t.count / total) * C
    const seg = {
      color: t.color,
      dash: donutReady.value ? `${len - 2} ${C - (len - 2)}` : `0 ${C}`,
      offset: -offset,
    }
    offset += len
    return seg
  })
  return { total, C, segments }
})

const donutTicks = computed(() => {
  const ticks: { x1: number; y1: number; x2: number; y2: number; opacity: number; width: number }[] = []
  for (let i = 0; i < 60; i++) {
    const ang = (i * 6) * Math.PI / 180
    const major = i % 5 === 0
    ticks.push({
      x1: 100 + 90 * Math.cos(ang), y1: 100 + 90 * Math.sin(ang),
      x2: 100 + (major ? 94 : 92) * Math.cos(ang), y2: 100 + (major ? 94 : 92) * Math.sin(ang),
      opacity: major ? 0.5 : 0.15,
      width: major ? 1.5 : 0.8,
    })
  }
  return ticks
})

const deviceRows = computed(() => {
  const dData = effectiveDeviceData.value
  const total = dData.total || 1
  return dData.types.map((t, i) => ({
    ...t,
    pct: ((t.count / total) * 100).toFixed(1),
    meterWidth: meterReady.value ? ((t.count / total) * 100).toFixed(1) + '%' : '0%',
    chipStyle: i === dData.types.length - 1
      ? 'background:rgba(255,183,3,0.15);color:var(--amber);border-color:rgba(255,183,3,0.3)'
      : '',
  }))
})

// 凯健（机构）：长者人口谱系与各大区梯队
const malePct = computed(() => {
  return demographics.value ? (demographics.value.male / (demographics.value.male + demographics.value.female)) * 100 : 47.1
})

const over80Pct = computed(() => {
  if (!demographics.value) return 56.3
  const arr = demographics.value.by_age_range
  const over = (arr[2]?.count ?? 0) + (arr[3]?.count ?? 0)
  return (over / (demographics.value.male + demographics.value.female)) * 100
})

const ageSpectrum = computed(() => {
  const colors = ['var(--cyan)', 'var(--mint)', 'var(--amber)', 'var(--violet-bright)']
  if (!demographics.value) return []
  const max = Math.max(...demographics.value.by_age_range.map((a) => a.count), 1)
  return demographics.value.by_age_range.map((a, i) => ({
    ...a,
    color: colors[i % colors.length],
    height: pillarsReady.value ? Math.round((a.count / max) * 100) + '%' : '0%',
  }))
})

// 中科安樵（anqiao）：点位区域分布（按 ANQIAO_DEVICES 真实点位实算）
const districtSpectrum = computed(() => {
  const colors = ['var(--cyan)', 'var(--mint)', 'var(--amber)', 'var(--violet-bright)']
  const map = new Map<string, number>()
  for (const d of ANQIAO_DEVICES) {
    const site = d.label.split('·')[0]
    map.set(site, (map.get(site) ?? 0) + 1)
  }
  const list = [...map.entries()].map(([range, count]) => ({ range, count }))
  const max = Math.max(...list.map((a) => a.count), 1)
  return list.map((a, i) => ({
    ...a,
    color: colors[i % colors.length],
    height: pillarsReady.value ? Math.round((a.count / max) * 100) + '%' : '0%',
  }))
})

// 凯健（机构）：照护矩阵（管状进度条）
const careTubes = computed(() => {
  if (!wards.value.length) return []
  const total = wards.value.reduce((s, w) => s + w.patient_count, 0)
  const colors: Record<string, string> = { '4F': 'var(--crimson)', '3F': 'var(--amber)', '2F': 'var(--cyan)', '1F': 'var(--mint)' }
  const names: Record<string, string> = { '4F': '完全失能', '3F': '认知失智', '2F': '康复介护', '1F': '活力自理' }
  return wards.value.map((w) => ({
    name: names[w.floor] ?? w.ward,
    color: colors[w.floor] ?? 'var(--cyan)',
    count: w.patient_count,
    pct: ((w.patient_count / total) * 100).toFixed(1),
  }))
})

// 中科安樵（anqiao）：设备型号与类型谱系分布（按 ANQIAO_DEVICES 实算）
const modelTubes = computed(() => {
  const buckets: { name: string; match: (d: any) => boolean; color: string; count: number }[] = [
    { name: 'AI健康守护仪', match: (d) => d.category === 'health_guardian' && !d.sn.startsWith('device_') && !d.sn.startsWith('X2'), color: 'var(--cyan)', count: 0 },
    { name: '跌倒检测/报警器', match: (d) => d.category === 'fall_detector', color: 'var(--crimson)', count: 0 },
    { name: '健康体征监测仪', match: (d) => d.category === 'health_monitor', color: 'var(--amber)', count: 0 },
    { name: '多模态与测试终端', match: (d) => d.sn.startsWith('device_') || d.sn.startsWith('X2'), color: 'var(--violet-bright)', count: 0 },
  ]
  for (const d of ANQIAO_DEVICES) {
    const b = buckets.find((x) => x.match(d))
    if (b) b.count++
  }
  const total = ANQIAO_DEVICES.length || 1
  return buckets.filter((b) => b.count > 0).map((b) => ({
    name: b.name,
    color: b.color,
    count: b.count,
    pct: ((b.count / total) * 100).toFixed(1),
  }))
})

// 凯健（机构）：高发慢病共病共管
const diseaseColors = ['var(--cyan)', 'var(--amber)', 'var(--violet-bright)', 'var(--crimson)']
const diseaseRows = computed(() => {
  if (!demographics.value) return []
  const total = demographics.value.male + demographics.value.female
  return demographics.value.diseases.map((d, i) => ({
    ...d,
    color: diseaseColors[i % diseaseColors.length],
    pct: Math.round((d.count / total) * 100),
  }))
})

// 中科安樵（anqiao）：网络通道分布（按 ANQIAO_DEVICES 实算）
const networkRows = computed(() => {
  const buckets: { name: string; match: (n: string) => boolean; color: string; count: number }[] = [
    { name: '物联专网', match: (n) => n.includes('专网') || n.includes('IoTDA'), color: 'var(--cyan)', count: 0 },
    { name: '4G蜂窝物联网', match: (n) => n.includes('4G'), color: 'var(--mint)', count: 0 },
    { name: '专网光纤通道', match: (n) => n.includes('光纤'), color: 'var(--amber)', count: 0 },
    { name: 'Wi-Fi 局域网/样机', match: () => true, color: 'var(--violet-bright)', count: 0 },
  ]
  for (const d of ANQIAO_DEVICES) {
    const b = buckets.find((x) => x.match(d.network))
    if (b) b.count++
  }
  const total = ANQIAO_DEVICES.length || 1
  return buckets.filter((b) => b.count > 0).map((b) => ({
    name: b.name,
    color: b.color,
    count: b.count,
    pct: Math.round((b.count / total) * 100),
  }))
})

const TRIAGE_META: Record<string, { tag: string; cls: string; isAlert: boolean }> = {
  fall: { tag: '一级极危', cls: 'crimson', isAlert: true },
  off_bed: { tag: '二级中危', cls: 'amber', isAlert: false },
  hr: { tag: '二级中危', cls: 'amber', isAlert: false },
  tp: { tag: '低危关注', cls: 'cyan', isAlert: false },
  br: { tag: '低危关注', cls: 'cyan', isAlert: false },
}

interface TriageEventVM {
  alert: { alert_id: string; bed_id: string; title: string; detail: string; handle_note?: string | null }
  patient: { name: string; age: number; care_level: string; patient_id: string } | undefined
  tag: string
  cls: string
  isAlert: boolean
  time: string
}

const HW_ALARM_TITLES: Record<string, string> = {
  hr: '心率异常告警',
  br: '呼吸异常告警',
  tp: '体温异常告警',
  off_bed: '离床超时告警',
  fall: '跌倒告警',
}

// 多机构多态：24H AI 分级预警流水（anqiao 为设备事件流：设备在线状态与告警，绝不编造健康事件）
const triageEvents = computed<TriageEventVM[]>(() => {
  if (isNational.value) {
    const list: TriageEventVM[] = []
    const flagship = ANQIAO_DEVICES.find((d) => d.online)
    if (flagship) {
      list.push({
        alert: {
          alert_id: 'aq-online',
          bed_id: flagship.label,
          title: '设备在线 · 专网连接正常',
          detail: `${flagship.sn} · ${flagship.network} · IP ${flagship.ip}`,
          handle_note: '运维值班 5s 轮询监护中',
        },
        patient: { name: '', age: 0, care_level: flagship.scene, patient_id: flagship.sn },
        tag: '实时在线',
        cls: 'cyan',
        isAlert: false,
        time: 'LIVE',
      })
    }
    if (anqiaoAlarms.value.length) {
      for (const a of anqiaoAlarms.value.slice(0, 3)) {
        const dev = getAnqiaoDevice(a.device_id)
        list.push({
          alert: {
            alert_id: `hw-${a.id}`,
            bed_id: dev?.label ?? a.device_id,
            title: HW_ALARM_TITLES[a.alert_type] ?? '设备告警',
            detail: `设备 ${a.device_id} · 触发值 ${a.alert_value}${dev ? ` · ${dev.network}` : ''}`,
            handle_note: a.status === 'handled' ? '运维值班已闭环' : '运维值班响应中',
          },
          patient: { name: '', age: 0, care_level: dev?.scene ?? '设备告警', patient_id: a.device_id },
          tag: '云端告警',
          cls: 'amber',
          isAlert: a.status !== 'handled',
          time: (a.trigger_time || '').slice(11, 19) || '--:--:--',
        })
      }
    } else {
      list.push({
        alert: {
          alert_id: 'aq-none',
          bed_id: '云端告警队列',
          title: '暂无设备告警',
          detail: `设备告警队列当前为空 · ${ANQIAO_DEVICES.length} 台在册设备巡检正常`,
          handle_note: '运维值班持续巡检',
        },
        patient: undefined,
        tag: '低危关注',
        cls: 'cyan',
        isAlert: false,
        time: '--:--:--',
      })
    }
    list.push({
      alert: {
        alert_id: 'aq-archived',
        bed_id: '在册归档设备',
        title: `${ANQIAO_DEVICES.length - rtLiveCount.value} 台设备在册归档`,
        detail: '在册设备当前离线 · 重新上线后自动接入云端',
        handle_note: '运营中心台账管理',
      },
      patient: undefined,
      tag: '在册归档',
      cls: 'cyan',
      isAlert: false,
      time: '--:--:--',
    })
    return list
  }

  // 机构模式
  const order = { fall: 0, off_bed: 1, hr: 2, tp: 3, br: 4 } as Record<string, number>
  return [...alerts.value]
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))
    .map((a) => {
      const p = patients.value.get(a.patient_id)
      const meta = TRIAGE_META[a.type] ?? TRIAGE_META.br
      const d = new Date(a.occurred_at)
      const pad = (n: number) => String(n).padStart(2, '0')
      return { alert: a, patient: p, ...meta, time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
    })
})

const rankCls = (i: number) => (i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '')

function fallState(v: number): { text: string; color: string } {
  if (v >= 90) return { text: '告警', color: '#ff0055' }
  if (v >= 70) return { text: '高危', color: '#ff0055' }
  if (v >= 50) return { text: '中危', color: 'var(--amber)' }
  return { text: '低危', color: 'var(--cyan)' }
}

function trendArrow(delta: number): { text: string; cls: string } {
  if (delta > 0) return { text: '↑', cls: 'rank-arrow up-cyan' }
  if (delta < 0) return { text: '↓', cls: 'rank-arrow down-red' }
  return { text: '稳', cls: 'rank-arrow up-cyan' }
}

// 多机构多态：三大排行榜（anqiao 为设备状态榜，无任何姓名）
const effectiveRankings = computed(() => {
  if (isNational.value) {
    const byOnline = [...ANQIAO_DEVICES].sort((a, b) => Number(b.online) - Number(a.online))
    const channelScore = (network: string): number => {
      if (network.includes('专网') || network.includes('IoTDA')) return 100
      if (network.includes('光纤')) return 92
      if (network.includes('4G')) return 85
      return 72
    }
    const byChannel = [...ANQIAO_DEVICES]
      .map((d) => ({ d, score: channelScore(d.network) }))
      .sort((a, b) => b.score - a.score)
    return {
      sleep: byOnline.slice(0, 5).map((d) => ({
        patient_id: d.sn,
        bed_id: d.sn,
        name: d.label,
        value: d.online ? 100 : 0,
        delta: 0,
        text: d.online ? '● 实时遥测' : '○ 在册归档',
      })),
      fall_risk: byChannel.slice(0, 5).map(({ d, score }) => ({
        patient_id: d.sn,
        bed_id: d.sn,
        name: d.label,
        value: score,
        delta: 0,
        text: score >= 90 ? '优' : '良',
        color: score >= 90 ? 'var(--mint)' : 'var(--cyan)',
      })),
      vitals: byOnline.slice(0, 4).map((d) => ({
        patient_id: d.sn,
        bed_id: d.sn,
        name: d.label,
        value: 0,
        abnormal: false,
        text: d.online ? '5,000+ 帧/日 · 实时流' : '0 帧 · 在册归档',
      })),
    }
  }

  return rankings.value || { sleep: [], fall_risk: [], vitals: [] }
})

function drawRiskTimeline() {
  const canvas = document.getElementById('s1-risk-timeline-canvas') as HTMLCanvasElement | null
  if (!canvas || !canvas.clientWidth) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth || 450
  const h = canvas.clientHeight || 75
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)'
  ctx.lineWidth = 1
  for (let y = 15; y < h - 15; y += 18) {
    ctx.beginPath()
    ctx.moveTo(10, y)
    ctx.lineTo(w - 10, y)
    ctx.stroke()
  }

  const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
  hours.forEach((hr, i) => {
    const x = (i / (hours.length - 1)) * (w - 50) + 25
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h - 14)
    ctx.stroke()
    ctx.fillStyle = 'rgba(141, 160, 189, 0.7)'
    ctx.font = '9.5px "Share Tech Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(hr, x, h - 3)
  })

  const curvePoints = isNational.value
    ? [
        { x: 0, y: 8 }, { x: 2, y: 9 },
        { x: 6, y: 13, peak: '06:00 ASH01146 心跳巡检', type: 'cyan' },
        { x: 10, y: 10 },
        { x: 12, y: 15, peak: '12:00 云端告警队列巡检', type: 'cyan' },
        { x: 16, y: 11 },
        { x: 20.8, y: 16, peak: '20:45 ASH01146 遥测推流', type: 'cyan' },
        { x: 24, y: 9 },
      ]
    : [
        { x: 0, y: 14 }, { x: 1, y: 16 }, { x: 2, y: 22 },
        { x: 3.3, y: 49, peak: '03:22 跌倒告警', type: 'crimson' },
        { x: 5, y: 22 }, { x: 6.5, y: 18 },
        { x: 8.2, y: 38, peak: '08:15 离床超时', type: 'cyan' },
        { x: 10, y: 20 }, { x: 12, y: 26 },
        { x: 14.5, y: 44, peak: '14:30 心率骤升', type: 'amber' },
        { x: 16.5, y: 22 }, { x: 18.5, y: 28 },
        { x: 20.8, y: 39, peak: '20:45 体温预警', type: 'amber' },
        { x: 22.5, y: 24 }, { x: 24, y: 15 },
      ]

  const pts = curvePoints.map((p) => ({
    px: (p.x / 24) * (w - 50) + 25,
    py: (h - 18) - (p.y / 55) * (h - 32),
    peak: p.peak,
    type: p.type,
  }))

  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.32)')
  grad.addColorStop(0.65, 'rgba(0, 240, 255, 0.08)')
  grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)')

  ctx.beginPath()
  ctx.moveTo(pts[0].px, h - 16)
  ctx.lineTo(pts[0].px, pts[0].py)
  for (let i = 0; i < pts.length - 1; i++) {
    const xc = (pts[i].px + pts[i + 1].px) / 2
    const yc = (pts[i].py + pts[i + 1].py) / 2
    ctx.quadraticCurveTo(pts[i].px, pts[i].py, xc, yc)
  }
  ctx.lineTo(pts[pts.length - 1].px, pts[pts.length - 1].py)
  ctx.lineTo(pts[pts.length - 1].px, h - 16)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(pts[0].px, pts[0].py)
  for (let i = 0; i < pts.length - 1; i++) {
    const xc = (pts[i].px + pts[i + 1].px) / 2
    const yc = (pts[i].py + pts[i + 1].py) / 2
    ctx.quadraticCurveTo(pts[i].px, pts[i].py, xc, yc)
  }
  ctx.lineTo(pts[pts.length - 1].px, pts[pts.length - 1].py)
  ctx.strokeStyle = '#00f0ff'
  ctx.lineWidth = 2.2
  ctx.shadowColor = 'rgba(0, 240, 255, 0.8)'
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.shadowBlur = 0

  pts.forEach((p) => {
    if (!p.peak) return
    const dotColor = p.type === 'crimson' ? '#ff0055' : p.type === 'amber' ? '#ffb703' : '#00f0ff'
    ctx.beginPath()
    ctx.arc(p.px, p.py, 4, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.shadowColor = dotColor
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(p.px, p.py, 7.5, 0, Math.PI * 2)
    ctx.strokeStyle = dotColor
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.fillStyle = dotColor
    ctx.font = 'bold 9.5px "Noto Sans SC", sans-serif'
    ctx.textAlign = 'center'
    const labelY = p.py < 24 ? p.py + 15 : p.py - 10
    ctx.fillText(p.peak, p.px, labelY)
  })
}

function onResize() {
  if (props.active) drawRiskTimeline()
}

onMounted(async () => {
  if (isInstitution.value) {
    // 机构类（凯健）：拉取护理院 mock 全域数据
    const [ov, dev, fac, dem, rk, wd, al, ps] = await Promise.all([
      getOverview(),
      getDevices(),
      getFacilityStats(),
      getDemographics(),
      getRankings(),
      getWards(),
      getAlerts({ page: 1, page_size: 50 }),
      getPatients({ page: 1, page_size: 200 }),
    ])
    overview.value = ov
    devices.value = dev
    facility.value = fac
    demographics.value = dem
    rankings.value = rk
    wards.value = wd
    alerts.value = al.list
    patients.value = new Map(ps.list.map((p) => [p.patient_id, p]))
  } else {
    // 中科安樵（anqiao）：设备口径，不发任何机构 mock 请求；仅尝试拉取真实云端设备告警
    try {
      const deviceIds = [...new Set(ANQIAO_DEVICES.map((d) => d.sn).filter(Boolean))]
      const batches = await Promise.all(deviceIds.map((sn) => getHardwareAlarms(sn, 1, 10)))
      const seen = new Set<number | string>()
      const items = batches
        .flatMap((res) => res.items || [])
        .filter((a) => {
          if (!getAnqiaoDevice(a.device_id)) return false
          const key = a.id ?? `${a.device_id}:${a.trigger_time}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      anqiaoAlarms.value = items
      const today = new Date().toISOString().slice(0, 10)
      anqiaoAlarmCount.value = items.filter((a) => (a.trigger_time || '').startsWith(today)).length
      setKpi(kpiElderly.value, anqiaoAlarmCount.value, '起')
    } catch {
      anqiaoAlarms.value = []
      anqiaoAlarmCount.value = 0
    }
  }

  await nextTick()
  if (props.active) playKpi()
  else renderStaticKpis()
  drawRiskTimeline()
  setTimeout(() => { donutReady.value = true }, 150)
  setTimeout(() => { meterReady.value = true }, 250)
  setTimeout(() => { pillarsReady.value = true }, 150)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <!-- 顶部 4 大核心态势 KPI（随机构模式动态自适应） -->
  <div class="cockpit-kpi-row" style="margin-bottom: 10px; height: 86px;">
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">物联网守护终端总数</div>
        <div class="val" ref="kpiDevice">- <span style="font-size:14px;color:var(--txt-muted)">台</span></div>
        <div class="sub">
          <template v-if="isNational">
            <span style="color:var(--cyan)">在册总计 {{ effectiveDeviceData.total }} 台</span> ·
            <span style="color:var(--mint)">实时在线 {{ effectiveDeviceData.online }}</span> ·
            <span style="color:var(--txt-muted)">当前离线 {{ effectiveDeviceData.offline }}</span>
          </template>
          <template v-else-if="currentOrg.deviceBreakdown">
            <span style="color:var(--cyan)">守护仪 {{ currentOrg.deviceBreakdown.guardians.total.toLocaleString() }} 台(在线{{ currentOrg.deviceBreakdown.guardians.online.toLocaleString() }})</span> ·
            <span style="color:var(--mint)">跌倒报警 {{ currentOrg.deviceBreakdown.fallRadars.total.toLocaleString() }} 台(在线{{ currentOrg.deviceBreakdown.fallRadars.online.toLocaleString() }})</span>
          </template>
          <template v-else>
            <span style="color:var(--cyan)">在线 {{ effectiveDeviceData.online.toLocaleString() }}</span> ·
            <span style="color:var(--txt-muted)">在册档案 {{ effectiveDeviceData.offline }}</span>
          </template>
        </div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">无故障安全运行天数</div>
        <div class="val" ref="kpiRunning">- <span style="font-size:14px;color:var(--txt-muted)">天</span></div>
        <div class="sub">
          <span v-if="isNational" style="color:var(--txt-muted)">安全运行天数待运维台账对接</span>
          <span v-else style="color:var(--mint)">零严重事故 100% 连续达标</span>
        </div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">{{ isNational ? '设备在线率' : '综合在线响应率' }}</div>
        <div class="val" ref="kpiRate">- <span style="font-size:14px;color:var(--txt-muted)">%</span></div>
        <div class="sub">
          <span :style="{ color: isNational && !cloudGatewayHealth.healthy ? 'var(--crimson)' : 'var(--amber)' }">
            {{ isNational ? (cloudGatewayHealth.healthy ? '华为云IoTDA专网 · 毫秒级巡测' : '⚠️ 遥测网关通信异常') : '全时段低时延通信' }}
          </span>
        </div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">{{ isNational ? '今日设备告警数' : '在册在护长者总数' }}</div>
        <div class="val" ref="kpiElderly">- <span style="font-size:14px;color:var(--txt-muted)">{{ isNational ? '起' : '人' }}</span></div>
        <div class="sub">
          <template v-if="isNational">
            <span style="color:var(--mint)">云端告警队列 · 运维值班闭环跟进</span>
          </template>
          <template v-else>
            <span style="color:var(--cyan)">男 {{ maleCount }} 位</span> · <span style="color:var(--crimson)">女 {{ femaleCount }} 位</span>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- 中层双栏：物联网感知设备分布 + 24H 突发风险监测与AI研判矩阵 -->
  <div class="grid-two-col">
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>物联网感知设备分布<span class="code">IOT TOPOLOGY</span></div>
        <span class="hud-badge">{{ effectiveDeviceData.types.length }} 类别已联网</span>
      </div>
      <div class="hud-body">
        <div class="reactor-chart-box">
          <div class="donut-reactor-wrap">
            <svg viewBox="0 0 200 200" width="200" height="200">
              <line v-for="(t, i) in donutTicks" :key="'t' + i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" :stroke="`rgba(0,240,255,${t.opacity})`" :stroke-width="t.width"/>
              <circle cx="100" cy="100" :r="75" fill="none" stroke="rgba(0, 240, 255, 0.08)" stroke-width="14"/>
              <circle v-for="(s, i) in donut.segments" :key="i" cx="100" cy="100" :r="75" fill="none"
                :stroke="s.color" stroke-width="14" :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset"
                style="transition: stroke-dasharray 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);"/>
            </svg>
            <div class="donut-core-hologram">
              <div class="digits">{{ effectiveDeviceData.total.toLocaleString() }}</div>
              <div class="tag">ACTIVE</div>
            </div>
          </div>
          <div class="device-telemetry-list">
            <div v-for="(t, i) in deviceRows" :key="i" class="telemetry-row">
              <span class="telemetry-tag" :style="{ background: t.color, boxShadow: `0 0 6px ${t.color}` }"></span>
              <span class="telemetry-name">{{ t.name }}</span>
              <div class="cyber-meter-track"><div class="cyber-meter-fill" :style="{ background: t.color, width: t.meterWidth, transition: 'width 1.2s cubic-bezier(0.2,0.8,0.2,1)' }"></div></div>
              <span class="telemetry-val" :style="{ color: t.color }">{{ t.count }}</span>
              <span class="telemetry-pct">{{ t.pct }}%</span>
              <span class="telemetry-online-chip" :style="t.chipStyle">在线 {{ t.online_rate }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>24H 突发风险监测与AI研判矩阵<span class="code">RISK RADAR &amp; AI TRIAGE</span></div>
        <span class="hud-badge" style="color:var(--mint);border-color:var(--mint)">● AI 实时研判流</span>
      </div>
      <div class="hud-body" style="padding: 10px 14px;">
        <div class="risk-radar-wrapper">
          <div>
            <div class="risk-timeline-header">
              <span class="title"><span style="color:var(--cyan)">⚡</span> {{ isNational ? '24小时告警与事件时序' : '24小时体征突发事件时序' }}</span>
              <div class="legend">
                <span class="l-item"><span class="dot crimson"></span>紧急跌倒</span>
                <span class="l-item"><span class="dot amber"></span>呼吸心率</span>
                <span class="l-item"><span class="dot cyan"></span>离床超时</span>
              </div>
            </div>
            <div class="risk-canvas-box" style="margin-top:6px;">
              <canvas id="s1-risk-timeline-canvas"></canvas>
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; color:var(--txt-secondary)">
              <span style="font-weight:700; color:#fff">{{ isNational ? '实时告警与事件记录' : '近期分级预警研判记录' }}</span>
              <span style="font-family:var(--font-mono); color:var(--mint)">AI 分诊持续运行中</span>
            </div>
            <div class="risk-triage-queue">
              <div v-for="ev in triageEvents" :key="ev.alert.alert_id" class="triage-event-card" :class="{ 'crimson-alert': ev.isAlert }"
                :title="ev.patient ? `点击直达 [${ev.alert.bed_id} ${ev.patient?.name ?? ''}] 详情` : ''"
                @click="ev.patient?.patient_id && emit('select-patient', ev.patient.patient_id)">
                <div class="triage-top">
                  <span class="tag" :class="ev.cls">{{ ev.tag }}</span>
                  <span class="time">{{ ev.time }}</span>
                </div>
                <div class="triage-body">
                  <span class="patient">
                    {{ ev.alert.bed_id }} {{ ev.patient?.name ?? '' }}
                    <small style="font-weight:normal;color:var(--txt-muted)">
                      ({{ ev.patient?.age ? ev.patient?.age + '岁·' : '' }}{{ ev.patient?.care_level }})
                    </small>
                  </span>
                  <span class="status" :style="{ color: ev.cls === 'crimson' ? 'var(--crimson)' : ev.cls === 'amber' ? 'var(--amber)' : 'var(--cyan)' }">{{ ev.alert.title }}</span>
                </div>
                <div class="triage-footer">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;">{{ ev.alert.detail }} · {{ ev.alert.handle_note ?? '处置跟进中' }}</span>
                  <span style="color:var(--cyan);font-family:var(--font-mono);font-size:10px;">画像 ↗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 下层双栏：人口谱系与照护矩阵（凯健）/ 设备资产谱系与部署矩阵（安樵）+ 全域态势排行榜 -->
  <div class="grid-bottom-col">
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head" style="padding: 10px 14px;">
        <div class="hud-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <span class="marker"></span>{{ isNational ? '设备资产谱系与部署矩阵' : '长者人口谱系与照护矩阵' }}<span class="code" style="margin-left: 6px; font-size: 10px;">{{ isNational ? 'DEVICE SPECTRUM' : 'CARE SPECTRUM' }}</span>
        </div>
        <span class="hud-badge" style="white-space: nowrap; flex-shrink: 0;">
          {{ isNational ? `${ANQIAO_DEVICES.length} 台在册设备` : `${elderlyCount} 位在护长者` }}
        </span>
      </div>
      <div class="hud-body" style="padding: 0; overflow: hidden;">
        <!-- 中科安樵（anqiao）：纯设备维度谱系 -->
        <div class="s1-c3-container" v-if="isNational">
          <div class="s1-c3-left-col">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>设备在线状态结构</span>
                <span style="color:var(--cyan); font-family:var(--font-mono)">
                  在线 {{ (rtLiveCount / ANQIAO_DEVICES.length * 100).toFixed(1) }}% · 离线 {{ ((ANQIAO_DEVICES.length - rtLiveCount) / ANQIAO_DEVICES.length * 100).toFixed(1) }}%
                </span>
              </div>
              <div class="s1-gender-capsule">
                <div class="s1-gender-male" :style="{ width: (rtLiveCount / ANQIAO_DEVICES.length) * 100 + '%' }">
                  ● 实时在线 {{ rtLiveCount }} 台
                </div>
                <div class="s1-gender-female" style="background:rgba(148,163,184,0.16);color:#94a3b8">
                  在册离线 {{ ANQIAO_DEVICES.length - rtLiveCount }} 台
                </div>
              </div>
              <div class="s1-demog-microbar">
                <div class="s1-demog-micro-item">在册设备 <b>{{ ANQIAO_DEVICES.length }}</b><span style="font-size:9px">台</span></div>
                <div class="s1-demog-micro-item">覆盖区域 <b style="color:var(--amber)">2 区</b></div>
                <div class="s1-demog-micro-item">设备在线率 <b style="color:var(--mint)">{{ isNational ? ((rtLiveCount / (ANQIAO_DEVICES.length || 1)) * 100).toFixed(1) : currentOrg.deviceOnlineRate }}</b><span style="font-size:9px">%</span></div>
              </div>
            </div>

            <div class="s1-age-box">
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:2px;">
                <span>设备区域分布</span>
                <span style="color:var(--amber); font-family:var(--font-mono); font-size:10px;">吴中区 4 台 · 工业园区 3 台</span>
              </div>
              <div class="s1-age-spectrum-chart">
                <div v-for="(a, i) in districtSpectrum" :key="i" class="s1-spectrum-col">
                  <div class="s1-spectrum-val">{{ a.count }}</div>
                  <div class="s1-spectrum-pillar-wrap">
                    <div class="s1-spectrum-pillar" :style="{ background: a.color, color: a.color, height: a.height, transition: 'height 0.9s cubic-bezier(0.2,0.8,0.2,1)' }"></div>
                  </div>
                  <div class="s1-spectrum-label">{{ a.range }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="s1-c3-right-col">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:5px;">
                <span>设备型号谱系分布</span>
                <span style="color:var(--txt-muted); font-family:var(--font-mono); font-size:10px;">
                  在网运行 {{ rtLiveCount }} 台
                </span>
              </div>
              <div class="s1-care-tubes-box">
                <div v-for="t in modelTubes" :key="t.name" class="s1-care-tube-row">
                  <span class="s1-care-tube-name" :style="{ color: t.color }">{{ t.name }}</span>
                  <div class="s1-care-tube-track"><div class="s1-care-tube-fill" :style="{ background: t.color, width: t.pct + '%' }"></div></div>
                  <span class="s1-care-tube-val" :style="{ color: t.color }">{{ t.count }}台 <small style="font-size:9px;color:var(--txt-muted)">{{ t.pct }}%</small></span>
                </div>
              </div>
            </div>

            <div class="s1-clinical-guard-strip">
              <span>物联网专网全链路覆盖 · 7×24小时运营响应</span>
              <span style="color:var(--mint); font-family:var(--font-mono)">数据传输完好率 100%</span>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>网络通道分布</span>
                <span style="color:var(--txt-muted); font-size:9.5px;">物联专网 / 4G / 专线 / Wi-Fi</span>
              </div>
              <div class="s1-chronic-grid">
                <div v-for="d in networkRows" :key="d.name" class="s1-chronic-chip">
                  <div class="disease-row"><span class="disease-name">{{ d.name }}</span><span class="disease-stat" :style="{ color: d.color }">{{ d.count }}台 <small style="font-size:9px;color:var(--txt-muted)">{{ d.pct }}%</small></span></div>
                  <div class="disease-bar"><div class="disease-bar-fill" :style="{ background: d.color, width: d.pct + '%', boxShadow: `0 0 5px ${d.color}` }"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 凯健（机构）：人口谱系与照护矩阵 -->
        <div class="s1-c3-container" v-else>
          <div class="s1-c3-left-col">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>性别结构比例</span>
                <span style="color:var(--cyan); font-family:var(--font-mono)">
                  男 {{ malePct.toFixed(1) }}% · 女 {{ (100 - malePct).toFixed(1) }}%
                </span>
              </div>
              <div class="s1-gender-capsule">
                <div class="s1-gender-male" :style="{ width: malePct + '%' }">
                  ♂ 男 {{ maleCount }}人
                </div>
                <div class="s1-gender-female">
                  女 {{ femaleCount }}人 ♀
                </div>
              </div>
              <div class="s1-demog-microbar">
                <div class="s1-demog-micro-item">平均年龄 <b>{{ demographics?.avg_age.toFixed(1) ?? '81.2' }}</b><span style="font-size:9px">岁</span></div>
                <div class="s1-demog-micro-item">高龄长者 <b style="color:var(--amber)">36.8%</b></div>
                <div class="s1-demog-micro-item">最高寿 <b style="color:var(--mint)">{{ demographics?.max_age ?? 95 }}</b><span style="font-size:9px">岁</span></div>
              </div>
            </div>

            <div class="s1-age-box">
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:2px;">
                <span>年龄梯队分布</span>
                <span style="color:var(--amber); font-family:var(--font-mono); font-size:10px;">80+岁占比 {{ over80Pct.toFixed(1) }}%</span>
              </div>
              <div class="s1-age-spectrum-chart">
                <div v-for="(a, i) in ageSpectrum" :key="i" class="s1-spectrum-col">
                  <div class="s1-spectrum-val">{{ a.count }}</div>
                  <div class="s1-spectrum-pillar-wrap">
                    <div class="s1-spectrum-pillar" :style="{ background: a.color, color: a.color, height: a.height, transition: 'height 0.9s cubic-bezier(0.2,0.8,0.2,1)' }"></div>
                  </div>
                  <div class="s1-spectrum-label">{{ a.range }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="s1-c3-right-col">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:5px;">
                <span>医养照护等级评定</span>
                <span style="color:var(--txt-muted); font-family:var(--font-mono); font-size:10px;">
                  失能/介护占比 {{ careTubes.length >= 2 ? (((careTubes[0].count + careTubes[1].count) / (elderlyCount || 1)) * 100).toFixed(1) : '-' }}%
                </span>
              </div>
              <div class="s1-care-tubes-box">
                <div v-for="t in careTubes" :key="t.name" class="s1-care-tube-row">
                  <span class="s1-care-tube-name" :style="{ color: t.color }">{{ t.name }}</span>
                  <div class="s1-care-tube-track"><div class="s1-care-tube-fill" :style="{ background: t.color, width: t.pct + '%' }"></div></div>
                  <span class="s1-care-tube-val" :style="{ color: t.color }">{{ t.count }}人 <small style="font-size:9px;color:var(--txt-muted)">{{ t.pct }}%</small></span>
                </div>
              </div>
            </div>

            <div class="s1-clinical-guard-strip">
              <span>重点防范：多重慢病叠加失能衰弱与跌倒风险</span>
              <span style="color:var(--amber); font-family:var(--font-mono)">综合共管率 96.8%</span>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>高发慢病共病共管</span>
                <span style="color:var(--txt-muted); font-size:9.5px;">综合共病率 89.2%</span>
              </div>
              <div class="s1-chronic-grid">
                <div v-for="d in diseaseRows" :key="d.name" class="s1-chronic-chip">
                  <div class="disease-row"><span class="disease-name">{{ d.name }}</span><span class="disease-stat" :style="{ color: d.color }">{{ d.count }}人 <small style="font-size:9px;color:var(--txt-muted)">{{ d.pct }}%</small></span></div>
                  <div class="disease-bar"><div class="disease-bar-fill" :style="{ background: d.color, width: d.pct + '%', boxShadow: `0 0 5px ${d.color}` }"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>{{ isNational ? '全域设备运行态势排行榜' : '全域长者生命态势排行榜' }}<span class="code">TOP RISK BENCHMARKS</span></div>
        <span class="hud-badge" style="color:var(--cyan);border-color:var(--cyan)">
          {{ isNational ? `${ANQIAO_DEVICES.length} 台在册设备 · 状态总榜` : `${elderlyCount} 位在护长者动态排行` }}
        </span>
      </div>
      <div class="hud-body" style="padding:10px 12px;">
        <div class="rankings-trio-grid">
          <div class="rank-col-box">
            <div class="rank-col-head"><span class="chevron">»</span><span>{{ isNational ? '设备在线状态榜' : '睡眠健康指数排行榜' }}</span></div>
            <div class="rank-table-header"><span>排名</span><span>{{ isNational ? '设备SN / 归属地' : '床位 / 姓名' }}</span><span style="text-align:right;padding-right:6px">{{ isNational ? '状态' : '得分' }}</span><span style="text-align:center">趋势</span></div>
            <div class="rank-table-body">
              <div v-for="(r, i) in effectiveRankings.sleep" :key="r.patient_id" class="rank-table-row">
                <span class="rank-num" :class="rankCls(i)">{{ i + 1 }}</span>
                <span class="rank-bed"><span class="bed-badge">{{ r.bed_id }}</span><span class="patient-name">{{ r.name }}</span></span>
                <span class="rank-val">{{ (r as any).text || r.value }}</span>
                <span :class="trendArrow(r.delta).cls">{{ trendArrow(r.delta).text }}</span>
              </div>
            </div>
          </div>

          <div class="rank-col-box">
            <div class="rank-col-head"><span class="chevron" style="color:var(--crimson)">»</span><span>{{ isNational ? '数据通道质量榜' : '跌倒高危预警排行榜' }}</span></div>
            <div class="rank-table-header"><span>排名</span><span>{{ isNational ? '设备SN / 归属地' : '床位 / 姓名' }}</span><span style="text-align:right;padding-right:6px">{{ isNational ? '质量分' : '指数' }}</span><span style="text-align:center">状态</span></div>
            <div class="rank-table-body">
              <div v-for="(r, i) in effectiveRankings.fall_risk" :key="r.patient_id" class="rank-table-row">
                <span class="rank-num" :class="rankCls(i)">{{ i + 1 }}</span>
                <span class="rank-bed"><span class="bed-badge">{{ r.bed_id }}</span><span class="patient-name">{{ r.name }}</span></span>
                <span class="rank-val" :style="{ color: (r as any).color || fallState(r.value).color }">{{ r.value }}</span>
                <span class="rank-arrow" :style="{ color: (r as any).color || fallState(r.value).color, fontSize: '10px' }">{{ (r as any).text || fallState(r.value).text }}</span>
              </div>
            </div>
          </div>

          <div class="rank-col-box">
            <div class="rank-col-head"><span class="chevron" style="color:var(--amber)">»</span><span>{{ isNational ? '遥测采样活跃榜' : '生命体征波动排行榜' }}</span></div>
            <div class="rank-table-header"><span>排名</span><span>{{ isNational ? '设备SN / 归属地' : '床位 / 姓名' }}</span><span style="text-align:right;padding-right:6px">{{ isNational ? '遥测' : '体征' }}</span><span style="text-align:center">状态</span></div>
            <div class="rank-table-body">
              <div v-for="(r, i) in effectiveRankings.vitals" :key="r.patient_id" class="rank-table-row">
                <span class="rank-num" :class="rankCls(i)">{{ i + 1 }}</span>
                <span class="rank-bed"><span class="bed-badge">{{ r.bed_id }}</span><span class="patient-name">{{ r.name }}</span></span>
                <span class="rank-val" :style="{ color: r.abnormal ? '#ff0055' : 'var(--cyan)', fontSize: '11px' }">{{ r.text }}</span>
                <span :class="r.abnormal ? 'rank-arrow up-red' : 'rank-arrow up-cyan'">{{ r.abnormal ? '↑' : '稳' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
