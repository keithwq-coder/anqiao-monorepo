<script setup lang="ts">
import { computed } from 'vue'

// 医疗数字孪生监测舱 —— 「人体数据锚点」构图，非细线人形。
// 中央以医学扫描舱为底座，人体作为健康数据锚点；脑/肺/心/腹/骨骼分层渲染为
// 主视觉玻璃生物材质，支持点击下钻（select 事件）与 activeSystem 高亮。
// 状态语义严格医学分级：正常=医用青绿 · 关注=琥珀 · 异常=绯红。

const props = withDefaults(
  defineProps<{
    live?: boolean
    alert?: boolean
    heartCycle?: string
    breatheCycle?: string
    variant?: string
    activeSystem?: string // 'all' | 'neuro' | 'cardio' | 'resp' | 'temp' | 'skeleton'
  }>(),
  {
    live: true,
    alert: false,
    heartCycle: '0.85s',
    breatheCycle: '3.2s',
    variant: 'care',
    activeSystem: 'all',
  },
)

const emit = defineEmits<{ select: [system: string] }>()

// 医学分级色：正常青绿 / 关注琥珀 / 异常绯红
const oxy = computed(() => (props.alert ? '#ff3b6b' : '#00ffb0')) // 正常/异常主状态色
const mono = computed(() => (props.live ? '#00e0ff' : '#8aa3bd')) // 边缘描边（离线降为哑光蓝灰）
const sysColor = (sys: string) => (props.alert ? '#ff3b6b' : '#00ffb0')

const heartStyle = computed(() => ({ animationDuration: props.heartCycle }))
const breatheStyle = computed(() => ({ animationDuration: props.breatheCycle }))

// activeSystem 明确时，未选中系统整体淡出；'all'/'neuro'/'cardio'/'resp'/'temp'/'skeleton'
const isDim = (sys: string) => props.activeSystem !== 'all' && props.activeSystem !== sys

const organClass = (sys: string) => ({
  'mhf-organ': true,
  'mhf-dim': isDim(sys),
  'mhf-alert': props.alert,
})
const organLabelClass = (sys: string) => ({
  'mhf-label': true,
  'mhf-label-dim': isDim(sys),
  'mhf-label-active': props.activeSystem === sys,
})
function pick(sys: string) {
  emit('select', sys)
}
</script>

<template>
  <svg
    class="mhf-figure"
    :class="{ 'mhf-still': !live }"
    viewBox="0 0 480 600"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="医疗数字孪生监测舱 · 人体分层健康数据锚点"
  >
    <defs>
      <!-- 扫描舱玻璃底座：深靛蓝→医用青 生物材质 -->
      <radialGradient id="mhfCapsule" cx="50%" cy="46%" r="58%">
        <stop offset="0%" stop-color="#0e4ea8" stop-opacity="0.34"/>
        <stop offset="48%" stop-color="#081e5c" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#02061c" stop-opacity="0.04"/>
      </radialGradient>
      <linearGradient id="mhfGlass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1b6ef0" stop-opacity="0.26"/>
        <stop offset="38%" stop-color="#1235a0" stop-opacity="0.18"/>
        <stop offset="72%" stop-color="#06236e" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#021025" stop-opacity="0.06"/>
      </linearGradient>
      <linearGradient id="mhfGlassSheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#9be9ff" stop-opacity="0.34"/>
        <stop offset="40%" stop-color="#00c8ff" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#0038cc" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="mhfEdge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#b6f7ff" stop-opacity="0.95"/>
        <stop offset="45%" stop-color="#37e6ff" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#0a62ff" stop-opacity="0.32"/>
      </linearGradient>
      <!-- 器官材质 -->
      <radialGradient id="mhfBrainG" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stop-color="#7ef4ff" stop-opacity="0.5"/>
        <stop offset="70%" stop-color="#12a6ff" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#0630cc" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="mhfLungG" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="#8affd8" stop-opacity="0.5"/>
        <stop offset="70%" stop-color="#0fbf96" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#003d66" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="mhfHeartG" cx="50%" cy="42%" r="60%">
        <stop offset="0%" :stop-color="oxy" stop-opacity="0.9"/>
        <stop offset="60%" stop-color="#ff5a87" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#7a0f33" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="mhfAbdoG" cx="50%" cy="46%" r="56%">
        <stop offset="0%" stop-color="#5ef0ff" stop-opacity="0.38"/>
        <stop offset="70%" stop-color="#0a8fd6" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#0630a0" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="mhfSpineG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="45%" stop-color="#b9ecff" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#2ea8ff" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="mhfBoneG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#c9f4ff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#1f8cff" stop-opacity="0.22"/>
      </linearGradient>
      <radialGradient id="mhfForbid" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#5ef0ff" stop-opacity="0.4"/>
        <stop offset="70%" stop-color="#0a8fd6" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#0630a0" stop-opacity="0"/>
      </radialGradient>
      <filter id="mhf-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.6" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="mhf-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- ==================== 一、医学扫描舱 / 人体数据锚点底座 ==================== -->
    <g class="mhf-pod">
      <!-- 舱体玻璃容积 -->
      <ellipse cx="240" cy="302" rx="176" ry="236" fill="url(#mhfCapsule)" stroke="rgba(0,224,255,0.14)"/>
      <!-- 舱体外接框与基准刻度 -->
      <rect x="52" y="54" width="376" height="496" fill="none" stroke="rgba(0,224,255,0.16)" stroke-width="1"/>
      <rect x="68" y="70" width="344" height="464" fill="none" stroke="rgba(0,224,255,0.09)" stroke-dasharray="2 6"/>
      <g class="mhf-corner" fill="none">
        <path d="M52 82 V54 H82 M398 54 H428 V82 M428 518 V546 H398 M82 546 H52 V518" stroke="rgba(120,240,255,0.55)" stroke-width="1.6"/>
      </g>
      <!-- 舱体四角区编号 -->
      <g class="mhf-crosshair" stroke="rgba(120,240,255,0.4)" stroke-width="1">
        <circle cx="84" cy="92" r="5" fill="none"/><path d="M84 82 v20 M74 92 h20"/>
        <circle cx="396" cy="92" r="5" fill="none"/><path d="M396 82 v20 M386 92 h20"/>
        <circle cx="84" cy="512" r="5" fill="none"/><path d="M84 502 v20 M74 512 h20"/>
        <circle cx="396" cy="512" r="5" fill="none"/><path d="M396 502 v20 M386 512 h20"/>
      </g>
      <text x="62" y="48" class="mhf-zone" fill="rgba(150,244,255,0.6)">SCAN ZONE · 01</text>
      <text x="418" y="48" class="mhf-zone" text-anchor="end" fill="rgba(150,244,255,0.6)">MED-TWIN // 舱 02</text>

      <!-- CT 断层扫描环（ring）与切片刻度 -->
      <g class="mhf-ct">
        <ellipse cx="240" cy="120" rx="128" ry="30" fill="none" stroke="rgba(0,224,255,0.18)" stroke-width="1" stroke-dasharray="1 4"/>
        <ellipse cx="240" cy="210" rx="150" ry="34" fill="none" stroke="rgba(0,224,255,0.16)" stroke-width="1" stroke-dasharray="1 5"/>
        <ellipse cx="240" cy="300" rx="158" ry="36" fill="none" stroke="rgba(0,224,255,0.16)" stroke-width="1" stroke-dasharray="1 5"/>
        <ellipse cx="240" cy="392" rx="140" ry="32" fill="none" stroke="rgba(0,224,255,0.16)" stroke-width="1" stroke-dasharray="1 5"/>
        <ellipse cx="240" cy="478" rx="108" ry="26" fill="none" stroke="rgba(0,224,255,0.14)" stroke-width="1" stroke-dasharray="1 4"/>
        <!-- 切片编号 -->
        <text x="376" y="116" class="mhf-sl" fill="rgba(140,240,255,0.55)">SL 010</text>
        <text x="386" y="206" class="mhf-sl" fill="rgba(140,240,255,0.55)">SL 018</text>
        <text x="60" y="296" class="mhf-sl" fill="rgba(140,240,255,0.55)">SL 026</text>
        <text x="374" y="388" class="mhf-sl" fill="rgba(140,240,255,0.55)">SL 034</text>
        <text x="322" y="474" class="mhf-sl" fill="rgba(140,240,255,0.55)">SL 042</text>
      </g>

      <!-- 生命体征轨道：围绕胸腔的遥测环 -->
      <g class="mhf-vital-orbit">
        <ellipse cx="234" cy="180" rx="96" ry="34" fill="none" stroke="rgba(0,224,255,0.28)" stroke-width="1" transform="rotate(-16 234 180)" stroke-dasharray="3 6"/>
        <g transform="rotate(-16 234 180)">
          <circle v-for="t in 10" :key="t" :cx="234 + Math.cos((t / 10) * Math.PI * 2) * 96" :cy="180 + Math.sin((t / 10) * Math.PI * 2) * 34" r="1.5" fill="#0ff"/>
        </g>
        <circle class="mhf-orbit-dot" cx="234" cy="180" r="2.6" fill="#bff" filter="url(#mhf-glow)"/>
      </g>
    </g>

    <!-- ==================== 二、人体玻璃容积（生物材质主视觉） ==================== -->
    <g class="mhf-body">
      <!-- 内部核心微光 -->
      <ellipse cx="240" cy="210" rx="64" ry="150" fill="url(#mhfForbid)"/>
      <!-- 体积：头+躯干+四肢 分层半透明 -->
      <path fill="url(#mhfGlass)" stroke="url(#mhfEdge)" stroke-width="1.8" d="M240 46
        C 256 46, 268 57, 268 75 C 268 90, 261 105, 252 116
        C 250 121, 248 126, 248 132 C 249 137, 252 141, 258 144
        C 274 146, 296 150, 314 156 C 311 170, 303 190, 297 205
        C 293 224, 290 243, 289 262 C 289 276, 293 291, 298 303
        C 305 317, 302 329, 297 343 C 293 366, 290 398, 289 428
        C 288 444, 288 456, 289 463 C 289 480, 286 500, 280 518
        C 278 527, 280 536, 283 544 C 274 545, 262 545, 254 543
        C 256 535, 259 525, 260 516 C 261 501, 259 481, 258 461
        C 257 444, 256 427, 256 413 C 257 392, 254 356, 250 326
        C 247 309, 243 296, 240 290 C 237 296, 233 309, 230 326
        C 226 356, 223 392, 224 413 C 224 427, 223 444, 222 461
        C 221 481, 219 501, 220 516 C 221 525, 224 535, 226 543
        C 218 545, 206 545, 197 544
        C 200 536, 202 527, 200 518 C 197 500, 192 480, 191 463
        C 192 456, 192 444, 191 428 C 190 398, 187 366, 183 343
        C 178 329, 175 317, 182 303 C 177 291, 181 276, 190 262
        C 189 243, 186 224, 183 205 C 177 190, 169 170, 166 156
        C 184 150, 206 146, 222 144 C 228 141, 231 137, 232 132
        C 232 126, 230 121, 228 116 C 219 105, 212 90, 212 75 C 212 57, 224 46, 240 46 Z"/>
      <path fill="url(#mhfGlass)" stroke="url(#mhfEdge)" stroke-width="1.5" d="M166 156
        C 152 164, 143 179, 143 198 C 143 221, 147 241, 152 260
        C 155 280, 158 304, 160 330 C 162 340, 164 346, 168 348
        C 172 348, 175 342, 175 326 C 175 300, 172 270, 169 244
        C 167 222, 167 200, 174 182 C 170 172, 168 163, 166 156 Z"/>
      <path fill="url(#mhfGlass)" stroke="url(#mhfEdge)" stroke-width="1.5" d="M314 156
        C 328 164, 337 179, 337 198 C 337 221, 333 241, 328 260
        C 325 280, 322 304, 320 330 C 318 340, 316 346, 312 348
        C 308 348, 305 342, 305 326 C 305 300, 308 270, 311 244
        C 313 222, 313 200, 306 182 C 310 172, 312 163, 314 156 Z"/>
      <!-- 玻璃材质高光层 -->
      <path d="M222 92 C 240 108, 252 132, 252 168 C 252 182, 250 214, 247 246 L 236 150 Z" fill="url(#mhfGlassSheen)"/>
      <g class="mhf-flowlines" stroke="rgba(180,246,255,0.16)" stroke-width="1" fill="none">
        <path d="M208 240 C 216 268, 224 288, 236 292"/>
        <path d="M262 240 C 255 268, 250 288, 242 292"/>
      </g>
      <!-- 区域编号标签（仪器语言） -->
      <text x="150" y="180" class="mhf-sl" fill="rgba(140,240,255,0.4)">R·01 头</text>
      <text x="150" y="336" class="mhf-sl" fill="rgba(140,240,255,0.4)">R·02 胸</text>
      <text x="150" y="404" class="mhf-sl" fill="rgba(140,240,255,0.4)">R·03 腹</text>
      <text x="312" y="420" class="mhf-sl" fill="rgba(140,240,255,0.4)">R·04 下肢</text>
    </g>

    <!-- ==================== 三、骨骼系统（脊柱/肋架/骨盆） ==================== -->
    <g class="mhf-skeleton" :class="organClass('skeleton')" role="button" tabindex="0" @click="pick('skeleton')" @keyup.enter="pick('skeleton')">
      <!-- 脊柱 -->
      <line x1="240" y1="118" x2="240" y2="312" stroke="url(#mhfSpineG)" stroke-width="2" stroke-linecap="round"/>
      <g fill="none" stroke="rgba(185,236,255,0.5)" stroke-width="1">
        <circle v-for="v in [128,140,152,164,178,192,206,220,234,248,262,276,290,304]" :key="v" :cy="v" cx="240" r="3"/>
      </g>
      <!-- 肋架 -->
      <g fill="none" stroke="url(#mhfBoneG)" stroke-width="1.5" stroke-linecap="round">
        <path d="M240 174 Q 214 168 196 178 L 190 196 Q 214 188 240 190"/>
        <path d="M240 174 Q 266 168 284 178 L 290 196 Q 266 188 240 190"/>
        <path d="M240 190 Q 210 184 190 196 L 186 216 Q 208 208 240 210"/>
        <path d="M240 190 Q 270 184 290 196 L 294 216 Q 272 208 240 210"/>
        <path d="M240 208 Q 210 202 192 214 L 190 234 Q 208 226 240 228"/>
        <path d="M240 208 Q 270 202 288 214 L 290 234 Q 272 226 240 228"/>
      </g>
      <!-- 骨盆 -->
      <path d="M240 306 C 222 300, 206 308, 200 322 C 206 336, 220 340, 240 336 M240 306 C 258 300, 274 308, 280 322 C 274 336, 260 340, 240 336" fill="none" stroke="url(#mhfSpineG)" stroke-width="1.6" stroke-linecap="round"/>
      <!-- 锁骨 / 关节位点 -->
      <path d="M180 148 L 300 148" stroke="url(#mhfBoneG)" stroke-width="1.4"/>
      <g fill="#c9f4ff" opacity="0.85">
        <circle cx="180" cy="150" r="3"/><circle cx="300" cy="150" r="3"/>
        <circle cx="240" cy="316" r="3.2"/>
      </g>
    </g>

    <!-- ==================== 四、脑系统（可点选，下钻 neuro） ==================== -->
    <g class="mhf-brain" :class="organClass('neuro')" role="button" tabindex="0" @click="pick('neuro')" @keyup.enter="pick('neuro')">
      <path d="M226 62 Q 240 47 254 62 Q 266 75 258 96 Q 250 106 240 104 Q 230 106 222 96 Q 214 75 226 62 Z" fill="url(#mhfBrainG)" stroke="#aaf6ff" stroke-width="1.6" filter="url(#mhf-soft)"/>
      <!-- 大脑沟回 -->
      <g fill="none" stroke="rgba(220,250,255,0.6)" stroke-width="0.9">
        <path d="M226 70 Q 234 63 242 69 Q 250 63 254 70"/>
        <path d="M222 84 Q 232 78 240 86 Q 248 78 258 84"/>
        <path d="M230 94 Q 235 98 240 94 Q 245 98 250 94"/>
      </g>
      <path d="M240 50 Q 240 104 240 104" stroke="rgba(140,240,255,0.4)" stroke-width="1" fill="none"/>
      <!-- 神经放电节点 -->
      <g fill="#aaf6ff">
        <circle cx="234" cy="72" r="1.6" class="mhf-neuron"/>
        <circle cx="247" cy="80" r="1.5" class="mhf-neuron d2"/>
        <circle cx="230" cy="88" r="1.4" class="mhf-neuron d3"/>
      </g>
    </g>

    <!-- ==================== 五、肺系统 + 气管（呼吸联动，可点选 resp） ==================== -->
    <g class="mhf-lungs" :class="organClass('resp')" role="button" tabindex="0" @click="pick('resp')" @keyup.enter="pick('resp')">
      <!-- 气管分叉 -->
      <g class="mhf-trachea" fill="none" stroke="#8affd8" stroke-width="1.6" :style="breatheStyle">
        <path d="M240 138 V156 M240 156 Q 232 164 230 172 M240 156 Q 248 164 250 172"/>
      </g>
      <g :style="breatheStyle">
        <path fill="url(#mhfLungG)" stroke="#7af5cd" stroke-width="1.5" d="M218 156 C 196 150, 188 176, 194 202 C 200 220, 226 218, 234 198 C 240 182, 240 160, 218 156 Z"/>
        <path fill="url(#mhfLungG)" stroke="#7af5cd" stroke-width="1.5" d="M262 156 C 284 150, 292 176, 286 202 C 280 220, 254 218, 246 198 C 240 182, 240 160, 262 156 Z"/>
        <!-- 肺内气道分支 -->
        <g fill="none" stroke="rgba(180,255,220,0.5)" stroke-width="0.8">
          <path d="M216 174 Q 206 178 202 190"/>
          <path d="M220 184 Q 210 190 208 200"/>
          <path d="M224 170 Q 214 166 210 158"/>
          <path d="M264 174 Q 274 178 278 190"/>
          <path d="M260 184 Q 270 190 272 200"/>
        </g>
      </g>
    </g>

    <!-- ==================== 六、心脏系统 + 动脉（搏动联动，可点选 cardio） ==================== -->
    <g class="mhf-heart" :class="organClass('cardio')" role="button" tabindex="0" @click="pick('cardio')" @keyup.enter="pick('cardio')">
      <!-- 主动脉弓 -->
      <path d="M254 176 C 254 164, 252 156, 248 148 C 244 142, 236 140, 228 142 C 222 144, 214 150, 210 158" fill="none" stroke="#ff8fb3" stroke-width="1.6" stroke-linecap="round" :style="heartStyle"/>
      <g :style="heartStyle">
        <path d="M252 202 C 242 194, 236 184, 238 174 C 240 166, 246 162, 252 166 C 258 162, 264 166, 266 174 C 268 184, 262 194, 252 202 Z" fill="url(#mhfHeartG)" stroke="#ffd0e0" stroke-width="1.6" filter="url(#mhf-glow)"/>
      </g>
      <!-- 窦房结起搏 -->
      <circle cx="252" cy="182" r="2.4" fill="#fff" filter="url(#mhf-glow)"/>
      <!-- 心电节律微线 -->
      <path class="mhf-ecg" d="M252 174 v4 l2 2 1 -6 1 8 1 -5 1 3 h2" fill="none" stroke="#ffd0e0" stroke-width="1.1" :style="heartStyle"/>
    </g>

    <!-- ==================== 七、腹部系统（肝/胃，可点选 temp） ==================== -->
    <g class="mhf-abdo" :class="organClass('temp')" role="button" tabindex="0" @click="pick('temp')" @keyup.enter="pick('temp')">
      <!-- 肝脏（右侧） -->
      <path d="M252 252 C 268 248, 278 258, 276 272 C 274 284, 260 288, 250 282 C 244 276, 246 258, 252 252 Z" fill="url(#mhfAbdoG)" stroke="#6eefff" stroke-width="1.5"/>
      <!-- 胃（左侧） -->
      <path d="M228 250 C 216 254, 212 268, 220 280 C 228 290, 240 286, 242 274 C 244 260, 238 250, 228 250 Z" fill="url(#mhfForbid)" stroke="#6eefff" stroke-width="1.4"/>
      <!-- 肠管环形示意 -->
      <g fill="none" stroke="rgba(150,240,255,0.55)" stroke-width="1">
        <path d="M236 296 Q 232 302 236 308 Q 240 314 244 308 Q 248 302 244 296"/>
        <path d="M232 312 Q 228 318 232 324 Q 236 330 240 324"/>
      </g>
      <circle cx="258" cy="266" r="2.2" fill="#9beeff"/>
    </g>

    <!-- ==================== 八、器官标签引线 + 区域编号 ==================== -->
    <g class="mhf-leaders" fill="none">
      <!-- BRAIN → 左上 -->
      <g>
        <path d="M226 66 L 150 40 L 96 40" stroke="rgba(140,240,255,0.55)" stroke-width="1"/>
        <circle cx="226" cy="66" r="2.4" fill="#aaf6ff"/>
        <text x="90" y="37" class="mhf-label" :class="organLabelClass('neuro')">BRAIN // 01</text>
      </g>
      <!-- LUNGS → 左中 -->
      <g>
        <path d="M212 176 L 150 208 L 96 208" stroke="rgba(140,240,255,0.55)" stroke-width="1"/>
        <circle cx="212" cy="176" r="2.4" fill="#7af5cd"/>
        <text x="90" y="204" class="mhf-label" :class="organLabelClass('resp')">LUNGS // 02</text>
      </g>
      <!-- HEART → 右中 -->
      <g>
        <path d="M266 180 L 350 148 L 384 148" stroke="rgba(255,140,180,0.6)" stroke-width="1"/>
        <circle cx="266" cy="180" r="2.4" fill="#ffd0e0"/>
        <text x="390" y="145" class="mhf-label" :class="organLabelClass('cardio')">HEART // 03</text>
      </g>
      <!-- ABDOMEN → 左中下 -->
      <g>
        <path d="M220 258 L 150 256 L 96 256" stroke="rgba(140,240,255,0.55)" stroke-width="1"/>
        <circle cx="220" cy="258" r="2.4" fill="#6eefff"/>
        <text x="90" y="252" class="mhf-label" :class="organLabelClass('temp')">ABDOMEN // 04</text>
      </g>
      <!-- SPINE → 右中下 -->
      <g>
        <path d="M244 304 L 344 320 L 384 320" stroke="rgba(140,240,255,0.55)" stroke-width="1"/>
        <circle cx="244" cy="304" r="2.4" fill="#c9f4ff"/>
        <text x="390" y="316" class="mhf-label" :class="organLabelClass('skeleton')">SPINE // 05</text>
      </g>
    </g>

    <!-- ==================== 九、扫描进给条 + 状态轨道 ==================== -->
    <g class="mhf-scanfeed" fill="none" stroke="rgba(0,224,255,0.4)" stroke-width="1">
      <path d="M52 96 H42 M52 116 H42 M52 136 H42"/>
      <path d="M438 96 H438 M438 116 H438 M438 136 H438"/>
    </g>
    <line class="mhf-scanline" x1="120" y1="0" x2="360" y2="0" stroke="rgba(0,224,255,0.5)" stroke-width="1.4" filter="url(#mhf-glow)"/>
  </svg>
</template>

<style scoped>
.mhf-figure {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  overflow: visible;
  filter: drop-shadow(0 0 14px rgba(30, 140, 255, 0.35));
}
/* 交互器官：接收事件；非器官区域保留穿透 */
.mhf-organ {
  pointer-events: all;
  cursor: pointer;
  transition: opacity 0.35s ease, filter 0.35s ease;
}
.mhf-organ:hover {
  filter: drop-shadow(0 0 10px rgba(0, 255, 200, 0.55));
}
.mhf-organ:focus-visible {
  outline: none;
  filter: drop-shadow(0 0 12px #00ffcc);
}
.mhf-dim {
  opacity: 0.28;
}
.mhf-alert .mhf-neuron,
.mhf-alert .mhf-heart path {
  animation: none;
}
.mhf-heart { pointer-events: all; }
.mhf-lungs { pointer-events: all; }
.mhf-brain { pointer-events: all; }
.mhf-abdo { pointer-events: all; }
.mhf-skeleton { pointer-events: all; }

/* 标签引线文本 */
.mhf-label {
  font-family: var(--font-digit, 'Orbitron', monospace);
  font-size: 10px;
  letter-spacing: 0.6px;
  fill: #aef2ff;
  filter: drop-shadow(0 0 5px rgba(0, 224, 255, 0.4));
  transition: fill 0.3s ease, opacity 0.3s ease;
}
.mhf-label-dim { opacity: 0.35; }
.mhf-label-active {
  fill: #ffffff;
  filter: drop-shadow(0 0 8px rgba(0, 255, 200, 0.9));
}
.mhf-zone { font-family: var(--font-mono, 'Share Tech Mono', monospace); font-size: 9px; letter-spacing: 1px; }
.mhf-sl { font-family: var(--font-mono, 'Share Tech Mono', monospace); font-size: 8px; letter-spacing: 0.8px; }

/* 动效 */
.mhf-heart { transform-origin: 252px 182px; animation: mhfPulse 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; }
@keyframes mhfPulse {
  0% { transform: scale(1); }
  14% { transform: scale(1.16); }
  30% { transform: scale(0.98); }
  44% { transform: scale(1.08); }
  60%, 100% { transform: scale(1); }
}
.mhf-lungs { transform-origin: 240px 178px; animation: mhfBreathe 3.2s ease-in-out infinite; }
@keyframes mhfBreathe {
  0%, 100% { transform: scale(0.97); opacity: 0.55; }
  50% { transform: scale(1.07); opacity: 1; }
}
.mhf-trachea, .mhf-lungs > g { transform-origin: 240px 178px; }
.mhf-ecg { stroke-dasharray: 4 3; animation: mhfEcg 1.1s linear infinite; }
@keyframes mhfEcg { to { stroke-dashoffset: -14; } }
.mhf-neuron { animation: mhfNeuron 2.6s ease-in-out infinite; }
.mhf-neuron.d2 { animation-delay: 0.7s; }
.mhf-neuron.d3 { animation-delay: 1.4s; }
@keyframes mhfNeuron {
  0%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}
.mhf-orbit-dot { animation: mhfOrbit 8s linear infinite; }
@keyframes mhfOrbit { to { transform: rotate(360deg); } }
.mhf-scanline { animation: mhfScan 4.6s linear infinite; }
@keyframes mhfScan { from { transform: translateY(-40px); } to { transform: translateY(600px); } }

/* 离线哑光 */
.mhf-still .mhf-heart { animation: none; }
.mhf-still .mhf-lungs, .mhf-still .mhf-trachea { animation: none; opacity: 0.45; }
.mhf-still .mhf-pod .mhf-dot { animation: none; }
.mhf-still .mhf-scanline, .mhf-still .mhf-orbit-dot { animation: none; }

@media (prefers-reduced-motion: reduce) {
  .mhf-figure .mhf-heart,
  .mhf-figure .mhf-lungs,
  .mhf-figure .mhf-trachea,
  .mhf-figure .mhf-ecg,
  .mhf-figure .mhf-neuron,
  .mhf-figure .mhf-orbit-dot,
  .mhf-figure .mhf-scanline {
    animation: none !important;
  }
}
</style>