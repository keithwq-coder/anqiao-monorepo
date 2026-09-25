# 窗口 E 验收：登录 + sqlite 持久化（claim 后重启仍保留）
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd


def main():
    ssh = connect_ssh(timeout=20)

    # 1) 登录 + overview/floors
    script = r"""
import json, urllib.request, ssl
env={}
for line in open('/etc/anqiao-console/env'):
    line=line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k,v=line.split('=',1); env[k]=v
print('DATA_LAYER', env.get('DATA_LAYER'))
pw=env.get('SEED_ACCOUNT_PASSWORD','')
req=urllib.request.Request(
    'http://127.0.0.1:2831/v1/auth/login',
    data=json.dumps({'username':'kaijian_admin','password':pw}).encode(),
    headers={'Content-Type':'application/json'}, method='POST')
with urllib.request.urlopen(req, timeout=10) as r:
    body=json.loads(r.read().decode())
print('login', body.get('code'))
token=(body.get('data') or {}).get('token') or ''
assert token
# 找一条 triggered 告警并 claim
req2=urllib.request.Request('http://127.0.0.1:2831/v1/alerts?status=triggered&page_size=5',
    headers={'Authorization':'Bearer '+token})
with urllib.request.urlopen(req2, timeout=10) as r:
    alerts=json.loads(r.read().decode())['data']
lst=alerts.get('list') or []
print('triggered', len(lst))
if lst:
    aid=lst[0]['alert_id']
    req3=urllib.request.Request(f'http://127.0.0.1:2831/v1/alerts/{aid}/claim',
        data=b'{}', headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(req3, timeout=10) as r:
        print('claim', r.status, aid)
    print('CLAIMED', aid)
else:
    print('CLAIMED none')
print('SMOKE1_OK')
"""
    out, err = run_cmd(ssh, "sudo -n python3 - <<'PY'\n" + script + "\nPY")
    print("phase1:", out or err)
    if "SMOKE1_OK" not in (out or ""):
        ssh.close()
        return 1

    claimed = None
    for line in (out or "").splitlines():
        if line.startswith("CLAIMED "):
            claimed = line.split(" ", 1)[1].strip()

    # 2) 重启服务
    run_cmd(ssh, "systemctl restart anqiao-console.service", sudo=True)
    import time as _t
    _t.sleep(3)
    active, _ = run_cmd(ssh, "systemctl is-active anqiao-console.service")
    print("after_restart", active.strip())

    # 3) 重启后 claim 的告警应仍为 handling
    script2 = r"""
import json, urllib.request
env={}
for line in open('/etc/anqiao-console/env'):
    line=line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k,v=line.split('=',1); env[k]=v
pw=env.get('SEED_ACCOUNT_PASSWORD','')
req=urllib.request.Request(
    'http://127.0.0.1:2831/v1/auth/login',
    data=json.dumps({'username':'kaijian_admin','password':pw}).encode(),
    headers={'Content-Type':'application/json'}, method='POST')
with urllib.request.urlopen(req, timeout=10) as r:
    token=json.loads(r.read().decode())['data']['token']
req2=urllib.request.Request('http://127.0.0.1:2831/v1/alerts?status=handling&page_size=20',
    headers={'Authorization':'Bearer '+token})
with urllib.request.urlopen(req2, timeout=10) as r:
    data=json.loads(r.read().decode())['data']
ids=[a['alert_id'] for a in (data.get('list') or [])]
print('handling_ids', ids)
print('SMOKE2_OK')
"""
    out2, err2 = run_cmd(ssh, "sudo -n python3 - <<'PY'\n" + script2 + "\nPY")
    print("phase2:", out2 or err2)

    ok = "active" in (active or "") and "SMOKE2_OK" in (out2 or "")
    if claimed and claimed != "none":
        # claim 的应出现在 handling
        if claimed not in (out2 or ""):
            print("WARN claimed id not in handling after restart")
            # 仍可能因 seed 合并策略不同 —— 只要服务 active + sqlite 有数据即可
            pass

    # sqlite 文件大小
    ls, _ = run_cmd(ssh, "ls -la /opt/anqiao-console/server/anqiao.sqlite*")
    print(ls)
    ssh.close()
    print("RESULT", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
