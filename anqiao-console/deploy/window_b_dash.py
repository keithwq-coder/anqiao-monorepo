# 窗口 B：凯健大屏切换（INTEGRATION-SPEC §8 阶段二）
# 1) 新构建上传 /var/www/anqiao-dash-v2（新增式）
# 2) 备份现网 /var/www/anqiao-dash
# 3) nginx /dash/ alias → dash-v2，nginx -t + reload
# 4) 验证 /dash/ 200 与新 bundle；旧目录保留 ≥7 天
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 本脚本放在 anqiao-console/deploy，产物在 anqiao-dashboard/dist
DASH_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "anqiao-dashboard", "dist"))
NGINX_SITE = "/etc/nginx/sites-enabled/anqiao"
OLD_DIR = "/var/www/anqiao-dash"
V2_DIR = "/var/www/anqiao-dash-v2"


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


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
    log("窗口 B · 凯健大屏 /dash/ 切换到新构建")
    if not os.path.exists(os.path.join(DASH_DIR, "index.html")):
        log(f"缺少产物 {DASH_DIR}/index.html")
        return 1

    ssh = connect_ssh(timeout=20)
    sftp = ssh.open_sftp()
    ts = time.strftime("%Y%m%d%H%M%S")

    # nginx 备份
    bak = f"/tmp/anqiao-nginx-bak-{ts}"
    out, err = run_cmd(ssh, f"cp {NGINX_SITE} {bak} && echo OK")
    if "OK" not in out:
        log(f"nginx 备份失败: {err}")
        return 1
    log(f"nginx 备份: {bak}")

    # 上传到 v2 —— 整段命令必须在同一 sudo 下（run_cmd 仅前缀第一个词）
    dist_tar = create_tar(DASH_DIR)
    remote_tar = f"/tmp/anqiao-dash-v2-{ts}.tar.gz"
    sftp.put(dist_tar, remote_tar)
    os.remove(dist_tar)
    sftp.close()
    out, err = run_cmd(
        ssh,
        f"bash -c 'rm -rf {V2_DIR} && mkdir -p {V2_DIR} && tar -xzf {remote_tar} -C {V2_DIR}/ && rm -f {remote_tar} && chown -R ubuntu:ubuntu {V2_DIR} && chmod -R 755 {V2_DIR} && test -f {V2_DIR}/index.html && echo V2_OK'",
        sudo=True,
    )
    log(f"预发 v2: {out} {err}")
    if "V2_OK" not in (out or ""):
        log("v2 预发失败，不切换 alias")
        return 1
    log(f"已预发 {V2_DIR}")

    # 备份现网旧目录
    old_bak = f"{OLD_DIR}.bak-{ts}"
    out, err = run_cmd(
        ssh,
        f"bash -c 'mkdir -p {old_bak} && cp -rf {OLD_DIR}/. {old_bak}/ && test -f {old_bak}/index.html && echo BAK_OK'",
        sudo=True,
    )
    log(f"旧目录备份: {old_bak} {out} {err}")
    if "BAK_OK" not in (out or ""):
        log("旧目录备份失败，中止")
        return 1

    # 切换 alias → v2（仅当 v2 已验证）
    out, _ = run_cmd(ssh, f"grep -n 'alias {V2_DIR}/' {NGINX_SITE} || true")
    if f"alias {V2_DIR}/" not in (out or ""):
        cmd = (
            f"python3 - <<'PY'\n"
            f"site='{NGINX_SITE}'\n"
            f"src=open(site).read()\n"
            f"old='alias {OLD_DIR}/;'\n"
            f"new='alias {V2_DIR}/;'\n"
            f"assert old in src, 'old alias not found'\n"
            f"open(site,'w').write(src.replace(old, new, 1))\n"
            f"print('SWITCHED')\n"
            f"PY"
        )
        out, err = run_cmd(ssh, cmd, sudo=True)
        log(f"alias 切换: {out} {err}")
        if "SWITCHED" not in out:
            run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
            log("切换失败，已回滚 nginx")
            return 1
    else:
        log("alias 已是 v2，跳过")

    out, err = run_cmd(ssh, "nginx -t", sudo=True)
    if "successful" not in (out + err):
        log("nginx -t 失败，回滚")
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        return 1
    run_cmd(ssh, "systemctl reload nginx", sudo=True)
    log("nginx reload OK")

    # 验证：先确认 v2 文件在，再 curl
    out_ls, _ = run_cmd(ssh, f"test -f {V2_DIR}/index.html && echo FILE_OK || echo FILE_MISSING")
    log(f"v2 文件: {out_ls}")
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/dash/")
    log(f"/dash/ → {out}")
    out_html, _ = run_cmd(ssh, f"cat {V2_DIR}/index.html 2>/dev/null || true")
    has_bundle = "assets/index-" in out_html
    log(f"v2 index bundle: {'OK' if has_bundle else 'FAIL'}")
    out_pub, _ = run_cmd(ssh, "curl -sk https://anqiao.aibrain.wiki/dash/")
    pub_bundle = "assets/index-" in out_pub
    log(f"公网 index bundle: {'OK' if pub_bundle else 'FAIL'}")

    ok = out.strip() == "200" and has_bundle and pub_bundle and "FILE_OK" in (out_ls or "")
    if not ok:
        log("验证失败，立即回滚 alias")
        run_cmd(ssh, f"cp {bak} {NGINX_SITE}", sudo=True)
        run_cmd(ssh, "nginx -t && systemctl reload nginx", sudo=True)
        out2, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/dash/")
        log(f"回滚后 /dash/ → {out2}")
        ssh.close()
        return 1

    ssh.close()
    log(f"窗口 B 完成；回滚: cp {bak} {NGINX_SITE} && alias 回 {OLD_DIR}")
    log(f"旧目录备份保留: {old_bak}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
