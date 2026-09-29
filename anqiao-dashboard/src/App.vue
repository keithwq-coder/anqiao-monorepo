<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, provide, ref } from 'vue'

import ScreenPatrol from './views/ScreenPatrol.vue'
import ScreenOverview from './views/ScreenOverview.vue'
import ScreenTwin from './views/ScreenTwin.vue'
import ScreenProfile from './views/ScreenProfile.vue'
import ScreenNation from './views/ScreenNation.vue'
import ScreenLtci from './views/ScreenLtci.vue'
import { ORG_PROFILES, PROJECT } from './projects'
import { ANQIAO_DEVICES } from './projects'
import { cloudGatewayHealth, liveDeviceCount, startDeviceTelemetryPolling, stopDeviceTelemetryPolling } from './api/deviceTelemetry'
import { ensureScreenSession } from './api/http'
import anqiaoLogoUrl from './assets/logo.png'

// 屏幕集合按项目配置裁剪：suqian 才有第六屏长护险监管（INTEGRATION-SPEC §5）
const BASE_SCREENS = ['screen-1', 'screen-0', 'screen-2', 'screen-3', 'screen-4'] as const
const SCREEN_IDS = (
  PROJECT.ltciScreen ? [...BASE_SCREENS, 'screen-5'] : [...BASE_SCREENS]
) as readonly string[] as readonly ('screen-1' | 'screen-0' | 'screen-2' | 'screen-3' | 'screen-4' | 'screen-5')[]
type ScreenId = (typeof SCREEN_IDS)[number]

const SCREEN_NAME_MAP: Record<string, ScreenId> = {
  '': 'screen-1',
  overview: 'screen-1',
  twin: 'screen-0',
  patrol: 'screen-2',
  profile: 'screen-3',
  nation: 'screen-4',
  ...(PROJECT.ltciScreen ? { ltci: 'screen-5' as ScreenId } : {}),
}

const currentScreen = ref<ScreenId>('screen-1')
const selectedPatientId = ref<string>('ASH01146')

const ORGS = [
  {
    id: 'anqiao',
    name: '中科安樵·居家守护运营',
    short: '中科安樵',
    icon: '🌐',
    badge: '47台在册',
    title: '中科安樵·智慧养老生命体征监控中心',
    sub: 'ANQIAO HOME GUARDIAN IOT · TELEMETRY OPERATIONS CENTER',
    coords: 'GRID: 31.2990° N, 120.5853° E · SUZHOU CORE · 47 SENSORS ACTIVE',
    // 跑马灯实时在线台数由共享遥测 store 实算（见 anqiaoTicker），此静态串仅作兜底
    ticker: '在册感知设备 47 台 · 专网全链路畅通 · 24小时守护中',
  },
  {
    id: 'kaijian',
    name: '凯健国际护理院',
    short: '上海凯健',
    icon: '🏥',
    badge: '旗舰院区',
    title: '凯健国际护理院智慧孪生中心',
    sub: 'KAIJIAN CARE · 100-INCH EXECUTIVE BIO-TWIN v6.0',
    coords: 'GRID: 31.2304° N, 121.4737° E · SHANGHAI KAIJIAN SECTOR · ZERO ACCIDENTS',
    ticker: '在护长者 87 位 · 在网终端 139 台 · 医护全勤值守 · 守护运行正常',
  },
] as const

const currentOrgId = ref<string>('anqiao')
// 单机构项目（multiOrg=false，如宿迁试点）：机构身份以 projects 包 ORG_PROFILES 为唯一权威源，
// 不复用上方 kaijian 演示项目的静态 ORGS，避免跨项目串号
const singleOrg = computed(() => {
  const p = ORG_PROFILES.anqiao
  return { id: 'anqiao', name: p.name, short: p.name, icon: '🌐', badge: '', title: p.title, sub: p.subTitle, coords: p.coords, ticker: p.ticker }
})
const currentOrg = computed(() =>
  PROJECT.multiOrg ? (ORGS.find((o) => o.id === currentOrgId.value) ?? ORGS[0]) : singleOrg.value
)

const viewportScale = ref(1)
provide('viewportScale', () => viewportScale.value)
const clockTime = ref('--:--:--')
const clockDate = ref('----/--/-- UTC+8')
const alarmSimulated = ref(false)
// 中科安樵实时在线台数（共享遥测 store 实算，5s 轮询刷新）；跑马灯/机构徽标对 anqiao 一律走实算，不用静态文本
const anqiaoLiveCount = computed(() => liveDeviceCount())
const anqiaoTicker = computed(() => {
  if (!cloudGatewayHealth.healthy) {
    return `⚠️ ${cloudGatewayHealth.message} · 实时在线 ${anqiaoLiveCount.value}/${ANQIAO_DEVICES.length} 台`
  }
  return `在册感知设备 ${ANQIAO_DEVICES.length} 台 · 实时在线 ${anqiaoLiveCount.value} 台 · 专网全链路畅通 · 24小时守护中`
})
const anqiaoBadge = computed(() => `${ANQIAO_DEVICES.length}台在册 · ${anqiaoLiveCount.value}台在线`)
// 告警演示时跑马灯被临时覆写；其余时刻 anqiao 走实时遥测文案，其他机构走静态 ticker
const tickerOverride = ref<string | null>(null)
const tickerText = computed(() => tickerOverride.value ?? (currentOrgId.value === 'anqiao' ? anqiaoTicker.value : currentOrg.value.ticker))

const effectiveStatusBadgeClass = computed(() => {
  if (alarmSimulated.value) return 'pulse-badge danger'
  if (currentOrgId.value === 'anqiao' && !cloudGatewayHealth.healthy) return 'pulse-badge danger'
  return 'pulse-badge'
})

const effectiveStatusBadgeText = computed(() => {
  if (alarmSimulated.value) return '▲ CRITICAL ALARM'
  if (currentOrgId.value === 'anqiao' && !cloudGatewayHealth.healthy) return '▲ 遥测失联'
  return '● 实时在线'
})
const tourActive = ref(false)
const tourProgress = ref(0)

function syncFromUrl() {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''

  const searchParams = new URLSearchParams(window.location.search)
  let hashQuery = ''
  const qIdx = hash.indexOf('?')
  if (qIdx >= 0) hashQuery = hash.slice(qIdx + 1)
  const hashParams = new URLSearchParams(hashQuery)

  const orgParam = searchParams.get('org') || hashParams.get('org')
  if (PROJECT.multiOrg && orgParam && ORGS.some((o) => o.id === orgParam)) {
    currentOrgId.value = orgParam
  }

  const screenParam = searchParams.get('screen') || hashParams.get('screen')
  const screenHash = hash.replace(/^#\/?/, '').split('?')[0]
  if (screenHash === 'console') {
    // 兼容历史脏路由或书签：大屏无 console 路由，规范化回显默认首页
    currentScreen.value = 'screen-1'
    updateUrl()
  } else {
    const targetScreen = (screenParam ? SCREEN_NAME_MAP[screenParam] : undefined) || SCREEN_NAME_MAP[screenHash || '']
    if (targetScreen) {
      currentScreen.value = targetScreen
    }
  }

  const patientParam = searchParams.get('patient') || hashParams.get('patient')
  if (patientParam) {
    selectedPatientId.value = patientParam
  } else if (currentOrgId.value === 'anqiao' && selectedPatientId.value.startsWith('P')) {
    selectedPatientId.value = 'ASH01146'
  } else if (currentOrgId.value === 'kaijian' && !selectedPatientId.value.startsWith('P')) {
    selectedPatientId.value = 'P00001'
  }

  tickerOverride.value = null
  document.title = currentOrg.value.title === PROJECT.projectTitle
    ? currentOrg.value.title
    : `${PROJECT.projectTitle} · ${currentOrg.value.title}`
}

function updateUrl() {
  if (typeof window === 'undefined') return
  const screenName = Object.entries(SCREEN_NAME_MAP).find(([k, v]) => v === currentScreen.value && !k.startsWith('screen-'))?.[0] || currentScreen.value
  const newHash = `#/${screenName}?org=${currentOrgId.value}`
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash)
  }
}

function onOrgChange() {
  tickerOverride.value = null
  document.title = currentOrg.value.title === PROJECT.projectTitle
    ? currentOrg.value.title
    : `${PROJECT.projectTitle} · ${currentOrg.value.title}`
  // 画像 ID 口径：机构类（凯健）为患者 ID；居家类（中科安樵）为设备 SN
  selectedPatientId.value = currentOrgId.value === 'anqiao' ? 'ASH01146' : 'P00001'
  updateUrl()
}

function selectOrg(orgId: string) {
  currentOrgId.value = orgId
  tickerOverride.value = null
  document.title = currentOrg.value.title === PROJECT.projectTitle
    ? currentOrg.value.title
    : `${PROJECT.projectTitle} · ${currentOrg.value.title}`
  selectedPatientId.value = orgId === 'anqiao' ? 'ASH01146' : 'P00001'
  updateUrl()
}

const orgMenuOpen = ref(false)
function toggleOrgMenu() {
  orgMenuOpen.value = !orgMenuOpen.value
}
function selectOrgItem(orgId: string) {
  selectOrg(orgId)
  orgMenuOpen.value = false
}
function closeOrgMenu() {
  orgMenuOpen.value = false
}

let clockTimer = 0
let tourStartTime = 0
let tourRaf = 0
const TOUR_INTERVAL = 14000
const circumference = 56.5

function switchScreen(targetId: ScreenId) {
  currentScreen.value = targetId
  tourStartTime = performance.now()
  updateUrl()
}

function onDockClick(id: ScreenId) {
  switchScreen(id)
}

function onSelectPatient(patientId: string) {
  selectedPatientId.value = patientId
  switchScreen('screen-3')
}


function toggleTour() {
  tourActive.value = !tourActive.value
  if (tourActive.value) tourStartTime = performance.now()
  else tourProgress.value = circumference
}

function tourTick(now: number) {
  if (tourActive.value) {
    const elapsed = now - tourStartTime
    const progress = Math.min(elapsed / TOUR_INTERVAL, 1)
    tourProgress.value = circumference * (1 - progress)
    if (elapsed >= TOUR_INTERVAL) {
      const idx = SCREEN_IDS.indexOf(currentScreen.value)
      switchScreen(SCREEN_IDS[(idx + 1) % SCREEN_IDS.length])
    }
  }
  tourRaf = requestAnimationFrame(tourTick)
}

function tickClock() {
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  clockTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  clockDate.value = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} 星期${'日一二三四五六'[now.getDay()]} UTC+8`
}

function toggleAlarmSim() {
  alarmSimulated.value = !alarmSimulated.value
  if (alarmSimulated.value) {
    tickerOverride.value =
      currentOrgId.value === 'anqiao'
        ? '【设备告警】太湖科创中心·903 · ASH01146 数据采集中断 · 运营中心已复核闭环'
        : '【紧急告警】404 卫浴 孙* 卫生间姿态骤降预警 · 护士李晓芳 28s 到场处置闭环！'
  } else {
    tickerOverride.value = null
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => alert('全屏拦截: ' + err.message))
  } else {
    document.exitFullscreen()
  }
}

function viewportSize(): { w: number; h: number } {
  const de = document.documentElement
  const vv = window.visualViewport
  const w = Math.min(de.clientWidth || Infinity, window.innerWidth || Infinity, vv?.width || Infinity)
  const h = Math.min(de.clientHeight || Infinity, window.innerHeight || Infinity, vv?.height || Infinity)
  return { w: Number.isFinite(w) ? w : 1920, h: Number.isFinite(h) ? h : 1080 }
}

const wrapperStyle = ref<Record<string, string>>({})

// 全端自适应：以 1920×1080 为设计基准，任意屏幕尺寸/分辨率/宽高比下都按
// min(宽比, 高比) 等比缩放（contain，完整可见不裁切），水平+垂直居中；
// 宽高比非 16:9 时两侧/上下留出深色背景区，由 body 底色填充。
function autoScaleViewport() {
  const { w, h } = viewportSize()
  const scale = Math.min(w / 1920, h / 1080)
  viewportScale.value = scale
  wrapperStyle.value = {
    transformOrigin: 'top left',
    transform: `translate(${(w - 1920 * scale) / 2}px, ${(h - 1080 * scale) / 2}px) scale(${scale})`,
  }
}

let scaleWatchTimer = 0
function watchViewportScale() {
  autoScaleViewport()
}

function initParticleCanvas() {
  const canvas = document.getElementById('canvas-bg') as HTMLCanvasElement | null
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width = 1920
  const h = canvas.height = 1080
  const particles: Particle[] = []
  const COUNT = 55

  class Particle {
    x = Math.random() * w
    y = Math.random() * h
    vx = (Math.random() - 0.5) * 0.45
    vy = (Math.random() - 0.5) * 0.45
    r = Math.random() * 1.8 + 0.8
    alpha = Math.random() * 0.5 + 0.25
    update() {
      this.x += this.vx; this.y += this.vy
      if (this.x < 0) this.x = w; if (this.x > w) this.x = 0
      if (this.y < 0) this.y = h; if (this.y > h) this.y = 0
    }
    draw() {
      ctx!.beginPath()
      ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2)
      ctx!.fillStyle = `rgba(0, 240, 255, ${this.alpha})`
      ctx!.fill()
    }
  }

  for (let i = 0; i < COUNT; i++) particles.push(new Particle())

  let raf = 0
  function loop() {
    ctx!.clearRect(0, 0, w, h)
    ctx!.shadowBlur = 0
    for (let i = 0; i < particles.length; i++) {
      particles[i].update()
      particles[i].draw()
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 140) {
          ctx!.beginPath()
          ctx!.moveTo(particles[i].x, particles[i].y)
          ctx!.lineTo(particles[j].x, particles[j].y)
          ctx!.strokeStyle = `rgba(0, 240, 255, ${(1 - dist / 140) * 0.18})`
          ctx!.lineWidth = 0.9
          ctx!.stroke()
        }
      }
    }
    raf = requestAnimationFrame(loop)
  }
  loop()
  canvasCleanup = () => cancelAnimationFrame(raf)
}

let canvasCleanup: (() => void) | null = null

onMounted(async () => {
  ensureScreenSession().catch(() => null)
  syncFromUrl()
  window.addEventListener('hashchange', syncFromUrl)
  window.addEventListener('popstate', syncFromUrl)
  window.addEventListener('click', closeOrgMenu)
  document.title = currentOrg.value.title === PROJECT.projectTitle
    ? currentOrg.value.title
    : `${PROJECT.projectTitle} · ${currentOrg.value.title}`
  autoScaleViewport()
  window.addEventListener('resize', autoScaleViewport)
  window.addEventListener('orientationchange', autoScaleViewport)
  window.visualViewport?.addEventListener('resize', autoScaleViewport)
  scaleWatchTimer = window.setInterval(watchViewportScale, 500)
  tickClock()
  clockTimer = window.setInterval(tickClock, 1000)
  initParticleCanvas()
  tourRaf = requestAnimationFrame(tourTick)
  // 中科安樵全量在册真实设备：全局实时遥测轮询（5s，匹配实时窗口 90s 口径），供画像/巡查/孪生共享
  startDeviceTelemetryPolling(5_000)
})

onBeforeUnmount(() => {
  stopDeviceTelemetryPolling()
  window.removeEventListener('hashchange', syncFromUrl)
  window.removeEventListener('popstate', syncFromUrl)
  window.removeEventListener('click', closeOrgMenu)
  window.removeEventListener('resize', autoScaleViewport)
  window.removeEventListener('orientationchange', autoScaleViewport)
  window.visualViewport?.removeEventListener('resize', autoScaleViewport)
  clearInterval(clockTimer)
  clearInterval(scaleWatchTimer)
  cancelAnimationFrame(tourRaf)
  if (canvasCleanup) canvasCleanup()
})
</script>

<template>
<div id="scale-wrapper" :style="wrapperStyle">

  <canvas id="canvas-bg"></canvas>
  <div class="bg-grid-3d"></div>
  <div class="bg-scanlines"></div>
  <div class="bg-radar-sweep"></div>

  <header class="header-bridge">
    <div class="brand-zone">
      <div class="brand-logo-wrap" title="中科安樵 · 智慧物联">
        <img :src="anqiaoLogoUrl" alt="中科安樵 ANQIAO" class="brand-logo-img" />
      </div>
      <div class="brand-text">
        <div class="brand-title-row">
          <h1>{{ currentOrg.title }}</h1>
          <div v-if="PROJECT.multiOrg" class="header-org-dropdown-wrap" @click.stop>
            <button class="header-org-trigger" @click="toggleOrgMenu" :title="'切换运营机构（当前：' + currentOrg.name + '）'">
              <span class="org-icon">{{ currentOrg.icon }}</span>
              <span class="org-name">{{ currentOrg.short }}</span>
              <span class="org-arrow" :class="{ open: orgMenuOpen }">▾</span>
            </button>
            <div v-if="orgMenuOpen" class="header-org-menu">
              <div
                v-for="org in ORGS"
                :key="org.id"
                class="header-org-menu-item"
                :class="{ active: currentOrgId === org.id }"
                @click="selectOrgItem(org.id)"
              >
                <span class="item-icon">{{ org.icon }}</span>
                <span class="item-name">{{ org.name }}</span>
                <span class="item-badge">{{ org.id === 'anqiao' ? anqiaoBadge : org.badge }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="sub">{{ currentOrg.sub }}</div>
      </div>
    </div>

    <div class="center-crest">
      <div class="crest-ticker">
        <span :class="effectiveStatusBadgeClass">{{ effectiveStatusBadgeText }}</span>
        <span class="ticker-message">{{ tickerText }}</span>
      </div>
    </div>

    <div class="telemetry-zone">
      <div class="hud-actions">
        <button class="hud-btn" title="全屏显示" @click="toggleFullscreen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          全屏
        </button>
      </div>

      <div class="atomic-clock">
        <div class="atomic-time">{{ clockTime }}</div>
        <div class="atomic-date">{{ clockDate }}</div>
      </div>
    </div>
  </header>

  <main class="viewport-container">

    <section id="screen-1" class="view-screen" :class="{ active: currentScreen === 'screen-1' }">
      <ScreenOverview :active="currentScreen === 'screen-1'" :org-id="currentOrgId" @select-patient="onSelectPatient" />
    </section>

    <section id="screen-0" class="view-screen" :class="{ active: currentScreen === 'screen-0' }">
      <ScreenTwin :active="currentScreen === 'screen-0'" :org-id="currentOrgId" @select-patient="onSelectPatient" />
    </section>

    <section id="screen-2" class="view-screen" :class="{ active: currentScreen === 'screen-2' }">
      <ScreenPatrol :active="currentScreen === 'screen-2'" :org-id="currentOrgId" @navigate-profile="onSelectPatient" />
    </section>

    <section id="screen-3" class="view-screen" :class="{ active: currentScreen === 'screen-3' }">
      <ScreenProfile :active="currentScreen === 'screen-3'" :patient-id="selectedPatientId" :org-id="currentOrgId" />
    </section>

    <section id="screen-4" class="view-screen" :class="{ active: currentScreen === 'screen-4' }">
      <ScreenNation :active="currentScreen === 'screen-4'" :org-id="currentOrgId" />
    </section>

    <section id="screen-5" v-if="PROJECT.ltciScreen" class="view-screen" :class="{ active: currentScreen === 'screen-5' }">
      <ScreenLtci :active="currentScreen === 'screen-5'" :org-id="currentOrgId" />
    </section>

  </main>

  <nav class="command-dock">
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-1' }" @click="onDockClick('screen-1')"><span>全域态势</span></button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-0' }" @click="onDockClick('screen-0')">
      <span>{{ ORG_PROFILES[currentOrgId]?.kind === 'home' ? '设备孪生' : '空间孪生' }}</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-2' }" @click="onDockClick('screen-2')">
      <span>管理巡查</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-3' }" @click="onDockClick('screen-3')">
      <span>数字画像</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-4' }" @click="onDockClick('screen-4')">
      <span>{{ currentOrgId === 'anqiao' ? '全国态势' : '院区分布' }}</span>
    </button>
    <button v-if="PROJECT.ltciScreen" class="dock-btn" :class="{ active: currentScreen === 'screen-5' }" @click="onDockClick('screen-5')">
      <span>长护险监管</span>
    </button>
    <div class="auto-tour-toggle" title="点击切换大屏自动巡航轮播" @click="toggleTour">
      <div class="countdown-ring">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(0, 240, 255, 0.15)" stroke-width="2.5"></circle>
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-dasharray="56.5" :stroke-dashoffset="tourActive ? tourProgress : circumference" id="tour-ring-progress"></circle>
        </svg>
      </div>
      <span class="tour-label">巡航: {{ tourActive ? '开' : '关' }}</span>
    </div>
  </nav>
</div>
</template>

<style scoped>
.brand-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.header-org-dropdown-wrap {
  position: relative;
  display: inline-block;
  z-index: 1000;
  flex-shrink: 0;
}

.header-org-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(4, 18, 38, 0.92);
  border: 1px solid rgba(0, 240, 255, 0.45);
  color: #00f0ff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.22);
  transition: all 0.2s ease;
  transform: translateZ(0);
  white-space: nowrap;
  flex-shrink: 0;
}

.header-org-trigger:hover {
  border-color: #00ff88;
  color: #00ff88;
  background: rgba(0, 240, 255, 0.12);
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
}

.org-icon {
  font-size: 13px;
  line-height: 1;
}

.org-name {
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.org-arrow {
  font-size: 10px;
  color: rgba(0, 240, 255, 0.7);
  transition: transform 0.2s ease;
}

.org-arrow.open {
  transform: rotate(180deg);
  color: #00ff88;
}

.header-org-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 230px;
  background: rgba(4, 16, 32, 0.96);
  border: 1px solid rgba(0, 240, 255, 0.45);
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.25);
  backdrop-filter: blur(12px);
  padding: 6px;
  z-index: 2500;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-org-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.header-org-menu-item:hover {
  background: rgba(0, 240, 255, 0.12);
  color: #fff;
  transform: translateX(2px);
}

.header-org-menu-item.active {
  background: linear-gradient(90deg, rgba(0, 240, 255, 0.22) 0%, rgba(0, 255, 136, 0.12) 100%);
  color: #00f0ff;
  font-weight: 700;
  border-left: 3px solid #00f0ff;
}

.item-icon {
  font-size: 13px;
  line-height: 1;
}

.item-name {
  flex: 1;
}

.item-badge {
  font-size: 10px;
  font-family: var(--font-digit);
  color: var(--mint);
  background: rgba(0, 255, 136, 0.12);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid rgba(0, 255, 136, 0.3);
  letter-spacing: 0.3px;
}
</style>

