# 日间只读预检（INTEGRATION-SPEC §7.1 白名单）：不改任何服务/配置
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

CHECKS = [
    ("old_service", "systemctl is-active anqiao-saas.service 2>/dev/null || true"),
    ("new_service", "systemctl is-active anqiao-console.service 2>/dev/null || echo absent"),
    ("nginx_v1", "grep -n 'location /v1' /etc/nginx/sites-enabled/anqiao 2>/dev/null || echo NO_V1"),
    ("env_file", "test -f /etc/anqiao-console/env && echo ENV_OK || echo ENV_MISSING"),
    ("sudo_ok", "sudo -n true && echo SUDO_OK || echo SUDO_FAIL"),
    ("listen_2831", "ss -lntp 2>/dev/null | grep 2831 || echo NO_2831"),
    ("listen_2830", "ss -lntp 2>/dev/null | grep 2830 || echo NO_2830"),
    ("opt_exists", "ls -d /opt/anqiao-console 2>/dev/null || echo NO_OPT"),
    ("dash", "curl -sk -o /dev/null -w %{http_code} https://anqiao.aibrain.wiki/dash/ || true"),
    ("saas", "curl -sk -o /dev/null -w %{http_code} https://anqiao.aibrain.wiki/saas/ || true"),
    ("suqian", "curl -sk -o /dev/null -w %{http_code} https://anqiao.aibrain.wiki/suqian-dash/ || true"),
    ("v1_unauth", "curl -sk -o /dev/null -w %{http_code} https://anqiao.aibrain.wiki/v1/overview || true"),
    ("legacy_2830_local", "curl -s -o /dev/null -w %{http_code} http://127.0.0.1:2830/v1/overview || true"),
]


def main():
    try:
        ssh = connect_ssh(timeout=20)
        print("SSH_OK")
    except Exception as e:
        print(f"SSH_FAIL {type(e).__name__}: {e}")
        sys.exit(2)

    for name, cmd in CHECKS:
        out, err = run_cmd(ssh, cmd)
        val = (out or err or "").strip()
        print(f"{name}: {val}")
    ssh.close()


if __name__ == "__main__":
    main()
