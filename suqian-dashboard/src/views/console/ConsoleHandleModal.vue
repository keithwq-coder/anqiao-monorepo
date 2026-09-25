<script setup lang="ts">
import { ref } from 'vue'
import { handleAlert } from '../../api/client'
import { TYPE_LABELS, fmtTime } from './labels'
import type { Alert } from '../../api/types'

const props = defineProps<{ alert: Alert }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>()

const note = ref('')
const noteError = ref('')
const submitting = ref(false)

function close() {
  if (!submitting.value) emit('close')
}

async function submit() {
  if (submitting.value) return
  const trimmed = note.value.trim()
  if (!trimmed) {
    noteError.value = '请填写处置备注'
    return
  }
  if (trimmed.length > 200) {
    noteError.value = '处置备注不能超过 200 字'
    return
  }
  noteError.value = ''
  submitting.value = true
  try {
    await handleAlert(props.alert.alert_id, trimmed)
    emit('done')
  } catch (e) {
    noteError.value = e instanceof Error ? e.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="console-modal-mask" @click.self="close">
    <div class="console-modal">
      <h3>处置告警 · {{ alert.title }}</h3>
      <p class="modal-sub">
        {{ alert.bed_id }} · {{ TYPE_LABELS[alert.type] }} · 发生于 {{ fmtTime(alert.occurred_at) }}
      </p>
      <div class="console-field">
        <label for="console-handle-note">处置备注（必填，不超过 200 字）</label>
        <textarea
          id="console-handle-note"
          v-model="note"
          maxlength="200"
          placeholder="例如：到场排查，体征平稳，已协助长者回床休息"
        ></textarea>
        <div class="note-count">{{ note.trim().length }}/200</div>
      </div>
      <p v-if="noteError" class="console-error">{{ noteError }}</p>
      <div class="modal-actions">
        <button class="console-btn console-btn-ghost" :disabled="submitting" @click="close">取消</button>
        <button class="console-btn console-btn-primary" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '确认处置' }}
        </button>
      </div>
    </div>
  </div>
</template>
