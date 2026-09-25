# 紧急回滚窗口 B：nginx alias 指回 /var/www/anqiao-dash
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd


def main():
    ssh = connect_ssh(timeout=20)
    ts = time.strftime("%Y%m%d%H%M%S")
    # 使用最近一次 dash 切换备份优先，否则任意 anqiao-nginx-bak
    preferred = "/tmp/anqiao-nginx-bak-20260923224739"
    out, _ = run_cmd(ssh, f"test -f {preferred} && echo HAS_PREFERRED || echo NO_PREF")
    src = preferred if "HAS_PREFERRED" in out else None
    if not src:
        out, _ = run_cmd(ssh, "ls -1t /tmp/anqiao-nginx-bak-* 2>/dev/null | head -1")
        src = (out or "").strip()
    if not src:
        print("NO_BAK")
        return 1
    print("using", src)
    # 若备份里仍是旧 alias，直接恢复；否则强制写回旧 alias
    out, _ = run_cmd(ssh, f"grep -c 'alias /var/www/anqiao-dash/;' {src} || true")
    site = "/etc/nginx/sites-enabled/anqiao"
    if (out or "0").strip() != "0":
        run_cmd(ssh, f"sudo -n cp {src} {site}")
        print("restored backup file")
    else:
        # 备份已是 v2，则本地改回
        cmd = (
            "sudo -n python3 - <<'PY'\n"
            "site='/etc/nginx/sites-enabled/anqiao'\n"
            "src=open(site).read()\n"
            "src=src.replace('alias /var/www/anqiao-dash-v2/;', 'alias /var/www/anqiao-dash/;', 1)\n"
            "open(site,'w').write(src)\n"
            "print('ALIAS_REVERT')\n"
            "PY"
        )
        out, err = run_cmd(ssh, cmd)
        print(out or err)

    out, err = run_cmd(ssh, "sudo -n nginx -t", sudo=False)
    # run_cmd already may not use sudo -n correctly with the string; use sudo flag
    out, err = run_cmd(ssh, "nginx -t", sudo=True)
    print("nginx_t", (out + err)[-200:])
    if "successful" not in (out + err):
        print("NGINX_T_FAIL")
        return 1
    run_cmd(ssh, "systemctl reload nginx", sudo=True)

    # 验证
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/dash/")
    print("dash", out)
    out2, _ = run_cmd(ssh, "ls -la /var/www/anqiao-dash/index.html")
    print("old_index", out2)
    # 确认 alias
    out3, _ = run_cmd(ssh, "grep -n 'alias /var/www/anqiao-dash' /etc/nginx/sites-enabled/anqiao")
    print("alias_lines", out3)
    ssh.close()
    return 0 if out.strip() == "200" else 1


if __name__ == "__main__":
    sys.exit(main())
