<script setup lang="ts">
// 统一对象上下文头（LTC-WORKBENCH-SPEC §3.5）
import StatusPill from './StatusPill.vue'

defineProps<{
  objectType: string
  objectId: string
  title?: string
  subtitle?: string
  state: string
  responsible?: string
  dueAt?: string | null
  slaStatus?: string | null
  backLabel?: string
}>()

const emit = defineEmits<{ (e: 'back'): void }>()
</script>

<template>
  <header class="object-ctx-header">
    <div class="ctx-left">
      <button v-if="backLabel !== ''" type="button" class="ctx-back" @click="emit('back')">
        ← {{ backLabel || '返回列表' }}
      </button>
      <div class="ctx-title-row">
        <span class="ctx-type">{{ objectType }}</span>
        <span class="ctx-id mono">{{ objectId }}</span>
        <StatusPill :state="state" :object-type="objectType" />
      </div>
      <div v-if="title || subtitle" class="ctx-sub">
        <span v-if="title" class="ctx-title">{{ title }}</span>
        <span v-if="subtitle" class="ctx-subtitle">{{ subtitle }}</span>
      </div>
    </div>
    <div class="ctx-right">
      <div v-if="responsible" class="ctx-meta">
        <span class="k">责任方</span>
        <span class="v">{{ responsible }}</span>
      </div>
      <div v-if="dueAt" class="ctx-meta">
        <span class="k">截止</span>
        <span class="v">{{ dueAt }}</span>
      </div>
      <div v-if="slaStatus && slaStatus !== 'open'" class="ctx-meta">
        <span class="k">时限</span>
        <span class="v" :class="'sla-' + slaStatus">{{ slaStatus === 'overdue' ? '逾期' : slaStatus === 'due_soon' ? '临期' : slaStatus }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.object-ctx-header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.ctx-back {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 6px;
}
.ctx-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ctx-type {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 2px 6px;
}
.ctx-id {
  font-weight: 700;
  color: #0f172a;
  font-size: 14px;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
.ctx-sub {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
}
.ctx-title {
  font-weight: 600;
  color: #334155;
}
.ctx-subtitle {
  color: #64748b;
}
.ctx-right {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}
.ctx-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.ctx-meta .k {
  color: #94a3b8;
}
.ctx-meta .v {
  font-weight: 600;
  color: #0f172a;
}
.sla-overdue {
  color: #b91c1c;
}
.sla-due_soon {
  color: #b45309;
}
</style>
