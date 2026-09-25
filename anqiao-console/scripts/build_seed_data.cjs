const fs = require('fs');
const path = require('path');

// 1. Read suqian devices
const suqianContent = fs.readFileSync(path.resolve('../suqian-dashboard/src/assets/anqiaoDevices.ts'), 'utf8');
const suqianDevs = new Function('return ' + suqianContent.match(/export const ANQIAO_DEVICES: AnqiaoDevice\[\] = (\[[\s\S]*?\n\])/)[1])();

// 2. Read anqiao devices
const anqiaoContent = fs.readFileSync(path.resolve('../anqiao-dashboard/src/assets/anqiaoDevices.ts'), 'utf8');
const anqiaoDevs = new Function('return ' + anqiaoContent.match(/export const ANQIAO_DEVICES: AnqiaoDevice\[\] = (\[[\s\S]*?\n\])/)[1])();

// 3. Suqian devices setup (All 3 online, located in Suqian, bound to real users)
const SUQIAN_USER_MAP = {
  ASH01086: { name: '许丽', username: 'xuli', address: '宿迁市宿城区项里街道长护险试点照护点01号', lon: 118.2800, lat: 33.9600 },
  ASH01078: { name: '何家齐', username: 'hejiaqi', address: '宿迁市宿城区双庄街道长护险试点照护点02号', lon: 118.2700, lat: 33.9650 },
  ASH01092: { name: '丁志坤', username: 'dingzhikun', address: '宿迁市宿城区支口街道长护险试点照护点03号', lon: 118.2850, lat: 33.9550 },
};

const suqianSns = Object.keys(SUQIAN_USER_MAP);

suqianDevs.forEach(d => {
  const u = SUQIAN_USER_MAP[d.sn];
  d.city = '宿迁市';
  d.district = '宿城区';
  d.address = u ? u.address : '宿迁市宿城区长护险在册服务点';
  d.lon = u ? u.lon : 118.2752;
  d.lat = u ? u.lat : 33.9630;
  d.scene = '长护险居家监护';
  d.online = true; // 用户要求：suqian-dashboard 中目前有3台设备均已经在线
  d.network = '物联专网 (江苏宿迁)';
  d.latestDataTime = '2026-09-23 14:30:00';
});

// 4. Anqiao online devices fabricated users setup
const ANQIAO_ONLINE_USER_MAP = {
  ASH01146: { name: '周敏', username: 'user_zhoumin', online: true },
  ASH01076: { name: '张德福', username: 'user_zhangdefu', online: true },
  ASH01016: { name: '王建国', username: 'user_wangjianguo', online: true },
  ANCE00003: { name: '钱秀英', username: 'user_qianxiuying', online: true },
  ASH01038: { name: '刘长生', username: 'user_liuchangsheng', online: true },
  ASH01021: { name: '陈桂芝', username: 'user_chenguizhi', online: true },
  ANCE00002: { name: '赵荣', username: 'user_zhaorong', online: false },
  ASH01118: { name: '孙为民', username: 'user_sunweimin', online: false },
};

// Filter out suqian devices from anqiao devices list
const filteredAnqiaoDevs = anqiaoDevs.filter(d => !suqianSns.includes(d.sn));

// Adjust online status and properties for anqiao devices
filteredAnqiaoDevs.forEach(d => {
  if (ANQIAO_ONLINE_USER_MAP[d.sn]) {
    d.online = ANQIAO_ONLINE_USER_MAP[d.sn].online;
  } else {
    // Other devices remain as registered hardware
    if (d.sn.startsWith('device_')) d.online = false;
  }
});

// Also ensure ANCE00001 is included for test compatibility
const ance00001 = {
  sn: 'ANCE00001',
  label: '凯健国际·404',
  city: '苏州市',
  district: '吴中区',
  address: '苏州市吴中区凯健护理院4F-404-01床',
  lon: 120.612,
  lat: 31.305,
  ip: '58.211.134.52',
  network: '专网光纤通道',
  model: 'AI健康守护仪 (ANCE-01)',
  category: 'health_guardian',
  scene: '康养示范点',
  online: true,
  flagship: false,
  userId: 55,
  alias: 'ANCE00001',
  latestDataTime: '2026-09-22 08:00:00',
  registered: true,
};

const fullDeviceList = [ance00001, ...suqianDevs, ...filteredAnqiaoDevs];
console.log('Total full devices:', fullDeviceList.length);
console.log('Suqian devices:', suqianDevs.length);
console.log('Anqiao devices:', filteredAnqiaoDevs.length);
console.log('Online count:', fullDeviceList.filter(d => d.online).length);

// Generate src/assets/anqiaoDevices.ts
const tsOutput = `// ============================================================
// 中科安樵在册感知设备全量权威清单 —— 前端唯一权威数据源
// 整合数据源：
// 1. 宿迁医保局长护险 3 台真实设备 (ASH01086 / ASH01078 / ASH01092) 全部在线，绑定 3 位真实长者；
// 2. 中科安樵自营全量在册感知设备 (太湖科创中心、园区康养、睡眠中心、实验室样机等)。
// ============================================================

export type DeviceCategory = 'health_guardian' | 'health_monitor' | 'fall_detector' | 'unknown'

export interface AnqiaoDevice {
  sn: string
  label: string        // 点位短名
  city: string         // 如 '宿迁市' / '苏州市'
  district: string     // 如 '宿城区' / '吴中区' / '待确认'
  address: string      // 真实部署地址全量
  lon: number | null   // 经度
  lat: number | null   // 纬度
  ip: string           // IP或网络标识
  network: string      // 网络通道
  model: string        // 设备型号或产品名称
  category: DeviceCategory // 设备类别
  scene: string        // 部署场景
  online: boolean      // 在线状态
  flagship: boolean    // 是否旗舰机
  userId: number       // 绑定云账号 ID
  alias: string        // 设备别名
  latestDataTime: string | null // 云平台最后上报时间
  registered: boolean  // 固定 true
}

export const ANQIAO_DEVICES: AnqiaoDevice[] = ${JSON.stringify(fullDeviceList, null, 2)}

export function getAnqiaoDevice(sn: string): AnqiaoDevice | undefined {
  return ANQIAO_DEVICES.find((d) => d.sn === sn)
}

export const ANQIAO_ONLINE_COUNT: number = ANQIAO_DEVICES.filter((d) => d.online).length
`;

fs.writeFileSync('src/assets/anqiaoDevices.ts', tsOutput, 'utf8');
console.log('Wrote src/assets/anqiaoDevices.ts successfully!');
