# 只读：查看 /dash/ 与 nginx 静态目录、是否存在 /dash-v2/
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    "grep -n 'location /dash' /etc/nginx/sites-enabled/anqiao || true",
    "ls -ld /var/www/anqiao-dash /var/www/dash /var/www/suqian-dash 2>/dev/null || true",
    "ls /var/www/anqiao-dash 2>/dev/null | head -10 || true",
    "ls -d /var/www/anqiao-dash.bak-* /var/www/dash-v2 2>/dev/null || true",
    "curl -sk -o /dev/null -w dash:%{http_code} https://anqiao.aibrain.wiki/dash/",
    "curl -sk -o /dev/null -w dash_v2:%{http_code} https://anqiao.aibrain.wiki/dash-v2/",
    "curl -sk -o /dev/null -w suqian:%{http_code} https://anqiao.aibrain.wiki/suqian-dash/",
    "grep -n 'suqian-dash' /etc/nginx/sites-enabled/anqiao | head -20 || true",
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
