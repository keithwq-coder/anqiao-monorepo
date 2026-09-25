<template>
  <div class="workspace-page platform-operations">
    <div class="page-header">
      <div>
        <div class="page-title">中科安樵·平台运营工作台</div>
  <InstitutionLtcEntry />
  <DeviceLabels />
        <div class="page-subtitle">中科安樵·自营运营中心 · 设备资产中心、12 阶段生命周期流转、质量事件闭环</div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">运营中心: 中科安樵自营总控</span>
        <span class="badge badge-success">7 维归属台账: 校验通过</span>
      </div>
    </div>

    <!-- 核心指标 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-num">{{ devices.length }}</div>
        <div class="metric-label">平台纳管设备资产总数</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ monitoringCount }}</div>
        <div class="metric-label">在床在线连续监测设备</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">{{ qualityEvents.length }}</div>
        <div class="metric-label">设备质量/离线异常事件</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-primary">{{ lifecycleLogs.length }}</div>
        <div class="metric-label">生命周期流转审计记录</div>
      </div>
    </div>

    <!-- 导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'nation' && 'active']" @click="activeTab = 'nation'">
        🗺️ 全国地图与城市下钻
      </button>
      <button :class="['tab-btn', activeTab === 'devices_list' && 'active']" @click="activeTab = 'devices_list'">
        📱 全网设备资产台账 ({{ devices.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'alerts' && 'active']" @click="activeTab = 'alerts'">
        🚨 实时告警响应中心
      </button>
      <button :class="['tab-btn', activeTab === 'assets' && 'active']" @click="activeTab = 'assets'">
        📋 7 维资产模型详情
      </button>
      <button :class="['tab-btn', activeTab === 'lifecycle' && 'active']" @click="activeTab = 'lifecycle'">
        🔄 12 阶段生命周期流转
      </button>
      <button :class="['tab-btn', activeTab === 'quality' && 'active']" @click="activeTab = 'quality'">
        🛡️ 质量与离线事件闭环 ({{ qualityEvents.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'logs' && 'active']" @click="activeTab = 'logs'">
        📜 审计流水 ({{ lifecycleLogs.length }})
      </button>
    </div>

    <!-- Tab 0: 全国地图与城市穿透下钻 -->
    <div v-if="activeTab === 'nation'" class="content-panel nation-panel">
      <ConsoleNation />
    </div>

    <!-- Tab 0.1: 全网设备列表 -->
    <div v-if="activeTab === 'devices_list'" class="content-panel">
      <ConsoleDevices />
    </div>

    <!-- Tab 0.2: 全网实时告警响应中心 -->
    <div v-if="activeTab === 'alerts'" class="content-panel">
      <ConsoleAlerts :vendor="true" />
    </div>

    <!-- Tab 1: 7 维设备资产台账 -->
    <div v-if="activeTab === 'assets'" class="content-panel">
      <div class="panel-alert">
        <strong>7 维设备归属模型合规定义：</strong>
        1. 硬件所有权归属 | 2. 运营合作方渠道 | 3. 采购/渠道类型 | 4. 服务定点机构 | 5. 保管使用单位 | 6. 监测对象(长者) | 7. 物理安装点位。
        渠道合作伙伴仅引荐客户，严禁将合作伙伴直接认定为客户数据所有人。
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>设备编号/SN</th>
            <th>设备型号名称</th>
            <th>① 硬件资产所有权</th>
            <th>② 合作渠道</th>
            <th>③ 采购方式</th>
            <th>④ 服务定点机构</th>
            <th>⑤ 保管组织</th>
            <th>⑥ 监测对象</th>
            <th>⑦ 物理安装点位</th>
            <th>医保评估用途</th>
            <th>生命周期状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in devices" :key="d.device_id">
            <td class="font-mono font-bold text-primary">{{ d.device_id }}</td>
            <td>
              <div>{{ d.type }}</div>
              <div v-if="d.label && d.label !== d.type" class="text-xs text-muted">{{ d.label }}</div>
            </td>
            <td><span class="tag tag-info">{{ d.hardware_asset_owner }}</span></td>
            <td>{{ d.operator_partner_id || '直接直营' }}</td>
            <td>{{ d.procurement_channel }}</td>
            <td>{{ d.service_provider_org_id }}</td>
            <td>{{ d.custodian_org_id }}</td>
            <td>
              <span v-if="d.monitored_subject_id" class="font-bold text-success">{{ d.monitored_subject_id }}</span>
              <span v-else class="text-muted">未绑定</span>
            </td>
            <td class="text-xs">{{ d.device_placement_location }}</td>
            <td>
              <span v-if="d.assessment_usage" class="tag tag-success">{{ d.assessment_usage }}</span>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <span :class="['status-pill', d.lifecycle_status === 'monitoring' ? 'status-success' : 'status-warning']">
                {{ d.lifecycle_status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 2: 12 阶段生命周期流转控制台 -->
    <div v-if="activeTab === 'lifecycle'" class="content-panel">
      <div class="panel-alert">
        <strong>12 阶段状态机规范：</strong>
        stocked(在库) → reserved(预留) → shipped/in_transit(在途) → delivered/arrived_onsite(到场) → installed(安装) → activated(激活) → assigned(绑定) → monitoring(在床监测) → suspended(暂停) → returned(返还) → repaired(维修) → retired(退役)。严格杜绝非法跳步。
      </div>

      <div class="lifecycle-tool">
        <div class="form-row">
          <div class="form-group">
            <label>选择操作设备：</label>
            <select v-model="selectedDeviceId" class="form-input">
              <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
                {{ d.device_id }} (当前: {{ d.lifecycle_status }} - {{ d.label }})
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>目标流转状态：</label>
            <select v-model="targetStatus" class="form-input">
              <option value="delivered">delivered (现场签收验货)</option>
              <option value="installed">installed (现场安装配置)</option>
              <option value="activated">activated (联网激活通电)</option>
              <option value="monitoring">monitoring (绑定对象在床监测)</option>
              <option value="suspended">suspended (因故暂停监测)</option>
              <option value="repaired">repaired (设备标定与送修)</option>
              <option value="retired">retired (报废退役下线)</option>
            </select>
          </div>
          <div class="form-group">
            <label>流转处置说明备注：</label>
            <input v-model="transitionNote" type="text" class="form-input" placeholder="例：现场验货完毕，传感器自检正常" />
          </div>
        </div>
        <button class="btn btn-primary mt-3" @click="executeLifecycle">提交生命周期流转</button>
      </div>
    </div>

    <!-- Tab 3: 设备质量事件闭环 -->
    <div v-if="activeTab === 'quality'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>事件编号</th>
            <th>异常设备</th>
            <th>异常分类</th>
            <th>详细异常描述</th>
            <th>上报时间</th>
            <th>处置状态</th>
            <th>处置责任人</th>
            <th>处置与恢复操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="qe in qualityEvents" :key="qe.event_id">
            <td class="font-mono font-bold">{{ qe.event_id }}</td>
            <td class="font-mono text-primary">{{ qe.device_id }}</td>
            <td><span class="tag tag-danger">{{ qe.status }}</span></td>
            <td>{{ qe.detail }}</td>
            <td>{{ qe.reported_at }}</td>
            <td>
              <span :class="['status-pill', qe.disposed ? 'status-success' : 'status-warning']">
                {{ qe.disposed ? '已处置恢复' : '待排查' }}
              </span>
            </td>
            <td>{{ qe.disposed_by || '—' }}</td>
            <td>
              <button
                v-if="!qe.disposed"
                class="btn btn-sm btn-primary"
                @click="disposeQualityAction(qe.event_id)"
              >
                现场排查并校准恢复
              </button>
              <span v-else class="text-xs text-muted">{{ qe.disposal_remark }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 4: 审计流水 -->
    <div v-if="activeTab === 'logs'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>流水号</th>
            <th>设备 SN</th>
            <th>原状态</th>
            <th>目标状态</th>
            <th>操作账号</th>
            <th>所属组织</th>
            <th>物理点位</th>
            <th>操作时间</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in lifecycleLogs" :key="log.log_id">
            <td class="font-mono">{{ log.log_id }}</td>
            <td class="font-mono text-primary">{{ log.device_id }}</td>
            <td><span class="tag tag-info">{{ log.from_status }}</span></td>
            <td><span class="tag tag-success">{{ log.to_status }}</span></td>
            <td>{{ log.operator_id }}</td>
            <td>{{ log.organization_id }}</td>
            <td class="text-xs">{{ log.location }}</td>
            <td>{{ log.occurred_at?.slice(0, 19) }}</td>
            <td>{{ log.remark }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import InstitutionLtcEntry from '../../../features/ltc-workbench/pages/InstitutionLtcEntry.vue'
import DeviceLabels from '../../../features/ltc-workbench/pages/DeviceLabels.vue'
import { ref, onMounted, computed } from 'vue'
import ConsoleNation from '../ConsoleNation.vue'
import ConsoleDevices from '../ConsoleDevices.vue'
import ConsoleAlerts from '../ConsoleAlerts.vue'
import {
  getDeviceAssets,
  transitionDeviceLifecycle,
  getDeviceLifecycleLogs,
  getQualityEvents,
  disposeQualityEvent,
} from '../../../api/client'
import type { DeviceAsset, DeviceLifecycleLog, QualityEvent } from '../../../api/types'

const activeTab = ref<'nation' | 'devices_list' | 'alerts' | 'assets' | 'lifecycle' | 'quality' | 'logs'>('nation')

const devices = ref<DeviceAsset[]>([])
const lifecycleLogs = ref<DeviceLifecycleLog[]>([])
const qualityEvents = ref<QualityEvent[]>([])

const selectedDeviceId = ref('ANCE00002')
const targetStatus = ref('delivered')
const transitionNote = ref('现场签收验货完毕')

const monitoringCount = computed(() => {
  return devices.value.filter((d) => d.lifecycle_status === 'monitoring').length
})

async function loadData() {
  try {
    const dRes = await getDeviceAssets()
    devices.value = dRes.list || []

    const lRes = await getDeviceLifecycleLogs()
    lifecycleLogs.value = lRes.list || []

    const qRes = await getQualityEvents()
    qualityEvents.value = qRes.list || []
  } catch (err: any) {
    console.error('加载设备平台数据失败:', err)
  }
}

onMounted(() => {
  loadData()
})

async function executeLifecycle() {
  try {
    await transitionDeviceLifecycle(
      selectedDeviceId.value,
      targetStatus.value,
      transitionNote.value,
    )
    alert(`设备 ${selectedDeviceId.value} 状态已成功流转至 ${targetStatus.value}！并已沉淀审计流水。`)
    await loadData()
  } catch (err: any) {
    alert('流转拒绝（非法跳跃或状态机约束）: ' + err.message)
  }
}

async function disposeQualityAction(eventId: string) {
  const note = prompt('请输入质量事件排查处置说明：', '已现场调整毫米波雷达天线倾角并重新标定，监测数据已恢复')
  if (!note) return

  try {
    await disposeQualityEvent(eventId, {
      action: 'recalibrated',
      note,
    })
    alert('设备质量事件处置闭环完成！')
    await loadData()
  } catch (err: any) {
    alert('处置失败: ' + err.message)
  }
}
</script>

<style scoped>
.workspace-page {
  padding: 24px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}
.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.header-badges {
  display: flex;
  gap: 8px;
}
.badge {
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.badge-primary {
  background: #e0f2fe;
  color: #0284c7;
}
.badge-success {
  background: #dcfce7;
  color: #16a34a;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.metric-card {
  background: #ffffff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.metric-num {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}
.metric-label {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.tab-nav {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 16px;
}
.tab-btn {
  padding: 10px 18px;
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}
.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}
.content-panel {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.panel-alert {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.6;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
}
.data-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.tag-danger {
  background: #fee2e2;
  color: #dc2626;
}
.tag-warning {
  background: #fef3c7;
  color: #d97706;
}
.tag-success {
  background: #dcfce7;
  color: #16a34a;
}
.tag-info {
  background: #e0f2fe;
  color: #0284c7;
}
.status-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.status-success {
  background: #dcfce7;
  color: #16a34a;
}
.status-warning {
  background: #fef3c7;
  color: #d97706;
}
.lifecycle-tool {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 20px;
  border-radius: 8px;
}
.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}
.mt-3 {
  margin-top: 16px;
}
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}
.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}
.btn-primary {
  background: #2563eb;
  color: #ffffff;
}
.btn-primary:hover {
  background: #1d4ed8;
}
.text-warning {
  color: #d97706;
}
.text-success {
  color: #16a34a;
}
.text-primary {
  color: #2563eb;
}
.text-muted {
  color: #94a3b8;
}
.font-mono {
  font-family: monospace;
}
.font-bold {
  font-weight: 600;
}
.text-xs {
  font-size: 12px;
}
</style>
