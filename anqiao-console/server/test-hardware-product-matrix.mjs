// 单元测试与 TDD 验证：硬件系统集成商四大核心硬件 1+1+2 矩阵、供应链排产规则与真实数据零虚拟审计
// 依据：docs/PRODUCT-REQUIREMENTS-SPEC.md §1 & §2
// 运行：node --test server/test-hardware-product-matrix.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
process.env.SEED_ACCOUNT_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD || 'seed-pass-123456'

import {
  HARDWARE_CATALOG_1_1_2,
  validateHardwareProductionOrder,
  auditZeroVirtualDataStandard,
} from './hardware-product-matrix.js'

const { ACCOUNTS, DEVICE_ASSETS } = await import('./seed.js')

test('TDD 1: 四大核心感知硬件「1+1+2」矩阵及量产阶段定义必须严格对齐 PRD', () => {
  // 1. AI健康守护仪：核心基石，主要量产
  const guardian = HARDWARE_CATALOG_1_1_2.health_guardian
  assert.equal(guardian.manufacturingStage, 'mass_production')
  assert.equal(guardian.inStockAvailable, true)
  assert.ok(guardian.stageLabel.includes('核心基石，目前主要量产的产品'))

  // 2. 跌倒报警器：刚进入量产
  const fall = HARDWARE_CATALOG_1_1_2.fall_detector
  assert.equal(fall.manufacturingStage, 'entering_mass_production')
  assert.equal(fall.inStockAvailable, true)
  assert.ok(fall.stageLabel.includes('刚进入量产'))

  // 3. 轨迹分析仪：按单排产 MTO，需要订单才能量产
  const trajectory = HARDWARE_CATALOG_1_1_2.trajectory_analyzer
  assert.equal(trajectory.manufacturingStage, 'make_to_order')
  assert.equal(trajectory.inStockAvailable, false)
  assert.ok(trajectory.stageLabel.includes('需要有订单才能开始量产'))

  // 4. 照护采集仪：按单排产 MTO，需要订单才能量产
  const collector = HARDWARE_CATALOG_1_1_2.care_collector
  assert.equal(collector.manufacturingStage, 'make_to_order')
  assert.equal(collector.inStockAvailable, false)
  assert.ok(collector.stageLabel.includes('需要有订单才能开始量产'))
})

test('TDD 2: 供应链排产流转规则：守护仪现货直发，轨迹仪与采集仪无订单强行拦截 (MTO 门禁)', () => {
  // 1. 守护仪：随时现货发货，交期 1 天
  const orderGuardian = validateHardwareProductionOrder({ category: 'health_guardian', quantity: 10 })
  assert.equal(orderGuardian.allowed, true)
  assert.equal(orderGuardian.leadTimeDays, 1)
  assert.equal(orderGuardian.commercialAction, 'direct_shipment_from_stock')

  // 2. 跌倒报警器：批量爬坡排产，交期 7 天
  const orderFall = validateHardwareProductionOrder({ category: 'fall_detector', quantity: 5 })
  assert.equal(orderFall.allowed, true)
  assert.equal(orderFall.leadTimeDays, 7)
  assert.equal(orderFall.commercialAction, 'priority_production_batch')

  // 3. 轨迹分析仪：无采购合同严禁排产（拦截）
  const orderTrajWithoutContract = validateHardwareProductionOrder({
    category: 'trajectory_analyzer',
    quantity: 2,
    hasValidOrderContract: false,
  })
  assert.equal(orderTrajWithoutContract.allowed, false)
  assert.equal(orderTrajWithoutContract.error, 'MTO_ORDER_CONTRACT_REQUIRED')
  assert.ok(orderTrajWithoutContract.message.includes('必须先录入已生效的商业采购合同'))

  // 4. 轨迹分析仪：有采购合同准予专项排产
  const orderTrajWithContract = validateHardwareProductionOrder({
    category: 'trajectory_analyzer',
    quantity: 2,
    hasValidOrderContract: true,
  })
  assert.equal(orderTrajWithContract.allowed, true)
  assert.equal(orderTrajWithContract.leadTimeDays, 30)
  assert.equal(orderTrajWithContract.commercialAction, 'custom_mto_production_line')

  // 5. 照护采集仪：无采购合同严禁排产（拦截）
  const orderCollectorWithoutContract = validateHardwareProductionOrder({
    category: 'care_collector',
    quantity: 50,
    hasValidOrderContract: false,
  })
  assert.equal(orderCollectorWithoutContract.allowed, false)
  assert.equal(orderCollectorWithoutContract.error, 'MTO_ORDER_CONTRACT_REQUIRED')
})

test('TDD 3: 真实数据零虚拟审计：当前仓内数据必须 100% 杜绝 user_zhoumin 等捏造账号', () => {
  // 对当前仓内的 ACCOUNTS 与 DEVICE_ASSETS 实施全面真伪审计
  const auditResult = auditZeroVirtualDataStandard(ACCOUNTS, DEVICE_ASSETS)
  assert.equal(auditResult.passed, true, `审计违规项: ${auditResult.violations.join(', ')}`)
  assert.equal(auditResult.violations.length, 0)

  // 负向测试：人为混入捏造用户必定触发审计报警
  const taintedAccounts = [...ACCOUNTS, { username: 'user_zhoumin', role: 'user' }]
  const taintedAudit = auditZeroVirtualDataStandard(taintedAccounts, DEVICE_ASSETS)
  assert.equal(taintedAudit.passed, false)
  assert.ok(taintedAudit.violations.some((v) => v.includes('user_zhoumin')))
})

test('TDD 4: 宿迁长护险真实试点实机与真实长者必须在在册硬件清单中全量保活', () => {
  const suqianSns = ['ASH01086', 'ASH01078', 'ASH01092']
  for (const sn of suqianSns) {
    const dev = DEVICE_ASSETS.find((d) => d.sn === sn)
    assert.ok(dev, `宿迁实机 ${sn} 必须在台账中存在`)
    assert.equal(dev.online, true, `宿迁实机 ${sn} 必须在线`)
    assert.ok(dev.device_placement_location.includes('宿迁'), `设备 ${sn} 必须部署在宿迁`)
  }
})
