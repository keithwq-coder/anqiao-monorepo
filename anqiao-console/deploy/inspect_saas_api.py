# 只读：/saas/api 指向、2830 依赖、console 是否仍用 /saas/api
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    "grep -n 'saas/api\\|2830\\|2831' /etc/nginx/sites-enabled/anqiao || true",
    "curl -s -o /dev/null -w saas_api_v1_login:%{http_code} -X POST http://127.0.0.1:2830/v1/auth/login -H 'Content-Type: application/json' -d '{}' || true",
    "curl -s -o /dev/null -w console2831_login:%{http_code} -X POST http://127.0.0.1:2831/v1/auth/login -H 'Content-Type: application/json' -d '{}' || true",
    "curl -sk -o /dev/null -w pub_saas_api:%{http_code} -X POST https://anqiao.aibrain.wiki/saas/api/v1/auth/login -H 'Content-Type: application/json' -d '{}' || true",
    "journalctl -u anqiao-saas.service --since '10 min ago' --no-pager | tail -5 || true",
    "systemctl is-active anqiao-saas.service anqiao-console.service",
    "node -v; ls /usr/local/bin/node 2>/dev/null; command -v nvm || true",
    "grep -n 'VITE_API_BASE\\|/v1/' /var/www/anqiao-dash-v2/assets/index-*.js 2>/dev/null | head -3 || true",
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
