<template>
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
            <span class="main-title">{{ platformTitle.main }}</span>
            <span class="sub-title">{{ platformTitle.sub }}</span>
          </div>
        </div>

        <div v-if="authorizedWs.length > 1" class="topbar-ws-picker">
          <span class="ws-picker-icon">{{ currentWorkspaceMeta.icon }}</span>
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
          <span v-if="isSuperAdminRoaming" class="ws-roam-tag">全域跨度</span>
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
            <span class="sidebar-title-tag">{{ sidebarTitleTag }}</span>
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
              <template v-for="item in group.items" :key="item.key">
                <!-- 隐藏通用的独立“责任护工工作台”，护士直接作为“楼层智能护理台”下级人员展示 -->
                <button
                  v-if="item.key !== 'nursing_staff'"
                  :class="[
                    'nav-item',
                    {
                      active: selectedWorkspace === item.key && (item.key !== 'care_desk' || !activeCaregiver),
                    }
                  ]"
                  @click="handleNavClick(item.key)"
                  :title="item.name + ' · ' + item.desc"
                >
                  <span class="nav-item-icon">{{ item.icon }}</span>
                  <span v-show="!isSidebarCollapsed" class="nav-item-label">{{ item.name }}</span>
                  <span
                    v-if="selectedWorkspace === item.key && (item.key !== 'care_desk' || !activeCaregiver) && !isSidebarCollapsed"
                    class="active-indicator"
                  ></span>
                </button>

                <!-- 在“居家调度与服务中心”下方直接优雅展开各个片区的责任助老员名字（林小燕、陈秀英等），带头像与角色标签，轮休人员置灰；点击秒切其分管长者与待办工单 -->
                <CaregiverRosterSubMenu
                  v-if="item.key === 'home_dispatch' && !isSidebarCollapsed"
                  @select-caregiver="onSelectHomeCaregiver"
                />

                <!-- 在“楼层智能护理台”下方直接排列该病区护士名字（保持与导航项完全一致的高级质感） -->
                <div
                  v-if="item.key === 'care_desk' && !isSidebarCollapsed && showWardStaffRoster"
                  class="nurse-sub-menu"
                >
                  <!-- 院长/超管快速切楼层与护士长排班入口 -->
                  <div v-if="canSwitchFloor" class="nurse-floor-pills">
                    <button
                      v-for="fl in ['4F', '3F', '2F', '1F']"
                      :key="fl"
                      :class="['floor-pill-btn', activeRosterFloor === fl && 'active']"
                      @click="setRosterFloor(fl)"
                    >
                      {{ fl }}
                    </button>
                    <button
                      class="roster-shift-btn"
                      title="调整当班轮班设置"
                      @click="showShiftModal = true"
                    >
                      ⚙️
                    </button>
                  </div>

                  <!-- 护士名字列表（格式与楼层智能护理台完全保持一致，未轮班自动置灰） -->
                  <button
                    v-for="nurse in currentWardCaregivers"
                    :key="nurse.id"
                    :class="[
                      'nav-item',
                      'nurse-nav-item',
                      {
                        active: selectedWorkspace === 'nursing_staff' && activeCaregiver?.id === nurse.id,
                        'is-off-duty': !nurse.onDuty,
                      }
                    ]"
                    :disabled="!nurse.onDuty"
                    @click="nurse.onDuty ? handleNurseClick(nurse) : null"
                    :title="nurse.onDuty ? (nurse.name + ' (' + nurse.roleTitle + ') · 负责: ' + nurse.bedRange) : (nurse.name + ' · 今日轮休')"
                  >
                    <span class="nurse-tree-mark">└</span>
                    <span class="nav-item-icon nurse-avatar">{{ nurse.avatar }}</span>
                    <span class="nav-item-label nurse-name-label">
                      {{ nurse.name }}
                      <span v-if="nurse.roleTitle?.includes('护士长')" class="nurse-tag">护士长</span>
                      <span v-else-if="!nurse.onDuty" class="nurse-off-tag">轮休</span>
                    </span>
                    <span
                      v-if="selectedWorkspace === 'nursing_staff' && activeCaregiver?.id === nurse.id"
                      class="active-indicator"
                    ></span>
                  </button>
                  <div v-if="onDutyCaregivers.length === 0" class="nurse-roster-empty text-muted">
                    本班次暂无在册护工
                  </div>
                </div>
              </template>
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
        <DemoPoolBanner v-if="session?.principal?.pool_id === 'moumou'" />
        <div v-if="isFamily && !familyGate.canEnter" class="family-gate-wrap">
          <FamilyAccess
            :reason="familyGate.reason"
            @refresh="loadWorkbench"
            @logout="handleLogout"
          />
        </div>

        <main v-else class="shell-content">
          <!-- 运行时异常容错屏障，杜绝任何白屏 -->
          <div v-if="componentError" class="component-error-boundary">
            <div class="error-boundary-card">
              <div class="error-icon">⚠️</div>
              <h3 class="error-title">协同工作台遇到异常</h3>
              <p class="error-desc">{{ componentError }}</p>
              <div class="error-actions">
                <button type="button" class="btn btn-primary" @click="retryComponent">
                  刷新重试
                </button>
                <button type="button" class="btn btn-outline" @click="resetToDefaultWorkspace">
                  返回默认工作台
                </button>
                <button type="button" class="btn btn-ghost" @click="handleLogout">
                  重新登录
                </button>
              </div>
            </div>
          </div>

          <ConsolePatientDetail
            v-else-if="currentSubView === 'patient_detail' && patientDetailId"
            :patient-id="patientDetailId"
            @back="backToWorkspace"
          />
          <template v-else>
            <section v-if="showTodayStrip" class="today-strip" :aria-label="todayTheme">
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
              <div v-if="openApplicationId && openTimeline" class="todo-object-open">
                <ObjectContextHeader
                  object-type="application"
                  :object-id="openApplicationId"
                  :state="openTimeline.public_state"
                  back-label="收起对象"
                  @back="closeTodoObject"
                />
                <HandoffTimeline
                  :events="openTimeline.list"
                  :next-action="openTimeline.next_action"
                  :published-result="openTimeline.published_result"
                />
                <MaterialVersionList
                  v-if="openMaterials"
                  style="margin-top: 8px"
                  :items="openMaterials.list"
                  :application-status="openMaterials.status"
                />
              </div>
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
            <component
              :is="activeComponent"
              v-if="activeComponent"
              :key="selectedWorkspace + '_' + (activeCaregiver?.id || '')"
              :session="session"
            />
            <div v-else class="empty-workspace-state">
              <p>当前工作台暂无内容，请从左侧选择其它工作台</p>
            </div>
          </template>
        </main>
      </div>
    </div>

    <!-- 病区排班管理模态框 (主管/护士长可勾选在班与轮休，把没有轮班的护士变成灰色) -->
    <div v-if="showShiftModal" class="modal-backdrop" @click="showShiftModal = false">
      <div class="shift-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">
            {{ activeRosterFloor }} 病区 · 责任护工当班排班配置
          </div>
          <button class="close-btn" @click="showShiftModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-muted mb-3">
            勾选人员设为<strong>「在班值守」</strong>（大屏与侧边栏高亮展示并开放秒切）；未勾选人员设为<strong>「未排班/轮休」</strong>（侧边栏置灰为休息状态，防止非当班人员误操作）。
          </p>
          <div class="staff-toggle-list">
            <div v-for="st in currentWardCaregivers" :key="st.id" class="staff-toggle-item">
              <label class="toggle-checkbox-label">
                <input
                  type="checkbox"
                  v-model="st.onDuty"
                  class="toggle-checkbox"
                />
                <span class="st-avatar">{{ st.avatar }}</span>
                <span class="st-name font-bold">{{ st.name }}</span>
                <span class="st-title text-xs text-muted">({{ st.roleTitle }})</span>
              </label>
              <div class="bed-range-input-group">
                <label class="text-xs text-muted">分管床位：</label>
                <input
                  v-model="st.bedRange"
                  type="text"
                  class="bed-range-input"
                  :disabled="!st.onDuty"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showShiftModal = false">保存当班排班设置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, defineAsyncComponent, provide, onErrorCaptured } from 'vue'
import type { SessionInfo } from '../../api/http'
import { onRealtime } from '../../api/realtime'

const SystemAdminApp = defineAsyncComponent(() => import('./workspaces/SystemAdminApp.vue'))
const PlatformOperationsApp = defineAsyncComponent(() => import('./workspaces/PlatformOperationsApp.vue'))
const DeviceMonitoringApp = defineAsyncComponent(() => import('./workspaces/DeviceMonitoringApp.vue'))
const ReportsCenterApp = defineAsyncComponent(() => import('./workspaces/ReportsCenterApp.vue'))
import MedicalSupervisionApp from './workspaces/MedicalSupervisionApp.vue'
const InsurerOperationsApp = defineAsyncComponent(() => import('./workspaces/InsurerOperationsApp.vue'))
const AssessorApp = defineAsyncComponent(() => import('./workspaces/AssessorApp.vue'))
const NursingHomeAdminApp = defineAsyncComponent(() => import('./workspaces/NursingHomeAdminApp.vue'))
const CareDeskApp = defineAsyncComponent(() => import('./workspaces/CareDeskApp.vue'))
const NursingStaffApp = defineAsyncComponent(() => import('./workspaces/NursingStaffApp.vue'))
const PatientDossierApp = defineAsyncComponent(() => import('./workspaces/PatientDossierApp.vue'))
const PartnerOperationsApp = defineAsyncComponent(() => import('./workspaces/PartnerOperationsApp.vue'))
const ConsolePatientDetail = defineAsyncComponent(() => import('./ConsolePatientDetail.vue'))
const FamilyWorkspace = defineAsyncComponent(() => import('../../features/ltc-workbench/pages/FamilyWorkspace.vue'))

import HomeDispatchCenter from './home-care/HomeDispatchCenter.vue'
import HomeElderlyDossier from './home-care/HomeElderlyDossier.vue'
import HomeDeviceMonitoring from './home-care/HomeDeviceMonitoring.vue'
import HomeSupervisionReports from './home-care/HomeSupervisionReports.vue'
import CaregiverRosterSubMenu from '../../features/home-care/components/CaregiverRosterSubMenu.vue'
import { useHomeCareStore } from '../../features/home-care/home-care-store'
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
import DemoPoolBanner from '../../features/ltc-workbench/components/DemoPoolBanner.vue'
import TodayTodoList from '../../features/ltc-workbench/components/TodayTodoList.vue'
import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'
import DeviceLabels from '../../features/ltc-workbench/pages/DeviceLabels.vue'
import ObjectContextHeader from '../../features/ltc-workbench/components/ObjectContextHeader.vue'
import HandoffTimeline from '../../features/ltc-workbench/components/HandoffTimeline.vue'
import MaterialVersionList from '../../features/ltc-workbench/components/MaterialVersionList.vue'
import { getApplicationTimeline, getApplicationMaterials } from '../../api/ltc-application'
import { useWardStaff, type CaregiverSeat } from '../../features/ltc-workbench/ward-staff'

const props = defineProps<{
  session: SessionInfo
}>()

const emit = defineEmits<{
  (e: 'logout'): void
}>()

const homeCareStore = useHomeCareStore()

function onSelectHomeCaregiver(cg: any) {
  selectedWorkspace.value = 'home_dispatch'
  currentSubView.value = 'workspace'
  patientDetailId.value = ''
  if (location.hash.includes('patients')) {
    if (window.history.replaceState) {
      window.history.replaceState(null, '', location.pathname + location.search)
    } else {
      location.hash = ''
    }
  }
}

const WORKSPACE_METAS: Record<string, { name: string; icon: string; desc: string }> = {
  home_dispatch: { name: '居家调度与服务中心', icon: '🏡', desc: '片区网格调度/呼叫应答/助老员入户工单' },
  home_elderly_dossier: { name: '在管长者全景档案', icon: '🧓', desc: '在管长者档案/失能等级/安居感知全貌' },
  home_device_monitoring: { name: '居家设备监测情况', icon: '📡', desc: '家庭毫米波雷达/睡眠垫/SOS在线与体征遥测' },
  home_supervision_reports: { name: '服务与监管报告系统', icon: '📊', desc: '入户服务工单日志/长护险月度结算核销报告' },
  system_admin: { name: '系统超级管理员工作台', icon: '⚙', desc: '全域租户/账号矩阵/四层鉴权架构' },
  platform_operations: { name: '平台运营工作台', icon: '▦', desc: '设备资产中心/12阶段状态机/质量事件' },
  device_monitoring: { name: '设备监测情况', icon: '📡', desc: '病区床位雷达与监护设备状态/体征遥测' },
  reports_center: { name: '监测与报告系统', icon: '📊', desc: '健康体征监测/防压疮记录/医保结算合规审计报告' },
  medical_supervision: { name: '医保长护监管工作台', icon: '🛡', desc: '统筹区长护监管/四等级穿透/反欺诈门禁' },
  insurer_operations: { name: '长护险经办机构工作台', icon: '📋', desc: '受理派单/评估审核/服务计划/结算初审' },
  assessor_workspace: { name: '长护险评估师工作台', icon: '📝', desc: '任务接收/快照生成/AI洞察处置/现场评定' },
  nursing_home_admin: { name: '院长综合管理工作台', icon: '🏥', desc: '全院大盘/长护险申报结算/质量风控' },
  care_desk: { name: '楼层智能护理台', icon: '🖥️', desc: '床位监护网格/一键呼叫响应/防压疮翻身' },
  patient_dossier: { name: '在院长者全景档案', icon: '🧓', desc: '在管长者全景档案与生理体征全貌' },
  nursing_staff: { name: '责任护工照护', icon: '🩺', desc: '楼层在床监护/体征异常处置/交接班记录' },
  partner_operations: { name: '合作伙伴渠道工作台', icon: '🤝', desc: '渠道拓展组织/出货装机/意向商机' },
  family_workspace: { name: '家属申报工作台', icon: '👪', desc: '申报/补正/进度/正式结果/申诉' },
}

const authorizedWs = computed(() => allowedWorkspaces(props.session))
const WORKSPACE_GROUPS = computed(() =>
  filterWorkspaceGroups(WORKSPACE_GROUPS_CATALOG, authorizedWs.value),
)

const platformTitle = computed(() => {
  const t = props.session.tenant?.tenant_id || ''
  const r = props.session.principal?.role || props.session.staff?.role || ''
  if (
    t === 'home_care_gusu' ||
    r.startsWith('home_') ||
    r.startsWith('grid_') ||
    r === 'elderly_care_admin' ||
    r === 'rehab_specialist' ||
    r === 'rehab_therapist' ||
    r === 'dementia_specialist' ||
    r === 'case_manager' ||
    r === 'quality_inspector' ||
    r === 'ltc_biller' ||
    r === 'assistive_specialist'
  ) {
    return {
      main: '智慧居家养老服务协同平台',
      sub: '示范区智护居家养老服务中心 · 虚拟养老院中枢',
    }
  }
  if (t === 'kaijian' || r.startsWith('nursing_')) {
    return {
      main: '智慧康养机构综合运营平台',
      sub: '上海凯健国际康养中心 · 院区智慧照护中枢',
    }
  }
  if (t === 'bureau_suqian') {
    return {
      main: '宿迁市长期护理保险试点监督管理平台',
      sub: '宿迁市医疗保障局 · 长护险试点工作组',
    }
  }
  if (t === 'bureau_moumou') {
    return {
      main: '某某市长期护理保险行政监督管理平台',
      sub: '某某市医疗保障局 · 某某市长护险管理服务中心',
    }
  }
  if (
    r === 'medical_supervisor' ||
    r === 'medical_insurance_staff' ||
    r === 'medical_director' ||
    r === 'medical_auditor' ||
    r === 'medical_finance' ||
    r === 'medical_assessor_admin'
  ) {
    return {
      main: '江苏省长期护理保险监督管理信息平台',
      sub: '江苏省医疗保障局 · 长期护理保险监督指导中心',
    }
  }
  if (r.startsWith('insurer_')) {
    if (t === 'insurer_suqian' || props.session.principal?.pool_id === 'suqian') {
      return {
        main: '宿迁市长期护理保险受托经办业务协同平台',
        sub: '中国太平洋人寿保险股份有限公司 · 宿迁长护险商保经办专班',
      }
    }
    return {
      main: '某某市长期护理保险受托经办业务协同平台',
      sub: props.session.principal?.org_name || '受托经办机构',
    }
  }
  if (r === 'assessor' || r === 'assessor_expert' || r === 'assessor_admin') {
    if (t === 'assessor_suqian' || props.session.principal?.pool_id === 'suqian') {
      return {
        main: '宿迁市长期护理保险失能评定与专家评审工作台',
        sub: '宿迁市广济第三方失能等级评定中心 · 国家长护险深化试点',
      }
    }
    return {
      main: '某某市长期护理保险失能评定与专家评审工作台',
      sub: '某某市明康第三方失能评定中心 · 专业医学委员会与质控中心',
    }
  }
  return {
    main: '中科安樵 · 综合业务协同平台',
    sub: '长护险与大健康多租户云控制台',
  }
})

const sidebarTitleTag = computed(() => {
  const t = props.session.tenant?.tenant_id || ''
  const r = props.session.principal?.role || ''
  if (
    t === 'home_care_gusu' ||
    r.startsWith('home_') ||
    r.startsWith('grid_') ||
    r === 'elderly_care_admin' ||
    r === 'rehab_specialist' ||
    r === 'rehab_therapist' ||
    r === 'dementia_specialist' ||
    r === 'case_manager' ||
    r === 'quality_inspector' ||
    r === 'ltc_biller' ||
    r === 'assistive_specialist'
  ) {
    return '智慧居家服务体系'
  }
  if (t === 'kaijian' || r.startsWith('nursing_')) {
    return '康养机构照护体系'
  }
  if (r.startsWith('medical_')) {
    return '医保长护监管体系'
  }
  if (r.startsWith('insurer_')) {
    return '长护商业经办体系'
  }
  if (r.startsWith('assessor')) {
    return '失能评定与医学评审'
  }
  return '协同工作台矩阵'
})

const isSuperAdminRoaming = computed(() => {
  const r = props.session.principal?.role || ''
  return (r === 'su' || r === 'platform_admin') && selectedWorkspace.value !== props.session.workspace
})

// 病区责任护士（在“楼层智能护理台”下方显示各护士姓名）
const {
  activeCaregiver,
  activeRosterFloor,
  currentWardCaregivers,
  onDutyCaregivers,
  selectCaregiver,
  clearActiveCaregiver,
  setRosterFloor,
} = useWardStaff()

const showShiftModal = ref(false)

const showWardStaffRoster = computed(() => {
  const tenantId = props.session.tenant?.tenant_id
  const r = props.session.principal?.role || ''
  const ws = selectedWorkspace.value
  return (
    tenantId === 'kaijian' ||
    r.startsWith('nursing_') ||
    ws === 'care_desk' ||
    ws === 'nursing_staff' ||
    ws === 'nursing_home_admin'
  )
})

const canSwitchFloor = computed(() => {
  const r = props.session.principal?.role || ''
  const assignedFloors = (props.session.principal as any)?.assigned_floors || []
  return r === 'nursing_admin' || r === 'admin' || assignedFloors.length > 1
})

function handleNavClick(key: string) {
  if (key !== 'nursing_staff') {
    clearActiveCaregiver()
  }
  if (key !== 'home_dispatch') {
    homeCareStore.clearCaregiverSelection()
  }
  currentSubView.value = 'workspace'
  patientDetailId.value = ''
  if (location.hash.includes('patients')) {
    if (window.history.replaceState) {
      window.history.replaceState(null, '', location.pathname + location.search)
    } else {
      location.hash = ''
    }
  }
  switchWorkspace(key)
}

function handleNurseClick(nurse: CaregiverSeat) {
  selectCaregiver(nurse)
  currentSubView.value = 'workspace'
  patientDetailId.value = ''
  if (location.hash.includes('patients')) {
    if (window.history.replaceState) {
      window.history.replaceState(null, '', location.pathname + location.search)
    } else {
      location.hash = ''
    }
  }
  switchWorkspace('nursing_staff')
}


const role = computed(() => props.session.principal?.role || props.session.staff?.role || '')
const isFamily = computed(() => role.value === 'family_contact')
const familyGate = computed(() => {
  if (!isFamily.value) return { canEnter: true, reason: '' }
  const hasApplicant =
    !!(props.session.principal as any)?.applicant_ids?.length ||
    props.session.data_scope === 'applicant'
  if (hasApplicant) {
    return familyAccessState([{ binding_status: 'active', authorization_status: 'active' }])
  }
  return familyAccessState(null)
})

const ltcNavGroups = computed(() => filterNavGroups(LTC_NAV_GROUPS, props.session.permissions))
const todayTheme = computed(() => todayThemeFor(selectedWorkspace.value))

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  )
}
const isMobileClient = ref(detectMobile())

function getDefaultWorkspace(): string {
  const allowed = authorizedWs.value
  const isMob = isMobileClient.value
  const r = props.session.principal?.role || props.session.staff?.role || ''
  const u = (props.session.principal as any)?.username || ''

  // 1. 居家养老角色或居家组织：优先默认进入居家调度与服务中心
  if (
    ['elderly_care_admin', 'home_dispatcher', 'grid_caregiver', 'grid_team_leader', 'rehab_specialist'].includes(r) ||
    props.session.tenant?.tenant_id === 'home_care_gusu'
  ) {
    if (allowed.includes('home_dispatch')) {
      return 'home_dispatch'
    }
  }

  // 2. 手机端护工/护士登录：自适应进入个人责任护工工作台
  if (isMob && (r === 'nursing_nurse' || r === 'nursing_caregiver')) {
    if (allowed.includes('nursing_staff')) {
      return 'nursing_staff'
    }
  }

  // 3. 病区护理台席位终端账号优先直达护理台大屏 (注意必须精确匹配以 _station 结尾或 role 为 nursing_station)
  if (r === 'nursing_station' || u.endsWith('_station') || props.session.workspace === 'care_desk') {
    if (allowed.includes('care_desk')) {
      return 'care_desk'
    }
  }

  // 4. 医保监管专员
  if (r === 'medical_supervisor' || r === 'medical_insurance_staff') {
    if (allowed.includes('medical_supervision')) {
      return 'medical_supervision'
    }
  }

  // 5. 商保经办
  if (r === 'insurer_operator' || r === 'insurer_staff') {
    if (allowed.includes('insurer_operations')) {
      return 'insurer_operations'
    }
  }

  // 6. 评估师
  if (r === 'assessor') {
    if (allowed.includes('assessor_workspace')) {
      return 'assessor_workspace'
    }
  }

  // 7. session 声明的工作台
  const ws = props.session.workspace || ''
  if (ws && allowed.includes(ws)) return ws

  // 8. 默认返回第一个合法工作台
  return allowed[0] || 'platform_operations'
}

const initialWs = (() => {
  const allowed = allowedWorkspaces(props.session)
  if (typeof window !== 'undefined') {
    const m = /^#\/?(?:console\/)?([a-zA-Z0-9_-]+)/.exec(window.location.hash || '')
    if (m && m[1] !== 'patients' && m[1] !== 'console' && allowed.includes(m[1])) {
      return m[1]
    }
    try {
      const saved = sessionStorage.getItem('anqiao_active_ws')
      if (saved && allowed.includes(saved)) {
        return saved
      }
    } catch {}
  }
  return getDefaultWorkspace()
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
  if (key !== 'nursing_staff') {
    clearActiveCaregiver()
  }
  if (key !== 'home_dispatch') {
    homeCareStore.clearCaregiverSelection()
  }
  componentError.value = null
  currentSubView.value = 'workspace'
  patientDetailId.value = ''
  selectedWorkspace.value = key
  try {
    sessionStorage.setItem('anqiao_active_ws', key)
  } catch {}

  // 纯净 URL 规范：若当前带有历史 console 或 patients 的 hash 则净化地址栏，不强制添加 #/console
  if (location.hash.includes('patients') || location.hash.startsWith('#/console')) {
    if (window.history.replaceState) {
      window.history.replaceState(null, '', location.pathname + location.search)
    } else {
      location.hash = ''
    }
  }

  openApplicationId.value = null
  openTimeline.value = null
  openMaterials.value = null
  summary.value = null
  todos.value = []
  todoError.value = null
  loadWorkbench()
  if (window.innerWidth <= 1024) {
    isMobileSidebarOpen.value = false
  }
}

provide('switchWorkspace', switchWorkspace)

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
    home_dispatch: HomeDispatchCenter,
    home_elderly_dossier: HomeElderlyDossier,
    home_device_monitoring: HomeDeviceMonitoring,
    home_supervision_reports: HomeSupervisionReports,
    system_admin: SystemAdminApp,
    platform_operations: PlatformOperationsApp,
    device_monitoring: DeviceMonitoringApp,
    reports_center: ReportsCenterApp,
    medical_supervision: MedicalSupervisionApp,
    insurer_operations: InsurerOperationsApp,
    assessor_workspace: AssessorApp,
    nursing_home_admin: NursingHomeAdminApp,
    care_desk: CareDeskApp,
    patient_dossier: PatientDossierApp,
    nursing_staff: NursingStaffApp,
    partner_operations: PartnerOperationsApp,
    family_workspace: FamilyWorkspace,
  }
  return map[selectedWorkspace.value] || PlatformOperationsApp
})

const isLtcWorkbench = computed(() => {
  const ws = selectedWorkspace.value
  return [
    'assessor_workspace',
    'system_admin',
  ].includes(ws)
})

const canReadWorkbench = computed(() => {
  const perms = props.session.permissions || []
  if (perms.includes('*')) return true
  const caps = ['application:read', 'task:read', 'assessed_person:read', 'supervision:read']
  return caps.some((c) => perms.includes(c))
})

const showTodayStrip = computed(() => {
  return isLtcWorkbench.value && canReadWorkbench.value
})

const summary = ref<WorkbenchSummary | null>(null)
const todos = ref<WorkbenchTodo[]>([])
const todosLoading = ref(false)
const todoError = ref<string | null>(null)
const lastRefreshedAt = ref('')

async function loadWorkbench() {
  if (isFamily.value && !familyGate.value.canEnter) return
  if (!showTodayStrip.value) {
    summary.value = null
    todos.value = []
    todoError.value = null
    todosLoading.value = false
    return
  }
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

const openApplicationId = ref<string | null>(null)
const openTimeline = ref<Awaited<ReturnType<typeof getApplicationTimeline>> | null>(null)
const openMaterials = ref<Awaited<ReturnType<typeof getApplicationMaterials>> | null>(null)

async function openTodo(todo: WorkbenchTodo) {
  if (todo.object_type === 'application' || todo.application_id) {
    const id = todo.application_id || todo.object_id
    openApplicationId.value = id
    try {
      const [t, m] = await Promise.all([
        getApplicationTimeline(id),
        getApplicationMaterials(id),
      ])
      openTimeline.value = t
      openMaterials.value = m
    } catch (e) {
      todoError.value = e instanceof Error ? e.message : '打开对象失败'
    }
  } else {
    console.info('[workbench] open todo', todo.route_key, todo.object_id)
  }
}

function closeTodoObject() {
  openApplicationId.value = null
  openTimeline.value = null
  openMaterials.value = null
}

const isLiveConnected = ref(false)
const offFns: Array<() => void> = []

const componentError = ref<string | null>(null)

onErrorCaptured((err: any, instance, info) => {
  console.error('[WorkspaceShell] Error captured:', err, info)
  const msg = err?.message || String(err)
  if (
    msg.includes('dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch') ||
    msg.includes('importing a module script failed')
  ) {
    componentError.value = '检测到系统版本更新，正在自动刷新最新资源...'
    setTimeout(() => {
      window.location.reload()
    }, 1000)
    return false
  }
  componentError.value = `工作台组件加载遇到异常: ${msg}`
  return false
})

function retryComponent() {
  componentError.value = null
  window.location.reload()
}

function resetToDefaultWorkspace() {
  componentError.value = null
  const def = getDefaultWorkspace()
  switchWorkspace(def)
}

const currentSubView = ref<'workspace' | 'patient_detail'>('workspace')
const patientDetailId = ref<string>('')

function checkHash() {
  componentError.value = null
  const h = location.hash || ''

  // 1. 机构长者床位体征客观详情: #/patients/:id 或 #/console/patients/:id
  const mPatient = /^#\/?(?:console\/)?patients\/([^/?#]+)/.exec(h)
  if (mPatient) {
    const isInstitutionScope = authorizedWs.value.some((w) =>
      ['care_desk', 'patient_dossier', 'nursing_home_admin', 'nursing_staff'].includes(w),
    )
    if (isInstitutionScope) {
      currentSubView.value = 'patient_detail'
      patientDetailId.value = decodeURIComponent(mPatient[1])
      return
    } else {
      // 居家角色无床位概念，重定向至在管长者全景档案或默认工作台
      const target = authorizedWs.value.includes('home_elderly_dossier')
        ? 'home_elderly_dossier'
        : (authorizedWs.value[0] || 'home_dispatch')
      selectedWorkspace.value = target
      currentSubView.value = 'workspace'
      patientDetailId.value = ''
      if (window.history.replaceState) {
        window.history.replaceState(null, '', location.pathname + location.search)
      }
      return
    }
  }

  currentSubView.value = 'workspace'
  patientDetailId.value = ''

  // 2. 具体协同工作台: #/:workspaceKey 或 #/console/:workspaceKey
  const mWs = /^#\/?(?:console\/)?([a-zA-Z0-9_-]+)/.exec(h)
  if (mWs) {
    const wsKey = mWs[1]
    if (wsKey !== 'patients' && wsKey !== 'console') {
      if (authorizedWs.value.includes(wsKey)) {
        if (selectedWorkspace.value !== wsKey) {
          selectedWorkspace.value = wsKey
          try {
            sessionStorage.setItem('anqiao_active_ws', wsKey)
          } catch {}
          loadWorkbench()
        }
        return
      } else {
        // 请求的工作台不在授权范围，矫正为默认合法工作台
        const fallbackWs = getDefaultWorkspace()
        selectedWorkspace.value = fallbackWs
        loadWorkbench()
        return
      }
    }
  }

  // 3. 根路径或未指定具体工作台 -> 规范纯净 URL 访问模式，绝不强制向地址栏塞入 #/console
  const savedWs = typeof window !== 'undefined' ? sessionStorage.getItem('anqiao_active_ws') : null
  const curWs = (selectedWorkspace.value && authorizedWs.value.includes(selectedWorkspace.value))
    ? selectedWorkspace.value
    : (savedWs && authorizedWs.value.includes(savedWs))
      ? savedWs
      : getDefaultWorkspace()
  selectedWorkspace.value = curWs

  // 若地址栏存在冗余的历史 hash（如 #/console 或 #），主动净化地址栏
  if (h === '#/console' || h === '#console' || h === '#' || h === '#/') {
    if (window.history.replaceState) {
      window.history.replaceState(null, '', location.pathname + location.search)
    }
  }
}

function backToWorkspace() {
  currentSubView.value = 'workspace'
  patientDetailId.value = ''
  if (window.history.replaceState) {
    window.history.replaceState(null, '', location.pathname + location.search)
  } else {
    location.hash = ''
  }
}

function handleLogout() {
  openApplicationId.value = null
  openTimeline.value = null
  openMaterials.value = null
  summary.value = null
  todos.value = []
  todoError.value = null
  emit('logout')
}

onMounted(() => {
  const assignedFloors = (props.session.principal as any)?.assigned_floors
  if (assignedFloors && assignedFloors.length > 0) {
    setRosterFloor(assignedFloors[0])
  }
  const staffName = props.session.staff?.name || ''
  const myNurse = currentWardCaregivers.value.find((c) => staffName.includes(c.name))
  if (myNurse && props.session.workspace === 'nursing_staff') {
    selectCaregiver(myNurse)
  }
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

<style scoped>
.workspace-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  color: #1e293b;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* 顶栏 */
.shell-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
  height: 56px;
  padding: 0 20px;
  background: #0f172a;
  color: #f8fafc;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 100;
  box-sizing: border-box;
  gap: 12px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-toggle-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.sidebar-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.toggle-icon {
  font-size: 16px;
  line-height: 1;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo-img {
  height: 30px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.brand-divider {
  width: 1px;
  height: 22px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 2px;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.main-title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.sub-title {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}

.workspace-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(37, 99, 235, 0.18);
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.3);
  margin-left: 6px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.principal-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.tenant-name {
  color: #cbd5e1;
  font-weight: 500;
}

.staff-name {
  color: #ffffff;
  font-weight: 600;
}

.scope-tag {
  background: #1e293b;
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.realtime-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.realtime-status.connected {
  color: #4ade80;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.realtime-status.connected .pulse-dot {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.logout-btn {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #ef4444;
  color: #ffffff;
}

/* 主体分栏布局 */
.shell-layout {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - 56px);
  position: relative;
}

/* 侧边导航栏 */
.workspace-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #0b1329;
  color: #94a3b8;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  z-index: 50;
  position: relative;
}

.workspace-sidebar.is-collapsed {
  width: 60px;
}

.sidebar-header {
  height: 48px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1e293b;
}

.sidebar-title-tag {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.collapse-action-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.collapse-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
}

.sidebar-scroll-area {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-title {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  padding: 4px 10px;
  letter-spacing: 0.5px;
}

.group-divider {
  height: 1px;
  background: #1e293b;
  margin: 6px 4px;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.15s;
  box-sizing: border-box;
}

.nav-item:hover:not(.active) {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
}

.nav-item.active {
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.35);
}

.nav-item.is-forbidden {
  opacity: 0.65;
}

.nav-item-icon {
  font-size: 15px;
  line-height: 1;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.nav-item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.active-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  flex-shrink: 0;
}

.scope-lock-icon {
  font-size: 10px;
  opacity: 0.7;
}
/* 楼层智能护理台下属护士名字列表（完全符合图2导航项规格） */
.nurse-sub-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  margin-bottom: 4px;
}

.nurse-roster-empty {
  padding: 6px 6px 6px 24px;
  font-size: 11px;
  opacity: 0.65;
}

.nurse-floor-pills {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 22px;
  margin-bottom: 2px;
}

.floor-pill-btn {
  flex: 1;
  padding: 2px 0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.floor-pill-btn.active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
}

.roster-shift-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.roster-shift-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

/* 护士独立条目：格式完全对齐图2的 nav-item 效果 */
.nurse-nav-item {
  height: 36px;
  padding-left: 20px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.nurse-tree-mark {
  font-size: 12px;
  color: #475569;
  margin-right: 2px;
  user-select: none;
}

.nurse-avatar {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.nurse-name-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.nurse-role-tag {
  font-size: 10px;
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: normal;
}

.nurse-off-tag {
  font-size: 10px;
  background: rgba(148, 163, 184, 0.18);
  color: #94a3b8;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: normal;
}

/* 轮休人员变灰，不可点击 */
.nurse-nav-item.is-off-duty {
  color: #64748b !important;
  opacity: 0.45;
  cursor: not-allowed !important;
  background: transparent !important;
}

.nurse-nav-item.is-off-duty:hover {
  background: transparent !important;
  color: #64748b !important;
}

/* 轮班配置弹窗 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shift-modal-dialog {
  background: #ffffff;
  border-radius: 12px;
  max-width: 480px;
  width: 90%;
  padding: 20px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25);
  color: #1e293b;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 6px;
}

.close-btn:hover {
  color: #0f172a;
}

.staff-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow-y: auto;
}

.staff-toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.toggle-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.st-avatar {
  font-size: 18px;
}

.bed-range-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bed-range-input {
  width: 120px;
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
}

.modal-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  text-align: right;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid #1e293b;
  background: #090e1f;
}

.footer-tenant-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-tenant-name {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer-role-name {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer-collapsed-dot {
  text-align: center;
  font-size: 16px;
  cursor: default;
}

/* 主内容区 */
.shell-main-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow-x: hidden;
}

.subview-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}

.back-btn:hover {
  background: #e2e8f0;
}

.subview-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.shell-content {
  flex: 1;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 响应式断点 */
@media (max-width: 1024px) {
  .sub-title,
  .brand-divider {
    display: none;
  }
  .workspace-sidebar {
    position: fixed;
    top: 56px;
    bottom: 0;
    left: 0;
    width: 240px;
    transform: translateX(-100%);
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
    transition: transform 0.25s ease;
    z-index: 150;
  }
  .workspace-sidebar.is-mobile-open {
    transform: translateX(0);
  }
  .sidebar-backdrop {
    position: fixed;
    top: 56px;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(2px);
    z-index: 140;
  }
}

@media (max-width: 768px) {
  .principal-info {
    font-size: 12px;
  }
  .realtime-status .status-text {
    display: none;
  }
  .topbar-left,
  .topbar-right {
    gap: 8px;
  }
  .brand-logo-img {
    height: 26px;
  }
  .main-title {
    font-size: 13px;
  }
  .workspace-badge {
    display: none;
  }
}

.topbar-ws-picker {
  margin-left: 10px;
}

.topbar-select {
  background: #1e293b;
  color: #38bdf8;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.topbar-select:hover {
  border-color: #60a5fa;
}

.ws-roam-tag {
  background: #f59e0b;
  color: #0f172a;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
  margin-left: 4px;
}


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

/* 异常容错屏障与空工作台样式 */
.component-error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480px;
  padding: 40px 20px;
}

.error-boundary-card {
  max-width: 520px;
  width: 100%;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  padding: 32px 28px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
}

.error-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 10px;
}

.error-desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin: 0 0 24px;
  word-break: break-word;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.empty-workspace-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  color: #94a3b8;
  font-size: 15px;
}
</style>
