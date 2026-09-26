// 五组导航与工作台菜单（LTC-WORKBENCH-SPEC §3.2）
// 可见性：静态 permissions 决定是否出现；同一映射用于侧栏/快捷入口。

import { can, type PermissionList } from './access'

export interface NavItem {
  key: string
  label: string
  /** 任一权限即可 */
  perm?: string
  route?: string
  badgeGroup?: string
  desc?: string
}

export interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

export const LTC_NAV_GROUPS: NavGroup[] = [
  {
    key: 'today',
    label: '今日必做',
    items: [
      { key: 'today_todos', label: '待办与临期', perm: 'application:read', route: '/saas/', badgeGroup: 'all', desc: '待办、临期、逾期、最近回执' },
    ],
  },
  {
    key: 'operations',
    label: '业务办理',
    items: [
      { key: 'applications', label: '申请办理', perm: 'application:read', route: '/saas/', desc: '本角色申请列表' },
      { key: 'tasks', label: '任务与派单', perm: 'task:read', route: '/saas/', desc: '评估任务、派单、退回' },
      { key: 'work_orders', label: '监管工单', perm: 'supervision:read', route: '/saas/', desc: '工单流转与回执' },
      { key: 'settlements', label: '结算办理', perm: 'settlement:read', route: '/saas/', desc: '结算初审与历史' },
      { key: 'appeals', label: '申诉', perm: 'appeal:file', route: '/saas/', desc: '申诉发起与进度（阶段 D）' },
    ],
  },
  {
    key: 'dossier',
    label: '对象档案',
    items: [
      { key: 'subjects', label: '被评估人', perm: 'assessed_person:read', route: '/saas/', desc: '对象与授权摘要' },
      { key: 'materials', label: '申请材料', perm: 'application:read', route: '/saas/', desc: '材料版本（阶段 C）' },
      { key: 'records', label: '病历档案', perm: 'assessed_person:read', route: '/saas/', desc: '病历与设备关联' },
    ],
  },
  {
    key: 'reports',
    label: '查询与报告',
    items: [
      { key: 'report_generate', label: '生成报告', perm: 'report:generate', route: '/saas/', desc: '范围内生成' },
      { key: 'report_read', label: '报告查询', perm: 'report:read', route: '/saas/', desc: '历史与导出' },
    ],
  },
  {
    key: 'supervision',
    label: '监管与配置',
    items: [
      { key: 'cases', label: '监管案件', perm: 'supervision:read', route: '/saas/', desc: '抽审与暂缓' },
      { key: 'device_compare', label: '设备比对', perm: 'monitoring:read', route: '/saas/', desc: '遥测摘要与比对' },
      { key: 'device_labels', label: '设备标签', perm: 'device:read', route: '/saas/', desc: '标签与项目（阶段 D）' },
      { key: 'project_config', label: '项目配置', perm: 'device:write', route: '/saas/', desc: '配置下发（阶段 D）' },
    ],
  },
]

export interface WorkspaceMenuItem {
  key: string
  name: string
  icon: string
  desc: string
}

export interface WorkspaceNavGroup {
  name: string
  items: WorkspaceMenuItem[]
}

export const WORKSPACE_GROUPS_CATALOG: WorkspaceNavGroup[] = [
  {
    name: '社区居家养老服务',
    items: [
      { key: 'home_dispatch', name: '居家调度与服务中心', icon: '🏡', desc: '片区网格调度/呼叫应答/助老员入户工单' },
      { key: 'home_elderly_dossier', name: '在管长者全景档案', icon: '🧓', desc: '72位在管长者/失能等级/安居感知全貌' },
      { key: 'home_device_monitoring', name: '居家设备监测情况', icon: '📡', desc: '家庭毫米波雷达/睡眠垫/SOS在线与体征遥测' },
      { key: 'home_supervision_reports', name: '服务与监管报告系统', icon: '📊', desc: '入户服务工单日志/长护险月度结算核销报告' },
    ],
  },
  {
    name: '养老机构院舍照护',
    items: [
      { key: 'nursing_home_admin', name: '院长综合管理', icon: '🏥', desc: '全院大盘/长护险申报结算/质量风控' },
      { key: 'care_desk', name: '楼层智能护理台', icon: '🖥️', desc: '床位监护网格/一键呼叫响应/巡更打卡' },
      { key: 'patient_dossier', name: '在院长者全景档案', icon: '🧓', desc: '87位在管长者/生命体征感知/自理等级全貌' },
      { key: 'device_monitoring', name: '设备监测情况', icon: '📡', desc: '病区床位雷达与监护设备状态/体征遥测' },
      { key: 'reports_center', name: '监测与报告系统', icon: '📊', desc: '健康监测/防压疮记录/医保结算合规报告' },
      { key: 'nursing_staff', name: '责任护工工作台', icon: '🩺', desc: '楼层在床监护/体征异常处置/交接班记录' },
    ],
  },
  {
    name: '长护险医保与监管',
    items: [
      { key: 'medical_supervision', name: '医保长护监管', icon: '🛡', desc: '统筹区监管/四等级穿透/反欺诈' },
      { key: 'insurer_operations', name: '长护经办机构', icon: '📋', desc: '受理派单/待遇审核/四步结算' },
      { key: 'assessor_workspace', name: '失能评估师', icon: '📝', desc: '现场入户/客观快照/禁止机器定级' },
    ],
  },
  {
    name: '平台运营与总控',
    items: [
      { key: 'system_admin', name: '系统超级管理员', icon: '⚙', desc: '全域租户/账号矩阵' },
      { key: 'platform_operations', name: '平台自营运营', icon: '▦', desc: '设备资产/生命周期' },
      { key: 'partner_operations', name: '合作伙伴渠道', icon: '🤝', desc: '引荐渠道组织/出货装机' },
    ],
  },
]

export function filterWorkspaceGroups(
  groups: WorkspaceNavGroup[],
  allowed: string[],
): WorkspaceNavGroup[] {
  const set = new Set(allowed)
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => set.has(i.key)) }))
    .filter((g) => g.items.length > 0)
}

export function filterNavGroups(groups: NavGroup[], perms: PermissionList): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.perm || can(perms, item.perm)),
    }))
    .filter((g) => g.items.length > 0)
}

/** 角色默认「今日必做」主题文案 */
export function todayThemeFor(workspace: string): string {
  const map: Record<string, string> = {
    home_dispatch: '今日调度与入户工单',
    home_elderly_dossier: '在管长者全景感知',
    home_device_monitoring: '居家设备在线与体征遥测',
    home_supervision_reports: '服务履约核销与合规审计',
    medical_supervision: '今日监管与终审',
    insurer_operations: '今日经办',
    assessor_workspace: '我的评估任务',
    family_workspace: '我的申报与进度',
    nursing_home_admin: '院长今日待办与运营督办',
    care_desk: '护理台值班监护与响应',
    patient_dossier: '在院长者体征与健康档案',
    nursing_staff: '责任护工今日任务',
    platform_operations: '项目与设备配置',
    device_monitoring: '设备在线与体征遥测',
    reports_center: '监测报告与医保审计',
    system_admin: '平台总控',
    partner_operations: '渠道与项目',
  }
  return map[workspace] || '今日必做'
}
