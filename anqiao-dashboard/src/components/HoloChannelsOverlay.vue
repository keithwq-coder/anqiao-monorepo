<script setup lang="ts">
// 五通道医学监护标签（心率/呼吸/体温/体动/在床离床）
// 围绕人体外缘布置少量细长仪读标签 + 波形引线，不再堆叠 HUD 矩形卡片；
// 数字人体保持为视觉焦点。解剖锚点与 MedicalHologramFigure 分层一致。
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    hr: number
    br: number
    tp: number
    movement: number
    alert: boolean
    heartCycle: string
    breatheCycle: string
    bedState?: 'in' | 'out' | 'off'
    bedSince?: string
    bedLastOff?: string
    bedLastOn?: string
  }>(),
  {
    bedState: 'in',
    bedSince: '',
    bedLastOff: '',
    bedLastOn: '',
  },
)

const tpText = computed(() => props.tp.toFixed(1))
const ringColor = computed(() => (props.alert ? '#ff3b6b' : '#00ffb0'))
const hrTextColor = computed(() => (props.alert ? '#ff3b6b' : '#00f0ff'))

const heatColor = computed(() => (props.tp >= 38 ? '#ff3b6b' : props.tp > 37.2 ? '#ffb703' : '#00ffb0'))
const heatOpacity = computed(() => (props.tp <= 37.2 ? 0.4 : props.tp < 38 ? 0.65 : 0.92))

const haloColor = computed(() => (props.movement > 20 ? '#ffb703' : props.movement > 12 ? '#00ffb0' : '#00f0ff'))

const bedColor = computed(() => (props.bedState === 'in' ? '#00ff88' : props.bedState === 'out' ? '#ffb703' : '#8aa3bd'))
const bedValText = computed(() => (props.bedState === 'in' ? '在床' : props.bedState === 'out' ? '离床' : '离线'))
const bedDesc1 = computed(() => {
  if (props.bedState === 'in') return props.bedSince ? `自 ${props.bedSince}` : '持续在床'
  if (props.bedState === 'out') return props.bedLastOff ? `自 ${props.bedLastOff}` : '离床待核'
  return '状态待核'
})
</script>

<template>
  <svg class="s3-stage-svg-overlay" viewBox="0 0 480 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <filter id="s3v2-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- ==================== 引线（细，弱，指向解剖锚点） ==================== -->
    <g class="hc-lead">
      <line x1="216" y1="182" x2="98" y2="190" stroke="#00ffcc" stroke-width="1" stroke-dasharray="2 4"/>
      <line x1="204" y1="304" x2="98" y2="312" :stroke="haloColor" stroke-width="1" stroke-dasharray="2 4"/>
      <line x1="234" y1="76" x2="384" y2="86" :stroke="heatColor" stroke-width="1" stroke-dasharray="2 4"/>
      <line x1="258" y1="180" x2="384" y2="190" :stroke="ringColor" stroke-width="1" stroke-dasharray="2 4"/>
      <line x1="278" y1="302" x2="384" y2="312" :stroke="bedColor" stroke-width="1" stroke-dasharray="2 4"/>
    </g>

    <!-- ==================== 左栏 01 · 呼吸 BR ==================== -->
    <g class="hc-chip" transform="translate(8, 172)">
      <rect x="0" y="0" width="86" height="40" rx="3" fill="rgba(5,22,44,0.5)"/>
      <text x="8" y="13" class="hc-tag" fill="#00ffcc">BR</text>
      <text x="29" y="13" class="hc-tag-sub" fill="rgba(150,244,255,0.6)">呼吸</text>
      <text x="8" y="32" class="hc-val" fill="#00ffcc">{{ br }}<tspan class="hc-unit"> /分</tspan></text>
      <g transform="translate(46, 27)">
        <path class="hc-sine" stroke="#00ffcc" :style="{ animationDuration: breatheCycle }" d="M2 0 Q 8 -7 14 0 T26 0 T38 0"/>
        <circle cx="56" cy="0" r="2.2" fill="#00ffcc">
          <animate attributeName="opacity" values="1;0.2;1" :dur="breatheCycle" repeatCount="indefinite"/>
        </circle>
      </g>
    </g>

    <!-- ==================== 左栏 02 · 体动 MOVE ==================== -->
    <g class="hc-chip" transform="translate(8, 296)">
      <rect x="0" y="0" width="86" height="40" rx="3" fill="rgba(5,22,44,0.5)"/>
      <text x="8" y="13" class="hc-tag" :fill="haloColor">MOVE</text>
      <text x="38" y="13" class="hc-tag-sub" fill="rgba(150,244,255,0.6)">体动</text>
      <text x="8" y="32" class="hc-val" :fill="haloColor">{{ movement }}</text>
      <g transform="translate(52, 30)">
        <rect v-for="n in 5" :key="n" :x="(n - 1) * 6" y="-5" width="3.5" :height="4 + n * 1.6"
          :fill="movement >= n * 5 ? haloColor : 'rgba(0,224,255,0.18)'" rx="1"/>
      </g>
    </g>

    <!-- ==================== 右栏 01 · 体温 TEMP ==================== -->
    <g class="hc-chip" transform="translate(384, 72)">
      <rect x="0" y="0" width="86" height="40" rx="3" fill="rgba(5,22,44,0.5)"/>
      <text x="8" y="13" class="hc-tag" :fill="heatColor">TEMP</text>
      <text x="38" y="13" class="hc-tag-sub" fill="rgba(150,244,255,0.6)">体温</text>
      <text x="8" y="32" class="hc-val" :fill="heatColor">{{ tpText }}<tspan class="hc-unit"> ℃</tspan></text>
      <g transform="translate(52, 30)">
        <rect x="0" y="0" width="26" height="4" rx="1" fill="rgba(255,150,0,0.15)"/>
        <rect x="1" y="1" :width="Math.min(24, Math.max(3, (props.tp - 35) * 8))" height="2"
          :fill="heatColor" rx="1">
          <animate attributeName="opacity" :values="`1;${(heatOpacity*0.4).toFixed(2)};1`" dur="3s" repeatCount="indefinite"/>
        </rect>
      </g>
    </g>

    <!-- ==================== 右栏 02 · 心率 HR ==================== -->
    <g class="hc-chip" transform="translate(384, 172)">
      <rect x="0" y="0" width="86" height="40" rx="3" fill="rgba(5,22,44,0.5)"/>
      <text x="8" y="13" class="hc-tag" :fill="ringColor">HR</text>
      <text x="24" y="13" class="hc-tag-sub" fill="rgba(150,244,255,0.6)">心率</text>
      <text x="8" y="32" class="hc-val" :fill="hrTextColor">{{ hr }}<tspan class="hc-unit"> bpm</tspan></text>
      <g transform="translate(50, 28)">
        <path class="hc-ecg" :stroke="ringColor" :style="{ animationDuration: heartCycle }" d="M2 0 h4 l2 -8 l3 14 l2 -10 l1 4 h5"/>
        <circle cx="56" cy="0" r="2.2" :fill="ringColor">
          <animate attributeName="r" values="2.2;5;2.2" :dur="heartCycle" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="1;0;1" :dur="heartCycle" repeatCount="indefinite"/>
        </circle>
      </g>
    </g>

    <!-- ==================== 右栏 03 · 在床/离床 BED ==================== -->
    <g class="hc-chip" transform="translate(384, 296)">
      <rect x="0" y="0" width="86" height="40" rx="3" fill="rgba(5,22,44,0.5)"/>
      <text x="8" y="13" class="hc-tag" :fill="bedColor">BED</text>
      <text x="28" y="13" class="hc-tag-sub" fill="rgba(150,244,255,0.6)">体位</text>
      <text x="8" y="32" class="hc-val" :fill="bedColor">{{ bedValText }}</text>
      <g transform="translate(52, 30)">
        <circle cx="0" cy="0" r="2.4" :fill="bedColor">
          <animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="9" cy="0" r="1.6" :fill="bedColor" opacity="0.45"/>
        <circle cx="18" cy="0" r="1.4" fill="rgba(0,224,255,0.25)"/>
      </g>
    </g>

    <!-- 底部状态脚注（非常轻） -->
    <text x="240" y="588" class="hc-foot" text-anchor="middle">{{ bedDesc1 }}</text>
  </svg>
</template>

<style scoped>
.s3-stage-svg-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}
.hc-chip rect {
  stroke: rgba(120, 236, 255, 0.3);
  stroke-width: 0.8;
}
.hc-tag {
  font-family: var(--font-digit, 'Orbitron', monospace);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
}
.hc-tag-sub {
  font-family: var(--font-mono, 'Share Tech Mono', monospace);
  font-size: 8px;
  letter-spacing: 0.4px;
}
.hc-val {
  font-family: var(--font-digit, 'Orbitron', monospace);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.hc-unit {
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  font-weight: 500;
  fill: #9fd8ec;
}
.hc-ecg, .hc-sine {
  fill: none;
  stroke-width: 1.3;
  stroke-linecap: round;
}
.hc-ecg { stroke-dasharray: 5 3; animation: hcO 1.1s linear infinite; }
.hc-sine { stroke-dasharray: 4 3; animation: hcO 1.6s linear infinite; }
@keyframes hcO { to { stroke-dashoffset: -16; } }
.hc-foot {
  font-family: var(--font-mono, monospace);
  font-size: 8.5px;
  letter-spacing: 1px;
  fill: rgba(150, 240, 255, 0.45);
}

@media (prefers-reduced-motion: reduce) {
  .hc-ecg, .hc-sine, .hc-chip animate { animation: none !important; }
}
</style>