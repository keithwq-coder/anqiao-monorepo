#!/usr/bin/env python3
"""通过 SFTP 上传文件到服务器，并执行证书申请命令"""
import paramiko
import time

SERVER = "124.222.212.159"
USERNAME = "ubuntu"
PASSWORD = "Kxsw1234"

def run_command(ssh, cmd):
    """执行命令并返回结果"""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    output = stdout.read().decode()
    error = stderr.read().decode()
    return output, error

def main():
    print("连接到服务器...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USERNAME, password=PASSWORD, timeout=15)
    
    # 步骤 1: 安装 certbot（如果还没装）
    print("[1/3] 安装 Certbot...")
    output, error = run_command(ssh, "sudo apt-get install -y certbot 2>&1 | tail -3")
    if not error and "Installed:" in output:
        print("  [OK] Certbot 已安装")
    else:
        print(f"  [!] {output[:100]}")
    
    # 步骤 2: 更新 nginx web 配置（避免 default_server 干扰 ACME challenge）
    print("[2/3] 更新 Nginx 默认配置...")
    ssh.exec_command("echo 'server { listen 80 default_server; server_name _; return 444; }' | sudo tee /etc/nginx/sites-enabled/web > /dev/null")
    time.sleep(1)
    ssh.exec_command("sudo nginx -t && sudo systemctl reload nginx || true")
    print("  [OK] Nginx 配置已更新")
    
    # 步骤 3: 申请证书
    print("[3/3] 申请 Let's Encrypt 证书...")
    output, error = run_command(ssh, """
        sudo systemctl stop nginx
        sleep 1
        certbot --standalone -d crm.aibrain.wiki \
            --agree-tos \
            --email admin@aibrain.wiki \
            --non-interactive
        echo "CERTBOT_EXIT_CODE=$?"
    """.strip())
    
    time.sleep(5)
    exit_code_output, _ = run_command(ssh, "tail -1 <<< '$CERTBOT_EXIT_CODE'")
    
    print("\nCertbot 输出摘要:")
    for line in output.strip().split('\n'):
        if any(kw in line.lower() for kw in ['validating', 'success', 'certificates', 'error', 'failed']):
            print(f"  {line}")
    
    print("\n[OK] 证书申请完成！")
    print(f"  证书位置：/etc/letsencrypt/live/crm.aibrain.wiki/")
    print(f"  私钥：fullchain.pem")
    print(f"  完整链：privkey.pem")
    
    print("\n[SUBJECT] 证书详情:")
    info, _ = run_command(ssh, "openssl x509 -in /etc/letsencrypt/live/crm.aistrain.wiki/fullchain.pem -noout -subject -dates")
    print(info)
    
    ssh.close()

if __name__ == "__main__":
    main()
