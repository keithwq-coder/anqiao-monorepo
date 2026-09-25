# TASK-0001 S6 local leg: ungated no-external-call guard (2026-08-03)

- Task: TASK-0001 (`docs/tasks/active/TASK-0001-manual-core-record-activity.md`)
- Scope: S6 local portion only (authorized by DEC-0074 point 3: "Its local
  legs may proceed"). No database access, no transport, no restart of real
  uvicorn processes.
- Executor: DeepSeek V4 Flash (product-owner-stated model for this round per
  the task card ownership block; per DEC-0066 model identity is recorded as
  a product-owner statement and is never evidence — output is judged against
  the SPEC and verification commands only)
- EXECUTOR_RUNTIME_ID: product-owner statement, not independently verified
- Execution date: 2026-08-03
- Status: LOCAL LEG COMPLETE (new ungated guard test added and proven live);
  S6 real-database legs remain [NOT VERIFIED] (see section 4)

## 1. What was done

Added one **local, ungated** no-external-call test:
`tests/test_s6_local_no_external_calls.py`. It is NOT behind the
`CRM_RUN_POSTGRESQL_TESTS` module-level gate that skips
`tests/test_s6_integration.py` (lines 24-27 of that file), so it runs in
every local test run. The gated version is untouched — not deleted, not
weakened.

The new test reuses the S5 in-memory fixture pattern
(`tests/test_s5_pages_api_parity.py`): in-memory repositories
(`InMemoryUserRepository`, `InMemorySessionRepository`,
`InMemoryAuditRepository`, `InMemoryRoleGrantRepository`,
`MemoryInstitutionRepository`, `MemoryContactRepository`,
`MemoryActivityRepository`) are injected into `app.state`, a synthetic
enabled business user is seeded, and the client logs in with CSRF — the same
shape S5 proved works (`tests/test_s5_pages_api_parity.py:217-294`). No
database is constructed.

The guard itself mirrors the gated test's recording approach
(`test_s6_integration.py:337-392`): it wraps `socket.socket.connect` and
`socket.create_connection`, records every non-loopback destination, restores
both in a `finally`, and asserts the recorded list is empty. Under the guard
the test runs the SPEC-0001 four-step flow over the real request path
(POST /api/institutions, POST contacts, POST activities, GET detail page),
so the guard observes the actual page+API request path, not a stubbed one.

## 2. Guard limitations, stated honestly

The new test's docstring and this evidence state the same scope the gated
test has, no wider:

- The guard records only `socket.socket.connect` and
  `socket.create_connection` calls made from Python. A DNS lookup that never
  reaches a connect would not be recorded: `getaddrinfo` appears nowhere in
  `src/` or `tests/` [VERIFIED by grep, 2026-08-03], and the guard does not
  wrap it.
- Connections made at the C level (e.g. libpq/psycopg database traffic) are
  not observed by Python-level socket patching. In this local test no
  database traffic exists at all (in-memory repositories), so the guard
  covers Python-level outbound connection attempts on the request path.
- This is a positive check where none existed locally before
  (`grep socket tests/` → only `test_s6_integration.py` before this change),
  not a complete egress proof. The gated version has exactly the same scope.

Also recorded (unchanged fact, verified again this round):
`src/crm/config.py:44-48` — the `ai_enabled` validator raises on any true
value, so external AI is hard-disabled at the configuration layer.

## 3. DEC-0073 point 4 proof: the guard was observed failing

Standing rule (DEC-0073 point 4 / DEC-0074 point 4): an assertion introduced
to catch a named leak or denial must be observed failing on that condition
before it is reported as coverage.

### 3.1 Experiment (temporary, then removed)

A byte copy of `tests/test_s6_local_no_external_calls.py` was saved to
`C:\Users\K\AppData\Local\Temp\opencode\test_s6_local_no_external_calls.py.bak`.
The test was temporarily edited to make the **request path** attempt one
non-loopback connection: the in-memory institution repository's `create`
method was wrapped so that, when the route invoked it during the POST, it
called `socket.create_connection(("192.0.2.1", 443), timeout=0.01)`
(TEST-NET address, 10 ms timeout, exception swallowed so the flow continued;
marker `S6LOCAL-EXP-20260803`).

### 3.2 Observed failure (exact output)

```
F                                                                        [100%]
================================== FAILURES ===================================
______________ test_local_request_path_opens_no_external_socket _______________
...
>       assert attempted == [], f"Unexpected non-loopback socket attempts: {attempted}"
E       AssertionError: Unexpected non-loopback socket attempts: ["('192.0.2.1', 443)", "('192.0.2.1', 443)"]
E       assert ["('192.0.2.1...0.2.1', 443)"] == []
E         Left contains 2 more items, first extra item: "('192.0.2.1', 443)"
...
FAILED tests/test_s6_local_no_external_calls.py::test_local_request_path_opens_no_external_socket
1 failed, 1 warning in 0.88s
```

The attempt was recorded twice because the guard wraps both
`socket.create_connection` and `socket.socket.connect`, and
`create_connection` internally calls `connect` — both layers caught the same
single injected attempt [INFERENCE verified by probe run:
`create calls: 1` for the single POST while the guard recorded 2 entries for
the one injected attempt]. The assertion is live: an external connect on the
request path makes it fail with the recorded destinations.

### 3.3 Restored pass (exact output)

The file was restored byte-identically from the backup
(SHA-256 `D3AA4ADC0AB00948DE34043806FEAD22E723C69BCC8B5217C96F4E8557ACD63E`,
identical before/after):

```
.                                                                        [100%]
1 passed, 1 warning in 0.74s
```

### 3.4 Zero residue check

`Select-String -Path tests/test_s6_local_no_external_calls.py -Pattern
"TEMP-EXPERIMENT|S6LOCAL-EXP|192.0.2.1|_leaky_create|_s6_app"` → **0 hits**.
Restored file hash equals the backup hash → byte-identical restore.

## 4. S6 gate inventory (local vs real-database)

For each S6 element, whether it is completable locally and its current
status. Every real-database item is marked `[NOT VERIFIED]`; none is
described as done.

| S6 element | Local-completable? | Current status |
|---|---|---|
| Full synthetic test suite (`scripts/dev-test.ps1`) | YES — local, no DB needed | [VERIFIED] this round: `133 passed, 28 skipped`, 0 failed (see section 5; was 132 before adding the new test) |
| No-external-call verification, local leg | YES — this round's new ungated test, in-memory fixture, no DB | [VERIFIED] guard proven live by an observed failure on an injected non-loopback attempt (section 3); limitation: records `connect`/`create_connection` only, not pure DNS (`getaddrinfo`) or C-level (libpq) traffic |
| No-external-call verification, real-database leg (the gated `test_no_external_network_calls` in `test_s6_integration.py`, rewritten 2026-08-03) | NO — gated on `CRM_RUN_POSTGRESQL_TESTS=1`, needs `crm_test` | [NOT VERIFIED] — needs real PostgreSQL + transport authorization; has never executed in any environment (module-level skip at `test_s6_integration.py:24-27`) |
| Restart persistence (process restart keeps data and deterministic history order) | NO — requires a real database and starting/stopping real uvicorn processes | [NOT VERIFIED] — requires real PostgreSQL + uvicorn start/stop + transport authorization; prohibited this round by the handoff's boundary list |
| `repositories.py:322-385` double-write (activity row + v1 revision in one transaction) | NO — the real `FollowUpActivityRepository` requires a database session | [NOT VERIFIED] — no test constructs any real repository (grep of `tests/` for `FollowUpActivityRepository(`/`InstitutionRepository(`/`ContactRepository(` → 0 hits, only `Memory*` variants); the code was inspected at `src/crm/persistence/repositories.py:322-385` and writes model + revision in one `SessionLocal` block, but that is static inspection, not runtime proof |

## 5. COMMANDS_RUN (exact, this round)

1. Baseline before changes: `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` → `132 passed, 28 skipped`, 0 failed.
2. New test, first run: `.venv\Scripts\python.exe -m pytest tests/test_s6_local_no_external_calls.py -q` → `1 passed`.
3. Experiment (injected `192.0.2.1` attempt in request path): same command → `1 failed` with `Unexpected non-loopback socket attempts: ["('192.0.2.1', 443)", "('192.0.2.1', 443)"]`.
4. Probe run (temp file, not in repo): single POST → `status: 201`, `create calls: 1` — confirms the double record is the two guard layers catching one attempt.
5. Restore + residue check: backup hash `D3AA4ADC0AB00948DE34043806FEAD22E723C69BCC8B5217C96F4E8557ACD63E`; restored file identical; experiment markers → 0 hits.
6. Restored pass: `.venv\Scripts\python.exe -m pytest tests/test_s6_local_no_external_calls.py -q` → `1 passed`.
7. Full suite: `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` → `133 passed, 28 skipped`, 0 failed (below).
8. Governance: `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` → `[PASS]` (below).

## 6. TEST_TOTALS

- Full local suite (no PostgreSQL gates): **133 passed, 28 skipped, 0 failed,
  0 error** (132 before this round's single new test; no previously passing
  test changed).
- New test alone: 1/1 passed (and observed 1/1 failed under the injected
  leak before restore).

## 7. NOT VERIFIED (reasons + remaining checks)

1. The gated `test_no_external_network_calls` (real-database leg) — needs
   `crm_test` + transport authorization; never executed anywhere. The local
   ungated test does not substitute for it; it mirrors the same guard with
   in-memory state.
2. Restart persistence — needs real PostgreSQL + uvicorn start/stop; not
   authorized this round.
3. `repositories.py:322-385` double-write — static inspection only; no test
   constructs the real repository.
4. W4 formal acceptance; G5 migration authorization; release/nginx/TLS/DNS;
   legacy cutover — unchanged, unauthorized.
5. Human business/visual acceptance — never inferred from automated tests.

## 8. Boundary compliance

- No access to `crm_test` or any database; no SSH; no network connection
  made by the repo or its tests (the experiment used TEST-NET `192.0.2.1`
  with a 10 ms timeout that cannot complete, and was removed).
- No uvicorn process started/stopped; no commits; no dependency changes.
- Files changed: `tests/test_s6_local_no_external_calls.py` (new, owned
  path), this evidence file (`docs/evidence/TASK-0001-*`, owned path).
  No other file touched; no refactoring.
- No real-database authorization requested in this report; the coordinator
  will assemble the section-4 inventory into a single owner request.

## 9. Completion report (AGENTS.md §9)

1. **Status**: PASSED (local leg only) — the new ungated guard test passes,
   was proven live by an observed failure on an injected non-loopback
   attempt, and was restored with zero residue. S6 as a whole remains
   PARTIAL because its real-database legs are [NOT VERIFIED].
2. **Scope**: one new local ungated no-external-call test
   (`tests/test_s6_local_no_external_calls.py`) and this evidence file.
   No application code changed; the gated S6 test untouched.
3. **Evidence**: commands 1-8 in section 5, with outputs recorded in
   sections 3.2, 3.3 and 6.
4. **Not verified**: section 7 — the three real-database S6 elements.
5. **Decisions needed**: a single transport/database authorization for the
   S6 real-database legs (inventory in section 4), to be assembled by the
   coordinator; not requested here.
