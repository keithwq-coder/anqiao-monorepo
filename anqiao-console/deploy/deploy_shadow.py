"""阶段一影子上线脚本（INTEGRATION-SPEC §8 阶段一 / 窗口 A）

动作（严格按序，每步 curl 验证）：
  1. 备份 nginx 配置
  2. 上传 console server/ 与前端 dist/ 到新目录（不动旧 anqiao-saas）
  3. 安装 anqiao-console.service（2831）并启动
  4. nginx 并入 /v1/ 反代块，nginx -t 通过后 reload
  5. 线上只读验证：GET /v1/overview 健康检查 + WS 握手
  6. 确认旧 2830 与 /dash/ /saas/ /suqian-dash/ 行为零变化

执行窗口：仅 23:00–06:00（INTEGRATION-SPEC §7.2）。日间禁止执行本脚本。
回滚：见 WINDOW-A-runbook.md「回滚标准动作」；本脚本保留全部备份路径并打印。

鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py），禁止硬编码密码。
"""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, "dist")
SERVER_CODE_DIR = os.path.join(BASE_DIR, "server")
DEPLOY_DIR = os.path.join(BASE_DIR, "deploy")

REMOTE_APP = "/opt/anqiao-console"
REMOTE_WEB = "/var/www/anqiao-console"
NGINX_SITE = "/etc/nginx/sites-enabled/anqiao"
SERVICE_NAME = "anqiao-console.service"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def create_tar(source_dir: str, arc_prefix: str = "") -> str:
    temp_tar = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False).name
    with tarfile.open(temp_tar, "w:gz") as tar:
        for root, _, files in os.walk(source_dir):
            for f in files:
                if f.endswith((".pyc",)) or "__pycache__" in root:
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, source_dir)
                arc_name = f"{arc_prefix}/{rel_path}" if arc_prefix else rel_path
                tar.add(full_path, arcname=arc_name)
    return temp_tar


def main():
    log("=" * 64)
    log("  阶段一 · console 后端影子上线（:2831）")
    log("  ⚠ 仅允许夜间窗口 23:00-06:00 执行；旧 anqiao-saas.service:2830 不动")
    log("=" * 64)

    if not os.path.exists(os.path.join(DIST_DIR, "index.html")):
        log("错误: 未找到 dist/index.html，请先 npm run build")
        sys.exit(1)

    ssh = connect_ssh()
    sftp = ssh.open_sftp()
    ts = time.strftime("%Y%m%d%H%M%S")

    # ---- 1. 备份 nginx 配置（回滚前置）----
    log("[1/6] 备份 nginx 站点配置 ...")
    bak = f"/tmp/anqiao-nginx-bak-{ts}"
    out, err = run_cmd(ssh, f"cp {NGINX_SITE} {bak} && echo OK")
    if "OK" not in out:
        log(f"备份失败: {err}")
        sys.exit(1)
    log(f"  备份至 {bak}（回滚时 cp 回 {NGINX_SITE}）")

    # ---- 2. 上传并解压到新目录 ----
    log("[2/6] 上传 console server/ 与 dist/ ...")
    server_tar = create_tar(SERVER_CODE_DIR)
    dist_tar = create_tar(DIST_DIR)
    remote_server_tar = f"/tmp/anqiao-console-server-{ts}.tar.gz"
    remote_dist_tar = f"/tmp/anqiao-console-dist-{ts}.tar.gz"
    sftp.put(server_tar, remote_server_tar)
    sftp.put(dist_tar, remote_dist_tar)
    sftp.put(os.path.join(DEPLOY_DIR, "anqiao-console.service"), f"/tmp/anqiao-console-{ts}.service")
    sftp.close()
    os.remove(server_tar)
    os.remove(dist_tar)

    run_cmd(ssh, f"mkdir -p {REMOTE_APP}/server {REMOTE_WEB}", sudo=True)
    run_cmd(ssh, f"tar -xzf {remote_server_tar} -C {REMOTE_APP}/server/", sudo=True)
    run_cmd(ssh, f"tar -xzf {remote_dist_tar} -C {REMOTE_WEB}/", sudo=True)
    # package.json 含 argon2（阶段四）；仅写入新目录，不影响旧服务
    run_cmd(
        ssh,
        f"printf '%s\\n' '{{\"name\":\"anqiao-console-server\",\"type\":\"module\",\"dependencies\":{{\"argon2\":\"^0.45.1\"}}}}' > {REMOTE_APP}/package.json",
        sudo=True,
    )
    run_cmd(ssh, f"chown -R ubuntu:ubuntu {REMOTE_APP} {REMOTE_WEB}", sudo=True)
    run_cmd(ssh, f"rm -f {remote_server_tar} {remote_dist_tar}")
    log(f"  已就位：{REMOTE_APP}/server 、{REMOTE_WEB}")

    # 安装生产依赖（argon2 原生模块）——新目录内操作
    log("  安装 server 依赖 (argon2) ...")
    out, err = run_cmd(ssh, f"cd {REMOTE_APP} && npm install --omit=dev --no-fund --no-audit")
    if out:
        log(f"  npm: {out.splitlines()[-1] if out.splitlines() else out}")
    if err and "npm ERR" in err:
        log(f"  npm 错误: {err[:400]}")
        sys.exit(1)
    run_cmd(ssh, f"chown -R ubuntu:ubuntu {REMOTE_APP}/node_modules 2>/dev/null || true", sudo=True)

    # ---- 3. 安装 systemd unit ----
    log("[3/6] 安装并启动 " + SERVICE_NAME + " ...")
    out, _ = run_cmd(ssh, "test -f /etc/anqiao-console/env && echo ENV_OK")
    if "ENV_OK" not in out:
        log("错误: /etc/anqiao-console/env 不存在或不可读。请先按 deploy/anqiao-console.env.example 在目标机填入")
        log("      TOKEN_SECRET / SEED_ACCOUNT_PASSWORD（chmod 600），再重跑本脚本。")
        sys.exit(1)
    run_cmd(ssh, f"cp /tmp/anqiao-console-{ts}.service /etc/systemd/system/{SERVICE_NAME}", sudo=True)
    run_cmd(ssh, "systemctl daemon-reload", sudo=True)
    run_cmd(ssh, f"systemctl enable {SERVICE_NAME}", sudo=True)
    run_cmd(ssh, f"systemctl restart {SERVICE_NAME}", sudo=True)
    time.sleep(2)
    out, _ = run_cmd(ssh, f"systemctl is-active {SERVICE_NAME}", sudo=True)
    log(f"  服务状态: {out}")
    if out != "active":
        log("错误: 服务未激活，查看 journalctl -u anqiao-console.service；不进入 nginx 变更")
        sys.exit(1)

    # ---- 4. nginx 并入 /v1/ ----
    log("[4/6] nginx 并入 /v1/ 反代块 ...")
    out, _ = run_cmd(ssh, f"grep -c 'location /v1/' {NGINX_SITE}")
    if out.strip() == "0":
        with open(os.path.join(DEPLOY_DIR, "nginx-v1-location.conf"), encoding="utf-8") as f:
            block = f.read()
        # 只取配置块本体（去掉注释尾段）
        block_body = block.split("# 过渡期兼容")[0]
        sftp = ssh.open_sftp()
        with sftp.open(f"/tmp/anqiao-v1-block-{ts}.conf", "w") as fh:
            fh.write(block_body)
        sftp.close()
        # 插入到 server 块内第一个 location 前（锚点：/saas/）
        cmd = (
            f"python3 - <<'PY'\n"
            f"site='{NGINX_SITE}'\n"
            f"block=open('/tmp/anqiao-v1-block-{ts}.conf').read()\n"
            f"src=open(site).read()\n"
            f"assert 'location /v1/' not in src\n"
            f"anchor='    location /saas/ {{'\n"
            f"assert anchor in src, 'anchor not found'\n"
            f"open(site,'w').write(src.replace(anchor, block+anchor, 1))\n"
            f"print('INSERTED')\n"
            f"PY"
        )
        out, err = run_cmd(ssh, cmd, sudo=True)
        log(f"  插入结果: {out} {err}")
    else:
        log("  /v1/ 块已存在，跳过插入")

    out, err = run_cmd(ssh, "nginx -t", sudo=True)
    if "successful" not in (out + err):
        log("nginx -t 失败，立即回滚配置")
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        sys.exit(1)
    run_cmd(ssh, "systemctl reload nginx", sudo=True)
    log("  nginx reload 完成")

    # ---- 5. 线上只读验证 ----
    log("[5/6] 只读验证 /v1/ ...")
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:2831/v1/overview")
    log(f"  本机 GET :2831/v1/overview (无令牌期望 401): {out}")
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/v1/overview")
    log(f"  公网 GET /v1/overview (无令牌期望 401): {out}")
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k -H 'Connection: Upgrade' -H 'Upgrade: websocket' https://anqiao.aibrain.wiki/v1/ws?token=bad")
    log(f"  公网 WS 握手（坏令牌期望 401）: {out}")

    # ---- 6. 旧服务零变化确认 ----
    log("[6/6] 确认旧服务与页面零变化 ...")
    for url in [
        "https://anqiao.aibrain.wiki/saas/",
        "https://anqiao.aibrain.wiki/dash/",
        "https://anqiao.aibrain.wiki/suqian-dash/",
    ]:
        out, _ = run_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' -k {url}")
        log(f"  {url} -> {out}")
    out, _ = run_cmd(ssh, "systemctl is-active anqiao-saas.service", sudo=True)
    log(f"  旧 anqiao-saas.service 状态（应为 active）: {out}")

    ssh.close()
    log("=" * 64)
    log("  阶段一影子上线完成。回滚备份: " + bak)
    log("  留守观察 ≥15 分钟；变更记录见 WINDOW-A-runbook.md")
    log("=" * 64)


if __name__ == "__main__":
    main()
