<script setup lang="ts">
// 评估师今日页（阶段 C）
import { ref, onMounted, computed } from 'vue'
import {
  getAssessmentTasks,
  acceptAssessmentTask,
  createAssessmentSnapshot,
  handleAssistantInsight,
} from '../../../api/client'
import { http } from '../../../api/http'
import type { AssessmentTask, AssessmentSnapshot, AssistantInsight } from '../../../api/types'
import ObjectContextHeader from '../components/ObjectContextHeader.vue'
import ActionReceipt from '../components/ActionReceipt.vue'
import StatusPill from '../components/StatusPill.vue'
import type { ActionReceipt as Receipt } from '../../../api/ltc-application'

const tasks = ref<AssessmentTask[]>([])
const activeSnapshot = ref<AssessmentSnapshot | null>(null)
const insights = ref<AssistantInsight[]>([
  {
    insight_id: 'INSIGHT-20260920-001',
    task_id: 'TASK-20260920-0001',
    applicant_id: 'P00084',
    type: 'vital_deviation',
    title: '连续7日夜间体征与离床频次线索提示',
    detail: '监测窗口内夜间平均离床 3.8 次，心率夜间变异度轻度偏高。',
    suggested_focus: '现场着重核实日常生活活动能力与夜间防跌倒看护。',
    handling_status: 'pending',
    handled_by: null,
    handled_at: null,
    handling_note: null,
    disclaimer: '仅为辅助线索，不得直接作为定级依据。',
  },
])
const selected = ref<AssessmentTask | null>(null)
const receipt = ref<Receipt | null>(null)
const actionBusy = ref(false)
const actionError = ref<string | null>(null)
const confirmKind = ref<'accept' | 'submit' | 'return' | 'snapshot' | null>(null)
const reasonDraft = ref('')
const levelDraft = ref('重度失能Ⅱ级')

const pendingAccept = computed(() => tasks.value.filter((t) => t.status === 'assigned'))
const fieldTasks = computed(() => tasks.value.filter((t) => t.status === 'assessing'))
const returned = computed(() => tasks.value.filter((t) => t.status === 'returned'))
const submitted = computed(() => tasks.value.filter((t) => t.status === 'completed'))

async function loadAll() {
  actionError.value = null
  try {
    const res = await getAssessmentTasks()
    tasks.value = res.list || []
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '加载失败'
  }
}

function openTask(t: AssessmentTask) {
  selected.value = t
  receipt.value = null
  confirmKind.value = null
}

function closeDetail() {
  selected.value = null
  receipt.value = null
  confirmKind.value = null
  reasonDraft.value = ''
}

function makeReceipt(objectId: string, state: string, next: string): Receipt {
  return {
    receipt_id: 'RCPT-' + Date.now().toString(36).toUpperCase(),
    object_id: objectId,
    state,
    version: 1,
    occurred_at: new Date().toISOString(),
    next_owner_role: next,
  }
}

async function doAccept() {
  if (!selected.value) return
  actionBusy.value = true
  try {
    await acceptAssessmentTask(selected.value.task_id)
    receipt.value = makeReceipt(selected.value.task_id, 'assessing', 'assessor')
    await loadAll()
    const t = tasks.value.find((x) => x.task_id === selected.value!.task_id)
    if (t) selected.value = t
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '接单失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
  }
}

async function doSnapshot() {
  if (!selected.value) return
  actionBusy.value = true
  try {
    const res = await createAssessmentSnapshot({ task_id: selected.value.task_id, window_days: 14 })
    activeSnapshot.value = res
    receipt.value = makeReceipt(selected.value.task_id, 'frozen', 'assessor')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '快照失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
  }
}

async function doSubmit() {
  if (!selected.value) return
  actionBusy.value = true
  try {
    await http.post(`/v1/ltc/tasks/${encodeURIComponent(selected.value.task_id)}/submit`, {
      assessor_level: levelDraft.value,
      expert_confirmation: ['exp_001', 'exp_002'],
    })
    receipt.value = makeReceipt(selected.value.task_id, 'completed', 'insurer')
    await loadAll()
    const t = tasks.value.find((x) => x.task_id === selected.value!.task_id)
    if (t) selected.value = t
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '提交失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
  }
}

async function doReturn() {
  if (!selected.value || !reasonDraft.value.trim()) return
  actionBusy.value = true
  try {
    await http.post(`/v1/ltc/tasks/${encodeURIComponent(selected.value.task_id)}/return`, {
      reason: reasonDraft.value,
    })
    receipt.value = makeReceipt(selected.value.task_id, 'returned', 'insurer')
    await loadAll()
    closeDetail()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '退回失败'
  } finally {
    actionBusy.value = false
    confirmKind.value = null
    reasonDraft.value = ''
  }
}

async function disposeInsight(action: string) {
  actionBusy.value = true
  try {
    const note = window.prompt('处置理由（必填）', '现场核验后处置')
    if (!note) return
    await handleAssistantInsight('INSIGHT-20260920-001', { action, note })
    insights.value = insights.value.map((i) =>
      i.insight_id === 'INSIGHT-20260920-001'
        ? {
            ...i,
            handling_status: action as AssistantInsight['handling_status'],
            handled_by: 'assessor01',
            handled_at: new Date().toISOString(),
            handling_note: note,
          }
        : i,
    )
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '洞察处置失败'
  } finally {
    actionBusy.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="assessor-today">
    <div class="row-head">
      <div>
        <h2>我的评估任务</h2>
        <p class="sub">
          待接 {{ pendingAccept.length }} · 现场中 {{ fieldTasks.length }} ·
          退回修改 {{ returned.length }} · 已提交 {{ submitted.length }}
        </p>
      </div>
      <button type="button" class="btn" @click="loadAll">刷新</button>
    </div>
    <p v-if="actionError" class="err">{{ actionError }}</p>

    <div class="grid-2">
      <section class="panel">
        <h3>待接 / 现场</h3>
        <div v-if="!pendingAccept.length && !fieldTasks.length" class="empty">今日待办已完成</div>
        <ul v-else class="list">
          <li v-for="t in [...pendingAccept, ...fieldTasks, ...returned]" :key="t.task_id">
            <button type="button" class="list-btn" @click="openTask(t)">
              <span class="id mono">{{ t.task_id }}</span>
              <StatusPill :state="t.status" object-type="task" />
              <span class="meta">{{ t.applicant_id }} · {{ t.application_id }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h3>待处理洞察</h3>
        <div v-if="!insights.some((i) => i.handling_status === 'pending')" class="empty">无待处置洞察</div>
        <div v-for="i in insights.filter((x) => x.handling_status === 'pending')" :key="i.insight_id" class="insight-card">
          <div class="insight-title">{{ i.title }}</div>
          <div class="insight-detail">{{ i.detail }}</div>
          <div class="insight-focus">{{ i.suggested_focus }}</div>
          <div class="insight-actions">
            <button type="button" class="btn sm" :disabled="actionBusy" @click="disposeInsight('confirmed')">确认</button>
            <button type="button" class="btn sm" :disabled="actionBusy" @click="disposeInsight('adopted')">采纳</button>
            <button type="button" class="btn sm" :disabled="actionBusy" @click="disposeInsight('rejected')">驳回</button>
            <button type="button" class="btn sm" :disabled="actionBusy" @click="disposeInsight('needs_manual_review')">人工核查</button>
          </div>
          <p class="disclaimer">{{ i.disclaimer }}</p>
        </div>
      </section>
    </div>

    <ActionReceipt
      v-if="receipt"
      :receipt="receipt"
      object-type="task"
      @back="closeDetail"
      @continue="receipt = null"
    />

    <div v-if="selected" class="detail-wrap">
      <ObjectContextHeader
        object-type="task"
        :object-id="selected.task_id"
        :state="selected.status"
        :responsible="selected.assessor?.account_id || 'assessor'"
        back-label="返回任务列表"
        @back="closeDetail"
      />

      <div class="meta-line">
        申请 {{ selected.application_id }} · 对象 {{ selected.applicant_id }} ·
        状态 {{ selected.status }}
      </div>

      <div class="actions">
        <button
          v-if="selected.status === 'assigned'"
          type="button"
          class="btn primary"
          :disabled="actionBusy"
          @click="confirmKind = 'accept'"
        >
          接单
        </button>
        <button
          v-if="selected.status === 'assessing'"
          type="button"
          class="btn"
          :disabled="actionBusy"
          @click="confirmKind = 'snapshot'"
        >
          生成快照
        </button>
        <button
          v-if="selected.status === 'assessing'"
          type="button"
          class="btn primary"
          :disabled="actionBusy"
          @click="confirmKind = 'submit'"
        >
          提交评估
        </button>
        <button
          v-if="['assessing', 'assigned'].includes(selected.status)"
          type="button"
          class="btn warn"
          :disabled="actionBusy"
          @click="confirmKind = 'return'; reasonDraft = ''"
        >
          退回经办
        </button>
      </div>

      <div v-if="confirmKind === 'accept'" class="confirm-box">
        <p class="confirm-title">确认接单</p>
        <ul class="confirm-facts">
          <li>任务：{{ selected.task_id }}</li>
          <li>目标状态：评估中</li>
          <li>接收方：本人现场作业</li>
        </ul>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy" @click="doAccept">确认</button>
        </div>
      </div>

      <div v-if="confirmKind === 'snapshot'" class="confirm-box">
        <p class="confirm-title">确认生成并冻结快照</p>
        <ul class="confirm-facts">
          <li>任务：{{ selected.task_id }}</li>
          <li>窗口：近 14 日监测数据</li>
          <li>conclusion 保持 null（设备不参与定级）</li>
        </ul>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy" @click="doSnapshot">确认生成</button>
        </div>
      </div>

      <div v-if="confirmKind === 'submit'" class="confirm-box">
        <p class="confirm-title">确认提交评估结果</p>
        <ul class="confirm-facts">
          <li>任务：{{ selected.task_id }}</li>
          <li>目标状态：已提交审核</li>
          <li>接收方：经办审核队列</li>
          <li>提交后任务锁定，版本固定</li>
        </ul>
        <label class="reason-label">
          评估师判定等级
          <select v-model="levelDraft" class="select">
            <option>重度失能Ⅰ级</option>
            <option>重度失能Ⅱ级</option>
            <option>重度失能Ⅲ级</option>
            <option>中度失能</option>
          </select>
        </label>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy" @click="doSubmit">确认提交</button>
        </div>
      </div>

      <div v-if="confirmKind === 'return'" class="confirm-box">
        <p class="confirm-title">确认退回经办</p>
        <ul class="confirm-facts">
          <li>任务：{{ selected.task_id }}</li>
          <li>接收方：原派单经办队列</li>
          <li>原因必填并留痕</li>
        </ul>
        <label class="reason-label">
          退回原因
          <textarea v-model="reasonDraft" rows="2" placeholder="现场条件不满足或资料不足"></textarea>
        </label>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="confirmKind = null">取消</button>
          <button type="button" class="btn primary" :disabled="actionBusy || !reasonDraft.trim()" @click="doReturn">
            确认退回
          </button>
        </div>
      </div>

      <section v-if="activeSnapshot" class="panel" style="margin-top: 12px">
        <h3>设备快照（conclusion = null）</h3>
        <p class="mono small">
          {{ activeSnapshot.snapshot_id }} · {{ activeSnapshot.status }} ·
          conclusion: {{ (activeSnapshot as any)?.conclusion == null ? 'null' : (activeSnapshot as any).conclusion }}
        </p>
        <p class="disclaimer">{{ (activeSnapshot as any).disclaimer || '设备快照仅作客观证据，不参与定级（conclusion 保持 null）' }}</p>
      </section>

      <section class="panel" style="margin-top: 12px">
        <h3>现场记录 / 提交检查</h3>
        <ul class="check-list">
          <li>✓ 任务绑定与授权病历可读</li>
          <li :class="{ warn: selected.status === 'assessing' && !activeSnapshot }">
            {{ activeSnapshot ? '✓' : '○' }} 评估快照（{{ activeSnapshot ? '已冻结' : '待生成' }}）
          </li>
          <li>✓ AI 洞察需逐条处置后提交</li>
          <li>✓ 双人上门 + 专家确认由服务端门禁校验</li>
        </ul>
      </section>
    </div>

    <section class="panel" style="margin-top: 12px">
      <h3>已提交</h3>
      <div v-if="!submitted.length" class="empty">暂无已提交任务</div>
      <ul v-else class="list">
        <li v-for="t in submitted" :key="t.task_id">
          <div class="row-item">
            <span class="id mono">{{ t.task_id }}</span>
            <StatusPill :state="t.status" object-type="task" />
            <span class="meta">{{ t.application_id }}</span>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.assessor-today {
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
.meta-line {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 10px;
}
.insight-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  background: #f8fafc;
}
.insight-title {
  font-weight: 700;
  font-size: 13px;
}
.insight-detail,
.insight-focus {
  font-size: 12px;
  color: #475569;
  margin-top: 4px;
}
.insight-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.disclaimer {
  margin: 8px 0 0;
  font-size: 11px;
  color: #94a3b8;
}
.check-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
}
.check-list .warn {
  color: #b45309;
}
.small {
  font-size: 12px;
}
</style>
