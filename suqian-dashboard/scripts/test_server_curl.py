"""从生产机发起硬件云登录连通性测试（诊断用）。
鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py），禁止硬编码密码。
硬件云凭据经 HW_ACCOUNT / HW_PASSWORD 环境变量注入，禁止硬编码。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

hw_account = os.environ.get("HW_ACCOUNT", "")
hw_password = os.environ.get("HW_PASSWORD", "")
if not (hw_account and hw_password):
    print("缺少凭据：请设置 HW_ACCOUNT + HW_PASSWORD 环境变量", file=sys.stderr)
    sys.exit(1)

ssh = connect_ssh()

cmd = f"""python3 -c "
import urllib.request, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request(
    'https://api.health-track.anqiaokj.com/api/v1/auth/login',
    headers={{'Content-Type': 'application/json'}},
    data=json.dumps({{'account': '{hw_account}', 'password': '{hw_password}'}}).encode('utf-8')
)
try:
    resp = urllib.request.urlopen(req, context=ctx, timeout=8)
    print(resp.status, resp.read()[:200])
except Exception as e:
    print('ERR', e)
"
"""
_, out, _ = ssh.exec_command(cmd)
print(out.read().decode("utf-8", errors="replace"))
ssh.close()
