<script setup lang="ts">
import { computed } from 'vue'
import type { SessionInfo } from '../../../api/http'

const props = defineProps<{
  session: SessionInfo
  expanded?: boolean
}>()

const label = computed(() => {
  const scope = props.session.data_scope || props.session.principal?.data_scope || ''
  const floors = props.session.principal?.assigned_floors?.join('、') || ''
  const pool = (props.session.principal as { pool_id?: string } | undefined)?.pool_id
    || (props.session as { pool_id?: string }).pool_id
    || ''
  if (scope === 'global') return '全域穿透'
  if (scope === 'pool') return pool ? `统筹区 ${pool}` : '统筹区监管'
  if (scope === 'task') return '本人任务'
  if (scope === 'applicant') return '授权对象'
  if (scope === 'assigned') return floors ? `分配楼层 ${floors}` : '分配范围'
  if (scope === 'org') return `本机构${props.session.tenant?.name ? ' · ' + props.session.tenant.name : ''}`
  if (scope === 'channel') return '本渠道'
  return scope || '—'
})

const detail = computed(() => {
  const parts: string[] = []
  parts.push(`data_scope: ${props.session.data_scope || '—'}`)
  if (props.session.principal?.org_name) parts.push(`组织: ${props.session.principal.org_name}`)
  if (props.session.principal?.role) parts.push(`角色: ${props.session.principal.role}`)
  return parts.join(' · ')
})
</script>

<template>
  <span class="scope-badge" :title="detail">
    <span class="scope-dot" aria-hidden="true"></span>
    <span v-if="expanded || true" class="scope-text">范围: {{ label }}</span>
  </span>
</template>

<style scoped>
.scope-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #0f172a;
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  border: 1px solid rgba(56, 189, 248, 0.25);
  max-width: 280px;
}
.scope-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  flex-shrink: 0;
}
.scope-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
