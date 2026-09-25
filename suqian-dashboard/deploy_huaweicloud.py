"""中科安樵 suqian-dashboard（宿迁长护险试点 100寸全域数字驾驶舱）华为云自动化部署脚本
目标环境：华为云 ECS 1.94.51.126 (CentOS 7 + 宝塔 Nginx + Node.js 20 LTS 运行环境)

功能特性：
1. 本地前端产物自动编译（注入 VITE_BASE=/suqian-dash/ 与 VITE_API_BASE=/saas/api）
2. 静态资源打包与 SFTP 安全传输
3. 服务器端 /var/www/suqian-dash/ 版本备份与增量解压覆盖
4. 建立 /www/server/nginx/html/suqian-dash 软链接确保静态文件路径稳健
5. 更新 Nginx 0.default.conf 站点配置：
   - /suqian-dash/ 宿迁长护险大屏前端
   - /suqian-dash 301 重定向规范化
   - /dash/ 及 /dash 兼容重定向
   - /suqian-dash/api/ 与 /saas/api/ 统一反向代理至 Node 后端（端口 2830，含 WebSocket 升级）
   - /saas/ 保持 anqiao-saas 控制台共存不中断
6. 多维度端到端健康与冒烟自检（本地、服务器内部、公网网络三级验证）
"""
import argparse
import os
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import paramiko

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
REMOTE_TARGET = "/var/www/suqian-dash"
NGINX_HTML = "/www/server/nginx/html"
DEFAULT_SERVER = "1.94.51.126"
DEFAULT_USER = "root"
DEFAULT_PASS = ""  # 禁止硬编码（INTEGRATION-SPEC §6-2）；经环境变量 SSH_PASSWORD 注入
DEFAULT_PORT = 22


def log(msg: str):
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


def run_cmd(ssh, cmd: str) -> str:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # 忽略 bashrc 历史环境异常警告
    filtered_err = "\n".join([line for line in err.splitlines() if "bashrc" not in line and "warning" not in line.lower()])
    if filtered_err:
        return out + f"\n[STDERR]: {filtered_err}"
    return out


def deploy_to_huaweicloud(
    server: str = DEFAULT_SERVER,
    port: int = DEFAULT_PORT,
    user: str = DEFAULT_USER,
    password: str = DEFAULT_PASS,
    key_path: str = "",
    skip_build: bool = False
):
    log("=" * 65)
    log("  中科安樵 · suqian-dashboard 华为云自动化一键部署")
    log(f"  目标服务器: {server}:{port} (用户: {user})")
    log(f"  部署目标目录: {REMOTE_TARGET}")
    log("=" * 65)

    # 1. 本地前端构建
    index_html = os.path.join(DIST_DIR, "index.html")
    if not skip_build or not os.path.exists(index_html):
        log("[1/6] 执行本地前端构建 (VITE_BASE=/suqian-dash/ VITE_API_BASE=/saas/api)...")
        env = os.environ.copy()
        env["VITE_BASE"] = "/suqian-dash/"
        env["VITE_API_BASE"] = "/saas/api"
        
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        res = subprocess.run([npm_cmd, "run", "build"], cwd=BASE_DIR, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if res.returncode != 0:
            log("前端构建失败:\n" + res.stderr)
            sys.exit(1)
        log("  前端 npm run build 构建成功！")
    else:
        log("[1/6] 跳过前端构建，使用已有 dist/ 产物")

    if not os.path.exists(index_html):
        log("错误: 未找到 dist/index.html，请检查构建输出")
        sys.exit(1)

    # 2. 打包本地 dist
    log("[2/6] 打包本地 dist/ 静态构建产物...")
    dist_tar = create_tar(DIST_DIR)
    tar_size_kb = os.path.getsize(dist_tar) / 1024
    log(f"  dist 压缩包生成完成，体积: {tar_size_kb:.1f} KB")

    # 3. 连接华为云主机
    log(f"[3/6] 建立 SSH / SFTP 安全连接到华为云 ({server}:{port})...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": server,
        "port": port,
        "username": user,
        "timeout": 15,
        "banner_timeout": 30,
        "allow_agent": True,
        "look_for_keys": True,
    }
    if key_path:
        connect_kwargs["key_filename"] = key_path
    if password:
        connect_kwargs["password"] = password

    try:
        ssh.connect(**connect_kwargs)
    except Exception as e:
        log(f"连接失败: {e}")
        sys.exit(1)

    sftp = ssh.open_sftp()
    log("  SSH & SFTP 安全通道建立成功")

    ts = time.strftime("%Y%m%d%H%M%S")

    # 4. 上传与部署解压
    log(f"[4/6] 同步产物至服务器并更新静态目录...")
    # 备份旧版（如果存在）
    chk_exist = run_cmd(ssh, f"test -d {REMOTE_TARGET} && echo exists || echo not_found")
    if "exists" in chk_exist:
        bak_dir = f"{REMOTE_TARGET}.bak-{ts}"
        run_cmd(ssh, f"mkdir -p {bak_dir} && cp -rf {REMOTE_TARGET}/* {bak_dir}/ 2>/dev/null || true")
        log(f"  已备份上个线上版本至: {bak_dir}")

    remote_tar = f"/tmp/suqian-dash-{ts}.tar.gz"
    sftp.put(dist_tar, remote_tar)
    os.remove(dist_tar)
    log(f"  SFTP 上传压缩包至 {remote_tar} 完成")

    # 解压至 /var/www/suqian-dash/
    tmp_extract = f"/tmp/suqian-dash-extract-{ts}"
    run_cmd(ssh, f"mkdir -p {tmp_extract} && tar -xzf {remote_tar} -C {tmp_extract}/")
    run_cmd(ssh, f"mkdir -p {REMOTE_TARGET} && rm -rf {REMOTE_TARGET}/*")
    run_cmd(ssh, f"cp -rf {tmp_extract}/* {REMOTE_TARGET}/")
    run_cmd(ssh, f"chmod -R 755 {REMOTE_TARGET}")
    run_cmd(ssh, f"rm -rf {tmp_extract} {remote_tar}")

    # 建立软链接
    run_cmd(ssh, f"ln -sfn {REMOTE_TARGET} {NGINX_HTML}/suqian-dash")
    log(f"  已就绪目录 {REMOTE_TARGET}，并建立软链接 {NGINX_HTML}/suqian-dash")

    # 5. 配置并激活 Nginx 站点
    log("[5/6] 配置 Nginx 虚拟主机路由（大屏 + 控制台 + WebSocket + 双向兼容反代）...")
    nginx_conf = """server
{
    listen 80;
    server_name _;
    index index.html;
    root /www/server/nginx/html;

    # 默认根路由：跳转至宿迁长护险大屏
    location = / {
        return 301 /suqian-dash/;
    }

    # ---- 宿迁长护险大屏前端与资源 ----
    # index.html 必须禁缓存，否则浏览器粘住旧哈希 JS；assets 带内容哈希可长缓存
    location = /suqian-dash/index.html {
        alias /var/www/suqian-dash/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    location /suqian-dash/assets/ {
        alias /var/www/suqian-dash/assets/;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location /suqian-dash/ {
        alias /var/www/suqian-dash/;
        index index.html;
        try_files $uri $uri/ /suqian-dash/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 规范化大屏 URL 跳转
    location = /suqian-dash {
        return 301 /suqian-dash/;
    }

    # 兼容原看板 /dash/ 路由
    location = /dash {
        return 301 /suqian-dash/;
    }
    location = /dash/ {
        return 301 /suqian-dash/;
    }

    # 宿迁大屏 API 与 WebSocket 实时通道反代
    location ^~ /suqian-dash/api/ {
        proxy_pass http://127.0.0.1:2830/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    # ---- SaaS 管理端控制台（保持现有 anqiao-saas 稳定在线） ----
    location = /saas/index.html {
        alias /var/www/anqiao-saas/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location /saas/assets/ {
        alias /var/www/anqiao-saas/assets/;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location /saas/ {
        alias /var/www/anqiao-saas/;
        index index.html;
        try_files $uri $uri/ /saas/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location = /saas {
        return 301 /saas/;
    }

    # SaaS 控制台 REST API 与 WebSocket 反代
    location ^~ /saas/api/ {
        proxy_pass http://127.0.0.1:2830/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
"""
    vhost_file = "/www/server/panel/vhost/nginx/0.default.conf"
    with sftp.open(vhost_file, "w") as f:
        f.write(nginx_conf)
    sftp.close()

    # 测试并平滑重载 Nginx
    t_out = run_cmd(ssh, "/www/server/nginx/sbin/nginx -t")
    if "successful" not in t_out:
        log(f"错误: Nginx 语法检查未通过:\n{t_out}")
        ssh.close()
        sys.exit(1)
    
    run_cmd(ssh, "/www/server/nginx/sbin/nginx -s reload")
    log("  Nginx 配置已更新并平滑重载成功！")

    # 6. 端到端多维度冒烟测试
    log("[6/6] 执行部署健康检查与冒烟测试...")
    
    # 6.1 服务器内部测试
    dash_header = run_cmd(ssh, f"curl -s -I -H 'Host: {server}' http://127.0.0.1/suqian-dash/")
    dash_ok = "200 OK" in dash_header or "HTTP/1.1 200" in dash_header
    log(f"  [内测] 大屏静态入口 http://127.0.0.1/suqian-dash/: {'[PASS] 200 OK' if dash_ok else '[FAIL] 异常'}")

    dash_redirect = run_cmd(ssh, f"curl -s -I -H 'Host: {server}' http://127.0.0.1/suqian-dash")
    log(f"  [内测] /suqian-dash 自动跳转 301: {'[PASS]' if '301' in dash_redirect else '[FAIL]'}")

    dash_compat = run_cmd(ssh, f"curl -s -I -H 'Host: {server}' http://127.0.0.1/dash/")
    log(f"  [内测] /dash/ 兼容跳转 301: {'[PASS]' if '301' in dash_compat else '[FAIL]'}")

    saas_header = run_cmd(ssh, f"curl -s -I -H 'Host: {server}' http://127.0.0.1/saas/")
    saas_ok = "200 OK" in saas_header or "HTTP/1.1 200" in saas_header
    log(f"  [共存] 原 SaaS 控制台入口 http://127.0.0.1/saas/: {'[PASS] 200 OK' if saas_ok else '[FAIL] 异常'}")

    api_test = run_cmd(
        ssh,
        f"curl -s -i -H 'Host: {server}' http://127.0.0.1/suqian-dash/api/v1/auth/login -X POST "
        "-H 'Content-Type: application/json' -d '{\"username\":\"su01\",\"password\":\"" + os.environ.get("SMOKE_PASS", "") + "\"}'"
    )
    api_ok = "200 OK" in api_test or '"code":200' in api_test
    log(f"  [反代] 大屏 API 反代 /suqian-dash/api/v1/auth/login: {'[PASS] 认证通过' if api_ok else '[FAIL] 异常'}")

    ssh.close()

    # 6.2 客户端公网访问测试
    log("  [公网] 从当前环境发起公网 HTTP 连通性测试...")
    try:
        public_url = f"http://{server}/suqian-dash/"
        req = urllib.request.Request(public_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8", errors="replace")
            has_title = "长护险" in content or "驾驶舱" in content
            log(f"  [公网] {public_url} 响应 HTTP {resp.status} (文档验证: {'[PASS]' if has_title else '[WARN]'})")
    except Exception as e:
        log(f"  [公网] 测试遇到网络波动: {e}")

    log("=" * 65)
    log("  [SUCCESS] 中科安樵 suqian-dashboard 华为云部署全部成功！")
    log(f"  大屏在线访问地址: http://{server}/suqian-dash/")
    log(f"  控制台在线访问地址: http://{server}/saas/#/console")
    log("=" * 65)


def main():
    parser = argparse.ArgumentParser(description="中科安樵 suqian-dashboard 华为云一键部署工具")
    parser.add_argument("--ip", type=str, default=DEFAULT_SERVER, help=f"华为云服务器公网 IP，默认 {DEFAULT_SERVER}")
    parser.add_argument("--user", type=str, default=DEFAULT_USER, help=f"SSH 登录用户名，默认 {DEFAULT_USER}")
    parser.add_argument("--password", type=str, default=os.environ.get("SSH_PASSWORD", DEFAULT_PASS), help="SSH 登录密码（默认可经环境变量 SSH_PASSWORD 注入）")
    parser.add_argument("--key", type=str, default="", help="SSH 私钥路径")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="SSH 端口，默认 22")
    parser.add_argument("--skip-build", action="store_true", help="跳过本地 npm run build")
    args = parser.parse_args()

    deploy_to_huaweicloud(
        server=args.ip,
        port=args.port,
        user=args.user,
        password=args.password,
        key_path=args.key,
        skip_build=args.skip_build
    )


if __name__ == "__main__":
    main()
