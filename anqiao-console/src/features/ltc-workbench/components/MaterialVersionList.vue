<script setup lang="ts">
import type { MaterialItem } from '../../../api/ltc-application'
import StatusPill from './StatusPill.vue'

defineProps<{
  items: MaterialItem[]
  applicationStatus?: string
}>()
</script>

<template>
  <div class="material-version-list">
    <div v-if="!items.length" class="empty">暂无材料记录</div>
    <table v-else class="mat-table">
      <thead>
        <tr>
          <th>材料项</th>
          <th>版本</th>
          <th>状态</th>
          <th>更新时间</th>
          <th>退回说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in items" :key="m.material_id">
          <td>
            <div class="mat-name">{{ m.template_item }}</div>
            <div class="mat-id mono">{{ m.material_id }}</div>
          </td>
          <td>v{{ m.version }}</td>
          <td>
            <StatusPill :state="m.status" object-type="material" />
          </td>
          <td class="time">{{ m.updated_at }}</td>
          <td class="reason">{{ m.return_reason || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="applicationStatus === 'materials_rejected'" class="hint">
      退回补正：请按上表「退回说明」逐项更新后重新提交。新版本将关联原申请，旧版本可追溯。
    </p>
  </div>
</template>

<style scoped>
.material-version-list {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
}
.mat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mat-table th {
  text-align: left;
  color: #64748b;
  font-weight: 600;
  padding: 8px 6px;
  border-bottom: 1px solid #e2e8f0;
}
.mat-table td {
  padding: 10px 6px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}
.mat-name {
  font-weight: 600;
  color: #0f172a;
}
.mat-id {
  font-size: 11px;
  color: #94a3b8;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
.time {
  color: #64748b;
  font-size: 12px;
}
.reason {
  color: #b45309;
  font-size: 12px;
  max-width: 220px;
}
.empty {
  color: #64748b;
  font-size: 13px;
  padding: 12px;
}
.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #b45309;
}
</style>
