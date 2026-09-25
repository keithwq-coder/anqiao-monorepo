// kaijian 项目：无长护险参保档案面板（INTEGRATION-SPEC §5：ltciArchivePanel=false）
// 统一再导出占位，保证两项目包导出面一致。
export const MISSING_TEXT = '未获取'
export const MISSING_HINT = '待医保局长护险档案平台对接'

export interface LtciArchive {
  sn: string
  elderName: string | null
  gender: string | null
  age: number | null
  idNumber: string | null
  phone: string | null
  disabilityLevel: string | null
  assessOrg: string | null
  assessDate: string | null
  medicalRecord: string | null
  chronicDiseases: string | null
  serviceOrg: string | null
  insurerOrg: string | null
  benefitLevel: string | null
  notes: string | null
}

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
    insurerOrg: null,
    benefitLevel: null,
    notes: null,
  }
}

export function archiveOrMissing(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === '' ? MISSING_TEXT : String(v)
}

export function isMissing(v: string | number | null | undefined): boolean {
  return v === null || v === undefined || v === ''
}

export type ArchiveStatus = 'pending' | 'partial' | 'complete'
export function archiveStatusOf(_archive: LtciArchive): ArchiveStatus {
  return 'pending'
}
