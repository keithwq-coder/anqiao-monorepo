// 宿迁医保局长护险首批测试项目 · 4 级全景层级数据
// 宿迁 1 城 · 3 台真实在册设备 -> 城市 -> 区县 -> 社区/点位 -> 楼栋 -> 单台设备
// 设备真实字段（SN/型号/网络通道/在线状态）以 ./anqiaoDevices.ts 为唯一权威数据源。
// 合规红线：严禁出现任何人名（长者/家属/护理员）、年龄、性别、护理等级与联系方式；
// 责任人字段一律为岗位名"运营中心"；设备坐标未确认（lon/lat=null），禁止伪造落点；
// 离线/在册设备不伪造体征（vitals 归零 + 状态注明无实时遥测）。

export interface DeviceVitals {
  hr: number
  br: number
  tp: number
  in_bed: boolean
  status_desc: string
  body_movement: number
}

export interface UnitDevice {
  device_id: string
  sn: string
  label: string        // 点位短名，与 anqiaoDevices.ts 中 ANQIAO_DEVICES 按 SN 一一对应
  type: string
  firmware: string
  building: string
  room: string
  vitals: DeviceVitals
  online: boolean
  alerting: boolean
  alert_type?: 'fall' | 'hr' | 'br' | 'off_bed'
  alert_title?: string
  last_report_time: string
  installer: string
  installed_at: string
  ip?: string
  lan_ip?: string
  network?: string
  mac?: string
  category?: string
  userId?: number
  lon?: number | null
  lat?: number | null
}

export interface CommunityDetail {
  id: string
  name: string
  address: string
  district: string
  city: string
  device_total: number
  device_online: number
  alerts_today: number
  grid_manager: string
  nurse_in_charge: string
  contact_phone: string
  buildings: string[]
  devices: UnitDevice[]
}

export interface DistrictDetail {
  id: string
  name: string
  city: string
  lon: number
  lat: number
  device_total: number
  device_online: number
  alerts_today: number
  communities: CommunityDetail[]
}

export interface CityHierarchy {
  city: string
  lon: number
  lat: number
  device_total: number
  device_online: number
  alerts_today: number
  districts: DistrictDetail[]
}

// ----------------------------------------------------
// 宿迁 1 城、1 待确认片区、1 在册待确认点位、3 台真实在册设备完整全集
// （ASH01086 旗舰 / ASH01078 / ASH01092，均为 AI健康守护仪 ASH-01，坐标待确认）
// ----------------------------------------------------
const REGISTERED_VITALS: DeviceVitals = {
  hr: 0,
  br: 0,
  tp: 0,
  in_bed: false,
  status_desc: '在册归档 · 无实时遥测',
  body_movement: 0,
}

function makePilotDevice(sn: string): UnitDevice {
  return {
    device_id: sn,
    sn,
    label: sn,
    type: 'AI健康守护仪 (ASH-01)',
    category: 'health_guardian',
    firmware: '未提供',
    building: '待确认',
    room: '待确认',
    vitals: { ...REGISTERED_VITALS },
    online: false,
    alerting: false,
    last_report_time: '',
    installer: '运营中心',
    installed_at: '待确认',
    ip: '未提供',
    network: '物联专网',
    userId: 55,
    lon: null,
    lat: null,
  }
}

export const GEO_HIERARCHY: CityHierarchy[] = [
  {
    city: '宿迁市',
    lon: 118.2752,
    lat: 33.9630,
    device_total: 3,
    device_online: 0, // 初始 0，运行时由共享遥测 store（presenceOf）实算
    alerts_today: 0,
    districts: [
      {
        id: 'sq_unconfirmed',
        name: '待确认片区',
        city: '宿迁市',
        lon: 118.2752, // 设备坐标未确认，片区暂落宿迁市中心点（真实城市坐标，非设备落点）
        lat: 33.9630,
        device_total: 3,
        device_online: 0,
        alerts_today: 0,
        communities: [
          {
            id: 'comm_sq_unconfirmed',
            name: '宿迁长护险首批试点 · 在册待确认点位',
            address: '地址待确认',
            district: '待确认',
            city: '宿迁市',
            device_total: 3,
            device_online: 0,
            alerts_today: 0,
            grid_manager: '运营中心',
            nurse_in_charge: '运营中心',
            contact_phone: '运营中心',
            buildings: ['待确认'],
            devices: [
              makePilotDevice('ASH01086'),
              makePilotDevice('ASH01078'),
              makePilotDevice('ASH01092'),
            ],
          },
        ],
      },
    ],
  },
]

// 展平获取所有区县
export function getAllDistricts(): DistrictDetail[] {
  const list: DistrictDetail[] = []
  for (const c of GEO_HIERARCHY) {
    list.push(...c.districts)
  }
  return list
}

// 展平获取所有社区/点位
export function getAllCommunities(): CommunityDetail[] {
  const list: CommunityDetail[] = []
  for (const c of GEO_HIERARCHY) {
    for (const d of c.districts) {
      list.push(...d.communities)
    }
  }
  return list
}

// 展平获取所有单台设备
export function getAllHierarchyDevices(): UnitDevice[] {
  const list: UnitDevice[] = []
  for (const c of GEO_HIERARCHY) {
    for (const d of c.districts) {
      for (const m of d.communities) {
        list.push(...m.devices)
      }
    }
  }
  return list
}
