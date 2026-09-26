<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHomeCareStore } from '../home-care-store'
import type { HomeWorkOrder } from '../home-care-data'

const props = defineProps<{
  workOrder: HomeWorkOrder
}>()

const store = useHomeCareStore()

// 模拟表单与执行输入项
const vitalsBp = ref('126/82')
const vitalsHr = ref(74)
const vitalsTemp = ref('36.6')
const selectedChecklist = ref<string[]>([
  '生活起居更衣整理',
  '温水床上擦浴清洁',
  '协助受压部位翻身防压疮',
])
const serviceNotes = ref('长者精神状态良好，双下肢皮肤完整无红肿，室内通风保暖，按规定完成全项服务。')
const familySignatureName = ref('张志明 (代签长子)')
const isSubmitting = ref(false)
const actionSuccessMsg = ref('')

const isCompletedOrVerified = computed(() => {
  return props.workOrder.status === 'verified' || props.workOrder.status === 'completed'
})

// 动作 1：助老员出发前往
function handleDepart() {
  isSubmitting.value = true
  setTimeout(() => {
    store.updateWorkOrderStatus(props.workOrder.order_id, 'en_route')
    isSubmitting.value = false
    actionSuccessMsg.value = '已更新状态为【前往途中】，系统正为长者家属发送预计送达提醒。'
  }, 400)
}

// 动作 2：入户打卡（GPS与蓝牙基站核验）
function handleCheckin() {
  isSubmitting.value = true
  setTimeout(() => {
    const nowTime = new Date().toTimeString().slice(0, 5)
    store.updateWorkOrderStatus(props.workOrder.order_id, 'serving', {
      checkin_time: `${nowTime} (GPS+基站双向核验通过)`,
      checkin_location: props.workOrder.home_address,
    })
    isSubmitting.value = false
    actionSuccessMsg.value = '入户打卡成功！GPS经纬度偏差 4.8 米（合规），人脸比对置信度 99.4%，开始计时服务。'
  }, 500)
}

// 动作 3：完成服务并提交医保长护险核销
function handleFinishService() {
  isSubmitting.value = true
  setTimeout(() => {
    const nowTime = new Date().toTimeString().slice(0, 5)
    store.updateWorkOrderStatus(props.workOrder.order_id, 'verified', {
      checkout_time: `${nowTime}`,
      satisfaction_score: 5,
      remarks: `服务正常闭环。体征录入: 血压 ${vitalsBp.value} mmHg, 心率 ${vitalsHr.value} bpm, 体温 ${vitalsTemp.value} ℃。家属已完成电子双签。`,
    })
    isSubmitting.value = false
    actionSuccessMsg.value = '工单已圆满完工并完成长护险核销！医保基金结算单已自动归档。'
  }, 600)
}
</script>

<template>
  <div class="wo-modal-backdrop" @click="store.closeWorkOrderDetail()">
    <div class="wo-modal-card" @click.stop>
      <!-- 头部：工单单号与服务对象 -->
      <div class="wo-modal-header">
        <div class="header-left">
          <div class="order-id-badge font-mono">{{ workOrder.order_id }}</div>
          <h3 class="modal-title">{{ workOrder.service_name }}</h3>
          <span class="service-code-chip">{{ workOrder.service_code }}</span>
        </div>
        <button class="btn-close" @click="store.closeWorkOrderDetail()" title="关闭">✕</button>
      </div>

      <!-- 动态提示条 -->
      <div v-if="actionSuccessMsg" class="success-alert-bar">
        <span>✅ {{ actionSuccessMsg }}</span>
      </div>

      <!-- 工单流转全要素生命周期脉络 (Stepper) -->
      <div class="lifecycle-stepper">
        <div
          class="step-node"
          :class="{
            active: workOrder.status === 'accepted',
            done: ['en_route', 'serving', 'completed', 'verified'].includes(workOrder.status),
          }"
        >
          <div class="step-num">1</div>
          <div class="step-lbl">接单已指派</div>
          <div class="step-time">{{ workOrder.scheduled_time.slice(0, 5) }}</div>
        </div>

        <div class="step-line" :class="{ done: ['en_route', 'serving', 'completed', 'verified'].includes(workOrder.status) }"></div>

        <div
          class="step-node"
          :class="{
            active: workOrder.status === 'en_route',
            done: ['serving', 'completed', 'verified'].includes(workOrder.status),
          }"
        >
          <div class="step-num">2</div>
          <div class="step-lbl">前往途中</div>
          <div class="step-time">{{ workOrder.status === 'en_route' ? '途中导航' : '准时到达' }}</div>
        </div>

        <div class="step-line" :class="{ done: ['serving', 'completed', 'verified'].includes(workOrder.status) }"></div>

        <div
          class="step-node"
          :class="{
            active: workOrder.status === 'serving',
            done: ['completed', 'verified'].includes(workOrder.status),
          }"
        >
          <div class="step-num">3</div>
          <div class="step-lbl">入户服务中</div>
          <div class="step-time">{{ workOrder.checkin_time || '待入户打卡' }}</div>
        </div>

        <div class="step-line" :class="{ done: ['completed', 'verified'].includes(workOrder.status) }"></div>

        <div
          class="step-node"
          :class="{
            active: workOrder.status === 'completed',
            done: workOrder.status === 'verified',
          }"
        >
          <div class="step-num">4</div>
          <div class="step-lbl">完工双签</div>
          <div class="step-time">{{ workOrder.checkout_time || '服务照片留痕' }}</div>
        </div>

        <div class="step-line" :class="{ done: workOrder.status === 'verified' }"></div>

        <div class="step-node" :class="{ active: workOrder.status === 'verified', done: workOrder.status === 'verified' }">
          <div class="step-num">5</div>
          <div class="step-lbl">长护险核销</div>
          <div class="step-time">医保统筹90%</div>
        </div>
      </div>

      <!-- 核心内容区：左右分栏 -->
      <div class="wo-modal-body">
        <!-- 左列：长者信息与防虚构核验凭证 -->
        <div class="body-col-left">
          <div class="info-group-box">
            <h4 class="section-title">👤 服务对象与居住地址</h4>
            <div class="meta-row">
              <span class="lbl">长者姓名：</span>
              <span class="val font-bold">{{ workOrder.elderly_name }} ({{ workOrder.elderly_id }})</span>
            </div>
            <div class="meta-row">
              <span class="lbl">所属片区：</span>
              <span class="val">{{ workOrder.area_name }}</span>
            </div>
            <div class="meta-row">
              <span class="lbl">家庭门牌：</span>
              <span class="val">{{ workOrder.home_address }}</span>
            </div>
            <div class="meta-row">
              <span class="lbl">计划时段：</span>
              <span class="val highlight">{{ workOrder.scheduled_time }} (标准时长: {{ workOrder.duration_minutes }}分钟)</span>
            </div>
          </div>

          <div class="info-group-box">
            <h4 class="section-title">🩺 责任照护人员与资质</h4>
            <div class="meta-row">
              <span class="lbl">执行人员：</span>
              <span class="val font-bold">{{ workOrder.caregiver_name }}</span>
            </div>
            <div class="meta-row">
              <span class="lbl">执业角色：</span>
              <span class="val">{{ workOrder.caregiver_role }}</span>
            </div>
            <div class="meta-row">
              <span class="lbl">调度来源：</span>
              <span class="val">苏智护 12349 指挥调度中枢 (苏怡)</span>
            </div>
          </div>

          <!-- 真实入户防虚构三因子交叉存证 -->
          <div class="evidence-cross-box">
            <h4 class="section-title">🔒 医保反虚构三因子交叉存证</h4>
            <div class="evidence-item">
              <span class="ev-badge pass">因子 1: GPS空间围栏</span>
              <p class="ev-desc">
                手机基站定位与长者门牌实际经纬度偏差 <strong>4.8米</strong>（规定限差 ≤ 50米），符合入户有效半径。
              </p>
            </div>
            <div class="evidence-item">
              <span class="ev-badge pass">因子 2: 居室毫米波协同</span>
              <p class="ev-desc">
                居室 60GHz 雷达在 {{ workOrder.scheduled_time.slice(3, 8) }} 同步检测到多人微动信号，杜绝空跑与虚假打卡。
              </p>
            </div>
            <div class="evidence-item">
              <span class="ev-badge" :class="isCompletedOrVerified ? 'pass' : 'pending'">
                因子 3: 实景与双签留痕
              </span>
              <p class="ev-desc">
                {{ isCompletedOrVerified ? '家属电子签名张志明(长子)已归档，现场耗材消毒包条形码拍照已留痕。' : '待服务完毕后长者/家属签字并拍照留痕。' }}
              </p>
            </div>
          </div>
        </div>

        <!-- 右列：状态机动作与执行表单 -->
        <div class="body-col-right">
          <!-- 场景 1：已接单待上门（可触发出发前往） -->
          <div v-if="workOrder.status === 'accepted'" class="action-panel-card">
            <div class="state-prompt">
              <span class="prompt-icon">🚀</span>
              <div>
                <h4>助老员已接单，待出发前往</h4>
                <p>距长者家庭约 420 米，电瓶车预计 3-5 分钟送达。</p>
              </div>
            </div>
            <button class="btn-action-primary" :disabled="isSubmitting" @click="handleDepart">
              {{ isSubmitting ? '正在更新途中状态...' : '助老员确认立即出发前往 ➔' }}
            </button>
          </div>

          <!-- 场景 2：前往途中（可触发展开入户打卡） -->
          <div v-else-if="workOrder.status === 'en_route'" class="action-panel-card">
            <div class="state-prompt">
              <span class="prompt-icon">📍</span>
              <div>
                <h4>已到达长者楼下，请完成入户实名核验打卡</h4>
                <p>系统已自动嗅探周边蓝牙健康网关与小区基站，请比对人脸进入室内。</p>
              </div>
            </div>
            <div class="geo-verify-badge">
              <span>卫星锁定：苏州演示·城南沧浪街道 (31.2982° N, 120.5841° E)</span>
            </div>
            <button class="btn-action-primary" :disabled="isSubmitting" @click="handleCheckin">
              {{ isSubmitting ? '核验基站与人脸中...' : '到达长者住所 · 一键入户打卡 ➔' }}
            </button>
          </div>

          <!-- 场景 3：入户服务进行中（录入生命体征、核验服务项并提交完工） -->
          <div v-else-if="workOrder.status === 'serving'" class="action-panel-card">
            <div class="serving-header-pill">
              <span class="pulse-dot"></span>
              <strong>入户实操服务进行中</strong>
              <span class="checkin-stamp">打卡时刻: {{ workOrder.checkin_time }}</span>
            </div>

            <div class="service-form">
              <div class="form-section-title">1. 入户生命体征即时监测采集</div>
              <div class="vitals-inputs-row">
                <div class="vital-field">
                  <label>血压 (mmHg)</label>
                  <input v-model="vitalsBp" class="vital-input" placeholder="126/82" />
                </div>
                <div class="vital-field">
                  <label>心率 (次/分)</label>
                  <input v-model.number="vitalsHr" class="vital-input" type="number" placeholder="74" />
                </div>
                <div class="vital-field">
                  <label>体温 (℃)</label>
                  <input v-model="vitalsTemp" class="vital-input" placeholder="36.6" />
                </div>
              </div>

              <div class="form-section-title">2. 长护险标准化服务内容核验清单</div>
              <div class="checklist-grid">
                <label class="check-item">
                  <input type="checkbox" checked disabled />
                  <span>生活起居整理与卧室内通风</span>
                </label>
                <label class="check-item">
                  <input type="checkbox" checked disabled />
                  <span>床上温水擦浴与更衣照料</span>
                </label>
                <label class="check-item">
                  <input type="checkbox" checked disabled />
                  <span>协助受压部位翻身叩背防压疮</span>
                </label>
                <label class="check-item">
                  <input type="checkbox" checked disabled />
                  <span>居家用药辅导与安全饮水协助</span>
                </label>
              </div>

              <div class="form-section-title">3. 服务情况备忘与长者反馈</div>
              <textarea v-model="serviceNotes" class="notes-textarea" rows="2"></textarea>

              <div class="form-section-title">4. 长者 / 家属电子签名确认</div>
              <div class="signature-box">
                <div class="sign-meta">
                  <span>签署人：<strong>{{ familySignatureName }}</strong></span>
                  <span class="sign-tag">已通过微信小程序免密认证</span>
                </div>
                <div class="sign-preview">
                  <span class="handwrite-font">{{ familySignatureName.slice(0, 3) }}</span>
                  <span class="stamp-verified">✓ 电子双签留痕</span>
                </div>
              </div>

              <button class="btn-action-primary emerald" :disabled="isSubmitting" @click="handleFinishService">
                {{ isSubmitting ? '正在归档存证并提交核销...' : '完成服务并提交医保长护险核销 ➔' }}
              </button>
            </div>
          </div>

          <!-- 场景 4：已核销或已完工归档 -->
          <div v-else class="action-panel-card verified">
            <div class="verified-trophy">
              <span class="trophy-icon">🏅</span>
              <div>
                <h4>长护险定点服务已闭环核销</h4>
                <p>服务工单经医保反虚构算法与质控督导稽核，统筹基金按标准核销。</p>
              </div>
            </div>

            <div class="settlement-summary-box">
              <div class="set-row">
                <span>长护险定点标准核销费：</span>
                <strong>￥{{ (workOrder.ltc_fund_subsidy / 0.9).toFixed(2) }}</strong>
              </div>
              <div class="set-row">
                <span>医保统筹基金支付 (90%)：</span>
                <strong class="cyan">￥{{ workOrder.ltc_fund_subsidy.toFixed(2) }}</strong>
              </div>
              <div class="set-row">
                <span>个人自负缴纳 (10%)：</span>
                <strong>￥{{ (workOrder.ltc_fund_subsidy * (0.1 / 0.9)).toFixed(2) }}</strong>
              </div>
              <div class="set-row">
                <span>满意度电话回访：</span>
                <span class="stars">⭐⭐⭐⭐⭐ 5.0 分 (极满意)</span>
              </div>
            </div>

            <div class="receipt-footer">
              <span class="rc-label">长护险电子核销回执编号：</span>
              <span class="font-mono text-cyan">SZ-LTC-2026-{{ workOrder.order_id.slice(-6) }}-V</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wo-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 15, 29, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.wo-modal-card {
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 16px;
  width: 100%;
  max-width: 960px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.wo-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  background: rgba(30, 41, 59, 0.6);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-id-badge {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0;
}

.service-code-chip {
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
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

.success-alert-bar {
  background: rgba(16, 185, 129, 0.15);
  border-bottom: 1px solid rgba(16, 185, 129, 0.3);
  padding: 8px 24px;
  color: #34d399;
  font-size: 13px;
  font-weight: 500;
}

/* Stepper */
.lifecycle-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 36px;
  background: rgba(15, 23, 42, 0.95);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.step-node.active, .step-node.done {
  opacity: 1;
}

.step-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #334155;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.step-node.active .step-num {
  background: #0ea5e9;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(14, 165, 233, 0.5);
}

.step-node.done .step-num {
  background: #10b981;
  color: #ffffff;
}

.step-lbl {
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
}

.step-time {
  font-size: 10px;
  color: #94a3b8;
}

.step-line {
  flex: 1;
  height: 2px;
  background: #334155;
  margin: 0 10px 18px;
}

.step-line.done {
  background: #10b981;
}

/* Body */
.wo-modal-body {
  display: grid;
  grid-template-columns: 1.1fr 1.3fr;
  gap: 20px;
  padding: 20px 24px;
  overflow-y: auto;
}

.body-col-left, .body-col-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-group-box {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 10px;
  padding: 14px 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #38bdf8;
  margin: 0 0 10px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}

.meta-row .lbl {
  color: #94a3b8;
}

.meta-row .val {
  color: #e2e8f0;
}

.meta-row .val.highlight {
  color: #fbbf24;
  font-weight: 600;
}

.evidence-cross-box {
  background: rgba(15, 23, 42, 0.8);
  border: 1px dashed rgba(56, 189, 248, 0.25);
  border-radius: 10px;
  padding: 14px 16px;
}

.evidence-item {
  margin-bottom: 10px;
}

.ev-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 4px;
}

.ev-badge.pass {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.ev-badge.pending {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.ev-desc {
  font-size: 11px;
  color: #cbd5e1;
  line-height: 1.4;
  margin: 0;
}

/* Right Col Actions */
.action-panel-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 20px;
}

.state-prompt {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}

.prompt-icon {
  font-size: 32px;
}

.state-prompt h4 {
  font-size: 15px;
  color: #f1f5f9;
  margin: 0 0 4px;
}

.state-prompt p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.geo-verify-badge {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  color: #38bdf8;
  margin-bottom: 20px;
}

.btn-action-primary {
  width: 100%;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: #ffffff;
  border: none;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);
  transition: all 0.2s ease;
}

.btn-action-primary:hover {
  background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
}

.btn-action-primary.emerald {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
}

.btn-action-primary.emerald:hover {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
}

.serving-header-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 8px 12px;
  border-radius: 8px;
  color: #34d399;
  font-size: 12px;
  margin-bottom: 16px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

.checkin-stamp {
  margin-left: auto;
  font-size: 11px;
  color: #cbd5e1;
}

.service-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.vitals-inputs-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.vital-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vital-field label {
  font-size: 10px;
  color: #94a3b8;
}

.vital-input {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 6px 10px;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
}

.checklist-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(15, 23, 42, 0.5);
  padding: 10px;
  border-radius: 6px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #e2e8f0;
}

.notes-textarea {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 8px 10px;
  color: #cbd5e1;
  font-size: 12px;
  resize: vertical;
}

.signature-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px dashed rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  padding: 10px 14px;
}

.sign-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.sign-tag {
  color: #38bdf8;
}

.sign-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 4px;
}

.handwrite-font {
  font-family: cursive, 'STKaiti', sans-serif;
  font-size: 18px;
  color: #fbbf24;
  letter-spacing: 2px;
}

.stamp-verified {
  font-size: 11px;
  color: #34d399;
  font-weight: 600;
}

/* Verified Stage */
.action-panel-card.verified {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.verified-trophy {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.trophy-icon {
  font-size: 32px;
}

.verified-trophy h4 {
  font-size: 15px;
  color: #34d399;
  margin: 0 0 2px;
}

.verified-trophy p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.settlement-summary-box {
  background: rgba(15, 23, 42, 0.8);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.set-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #cbd5e1;
}

.set-row .cyan {
  color: #38bdf8;
}

.set-row .stars {
  color: #fbbf24;
}

.receipt-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}

.text-cyan {
  color: #38bdf8;
}
</style>
