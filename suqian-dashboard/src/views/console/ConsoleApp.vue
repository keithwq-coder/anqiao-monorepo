<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import '../../styles/console.css'
import ConsoleLogin from './ConsoleLogin.vue'
import ConsoleDashboard from './ConsoleDashboard.vue'
import ConsoleAlerts from './ConsoleAlerts.vue'
import ConsolePatients from './ConsolePatients.vue'
import ConsolePatientDetail from './ConsolePatientDetail.vue'
import ConsoleNation from './ConsoleNation.vue'
import ConsoleDevices from './ConsoleDevices.vue'
import { clearSession, getSession, getToken, setSession, type SessionInfo } from '../../api/http'
import { onRealtime, startRealtime, stopRealtime } from '../../api/realtime'
import anqiaoLogoUrl from '../../assets/logo.png'

import type { Alert } from '../../api/types'

// ---------- 会话 ----------
const session = ref<SessionInfo | null>(getSession())

function onLoginSuccess() {
  session.value = getSession()
  startRealtime()
}

function logout() {
  stopRealtime()
  clearSession()
  session.value = null
}

// ---------- hash 子路由 ----------
type ConsoleRoute =
  | { view: 'default' }
  | { view: 'dashboard' }
  | { view: 'nation' }
  | { view: 'devices' }
  | { view: 'alerts' }
  | { view: 'patients' }
  | { view: 'patient'; id: string }

function parseHash(): ConsoleRoute {
  const h = location.hash
  const detail = /^#\/console\/patients\/([^/?#]+)/.exec(h)
  if (detail) return { view: 'patient', id: decodeURIComponent(detail[1]) }
  if (h.startsWith('#/console/patients')) return { view: 'patients' }
  if (h.startsWith('#/console/alerts')) return { view: 'alerts' }
  if (h.startsWith('#/console/nation')) return { view: 'nation' }
  if (h.startsWith('#/console/devices')) return { view: 'devices' }
  if (h.startsWith('#/console/dashboard')) return { view: 'dashboard' }
  return { view: 'default' }
}

const route = ref<ConsoleRoute>(parseHash())

const isVendor = computed(() => session.value?.tenant.kind === 'vendor')

// 默认首页：厂商租户 → 全国地图；护理院租户 → 值班工作台
const view = computed(() => {
  if (route.value.view === 'default') return isVendor.value ? 'nation' : 'dashboard'
  return route.value.view
})

function onHashChange() {
  route.value = parseHash()
}

function goto(path: string) {
  location.hash = path
}

const NAV_NURSING = [
  { view: 'dashboard', path: '#/console/dashboard', label: '值班工作台', icon: '◧' },
  { view: 'alerts', path: '#/console/alerts', label: '告警中心', icon: '⚠' },
  { view: 'patients', path: '#/console/patients', label: '长者监护', icon: '♥' },
] as const

const NAV_VENDOR = [
  { view: 'nation', path: '#/console/nation', label: '全国地图', icon: '◎' },
  { view: 'devices', path: '#/console/devices', label: '设备管理', icon: '▦' },
  { view: 'alerts', path: '#/console/alerts', label: '告警中心', icon: '⚠' },
] as const

const navItems = computed(() => (isVendor.value ? NAV_VENDOR : NAV_NURSING))

const ALL_ORGS = [
  { id: 'anqiao', name: '中科安樵·自营运营', kind: 'vendor' },
  { id: 'kaijian', name: '凯健国际护理院', kind: 'nursing_home' },
] as const

const tenantOptions = computed(() => {
  if (!session.value) return []
  return ALL_ORGS
})

function switchTenant(tenantId: string) {
  if (!session.value) return
  const target = ALL_ORGS.find((t) => t.id === tenantId)
  if (!target) return
  session.value = {
    ...session.value,
    tenant: { tenant_id: target.id, name: target.name, kind: target.kind as any },
  }
  setSession(getToken() || 'anqiao-tenant-switch-token', { staff: session.value.staff, tenant: session.value.tenant })

  if (target.kind === 'vendor') {
    goto('#/console/nation')
  } else {
    goto('#/console/dashboard')
  }
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: '值班工作台',
  nation: '全国地图',
  devices: '设备管理',
  alerts: '告警中心',
  patients: '长者监护',
  patient: '长者详情',
}

const pageTitle = computed(() => PAGE_TITLES[view.value] ?? '')

const patientId = computed(() => (route.value.view === 'patient' ? route.value.id : ''))

function navActive(v: string): boolean {
  if (v === 'patients') return view.value === 'patients' || view.value === 'patient'
  return view.value === v
}

// ---------- 实时通道：连接状态 + 新告警 toast ----------
const liveConnected = ref(false)
const toast = ref<{ title: string; sub: string } | null>(null)
let toastTimer: number | null = null
const offFns: Array<() => void> = []

function showToast(title: string, sub: string) {
  toast.value = { title, sub }
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 6000)
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
  offFns.push(
    onRealtime('alert', (a: Alert) => {
      const target = isVendor.value ? `${a.bed_id} 设备` : `${a.bed_id} 床位`
      showToast(`新告警 · ${a.title}`, `${target} · ${a.detail}`)
    }),
  )
  offFns.push(onRealtime('open', () => (liveConnected.value = true)))
  offFns.push(onRealtime('close', () => (liveConnected.value = false)))
  if (session.value) startRealtime()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  offFns.forEach((f) => f())
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  stopRealtime()
})
</script>

<template>
  <div class="console-root">
    <ConsoleLogin v-if="!session" @success="onLoginSuccess" />

    <template v-else>
      <aside class="console-sidebar">
        <div class="console-sidebar-brand">
          <img :src="anqiaoLogoUrl" alt="中科安樵" class="console-sidebar-logo" />
          <div class="name">
            安守护
            <small>运营管理平台</small>
          </div>
        </div>
        <nav class="console-side-nav">
          <button
            v-for="item in navItems"
            :key="item.view"
            class="console-side-item"
            :class="{ active: navActive(item.view) }"
            @click="goto(item.path)"
          >
            <span class="icon">{{ item.icon }}</span>
            {{ item.label }}
          </button>
        </nav>
        <div class="console-tenant-card">
          <div class="t-name">{{ session.tenant.name }}</div>
          <div class="t-sub">
            {{ session.tenant.kind === 'vendor' ? '厂商运营视图' : '护理院视图' }} · {{ session.tenant.tenant_id }}
          </div>
          <!-- 多租户切换器 -->
          <select
            v-if="tenantOptions.length > 1"
            class="console-select"
            style="margin-top: 8px; width: 100%"
            :value="session.tenant.tenant_id"
            @change="switchTenant(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="t in tenantOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
      </aside>

      <div class="console-body">
        <header class="console-topbar">
          <div class="console-topbar-title">{{ pageTitle }}</div>
          <div class="spacer"></div>
          <div class="console-live" :class="{ off: !liveConnected }">
            <span class="dot"></span>
            {{ liveConnected ? '实时已连接' : '实时重连中' }}
          </div>
          <div class="staff">{{ session.staff.name }}</div>
          <button class="console-btn console-btn-ghost console-btn-sm" @click="logout">退出登录</button>
        </header>

        <main class="console-main">
          <ConsoleDashboard v-if="view === 'dashboard'" />
          <ConsoleNation v-else-if="view === 'nation'" />
          <ConsoleDevices v-else-if="view === 'devices'" />
          <ConsoleAlerts v-else-if="view === 'alerts'" :vendor="isVendor" />
          <ConsolePatients v-else-if="view === 'patients'" />
          <ConsolePatientDetail v-else-if="view === 'patient'" :key="patientId" :patient-id="patientId" />
        </main>
      </div>

      <!-- 新告警实时提醒 -->
      <div v-if="toast" class="console-toast" @click="((toast = null), goto('#/console/alerts'))">
        <div class="console-toast-title">{{ toast.title }}</div>
        <div class="console-toast-sub">{{ toast.sub }}</div>
      </div>
    </template>
  </div>
</template>
