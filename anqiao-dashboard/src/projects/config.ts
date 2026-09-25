/**
 * 项目配置包（INTEGRATION-SPEC §5 / §5.1）
 * 构建期 VITE_PROJECT=kaijian|suqian 选择；运行期 /v1/project/config（✅）就绪后优先吃后端下发。
 */

export type ProjectId = 'kaijian' | 'suqian'
export type CloudScanMode = 'writable' | 'compare_only'

export interface ProjectConfig {
  projectId: ProjectId
  projectTitle: string
  basePath: string
  /** 多机构切换；false 锁定单一项目 */
  multiOrg: boolean
  /** 长护险参保档案面板（未获取字段恒为 null） */
  ltciArchivePanel: boolean
  /** 第六屏长护险监管屏 */
  ltciScreen: boolean
  /** 云扫描：suqian 只比对不写回（红线） */
  cloudScanMode: CloudScanMode
}

const KAIJIAN: ProjectConfig = {
  projectId: 'kaijian',
  projectTitle: '凯健护理院安守护驾驶舱',
  basePath: '/dash/',
  multiOrg: true,
  ltciArchivePanel: false,
  ltciScreen: false,
  cloudScanMode: 'writable',
}

const SUQIAN: ProjectConfig = {
  projectId: 'suqian',
  projectTitle: '宿迁医保局长护险首批试点',
  basePath: '/suqian-dash/',
  multiOrg: false,
  ltciArchivePanel: true,
  ltciScreen: true,
  // 红线：云扫描只比对不写回——在册设备恒为试点 3 台
  cloudScanMode: 'compare_only',
}

const PROJECTS: Record<ProjectId, ProjectConfig> = { kaijian: KAIJIAN, suqian: SUQIAN }

/** 当前项目配置（构建期 __VITE_PROJECT__ 由 vite.config define 注入） */
export const PROJECT: ProjectConfig =
  PROJECTS[(typeof __VITE_PROJECT__ !== 'undefined' ? __VITE_PROJECT__ : 'kaijian') as ProjectId] ?? KAIJIAN

export function isSuqian(): boolean {
  return PROJECT.projectId === 'suqian'
}
