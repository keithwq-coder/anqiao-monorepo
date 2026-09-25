import re

with open('src/assets/anqiaoDevices.ts', encoding='utf-8') as f:
    text = f.read()

devices = []
for block in text.split('{\n    sn:'):
    if len(block) < 5: continue
    sn = block.split('\n')[0].strip(' "')
    m_time = re.search(r'latestDataTime:\s*([^\n,]+)', block)
    m_online = re.search(r'online:\s*([^\n,]+)', block)
    m_cat = re.search(r'category:\s*([^\n,]+)', block)
    devices.append({
        'sn': sn,
        'time': m_time.group(1).strip(' "\'') if m_time else None,
        'online': m_online.group(1).strip() if m_online else None,
        'cat': m_cat.group(1).strip(' "\'') if m_cat else None,
    })

print(f"Total devices: {len(devices)}")
with_time = [d for d in devices if d['time'] and d['time'] != 'null']
print(f"With latestDataTime: {len(with_time)}")
for d in with_time:
    print(d)
