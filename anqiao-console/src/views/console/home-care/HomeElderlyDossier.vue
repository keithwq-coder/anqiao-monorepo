<script setup lang="ts">
import { ref } from 'vue'
import { useHomeCareStore } from '../../../features/home-care/home-care-store'
import AreaFilterChips from '../../../features/home-care/components/AreaFilterChips.vue'
import HomeElderlyDetail from './HomeElderlyDetail.vue'

const store = useHomeCareStore()

const viewMode = ref<'grid' | 'table'>('grid')

function handleSelectElder(elderlyId: string) {
  store.openElderlyDetail(elderlyId)
}
</script>

<template>
  <div class="home-elderly-dossier-view">
    <!-- 如果当前正在查看单人全景详情，则显示下钻组件并提供一键返回 -->
    <template v-if="store.activeElderlyDetail.value">
      <HomeElderlyDetail
        :elderly-id="store.activeElderlyDetail.value.elderly_id"
        @back="store.closeElderlyDetail()"
      />
    </template>

    <!-- 否则显示全景列表/卡片主界面 -->
    <template v-else>
      <!-- 顶部标题与快速统计栏 -->
      <div class="dossier-header-bar">
        <div class="title-block">
          <h2>在管长者全景档案</h2>
          <span class="subtitle-desc">
            演示·暖阳居家养老服务中心（模拟机构） · 辖区在管长者 <strong>{{ store.elders.value.length }}</strong> 位全景感知
          </span>
        </div>

        <div class="dossier-summary-stats">
          <div class="stat-pill">
            <span class="lbl">重度失能</span>
            <span class="val rose">{{ store.severeDisabilityCount.value }} 位</span>
          </div>
          <div class="stat-pill">
            <span class="lbl">独居高危</span>
            <span class="val purple">{{ store.livingAloneCount.value }} 户</span>
          </div>
          <div class="stat-pill">
            <span class="lbl">实时告警</span>
            <span class="val red">{{ store.alertElderlyCount.value }} 起</span>
          </div>
          <div class="view-switch">
            <button
              :class="['switch-btn', viewMode === 'grid' && 'active']"
              @click="viewMode = 'grid'"
              title="卡片网格视图"
              type="button"
            >
              ⊞ 卡片
            </button>
            <button
              :class="['switch-btn', viewMode === 'table' && 'active']"
              @click="viewMode = 'table'"
              title="紧凑表格视图"
              type="button"
            >
              ☰ 表格
            </button>
          </div>
        </div>
      </div>

      <!-- 快速片区 Chips 与模糊搜索筛选栏（全量 page_size: 100 加载） -->
      <AreaFilterChips />

      <!-- 长者卡片网格模式 -->
      <div v-if="viewMode === 'grid'" class="elderly-cards-grid">
        <div
          v-for="elder in store.filteredElders.value"
          :key="elder.elderly_id"
          class="elder-card"
          :class="{
            'is-alert': elder.current_state === '异常预警',
            'is-severe': elder.ltc_level === '重度失能',
          }"
          @click="handleSelectElder(elder.elderly_id)"
        >
          <div class="card-head">
            <div class="head-left">
              <span class="card-avatar">{{ elder.gender === 'male' ? '👴' : '👵' }}</span>
              <div class="name-col">
                <span class="elder-name">{{ elder.name }}</span>
                <span class="elder-age-tag">{{ elder.age }}岁 · {{ elder.gender === 'male' ? '男' : '女' }}</span>
              </div>
            </div>
            <div class="head-right">
              <span
                class="state-pill-sm"
                :class="{
                  'state-normal': elder.current_state === '在家长者',
                  'state-alert': elder.current_state === '异常预警',
                  'state-outing': elder.current_state === '外出活动',
                }"
              >
                {{ elder.current_state }}
              </span>
            </div>
          </div>

          <div class="card-address-row">
            <span class="area-badge">{{ elder.area_name }}</span>
            <span class="addr-text" :title="elder.home_address">📍 {{ elder.home_address }}</span>
          </div>

          <div class="card-badges-row">
            <span
              class="ltc-tag"
              :class="elder.ltc_level === '重度失能' ? 'ltc-severe' : 'ltc-normal'"
            >
              {{ elder.ltc_level }}
            </span>
            <span class="living-tag">{{ elder.living_status }}</span>
            <span v-if="!elder.has_elevator" class="stairs-tag">{{ elder.floor_number }}楼无梯</span>
          </div>

          <!-- 安居硬件遥测微视图 -->
          <div class="card-device-telemetry">
            <div class="dev-telemetry-item">
              <span class="dev-name">雷达防跌倒:</span>
              <span :class="elder.devices.radar_bathroom.fall_alert ? 'val-alert' : 'val-ok'">
                {{ elder.devices.radar_bathroom.fall_alert ? '⚠️ 突发跌倒' : '正常平稳' }}
              </span>
            </div>
            <div v-if="elder.devices.sleep_pad" class="dev-telemetry-item">
              <span class="dev-name">体征床垫:</span>
              <span :class="elder.devices.sleep_pad.in_bed ? 'val-ok' : 'val-warn'">
                {{ elder.devices.sleep_pad.in_bed ? `在床 (${elder.devices.sleep_pad.hr}bpm)` : `离床${elder.devices.sleep_pad.leave_bed_minutes}m` }}
              </span>
            </div>
          </div>

          <div class="card-footer">
            <span class="cg-label">助老员: <strong>{{ elder.assigned_caregiver_name }}</strong></span>
            <span class="detail-link">穿透详情 →</span>
          </div>
        </div>
      </div>

      <!-- 长者表格模式 -->
      <div v-else class="elderly-table-wrapper">
        <table class="elderly-table">
          <thead>
            <tr>
              <th>长者档案编号</th>
              <th>真实姓名</th>
              <th>性别/年龄</th>
              <th>长护险失能等级</th>
              <th>居住形态</th>
              <th>片区与详细门牌</th>
              <th>签约责任助老员</th>
              <th>安居设备实时状态</th>
              <th>紧急联系家属</th>
              <th>本月服务进度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="elder in store.filteredElders.value"
              :key="elder.elderly_id"
              :class="{ 'row-alert': elder.current_state === '异常预警' }"
            >
              <td class="font-mono">{{ elder.elderly_id }}</td>
              <td>
                <button class="name-btn" @click="handleSelectElder(elder.elderly_id)">
                  <strong>{{ elder.name }}</strong>
                </button>
              </td>
              <td>{{ elder.gender === 'male' ? '男' : '女' }} · {{ elder.age }}岁</td>
              <td>
                <span
                  class="ltc-tag"
                  :class="elder.ltc_level === '重度失能' ? 'ltc-severe' : 'ltc-normal'"
                >
                  {{ elder.ltc_level }}
                </span>
              </td>
              <td>{{ elder.living_status }}</td>
              <td class="addr-td">
                <span class="area-badge">{{ elder.area_name }}</span>
                {{ elder.home_address }}
              </td>
              <td>{{ elder.assigned_caregiver_name }}</td>
              <td>
                <span
                  class="dev-badge"
                  :class="elder.devices.radar_bathroom.fall_alert ? 'badge-alert' : 'badge-ok'"
                >
                  {{ elder.devices.radar_bathroom.fall_alert ? '⚠️ 跌倒告警' : '雷达正常' }}
                </span>
                <span v-if="elder.devices.sleep_pad" class="dev-badge badge-sleep">
                  {{ elder.devices.sleep_pad.in_bed ? `在床心率${elder.devices.sleep_pad.hr}` : `离床` }}
                </span>
              </td>
              <td class="family-td">
                {{ elder.emergency_contact.name }} ({{ elder.emergency_contact.relation }}) ·
                <span class="phone-text">{{ elder.emergency_contact.phone }}</span>
              </td>
              <td class="progress-td">
                {{ elder.monthly_service_completed }}/{{ elder.monthly_service_quota }}次
              </td>
              <td>
                <button class="action-btn" @click="handleSelectElder(elder.elderly_id)">
                  客观全景
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 底部统计与全量加载提示 -->
      <div class="dossier-footer-note">
        <span>当前显示 <strong>{{ store.filteredElders.value.length }}</strong> 位长者档案 · 默认全量加载（已杜绝分页截断）</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-elderly-dossier-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dossier-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  flex-wrap: wrap;
  gap: 14px;
}

.title-block h2 {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px;
}

.subtitle-desc {
  font-size: 12px;
  color: #94a3b8;
}

.subtitle-desc strong {
  color: #38bdf8;
}

.dossier-summary-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-pill {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 6px;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.stat-pill .lbl { color: #94a3b8; }
.stat-pill .val.rose { color: #fda4af; font-weight: 600; }
.stat-pill .val.purple { color: #d8b4fe; font-weight: 600; }
.stat-pill .val.red { color: #fca5a5; font-weight: 600; }

.view-switch {
  display: flex;
  background: rgba(0, 0, 0, 0.25);
  padding: 3px;
  border-radius: 6px;
  margin-left: 8px;
}

.switch-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.switch-btn.active {
  background: #0ea5e9;
  color: #ffffff;
  font-weight: 600;
}

.elderly-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.elder-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.elder-card:hover {
  transform: translateY(-2px);
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  background: rgba(30, 41, 59, 0.8);
}

.elder-card.is-alert {
  border-color: rgba(239, 68, 68, 0.6);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-avatar {
  font-size: 28px;
  line-height: 1;
}

.name-col {
  display: flex;
  flex-direction: column;
}

.elder-name {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}

.elder-age-tag {
  font-size: 11px;
  color: #94a3b8;
}

.state-pill-sm {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 12px;
  font-weight: 600;
}

.state-normal {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.state-alert {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  animation: pulse 1.8s infinite;
}

.state-outing {
  background: rgba(234, 179, 8, 0.15);
  color: #fde047;
}

.card-address-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #cbd5e1;
}

.area-badge {
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  color: #94a3b8;
  white-space: nowrap;
}

.addr-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-badges-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ltc-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.ltc-severe {
  background: rgba(244, 63, 94, 0.2);
  color: #fda4af;
  border: 1px solid rgba(244, 63, 94, 0.35);
}

.ltc-normal {
  background: rgba(14, 165, 233, 0.15);
  color: #7dd3fc;
  border: 1px solid rgba(14, 165, 233, 0.3);
}

.living-tag {
  font-size: 11px;
  background: rgba(147, 51, 234, 0.15);
  color: #d8b4fe;
  padding: 1px 6px;
  border-radius: 3px;
}

.stairs-tag {
  font-size: 11px;
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
  padding: 1px 6px;
  border-radius: 3px;
}

.card-device-telemetry {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dev-telemetry-item {
  display: flex;
  justify-content: space-between;
}

.dev-name {
  color: #94a3b8;
}

.val-ok {
  color: #34d399;
}

.val-alert {
  color: #f87171;
  font-weight: 700;
}

.val-warn {
  color: #fbbf24;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  padding-top: 8px;
  font-size: 12px;
}

.cg-label {
  color: #94a3b8;
}

.cg-label strong {
  color: #f1f5f9;
}

.detail-link {
  color: #38bdf8;
  font-weight: 500;
}

/* 表格样式 */
.elderly-table-wrapper {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  overflow-x: auto;
}

.elderly-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.elderly-table th {
  background: rgba(30, 41, 59, 0.7);
  color: #94a3b8;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  white-space: nowrap;
}

.elderly-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.elderly-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.name-btn {
  background: transparent;
  border: none;
  color: #38bdf8;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.addr-td {
  max-width: 200px;
}

.dev-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 4px;
}

.badge-ok {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.badge-alert {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
  font-weight: 700;
}

.badge-sleep {
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
}

.phone-text {
  font-family: monospace;
  color: #38bdf8;
}

.action-btn {
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.3);
  color: #38bdf8;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.action-btn:hover {
  background: #0ea5e9;
  color: #ffffff;
}

.dossier-footer-note {
  text-align: center;
  font-size: 12px;
  color: #64748b;
  padding: 10px;
}
</style>
