<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  getDeviceLabels,
  patchDeviceLabel,
  getDeviceLabelStats,
  type DeviceLabel,
} from '../../../api/ltc-family'
import StatusPill from '../components/StatusPill.vue'
import ActionReceipt from '../components/ActionReceipt.vue'

const rows = ref<DeviceLabel[]>([])
const total = ref(0)
const stats = ref<any>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const receipt = ref<any>(null)
const filters = ref({ region_code: '', program_stage: '', environment_type: '', group_by: 'program_stage' })
const editing = ref<DeviceLabel | null>(null)
const draft = ref({ region_code: '', program_stage: '', environment_type: '', owner_type: '', tags: '', reason: '' })

async function load() {
  error.value = null
  try {
    const res = await getDeviceLabels({
      page: 1,
      page_size: 50,
      region_code: filters.value.region_code || undefined,
      program_stage: filters.value.program_stage || undefined,
      environment_type: filters.value.environment_type || undefined,
    })
    rows.value = res.list
    total.value = res.total
    stats.value = await getDeviceLabelStats({ group_by: filters.value.group_by }).catch(() => null)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

function beginEdit(row: DeviceLabel) {
  editing.value = row
  draft.value = {
    region_code: row.region_code || '',
    program_stage: row.program_stage || '',
    environment_type: row.environment_type || '',
    owner_type: row.owner_type || '',
    tags: Array.isArray(row.tags) ? row.tags.join(',') : String(row.tags || ''),
    reason: '',
  }
}

async function saveLabel() {
  if (!editing.value || !draft.value.reason.trim()) return
  busy.value = true
  try {
    const tags = String(draft.value.tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const res = await patchDeviceLabel(editing.value.device_id, {
      region_code: draft.value.region_code || null,
      program_stage: draft.value.program_stage || undefined,
      environment_type: draft.value.environment_type || undefined,
      owner_type: draft.value.owner_type || undefined,
      tags,
      reason: draft.value.reason,
      expected_version: editing.value.version,
    })
    receipt.value = res.receipt
    editing.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    busy.value = false
  }
}

const suqianRegistered = computed(() => stats.value?.suqian_registered ?? 3)
onMounted(load)
</script>

<template>
  <div class="device-labels">
    <div class="row-head">
      <div>
        <h2>设备标签与项目统计</h2>
        <p class="sub">在册 {{ total }} · 宿迁试点在册 {{ suqianRegistered }} 台 · 云扫描仅比对不改台账</p>
      </div>
      <button type="button" class="btn" @click="load">刷新</button>
    </div>

    <div class="filters">
      <label>地域
        <select v-model="filters.region_code" @change="load">
          <option value="">全部</option>
          <option value="suqian">宿迁</option>
          <option value="moumou">某某市</option>
        </select>
      </label>
      <label>业务阶段
        <select v-model="filters.program_stage" @change="load">
          <option value="">全部</option>
          <option value="pilot">试点</option>
          <option value="formal">正式</option>
        </select>
      </label>
      <label>环境
        <select v-model="filters.environment_type" @change="load">
          <option value="">全部</option>
          <option value="production">生产</option>
          <option value="test">测试</option>
          <option value="demo">演示</option>
        </select>
      </label>
      <label>分组
        <select v-model="filters.group_by" @change="load">
          <option value="program_stage">业务阶段</option>
          <option value="environment_type">环境</option>
          <option value="region_code">地域</option>
          <option value="owner_type">业主</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <ActionReceipt v-if="receipt" :receipt="receipt" object-type="device" @back="receipt = null" @continue="receipt = null" />

    <section v-if="stats" class="panel stats">
      <h3>统计（同口径）</h3>
      <div class="chips">
        <span v-for="g in stats.list" :key="g.key" class="chip">{{ g.label }}: {{ g.total }}</span>
        <span class="chip warn">宿迁在册: {{ suqianRegistered }}</span>
        <span class="chip">扫描记录: {{ stats.scan_record_total }}</span>
      </div>
    </section>

    <section class="panel">
      <h3>标签列表</h3>
      <div v-if="!rows.length" class="empty">当前筛选无结果</div>
      <table v-else class="tbl">
        <thead>
          <tr>
            <th>设备</th>
            <th>项目</th>
            <th>地域</th>
            <th>阶段</th>
            <th>环境</th>
            <th>标签</th>
            <th>版本</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.device_id">
            <td class="mono">{{ r.device_id }}</td>
            <td>{{ r.project_id }}</td>
            <td>{{ r.region_code || '—' }}</td>
            <td>{{ r.program_stage || '—' }}</td>
            <td>{{ r.environment_type || '—' }}</td>
            <td class="tags">{{ (r.tags || []).join(' / ') }}</td>
            <td>v{{ r.version }}</td>
            <td><button type="button" class="btn sm" @click="beginEdit(r)">编辑</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="editing" class="confirm-box">
      <p class="confirm-title">编辑标签 · {{ editing.device_id }}</p>
      <p class="facts">前后值写入审计；设备主键与在册状态不由此修改。</p>
      <div class="form-grid">
        <label>地域
          <select v-model="draft.region_code">
            <option value="">—</option>
            <option value="suqian">suqian</option>
            <option value="moumou">moumou</option>
          </select>
        </label>
        <label>阶段
          <select v-model="draft.program_stage">
            <option value="">—</option>
            <option value="pilot">pilot</option>
            <option value="formal">formal</option>
          </select>
        </label>
        <label>环境
          <select v-model="draft.environment_type">
            <option value="">—</option>
            <option value="production">production</option>
            <option value="test">test</option>
            <option value="demo">demo</option>
          </select>
        </label>
        <label>业主类型
          <select v-model="draft.owner_type">
            <option value="">—</option>
            <option value="government">government</option>
            <option value="enterprise">enterprise</option>
            <option value="nursing_home">nursing_home</option>
          </select>
        </label>
        <label class="span2">自由标签（逗号分隔）
          <input v-model="draft.tags" />
        </label>
        <label class="span2">修改原因（必填）
          <input v-model="draft.reason" placeholder="例如：试点标签补录" />
        </label>
      </div>
      <div class="confirm-actions">
        <button type="button" class="btn" @click="editing = null">取消</button>
        <button type="button" class="btn primary" :disabled="busy || !draft.reason.trim()" @click="saveLabel">
          {{ busy ? '保存中…' : '保存并记审计' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-labels {
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
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.filters select {
  margin-left: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 6px;
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
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
}
.chip.warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #b45309;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th,
.tbl td {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid #f1f5f9;
}
.tbl th {
  color: #64748b;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
.tags {
  font-size: 12px;
  color: #475569;
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
.confirm-box {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 12px;
}
.confirm-title {
  margin: 0 0 6px;
  font-weight: 700;
}
.facts {
  font-size: 12px;
  color: #475569;
  margin: 0 0 10px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}
.form-grid .span2 {
  grid-column: span 2;
}
.form-grid input,
.form-grid select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
