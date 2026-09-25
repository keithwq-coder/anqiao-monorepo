<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { getPatients } from '../../api/client'
import { onRealtime } from '../../api/realtime'
import type { Paged, Patient, PatientStatusFilter, VitalsEvent } from '../../api/types'

const data = ref<Paged<Patient> | null>(null)
const floors = ref<string[]>([])
const loading = ref(false)
const loadError = ref('')

const filters = reactive({
  floor: '',
  status: '' as '' | PatientStatusFilter,
  q: '',
  page: 1,
  page_size: 12,
})

let qTimer: number | null = null

async function loadFloors() {
  try {
    // 一次拉全量（<=100）推导楼层清单
    const all = await getPatients({ page_size: 100 })
    const set = new Set<string>()
    for (const p of all.list) set.add(p.bed_id.charAt(0) + 'F')
    floors.value = [...set].sort().reverse()
  } catch {
    // 楼层 chips 失败不阻塞主列表
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    data.value = await getPatients({
      floor: filters.floor || undefined,
      status: filters.status || undefined,
      q: filters.q.trim() || undefined,
      page: filters.page,
      page_size: filters.page_size,
    })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  filters.page = 1
  void load()
}

function onSearchInput() {
  if (qTimer !== null) window.clearTimeout(qTimer)
  qTimer = window.setTimeout(applyFilters, 350)
}

function gotoPage(delta: number) {
  if (!data.value) return
  const next = filters.page + delta
  const maxPage = Math.max(1, Math.ceil(data.value.total / filters.page_size))
  if (next < 1 || next > maxPage) return
  filters.page = next
  void load()
}

function openDetail(p: Patient) {
  location.hash = `#/console/patients/${encodeURIComponent(p.patient_id)}`
}

// ---------- 实时事件：vitals 更新当前页卡片；断线重连后全量补偿 ----------
const offFns: Array<() => void> = []

onMounted(() => {
  void loadFloors()
  void load()
  offFns.push(
    onRealtime('vitals', (v: VitalsEvent) => {
      const p = data.value?.list.find((x) => x.bed_id === v.bed_id)
      if (p) {
        p.vitals = {
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

onUnmounted(() => {
  offFns.forEach((f) => f())
  if (qTimer !== null) window.clearTimeout(qTimer)
})

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
    <h2>长者监护</h2>
    <p>异常长者优先展示，按楼层与在床状态快速定位。</p>
  </div>

  <section class="console-panel">
    <div class="console-panel-head" style="flex-direction: column; align-items: stretch; gap: 12px">
      <div class="console-chips">
        <button class="console-chip" :class="{ active: filters.floor === '' }" @click="((filters.floor = ''), applyFilters())">
          全部楼层
        </button>
        <button
          v-for="f in floors"
          :key="f"
          class="console-chip"
          :class="{ active: filters.floor === f }"
          @click="((filters.floor = f), applyFilters())"
        >
          {{ f }}
        </button>
      </div>
      <div style="display: flex; gap: 10px">
        <select class="console-select" v-model="filters.status" @change="applyFilters">
          <option value="">全部状态</option>
          <option value="in_bed">在床</option>
          <option value="off_bed">离床</option>
          <option value="abnormal">异常关注</option>
        </select>
        <input
          class="console-select console-search"
          v-model="filters.q"
          placeholder="搜索姓名 / 床位号"
          @input="onSearchInput"
        />
      </div>
    </div>

    <div v-if="loadError" class="console-errorbar">
      {{ loadError }}
      <span class="spacer"></span>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="load">重试</button>
    </div>

    <div v-else-if="loading && !data" class="console-cards">
      <div v-for="i in 6" :key="i" class="skel" style="height: 148px"></div>
    </div>

    <div v-else-if="data && data.list.length === 0" class="console-empty">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      当前筛选条件下没有匹配的长者。
    </div>

    <template v-else-if="data">
      <div class="console-cards" style="padding-top: 4px">
        <div v-for="p in data.list" :key="p.patient_id" class="console-pcard" @click="openDetail(p)">
          <div class="pcard-head">
            <div>
              <div class="pcard-name">
                {{ p.name }}
                <span class="console-badge console-badge-level-3">{{ p.care_level }}</span>
              </div>
              <div class="pcard-sub">{{ p.bed_id }} · {{ p.ward }}</div>
            </div>
            <span v-if="p.abnormal" class="console-dot-badge d-abnormal">
              <span class="dot"></span>{{ ABNORMAL_LABELS[p.abnormal.types[0]] ?? '异常关注' }}
            </span>
            <span v-else class="console-dot-badge" :class="p.vitals.in_bed ? 'd-in-bed' : 'd-off-bed'">
              <span class="dot"></span>{{ p.vitals.in_bed ? '在床' : '离床' }}
            </span>
          </div>
          <div class="pcard-vitals">
            <div class="pvital"><span class="pvital-label">心率</span><b>{{ p.vitals.hr }}</b> bpm</div>
            <div class="pvital"><span class="pvital-label">呼吸</span><b>{{ p.vitals.br }}</b> 次/分</div>
            <div class="pvital"><span class="pvital-label">体温</span><b>{{ p.vitals.tp.toFixed(1) }}</b> ℃</div>
          </div>
          <div class="pcard-foot">
            <span>{{ p.gender === 'male' ? '男' : '女' }} · {{ p.age }} 岁</span>
            <span>{{ p.nurse }}</span>
          </div>
        </div>
      </div>

      <div class="console-pagination">
        <span>共 {{ data.total }} 位 · 第 {{ data.page }} / {{ Math.max(1, Math.ceil(data.total / data.page_size)) }} 页</span>
        <span class="spacer"></span>
        <button class="console-btn console-btn-ghost console-btn-sm" :disabled="data.page <= 1 || loading" @click="gotoPage(-1)">上一页</button>
        <button
          class="console-btn console-btn-ghost console-btn-sm"
          :disabled="data.page >= Math.ceil(data.total / data.page_size) || loading"
          @click="gotoPage(1)"
        >
          下一页
        </button>
      </div>
    </template>
  </section>
</template>
