<script setup lang="ts">
// 主从工作间 · 案卷队列态（LTC-WORKBENCH-SPEC §12.4.2 Master List View）
// 点击案卷卡片进入全屏三栏办理态，杜绝局促弹窗
import type { MasterQueueCard } from '../../../types/workbench-ia'

defineProps<{
  title: string
  cards: MasterQueueCard[]
  emptyText?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', card: MasterQueueCard): void
}>()
</script>

<template>
  <section class="queue-list">
    <header class="queue-head">
      <div class="queue-title">{{ title }}</div>
      <div class="queue-count">{{ cards.length }} 件案卷</div>
    </header>
    <div v-if="loading" class="queue-empty">数据加载中…</div>
    <div v-else-if="cards.length === 0" class="queue-empty">{{ emptyText || '当前队列暂无案卷' }}</div>
    <div v-else class="queue-body">
      <button v-for="c in cards" :key="c.id" type="button" class="queue-card" @click="emit('open', c)">
        <div class="queue-card-top">
          <span class="queue-card-title">{{ c.title }}</span>
          <span :class="['queue-status', `tone-${c.statusTone}`]">{{ c.statusLabel }}</span>
        </div>
        <div v-if="c.subtitle" class="queue-card-subtitle">{{ c.subtitle }}</div>
        <div v-if="c.meta && c.meta.length" class="queue-card-meta">
          <span v-for="(m, i) in c.meta" :key="i" class="queue-meta-chip">{{ m }}</span>
        </div>
        <div v-if="c.dueLabel" class="queue-card-due">⏱ {{ c.dueLabel }}</div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.queue-list {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.queue-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
}
.queue-title {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}
.queue-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
}
.queue-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  align-content: start;
}
.queue-empty {
  padding: 40px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.queue-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  font: inherit;
}
.queue-card:hover {
  border-color: #0284c7;
  background: #f0f9ff;
  transform: translateY(-1px);
}
.queue-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.queue-card-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.queue-status {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
.queue-status.tone-info { background: #e0f2fe; color: #0369a1; }
.queue-status.tone-warning { background: #fef3c7; color: #b45309; }
.queue-status.tone-success { background: #dcfce7; color: #15803d; }
.queue-status.tone-purple { background: #ede9fe; color: #6d28d9; }
.queue-status.tone-danger { background: #fee2e2; color: #b91c1c; }
.queue-status.tone-default { background: #f1f5f9; color: #475569; }
.queue-card-subtitle {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}
.queue-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.queue-meta-chip {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  color: #475569;
}
.queue-card-due {
  font-size: 11px;
  color: #b45309;
  font-weight: 600;
}
</style>
