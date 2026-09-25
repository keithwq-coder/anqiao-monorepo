# TASK-0001 · 项目骨架搭建

- SPEC：无（基础设施，无业务行为变更；依据 DEC-0011 技术选型 + SPEC-0001 技术要点）
- 实现者：v4-flash
- 审核者：deepseek-v4-pro
- 状态：active
- 授权：DEC-0015

## 前置必读（顺序）

1. `项目约束.md`（反幻觉基座，最高权威）
2. `AGENTS.md`
3. 本卡

## 范围

搭建可运行的工程骨架，让后续 TASK-0002（返利引擎 TDD）有落点。**不含任何业务逻辑、业务表、业务路由、微信支付。**

包含：
- Python 包结构 `channel/{domain,application,policy,persistence,web}` + `config`
- 依赖清单（FastAPI + SQLAlchemy 2.0 + psycopg + Alembic + Pydantic v2 + pydantic-settings + argon2-cffi + uvicorn + jinja2；dev：pytest + pytest-cov + httpx）
- `channel/config.py`：Settings，`database_url` 必填、拒绝空值、无 SQLite 兜底（fail-closed，参照 crm 模式）
- `channel/persistence/database.py`：引擎 + 会话工厂接线（不要求真实 PG）
- Alembic 基座：`alembic.ini` + `migrations/env.py`（离线 URL 不含密钥）
- pytest 基座：`tests/conftest.py` + 冒烟测试
- `.gitignore`（排除 `.env` / `__pycache__` / `.venv` / `*.pyc`）
- `.env.example`（占位符，不写真实密钥）

不包含：
- 返利引擎（TASK-0002）
- 任何实体/ORM 模型/迁移版本
- 微信支付、小程序、路由

## 归属文件（本 task 唯一可写清单）

```
pyproject.toml
alembic.ini
.env.example
.gitignore
channel/__init__.py
channel/config.py
channel/domain/__init__.py
channel/application/__init__.py
channel/policy/__init__.py
channel/persistence/__init__.py
channel/persistence/database.py
channel/web/__init__.py
migrations/env.py
migrations/script.py.mako
tests/__init__.py
tests/conftest.py
tests/test_skeleton.py
```

## 验收标准

- **AC-001** `python -c "import channel; from channel import config, domain, application, policy, persistence, web"` 退出码 0。
- **AC-002** 冒烟测试通过：`pytest -q` 至少 1 项通过（模块可导入）。
- **AC-003** `channel/config.py` fail-closed：缺 `database_url` 或空值 → 抛异常，**无 SQLite 兜底**（写进冒烟测试断言）。
- **AC-004** `.gitignore` 排除 `.env`；仓库内无真实密钥/密码。

## 验证步骤（审核者会独立跑）

```
python -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"
.venv/Scripts/python -c "import channel; from channel import config, domain, application, policy, persistence, web"
.venv/Scripts/python -m pytest -q
```

## 完成证据

实现后写 `docs/evidence/TASK-0001-skeleton.md`，附真实命令输出。

## 审核裁决

**ACCEPTED**（DEC-0016，2026-08-13）。架构师独立复核：AC-001~004 全绿、`pip check` 无依赖漂移、范围合规（17 归属文件；`anqiao_dls.egg-info/` 为构建产物已 `*.egg-info/` gitignore）。附带裁决：Python 运行时锁 3.12，TASK-0002 前重建 venv。
