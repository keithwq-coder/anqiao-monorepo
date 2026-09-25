import urllib.request, json, ssl, time, datetime, re, os, sys
from concurrent.futures import ThreadPoolExecutor

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 凭据经环境变量注入，禁止硬编码（INTEGRATION-SPEC §6-1）
token = os.environ.get('HW_TOKEN', '')
if not token:
    print('缺少凭据：请设置 HW_TOKEN 环境变量', file=sys.stderr)
    sys.exit(1)

def post(endpoint, data):
    url = f'https://api.health-track.anqiaokj.com{endpoint}'
    req = urllib.request.Request(
        url,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'},
        data=json.dumps(data).encode('utf-8')
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=8)
        return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {'error': str(e)}

with open('src/assets/anqiaoDevices.ts', encoding='utf-8') as f:
    text = f.read()
sns = list(dict.fromkeys(re.findall(r'sn:\s*"([^"]+)"', text)))

now_ts = time.time()
print(f'Local time: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', flush=True)

def check_one(sn):
    res = post('/api/v1/hardware/latest_data', {'device_id': sn})
    d = res.get('data')
    return sn, d, res

with ThreadPoolExecutor(max_workers=12) as pool:
    results = list(pool.map(check_one, sns))

live_count = 0
in_bed_count = 0
out_bed_count = 0
offline_count = 0

for sn, d, res in sorted(results, key=lambda x: x[0]):
    if d:
        created_at = d.get('created_at', '')
        hr = d.get('hr', 0)
        br = d.get('br', 0)
        isBed = d.get('isBed', False)
        try:
            t = datetime.datetime.fromisoformat(created_at.replace('Z', '')).timestamp()
            diff_sec = now_ts - t
        except Exception:
            diff_sec = 999999
        is_live = abs(diff_sec) <= 120
        if is_live:
            live_count += 1
            if hr > 0 or br > 0 or isBed:
                in_bed_count += 1
                status = "● 在线·在床"
            else:
                out_bed_count += 1
                status = "● 在线·离床"
        else:
            offline_count += 1
            status = f"○ 历史离线({diff_sec/3600:.1f}h前)"
        print(f'{sn:12} | {status:14} | time={created_at} | hr={hr:4.1f}, br={br:4.1f}, isBed={isBed}', flush=True)
    else:
        offline_count += 1
        print(f'{sn:12} | ○ 离线·无数据   | msg={res.get("msg", res.get("error"))}', flush=True)

print("\n" + "="*50, flush=True)
print(f"统计汇总: 总数={len(sns)}, 实时在线={live_count} (在床={in_bed_count}, 离床={out_bed_count}), 离线={offline_count}", flush=True)
print("="*50, flush=True)
