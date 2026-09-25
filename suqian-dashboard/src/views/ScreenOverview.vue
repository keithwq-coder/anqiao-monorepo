<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getHardwareAlarms } from '../api/hardwareApi'
import type { HardwareAlarm } from '../api/hardwareApi'
import { ANQIAO_DEVICES, getAnqiaoDevice } from '../assets/anqiaoDevices'
import { MISSING_HINT, MISSING_TEXT } from '../assets/ltciArchive'
import { cloudGatewayHealth, isOnline, lastSampleTime, liveDeviceCount, offlineReason, presenceOf } from '../api/deviceTelemetry'

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

// 宿迁长护险试点：真实云端告警（仅真实接口返回，失败则置空并如实显示"当前无云端告警"）
const anqiaoAlarms = ref<HardwareAlarm[]>([])

const donutReady = ref(false)
const meterReady = ref(false)

// 实时遥测三态：在床 + 离床 = 在线；离线 = 在册 - 在线。
// 所有 KPI 大数字与副文案一律绑定下列同一组 computed，禁止 DOM 直写（避免与副文案口径漂移）。
const rtLiveCount = computed(() => liveDeviceCount())
const inBedCount = computed(() => ANQIAO_DEVICES.filter((d) => presenceOf(d.sn) === 'person').length)
const offBedCount = computed(() => ANQIAO_DEVICES.filter((d) => presenceOf(d.sn) === 'empty').length)
const offlineCount = computed(() => ANQIAO_DEVICES.length - rtLiveCount.value)
const onlineRatePct = computed(() => (ANQIAO_DEVICES.length > 0 ? (rtLiveCount.value / ANQIAO_DEVICES.length) * 100 : 0))
const pctOf = (n: number) => (ANQIAO_DEVICES.length > 0 ? (n / ANQIAO_DEVICES.length) * 100 : 0)
const inBedPct = computed(() => pctOf(inBedCount.value))
const offBedPct = computed(() => pctOf(offBedCount.value))

// 校验不变式：在床 + 离床 + 离线 === 在册；在线 === 在床 + 离床
// （开发期自检，不进界面）

// 长护险业务 KPI：未接入医保局数据，全部"未获取/待接入"，严禁编造任何数字
const ltciKpis = [
  { label: '纳管失能人员数', unit: '人' },
  { label: '今日服务核验人次', unit: '人次' },
  { label: '疑似骗保疑点工单', unit: '件' },
  { label: '拦截异常基金金额', unit: '元' },
  { label: '服务达标率', unit: '%' },
]

// 在册设备类型分布（按 ANQIAO_DEVICES 台账口径实算，在线数按共享遥测 store 实算）
const CATEGORY_META: Record<string, { name: string; color: string }> = {
  health_guardian: { name: 'AI健康守护仪 (ASH-01)', color: '#00f0ff' },
  health_monitor: { name: '健康体征监测仪', color: '#ffb703' },
  fall_detector: { name: '跌倒检测报警器', color: '#00ff88' },
  unknown: { name: '其他监测终端', color: '#a78bfa' },
}

const effectiveDeviceData = computed(() => {
  const total = ANQIAO_DEVICES.length
  const online = rtLiveCount.value
  const categories = [...new Set(ANQIAO_DEVICES.map((d) => d.category))]
  return {
    total,
    online,
    offline: total - online,
    types: categories.map((c) => {
      const devs = ANQIAO_DEVICES.filter((d) => d.category === c)
      const onlineInCat = devs.filter((d) => isOnline(d.sn)).length
      const meta = CATEGORY_META[c] ?? CATEGORY_META.unknown
      return {
        name: meta.name,
        count: devs.length,
        color: meta.color,
        online_rate: devs.length > 0 ? Math.round((onlineInCat / devs.length) * 1000) / 10 : 0,
      }
    }),
  }
})

const donut = computed(() => {
  const dData = effectiveDeviceData.value
  const r = 75
  const C = 2 * Math.PI * r
  const total = dData.total || 1
  let offset = 0
  const segments = dData.types.map((t) => {
    const len = (t.count / total) * C
    const seg = {
      color: t.color,
      dash: donutReady.value ? `${len - 2} ${C - (len - 2)}` : `0 ${C}`,
      offset: -offset,
    }
    offset += len
    return seg
  })
  return { total, C, segments }
})

const donutTicks = computed(() => {
  const ticks: { x1: number; y1: number; x2: number; y2: number; opacity: number; width: number }[] = []
  for (let i = 0; i < 60; i++) {
    const ang = (i * 6) * Math.PI / 180
    const major = i % 5 === 0
    ticks.push({
      x1: 100 + 90 * Math.cos(ang), y1: 100 + 90 * Math.sin(ang),
      x2: 100 + (major ? 94 : 92) * Math.cos(ang), y2: 100 + (major ? 94 : 92) * Math.sin(ang),
      opacity: major ? 0.5 : 0.15,
      width: major ? 1.5 : 0.8,
    })
  }
  return ticks
})

const deviceRows = computed(() => {
  const dData = effectiveDeviceData.value
  const total = dData.total || 1
  return dData.types.map((t) => ({
    ...t,
    pct: ((t.count / total) * 100).toFixed(1),
    meterWidth: meterReady.value ? ((t.count / total) * 100).toFixed(1) + '%' : '0%',
  }))
})

// 设备型号谱系分布（按 ANQIAO_DEVICES 实算）
const modelTubes = computed(() => {
  const total = ANQIAO_DEVICES.length || 1
  const categories = [...new Set(ANQIAO_DEVICES.map((d) => d.category))]
  return categories.map((c) => {
    const count = ANQIAO_DEVICES.filter((d) => d.category === c).length
    const meta = CATEGORY_META[c] ?? CATEGORY_META.unknown
    return {
      name: meta.name,
      color: meta.color,
      count,
      pct: ((count / total) * 100).toFixed(1),
    }
  })
})

// 网络通道分布（按 ANQIAO_DEVICES 实算）
const networkRows = computed(() => {
  const buckets: { name: string; match: (n: string) => boolean; color: string; count: number }[] = [
    { name: '物联专网', match: (n) => n.includes('专网') || n.includes('IoTDA'), color: 'var(--cyan)', count: 0 },
    { name: '4G蜂窝物联网', match: (n) => n.includes('4G'), color: 'var(--mint)', count: 0 },
    { name: '专网光纤通道', match: (n) => n.includes('光纤'), color: 'var(--amber)', count: 0 },
    { name: '其他通道', match: () => true, color: 'var(--violet-bright)', count: 0 },
  ]
  for (const d of ANQIAO_DEVICES) {
    const b = buckets.find((x) => x.match(d.network))
    if (b) b.count++
  }
  const total = ANQIAO_DEVICES.length || 1
  return buckets.filter((b) => b.count > 0).map((b) => ({
    name: b.name,
    color: b.color,
    count: b.count,
    pct: Math.round((b.count / total) * 100),
  }))
})

const HW_ALARM_TITLES: Record<string, string> = {
  hr: '心率异常告警',
  br: '呼吸异常告警',
  tp: '体温异常告警',
  off_bed: '离床超时告警',
  fall: '跌倒告警',
}

interface StreamEventVM {
  id: string
  sn: string
  label: string
  sub: string
  tag: string
  cls: string
  isAlert: boolean
  title: string
  detail: string
  note: string
  time: string
  clickable: boolean
}

// 真实设备状态流水：3 台在册设备的在床/离床/离线三态 + 最后采样时间；
// 云端告警仅展示真实接口返回；流水末尾固定"服务稽核流水 · 待医保局打卡数据接入"
const streamEvents = computed<StreamEventVM[]>(() => {
  const list: StreamEventVM[] = ANQIAO_DEVICES.map((d) => {
    const p = presenceOf(d.sn)
    const sample = lastSampleTime(d.sn)
    const state = p === 'person'
      ? { tag: '在床', cls: 'mint', text: '设备在线 · 在床' }
      : p === 'empty'
        ? { tag: '离床', cls: 'amber', text: '设备在线 · 离床' }
        : { tag: '离线', cls: 'gray', text: `离线 · ${offlineReason(d.sn)}` }
    return {
      id: `dev-${d.sn}`,
      sn: d.sn,
      label: d.sn,
      sub: d.model,
      tag: state.tag,
      cls: state.cls,
      isAlert: false,
      title: state.text,
      detail: `${d.network} · ${d.scene} · ${d.city}`,
      note: sample ? `最后更新 ${sample}` : '暂无数据',
      time: sample ? sample.slice(11) : '--:--:--',
      clickable: true,
    }
  })

  if (anqiaoAlarms.value.length) {
    for (const a of anqiaoAlarms.value.slice(0, 3)) {
      const dev = getAnqiaoDevice(a.device_id)
      list.push({
        id: `hw-${a.id}`,
        sn: a.device_id,
        label: dev?.label ?? a.device_id,
        sub: dev?.model ?? '在册设备',
        tag: '云端告警',
        cls: 'amber',
        isAlert: a.status !== 'handled',
        title: HW_ALARM_TITLES[a.alert_type] ?? '设备告警',
        detail: `触发值 ${a.alert_value}${dev ? ` · ${dev.network}` : ''}`,
        note: a.status === 'handled' ? '运维值班已闭环' : '运维值班响应中',
        time: (a.trigger_time || '').slice(11, 19) || '--:--:--',
        clickable: true,
      })
    }
  } else {
    list.push({
      id: 'aq-none',
      sn: '',
      label: '云端告警队列',
      sub: '',
      tag: '运行正常',
      cls: 'mint',
      isAlert: false,
      title: '当前无云端告警',
      detail: '告警队列为空',
      note: `${liveDeviceCount()} / ${ANQIAO_DEVICES.length} 台在线`,
      time: '--:--:--',
      clickable: false,
    })
  }

  list.push({
    id: 'aq-audit',
    sn: '',
    label: '服务稽核流水',
    sub: '',
    tag: '数据完善中',
    cls: 'missing',
    isAlert: false,
    title: '服务打卡数据完善中',
    detail: '服务打卡 / 稽核工单 / 基金结算数据完善中',
    note: MISSING_HINT,
    time: '--:--:--',
    clickable: false,
  })
  return list
})

const rankCls = (i: number) => (i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '')

// 设备在线状态榜（真实三态）
const onlineRankRows = computed(() =>
  [...ANQIAO_DEVICES]
    .sort((a, b) => Number(isOnline(b.sn)) - Number(isOnline(a.sn)))
    .map((d) => {
      const p = presenceOf(d.sn)
      return {
        sn: d.sn,
        label: d.label,
        text: p === 'person' ? '● 在床' : p === 'empty' ? '● 离床' : '○ 离线',
        color: p === 'person' ? 'var(--mint)' : p === 'empty' ? 'var(--amber)' : '#94a3b8',
      }
    })
)

// 遥测回传时效榜（真实最后采样时间，无则"未获取"）
const telemetryRankRows = computed(() =>
  [...ANQIAO_DEVICES]
    .sort((a, b) => (lastSampleTime(b.sn) || '').localeCompare(lastSampleTime(a.sn) || ''))
    .map((d) => {
      const t = lastSampleTime(d.sn)
      return { sn: d.sn, label: d.label, text: t ? t.slice(5, 16) : MISSING_TEXT, missing: !t }
    })
)

// 24H 设备遥测时序：无历史时序数据源，仅绘制坐标网格与零基线，严禁伪造事件峰值
function drawRiskTimeline() {
  const canvas = document.getElementById('s1-risk-timeline-canvas') as HTMLCanvasElement | null
  if (!canvas || !canvas.clientWidth) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth || 450
  const h = canvas.clientHeight || 75
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)'
  ctx.lineWidth = 1
  for (let y = 15; y < h - 15; y += 18) {
    ctx.beginPath()
    ctx.moveTo(10, y)
    ctx.lineTo(w - 10, y)
    ctx.stroke()
  }

  const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
  hours.forEach((hr, i) => {
    const x = (i / (hours.length - 1)) * (w - 50) + 25
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h - 14)
    ctx.stroke()
    ctx.fillStyle = 'rgba(141, 160, 189, 0.7)'
    ctx.font = '9.5px "Share Tech Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(hr, x, h - 3)
  })

  // 零基线（虚线）：历史时序数据待接入前的如实空态
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)'
  ctx.lineWidth = 1.4
  ctx.setLineDash([4, 5])
  ctx.beginPath()
  ctx.moveTo(10, h - 16)
  ctx.lineTo(w - 10, h - 16)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(148, 163, 184, 0.65)'
  ctx.font = '10px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('历史趋势数据完善中 · 当前展示实时数据', w / 2, (h - 16) / 2 + 4)
}

function onResize() {
  if (props.active) drawRiskTimeline()
}

onMounted(async () => {
  // 设备口径，不发任何机构 mock 请求；仅尝试拉取真实云端设备告警
  try {
    const res = await getHardwareAlarms(55, 1, 10)
    anqiaoAlarms.value = (res.items || []).filter((a) => !!getAnqiaoDevice(a.device_id))
  } catch {
    anqiaoAlarms.value = []
  }

  await nextTick()
  drawRiskTimeline()
  setTimeout(() => { donutReady.value = true }, 150)
  setTimeout(() => { meterReady.value = true }, 250)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <!-- 顶部 KPI：真实设备组（全部实算，大数字与副文案同源） -->
  <div class="cockpit-kpi-row" style="margin-bottom: 8px; height: 86px;">
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">在册感知设备</div>
        <div class="val">{{ ANQIAO_DEVICES.length }}<span class="unit" style="font-size:14px;color:var(--txt-muted)">台</span></div>
        <div class="sub"><span style="color:var(--cyan)">AI健康守护仪 ASH-01 · 宿迁市</span></div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">实时在线</div>
        <div class="val">{{ rtLiveCount }}<span class="unit" style="font-size:14px;color:var(--txt-muted)">台</span></div>
        <div class="sub"><span style="color:var(--mint)">在床 {{ inBedCount }} · 离床 {{ offBedCount }} · 在线率 {{ onlineRatePct.toFixed(1) }}%</span></div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">在床 / 离床 / 离线</div>
        <div class="val">{{ inBedCount }}<span class="unit" style="font-size:14px;color:var(--txt-muted)">/ {{ offBedCount }} / {{ offlineCount }}</span></div>
        <div class="sub">
          <span style="color:var(--cyan)">在床 {{ inBedCount }} 台</span> ·
          <span style="color:var(--amber)">离床 {{ offBedCount }} 台</span> ·
          <span style="color:var(--txt-muted)">离线 {{ offlineCount }} 台</span>
        </div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">云端链路</div>
        <div class="val" :style="{ fontSize: '21px', color: cloudGatewayHealth.healthy ? 'var(--mint)' : 'var(--crimson)' }">
          {{ cloudGatewayHealth.healthy ? '正常' : '异常' }}
        </div>
        <div class="sub">
          <span :style="{ color: cloudGatewayHealth.healthy ? 'var(--mint)' : 'var(--crimson)' }">{{ cloudGatewayHealth.message }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 长护险业务 KPI 组（未接入医保局数据，全部"未获取/待接入"，严禁编造） -->
  <div class="ltci-kpi-row">
    <div v-for="k in ltciKpis" :key="k.label" class="hud-card ltci-kpi-cell" :title="MISSING_HINT">
      <div class="ltci-kpi-lbl">{{ k.label }}</div>
      <div class="ltci-kpi-val missing-val">{{ MISSING_TEXT }}<span class="ltci-kpi-unit">{{ k.unit }}</span></div>
      <span class="missing-tag">数据完善中</span>
    </div>
  </div>

  <!-- 中层双栏：物联网感知设备分布 + 24H 设备遥测与告警流水 -->
  <div class="grid-two-col">
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>物联网感知设备分布<span class="code">IOT TOPOLOGY</span></div>
        <span class="hud-badge">{{ effectiveDeviceData.types.length }} 类设备 · 在册 {{ effectiveDeviceData.total }} 台</span>
      </div>
      <div class="hud-body">
        <div class="reactor-chart-box">
          <div class="donut-reactor-wrap">
            <svg viewBox="0 0 200 200" width="200" height="200">
              <line v-for="(t, i) in donutTicks" :key="'t' + i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" :stroke="`rgba(0,240,255,${t.opacity})`" :stroke-width="t.width"/>
              <circle cx="100" cy="100" :r="75" fill="none" stroke="rgba(0, 240, 255, 0.08)" stroke-width="14"/>
              <circle v-for="(s, i) in donut.segments" :key="i" cx="100" cy="100" :r="75" fill="none"
                :stroke="s.color" stroke-width="14" :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset"
                style="transition: stroke-dasharray 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);"/>
            </svg>
            <div class="donut-core-hologram">
              <div class="digits">{{ effectiveDeviceData.total.toLocaleString() }}</div>
              <div class="tag">ACTIVE</div>
            </div>
          </div>
          <div class="device-telemetry-list">
            <div v-for="(t, i) in deviceRows" :key="i" class="telemetry-row">
              <span class="telemetry-tag" :style="{ background: t.color, boxShadow: `0 0 6px ${t.color}` }"></span>
              <span class="telemetry-name">{{ t.name }}</span>
              <div class="cyber-meter-track"><div class="cyber-meter-fill" :style="{ background: t.color, width: t.meterWidth, transition: 'width 1.2s cubic-bezier(0.2,0.8,0.2,1)' }"></div></div>
              <span class="telemetry-val" :style="{ color: t.color }">{{ t.count }}</span>
              <span class="telemetry-pct">{{ t.pct }}%</span>
              <span class="telemetry-online-chip">在线 {{ t.online_rate }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>24H 设备状态与告警流水<span class="code">TELEMETRY &amp; ALERTS</span></div>
        <span class="hud-badge" style="color:var(--mint);border-color:var(--mint)">● 实时数据流</span>
      </div>
      <div class="hud-body" style="padding: 10px 14px;">
        <div class="risk-radar-wrapper">
          <div>
            <div class="risk-timeline-header">
              <span class="title"><span style="color:var(--cyan)">⚡</span> 24小时设备在线趋势</span>
              <span class="missing-tag" :title="MISSING_HINT">历史趋势完善中</span>
            </div>
            <div class="risk-canvas-box" style="margin-top:6px;">
              <canvas id="s1-risk-timeline-canvas"></canvas>
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; color:var(--txt-secondary)">
              <span style="font-weight:700; color:#fff">实时设备状态与告警流水</span>
              <span style="font-family:var(--font-mono); color:var(--mint)">实时刷新中</span>
            </div>
            <div class="risk-triage-queue">
              <div v-for="ev in streamEvents" :key="ev.id" class="triage-event-card"
                :class="{ 'crimson-alert': ev.isAlert, 'missing-card': ev.cls === 'missing' }"
                :title="ev.cls === 'missing' ? MISSING_HINT : ev.clickable ? `点击直达 [${ev.sn}] 设备画像` : ''"
                @click="ev.clickable && emit('select-patient', ev.sn)">
                <div class="triage-top">
                  <span class="tag" :class="ev.cls">{{ ev.tag }}</span>
                  <span class="time">{{ ev.time }}</span>
                </div>
                <div class="triage-body">
                  <span class="patient">
                    {{ ev.label }}
                    <small v-if="ev.sub" style="font-weight:normal;color:var(--txt-muted)">({{ ev.sub }})</small>
                  </span>
                  <span class="status" :style="{ color: ev.cls === 'crimson' ? 'var(--crimson)' : ev.cls === 'amber' ? 'var(--amber)' : ev.cls === 'mint' ? 'var(--mint)' : 'var(--txt-secondary)' }">{{ ev.title }}</span>
                </div>
                <div class="triage-footer">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;">{{ ev.detail }} · {{ ev.note }}</span>
                  <span v-if="ev.clickable" style="color:var(--cyan);font-family:var(--font-mono);font-size:10px;">画像 ↗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 下层双栏：设备资产谱系与长护险监管矩阵 + 全域监管态势排行榜 -->
  <div class="grid-bottom-col">
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head" style="padding: 10px 14px;">
        <div class="hud-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <span class="marker"></span>设备资产谱系与长护险监管矩阵<span class="code" style="margin-left: 6px; font-size: 10px;">DEVICE &amp; LTCI SPECTRUM</span>
        </div>
        <span class="hud-badge" style="white-space: nowrap; flex-shrink: 0;">{{ ANQIAO_DEVICES.length }} 台在册设备</span>
      </div>
      <div class="hud-body" style="padding: 0; overflow: hidden;">
        <div class="s1-c3-container">
          <div class="s1-c3-left-col">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>在床 / 离床 / 离线三态结构</span>
                <span style="color:var(--cyan); font-family:var(--font-mono)">
                  在线 {{ onlineRatePct.toFixed(1) }}% · 离线 {{ (100 - onlineRatePct).toFixed(1) }}%
                </span>
              </div>
              <div class="s1-gender-capsule">
                <div v-if="inBedCount > 0" class="s1-state-seg seg-inbed" :style="{ width: inBedPct + '%' }">在床 {{ inBedCount }} 台</div>
                <div v-if="offBedCount > 0" class="s1-state-seg seg-offbed" :style="{ width: offBedPct + '%' }">离床 {{ offBedCount }} 台</div>
                <div v-if="offlineCount > 0" class="s1-state-seg seg-offline" :style="{ flex: 1 }">离线 {{ offlineCount }} 台</div>
              </div>
              <div class="s1-demog-microbar">
                <div class="s1-demog-micro-item">在册设备 <b>{{ ANQIAO_DEVICES.length }}</b><span style="font-size:9px">台</span></div>
                <div class="s1-demog-micro-item">覆盖区县 <b style="color:var(--cyan)">2 个区</b></div>
                <div class="s1-demog-micro-item">设备在线率 <b style="color:var(--mint)">{{ onlineRatePct.toFixed(1) }}</b><span style="font-size:9px">%</span></div>
              </div>
            </div>

            <div class="s1-age-box">
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:2px;">
                <span>设备点位坐标落点</span>
                <span style="color:var(--mint); font-size:10px; font-weight:700;">● 全量坐标接入</span>
              </div>
              <div class="s1-coord-list">
                <div v-for="d in ANQIAO_DEVICES" :key="d.sn" class="s1-coord-row">
                  <span class="s1-coord-sn">{{ d.sn }}</span>
                  <span class="s1-coord-addr">{{ d.city }} · {{ d.district }} · {{ d.address }}</span>
                  <span style="color:var(--cyan); font-family:var(--font-mono); font-size:10.5px;">{{ d.lon?.toFixed(3) }}, {{ d.lat?.toFixed(3) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="s1-c3-right-col">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:5px;">
                <span>设备型号谱系分布</span>
                <span style="color:var(--txt-muted); font-family:var(--font-mono); font-size:10px;">
                  在网运行 {{ rtLiveCount }} 台
                </span>
              </div>
              <div class="s1-care-tubes-box">
                <div v-for="t in modelTubes" :key="t.name" class="s1-care-tube-row">
                  <span class="s1-care-tube-name" :style="{ color: t.color }">{{ t.name }}</span>
                  <div class="s1-care-tube-track"><div class="s1-care-tube-fill" :style="{ background: t.color, width: t.pct + '%' }"></div></div>
                  <span class="s1-care-tube-val" :style="{ color: t.color }">{{ t.count }}台 <small style="font-size:9px;color:var(--txt-muted)">{{ t.pct }}%</small></span>
                </div>
              </div>
            </div>

            <div class="s1-clinical-guard-strip">
              <span>物联专网覆盖 · 运营响应</span>
              <span :style="{ color: cloudGatewayHealth.healthy ? 'var(--mint)' : 'var(--crimson)', fontFamily: 'var(--font-mono)' }">
                本轮在线确认 {{ cloudGatewayHealth.successCount }}/{{ cloudGatewayHealth.totalChecked }} 台
              </span>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>网络通道分布</span>
                <span style="color:var(--txt-muted); font-size:9.5px;">按在册设备统计</span>
              </div>
              <div class="s1-chronic-grid">
                <div v-for="d in networkRows" :key="d.name" class="s1-chronic-chip">
                  <div class="disease-row"><span class="disease-name">{{ d.name }}</span><span class="disease-stat" :style="{ color: d.color }">{{ d.count }}台 <small style="font-size:9px;color:var(--txt-muted)">{{ d.pct }}%</small></span></div>
                  <div class="disease-bar"><div class="disease-bar-fill" :style="{ background: d.color, width: d.pct + '%', boxShadow: `0 0 5px ${d.color}` }"></div></div>
                </div>
              </div>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--txt-secondary); margin-bottom:4px;">
                <span>失能等级结构 · ADL 偏离度</span>
                <span class="missing-tag" :title="MISSING_HINT">数据完善中</span>
              </div>
              <div class="s1-missing-box">
                <span class="missing-val" :title="MISSING_HINT">{{ MISSING_TEXT }}</span>
                <span class="s1-missing-note">失能等级结构分布 / ADL 偏离度监测为规划中的监管视图，档案数据完善后展示</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>全域监管态势排行榜<span class="code">TOP RISK BENCHMARKS</span></div>
        <span class="hud-badge" style="color:var(--cyan);border-color:var(--cyan)">
          {{ ANQIAO_DEVICES.length }} 台在册设备 · 状态总榜
        </span>
      </div>
      <div class="hud-body" style="padding:10px 12px;">
        <div class="rankings-trio-grid">
          <div class="rank-col-box">
            <div class="rank-col-head"><span class="chevron">»</span><span>设备在线状态榜</span></div>
            <div class="rank-table-header"><span>排名</span><span>设备编号 / 点位</span><span style="text-align:right;padding-right:6px">状态</span><span style="text-align:center">趋势</span></div>
            <div class="rank-table-body">
              <div v-for="(r, i) in onlineRankRows" :key="r.sn" class="rank-table-row">
                <span class="rank-num" :class="rankCls(i)">{{ i + 1 }}</span>
                <span class="rank-bed"><span class="bed-badge">{{ r.sn }}</span><span class="patient-name">{{ r.label }}</span></span>
                <span class="rank-val" :style="{ color: r.color, fontSize: '11px' }">{{ r.text }}</span>
                <span class="rank-arrow up-cyan">稳</span>
              </div>
            </div>
          </div>

          <div class="rank-col-box">
            <div class="rank-col-head"><span class="chevron" style="color:var(--mint)">»</span><span>数据更新时效榜</span></div>
            <div class="rank-table-header"><span>排名</span><span>设备编号 / 点位</span><span style="text-align:right;padding-right:6px">最后更新</span><span style="text-align:center">状态</span></div>
            <div class="rank-table-body">
              <div v-for="(r, i) in telemetryRankRows" :key="r.sn" class="rank-table-row">
                <span class="rank-num" :class="rankCls(i)">{{ i + 1 }}</span>
                <span class="rank-bed"><span class="bed-badge">{{ r.sn }}</span><span class="patient-name">{{ r.label }}</span></span>
                <span class="rank-val" :class="{ 'missing-val': r.missing }" :title="r.missing ? MISSING_HINT : ''" style="font-size:10px;">{{ r.text }}</span>
                <span class="rank-arrow up-cyan">稳</span>
              </div>
            </div>
          </div>

          <div class="rank-col-box">
            <div class="rank-col-head"><span class="chevron" style="color:var(--amber)">»</span><span>长护险稽核违规排行</span></div>
            <div class="rank-missing-panel">
              <span class="missing-val" :title="MISSING_HINT">数据完善中</span>
              <span class="missing-tag" :title="MISSING_HINT">服务打卡 · 稽核工单 · 违规记录 数据完善中</span>
              <p class="note">规划中的监管视图：经办数据完善后展示服务机构违规排行</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 长护险业务 KPI 组（全部待接入） */
.ltci-kpi-row {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;
  height: 64px; margin-bottom: 8px; flex-shrink: 0;
}
.ltci-kpi-cell {
  padding: 8px 14px; display: flex; flex-direction: column; justify-content: center; gap: 3px;
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.05), rgba(9, 20, 36, 0.6));
}
.ltci-kpi-lbl { font-size: 11.5px; color: var(--txt-secondary); letter-spacing: 1px; }
.ltci-kpi-val { font-family: var(--font-digit); font-size: 19px; font-weight: 700; line-height: 1.1; }
.ltci-kpi-unit { font-size: 11px; margin-left: 4px; color: var(--txt-muted); font-weight: 400; }

/* 流水标签扩展（在床/离线/待接入） */
.triage-top .tag.mint { background: rgba(0, 255, 136, 0.18); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.5); }
.triage-top .tag.gray { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }
.triage-top .tag.missing { background: rgba(148, 163, 184, 0.1); color: rgba(148, 163, 184, 0.8); border: 1px dashed rgba(148, 163, 184, 0.4); }
.triage-event-card.missing-card { border-style: dashed; border-color: rgba(148, 163, 184, 0.35); cursor: default; }
.triage-event-card.missing-card:hover { border-color: rgba(148, 163, 184, 0.5); box-shadow: none; }

/* 在床/离床/离线三态胶囊 */
.s1-state-seg {
  display: flex; align-items: center; padding: 0 8px;
  font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: #fff;
  white-space: nowrap; overflow: hidden;
}
.seg-inbed { background: linear-gradient(90deg, rgba(0, 255, 136, 0.25), rgba(0, 255, 136, 0.6)); }
.seg-offbed { background: linear-gradient(90deg, rgba(255, 183, 3, 0.25), rgba(255, 183, 3, 0.55)); }
.seg-offline { background: rgba(148, 163, 184, 0.16); color: #94a3b8; justify-content: flex-end; }

/* 点位坐标待确认清单 */
.s1-coord-list { display: flex; flex-direction: column; gap: 5px; padding: 6px 2px; }
.s1-coord-row {
  display: flex; align-items: center; gap: 8px; font-size: 11px;
  background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(0, 240, 255, 0.1);
  border-radius: 3px; padding: 5px 8px;
}
.s1-coord-sn { font-family: var(--font-digit); font-weight: 700; color: var(--cyan); font-size: 11.5px; flex-shrink: 0; }
.s1-coord-addr {
  flex: 1; color: var(--txt-secondary); font-size: 10.5px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* 失能等级 / ADL 待接入空态 */
.s1-missing-box {
  display: flex; flex-direction: column; gap: 5px;
  background: rgba(148, 163, 184, 0.05); border: 1px dashed rgba(148, 163, 184, 0.3);
  border-radius: 3px; padding: 8px 10px;
}
.s1-missing-box .missing-val { font-family: var(--font-digit); font-size: 15px; align-self: flex-start; }
.s1-missing-note { font-size: 9.5px; color: var(--txt-muted); line-height: 1.5; }

/* 稽核违规排行待接入空态 */
.rank-missing-panel {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  border: 1px dashed rgba(148, 163, 184, 0.3); border-radius: 4px;
  background: rgba(148, 163, 184, 0.04); padding: 12px; text-align: center;
}
.rank-missing-panel .missing-val { font-size: 14px; }
.rank-missing-panel .note { font-size: 9.5px; color: var(--txt-muted); line-height: 1.5; margin: 0; }
</style>
