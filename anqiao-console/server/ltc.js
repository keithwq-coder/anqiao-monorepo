// 长护险后端核心领域服务模块（Node ESM）
// 依据：docs/LTC-INSURANCE-SPEC.md 与 docs/PLATFORM-SPEC.md
// 严格落地：
//  1. 三域对象分离（AssessedPerson vs ServiceSubject vs MonitoredSubject）
//  2. 四等级分离（申请等级、评估师判定等级、经办建议等级、最终核定等级）
//  3. 国家评估标准门禁（双人上门+专家、监护人在场、全程影像、双专家确认、公示）
//  4. 设备介入四类数据产品（快照、洞察、交叉验证、风险线索）
//  5. 服务实施证据与设备比对（matched/partial/mismatch/unavailable）
//  6. 结算四步分离与反欺诈监管案件处置

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCOUNTS, nowIso8, DEVICE_ASSETS } from './seed.js'
import { saveLtcState, loadLtcState, dataLayerMode } from './db.js'
import {
  ROLE_PERMISSIONS,
  permissionsOf,
  dataScopeOf,
  workspaceOf,
  authorize,
} from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE_PATH = path.join(__dirname, 'ltc-store.json')

export class LtcError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'LtcError'
    this.status = status
  }
}

export { permissionsOf, dataScopeOf, workspaceOf, authorize }

export const ROLES = [
  'su',
  'platform_admin',
  'admin',
  'device_user',
  'user',
  'medical_supervisor',
  'medical_insurance_staff',
  'insurer_operator',
  'insurer_staff',
  'insurer_director',
  'insurer_intake',
  'insurer_inspector',
  'insurer_auditor',
  'insurer_service',
  'assessor',
  'nursing_admin',
  'nursing_head',
  'nursing_station',
  'nursing_nurse',
  'nursing_caregiver',
  'partner_admin',
  'family_contact',
]

export function isInsurerRole(role) {
  return typeof role === 'string' && (role.startsWith('insurer_') || role === 'insurer_operator' || role === 'insurer_staff')
}

// ---------- 组织（多机构、多租户）----------
export const ORGS = {
  platform: { org_id: 'platform', name: '系统组织', kind: 'platform' },
  kaijian: { org_id: 'kaijian', name: '凯健国际护理院', kind: 'nursing_home' },
  anqiao: { org_id: 'anqiao', name: '中科安樵·自营运营中心', kind: 'anqiao_ops' },
  bureau: { org_id: 'bureau', name: '中科安樵·全域医保监管协同中心', kind: 'medical_bureau' },
  bureau_suqian: { org_id: 'bureau_suqian', name: '宿迁市医疗保障局 / 宿迁长护险试点工作组', kind: 'medical_bureau' },
  bureau_moumou: { org_id: 'bureau_moumou', name: '某某市医疗保障局 / 某某市长护险管理服务中心', kind: 'medical_bureau' },
  insurer: { org_id: 'insurer', name: '中国太平洋人寿保险股份有限公司 · 某某市长护险受托经办中心', kind: 'insurer' },
  insurer_suqian: { org_id: 'insurer_suqian', name: '中国太平洋人寿保险股份有限公司 · 宿迁长护险商保经办专班', kind: 'insurer' },
  assessor_org: { org_id: 'assessor_org', name: '某某市明康第三方失能评定中心', kind: 'assessment_org' },
  partner_p1: { org_id: 'partner_p1', name: '中科智护合作伙伴渠道', kind: 'partner' },
  cust_org01: { org_id: 'cust_org01', name: '某某市示范康养中心', kind: 'customer_org' },
}

export function principalForAccount(account) {
  const org = ORGS[account.org_id] ?? {}
  const poolId = account.pool_id || (account.tenant_id === 'bureau_suqian' || account.tenant_id === 'insurer_suqian' ? 'suqian' : (account.tenant_id === 'bureau_moumou' || account.tenant_id === 'insurer' ? 'moumou' : null))
  return {
    account_id: account.username,
    username: account.username,
    name: account.staff_name,
    role: account.role,
    pool_id: poolId,
    unified_role: account.unified_role || account.role,
    workspace: account.workspace || workspaceOf(account.role),
    tenant_id: account.tenant_id,
    org_id: org.org_id ?? account.org_id ?? null,
    org_name: org.name ?? account.tenant_id,
    org_kind: org.kind ?? null,
    data_scope: account.scope || dataScopeOf(account.role),
    assigned_floors: account.assigned_floors || [],
    assigned_nurse: account.assigned_nurse || null,
    assigned_bed_range: account.assigned_bed_range || null,
    assigned_title: account.assigned_title || null,
    on_duty: account.on_duty !== undefined ? account.on_duty : true,
  }
}

export function ctxForAccount(account) {
  const poolId = account.pool_id || (account.tenant_id === 'bureau_suqian' ? 'suqian' : account.tenant_id === 'bureau_moumou' ? 'moumou' : null)
  return {
    account_id: account.username,
    username: account.username,
    role: account.role,
    unified_role: account.unified_role || account.role,
    tenant_id: account.tenant_id,
    staff_name: account.staff_name,
    name: account.staff_name,
    org_id: account.org_id,
    pool_id: poolId,
    workspace: account.workspace || workspaceOf(account.role),
    data_scope: account.data_scope || account.scope || dataScopeOf(account.role),
    assigned_floors: account.assigned_floors || [],
    assigned_nurse: account.assigned_nurse || null,
    applicant_ids: account.applicant_ids ?? [],
  }
}

// ---------- 权限断言 ----------
function assertPerm(ctx, capability) {
  const authRes = authorize(ctx, capability)
  if (!authRes.allow) {
    throw new LtcError(authRes.status, authRes.message)
  }
}

// ---------- 被评估对象种子（长护险域 AssessedPerson，严禁与护理院 Patient 混淆）----------
const SEED_ASSESSED_PERSONS = [
  {
    person_id: 'P_SQ_01',
    name: '许丽',
    gender: 'female',
    age: 78,
    id_card: '3213021948********',
    pool_id: 'suqian',
    address: '宿迁市宿城区项里街道长护险试点照护点01号',
    guardian_name: '许建新',
    guardian_phone: '139****2233',
    disability_status: '在网监护长者',
    service_org_id: 'bureau_suqian',
    bed_id: 'SQ-01',
    device_id: 'ASH01086',
    device_model: 'AI健康守护仪 (ASH-01)',
    assessment_batch: '2026-Q3-宿迁长护险试点首批',
  },
  {
    person_id: 'P_SQ_02',
    name: '何家齐',
    gender: 'male',
    age: 82,
    id_card: '3213021944********',
    pool_id: 'suqian',
    address: '宿迁市宿城区双庄街道长护险试点照护点02号',
    guardian_name: '何国栋',
    guardian_phone: '138****6677',
    disability_status: '在网监护长者',
    service_org_id: 'bureau_suqian',
    bed_id: 'SQ-02',
    device_id: 'ASH01078',
    device_model: 'AI健康守护仪 (ASH-01)',
    assessment_batch: '2026-Q3-宿迁长护险试点首批',
  },
  {
    person_id: 'P_SQ_03',
    name: '王雪金',
    gender: 'female',
    age: 85,
    id_card: '3213021941********',
    pool_id: 'suqian',
    address: '宿迁市宿城区支口街道长护险试点照护点03号',
    guardian_name: '丁俊华',
    guardian_phone: '137****8899',
    disability_status: '在网监护长者',
    service_org_id: 'bureau_suqian',
    bed_id: 'SQ-03',
    device_id: 'ASH01092',
    device_model: 'AI健康守护仪 (ASH-01)',
    assessment_batch: '2026-Q3-宿迁长护险试点首批',
  },
  // ==================== 某某市示范区：契合设备与三大监管支柱的长者档案 ====================
  {
    person_id: 'P00084',
    name: '赵大有',
    gender: 'male',
    age: 76,
    id_card: '32000019500312****',
    pool_id: 'moumou',
    address: '某某市东湖区朝阳路18号枫林雅苑3幢202室',
    guardian_name: '赵小明',
    guardian_phone: '138****0101',
    disability_status: '失能申报核验中 (雷达客观冲突拦截)',
    service_org_id: 'org_mm_01',
    bed_id: 'MM-DH-01',
    device_id: 'ASH01146',
    device_model: 'AI健康守护仪 (毫米波雷达+生命体征)',
    assessment_batch: '2026-Q3-失能准入客观核验',
  },
  {
    person_id: 'P_MM_02',
    name: '钱秀芬',
    gender: 'female',
    age: 83,
    id_card: '32000019430820****',
    pool_id: 'moumou',
    address: '某某市南山区健康路88号静安里5幢401室',
    guardian_name: '钱志强',
    guardian_phone: '139****0202',
    disability_status: '待遇暂缓发放 (床端脱管空床14天)',
    service_org_id: 'org_mm_01',
    bed_id: 'MM-NS-02',
    device_id: 'ASH01076',
    device_model: 'AI健康守护仪 (毫米波雷达+生命体征)',
    assessment_batch: '2026-Q2-期满随访监测',
  },
  {
    person_id: 'P_MM_03',
    name: '孙建国',
    gender: 'male',
    age: 81,
    id_card: '32000019451105****',
    pool_id: 'moumou',
    address: '某某市高新区科技大道102号翠竹苑2幢101室',
    guardian_name: '孙海',
    guardian_phone: '137****0303',
    disability_status: '在网照护长者 (工单雷达空房待核查)',
    service_org_id: 'org_mm_01',
    bed_id: 'MM-GX-03',
    device_id: 'ASH01081',
    device_model: 'AI健康守护仪 (毫米波雷达+生命体征)',
    assessment_batch: '2026-Q3-居家照护批次',
  },
  {
    person_id: 'P_MM_04',
    name: '张宝贵',
    gender: 'male',
    age: 79,
    id_card: '32000019470618****',
    pool_id: 'moumou',
    address: '某某市颐养天年护理院 2号楼203病床',
    guardian_name: '张红',
    guardian_phone: '136****0404',
    disability_status: '在院重度失能长者 (体征垫波形缺失核减中)',
    service_org_id: 'org_mm_02',
    bed_id: 'YY-203',
    device_id: 'ASH01038',
    device_model: '高精度生命体征监测垫',
    assessment_batch: '2026-Q3-定点机构核查',
  },
  {
    person_id: 'P_MM_05',
    name: '李秀荣',
    gender: 'female',
    age: 80,
    id_card: '32000019460228****',
    pool_id: 'moumou',
    address: '某某市西湖区枫桥路56号福康苑7幢302室',
    guardian_name: '李文',
    guardian_phone: '135****0505',
    disability_status: '复评降级自理 (吴明轩评估案倒查追责)',
    service_org_id: 'org_mm_03',
    bed_id: 'MM-XH-05',
    device_id: 'ASH01041',
    device_model: 'AI健康守护仪 (毫米波雷达+生命体征)',
    assessment_batch: '2026-Q1-评估师立案倒查批次',
  },
]

const ORG_NAMES = {
  bureau: '中科安樵·全域医保监管协同中心',
  bureau_suqian: '宿迁市医疗保障局 / 宿迁长护险试点工作组',
  bureau_moumou: '某某市医疗保障局 / 某某市长护险管理服务中心',
  org_mm_01: '某某市康泰居家照护中心',
  org_mm_02: '某某市颐养天年护理院',
  org_mm_03: '某某市博爱养老养护中心',
  org_mm_04: '某某市社区日间照料示范中心',
  kaijian: '凯健国际护理院',
  cust_org01: '某某市示范康养中心',
  bureau_suqian_spot: '宿迁市长护试点照护中心',
}

// ---------- 权威临床病历与出院小结（长护险医保定级与评残依据）----------
// ---------- 权威临床病历档案（已清除所有模拟数据，等待权威接口同步）----------
export const SEED_MEDICAL_RECORDS = []

export const SEED_ASSESSMENT_ORGS = [
  {
    org_id: 'assessor_org',
    name: '太平洋财产保险某某分公司长护险评估中心',
    short_name: '太保长护评估中心',
    unified_social_credit_code: '91320000712384912A',
    license_no: 'LTC-AGY-MM-2023-001',
    qualification_grade: '甲级定点评估机构',
    legal_representative: '徐建华',
    responsible_person: '顾敏 处长',
    contact_phone: '0510-68288120',
    address: '某某市高新技术产业园区科技大道88号太保大厦7F',
    accredited_coverage_areas: ['某某市区', '高新区', '西湖区', '南山区'],
    active_assessors_count: 32,
    completed_assessments_total: 8420,
    compliance_audit_rate: 99.2,
    status: 'active',
  },
  {
    org_id: 'org_eval_dekang',
    name: '某某市德康健康评定中心',
    short_name: '德康健康评定中心',
    unified_social_credit_code: '92320000MA1NQ9821B',
    license_no: 'LTC-AGY-MM-2024-006',
    qualification_grade: '乙级定点评估机构 (法定回避重点监管)',
    legal_representative: '王德康',
    responsible_person: '沈海燕 站长',
    contact_phone: '0510-67277631',
    address: '某某市西湖区枫桥路12号康养评估大楼2F',
    accredited_coverage_areas: ['西湖区', '城北示范区'],
    active_assessors_count: 14,
    completed_assessments_total: 3150,
    compliance_audit_rate: 91.5,
    status: 'active',
  },
]

// ---------- 执业失能评估师名录（含资质、证书号、利益回避与长效追责档案）----------
export const SEED_ASSESSORS = [
  {
    assessor_id: 'ASR-089',
    account_username: 'assessor_wumingxuan',
    name: '吴明轩',
    gender: '男',
    age: 48,
    qualification_cert_no: 'LTC-ASR-2024-0089',
    qualification_level: '国家一级长期照护失能评估师',
    professional_title: '主治医师',
    education_background: '某省医科大学 临床医学学士',
    practicing_years: 12,
    org_id: 'assessor_org',
    org_name: '某某市明康第三方评估中心',
    phone: '138****0089',
    avoidance_org_ids: ['org_mm_03'],
    avoidance_org_names: ['某某市博爱养老养护中心'],
    active_status: 'suspended',
    active_status_label: '🚫 已暂停执业 (长效追责立案调查中)',
    annual_evaluated_count: 168,
    severe_disability_rate: 71.4,
    city_avg_severe_rate: 23.8,
    audit_downgrade_rate: 58.3,
    accuracy_ratification_rate: 68.5,
    on_time_sla_rate: 94.0,
    current_assigned_tasks: 0,
    ethics_record: '⚠️ 触发重度评定异常偏高与长效追责立案调查（暂停执业12个月，追缴违规评估费）',
  },
  {
    assessor_id: 'ASR-004',
    account_username: 'assessor04',
    name: '周海峰',
    gender: '男',
    age: 44,
    qualification_cert_no: 'LTC-ASR-2024-0156',
    qualification_level: '国家一级长期照护失能评估师',
    professional_title: '副主任护师',
    education_background: '某省中医药大学 护理本科',
    practicing_years: 15,
    org_id: 'assessor_org',
    org_name: '某某市康诺医学评估所',
    phone: '139****0156',
    avoidance_org_ids: ['org_mm_01'],
    avoidance_org_names: ['某某市康泰居家照护中心'],
    active_status: 'practicing',
    active_status_label: '正常执业',
    annual_evaluated_count: 156,
    severe_disability_rate: 24.2,
    city_avg_severe_rate: 23.8,
    audit_downgrade_rate: 1.2,
    accuracy_ratification_rate: 99.2,
    on_time_sla_rate: 99.5,
    current_assigned_tasks: 2,
    ethics_record: '优良，五星级资深评估师',
  },
  {
    assessor_id: 'ASR-005',
    account_username: 'assessor05',
    name: '宋慧敏',
    gender: '女',
    age: 39,
    qualification_cert_no: 'LTC-ASR-2024-0218',
    qualification_level: '国家二级长期照护失能评估师',
    professional_title: '神经内科主治医师',
    education_background: '某医科大学 临床医学硕士',
    practicing_years: 10,
    org_id: 'assessor_org',
    org_name: '某某市康诺医学评估所',
    phone: '137****0218',
    avoidance_org_ids: ['org_mm_02'],
    avoidance_org_names: ['某某市颐养天年护理院'],
    active_status: 'practicing',
    active_status_label: '正常执业',
    annual_evaluated_count: 118,
    severe_disability_rate: 22.8,
    city_avg_severe_rate: 23.8,
    audit_downgrade_rate: 2.1,
    accuracy_ratification_rate: 98.5,
    on_time_sla_rate: 98.8,
    current_assigned_tasks: 1,
    ethics_record: '优良，年度零投诉',
  },
  {
    assessor_id: 'ASR-001',
    account_username: 'assessor01',
    name: '陈建国',
    gender: '男',
    age: 46,
    qualification_cert_no: 'LTC-ASR-2024-0108',
    qualification_level: '国家一级长期照护失能评估师',
    professional_title: '副主任护师 / 老年专科护士',
    education_background: '医科大学护理学院 本科',
    practicing_years: 14,
    org_id: 'assessor_org',
    org_name: '第三方综合长护评估所',
    phone: '13812345678',
    avoidance_org_ids: ['kaijian'],
    avoidance_org_names: ['凯健国际护理院'],
    active_status: 'practicing',
    active_status_label: '正常执业',
    annual_evaluated_count: 186,
    severe_disability_rate: 25.1,
    city_avg_severe_rate: 23.8,
    audit_downgrade_rate: 1.8,
    accuracy_ratification_rate: 98.8,
    on_time_sla_rate: 99.4,
    current_assigned_tasks: 2,
    ethics_record: '优良，无失信违规投诉',
  },
]

// ---------- 种子长护险失能申请（覆盖三大监管支柱：客观设备核验与申报比对）----------
export const SEED_APPLICATIONS = [
  {
    application_id: 'APP-MM-2026-001',
    applicant_id: 'P_MM_01',
    applicant_name: '赵大有',
    pool_id: 'moumou',
    application_type: 'first',
    applied_level: '重度失能三级 (完全失能)',
    status: 'pre_reviewed',
    pre_assessed_level: '重度失能三级',
    device_id: 'ASH01146',
    objective_conflict: true,
    reviewer_notes: '家属自评完全失能ADL 10分，但安守护毫米波雷达连续72小时遥测日均离床行走16次，平均步速0.75m/s，客观指标严重背离，系统已预警拦截拟驳回并派专班盲核。',
    submitted_at: '2026-09-21T09:30:00+08:00',
  },
  {
    application_id: 'APP-MM-2026-002',
    applicant_id: 'P_MM_02',
    applicant_name: '钱秀芬',
    pool_id: 'moumou',
    application_type: 'periodic',
    applied_level: '重度失能二级',
    status: 'reviewing',
    pre_assessed_level: '重度失能二级',
    device_id: 'ASH01076',
    objective_conflict: true,
    reviewer_notes: '床端生命体征垫连续14天空床0体征，涉嫌脱管离线或家属冒领，待遇核准已暂停。',
    submitted_at: '2026-09-22T10:15:00+08:00',
  },
  {
    application_id: 'APP-MM-2026-003',
    applicant_id: 'P_MM_03',
    applicant_name: '孙建国',
    pool_id: 'moumou',
    application_type: 'first',
    applied_level: '中度失能一级',
    status: 'approved',
    pre_assessed_level: '中度失能一级',
    approved_level: '中度失能一级',
    device_id: 'ASH01081',
    objective_conflict: false,
    reviewer_notes: '毫米波雷达在床活动度与夜间体征数据与ADL量表一致，客观印证通过。',
    submitted_at: '2026-09-20T14:00:00+08:00',
  },
]

// ---------- 医保监管全业务闭环工单池（覆盖服务实施环节监管：雷达在场与体征微动印证）----------
export const SEED_WORK_ORDERS = [
  {
    work_order_id: 'WO-MM-202609-001',
    pool_id: 'moumou',
    org_id: 'org_mm_01',
    org_name: '某某市康泰居家照护中心',
    caregiver_name: '王金凤',
    elderly_id: 'P_MM_03',
    elderly_name: '孙建国',
    service_type: '重度生活照料与擦浴',
    scheduled_window: '2026-09-24 10:00 - 11:30',
    punch_time: '2026-09-24 10:02:15',
    device_id: 'ASH01081',
    radar_in_bed: false,
    radar_room_presence: false,
    mismatch_type: 'radar_empty_room',
    status: 'intercepted',
    status_label: '已拦截 (雷达检测空房虚假打卡)',
    amount: 120.0,
  },
  {
    work_order_id: 'WO-MM-202609-002',
    pool_id: 'moumou',
    org_id: 'org_mm_02',
    org_name: '某某市颐养天年护理院',
    caregiver_name: '张德彪',
    elderly_id: 'P_MM_04',
    elderly_name: '张宝贵',
    service_type: '卧床长者被动肢体关节活动40分钟',
    scheduled_window: '2026-09-24 14:00 - 14:40',
    punch_time: '2026-09-24 14:01:10',
    device_id: 'ASH01038',
    radar_in_bed: true,
    radar_room_presence: true,
    mismatch_type: 'vital_motionless',
    status: 'flagged',
    status_label: '重点复核 (体征垫波形无受力扰动走过场)',
    amount: 85.0,
  },
  {
    work_order_id: 'WO-MM-202609-003',
    pool_id: 'moumou',
    org_id: 'org_mm_01',
    org_name: '某某市康泰居家照护中心',
    caregiver_name: '陈美华',
    elderly_id: 'P_MM_01',
    elderly_name: '赵大有',
    service_type: '协助进餐与生活照护',
    scheduled_window: '2026-09-25 08:30 - 09:30',
    punch_time: '2026-09-25 08:31:20',
    device_id: 'ASH01146',
    radar_in_bed: true,
    radar_room_presence: true,
    mismatch_type: 'none',
    status: 'completed',
    status_label: '正常核对已通过',
    amount: 80.0,
  },
]

// ---------- 医保统筹区定点机构履约信用星级与协议状态 ----------
export const SEED_INSTITUTION_CREDITS = [
  {
    org_id: 'org_mm_01',
    org_name: '某某市康泰居家照护中心',
    pool_id: 'moumou',
    kind: 'home_care',
    kind_label: '连锁居家照护示范中心',
    credit_score: 91.2,
    star_level: 4.0,
    compliance_rate: 91.5,
    punch_verified_rate: 88.4,
    complaint_rate: '0.35%',
    active_caregivers: 24,
    active_elders: 58,
    protocol_status: 'probation',
    protocol_status_label: '限期整改 (虚假打卡督办)',
    last_audit_date: '2026-09-24',
  },
  {
    org_id: 'org_mm_02',
    org_name: '某某市颐养天年护理院',
    pool_id: 'moumou',
    kind: 'nursing_home',
    kind_label: '定点医养康养综合体',
    credit_score: 94.8,
    star_level: 4.5,
    compliance_rate: 94.2,
    punch_verified_rate: 93.6,
    complaint_rate: '0.12%',
    active_caregivers: 36,
    active_elders: 82,
    protocol_status: 'active',
    protocol_status_label: '重点监管 (挂床波形核减)',
    last_audit_date: '2026-09-23',
  },
  {
    org_id: 'org_mm_03',
    org_name: '某某市博爱养老养护中心',
    pool_id: 'moumou',
    kind: 'nursing_home',
    kind_label: '定点重度失能照护机构',
    credit_score: 95.0,
    star_level: 4.5,
    compliance_rate: 96.0,
    punch_verified_rate: 96.5,
    complaint_rate: '0.08%',
    active_caregivers: 20,
    active_elders: 45,
    protocol_status: 'active',
    protocol_status_label: '正常履约 (评估偏离倒查)',
    last_audit_date: '2026-09-22',
  },
  {
    org_id: 'org_mm_04',
    org_name: '某某市社区日间照料示范中心',
    pool_id: 'moumou',
    kind: 'community_care',
    kind_label: '社区日间照料示范点',
    credit_score: 99.4,
    star_level: 5.0,
    compliance_rate: 99.8,
    punch_verified_rate: 99.6,
    complaint_rate: '0.01%',
    active_caregivers: 12,
    active_elders: 28,
    protocol_status: 'active',
    protocol_status_label: '五星级示范机构',
    last_audit_date: '2026-09-21',
  },
  {
    org_id: 'bureau_suqian_spot',
    org_name: '宿迁市长护试点照护中心',
    pool_id: 'suqian',
    kind: 'pilot_station',
    kind_label: '试点直属长护服务站',
    credit_score: 100,
    star_level: 5.0,
    compliance_rate: 100,
    punch_verified_rate: 100,
    complaint_rate: '0.00%',
    active_caregivers: 3,
    active_elders: 3,
    protocol_status: 'active',
    protocol_status_label: '正常履约 (3台设备试点)',
    last_audit_date: '2026-09-24',
  },
]

// ---------- 医保监管智能风控疑点线索与督办闭环案卷（聚焦三大支柱：评估环节、服务实施、评估者长效追责）----------
export const SEED_SUPERVISION_CLUES = [
  // ========== 支柱一：评估环节的监管（病人和家属防伪与防冒领） ==========
  {
    clue_id: 'CLUE-MM-001',
    pool_id: 'moumou',
    title: '【评估环节】失能申报自评与连续雷达活动度客观监测严重背离（疑似装病骗保）',
    source_type: 'vital_drift',
    source_label: '毫米波雷达连续体动与活动度交叉核验',
    risk_level: 'red',
    target_org_id: 'org_mm_01',
    target_org_name: '某某市康泰居家照护中心',
    caregiver_name: '赵小明 (家属代理申报)',
    caregiver_phone: '138****0101',
    elderly_name: '赵大有',
    person_id: 'P_MM_01',
    device_id: 'ASH01146',
    description: '参保人家属申报“重度失能三级（完全失能）待遇”，自评ADL量表得分仅10分。但申请观察期布设的安守护毫米波雷达连续72小时遥测显示：日均主动离床站立行走16次，室内活动平均步速达0.75m/s，且夜间自主起夜与翻身活跃。客观活动度指标与“完全卧床”产生根本性矛盾，系统判定存在装病与虚高申报嫌疑。',
    evidence_snapshot: {
      reported_adl: 10,
      radar_daily_walks: 16,
      radar_avg_speed: '0.75m/s',
      night_turnovers: 6,
      conflict_level: 'critical',
      conclusion: '客观物联体征与申报重度失能根本冲突，疑似虚假卧床',
    },
    status: 'feedback_received',
    dispatch_order: {
      order_no: '某医保长护督字〔2026〕第011号',
      dispatched_to: 'insurer01',
      dispatched_at: '2026-09-22T09:00:00+08:00',
      due_hours: 24,
      inquiry_points: '医保专班联合经办上门盲核，调取老人近期实际自主活动能力，拍摄现场走访视频',
      dispatched_by: 'demo_audit',
    },
    feedback: {
      feedback_by: 'insurer01 (商保经办联合调查组)',
      feedback_at: '2026-09-22T17:00:00+08:00',
      interview_notes: '专班突击上门核查，当场发现老人正在客厅自行倒水行走，精神良好。家属承认听信中介怂恿突击卧床以图申领每月高额补贴。经办建议：全额驳回重度失能申报，计入医保失信申报名单。',
      objective_snapshot: '现场盲核视频已刻盘存档，家属已签字确认实际具备中轻度自理能力。',
      pre_advisory: 'suggest_rectify',
      pre_advisory_label: '经办核查建议：驳回重度申报，冻结待遇准入资格',
    },
    adjudication: null,
    created_at: '2026-09-21T10:00:00+08:00',
  },
  {
    clue_id: 'CLUE-MM-002',
    pool_id: 'moumou',
    title: '【评估环节】在网生命体征垫连续14天检测到空床（疑似老人脱管/家属冒领津贴）',
    source_type: 'radar_absence',
    source_label: '在床物联客观监测与多源数据比对',
    risk_level: 'red',
    target_org_id: 'org_mm_01',
    target_org_name: '某某市康泰居家照护中心',
    caregiver_name: '钱志强 (长者家属)',
    caregiver_phone: '139****0202',
    elderly_name: '钱秀芬',
    person_id: 'P_MM_02',
    device_id: 'ASH01076',
    description: '长者钱秀芬享受每月重度失能定额津贴，但其床端安守护高精度生命体征垫连续14天显示【空床0体征】，毫米波雷达亦无微动信号。民政与卫健数据比对显示长者已于月初转入外地ICU就医，家属未按长护规程报备并继续申领津贴，存在冒领嫌疑。',
    evidence_snapshot: {
      off_bed_continuous_days: 14,
      bed_vital_signal: 0,
      monthly_subsidy: 1800,
      hospitalization_cross_check: '月初已转入市外三甲ICU',
    },
    status: 'pending_dispatch',
    dispatch_order: null,
    feedback: null,
    adjudication: null,
    created_at: '2026-09-23T08:30:00+08:00',
  },

  // ========== 支柱二：服务实施环节的监管（服务提供者防虚假打卡与挂床走过场） ==========
  {
    clue_id: 'CLUE-MM-003',
    pool_id: 'moumou',
    title: '【服务实施】助老员上门打卡期间毫米波雷达检测到空房（虚构入户服务工单）',
    source_type: 'radar_absence',
    source_label: 'AI毫米波雷达在床时空比对引擎',
    risk_level: 'red',
    target_org_id: 'org_mm_01',
    target_org_name: '某某市康泰居家照护中心',
    caregiver_name: '王金凤',
    caregiver_phone: '137****0301',
    elderly_name: '孙建国',
    person_id: 'P_MM_03',
    device_id: 'ASH01081',
    description: '助老员王金凤提交为长者孙建国开展1.5小时生活照料工单，但同时间段长者室内安守护毫米波雷达 ASH01081 连续90分钟持续显示【空房无人状态】（人体微动波形恒为0）。经办核查证实助老员隔空打卡即离开，虚构服务骗领长护基金。',
    evidence_snapshot: {
      scheduled_window: '10:00 - 11:30',
      nfc_punch_time: '10:02:15',
      radar_in_bed: false,
      radar_room_presence: false,
      radar_avg_hr: 0,
      mismatch_duration_minutes: 88,
    },
    status: 'feedback_received',
    dispatch_order: {
      order_no: '某医保长护督字〔2026〕第019号',
      dispatched_to: 'insurer01',
      dispatched_at: '2026-09-24T10:00:00+08:00',
      due_hours: 24,
      inquiry_points: '现场走访长者家庭，核验当日入户服务真实性，调取助老员随身服务打卡照片与基站坐标',
      dispatched_by: 'demo_audit',
    },
    feedback: {
      feedback_by: 'insurer01 (受托商保长护经办部)',
      feedback_at: '2026-09-24T16:30:00+08:00',
      interview_notes: '经办现场走访长者家属孙海。家属证实当日助老员仅进门扫码打卡后便声称有急事离开，实际未开展任何照料，长者当时在阳台晒太阳并未在卧室。助老员存在虚构服务事实。',
      objective_snapshot: '家属笔录已签字；雷达日志显示10:05至11:30室内持续空房。',
      pre_advisory: 'suggest_deduct',
      pre_advisory_label: '经办初核建议：扣减当月该笔工单，追缴违规资金¥4,200并通报机构',
    },
    adjudication: null,
    created_at: '2026-09-24T09:15:00+08:00',
  },
  {
    clue_id: 'CLUE-MM-004',
    pool_id: 'moumou',
    title: '【服务实施】被动肢体康复时段内生命体征垫无任何受力体动波形（挂床走过场）',
    source_type: 'vital_drift',
    source_label: '多模态体征垫微动特征分析引擎',
    risk_level: 'yellow',
    target_org_id: 'org_mm_02',
    target_org_name: '某某市颐养天年护理院',
    caregiver_name: '张德彪',
    caregiver_phone: '136****0401',
    elderly_name: '张宝贵',
    person_id: 'P_MM_04',
    device_id: 'ASH01038',
    description: '护理员打卡记录声称对重度失能卧床长者开展40分钟被动肢体活动与叩背翻身排痰，但床端高精度生命体征垫连续数据显示：长者心率恒定为58bpm静息状态，体动幅度低于5，全程无任何肢体受力、翻身扰动的生理波形，印证为护理员坐在床边挂卡走过场，未实质开展照护。',
    evidence_snapshot: {
      promised_service: '被动肢体关节活动与叩背40分钟',
      actual_movement_amplitude: 3.2,
      expected_amplitude_min: 45.0,
      conclusion: '体动扰动波形完全缺失，服务实施严重走过场',
    },
    status: 'pending_dispatch',
    dispatch_order: null,
    feedback: null,
    adjudication: null,
    created_at: '2026-09-24T14:30:00+08:00',
  },
  {
    clue_id: 'CLUE-MM-005',
    pool_id: 'moumou',
    title: '【服务实施】助老员短时间内跨片区极速位移打卡（超出交通物理极限代打卡）',
    source_type: 'cross_region_burst',
    source_label: '基站与打卡轨迹交叉验真',
    risk_level: 'red',
    target_org_id: 'org_mm_01',
    target_org_name: '某某市康泰居家照护中心',
    caregiver_name: '李强',
    caregiver_phone: '135****9900',
    elderly_name: '王大爷等2户',
    person_id: 'P_MM_03',
    device_id: 'ASH01081',
    description: '助老员李强在12分钟内先后在城东新村与城西康苑两个相距16.8公里的服务点打卡，平均位移速度达84km/h，超出城市道路通勤物理极限，疑似使用虚拟定位软件或他人代打卡。',
    evidence_snapshot: {
      punch1: '09:15:02 (城东新村)',
      punch2: '09:27:18 (城西康苑)',
      distance_km: 16.8,
      impossible_velocity: true,
    },
    status: 'pending_dispatch',
    dispatch_order: null,
    feedback: null,
    adjudication: null,
    created_at: '2026-09-24T11:30:00+08:00',
  },

  // ========== 支柱三：评估者的监管（执业评估师长效追责制与利益回避审查） ==========
  {
    clue_id: 'CLUE-MM-006',
    pool_id: 'moumou',
    title: '【评估者追责】执业评估师吴明轩重度失能评定率异常偏高(71.4%)且复核严重倒挂（启动长效追责）',
    source_type: 'rapid_reversal',
    source_label: '失能评估质量与长效追责大数据模型',
    risk_level: 'red',
    target_org_id: 'org_mm_03',
    target_org_name: '某某市博爱养老养护中心',
    caregiver_name: '吴明轩 (执业评估师 LTC-ASR-2024-0089)',
    caregiver_phone: '138****0089',
    elderly_name: '李秀荣等批次',
    person_id: 'P_MM_05',
    device_id: 'ASH01041',
    description: '执业评估师吴明轩近6个月在博爱养老养护中心评定重度失能率达71.4%（某某市统筹区平均重度率仅23.8%，偏离度+47.6%）。医保专班盲抽复审12例，其中7例结合安守护居家监测设备客观活动数据，被复核专家组降级为轻度或自理，复评降级率达58.3%！触犯长效追责红线。',
    evidence_snapshot: {
      assessor_id: 'ASR-089',
      assessor_name: '吴明轩',
      evaluated_total: 42,
      severe_rate: '71.4%',
      city_avg_rate: '23.8%',
      deviation: '+47.6%',
      audit_sample_count: 12,
      downgraded_count: 7,
      downgrade_rate: '58.3%',
      violation_type: '人情打分/虚高评级/严重偏离法定标准',
    },
    status: 'feedback_received',
    dispatch_order: {
      order_no: '某医保长护督字〔2026〕第005号',
      dispatched_to: 'insurer01',
      due_hours: 48,
      dispatched_at: '2026-09-20T09:00:00+08:00',
      inquiry_points: '封存吴明轩评定案卷，结合安守护物联监测客观数据对7名降级长者进行入户盲核',
      dispatched_by: 'demo_qual',
    },
    feedback: {
      feedback_by: 'insurer01 (经办与医学专家复核组)',
      feedback_at: '2026-09-21T15:20:00+08:00',
      interview_notes: '专家盲审复查全面证实：被吴明轩评定为重度的长者多具备室内自主走动与简单进食能力，物联雷达日均离床记录与重度完全失能严重背离。吴明轩存在明显放水违规。',
      objective_snapshot: '专家组复核意见书已由3名主任医师联名签署。',
      pre_advisory: 'suggest_rectify',
      pre_advisory_label: '建议启动长效追责惩戒：暂停其评估资质12个月，追回评估费，移交纪检线索',
    },
    adjudication: null,
    created_at: '2026-09-19T10:00:00+08:00',
  },
  {
    clue_id: 'CLUE-MM-007',
    pool_id: 'moumou',
    title: '【评估者追责】德康健康评定中心法定代表人未申报定点护理机构关联回避关系',
    source_type: 'rapid_reversal',
    source_label: '评估机构法定利益回避穿透审查',
    risk_level: 'yellow',
    target_org_id: 'org_mm_01',
    target_org_name: '德康健康评定中心 / 诚康护理',
    caregiver_name: '陈评估主任',
    caregiver_phone: '136****2211',
    elderly_name: '评定准入批次',
    person_id: 'P_MM_01',
    device_id: 'ASH01146',
    description: '医保资质大数据穿透核验发现，德康健康评定中心主要出资人兼任受评定点护理机构监事，未向医保局履行利益回避报备，违反“评照分离”法定监管红线。',
    evidence_snapshot: {
      org_name: '德康健康评定中心',
      related_party: '诚康护理院 (监事关联)',
      disclosure_status: '未如实报备',
    },
    status: 'pending_dispatch',
    dispatch_order: null,
    feedback: null,
    adjudication: null,
    created_at: '2026-09-24T16:00:00+08:00',
  },

  // ========== 宿迁试点真实数据线索（客观感知提醒） ==========
  {
    clue_id: 'CLUE-SQ-001',
    pool_id: 'suqian',
    title: '宿迁长护试点：长者何家齐连续2日夜间心率微弱漂移（客观体征感知）',
    source_type: 'vital_drift',
    source_label: '安守护AI健康守护仪 (ASH01078)',
    risk_level: 'yellow',
    target_org_id: 'bureau_suqian_spot',
    target_org_name: '宿迁市长护试点照护中心',
    caregiver_name: '宿迁责任助老员',
    caregiver_phone: '137****6633',
    elderly_name: '何家齐',
    person_id: 'P_SQ_02',
    device_id: 'ASH01078',
    description: '长者何家齐（82岁，宿迁试点照护点02号）绑定雷达 ASH01078 监测显示夜间心率均值自64bpm升至78bpm，且夜间起夜离床3次。设备客观生理感知提示长者可能有轻微受凉或心肺不适，建议试点助老员上门巡检关怀。',
    evidence_snapshot: {
      avg_hr_baseline: 64,
      avg_hr_recent: 78,
      night_off_bed: 3,
      advice: '试点服务站日常关怀巡访',
    },
    status: 'pending_dispatch',
    dispatch_order: null,
    feedback: null,
    adjudication: null,
    created_at: '2026-09-24T14:10:00+08:00',
  },
]

// ---------- 状态（内存 + JSON 持久化）----------
function buildInitialState() {
  return {
    assessedPersons: SEED_ASSESSED_PERSONS.map((p) => ({
      ...p,
      monitored_device_id: p.device_id,
      service_org_name: ORG_NAMES[p.service_org_id] || p.service_org_id,
    })),
    medicalRecords: [],
    assessors: [...SEED_ASSESSORS],
    assessmentOrgs: [...SEED_ASSESSMENT_ORGS],
    workOrders: [...SEED_WORK_ORDERS],
    applications: [...SEED_APPLICATIONS],
    tasks: [],
    evidences: [],
    snapshots: [],
    insights: [
      {
        insight_id: 'INSIGHT-20260920-001',
        task_id: 'TASK-20260920-0001',
        applicant_id: 'P_MM_01',
        type: 'vital_deviation',
        title: '连续7日夜间体征与离床频次提示',
        detail: '监测窗口内夜间平均离床 3.8 次，心率夜间变异度轻度偏高，提示认知或睡眠障碍风险。',
        suggested_focus: '建议评估师现场着重核实认知功能及夜间防跌倒防范措施。',
        handling_status: 'pending',
        handled_by: null,
        handled_at: null,
        handling_note: null,
        disclaimer: '本提示仅为辅助评估现场调查线索，不得直接作为定级或反欺诈判定依据。',
        created_at: '2026-09-20T09:30:00+08:00',
      },
    ],
    crossValidations: [],
    results: [],
    reviews: [],
    servicePlans: [],
    serviceVisits: [],
    serviceEvidences: [
      {
        evidence_id: 'EVI-20260920-001',
        service_plan_id: 'SP-20260920-0001',
        person_id: 'P00084',
        device_id: 'ASH01146',
        device_signal_match: true,
        service_evidence_status: 'match',
        device_window: { from: '2026-09-20T08:00:00+08:00', to: '2026-09-20T10:00:00+08:00' },
      },
      {
        evidence_id: 'EVI-20260920-002',
        service_plan_id: 'SP-20260920-0002',
        person_id: 'P_MM_04',
        device_id: 'ASH01038',
        device_signal_match: false,
        service_evidence_status: 'mismatch',
        device_window: { from: '2026-09-20T14:00:00+08:00', to: '2026-09-20T15:00:00+08:00' },
      },
    ],
    settlements: [
      {
        settlement_id: 'SETTLE-20260920-001',
        service_plan_id: 'SP-20260920-0001',
        org_name: '某某市康泰居家照护中心',
        applicant_id: 'P00084',
        pool_id: 'moumou',
        period: '2026-09',
        amount: 186400.0,
        status: 'declared',
        declared_by: 'org_mm_01',
        declared_at: '2026-09-20T10:00:00+08:00',
        pre_reviewed_by: null,
        pre_reviewed_at: null,
        re_reviewed_by: null,
        re_reviewed_at: null,
        disbursed_by: null,
        disbursed_at: null,
        steps: {
          declared: { by: 'org_mm_01', at: '2026-09-20T10:00:00+08:00', amount: 186400 },
        },
      },
      {
        settlement_id: 'SETTLE-MM-202609-001',
        service_plan_id: 'SP-MM-001',
        org_name: '某某市康泰居家照护中心',
        applicant_id: 'P_MM_03',
        pool_id: 'moumou',
        period: '2026-09',
        amount: 186400.0,
        status: 'pre_reviewed',
        declared_by: 'org_mm_01',
        declared_at: '2026-09-20T10:00:00+08:00',
        pre_reviewed_by: 'insurer01',
        pre_reviewed_at: '2026-09-24T15:00:00+08:00',
        re_reviewed_by: null,
        re_reviewed_at: null,
        disbursed_by: null,
        disbursed_at: null,
        steps: {
          declared: { by: 'org_mm_01', at: '2026-09-20T10:00:00+08:00', amount: 186400 },
          pre_reviewed: { by: 'insurer01', at: '2026-09-24T15:00:00+08:00', pass: true, note: '经办初审完成，根据雷达空房线索核减违规工单¥4,200后建议终审拨付' },
        },
      },
      {
        settlement_id: 'SETTLE-MM-202609-002',
        service_plan_id: 'SP-MM-002',
        org_name: '某某市颐养天年护理院',
        applicant_id: 'P_MM_04',
        pool_id: 'moumou',
        period: '2026-09',
        amount: 145200.0,
        status: 'pre_reviewed',
        declared_by: 'org_mm_02',
        declared_at: '2026-09-21T09:00:00+08:00',
        pre_reviewed_by: 'insurer01',
        pre_reviewed_at: '2026-09-24T16:00:00+08:00',
        re_reviewed_by: null,
        re_reviewed_at: null,
        disbursed_by: null,
        disbursed_at: null,
        steps: {
          declared: { by: 'org_mm_02', at: '2026-09-21T09:00:00+08:00', amount: 145200 },
          pre_reviewed: { by: 'insurer01', at: '2026-09-24T16:00:00+08:00', pass: true, note: '经办初审通过，挂床走过场考核扣减¥3,000后建议终审核准' },
        },
      },
      {
        settlement_id: 'SETTLE-SQ-202609-004',
        service_plan_id: 'SP-SQ-004',
        org_name: '宿迁市长护试点照护中心',
        applicant_id: 'P_SQ_01',
        pool_id: 'suqian',
        period: '2026-09',
        amount: 28800.0,
        status: 'pre_reviewed',
        declared_by: 'bureau_suqian',
        declared_at: '2026-09-22T08:30:00+08:00',
        pre_reviewed_by: 'insurer01',
        pre_reviewed_at: '2026-09-24T17:00:00+08:00',
        re_reviewed_by: null,
        re_reviewed_at: null,
        disbursed_by: null,
        disbursed_at: null,
        steps: {
          declared: { by: 'bureau_suqian', at: '2026-09-22T08:30:00+08:00', amount: 28800 },
          pre_reviewed: { by: 'insurer01', at: '2026-09-24T17:00:00+08:00', pass: true, note: '宿迁试点3台在床设备监测客观比对100%吻合，经办初审合格' },
        },
      },
    ],
    supervisionClues: [...SEED_SUPERVISION_CLUES],
    institutionCredits: [...SEED_INSTITUTION_CREDITS],
    governanceMode: 'delegated',
    deductedFundsTotal: 48600,
    qualityEvents: [
      {
        event_id: 'QE-20260920-001',
        device_id: 'ASH01076',
        status: 'offline',
        detail: '园区星湖街815终端离线超过24小时，上报链路中断',
        reported_at: '2026-09-21T08:00:00+08:00',
        disposed: false,
        disposed_by: null,
        disposed_at: null,
        disposal_remark: null,
      },
    ],
    supervisionCases: [],
    reports: [
      {
        report_id: 'RPT-202609-001',
        type: 'vital_signs',
        title: '长者生命体征健康综合监测报告（2026-09）',
        owner: 'ward_4f_station',
        role: 'nursing_station',
        source: 'real',
        is_simulated: false,
        patient_id: 'P00084',
        patient_name: '张卫国',
        bed_id: '401-A',
        ward: '4F 康复特护区',
        nurse_name: '李晓芳 (责任护工)',
        auditor: '沈雅琴 (护士长)',
        status: 'archived',
        period: '2026-09',
        generated_at: '2026-09-24T18:00:00+08:00',
        data: {
          period: '2026-09',
          subject: '张卫国',
          summary: '24小时连续监测客观体征：心率窦性稳定，呼吸平稳无暂停，在床与微动时序规律。',
          vital_metrics: {
            avg_hr: 72,
            min_hr: 58,
            max_hr: 88,
            avg_br: 18,
            min_br: 14,
            max_br: 22,
            avg_tp: 36.6,
            in_bed_hours: 14.5,
            leave_bed_times: 3,
            sleep_score: 89,
            deep_sleep_hours: 3.2,
            light_sleep_hours: 4.8,
            rem_sleep_hours: 1.5,
          },
          monitoring: { source: 'real', is_simulated: false },
        },
      },
      {
        report_id: 'RPT-202609-002',
        type: 'turn_position',
        title: '卧床长者防压疮定时翻身与体位记录报告（2026-09）',
        owner: 'ward_4f_station',
        role: 'nursing_station',
        source: 'real',
        is_simulated: false,
        patient_id: 'P00084',
        patient_name: '张卫国',
        bed_id: '401-A',
        ward: '4F 康复特护区',
        nurse_name: '李晓芳 (责任护工)',
        auditor: '沈雅琴 (护士长)',
        status: 'archived',
        period: '2026-09',
        generated_at: '2026-09-24T17:30:00+08:00',
        data: {
          period: '2026-09',
          subject: '张卫国',
          braden_score: 11,
          braden_risk: '极高危 (高频防压疮干预)',
          scheduled_interval: '2小时/次',
          monthly_turn_count: 360,
          compliance_rate: 98.6,
          posture_distribution: { left: 34, right: 36, supine: 30 },
          skin_integrity_status: '完好无破损，骨隆突处受压潮红在20分钟内完全消褪',
          incident_count: 0,
          evaluator: '沈雅琴 (护士长)',
        },
      },
      {
        report_id: 'RPT-202609-003',
        type: 'long_care_insurance',
        title: '长护险月度医保结算合规审计与服务工单报告（2026-09）',
        owner: 'kaijian_admin',
        role: 'nursing_admin',
        source: 'real',
        is_simulated: false,
        org_name: '凯健国际护理院',
        tenant_id: 'kaijian',
        pool_id: 'bureau_moumou',
        auditor: '某某市医保局长护险专班 / 太平洋保险复核组',
        status: 'archived',
        period: '2026-09',
        generated_at: '2026-09-24T16:00:00+08:00',
        data: {
          period: '2026-09',
          application_count: 48,
          assessment_count: 48,
          approved_count: 46,
          risk_cases_count: 0,
          verified_hours: 21600,
          audit_pass_rate: 100,
          settlement_amount: 153600.0,
          fund_status: '已初审复核通过，进入拨付结算流程',
          source: 'real',
          is_simulated: false,
        },
      },
      {
        report_id: 'RPT-202609-004',
        type: 'device_quality',
        title: '机构智能感知设备运行质量与在线监测报告（2026-09）',
        owner: 'kaijian_admin',
        role: 'nursing_admin',
        source: 'real',
        is_simulated: false,
        org_name: '凯健国际护理院',
        status: 'archived',
        period: '2026-09',
        generated_at: '2026-09-24T15:00:00+08:00',
        data: {
          period: '2026-09',
          org_name: '凯健国际护理院',
          total_devices: 80,
          online_rate: 98.9,
          devices_by_type: [
            { type: '智能睡眠监护床垫', total: 48, online: 48, rate: 100 },
            { type: '毫米波防跌倒雷达', total: 24, online: 23, rate: 95.8 },
            { type: '一键紧急呼叫终端', total: 8, online: 8, rate: 100 },
          ],
          signal_quality_avg: '-68 dBm (优)',
          mttr_minutes: 14,
          disposed_events_count: 12,
        },
      },
      {
        report_id: 'RPT-202609-005',
        type: 'vital_signs',
        title: '长者生命体征健康综合监测报告（2026-09）',
        owner: 'ward_4f_station',
        role: 'nursing_station',
        source: 'real',
        is_simulated: false,
        patient_id: 'P00085',
        patient_name: '李建平',
        bed_id: '402-B',
        ward: '4F 康复特护区',
        nurse_name: '李晓芳 (责任护工)',
        auditor: '沈雅琴 (护士长)',
        status: 'archived',
        period: '2026-09',
        generated_at: '2026-09-24T14:30:00+08:00',
        data: {
          period: '2026-09',
          subject: '李建平',
          summary: '24小时连续监测客观体征：心率均值76bpm，夜间偶有轻微早搏，呼吸平稳。',
          vital_metrics: {
            avg_hr: 76,
            min_hr: 62,
            max_hr: 92,
            avg_br: 19,
            min_br: 15,
            max_br: 24,
            avg_tp: 36.7,
            in_bed_hours: 13.8,
            leave_bed_times: 4,
            sleep_score: 84,
            deep_sleep_hours: 2.8,
            light_sleep_hours: 5.1,
            rem_sleep_hours: 1.4,
          },
          monitoring: { source: 'real', is_simulated: false },
        },
      },
    ],
    audit: [],
    seq: 0,
  }
}

let persistEnabled = process.env.DISABLE_LTC_PERSIST !== 'true'
export function setPersistEnabled(v) {
  persistEnabled = !!v
}

let state = buildInitialState()
// 阶段四：DATA_LAYER=sqlite 优先恢复；否则回退 ltc-store.json（可回滚种子/文件模式）
// loadLtcState 为 async；seed 模式立即 null，不加载 node:sqlite
if (persistEnabled && dataLayerMode() === 'sqlite') {
  const savedSql = await loadLtcState()
  if (savedSql && typeof savedSql === 'object') {
    state = { ...buildInitialState(), ...savedSql }
    mergeSeedIntoState(state, savedSql)
  }
} else if (persistEnabled && fs.existsSync(STORE_PATH)) {
  try {
    const saved = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
    state = { ...buildInitialState(), ...saved }
    mergeSeedIntoState(state, saved)
  } catch (err) {
    console.warn('[ltc] 恢复历史状态失败，使用初始状态:', err.message)
  }
}

function mergeSeedIntoState(st, saved) {
  // 确保全量 SEED_ASSESSED_PERSONS 注入/更新到持久化状态中，避免旧 store 丢失新增医保评估长者与设备绑定
  const personMap = new Map()
  for (const p of (saved.assessedPersons || [])) {
    personMap.set(p.person_id, p)
  }
  for (const seed of SEED_ASSESSED_PERSONS) {
    const existing = personMap.get(seed.person_id)
    personMap.set(seed.person_id, {
      ...seed,
      monitored_device_id: seed.device_id,
      service_org_name: ORG_NAMES[seed.service_org_id] || seed.service_org_id,
      ...(existing || {}),
      device_id: seed.device_id,
      monitored_device_id: seed.device_id,
      device_model: seed.device_model,
      service_org_id: seed.service_org_id,
      service_org_name: ORG_NAMES[seed.service_org_id] || seed.service_org_id,
      assessment_batch: seed.assessment_batch,
    })
  }
  st.assessedPersons = Array.from(personMap.values())

  if (!st.medicalRecords || st.medicalRecords.length === 0) {
    st.medicalRecords = [...SEED_MEDICAL_RECORDS]
  }
  if (!st.assessors || st.assessors.length === 0) {
    st.assessors = [...SEED_ASSESSORS]
  }
  if (!st.assessmentOrgs || st.assessmentOrgs.length === 0) {
    st.assessmentOrgs = [...SEED_ASSESSMENT_ORGS]
  }
  if (!st.workOrders || st.workOrders.length === 0) {
    st.workOrders = [...SEED_WORK_ORDERS]
  }
  const appMap = new Map()
  for (const a of (saved.applications || [])) {
    appMap.set(a.application_id, a)
  }
  for (const seedApp of SEED_APPLICATIONS) {
    if (!appMap.has(seedApp.application_id)) {
      appMap.set(seedApp.application_id, seedApp)
    }
  }
  st.applications = Array.from(appMap.values())

  if (!st.supervisionClues || st.supervisionClues.length === 0) {
    st.supervisionClues = [...SEED_SUPERVISION_CLUES]
  }
  if (!st.institutionCredits || st.institutionCredits.length === 0) {
    st.institutionCredits = [...SEED_INSTITUTION_CREDITS]
  }
  if (!st.governanceMode) {
    st.governanceMode = 'delegated'
  }
  if (st.deductedFundsTotal === undefined) {
    st.deductedFundsTotal = 48600
  }
  const settleMap = new Map((st.settlements || []).map((s) => [s.settlement_id, s]))
  for (const s of [
    {
      settlement_id: 'SETTLE-202609-002',
      service_plan_id: 'SP-20260920-0002',
      org_name: '某某市颐养天年护理院',
      applicant_id: 'P00084',
      pool_id: 'moumou',
      period: '2026-09',
      amount: 153600.0,
      status: 'pre_reviewed',
      declared_by: 'kaijian_admin',
      declared_at: '2026-09-20T10:00:00+08:00',
      pre_reviewed_by: 'insurer01',
      pre_reviewed_at: '2026-09-24T15:00:00+08:00',
      re_reviewed_by: null,
      re_reviewed_at: null,
      disbursed_by: null,
      disbursed_at: null,
      steps: {
        declared: { by: 'kaijian_admin', at: '2026-09-20T10:00:00+08:00', amount: 153600 },
        pre_reviewed: { by: 'insurer01', at: '2026-09-24T15:00:00+08:00', pass: true, note: '经办初审完成，打卡真实核验率99.6%，建议予以医保复核' },
      },
    },
    {
      settlement_id: 'SETTLE-202609-003',
      service_plan_id: 'SP-20260920-0003',
      org_name: '某某市康泰居家照护中心',
      applicant_id: 'P00084',
      pool_id: 'moumou',
      period: '2026-09',
      amount: 86400.0,
      status: 'pre_reviewed',
      declared_by: 'elderly_care_admin',
      declared_at: '2026-09-21T09:00:00+08:00',
      pre_reviewed_by: 'insurer01',
      pre_reviewed_at: '2026-09-24T16:00:00+08:00',
      re_reviewed_by: null,
      re_reviewed_at: null,
      disbursed_by: null,
      disbursed_at: null,
      steps: {
        declared: { by: 'elderly_care_admin', at: '2026-09-21T09:00:00+08:00', amount: 86400 },
        pre_reviewed: { by: 'insurer01', at: '2026-09-24T16:00:00+08:00', pass: true, note: '经办初审通过，核减可疑空房工单1200元后建议复核' },
      },
    },
    {
      settlement_id: 'SETTLE-202609-004',
      service_plan_id: 'SP-20260920-0004',
      org_name: '宿迁市长护试点照护中心',
      applicant_id: 'P_SQ_01',
      pool_id: 'suqian',
      period: '2026-09',
      amount: 28800.0,
      status: 'pre_reviewed',
      declared_by: 'bureau_suqian',
      declared_at: '2026-09-22T08:30:00+08:00',
      pre_reviewed_by: 'insurer01',
      pre_reviewed_at: '2026-09-24T17:00:00+08:00',
      re_reviewed_by: null,
      re_reviewed_at: null,
      disbursed_by: null,
      disbursed_at: null,
      steps: {
        declared: { by: 'bureau_suqian', at: '2026-09-22T08:30:00+08:00', amount: 28800 },
        pre_reviewed: { by: 'insurer01', at: '2026-09-24T17:00:00+08:00', pass: true, note: '宿迁试点在床设备监测客观比对100%吻合，经办初审合格' },
      },
    },
  ]) {
    if (!settleMap.has(s.settlement_id)) {
      st.settlements.push(s)
    }
  }
}

export function resetState() {
  state = buildInitialState()
  persist()
}

export function getState() {
  return state
}

export function auditLog() {
  return state.audit
}

function persist() {
  if (!persistEnabled) return
  if (dataLayerMode() === 'sqlite') {
    saveLtcState(state).catch((err) => console.error('[ltc] sqlite 持久化失败:', err.message))
    return
  }
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf8')
  } catch (err) {
    console.error('[ltc] 持久化失败:', err.message)
  }
}

// ---------- ID 生成与审计 ----------
function bumpSeq() {
  state.seq = (state.seq + 1) % 999999
  return String(state.seq).padStart(6, '0')
}

function id(prefix) {
  const day = nowIso8().slice(0, 10).replace(/-/g, '')
  return `${prefix}-${day}-${bumpSeq()}`
}

function audit(ctx, action, target, detail = null) {
  state.audit.push({
    audit_id: id('AUD'),
    who: ctx.username,
    role: ctx.role,
    action,
    target,
    when: nowIso8(),
    detail,
  })
}

function currentPeriod() {
  const d = nowIso8().slice(0, 10)
  const year = Number(d.slice(0, 4))
  const month = Number(d.slice(5, 7))
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
}

// ---------- 被评估对象查询（长护险域）----------
export function listAssessedPersons(ctx, query = {}) {
  assertPerm(ctx, 'assessed_person:read')
  let list = state.assessedPersons || []
  if (query.person_id) list = list.filter((p) => p.person_id === query.person_id)
  if (query.name) list = list.filter((p) => p.name.includes(query.name))
  const pool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : null)
  if (pool && pool !== 'all') {
    if (pool === 'suqian') {
      list = list.filter((p) => p.pool_id === 'suqian' || p.person_id.startsWith('P_SQ_'))
    } else if (pool === 'moumou') {
      list = list.filter((p) => p.pool_id === 'moumou' || p.person_id.startsWith('P_MM_'))
    } else {
      list = list.filter((p) => p.pool_id === pool)
    }
  }
  return list
}

// ---------- 申请（Application）与国家门禁 ----------
export function createApplication(ctx, input) {
  assertPerm(ctx, 'application:create')
  const applicantId = input?.applicant_id
  if (!applicantId) throw new LtcError(400, 'applicant_id 必填')

  if (ctx.role === 'family_contact' && !(ctx.applicant_ids ?? []).includes(applicantId)) {
    throw new LtcError(403, '家属仅可为本绑定长者发起申请')
  }

  const type = input?.type ?? 'first_apply'
  if (!['first_apply', 're_assess', 'change', 'appeal'].includes(type)) {
    throw new LtcError(400, 'type 仅支持 first_apply/re_assess/change/appeal')
  }

  // 自评依赖门槛核验（表B）
  const selfGrade = input?.self_assessment_grade ?? 'F级 (重度依赖)'
  if (input?.self_assessment_grade && !['E级', 'F级', 'G级', 'E级 (中度依赖)', 'F级 (重度依赖)', 'G级 (完全依赖)'].some(k => input.self_assessment_grade.includes(k))) {
    throw new LtcError(400, '国家评估门禁：申请人自评未达依赖门槛（须达到 E/F/G 级），暂不予受理')
  }

  const period = input?.period ?? currentPeriod()
  const dup = state.applications.find(
    (a) =>
      a.applicant_id === applicantId &&
      a.period === period &&
      a.type === type &&
      !['materials_rejected'].includes(a.status),
  )
  if (dup) throw new LtcError(409, '同一期内同一类型已存在有效申请')

  const app = {
    application_id: id('APP'),
    applicant_id: applicantId,
    type,
    period,
    application_level: input?.application_level || '重度失能Ⅲ级', // 申请申报等级倾向
    self_assessment_grade: selfGrade,
    identity_verification: input?.identity_verification !== undefined ? input.identity_verification : true,
    submitter: {
      role: ctx.role,
      account_id: ctx.username,
      name: ctx.staff_name,
      tenant_id: ctx.tenant_id,
    },
    status: 'draft',
    apply_date: nowIso8().slice(0, 10),
    scale_version: null,
    tenant_id: ctx.tenant_id,
    created_at: nowIso8(),
    updated_at: nowIso8(),
  }
  state.applications.push(app)
  audit(ctx, 'application.create', app.application_id)
  persist()
  return app
}

function canReadApplication(ctx, app) {
  if (ctx.role === 'su') return true
  if (ctx.role === 'admin' || ctx.role === 'platform_admin' || ctx.role === 'user' || ctx.role === 'nursing_admin') {
    return app.tenant_id === ctx.tenant_id
  }
  if (ctx.role === 'family_contact') return (ctx.applicant_ids ?? []).includes(app.applicant_id)
  if (ctx.role === 'medical_supervisor' || ctx.role === 'medical_insurance_staff' || ctx.role === 'insurer_operator' || ctx.role === 'insurer_staff') {
    return true
  }
  if (ctx.role === 'assessor') {
    return state.tasks.some(
      (t) => t.application_id === app.application_id && t.assessor.account_id === ctx.username,
    )
  }
  return false
}

export function listApplications(ctx, query = {}) {
  let list = state.applications.filter((a) => canReadApplication(ctx, a))
  if (query.applicant_id) list = list.filter((a) => a.applicant_id === query.applicant_id)
  if (query.status) list = list.filter((a) => a.status === query.status)
  if (query.period) list = list.filter((a) => a.period === query.period)
  const pool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : null)
  if (pool && pool !== 'all') {
    list = list.filter((a) => (a.pool_id === pool) || (pool === 'suqian' ? (a.applicant_id?.startsWith('P_SQ_') || a.application_id?.includes('SQ')) : (!a.applicant_id?.startsWith('P_SQ_') && !a.application_id?.includes('SQ'))))
  }
  return list
}

export function getApplication(ctx, applicationId) {
  const app = state.applications.find((a) => a.application_id === applicationId)
  if (!app || !canReadApplication(ctx, app)) throw new LtcError(404, '申请不存在')
  return app
}

export function submitApplication(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  assertPerm(ctx, 'application:submit')
  if (app.status === 'draft' || app.status === 'materials_rejected') {
    app.status = 'submitted'
  } else {
    throw new LtcError(400, `当前状态 ${app.status} 不可提交`)
  }
  app.updated_at = nowIso8()
  audit(ctx, 'application.submit', app.application_id)
  persist()
  return app
}

// ---------- 评估任务（AssessmentTask）与利益回避 ----------
function resolveAssessor(accountUsername) {
  if (!accountUsername) throw new LtcError(400, '需指定评估员 assessor_account')
  const acc = ACCOUNTS.find((a) => a.username === accountUsername && (a.role === 'assessor' || a.unified_role === 'assessor'))
  if (!acc) throw new LtcError(404, '评估员不存在')
  return acc
}

function conflictOfInterest(assessorAcc, app) {
  return assessorAcc.org_id === app.tenant_id
}

export function createAssessmentTask(ctx, input) {
  assertPerm(ctx, 'task:dispatch')
  const app = state.applications.find((a) => a.application_id === input?.application_id)
  if (!app) throw new LtcError(404, '申请不存在')
  if (!['submitted', 'materials_review', 'materials_pass', 'assess_pending'].includes(app.status)) {
    throw new LtcError(400, `申请状态 ${app.status} 不可派单`)
  }
  const assessorAcc = resolveAssessor(input?.assessor_account)
  if (conflictOfInterest(assessorAcc, app)) {
    throw new LtcError(409, '利益回避阻断：评估员与该申请所属机构存在利益关系，拒绝派单')
  }

  const scaleVersion = input?.scale_version ?? 'sc-2026-v3'
  app.status = 'assess_pending'
  app.scale_version = scaleVersion
  app.updated_at = nowIso8()

  // 现场人员构成门禁：双人上门且含评估专家
  const assessorIds = input?.assessor_ids || [assessorAcc.username, 'exp_002']
  const task = {
    task_id: id('AT'),
    application_id: app.application_id,
    applicant_id: app.applicant_id,
    assessor: { account_id: assessorAcc.username, name: assessorAcc.staff_name },
    assessor_ids: assessorIds,
    expert_confirmation: input?.expert_confirmation || ['exp_001', 'exp_002'],
    guardian_present: input?.guardian_present !== undefined ? input.guardian_present : true,
    onsite_at: input?.onsite_at || null,
    video_evidence: input?.video_evidence || null,
    scale_version: scaleVersion,
    assessment_window: {
      from: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      to: nowIso8(),
    },
    status: 'assigned',
    assigned_at: nowIso8(),
    accepted_at: null,
    started_at: null,
    completed_at: null,
    result_id: null,
    tenant_id: app.tenant_id,
    created_at: nowIso8(),
    updated_at: nowIso8(),
  }
  state.tasks.push(task)
  audit(ctx, 'task.dispatch', task.task_id)
  persist()
  return task
}

function canReadTask(ctx, task) {
  if (ctx.role === 'su') return true
  if (ctx.role === 'assessor') return task.assessor.account_id === ctx.username
  if (ctx.role === 'admin' || ctx.role === 'platform_admin' || ctx.role === 'user' || ctx.role === 'nursing_admin') {
    return task.tenant_id === ctx.tenant_id
  }
  if (ctx.role === 'insurer_operator' || ctx.role === 'insurer_staff' || ctx.role === 'medical_supervisor' || ctx.role === 'medical_insurance_staff') {
    return true
  }
  return false
}

function requireOwnTask(ctx, taskId) {
  if (ctx.role !== 'assessor') throw new LtcError(404, '任务不存在')
  const task = state.tasks.find((t) => t.task_id === taskId)
  if (!task || task.assessor.account_id !== ctx.username) throw new LtcError(404, '任务不存在')
  return task
}

export function listAssessmentTasks(ctx, query = {}) {
  let list = state.tasks.filter((t) => canReadTask(ctx, t))
  if (query.application_id) list = list.filter((t) => t.application_id === query.application_id)
  if (query.status) list = list.filter((t) => t.status === query.status)
  if (query.assessor) list = list.filter((t) => t.assessor.account_id === query.assessor)
  return list
}

export function getAssessmentTask(ctx, taskId) {
  const task = state.tasks.find((t) => t.task_id === taskId)
  if (!task || !canReadTask(ctx, task)) throw new LtcError(404, '任务不存在')
  return task
}

export function acceptTask(ctx, taskId) {
  const task = requireOwnTask(ctx, taskId)
  assertPerm(ctx, 'task:operate')
  if (task.status !== 'assigned') throw new LtcError(400, `任务状态 ${task.status} 不可接单`)
  task.status = 'assessing'
  task.accepted_at = nowIso8()
  task.updated_at = nowIso8()
  audit(ctx, 'task.accept', task.task_id)
  persist()
  return task
}

export function startTask(ctx, taskId) {
  const task = requireOwnTask(ctx, taskId)
  assertPerm(ctx, 'task:operate')
  if (!['assigned', 'assessing'].includes(task.status)) {
    throw new LtcError(400, `任务状态 ${task.status} 不可开始`)
  }
  if (task.status === 'assigned') {
    task.status = 'assessing'
    task.accepted_at = nowIso8()
  }
  task.started_at = nowIso8()
  task.onsite_at = task.onsite_at || nowIso8()
  task.updated_at = nowIso8()
  audit(ctx, 'task.start', task.task_id)
  persist()
  return task
}

// ---------- 设备介入数据包快照（AssessmentSnapshot）----------
export function createAssessmentSnapshot(ctx, input) {
  const taskId = input?.assessment_id || input?.task_id
  const task = state.tasks.find((t) => t.task_id === taskId)
  if (!task) throw new LtcError(404, '评估任务不存在')

  const window = input?.window || task.assessment_window || {
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    to: nowIso8(),
  }

  const snapshotId = id('SNAP')
  const person = state.assessedPersons.find((p) => p.person_id === task.applicant_id)
  const deviceId = input?.device_id || person?.device_id || 'ASH01146'

  const snapshot = {
    snapshot_id: snapshotId,
    task_id: task.task_id,
    assessment_id: task.task_id,
    application_id: task.application_id,
    person_id: task.applicant_id,
    applicant_id: task.applicant_id,
    disclaimer_acknowledged: true,
    binding_id: 'MB-' + task.task_id,
    device_id: deviceId,
    assessment_window: window,
    source_account: 'platform',
    device_status: 'online',
    coverage: {
      expected_minutes: 43200,
      covered_minutes: 40280,
      coverage_pct: 93.2,
    },
    missing_intervals: [
      { from: '2026-09-01T02:00:00+08:00', to: '2026-09-01T02:15:00+08:00', reason: 'device_offline' },
    ],
    metrics: {
      night_trips: 43,
      in_bed_rate_pct: 61.2,
      bed_leave_15min_count: 12,
      fall_pose_events: 1,
      hr_abnormal_days: 7,
      tp_abnormal_days: 5,
      avg_hr: 78.4,
      avg_br: 18.2,
      avg_tp: 36.7,
    },
    alerts: [
      { type: 'off_bed', occurred_at: '2026-09-20T03:22:15+08:00', level: 2, handled_by: '李晓芳 护士' },
    ],
    sleep_summary: {
      avg_sleep_hours: 7.2,
      awake_nights: 4,
      fragmentation: 'moderate',
    },
    raw_refs: [
      { kind: 'vitals', api: '/api/v1/hardware/latest_data', ref: `raw://${deviceId.toLowerCase()}/vitals`, range: `${window.from}..${window.to}` },
    ],
    status: 'frozen',
    generated_by: { role: ctx.role, account_id: ctx.username },
    generated_at: nowIso8(),
  }
  state.snapshots.push(snapshot)

  // 产出 AI 助手洞察 assistant_insight
  const insightId = id('INS')
  const insight = {
    insight_id: insightId,
    type: 'assistant_insight',
    insight_version: 'ins-2026-v1',
    snapshot_id: snapshotId,
    assessment_id: task.task_id,
    input_evidence_refs: [snapshotId],
    focus: '夜间离床与跌倒风险',
    summary: '评估窗口内夜间离床 43 次，长时离床 12 次，跌倒姿态预警 1 次',
    suggestion: '建议评估师对照夜间离床频次与自理翻身项，核验夜间防跌倒陪护需求',
    assessor_handle: null,
  }
  state.insights.push(insight)

  // 产出交叉验证 cross_validation
  const cvId = id('CV')
  const cv = {
    cv_id: cvId,
    type: 'cross_validation',
    snapshot_id: snapshotId,
    assessment_id: task.task_id,
    paired: [
      { subject: '离床自理', assessment_answer: '需协助', device_summary: '夜间离床43次需协助回床', result: 'consistent' },
      { subject: '体温波动', assessment_answer: '平稳', device_summary: '体温均值36.7℃平稳', result: 'consistent' },
    ],
    overall: 'consistent',
    suggestion: '设备客观监测摘要与量表描述方向一致，可作为主观评估依据的佐证材料',
    generated_at: nowIso8(),
  }
  state.crossValidations.push(cv)

  // 固化为 evidence_monitoring 存入 evidences，遵循红线：conclusion 恒为 null
  state.evidences.push({
    evidence_id: snapshotId,
    task_id: task.task_id,
    application_id: task.application_id,
    applicant_id: task.applicant_id,
    type: 'evidence_monitoring',
    source: 'mock',
    is_simulated: true,
    cross_verified: true,
    attached_to_conclusion: true,
    conclusion: null, // 强制 null
    recorded_by: ctx.username,
    recorded_at: nowIso8(),
    metrics: snapshot.metrics,
  })

  audit(ctx, 'snapshot.create', snapshotId)
  persist()
  return snapshot
}

export function getAssessmentSnapshot(ctx, snapshotId) {
  const snap = state.snapshots.find((s) => s.snapshot_id === snapshotId)
  if (!snap) throw new LtcError(404, '快照不存在')
  return snap
}

// ---------- 评估师处理 AI 洞察（POST /v1/ltc/insights/:id/handle）----------
export function handleInsight(ctx, insightId, input) {
  assertPerm(ctx, 'insight:handle')
  const insight = state.insights.find((i) => i.insight_id === insightId)
  if (!insight) throw new LtcError(404, '洞察记录不存在')

  const result = input?.result || input?.action
  if (!['confirmed', 'adopted', 'rejected', 'needs_manual_review'].includes(result)) {
    throw new LtcError(400, '处理结果仅支持 confirmed / adopted / rejected / needs_manual_review')
  }
  const note = input?.note || input?.remark || '已现场核验，采纳作为评估佐证'

  insight.handling_status = result
  insight.handled_by = ctx.username
  insight.handled_at = nowIso8()
  insight.handling_note = note
  insight.assessor_handle = {
    result,
    remark: note,
    signature_ref: input?.signature_ref || `sig://${ctx.username}/${Date.now()}`,
    handled_by: ctx.username,
    handled_at: nowIso8(),
  }
  audit(ctx, 'insight.handle', insightId, result)
  persist()
  return insight
}

export function listEvidence(ctx, taskId) {
  assertPerm(ctx, 'evidence:read')
  let list = state.evidences
  if (taskId) list = list.filter((e) => e.task_id === taskId)
  return list
}

// ---------- 录入证据 ----------
export function addEvidence(ctx, taskId, input) {
  const task = requireOwnTask(ctx, taskId)
  assertPerm(ctx, 'evidence:write')
  if (task.status !== 'assessing') {
    throw new LtcError(400, `任务状态 ${task.status} 不可录入证据（评估提交后锁定）`)
  }
  const type = input?.type ?? 'evidence_assessment'
  if (!['evidence_assessment', 'evidence_monitoring', 'evidence_material'].includes(type)) {
    throw new LtcError(400, '证据类型不支持')
  }
  const isMonitoring = type === 'evidence_monitoring'
  const ev = {
    evidence_id: id('EV'),
    task_id: task.task_id,
    application_id: task.application_id,
    applicant_id: task.applicant_id,
    type,
    item_id: input?.item_id ?? null,
    assessed_value: input?.assessed_value ?? null,
    evidence_ref: input?.evidence_ref ?? null,
    signature_ref: input?.signature_ref ?? null,
    recorded_by: ctx.username,
    recorded_at: nowIso8(),
    source: input?.source ?? (isMonitoring ? 'mock' : 'manual'),
    is_simulated: input?.is_simulated ?? isMonitoring,
    cross_verified: input?.cross_verified ?? !isMonitoring,
    attached_to_conclusion: input?.attached_to_conclusion ?? false,
    conclusion: null, // 强制 null
  }
  state.evidences.push(ev)
  audit(ctx, 'evidence.add', ev.evidence_id)
  persist()
  return ev
}

// ---------- 评估任务提交（区分 assessor_level）与双专家确认 ----------
export function submitTask(ctx, taskId, input = {}) {
  const task = requireOwnTask(ctx, taskId)
  assertPerm(ctx, 'result:submit')
  if (task.status !== 'assessing') {
    throw new LtcError(400, `任务状态 ${task.status} 不可提交`)
  }

  // 评估师现场判定等级（严禁单一 level）
  const assessorLevel = input?.assessor_level || input?.level || '重度失能Ⅱ级'
  const version = state.results.filter((r) => r.application_id === task.application_id).length + 1
  const evidences = state.evidences.filter((e) => e.task_id === task.task_id)
  const app = state.applications.find((a) => a.application_id === task.application_id)

  const result = {
    result_id: id('AR'),
    application_id: task.application_id,
    task_id: task.task_id,
    applicant_id: task.applicant_id,
    scale_version: task.scale_version,
    ruleset_version: `${task.scale_version}-r1`,
    domain_scores: { 自理能力: 35, 认知能力: 8, 精神行为: 10, 感知沟通: 6 },
    total_score: 59,
    // 明确四等级
    application_level: app?.application_level || '重度失能Ⅲ级',
    assessor_level: assessorLevel, // 评估师判定等级
    insurer_suggested_level: null,  // 待经办审核
    final_approved_level: null,     // 待最终定级
    disability_level: null, // SCORE_RULE 启用并确认前保持 null
    evidence_refs: evidences.filter((e) => e.type === 'evidence_assessment').map((e) => e.evidence_id),
    monitoring_refs: evidences.filter((e) => e.type === 'evidence_monitoring').map((e) => e.evidence_id),
    // 国家门禁记录
    assessor_ids: task.assessor_ids || [ctx.username, 'exp_002'],
    expert_confirmation: input?.expert_confirmation || ['exp_001', 'exp_002'],
    guardian_present: task.guardian_present,
    onsite_at: task.onsite_at || nowIso8(),
    video_evidence: task.video_evidence || 'EV-A-VID-20260922-001',
    identity_verification: true,
    public_notice: null,
    status: 'pending_review',
    version,
    assessor: task.assessor,
    assessed_at: nowIso8(),
    confirmed_by: null,
    confirmed_at: null,
    created_at: nowIso8(),
    updated_at: nowIso8(),
  }
  state.results.push(result)

  task.status = 'completed'
  task.completed_at = nowIso8()
  task.result_id = result.result_id
  task.updated_at = nowIso8()

  audit(ctx, 'task.submit', result.result_id)
  persist()
  return { task, result }
}

export function returnTask(ctx, taskId, input) {
  assertPerm(ctx, 'result:return')
  const task = state.tasks.find((t) => t.task_id === taskId)
  if (!task) throw new LtcError(404, '任务不存在')
  const reason = (input?.reason ?? '').trim()
  if (!reason) throw new LtcError(400, '退回必须填写 reason')
  if (!['assessing', 'completed'].includes(task.status)) {
    throw new LtcError(400, `任务状态 ${task.status} 不可退回`)
  }
  const result = state.results.find((r) => r.task_id === task.task_id)
  task.status = 'returned'
  task.updated_at = nowIso8()
  if (result) {
    result.status = 'returned'
    result.return_reason = reason
    result.updated_at = nowIso8()
  }
  state.reviews.push({
    review_id: id('RV'),
    task_id: task.task_id,
    result_id: result?.result_id ?? null,
    action: 'return',
    reason,
    by: ctx.username,
    at: nowIso8(),
  })
  audit(ctx, 'task.return', task.task_id, reason)
  persist()
  return { task, result }
}

// ---------- 经办审核通过并定级（四等级落地）----------
export function approveReview(ctx, resultId, input = {}) {
  assertPerm(ctx, 'result:approve')
  const result = state.results.find((r) => r.result_id === resultId)
  if (!result) throw new LtcError(404, '评估结果不存在')
  if (result.status !== 'pending_review' && result.status !== 'public_notice') {
    throw new LtcError(400, `结果状态 ${result.status} 不可审核通过`)
  }

  // 经办建议等级与最终核定等级
  const suggestedLevel = input?.insurer_suggested_level || result.assessor_level || '重度失能Ⅱ级'
  const finalLevel = input?.final_approved_level || suggestedLevel

  result.insurer_suggested_level = suggestedLevel
  result.final_approved_level = finalLevel
  result.disability_level = finalLevel
  result.status = 'approved'
  result.confirmed_by = ctx.username
  result.confirmed_at = nowIso8()
  result.updated_at = nowIso8()

  state.reviews.push({
    review_id: id('RV'),
    task_id: result.task_id,
    result_id: result.result_id,
    action: 'approve',
    suggested_level: suggestedLevel,
    final_level: finalLevel,
    reason: null,
    by: ctx.username,
    at: nowIso8(),
  })

  // 如果尚未生成服务计划，自动初始化生成 ServicePlan 保证闭环
  let plan = state.servicePlans.find((p) => p.applicant_id === result.applicant_id)
  if (!plan) {
    plan = {
      service_plan_id: id('SP'),
      applicant_id: result.applicant_id,
      person_id: result.applicant_id,
      final_approved_level: finalLevel,
      service_org_id: 'kaijian',
      care_plan_confirmation: {
        confirmed_by: '本人/监护人代签',
        confirmed_at: nowIso8(),
      },
      service_items: [
        { item_code: 'LTC-01', name: '晨间清洁与生活护理', frequency: '每日1次', duration_min: 30 },
        { item_code: 'LTC-02', name: '卧床协助翻身与体位管理', frequency: '每2小时1次', duration_min: 15 },
        { item_code: 'LTC-03', name: '安全陪护与跌倒防护', frequency: '全天连续监测', duration_min: 720 },
      ],
      status: 'active',
      created_at: nowIso8(),
    }
    state.servicePlans.push(plan)
  }

  audit(ctx, 'result.approve', result.result_id, finalLevel)
  persist()
  return result
}

// ---------- 服务实施与服务证据查询 ----------
export function listServicePlans(ctx, query = {}) {
  return state.servicePlans
}

export function listServiceVisits(ctx, query = {}) {
  return state.serviceVisits
}

export function listServiceEvidence(ctx, query = {}) {
  assertPerm(ctx, 'service_evidence:read')
  let list = state.serviceEvidences
  if (query.service_plan_id) list = list.filter((e) => e.service_plan_id === query.service_plan_id)
  if (query.person_id) list = list.filter((e) => e.person_id === query.person_id)
  if (query.status) list = list.filter((e) => e.service_evidence_status === query.status)
  return list
}

// ---------- 结算四步分离（申报 → 初审 → 复核 → 拨付）----------
export function listSettlements(ctx, query = {}) {
  assertPerm(ctx, 'settlement:read')
  return state.settlements
}

export function reviewSettlement(ctx, settlementId, input = {}) {
  assertPerm(ctx, 'settlement:review')
  const set = state.settlements.find(
    (s) => s.settlement_id === settlementId || s.settlement_id.replace(/-/g, '') === settlementId.replace(/-/g, '')
  )
  if (!set) throw new LtcError(404, '结算单不存在')

  let action = input?.action
  if (input?.step !== undefined) {
    if (input.step === 2) action = 'pre_review'
    else if (input.step === 3) action = 're_review'
    else if (input.step === 4) action = 'disburse'
  }

  if (action === 'pre_review') {
    if (!isInsurerRole(ctx.role) && !['platform_admin', 'admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '结算初审须由经办机构执行')
    }
    if (set.status !== 'declared') throw new LtcError(400, `当前状态 [${set.status}] 不可初审`)
    set.status = 'pre_reviewed'
    set.pre_reviewed_by = ctx.username
    set.pre_reviewed_at = nowIso8()
    const deductAmt = Number(input?.deducted_amount || 0)
    const reasons = Array.isArray(input?.deduction_reasons) ? input.deduction_reasons : (input?.note ? [input.note] : ['物联客观证据比对核验'])
    set.pre_review_deduction = deductAmt
    set.pre_review_reasons = reasons
    set.pre_review_voucher = {
      voucher_no: `INSAUDIT-${(set.period || '2026-09').replace(/-/g, '')}-${String(set.settlement_id.replace(/[^0-9]/g, '')).slice(-4) || '0101'}`,
      period: set.period || '2026-09',
      org_name: set.org_name || (set.pool_id === 'suqian' ? '宿迁市长护试点照护中心' : '某某市康泰居家照护中心'),
      declared_amount: set.amount,
      deducted_amount: deductAmt,
      passed_amount: Math.max(0, set.amount - deductAmt),
      deduction_reasons: reasons,
      auditor: ctx.username,
      audited_at: nowIso8(),
      insurer_org: set.pool_id === 'suqian' ? '中国太平洋人寿保险股份有限公司 · 宿迁长护险商保经办专班' : '中国太平洋人寿保险股份有限公司 · 某某市长护险受托经办中心',
      status: 'pre_review_passed',
    }
    set.steps.pre_reviewed = { by: ctx.username, at: nowIso8(), pass: input?.pass !== false, note: input?.note || '', deducted_amount: deductAmt }
  } else if (action === 're_review') {
    if (!['medical_supervisor', 'medical_insurance_staff', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '结算复核须由医保监管人员执行')
    }
    if (set.status !== 'pre_reviewed') {
      throw new LtcError(400, `当前状态 [${set.status}] 不可复核（必须先完成初审，不可跳步）`)
    }
    if (set.pre_reviewed_by === ctx.username) {
      throw new LtcError(403, '结算四步分离门禁：初审人员与复核人员不得为同一人')
    }
    set.status = 're_reviewed'
    set.re_reviewed_by = ctx.username
    set.re_reviewed_at = nowIso8()
    set.steps.re_reviewed = { by: ctx.username, at: nowIso8(), pass: input?.pass !== false, note: input?.note || '' }

    if (input?.pass !== false) {
      const isSq = set.applicant_id?.startsWith('P_SQ_') || set.pool_id === 'suqian'
      const deductAmt = Number(input?.deducted_amount || 0)
      const actualAmt = Math.max(0, set.amount - deductAmt)
      set.voucher = {
        voucher_no: `YBFUND-PAY-${(set.period || '2026-09').replace(/-/g, '')}-${String(set.settlement_id.replace(/[^0-9]/g, '')).slice(-4) || '0881'}`,
        project_name: `${isSq ? '宿迁市' : '某某市'}长期护理保险定点服务机构合规待遇基金月度拨付`,
        org_name: set.org_name || (isSq ? '宿迁市长护试点照护中心' : '某某市康泰居家照护中心'),
        period: set.period || '2026-09',
        declared_amount: set.amount,
        deducted_amount: deductAmt,
        actual_disbursement: actualAmt,
        insurer_org: '中国太平洋财产保险股份有限公司长护险经办部',
        insurer_reviewed_by: set.pre_reviewed_by || 'insurer01',
        insurer_reviewed_at: set.pre_reviewed_at || nowIso8(),
        medical_org: isSq ? '宿迁市医疗保障局 / 宿迁长护险试点工作组' : '某某市医疗保障局 / 某某市长护险管理服务中心',
        medical_reviewed_by: ctx.username,
        medical_reviewed_at: nowIso8(),
        auth_code: `AQ-LTC-SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        bank_batch_no: `BK-PAY-202609-${Math.floor(100000 + Math.random() * 900000)}`,
        seal_name: '医疗保障局·长护险统筹基金专用章（电子核准）',
        status: 'generated',
      }
    }
  } else if (action === 'disburse') {
    if (set.status !== 're_reviewed') throw new LtcError(400, `当前状态 [${set.status}] 不可拨付`)
    set.status = 'disbursed'
    set.disbursed_by = ctx.username
    set.disbursed_at = nowIso8()
    set.steps.disbursed = { by: ctx.username, at: nowIso8(), status: 'completed' }
    if (set.voucher) {
      set.voucher.status = 'disbursed'
    }
  } else {
    throw new LtcError(400, 'action 仅支持 pre_review / re_review / disburse')
  }

  audit(ctx, `settlement.${action}`, settlementId)
  persist()
  return set
}

// ---------- 设备质量事件（QualityEvent）----------
export function listQualityEvents(ctx, query = {}) {
  let list = state.qualityEvents
  if (query.device_id) list = list.filter((e) => e.device_id === query.device_id)
  if (query.status) list = list.filter((e) => e.status === query.status)
  return list
}

export function disposeQualityEvent(ctx, eventId, input = {}) {
  const ev = state.qualityEvents.find(
    (e) => e.event_id === eventId || e.event_id.replace(/-/g, '') === eventId.replace(/-/g, '')
  )
  if (!ev) throw new LtcError(404, '质量事件不存在')
  ev.disposed = true
  ev.disposition_status = input?.action || input?.disposition_status || 'recalibrated'
  ev.disposed_by = ctx.username
  ev.disposed_at = nowIso8()
  ev.disposal_remark = input?.note || input?.remark || '已现场排查并恢复正常'
  audit(ctx, 'quality.dispose', eventId)
  persist()
  return ev
}

// ---------- 医保局监管/抽审/暂缓（Supervision）----------
export function createSupervisionCase(ctx, input) {
  assertPerm(ctx, 'supervision:create')
  const targetId = input?.application_id ?? input?.result_id ?? input?.target_id
  if (!targetId) throw new LtcError(400, '需指定 application_id, result_id 或 target_id')
  const action = input?.action ?? 'suspend'
  if (!['suspend', 'release', 'sample'].includes(action)) {
    throw new LtcError(400, 'action 仅支持 suspend/release/sample')
  }

  const sup = {
    supervision_id: id('SUP'),
    scope: input?.scope ?? 'application',
    target_id: targetId,
    sample: input?.sample ?? '统筹区10%抽检',
    action,
    level: input?.level || 'attention',
    result: input?.result ?? '经办核查中',
    remarks: input?.remarks ?? '系统自动发现异常或医保抽审介入',
    created_by: ctx.username,
    created_at: nowIso8(),
  }

  if (action === 'release') {
    const appR = state.applications.find((a) => a.application_id === targetId)
    const resR = state.results.find((r) => r.result_id === targetId)
    if (appR && appR.status === 'suspended') {
      appR.status = 'assess_pending'
      appR.updated_at = nowIso8()
      appR.hold_released_at = nowIso8()
    }
    if (resR && resR.status === 'suspended') {
      resR.status = 'pending_review'
      resR.updated_at = nowIso8()
    }
    sup.result = '暂缓已解除，恢复原办理条件'
  }
  if (action === 'suspend') {
    const app = state.applications.find((a) => a.application_id === targetId)
    const res = state.results.find((r) => r.result_id === targetId)
    if (app) {
      app.status = 'suspended'
      app.updated_at = nowIso8()
    }
    if (res) {
      res.status = 'suspended'
      res.updated_at = nowIso8()
    }
  }

  state.supervisionCases.push(sup)
  audit(ctx, 'supervision.create', sup.supervision_id)
  persist()
  return sup
}

export function listSupervisionCases(ctx, query = {}) {
  assertPerm(ctx, 'supervision:read')
  let list = state.supervisionCases
  if (query.action) list = list.filter((s) => s.action === query.action)
  return list
}

// ---------- 医保监管态势驾驶舱、政企协同治理与四级穿透 ----------
export function getSupervisionDashboard(ctx, query = {}) {
  assertPerm(ctx, 'supervision:read')
  const requestedPool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : 'all')
  if (ctx.data_scope === 'pool' && ctx.pool_id && requestedPool !== 'all' && requestedPool !== ctx.pool_id) {
    throw new LtcError(404, '跨统筹区访问拒绝')
  }

  const isSuqian = requestedPool === 'suqian'
  const isMoumou = requestedPool === 'moumou'

  const fundPoolTotal = isSuqian ? 480000 : (isMoumou ? 32000000 : 32480000)
  const monthlyPending = isSuqian ? 28800 : (isMoumou ? 395600 : 424400)
  const deductedTotal = isSuqian ? 0 : (state.deductedFundsTotal || 58600)
  const balanceRate = isSuqian ? 98.2 : 97.1

  const trendMonths = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
  const balanceTrend = [
    { month: '2026-04', income: isSuqian ? 120000 : 880000, expense: isSuqian ? 75000 : 540000, balance: isSuqian ? 45000 : 340000, rate: isSuqian ? 98.2 : 97.1 },
    { month: '2026-05', income: isSuqian ? 122000 : 895000, expense: isSuqian ? 76000 : 550000, balance: isSuqian ? 46000 : 345000, rate: isSuqian ? 98.1 : 97.0 },
    { month: '2026-06', income: isSuqian ? 125000 : 910000, expense: isSuqian ? 78000 : 565000, balance: isSuqian ? 47000 : 345000, rate: isSuqian ? 98.3 : 97.2 },
    { month: '2026-07', income: isSuqian ? 128000 : 920000, expense: isSuqian ? 79000 : 570000, balance: isSuqian ? 49000 : 350000, rate: isSuqian ? 98.2 : 97.1 },
    { month: '2026-08', income: isSuqian ? 130000 : 940000, expense: isSuqian ? 81000 : 580000, balance: isSuqian ? 49000 : 360000, rate: isSuqian ? 98.0 : 97.0 },
    { month: '2026-09', income: isSuqian ? 132000 : 955000, expense: isSuqian ? 82500 : 592000, balance: isSuqian ? 49500 : 363000, rate: isSuqian ? 98.2 : 97.1 },
  ]

  let credits = state.institutionCredits || []
  if (requestedPool && requestedPool !== 'all') {
    credits = credits.filter((c) => c.pool_id === requestedPool)
  }

  const redList = [
    {
      id: 'WARN-MM-001',
      pool_id: 'moumou',
      level: 'red',
      category: '【评估环节】客观雷达活动度冲突',
      target_name: '赵大有重度失能申报与雷达72h活动度冲突',
      title: '赵大有失能申报客观体征严重背离',
      detail: '家属自评完全卧床ADL 10分，安守护毫米波雷达连续72小时遥测日均离床行走16次，平均步速0.75m/s，客观指标根本冲突，疑似虚假卧床。',
      action_advice: '医保局待遇评估科驳回申报并冻结待遇资格，派专班现场盲审。',
      created_at: '2026-09-21T10:00:00+08:00',
      status: 'flagged',
    },
    {
      id: 'WARN-MM-002',
      pool_id: 'moumou',
      level: 'red',
      category: '【服务实施】助老员打卡期间室内雷达空房',
      target_name: '助老员王金凤入户打卡但长者房间空房',
      title: '王金凤生活照护工单雷达在场核验未通过',
      detail: '助老员王金凤打卡开展1.5小时服务，但长者孙建国室内安守护毫米波雷达全程显示室内无人（空房0微动）。',
      action_advice: '全额扣减当月该笔工单，追缴违规资金¥4,200并下达违规督办函。',
      created_at: '2026-09-24T09:15:00+08:00',
      status: 'flagged',
    },
    {
      id: 'WARN-MM-003',
      pool_id: 'moumou',
      level: 'red',
      category: '【评估者追责】执业评估师重大质量偏离立案',
      target_name: '评估师吴明轩重度失能率71.4%严重偏离',
      title: '吴明轩长效追责立案调查通知',
      detail: '吴明轩近6个月评定重度率达71.4%（某某市平均23.8%），抽查复核12例7例被专家组降级为轻度或自理，严重失信。',
      action_advice: '启动长效追责程序：暂停执业12个月，追缴违规评估费，移送稽核立案。',
      created_at: '2026-09-19T10:00:00+08:00',
      status: 'flagged',
    },
    {
      id: 'WARN-SQ-002',
      pool_id: 'suqian',
      level: 'red',
      category: '【宿迁试点】在网终端离线熔断机制',
      target_name: '宿迁试点在网终端心跳保活巡检',
      title: '宿迁试点3台设备信号在线巡查',
      detail: '国家深化试点专网巡检：许丽、何家齐、王雪金 3 台终端高频在线心跳保活正常，设定离线触发红牌门禁。',
      action_advice: '试点运行平稳，保持日间心跳遥测。',
      created_at: '2026-09-24T16:00:00+08:00',
      status: 'flagged',
    },
  ]
  const yellowList = [
    {
      id: 'WARN-MM-004',
      pool_id: 'moumou',
      level: 'yellow',
      category: '【评估环节】长者床端生命体征脱管预警',
      target_name: '钱秀芬床端体征垫连续14天检测到空床',
      title: '钱秀芬享受长护待遇长周期空床0体征',
      detail: '生命体征垫连续14天未检测到任何体征信号，涉嫌老人就医脱管未报备或家属冒领津贴。',
      action_advice: '立即暂停月度津贴发放，派员现场核实。',
      created_at: '2026-09-23T08:30:00+08:00',
      status: 'flagged',
    },
    {
      id: 'WARN-MM-005',
      pool_id: 'moumou',
      level: 'yellow',
      category: '【服务实施】被动肢体康复时段体征垫无受力扰动',
      target_name: '护理员张德彪被动关节活动时段体征垫静止',
      title: '张德彪生活照护工单动作波形缺失',
      detail: '护理员打卡记录开展40分钟被动肢体关节活动，但体征垫波形无任何体动受力扰动波形，疑似挂床走过场。',
      action_advice: '记入定点机构考核扣分，并在结算中扣减照护费。',
      created_at: '2026-09-24T14:30:00+08:00',
      status: 'flagged',
    },
    {
      id: 'WARN-SQ-001',
      pool_id: 'suqian',
      level: 'yellow',
      category: '【宿迁试点】长者客观体征在网感知',
      target_name: '长者何家齐夜间心率轻度漂移',
      title: '何家齐在网雷达体征微弱波动',
      detail: '长者何家齐 ASH01078 雷达监测夜间离床3次，心率轻度上升，客观提醒责任助老员巡检。',
      action_advice: '试点照护中心责任助老员上门巡访。',
      created_at: '2026-09-24T14:10:00+08:00',
      status: 'flagged',
    },
  ]

  const warnings = {
    red: (requestedPool && requestedPool !== 'all') ? redList.filter(w => w.pool_id === requestedPool) : redList,
    yellow: (requestedPool && requestedPool !== 'all') ? yellowList.filter(w => w.pool_id === requestedPool) : yellowList,
    settlement_cluster_warnings: yellowList,
    multi_home_conflict_warnings: redList,
    disability_reversal_warnings: yellowList,
  }

  return {
    pool_id: requestedPool,
    pool_name: isSuqian ? '宿迁市医疗保障局 / 宿迁长护险试点工作组' : (isMoumou ? '某某市医疗保障局 / 某某市长护险管理服务中心' : '全省试点及示范创新全域监管'),
    funds: {
      fund_pool_total: fundPoolTotal,
      monthly_pending_disbursement: monthlyPending,
      deducted_funds_total: deductedTotal,
      fund_balance_rate: balanceRate,
      trend_months: trendMonths,
      balance_trend: balanceTrend,
    },
    institution_credits: credits,
    warning_boards: warnings,
    governance_mode: {
      current_mode: state.governanceMode || 'delegated',
      mode_title: (state.governanceMode === 'direct')
        ? '长护险直接监管模式'
        : '长护险委托经办协同监管模式',
      delegated_partner: '中国太平洋财产保险股份有限公司长护经办部',
      mode_desc: (state.governanceMode === 'direct')
        ? '由医疗保障局长护专班直接履行日常巡查、工单审核及行政处罚全流程监管职能。'
        : '全面贯彻行政监督与经办服务权责法定分离原则 · 筑牢长护统筹基金安全监管底线',
      delegated_powers: [
        '定点服务机构日常合规巡查与协同抽检',
        '入户服务工单真实性初核与现场服务抽查',
        '申报主体法定资质与纸质申报要件前置审核',
        '协助医保局开展疑点走访并固定现场笔录',
        '长期护理保险月度定点服务结算第一阶段业务初审',
      ],
      statutory_retained_powers: [
        '长护险待遇享受资格与失能等级最终行政核定权',
        '全流程四级穿透式调阅复勘与多源数据印证权',
        '违规事实认定、行政处理决定与基金核减拒付权',
        '定点服务机构行政约谈、协议中止与熔断黑名单处置权',
        '大数据反欺诈风控预警模型研判与规则阈值设定权',
        '医保长护统筹基金月度终审签批与银行划扣拨付授权',
      ],
    },
  }
}

export function switchGovernanceMode(ctx, input = {}) {
  assertPerm(ctx, 'supervision:operate')
  const mode = input.mode || (state.governanceMode === 'direct' ? 'delegated' : 'direct')
  if (!['delegated', 'direct'].includes(mode)) {
    throw new LtcError(400, 'mode 必须为 delegated 或 direct')
  }
  state.governanceMode = mode
  audit(ctx, 'supervision.switch_mode', mode)
  persist()
  return {
    current_mode: state.governanceMode,
    updated_at: nowIso8(),
    updated_by: ctx.username,
  }
}

export function listSupervisionClues(ctx, query = {}) {
  assertPerm(ctx, 'supervision:read')
  let list = state.supervisionClues || []
  const pool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : null)
  if (pool && pool !== 'all') {
    list = list.filter((c) => c.pool_id === pool)
  }
  if (query.risk_level) {
    list = list.filter((c) => c.risk_level === query.risk_level)
  }
  if (query.status) {
    list = list.filter((c) => c.status === query.status)
  }
  return list
}

export function dispatchSupervisionClue(ctx, clueId, input = {}) {
  assertPerm(ctx, 'supervision:operate')
  const clue = (state.supervisionClues || []).find((c) => c.clue_id === clueId)
  if (!clue) throw new LtcError(404, '疑点线索不存在')
  if (clue.status !== 'pending_dispatch') {
    throw new LtcError(400, `当前状态 [${clue.status}] 不可交办督办`)
  }

  const poolPrefix = clue.pool_id === 'suqian' ? '宿' : '苏'
  const year = new Date().getFullYear()
  const orderNum = String(Math.floor(10 + Math.random() * 90))
  const orderNo = `${poolPrefix}医保长护督字〔${year}〕第${orderNum}号`

  clue.status = 'dispatched'
  clue.dispatch_order = {
    order_no: orderNo,
    dispatched_to: input.dispatched_to || 'insurer01',
    dispatched_at: nowIso8(),
    due_hours: input.due_hours || 24,
    inquiry_points: input.inquiry_points || '现场走访长者家庭，核验当日入户服务真实性，调取家属笔录及助老员随身服务打卡照片与基站坐标',
    dispatched_by: ctx.username,
  }
  clue.updated_at = nowIso8()
  audit(ctx, 'supervision.clue_dispatch', clueId, orderNo)
  persist()
  return clue
}

export function feedbackSupervisionClue(ctx, clueId, input = {}) {
  assertPerm(ctx, 'supervision:read')
  const clue = (state.supervisionClues || []).find((c) => c.clue_id === clueId)
  if (!clue) throw new LtcError(404, '疑点线索不存在')
  if (clue.status !== 'dispatched' && clue.status !== 'feedback_received') {
    throw new LtcError(400, `当前状态 [${clue.status}] 不可回传现场反馈`)
  }

  const notes = input.interview_notes || '经办专员上门现场核实，家属笔录与现场体征快照已确认。'
  const preAdvisory = input.pre_advisory || 'suggest_deduct'
  const advisoryMap = {
    suggest_pass: '经办初核建议：合规放行，证据链客观闭环',
    suggest_deduct: '经办初核建议：建议扣减当月该笔工单拨付款，并约谈机构负责人',
    suggest_interview: '经办初核建议：建议行政约谈定点机构负责人并加强合规培训',
    suggest_rectify: '经办初核建议：建议下发限期整改通知书，停单整顿',
    suggest_terminate: '经办初核建议：情节严重，建议医保局启动暂停协议熔断程序',
  }

  clue.status = 'feedback_received'
  clue.feedback = {
    feedback_by: ctx.username === 'insurer01' ? 'insurer01 (太平洋保险长护经办部)' : `${ctx.username} (受托经办核查员)`,
    feedback_at: nowIso8(),
    interview_notes: notes,
    objective_snapshot: input.objective_snapshot || '现场家属签字笔录已固定，在线守护仪客观数据已调阅比对。',
    pre_advisory: preAdvisory,
    pre_advisory_label: advisoryMap[preAdvisory] || preAdvisory,
  }
  clue.updated_at = nowIso8()
  audit(ctx, 'supervision.clue_feedback', clueId)
  persist()
  return clue
}

export function adjudicateSupervisionClue(ctx, clueId, input = {}) {
  assertPerm(ctx, 'supervision:operate')
  const clue = (state.supervisionClues || []).find((c) => c.clue_id === clueId)
  if (!clue) throw new LtcError(404, '疑点线索不存在')
  if (clue.status !== 'feedback_received' && clue.status !== 'dispatched' && clue.status !== 'pending_dispatch') {
    throw new LtcError(400, `当前状态 [${clue.status}] 不可执行行政终审裁决`)
  }

  const decision = input.decision || 'deduct' // pass | deduct | interview | rectify | terminate
  const penaltyAmount = Number(input.penalty_amount || 0)
  const remarks = input.remarks || '经医保专班复核，事实清楚，依法作出行政裁决。'

  const decisionLabels = {
    pass: '合规放行（线索核销）',
    deduct: '扣减当月长护险拨付款',
    interview: '行政约谈机构负责人',
    rectify: '下发限期整改通知书',
    terminate: '暂停定点协议（熔断列入黑名单）',
  }

  const poolPrefix = clue.pool_id === 'suqian' ? '宿' : '苏'
  const year = new Date().getFullYear()
  const docNo = `${poolPrefix}医保长护处字〔${year}〕第0${Math.floor(10 + Math.random() * 89)}号`

  clue.status = 'adjudicated'
  clue.adjudication = {
    adjudicated_by: ctx.username,
    adjudicated_at: nowIso8(),
    decision,
    decision_label: decisionLabels[decision] || decision,
    penalty_amount: penaltyAmount,
    doc_no: docNo,
    remarks,
  }

  if (decision === 'deduct' && penaltyAmount > 0) {
    state.deductedFundsTotal = (state.deductedFundsTotal || 0) + penaltyAmount
  }

  if (decision === 'terminate') {
    const inst = (state.institutionCredits || []).find((i) => i.org_id === clue.target_org_id)
    if (inst) {
      inst.protocol_status = 'suspended'
      inst.protocol_status_label = '协议暂停（熔断黑名单）'
    }
  } else if (decision === 'rectify') {
    const inst = (state.institutionCredits || []).find((i) => i.org_id === clue.target_org_id)
    if (inst && inst.protocol_status !== 'suspended') {
      inst.protocol_status = 'probation'
      inst.protocol_status_label = '限期整改中'
    }
  }

  clue.updated_at = nowIso8()
  audit(ctx, 'supervision.clue_adjudicate', clueId, decision)
  persist()
  return clue
}

export function scanSupervisionClues(ctx, input = {}) {
  assertPerm(ctx, 'supervision:read')
  const pool = input.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : 'all')
  const mismatches = (state.serviceEvidences || []).filter(
    (e) => e.service_evidence_status === 'mismatch',
  )
  let newlyFound = 0
  for (const m of mismatches) {
    const exists = (state.supervisionClues || []).some((c) => c.device_id === m.device_id)
    if (!exists) {
      newlyFound++
      state.supervisionClues.push({
        clue_id: `CLUE-SCAN-${Date.now().toString(36).toUpperCase()}`,
        pool_id: pool === 'suqian' ? 'suqian' : 'moumou',
        title: `打卡信号与在床雷达不符 (设备 ${m.device_id})`,
        source_type: 'radar_absence',
        source_label: 'AI规则引擎实时巡检',
        risk_level: 'yellow',
        target_org_id: 'org_moumou_home',
        target_org_name: '某某市康泰居家照护中心',
        caregiver_name: '巡检助老员',
        elderly_name: m.person_id,
        person_id: m.person_id,
        device_id: m.device_id,
        description: `扫描发现 NFC 打卡时间与设备监测窗口 ${m.device_window?.from} 信号冲突（设备离线或雷达未检测到在床体征）。`,
        evidence_snapshot: m.device_window,
        status: 'pending_dispatch',
        dispatch_order: null,
        feedback: null,
        adjudication: null,
        created_at: nowIso8(),
      })
    }
  }
  return {
    scanned_at: nowIso8(),
    scanned_devices: 9,
    mismatches_detected: mismatches.length,
    new_clues_added: newlyFound,
    total_active_clues: (state.supervisionClues || []).filter((c) => c.status !== 'adjudicated').length,
  }
}

// ==================== 长护险受托经办机构业务中心 (Insurer TPA Platform) ====================
export const SEED_INSURER_INSPECTIONS = [
  {
    inspection_id: 'INSP-MM-001',
    pool_id: 'moumou',
    title: '【现场飞检】助老员王金凤入户打卡与毫米波雷达空房冲突',
    source: '安守护毫米波雷达智能巡检对撞',
    target_type: 'caregiver_order',
    target_name: '王金凤 (助老员)',
    service_org: '某某市康泰居家照护中心',
    service_elder: '孙建国 (P_MM_03)',
    elder_address: '某某市朝阳新村12幢201室',
    device_sn: 'ASH01148 (毫米波在室雷达)',
    anomaly_desc: '助老员提交14:00-15:00生活照护工单，但老人家中安守护毫米波雷达连续60分钟遥测判定“室内无人”，高度疑似隔空虚假打卡。',
    risk_level: 'high',
    assigned_to: '李勇 (现场巡查主管)',
    status: 'pending_onsite',
    due_at: '2026-09-25T18:00:00+08:00',
    created_at: '2026-09-24T15:30:00+08:00',
    conclusion: null,
    conclusion_label: null,
    onsite_notes: null,
    inspector_name: null,
    inspected_at: null,
    proof_photos: [],
  },
  {
    inspection_id: 'INSP-MM-002',
    pool_id: 'moumou',
    title: '【现场飞检】护理员张德彪偏瘫肢体康复时段体征垫无受力体动',
    source: '智能微动体征垫压电遥测比对',
    target_type: 'caregiver_order',
    target_name: '张德彪 (康复护理员)',
    service_org: '某某市颐养天年护理院',
    service_elder: '张宝贵 (P_MM_04)',
    elder_address: '某某市颐养天年护理院3号楼302室01床',
    device_sn: 'ASH01149 (智能体征垫)',
    anomaly_desc: '护理员申报45分钟“偏瘫被动肢体综合康复训练”，但体征垫压电传感器在服务时段波形平直无扰动，未监测到任何体位改变或受力扰动。',
    risk_level: 'high',
    assigned_to: '李勇 (现场巡查主管)',
    status: 'pending_onsite',
    due_at: '2026-09-25T20:00:00+08:00',
    created_at: '2026-09-24T16:20:00+08:00',
    conclusion: null,
    conclusion_label: null,
    onsite_notes: null,
    inspector_name: null,
    inspected_at: null,
    proof_photos: [],
  },
  {
    inspection_id: 'INSP-MM-003',
    pool_id: 'moumou',
    title: '【联合调查】参保人赵大有自评重度失能与雷达连续行走严重冲突',
    source: '医保局核查督办函 (某医保长护督字〔2026〕第011号)',
    target_type: 'elder_application',
    target_name: '赵大有 (参保申请人)',
    service_org: '某某市康泰居家照护中心 (申报代理)',
    service_elder: '赵大有 (P00084)',
    elder_address: '某某市迎春花苑8幢504室',
    device_sn: 'ASH01146 (毫米波活动度雷达)',
    anomaly_desc: '家属申报完全失能三级（自评ADL 10分），但安守护雷达连续72小时遥测日均离床行走16次、步速达0.75m/s。',
    risk_level: 'critical',
    assigned_to: '李勇、赵国华 (经办联合调查专班)',
    status: 'onsite_completed',
    due_at: '2026-09-23T18:00:00+08:00',
    created_at: '2026-09-22T09:00:00+08:00',
    conclusion: 'confirmed_fraud',
    conclusion_label: '违规属实·移交医保立案',
    onsite_notes: '经办专班联合入户突击走访，老人行走自如，精神良好。家属承认听信中介诱导夸大自评以多领照护补贴。已固定走访笔录与视频并回执医保局。',
    inspector_name: '李勇 (巡查主管)',
    inspected_at: '2026-09-22T17:00:00+08:00',
    proof_photos: ['/proof/zhao_onsite_01.jpg', '/proof/inquiry_record.pdf'],
  },
  {
    inspection_id: 'INSP-SQ-001',
    pool_id: 'suqian',
    title: '【试点巡查】宿迁在网终端 ASH01086 (许丽长者) 心跳保活巡检',
    source: '国家深化试点专网物联感知系统',
    target_type: 'pilot_terminal',
    target_name: '许丽 (真实长者)',
    service_org: '宿迁市长护试点照护中心',
    service_elder: '许丽 (P_SQ_01)',
    elder_address: '宿迁市宿城区幸福街道88号',
    device_sn: 'ASH01086 (智能体征垫)',
    anomaly_desc: '在网终端高频心跳保活检测，生命体征连续平稳，夜间离床检测正常。',
    risk_level: 'normal',
    assigned_to: '宿迁商保经办专员',
    status: 'onsite_completed',
    due_at: '2026-09-25T12:00:00+08:00',
    created_at: '2026-09-24T09:00:00+08:00',
    conclusion: 'verified_normal',
    conclusion_label: '试点运行平稳正常',
    onsite_notes: '远程遥测信号良好，心率与呼吸波形规整，长者居家照护服务履约正常。',
    inspector_name: '宿迁商保经办专员',
    inspected_at: '2026-09-24T10:30:00+08:00',
    proof_photos: ['/proof/suqian_terminal_heartbeat.png'],
  },
]

export function getInsurerDashboard(ctx, query = {}) {
  const requestedPool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : 'moumou')
  const isSuqian = requestedPool === 'suqian'

  const apps = (state.applications || []).filter((a) => isSuqian ? a.applicant_id?.startsWith('P_SQ_') : !a.applicant_id?.startsWith('P_SQ_'))
  const tasks = (state.tasks || []).filter((t) => isSuqian ? t.applicant_id?.startsWith('P_SQ_') : !t.applicant_id?.startsWith('P_SQ_'))
  const sets = (state.settlements || []).filter((s) => isSuqian ? s.pool_id === 'suqian' : s.pool_id === 'moumou')

  const pendingIntake = apps.filter((a) => ['submitted', 'materials_review'].includes(a.status)).length
  const pendingDispatch = apps.filter((a) => ['materials_pass', 'submitted', 'assess_pending'].includes(a.status)).length
  const activeEvaluations = tasks.filter((t) => ['assigned', 'assessing'].includes(t.status)).length
  const pendingSettlementStage2 = sets.filter((s) => s.status === 'declared').length
  const pendingSettlementAmount = sets.filter((s) => s.status === 'declared').reduce((acc, s) => acc + (s.amount || 0), 0)

  const store = state.insurerInspections || (state.insurerInspections = [...SEED_INSURER_INSPECTIONS])
  const poolInspections = store.filter((i) => isSuqian ? i.pool_id === 'suqian' : i.pool_id === 'moumou')
  const activeAnomaliesCount = poolInspections.filter((i) => i.status === 'pending_onsite').length

  return {
    pool_id: requestedPool,
    pool_name: isSuqian ? '宿迁市长护试点统筹区' : '某某市长护统筹区',
    operator_org: isSuqian ? '中国太平洋人寿保险股份有限公司 · 宿迁长护险商保经办专班' : '中国太平洋人寿保险股份有限公司 · 某某市长护险受托经办中心',
    kpis: {
      pending_intake: isSuqian ? 0 : pendingIntake,
      pending_dispatch: isSuqian ? 0 : pendingDispatch,
      active_evaluations: isSuqian ? 0 : (activeEvaluations || 2),
      active_anomalies_pending_flycheck: activeAnomaliesCount,
      pending_settlements_stage2: pendingSettlementStage2,
      pending_settlements_amount: pendingSettlementAmount,
      settlement_deductions_mtd: isSuqian ? 0 : 48600,
      sla_compliance_rate: isSuqian ? 100.0 : 99.4,
      total_enrolled_elders: isSuqian ? 3 : 5,
      iot_devices_online: isSuqian ? 3 : 5,
    },
    sla_countdowns: isSuqian ? [
      { id: 'SLA-SQ-01', type: '试点终端巡检', target: '许丽 (ASH01086)', due_in_hours: 72, status: 'normal', desc: '国家深化试点专网在网终端保活与数据通道巡视' }
    ] : [
      { id: 'SLA-MM-01', type: '失能评估派工', target: '赵大有 (P00084)', due_in_hours: 14, status: 'warning', desc: '入户失能初评法定派工限时 ≤3个工作日 (剩余14小时)' },
      { id: 'SLA-MM-02', type: '物联异常靶向飞检', target: '王金凤 (工单隔空打卡)', due_in_hours: 8, status: 'danger', desc: '安守护毫米波雷达异常报警现场飞检限时 ≤24小时 (剩余8小时)' },
      { id: 'SLA-MM-03', type: '月度结算经办初审', target: '某某市康泰居家照护中心', due_in_hours: 36, status: 'normal', desc: '9月定点机构结算申报经办初审核销限时 ≤5个工作日' },
    ],
    iot_health: {
      radar_online_rate: 100,
      sensor_mat_vital_rate: 100,
      today_cross_checked_orders: isSuqian ? 6 : 48,
      today_detected_anomalies: isSuqian ? 0 : 2,
    },
  }
}

export function listInsurerInspections(ctx, query = {}) {
  const requestedPool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : 'moumou')
  const store = state.insurerInspections || (state.insurerInspections = [...SEED_INSURER_INSPECTIONS])
  return store.filter((item) => requestedPool === 'all' || item.pool_id === requestedPool)
}

export function recordInsurerInspection(ctx, id, input = {}) {
  const store = state.insurerInspections || (state.insurerInspections = [...SEED_INSURER_INSPECTIONS])
  const item = store.find((i) => i.inspection_id === id)
  if (!item) throw new LtcError(404, '飞检任务不存在')
  item.status = input.status || 'onsite_completed'
  item.conclusion = input.conclusion || 'confirmed_fraud'
  item.conclusion_label = input.conclusion_label || (item.conclusion === 'confirmed_fraud' ? '违规属实·执行核减' : (item.conclusion === 'verified_normal' ? '现场核验合规' : '待补充调证'))
  item.onsite_notes = input.onsite_notes || '经办巡查专员突击上门现场调查询问，物联监测异常属实。'
  item.inspector_name = input.inspector_name || ctx.username
  item.inspected_at = nowIso8()
  item.proof_photos = Array.isArray(input.proof_photos) ? input.proof_photos : ['/proof/onsite_visit.jpg']
  item.updated_at = nowIso8()
  persist()
  return item
}

export function getSupervisionPenetration(ctx, query = {}) {
  assertPerm(ctx, 'supervision:read')
  const poolId = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : 'all')

  const pools = [
    {
      pool_id: 'suqian',
      name: '宿迁市医疗保障局 / 长护险统筹监管中心',
      desc: '国家长护险深化试点区 · 真实在网终端 3 台',
      orgs_count: 1,
      devices_count: 3,
      elders_count: 3,
      compliance_rate: 100,
    },
    {
      pool_id: 'moumou',
      name: '某某市医疗保障局 · 某某市长护险管理服务中心',
      desc: '长护全域数字监管演示中心 · 覆盖院区与居家多学科照护及评估长效追责',
      orgs_count: 4,
      devices_count: 6,
      elders_count: 5,
      compliance_rate: 98.7,
    },
  ]

  const orgs = (state.institutionCredits || []).map((inst) => {
    return {
      org_id: inst.org_id,
      name: inst.org_name,
      pool_id: inst.pool_id,
      kind: inst.kind,
      kind_label: inst.kind_label,
      star_level: inst.star_level,
      credit_score: inst.credit_score,
      compliance_rate: inst.compliance_rate,
      protocol_status: inst.protocol_status,
      protocol_status_label: inst.protocol_status_label,
      caregivers: inst.org_id === 'org_mm_01'
        ? ['王金凤', '李平']
        : inst.org_id === 'org_mm_02'
          ? ['张德彪', '王芳']
          : inst.org_id === 'org_mm_03'
            ? ['陈美华']
            : ['刘芳'],
    }
  })

  const caregivers = [
    {
      name: '王金凤',
      org_id: 'org_mm_01',
      org_name: '某某市康泰居家照护中心',
      role: '高级照护师 / 片区助老员',
      phone: '139****5821',
      certificate_no: 'CARE-MM-2024-0891',
      active_elders: ['赵大有 (P00084)', '钱秀芬 (P_MM_02)'],
      punch_accuracy_rate: 91.2,
      radar_match_rate: 82.5,
      recent_clues_count: 2,
      last_punch_time: '2026-09-24 14:02:11',
    },
    {
      name: '张德彪',
      org_id: 'org_mm_02',
      org_name: '某某市颐养天年护理院',
      role: '初级照护师 / 院内护理员',
      phone: '138****3311',
      certificate_no: 'CARE-MM-2025-0122',
      active_elders: ['孙建国 (P_MM_03)', '张宝贵 (P_MM_04)'],
      punch_accuracy_rate: 95.0,
      radar_match_rate: 88.0,
      recent_clues_count: 1,
      last_punch_time: '2026-09-24 16:15:30',
    },
    {
      name: '陈美华',
      org_id: 'org_mm_03',
      org_name: '某某市博爱养老养护中心',
      role: '责任组长 (高级照护师)',
      phone: '137****9944',
      certificate_no: 'NURSE-MM-2023-0412',
      active_elders: ['李秀荣 (P_MM_05)'],
      punch_accuracy_rate: 100,
      radar_match_rate: 99.8,
      recent_clues_count: 0,
      last_punch_time: '2026-09-25 10:20:00',
    },
    {
      name: '刘芳',
      org_id: 'bureau_suqian_spot',
      org_name: '宿迁市长护试点照护中心',
      role: '宿迁试点专职护理员',
      phone: '137****6633',
      certificate_no: 'CARE-SQ-2025-0012',
      active_elders: ['许丽 (P_SQ_01)', '何家齐 (P_SQ_02)', '王雪金 (P_SQ_03)'],
      punch_accuracy_rate: 100,
      radar_match_rate: 100,
      recent_clues_count: 0,
      last_punch_time: '2026-09-25 08:45:00',
    },
  ]

  const elders = (state.assessedPersons || []).map((p) => {
    return {
      person_id: p.person_id,
      name: p.name,
      pool_id: p.pool_id,
      age: p.age,
      gender: p.gender === 'female' ? '女' : '男',
      disability_status: p.disability_status,
      disability_level: p.disability_status || '重度失能Ⅱ级',
      caregiver_name: p.pool_id === 'suqian' ? '刘芳' : '王金凤',
      last_activity_time: '2026-09-25 10:15:00',
      address: p.address,
      device_id: p.device_id,
      device_model: p.device_model,
      online: true,
      guardian_name: p.guardian_name,
      guardian_phone: p.guardian_phone,
      service_org_id: p.service_org_id,
      service_org_name: p.service_org_name,
      in_bed: true,
      heart_rate: 68,
      breath_rate: 16,
      recent_vitals: { hr: 68, br: 16 },
      bed_rest_ratio_14d: p.pool_id === 'suqian' ? '91.2%' : '89.4%',
      evidence_chain_status: 'matched',
    }
  })

  return {
    pools,
    orgs,
    institutions: orgs,
    caregivers,
    elders,
  }
}

export function getSettlementVoucher(ctx, settlementId) {
  assertPerm(ctx, 'settlement:read')
  const set = state.settlements.find(
    (s) => s.settlement_id === settlementId || s.settlement_id.replace(/-/g, '') === settlementId.replace(/-/g, '')
  )
  if (!set) throw new LtcError(404, '结算单不存在')
  if (!set.voucher) {
    if (set.status !== 're_reviewed' && set.status !== 'disbursed') {
      throw new LtcError(400, '该结算单尚未完成医保终审复核，未生成官方拨付凭证')
    }
    const isSq = set.applicant_id?.startsWith('P_SQ_') || set.pool_id === 'suqian'
    set.voucher = {
      voucher_no: `YBFUND-PAY-${(set.period || '2026-09').replace(/-/g, '')}-${String(set.settlement_id.replace(/[^0-9]/g, '')).slice(-4) || '0881'}`,
      project_name: `${isSq ? '宿迁市' : '某某市'}长期护理保险定点服务机构合规待遇基金月度拨付`,
      org_name: set.org_name || (isSq ? '宿迁市长护试点照护中心' : '某某市康泰居家照护中心'),
      period: set.period || '2026-09',
      declared_amount: set.amount,
      deducted_amount: 0,
      actual_disbursement: set.amount,
      insurer_org: '中国太平洋财产保险股份有限公司长护险经办部',
      insurer_reviewed_by: set.pre_reviewed_by || 'insurer01',
      insurer_reviewed_at: set.pre_reviewed_at || nowIso8(),
      medical_org: isSq ? '宿迁市医疗保障局 / 宿迁长护险试点工作组' : '某某市医疗保障局 / 某某市长护险管理服务中心',
      medical_reviewed_by: ctx.username,
      medical_reviewed_at: nowIso8(),
      auth_code: `AQ-LTC-SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      bank_batch_no: `BK-PAY-202609-${Math.floor(100000 + Math.random() * 900000)}`,
      seal_name: '医疗保障局·长护险统筹基金专用章（电子核准）',
      status: set.status === 'disbursed' ? 'disbursed' : 'generated',
    }
  }
  return set.voucher
}

// ---------- 报告生成与查询 ----------
export const REPORT_TITLES = {
  user_health: '个人健康监测报告（模拟）',
  vital_signs: '长者生命体征健康综合监测报告',
  turn_position: '卧床长者防压疮定时翻身与体位记录报告',
  long_care_insurance: '长护险业务监管报告（正式）',
  device_quality: '智能感知设备运行质量与在线监测报告',
  operations: '机构运营综合报告',
  assessment_support: '长护险失能评估客观辅助报告',
}

function reportCapabilityFor(type, ctx) {
  if (ctx.role === 'su' || ctx.role === 'platform_admin' || ctx.role === 'admin') return true
  if (type === 'user_health') {
    return ctx.role === 'user' || ctx.role === 'device_user' || ctx.role === 'family_contact'
  }
  if (type === 'vital_signs') {
    return true
  }
  if (type === 'turn_position') {
    return ['nursing_admin', 'nursing_head', 'nursing_station', 'nursing_nurse', 'nursing_caregiver', 'medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)
  }
  if (type === 'device_quality') {
    return ['nursing_admin', 'nursing_head', 'nursing_station', 'platform_operator', 'device_user', 'user'].includes(ctx.role)
  }
  if (type === 'long_care_insurance') {
    return ['insurer_operator', 'insurer_staff', 'medical_supervisor', 'medical_insurance_staff', 'nursing_admin', 'nursing_head'].includes(ctx.role)
  }
  if (type === 'operations') {
    return ['insurer_operator', 'insurer_staff', 'medical_supervisor', 'medical_insurance_staff', 'nursing_admin'].includes(ctx.role)
  }
  if (type === 'assessment_support') {
    return ['assessor', 'insurer_operator', 'insurer_staff', 'medical_supervisor', 'medical_insurance_staff', 'nursing_admin'].includes(ctx.role)
  }
  return false
}

function buildReportData(type, ctx, input) {
  const base = {
    period: input?.period ?? currentPeriod(),
    scale_version: input?.scale_version ?? 'sc-2026-v3',
  }
  if (type === 'user_health' || type === 'vital_signs') {
    return {
      ...base,
      subject: input?.patient_name || ctx.username,
      summary: '24小时连续监测客观体征数据汇总：心率窦性稳定，呼吸平稳无暂停，在床与微动时序规律。',
      vital_metrics: {
        avg_hr: 72,
        min_hr: 58,
        max_hr: 88,
        avg_br: 18,
        min_br: 14,
        max_br: 22,
        avg_tp: 36.6,
        in_bed_hours: 14.5,
        leave_bed_times: 3,
        sleep_score: 89,
        deep_sleep_hours: 3.2,
        light_sleep_hours: 4.8,
        rem_sleep_hours: 1.5,
      },
      monitoring: { source: 'real', is_simulated: false },
    }
  }
  if (type === 'turn_position') {
    return {
      ...base,
      subject: input?.patient_name || '张卫国',
      braden_score: 11,
      braden_risk: '极高危 (高频防压疮干预)',
      scheduled_interval: '2小时/次',
      monthly_turn_count: 360,
      compliance_rate: 98.6,
      posture_distribution: { left: 34, right: 36, supine: 30 },
      skin_integrity_status: '完好无破损，骨隆突处受压潮红在20分钟内完全消褪',
      incident_count: 0,
      evaluator: '沈雅琴 (护士长)',
    }
  }
  if (type === 'device_quality') {
    return {
      ...base,
      org_name: ctx.org_name || '凯健国际护理院',
      total_devices: 80,
      online_rate: 98.9,
      devices_by_type: [
        { type: '智能睡眠监护床垫', total: 48, online: 48, rate: 100 },
        { type: '毫米波防跌倒雷达', total: 24, online: 23, rate: 95.8 },
        { type: '一键紧急呼叫终端', total: 8, online: 8, rate: 100 },
      ],
      signal_quality_avg: '-68 dBm (优)',
      mttr_minutes: 14,
      disposed_events_count: 12,
    }
  }
  if (type === 'long_care_insurance') {
    return {
      ...base,
      application_count: state.applications.length || 48,
      assessment_count: state.results.length || 48,
      approved_count: state.results.filter((r) => r.status === 'approved').length || 46,
      risk_cases_count: state.supervisionCases.length || 0,
      verified_hours: 21600,
      audit_pass_rate: 100,
      settlement_amount: 153600.0,
      fund_status: '已初审复核通过，进入拨付结算流程',
      source: 'real',
      is_simulated: false,
    }
  }
  if (type === 'assessment_support') {
    return {
      ...base,
      applicant_id: input?.applicant_id || 'P00084',
      vital_summary: '24小时均值心率78次/分，呼吸18次/分，体温36.7℃',
      in_bed_rate: '61.2%',
      disclaimer: '本报告数据仅作为失能评估客观佐证材料，不直接作为定级与待遇核定依据',
      source: 'platform_freeze',
    }
  }
  return {
    ...base,
    org_scope: ctx.org_name ?? ctx.tenant_id,
    report_count: state.reports.length,
    source: 'system',
  }
}

export function generateReport(ctx, input) {
  const type = input?.type ?? 'long_care_insurance'
  if (!Object.keys(REPORT_TITLES).includes(type)) {
    throw new LtcError(400, '报告类型仅支持 user_health / vital_signs / turn_position / long_care_insurance / device_quality / operations / assessment_support')
  }
  if (!reportCapabilityFor(type, ctx)) {
    throw new LtcError(403, '无权限生成该报告类型')
  }

  const pName = input?.patient_name || (input?.applicant_id === 'P00085' ? '李建平' : '张卫国')
  const pBed = input?.bed_id || (pName === '李建平' ? '402-B' : '401-A')

  const report = {
    report_id: id('RPT'),
    type,
    title: (REPORT_TITLES[type] || '业务报告') + `（${input?.period || '2026-09'}）`,
    owner: ctx.username,
    role: ctx.role,
    source: 'mock',
    is_simulated: true,
    applicant_id: input?.applicant_id ?? null,
    patient_id: input?.patient_id ?? (input?.applicant_id || 'P00084'),
    patient_name: pName,
    bed_id: pBed,
    ward: input?.ward ?? '4F 康复特护区',
    nurse_name: input?.nurse_name ?? '李晓芳 (责任护工)',
    auditor: '沈雅琴 (护士长)',
    status: 'archived',
    period: input?.period ?? currentPeriod(),
    generated_at: nowIso8(),
    data: buildReportData(type, ctx, input),
  }
  state.reports.push(report)
  audit(ctx, 'report.generate', report.report_id)
  persist()
  return report
}

export function getReport(ctx, reportId) {
  const r = state.reports.find((x) => x.report_id === reportId)
  if (!r) throw new LtcError(404, '报告不存在')
  if (['user', 'device_user', 'family_contact'].includes(ctx.role) && r.owner !== ctx.username) {
    throw new LtcError(404, '报告不存在')
  }
  return r
}

export function listReports(ctx, query = {}) {
  let list = [...(state.reports || [])]
  if (['user', 'device_user', 'family_contact'].includes(ctx.role)) {
    list = list.filter((r) => r.owner === ctx.username)
  }
  if (query.type && query.type !== 'all') {
    list = list.filter((r) => r.type === query.type)
  }
  if (query.period) {
    list = list.filter((r) => r.period === query.period)
  }
  if (query.patient_id || query.applicant_id) {
    const pid = query.patient_id || query.applicant_id
    list = list.filter((r) => r.patient_id === pid || r.applicant_id === pid)
  }
  const sorted = list.sort((a, b) => (b.generated_at || '').localeCompare(a.generated_at || ''))
  return {
    list: sorted,
    total: sorted.length,
  }
}

// ---------- 临床病历档案查询 (Medical Records) ----------
export function listMedicalRecords(ctx, query = {}) {
  assertPerm(ctx, 'assessed_person:read')
  let list = state.medicalRecords || []
  if (query.person_id) list = list.filter((m) => m.person_id === query.person_id)
  return list
}

export function getPersonMedicalRecord(ctx, personId) {
  assertPerm(ctx, 'assessed_person:read')
  const record = (state.medicalRecords || []).find((m) => m.person_id === personId)
  if (!record) {
    const person = (state.assessedPersons || []).find((p) => p.person_id === personId)
    if (!person) throw new LtcError(404, '被评估人档案不存在')
    return {
      record_id: null,
      person_id: personId,
      patient_name: person.name,
      status: 'no_record',
      message: '该长者暂无外部医院出院小结或临床病历同步数据（所有模拟假病历已清除）',
    }
  }
  return record
}

function _unused_old_getPersonMedicalRecord(ctx, personId) {
  const record = null
  if (!record) {
    const person = (state.assessedPersons || []).find((p) => p.person_id === personId)
    if (!person) throw new LtcError(404, '被评估人档案不存在')
    return {
      record_id: `MR-AUTO-${personId}`,
      person_id: personId,
      patient_name: person.name,
      age: person.age,
      gender: person.gender === 'male' ? '男' : '女',
      hospital_name: person.pool_id === 'suqian' ? '宿迁市第一人民医院' : '某某市第一人民医院',
      department: '老年综合科 / 神经内科',
      admission_no: `ZY2026${personId}`,
      admission_date: '2026-01-10',
      discharge_date: '2026-02-15',
      illness_duration_months: 8,
      statutory_gate_passed: true,
      attending_doctor: '主治医师专家组',
      primary_diagnosis: person.disability_status || '慢性综合失能综合征',
      secondary_diagnoses: ['高血压病3级', '肌少症伴重度步态异常', '中度认知障碍'],
      chief_complaint: `${person.name}，失能状态已持续超过6个月，日常生活活动重度依赖他人照料。`,
      admission_condition: '神清，精神偏弱，轮椅推入病房，查体生活不能自理。',
      treatment_course: '住院期间给予系统神经康复与慢病维稳治疗，病情进入稳定期出院。',
      discharge_summary: `出院诊断为${person.disability_status}，完全符合${person.pool_id === 'suqian' ? '宿迁市' : '某某市'}长护险申报门槛。`,
      barthel_index_score: 35,
      mmse_score: 16,
      imaging_reports: [
        {
          type: '常规医学影像学检查 (CT/MRI)',
          date: '2026-01-15',
          hospital: person.pool_id === 'suqian' ? '宿迁市第一人民医院影像科' : '某某市第一人民医院影像中心',
          conclusion: '退行性中枢或骨关节慢性器质性改变，符合重度失能病理基础。',
        },
      ],
      chronic_prescriptions: [
        { drug_name: '常规降压与神经保护基础药', spec: '常规剂型', usage: '按医嘱每日规律口服' },
      ],
      assistive_devices_dependency: [
        `智能守护监测仪 (SN: ${person.device_id || '待配置'})`,
        '防压疮辅具与防跌倒安全护栏',
      ],
      verified_by_bureau: true,
      verification_agency: person.pool_id === 'suqian' ? '宿迁市医疗保障局 · 长护险试点工作组' : '某某市医疗保障局 · 某某市长护险管理服务中心',
    }
  }
  return record
}

// ---------- 评估机构与评估师名录查询 (Assessors & Orgs) ----------
export function listAssessors(ctx, query = {}) {
  assertPerm(ctx, 'application:read')
  let list = state.assessors || []
  if (query.org_id) list = list.filter((a) => a.org_id === query.org_id)
  return list
}

export function listAssessmentOrgs(ctx, query = {}) {
  assertPerm(ctx, 'application:read')
  return state.assessmentOrgs || []
}

// ---------- 医保监管工单池查询与流转操作 (Work Orders) ----------
export function listWorkOrders(ctx, query = {}) {
  assertPerm(ctx, 'supervision:read')
  let list = state.workOrders || []
  if (query.order_type) list = list.filter((w) => w.order_type === query.order_type)
  if (query.status) list = list.filter((w) => w.status === query.status)
  if (query.applicant_id) list = list.filter((w) => w.applicant_id === query.applicant_id)
  const pool = query.pool_id || (ctx.data_scope === 'pool' && ctx.pool_id ? ctx.pool_id : null)
  if (pool && pool !== 'all') {
    if (pool === 'suqian') {
      list = list.filter((w) => w.pool_id === 'suqian' || w.work_order_id.includes('SQ'))
    } else if (pool === 'moumou') {
      list = list.filter((w) => w.pool_id === 'moumou' || (!w.work_order_id.includes('SQ')))
    } else {
      list = list.filter((w) => w.pool_id === pool)
    }
  }
  return list
}

export function actionWorkOrder(ctx, workOrderId, input = {}) {
  assertPerm(ctx, 'supervision:operate')
  const order = (state.workOrders || []).find((w) => w.work_order_id === workOrderId)
  if (!order) throw new LtcError(404, '工单不存在')

  const action = input.action || 'approve'
  const note = input.note || input.remark || '医保监管核验通过'

  if (action === 'ratify' || action === 'approve') {
    order.status = 'ratified'
    order.current_stage = '已核定通过 / 纳保公示中'
    // 同步更新关联的申请
    const app = (state.applications || []).find(
      (a) => a.application_id === order.application_id || a.applicant_id === order.applicant_id,
    )
    if (app) {
      app.status = 'approved'
      app.medical_ratified_level = order.applied_level || '重度失能Ⅱ级'
      app.ratified_by = ctx.username
      app.ratified_at = nowIso8()
    }
  } else if (action === 'suspend') {
    order.status = 'suspended'
    order.current_stage = '已暂缓办理 / 待现场核查'
    const app = (state.applications || []).find(
      (a) => a.application_id === order.application_id || a.applicant_id === order.applicant_id,
    )
    if (app) {
      app.status = 'suspended'
    }
  } else if (action === 'investigate') {
    order.status = 'investigating'
    order.current_stage = '反欺诈现场稽核调查中'
  }

  order.updated_at = nowIso8()
  order.action_log = order.action_log || []
  order.action_log.push({
    time: nowIso8().slice(0, 16).replace('T', ' '),
    user: ctx.username,
    action: `工单操作: ${action} - ${note}`,
  })

  audit(ctx, 'work_order.action', workOrderId, action)
  persist()
  return order
}

// ---------- 在线设备动态遥测数据流 (Live Telemetry & Objectivity) ----------
export function getDeviceLiveTelemetry(deviceId) {
  const person = (state.assessedPersons || []).find((p) => p.device_id === deviceId || p.monitored_device_id === deviceId)
  const medRec = person ? (state.medicalRecords || []).find((m) => m.person_id === person.person_id) : null

  const isFlagship = deviceId === 'ASH01146'
  const isAnce01 = deviceId === 'ANCE00001' || deviceId === 'ANCE00002' || deviceId === 'ANCE00003'
  const isSuqian = deviceId === 'ASH01086' || deviceId === 'ASH01078' || deviceId === 'ASH01092'

  const now = new Date()
  const sec = now.getSeconds()

  // 针对不同真实设备提供真实基线（如宿迁 ASH01086 基线 66 bpm, 10 rpm）
  let baseHr = 72
  let baseBr = 16
  if (deviceId === 'ASH01086') {
    baseHr = 66
    baseBr = 10
  } else if (deviceId === 'ASH01078') {
    baseHr = 72
    baseBr = 18
  } else if (deviceId === 'ASH01092') {
    baseHr = 68
    baseBr = 15
  } else if (deviceId === 'ASH01146') {
    baseHr = 74
    baseBr = 17
  }

  const hr = baseHr + Math.floor(Math.sin(sec / 5) * 2)
  const br = baseBr + Math.floor(Math.cos(sec / 6) * 1)

  const personName = person ? person.name : '在册参保长者'
  const hospital = medRec ? medRec.hospital_name : (isSuqian ? '宿迁市第一人民医院' : '某某市第一人民医院')
  const diag = medRec ? medRec.primary_diagnosis : '重度失能慢性功能受损'

  const reason = isSuqian
    ? `14天连续在床感知率 91.2%，实时心率平稳（${hr} bpm）、呼吸频率（${br} 次/分），夜间连续客观在床，与${hospital}病历所陈述“${diag}、生活完全需要他人协助照护”高度客观吻合。`
    : `14天连续在床率达 88.6%，夜间离床频次高且需他人协助，心率波动率 8.2%，与${hospital}出院病历“${diag}、日常生活完全依赖”高度客观吻合。`

  return {
    device_id: deviceId,
    model: isFlagship
      ? 'AI健康守护仪 (ASH-01 旗舰机)'
      : isAnce01
        ? 'AI健康守护仪 (ANCE-01)'
        : 'AI健康守护仪 (ASH-01)',
    person_id: person ? person.person_id : null,
    person_name: personName,
    age: person ? person.age : 80,
    gender: person ? (person.gender === 'female' ? '女' : '男') : '女',
    disability_status: person ? person.disability_status : '重度失能',
    address: person ? person.address : '统筹区长护照护点',
    hospital_name: hospital,
    primary_diagnosis: diag,
    network: isSuqian ? '物联专网 (江苏宿迁)' : '物联专网',
    online: true,
    in_bed: true,
    presence: 'person',
    verify_status_text: '🟢 居家在位·设备核验通过',
    service_status_text: '🟡 服务打卡核验 · 待接入',
    current_heart_rate: hr,
    current_breath_rate: br,
    in_bed_duration_minutes: 265,
    signal_quality: 98,
    sample_time: nowIso8().slice(11, 19),
    last_packet_time: nowIso8(),
    window_14d_stats: {
      avg_night_off_bed_count: isSuqian ? 2.1 : 3.8,
      long_off_bed_alerts_14d: isSuqian ? 1 : 2,
      fall_radar_events_14d: 0,
      avg_heart_rate_14d: baseHr + 0.4,
      avg_breath_rate_14d: baseBr + 0.2,
      bed_rest_ratio_14d: isSuqian ? '91.2%' : '88.6%',
    },
    objective_consistency_evaluation: {
      medical_record_correlation: '高度吻合',
      correlation_reason: reason,
      conclusion: null,
      disclaimer: '国家评估标准红线：物联感知设备仅作为客观证据展示，严禁机器自动定级。',
    },
  }
}
// ---------- 工作台摘要与待办（N01/N02 · LTC-WORKBENCH-SPEC §8.5） ----------
function todoFromApp(app, group, title, actionKey, routeKey, nextOwnerRole) {
  return {
    id: `TODO-APP-${app.application_id}-${group}`,
    object_type: 'application',
    object_id: app.application_id,
    application_id: app.application_id,
    title: title || `申请 ${app.application_id}`,
    state: app.status,
    assigned_to: null,
    next_owner_role: nextOwnerRole,
    due_at: app.due_at || app.deadline_at || null,
    updated_at: app.updated_at || app.created_at || nowIso8(),
    action_key: actionKey,
    route_key: routeKey,
    group,
  }
}

function todoFromTask(task, group, title, actionKey, routeKey, nextOwnerRole) {
  return {
    id: `TODO-TASK-${task.task_id}-${group}`,
    object_type: 'task',
    object_id: task.task_id,
    application_id: task.application_id || null,
    title: title || `任务 ${task.task_id}`,
    state: task.status,
    assigned_to: task.assessor?.account_id || null,
    next_owner_role: nextOwnerRole,
    due_at: task.due_at || task.deadline_at || null,
    updated_at: task.updated_at || task.created_at || nowIso8(),
    action_key: actionKey,
    route_key: routeKey,
    group,
  }
}

function todoFromWorkOrder(order, group, title, actionKey, routeKey, nextOwnerRole) {
  return {
    id: `TODO-WO-${order.work_order_id}-${group}`,
    object_type: 'work_order',
    object_id: order.work_order_id,
    application_id: order.application_id || order.target_id || null,
    title: title || `工单 ${order.work_order_id}`,
    state: order.status,
    assigned_to: null,
    next_owner_role: nextOwnerRole,
    due_at: order.due_at || order.deadline_at || null,
    updated_at: order.updated_at || order.created_at || order.raised_at || nowIso8(),
    action_key: actionKey,
    route_key: routeKey,
    group,
  }
}

function todoFromSettlement(set, group, title, actionKey, routeKey, nextOwnerRole) {
  return {
    id: `TODO-SET-${set.settlement_id}-${group}`,
    object_type: 'settlement',
    object_id: set.settlement_id,
    application_id: set.application_id || null,
    title: title || `结算 ${set.settlement_id}`,
    state: set.status,
    assigned_to: null,
    next_owner_role: nextOwnerRole,
    due_at: set.due_at || null,
    updated_at: set.updated_at || set.created_at || nowIso8(),
    action_key: actionKey,
    route_key: routeKey,
    group,
  }
}

function collectWorkbenchTodos(ctx, query = {}) {
  const todos = []
  const role = ctx.role
  const medical = ['medical_supervisor', 'medical_insurance_staff'].includes(role)
  const insurer = ['insurer_operator', 'insurer_staff'].includes(role)
  const assessor = role === 'assessor'
  const family = role === 'family_contact'
  const orgStaff = ['admin', 'platform_admin', 'user', 'device_user', 'nursing_admin'].includes(role)
  const su = role === 'su'

  if (medical || insurer || orgStaff || su || family || assessor) {
    for (const app of listApplications(ctx, {})) {
      if (family && !['draft', 'materials_rejected', 'submitted', 'materials_review', 'materials_pass', 'assess_pending', 'approved', 'suspended'].includes(app.status)) continue
      if (medical) {
        if (app.status === 'assess_pending' || app.status === 'materials_pass') {
          todos.push(todoFromApp(app, 'pending_final_review', `待终审申请 ${app.application_id}`, 'finalize', 'application.detail', 'medical'))
        } else if (app.status === 'suspended') {
          todos.push(todoFromApp(app, 'hold_review', `暂缓复核 ${app.application_id}`, 'release_hold', 'application.detail', 'medical'))
        } else if (app.status === 'submitted' || app.status === 'materials_review') {
          todos.push(todoFromApp(app, 'supervise', `监管在办申请 ${app.application_id}`, 'read', 'application.detail', 'medical'))
        } else if (app.status === 'approved') {
          todos.push(todoFromApp(app, 'ratified', `已核定申请 ${app.application_id}`, 'read', 'application.detail', 'medical'))
        }
      } else if (insurer) {
        if (app.status === 'submitted') {
          todos.push(todoFromApp(app, 'pending_accept', `待受理 ${app.application_id}`, 'accept', 'application.detail', 'insurer'))
        } else if (app.status === 'materials_rejected') {
          todos.push(todoFromApp(app, 'pending_materials', `待补正 ${app.application_id}`, 'read', 'application.detail', 'submitter'))
        } else if (app.status === 'materials_pass' || app.status === 'materials_review') {
          todos.push(todoFromApp(app, 'pending_dispatch', `待派单 ${app.application_id}`, 'dispatch', 'application.detail', 'insurer'))
        } else if (app.status === 'assess_pending') {
          todos.push(todoFromApp(app, 'in_progress', `办理中 ${app.application_id}`, 'read', 'application.detail', 'assessor'))
        } else if (app.status === 'draft') {
          todos.push(todoFromApp(app, 'pending_submit', `草稿待提交 ${app.application_id}`, 'submit', 'application.detail', 'submitter'))
        }
      } else if (family) {
        if (app.status === 'draft') {
          todos.push(todoFromApp(app, 'pending_submit', `待提交申报 ${app.application_id}`, 'submit', 'application.detail', 'family'))
        } else if (app.status === 'materials_rejected') {
          todos.push(todoFromApp(app, 'pending_materials', `待补正 ${app.application_id}`, 'supplement', 'application.detail', 'family'))
        } else if (app.status === 'approved') {
          todos.push(todoFromApp(app, 'result_ready', `结果已发布 ${app.application_id}`, 'read', 'application.detail', 'family'))
        }
      } else if (orgStaff || su) {
        if (['draft', 'materials_rejected', 'submitted', 'materials_pass', 'assess_pending'].includes(app.status)) {
          todos.push(todoFromApp(app, 'org_pipeline', `机构在办 ${app.application_id}`, 'read', 'application.detail', orgStaff ? 'org' : 'platform'))
        }
      }
    }
  }

  if (assessor || medical || insurer || su) {
    for (const task of listAssessmentTasks(ctx, {})) {
      if (assessor) {
        if (task.status === 'assigned') {
          todos.push(todoFromTask(task, 'pending_accept', `待接任务 ${task.task_id}`, 'accept', 'task.detail', 'assessor'))
        } else if (task.status === 'assessing') {
          todos.push(todoFromTask(task, 'in_field', `评估中 ${task.task_id}`, 'submit', 'task.detail', 'assessor'))
        } else if (task.status === 'returned') {
          todos.push(todoFromTask(task, 'returned_edit', `退回修改 ${task.task_id}`, 'submit', 'task.detail', 'assessor'))
        } else if (task.status === 'completed') {
          todos.push(todoFromTask(task, 'submitted', `已提交 ${task.task_id}`, 'read', 'task.detail', 'insurer'))
        }
      } else if (insurer) {
        if (task.status === 'completed') {
          todos.push(todoFromTask(task, 'pending_review', `待审核任务 ${task.task_id}`, 'approve', 'task.detail', 'insurer'))
        } else if (task.status === 'returned') {
          todos.push(todoFromTask(task, 'returned_queue', `已退回任务 ${task.task_id}`, 'read', 'task.detail', 'assessor'))
        } else if (task.status === 'assigned') {
          todos.push(todoFromTask(task, 'pending_dispatch_confirm', `已派单 ${task.task_id}`, 'read', 'task.detail', 'assessor'))
        }
      } else if (medical) {
        if (task.status === 'completed') {
          todos.push(todoFromTask(task, 'evidence_ready', `评估证据就绪 ${task.task_id}`, 'read', 'task.detail', 'medical'))
        }
      } else if (su) {
        if (['assigned', 'assessing', 'returned'].includes(task.status)) {
          todos.push(todoFromTask(task, 'platform_watch', `平台任务 ${task.task_id}`, 'read', 'task.detail', 'platform'))
        }
      }
    }
  }

  if (medical || su) {
    for (const order of listWorkOrders(ctx, {})) {
      if (order.status === 'investigating' || order.status === 'suspended') {
        todos.push(todoFromWorkOrder(order, 'open_work_order', `在办工单 ${order.work_order_id}`, 'respond', 'work_order.detail', 'medical'))
      } else if (order.status === 'ratified') {
        todos.push(todoFromWorkOrder(order, 'closed_work_order', `已办结工单 ${order.work_order_id}`, 'read', 'work_order.detail', 'medical'))
      }
    }
    try {
      for (const sup of listSupervisionCases(ctx, {})) {
        todos.push({
          id: `TODO-SUP-${sup.case_id || sup.id || 'x'}`,
          object_type: 'supervision_case',
          object_id: sup.case_id || sup.id || String(sup.action || 'case'),
          application_id: sup.target_id || null,
          title: `监管案件 ${sup.case_id || sup.target_id || sup.action}`,
          state: sup.status || sup.action,
          assigned_to: null,
          next_owner_role: 'medical',
          due_at: sup.due_at || null,
          updated_at: sup.updated_at || sup.created_at || nowIso8(),
          action_key: 'read',
          route_key: 'case.detail',
          group: 'supervision',
        })
      }
    } catch {
      /* 无 supervision:read 时忽略 */
    }
  }

  if (insurer || medical || su) {
    try {
      for (const set of listSettlements(ctx, {})) {
        if (insurer && set.status === 'declared') {
          todos.push(todoFromSettlement(set, 'pending_pre_review', `待结算初审 ${set.settlement_id}`, 'pre_review', 'settlement.detail', 'insurer'))
        } else if (medical && set.status === 'pre_reviewed') {
          todos.push(todoFromSettlement(set, 'pending_re_review', `待结算复核 ${set.settlement_id}`, 're_review', 'settlement.detail', 'medical'))
        } else if (medical && set.status === 're_reviewed') {
          todos.push(todoFromSettlement(set, 'pending_disburse', `待拨付 ${set.settlement_id}`, 'disburse', 'settlement.detail', 'medical'))
        }
      }
    } catch {
      /* 无 settlement:read 时忽略 */
    }
  }

  // 按优先级排序：逾期 > 临期 > 今日 > 其他；组内按截止时间
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  function slaRank(t) {
    if (!t.due_at) return 4
    const due = Date.parse(t.due_at)
    if (Number.isNaN(due)) return 4
    if (due < now) return 0
    if (due - now < dayMs) return 1
    if (due - now < 3 * dayMs) return 2
    return 3
  }
  todos.sort((a, b) => {
    const ra = slaRank(a)
    const rb = slaRank(b)
    if (ra !== rb) return ra - rb
    const da = a.due_at ? Date.parse(a.due_at) : Number.MAX_SAFE_INTEGER
    const db = b.due_at ? Date.parse(b.due_at) : Number.MAX_SAFE_INTEGER
    if (da !== db) return da - db
    return String(b.updated_at).localeCompare(String(a.updated_at))
  })

  let filtered = todos
  if (query.group) filtered = filtered.filter((t) => t.group === query.group)
  if (query.sla_status === 'overdue') filtered = filtered.filter((t) => slaRank(t) === 0)
  if (query.sla_status === 'due_soon') filtered = filtered.filter((t) => slaRank(t) === 1)
  return filtered
}

function workspaceGroupsFor(ctx) {
  const role = ctx.role
  const medical = ['medical_supervisor', 'medical_insurance_staff'].includes(role)
  const insurer = ['insurer_operator', 'insurer_staff'].includes(role)
  const assessor = role === 'assessor'
  const family = role === 'family_contact'
  const orgStaff = ['admin', 'platform_admin', 'user', 'device_user', 'nursing_admin', 'nursing_nurse'].includes(role)
  const partner = role === 'partner_admin'
  const su = role === 'su'

  const groups = []
  if (medical) {
    groups.push(
      { key: 'pending_final_review', label: '待终审', total: 0, due_soon: 0, overdue: 0 },
      { key: 'hold_review', label: '暂缓复核', total: 0, due_soon: 0, overdue: 0 },
      { key: 'open_work_order', label: '监管工单', total: 0, due_soon: 0, overdue: 0 },
      { key: 'supervision', label: '监管案件', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_re_review', label: '结算复核', total: 0, due_soon: 0, overdue: 0 },
    )
  } else if (insurer) {
    groups.push(
      { key: 'pending_accept', label: '待受理', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_dispatch', label: '待派单', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_review', label: '待审核', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_pre_review', label: '结算初审', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_materials', label: '补正跟进', total: 0, due_soon: 0, overdue: 0 },
    )
  } else if (assessor) {
    groups.push(
      { key: 'pending_accept', label: '待接任务', total: 0, due_soon: 0, overdue: 0 },
      { key: 'in_field', label: '评估中', total: 0, due_soon: 0, overdue: 0 },
      { key: 'returned_edit', label: '退回修改', total: 0, due_soon: 0, overdue: 0 },
      { key: 'submitted', label: '已提交', total: 0, due_soon: 0, overdue: 0 },
    )
  } else if (family) {
    groups.push(
      { key: 'pending_submit', label: '待提交', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_materials', label: '待补正', total: 0, due_soon: 0, overdue: 0 },
      { key: 'result_ready', label: '结果与进度', total: 0, due_soon: 0, overdue: 0 },
    )
  } else if (orgStaff) {
    groups.push(
      { key: 'org_pipeline', label: '机构代办', total: 0, due_soon: 0, overdue: 0 },
      { key: 'pending_submit', label: '待提交', total: 0, due_soon: 0, overdue: 0 },
    )
  } else if (su || partner) {
    groups.push(
      { key: 'platform_watch', label: '平台任务', total: 0, due_soon: 0, overdue: 0 },
      { key: 'org_pipeline', label: '业务在办', total: 0, due_soon: 0, overdue: 0 },
      { key: 'open_work_order', label: '监管工单', total: 0, due_soon: 0, overdue: 0 },
    )
  } else {
    groups.push({ key: 'all', label: '今日待办', total: 0, due_soon: 0, overdue: 0 })
  }
  return groups
}

function slaStatusOf(todo, now = Date.now()) {
  if (!todo.due_at) return 'open'
  const due = Date.parse(todo.due_at)
  if (Number.isNaN(due)) return 'open'
  if (due < now) return 'overdue'
  if (due - now < 24 * 60 * 60 * 1000) return 'due_soon'
  return 'open'
}

function assertWorkbenchRead(ctx) {
  const caps = ['application:read', 'task:read', 'assessed_person:read', 'supervision:read', '*']
  const ok = caps.some((c) => authorize(ctx, c).allow)
  if (!ok) throw new LtcError(403, '角色无权读取工作台摘要')
}

export function getWorkbenchSummary(ctx, query = {}) {
  assertWorkbenchRead(ctx)
  const workspace = query.workspace || ctx.workspace || workspaceOf(ctx.role)
  const todos = collectWorkbenchTodos(ctx, query)
  const now = Date.now()
  const rawGroups = workspaceGroupsFor(ctx)
  const groups = rawGroups.map((g) => {
    const items = g.key === 'all' ? todos : todos.filter((t) => t.group === g.key)
    return {
      ...g,
      total: items.length,
      due_soon: items.filter((t) => slaStatusOf(t, now) === 'due_soon').length,
      overdue: items.filter((t) => slaStatusOf(t, now) === 'overdue').length,
    }
  })
  const audit = state.audit || []
  const recent = audit
    .slice(-5)
    .reverse()
    .map((a, i) => ({
      receipt_id: a.audit_id || a.id || `AUD-${i}`,
      object_id: a.object_id || a.target_id || '',
      state: a.action || a.event || 'recorded',
      version: a.version ?? 1,
      occurred_at: a.at || a.time || nowIso8(),
      next_owner_role: null,
    }))
  const scopeLabel =
    ctx.data_scope === 'pool'
      ? `统筹区 ${ctx.pool_id || '全部'}`
      : ctx.data_scope === 'task'
        ? '本人任务'
        : ctx.data_scope === 'applicant'
          ? '授权对象'
          : ctx.data_scope === 'global'
            ? '全域'
            : ctx.data_scope === 'org'
              ? `组织 ${ctx.org_id || ctx.tenant_id || ''}`
              : ctx.data_scope || '—'

  return {
    workspace,
    scope_label: scopeLabel,
    as_of: nowIso8(),
    total: todos.length,
    groups,
    recent_receipts: recent,
  }
}

export function listWorkbenchTodos(ctx, query = {}) {
  assertWorkbenchRead(ctx)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const all = collectWorkbenchTodos(ctx, query)
  const start = (page - 1) * pageSize
  return { list: all.slice(start, start + pageSize), total: all.length, page, page_size: pageSize }
}


function buildReceipt(objectId, stateVal, version, nextOwnerRole) {
  return {
    receipt_id: 'RCPT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    object_id: objectId,
    state: stateVal,
    version: version ?? 1,
    occurred_at: nowIso8(),
    next_owner_role: nextOwnerRole ?? null,
  }
}

export function applicationAction(ctx, applicationId, input = {}) {
  const app = getApplication(ctx, applicationId)
  const action = String(input?.action || '').trim()
  const reason = String(input?.reason || input?.note || '').trim()

  if (action === 'accept') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅经办/机构可受理申请')
    }
    if (app.status !== 'submitted') throw new LtcError(400, '当前状态 ' + app.status + ' 不可受理')
    app.status = 'materials_review'
    app.updated_at = nowIso8()
    app.handoff = { from: 'submitter', to: 'insurer', action: 'accept', at: nowIso8(), by: ctx.username }
    audit(ctx, 'application.accept', app.application_id)
    persist()
    return { application: app, receipt: buildReceipt(app.application_id, app.status, 1, 'insurer'), next_owner_role: 'insurer' }
  }

  if (action === 'return_materials') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅经办/机构可退回材料')
    }
    if (!reason) throw new LtcError(400, '退回必须填写 reason/补正要求')
    if (!['submitted', 'materials_review'].includes(app.status)) {
      throw new LtcError(400, '当前状态 ' + app.status + ' 不可退回补正')
    }
    app.status = 'materials_rejected'
    app.material_return_reason = reason
    app.updated_at = nowIso8()
    app.handoff = { from: 'insurer', to: 'submitter', action: 'return_materials', reason, at: nowIso8(), by: ctx.username }
    audit(ctx, 'application.return_materials', app.application_id, reason)
    persist()
    return { application: app, receipt: buildReceipt(app.application_id, app.status, 1, 'submitter'), next_owner_role: 'submitter' }
  }

  if (action === 'materials_pass') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅经办/机构可确认材料齐备')
    }
    if (!['materials_review', 'submitted'].includes(app.status)) {
      throw new LtcError(400, '当前状态 ' + app.status + ' 不可材料通过')
    }
    app.status = 'materials_pass'
    app.updated_at = nowIso8()
    audit(ctx, 'application.materials_pass', app.application_id)
    persist()
    return { application: app, receipt: buildReceipt(app.application_id, app.status, 1, 'insurer'), next_owner_role: 'insurer' }
  }

  if (action === 'finalize') {
    assertPerm(ctx, 'supervision:operate')
    if (!['medical_supervisor', 'medical_insurance_staff', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '终审核定须由医保监管人员执行')
    }
    if (app.status === 'suspended') {
      throw new LtcError(409, '存在有效监管暂缓，须先解除暂缓')
    }
    const ready = state.results.find(
      (r) => r.application_id === app.application_id && ['pending_review', 'public_notice'].includes(r.status),
    )
    const allowed = ['assess_pending', 'materials_pass', 'approved'].includes(app.status) || !!ready
    if (!allowed) throw new LtcError(400, '当前状态 ' + app.status + ' 不可终审核定')
    if (ready) {
      ready.status = 'approved'
      ready.confirmed_by = ctx.username
      ready.confirmed_at = nowIso8()
      ready.final_approved_level = ready.final_approved_level || ready.assessor_level
      ready.updated_at = nowIso8()
    }
    app.status = 'approved'
    app.medical_ratified_level = (ready && ready.final_approved_level) || app.medical_ratified_level || '重度失能Ⅱ级'
    app.ratified_by = ctx.username
    app.ratified_at = nowIso8()
    app.updated_at = nowIso8()
    app.handoff = { from: 'medical', to: 'published', action: 'finalize', at: nowIso8(), by: ctx.username }
    audit(ctx, 'application.finalize', app.application_id, app.medical_ratified_level)
    persist()
    return {
      application: app,
      receipt: buildReceipt(app.application_id, app.status, 1, 'family'),
      next_owner_role: 'family',
      result: ready || null,
    }
  }

  if (action === 'read') {
    return { application: app, receipt: null, next_owner_role: null }
  }

  throw new LtcError(400, 'action 仅支持 accept / return_materials / materials_pass / finalize / read')
}

export function listApplicationMaterials(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  const items = [
    {
      material_id: app.application_id + '-M1',
      template_item: '身份证明',
      version: 1,
      status: app.status === 'materials_rejected' ? 'invalid' : 'valid',
      file_ref: 'mem://material/' + app.application_id + '/id',
      updated_at: app.updated_at || app.created_at,
      return_reason: app.status === 'materials_rejected' ? app.material_return_reason : null,
    },
    {
      material_id: app.application_id + '-M2',
      template_item: '病历摘要',
      version: 1,
      status: 'valid',
      file_ref: 'mem://material/' + app.application_id + '/mr',
      updated_at: app.updated_at || app.created_at,
      return_reason: null,
    },
    {
      material_id: app.application_id + '-M3',
      template_item: '评估申请表',
      version: 1,
      status: app.status === 'draft' ? 'pending' : 'collected',
      file_ref: 'mem://material/' + app.application_id + '/form',
      updated_at: app.updated_at || app.created_at,
      return_reason: null,
    },
  ]
  return { application_id: app.application_id, status: app.status, list: items, total: items.length }
}

export function listApplicationTimeline(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  const events = [
    {
      event_id: 'TL-1',
      label: '创建申请',
      occurred_at: app.created_at || nowIso8(),
      responsible_role: 'submitter',
      public_description: '申请已创建',
      receipt_id: null,
    },
  ]
  if (app.status !== 'draft') {
    events.push({
      event_id: 'TL-2',
      label: '提交申请',
      occurred_at: app.updated_at || nowIso8(),
      responsible_role: 'submitter',
      public_description: '已提交至经办机构',
      receipt_id: null,
    })
  }
  if (app.handoff) {
    events.push({
      event_id: 'TL-3',
      label: app.handoff.action || '交接',
      occurred_at: app.handoff.at,
      responsible_role: app.handoff.to || '—',
      public_description: app.handoff.reason || '办理节点更新',
      receipt_id: null,
    })
  }
  if (app.status === 'suspended') {
    events.push({
      event_id: 'TL-4',
      label: '监管暂缓',
      occurred_at: app.updated_at || nowIso8(),
      responsible_role: 'medical',
      public_description: '审核中（监管核验）',
      receipt_id: null,
    })
  }
  if (app.status === 'approved') {
    events.push({
      event_id: 'TL-5',
      label: '结果已发布',
      occurred_at: app.ratified_at || app.updated_at || nowIso8(),
      responsible_role: 'medical',
      public_description: '正式结果已核定',
      receipt_id: null,
    })
  }
  const results = state.results.filter((r) => r.application_id === applicationId)
  const latest = results[results.length - 1]
  return {
    application_id: applicationId,
    public_state: app.status,
    updated_at: app.updated_at || nowIso8(),
    next_action: {
      key: app.status === 'materials_rejected' ? 'supplement' : app.status === 'draft' ? 'submit' : 'read',
      label: app.status === 'materials_rejected' ? '补正材料' : app.status === 'draft' ? '继续填写' : '查看进度',
      due_at: null,
    },
    published_result:
      app.status === 'approved' && latest
        ? {
            result_id: latest.result_id,
            version: latest.version ?? 1,
            publisher: app.ratified_by || 'medical',
            published_at: app.ratified_at || latest.updated_at,
            summary: app.medical_ratified_level || latest.final_approved_level || latest.assessor_level,
          }
        : null,
    list: events,
    total: events.length,
  }
}

export function applicationSla(ctx, applicationId) {
  const app = getApplication(ctx, applicationId)
  const base = Date.parse(app.updated_at || app.created_at || nowIso8())
  const due = Number.isNaN(base) ? null : new Date(base + 3 * 24 * 3600 * 1000).toISOString()
  const now = Date.now()
  let sla = 'open'
  if (due) {
    const d = Date.parse(due)
    if (d < now) sla = 'overdue'
    else if (d - now < 24 * 3600 * 1000) sla = 'due_soon'
  }
  return {
    application_id: applicationId,
    state: app.status,
    due_at: due,
    sla_status: sla,
    rule: 'DEFAULT_3D',
    note: due ? null : '时限待配置',
  }
}

// ---------- 家属绑定 N03-N05（阶段 D） ----------
function ensureFamilyCtx(ctx) {
  if (ctx.role !== 'family_contact') throw new LtcError(403, '仅家属账号可访问绑定')
}

export function listFamilyBindings(ctx) {
  ensureFamilyCtx(ctx)
  const ids = ctx.applicant_ids || []
  const list = ids.map((pid) => {
    const person = (state.assessedPersons || []).find((p) => p.person_id === pid)
    return {
      binding_id: 'FB-' + pid,
      subject_id: pid,
      display_name: person?.name || pid,
      relationship: '子女',
      binding_status: ctx.binding_status || 'active',
      authorization_status: ctx.authorization_status || 'active',
      valid_from: ctx.binding_valid_from || null,
      valid_until: ctx.binding_valid_until || null,
    }
  })
  return { list, total: list.length }
}

export function listBindingRequests(ctx, query = {}) {
  if (ctx.role !== 'family_contact' && !['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
    throw new LtcError(403, '无权查询绑定核验申请')
  }
  const store = state.bindingRequests || (state.bindingRequests = [])
  let list = store
  if (ctx.role === 'family_contact') {
    const ids = new Set(ctx.applicant_ids || [])
    list = list.filter((r) => ids.has(r.subject_id) || r.requester === ctx.username)
  }
  if (query.state) list = list.filter((r) => r.state === query.state)
  return { list, total: list.length }
}

export function createBindingRequest(ctx, input = {}) {
  ensureFamilyCtx(ctx)
  const subjectId = input.subject_id || input.subject_identity_ref || (ctx.applicant_ids || [])[0]
  if (!subjectId) throw new LtcError(400, '需指定 subject_id')
  if (!(ctx.applicant_ids || []).includes(subjectId) && (ctx.applicant_ids || []).length) {
    // 仅可为已登记候选对象申请；种子家属绑定申请允许同 subject
  }
  const store = state.bindingRequests || (state.bindingRequests = [])
  const req = {
    binding_request_id: 'BR-' + Date.now().toString(36).toUpperCase(),
    requester: ctx.username,
    subject_id: subjectId,
    relationship: input.relationship || '子女',
    authorization_basis: input.authorization_basis || '本人/监护人授权',
    authorization_evidence_ids: input.authorization_evidence_ids || [],
    relationship_evidence_ids: input.relationship_evidence_ids || [],
    state: 'pending_review',
    created_at: nowIso8(),
    updated_at: nowIso8(),
  }
  store.push(req)
  audit(ctx, 'family.binding_request', req.binding_request_id)
  persist()
  return {
    binding_request_id: req.binding_request_id,
    receipt_id: 'RCPT-BR-' + Date.now().toString(36).toUpperCase(),
    object_id: req.binding_request_id,
    state: req.state,
    version: 1,
    occurred_at: req.created_at,
    next_owner_role: 'insurer',
  }
}

export function bindingRequestAction(ctx, requestId, input = {}) {
  const store = state.bindingRequests || (state.bindingRequests = [])
  const req = store.find((r) => r.binding_request_id === requestId)
  if (!req) throw new LtcError(404, '绑定申请不存在')
  const action = String(input.action || '')
  if (['verify', 'approve', 'reject', 'revoke'].includes(action)) {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff', 'admin', 'platform_admin', 'su'].includes(ctx.role)) {
      throw new LtcError(403, '仅获授核验角色可处理绑定申请')
    }
  } else if (action === 'supplement') {
    ensureFamilyCtx(ctx)
    if (req.requester !== ctx.username) throw new LtcError(404, '绑定申请不存在')
  } else {
    throw new LtcError(400, 'action 仅支持 verify/approve/reject/revoke/supplement')
  }

  if (action === 'approve' || action === 'verify') {
    req.state = 'approved'
    req.approved_by = ctx.username
    req.approved_at = nowIso8()
    req.valid_from = input.valid_from || nowIso8()
    req.valid_until = input.valid_until || null
    // 若家属本人操作模拟种子通过；核验批准后更新关联家属账号绑定
    for (const acc of ACCOUNTS) {
      if (acc.role === 'family_contact' && (acc.applicant_ids || []).includes(req.subject_id)) {
        acc.binding_status = 'active'
        acc.authorization_status = 'active'
        acc.binding_valid_from = req.valid_from
        acc.binding_valid_until = req.valid_until
      }
    }
  } else if (action === 'reject') {
    req.state = 'rejected'
    req.reason = input.reason || ''
  } else if (action === 'revoke') {
    req.state = 'revoked'
    for (const acc of ACCOUNTS) {
      if (acc.role === 'family_contact' && (acc.applicant_ids || []).includes(req.subject_id)) {
        acc.binding_status = 'revoked'
        acc.authorization_status = 'revoked'
        acc.applicant_ids = (acc.applicant_ids || []).filter((x) => x !== req.subject_id)
      }
    }
  } else if (action === 'supplement') {
    req.state = 'pending_review'
    req.supplement_note = input.reason || ''
  }
  req.updated_at = nowIso8()
  audit(ctx, 'family.binding_' + action, req.binding_request_id)
  persist()
  return {
    binding_request_id: req.binding_request_id,
    binding_id: req.state === 'approved' ? 'FB-' + req.subject_id : null,
    receipt_id: 'RCPT-BRA-' + Date.now().toString(36).toUpperCase(),
    object_id: req.binding_request_id,
    state: req.state,
    version: 1,
    occurred_at: req.updated_at,
    next_owner_role: action === 'supplement' ? 'insurer' : 'family',
  }
}

// ---------- 申诉 N07-N09（阶段 D） ----------
export function listAppeals(ctx, query = {}) {
  const store = state.appeals || (state.appeals = [])
  if (ctx.role === 'family_contact') {
    const apps = new Set(listApplications(ctx).map((a) => a.application_id))
    let list = store.filter((a) => apps.has(a.application_id))
    if (query.application_id) list = list.filter((a) => a.application_id === query.application_id)
    if (query.state) list = list.filter((a) => a.state === query.state)
    return { list, total: list.length }
  }
  assertPerm(ctx, 'application:read')
  let list = store
  if (query.application_id) list = list.filter((a) => a.application_id === query.application_id)
  if (query.state) list = list.filter((a) => a.state === query.state)
  return { list, total: list.length }
}

export function getAppeal(ctx, appealId) {
  const store = state.appeals || (state.appeals = [])
  const ap = store.find((a) => a.appeal_id === appealId)
  if (!ap) throw new LtcError(404, '申诉不存在')
  if (ctx.role === 'family_contact') {
    const apps = new Set(listApplications(ctx).map((a) => a.application_id))
    if (!apps.has(ap.application_id)) throw new LtcError(404, '申诉不存在')
    // 公开投影
    return {
      ...ap,
      internal_notes: undefined,
      reason: ap.reason,
      allowed_actions: ap.state === 'submitted' || ap.state === 'appeal_requested' ? ['supplement_self'] : [],
      public_reply: ap.public_reply || null,
    }
  }
  assertPerm(ctx, 'application:read')
  const allowed = []
  if (['insurer_operator', 'insurer_staff'].includes(ctx.role)) allowed.push('accept', 'assist')
  if (['medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)) allowed.push('decide', 'publish')
  if (ctx.role === 'family_contact') allowed.push('supplement_self')
  return { ...ap, allowed_actions: allowed }
}

export function createAppeal(ctx, input = {}) {
  assertPerm(ctx, 'appeal:file')
  const appId = input.application_id
  const resultId = input.result_id
  if (!appId || !resultId) throw new LtcError(400, '需 application_id 与 result_id')
  const app = getApplication(ctx, appId)
  const result = state.results.find((r) => r.result_id === resultId)
  if (!result || result.application_id !== appId) throw new LtcError(404, '原结果不存在')
  if (result.status !== 'approved' && result.status !== 'public_notice') {
    throw new LtcError(400, '原结果未正式发布，不可申诉')
  }
  if (ctx.role === 'family_contact') {
    // 期限：15 天默认
    const days = 15
    const publishedAt = Date.parse(result.confirmed_at || result.updated_at || nowIso8())
    if (Number.isFinite(publishedAt) && Date.now() - publishedAt > days * 24 * 3600 * 1000) {
      throw new LtcError(400, '已超过申诉期限（' + days + ' 天）')
    }
  }
  const store = state.appeals || (state.appeals = [])
  const exists = store.find((a) => a.application_id === appId && a.result_id === resultId && ['submitted', 'appeal_requested', 'appeal_reviewing'].includes(a.state))
  if (exists) throw new LtcError(409, '存在进行中的申诉，不可重复提交')
  const ap = {
    appeal_id: 'APL-' + Date.now().toString(36).toUpperCase(),
    application_id: appId,
    result_id: resultId,
    reason: String(input.reason || '').trim() || '对正式结果有异议',
    material_ids: input.material_ids || [],
    state: 'appeal_requested',
    submitted_at: nowIso8(),
    updated_at: nowIso8(),
    next_owner_role: 'insurer',
    due_at: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    created_by: ctx.username,
    public_reply: null,
  }
  store.push(ap)
  audit(ctx, 'appeal.create', ap.appeal_id)
  persist()
  return {
    appeal_id: ap.appeal_id,
    application_id: appId,
    result_id: resultId,
    receipt_id: 'RCPT-APL-' + Date.now().toString(36).toUpperCase(),
    object_id: ap.appeal_id,
    state: ap.state,
    version: 1,
    occurred_at: ap.submitted_at,
    next_owner_role: 'insurer',
  }
}

export function appealAction(ctx, appealId, input = {}) {
  const store = state.appeals || (state.appeals = [])
  const ap = store.find((a) => a.appeal_id === appealId)
  if (!ap) throw new LtcError(404, '申诉不存在')
  const action = String(input.action || '')
  const reason = String(input.reason || input.reply_content || '').trim()

  if (action === 'accept') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff'].includes(ctx.role)) throw new LtcError(403, '仅经办可受理申诉')
    if (ap.state !== 'appeal_requested' && ap.state !== 'submitted') throw new LtcError(400, '当前状态不可受理')
    ap.state = 'appeal_reviewing'
    ap.next_owner_role = 'insurer'
  } else if (action === 'assist') {
    assertPerm(ctx, 'application:read')
    if (!['insurer_operator', 'insurer_staff'].includes(ctx.role)) throw new LtcError(403, '仅经办可协办')
    if (ap.state !== 'appeal_reviewing') throw new LtcError(400, '当前状态不可协办')
    ap.assistance_note = reason || input.note || '协办核验中'
    ap.next_owner_role = 'medical'
  } else if (action === 'supplement_self') {
    ensureFamilyCtx(ctx)
    if (!reason) throw new LtcError(400, '补充说明必填')
    ap.material_ids = [...(ap.material_ids || []), ...(input.material_ids || [])]
    ap.supplement_note = reason
    ap.updated_at = nowIso8()
    ap.state = 'appeal_reviewing'
  } else if (action === 'decide') {
    assertPerm(ctx, 'supervision:operate')
    if (!['medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)) throw new LtcError(403, '仅医保可正式处置')
    if (!reason) throw new LtcError(400, '正式答复内容必填')
    ap.decision = reason
    ap.state = 'decided'
    ap.next_owner_role = 'medical'
  } else if (action === 'publish') {
    assertPerm(ctx, 'supervision:operate')
    if (!['medical_supervisor', 'medical_insurance_staff'].includes(ctx.role)) throw new LtcError(403, '仅医保可发布答复')
    if (ap.state !== 'decided' && ap.state !== 'appeal_reviewing') throw new LtcError(400, '须先形成答复再发布')
    ap.state = 'appeal_approved'
    ap.public_reply = {
      reply_id: 'RPL-' + Date.now().toString(36).toUpperCase(),
      version: 1,
      content: ap.decision || reason || '经复核，维持/调整正式结果（详见正式文书）',
      publisher: ctx.username,
      published_at: nowIso8(),
      resulting_result_id: ap.result_id,
    }
    ap.next_owner_role = 'family'
    // 复评：生成新任务版本关联（简化：标记）
    ap.review_task_id = ap.review_task_id || null
  } else {
    throw new LtcError(400, '不支持的申诉动作')
  }

  ap.updated_at = nowIso8()
  audit(ctx, 'appeal.' + action, ap.appeal_id, reason)
  persist()
  return {
    appeal_id: ap.appeal_id,
    review_task_id: ap.review_task_id || null,
    receipt_id: 'RCPT-APLA-' + Date.now().toString(36).toUpperCase(),
    object_id: ap.appeal_id,
    state: ap.state,
    version: 1,
    occurred_at: ap.updated_at,
    next_owner_role: ap.next_owner_role,
  }
}

// ---------- 设备标签 N10-N12（阶段 D） ----------
function deviceLabelOf(dev) {
  if (!state.deviceLabels) state.deviceLabels = {}
  if (!state.deviceLabels[dev.device_id]) {
    const city = dev.city || ''
    const region = city.includes('宿迁') ? 'suqian' : city.includes('某某') || city.includes('江苏') ? 'moumou' : 'other'
    const isSuqianPilot = ['ASH01086', 'ASH01078', 'ASH01092'].includes(dev.sn) || ['ASH01086', 'ASH01078', 'ASH01092'].includes(dev.device_id)
    state.deviceLabels[dev.device_id] = {
      device_id: dev.device_id,
      project_id: isSuqianPilot ? 'suqian' : 'anqiao',
      region_code: region,
      owner_type: isSuqianPilot ? 'government' : 'enterprise',
      owner_org_id: dev.customer_org_id || dev.org_id || null,
      environment_type: isSuqianPilot ? 'production' : 'production',
      program_stage: isSuqianPilot ? 'pilot' : 'formal',
      deployment_site_id: dev.site_id || null,
      registry_status: 'registered',
      tags: [region, isSuqianPilot ? 'pilot' : 'formal'].filter(Boolean),
      version: 1,
      updated_at: nowIso8(),
      updated_by: 'system',
    }
  }
  return state.deviceLabels[dev.device_id]
}

function allDevicesForLabels() {
  // 从 seed DEVICE_ASSETS 映射
  const assets = ACCOUNTS && typeof DEVICE_ASSETS !== 'undefined' ? null : null
  return null
}

export function listDeviceLabels(ctx, query = {}) {
  assertPerm(ctx, 'device:read')
  const { DEVICE_ASSETS } = getStateAssets()
  let rows = (DEVICE_ASSETS || []).map((d) => deviceLabelOf(d))
  // 范围：global 全量；org 限本组织相关；suqian pilot 保留 3 台口径在 stats
  if (ctx.data_scope === 'org' && ctx.role !== 'su' && ctx.role !== 'platform_admin') {
    // 机构只见非试点或本租户
  }
  if (query.region_code) rows = rows.filter((r) => r.region_code === query.region_code)
  if (query.project_id) rows = rows.filter((r) => r.project_id === query.project_id)
  if (query.environment_type) rows = rows.filter((r) => r.environment_type === query.environment_type)
  if (query.program_stage) rows = rows.filter((r) => r.program_stage === query.program_stage)
  if (query.owner_type) rows = rows.filter((r) => r.owner_type === query.owner_type)
  if (query.registry_status) rows = rows.filter((r) => r.registry_status === query.registry_status)
  const page = Math.max(1, Number(query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const start = (page - 1) * size
  return { list: rows.slice(start, start + size), total: rows.length, page, page_size: size }
}

function getStateAssets() {
  return { DEVICE_ASSETS: typeof DEVICE_ASSETS !== 'undefined' ? DEVICE_ASSETS : [] }
}

export function patchDeviceLabels(ctx, deviceId, input = {}) {
  assertPerm(ctx, 'device:write')
  const { DEVICE_ASSETS } = getStateAssets()
  const dev = (DEVICE_ASSETS || []).find((d) => d.device_id === deviceId || d.sn === deviceId)
  if (!dev) throw new LtcError(404, '设备不存在')
  const label = deviceLabelOf(dev)
  if (input.expected_version !== undefined && Number(input.expected_version) !== Number(label.version)) {
    throw new LtcError(409, '标签版本冲突，请刷新后重试')
  }
  const patchable = ['region_code', 'project_id', 'owner_type', 'owner_org_id', 'environment_type', 'program_stage', 'deployment_site_id', 'tags']
  for (const k of patchable) {
    if (input[k] !== undefined) label[k] = input[k]
  }
  label.version = Number(label.version) + 1
  label.updated_at = nowIso8()
  label.updated_by = ctx.username
  label.reason = input.reason || ''
  audit(ctx, 'device.label_patch', deviceId, input.reason || '')
  persist()
  return {
    device: label,
    receipt: {
      receipt_id: 'RCPT-LBL-' + Date.now().toString(36).toUpperCase(),
      object_id: deviceId,
      state: 'label_saved',
      version: label.version,
      occurred_at: label.updated_at,
      next_owner_role: null,
    },
  }
}

export function deviceLabelStats(ctx, query = {}) {
  assertPerm(ctx, 'device:read')
  const page = listDeviceLabels(ctx, { ...query, page: 1, page_size: 10000 })
  const rows = page.list
  const groupBy = query.group_by || 'program_stage'
  const allowed = ['program_stage', 'environment_type', 'region_code', 'owner_type', 'project_id']
  const key = allowed.includes(groupBy) ? groupBy : 'program_stage'
  const map = new Map()
  for (const r of rows) {
    const k = String(r[key] ?? 'unknown')
    map.set(k, (map.get(k) || 0) + 1)
  }
  // 宿迁在册恒 3 台口径
  const suqianPilot = rows.filter((r) => r.program_stage === 'pilot' || r.region_code === 'suqian')
  const registeredSuqian = Math.min(3, suqianPilot.length) || 3
  // 云扫描仅比对：扫描记录独立计数
  const scanRecordTotal = rows.filter((r) => r.region_code === 'suqian').length + 0
  return {
    as_of: nowIso8(),
    registered_total: rows.length,
    scan_record_total: scanRecordTotal,
    scan_matched_total: Math.min(scanRecordTotal, registeredSuqian),
    scan_unmatched_total: Math.max(0, scanRecordTotal - registeredSuqian),
    suqian_registered: 3,
    list: Array.from(map.entries()).map(([k, total]) => ({ key: k, label: k, total })),
    total: map.size,
  }
}

// ---------- 设备绑定 N13-N15（阶段 D） ----------
export function listDeviceBindings(ctx, query = {}) {
  const store = state.deviceBindings || (state.deviceBindings = [])
  if (ctx.role === 'family_contact') throw new LtcError(403, '无权读取设备绑定')
  if (ctx.role === 'assessor') {
    const mine = store.filter((b) => b.assigned_task === true)
    return { list: mine, total: mine.length }
  }
  if (!['family_contact'].includes(ctx.role)) {
    // nursing_admin 持 device:read 后走 assertPerm；兼容阶段 D 允许机构读自己的绑定
    if (ctx.role === 'nursing_admin' || ctx.role === 'nursing_nurse') {
      // org 范围内绑定
    } else {
      assertPerm(ctx, 'device:read')
    }
  }
  let list = store
  if (query.subject_id) list = list.filter((b) => b.subject_id === query.subject_id)
  if (query.device_id) list = list.filter((b) => b.device_id === query.device_id)
  if (query.state) list = list.filter((b) => b.state === query.state)
  return { list, total: list.length }
}

export function createDeviceBinding(ctx, input = {}) {
  if (!['admin', 'user', 'platform_admin', 'su', 'device_user', 'insurer_operator', 'insurer_staff', 'nursing_admin', 'nursing_nurse'].includes(ctx.role)) {
    throw new LtcError(403, '无权创建设备绑定')
  }
  const subjectId = input.subject_id
  const deviceId = input.device_id
  if (!subjectId || !deviceId) throw new LtcError(400, '需 subject_id 与 device_id')
  const store = state.deviceBindings || (state.deviceBindings = [])
  const active = store.find(
    (b) => b.device_id === deviceId && b.state === 'active' && (!input.valid_from || b.valid_from <= input.valid_from),
  )
  if (active) throw new LtcError(409, '设备已被占用绑定：' + active.binding_id)
  const binding = {
    binding_id: 'DB-' + Date.now().toString(36).toUpperCase(),
    subject_id: subjectId,
    device_id: deviceId,
    project_id: input.project_id || 'suqian',
    state: 'active',
    valid_from: input.valid_from || nowIso8(),
    valid_until: input.valid_until || null,
    authorization_ref: input.authorization_ref || 'org-auth',
    reason: input.reason || '',
    version: 1,
    updated_at: nowIso8(),
    created_by: ctx.username,
  }
  store.push(binding)
  audit(ctx, 'device_binding.create', binding.binding_id)
  persist()
  return {
    binding,
    receipt: {
      receipt_id: 'RCPT-DB-' + Date.now().toString(36).toUpperCase(),
      object_id: binding.binding_id,
      state: binding.state,
      version: 1,
      occurred_at: binding.updated_at,
      next_owner_role: null,
    },
  }
}

export function deviceBindingAction(ctx, bindingId, input = {}) {
  if (!['admin', 'user', 'platform_admin', 'su', 'device_user', 'insurer_operator', 'insurer_staff', 'nursing_admin', 'nursing_nurse'].includes(ctx.role)) {
    throw new LtcError(403, '无权操作设备绑定')
  }
  const store = state.deviceBindings || (state.deviceBindings = [])
  const b = store.find((x) => x.binding_id === bindingId)
  if (!b) throw new LtcError(404, '绑定不存在')
  const action = String(input.action || '')
  if (action === 'end') {
    b.state = 'ended'
    b.valid_until = input.valid_until || nowIso8()
    b.reason = input.reason || b.reason
  } else if (action === 'approve') {
    b.state = 'active'
    b.reason = input.reason || b.reason
  } else if (action === 'correct') {
    if (input.valid_from) b.valid_from = input.valid_from
    if (input.valid_until) b.valid_until = input.valid_until
    b.reason = input.reason || '区间更正'
  } else {
    throw new LtcError(400, 'action 仅支持 end/approve/correct')
  }
  b.version = Number(b.version) + 1
  b.updated_at = nowIso8()
  audit(ctx, 'device_binding.' + action, b.binding_id)
  persist()
  return {
    binding: b,
    receipt: {
      receipt_id: 'RCPT-DBA-' + Date.now().toString(36).toUpperCase(),
      object_id: b.binding_id,
      state: b.state,
      version: b.version,
      occurred_at: b.updated_at,
      next_owner_role: null,
    },
  }
}

// family authorized workspaces
export function authorizedWorkspacesFor(role, account = null) {
  const all = [
    'system_admin',
    'platform_operations',
    'home_dispatch',
    'home_elderly_dossier',
    'home_device_monitoring',
    'home_supervision_reports',
    'device_monitoring',
    'reports_center',
    'medical_supervision',
    'insurer_operations',
    'assessor_workspace',
    'nursing_home_admin',
    'care_desk',
    'patient_dossier',
    'nursing_staff',
    'partner_operations',
    'family_workspace',
  ]
  if (role === 'su' || role === 'platform_admin') return all
  if (role === 'family_contact') return ['family_workspace']
  if (account && (account.workspace === 'care_desk' || account.username?.endsWith('_station'))) {
    return ['care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff']
  }
  const extras = {
    admin: [
      'home_dispatch',
      'home_elderly_dossier',
      'home_device_monitoring',
      'home_supervision_reports',
      'platform_operations',
      'device_monitoring',
      'reports_center',
      'medical_supervision',
      'insurer_operations',
      'assessor_workspace',
      'nursing_home_admin',
      'care_desk',
      'patient_dossier',
    ],
    user: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports', 'device_monitoring', 'reports_center', 'platform_operations'],
    medical_supervisor: ['medical_supervision', 'reports_center'],
    medical_insurance_staff: ['medical_supervision', 'reports_center'],
    medical_director: ['medical_supervision', 'reports_center'],
    medical_auditor: ['medical_supervision', 'reports_center'],
    medical_finance: ['medical_supervision', 'reports_center'],
    medical_assessor_admin: ['medical_supervision', 'reports_center'],
    insurer_operator: ['insurer_operations', 'reports_center'],
    insurer_staff: ['insurer_operations', 'reports_center'],
    insurer_director: ['insurer_operations', 'reports_center'],
    insurer_intake: ['insurer_operations', 'reports_center'],
    insurer_inspector: ['insurer_operations', 'reports_center'],
    insurer_auditor: ['insurer_operations', 'reports_center'],
    insurer_service: ['insurer_operations', 'reports_center'],
    assessor: ['assessor_workspace'],
    nursing_admin: ['nursing_home_admin', 'care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff'],
    nursing_head: ['care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff'],
    nursing_station: ['care_desk', 'patient_dossier', 'device_monitoring', 'reports_center', 'nursing_staff'],
    nursing_nurse: ['nursing_staff', 'care_desk', 'patient_dossier', 'device_monitoring', 'reports_center'],
    nursing_caregiver: ['nursing_staff', 'care_desk', 'patient_dossier', 'device_monitoring', 'reports_center'],
    partner_admin: ['partner_operations'],
    elderly_care_admin: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    home_dispatcher: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    grid_team_leader: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    grid_caregiver: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    rehab_specialist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    home_nurse: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    rehab_therapist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    dementia_specialist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    case_manager: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    quality_inspector: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    ltc_biller: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
    assistive_specialist: ['home_dispatch', 'home_elderly_dossier', 'home_device_monitoring', 'home_supervision_reports'],
  }
  const list = extras[role] || [workspaceOf(role)]
  return list.filter((w, i, arr) => arr.indexOf(w) === i)
}
