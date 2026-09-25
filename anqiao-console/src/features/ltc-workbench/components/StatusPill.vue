<script setup lang="ts">
import { computed } from 'vue'
import { stateLabel, type PillTone } from '../state-labels'

const props = defineProps<{
  state: string
  objectType?: string
}>()

const meta = computed(() => stateLabel(props.state, props.objectType))

const toneClass = computed(() => `pill pill-${meta.value.tone satisfies PillTone}`)
</script>

<template>
  <span :class="toneClass" :title="state">{{ meta.label }}</span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  border: 1px solid transparent;
}
.pill-neutral {
  background: #f1f5f9;
  color: #334155;
  border-color: #e2e8f0;
}
.pill-info {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.pill-success {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}
.pill-warning {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
}
.pill-danger {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}
.pill-muted {
  background: #f8fafc;
  color: #64748b;
  border-color: #e2e8f0;
}
</style>
