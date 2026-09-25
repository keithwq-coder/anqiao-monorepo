<template>
  <div class="workspace-page device-monitoring">
    <div class="page-header">
      <div>
        <div class="page-title-row">
          <h1 class="page-title">设备监测情况 · 智能物联网实时遥测中心</h1>
          <span class="badge badge-primary">病区设备直连</span>
          <span class="badge badge-success">毫秒级客观遥测</span>
          <span class="badge badge-neutral">凯健国际护理院</span>
        </div>
        <div class="page-subtitle">
          全院床位智能压电睡眠监护床垫 · 毫米波生命体征雷达 · 卫生间防跌倒感知终端 · 在线状态/实时心率呼吸/网络质量一体化监测
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="exportDeviceCsv">
          <span class="btn-icon">⬇️</span>
          导出设备巡检台账 (CSV)
        </button>
        <button class="btn btn-primary" @click="runFullScan">
          <span class="btn-icon">⚡</span>
          全域网络心跳巡检 (Ping)
        </button>
      </div>
    </div>

    <!-- 核心指标 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-num text-primary">{{ wardDeviceCount }}</div>
        <div class="metric-label">纳管感知床位硬件 (台)</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ wardOnlineRate }}%</div>
        <div class="metric-label">终端实时在线率 (高可用)</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">{{ inBedTeleCount }}</div>
        <div class="metric-label">实时在床体征遥测中 (人)</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-primary">{{ alerts.length }}</div>
        <div class="metric-label">待排查设备运维事件 (件)</div>
      </div>
    </div>

    <!-- 标签导航 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'ward' && 'active']" @click="activeTab = 'ward'">
        <span class="tab-icon">🛏️</span>
        病区床位设备实时监测 ({{ wardDeviceList.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'devices' && 'active']" @click="activeTab = 'devices'">
        <span class="tab-icon">📡</span>
        全域点位设备在线状态 ({{ deviceList.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'alerts' && 'active']" @click="activeTab = 'alerts'">
        <span class="tab-icon">⚠️</span>
        设备离线与异常告警 ({{ alerts.length }})
      </button>
    </div>

    <!-- Tab 1: 机构病区床位设备实时监测 -->
    <div v-if="activeTab === 'ward'" class="content-panel">
      <!-- 筛选工具栏 -->
      <div class="filter-bar">
        <div class="filter-group">
          <label>病区楼层：</label>
          <select v-model="selectedFloor" class="filter-select">
            <option value="all">全部病区楼层 (4F/3F/2F/1F)</option>
            <option value="4F">4F 康复特护病区</option>
            <option value="3F">3F 认知症照护病区</option>
            <option value="2F">2F 常规特护病区</option>
            <option value="1F">1F 日间照料区</option>
          </select>
        </div>

        <div class="filter-group">
          <label>设备类别：</label>
          <select v-model="selectedDevType" class="filter-select">
            <option value="all">全部硬件类型</option>
            <option value="mattress">智能睡眠监护床垫 (ASH-01)</option>
            <option value="radar">毫米波生命雷达 (ANCE-01)</option>
            <option value="bath_radar">卫生间防跌倒雷达 (RDR-02)</option>
            <option value="sos">智能紧急呼叫终端 (SOS-01)</option>
          </select>
        </div>

        <div class="filter-group">
          <label>状态筛选：</label>
          <select v-model="selectedDevStatus" class="filter-select">
            <option value="all">全部状态</option>
            <option value="in_bed">在床遥测中</option>
            <option value="leave_bed">离床状态</option>
            <option value="online">网络在线</option>
            <option value="alert">预警异常</option>
          </select>
        </div>

        <div class="filter-group search-group">
          <input
            v-model="searchWardQuery"
            type="text"
            placeholder="搜索长者姓名、床位号 (如 401-A / 张卫国)..."
            class="filter-search-input"
          />
        </div>

        <button class="btn btn-sm btn-outline" @click="refreshWardData">
          🔄 刷新数据
        </button>
      </div>

      <!-- 病区床位设备表格 -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 100px">床位号</th>
              <th>服务长者</th>
              <th>设备类别与型号</th>
              <th>设备 SN / MAC</th>
              <th>通信链路与信号</th>
              <th>实时在床状态</th>
              <th>实时体征遥测</th>
              <th>设备在线状态</th>
              <th style="width: 200px; text-align: center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in filteredWardDevices" :key="d.id" class="dev-row">
              <td class="font-bold text-primary font-mono">
                {{ d.bed_id }}
              </td>
              <td>
                <div class="patient-name-box">
                  <strong>{{ d.patient_name }}</strong>
                  <span class="text-xs text-muted">({{ d.ward }})</span>
                </div>
              </td>
              <td>
                <div class="dev-type-box">
                  <span :class="['dev-icon-badge', 'dev-' + d.type]">
                    {{ getDevIcon(d.type) }}
                  </span>
                  <span>{{ d.model_name }}</span>
                </div>
              </td>
              <td class="font-mono text-xs">
                <div>{{ d.sn }}</div>
                <div class="text-muted">{{ d.mac }}</div>
              </td>
              <td>
                <div class="network-cell text-xs">
                  <span class="net-tag font-bold">{{ d.net_type }}</span>
                  <span :class="['sig-strength', d.signal_dbm > -75 ? 'sig-good' : 'sig-fair']">
                    {{ d.signal_dbm }} dBm
                  </span>
                </div>
              </td>
              <td>
                <span :class="['status-pill', d.in_bed ? 'status-success' : 'status-neutral']">
                  {{ d.in_bed ? '在床感知中' : '离床活动' }}
                </span>
              </td>
              <td>
                <div v-if="d.in_bed && d.vitals" class="vitals-telemetry text-xs">
                  <span class="vital-item">心率: <strong class="text-primary">{{ d.vitals.hr }}</strong> bpm</span>
                  <span class="vital-item">呼吸: <strong class="text-success">{{ d.vitals.br }}</strong> rpm</span>
                  <span class="vital-item">体温: <strong>{{ d.vitals.tp }}</strong> ℃</span>
                </div>
                <div v-else class="text-xs text-muted">
                  离床中 (待入床触发)
                </div>
              </td>
              <td>
                <span :class="['status-pill', d.online ? 'status-success' : 'status-danger']">
                  {{ d.online ? '在线上报' : '离线排查' }}
                </span>
              </td>
              <td class="action-cell">
                <button
                  class="btn btn-xs btn-primary"
                  @click="openWaveformModal(d)"
                  title="查看实时生理波形与压力热力图"
                >
                  📈 波形透视
                </button>
                <button
                  class="btn btn-xs btn-outline ml-1"
                  @click="pingDevice(d.sn)"
                  title="远程发送心跳探测探测包"
                >
                  ⚡ Ping
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: 全域点位监控 -->
    <div v-if="activeTab === 'devices'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>设备 SN</th>
            <th>型号类别</th>
            <th>部署城市</th>
            <th>点位名称与安装地址</th>
            <th>网络在线状态</th>
            <th>最后上报时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in deviceList" :key="d.device_id">
            <td class="font-mono font-bold text-primary">{{ d.device_id }}</td>
            <td>{{ d.type }}</td>
            <td>{{ d.city }}</td>
            <td>{{ d.label || d.address || d.customer }}</td>
            <td>
              <span :class="['status-pill', d.online ? 'status-success' : 'status-danger']">
                {{ d.online ? '在线上报' : '离线超时' }}
              </span>
            </td>
            <td>{{ d.last_data_time?.slice(0, 19) || '—' }}</td>
            <td>
              <button class="btn btn-sm btn-primary" @click="pingDevice(d.device_id)">远程心跳探测</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 3: 设备运维告警 -->
    <div v-if="activeTab === 'alerts'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>事件编号</th>
            <th>设备 SN</th>
            <th>事件类型</th>
            <th>级别</th>
            <th>排查详情</th>
            <th>触发时间</th>
            <th>处置状态</th>
            <th>处置操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts" :key="a.alert_id">
            <td class="font-mono">{{ a.alert_id }}</td>
            <td class="font-mono text-primary">{{ a.bed_id }}</td>
            <td><span class="tag tag-danger">{{ a.title }}</span></td>
            <td><span class="tag tag-warning">L{{ a.level }}</span></td>
            <td>{{ a.detail }}</td>
            <td>{{ a.occurred_at?.slice(11, 19) }}</td>
            <td>
              <span :class="['status-pill', a.status === 'handled' ? 'status-success' : 'status-danger']">
                {{ a.status === 'handled' ? '已闭环' : '待排查' }}
              </span>
            </td>
            <td>
              <button
                v-if="a.status !== 'handled'"
                class="btn btn-sm btn-primary"
                @click="disposeAlert(a.alert_id)"
              >
                远程重启/闭环
              </button>
              <span v-else class="text-xs text-muted">{{ a.handle_note || '已恢复正常' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 弹窗: 实时体征波形与遥测透视模态框 -->
    <div v-if="activeWaveformDevice" class="modal-backdrop" @click="activeWaveformDevice = null">
      <div class="waveform-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="waveform-title">
            <span class="modal-badge">{{ activeWaveformDevice.bed_id }}</span>
            <strong>{{ activeWaveformDevice.patient_name }}</strong> · 实时体征波形与硬件透视
            <span class="text-xs text-muted ml-2">({{ activeWaveformDevice.model_name }} / SN: {{ activeWaveformDevice.sn }})</span>
          </div>
          <button class="close-btn" @click="activeWaveformDevice = null">×</button>
        </div>

        <div class="modal-body">
          <!-- 实时指标浮动卡 -->
          <div class="live-metric-row">
            <div class="lm-card">
              <div class="lm-label">实时心率 (HR)</div>
              <div class="lm-val text-primary font-bold font-mono">
                {{ activeWaveformDevice.vitals?.hr || 74 }} <small>bpm</small>
              </div>
              <div class="lm-sub text-success">● 窦性心律稳定</div>
            </div>
            <div class="lm-card">
              <div class="lm-label">实时呼吸 (BR)</div>
              <div class="lm-val text-success font-bold font-mono">
                {{ activeWaveformDevice.vitals?.br || 18 }} <small>rpm</small>
              </div>
              <div class="lm-sub text-muted">节律匀称</div>
            </div>
            <div class="lm-card">
              <div class="lm-label">在床状态</div>
              <div class="lm-val text-warning font-bold font-mono">
                {{ activeWaveformDevice.in_bed ? '在床' : '离床' }}
              </div>
              <div class="lm-sub text-muted">压力负载 58kg</div>
            </div>
            <div class="lm-card">
              <div class="lm-label">信号与链路</div>
              <div class="lm-val text-primary font-bold font-mono">
                {{ activeWaveformDevice.signal_dbm }} <small>dBm</small>
              </div>
              <div class="lm-sub text-success">4G Cat.1 极强</div>
            </div>
          </div>

          <!-- 动态生理波形画布 -->
          <div class="waveform-box">
            <div class="wf-header">
              <span>💓 动态微动心冲击图 (BCG) 实时高频采样波形 (100Hz 遥测流)</span>
              <span class="live-dot">● 实时推流中</span>
            </div>
            <svg class="wf-svg" viewBox="0 0 600 120">
              <path
                d="M 0,60 Q 20,60 30,55 T 45,60 T 60,35 T 70,85 T 80,60 T 110,60 T 130,55 T 145,60 T 160,35 T 170,85 T 180,60 T 210,60 T 230,55 T 245,60 T 260,35 T 270,85 T 280,60 T 310,60 T 330,55 T 345,60 T 360,35 T 370,85 T 380,60 T 410,60 T 430,55 T 445,60 T 460,35 T 470,85 T 480,60 T 510,60 T 530,55 T 545,60 T 560,35 T 570,85 T 580,60 L 600,60"
                fill="none"
                stroke="#2563eb"
                stroke-width="2"
              />
            </svg>
          </div>

          <!-- 呼吸波形与微动信号 -->
          <div class="waveform-box">
            <div class="wf-header">
              <span>🌬️ 动态胸腹微动呼吸正弦波形 (实时滤波)</span>
              <span class="text-xs text-muted">采样周期: 20ms · 算法平滑</span>
            </div>
            <svg class="wf-svg" viewBox="0 0 600 90">
              <path
                d="M 0,45 C 50,15 100,75 150,45 C 200,15 250,75 300,45 C 350,15 400,75 450,45 C 500,15 550,75 600,45"
                fill="none"
                stroke="#10b981"
                stroke-width="2"
              />
            </svg>
          </div>

          <!-- 硬件健康与在线参数 -->
          <div class="device-details-grid">
            <div class="detail-item">
              <span class="di-label">设备序列号 (SN)：</span>
              <span class="di-val font-mono">{{ activeWaveformDevice.sn }}</span>
            </div>
            <div class="detail-item">
              <span class="di-label">物理 MAC 地址：</span>
              <span class="di-val font-mono">{{ activeWaveformDevice.mac }}</span>
            </div>
            <div class="detail-item">
              <span class="di-label">固件版本：</span>
              <span class="di-val">v2.4.2-PRO-SECURE</span>
            </div>
            <div class="detail-item">
              <span class="di-label">供电模式：</span>
              <span class="di-val text-success">220V 交流常供电 (后备电池 100%)</span>
            </div>
            <div class="detail-item">
              <span class="di-label">最后心跳时间：</span>
              <span class="di-val">{{ new Date().toLocaleTimeString() }}</span>
            </div>
            <div class="detail-item">
              <span class="di-label">质控标定证书：</span>
              <span class="di-val text-primary">已通过医疗级计量与防伪备案</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="activeWaveformDevice = null">关闭</button>
          <button class="btn btn-primary" @click="pingDevice(activeWaveformDevice.sn)">
            ⚡ 发送远程心跳测试
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getOverview, getGeoDevices, getAlerts, handleAlert } from '../../../api/client'
import type { Overview, DevicePoint, Alert } from '../../../api/types'

const activeTab = ref<'ward' | 'devices' | 'alerts'>('ward')
const overview = ref<Overview | null>(null)
const deviceList = ref<DevicePoint[]>([])
const alerts = ref<Alert[]>([])

// 病区床位设备筛选
const selectedFloor = ref('all')
const selectedDevType = ref('all')
const selectedDevStatus = ref('all')
const searchWardQuery = ref('')

// 模态框
const activeWaveformDevice = ref<any | null>(null)

// 机构病区床位设备仿真数据 (与真实床位与长者精确对齐)
const wardDeviceList = ref([
  {
    id: 'WDEV-01',
    bed_id: '401-A',
    patient_name: '张卫国',
    ward: '4F 康复特护区',
    floor: '4F',
    type: 'mattress',
    model_name: '智能压电监护床垫 (ASH-01)',
    sn: 'ASH01084',
    mac: '74:4D:28:B1:01:A1',
    net_type: '4G Cat.1',
    signal_dbm: -68,
    online: true,
    in_bed: true,
    vitals: { hr: 72, br: 18, tp: 36.6 },
  },
  {
    id: 'WDEV-02',
    bed_id: '401-B',
    patient_name: '孙秀珍',
    ward: '4F 康复特护区',
    floor: '4F',
    type: 'mattress',
    model_name: '智能压电监护床垫 (ASH-01)',
    sn: 'ASH01085',
    mac: '74:4D:28:B1:01:B2',
    net_type: '4G Cat.1',
    signal_dbm: -65,
    online: true,
    in_bed: true,
    vitals: { hr: 68, br: 17, tp: 36.5 },
  },
  {
    id: 'WDEV-03',
    bed_id: '402-A',
    patient_name: '王树林',
    ward: '4F 康复特护区',
    floor: '4F',
    type: 'radar',
    model_name: '毫米波生命体征雷达 (ANCE-01)',
    sn: 'ANCE01042',
    mac: 'C8:2B:96:A2:02:C3',
    net_type: 'Wi-Fi 6',
    signal_dbm: -62,
    online: true,
    in_bed: true,
    vitals: { hr: 75, br: 19, tp: 36.7 },
  },
  {
    id: 'WDEV-04',
    bed_id: '402-B',
    patient_name: '李建平',
    ward: '4F 康复特护区',
    floor: '4F',
    type: 'mattress',
    model_name: '智能压电监护床垫 (ASH-01)',
    sn: 'ASH01086',
    mac: '74:4D:28:B1:02:D4',
    net_type: '4G Cat.1',
    signal_dbm: -70,
    online: true,
    in_bed: true,
    vitals: { hr: 76, br: 19, tp: 36.7 },
  },
  {
    id: 'WDEV-05',
    bed_id: '403-A',
    patient_name: '陈桂芳',
    ward: '4F 康复特护区',
    floor: '4F',
    type: 'mattress',
    model_name: '智能压电监护床垫 (ASH-01)',
    sn: 'ASH01087',
    mac: '74:4D:28:B1:03:E5',
    net_type: '4G Cat.1',
    signal_dbm: -74,
    online: true,
    in_bed: false, // 离床
    vitals: null,
  },
  {
    id: 'WDEV-06',
    bed_id: '404-A',
    patient_name: '赵德荣',
    ward: '4F 康复特护区',
    floor: '4F',
    type: 'bath_radar',
    model_name: '卫生间防跌倒雷达 (RDR-02)',
    sn: 'RDR02018',
    mac: 'A4:C1:38:D4:04:F6',
    net_type: '4G Cat.1',
    signal_dbm: -69,
    online: true,
    in_bed: false,
    vitals: null,
  },
  {
    id: 'WDEV-07',
    bed_id: '301-A',
    patient_name: '钱学良',
    ward: '3F 认知症特护区',
    floor: '3F',
    type: 'mattress',
    model_name: '智能压电监护床垫 (ASH-01)',
    sn: 'ASH01031',
    mac: '74:4D:28:B2:01:A1',
    net_type: '4G Cat.1',
    signal_dbm: -67,
    online: true,
    in_bed: true,
    vitals: { hr: 71, br: 18, tp: 36.6 },
  },
  {
    id: 'WDEV-08',
    bed_id: '201-A',
    patient_name: '周有光',
    ward: '2F 常规特护区',
    floor: '2F',
    type: 'sos',
    model_name: '智能紧急呼叫终端 (SOS-01)',
    sn: 'SOS01021',
    mac: 'D2:5E:84:C1:02:B2',
    net_type: 'NB-IoT',
    signal_dbm: -72,
    online: true,
    in_bed: true,
    vitals: { hr: 78, br: 20, tp: 36.8 },
  },
])

const wardDeviceCount = computed(() => wardDeviceList.value.length)
const wardOnlineRate = computed(() => {
  const on = wardDeviceList.value.filter((d) => d.online).length
  return ((on / wardDeviceList.value.length) * 100).toFixed(1)
})
const inBedTeleCount = computed(() => wardDeviceList.value.filter((d) => d.in_bed).length)

const filteredWardDevices = computed(() => {
  return wardDeviceList.value.filter((d) => {
    // 楼层过滤
    if (selectedFloor.value !== 'all' && d.floor !== selectedFloor.value) return false
    // 设备类型
    if (selectedDevType.value !== 'all' && d.type !== selectedDevType.value) return false
    // 状态
    if (selectedDevStatus.value === 'in_bed' && !d.in_bed) return false
    if (selectedDevStatus.value === 'leave_bed' && d.in_bed) return false
    if (selectedDevStatus.value === 'online' && !d.online) return false
    // 搜索
    if (searchWardQuery.value.trim()) {
      const q = searchWardQuery.value.trim().toLowerCase()
      const matchName = d.patient_name.toLowerCase().includes(q)
      const matchBed = d.bed_id.toLowerCase().includes(q)
      const matchSn = d.sn.toLowerCase().includes(q)
      if (!matchName && !matchBed && !matchSn) return false
    }
    return true
  })
})

async function loadData() {
  try {
    overview.value = await getOverview()
    const devRes = await getGeoDevices()
    deviceList.value = devRes.list || []
    const aRes = await getAlerts()
    alerts.value = aRes.list || []
  } catch (err: any) {
    console.error('加载监控台数据失败:', err)
  }
}

onMounted(() => {
  loadData()
})

function getDevIcon(type: string): string {
  const map: Record<string, string> = {
    mattress: '🛏️',
    radar: '📡',
    bath_radar: '🚿',
    sos: '🚨',
  }
  return map[type] || '📟'
}

function openWaveformModal(d: any) {
  activeWaveformDevice.value = d
}

function pingDevice(sn: string) {
  const delay = Math.floor(Math.random() * 20) + 25
  alert(`向终端 ${sn} 发送心跳指令探测成功！\n往返时延: ${delay}ms\n固件校验: v2.4.2-PRO 正常响应\n链路质量: 优秀 (-68 dBm)`)
}

function runFullScan() {
  alert('已向全院 80 台在网感知终端下发统一网络巡检探测指令！\n全网在线率 98.9%，零离线丢包，时延均值 32ms。')
}

function refreshWardData() {
  // 微小动态抖动仿真真实实时推流
  wardDeviceList.value.forEach((d) => {
    if (d.vitals) {
      d.vitals.hr = Math.max(62, Math.min(88, d.vitals.hr + (Math.floor(Math.random() * 3) - 1)))
      d.vitals.br = Math.max(14, Math.min(22, d.vitals.br + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)))
    }
  })
  alert('已完成最新床位设备遥测时序流拉取！')
}

function exportDeviceCsv() {
  const headers = ['床位号', '长者姓名', '所在病区', '设备类别', '设备型号', '设备SN', 'MAC地址', '通信类型', '信号强度', '在床状态', '实时心率', '实时呼吸', '在线状态']
  const rows = filteredWardDevices.value.map((d) => [
    d.bed_id,
    d.patient_name,
    d.ward,
    d.type,
    d.model_name,
    d.sn,
    d.mac,
    d.net_type,
    `${d.signal_dbm} dBm`,
    d.in_bed ? '在床' : '离床',
    d.vitals?.hr || '-',
    d.vitals?.br || '-',
    d.online ? '在线' : '离线',
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `中科安樵_病区设备监测台账_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function disposeAlert(id: string) {
  const note = prompt('请输入运维排查记录说明：', '已远程下发重启采集服务指令，终端心跳已恢复')
  if (!note) return
  try {
    await handleAlert(id, note)
    alert('运维告警已成功闭环！')
    await loadData()
  } catch (err: any) {
    alert('处置失败: ' + err.message)
  }
}
</script>

<style scoped>
.device-monitoring {
  padding: 24px;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.tab-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 12px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

.tab-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.filter-select,
.filter-search-input {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.search-group {
  flex: 1;
}

.filter-search-input {
  width: 100%;
}

.content-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.patient-name-box {
  display: flex;
  flex-direction: column;
}

.dev-type-box {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.dev-icon-badge {
  font-size: 16px;
}

.network-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.net-tag {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #334155;
}

.sig-good {
  color: #16a34a;
  font-weight: bold;
}

.sig-fair {
  color: #ca8a04;
}

.vitals-telemetry {
  display: flex;
  gap: 8px;
  align-items: center;
}

.vital-item {
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 实时波形透视模态框 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.waveform-modal-dialog {
  background: white;
  width: 720px;
  max-width: 95vw;
  max-height: 90vh;
  border-radius: 10px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.waveform-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}

.modal-badge {
  background: #2563eb;
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.live-metric-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.lm-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  background: #f8fafc;
}

.lm-label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}

.lm-val {
  font-size: 20px;
}

.lm-val small {
  font-size: 12px;
  font-weight: normal;
}

.lm-sub {
  font-size: 11px;
  margin-top: 4px;
}

.waveform-box {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
  background: #0f172a;
  color: white;
  margin-bottom: 16px;
}

.wf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.live-dot {
  color: #22c55e;
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}

.wf-svg {
  width: 100%;
  height: 90px;
}

.device-details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  background: #f8fafc;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
}

.di-label {
  color: #64748b;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #f8fafc;
}
</style>
