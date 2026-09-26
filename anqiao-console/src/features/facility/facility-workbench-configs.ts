// 护理院职能/支撑席位工作台配置（多业态设计 §3.1A/§3.3，业主已批准）
// 原则：左侧 SOP 流程树（§12.4）+ 右侧数据面板；面板优先挂真实数据（overview/alerts/beds），
// 写表单节点在契约（N28+）落地前以诚实占位说明呈现（Zero Fake Data 纪律）。

export interface FacilityPanelSpec {
  kind: 'overview' | 'alerts' | 'beds' | 'note'
  title: string
  note?: string
}

export interface FacilityTreeNode {
  key: string
  label: string
  panel?: FacilityPanelSpec
  children?: Array<{ key: string; label: string; panel: FacilityPanelSpec }>
}

export interface FacilityWorkbenchConfig {
  key: string
  title: string
  subtitle: string
  tree: FacilityTreeNode[]
}

export const FACILITY_WORKBENCH_CONFIGS: Record<string, FacilityWorkbenchConfig> = {
  facility_doctor_studio: {
    key: 'facility_doctor_studio',
    title: '医生工作台（院内医务）',
    subtitle: '健康档案 / 体征基线 / 查房与医嘱（记录挂硬件证据）',
    tree: [
      {
        key: 'today',
        label: '今日诊务',
        children: [
          { key: 'rounds', label: '晨间查房记录', panel: { kind: 'note', title: '晨间查房记录', note: '查房记录表单随契约 N28（rounds 写路由）开通；当前为只读演示面板。' } },
          { key: 'orders', label: '医嘱登记', panel: { kind: 'note', title: '医嘱登记', note: '医嘱四步闭环（开立→核对→执行→记录）随契约 N29（order 写路由）开通。' } },
        ],
      },
      {
        key: 'health',
        label: '辖区健康面',
        children: [
          { key: 'vitals', label: '管床体征总览', panel: { kind: 'overview', title: '管床长者体征总览（守护仪自动采集）' } },
          { key: 'abnormal', label: '异常告警', panel: { kind: 'alerts', title: '异常告警流' } },
        ],
      },
    ],
  },
  facility_hr_studio: {
    key: 'facility_hr_studio',
    title: '人事工作台',
    subtitle: '花名册 / 排班 / 考勤（照护采集仪打卡，按单排产硬件）',
    tree: [
      {
        key: 'staff',
        label: '员工与排班',
        children: [
          { key: 'roster', label: '员工花名册', panel: { kind: 'note', title: '员工花名册', note: '花名册管理随契约 N30（staff 路由）开通。' } },
          { key: 'shift', label: '排班表', panel: { kind: 'note', title: '排班表', note: '排班编排随契约 N31（shift 路由）开通。' } },
          { key: 'attendance', label: '考勤留痕', panel: { kind: 'note', title: '考勤留痕（照护采集仪）', note: 'ACA-01 照护采集仪为按单排产硬件；无打卡数据时空态诚实呈现。' } },
        ],
      },
      { key: 'duty', label: '在岗态势', panel: { kind: 'overview', title: '当班人力与院内态势' } },
    ],
  },
  facility_finance_studio: {
    key: 'facility_finance_studio',
    title: '财务工作台（院侧）',
    subtitle: '床位护理费账册 / 长护申报确认 / 物联结算凭证',
    tree: [
      {
        key: 'ledger',
        label: '账册与结算',
        children: [
          { key: 'bill', label: '床位/护理费账册', panel: { kind: 'note', title: '床位/护理费账册', note: '账册随契约 N32（bill 路由）开通。' } },
          { key: 'ltc', label: '长护申报确认', panel: { kind: 'note', title: '长护险申报确认', note: '机构侧申报财务确认随下一批契约开通。' } },
        ],
      },
      {
        key: 'evidence',
        label: '物联结算凭证',
        children: [
          { key: 'vouchers', label: '在床/翻身合规总览', panel: { kind: 'overview', title: '物联凭证口径总览' } },
          { key: 'deduction', label: '异常告警（核减线索）', panel: { kind: 'alerts', title: '异常告警流' } },
        ],
      },
    ],
  },
  facility_marketing_studio: {
    key: 'facility_marketing_studio',
    title: '营销工作台（入住营销）',
    subtitle: '实住率与空床态势 / 入住咨询登记（院内台账，不动 CRM）',
    tree: [
      {
        key: 'ops',
        label: '机构运营面',
        children: [
          { key: 'beds', label: '实住率与空床态势', panel: { kind: 'beds', title: '床位四态分布' } },
          { key: 'capability', label: '服务能力总览', panel: { kind: 'overview', title: '机构服务能力总览' } },
        ],
      },
      {
        key: 'funnel',
        label: '入住转化',
        children: [
          { key: 'inquiry', label: '入住咨询登记', panel: { kind: 'note', title: '入住咨询登记', note: '咨询登记（院内最小台账）随契约 N33（admission 路由）开通。' } },
          { key: 'follow', label: '意向跟进', panel: { kind: 'note', title: '意向客户跟进', note: '跟进台账随契约 N33 一并开通。' } },
        ],
      },
    ],
  },
  facility_admin_studio: {
    key: 'facility_admin_studio',
    title: '行政工作台',
    subtitle: '行政事务 / 设备报修流转（与院内物联运维协同）',
    tree: [
      {
        key: 'affairs',
        label: '事务与报修',
        children: [
          { key: 'ledger', label: '行政事务台账', panel: { kind: 'note', title: '行政事务台账', note: '事务登记随下一批契约（affairs 路由）开通。' } },
          { key: 'repair', label: '设备报修流转', panel: { kind: 'alerts', title: '设备异常与报修线索（联动物联运维）' } },
        ],
      },
      { key: 'campus', label: '院内态势', panel: { kind: 'overview', title: '院内运营态势' } },
    ],
  },
  facility_it_studio: {
    key: 'facility_it_studio',
    title: 'IT 支撑工作台',
    subtitle: '网络与终端归因 / 设备在线率 / 平台支持请求',
    tree: [
      {
        key: 'infra',
        label: '网络与终端',
        children: [
          { key: 'online', label: '设备在线率归因', panel: { kind: 'overview', title: '设备在线与离线归因视图' } },
          { key: 'support', label: '平台支持请求', panel: { kind: 'note', title: '向中科安樵提交支持请求', note: '支持工单随下一批契约（network/support 路由）开通。' } },
        ],
      },
      {
        key: 'account',
        label: '账号支撑',
        children: [
          { key: 'seats', label: '本机构席位清单', panel: { kind: 'note', title: '席位清单（只读）', note: '席位只读视图随下一批契约开通；开号由平台「吴」席位负责。' } },
        ],
      },
    ],
  },
  rehab_studio: {
    key: 'rehab_studio',
    title: '康复治疗师工作台',
    subtitle: '康复处方流程：肌力步态初评 → 处方 → 训练打卡 → 雷达评效（PRD §4）',
    tree: [
      {
        key: 'rx',
        label: '康复处方流',
        children: [
          { key: 'assess', label: '肌力步态初评', panel: { kind: 'note', title: '肌力步态初评', note: '初评量表随下一批契约开通。' } },
          { key: 'plan', label: '康复处方', panel: { kind: 'note', title: '康复处方', note: '处方管理随下一批契约开通。' } },
          { key: 'log', label: '训练打卡', panel: { kind: 'note', title: '训练打卡', note: '训练打卡随下一批契约开通。' } },
          { key: 'effect', label: '雷达评效', panel: { kind: 'overview', title: '训练前后体征/活动态势（轨迹仪 MTO 落地后增强）' } },
        ],
      },
      { key: 'watch', label: '重点观察', panel: { kind: 'alerts', title: '异常告警流' } },
    ],
  },
  dementia_studio: {
    key: 'dementia_studio',
    title: '认知症照护工作台',
    subtitle: 'MMSE 测评 / 走失围栏标定 / 非药物干预记录（PRD §4）',
    tree: [
      {
        key: 'care',
        label: '认知症专护流',
        children: [
          { key: 'mmse', label: 'MMSE 测评', panel: { kind: 'note', title: 'MMSE 量表测评', note: '量表测评随下一批契约开通。' } },
          { key: 'fence', label: '走失围栏标定', panel: { kind: 'note', title: '防走失电子围栏', note: '围栏标定依赖轨迹仪（ATA-01 按单排产），硬件落地后开通。' } },
          { key: 'therapy', label: '非药物干预记录', panel: { kind: 'note', title: '非药物干预记录', note: '干预记录随下一批契约开通。' } },
        ],
      },
      {
        key: 'watch',
        label: '重点观察',
        children: [
          { key: 'status', label: '长者态势', panel: { kind: 'overview', title: '认知症专区长者态势' } },
          { key: 'alerts', label: '异常告警', panel: { kind: 'alerts', title: '异常告警流' } },
        ],
      },
    ],
  },
}
