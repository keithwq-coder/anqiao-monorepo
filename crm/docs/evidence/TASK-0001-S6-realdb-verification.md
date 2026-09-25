# TASK-0001 S6 real-database verification round (2026-08-03)

- Task: TASK-0001 (`docs/tasks/active/TASK-0001-manual-core-record-activity.md`)
- Authorization: DEC-0076 (product owner, 2026-08-03) — one combined round on
  `crm_test` covering the gated suite, restart persistence and the
  `repositories.py` double-write; local uvicorn start/stop permitted; retained
  logs mandatory.
- Transport: DEC-0069 model reused — SSH local port forward to the server's
  loopback PostgreSQL endpoint, test-only role `crm_test_runner`, credentials
  from gitignored `.env.crm_test_local` (values never printed).
- Executor: DeepSeek V4 Flash (product-owner-stated identity for this round;
  per DEC-0066 reputation is never evidence — output is judged only against
  the SPEC and the verification commands)
- EXECUTOR_RUNTIME_ID: product-owner statement, not independently verified
- Execution date: 2026-08-03
- Status: **PARTIAL** — restart persistence and the double-write PASSED with
  runtime evidence; the gated suite is 18/19 PASSED with
  `test_api_response_time_within_transport_budget` FAILING reproducibly
  (see section 2.3 and the Decisions needed section)

## 0. Local forward port chosen and recorded

- Port: **55435** (127.0.0.1:55435 → server 127.0.0.1:5432). Prior rounds used
  55432 (executor), 55433/55434 (coordinator); 55435 was verified free before
  opening.
- Forward opened with: `ssh -N -o StrictHostKeyChecking=no -o BatchMode=yes
  -o ExitOnForwardFailure=yes -L 55435:127.0.0.1:5432 ubuntu@124.222.212.159`
  (background, hidden window). Confirmed `FORWARD-LISTENING: 127.0.0.1:55435`.
- Note: `.env.crm_test_local` still contains the stale `DATABASE_PORT=55432`
  from the TASK-5A era; it was **overridden at runtime** in every command
  (`DATABASE_PORT=55435`). The file itself was not modified.

## 1. Fail-closed isolation gate (before any write) — PASSED

Command (credentials sourced into the process environment, never printed):

```
.venv\Scripts\python.exe -c "<read .env.crm_test_local keys into env;
DATABASE_HOST=127.0.0.1 DATABASE_PORT=55435; Settings(); build_engine;
SELECT current_database()>"
```

Output:

```
CFG_NAME: crm_test HOST: 127.0.0.1 PORT: 55435 USER: crm_test_runner
CURRENT_DATABASE: crm_test
IS_CRM_TEST: True
```

Fail-closed conditions (DEC-0076 point 6) checked: SSH auth succeeded
(`SSH_AUTH_OK / ubuntu / VM-0-17-ubuntu`); the `.env.crm_test_local`
credential was accepted; `current_database()` returned `crm_test` before any
write. None of the stop conditions fired.

## 2. Gated suite against crm_test — 18/19 PASSED, 1 FAILED

Command:

```
set env from .env.crm_test_local; CRM_RUN_POSTGRESQL_TESTS=1
DATABASE_HOST=127.0.0.1 DATABASE_PORT=55435
.venv\Scripts\python.exe -m pytest tests/test_s6_integration.py -q
```

Result: `18 passed, 1 failed, 2 warnings in 353.37s (0:05:53)`.

### 2.1 The two 2026-08-03 rewritten tests (first-ever real execution)

| Test | Result |
|---|---|
| `test_no_external_network_calls` (rewritten to record non-loopback sockets) | **PASSED** — the guard recorded no non-loopback destination during login + institution creation against `crm_test` |
| `test_api_response_time_within_transport_budget` (renamed from the 500ms misnomer; asserts < 5.0s) | **FAILED** — see 2.2 |

### 2.2 Exact failure output (first run, full suite)

```
E AssertionError: Response took 9.60s, expected < 5s
E assert 9.600173473358154 < 5.0
tests\test_s6_integration.py:458: AssertionError
FAILED tests/test_s6_integration.py::TestPerformanceAndStability::test_api_response_time_within_transport_budget
1 failed, 18 passed, 2 warnings in 353.37s
```

### 2.3 Reproducibility and root-cause diagnosis (read-only)

Isolated rerun of the single test:

```
.venv\Scripts\python.exe -m pytest "tests/test_s6_integration.py::TestPerformanceAndStability::test_api_response_time_within_transport_budget" -q
→ FAILED: Response took 9.11s, expected < 5s  (1 failed in 16.68s)
```

Reproducible, not a flake. Timing probes through the same forward:

| Probe | Measured |
|---|---|
| `build_engine` only | 0.087 s |
| Simple `SELECT 1` on a pooled connection | 0.263 s |
| **Cold connect** (fresh `build_engine` + connect + `SELECT 1`) | 1.279 / 1.427 / 1.246 s |

Root cause [VERIFIED by source + probes]: `src/crm/persistence/database.py:42-43`
— `SessionLocal()` constructs a brand-new engine (new TCP connection) on
**every call**, with the comment "less efficient but safer for tests" and the
note that production should use `get_session_factory()`. One
`GET /api/institutions?limit=1` request path makes several repository calls
(session validation, institutions list, contacts, activities), each opening a
fresh connection through the SSH forward (cold connect ~1.3 s each), so a
single request accumulates ~9-11 s. The 5 s "transport budget" assumption —
that public-network SSH RTT dominates — is wrong: it is per-request connection
churn amplified by the forward that dominates. On the server itself (DB on
localhost, no forward) each new connection is milliseconds, so the local suite
never sees this.

This is a real, reproducible finding, reported per DEC-0076 point 8 ("if a
defect is found, the executor reports it and stops"). **Not fixed this round**:
changing the test threshold or changing the connection pattern both need
separate authorization. Analysis and options are in the Decisions needed
section.

## 3. Restart persistence — PASSED (runtime evidence)

Local uvicorn process on the executor's machine only (DEC-0076 point 4). The
`anqiao-crm` service and every other host service were untouched.

Sequence (exact):

1. Start #1: `cmd /c "start /b .venv\Scripts\python.exe -m uvicorn crm.web.main:app --host 127.0.0.1 --port 8100"` with `DATABASE_*` pointing at `crm_test` through the forward; `CRM_ENVIRONMENT=test`, `SESSION_COOKIE_SECURE=false`, local test `SESSION_SECRET_KEY` (not a server secret).
   → `Uvicorn running on http://127.0.0.1:8100`, pid 31916.
2. Write synthetic data via API (http.cookiejar session, CSRF header):
   - `POST /api/auth/login` (username `admin`, the retained synthetic seed; password not printed) → 200, 6.49 s
   - `POST /api/institutions` → 201, id `f7419c1e-b81c-4015-bde7-3de81d9a8a7f`, 11.76 s
   - `POST /api/institutions/{id}/contacts` → 201, id `e738f543-f3ce-4cff-b2f1-be59710a2fef`, 9.95 s
   - `POST .../activities` occurred_at `2026-08-01T09:00:00+00:00` "重启验证-较早跟进" → 201, id `4234cc0f-...`, 9.91 s
   - `POST .../activities` occurred_at `2026-08-02T14:30:00+00:00` "重启验证-较新跟进" → 201, id `fda91ef5-...`, 10.15 s
   - `GET /api/institutions/{id}` → 200, 2 activities, 10.30 s
   - Order before restart: `['2026-08-02T22:30:00+08:00', '2026-08-01T17:00:00+08:00']` (occurred_at DESC, newest first)
3. Stop #1: `Stop-Process` on the listener pid → `STOPPED-CONFIRMED`.
4. Start #2: same command, same env → `Uvicorn running`, **pid 35560** (different process, fresh boot).
5. Verify after restart:
   - `POST /api/auth/login` → 200, 6.82 s
   - `GET /api/institutions/f7419c1e-...` → 200, 10.36 s
   - `PERSISTED: True` (institution + 1 contact + 2 activities all present)
   - `ORDER_OK: True` — order after restart identical:
     `['2026-08-02T22:30:00+08:00', '2026-08-01T17:00:00+08:00']`
   - `BODIES_OK: True` — both factual bodies read back intact
6. Stop #2: `Stop-Process` → `STOPPED-CONFIRMED`. No uvicorn process left.

Restart persistence and the deterministic `occurred_at DESC` history order are
verified against the real database.

## 4. Double-write at runtime — PASSED, with DEC-0073 point 4 fail-proof

Constructed the real `FollowUpActivityRepository` against `crm_test`, created
one activity, and checked the activity row and its v1 revision.

```
ACTIVITY_ROW: (ce1c3a01-70ee-471f-b370-677e6c5dfceb, f7419c1e-..., 1)  # current_version=1
REVISION_ROWS: [(ce1c3a01-..., 1, '<factual_body>', '<shared_summary>')]  # version_number=1
BOTH_ROWS_WRITTEN: True
FACTUAL_BODY_READBACK_OK: True
```

DEC-0073 point 4 proof that the check can fail (three phases, all observed):

- **PHASE 1 (intact)** — both rows present, body and summary read back:
  `PHASE1_INTACT both: True body: True summary: True` (assertion passed).
- **PHASE 2 (revision row deleted, simulating a single-write defect)** —
  `PHASE2_REVISION_MISSING both: False body: False summary: False` and
  `PHASE2_ASSERTION_FAILED_AS_REQUIRED: True`. The assertion really fails when
  one row is missing; it is not a vacuous green light.
- **PHASE 3 (revision restored exactly)** — `PHASE3_RESTORED both: True body:
  True summary: True`, `PHASE3_RESTORE_OK: True`.

Notes: restoring the revision row required supplying `created_at` explicitly
(the ORM default lives at the model layer, not the DB column). The deleted
revision was restored byte-equivalent (same factual_body, shared_summary,
version_number=1, content_attribution `salesperson_input`,
created_by_user_id = the activity's recorded_by_user_id, change_reason
"initial creation") in both directions of the experiment.

## 5. Data hygiene on crm_test

- The gated suite run accumulates its own synthetic institutions
  (26 `测试机构 - S6 E2E Test` rows were present, matching the pattern of the
  retained 2026-08-02 run data; kept per DEC-0070 point 3).
- This round's three artifacts were cleaned up after verification, in FK order
  (revisions → activities → contacts → owner history → institution):
  `CLEANUP inst_left: 0 acts_left: 0 revs_left: 0 contacts_left: 0`,
  `CLEANUP_OK: True`. The `admin` seed and the suite's own rows are untouched.

## 6. SSH forward termination

The forward (pid 34456) was stopped at the end of the round:
`FORWARD-TERMINATED-CONFIRMED` (no listener on 55435 after stop).

## 7. Local re-runs after the round

1. `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` →
   `133 passed, 28 skipped, 0 failed` (11 warnings, unchanged baseline).
2. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` →
   `[PASS]` (7 approved SPECs, 6 active tasks, 1 legacy manifest).

## 8. Boundary compliance

- Database touched: `crm_test` only, confirmed by `current_database()` before
  and around every write. No access to `anqiao_crm` or any other database.
- No server service was started, stopped, restarted or reconfigured; no
  nginx/TLS/DNS/firewall/`postgresql.conf`/`pg_hba.conf`/systemd change; no
  credential rotation; no git commit or push; no dependency change; no paid
  service; nothing on the host was touched other than the read-only SSH
  commands and the forward.
- No credential value appears in any command line, output, log or this file
  (only key names and the `crm_test_runner` role name).
- Files changed this round: this evidence file only (owned path
  `docs/evidence/TASK-0001-*`). No application code, no tests, no scripts
  modified.

## 9. Completion report (AGENTS.md §9)

1. **Status**: PARTIAL.
   - PASSED with runtime evidence: fail-closed isolation gate; restart
     persistence (records + deterministic `occurred_at DESC` order survive a
     real process stop/restart); `repositories.py:322-385` double-write with
     a demonstrated-failing assertion (DEC-0073 point 4).
   - FAILED: one gated test (`test_api_response_time_within_transport_budget`,
     9.60 s / 9.11 s > 5 s, reproducible; root cause: per-call new-engine
     pattern in `database.py:42-43` amplified by the forward). Reported, not
     fixed — repairing requires separate authorization (DEC-0076 point 8).
2. **Scope**: verification only. Files: this evidence file. crm_test synthetic
   writes created and cleaned up; suite artifacts retained as before.
3. **Evidence**: exact commands and outputs in sections 0-7. Distinguished:
   static inspection (root-cause read of `database.py`), automated tests (local
   suite 133/28), local runtime (uvicorn start/stop), real-database proof
   (sections 1-4), and no human acceptance anywhere.
4. **Not verified**: S6 formal acceptance (adjudication pending); the response
   time on the server's own loopback (not measured — would need a server-side
   test or deployment); W4 formal acceptance; G5; release/nginx/TLS/DNS/cutover;
   human business/visual acceptance.
5. **Decisions needed**: see next section.

## 10. Decisions needed (for the coordinator/product owner)

1. **The failing response-time test — how to proceed.** Three options:
   (a) treat the 5 s budget as a test-environment calibration problem and
   adjust the threshold with a documented rationale (test-only change, needs
   authorization); (b) treat the per-call new-engine pattern
   (`database.py:42-43` `SessionLocal()` building a fresh engine per call) as
   an application defect and switch repository/session paths to the existing
   `get_session_factory()` reuse — an application change, needs authorization,
   and would need re-verification on `crm_test`; (c) leave both unchanged and
   accept S6 as PARTIAL pending a decision. Recommendation from the executor:
   (b) is the root-cause fix and matches the code's own production note, but
   it is an application change and therefore the coordinator/owner's call;
   (a) alone would hide the connection-churn cost rather than remove it.
2. A fourth verification element worth considering (not executed, not
   authorized): measuring the same API response time against the server's own
   loopback (no forward) to separate forward latency from connection-churn
   cost. Left here rather than run, per the "verification only" boundary.
3. S4's `crm_test` leg remains `[UNVERIFIED — single source]` (DEC-0070 point
   4) — unchanged, not part of this round.
