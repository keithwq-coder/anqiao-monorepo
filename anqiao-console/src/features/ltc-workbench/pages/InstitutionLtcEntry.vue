<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getAssessedPersons, getLtcApplications, createLtcApplication, submitLtcApplication } from '../../../api/client'
import { getDeviceBindings, createDeviceBinding, deviceBindingAction } from '../../../api/ltc-family'
import { getApplicationTimeline, getApplicationMaterials } from '../../../api/ltc-application'
import type { AssessedPerson, LtcApplication } from '../../../api/types'
import ObjectContextHeader from '../components/ObjectContextHeader.vue'
import MaterialVersionList from '../components/MaterialVersionList.vue'
import HandoffTimeline from '../components/HandoffTimeline.vue'
import ActionReceipt from '../components/ActionReceipt.vue'
import StatusPill from '../components/StatusPill.vue'

const persons = ref<AssessedPerson[]>([])
const applications = ref<LtcApplication[]>([])
const bindings = ref<any[]>([])
const selectedPerson = ref<AssessedPerson | null>(null)
const selectedApp = ref<LtcApplication | null>(null)
const timeline = ref<Awaited<ReturnType<typeof getApplicationTimeline>> | null>(null)
const materials = ref<Awaited<ReturnType<typeof getApplicationMaterials>> | null>(null)
const receipt = ref<any>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const showBinding = ref(false)
const bindDraft = ref({ device_id: '', project_id: 'suqian', reason: '' })

const pending = computed(() => applications.value.filter((a) => ['draft', 'materials_rejected', 'submitted'].includes(a.status)))

async function load() {
  error.value = null
  try {
    const [p, a, b] = await Promise.all([
      getAssessedPersons().catch(() => ({ list: [], total: 0 })),
      getLtcApplications().catch(() => ({ list: [], total: 0 })),
      getDeviceBindings().catch(() => ({ list: [], total: 0 })),
    ])
    persons.value = p.list || []
    applications.value = a.list || []
    bindings.value = b.list || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

function openPerson(p: AssessedPerson) {
  selectedPerson.value = p
  showBinding.value = false
}

async function submitOnBehalf() {
  if (!selectedPerson.value) return
  busy.value = true
  try {
    const app = await createLtcApplication({
      applicant_id: selectedPerson.value.person_id,
      type: 'first_apply',
      application_level: '重度失能Ⅱ级',
      tenant_id: 'kaijian',
      submitter: { role: 'nursing_admin', account_id: 'demo_nh_admin', name: '机构代办', tenant_id: 'kaijian' },
    } as any)
    await submitLtcApplication(app.application_id)
    receipt.value = {
      receipt_id: 'RCPT-ORG-' + Date.now().toString(36).toUpperCase(),
      object_id: app.application_id,
      state: 'submitted',
      version: 1,
      occurred_at: new Date().toISOString(),
      next_owner_role: 'insurer',
    }
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '代提交失败'
  } finally {
    busy.value = false
  }
}

async function openApp(app: LtcApplication) {
  selectedApp.value = app
  receipt.value = null
  const [t, m] = await Promise.all([
    getApplicationTimeline(app.application_id).catch(() => null),
    getApplicationMaterials(app.application_id).catch(() => null),
  ])
  timeline.value = t
  materials.value = m
}

async function bindDevice() {
  if (!selectedPerson.value || !bindDraft.value.device_id || !bindDraft.value.reason.trim()) return
  busy.value = true
  try {
    const res = await createDeviceBinding({
      subject_id: selectedPerson.value.person_id,
      device_id: bindDraft.value.device_id,
      project_id: bindDraft.value.project_id,
      reason: bindDraft.value.reason,
    })
    receipt.value = res.receipt
    showBinding.value = false
    bindDraft.value = { device_id: '', project_id: 'suqian', reason: '' }
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '绑定失败'
  } finally {
    busy.value = false
  }
}

async function endBinding(id: string) {
  busy.value = true
  try {
    const res = await deviceBindingAction(id, 'end', { reason: '机构解除绑定' })
    receipt.value = res.receipt
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '解除失败'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="inst-ltc">
    <div class="row-head">
      <div>
        <h2>长护险代申报</h2>
        <p class="sub">授权对象 {{ persons.length }} · 待办申请 {{ pending.length }} · 设备绑定 {{ bindings.length }}</p>
      </div>
      <button type="button" class="btn" @click="load">刷新</button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <ActionReceipt
      v-if="receipt"
      :receipt="receipt"
      object-type="application"
      @back="receipt = null"
      @continue="receipt = null"
    />

    <div class="grid-2">
      <section class="panel">
        <h3>机构对象</h3>
        <div v-if="!persons.length" class="empty">无授权对象</div>
        <ul class="list">
          <li v-for="p in persons" :key="p.person_id">
            <button type="button" class="list-btn" @click="openPerson(p)">
              <span class="id mono">{{ p.person_id }}</span>
              <span class="name">{{ p.name }}</span>
              <span class="meta">{{ p.service_org_name || p.service_org_id }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h3>待办申请</h3>
        <div v-if="!pending.length" class="empty">无待办</div>
        <ul class="list">
          <li v-for="a in pending" :key="a.application_id">
            <button type="button" class="list-btn" @click="openApp(a)">
              <span class="id mono">{{ a.application_id }}</span>
              <StatusPill :state="a.status" object-type="application" />
              <span class="meta">{{ a.applicant_id }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="selectedPerson" class="detail">
      <ObjectContextHeader
        object-type="subject"
        :object-id="selectedPerson?.person_id || ''"
        :title="selectedPerson?.name"
        :subtitle="(selectedPerson?.service_org_name || selectedPerson?.service_org_id || '')"
        state="active"
        back-label="返回对象列表"
        @back="selectedPerson = null"
      />
      <div class="row-actions">
        <button type="button" class="btn primary" :disabled="busy" @click="submitOnBehalf">代提交申报</button>
        <button type="button" class="btn" @click="showBinding = true">绑定设备</button>
      </div>

      <div v-if="showBinding" class="confirm-box">
        <p class="confirm-title">创建设备绑定</p>
        <ul class="confirm-facts">
          <li>对象：{{ selectedPerson?.person_id }}</li>
          <li>校验项目归属、占用规则与生效区间</li>
          <li>历史监测按原生效区间关联</li>
        </ul>
        <label class="reason-label">
          设备 ID
          <input v-model="bindDraft.device_id" placeholder="如 ASH01086" />
        </label>
        <label class="reason-label">
          原因（必填）
          <input v-model="bindDraft.reason" placeholder="机构代办绑定" />
        </label>
        <div class="confirm-actions">
          <button type="button" class="btn" @click="showBinding = false">取消</button>
          <button
            type="button"
            class="btn primary"
            :disabled="busy || !bindDraft.device_id || !bindDraft.reason.trim()"
            @click="bindDevice"
          >
            {{ busy ? '提交中…' : '确认绑定' }}
          </button>
        </div>
      </div>

      <section class="panel" style="margin-top: 12px">
        <h3>本对象设备绑定</h3>
        <div v-if="!selectedPerson || !bindings.filter((b) => b.subject_id === (selectedPerson && selectedPerson.person_id)).length" class="empty">
          暂无绑定
        </div>
        <ul v-else class="list">
          <li v-for="b in bindings.filter((x) => selectedPerson && x.subject_id === (selectedPerson && selectedPerson.person_id))" :key="b.binding_id">
            <div class="row-item">
              <span class="id mono">{{ b.device_id }}</span>
              <StatusPill :state="b.state" object-type="binding" />
              <span class="meta">{{ b.valid_from }} ~ {{ b.valid_until || '至今' }}</span>
              <button v-if="b.state === 'active'" type="button" class="btn sm" :disabled="busy" @click="endBinding(b.binding_id)">
                解除
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="selectedApp" class="detail">
      <ObjectContextHeader
        object-type="application"
        :object-id="selectedApp.application_id"
        :state="selectedApp.status"
        back-label="返回"
        @back="selectedApp = null"
      />
      <div class="grid-2">
        <HandoffTimeline
          v-if="timeline"
          :events="timeline.list"
          :next-action="timeline.next_action"
          :published-result="timeline.published_result"
        />
        <MaterialVersionList v-if="materials" :items="materials.list" :application-status="materials.status" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.inst-ltc {
  padding-bottom: 16px;
}
.row-head {
  display: flex;
  justify-content: space-between;
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
.name {
  font-weight: 600;
}
.meta {
  font-size: 12px;
  color: #64748b;
}
.empty {
  color: #64748b;
  font-size: 13px;
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
  padding: 2px 8px;
  font-size: 12px;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.detail {
  margin-top: 12px;
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
  margin-bottom: 8px;
}
.reason-label input {
  border: 1px solid #fcd34d;
  border-radius: 6px;
  padding: 8px;
  font: inherit;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
