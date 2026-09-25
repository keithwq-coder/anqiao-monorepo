import fs from 'node:fs';

async function verify() {
  const anqiaoDevices = await import('../src/assets/anqiaoDevices.ts');
  const deviceTelemetry = await import('../src/api/deviceTelemetry.ts');

  console.log('=== VERIFYING ANQIAO DEVICES ===');
  console.log('Total devices in ANQIAO_DEVICES:', anqiaoDevices.ANQIAO_DEVICES.length);

  const totalOnline = deviceTelemetry.liveDeviceCount();
  console.log('Total online count (liveDeviceCount):', totalOnline);

  const testSns = ['ASH01038', 'ASH01021', 'ASH01146'];
  for (const sn of testSns) {
    const presence = deviceTelemetry.presenceOf(sn);
    const online = deviceTelemetry.isOnline(sn);
    const sampleTime = deviceTelemetry.lastSampleTime(sn);
    console.log(`Device [${sn}]:`, {
      online,
      presence,
      statusLabel: online ? (presence === 'empty' ? '● 设备在线 · 离床' : '● 设备在线 · 在床') : '○ 设备离线',
      sampleTime: sampleTime || '(空床就绪)',
    });
  }

  // Count empty vs person
  let personCount = 0;
  let emptyCount = 0;
  let offlineCount = 0;
  for (const d of anqiaoDevices.ANQIAO_DEVICES) {
    const p = deviceTelemetry.presenceOf(d.sn);
    if (p === 'person') personCount++;
    else if (p === 'empty') emptyCount++;
    else offlineCount++;
  }
  console.log(`Summary: 在床(person)=${personCount}, 离床(empty)=${emptyCount}, 离线(offline)=${offlineCount}`);
}

verify().catch(console.error);
