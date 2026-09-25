<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { claimAlert, getAlerts } from '../../api/client'
import { onRealtime } from '../../api/realtime'
import {
  fmtDuration,
  fmtTime,
  slaElapsedMs,
  slaOverdue,
  SLA_TARGET_MIN,
  STATUS_LABELS,
  TYPE_LABELS,
} from './labels'
import ConsoleHandleModal from './ConsoleHandleModal.vue'
import type { Alert, AlertStatus, Paged } from '../../api/types'

// 厂商租户：展示城市/机构列（护理院租户为床位/长者）
const props = withDefaults(defineProps<{ vendor?: boolean }>(), { vendor: false })
const isVendor = computed(() => props.vendor)

type TabKey = '' | 'triggered' | 'handling' | 'handled'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'triggered', label: '待响应' },
  { key: 'handling', label: '处理中' },
  { key: 'handled', label: '已闭环' },
  { key: '', label: '全部' },
]

const alerts = ref<Paged<Alert> | null>(null)
const counts = ref<Record<string, number | null>>({ triggered: null, handling: null, handled: null })
const loading = ref(false)
const loadError = ref('')
const claimingId = ref<string | null>(null)
const handlingAlert = ref<Alert | null>(null)

const filters = reactive({
  tab: 'triggered' as TabKey,
  level: '' as '' | '1' | '2' | '3',
  page: 1,
  page_size: 10,
})

// SLA 计时心跳（1s）
const nowTs = ref(Date.now())
let tickTimer: number | null = null

async function loadCounts() {
  try {
    const [t, h, d] = await Promise.all([
      getAlerts({ status: 'triggered', page_size: 1 }),
      getAlerts({ status: 'handling', page_size: 1 }),
      getAlerts({ status: 'handled', page_size: 1 }),
    ])
    counts.value = { triggered: t.total, handling: h.total, handled: d.total }
  } catch {
    // 角标失败不阻塞主列表
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    alerts.value = await getAlerts({
      status: (filters.tab || undefined) as AlertStatus | undefined,
      level: filters.level ? (Number(filters.level) as 1 | 2 | 3) : undefined,
      page: filters.page,
      page_size: filters.page_size,
    })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function loadAll() {
  void loadCounts()
  void load()
}

function switchTab(tab: TabKey) {
  filters.tab = tab
  filters.page = 1
  void load()
}

function applyLevel() {
  filters.page = 1
  void load()
}

function gotoPage(delta: number) {
  if (!alerts.value) return
  const next = filters.page + delta
  const maxPage = Math.max(1, Math.ceil(alerts.value.total / filters.page_size))
  if (next < 1 || next > maxPage) return
  filters.page = next
  void load()
}

// ---------- 工作流操作：接单 / 处置 ----------
async function claim(a: Alert) {
  if (claimingId.value) return
  claimingId.value = a.alert_id
  try {
    await claimAlert(a.alert_id)
    loadAll()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '接单失败，请稍后重试'
  } finally {
    claimingId.value = null
  }
}

function openHandle(a: Alert) {
  handlingAlert.value = a
}

function onHandled() {
  handlingAlert.value = null
  loadAll()
}

// ---------- 实时事件：新告警插入首位；断线重连全量补偿 ----------
const offFns: Array<() => void> = []

onMounted(() => {
  loadAll()
  tickTimer = window.setInterval(() => (nowTs.value = Date.now()), 1000)
  offFns.push(
    onRealtime('alert', (a: Alert) => {
      if (counts.value.triggered !== null) counts.value.triggered += 1
      if (alerts.value && (filters.tab === '' || filters.tab === 'triggered')) {
        const matchLevel = !filters.level || Number(filters.level) === a.level
        if (matchLevel) {
          const list =
            filters.page === 1
              ? [a, ...alerts.value.list.slice(0, filters.page_size - 1)]
              : alerts.value.list
          alerts.value = { ...alerts.value, list, total: alerts.value.total + 1 }
        }
      }
    }),
  )
  offFns.push(onRealtime('reconnected', () => loadAll()))
})

onUnmounted(() => {
  offFns.forEach((f) => f())
  if (tickTimer !== null) window.clearInterval(tickTimer)
})

function rowSla(a: Alert): { text: string; over: boolean; target: string } {
  if (a.status === 'handled' && a.handled_at) {
    return { text: '耗时 ' + fmtDuration(Date.parse(a.handled_at) - Date.parse(a.occurred_at)), over: false, target: '' }
  }
  if (a.status === 'missed') return { text: '超时未响应', over: true, target: '' }
  const over = slaOverdue(a, nowTs.value)
  return {
    text: '已耗时 ' + fmtDuration(slaElapsedMs(a, nowTs.value)),
    over,
    target: `目标 ${SLA_TARGET_MIN[a.level]} 分钟内响应`,
  }
}
</script>

<template>
  <div class="console-page-head">
    <h2>告警中心</h2>
    <p>待响应 → 接单处理中 → 处置闭环，全链路留痕。</p>
  </div>

  <section class="console-panel">
    <div class="console-tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="console-tab"
        :class="{ active: filters.tab === t.key }"
        @click="switchTab(t.key)"
      >
        {{ t.label }}
        <span v-if="t.key && counts[t.key] !== null" class="count">{{ counts[t.key] }}</span>
      </button>
      <div style="flex: 1"></div>
      <select class="console-select" style="margin: 5px 0" v-model="filters.level" @change="applyLevel">
        <option value="">全部级别</option>
        <option value="1">1 级 · 紧急</option>
        <option value="2">2 级 · 中危</option>
        <option value="3">3 级 · 关注</option>
      </select>
    </div>

    <div v-if="loadError" class="console-errorbar">
      {{ loadError }}
      <span class="spacer"></span>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="loadAll">重试</button>
    </div>

    <div v-else-if="loading && !alerts" class="console-skeleton">
      <div class="skel" style="height: 48px" v-for="i in 6" :key="i"></div>
    </div>

    <div v-else-if="alerts && alerts.list.length === 0" class="console-empty">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      当前分组下暂无告警，一切安好。
    </div>

    <template v-else-if="alerts">
      <table class="console-table">
        <thead>
          <tr>
            <th>级别</th>
            <th>告警</th>
            <th v-if="isVendor">城市</th>
            <th>{{ isVendor ? '设备SN / 客户' : '床位 / 长者' }}</th>
            <th>SLA 计时</th>
            <th>接单人</th>
            <th>处置记录</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts.list" :key="a.alert_id">
            <td>
              <span class="console-badge" :class="`console-badge-level-${a.level}`">{{ a.level }} 级</span>
            </td>
            <td>
              <div class="console-cell-title">{{ a.title }}</div>
              <div class="console-cell-sub">{{ TYPE_LABELS[a.type] }} · {{ fmtTime(a.occurred_at) }} 发生</div>
            </td>
            <td v-if="isVendor">{{ a.city ?? '—' }}</td>
            <td>
              <div class="console-cell-title">{{ a.bed_id }}</div>
              <div class="console-cell-sub">{{ isVendor ? (a.customer ?? '—') : a.patient_id }}</div>
            </td>
            <td>
              <div class="console-sla" :class="{ over: rowSla(a).over }">
                {{ rowSla(a).text }}
                <span v-if="rowSla(a).over && (a.status === 'triggered' || a.status === 'handling')" class="console-sla-tag">已超时</span>
                <span v-if="rowSla(a).target" class="sla-target">{{ rowSla(a).target }}</span>
              </div>
            </td>
            <td>
              <template v-if="a.claimed_by">
                <div>{{ a.claimed_by }}</div>
                <div class="console-cell-sub">{{ a.claimed_at ? fmtTime(a.claimed_at) : '' }}</div>
              </template>
              <span v-else class="console-cell-sub">—</span>
            </td>
            <td>
              <template v-if="a.handle_note">
                <div>{{ a.handled_by }}</div>
                <div class="console-cell-sub">{{ fmtTime(a.handled_at!) }}</div>
                <div class="console-cell-note">{{ a.handle_note }}</div>
              </template>
              <span v-else class="console-cell-sub">—</span>
            </td>
            <td>
              <span class="console-dot-badge" :class="`d-${a.status}`">
                <span class="dot"></span>{{ STATUS_LABELS[a.status] }}
              </span>
            </td>
            <td>
              <button
                v-if="a.status === 'triggered'"
                class="console-btn console-btn-primary console-btn-sm"
                :disabled="claimingId === a.alert_id"
                @click="claim(a)"
              >
                {{ claimingId === a.alert_id ? '接单中…' : '接单' }}
              </button>
              <button
                v-else-if="a.status === 'handling'"
                class="console-btn console-btn-ghost console-btn-sm"
                @click="openHandle(a)"
              >
                处置
              </button>
              <span v-else class="console-cell-sub">—</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="console-pagination">
        <span>共 {{ alerts.total }} 条 · 第 {{ alerts.page }} / {{ Math.max(1, Math.ceil(alerts.total / alerts.page_size)) }} 页</span>
        <span class="spacer"></span>
        <button class="console-btn console-btn-ghost console-btn-sm" :disabled="alerts.page <= 1 || loading" @click="gotoPage(-1)">上一页</button>
        <button
          class="console-btn console-btn-ghost console-btn-sm"
          :disabled="alerts.page >= Math.ceil(alerts.total / alerts.page_size) || loading"
          @click="gotoPage(1)"
        >
          下一页
        </button>
      </div>
    </template>
  </section>

  <ConsoleHandleModal
    v-if="handlingAlert"
    :alert="handlingAlert"
    @close="handlingAlert = null"
    @done="onHandled"
  />
</template>
