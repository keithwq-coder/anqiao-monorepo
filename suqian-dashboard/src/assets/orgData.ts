// 宿迁医保局长护险首批测试项目 · 单一项目配置
// 仅保留 anqiao（首批试点 3 台真实在册 AI健康守护仪：ASH01086 / ASH01078 / ASH01092）。
// 凯健国际护理院演示机构已彻底移除；URL 不再支持 ?org 多机构切换。
// 合规红线：严禁出现任何人名（长者/家属/护理员），个人档案字段一律"未获取"（见 ltciArchive.ts）。

export type OrgType = 'national_iot'

export interface DeviceBreakdown {
  guardians: { total: number; online: number; offlineNote: string }   // AI健康守护仪（1 位长者 1 台，存在未开机/未使用）
  fallRadars: { total: number; online: number; spaces: string }       // 跌倒报警器（按空间部署：卫生间必装，卧室/餐厅/客厅选配）
}

export interface OrgProfile {
  id: string
  type: OrgType
  // 项目定性：home = 居家类（长护险居家上门服务对象，设备部署于参保长者居所/测试点位）
  kind: 'home'
  name: string
  title: string
  subTitle: string
  coords: string
  ticker: string
  deviceTotal: number
  deviceOnlineRate: string
  deviceBreakdown?: DeviceBreakdown
  twinTitle: string
  twinDescription: string
}

export const ORG_PROFILES: Record<string, OrgProfile> = {
  // 宿迁医保局首批测试项目 · 长护险智能监管试点（3 台真实在册 AI健康守护仪）
  anqiao: {
    id: 'anqiao',
    type: 'national_iot',
    kind: 'home',
    name: '宿迁长护险智慧守护平台',
    title: '宿迁长护险智慧守护平台',
    subTitle: 'SUQIAN LONG-TERM CARE INSURANCE · SMART CARE & ANTI-FRAUD PLATFORM',
    coords: 'GRID: 33.9619° N, 118.2751° E · SUQIAN · 3 SENSORS REGISTERED',
    // 静态兜底（App.vue 以遥测实算覆盖）：只写运行态，不写营销空话
    ticker: '监测窗 20:00–次日 08:00 · 体征采集进行中',
    deviceTotal: 3, // 首批试点 3 台真实在册 AI健康守护仪
    deviceOnlineRate: '100.0',
    deviceBreakdown: {
      guardians: { total: 3, online: 0, offlineNote: '以遥测实算为准' },
      fallRadars: { total: 0, online: 0, spaces: '暂未部署' },
    },
    twinTitle: '宿迁长护险 · 居家设备点位孪生',
    twinDescription: '在册点位与在线状态',
  },
}
