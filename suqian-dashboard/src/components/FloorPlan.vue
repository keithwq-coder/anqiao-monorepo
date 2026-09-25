<script setup lang="ts">
import type { Patient, PatientLocation } from '../api/types'

export interface PlanBed {
  id: string
  bedCode: string
  x: number
  y: number
  w: number
  h: number
  patient: Patient | null
  isVacant: boolean
  location: PatientLocation
  fallLive: boolean
}

export interface PlanRoom {
  id: string
  x: number
  y: number
  w: number
  h: number
  wing: 'north' | 'south'
  beds: PlanBed[]
  bathX: number
  bathY: number
  bathW: number
  bathH: number
  bathCx: number
  bathCy: number
  hasFallInBath: boolean
  roomLabel?: string
  roomType?: string
}

const props = withDefaults(
  defineProps<{
    rooms: PlanRoom[]
    floor: string
    nurseStation: { x: number; y: number; w: number; h: number }
    wandererOut: boolean
    centerStationName?: string
    centerStationSub?: string
  }>(),
  {
    centerStationName: '中央护士站',
    centerStationSub: '24H ACTIVE · 值守中',
  }
)

const emit = defineEmits<{
  (e: 'bed-enter', bed: PlanBed, el: Element): void
  (e: 'bed-leave'): void
  (e: 'bed-click', bed: PlanBed): void
}>()

function awayTag(bed: PlanBed): string {
  switch (bed.location) {
    case 'rehab_room': return '康复排班中'
    case 'activity_room': return '公区活动中'
    case 'dining_room': return '就餐晨练中'
    case 'bathroom': return '卫浴协助中'
    default: return '离床未归'
  }
}

function bedState(bed: PlanBed) {
  if (bed.isVacant || !bed.patient) {
    return { stroke: 'rgba(148,163,184,0.35)', fill: 'rgba(148,163,184,0.04)', anim: '', label: '空置备用', nameSize: '10' }
  }
  const p = bed.patient
  if (bed.fallLive) {
    return { stroke: 'rgba(255,0,85,0.6)', fill: 'rgba(255,0,85,0.12)', anim: '', label: p.name, nameSize: '13' }
  }
  if (!p.vitals?.in_bed) {
    return { stroke: '#ffb703', fill: 'rgba(255,183,3,0.16)', anim: 'bed-warn-anim', label: p.name, nameSize: '13' }
  }
  if (p.abnormal) {
    return { stroke: '#ffb703', fill: 'rgba(255,183,3,0.25)', anim: 'bed-warn-anim', label: p.name, nameSize: '13' }
  }
  return { stroke: '#00ff88', fill: 'rgba(0,255,136,0.14)', anim: 'bed-breathe-anim', label: p.name, nameSize: '13' }
}

function dotColor(bed: PlanBed): string {
  if (bed.isVacant || !bed.patient) return '#64748b'
  if (bed.fallLive) return '#ff0055'
  if (!bed.patient?.vitals?.in_bed) return '#ffb703'
  return '#00ff88'
}

function dotDur(bed: PlanBed): string {
  return bed.fallLive ? '0.5s' : '1.8s'
}
</script>

<template>
<svg class="floor-svg-layer" id="floor-cad-svg" viewBox="0 0 740 690" preserveAspectRatio="none">
  <defs>
    <radialGradient id="nurseRadarGrad" cx="0%" cy="50%" r="100%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#00f0ff" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#00f0ff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="14" y="266" width="712" height="158" fill="rgba(6,16,32,0.52)" stroke="rgba(0,240,255,0.25)" stroke-width="1.2" stroke-dasharray="6 4" rx="4"/>
  <line x1="16" y1="300" x2="724" y2="300" stroke="rgba(0,240,255,0.12)" stroke-width="0.8" stroke-dasharray="4 4"/>
  <line x1="16" y1="390" x2="724" y2="390" stroke="rgba(0,240,255,0.12)" stroke-width="0.8" stroke-dasharray="4 4"/>
  <line x1="16" y1="345" x2="724" y2="345" stroke="rgba(0,255,136,0.38)" stroke-width="1.6" stroke-dasharray="14 10" class="corridor-patrol-line"/>

  <g>
    <rect x="5" y="280" width="9" height="130" fill="rgba(0,240,255,0.15)" stroke="rgba(0,240,255,0.4)" rx="2"/>
    <text x="9.5" y="345" fill="#00f0ff" font-size="8" font-family="'Noto Sans SC'" writing-mode="vertical-rl" text-anchor="middle" letter-spacing="2">医梯通廊</text>
    <rect x="726" y="280" width="9" height="130" fill="rgba(0,240,255,0.15)" stroke="rgba(0,240,255,0.4)" rx="2"/>
    <text x="730.5" y="345" fill="#00f0ff" font-size="8" font-family="'Noto Sans SC'" writing-mode="vertical-rl" text-anchor="middle" letter-spacing="2">污洗备餐</text>
  </g>

  <template v-if="floor === '3F'">
    <line x1="28" y1="302" x2="28" y2="388" stroke="#ffb703" stroke-width="2.5" stroke-dasharray="4 3"/>
    <text x="32" y="345" fill="#ffb703" font-size="8.5" font-family="'Noto Sans SC'" font-weight="700" writing-mode="vertical-rl" text-anchor="middle">防走失围栏</text>
    <line x1="712" y1="302" x2="712" y2="388" stroke="#ffb703" stroke-width="2.5" stroke-dasharray="4 3"/>
    <text x="716" y="345" fill="#ffb703" font-size="8.5" font-family="'Noto Sans SC'" font-weight="700" writing-mode="vertical-rl" text-anchor="middle">防走失围栏</text>
    <template v-if="wandererOut">
      <path d="M 180 150 L 180 280 Q 220 345 320 345" fill="none" stroke="#ffb703" stroke-width="2" stroke-dasharray="6 4" class="wander-stream-line"/>
      <circle cx="320" cy="345" r="4.5" fill="#ffb703" filter="drop-shadow(0 0 8px #ffb703)">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="320" y="335" fill="#ffb703" font-size="9" font-family="'Noto Sans SC'" font-weight="700" text-anchor="middle">302-B王* 走廊茶水间寻踪中</text>
    </template>
  </template>

  <g>
    <circle :cx="nurseStation.x" :cy="nurseStation.y" r="28" fill="none" stroke="#00f0ff" class="nurse-sonar-1" pointer-events="none"/>
    <circle :cx="nurseStation.x" :cy="nurseStation.y" r="28" fill="none" stroke="#00ff88" class="nurse-sonar-2" pointer-events="none"/>
    <circle :cx="nurseStation.x" :cy="nurseStation.y" r="28" fill="none" stroke="#00f0ff" class="nurse-sonar-3" pointer-events="none"/>

    <g class="radar-sweep-beam" pointer-events="none">
      <path :d="`M ${nurseStation.x} ${nurseStation.y} L ${nurseStation.x + 138} ${nurseStation.y - 34} A 142 142 0 0 1 ${nurseStation.x + 138} ${nurseStation.y + 34} Z`" fill="url(#nurseRadarGrad)"/>
    </g>

    <g :transform="`translate(${nurseStation.x}, ${nurseStation.y})`">
      <polygon points="-68,-22 68,-22 78,0 68,22 -68,22 -78,0" fill="rgba(5,14,30,0.96)" stroke="#00f0ff" stroke-width="2.2" filter="drop-shadow(0 0 10px rgba(0,240,255,0.45))"/>
      <g class="nurse-cross-pulse" transform="translate(0, -6)">
        <path d="M -6 -10 L 6 -10 L 6 -6 L 10 -6 L 10 6 L 6 6 L 6 10 L -6 10 L -6 6 L -10 6 L -10 -6 L -6 -6 Z" fill="rgba(0,255,136,0.5)" stroke="#00ff88" stroke-width="1.6"/>
      </g>
      <text x="0" y="8" fill="#ffffff" font-size="12.5" font-family="'Noto Sans SC', sans-serif" font-weight="900" text-anchor="middle" letter-spacing="1">{{ centerStationName }}</text>
      <text x="0" y="18" fill="#00ff88" font-size="8" font-family="Orbitron" font-weight="700" text-anchor="middle">{{ centerStationSub }}</text>
    </g>
  </g>

  <g v-for="rm in rooms" :key="rm.id">
    <rect :x="rm.x" :y="rm.y" :width="rm.w" :height="rm.h" fill="rgba(6,16,30,0.48)" stroke="rgba(0,240,255,0.30)" stroke-width="1.2" rx="4"/>
    <rect :x="rm.x" :y="rm.y" width="56" height="18" fill="rgba(0,240,255,0.24)" rx="3"/>
    <text :x="rm.x + 28" :y="rm.y + 13" fill="#00f0ff" font-size="10" font-family="'Noto Sans SC', Orbitron" font-weight="700" text-anchor="middle">{{ rm.roomLabel || rm.id }}</text>
    <text :x="rm.x + rm.w - 8" :y="rm.y + 13" fill="rgba(0,240,255,0.75)" font-size="9" font-family="'Noto Sans SC'" text-anchor="end">{{ rm.roomType || (rm.beds.length === 1 ? '单人监护' : '双人监护') }}</text>

    <rect :x="rm.bathX" :y="rm.bathY" :width="rm.bathW" :height="rm.bathH"
      :fill="rm.hasFallInBath ? 'rgba(255,0,85,0.25)' : 'rgba(0,240,255,0.03)'"
      :stroke="rm.hasFallInBath ? '#ff0055' : 'rgba(0,240,255,0.25)'"
      :stroke-width="rm.hasFallInBath ? '1.8' : '1'"
      :stroke-dasharray="rm.hasFallInBath ? 'none' : '3 2'" rx="2"/>
    <text :x="rm.bathCx" :y="rm.bathCy + 3" :fill="rm.hasFallInBath ? '#ff0055' : 'rgba(148,163,184,0.75)'" font-size="8.5" font-family="'Noto Sans SC'" :font-weight="rm.hasFallInBath ? '900' : 'normal'" text-anchor="middle">卫浴·扶手</text>

    <template v-if="rm.hasFallInBath">
      <circle :cx="rm.bathCx" :cy="rm.bathCy" r="14" fill="none" stroke="#ff0055" class="shockwave-ring-1" pointer-events="none"/>
      <circle :cx="rm.bathCx" :cy="rm.bathCy" r="14" fill="none" stroke="#ff0055" class="shockwave-ring-2" pointer-events="none"/>
      <g :transform="`translate(${rm.bathX - 10}, ${rm.bathY - 18})`" pointer-events="none">
        <rect width="62" height="15" fill="#ff0055" rx="3">
          <animate attributeName="opacity" values="1;0.4;1" dur="0.8s" repeatCount="indefinite"/>
        </rect>
        <text x="31" y="11" fill="#ffffff" font-size="8.5" font-family="'Noto Sans SC'" font-weight="900" text-anchor="middle">⚠️卫浴跌倒</text>
      </g>
      <line :x1="nurseStation.x" :y1="nurseStation.y - 12" :x2="rm.bathCx" :y2="rm.bathCy" stroke="#ff0055" stroke-width="2.2" stroke-dasharray="6 4" class="dispatch-stream-line" pointer-events="none"/>
      <circle :cx="nurseStation.x" :cy="nurseStation.y - 12" r="3.5" fill="#ffffff" filter="drop-shadow(0 0 6px #ff0055)" pointer-events="none">
        <animate attributeName="cx" :values="`${nurseStation.x};${rm.bathCx}`" dur="1.0s" repeatCount="indefinite"/>
        <animate attributeName="cy" :values="`${nurseStation.y - 12};${rm.bathCy}`" dur="1.0s" repeatCount="indefinite"/>
      </circle>
    </template>

    <template v-if="rm.wing === 'north'">
      <line :x1="rm.x + rm.w - 34" :y1="rm.y + rm.h" :x2="rm.x + rm.w - 6" :y2="rm.y + rm.h" stroke="rgba(6,16,30,1)" stroke-width="3.5"/>
      <path :d="`M ${rm.x + rm.w - 34} ${rm.y + rm.h} A 26 26 0 0 0 ${rm.x + rm.w - 6} ${rm.y + rm.h - 26}`" fill="none" stroke="rgba(0,240,255,0.4)" stroke-dasharray="2 2" stroke-width="1"/>
    </template>
    <template v-else>
      <line :x1="rm.x + rm.w - 34" :y1="rm.y" :x2="rm.x + rm.w - 6" :y2="rm.y" stroke="rgba(6,16,30,1)" stroke-width="3.5"/>
      <path :d="`M ${rm.x + rm.w - 34} ${rm.y} A 26 26 0 0 1 ${rm.x + rm.w - 6} ${rm.y + 26}`" fill="none" stroke="rgba(0,240,255,0.4)" stroke-dasharray="2 2" stroke-width="1"/>
    </template>

    <g v-for="bed in rm.beds" :key="bed.bedCode" class="cad-interactive-bed"
      @mouseenter="emit('bed-enter', bed, $event.currentTarget as Element)"
      @mouseleave="emit('bed-leave')"
      @click="emit('bed-click', bed)">
      <template v-if="bed.fallLive">
        <g :transform="`translate(${bed.x - 1}, ${bed.y - 14})`" pointer-events="none">
          <rect :width="bed.w + 2" height="12" fill="rgba(255,0,85,0.85)" rx="2"/>
          <text :x="(bed.w + 2) / 2" y="9" fill="#ffffff" font-size="7.5" font-family="'Noto Sans SC'" font-weight="900" text-anchor="middle">床位无人·卫浴中</text>
        </g>
        <line :x1="bed.x + bed.w / 2" :y1="bed.y + bed.h" :x2="rm.bathCx" :y2="rm.bathCy" stroke="#ff0055" stroke-dasharray="3 3" stroke-width="1.2" pointer-events="none"/>
      </template>
      <template v-else-if="!bed.isVacant && bed.patient && !bed.patient.vitals.in_bed">
        <g :transform="`translate(${bed.x - 1}, ${bed.y - 14})`" pointer-events="none">
          <rect :width="bed.w + 2" height="12" fill="rgba(255,183,3,0.85)" rx="2"/>
          <text :x="(bed.w + 2) / 2" y="9" fill="#000000" font-size="7.5" font-family="'Noto Sans SC'" font-weight="900" text-anchor="middle">{{ awayTag(bed) }}</text>
        </g>
      </template>
      <template v-else-if="!bed.isVacant && bed.patient && bed.patient.abnormal">
        <g :transform="`translate(${bed.x + bed.w - 14}, ${bed.y - 6})`" pointer-events="none">
          <circle cx="6" cy="6" r="5.5" fill="#ffb703"/>
          <text x="6" y="8.5" fill="#000000" font-size="7.5" font-weight="900" text-anchor="middle">!</text>
        </g>
      </template>

      <rect :class="bedState(bed).anim" :x="bed.x" :y="bed.y" :width="bed.w" :height="bed.h"
        :fill="bedState(bed).fill" :stroke="bedState(bed).stroke"
        :stroke-width="bed.isVacant ? 1 : 1.6" :stroke-dasharray="bed.isVacant ? '4 3' : 'none'" rx="4"/>
      <rect :x="bed.x + 4" :y="bed.y + 3" :width="bed.w - 8" height="4" :fill="bed.isVacant ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)'" rx="1"/>
      <rect :x="bed.x + 7" :y="bed.y + 9" :width="bed.w - 14" height="14" :fill="bed.isVacant ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.40)'" rx="3.5"/>
      <line :x1="bed.x + 4" :y1="bed.y + 26" :x2="bed.x + bed.w - 4" :y2="bed.y + 26" :stroke="bedState(bed).stroke" stroke-width="1.2" opacity="0.65"/>

      <circle :cx="bed.x + bed.w - 6" :cy="bed.y + 9" r="2.4" :fill="dotColor(bed)">
        <animate attributeName="opacity" values="1;0.2;1" :dur="dotDur(bed)" repeatCount="indefinite"/>
      </circle>

      <text :x="bed.x + bed.w / 2" :y="bed.y + 47" :fill="bed.isVacant ? '#64748b' : '#ffffff'" :font-size="bedState(bed).nameSize" font-family="'Noto Sans SC', sans-serif" font-weight="700" text-anchor="middle">{{ bedState(bed).label }}</text>
      <text :x="bed.x + bed.w / 2" :y="bed.y + 65" :fill="bedState(bed).stroke" font-size="10" font-family="Orbitron" font-weight="700" text-anchor="middle">{{ bed.bedCode }}</text>
    </g>
  </g>
</svg>
</template>
