# 窗口 E 前置只读：Node 版本、安装方式、服务与 env
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    "node -v; command -v node; ls -la /usr/bin/node /usr/local/bin/node 2>/dev/null || true",
    "command -v nvm || true; ls -d ~/.nvm 2>/dev/null || true",
    "command -v npm; npm -v",
    "systemctl is-active anqiao-console.service",
    "grep -E '^(DATA_LAYER|DB_PATH|TOKEN)' /etc/anqiao-console/env 2>/dev/null || sudo -n grep -E '^(DATA_LAYER|DB_PATH)' /etc/anqiao-console/env || true",
    "grep ExecStart /etc/systemd/system/anqiao-console.service",
    "df -h / | tail -1",
    "curl -s -o /dev/null -w v1:%{http_code} http://127.0.0.1:2831/v1/overview",
    "ls -la /opt/anqiao-console/node_modules/argon2/package.json 2>/dev/null | head -1 || echo NO_ARGON2",
]


def main():
    ssh = connect_ssh(timeout=20)
    for cmd in CHECKS:
        out, err = run_cmd(ssh, cmd)
        print("===", cmd)
        print((out or err or "")[:1500])
        print()
    ssh.close()


if __name__ == "__main__":
    main()
