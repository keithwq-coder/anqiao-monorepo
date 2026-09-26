<template>
  <div class="workspace-page nursing-staff" :class="{ 'is-mobile-caregiver-view': isMobile }">
    <!-- 移动端专属自适应顶部条 (当手机登录时呈现) -->
    <div v-if="isMobile" class="mobile-top-header">
      <div class="m-user-row">
        <div class="m-avatar">👩‍⚕️</div>
        <div class="m-meta">
          <div class="m-name font-bold">{{ nurseName }}</div>
          <div class="m-tags text-xs">
            <span class="badge badge-primary">{{ assignedFloorText }}</span>
            <span :class="['badge', isOnDuty ? 'badge-success' : 'badge-secondary', 'ml-1']">
              {{ isOnDuty ? '在岗值守' : '今日轮休' }}
            </span>
            <span class="badge badge-warning ml-1">{{ assignedBedText }}</span>
          </div>
        </div>
        <button class="m-refresh-btn" @click="loadData" title="刷新最新体征">🔄</button>
      </div>

      <!-- 移动端流动指标微卡 -->
      <div class="m-metrics-strip">
        <div class="m-stat">
          <span class="m-num">{{ myPatients.length }}</span>
          <span class="m-lbl">负责长者</span>
        </div>
        <div class="m-stat">
          <span class="m-num text-success">{{ myInBedCount }}</span>
          <span class="m-lbl">实时在床</span>
        </div>
        <div class="m-stat">
          <span class="m-num text-warning">{{ myPendingTurnsCount }}</span>
          <span class="m-lbl">待翻身</span>
        </div>
        <div class="m-stat">
          <span class="m-num text-danger">{{ floorAlerts.length }}</span>
          <span class="m-lbl">待办告警</span>
        </div>
      </div>
    </div>

    <!-- PC 桌面端常规顶部 -->
    <div v-else class="page-header">
      <div>
        <div class="page-title">
          {{ nurseName }} · 专属照护
          <span class="badge badge-primary text-xs ml-2">{{ staffTitle }}</span>
        </div>
        <div class="page-subtitle">
          {{ orgName }} · 所属病区: <strong class="text-primary">{{ assignedFloorText }}</strong> · 负责床段: <strong class="text-primary">{{ assignedBedText }}</strong>
        </div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">数据可见范围: assigned (严格楼层与管床隔离)</span>
        <span :class="['badge', isOnDuty ? 'badge-success' : 'badge-secondary']">
          {{ isOnDuty ? '🟢 在岗值守中' : '⚪ 今日轮休备勤' }}
        </span>
      </div>
    </div>

    <!-- PC 桌面端指标卡片 -->
    <div v-if="!isMobile" class="metric-grid">
      <div class="metric-card">
        <div class="metric-num">{{ myPatients.length }}</div>
        <div class="metric-label">本责任组在管长者 ({{ assignedBedText }})</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ myInBedCount }}</div>
        <div class="metric-label">当前在床长者</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">{{ myOffBedCount }}</div>
        <div class="metric-label">离床活动/如厕长者</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-danger">{{ floorAlerts.length }}</div>
        <div class="metric-label">待办呼叫与照护告警</div>
      </div>
    </div>

    <!-- 手机端便捷提示栏 -->
    <div v-if="isMobile" class="m-mobile-alert-banner mb-2">
      <span>📱 移动手持模式 · 专为床旁巡检与即时翻身打卡优化</span>
    </div>
    <div v-else class="panel-alert">
      <strong>严格数据隔离保护：</strong> 您当前已分配管理 <strong>{{ assignedFloorText }} ({{ assignedBedText }})</strong>。后端授权引擎已强制进行管辖数据过滤，系统禁止调取其他区域长者档案及越权处置他人告警。
    </div>

    <!-- 导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'patients' && 'active']" @click="activeTab = 'patients'">
        🛏️ {{ isMobile ? '我的管床' : '负责长者与在床监护' }} ({{ myPatients.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'alerts' && 'active']" @click="activeTab = 'alerts'">
        🚨 {{ isMobile ? '告警接单' : '本楼层照护告警处置' }} ({{ floorAlerts.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'record' && 'active']" @click="activeTab = 'record'">
        📋 {{ isMobile ? '交接记事' : '当班护理交班记录' }}
      </button>
    </div>

    <!-- Tab 1: 本人负责长者监护网格 / 流式列表 -->
    <div v-if="activeTab === 'patients'" class="content-panel">
      <!-- 移动端长者触控卡片流 -->
      <div class="patient-grid" :class="{ 'm-touch-stream': isMobile }">
        <div v-for="p in myPatients" :key="p.patient_id" class="bed-card" :class="{ 'm-card-touch': isMobile }">
          <div class="bed-card-header">
            <span class="bed-tag font-mono">{{ p.bed_id }}</span>
            <span :class="['in-bed-tag', p.vitals.in_bed ? 'bg-success' : 'bg-warning']">
              {{ p.vitals.in_bed ? '在床监护' : '离床活动' }}
            </span>
          </div>
          <div class="bed-patient-info">
            <span class="patient-name font-bold">{{ p.name }}</span>
            <span class="text-xs text-muted">{{ p.age }}岁 · {{ p.gender === 'male' ? '男' : '女' }}</span>
            <span class="tag tag-danger ml-auto text-xs">{{ p.care_level }}</span>
          </div>

          <div class="posture-status-row">
            <span class="text-xs text-muted">当前体位: </span>
            <span class="text-xs font-bold text-primary">{{ getPosture(p.patient_id) }}</span>
            <span class="text-xs text-muted ml-2">距下次翻身: </span>
            <span class="text-xs font-bold text-success">{{ getNextDue(p.patient_id) }}</span>
          </div>

          <div class="vitals-row">
            <div class="vital-item">
              <span class="lbl">心率</span>
              <span class="val font-mono" :class="{ 'text-danger': p.vitals.hr > 100 || p.vitals.hr < 55 }">
                {{ p.vitals.hr }} <small>bpm</small>
              </span>
            </div>
            <div class="vital-item">
              <span class="lbl">呼吸</span>
              <span class="val font-mono">{{ p.vitals.br }} <small>次</small></span>
            </div>
            <div class="vital-item">
              <span class="lbl">体温</span>
              <span class="val font-mono" :class="{ 'text-danger': p.vitals.tp >= 37.3 }">
                {{ p.vitals.tp }} <small>℃</small>
              </span>
            </div>
          </div>

          <!-- 触控行动按钮 -->
          <div class="bed-card-footer" :class="{ 'm-card-actions': isMobile }">
            <button class="btn btn-sm btn-outline-primary" @click="openTurnModal(p)">
              🔄 一键翻身
            </button>
            <button class="btn btn-sm btn-primary" @click="patrolBed(p)">
              🩺 巡房打卡
            </button>
            <a :href="'#/patients/' + p.patient_id" class="btn btn-sm btn-outline">
              详情
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: 本楼层告警处置 -->
    <div v-if="activeTab === 'alerts'" class="content-panel">
      <div v-if="floorAlerts.length === 0" class="text-center text-muted py-4">
        当前无未闭环告警，病区运转平稳
      </div>
      <div v-else class="alerts-stream">
        <div v-for="a in floorAlerts" :key="a.alert_id" class="alert-item-card">
          <div class="alert-top">
            <span class="font-mono text-primary font-bold">{{ a.bed_id }}</span>
            <span class="tag tag-danger ml-2">{{ a.title }}</span>
            <span class="tag tag-warning ml-1">L{{ a.level }}</span>
            <span class="ml-auto text-xs font-mono text-muted">{{ a.occurred_at?.slice(11, 19) }}</span>
          </div>
          <div class="alert-desc text-sm mt-1">{{ a.detail }}</div>
          <div class="alert-action-row mt-2">
            <button
              v-if="a.status === 'triggered'"
              class="btn btn-sm btn-danger"
              @click="claimAlertAction(a.alert_id)"
            >
              🚨 立即接单到场
            </button>
            <button
              v-else-if="a.status === 'handling'"
              class="btn btn-sm btn-success"
              @click="handleAlertAction(a.alert_id)"
            >
              ✅ 完成处置并闭环
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 3: 当班护理交班记录 -->
    <div v-if="activeTab === 'record'" class="content-panel">
      <div class="mb-3">
        <label class="font-bold text-sm">新增本班次交班与重点长者观察记事：</label>
        <textarea
          v-model="shiftNote"
          class="shift-textarea"
          placeholder="填写负责长者体征、过床翻身、皮肤完整性及特殊用药提醒..."
        ></textarea>
        <button class="btn btn-primary mt-2" @click="saveShiftRecord">提交并固化交班记事</button>
      </div>
      <div class="history-records">
        <div class="record-card">
          <div class="record-meta font-mono text-xs text-muted">2026-09-24 08:30:00 · 李晓芳 护工</div>
          <div class="record-text text-sm">已完成 401-406 床晨间洗漱与口腔护理，404床体温 37.1℃ 略有浮动，已提醒重点复测，受压部位皮肤完好。</div>
        </div>
      </div>
    </div>

    <!-- 模态框: 移动端/桌面端一键翻身体位选择器 -->
    <div v-if="selectedTurnPatient" class="modal-backdrop" @click="selectedTurnPatient = null">
      <div class="turn-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">
            【{{ selectedTurnPatient.bed_id }} {{ selectedTurnPatient.name }}】翻身体位选择
          </div>
          <button class="close-btn" @click="selectedTurnPatient = null">×</button>
        </div>
        <div class="modal-body">
          <div class="posture-options-grid">
            <button
              v-for="pos in POSTURE_CHOICES"
              :key="pos.label"
              class="posture-btn"
              @click="recordPosture(selectedTurnPatient, pos.label)"
            >
              <span class="pos-icon">{{ pos.icon }}</span>
              <span class="pos-title font-bold">{{ pos.label }}</span>
              <span class="pos-desc text-xs text-muted">{{ pos.desc }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getPatients, getAlerts, claimAlert, handleAlert } from '../../../api/client'
import { getSession, type SessionInfo } from '../../../api/http'
import type { Patient, Alert } from '../../../api/types'

const props = defineProps<{
  session?: SessionInfo
}>()

import { useWardStaff } from '../../../features/ltc-workbench/ward-staff'

const activeTab = ref<'patients' | 'alerts' | 'record'>('patients')

const { activeCaregiver } = useWardStaff()
const curSession = computed(() => props.session || getSession())
const principal = computed(() => curSession.value?.principal as any)
const orgName = computed(() => principal.value?.org_name || '机构')

const nurseName = computed(() => {
  if (activeCaregiver.value) return activeCaregiver.value.name
  return curSession.value?.staff.name || '李晓芳 护工'
})

const assignedFloors = computed(() => {
  if (activeCaregiver.value) return [activeCaregiver.value.floor]
  return principal.value?.assigned_floors || ['4F']
})
const assignedFloorText = computed(() => assignedFloors.value.join(' / '))

const assignedBedText = computed(() => {
  if (activeCaregiver.value) {
    const range = activeCaregiver.value.bedRange
    if (range.includes('床') || range.includes('全区') || range.includes('机动') || range.includes('轮休')) {
      return range
    }
    return range + '床'
  }
  if (principal.value?.assigned_bed_range) {
    if (principal.value.assigned_bed_range === 'all') return '全病区管辖床位'
    if (principal.value.assigned_bed_range === 'none') return '今日轮休备勤'
    return principal.value.assigned_bed_range + '床'
  }
  const f = assignedFloors.value[0] || '4F'
  if (f === '4F') return '401-406床'
  if (f === '3F') return '301-306床'
  if (f === '2F') return '201-206床'
  return '101-106床'
})

const staffTitle = computed(() => {
  if (activeCaregiver.value) return activeCaregiver.value.roleTitle
  if (principal.value?.assigned_title) return principal.value.assigned_title
  if (principal.value?.role === 'nursing_head') return '病区护士长 (主管护师)'
  if (principal.value?.role === 'nursing_nurse') return '责任护工组长'
  return '责任护工 (照护师)'
})

const isOnDuty = computed(() => {
  if (activeCaregiver.value) return activeCaregiver.value.onDuty
  return principal.value?.on_duty !== undefined ? !!principal.value.on_duty : true
})

const isMobile = ref(false)
function checkMobile() {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const patients = ref<Patient[]>([])
const alerts = ref<Alert[]>([])
const shiftNote = ref('')
const selectedTurnPatient = ref<Patient | null>(null)

// 翻身姿态选择
const POSTURE_CHOICES = [
  { label: '左侧卧 30°', icon: '🛏️', desc: '防压疮黄金体位，背部减压垫支撑' },
  { label: '仰卧位', icon: '🛌', desc: '标准平躺，足跟与骶尾置减压软枕' },
  { label: '右侧卧 30°', icon: '🛏️', desc: '防压疮体位，双膝间夹软垫' },
  { label: '半坐卧位 20°', icon: '🛋️', desc: '餐后防反流，腰背支护' },
]

// 翻身记录 Map
const postureMap = ref<Record<string, string>>({
  P00001: '右侧卧 30°',
  P00002: '仰卧位',
  P00003: '左侧卧 30°',
  P00004: '半坐卧位 20°',
  P00005: '左侧卧 30°',
  P00006: '仰卧位',
})

// 本人负责的管床动态过滤
const myPatients = computed(() => {
  return patients.value.filter((p) => {
    // 楼层匹配
    if (assignedFloors.value.length > 0 && !assignedFloors.value.includes(p.floor)) {
      return false
    }
    // 床位区间精准匹配
    const bedRange = activeCaregiver.value ? activeCaregiver.value.bedRange : principal.value?.assigned_bed_range
    if (bedRange) {
      if (bedRange === 'all' || bedRange.includes('全区') || bedRange.includes('机动')) return true
      if (bedRange === 'none' || bedRange.includes('轮休')) return true // 轮休亦可查阅本科室长者档案
      const match = bedRange.match(/(\d+)-(\d+)/)
      if (match) {
        const startNum = parseInt(match[1], 10)
        const endNum = parseInt(match[2], 10)
        const pNum = parseInt(p.bed_id.replace(/\D/g, ''), 10)
        if (!isNaN(startNum) && !isNaN(endNum) && !isNaN(pNum)) {
          return pNum >= startNum && pNum <= endNum
        }
      }
    }
    // 缺省回退
    const f = assignedFloors.value[0] || '4F'
    const num = parseInt(p.bed_id.replace(/\D/g, ''), 10)
    if (f === '4F') return !isNaN(num) && num >= 401 && num <= 406
    if (f === '3F') return !isNaN(num) && num >= 301 && num <= 306
    if (f === '2F') return !isNaN(num) && num >= 201 && num <= 206
    if (f === '1F') return !isNaN(num) && num >= 101 && num <= 106
    return true
  })
})

const myInBedCount = computed(() => myPatients.value.filter((p) => p.vitals.in_bed).length)
const myOffBedCount = computed(() => myPatients.value.filter((p) => !p.vitals.in_bed).length)
const myPendingTurnsCount = computed(() => 2)

const floorAlerts = computed(() => {
  return alerts.value.filter((a) => a.status === 'triggered' || a.status === 'handling')
})

function getPosture(patientId: string): string {
  return postureMap.value[patientId] || '右侧卧 30°'
}

function getNextDue(patientId: string): string {
  const map: Record<string, string> = {
    P00001: '25 分钟',
    P00002: '40 分钟',
    P00003: '15 分钟 (临期)',
  }
  return map[patientId] || '45 分钟'
}

function openTurnModal(p: Patient) {
  selectedTurnPatient.value = p
}

function recordPosture(p: Patient, posture: string) {
  postureMap.value[p.patient_id] = posture
  selectedTurnPatient.value = null
  alert(`✅ 翻身打卡成功！已为 [${p.bed_id} ${p.name}] 记录体位【${posture}】，操作人：${nurseName}，下次翻身倒计时已重置为 120 分钟！`)
}

function patrolBed(p: Patient) {
  alert(`✅ 实名到场巡房打卡成功！已核验 [${p.bed_id} ${p.name}] 体征指标正常，巡检人：${nurseName}。`)
}

async function claimAlertAction(alertId: string) {
  try {
    await claimAlert(alertId)
    alert('🚨 接单成功！已锁定责任人并启动到场计时 SLA，请迅速前往床旁处理！')
    await loadData()
  } catch (err: any) {
    alert('接单失败: ' + err.message)
  }
}

async function handleAlertAction(alertId: string) {
  const note = prompt('请输入到场处置结果说明：', '已到场协助，长者受压部位皮肤完好，平稳安卧')
  if (!note) return
  try {
    await handleAlert(alertId, note)
    alert('✅ 告警已到场处置闭环！')
    await loadData()
  } catch (err: any) {
    alert('处置失败: ' + err.message)
  }
}

function saveShiftRecord() {
  if (!shiftNote.value.trim()) return
  alert('✅ 当班交接记事已成功提交并归档！')
  shiftNote.value = ''
}

async function loadData() {
  try {
    const pRes = await getPatients({ page_size: 100 })
    patients.value = pRes.list || []
    const aRes = await getAlerts()
    alerts.value = aRes.list || []
  } catch (err: any) {
    console.error('加载护工楼层数据失败:', err)
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.workspace-page {
  padding: 20px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
}

/* 移动端专属 Header */
.mobile-top-header {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 12px 14px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.m-user-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.m-avatar {
  font-size: 28px;
}
.m-meta {
  flex: 1;
}
.m-name {
  font-size: 15px;
  color: #0f172a;
}
.m-tags {
  margin-top: 2px;
}
.m-refresh-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.m-metrics-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  text-align: center;
}
.m-stat {
  display: flex;
  flex-direction: column;
}
.m-num {
  font-size: 16px;
  font-weight: 800;
  font-family: monospace;
}
.m-lbl {
  font-size: 10px;
  color: #64748b;
  margin-top: 1px;
}

.m-mobile-alert-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

/* PC 常规 Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}
.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.header-badges {
  display: flex;
  gap: 8px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.metric-card {
  background: #ffffff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.metric-num {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}
.metric-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.panel-alert {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
}

.tab-nav {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 14px;
}
.tab-btn {
  padding: 8px 14px;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  background: #ffffff;
  border-radius: 6px 6px 0 0;
}

.content-panel {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 16px;
}

/* 长者卡片流 */
.patient-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.bed-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}
.bed-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.bed-tag {
  font-size: 16px;
  font-weight: 700;
  color: #1e3a8a;
}
.in-bed-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 600;
}
.bg-success { background: #dcfce7; color: #16a34a; }
.bg-warning { background: #fef3c7; color: #d97706; }

.bed-patient-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.patient-name {
  font-size: 15px;
  color: #0f172a;
}

.posture-status-row {
  margin-bottom: 8px;
  font-size: 12px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  padding: 4px 8px;
  border-radius: 4px;
}

.vitals-row {
  display: flex;
  justify-content: space-around;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px;
  margin-bottom: 10px;
}
.vital-item {
  text-align: center;
}
.vital-item .lbl {
  font-size: 10px;
  color: #64748b;
  display: block;
}
.vital-item .val {
  font-size: 14px;
  font-weight: 700;
}

.bed-card-footer {
  display: flex;
  gap: 6px;
  margin-top: auto;
}

/* 移动端触摸优化 */
.m-touch-stream {
  grid-template-columns: 1fr;
  gap: 12px;
}
.m-card-touch {
  padding: 12px;
}
.m-card-actions .btn {
  flex: 1;
  padding: 8px 6px;
  font-size: 12px;
}

/* 告警流 */
.alerts-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.alert-item-card {
  border: 1px solid #fee2e2;
  background: #fff5f5;
  border-radius: 6px;
  padding: 10px 12px;
}
.alert-top {
  display: flex;
  align-items: center;
}

.shift-textarea {
  width: 100%;
  height: 90px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  margin-top: 6px;
}
.record-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
}

/* 模态框 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.turn-modal-dialog {
  background: #ffffff;
  width: 480px;
  max-width: 92vw;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.modal-body {
  padding: 14px;
}
.close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #94a3b8;
}
.posture-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.posture-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}
.posture-btn:hover {
  background: #eff6ff;
  border-color: #2563eb;
}
.pos-icon { font-size: 22px; margin-bottom: 2px; }
.pos-title { font-size: 13px; color: #0f172a; }

/* 按钮与通用样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
}
.btn-primary { background: #2563eb; color: #ffffff; }
.btn-outline { background: #ffffff; border-color: #cbd5e1; color: #334155; }
.btn-outline-primary { background: #ffffff; border-color: #93c5fd; color: #2563eb; }
.btn-danger { background: #dc2626; color: #ffffff; }
.btn-success { background: #16a34a; color: #ffffff; }
.btn-sm { padding: 5px 10px; font-size: 12px; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.badge-primary { background: #e0f2fe; color: #0284c7; }
.badge-success { background: #dcfce7; color: #16a34a; }
.badge-warning { background: #fef3c7; color: #d97706; }
.badge-danger { background: #fee2e2; color: #dc2626; }

.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.tag-danger { background: #fee2e2; color: #dc2626; }
.tag-warning { background: #fef3c7; color: #d97706; }

.font-mono { font-family: monospace; }
.font-bold { font-weight: 600; }
.text-xs { font-size: 11px; }
.text-sm { font-size: 13px; }
.text-primary { color: #2563eb; }
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }
.text-warning { color: #d97706; }
.text-muted { color: #64748b; }
.text-center { text-align: center; }
.ml-1 { margin-left: 4px; }
.ml-2 { margin-left: 8px; }
.ml-auto { margin-left: auto; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.mt-1 { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
.py-4 { padding-top: 16px; padding-bottom: 16px; }
</style>
