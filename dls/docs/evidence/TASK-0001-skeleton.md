# TASK-0001 · 骨架搭建 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师独立复核）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0001-skeleton.md`

## Scope（变更文件 · 17 个）

| 文件 | 内容 |
|---|---|
| `pyproject.toml` | 依赖清单 + dev 组 + pytest 配置 |
| `alembic.ini` | Alembic 配置（**ASCII 安全**，见修复记录） |
| `.env.example` | 环境占位符（`change-me`，无真实密钥） |
| `.gitignore` | 排除 `.env` / `__pycache__` / `.venv` / `*.pyc` / 日志 |
| `channel/__init__.py` | 根包，`__version__ = "0.1.0"` |
| `channel/config.py` | Settings：DB 必填、空值拒绝、无 SQLite 兜底（fail-closed） |
| `channel/domain/__init__.py` | 域包（空） |
| `channel/application/__init__.py` | 应用层包（空） |
| `channel/policy/__init__.py` | 策略投影包（空） |
| `channel/persistence/__init__.py` | 持久化包（空） |
| `channel/persistence/database.py` | `build_engine` / `build_session_factory`（import 不连库） |
| `channel/web/__init__.py` | Web 层包（空） |
| `migrations/env.py` | Alembic 环境（离线 URL 不含密钥） |
| `migrations/script.py.mako` | Alembic 迁移模板（Jinja2，非 Python） |
| `tests/__init__.py` | 测试包 |
| `tests/conftest.py` | fixtures（空） |
| `tests/test_skeleton.py` | 5 项冒烟测试（导入 / fail-closed / 无 SQLite / URL） |

## Evidence（真实命令输出）

### 1. 环境安装（网络经本地代理 127.0.0.1:7897，PyPI 直连对大响应不稳定，改用清华镜像）

```
.venv/Scripts/python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -e ".[dev]"
→ Successfully installed fastapi-0.141.1 sqlalchemy-2.0.52 alembic-1.19.1
  psycopg-3.3.4 psycopg-binary-3.3.4 pydantic-2.13.4 pydantic-settings-2.15.0
  argon2-cffi-25.1.0 jinja2-3.1.6 itsdangerous-2.2.0 uvicorn-0.52.1
  pytest-9.1.1 pytest-cov-7.1.0 httpx-0.28.1 ...
```

### 2. AC-001 模块导入

```
.venv/Scripts/python -c "import channel; from channel import config, domain, application, policy, persistence, web; print('IMPORT OK', channel.__version__)"
→ IMPORT OK 0.1.0   (exit 0)
```

### 3. AC-002 冒烟测试

```
.venv/Scripts/python -m pytest -v
→ collected 5 items
  tests\test_skeleton.py ..... [100%]
  ============================== 5 passed in 0.16s ==============================
```

### 4. AC-003 fail-closed（测试断言覆盖）

```
test_config_rejects_missing_db_fields  PASS  (缺必填字段 → ValueError)
test_config_rejects_blank_password     PASS  (空密码 → ValueError)
test_config_rejects_sqlite             PASS  (sqlite.db → ValueError, 无兜底)
test_config_builds_postgres_url        PASS  (postgresql+psycopg://...?sslmode=require)
```

### 5. AC-004 无密钥入库

```
grep -n "^\.env$" .gitignore → 2:.env
仓库内密钥扫描：唯一命中是测试夹具中的字面占位符 "app:secret"（非真实凭据）
```

### 6. 编译与 Alembic（补充验证）

```
py_compile channel/*.py migrations/env.py tests/*.py → COMPILE OK（.mako 为模板不参与编译）
alembic --version → alembic 1.19.1
alembic upgrade head --sql（带合法 env）→ BEGIN; COMMIT;（空迁移，符合"零版本"骨架）
alembic history（无 DB 配置）→ 报错退出（fail-closed 生效）
```

## 修复记录

1. **alembic.ini 编码 bug**：初版含中文注释，GBK 本地化 Windows 读取时 `UnicodeDecodeError`。已改为纯 ASCII 注释（配置类文件必须编码安全）。

## Not verified

- 真实 PostgreSQL 在线迁移（本机无授权 DB；`upgrade head --sql` 仅验证离线路径）
- Linux / 生产环境安装复现
- **Python 版本一致性**：本骨架 venv 用系统 Python **3.14.3** 构建；crm venv 是 **3.12.8**。`requires-python >=3.12` 满足，但与现有栈不一致，见 Decisions needed。

## Decisions needed

1. **Python 版本**：是否统一到 3.12（用 `crm/.venv/Scripts/python.exe -m venv` 重建 dls venv）？`[PROPOSAL]` 建议统一 3.12，与 crm 生产栈一致。
2. 安装源：本机经代理直连 PyPI 对大包不稳定，采用清华镜像；后续 CI/部署需确定镜像源策略（非阻塞，仅环境事实）。

*实现不替架构师下结论；以上两点待 v4-pro 复核裁决。*
