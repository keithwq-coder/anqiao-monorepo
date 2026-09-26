<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import '../../styles/console.css'
import ConsoleLogin from './ConsoleLogin.vue'
import WorkspaceShell from './WorkspaceShell.vue'
import { clearSession, getSession, type SessionInfo } from '../../api/http'
import { onRealtime, startRealtime, stopRealtime } from '../../api/realtime'
import type { Alert } from '../../api/types'

// ---------- 会话 ----------
const session = ref<SessionInfo | null>(getSession())

function syncHashRoute() {
  const h = location.hash || ''
  if (!session.value && h.startsWith('#/console')) {
    if (window.history.replaceState) {
      window.history.replaceState(null, '', location.pathname + location.search)
    } else {
      location.hash = ''
    }
  }
}

function onLoginSuccess() {
  session.value = getSession()
  startRealtime()
  if (window.history.replaceState && (location.hash === '#/login' || location.hash === '#login')) {
    window.history.replaceState(null, '', location.pathname + location.search)
  }
}

function logout() {
  stopRealtime()
  clearSession()
  session.value = null
  if (window.history.replaceState) {
    window.history.replaceState(null, '', location.pathname + location.search)
  } else {
    location.hash = ''
  }
}

// ---------- 实时通道：新告警 toast ----------
const toast = ref<{ title: string; sub: string } | null>(null)
let toastTimer: number | null = null
const offFns: Array<() => void> = []

function showToast(title: string, sub: string) {
  toast.value = { title, sub }
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 6000)
}

onMounted(() => {
  syncHashRoute()
  window.addEventListener('hashchange', syncHashRoute)
  offFns.push(
    onRealtime('alert', (a: Alert) => {
      showToast(`新告警 · ${a.title}`, `${a.bed_id} · ${a.detail}`)
    }),
  )
  if (session.value) startRealtime()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncHashRoute)
  offFns.forEach((f) => f())
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  stopRealtime()
})
</script>

<template>
  <div class="console-root">
    <ConsoleLogin v-if="!session" @success="onLoginSuccess" />
    <WorkspaceShell v-else :session="session" @logout="logout" />

    <!-- 全局实时告警浮窗 -->
    <div v-if="toast" class="console-toast" @click="toast = null">
      <div class="console-toast-title">{{ toast.title }}</div>
      <div class="console-toast-sub">{{ toast.sub }}</div>
    </div>
  </div>
</template>
