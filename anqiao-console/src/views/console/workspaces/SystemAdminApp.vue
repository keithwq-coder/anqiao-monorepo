<template>
  <div class="workspace-page system-admin">
    <div class="page-header">
      <div>
        <div class="page-title">系统超级管理员工作台</div>
  <DeviceLabels />
        <div class="page-subtitle">中科安樵·全平台超级管理中心 · 租户组织台账、账号矩阵、四层授权架构与安全红线审计</div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">最高权限: Super Admin (su)</span>
        <span class="badge badge-success">数据范围: ALL (全域穿透)</span>
      </div>
    </div>

    <!-- 顶部核心全局指标 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-num">{{ tenants.length }}</div>
        <div class="metric-label">纳管机构租户</div>
      </div>
      <div class="metric-card">
        <div class="metric-num">{{ accounts.length }}</div>
        <div class="metric-label">平台关键业务账号</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ lifecycleLogs.length }}</div>
        <div class="metric-label">资产流转审计流水</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">{{ qualityEvents.length }}</div>
        <div class="metric-label">设备质量/合规事件</div>
      </div>
    </div>

    <!-- 安全红线提示栏 -->
    <div class="panel-alert">
      <strong>平台核心安全与合规红线 (System Redlines)：</strong>
      <span>① 杜绝护理院作为默认首页；② 长护险四等级严格分离；③ 严禁设备自动定级或直接判定欺诈；④ 渠道仅引荐客户，客户归属独立；⑤ 严禁护工跨楼层与跨租户越权。</span>
    </div>

    <!-- 导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'tenants' && 'active']" @click="activeTab = 'tenants'">
        多机构租户台账 ({{ tenants.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'accounts' && 'active']" @click="activeTab = 'accounts'">
        账号矩阵与授权映射 ({{ accounts.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'auth_arch' && 'active']" @click="activeTab = 'auth_arch'">
        四层授权架构 (RBAC+ABAC+PBAC+Scope)
      </button>
      <button :class="['tab-btn', activeTab === 'audit_logs' && 'active']" @click="activeTab = 'audit_logs'">
        全平台设备审计流水 ({{ lifecycleLogs.length }})
      </button>
    </div>

    <!-- Tab 1: 租户台账 -->
    <div v-if="activeTab === 'tenants'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>租户ID</th>
            <th>机构名称</th>
            <th>租户类型</th>
            <th>统筹/服务范围</th>
            <th>数据隔离级别</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tenants" :key="t.tenant_id">
            <td class="font-mono text-primary font-bold">{{ t.tenant_id }}</td>
            <td class="font-bold">{{ t.name }}</td>
            <td>
              <span :class="['tag', getTenantKindClass(t.kind)]">{{ getTenantKindText(t.kind) }}</span>
            </td>
            <td>{{ t.scope }}</td>
            <td><span class="tag tag-info">{{ t.isolation }}</span></td>
            <td><span class="tag tag-success">正常运营</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 2: 账号矩阵与授权映射 -->
    <div v-if="activeTab === 'accounts'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>姓名/主体身份</th>
            <th>所属机构</th>
            <th>平台角色</th>
            <th>专属工作台 (Workspace)</th>
            <th>数据权限范围</th>
            <th>初始密码</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in accounts" :key="a.username">
            <td class="font-mono text-primary font-bold">{{ a.username }}</td>
            <td>{{ a.name }}</td>
            <td>{{ a.org }}</td>
            <td><span class="tag tag-warning">{{ a.role }}</span></td>
            <td><span class="tag tag-primary font-mono">{{ a.workspace }}</span></td>
            <td><span class="tag tag-info font-mono">{{ a.scope }}</span></td>
            <td class="font-mono text-muted">2026</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 3: 四层授权架构与安全红线 -->
    <div v-if="activeTab === 'auth_arch'" class="content-panel">
      <div class="grid-2">
        <div class="arch-card">
          <div class="arch-title">1. RBAC (基于角色的访问控制)</div>
          <div class="arch-desc">
            为角色静态分配操作权限集，如 <code>su</code>, <code>admin</code>, <code>medical_supervisor</code>, <code>insurer_operator</code>, <code>assessor</code>, <code>nursing_admin</code>, <code>nursing_nurse</code>, <code>partner_admin</code>。
          </div>
          <div class="arch-points">
            <div>• <code>medical_supervisor</code>: 具备最终核定(final_ratify)、反欺诈稽核(fraud_investigate)等专属权限</div>
            <div>• <code>assessor</code>: 具备评估任务接收、快照采集、AI建议处置等现场权限</div>
            <div>• <code>nursing_nurse</code>: 仅具备床位在床监控、体征查看与交接班处置权限</div>
          </div>
        </div>

        <div class="arch-card">
          <div class="arch-title">2. ABAC (基于属性的动态控制)</div>
          <div class="arch-desc">
            结合主体属性与资源属性进行动态放行拦截。
          </div>
          <div class="arch-points">
            <div>• 护工动态楼层隔离：比对 <code>user.assigned_floor</code> 与 <code>patient.floor</code>，非分配楼层长者禁止访问</div>
            <div>• 评估任务独占：仅被指派评估师可操作该任务的快照制作与现场判定</div>
          </div>
        </div>

        <div class="arch-card">
          <div class="arch-title">3. PBAC (基于策略的门禁控制)</div>
          <div class="arch-desc">
            强制执行国家标准与业务流水线前置门禁策略。
          </div>
          <div class="arch-points">
            <div>• 国家标准申请门禁：自评等级必须 ≥ Level 2 且失能持续时间 ≥ 6 个月方可提交</div>
            <div>• 结算四步分离门禁：严禁跳步，必须依次走完 申报→核算→审核→支付核定</div>
            <div>• 12 阶段设备流转门禁：只能遵循有向无环合法状态跃迁</div>
          </div>
        </div>

        <div class="arch-card">
          <div class="arch-title">4. Data Scope (多级数据域隔离)</div>
          <div class="arch-desc">
            定义五级数据访问范围边界。
          </div>
          <div class="arch-points">
            <div>• <code>all</code>: 超级管理员与自营总控全域穿透</div>
            <div>• <code>pool</code>: 统筹区监管范围（医保局统筹区全量监管数据）</div>
            <div>• <code>tenant</code>: 单租户机构边界（如凯健护理院内数据）</div>
            <div>• <code>assigned</code>: 细粒度分配边界（责任护工分配楼层）</div>
            <div>• <code>partner_lead</code>: 渠道引荐潜客边界（严禁跨客户访问）</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 4: 全平台设备审计流水 -->
    <div v-if="activeTab === 'audit_logs'" class="content-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>日志编号</th>
            <th>设备编号</th>
            <th>源状态</th>
            <th>目标状态</th>
            <th>操作账号</th>
            <th>流转时间</th>
            <th>审计备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in lifecycleLogs" :key="log.log_id">
            <td class="font-mono text-muted">{{ log.log_id }}</td>
            <td class="font-mono text-primary font-bold">{{ log.device_id }}</td>
            <td><span class="tag tag-muted">{{ log.from_status }}</span></td>
            <td><span class="tag tag-success font-bold">➔ {{ log.to_status }}</span></td>
            <td class="font-mono">{{ log.operator_id }}</td>
            <td class="text-muted font-mono">{{ formatDate(log.occurred_at) }}</td>
            <td>{{ log.remark || '状态机流转校验通过' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import DeviceLabels from '../../../features/ltc-workbench/pages/DeviceLabels.vue'
import { ref, onMounted } from 'vue'
import { getDeviceLifecycleLogs, getQualityEvents } from '../../../api/client'
import type { DeviceLifecycleLog, QualityEvent } from '../../../api/types'

const activeTab = ref<'tenants' | 'accounts' | 'auth_arch' | 'audit_logs'>('tenants')
const lifecycleLogs = ref<DeviceLifecycleLog[]>([])
const qualityEvents = ref<QualityEvent[]>([])

const tenants = [
  { tenant_id: 'anqiao', name: '中科安樵·自营运营中心', kind: 'vendor', scope: '全国设备资产与平台总控', isolation: '全局系统级' },
  { tenant_id: 'kaijian', name: '凯健国际护理院', kind: 'nursing_home', scope: '苏州市吴江区凯健院内', isolation: '租户内部隔离 (按楼层分级)' },
  { tenant_id: 'xiangcheng_care', name: '相城康养示范中心', kind: 'nursing_home', scope: '苏州市相城区康养院区', isolation: '租户内部隔离' },
  { tenant_id: 'medical_bureau', name: '苏州市医疗保障局', kind: 'medical_insurance', scope: '苏州市市区长护险统筹区', isolation: '统筹区监管级 (Pool: bureau)' },
  { tenant_id: 'cpic_ltc', name: '中国太平洋人寿保险·苏州长护经办', kind: 'commercial_insurer', scope: '苏州市区委托长护经办业务', isolation: '委托经办级 (Pool: bureau)' },
  { tenant_id: 'gusu_assessment', name: '苏州市姑苏区长护险失能评估中心', kind: 'assessment_agency', scope: '失能上门与现场鉴定', isolation: '评估任务级' },
  { tenant_id: 'jianan_care', name: '苏州健安养老服务有限公司', kind: 'elderly_care', scope: '社区居家照护与日照中心', isolation: '定点服务级' },
  { tenant_id: 'smartcare_iot', name: '智护健康物联科技 (渠道伙伴)', kind: 'partner', scope: '智能睡眠设备渠道引荐', isolation: '渠道线索级 (Partner)' },
]

const accounts = [
  { username: 'su01', name: '系统超级管理员', org: '中科安樵·自营运营中心', role: 'su', workspace: 'system_admin', scope: 'all' },
  { username: 'admin01', name: '平台运营管理员', org: '中科安樵·自营运营中心', role: 'platform_admin', workspace: 'platform_operations', scope: 'all' },
  { username: 'user01', name: '设备监测技术员', org: '中科安樵·自营运营中心', role: 'device_user', workspace: 'device_monitoring', scope: 'tenant' },
  { username: 'medical01', name: '医保监管专员', org: '苏州市医疗保障局', role: 'medical_supervisor', workspace: 'medical_supervision', scope: 'pool' },
  { username: 'insurer01', name: '商保经办专员', org: '中国太保苏州经办机构', role: 'insurer_operator', workspace: 'insurer_operations', scope: 'pool' },
  { username: 'assessor01', name: '注册失能评估师', org: '姑苏评估中心', role: 'assessor', workspace: 'assessor_workspace', scope: 'assigned' },
  { username: 'kaijian_admin', name: '护理院院长', org: '凯健国际护理院', role: 'nursing_admin', workspace: 'nursing_home_admin', scope: 'tenant' },
  { username: 'kaijian_nurse01', name: '3F责任护工', org: '凯健国际护理院', role: 'nursing_nurse', workspace: 'nursing_staff', scope: 'assigned (3F)' },
  { username: 'kaijian_nurse02', name: '4F责任护工', org: '凯健国际护理院', role: 'nursing_nurse', workspace: 'nursing_staff', scope: 'assigned (4F)' },
  { username: 'partner_admin', name: '渠道业务总监', org: '智护健康物联科技', role: 'partner_admin', workspace: 'partner_operations', scope: 'partner_lead' },
]

function getTenantKindText(kind: string): string {
  const map: Record<string, string> = {
    vendor: '自营厂商',
    nursing_home: '护理院',
    elderly_care: '养老机构',
    medical_insurance: '医保监管',
    commercial_insurer: '经办机构',
    assessment_agency: '评估机构',
    partner: '渠道伙伴',
  }
  return map[kind] || kind
}

function getTenantKindClass(kind: string): string {
  if (kind === 'vendor') return 'tag-primary'
  if (kind === 'medical_insurance') return 'tag-danger'
  if (kind === 'commercial_insurer') return 'tag-warning'
  if (kind === 'nursing_home') return 'tag-success'
  return 'tag-info'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return iso.replace('T', ' ').substring(0, 19)
}

onMounted(async () => {
  try {
    const logsRes = await getDeviceLifecycleLogs()
    lifecycleLogs.value = logsRes.list || []
  } catch (err) {
    console.error('Failed to load lifecycle logs', err)
  }
  try {
    const eventsRes = await getQualityEvents()
    qualityEvents.value = eventsRes.list || []
  } catch (err) {
    console.error('Failed to load quality events', err)
  }
})
</script>

<style scoped>
.workspace-page {
  padding: 24px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
  color: #1e293b;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.page-subtitle {
  font-size: 14px;
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

.badge-primary { background: #e0e7ff; color: #3730a3; }
.badge-success { background: #dcfce7; color: #166534; }

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.metric-card {
  background: #ffffff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.metric-num {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
}

.metric-label {
  font-size: 13px;
  color: #64748b;
  margin-top: 8px;
}

.text-primary { color: #2563eb !important; }
.text-success { color: #16a34a !important; }
.text-warning { color: #d97706 !important; }
.text-danger { color: #dc2626 !important; }
.text-muted { color: #94a3b8 !important; }
.font-bold { font-weight: 600 !important; }
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }

.panel-alert {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 12px 16px;
  font-size: 13px;
  color: #1e40af;
  margin-bottom: 20px;
  border-radius: 0 6px 6px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tab-nav {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover { color: #0f172a; }
.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.content-panel {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 12px;
  background: #f8fafc;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.data-table tr:hover td {
  background: #f8fafc;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.tag-primary { background: #e0e7ff; color: #3730a3; }
.tag-success { background: #dcfce7; color: #166534; }
.tag-warning { background: #fef3c7; color: #92400e; }
.tag-danger { background: #fee2e2; color: #991b1b; }
.tag-info { background: #f1f5f9; color: #475569; }
.tag-muted { background: #f3f4f6; color: #6b7280; }

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.arch-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #f8fafc;
}

.arch-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.arch-desc {
  font-size: 13px;
  color: #475569;
  margin-bottom: 12px;
  line-height: 1.5;
}

.arch-points {
  font-size: 13px;
  color: #334155;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

code {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #0f172a;
}
</style>
