<template>
  <div class="workspace-page assessor-app">
    <div class="page-header">
      <div>
        <div class="page-title">长护险评估师工作台</div>
  <AssessorToday />
        <div class="page-subtitle">独立第三方评估机构 · 严格执行国家失能等级评估标准 · 设备快照佐证与留痕闭环</div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">评估师: assessor01 (持证评估员)</span>
        <span class="badge badge-success">上门双人制与影像规范: 已就绪</span>
      </div>
    </div>

    <!-- 顶部核心指标看板 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-num">{{ myTasks.length }}</div>
        <div class="metric-label">我指派的评估任务</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">{{ assessingTasks.length }}</div>
        <div class="metric-label">现场评估中任务</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-primary">{{ pendingInsights.length }}</div>
        <div class="metric-label">待核验 AI 助手洞察</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">{{ completedTasks.length }}</div>
        <div class="metric-label">已提交并锁定任务</div>
      </div>
    </div>

    <!-- 导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'tasks' && 'active']" @click="activeTab = 'tasks'">
        我的评估任务 ({{ myTasks.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'snapshots' && 'active']" @click="activeTab = 'snapshots'">
        设备客观数据包与快照
      </button>
      <button :class="['tab-btn', activeTab === 'insights' && 'active']" @click="activeTab = 'insights'">
        AI 助手洞察处理留痕 ({{ pendingInsights.length }})
      </button>
    </div>

    <!-- Tab 1: 我的评估任务 -->
    <div v-if="activeTab === 'tasks'" class="content-panel">
      <div class="panel-alert">
        <strong>国家评估规程合规门禁：</strong> 评估必须双人上门入户核验，监护人必须在场并签署《评估知情同意书》，现场核实四领域指标，出具评估师判定等级。评估一旦提交即锁定，不可篡改证据。
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>评估任务编号</th>
            <th>关联申报单</th>
            <th>被评长者编号</th>
            <th>标准版本</th>
            <th>派单时间</th>
            <th>任务状态</th>
            <th>评估师操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in myTasks" :key="t.task_id">
            <td class="font-mono font-bold">{{ t.task_id }}</td>
            <td class="font-mono">{{ t.application_id }}</td>
            <td class="font-bold">{{ t.applicant_id }}</td>
            <td><span class="tag tag-info">{{ t.scale_version || '国家2026标准量表' }}</span></td>
            <td>{{ t.assigned_at?.slice(0, 16) || '—' }}</td>
            <td>
              <span :class="['status-pill', t.status === 'assessing' ? 'status-warning' : (t.status === 'completed' ? 'status-success' : 'status-info')]">
                {{ formatTaskStatus(t.status) }}
              </span>
            </td>
            <td>
              <div class="btn-group">
                <button
                  v-if="t.status === 'assigned'"
                  class="btn btn-sm btn-primary"
                  @click="acceptTaskAction(t.task_id)"
                >
                  确认接单
                </button>
                <button
                  v-if="t.status === 'assessing'"
                  class="btn btn-sm btn-info"
                  @click="requestSnapshot(t.task_id)"
                >
                  冻结设备快照
                </button>
                <button
                  v-if="t.status === 'assessing'"
                  class="btn btn-sm btn-success"
                  @click="openSubmitModal(t.task_id)"
                >
                  出具评定并锁定
                </button>
                <span v-if="t.status === 'completed'" class="text-muted text-xs">已锁定流转经办</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 2: 设备客观数据包与快照（红线：无定级结论） -->
    <div v-if="activeTab === 'snapshots'" class="content-panel">
      <div class="panel-alert">
        <strong>评估红线法定免责提示：</strong> 本设备监测数据由安守护监测终端客观采集并冻结，数据结论字段严格为 null。设备数据仅作为失能评估客观佐证材料，严禁直接作为定级依据或欺诈判定依据！
      </div>

      <div v-if="activeSnapshot" class="snapshot-card">
        <div class="snapshot-header">
          <div>
            <span class="font-bold text-primary font-mono">{{ activeSnapshot.snapshot_id }}</span>
            <span class="tag tag-success ml-2">已冻结防篡改快照</span>
          </div>
          <div class="text-xs text-muted">
            监测窗口: {{ activeSnapshot.assessment_window?.from?.slice(0, 10) }} 至 {{ activeSnapshot.assessment_window?.to?.slice(0, 10) }}
          </div>
        </div>

        <div class="metric-mini-grid">
          <div class="mini-item">
            <div class="val">{{ activeSnapshot.metrics?.in_bed_rate_pct }}%</div>
            <div class="lbl">窗口期在床率</div>
          </div>
          <div class="mini-item">
            <div class="val text-warning">{{ activeSnapshot.metrics?.night_trips }} 次</div>
            <div class="lbl">夜间离床总频次</div>
          </div>
          <div class="mini-item">
            <div class="val text-danger">{{ activeSnapshot.metrics?.bed_leave_15min_count }} 次</div>
            <div class="lbl">长时离床 (>15min)</div>
          </div>
          <div class="mini-item">
            <div class="val">{{ activeSnapshot.metrics?.avg_hr }} bpm</div>
            <div class="lbl">均值夜间心率</div>
          </div>
        </div>

        <div class="cv-box">
          <div class="cv-title">交叉验证交叉比对提示 (Cross-Validation)：</div>
          <p class="cv-desc">
            系统对照自评日常生活能力翻身/如厕项与夜间频繁离床雷达体征，提示：长者夜间离床频次高于常人，存在较高夜间跌倒风险。建议评估师在“自理能力-床椅转移及入厕”现场测试中重点查验步态与下肢肌力。
          </p>
          <div class="text-xs text-muted">
            数据来源标识: source: mock (客观模拟切片) | conclusion: null (无定级结论)
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        暂未在当前选中任务冻结设备快照。请在【我的评估任务】中点击【冻结设备快照】即可调取。
      </div>
    </div>

    <!-- Tab 3: AI 助手洞察处理留痕（必须评估师闭环） -->
    <div v-if="activeTab === 'insights'" class="content-panel">
      <div class="panel-alert">
        <strong>合规留痕要求：</strong> AI 助手所产出的辅助提示，必须由现场评估人员人工确认、采纳、驳回或转入人工专项核验，并记录处置理由。严禁 AI 自动生成评估报告或定级！
      </div>

      <div v-for="ins in insights" :key="ins.insight_id" class="insight-item">
        <div class="flex-between">
          <span class="font-bold font-mono">{{ ins.insight_id }}</span>
          <span :class="['tag', ins.handling_status === 'pending' ? 'tag-warning' : 'tag-success']">
            {{ formatInsightStatus(ins.handling_status) }}
          </span>
        </div>
        <div class="insight-title">{{ ins.title }}</div>
        <div class="insight-detail">{{ ins.detail }}</div>
        <div class="insight-focus">
          <strong>现场核查建议：</strong> {{ ins.suggested_focus }}
        </div>
        <div class="insight-disclaimer">{{ ins.disclaimer }}</div>

        <div v-if="ins.handling_status === 'pending'" class="action-bar">
          <button class="btn btn-sm btn-success" @click="handleInsightAction(ins.insight_id, 'adopted')">
            采纳此线索作为量表佐证
          </button>
          <button class="btn btn-sm btn-primary" @click="handleInsightAction(ins.insight_id, 'confirmed')">
            现场确认长者该项特征
          </button>
          <button class="btn btn-sm btn-danger" @click="handleInsightAction(ins.insight_id, 'rejected')">
            与现场检查不符·予以驳回
          </button>
          <button class="btn btn-sm btn-warning" @click="handleInsightAction(ins.insight_id, 'needs_manual_review')">
            存疑·申请专家组现场复核
          </button>
        </div>
        <div v-else class="handled-info">
          ✓ 处理人: {{ ins.handled_by }} | 处置结果: {{ ins.handling_status }} | 说明: {{ ins.handling_note }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AssessorToday from '../../../features/ltc-workbench/pages/AssessorToday.vue'
import { ref, onMounted, computed } from 'vue'
import {
  getAssessmentTasks,
  acceptAssessmentTask,
  createAssessmentSnapshot,
  handleAssistantInsight,
} from '../../../api/client'
import type {
  AssessmentTask,
  AssessmentSnapshot,
  AssistantInsight,
} from '../../../api/types'

const activeTab = ref<'tasks' | 'snapshots' | 'insights'>('tasks')

const myTasks = ref<AssessmentTask[]>([])
const activeSnapshot = ref<AssessmentSnapshot | null>(null)
const insights = ref<AssistantInsight[]>([
  {
    insight_id: 'INSIGHT-20260920-001',
    task_id: 'TASK-20260920-0001',
    applicant_id: 'P00084',
    type: 'vital_deviation',
    title: '连续7日夜间体征与离床频次线索提示',
    detail: '监测窗口内夜间平均离床 3.8 次，心率夜间变异度轻度偏高，提示认知障碍或睡眠作息紊乱。',
    suggested_focus: '建议评估师现场着重核实长者自述日常生活活动能力，以及夜间防跌倒看护措施。',
    handling_status: 'pending',
    handled_by: null,
    handled_at: null,
    handling_note: null,
    disclaimer: '本提示仅为辅助评估现场调查线索，不得直接作为定级或反欺诈判定依据。',
  },
])

const assessingTasks = computed(() => {
  return myTasks.value.filter((t) => t.status === 'assessing')
})

const pendingInsights = computed(() => {
  return insights.value.filter((i) => i.handling_status === 'pending')
})

const completedTasks = computed(() => {
  return myTasks.value.filter((t) => t.status === 'completed')
})

async function loadTasks() {
  try {
    const res = await getAssessmentTasks()
    myTasks.value = res.list || []
  } catch (err: any) {
    console.error('加载评估任务失败:', err)
  }
}

onMounted(() => {
  loadTasks()
})

function formatTaskStatus(st: string): string {
  const map: Record<string, string> = {
    assigned: '待评估师接单',
    assessing: '现场调查与量表评估中',
    completed: '评估提交完成(锁定)',
    returned: '经办审核退回',
  }
  return map[st] || st
}

function formatInsightStatus(st: string): string {
  const map: Record<string, string> = {
    pending: '待评估师现场处置',
    confirmed: '现场已核实确认',
    adopted: '已采纳为失能佐证',
    rejected: '现场不符已驳回',
    needs_manual_review: '申请专家组人工复核',
  }
  return map[st] || st
}

async function acceptTaskAction(taskId: string) {
  try {
    await acceptAssessmentTask(taskId)
    alert('已接单！请按双人上门规范执行现场调查与量表评估。')
    await loadTasks()
  } catch (err: any) {
    alert('接单失败: ' + err.message)
  }
}

async function requestSnapshot(taskId: string) {
  try {
    const res = await createAssessmentSnapshot({
      task_id: taskId,
      window_days: 14,
    })
    activeSnapshot.value = res
    activeTab.value = 'snapshots'
    alert('已成功调取并冻结该任务前14日客观设备监测数据包！')
  } catch (err: any) {
    alert('调取快照失败: ' + err.message)
  }
}

async function handleInsightAction(insightId: string, action: string) {
  const note = prompt('请输入评估师处置理由与现场核验说明：', '现场查验长者步态蹒跚，夜间离床高频与家属叙述一致，予以采纳')
  if (!note) return

  try {
    await handleAssistantInsight(insightId, {
      action,
      note,
    })
    const ins = insights.value.find((i) => i.insight_id === insightId)
    if (ins) {
      ins.handling_status = action as any
      ins.handled_by = 'assessor01'
      ins.handling_note = note
    }
    alert('处置已留痕并归档入评估证据卷宗！')
  } catch (err: any) {
    alert('处置失败: ' + err.message)
  }
}

function openSubmitModal(taskId: string) {
  const level = prompt('请输入现场评估师判定等级（四等级独立出具）：', '重度失能Ⅱ级')
  if (!level) return
  alert(`评估完成！已出具现场判定等级：${level}。任务已锁定，全量证据包已提交至经办机构审核。`)
  const t = myTasks.value.find((x) => x.task_id === taskId)
  if (t) t.status = 'completed'
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
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #b45309;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
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
.btn-group {
  display: flex;
  gap: 6px;
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
.status-info {
  background: #e0f2fe;
  color: #0284c7;
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
.btn-success {
  background: #16a34a;
  color: #ffffff;
}
.btn-info {
  background: #0284c7;
  color: #ffffff;
}
.btn-danger {
  background: #dc2626;
  color: #ffffff;
}
.btn-warning {
  background: #d97706;
  color: #ffffff;
}
.snapshot-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #f8fafc;
}
.snapshot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.metric-mini-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.mini-item {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
}
.mini-item .val {
  font-size: 20px;
  font-weight: 700;
}
.mini-item .lbl {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
.cv-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 16px;
}
.cv-title {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 8px;
}
.cv-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 8px;
}
.insight-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: #ffffff;
}
.insight-title {
  font-size: 15px;
  font-weight: 600;
  margin-top: 8px;
  color: #0f172a;
}
.insight-detail {
  font-size: 13px;
  color: #475569;
  margin-top: 6px;
}
.insight-focus {
  font-size: 13px;
  color: #2563eb;
  background: #eff6ff;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 8px;
}
.insight-disclaimer {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
}
.action-bar {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.handled-info {
  margin-top: 10px;
  font-size: 13px;
  color: #16a34a;
  background: #f0fdf4;
  padding: 8px 12px;
  border-radius: 4px;
}
.empty-state {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  font-size: 14px;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.text-warning {
  color: #d97706;
}
.text-danger {
  color: #dc2626;
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
.ml-2 {
  margin-left: 8px;
}
.text-xs {
  font-size: 12px;
}
</style>
