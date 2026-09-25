// 中科安樵多机构深度配置与资产部署字典
// 保留 2 个大屏单位：kaijian 凯健国际护理院（机构类，虚构演示数据）与
// anqiao 中科安樵（居家类，本公司自营 47 台真实在册感知设备，苏州部署，真实 SN/IP/地址）。
// anqiao 口径严禁出现任何人名（长者/家属/运维专员），责任人一律以岗位名代替。

export type OrgType = 'nursing_home' | 'national_iot'

export interface InstitutionalCampus {
  id: string
  name: string
  city: string
  lon: number
  lat: number
  bedsTotal: number
  bedsOccupied: number
  alertsToday: number
  nurseHead: string
}

export interface DeviceBreakdown {
  guardians: { total: number; online: number; offlineNote: string }   // AI健康守护仪（1 位长者 1 台，存在未开机/未使用）
  fallRadars: { total: number; online: number; spaces: string }       // 跌倒报警器（按空间部署：卫生间必装，卧室/餐厅/客厅选配）
}

export interface OrgProfile {
  id: string
  type: OrgType
  // 机构定性：institution = 机构类（凯健护理院）；home = 居家类（中科安樵自营居家点位）
  kind: 'institution' | 'home'
  name: string
  title: string
  subTitle: string
  coords: string
  ticker: string
  deviceTotal: number
  // 静态档案值（仅演示机构使用）；真实机构的在线率一律由共享遥测 store 实算，严禁用此字段展示
  deviceOnlineRate?: string
  deviceBreakdown?: DeviceBreakdown
  // 在册长者数（仅机构类口径，与设备数严格分离；居家类不提供该字段）
  elderlyTotal?: number
  twinTitle: string
  twinDescription: string
  // 仅单体/连锁机构拥有的院区列表
  campuses?: InstitutionalCampus[]
}

export const ORG_PROFILES: Record<string, OrgProfile> = {
  // 1. 中科安樵·居家守护运营（自营 47 台真实在册设备 · 包含AI健康守护仪、健康监测仪、跌倒报警器）
  anqiao: {
    id: 'anqiao',
    type: 'national_iot',
    kind: 'home',
    name: '中科安樵·居家守护运营',
    title: '中科安樵',
    subTitle: 'ANQIAO HOME GUARDIAN IOT · TELEMETRY OPERATIONS CENTER',
    coords: 'GRID: 31.2990° N, 120.5853° E · SUZHOU CORE · 47 SENSORS ACTIVE',
    // 静态兜底文案：大屏跑马灯对 anqiao 已改由 App.vue 按共享遥测 store 实算（liveDeviceCount），此串不直接渲染
    ticker: '在册感知设备 47 台 · 专网全链路畅通 · 24小时守护中',
    deviceTotal: 47, // 官方硬件平台 47 台真实在册感知设备
    // 在线数/在线率不写死：全视图由共享遥测 store（liveDeviceCount，5s 轮询）实算
    twinTitle: '中科安樵 · 居家设备点位孪生',
    twinDescription: '全域 47 台在册感知设备点位分布与在线状态，专网全链路畅通',
  },

  // 2. 凯健国际护理院（单体医养机构模式）
  kaijian: {
    id: 'kaijian',
    type: 'nursing_home',
    kind: 'institution',
    name: '凯健国际护理院',
    title: '凯健护理院安守护系统',
    subTitle: 'KAIJIAN CARE · 100-INCH EXECUTIVE BIO-TWIN v6.0',
    coords: 'GRID: 31.2304° N, 121.4737° E · SHANGHAI KAIJIAN SECTOR · ZERO ACCIDENTS',
    ticker: '全院 87 位长者生命体征持续受护 · 在网终端 139 台 (守护仪87+报警器52) · 医护全勤值守',
    deviceTotal: 139, // 守护仪 87 + 跌倒报警器 52
    elderlyTotal: 87,
    deviceOnlineRate: '97.8', // 在线 136 / 离线 3
    deviceBreakdown: {
      guardians: { total: 87, online: 84, offlineNote: '2 未开机 · 1 离线 · 1 维修' },
      fallRadars: { total: 52, online: 52, spaces: '病房卫浴44 · 餐厅2 · 康复厅2 · 公共浴室4' },
    },
    twinTitle: '凯健国际 · 康复护理专区数字孪生',
    twinDescription: '高精度 CAD 建筑室内空间孪生，8 间重照护病房、16 张全功能监测床位与卫浴雷达防跌倒监测',
    campuses: [
      { id: 'kj-ht', name: '凯健华亭总院（徐汇）', city: '上海市', lon: 121.4421, lat: 31.1873, bedsTotal: 87, bedsOccupied: 85, alertsToday: 4, nurseHead: '李晓芳 护士长' },
      { id: 'kj-hp', name: '凯健华鹏院区（浦东）', city: '上海市', lon: 121.5312, lat: 31.2054, bedsTotal: 65, bedsOccupied: 61, alertsToday: 2, nurseHead: '张敏 护士长' },
      { id: 'kj-hz', name: '凯健华展院区（闵行）', city: '上海市', lon: 121.4285, lat: 31.1345, bedsTotal: 48, bedsOccupied: 45, alertsToday: 1, nurseHead: '陈晨 护士长' },
    ],
  },
}
