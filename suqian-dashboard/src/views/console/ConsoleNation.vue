<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getAlerts, getGeoCities, getGeoDevices, getOverview } from '../../api/client'
import { onRealtime } from '../../api/realtime'
import FlatChinaMap from '../../components/FlatChinaMap.vue'
import {
  GEO_HIERARCHY,
  getAllCommunities,
  getAllDistricts,
  getAllHierarchyDevices,
  type CommunityDetail,
  type DistrictDetail,
  type UnitDevice,
} from '../../assets/geoHierarchy'
import { fmtTime, STATUS_LABELS, TYPE_LABELS } from './labels'
import type { Alert, CityStat, DevicePoint, Overview } from '../../api/types'

const overview = ref<Overview | null>(null)
const cities = ref<CityStat[]>([])
const allDevices = ref<DevicePoint[]>([])
const devices = ref<DevicePoint[]>([])
const pendingAlerts = ref<Alert[]>([])
const loadError = ref('')

// 穿透式 4 级下钻状态
const selectedCity = ref<string | null>(null)
const selectedDistrict = ref<DistrictDetail | null>(null)
const selectedCommunity = ref<CommunityDetail | null>(null)
const selectedBuilding = ref<string>('全部')
const activeUnitDevice = ref<UnitDevice | null>(null)
const searchQuery = ref('')
const toastMessage = ref('')

let toastTimer = 0
function showToast(msg: string) {
  toastMessage.value = msg
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 3500)
}

async function loadAll() {
  loadError.value = ''
  try {
    const [ov, cs, devs, triggered, handling] = await Promise.all([
      getOverview(),
      getGeoCities(),
      getGeoDevices(),
      getAlerts({ status: 'triggered', page_size: 50 }),
      getAlerts({ status: 'handling', page_size: 50 }),
    ])
    overview.value = ov
    cities.value = cs
    allDevices.value = devs.list
    devices.value = devs.list
    pendingAlerts.value = [...triggered.list, ...handling.list].sort((a, b) =>
      a.occurred_at < b.occurred_at ? -1 : 1,
    )
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  }
}

// 级联下钻切换处理
function selectCity(city: string | null) {
  selectedCity.value = city
  selectedDistrict.value = null
  selectedCommunity.value = null
  activeUnitDevice.value = null
  selectedBuilding.value = '全部'
}

function selectDistrict(dist: DistrictDetail | null) {
  selectedDistrict.value = dist
  selectedCommunity.value = null
  activeUnitDevice.value = null
  selectedBuilding.value = '全部'
  if (dist && !selectedCity.value) {
    selectedCity.value = dist.city
  }
}

function selectCommunity(comm: CommunityDetail | null) {
  selectedCommunity.value = comm
  activeUnitDevice.value = null
  selectedBuilding.value = '全部'
}

// 当前城市区县列表
const currentCityDistricts = computed(() => {
  if (!selectedCity.value) return []
  const c = GEO_HIERARCHY.find((x) => x.city === selectedCity.value)
  return c ? c.districts : []
})

// 当前社区设备列表与楼栋过滤
const filteredCommunityDevices = computed(() => {
  if (!selectedCommunity.value) return []
  let list = selectedCommunity.value.devices
  if (selectedBuilding.value !== '全部') {
    list = list.filter((d) => d.building.startsWith(selectedBuilding.value))
  }
  return list
})

// 顶部 KPI 全部由实际数据计算：设备/在线取接口返回，城市/区县/社区按 GEO_HIERARCHY 实际统计
const onlineDeviceCount = computed(() => allDevices.value.filter((d) => d.online).length)
const onlineRateText = computed(() =>
  allDevices.value.length > 0 ? ((onlineDeviceCount.value / allDevices.value.length) * 100).toFixed(1) : '0.0',
)
const cityCount = computed(() => (cities.value.length > 0 ? cities.value.length : GEO_HIERARCHY.length))
const districtCount = computed(() => getAllDistricts().length)
const communityCount = computed(() => getAllCommunities().length)

// 全局搜索匹配结果（支持搜点位短名、设备SN、楼栋房号）
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  const allDevs = getAllHierarchyDevices()
  return allDevs.filter(
    (d) =>
      d.label.toLowerCase().includes(q) ||
      d.sn.toLowerCase().includes(q) ||
      d.device_id.toLowerCase().includes(q) ||
      d.building.toLowerCase().includes(q) ||
      d.room.toLowerCase().includes(q)
  ).slice(0, 20)
})

function selectSearchResult(item: UnitDevice) {
  // 找到对应的城市、区县与小区
  for (const c of GEO_HIERARCHY) {
    for (const d of c.districts) {
      for (const m of d.communities) {
        if (m.devices.some((x) => x.device_id === item.device_id)) {
          selectedCity.value = c.city
          selectedDistrict.value = d
          selectedCommunity.value = m
          activeUnitDevice.value = item
          searchQuery.value = ''
          return
        }
      }
    }
  }
}

// 运维动作派单模拟
function dispatchOpsOrder(dev: UnitDevice) {
  showToast(`已向运营中心派发巡检工单：${dev.label}`)
}

function tuneRadarSensitivity(dev: UnitDevice) {
  showToast(`雷达灵敏度调校成功！设备 ${dev.sn} 姿态感知阈值已设定为：特级防摔高敏模式`)
}

function restartDevice(dev: UnitDevice) {
  showToast(`远程自检与 OTA 复位指令已送达终端：${dev.sn}，当前在网状态正常`)
}

const offFns: Array<() => void> = []

onMounted(() => {
  void loadAll()
  offFns.push(
    onRealtime('alert', (a: Alert) => {
      pendingAlerts.value = [a, ...pendingAlerts.value]
      void getOverview().then((ov) => (overview.value = ov))
    }),
  )
  offFns.push(onRealtime('overview', (ov) => (overview.value = ov)))
  offFns.push(onRealtime('reconnected', () => void loadAll()))
})

onUnmounted(() => {
  offFns.forEach((f) => f())
  clearTimeout(toastTimer)
})

function goAlerts() {
  location.hash = '#/console/alerts'
}
</script>

<template>
  <div class="console-page-head page-head-with-search">
    <div>
      <h2>全国地图与微观设备运维中心</h2>
      <p>国家测绘标准平面中国地图（右下侧标准南海诸岛附图），支持鼠标滚轮连续无级缩放与拖拽，穿透至具体小区楼栋与单台终端设备。</p>
    </div>
    <!-- 快速搜索栏 -->
    <div class="drilldown-search-box">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索点位 / 设备SN"
        class="console-input"
      />
      <!-- 搜索浮层结果 -->
      <div v-if="searchQuery.trim() && searchResults.length > 0" class="search-drop-menu">
        <div
          v-for="r in searchResults"
          :key="r.device_id"
          class="search-result-item"
          @click="selectSearchResult(r)"
        >
          <div class="s-top">
            <b>{{ r.label }}</b>
            <span class="s-sn">{{ r.sn }}</span>
          </div>
          <div class="s-sub">
            {{ r.building }} {{ r.room }} · {{ r.type }} · {{ r.online ? '● 在线' : '○ 离线' }}
          </div>
        </div>
      </div>
      <div v-else-if="searchQuery.trim() && searchResults.length === 0" class="search-drop-menu empty">
        未检索到匹配的点位或设备
      </div>
    </div>
  </div>

  <!-- 操作反馈 Toast -->
  <div v-if="toastMessage" class="console-toast-bar">
    <span class="toast-icon">✓</span>
    <span>{{ toastMessage }}</span>
  </div>

  <div v-if="loadError" class="console-errorbar">
    {{ loadError }}
    <span class="spacer"></span>
    <button class="console-btn console-btn-ghost console-btn-sm" @click="loadAll">重试</button>
  </div>

  <!-- 全国 KPI（全部由实际数据计算） -->
  <section class="console-kpis" style="grid-template-columns: repeat(5, 1fr)">
    <div class="console-kpi">
      <div class="kpi-label">官方在册守护仪</div>
      <div class="kpi-value">{{ allDevices.length }}<small>台</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">设备在线率</div>
      <div class="kpi-value">{{ onlineRateText }}<small>%</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">纳管城市</div>
      <div class="kpi-value">{{ cityCount }}<small>城</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">覆盖区县与示范点</div>
      <div class="kpi-value">{{ districtCount }}<small>区 / </small>{{ communityCount }}<small>示范点</small></div>
    </div>
    <div class="console-kpi">
      <div class="kpi-label">今日待响应 / 处理中</div>
      <div class="kpi-value" :class="{ warn: pendingAlerts.length > 0 }">{{ pendingAlerts.length }}<small>条</small></div>
    </div>
  </section>

  <!-- 4 级穿透面包屑导航栏 (Breadcrumbs) -->
  <nav class="drilldown-nav-bar">
    <div class="nav-crumbs">
      <span class="crumb-btn" :class="{ active: !selectedCity }" @click="selectCity(null)">
        官方在册视图 ({{ allDevices.length }}台)
      </span>
      <template v-if="selectedCity">
        <span class="crumb-sep">›</span>
        <span class="crumb-btn" :class="{ active: selectedCity && !selectedDistrict }" @click="selectDistrict(null)">
          {{ selectedCity }}市 ({{ cities.find((c) => c.city === selectedCity)?.device_total ?? '—' }}台)
        </span>
      </template>
      <template v-if="selectedDistrict">
        <span class="crumb-sep">›</span>
        <span class="crumb-btn" :class="{ active: selectedDistrict && !selectedCommunity }" @click="selectCommunity(null)">
          {{ selectedDistrict.name }} ({{ selectedDistrict.device_total }}台)
        </span>
      </template>
      <template v-if="selectedCommunity">
        <span class="crumb-sep">›</span>
        <span class="crumb-btn active">
          {{ selectedCommunity.name }} ({{ selectedCommunity.device_total }}户)
        </span>
      </template>
      <template v-if="activeUnitDevice">
        <span class="crumb-sep">›</span>
        <span class="crumb-btn active highlight">
          {{ activeUnitDevice.label }} ({{ activeUnitDevice.sn }})
        </span>
      </template>
    </div>
    <div class="nav-right">
      <span v-if="selectedCommunity" class="tag-level">微观楼栋单元级</span>
      <span v-else-if="selectedDistrict" class="tag-level">社区小区级</span>
      <span v-else-if="selectedCity" class="tag-level">区县级</span>
      <span v-else class="tag-level">全国宏观级</span>
    </div>
  </nav>

  <!-- 主布局：根据下钻层级自适应呈现 -->
  <!-- Level 1: 全国平面地图 (含右下侧南海诸岛独立附图) -->
  <div v-if="!selectedCity" class="console-dash-grid">
    <section class="console-card" style="padding: 0; overflow: hidden">
      <div class="card-inner-map" style="height: 580px">
        <FlatChinaMap
          :cities="cities"
          :selected-city="selectedCity"
          @select-city="selectCity"
          @select-district="selectDistrict"
        />
      </div>
    </section>

    <!-- 右侧：重点城市列表与告警待办 -->
    <section class="console-card">
      <div class="console-card-head">
        <div class="console-card-title">重点城市设备资产</div>
        <span class="console-cell-sub">点击城市下钻区县</span>
      </div>
      <div class="city-drill-list">
        <div
          v-for="c in cities"
          :key="c.city"
          class="city-drill-item"
          @click="selectCity(c.city)"
        >
          <div class="c-info">
            <b class="c-name">{{ c.city }}市</b>
            <span class="c-desc">{{ c.customers.join(' / ') }}</span>
          </div>
          <div class="c-metrics">
            <span class="c-count">{{ c.device_total }} 台</span>
            <span class="c-arrow">下钻区县 ›</span>
          </div>
        </div>
      </div>

      <!-- 今日待处理告警简报 -->
      <div class="console-card-head" style="margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 14px">
        <div class="console-card-title">今日待处理告警</div>
        <span class="console-cell-sub" style="cursor: pointer; color: #0B7A75" @click="goAlerts">{{ pendingAlerts.length }} 条 ↗</span>
      </div>
      <div v-if="pendingAlerts.length === 0" class="console-empty" style="padding: 16px">当前无未办告警</div>
      <div v-else class="console-focus-list" style="max-height: 220px; overflow-y: auto">
        <div v-for="a in pendingAlerts.slice(0, 5)" :key="a.alert_id" class="console-focus-item" @click="goAlerts">
          <span class="console-dot-badge" :class="`d-${a.status}`"><span class="dot"></span></span>
          <div class="f-main">
            <div class="f-name">{{ a.title }} <span class="console-badge" :class="`console-badge-level-${a.level}`">{{ a.level }}级</span></div>
            <div class="f-sub">{{ a.city }} · {{ a.customer }} · {{ fmtTime(a.occurred_at) }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- Level 2: 城市区县级 (District Level) -->
  <div v-else-if="selectedCity && !selectedDistrict" class="district-drill-view">
    <div class="drill-header-row">
      <div class="h-tit">
        <h3>{{ selectedCity }}市 · 下属行政区县设备分布</h3>
        <p>选择区县进一步穿透至社区及具体养老居住小区。</p>
      </div>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="selectCity(null)">
        ⟲ 返回全国地图
      </button>
    </div>

    <div class="district-cards-grid">
      <div
        v-for="d in currentCityDistricts"
        :key="d.id"
        class="district-drill-card"
        @click="selectDistrict(d)"
      >
        <div class="d-head">
          <h4>{{ d.name }}</h4>
          <span class="d-arrow">查看小区 ›</span>
        </div>
        <div class="d-stat-row">
          <div class="d-kpi">
            <div class="kpi-num">{{ d.device_total }}<small>台</small></div>
            <div class="kpi-lbl">在网设备</div>
          </div>
          <div class="d-kpi">
            <div class="kpi-num">{{ ((d.device_online / d.device_total) * 100).toFixed(1) }}<small>%</small></div>
            <div class="kpi-lbl">在线率</div>
          </div>
          <div class="d-kpi">
            <div class="kpi-num" :class="{ warn: d.alerts_today > 0 }">{{ d.alerts_today }}<small>条</small></div>
            <div class="kpi-lbl">今日告警</div>
          </div>
        </div>
        <div class="d-communities-preview">
          <span class="prev-tit">试点社区 ({{ d.communities.length }} 处):</span>
          <div class="prev-tags">
            <span v-for="m in d.communities" :key="m.name" class="prev-tag">
              {{ m.name }} ({{ m.device_total }}户)
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Level 3: 社区 / 小区级 (Community / Compound Level) -->
  <div v-else-if="selectedDistrict && !selectedCommunity" class="community-drill-view">
    <div class="drill-header-row">
      <div class="h-tit">
        <h3>{{ selectedCity }}市 · {{ selectedDistrict.name }} · 养老社区与小区台账</h3>
        <p>点击具体小区，即可穿透至该小区各栋楼、单元房间及单个终端设备运维卡片。</p>
      </div>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="selectDistrict(null)">
        ⟲ 返回区县列表
      </button>
    </div>

    <div class="community-cards-grid">
      <div
        v-for="m in selectedDistrict.communities"
        :key="m.id"
        class="community-card"
        @click="selectCommunity(m)"
      >
        <div class="comm-card-head">
          <div>
            <h4>{{ m.name }}</h4>
            <div class="comm-addr">📍 {{ m.address }}</div>
          </div>
          <span class="console-badge console-badge-level-1">{{ m.device_total }} 户在网</span>
        </div>

        <div class="comm-buildings-dock">
          <span class="b-lbl">覆盖楼栋:</span>
          <div class="b-pills">
            <span v-for="b in m.buildings" :key="b" class="b-pill">{{ b }}</span>
          </div>
        </div>

        <div class="comm-card-footer">
          <span class="f-online">在线率 {{ ((m.device_online / m.device_total) * 100).toFixed(1) }}%</span>
          <button class="console-btn console-btn-primary console-btn-sm">
            进入小区单设备运维 ›
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Level 4: 楼栋单元与单设备微观运维管理 (Building / Device Level) -->
  <div v-else-if="selectedCommunity" class="micro-device-view">
    <div class="drill-header-row">
      <div class="h-tit">
        <h3>{{ selectedCommunity.name }} · 楼栋单元终端运维与服务派单</h3>
        <p>小区地址: {{ selectedCommunity.address }}</p>
      </div>
      <button class="console-btn console-btn-ghost console-btn-sm" @click="selectCommunity(null)">
        ⟲ 返回小区列表
      </button>
    </div>

    <!-- 楼栋过滤标签栏 -->
    <div class="building-filter-bar">
      <span class="b-filter-label">选择楼栋筛选:</span>
      <button
        class="b-filter-btn"
        :class="{ active: selectedBuilding === '全部' }"
        @click="selectedBuilding = '全部'"
      >
        全部楼栋 ({{ selectedCommunity.devices.length }})
      </button>
      <button
        v-for="b in selectedCommunity.buildings"
        :key="b"
        class="b-filter-btn"
        :class="{ active: selectedBuilding === b }"
        @click="selectedBuilding = b"
      >
        {{ b }} ({{ selectedCommunity.devices.filter((x) => x.building.startsWith(b)).length }})
      </button>
    </div>

    <!-- 单台设备点位卡片网格 -->
    <div class="unit-devices-grid">
      <div
        v-for="dev in filteredCommunityDevices"
        :key="dev.device_id"
        class="unit-card"
        :class="{ alerting: dev.alerting, active: activeUnitDevice?.device_id === dev.device_id }"
        @click="activeUnitDevice = dev"
      >
        <div class="unit-head">
          <div class="room-box">
            <b>{{ dev.building }} {{ dev.room }}</b>
            <span class="dev-id-tag">{{ dev.device_id }}</span>
          </div>
          <span
            class="status-pill"
            :class="{ alert: dev.alerting, online: dev.online && !dev.alerting, off: !dev.online }"
          >
            {{ dev.alerting ? '⚠ 告警中' : dev.online ? '● 在线' : '○ 离线' }}
          </span>
        </div>

        <div class="point-profile-strip">
          <div class="s-main">
            <span class="s-name">{{ dev.label }}</span>
          </div>
          <div class="p-addr">点位: {{ dev.building }} {{ dev.room }}</div>
        </div>

        <div class="vitals-live-dock">
          <div class="v-pill">
            <span class="v-tit">在床状态</span>
            <span class="v-val" :class="{ inbed: dev.vitals.in_bed }">{{ dev.vitals.in_bed ? '在床' : '离床' }}</span>
          </div>
          <div class="v-pill">
            <span class="v-tit">实时心率</span>
            <span class="v-val">{{ dev.vitals.hr }} <small>bpm</small></span>
          </div>
          <div class="v-pill">
            <span class="v-tit">呼吸频率</span>
            <span class="v-val">{{ dev.vitals.br }} <small>次/分</small></span>
          </div>
          <div class="v-pill">
            <span class="v-tit">体温</span>
            <span class="v-val">{{ dev.vitals.tp }} <small>℃</small></span>
          </div>
        </div>

        <div class="radar-model-info">
          <span class="m-tit">设备终端:</span>
          <span class="m-val">{{ dev.type }} · SN: {{ dev.sn }}</span>
        </div>

        <div class="device-actions-row">
          <button class="console-btn console-btn-primary console-btn-sm" @click.stop="dispatchOpsOrder(dev)">
            🚨 一键上门派单
          </button>
          <button class="console-btn console-btn-ghost console-btn-sm" @click.stop="tuneRadarSensitivity(dev)">
            ⚙ 调校灵敏度
          </button>
          <button class="console-btn console-btn-ghost console-btn-sm" @click.stop="restartDevice(dev)">
            🔄 设备自检
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head-with-search {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.drilldown-search-box {
  position: relative;
  width: 380px;
}
.search-drop-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  max-height: 280px;
  overflow-y: auto;
  z-index: 50;
}
.search-drop-menu.empty {
  padding: 12px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}
.search-result-item {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s;
}
.search-result-item:hover {
  background: #f0fdf4;
}
.s-top {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.s-level {
  font-size: 10px;
  background: #e2e8f0;
  padding: 1px 5px;
  border-radius: 3px;
  color: #475569;
}
.s-sn {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: #0B7A75;
}
.s-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

/* 面包屑导航 */
.drilldown-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 16px;
  margin-bottom: 16px;
}
.nav-crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.crumb-btn {
  color: #64748b;
  cursor: pointer;
  transition: color 0.15s;
}
.crumb-btn:hover, .crumb-btn.active {
  color: #0B7A75;
  font-weight: 600;
}
.crumb-btn.highlight {
  color: #059669;
  background: #ecfdf5;
  padding: 2px 8px;
  border-radius: 4px;
}
.crumb-sep {
  color: #cbd5e1;
}
.tag-level {
  font-size: 11px;
  background: #f1f5f9;
  color: #475569;
  padding: 3px 8px;
  border-radius: 4px;
}

/* Toast */
.console-toast-bar {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 8px 14px;
  border-radius: 6px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.1);
}
.toast-icon {
  background: #10b981;
  color: #fff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
}

/* 城市穿透卡片列表 */
.city-drill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.city-drill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
}
.city-drill-item:hover {
  border-color: #0B7A75;
  background: #f0fdfa;
  transform: translateX(3px);
}
.c-name {
  font-size: 14px;
  color: #0f172a;
}
.c-desc {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.c-metrics {
  text-align: right;
}
.c-count {
  display: block;
  font-size: 15px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  color: #0B7A75;
}
.c-arrow {
  font-size: 11px;
  color: #94a3b8;
}

/* 区县层级视图 */
.district-drill-view, .community-drill-view, .micro-device-view {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 18px;
}
.drill-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}
.h-tit h3 {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.h-tit p {
  font-size: 12px;
  color: #64748b;
  margin: 4px 0 0 0;
}

/* 区县卡片网格 */
.district-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}
.district-drill-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.district-drill-card:hover {
  border-color: #0B7A75;
  box-shadow: 0 4px 16px rgba(11, 122, 117, 0.12);
  transform: translateY(-2px);
}
.d-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.d-head h4 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}
.d-arrow {
  font-size: 12px;
  color: #0B7A75;
  font-weight: 600;
}
.d-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 12px;
}
.d-kpi {
  text-align: center;
}
.d-kpi .kpi-num {
  font-family: ui-monospace, monospace;
  font-size: 16px;
  font-weight: 700;
  color: #0B7A75;
}
.d-kpi .kpi-num.warn { color: #e11d48; }
.d-kpi .kpi-num small { font-size: 11px; font-weight: normal; }
.d-kpi .kpi-lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
.d-communities-preview .prev-tit {
  font-size: 11px;
  color: #64748b;
  display: block;
  margin-bottom: 4px;
}
.prev-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.prev-tag {
  font-size: 11px;
  background: #f1f5f9;
  color: #334155;
  padding: 2px 6px;
  border-radius: 3px;
}

/* 社区卡片网格 */
.community-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}
.community-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s;
}
.community-card:hover {
  border-color: #0B7A75;
  box-shadow: 0 6px 20px rgba(11, 122, 117, 0.12);
}
.comm-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.comm-card-head h4 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}
.comm-addr {
  font-size: 12px;
  color: #64748b;
  margin-top: 3px;
}
.comm-duty-row {
  background: #f8fafc;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 12px;
}
.duty-item {
  display: flex;
  justify-content: space-between;
}
.duty-item .d-lbl { color: #64748b; }
.duty-item .d-phone { color: #0B7A75; font-family: ui-monospace, monospace; }
.comm-buildings-dock {
  margin-bottom: 14px;
}
.comm-buildings-dock .b-lbl {
  font-size: 11px;
  color: #64748b;
  display: block;
  margin-bottom: 4px;
}
.b-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.b-pill {
  font-size: 11px;
  background: #e0f2fe;
  color: #0369a1;
  padding: 2px 7px;
  border-radius: 4px;
}
.comm-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}
.f-online {
  font-size: 12px;
  color: #059669;
  font-weight: 600;
}

/* 微观楼栋与单设备卡片网格 */
.building-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  background: #f8fafc;
  padding: 10px 14px;
  border-radius: 6px;
}
.b-filter-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}
.b-filter-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}
.b-filter-btn:hover, .b-filter-btn.active {
  background: #0B7A75;
  border-color: #0B7A75;
  color: #ffffff;
}

.unit-devices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}
.unit-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}
.unit-card:hover, .unit-card.active {
  border-color: #0B7A75;
  box-shadow: 0 4px 16px rgba(11, 122, 117, 0.15);
}
.unit-card.alerting {
  border-color: #e11d48;
  background: #fff1f2;
}
.unit-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.room-box b {
  font-size: 15px;
  color: #0f172a;
}
.dev-id-tag {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 6px;
}
.status-pill {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 12px;
  font-weight: 600;
}
.status-pill.online { background: #dcfce7; color: #15803d; }
.status-pill.alert { background: #ffe4e6; color: #be123c; animation: pulse 1.5s infinite; }
.status-pill.off { background: #f1f5f9; color: #64748b; }

.point-profile-strip {
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.s-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.s-name {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.s-meta {
  font-size: 12px;
  color: #64748b;
}
.p-addr {
  font-size: 11px;
  color: #64748b;
  margin-top: 3px;
}

.vitals-live-dock {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.v-pill {
  background: #f1f5f9;
  border-radius: 4px;
  padding: 6px 4px;
  text-align: center;
}
.v-tit {
  display: block;
  font-size: 10px;
  color: #64748b;
}
.v-val {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 2px;
}
.v-val.inbed {
  color: #059669;
}

.radar-model-info {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 12px;
  line-height: 1.4;
}
.radar-model-info .m-tit { font-weight: 600; margin-right: 4px; }

.device-actions-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}
</style>
