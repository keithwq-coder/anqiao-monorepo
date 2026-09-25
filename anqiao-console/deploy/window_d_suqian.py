# 窗口 D：宿迁大屏 /suqian-dash/ 切到合流新构建
# 不动 2830（/saas/api 仍依赖旧服务；下线另窗）
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "anqiao-dashboard", "dist"))
NGINX_SITE = "/etc/nginx/sites-enabled/anqiao"
OLD_DIR = "/var/www/suqian-dash"
V2_DIR = "/var/www/suqian-dash-v2"


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}]{msg}", flush=True)


def create_tar(source_dir: str) -> str:
    temp_tar = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False).name
    with tarfile.open(temp_tar, "w:gz") as tar:
        for root, _, files in os.walk(source_dir):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, source_dir)
                tar.add(full_path, arcname=rel_path)
    return temp_tar


def main() -> int:
    log(" 窗口 D · 宿迁大屏 /suqian-dash/ 切换")
    if not os.path.exists(os.path.join(DIST_DIR, "index.html")):
        log(f"缺少产物 {DIST_DIR}")
        return 1

    # 确认是 suqian 构建（base 路径）
    with open(os.path.join(DIST_DIR, "index.html"), encoding="utf-8") as f:
        html = f.read()
    if "/suqian-dash/" not in html:
        log("产物 base 不是 /suqian-dash/，请先 VITE_PROJECT=suqian 构建")
        return 1

    ssh = connect_ssh(timeout=20)
    sftp = ssh.open_sftp()
    ts = time.strftime("%Y%m%d%H%M%S")

    bak = f"/tmp/anqiao-nginx-bak-{ts}"
    out, err = run_cmd(ssh, f"cp {NGINX_SITE} {bak} && echo OK")
    if "OK" not in out:
        log(f"nginx 备份失败: {err}")
        return 1
    log(f" nginx 备份: {bak}")

    dist_tar = create_tar(DIST_DIR)
    remote_tar = f"/tmp/suqian-dash-v2-{ts}.tar.gz"
    sftp.put(dist_tar, remote_tar)
    os.remove(dist_tar)
    sftp.close()

    out, err = run_cmd(
        ssh,
        f"bash -c 'rm -rf {V2_DIR} && mkdir -p {V2_DIR} && tar -xzf {remote_tar} -C {V2_DIR}/ && rm -f {remote_tar} && chown -R ubuntu:ubuntu {V2_DIR} && chmod -R 755 {V2_DIR} && test -f {V2_DIR}/index.html && echo V2_OK'",
        sudo=True,
    )
    log(f"预发: {out} {err}")
    if "V2_OK" not in (out or ""):
        return 1

    old_bak = f"{OLD_DIR}.bak-{ts}"
    out, err = run_cmd(
        ssh,
        f"bash -c 'mkdir -p {old_bak} && cp -rf {OLD_DIR}/. {old_bak}/ && test -f {old_bak}/index.html && echo BAK_OK'",
        sudo=True,
    )
    log(f"备份: {old_bak} {out}")
    if "BAK_OK" not in (out or ""):
        return 1

    # 切换 alias
    out, _ = run_cmd(ssh, f"grep -n 'alias {V2_DIR}/' {NGINX_SITE} || true")
    if f"alias {V2_DIR}/" not in (out or ""):
        cmd = (
            f"python3 - <<'PY'\n"
            f"site='{NGINX_SITE}'\n"
            f"src=open(site).read()\n"
            f"old='alias {OLD_DIR}/;'\n"
            f"new='alias {V2_DIR}/;'\n"
            f"assert old in src, 'suqian old alias not found'\n"
            f"open(site,'w').write(src.replace(old, new, 1))\n"
            f"print('SWITCHED')\n"
            f"PY"
        )
        out, err = run_cmd(ssh, cmd, sudo=True)
        log(f"alias: {out} {err}")
        if "SWITCHED" not in out:
            run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
            return 1

    out, err = run_cmd(ssh, "nginx -t", sudo=True)
    if "successful" not in (out + err):
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        log("nginx -t 失败已回滚")
        return 1
    run_cmd(ssh, "systemctl reload nginx", sudo=True)
    log(" nginx reload OK")

    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/suqian-dash/")
    log(f"/suqian-dash/ → {out}")
    out_pub, _ = run_cmd(ssh, "curl -sk https://anqiao.aibrain.wiki/suqian-dash/")
    pub_ok = "assets/index-" in out_pub
    log(f"公网 bundle: {'OK' if pub_ok else 'FAIL'}")
    # 三页 + v1 仍可用
    for path in ["/saas/", "/dash/", "/v1/overview"]:
        code, _ = run_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' -k https://anqiao.aibrain.wiki{path}")
        log(f"{path} → {code}")

    ok = out.strip() == "200" and pub_ok
    if not ok:
        log("验证失败回滚")
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        run_cmd(ssh, "nginx -t && systemctl reload nginx", sudo=True)
        ssh.close()
        return 1

    # 2830 不在本步下线（/saas/api 仍依赖）；记录
    out, _ = run_cmd(ssh, "systemctl is-active anqiao-saas.service")
    log(f"旧服务仍保持: {out}（2830 下线需另窗且先切 /saas/api）")
    ssh.close()
    log(f"窗口 D 静态切换完成；回滚 bak={bak} alias 回 {OLD_DIR}")
    log(f"旧目录: {old_bak}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
