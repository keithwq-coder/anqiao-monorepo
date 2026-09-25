# TASK-0007 preflight evidence

- Recorded: 2026-08-02
- Executor: one bounded ZCode subagent dispatched by the coordinator
  (Kimi-K3) under `DEC-0067` and
  `docs/handoffs/HANDOFF-20260802-KIMI-TASK-0007-IMPLEMENTATION.md`
- Executor runtime model identifier: `5f121e6f-b747-4f1e-8162-dd0214cef1d2/k3-256k`
  (as exposed by this runtime; recorded verbatim per DEC-0066/DEC-0067; never a gate)

All commands below were run from the repository root `D:\Project\中科安樵\crm`.

## 1. Python / virtual environment facts

- [VERIFIED] `.venv` exists at the repository root; interpreter used for every
  Python command in this task: `D:\Project\中科安樵\crm\.venv\Scripts\python.exe`.
- [VERIFIED] `.venv/Scripts/python.exe --version` -> `Python 3.12.8`.
- [VERIFIED] Installed tooling in the venv includes `pytest`, `alembic`,
  `uvicorn`, `fastapi`, `httpx` (`.venv/Scripts/` listing). No dependency was
  installed, upgraded, or removed by this task (handoff section 5).
- [VERIFIED] `pyproject.toml` pins `python_requires >=3.12,<3.15` and test
  extras `httpx==0.28.1`, `pytest==9.0.2`; pytest config:
  `addopts = "-ra --strict-config --strict-markers"`, `testpaths = ["tests"]`.

## 2. Test-database mechanism (discovered, not assumed)

- [VERIFIED] `tests/conftest.py` sets only `CRM_DATABASE_*` and
  `SESSION_SECRET_KEY` / `DATABASE_URL` defaults; it does not create or connect
  to any database. Note: `crm.config.Settings` fields are `database_host`,
  `database_name`, `database_user`, `database_password` with no env prefix, so
  `CRM_DATABASE_*` values do not populate `Settings`; `DATABASE_HOST` etc. do.
- [VERIFIED] The repository's only PostgreSQL-dependent tests are gated behind
  `CRM_RUN_POSTGRESQL_TESTS=1` skip marks: `tests/test_migrations.py:63`
  (isolated local `*_test` migration database) and
  `tests/test_s4_authentication.py:542`. `tests/test_s6_e2e_auth.py:26,71` are
  unconditionally skipped pending W4. This is the existing test-database
  mechanism: a local isolated PostgreSQL test database, opt-in via env flag.
- [VERIFIED] `scripts/dev-test.ps1` (cited in the handoff) does NOT exist;
  `scripts/` contains only `check-governance.ps1`, database-inspection/migration
  helper scripts, and deployment helpers. Discovery therefore relied on
  `tests/conftest.py`, `.env.example`, `.env.test`, and the persistence tests.
- [VERIFIED] `.env.test` contains only `CRM_DATABASE_*` placeholders
  (synthetic); `.env.example` documents `DATABASE_*` names with
  `DATABASE_PASSWORD=<set-at-runtime>`.
- [VERIFIED] No local PostgreSQL is available on this machine:
  - `psql` is not on PATH (`where psql` -> not found);
  - no PostgreSQL Windows service (`Get-Service *postgres*` -> empty);
  - no `postgres` process; `C:\Program Files\PostgreSQL` does not exist;
  - TCP probe to `localhost:5432` with synthetic credentials via
    `psycopg.connect(..., connect_timeout=3)` -> `ConnectionTimeout`
    (no listener on `::1`/`127.0.0.1`).
- [CONSEQUENCE] Any check that requires a live PostgreSQL cannot run locally.
  Per handoff section 5, those checks are recorded as `NOT VERIFIED` with the
  exact remaining check; every check that can run without a database is run.
  Installing PostgreSQL would violate the no-install boundary; a remote
  database would violate the no-network/no-remote-database boundary.

## 3. Owned-file existence check (handoff section 3)

- [VERIFIED] Exist and are readable:
  - `src/crm/web/auth.py`
  - `src/crm/web/deps.py`
  - `src/crm/web/routes/auth.py`
  - `src/crm/web/main.py`
  - `src/crm/persistence/` (`models.py`, `database.py`, `repositories.py`,
    `user_repository.py`, `base.py`, `__init__.py`)
  - `tests/test_s4_authentication.py`
  - `docs/tasks/active/TASK-0007-auth-authorization-repair.md`
- [VERIFIED] `docs/evidence/` exists (TASK-0001/TASK-0006 evidence files
  present); `docs/evidence/TASK-0007-*` files are created by this task.

## 4. Approved-SPEC authority check

- [VERIFIED] `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
  SHA-256 = `0c313e4f2592ba33bf7331dff7a4f1e73ede5b107436f4446309f3354115b8f4`
  matches `spec_sha256` in
  `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
  (status `approved`, approved_by `product-owner`, 2026-07-26).

## 5. Pre-dispatch test baseline (interpreter: `.venv/Scripts/python.exe`)

- [VERIFIED] `.venv/Scripts/python.exe -m pytest -q` (full suite, untouched
  tree) -> collection error in `tests/test_s6_integration.py`
  (`pydantic_core._pydantic_core.ValidationError` from `Settings()` at
  `crm/web/main.py:19`: `database_host/database_name/database_user/
  database_password` missing). Interrupted during collection.
- [VERIFIED] `.venv/Scripts/python.exe -m pytest -q
  --ignore=tests/test_s6_integration.py --ignore=tests/test_s6_integration_simple.py`
  -> `2 failed, 65 passed, 4 skipped, 1 error in 5.73s`:
  - FAILED `tests/test_s6_e2e_auth.py::TestSessionMiddlewareConfiguration::test_session_middleware_installed`
  - FAILED `tests/test_s6_e2e_auth.py::TestSessionMiddlewareConfiguration::test_session_cookie_attributes`
  - ERROR `tests/test_s6_e2e_auth.py::TestAuthenticationFlow::test_unauthenticated_access_rejected`
  - all three fail at `from crm.web.main import app` -> `Settings()` env
    validation (same root cause as the collection error above; pre-existing,
    in files NOT owned by this task).
  - Skips: the two `CRM_RUN_POSTGRESQL_TESTS`-gated tests and the two
    W4-gated `test_s6_e2e_auth.py` tests.
- [VERIFIED] This baseline is recorded so the coordinator can distinguish
  pre-existing failures from any regression introduced by this task.

## 6. Boundary confirmations

- No git operations will be performed (repository currently has no commits;
  irrelevant to this task and left untouched).
- No network, server, SSH, or remote database access will be performed.
- No real credentials will be used or logged; only synthetic fixtures.
- Files outside handoff section 3 will not be modified. In particular
  `tests/conftest.py`, `tests/test_s6_e2e_auth.py`, `tests/test_s6_integration*.py`,
  `src/crm/web/routes/institutions.py`, `src/crm/config.py`, and
  `pyproject.toml` are NOT owned and will not be edited.
