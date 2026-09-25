<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import chinaGeo from '../assets/china.json'
import { GEO_HIERARCHY, type DistrictDetail } from '../assets/geoHierarchy'
import type { CityStat } from '../api/types'

const props = defineProps<{
  cities: CityStat[]
  selectedCity: string | null
}>()

const emit = defineEmits<{
  (e: 'select-city', city: string | null): void
  (e: 'select-district', district: DistrictDetail | null): void
}>()

const chartContainer = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
const currentZoom = ref(1.15)
const isFullscreen = ref(false)

// 注册标准中国地图 GeoJSON
echarts.registerMap('china', chinaGeo as any)

// 核心城市经纬度对照表（用于散点投射）
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
}

// 城市散点数据源
const cityScatterData = computed(() => {
  return GEO_HIERARCHY.map((c) => {
    const coords = CITY_COORDS[c.city] || [104.5, 35.0]
    const stat = props.cities.find((s) => s.city.includes(c.city) || c.city.includes(s.city))
    const devTotal = stat?.device_total ?? c.device_total
    const alerts = stat?.alerts_today ?? 0
    return {
      name: c.city,
      value: [coords[0], coords[1], devTotal],
      device_total: devTotal,
      alerts_today: alerts,
      districts_count: c.districts.length,
      itemStyle: {
        color: props.selectedCity === c.city ? '#f59e0b' : '#00f0ff',
      },
    }
  })
})

// 当前选中城市的区县散点数据源
const districtScatterData = computed(() => {
  if (!props.selectedCity) return []
  const cityObj = GEO_HIERARCHY.find((c) => c.city === props.selectedCity)
  if (!cityObj) return []
  return cityObj.districts.map((d) => {
    return {
      name: d.name,
      value: [d.lon, d.lat, d.device_total],
      district: d,
      city: d.city,
      device_total: d.device_total,
      communities_count: d.communities.length,
    }
  })
})

function getOption(center = [104.5, 36.5], zoom = 1.15): echarts.EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(9, 20, 36, 0.95)',
      borderColor: 'rgba(0, 240, 255, 0.4)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#f8fafc', fontSize: 13 },
      formatter: (params: any) => {
        if (params.seriesType === 'effectScatter') {
          // 城市节点
          const d = params.data
          return `
            <div style="font-family: 'Noto Sans SC', sans-serif;">
              <div style="font-weight: 700; font-size: 15px; color: #00f0ff; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>${d.name}</span>
                <span style="font-size: 11px; background: rgba(0,240,255,0.15); padding: 1px 6px; border-radius: 4px; color: #38bdf8;">核心运营枢纽</span>
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.7;">
                <div>在网设备: <b style="color: #f8fafc; font-size: 13px;">${d.device_total}</b> 台</div>
                <div>今日处置告警: <b style="color: ${d.alerts_today > 0 ? '#ffb703' : '#00ff88'}">${d.alerts_today}</b> 次</div>
                <div>下辖覆盖区县: <b style="color: #f8fafc">${d.districts_count}</b> 个</div>
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 11px; color: #38bdf8;">
                👉 单击穿透下钻区县与社区
              </div>
            </div>
          `
        } else if (params.seriesType === 'scatter') {
          // 区县节点
          const d = params.data
          return `
            <div style="font-family: 'Noto Sans SC', sans-serif;">
              <div style="font-weight: 700; font-size: 14px; color: #00ff88; margin-bottom: 4px;">
                ${d.city} · ${d.name}
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.7;">
                <div>在网设备: <b style="color: #f8fafc">${d.device_total}</b> 台</div>
                <div>标杆试点社区: <b style="color: #f8fafc">${d.communities_count}</b> 个</div>
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 11px; color: #00ff88;">
                👉 单击下钻该区县社区与具体楼栋房号
              </div>
            </div>
          `
        } else if (params.seriesType === 'map' || params.componentType === 'geo') {
          return `<div style="font-weight: 600; color: #94a3b8;">${params.name || '南海诸岛'}</div>`
        }
        return ''
      },
    },
    geo: {
      map: 'china',
      roam: true,
      center,
      zoom,
      scaleLimit: { min: 0.85, max: 28.0 },
      label: {
        show: true,
        color: '#64748b',
        fontSize: 10,
      },
      itemStyle: {
        areaColor: '#0c1a30',
        borderColor: 'rgba(0, 240, 255, 0.35)',
        borderWidth: 0.9,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 10,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#122c54',
          borderColor: '#00f0ff',
          borderWidth: 1.2,
        },
        label: {
          color: '#38bdf8',
          fontWeight: 'bold',
        },
      },
      select: {
        itemStyle: {
          areaColor: '#153666',
        },
        label: {
          color: '#ffffff',
        },
      },
    },
    series: [
      // 1. 城市级波纹散点层 (全国宏观)
      {
        name: '城市枢纽',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: cityScatterData.value,
        symbolSize: (val: any) => {
          const count = val[2] || 100
          return Math.max(16, Math.min(32, Math.sqrt(count) * 1.5))
        },
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 3.5,
          period: 4,
        },
        label: {
          show: true,
          position: 'right',
          offset: [8, 0],
          formatter: (p: any) => `{name|${p.name}}\n{count|${p.data.device_total}台}`,
          rich: {
            name: {
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 700,
              textBorderColor: '#050c18',
              textBorderWidth: 2,
            },
            count: {
              color: '#00f0ff',
              fontSize: 11,
              fontFamily: 'Orbitron, Share Tech Mono, monospace',
              fontWeight: 600,
              textBorderColor: '#050c18',
              textBorderWidth: 2,
            },
          },
        },
        zlevel: 3,
      },
      // 2. 区县级散点层 (当下钻选中城市时呈现)
      {
        name: '区县分布',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: districtScatterData.value,
        symbol: 'pin',
        symbolSize: 42,
        itemStyle: {
          color: '#00ff88',
          shadowColor: 'rgba(0, 255, 136, 0.6)',
          shadowBlur: 8,
        },
        label: {
          show: true,
          formatter: (p: any) => `${p.data.device_total}`,
          color: '#050c18',
          fontWeight: 'bold',
          fontSize: 11,
          fontFamily: 'Orbitron, monospace',
        },
        zlevel: 4,
      },
      // 3. 区县名称文字标签
      {
        name: '区县标签',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: districtScatterData.value,
        symbolSize: 1,
        itemStyle: { opacity: 0 },
        label: {
          show: true,
          position: 'bottom',
          offset: [0, 4],
          formatter: (p: any) => `{b|${p.name}}`,
          rich: {
            b: {
              color: '#00ff88',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: 'rgba(5, 12, 24, 0.85)',
              padding: [2, 6],
              borderRadius: 3,
              borderColor: 'rgba(0, 255, 136, 0.4)',
              borderWidth: 1,
            },
          },
        },
        zlevel: 5,
      },
    ],
  }
}

function initChart() {
  if (!chartContainer.value) return
  chartInstance = echarts.init(chartContainer.value, undefined, { renderer: 'canvas' })
  chartInstance.setOption(getOption())

  // 点击事件监听
  chartInstance.on('click', (params) => {
    if (params.seriesType === 'effectScatter') {
      // 点击了城市散点
      const cityName = params.name
      emit('select-city', cityName)
    } else if (params.seriesType === 'scatter' && params.data) {
      // 点击了区县散点
      const dist = (params.data as any).district as DistrictDetail
      if (dist) {
        emit('select-district', dist)
      }
    } else if (params.seriesType === 'map' || params.componentType === 'geo') {
      // 点击了空白省份
      if (props.selectedCity) {
        // 如果已处于城市层级，点空白区域可返回全国
        // emit('select-city', null)
      }
    }
  })

  // 监听地理缩放与拖拽事件以更新 HUD
  chartInstance.on('georoam', () => {
    if (!chartInstance) return
    const opt: any = chartInstance.getOption()
    if (opt.geo && opt.geo[0]) {
      currentZoom.value = Number(opt.geo[0].zoom?.toFixed(2) ?? 1.15)
    }
  })
}

// 观察城市切换，平滑飞行至城市中心并放大
watch(
  () => props.selectedCity,
  (newCity) => {
    if (!chartInstance) return
    if (newCity) {
      const coords = CITY_COORDS[newCity] || [104.5, 36.5]
      // 放大并居中该城市
      chartInstance.setOption(getOption(coords, 4.2))
      currentZoom.value = 4.2
    } else {
      // 复位至全国视角
      chartInstance.setOption(getOption([104.5, 36.5], 1.15))
      currentZoom.value = 1.15
    }
  }
)

// 观察散点数据更新
watch(
  [cityScatterData, districtScatterData],
  () => {
    if (!chartInstance) return
    const opt: any = chartInstance.getOption()
    const center = opt.geo?.[0]?.center ?? [104.5, 36.5]
    const zoom = opt.geo?.[0]?.zoom ?? currentZoom.value
    chartInstance.setOption(getOption(center, zoom))
  }
)

// 视口缩放控制函数
function zoomIn() {
  if (!chartInstance) return
  const opt: any = chartInstance.getOption()
  const current = opt.geo?.[0]?.zoom ?? 1.15
  const next = Math.min(25.0, current * 1.35)
  chartInstance.setOption({ geo: { zoom: next } })
  currentZoom.value = Number(next.toFixed(2))
}

function zoomOut() {
  if (!chartInstance) return
  const opt: any = chartInstance.getOption()
  const current = opt.geo?.[0]?.zoom ?? 1.15
  const next = Math.max(0.85, current * 0.74)
  chartInstance.setOption({ geo: { zoom: next } })
  currentZoom.value = Number(next.toFixed(2))
}

function resetView() {
  emit('select-city', null)
  emit('select-district', null)
  if (!chartInstance) return
  chartInstance.setOption(getOption([104.5, 36.5], 1.15))
  currentZoom.value = 1.15
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

onMounted(() => {
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
  <div class="flat-map-container" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- ECharts 承载容器：100% 充满，原生 GPU 硬件加速 -->
    <div ref="chartContainer" class="echarts-map-view"></div>

    <!-- 顶部科技提示与缩放 HUD 控制栏 -->
    <div class="map-hud-overlay">
      <div class="hud-status-badge">
        <span class="status-pulse-dot"></span>
        <span class="status-title">国家测绘标准 1:1 合规地图</span>
        <span class="status-divider">|</span>
        <span class="status-zoom-txt">当前缩放: <b>{{ currentZoom }}x</b></span>
        <span class="status-tip">（支持鼠标滚轮无级缩放 · 拖拽平移 · 双击居中）</span>
      </div>

      <!-- 快捷缩放与漫游操作控件 -->
      <div class="hud-control-group">
        <button class="hud-ctrl-btn" title="放大地图 (滚轮向上)" @click="zoomIn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="hud-ctrl-btn" title="缩小地图 (滚轮向下)" @click="zoomOut">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="hud-ctrl-btn reset-btn" title="复位全国视图" @click="resetView">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          复位
        </button>
        <button class="hud-ctrl-btn" :class="{ active: isFullscreen }" title="切换地图全景展开" @click="toggleFullscreen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>

    <!-- 地图右下侧合规合影水印提示 -->
    <div class="submap-compliance-tag">
      <span class="compliance-mark">南海诸岛已按国家规范附设右下侧附图</span>
    </div>
  </div>
</template>

<style scoped>
.flat-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
  background: radial-gradient(circle at 50% 50%, #0a172a 0%, #050b14 100%);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8), 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
}

.flat-map-container.is-fullscreen {
  position: fixed;
  inset: 20px;
  z-index: 9999;
  width: calc(100vw - 40px);
  height: calc(100vh - 40px);
  box-shadow: 0 0 100px rgba(0, 0, 0, 0.95), 0 0 30px rgba(0, 240, 255, 0.3);
}

.echarts-map-view {
  width: 100%;
  height: 100%;
}

/* 顶部科技 HUD 覆盖层 */
.map-hud-overlay {
  position: absolute;
  top: 14px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 10;
}

.hud-status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(6, 16, 30, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #94a3b8;
  pointer-events: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.status-pulse-dot {
  width: 7px;
  height: 7px;
  background: #00ff88;
  border-radius: 50%;
  box-shadow: 0 0 8px #00ff88;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

.status-title {
  color: #f0fdfa;
  font-weight: 600;
}

.status-divider {
  color: rgba(255, 255, 255, 0.15);
}

.status-zoom-txt {
  color: #38bdf8;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
}

.status-zoom-txt b {
  color: #00f0ff;
}

.status-tip {
  color: #64748b;
  font-size: 11px;
}

/* 控制按钮组 */
.hud-control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}

.hud-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  background: rgba(6, 16, 30, 0.88);
  border: 1px solid rgba(0, 240, 255, 0.28);
  border-radius: 6px;
  color: #f0fdfa;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.hud-ctrl-btn:hover {
  background: rgba(0, 240, 255, 0.18);
  border-color: #00f0ff;
  color: #00f0ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 240, 255, 0.25);
}

.hud-ctrl-btn:active {
  transform: translateY(0);
}

.hud-ctrl-btn.reset-btn {
  color: #38bdf8;
}

.hud-ctrl-btn.active {
  background: rgba(0, 240, 255, 0.25);
  border-color: #00f0ff;
  color: #00f0ff;
}

/* 右下角合规水印 */
.submap-compliance-tag {
  position: absolute;
  bottom: 12px;
  right: 16px;
  z-index: 5;
  pointer-events: none;
}

.compliance-mark {
  display: inline-block;
  font-size: 11px;
  color: #64748b;
  background: rgba(6, 16, 30, 0.6);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

@media (max-width: 900px) {
  .status-tip {
    display: none;
  }
}
</style>
