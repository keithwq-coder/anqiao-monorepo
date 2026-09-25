const fs = require('fs');

function replaceBlock(str, startMarker, endMarker, newContent) {
  const startIdx = str.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error('startMarker not found: ' + startMarker);
  }
  const endIdx = str.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) {
    throw new Error('endMarker not found: ' + endMarker);
  }
  return str.slice(0, startIdx) + newContent + str.slice(endIdx + endMarker.length);
}

// 1. Read devices from src/assets/anqiaoDevices.ts
const anqiaoDevicesTs = fs.readFileSync('src/assets/anqiaoDevices.ts', 'utf8');
const allDevices = new Function('return ' + anqiaoDevicesTs.match(/export const ANQIAO_DEVICES: AnqiaoDevice\[\] = (\[[\s\S]*?\n\])/)[1])();
console.log('Read allDevices count:', allDevices.length);

// 2. Prepare ACCOUNTS
const accountsSnippet = `export const ACCOUNTS = [
  // 系统核心治理架构账号
  { username: 'su01',            password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-su01'),            staff_name: '超级管理员',        role: 'su',                      unified_role: 'su',                  tenant_id: 'platform',     org_id: 'platform',     workspace: 'system_admin',         scope: 'global' },
  { username: 'admin01',         password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-admin01'),         staff_name: '中科安樵管理员',    role: 'admin',                   unified_role: 'platform_admin',      tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'platform_operations',  scope: 'org' },
  { username: 'user01',          password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-user01'),          staff_name: '设备监控用户',      role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org' },
  { username: 'medical01',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-medical01'),       staff_name: '医保局监管人员',    role: 'medical_insurance_staff', unified_role: 'medical_supervisor',  tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'medical_supervision',  scope: 'pool' },
  { username: 'insurer01',       password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-insurer01'),       staff_name: '太平洋保险经办人员',role: 'insurer_staff',           unified_role: 'insurer_operator',    tenant_id: 'insurer',      org_id: 'insurer',      workspace: 'insurer_operations',   scope: 'pool' },
  { username: 'assessor01',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-assessor01'),      staff_name: '长护险评估人员',    role: 'assessor',                unified_role: 'assessor',            tenant_id: 'assessor_org', org_id: 'assessor_org', workspace: 'assessor_workspace',  scope: 'task' },
  { username: 'kaijian_admin',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kj-admin'),        staff_name: '凯健院内管理员',    role: 'nursing_admin',           unified_role: 'nursing_admin',       tenant_id: 'kaijian',      org_id: 'kaijian',      workspace: 'nursing_home_admin',   scope: 'org' },
  { username: 'kaijian_nurse01', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kj-nurse01'),      staff_name: '李晓芳 护士',       role: 'nursing_nurse',           unified_role: 'nursing_nurse',       tenant_id: 'kaijian',      org_id: 'kaijian',      workspace: 'nursing_staff',        scope: 'assigned', assigned_floors: ['4F'], assigned_nurse: '李晓芳 护士' },
  { username: 'kaijian_nurse02', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-kj-nurse02'),      staff_name: '张晓敏 护士',       role: 'nursing_nurse',           unified_role: 'nursing_nurse',       tenant_id: 'kaijian',      org_id: 'kaijian',      workspace: 'nursing_staff',        scope: 'assigned', assigned_floors: ['3F'], assigned_nurse: '张晓敏 护士' },
  { username: 'partner_admin',   password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-partner01'),       staff_name: '中科智护渠道经理',  role: 'partner_admin',           unified_role: 'partner_admin',       tenant_id: 'partner_p1',   org_id: 'partner_p1',   workspace: 'partner_operations',   scope: 'channel' },

  // 宿迁长护险 3 名真实用户（分别绑定 suqian-dashboard 3 台在线设备：ASH01086 / ASH01078 / ASH01092）
  { username: 'xuli',            password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-xuli'),            staff_name: '许丽',              role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01086' },
  { username: 'hejiaqi',         password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-hejiaqi'),         staff_name: '何家齐',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01078' },
  { username: 'dingzhikun',      password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-dingzhikun'),      staff_name: '丁志坤',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'bureau',       org_id: 'bureau',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01092' },

  // 安樵在线设备捏造用户（视同真实用户，分别绑定 anqiao-dashboard 在线设备）
  { username: 'user_zhoumin',    password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-zm'),              staff_name: '周敏',              role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01146' },
  { username: 'user_zhangdefu',  password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-zdf'),             staff_name: '张德福',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01076' },
  { username: 'user_wangjianguo',password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-wjg'),             staff_name: '王建国',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01016' },
  { username: 'user_qianxiuying',password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-qxy'),             staff_name: '钱秀英',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ANCE00003' },
  { username: 'user_liuchangsheng',password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-lcs'),           staff_name: '刘长生',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01038' },
  { username: 'user_chenguizhi', password_hash: hashPassword(SEED_ACCOUNT_PASSWORD, 'aq-seed-salt-cgz'),             staff_name: '陈桂芝',            role: 'user',                    unified_role: 'device_user',         tenant_id: 'anqiao',       org_id: 'anqiao',       workspace: 'device_monitoring',    scope: 'org', bound_device_sn: 'ASH01021' },
]`;

// 3. Prepare ANQIAO_CITIES
const citiesSnippet = `const ANQIAO_CITIES = [
  { city: '苏州', lon: 120.5853, lat: 31.2990 },
  { city: '宿迁', lon: 118.2752, lat: 33.9630 },
]`;

// 4. Prepare ANQIAO_DEVICES
const anqiaoDevicesArray = allDevices.map(d => ({
  sn: d.sn,
  label: d.label,
  type: d.model,
  category: d.category,
  city: d.city,
  district: d.district,
  community: d.scene === '长护险居家监护' ? '宿迁长护险试点片区' : (d.district === '吴中区' ? '太湖科创中心·中科展厅' : (d.district === '苏州工业园区' ? '独墅湖科教创新中心' : '在册感知片区')),
  address: d.address,
  lon: d.lon,
  lat: d.lat,
  online: d.online,
  last_data_time: d.latestDataTime ? (d.latestDataTime.includes('T') ? d.latestDataTime : d.latestDataTime.replace(' ', 'T') + '+08:00') : (d.online ? null : '2026-09-20T10:00:00+08:00'),
}));

const anqiaoDevicesSnippet = `const ANQIAO_DEVICES = ${JSON.stringify(anqiaoDevicesArray, null, 2)}`;

// 5. Prepare DEVICE_ASSETS
const USER_BINDING = {
  ASH01086: { subjectId: 'P_SQ_01', user: 'xuli', org: 'bureau', partner: null, usage: 'ltc_disability_assessment' },
  ASH01078: { subjectId: 'P_SQ_02', user: 'hejiaqi', org: 'bureau', partner: null, usage: 'ltc_disability_assessment' },
  ASH01092: { subjectId: 'P_SQ_03', user: 'dingzhikun', org: 'bureau', partner: null, usage: 'ltc_disability_assessment' },
  ASH01146: { subjectId: 'P00084', user: 'user_zhoumin', org: 'kaijian', partner: 'partner_p1', usage: 'ltc_disability_assessment' },
  ASH01076: { subjectId: 'P00001', user: 'user_zhangdefu', org: 'kaijian', partner: 'partner_p1', usage: 'ltc_disability_assessment' },
  ASH01016: { subjectId: 'P00002', user: 'user_wangjianguo', org: 'gusu_assessment', partner: null, usage: 'ltc_disability_assessment' },
  ANCE00003: { subjectId: 'P00012', user: 'user_qianxiuying', org: 'cust_org01', partner: 'partner_p1', usage: 'ltc_disability_assessment' },
  ASH01038: { subjectId: 'P00013', user: 'user_liuchangsheng', org: 'anqiao', partner: null, usage: 'standby_pool' },
  ASH01021: { subjectId: 'P00014', user: 'user_chenguizhi', org: 'anqiao', partner: null, usage: 'standby_pool' },
  ANCE00001: { subjectId: 'P00084', user: 'kaijian_admin', org: 'kaijian', partner: 'partner_p1', usage: 'ltc_disability_assessment' },
  ANCE00002: { subjectId: null, user: 'user01', org: 'anqiao', partner: null, usage: 'standby_pool' },
};

const deviceAssetsArray = allDevices.map(d => {
  const binding = USER_BINDING[d.sn] || {
    subjectId: null,
    user: null,
    org: d.city === '宿迁市' ? 'bureau' : (d.category === 'fall_detector' ? 'gusu_assessment' : 'anqiao'),
    partner: null,
    usage: d.category === 'fall_detector' ? '跌倒监测客观证据' : 'standby_pool',
  };

  let status = 'installed';
  if (d.sn === 'ANCE00002') {
    status = 'shipped'; // required by test-device-ltc.mjs
  } else if (d.online) {
    status = 'monitoring';
  } else if (d.sn.startsWith('device_')) {
    status = 'stocked';
  }

  return {
    device_id: d.sn,
    sn: d.sn,
    label: d.label,
    type: d.model,
    category: d.category,
    scene: d.scene,
    hardware_asset_owner: 'anqiao',
    asset_owner_org_id: 'anqiao',
    platform_manager_org_id: 'anqiao',
    operator_partner_id: binding.partner,
    partner_org_id: binding.partner,
    procurement_channel: (d.sn === 'ANCE00001' || d.sn === 'ANCE00002') ? 'direct_sale' : (d.city === '宿迁市' ? 'government_procurement' : (binding.partner ? 'channel_partner' : 'direct_sale')),
    service_provider_org_id: binding.org,
    customer_org_id: binding.org,
    custodian_org_id: binding.org,
    monitored_subject_id: binding.subjectId,
    service_subject_id: binding.subjectId,
    device_placement_location: d.address || (d.city + d.district + d.label),
    installation_site_id: d.label,
    monitoring_user_id: binding.user,
    lifecycle_status: status,
    online: d.online,
    last_data_time: d.latestDataTime ? (d.latestDataTime.includes('T') ? d.latestDataTime : d.latestDataTime.replace(' ', 'T') + '+08:00') : (d.online ? '2026-09-23T14:30:00+08:00' : '2026-09-20T10:00:00+08:00'),
    lon: d.lon,
    lat: d.lat,
    ip: d.ip,
    network: d.network,
    flagship: !!d.flagship,
    assessment_usage: binding.usage,
  };
});

const deviceAssetsSnippet = `export const DEVICE_ASSETS = ${JSON.stringify(deviceAssetsArray, null, 2)}`;

// 6. DEVICE_LIFECYCLE_LOGS
const lifecycleLogsSnippet = `export const DEVICE_LIFECYCLE_LOGS = [
  {
    log_id: 'LOG-INIT-001',
    device_id: 'ASH01146',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'anqiao',
    location: '苏州市吴中区太湖科创中心A座903室',
    occurred_at: '2026-09-22T09:00:00+08:00',
    remark: '展厅旗舰设备完成部署并开启实时连续监测',
  },
  {
    log_id: 'LOG-INIT-002',
    device_id: 'ASH01086',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'bureau',
    location: '宿迁市宿城区项里街道01号',
    occurred_at: '2026-09-23T10:00:00+08:00',
    remark: '宿迁长护险参保人许丽居家守护设备上线并接入医保连续监测',
  },
  {
    log_id: 'LOG-INIT-003',
    device_id: 'ASH01078',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'bureau',
    location: '宿迁市宿城区双庄街道02号',
    occurred_at: '2026-09-23T10:30:00+08:00',
    remark: '宿迁长护险参保人何家齐居家守护设备上线并接入医保连续监测',
  },
  {
    log_id: 'LOG-INIT-004',
    device_id: 'ASH01092',
    from_status: 'installed',
    to_status: 'monitoring',
    operator_id: 'admin01',
    organization_id: 'bureau',
    location: '宿迁市宿城区支口街道03号',
    occurred_at: '2026-09-23T11:00:00+08:00',
    remark: '宿迁长护险参保人丁志坤居家守护设备上线并接入医保连续监测',
  },
  {
    log_id: 'LOG-INIT-005',
    device_id: 'ANCE00002',
    from_status: 'stocked',
    to_status: 'shipped',
    operator_id: 'admin01',
    organization_id: 'anqiao',
    location: '苏州市吴中区石湖西路188号B座301室',
    occurred_at: '2026-09-18T14:00:00+08:00',
    remark: '发往石湖金陵广场运维中枢',
  },
]`;

const newBuildVendorDevices = `function buildVendorDevices() {
  return ANQIAO_DEVICES.map((d) => ({
    device_id: d.sn,
    sn: d.sn,
    label: d.label,
    type: d.type,
    category: d.category || 'health_guardian',
    customer: d.city === '宿迁市' ? '宿迁医保局长护险' : ANQIAO_CUSTOMER,
    city: d.city,
    district: d.district,
    community: d.community,
    address: d.address,
    lon: d.lon,
    lat: d.lat,
    online: d.online,
    alerting: false,
    last_data_time: d.last_data_time ?? nowIso8(),
  }))
}`;

let seedCode = fs.readFileSync('server/seed.js', 'utf8');

// 1. Replace ACCOUNTS
{
  const sIdx = seedCode.indexOf('export const ACCOUNTS = [');
  const timeIdx = seedCode.indexOf('// ---------- 时间工具');
  const eIdx = seedCode.lastIndexOf(']', timeIdx);
  seedCode = seedCode.slice(0, sIdx) + accountsSnippet + seedCode.slice(eIdx + 1);
}

// 2. Replace ANQIAO_CITIES
{
  const sIdx = seedCode.indexOf('const ANQIAO_CITIES = [');
  const eIdx = seedCode.indexOf(']', sIdx);
  seedCode = seedCode.slice(0, sIdx) + citiesSnippet + seedCode.slice(eIdx + 1);
}

// 3. Replace ANQIAO_DEVICES
{
  const sIdx = seedCode.indexOf('const ANQIAO_DEVICES = [');
  const sameCityIdx = seedCode.indexOf('function sameCity');
  const eIdx = seedCode.lastIndexOf(']', sameCityIdx);
  seedCode = seedCode.slice(0, sIdx) + anqiaoDevicesSnippet + seedCode.slice(eIdx + 1);
}

// 4. Replace buildVendorDevices
{
  const sIdx = seedCode.indexOf('function buildVendorDevices() {');
  const alertDefIdx = seedCode.indexOf('// 设备维度告警文案');
  const eIdx = seedCode.lastIndexOf('}', alertDefIdx);
  seedCode = seedCode.slice(0, sIdx) + newBuildVendorDevices + seedCode.slice(eIdx + 1);
}

// 5. Replace DEVICE_ASSETS
{
  const sIdx = seedCode.indexOf('export const DEVICE_ASSETS = [');
  const logsIdx = seedCode.indexOf('export const DEVICE_LIFECYCLE_LOGS = [');
  const eIdx = seedCode.lastIndexOf(']', logsIdx);
  seedCode = seedCode.slice(0, sIdx) + deviceAssetsSnippet + seedCode.slice(eIdx + 1);
}

// 6. Replace DEVICE_LIFECYCLE_LOGS
{
  const sIdx = seedCode.indexOf('export const DEVICE_LIFECYCLE_LOGS = [');
  const validIdx = seedCode.indexOf('export const VALID_LIFECYCLE_STATUSES = [');
  const eIdx = seedCode.lastIndexOf(']', validIdx);
  seedCode = seedCode.slice(0, sIdx) + lifecycleLogsSnippet + seedCode.slice(eIdx + 1);
}

fs.writeFileSync('server/seed.js', seedCode, 'utf8');
console.log('Successfully updated server/seed.js with precise block replacement!');
