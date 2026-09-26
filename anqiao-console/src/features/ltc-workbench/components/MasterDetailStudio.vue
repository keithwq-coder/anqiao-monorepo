<script setup lang="ts">
// 全屏三栏专注办理工作间（LTC-WORKBENCH-SPEC §12.4.2 Detail Studio View）
// 左栏证据卷宗台 30% / 中栏核心业务台 45% / 右栏客观物联硬件对撞台 25% / 底栏法定签署区
defineProps<{
  title: string
  subtitle?: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <section class="studio">
    <header class="studio-head">
      <button type="button" class="studio-back" @click="emit('back')">← 返回案卷队列</button>
      <div class="studio-head-text">
        <div class="studio-title">{{ title }}</div>
        <div v-if="subtitle" class="studio-subtitle">{{ subtitle }}</div>
      </div>
    </header>
    <div class="studio-body">
      <div class="studio-col col-evidence">
        <div class="col-label">📁 证据卷宗台</div>
        <div class="col-content"><slot name="evidence" /></div>
      </div>
      <div class="studio-col col-business">
        <div class="col-label">📝 核心业务办理台</div>
        <div class="col-content"><slot name="business" /></div>
      </div>
      <div class="studio-col col-telemetry">
        <div class="col-label">📡 客观物联硬件对撞台</div>
        <div class="col-content"><slot name="telemetry" /></div>
      </div>
    </div>
    <footer v-if="$slots.signature" class="studio-signature">
      <div class="signature-label">🖋️ 法定签署区</div>
      <div class="signature-content"><slot name="signature" /></div>
    </footer>
  </section>
</template>

<style scoped>
.studio {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.studio-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.studio-back {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.studio-back:hover {
  background: #f1f5f9;
}
.studio-head-text {
  min-width: 0;
}
.studio-title {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}
.studio-subtitle {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}
.studio-body {
  display: grid;
  grid-template-columns: 30fr 45fr 25fr;
  gap: 1px;
  background: #e2e8f0;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.studio-col {
  background: #ffffff;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.col-label {
  font-size: 12px;
  font-weight: 800;
  color: #475569;
  padding: 10px 14px 8px;
  border-bottom: 1px dashed #e2e8f0;
  background: #fafbfc;
  position: sticky;
  top: 0;
}
.col-content {
  padding: 12px 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.col-evidence .col-label { color: #075985; }
.col-business .col-label { color: #166534; }
.col-telemetry .col-label { color: #6d28d9; }
.studio-signature {
  border-top: 2px solid #0f172a;
  background: #fffbeb;
  display: flex;
  flex-direction: column;
}
.signature-label {
  font-size: 12px;
  font-weight: 800;
  color: #92400e;
  padding: 8px 16px 0;
}
.signature-content {
  padding: 8px 16px 14px;
}
@media (max-width: 1100px) {
  .studio-body {
    grid-template-columns: 1fr;
  }
}
</style>
