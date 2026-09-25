<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ANQIAO_DEVICES } from '../assets/anqiaoDevices'
import { archiveOrMissing, getLtciArchive, isMissing, MISSING_HINT, type LtciArchive } from '../assets/ltciArchive'
import { cloudGatewayHealth, deviceTelemetry, lastSampleTime, liveDeviceCount, offlineReason, presenceOf } from '../api/deviceTelemetry'
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

// ======================= 巡查卡片模型：参保长者档案 + 绑定设备 + 防骗核验 =======================
type PresenceState = 'person' | 'empty' | null

interface PatrolCard {
  sn: string
  label: string
  model: string
  network: string
  district: string
  archive: LtciArchive
  presence: PresenceState
  hr: number | null   // 仅在线（在床/离床）展示真实值；离线恒为 null
  br: number | null
  tp: number | null   // 真实体温（℃）
  sampleTime: string  // 仅在线展示真实采样时间；离线为空串
}

const cards = ref<PatrolCard[]>([])

// 卡片全部由真实在册设备 + 共享遥测 store 三态驱动；档案字段统一走 ltciArchive 空壳（未获取）
function buildCards(): PatrolCard[] {
  return ANQIAO_DEVICES.map(d => {
    const presence = presenceOf(d.sn) // 'person'在床 | 'empty'离床 | null离线
    const data = presence ? deviceTelemetry[d.sn]?.data ?? null : null
    return {
      sn: d.sn,
      label: d.label,
      model: d.model,
      network: d.network,
      district: d.district,
      archive: getLtciArchive(d.sn),
      presence,
      hr: data ? Math.round(data.hr) : null,
      br: data ? Math.round(data.br) : null,
      tp: data && typeof data.tp === 'number' ? Number(data.tp.toFixed(1)) : null,
      sampleTime: presence ? lastSampleTime(d.sn) : '',
    }
  })
}

function presenceText(c: PatrolCard): string {
  if (c.presence === 'person') return '● 在线·在床'
  if (c.presence === 'empty') return '● 在线·离床'
  return `○ 离线 · ${offlineReason(c.sn)}`
}

function presenceCls(c: PatrolCard): 'in-bed' | 'out-bed' | 'offline' {
  if (c.presence === 'person') return 'in-bed'
  if (c.presence === 'empty') return 'out-bed'
  return 'offline'
}

// 防骗核验状态标签（只基于真实三态）
function verifyText(c: PatrolCard): string {
  if (c.presence === 'person') return '🟢 居家在位·设备核验通过'
  if (c.presence === 'empty') return '🔵 离床活动·持续监测'
  return '🔴 设备离线·无法核验'
}

function verifyCls(c: PatrolCard): 'ok' | 'watch' | 'bad' {
  if (c.presence === 'person') return 'ok'
  if (c.presence === 'empty') return 'watch'
  return 'bad'
}

function presenceDotColor(c: PatrolCard): string {
  if (c.presence === 'person') return 'var(--mint)'
  if (c.presence === 'empty') return 'var(--amber)'
  return 'rgba(148, 163, 184, 0.6)'
}

// 实时遥测在线台数（由全局共享遥测 store 实算，5s 轮询刷新）
const rtLiveCount = computed(() => liveDeviceCount())

const counterEchoText = computed(() => {
  if (!cloudGatewayHealth.healthy) {
    return `在册感知终端 <b>${cards.value.length}</b> 台 · 实时在线 <b>${rtLiveCount.value}</b> 台 · <span style="color:var(--crimson)">⚠️ ${cloudGatewayHealth.message}</span>`
  }
  return `在册感知终端 <b>${cards.value.length}</b> 台 · 在网运行 <b>${rtLiveCount.value}</b> 台 · 长护险在护巡查中`
})

// ======================= 筛选状态 =======================
const statusFilter = ref<'all' | 'in-bed' | 'out-bed' | 'offline'>('all')
const searchKeyword = ref<string>('')

const searchPlaceholder = '🔍 快速搜索设备SN / 参保人 (如 许丽、何家齐、ASH01086)...'

const statusTabs: Array<{ key: typeof statusFilter.value; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'in-bed', label: '在床' },
  { key: 'out-bed', label: '离床' },
  { key: 'offline', label: '离线' },
]

function matchStatus(c: PatrolCard, key: typeof statusFilter.value): boolean {
  if (key === 'in-bed') return c.presence === 'person'
  if (key === 'out-bed') return c.presence === 'empty'
  if (key === 'offline') return c.presence === null
  return true
}

const counts = computed(() => ({
  all: cards.value.length,
  'in-bed': cards.value.filter(c => c.presence === 'person').length,
  'out-bed': cards.value.filter(c => c.presence === 'empty').length,
  offline: cards.value.filter(c => c.presence === null).length,
}))

function tabCount(key: typeof statusFilter.value): number {
  return counts.value[key]
}

const displayCards = computed(() => {
  let list = cards.value.filter(c => matchStatus(c, statusFilter.value))
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(c =>
      c.sn.toLowerCase().includes(kw) ||
      c.label.toLowerCase().includes(kw) ||
      c.model.toLowerCase().includes(kw) ||
      c.district.toLowerCase().includes(kw) ||
      (c.archive.elderName && c.archive.elderName.toLowerCase().includes(kw))
    )
  }
  return list
})

// ======================= 数据刷新 =======================
let refreshSeq = 0
async function refreshData() {
  const seq = ++refreshSeq
  cards.value = buildCards()
  if (seq !== refreshSeq) return
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

// ======================= 云端设备扫描：云平台绑定设备与本地台账比对，发现漏接设备 =======================
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

// 进入巡查屏时自动扫描一次（后台执行，不自动展开面板）
watch(() => props.active, (act) => {
  if (act && !scanScanned.value) void runCloudScan(false)
}, { immediate: true })

// ======================= Canvas 动态多参数生理示波（心率·呼吸·体温同图） =======================
interface EcgItem {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  visible: boolean
  offset: number
  speed: number
  period: number
  rAmp: number
  hr: number
  br: number
  tp: number
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

  for (const card of displayCards.value) {
    // 离线：不渲染波形；在线（在床动态示波/离床基线巡检）：均构建示波容器
    if (!card.presence) continue
    const canvas = canvasMap.get(card.sn)
    if (!canvas) continue
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    canvas.width = canvas.clientWidth || 240
    canvas.height = canvas.clientHeight || 38
    const hr = card.hr || 0
    const br = card.br || 0
    const tp = card.tp ?? 0

    ecgItems.push({
      canvas,
      ctx,
      visible: false,
      offset: Math.random() * 200,
      speed: hr > 0 ? (hr / 60) * 1.5 : 0.9,
      period: hr > 0 ? Math.max(60, Math.round((60 / hr) * 120)) : 120,
      rAmp: hr > 90 ? 0.46 : hr < 70 ? 0.30 : 0.38,
      hr,
      br,
      tp,
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
  item.offset += item.speed

  const step = 2

  // ----------------- 通道 1: 心率 / 心电 (ECG, 霓虹翠绿 #00ff88) -----------------
  const yEcg = h * 0.28
  const P = item.period
  ctx.beginPath()
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 1.4
  ctx.shadowBlur = 4
  ctx.shadowColor = '#00ff88'

  for (let x = 0; x < w; x += step) {
    let y = yEcg
    if (item.hr > 0) {
      const phase = (x + item.offset) % P
      if (phase > P * 0.32 && phase < P * 0.38) y -= 2.0
      else if (phase >= P * 0.38 && phase < P * 0.41) y += 1.8
      else if (phase >= P * 0.41 && phase < P * 0.46) y -= (h * 0.22) * (item.rAmp / 0.38)
      else if (phase >= P * 0.46 && phase < P * 0.50) y += h * 0.16
      else if (phase >= P * 0.55 && phase < P * 0.65) y -= 2.5
    } else {
      y += Math.sin((x + item.offset) * 0.08) * 0.4
    }

    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // ----------------- 通道 2: 呼吸 (RESP, 赛博青 #00f0ff) -----------------
  const yResp = h * 0.62
  const brRate = Math.max(6, Math.min(30, item.br || 16))
  const brPeriod = Math.max(80, Math.round((60 / brRate) * 42))
  ctx.beginPath()
  ctx.strokeStyle = '#00f0ff'
  ctx.lineWidth = 1.3
  ctx.shadowBlur = 4
  ctx.shadowColor = '#00f0ff'

  for (let x = 0; x < w; x += step) {
    let y = yResp
    if (item.br > 0) {
      const phaseResp = ((x + item.offset * 0.5) % brPeriod) / brPeriod
      const dyResp = Math.sin(phaseResp * Math.PI * 2) * (h * 0.13) + Math.sin(phaseResp * Math.PI * 4) * (h * 0.025)
      y -= dyResp
    } else {
      y += Math.sin((x + item.offset * 0.5) * 0.06) * 0.3
    }

    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // ----------------- 通道 3: 体温 (TEMP, 温暖琥珀 #ffb703) -----------------
  const yTemp = h * 0.86
  ctx.beginPath()
  ctx.strokeStyle = '#ffb703'
  ctx.lineWidth = 1.2
  ctx.shadowBlur = 3
  ctx.shadowColor = '#ffb703'

  for (let x = 0; x < w; x += step) {
    let y = yTemp
    if (item.tp > 0) {
      const phaseTemp = (x + item.offset * 0.18) * 0.04
      const dyTemp = Math.sin(phaseTemp) * 1.3 + Math.cos(phaseTemp * 0.6) * 0.8
      y -= dyTemp
    } else {
      y += Math.sin((x + item.offset * 0.2) * 0.05) * 0.3
    }

    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // ----------------- 示波光扫描同步亮点 -----------------
  const sweepDotX = (item.offset * 1.8) % w

  // ECG 扫描亮点
  ctx.beginPath()
  ctx.arc(sweepDotX, yEcg, 2.0, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#00ff88'
  ctx.shadowBlur = 6
  ctx.fill()

  // RESP 扫描亮点
  ctx.beginPath()
  ctx.arc(sweepDotX, yResp, 1.8, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#00f0ff'
  ctx.shadowBlur = 5
  ctx.fill()

  // TEMP 扫描亮点
  ctx.beginPath()
  ctx.arc(sweepDotX, yTemp, 1.6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#ffb703'
  ctx.shadowBlur = 4
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

function onCardClick(card: PatrolCard) {
  emit('navigate-profile', card.sn)
}

function onResize() {
  for (const item of ecgItems) {
    item.canvas.width = item.canvas.clientWidth || 240
    item.canvas.height = item.canvas.clientHeight || 38
  }
}

onMounted(async () => {
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
    <!-- Row 1：即时遥测统计、搜索与云端扫描入口 -->
    <div class="s2-toolbar-row1">
      <div class="s2-counter-echo" v-html="counterEchoText"></div>
      <div class="s2-search-box">
        <input type="text" v-model="searchKeyword" :placeholder="searchPlaceholder" />
      </div>
      <!-- 云端设备扫描入口：拉取云账号全部绑定设备与本地台账比对 -->
      <button
        class="s2-scan-btn"
        :disabled="scanLoading"
        @click="runCloudScan(true)"
      >
        {{ scanLoading ? '设备核查中…' : '📡 云端设备核查' }}
        <span v-if="scanScanned && scanStats.unregistered > 0" class="s2-scan-badge">{{ scanStats.unregistered }}</span>
      </button>
    </div>

    <!-- Row 2：在床/离床/离线三态筛选（基于 presenceOf 实算数量） -->
    <div class="s2-toolbar-row2">
      <div class="cyber-tabs">
        <div
          v-for="t in statusTabs"
          :key="t.key"
          class="cyber-tab"
          :class="{ active: statusFilter === t.key }"
          :style="t.key === 'offline' ? 'color:var(--txt-muted);border-color:rgba(148,163,184,0.3)' : ''"
          @click="statusFilter = t.key"
        >
          {{ t.label }} [{{ tabCount(t.key) }}]
        </div>
      </div>
    </div>
  </div>

  <!-- 主巡查卡片网格：参保长者档案 + 绑定设备 + 防骗核验 -->
  <div class="telemetry-pod-grid">
    <template v-if="displayCards.length > 0">
      <div
        v-for="c in displayCards"
        :key="c.sn"
        class="telemetry-pod"
        @click="onCardClick(c)"
      >
        <!-- 档案区：参保长者档案（字段结构保留，已确认字段显示真实值，未拿到的一律"未获取"） -->
        <div class="pod-head">
          <div class="pod-bed-id">
            <span
              style="display:inline-block;width:7px;height:7px;border-radius:50%;"
              :style="{ background: presenceDotColor(c) }"
            ></span>
            <span v-if="c.archive.elderName" class="pa-name" style="font-size:13px;">{{ c.archive.elderName }}</span>
            <span class="pod-bed-num" :title="c.sn">{{ c.sn }}</span>
          </div>
          <div class="pod-presence" :class="presenceCls(c)">
            {{ presenceText(c) }}
          </div>
        </div>

        <div class="pod-archive">
          <div class="pod-sec-title">参保长者档案</div>
          <div class="pod-archive-grid">
            <div class="pa-item">
              <span class="pa-label">姓名</span>
              <span :class="isMissing(c.archive.elderName) ? 'missing-val' : 'pa-val pa-name'" :title="isMissing(c.archive.elderName) ? MISSING_HINT : undefined">{{ archiveOrMissing(c.archive.elderName) }}</span>
            </div>
            <div class="pa-item">
              <span class="pa-label">年龄</span>
              <span :class="isMissing(c.archive.age) ? 'missing-val' : 'pa-val'" :title="isMissing(c.archive.age) ? MISSING_HINT : undefined">{{ archiveOrMissing(c.archive.age) }}</span>
            </div>
            <div class="pa-item">
              <span class="pa-label">失能认定等级</span>
              <span :class="isMissing(c.archive.disabilityLevel) ? 'missing-val' : 'pa-val'" :title="isMissing(c.archive.disabilityLevel) ? MISSING_HINT : undefined">{{ archiveOrMissing(c.archive.disabilityLevel) }}</span>
            </div>
            <div class="pa-item">
              <span class="pa-label">所在片区</span>
              <span class="pa-val">{{ c.district }}</span>
            </div>
            <div class="pa-item pa-wide">
              <span class="pa-label">待遇标准</span>
              <span :class="isMissing(c.archive.benefitStandard) ? 'missing-val' : 'pa-val'" :title="isMissing(c.archive.benefitStandard) ? MISSING_HINT : undefined">{{ archiveOrMissing(c.archive.benefitStandard) }}</span>
            </div>
          </div>
        </div>

        <!-- 设备区：绑定设备实时状态（在床/离床展示真实体征与采样时间，离线不展示任何数值） -->
        <div class="pod-device">
          <div class="pod-sec-title">绑定设备 · {{ c.model }}</div>
          <div
            class="pod-ecg-box"
            :title="c.presence === 'person' ? '心率·呼吸·体温 3项生理体征实时示波' : c.presence === 'empty' ? '设备在线 · 离床监测' : '设备离线'"
          >
            <template v-if="c.presence">
              <canvas class="pod-ecg-canvas" :ref="el => collectCanvas(el, c.sn)"></canvas>
              <div class="pod-ecg-legend">
                <span class="leg-item leg-hr">● 心率 ECG</span>
                <span class="leg-item leg-br">● 呼吸 RESP</span>
                <span class="leg-item leg-tp">● 体温 TEMP</span>
              </div>
            </template>
            <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:10px;color:var(--txt-muted);font-family:var(--font-mono)">○ 设备离线 · 暂无实时数据</div>
          </div>
          <div v-if="c.presence" class="pod-vitals-line">
            <span style="color:#00ff88">心率 {{ c.hr }} bpm</span> ·
            <span style="color:#00f0ff">呼吸 {{ c.br }} 次/分</span> ·
            <span style="color:#ffb703">体温 {{ c.tp !== null ? c.tp + ' ℃' : '--' }}</span> ·
            <span>更新 {{ c.sampleTime ? c.sampleTime.slice(11) : '--' }}</span>
          </div>
          <div v-else class="pod-vitals-line offline">设备离线 · 暂无实时数据</div>
          <div class="pod-net-line">网络通道 {{ c.network }}</div>
        </div>

        <!-- 防骗核验状态：只基于真实三态；服务打卡核验待医保局平台对接 -->
        <div class="pod-verify">
          <span class="verify-tag" :class="verifyCls(c)">{{ verifyText(c) }}</span>
          <span class="missing-tag" title="护理打卡数据完善中">🟡 服务打卡核验 · 完善中</span>
        </div>
      </div>
    </template>
    <div
      v-else
      style="grid-column: 1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; height:240px; color:var(--txt-muted); font-size:14px; gap:8px;"
    >
      <span style="font-size:28px;">🔍</span>
      <span>未检索到匹配的巡查监护单元，请尝试切换状态筛选或调整关键字</span>
    </div>
  </div>

  <!-- 云端设备扫描面板：云账号绑定设备与本地在册台账比对，amber 高亮未接入设备 -->
  <div v-if="scanOpen" class="s2-scan-overlay" @click.self="scanOpen = false">
    <div class="s2-scan-panel">
      <div class="s2-scan-head">
        <span class="s2-scan-title">📡 云端设备核查 · 云端绑定设备与在册清单比对</span>
        <button class="s2-scan-close" @click="scanOpen = false">✕</button>
      </div>
      <div v-if="scanLoading" class="s2-scan-state">正在核查云端设备清单…</div>
      <div v-else-if="scanError" class="s2-scan-state" style="color: var(--crimson);">
        云端设备核查失败：{{ scanError }}
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
            <span class="reg" :style="{ color: it.registered ? 'var(--cyan)' : 'var(--amber)' }">{{ it.registered ? '✓ 已在册' : '⚠ 未在册' }}</span>
          </div>
          <div v-if="!scanItems.length" class="s2-scan-state">云平台全部账号下未发现任何绑定设备</div>
        </div>
        <div class="s2-scan-foot">
          云端共 {{ scanStats.total }} 台 · 已在册 {{ scanStats.registered }} 台 · 未在册 {{ scanStats.unregistered }} 台 · 当前在线 {{ scanStats.online }} 台
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.s2-counter-echo :deep(b) {
  color: var(--cyan);
  font-family: var(--font-digit);
}

/* ======================= 卡片分区通用小节标题 ======================= */
.pod-sec-title {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--cyan);
  letter-spacing: 0.8px;
  margin-bottom: 5px;
  opacity: 0.85;
}

/* ======================= 档案区 ======================= */
.pod-archive {
  margin-top: 6px;
  padding: 7px 8px;
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.14);
  border-radius: 4px;
}

.pod-archive-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}

.pa-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 10.5px;
  min-width: 0;
}

.pa-item.pa-wide {
  grid-column: 1 / -1;
}

.pa-label {
  color: var(--txt-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  white-space: nowrap;
}

.pa-val {
  color: var(--txt-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 已建档的真实参保人姓名：高亮显示，与"未获取"缺失态明确区分 */
.pa-name {
  color: var(--mint);
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* ======================= 设备区 ======================= */
.pod-device {
  margin-top: 8px;
}

.pod-vitals-line {
  font-size: 9.5px;
  color: var(--txt-muted);
  font-family: var(--font-mono);
  margin-top: 4px;
}

.pod-vitals-line.offline {
  color: rgba(148, 163, 184, 0.6);
}

.pod-net-line {
  font-size: 9.5px;
  color: var(--txt-muted);
  font-family: var(--font-mono);
  margin-top: 2px;
}

/* ======================= 防骗核验状态标签 ======================= */
.pod-verify {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.verify-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.verify-tag.ok {
  color: var(--mint);
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.4);
}

.verify-tag.watch {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.verify-tag.bad {
  color: var(--crimson);
  background: rgba(255, 0, 85, 0.1);
  border: 1px solid rgba(255, 0, 85, 0.4);
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
