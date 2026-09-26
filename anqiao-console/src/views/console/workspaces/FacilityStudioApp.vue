<script setup lang="ts">
// 职能/支撑席位工作台外壳（多业态设计 §3.1A/§3.3）：左 SOP 树 + 右数据面板
// 由 session.workspace 选择配置；康宁演示租户数据（模拟业务数据·常驻演示标识）
import { computed, ref, watch } from 'vue'
import { http, type SessionInfo } from '../../../api/http'
import {
  FACILITY_WORKBENCH_CONFIGS,
  type FacilityPanelSpec,
  type FacilityTreeNode,
} from '../../../features/facility/facility-workbench-configs'

const props = defineProps<{ session: SessionInfo }>()

const config = computed(() => FACILITY_WORKBENCH_CONFIGS[props.session.workspace ?? ''] ?? null)

interface ActiveNode {
  key: string
  label: string
  panel: FacilityPanelSpec
}

function flattenTree(nodes: FacilityTreeNode[]): ActiveNode[] {
  const list: ActiveNode[] = []
  for (const n of nodes) {
    if (n.panel) list.push({ key: n.key, label: n.label, panel: n.panel })
    for (const c of n.children ?? []) list.push({ key: c.key, label: c.label, panel: c.panel })
  }
  return list
}

const flatNodes = computed(() => (config.value ? flattenTree(config.value.tree) : []))
const activeKey = ref('')

const activeNode = computed(() => flatNodes.value.find((n) => n.key === activeKey.value) ?? flatNodes.value[0] ?? null)

watch(
  () => props.session.workspace,
  () => {
    activeKey.value = ''
  },
)

// ---------- 数据面板拉取（复用既有只读路由） ----------
const loading = ref(false)
const fetchError = ref('')
const overviewData = ref<Record<string, unknown> | null>(null)
const alertsData = ref<Array<Record<string, unknown>>>([])
const bedsData = ref<Array<{ bed_id: string; floor: string; ward: string | null; status: string }>>([])

const OVERVIEW_LABELS: Record<string, string> = {
  bed_total: '总床位', bed_occupied: '在住床位', bed_vacant: '空置床位',
  patients_total: '在院长者', in_bed_count: '在床人数', alert_open: '未闭环告警',
  alert_today: '今日告警', alert_handled: '已处置告警', nurses: '当班护理人力',
}

function metricLabel(key: string): string {
  return OVERVIEW_LABELS[key] ?? key
}

async function loadPanel(panel: FacilityPanelSpec) {
  fetchError.value = ''
  overviewData.value = null
  alertsData.value = []
  bedsData.value = []
  if (panel.kind === 'note') return
  loading.value = true
  try {
    if (panel.kind === 'overview') {
      overviewData.value = await http.get<Record<string, unknown>>('/v1/overview')
    } else if (panel.kind === 'alerts') {
      const res = await http.get<{ list?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>('/v1/alerts')
      alertsData.value = Array.isArray(res) ? res : (res.list ?? [])
    } else if (panel.kind === 'beds') {
      bedsData.value = await http.get<Array<{ bed_id: string; floor: string; ward: string | null; status: string }>>('/v1/beds')
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : '数据加载失败'
  } finally {
    loading.value = false
  }
}

watch(
  () => activeNode.value?.key,
  () => {
    if (activeNode.value) void loadPanel(activeNode.value.panel)
  },
  { immediate: true },
)

const bedStats = computed(() => {
  const occupied = bedsData.value.filter((b) => b.status === 'occupied').length
  const vacant = bedsData.value.filter((b) => b.status === 'vacant').length
  return { occupied, vacant, total: bedsData.value.length }
})
</script>

<template>
  <div class="facility-studio">
    <header class="facility-header">
      <div>
        <h2 class="facility-title">{{ config?.title ?? '工作台' }}</h2>
        <p class="facility-subtitle">{{ config?.subtitle }}</p>
      </div>
      <span class="facility-demo-badge" title="体验演示租户：业务数据为模拟，遥测为真实物联">演示数据 · 康宁护理院（虚构机构）</span>
    </header>

    <div class="facility-body">
      <nav class="facility-tree" aria-label="岗位流程树">
        <template v-for="node in config?.tree ?? []" :key="node.key">
          <div class="tree-level1">{{ node.label }}</div>
          <template v-if="node.children?.length">
            <button
              v-for="child in node.children"
              :key="child.key"
              type="button"
              :class="['tree-level2', activeNode?.key === child.key && 'active']"
              @click="activeKey = child.key"
            >
              <span>{{ child.label }}</span>
            </button>
          </template>
          <button
            v-else-if="node.panel"
            type="button"
            :class="['tree-level2', activeNode?.key === node.key && 'active']"
            @click="activeKey = node.key"
          >
            <span>{{ node.label }}</span>
          </button>
        </template>
      </nav>

      <section class="facility-panel">
        <h3 class="panel-title">{{ activeNode?.panel?.title }}</h3>

        <div v-if="fetchError" class="panel-error">{{ fetchError }}</div>
        <div v-else-if="loading" class="panel-loading">数据加载中…</div>

        <!-- note：契约落地前的诚实占位 -->
        <div v-else-if="activeNode?.panel?.kind === 'note'" class="panel-note">
          <p>{{ activeNode.panel.note }}</p>
        </div>

        <!-- overview：指标卡（数值字段泛化渲染，未知键原样展示，不编造） -->
        <div v-else-if="activeNode?.panel?.kind === 'overview'" class="metric-grid">
          <div v-for="(v, k) in overviewData" :key="String(k)" class="metric-card">
            <template v-if="typeof v === 'number'">
              <div class="metric-value">{{ v }}</div>
              <div class="metric-label">{{ metricLabel(String(k)) }}</div>
            </template>
          </div>
        </div>

        <!-- alerts：告警流列表 -->
        <div v-else-if="activeNode?.panel?.kind === 'alerts'" class="alert-list">
          <div v-if="!alertsData.length" class="panel-empty">当前无告警记录（空态诚实呈现）</div>
          <div v-for="(a, i) in alertsData" :key="String(a.alert_id ?? i)" class="alert-item">
            <div class="alert-line">
              <span class="alert-title">{{ a.title }}</span>
              <span class="alert-meta">{{ a.bed_id }} · L{{ a.level }} · {{ a.status === 'handled' ? '已闭环' : a.status === 'missed' ? '未响应' : '处置中' }}</span>
            </div>
            <div class="alert-detail">{{ a.detail }}</div>
          </div>
        </div>

        <!-- beds：床位四态统计 -->
        <div v-else-if="activeNode?.panel?.kind === 'beds'" class="bed-panel">
          <div class="bed-stats">
            <div class="metric-card"><div class="metric-value">{{ bedStats.total }}</div><div class="metric-label">总床位</div></div>
            <div class="metric-card"><div class="metric-value">{{ bedStats.occupied }}</div><div class="metric-label">在住</div></div>
            <div class="metric-card"><div class="metric-value">{{ bedStats.vacant }}</div><div class="metric-label">空置（诚实空态）</div></div>
          </div>
          <div class="bed-grid">
            <div
              v-for="b in bedsData"
              :key="b.bed_id"
              class="bed-cell"
              :class="b.status === 'occupied' ? 'occupied' : 'vacant'"
              :title="`${b.bed_id} · ${b.ward ?? ''} · ${b.status === 'occupied' ? '在住' : '空床'}`"
            >
              {{ b.bed_id }}
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.facility-studio { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.facility-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border, #e2e4e8); }
.facility-title { margin: 0; font-size: 18px; }
.facility-subtitle { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary, #6b7280); }
.facility-demo-badge { flex-shrink: 0; font-size: 12px; color: #8a5a1e; background: rgba(200, 149, 108, 0.18); border: 1px solid rgba(200, 149, 108, 0.45); border-radius: 999px; padding: 3px 10px; }
.facility-body { flex: 1; display: grid; grid-template-columns: 220px 1fr; min-height: 0; }
.facility-tree { border-right: 1px solid var(--border, #e2e4e8); padding: 12px 10px; overflow: auto; }
.tree-level1 { font-size: 12px; font-weight: 600; color: var(--text-secondary, #6b7280); margin: 10px 4px 6px; letter-spacing: 0.04em; }
.tree-level2 { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 7px 10px; border-radius: 8px; font-size: 13px; cursor: pointer; color: inherit; }
.tree-level2:hover { background: var(--bg-subtle, #f3f4f6); }
.tree-level2.active { background: var(--brand-soft, rgba(11, 122, 117, 0.12)); color: var(--brand, #0b7a75); font-weight: 600; }
.facility-panel { padding: 16px 18px; overflow: auto; }
.panel-title { margin: 0 0 12px; font-size: 15px; }
.panel-note { border: 1px dashed var(--border, #d7dade); border-radius: 10px; padding: 18px; color: var(--text-secondary, #6b7280); font-size: 13px; background: var(--bg-subtle, #fafbfc); }
.panel-note p { margin: 0; }
.panel-loading, .panel-empty, .panel-error { padding: 18px; font-size: 13px; color: var(--text-secondary, #6b7280); }
.panel-error { color: #b42318; }
.metric-grid, .bed-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px; }
.metric-card { border: 1px solid var(--border, #e2e4e8); border-radius: 10px; padding: 12px; background: #fff; }
.metric-value { font-size: 20px; font-weight: 700; }
.metric-label { font-size: 12px; color: var(--text-secondary, #6b7280); margin-top: 2px; }
.alert-list { display: flex; flex-direction: column; gap: 8px; }
.alert-item { border: 1px solid var(--border, #e2e4e8); border-radius: 10px; padding: 10px 12px; background: #fff; }
.alert-line { display: flex; justify-content: space-between; gap: 10px; }
.alert-title { font-weight: 600; font-size: 13px; }
.alert-meta { font-size: 12px; color: var(--text-secondary, #6b7280); }
.alert-detail { font-size: 12px; color: var(--text-secondary, #6b7280); margin-top: 4px; }
.bed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; }
.bed-cell { text-align: center; font-size: 11px; padding: 7px 2px; border-radius: 6px; border: 1px solid var(--border, #e2e4e8); }
.bed-cell.occupied { background: rgba(11, 122, 117, 0.1); border-color: rgba(11, 122, 117, 0.35); }
.bed-cell.vacant { background: var(--bg-subtle, #fafbfc); color: var(--text-secondary, #9ca3af); }
</style>
