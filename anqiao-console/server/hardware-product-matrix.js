/**
 * 中科安樵核心感知硬件「1+1+2」矩阵与供应链排产服务
 * 依据：docs/PRODUCT-REQUIREMENTS-SPEC.md §1
 */

export const HARDWARE_CATALOG_1_1_2 = {
  health_guardian: {
    category: 'health_guardian',
    model: 'ASH-01 / ANCE-01',
    commercialName: 'AI健康守护仪',
    manufacturingStage: 'mass_production',
    stageLabel: '核心基石，目前主要量产的产品',
    sensingMechanism: '高精度压电微动体征感应垫 / 毫米波连续体征感知雷达',
    primaryCommercialPurpose: '7×24h 卧床体征监测与医保长护险失能客观证据基线包',
    realPilotAnchors: ['ASH01086', 'ASH01078', 'ASH01092', 'ANCE00001', 'ASH01146'],
    inStockAvailable: true,
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
    inStockAvailable: true,
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
    inStockAvailable: false,
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
    inStockAvailable: false,
  },
}

/**
 * 硬件排产与出货流转校验门禁
 */
export function validateHardwareProductionOrder({ category, quantity = 1, hasValidOrderContract = false }) {
  const spec = HARDWARE_CATALOG_1_1_2[category]
  if (!spec) {
    throw new Error(`未知的硬件产品类别: ${category}`)
  }

  // 1. 主要量产产品（守护仪）：现货成熟，随时发货
  if (spec.manufacturingStage === 'mass_production') {
    return {
      allowed: true,
      stage: spec.manufacturingStage,
      leadTimeDays: 1,
      commercialAction: 'direct_shipment_from_stock',
      message: '现货在库充足，支持立即出库装机',
    }
  }

  // 2. 刚进入量产产品（跌倒报警器）：优先排单，量产爬坡
  if (spec.manufacturingStage === 'entering_mass_production') {
    return {
      allowed: true,
      stage: spec.manufacturingStage,
      leadTimeDays: 7,
      commercialAction: 'priority_production_batch',
      message: '量产爬坡期产品，已加入排产批次，预计 7 日内完成发货',
    }
  }

  // 3. 按单排产产品（轨迹分析仪 / 照护采集仪）：强门禁拦截
  if (spec.manufacturingStage === 'make_to_order') {
    if (!hasValidOrderContract) {
      return {
        allowed: false,
        stage: spec.manufacturingStage,
        error: 'MTO_ORDER_CONTRACT_REQUIRED',
        message: `${spec.commercialName} 为按单排产（MTO）高阶硬件，必须先录入已生效的商业采购合同或意向订单，方可向工厂下达排产指令！`,
      }
    }
    return {
      allowed: true,
      stage: spec.manufacturingStage,
      leadTimeDays: 30,
      commercialAction: 'custom_mto_production_line',
      message: '订单凭证已审核，已向柔性供应链下达专项生产工单（生产周期约 30 日）',
    }
  }

  return { allowed: false, error: 'UNKNOWN_STAGE' }
}

/**
 * 真实数据零虚拟审计断言器
 */
export function auditZeroVirtualDataStandard(accounts = [], devices = []) {
  const FORBIDDEN_FAKE_USERS = [
    'user_zhoumin',
    'user_zhangdefu',
    'user_wangjianguo',
    'user_qianxiuying',
    'user_liuchangsheng',
    'user_chenguizhi',
  ]

  const violations = []

  // 1. 检查是否存在被禁用的虚构捏造用户
  for (const fakeU of FORBIDDEN_FAKE_USERS) {
    if (accounts.some((a) => a.username === fakeU)) {
      violations.push(`检测到被禁用的虚拟捏造账号: ${fakeU}`)
    }
  }

  // 2. 检查设备台账是否包含捏造用户作为监控人
  for (const dev of devices) {
    if (dev.monitoring_user_id && FORBIDDEN_FAKE_USERS.includes(dev.monitoring_user_id)) {
      violations.push(`设备 ${dev.sn || dev.device_id} 非法挂接了捏造用户 ${dev.monitoring_user_id}`)
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    auditTimestamp: new Date().toISOString(),
  }
}
