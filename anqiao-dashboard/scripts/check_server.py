"""服务器状态检查脚本（诊断用）。
鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py），禁止硬编码密码。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

ssh = connect_ssh()


def run(cmd):
    print(">>>", cmd)
    out, err = run_cmd(ssh, cmd)
    print(out)
    if err:
        print("STDERR:", err)
    return out


run("uptime")
run("df -h")
run("systemctl is-active anqiao-saas.service || true")
run("ss -lntp | grep -E '2830|2831|80' || true")
run("ls -la /var/www/ | head -20")

ssh.close()
