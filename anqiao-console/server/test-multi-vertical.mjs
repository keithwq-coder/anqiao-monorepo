// 多业态租户模型验收（Node 内置 node:test）
// 运行：node --test server/test-multi-vertical.mjs（或随 npm test 全量）
// 覆盖：TENANT_CONFIGS 三字段（vertical/template/deployment）齐备与分组映射（设计 §4.1）；
//       getter 回退语义；康宁演示租户与六职能角色（Task 2/3 起逐步扩充）。
// 说明：直接动态 import seed.js（不发网络请求、不写生产数据）；seed.js 启动即校验
//       SEED_ACCOUNT_PASSWORD，故在本进程先行自注入测试口令（不入库）。
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SEED_ACCOUNT_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD || `t-${Date.now().toString(36)}`

const {
  TENANT_CONFIGS,
  getTenantData,
  getTenantName,
  getTenantVertical,
  getTenantTemplate,
  getTenantDeployment,
  listBeds,
} = await import('./seed.js')

test('TENANT_CONFIGS 全部条目具备 vertical/template/deployment 三字段', () => {
  for (const id of Object.keys(TENANT_CONFIGS)) {
    const cfg = TENANT_CONFIGS[id]
    assert.ok(cfg.vertical, `${id} 缺 vertical`)
    assert.ok('template' in cfg, `${id} 缺 template`)
    assert.equal(cfg.deployment, 'saas', `${id} deployment 应为 saas`)
  }
})

test('业态字段映射符合设计 §4.1 分组', () => {
  assert.equal(TENANT_CONFIGS.platform.vertical, 'platform')
  assert.equal(TENANT_CONFIGS.anqiao.vertical, 'platform')
  assert.equal(TENANT_CONFIGS.bureau.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.bureau_suqian.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.bureau_moumou.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.insurer.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.insurer_suqian.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.assessor_suqian.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.assessor_org.vertical, 'ltc_ecosystem')
  assert.equal(TENANT_CONFIGS.partner_p1.vertical, 'partner')
  assert.equal(TENANT_CONFIGS.cust_org01.vertical, 'nursing_home')
})

test('getter 对未知租户回退（与 getTenantKind 同风格）', () => {
  assert.equal(getTenantVertical('no_such_tenant'), 'nursing_home')
  assert.equal(getTenantTemplate('no_such_tenant'), null)
  assert.equal(getTenantDeployment('no_such_tenant'), 'saas')
})

test('康宁演示租户：机构照护型（occupiedBeds 分支），虚构名+演示标识', () => {
  const d = getTenantData('kangning')
  assert.ok(d, 'kangning 未注册进 TENANT_DATA')
  assert.equal(getTenantName('kangning'), '康宁护理院（演示）')
  assert.equal(getTenantVertical('kangning'), 'nursing_home')
  assert.equal(getTenantTemplate('kangning'), 'nursing_home_v1')
  assert.equal(d.cfg.occupiedBeds.length, 87)
  assert.equal(d.cfg.vacantBeds.length, 9)
  assert.equal(d.patients.length, 87)
  assert.ok(d.alerts.length > 0, '演示告警应生成')
})

test('康宁床位呈现：occupied + vacant 双态（listBeds）', () => {
  const beds = listBeds('kangning')
  assert.equal(beds.length, 96)
  assert.ok(beds.some((b) => b.status === 'vacant'), '应存在诚实空床态')
  assert.ok(beds.some((b) => b.status === 'occupied' && b.patient_id), '在住床位应挂长者')
})
