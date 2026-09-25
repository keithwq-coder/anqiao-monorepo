# 窗口 E：服务器 Node ≥22 + DATA_LAYER=sqlite 灰度（可回滚 seed）
# 步骤：
#  1) 备份 systemd unit + env + nginx
#  2) 安装 Node 22 到 /usr/local（并行安装，ExecStart 指向新 node）
#  3) 验证 node -v >= 22，node -e import('node:sqlite')
#  4) env: DATA_LAYER=sqlite（保留 seed 回滚注释）
#  5) systemctl restart anqiao-console；验证 active + 登录 + floors + overview
#  6) 写一条 alert 验证持久化后 restart 仍保留（可选简版：仅查 sqlite 文件存在）
# 失败即回滚：ExecStart 仍可用旧 /usr/bin/node + DATA_LAYER=seed
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd

SERVICE = "anqiao-console.service"
ENV = "/etc/anqiao-console/env"
SITE = "/etc/nginx/sites-enabled/anqiao"
NODE22_URL = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz"
NODE22_PREFIX = "/opt/node-v22"
NODE22_BIN = f"{NODE22_PREFIX}/bin/node"


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main() -> int:
    log("窗口 E · Node22 + sqlite 灰度")
    ssh = connect_ssh(timeout=25)
    ts = time.strftime("%Y%m%d%H%M%S")

    # ---- 备份 ----
    bak_unit = f"/tmp/anqiao-console.service.bak-{ts}"
    bak_env = f"/tmp/anqiao-console.env.bak-{ts}"
    bak_nginx = f"/tmp/anqiao-nginx-bak-{ts}"
    for src, dst in [
        (f"/etc/systemd/system/{SERVICE}", bak_unit),
        (ENV, bak_env),
        (SITE, bak_nginx),
    ]:
        out, err = run_cmd(ssh, f"cp {src} {dst} && echo OK", sudo=True)
        if "OK" not in out:
            log(f"备份失败 {src}: {err}")
            return 1
        log(f"备份 {src} → {dst}")

    # ---- 安装 Node 22（若已装则跳过）----
    out, _ = run_cmd(ssh, f"test -x {NODE22_BIN} && {NODE22_BIN} -v || echo NEED_INSTALL")
    if "v22" in (out or ""):
        log(f"Node22 已存在: {out.strip()}")
    else:
        log("下载安装 Node 22 …")
        # 优先用诊断已下载的完整包（29MB）；否则重下并校验大小
        cmd = (
            f"bash -c 'set -e; "
            f"mkdir -p {NODE22_PREFIX}; "
            f"cd /tmp; "
            f"if [ -f /tmp/node22-test.tar.xz ] && [ $(stat -c%s /tmp/node22-test.tar.xz) -ge 29000000 ]; then "
            f"  cp /tmp/node22-test.tar.xz node22.tar.xz; "
            f"else "
            f"  rm -f node22.tar.xz; "
            f"  curl -fsSL --connect-timeout 20 --max-time 180 -o node22.tar.xz {NODE22_URL}; "
            f"  sz=$(stat -c%s node22.tar.xz); "
            f"  if [ \"$sz\" -lt 29000000 ]; then echo BAD_SIZE:$sz; exit 1; fi; "
            f"fi; "
            f"rm -rf {NODE22_PREFIX}/*; "
            f"tar -xJf node22.tar.xz -C {NODE22_PREFIX} --strip-components=1; "
            f"rm -f node22.tar.xz; "
            f"{NODE22_BIN} -v; "
            f"echo NODE22_OK'"
        )
        out, err = run_cmd(ssh, cmd, sudo=True)
        log(f"install: {out} {err}")
        if "NODE22_OK" not in (out or ""):
            log("Node22 安装失败，中止（服务未改）")
            return 1

    # 验证 node:sqlite
    probe_js = "import('node:sqlite').then(()=>console.log('SQLITE_OK')).catch(e=>{console.error(e);process.exit(1)})"
    out, err = run_cmd(ssh, NODE22_BIN + " -e \"" + probe_js + "\"", sudo=True)
    log(f"sqlite probe: {out} {err}")
    if "SQLITE_OK" not in (out or ""):
        log("node:sqlite 不可用，中止")
        return 1

    # ---- 改 ExecStart → Node22 ----
    cmd = (
        f"python3 - <<'PY'\n"
        f"unit='/etc/systemd/system/{SERVICE}'\n"
        f"src=open(unit).read()\n"
        f"old='ExecStart=/usr/bin/node /opt/anqiao-console/server/index.js'\n"
        f"new='ExecStart={NODE22_BIN} /opt/anqiao-console/server/index.js'\n"
        f"assert old in src, 'ExecStart not found'\n"
        f"open(unit,'w').write(src.replace(old,new,1))\n"
        f"print('UNIT_OK')\n"
        f"PY"
    )
    out, err = run_cmd(ssh, cmd, sudo=True)
    log(f"unit edit: {out} {err}")
    if "UNIT_OK" not in (out or ""):
        run_cmd(ssh, f"cp {bak_unit} /etc/systemd/system/{SERVICE}", sudo=True)
        return 1

    # ---- env: DATA_LAYER=sqlite ----
    cmd = (
        f"python3 - <<'PY'\n"
        f"env_path='{ENV}'\n"
        f"lines=open(env_path).read().splitlines()\n"
        f"out=[]\n"
        f"found=False\n"
        f"for line in lines:\n"
        f"    if line.startswith('DATA_LAYER='):\n"
        f"        out.append('DATA_LAYER=sqlite')\n"
        f"        found=True\n"
        f"    else:\n"
        f"        out.append(line)\n"
        f"if not found:\n"
        f"    out.append('DATA_LAYER=sqlite')\n"
        f"if not any(l.startswith('DB_PATH=') for l in out):\n"
        f"    out.append('DB_PATH=/opt/anqiao-console/server/anqiao.sqlite')\n"
        f"open(env_path,'w').write('\\n'.join(out)+'\\n')\n"
        f"print('ENV_OK')\n"
        f"PY"
    )
    out, err = run_cmd(ssh, cmd, sudo=True)
    log(f"env edit: {out} {err}")
    if "ENV_OK" not in (out or ""):
        run_cmd(ssh, f"cp {bak_env} {ENV}", sudo=True)
        run_cmd(ssh, f"cp {bak_unit} /etc/systemd/system/{SERVICE}", sudo=True)
        return 1
    run_cmd(ssh, f"chmod 600 {ENV}", sudo=True)

    # ---- daemon-reload + restart ----
    run_cmd(ssh, "systemctl daemon-reload", sudo=True)
    run_cmd(ssh, f"systemctl reset-failed {SERVICE} || true", sudo=True)
    run_cmd(ssh, f"systemctl restart {SERVICE}", sudo=True)
    active = ""
    for _ in range(20):
        time.sleep(2)
        active, _ = run_cmd(ssh, f"systemctl is-active {SERVICE}")
        if active.strip() == "active":
            break
        log(f"  status: {active.strip() or '?'}")
    log(f"服务: {active.strip()}")
    if active.strip() != "active":
        out, err = run_cmd(ssh, f"journalctl -u {SERVICE} -n 40 --no-pager")
        log(out or err)
        # 回滚
        run_cmd(ssh, f"cp {bak_unit} /etc/systemd/system/{SERVICE}", sudo=True)
        run_cmd(ssh, f"cp {bak_env} {ENV} && chmod 600 {ENV}", sudo=True)
        run_cmd(ssh, "systemctl daemon-reload", sudo=True)
        run_cmd(ssh, f"systemctl restart {SERVICE}", sudo=True)
        log("已回滚 unit+env 并重启")
        return 1

    # 验证
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:2831/v1/overview")
    log(f"overview 无令牌 → {out}")
    out, _ = run_cmd(ssh, "grep DATA_LAYER /etc/anqiao-console/env || sudo -n grep DATA_LAYER /etc/anqiao-console/env")
    log(f"env: {out}")
    # sqlite 文件
    out, _ = run_cmd(ssh, "ls -la /opt/anqiao-console/server/anqiao.sqlite* 2>/dev/null || echo NO_SQLITE_YET")
    log(f"sqlite files: {out}")
    # 公网
    out, _ = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' -k https://anqiao.aibrain.wiki/v1/overview")
    log(f"公网 /v1/overview → {out}")
    for path in ["/saas/", "/dash/", "/suqian-dash/"]:
        code, _ = run_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' -k https://anqiao.aibrain.wiki{path}")
        log(f"{path} → {code}")

    ssh.close()
    ok = active.strip() == "active" and out.strip() in ("401", "200")
    log(f"窗口 E {'完成' if ok else '验证异常'}")
    log(f"回滚: cp {bak_unit} unit && cp {bak_env} env && daemon-reload && restart（DATA_LAYER 回 seed）")
    log(f"备份: {bak_unit} {bak_env} {bak_nginx}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
