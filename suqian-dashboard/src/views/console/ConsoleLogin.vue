<script setup lang="ts">
import { ref } from 'vue'
import { login } from '../../api/client'
import anqiaoLogoUrl from '../../assets/logo.png'

const emit = defineEmits<{ (e: 'success'): void }>()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  if (submitting.value) return
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  submitting.value = true
  try {
    await login(username.value.trim(), password.value)
    emit('success')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="console-login-wrap">
    <div class="console-login-card">
      <div class="console-login-brand">
        <img :src="anqiaoLogoUrl" alt="中科安樵" class="console-login-logo" />
        <h1>安守护 · 运营管理平台</h1>
        <p>温和守护每一夜安稳睡眠</p>
      </div>

      <form @submit.prevent="submit">
        <div class="console-field">
          <label for="console-username">用户名</label>
          <input
            id="console-username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="请输入账号"
          />
        </div>
        <div class="console-field">
          <label for="console-password">密码</label>
          <input
            id="console-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
          />
        </div>

        <p v-if="error" class="console-error">{{ error }}</p>

        <button class="console-btn console-btn-primary console-btn-block" type="submit" :disabled="submitting">
          {{ submitting ? '登录中…' : '登 录' }}
        </button>
      </form>
    </div>
  </div>
</template>
