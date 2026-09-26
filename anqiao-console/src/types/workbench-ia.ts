/**
 * 中科安樵统一工作台信息架构与分类学 Schema（SDD 驱动）
 * 依据：docs/LTC-WORKBENCH-SPEC.md §12
 */

export type WorkbenchCategory = 'shared_terminal' | 'dedicated_personal'

// ==========================================
// 1. 第 1 类：共享终端类工作台（Shared Terminal）Schema
// ==========================================

export interface OperatorProfile {
  id: string
  name: string
  avatar: string
  roleTitle: string
  bedRange?: string
  onDuty: boolean
  lastActiveAt?: number
}

export interface PreemptAlarm {
  alertId: string
  patientOrElderlyId: string
  patientName: string
  bedOrLocation: string
  level: 1 | 2 | 3
  type: 'fall' | 'sos' | 'vitals_critical' | 'off_bed_timeout'
  title: string
  triggeredAt: string
}

export interface SharedTerminalState {
  terminalId: string
  terminalType: 'care_desk' | 'home_dispatch' | 'nursing_staff'
  wardOrArea: string
  roster: OperatorProfile[]
  activeOperator: OperatorProfile | null
  autoReturnCountdown: number // 默认 30 秒倒计时
  autoReturnTimerId: any | null
  preemptAlarm: PreemptAlarm | null
  stashedWorkState: Record<string, any> | null
}

export interface DualSignaturePayload<T = any> {
  terminal_id: string
  operator_id: string
  operator_name: string
  action: string
  timestamp: string
  payload: T
}

// ==========================================
// 2. 第 2 类：独立个人账号类工作台（Dedicated Personal）Schema
// ==========================================

export interface WorkflowItem {
  stageKey: string
  label: string
  icon?: string
  badgeCount?: number
  badgeTone?: 'normal' | 'warn' | 'danger'
  statusFilter?: string
  permRequired?: string
  /** 与 /v1/ltc/workbench/summary (N01) 分组 key 对齐，前端凭该分组实时刷新徽标 */
  summaryGroup?: string
  desc?: string
}

export interface WorkflowGroup {
  groupKey: string
  groupLabel: string
  items: WorkflowItem[]
}

export interface DedicatedWorkbenchTree {
  role: string
  workspaceKey: string
  domainTitle: string
  groups: WorkflowGroup[]
}

export interface MasterDetailStudioState<T = any> {
  activeStageKey: string
  viewMode: 'master_list' | 'detail_studio'
  selectedId: string | null
  activeRecord: T | null
  evidenceChain: {
    dossier?: any
    records?: any[]
    telemetryPacket?: any
    aiInsights?: any[]
  } | null
  isDirty: boolean
}

// 主从工作间 · 案卷队列卡片（LTC-WORKBENCH-SPEC §12.4.2 Master List View）
export interface MasterQueueCard {
  id: string
  title: string
  subtitle?: string
  statusLabel: string
  statusTone: 'info' | 'warning' | 'success' | 'purple' | 'danger' | 'default'
  dueLabel?: string
  meta?: string[]
}

// ==========================================
// 3. 四大核心感知硬件「1+1+2」矩阵与供应链排产 Schema
// 依据：docs/PRODUCT-REQUIREMENTS-SPEC.md §1
// ==========================================

export type HardwareProductCategory =
  | 'health_guardian'      // AI健康守护仪 (核心基石，主要量产)
  | 'fall_detector'        // 跌倒报警器 (刚进入量产，重点新推)
  | 'trajectory_analyzer'  // 轨迹分析仪 (需要订单才能开始量产，MTO)
  | 'care_collector'       // 照护采集仪 (需要订单才能开始量产，MTO)

export type ManufacturingStage =
  | 'mass_production'          // 主要量产 (现货在库)
  | 'entering_mass_production' // 刚进入量产 (爬坡期)
  | 'make_to_order'            // 按单排产 MTO (需订单量产)

export interface HardwareProductSpec {
  category: HardwareProductCategory
  model: string
  commercialName: string
  manufacturingStage: ManufacturingStage
  stageLabel: string
  sensingMechanism: string
  primaryCommercialPurpose: string
  realPilotAnchors: string[]
}

export const HARDWARE_CATALOG_1_1_2: Record<HardwareProductCategory, HardwareProductSpec> = {
  health_guardian: {
    category: 'health_guardian',
    model: 'ASH-01 / ANCE-01',
    commercialName: 'AI健康守护仪',
    manufacturingStage: 'mass_production',
    stageLabel: '核心基石，目前主要量产的产品',
    sensingMechanism: '高精度压电微动体征感应垫 / 毫米波连续体征感知雷达',
    primaryCommercialPurpose: '7×24h 卧床体征监测与医保长护险失能客观证据基线包',
    realPilotAnchors: ['ASH01086', 'ASH01078', 'ASH01092', 'ANCE00001', 'ASH01146'],
  },
  fall_detector: {
    category: 'fall_detector',
    model: 'AFD-01',
    commercialName: '跌倒报警器',
    manufacturingStage: 'entering_mass_production',
    stageLabel: '刚进入量产，重点推向市场的生命安全防线',
    sensingMechanism: '60GHz/77GHz 毫米波微动点云雷达空间姿态解析',
    primaryCommercialPurpose: '卫浴间/卧室内跌倒 0 秒毫秒级捕获与生命危象全屏强行抢占',
    realPilotAnchors: ['AFD00101', 'AFD00102'],
  },
  trajectory_analyzer: {
    category: 'trajectory_analyzer',
    model: 'ATA-01',
    commercialName: '轨迹分析仪',
    manufacturingStage: 'make_to_order',
    stageLabel: '需要有订单才能开始量产 (按单排产 MTO)',
    sensingMechanism: '广角空间微动轨迹寻踪天线阵列与步态衰退分析仪',
    primaryCommercialPurpose: '室内活动轨迹热力图、步态衰退分析与认知症走失高阶质证促单选配',
    realPilotAnchors: ['ATA00001-DEMO'],
  },
  care_collector: {
    category: 'care_collector',
    model: 'ACA-01',
    commercialName: '照护采集仪',
    manufacturingStage: 'make_to_order',
    stageLabel: '需要有订单才能开始量产 (按单排产 MTO)',
    sensingMechanism: '智能照护工牌 / 移动打卡终端 (BLE + 近场声学 + 空间定位)',
    primaryCommercialPurpose: '助老员入户打卡、近场声学客观服务留痕与医保工单结算防虚报凭证',
    realPilotAnchors: ['ACA00001-DEMO'],
  },
}
