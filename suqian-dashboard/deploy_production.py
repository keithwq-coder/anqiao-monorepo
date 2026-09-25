"""宿迁医保局长护险试点大屏生产自动化部署脚本
目标环境：124.222.212.159 (https://anqiao.aibrain.wiki/suqian-dash/)
注意：/var/www/anqiao-dash (/dash/) 为原中科安樵+凯健看板，严禁覆盖。

鉴权：SSH 密钥 / ssh-agent（见 ssh_auth.py），禁止硬编码密码（INTEGRATION-SPEC §6-2）。
"""
import os
import subprocess
import sys
import tarfile
import tempfile
import time

from ssh_auth import connect_ssh, run

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
REMOTE_TARGET = "/var/www/suqian-dash"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def create_tar(source_dir: str) -> str:
    temp_tar = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False).name
    with tarfile.open(temp_tar, "w:gz") as tar:
        for root, _, files in os.walk(source_dir):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, source_dir)
                tar.add(full_path, arcname=rel_path)
    return temp_tar


def main():
    log("=" * 60)
    log("  宿迁医保局长护险试点 · suqian-dashboard 大屏生产部署开始")
    log("  目标主机: anqiao.aibrain.wiki/suqian-dash/")
    log("=" * 60)

    # 1. 本地执行构建确保最新
    log("[1/5] 本地执行 npm run build 构建最新生产产物...")
    res = subprocess.run(["npm.cmd", "run", "build"], cwd=BASE_DIR, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        log("构建失败:\n" + res.stderr)
        sys.exit(1)
    log("  构建成功！产物已生成至 dist/")

    # 检查本地产物
    index_html = os.path.join(DIST_DIR, "index.html")
    if not os.path.exists(index_html):
        log("错误: 未找到 dist/index.html")
        sys.exit(1)

    # 2. 打包本地 dist
    log("[2/5] 打包本地 dist/ 静态产物...")
    dist_tar = create_tar(DIST_DIR)
    log(f"  dist 压缩包体积: {os.path.getsize(dist_tar)/1024:.1f} KB")

    # 3. 连接服务器（密钥 / agent）
    log("[3/5] 连接生产服务器 ...")
    ssh = connect_ssh()
    sftp = ssh.open_sftp()
    log("  SSH & SFTP 连接成功")

    ts = time.strftime("%Y%m%d%H%M%S")

    # 4. 服务器端备份与文件上传
    log("[4/5] 执行服务器端备份并同步新版本...")
    bak_dir = f"{REMOTE_TARGET}.bak-{ts}"
    run(ssh, f"mkdir -p {bak_dir}", sudo=True)
    run(ssh, f"cp -rf {REMOTE_TARGET}/* {bak_dir}/ 2>/dev/null || true", sudo=True)
    log(f"  已备份旧版本到: {bak_dir}")

    remote_tar = f"/tmp/suqian-dash-{ts}.tar.gz"
    sftp.put(dist_tar, remote_tar)
    sftp.close()
    os.remove(dist_tar)
    log("  新版本压缩包上传完毕")

    # 5. 解压并覆盖
    tmp_extract = f"/tmp/suqian-dash-tmp-{ts}"
    run(ssh, f"mkdir -p {tmp_extract}")
    run(ssh, f"tar -xzf {remote_tar} -C {tmp_extract}/")
    run(ssh, f"mkdir -p {REMOTE_TARGET}", sudo=True)
    run(ssh, f"rm -rf {REMOTE_TARGET}/*", sudo=True)
    run(ssh, f"cp -rf {tmp_extract}/* {REMOTE_TARGET}/", sudo=True)
    run(ssh, f"chown -R ubuntu:ubuntu {REMOTE_TARGET}", sudo=True)
    run(ssh, f"chmod -R 755 {REMOTE_TARGET}", sudo=True)
    run(ssh, f"rm -rf {tmp_extract} {remote_tar}")
    log(f"  已成功部署至 {REMOTE_TARGET}")

    # 6. 验证
    log("[5/5] 执行线上可用性与静态文件冒烟测试...")
    smoke_html = run(ssh, f"cat {REMOTE_TARGET}/index.html")
    has_bundle = "index-" in smoke_html
    log(f"  index.html 验证: {'[OK]' if has_bundle else '[FAIL]'}")

    smoke_dash_curl = run(ssh, "curl -s -k -I https://anqiao.aibrain.wiki/suqian-dash/")
    log("  公网入口 https://anqiao.aibrain.wiki/suqian-dash/ 响应状态:")
    for line in smoke_dash_curl.splitlines()[:5]:
        log("    " + line)

    ssh.close()
    log("=" * 60)
    log("  [SUCCESS] 宿迁长护险试点大屏生产部署完成！")
    log("  公网在线访问地址: https://anqiao.aibrain.wiki/suqian-dash/")
    log("=" * 60)


if __name__ == "__main__":
    main()
