# 窗口 A 上线后只读验证（ubuntu 无权读 root:600 env，用 sudo -n 取口令）
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd


def main():
    ssh = connect_ssh(timeout=20)
    out, err = run_cmd(
        ssh,
        "sudo -n python3 - <<'PY'\n"
        "import json, urllib.request, ssl\n"
        "env={}\n"
        "for line in open('/etc/anqiao-console/env'):\n"
        "    line=line.strip()\n"
        "    if not line or line.startswith('#') or '=' not in line: continue\n"
        "    k,v=line.split('=',1); env[k]=v\n"
        "pw=env.get('SEED_ACCOUNT_PASSWORD','')\n"
        "req=urllib.request.Request(\n"
        "    'http://127.0.0.1:2831/v1/auth/login',\n"
        "    data=json.dumps({'username':'kaijian_admin','password':pw}).encode(),\n"
        "    headers={'Content-Type':'application/json'}, method='POST')\n"
        "with urllib.request.urlopen(req, timeout=10) as r:\n"
        "    body=json.loads(r.read().decode())\n"
        "print('login_code', body.get('code'))\n"
        "token=(body.get('data') or {}).get('token') or ''\n"
        "assert token, 'no token'\n"
        "for path in ['/v1/overview','/v1/floors']:\n"
        "    req2=urllib.request.Request('http://127.0.0.1:2831'+path, headers={'Authorization':'Bearer '+token})\n"
        "    with urllib.request.urlopen(req2, timeout=10) as r:\n"
        "        print(path, r.status)\n"
        "ctx=ssl._create_unverified_context()\n"
        "req3=urllib.request.Request('https://anqiao.aibrain.wiki/v1/overview', headers={'Authorization':'Bearer '+token})\n"
        "with urllib.request.urlopen(req3, timeout=15, context=ctx) as r:\n"
        "    print('public_overview', r.status)\n"
        "print('SMOKE_DONE')\n"
        "PY",
    )
    text = (out or "") + (err or "")
    print(text)
    ssh.close()
    ok = "SMOKE_DONE" in text and "login_code 200" in text
    print("RESULT", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
