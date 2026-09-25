// ======================= 中科安樵自营真实设备巡查卡片数据源 =======================
// 本文件仅保留中科安樵（anqiao，居家类）真实硬件口径的卡片构建。
// 设备清单唯一权威数据源为 ./anqiaoDevices.ts（宿迁医保局长护险首批测试项目，3 台真实 AI健康守护仪）。
// 合规红线：严禁出现任何人名（长者/家属/运维专员）、年龄、性别、护理等级与联系方式；
// 不得伪造体征/睡眠/风险分，离线设备体征一律为 null。

import { ANQIAO_DEVICES, type AnqiaoDevice } from './anqiaoDevices'

// ======================= 绑定感知设备明细模型 =======================
export interface BoundDevice {
  type: string       // 'AI健康守护仪' | '77GHz防跌雷达' | '起居微动雷达' 等
  sn: string         // 具体设备SN编号 (如 ASH01086)
  space: string      // 部署空间 (旗舰展厅 / 康养示范点 / 实验室 等)
  online: boolean
  statusText?: string
}

// ======================= 统一巡查卡片通用模型（Screen 2 巡查矩阵 / Screen 3 数字画像共享） =======================
export interface PatrolCardItem {
  id: string
  code: string // 设备 SN / 房号 / 床位号 / 节点编码
  name: string // 点位短名（居家类为地址提炼名，非人名）
  gender?: 'male' | 'female'
  age?: number
  tag: string // 设备场景标签 / 介护等级 / 专区
  category: string // 用于 Row 1 分类筛选 (如 4F, direct 等)
  deviceBadge?: string // 标明具体设备部署 (如 "3台 (主卧+卫浴+起居)")
  boundDevices?: BoundDevice[] // 具体绑定的感知终端清单（点位与设备深度匹配锁定）
  isAlert: boolean
  alertType?: string
  presence: {
    inBed: boolean
    text: string
    cls: 'in-bed' | 'out-bed' | 'offline'
  }
  // 体征快照：居家真实设备不伪造体征，离线/在册一律为 null，
  // 在线设备的实时体征由 hardwareApi 真实流提供
  vitals: {
    hr: number
    br: number
    tp: number
  } | null
  metrics: Array<{
    label: string
    val: string
    unit: string
    isAbnormal?: boolean
    color?: string
  }>
  footer: {
    staffText: string
    statusText: string
    isAlertStatus?: boolean
  }
  patientId: string
  isRfEcho?: boolean // 是否为射频雷达回波
  isRealHardware?: boolean // 是否对接安樵自研真实硬件设备
  realDeviceId?: string // 真实硬件设备SN编号 (如 ASH01086)
}

// ======================= 中科安樵官方在册直连终端：9 台真实 AI健康守护仪 =======================
export const ANQIAO_DIRECT = { users: ANQIAO_DEVICES.length, devices: ANQIAO_DEVICES.length }

// 单台真实设备 -> 巡查卡片（id / patientId 一律使用设备 SN）
function buildAnqiaoCard(d: AnqiaoDevice): PatrolCardItem {
  const ipText = d.ip && d.ip !== '未提供' ? d.ip : '未提供'
  const locText = d.district === '待确认' ? '地址待确认' : `${d.city}${d.district}`
  const statusText = d.online
    ? `● 实时在线 · ${d.model} · IP: ${ipText}`
    : `在册归档 · ${d.model} · IP: ${ipText}`
  return {
    id: d.sn,
    code: d.sn,
    name: d.label,
    tag: `${d.model} · ${d.scene}`,
    category: 'direct',
    deviceBadge: `${d.model} · IP: ${ipText}`,
    isAlert: false,
    presence: {
      inBed: d.online,
      text: d.online ? '● 实时在线' : '○ 在册归档',
      cls: d.online ? 'in-bed' : 'out-bed',
    },
    vitals: null,
    metrics: [
      { label: '公网IP', val: ipText, unit: '', color: 'var(--cyan)' },
      { label: '部署点位', val: locText, unit: '', color: 'var(--mint)' },
      { label: '网络通道', val: d.network, unit: '', color: 'var(--mint)' },
    ],
    footer: {
      staffText: `运维值班 · ${locText}`,
      statusText,
      isAlertStatus: false,
    },
    patientId: d.sn,
    isRealHardware: true,
    realDeviceId: d.sn,
    boundDevices: [
      {
        type: d.model,
        sn: d.sn,
        space: d.scene,
        online: d.online,
        statusText,
      },
    ],
  }
}

// 居家在册设备终端卡片（national_iot 口径通用构建器）
export function generateNationalCards(): PatrolCardItem[] {
  return ANQIAO_DEVICES.map((d) => ({ ...buildAnqiaoCard(d), isRfEcho: true }))
}

// 中科安樵官方在册直连终端卡片（Screen 3 数字画像 anqiao 口径）
export function generateAnqiaoDirectUsers(): PatrolCardItem[] {
  return ANQIAO_DEVICES.map((d) => ({
    ...buildAnqiaoCard(d),
    deviceBadge: d.model,
  }))
}
