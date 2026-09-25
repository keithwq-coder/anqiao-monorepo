<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getGeoCities, getGeoDevices } from '../../api/client'
import type { CityStat, DevicePoint } from '../../api/types'

const allDevices = ref<DevicePoint[] | null>(null)
const cities = ref<CityStat[]>([])
const loadError = ref('')

const filters = reactive({ city: '', type: '', status: '' as '' | 'online' | 'offline' | 'alerting' })
const page = ref(1)
const PAGE_SIZE = 20

const deviceTypes = computed(() => {
  const set = new Set<string>()
  for (const d of allDevices.value ?? []) set.add(d.type)
  return [...set].sort()
})

// 设备档案城市用全称 '苏州市'，城市筛选项用短名 '苏州'，匹配时忽略「市」后缀
const normCity = (s?: string | null) => (s ?? '').replace(/市$/, '')

const filtered = computed(() => {
  let list = allDevices.value ?? []
  if (filters.city) list = list.filter((d) => normCity(d.city) === normCity(filters.city))
  if (filters.type) list = list.filter((d) => d.type === filters.type)
  if (filters.status === 'online') list = list.filter((d) => d.online && !d.alerting)
  else if (filters.status === 'offline') list = list.filter((d) => !d.online)
  else if (filters.status === 'alerting') list = list.filter((d) => d.alerting)
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageList = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

async function load() {
  loadError.value = ''
  try {
    const [cs, ds] = await Promise.all([getGeoCities(), getGeoDevices()])
    cities.value = cs
    allDevices.value = ds.list
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  }
}

function applyFilters() {
  page.value = 1
}

onMounted(() => void load())

function fmtTime(iso: string): string {
  return iso.slice(5, 16).replace('T', ' ')
}
</script>

<template>
  <div class="console-page-head">
    <h2>设备管理</h2>
    <p>全国在网设备台账（全网实时资产库），支持按城市 / 区县 / 社区 / 型号 / 状态筛选与单台设备精准运维。</p>
  </div>

  <section class="console-panel">
    <div class="console-panel-head">
      <h2>设备台账</h2>
      <div class="filters">
        <select class="console-select" v-model="filters.city" @change="applyFilters">
          <option value="">全部城市</option>
          <option v-for="c in cities" :key="c.city" :value="c.city">{{ c.city }}</option>
        </select>
        <select class="console-select" v-model="filters.type" @change="applyFilters">
          <option value="">全部型号</option>
          <option v-for="t in deviceTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select class="console-select" v-model="filters.status" @change="applyFilters">
          <option value="">全部状态</option>
          <option value="online">在线</option>
          <option value="offline">离线</option>
          <option value="alerting">告警中</option>
        </select>
      </div>
    </div>

    <div v-if="loadError" class="console-errorbar">
      {{ loadError }}
      <span class="spacer"></span>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="load">重试</button>
    </div>

    <div v-else-if="!allDevices" class="console-skeleton">
      <div class="skel" style="height: 48px" v-for="i in 8" :key="i"></div>
    </div>

    <div v-else-if="filtered.length === 0" class="console-empty">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      当前筛选条件下没有匹配的设备。
    </div>

    <template v-else>
      <table class="console-table">
        <thead>
          <tr>
            <th>设备SN</th>
            <th>型号</th>
            <th>城市</th>
            <th>区县</th>
            <th>所属社区 / 示范点</th>
            <th>点位 / 客户</th>
            <th>状态</th>
            <th>最近数据时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in pageList" :key="d.device_id">
            <td class="console-cell-title console-num">{{ d.device_id }}</td>
            <td style="font-size: 12px">{{ d.type }}</td>
            <td>{{ d.city }}</td>
            <td><span class="console-tag-district">{{ d.district ?? '—' }}</span></td>
            <td style="font-size: 12px">{{ d.community ?? '—' }}</td>
            <td>
              <div>{{ d.label ?? '—' }}</div>
              <div class="console-cell-sub">{{ d.customer }}</div>
            </td>
            <td>
              <span v-if="d.alerting" class="console-dot-badge d-abnormal"><span class="dot"></span>告警中</span>
              <span v-else-if="d.online" class="console-dot-badge d-in-bed"><span class="dot"></span>在线</span>
              <span v-else class="console-dot-badge d-off-bed"><span class="dot"></span>离线</span>
            </td>
            <td class="console-num">{{ fmtTime(d.last_data_time) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="console-pagination">
        <span>共 {{ filtered.length }} 台 · 第 {{ page }} / {{ totalPages }} 页</span>
        <span class="spacer"></span>
        <button class="console-btn console-btn-ghost console-btn-sm" :disabled="page <= 1" @click="page--">上一页</button>
        <button class="console-btn console-btn-ghost console-btn-sm" :disabled="page >= totalPages" @click="page++">下一页</button>
      </div>
    </template>
  </section>
</template>

