# TASK-5A verification evidence (bounded executor, steps 1-4)

- Task: TASK-5A (`docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`)
- Binding contract: `docs/handoffs/HANDOFF-20260802-KIMI-TASK-5A-VERIFICATION.md`
- Authorization: `DEC-0068` (2026-08-02)
- Execution date: 2026-08-02
- Outcome: **PARTIAL — fail-closed STOP at step 1 preflight (TCP reachability).
  Steps 2-4 were never executed. `crm_test` was never created. No database
  connection of any kind was opened. No production object was touched.**

## 1. Preflight results (card step 1)

### 1.1 Settings env-var field names — PASS (cited from `src/crm/config.py`, lines 20-26)

Verified, not assumed. `Settings(BaseSettings)` with
`SettingsConfigDict(case_sensitive=False, extra="ignore", frozen=True)` declares:

- `database_host: str` (required, blank rejected);
- `database_port: int = Field(default=5432, ge=1, le=65535)`;
- `database_name: str` (required, blank rejected);
- `database_user: str` (required, blank rejected);
- `database_password: SecretStr` (required, blank rejected);
- also present: `database_sslmode: Literal["disable","prefer","require"] = "prefer"`,
  `crm_environment = "development"`, `ai_enabled: bool = False`.

Environment variable names are the uppercase field names: `DATABASE_HOST`,
`DATABASE_PORT` (default 5432 when unset), `DATABASE_NAME`, `DATABASE_USER`,
`DATABASE_PASSWORD`. `database_url` (lines 51-61) builds
`postgresql+psycopg://` from these fields; `migrations/env.py`
(`run_migrations_online`, lines 31-44) builds its engine from the same
`Settings()`, so `alembic upgrade head` honours env overrides — this matched
the planned (never executed) step-3 mechanism.

### 1.2 `deploy/.env` credential material — PASS (key names only)

`deploy/.env` exists (133 bytes, 2026-07-30) and contains exactly these keys
(values never printed, logged, or stored): `DATABASE_HOST`, `DATABASE_NAME`,
`DATABASE_USER`, `DATABASE_PASSWORD`. No `DATABASE_PORT` key; the `Settings`
default 5432 applies. No `DATABASE_SSLMODE` key; the default `prefer` would
have applied.

### 1.3 TCP reachability of the server PostgreSQL port — **FAIL**

Probe: host = the `DATABASE_HOST` value from `deploy/.env`, port 5432, plain
TCP connect with 8 s timeout, no authentication attempt. Result:
`ConnectionRefusedError` (actively refused, not a timeout).

Diagnostic classification (booleans only; the only value-level fact disclosed
is the loopback nature, which carries no routing information about the
production server): the `DATABASE_HOST` value is the loopback name
`localhost` — the on-server view used by the deployed application, which runs
on the same host as the database (`deploy/.env` is that app's runtime
configuration). Probed from this machine, `localhost` resolves to this
machine itself, where no PostgreSQL listens — consistent with the TASK-0007
preflight finding of no local PostgreSQL
(`docs/evidence/TASK-0007-preflight.md` section 2, cited via
`docs/evidence/TASK-0007-verification.md` section 3).

**Exact missing condition:** no routable production-server address exists in
the authorized local credential material. `deploy/.env`'s `DATABASE_HOST`
(`localhost`) is only meaningful on the server itself; from this machine the
server PostgreSQL port is unreachable, and the boundaries prohibit
discovering or substituting any other address (no SSH/host access; the
credential source is `deploy/.env` only; "do not improvise alternatives
outside these boundaries" — task card, Boundaries).

### 1.4 Preflight verdict

Item 1.3 failed → fail-closed STOP per handoff section 3 item 1 and the task
card Boundaries ("If the server is unreachable ... STOP and report the exact
missing condition"). Steps 2 (create `crm_test`), 3 (Alembic migrations),
and 4 (gated tests) were NOT executed. No correction pass is applicable:
the missing element is a routable server address, which is not an
environment/mechanics adjustment available to the executor within the
`DEC-0065` correction budget — supplying one would require either new
credential material from the product owner or server-side access, both
outside the executor's boundaries.

## 2. Files inspected (read-only, Read tool)

- `AGENTS.md`; `docs/decisions/DECISION-LOG.md` (DEC-0065, DEC-0066,
  DEC-0067 point 5, DEC-0068 in full);
- `docs/handoffs/HANDOFF-20260802-KIMI-TASK-5A-VERIFICATION.md`;
- `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`;
- `docs/evidence/TASK-0007-verification.md` section 3;
  `docs/evidence/TASK-0007-KIMI-ACCEPTANCE.md` section 6;
- `src/crm/config.py`; `migrations/env.py`; `alembic.ini` (first 30 lines,
  via grep/head);
- grep-only inspection of `tests/test_task0007_postgresql_sessions.py` and
  `tests/test_s4_authentication.py` confirming the
  `CRM_RUN_POSTGRESQL_TESTS=1` skip gates (lines 19-20 and 514-515
  respectively). No file was edited.

## 3. Result block

- `EXECUTOR_RUNTIME_ID`: `5f121e6f-b747-4f1e-8162-dd0214cef1d2/k3-256k`
  (runtime-exposed model identifier, recorded verbatim; agent: ZCode
  subagent; recorded per DEC-0066 discipline, never a gate).
- `COMMANDS_RUN` (verbatim; credential values never appeared in any command —
  env was sourced from `deploy/.env` and read inside Python via
  `os.environ`; nothing was echoed; `<redacted>` therefore never needed):
  1. `grep -n "DEC-006[5-8]" docs/decisions/DECISION-LOG.md` — PASS
     (located DEC-0065..DEC-0068 at lines 2527/2581/2664/2743);
  2. `grep -n "^## \|^### \|^##" docs/evidence/TASK-0007-verification.md` —
     PASS (section 3 at line 66);
  3. `ls -la deploy/ && grep -oE '^[A-Z_]+=' deploy/.env` — PASS (keys
     `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`;
     names only);
  4. `ls` filters for `alembic.ini` / venv executables / `tests/` — PASS
     (`alembic.ini` present; `.venv/Scripts/python.exe`, `alembic.exe`,
     `pytest.exe` present; both gated test files present);
  5. `head -30 alembic.ini`; `grep -n ... tests/test_task0007_postgresql_sessions.py`;
     `grep -n ... tests/test_s4_authentication.py` — PASS
     (`script_location = migrations`; skip gates confirmed);
  6. `set -a; . deploy/.env; set +a; .venv/Scripts/python.exe -c "<TCP probe:
      socket connect to os.environ['DATABASE_HOST'] port 5432, timeout 8 s>"`
     — **FAIL** (`TCP_PROBE_RESULT: UNREACHABLE ConnectionRefusedError`);
  7. `set -a; . deploy/.env; set +a; .venv/Scripts/python.exe -c "<host
      classification: loopback-literal? localhost-name? DNS classification>"`
     — diagnostic output `HOST_IS_LOOPBACK_LITERAL: False`,
     `HOST_IS_LOCALHOST_NAME: True`.
- `TEST_TOTALS`: none — no pytest run was executed (preflight fail-closed
  stop before steps 2-4). `tests/test_task0007_postgresql_sessions.py`: 0
  run (5 gated tests unexecuted); `tests/test_s4_authentication.py`: 0 run
  (1 gated test plus the file's non-gated tests unexecuted in this context).
- `CURRENT_DATABASE_PROOF`: not applicable — no database connection was ever
  opened and no write was attempted, so no `current_database()` check was
  required or performed. `crm_test` does not exist on the server (it was
  never created); the coordinator's step-2 run remains the first creation
  attempt.
- `NOT_VERIFIED` (everything downstream of the failed probe; exact remaining
  checks):
  1. Step 2 — creation of empty `crm_test` on the production PostgreSQL
     server: NOT VERIFIED, blocked by unreachable server port (section 1.3).
     Remaining check: from a context where the server PostgreSQL port is
     reachable, `CREATE DATABASE crm_test` (fail-closed on "already exists")
     with only `SELECT current_database()` checks while connected to any
     other database.
  2. Step 3 — Alembic `upgrade head` against `crm_test` only
     (`DATABASE_NAME=crm_test`, other `DATABASE_*` from `deploy/.env`,
     `current_database() = crm_test` verified on the connection first):
     NOT VERIFIED, same blocker.
  3. Step 4a — `CRM_RUN_POSTGRESQL_TESTS=1 DATABASE_NAME=crm_test ...`
     `.venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`
     (5 gated tests): NOT VERIFIED, same blocker.
  4. Step 4b — same gate against
     `tests/test_s4_authentication.py -q` (1 gated test,
     `TestSecurityAuditLogging::test_session_epoch_during_production_use`):
     NOT VERIFIED, same blocker.
  5. `tests/test_migrations.py` gated round-trip: out of TASK-5A scope by
     the task card; remains NOT VERIFIED for a separately authorized gate.
- `BLOCKERS`: exactly one — the production PostgreSQL server port is not
  reachable from this machine because the only authorized credential material
  (`deploy/.env`) addresses the database as `localhost` (the server's own
  loopback view). Unblock requires a product-owner decision, e.g.:
  (a) supply a routable server address as authorized credential material
      (requires the PostgreSQL port to be reachable from this machine —
      firewall/listen configuration is a server-side change outside executor
      authority); or
  (b) authorize execution of steps 2-4 on the server itself by an
      appropriately authorized operator/tool (SSH/host access is outside
      this executor's boundaries); or
  (c) authorize a local isolated PostgreSQL instance (the previously
      recommended Option A in `docs/evidence/TASK-0007-KIMI-ACCEPTANCE.md`
      section 7, superseded by DEC-0068's selection of the server option).

## 4. Boundary compliance statement

- No credential value was printed, logged, committed, or stored — every
  command sourced `deploy/.env` into the environment and consumed values
  inside the process; only key names and loopback/private booleans were
  emitted.
- No statement of any kind was executed against any database; no production
  table was read or written; `crm_test` was not created, dropped, or reused.
- No application source, test, configuration, migration, or deployment file
  was edited; no git operations; no dependency installation; no SSH/host
  access; no nginx/TLS/DNS changes; no paid services.
- One execution pass used; no correction pass consumed (none is applicable
  within executor boundaries — see section 1.4). Outcome: PARTIAL /
  ESCALATED for a product-owner decision per DEC-0068 point 4.

## Attempt 2 (route: SSH transport per `DEC-0069`)

- Binding contract: `docs/handoffs/HANDOFF-20260802-TASK-5A-SSH-ATTEMPT2.md`
- Authorization: `DEC-0068` (the database actions) + `DEC-0069` (the SSH
  transport that carries them)
- Execution date: 2026-08-02
- Scope executed: steps A1-A4 (A5 belongs to the coordinator and was not
  attempted)
- Attempt 1 above is unmodified factual history.
- Outcome: **PARTIAL / ESCALATED — fail-closed STOP at step A3 on stop condition
  (d): the `DATABASE_PASSWORD` in `deploy/.env` is rejected by PostgreSQL for
  role `anqiao_crm_app` over the forwarded loopback connection. Unlike attempt 1,
  SSH authentication succeeded and `crm_test` WAS created empty (step A2
  complete). No Alembic migration was applied, and no gated test ran. No
  production real table was read or written.**

### A2.1 Step results

| Step | Result |
|---|---|
| A1 preflight | PASS — non-interactive SSH authentication succeeded; `deploy/.env` key names and `Settings` env-var names confirmed from files |
| A2 create `crm_test` | PASS — confirmed absent first (`count = 0`), then created empty with owner `anqiao_crm_app`; creation confirmed by a read-only catalog query |
| A3 forward + migrate | FAILED — the SSH local forward opened and the read-only isolation proof passed, but the application role's password from `deploy/.env` was rejected; Alembic was never invoked |
| A4 gated tests | BLOCKED — not executed, because A3 did not pass |

### A2.2 Result block

- `EXECUTOR_RUNTIME_ID`:
  `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5` (runtime-exposed model
  identifier, recorded verbatim; agent: ZCode subagent (executor). Recorded per
  `DEC-0066`; never a gate.)

- `COMMANDS_RUN` (verbatim, in execution order; no credential value appeared in
  any command line or any output — `deploy/.env` was sourced/parsed into the
  process environment and consumed inside the process, so `<redacted>` was never
  needed. Local forward port chosen: **55432** — 127.0.0.1:55432 to the server's
  127.0.0.1:5432.):

  1. `which ssh && ssh -V 2>&1 && grep -c "124.222.212.159" ~/.ssh/known_hosts`
     — PASS (OpenSSH_10.2p1; 3 matching `known_hosts` entries).
  2. `grep -oE '^[A-Z_]+=' deploy/.env && echo "---PY---" && .venv/Scripts/python.exe --version && echo "---ALEMBIC---" && grep -n "script_location" alembic.ini && echo "---GATES---" && sed -n '15,22p' tests/test_task0007_postgresql_sessions.py && echo "---" && sed -n '510,520p' tests/test_s4_authentication.py`
     — PASS (four keys, names only: `DATABASE_HOST`, `DATABASE_NAME`,
     `DATABASE_USER`, `DATABASE_PASSWORD`; Python 3.12.8;
     `script_location = migrations`; both `CRM_RUN_POSTGRESQL_TESTS != "1"` skip
     gates confirmed at the cited lines).
  3. `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15 ubuntu@124.222.212.159 "echo SSH_AUTH_OK; whoami; hostname"`
     — **PASS** (`SSH_AUTH_OK` / `ubuntu` / `VM-0-17-ubuntu`, exit 0). Stop
     condition (c) did not fire.
  4. `set -a && . deploy/.env && set +a && .venv/Scripts/python.exe -c "<boolean classification of the four values; no value printed>"`
     — PASS (`DATABASE_USER_MATCHES_anqiao_crm_app: True`,
     `DATABASE_HOST_IS_LOCALHOST: True`, `DATABASE_NAME_IS_anqiao_crm: True`,
     `DATABASE_PASSWORD_PRESENT: True`).
  5. `ssh <same flags> ubuntu@124.222.212.159 "sudo -u postgres psql -d postgres -tAc \"SELECT count(*) FROM pg_database WHERE datname='crm_test';\""`
     — PASS, result `0`. Stop condition (b) did not fire.
  6. `ls migrations/versions/ && grep -rn "schema" migrations/versions/ | head -30 && grep -rn "schema\|MetaData" src/crm/persistence/__init__.py src/crm/persistence/*.py | ... | head -20`
     — read-only inspection (single revision `0001_initial_schema`; `Base.metadata`
     carries a naming convention and no explicit schema, so the migration targets
     the connection's default search path).
  7. `ssh <same flags> ubuntu@124.222.212.159 "sudo -u postgres psql -d postgres -c \"CREATE DATABASE crm_test OWNER anqiao_crm_app;\""`
     — **PASS** (`CREATE DATABASE`, exit 0). The single authorized write executed
     while connected to another database, per the task card's non-goals clause.
  8. `ssh <same flags> ubuntu@124.222.212.159 "sudo -u postgres psql -d postgres -tAc \"SELECT datname, pg_get_userbyid(datdba) FROM pg_database WHERE datname='crm_test';\""`
     — PASS, result `crm_test|anqiao_crm_app` (read-only creation confirmation).
  9. `.venv/Scripts/python.exe -c "<bind-probe ports 55432-55435 on 127.0.0.1>"`
     — PASS (all four free; **55432** selected).
  10. `ssh -N -o StrictHostKeyChecking=no -o BatchMode=yes -o ExitOnForwardFailure=yes -L 55432:127.0.0.1:5432 ubuntu@124.222.212.159`
      — PASS (background; forward established, no error on
      `ExitOnForwardFailure`; explicitly terminated at the end of the attempt).
  11. `set -a && . deploy/.env && set +a && export DATABASE_HOST=127.0.0.1 DATABASE_PORT=55432 DATABASE_NAME=crm_test && .venv/Scripts/python.exe -c "<Settings() + SELECT current_database()>"`
      — resolved config echoed without secrets
      (`CFG_NAME: crm_test HOST: 127.0.0.1 PORT: 55432 SSLMODE: prefer USER: anqiao_crm_app`),
      then **FAILED** at connect: `CONNECT_FAILED: OperationalError`,
      `AUTH_REJECTED: True`.
  12. `set -a && . deploy/.env && set +a && export DATABASE_HOST=127.0.0.1 DATABASE_PORT=55432 DATABASE_NAME=crm_test && .venv/Scripts/python.exe -c "<boolean failure-mode classification; asserts the password does not appear in the error text>"`
      — diagnostic: `IS_PASSWORD_AUTH_FAILED: True`,
      `IS_NO_PG_HBA_ENTRY: False`, `IS_DB_DOES_NOT_EXIST: False`,
      `IS_SSL_ISSUE: False`, `IS_CONNECTION_REFUSED: False`,
      `IS_ROLE_NOT_PERMITTED: False`. The forward and `pg_hba` path are fine; the
      credential itself is rejected.
  13. `.venv/Scripts/python.exe -c "<byte-level inspection of deploy/.env for shell-sensitive characters; booleans only>"`
      — `FILE_HAS_CRLF: True`, `PW_HAS_TRAILING_CR: False`, and False for
      `$`, `\`, backtick, space, `"`, `'`, `!`; `PW_LEN_NONZERO: True`.
  14. `.venv/Scripts/python.exe -c "<per-line CRLF layout of deploy/.env; key names only>"`
      — every one of the four lines reports `ENDS_WITH_CR: True`.
  15. **Consolidated correction pass** (`DEC-0065`; environment/mechanics only —
      it removed the CRLF artifact rather than substituting any credential):
      `.venv/Scripts/python.exe -c "<parse deploy/.env with utf-8-sig, strip() each key and value instead of shell-sourcing, then Settings() + SELECT current_database()>"`
      — **FAILED** identically: `CONNECT_FAILED: OperationalError`,
      `IS_PASSWORD_AUTH_FAILED: True`. CRLF/shell-quoting is therefore excluded as
      the cause.
  16. `ssh <same flags> ubuntu@124.222.212.159 "sudo -u postgres psql -d postgres -tAc \"SELECT rolname, rolcanlogin, (rolpassword IS NOT NULL) AS has_password FROM pg_authid WHERE rolname='anqiao_crm_app';\" && echo '--- crm_test isolation ---' && sudo -u postgres psql -d crm_test -tAc \"SELECT current_database(); SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');\""`
      — PASS (read-only): `anqiao_crm_app|t|t` (the role exists, may log in, and
      has a stored password — so the rejection is a value mismatch, not a missing
      role), then `crm_test` and `0`.
  17. Background forward from command 10 explicitly stopped (confirmed killed).

- `CURRENT_DATABASE_PROOF`: **`crm_test`** — observed twice, both times before
  any write to `crm_test`, and no write to `crm_test` ever followed:
  1. Command 16, over SSH via `sudo -u postgres psql -d crm_test`:
     `SELECT current_database()` returned `crm_test`, and the non-system table
     count in that database was `0` (empty, freshly created, isolated). This is a
     `DEC-0069` point 3(c) read-only isolation check.
  2. Position in the sequence: after creation (command 7) and after the failed
     application-role connection attempts (commands 11-15), and before any
     migration or test — Alembic was never invoked, so no write to `crm_test`
     occurred at all.
  - Through the forwarded connection as the application role, the
    `SELECT current_database()` statement was issued but never reached execution:
    the connection failed during authentication (command 11). So the proof for the
    exact connection that a migration would have used is **NOT VERIFIED**; see
    `NOT_VERIFIED` item 1.

- `TEST_TOTALS`: **no pytest run was executed.** Step A4 was blocked by the A3
  failure, so running the tests would only have produced a misleading
  credential error rather than a verification result.
  - `tests/test_task0007_postgresql_sessions.py`: 0 passed / 0 failed /
    0 skipped — not invoked (5 gated tests unexecuted). Wall time: n/a.
  - `tests/test_s4_authentication.py`: 0 passed / 0 failed / 0 skipped — not
    invoked (1 gated test,
    `TestSecurityAuditLogging::test_session_epoch_during_production_use`,
    unexecuted). Wall time: n/a.
  - The exact invocations that remain to be run, once a working credential
    exists, with the forward on 127.0.0.1:55432 open:
    `CRM_RUN_POSTGRESQL_TESTS=1 DATABASE_HOST=127.0.0.1 DATABASE_PORT=55432 DATABASE_NAME=crm_test DATABASE_USER=<from deploy/.env> DATABASE_PASSWORD=<redacted> .venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`
    and the same environment with
    `.venv/Scripts/python.exe -m pytest tests/test_s4_authentication.py -q`.
  - No skip was observed, because no test was collected. Nothing here may be read
    as a pass.

- `NOT_VERIFIED` (each with the exact remaining check):
  1. `SELECT current_database()` on a connection opened by the application role
     through the forward: NOT VERIFIED — authentication failed first. Remaining
     check: with a valid `anqiao_crm_app` password and the forward open, connect
     via `Settings()` and confirm the statement returns `crm_test` before any
     write.
  2. Alembic `upgrade head` against `crm_test`: NOT VERIFIED — never invoked.
     Remaining check: `DATABASE_NAME=crm_test` plus the forward host/port, then
     `.venv/Scripts/python.exe -m alembic upgrade head`, and confirm the reported
     head is revision `0001_initial_schema`.
  3. The 5 gated tests in `tests/test_task0007_postgresql_sessions.py`: NOT
     VERIFIED — same blocker. Remaining check: the first pytest invocation above.
  4. The 1 gated test in `tests/test_s4_authentication.py`: NOT VERIFIED — same
     blocker. Remaining check: the second pytest invocation above.
  5. Whether the `anqiao_crm_app` password recorded in
     `/opt/anqiao-crm/shared/database.env` would be accepted: NOT VERIFIED and
     **not checked** — reading that server-side secret is explicitly not
     authorized by `DEC-0069` point 6. The file was never opened.
  6. `tests/test_migrations.py`'s gated round-trip: out of TASK-5A scope per the
     task card; unchanged.

- `BLOCKERS`: exactly one, and it is fail-closed stop condition (d). The
  `DATABASE_PASSWORD` value in `deploy/.env` is rejected by PostgreSQL for role
  `anqiao_crm_app` (`IS_PASSWORD_AUTH_FAILED: True`), so no connection as the
  application role can be opened and neither the migration nor the tests can run.
  The precise missing condition is **a currently valid password for the
  `anqiao_crm_app` role, supplied as authorized credential material.** Supporting
  facts that narrow it to the credential value itself, all verified above:
  - SSH authentication succeeds (command 3), so the transport is sound;
  - the forward opened with `ExitOnForwardFailure=yes` and did not fail
    (command 10), and the failure mode is neither `connection refused` nor
    `no pg_hba.conf entry` (command 12), so the network path and host-based auth
    rules are sound;
  - the role exists, may log in, and has a stored password (command 16), so this
    is a value mismatch, not a missing or locked role;
  - CRLF and shell-quoting artifacts are excluded (commands 13-15), so the local
    file is being read faithfully;
  - `crm_test` exists, is empty, and is owned by `anqiao_crm_app` (commands 8 and
    16), so step A2's output is intact and reusable once a credential exists.
  This matches the anticipated cause exactly: GR1 rotated the credential
  server-side into `/opt/anqiao-crm/shared/database.env`
  (`docs/evidence/TASK-0001-GR1-w3-recovery.md:27-30`), so the local copy in
  `deploy/.env` is stale. Reading the rotated secret is not authorized, so the
  attempt ends here and returns to the product owner, per `DEC-0069` point 6.

- `BOUNDARY_COMPLIANCE`:
  - **Credentials**: no credential value was printed, echoed, logged, committed,
    or written into this or any other file. `deploy/.env` was sourced or parsed
    into the process environment and consumed inside the process; only key names,
    booleans, and failure-mode classifications were emitted. Command 12 asserts
    that the password does not appear in the error text before printing anything.
    The rotated server-side secret at `/opt/anqiao-crm/shared/database.env` was
    **not** read. `.env.test` was not used as a credential source.
  - **Databases touched**: `crm_test` only, as the target of the authorized
    `CREATE DATABASE` and of read-only checks. While connected to `postgres`, the
    only statements executed were the authorized `CREATE DATABASE crm_test` and
    read-only catalog queries against `pg_database` and `pg_authid`. No production
    real table was read or written; `anqiao_crm` was never connected to. `crm_test`
    was not dropped and is left in place for the coordinator's independent re-run,
    per `DEC-0068` point 6 / `DEC-0069` point 8.
  - **SSH-carried operations**: confined to the three that `DEC-0069` point 3
    permits — (a) creating the empty `crm_test` database, (b) one local port
    forward on 127.0.0.1:55432 to the server's 127.0.0.1:5432, closed at the end,
    and (c) read-only isolation checks. Nothing else was run over SSH.
  - **Files edited**: exactly two, both permitted — this evidence file (appended
    an "Attempt 2" section; attempt 1's content is unaltered) and the Attempt 2
    table's Status cells in
    `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`. No
    application source, test, configuration, or migration file was edited.
  - **Git / dependencies / services**: no git command of any kind was run (no add,
    commit, push, reset, clean, checkout, or stash). No dependency was installed
    locally or on the server. No service was started, stopped, restarted, or
    reconfigured. `postgresql.conf`, `pg_hba.conf`, systemd units, and firewall
    rules were untouched. No deployment, release, or nginx/TLS/DNS change. Nothing
    belonging to another project on that host was accessed.
  - **Correction budget** (`DEC-0065`): one execution pass plus one consolidated
    correction pass (command 15, environment/mechanics only) were used. The budget
    is exhausted, so the outcome is recorded as PARTIAL / ESCALATED and the
    executor stops rather than seeking a substitute credential.


## Attempt 3（route: 测试专用角色 crm_test_runner over SSH forward）

- Binding contract: this executor prompt (product-owner-issued as the TASK-5A
  Attempt 3 bounded subagent directive, 2026-08-02)
- Authorization: `DEC-0068` (the database actions) + `DEC-0069` (the SSH
  transport that carries them) + this prompt's explicit authorization to create
  a test-only role `crm_test_runner` to resolve stop condition (d)
- Execution date: 2026-08-02
- Scope executed: steps A3 and A4 (A1/A2 already passed in Attempt 2 and were
  not repeated; `crm_test` existed empty and was reused)
- Attempt 1 and Attempt 2 above are unmodified factual history.
- Outcome: **PARTIAL — A3 (migration) PASSED; A4 produced 5 of 6 gated tests
  PASSED and 1 FAILED. The single failure is a test-code cleanup-order defect in
  `tests/test_s4_authentication.py` (the `finally` block deletes
  `user_identities` while `audit_events` rows still reference it via
  `fk_audit_events_actor_user_id_user_identities`), not an environment or
  boundary issue and not a fail-closed stop condition. No production real table
  was read or written.**

### A3.1 Step results

| Step | Result |
|---|---|
| Preflight | PASS — `.gitignore` `*.env*` rule confirmed (`.env.crm_test_local` is gitignored); both skip gates confirmed at cited lines; `alembic.ini` `script_location = migrations` and single revision `0001_initial_schema`; SSH auth succeeded; `crm_test` exists empty (0 non-system tables, owner `anqiao_crm_app`); `crm_test_runner` did not pre-exist |
| Role creation | PASS — `crm_test_runner` created with LOGIN + password; `GRANT ALL PRIVILEGES ON DATABASE crm_test` applied; later `GRANT USAGE, CREATE ON SCHEMA public` + default-privileges grant applied after the first migration attempt was denied for lack of CREATE on `public` |
| A3 migrate | PASS — `alembic upgrade head` ran `-> 0001_initial_schema`; `current_database()` = `crm_test`; `alembic_version.version_num` = `0001_initial_schema`; 10 non-system tables (9 business + `alembic_version`) |
| A4 session tests | PASS — 5/5 passed |
| A4 auth test | FAILED — 0/1 passed (cleanup-block ForeignKeyViolation, reproducible) |

### A3.2 Result block

- `EXECUTOR_RUNTIME_ID`: `96183061-777e-4cb4-998a-fd38d960838e/xopglm52`
  (runtime-exposed model identifier, recorded verbatim; agent: ZCode bounded
  subagent. Recorded per `DEC-0066`; never a gate.)

- `COMMANDS_RUN` (verbatim, in execution order; no credential value appeared in
  any command line or any output — `.env.crm_test_local` was sourced into the
  process environment and consumed inside the process, and the role password was
  piped to remote `psql` via SSH stdin, so `<redacted>` was never needed in a
  command line. Local forward port: **55432** — 127.0.0.1:55432 to the server's
  127.0.0.1:5432.):

  1. `grep -n "env" .gitignore` — PASS (rules `.env`, `.env.*`, `!.env.example`).
  2. `sed -n '15,22p' tests/test_task0007_postgresql_sessions.py && echo "---S4---" && sed -n '510,520p' tests/test_s4_authentication.py`
     — PASS (both `CRM_RUN_POSTGRESQL_TESTS != "1"` skip gates confirmed).
  3. `grep -n "script_location" alembic.ini && ls migrations/versions/` — PASS
     (`script_location = migrations`; single revision `0001_initial_schema.py`).
  4. `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15 ubuntu@124.222.212.159 "echo SSH_AUTH_OK; whoami; hostname; ... <read-only pg checks>"`
     — PASS (`SSH_AUTH_OK` / `ubuntu` / `VM-0-17-ubuntu`;
     `listen_addresses=localhost`; `crm_test|anqiao_crm_app`;
     `current_database()=crm_test` / `0` non-system tables; `crm_test_runner`
     absent). Stop conditions (b) and (c) did not fire.
  5. `.venv/Scripts/python.exe -c "<generate secrets.token_hex(32); write .env.crm_test_local>"`
     — PASS (`FILE_WRITTEN_LEN 64`; password never printed).
  6. `ls -la .env.crm_test_local && git check-ignore .env.crm_test_local && grep -oE '^[A-Z_]+=' .env.crm_test_local`
     — PASS (file exists; gitignored; five key names only).
  7. `.venv/Scripts/python.exe -c "<read pw from .env.crm_test_local; build CREATE ROLE ... PASSWORD '<redacted>'; pipe SQL to ssh ... 'sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1' via stdin>"`
     — PASS (`CREATE ROLE` / `GRANT`; stderr empty; password never on command
     line; the Python wrapper asserted the password does not appear in stderr
     before printing).
  8. `ssh <same flags> ubuntu@124.222.212.159 "sudo -u postgres psql -d postgres -tAc \"SELECT rolname, rolcanlogin, (rolpassword IS NOT NULL) AS has_pw FROM pg_authid WHERE rolname='crm_test_runner';\""`
     — PASS (`crm_test_runner|t|t`; read-only, no password printed).
  9. `.venv/Scripts/python.exe -c "<find free port among 55432-55436>"` — PASS
     (55432 free).
  10. `ssh -N -o StrictHostKeyChecking=no -o BatchMode=yes -o ExitOnForwardFailure=yes -L 55432:127.0.0.1:5432 ubuntu@124.222.212.159`
      — PASS (background; forward established).
  11. `set -a && . .env.crm_test_local && set +a && .venv/Scripts/python.exe -c "<Settings() + SELECT current_database()>"`
      — PASS (`CFG_NAME: crm_test HOST: 127.0.0.1 PORT: 55432 USER: crm_test_runner SSLMODE: prefer`; `CURRENT_DATABASE: crm_test`). Fail-closed condition (a) did not fire.
  12. `set -a && . .env.crm_test_local && set +a && .venv/Scripts/python.exe -m alembic upgrade head`
      — **FAILED** first attempt: `psycopg.errors.InsufficientPrivilege:
      permission denied for schema public` on `CREATE TABLE alembic_version`.
      `GRANT ALL PRIVILEGES ON DATABASE` does not convey CREATE on the `public`
      schema under this PostgreSQL version.
  13. `ssh <same flags> ubuntu@124.222.212.159 "sudo -u postgres psql -d crm_test -v ON_ERROR_STOP=1 -c \"GRANT USAGE, CREATE ON SCHEMA public TO crm_test_runner; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_test_runner;\""`
      — PASS (`GRANT` / `ALTER DEFAULT PRIVILEGES`). This grants access to
      `crm_test` only, within the scope of `DEC-0069` point 3(a)'s "对 crm_test
      的权限".
  14. `set -a && . .env.crm_test_local && set +a && .venv/Scripts/python.exe -m alembic upgrade head`
      — **PASS** (`Running upgrade -> 0001_initial_schema, Create the authorized
      identity and manual CRM fact schema.`).
  15. `set -a && . .env.crm_test_local && set +a && .venv/Scripts/python.exe -c "<Settings(); SELECT current_database(); SELECT version_num FROM alembic_version; SELECT count(*) FROM pg_tables ...>"`
      — PASS (`CURRENT_DATABASE: crm_test`; `ALEMBIC_HEAD: 0001_initial_schema`;
      `NON_SYSTEM_TABLES: 10`).
  16. `set -a && . .env.crm_test_local && set +a && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`
      — **PASS**: `5 passed in 14.02s`.
  17. `set -a && . .env.crm_test_local && set +a && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest "tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use" -q`
      — **FAILED**: `1 failed in 10.18s`. `ForeignKeyViolation`: the test's
      `finally` cleanup block (line 656) executes
      `DELETE FROM user_identities` while `audit_events` rows still reference the
      user via `fk_audit_events_actor_user_id_user_identities`. All test-body
      assertions passed; the failure is in cleanup only.
  18. Repeat of command 17 (reproducibility check; new random username
      `integ_test_f89f7bc0`) — **FAILED** identically: `1 failed in 10.36s`,
      same `ForeignKeyViolation` at the same cleanup line.
  19. Repeat of command 16 (session tests re-confirm) — **PASS**:
      `5 passed in 14.21s`.
  20. Background forward from command 10 explicitly stopped (confirmed killed).

- `TEST_ROLE_CREATED`: `crm_test_runner` — created via SSH `sudo -u postgres
  psql` (command 7), confirmed by read-only `pg_authid` query (command 8:
  `rolcanlogin=t`, `has_pw=t`). Password generated locally with
  `secrets.token_hex(32)`, stored only in `.env.crm_test_local` (gitignored),
  never printed, logged, committed, or stored in any evidence file.

- `CURRENT_DATABASE_PROOF`: **`crm_test`** — observed through the forwarded
  connection as `crm_test_runner` before any write (command 11), and again after
  the migration (command 15). Both times before/around the migration write, both
  returned `crm_test`. Fail-closed condition (a) did not fire. The migration
  (commands 12/14) ran only after command 11's proof returned `crm_test`.

- `MIGRATION_HEAD`: `0001_initial_schema` — `alembic upgrade head` reported
  `Running upgrade -> 0001_initial_schema` (command 14), and
  `alembic_version.version_num` = `0001_initial_schema` was confirmed by direct
  query (command 15).

- `TEST_TOTALS`:
  - `tests/test_task0007_postgresql_sessions.py`: **5 passed / 0 failed / 0
    skipped**, 14.02s (command 16; re-confirmed at 14.21s in command 19).
    Full invocation:
    `set -a && . .env.crm_test_local && set +a && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`
  - `tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use`:
    **0 passed / 1 failed / 0 skipped**, 10.18s (command 17; reproduced at
    10.36s in command 18). Full invocation:
    `set -a && . .env.crm_test_local && set +a && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest "tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use" -q`
  - Aggregate: **5 passed / 1 failed / 0 skipped** out of 6 gated tests. The
    success criterion ("6个测试全部 PASSED，不是 skipped，不是 error") is **NOT
    met**.

- `NOT_VERIFIED`:
  1. The failing test's body assertions all passed, but pytest reports the test
     as FAILED because the `finally` cleanup block raises
     `ForeignKeyViolation`. Whether the product owner / coordinator treats the
     body-pass-with-cleanup-failure as a pass for TASK-0007 gate purposes is a
     decision for the coordinator, not this executor.
  2. The root cause is a test-code cleanup-order defect
     (`tests/test_s4_authentication.py:655-657` deletes `user_identities`
     before the `audit_events` rows that reference it). Editing the test file is
     outside this executor's boundary ("编辑任何...测试文件" is prohibited), so
     it is reported, not fixed.
  3. The coordinator's independent re-run (step A5) has not been performed.

- `BLOCKERS`: one — the gated test
  `test_session_epoch_during_production_use` fails in its `finally` cleanup
  block due to a foreign-key violation (`audit_events` → `user_identities`).
  This is a test-code defect, not an environment, credential, transport, or
  boundary issue, and not one of the four `DEC-0069` point 6 fail-closed stop
  conditions. The executor cannot edit the test file, so the failure stands as
  reported. The migration and all five session tests passed; only this one test
  fails, and only in cleanup.

- `BOUNDARY_COMPLIANCE`:
  - **Credentials**: no credential value was printed, echoed, logged, committed,
    or written into this or any other file. The `crm_test_runner` password was
    generated with `secrets.token_hex(32)`, written only to
    `.env.crm_test_local` (confirmed gitignored), piped to remote `psql` via
    SSH stdin (never on a command line), and consumed inside Python via
    `os.environ`. The Python wrapper asserted the password does not appear in
    stderr before printing any diagnostic. The stale `deploy/.env`
    `DATABASE_PASSWORD` and the rotated server-side secret at
    `/opt/anqiao-crm/shared/database.env` were **not** read. The new role's
    password was never stored in any evidence file, log, or command output.
  - **Databases touched**: `crm_test` only, as the target of the migration and
    tests. While connected to `postgres`, the only statements executed were the
    authorized `CREATE ROLE crm_test_runner`, `GRANT`s scoped to `crm_test`
    only, and read-only catalog queries against `pg_database`/`pg_authid`. No
    production real table was read or written; `anqiao_crm` was never connected
    to. `crm_test` was not dropped and is left in place (migrated, with test
    residue from the two failed cleanup attempts) per `DEC-0068` point 6 /
    `DEC-0069` point 8.
  - **SSH-carried operations**: confined to the three that `DEC-0069` point 3
    permits — (a) `CREATE ROLE`/`GRANT` on `crm_test` only (an extension of
    point 3(a)'s "对 crm_test 的权限" to a test-only role, as authorized by
    this prompt), (b) one local port forward on 127.0.0.1:55432 to the server's
    127.0.0.1:5432, closed at the end, and (c) read-only isolation/role checks.
    Nothing else was run over SSH.
  - **Files edited**: exactly two, both permitted — this evidence file (appended
    an "Attempt 3" section; attempts 1 and 2 are unaltered) and the Attempt 2/3
    Status cells in
    `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`. The new
    `.env.crm_test_local` is gitignored local credential material, not a source
    file, and is not committed. No application source, test, configuration, or
    migration file was edited.
  - **Git / dependencies / services**: no git command of any kind was run. No
    dependency was installed locally or on the server. No service was started,
    stopped, restarted, or reconfigured. `postgresql.conf`, `pg_hba.conf`,
    systemd units, and firewall rules were untouched. No deployment, release, or
    nginx/TLS/DNS change. Nothing belonging to another project on that host was
    accessed.
  - **Correction budget** (`DEC-0065`): one execution pass was used. The
    mid-run schema-CREATE grant (command 13) is an environment/privilege
    adjustment within the authorized "对 crm_test 的权限" scope, not a second
    correction pass against a failed test. The single test failure (command 17)
    was reproduced once (command 18) to confirm it is not transient; it is a
    test-code defect outside this executor's edit boundary, so no further
    correction pass is applicable. Outcome: PARTIAL.


## Attempt 3 — Correction pass: test cleanup-order + non-deterministic row-order defects fixed

After the Attempt 3 execution pass reported PARTIAL (5/6 PASSED, 1 FAILED),
the product owner instructed "找到失败的原因，解决" (find the failure cause,
solve it). This authorized the executor to edit the failing test file. Two
distinct defects were found and fixed; both are test-code bugs, not application
bugs. All diagnostics added during investigation were removed before the final
stability run.

### Defect 1: `finally` cleanup block deletes `user_identities` before `audit_events`

- **File**: `tests/test_s4_authentication.py`, `finally` block (lines ~648-661)
- **Root cause**: the cleanup deleted `server_sessions` then `user_identities`,
  but `audit_events.actor_user_id` has an `ondelete="RESTRICT"` FK to
  `user_identities.id`. The `audit_events` rows written by `authenticate` and
  `invalidate_session` were still present, so `DELETE FROM user_identities`
  raised `ForeignKeyViolation`. This was the original failure observed in
  Attempt 3's first execution pass.
- **Fix**: added `AuditEventModel` to the imports and inserted
  `sa.delete(AuditEventModel).where(AuditEventModel.actor_user_id == user.id)`
  before the `UserIdentityModel` delete, matching the cleanup pattern already
  used in `tests/test_task0007_postgresql_sessions.py` (lines 56-69).

### Defect 2: `db_session_rows()` query lacks `ORDER BY`, causing non-deterministic row order

- **File**: `tests/test_s4_authentication.py`, `db_session_rows()` helper (~line 562)
- **Root cause**: `SELECT ... WHERE session_token_hash IN (...)` was issued
  without `ORDER BY`. PostgreSQL does not guarantee row return order without an
  explicit `ORDER BY`. The test then indexed `rows[0]`, `rows[1]`, `rows[2]`
  assuming creation order, but PostgreSQL intermittently returned rows in a
  different order. When `rows[2]` landed on the session invalidated with
  `user_not_enabled` instead of the one invalidated with
  `session_epoch_mismatch`, the assertion
  `rows[2].invalidation_reason == "session_epoch_mismatch"` failed.
- **Evidence**: a diagnostic run captured the exact mismatch —
  `rows[0]=session_epoch_mismatch`, `rows[1]=logout`, `rows[2]=user_not_enabled`
  (wrong order). The third `validate_session` DIAG confirmed
  `status=enabled, epoch=2, record_epoch=1`, proving the application logic
  was correct and only the test's row-order assumption was wrong.
- **Fix**: added `.order_by(ServerSessionModel.created_at)` to the
  `db_session_rows()` select, guaranteeing rows are returned in creation order.

### Stability verification

After both fixes, 15 consecutive runs of all 6 gated tests (session tests first,
then the auth test) with full `crm_test` cleanup between each run:

```
RUN 1-15: all PASS
=== TOTAL: 15 pass, 0 fail ===
```

### Final TEST_TOTALS (post-fix)

- `tests/test_task0007_postgresql_sessions.py`: **5 passed / 0 failed / 0
  skipped** (14.02s typical)
- `tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use`:
  **1 passed / 0 failed / 0 skipped** (10.8s typical)
- Aggregate: **6 passed / 0 failed / 0 skipped** — success criterion met.
- Full invocation:
  `set -a && . .env.crm_test_local && set +a && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py "tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use" -q`

### Updated status

- **A3 (migration)**: PASSED (unchanged from Attempt 3 execution pass)
- **A4 (tests)**: PASSED — 6/6 gated tests pass, stable across 15 runs
- **Outcome**: PASS (pending coordinator independent re-run, step A5)

### Files edited in this correction pass

1. `tests/test_s4_authentication.py` — two fixes (cleanup order + ORDER BY);
   all diagnostic `print`/`import` statements added during investigation were
   removed.
2. `src/crm/web/auth.py` — temporary diagnostic `print` in `validate_session`
   added during investigation and removed; no behavioral change.
3. `docs/evidence/TASK-5A-verification.md` — this section appended.
4. `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` — Attempt 3
   Status cells updated.

No application source logic, migration, or configuration was changed. The two
test-code fixes address real test-quality defects (incomplete cleanup and
non-deterministic query ordering) that would have caused intermittent failures
in any PostgreSQL environment, not just this one.




