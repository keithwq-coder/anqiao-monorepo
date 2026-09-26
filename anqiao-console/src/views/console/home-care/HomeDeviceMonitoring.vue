<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHomeCareStore } from '../../../features/home-care/home-care-store'
import EmergencyDispatchModal from '../../../features/home-care/components/EmergencyDispatchModal.vue'

const store = useHomeCareStore()

const currentDeviceTab = ref<'all' | 'radar' | 'sleep' | 'sos' | 'safety'>('all')
const selectedArea = ref<'all' | 'canglang' | 'shuangta' | 'sanxiang'>('all')
const searchDeviceQuery = ref('')
const isDiagnosing = ref(false)
const diagnosticReport = ref('')

const totalHouseholds = computed(() => store.elders.value.length)
const totalRadars = computed(() => store.elders.value.length) // 每户标配防跌倒雷达
const totalSleepPads = computed(() => store.elders.value.filter((e) => !!e.devices.sleep_pad).length)
const totalSosButtons = computed(() => store.elders.value.length) // 每户标配 SOS

const fallAlertElders = computed(() => {
  return store.elders.value.filter((e) => e.devices.radar_bathroom.fall_alert)
})

const leaveBedAlertElders = computed(() => {
  return store.elders.value.filter((e) => e.devices.sleep_pad && !e.devices.sleep_pad.in_bed && e.devices.sleep_pad.leave_bed_minutes > 30)
})

const sosAlertElders = computed(() => {
  return store.elders.value.filter((e) => e.devices.sos_button.alarm_active)
})

function handleViewElder(elderId: string) {
  store.openElderlyDetail(elderId)
}

function handleRunDiagnostics() {
  isDiagnosing.value = true
  diagnosticReport.value = ''
  setTimeout(() => {
    isDiagnosing.value = false
    diagnosticReport.value = '全网 72 户安居感知物联基站巡检正常：72 台 60GHz 毫米波雷达在线率 100%，48 台压电体征监测垫零丢包，72 枚 LoRa SOS 电池均值 92%，3 台门磁/燃气探头巡检正常。'
  }, 700)
}

const filteredDeviceElders = computed(() => {
  let list = store.elders.value

  // 片区筛选
  if (selectedArea.value !== 'all') {
    list = list.filter((e) => e.area_key === selectedArea.value)
  }

  // 类别标签筛选
  if (currentDeviceTab.value === 'sleep') {
    list = list.filter((e) => !!e.devices.sleep_pad)
  } else if (currentDeviceTab.value === 'safety') {
    list = list.filter((e) => !!e.devices.door_sensor || !!e.devices.gas_sensor)
  } else if (currentDeviceTab.value === 'radar') {
    // 优先排查有跌倒或有人活动的家庭
    list = [...list].sort((a, b) => {
      const aScore = (a.devices.radar_bathroom.fall_alert ? 10 : 0) + (a.devices.radar_bathroom.presence ? 1 : 0)
      const bScore = (b.devices.radar_bathroom.fall_alert ? 10 : 0) + (b.devices.radar_bathroom.presence ? 1 : 0)
      return bScore - aScore
    })
  } else if (currentDeviceTab.value === 'sos') {
    list = [...list].sort((a, b) => (b.devices.sos_button.alarm_active ? 10 : 0) - (a.devices.sos_button.alarm_active ? 10 : 0))
  }

  // 模糊搜索
  const q = searchDeviceQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.home_address.toLowerCase().includes(q) ||
      e.devices.radar_bathroom.device_id.toLowerCase().includes(q) ||
      (e.devices.sleep_pad && e.devices.sleep_pad.device_id.toLowerCase().includes(q)) ||
      e.devices.sos_button.device_id.toLowerCase().includes(q),
    )
  }

  return list
})
</script>

<template>
  <div class="home-device-monitoring-view">
    <!-- 顶部全区设备大盘统计 -->
    <div class="device-kpi-bar">
      <div class="kpi-brand">
        <span class="sensor-icon">📡</span>
        <div>
          <h3>居家安居设备 · 智能感知大盘</h3>
          <p>演示·暖阳居家养老服务中心（模拟机构） · 72 户安居适老化物联终端在网运行</p>
        </div>
      </div>

      <div class="kpi-group">
        <div class="dev-stat-card">
          <span class="label">在管适老化家庭</span>
          <span class="val">{{ totalHouseholds }} <small>户</small></span>
        </div>
        <div class="dev-stat-card">
          <span class="label">卫浴防跌倒雷达</span>
          <span class="val cyan">{{ totalRadars }} <small>台 (100% 在线)</small></span>
        </div>
        <div class="dev-stat-card">
          <span class="label">睡眠体征监测垫</span>
          <span class="val emerald">{{ totalSleepPads }} <small>台</small></span>
        </div>
        <div class="dev-stat-card">
          <span class="label">一键 SOS 呼叫纽</span>
          <span class="val purple">{{ totalSosButtons }} <small>枚</small></span>
        </div>
      </div>

      <div class="kpi-right-actions">
        <button class="btn-diagnostics" :disabled="isDiagnosing" @click="handleRunDiagnostics" type="button">
          {{ isDiagnosing ? '⚡ 正在巡检全网传感器链路...' : '⚡ 一键远程全网设备体检 / 遥测诊断' }}
        </button>
      </div>
    </div>

    <!-- 诊断结果通知条 -->
    <div v-if="diagnosticReport" class="diag-report-bar">
      <span>✅ {{ diagnosticReport }}</span>
      <button class="btn-close-diag" @click="diagnosticReport = ''">✕</button>
    </div>

    <!-- 实时告警处置工作台（跌倒、离床超时、SOS求助） -->
    <div v-if="fallAlertElders.length || leaveBedAlertElders.length || sosAlertElders.length" class="active-alerts-panel">
      <div class="alerts-header">
        <h4>🚨 实时安居异动与急救警报 (需助老员立即到场排查)</h4>
        <span class="alert-count-pill">{{ fallAlertElders.length + leaveBedAlertElders.length + sosAlertElders.length }} 起异动</span>
      </div>

      <div class="alert-cards-row">
        <!-- 跌倒告警 -->
        <div v-for="e in fallAlertElders" :key="e.elderly_id" class="alert-emergency-card fall">
          <div class="alert-top">
            <span class="alert-tag">⚠️ 毫米波跌倒报警</span>
            <span class="alert-time">今日 07:42 触发</span>
          </div>
          <div class="alert-elder-info">
            <strong>{{ e.name }} ({{ e.age }}岁)</strong>
            <span>📍 {{ e.area_name }} · {{ e.home_address }}</span>
          </div>
          <div class="alert-detail-text">
            卫浴间 60GHz 雷达检测到人体急速下坠且卧地静止，姿态突变已超 10 分钟。
          </div>
          <div class="alert-actions">
            <span class="caregiver-handling">调度机动助老员：<strong>黄建国 (前往途中)</strong></span>
            <div class="alert-action-btns">
              <button class="btn-dispatch-call" @click="store.openEmergencyModal()" type="button">
                ⚡ 12349 调度出警
              </button>
              <button class="btn-check-elder" @click="handleViewElder(e.elderly_id)" type="button">
                长者全景
              </button>
            </div>
          </div>
        </div>

        <!-- 离床超时告警 -->
        <div v-for="e in leaveBedAlertElders" :key="e.elderly_id" class="alert-emergency-card leave-bed">
          <div class="alert-top">
            <span class="alert-tag">🌙 夜间离床超时</span>
            <span class="alert-time">今日 04:20 触发</span>
          </div>
          <div class="alert-elder-info">
            <strong>{{ e.name }} ({{ e.age }}岁)</strong>
            <span>📍 {{ e.area_name }} · {{ e.home_address }}</span>
          </div>
          <div class="alert-detail-text">
            智能睡眠垫检测离床已超 <strong>{{ e.devices.sleep_pad?.leave_bed_minutes }}</strong> 分钟未归，门磁伴随开启。
          </div>
          <div class="alert-actions">
            <span class="caregiver-handling">责任照护师：<strong>陈秀英 (现场照料中)</strong></span>
            <button class="btn-check-elder" @click="handleViewElder(e.elderly_id)" type="button">
              查看长者全景
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 设备分类标签切换 -->
    <div class="dev-tabs-bar">
      <div class="tabs-list">
        <button
          :class="['dev-tab-btn', currentDeviceTab === 'all' && 'active']"
          @click="currentDeviceTab = 'all'"
        >
          全量家庭设备终端 ({{ totalHouseholds }}户)
        </button>
        <button
          :class="['dev-tab-btn', currentDeviceTab === 'radar' && 'active']"
          @click="currentDeviceTab = 'radar'"
        >
          卫生间毫米波防跌倒雷达
        </button>
        <button
          :class="['dev-tab-btn', currentDeviceTab === 'sleep' && 'active']"
          @click="currentDeviceTab = 'sleep'"
        >
          智能睡眠体征监测垫 ({{ totalSleepPads }}户)
        </button>
        <button
          :class="['dev-tab-btn', currentDeviceTab === 'sos' && 'active']"
          @click="currentDeviceTab = 'sos'"
        >
          一键 SOS 呼叫纽
        </button>
        <button
          :class="['dev-tab-btn', currentDeviceTab === 'safety' && 'active']"
          @click="currentDeviceTab = 'safety'"
        >
          燃气泄漏 / 门磁传感器
        </button>
      </div>
    </div>

    <!-- 快捷片区筛选与设备搜索栏 -->
    <div class="device-subfilter-bar">
      <div class="area-chips-group">
        <button
          :class="['area-chip-btn', selectedArea === 'all' && 'active']"
          @click="selectedArea = 'all'"
        >
          全部片区 (72户)
        </button>
        <button
          :class="['area-chip-btn', selectedArea === 'canglang' && 'active']"
          @click="selectedArea = 'canglang'"
        >
          沧浪片区 (26户)
        </button>
        <button
          :class="['area-chip-btn', selectedArea === 'shuangta' && 'active']"
          @click="selectedArea = 'shuangta'"
        >
          双塔片区 (26户)
        </button>
        <button
          :class="['area-chip-btn', selectedArea === 'sanxiang' && 'active']"
          @click="selectedArea = 'sanxiang'"
        >
          三香片区 (20户)
        </button>
      </div>

      <div class="search-wrap">
        <input
          v-model="searchDeviceQuery"
          class="device-search-input"
          placeholder="🔍 搜索长者姓名、门牌地址或设备SN号..."
        />
        <span class="filter-count-badge">当前感知：<strong>{{ filteredDeviceElders.length }}</strong> 户</span>
      </div>
    </div>

    <!-- 设备台账与实时遥测表格 -->
    <div class="device-table-card">
      <table class="dev-table">
        <thead>
          <tr>
            <th>长者姓名</th>
            <th>片区与门牌地址</th>
            <th>卫浴毫米波雷达 (防跌倒)</th>
            <th>睡眠体征垫 (心率/呼吸/在床)</th>
            <th>一键 SOS 应急纽</th>
            <th>门磁 / 燃气安居探头</th>
            <th>分管责任助老员</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="elder in filteredDeviceElders" :key="elder.elderly_id">
            <td>
              <button class="elder-name-btn" @click="handleViewElder(elder.elderly_id)">
                <strong>{{ elder.name }}</strong>
              </button>
              <span class="age-sub">{{ elder.age }}岁</span>
            </td>
            <td>
              <span class="area-chip-sub">{{ elder.area_name }}</span>
              {{ elder.home_address }}
            </td>
            <td>
              <div class="dev-status-cell">
                <span
                  class="badge-pill"
                  :class="elder.devices.radar_bathroom.fall_alert ? 'pill-alert' : 'pill-online'"
                >
                  {{ elder.devices.radar_bathroom.fall_alert ? '⚠️ 跌倒异动' : '正常在线' }}
                </span>
                <span class="micro-desc">{{ elder.devices.radar_bathroom.presence ? '有人' : '无人' }} · {{ elder.devices.radar_bathroom.device_id }}</span>
              </div>
            </td>
            <td>
              <div v-if="elder.devices.sleep_pad" class="dev-status-cell">
                <span
                  class="badge-pill"
                  :class="elder.devices.sleep_pad.in_bed ? 'pill-inbed' : 'pill-leavebed'"
                >
                  {{ elder.devices.sleep_pad.in_bed ? `在床 · ${elder.devices.sleep_pad.hr} bpm` : `离床未归` }}
                </span>
                <span class="micro-desc">呼吸 {{ elder.devices.sleep_pad.br }}次/分 · 评分 {{ elder.devices.sleep_pad.sleep_score }}</span>
              </div>
              <span v-else class="text-na">未配床垫</span>
            </td>
            <td>
              <span class="badge-pill pill-online">在线 {{ elder.devices.sos_button.battery_pct }}%</span>
              <span class="micro-desc">{{ elder.devices.sos_button.device_id }}</span>
            </td>
            <td>
              <span v-if="elder.devices.door_sensor" class="sensor-pill">
                门磁: {{ elder.devices.door_sensor.is_open ? '开' : '闭' }}
              </span>
              <span v-if="elder.devices.gas_sensor" class="sensor-pill">
                燃气: {{ elder.devices.gas_sensor.alarm ? '🚨' : '安全' }}
              </span>
            </td>
            <td>{{ elder.assigned_caregiver_name }}</td>
            <td>
              <button class="inspect-btn" @click="handleViewElder(elder.elderly_id)">
                客观遥测
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 12349 突发跌倒应急指挥中枢弹窗 -->
    <EmergencyDispatchModal
      v-if="store.isEmergencyModalOpen.value"
    />
  </div>
</template>

<style scoped>
.home-device-monitoring-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.device-kpi-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 16px 22px;
  flex-wrap: wrap;
  gap: 16px;
}

.kpi-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sensor-icon {
  font-size: 32px;
}

.kpi-brand h3 {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 2px;
}

.kpi-brand p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.kpi-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.dev-stat-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
}

.dev-stat-card .label {
  font-size: 11px;
  color: #94a3b8;
}

.dev-stat-card .val {
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
}

.dev-stat-card .val small {
  font-size: 11px;
  font-weight: normal;
  color: #94a3b8;
}

.dev-stat-card .val.cyan { color: #38bdf8; }
.dev-stat-card .val.emerald { color: #34d399; }
.dev-stat-card .val.purple { color: #c084fc; }

.active-alerts-panel {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 10px;
  padding: 16px 20px;
}

.alerts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.alerts-header h4 {
  margin: 0;
  font-size: 15px;
  color: #fca5a5;
}

.alert-count-pill {
  background: rgba(239, 68, 68, 0.25);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.alert-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.alert-emergency-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-emergency-card.leave-bed {
  border-color: rgba(234, 179, 8, 0.4);
}

.alert-top {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.alert-tag {
  color: #f87171;
  font-weight: 700;
}

.leave-bed .alert-tag {
  color: #fbbf24;
}

.alert-time {
  color: #94a3b8;
}

.alert-elder-info {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #f1f5f9;
}

.alert-elder-info span {
  font-size: 12px;
  color: #cbd5e1;
}

.alert-detail-text {
  font-size: 12px;
  color: #cbd5e1;
  background: rgba(0, 0, 0, 0.25);
  padding: 6px 10px;
  border-radius: 4px;
}

.alert-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.caregiver-handling {
  font-size: 11px;
  color: #34d399;
}

.caregiver-handling strong {
  color: #ffffff;
}

.kpi-right-actions {
  display: flex;
  align-items: center;
}

.btn-diagnostics {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(56, 189, 248, 0.3) 100%);
  border: 1px solid rgba(56, 189, 248, 0.5);
  color: #38bdf8;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(14, 165, 233, 0.2);
  transition: all 0.2s ease;
}

.btn-diagnostics:hover:not(:disabled) {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.4);
}

.diag-report-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  padding: 10px 18px;
  border-radius: 8px;
  color: #34d399;
  font-size: 13px;
}

.btn-close-diag {
  background: transparent;
  border: none;
  color: #34d399;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
}

.alert-action-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-dispatch-call {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
  color: #ffffff;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-dispatch-call:hover {
  background: #f87171;
}

.btn-check-elder {
  background: #0ea5e9;
  border: none;
  color: #ffffff;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}

.btn-check-elder:hover {
  background: #38bdf8;
}

.dev-tabs-bar {
  display: flex;
  align-items: center;
}

.tabs-list {
  display: flex;
  gap: 6px;
  background: rgba(15, 23, 42, 0.6);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  overflow-x: auto;
}

.dev-tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.dev-tab-btn:hover {
  color: #ffffff;
}

.dev-tab-btn.active {
  background: #0ea5e9;
  color: #ffffff;
  font-weight: 600;
}

.device-subfilter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  padding: 10px 14px;
  border-radius: 8px;
  gap: 16px;
  flex-wrap: wrap;
}

.area-chips-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.area-chip-btn {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.area-chip-btn:hover {
  color: #ffffff;
  border-color: rgba(56, 189, 248, 0.4);
}

.area-chip-btn.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-search-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 6px 12px;
  color: #f1f5f9;
  font-size: 12px;
  min-width: 240px;
}

.device-search-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.filter-count-badge {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}

.filter-count-badge strong {
  color: #38bdf8;
}

.device-table-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  overflow-x: auto;
}

.dev-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.dev-table th {
  background: rgba(30, 41, 59, 0.7);
  color: #94a3b8;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  white-space: nowrap;
}

.dev-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.dev-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.elder-name-btn {
  background: transparent;
  border: none;
  color: #38bdf8;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.age-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-left: 4px;
}

.area-chip-sub {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  margin-right: 4px;
  color: #94a3b8;
}

.dev-status-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.badge-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
}

.pill-online {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.pill-alert {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
  font-weight: 700;
}

.pill-inbed {
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
}

.pill-leavebed {
  background: rgba(234, 179, 8, 0.2);
  color: #fbbf24;
}

.micro-desc {
  font-size: 10px;
  color: #64748b;
}

.text-na {
  color: #64748b;
  font-size: 11px;
}

.sensor-pill {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 4px;
}

.inspect-btn {
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.3);
  color: #38bdf8;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.inspect-btn:hover {
  background: #0ea5e9;
  color: #ffffff;
}
</style>
