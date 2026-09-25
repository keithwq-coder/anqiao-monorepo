<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TechChinaMap from '../components/TechChinaMap.vue'
import { ORG_PROFILES } from '../assets/orgData'
import { ANQIAO_DEVICES } from '../assets/anqiaoDevices'
import { isOnline, liveDeviceCount, offlineReason, presenceOf } from '../api/deviceTelemetry'
import { MISSING_HINT, MISSING_TEXT } from '../assets/ltciArchive'
import type { DistrictDetail } from '../assets/geoHierarchy'

const props = withDefaults(
  defineProps<{
    orgId?: string
    active?: boolean
  }>(),
  {
    orgId: 'anqiao',
    active: false,
  }
)

const selectedCity = ref<string | null>(null)
const selectedDistrict = ref<DistrictDetail | null>(null)

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)

// 实时在线台数（共享遥测 store 实算，5s 轮询刷新；在线=有 ≤120s 新鲜样本，在床/离床均计在线）
const rtLiveCount = computed(() => liveDeviceCount())
const onlineRate = computed(() =>
  ANQIAO_DEVICES.length > 0 ? ((rtLiveCount.value / ANQIAO_DEVICES.length) * 100).toFixed(1) : '0.0'
)
const offlineCount = computed(() => ANQIAO_DEVICES.length - rtLiveCount.value)

// 坐标待确认设备（lon/lat=null，禁止伪造地图落点，全部列入此清单如实展示）
const unlocatedDevices = computed(() => ANQIAO_DEVICES.filter((d) => d.lon == null || d.lat == null))

function presenceText(sn: string): string {
  const p = presenceOf(sn)
  if (p === 'person') return '● 在线 · 在床'
  if (p === 'empty') return '● 在线 · 离床'
  return `○ 离线 · ${offlineReason(sn)}`
}

function presenceColor(sn: string): string {
  return isOnline(sn) ? '#00ff88' : 'var(--txt-muted)'
}

watch(
  () => props.orgId,
  () => {
    selectedCity.value = null
    selectedDistrict.value = null
  }
)

function onSelectCity(city: string | null) {
  selectedCity.value = city
  selectedDistrict.value = null
}

function onSelectDistrict(dist: DistrictDetail | null) {
  selectedDistrict.value = dist
}
</script>

<template>
  <!-- 顶部态势 KPI 条（宿迁长护险首批试点 · 3 台真实在册设备，全部实算/如实展示） -->
  <div class="cockpit-kpi-row" style="grid-template-columns: repeat(5, 1fr)">
    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">在册感知设备总数</div>
        <div class="val">
          {{ ANQIAO_DEVICES.length }}
          <span class="unit"> 台</span>
        </div>
        <div class="sub">实时在线 {{ rtLiveCount }} 台 · 离线 {{ offlineCount }} 台</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">设备在线率</div>
        <div class="val">{{ onlineRate }}<span class="unit"> %</span></div>
        <div class="sub">实时数据 · 在床/离床均计在线</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">云端接入架构</div>
        <div class="val">直连</div>
        <div class="sub">物联专网 · 全程加密传输</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">覆盖城市</div>
        <div class="val">宿迁市<span class="unit"> · 1 城</span></div>
        <div class="sub">长护险智慧守护 · 3台在册全量落点</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">参保档案 / 业务告警</div>
        <div class="val"><span class="missing-val" :title="MISSING_HINT" style="font-size:22px;">{{ MISSING_TEXT }}</span></div>
        <div class="sub" style="color:var(--txt-muted)">档案信息完善中</div>
      </div>
    </div>
  </div>

  <!-- 主区：中国地图 + 真实设备清单侧栏 -->
  <div style="flex: 1; display: grid; grid-template-columns: 1fr 360px; gap: 14px; min-height: 0">
    <!-- 左侧主地图 -->
    <div class="hud-card" style="overflow: hidden; display: flex; flex-direction: column">
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ currentOrg.name }} · 设备资产分布态势
          <span class="code">TECH CYBER MAP</span>
        </div>
        <div class="hud-badge">
          {{ selectedCity ? `${selectedCity} · 深度聚焦` : '全国物联感知态势 · 宿迁在册设备全量在网' }}
        </div>
      </div>

      <div class="hud-body" style="padding: 0; flex: 1; overflow: hidden">
        <TechChinaMap
          :active="props.active"
          :org-id="orgId"
          mode="nation"
          :selected-city="selectedCity"
          @select-city="onSelectCity"
          @select-district="onSelectDistrict"
        />
      </div>
    </div>

    <!-- 右侧看板：3 台真实在册设备清单 -->
    <div class="hud-card" style="display: flex; flex-direction: column; overflow: hidden">
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          设备资产清单
          <span class="code">ASSET DIRECTORY</span>
        </div>
      </div>

      <div class="hud-body" style="gap: 8px; overflow-y: auto; padding: 12px">
        <div class="section-hint">
          <span>📡 在册设备明细（在线 {{ rtLiveCount }} / 在册 {{ ANQIAO_DEVICES.length }}）:</span>
        </div>
        <div
          v-for="(d, i) in ANQIAO_DEVICES"
          :key="d.sn"
          class="nation-rank-row"
        >
          <span class="rank-num" :class="{ top1: isOnline(d.sn) }">{{ i + 1 }}</span>
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; justify-content: space-between; align-items: baseline">
              <b style="color: #fff; font-size: 13px">{{ d.label }}</b>
              <span style="font-family: var(--font-mono); color: var(--cyan); font-weight: 700">{{ d.sn }}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--txt-muted); margin-top: 2px">
              {{ d.model }} · {{ d.district }} · {{ d.network }}
            </div>
            <div style="font-size: 10.5px; margin-top: 2px" :style="{ color: presenceColor(d.sn) }">
              {{ presenceText(d.sn) }}
            </div>
          </div>
        </div>

        <!-- 示范片区分布清单 -->
        <div class="section-hint" style="margin-top: 10px; color: var(--cyan)">
          <span>📍 示范点位片区分布（已全部在地图落点呈现）:</span>
        </div>
        <div
          v-for="d in ANQIAO_DEVICES"
          :key="'loc-' + d.sn"
          class="nation-rank-row"
          style="cursor: pointer"
          @click="onSelectCity(d.city)"
        >
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; justify-content: space-between; align-items: baseline">
              <span style="font-family: var(--font-mono); color: var(--cyan); font-weight: 700; font-size: 12px">{{ d.sn }}</span>
              <span style="font-size: 10.5px" :style="{ color: presenceColor(d.sn) }">{{ presenceText(d.sn) }}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--txt-muted); margin-top: 2px">
              {{ d.city }} · {{ d.district }} · {{ d.address }}
            </div>
          </div>
        </div>

        <!-- 显式合规与隐私锁定提示框 -->
        <div class="nation-lock-prompt">
          <div class="prompt-header">
            <span class="prompt-icon">🔒</span>
            <b>点位隐私保护说明</b>
          </div>
          <div class="prompt-body">
            大屏端根据居住隐私安全规范，<b>宏观态势锁定至区县级</b>；设备数据经物联网专网加密传输，严格保护部署点位隐私。<br />
            3 台在册感知设备入网管理，地图展示点位与在线状态。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-hint {
  font-size: 11.5px;
  color: #38bdf8;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nation-rank-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.12);
  transition: all 0.2s;
}
.nation-rank-row:hover { background: rgba(0, 240, 255, 0.14); border-color: var(--cyan); }

.rank-num {
  font-family: var(--font-digit);
  font-weight: 700;
  font-size: 14px;
  color: var(--txt-muted);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}
.rank-num.top1 { color: #00ff88; text-shadow: 0 0 6px rgba(0, 255, 136, 0.6); }

.nation-lock-prompt {
  margin-top: 14px;
  background: rgba(6, 20, 36, 0.7);
  border: 1px dashed rgba(0, 255, 136, 0.35);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 11px;
}
.prompt-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #00ff88;
  font-size: 12px;
  margin-bottom: 6px;
}
.prompt-body {
  color: #94a3b8;
  line-height: 1.6;
}
.prompt-body b {
  color: #e2e8f0;
}
</style>
