# Architecture baseline: current cloud-deployed Python modular monolith

- Document type: factual architecture baseline (TASK-0022)
- Created: 2026-08-12
- Authority: `AGENTS.md`, approved SPEC baseline (`docs/specs/SPEC-BASELINE.md`),
  `DEC-0043`, `DEC-0044`, `ADR-0002`, `ADR-0003`, and the current source tree
- Evidence labels: `[VERIFIED]` = observed in a named repository path, command
  output, test, or recorded decision; `[INFERENCE]` = reasoned from verified
  facts; `[UNKNOWN]` = not established.

## 1. Scope and method

This document records what the current source, migrations, tests, and recorded
decisions actually implement. It changes no application behavior and authorizes
no refactor or deployment. All claims below were checked against the working
tree on 2026-08-12. Current production runtime, database, TLS/DNS/nginx, and
systemd state are NOT VERIFIED by this task (no server access is authorized).

## 2. Module boundaries (implemented)

`[VERIFIED]` Package layout under `src/crm/` with one Python package per
module; importability is pinned by `tests/test_module_boundaries.py`
(`crm.domain`, `crm.application`, `crm.policy`, `crm.persistence`,
`crm.web`, `crm.ai`).

| Module | Implemented responsibility | Evidence (paths) |
|---|---|---|
| `domain` | Entities, value objects, role/status enums, role grants, time helpers | `src/crm/domain/models.py` (`UserStatus`, `Role`, `ContactabilityStatus`, `RoleGrant`, `utc_now`); `src/crm/domain/__init__.py` |
| `application` | Commands (validate + execute), queries (read/projection), discovery, lifecycle (erasure), management | `src/crm/application/commands.py`, `queries.py`, `discovery.py`, `discovery_ai.py`, `lifecycle_commands.py`, `management_commands.py` |
| `policy` | Central fail-closed read policy and field-level projection for owner/collaborator/administrator-exception views | `src/crm/policy/projection.py` (`PolicySubject`, `RecordViewLevel`, `project_record`) |
| `persistence` | SQLAlchemy mappings, repositories, engine/session lifecycle, operations audit | `src/crm/persistence/models.py`, `base.py`, `database.py`, `repositories.py`, `user_repository.py`, `session_repository.py`, `audit_repository.py`, `role_grant_repository.py`, `opportunity_repository.py`, `operation_repository.py` |
| `web` | FastAPI app, HTTP routes, server-side auth/sessions/CSRF, page handlers, Jinja2 templates | `src/crm/web/main.py`, `routes/` (`auth.py`, `institutions.py`, `followups.py`, `admin.py`, `imports.py`, `account.py`, `discovery.py`), `deps.py`, `auth.py`, `templates/` |
| `ai` | Disabled marker package (`AI_ENABLED = False`); the implemented egress seam for external AI reasoning is a separate module, not this marker | `src/crm/ai/__init__.py` (`AI_ENABLED = False`, `is_enabled()`); `tests/test_module_boundaries.py` asserts the marker package is disabled; the TASK-0021 egress seam is `src/crm/application/discovery_ai.py` |

`[VERIFIED]` `src/crm/config.py` rejects `Settings.ai_enabled=True` at
configuration time (`reject_enabled_ai`: "external AI integration is not
authorized"), so the `crm.ai` marker package is disabled fail-closed by
construction. This does not disable or prove the state of every possible
egress path: TASK-0021 separately implemented the provider protocol, egress
whitelist, and egress-audit fields in `src/crm/application/discovery_ai.py`.
`tests/test_module_boundaries.py` proves the marker package is disabled; it
does not prove that every possible egress path is unavailable. No real provider
call or current production egress configuration is verified by this task. This
baseline neither claims the external AI seam is enabled in production nor that
it is absent.

## 3. Primary entrypoints

`[VERIFIED]`

- Application object: `app = FastAPI(title="Anqiao CRM API", ...)` in
  `src/crm/web/main.py`; dependency wiring runs at import time via
  `setup_app_dependencies()` (repositories, `QueryService`, `AuthenticationService`,
  session/audit/role-grant repositories stored on `app.state`).
- Direct run: `python -m crm.web.main` → `uvicorn.run("crm.web.main:app",
  host="127.0.0.1", port=8000, reload=settings.debug_mode, ...)`; local
  development binds loopback only; production reachability is nginx's
  responsibility per `ADR-0002` (`DEC-0071`).
- Health endpoint: `GET /health` returns `{"status": "healthy", "service":
  "anqiao-crm-api", "version": "0.1.0"}`.
- CLI/ops scripts (local, not runtime): `scripts/` contains
  `create-admin.py`, `create_admin_account.py`, `check_db_empty.py`,
  `check_db_user.py`, `check_remote_db.py`, `check_operations_health.py`,
  `operations_evidence.py`, `synthetic_backup_rehearsal.py`, `w4_deploy.py`,
  `w4_rollback.py`, `run_w4_migration.py`, `deploy-migration.sh`,
  `run-migration.sh`, `setup-db-privs.sh`, and the governance check
  `scripts/check-governance.ps1`.
- Deployment artifacts (local files; NOT VERIFIED as active runtime):
  `deploy/start.sh`, `deploy/start_crm.sh`, `deploy/anqiao-crm.service`,
  `deploy/nginx_crm.conf`, `deploy/debug_env.sh`, `deploy/test_settings.py`.

## 4. Request / application / policy flow

`[VERIFIED]` The implemented flow matches the `ADR-0002` design: page, search,
and API responses receive already-projected data from the central policy layer.

1. HTTP request → FastAPI app (`src/crm/web/main.py`).
2. Middleware: `SessionMiddleware` (cookie `session_id`, `max_age=3600`,
   `same_site=lax`, `https_only` per environment with a production fail-closed
   guard), CSRF middleware (`csrf_protection_middleware` → `enforce_csrf` in
   `src/crm/web/deps.py`), CORS restricted to `http://localhost:8000` /
   `http://127.0.0.1:8000`.
3. Routers: `/api/auth` (`routes/auth.py`), `/api/institutions`
   (`routes/institutions.py`), `/api/institutions` follow-up endpoints
   (`routes/followups.py`), `/api/admin` (`routes/admin.py`), `/api/imports`
   (`routes/imports.py`), `/api/account` (`routes/account.py`),
   `/api/discovery` (`routes/discovery.py`); browser pages in `main.py`
   (`/login`, `/dashboard`, `/institutions`, `/discovery`, `/health`).
4. Session identity: `web.deps.get_current_user_optional` / `get_current_user`;
   `web/auth.py` `AuthenticationService` with Argon2id password hashing,
   durable server-side sessions (SHA-256 token hashes only), CSRF issuance/
   validation, per-identifier rate limiting, and durable security audit
   (`DEC-0044` behavior; `SPEC-0002`).
5. Reads: route handler → `QueryService` (`src/crm/application/queries.py`) →
   repositories → `policy/projection.py` projection applied server-side before
   the response; unmapped fields default to hidden.
6. Writes: CSRF checked → command classes (`src/crm/application/commands.py`)
   validate then execute through repositories; write authorization is
   default-deny (owner-write, business/administrator role checks per
   `SPEC-0002` R-003/R-006).
7. Audited exception reads: administrator `administrator_reason` path writes an
   `audit_events` row (`audit_repository.record`, action
   `admin.exception_read`) on both API and page paths (`SPEC-0001` R-015).

## 5. Persistence and migration path

`[VERIFIED]`

- Runtime database: PostgreSQL via `postgresql+psycopg` URL built in
  `src/crm/config.py` `Settings.database_url` (required host/port/name/user/
  password/sslmode; blank values and blank password rejected). No SQLite
  fallback exists in application code (`tests/test_config.py` exercises the
  fail-closed config).
- Engine/session lifecycle: `src/crm/persistence/database.py` builds engines
  and caches session factories keyed on every resolved configuration dimension
  including a SHA-256 digest of the password; `SessionLocal()` is a
  compatibility wrapper.
- Mapped tables (`src/crm/persistence/models.py`): `user_identities`,
  `role_grants`, `institutions`, `institution_owner_history`, `contacts`,
  `follow_up_activities`, `follow_up_activity_revisions`, `audit_events`,
  `server_sessions`, `erasure_records`, `import_batches`,
  `import_row_results`, `opportunity_reminders`, `operation_records`.
- Migrations: `migrations/versions/0001_initial_schema.py` →
  `0002_erasure_records.py` → `0003_import_batches.py` →
  `0004_opportunity_reminders.py` → `0005_opportunity_reminders_ai_reasoning.py`
  (adds `ai_used`, `external_egress`, `model_identifier`,
  `egress_field_names`; `SPEC-0003` v0.3.0 / `DEC-0116`) →
  `0006_operation_records.py` (TASK-0018, `SPEC-0012` R-009). Alembic env:
  `migrations/env.py` (runtime settings only, offline URL is secret-free);
  `alembic.ini` `script_location = migrations`.
- Data lifecycle: `erasure_records` (administrator-only permanent erasure,
  `SPEC-0011` v0.2.0, `DEC-0037`); import batches (`SPEC-0013` v0.1.0,
  `DEC-0039`); opportunity reminders (`SPEC-0003`); operations audit
  (`SPEC-0012` v0.2.0).

`[NOT VERIFIED]` A PostgreSQL upgrade/downgrade/upgrade round trip for
`operation_records` and all remote/production migration behavior. The
PostgreSQL-gated test is skipped unless `CRM_RUN_POSTGRESQL_TESTS` is set
(`tests/test_migrations.py`; per `DEC-0125`, local run: `7 passed, 1 skipped`).

## 6. Authentication and sessions

`[VERIFIED]` Implemented per `DEC-0044` and `SPEC-0002`: pre-created internal
username/password accounts; Argon2id hashes only; server-side session state
backing `Secure`, `HttpOnly`, `SameSite` cookies; CSRF protection on writes;
login rate limiting; security audit; immediate session invalidation on
disable/revocation (`session_epoch`). Account self-service (username/password
change with current-password verification) per `SPEC-0014` /
`docs/decisions/DEC-0111` in `routes/account.py`.

## 7. Discovery and AI reasoning

`[VERIFIED]` `SPEC-0003` v0.3.0: deterministic local discovery
(`application/discovery.py`, `DiscoveryService.list_reminders`) plus a single
egress seam for external AI reasoning (`application/discovery_ai.py`,
`EGRESS_FIELD_WHITELIST`, `build_egress_payload`); `ai_used`, `external_egress`,
`model_identifier`, and `egress_field_names` are persisted on reminders for
audit. `DEC-0116` authorizes full egress for the selected provider; provider
selection (`OD-006a`) and retention (`OD-005`) remain open single-authorization
gates. Verification has used synthetic data only; no real provider call or
current production egress configuration is verified by this task, and the
seam's live state is neither claimed enabled nor claimed absent.

## 8. Stated external / runtime facts

`[VERIFIED — recorded history]`

- `DEC-0043`/`DEC-0044`/`ADR-0002`: cloud-deployed FastAPI modular monolith,
  Jinja2 server-rendered, central `policy` layer, native PostgreSQL + Alembic,
  server-side sessions, Uvicorn behind nginx, no Docker.
- `DEC-0083` (2026-08-05): TASK-0008 code deployed to
  `https://crm.aibrain.wiki`; `DEC-0087` (2026-08-05): TASK-0012 deployed.
- `DEC-0058` (2026-07-30): 117 imported records present in the cloud database
  at that time (historical snapshot; current cloud database state is UNKNOWN
  without network access).

`[NOT VERIFIED]` Current production runtime: service activity, PostgreSQL
version/state, nginx/TLS/DNS configuration, systemd units, and the current
online database contents were not probed by this task. Local deployment
artifacts (`deploy/`) and `data/`, `backup/`, `opt/` directories exist in the
worktree but are not runtime proof.

## 9. Test and verification surface

`[VERIFIED]`

- `tests/` contains per-task focused suites (e.g. `test_task0007_auth_http.py`,
  `test_task0018_operations.py`, `test_task0020_opportunity_discovery.py`,
  `test_task0021_discovery_ai_reasoning.py`) plus cross-cutting suites
  (`test_policy_projection.py`, `test_persistence_schema.py`,
  `test_migrations.py`, `test_module_boundaries.py`, `test_entrypoint.py`,
  `test_s6_e2e_auth.py`, ...).
- `[VERIFIED — recorded]` `DEC-0125` records the 2026-08-12 local run: full
  suite `368 passed, 28 skipped, 1 warning`; focused TASK-0018 operations
  `27 passed`; schema/migration `7 passed, 1 skipped`; governance `[PASS]` with
  8 approved SPECs and 19 active tasks.
- Governance structure check: `powershell -ExecutionPolicy Bypass -File
  scripts/check-governance.ps1` (approved SPEC hash binding, approval metadata,
  SPEC baseline status, active-task constraints, legacy manifests).

## 10. Non-decisions and boundaries

- No physical package refactor is authorized or performed; module boundaries
  above are the implemented state (`ADR-0003` non-decision).
- No deployment, server, database, TLS/DNS, credential, or real-data action is
  authorized by this document.
- Approved product SPEC bodies and approval metadata are unchanged.
