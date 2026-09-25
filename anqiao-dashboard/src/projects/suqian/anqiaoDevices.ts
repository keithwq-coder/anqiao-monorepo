// ============================================================
// 宿迁医保局长护险首批测试项目 · 在册感知设备清单 —— 全项目唯一权威数据源
// 来源：云平台全账号扫描 (user_id 1~250) + 本地在册台账
// 当前试点仅保留 3 台 AI健康守护仪（ASH01086 / ASH01078 / ASH01092）。
// 合规红线：严禁出现任何人名（长者/家属/护理员）、年龄、性别、
// 护理等级、联系方式；个人档案字段一律"未获取"（见 ltciArchive.ts）。
// ============================================================

export type DeviceCategory = 'health_guardian' | 'health_monitor' | 'fall_detector' | 'unknown'

export interface AnqiaoDevice {
  sn: string
  label: string        // 点位短名，由真实地址提炼或设备别名/SN
  city: string         // 如 '宿迁市'
  district: string     // 如 '宿城区' 或 '待确认'
  address: string      // 真实部署地址全量，无真实地址显示 '地址待确认'
  lon: number | null   // 无可靠坐标使用 null，禁止伪造
  lat: number | null   // 无可靠坐标使用 null，禁止伪造
  ip: string           // 云平台未提供则使用 '未提供'，禁止伪造
  network: string      // 网络通道，如 '物联专网' / '4G蜂窝物联网'
  model: string        // 设备型号或产品名称
  category: DeviceCategory // 原始设备类别
  scene: string        // 部署场景，如 '居家在册' / '康养示范点' / '跌倒监测'
  online: boolean      // 初始标记，运行时由实时数据动态决定
  flagship: boolean    // 仅 ASH01086 为 true（默认画像选中设备）
  userId: number       // 绑定云账号 ID
  alias: string        // 设备别名，没有则使用 SN
  latestDataTime: string | null // 云平台最后上报时间
  registered: boolean  // 固定 true
}

export const ANQIAO_DEVICES: AnqiaoDevice[] = [
  {
    sn: "ASH01086",
    label: "ASH01086",
    city: "宿迁市",
    district: "待确认",
    address: "地址待确认",
    lon: null,
    lat: null,
    ip: "未提供",
    network: "物联专网",
    model: "AI健康守护仪 (ASH-01)",
    category: "health_guardian",
    scene: "居家在册",
    online: false,
    flagship: true,
    userId: 55,
    alias: "ASH01086",
    latestDataTime: null,
    registered: true,
  },
  {
    sn: "ASH01078",
    label: "ASH01078",
    city: "宿迁市",
    district: "待确认",
    address: "地址待确认",
    lon: null,
    lat: null,
    ip: "未提供",
    network: "物联专网",
    model: "AI健康守护仪 (ASH-01)",
    category: "health_guardian",
    scene: "居家在册",
    online: false,
    flagship: false,
    userId: 55,
    alias: "ASH01078",
    latestDataTime: null,
    registered: true,
  },
  {
    sn: "ASH01092",
    label: "ASH01092",
    city: "宿迁市",
    district: "待确认",
    address: "地址待确认",
    lon: null,
    lat: null,
    ip: "未提供",
    network: "物联专网",
    model: "AI健康守护仪 (ASH-01)",
    category: "health_guardian",
    scene: "居家在册",
    online: false,
    flagship: false,
    userId: 55,
    alias: "ASH01092",
    latestDataTime: null,
    registered: true,
  },
]

export function getAnqiaoDevice(sn: string): AnqiaoDevice | undefined {
  return ANQIAO_DEVICES.find((d) => d.sn === sn)
}

export const ANQIAO_ONLINE_COUNT: number = ANQIAO_DEVICES.filter((d) => d.online).length
