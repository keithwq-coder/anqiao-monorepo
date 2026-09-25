# 诊断 Node22 安装失败
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    "command -v curl; curl --version | head -1",
    "ls -la /opt/node-v22 2>/dev/null || echo NO_PREFIX",
    "ls -la /tmp/node22.tar.xz 2>/dev/null || echo NO_TAR",
    "curl -sI https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz | head -10",
    "curl -fsSL -o /tmp/node22-test.tar.xz -w 'http:%{http_code} size:%{size_download}\\n' --connect-timeout 15 --max-time 60 https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz; ls -la /tmp/node22-test.tar.xz 2>/dev/null",
    "command -v xz; command -v tar",
    "uname -m",
    "ls -la /tmp/anqiao-console.service.bak-* 2>/dev/null | tail -3 || true",
]


def main():
    ssh = connect_ssh(timeout=20)
    for cmd in CHECKS:
        out, err = run_cmd(ssh, cmd)
        print("===", cmd)
        print((out or err or "")[:2000])
        print()
    ssh.close()


if __name__ == "__main__":
    main()
