# 读取 nginx /dash/ 与 suqian 配置（只读）
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd


def main():
    ssh = connect_ssh(timeout=20)
    cmds = [
        "sed -n '55,100p' /etc/nginx/sites-enabled/anqiao",
        "ls -ld /var/www/anqiao-dash-v2 2>/dev/null || echo NO_V2_DIR",
        "ls -ld /var/www/suqian-dash.bak-* 2>/dev/null | tail -3 || true",
    ]
    for cmd in cmds:
        out, err = run_cmd(ssh, cmd)
        print("===", cmd)
        print(out or err)
        print()
    ssh.close()


if __name__ == "__main__":
    main()
