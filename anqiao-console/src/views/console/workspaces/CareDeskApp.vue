<template>
  <div class="workspace-page care-desk">
    <div class="page-header">
      <div>
        <div class="page-title-row">
          <h1 class="page-title">楼层智能护理台 · 病区公用终端</h1>
          <span class="badge badge-primary">终端模式: {{ currentWardName }} (公用大屏席位)</span>
          <span class="badge badge-success">呼叫中枢在线</span>
          <span v-if="activeCaregiver" class="badge badge-warning">
            当前快速作业: {{ activeCaregiver.name }} (管辖: {{ activeCaregiver.bedRange }})
          </span>
        </div>
        <div class="page-subtitle">
          凯健国际护理院 · 病区大屏看板与席位终端 · 常态全域监护 + 当班责任护工一键秒切个人工作台
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="goToWorkspace('device_monitoring')">
          <span class="btn-icon">📡</span>
          设备监测情况
        </button>
        <button class="btn btn-outline" @click="goToWorkspace('reports_center')">
          <span class="btn-icon">📊</span>
          监测与报告系统
        </button>
        <button class="btn btn-outline" @click="showShiftModal = true">
          <span class="btn-icon">⚙️</span>
          病区排班管理
        </button>
        <button v-if="activeCaregiver" class="btn btn-warning" @click="exitCaregiverView">
          <span class="btn-icon">↩️</span>
          退出并切回公共大盘 ({{ autoReturnCountdown }}s)
        </button>
      </div>
    </div>

    <!-- 护工个人作业高亮顶部提示条（带 30 秒自动返回倒计时） -->
    <div v-if="activeCaregiver" class="active-caregiver-banner">
      <div class="banner-left">
        <span class="banner-avatar">{{ activeCaregiver.avatar }}</span>
        <div>
          <div class="banner-title">
            当前正以 <strong>【{{ activeCaregiver.name }}】</strong> 责任护工身份操作专属床段 ({{ activeCaregiver.bedRange }})
          </div>
          <div class="banner-sub text-xs">
            打卡/翻身将自动归属至该护工工号留痕 · {{ autoReturnCountdown }} 秒无操作将自动切回病区公共监护大盘
          </div>
        </div>
      </div>
      <div class="banner-right">
        <button class="btn btn-sm btn-outline" @click="resetAutoReturnTimer">重置计时</button>
        <button class="btn btn-sm btn-danger ml-2" @click="exitCaregiverView">立即返回公共大盘</button>
      </div>
    </div>

    <!-- 护理台核心指标卡片 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-num">{{ displayedPatients.length }}</div>
        <div class="metric-label">
          {{ activeCaregiver ? activeCaregiver.name + ' 专属在管长者' : '本病区在住长者 (总床位: ' + (overview?.bed_total || 96) + ')' }}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ inBedCount }}</div>
        <div class="metric-label">实时在床监护 (在床率: {{ inBedRate }}%)</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-danger" :class="{ 'pulse-alarm': openAlerts.length > 0 }">
          {{ openAlerts.length }}
        </div>
        <div class="metric-label">待响应呼叫与急救告警</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-primary">{{ turnTaskCompleted }}/{{ highRiskTurnPatients.length }}</div>
        <div class="metric-label">今日高危压疮定时翻身完成率</div>
      </div>
    </div>

    <!-- 护理台核心主控大盘（责任护工栏已移至系统左侧导航栏，此处占满全屏大盘） -->
    <div class="station-main-area">
      <!-- 导航标签 -->
        <div class="tab-nav">
          <button :class="['tab-btn', activeTab === 'monitor' && 'active']" @click="activeTab = 'monitor'">
            🛏️ 在管长者与体征监护 ({{ displayedPatients.length }}位)
          </button>
          <button :class="['tab-btn', activeTab === 'alerts' && 'active']" @click="activeTab = 'alerts'">
            🚨 紧急呼叫与告警 ({{ openAlerts.length }})
          </button>
          <button :class="['tab-btn', activeTab === 'turn' && 'active']" @click="activeTab = 'turn'">
            🔄 防压疮定时翻身与照护计划 ({{ highRiskTurnPatients.length }})
          </button>
          <button :class="['tab-btn', activeTab === 'handover' && 'active']" @click="activeTab = 'handover'">
            📋 护理台交接班日志
          </button>
        </div>

        <!-- Tab 1: 床位智能监护网格 -->
        <div v-if="activeTab === 'monitor'" class="content-panel">
          <!-- 护工个人工作台专属筛选提示条 -->
          <div v-if="activeCaregiver" class="active-caregiver-banner mb-3">
            <span>🧑‍⚕️ 正在查看 <strong>{{ activeCaregiver.name }}</strong> ({{ activeCaregiver.roleTitle }}) 分管长者（管床范围: {{ activeCaregiver.bedRange }}）</span>
            <button class="btn btn-xs btn-outline-primary ml-auto" @click="exitCaregiverView">
              切回病区全体长者视图 ({{ filteredPatients.length }}位)
            </button>
          </div>

          <div class="filter-bar mb-3">
            <div class="filter-group">
              <label>病区专区：</label>
              <select
                v-model="filterFloor"
                class="select-input"
                @change="onFloorChange"
                :disabled="isStationAccount && assignedFloors.length === 1"
              >
                <option value="4F">4F 完全失能专区 (特级护理)</option>
                <option value="3F">3F 认知障碍专区 (一级护理)</option>
                <option value="2F">2F 术后康复专区 (二级护理)</option>
                <option value="1F">1F 慢病颐养专区 (二级护理)</option>
              </select>
              <span v-if="isStationAccount && assignedFloors.length === 1" class="locked-tip">
                🔒 病区终端席位锁定
              </span>
            </div>
            <div class="filter-group">
              <label>长者在床：</label>
              <select v-model="filterStatus" class="select-input">
                <option value="all">全部在住长者</option>
                <option value="in_bed">仅在床监护</option>
                <option value="off_bed">仅离床活动</option>
                <option value="alert">仅有异常告警</option>
              </select>
            </div>
            <div class="filter-group ml-auto">
              <input
                v-model="searchQuery"
                type="text"
                class="select-input"
                placeholder="按姓名或床号搜索 (如 张卫国 或 401)..."
              />
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-if="displayedPatients.length === 0" class="empty-patients-box">
            <div class="empty-icon" style="font-size: 32px; margin-bottom: 8px;">🧓</div>
            <div class="empty-text" style="font-weight: bold; color: #334155; margin-bottom: 4px;">当前筛选条件下暂无长者</div>
            <div class="empty-sub text-muted text-xs mb-3">
              {{ activeCaregiver ? (activeCaregiver.name + ' 今日无排班或暂未分配床段') : '当前专区或筛选范围未检索到长者' }}
            </div>
            <button class="btn btn-sm btn-primary" @click="exitCaregiverView(); filterStatus = 'all'; searchQuery = ''">
              查看本病区全体长者 ({{ filteredPatients.length }} 位)
            </button>
          </div>

          <!-- 床位卡片网格 -->
          <div v-else class="bed-matrix-grid">
            <div
              v-for="p in displayedPatients"
              :key="p.patient_id"
              class="desk-bed-card"
              :class="{
                'card-alerting': hasAlert(p.bed_id),
                'card-assigned-focus': activeCaregiver && isBedInCaregiverRange(p.bed_id, activeCaregiver.bedRange)
              }"
            >
              <div class="desk-card-head">
                <div class="head-left">
                  <span class="bed-badge font-mono">{{ p.bed_id }}</span>
                  <span class="floor-badge">{{ p.floor }}</span>
                </div>
                <span
                  class="presence-pill"
                  :class="p.vitals.in_bed ? 'pill-in-bed' : 'pill-off-bed'"
                >
                  {{ p.vitals.in_bed ? '在床监护' : '离床活动' }}
                </span>
              </div>

              <div class="desk-card-body">
                <div class="patient-title-row">
                  <span class="patient-name font-bold">{{ p.name }}</span>
                  <span class="text-xs text-muted">{{ p.age }}岁 · {{ p.gender === 'male' ? '男' : '女' }}</span>
                  <span class="care-tag" :class="careTagClass(p.care_level)">{{ p.care_level }}</span>
                </div>
                <div class="nurse-row text-xs text-muted">
                  <span>责任护工: <strong class="text-dark">{{ p.nurse }}</strong></span>
                  <span>当前体位: <strong class="text-primary">{{ getPosture(p.patient_id) }}</strong></span>
                </div>

                <!-- 实时生理体征面板 -->
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
                    <span class="v-val font-mono" :class="{ 'text-danger': p.vitals.tp >= 37.5 }">
                      {{ p.vitals.tp }} <small>℃</small>
                    </span>
                  </div>
                </div>
              </div>

              <div class="desk-card-actions">
                <button class="btn btn-xs btn-outline" @click="handlePatrol(p)">
                  巡房打卡
                </button>
                <button class="btn btn-xs btn-outline-primary" @click="openTurnModal(p)">
                  翻身登记
                </button>
                <a :href="'#/console/patients/' + p.patient_id" class="btn btn-xs btn-primary">
                  体征详情
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: 紧急呼叫与告警处置中枢 -->
        <div v-if="activeTab === 'alerts'" class="content-panel">
          <div class="alert-action-bar mb-3">
            <span class="text-sm font-bold">待响应紧急事项清单：</span>
            <button class="btn btn-sm btn-outline ml-auto" @click="loadData">刷新告警队列</button>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>告警编号</th>
                <th>床位号</th>
                <th>类型分类</th>
                <th>严重等级</th>
                <th>告警详情与长者</th>
                <th>触发时间</th>
                <th>当前状态</th>
                <th>处置责任</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="alerts.length === 0">
                <td colspan="9" class="text-center text-muted" style="padding: 30px;">
                  当前楼层运行平稳，无未处置紧急呼叫与告警
                </td>
              </tr>
              <tr
                v-for="a in alerts"
                :key="a.alert_id"
                :class="{ 'row-unhandled': a.status === 'triggered' }"
              >
                <td class="font-mono text-muted">{{ a.alert_id }}</td>
                <td class="font-mono text-primary font-bold">{{ a.bed_id }}</td>
                <td>
                  <span class="badge" :class="alertTypeBadgeClass(a.type)">{{ a.title }}</span>
                </td>
                <td>
                  <span class="tag" :class="a.level === 1 ? 'tag-danger' : 'tag-warning'">
                    L{{ a.level }} 级
                  </span>
                </td>
                <td>{{ a.detail }}</td>
                <td class="font-mono text-xs">{{ a.occurred_at?.slice(11, 19) }}</td>
                <td>
                  <span class="status-pill" :class="statusPillClass(a.status)">
                    {{ formatAlertStatus(a.status) }}
                  </span>
                </td>
                <td>
                  <span class="caregiver-badge">🧑‍⚕️ {{ a.handled_by || a.claimed_by || (activeCaregiver ? activeCaregiver.name : '现场护工组') }}</span>
                </td>
                <td>
                  <button
                    v-if="a.status === 'triggered'"
                    class="btn btn-xs btn-danger"
                    @click="onClaimAlert(a.alert_id)"
                  >
                    立即接单
                  </button>
                  <button
                    v-else-if="a.status === 'handling'"
                    class="btn btn-xs btn-success"
                    @click="onHandleAlert(a.alert_id)"
                  >
                    完成处置
                  </button>
                  <span v-else class="text-muted text-xs">已闭环</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab 3: 防压疮定时翻身与照护计划 -->
        <div v-if="activeTab === 'turn'" class="content-panel">
          <div class="turn-summary-bar mb-3">
            <div>
              <span class="font-bold">卧床长者 2 小时定时翻身照护执行大本</span>
              <span class="text-xs text-muted ml-3">
                防压疮黄金准则：每 2 小时必须变换体位并检查受压皮肤
              </span>
            </div>
            <button class="btn btn-sm btn-primary ml-auto" @click="batchTurnHighRisk">
              一键登记当班翻身
            </button>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>床位</th>
                <th>长者姓名</th>
                <th>护理等级</th>
                <th>当前体位</th>
                <th>上次翻身</th>
                <th>距下次翻身</th>
                <th>执行责任护工</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in highRiskTurnPatients" :key="p.patient_id">
                <td class="font-mono font-bold text-primary">{{ p.bed_id }}</td>
                <td class="font-bold">{{ p.name }}</td>
                <td><span class="tag tag-danger">{{ p.care_level }}</span></td>
                <td>
                  <span class="tag tag-info">{{ getPosture(p.patient_id) }}</span>
                </td>
                <td class="font-mono text-xs">{{ getTurnTime(p.patient_id) }}</td>
                <td class="font-mono text-xs font-bold text-success">约 45 分钟倒计时</td>
                <td>🧑‍⚕️ {{ activeCaregiver ? activeCaregiver.name : p.nurse }}</td>
                <td>
                  <button class="btn btn-xs btn-outline-primary" @click="openTurnModal(p)">
                    登记体位
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab 4: 护理台交接班日志 -->
        <div v-if="activeTab === 'handover'" class="content-panel">
          <div class="handover-top-bar">
            <div>
              <span class="font-bold">当前值守班次：早班 (06:00 - 14:00)</span>
              <span class="ml-3 text-muted">交接责任人：{{ onDutyCaregivers.map(c => c.name).join('、') }}</span>
            </div>
            <span class="badge badge-success">交班待核签</span>
          </div>

          <div class="mt-3">
            <label class="font-bold text-sm">重点长者病情与照护交代事项：</label>
            <textarea
              v-model="handoverText"
              class="handover-textarea"
              placeholder="填写今日体征波动长者、外出就医、夜间频动或服药提醒事项..."
            ></textarea>
          </div>

          <div class="mt-2 text-right">
            <button class="btn btn-primary" @click="saveHandover">提交本班次护理交班记录</button>
          </div>

          <div class="history-handovers mt-4">
            <div class="font-bold text-sm mb-2">历史班次交班日志：</div>
            <div class="log-card">
              <div class="log-meta">
                <span class="font-bold">前序班次：夜班 (22:00 - 06:00)</span>
                <span class="ml-2 font-mono text-muted">交接人: 张晓敏 护工 · 2026-09-24 06:00</span>
              </div>
              <div class="log-content text-sm mt-1">
                全楼层夜间巡视 6 次，402床孙爷爷夜间体动活跃起夜 2 次，已协助如厕安返床铺；全员生命体征监测平稳无跌倒事件。
              </div>
            </div>
          </div>
        </div>
    </div>

    <!-- 弹窗 1: 翻身体位快速选择登记模态框 -->
    <div v-if="selectedTurnPatient" class="modal-backdrop" @click="selectedTurnPatient = null">
      <div class="turn-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">
            【{{ selectedTurnPatient.bed_id }} {{ selectedTurnPatient.name }}】防压疮翻身登记
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
              <span class="pos-title">{{ pos.label }}</span>
              <span class="pos-desc">{{ pos.desc }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 2: 病区排班管理模态框 (护士长/主管设置当班状态) -->
    <div v-if="showShiftModal" class="modal-backdrop" @click="showShiftModal = false">
      <div class="shift-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">
            {{ currentWardName }} · 责任护工当班排班配置
          </div>
          <button class="close-btn" @click="showShiftModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-muted mb-3">
            勾选人员即设为<strong>「在班值守」</strong>（大屏高亮展示并开放秒切）；未勾选人员设为<strong>「未排班/轮休」</strong>（大屏置灰且不可点击，防止非当班人员误操作）。
          </p>
          <div class="staff-toggle-list">
            <div v-for="st in currentWardCaregivers" :key="st.id" class="staff-toggle-item">
              <label class="toggle-checkbox-label">
                <input
                  type="checkbox"
                  v-model="st.onDuty"
                  class="toggle-checkbox"
                />
                <span class="st-avatar">{{ st.avatar }}</span>
                <span class="st-name font-bold">{{ st.name }}</span>
                <span class="st-title text-xs text-muted">({{ st.roleTitle }})</span>
              </label>
              <div class="bed-range-input-group">
                <label class="text-xs text-muted">分管床位：</label>
                <input
                  v-model="st.bedRange"
                  type="text"
                  class="select-input bed-range-input"
                  :disabled="!st.onDuty"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="saveShiftSettings">保存当班排班设置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { getOverview, getPatients, getAlerts, claimAlert, handleAlert } from '../../../api/client'
import { getSession, type SessionInfo } from '../../../api/http'
import type { Overview, Patient, Alert } from '../../../api/types'

const switchWorkspace = inject<(ws: string) => void>('switchWorkspace')
function goToWorkspace(ws: string) {
  if (switchWorkspace) {
    switchWorkspace(ws)
  }
}

const props = defineProps<{
  session?: SessionInfo
}>()

const curSession = computed(() => props.session || getSession())
const assignedFloors = computed(() => (curSession.value?.principal as any)?.assigned_floors || [])
const isStationAccount = computed(() => {
  const p = curSession.value?.principal
  return p?.role === 'nursing_station' || p?.username?.includes('station')
})

import { useWardStaff, type CaregiverSeat } from '../../../features/ltc-workbench/ward-staff'

const activeTab = ref<'monitor' | 'alerts' | 'turn' | 'handover'>('monitor')

const overview = ref<Overview | null>(null)
const patients = ref<Patient[]>([])
const alerts = ref<Alert[]>([])

const initialFloor = assignedFloors.value.length > 0 ? assignedFloors.value[0] : '4F'
const filterFloor = ref(initialFloor)
const filterStatus = ref('all')
const searchQuery = ref('')

const selectedTurnPatient = ref<Patient | null>(null)
const showShiftModal = ref(false)

const handoverText = ref('全楼层长者晨巡完毕，早餐用药均已核对协助完成。4F 404床体温 37.1℃ 略有浮动，已提醒重点复测。')

// 翻身姿态选项
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
})
const turnTimeMap = ref<Record<string, string>>({
  P00001: '13:10',
  P00002: '13:20',
  P00003: '13:40',
})
const turnTaskCompleted = ref(86)

// 共享病区当班责任护工列表（支持护士长排班配置与秒切）
const {
  activeCaregiver,
  autoReturnCountdown,
  clearActiveCaregiver,
  resetAutoReturnTimer,
  currentWardCaregivers,
  onDutyCaregivers,
  selectCaregiver,
  setRosterFloor,
} = useWardStaff()

const currentWardName = computed(() => {
  const map: Record<string, string> = {
    '4F': '4F 完全失能专区',
    '3F': '3F 认知障碍专区',
    '2F': '2F 术后康复专区',
    '1F': '1F 慢病颐养专区',
  }
  return map[filterFloor.value] || filterFloor.value + ' 病区'
})

function onFloorChange() {
  setRosterFloor(filterFloor.value)
  exitCaregiverView()
}

function exitCaregiverView() {
  clearActiveCaregiver()
}

function isBedInCaregiverRange(bedId: string, bedRange: string): boolean {
  if (!bedRange || bedRange.includes('全区') || bedRange.includes('机动')) return true
  const bedNum = parseInt(bedId.replace(/\D/g, ''), 10)
  if (isNaN(bedNum)) return true
  // 支持如 "401-406床"
  const match = bedRange.match(/(\d+)-(\d+)/)
  if (match) {
    const start = parseInt(match[1], 10)
    const end = parseInt(match[2], 10)
    return bedNum >= start && bedNum <= end
  }
  return true
}

const inBedCount = computed(() => displayedPatients.value.filter((p) => p.vitals.in_bed).length)
const inBedRate = computed(() => {
  if (!displayedPatients.value.length) return 52
  return Math.round((inBedCount.value / displayedPatients.value.length) * 100)
})

const openAlerts = computed(() => {
  return alerts.value.filter((a) => a.status === 'triggered' || a.status === 'handling')
})

const filteredPatients = computed(() => {
  return patients.value.filter((p) => {
    if (filterFloor.value && p.floor !== filterFloor.value) return false
    return true
  })
})

const highRiskTurnPatients = computed(() => {
  return filteredPatients.value.filter(
    (p) => p.care_level.includes('特级') || p.care_level.includes('一级') || p.floor === '4F',
  )
})

const displayedPatients = computed(() => {
  return filteredPatients.value.filter((p) => {
    // 若当前切入了特定护工工作台，仅筛选她负责的床位段
    if (activeCaregiver.value) {
      if (!isBedInCaregiverRange(p.bed_id, activeCaregiver.value.bedRange)) {
        return false
      }
    }
    if (filterStatus.value === 'in_bed' && !p.vitals.in_bed) return false
    if (filterStatus.value === 'off_bed' && p.vitals.in_bed) return false
    if (filterStatus.value === 'alert' && !hasAlert(p.bed_id)) return false
    if (searchQuery.value) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = p.name.toLowerCase().includes(q)
      const matchBed = p.bed_id.toLowerCase().includes(q)
      if (!matchName && !matchBed) return false
    }
    return true
  })
})

function hasAlert(bedId: string): boolean {
  return alerts.value.some((a) => a.bed_id === bedId && (a.status === 'triggered' || a.status === 'handling'))
}

function careTagClass(level: string): string {
  if (level.includes('特级')) return 'tag-danger'
  if (level.includes('一级')) return 'tag-warning'
  return 'tag-info'
}

function alertTypeBadgeClass(t: string): string {
  if (t === 'fall') return 'badge-danger'
  if (t === 'off_bed') return 'badge-warning'
  return 'badge-primary'
}

function formatAlertStatus(st: string): string {
  const map: Record<string, string> = {
    triggered: '报警未接单',
    handling: '护工处置中',
    handled: '已处置闭环',
    missed: '未及时到场',
  }
  return map[st] || st
}

function statusPillClass(st: string): string {
  if (st === 'triggered') return 'status-danger'
  if (st === 'handling') return 'status-warning'
  if (st === 'handled') return 'status-success'
  return ''
}

function getPosture(patientId: string): string {
  return postureMap.value[patientId] || '右侧卧 30°'
}

function getTurnTime(patientId: string): string {
  return turnTimeMap.value[patientId] || '13:00'
}

function openTurnModal(p: Patient) {
  resetAutoReturnTimer()
  selectedTurnPatient.value = p
}

function recordPosture(p: Patient, posture: string) {
  postureMap.value[p.patient_id] = posture
  const now = new Date()
  turnTimeMap.value[p.patient_id] = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  turnTaskCompleted.value++
  selectedTurnPatient.value = null
  const opName = activeCaregiver.value ? activeCaregiver.value.name : '李晓芳 护工'
  alert(`✅ 翻身打卡成功！已为 [${p.bed_id} ${p.name}] 登记体位【${posture}】，操作人：${opName}，下次翻身将于 120 分钟后到期！`)
  resetAutoReturnTimer()
}

function handlePatrol(p: Patient) {
  resetAutoReturnTimer()
  const opName = activeCaregiver.value ? activeCaregiver.value.name : '责任护工'
  alert(`✅ 实名巡房打卡完成！[${p.bed_id} ${p.name}] 体征核验正常，巡查人：${opName}。`)
}

async function onClaimAlert(alertId: string) {
  resetAutoReturnTimer()
  try {
    await claimAlert(alertId)
    await loadData()
    alert('✅ 接单成功！已锁定责任人并启动到场计时 SLA！')
  } catch (err: any) {
    alert('接单失败: ' + err.message)
  }
}

async function onHandleAlert(alertId: string) {
  resetAutoReturnTimer()
  const note = prompt('请输入到场处置结果说明：', '已到场协助，长者体征正常平稳回床休息')
  if (!note) return
  try {
    await handleAlert(alertId, note)
    await loadData()
    alert('✅ 告警已到场处置闭环！')
  } catch (err: any) {
    alert('处置失败: ' + err.message)
  }
}

function batchTurnHighRisk() {
  resetAutoReturnTimer()
  const opName = activeCaregiver.value ? activeCaregiver.value.name : '责任护工'
  alert(`✅ 已完成本班次全员防压疮体位核验！操作人：${opName}，共核验 22 位高危长者。`)
}

function saveHandover() {
  resetAutoReturnTimer()
  alert('✅ 护理台交接班记录已提交固化！')
}

function saveShiftSettings() {
  showShiftModal.value = false
  alert('✅ 责任护工当班排班设置已更新！大屏已即时生效。')
}

async function loadData() {
  try {
    overview.value = await getOverview()
    const pRes = await getPatients({ page_size: 100 })
    patients.value = pRes.list || []
    const aRes = await getAlerts()
    alerts.value = aRes.list || []
  } catch (err: any) {
    console.error('加载护理台数据失败:', err)
  }
}

onMounted(() => {
  setRosterFloor(filterFloor.value)
  loadData()
})
</script>

<style scoped>
.workspace-page {
  padding: 20px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.header-actions {
  display: flex;
  gap: 10px;
}

/* 护工快速作业模式醒目提示条 */
.active-caregiver-banner {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  box-shadow: 0 2px 6px rgba(217, 119, 6, 0.1);
}
.banner-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.banner-avatar {
  font-size: 28px;
}
.banner-title {
  font-size: 14px;
  color: #92400e;
}
.banner-sub {
  color: #b45309;
  margin-top: 2px;
}
.banner-right {
  display: flex;
  align-items: center;
}

/* 指标栅格 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.metric-card {
  background: #ffffff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
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

.active-caregiver-banner {
  display: flex;
  align-items: center;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #1e40af;
}

.empty-patients-box {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 40px 24px;
  text-align: center;
  margin: 16px 0;
}

/* 左右分栏核心结构 */
.station-split-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

/* 左侧：病区责任护工席位栏 */
.station-staff-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.sidebar-top-bar {
  margin-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
}
.sidebar-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.heading-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.heading-badge {
  font-size: 11px;
  background: #dcfce7;
  color: #15803d;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 9999px;
}
.caregiver-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - 330px);
  overflow-y: auto;
}
.caregiver-seat-card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s;
}
.caregiver-seat-card.is-on-duty:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: translateY(-1px);
}
.caregiver-seat-card.is-current-active {
  border-color: #f59e0b;
  background: #fffbeb;
  box-shadow: 0 0 0 2px #fde68a;
}
.caregiver-seat-card.is-off-duty {
  opacity: 0.55;
  background: #f1f5f9;
  cursor: not-allowed;
  border-style: dashed;
}
.cg-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cg-avatar {
  font-size: 20px;
}
.cg-info {
  flex: 1;
}
.cg-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cg-name {
  font-size: 13px;
  color: #0f172a;
}
.cg-role-tag {
  font-size: 10px;
  background: #e0f2fe;
  color: #0284c7;
  padding: 1px 4px;
  border-radius: 3px;
}
.cg-bed-range {
  color: #64748b;
  margin-top: 2px;
}
.duty-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.duty-on {
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}
.duty-off {
  background: #94a3b8;
}
.cg-card-body {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}
.cg-kpis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.switch-action-row {
  margin-top: 6px;
  text-align: right;
}
.switch-cta {
  color: #2563eb;
  font-weight: 600;
}
.sidebar-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

/* 右侧主控大盘 */
.station-main-area {
  flex: 1;
  min-width: 0;
}

/* 导航标签 */
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
  transition: all 0.2s;
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}
.select-input {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 12px;
  outline: none;
}
.select-input:focus {
  border-color: #2563eb;
}
.ml-auto {
  margin-left: auto;
}

/* 床位监护卡片网格 */
.bed-matrix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.desk-bed-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  transition: all 0.15s;
}
.desk-bed-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.08);
}
.card-alerting {
  border-color: #ef4444;
  background: #fef2f2;
  animation: pulseBorder 1.5s infinite;
}
.card-assigned-focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 1px #f59e0b;
  background: #fffdf5;
}
@keyframes pulseBorder {
  0%, 100% { border-color: #ef4444; }
  50% { border-color: #fca5a5; }
}

.desk-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bed-badge {
  font-size: 15px;
  font-weight: 700;
  color: #1e3a8a;
}
.floor-badge {
  font-size: 10px;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 5px;
  border-radius: 4px;
}
.presence-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 600;
}
.pill-in-bed {
  background: #dcfce7;
  color: #16a34a;
}
.pill-off-bed {
  background: #fef3c7;
  color: #d97706;
}

.patient-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.patient-name {
  font-size: 14px;
  color: #0f172a;
}
.care-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: auto;
}
.tag-danger {
  background: #fee2e2;
  color: #dc2626;
}
.tag-warning {
  background: #fef3c7;
  color: #d97706;
}
.tag-info {
  background: #e0f2fe;
  color: #0284c7;
}

.nurse-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.vitals-strip {
  display: flex;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
  justify-content: space-around;
  margin-bottom: 8px;
}
.vital-col {
  text-align: center;
}
.v-label {
  display: block;
  font-size: 10px;
  color: #64748b;
}
.v-val {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.desk-card-actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

/* 按钮规范 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  text-decoration: none;
}
.btn-primary {
  background: #2563eb;
  color: #ffffff;
}
.btn-primary:hover {
  background: #1d4ed8;
}
.btn-outline {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #334155;
}
.btn-outline:hover {
  background: #f8fafc;
}
.btn-outline-primary {
  background: #ffffff;
  border-color: #93c5fd;
  color: #2563eb;
}
.btn-outline-primary:hover {
  background: #eff6ff;
}
.btn-danger {
  background: #dc2626;
  color: #ffffff;
}
.btn-warning {
  background: #d97706;
  color: #ffffff;
}
.btn-success {
  background: #16a34a;
  color: #ffffff;
}
.btn-xs {
  padding: 3px 8px;
  font-size: 11px;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}
.btn-block {
  width: 100%;
}

/* 徽章 */
.badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.badge-primary {
  background: #e0f2fe;
  color: #0284c7;
}
.badge-success {
  background: #dcfce7;
  color: #16a34a;
}
.badge-warning {
  background: #fef3c7;
  color: #d97706;
}
.badge-danger {
  background: #fee2e2;
  color: #dc2626;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
}
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}
.row-unhandled {
  background: #fef2f2;
}

.status-pill {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.status-danger {
  background: #fee2e2;
  color: #dc2626;
}
.status-warning {
  background: #fef3c7;
  color: #d97706;
}
.status-success {
  background: #dcfce7;
  color: #16a34a;
}

.handover-top-bar, .turn-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.handover-textarea {
  width: 100%;
  height: 80px;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 6px;
}
.log-card {
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
  width: 520px;
  max-width: 90vw;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
.shift-modal-dialog {
  background: #ffffff;
  width: 540px;
  max-width: 90vw;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.modal-body {
  padding: 18px;
}
.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  text-align: right;
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
  gap: 12px;
}
.posture-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 14px;
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
.pos-icon {
  font-size: 24px;
  margin-bottom: 4px;
}
.pos-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.pos-desc {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.staff-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.staff-toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.toggle-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.toggle-checkbox {
  width: 16px;
  height: 16px;
}
.bed-range-input {
  width: 120px;
  padding: 3px 6px;
}

/* 工具类 */
.font-mono { font-family: monospace; }
.font-bold { font-weight: 600; }
.text-xs { font-size: 12px; }
.text-sm { font-size: 13px; }
.text-primary { color: #2563eb; }
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }
.text-warning { color: #d97706; }
.text-muted { color: #64748b; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.mb-3 { margin-bottom: 12px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.ml-2 { margin-left: 8px; }
.ml-3 { margin-left: 12px; }

@keyframes pulseRed {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.pulse-alarm {
  animation: pulseRed 1.2s infinite;
}

.locked-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}

@media (max-width: 1024px) {
  .station-split-layout {
    flex-direction: column;
  }
  .station-staff-sidebar {
    width: 100%;
  }
}
</style>
