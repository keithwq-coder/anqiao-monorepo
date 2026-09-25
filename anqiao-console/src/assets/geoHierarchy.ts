// 中科安樵居家守护设备 4 级全景层级数据
// 苏州 1 城 · 7 台真实设备 -> 城市 -> 区县 -> 社区/点位 -> 楼栋 -> 单台设备
// 设备真实字段（SN/地址/IP/型号/网络通道/在线状态）以 ./anqiaoDevices.ts 为唯一权威数据源。
// 合规红线：严禁出现任何人名（长者/家属/运维专员）、年龄、性别、护理等级与联系方式；
// 责任人字段一律为岗位名“运营中心”；离线/在册设备不伪造体征（vitals 归零 + 状态注明无实时遥测）。

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
// 苏州 1 城、2 区县、5 点位、7 台真实在册设备完整全集
// ----------------------------------------------------
export const GEO_HIERARCHY: CityHierarchy[] = [
  {
    "city": "宿迁",
    "lon": 118.2752,
    "lat": 33.963,
    "device_total": 3,
    "device_online": 3,
    "alerts_today": 0,
    "districts": [
      {
        "id": "sq_sucheng",
        "name": "宿城区",
        "city": "宿迁",
        "lon": 118.2752,
        "lat": 33.963,
        "device_total": 3,
        "device_online": 3,
        "alerts_today": 0,
        "communities": [
          {
            "id": "comm_sq_ltci",
            "name": "宿迁市长护险试点服务中心",
            "address": "宿迁市宿城区长护险在册照护点",
            "district": "宿城区",
            "city": "宿迁",
            "device_total": 3,
            "device_online": 3,
            "alerts_today": 0,
            "grid_manager": "宿迁医保中心",
            "nurse_in_charge": "宿迁长护照护中心",
            "contact_phone": "0527-84381234",
            "buildings": [
              "长护险试点照护区"
            ],
            "devices": [
              {
                "device_id": "ASH01086",
                "sn": "ASH01086",
                "label": "ASH01086 (许丽)",
                "type": "AI健康守护仪 (ASH-01)",
                "firmware": "v3.3.43",
                "building": "项里街道长护点",
                "room": "01室",
                "vitals": {
                  "hr": 75,
                  "br": 18,
                  "tp": 36.5,
                  "in_bed": true,
                  "status_desc": "实时在床监护中",
                  "body_movement": 1
                },
                "online": true,
                "alerting": false,
                "last_report_time": "2026-09-23 14:30:00",
                "installer": "宿迁医保长护运维组",
                "installed_at": "2026-04-23",
                "ip": "物联专网 (宿迁)",
                "network": "物联专网"
              },
              {
                "device_id": "ASH01078",
                "sn": "ASH01078",
                "label": "ASH01078 (何家齐)",
                "type": "AI健康守护仪 (ASH-01)",
                "firmware": "v3.3.43",
                "building": "双庄街道长护点",
                "room": "02室",
                "vitals": {
                  "hr": 78,
                  "br": 19,
                  "tp": 36.6,
                  "in_bed": true,
                  "status_desc": "实时在床监护中",
                  "body_movement": 1
                },
                "online": true,
                "alerting": false,
                "last_report_time": "2026-09-23 14:30:00",
                "installer": "宿迁医保长护运维组",
                "installed_at": "2026-04-23",
                "ip": "物联专网 (宿迁)",
                "network": "物联专网"
              },
              {
                "device_id": "ASH01092",
                "sn": "ASH01092",
                "label": "ASH01092 (丁志坤)",
                "type": "AI健康守护仪 (ASH-01)",
                "firmware": "v3.3.43",
                "building": "支口街道长护点",
                "room": "03室",
                "vitals": {
                  "hr": 72,
                  "br": 16,
                  "tp": 36.4,
                  "in_bed": true,
                  "status_desc": "实时在床监护中",
                  "body_movement": 1
                },
                "online": true,
                "alerting": false,
                "last_report_time": "2026-09-23 14:30:00",
                "installer": "宿迁医保长护运维组",
                "installed_at": "2026-04-23",
                "ip": "物联专网 (宿迁)",
                "network": "物联专网"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    city: '苏州',
    lon: 120.5853,
    lat: 31.2990,
    device_total: 7,
    device_online: 1,
    alerts_today: 0,
    districts: [
      {
        id: 'sz_wuzhong',
        name: '吴中区',
        city: '苏州',
        lon: 120.6321,
        lat: 31.2622,
        device_total: 4,
        device_online: 1,
        alerts_today: 0,
        communities: [
          {
            id: 'comm_sz_thkc',
            name: '太湖科创中心·中科展厅',
            address: '苏州市吴中区藤器街太湖科创中心903室',
            district: '吴中区',
            city: '苏州',
            device_total: 2,
            device_online: 1,
            alerts_today: 0,
            grid_manager: '运营中心',
            nurse_in_charge: '运营中心',
            contact_phone: '运营中心',
            buildings: ['太湖科创中心A座'],
            devices: [
              {
                device_id: 'ASH01146',
                sn: 'ASH01146',
                label: '太湖科创中心·903',
                type: 'AI健康守护仪 (ASH-01 旗舰机)',
                firmware: 'v3.2.0-IoTDA',
                building: '太湖科创中心A座',
                room: '903室 (总控展厅)',
                vitals: {
                  hr: 72,
                  br: 17,
                  tp: 36.6,
                  in_bed: true,
                  status_desc: '实时遥测推流中',
                  body_movement: 1,
                },
                online: true,
                alerting: false,
                last_report_time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
                installer: '中科安樵官方技术部',
                installed_at: '2025-10-18',
                ip: '58.211.134.50',
                lan_ip: '192.168.1.146',
                network: '华为云IoTDA专网 (江苏苏州电信)',
                mac: '80:F3:DA:B4:71:0C',
              },
              {
                device_id: 'X2_S01B05N962',
                sn: 'X2_S01B05N962',
                label: '太湖科创中心·901',
                type: '多模态AI守护仪样机 (X2_S01)',
                firmware: 'v4.0.0-BETA',
                building: '太湖科创中心A座',
                room: '901室 (研发实验室)',
                vitals: {
                  hr: 0,
                  br: 0,
                  tp: 0,
                  in_bed: false,
                  status_desc: '在册样机 · 协议自检 · 无实时遥测',
                  body_movement: 0,
                },
                online: false,
                alerting: false,
                last_report_time: '2026-09-20 10:00:00',
                installer: '中科安樵官方研发部',
                installed_at: '2026-01-15',
                ip: '58.211.134.50',
                lan_ip: '192.168.1.162',
                network: 'Wi-Fi IEEE 802.11 b/g/n 2.4GHz',
                mac: '41:98:18:90:00:01',
              },
            ],
          },
          {
            id: 'comm_sz_shjl',
            name: '石湖金陵广场运维中枢',
            address: '苏州市吴中区石湖西路188号石湖金陵广场',
            district: '吴中区',
            city: '苏州',
            device_total: 2,
            device_online: 0,
            alerts_today: 0,
            grid_manager: '运营中心',
            nurse_in_charge: '运营中心',
            contact_phone: '运营中心',
            buildings: ['金陵广场A座', '金陵广场B座'],
            devices: [
              {
                device_id: 'ANCE00002',
                sn: 'ANCE00002',
                label: '石湖金陵广场·301',
                type: 'AI健康守护仪 (ANCE-01)',
                firmware: 'v2.6.2',
                building: '金陵广场B座',
                room: '301室 (运维中心)',
                vitals: {
                  hr: 0,
                  br: 0,
                  tp: 0,
                  in_bed: false,
                  status_desc: '在册归档 · 无实时遥测',
                  body_movement: 0,
                },
                online: false,
                alerting: false,
                last_report_time: '2026-09-18 19:40:00',
                installer: '中科安樵官方技术部',
                installed_at: '2025-11-02',
                ip: '58.211.134.55',
                lan_ip: '192.168.100.102',
                network: 'Wi-Fi局域网 (SSID: HF)',
                mac: '1C:69:20:D1:23:A0',
              },
              {
                device_id: 'ASH01118',
                sn: 'ASH01118',
                label: '石湖金陵广场·801',
                type: 'AI健康守护仪 (ASH-01)',
                firmware: 'v3.1.5-IoTDA',
                building: '金陵广场A座',
                room: '801室',
                vitals: {
                  hr: 0,
                  br: 0,
                  tp: 0,
                  in_bed: false,
                  status_desc: '在册归档 · 无实时遥测',
                  body_movement: 0,
                },
                online: false,
                alerting: false,
                last_report_time: '2026-09-19 14:20:00',
                installer: '中科安樵官方技术部',
                installed_at: '2025-12-01',
                ip: '58.211.134.56',
                lan_ip: '192.168.100.118',
                network: 'Wi-Fi局域网 (SSID: HF)',
                mac: '80:F3:DA:AF:7A:5C',
              },
            ],
          },
        ],
      },
      {
        id: 'sz_sip',
        name: '苏州工业园区',
        city: '苏州',
        lon: 120.6868,
        lat: 31.3197,
        device_total: 3,
        device_online: 0,
        alerts_today: 0,
        communities: [
          {
            id: 'comm_sz_yq815',
            name: '园区康养815照护示范点',
            address: '苏州市苏州工业园区星湖街815号',
            district: '苏州工业园区',
            city: '苏州',
            device_total: 1,
            device_online: 0,
            alerts_today: 0,
            grid_manager: '运营中心',
            nurse_in_charge: '运营中心',
            contact_phone: '运营中心',
            buildings: ['康养公寓8幢'],
            devices: [
              {
                device_id: 'ASH01076',
                sn: 'ASH01076',
                label: '园区康养·815',
                type: 'AI健康守护仪 (ASH-01)',
                firmware: 'v3.1.2',
                building: '康养公寓8幢',
                room: '815室',
                vitals: {
                  hr: 0,
                  br: 0,
                  tp: 0,
                  in_bed: false,
                  status_desc: '在册归档 · 无实时遥测',
                  body_movement: 0,
                },
                online: false,
                alerting: false,
                last_report_time: '2026-09-20 14:29:10',
                installer: '中科安樵官方技术部',
                installed_at: '2025-09-10',
                ip: '223.104.147.88',
                lan_ip: '10.144.68.219',
                network: '4G蜂窝物联网 (江苏苏州移动)',
                mac: '80:F3:DA:B4:71:0C',
              },
            ],
          },
          {
            id: 'comm_sz_yq613',
            name: '园区康养613照护示范点',
            address: '苏州市苏州工业园区星湖街613号',
            district: '苏州工业园区',
            city: '苏州',
            device_total: 1,
            device_online: 0,
            alerts_today: 0,
            grid_manager: '运营中心',
            nurse_in_charge: '运营中心',
            contact_phone: '运营中心',
            buildings: ['康养公寓6幢'],
            devices: [
              {
                device_id: 'ANCE00003',
                sn: 'ANCE00003',
                label: '园区康养·613',
                type: 'AI健康守护仪 (ANCE-01)',
                firmware: 'v2.6.5',
                building: '康养公寓6幢',
                room: '613室',
                vitals: {
                  hr: 0,
                  br: 0,
                  tp: 0,
                  in_bed: false,
                  status_desc: '在册归档 · 无实时遥测',
                  body_movement: 0,
                },
                online: false,
                alerting: false,
                last_report_time: '2026-05-22 23:24:41',
                installer: '中科安樵官方技术部',
                installed_at: '2025-09-01',
                ip: '223.104.147.89',
                lan_ip: '10.144.68.220',
                network: '4G蜂窝物联网 (江苏苏州移动)',
                mac: '80:F3:DA:AE:72:60',
              },
            ],
          },
          {
            id: 'comm_sz_dsh',
            name: '独墅湖科教创新睡眠中心',
            address: '苏州市苏州工业园区仁爱路独墅湖高教区',
            district: '苏州工业园区',
            city: '苏州',
            device_total: 1,
            device_online: 0,
            alerts_today: 0,
            grid_manager: '运营中心',
            nurse_in_charge: '运营中心',
            contact_phone: '运营中心',
            buildings: ['睡眠科研楼B栋'],
            devices: [
              {
                device_id: 'ASH01016',
                sn: 'ASH01016',
                label: '独墅湖科创区·206',
                type: 'AI健康守护仪 (ASH-01)',
                firmware: 'v3.1.0',
                building: '科研楼B栋',
                room: '206室',
                vitals: {
                  hr: 0,
                  br: 0,
                  tp: 0,
                  in_bed: false,
                  status_desc: '在册归档 · 无实时遥测',
                  body_movement: 0,
                },
                online: false,
                alerting: false,
                last_report_time: '2026-08-14 02:03:42',
                installer: '中科安樵官方技术部',
                installed_at: '2025-08-20',
                ip: '58.211.134.53',
                lan_ip: '192.168.20.16',
                network: '专网光纤通道 (江苏苏州电信)',
                mac: '80:F3:DA:AF:4C:08',
              },
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
