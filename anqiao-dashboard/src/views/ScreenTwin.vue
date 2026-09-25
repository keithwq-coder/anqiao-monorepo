<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FloorPlan from '../components/FloorPlan.vue'
import TechChinaMap from '../components/TechChinaMap.vue'
import type { PlanBed, PlanRoom } from '../components/FloorPlan.vue'
import { getAlerts, getBeds, getFacilityStats, getFloors, getOverview, getPatientProfile, getPatients, getWards } from '../api/client'
import { ORG_PROFILES } from '../projects'
import { ANQIAO_DEVICES } from '../projects'
import { deviceTelemetry, freshnessOf, isOnline, lastSampleTime, liveDeviceCount, presenceOf } from '../api/deviceTelemetry'
import { deviceIpGeoOf, ipGeoLabel, resolveDeviceIpGeo } from '../api/ipGeo'
import type { Alert, FacilityStats, FloorInfo, Overview, Patient, PatientProfile, WardInfo } from '../api/types'

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

const viewportScale = inject<() => number>('viewportScale', () => 1)

type HeatMode = 'temperature' | 'risk' | 'flow'

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)
// 机构定性：home = 居家类（中科安樵自营居家设备点位）；institution = 机构类（凯健护理院）
const isHome = computed(() => currentOrg.value.kind === 'home')
const isInstitution = computed(() => currentOrg.value.kind === 'institution')

// 中科安樵实时在线台数（共享遥测 store 实算，5s 轮询刷新；在线=有 ≤90s 新鲜样本，在床/离床均计在线）
const rtLiveCount = computed(() => liveDeviceCount())
// 在线率同样按共享遥测 store 实算，与 rtLiveCount 同口径；orgData.deviceOnlineRate 为静态档案值，不作实时展示
const liveOnlineRate = computed(() =>
  ANQIAO_DEVICES.length > 0 ? ((rtLiveCount.value / ANQIAO_DEVICES.length) * 100).toFixed(1) : '0.0'
)

// 全量设备遥测快照索引（响应式：store 每 5s 轮询刷新后自动重算）
// 三态（用户口径，完全由 latest_data 新鲜样本驱动）：
// person=设备在线·在床（真实样本值，含真实 0）；empty=设备在线·离床（全 0 空数据即在线证据，0 值+样本时间）；
// offline=设备离线（无新鲜样本，不展示任何数值与时间）
const rtDeviceInfo = computed(() => {
  const m: Record<string, {
    state: 'person' | 'empty' | 'offline'
    vitals: { hr: number; br: number; tp: number } | null
    sampleTime: string
  }> = {}
  for (const d of ANQIAO_DEVICES) {
    const online = isOnline(d.sn)
    const presence = presenceOf(d.sn)
    const data = deviceTelemetry[d.sn]?.data ?? null
    const hasSample = freshnessOf(d.sn) === 'live' && !!data
    m[d.sn] = {
      state: !online ? 'offline' : presence === 'empty' ? 'empty' : 'person',
      vitals: online
        ? (data && hasSample
          ? { hr: Math.round(data.hr), br: Math.round(data.br), tp: Number(data.tp.toFixed(1)) }
          : { hr: 0, br: 0, tp: 0 })
        : null,
      sampleTime: online ? lastSampleTime(d.sn) : '',
    }
  }
  return m
})

// ===================== 1. 多院区切换状态 (kaijian) =====================
const selectedCampusId = ref<string>('')
watch(
  () => props.orgId,
  () => {
    if (currentOrg.value.campuses && currentOrg.value.campuses.length > 0) {
      selectedCampusId.value = currentOrg.value.campuses[0].id
    }
  },
  { immediate: true }
)

const activeCampus = computed(() => {
  if (!currentOrg.value.campuses || currentOrg.value.campuses.length === 0) return null
  return currentOrg.value.campuses.find((c) => c.id === selectedCampusId.value) || currentOrg.value.campuses[0]
})

function selectCampus(cId: string) {
  selectedCampusId.value = cId
}

// ===================== 2. 机构类（凯健）CAD 空间孪生状态 =====================
const floor = ref('4F')
const mode = ref<HeatMode>('temperature')
const wards = ref<WardInfo[]>([])
const floorInfos = ref<FloorInfo[]>([])
const overview = ref<Overview | null>(null)
const facility = ref<FacilityStats | null>(null)
const alerts = ref<Alert[]>([])
const alertPatients = ref<Map<string, Patient>>(new Map())
const floorPatients = ref<Patient[]>([])
const vacantBeds = ref<string[]>([])
const profileMap = ref<Map<string, PatientProfile>>(new Map())
const tooltip = ref<{ show: boolean; left: number; top: number; html: string }>({ show: false, left: 0, top: 0, html: '' })
const planContainer = ref<HTMLElement | null>(null)
let heatDrawnFor = ''

// 随机构切换自动初始化专区楼层（仅机构类使用楼层概念）
watch(
  () => props.orgId,
  (newOrg) => {
    if (newOrg === 'kaijian') floor.value = '4F'
  },
  { immediate: true }
)

// 楼层 Tab 仅机构类（凯健）使用；居家类（中科安樵）为点位地图，无楼层概念
const activeWards = [
  { id: '4F', name: '4F 完全失能区' },
  { id: '3F', name: '3F 认知障碍区' },
  { id: '2F', name: '2F 术后康复区' },
  { id: '1F', name: '1F 慢病颐养区' },
]

function selectFloor(fId: string) {
  floor.value = fId
  loadFloor()
}

// 中央护士站仅为机构类（凯健）FloorPlan 语义
const centerStationName = '中央护士站'
const centerStationSub = '24H ACTIVE · 医护值守中'

function generateKaijianRooms(floorStr: string): PlanRoom[] {
  const fNum = parseInt(floorStr.charAt(0), 10) || 4
  const rooms: PlanRoom[] = []
  const roomWidth = 112
  const roomHeight = 236
  const startX = 14
  const gapX = 8

  for (let col = 0; col < 6; col++) {
    const rx = startX + col * (roomWidth + gapX)
    const ry = 26
    const rId = `${fNum}0${col + 1}`
    rooms.push(makeRoom(rId, rx, ry, roomWidth, roomHeight, 'north', rx + 6, ry + 36, rx + 58, ry + 36))
  }
  for (let col = 0; col < 6; col++) {
    const rx = startX + col * (roomWidth + gapX)
    const ry = 428
    const rId = `${fNum}0${col + 7}`
    rooms.push(makeRoom(rId, rx, ry, roomWidth, roomHeight, 'south', rx + 6, ry + 124, rx + 58, ry + 124))
  }
  return rooms

  function makeRoom(
    rId: string, rx: number, ry: number, rw: number, rh: number,
    wing: 'north' | 'south',
    ax: number, ay: number, bx: number, by: number,
  ): PlanRoom {
    const bathX = rx + rw - 44
    const bathY = wing === 'north' ? ry + 148 : ry + 14
    const bathW = 42
    const bathH = 72
    const mkBed = (id: string, bedCode: string, x: number, y: number): PlanBed => {
      const patient = floorPatients.value.find(p => p.bed_id === bedCode) ?? null
      const isVacant = vacantBeds.value.includes(bedCode) || !patient
      const profile = patient ? profileMap.value.get(patient.patient_id) : undefined
      const location = isVacant || !patient ? 'bed' : profile?.location ?? 'bed'
      return { id, bedCode, x, y, w: 48, h: 76, patient, isVacant, location, fallLive: !!(patient?.abnormal?.fall && location === 'bathroom') }
    }
    const beds = [mkBed('A', `${rId}-A`, ax, ay), mkBed('B', `${rId}-B`, bx, by)]
    return {
      id: rId, x: rx, y: ry, w: rw, h: rh, wing, beds,
      bathX, bathY, bathW, bathH,
      bathCx: bathX + bathW / 2, bathCy: bathY + bathH / 2,
      hasFallInBath: beds.some(b => b.fallLive),
    }
  }
}

// 床位调度仅机构类（凯健）：居家类（中科安樵）为点位地图，不生成床位
function generateFloorBedConfigs(floorStr: string) {
  return generateKaijianRooms(floorStr)
}

const rooms = computed<PlanRoom[]>(() => generateFloorBedConfigs(floor.value))
const nurseStation = { x: 260, y: 300, w: 220, h: 90 }

const floorStats = computed(() => {
  let inBed = 0
  let away = 0
  let vacant = 0
  for (const r of rooms.value) {
    for (const b of r.beds) {
      if (b.isVacant || !b.patient) vacant++
      else if (b.location === 'bed') inBed++
      else away++
    }
  }
  return { inBed, away, vacant }
})

const wandererOut = computed(() => {
  return floorPatients.value.some(p => p.abnormal?.fall && profileMap.value.get(p.patient_id)?.location !== 'bed')
})

const currentWard = computed(() => wards.value.find(w => w.floor === floor.value))
const currentFloorInfo = computed(() => floorInfos.value.find(f => f.floor === floor.value))

const legend = computed(() => {
  if (mode.value === 'temperature') {
    return {
      title: '生理体温热力场',
      min: '36.0°C 低体温/静止',
      max: '38.5°C 发热/炎症',
      gradient: 'linear-gradient(90deg, rgba(56,189,248,0.2) 0%, rgba(0,255,136,0.35) 45%, rgba(255,183,3,0.55) 75%, rgba(255,0,85,0.7) 100%)',
      minColor: '#38bdf8',
      maxColor: '#ff0055',
    }
  }
  if (mode.value === 'risk') {
    return {
      title: '微空间风险雷达热力',
      min: 'L0 正常静息',
      max: 'L4 离床超时/跌倒滞留',
      gradient: 'linear-gradient(90deg, rgba(0,255,136,0.15) 0%, rgba(255,183,3,0.45) 50%, rgba(255,0,85,0.75) 100%)',
      minColor: '#00ff88',
      maxColor: '#ff0055',
    }
  }
  return {
    title: '医护巡更轨迹信标',
    min: '0 次巡查',
    max: '≥6 次高频巡护',
    gradient: 'linear-gradient(90deg, rgba(0,240,255,0.1) 0%, rgba(0,240,255,0.45) 50%, rgba(199,125,255,0.7) 100%)',
    minColor: '#00f0ff',
    maxColor: '#c77dff',
  }
})

function drawHeatmap() {
  const canvas = document.getElementById('heatmap-radiation-canvas') as HTMLCanvasElement | null
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = (canvas.width = 740)
  const h = (canvas.height = 690)
  ctx.clearRect(0, 0, w, h)

  for (const r of rooms.value) {
    for (const b of r.beds) {
      if (b.isVacant || !b.patient) continue
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      let gradRadius = 46
      let startColor = 'rgba(0,255,136,0.22)'
      let endColor = 'rgba(0,255,136,0)'

      if (mode.value === 'temperature') {
        const temp = b.patient.vitals.tp
        if (temp >= 37.3) {
          startColor = 'rgba(255,0,85,0.38)'
          gradRadius = 60
        } else if (temp >= 36.8) {
          startColor = 'rgba(255,183,3,0.28)'
          gradRadius = 50
        } else {
          startColor = 'rgba(56,189,248,0.22)'
        }
      } else if (mode.value === 'risk') {
        if (b.fallLive) {
          startColor = 'rgba(255,0,85,0.55)'
          gradRadius = 72
        } else if (b.patient.abnormal) {
          startColor = 'rgba(255,183,3,0.40)'
          gradRadius = 56
        } else {
          startColor = 'rgba(0,255,136,0.18)'
        }
      } else {
        startColor = 'rgba(0,240,255,0.25)'
        gradRadius = 42
      }

      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, gradRadius)
      grad.addColorStop(0, startColor)
      grad.addColorStop(1, endColor)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, gradRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  heatDrawnFor = floor.value + mode.value
}

function onBedEnter(bed: PlanBed, el: Element) {
  if (bed.isVacant || !bed.patient) return
  const p = bed.patient
  const rect = el.getBoundingClientRect()
  const containerRect = planContainer.value?.getBoundingClientRect() ?? { left: 0, top: 0 }
  const scale = viewportScale()
  const left = (rect.left - containerRect.left) / scale + bed.w / 2
  const top = (rect.top - containerRect.top) / scale - 12

  tooltip.value = {
    show: true,
    left,
    top,
    html: `
      <div style="font-weight:700;font-size:13px;color:#f0fdfa;display:flex;justify-content:space-between;gap:8px;">
        <span>${p.bed_id} ${p.name}</span>
        <span style="color:#00f0ff;">${p.age}岁 · ${p.care_level}</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
        心率 <b style="color:#00f0ff">${p.vitals.hr}</b> bpm · 呼吸 <b style="color:#00ff88">${p.vitals.br}</b> rpm · 体温 <b>${p.vitals.tp}</b>°C
      </div>
      <div style="font-size:10.5px;color:#ffb703;margin-top:2px;">
        在床状态: ${p.vitals.in_bed ? '在床休息' : '离床活动'} · 点击调阅长者画像档案
      </div>
    `,
  }
}

function onBedClick(bed: PlanBed) {
  if (bed.patient) {
    emit('select-patient', bed.patient.patient_id)
  }
}

const LEVEL_PREFIX: Record<string, string> = {
  fall: '🚨 【紧急跌倒】',
  hr: '▲ 【心率异动】',
  br: '▲ 【呼吸暂停】',
  off_bed: '⏰ 【离床超时】',
}

const dispatchStats = computed(() => {
  let fall = 0
  let offBed = 0
  let vitals = 0
  for (const a of alerts.value) {
    if (a.type === 'fall') fall++
    else if (a.type === 'off_bed') offBed++
    else vitals++
  }
  return { fall, offBed, vitals }
})

const dispatchAlerts = computed(() => alerts.value.slice(0, 4))

function timeOf(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadFloor() {
  if (!isInstitution.value) return
  const [patRes, bedRes] = await Promise.all([
    getPatients({ floor: floor.value, page: 1, page_size: 100 }),
    getBeds({ floor: floor.value }),
  ])
  floorPatients.value = patRes.list
  vacantBeds.value = bedRes.filter(b => b.status === 'vacant').map(b => b.bed_id)
  const profiles = await Promise.all(patRes.list.map(p => getPatientProfile(p.patient_id)))
  profileMap.value = new Map(profiles.map(pr => [pr.patient_id, pr]))
  await nextTick()
  drawHeatmap()
}

watch([floor, mode], () => {
  if (props.active && isInstitution.value) loadFloor()
})

watch(() => props.active, async (v) => {
  if (v && isInstitution.value && heatDrawnFor !== floor.value + mode.value) {
    await nextTick()
    drawHeatmap()
  }
})

function onResize() {
  if (props.active && isInstitution.value) drawHeatmap()
}

onMounted(async () => {
  if (isHome.value) {
    void resolveDeviceIpGeo()
  }
  const [wardsRes, floorsRes, overviewRes, facilityRes, alertsRes, allPatients] = await Promise.all([
    getWards(),
    getFloors(),
    getOverview(),
    getFacilityStats(),
    getAlerts({ page: 1, page_size: 50 }),
    getPatients({ page: 1, page_size: 200 }),
  ])
  wards.value = wardsRes
  floorInfos.value = floorsRes
  overview.value = overviewRes
  facility.value = facilityRes
  alerts.value = alertsRes.list
  alertPatients.value = new Map(allPatients.list.map(p => [p.patient_id, p]))
  if (isInstitution.value) {
    await loadFloor()
  }
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <!-- 顶部 KPI 指标卡片（随机构类型与选定院区自适应） -->
  <div class="cockpit-kpi-row">
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">
          {{ isHome ? '在册设备总数 / 实时在线' : '在护长者总数 / 守护终端' }}
        </div>
        <div class="val">
          {{ isHome ? `${ANQIAO_DEVICES.length} 台` : `${activeCampus?.bedsTotal ?? 87} 张` }}
          <span style="font-size:13px;color:var(--txt-muted)">
            {{ isHome ? `/ ${rtLiveCount} 台实时在线` : `/ 在护 ${activeCampus?.bedsOccupied ?? 85} 位 · 终端 139 台` }}
          </span>
        </div>
        <div class="sub">{{ activeCampus ? `${activeCampus.name} · ${activeCampus.nurseHead}` : currentOrg.twinDescription.split('，')[0] }}</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">
          {{ isHome ? '设备在线率 / 遥测链路' : '当前专区在岗照护配比' }}
        </div>
        <div class="val">
          {{ isHome ? `${liveOnlineRate} %` : currentWard?.nurse_ratio.split(' ')[0] ?? '1:2.8' }}
          <span style="font-size:13px;color:var(--txt-muted)">
            {{ isHome ? `(${rtLiveCount} 台在线 / ${ANQIAO_DEVICES.length} 台在册)` : `(${currentWard?.nurse_ratio.split(' ')[1]?.replace(/[()]/g, '') || '高护标'})` }}
          </span>
        </div>
        <div class="sub">{{ isHome ? `${ANQIAO_DEVICES.length} 台在册 · ${rtLiveCount} 台实时在线 · 专网全链路畅通` : `在岗 ${currentWard?.nurse_count ?? 12} 人 · 巡更在线` }}</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">
          {{ isHome ? '今日运维事件 / 工单闭环率' : '今日处置事件 / 规范闭环率' }}
        </div>
        <div class="val" :style="isHome ? '' : 'color: #00ff88'">
          {{ isHome ? '未获取' : `${overview?.alerts_today ?? 4} 起 · 100%` }}
        </div>
        <div class="sub">
          {{ isHome ? '运维事件与工单系统待对接 · 接入后实算闭环率' : '平均响应 28 秒 · 标准SOP处置' }}
        </div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">
          {{ isHome ? '设备遥测链路健康度' : '长者个体节律健康基线' }}
        </div>
        <div class="val" style="color:var(--mint)">
          {{ isHome ? '99.2' : (facility?.routine_baseline_score ?? 98.4) }}
          <span style="font-size:13px;color:var(--txt-muted)">分</span>
        </div>
        <div class="sub">{{ isHome ? '专网通信链路稳定' : '长者体征态势平稳' }}</div>
      </div>
    </div>
  </div>

  <!-- 主区 3 栏 -->
  <div class="cockpit-main-grid">
    <!-- 栏 1：主空间孪生画布（各机构一等公民孪生） -->
    <div class="hud-card" style="overflow: hidden; display: flex; flex-direction: column">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ currentOrg.twinTitle }}
          <span class="code">SPATIAL TWIN</span>
        </div>

        <!-- 院区切换胶囊（拥有多院区时动态展示） -->
        <div v-if="currentOrg.campuses && currentOrg.campuses.length > 1" class="campus-selector-dock">
          <button
            v-for="c in currentOrg.campuses"
            :key="c.id"
            class="campus-pill-btn"
            :class="{ active: selectedCampusId === c.id }"
            @click="selectCampus(c.id)"
          >
            <span class="campus-dot"></span>
            <span class="campus-name">{{ c.name.split('（')[0] }}</span>
            <span class="campus-beds">{{ c.bedsTotal }}床</span>
          </button>
        </div>
        <span v-else class="hud-badge">
          {{ isHome ? `苏州城域 · ${ANQIAO_DEVICES.length} 台设备点位` : currentWard?.ward || 'CAD 空间数字孪生' }}
        </span>
      </div>

      <div class="hud-body" style="flex: 1; min-height: 0; padding: 12px; display: flex; flex-direction: column">
        <!-- 模式 A：居家类（中科安樵）设备点位地图孪生：苏州全量真实设备散点 -->
        <template v-if="isHome">
          <div class="anqiao-twin-map-wrap">
            <TechChinaMap org-id="anqiao" :active="props.active && isHome" />
          </div>
        </template>

        <!-- 模式 B：机构类（凯健）CAD 空间孪生平面与微空间热力图 -->
        <template v-else>
          <div class="heatmap-control-header">
            <div class="floor-selector-group">
              <button
                v-for="w in activeWards"
                :key="w.id"
                class="floor-pill-btn"
                :class="{ active: floor === w.id }"
                @click="selectFloor(w.id)"
              >
                {{ w.name }}
              </button>
            </div>
            <div class="heatmap-mode-group">
              <button class="mode-pill-btn" :class="{ active: mode === 'temperature' }" title="纯净生理体温场 (36.0~38.5℃)" @click="mode = 'temperature'">生理体温态势</button>
              <button class="mode-pill-btn" :class="{ active: mode === 'risk' }" title="微空间滞留/跌倒安全风险雷达" @click="mode = 'risk'">微空间风险雷达</button>
              <button class="mode-pill-btn" :class="{ active: mode === 'flow' }" title="医护巡更轨迹与就近信标" @click="mode = 'flow'">医护巡更轨迹</button>
            </div>
          </div>

          <div class="heatmap-legend-dock">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-family:var(--font-digit);font-size:11px;" :style="{ color: legend.minColor }">{{ legend.min }}</span>
              <div class="heat-gradient-bar" :style="{ background: legend.gradient }"></div>
              <span style="font-family:var(--font-digit);font-size:11px;font-weight:700" :style="{ color: legend.maxColor }">{{ legend.max }}</span>
            </div>
            <div style="font-size:11px;color:var(--cyan);font-family:var(--font-digit)">
              {{ `总床位: ${currentFloorInfo?.bed_total ?? 24} · 在床: ` }}
              <span style="color:#00ff88">{{ floorStats.inBed }}</span> · 离床: <span style="color:#ffb703">{{ floorStats.away }}</span> · 空床: <span style="color:#94a3b8">{{ floorStats.vacant }}</span>
            </div>
          </div>

          <div class="spatial-floor-plan" ref="planContainer" style="position:relative; flex: 1;">
            <canvas id="heatmap-radiation-canvas"></canvas>
            <FloorPlan
              :rooms="rooms"
              :floor="floor"
              :nurse-station="nurseStation"
              :wanderer-out="wandererOut"
              :center-station-name="centerStationName"
              :center-station-sub="centerStationSub"
              @bed-enter="onBedEnter"
              @bed-leave="tooltip.show = false"
              @bed-click="onBedClick"
            />
            <div class="cad-bed-tooltip" v-html="tooltip.html" :style="{ display: tooltip.show ? 'block' : 'none', left: tooltip.left + 'px', top: tooltip.top + 'px' }"></div>
          </div>
        </template>
      </div>
    </div>

    

    <!-- 栏 2：应急报警调度闭环流水线（自适应各机构） -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ isHome ? '设备告警运维闭环流水线' : '应急报警调度闭环流水线' }}
          <span class="code">DISPATCH SOP</span>
        </div>
        <span class="hud-badge" style="color:var(--mint);border-color:var(--mint)">100% 规范闭环</span>
      </div>

      <div class="hud-body">
        <div class="dispatch-stats-bar">
          <div class="dispatch-stat-cell"><div class="v" style="color:var(--crimson)">{{ isHome ? 1 : dispatchStats.fall }}</div><div class="l">{{ isHome ? '数据采集中断' : '突发跌倒预警' }}</div></div>
          <div class="dispatch-stat-cell"><div class="v" style="color:var(--amber)">{{ isHome ? 1 : dispatchStats.offBed }}</div><div class="l">{{ isHome ? '设备离线超时' : '离床超时滞留' }}</div></div>
          <div class="dispatch-stat-cell"><div class="v" style="color:var(--cyan)">{{ isHome ? 2 : dispatchStats.vitals }}</div><div class="l">{{ isHome ? '遥测链路复测' : '体征异动复测' }}</div></div>
        </div>

        <div class="dispatch-flow-box">
          <!-- 1. 居家类（中科安樵）设备维度告警运维闭环流水线：离线超时/采集中断 → 运营中心复核 → 闭环 -->
          <template v-if="isHome">
            <div class="dispatch-step-card active-alert">
              <div class="dispatch-step-top">
                <span style="color: var(--crimson); font-weight: 700;">⚡ 【数据采集中断】太湖科创中心·903 · ASH01146</span>
                <span class="time">21:19:40</span>
              </div>
              <div class="dispatch-step-content">监护仪通信链路出现短时抖动，专网链路已自动恢复，数据传输正常</div>
              <div class="sop-pipeline-bar">
                <div class="sop-step done"><span class="step-num">1</span><span class="step-tit">链路侦测</span><span class="step-time">0.6s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done"><span class="step-num">2</span><span class="step-tit">自动重连</span><span class="step-time">46s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done"><span class="step-num">3</span><span class="step-tit">运营中心复核</span><span class="step-time">2min</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done current"><span class="step-num">4</span><span class="step-tit">工单闭环</span><span class="step-time">已归档</span></div>
              </div>
              <div class="dispatch-step-footer">
                <span>处置岗位: 运营中心 (网络运行保障)</span>
                <span style="color: var(--mint);">● 遥测恢复 · 链路质量复测通过</span>
              </div>
            </div>

            <div class="dispatch-step-card">
              <div class="dispatch-step-top">
                <span style="color: var(--amber); font-weight: 700;">⏰ 【设备离线超时】石湖金陵广场·301 · ANCE00002</span>
                <span class="time">08:30:00</span>
              </div>
              <div class="dispatch-step-content">运维中枢点位守护仪心跳超时未上报，自动生成运维工单，远程诊断确认为计划内断电归档</div>
              <div class="sop-pipeline-bar">
                <div class="sop-step done"><span class="step-num">1</span><span class="step-tit">离线探知</span><span class="step-time">1.0s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done"><span class="step-num">2</span><span class="step-tit">远程诊断</span><span class="step-time">30s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done"><span class="step-num">3</span><span class="step-tit">运维值班复核</span><span class="step-time">15min</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done current"><span class="step-num">4</span><span class="step-tit">工单闭环</span><span class="step-time">已归档</span></div>
              </div>
              <div class="dispatch-step-footer">
                <span>处置岗位: 运维值班 (石湖金陵片区)</span>
                <span style="color: var(--mint);">● 已核实归档状态 · 工单闭环</span>
              </div>
            </div>
          </template>

          <!-- 5. 护理院（凯健）专区床旁快速处置流水线 -->
          <template v-else>
            <div v-for="(a, i) in dispatchAlerts" :key="a.alert_id" class="dispatch-step-card" :class="{ 'active-alert': i === 0 && a.type === 'fall' }">
              <div class="dispatch-step-top">
                <span :style="{ color: a.type === 'fall' ? 'var(--crimson)' : a.type === 'off_bed' ? 'var(--amber)' : 'var(--cyan)', fontWeight: 700 }">
                  {{ LEVEL_PREFIX[a.type] }}{{ a.bed_id }} {{ alertPatients.get(a.patient_id)?.name ?? '' }} {{ alertPatients.get(a.patient_id)?.ward ? `(${alertPatients.get(a.patient_id)?.ward.replace('专区', '')})` : '' }} {{ a.title }}
                </span>
                <span class="time">{{ timeOf(a.occurred_at) }}</span>
              </div>
              <div class="dispatch-step-content">{{ a.detail }}</div>

              <div class="sop-pipeline-bar">
                <div class="sop-step done"><span class="step-num">1</span><span class="step-tit">AI判决</span><span class="step-time">0.8s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done"><span class="step-num">2</span><span class="step-tit">护士接警</span><span class="step-time">12s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done"><span class="step-num">3</span><span class="step-tit">床旁到场</span><span class="step-time">28s</span></div>
                <div class="sop-step-arrow">›</div>
                <div class="sop-step done current"><span class="step-num">4</span><span class="step-tit">医嘱闭环</span><span class="step-time">已归档</span></div>
              </div>

              <div class="dispatch-step-footer">
                <span>处置人: {{ a.handled_by ?? '李晓芳 护士长' }}</span>
                <span :style="{ color: a.status === 'handled' ? 'var(--mint)' : 'var(--amber)' }">{{ a.status === 'handled' ? '● 已规范闭环归档' : '● 处置中 · 28s到场排查' }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 栏 3：服务负荷与安防监控（自适应各机构） -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ isHome ? '设备点位状态矩阵' : '病区护理负荷与环境安防' }}
          <span class="code">{{ isHome ? 'DEVICE MATRIX' : 'SECURITY' }}</span>
        </div>
        <span class="hud-badge">{{ isHome ? `${ANQIAO_DEVICES.length} 台在册 · ${rtLiveCount} 台实时在线` : '实时动线 · 物联' }}</span>
      </div>
      <div class="hud-body">
        <!-- 1. 居家类（中科安樵）全量在册真实设备状态卡：点击调阅设备画像 -->
        <template v-if="isHome">
          <div class="device-card-list">
            <div
              v-for="d in ANQIAO_DEVICES"
              :key="d.sn"
              class="device-status-card"
              :class="{ online: rtDeviceInfo[d.sn]?.state !== 'offline' }"
              @click="emit('select-patient', d.sn)"
            >
              <div class="dsc-top">
                <span class="dsc-label">{{ d.label }}</span>
                <span class="dsc-badge" :class="rtDeviceInfo[d.sn]?.state !== 'offline' ? 'on' : 'off'">{{ rtDeviceInfo[d.sn]?.state === 'offline' ? '○ 设备离线' : rtDeviceInfo[d.sn]?.state === 'empty' ? '● 在线 · 离床' : '● 在线 · 在床' }}</span>
              </div>
              <div class="dsc-sn">
                <span>{{ d.sn }}</span>
                <span class="dsc-scene">{{ d.model }}</span>
              </div>
              <div class="dsc-meta">IP {{ d.ip && d.ip !== '未提供' ? d.ip : '未提供' }}</div>
              <div class="dsc-meta" style="color: var(--amber);">{{ ipGeoLabel(deviceIpGeoOf(d.sn)?.geo) }}</div>
              <div class="dsc-meta">{{ d.network }}</div>
              <div class="dsc-meta" style="color: var(--txt-muted);">
                {{ rtDeviceInfo[d.sn]?.state === 'offline' ? '设备离线 · 无实时回传' : rtDeviceInfo[d.sn]?.state === 'empty' ? `HR 0 · BR 0 · TP 0℃ · 离床 · 采样 ${rtDeviceInfo[d.sn].sampleTime.slice(11) || '--'}` : `HR ${rtDeviceInfo[d.sn].vitals!.hr} · BR ${rtDeviceInfo[d.sn].vitals!.br} · TP ${rtDeviceInfo[d.sn].vitals!.tp}℃ · 在床 · 采样 ${rtDeviceInfo[d.sn].sampleTime.slice(11) || '--'}` }}
              </div>
            </div>
          </div>
          <div class="device-list-footer">
            <span>苏州全域 · {{ ANQIAO_DEVICES.length }} 台在册设备 · 专网全链路畅通</span>
            <span style="color: var(--mint); font-family: 'Share Tech Mono', monospace;">● 链路在线</span>
          </div>
        </template>

        <!-- 2. 机构类（凯健）健康守护与安防看板 -->
        <template v-else>
          <div class="ward-care-dashboard">
            <div class="ward-kpi-quad">
              <div class="ward-quad-cell">
                <div>
                  <div class="title">在院在护长者</div>
                  <div class="num" style="color:#00f0ff">
                    {{ `${activeCampus?.bedsOccupied ?? 85} 位` }}
                  </div>
                  <div class="sub">
                    {{ `${activeCampus?.bedsTotal ?? 87} 张医护床位` }}
                  </div>
                </div>
              </div>
              <div class="ward-quad-cell">
                <div>
                  <div class="title">生理体征采样</div>
                  <div class="num" style="color:var(--mint)">
                    12,840+
                  </div>
                  <div class="sub">
                    今日时序采样数据
                  </div>
                </div>
              </div>
              <div class="ward-quad-cell">
                <div>
                  <div class="title">感知终端健康度</div>
                  <div class="num" style="color:var(--mint)">
                    99.8%
                  </div>
                  <div class="sub">
                    设备在网自检完好
                  </div>
                </div>
              </div>
              <div class="ward-quad-cell">
                <div>
                  <div class="title">预警响应时效</div>
                  <div class="num" style="color:#38bdf8">
                    &lt; 120ms
                  </div>
                  <div class="sub">边缘端实时计算</div>
                </div>
              </div>
            </div>

            <div class="ward-kpi-footer-bar" style="margin-top: 10px; padding: 8px 10px; background: rgba(0,240,255,0.03); border: 1px solid rgba(0,240,255,0.12); border-radius: 4px; font-size: 11px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between;">
              <span>
                失能特护专区 · 顶置与床旁多维感知 · 24小时值守
              </span>
              <span style="color: var(--mint); font-family: 'Share Tech Mono', monospace;">● 实时在线</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===================== 顶部院区选择胶囊样式 ===================== */
.campus-selector-dock {
  display: flex;
  align-items: center;
  gap: 6px;
}

.campus-pill-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(6, 16, 30, 0.85);
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: 4px;
  color: #94a3b8;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.campus-pill-btn:hover {
  border-color: rgba(0, 240, 255, 0.6);
  color: #f0fdfa;
}

.campus-pill-btn.active {
  background: rgba(0, 240, 255, 0.18);
  border-color: #00f0ff;
  color: #00f0ff;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.campus-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748b;
}

.campus-pill-btn.active .campus-dot {
  background: #00ff88;
  box-shadow: 0 0 6px #00ff88;
}

.campus-beds {
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  opacity: 0.8;
}

/* ===================== 通用控件与 SOP 样式 ===================== */
.heatmap-control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 6px;
  flex-wrap: wrap;
}

.floor-selector-group, .heatmap-mode-group {
  display: flex;
  gap: 5px;
}

.floor-pill-btn, .mode-pill-btn {
  background: rgba(0, 240, 255, 0.05);
  border: 1px solid rgba(0, 240, 255, 0.22);
  border-radius: 4px;
  color: #cbd5e1;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.floor-pill-btn:hover, .mode-pill-btn:hover {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.45);
  color: #f8fafc;
}

.floor-pill-btn.active, .mode-pill-btn.active {
  background: rgba(0, 240, 255, 0.25);
  border-color: #00f0ff;
  color: #00f0ff;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.heatmap-legend-dock {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(5, 12, 24, 0.8);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: 4px;
  padding: 5px 10px;
  margin-bottom: 8px;
}

.heat-gradient-bar {
  width: 140px;
  height: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

#heatmap-radiation-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
  mix-blend-mode: screen;
}

.cad-bed-tooltip {
  position: absolute;
  background: rgba(6, 16, 30, 0.95);
  border: 1px solid rgba(0, 240, 255, 0.6);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.35);
  pointer-events: none;
  z-index: 100;
  transform: translate(-50%, -100%);
  min-width: 200px;
}

.dispatch-stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}

.dispatch-stat-cell {
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.14);
  border-radius: 4px;
  padding: 6px;
  text-align: center;
}

.dispatch-stat-cell .v {
  font-family: 'Orbitron', monospace;
  font-size: 18px;
  font-weight: 700;
}

.dispatch-stat-cell .l {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.dispatch-flow-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
}

.dispatch-step-card {
  background: rgba(6, 16, 30, 0.7);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dispatch-step-card.active-alert {
  border-color: rgba(255, 0, 85, 0.5);
  background: rgba(255, 0, 85, 0.06);
}

.dispatch-step-top {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
}

.dispatch-step-top .time {
  font-family: 'Share Tech Mono', monospace;
  color: #94a3b8;
  font-size: 10.5px;
}

.dispatch-step-content {
  font-size: 11px;
  color: #cbd5e1;
  line-height: 1.4;
}

.dispatch-step-footer {
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 10.5px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  padding-top: 4px;
}

/* SOP 4 阶流水线 */
.sop-pipeline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(5, 12, 24, 0.75);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: 4px;
  padding: 5px 8px;
  margin: 4px 0;
}

.sop-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.sop-step .step-num {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(0, 240, 255, 0.15);
  color: #38bdf8;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', monospace;
}

.sop-step.done .step-num {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
  border: 1px solid rgba(0, 255, 136, 0.4);
}

.sop-step.current .step-num {
  background: rgba(255, 0, 85, 0.2);
  color: #ff0055;
  border: 1px solid rgba(255, 0, 85, 0.4);
}

.sop-step .step-tit {
  font-size: 9.5px;
  font-weight: 600;
  color: #e2e8f0;
}

.sop-step .step-time {
  font-size: 9px;
  font-family: 'Share Tech Mono', monospace;
  color: #38bdf8;
}

.sop-step.done.current .step-time {
  color: #00ff88;
}

.sop-step-arrow {
  color: #475569;
  font-size: 13px;
  font-weight: bold;
}

.ward-kpi-quad {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.ward-quad-cell {
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.14);
  border-radius: 6px;
  padding: 12px;
}

.ward-quad-cell .title {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.ward-quad-cell .num {
  font-family: 'Orbitron', monospace;
  font-size: 20px;
  font-weight: 700;
  color: #00f0ff;
  margin-bottom: 2px;
}

.ward-quad-cell .sub {
  font-size: 10.5px;
  color: #64748b;
}

/* ===================== 中科安樵居家设备点位孪生样式 ===================== */
.anqiao-twin-map-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.anqiao-twin-map-wrap :deep(.tech-china-map-container) {
  min-height: 0;
}

.device-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.device-status-card {
  background: rgba(6, 16, 30, 0.7);
  border: 1px solid rgba(100, 116, 139, 0.35);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.device-status-card:hover {
  border-color: rgba(0, 240, 255, 0.55);
  background: rgba(0, 240, 255, 0.06);
  transform: translateY(-1px);
}

.device-status-card.online {
  border-color: rgba(0, 255, 136, 0.45);
  background: rgba(0, 255, 136, 0.05);
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.15);
}

.device-status-card .dsc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.device-status-card .dsc-label {
  font-size: 12.5px;
  font-weight: 700;
  color: #f0fdfa;
}

.device-status-card .dsc-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.device-status-card .dsc-badge.on {
  color: #00ff88;
  background: rgba(0, 255, 136, 0.12);
  border: 1px solid rgba(0, 255, 136, 0.35);
}

.device-status-card .dsc-badge.off {
  color: #94a3b8;
  background: rgba(100, 116, 139, 0.12);
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.device-status-card .dsc-sn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: #38bdf8;
}

.device-status-card .dsc-scene {
  font-size: 10px;
  color: #c77dff;
  background: rgba(199, 125, 255, 0.1);
  border: 1px solid rgba(199, 125, 255, 0.3);
  padding: 0 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.device-status-card .dsc-meta {
  font-size: 10px;
  color: #94a3b8;
  font-family: 'Share Tech Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-list-footer {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(0, 240, 255, 0.03);
  border: 1px solid rgba(0, 240, 255, 0.12);
  border-radius: 4px;
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
