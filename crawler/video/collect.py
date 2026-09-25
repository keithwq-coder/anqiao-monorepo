# -*- coding: utf-8 -*-
"""
启动入口（一键命令）：
  python collect.py --platform 快手 --keyword 养老 --limit 20

说明：
- run.py 用系统 Python 环境可能缺依赖；此入口强制用 managed venv 的 python。
- 前置条件：
  1) browser_profile/ 已存在登录态（首次先跑 login_once.py 扫码）
  2) 飞书 token 有效（过期跑 lark-cli auth login）
"""
import subprocess
import sys
from pathlib import Path

PY = r"C:\Users\K\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
HERE = Path(__file__).parent

if __name__ == "__main__":
    cmd = [PY, str(HERE / "run.py")] + sys.argv[1:]
    sys.exit(subprocess.run(cmd).returncode)
