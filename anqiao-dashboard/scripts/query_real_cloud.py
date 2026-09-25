"""硬件云平台接口探测脚本（诊断用）。
凭据经环境变量注入，禁止硬编码（INTEGRATION-SPEC §6-1）：
  HW_ACCOUNT / HW_PASSWORD 或 HW_TOKEN
"""
import json
import os
import re
import ssl
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HW_ACCOUNT = os.environ.get("HW_ACCOUNT", "")
HW_PASSWORD = os.environ.get("HW_PASSWORD", "")
HW_TOKEN = os.environ.get("HW_TOKEN", "")

if not HW_TOKEN and not (HW_ACCOUNT and HW_PASSWORD):
    print("缺少凭据：请设置 HW_TOKEN，或 HW_ACCOUNT + HW_PASSWORD 环境变量", file=sys.stderr)
    sys.exit(1)

token = HW_TOKEN
if not token:
    login_req = urllib.request.Request(
        'https://api.health-track.anqiaokj.com/api/v1/auth/login',
        headers={'Content-Type': 'application/json'},
        data=json.dumps({'account': HW_ACCOUNT, 'password': HW_PASSWORD}).encode('utf-8')
    )
    try:
        resp = urllib.request.urlopen(login_req, context=ctx, timeout=10)
        login_res = json.loads(resp.read().decode('utf-8'))
        print("Login response code:", login_res.get('code'))
        token = login_res.get('data', {}).get('access_token')
        print("Got access_token:", (token[:30] + '...') if token else None)
    except Exception as e:
        print("Login error:", e)
        sys.exit(1)

if not token:
    print("未能取得 access_token", file=sys.stderr)
    sys.exit(1)


def post(endpoint, data):
    url = f'https://api.health-track.anqiaokj.com{endpoint}'
    req = urllib.request.Request(
        url,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'},
        data=json.dumps(data).encode('utf-8')
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=10)
        return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {'error': str(e)}

# Query hardware status
print("\n--- Querying /api/v1/hardware/status ---")
status_res = post('/api/v1/hardware/status', {'page_size': 200, 'page_current': 1})
print("status_res code:", status_res.get('code'))
if 'data' in status_res:
    items = status_res['data']
    print(f"Total status items returned: {len(items)}")
    for it in items[:15]:
        print(" ", it)

# Load devices from anqiaoDevices.ts
with open('src/assets/anqiaoDevices.ts', encoding='utf-8') as f:
    text = f.read()

sns = list(dict.fromkeys(re.findall(r'sn:\s*\"([^\"]+)\"', text)))
print(f"\n--- Checking {len(sns)} devices concurrently ---")

results = []
def check_device(sn):
    res = post('/api/v1/hardware/latest_data', {'device_id': sn})
    return sn, res.get('data')

with ThreadPoolExecutor(max_workers=10) as pool:
    for sn, d in pool.map(lambda s: check_device(s), sns):
        if d:
            hr = d.get('hr', 0)
            br = d.get('br', 0)
            isBed = d.get('isBed', False)
            created_at = d.get('created_at', '')
            results.append((sn, hr, br, isBed, created_at))
            if hr > 0 or br > 0 or isBed:
                print(f"  [IN BED] {sn}: hr={hr}, br={br}, isBed={isBed}, time={created_at}")
            else:
                print(f"  [OFF BED] {sn}: hr={hr}, br={br}, isBed={isBed}, time={created_at}")

in_bed = [r for r in results if r[1] > 0 or r[2] > 0 or r[3]]
print(f"\nSUMMARY: Total checked={len(sns)}, with_data={len(results)}, in_bed={len(in_bed)}")
