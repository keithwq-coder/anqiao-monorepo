// ============================================================
// 宿迁医保局长护险（LTCI）参保人档案模型 —— 全项目唯一档案口径
// 合规红线（用户拍板）：参保人姓名、年龄、病历、护理员、经办机构等
// 个人档案信息，未拿到真实数据的字段一律为 null，UI 统一显示
// "未获取"（MISSING_TEXT），严禁任何形式的模拟/编造填充。
// 已拿到真实来源的字段登记在下方 ARCHIVE_RECORDS（如 ASH01092 → 丁志坤），
// 档案字段结构完整保留，随医保局档案平台对接逐字段补全。
// ============================================================

// 档案字段缺失时的统一显示文案
export const MISSING_TEXT = '暂无数据'
// 缺失字段的统一悬停说明
export const MISSING_HINT = '档案信息完善中'

// 参保人长护险档案（按绑定设备 SN 关联）
export interface LtciArchive {
  sn: string                     // 绑定感知设备 SN（真实，唯一已确认字段）
  // ---- 参保人基本信息（未拿到，全部 null）----
  elderName: string | null       // 参保长者姓名
  gender: string | null          // 性别
  age: number | null             // 年龄
  idNumber: string | null        // 身份证号 / 医保编号
  phone: string | null           // 联系电话
  // ---- 失能评估与病历（未拿到，全部 null）----
  disabilityLevel: string | null // 失能等级认定（如 重度Ⅰ级/Ⅱ级）
  assessOrg: string | null       // 评估机构
  assessDate: string | null      // 评估日期
  medicalRecord: string | null   // 病历 / 临床诊断
  chronicDiseases: string | null // 慢病共病情况
  // ---- 服务与经办（未拿到，全部 null）----
  serviceOrg: string | null      // 定点护理服务机构
  caregiver: string | null       // 护理员
  handlingAgency: string | null  // 经办机构
  benefitStandard: string | null // 待遇标准（元/月）
  servicePlan: string | null     // 服务计划（频次/时长）
}

// ============================================================
// 已确认的真实档案记录（仅填写拿到真实来源的字段，其余保持 null）
// ASH01086：参保人 许丽（2026-09-23 用户提供）
// ASH01078：参保人 何家齐（2026-09-23 用户提供）
// ASH01092：参保人 丁志坤（2026-09-23 用户提供）
// ============================================================
const ARCHIVE_RECORDS: Record<string, Partial<Omit<LtciArchive, 'sn'>>> = {
  ASH01086: { elderName: '许丽' },
  ASH01078: { elderName: '何家齐' },
  ASH01092: { elderName: '丁志坤' },
}

// 为指定设备 SN 生成档案：字段齐全；已确认字段填真实值，未拿到的为 null（即"未获取"）
export function getLtciArchive(sn: string): LtciArchive {
  return {
    sn,
    elderName: null,
    gender: null,
    age: null,
    idNumber: null,
    phone: null,
    disabilityLevel: null,
    assessOrg: null,
    assessDate: null,
    medicalRecord: null,
    chronicDiseases: null,
    serviceOrg: null,
    caregiver: null,
    handlingAgency: null,
    benefitStandard: null,
    servicePlan: null,
    ...ARCHIVE_RECORDS[sn],
  }
}

// 档案值显示辅助：null/空串 → MISSING_TEXT，否则返回原值字符串
export function archiveOrMissing(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return MISSING_TEXT
  return String(v)
}

// 字段是否缺失（模板条件套 .missing-val 用）
export function isMissing(v: string | number | null | undefined): boolean {
  return v === null || v === undefined || v === ''
}

// 档案整体对接状态：全部缺失 → pending；部分建档 → partial；无缺失 → complete
export type ArchiveStatus = 'pending' | 'partial' | 'complete'
export function archiveStatusOf(archive: LtciArchive): ArchiveStatus {
  const values = Object.entries(archive)
    .filter(([k]) => k !== 'sn')
    .map(([, v]) => v)
  const filled = values.filter((v) => !isMissing(v)).length
  if (filled === 0) return 'pending'
  return filled === values.length ? 'complete' : 'partial'
}
