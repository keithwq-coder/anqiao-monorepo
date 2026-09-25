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
  // 静态档案值（仅演示机构使用）；真实机构的在线率一律由共享遥测 store 实算，严禁用此字段展示
  deviceOnlineRate?: string
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
    name: '宿迁医保局首批测试项目',
    title: '宿迁医保局首批测试项目',
    subTitle: 'SUQIAN HEALTHCARE SECURITY BUREAU · LTCI SMART SUPERVISION & ANTI-FRAUD PLATFORM',
    coords: 'GRID: 33.9619° N, 118.2751° E · SUQIAN PILOT · 3 SENSORS REGISTERED',
    // 静态兜底文案：大屏跑马灯由 App.vue 按共享遥测 store 实算（liveDeviceCount），此串不直接渲染
    ticker: '宿迁长护险首批智能监管试点 · 在册感知设备 3 台 · 参保档案与服务打卡数据待医保局平台对接',
    deviceTotal: 3, // 首批试点 3 台真实在册 AI健康守护仪
    // 在线数/在线率不写死：全视图由共享遥测 store（liveDeviceCount，5s 轮询）实算
    twinTitle: '宿迁长护险试点 · 居家设备点位孪生',
    twinDescription: '首批 3 台在册感知设备点位分布与在线状态，专网全链路畅通',
  },
}
