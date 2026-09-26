<script setup lang="ts">
// 左侧两级 SOP 流程树（LTC-WORKBENCH-SPEC §12.4.1）
// Level 1 业务阶段 → Level 2 状态队列；末端徽标由 N16 树计数 + N01 分组计数实时驱动
import { computed } from 'vue'
import type { WorkbenchWorkflowTree, WorkbenchSummary } from '../../../api/ltc-workbench'

const props = defineProps<{
  tree: WorkbenchWorkflowTree | null
  /** 形如 `${groupKey}::${stageKey}` 的当前选中节点键 */
  activeKey: string
  summary?: WorkbenchSummary | null
}>()

const emit = defineEmits<{
  (e: 'select', groupKey: string, item: { stageKey: string; label: string; summaryGroup?: string }): void
}>()

const nodes = computed(() => {
  if (!props.tree) return []
  return props.tree.groups.map((g) => ({
    groupKey: g.groupKey,
    groupLabel: g.groupLabel,
    items: g.items.map((i) => {
      let count = i.badgeCount ?? 0
      if (i.summaryGroup && props.summary) {
        const grp = props.summary.groups.find((x) => x.key === i.summaryGroup)
        if (grp) count = grp.total
      }
      return {
        stageKey: i.stageKey,
        label: i.label,
        badgeCount: count,
        badgeTone: count > 0 ? (i.badgeTone || 'warn') : 'normal',
        summaryGroup: i.summaryGroup,
      }
    }),
  }))
})

function nodeKey(groupKey: string, stageKey: string) {
  return `${groupKey}::${stageKey}`
}
</script>

<template>
  <nav class="sop-tree" aria-label="业务 SOP 流程树">
    <div v-if="tree" class="sop-domain">
      <div class="sop-domain-title">{{ tree.domainTitle }}</div>
    </div>
    <div v-for="g in nodes" :key="g.groupKey" class="sop-group">
      <div class="sop-group-label">{{ g.groupLabel }}</div>
      <button
        v-for="item in g.items"
        :key="nodeKey(g.groupKey, item.stageKey)"
        type="button"
        :class="['sop-item', activeKey === nodeKey(g.groupKey, item.stageKey) && 'active']"
        @click="emit('select', g.groupKey, { stageKey: item.stageKey, label: item.label, summaryGroup: item.summaryGroup })"
      >
        <span class="sop-item-label">{{ item.label }}</span>
        <span v-if="item.badgeCount > 0" :class="['sop-badge', `tone-${item.badgeTone}`]">{{ item.badgeCount }}</span>
      </button>
    </div>
    <div v-if="!tree" class="sop-loading">流程树加载中…</div>
  </nav>
</template>

<style scoped>
.sop-tree {
  width: 232px;
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-self: flex-start;
}
.sop-domain {
  padding: 8px 10px;
  background: linear-gradient(135deg, #0f172a, #1e3a5f);
  border-radius: 8px;
}
.sop-domain-title {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
}
.sop-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sop-group-label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  padding: 0 8px 4px;
  letter-spacing: 0.02em;
}
.sop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
}
.sop-item:hover {
  background: #f1f5f9;
}
.sop-item.active {
  background: #e0f2fe;
  border-left-color: #0284c7;
  color: #075985;
}
.sop-item-label {
  flex: 1;
  line-height: 1.35;
}
.sop-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sop-badge.tone-warn {
  background: #fef3c7;
  color: #b45309;
}
.sop-badge.tone-danger {
  background: #fee2e2;
  color: #b91c1c;
}
.sop-loading {
  font-size: 12px;
  color: #94a3b8;
  padding: 8px;
}
@media (max-width: 1100px) {
  .sop-tree {
    width: 200px;
  }
}
</style>
