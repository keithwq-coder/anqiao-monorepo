<script setup lang="ts">
// 体验态常驻演示标识（PRD §2.3.1 体验域行）：向体验客户明示业务数据为模拟、设备遥测为真实物联。
// 仅在演示统筹区（pool_id === 'moumou'）会话中由挂载方控制显示。
</script>

<template>
  <div class="demo-pool-banner">演示统筹区：客户与业务数据为模拟；设备遥测为真实物联数据</div>
</template>

<style scoped>
.demo-pool-banner {
  position: sticky;
  top: 0;
  z-index: 60;
  width: 100%;
  padding: 4px 16px;
  background: #dc2626;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-align: center;
  pointer-events: none;
}
</style>
