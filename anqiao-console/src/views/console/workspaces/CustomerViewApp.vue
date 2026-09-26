<script setup lang="ts">
// 销售客户资产视图（多业态设计 §6，N21–N25）：机构列表 / 设备在线 / 脱敏体征 / 告警 / 遥测
// 机构主数据以 SaaS 侧 device_registry 客户归属为权威（CRM 为可选镜像，不做硬依赖）
import { computed, onMounted, ref } from 'vue'
import { http, type SessionInfo } from '../../../api/http'

const props = defineProps<{ session: SessionInfo }>()

interface SalesInstitution {
  org_id: string
  site: string
  devices_count: number
  online_count: number
}
interface SalesDevice {
  device_id: string
  sn: string
  label: string
  type: string
  online: boolean
  lifecycle_status: string
  last_data_time: string | null
  sales_owner: string | null
}
interface VitalsEntry {
  device_id: string
  label: string
  vitals: unknown
  reason?: string
}

const loading = ref(false)
const error = ref('')
const institutions = ref<SalesInstitution[]>([])
const activeOrg = ref('')
const orgDevices = ref<SalesDevice[]>([])
const vitalsList = ref<VitalsEntry[]>([])
const telemetryNote = ref('')

const activeInstitution = computed(() => institutions.value.find((i) => i.org_id === activeOrg.value) ?? null)

async function loadInstitutions() {
  loading.value = true
  error.value = ''
  try {
    const data = await http.get<{ list: SalesInstitution[]; total: number }>('/v1/sales/institutions')
    institutions.value = data.list ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function selectOrg(orgId: string) {
  activeOrg.value = orgId
  error.value = ''
  orgDevices.value = []
  vitalsList.value = []
  telemetryNote.value = ''
  try {
    const dev = await http.get<{ list: SalesDevice[] }>(`/v1/sales/institutions/${encodeURIComponent(orgId)}/devices`)
    orgDevices.value = dev.list ?? []
    const vit = await http.get<{ list: VitalsEntry[] }>(`/v1/sales/institutions/${encodeURIComponent(orgId)}/vitals-summary`)
    vitalsList.value = vit.list ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

async function loadTelemetry(deviceId: string) {
  telemetryNote.value = ''
  try {
    const data = await http.get<{ data: unknown }>(`/v1/sales/institutions/${encodeURIComponent(activeOrg.value)}/telemetry?device_id=${encodeURIComponent(deviceId)}&range=today`)
    telemetryNote.value = data.data ? '今日遥测已拉取（真实硬件通道）' : '硬件云暂无该设备今日数据（诚实空态）'
  } catch (e) {
    telemetryNote.value = e instanceof Error ? e.message : '遥测拉取失败'
  }
}

onMounted(loadInstitutions)
</script>

<template>
  <div class="customer-view">
    <header class="cv-header">
      <div>
        <h2 class="cv-title">客户资产视图</h2>
        <p class="cv-subtitle">名下客户机构 / 设备在线 / 脱敏体征 / 遥测（设备维度，不含身份档案）</p>
      </div>
    </header>

    <div v-if="error" class="cv-error">{{ error }}</div>
    <div v-else-if="loading" class="cv-loading">加载中…</div>

    <div v-else class="cv-body">
      <aside class="cv-org-list">
        <div class="cv-section-label">客户机构（{{ institutions.length }}）</div>
        <div v-if="!institutions.length" class="cv-empty">暂无客户机构设备归属（空态诚实呈现）</div>
        <button
          v-for="inst in institutions"
          :key="inst.org_id"
          type="button"
          :class="['cv-org-card', activeOrg === inst.org_id && 'active']"
          @click="selectOrg(inst.org_id)"
        >
          <div class="cv-org-name">{{ inst.site }}</div>
          <div class="cv-org-meta">{{ inst.org_id }} · 设备 {{ inst.devices_count }} 台 · 在线 {{ inst.online_count }}</div>
        </button>
      </aside>

      <section class="cv-detail">
        <template v-if="activeInstitution">
          <h3 class="cv-detail-title">{{ activeInstitution.site }} · 设备在线</h3>
          <div class="cv-device-grid">
            <div v-for="d in orgDevices" :key="d.device_id" class="cv-device-card">
              <div class="cv-device-line">
                <span class="cv-device-label">{{ d.label }}</span>
                <span :class="['cv-device-status', d.online ? 'on' : 'off']">{{ d.online ? '在线' : '离线' }}</span>
              </div>
              <div class="cv-device-meta">{{ d.device_id }} · {{ d.lifecycle_status }}</div>
              <button type="button" class="cv-tele-btn" @click="loadTelemetry(d.device_id)">拉取今日遥测</button>
            </div>
          </div>
          <div v-if="telemetryNote" class="cv-tele-note">{{ telemetryNote }}</div>

          <h3 class="cv-detail-title">脱敏体征摘要（设备维度遥测）</h3>
          <div class="cv-vitals-list">
            <div v-for="v in vitalsList" :key="v.device_id" class="cv-vitals-item">
              <span class="cv-device-label">{{ v.label }}</span>
              <span v-if="v.vitals" class="cv-vitals-ok">遥测已获取</span>
              <span v-else class="cv-vitals-pending">{{ v.reason || '待硬件通道' }}</span>
            </div>
          </div>

          <h3 class="cv-detail-title">告警历史</h3>
          <div class="cv-note">设备级告警 SN 映射确认后启用（避免跨机构泄漏），当前诚实空态。</div>
        </template>
        <div v-else class="cv-empty">从左侧选择客户机构查看资产详情</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.customer-view { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.cv-header { padding: 14px 18px; border-bottom: 1px solid var(--border, #e2e4e8); }
.cv-title { margin: 0; font-size: 18px; }
.cv-subtitle { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary, #6b7280); }
.cv-error, .cv-loading { padding: 18px; font-size: 13px; }
.cv-error { color: #b42318; }
.cv-loading { color: var(--text-secondary, #6b7280); }
.cv-body { flex: 1; display: grid; grid-template-columns: 280px 1fr; min-height: 0; }
.cv-org-list { border-right: 1px solid var(--border, #e2e4e8); padding: 12px 10px; overflow: auto; }
.cv-section-label { font-size: 12px; font-weight: 600; color: var(--text-secondary, #6b7280); margin: 4px 4px 8px; }
.cv-org-card { display: block; width: 100%; text-align: left; border: 1px solid var(--border, #e2e4e8); background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; }
.cv-org-card:hover { border-color: rgba(11, 122, 117, 0.4); }
.cv-org-card.active { border-color: var(--brand, #0b7a75); background: var(--brand-soft, rgba(11, 122, 117, 0.08)); }
.cv-org-name { font-size: 13px; font-weight: 600; }
.cv-org-meta { font-size: 12px; color: var(--text-secondary, #6b7280); margin-top: 3px; }
.cv-detail { padding: 16px 18px; overflow: auto; }
.cv-detail-title { margin: 0 0 10px; font-size: 14px; }
.cv-device-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-bottom: 14px; }
.cv-device-card { border: 1px solid var(--border, #e2e4e8); border-radius: 10px; padding: 10px 12px; background: #fff; }
.cv-device-line { display: flex; justify-content: space-between; gap: 8px; }
.cv-device-label { font-size: 13px; font-weight: 600; }
.cv-device-status { font-size: 12px; }
.cv-device-status.on { color: #0b7a75; }
.cv-device-status.off { color: #9ca3af; }
.cv-device-meta { font-size: 12px; color: var(--text-secondary, #6b7280); margin-top: 3px; }
.cv-tele-btn { margin-top: 8px; font-size: 12px; border: 1px solid var(--border, #e2e4e8); background: var(--bg-subtle, #fafbfc); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.cv-tele-note { font-size: 12px; color: var(--text-secondary, #6b7280); margin-bottom: 14px; }
.cv-vitals-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.cv-vitals-item { border: 1px solid var(--border, #e2e4e8); border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 13px; background: #fff; }
.cv-vitals-ok { color: #0b7a75; font-size: 12px; }
.cv-vitals-pending { color: #9ca3af; font-size: 12px; }
.cv-note { font-size: 12px; color: var(--text-secondary, #6b7280); border: 1px dashed var(--border, #d7dade); border-radius: 8px; padding: 10px 12px; background: var(--bg-subtle, #fafbfc); }
.cv-empty { padding: 18px; font-size: 13px; color: var(--text-secondary, #6b7280); }
</style>
