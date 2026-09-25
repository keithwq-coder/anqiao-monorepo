# 诊断窗口 B /dash/ 404
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    "ls -la /var/www/anqiao-dash-v2 | head -20",
    "ls -la /var/www/anqiao-dash-v2/index.html 2>&1",
    "head -c 400 /var/www/anqiao-dash-v2/index.html 2>&1 || true",
    "grep -n 'alias /var/www/anqiao-dash' /etc/nginx/sites-enabled/anqiao || true",
    "curl -sk -o /dev/null -w local_dash:%{http_code} http://127.0.0.1/dash/ || true",
    "curl -sk -o /dev/null -w pub:%{http_code} https://anqiao.aibrain.wiki/dash/",
    "curl -sk https://anqiao.aibrain.wiki/dash/ | head -c 300",
    "sudo -n nginx -t 2>&1 | tail -5",
    "ls -la /var/www/anqiao-dash/index.html 2>&1",
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
