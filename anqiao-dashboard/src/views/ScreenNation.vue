<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TechChinaMap from '../components/TechChinaMap.vue'
import { getGeoCities, getGeoDevices, getOverview } from '../api/client'
import { ORG_PROFILES } from '../projects'
import { ANQIAO_DEVICES } from '../projects'
import { isOnline, liveDeviceCount } from '../api/deviceTelemetry'
import type { CityStat, DevicePoint, Overview } from '../api/types'
import type { DistrictDetail } from '../projects'

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

const overview = ref<Overview | null>(null)
const cities = ref<CityStat[]>([])
const allDevices = ref<DevicePoint[]>([])
const devices = ref<DevicePoint[]>([])
const selectedCity = ref<string | null>(null)
const selectedDistrict = ref<DistrictDetail | null>(null)

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)
const isNational = computed(() => currentOrg.value.type === 'national_iot')

const rtLiveCount = computed(() => liveDeviceCount())
const nationalDeviceTotal = computed(() => isNational.value ? ANQIAO_DEVICES.length : currentOrg.value.deviceTotal)
const nationalOnlineRate = computed(() => isNational.value ? (ANQIAO_DEVICES.length > 0 ? ((rtLiveCount.value / ANQIAO_DEVICES.length) * 100).toFixed(1) : '0.0') : currentOrg.value.deviceOnlineRate)

onMounted(async () => {
  const [ov, cs, devs] = await Promise.all([
    getOverview(),
    getGeoCities(),
    getGeoDevices(),
  ])
  overview.value = ov
  cities.value = cs
  allDevices.value = devs.list
  devices.value = devs.list
})

watch(selectedCity, () => {
  devices.value = allDevices.value
})

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
  <!-- 顶部态势 KPI 条（随机构类型智能切换） -->
  <div class="cockpit-kpi-row" style="grid-template-columns: repeat(5, 1fr)">
    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">{{ isNational ? '感知设备总数' : '物联网在网终端总数' }}</div>
        <div class="val">
          {{ nationalDeviceTotal.toLocaleString() }}
          <span class="unit"> 台</span>
        </div>
        <div class="sub">
          <template v-if="isNational">实时在线 {{ rtLiveCount }} 台 · 在册归档 {{ ANQIAO_DEVICES.length - rtLiveCount }} 台</template>
          <template v-else-if="currentOrg.deviceBreakdown">
            守护仪 {{ currentOrg.deviceBreakdown.guardians.total }}台 · 报警器 {{ currentOrg.deviceBreakdown.fallRadars.total }}台 (在护 {{ currentOrg.elderlyTotal }}位)
          </template>
          <template v-else>{{ currentOrg.name }}</template>
        </div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">设备在线率</div>
        <div class="val">{{ nationalOnlineRate }}<span class="unit"> %</span></div>
        <div class="sub">全天候体征在线监测</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">{{ isNational ? '云端接入架构' : '连锁照护院区' }}</div>
        <div class="val">
          {{ isNational ? '直连' : currentOrg.campuses?.length || 1 }}
          <span class="unit"> {{ isNational ? '' : '处' }}</span>
        </div>
        <div class="sub">{{ isNational ? '全链路加密传输' : '标准化专护管理' }}</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">{{ isNational ? '全网在册设备数' : '业务覆盖区域' }}</div>
        <div class="val">{{ isNational ? ANQIAO_DEVICES.length : '城域' }}<span class="unit"> {{ isNational ? '台' : '网格' }}</span></div>
        <div class="sub">{{ isNational ? '多品类设备协同接入' : currentOrg.coords.split('·')[1]?.trim() || '高密度覆盖' }}</div>
      </div>
    </div>

    <div class="hud-card cockpit-kpi-card">
      <div>
        <div class="lbl">今日处置告警闭环</div>
        <div class="val" :style="isNational ? '' : 'color: #00ff88'">
          {{ isNational ? '未获取' : '100' }}<span class="unit" v-if="!isNational"> %</span>
        </div>
        <div class="sub">{{ isNational ? '告警处置闭环数据待接入 · 接入后实算' : '突发跌倒/心率异常零漏报' }}</div>
      </div>
    </div>
  </div>

  <!-- 主区：100寸真实比例高科技中国地图 + 资产/合作伙伴侧栏 -->
  <div style="flex: 1; display: grid; grid-template-columns: 1fr 360px; gap: 14px; min-height: 0">
    <!-- 左侧主地图：充满宽屏画幅，彻底摆脱地球仪黑太空与狭窄视野 -->
    <div class="hud-card" style="overflow: hidden; display: flex; flex-direction: column">
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ isNational ? '全国物联设备资产分布态势' : `${currentOrg.name} · 业务分布态势` }}
          <span class="code">TECH CYBER MAP</span>
        </div>
        <div class="hud-badge">
          {{ selectedCity ? `${selectedCity} · 深度聚焦` : isNational ? '标准地理信息底图' : '城域专属态势' }}
        </div>
      </div>

      <div class="hud-body" style="padding: 0; flex: 1; overflow: hidden">
        <TechChinaMap
          :active="props.active"
          :org-id="orgId"
          :cities="cities"
          :selected-city="selectedCity"
          @select-city="onSelectCity"
          @select-district="onSelectDistrict"
        />
      </div>
    </div>

    <!-- 右侧看板：随机构类型智能切换 -->
    <div class="hud-card" style="display: flex; flex-direction: column; overflow: hidden">
      <div class="hud-head">
        <div class="hud-title">
          <span class="marker"></span>
          {{ isNational ? '设备资产清单' : '院区资产清单' }}
          <span class="code">ASSET DIRECTORY</span>
        </div>
      </div>

      <div class="hud-body" style="gap: 8px; overflow-y: auto; padding: 12px">
        <!-- 1. 中科安樵在册终端列表（全量真实感知设备：点位 + SN + 型号 + 在线状态） -->
        <template v-if="isNational">
          <div class="section-hint">
            <span>📡 在网设备明细 (在线 {{ rtLiveCount }} / 在册 {{ ANQIAO_DEVICES.length }}):</span>
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
                {{ d.model }} · {{ d.district === '待确认' ? '地址待确认' : d.district }} · {{ d.network }}
              </div>
              <div style="font-size: 10.5px; margin-top: 2px" :style="{ color: isOnline(d.sn) ? '#00ff88' : 'var(--txt-muted)' }">
                {{ isOnline(d.sn) ? '● 实时在线' : '○ 离线归档' }}
              </div>
            </div>
          </div>
        </template>

        <!-- 2. 机构院区列表（凯健国际护理院） -->
        <template v-else-if="currentOrg.campuses">
          <div class="section-hint">
            <span>🏥 机构下属各院区监护态势:</span>
          </div>
          <div
            v-for="cp in currentOrg.campuses"
            :key="cp.id"
            class="campus-info-card"
          >
            <div class="c-top">
              <b>{{ cp.name }}</b>
              <span class="c-nurse">{{ cp.nurseHead }}</span>
            </div>
            <div class="c-stats">
              <div>在床长者: <b style="color: #00ff88">{{ cp.bedsOccupied }}</b> / {{ cp.bedsTotal }} 张</div>
              <div>今日告警: <b style="color: #ffb703">{{ cp.alertsToday }}</b> 次 (已闭环)</div>
            </div>
          </div>
        </template>

        <!-- 显式合规与隐私锁定提示框 -->
        <div class="nation-lock-prompt">
          <div class="prompt-header">
            <span class="prompt-icon">🔒</span>
            <b>点位隐私脱敏说明</b>
          </div>
          <div class="prompt-body">
            大屏端根据居住隐私安全规范，<b>宏观态势锁定至区县级</b>；设备数据经物联网专网加密传输，严格保护部署点位隐私。<br />
            如需查看社区细化点位与单台设备运维信息，请进入<b>管理后台</b>。
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

/* 院区卡片 */
.campus-info-card {
  background: rgba(0, 240, 255, 0.05);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: 6px;
  padding: 10px 12px;
}
.c-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  font-size: 13px;
  margin-bottom: 6px;
}
.c-nurse {
  font-size: 11px;
  color: #00ff88;
  background: rgba(0, 255, 136, 0.12);
  padding: 1px 6px;
  border-radius: 3px;
}
.c-stats {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: #cbd5e1;
}

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
