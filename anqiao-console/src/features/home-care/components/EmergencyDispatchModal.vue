<script setup lang="ts">
import { ref } from 'vue'
import { useHomeCareStore } from '../home-care-store'

const store = useHomeCareStore()

const isCallingCaregiver = ref(false)
const isCallingFamily = ref(false)
const isLiaison120Active = ref(false)
const isResolved = ref(false)
const resolveNote = ref('助老员黄建国已到达现场，长者在卫浴间滑倒但意识清醒，无骨折，已协助起身移至床上并测体温血压。')

function handleCallCaregiver() {
  isCallingCaregiver.value = true
  setTimeout(() => {
    isCallingCaregiver.value = false
    alert('【12349 坐席已接通】机动助老员黄建国通话中：“已在沧浪新村 18 幢楼下，马上上楼！”')
  }, 800)
}

function handleCallFamily() {
  isCallingFamily.value = true
  setTimeout(() => {
    isCallingFamily.value = false
    alert('【12349 坐席已接通】家属郭建强(长子)通话中：“感谢中心第一时间通知，我正在赶回家中！”')
  }, 800)
}

function handle120Liaison() {
  isLiaison120Active.value = true
}

function handleConfirmResolved() {
  isResolved.value = true
  // 同步更新工单或长者状态
  const targetElder = store.elders.value.find((e) => e.elderly_id === 'SZ-ELD-10007')
  if (targetElder) {
    targetElder.current_state = '在家长者'
    targetElder.devices.radar_bathroom.fall_alert = false
  }
}
</script>

<template>
  <div class="emergency-modal-backdrop" @click="store.closeEmergencyModal()">
    <div class="emergency-modal-card" @click.stop>
      <!-- 头部 -->
      <div class="em-header">
        <div class="em-header-left">
          <span class="siren-icon">🚨</span>
          <div>
            <h3>苏智护 12349 · 突发跌倒与 SOS 应急指挥调度中枢</h3>
            <p>苏州市姑苏区智护居家养老服务中心 · 7×24H 智慧安居秒级出警中枢</p>
          </div>
        </div>
        <button class="btn-close" @click="store.closeEmergencyModal()" title="关闭">✕</button>
      </div>

      <!-- 报警核心横幅 -->
      <div class="em-banner" :class="isResolved ? 'resolved' : 'active'">
        <div class="banner-badge">{{ isResolved ? '✓ 险情已解除' : '⚠️ 最高优先级告警' }}</div>
        <div class="banner-body">
          <div class="banner-title">
            沧浪片区 · 沧浪新村 18 幢 402 室 · <strong>郭振华 爷爷 (82岁 · 独居)</strong>
          </div>
          <p class="banner-desc">
            卫浴间 60GHz 毫米波雷达于 <strong>今日 07:42:15</strong> 监测到人体急速下坠，持续卧地静止超过 8 分钟无体征恢复。
          </p>
        </div>
      </div>

      <!-- 核心处置内容 -->
      <div class="em-body-grid">
        <!-- 左列：协同处置时间轴 -->
        <div class="em-col-timeline">
          <h4 class="col-title">⏱️ 突发跌倒指挥处置时间链 (全流程留痕)</h4>

          <div class="timeline-list">
            <div class="tl-item done">
              <span class="tl-dot"></span>
              <div class="tl-content">
                <span class="tl-time">07:42:15</span>
                <strong>卫浴毫米波雷达触发下坠报警</strong>
                <p>三维姿态点云突变，Z轴落差1.2米，卧地信号确立。</p>
              </div>
            </div>

            <div class="tl-item done">
              <span class="tl-dot"></span>
              <div class="tl-content">
                <span class="tl-time">07:42:30</span>
                <strong>苏智护 12349 调度中枢自动截获推送</strong>
                <p>坐席苏怡接收报警弹窗，立即启动急救指派流程。</p>
              </div>
            </div>

            <div class="tl-item done">
              <span class="tl-dot"></span>
              <div class="tl-content">
                <span class="tl-time">07:43:00</span>
                <strong>智能指派机动助老员出警 (黄建国)</strong>
                <p>网格定位显示黄建国距离仅 420 米，已接单并携带便携急救包出发。</p>
              </div>
            </div>

            <div class="tl-item" :class="isResolved ? 'done' : 'ongoing'">
              <span class="tl-dot"></span>
              <div class="tl-content">
                <span class="tl-time">07:46:20</span>
                <strong>助老员到达现场并入户施救</strong>
                <p>{{ isResolved ? '已入户排查，长者意识清醒，无生命危险，险情解除。' : '机动人员正在电梯/楼梯上行中，预计1分钟内入户。' }}</p>
              </div>
            </div>
          </div>

          <!-- 120 急救联动卡片 -->
          <div v-if="isLiaison120Active" class="ambulance-liaison-box">
            <span class="amb-badge">🚑 苏州市 120 绿色急救网络已对接</span>
            <p>苏州市立医院急救站已获授长者健康档案（高血压、冠心病既往史），救护车备勤待命。</p>
          </div>
        </div>

        <!-- 右列：出警调度协同操作卡 -->
        <div class="em-col-actions">
          <h4 class="col-title">📞 应急指挥协同与多方联动</h4>

          <!-- 机动助老员 -->
          <div class="action-card-item">
            <div class="ac-head">
              <span class="ac-avatar">👨‍⚕️</span>
              <div>
                <strong>当值机动助老员：黄建国</strong>
                <span>执业资质：红十字急救员 · 沧浪片区骨干</span>
              </div>
            </div>
            <div class="ac-meta">当前距离：约 120 米 · 正在上楼</div>
            <button class="btn-call-action" :disabled="isCallingCaregiver" @click="handleCallCaregiver">
              {{ isCallingCaregiver ? '正在拨通电话...' : '📞 呼叫机动助老员 (13606214578)' }}
            </button>
          </div>

          <!-- 紧急联系人家属 -->
          <div class="action-card-item">
            <div class="ac-head">
              <span class="ac-avatar">👨</span>
              <div>
                <strong>紧急联系人：郭建强 (长子)</strong>
                <span>居住地址：苏州市吴中区碧波花园 6 幢</span>
              </div>
            </div>
            <div class="ac-meta">通知状态：已发送跌倒告警短信并推送小程序</div>
            <button class="btn-call-action family" :disabled="isCallingFamily" @click="handleCallFamily">
              {{ isCallingFamily ? '正在拨通电话...' : '📞 呼叫长者家属 (13912784512)' }}
            </button>
          </div>

          <!-- 120 联动按钮 -->
          <div class="action-card-item">
            <div class="ac-head">
              <span class="ac-avatar">🚑</span>
              <div>
                <strong>苏州市医疗急救中心 (120 联动)</strong>
                <span>市立医院本部急救分站 · 绿色就医绿色通道</span>
              </div>
            </div>
            <button
              class="btn-call-action ambulance"
              :disabled="isLiaison120Active"
              @click="handle120Liaison"
            >
              {{ isLiaison120Active ? '✓ 已建立 120 绿色急救联动备勤' : '⚡ 启动 120 救护车绿色就医联动' }}
            </button>
          </div>

          <!-- 现场解除闭环 -->
          <div class="resolve-box">
            <label class="resolve-lbl">现场险情处置小结：</label>
            <textarea v-model="resolveNote" class="resolve-input" rows="2"></textarea>
            <button
              class="btn-confirm-resolve"
              :disabled="isResolved"
              @click="handleConfirmResolved"
            >
              {{ isResolved ? '✓ 险情已成功闭环归档' : '确认现场险情解除并归档 ➔' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emergency-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1060;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.emergency-modal-card {
  background: #0f172a;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 16px;
  width: 100%;
  max-width: 980px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(239, 68, 68, 0.25);
}

.em-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%);
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
}

.em-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.siren-icon {
  font-size: 28px;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.em-header-left h3 {
  font-size: 17px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0 0 2px;
}

.em-header-left p {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* Banner */
.em-banner {
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.em-banner.active {
  background: rgba(239, 68, 68, 0.12);
}

.em-banner.resolved {
  background: rgba(16, 185, 129, 0.12);
}

.banner-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.em-banner.active .banner-badge {
  background: rgba(239, 68, 68, 0.25);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.em-banner.resolved .banner-badge {
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.banner-title {
  font-size: 14px;
  color: #f1f5f9;
  margin-bottom: 2px;
}

.banner-desc {
  font-size: 12px;
  color: #cbd5e1;
  margin: 0;
}

/* Body Grid */
.em-body-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.1fr;
  gap: 20px;
  padding: 20px 24px;
  overflow-y: auto;
}

.col-title {
  font-size: 13px;
  font-weight: 600;
  color: #38bdf8;
  margin: 0 0 14px;
}

/* Timeline */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  padding-left: 18px;
}

.timeline-list::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: #334155;
}

.tl-item {
  position: relative;
}

.tl-dot {
  position: absolute;
  left: -18px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #64748b;
  border: 2px solid #0f172a;
}

.tl-item.done .tl-dot {
  background: #10b981;
}

.tl-item.ongoing .tl-dot {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

.tl-content {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
}

.tl-time {
  font-size: 10px;
  color: #38bdf8;
  font-weight: 600;
  display: block;
  margin-bottom: 2px;
}

.tl-content strong {
  font-size: 12px;
  color: #f1f5f9;
  display: block;
  margin-bottom: 2px;
}

.tl-content p {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.4;
}

.ambulance-liaison-box {
  margin-top: 16px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px dashed rgba(14, 165, 233, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.amb-badge {
  font-size: 11px;
  font-weight: 600;
  color: #38bdf8;
  display: block;
  margin-bottom: 4px;
}

.ambulance-liaison-box p {
  font-size: 11px;
  color: #cbd5e1;
  margin: 0;
  line-height: 1.4;
}

/* Actions Col */
.em-col-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card-item {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
}

.ac-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.ac-avatar {
  font-size: 24px;
}

.ac-head strong {
  font-size: 13px;
  color: #f1f5f9;
  display: block;
}

.ac-head span {
  font-size: 11px;
  color: #94a3b8;
  display: block;
}

.ac-meta {
  font-size: 11px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.btn-call-action {
  width: 100%;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-call-action:hover {
  background: rgba(56, 189, 248, 0.25);
}

.btn-call-action.family {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border-color: rgba(168, 85, 247, 0.3);
}

.btn-call-action.family:hover {
  background: rgba(168, 85, 247, 0.25);
}

.btn-call-action.ambulance {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-call-action.ambulance:hover {
  background: rgba(239, 68, 68, 0.25);
}

.resolve-box {
  margin-top: 6px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  padding: 12px;
}

.resolve-lbl {
  font-size: 11px;
  color: #94a3b8;
  display: block;
  margin-bottom: 6px;
}

.resolve-input {
  width: 100%;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 6px 10px;
  color: #e2e8f0;
  font-size: 11px;
  box-sizing: border-box;
  margin-bottom: 10px;
  resize: vertical;
}

.btn-confirm-resolve {
  width: 100%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  border: none;
  padding: 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transition: all 0.2s ease;
}

.btn-confirm-resolve:hover {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
}
</style>
