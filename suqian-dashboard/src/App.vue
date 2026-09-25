<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, provide, ref } from 'vue'

import ScreenPatrol from './views/ScreenPatrol.vue'
import ScreenOverview from './views/ScreenOverview.vue'
import ScreenTwin from './views/ScreenTwin.vue'
import ScreenProfile from './views/ScreenProfile.vue'
import ScreenNation from './views/ScreenNation.vue'
import ScreenLtci from './views/ScreenLtci.vue'
import { ORG_PROFILES } from './assets/orgData'
import { ANQIAO_DEVICES } from './assets/anqiaoDevices'
import { cloudGatewayHealth, liveDeviceCount, startDeviceTelemetryPolling, stopDeviceTelemetryPolling } from './api/deviceTelemetry'
import anqiaoLogoUrl from './assets/logo.png'

const SCREEN_IDS = ['screen-1', 'screen-0', 'screen-2', 'screen-3', 'screen-4', 'screen-5'] as const
type ScreenId = (typeof SCREEN_IDS)[number]

const SCREEN_NAME_MAP: Record<string, ScreenId> = {
  '': 'screen-1',
  overview: 'screen-1',
  twin: 'screen-0',
  patrol: 'screen-2',
  profile: 'screen-3',
  nation: 'screen-4',
  ltci: 'screen-5',
}

const currentScreen = ref<ScreenId>('screen-1')
// 默认画像对象：首批试点 3 台设备之一（ASH01086），机构演示患者 P00001 口径已随凯健移除
const selectedPatientId = ref<string>('ASH01086')

// 单一项目：宿迁医保局长护险首批测试项目（多机构切换与凯健演示数据已移除）
const currentOrgId = ref<string>('anqiao')
const currentOrg = ORG_PROFILES.anqiao

const viewportScale = ref(1)
provide('viewportScale', () => viewportScale.value)
const clockTime = ref('--:--:--')
const clockDate = ref('----/--/-- UTC+8')
// 实时在线台数（共享遥测 store 实算，5s 轮询刷新）
const anqiaoLiveCount = computed(() => liveDeviceCount())
// 顶栏只承载运行态与异常，不复述品牌/设备台账（品牌在左，台数在各屏 KPI）
const anqiaoTicker = computed(() => {
  if (!cloudGatewayHealth.healthy) {
    return cloudGatewayHealth.message
  }
  return '监测窗 20:00–次日 08:00 · 体征采集进行中'
})
const tickerText = computed(() => anqiaoTicker.value)

const effectiveStatusBadgeClass = computed(() => {
  if (!cloudGatewayHealth.healthy) return 'pulse-badge danger'
  return 'pulse-badge'
})

const effectiveStatusBadgeText = computed(() => {
  if (!cloudGatewayHealth.healthy) return '▲ 连接中断'
  return `在线 ${anqiaoLiveCount.value}/${ANQIAO_DEVICES.length}`
})
const tourActive = ref(false)
const tourProgress = ref(0)

function syncFromUrl() {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''
  if (hash.startsWith('#/console')) return

  const searchParams = new URLSearchParams(window.location.search)
  let hashQuery = ''
  const qIdx = hash.indexOf('?')
  if (qIdx >= 0) hashQuery = hash.slice(qIdx + 1)
  const hashParams = new URLSearchParams(hashQuery)

  const screenParam = searchParams.get('screen') || hashParams.get('screen')
  const screenHash = hash.replace(/^#\/?/, '').split('?')[0]
  const targetScreen = (screenParam ? SCREEN_NAME_MAP[screenParam] : undefined) || SCREEN_NAME_MAP[screenHash || '']
  if (targetScreen) {
    currentScreen.value = targetScreen
  }

  const patientParam = searchParams.get('patient') || hashParams.get('patient')
  if (patientParam) {
    selectedPatientId.value = patientParam
  } else if (selectedPatientId.value.startsWith('P')) {
    // 历史凯健患者 ID（P 开头）已废弃，回落到试点设备 SN
    selectedPatientId.value = 'ASH01086'
  }

  document.title = `${currentOrg.title} · 长护险智能监管平台`
}

function updateUrl() {
  if (typeof window === 'undefined') return
  if (window.location.hash.startsWith('#/console')) return
  const screenName = Object.entries(SCREEN_NAME_MAP).find(([k, v]) => v === currentScreen.value && !k.startsWith('screen-'))?.[0] || currentScreen.value
  const newHash = `#/${screenName}`
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash)
  }
}

function goToConsole() {
  location.hash = '#/console/dashboard'
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

onMounted(() => {
  syncFromUrl()
  window.addEventListener('hashchange', syncFromUrl)
  window.addEventListener('popstate', syncFromUrl)
  document.title = `${currentOrg.title} · 长护险智能监管平台`
  autoScaleViewport()
  window.addEventListener('resize', autoScaleViewport)
  window.addEventListener('orientationchange', autoScaleViewport)
  window.visualViewport?.addEventListener('resize', autoScaleViewport)
  scaleWatchTimer = window.setInterval(watchViewportScale, 500)
  tickClock()
  clockTimer = window.setInterval(tickClock, 1000)
  initParticleCanvas()
  tourRaf = requestAnimationFrame(tourTick)
  // 首批试点 3 台真实设备：全局实时遥测轮询（5s），供画像/巡查/孪生共享
  startDeviceTelemetryPolling(5_000)
})

onBeforeUnmount(() => {
  stopDeviceTelemetryPolling()
  window.removeEventListener('hashchange', syncFromUrl)
  window.removeEventListener('popstate', syncFromUrl)
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
      <div class="brand-logo-wrap" title="宿迁长护险智慧守护平台">
        <img :src="anqiaoLogoUrl" alt="宿迁长护险智慧守护平台" class="brand-logo-img" />
      </div>
      <div class="brand-text">
        <div class="brand-title-row">
          <h1>{{ currentOrg.title }}</h1>
          <span class="pilot-badge" title="宿迁市长期护理保险智慧守护平台">
            <span class="pilot-badge-icon">🌐</span>
            <span class="pilot-badge-text">宿迁长护险智慧守护</span>
          </span>
        </div>
        <div class="sub">{{ currentOrg.subTitle }}</div>
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

    <section id="screen-5" class="view-screen" :class="{ active: currentScreen === 'screen-5' }">
      <ScreenLtci :active="currentScreen === 'screen-5'" :org-id="currentOrgId" />
    </section>

  </main>

  <nav class="command-dock">
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-1' }" @click="onDockClick('screen-1')"><span>监管总览</span></button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-0' }" @click="onDockClick('screen-0')">
      <span>点位孪生</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-2' }" @click="onDockClick('screen-2')">
      <span>服务巡查</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-3' }" @click="onDockClick('screen-3')">
      <span>数字画像</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-4' }" @click="onDockClick('screen-4')">
      <span>全国态势</span>
    </button>
    <button class="dock-btn" :class="{ active: currentScreen === 'screen-5' }" @click="onDockClick('screen-5')">
      <span>反欺诈核验</span>
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

/* 试点标识徽章：固定展示，不可点击、无下拉箭头 */
.pilot-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(4, 18, 38, 0.92);
  border: 1px solid rgba(0, 240, 255, 0.45);
  color: #00f0ff;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 4px;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.22);
  white-space: nowrap;
  flex-shrink: 0;
  cursor: default;
  user-select: none;
}

.pilot-badge-icon {
  font-size: 13px;
  line-height: 1;
}

.pilot-badge-text {
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.console-entry-btn {
  background: rgba(0, 255, 136, 0.12) !important;
  border-color: rgba(0, 255, 136, 0.4) !important;
  color: #00ff88 !important;
  font-weight: bold;
}
.console-entry-btn:hover {
  background: rgba(0, 255, 136, 0.25) !important;
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
}
</style>
