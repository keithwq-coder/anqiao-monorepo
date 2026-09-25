"""在 nginx 站点配置中为宿迁长护险大屏新增 /suqian-dash/ 站点块。
不影响既有 /dash/（中科安樵+凯健看板）与 /saas/ 配置。nginx -t 失败自动回滚。

鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py），禁止硬编码密码。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

BLOCK_REDIRECT_ANCHOR = "    location = /saas { return 301 /saas/; }"
BLOCK_REDIRECT_ADD = "\n    location = /suqian-dash { return 301 /suqian-dash/; }"

LOCATION_ANCHOR = "    location /saas/ {"
LOCATION_BLOCK = """    # ---- /suqian-dash/ 宿迁长护险试点大屏（Vite+Vue3），部署目录 /var/www/suqian-dash ----
    location /suqian-dash/ {
        alias /var/www/suqian-dash/;
        index index.html;
        try_files $uri $uri/ /suqian-dash/index.html;
        location = /suqian-dash/ { add_header Cache-Control "no-cache, must-revalidate" always; }
        location ~* \\.html$ { add_header Cache-Control "no-cache, must-revalidate" always; }
        location ~* /suqian-dash/assets/.+\\.(js|css)$ { add_header Cache-Control "public, max-age=31536000, immutable" always; }
    }

"""

ssh = connect_ssh()


def run(cmd, sudo=False):
    return run_cmd(ssh, cmd, sudo=sudo)


out, _ = run("cat /etc/nginx/sites-enabled/anqiao")

if "location /suqian-dash/" in out:
    print("/suqian-dash/ 站点块已存在，跳过修改")
    ssh.close()
    sys.exit(0)

assert BLOCK_REDIRECT_ANCHOR in out, "redirect anchor not found"
assert LOCATION_ANCHOR in out, "location anchor not found"

out = out.replace(BLOCK_REDIRECT_ANCHOR, BLOCK_REDIRECT_ANCHOR + BLOCK_REDIRECT_ADD)
out = out.replace(LOCATION_ANCHOR, LOCATION_BLOCK + LOCATION_ANCHOR)

sftp = ssh.open_sftp()
with sftp.open("/tmp/anqiao_nginx_suqian.conf", "w") as f:
    f.write(out)
sftp.close()

run("cp /etc/nginx/sites-enabled/anqiao /tmp/anqiao.bak-suqian", sudo=True)
run("cp /tmp/anqiao_nginx_suqian.conf /etc/nginx/sites-enabled/anqiao", sudo=True)
t_out, t_err = run("nginx -t", sudo=True)
print("nginx -t:", t_out, t_err)

if "successful" in t_out or "successful" in t_err:
    r_out, r_err = run("systemctl reload nginx", sudo=True)
    print("nginx reloaded:", r_out, r_err)
else:
    print("nginx -t FAILED, rolling back!")
    run("cp /tmp/anqiao.bak-suqian /etc/nginx/sites-enabled/anqiao", sudo=True)
    sys.exit(1)

c1, _ = run("curl -s -k -I https://anqiao.aibrain.wiki/suqian-dash/ | head -3")
print("suqian-dash:\n", c1)
c2, _ = run("curl -s -k -I https://anqiao.aibrain.wiki/dash/ | head -3")
print("dash (old dashboard intact):\n", c2)
ssh.close()
