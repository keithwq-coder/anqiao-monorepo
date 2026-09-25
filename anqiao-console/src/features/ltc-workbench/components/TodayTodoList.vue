<script setup lang="ts">
import { computed } from 'vue'
import type { WorkbenchTodo } from '../../../api/ltc-workbench'
import { sortTodos, slaLabel, stateLabel } from '../state-labels'
import StatusPill from './StatusPill.vue'

const props = defineProps<{
  todos: WorkbenchTodo[]
  loading?: boolean
  error?: string | null
  emptyHint?: string
}>()

const emit = defineEmits<{
  (e: 'open', todo: WorkbenchTodo): void
  (e: 'retry'): void
}>()

const sorted = computed(() => sortTodos(props.todos))

function slaOf(todo: WorkbenchTodo): string {
  if (!todo.due_at) return 'open'
  const due = Date.parse(todo.due_at)
  if (Number.isNaN(due)) return 'open'
  const now = Date.now()
  if (due < now) return 'overdue'
  if (due - now < 24 * 3600 * 1000) return 'due_soon'
  return 'open'
}

function dueText(todo: WorkbenchTodo): string {
  if (!todo.due_at) return '待处理'
  try {
    return new Date(todo.due_at).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return todo.due_at
  }
}
</script>

<template>
  <div class="today-todo-list">
    <div v-if="loading" class="todo-empty" role="status">加载待办…</div>
    <div v-else-if="error" class="todo-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="retry-btn" @click="emit('retry')">重试</button>
    </div>
    <div v-else-if="!sorted.length" class="todo-empty">
      <p>{{ emptyHint || '今日待办已完成' }}</p>
      <span class="todo-empty-sub">当前筛选无结果时可清除条件；暂无授权对象请前往关系与授权。</span>
    </div>
    <ul v-else class="todo-ul">
      <li v-for="t in sorted" :key="t.id" class="todo-item">
        <button type="button" class="todo-open" @click="emit('open', t)">
          <span class="todo-sla" :class="'sla-' + slaOf(t)">{{ slaLabel(slaOf(t)).label }}</span>
          <span class="todo-title">{{ t.title }}</span>
          <StatusPill :state="t.state" :object-type="t.object_type" />
          <span class="todo-meta">
            <span class="todo-due">{{ dueText(t) }}</span>
            <span class="todo-owner">→ {{ t.next_owner_role }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.today-todo-list {
  min-height: 80px;
}
.todo-ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.todo-item {
  margin: 0;
}
.todo-open {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 10px;
  align-items: center;
  text-align: left;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.todo-open:hover {
  border-color: #93c5fd;
  background: #f8fafc;
}
.todo-sla {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.sla-overdue {
  background: #fef2f2;
  color: #b91c1c;
}
.sla-due_soon {
  background: #fffbeb;
  color: #b45309;
}
.sla-open {
  background: #eff6ff;
  color: #1d4ed8;
}
.todo-title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 11px;
  color: #64748b;
}
.todo-empty,
.todo-error {
  padding: 16px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #e2e8f0;
}
.todo-empty p,
.todo-error p {
  margin: 0 0 6px;
  color: #334155;
  font-weight: 600;
}
.todo-empty-sub {
  font-size: 12px;
}
.retry-btn {
  margin-top: 4px;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
}
@media (max-width: 720px) {
  .todo-open {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }
  .todo-meta {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
