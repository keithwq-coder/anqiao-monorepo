"""中科安樵 anqiao-console 生产服务器自动化部署脚本
目标环境：124.222.212.159 (anqiao.aibrain.wiki)

鉴权：SSH 密钥 / ssh-agent（见 ssh_auth.py），禁止硬编码密码（INTEGRATION-SPEC §6-2）。
"""
import os
import sys
import tarfile
import tempfile
import time

from ssh_auth import connect_ssh, run

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
SERVER_CODE_DIR = os.path.join(BASE_DIR, "server")


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def create_tar(source_dir: str, arc_prefix: str = "") -> str:
    temp_tar = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False).name
    with tarfile.open(temp_tar, "w:gz") as tar:
        for root, _, files in os.walk(source_dir):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, source_dir)
                arc_name = f"{arc_prefix}/{rel_path}" if arc_prefix else rel_path
                tar.add(full_path, arcname=arc_name)
    return temp_tar


def main():
    log("=" * 60)
    log("  中科安樵 · anqiao-console 生产部署开始")
    log("  目标主机: anqiao.aibrain.wiki")
    log("=" * 60)

    # 1. 检查本地编译产物
    index_html = os.path.join(DIST_DIR, "index.html")
    if not os.path.exists(index_html):
        log("错误: 未找到 dist/index.html，请先在本地执行 npm run build")
        sys.exit(1)
    log("本地前端编译产物检查通过")

    # 2. 打包本地 server 与 dist
    log("打包本地 server/ 与 dist/ ...")
    server_tar = create_tar(SERVER_CODE_DIR)
    dist_tar = create_tar(DIST_DIR)
    log(f"  server 包: {os.path.getsize(server_tar)/1024:.1f} KB")
    log(f"  dist 包:   {os.path.getsize(dist_tar)/1024:.1f} KB")

    # 3. 连接目标服务器（密钥 / agent）
    log("连接服务器 ...")
    ssh = connect_ssh()
    sftp = ssh.open_sftp()
    log("SSH & SFTP 连接成功")

    ts = time.strftime("%Y%m%d%H%M%S")

    # 4. 执行远程备份
    log("[1/5] 执行服务器端备份...")
    run(ssh, f"mkdir -p /home/ubuntu/anqiao-saas/server.bak-{ts}")
    run(ssh, f"cp -rf /home/ubuntu/anqiao-saas/server/* /home/ubuntu/anqiao-saas/server.bak-{ts}/ 2>/dev/null || true")
    run(ssh, f"tar -czf /tmp/anqiao-saas-frontend-bak-{ts}.tar.gz -C /var/www/anqiao-saas . 2>/dev/null || true", sudo=True)
    log(f"  后端备份至: /home/ubuntu/anqiao-saas/server.bak-{ts}")
    log(f"  前端备份至: /tmp/anqiao-saas-frontend-bak-{ts}.tar.gz")

    # 5. 上传包
    log("[2/5] 上传部署包到远程临时目录...")
    remote_server_tar = f"/tmp/anqiao-server-{ts}.tar.gz"
    remote_dist_tar = f"/tmp/anqiao-dist-{ts}.tar.gz"
    sftp.put(server_tar, remote_server_tar)
    sftp.put(dist_tar, remote_dist_tar)
    sftp.close()
    os.remove(server_tar)
    os.remove(dist_tar)
    log("  上传完成")

    # 6. 部署后端代码
    log("[3/5] 解压并更新后端代码与环境...")
    run(ssh, 'echo \'{"name":"anqiao-saas-server","type":"module"}\' > /home/ubuntu/anqiao-saas/package.json')
    run(ssh, "mkdir -p /home/ubuntu/anqiao-saas/server")
    run(ssh, f"tar -xzf {remote_server_tar} -C /home/ubuntu/anqiao-saas/server/")
    run(ssh, f"rm -f {remote_server_tar}")
    log("  后端文件解压完成")

    # 7. 部署前端静态资源
    log("[4/5] 解压并更新前端静态资源到 /var/www/anqiao-saas/ ...")
    run(ssh, "mkdir -p /tmp/anqiao-dist-tmp")
    run(ssh, f"tar -xzf {remote_dist_tar} -C /tmp/anqiao-dist-tmp/")
    run(ssh, "rm -rf /var/www/anqiao-saas/*", sudo=True)
    run(ssh, "cp -rf /tmp/anqiao-dist-tmp/* /var/www/anqiao-saas/", sudo=True)
    run(ssh, "chown -R www-data:www-data /var/www/anqiao-saas", sudo=True)
    run(ssh, "chmod -R 755 /var/www/anqiao-saas", sudo=True)
    run(ssh, f"rm -rf /tmp/anqiao-dist-tmp {remote_dist_tar}")
    log("  前端文件部署完成并设置 www-data 权限")

    # 8. 重启并验证服务
    log("[5/5] 重启 anqiao-saas.service 并验证状态...")
    run(ssh, "systemctl restart anqiao-saas.service", sudo=True)
    time.sleep(2)
    svc_status = run(ssh, "systemctl status anqiao-saas.service --no-pager", sudo=True)
    log("服务状态:\n" + svc_status)

    # 9. 内部接口验证（冒烟账号密码经环境变量注入，不入库）
    smoke_user = os.environ.get("SMOKE_USER", "su01")
    smoke_pass = os.environ.get("SMOKE_PASS", "")
    if smoke_pass:
        log("执行后端 API 冒烟测试...")
        test_login = run(
            ssh,
            "curl -s -i http://127.0.0.1:2830/v1/auth/login -X POST "
            f"-H 'Content-Type: application/json' -d '{{\"username\":\"{smoke_user}\",\"password\":\"{smoke_pass}\"}}'"
        )
        log("登录响应 (第一行及关键字段):")
        for line in test_login.splitlines():
            if "HTTP/" in line or "code" in line or "workspace" in line or "data_scope" in line:
                log("  " + line[:120])
    else:
        log("未设置 SMOKE_PASS，跳过登录冒烟测试")

    test_static_https = run(ssh, "curl -s -k -I https://anqiao.aibrain.wiki/saas/")
    log("公网静态入口 https://anqiao.aibrain.wiki/saas/ 响应:")
    for line in test_static_https.splitlines()[:5]:
        log("  " + line)

    ssh.close()
    log("=" * 60)
    log("  [SUCCESS] 中科安樵 生产部署成功！")
    log("  在线地址: https://anqiao.aibrain.wiki/saas/#/console")
    log("=" * 60)


if __name__ == "__main__":
    main()
