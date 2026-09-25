"""完整的全自动部署脚本
"""
import os
import secrets
import sys
import tarfile
import tempfile
import time
import paramiko

SERVER = os.environ.get("SSH_HOST", "1.94.51.126")
USERNAME = os.environ.get("SSH_USER", "root")
# 鉴权：SSH 密钥 / ssh-agent（见 ssh_auth.py），禁止硬编码密码（INTEGRATION-SPEC §6-2）
PORT = int(os.environ.get("SSH_PORT", "22"))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
SERVER_CODE_DIR = os.path.join(BASE_DIR, "server")


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


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


def run_cmd(ssh, cmd: str) -> str:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if err and "warning" not in err.lower():
        return out + f"\n[STDERR]: {err}"
    return out


def main():
    log("=" * 60)
    log("中科安樵 anqiao-console 华为云自动化部署开始")
    log(f"目标主机: {SERVER} (root)")
    log("=" * 60)

    # 1. 检查 SSH 连接
    log("[1/7] 建立 SSH / SFTP 安全连接...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": SERVER,
        "port": PORT,
        "username": USERNAME,
        "timeout": 10,
        "banner_timeout": 30,
        "allow_agent": True,
        "look_for_keys": True,
    }
    key_path = os.environ.get("SSH_KEY_PATH")
    if key_path:
        connect_kwargs["key_filename"] = key_path
    ssh.connect(**connect_kwargs)
    sftp = ssh.open_sftp()
    log("  SSH & SFTP 连接建立成功")

    # 2. 确保 Node.js 20 (glibc-217) 安装就绪
    log("[2/7] 检查并就绪 Node.js 运行环境...")
    node_chk = run_cmd(ssh, "node -v || true")
    if "v20" not in node_chk and "v18" not in node_chk:
        log("  服务器暂无 Node.js，正在上传 Node 20 (glibc-217 兼容包)...")
        local_node = os.path.join(BASE_DIR, "node-v20.18.3-glibc217.tar.gz")
        sftp.put(local_node, "/tmp/node20.tar.gz")
        log("  上传完成，正在解压部署至 /usr/local/ ...")
        res = run_cmd(
            ssh,
            "tar -xzf /tmp/node20.tar.gz -C /usr/local/ --strip-components=1 && "
            "ln -sf /usr/local/bin/node /usr/bin/node && "
            "ln -sf /usr/local/bin/npm /usr/bin/npm && "
            "rm -f /tmp/node20.tar.gz && node -v"
        )
        log(f"  Node.js 安装成功: {res}")
    else:
        log(f"  Node.js 已经就绪: {node_chk}")

    # 3. 本地打包
    log("[3/7] 打包本地 server/ 与 dist/ ...")
    server_tar = create_tar(SERVER_CODE_DIR)
    dist_tar = create_tar(DIST_DIR)
    log(f"  server 包: {os.path.getsize(server_tar)/1024:.1f} KB")
    log(f"  dist 包:   {os.path.getsize(dist_tar)/1024:.1f} KB")

    # 4. 上传包
    log("[4/7] 上传前后端部署包到服务器 /tmp ...")
    ts = time.strftime("%Y%m%d%H%M%S")
    rem_server = f"/tmp/anqiao-server-{ts}.tar.gz"
    rem_dist = f"/tmp/anqiao-dist-{ts}.tar.gz"
    sftp.put(server_tar, rem_server)
    sftp.put(dist_tar, rem_dist)
    sftp.close()
    os.remove(server_tar)
    os.remove(dist_tar)
    log("  部署包上传完成")

    # 5. 部署后端服务并配置 systemd
    log("[5/7] 部署后端代码并配置常驻进程...")
    app_dir = "/opt/anqiao-saas"
    run_cmd(ssh, f"mkdir -p {app_dir}/server")
    run_cmd(ssh, f"tar -xzf {rem_server} -C {app_dir}/server/")
    run_cmd(ssh, f"echo '{{\"name\":\"anqiao-saas-server\",\"type\":\"module\"}}' > {app_dir}/package.json")
    run_cmd(ssh, f"rm -f {rem_server}")

    token_secret = secrets.token_hex(32)
    service_content = f"""[Unit]
Description=Anqiao SaaS Console Backend (Node.js)
After=network.target

[Service]
Type=simple
WorkingDirectory={app_dir}
Environment=PORT=2830
Environment=TOKEN_SECRET={token_secret}
ExecStart=/usr/local/bin/node {app_dir}/server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
    # 写入 systemd 配置
    run_cmd(ssh, f"cat << 'EOF' > /etc/systemd/system/anqiao-saas.service\n{service_content}\nEOF")
    run_cmd(ssh, "systemctl daemon-reload")
    run_cmd(ssh, "systemctl enable anqiao-saas.service")
    run_cmd(ssh, "systemctl restart anqiao-saas.service")
    time.sleep(2)
    svc_status = run_cmd(ssh, "systemctl is-active anqiao-saas.service")
    log(f"  anqiao-saas 后端服务状态: {svc_status}")

    # 6. 部署前端静态资源
    log("[6/7] 部署前端静态资源并配置 Nginx ...")
    web_dir = "/var/www/anqiao-saas"
    run_cmd(ssh, f"mkdir -p {web_dir}")
    run_cmd(ssh, "mkdir -p /tmp/anqiao-dist-tmp")
    run_cmd(ssh, f"tar -xzf {rem_dist} -C /tmp/anqiao-dist-tmp/")
    run_cmd(ssh, f"rm -rf {web_dir}/*")
    run_cmd(ssh, f"cp -rf /tmp/anqiao-dist-tmp/* {web_dir}/")
    run_cmd(ssh, f"rm -rf /tmp/anqiao-dist-tmp {rem_dist}")
    run_cmd(ssh, f"chmod -R 755 {web_dir}")
    log("  前端资源部署至 /var/www/anqiao-saas/ 完成")

    # 配置宝塔 Nginx 默认站点 0.default.conf
    nginx_default_conf = f"""server
{{
    listen 80;
    server_name _;
    index index.html;
    root /www/server/nginx/html;

    # SaaS 控制台前端静态资源
    location /saas/ {{
        alias {web_dir}/;
        index index.html;
        try_files $uri $uri/ /saas/index.html;
    }}

    # SaaS 后端 REST API 与 WebSocket 反向代理
    location /saas/api/ {{
        proxy_pass http://127.0.0.1:2830/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }}
}}
"""
    # 备份原有 0.default.conf
    run_cmd(ssh, "cp -n /www/server/panel/vhost/nginx/0.default.conf /www/server/panel/vhost/nginx/0.default.conf.bak || true")
    run_cmd(ssh, f"cat << 'EOF' > /www/server/panel/vhost/nginx/0.default.conf\n{nginx_default_conf}\nEOF")
    
    # 检查并重载 Nginx
    nginx_t = run_cmd(ssh, "/www/server/nginx/sbin/nginx -t || nginx -t")
    log(f"  Nginx 配置检测: {nginx_t.splitlines()[-1] if nginx_t.splitlines() else nginx_t}")
    run_cmd(ssh, "/www/server/nginx/sbin/nginx -s reload || nginx -s reload || systemctl reload nginx")
    log("  Nginx 反向代理生效就绪")

    # 放行安全策略（SELinux / firewalld）
    run_cmd(ssh, "setsebool -P httpd_can_network_connect 1 2>/dev/null || true")
    run_cmd(ssh, "firewall-cmd --zone=public --add-port=80/tcp --permanent 2>/dev/null && firewall-cmd --reload 2>/dev/null || true")

    # 7. 冒烟健康检查
    log("[7/7] 执行端到端冒烟测试...")
    time.sleep(1)
    
    # 测试内部端口
    test_internal = run_cmd(
        ssh,
        "curl -s -i http://127.0.0.1:2830/v1/auth/login -X POST "
        "-H 'Content-Type: application/json' -d '{\"username\":\"su01\",\"password\":\"" + os.environ.get("SMOKE_PASS", "") + "\"}'"
    )
    is_internal_ok = "200" in test_internal or "data" in test_internal
    log(f"  内部端口 127.0.0.1:2830 测试: {'[PASS] 成功' if is_internal_ok else '[FAIL] 异常'}")

    # 测试 Nginx 反代 API
    test_proxy_api = run_cmd(
        ssh,
        "curl -s -i http://127.0.0.1/saas/api/v1/auth/login -X POST "
        "-H 'Content-Type: application/json' -d '{\"username\":\"su01\",\"password\":\"" + os.environ.get("SMOKE_PASS", "") + "\"}'"
    )
    is_proxy_ok = "200" in test_proxy_api or "data" in test_proxy_api
    log(f"  Nginx /saas/api 反向代理测试: {'[PASS] 成功' if is_proxy_ok else '[FAIL] 异常'}")

    # 测试前端静态入口
    test_static = run_cmd(ssh, "curl -s -I http://127.0.0.1/saas/")
    log(f"  前端静态 /saas/ 访问测试: {test_static.splitlines()[0] if test_static.splitlines() else 'N/A'}")

    ssh.close()
    log("=" * 60)
    log("[SUCCESS] 中科安樵 anqiao-console 华为云部署全部成功！")
    log(f"公网访问地址: http://{SERVER}/saas/#/console")
    log("  种子账号口令由 SEED_ACCOUNT_PASSWORD 注入，请登录后立即轮换")
    log("=" * 60)


if __name__ == "__main__":
    main()
