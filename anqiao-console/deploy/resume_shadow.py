# 窗口 A 续跑：重传 server 代码 → 装 argon2 → 起服务 →（active 才）nginx /v1/
# 不动旧 anqiao-saas.service:2830 与三页静态指向
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_CODE_DIR = os.path.join(BASE_DIR, "server")
DEPLOY_DIR = os.path.join(BASE_DIR, "deploy")
REMOTE_APP = "/opt/anqiao-console"
NGINX_SITE = "/etc/nginx/sites-enabled/anqiao"
SERVICE_NAME = "anqiao-console.service"


def log(msg: str) -> None:
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


def main() -> int:
    log("窗口 A 续跑 · 修复 Node20/sqlite 兼容并完成影子上线")
    ssh = connect_ssh(timeout=20)
    sftp = ssh.open_sftp()
    ts = time.strftime("%Y%m%d%H%M%S")

    # 备份 nginx（幂等：每次变更前备份）
    bak = f"/tmp/anqiao-nginx-bak-{ts}"
    out, err = run_cmd(ssh, f"cp {NGINX_SITE} {bak} && echo OK")
    if "OK" not in out:
        log(f"nginx 备份失败: {err}")
        return 1
    log(f"nginx 备份: {bak}")

    # 停服务避免写冲突
    run_cmd(ssh, f"systemctl stop {SERVICE_NAME} || true", sudo=True)

    # 重传 server/
    server_tar = create_tar(SERVER_CODE_DIR)
    remote_tar = f"/tmp/anqiao-console-server-{ts}.tar.gz"
    sftp.put(server_tar, remote_tar)
    os.remove(server_tar)
    run_cmd(ssh, f"rm -rf {REMOTE_APP}/server && mkdir -p {REMOTE_APP}/server", sudo=True)
    run_cmd(ssh, f"tar -xzf {remote_tar} -C {REMOTE_APP}/server/ && rm -f {remote_tar}", sudo=True)

    # package.json + argon2
    pkg = '{"name":"anqiao-console-server","type":"module","dependencies":{"argon2":"^0.45.1"}}'
    stdin, stdout, stderr = ssh.exec_command(f"cat > {REMOTE_APP}/package.json")
    stdin.write(pkg)
    stdin.channel.shutdown_write()
    stdout.read()
    stderr.read()
    run_cmd(ssh, f"chown -R ubuntu:ubuntu {REMOTE_APP}", sudo=True)
    log("npm install argon2 ...")
    out, err = run_cmd(ssh, f"cd {REMOTE_APP} && npm install --omit=dev --no-fund --no-audit 2>&1")
    log((out or err or "")[-500:])
    if "npm ERR" in (err or ""):
        log("npm install 失败")
        return 1
    argon_ok, _ = run_cmd(ssh, f"test -d {REMOTE_APP}/node_modules/argon2 && echo ARGON_OK || echo ARGON_MISSING")
    log(f"argon2: {argon_ok}")
    if "ARGON_OK" not in argon_ok:
        return 1

    # env 必须在
    out, _ = run_cmd(ssh, "test -f /etc/anqiao-console/env && echo ENV_OK")
    if "ENV_OK" not in out:
        log("缺少 /etc/anqiao-console/env")
        return 1

    # 启动服务
    run_cmd(ssh, f"systemctl reset-failed {SERVICE_NAME} || true", sudo=True)
    run_cmd(ssh, f"systemctl restart {SERVICE_NAME}", sudo=True)
    active = ""
    for _ in range(15):
        time.sleep(2)
        active, _ = run_cmd(ssh, f"systemctl is-active {SERVICE_NAME}")
        if active.strip() == "active":
            break
        log(f"  服务状态: {active.strip() or '?'}")
    log(f"最终服务状态: {active.strip()}")
    if active.strip() != "active":
        out, err = run_cmd(ssh, f"journalctl -u {SERVICE_NAME} -n 30 --no-pager")
        log(out or err)
        return 1

    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:2831/v1/overview")
    log(f"本机 :2831 未认证期望 401 → {out}")
    if out.strip() not in ("401", "404"):
        # 401 正常；其它仍继续但记录
        log("警告: 非预期状态码")

    # nginx /v1/
    out, _ = run_cmd(ssh, f"grep -c 'location /v1/' {NGINX_SITE}")
    if (out or "0").strip() == "0":
        with open(os.path.join(DEPLOY_DIR, "nginx-v1-location.conf"), encoding="utf-8") as f:
            block_body = f.read().split("# 过渡期兼容")[0]
        remote_block = f"/tmp/anqiao-v1-block-{ts}.conf"
        stdin, stdout, stderr = ssh.exec_command(f"cat > {remote_block}")
        stdin.write(block_body)
        stdin.channel.shutdown_write()
        stdout.read()
        stderr.read()
        cmd = (
            f"python3 - <<'PY'\n"
            f"site='{NGINX_SITE}'\n"
            f"block=open('{remote_block}').read()\n"
            f"src=open(site).read()\n"
            f"assert 'location /v1/' not in src\n"
            f"anchor='    location /saas/ {{'\n"
            f"assert anchor in src, 'anchor not found'\n"
            f"open(site,'w').write(src.replace(anchor, block+anchor, 1))\n"
            f"print('INSERTED')\n"
            f"PY"
        )
        out, err = run_cmd(ssh, cmd, sudo=True)
        log(f"插入 /v1/: {out} {err}")
        if "INSERTED" not in out:
            run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
            log("插入失败，已回滚 nginx")
            return 1
    else:
        log("/v1/ 已存在，跳过插入")

    out, err = run_cmd(ssh, "nginx -t", sudo=True)
    if "successful" not in (out + err):
        log("nginx -t 失败，回滚")
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        run_cmd(ssh, "nginx -t && systemctl reload nginx", sudo=True)
        return 1
    run_cmd(ssh, "systemctl reload nginx", sudo=True)
    log("nginx reload OK")

    # 只读验证
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/v1/overview")
    log(f"公网 /v1/overview 未认证 → {out}")
    out, _ = run_cmd(
        ssh,
        "curl -s -o /dev/null -w '%{http_code}' -k -H 'Connection: Upgrade' -H 'Upgrade: websocket' 'https://anqiao.aibrain.wiki/v1/ws?token=bad'",
    )
    log(f"公网 WS 坏令牌 → {out}")

    for url in [
        "https://anqiao.aibrain.wiki/saas/",
        "https://anqiao.aibrain.wiki/dash/",
        "https://anqiao.aibrain.wiki/suqian-dash/",
    ]:
        out, _ = run_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' -k {url}")
        log(f"{url} → {out}")
    out, _ = run_cmd(ssh, "systemctl is-active anqiao-saas.service")
    log(f"旧服务 anqiao-saas → {out}")

    sftp.close()
    ssh.close()
    log(f"完成。回滚备份: {bak}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
