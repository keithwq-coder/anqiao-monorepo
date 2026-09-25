/**
 * 项目数据统一入口（INTEGRATION-SPEC §5.1）
 * 按构建期 __VITE_PROJECT__ 选择对应配置包；业务代码一律从本模块导入，
 * 禁止直接 import ./kaijian/* 或 ./suqian/*（防止项目分叉回潮）。
 *
 * 说明：两套数据同时被打包但仅导出所选项目的一份；未选中项目的导出不被引用，
 * 后续可用 vite alias 做构建期裁剪（非本轮范围）。
 */
import { PROJECT } from './config'
import * as kDevices from './kaijian/anqiaoDevices'
import * as sDevices from './suqian/anqiaoDevices'
import * as kOrgs from './kaijian/orgData'
import * as sOrgs from './suqian/orgData'
import * as kGeo from './kaijian/geoHierarchy'
import * as sGeo from './suqian/geoHierarchy'
import * as kProfile from './kaijian/profileData'
import * as sProfile from './suqian/profileData'
import * as kArchive from './kaijian/ltciArchive'
import * as sArchive from './suqian/ltciArchive'

const useSuqian = PROJECT.projectId === 'suqian'
const D = useSuqian ? sDevices : kDevices
const O = useSuqian ? sOrgs : kOrgs
const G = useSuqian ? sGeo : kGeo
const P = useSuqian ? sProfile : kProfile
const A = useSuqian ? sArchive : kArchive

// ---- 设备台账 ----
export const ANQIAO_DEVICES = D.ANQIAO_DEVICES as AnqiaoDevice[]
export const ANQIAO_ONLINE_COUNT = D.ANQIAO_ONLINE_COUNT
export const getAnqiaoDevice = D.getAnqiaoDevice
/** 云扫描写回入口：suqian compare_only 红线下为 no-op（绝不写回台账） */
export function addDiscoveredDevice(d: Parameters<typeof kDevices.addDiscoveredDevice>[0]): ReturnType<typeof kDevices.addDiscoveredDevice> {
  if (PROJECT.cloudScanMode === 'compare_only') {
    // 红线：只比对不写回——在册设备恒为试点 3 台
    return getAnqiaoDevice(d.sn) ?? (D.ANQIAO_DEVICES[0] as never)
  }
  return kDevices.addDiscoveredDevice(d)
}
export type AnqiaoDevice = kDevices.AnqiaoDevice
export type DeviceCategory = kDevices.DeviceCategory

// ---- 机构配置 ----
export const ORG_PROFILES = O.ORG_PROFILES as Record<string, OrgProfile>
export type OrgProfile = kOrgs.OrgProfile
export type OrgType = kOrgs.OrgType
export type DeviceBreakdown = kOrgs.DeviceBreakdown
export type InstitutionalCampus = kOrgs.InstitutionalCampus

// ---- 地理层级 ----
export const GEO_HIERARCHY = G.GEO_HIERARCHY as CityHierarchy[]
export const getAllDistricts = G.getAllDistricts
export const getAllCommunities = G.getAllCommunities
export const getAllHierarchyDevices = G.getAllHierarchyDevices
export type CityHierarchy = kGeo.CityHierarchy
export type CommunityDetail = kGeo.CommunityDetail
export type DistrictDetail = kGeo.DistrictDetail
export type UnitDevice = kGeo.UnitDevice
export type DeviceVitals = kGeo.DeviceVitals

// ---- 巡查/画像卡片 ----
export const ANQIAO_DIRECT = P.ANQIAO_DIRECT
export const generateNationalCards = P.generateNationalCards
export const generateAnqiaoDirectUsers = P.generateAnqiaoDirectUsers
export type BoundDevice = kProfile.BoundDevice
export type PatrolCardItem = kProfile.PatrolCardItem

// ---- 长护险参保档案 ----
export const MISSING_TEXT = A.MISSING_TEXT
export const MISSING_HINT = A.MISSING_HINT
export const getLtciArchive = A.getLtciArchive
export const archiveOrMissing = A.archiveOrMissing
export const isMissing = A.isMissing
export const archiveStatusOf = A.archiveStatusOf
export type LtciArchive = kArchive.LtciArchive
export type ArchiveStatus = kArchive.ArchiveStatus

export { PROJECT, type ProjectConfig, type ProjectId, type CloudScanMode } from './config'
