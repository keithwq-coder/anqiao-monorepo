<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHomeCareStore } from '../../../features/home-care/home-care-store'
import OffDutyEmptyState from '../../../features/home-care/components/OffDutyEmptyState.vue'
import WorkOrderExecutionModal from '../../../features/home-care/components/WorkOrderExecutionModal.vue'
import EmergencyDispatchModal from '../../../features/home-care/components/EmergencyDispatchModal.vue'
import type { HomeWorkOrder } from '../../../features/home-care/home-care-data'

const store = useHomeCareStore()

const currentTab = ref<'orders' | 'dispatch' | 'sos'>('orders')
const selectedOrderStatus = ref<'all' | 'serving' | 'en_route' | 'accepted' | 'verified'>('all')

const activeCg = computed(() => store.activeCaregiver.value)

// 过滤工单
const displayedOrders = computed(() => {
  let list = store.workOrders.value

  // 1. 若选定了助老员
  if (activeCg.value) {
    if (!activeCg.value.onDuty) return []
    list = list.filter((wo) => wo.caregiver_id === activeCg.value!.id)
  } else if (store.selectedAreaKey.value !== 'all') {
    list = list.filter((wo) => wo.area_key === store.selectedAreaKey.value)
  }

  // 2. 状态筛选
  if (selectedOrderStatus.value !== 'all') {
    list = list.filter((wo) => wo.status === selectedOrderStatus.value)
  }

  return list
})

// 统计
const totalOrdersToday = computed(() => store.workOrders.value.length)
const servingCount = computed(() => store.workOrders.value.filter((w) => w.status === 'serving').length)
const enRouteCount = computed(() => store.workOrders.value.filter((w) => w.status === 'en_route').length)
const verifiedCount = computed(() => store.workOrders.value.filter((w) => w.status === 'verified').length)

// 快速派单表单弹窗
const showDispatchModal = ref(false)
const newOrderElderId = ref('SZ-ELD-10001')
const newOrderService = ref('LTC-01')
const newOrderCaregiver = ref('cg_canglang_01')

function submitDispatch() {
  const targetElder = store.elders.value.find((e) => e.elderly_id === newOrderElderId.value)
  const targetCg = store.caregivers.value.find((c) => c.id === newOrderCaregiver.value)
  if (!targetElder || !targetCg) return

  const SERVICE_NAMES: Record<string, { name: string; duration: number; subsidy: number }> = {
    'LTC-01': { name: '床上温水擦浴与更衣照料', duration: 45, subsidy: 65.0 },
    'LTC-04': { name: '协助翻身叩背及防压疮皮肤护理', duration: 30, subsidy: 45.0 },
    'LTC-07': { name: '日常生命体征监测与慢病巡检', duration: 15, subsidy: 20.0 },
    'LTC-10': { name: '留置导尿管定期置换与造口护理', duration: 60, subsidy: 95.0 },
    'LTC-11': { name: 'IV期复杂压疮清创换药与水胶体敷料维护', duration: 45, subsidy: 85.0 },
    'LTC-12': { name: '脑卒中偏瘫肢体综合运动训练', duration: 50, subsidy: 80.0 },
    'LTC-14': { name: '认知症怀旧感官刺激与防走失预警管理', duration: 60, subsidy: 75.0 },
    'SAFE-02': { name: '卫浴无障碍防滑扶手加装与雷达调试', duration: 90, subsidy: 120.0 },
    'QC-01': { name: '助老员服务规范双盲入户飞行质量检查', duration: 30, subsidy: 0.0 },
  }
  const sInfo = SERVICE_NAMES[newOrderService.value] || { name: '社区居家综合照护', duration: 45, subsidy: 65.0 }

  const newWo: HomeWorkOrder = {
    order_id: `WO-${Date.now().toString().slice(-8)}`,
    elderly_id: targetElder.elderly_id,
    elderly_name: targetElder.name,
    area_key: targetElder.area_key,
    area_name: targetElder.area_name,
    home_address: targetElder.home_address,
    service_code: newOrderService.value,
    service_name: sInfo.name,
    caregiver_id: targetCg.id,
    caregiver_name: targetCg.name,
    caregiver_role: targetCg.roleTitle,
    scheduled_time: '今日 16:30 - 17:15',
    status: 'accepted',
    duration_minutes: sInfo.duration,
    ltc_fund_subsidy: sInfo.subsidy,
    remarks: '调度中枢快速调派工单',
  }
  store.workOrders.value.unshift(newWo)
  showDispatchModal.value = false
}

function handleViewElder(elderId: string) {
  store.openElderlyDetail(elderId)
}
</script>

<template>
  <div class="home-dispatch-center-view">
    <!-- 顶部指挥调度中枢运行面板 -->
    <div class="dispatch-kpi-bar">
      <div class="kpi-center-brand">
        <span class="pulse-indicator"></span>
        <div class="brand-titles">
          <h3>苏智护 · 居家指挥调度中枢</h3>
          <p>苏州市姑苏区智护居家养老服务中心 · 7×24H 应急坐席值守中 (坐席: 苏怡)</p>
        </div>
      </div>

      <div class="kpi-metrics-row">
        <div class="kpi-card">
          <span class="kpi-title">今日上门工单</span>
          <span class="kpi-val">{{ totalOrdersToday }} <small>单</small></span>
        </div>
        <div class="kpi-card accent-blue">
          <span class="kpi-title">入户服务中</span>
          <span class="kpi-val">{{ servingCount }} <small>位</small></span>
        </div>
        <div class="kpi-card accent-amber">
          <span class="kpi-title">前往途中</span>
          <span class="kpi-val">{{ enRouteCount }} <small>单</small></span>
        </div>
        <div class="kpi-card accent-green">
          <span class="kpi-title">长护险已核销</span>
          <span class="kpi-val">{{ verifiedCount }} <small>单</small></span>
        </div>
        <button class="dispatch-action-btn" @click="showDispatchModal = true" type="button">
          + 调度派单
        </button>
      </div>
    </div>

    <!-- 突发急救与跌倒告警联动横幅 -->
    <div class="emergency-alert-banner">
      <div class="em-left">
        <span class="em-icon">🚨</span>
        <div class="em-text">
          <strong>紧急预警协同：</strong>
          沧浪新村 18 幢 402 室 <strong>郭振华 爷爷</strong> 卫浴毫米波突发跌倒下坠！
          <span class="em-status">当值机动助老员 <strong>黄建国</strong> 正在前往途中 (预计3分钟到场)</span>
        </div>
      </div>
      <div class="em-right-actions">
        <button class="em-btn-dispatch" @click="store.openEmergencyModal()" type="button">
          ⚡ 12349 突发跌倒应急指挥
        </button>
        <button class="em-btn" @click="handleViewElder('SZ-ELD-10007')" type="button">
          长者全景与雷达
        </button>
      </div>
    </div>

    <!-- 如果当前在侧边栏点击了“今日轮休”的助老员（如周玉兰） -->
    <template v-if="activeCg && !activeCg.onDuty">
      <OffDutyEmptyState :caregiver="activeCg" />
    </template>

    <!-- 正常当班助老员或全局视图 -->
    <template v-else>
      <!-- 当前选中的在岗助老员专属当班卡片 -->
      <div v-if="activeCg" class="active-caregiver-header-card">
        <div class="cg-info-left">
          <span class="cg-avatar-box">{{ activeCg.avatar }}</span>
          <div class="cg-titles">
            <div class="cg-name-headline">
              <h2>{{ activeCg.name }}</h2>
              <span class="cg-badge" :class="activeCg.category === 'idt_medical' ? 'badge-idt' : activeCg.category === 'qa_manager' ? 'badge-qa' : ''">
                {{ activeCg.roleTitle }}
              </span>
              <span class="cg-category-tag">{{ activeCg.categoryLabel }}</span>
              <span class="cg-duty-tag">● 当班在岗</span>
              <span class="cg-phone-tag">📞 {{ activeCg.phone }}</span>
            </div>
            <p class="cg-desc">
              服务范围与定位：<strong>{{ activeCg.areaName }}</strong> ·
              重点服务长者：<strong>{{ activeCg.managedElderCount }}</strong> 位 ·
              今日待办工单：<strong>{{ activeCg.pendingWorkOrders }}</strong> 单
            </p>
          </div>
        </div>
        <div class="cg-skills-right">
          <div v-if="activeCg.credentials?.length" class="cred-row">
            <span class="skill-title">执业资格与认证：</span>
            <span v-for="cr in activeCg.credentials" :key="cr" class="cred-chip">🏅 {{ cr }}</span>
          </div>
          <div class="skill-row">
            <span class="skill-title">核心技能：</span>
            <span v-for="sk in activeCg.skills" :key="sk" class="skill-chip">{{ sk }}</span>
          </div>
          <button class="btn-clear-cg" @click="store.clearCaregiverSelection()" title="查看全员大盘">
            ✕ 退出个人视图
          </button>
        </div>
      </div>

      <!-- 工单列表操作栏与过滤 Chips -->
      <div class="orders-toolbar">
        <div class="order-status-tabs">
          <button
            :class="['tab-pill', selectedOrderStatus === 'all' && 'active']"
            @click="selectedOrderStatus = 'all'"
          >
            全部工单 ({{ displayedOrders.length }})
          </button>
          <button
            :class="['tab-pill', selectedOrderStatus === 'serving' && 'active']"
            @click="selectedOrderStatus = 'serving'"
          >
            服务进行中
          </button>
          <button
            :class="['tab-pill', selectedOrderStatus === 'en_route' && 'active']"
            @click="selectedOrderStatus = 'en_route'"
          >
            上门途中
          </button>
          <button
            :class="['tab-pill', selectedOrderStatus === 'accepted' && 'active']"
            @click="selectedOrderStatus = 'accepted'"
          >
            已接单待上门
          </button>
          <button
            :class="['tab-pill', selectedOrderStatus === 'verified' && 'active']"
            @click="selectedOrderStatus = 'verified'"
          >
            长护险已核销
          </button>
        </div>

        <div class="orders-area-hint">
          当前范围：<strong>{{ activeCg ? `${activeCg.name} 分管工单` : store.selectedAreaKey.value === 'all' ? '全区所有片区' : store.currentAreaConfig.value?.name }}</strong>
        </div>
      </div>

      <!-- 入户工单表格 -->
      <div class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>工单单号</th>
              <th>服务对象</th>
              <th>服务项目与标准</th>
              <th>责任助老员</th>
              <th>家庭详细住址</th>
              <th>计划上门时段</th>
              <th>现场打卡状态</th>
              <th>长护险基金</th>
              <th>操作协同</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="wo in displayedOrders" :key="wo.order_id" :class="wo.status === 'urgent_alert' ? 'row-urgent' : ''">
              <td class="font-mono">{{ wo.order_id }}</td>
              <td>
                <button class="elder-link-btn" @click="handleViewElder(wo.elderly_id)">
                  <strong>{{ wo.elderly_name }}</strong>
                </button>
              </td>
              <td>
                <span class="service-code-tag">{{ wo.service_code }}</span>
                <span class="service-name-text">{{ wo.service_name }}</span>
              </td>
              <td>
                <span class="cg-assigned-name">{{ wo.caregiver_name }}</span>
                <span class="cg-role-sub">{{ wo.caregiver_role }}</span>
              </td>
              <td class="address-cell">
                <span class="area-tag">{{ wo.area_name }}</span>
                {{ wo.home_address }}
              </td>
              <td class="time-cell">{{ wo.scheduled_time }}</td>
              <td>
                <span
                  class="status-chip"
                  :class="{
                    'status-serving': wo.status === 'serving',
                    'status-enroute': wo.status === 'en_route',
                    'status-verified': wo.status === 'verified',
                    'status-accepted': wo.status === 'accepted',
                  }"
                >
                  {{ wo.status === 'serving' ? '● 入户服务中' : wo.status === 'en_route' ? '● 正在赶往' : wo.status === 'verified' ? '✓ 医保已核销' : '○ 已接单' }}
                </span>
                <div v-if="wo.checkin_time" class="checkin-micro">
                  {{ wo.checkin_time }}
                </div>
              </td>
              <td class="fee-cell">￥{{ wo.ltc_fund_subsidy.toFixed(2) }}</td>
              <td class="action-cell">
                <button
                  class="action-execute-btn"
                  :class="{
                    'btn-serving': wo.status === 'serving',
                    'btn-enroute': wo.status === 'en_route',
                    'btn-verified': wo.status === 'verified',
                  }"
                  @click="store.openWorkOrderDetail(wo.order_id)"
                  type="button"
                >
                  {{ wo.status === 'serving' ? '服务实操' : wo.status === 'en_route' ? '入户打卡' : wo.status === 'verified' ? '核销凭证' : '处置流转' }}
                </button>
                <button class="action-view-btn" @click="handleViewElder(wo.elderly_id)" type="button">
                  全景
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 调度派单弹窗 -->
    <div v-if="showDispatchModal" class="modal-backdrop" @click="showDispatchModal = false">
      <div class="dispatch-modal-card" @click.stop>
        <div class="modal-head">
          <h3>苏智护调度中枢 · 入户工单调派</h3>
          <button class="close-x" @click="showDispatchModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>服务长者对象：</label>
            <select v-model="newOrderElderId" class="modal-select">
              <option v-for="e in store.elders.value.slice(0, 15)" :key="e.elderly_id" :value="e.elderly_id">
                {{ e.name }} ({{ e.area_name }} · {{ e.home_address }}) - {{ e.ltc_level }}
              </option>
            </select>
          </div>
          <div class="form-field">
            <label>长护险定点与专业服务项目：</label>
            <select v-model="newOrderService" class="modal-select">
              <optgroup label="基础生活照料 (片区助老)">
                <option value="LTC-01">LTC-01 床上温水擦浴与更衣照料 (45分钟 / 65元)</option>
                <option value="LTC-04">LTC-04 协助翻身叩背及防压疮护理 (30分钟 / 45元)</option>
                <option value="LTC-07">LTC-07 日常生命体征监测与慢病巡检 (15分钟 / 20元)</option>
              </optgroup>
              <optgroup label="多学科专业支撑团队 (IDT 医护康)">
                <option value="LTC-10">LTC-10 留置导尿管置换与造口护理 (60分钟 / 95元 · 专职护师)</option>
                <option value="LTC-11">LTC-11 IV期复杂压疮清创换药与水胶体敷料 (45分钟 / 85元 · 专职护师)</option>
                <option value="LTC-12">LTC-12 脑卒中偏瘫肢体综合运动训练 (50分钟 / 80元 · 康复师)</option>
                <option value="LTC-14">LTC-14 认知症怀旧感官刺激与防走失预警 (60分钟 / 75元 · 认知专护)</option>
                <option value="SAFE-02">SAFE-02 卫浴无障碍防滑扶手加装与雷达调试 (90分钟 / 120元 · 辅具顾问)</option>
              </optgroup>
              <optgroup label="质控督导与个案管理">
                <option value="QC-01">QC-01 助老员服务规范双盲入户飞行检查 (30分钟 · 质控主管)</option>
                <option value="CM-01">CM-01 “一人一策”居家多学科照护方案评估 (45分钟 · 个案管理)</option>
              </optgroup>
            </select>
          </div>
          <div class="form-field">
            <label>指派执行专业人员：</label>
            <select v-model="newOrderCaregiver" class="modal-select">
              <option v-for="cg in store.caregivers.value.filter(c => c.onDuty)" :key="cg.id" :value="cg.id">
                [{{ cg.categoryLabel }}] {{ cg.name }} ({{ cg.roleTitle }}) - {{ cg.areaName }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn-cancel" @click="showDispatchModal = false">取消</button>
          <button class="btn-confirm" @click="submitDispatch">确认派单并下发</button>
        </div>
      </div>
    </div>

    <!-- 工单生命周期流转与存证核验弹窗 -->
    <WorkOrderExecutionModal
      v-if="store.activeWorkOrder.value"
      :work-order="store.activeWorkOrder.value"
    />

    <!-- 12349 突发跌倒应急指挥中枢弹窗 -->
    <EmergencyDispatchModal
      v-if="store.isEmergencyModalOpen.value"
    />
  </div>
</template>

<style scoped>
.home-dispatch-center-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dispatch-kpi-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 16px 22px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  flex-wrap: wrap;
  gap: 16px;
}

.kpi-center-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.pulse-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.brand-titles h3 {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 2px;
}

.brand-titles p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.kpi-metrics-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.kpi-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  min-width: 100px;
}

.kpi-title {
  font-size: 11px;
  color: #94a3b8;
}

.kpi-val {
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
}

.kpi-val small {
  font-size: 11px;
  font-weight: normal;
  color: #94a3b8;
}

.accent-blue .kpi-val { color: #38bdf8; }
.accent-amber .kpi-val { color: #fbbf24; }
.accent-green .kpi-val { color: #34d399; }

.dispatch-action-btn {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: #ffffff;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
  transition: all 0.2s;
}

.dispatch-action-btn:hover {
  background: #38bdf8;
  transform: translateY(-1px);
}

.emergency-alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.22) 100%);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  padding: 10px 18px;
}

.em-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.em-icon {
  font-size: 20px;
  animation: pulse 1.2s infinite;
}

.em-text {
  font-size: 13px;
  color: #fecaca;
}

.em-text strong {
  color: #ffffff;
}

.em-status {
  margin-left: 10px;
  color: #fde047;
  font-size: 12px;
}

.em-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.em-btn-dispatch {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid #f87171;
  color: #ffffff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  transition: all 0.2s;
}

.em-btn-dispatch:hover {
  background: #f87171;
  transform: translateY(-1px);
}

.em-btn {
  background: rgba(239, 68, 68, 0.25);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.em-btn:hover {
  background: #ef4444;
}

.active-caregiver-header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 10px;
  padding: 14px 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.cg-info-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cg-avatar-box {
  font-size: 34px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  padding: 4px;
}

.cg-name-headline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.cg-name-headline h2 {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.cg-badge {
  font-size: 11px;
  background: rgba(14, 165, 233, 0.25);
  color: #38bdf8;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
}

.cg-badge.badge-idt {
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.cg-badge.badge-qa {
  background: rgba(168, 85, 247, 0.25);
  color: #c084fc;
}

.cg-category-tag {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.cg-duty-tag {
  font-size: 11px;
  color: #34d399;
}

.cg-phone-tag {
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
}

.cg-desc {
  font-size: 12px;
  color: #cbd5e1;
  margin: 0;
}

.cg-desc strong {
  color: #38bdf8;
}

.cg-skills-right {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.cred-row, .skill-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.skill-title {
  font-size: 11px;
  color: #94a3b8;
}

.cred-chip {
  font-size: 11px;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 1px 7px;
  border-radius: 4px;
  font-weight: 500;
}

.skill-chip {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.btn-clear-cg {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  margin-left: 10px;
}

.btn-clear-cg:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  flex-wrap: wrap;
  gap: 12px;
}

.order-status-tabs {
  display: flex;
  gap: 6px;
}

.tab-pill {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
  padding: 5px 12px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.tab-pill:hover {
  color: #ffffff;
}

.tab-pill.active {
  background: rgba(14, 165, 233, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.orders-area-hint {
  font-size: 12px;
  color: #94a3b8;
}

.orders-area-hint strong {
  color: #f1f5f9;
}

.orders-table-wrapper {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  overflow-x: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.orders-table th {
  background: rgba(30, 41, 59, 0.7);
  color: #94a3b8;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  white-space: nowrap;
}

.orders-table td {
  padding: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.orders-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.elder-link-btn {
  background: transparent;
  border: none;
  color: #38bdf8;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.elder-link-btn:hover {
  color: #7dd3fc;
}

.service-code-tag {
  font-family: monospace;
  font-size: 11px;
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 6px;
}

.service-name-text {
  font-weight: 500;
  color: #f1f5f9;
}

.cg-assigned-name {
  font-weight: 600;
  color: #ffffff;
  display: block;
}

.cg-role-sub {
  font-size: 11px;
  color: #94a3b8;
}

.address-cell {
  max-width: 220px;
}

.area-tag {
  font-size: 11px;
  color: #94a3b8;
  margin-right: 4px;
}

.time-cell {
  white-space: nowrap;
  font-size: 12px;
  color: #94a3b8;
}

.status-chip {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status-serving {
  background: rgba(14, 165, 233, 0.2);
  color: #38bdf8;
}

.status-enroute {
  background: rgba(234, 179, 8, 0.2);
  color: #facc15;
}

.status-verified {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.status-accepted {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.checkin-micro {
  font-size: 10px;
  color: #34d399;
  margin-top: 2px;
}

.fee-cell {
  font-family: monospace;
  font-weight: 600;
  color: #34d399;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.action-execute-btn {
  background: rgba(14, 165, 233, 0.2);
  border: 1px solid rgba(14, 165, 233, 0.45);
  color: #38bdf8;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-execute-btn:hover {
  background: #0ea5e9;
  color: #ffffff;
}

.action-execute-btn.btn-serving {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.5);
  color: #34d399;
}

.action-execute-btn.btn-serving:hover {
  background: #10b981;
  color: #ffffff;
}

.action-execute-btn.btn-enroute {
  background: rgba(234, 179, 8, 0.25);
  border-color: rgba(234, 179, 8, 0.5);
  color: #facc15;
}

.action-execute-btn.btn-enroute:hover {
  background: #eab308;
  color: #000000;
}

.action-execute-btn.btn-verified {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.35);
  color: #cbd5e1;
}

.action-view-btn {
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.3);
  color: #7dd3fc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-view-btn:hover {
  background: rgba(14, 165, 233, 0.3);
  color: #ffffff;
}

/* 弹窗 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dispatch-modal-card {
  background: #1e293b;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 12px;
  width: 90%;
  max-width: 520px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.modal-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.close-x {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  color: #cbd5e1;
}

.modal-select {
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
}

.btn-cancel {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-confirm {
  background: #0ea5e9;
  border: none;
  color: #ffffff;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm:hover {
  background: #38bdf8;
}
</style>
