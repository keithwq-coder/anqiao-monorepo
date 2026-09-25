<script setup lang="ts">
import { computed } from 'vue'
import { ANQIAO_DEVICES } from '../assets/anqiaoDevices'
import { isOnline, lastSampleTime, liveDeviceCount, offlineReason, presenceOf } from '../api/deviceTelemetry'
import { MISSING_HINT, MISSING_TEXT } from '../assets/ltciArchive'

withDefaults(
  defineProps<{
    active: boolean
    orgId?: string
  }>(),
  {
    orgId: 'anqiao',
  }
)

// 监测触手在线率：3 台真实在册设备，presenceOf 实算（在床/离床均计在线，离线不计）
const rtLiveCount = computed(() => liveDeviceCount())
const tentacleOnlineRate = computed(() =>
  ANQIAO_DEVICES.length > 0 ? ((rtLiveCount.value / ANQIAO_DEVICES.length) * 100).toFixed(1) : '0.0'
)

function presenceText(sn: string): string {
  const p = presenceOf(sn)
  if (p === 'person') return '● 在线 · 在床'
  if (p === 'empty') return '● 在线 · 离床'
  return `○ 离线 · ${offlineReason(sn)}`
}

function presenceColor(sn: string): string {
  return isOnline(sn) ? 'var(--mint)' : 'var(--txt-muted)'
}

// 评估辅助四步流程（流程定义，非业务数据）
const assessSteps = [
  { no: '01', name: '设备安装', desc: '守护仪入户部署' },
  { no: '02', name: '连续采集', desc: '5-7天无感监测' },
  { no: '03', name: '智能分析', desc: 'ADL能力报告' },
  { no: '04', name: '专家复核签发', desc: '评估结论生效' },
]

const stage1Items = ['指标采集', '证据校验', 'AI辅助判定', '专家复核']
const stage2Items = ['常态监测', '行为关联', '差异识别', '人工处置']
const handleSteps = ['自动识别', '人工审核', '处置执行', '归档留痕']

// 四大防骗监测研判模型：设备侧感知均已就绪（真实毫米波雷达能力），
// 对应长护险业务数据（打卡/评估档案/申报）未接入，一律"完善中"，严禁编造数字
const fraudModels = [
  {
    no: 'M1',
    name: '服务时长缩水识别',
    means: '毫米波雷达连续监测床旁有效体动',
    rule: '计划时长 vs 实测有效动作时长偏差 ≥30%',
    action: '疑点工单',
    bizData: '服务打卡数据',
    color: 'var(--cyan)',
  },
  {
    no: 'M2',
    name: '疑似虚假/代打卡识别',
    means: '雷达生命体征通道单人/多人微动识别',
    rule: '打卡已入户但房间仅单人体征或空置',
    action: '高危预警',
    bizData: '服务打卡数据',
    color: 'var(--violet-bright)',
  },
  {
    no: 'M3',
    name: '失能等级真实性偏离',
    means: '连续 7 天在离床 / 起夜 / 活动度规律',
    rule: '申报重度失能但活动指数接近自理',
    action: '复评提示',
    bizData: '评估档案数据',
    color: 'var(--amber)',
  },
  {
    no: 'M4',
    name: '空巢挂床/冒领检测',
    means: '24h 人体存在感知',
    rule: '连续 72h 无体征但机构持续申报服务',
    action: '拦截结算',
    bizData: '服务申报数据',
    color: 'var(--crimson)',
  },
]
</script>

<template>
  <!-- 顶部 KPI 条：真实设备数据实算；参保档案/稽核业务数据未接入，一律如实标注 -->
  <div class="cockpit-kpi-row ltci-kpi-row" style="grid-template-columns: repeat(6, 1fr); height: 86px;">
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">监测触手设备</div>
        <div class="val">{{ ANQIAO_DEVICES.length }} <span class="unit" style="font-size:14px;color:var(--txt-muted)">台</span></div>
        <div class="sub">长护险在册感知设备</div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">触手实时在线</div>
        <div class="val" style="color:var(--cyan)">{{ rtLiveCount }} <span class="unit" style="font-size:14px;color:var(--txt-muted)">台</span></div>
        <div class="sub" style="color:var(--cyan)">在线率 {{ tentacleOnlineRate }}% · 实时在线</div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">监管对象总数</div>
        <div class="val"><span class="missing-val" :title="MISSING_HINT" style="font-size:22px;">{{ MISSING_TEXT }}</span></div>
        <div class="sub" style="color:var(--txt-muted)">长护险全周期在册对象</div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">评估阶段对象</div>
        <div class="val"><span class="missing-val" :title="MISSING_HINT" style="font-size:22px;">{{ MISSING_TEXT }}</span></div>
        <div class="sub" style="color:var(--txt-muted)">STAGE 01 · 失能智能预评估</div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">待遇期对象</div>
        <div class="val"><span class="missing-val" :title="MISSING_HINT" style="font-size:22px;">{{ MISSING_TEXT }}</span></div>
        <div class="sub" style="color:var(--txt-muted)">STAGE 02 · 一致性核验</div>
      </div>
    </div>
    <div class="hud-card cockpit-kpi-card fade-in-up">
      <div class="light-beam"></div>
      <div>
        <div class="lbl">稽核工单</div>
        <div class="val"><span class="missing-tag" style="font-size:13px;">数据完善中</span></div>
        <div class="sub" style="color:var(--txt-muted)">服务稽核数据完善中</div>
      </div>
    </div>
  </div>

  <div class="ltci-main-grid">
    <!-- 栏 1：评估阶段（流程保留；参保人评估业务数据未获取，如实展示） -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>评估阶段 · 失能智能预评估<span class="code">PRE-ASSESSMENT</span></div>
        <span class="hud-badge missing-tag">档案完善中</span>
      </div>
      <div class="hud-body" style="gap: 10px; padding: 10px 14px;">
        <div class="ltci-section-label">评估辅助四步流程</div>
        <div class="ltci-step-flow">
          <template v-for="(s, i) in assessSteps" :key="s.no">
            <div class="ltci-step-node">
              <div class="ltci-step-no">{{ s.no }}</div>
              <div class="ltci-step-name">{{ s.name }}</div>
              <div class="ltci-step-desc">{{ s.desc }}</div>
            </div>
            <div v-if="i < assessSteps.length - 1" class="ltci-step-arrow">▸</div>
          </template>
        </div>

        <div class="ltci-section-label" style="display:flex;justify-content:space-between;">
          <span>评估进度分布</span>
          <span class="missing-tag" :title="MISSING_HINT">完善中</span>
        </div>
        <div class="ltci-missing-panel">
          <span class="missing-val" :title="MISSING_HINT">{{ MISSING_TEXT }}</span>
          <span class="ltci-missing-sub">参保人评估进度数据 · {{ MISSING_HINT }}</span>
        </div>

        <div class="ltci-section-label" style="display:flex;justify-content:space-between;">
          <span>ADL 能力维度评分</span>
          <span class="missing-tag" :title="MISSING_HINT">完善中</span>
        </div>
        <div class="ltci-missing-panel">
          <span class="missing-val" :title="MISSING_HINT">{{ MISSING_TEXT }}</span>
          <span class="ltci-missing-sub">进食/穿衣/如厕/移动/沐浴/便溺控制六维评分 · {{ MISSING_HINT }}</span>
        </div>

        <div class="ltci-section-label" style="display:flex;justify-content:space-between;">
          <span>失能等级分布</span>
          <span class="missing-tag" :title="MISSING_HINT">完善中</span>
        </div>
        <div class="ltci-missing-panel" style="flex:1;">
          <span class="missing-val" :title="MISSING_HINT">{{ MISSING_TEXT }}</span>
          <span class="ltci-missing-sub">轻度/中度/重度Ⅰ级/重度Ⅱ级认定结果 · {{ MISSING_HINT }}</span>
        </div>
      </div>
    </div>

    <!-- 栏 2：两阶段闭环（流程保留；业务预警完善中，设备遥测事件真实实算） -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>两阶段闭环 · 预警处置<span class="code">CLOSED-LOOP &amp; ALERTS</span></div>
        <span class="hud-badge" style="color:var(--mint);border-color:var(--mint)">● 闭环机制就绪</span>
      </div>
      <div class="hud-body" style="gap: 9px; padding: 10px 14px;">
        <div class="ltci-stage-loop">
          <div class="ltci-stage-card">
            <div class="ltci-stage-tag" style="color:var(--cyan);border-color:rgba(0,240,255,0.4)">STAGE 01 · 申报前</div>
            <div class="ltci-stage-title">失能智能预评估</div>
            <div class="ltci-stage-chips">
              <span v-for="c in stage1Items" :key="c" class="ltci-stage-chip">{{ c }}</span>
            </div>
          </div>
          <div class="ltci-stage-link">
            <div class="ltci-stage-link-arrow">⇄</div>
            <div class="ltci-stage-link-text">待遇闭环<br>资格回溯</div>
          </div>
          <div class="ltci-stage-card">
            <div class="ltci-stage-tag" style="color:var(--mint);border-color:rgba(0,255,136,0.4)">STAGE 02 · 待遇期</div>
            <div class="ltci-stage-title">一致性核验</div>
            <div class="ltci-stage-chips">
              <span v-for="c in stage2Items" :key="c" class="ltci-stage-chip mint">{{ c }}</span>
            </div>
          </div>
        </div>

        <div class="ltci-section-label" style="display:flex;justify-content:space-between;">
          <span>预警事件闭环处置</span>
          <span style="color:var(--mint);font-family:var(--font-mono);font-size:9.5px;">全程留痕可溯</span>
        </div>
        <div class="ltci-handle-flow">
          <template v-for="(h, i) in handleSteps" :key="h">
            <div class="ltci-handle-node">{{ h }}</div>
            <div v-if="i < handleSteps.length - 1" class="ltci-step-arrow">▸</div>
          </template>
        </div>

        <div class="ltci-section-label" style="display:flex;justify-content:space-between;">
          <span>长护险业务预警（打卡/稽核/基金）</span>
          <span class="missing-tag" :title="MISSING_HINT">完善中</span>
        </div>
        <div class="ltci-missing-panel">
          <span class="missing-val" :title="MISSING_HINT">{{ MISSING_TEXT }}</span>
          <span class="ltci-missing-sub">服务打卡与稽核数据完善中，暂不展示预警统计</span>
        </div>

        <div class="ltci-section-label" style="display:flex;justify-content:space-between;">
          <span>实时设备状态</span>
          <span style="color:var(--cyan);font-family:var(--font-mono);font-size:9.5px;">LIVE FEED · 实时更新</span>
        </div>
        <div class="ltci-alert-feed">
          <div v-for="d in ANQIAO_DEVICES" :key="d.sn" class="ltci-alert-row">
            <span class="ltci-alert-time">{{ isOnline(d.sn) && lastSampleTime(d.sn) ? lastSampleTime(d.sn).slice(11) : '--:--:--' }}</span>
            <span class="ltci-alert-target">{{ d.sn }}</span>
            <span class="ltci-alert-type">{{ presenceText(d.sn) }} · {{ d.model }}</span>
            <span
              class="ltci-alert-status"
              :style="isOnline(d.sn) ? 'color:var(--mint);border-color:var(--mint)' : 'color:var(--amber);border-color:var(--amber)'"
            >{{ isOnline(d.sn) ? '在线正常' : '离线待核查' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 栏 3：四大防骗监测研判模型 -->
    <div class="hud-card">
      <div class="light-beam"></div>
      <div class="hud-head">
        <div class="hud-title"><span class="marker"></span>四大防骗监测研判模型<span class="code">ANTI-FRAUD MODELS</span></div>
        <span class="hud-badge" style="color:var(--mint);border-color:var(--mint)">设备感知 4/4 就绪</span>
      </div>
      <div class="hud-body" style="gap: 8px; padding: 10px 14px;">
        <div v-for="m in fraudModels" :key="m.no" class="ltci-model-card" :style="{ borderColor: `color-mix(in srgb, ${m.color} 30%, transparent)` }">
          <div class="ltci-model-head">
            <span class="ltci-model-no" :style="{ color: m.color, borderColor: m.color }">{{ m.no }}</span>
            <span class="ltci-model-name">{{ m.name }}</span>
            <span class="ltci-model-action" :style="{ color: m.color, borderColor: m.color }">→ {{ m.action }}</span>
          </div>
          <div class="ltci-model-row">
            <span class="ltci-model-key">感知手段</span>
            <span class="ltci-model-val">{{ m.means }}</span>
          </div>
          <div class="ltci-model-row">
            <span class="ltci-model-key">研判规则</span>
            <span class="ltci-model-val">{{ m.rule }}</span>
          </div>
          <div class="ltci-model-tags">
            <span class="ltci-tag-ready">● 设备侧感知：已就绪</span>
            <span class="missing-tag" :title="MISSING_HINT">{{ m.bizData }}：完善中</span>
          </div>
        </div>

        <div class="ltci-model-footnote">
          监测触手在线率 <b style="color:var(--cyan)">{{ tentacleOnlineRate }}%</b>（{{ rtLiveCount }}/{{ ANQIAO_DEVICES.length }} 台实时在线）·
          业务数据完善后模型自动产出研判结论
        </div>
      </div>
    </div>
  </div>

  <!-- 底部：监测触手设备概览（3 台真实设备，presenceOf 实算在线状态） -->
  <div class="hud-card ltci-device-bar">
    <div class="light-beam"></div>
    <div class="ltci-device-title">
      <span class="marker" style="width:3.5px;height:14px;background:var(--cyan);box-shadow:0 0 10px var(--cyan);"></span>
      监测触手 · 设备部署体系
      <span class="code" style="font-family:var(--font-digit);font-size:9.5px;letter-spacing:2px;color:var(--txt-tech);opacity:0.7;">TERMINAL MATRIX</span>
    </div>
    <div class="ltci-device-cells">
      <div v-for="d in ANQIAO_DEVICES" :key="d.sn" class="ltci-device-cell">
        <div class="ltci-device-info">
          <div class="ltci-device-name" :style="{ color: presenceColor(d.sn) }">{{ d.sn }}</div>
          <div class="ltci-device-scene">{{ d.model }} · {{ d.network }} · {{ d.district }}</div>
        </div>
        <div class="ltci-device-stat">
          <span class="ltci-device-online" :style="{ color: presenceColor(d.sn), fontSize: '11.5px' }">{{ presenceText(d.sn) }}</span>
          <div class="ltci-device-track">
            <div class="ltci-device-fill" :style="{ background: presenceColor(d.sn), width: isOnline(d.sn) ? '100%' : '0%' }"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="ltci-device-summary">
      <span class="ltci-device-summary-label">触手在线率</span>
      <span class="ltci-device-summary-val">{{ tentacleOnlineRate }}%</span>
    </div>
  </div>
</template>

<style scoped>
.ltci-kpi-row {
  margin-bottom: 0;
  flex-shrink: 0;
}

.ltci-main-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1.04fr 1fr;
  gap: 12px;
  min-height: 0;
}

.ltci-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--txt-secondary);
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.ltci-step-flow {
  display: flex;
  align-items: stretch;
  gap: 4px;
  flex-shrink: 0;
}
.ltci-step-node {
  flex: 1;
  background: rgba(0, 240, 255, 0.05);
  border: 1px solid rgba(0, 240, 255, 0.18);
  border-radius: 4px;
  padding: 5px 4px 6px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ltci-step-no {
  font-family: var(--font-digit);
  font-size: 11px;
  font-weight: 800;
  color: var(--cyan);
  text-shadow: 0 0 8px var(--cyan-glow);
}
.ltci-step-name {
  font-size: 11.5px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.ltci-step-desc {
  font-size: 9px;
  color: var(--txt-muted);
  white-space: nowrap;
}
.ltci-step-arrow {
  align-self: center;
  color: var(--cyan);
  font-size: 13px;
  flex-shrink: 0;
  text-shadow: 0 0 8px var(--cyan-glow);
}

/* 缺失数据占位面板（未获取/完善中，严禁编造） */
.ltci-missing-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 14px 10px;
  background: rgba(148, 163, 184, 0.04);
  border: 1px dashed rgba(148, 163, 184, 0.25);
  border-radius: 4px;
  flex-shrink: 0;
  min-height: 0;
}
.ltci-missing-panel .missing-val {
  font-size: 14px;
  letter-spacing: 1px;
}
.ltci-missing-sub {
  font-size: 9.5px;
  color: var(--txt-muted);
  text-align: center;
  line-height: 1.5;
}

.ltci-stage-loop {
  display: flex;
  align-items: stretch;
  gap: 6px;
  flex-shrink: 0;
}
.ltci-stage-card {
  flex: 1;
  background: rgba(6, 18, 36, 0.7);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 5px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.ltci-stage-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  border: 1px solid;
  border-radius: 2px;
  padding: 1px 6px;
  align-self: flex-start;
  white-space: nowrap;
}
.ltci-stage-title {
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
}
.ltci-stage-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ltci-stage-chip {
  font-size: 9.5px;
  color: var(--txt-secondary);
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.16);
  border-radius: 2px;
  padding: 1px 6px;
  white-space: nowrap;
}
.ltci-stage-chip.mint {
  background: rgba(0, 255, 136, 0.08);
  border-color: rgba(0, 255, 136, 0.18);
}
.ltci-stage-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex-shrink: 0;
  width: 44px;
}
.ltci-stage-link-arrow {
  font-size: 20px;
  color: var(--cyan);
  text-shadow: 0 0 10px var(--cyan-glow);
  animation: ltciLinkPulse 2s ease-in-out infinite;
}
@keyframes ltciLinkPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.ltci-stage-link-text {
  font-size: 8.5px;
  color: var(--txt-muted);
  text-align: center;
  line-height: 1.35;
}

.ltci-handle-flow {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.ltci-handle-node {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.28);
  border-radius: 3px;
  padding: 4px 0;
  white-space: nowrap;
}

.ltci-alert-feed {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 3px;
}
.ltci-alert-feed::-webkit-scrollbar { width: 4px; }
.ltci-alert-feed::-webkit-scrollbar-thumb { background: var(--border-glow); border-radius: 2px; }
.ltci-alert-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(0, 240, 255, 0.1);
  border-radius: 3px;
  font-size: 11px;
  flex-shrink: 0;
}
.ltci-alert-row:nth-child(odd) { background: rgba(0, 210, 255, 0.05); }
.ltci-alert-time {
  font-family: var(--font-mono);
  color: var(--txt-muted);
  font-size: 10px;
  width: 58px;
  flex-shrink: 0;
}
.ltci-alert-target {
  font-family: var(--font-digit);
  font-weight: 700;
  color: var(--cyan);
  font-size: 11px;
  width: 70px;
  flex-shrink: 0;
}
.ltci-alert-type {
  flex: 1;
  color: var(--txt-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ltci-alert-status {
  font-size: 9.5px;
  font-weight: 700;
  border: 1px solid;
  border-radius: 2px;
  padding: 1px 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* 四大防骗监测研判模型卡 */
.ltci-model-card {
  background: rgba(6, 18, 36, 0.7);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 5px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}
.ltci-model-head {
  display: flex;
  align-items: center;
  gap: 7px;
}
.ltci-model-no {
  font-family: var(--font-digit);
  font-size: 10px;
  font-weight: 800;
  border: 1px solid;
  border-radius: 2px;
  padding: 0 5px;
  flex-shrink: 0;
}
.ltci-model-name {
  flex: 1;
  font-size: 12.5px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ltci-model-action {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  border: 1px solid;
  border-radius: 2px;
  padding: 1px 6px;
  flex-shrink: 0;
  white-space: nowrap;
}
.ltci-model-row {
  display: flex;
  gap: 8px;
  font-size: 10.5px;
  line-height: 1.45;
}
.ltci-model-key {
  color: var(--txt-muted);
  flex-shrink: 0;
  width: 46px;
}
.ltci-model-val {
  color: var(--txt-primary);
  flex: 1;
}
.ltci-model-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ltci-tag-ready {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--mint);
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.35);
  border-radius: 3px;
  padding: 1px 6px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.ltci-model-footnote {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--txt-muted);
  text-align: center;
  padding: 5px 8px;
  background: rgba(0, 240, 255, 0.03);
  border: 1px solid rgba(0, 240, 255, 0.1);
  border-radius: 3px;
  line-height: 1.5;
}

.ltci-device-bar {
  flex-direction: row;
  align-items: center;
  height: 72px;
  flex-shrink: 0;
  padding: 0 16px;
  gap: 18px;
}
.ltci-device-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
  white-space: nowrap;
  flex-shrink: 0;
}
.ltci-device-cells {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  min-width: 0;
}
.ltci-device-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(0, 240, 255, 0.12);
  border-radius: 4px;
  padding: 8px 12px;
  min-width: 0;
}
.ltci-device-info {
  flex: 1;
  min-width: 0;
}
.ltci-device-name {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  font-family: var(--font-digit);
}
.ltci-device-scene {
  font-size: 9.5px;
  color: var(--txt-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ltci-device-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.ltci-device-online {
  font-family: var(--font-mono);
  font-weight: 700;
  white-space: nowrap;
}
.ltci-device-track {
  width: 64px;
  height: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}
.ltci-device-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 0 6px currentColor;
}
.ltci-device-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.ltci-device-summary-label {
  font-size: 9.5px;
  color: var(--txt-muted);
  letter-spacing: 1px;
}
.ltci-device-summary-val {
  font-family: var(--font-digit);
  font-size: 18px;
  font-weight: 800;
  color: var(--cyan);
  text-shadow: 0 0 10px var(--cyan-glow);
}
</style>
