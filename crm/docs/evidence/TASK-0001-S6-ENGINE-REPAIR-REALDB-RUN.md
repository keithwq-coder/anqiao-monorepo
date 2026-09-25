# TASK-0001 S6 engine-per-call repair — real-database re-run (2026-08-03)

- Task: TASK-0001 (`docs/tasks/active/TASK-0001-manual-core-record-activity.md`)
- Authorization: DEC-0078 (product owner, 2026-08-03) — repair of the
  engine-per-call pattern confined to `src/crm/persistence/database.py`, plus
  one follow-up real-database round on `crm_test` re-running the gated suite.
  Transport model of DEC-0076 reused (SSH local port forward, test-only role
  `crm_test_runner`, credentials from gitignored `.env.crm_test_local`, values
  never printed). Threshold relaxation refused (DEC-0078 point 6) — untouched.
- Executor: DeepSeek V4 Flash (product-owner-stated identity; per DEC-0066
  reputation is never evidence — output judged only against the SPEC and the
  verification commands)
- Execution date: 2026-08-03
- Status: **PASSED** (evidence-corrected 2026-08-03) — Phase 1 local gate
  held; the gated suite returned `19 passed, 0 failed` against `crm_test`,
  including the response-time test, but that real-database run exercised the
  intermediate `str(settings.database_url)`-key revision of `database.py`, not
  the current `_cache_key()` tuple-key revision. See §2.2 key-version
  clarification and the corrected §5.1 for the exact evidence labels.

## 1. Phase 1 — repair (local, `src/crm/persistence/database.py` only)

### 1.1 Change made

`SessionLocal()` no longer builds a new `Settings()` + new engine on every
call. It now resolves `Settings()` once per call (unchanged) and delegates to
`get_session_factory(settings)()`. The factory cache is keyed on the resolved
database URL:

- `_factory: None` (single global, settings-ignoring) replaced by
  `_factories: dict[tuple, sessionmaker[Session]]` keyed by `_cache_key(settings)`
  — a tuple of every resolved configuration dimension (host, port, database,
  user, sslmode, SHA-256 of the password), so any change — including a
  credential rotation — rebuilds the engine instead of reusing a stale one,
  and no plaintext credential ever enters the key.
- `get_session_factory(settings)` now honors its argument: a changed
  configuration (any dimension of host/port/database/user/sslmode/password)
  builds a fresh engine instead of silently returning the stale first-call
  factory. The pre-existing trap DEC-0078 point 2 named is fixed as in-scope.
- The 22 `SessionLocal()` call sites across six files are untouched; the
  `SessionLocal()` signature is unchanged (each call still returns a new
  session — `SESSIONS_DISTINCT: True`).
- No pool tuning, no repository refactoring, no P2 `ENABLED` change.

### 1.2 Local gate evidence

- `python -m compileall src tests` → `COMPILE_OK`.
- Full suite via `scripts/dev-test.ps1` and `pytest tests -q` (both forms):
  **`133 passed, 28 skipped`, 0 failed** (11 warnings, unchanged baseline).
- `scripts/check-governance.ps1` → `[PASS]` (7 approved SPECs, 6 active tasks,
  1 legacy manifest).
- Engine-reuse/keying assertion proven non-vacuous per DEC-0073 point 4: a
  temporary verification script (outside the repository) loaded the
  pre-repair backup of `database.py` via `SourceFileLoader` and the repaired
  module in one process:
  - repaired: `REUSE_SAME_CONFIG: True`, `REBUILD_ON_CHANGE: True`,
    `SESSIONS_DISTINCT: True`, `ASSERTION_PASSED: True`;
  - pre-repair backup: `REUSE_SAME_CONFIG: False` — the same assertion really
    fails when the engine is not reused. No test file was added or changed.
- Record-hygiene correction: the temporary verification script above was
  discarded and never retained, which falls short of DEC-0076 point 5's
  retained-log requirement for this round's evidence. The coordinator
  independently rebuilt the same keying proof (six-dimension bidirectional
  key-control proof) and re-verified it, so the missing artifact does not
  block the conclusion; the record-keeping defect is noted here.

## 2. Phase 2 — real-database re-run on `crm_test`

### 2.0 Transport and port

- Port: **55436** (127.0.0.1:55436 → server 127.0.0.1:5432); verified free
  before opening (`netstat`: no 5543x listeners).
- Forward: `ssh -N -o StrictHostKeyChecking=no -o BatchMode=yes
  -o ExitOnForwardFailure=yes -L 55436:127.0.0.1:5432 ubuntu@124.222.212.159`
  (background). Confirmed `FORWARD-LISTENING: 127.0.0.1:55436`.
- `.env.crm_test_local` was read into the process environment only (values
  never printed, logged or written anywhere); `DATABASE_HOST=127.0.0.1` and
  `DATABASE_PORT=55436` overrode the file at runtime; the file itself was not
  modified.

### 2.1 Fail-closed isolation gate (before any write) — PASSED

Command (read-only): load `.env.crm_test_local` keys into env, `Settings()`,
`build_engine`, `SELECT current_database()`.

Output:

```
CFG_NAME: crm_test HOST: 127.0.0.1 PORT: 55436 USER: crm_test_runner
CURRENT_DATABASE: crm_test
IS_CRM_TEST: True
ISOLATION_GATE: PASSED
```

None of the DEC-0076 point 6 stop conditions fired (SSH auth OK, credential
accepted, database is `crm_test`). No write occurred before this proof.

### 2.2 Gated suite against crm_test — 19 passed, 0 failed (intermediate str(URL)-key revision)

Commands (run 1 with `-q`, run 2 with `-v`). Run 2's full verbose output is
retained in `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.log`; run 1's
summary line is recorded here only.

#### Key-version clarification (evidence-correction round, 2026-08-03)

- [VERIFIED] The `19 passed, 0 failed` runs (13:34) executed against the
  **intermediate** revision of `database.py` whose cache key was
  `str(settings.database_url)` (the masked URL string). Mtime ordering proves
  the runs predate the current code: retained log `...RUN.log` 13:34:16,
  evidence file `...RUN.md` 13:47:23, current `database.py` 13:48:18 — the
  code changed 14 minutes after the gated suite ran.
- [NOT VERIFIED] The current `_cache_key()` six-tuple revision (13:48) has
  never run against `crm_test`. Reason: the security follow-up that switched
  the key from the masked URL string to the six-tuple landed after the gated
  suite had already run and its log had been retained; no second
  real-database round was authorized in this scope (DEC-0076/DEC-0078 each
  authorized one follow-up round).
- [VERIFIED] The two key forms behave identically under the gated suite's
  single fixed configuration. Source: coordinator independent re-check
  (measured, not inferred):
  `[tuple-key (current, 13:48)] CACHE_ENTRIES: 1 ONE_ENGINE_ACROSS_4_RESOLUTIONS: True`,
  `[str(URL)-key (as run 13:34)] CACHE_ENTRIES: 1 ONE_ENGINE_ACROSS_4_RESOLUTIONS: True`,
  `SINGLE_CONFIG_BEHAVIOR_IDENTICAL: True`; the only behavioral difference is
  the password dimension (`[tuple-key] REBUILD_ON_PASSWORD_CHANGE: True` vs
  `[str(URL)-key] REBUILD_ON_PASSWORD_CHANGE: False`,
  `PASSWORD_DIMENSION_ONLY_DIFFERENCE: True`).
- [INFERENCE] The current tuple-key code is therefore expected to produce the
  same `19 passed` on `crm_test`, but this is inferred from the equivalence
  above — it is not a verified run. A re-run against `crm_test` remains
  unauthorized in this round.

```
load .env.crm_test_local keys into env; CRM_RUN_POSTGRESQL_TESTS=1
DATABASE_HOST=127.0.0.1 DATABASE_PORT=55436
python -m pytest tests/test_s6_integration.py
```

Results: `19 passed, 2 warnings in 35.24s` (run 1) and
`19 passed, 2 warnings in 38.12s` (run 2, verbose). All 19 tests, verbatim:

```
tests/test_s6_integration.py::TestAuthenticationFlow::test_login_page_returns_200 PASSED
tests/test_s6_integration.py::TestAuthenticationFlow::test_dashboard_requires_auth PASSED
tests/test_s6_integration.py::TestAuthenticationFlow::test_login_api_with_invalid_credentials PASSED
tests/test_s6_integration.py::TestAuthenticationFlow::test_login_api_with_valid_credentials PASSED
tests/test_s6_integration.py::TestAuthenticationFlow::test_session_is_persisted PASSED
tests/test_s6_integration.py::TestAuthenticationFlow::test_logout_invalidates_session PASSED
tests/test_s6_integration.py::TestInstitutionCRUD::test_create_institution PASSED
tests/test_s6_integration.py::TestInstitutionCRUD::test_list_institutions PASSED
tests/test_s6_integration.py::TestInstitutionCRUD::test_get_single_institution PASSED
tests/test_s6_integration.py::TestInstitutionCRUD::test_validation_rejects_invalid_name PASSED
tests/test_s6_integration.py::TestDataPersistence::test_data_exists_in_database PASSED
tests/test_s6_integration.py::TestDataPersistence::test_created_user_can_login PASSED
tests/test_s6_integration.py::TestDataPersistence::test_multiple_users_different_roles PASSED
tests/test_s6_integration.py::TestSecurityAndIsolation::test_unauthenticated_access_denied PASSED
tests/test_s6_integration.py::TestSecurityAndIsolation::test_no_external_network_calls PASSED
tests/test_s6_integration.py::TestSecurityAndIsolation::test_rate_limiting_enabled PASSED
tests/test_s6_integration.py::TestSecurityAndIsolation::test_error_messages_dont_expose_sensitive_info PASSED
tests/test_s6_integration.py::TestPerformanceAndStability::test_api_response_time_within_transport_budget PASSED
tests/test_s6_integration.py::TestPerformanceAndStability::test_concurrent_requests_handled PASSED
```

### 2.3 Response-time test — PASSED with measured times

`test_api_response_time_within_transport_budget` PASSED in both suite runs
(was the only failure last round at 9.60 s / 9.11 s). The exact request the
test times (login then `GET /api/institutions?limit=1` through the same
forward, same `TestClient` path, same stopwatch placement) was measured three
additional times:

```
RUN1 LOGIN_STATUS: 200 GET_STATUS: 200 ELAPSED: 0.594s WITHIN_5S: True
RUN2 LOGIN_STATUS: 200 GET_STATUS: 200 ELAPSED: 0.797s WITHIN_5S: True
RUN3 LOGIN_STATUS: 200 GET_STATUS: 200 ELAPSED: 0.763s WITHIN_5S: True
```

0.59-0.80 s versus the 5 s budget. Consistent with DEC-0078's inference from
the prior probe data (pooled query 0.263 s + request overhead) that a request
reusing one engine lands well under 5 s.

### 2.4 Forward termination

`kill` of the forward process; post-check:
`FORWARD-TERMINATED-CONFIRMED: no listener on 55436`.

## 3. Local re-runs after the round

1. `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` →
   `133 passed, 28 skipped, 0 failed` (11 warnings, unchanged baseline).
2. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` →
   `[PASS]`.

## 4. Boundary compliance

- Database touched: `crm_test` only, proven by `SELECT current_database()`
  before any test write. No access to `anqiao_crm` or any other database.
- No server service started, stopped, restarted or reconfigured; no
  nginx/TLS/DNS/firewall/`postgresql.conf`/`pg_hba.conf`/systemd change; no
  credential rotation; no git commit or push; no dependency change; no paid
  service; nothing on the host touched besides the read-only SSH commands and
  the forward.
- No credential value appears in any command line, output, log or this file
  (only key names and the `crm_test_runner` role name); residue scan of both
  retained logs for `password|secret|DATABASE_` returns 0.
- Files changed this round: `src/crm/persistence/database.py` (the authorized
  repair), this evidence file, and the retained raw log
  `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.log`. No test file, no
  script, no other application file modified.

## 5. Completion report (AGENTS.md §9)

1. **Status**: PASSED (for this round's scope), with the 2026-08-03
   evidence correction applied to the real-database claim:
   - Phase 1: repair in `database.py` only; local gate held at
     `133 passed, 28 skipped`, 0 failed; governance `[PASS]`; reuse/keying
     assertion proven non-vacuous (fails on the pre-repair code).
   - Phase 2: gated suite `19 passed, 0 failed` on `crm_test` (twice);
     response-time test PASSED with measured 0.594 / 0.797 / 0.763 s;
     isolation gate proven before any write; forward terminated; local
     re-runs green.
   - [VERIFIED] Those real-database runs (13:34) executed the **intermediate**
     `str(settings.database_url)`-key revision of `database.py`, not the
     current code. Mtime evidence: retained log 13:34:16, evidence file
     13:47:23, current tuple-key revision 13:48:18
     (`docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.log`, the evidence
     file itself, `src/crm/persistence/database.py`).
   - [NOT VERIFIED] The current `_cache_key()` six-tuple revision has never
     run on `crm_test`: the security follow-up introducing it landed ~14
     minutes after the gated suite ran, and no second real-database round was
     authorized in this scope.
   - [VERIFIED] Behavior equivalence under the gated suite's single fixed
     configuration (coordinator independent re-check, measured): both key
     forms yield `CACHE_ENTRIES: 1` and `ONE_ENGINE_ACROSS_4_RESOLUTIONS:
     True` (`SINGLE_CONFIG_BEHAVIOR_IDENTICAL: True`); the only difference is
     the password dimension (`REBUILD_ON_PASSWORD_CHANGE`: True tuple-key vs
     False str(URL)-key; `PASSWORD_DIMENSION_ONLY_DIFFERENCE: True`).
   - [INFERENCE] The current tuple-key code is therefore expected to produce
     the same `19 passed` on `crm_test`, but this is inferred from the
     equivalence above — it is not a verified run. Re-running the gated suite
     against `crm_test` with the current code remains unauthorized and is the
     exact remaining check.
2. **Scope**: `src/crm/persistence/database.py` (SessionLocal caching +
   settings-keyed cache; 22 call sites untouched) + this evidence file + raw
   run log.
3. **Evidence**: commands and outputs above; full verbose suite output in the
   retained log. Categories distinguished: static inspection (1.1), automated
   tests (1.2, 3), local runtime (keying verification script, 1.2 — per the
   record-hygiene correction above the script itself was discarded and the
   proof was rebuilt and re-verified independently by the coordinator),
   real-database proof (2.1-2.3), human acceptance: none performed.
4. **Not verified**: S6 formal acceptance (coordinator/product-owner
   adjudication pending on the evidence in this file); the response-time
   figure on the server's own loopback — not authorized (DEC-0077 point 6
   defers it; a pass through the forward is evidence about the forward path
   only); W4 formal acceptance; G5; release/nginx/TLS/DNS/cutover; S4's
   `crm_test` leg remains `[UNVERIFIED — single source]` per DEC-0070 point 4
   (unchanged, out of scope); the P2 hardcoded `user_status=ENABLED` stays
   open per DEC-0078 point 7.
5. **Decisions needed**: none from the executor. The S6 gate adjudication and
   the still-unauthorized server-loopback measurement are coordinator/product-
   owner calls recorded in DEC-0077 point 6 and DEC-0078 point 6.

## 6. Security review follow-up (2026-08-03, post-round)

An independent `security_review` of the final state returned `warn` — no
blocking issue — with one MEDIUM and two LOW findings. The MEDIUM was checked
against the runtime rather than taken on report, and is a **false positive**:

- [VERIFIED] MEDIUM claimed `key = str(settings.database_url)` puts the
  plaintext password into the cache key because `URL.__str__` defaults to
  `hide_password=False`. Runtime check against the pinned SQLAlchemy 2.0.51 in
  this venv shows the opposite: `str(URL)` and `repr(URL)` both render the
  password as `***`
  (`postgresql+psycopg://u:***@h:5432/d?sslmode=prefer`), identical to
  `render_as_string(hide_password=True)`. The original key carried no
  plaintext. The review itself confirmed the claim does not apply to this
  venv's SQLAlchemy (no `__str__` on `URL`; `repr` is the masked render).
  Resolved anyway: the follow-up review also surfaced that a masked-URL key
  silently drops the password dimension (two configs differing only in
  password would share a key), which contradicts DEC-0078 point 2's
  rebuild-on-change intent. The key is therefore now `_cache_key(settings)`
  — a tuple of (host, port, database, user, sslmode, SHA-256(password)) —
  which covers every dimension including credential rotation while keeping
  the password out of the key. Verified: `PASSWORD_DIMENSION: True` (a
  password-only change now rebuilds the engine), full suite still
  `133 passed, 28 skipped`, 0 failed.
- [VERIFIED] LOW 1 (no eviction from `_factories`; a rotated credential leaves
  the old pool strongly referenced until process exit): accepted as-is —
  production runs one fixed configuration per process, and credential rotation
  is an operational event that accompanies a service restart. Zero impact for
  a single deployment.
- [VERIFIED] LOW 2 (evidence file records the public IP, SSH user and
  `StrictHostKeyChecking=no` invocation): accepted as-is — this matches the
  established record pattern already accepted in the handoff and DEC-0077's
  evidence; no credential, key, token or personal data appears anywhere.
- [VERIFIED] Checked-and-clean: concurrent check-then-act on the cache has no
  security consequence under GIL (worst case a duplicate engine build with the
  same URL and credential); pool reuse keeps role/database/sslmode semantics
  identical; `echo` stays False; the evidence file and retained log contain no
  credential values (residue scan 0).

## 7. Record-hygiene notes (evidence-correction round, 2026-08-03)

1. [VERIFIED] A batch of Python 3.14 bytecode artifacts
   (`tests/__pycache__/*.cpython-314-pytest-9.0.2.pyc` and
   `src/**/__pycache__/*.cpython-314.pyc`) was written 2026-08-03
   13:52:58-59. The coordinator parsed the source mtime embedded in the pyc
   headers and confirmed both the gated test file and `database.py` compiled
   from the current sources (`test_s6_integration.py` 08:53:29 / `database.py`
   13:48:18 → `MATCHES_CURRENT_SOURCE: True` for both), so the batch is not
   stale or foreign output. `pyproject.toml` requires
   `python = ">=3.12,<3.15"`, which admits Python 3.14, so compiling under
   3.14 does not cross any project boundary.
2. [VERIFIED] `.pytest_cache/v/cache/lastfailed` (current mtime 18:19:44,
   stat by the independent auditor) retains one entry,
   `test_delete_institution_admin_only`, a test removed on 2026-08-03 as out
   of SPEC-0001 scope. The mtime 13:54:14 recorded in the first correction
   pass is stale: the file was rewritten inside this round's window by an
   unrecorded pytest run under Python 3.11 (item 3 below; [INFERENCE] same
   run, from the adjacent 18:18:46-47 pyc batch). DEC-0079's ~13:54 Python
   3.14 run remains the earlier, not the current, write; which unrecorded run
   wrote the entry is [UNKNOWN] and is not reconstructed here. The cache
   residue is stale state, not evidence of a current failure.
3. [UNKNOWN] 18 Python 3.11 bytecode artifacts
   (`tests/__pycache__/*.cpython-311-pytest-9.0.2.pyc`) exist, written
   2026-08-03 18:18:46-47 (stat by the independent auditor). The first
   correction pass recorded only the Python 3.14 batch (item 1) and missed
   this batch. The artifacts accompany an unrecorded pytest run under Python
   3.11; that run's command and result are [UNKNOWN] and are not
   reconstructed here.
