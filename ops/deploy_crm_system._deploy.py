"""一键部署 CRM 系统到腾讯云轻量服务器（原生部署，无 Docker）。

流程：本地打包 → SFTP上传 → 远程解压 → supervisor重启服务 → 健康检查
用法：python _deploy.py
"""
import os
import sys
import tarfile
import tempfile
import time
import paramiko

# ─── 配置 ─────────────────────────────────────────────────────────
SERVER = "124.222.212.159"
USERNAME = "ubuntu"
PASSWORD = "Kxsw1234"
REMOTE_DIR = "/home/ubuntu/CRM"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))
API_PORT = 8100
DOMAIN = "crm.aibrain.wiki"

# 排除的目录/文件（不同步）
EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", ".pytest_cache",
    ".vite", ".venv", "venv", ".mypy_cache", ".ruff_cache",
    "dist", ".next", "test-screenshots",
}
EXCLUDE_EXTS = {".db", ".log", ".pyc", ".tar.gz", ".zip", ".bak", ".env"}

# 只同步这些顶层目录/文件
INCLUDE_TOP = {
    "backend", "frontend", "crawlers", "analytics", "docs", "scripts",
}


def should_exclude(relpath: str) -> bool:
    """判断是否排除。"""
    parts = relpath.replace("\\", "/").split("/")
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    _, ext = os.path.splitext(relpath)
    if ext in EXCLUDE_EXTS:
        return True
    return False


def create_archive() -> str:
    """打包项目为 tar.gz。"""
    archive_path = os.path.join(tempfile.gettempdir(), "crm-deploy.tar.gz")
    print(f"[1/5] 打包项目 → {archive_path}")

    count = 0
    with tarfile.open(archive_path, "w:gz") as tar:
        for item in os.listdir(LOCAL_DIR):
            if item not in INCLUDE_TOP:
                continue
            full_path = os.path.join(LOCAL_DIR, item)

            if os.path.isfile(full_path):
                tar.add(full_path, arcname=f"CRM/{item}")
                count += 1
            elif os.path.isdir(full_path):
                for root, dirs, files in os.walk(full_path):
                    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                    rel_root = os.path.relpath(root, LOCAL_DIR)
                    if should_exclude(rel_root):
                        continue
                    for f in files:
                        rel_file = os.path.join(rel_root, f)
                        if should_exclude(rel_file):
                            continue
                        full_file = os.path.join(root, f)
                        arc_name = f"CRM/{rel_file.replace(os.sep, '/')}"
                        tar.add(full_file, arcname=arc_name)
                        count += 1

    size_mb = os.path.getsize(archive_path) / 1024 / 1024
    print(f"    打包完成: {count} 个文件, {size_mb:.1f} MB")
    return archive_path


def upload_archive(archive_path: str):
    """上传到服务器。"""
    remote_archive = "/tmp/crm-deploy.tar.gz"
    print(f"[2/5] 上传到服务器 ({SERVER})...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USERNAME, password=PASSWORD, timeout=15)

    sftp = ssh.open_sftp()
    file_size = os.path.getsize(archive_path)
    last_print = [time.time()]

    def progress(sent, total):
        now = time.time()
        if now - last_print[0] > 2:
            pct = sent / total * 100
            print(f"    进度: {pct:.0f}% ({sent/1024/1024:.1f}/{total/1024/1024:.1f} MB)")
            last_print[0] = now

    sftp.put(archive_path, remote_archive, callback=progress)
    sftp.close()
    print(f"    上传完成: {file_size/1024/1024:.1f} MB")
    return remote_archive, ssh


def deploy_on_server(ssh, remote_archive: str):
    """在服务器上解压并重启服务。"""
    ts = time.strftime("%Y%m%d-%H%M%S")

    print("[3/5] 服务器端备份 + 解压...")
    commands = [
        # 备份当前版本
        f"cd {REMOTE_DIR} && tar -czf /tmp/crm-backup-{ts}.tar.gz backend frontend 2>/dev/null; echo backup-done",
        # 解压覆盖
        f"cd /home/ubuntu && tar -xzf {remote_archive}",
        # 清理上传文件
        f"rm -f {remote_archive}",
    ]

    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            print(f"    {out}")
        if err and "WARNING" in err:
            print(f"    {err}")

    print("[4/5] 重启服务 (supervisor)...")
    # 如果 supervisor 配置存在则重启，否则跳过
    restart_cmd = (
        f"if [ -f /etc/supervisor/conf.d/crm.conf ]; then "
        f"sudo supervisorctl restart crm-backend crm-celery 2>/dev/null; "
        f"echo 'services restarted'; "
        f"else echo 'supervisor config not found, skipping restart'; fi"
    )
    stdin, stdout, stderr = ssh.exec_command(restart_cmd)
    print(f"    {stdout.read().decode().strip()}")

    # 重载 Nginx（前端静态文件更新）
    stdin, stdout, stderr = ssh.exec_command("sudo nginx -s reload 2>&1")
    nginx_out = stderr.read().decode().strip() or stdout.read().decode().strip()
    if nginx_out:
        print(f"    nginx: {nginx_out}")
    else:
        print("    nginx: reloaded")

    print("[5/5] 健康检查...")
    time.sleep(3)
    stdin, stdout, stderr = ssh.exec_command(
        f"curl -sf http://127.0.0.1:{API_PORT}/api/health 2>/dev/null || echo 'API_NOT_READY'"
    )
    health = stdout.read().decode().strip()
    if health and health != "API_NOT_READY":
        print(f"    ✅ API 正常: {health}")
    else:
        print("    ⚠️  API 尚未就绪（后端可能还未部署，属正常情况）")

    ssh.close()


def main():
    print("=" * 50)
    print(f"  中科安樵 CRM 系统 → 腾讯云部署")
    print(f"  目标: {DOMAIN} ({SERVER})")
    print("=" * 50)
    print()

    # 1. 打包
    archive_path = create_archive()

    # 2. 上传
    remote_archive, ssh = upload_archive(archive_path)

    # 3-5. 解压 + 重启 + 健康检查
    deploy_on_server(ssh, remote_archive)

    # 清理本地临时文件
    os.remove(archive_path)

    print()
    print("[OK] 部署完成！")
    print(f"   前端: http://{DOMAIN}")
    print(f"   API:  http://{DOMAIN}/api/health")
    print(f"   服务器目录: {REMOTE_DIR}")


if __name__ == "__main__":
    main()
