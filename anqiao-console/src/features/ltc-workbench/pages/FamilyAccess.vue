<script setup lang="ts">
// 家属准入页：认证成功但绑定/授权未满足时展示（LTC-WORKBENCH-SPEC §3.1.3）
defineProps<{
  reason?: string
  requests?: Array<{ id: string; state: string; updated_at?: string }>
}>()

const emit = defineEmits<{
  (e: 'submit-binding'): void
  (e: 'refresh'): void
  (e: 'logout'): void
}>()
</script>

<template>
  <div class="family-access">
    <header class="access-header">
      <h1>关系与授权</h1>
      <p class="access-reason">{{ reason || '当前账号尚无有效授权对象' }}</p>
    </header>

    <section class="access-card">
      <h2>准入状态</h2>
      <ul class="access-steps">
        <li>1. 账号身份认证 — 已完成</li>
        <li>2. 绑定关系核验 — 待补齐</li>
        <li>3. 本人/监护人授权 — 待补齐</li>
      </ul>
      <p class="access-hint">
        请提交绑定核验申请（关系凭证 + 授权凭证）。核验通过后进入家属工作台，仅加载获授权对象。
      </p>
      <div class="access-actions">
        <button type="button" class="btn primary" @click="emit('submit-binding')">办理绑定核验</button>
        <button type="button" class="btn" @click="emit('refresh')">刷新状态</button>
        <button type="button" class="btn" @click="emit('logout')">退出登录</button>
      </div>
    </section>

    <section v-if="requests?.length" class="access-card">
      <h2>核验申请</h2>
      <ul class="req-list">
        <li v-for="r in requests" :key="r.id">
          <span class="mono">{{ r.id }}</span>
          <span>{{ r.state }}</span>
          <span class="muted">{{ r.updated_at || '' }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.family-access {
  max-width: 560px;
  margin: 48px auto;
  padding: 0 16px;
}
.access-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #0f172a;
}
.access-reason {
  margin: 0 0 20px;
  color: #b45309;
  font-weight: 600;
}
.access-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.access-card h2 {
  margin: 0 0 12px;
  font-size: 15px;
}
.access-steps {
  margin: 0 0 12px;
  padding-left: 18px;
  color: #334155;
  line-height: 1.8;
  font-size: 14px;
}
.access-hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: #64748b;
}
.access-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.req-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
}
.req-list li {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
.muted {
  color: #94a3b8;
}
</style>
