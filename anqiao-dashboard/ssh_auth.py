"""SSH 认证工具：密钥 / ssh-agent，凭据不入库。

对应 INTEGRATION-SPEC §6-2：生产部署脚本禁止硬编码 SSH 明文密码。
认证顺序：
1. 环境变量 SSH_KEY_PATH 指定的私钥
2. ssh-agent
3. 默认密钥（~/.ssh/id_ed25519、id_rsa 等）

sudo 一律走 `sudo -n`（NOPASSWD），不再回退到 echo 密码。
"""
from __future__ import annotations

import os

import paramiko

DEFAULT_HOST = os.environ.get("SSH_HOST", "124.222.212.159")
DEFAULT_USER = os.environ.get("SSH_USER", "ubuntu")


def connect_ssh(host: str = DEFAULT_HOST, username: str = DEFAULT_USER, port: int = 22, timeout: int = 15):
    """建立 SSH 连接（密钥 / agent 认证）。"""
    ssh = paramiko.SSHClient()
    ssh.load_system_host_keys()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs = {
        "hostname": host,
        "port": port,
        "username": username,
        "timeout": timeout,
        "banner_timeout": 30,
        "allow_agent": True,
        "look_for_keys": True,
    }
    key_path = os.environ.get("SSH_KEY_PATH")
    if key_path:
        kwargs["key_filename"] = key_path
    ssh.connect(**kwargs)
    return ssh


def run_cmd(ssh, cmd: str, sudo: bool = False):
    """执行远程命令。sudo 时使用 sudo -n，要求目标机为部署用户配置 NOPASSWD。"""
    if sudo:
        cmd = "sudo -n " + cmd
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    return out, err


def run(ssh, cmd: str, sudo: bool = False) -> str:
    """兼容旧脚本的单返回值版本。"""
    out, err = run_cmd(ssh, cmd, sudo=sudo)
    return out + ("\nSTDERR: " + err if err and "password" not in err.lower() else "")
