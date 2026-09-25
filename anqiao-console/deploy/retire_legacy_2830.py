"""阶段三收尾：旧 anqiao-saas.service:2830 下线脚本（INTEGRATION-SPEC §8 阶段三 / §7.3）

⚠ 仅允许夜间窗口 23:00-06:00 执行；且必须在阶段三验收通过后。
⚠ 旧 unit 文件「只停不删」（阶段三验收前保留回滚能力）。

动作：
  1. 确认 anqiao-console.service:2831 健康（/v1/overview 可达）
  2. 备份 nginx 配置
  3. 将 /saas/api/ 从 2830 切到 2831（剥前缀，兼容未决项 2 过渡期并存）
  4. systemctl stop anqiao-saas.service（不 disable、不 rm unit）
  5. 验证 /saas/ /dash/ /suqian-dash/ 与 /v1/ 全部可用

回滚：systemctl start anqiao-saas.service；nginx 配置 cp 回备份。
鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py）。
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

NGINX_SITE = "/etc/nginx/sites-enabled/anqiao"
OLD_SERVICE = "anqiao-saas.service"
NEW_SERVICE = "anqiao-console.service"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    log("=" * 64)
    log("  阶段三收尾 · 旧 anqiao-saas.service:2830 下线")
    log("  ⚠ 仅夜间窗口执行；unit 文件只停不删")
    log("=" * 64)

    ssh = connect_ssh()
    ts = time.strftime("%Y%m%d%H%M%S")

    # 0. 前置：新服务必须健康
    out, _ = run_cmd(ssh, f"systemctl is-active {NEW_SERVICE}", sudo=True)
    if out != "active":
        log(f"中止: {NEW_SERVICE} 未 active（{out}）")
        sys.exit(1)
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:2831/v1/overview")
    log(f"  新服务 /v1/overview 本机状态（无令牌期望 401）: {out}")

    # 1. 备份 nginx
    bak = f"/tmp/anqiao-nginx-bak-{ts}"
    out, err = run_cmd(ssh, f"cp {NGINX_SITE} {bak} && echo OK")
    if "OK" not in out:
        log(f"备份失败: {err}")
        sys.exit(1)
    log(f"  nginx 备份至 {bak}")

    # 2. /saas/api/ → 2831（剥前缀）
    log("[1/4] 切换 /saas/api/ 到 2831 ...")
    cmd = (
        "python3 - <<'PY'\n"
        f"site='{NGINX_SITE}'\n"
        "src=open(site).read()\n"
        "import re\n"
        "pat=re.compile(r'location /saas/api/ \\{[^}]*proxy_pass http://127\\.0\\.0\\.1:2830/?[^}]*\\}', re.S)\n"
        "new='''location /saas/api/ {\n"
        "        proxy_pass http://127.0.0.1:2831/;\n"
        "        proxy_http_version 1.1;\n"
        "        proxy_set_header Host $host;\n"
        "        proxy_set_header X-Real-IP $remote_addr;\n"
        "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
        "        proxy_set_header X-Forwarded-Proto $scheme;\n"
        "        proxy_set_header Upgrade $http_upgrade;\n"
        "        proxy_set_header Connection \\\"upgrade\\\";\n"
        "        proxy_read_timeout 3600s;\n"
        "    }'''\n"
        "out,n=pat.subn(new,src,count=1)\n"
        "print('REPLACED',n)\n"
        "open(site,'w').write(out)\n"
        "PY"
    )
    out, err = run_cmd(ssh, cmd, sudo=True)
    log(f"  结果: {out} {err}")

    out, err = run_cmd(ssh, "nginx -t", sudo=True)
    if "successful" not in (out + err):
        log("nginx -t 失败，回滚配置")
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        sys.exit(1)
    run_cmd(ssh, "systemctl reload nginx", sudo=True)

    # 3. 停旧服务（只停不删）
    log("[2/4] 停止旧服务（unit 文件保留）...")
    run_cmd(ssh, f"systemctl stop {OLD_SERVICE}", sudo=True)
    out, _ = run_cmd(ssh, f"systemctl is-active {OLD_SERVICE}", sudo=True)
    log(f"  旧服务状态: {out}（期望 inactive/failed，unit 文件仍在 /etc/systemd/system/）")

    # 4. 验证
    log("[3/4] 验证关键路径 ...")
    for url in [
        "https://anqiao.aibrain.wiki/saas/",
        "https://anqiao.aibrain.wiki/dash/",
        "https://anqiao.aibrain.wiki/suqian-dash/",
        "https://anqiao.aibrain.wiki/v1/overview",
    ]:
        out, _ = run_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' -k {url}")
        log(f"  {url} -> {out}")

    log("[4/4] 完成。回滚：systemctl start anqiao-saas.service && cp " + bak + " " + NGINX_SITE)
    ssh.close()


if __name__ == "__main__":
    main()
