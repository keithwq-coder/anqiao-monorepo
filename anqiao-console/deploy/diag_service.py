# 诊断 anqiao-console 服务激活失败
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    "systemctl is-active anqiao-console.service || true",
    "sudo -n systemctl status anqiao-console.service --no-pager -l | head -40",
    "sudo -n journalctl -u anqiao-console.service -n 60 --no-pager",
    "ls -la /opt/anqiao-console/server | head -25",
    "ls -la /opt/anqiao-console/node_modules/argon2 2>/dev/null | head -5 || echo NO_ARGON2",
    "test -f /etc/anqiao-console/env && echo ENV_OK || echo ENV_MISSING",
    "command -v node; node -v",
    "ss -lntp | grep 2831 || echo NO_2831",
    "grep -n 'location /v1' /etc/nginx/sites-enabled/anqiao || echo NO_V1",
    "ls -la /opt/anqiao-console/package.json 2>/dev/null; cat /opt/anqiao-console/package.json 2>/dev/null || true",
    "sudo -n ls -la /etc/systemd/system/anqiao-console.service; cat /etc/systemd/system/anqiao-console.service",
]


def main():
    ssh = connect_ssh(timeout=20)
    for cmd in CHECKS:
        out, err = run_cmd(ssh, cmd)
        print("===", cmd)
        print((out or err or "")[:3000])
        print()
    ssh.close()


if __name__ == "__main__":
    main()
