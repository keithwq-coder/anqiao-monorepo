# 窗口前置：在目标机创建 /etc/anqiao-console/env（仅新增文件，不改 nginx/旧服务）
# 密钥在目标机生成，不回显、不落仓库（INTEGRATION-SPEC §6-3/#4）
import secrets
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ssh_auth import connect_ssh, run_cmd


def main():
    ssh = connect_ssh(timeout=20)
    out, err = run_cmd(ssh, "test -f /etc/anqiao-console/env && echo ENV_EXISTS || echo ENV_MISSING")
    if "ENV_EXISTS" in out:
        print("env already present — skip create (will not overwrite secrets)")
        ssh.close()
        return 0

    token_secret = secrets.token_hex(32)
    seed_password = secrets.token_urlsafe(24)
    # 写临时文件再安装，避免 echo 泄漏到 history；chmod 600
    remote_tmp = "/tmp/anqiao-console.env.new"
    content = (
        f"TOKEN_SECRET={token_secret}\n"
        f"SEED_ACCOUNT_PASSWORD={seed_password}\n"
        f"DATA_LAYER=seed\n"
    )
    # 通过 stdin 写，不在 shell 命令行出现明文口令
    cmd = (
        f"umask 077 && cat > {remote_tmp} && "
        f"sudo -n mkdir -p /etc/anqiao-console && "
        f"sudo -n cp {remote_tmp} /etc/anqiao-console/env && "
        f"sudo -n chmod 600 /etc/anqiao-console/env && "
        f"sudo -n chown root:root /etc/anqiao-console/env && "
        f"rm -f {remote_tmp} && echo ENV_CREATED"
    )
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdin.write(content)
    stdin.channel.shutdown_write()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    print(out or err)
    # 校验
    out2, _ = run_cmd(ssh, "test -f /etc/anqiao-console/env && stat -c %a /etc/anqiao-console/env")
    print("mode:", out2)
    ssh.close()
    return 0 if "ENV_CREATED" in (out + err) or out2.strip() == "600" else 1


if __name__ == "__main__":
    sys.exit(main())
