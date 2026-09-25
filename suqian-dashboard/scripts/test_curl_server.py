"""从生产机探测硬件云根路径连通性（诊断用）。
鉴权：SSH 密钥 / ssh-agent（见 ../ssh_auth.py），禁止硬编码密码。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh

ssh = connect_ssh()

cmd = "curl -v -m 5 http://api.health-track.anqiaokj.com/ 2>&1"
_, out, _ = ssh.exec_command(cmd)
print(out.read().decode("utf-8", errors="replace"))
ssh.close()
