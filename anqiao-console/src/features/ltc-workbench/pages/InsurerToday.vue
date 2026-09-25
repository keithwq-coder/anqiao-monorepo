<script setup lang="ts">
// 经办今日页（阶段 C）
import { ref, onMounted, computed } from 'vue'
import { http } from '../../../api/http'
import {
  getLtcApplications,
  getAssessmentTasks,
  getSettlements,
  getAssessors,
  dispatchAssessmentTask,
  reviewSettlement,
} from '../../../api/client'
import {
  applicationAction,
  getApplicationMaterials,
  getApplicationTimeline,
  getApplicationSla,
  type ApplicationActionResult,
} from '../../../api/ltc-application'
import type { LtcApplication, AssessmentTask, Settlement, AssessorProfile } from '../../../api/types'
import ObjectContextHeader from '../components/ObjectContextHeader.vue'
import MaterialVersionList from '../components/MaterialVersionList.vue'
import HandoffTimeline from '../components/HandoffTimeline.vue'
import ActionReceipt from '../components/ActionReceipt.vue'
import StatusPill from '../components/StatusPill.vue'

const applications = ref<LtcApplication[]>([])
const tasks = ref<AssessmentTask[]>([])
const settlements = ref<Settlement[]>([])
const assessors = ref<AssessorProfile[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const selected = ref<LtcApplication | null>(null)
const materials = ref<Awaited<ReturnType<typeof getApplicationMaterials>> | null>(null)
const timeline = ref<Awaited<ReturnType<typeof getApplicationTimeline>> | null>(null)
const sla = ref<Awaited<ReturnType<typeof getApplicationSla>> | null>(null)
const receipt = ref<ApplicationActionResult['receipt']>(null)
const actionBusy = ref(false)
const actionError = ref<string | null>(null)
const confirmKind = ref<'accept' | 'return' | 'pass' | 'dispatch' | 'pre_review' | null>(null)
const reasonDraft = ref('')
const assessorPick = ref('')
const confirmTask = ref<AssessmentTask | null>(null)

const pendingAccept = computed(() => applications.value.filter((a) => a.status === 'submitted'))
const pendingDispatch = computed(() => applications.value.filter((a) => ['materials_pass', 'materials_review'].includes(a.status)))
const pendingReview = computed(() => tasks.value.filter((t) => t.status === 'completed'))
const pendingSettle = computed(() => settlements.value.filter((s) => s.status === 'declared'))
const returnQueue = computed(() => tasks.value.filter((t) => t.status === 'returned'))

async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const [a, t, s, asr] = await Promise.all([
      getLtcApplications(),
      getAssessmentTasks(),
      getSettlements(),
      getAssessors().catch(() => ({ list: [], total: 0 })),
    ])
    applications.value = a.list || []
    tasks.value = t.list || []
    settlements.value = s.list || []
    assessors.value = asr.list || []
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
  confirmKind.value = null
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
  confirmKind.value = null
  reasonDraft.value = ''
  confirmTask.value = null
}

async function runAppAction(kind: 'accept' | 'return' | 'pass') {
  if (!selected.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    const action = kind === 'accept' ? 'accept' : kind === 'return' ? 'return_materials' : 'materials_pass'
    const res = await applicationAction(selected.value.application_id, action, {
      reason: reasonDraft.value || undefined,
    })
    receipt.value = res.receipt
    await loadAll()
    await openApp(res.application)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
    reasonDraft.value = ''
  }
}

async function runDispatch() {
  if (!selected.value || !assessorPick.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    // 先材料通过再派单
    if (selected.value.status === 'submitted' || selected.value.status === 'materials_review') {
      await applicationAction(selected.value.application_id, 'materials_pass')
    }
    await dispatchAssessmentTask({
      application_id: selected.value.application_id,
      assessor_account: assessorPick.value,
    })
    receipt.value = {
      receipt_id: 'RCPT-DISPATCH-' + Date.now().toString(36).toUpperCase(),
      object_id: selected.value.application_id,
      state: 'assess_pending',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'assessor',
    }
    await loadAll()
    const refreshed = applications.value.find((a) => a.application_id === selected.value!.application_id)
    if (refreshed) await openApp(refreshed)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '派单失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
    assessorPick.value = ''
  }
}

async function runReturnTask() {
  if (!confirmTask.value || !reasonDraft.value.trim()) return
  actionBusy.value = true
  actionError.value = null
  try {
    await http.post(
      `/v1/ltc/tasks/${encodeURIComponent(confirmTask.value.task_id)}/return`,
      { reason: reasonDraft.value },
    )
    receipt.value = {
      receipt_id: 'RCPT-RET-' + Date.now().toString(36).toUpperCase(),
      object_id: confirmTask.value.task_id,
      state: 'returned',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'assessor',
    }
    confirmTask.value = null
    reasonDraft.value = ''
    await loadAll()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '退回失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
  }
}

async function runApproveResult(resultId: string) {
  actionBusy.value = true
  actionError.value = null
  try {
    await http.post(`/v1/ltc/reviews/${encodeURIComponent(resultId)}/approve`, {})
    receipt.value = {
      receipt_id: 'RCPT-APR-' + Date.now().toString(36).toUpperCase(),
      object_id: resultId,
      state: 'approved',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'medical',
    }
    await loadAll()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '审核失败'
  } finally {
    actionBusy.value = false
  }
}

async function runPreReview(settlementId: string) {
  actionBusy.value = true
  actionError.value = null
  try {
    await reviewSettlement(settlementId, { action: 'pre_review', pass: true })
    receipt.value = {
      receipt_id: 'RCPT-SET-' + Date.now().toString(36).toUpperCase(),
      object_id: settlementId,
      state: 'pre_reviewed',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'medical',
    }
    await loadAll()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '初审失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="insurer-today">
    <div class="row-head">
      <div>
        <h2>今日经办</h2>
        <p class="sub">
          待受理 {{ pendingAccept.length }} · 待派单 {{ pendingDispatch.length }} ·
          待审核 {{ pendingReview.length }} · 结算初审 {{ pendingSettle.length }} ·
          退回 {{ returnQueue.length }}
        </p>
      </div>
      <button type="button" class="btn" :disabled="loading" @click="loadAll">刷新</button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="grid-2">
      <section class="panel">
        <h3>待受理 / 待派单</h3>
        <div v-if="!pendingAccept.length && !pendingDispatch.length" class="empty">今日待办已完成</div>
        <ul v-else class="list">
          <li v-for="a in [...pendingAccept, ...pendingDispatch]" :key="a.application_id">
            <button type="button" class="list-btn" @click="openApp(a)">
              <span class="id mono">{{ a.application_id }}</span>
              <StatusPill :state="a.status" object-type="application" />
              <span class="meta">{{ a.applicant_id }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h3>待审核 / 退回修改</h3>
        <div v-if="!pendingReview.length && !returnQueue.length" class="empty">无待审核任务</div>
        <ul v-else class="list">
          <li v-for="t in [...pendingReview, ...returnQueue]" :key="t.task_id">
            <div class="row-item">
              <span class="id mono">{{ t.task_id }}</span>
              <StatusPill :state="t.status" object-type="task" />
              <span class="meta">{{ t.application_id }}</span>
              <span class="spacer"></span>
              <button
                v-if="t.status === 'completed' && (t as any).result_id"
                type="button"
                class="btn primary sm"
                :disabled="actionBusy"
                @click="runApproveResult((t as any).result_id)"
              >
                审核通过
              </button>
              <button
                v-if="t.status === 'completed' || t.status === 'assessing'"
                type="button"
                class="btn sm"
                :disabled="actionBusy"
                @click="confirmKind = 'return'; confirmTask = t; reasonDraft = ''"
              >
                退回修改
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <section class="panel" style="margin-top: 12px">
      <h3>结算初审</h3>
      <div v-if="!pendingSettle.length" class="empty">无待初审结算</div>
      <ul v-else class="list">
        <li v-for="s in pendingSettle" :key="s.settlement_id">
          <div class="row-item">
            <span class="id mono">{{ s.settlement_id }}</span>
            <StatusPill :state="s.status" object-type="settlement" />
            <span class="meta">¥{{ s.amount }} · {{ s.period }}</span>
            <span class="spacer"></span>
            <button type="button" class="btn primary sm" :disabled="actionBusy" @click="runPreReview(s.settlement_id)">
              确认初审
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 任务退回确认 -->
    <div v-if="confirmKind === 'return' && confirmTask" class="confirm-box">
      <p class="confirm-title">确认退回任务修改</p>
      <ul class="confirm-facts">
        <li>任务：{{ confirmTask.task_id }} / 申请 {{ confirmTask.application_id }}</li>
        <li>接收方：评估师 {{ (confirmTask as any).assessor?.account_id || '—' }}</li>
        <li>本次操作将记录经办人、时间和处理意见</li>
      </ul>
      <label class="reason-label">
        退回原因（必填）
        <textarea v-model="reasonDraft" rows="2" placeholder="指明需修改的具体记录项"></textarea>
      </label>
      <div class="confirm-actions">
        <button type="button" class="btn" @click="confirmKind = null; confirmTask = null">取消</button>
        <button type="button" class="btn primary" :disabled="actionBusy || !reasonDraft.trim()" @click="runReturnTask">
          {{ actionBusy ? '提交中…' : '确认退回' }}
        </button>
      </div>
    </div>

    <ActionReceipt
      v-if="receipt"
      :receipt="receipt"
      object-type="application"
      @back="closeDetail"
      @continue="receipt = null"
    />
    <p v-if="actionError" class="err">{{ actionError }}</p>

    <!-- 申请详情 -->
    <div v-if="selected" class="detail-wrap">
      <ObjectContextHeader
        object-type="application"
        :object-id="selected.application_id"
        :state="selected.status"
        :responsible="(selected as any).handoff?.to || 'insurer'"
        :due-at="sla?.due_at"
        :sla-status="sla?.sla_status"
        back-label="返回队列"
        @back="closeDetail"
      />

      <div class="actions">
        <button
          v-if="selected.status === 'submitted'"
          type="button"
          class="btn primary"
          :disabled="actionBusy"
          @click="confirmKind = 'accept'; reasonDraft = ''"
        >
          受理
        </button>
        <button
          v-if="['submitted', 'materials_review'].includes(selected.status)"
          type="button"
          class="btn warn"
          :disabled="actionBusy"
          @click="confirmKind = 'return'; reasonDraft = ''"
        >
          补正退回
        </button>
        <button
          v-if="['materials_review', 'submitted', 'materials_pass'].includes(selected.status)"
          type="button"
          class="btn"
          :disabled="actionBusy"
          @click="confirmKind = 'dispatch'; assessorPick = (assessors[0] as any)?.account_username || ''"
        >
          派单
        </button>
      </div>

      <div v-if="confirmKind === 'accept' || confirmKind === 'pass'" class="confirm-box">
        <p class="confirm-title">{{ confirmKind === 'accept' ? '确认受理申请' : '确认材料齐备' }}</p>
        <ul class="confirm-facts">
          <li>对象：{{ selected.application_id }}</li>
          <li>目标状态：{{ confirmKind === 'accept' ? '材料审核中' : '待派单' }}</li>
          <li>接收方：经办机构</li>
          <li>本次操作将记录经办人、时间和处理意见</li>
        </ul>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy" @click="runAppAction(confirmKind as any)">
            {{ actionBusy ? '提交中…' : '确认提交' }}
          </button>
        </div>
      </div>

      <div v-if="confirmKind === 'return'" class="confirm-box">
        <p class="confirm-title">确认材料补正退回</p>
        <ul class="confirm-facts">
          <li>对象：{{ selected.application_id }}</li>
          <li>目标状态：待补正</li>
          <li>接收方：提交方（家属/机构）</li>
          <li>本次操作将记录经办人、时间和处理意见</li>
        </ul>
        <label class="reason-label">
          逐项补正要求（必填）
          <textarea v-model="reasonDraft" rows="2" placeholder="例如：身份证明影像模糊，请重新上传"></textarea>
        </label>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy || !reasonDraft.trim()" @click="runAppAction('return')">
            {{ actionBusy ? '提交中…' : '确认退回' }}
          </button>
        </div>
      </div>

      <div v-if="confirmKind === 'dispatch'" class="confirm-box">
        <p class="confirm-title">确认派单</p>
        <ul class="confirm-facts">
          <li>申请：{{ selected.application_id }}</li>
          <li>目标状态：评估中</li>
          <li>接收方：选定评估师</li>
          <li>候选须在授权评估人员名录内；回避规则由服务端校验</li>
        </ul>
        <label class="reason-label">
          选择评估师
          <select v-model="assessorPick" class="select">
            <option value="" disabled>请选择</option>
            <option v-for="a in assessors" :key="(a as any).account_username" :value="(a as any).account_username">
              {{ a.name || (a as any).account_username }}（{{ (a as any).account_username }}）
            </option>
          </select>
        </label>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy || !assessorPick" @click="runDispatch">
            {{ actionBusy ? '提交中…' : '确认派单' }}
          </button>
        </div>
      </div>

      <div class="grid-2">
        <MaterialVersionList v-if="materials" :items="materials.list" :application-status="materials.status" />
        <HandoffTimeline
          v-if="timeline"
          :events="timeline.list"
          :next-action="timeline.next_action"
          :published-result="timeline.published_result"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.insurer-today {
  padding-bottom: 16px;
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
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  color: inherit;
}
.list-btn {
  cursor: pointer;
  text-align: left;
}
.spacer {
  flex: 1;
}
.id {
  font-weight: 700;
  font-size: 12px;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
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
}
.btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.btn.sm {
  padding: 4px 8px;
  font-size: 12px;
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
  margin: 12px 0;
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
.reason-label textarea,
.select {
  border: 1px solid #fcd34d;
  border-radius: 6px;
  padding: 8px;
  font: inherit;
}
.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.detail-wrap {
  margin-top: 16px;
}
</style>
