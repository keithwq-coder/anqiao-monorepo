<template>
  <div class="patient-dossier-page">
    <!-- 顶部状态栏与大盘指标 -->
    <div class="dossier-header-card">
      <div class="header-left">
        <div class="page-title">
          <span class="icon">🧓</span>
          <span>在院长者全景档案</span>
          <span class="badge-total">{{ data ? data.total : 87 }} 位在管长者</span>
        </div>
        <p class="page-subtitle">
          凯健国际护理院 · 全病区在院长者客观健康档案 · 毫米波生命体征全时连续感知 · 护理自理等级与照护责任全貌
        </p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="loadData">
          🔄 刷新档案数据
        </button>
      </div>
    </div>

    <!-- 顶栏关键指标统计 -->
    <div class="stats-matrix">
      <div class="stat-card">
        <div class="stat-val font-mono">{{ data?.total || 87 }}</div>
        <div class="stat-lbl">在院总长者 (96总床位)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val text-success font-mono">{{ inBedCount }}</div>
        <div class="stat-lbl">实时在床监护 (在床率 {{ inBedRate }}%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val text-warning font-mono">{{ offBedCount }}</div>
        <div class="stat-lbl">离床活动 / 如厕 / 康复</div>
      </div>
      <div class="stat-card">
        <div class="stat-val text-danger font-mono">{{ abnormalCount }}</div>
        <div class="stat-lbl">体征重点关注 / 离床超时</div>
      </div>
    </div>

    <!-- 筛选控制台 -->
    <div class="filter-controls-panel">
      <!-- 楼层快速切换 Chips -->
      <div class="floor-chips">
        <button
          class="floor-chip-btn"
          :class="{ active: filters.floor === '' }"
          @click="filters.floor = ''; applyFilters()"
        >
          全部楼层 (87)
        </button>
        <button
          v-for="fl in ['4F', '3F', '2F', '1F']"
          :key="fl"
          class="floor-chip-btn"
          :class="{ active: filters.floor === fl }"
          @click="filters.floor = fl; applyFilters()"
        >
          {{ floorLabel(fl) }}
        </button>
      </div>

      <div class="filter-row">
        <div class="filter-group">
          <label>长者在床状态：</label>
          <select v-model="filters.status" class="select-input" @change="applyFilters">
            <option value="">全部长者</option>
            <option value="in_bed">仅在床监护</option>
            <option value="off_bed">仅离床活动</option>
            <option value="abnormal">体征关注/预警</option>
          </select>
        </div>

        <div class="filter-group search-group ml-auto">
          <input
            v-model="filters.q"
            type="text"
            class="search-input"
            placeholder="按姓名或床号搜索 (如 张卫国、孙秀珍 或 401)..."
            @input="onSearchInput"
          />
          <button v-if="filters.q" class="clear-search-btn" @click="filters.q = ''; applyFilters()">×</button>
        </div>
      </div>
    </div>

    <!-- 错误提示条 -->
    <div v-if="loadError" class="error-banner">
      <span>{{ loadError }}</span>
      <button class="btn btn-xs btn-outline" @click="loadData">重试</button>
    </div>

    <!-- 加载中骨架 -->
    <div v-else-if="loading && !data" class="elder-cards-grid">
      <div v-for="i in 8" :key="i" class="card-skeleton"></div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="data && data.list.length === 0" class="empty-state-panel">
      <div class="empty-icon">🧓</div>
      <div class="empty-title">当前筛选条件下暂无长者</div>
      <div class="empty-desc">请尝试切换楼层分类或清除搜索关键词</div>
      <button class="btn btn-sm btn-primary mt-3" @click="filters.floor = ''; filters.status = ''; filters.q = ''; applyFilters()">
        查看全院 87 位长者
      </button>
    </div>

    <!-- 长者全景卡片网格 -->
    <template v-else-if="data">
      <div class="elder-cards-grid">
        <div
          v-for="p in data.list"
          :key="p.patient_id"
          class="elder-dossier-card"
          @click="openPatientDetail(p)"
        >
          <div class="card-top-row">
            <div class="bed-zone-info">
              <span class="bed-id font-mono">{{ p.bed_id }}</span>
              <span class="floor-tag">{{ p.floor }}</span>
              <span class="ward-text">{{ p.ward }}</span>
            </div>
            <span
              class="presence-pill"
              :class="p.vitals.in_bed ? 'pill-in-bed' : 'pill-off-bed'"
            >
              {{ p.vitals.in_bed ? '在床监护' : '离床活动' }}
            </span>
          </div>

          <div class="card-elder-profile">
            <div class="profile-name-row">
              <span class="elder-name">{{ p.name }}</span>
              <span class="elder-age text-muted text-xs">
                {{ p.gender === 'male' ? '爷爷' : '奶奶' }} · {{ p.age }} 岁
              </span>
              <span class="care-level-tag" :class="careTagClass(p.care_level)">
                {{ p.care_level }}
              </span>
            </div>
            <div class="profile-staff-row text-xs text-muted">
              <span>责任护工: <strong class="text-dark">{{ p.nurse }}</strong></span>
              <span class="ml-2">责任医生: {{ p.doctor }}</span>
            </div>
          </div>

          <!-- 生理体征监护横带 -->
          <div class="vitals-strip">
            <div class="vital-col">
              <span class="v-label">心率</span>
              <span class="v-val font-mono" :class="{ 'text-danger': p.vitals.hr > 100 || p.vitals.hr < 55 }">
                {{ p.vitals.hr }} <small>bpm</small>
              </span>
            </div>
            <div class="vital-col">
              <span class="v-label">呼吸</span>
              <span class="v-val font-mono" :class="{ 'text-danger': p.vitals.br > 24 || p.vitals.br < 12 }">
                {{ p.vitals.br }} <small>次/分</small>
              </span>
            </div>
            <div class="vital-col">
              <span class="v-label">体温</span>
              <span class="v-val font-mono" :class="{ 'text-danger': p.vitals.tp >= 37.4 }">
                {{ p.vitals.tp.toFixed(1) }} <small>℃</small>
              </span>
            </div>
          </div>

          <!-- 底部操作与客观详情直达 -->
          <div class="card-bottom-bar">
            <span class="record-time text-xs text-muted font-mono">
              感知更新: {{ p.vitals.recorded_at?.slice(11, 19) || '刚刚' }}
            </span>
            <button class="btn btn-xs btn-outline-primary ml-auto" @click.stop="openPatientDetail(p)">
              客观详情档案 →
            </button>
          </div>
        </div>
      </div>

      <!-- 分页栏 -->
      <div class="dossier-pagination">
        <span class="page-info text-sm text-muted">
          共 {{ data.total }} 位长者 · 第 {{ data.page }} / {{ Math.max(1, Math.ceil(data.total / filters.page_size)) }} 页
        </span>
        <div class="page-buttons ml-auto">
          <button
            class="btn btn-sm btn-outline"
            :disabled="data.page <= 1 || loading"
            @click="changePage(-1)"
          >
            上一页
          </button>
          <button
            class="btn btn-sm btn-outline ml-2"
            :disabled="data.page >= Math.ceil(data.total / filters.page_size) || loading"
            @click="changePage(1)"
          >
            下一页
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { getPatients } from '../../../api/client'
import { onRealtime } from '../../../api/realtime'
import type { Paged, Patient, PatientStatusFilter, VitalsEvent } from '../../../api/types'

const data = ref<Paged<Patient> | null>(null)
const loading = ref(false)
const loadError = ref('')

const filters = reactive({
  floor: '',
  status: '' as '' | PatientStatusFilter,
  q: '',
  page: 1,
  page_size: 24,
})

let qTimer: number | null = null

function floorLabel(fl: string): string {
  const map: Record<string, string> = {
    '4F': '4F 完全失能专区 (22)',
    '3F': '3F 认知障碍专区 (21)',
    '2F': '2F 术后康复专区 (22)',
    '1F': '1F 慢病颐养专区 (22)',
  }
  return map[fl] || fl
}

function careTagClass(level: string): string {
  if (level?.includes('特级')) return 'tag-danger'
  if (level?.includes('一级')) return 'tag-warning'
  return 'tag-info'
}

const inBedCount = computed(() => {
  if (!data.value) return 52
  return data.value.list.filter((p) => p.vitals.in_bed).length
})

const offBedCount = computed(() => {
  if (!data.value) return 35
  return data.value.list.filter((p) => !p.vitals.in_bed).length
})

const inBedRate = computed(() => {
  if (!data.value || !data.value.list.length) return 60
  return Math.round((inBedCount.value / data.value.list.length) * 100)
})

const abnormalCount = computed(() => {
  if (!data.value) return 4
  return data.value.list.filter((p) => p.abnormal !== null || p.vitals.tp >= 37.4 || p.vitals.hr > 100).length
})

async function loadData() {
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
  } catch (err: any) {
    loadError.value = err.message || '加载长者档案失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  filters.page = 1
  loadData()
}

function onSearchInput() {
  if (qTimer !== null) window.clearTimeout(qTimer)
  qTimer = window.setTimeout(applyFilters, 300)
}

function changePage(delta: number) {
  if (!data.value) return
  const next = filters.page + delta
  const maxPage = Math.max(1, Math.ceil(data.value.total / filters.page_size))
  if (next < 1 || next > maxPage) return
  filters.page = next
  loadData()
}

function openPatientDetail(p: Patient) {
  location.hash = `#/console/patients/${encodeURIComponent(p.patient_id)}`
}

const offFns: Array<() => void> = []

onMounted(() => {
  loadData()
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
})

onUnmounted(() => {
  offFns.forEach((f) => f())
  if (qTimer !== null) window.clearTimeout(qTimer)
})
</script>

<style scoped>
.patient-dossier-page {
  padding: 20px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
}

.dossier-header-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}

.badge-total {
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #bfdbfe;
}

.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.stats-matrix {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  background: #ffffff;
  padding: 14px 18px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.stat-val {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.stat-lbl {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.filter-controls-panel {
  background: #ffffff;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

.floor-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.floor-chip-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.floor-chip-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.floor-chip-btn.active {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.select-input, .search-input {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  background: #ffffff;
}

.search-group {
  position: relative;
  min-width: 280px;
}

.search-input {
  width: 100%;
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
}

.elder-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.elder-dossier-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.elder-dossier-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #93c5fd;
}

.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.bed-id {
  font-weight: 800;
  color: #0284c7;
  font-size: 15px;
}

.floor-tag {
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
}

.ward-text {
  font-size: 11px;
  color: #94a3b8;
  margin-left: 6px;
}

.presence-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.pill-in-bed {
  background: #dcfce7;
  color: #15803d;
}

.pill-off-bed {
  background: #fef3c7;
  color: #b45309;
}

.card-elder-profile {
  margin-bottom: 12px;
}

.profile-name-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.elder-name {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.care-level-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.tag-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.tag-warning {
  background: #fef3c7;
  color: #b45309;
}

.tag-info {
  background: #e0f2fe;
  color: #0369a1;
}

.vitals-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 12px;
  text-align: center;
}

.vital-col .v-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 2px;
}

.vital-col .v-val {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.card-bottom-bar {
  display: flex;
  align-items: center;
  border-top: 1px solid #f1f5f9;
  padding-top: 10px;
}

.dossier-pagination {
  display: flex;
  align-items: center;
  background: #ffffff;
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-top: 16px;
}

.card-skeleton {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  height: 200px;
  animation: pulse 1.5s infinite;
}

.empty-state-panel {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 13px;
  color: #64748b;
}

.ml-auto {
  margin-left: auto;
}

.text-danger {
  color: #dc2626 !important;
}

.text-success {
  color: #16a34a !important;
}

.text-warning {
  color: #d97706 !important;
}

.font-mono {
  font-family: monospace;
}
</style>
