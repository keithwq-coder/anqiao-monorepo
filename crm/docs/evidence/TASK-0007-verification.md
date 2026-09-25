# TASK-0007 verification evidence — durable authentication and authorization repair

- Recorded by: bounded implementation executor for TASK-0007, dispatched by the
  repository coordinator under
  `docs/handoffs/HANDOFF-20260802-KIMI-TASK-0007-IMPLEMENTATION.md` (DEC-0067)
- Executor runtime identifier (recorded verbatim per DEC-0066/DEC-0067; never a
  gate): `5f121e6f-b747-4f1e-8162-dd0214cef1d2/k3-256k`
- Date: 2026-08-02
- Every command below was run from the repository root
  `D:\Project\中科安樵\crm` with interpreter `.venv/Scripts/python.exe`
  (Python 3.12.8) unless stated otherwise. No command accessed the network, a
  server, SSH, a cloud host, or a remote database. No git operation was
  performed. No real credential was used or printed; all fixtures are
  synthetic. No dependency was installed, upgraded, or removed.

## 1. Commands run and results

| # | Command | Result |
|---|---|---|
| 1 | `.venv/Scripts/python.exe -m compileall -q src tests` | PASS — exit 0 (`COMPILEALL_OK`), all sources byte-compile |
| 2 | `.venv/Scripts/python.exe -m pytest tests/test_s4_authentication.py -q` | PASS — 21 passed, 1 skipped in 4.40s (skip = CRM_RUN_POSTGRESQL_TESTS-gated test, section 3) |
| 3 | `.venv/Scripts/python.exe -m pytest tests/test_task0007_auth_service.py -q` | PASS — 25 passed in 4.57s |
| 4 | `.venv/Scripts/python.exe -m pytest tests/test_task0007_auth_http.py -q` | PASS — 23 passed in 3.46s |
| 5 | `.venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py tests/test_task0007_inmemory_fakes.py -q` | PASS — 5 skipped in 0.42s (all 5 gated, section 3; the fakes module contains no test functions) |
| 6 | `.venv/Scripts/python.exe -m pytest tests/test_s4_authentication.py tests/test_task0007_auth_service.py tests/test_task0007_auth_http.py tests/test_task0007_postgresql_sessions.py tests/test_task0007_inmemory_fakes.py -q` | PASS — 69 passed, 6 skipped in 11.42s |
| 7 | `.venv/Scripts/python.exe -m pytest -q` (full suite, no ignores) | PRE-EXISTING collection error, unchanged from baseline — `tests/test_s6_integration.py:18` imports `crm.web.main` at module top; `Settings()` at `crm/web/main.py:19` raises `ValidationError` (missing `DATABASE_HOST`/`DATABASE_NAME`/`DATABASE_USER`/`DATABASE_PASSWORD`). Identical root cause and location as the pre-dispatch baseline recorded in `TASK-0007-preflight.md` section 5. Not a regression; file is not owned by this task. |
| 8 | `.venv/Scripts/python.exe -m pytest -q --ignore=tests/test_s6_integration.py --ignore=tests/test_s6_integration_simple.py` (baseline-comparable command, exactly as preflight section 5) | PASS — 116 passed, 9 skipped in 12.24s. Baseline was `2 failed, 65 passed, 4 skipped, 1 error`. Arithmetic: 65 baseline-passing + 3 previously-failing s6 tests + 48 new task0007 tests (25 service + 23 HTTP) = 116; 4 baseline skips + 5 new gated skips = 9. See section 2 for the s6 delta explanation. |
| 9 | `.venv/Scripts/python.exe -m pytest tests/test_s6_e2e_auth.py -q` (isolation check, diagnostic) | 2 failed, 2 skipped, 1 error in 0.55s — identical to the pre-dispatch baseline failure signature (`Settings()` env validation on deferred `from crm.web.main import app`). Confirms the s6 delta in the full run is an import-time environment side effect, not an edit to s6 files. |
| 10 | `.venv/Scripts/python.exe -m pytest tests/test_s6_e2e_auth.py tests/test_task0007_auth_http.py -q` (diagnostic) | 26 passed, 2 skipped in 3.55s — confirms the mechanism in section 2. |
| 11 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS — `Governance structure and gates are consistent.` (Approved SPECs: 7, Active tasks: 5, Legacy manifests: 1). Run BEFORE the task-card status update; re-run after it (section 4). |

Test totals across the owned/auth-focused suites (commands 2–5): 69 passed,
6 skipped, 0 failed. Full baseline-comparable suite (command 8): 116 passed,
9 skipped, 0 failed, 0 errors.

## 2. s6 delta explanation (2 failed + 1 error at baseline now pass)

No `tests/test_s6_*` file was edited (not owned; verified by content — the
failures in isolation are byte-identical to baseline). The mechanism:

- `tests/test_s6_e2e_auth.py` imports `crm.web.main` lazily inside fixtures
  and test bodies (lines 14, 86, 91, 99), not at module top.
- `tests/test_task0007_auth_http.py` (created by this task) sets synthetic
  `DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_NAME`/`DATABASE_USER`/
  `DATABASE_PASSWORD`, `CRM_ENVIRONMENT=test`, `SESSION_COOKIE_SECURE=false`,
  and `SESSION_SECRET_KEY` via `os.environ.setdefault` at module top — the
  same pattern the pre-existing `tests/test_s6_integration_simple.py:10-13`
  uses — because `crm.web.main` evaluates `Settings()` at import time.
- In a full-suite run, pytest imports all collectible modules during the
  collection phase, so the synthetic env vars exist before the s6 tests
  execute their deferred imports; `Settings()` succeeds and the three s6
  tests pass (their `SESSION_COOKIE_SECURE` expectation at line 119 reads the
  same env var, so the cookie assertion is self-consistent).
- In isolation (command 9) the s6 tests fail exactly as the baseline recorded.

Consequence: the s6 pass in the full run is an import-time side effect of a
test module owned by this task, not a repair of s6 code. Values leaked are
synthetic test fixtures only; no real credential is involved. This is
reported transparently so the coordinator can judge whether the side effect
is acceptable; removing it would require editing non-owned s6 files or
`tests/conftest.py`, both outside this task's scope (BLOCKER-worthy only if
the coordinator requires the isolation failure to disappear, which no rule
demands — the baseline failure is pre-existing and its root cause lives in
non-owned files).

## 3. NOT VERIFIED (with exact reason and exact remaining check)

Reason for all items below: no local PostgreSQL is available on this machine
(probe evidence in `TASK-0007-preflight.md` section 2: `psql` not on PATH, no
PostgreSQL service/process/install directory, TCP probe to localhost:5432
timed out). Installing PostgreSQL would violate the no-install boundary; a
remote database would violate the no-network/no-remote-database boundary.
Every check that can run without a database was run (section 1).

1. `tests/test_task0007_postgresql_sessions.py` (5 tests) — real-PostgreSQL
   repository proofs: hash-only persisted columns, active-session lookup,
   expiry exclusion, CSRF-hash rotation, invalidation reason pairs, audit
   repository outcome validation, role-grant loading with revocation, and a
   two-`AuthenticationService`-instance restart proof over the real
   `server_sessions` table.
   Exact remaining check: `set CRM_RUN_POSTGRESQL_TESTS=1` (with
   `DATABASE_*` pointing at an isolated local `*_test` PostgreSQL) then run
   `.venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`.
2. `tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use`
   (1 test) — real-PostgreSQL forced-logout/epoch-invalidation proof.
   Exact remaining check: same gate and command shape as above, run against
   `tests/test_s4_authentication.py -q`.
3. `tests/test_migrations.py` gated round-trip (1 skip, pre-existing,
   unrelated to this task's changes but counted in the suite totals) —
   requires the same isolated local migration-test database.

The in-memory fakes in `tests/test_task0007_inmemory_fakes.py` implement the
exact repository contracts and back the 69 passing tests, so session
durability semantics (hash-only persistence, expiry, invalidation pairs,
epoch mismatch, cross-instance restart survival, CSRF rotation) are
behaviorally proven against the contract; only the PostgreSQL-backed
execution of those same contracts is NOT VERIFIED.

## 4. Task-card update and governance re-check

After this file was written, only the per-step `Status:` values and the
`## Evidence and result` section of
`docs/tasks/active/TASK-0007-auth-authorization-repair.md` were updated
(governance-validated fields `- Depends on:`, `## Prerequisites and completion
gate`, `Approved SPEC:`, `Approval metadata:` preserved verbatim).
`scripts/check-governance.ps1` was re-run after the edit: PASS
(`Governance structure and gates are consistent.`).
