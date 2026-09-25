<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCareStore } from '../../../features/home-care/home-care-store'
import type { HomeElderly } from '../../../features/home-care/home-care-data'

const props = defineProps<{
  elderlyId: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useHomeCareStore()

const elder = computed<HomeElderly | null>(() => {
  return store.elders.value.find((e) => e.elderly_id === props.elderlyId) || null
})

const elderWorkOrders = computed(() => {
  return store.workOrders.value.filter((wo) => wo.elderly_id === props.elderlyId)
})

function handleBack() {
  store.closeElderlyDetail()
  emit('back')
}
</script>

<template>
  <div v-if="elder" class="elderly-detail-panorama">
    <!-- 顶部导航栏与一键返回 -->
    <div class="detail-header-bar">
      <div class="header-left">
        <button class="back-btn" @click="handleBack" type="button">
          <span class="back-arrow">←</span> 一键返回在管长者全景
        </button>
        <div class="breadcrumb-trail">
          <span class="bc-area">{{ elder.area_name }}</span>
          <span class="bc-sep">/</span>
          <span class="bc-comm">{{ elder.community_name }}</span>
          <span class="bc-sep">/</span>
          <span class="bc-name">{{ elder.name }}</span>
        </div>
      </div>
      <div class="header-right">
        <span
          class="state-pill"
          :class="{
            'is-normal': elder.current_state === '在家长者',
            'is-alert': elder.current_state === '异常预警',
            'is-outing': elder.current_state === '外出活动',
          }"
        >
          ● {{ elder.current_state }}
        </span>
        <span class="ltc-badge" :class="elder.ltc_level === '重度失能' ? 'ltc-severe' : 'ltc-normal'">
          长护险 · {{ elder.ltc_level }}
        </span>
      </div>
    </div>

    <!-- 长者全景核心档案卡片 -->
    <div class="elder-summary-card">
      <div class="summary-avatar-block">
        <span class="avatar-large">{{ elder.gender === 'male' ? '👴' : '👵' }}</span>
        <div class="avatar-meta">
          <h2 class="elder-name-title">
            {{ elder.name }}
            <span class="elder-age-badge">{{ elder.gender === 'male' ? '爷爷' : '奶奶' }} · {{ elder.age }} 岁</span>
          </h2>
          <div class="elder-key-tags">
            <span class="tag-chip living-tag">{{ elder.living_status }}</span>
            <span class="tag-chip address-tag">📍 {{ elder.home_address }} ({{ elder.has_elevator ? '有电梯' : `${elder.floor_number}楼无电梯` }})</span>
            <span class="tag-chip caregiver-tag">🩺 责任助老员：{{ elder.assigned_caregiver_name }}</span>
          </div>
        </div>
      </div>

      <div class="summary-stat-grid">
        <div class="stat-box">
          <span class="stat-label">长护险定点服务进度</span>
          <span class="stat-value">
            <strong>{{ elder.monthly_service_completed }}</strong> / {{ elder.monthly_service_quota }} 次
          </span>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${(elder.monthly_service_completed / elder.monthly_service_quota) * 100}%` }"
            ></div>
          </div>
        </div>
        <div class="stat-box">
          <span class="stat-label">最近上门服务时间</span>
          <span class="stat-sub-value">{{ elder.last_service_time }}</span>
          <span class="stat-plan-note">下步计划：{{ elder.next_service_plan }}</span>
        </div>
      </div>
    </div>

    <!-- 下方栅格：左右双柱全要素穿透 -->
    <div class="detail-main-grid">
      <!-- 左柱：居家智能安居硬件实时监测大盘 -->
      <div class="detail-column">
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">📡 居家适老化安居硬件 · 实时遥测</h3>
            <span class="panel-badge-live">7×24H 智能守护中</span>
          </div>

          <div class="devices-card-list">
            <!-- 1. 卫生间毫米波防跌倒雷达 -->
            <div
              class="device-item"
              :class="{ 'has-alert': elder.devices.radar_bathroom.fall_alert }"
            >
              <div class="dev-icon-col">
                <span class="dev-icon">📡</span>
              </div>
              <div class="dev-info-col">
                <div class="dev-title-row">
                  <strong>卫生间 60GHz 毫米波雷达 (防跌倒感知)</strong>
                  <span class="dev-status-tag" :class="elder.devices.radar_bathroom.online ? 'online' : 'offline'">
                    {{ elder.devices.radar_bathroom.online ? '设备在线' : '离线' }}
                  </span>
                </div>
                <div class="dev-metric-row">
                  <span>人体存在：<strong>{{ elder.devices.radar_bathroom.presence ? '检测到人员在内' : '卫浴无人' }}</strong></span>
                  <span>姿态状态：<strong :class="elder.devices.radar_bathroom.fall_alert ? 'warn-text' : 'safe-text'">
                    {{ elder.devices.radar_bathroom.fall_alert ? '⚠️ 突发急速下坠（疑似跌倒）' : '姿态平稳正常' }}
                  </strong></span>
                </div>
                <div class="dev-event-time">
                  感知日志：{{ elder.devices.radar_bathroom.last_event }} · 信号：{{ elder.devices.radar_bathroom.signal_strength }}
                </div>
              </div>
            </div>

            <!-- 2. 智能睡眠体征监测垫 -->
            <div v-if="elder.devices.sleep_pad" class="device-item">
              <div class="dev-icon-col">
                <span class="dev-icon">🛏️</span>
              </div>
              <div class="dev-info-col">
                <div class="dev-title-row">
                  <strong>智能睡眠体征监测垫 (压电薄膜非接触)</strong>
                  <span class="dev-status-tag online">实时采集</span>
                </div>
                <div class="dev-metric-row">
                  <span>在床状态：<strong :class="elder.devices.sleep_pad.in_bed ? 'safe-text' : 'warn-text'">
                    {{ elder.devices.sleep_pad.in_bed ? '在床感知中' : `离床未归 (${elder.devices.sleep_pad.leave_bed_minutes}分钟)` }}
                  </strong></span>
                  <span>心率：<strong>{{ elder.devices.sleep_pad.hr > 0 ? `${elder.devices.sleep_pad.hr} bpm` : '离床' }}</strong></span>
                  <span>呼吸率：<strong>{{ elder.devices.sleep_pad.br > 0 ? `${elder.devices.sleep_pad.br} 次/分` : '离床' }}</strong></span>
                </div>
                <div class="dev-event-time">
                  睡眠质量评分：{{ elder.devices.sleep_pad.sleep_score }}分 (深度睡眠周期适中)
                </div>
              </div>
            </div>

            <!-- 3. 一键 SOS 应急呼叫纽 -->
            <div
              class="device-item"
              :class="{ 'has-alert': elder.devices.sos_button.alarm_active }"
            >
              <div class="dev-icon-col">
                <span class="dev-icon">🆘</span>
              </div>
              <div class="dev-info-col">
                <div class="dev-title-row">
                  <strong>床头/随身一键 SOS 呼叫纽 (LoRa 无线直连)</strong>
                  <span class="dev-status-tag online">待机值守</span>
                </div>
                <div class="dev-metric-row">
                  <span>求助状态：<strong :class="elder.devices.sos_button.alarm_active ? 'warn-text' : 'safe-text'">
                    {{ elder.devices.sos_button.alarm_active ? '🚨 呼叫触发报警中' : '未触发求助' }}
                  </strong></span>
                  <span>电池电量：<strong>{{ elder.devices.sos_button.battery_pct }}%</strong></span>
                </div>
                <div class="dev-event-time">
                  定期自检：{{ elder.devices.sos_button.last_test_date }} 通过
                </div>
              </div>
            </div>

            <!-- 4. 门磁与燃气探头 -->
            <div v-if="elder.devices.door_sensor || elder.devices.gas_sensor" class="device-item">
              <div class="dev-icon-col">
                <span class="dev-icon">🚪</span>
              </div>
              <div class="dev-info-col">
                <div class="dev-title-row">
                  <strong>居家环境安全防线 (门磁与燃气探头)</strong>
                  <span class="dev-status-tag online">正常</span>
                </div>
                <div class="dev-metric-row">
                  <span v-if="elder.devices.door_sensor">
                    入户门：{{ elder.devices.door_sensor.is_open ? '⚠️ 门体开启中' : '已关合闭锁' }} ({{ elder.devices.door_sensor.last_open_time }})
                  </span>
                  <span v-if="elder.devices.gas_sensor">
                    厨房燃气：{{ elder.devices.gas_sensor.alarm ? '🚨 泄漏告警' : '浓度安全达标' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 既往慢病与护理风控档案 -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">📋 慢病与生活自理能力客观评估</h3>
          </div>
          <div class="chronic-tags-wrap">
            <div class="sub-label">确诊慢病档案：</div>
            <div class="tag-row">
              <span v-for="d in elder.chronic_diseases" :key="d" class="chronic-pill">
                {{ d }}
              </span>
            </div>

            <div class="sub-label" style="margin-top: 12px">重点照护风控提示：</div>
            <div class="tag-row">
              <span v-for="r in elder.care_risk_tags" :key="r" class="risk-pill">
                ⚠️ {{ r }}
              </span>
            </div>
          </div>
        </div>

        <!-- 多学科 IDT 协同综合照护专案 (对标居家乐与福寿康连锁照护标准) -->
        <div class="detail-panel idt-care-plan-panel">
          <div class="panel-header">
            <h3 class="panel-title">👥 多学科专业协同 (IDT) 综合照护专案</h3>
            <span class="panel-badge-idt">一人一策定制方案</span>
          </div>

          <div class="idt-plan-list">
            <!-- 1. 基础生活照料 -->
            <div class="idt-plan-item">
              <div class="idt-item-head">
                <span class="idt-role-badge badge-care">生活照料</span>
                <span class="idt-staff-name">责任助老员：<strong>{{ elder.assigned_caregiver_name }}</strong></span>
                <span class="idt-freq">每周 3 次</span>
              </div>
              <p class="idt-item-desc">床上温水擦浴、更衣排泄照料、压疮定时翻身与居室清洁消毒。</p>
            </div>

            <!-- 2. 居家医疗专科护理 -->
            <div class="idt-plan-item">
              <div class="idt-item-head">
                <span class="idt-role-badge badge-med">医疗护理</span>
                <span class="idt-staff-name">专职护师：<strong>沈雅萍 主管护师</strong></span>
                <span class="idt-freq">每 2 周 1 次</span>
              </div>
              <p class="idt-item-desc">留置导尿与胃管定期更换、IV期复杂压疮清创敷料维护、慢病用药与胰岛素注射复核。</p>
            </div>

            <!-- 3. 康复治疗与功能促活 -->
            <div class="idt-plan-item">
              <div class="idt-item-head">
                <span class="idt-role-badge badge-pt">康复治疗</span>
                <span class="idt-staff-name">康复治疗师：<strong>陈建新 PT主管</strong></span>
                <span class="idt-freq">每周 1 次</span>
              </div>
              <p class="idt-item-desc">良肢位摆放指导、偏瘫肢体被动/主动辅助运动训练、步态平衡稳定性再训练。</p>
            </div>

            <!-- 4. 适老辅具与安居工程 -->
            <div class="idt-plan-item">
              <div class="idt-item-head">
                <span class="idt-role-badge badge-ast">适老辅具</span>
                <span class="idt-staff-name">适老工程师：<strong>张洪波</strong></span>
                <span class="idt-freq">季度巡检</span>
              </div>
              <p class="idt-item-desc">卫浴 L 型防滑扶手已加装、60GHz 毫米波雷达零盲区校准、电动护理床与轮椅调试保修。</p>
            </div>

            <!-- 5. 质控飞检与个案统筹 -->
            <div class="idt-plan-item">
              <div class="idt-item-head">
                <span class="idt-role-badge badge-qa">质控管家</span>
                <span class="idt-staff-name">养老管家：<strong>徐美玲</strong> · 质控主管：<strong>蒋国强</strong></span>
                <span class="idt-freq">月度全流程</span>
              </div>
              <p class="idt-item-desc">100% 录音电话回访满意度达标（5分），现场双盲飞行抽检合格，长护险统筹核销无欺诈。</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右柱：真实家属联系人与入户工单核销记录 -->
      <div class="detail-column">
        <!-- 紧急联系人卡片（拒绝星号脱敏） -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">📞 紧急联系家属与监护人</h3>
            <span class="panel-badge-verified">身份与关系已核验</span>
          </div>
          <div class="family-contact-box">
            <div class="contact-line">
              <span class="c-label">家属真实姓名：</span>
              <span class="c-val strong">{{ elder.emergency_contact.name }} ({{ elder.emergency_contact.relation }})</span>
            </div>
            <div class="contact-line">
              <span class="c-label">紧急联络电话：</span>
              <span class="c-val phone">{{ elder.emergency_contact.phone }}</span>
              <a :href="`tel:${elder.emergency_contact.phone}`" class="call-btn">呼叫家属</a>
            </div>
            <div class="contact-line">
              <span class="c-label">家属实际常住住址：</span>
              <span class="c-val">{{ elder.emergency_contact.address }}</span>
            </div>
            <div class="contact-line">
              <span class="c-label">长者身份证号：</span>
              <span class="c-val code">{{ elder.id_card }}</span>
            </div>
          </div>
        </div>

        <!-- 入户上门服务工单与长护险核销台账 -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">📝 入户上门服务工单与长护险核销</h3>
            <span class="panel-count">共 {{ elderWorkOrders.length }} 条记录</span>
          </div>

          <div v-if="elderWorkOrders.length" class="work-order-timeline">
            <div
              v-for="wo in elderWorkOrders"
              :key="wo.order_id"
              class="wo-timeline-item"
            >
              <div class="wo-head-row">
                <span class="wo-code">{{ wo.service_code }} · {{ wo.service_name }}</span>
                <span
                  class="wo-status-chip"
                  :class="{
                    'status-serving': wo.status === 'serving',
                    'status-enroute': wo.status === 'en_route',
                    'status-verified': wo.status === 'verified',
                    'status-accepted': wo.status === 'accepted',
                  }"
                >
                  {{ wo.status === 'serving' ? '服务进行中' : wo.status === 'en_route' ? '前往途中' : wo.status === 'verified' ? '已核销' : '待执行' }}
                </span>
              </div>

              <div class="wo-meta-row">
                <span>责任助老员：<strong>{{ wo.caregiver_name }}</strong> ({{ wo.caregiver_role }})</span>
                <span>时长：{{ wo.duration_minutes }} 分钟</span>
                <span>基金补贴：￥{{ wo.ltc_fund_subsidy.toFixed(2) }}</span>
              </div>

              <div class="wo-schedule">
                安排时间：{{ wo.scheduled_time }}
                <span v-if="wo.checkin_time" class="checkin-tag">📍 打卡：{{ wo.checkin_time }}</span>
              </div>

              <div v-if="wo.remarks" class="wo-remarks">
                核实备注：{{ wo.remarks }}
              </div>
            </div>
          </div>

          <div v-else class="empty-wo-hint">
            暂无历史异常工单，今日巡检按常规排班进行中
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.elderly-detail-panorama {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.detail-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  padding: 12px 18px;
  backdrop-filter: blur(8px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #0ea5e9;
  color: #ffffff;
  border-color: #0ea5e9;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
}

.breadcrumb-trail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #94a3b8;
}

.bc-sep {
  color: #475569;
}

.bc-name {
  color: #f8fafc;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.state-pill {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.state-pill.is-normal {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.state-pill.is-alert {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
  animation: pulse 1.8s infinite;
}

.state-pill.is-outing {
  background: rgba(234, 179, 8, 0.15);
  color: #fde047;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.ltc-badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.ltc-severe {
  background: linear-gradient(135deg, rgba(225, 29, 72, 0.25) 0%, rgba(190, 18, 60, 0.35) 100%);
  border: 1px solid rgba(244, 63, 94, 0.4);
  color: #fda4af;
}

.ltc-normal {
  background: rgba(14, 165, 233, 0.2);
  border: 1px solid rgba(14, 165, 233, 0.4);
  color: #7dd3fc;
}

.elder-summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  flex-wrap: wrap;
  gap: 20px;
}

.summary-avatar-block {
  display: flex;
  align-items: center;
  gap: 18px;
}

.avatar-large {
  font-size: 54px;
  line-height: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.elder-name-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.elder-age-badge {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.elder-key-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-chip {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.living-tag {
  background: rgba(147, 51, 234, 0.2);
  color: #d8b4fe;
  border: 1px solid rgba(147, 51, 234, 0.4);
}

.address-tag {
  background: rgba(30, 41, 59, 0.8);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.caregiver-tag {
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.3);
}

.summary-stat-grid {
  display: flex;
  gap: 20px;
}

.stat-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: #94a3b8;
}

.stat-value {
  font-size: 16px;
  color: #f8fafc;
}

.stat-value strong {
  color: #38bdf8;
  font-size: 20px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0ea5e9, #10b981);
  border-radius: 3px;
}

.stat-sub-value {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.stat-plan-note {
  font-size: 11px;
  color: #34d399;
}

.detail-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1024px) {
  .detail-main-grid {
    grid-template-columns: 1fr;
  }
}

.detail-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-panel {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 18px 20px;
  backdrop-filter: blur(8px);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  padding-bottom: 10px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0;
}

.panel-badge-live {
  font-size: 11px;
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.panel-badge-verified {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
}

.devices-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 12px 14px;
  transition: all 0.2s;
}

.device-item.has-alert {
  border-color: rgba(239, 68, 68, 0.6);
  background: rgba(239, 68, 68, 0.08);
}

.dev-icon {
  font-size: 24px;
  line-height: 1;
}

.dev-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dev-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #f1f5f9;
}

.dev-status-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
}

.dev-status-tag.online {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.dev-metric-row {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: #cbd5e1;
  flex-wrap: wrap;
}

.safe-text {
  color: #34d399;
}

.warn-text {
  color: #f87171;
  font-weight: 700;
}

.dev-event-time {
  font-size: 11px;
  color: #64748b;
}

.chronic-tags-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chronic-pill {
  font-size: 12px;
  background: rgba(56, 189, 248, 0.1);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 3px 8px;
  border-radius: 4px;
}

.risk-pill {
  font-size: 12px;
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 3px 8px;
  border-radius: 4px;
}

.family-contact-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(30, 41, 59, 0.45);
  border-radius: 8px;
  padding: 14px;
}

.contact-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.c-label {
  color: #94a3b8;
  min-width: 110px;
}

.c-val {
  color: #e2e8f0;
}

.c-val.strong {
  font-weight: 600;
  color: #ffffff;
}

.c-val.phone {
  font-family: monospace;
  font-size: 14px;
  color: #38bdf8;
  font-weight: 600;
}

.c-val.code {
  font-family: monospace;
  letter-spacing: 0.03em;
  color: #cbd5e1;
}

.call-btn {
  margin-left: auto;
  font-size: 12px;
  color: #ffffff;
  background: #0ea5e9;
  padding: 3px 10px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 500;
}

.call-btn:hover {
  background: #38bdf8;
}

.work-order-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wo-timeline-item {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wo-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wo-code {
  font-size: 13px;
  font-weight: 600;
  color: #f8fafc;
}

.wo-status-chip {
  font-size: 11px;
  padding: 2px 7px;
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

.wo-meta-row {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: #94a3b8;
}

.wo-meta-row strong {
  color: #f1f5f9;
}

.wo-schedule {
  font-size: 11px;
  color: #64748b;
  display: flex;
  gap: 8px;
  align-items: center;
}

.checkin-tag {
  color: #34d399;
}

.wo-remarks {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
}

.empty-wo-hint {
  text-align: center;
  padding: 24px;
  color: #64748b;
  font-size: 13px;
}

.panel-badge-idt {
  font-size: 11px;
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.12);
  border: 1px solid rgba(167, 139, 250, 0.35);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.idt-plan-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.idt-plan-item {
  background: rgba(30, 41, 59, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.idt-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.idt-role-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.badge-care {
  background: rgba(14, 165, 233, 0.2);
  color: #38bdf8;
}

.badge-med {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.badge-pt {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.badge-ast {
  background: rgba(236, 72, 153, 0.2);
  color: #f472b6;
}

.badge-qa {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.idt-staff-name {
  color: #e2e8f0;
}

.idt-staff-name strong {
  color: #ffffff;
}

.idt-freq {
  color: #94a3b8;
  font-size: 11px;
}

.idt-item-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}
</style>
