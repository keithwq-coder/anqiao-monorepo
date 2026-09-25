<script setup lang="ts">
import { useHomeCareStore } from '../home-care-store'
import type { GridCaregiver } from '../home-care-data'

const props = defineProps<{
  caregiver: GridCaregiver
}>()

const store = useHomeCareStore()

function handleViewAreaElders() {
  store.viewAllAreaElders(props.caregiver.areaKey)
}
</script>

<template>
  <div class="off-duty-empty-card">
    <div class="empty-icon-wrap">
      <span class="icon-avatar">{{ caregiver.avatar }}</span>
      <span class="moon-badge">🌙</span>
    </div>

    <div class="empty-content">
      <h3 class="empty-title">{{ caregiver.name }} · 今日排班轮休中</h3>
      <p class="empty-role">{{ caregiver.areaName }} · {{ caregiver.roleTitle }}</p>
      
      <div class="handover-notice">
        <div class="notice-badge">交接与运转状态</div>
        <p class="notice-desc">
          该人员今日轮休，所分管社区长者日常起居探访与紧急入户照护任务，已由
          <strong>{{ caregiver.areaName }}当班照护团队</strong>
          进行全权代管与工单兜底。
        </p>
      </div>

      <div class="action-row">
        <button class="btn-primary-view" @click="handleViewAreaElders">
          一键查看 {{ caregiver.areaName }} 全体在管长者
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.off-duty-empty-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 36px 32px;
  text-align: center;
  max-width: 580px;
  margin: 40px auto;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(12px);
}

.empty-icon-wrap {
  position: relative;
  display: inline-block;
  margin-bottom: 16px;
}

.icon-avatar {
  font-size: 52px;
  display: block;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
}

.moon-badge {
  position: absolute;
  bottom: -4px;
  right: -6px;
  font-size: 20px;
  background: #334155;
  border-radius: 50%;
  padding: 2px 4px;
  border: 2px solid #0f172a;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 6px;
}

.empty-role {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 20px;
}

.handover-notice {
  background: rgba(15, 23, 42, 0.6);
  border: 1px dashed rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 24px;
  text-align: left;
}

.notice-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.notice-desc {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.6;
  margin: 0;
}

.notice-desc strong {
  color: #f8fafc;
}

.action-row {
  display: flex;
  justify-content: center;
}

.btn-primary-view {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: #ffffff;
  border: none;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-primary-view:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.45);
  background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
}
</style>
