# TASK-0008 crm_test gated verification (coordinator-run, DEC-0082)

- Date: 2026-08-05
- Verdict: **PASSED** (after test-data fix for R-035 interaction)
- Auditor / executor: coordinator (opencode / grok-4.5)
- Authority: DEC-0082 (product owner option 1, 2026-08-05)
- Route: SSH local forward 127.0.0.1:55440 → server loopback:5432,
  test-only role `crm_test_runner`, credentials from gitignored
  `.env.crm_test_local` (values never printed)

## Isolation proof (before any write)

- `current_database()` = `crm_test` `[VERIFIED]`
- `database_name` in Settings = `crm_test` `[VERIFIED]`
- `database_user` = `crm_test_runner` `[VERIFIED]`
- 10 public tables (schema already migrated) `[VERIFIED]`
- No connection to `anqiao_crm`; no server config/service change; no credential
  printed `[VERIFIED]`

## First run (full suite with CRM_RUN_POSTGRESQL_TESTS=1)

- 15 failed, 189 passed, 5 errors — caused by two unrelated issues:
  1. `test_migrations.py` / `test_s4_authentication` use different DB
     credentials not scoped to `crm_test_runner` (out of TASK-0008 scope).
  2. `test_s6_integration.py` institution-create tests hit **409 Conflict**
     from TASK-0008 S3 R-035 duplicate detection: the shared `crm_test`
     database carries residual rows from prior gated runs with the same
     fixed name `测试机构 - S6 E2E Test`, so the new duplicate guard
     correctly refused creation.

## Root cause and fix

The 409 is **correct application behavior** introduced by TASK-0008 S3
(R-035/AC-028). The gated tests used a fixed institution name and did not
send `confirm_duplicate=true`, so against a `crm_test` with residual data
the guard fires. This is the intended R-035 behavior, not a regression.

Fix (test-data only, no application code changed): make the institution
name unique per call in `test_institution_data` and in
`test_no_external_network_calls` so residual rows never match. This is the
same pattern the `idempotency_key` already uses.

Files changed (test-only):
- `tests/test_s6_integration.py` — `test_institution_data` fixture name
  gains a per-call UUID suffix; `test_no_external_network_calls` name
  gains a per-call UUID suffix.

## Re-run (gated set only, per historical convention)

Commands (redacted):
```
SSH forward: ssh -N ... -L 55440:127.0.0.1:5432 ubuntu@<host>
set -a && . .env.crm_test_local && set +a
export DATABASE_HOST=127.0.0.1 DATABASE_PORT=55440
export CRM_RUN_POSTGRESQL_TESTS=1 PYTHONPATH=src
.venv/Scripts/python.exe -m pytest \
  tests/test_task0007_postgresql_sessions.py \
  tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use \
  tests/test_s6_integration.py -q --tb=line
```

Result: **25 passed, 2 warnings in 91.06s** — `EXIT_CODE=0` `[VERIFIED]`

Raw log: `docs/evidence/TASK-0008-CRM-TEST-GATED-RERUN.log`

## Local regression (test edit did not break local)

- Full local ungated suite after the edit: **183 passed, 28 skipped**
  `[VERIFIED]`
- `check-governance.ps1` → `[PASS]` `[VERIFIED]`

## Status

- TASK-0008 gated `crm_test` leg: **PASSED** (25/25 gated tests green on
  real PostgreSQL via the proven SSH-forward route).
- Two test-data edits in `test_s6_integration.py` were necessary and are
  test-only; no application code changed in this round.
- Still NOT VERIFIED: browser visual acceptance, deploy/server.
