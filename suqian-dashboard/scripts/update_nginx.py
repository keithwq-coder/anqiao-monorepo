"""nginx 站点配置更新脚本（/hardware-api/ 反代）。
鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py），禁止硬编码密码。
硬件云冒烟凭据经 HW_ACCOUNT / HW_PASSWORD 环境变量注入，禁止硬编码。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

ssh = connect_ssh()


def run(cmd, sudo=False):
    return run_cmd(ssh, cmd, sudo=sudo)


# Clean up any bad bak file in sites-enabled
run("rm -f /etc/nginx/sites-enabled/anqiao.bak", sudo=True)

out, _ = run("cat /etc/nginx/sites-enabled/anqiao")

# 1. Update CSP connect-src
old_csp = "connect-src 'self' https://ssl.captcha.qq.com;"
new_csp = "connect-src 'self' https://ssl.captcha.qq.com https://api.health-track.anqiaokj.com;"
if old_csp in out:
    out = out.replace(old_csp, new_csp)
    print("Replaced CSP connect-src")

# 2. Add /hardware-api/ block before location /dash/
proxy_block = """    # ---- /hardware-api/ 反向代理安樵云平台接口 ----
    location /hardware-api/ {
        proxy_pass https://api.health-track.anqiaokj.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host api.health-track.anqiaokj.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

"""

if "location /hardware-api/" not in out:
    target = "    location /dash/ {"
    out = out.replace(target, proxy_block + target)
    print("Added /hardware-api/ proxy block")

# Write to temp file on server then sudo cp
sftp = ssh.open_sftp()
with sftp.open("/tmp/anqiao_nginx.conf", "w") as f:
    f.write(out)
sftp.close()

run("cp /etc/nginx/sites-enabled/anqiao /tmp/anqiao.bak", sudo=True)
run("cp /tmp/anqiao_nginx.conf /etc/nginx/sites-enabled/anqiao", sudo=True)
t_out, t_err = run("nginx -t", sudo=True)
print("nginx -t output:", t_out, t_err)

if "successful" in t_out or "successful" in t_err:
    r_out, r_err = run("systemctl reload nginx", sudo=True)
    print("nginx reloaded successfully!")
else:
    print("nginx -t FAILED, rolling back!")
    run("cp /tmp/anqiao.bak /etc/nginx/sites-enabled/anqiao", sudo=True)

# Test proxy from curl（凭据经环境变量注入）
hw_account = os.environ.get("HW_ACCOUNT", "")
hw_password = os.environ.get("HW_PASSWORD", "")
if hw_account and hw_password:
    test_out, _ = run(
        "curl -s -k https://anqiao.aibrain.wiki/hardware-api/api/v1/auth/login "
        f"-H 'Content-Type: application/json' -d '{{\"account\":\"{hw_account}\",\"password\":\"{hw_password}\"}}'"
    )
    print("TEST PROXY RESULT:\n", test_out[:200])
else:
    print("未设置 HW_ACCOUNT/HW_PASSWORD，跳过代理冒烟测试")

ssh.close()
