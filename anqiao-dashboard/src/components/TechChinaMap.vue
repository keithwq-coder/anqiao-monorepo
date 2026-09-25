<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import chinaGeo from '../assets/china.json'
import { GEO_HIERARCHY, type DistrictDetail } from '../projects'
import { ORG_PROFILES } from '../projects'
import { ANQIAO_DEVICES } from '../projects'
import { deviceTelemetry, isOnline, lastSampleTime, presenceOf } from '../api/deviceTelemetry'
import { deviceIpGeo, ipGeoDisplay, resolveDeviceIpGeo, type IpGeo } from '../api/ipGeo'
import type { CityStat } from '../api/types'

const props = withDefaults(
  defineProps<{
    orgId?: string
    cities?: CityStat[]
    selectedCity?: string | null
    active?: boolean
  }>(),
  {
    orgId: 'anqiao',
    cities: () => [],
    selectedCity: null,
    active: true,
  }
)

const emit = defineEmits<{
  (e: 'select-city', city: string | null): void
  (e: 'select-district', district: DistrictDetail | null): void
}>()

const chartContainer = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
const currentZoom = ref(1.15)
const isFullscreen = ref(false)

// 注册国家标准行政比例中国地图
echarts.registerMap('china', chinaGeo as any)

const currentOrg = computed(() => ORG_PROFILES[props.orgId] || ORG_PROFILES.anqiao)
const isNationalOrg = computed(() => currentOrg.value.type === 'national_iot')

// 自营城市经纬度对照
const CITY_COORDS: Record<string, [number, number]> = {
  '上海市': [121.4737, 31.2304],
  '上海': [121.4737, 31.2304],
  '北京市': [116.4074, 39.9042],
  '北京': [116.4074, 39.9042],
  '苏州市': [120.5853, 31.2990],
  '苏州': [120.5853, 31.2990],
  '杭州市': [120.1551, 30.2741],
  '杭州': [120.1551, 30.2741],
  '西安市': [108.9398, 34.3416],
  '西安': [108.9398, 34.3416],
  '宿迁市': [118.2752, 33.9630],
  '宿迁': [118.2752, 33.9630],
  '广州市': [113.2644, 23.1291],
  '广州': [113.2644, 23.1291],
  '武汉市': [114.3055, 30.5928],
  '武汉': [114.3055, 30.5928],
}

// 1. 机构类（凯健）院区散点：只显示其院区
const directCityData = computed(() => {
  if (currentOrg.value.campuses) {
    const campusPositions: Record<string, { pos: 'top' | 'right' | 'bottom' | 'left'; offset: [number, number] }> = {
      'kj-ht': { pos: 'top', offset: [0, -14] },
      'kj-hp': { pos: 'right', offset: [14, 0] },
      'kj-hz': { pos: 'bottom', offset: [0, 14] },
    }

    return currentOrg.value.campuses.map((cp) => {
      const posCfg = campusPositions[cp.id] || { pos: 'right', offset: [8, 0] }
      return {
        name: cp.name,
        value: [cp.lon, cp.lat, cp.bedsTotal],
        device_total: cp.bedsTotal,
        alerts_today: cp.alertsToday,
        districts_count: 1,
        campus: cp,
        isDirect: true,
        label: {
          position: posCfg.pos,
          offset: posCfg.offset,
        },
        itemStyle: { color: '#00ff88' },
      }
    })
  }

  return []
})

// 2. 中科安樵（居家类）苏州全量真实设备点位：唯一权威数据源 anqiaoDevices.ts
//    在线分层由共享遥测 store 用户口径驱动：isOnline（有 ≤90s 新鲜样本，在床/离床均在线）入在线层；无新鲜样本入离线层
const anqiaoDeviceData = computed(() => {
  if (!isNationalOrg.value) return { online: [] as any[], offline: [] as any[] }
  const online: any[] = []
  const offline: any[] = []
  for (const d of ANQIAO_DEVICES) {
    if (d.lon == null || d.lat == null) continue // 没有坐标的设备不渲染地图精确点位
    const onlineNow = isOnline(d.sn) // 依赖响应式 deviceTelemetry，5s 轮询后自动重算
    const point = {
      name: d.label,
      value: [d.lon, d.lat, 1],
      isDevice: true,
      sn: d.sn,
      scene: d.scene,
      model: d.model,
      category: d.category,
      network: d.network,
      online: onlineNow, // 在线（在床/离床）均归入在线层
      presence: presenceOf(d.sn), // 'person'（在床）| 'empty'（离床）| null（离线）
      sampleTime: lastSampleTime(d.sn),
      geo: deviceIpGeo[d.sn]?.geo ?? null, // IP 归属地估算（仅展示，非定位）
    }
    ;(point.online ? online : offline).push(point)
  }
  return { online, offline }
})

// 3. 当前选中城市的区县散点（仅在自营城市被聚焦或中高倍率下钻时激活）
const districtScatterData = computed(() => {
  if (!props.selectedCity) return []
  const cityObj = GEO_HIERARCHY.find((c) => c.city === props.selectedCity)
  if (!cityObj) return []
  return cityObj.districts.filter((d) => d.id !== 'sz_unconfirmed').map((d) => {
    return {
      name: d.name,
      value: [d.lon, d.lat, d.device_total],
      district: d,
      city: d.city,
      device_total: d.device_total,
      communities_count: d.communities.length,
      alerts_today: d.alerts_today,
    }
  })
})

function getInitialView(): { center: [number, number]; zoom: number } {
  if (props.orgId === 'kaijian') return { center: [121.46, 31.18], zoom: 7.2 }
  // 中科安樵：默认聚焦苏州城域，覆盖全量真实设备点位
  if (props.orgId === 'anqiao') return { center: [120.655, 31.242], zoom: 22 }
  return { center: [104.5, 36.5], zoom: 1.15 }
}

function getOption(center?: [number, number], zoom?: number): echarts.EChartsOption {
  const init = getInitialView()
  const c = center ?? init.center
  const z = zoom ?? init.zoom

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(5, 12, 24, 0.94)',
      borderColor: 'rgba(0, 240, 255, 0.45)',
      borderWidth: 1.2,
      padding: [12, 16],
      textStyle: { color: '#f8fafc', fontSize: 13 },
      formatter: (params: any) => {
        const d = params.data
        if (!d) return ''

        // A. 中科安樵真实设备点位卡片：仅展示设备维度信息（点位/SN/场景/遥测新鲜度），严禁人名
        if (d.isDevice) {
          const statusText = !d.online
            ? '○ 设备离线 · 无实时回传'
            : d.presence === 'empty'
            ? `● 设备在线 · 离床 · 采样 ${d.sampleTime || '--'}`
            : `● 设备在线 · 在床 · 采样 ${d.sampleTime || '--'}`
          const statusColor = d.online ? '#00ff88' : '#94a3b8'
          const badgeText = d.online ? '在线' : '离线'
          const geo: IpGeo | null = d.geo ?? null
          const geoText = ipGeoDisplay(geo)
          const geoCoord = geo && typeof geo.lon === 'number' && typeof geo.lat === 'number'
            ? ` · 估算坐标 ${geo.lon.toFixed(3)}, ${geo.lat.toFixed(3)}`
            : ''
          return `
            <div style="font-family: 'Rajdhani', 'Noto Sans SC', sans-serif; min-width: 240px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <b style="font-size: 15px; color: #00f0ff;">📡 ${d.name}</b>
                <span style="font-size: 11px; background: ${d.online ? 'rgba(0,255,136,0.15)' : 'rgba(100,116,139,0.2)'}; color: ${statusColor}; padding: 2px 7px; border-radius: 4px; border: 1px solid ${d.online ? 'rgba(0,255,136,0.4)' : 'rgba(100,116,139,0.45)'}">${badgeText}</span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; line-height: 1.7;">
                <div>设备 SN: <b style="color: #38bdf8; font-family: 'Orbitron', monospace;">${d.sn}</b></div>
                <div>部署场景: <b style="color: #f8fafc">${d.scene}</b></div>
                <div>设备型号: <span style="color: #94a3b8">${d.model}</span></div>
                <div>网络通道: <span style="color: #94a3b8">${d.network}</span></div>
                <div style="color: #ffb703;">IP归属地（估算）：${geoText}${geoCoord}</div>
              </div>
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 11px; color: ${statusColor};">
                ${statusText} · 专网连接正常
              </div>
              <div style="margin-top: 4px; font-size: 10.5px; color: #64748b;">
                注：IP 归属地按公网 IP 估算，非设备实际部署地址
              </div>
            </div>
          `
        }

        // B. 自营直连终端 / 机构院区节点
        if (d.isDirect) {
          return `
            <div style="font-family: 'Rajdhani', 'Noto Sans SC', sans-serif; min-width: 220px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <b style="font-size: 15px; color: #00f0ff;">📡 ${d.name}</b>
                <span style="font-size: 11px; background: rgba(0,240,255,0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px;">在网运行</span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; line-height: 1.7;">
                <div>在网设备终端: <b style="color: #00ff88; font-size: 14px; font-family: 'Orbitron', monospace;">${d.device_total}</b> 台</div>
                <div>今日闭环告警: <b style="color: ${d.alerts_today > 0 ? '#ffb703' : '#00ff88'}">${d.alerts_today}</b> 次</div>
                ${d.districts_count > 1 ? `<div>覆盖区县: <b style="color: #f8fafc">${d.districts_count}</b> 个示范片区</div>` : ''}
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 11px; color: #00f0ff;">
                点击聚焦片区态势
              </div>
            </div>
          `
        }

        // C. 区县散点卡片
        if (d.district) {
          return `
            <div style="font-family: 'Rajdhani', 'Noto Sans SC', sans-serif;">
              <div style="font-size: 14px; font-weight: 700; color: #00ff88; margin-bottom: 4px;">
                📍 ${d.city} · ${d.name}
              </div>
              <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">
                <div>在网设备: <b style="color: #ffffff">${d.device_total}</b> 台</div>
                <div>示范社区: <b style="color: #ffffff">${d.communities_count}</b> 个</div>
              </div>
              <div style="margin-top: 5px; font-size: 11px; color: #00ff88;">
                🔒 大屏端锁定至区县级 · 细化楼栋房号请前往控制台
              </div>
            </div>
          `
        }

        return ''
      },
    },
    geo: {
      map: 'china',
      roam: true,
      center: c,
      zoom: z,
      scaleLimit: { min: 0.85, max: 32.0 },
      label: {
        show: true,
        color: 'rgba(148, 163, 184, 0.45)',
        fontSize: 10,
      },
      itemStyle: {
        areaColor: '#07152b',
        borderColor: 'rgba(0, 240, 255, 0.38)',
        borderWidth: 1.0,
        shadowColor: 'rgba(0, 0, 0, 0.7)',
        shadowBlur: 14,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#0e264d',
          borderColor: '#00f0ff',
          borderWidth: 1.4,
          shadowColor: 'rgba(0, 240, 255, 0.5)',
          shadowBlur: 10,
        },
        label: {
          color: '#38bdf8',
          fontWeight: 'bold',
        },
      },
    },
    series: [
      // 1. 自营在网终端：动态科技涟漪波纹
      {
        name: '在网监护终端',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: directCityData.value,
        symbolSize: (val: any) => {
          const count = val[2] || 80
          return Math.max(16, Math.min(30, Math.sqrt(count) * 1.4))
        },
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 3.8,
          period: 3.5,
        },
        label: {
          show: true,
          position: 'right',
          offset: [8, 0],
          formatter: (p: any) => `{name|${p.name}}\n{count|${p.data.device_total}台在网}`,
          rich: {
            name: {
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 700,
              textBorderColor: '#030814',
              textBorderWidth: 2.5,
            },
            count: {
              color: '#00f0ff',
              fontSize: 11,
              fontFamily: 'Orbitron, Share Tech Mono, monospace',
              fontWeight: 600,
              textBorderColor: '#030814',
              textBorderWidth: 2,
            },
          },
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY',
        },
        zlevel: 3,
      },

      // 2. 中科安樵在线设备：青绿涟漪散点（实时遥测）
      {
        id: 'anqiao-online',
        name: '在线设备遥测',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: anqiaoDeviceData.value.online,
        symbolSize: 16,
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 4.2,
          period: 3,
        },
        itemStyle: {
          color: '#00ff88',
          shadowColor: 'rgba(0, 255, 136, 0.8)',
          shadowBlur: 12,
        },
        label: {
          show: true,
          position: 'right',
          offset: [8, 0],
          formatter: (p: any) => `{name|${p.name}}\n{meta|${p.data.sn} · ● 实时遥测}`,
          rich: {
            name: {
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 700,
              textBorderColor: '#030814',
              textBorderWidth: 2.5,
            },
            meta: {
              color: '#00ff88',
              fontSize: 10.5,
              fontFamily: 'Orbitron, Share Tech Mono, monospace',
              textBorderColor: '#030814',
              textBorderWidth: 2,
            },
          },
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY',
        },
        zlevel: 4,
      },

      // 3. 中科安樵离线设备：灰色静态散点（无 ≤90s 新鲜样本，无实时回传）
      {
        id: 'anqiao-offline',
        name: '在册归档设备',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: anqiaoDeviceData.value.offline,
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: {
          color: '#475569',
          borderColor: '#94a3b8',
          borderWidth: 1.2,
          shadowColor: 'rgba(100, 116, 139, 0.5)',
          shadowBlur: 6,
        },
        label: {
          show: true,
          position: 'right',
          offset: [8, 0],
          formatter: (p: any) => `{name|${p.name}}\n{meta|${p.data.sn} · ○ 设备离线}`,
          rich: {
            name: {
              color: '#cbd5e1',
              fontSize: 11,
              fontWeight: 600,
              textBorderColor: '#030814',
              textBorderWidth: 2.5,
            },
            meta: {
              color: '#64748b',
              fontSize: 10,
              fontFamily: 'Orbitron, Share Tech Mono, monospace',
              textBorderColor: '#030814',
              textBorderWidth: 2,
            },
          },
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY',
        },
        zlevel: 4,
      },

      // 4. 区县下钻散点层（当下钻到具体自营城市时激发）
      {
        name: '区县级聚合',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: districtScatterData.value,
        symbol: 'pin',
        symbolSize: 42,
        itemStyle: {
          color: '#00ff88',
          shadowColor: 'rgba(0, 255, 136, 0.7)',
          shadowBlur: 10,
        },
        label: {
          show: true,
          formatter: (p: any) => `${p.data.device_total}`,
          color: '#030814',
          fontWeight: 'bold',
          fontSize: 11,
          fontFamily: 'Orbitron, monospace',
        },
        zlevel: 5,
      },

      // 5. 区县名称文字标牌
      {
        name: '区县名称',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: districtScatterData.value,
        symbolSize: 1,
        itemStyle: { opacity: 0 },
        label: {
          show: true,
          position: 'bottom',
          offset: [0, 4],
          formatter: (p: any) => `{tag|${p.name}}`,
          rich: {
            tag: {
              color: '#00ff88',
              fontSize: 11,
              fontWeight: 'bold',
              backgroundColor: 'rgba(5, 12, 24, 0.88)',
              padding: [2, 6],
              borderRadius: 3,
              borderColor: 'rgba(0, 255, 136, 0.45)',
              borderWidth: 1,
            },
          },
        },
        zlevel: 6,
      },
    ],
  }
}

function initChart() {
  if (!chartContainer.value) return
  chartInstance = echarts.init(chartContainer.value, undefined, { renderer: 'canvas' })
  chartInstance.setOption(getOption())

  chartInstance.on('click', (params) => {
    const d = params.data as any
    // 中科安樵设备点位：点位选择由孪生页设备卡片承担，地图点击不下钻
    if (d?.isDevice) return
    if (params.seriesType === 'effectScatter') {
      // 点击了自营城市 / 机构院区
      const cityName = params.name
      emit('select-city', cityName)
    } else if (params.seriesType === 'scatter' && d) {
      if (d.district) {
        emit('select-district', d.district as DistrictDetail)
      }
    }
  })

  chartInstance.on('georoam', () => {
    if (!chartInstance) return
    const opt: any = chartInstance.getOption()
    if (opt.geo && opt.geo[0]) {
      currentZoom.value = Number(opt.geo[0].zoom?.toFixed(2) ?? 1.15)
    }
  })
}

// 观察城市聚焦与自适应飞入
watch(
  () => props.selectedCity,
  (newCity) => {
    if (!chartInstance) return
    if (newCity) {
      const coords = CITY_COORDS[newCity] || [104.5, 36.5]
      chartInstance.setOption(getOption(coords, 4.2))
      currentZoom.value = 4.2
    } else {
      const init = getInitialView()
      chartInstance.setOption(getOption(init.center, init.zoom))
      currentZoom.value = init.zoom
    }
  }
)

// 观察机构切换
watch(
  () => props.orgId,
  () => {
    emit('select-city', null)
    emit('select-district', null)
    if (!chartInstance) return
    const init = getInitialView()
    chartInstance.setOption(getOption(init.center, init.zoom), true)
    currentZoom.value = init.zoom
  }
)

// 共享遥测 store 每 5s 轮询刷新：仅按 id 局部更新设备点位两层散点数据，保持当前视野不重置
watch(
  deviceTelemetry,
  () => {
    if (!chartInstance || !isNationalOrg.value) return
    chartInstance.setOption({
      series: [
        { id: 'anqiao-online', data: anqiaoDeviceData.value.online },
        { id: 'anqiao-offline', data: anqiaoDeviceData.value.offline },
      ],
    })
  },
  { deep: true }
)

// 视口缩放控制
function zoomIn() {
  if (!chartInstance) return
  const opt: any = chartInstance.getOption()
  const curr = opt.geo?.[0]?.zoom ?? 1.15
  const next = Math.min(30.0, curr * 1.35)
  chartInstance.setOption({ geo: { zoom: next } })
  currentZoom.value = Number(next.toFixed(2))
}

function zoomOut() {
  if (!chartInstance) return
  const opt: any = chartInstance.getOption()
  const curr = opt.geo?.[0]?.zoom ?? 1.15
  const next = Math.max(0.85, curr * 0.74)
  chartInstance.setOption({ geo: { zoom: next } })
  currentZoom.value = Number(next.toFixed(2))
}

function resetView() {
  emit('select-city', null)
  emit('select-district', null)
  if (!chartInstance) return
  const init = getInitialView()
  chartInstance.setOption(getOption(init.center, init.zoom))
  currentZoom.value = init.zoom
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => {
    chartInstance?.resize()
  })
}

let ro: ResizeObserver | null = null

function handleResize() {
  chartInstance?.resize()
}

watch(
  () => props.active,
  (val) => {
    if (val) {
      nextTick(() => {
        chartInstance?.resize()
      })
    }
  }
)

onMounted(() => {
  if (isNationalOrg.value) {
    void resolveDeviceIpGeo()
  }
  initChart()
  window.addEventListener('resize', handleResize)
  if (chartContainer.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (chartContainer.value && chartContainer.value.clientWidth > 0 && chartContainer.value.clientHeight > 0) {
        chartInstance?.resize()
      }
    })
    ro.observe(chartContainer.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  ro?.disconnect()
  ro = null
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div class="tech-china-map-container" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- 赛博流光网格与微光背景 -->
    <div class="cyber-map-bg-grid"></div>

    <!-- 100寸全屏 Canvas 地图 -->
    <div ref="chartContainer" class="tech-map-canvas"></div>

    <!-- 顶部科技 HUD 监视栏 -->
    <div class="tech-map-hud-top">
      <div class="hud-left-tags">
        <div class="hud-pill-tag">
          <span class="pulse-cyan-dot"></span>
          <span class="pill-label">全国物联拓扑底图</span>
          <span class="pill-divider">|</span>
          <span class="pill-zoom">缩放: <b>{{ currentZoom }}x</b></span>
        </div>

        <div v-if="isNationalOrg" class="hud-pill-tag partner-mode">
          <span class="pulse-cyan-dot"></span>
          <span>在网监护设备：{{ ANQIAO_DEVICES.length }} 台</span>
        </div>

        <div class="hud-pill-tag lock-tag" title="点位与数据安全合规保护">
          <span class="lock-icon">🔒</span>
          <span>点位隐私脱敏保护</span>
        </div>
      </div>

      <!-- 快捷控制按钮组 -->
      <div class="hud-right-controls">
        <button class="tech-btn" title="放大地图 (滚轮向上)" @click="zoomIn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="tech-btn" title="缩小地图 (滚轮向下)" @click="zoomOut">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="tech-btn reset-btn" title="复位全国视角" @click="resetView">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          复位
        </button>
        <button class="tech-btn" :class="{ active: isFullscreen }" title="全屏展开" @click="toggleFullscreen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>

    <!-- 图例与合规规范水印 -->
    <div class="tech-map-legend">
      <template v-if="isNationalOrg">
        <div class="legend-item">
          <span class="legend-dot online-dot"></span>
          <span>在线设备</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot offline-dot"></span>
          <span>离线设备</span>
        </div>
      </template>
      <div v-else class="legend-item">
        <span class="legend-dot cyan"></span>
        <span>在网监护终端</span>
      </div>
      <div class="legend-item scs-compliance">
        <span>南海诸岛</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tech-china-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 560px;
  background: radial-gradient(circle at 50% 50%, #061226 0%, #030814 100%);
  overflow: hidden;
  border-radius: 4px;
}

.tech-china-map-container.is-fullscreen {
  position: fixed;
  inset: 16px;
  z-index: 9999;
  width: calc(100vw - 32px);
  height: calc(100vh - 32px);
  border: 1px solid rgba(0, 240, 255, 0.4);
  box-shadow: 0 0 80px rgba(0, 0, 0, 0.95);
}

.cyber-map-bg-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
  background-size: 32px 32px;
  z-index: 0;
}

.tech-map-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* 顶部 HUD */
.tech-map-hud-top {
  position: absolute;
  top: 12px;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 10;
}

.hud-left-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hud-pill-tag {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(5, 12, 24, 0.88);
  border: 1px solid rgba(0, 240, 255, 0.28);
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 11.5px;
  color: #94a3b8;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.hud-pill-tag.partner-mode {
  border-color: rgba(245, 158, 11, 0.35);
  color: #fef3c7;
}

.hud-pill-tag.lock-tag {
  border-color: rgba(16, 185, 129, 0.3);
  color: #a7f3d0;
}

.pulse-cyan-dot {
  width: 6px;
  height: 6px;
  background: #00f0ff;
  border-radius: 50%;
  box-shadow: 0 0 8px #00f0ff;
  animation: pulse-dot 2s infinite;
}

.pill-label {
  color: #f0fdfa;
  font-weight: 600;
}

.pill-divider {
  color: rgba(255, 255, 255, 0.2);
}

.pill-zoom b {
  color: #00f0ff;
  font-family: 'Orbitron', monospace;
}

.lock-icon {
  font-size: 11px;
}

/* 控制按钮组 */
.hud-right-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}

.tech-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  background: rgba(5, 12, 24, 0.88);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 4px;
  color: #f0fdfa;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s ease;
  backdrop-filter: blur(6px);
}

.tech-btn:hover {
  background: rgba(0, 240, 255, 0.2);
  border-color: #00f0ff;
  color: #00f0ff;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
}

.tech-btn.reset-btn {
  color: #38bdf8;
}

/* 底部图例 */
.tech-map-legend {
  position: absolute;
  bottom: 12px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  pointer-events: none;
  z-index: 10;
  background: rgba(5, 12, 24, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 5px 12px;
  backdrop-filter: blur(6px);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #cbd5e1;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.cyan {
  background: #00f0ff;
  box-shadow: 0 0 6px #00f0ff;
}

.legend-dot.online-dot {
  background: #00ff88;
  box-shadow: 0 0 6px #00ff88;
}

.legend-dot.offline-dot {
  background: #64748b;
  box-shadow: 0 0 6px #64748b;
}

.scs-compliance {
  color: #64748b;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  padding-left: 10px;
}

@keyframes pulse-dot {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}
</style>
