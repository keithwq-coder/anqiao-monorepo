const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')
const target = path.join(root, 'src/views/console/WorkspaceShell.vue')
let src = fs.readFileSync(target, 'utf8')
const styleIdx = src.indexOf('<style scoped>')
if (styleIdx < 0) throw new Error('no style')
const styles = src.slice(styleIdx)

const template = `<template>
  <div class="workspace-shell">
    <header class="shell-topbar">
      <div class="topbar-left">
        <button
          class="sidebar-toggle-btn"
          @click="toggleSidebar"
          :title="isSidebarCollapsed ? '展开导航栏' : '折叠导航栏'"
          aria-label="切换侧边栏"
        >
          <span class="toggle-icon">☰</span>
        </button>

        <div class="brand-logo">
          <img :src="logoHorizontalWhite" alt="ANQIAO 中科安樵" class="brand-logo-img" />
          <div class="brand-divider"></div>
          <div class="brand-text">
            <span class="main-title">综合业务协同平台</span>
            <span class="sub-title">长护险与大健康多租户云控制台</span>
          </div>
        </div>

        <div class="workspace-badge">
          <span class="ws-icon">{{ currentWorkspaceMeta.icon }}</span>
          <span class="ws-name">{{ currentWorkspaceMeta.name }}</span>
          <span v-if="selectedWorkspace !== session.workspace" class="ws-roam-tag">协同漫游</span>
        </div>

        <div class="topbar-ws-picker">
          <select
            :value="selectedWorkspace"
            class="topbar-select"
            @change="switchWorkspace(($event.target as HTMLSelectElement).value)"
            title="快捷切换协同工作台"
          >
            <optgroup
              v-for="group in WORKSPACE_GROUPS"
              :key="group.name"
              :label="group.name"
            >
              <option
                v-for="item in group.items"
                :key="item.key"
                :value="item.key"
              >
                {{ item.icon }} {{ item.name }}
              </option>
            </optgroup>
          </select>
        </div>
      </div>

      <div class="topbar-right">
        <div class="principal-info">
          <span class="tenant-name">{{ session.tenant.name }}</span>
          <span class="staff-name">{{ session.staff.name }}</span>
          <ScopeBadge :session="session" />
        </div>

        <div class="realtime-status" :class="{ connected: isLiveConnected }">
          <span class="pulse-dot"></span>
          <span class="status-text">{{
            isLiveConnected
              ? '实时已连接' + (lastRefreshedAt ? ' · ' + lastRefreshedAt : '')
              : '正在重连'
          }}</span>
        </div>

        <button class="logout-btn" @click="handleLogout">
          退出
        </button>
      </div>
    </header>

    <div class="shell-layout">
      <aside
        :class="[
          'workspace-sidebar',
          {
            'is-collapsed': isSidebarCollapsed,
            'is-mobile-open': isMobileSidebarOpen,
          }
        ]"
      >
        <div class="sidebar-header">
          <div v-show="!isSidebarCollapsed" class="sidebar-title">
            <span class="sidebar-title-tag">协同工作台矩阵</span>
          </div>
          <button
            class="collapse-action-btn"
            @click="toggleSidebarCollapseOnly"
            :title="isSidebarCollapsed ? '展开侧边栏 (230px)' : '收起侧边栏 (60px)'"
          >
            {{ isSidebarCollapsed ? '»' : '«' }}
          </button>
        </div>

        <div class="sidebar-scroll-area">
          <div
            v-for="group in WORKSPACE_GROUPS"
            :key="group.name"
            class="nav-group"
          >
            <div v-show="!isSidebarCollapsed" class="group-title">
              {{ group.name }}
            </div>
            <div v-show="isSidebarCollapsed" class="group-divider"></div>

            <div class="group-items">
              <button
                v-for="item in group.items"
                :key="item.key"
                :class="[
                  'nav-item',
                  {
                    active: selectedWorkspace === item.key,
                  }
                ]"
                @click="switchWorkspace(item.key)"
                :title="item.name + ' · ' + item.desc"
              >
                <span class="nav-item-icon">{{ item.icon }}</span>
                <span v-show="!isSidebarCollapsed" class="nav-item-label">{{ item.name }}</span>
                <span
                  v-if="selectedWorkspace === item.key && !isSidebarCollapsed"
                  class="active-indicator"
                ></span>
              </button>
            </div>
          </div>
        </div>

        <div class="sidebar-footer">
          <div v-show="!isSidebarCollapsed" class="footer-tenant-box">
            <div class="footer-tenant-name">{{ session.tenant.name }}</div>
            <div class="footer-role-name">{{ session.principal?.role || session.staff.name }}</div>
          </div>
          <div v-show="isSidebarCollapsed" class="footer-collapsed-dot" :title="session.tenant.name + ' · ' + session.staff.name">
            👤
          </div>
        </div>
      </aside>

      <div
        v-if="isMobileSidebarOpen"
        class="sidebar-backdrop"
        @click="isMobileSidebarOpen = false"
      ></div>

      <div class="shell-main-area">
        <div v-if="currentSubView === 'patient_detail'" class="subview-header">
          <button class="back-btn" @click="backToWorkspace">
            ← 返回工作台 ({{ currentWorkspaceMeta.name }})
          </button>
          <span class="subview-title">长者生命体征客观监测详情</span>
        </div>

        <div v-if="isFamily && !familyGate.canEnter" class="family-gate-wrap">
          <FamilyAccess
            :reason="familyGate.reason"
            @refresh="loadWorkbench"
            @logout="handleLogout"
          />
        </div>

        <main v-else class="shell-content">
          <ConsolePatientDetail
            v-if="currentSubView === 'patient_detail' && patientDetailId"
            :patient-id="patientDetailId"
          />
          <template v-else>
            <section class="today-strip" :aria-label="todayTheme">
              <div class="today-strip-head">
                <div>
                  <span class="today-theme">{{ todayTheme }}</span>
                  <span class="today-ws">{{ currentWorkspaceMeta.name }}</span>
                </div>
                <div class="today-counts" v-if="summary">
                  <span
                    v-for="g in summary.groups"
                    :key="g.key"
                    class="count-chip"
                    :class="{ warn: g.overdue > 0 || g.due_soon > 0 }"
                    :title="g.label + ' · 逾期 ' + g.overdue + ' · 临期 ' + g.due_soon"
                  >
                    {{ g.label }} {{ g.total }}
                  </span>
                  <button type="button" class="refresh-btn" @click="loadWorkbench">刷新</button>
                </div>
              </div>
              <TodayTodoList
                :todos="todos"
                :loading="todosLoading"
                :error="todoError"
                @open="openTodo"
                @retry="loadWorkbench"
              />
              <nav v-if="ltcNavGroups.length" class="ltc-side-nav" aria-label="业务导航">
                <div v-for="g in ltcNavGroups" :key="g.key" class="ltc-nav-group">
                  <div class="ltc-nav-label">{{ g.label }}</div>
                  <div class="ltc-nav-items">
                    <span v-for="item in g.items" :key="item.key" class="ltc-nav-pill" :title="item.desc">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
              </nav>
            </section>
            <component :is="activeComponent" v-if="activeComponent" />
          </template>
        </main>
      </div>
    </div>
  </div>
</template>
`

const script = `<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import type { SessionInfo } from '../../api/http'
import { onRealtime } from '../../api/realtime'
import SystemAdminApp from './workspaces/SystemAdminApp.vue'
import PlatformOperationsApp from './workspaces/PlatformOperationsApp.vue'
import DeviceMonitoringApp from './workspaces/DeviceMonitoringApp.vue'
import MedicalSupervisionApp from './workspaces/MedicalSupervisionApp.vue'
import InsurerOperationsApp from './workspaces/InsurerOperationsApp.vue'
import AssessorApp from './workspaces/AssessorApp.vue'
import NursingHomeAdminApp from './workspaces/NursingHomeAdminApp.vue'
import NursingStaffApp from './workspaces/NursingStaffApp.vue'
import PartnerOperationsApp from './workspaces/PartnerOperationsApp.vue'
import ConsolePatientDetail from './ConsolePatientDetail.vue'
import logoHorizontalWhite from '../../assets/logo-horizontal-white.png'
import { allowedWorkspaces, familyAccessState } from '../../features/ltc-workbench/access'
import {
  WORKSPACE_GROUPS_CATALOG,
  filterWorkspaceGroups,
  filterNavGroups,
  LTC_NAV_GROUPS,
  todayThemeFor,
} from '../../features/ltc-workbench/navigation'
import {
  getWorkbenchSummary,
  getWorkbenchTodos,
  type WorkbenchSummary,
  type WorkbenchTodo,
} from '../../api/ltc-workbench'
import ScopeBadge from '../../features/ltc-workbench/components/ScopeBadge.vue'
import TodayTodoList from '../../features/ltc-workbench/components/TodayTodoList.vue'
import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'

const props = defineProps<{
  session: SessionInfo
}>()

const emit = defineEmits<{
  (e: 'logout'): void
}>()

const WORKSPACE_METAS: Record<string, { name: string; icon: string; desc: string }> = {
  system_admin: { name: '系统超级管理员工作台', icon: '⚙', desc: '全域租户/账号矩阵/四层鉴权架构' },
  platform_operations: { name: '平台运营工作台', icon: '▦', desc: '设备资产中心/12阶段状态机/质量事件' },
  device_monitoring: { name: '智能设备监测工作台', icon: '📡', desc: '终端在线监测/体征客观上报/运维告警' },
  medical_supervision: { name: '医保长护监管工作台', icon: '🛡', desc: '统筹区长护监管/四等级穿透/反欺诈门禁' },
  insurer_operations: { name: '长护险经办机构工作台', icon: '📋', desc: '受理派单/评估审核/服务计划/结算初审' },
  assessor_workspace: { name: '长护险评估师工作台', icon: '📝', desc: '任务接收/快照生成/AI洞察处置/现场评定' },
  nursing_home_admin: { name: '全院护理管理工作台', icon: '🏥', desc: '全院大盘/在院长者/楼层排班/急救告警' },
  nursing_staff: { name: '责任护理工作台', icon: '🩺', desc: '楼层在床监护/体征异常处置/交班记录' },
  partner_operations: { name: '合作伙伴渠道工作台', icon: '🤝', desc: '渠道拓展组织/出货装机/意向商机' },
  family_workspace: { name: '家属申报工作台', icon: '👪', desc: '申报/补正/进度/正式结果/申诉' },
}

const authorizedWs = computed(() => allowedWorkspaces(props.session))
const WORKSPACE_GROUPS = computed(() =>
  filterWorkspaceGroups(WORKSPACE_GROUPS_CATALOG, authorizedWs.value),
)

const role = computed(() => props.session.principal?.role || props.session.staff?.role || '')
const isFamily = computed(() => role.value === 'family_contact')
const familyGate = computed(() => {
  if (!isFamily.value) return { canEnter: true, reason: '' }
  return familyAccessState(null)
})

const ltcNavGroups = computed(() => filterNavGroups(LTC_NAV_GROUPS, props.session.permissions))
const todayTheme = computed(() => todayThemeFor(selectedWorkspace.value))

const initialWs = (() => {
  const ws = props.session.workspace || ''
  const allowed = allowedWorkspaces(props.session)
  if (ws && (!allowed.length || allowed.includes(ws))) return ws
  return allowed[0] || 'platform_operations'
})()
const selectedWorkspace = ref<string>(initialWs)

const isSidebarCollapsed = ref(false)
const isMobileSidebarOpen = ref(false)

function toggleSidebar() {
  if (window.innerWidth <= 1024) {
    isMobileSidebarOpen.value = !isMobileSidebarOpen.value
  } else {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }
}

function toggleSidebarCollapseOnly() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function switchWorkspace(key: string) {
  if (authorizedWs.value.length && !authorizedWs.value.includes(key)) return
  selectedWorkspace.value = key
  summary.value = null
  todos.value = []
  todoError.value = null
  loadWorkbench()
  if (window.innerWidth <= 1024) {
    isMobileSidebarOpen.value = false
  }
}

const currentWorkspaceMeta = computed(() => {
  return WORKSPACE_METAS[selectedWorkspace.value] || {
    name: '中科安樵综合业务工作台',
    icon: '🏢',
    desc: '综合协同',
  }
})

const activeComponent = computed(() => {
  if (isFamily.value && !familyGate.value.canEnter) return null
  const map: Record<string, any> = {
    system_admin: SystemAdminApp,
    platform_operations: PlatformOperationsApp,
    device_monitoring: DeviceMonitoringApp,
    medical_supervision: MedicalSupervisionApp,
    insurer_operations: InsurerOperationsApp,
    assessor_workspace: AssessorApp,
    nursing_home_admin: NursingHomeAdminApp,
    nursing_staff: NursingStaffApp,
    partner_operations: PartnerOperationsApp,
  }
  return map[selectedWorkspace.value] || PlatformOperationsApp
})

const summary = ref<WorkbenchSummary | null>(null)
const todos = ref<WorkbenchTodo[]>([])
const todosLoading = ref(false)
const todoError = ref<string | null>(null)
const lastRefreshedAt = ref('')

async function loadWorkbench() {
  if (isFamily.value && !familyGate.value.canEnter) return
  todosLoading.value = true
  todoError.value = null
  try {
    const [s, t] = await Promise.all([
      getWorkbenchSummary({ workspace: selectedWorkspace.value }),
      getWorkbenchTodos({ workspace: selectedWorkspace.value, page: 1, page_size: 20 }),
    ])
    summary.value = s
    todos.value = t.list
    lastRefreshedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch (e) {
    todoError.value = e instanceof Error ? e.message : '待办加载失败'
    summary.value = null
    todos.value = []
  } finally {
    todosLoading.value = false
  }
}

function openTodo(todo: WorkbenchTodo) {
  console.info('[workbench] open todo', todo.route_key, todo.object_id)
}

const isLiveConnected = ref(false)
const offFns: Array<() => void> = []

const currentSubView = ref<'workspace' | 'patient_detail'>('workspace')
const patientDetailId = ref<string>('')

function checkHash() {
  const h = location.hash
  const m = /^#\\/console\\/patients\\/([^/?#]+)/.exec(h)
  if (m) {
    currentSubView.value = 'patient_detail'
    patientDetailId.value = decodeURIComponent(m[1])
  } else {
    currentSubView.value = 'workspace'
    patientDetailId.value = ''
  }
}

function backToWorkspace() {
  location.hash = '#/console'
  currentSubView.value = 'workspace'
  patientDetailId.value = ''
}

function handleLogout() {
  summary.value = null
  todos.value = []
  todoError.value = null
  emit('logout')
}

onMounted(() => {
  checkHash()
  window.addEventListener('hashchange', checkHash)
  offFns.push(onRealtime('open', () => (isLiveConnected.value = true)))
  offFns.push(onRealtime('close', () => (isLiveConnected.value = false)))
  loadWorkbench()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', checkHash)
  offFns.forEach((f) => f())
})

watch(
  () => props.session.workspace,
  (ws) => {
    if (ws && authorizedWs.value.includes(ws)) selectedWorkspace.value = ws
  },
)
</script>

`

const extraCss = `
.today-strip {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  margin: 16px 16px 0;
}
.today-strip-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.today-theme {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin-right: 8px;
}
.today-ws {
  font-size: 12px;
  color: #64748b;
}
.today-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.count-chip {
  font-size: 11px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 2px 8px;
}
.count-chip.warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #b45309;
}
.refresh-btn {
  font-size: 12px;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.ltc-side-nav {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ltc-nav-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ltc-nav-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  min-width: 72px;
}
.ltc-nav-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ltc-nav-pill {
  font-size: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px 8px;
  color: #334155;
}
.family-gate-wrap {
  padding: 0;
}
`

let outStyles = styles
const styleEnd = outStyles.lastIndexOf('</style>')
if (styleEnd < 0) throw new Error('no style end')
outStyles = outStyles.slice(0, styleEnd) + extraCss + outStyles.slice(styleEnd)

const out = template + '\n' + script + outStyles
fs.writeFileSync(target, out, 'utf8')
console.log('written', target, 'bytes', out.length)
