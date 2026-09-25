<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { http } from '../../../api/http'
import {
  getFamilyBindings,
  createFamilyBindingRequest,
  listAppeals,
  createAppeal,
  type FamilyBinding,
} from '../../../api/ltc-family'
import { getLtcApplications } from '../../../api/client'
import { getApplicationTimeline, getApplicationMaterials } from '../../../api/ltc-application'
import type { LtcApplication } from '../../../api/types'
import ObjectContextHeader from '../components/ObjectContextHeader.vue'
import MaterialVersionList from '../components/MaterialVersionList.vue'
import HandoffTimeline from '../components/HandoffTimeline.vue'
import ActionReceipt from '../components/ActionReceipt.vue'
import StatusPill from '../components/StatusPill.vue'

const bindings = ref<FamilyBinding[]>([])
const applications = ref<LtcApplication[]>([])
const appeals = ref<any[]>([])
const selectedSubject = ref('')
const selected = ref<LtcApplication | null>(null)
const timeline = ref<Awaited<ReturnType<typeof getApplicationTimeline>> | null>(null)
const materials = ref<Awaited<ReturnType<typeof getApplicationMaterials>> | null>(null)
const receipt = ref<any>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const showAppeal = ref(false)
const appealReason = ref('')
const tab = ref<'today' | 'progress' | 'appeal' | 'relation'>('today')

const myApps = computed(() => applications.value)

async function loadAll() {
  error.value = null
  try {
    const [b, a, ap] = await Promise.all([
      getFamilyBindings().catch(() => ({ list: [], total: 0 })),
      getLtcApplications().catch(() => ({ list: [], total: 0 })),
      listAppeals().catch(() => ({ list: [], total: 0 })),
    ])
    bindings.value = b.list || []
    applications.value = a.list || []
    appeals.value = ap.list || []
    if (!selectedSubject.value && bindings.value[0]) {
      selectedSubject.value = bindings.value[0].subject_id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

async function openApp(app: LtcApplication) {
  selected.value = app
  receipt.value = null
  const [t, m] = await Promise.all([
    getApplicationTimeline(app.application_id).catch(() => null),
    getApplicationMaterials(app.application_id).catch(() => null),
  ])
  timeline.value = t
  materials.value = m
}

function closeApp() {
  selected.value = null
  timeline.value = null
  materials.value = null
}

async function submitDraft() {
  const draft = myApps.value.find((a) => a.status === 'draft')
  if (!draft) return
  busy.value = true
  try {
    await http.post(`/v1/ltc/applications/${draft.application_id}/submit`)
    receipt.value = {
      receipt_id: 'RCPT-FAM-' + Date.now().toString(36).toUpperCase(),
      object_id: draft.application_id,
      state: 'submitted',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'insurer',
    }
    await loadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '提交失败'
  } finally {
    busy.value = false
  }
}

async function supplement() {
  const rejected = myApps.value.find((a) => a.status === 'materials_rejected')
  if (!rejected) return
  busy.value = true
  try {
    await http.post(`/v1/ltc/applications/${rejected.application_id}/submit`)
    receipt.value = {
      receipt_id: 'RCPT-SUP-' + Date.now().toString(36).toUpperCase(),
      object_id: rejected.application_id,
      state: 'submitted',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'insurer',
    }
    await loadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '补正失败'
  } finally {
    busy.value = false
  }
}

async function submitBindingRequest() {
  busy.value = true
  try {
    const sid = selectedSubject.value || bindings.value[0]?.subject_id || 'P_SQ_01'
    const res = await createFamilyBindingRequest({ subject_id: sid, relationship: '子女' })
    receipt.value = res
    await loadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '绑定申请失败'
  } finally {
    busy.value = false
  }
}

async function submitAppeal() {
  if (!selected.value || !appealReason.value.trim()) return
  const published = timeline.value?.published_result
  if (!published) {
    error.value = '无已发布正式结果，不可申诉'
    return
  }
  busy.value = true
  try {
    const res = await createAppeal({
      application_id: selected.value.application_id,
      result_id: published.result_id,
      reason: appealReason.value,
    })
    receipt.value = res
    showAppeal.value = false
    appealReason.value = ''
    await loadAll()
    tab.value = 'appeal'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '申诉失败'
  } finally {
    busy.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="family-ws">
    <div class="row-head">
      <div>
        <h2>我的申报与进度</h2>
        <p class="sub">
          授权对象 {{ bindings.length }}
          <template v-if="selectedSubject"> · 当前 {{ selectedSubject }}</template>
          · 申请 {{ myApps.length }} · 申诉 {{ appeals.length }}
        </p>
      </div>
      <div v-if="bindings.length > 1" class="subject-switch">
        <label>当前对象</label>
        <select v-model="selectedSubject" @change="loadAll">
          <option v-for="b in bindings" :key="b.binding_id" :value="b.subject_id">
            {{ b.display_name }}（{{ b.subject_id }}）
          </option>
        </select>
      </div>
    </div>

    <div class="tabs">
      <button :class="['tab', tab === 'today' && 'on']" @click="tab = 'today'">今日待办</button>
      <button :class="['tab', tab === 'progress' && 'on']" @click="tab = 'progress'">进度与结果</button>
      <button :class="['tab', tab === 'appeal' && 'on']" @click="tab = 'appeal'">申诉</button>
      <button :class="['tab', tab === 'relation' && 'on']" @click="tab = 'relation'">关系与授权</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <ActionReceipt
      v-if="receipt"
      :receipt="receipt"
      object-type="application"
      @back="receipt = null"
      @continue="receipt = null"
    />

    <div v-if="tab === 'today'" class="grid-2">
      <section class="panel">
        <h3>待提交 / 待补正</h3>
        <div v-if="!myApps.filter((a) => ['draft', 'materials_rejected'].includes(a.status)).length" class="empty">
          无待完成事项
        </div>
        <ul class="list">
          <li v-for="a in myApps.filter((x) => ['draft', 'materials_rejected'].includes(x.status))" :key="a.application_id">
            <button type="button" class="list-btn" @click="openApp(a)">
              <span class="id mono">{{ a.application_id }}</span>
              <StatusPill :state="a.status" object-type="application" />
              <span class="meta">{{ a.applicant_id }}</span>
            </button>
          </li>
        </ul>
        <div class="row-actions">
          <button type="button" class="btn primary" :disabled="busy" @click="submitDraft">提交申报</button>
          <button
            type="button"
            class="btn warn"
            :disabled="busy || !myApps.some((a) => a.status === 'materials_rejected')"
            @click="supplement"
          >
            补正重提
          </button>
        </div>
      </section>
      <section class="panel">
        <h3>材料要求</h3>
        <ul class="req">
          <li>身份证明 / 关系证明</li>
          <li>病历摘要与评估申请表</li>
          <li>经办退回时按材料项逐条补正</li>
        </ul>
      </section>
    </div>

    <div v-if="tab === 'progress'">
      <section class="panel">
        <h3>申请列表</h3>
        <div v-if="!myApps.length" class="empty">暂无申请</div>
        <ul class="list">
          <li v-for="a in myApps" :key="a.application_id">
            <button type="button" class="list-btn" @click="openApp(a)">
              <span class="id mono">{{ a.application_id }}</span>
              <StatusPill :state="a.status" object-type="application" />
              <span class="meta">更新 {{ a.updated_at }}</span>
            </button>
          </li>
        </ul>
      </section>

      <div v-if="selected" class="detail">
        <ObjectContextHeader
          object-type="application"
          :object-id="selected.application_id"
          :state="selected.status"
          back-label="返回列表"
          @back="closeApp"
        />
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :disabled="!timeline?.published_result"
            :title="timeline?.published_result ? '' : '结果尚未发布'"
            @click="showAppeal = true"
          >
            发起申诉
          </button>
        </div>
        <div class="grid-2">
          <HandoffTimeline
            v-if="timeline"
            :events="timeline.list"
            :next-action="timeline.next_action"
            :published-result="timeline.published_result"
          />
          <MaterialVersionList v-if="materials" :items="materials.list" :application-status="materials.status" />
        </div>

        <div v-if="showAppeal" class="confirm-box">
          <p class="confirm-title">发起申诉</p>
          <ul class="confirm-facts">
            <li>对象：{{ selected.application_id }}</li>
            <li>原结果：{{ timeline?.published_result?.result_id }}</li>
            <li>接收方：经办受理 → 医保正式答复</li>
          </ul>
          <label class="reason-label">
            申诉理由（必填）
            <textarea v-model="appealReason" rows="3" placeholder="说明对正式结果的异议及依据"></textarea>
          </label>
          <div class="confirm-actions">
            <button type="button" class="btn" @click="showAppeal = false">取消</button>
            <button type="button" class="btn primary" :disabled="busy || !appealReason.trim()" @click="submitAppeal">
              {{ busy ? '提交中…' : '确认提交' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tab === 'appeal'">
      <section class="panel">
        <h3>我的申诉</h3>
        <div v-if="!appeals.length" class="empty">暂无申诉</div>
        <ul class="list">
          <li v-for="ap in appeals" :key="ap.appeal_id">
            <div class="row-item">
              <span class="id mono">{{ ap.appeal_id }}</span>
              <StatusPill :state="ap.state" object-type="appeal" />
              <span class="meta">{{ ap.application_id }} · {{ ap.submitted_at }}</span>
              <span v-if="ap.public_reply" class="reply">答复已发布</span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="tab === 'relation'">
      <section class="panel">
        <h3>绑定与授权</h3>
        <div v-if="!bindings.length" class="empty">暂无授权对象</div>
        <ul class="list">
          <li v-for="b in bindings" :key="b.binding_id">
            <div class="row-item">
              <span class="id mono">{{ b.subject_id }}</span>
              <span class="name">{{ b.display_name }}</span>
              <StatusPill :state="b.binding_status" object-type="binding" />
              <StatusPill :state="b.authorization_status" object-type="binding" />
              <span class="meta">{{ b.valid_from || '' }} ~ {{ b.valid_until || '长期' }}</span>
            </div>
          </li>
        </ul>
        <div class="row-actions">
          <button type="button" class="btn" :disabled="busy" @click="submitBindingRequest">提交绑定核验申请</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.family-ws {
  padding-bottom: 16px;
}
.row-head {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
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
.subject-switch label {
  font-size: 12px;
  color: #64748b;
  margin-right: 6px;
}
.subject-switch select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.tab {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}
.tab.on {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
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
  margin-bottom: 12px;
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
.name {
  font-weight: 600;
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
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.req {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
}
.detail {
  margin-top: 12px;
}
.confirm-box {
  border: 1px solid #fde68a;
  background: #fffbeb;
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 12px;
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
}
.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.reply {
  color: #047857;
  font-size: 12px;
  font-weight: 600;
}
</style>
