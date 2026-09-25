<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getPatientDetail } from '../../api/client'
import { onRealtime } from '../../api/realtime'
import { fmtDay, fmtTime, STATUS_LABELS, TYPE_LABELS } from './labels'
import type { PatientDetail, VitalsEvent, VitalsPoint } from '../../api/types'

const props = defineProps<{ patientId: string }>()

const detail = ref<PatientDetail | null>(null)
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    detail.value = await getPatientDetail(props.patientId)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// ---------- 实时事件：vitals 命中本床位时更新当前值；断线重连后全量补偿 ----------
const offFns: Array<() => void> = []

onMounted(() => {
  void load()
  offFns.push(
    onRealtime('vitals', (v: VitalsEvent) => {
      if (detail.value && v.bed_id === detail.value.bed_id) {
        detail.value.vitals = {
          hr: v.hr,
          br: v.br,
          tp: v.tp,
          in_bed: v.in_bed,
          body_movement: v.body_movement,
          recorded_at: v.recorded_at,
        }
      }
    }),
  )
  offFns.push(onRealtime('reconnected', () => void load()))
})

onUnmounted(() => offFns.forEach((f) => f()))

// ---------- 纯 inline SVG 折线（不引图表库）----------
const CHART_W = 560
const CHART_H = 120
const CHART_PAD = 8

function chartOf(points: VitalsPoint[], color: string, unit: string) {
  const values = points.map((p) => p.v)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1e-6) {
    min -= 1
    max += 1
  }
  const span = max - min
  min -= span * 0.15
  const range = max - min || 1
  const stepX = (CHART_W - CHART_PAD * 2) / Math.max(1, points.length - 1)
  const line = points
    .map((p, i) => {
      const x = CHART_PAD + i * stepX
      const y = CHART_PAD + (1 - (p.v - min) / range) * (CHART_H - CHART_PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return { line, color, unit, min: Math.min(...values), max: Math.max(...values) }
}

const charts = computed(() => {
  if (!detail.value) return []
  const c = detail.value.curves
  return [
    { name: '心率', ...chartOf(c.hr, '#0B7A75', 'bpm') },
    { name: '呼吸', ...chartOf(c.br, '#C8956C', '次/分') },
    { name: '体温', ...chartOf(c.tp, '#5B8DB8', '℃') },
  ]
})

function goBack() {
  location.hash = '#/console/patients'
}
</script>

<template>
  <div class="console-page-head">
    <h2>长者详情</h2>
    <p>基本信息、近 24 小时体征曲线、昨夜睡眠与告警历史。</p>
  </div>

  <div v-if="loadError" class="console-panel">
    <div class="console-errorbar">
      {{ loadError }}
      <span class="spacer"></span>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="goBack">返回列表</button>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="load">重试</button>
    </div>
  </div>

  <div v-else-if="loading || !detail" class="console-card">
    <div class="console-skeleton" style="padding: 0">
      <div class="skel" style="height: 32px; width: 40%"></div>
      <div class="skel" style="height: 120px"></div>
      <div class="skel" style="height: 120px"></div>
    </div>
  </div>

  <template v-else>
    <!-- 基本信息 + 最新体征 -->
    <section class="console-card console-detail-head">
      <div>
        <div class="detail-name">
          {{ detail.name }}
          <span class="detail-name-sub">
            {{ detail.gender === 'male' ? '男' : '女' }} · {{ detail.age }} 岁 · {{ detail.patient_id }}
          </span>
        </div>
        <div class="detail-meta">
          {{ detail.bed_id }} · {{ detail.ward }} · {{ detail.care_level }} · 责任 {{ detail.nurse }} · {{ detail.doctor }}
        </div>
        <div class="detail-tags">
          <span v-for="d in detail.diseases" :key="d" class="console-tag">{{ d }}</span>
          <span v-if="detail.diseases.length === 0" class="console-cell-sub">无慢病标签</span>
        </div>
      </div>
      <div class="detail-vitals">
        <div class="pvital"><span class="pvital-label">心率</span><b>{{ detail.vitals.hr }}</b> bpm</div>
        <div class="pvital"><span class="pvital-label">呼吸</span><b>{{ detail.vitals.br }}</b> 次/分</div>
        <div class="pvital"><span class="pvital-label">体温</span><b>{{ detail.vitals.tp.toFixed(1) }}</b> ℃</div>
        <span class="console-dot-badge" :class="detail.vitals.in_bed ? 'd-in-bed' : 'd-off-bed'">
          <span class="dot"></span>{{ detail.vitals.in_bed ? '在床' : '离床' }}
        </span>
        <button class="console-btn console-btn-ghost console-btn-sm" @click="goBack">返回列表</button>
      </div>
    </section>

    <div class="console-detail-grid">
      <!-- 24h 体征曲线 -->
      <section class="console-card">
        <div class="console-card-head"><div class="console-card-title">近 24 小时体征曲线</div></div>
        <div class="console-charts">
          <div v-for="c in charts" :key="c.name" class="console-chart">
            <div class="console-chart-head">
              <span>{{ c.name }}</span>
              <span class="console-cell-sub console-num">{{ c.min }}–{{ c.max }} {{ c.unit }}</span>
            </div>
            <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" preserveAspectRatio="none" class="console-chart-svg">
              <polyline :points="c.line" fill="none" :stroke="c.color" stroke-width="1.6" />
            </svg>
          </div>
        </div>
      </section>

      <!-- 昨夜睡眠摘要 -->
      <section class="console-card">
        <div class="console-card-head"><div class="console-card-title">昨夜睡眠</div></div>
        <div class="console-sleep">
          <div class="sleep-score">
            <div class="sleep-score-num">{{ detail.sleep.score }}</div>
            <div class="console-cell-sub">{{ detail.sleep.grade }}</div>
          </div>
          <div class="sleep-rows">
            <div class="sleep-row"><span>总时长</span><b>{{ detail.sleep.totalHours }}</b></div>
            <div class="sleep-row"><span>深睡占比</span><b>{{ detail.sleep.deepPct }}</b></div>
            <div class="sleep-row"><span>入睡 / 起床</span><b>{{ detail.sleep.bedTime }} / {{ detail.sleep.leaveTime }}</b></div>
            <div class="sleep-row"><span>夜间离床</span><b>{{ detail.sleep.leaveCount }} 次</b></div>
            <div class="sleep-row"><span>体动次数</span><b>{{ detail.sleep.movement }} 次</b></div>
          </div>
        </div>
      </section>
    </div>

    <!-- 告警历史 -->
    <section class="console-panel">
      <div class="console-panel-head"><h2>告警历史（含今日与近 7 天）</h2></div>
      <div v-if="detail.alert_history.length === 0" class="console-empty">
        <div class="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        近期无告警记录。
      </div>
      <table v-else class="console-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>告警</th>
            <th>级别</th>
            <th>状态</th>
            <th>处置记录</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in detail.alert_history" :key="a.alert_id">
            <td>{{ fmtDay(a.occurred_at) }}<div class="console-cell-sub console-num">{{ fmtTime(a.occurred_at) }}</div></td>
            <td>
              <div class="console-cell-title">{{ a.title }}</div>
              <div class="console-cell-sub">{{ TYPE_LABELS[a.type] }}</div>
            </td>
            <td>
              <span class="console-badge" :class="`console-badge-level-${a.level}`">{{ a.level }} 级</span>
            </td>
            <td>
              <span class="console-dot-badge" :class="`d-${a.status}`">
                <span class="dot"></span>{{ STATUS_LABELS[a.status] }}
              </span>
            </td>
            <td>
              <template v-if="a.handle_note">
                <div>{{ a.handled_by }}</div>
                <div class="console-cell-sub">{{ a.handle_note }}</div>
              </template>
              <span v-else class="console-cell-sub">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </template>
</template>
