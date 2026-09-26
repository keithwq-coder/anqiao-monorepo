// 安守护 SaaS 切片 · 种子数据与账号
// 切片阶段：内存态，重启即重置；生产环境应迁移至数据库（参考 wiki SPEC §1/§2）。
// 数据为确定性伪随机（mulberry32），每次启动一致，便于演示与对账。
// 告警/长者最新体征为可变内存态（处置写操作、WS 实时推送会直接修改），生产换 DB。

import { scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ---------- 确定性 PRNG ----------
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 密码哈希（阶段四：argon2id + 随机 salt；兼容旧 scrypt）----------
// INTEGRATION-SPEC §6-5：固定 salt scrypt → argon2id；随机 salt 由 argon2 自动生成。
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LEN = 64

/** 旧格式同步 scrypt（仅兼容验证/占位）；新哈希一律 hashPasswordArgon2 */
export function hashPassword(password, salt) {
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex')
  const { N, r, p } = SCRYPT_PARAMS
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`
}

export function verifyPasswordScrypt(password, stored) {
  const parts = String(stored).split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, salt, hash] = parts
  const calc = scryptSync(password, salt, KEY_LEN, { N: +N, r: +r, p: +p })
  const expect = Buffer.from(hash, 'hex')
  return calc.length === expect.length && timingSafeEqual(calc, expect)
}

/** async 验证：优先 argon2id PHC 串，回退 scrypt 旧格式 */
export async function verifyPassword(password, stored) {
  const s = String(stored || '')
  if (s.startsWith('$argon2')) {
    try {
      const argon2 = (await import('argon2')).default
      return await argon2.verify(s, password)
    } catch {
      return false
    }
  }
  return verifyPasswordScrypt(password, s)
}

/** argon2id + 随机 salt */
export async function hashPasswordArgon2(password) {
  const argon2 = (await import('argon2')).default
  return argon2.hash(password, { type: argon2.argon2id })
}

/** 启动时把种子账号 password_hash 升级为 argon2id（已升级则跳过） */
export async function upgradeSeedPasswordHashes(password) {
  const pw = password || process.env.SEED_ACCOUNT_PASSWORD
  if (!pw) return ACCOUNTS
  for (const account of ACCOUNTS) {
    if (!String(account.password_hash || '').startsWith('$argon2')) {
      account.password_hash = await hashPasswordArgon2(pw)
    }
  }
  return ACCOUNTS
}

// ---------- 种子账号矩阵（新体系；family_contact 自阶段 D 起可登录，见 family_demo）----------
// 初始密码统一由 env SEED_ACCOUNT_PASSWORD 注入，仓库内不保存任何明文口令（INTEGRATION-SPEC §6-4）。
// 构造期用 scrypt 固定 salt 占位（同步），模块加载后由 upgradeSeedPasswordHashes() 换成 argon2id 随机 salt。
// 一账号一组织（tenant_id=org_id，principal.org_id 以其为准）；已取消旧租户切换白名单
// allowed_tenants，长护险/机构角色无权跨护理院/厂商租户切换，避免越权（POST /v1/auth/switch 仅本组织）。
const SEED_ACCOUNT_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD
if (!SEED_ACCOUNT_PASSWORD) {
  console.error('[fatal] SEED_ACCOUNT_PASSWORD 未注入，拒绝启动。请经 systemd EnvironmentFile 或进程环境提供（上线后请立即轮换）。')
  process.exit(1)
}
export const ACCOUNTS = [
  // 系统核心治理架构账号（中科安樵自营运营内部团队与业务主管）
  { username: 'su01',            password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-su01'),            staff_name: '超级管理员',        role: 'su',                      unified_role: 'su',                  tenant_id: 'platform',     org_id: 'platform',     workspace: 'system_admin',         scope: 'global' },
  { username: 'admin01',         password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-admin01'),         staff_name: '中科安樵管理员',    role: 'admin',                   unified_role: 'platform_admin',      tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'platform_operations',  scope: 'global' },
  { username: 'medical01',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-medical01'),       staff_name: '中科安樵医保业务主管',role: 'medical_insurance_staff', unified_role: 'medical_supervisor',  tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'medical_supervision',  scope: 'global' },
  { username: 'user01',          password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-user01'),          staff_name: '设备监控用户',      role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org' },

  // ==================== 宿迁市长护险试点工作组（真实3名长者与3台设备试点） ====================
  { username: 'suqian_medical',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-med-sq'),          staff_name: '宿迁试点专员',      role: 'medical_insurance_staff', unified_role: 'medical_supervisor',  tenant_id: 'bureau_suqian', org_id: 'bureau_suqian', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'suqian', assigned_title: '宿迁长护险试点监管席位 (3台设备试点)' },
  { username: 'medical_suqian',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-med-sq2'),         staff_name: '宿迁试点专员',      role: 'medical_insurance_staff', unified_role: 'medical_supervisor',  tenant_id: 'bureau_suqian', org_id: 'bureau_suqian', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'suqian', assigned_title: '宿迁长护险试点监管席位 (3台设备试点)' },

  // ==================== 某某市医疗保障局账号群（长护险数字化监管创新示范中心 · 演示专区） ====================
  { username: 'demo_director',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-demo-dir'),        staff_name: '陈立新 副局长',     role: 'medical_director',        unified_role: 'medical_director',    tenant_id: 'bureau_moumou', org_id: 'bureau_moumou', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'moumou', assigned_title: '分管副局长 / 长护领导小组 (演示席位)' },
  { username: 'demo_audit',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-demo-aud'),        staff_name: '林志刚 科长',       role: 'medical_auditor',         unified_role: 'medical_auditor',     tenant_id: 'bureau_moumou', org_id: 'bureau_moumou', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'moumou', assigned_title: '基金监督稽核科科长 (演示席位)' },
  { username: 'demo_finance',    password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-demo-fin'),        staff_name: '张静 主管',         role: 'medical_finance',         unified_role: 'medical_finance',     tenant_id: 'bureau_moumou', org_id: 'bureau_moumou', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'moumou', assigned_title: '长护待遇结算财务科主管 (演示席位)' },
  { username: 'demo_qual',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-demo-qua'),        staff_name: '刘建军 专员',       role: 'medical_assessor_admin',  unified_role: 'medical_assessor_admin',tenant_id: 'bureau_moumou', org_id: 'bureau_moumou', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'moumou', assigned_title: '待遇保障与资格评估科专员 / 评估师追责组 (演示席位)' },
  { username: 'demo_medical',    password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-demo-med'),        staff_name: '某某市长护监管专员',role: 'medical_insurance_staff', unified_role: 'medical_supervisor',  tenant_id: 'bureau_moumou', org_id: 'bureau_moumou', workspace: 'medical_supervision',  scope: 'pool', pool_id: 'moumou', assigned_title: '某某市医保长护综合监管全业务演示席位' },

  // ==================== 江苏省医疗保障局全局监督指导 ====================
  { username: 'province_medical', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-prov-med'),       staff_name: '省医保局长护指导组',role: 'medical_director',        unified_role: 'medical_director',    tenant_id: 'bureau',        org_id: 'bureau',        workspace: 'medical_supervision',  scope: 'global', assigned_title: '江苏省医疗保障局长护险监督指导中心' },

  // ==================== 某某市长护险受托经办机构账号群（惠生人寿（演示）· 全业务演示专区） ====================
  { username: 'demo_insurer_director', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ins-dir'),  staff_name: '赵国华 总监',       role: 'insurer_director',        unified_role: 'insurer_director',    tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool', pool_id: 'moumou', assigned_title: '受托经办项目部总监 / 经办负责人 (演示席位)' },
  { username: 'demo_insurer_intake',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ins-int'),  staff_name: '王雪梅 专员',       role: 'insurer_intake',          unified_role: 'insurer_intake',      tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool', pool_id: 'moumou', assigned_title: '业务受理与派单调度专员 / 法定回避审核 (演示席位)' },
  { username: 'demo_insurer_inspector',password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ins-insp'), staff_name: '李勇 巡查主管',      role: 'insurer_inspector',       unified_role: 'insurer_inspector',   tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool', pool_id: 'moumou', assigned_title: '现场巡查与质量飞检主管 / 物联异常核查组 (演示席位)' },
  { username: 'demo_insurer_auditor',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ins-aud'),  staff_name: '张慧敏 审核员',     role: 'insurer_auditor',         unified_role: 'insurer_auditor',     tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool', pool_id: 'moumou', assigned_title: '费用核销与结算初审员 / 物联工单核减组 (演示席位)' },
  { username: 'demo_insurer_service',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ins-srv'),  staff_name: '孙丽 专员',         role: 'insurer_service',         unified_role: 'insurer_service',     tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool', pool_id: 'moumou', assigned_title: '综合经办与客服专员 / 家属申诉初审组 (演示席位)' },

  // ==================== 宿迁市长护险受托经办试点专班（国家深化试点 · 真实 3 人服务与 3 台设备） ====================
  { username: 'suqian_insurer',        password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-ins-sq'),   staff_name: '宿迁商保经办专员',  role: 'insurer_staff',           unified_role: 'insurer_operator',    tenant_id: 'insurer_suqian',org_id: 'insurer_suqian',workspace: 'insurer_operations', scope: 'pool', pool_id: 'suqian', assigned_title: '宿迁长护险商保经办专班 (许丽/何家齐/王雪金 3台在网设备服务)' },

  // ==================== 宿迁市长护险失能评定与专家评审专班（国家深化试点 · 广济第三方评定中心） ====================
  { username: 'suqian_assessor',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-asr-sq'),    staff_name: '许建强 评定师',     role: 'assessor',                unified_role: 'assessor',            tenant_id: 'assessor_suqian',org_id: 'assessor_suqian',workspace: 'assessor_workspace',  scope: 'pool', pool_id: 'suqian', assigned_title: '国家失能等级评定师 / 主治医师 (许丽/何家齐/王雪金 现场评定责任人)' },
  { username: 'suqian_expert',         password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-exp-sq'),    staff_name: '孙建国 主任医师',   role: 'assessor_expert',         unified_role: 'assessor_expert',     tenant_id: 'assessor_suqian',org_id: 'assessor_suqian',workspace: 'assessor_workspace',  scope: 'pool', pool_id: 'suqian', assigned_title: '宿迁市长护失能评定专家委员会医学评审组长 (主任医师/神经内科)' },
  { username: 'suqian_assessor_admin', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-adm-sq'),    staff_name: '刘芳芳 质控主管',   role: 'assessor_admin',          unified_role: 'assessor_admin',      tenant_id: 'assessor_suqian',org_id: 'assessor_suqian',workspace: 'assessor_workspace',  scope: 'pool', pool_id: 'suqian', assigned_title: '宿迁广济第三方评定中心质控主管 (副主任护师)' },

  // ==================== 某某市长护险失能评定与专家委员会账号群（明康评定中心 · 全业务演示专区） ====================
  { username: 'demo_assessor',         password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-asr-demo'),  staff_name: '周海峰 评定师',     role: 'assessor',                unified_role: 'assessor',            tenant_id: 'assessor_org',   org_id: 'assessor_org',   workspace: 'assessor_workspace',  scope: 'pool', pool_id: 'moumou', assigned_title: '明康第三方失能评定中心现场评定师 (演示席位)' },
  { username: 'demo_expert',           password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-exp-demo'),  staff_name: '钱德明 主任医师',   role: 'assessor_expert',         unified_role: 'assessor_expert',     tenant_id: 'assessor_org',   org_id: 'assessor_org',   workspace: 'assessor_workspace',  scope: 'pool', pool_id: 'moumou', assigned_title: '某某市长护险评定专家委员会医学评审组长 (演示席位)' },
  { username: 'demo_assessor_admin',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-adm-demo'),  staff_name: '陈红 质控总监',     role: 'assessor_admin',          unified_role: 'assessor_admin',      tenant_id: 'assessor_org',   org_id: 'assessor_org',   workspace: 'assessor_workspace',  scope: 'pool', pool_id: 'moumou', assigned_title: '明康第三方失能评定中心质控总监 (演示席位)' },

  // 兼容别名
  { username: 'insurer01',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-insurer01'),       staff_name: '王雪梅 经办专员',   role: 'insurer_staff',           unified_role: 'insurer_operator',    tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool', pool_id: 'moumou', assigned_title: '业务受理与经办专员' },
  { username: 'assessor01',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-assessor01'),      staff_name: '长护险评估人员',    role: 'assessor',                unified_role: 'assessor',            tenant_id: 'assessor_org', org_id: 'assessor_org', workspace: 'assessor_workspace',  scope: 'task' },
  { username: 'partner_admin',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-partner01'),       staff_name: '中科智护渠道经理',  role: 'partner_admin',           unified_role: 'partner_admin',       tenant_id: 'partner_p1',   org_id: 'partner_p1',   workspace: 'partner_operations',   scope: 'channel' },
  // 家属可登录账号（阶段 D · LTC-WORKBENCH-SPEC §0.3/§4.4）：绑定+授权后进 family_workspace
  { username: 'family_demo',     password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-family-demo'),   staff_name: '许丽家属',          role: 'family_contact',           unified_role: 'family_contact',   tenant_id: 'bureau',     org_id: 'bureau',     workspace: 'family_workspace',    scope: 'applicant', applicant_ids: ['P_SQ_01'], binding_status: 'active', authorization_status: 'active', binding_valid_from: '2026-01-01T00:00:00+08:00', binding_valid_until: '2027-01-01T00:00:00+08:00' },

  // 宿迁长护险 3 名真实用户（分别绑定 suqian-dashboard 3 台在线设备：ASH01086 / ASH01078 / ASH01092）
  { username: 'xuli',            password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-xuli'),            staff_name: '许丽',              role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01086' },
  { username: 'hejiaqi',         password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-hejiaqi'),         staff_name: '何家齐',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01078' },
  { username: 'wangxuejin',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-wangxuejin'),      staff_name: '王雪金',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01092' },
  { username: 'dingzhikun',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-dingzhikun'),      staff_name: '丁志坤',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01092' },


  { username: 'assessor_liming',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-as-liming'),       staff_name: '李明 评估师',       role: 'assessor',                unified_role: 'assessor',            tenant_id: 'assessor_org',   org_id: 'assessor_org',   workspace: 'assessor_workspace', scope: 'task',     assigned_title: '上门失能评估师' },

  // ==================== 康宁护理院（演示租户 · 虚构机构）护理院全栈角色席位（多业态设计 §3.1A） ====================
  { username: 'kangning_station',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-station'),   staff_name: '康宁护理台',        role: 'nursing_station',         unified_role: 'nursing_station',     tenant_id: 'kangning', org_id: 'kangning', workspace: 'care_desk',           scope: 'org', assigned_title: '康宁护理院演示席位 · 护士站公屏（虚构机构·模拟数据）' },
  { username: 'kangning_head',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-head'),      staff_name: '钱明霞 护士长',     role: 'nursing_head',            unified_role: 'nursing_head',        tenant_id: 'kangning', org_id: 'kangning', workspace: 'care_desk',           scope: 'org', assigned_title: '康宁护理院演示席位 · 护士长（虚构机构·模拟数据）' },
  { username: 'kangning_nurse',     password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-nurse'),     staff_name: '孙丽华 护士',       role: 'nursing_nurse',           unified_role: 'nursing_nurse',       tenant_id: 'kangning', org_id: 'kangning', workspace: 'nursing_staff',       scope: 'org', assigned_title: '康宁护理院演示席位 · 责任护士（虚构机构·模拟数据）' },
  { username: 'kangning_caregiver', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-caregiver'), staff_name: '周美玲 护工',       role: 'nursing_caregiver',       unified_role: 'nursing_caregiver',   tenant_id: 'kangning', org_id: 'kangning', workspace: 'nursing_staff',       scope: 'org', assigned_title: '康宁护理院演示席位 · 管床护工（虚构机构·模拟数据）' },
  { username: 'kangning_admin',     password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-admin'),     staff_name: '冯建国 院长',       role: 'nursing_admin',           unified_role: 'nursing_admin',       tenant_id: 'kangning', org_id: 'kangning', workspace: 'nursing_home_admin',  scope: 'org', assigned_title: '康宁护理院演示席位 · 院长（虚构机构·模拟数据）' },
  { username: 'kangning_dossier',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-dossier'),   staff_name: '许静文 病案专员',   role: 'patient_dossier',         unified_role: 'patient_dossier',     tenant_id: 'kangning', org_id: 'kangning', workspace: 'patient_dossier',     scope: 'org', assigned_title: '康宁护理院演示席位 · 病案管理（虚构机构·模拟数据）' },
  { username: 'kangning_ops',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-ops'),       staff_name: '唐一鸣 物联运维',   role: 'device_user',             unified_role: 'device_user',         tenant_id: 'kangning', org_id: 'kangning', workspace: 'device_monitoring',   scope: 'org', assigned_title: '康宁护理院演示席位 · 院内物联运维（虚构机构·模拟数据）' },
  { username: 'kangning_reports',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-reports'),   staff_name: '沈慧 报表专员',     role: 'reports_center',          unified_role: 'reports_center',      tenant_id: 'kangning', org_id: 'kangning', workspace: 'reports_center',      scope: 'org', assigned_title: '康宁护理院演示席位 · 结算报表（虚构机构·模拟数据）' },
  { username: 'kangning_rehab',     password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-rehab'),     staff_name: '龚雪梅 康复师',     role: 'rehab_therapist',         unified_role: 'rehab_therapist',     tenant_id: 'kangning', org_id: 'kangning', workspace: 'rehab_studio',        scope: 'org', assigned_title: '康宁护理院演示席位 · 康复治疗师（虚构机构·模拟数据）' },
  { username: 'kangning_dementia',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-dementia'),  staff_name: '闵悦 认知症专员',   role: 'dementia_specialist',     unified_role: 'dementia_specialist', tenant_id: 'kangning', org_id: 'kangning', workspace: 'dementia_studio',     scope: 'org', assigned_title: '康宁护理院演示席位 · 认知症照护（虚构机构·模拟数据）' },
  { username: 'kangning_doctor',    password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-doctor'),    staff_name: '郑玉成 医生',       role: 'facility_doctor',         unified_role: 'facility_doctor',     tenant_id: 'kangning', org_id: 'kangning', workspace: 'facility_doctor_studio', scope: 'org', assigned_title: '康宁护理院演示席位 · 医生（虚构机构·模拟数据）' },
  { username: 'kangning_hr',        password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-hr'),        staff_name: '蔡文娟 人事',       role: 'facility_hr',             unified_role: 'facility_hr',         tenant_id: 'kangning', org_id: 'kangning', workspace: 'facility_hr_studio',  scope: 'org', assigned_title: '康宁护理院演示席位 · 人事（虚构机构·模拟数据）' },
  { username: 'kangning_finance',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-finance'),   staff_name: '范晓东 财务',       role: 'facility_finance',        unified_role: 'facility_finance',    tenant_id: 'kangning', org_id: 'kangning', workspace: 'facility_finance_studio', scope: 'org', assigned_title: '康宁护理院演示席位 · 财务（虚构机构·模拟数据）' },
  { username: 'kangning_marketing', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-marketing'), staff_name: '贾琳 营销',         role: 'facility_marketing',      unified_role: 'facility_marketing',  tenant_id: 'kangning', org_id: 'kangning', workspace: 'facility_marketing_studio', scope: 'org', assigned_title: '康宁护理院演示席位 · 营销（虚构机构·模拟数据）' },
  { username: 'kangning_affairs',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-affairs'),   staff_name: '潘慧敏 行政',       role: 'facility_admin',          unified_role: 'facility_admin',      tenant_id: 'kangning', org_id: 'kangning', workspace: 'facility_admin_studio', scope: 'org', assigned_title: '康宁护理院演示席位 · 行政（虚构机构·模拟数据）' },
  { username: 'kangning_it',        password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kn-it'),        staff_name: '戴志伟 IT',         role: 'facility_it',             unified_role: 'facility_it',         tenant_id: 'kangning', org_id: 'kangning', workspace: 'facility_it_studio',  scope: 'org', assigned_title: '康宁护理院演示席位 · IT（虚构机构·模拟数据）' },
]


// ---------- 时间工具（东八区 ISO 8601）----------
const TZ8_MS = 8 * 3600 * 1000

export function toIso8(date) {
  const t = new Date(date.getTime() + TZ8_MS)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}+08:00`
}

export function nowIso8() {
  return toIso8(new Date())
}

function todayStr8() {
  return nowIso8().slice(0, 10)
}

// ---------- 床位与楼层布局（康宁护理院 · 演示租户专用，虚构机构） ----------
// 演示楼层布局：87 在住 / 96 床位
const NURSING_DEMO_OCCUPIED_BEDS = [
  '401-A','401-B','402-A','402-B','403-A','403-B','404-A','404-B','405-A','405-B','406-A','406-B',
  '407-A','407-B','408-A','408-B','409-A','409-B','410-A','410-B','411-A','411-B',
  '301-A','301-B','302-A','302-B','303-A','303-B','304-A','304-B','305-A','305-B','306-A','306-B',
  '307-A','307-B','308-A','308-B','309-A','309-B','310-A','310-B','311-A',
  '201-A','201-B','202-A','202-B','203-A','203-B','204-A','204-B','205-A','205-B','206-A','206-B',
  '207-A','207-B','208-A','208-B','209-A','209-B','210-A','210-B','211-A','211-B',
  '101-A','101-B','102-A','102-B','103-A','103-B','104-A','104-B','105-A','105-B','106-A','106-B',
  '107-A','107-B','108-A','108-B','109-A','109-B','110-A','110-B','111-A','111-B',
]
const NURSING_DEMO_VACANT_BEDS = ['412-A','412-B','311-B','312-A','312-B','212-A','212-B','112-A','112-B']

const NURSING_DEMO_FLOOR_WARDS = {
  '4F': '完全失能专区',
  '3F': '认知障碍专区',
  '2F': '术后康复专区',
  '1F': '慢病颐养专区',
}
const NURSING_DEMO_FLOOR_CARE = { '4F': '特级护理', '3F': '一级护理', '2F': '二级护理', '1F': '二级护理' }

// 演示护理员花名池（虚构，体验域模拟数据；供 buildPatients/buildAlerts 处置人字段使用）
const NURSES = ['李春梅','王秀兰','张丽萍','赵桂芳','刘淑华','陈玉珍','杨金花','周美玲','吴丽华','郑桂英','孙玉兰','马秀珍']

const SURNAMES = ['张','李','王','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗']
const ELDER_MALE_NAMES = [
  '张卫国', '李德海', '赵德全', '郭振华', '周秉坤', '杨保国', '胡广德', '钱福祥',
  '徐建业', '林宝山', '罗长青', '梁桂生', '宋明远', '郑树清', '韩世忠', '唐学文',
  '冯守信', '于广厚', '董成志', '萧汉生', '程大伟', '曹定国', '袁有福', '邓建勋',
  '许文山', '傅立人', '沈家栋', '曾庆发', '彭绍华', '苏德良', '卢伯成', '蒋天锡',
  '蔡宏达', '贾耀东', '魏长春', '薛国安', '阎希明', '余保平', '潘文正', '杜绍基',
  '戴有德', '夏敬仁', '钟自强', '汪树荣', '田德全', '任文炳', '范承先', '方海清',
  '石广生', '姚继宗', '谭永昌', '廖德昌', '熊天祥', '金富贵', '陆正安', '郝长治',
]
const ELDER_FEMALE_NAMES = [
  '孙秀珍', '王素芬', '刘桂英', '陈金秀', '马玉兰', '黄淑琴', '高素云', '吴秀荣',
  '朱凤英', '何爱华', '梁桂珍', '唐秀英', '冯佩华', '于桂芬', '董海兰', '萧月娥',
  '程淑贤', '曹秀敏', '袁秀琴', '邓玉兰', '许秋霞', '沈荣华', '曾文英', '彭慧敏',
  '苏春霞', '卢德芳', '蒋佩兰', '贾金凤', '魏宝琴', '薛秀芹', '余秀华', '杜桂兰',
  '戴美华', '夏淑贞', '田玉珍', '任秀娥', '范秀云', '方宝珍', '石素英', '姚秀清',
  '谭玉芬', '廖桂芳', '熊秀荣', '陆淑英', '郝玉兰', '崔秀英', '江秀珍', '顾玉霞',
]
const DOCTORS = ['赵医生 (主治)', '钱主任 (副高)', '孙医生 (主治)', '李主任 (主任医师)']
const DISEASE_TAGS = ['高血压病', '冠心病', '糖尿病', '认知障碍', '脑卒中后', '慢阻肺']

// ---------- 告警文案（养老照护场景，规避 §7 合规红线用语，不写任何精确度数字）----------
const ALERT_TYPE_DEFS = {
  fall: {
    level: 1,
    title: '卫浴跌倒预警',
    details: [
      '毫米波雷达监测到卫浴间姿态突变，请护理人员立即到场查看',
      '走廊雷达监测到体态急速下坠信号，请就近护理员前往确认',
    ],
  },
  off_bed: {
    level: 2,
    title: '夜间离床预警',
    details: [
      '体征床垫监测到离床超过 15 分钟未归，请巡房确认',
      '夜间离床频次高于平时作息，建议到场陪护如厕',
    ],
  },
  hr: {
    level: 2,
    title: '心率波动提醒',
    details: [
      '夜间心率持续偏高，建议巡房关注并复测',
      '午休时段心率波动明显，请护理人员到场查看',
    ],
  },
  br: {
    level: 3,
    title: '呼吸频率提醒',
    details: [
      '睡眠时段呼吸频率较平日波动明显，建议关注',
      '呼吸节律出现短时异常波动，已记录待复核',
    ],
  },
  tp: {
    level: 3,
    title: '体温异常提醒',
    details: [
      '晨起体温偏高，建议复测并补水观察',
      '午后体温较平日偏高，请复测并记录',
    ],
  },
}

const HANDLE_NOTES = [
  '到场排查，体征平稳，已双人过床',
  '已巡房确认，长者已回床休息',
  '已复测体温，通知家属并持续观察',
  '已协助长者翻身，继续观察',
  '已到场陪护，情况平稳，已记录交班',
]

// ---------- 班次（夜班 22:00-06:00 / 早班 06:00-14:00 / 中班 14:00-22:00）----------
export function getShiftInfo(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d || !d.cfg.nurses) return null // 厂商租户无护理班次概念
  const now8 = nowIso8()
  const hour = Number(now8.slice(11, 13))
  const shift =
    hour >= 22 || hour < 6
      ? { shift_name: '夜班', shift_range: '22:00-06:00', startHour: 22 }
      : hour < 14
        ? { shift_name: '早班', shift_range: '06:00-14:00', startHour: 6 }
        : { shift_name: '中班', shift_range: '14:00-22:00', startHour: 14 }

  // 本班开始时刻（夜班在 0-6 点时，班起于前一晚 22:00）
  const today = now8.slice(0, 10)
  let shiftStartMs = Date.parse(`${today}T${String(shift.startHour).padStart(2, '0')}:00:00+08:00`)
  if (shift.startHour === 22 && hour < 6) shiftStartMs -= 24 * 3600 * 1000

  // 上一班遗留：本班开始前发生且至今未闭环的告警
  const carryOver = d.alerts.filter(
    (a) => (a.status === 'triggered' || a.status === 'handling') && Date.parse(a.occurred_at) < shiftStartMs,
  ).length

  return {
    shift_name: shift.shift_name,
    shift_range: shift.shift_range,
    nurses: d.cfg.nurses,
    carry_over_open: carryOver,
    generated_at: now8,
  }
}

// ---------- 租户数据生成 ----------
function floorOfBed(bedId) {
  return bedId.charAt(0) + 'F'
}

function buildPatients(cfg) {
  const wards = cfg.floorWards
  const cares = cfg.floorCare
  return cfg.occupiedBeds.map((bedId, i) => {
    const rnd = mulberry32(cfg.seed ^ (0x5f3a + i * 7919))
    const floor = floorOfBed(bedId)
    const abnormalPlan = cfg.abnormalPlan.find((p) => p.idx === i)
    const types = abnormalPlan ? [abnormalPlan.type] : null

    const vitals = {
      hr: abnormalPlan?.type === 'hr' ? 104 : 62 + Math.floor(rnd() * 33),
      br: 13 + Math.floor(rnd() * 8),
      tp: Math.round((36.2 + Math.floor(rnd() * 7) * 0.1) * 10) / 10,
      in_bed: abnormalPlan?.type === 'off_bed' ? false : rnd() < cfg.inBedRatio,
      body_movement: Math.floor(rnd() * 3),
      recorded_at: nowIso8(),
    }
    if (abnormalPlan?.type === 'tp') vitals.tp = 37.4
    if (abnormalPlan?.type === 'fall') vitals.in_bed = false

    const isMale = rnd() < 0.47
    const maleIdx = (i * 7 + 3) % ELDER_MALE_NAMES.length
    const femaleIdx = (i * 11 + 5) % ELDER_FEMALE_NAMES.length
    const elderName = isMale ? ELDER_MALE_NAMES[maleIdx] : ELDER_FEMALE_NAMES[femaleIdx]

    return {
      patient_id: 'P' + String(i + 1).padStart(5, '0'),
      name: elderName,
      gender: isMale ? 'male' : 'female',
      age: 68 + Math.floor(rnd() * 28),
      floor,
      care_level: cares[floor],
      ward: wards[floor],
      bed_id: bedId,
      nurse: NURSES[Math.floor(rnd() * NURSES.length)],
      doctor: DOCTORS[Math.floor(rnd() * DOCTORS.length)],
      vitals,
      abnormal: types ? { fall: types[0] === 'fall', types } : null,
    }
  })
}

function seededShuffle(arr, rnd) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildAlerts(cfg) {
  const rnd = mulberry32(cfg.seed ^ 0xa1e7)
  const today = todayStr8()
  const types = seededShuffle(cfg.alertTypes, rnd)
  const statuses = seededShuffle(cfg.alertStatuses, rnd)
  const beds = seededShuffle(cfg.occupiedBeds, rnd)

  return types.map((type, i) => {
    const def = ALERT_TYPE_DEFS[type]
    const status = statuses[i]
    // 告警时刻均匀分布在今日 00:10 起，间隔约 24h/N
    const minuteOfDay = 10 + Math.floor((i + 0.5) * ((24 * 60 - 20) / types.length))
    const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0')
    const mm = String(minuteOfDay % 60).padStart(2, '0')
    const occurred_at = `${today}T${hh}:${mm}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}+08:00`
    const nurse = NURSES[Math.floor(rnd() * NURSES.length)]

    const alert = {
      alert_id: 'A' + String(cfg.alertIdBase + i),
      bed_id: beds[i % beds.length],
      patient_id: 'P' + String((i % cfg.patientTotal) + 1).padStart(5, '0'),
      type,
      level: def.level,
      status,
      title: def.title,
      detail: def.details[Math.floor(rnd() * def.details.length)],
      occurred_at,
      claimed_by: null,
      claimed_at: null,
      handled_by: null,
      handled_at: null,
      handle_note: null,
    }
    const atMinute = (m) =>
      `${today}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00+08:00`
    if (status === 'handled') {
      // 完整链路：发生 → 接单（1-3 分钟）→ 处置闭环（再 2-12 分钟）
      const claimMinute = minuteOfDay + 1 + Math.floor(rnd() * 3)
      const handledMinute = Math.min(claimMinute + 2 + Math.floor(rnd() * 10), 24 * 60 - 1)
      alert.claimed_by = nurse
      alert.claimed_at = atMinute(claimMinute)
      alert.handled_by = nurse
      alert.handled_at = atMinute(handledMinute)
      alert.handle_note = HANDLE_NOTES[Math.floor(rnd() * HANDLE_NOTES.length)]
    } else if (status === 'handling') {
      const claimMinute = Math.min(minuteOfDay + 1 + Math.floor(rnd() * 3), 24 * 60 - 1)
      alert.claimed_by = nurse
      alert.claimed_at = atMinute(claimMinute)
    }
    return alert
  })
}

// ---------- 厂商租户：中科安樵 · 自营设备运营 ----------
// 真实硬件清单：本公司自营 7 台 AI健康守护仪（全部部署苏州），与前端 src/assets/anqiaoDevices.ts 同源。
// 合规红线：严禁写入长者姓名/年龄/护理等级/家属电话/运维专员姓名，点位仅以 label + SN 标识。
const ANQIAO_CUSTOMER = '中科安樵自营'

// 城市聚合命名与前端 GEO_HIERARCHY / 地图组件保持一致（短名 '苏州'）
const ANQIAO_CITIES = [
  { city: '苏州', lon: 120.5853, lat: 31.2990 },
  { city: '宿迁', lon: 118.2752, lat: 33.9630 },
]

// last_data_time 为 null 表示在线设备，构建时取当前时间；离线设备保留各自最近一次实际上报时刻
// label/address/lon/lat/type 与 src/assets/anqiaoDevices.ts（唯一权威数据源）逐字段一致
const ANQIAO_DEVICES = [
  {
    "sn": "ANCE00001",
    "label": "凯健国际·404",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区凯健护理院4F-404-01床",
    "lon": 120.612,
    "lat": 31.305,
    "online": true,
    "last_data_time": "2026-09-22T08:00:00+08:00"
  },
  {
    "sn": "ASH01086",
    "label": "ASH01086",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "宿迁市",
    "district": "宿城区",
    "community": "宿迁长护险试点片区",
    "address": "宿迁市宿城区项里街道长护险试点照护点01号",
    "lon": 118.28,
    "lat": 33.96,
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00"
  },
  {
    "sn": "ASH01078",
    "label": "ASH01078",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "宿迁市",
    "district": "宿城区",
    "community": "宿迁长护险试点片区",
    "address": "宿迁市宿城区双庄街道长护险试点照护点02号",
    "lon": 118.27,
    "lat": 33.965,
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00"
  },
  {
    "sn": "ASH01092",
    "label": "ASH01092",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "宿迁市",
    "district": "宿城区",
    "community": "宿迁长护险试点片区",
    "address": "宿迁市宿城区支口街道长护险试点照护点03号",
    "lon": 118.285,
    "lat": 33.955,
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00"
  },
  {
    "sn": "ASH01146",
    "label": "太湖科创中心·903",
    "type": "AI健康守护仪",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区藤器街太湖科创中心A座903室 (中科展厅总控)",
    "lon": 120.5998,
    "lat": 31.1638,
    "online": true,
    "last_data_time": "2026-09-22T23:56:08+08:00"
  },
  {
    "sn": "ASH01076",
    "label": "园区康养·815",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "苏州工业园区",
    "community": "独墅湖科教创新中心",
    "address": "苏州市苏州工业园区星湖街815号康养公寓8幢815室",
    "lon": 120.7208,
    "lat": 31.3152,
    "online": true,
    "last_data_time": "2026-09-18T08:34:58+08:00"
  },
  {
    "sn": "ASH01016",
    "label": "独墅湖科创区·206",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "苏州工业园区",
    "community": "独墅湖科教创新中心",
    "address": "苏州市苏州工业园区仁爱路独墅湖科教创新区科研楼B栋206室",
    "lon": 120.7315,
    "lat": 31.2752,
    "online": true,
    "last_data_time": "2026-08-14T02:03:42+08:00"
  },
  {
    "sn": "ANCE00003",
    "label": "园区康养·613",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "苏州工业园区",
    "community": "独墅湖科教创新中心",
    "address": "苏州市苏州工业园区星湖街613号康养公寓6幢613室",
    "lon": 120.7196,
    "lat": 31.3085,
    "online": true,
    "last_data_time": "2026-05-22T23:24:41+08:00"
  },
  {
    "sn": "ANCE00002",
    "label": "石湖金陵广场·301",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区石湖西路188号石湖金陵广场B座301室 (运维中枢)",
    "lon": 120.5856,
    "lat": 31.2389,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "ASH01118",
    "label": "石湖金陵广场·801",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区石湖西路188号石湖金陵广场A座801室",
    "lon": 120.5861,
    "lat": 31.2394,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "X2_S01B05N962",
    "label": "太湖科创中心·901",
    "type": "多模态AI守护仪样机 (X2_S01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区藤器街太湖科创中心A座901室 (研发实验室)",
    "lon": 120.5992,
    "lat": 31.1633,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01038",
    "label": "太湖科创中心·演示台",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区藤器街太湖科创中心A座9层办公区 (运营演示台)",
    "lon": 120.6004,
    "lat": 31.1643,
    "online": true,
    "last_data_time": "2026-09-22T17:28:11+08:00"
  },
  {
    "sn": "ASH01021",
    "label": "太湖科创中心·库房B",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "吴中区",
    "community": "太湖科创中心·中科展厅",
    "address": "苏州市吴中区藤器街太湖科创中心A座9层设备库房B区 (2026-09-22 新装待部署)",
    "lon": 120.601,
    "lat": 31.1648,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "41981890",
    "label": "41981890",
    "type": "健康监测仪",
    "category": "health_monitor",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "1C6920D123A0",
    "label": "1C6920D123A0",
    "type": "WiFi摔倒报警器(R1)",
    "category": "fall_detector",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "58757725",
    "label": "58757725",
    "type": "健康监测仪",
    "category": "health_monitor",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "862944067812863",
    "label": "862944067812863",
    "type": "4G摔倒报警器(R1)",
    "category": "fall_detector",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01046",
    "label": "ASH01046",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01129",
    "label": "ASH01129",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01153",
    "label": "ASH01153",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "device_001",
    "label": "device_001",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_002",
    "label": "device_002",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_003",
    "label": "device_003",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_004",
    "label": "device_004",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_005",
    "label": "device_005",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_006",
    "label": "device_006",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_007",
    "label": "device_007",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "device_008",
    "label": "device_008",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00"
  },
  {
    "sn": "ANCE00005",
    "label": "ANCE00005",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH010002",
    "label": "ASH010002",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-09-22T23:56:05+08:00"
  },
  {
    "sn": "ASH01090",
    "label": "ASH01090",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-09-04T04:11:37+08:00"
  },
  {
    "sn": "ASH01100",
    "label": "ASH01100",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-08-16T23:20:32+08:00"
  },
  {
    "sn": "ASH01006",
    "label": "ASH01006",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-09-22T23:56:07+08:00"
  },
  {
    "sn": "ASH01023",
    "label": "ASH01023",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-07-31T22:11:05+08:00"
  },
  {
    "sn": "ASH01028",
    "label": "ASH01028",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-09-13T21:15:33+08:00"
  },
  {
    "sn": "ASH01059",
    "label": "ASH01059",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01042",
    "label": "ASH01042",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-07-26T01:56:29+08:00"
  },
  {
    "sn": "ASH01025",
    "label": "ASH01025",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-07-27T04:05:17+08:00"
  },
  {
    "sn": "ASH01037",
    "label": "ASH01037",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-07-29T20:46:32+08:00"
  },
  {
    "sn": "ASH01036",
    "label": "ASH01036",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01047",
    "label": "ASH01047",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01030",
    "label": "ASH01030",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-08-18T23:06:28+08:00"
  },
  {
    "sn": "ASH01039",
    "label": "ASH01039",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-09-06T08:34:58+08:00"
  },
  {
    "sn": "ASH01033",
    "label": "ASH01033",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-08-09T20:01:07+08:00"
  },
  {
    "sn": "ASH01044",
    "label": "ASH01044",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-08-22T08:34:56+08:00"
  },
  {
    "sn": "ASH01166",
    "label": "ASH01166",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01029",
    "label": "ASH01029",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": null
  },
  {
    "sn": "ASH01156",
    "label": "ASH01156",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "city": "苏州市",
    "district": "待确认",
    "community": "在册感知片区",
    "address": "地址待确认",
    "lon": null,
    "lat": null,
    "online": true,
    "last_data_time": "2026-09-22T17:31:27+08:00"
  }
]

// 设备档案用全称 '苏州市'，城市聚合/前端层级用短名 '苏州'，匹配时视为同一城市
function sameCity(a, b) {
  return a === b || String(a).replace(/市$/, '') === String(b).replace(/市$/, '')
}

function buildVendorDevices() {
  return ANQIAO_DEVICES.map((d) => ({
    device_id: d.sn,
    sn: d.sn,
    label: d.label,
    type: d.type,
    category: d.category || 'health_guardian',
    customer: d.city === '宿迁市' ? '宿迁医保局长护险' : ANQIAO_CUSTOMER,
    city: d.city,
    district: d.district,
    community: d.community,
    address: d.address,
    lon: d.lon,
    lat: d.lat,
    online: d.online,
    alerting: false,
    last_data_time: d.last_data_time ?? nowIso8(),
  }))
}

// 设备维度告警文案（运维事件，非照护场景），绑定真实 SN
const VENDOR_ALERT_DEFS = {
  device_offline: {
    level: 2,
    title: '设备离线超时',
    details: [
      '终端超过 24 小时未上报数据，请核查设备供电与网络链路',
      '终端心跳信号丢失，请远程排查设备在线状态',
    ],
  },
  device_data: {
    level: 3,
    title: '数据采集中断',
    details: [
      '终端数据采集中断，请检查传感器与固件状态',
      '上报数据流出现异常间隙，建议远程复核采集链路',
    ],
  },
}

// 少量设备维度告警；处置主体统一为「运营中心」，严禁引用护理院护士池（NURSES）
function buildVendorAlerts(cfg) {
  const today = todayStr8()
  const at = (hm) => `${today}T${hm}:00+08:00`
  const mk = (i, sn, type, status, occurred, extra = {}) => ({
    alert_id: 'A' + String(cfg.alertIdBase + i),
    bed_id: sn,
    patient_id: '',
    type,
    level: VENDOR_ALERT_DEFS[type].level,
    status,
    title: VENDOR_ALERT_DEFS[type].title,
    detail: VENDOR_ALERT_DEFS[type].details[0],
    occurred_at: at(occurred),
    claimed_by: null,
    claimed_at: null,
    handled_by: null,
    handled_at: null,
    handle_note: null,
    city: '苏州市',
    customer: ANQIAO_CUSTOMER,
    ...extra,
  })
  return [
    mk(0, 'ASH01076', 'device_offline', 'triggered', '07:42'),
    mk(1, 'X2_S01B05N962', 'device_data', 'handling', '09:15', {
      claimed_by: '运营中心',
      claimed_at: at('09:18'),
    }),
    mk(2, 'ANCE00002', 'device_data', 'handled', '06:28', {
      title: '数据采集中断恢复',
      claimed_by: '运营中心',
      claimed_at: at('06:31'),
      handled_by: '运营中心',
      handled_at: at('06:53'),
      handle_note: '远程重启采集服务后恢复上报，持续观察中',
    }),
    mk(3, 'ASH01118', 'device_offline', 'handled', '10:05', {
      claimed_by: '运营中心',
      claimed_at: at('10:09'),
      handled_by: '运营中心',
      handled_at: at('11:26'),
      handle_note: '现场恢复供电，设备已重新上线',
    }),
  ]
}

function buildTenant(cfg) {
  if (cfg.kind === 'vendor') {
    return { cfg, patients: [], devices: buildVendorDevices(), alerts: buildVendorAlerts(cfg), liveAlertSeq: 0 }
  }
  if (!cfg.occupiedBeds) {
    // 监管/平台型租户：无病房结构与在床长者，注册存在性即可（池内数据按 pool_id 跨租户读取）
    return { cfg, patients: [], alerts: [], liveAlertSeq: 0 }
  }
  const patients = buildPatients(cfg)
  const alerts = buildAlerts(cfg)
  return { cfg, patients, alerts, liveAlertSeq: 0 }
}

export const TENANT_CONFIGS = {
  platform: {
    name: '系统组织',
    kind: 'platform',
    vertical: 'platform',
    template: null,
    deployment: 'saas',
  },
  anqiao: {
    name: '中科安樵 · 自营运营中心',
    kind: 'vendor', // 保持 vendor 兼容，auth 模块识别 anqiao_ops
    vertical: 'platform',
    template: null,
    deployment: 'saas',
    seed: 20260920,
    alertIdBase: 80001,
  },
  bureau: {
    name: '中科安樵·全域医保监管协同中心',
    kind: 'medical_bureau',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  bureau_suqian: {
    name: '宿迁市医疗保障局 / 宿迁长护险试点工作组',
    kind: 'medical_bureau',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  bureau_moumou: {
    name: '某某市医疗保障局 / 某某市长护险管理服务中心',
    kind: 'medical_bureau',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  insurer: {
    name: '惠生人寿保险股份有限公司（演示）· 某某市长护险受托经办中心',
    kind: 'insurer',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  insurer_suqian: {
    name: '中国太平洋人寿保险股份有限公司 · 宿迁长护险商保经办专班',
    kind: 'insurer',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  assessor_suqian: {
    name: '宿迁市广济第三方失能等级评定中心',
    kind: 'assessment_org',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  assessor_org: {
    name: '某某市明康第三方失能评定中心',
    kind: 'assessment_org',
    vertical: 'ltc_ecosystem',
    template: null,
    deployment: 'saas',
  },
  partner_p1: {
    name: '中科智护合作伙伴渠道',
    kind: 'partner',
    vertical: 'partner',
    template: null,
    deployment: 'saas',
  },
  cust_org01: {
    name: '示范区康养示范中心',
    kind: 'customer_org',
    vertical: 'nursing_home', // 康养示范中心归入护理院业态（业主如另划，改此行）
    template: null,
    deployment: 'saas',
  },
  kangning: {
    name: '康宁护理院（演示）', // 体验域虚构机构（业主已批准拟名），常驻演示标识
    kind: 'nursing_home',
    vertical: 'nursing_home',
    template: 'nursing_home_v1',
    deployment: 'saas',
    seed: 20260926,
    alertIdBase: 81001,
    occupiedBeds: NURSING_DEMO_OCCUPIED_BEDS,
    vacantBeds: NURSING_DEMO_VACANT_BEDS,
    floorWards: NURSING_DEMO_FLOOR_WARDS,
    floorCare: NURSING_DEMO_FLOOR_CARE,
    nurses: NURSES.length,
    inBedRatio: 0.85,
    abnormalPlan: [
      { idx: 0, type: 'hr' },
      { idx: 5, type: 'off_bed' },
      { idx: 11, type: 'fall' },
      { idx: 17, type: 'tp' },
    ],
    patientTotal: NURSING_DEMO_OCCUPIED_BEDS.length,
    alertTypes: ['fall','off_bed','hr','br','tp','fall','off_bed','hr','br','tp','off_bed','hr'],
    alertStatuses: ['handled','handled','triggered','handling','handled','missed','handled','triggered','handled','handling','handled','handled'],
  },
}

// 租户数据为可变内存态（处置写操作、WS 新告警会直接改 alerts 数组），生产换 DB。
// 全部有账号的租户都必须注册（bureau_suqian 为真实宿迁试点，此前长期缺失导致宿迁数据面 404）
const TENANT_DATA = {
  platform: buildTenant(TENANT_CONFIGS.platform),
  anqiao: buildTenant(TENANT_CONFIGS.anqiao),
  bureau: buildTenant(TENANT_CONFIGS.bureau),
  bureau_suqian: buildTenant(TENANT_CONFIGS.bureau_suqian),
  bureau_moumou: buildTenant(TENANT_CONFIGS.bureau_moumou),
  insurer: buildTenant(TENANT_CONFIGS.insurer),
  kangning: buildTenant(TENANT_CONFIGS.kangning), // 首个机构照护型租户（occupiedBeds 分支）
}


export const TENANT_IDS = Object.keys(TENANT_DATA)

export function getTenantData(tenantId) {
  return TENANT_DATA[tenantId] ?? null
}

export function getTenantName(tenantId) {
  return TENANT_CONFIGS[tenantId]?.name ?? tenantId
}

export function getTenantKind(tenantId) {
  return TENANT_CONFIGS[tenantId]?.kind ?? 'nursing_home'
}

// ---------- 多业态租户模型字段（设计 §4.1）：业态 / 租户模板 / 部署形态 ----------
export function getTenantVertical(tenantId) {
  return TENANT_CONFIGS[tenantId]?.vertical ?? 'nursing_home'
}

export function getTenantTemplate(tenantId) {
  return TENANT_CONFIGS[tenantId]?.template ?? null
}

export function getTenantDeployment(tenantId) {
  return TENANT_CONFIGS[tenantId]?.deployment ?? 'saas'
}

// ---------- Overview 实时计算（含处置/新告警后的指标变化），不硬编码 ----------
export function computeOverview(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  const { cfg, patients, alerts } = d
  const closed = alerts.filter((a) => a.status === 'handled' || a.status === 'missed').length

  // 厂商租户：自营设备聚合 + 覆盖城市数（按设备档案实际去重统计）
  if (cfg.kind === 'vendor') {
    const devices = d.devices
    const online = devices.filter((x) => x.online).length
    return {
      device_total: devices.length,
      device_online: online,
      device_online_rate: Math.round((online / devices.length) * 1000) / 10,
      patient_total: 0,
      patient_male: 0,
      patient_female: 0,
      bed_occupied: 0,
      bed_total: 0,
      alerts_today: alerts.length,
      alerts_closed_today: closed,
      in_bed_count: 0,
      in_bed_rate: 0,
      city_count: new Set(devices.map((x) => x.city)).size,
      generated_at: nowIso8(),
    }
  }

  const male = patients.filter((p) => p.gender === 'male').length
  const inBed = patients.filter((p) => p.vitals.in_bed).length
  return {
    device_total: cfg.deviceTotal,
    device_online: cfg.deviceOnline,
    device_online_rate: Math.round((cfg.deviceOnline / cfg.deviceTotal) * 1000) / 10,
    patient_total: patients.length,
    patient_male: male,
    patient_female: patients.length - male,
    bed_occupied: cfg.occupiedBeds.length,
    bed_total: cfg.bedTotal,
    alerts_today: alerts.length,
    alerts_closed_today: closed,
    in_bed_count: inBed,
    in_bed_rate: Math.round((inBed / patients.length) * 1000) / 10,
    city_count: 1,
    generated_at: nowIso8(),
  }
}

// ---------- 厂商 geo 聚合 ----------
export function getGeoCities(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d || d.cfg.kind !== 'vendor') return null
  return ANQIAO_CITIES.map((c) => {
    const devices = d.devices.filter((x) => sameCity(x.city, c.city))
    return {
      city: c.city,
      lon: c.lon,
      lat: c.lat,
      device_total: devices.length,
      device_online: devices.filter((x) => x.online).length,
      alerts_today: d.alerts.filter((a) => a.city && sameCity(a.city, c.city)).length,
      customers: [ANQIAO_CUSTOMER],
    }
  })
}

export function getGeoDevices(tenantId, city) {
  const d = TENANT_DATA[tenantId]
  if (!d || d.cfg.kind !== 'vendor') return null
  return city ? d.devices.filter((x) => sameCity(x.city, city)) : d.devices
}

// ---------- 长者画像详情扩展：24h 曲线 / 睡眠 / 慢病 / 7 天告警历史 ----------
// 曲线/睡眠/慢病由 patient_id 确定性派生（不存储），告警历史合并当日实时告警。
function buildCurves(patient, idx) {
  const rnd = mulberry32(0xc1ae ^ (idx * 2654435761))
  let hr = patient.vitals.hr
  let br = patient.vitals.br
  let tp = patient.vitals.tp
  const points = 96 // 24h，15 分钟一个点
  const hrS = [], brS = [], tpS = []
  const startMs = Date.now() - 24 * 3600 * 1000
  for (let i = 0; i < points; i++) {
    hr = Math.min(120, Math.max(50, hr + Math.round((rnd() - 0.5) * 4)))
    br = Math.min(28, Math.max(10, br + Math.round((rnd() - 0.5) * 2)))
    tp = Math.min(38, Math.max(35.8, Math.round((tp + (rnd() - 0.5) * 0.2) * 10) / 10))
    const t = toIso8(new Date(startMs + i * 15 * 60 * 1000))
    hrS.push({ t, v: hr })
    brS.push({ t, v: br })
    tpS.push({ t, v: tp })
  }
  return { hr: hrS, br: brS, tp: tpS }
}

function buildSleep(patient, idx) {
  const rnd = mulberry32(0x51eef ^ (idx * 97))
  const score = patient.abnormal ? 72 + Math.floor(rnd() * 6) : 80 + Math.floor(rnd() * 16)
  const totalMin = 420 + Math.floor(rnd() * 70)
  const deepMin = Math.round(totalMin * (0.14 + rnd() * 0.1))
  const awakeMin = 25 + Math.floor(rnd() * 20)
  const remMin = Math.round(totalMin * 0.17)
  const lightMin = totalMin - deepMin - awakeMin - remMin
  const p2 = (n) => String(n).padStart(2, '0')
  const leaveCount = patient.abnormal?.types.includes('off_bed') ? 2 : Math.floor(rnd() * 3)
  return {
    score,
    grade: score >= 88 ? '深度恢复良好' : score >= 78 ? '睡眠质量适中' : '片段化需关注',
    totalMin,
    totalHours: `${Math.floor(totalMin / 60)}h ${p2(totalMin % 60)}m`,
    bedTime: '21:' + p2(20 + Math.floor(rnd() * 30)),
    leaveTime: '06:' + p2(10 + Math.floor(rnd() * 25)),
    leaveCount,
    movement: 10 + Math.floor(rnd() * 16),
    deepPct: ((deepMin / totalMin) * 100).toFixed(1) + '%',
    stages: { deep: deepMin, light: lightMin, rem: remMin, awake: awakeMin },
  }
}

function buildDiseases(idx) {
  const rnd = mulberry32(0xd15ea5e ^ (idx * 31))
  const n = Math.floor(rnd() * 4) // 0-3 个标签
  const tags = seededShuffle(DISEASE_TAGS, rnd)
  return tags.slice(0, n)
}

function buildAlertHistory(tenantId, patient, idx) {
  const rnd = mulberry32(0xa711570 ^ (idx * 13))
  const types = Object.keys(ALERT_TYPE_DEFS)
  const history = []
  const count = 2 + (idx % 4)
  for (let k = 0; k < count; k++) {
    const type = types[Math.floor(rnd() * types.length)]
    const def = ALERT_TYPE_DEFS[type]
    const daysAgo = 1 + Math.floor(rnd() * 6)
    const date = new Date(Date.now() - daysAgo * 24 * 3600 * 1000)
    const occurred_at = toIso8(date).slice(0, 11) + `${String(1 + Math.floor(rnd() * 22)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00+08:00`
    const missed = rnd() < 0.2
    history.push({
      alert_id: 'H' + String(70000 + idx * 10 + k),
      bed_id: patient.bed_id,
      patient_id: patient.patient_id,
      type,
      level: def.level,
      status: missed ? 'missed' : 'handled',
      title: def.title,
      detail: def.details[0],
      occurred_at,
      claimed_by: missed ? null : NURSES[Math.floor(rnd() * NURSES.length)],
      claimed_at: missed ? null : occurred_at,
      handled_by: missed ? null : NURSES[Math.floor(rnd() * NURSES.length)],
      handled_at: missed ? null : occurred_at,
      handle_note: missed ? null : HANDLE_NOTES[Math.floor(rnd() * HANDLE_NOTES.length)],
    })
  }
  return history
}

export function getPatientDetail(tenantId, patientId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  const idx = d.patients.findIndex((p) => p.patient_id === patientId)
  if (idx < 0) return null
  const patient = d.patients[idx]
  // 当日实时告警 + 近 7 天历史，按发生时间倒序
  const live = d.alerts.filter((a) => a.patient_id === patientId)
  const history = [...live, ...buildAlertHistory(tenantId, patient, idx)]
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
  return {
    ...patient,
    curves: buildCurves(patient, idx),
    sleep: buildSleep(patient, idx),
    diseases: buildDiseases(idx),
    alert_history: history,
  }
}

// ---------- 楼层 / 专区 / 床位 / 统计（API-CONTRACT §3，数据源 = seed 内存态）----------
function requireNursingTenant(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  // 厂商等无床位域租户：返回空列表（不编造），调用方不 500
  if (!d.cfg.occupiedBeds) return d
  return d
}

function bedIdFloor(bedId) {
  return floorOfBed(bedId)
}

/** GET /v1/floors → [{floor, ward_count, bed_total, bed_occupied}] */
export function listFloors(tenantId) {
  const d = requireNursingTenant(tenantId)
  if (!d) return null
  if (!d.cfg.occupiedBeds) return []
  const floors = Object.keys(d.cfg.floorWards)
  return floors.map((floor) => {
    const occupied = d.cfg.occupiedBeds.filter((b) => bedIdFloor(b) === floor)
    const vacant = (d.cfg.vacantBeds || []).filter((b) => bedIdFloor(b) === floor)
    return {
      floor,
      ward_count: d.cfg.floorWards[floor] ? 1 : 0,
      bed_total: occupied.length + vacant.length,
      bed_occupied: occupied.length,
    }
  })
}

/** GET /v1/wards?floor= → [{floor, ward, nurse_count, nurse_ratio, patient_count, in_bed_count}] */
export function listWards(tenantId, floorFilter) {
  const d = requireNursingTenant(tenantId)
  if (!d) return null
  if (!d.cfg.floorWards) return []
  const wardNurse = d.cfg.wardNurse || {}
  const list = Object.entries(d.cfg.floorWards).map(([floor, ward]) => {
    const ps = d.patients.filter((p) => p.floor === floor || p.ward === ward)
    const nurse = wardNurse[floor] || { count: 0, ratio: '—' }
    return {
      floor,
      ward,
      nurse_count: nurse.count,
      nurse_ratio: nurse.ratio,
      patient_count: ps.length,
      in_bed_count: ps.filter((p) => p.vitals.in_bed).length,
    }
  })
  return floorFilter ? list.filter((w) => w.floor === floorFilter) : list
}

/** GET /v1/beds?floor=&ward= → [{bed_id, floor, ward, status, patient_id, device}] */
export function listBeds(tenantId, { floor, ward } = {}) {
  const d = requireNursingTenant(tenantId)
  if (!d) return null
  if (!d.cfg.occupiedBeds) return []
  const byBed = new Map(d.patients.map((p) => [p.bed_id, p]))
  const all = [
    ...d.cfg.occupiedBeds.map((bed_id) => ({ bed_id, status: 'occupied' })),
    ...(d.cfg.vacantBeds || []).map((bed_id) => ({ bed_id, status: 'vacant' })),
  ]
  let list = all.map(({ bed_id, status }) => {
    const f = bedIdFloor(bed_id)
    const wardName = d.cfg.floorWards[f] ?? null
    const patient = status === 'occupied' ? byBed.get(bed_id) : null
    return {
      bed_id,
      floor: f,
      ward: wardName,
      status,
      patient_id: patient?.patient_id ?? null,
      // 床位级设备绑定：种子未单独建 DeviceBinding 时为 null（不编造）
      device: null,
    }
  })
  if (floor) list = list.filter((b) => b.floor === floor)
  if (ward) list = list.filter((b) => b.ward === ward)
  return list
}

/** GET /v1/stats/demographics */
export function getDemographics(tenantId) {
  const d = requireNursingTenant(tenantId)
  if (!d) return null
  const patients = d.patients
  if (!patients.length) {
    return {
      male: 0,
      female: 0,
      avg_age: 0,
      max_age: 0,
      by_care_level: [],
      by_age_range: [],
      diseases: [],
    }
  }
  const male = patients.filter((p) => p.gender === 'male').length
  const ages = patients.map((p) => p.age)
  const careLevels = ['特级护理', '一级护理', '二级护理']
  const by_care_level = careLevels.map((level) => ({
    care_level: level,
    count: patients.filter((p) => p.care_level === level).length,
  }))
  const by_age_range = [
    { range: '60-69岁', count: ages.filter((a) => a < 70).length },
    { range: '70-79岁', count: ages.filter((a) => a >= 70 && a < 80).length },
    { range: '80-89岁', count: ages.filter((a) => a >= 80 && a < 90).length },
    { range: '90岁以上', count: ages.filter((a) => a >= 90).length },
  ]
  const diseaseCount = new Map()
  patients.forEach((p, idx) => {
    for (const tag of buildDiseases(idx)) {
      diseaseCount.set(tag, (diseaseCount.get(tag) || 0) + 1)
    }
  })
  const diseases = [...diseaseCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    male,
    female: patients.length - male,
    avg_age: Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10,
    max_age: Math.max(...ages),
    by_care_level,
    by_age_range,
    diseases,
  }
}

/** GET /v1/stats/rankings — 睡眠 / 跌倒风险 / 体征波动（均由 seed 确定性数据计算） */
export function getRankings(tenantId) {
  const d = requireNursingTenant(tenantId)
  if (!d) return null
  const base = (p) => ({
    patient_id: p.patient_id,
    name: p.name,
    bed_id: p.bed_id,
  })
  const rows = d.patients.map((p, idx) => ({ p, idx, sleep: buildSleep(p, idx) }))
  const withDelta = (value, seed) => ({ value, delta: (seed % 3) - 1 })

  const sleep = [...rows]
    .sort((a, b) => b.sleep.score - a.sleep.score)
    .slice(0, 5)
    .map((r, i) => ({
      ...base(r.p),
      ...withDelta(r.sleep.score, i + r.sleep.leaveCount),
    }))

  const fall_risk = [...rows]
    .map((r) => {
      // 确定性风险分：异常告警抬升，年龄加权；不依赖外部字段编造
      let risk = 20 + (r.p.age - 68)
      if (r.p.abnormal) risk += r.p.abnormal.fall ? 40 : 18
      if (!r.p.vitals.in_bed) risk += 8
      risk = Math.min(99, Math.max(5, risk))
      return { r, risk }
    })
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 5)
    .map((x, i) => ({
      ...base(x.r.p),
      ...withDelta(x.risk, i * 2 + 1),
    }))

  const vitalText = (p) => {
    const types = p.abnormal?.types ?? []
    if (types.includes('hr')) return { text: `${p.vitals.hr}bpm`, abnormal: true }
    if (types.includes('tp')) return { text: `${p.vitals.tp.toFixed(1)}℃`, abnormal: true }
    if (types.includes('br')) return { text: `${p.vitals.br}次/分`, abnormal: true }
    if (p.abnormal?.fall) return { text: `${p.vitals.br}次/分`, abnormal: true }
    return { text: `${p.vitals.hr}bpm`, abnormal: false }
  }
  const vitals = [...rows]
    .sort((a, b) => {
      const ab = (b.p.abnormal ? 1 : 0) - (a.p.abnormal ? 1 : 0)
      if (ab !== 0) return ab
      return b.p.vitals.hr - a.p.vitals.hr
    })
    .slice(0, 5)
    .map((r, i) => {
      const t = vitalText(r.p)
      const deviation = Math.abs(r.p.vitals.hr - 72) + (t.abnormal ? 50 : 0)
      return { ...base(r.p), ...withDelta(deviation, i), text: t.text, abnormal: t.abnormal }
    })

  return { sleep, fall_risk, vitals }
}

// ---------- 项目配置下发（API-CONTRACT §3.3 / INTEGRATION-SPEC §5.1）----------
const PROJECT_PACKAGES = JSON.parse(
  readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), 'project-config-data.json'), 'utf8'),
)

const PROJECT_SCALARS = {
  kaijian: {
    projectId: 'kaijian',
    projectTitle: '凯健护理院安守护驾驶舱',
    basePath: '/dash/',
    multiOrg: true,
    ltciArchivePanel: false,
    ltciScreen: false,
    cloudScanMode: 'writable',
  },
  suqian: {
    projectId: 'suqian',
    projectTitle: '宿迁医保局长护险首批试点',
    basePath: '/suqian-dash/',
    multiOrg: false,
    ltciArchivePanel: true,
    ltciScreen: true,
    cloudScanMode: 'compare_only',
  },
}

/** 租户 → 项目映射（跨项目 404）；宿迁试点/医保局/经办 → suqian，其余有效租户默认 kaijian */
export function projectIdForTenant(tenantId) {
  if (tenantId === 'bureau' || tenantId === 'bureau_suqian' || tenantId === 'insurer_suqian' || tenantId === 'assessor_suqian') return 'suqian'
  if (tenantId === 'anqiao' || tenantId === 'platform') return 'kaijian'
  if (tenantId === 'bureau_moumou' || tenantId === 'insurer' || tenantId === 'assessor_org' || tenantId === 'partner_p1') {
    return 'kaijian'
  }
  if (TENANT_IDS.includes(tenantId)) return 'kaijian'
  return null
}

export function getProjectConfig(tenantId) {
  const projectId = projectIdForTenant(tenantId)
  if (!projectId || !PROJECT_SCALARS[projectId] || !PROJECT_PACKAGES[projectId]) return null
  const pkg = PROJECT_PACKAGES[projectId]
  const scalar = { ...PROJECT_SCALARS[projectId] }
  let devices = pkg.devices
  // 红线：suqian cloudScanMode 恒 compare_only、devices 恒 3 台
  if (projectId === 'suqian') {
    scalar.cloudScanMode = 'compare_only'
    const SQ = ['ASH01086', 'ASH01078', 'ASH01092']
    devices = devices.filter((d) => SQ.includes(d.sn))
    if (devices.length !== 3) throw new Error('suqian devices red line: must be 3')
  }
  return {
    ...scalar,
    devices,
    orgs: pkg.orgs,
    geo: pkg.geo,
  }
}

// ---------- WS 实时数据源 ----------
// 体征随机游走：在前值附近小幅波动，返回变更payload（契约 §4 vitals 事件形状）
export function walkVitals(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d || d.patients.length === 0) return []
  const rnd = Math.random
  const picks = 1 + Math.floor(rnd() * 3)
  const updates = []
  for (let k = 0; k < picks; k++) {
    const p = d.patients[Math.floor(rnd() * d.patients.length)]
    p.vitals.hr = Math.min(120, Math.max(50, p.vitals.hr + Math.round((rnd() - 0.5) * 4)))
    p.vitals.br = Math.min(28, Math.max(10, p.vitals.br + Math.round((rnd() - 0.5) * 2)))
    p.vitals.tp = Math.min(38, Math.max(35.8, Math.round((p.vitals.tp + (rnd() - 0.5) * 0.2) * 10) / 10))
    p.vitals.body_movement = Math.floor(rnd() * 3)
    p.vitals.recorded_at = nowIso8()
    updates.push({ bed_id: p.bed_id, ...p.vitals })
  }
  return updates
}

// 生成一条新告警并真正插入租户告警数据（REST /v1/alerts 可查），返回该告警
export function generateLiveAlert(tenantId) {
  const d = TENANT_DATA[tenantId]
  if (!d) return null
  const rnd = Math.random
  const types = ['fall', 'off_bed', 'off_bed', 'hr', 'hr', 'br', 'tp']
  const type = types[Math.floor(rnd() * types.length)]
  const def = ALERT_TYPE_DEFS[type]

  // 厂商租户：设备维度告警（离线/数据中断），挂在真实在册 SN 上
  if (d.cfg.kind === 'vendor') {
    const dev = d.devices[Math.floor(rnd() * d.devices.length)]
    // 在线设备不产生离线类告警，降级为数据中断/抖动类事件，保持与在线状态自洽
    const vTypes = Object.keys(VENDOR_ALERT_DEFS)
    let vType = vTypes[Math.floor(rnd() * vTypes.length)]
    if (dev.online && vType === 'device_offline') vType = 'device_data'
    const vDef = VENDOR_ALERT_DEFS[vType]
    const alert = {
      alert_id: 'A' + String(d.cfg.alertIdBase + 1000 + d.liveAlertSeq++),
      bed_id: dev.device_id,
      patient_id: '',
      type: vType,
      level: vDef.level,
      status: 'triggered',
      title: vDef.title,
      detail: vDef.details[Math.floor(rnd() * vDef.details.length)],
      occurred_at: nowIso8(),
      claimed_by: null,
      claimed_at: null,
      handled_by: null,
      handled_at: null,
      handle_note: null,
      city: dev.city,
      customer: dev.customer,
    }
    d.alerts.push(alert)
    return alert
  }

  const p = d.patients[Math.floor(rnd() * d.patients.length)]
  const alert = {
    alert_id: 'A' + String(d.cfg.alertIdBase + 1000 + d.liveAlertSeq++),
    bed_id: p.bed_id,
    patient_id: p.patient_id,
    type,
    level: def.level,
    status: 'triggered',
    title: def.title,
    detail: def.details[Math.floor(rnd() * def.details.length)],
    occurred_at: nowIso8(),
    claimed_by: null,
    claimed_at: null,
    handled_by: null,
    handled_at: null,
    handle_note: null,
  }
  d.alerts.push(alert)
  return alert
}

// ---------- 设备资产台账（7 维归属关系 + 12 状态生命周期）----------
// 资产归属：中科安樵（anqiao）
// 平台管理：中科安樵（anqiao）
// 客户使用：某机构或家庭
// 渠道归属：某合作伙伴
// 安装位置：具体地点
// 服务对象：被照护长者
// 监控用户：授权用户
export const DEVICE_ASSETS = [
  {
    "device_id": "ANCE00001",
    "sn": "ANCE00001",
    "label": "凯健国际·404",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "scene": "康养示范点",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": "partner_p1",
    "partner_org_id": "partner_p1",
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "kaijian",
    "customer_org_id": "kaijian",
    "custodian_org_id": "kaijian",
    "monitored_subject_id": "P00084",
    "service_subject_id": "P00084",
    "device_placement_location": "苏州市吴中区凯健护理院4F-404-01床",
    "installation_site_id": "凯健国际·404",
    "monitoring_user_id": "kaijian_admin",
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-22T08:00:00+08:00",
    "lon": 120.612,
    "lat": 31.305,
    "ip": "58.211.134.52",
    "network": "专网光纤通道",
    "flagship": false,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ASH01086",
    "sn": "ASH01086",
    "label": "ASH01086",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "长护险居家监护",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "government_procurement",
    "service_provider_org_id": "bureau",
    "customer_org_id": "bureau",
    "custodian_org_id": "bureau",
    "monitored_subject_id": "P_SQ_01",
    "service_subject_id": "P_SQ_01",
    "device_placement_location": "宿迁市宿城区项里街道长护险试点照护点01号",
    "installation_site_id": "ASH01086",
    "monitoring_user_id": "xuli",
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": 118.28,
    "lat": 33.96,
    "ip": "未提供",
    "network": "物联专网 (江苏宿迁)",
    "flagship": true,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ASH01078",
    "sn": "ASH01078",
    "label": "ASH01078",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "长护险居家监护",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "government_procurement",
    "service_provider_org_id": "bureau",
    "customer_org_id": "bureau",
    "custodian_org_id": "bureau",
    "monitored_subject_id": "P_SQ_02",
    "service_subject_id": "P_SQ_02",
    "device_placement_location": "宿迁市宿城区双庄街道长护险试点照护点02号",
    "installation_site_id": "ASH01078",
    "monitoring_user_id": "hejiaqi",
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": 118.27,
    "lat": 33.965,
    "ip": "未提供",
    "network": "物联专网 (江苏宿迁)",
    "flagship": false,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ASH01092",
    "sn": "ASH01092",
    "label": "ASH01092",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "长护险居家监护",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "government_procurement",
    "service_provider_org_id": "bureau",
    "customer_org_id": "bureau",
    "custodian_org_id": "bureau",
    "monitored_subject_id": "P_SQ_03",
    "service_subject_id": "P_SQ_03",
    "device_placement_location": "宿迁市宿城区支口街道长护险试点照护点03号",
    "installation_site_id": "ASH01092",
    "monitoring_user_id": "dingzhikun",
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": 118.285,
    "lat": 33.955,
    "ip": "未提供",
    "network": "物联专网 (江苏宿迁)",
    "flagship": false,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ASH01146",
    "sn": "ASH01146",
    "label": "太湖科创中心·903",
    "type": "AI健康守护仪",
    "category": "health_guardian",
    "scene": "旗舰展厅",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": "partner_p1",
    "partner_org_id": "partner_p1",
    "procurement_channel": "channel_partner",
    "service_provider_org_id": "kaijian",
    "customer_org_id": "kaijian",
    "custodian_org_id": "kaijian",
    "monitored_subject_id": "P00084",
    "service_subject_id": "P00084",
    "device_placement_location": "苏州市吴中区藤器街太湖科创中心A座903室 (中科展厅总控)",
    "installation_site_id": "太湖科创中心·903",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-22T23:56:08+08:00",
    "lon": 120.5998,
    "lat": 31.1638,
    "ip": "58.211.134.50",
    "network": "物联专网 (苏州专线)",
    "flagship": true,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ASH01076",
    "sn": "ASH01076",
    "label": "园区康养·815",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "康养示范点",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": "partner_p1",
    "partner_org_id": "partner_p1",
    "procurement_channel": "channel_partner",
    "service_provider_org_id": "kaijian",
    "customer_org_id": "kaijian",
    "custodian_org_id": "kaijian",
    "monitored_subject_id": "P00001",
    "service_subject_id": "P00001",
    "device_placement_location": "苏州市苏州工业园区星湖街815号康养公寓8幢815室",
    "installation_site_id": "园区康养·815",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-18T08:34:58+08:00",
    "lon": 120.7208,
    "lat": 31.3152,
    "ip": "223.104.147.88",
    "network": "4G蜂窝物联网 (江苏苏州移动)",
    "flagship": false,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ASH01016",
    "sn": "ASH01016",
    "label": "独墅湖科创区·206",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "睡眠研究中心",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "gusu_assessment",
    "customer_org_id": "gusu_assessment",
    "custodian_org_id": "gusu_assessment",
    "monitored_subject_id": "P00002",
    "service_subject_id": "P00002",
    "device_placement_location": "苏州市苏州工业园区仁爱路独墅湖科教创新区科研楼B栋206室",
    "installation_site_id": "独墅湖科创区·206",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-08-14T02:03:42+08:00",
    "lon": 120.7315,
    "lat": 31.2752,
    "ip": "58.211.134.53",
    "network": "专网光纤通道 (江苏苏州电信)",
    "flagship": false,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ANCE00003",
    "sn": "ANCE00003",
    "label": "园区康养·613",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "scene": "康养示范点",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": "partner_p1",
    "partner_org_id": "partner_p1",
    "procurement_channel": "channel_partner",
    "service_provider_org_id": "cust_org01",
    "customer_org_id": "cust_org01",
    "custodian_org_id": "cust_org01",
    "monitored_subject_id": "P00012",
    "service_subject_id": "P00012",
    "device_placement_location": "苏州市苏州工业园区星湖街613号康养公寓6幢613室",
    "installation_site_id": "园区康养·613",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-05-22T23:24:41+08:00",
    "lon": 120.7196,
    "lat": 31.3085,
    "ip": "223.104.147.89",
    "network": "4G蜂窝物联网 (江苏苏州移动)",
    "flagship": false,
    "assessment_usage": "ltc_disability_assessment"
  },
  {
    "device_id": "ANCE00002",
    "sn": "ANCE00002",
    "label": "石湖金陵广场·301",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "scene": "运维中枢",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "苏州市吴中区石湖西路188号石湖金陵广场B座301室 (运维中枢)",
    "installation_site_id": "石湖金陵广场·301",
    "monitoring_user_id": "user01",
    "lifecycle_status": "shipped",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": 120.5856,
    "lat": 31.2389,
    "ip": "58.211.134.55",
    "network": "Wi-Fi局域网 (SSID: HF)",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01118",
    "sn": "ASH01118",
    "label": "石湖金陵广场·801",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "在册归档",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "苏州市吴中区石湖西路188号石湖金陵广场A座801室",
    "installation_site_id": "石湖金陵广场·801",
    "monitoring_user_id": null,
    "lifecycle_status": "installed",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": 120.5861,
    "lat": 31.2394,
    "ip": "58.211.134.56",
    "network": "Wi-Fi局域网 (SSID: HF)",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "X2_S01B05N962",
    "sn": "X2_S01B05N962",
    "label": "太湖科创中心·901",
    "type": "多模态AI守护仪样机 (X2_S01)",
    "category": "health_guardian",
    "scene": "实验室",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "苏州市吴中区藤器街太湖科创中心A座901室 (研发实验室)",
    "installation_site_id": "太湖科创中心·901",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": 120.5992,
    "lat": 31.1633,
    "ip": "58.211.134.50",
    "network": "Wi-Fi IEEE 802.11 b/g/n 2.4GHz",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01038",
    "sn": "ASH01038",
    "label": "太湖科创中心·演示台",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "办公演示",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": "P00013",
    "service_subject_id": "P00013",
    "device_placement_location": "苏州市吴中区藤器街太湖科创中心A座9层办公区 (运营演示台)",
    "installation_site_id": "太湖科创中心·演示台",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-22T17:28:11+08:00",
    "lon": 120.6004,
    "lat": 31.1643,
    "ip": "58.211.134.50",
    "network": "Wi-Fi IEEE 802.11 b/g/n 2.4GHz",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01021",
    "sn": "ASH01021",
    "label": "太湖科创中心·库房B",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "在册归档",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": "P00014",
    "service_subject_id": "P00014",
    "device_placement_location": "苏州市吴中区藤器街太湖科创中心A座9层设备库房B区 (2026-09-22 新装待部署)",
    "installation_site_id": "太湖科创中心·库房B",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": 120.601,
    "lat": 31.1648,
    "ip": "58.211.134.50",
    "network": "Wi-Fi IEEE 802.11 b/g/n 2.4GHz",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "41981890",
    "sn": "41981890",
    "label": "41981890",
    "type": "健康监测仪",
    "category": "health_monitor",
    "scene": "健康体征监测",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "41981890",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "云平台物联通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "1C6920D123A0",
    "sn": "1C6920D123A0",
    "label": "1C6920D123A0",
    "type": "WiFi摔倒报警器(R1)",
    "category": "fall_detector",
    "scene": "跌倒监测",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "gusu_assessment",
    "customer_org_id": "gusu_assessment",
    "custodian_org_id": "gusu_assessment",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "1C6920D123A0",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "Wi-Fi局域网",
    "flagship": false,
    "assessment_usage": "跌倒监测客观证据"
  },
  {
    "device_id": "58757725",
    "sn": "58757725",
    "label": "58757725",
    "type": "健康监测仪",
    "category": "health_monitor",
    "scene": "健康体征监测",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "58757725",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "云平台物联通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "862944067812863",
    "sn": "862944067812863",
    "label": "862944067812863",
    "type": "4G摔倒报警器(R1)",
    "category": "fall_detector",
    "scene": "跌倒监测",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "gusu_assessment",
    "customer_org_id": "gusu_assessment",
    "custodian_org_id": "gusu_assessment",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "862944067812863",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "4G蜂窝物联网",
    "flagship": false,
    "assessment_usage": "跌倒监测客观证据"
  },
  {
    "device_id": "ASH01046",
    "sn": "ASH01046",
    "label": "ASH01046",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01046",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01129",
    "sn": "ASH01129",
    "label": "ASH01129",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01129",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01153",
    "sn": "ASH01153",
    "label": "ASH01153",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01153",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_001",
    "sn": "device_001",
    "label": "device_001",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_001",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_002",
    "sn": "device_002",
    "label": "device_002",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_002",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_003",
    "sn": "device_003",
    "label": "device_003",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_003",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_004",
    "sn": "device_004",
    "label": "device_004",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_004",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_005",
    "sn": "device_005",
    "label": "device_005",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_005",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_006",
    "sn": "device_006",
    "label": "device_006",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_006",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_007",
    "sn": "device_007",
    "label": "device_007",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_007",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "device_008",
    "sn": "device_008",
    "label": "device_008",
    "type": "AI健康守护仪 (测试终端)",
    "category": "health_guardian",
    "scene": "测试调试",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "device_008",
    "monitoring_user_id": null,
    "lifecycle_status": "stocked",
    "online": false,
    "last_data_time": "2026-09-20T10:00:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "开发测试通道",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ANCE00005",
    "sn": "ANCE00005",
    "label": "ANCE00005",
    "type": "AI健康守护仪 (ANCE-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ANCE00005",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH010002",
    "sn": "ASH010002",
    "label": "ASH010002",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH010002",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-22T23:56:05+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01090",
    "sn": "ASH01090",
    "label": "ASH01090",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01090",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-04T04:11:37+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01100",
    "sn": "ASH01100",
    "label": "ASH01100",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01100",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-08-16T23:20:32+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01006",
    "sn": "ASH01006",
    "label": "ASH01006",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01006",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-22T23:56:07+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01023",
    "sn": "ASH01023",
    "label": "ASH01023",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01023",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-07-31T22:11:05+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01028",
    "sn": "ASH01028",
    "label": "ASH01028",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01028",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-13T21:15:33+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01059",
    "sn": "ASH01059",
    "label": "ASH01059",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01059",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01042",
    "sn": "ASH01042",
    "label": "ASH01042",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01042",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-07-26T01:56:29+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01025",
    "sn": "ASH01025",
    "label": "ASH01025",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01025",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-07-27T04:05:17+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01037",
    "sn": "ASH01037",
    "label": "ASH01037",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01037",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-07-29T20:46:32+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01036",
    "sn": "ASH01036",
    "label": "ASH01036",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01036",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01047",
    "sn": "ASH01047",
    "label": "ASH01047",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01047",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01030",
    "sn": "ASH01030",
    "label": "ASH01030",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01030",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-08-18T23:06:28+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01039",
    "sn": "ASH01039",
    "label": "ASH01039",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01039",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-06T08:34:58+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01033",
    "sn": "ASH01033",
    "label": "ASH01033",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01033",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-08-09T20:01:07+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01044",
    "sn": "ASH01044",
    "label": "ASH01044",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01044",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-08-22T08:34:56+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01166",
    "sn": "ASH01166",
    "label": "ASH01166",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01166",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01029",
    "sn": "ASH01029",
    "label": "ASH01029",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01029",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-23T14:30:00+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  },
  {
    "device_id": "ASH01156",
    "sn": "ASH01156",
    "label": "ASH01156",
    "type": "AI健康守护仪 (ASH-01)",
    "category": "health_guardian",
    "scene": "居家在册",
    "hardware_asset_owner": "anqiao",
    "asset_owner_org_id": "anqiao",
    "platform_manager_org_id": "anqiao",
    "operator_partner_id": null,
    "partner_org_id": null,
    "procurement_channel": "direct_sale",
    "service_provider_org_id": "anqiao",
    "customer_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "service_subject_id": null,
    "device_placement_location": "地址待确认",
    "installation_site_id": "ASH01156",
    "monitoring_user_id": null,
    "lifecycle_status": "monitoring",
    "online": true,
    "last_data_time": "2026-09-22T17:31:27+08:00",
    "lon": null,
    "lat": null,
    "ip": "未提供",
    "network": "物联专网",
    "flagship": false,
    "assessment_usage": "standby_pool"
  }
]

export const DEVICE_LIFECYCLE_LOGS = [
  {
    log_id: 'LOG-INIT-001',
    device_id: 'ASH01146',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'anqiao',
    location: '苏州市吴中区太湖科创中心A座903室',
    occurred_at: '2026-09-22T09:00:00+08:00',
    remark: '展厅旗舰设备完成部署并开启实时连续监测',
  },
  {
    log_id: 'LOG-INIT-002',
    device_id: 'ASH01086',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'bureau',
    location: '宿迁市宿城区项里街道01号',
    occurred_at: '2026-09-23T10:00:00+08:00',
    remark: '宿迁长护险参保人许丽居家守护设备上线并接入医保连续监测',
  },
  {
    log_id: 'LOG-INIT-003',
    device_id: 'ASH01078',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'bureau',
    location: '宿迁市宿城区双庄街道02号',
    occurred_at: '2026-09-23T10:30:00+08:00',
    remark: '宿迁长护险参保人何家齐居家守护设备上线并接入医保连续监测',
  },
  {
    log_id: 'LOG-INIT-004',
    device_id: 'ASH01092',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'bureau',
    location: '宿迁市宿城区支口街道03号',
    occurred_at: '2026-09-23T11:00:00+08:00',
    remark: '宿迁长护险参保人丁志坤居家守护设备上线并接入医保连续监测',
  },
  {
    log_id: 'LOG-INIT-005',
    device_id: 'ANCE00002',
    from_status: 'stocked',
    to_status: 'shipped',
    operator_id: 'admin01',
    organization_id: 'anqiao',
    location: '苏州市吴中区石湖西路188号B座301室',
    occurred_at: '2026-09-18T14:00:00+08:00',
    remark: '发往石湖金陵广场运维中枢',
  },
]

export const VALID_LIFECYCLE_STATUSES = [
  'stocked', 'reserved', 'shipped', 'delivered', 'installed',
  'activated', 'assigned', 'monitoring', 'suspended', 'returned',
  'repaired', 'retired'
]

export const STATUS_ALIASES = {
  in_transit: 'shipped',
  arrived_onsite: 'delivered',
  installed_configured: 'installed',
  active_monitoring: 'monitoring',
  decommissioned: 'retired',
}

export const ALLOWED_TRANSITIONS = {
  stocked: ['reserved', 'shipped', 'retired'],
  reserved: ['stocked', 'shipped'],
  shipped: ['delivered', 'returned'],
  delivered: ['installed', 'returned'],
  installed: ['activated', 'monitoring', 'returned'],
  activated: ['assigned', 'monitoring'],
  assigned: ['monitoring'],
  monitoring: ['suspended', 'returned', 'repaired', 'retired'],
  suspended: ['monitoring', 'returned', 'repaired', 'retired'],
  returned: ['stocked', 'repaired', 'retired'],
  repaired: ['stocked', 'monitoring', 'retired'],
  retired: [],
}

export function transitionDeviceLifecycle(deviceId, toStatus, operator, remark = '', location = '') {
  const dev = DEVICE_ASSETS.find((d) => d.device_id === deviceId)
  if (!dev) return { ok: false, error: '设备不存在' }

  const normTo = STATUS_ALIASES[toStatus] || toStatus
  const normFrom = STATUS_ALIASES[dev.lifecycle_status] || dev.lifecycle_status

  if (!VALID_LIFECYCLE_STATUSES.includes(normTo)) {
    return { ok: false, error: `无效的目标状态: ${toStatus}` }
  }

  const allowed = ALLOWED_TRANSITIONS[normFrom] || []
  if (!allowed.includes(normTo)) {
    return { ok: false, error: `非法生命周期状态流转: 不能从 [${dev.lifecycle_status}] 直接流转至 [${toStatus}]` }
  }

  const fromStatus = dev.lifecycle_status
  dev.lifecycle_status = toStatus
  const log = {
    log_id: 'LOG-' + Date.now().toString(36).toUpperCase(),
    device_id: deviceId,
    from_status: fromStatus,
    to_status: toStatus,
    operator_id: operator.account_id || operator.username,
    organization_id: operator.org_id || operator.tenant_id,
    occurred_at: nowIso8(),
    location: location || dev.device_placement_location || dev.installation_site_id || '',
    remark: remark || '生命周期状态流转',
  }
  DEVICE_LIFECYCLE_LOGS.push(log)
  return { ok: true, device: dev, log }
}

// ---------- 合作伙伴渠道数据 ----------
export const PARTNER_CHANNELS = [
  {
    partner_org_id: 'partner_p1',
    partner_name: '中科智护合作伙伴渠道',
    developed_customers: [
      {
        org_id: 'cust_org01',
        referrer_partner_id: 'partner_p1',
        org_name: '苏州相城康养示范中心',
        contact: '刘经理',
        phone: '138****9988',
        devices_count: 2,
        active_monitoring: 1,
        created_at: '2026-08-10T10:00:00+08:00',
      },
      {
        org_id: 'cust_org02',
        referrer_partner_id: 'partner_p1',
        org_name: '苏州工业园区邻里照护站',
        contact: '陈主任',
        phone: '139****1234',
        devices_count: 5,
        active_monitoring: 4,
        created_at: '2026-09-01T14:00:00+08:00',
      }
    ],
    leads: [
      {
        lead_id: 'LEAD-001',
        name: '姑苏区社区长者日照中心',
        contact: '周院长',
        status: '洽谈中',
        estimated_devices: 15,
        updated_at: '2026-09-18T14:30:00+08:00',
      },
      {
        lead_id: 'LEAD-002',
        name: '常熟虞山健康颐养中心',
        contact: '张总监',
        status: '意向明确',
        estimated_devices: 30,
        updated_at: '2026-09-21T09:15:00+08:00',
      },
    ],
  },
]

export { SURNAMES }
