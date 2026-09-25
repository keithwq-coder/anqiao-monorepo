<script setup lang="ts">
// 医保监管今日页（阶段 C）
import { ref, onMounted, computed } from 'vue'
import {
  getLtcApplications,
  getWorkOrders,
  getSupervisionCases,
  createSupervisionCase,
} from '../../../api/client'
import {
  applicationAction,
  getApplicationMaterials,
  getApplicationTimeline,
  getApplicationSla,
  type ApplicationActionResult,
} from '../../../api/ltc-application'
import type { LtcApplication, WorkOrder, SupervisionCase } from '../../../api/types'
import ObjectContextHeader from '../components/ObjectContextHeader.vue'
import MaterialVersionList from '../components/MaterialVersionList.vue'
import HandoffTimeline from '../components/HandoffTimeline.vue'
import ActionReceipt from '../components/ActionReceipt.vue'
import StatusPill from '../components/StatusPill.vue'
import { stateLabel } from '../state-labels'

const applications = ref<LtcApplication[]>([])
const workOrders = ref<WorkOrder[]>([])
const cases = ref<SupervisionCase[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// detail
const selected = ref<LtcApplication | null>(null)
const materials = ref<Awaited<ReturnType<typeof getApplicationMaterials>> | null>(null)
const timeline = ref<Awaited<ReturnType<typeof getApplicationTimeline>> | null>(null)
const sla = ref<Awaited<ReturnType<typeof getApplicationSla>> | null>(null)
const receipt = ref<ApplicationActionResult['receipt']>(null)
const actionBusy = ref(false)
const actionError = ref<string | null>(null)
const confirmAction = ref<'finalize' | 'suspend' | 'release' | 'sample' | null>(null)
const reasonDraft = ref('')

const openApps = computed(() =>
  applications.value.filter((a) => ['assess_pending', 'materials_pass', 'suspended', 'approved', 'submitted', 'materials_review'].includes(a.status)),
)

async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const [a, w, c] = await Promise.all([getLtcApplications(), getWorkOrders(), getSupervisionCases()])
    applications.value = a.list || []
    workOrders.value = w.list || []
    cases.value = c.list || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function openApp(app: LtcApplication) {
  selected.value = app
  receipt.value = null
  actionError.value = null
  const [m, t, s] = await Promise.all([
    getApplicationMaterials(app.application_id).catch(() => null),
    getApplicationTimeline(app.application_id).catch(() => null),
    getApplicationSla(app.application_id).catch(() => null),
  ])
  materials.value = m
  timeline.value = t
  sla.value = s
}

function closeDetail() {
  selected.value = null
  receipt.value = null
  materials.value = null
  timeline.value = null
  sla.value = null
  confirmAction.value = null
  reasonDraft.value = ''
}

async function doFinalize() {
  if (!selected.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    const res = await applicationAction(selected.value.application_id, 'finalize', {
      reason: reasonDraft.value || '终审核定通过',
    })
    receipt.value = res.receipt
    selected.value = res.application
    await loadAll()
    await openApp(res.application)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '核定失败'
  } finally {
    actionBusy.value = false
    confirmAction.value = null
    reasonDraft.value = ''
  }
}

async function doSupervision(action: 'suspend' | 'release' | 'sample') {
  if (!selected.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    const sup = await createSupervisionCase({
      target_id: selected.value.application_id,
      action,
      remarks: reasonDraft.value || (action === 'suspend' ? '监管暂缓核验' : action === 'release' ? '解除暂缓' : '抽审核验'),
    })
    receipt.value = {
      receipt_id: sup.supervision_id,
      object_id: selected.value.application_id,
      state: action === 'suspend' ? 'suspended' : action === 'release' ? 'assess_pending' : 'sample',
      version: 1,
      occurred_at: sup.created_at,
      next_owner_role: action === 'suspend' ? 'insurer' : 'medical',
    }
    await loadAll()
    const refreshed = applications.value.find((a) => a.application_id === selected.value!.application_id)
    if (refreshed) await openApp(refreshed)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '监管动作失败'
  } finally {
    actionBusy.value = false
    confirmAction.value = null
    reasonDraft.value = ''
  }
}

function beginConfirm(kind: 'finalize' | 'suspend' | 'release' | 'sample') {
  confirmAction.value = kind
  reasonDraft.value = ''
}

onMounted(loadAll)
</script>

<template>
  <div class="medical-today">
    <div class="row-head">
      <div>
        <h2>今日监管与终审</h2>
        <p class="sub">待终审 {{ openApps.filter((a) => ['assess_pending', 'materials_pass'].includes(a.status)).length }}
          · 暂缓 {{ openApps.filter((a) => a.status === 'suspended').length }}
          · 工单 {{ workOrders.filter((w) => w.status !== 'ratified').length }}
          · 案件 {{ cases.length }}</p>
      </div>
      <button type="button" class="btn" :disabled="loading" @click="loadAll">刷新</button>
    </div>

    <div v-if="error" class="err">{{ error }}</div>

    <div class="grid-2">
      <section class="panel">
        <h3>队列申请</h3>
        <div v-if="!openApps.length" class="empty">今日监管待办已完成</div>
        <ul v-else class="list">
          <li v-for="a in openApps" :key="a.application_id">
            <button type="button" class="list-btn" @click="openApp(a)">
              <span class="id mono">{{ a.application_id }}</span>
              <StatusPill :state="a.status" object-type="application" />
              <span class="obj">{{ a.applicant_id }}</span>
              <span class="meta">{{ a.updated_at || a.created_at }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h3>监管工单</h3>
        <div v-if="!workOrders.length" class="empty">暂无在办工单</div>
        <ul v-else class="list">
          <li v-for="w in workOrders" :key="w.work_order_id">
            <div class="row-item">
              <span class="id mono">{{ w.work_order_id }}</span>
              <StatusPill :state="w.status" object-type="work_order" />
              <span class="meta">{{ w.order_type || w.status }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- 详情 -->
    <div v-if="selected" class="detail-wrap">
      <ObjectContextHeader
        object-type="application"
        :object-id="selected.application_id"
        :state="selected.status"
        :responsible="(selected as any).handoff?.to || 'medical'"
        :due-at="sla?.due_at"
        :sla-status="sla?.sla_status"
        back-label="返回队列"
        @back="closeDetail"
      />

      <div class="actions">
        <button
          type="button"
          class="btn primary"
          :disabled="actionBusy || selected.status === 'suspended'"
          :title="selected.status === 'suspended' ? '存在有效暂缓门禁' : '终审核定'"
          @click="beginConfirm('finalize')"
        >
          终审核定
        </button>
        <button type="button" class="btn warn" :disabled="actionBusy" @click="beginConfirm('suspend')">监管暂缓</button>
        <button type="button" class="btn" :disabled="actionBusy || selected.status !== 'suspended'" @click="beginConfirm('release')">解除暂缓</button>
        <button type="button" class="btn" :disabled="actionBusy" @click="beginConfirm('sample')">发起抽审</button>
        <button type="button" class="btn" :disabled="actionBusy" @click="openApp(selected)">刷新详情</button>
      </div>

      <!-- 二次确认 -->
      <div v-if="confirmAction" class="confirm-box" role="dialog">
        <p class="confirm-title">确认{{ confirmAction === 'finalize' ? '终审核定' : confirmAction === 'suspend' ? '监管暂缓' : confirmAction === 'release' ? '解除暂缓' : '发起抽审' }}</p>
        <ul class="confirm-facts">
          <li>对象：{{ selected.application_id }} / {{ selected.applicant_id }}</li>
          <li>目标状态：{{ confirmAction === 'finalize' ? '已核定' : confirmAction === 'suspend' ? '监管暂缓' : confirmAction === 'release' ? '恢复办理' : '抽审中' }}</li>
          <li>接收方：{{ confirmAction === 'suspend' ? '经办机构' : confirmAction === 'release' ? '原办理节点' : confirmAction === 'sample' ? '监管核验队列' : '家属公开结果' }}</li>
          <li>本次操作将记录经办人、时间和处理意见</li>
        </ul>
        <label class="reason-label">
          原因/意见
          <textarea v-model="reasonDraft" rows="2" placeholder="请填写正式意见或核验要求"></textarea>
        </label>
        <div class="confirm-actions">
          <button type="button" class="btn" :disabled="actionBusy" @click="confirmAction = null">取消</button>
          <button
            type="button"
            class="btn primary"
            :disabled="actionBusy || (confirmAction !== 'finalize' && !reasonDraft.trim() && confirmAction !== 'sample')"
            @click="confirmAction === 'finalize' ? doFinalize() : doSupervision(confirmAction as any)"
          >
            {{ actionBusy ? '提交中…' : '确认提交' }}
          </button>
        </div>
      </div>

      <p v-if="actionError" class="err">{{ actionError }}</p>

      <ActionReceipt
        v-if="receipt"
        :receipt="receipt"
        object-type="application"
        @back="closeDetail"
        @continue="confirmAction = null"
      />

      <div class="grid-2">
        <MaterialVersionList
          v-if="materials"
          :items="materials.list"
          :application-status="materials.status"
        />
        <HandoffTimeline
          v-if="timeline"
          :events="timeline.list"
          :next-action="timeline.next_action"
          :published-result="timeline.published_result"
        />
      </div>

      <section class="panel evidence">
        <h3>证据链（材料版本 → 快照 → 洞察 → 经办意见 → 结算）</h3>
        <ol class="evidence-steps">
          <li><StatusPill :state="selected.status" object-type="application" /> 材料与申请状态</li>
          <li class="muted">评估快照 / 洞察：从任务详情进入（经办提交后）</li>
          <li class="muted">结算初审记录：结算模块</li>
        </ol>
        <p v-if="selected.status === 'suspended'" class="hold-note">
          有效暂缓门禁生效：解除前不可终审。补证完成后请「解除暂缓」。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.medical-today {
  padding: 0 0 16px;
}
.row-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.row-head h2 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}
.sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 960px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
}
.panel h3 {
  margin: 0 0 10px;
  font-size: 14px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.list-btn,
.row-item {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  text-align: left;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  color: inherit;
}
.list-btn {
  cursor: pointer;
}
.list-btn:hover {
  border-color: #93c5fd;
}
.id {
  font-weight: 700;
  font-size: 12px;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
.obj,
.meta {
  font-size: 12px;
  color: #64748b;
}
.empty {
  color: #64748b;
  font-size: 13px;
  padding: 12px;
}
.err {
  color: #b91c1c;
  font-size: 13px;
  margin: 8px 0;
}
.detail-wrap {
  margin-top: 16px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.btn.warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #b45309;
}
.confirm-box {
  border: 1px solid #fde68a;
  background: #fffbeb;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.confirm-title {
  margin: 0 0 8px;
  font-weight: 700;
  font-size: 14px;
}
.confirm-facts {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}
.reason-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #78350f;
  margin-bottom: 10px;
}
.reason-label textarea {
  border: 1px solid #fcd34d;
  border-radius: 6px;
  padding: 8px;
  font: inherit;
  resize: vertical;
}
.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.evidence-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
}
.muted {
  color: #94a3b8;
}
.hold-note {
  margin: 10px 0 0;
  font-size: 13px;
  color: #b91c1c;
}
</style>
