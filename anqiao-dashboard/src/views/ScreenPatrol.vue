<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getPatients, getRoutineMeta } from '../api/client'
import { ORG_PROFILES } from '../projects'
import type { Patient } from '../api/types'
import { generateNationalCards } from '../projects'
import type { PatrolCardItem } from '../projects'
import { cloudGatewayHealth, deviceTelemetry, freshnessOf, isOnline, lastSampleTime, liveDeviceCount, presenceOf } from '../api/deviceTelemetry'
import { deviceIpGeoOf, ipGeoLabel, resolveDeviceIpGeo } from '../api/ipGeo'
import { DEVICE_CATEGORY_NAMES, scanCloudDevices, type CloudScanItem } from '../api/cloudScan'

const props = withDefaults(
  defineProps<{
    active: boolean
    orgId?: string
  }>(),
  {
    orgId: 'anqiao',
  }
)

const emit = defineEmits<{ (e: 'navigate-profile', patientId: string): void }>()

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)
const isNational = computed(() => currentOrg.value.type === 'national_iot')

const statusTabsConfig = computed(() => {
  if (isNational.value) {
    return {
      all: '全部设备',
      alert: '异常预警',
      inBed: '实时在床',
      outBed: '在线离床',
      offline: '设备离线',
    }
  }
  return {
    all: '全部状态',
    alert: '体征/跌倒告警',
    inBed: '在床安卧',
    outBed: '离床活动',
    offline: '设备离线',
  }
})

// 实时遥测在线台数（由全局共享遥测 store 实算，5s 轮询刷新）
const rtLiveCount = computed(() => liveDeviceCount())

const counterEchoText = computed(() => {
  if (isNational.value) {
    if (!cloudGatewayHealth.healthy) {
      return `在册感知终端 <b>${rawCards.value.length}</b> 台 · 实时在线 <b>${rtLiveCount.value}</b> 台 · <span style="color:var(--crimson)">⚠️ ${cloudGatewayHealth.message}</span>`
    }
    return `在册感知终端 <b>${rawCards.value.length}</b> 台 · 在网运行 <b>${rtLiveCount.value}</b> 台 · 实时巡查中`
  }
  return `在护长者 <b>${displayPods.value.length}</b> 位 · 核定床位 87 张 · 终端在网 139 台 · 连续监护中`
})

// ======================= 筛选状态 =======================
const selectedCategory = ref<string>('all')
const statusFilter = ref<'all' | 'alert' | 'in-bed' | 'out-bed' | 'offline'>('all')
const searchKeyword = ref<string>('')

// 随机构切换重置筛选
watch(
  () => props.orgId,
  () => {
    selectedCategory.value = 'all'
    statusFilter.value = 'all'
    searchKeyword.value = ''
    refreshData()
  }
)

// ======================= Row 1 分类标签定义（与底层卡片数量严密闭环） =======================
const categoryTabs = computed(() => {
  if (isNational.value) {
    // 中科安樵：设备口径（refreshData 已按在线状态重映射 category：direct=实时遥测 / archived=在册归档）
    return [
      { key: 'all', label: '全部在册设备', count: rawCards.value.length },
      { key: 'direct', label: '实时遥测', count: rawCards.value.filter(c => c.category === 'direct').length },
      { key: 'archived', label: '在册归档', count: rawCards.value.filter(c => c.category === 'archived').length },
    ]
  }
  // kaijian nursing home
  return [
    { key: 'all', label: '全院长者全部', count: rawCards.value.length || 87 },
    { key: '4F', label: '4F 完全失能专区', count: rawCards.value.filter(c => c.category === '4F').length || 22 },
    { key: '3F', label: '3F 认知障碍专区', count: rawCards.value.filter(c => c.category === '3F').length || 21 },
    { key: '2F', label: '2F 术后康复专区', count: rawCards.value.filter(c => c.category === '2F').length || 22 },
    { key: '1F', label: '1F 慢病颐养专区', count: rawCards.value.filter(c => c.category === '1F').length || 22 },
  ]
})

const searchPlaceholder = computed(() => {
  if (isNational.value) return '🔍 快速搜索点位名称、设备SN (如 太湖科创中心·903、ASH01146)...'
  return '🔍 快速搜索长者姓名、床位号 (如 404-A、李*)...'
})

// ======================= 数据源与适配器 =======================
const allPatients = ref<Patient[]>([])
const routineMap = reactive(new Map<string, { normalNightTrips: number; rehabScheduled: boolean }>())

// 中科安樵卡片附加实时遥测字段（rtLive=在线档才允许渲染示波与"实时"文案；rtPresence 区分在床/离床）
type RtPatrolCard = PatrolCardItem & { rtLive?: boolean; rtPresence?: 'person' | 'empty' | null; rtSampleTime?: string }
const rawCards = ref<RtPatrolCard[]>([])

// 中科安樵：全量真实在册设备卡片，按共享遥测 store 用户口径三态 enrich（完全由 latest_data ≤90s 新鲜样本驱动）
// person=设备在线·在床（真实样本值，含真实 0）；empty=设备在线·离床（全 0 空数据本身即在线证据，0 值+样本时间）；
// 离线（无新鲜样本）→ 不展示任何体征数值与采样时间
function buildNationalCards(): RtPatrolCard[] {
  return generateNationalCards().map(c => {
    const sn = c.realDeviceId || c.id
    const online = isOnline(sn)
    const presence = presenceOf(sn) // 'person'（在床）| 'empty'（离床）| null（离线）
    const entry = deviceTelemetry[sn]
    const data = entry?.data ?? null
    const hasSample = freshnessOf(sn) === 'live' && !!data
    const vitals = !online
      ? null
      : hasSample && data
      ? { hr: Math.round(data.hr), br: Math.round(data.br), tp: Number(data.tp.toFixed(1)) }
      : { hr: 0, br: 0, tp: 0 } // 在线离床：如实呈现 0 值
    const sampleTime = lastSampleTime(sn)

    let offlineReason = '设备离线 · 无实时回传'
    if (entry?.data?.created_at) {
      const timeStr = String(entry.data.created_at).replace('T', ' ')
      offlineReason = `设备离线 · 停更于 ${timeStr.slice(5, 19)}`
    } else if (entry?.errorMsg) {
      offlineReason = `设备离线 · ${entry.errorMsg}`
    }

    return {
      ...c,
      category: online ? 'direct' : 'archived',
      presence: !online
        ? { inBed: false, text: '○ 设备离线 · 无实时回传', cls: 'offline' as const }
        : presence === 'empty'
        ? { inBed: false, text: '● 设备在线 · 离床', cls: 'out-bed' as const }
        : { inBed: true, text: '● 设备在线 · 在床', cls: 'in-bed' as const },
      vitals,
      rtLive: online,
      rtPresence: presence,
      rtSampleTime: sampleTime ? String(sampleTime).replace('T', ' ').slice(0, 19) : '',
      footer: {
        ...c.footer,
        statusText: !online
          ? offlineReason
          : presence === 'empty'
          ? (sampleTime ? `在线离床 · 采样 ${sampleTime.slice(11, 19)}` : '在线离床 · 监测就绪')
          : '设备在线 · 实时在床',
      },
    }
  })
}


// 5. 护理院（凯健）卡片构建：87 张核定病床（4F 22床 + 3F 21床 + 2F 22床 + 1F 22床）
function generateNursingHomeCards(patients: Patient[]): PatrolCardItem[] {
  return patients.map(p => {
    const isAl = p.abnormal !== null
    const floorLetter = p.bed_id.charAt(0) + 'F'
    const meta = routineMap.get(p.patient_id)
    const bathInfo = p.abnormal?.fall
      ? { text: '⚠ 紧急跌倒报警', isAlert: true }
      : parseInt(p.patient_id.slice(1), 10) % 9 === 0
      ? { text: '洗手间有人', isAlert: false }
      : { text: '洗手间无人', isAlert: false }

    const idNum = parseInt(p.patient_id.slice(1), 10) || 1
    const isOffline = [12, 45, 87].includes(idNum)
    const boundDevices = [
      { type: 'AI健康守护仪', sn: `HG-KJ-${p.bed_id}`, space: '床头', online: !isOffline, statusText: isOffline ? '未开机' : '在床监测' },
      { type: '跌倒监测雷达', sn: `FR-KJ-${p.bed_id}`, space: '卫浴', online: true, statusText: p.abnormal?.fall ? '跌倒预警' : '防跌布防' },
    ]

    return {
      id: p.patient_id,
      code: p.bed_id,
      name: p.name,
      gender: p.gender,
      age: p.age,
      tag: p.care_level,
      category: floorLetter,
      deviceBadge: '守护仪+卫浴报警',
      boundDevices,
      isAlert: isAl,
      alertType: p.abnormal?.types.join(',') || undefined,
      presence: {
        inBed: p.vitals.in_bed,
        text: p.vitals.in_bed ? '● 在床' : '○ 离床',
        cls: p.vitals.in_bed ? 'in-bed' : 'out-bed',
      },
      vitals: {
        hr: p.vitals.hr,
        br: p.vitals.br,
        tp: p.vitals.tp,
      },
      metrics: [
        { label: '呼吸', val: String(p.vitals.br), unit: '次/分', isAbnormal: p.abnormal?.types.includes('br'), color: 'var(--cyan)' },
        { label: '心率', val: String(p.vitals.hr), unit: 'bpm', isAbnormal: p.abnormal?.types.includes('hr'), color: 'var(--crimson)' },
        { label: '体温', val: p.vitals.tp.toFixed(1), unit: '℃', isAbnormal: p.abnormal?.types.includes('tp'), color: 'var(--amber)' },
      ],
      footer: {
        staffText: bathInfo.text,
        statusText: meta?.rehabScheduled && !p.vitals.in_bed ? '康复排班进行中' : `起夜基线: ${meta?.normalNightTrips ?? 0}次/晚`,
        isAlertStatus: bathInfo.isAlert,
      },
      patientId: p.patient_id,
    }
  })
}

// 刷新并适配数据
let refreshSeq = 0
async function refreshData() {
  const seq = ++refreshSeq
  if (isNational.value) {
    // 中科安樵：全量真实在册设备；category/presence/vitals/footer 全部按共享遥测 store 新鲜度重映射
    rawCards.value = buildNationalCards()
  } else {
    // 护理院从服务端拉取
    const res = await getPatients({ page: 1, page_size: 200 })
    if (seq !== refreshSeq) return
    allPatients.value = res.list
    for (const p of res.list) {
      if (!routineMap.has(p.patient_id)) routineMap.set(p.patient_id, getRoutineMeta(p.patient_id))
    }
    rawCards.value = generateNursingHomeCards(res.list)
  }
  await nextTick()
  setupEcg()
}

// 随机构切换、激活状态变化、及共享遥测 store 轮询（cloudGatewayHealth.lastCheckedAt）自适应刷新卡片
watch(
  [() => props.orgId, () => props.active, () => cloudGatewayHealth.lastCheckedAt],
  async () => {
    await refreshData()
  }
)

// ======================= 云端设备扫描（仅中科安樵 national 模式）：云平台绑定设备与本地台账比对，发现漏接设备 =======================
const scanOpen = ref(false)
const scanLoading = ref(false)
const scanError = ref('')
const scanItems = ref<CloudScanItem[]>([])
const scanScanned = ref(false) // 是否至少成功扫描过一次（用于红点计数徽标）
const scanProgress = ref({ scanned: 0, total: 250 }) // 全账号扫描进度（扫描账号中 x/250）
const scanAccounts = ref(0) // 成功拉取到设备列表的账号数

const scanStats = computed(() => ({
  total: scanItems.value.length,
  registered: scanItems.value.filter(i => i.registered).length,
  unregistered: scanItems.value.filter(i => !i.registered).length,
  online: scanItems.value.filter(i => i.online).length,
}))

function scanCategoryLabel(cat: string): string {
  return DEVICE_CATEGORY_NAMES[cat] || cat || '未知类型'
}

async function runCloudScan(openPanel = true) {
  if (scanLoading.value) return
  scanLoading.value = true
  scanError.value = ''
  scanProgress.value = { scanned: 0, total: 250 }
  try {
    const res = await scanCloudDevices((scanned, total) => {
      scanProgress.value = { scanned, total }
    })
    scanItems.value = res.items
    scanAccounts.value = res.accountsScanned
    scanScanned.value = true
  } catch (e) {
    scanError.value = e instanceof Error ? e.message : String(e)
  } finally {
    scanLoading.value = false
    if (openPanel) scanOpen.value = true
  }
}

// 进入中科安樵巡查屏时自动扫描一次（后台执行，不自动展开面板）
watch([isNational, () => props.active], ([nat, act]) => {
  if (nat && act && !scanScanned.value) void runCloudScan(false)
}, { immediate: true })

// ======================= 过滤计算与统计 =======================
const displayPods = computed(() => {
  let list = rawCards.value

  // 1. Row 1 类别过滤
  if (selectedCategory.value !== 'all') {
    list = list.filter(item => item.category === selectedCategory.value)
  }

  // 2. Row 2 状态过滤
  if (statusFilter.value === 'alert') {
    list = list.filter(item => item.isAlert)
  } else if (statusFilter.value === 'in-bed') {
    list = list.filter(item => isNational.value ? (item.rtLive && item.rtPresence === 'person') : item.presence.inBed)
  } else if (statusFilter.value === 'out-bed') {
    list = list.filter(item => isNational.value ? (item.rtLive && item.rtPresence === 'empty') : (!item.presence.inBed && item.rtLive !== false))
  } else if (statusFilter.value === 'offline') {
    list = list.filter(item => isNational.value ? !item.rtLive : item.rtLive === false)
  }

  // 3. 关键字搜索过滤
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(item =>
      item.name.toLowerCase().includes(kw) ||
      item.code.toLowerCase().includes(kw) ||
      item.tag.toLowerCase().includes(kw) ||
      item.footer.staffText.toLowerCase().includes(kw)
    )
  }

  return list
})

const counts = computed(() => {
  let baseList = rawCards.value
  if (selectedCategory.value !== 'all') {
    baseList = baseList.filter(item => item.category === selectedCategory.value)
  }
  return {
    all: baseList.length,
    alert: baseList.filter(item => item.isAlert).length,
    inBed: baseList.filter(item => isNational.value ? (item.rtLive && item.rtPresence === 'person') : item.presence.inBed).length,
    outBed: baseList.filter(item => isNational.value ? (item.rtLive && item.rtPresence === 'empty') : (!item.presence.inBed && item.rtLive !== false)).length,
    offline: baseList.filter(item => isNational.value ? !item.rtLive : item.rtLive === false).length,
  }
})

// ======================= Canvas 动态心电与射频回波绘制引擎 =======================
interface EcgItem {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  card: PatrolCardItem
  visible: boolean
  offset: number
  speed: number
  period: number
  rAmp: number
  hasArrhythmia: boolean
  isRfPulse: boolean
}

let ecgItems: EcgItem[] = []
let observer: IntersectionObserver | null = null
let rafId = 0
const canvasMap = new Map<string, HTMLCanvasElement>()

function collectCanvas(el: Element | object | null, cardId: string) {
  if (el instanceof HTMLCanvasElement) canvasMap.set(cardId, el)
}

function setupEcg() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  ecgItems = []
  observer = new IntersectionObserver(entries => {
    for (const en of entries) {
      const item = ecgItems.find(i => i.canvas === en.target)
      if (item) item.visible = en.isIntersecting
    }
  }, { root: null, threshold: 0 })

  for (const card of displayPods.value) {
    // 离线设备：不渲染假体征/回波曲线动画，仅显示离线占位
    if (isNational.value && !card.rtLive) continue
    // 在线但离床：canvas 保留 0 值基线（空白），不画模拟心跳波形
    if (isNational.value && card.rtPresence === 'empty') continue
    if (!card.vitals && !card.presence.inBed) continue
    const canvas = canvasMap.get(card.id)
    if (!canvas) continue
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    canvas.width = canvas.clientWidth || 240
    canvas.height = canvas.clientHeight || 26
    const hr = card.vitals?.hr || 75

    ecgItems.push({
      canvas,
      ctx,
      card,
      visible: false,
      offset: Math.random() * 200,
      speed: (hr / 60) * 1.5,
      period: Math.max(70, Math.round((60 / hr) * 130)),
      rAmp: hr > 90 ? 0.48 : hr < 70 ? 0.32 : 0.40,
      hasArrhythmia: card.isAlert,
      isRfPulse: !!card.isRfEcho,
    })
    observer!.observe(canvas)
  }
}

function drawEcgFrame(item: EcgItem) {
  const ctx = item.ctx
  const canvas = item.canvas
  const w = canvas.width
  const h = canvas.height
  if (!w || !h) return

  ctx.clearRect(0, 0, w, h)
  ctx.beginPath()

  const waveColor = item.card.isAlert
    ? '#ff0055'
    : item.card.isRfEcho
    ? '#00f0ff'
    : item.card.presence.inBed
    ? '#00ff88'
    : '#ffb703'

  ctx.strokeStyle = waveColor
  ctx.lineWidth = 1.8
  ctx.shadowBlur = 6
  ctx.shadowColor = waveColor

  item.offset += item.speed

  // 模式 1：全国物联终端 FMCW 毫米波高频射频回波模拟
  if (item.isRfPulse) {
    const P = 60
    for (let x = 0; x < w; x += 2) {
      const phase = (x + item.offset * 1.6) % P
      let y = h / 2
      // 射频脉冲群
      if (phase > P * 0.35 && phase < P * 0.65) {
        y += Math.sin((phase / P) * Math.PI * 8) * (h * 0.38)
      } else {
        y += Math.sin((x + item.offset) * 0.1) * 1.5
      }
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  } else {
    // 模式 2：长者连续心电/生命微动示波
    const P = item.period
    const step = 2

    for (let x = 0; x < w; x += step) {
      const phase = (x + item.offset) % P
      let y = h / 2

      if (item.hasArrhythmia) {
        if (phase > P * 0.30 && phase < P * 0.35) y -= 3
        else if (phase >= P * 0.35 && phase < P * 0.38) y += 2
        else if (phase >= P * 0.38 && phase < P * 0.43) y -= h * item.rAmp * 1.15
        else if (phase >= P * 0.43 && phase < P * 0.47) y -= h * item.rAmp * 0.7
        else if (phase >= P * 0.47 && phase < P * 0.52) y += h * 0.32
        else if (phase >= P * 0.55 && phase < P * 0.65) y -= 4
        y += Math.sin((x + item.offset) * 0.2) * 1.2
      } else {
        if (phase > P * 0.32 && phase < P * 0.38) y -= 2.5
        else if (phase >= P * 0.38 && phase < P * 0.41) y += 2
        else if (phase >= P * 0.41 && phase < P * 0.46) y -= h * item.rAmp
        else if (phase >= P * 0.46 && phase < P * 0.50) y += h * 0.28
        else if (phase >= P * 0.55 && phase < P * 0.65) y -= 3.5
      }

      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // 示波光扫描亮点
  const sweepDotX = (item.offset * 1.8) % w
  let sweepY = h / 2
  ctx.beginPath()
  ctx.arc(sweepDotX, sweepY, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = waveColor
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.shadowBlur = 0
}

function animateEcg() {
  if (props.active) {
    for (const item of ecgItems) {
      if (item.visible) drawEcgFrame(item)
    }
  }
  rafId = requestAnimationFrame(animateEcg)
}

function onCardClick(card: PatrolCardItem) {
  emit('navigate-profile', card.patientId)
}

function onResize() {
  for (const item of ecgItems) {
    item.canvas.width = item.canvas.clientWidth || 240
    item.canvas.height = item.canvas.clientHeight || 26
  }
}

onMounted(async () => {
  if (isNational.value) {
    void resolveDeviceIpGeo()
  }
  await refreshData()
  rafId = requestAnimationFrame(animateEcg)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  if (observer) observer.disconnect()
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="s2-command-toolbar">
    <!-- Row 1：业务主体与分类标签（随机构类型自适应） -->
    <div class="s2-toolbar-row1">
      <div class="s2-floor-group">
        <div
          v-for="t in categoryTabs"
          :key="t.key"
          class="s2-floor-tab"
          :class="{ active: selectedCategory === t.key }"
          @click="selectedCategory = t.key"
        >
          {{ t.label }} [{{ t.count }}]
        </div>
      </div>
      <div class="s2-search-box">
        <input type="text" v-model="searchKeyword" :placeholder="searchPlaceholder" />
      </div>
      <!-- 云端设备扫描入口（仅中科安樵）：拉取云账号全部绑定设备与本地台账比对 -->
      <button
        v-if="isNational"
        class="s2-scan-btn"
        :disabled="scanLoading"
        @click="runCloudScan(true)"
      >
        {{ scanLoading ? `扫描账号中 ${scanProgress.scanned}/${scanProgress.total}` : '📡 云端扫描' }}
        <span v-if="scanScanned && scanStats.unregistered > 0" class="s2-scan-badge">{{ scanStats.unregistered }}</span>
      </button>
    </div>

    <!-- Row 2：状态维度与即时遥测统计 -->
    <div class="s2-toolbar-row2">
      <div class="s2-counter-echo" v-html="counterEchoText"></div>
      <div class="cyber-tabs">
        <div
          class="cyber-tab"
          :class="{ active: statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          {{ statusTabsConfig.all }} [{{ counts.all }}]
        </div>
        <div
          class="cyber-tab"
          :class="{ active: statusFilter === 'alert' }"
          style="color:var(--crimson);border-color:rgba(255,0,85,0.3)"
          @click="statusFilter = 'alert'"
        >
          {{ statusTabsConfig.alert }} [{{ counts.alert }}]
        </div>
        <div
          class="cyber-tab"
          :class="{ active: statusFilter === 'in-bed' }"
          @click="statusFilter = 'in-bed'"
        >
          {{ statusTabsConfig.inBed }} [{{ counts.inBed }}]
        </div>
        <div
          class="cyber-tab"
          :class="{ active: statusFilter === 'out-bed' }"
          @click="statusFilter = 'out-bed'"
        >
          {{ statusTabsConfig.outBed }} [{{ counts.outBed }}]
        </div>
        <div
          class="cyber-tab"
          :class="{ active: statusFilter === 'offline' }"
          style="color:var(--txt-muted);border-color:rgba(148,163,184,0.3)"
          @click="statusFilter = 'offline'"
        >
          {{ statusTabsConfig.offline }} [{{ counts.offline }}]
        </div>
      </div>
    </div>
  </div>

  <!-- 主示波遥测卡片网格 -->
  <div class="telemetry-pod-grid">
    <template v-if="displayPods.length > 0">
      <div
        v-for="p in displayPods"
        :key="p.id"
        class="telemetry-pod"
        :class="{ 'alert-state': p.isAlert }"
        @click="onCardClick(p)"
      >
        <div class="pod-head">
          <div class="pod-bed-id">
            <span
              style="display:inline-block;width:7px;height:7px;border-radius:50%;"
              :style="{ background: p.isAlert ? 'var(--crimson)' : 'var(--mint)' }"
            ></span>
            <span class="pod-bed-num" :title="p.code">{{ p.code }}</span>
          </div>
          <div class="pod-presence" :class="p.presence.cls">
            {{ p.presence.text }}
          </div>
        </div>

        <div class="pod-personnel">
          <div
            class="pod-avatar"
            :class="p.gender === 'female' ? 'female' : 'male'"
            :style="p.isRfEcho ? 'background: linear-gradient(135deg, #00f0ff, #0284c7);' : ''"
          >
            {{ p.isRfEcho ? '📡' : p.name[0] }}
          </div>
          <div class="pod-bio">
            <div class="name-row">
              <span class="name">{{ p.name }}</span>
              <span v-if="p.isRealHardware" class="pod-hw-live-tag">● 实时在网</span>
              <span v-if="p.deviceBadge" class="pod-device-pill">{{ p.deviceBadge }}</span>
            </div>
            <div class="meta">
              {{ p.isRfEcho ? p.tag : `${p.gender === 'female' ? '女' : '男'} · ${p.age}岁 · ${p.tag}` }}
            </div>
            <div v-if="p.boundDevices && p.boundDevices.length" class="pod-bound-devices-bar">
              <span
                v-for="dev in p.boundDevices"
                :key="dev.sn"
                class="pod-bound-chip"
                :class="{ offline: !dev.online }"
                :title="`${dev.type} · ${dev.space} · ${dev.online ? (dev.statusText || '在线') : '未开机'}`"
              >
                {{ dev.sn }}
              </span>
            </div>
          </div>
        </div>

        <!-- 硬件加速示波 Canvas (心电 / 射频脉冲回波)；仅 live 档渲染实时动画，离线显示占位 -->
        <div class="pod-ecg-box" :title="isNational ? (p.rtLive ? (p.rtPresence === 'empty' ? '设备在线 · 离床' : '生理体征监测中') : '设备离线') : (p.vitals || p.presence.inBed ? '体征监测中' : '离线归档')">
          <canvas v-if="isNational ? p.rtLive : (p.vitals || p.presence.inBed)" class="pod-ecg-canvas" :ref="el => collectCanvas(el, p.id)"></canvas>
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:10px;color:var(--txt-muted);font-family:var(--font-mono)">{{ isNational ? '○ 设备离线' : '○ 离线归档' }}</div>
        </div>

        <!-- 3 维关键遥测指标 -->
        <div class="pod-metrics-row">
          <div
            v-for="(m, mi) in p.metrics"
            :key="mi"
            class="metric-cell"
            :class="{ abnormal: m.isAbnormal }"
          >
            <div class="label">{{ m.label }}</div>
            <div class="val" :style="{ color: m.color || 'var(--cyan)' }">
              {{ m.val }} <span style="font-size:9px;font-weight:normal">{{ m.unit }}</span>
            </div>
          </div>
        </div>

        <!-- 底部责任人与安全基线 -->
        <div class="pod-footer">
          <div
            class="foot-left"
            :style="p.footer.isAlertStatus ? 'color:var(--crimson); font-weight:bold;' : ''"
          >
            {{ p.footer.staffText }}
          </div>
          <div class="foot-right" :style="p.footer.isAlertStatus ? 'color:var(--crimson);' : ''">
            {{ p.footer.statusText }}
          </div>
        </div>

        <!-- 中科安樵：共享遥测 store 实时状态小字行（在床=真实样本值+采样时间 / 离床=真实 0 值+采样时间 / 离线不展示任何数值） -->
        <div v-if="isNational" style="font-size:9.5px;color:var(--txt-muted);font-family:var(--font-mono);margin-top:4px;">
          {{ p.rtPresence === 'empty' ? `离床 · 监测就绪 · 最近上报 ${p.rtSampleTime ? p.rtSampleTime.slice(11) : '--'}` : p.vitals ? `心率 ${p.vitals.hr} · 呼吸 ${p.vitals.br} · 体温 ${p.vitals.tp}℃ · 在床 · 最近上报 ${p.rtSampleTime ? p.rtSampleTime.slice(11) : '--'}` : '设备离线 · 待巡检' }}
        </div>
        <!-- 中科安樵：IP 归属地估算（仅展示辅助，非定位依据） -->
        <div v-if="isNational" style="font-size:9.5px;color:var(--amber);font-family:var(--font-mono);margin-top:2px;">
          {{ ipGeoLabel(deviceIpGeoOf(p.realDeviceId)?.geo) }}
        </div>
      </div>
    </template>
    <div
      v-else
      style="grid-column: 1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; height:240px; color:var(--txt-muted); font-size:14px; gap:8px;"
    >
      <span style="font-size:28px;">🔍</span>
      <span>未检索到匹配的巡查监护单元，请尝试切换所属片区或调整筛选关键字</span>
    </div>
  </div>

  <!-- 云端设备扫描面板（仅中科安樵）：云账号绑定设备与本地台账比对，amber 高亮未接入设备 -->
  <div v-if="isNational && scanOpen" class="s2-scan-overlay" @click.self="scanOpen = false">
    <div class="s2-scan-panel">
      <div class="s2-scan-head">
        <span class="s2-scan-title">📡 云端设备扫描 · 云平台绑定设备 ↔ 看板台账比对</span>
        <button class="s2-scan-close" @click="scanOpen = false">✕</button>
      </div>
      <div v-if="scanLoading" class="s2-scan-state">扫描账号中 {{ scanProgress.scanned }}/{{ scanProgress.total }}… 正在遍历云账号拉取设备列表</div>
      <div v-else-if="scanError" class="s2-scan-state" style="color: var(--crimson);">
        云平台扫描失败：{{ scanError }}
        <button class="s2-scan-retry" @click="runCloudScan(false)">重试</button>
      </div>
      <template v-else>
        <div class="s2-scan-list">
          <div
            v-for="it in scanItems"
            :key="it.deviceId"
            class="s2-scan-row"
            :class="{ unregistered: !it.registered }"
          >
            <span class="sn">{{ it.deviceId }}</span>
            <span class="acct">账号 #{{ it.userId }}</span>
            <span class="alias">{{ it.alias || '—' }}</span>
            <span class="cat">{{ scanCategoryLabel(it.category) }}</span>
            <span class="time">{{ it.latestDataTime || '—' }}</span>
            <span class="st" :style="{ color: it.online ? 'var(--mint)' : 'var(--txt-muted)' }">{{ it.online ? '● 在线' : '○ 离线' }}</span>
            <span class="reg" :style="{ color: it.registered ? 'var(--cyan)' : 'var(--amber)' }">{{ it.registered ? '✓ 已接入台账' : '⚠ 未接入' }}</span>
          </div>
          <div v-if="!scanItems.length" class="s2-scan-state">云平台全部账号下未发现任何绑定设备</div>
        </div>
        <div class="s2-scan-foot">
          云端共 {{ scanStats.total }} 台 · 已接入 {{ scanStats.registered }} 台 · 未接入 {{ scanStats.unregistered }} 台 · 当前在线 {{ scanStats.online }} 台 · 已扫账号 {{ scanAccounts }} 个
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.foot-left {
  font-size: 10px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.foot-right {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--txt-secondary);
}

.s2-counter-echo :deep(b) {
  color: var(--cyan);
  font-family: var(--font-digit);
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.name-row .name {
  white-space: nowrap;
  font-weight: 700;
  font-size: 13px;
  color: #f1f5f9;
}

.pod-device-pill {
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.28);
  color: var(--cyan);
  white-space: nowrap;
}

.pod-bound-devices-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}

.pod-bound-chip {
  font-family: var(--font-mono);
  font-size: 8.5px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(0, 255, 136, 0.08);
  border: 1px solid rgba(0, 255, 136, 0.3);
  color: var(--mint);
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.pod-bound-chip.offline {
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.3);
  color: var(--txt-muted);
}

.pod-hw-live-tag {
  font-family: var(--font-mono);
  font-size: 8.5px;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(0, 255, 136, 0.16);
  border: 1px solid rgba(0, 255, 136, 0.5);
  color: #00ff88;
  white-space: nowrap;
  box-shadow: 0 0 6px rgba(0, 255, 136, 0.3);
}

/* ======================= 云端设备扫描 ======================= */
.s2-scan-btn {
  position: relative;
  margin-left: 10px;
  padding: 5px 12px;
  font-size: 11.5px;
  font-family: var(--font-mono);
  color: var(--cyan);
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.4);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, box-shadow 0.2s;
}

.s2-scan-btn:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.16);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.25);
}

.s2-scan-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.s2-scan-badge {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 8px;
  background: var(--amber);
  color: #1a1205;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  box-shadow: 0 0 8px rgba(255, 183, 3, 0.6);
}

.s2-scan-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(3, 8, 20, 0.72);
  backdrop-filter: blur(3px);
}

.s2-scan-panel {
  width: min(860px, 92vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, rgba(8, 20, 38, 0.97), rgba(4, 12, 26, 0.97));
  border: 1px solid rgba(0, 240, 255, 0.35);
  border-radius: 8px;
  box-shadow: 0 0 32px rgba(0, 240, 255, 0.18), 0 12px 40px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.s2-scan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 240, 255, 0.2);
}

.s2-scan-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--cyan);
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
}

.s2-scan-close {
  background: none;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 4px;
  color: var(--txt-secondary);
  font-size: 12px;
  padding: 2px 8px;
  cursor: pointer;
}

.s2-scan-close:hover {
  color: var(--crimson);
  border-color: rgba(255, 0, 85, 0.5);
}

.s2-scan-state {
  padding: 28px 16px;
  text-align: center;
  font-size: 12.5px;
  color: var(--txt-secondary);
  font-family: var(--font-mono);
}

.s2-scan-retry {
  margin-left: 10px;
  padding: 2px 10px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--cyan);
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.4);
  border-radius: 4px;
  cursor: pointer;
}

.s2-scan-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.s2-scan-row {
  display: grid;
  grid-template-columns: 1.1fr 0.7fr 1.3fr 1fr 1.3fr 0.7fr 1fr;
  gap: 8px;
  align-items: center;
  padding: 7px 10px;
  margin-bottom: 5px;
  font-size: 11.5px;
  font-family: var(--font-mono);
  color: var(--txt-secondary);
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.12);
  border-radius: 4px;
}

.s2-scan-row.unregistered {
  background: rgba(255, 183, 3, 0.08);
  border-color: rgba(255, 183, 3, 0.45);
  box-shadow: 0 0 10px rgba(255, 183, 3, 0.12);
}

.s2-scan-row .sn {
  color: #38bdf8;
  font-weight: 700;
}

.s2-scan-row .acct {
  color: var(--amber);
  font-size: 10.5px;
}

.s2-scan-row .alias {
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s2-scan-row .time {
  color: var(--txt-muted);
  font-size: 10.5px;
}

.s2-scan-foot {
  padding: 10px 16px;
  border-top: 1px solid rgba(0, 240, 255, 0.2);
  font-size: 11.5px;
  font-family: var(--font-mono);
  color: var(--cyan);
  letter-spacing: 0.3px;
}
</style>
