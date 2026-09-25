<script setup lang="ts">
import { computed, onMounted } from 'vue'
import TechChinaMap from '../components/TechChinaMap.vue'
import { ORG_PROFILES } from '../assets/orgData'
import { ANQIAO_DEVICES } from '../assets/anqiaoDevices'
import { cloudGatewayHealth, deviceTelemetry, freshnessOf, isOnline, lastSampleTime, liveDeviceCount, presenceOf } from '../api/deviceTelemetry'
import { deviceIpGeoOf, ipGeoLabel, resolveDeviceIpGeo } from '../api/ipGeo'

const props = withDefaults(
  defineProps<{
    active: boolean
    orgId?: string
  }>(),
  {
    orgId: 'anqiao',
  }
)

const emit = defineEmits<{ (e: 'select-patient', patientId: string): void }>()

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)

// 实时在线台数（共享遥测 store 实算，5s 轮询刷新；在线=有 ≤120s 新鲜样本，在床/离床均计在线）
const rtLiveCount = computed(() => liveDeviceCount())
const onlineRate = computed(() =>
  ANQIAO_DEVICES.length > 0 ? ((rtLiveCount.value / ANQIAO_DEVICES.length) * 100).toFixed(1) : '0.0'
)

// 3 台设备遥测快照索引（响应式：store 每 5s 轮询刷新后自动重算）
// 三态（用户口径，完全由 latest_data 新鲜样本驱动）：
// person=设备在线·在床（真实样本值，含真实 0）；empty=设备在线·离床（全 0 空数据即在线证据，0 值+样本时间）；
// offline=设备离线（无新鲜样本，不展示任何数值与时间）
const rtDeviceInfo = computed(() => {
  const m: Record<string, {
    state: 'person' | 'empty' | 'offline'
    vitals: { hr: number; br: number; tp: number } | null
    sampleTime: string
  }> = {}
  for (const d of ANQIAO_DEVICES) {
    const online = isOnline(d.sn)
    const presence = presenceOf(d.sn)
    const data = deviceTelemetry[d.sn]?.data ?? null
    const hasSample = freshnessOf(d.sn) === 'live' && !!data
    m[d.sn] = {
      state: !online ? 'offline' : presence === 'empty' ? 'empty' : 'person',
      vitals: online
        ? (data && hasSample
          ? { hr: Math.round(data.hr), br: Math.round(data.br), tp: Number(data.tp.toFixed(1)) }
          : { hr: 0, br: 0, tp: 0 })
        : null,
      sampleTime: online ? lastSampleTime(d.sn) : '',
    }
  }
  return m
})

// 运维事件实算：离线设备即待处置事件（无新鲜遥测样本，如实暴露）
const offlineDevices = computed(() => ANQIAO_DEVICES.filter((d) => !isOnline(d.sn)))
const inBedCount = computed(() => ANQIAO_DEVICES.filter((d) => presenceOf(d.sn) === 'person').length)

onMounted(() => {
  void resolveDeviceIpGeo()
})
</script>

<template>
  <!-- 顶部 KPI 指标卡片（全部实算：3 台真实在册设备 + 共享遥测 store） -->
  <div class="cockpit-kpi-row">
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">在册设备总数 / 实时在线</div>
        <div class="val">
          {{ ANQIAO_DEVICES.length }} 台
          <span style="font-size:13px;color:var(--txt-muted)">/ {{ rtLiveCount }} 台实时在线</span>
        </div>
        <div class="sub">{{ currentOrg.twinDescription.split('，')[0] }}</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">设备在线率 / 连接状态</div>
        <div class="val">
          {{ onlineRate }} %
          <span style="font-size:13px;color:var(--txt-muted)">({{ rtLiveCount }} 台在线 / {{ ANQIAO_DEVICES.length }} 台在册)</span>
        </div>
        <div class="sub">{{ ANQIAO_DEVICES.length }} 台在册 · 物联专网覆盖</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">离线待处置设备</div>
        <div class="val" :style="{ color: offlineDevices.length > 0 ? 'var(--amber)' : '#00ff88' }">
          {{ offlineDevices.length }} 台
        </div>
        <div class="sub">{{ offlineDevices.length > 0 ? '设备离线 · 待运维核查' : '全部设备在线正常' }}</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">云端连接状态</div>
        <div class="val" :style="{ color: cloudGatewayHealth.healthy ? 'var(--mint)' : 'var(--crimson)' }">
          {{ cloudGatewayHealth.totalChecked > 0 ? `${cloudGatewayHealth.successCount}/${cloudGatewayHealth.totalChecked}` : '—' }}
          <span style="font-size:13px;color:var(--txt-muted)">台设备在线</span>
        </div>
        <div class="sub" :style="{ color: cloudGatewayHealth.healthy ? 'var(--mint)' : 'var(--crimson)' }">{{ cloudGatewayHealth.message }}</div>
      </div>
    </div>
  </div>

  <!-- 主区 3 栏 -->
  <div class="cockpit-main-grid">
    <!-- 栏 1：设备点位地图孪生（坐标待确认设备不落点，如实呈现宿迁城域底图） -->
    <div class="hud-card" style="overflow: hidden; display: flex; flex-direction: column">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ currentOrg.twinTitle }}
          <span class="code">SPATIAL TWIN</span>
        </div>
        <span class="hud-badge">宿迁城域 · {{ ANQIAO_DEVICES.length }} 台设备点位 · 实时孪生</span>
      </div>

      <div class="hud-body" style="flex: 1; min-height: 0; padding: 12px; display: flex; flex-direction: column">
        <div class="anqiao-twin-map-wrap">
          <TechChinaMap org-id="anqiao" mode="twin" :selected-city="'宿迁市'" :active="props.active" />
        </div>
      </div>
    </div>

    <!-- 栏 2：设备告警运维闭环流水线（全部由实时遥测实算，无模拟事件） -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          设备告警运维闭环流水线
          <span class="code">DISPATCH SOP</span>
        </div>
        <span class="hud-badge" :style="offlineDevices.length > 0 ? 'color:var(--amber);border-color:var(--amber)' : 'color:var(--mint);border-color:var(--mint)'">
          {{ offlineDevices.length > 0 ? `${offlineDevices.length} 台离线待处置` : '全部在线 · 无待处置事件' }}
        </span>
      </div>

      <div class="hud-body">
        <div class="dispatch-stats-bar">
          <div class="dispatch-stat-cell"><div class="v" style="color:var(--mint)">{{ rtLiveCount }}</div><div class="l">实时在线设备</div></div>
          <div class="dispatch-stat-cell"><div class="v" style="color:var(--cyan)">{{ inBedCount }}</div><div class="l">在床在位监测</div></div>
          <div class="dispatch-stat-cell"><div class="v" :style="{ color: offlineDevices.length > 0 ? 'var(--crimson)' : 'var(--txt-muted)' }">{{ offlineDevices.length }}</div><div class="l">离线待处置</div></div>
        </div>

        <div class="dispatch-flow-box">
          <!-- 离线设备：如实生成待处置事件卡（真实 SN + 最后采样时间） -->
          <div v-for="d in offlineDevices" :key="d.sn" class="dispatch-step-card active-alert">
            <div class="dispatch-step-top">
              <span style="color: var(--amber); font-weight: 700;">⚡ 【设备离线超时】{{ d.label }} · {{ d.sn }}</span>
              <span class="time">暂无实时数据</span>
            </div>
            <div class="dispatch-step-content">
              {{ d.model }} 数据连接中断，已标记离线，运营中心正在核查恢复
            </div>
            <div class="dispatch-step-footer">
              <span>处置岗位: 运营中心 (网络运行保障)</span>
              <span style="color: var(--amber);">● 待核查 · 网络通道 {{ d.network }}</span>
            </div>
          </div>

          <!-- 全部在线：如实空态 -->
          <div v-if="offlineDevices.length === 0" class="dispatch-empty-state">
            <div class="empty-icon">✓</div>
            <div class="empty-title">全部设备在线正常</div>
            <div class="empty-sub">{{ ANQIAO_DEVICES.length }} 台在册设备均在线，暂无待处置事件</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 栏 3：设备点位状态矩阵（3 台真实设备，点击调阅设备画像） -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          设备点位状态矩阵
          <span class="code">DEVICE MATRIX</span>
        </div>
        <span class="hud-badge">{{ ANQIAO_DEVICES.length }} 台在册 · {{ rtLiveCount }} 台实时在线</span>
      </div>
      <div class="hud-body">
        <div class="device-card-list">
          <div
            v-for="d in ANQIAO_DEVICES"
            :key="d.sn"
            class="device-status-card"
            :class="{ online: rtDeviceInfo[d.sn]?.state !== 'offline' }"
            @click="emit('select-patient', d.sn)"
          >
            <div class="dsc-top">
              <span class="dsc-label">{{ d.label }}</span>
              <span class="dsc-badge" :class="rtDeviceInfo[d.sn]?.state !== 'offline' ? 'on' : 'off'">{{ rtDeviceInfo[d.sn]?.state === 'offline' ? '○ 设备离线' : rtDeviceInfo[d.sn]?.state === 'empty' ? '● 在线 · 离床' : '● 在线 · 在床' }}</span>
            </div>
            <div class="dsc-sn">
              <span>{{ d.sn }}</span>
              <span class="dsc-scene">{{ d.model }}</span>
            </div>
            <div class="dsc-meta">IP {{ d.ip && d.ip !== '未提供' ? d.ip : '未提供' }}</div>
            <div class="dsc-meta" style="color: var(--amber);">{{ ipGeoLabel(deviceIpGeoOf(d.sn)?.geo) }}</div>
            <div class="dsc-meta">{{ d.network }} · {{ d.district }} ({{ d.lon?.toFixed(4) }}, {{ d.lat?.toFixed(4) }})</div>
            <div class="dsc-meta" style="color: var(--txt-muted);">
              {{ rtDeviceInfo[d.sn]?.state === 'offline' ? '设备离线 · 暂无实时数据' : rtDeviceInfo[d.sn]?.state === 'empty' ? 'HR 0 · BR 0 · TP 0℃ · 离床' : `HR ${rtDeviceInfo[d.sn].vitals!.hr} · BR ${rtDeviceInfo[d.sn].vitals!.br} · TP ${rtDeviceInfo[d.sn].vitals!.tp}℃ · 在床` }}
            </div>
          </div>
        </div>
        <div class="device-list-footer">
          <span>宿迁长护险 · {{ ANQIAO_DEVICES.length }} 台在册设备 · 物联专网</span>
          <span :style="{ color: cloudGatewayHealth.healthy ? 'var(--mint)' : 'var(--crimson)', fontFamily: `'Share Tech Mono', monospace` }">{{ cloudGatewayHealth.healthy ? '● 连接正常' : '● 连接中断' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dispatch-stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}

.dispatch-stat-cell {
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.14);
  border-radius: 4px;
  padding: 6px;
  text-align: center;
}

.dispatch-stat-cell .v {
  font-family: 'Orbitron', monospace;
  font-size: 18px;
  font-weight: 700;
}

.dispatch-stat-cell .l {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.dispatch-flow-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
}

.dispatch-step-card {
  background: rgba(6, 16, 30, 0.7);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dispatch-step-card.active-alert {
  border-color: rgba(255, 183, 3, 0.5);
  background: rgba(255, 183, 3, 0.06);
}

.dispatch-step-top {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
}

.dispatch-step-top .time {
  font-family: 'Share Tech Mono', monospace;
  color: #94a3b8;
  font-size: 10.5px;
}

.dispatch-step-content {
  font-size: 11px;
  color: #cbd5e1;
  line-height: 1.4;
}

.dispatch-step-footer {
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 10.5px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  padding-top: 4px;
}

.dispatch-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed rgba(0, 255, 136, 0.3);
  border-radius: 6px;
  background: rgba(0, 255, 136, 0.03);
  padding: 18px;
}

.dispatch-empty-state .empty-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 900;
  color: #00ff88;
  border: 1.5px solid rgba(0, 255, 136, 0.5);
  box-shadow: 0 0 14px rgba(0, 255, 136, 0.3);
}

.dispatch-empty-state .empty-title {
  font-size: 13px;
  font-weight: 700;
  color: #00ff88;
  letter-spacing: 1px;
}

.dispatch-empty-state .empty-sub {
  font-size: 10.5px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.5;
}

/* ===================== 设备点位孪生样式 ===================== */
.anqiao-twin-map-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.anqiao-twin-map-wrap :deep(.tech-china-map-container) {
  min-height: 0;
}

.device-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.device-status-card {
  background: rgba(6, 16, 30, 0.7);
  border: 1px solid rgba(100, 116, 139, 0.35);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.device-status-card:hover {
  border-color: rgba(0, 240, 255, 0.55);
  background: rgba(0, 240, 255, 0.06);
  transform: translateY(-1px);
}

.device-status-card.online {
  border-color: rgba(0, 255, 136, 0.45);
  background: rgba(0, 255, 136, 0.05);
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.15);
}

.device-status-card .dsc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.device-status-card .dsc-label {
  font-size: 12.5px;
  font-weight: 700;
  color: #f0fdfa;
}

.device-status-card .dsc-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.device-status-card .dsc-badge.on {
  color: #00ff88;
  background: rgba(0, 255, 136, 0.12);
  border: 1px solid rgba(0, 255, 136, 0.35);
}

.device-status-card .dsc-badge.off {
  color: #94a3b8;
  background: rgba(100, 116, 139, 0.12);
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.device-status-card .dsc-sn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: #38bdf8;
}

.device-status-card .dsc-scene {
  font-size: 10px;
  color: #c77dff;
  background: rgba(199, 125, 255, 0.1);
  border: 1px solid rgba(199, 125, 255, 0.3);
  padding: 0 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.device-status-card .dsc-meta {
  font-size: 10px;
  color: #94a3b8;
  font-family: 'Share Tech Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-list-footer {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(0, 240, 255, 0.03);
  border: 1px solid rgba(0, 240, 255, 0.12);
  border-radius: 4px;
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
