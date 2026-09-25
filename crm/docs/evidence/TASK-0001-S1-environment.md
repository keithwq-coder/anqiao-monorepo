# TASK-0001 S1: Native Python project skeleton

- Date: 2026-07-27 Asia/Shanghai
- Owner: Codex / GPT-5.6-sol
- Status: PASSED
- Authorization: `DEC-0046`
- Data: no business data used
- External model/service: none
- Server mutation: none

## Scope delivered

- Repository-local `.venv` created with the installed Python 3.12 runtime and
  excluded through `.gitignore`.
- `pyproject.toml` defines Python `>=3.12,<3.13`, exact direct runtime/test pins
  and an exact setuptools build dependency.
- `src/crm/` contains the six `ADR-0002` package boundaries: `domain`,
  `application`, `policy`, `persistence`, `web` and `ai`.
- The `ai` boundary exposes an immutable disabled state and contains no provider
  or network integration.
- `tests/test_module_boundaries.py` imports every boundary and verifies AI is
  disabled.

## Exact direct pins verified

| Purpose | Packages |
|---|---|
| runtime | alembic 1.18.4; argon2-cffi 25.1.0; fastapi 0.136.3; Jinja2 3.1.6; psycopg 3.3.4; pydantic 2.12.5; pydantic-settings 2.14.2; python-multipart 0.0.22; SQLAlchemy 2.0.51; uvicorn 0.43.0 |
| test | httpx 0.28.1; pytest 9.0.2 |
| build | setuptools 82.0.1 |

## Checks actually run

| Check | Result |
|---|---|
| create `.venv` with Python 3.12 | PASSED; environment reports Python 3.12.8 |
| editable install with test dependencies | PASSED |
| compare 12 direct pins with installed metadata | PASSED; all exact pins match |
| `pip check` | PASSED; no broken requirements |
| `python -m compileall -q src tests` | PASSED |
| `python -m pytest -q` | PASSED; 7 tests |

## Boundary

This proves only the project skeleton, isolated environment and import/AI-disable
contract. It does not verify configuration, PostgreSQL, domain behavior,
authorization, masking, sessions, HTTP flows, deployment or human acceptance.
