<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { claimAlert, getAlerts, getOverview, getPatients, getShift } from '../../api/client'
import { onRealtime } from '../../api/realtime'
import { fmtDuration, fmtTime, slaElapsedMs, slaOverdue, SLA_TARGET_MIN, TYPE_LABELS } from './labels'
import ConsoleHandleModal from './ConsoleHandleModal.vue'
import type { Alert, Overview, Patient, ShiftInfo } from '../../api/types'

const overview = ref<Overview | null>(null)
const todos = ref<Alert[] | null>(null)
const handledToday = ref<Alert[]>([])
const shift = ref<ShiftInfo | null>(null)
const focusPatients = ref<Patient[] | null>(null)
const loadError = ref('')
const claimingId = ref<string | null>(null)
const handlingAlert = ref<Alert | null>(null)

// SLA 计时心跳（1s）
const nowTs = ref(Date.now())
let tickTimer: number | null = null

function sortTodos(list: Alert[]): Alert[] {
  return [...list].sort((a, b) => a.level - b.level || (a.occurred_at < b.occurred_at ? -1 : 1))
}

async function loadAll() {
  loadError.value = ''
  try {
    const [ov, triggered, handling, handled, sh, abnormal] = await Promise.all([
      getOverview(),
      getAlerts({ status: 'triggered', page_size: 100 }),
      getAlerts({ status: 'handling', page_size: 100 }),
      getAlerts({ status: 'handled', page_size: 100 }),
      getShift(),
      getPatients({ status: 'abnormal', page_size: 20 }),
    ])
    overview.value = ov
    todos.value = sortTodos([...triggered.list, ...handling.list])
    handledToday.value = handled.list
    shift.value = sh
    focusPatients.value = abnormal.list
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  }
}

// ---------- 今日概览 KPI ----------
const closeRate = computed(() => {
  const ov = overview.value
  if (!ov || ov.alerts_today === 0) return null
  return Math.round((ov.alerts_closed_today / ov.alerts_today) * 100)
})

const avgResponse = computed(() => {
  const list = handledToday.value.filter((a) => a.handled_at)
  if (list.length === 0) return null
  const total = list.reduce((s, a) => s + (Date.parse(a.handled_at!) - Date.parse(a.occurred_at)), 0)
  return fmtDuration(total / list.length)
})

// ---------- 工作流操作：接单 / 处置（工作台内直接完成，不跳页） ----------
async function claim(a: Alert) {
  if (claimingId.value) return
  claimingId.value = a.alert_id
  try {
    await claimAlert(a.alert_id)
    await loadAll()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '接单失败，请稍后重试'
  } finally {
    claimingId.value = null
  }
}

function openHandle(a: Alert) {
  handlingAlert.value = a
}

async function onHandled() {
  handlingAlert.value = null
  await loadAll()
}

// ---------- 班次护理组按楼层分组 ----------
const nurseGroups = computed(() => {
  const s = shift.value
  if (!s) return [] as { floor: string; names: string[] }[]
  const map = new Map<string, string[]>()
  for (const n of s.nurses) {
    if (!map.has(n.floor)) map.set(n.floor, [])
    map.get(n.floor)!.push(n.name)
  }
  return [...map.entries()].map(([floor, names]) => ({ floor, names }))
})

// ---------- 实时事件：新告警进待办区；断线重连全量补偿 ----------
const offFns: Array<() => void> = []

onMounted(() => {
  void loadAll()
  tickTimer = window.setInterval(() => (nowTs.value = Date.now()), 1000)
  offFns.push(
    onRealtime('alert', (a: Alert) => {
      todos.value = sortTodos([a, ...(todos.value ?? [])])
      void getOverview().then((ov) => (overview.value = ov))
    }),
  )
  offFns.push(onRealtime('overview', (ov) => (overview.value = ov)))
  offFns.push(onRealtime('reconnected', () => void loadAll()))
})

onUnmounted(() => {
  offFns.forEach((f) => f())
  if (tickTimer !== null) window.clearInterval(tickTimer)
})

function elapsedLabel(a: Alert): string {
  return fmtDuration(slaElapsedMs(a, nowTs.value))
}

function goPatient(p: Patient) {
  location.hash = `#/patients/${encodeURIComponent(p.patient_id)}`
}

const ABNORMAL_LABELS: Record<string, string> = {
  fall: '跌倒预警中',
  off_bed: '离床预警中',
  hr: '心率关注',
  br: '呼吸关注',
  tp: '体温关注',
}
</script>

<template>
  <div class="console-page-head">
    <h2>值班工作台</h2>
    <p>当前班次待办、SLA 响应计时与重点关注长者，一屏掌握。</p>
  </div>

  <div v-if="loadError" class="console-errorbar">
    {{ loadError }}
    <span class="spacer"></span>
    <button class="console-btn console-btn-ghost console-btn-sm" @click="loadAll">重试</button>
  </div>

  <!-- 今日概览 KPI -->
  <section class="console-kpis">
    <div class="console-kpi">
      <div class="kpi-label">今日告警</div>
      <div class="kpi-value">{{ overview?.alerts_today ?? '—' }}<small>条</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">已闭环</div>
      <div class="kpi-value">{{ overview?.alerts_closed_today ?? '—' }}<small>条</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">闭环率</div>
      <div class="kpi-value">{{ closeRate ?? '—' }}<small>%</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">平均响应时长</div>
      <div class="kpi-value">{{ avgResponse ?? '—' }}</div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">当前在床率</div>
      <div class="kpi-value">
        {{ overview ? overview.in_bed_rate : '—' }}<small>%（{{ overview?.in_bed_count ?? 0 }}/{{ overview?.patient_total ?? 0 }}）</small>
      </div>
    </div>
  </section>

  <div class="console-dash-grid">
    <!-- 待办告警区 -->
    <section class="console-card">
      <div class="console-card-head">
        <div class="console-card-title">待办告警</div>
        <span class="console-cell-sub" v-if="todos">共 {{ todos.length }} 条 · 按级别与发生时间排序</span>
      </div>

      <div v-if="!todos" class="console-skeleton" style="padding: 0">
        <div class="skel" style="height: 56px" v-for="i in 4" :key="i"></div>
      </div>

      <div v-else-if="todos.length === 0" class="console-empty">
        <div class="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        当前没有待办告警，一切安好。
      </div>

      <div v-else class="console-todo-list">
        <div v-for="a in todos" :key="a.alert_id" class="console-todo-item">
          <span class="console-badge" :class="`console-badge-level-${a.level}`">{{ a.level }} 级</span>
          <div class="console-todo-main">
            <div class="console-todo-title">
              {{ a.title }}
              <span class="console-dot-badge" :class="`d-${a.status}`">
                <span class="dot"></span>{{ a.status === 'triggered' ? '待响应' : '处理中' }}
              </span>
            </div>
            <div class="console-todo-sub">
              {{ a.bed_id }} · {{ TYPE_LABELS[a.type] }} · {{ fmtTime(a.occurred_at) }} 发生
              <template v-if="a.claimed_by"> · {{ a.claimed_by }} 已接单</template>
            </div>
          </div>
          <div class="console-todo-side">
            <div class="console-sla" :class="{ over: slaOverdue(a, nowTs) }">
              已耗时 {{ elapsedLabel(a) }}
              <span v-if="slaOverdue(a, nowTs)" class="console-sla-tag">已超时</span>
              <span class="sla-target">目标 {{ SLA_TARGET_MIN[a.level] }} 分钟内响应</span>
            </div>
            <button
              v-if="a.status === 'triggered'"
              class="console-btn console-btn-primary console-btn-sm"
              :disabled="claimingId === a.alert_id"
              @click="claim(a)"
            >
              {{ claimingId === a.alert_id ? '接单中…' : '接单' }}
            </button>
            <button v-else class="console-btn console-btn-primary console-btn-sm" @click="openHandle(a)">处置</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 右列：班次卡 + 重点关注长者 -->
    <div>
      <section class="console-card" style="margin-bottom: 16px">
        <div class="console-card-head"><div class="console-card-title">班次</div></div>
        <div v-if="!shift" class="console-skeleton" style="padding: 0">
          <div class="skel" style="height: 30px"></div>
          <div class="skel" style="height: 60px"></div>
        </div>
        <template v-else>
          <div class="console-shift-name">
            <span class="s-name">{{ shift.shift_name }}</span>
            <span class="s-range">{{ shift.shift_range }}</span>
          </div>
          <div class="console-shift-rows">
            <div class="console-shift-row">
              <span>上一班遗留未闭环</span>
              <b class="console-num">{{ shift.carry_over_open }} 条</b>
            </div>
          </div>
          <div class="console-nurse-groups">
            <div class="console-nurse-group" v-for="g in nurseGroups" :key="g.floor">
              <span class="g-floor">{{ g.floor }}</span>
              <span class="g-names">{{ g.names.join('、') }}</span>
            </div>
          </div>
        </template>
      </section>

      <section class="console-card">
        <div class="console-card-head">
          <div class="console-card-title">重点关注长者</div>
          <span class="console-cell-sub" v-if="focusPatients">{{ focusPatients.length }} 位</span>
        </div>
        <div v-if="!focusPatients" class="console-skeleton" style="padding: 0">
          <div class="skel" style="height: 52px" v-for="i in 3" :key="i"></div>
        </div>
        <div v-else-if="focusPatients.length === 0" class="console-empty" style="padding: 32px 16px">
          <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          当前无异常关注长者。
        </div>
        <div v-else class="console-focus-list">
          <div v-for="p in focusPatients" :key="p.patient_id" class="console-focus-item" @click="goPatient(p)">
            <span class="console-dot-badge d-abnormal"><span class="dot"></span></span>
            <div class="f-main">
              <div class="f-name">{{ p.name }} · {{ p.bed_id }}</div>
              <div class="f-sub">{{ p.nurse }}</div>
            </div>
            <span class="console-badge console-badge-level-1">
              {{ ABNORMAL_LABELS[p.abnormal!.types[0]] ?? '异常关注' }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>

  <ConsoleHandleModal
    v-if="handlingAlert"
    :alert="handlingAlert"
    @close="handlingAlert = null"
    @done="onHandled"
  />
</template>
