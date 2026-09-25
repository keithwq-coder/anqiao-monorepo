const fs = require('fs');

const suqianCity = {
  city: '宿迁',
  lon: 118.2752,
  lat: 33.9630,
  device_total: 3,
  device_online: 3,
  alerts_today: 0,
  districts: [
    {
      id: 'sq_sucheng',
      name: '宿城区',
      city: '宿迁',
      lon: 118.2752,
      lat: 33.9630,
      device_total: 3,
      device_online: 3,
      alerts_today: 0,
      communities: [
        {
          id: 'comm_sq_ltci',
          name: '宿迁市长护险试点服务中心',
          address: '宿迁市宿城区长护险在册照护点',
          district: '宿城区',
          city: '宿迁',
          device_total: 3,
          device_online: 3,
          alerts_today: 0,
          grid_manager: '宿迁医保中心',
          nurse_in_charge: '宿迁长护照护中心',
          contact_phone: '0527-84381234',
          buildings: ['长护险试点照护区'],
          devices: [
            {
              device_id: 'ASH01086',
              sn: 'ASH01086',
              label: 'ASH01086 (许丽)',
              type: 'AI健康守护仪 (ASH-01)',
              firmware: 'v3.3.43',
              building: '项里街道长护点',
              room: '01室',
              vitals: {
                hr: 75,
                br: 18,
                tp: 36.5,
                in_bed: true,
                status_desc: '实时在床监护中',
                body_movement: 1,
              },
              online: true,
              alerting: false,
              last_report_time: '2026-09-23 14:30:00',
              installer: '宿迁医保长护运维组',
              installed_at: '2026-04-23',
              ip: '物联专网 (宿迁)',
              network: '物联专网',
            },
            {
              device_id: 'ASH01078',
              sn: 'ASH01078',
              label: 'ASH01078 (何家齐)',
              type: 'AI健康守护仪 (ASH-01)',
              firmware: 'v3.3.43',
              building: '双庄街道长护点',
              room: '02室',
              vitals: {
                hr: 78,
                br: 19,
                tp: 36.6,
                in_bed: true,
                status_desc: '实时在床监护中',
                body_movement: 1,
              },
              online: true,
              alerting: false,
              last_report_time: '2026-09-23 14:30:00',
              installer: '宿迁医保长护运维组',
              installed_at: '2026-04-23',
              ip: '物联专网 (宿迁)',
              network: '物联专网',
            },
            {
              device_id: 'ASH01092',
              sn: 'ASH01092',
              label: 'ASH01092 (丁志坤)',
              type: 'AI健康守护仪 (ASH-01)',
              firmware: 'v3.3.43',
              building: '支口街道长护点',
              room: '03室',
              vitals: {
                hr: 72,
                br: 16,
                tp: 36.4,
                in_bed: true,
                status_desc: '实时在床监护中',
                body_movement: 1,
              },
              online: true,
              alerting: false,
              last_report_time: '2026-09-23 14:30:00',
              installer: '宿迁医保长护运维组',
              installed_at: '2026-04-23',
              ip: '物联专网 (宿迁)',
              network: '物联专网',
            },
          ],
        },
      ],
    },
  ],
};

let geoContent = fs.readFileSync('src/assets/geoHierarchy.ts', 'utf8');

// Insert Suqian city object as the first item in GEO_HIERARCHY
const marker = 'export const GEO_HIERARCHY: CityHierarchy[] = [\n';
const markerCRLF = 'export const GEO_HIERARCHY: CityHierarchy[] = [\r\n';

if (!geoContent.includes("'宿迁'")) {
  const suqianJson = JSON.stringify(suqianCity, null, 2).replace(/^/gm, '  ') + ',\n';
  if (geoContent.includes(markerCRLF)) {
    const idx = geoContent.indexOf(markerCRLF) + markerCRLF.length;
    geoContent = geoContent.slice(0, idx) + suqianJson + geoContent.slice(idx);
  } else if (geoContent.includes(marker)) {
    const idx = geoContent.indexOf(marker) + marker.length;
    geoContent = geoContent.slice(0, idx) + suqianJson + geoContent.slice(idx);
  }
}

fs.writeFileSync('src/assets/geoHierarchy.ts', geoContent, 'utf8');
console.log('Successfully updated src/assets/geoHierarchy.ts with Suqian city!');
