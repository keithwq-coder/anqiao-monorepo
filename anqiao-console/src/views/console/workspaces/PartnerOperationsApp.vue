<template>
  <div class="workspace-page partner-operations">
    <div class="page-header">
      <div>
        <div class="page-title">合作伙伴渠道运营工作台</div>
        <div class="page-subtitle">中科智护渠道部 · 拓展客户组织管理、设备部署进度与商机线索</div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">渠道编号: partner_p1</span>
        <span class="badge badge-success">数据边界: 独立渠道拓展范畴 (无跨渠道穿透)</span>
      </div>
    </div>

    <!-- 核心指标 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-num">{{ customers.length }}</div>
        <div class="metric-label">已引荐拓展客户组织</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-primary">{{ totalDevices }}</div>
        <div class="metric-label">渠道客户设备出货签约总数</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ activeMonitoringCount }}</div>
        <div class="metric-label">在床在线稳定运营台数</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">{{ leads.length }}</div>
        <div class="metric-label">渠道跟进中意向客户</div>
      </div>
    </div>

    <!-- 导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'customers' && 'active']" @click="activeTab = 'customers'">
        渠道拓展客户组织 ({{ customers.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'leads' && 'active']" @click="activeTab = 'leads'">
        商机线索报表 ({{ leads.length }})
      </button>
    </div>

    <!-- Tab 1: 渠道客户组织台账 -->
    <div v-if="activeTab === 'customers'" class="content-panel">
      <div class="panel-alert">
        <strong>数据归属合规警示：</strong> 合作伙伴属于渠道引荐方，客户组织（如养老院、照护站）是其自身机构数据的法定所有者。渠道方可查阅出货量及设备维保进度，无权访问客户长者病历、诊断及隐私数据。
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>客户组织编号</th>
            <th>客户机构全称</th>
            <th>机构联系人</th>
            <th>联系电话</th>
            <th>签约部署设备数</th>
            <th>在床稳定监测数</th>
            <th>签约合作时间</th>
            <th>渠道服务支持</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.org_id">
            <td class="font-mono font-bold">{{ c.org_id }}</td>
            <td class="font-bold text-primary">{{ c.org_name }}</td>
            <td>{{ c.contact }}</td>
            <td>{{ c.phone }}</td>
            <td><strong>{{ c.devices_count }} 台</strong></td>
            <td><span class="tag tag-success">{{ c.active_monitoring }} 台在线</span></td>
            <td>{{ c.created_at?.slice(0, 10) }}</td>
            <td>
              <button class="btn btn-sm btn-primary" @click="openSupportModal(c.org_name)">
                申请售后巡检支持
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 2: 商机线索 -->
    <div v-if="activeTab === 'leads'" class="content-panel">
      <div class="flex-between mb-3">
        <span class="font-bold">渠道意向客户与示范点跟踪报表</span>
        <button class="btn btn-sm btn-primary" @click="addLeadModal">新增意向客户线索</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>线索编号</th>
            <th>意向机构名称</th>
            <th>对接负责人</th>
            <th>预计铺设台数</th>
            <th>商务跟进状态</th>
            <th>最后更新时间</th>
            <th>跟进操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in leads" :key="l.lead_id">
            <td class="font-mono">{{ l.lead_id }}</td>
            <td class="font-bold">{{ l.name }}</td>
            <td>{{ l.contact }}</td>
            <td><strong>{{ l.estimated_devices }} 台</strong></td>
            <td>
              <span :class="['tag', l.status === '洽谈中' ? 'tag-warning' : 'tag-success']">
                {{ l.status }}
              </span>
            </td>
            <td>{{ l.updated_at }}</td>
            <td>
              <button class="btn btn-sm btn-info" @click="advanceLead(l.lead_id)">
                推进洽谈进度
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getPartnerChannels } from '../../../api/client'
import type { PartnerCustomer, PartnerLead } from '../../../api/types'

const activeTab = ref<'customers' | 'leads'>('customers')

const customers = ref<PartnerCustomer[]>([])
const leads = ref<PartnerLead[]>([])

const totalDevices = computed(() => {
  return customers.value.reduce((sum, c) => sum + (c.devices_count || 0), 0)
})

const activeMonitoringCount = computed(() => {
  return customers.value.reduce((sum, c) => sum + (c.active_monitoring || 0), 0)
})

async function loadData() {
  try {
    const res = await getPartnerChannels()
    customers.value = res.customers || []
    leads.value = res.leads || []
  } catch (err: any) {
    console.error('加载渠道数据失败:', err)
  }
}

onMounted(() => {
  loadData()
})

function openSupportModal(orgName: string) {
  alert(`已为客户 [${orgName}] 登记中科安樵总部技术巡检服务工单！`)
}

function addLeadModal() {
  const name = prompt('请输入意向机构名称:', '苏州高新区金枫长者照料站')
  if (!name) return
  leads.value.push({
    lead_id: 'LEAD-' + (leads.value.length + 1).toString().padStart(3, '0'),
    name,
    contact: '赵主任',
    status: '初次接触',
    estimated_devices: 20,
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  })
}

function advanceLead(id: string) {
  const l = leads.value.find((x) => x.lead_id === id)
  if (l) {
    l.status = '方案提报与商务签约'
    alert(`线索 ${id} 商务状态已更新！`)
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
.tag-warning {
  background: #fef3c7;
  color: #d97706;
}
.tag-success {
  background: #dcfce7;
  color: #16a34a;
}
.btn {
  padding: 6px 12px;
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
.btn-info {
  background: #0284c7;
  color: #ffffff;
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
.font-mono {
  font-family: monospace;
}
.font-bold {
  font-weight: 600;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mb-3 {
  margin-bottom: 12px;
}
</style>
