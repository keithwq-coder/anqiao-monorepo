<script setup lang="ts">
import { computed } from 'vue'
import StatusPill from './StatusPill.vue'

export interface ReceiptView {
  receipt_id: string
  object_id: string
  state: string
  version?: string | number
  occurred_at: string
  next_owner_role?: string | null
  action_label?: string
}

const props = defineProps<{
  receipt: ReceiptView
  objectType?: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'continue'): void
}>()

const timeText = computed(() => {
  try {
    return new Date(props.receipt.occurred_at).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return props.receipt.occurred_at
  }
})
</script>

<template>
  <div class="action-receipt" role="status">
    <div class="receipt-row">
      <span class="receipt-k">对象</span>
      <span class="receipt-v mono">{{ receipt.object_id }}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-k">动作</span>
      <span class="receipt-v">{{ receipt.action_label || receipt.state }}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-k">新状态</span>
      <span class="receipt-v"><StatusPill :state="receipt.state" :object-type="objectType" /></span>
    </div>
    <div class="receipt-row">
      <span class="receipt-k">发生时间</span>
      <span class="receipt-v">{{ timeText }}</span>
    </div>
    <div v-if="receipt.next_owner_role" class="receipt-row">
      <span class="receipt-k">下一责任方</span>
      <span class="receipt-v">{{ receipt.next_owner_role }}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-k">回执号</span>
      <span class="receipt-v mono">{{ receipt.receipt_id }}</span>
    </div>
    <div class="receipt-actions">
      <button type="button" class="btn btn-ghost" @click="emit('back')">返回列表</button>
      <button type="button" class="btn btn-primary" @click="emit('continue')">继续办理</button>
    </div>
  </div>
</template>

<style scoped>
.action-receipt {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.receipt-row {
  display: flex;
  gap: 12px;
  font-size: 13px;
  line-height: 1.5;
}
.receipt-k {
  width: 72px;
  color: #64748b;
  flex-shrink: 0;
}
.receipt-v {
  color: #0f172a;
  font-weight: 500;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
.receipt-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.btn {
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-ghost {
  background: #fff;
  border-color: #cbd5e1;
  color: #334155;
}
.btn-primary {
  background: #2563eb;
  color: #fff;
}
</style>
