<script setup lang="ts">
import type { TimelineEvent } from '../../../api/ltc-application'

defineProps<{
  events: TimelineEvent[]
  nextAction?: { key: string; label: string; due_at: string | null } | null
  publishedResult?: {
    result_id: string
    version: string | number
    publisher: string
    published_at: string
    summary: string
  } | null
}>()
</script>

<template>
  <div class="handoff-timeline">
    <div v-if="nextAction" class="next-action">
      <span class="na-label">下一步</span>
      <span class="na-text">{{ nextAction.label }}</span>
      <span v-if="nextAction.due_at" class="na-due">{{ nextAction.due_at }}</span>
    </div>
    <ol v-if="events.length" class="tl">
      <li v-for="e in events" :key="e.event_id" class="tl-item">
        <span class="tl-dot" aria-hidden="true"></span>
        <div class="tl-body">
          <div class="tl-head">
            <span class="tl-label">{{ e.label }}</span>
            <span class="tl-role">{{ e.responsible_role }}</span>
            <span class="tl-time">{{ e.occurred_at }}</span>
          </div>
          <div class="tl-desc">{{ e.public_description }}</div>
          <div v-if="e.receipt_id" class="tl-receipt mono">回执 {{ e.receipt_id }}</div>
        </div>
      </li>
    </ol>
    <div v-else class="empty">暂无进度节点</div>

    <div v-if="publishedResult" class="published">
      <div class="pub-title">正式结果</div>
      <div class="pub-row">
        <span>结果号</span>
        <span class="mono">{{ publishedResult.result_id }} v{{ publishedResult.version }}</span>
      </div>
      <div class="pub-row">
        <span>发布主体</span>
        <span>{{ publishedResult.publisher }}</span>
      </div>
      <div class="pub-row">
        <span>发布时间</span>
        <span>{{ publishedResult.published_at }}</span>
      </div>
      <div class="pub-row">
        <span>摘要</span>
        <span>{{ publishedResult.summary }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.handoff-timeline {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
}
.next-action {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.na-label {
  font-weight: 700;
  color: #1d4ed8;
}
.na-text {
  color: #1e40af;
}
.na-due {
  color: #64748b;
  font-size: 12px;
}
.tl {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}
.tl::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: #e2e8f0;
}
.tl-item {
  position: relative;
  padding: 0 0 14px 20px;
}
.tl-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2563eb;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #dbeafe;
}
.tl-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.tl-label {
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
}
.tl-role {
  font-size: 11px;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 1px 6px;
  color: #475569;
}
.tl-time {
  font-size: 11px;
  color: #94a3b8;
}
.tl-desc {
  font-size: 13px;
  color: #334155;
  margin-top: 2px;
}
.tl-receipt {
  font-size: 11px;
  color: #2563eb;
  margin-top: 2px;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
.empty {
  color: #64748b;
  font-size: 13px;
  padding: 8px 0;
}
.published {
  margin-top: 12px;
  border-top: 1px dashed #e2e8f0;
  padding-top: 10px;
}
.pub-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 6px;
  color: #047857;
}
.pub-row {
  display: flex;
  gap: 12px;
  font-size: 13px;
  padding: 3px 0;
}
.pub-row span:first-child {
  width: 72px;
  color: #64748b;
  flex-shrink: 0;
}
</style>
