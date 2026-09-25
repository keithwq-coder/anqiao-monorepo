# TASK-5A: Isolated production-server PostgreSQL verification for TASK-0007 gated tests

- Task ID: TASK-5A
- Status: ACTIVE
- Task type: VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Also governed by: `SPEC-0001`, `SPEC-0012`, `DEC-0044`, `DEC-0065`,
  `DEC-0066`, `DEC-0067`, `DEC-0068`
- Implementation authorized by: Product owner, `DEC-0068` (2026-08-02) for the
  database actions; `DEC-0069` (2026-08-02) for the SSH transport that carries
  them
- Authorization evidence: `DEC-0068` (verbatim product-owner reply "1" to the
  coordinator's three-option question; directive
  "直接按照生产环境联通。所以应该新出一个提示词，作为task5A"); `DEC-0069`
  (verbatim product-owner reply "允许，可以" authorizing the SSH transport after
  "我不懂编程，我需要你编排任务")
- Execution route: revised 2026-08-02 under `DEC-0069`. Attempt 1 used
  `DEC-0068`'s direct database-port route and stopped fail-closed at preflight;
  that result stands as factual history in section "Evidence and result" and is
  not rewritten. Attempt 2 uses the project's established SSH transport.
- Owner tool: ZCode agent (GLM; one bounded subagent dispatched by the
  coordinator per `DEC-0068`)
- Owner model: UNKNOWN until executor self-report; recorded verbatim and never
  a gate per `DEC-0066`
- Ownership effective: 2026-08-02 upon `DEC-0068` authorization
- Audit started at: 2026-08-02
- Audit last updated: 2026-08-02 (activation under `DEC-0068`)
- Depends on: `TASK-0007` (steps 1-5 complete; independent review verdict
  PARTIAL 2026-08-02 — only the real-PostgreSQL legs unverified)

## Goal

Discharge the real-PostgreSQL legs of the TASK-0007 completion gate: run the
six `CRM_RUN_POSTGRESQL_TESTS=1`-gated tests against a newly created,
isolated, empty database named `crm_test` on the production PostgreSQL
server, proving on the real engine the durable hash-only session storage,
expiry/invalidation semantics, durable audit writes, role/scope loading,
session-epoch forced logout, and the two-instance restart proof — without
writing any production real table.

## Scope

- Owned actions:
  - preflight: confirm usable local credential material exists (key names
    only; never print values), confirm the exact `Settings` environment
    variable names from `src/crm/config.py`, and confirm SSH authentication to
    the deployment host succeeds; STOP and report PARTIAL if any fails;
  - create the empty `crm_test` database on the production PostgreSQL server
    over SSH (one-time write authorized by `DEC-0068`, transport by `DEC-0069`);
  - open an SSH local port forward to the server's loopback PostgreSQL endpoint
    so the repository's existing local test suite can reach `crm_test`
    (`DEC-0069` point 3(b));
  - apply the repository's own Alembic migrations to `crm_test` ONLY;
  - run `tests/test_task0007_postgresql_sessions.py` (5 tests) and the one
    gated test in `tests/test_s4_authentication.py` with
    `CRM_RUN_POSTGRESQL_TESTS=1` and `DATABASE_*` pointing at `crm_test`;
  - `docs/evidence/TASK-5A-*` and this task card.
- No application source or test file may be edited; the tests already exist
  and passed independent code review under TASK-0007.
- Explicit non-goals: writing any database other than `crm_test`; reading or
  writing production real tables (the only statement executed while
  connected to any other database on the server is the authorized
  `CREATE DATABASE crm_test`, plus read-only `current_database()` and existence
  checks); any SSH-carried operation beyond the three permitted by `DEC-0069`
  point 3; modifying `postgresql.conf`, `pg_hba.conf`, systemd units, or
  firewall rules; service start/stop/restart; deployment; nginx/TLS/DNS;
  credential rotation or printing; reading the rotated server-side secret at
  `/opt/anqiao-crm/shared/database.env`; git operations; dependency
  installation; dropping `crm_test` (retention/drop is a later product-owner
  decision per `DEC-0068` point 6).

## Boundaries (fail-closed)

- Before any write against `crm_test`, verify `SELECT current_database()`
  returns `crm_test`; if it does not, STOP and report.
- Credentials are read from local existing material (`deploy/.env`) with
  `DATABASE_NAME` overridden to `crm_test` for every migration and test
  command; values are never printed, logged, committed, or stored in
  evidence files.
- Four fail-closed stop conditions per `DEC-0069` point 6; each requires an
  immediate stop and report, never a workaround: (a) `current_database()` does
  not return `crm_test` before a write; (b) `crm_test` already exists;
  (c) SSH authentication does not succeed; (d) the `DATABASE_PASSWORD` in
  `deploy/.env` is rejected. Case (d) is expected to be possible because GR1
  rotated that credential server-side
  (`docs/evidence/TASK-0001-GR1-w3-recovery.md:27-30`); reading the rotated
  secret is NOT authorized, so a rejected credential ends the attempt and
  returns to the product owner.
- If any stop condition fires, report the exact missing condition; do not
  improvise alternatives outside these boundaries.
- All other `DEC-0067` point-5 boundaries remain in force except the narrow SSH
  transport granted by `DEC-0069` point 3 (no deployment, no nginx/TLS/DNS, no
  git writes, no dependency installs, no paid services, no real-data operations
  outside `crm_test`, no service restarts, no server configuration changes).

## Steps

Attempt 1 (route: direct database-port connection per `DEC-0068`):

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | Task authorized | Preflight: credential material existence (key names only), exact Settings env-var names from `src/crm/config.py`, server PostgreSQL port reachability | Preflight evidence | Facts cited from files and probes | FAILED (TCP probe refused; fail-closed stop) |
| 2 | Step 1 passed | Create empty `crm_test` on the server; verify `current_database()`; apply the repository's Alembic migrations to `crm_test` only | Empty migrated test database | `current_database()` = `crm_test`; migration head applied | BLOCKED (not executed — step 1 failed) |
| 3 | Step 2 passed | Run the two gated test files against `crm_test` with `CRM_RUN_POSTGRESQL_TESTS=1` | Runtime evidence | 6 gated tests pass; exact commands and totals recorded | BLOCKED (not executed — step 1 failed) |
| 4 | Step 3 passed | Record evidence and report | `docs/evidence/TASK-5A-verification.md` | EXECUTOR_RUNTIME_ID / COMMANDS_RUN / TEST_TOTALS / NOT_VERIFIED / BLOCKERS present | COMPLETE (evidence recorded; outcome PARTIAL) |

Attempt 2 (route: SSH transport per `DEC-0069`; steps A1-A4 are the executor's,
A5 is the coordinator's):

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| A1 | `DEC-0069` recorded | Preflight: confirm `deploy/.env` key names (values never printed); confirm exact `Settings` env-var names from `src/crm/config.py`; confirm SSH authentication to the deployment host succeeds using an existing local identity | Preflight evidence | SSH returns a successful non-interactive result; env-var names cited from file | PASSED (SSH auth succeeded non-interactively; key names and env-var names confirmed from files) |
| A2 | A1 passed | Over SSH, confirm `crm_test` does not already exist, then create it empty, owned by the role recorded in `deploy/.env` | Empty `crm_test` database | Existence check before creation; creation confirmed by a read-only catalog query | PASSED (absent beforehand; created empty, owner `anqiao_crm_app`; confirmed by read-only catalog query; left in place) |
| A3 | A2 passed | Open an SSH local port forward to the server's loopback PostgreSQL endpoint; verify `SELECT current_database()` returns `crm_test` through the forward before any write; apply the repository's own Alembic migrations to `crm_test` only | Migrated isolated test database | `current_database()` = `crm_test`; Alembic reports head applied | FAILED (forward opened on local port 55432 and read-only isolation proof returned `crm_test`, empty; fail-closed stop on condition (d) — `deploy/.env` `DATABASE_PASSWORD` rejected for `anqiao_crm_app`; Alembic never invoked) |
| A4 | A3 passed | Through the same forward, run `tests/test_task0007_postgresql_sessions.py` (5 tests) and the gated test in `tests/test_s4_authentication.py` with `CRM_RUN_POSTGRESQL_TESTS=1` and `DATABASE_NAME=crm_test`; record evidence | Runtime evidence appended to `docs/evidence/TASK-5A-verification.md` | 6 gated tests pass; exact commands and totals recorded; EXECUTOR_RUNTIME_ID / COMMANDS_RUN / TEST_TOTALS / CURRENT_DATABASE_PROOF / NOT_VERIFIED / BLOCKERS present | BLOCKED (no test executed — A3 failed; evidence recorded in `docs/evidence/TASK-5A-verification.md` "Attempt 2" with all required fields) |
| A5 | A4 passed | Coordinator independent re-run and TASK-0007 verdict decision | Verdict record | Re-run reproduces the pass; TASK-0007 upgraded to ACCEPTED | PENDING (coordinator) |

Attempt 3 (route: test-only role `crm_test_runner` over the SSH forward; steps
A3-A4 re-run by this executor; A1/A2 already passed in Attempt 2 and were not
repeated; `crm_test` existed empty and was reused):

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| A3 | A2 passed | Re-open the SSH forward; verify `SELECT current_database()` returns `crm_test` through the forward as `crm_test_runner` before any write; apply the repository's own Alembic migrations to `crm_test` only | Migrated isolated test database | `current_database()` = `crm_test`; Alembic reports head `0001_initial_schema` applied | PASSED (forward opened on 55432; `current_database()` = `crm_test` confirmed before the write; `alembic upgrade head` ran `-> 0001_initial_schema`; `alembic_version.version_num` = `0001_initial_schema`; 10 non-system tables) |
| A4 | A3 passed | Through the same forward, run `tests/test_task0007_postgresql_sessions.py` (5 tests) and the gated test in `tests/test_s4_authentication.py` with `CRM_RUN_POSTGRESQL_TESTS=1` and `DATABASE_NAME=crm_test`; record evidence | Runtime evidence appended to `docs/evidence/TASK-5A-verification.md` | 6 gated tests pass; exact commands and totals recorded; EXECUTOR_RUNTIME_ID / COMMANDS_RUN / TEST_TOTALS / CURRENT_DATABASE_PROOF / NOT_VERIFIED / BLOCKERS present | PASSED (6/6 gated tests PASSED after correction pass fixed two test-code defects: incomplete `finally` cleanup order and missing `ORDER BY` in `db_session_rows()`; stable across 15 consecutive runs; evidence in `docs/evidence/TASK-5A-verification.md` "Attempt 3" + correction section) |
| A5 | A4 passed | Coordinator independent re-run and TASK-0007 verdict decision | Verdict record | Re-run reproduces the pass; TASK-0007 upgraded to ACCEPTED | PASSED (2026-08-02; 6/6 reproduced independently; TASK-0007 upgraded to ACCEPTED) |

## Prerequisites and completion gate

- Prerequisite: TASK-0007 steps 1-5 complete with independent review verdict
  PARTIAL whose only unverified element is the real-PostgreSQL legs
  (satisfied 2026-08-02, evidence `docs/evidence/TASK-0007-KIMI-ACCEPTANCE.md`);
  explicit product-owner authorization (`DEC-0068`, satisfied 2026-08-02).
- Completion gate: both gated test files pass (6 tests) against `crm_test`
  on the production PostgreSQL server, evidence honestly records every
  command actually run, and the coordinator's independent re-run reproduces
  the pass (step A5). On pass, the TASK-0007 verdict is upgraded from PARTIAL
  to ACCEPTED.

## Risks and rollback

- Wrong-database risk is the primary hazard: the `current_database()` check
  before any write and the `DATABASE_NAME=crm_test` override on every
  command are mandatory. `crm_test` is empty and droppable; no production
  object is modified, so no rollback beyond dropping `crm_test` exists (drop
  itself requires a later product-owner decision).
- The gated tests create and delete synthetic rows inside `crm_test` only;
  the two-instance restart proof writes only into `crm_test` tables.

## Evidence and result

- Status: PARTIAL / ESCALATED (2026-08-02) — bounded executor stopped
  fail-closed at step 1 preflight: the server PostgreSQL port is not
  reachable from this machine. The only authorized credential material
  (`deploy/.env`) addresses the database as `localhost` (the server's own
  on-host view); probed from this machine it resolves to this machine, where
  no PostgreSQL listens (`ConnectionRefusedError`, no auth attempted). No
  routable server address exists in local credential material, and executor
  boundaries prohibit discovering or substituting one.
- Steps 2-4 were never executed: `crm_test` was never created, no database
  connection was opened, no migration ran, no gated test ran, and no
  production object was read or written. No credential value was printed,
  logged, or stored. One execution pass used; no correction pass is
  applicable within executor boundaries.
- Full evidence, exact commands, and the result block
  (EXECUTOR_RUNTIME_ID / COMMANDS_RUN / TEST_TOTALS /
  CURRENT_DATABASE_PROOF / NOT_VERIFIED / BLOCKERS):
  `docs/evidence/TASK-5A-verification.md`.
- Unblock requires a product-owner decision per `DEC-0068` point 4 (routable
  server address as authorized credential material with a reachable port,
  on-server execution by an authorized operator/tool, or a local isolated
  PostgreSQL instance). TASK-0007 remains PARTIAL.

### Coordinator independent check — attempt 2 (2026-08-02)

- [VERIFIED] Executor write scope checked against the pre-dispatch
  full-repository hash baseline (273 files): exactly two changed files
  (`docs/evidence/TASK-5A-verification.md`, appended without altering attempt 1;
  and this task card's Attempt 2 Status cells), zero additions, zero deletions.
  No source, test, configuration, or migration file was touched.
- [VERIFIED] The coordinator independently reproduced all three material claims.
  SSH authentication succeeds non-interactively. `crm_test` exists, its
  `SELECT current_database()` returns `crm_test`, and it holds 0 non-system
  tables — empty and isolated. Its owner is `anqiao_crm_app`, and the
  pre-existing `anqiao_crm` database is untouched with the same owner.
- [VERIFIED] The credential rejection was independently reproduced through the
  coordinator's own SSH local forward on a different local port:
  `IS_PASSWORD_AUTH_FAILED: True`, with `IS_CONNECTION_REFUSED`, `IS_NO_PG_HBA`,
  and `IS_DB_MISSING` all False. The failure is a credential value mismatch, not
  a transport, authorization-rule, or missing-database problem. The coordinator
  also asserted the password value does not appear in the error text
  (`PASSWORD_LEAKED_IN_ERROR: False`).
- [VERIFIED] Corroborating evidence that the local copy is stale: `deploy/.env`
  was last modified 2026-07-30 00:14, and GR1's server-side credential rotation
  (`DEC-0049`; `docs/evidence/TASK-0001-GR1-w3-recovery.md:27-30`) replaced the
  runtime secret after that point. Only the file's mtime was read; no value was
  read, printed, or compared.
- [VERIFIED] Step A2's output is intact and reusable: `crm_test` is empty and in
  place, so an unblocked attempt resumes at the migration rather than repeating
  creation. Per `DEC-0068` point 6 it is not dropped.
- [VERIFIED] Stop condition (d) fired exactly as `DEC-0069` point 6
  pre-specified, and the executor did not read the rotated server-side secret.
  Boundary compliance holds: no credential value printed or stored, only
  `crm_test` touched, no production real table read or written, no git,
  dependency, service, or server-configuration operation performed.
- Verdict on attempt 2: PARTIAL / ESCALATED, correctly executed. The executor's
  `DEC-0065` correction budget is exhausted (one execution pass plus one
  consolidated correction pass that excluded CRLF and shell-quoting as causes).
  The remaining blocker is a product-owner decision about which credential the
  migration and tests may use.
- Executor runtime identifier, recorded verbatim per `DEC-0066`, never a gate:
  `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5`.

### Coordinator independent check — attempt 3 (2026-08-02)

- [VERIFIED] Executor write scope: changed files are exactly (1) `tests/test_s4_authentication.py` — two test-code fixes (cleanup order + ORDER BY); (2) `src/crm/web/auth.py` — diagnostic `print` added and removed, no behavioral change (lines 346-388 read in full: no `print`, no logic deviation from fail-closed validate→user→status→epoch chain); (3) `docs/evidence/TASK-5A-verification.md` — Attempt 3 + correction-pass sections appended, Attempts 1-2 unaltered; (4) `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` — Attempt 3 Status cells updated; (5) `.env.crm_test_local` — gitignored credential material, not committed. No application source logic, migration, or configuration file other than the diagnostic-only and fully-reverted `src/crm/web/auth.py` was changed.
- [VERIFIED] Independent reproduction of 6/6 pass: coordinator opened own SSH local forward on **55433** (different from executor's 55432). `CRM_RUN_POSTGRESQL_TESTS=1 DATABASE_HOST=127.0.0.1 DATABASE_PORT=55433` — exact output: `6 passed in 17.35s`. Zero failed, zero skipped. Full invocation: `set -a && . .env.crm_test_local && set +a && export DATABASE_HOST=127.0.0.1 DATABASE_PORT=55433 && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py "tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use" -q`.
- [VERIFIED] `current_database()` proof through coordinator's own forward (port 55433): `Settings()` resolved `CFG_NAME: crm_test HOST: 127.0.0.1 PORT: 55433 USER: crm_test_runner SSLMODE: prefer`; `SELECT current_database()` returned `crm_test`. Fail-closed condition (a) did not fire.
- [VERIFIED] Governance check: `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` → `[PASS] Governance structure and gates are consistent. Approved SPECs: 7 / Active tasks: 6 / Legacy manifests: 1`.
- [VERIFIED] Semantic review — Defect 1 (cleanup order): `migrations/versions/0001_initial_schema.py:202` defines `fk_audit_events_actor_user_id_user_identities` with `ondelete="RESTRICT"`. The original `finally` block deleted `user_identities` while `audit_events` rows referencing the test user still existed, which PostgreSQL's RESTRICT constraint correctly rejects. The fix inserts `DELETE FROM audit_events WHERE actor_user_id = user.id` before `DELETE FROM user_identities`. The application writes `audit_events` rows as correct behavior; the test simply failed to clean them up. This is a test-cleanup-completeness defect, not an application bug.
- [VERIFIED] Semantic review — Defect 2 (missing ORDER BY): `db_session_rows()` now contains `.order_by(ServerSessionModel.created_at)`. The test indexes `rows[0]`, `rows[1]`, `rows[2]` by creation sequence; without `ORDER BY`, PostgreSQL's return order for an `IN (...)` query is non-deterministic. The evidence file's diagnostic output confirmed `validate_session` operated correctly (`status=enabled, epoch=2, record_epoch=1`); only the test's positional assumption was wrong. This is a test-quality defect, not an application bug.
- [VERIFIED] Boundary compliance: no credential value appeared in any command line or output (password piped via SSH stdin and consumed inside Python via `os.environ`; coordinator asserted `PASSWORD_NOT_IN_OUTPUT` before printing diagnostics); only `crm_test` was written to; `anqiao_crm` was never connected to; `/opt/anqiao-crm/shared/database.env` was never opened; SSH operations confined to DEC-0069 point 3 three purposes; no git command, no dependency installed, no service started/stopped/restarted, no `postgresql.conf`/`pg_hba.conf`/systemd/firewall change. Coordinator also cleaned 1 residue `audit_events` row from prior runs (write to `crm_test` only, authorized by DEC-0068) before the re-run.
- [VERIFIED] Scope-expansion adjudication: the product owner's instruction "找到失败的原因，解决" was delivered after the Attempt 3 execution pass reported PARTIAL. Under AGENTS.md §2, a current explicit product-owner decision outranks task-card boundaries. The instruction necessarily authorized editing the failing test file; without that, "solve it" has no engineering path. `src/crm/web/auth.py` was temporarily modified for diagnostics only and fully reverted; lines 346-388 read in full confirm zero behavioral change. Authorization is valid.
- [VERIFIED] DEC-0065 correction-budget adjudication: exactly one consolidated correction pass was consumed (the Attempt 3 correction pass that fixed two test-code defects). The budget states "at most one consolidated correction pass." Budget not exceeded.
- [VERIFIED] Executor runtime identifier, recorded verbatim per DEC-0066, never a gate: `96183061-777e-4cb4-998a-fd38d960838e/xopglm52`.
- Verdict on attempt 3: ACCEPTED — the 6 gated tests pass independently (6 passed / 0 failed / 0 skipped, coordinator's own forward port 55433), both test-code fixes are genuine test-quality defects, boundary compliance holds, and the product owner authorized the correction pass. TASK-0007 is upgraded from PARTIAL to ACCEPTED.
- Coordinator runtime identifier, recorded verbatim per DEC-0066, never a gate: `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5`.

### Coordinator independent check — attempt 1 (2026-08-02)

- [VERIFIED] Executor write scope was verified against the pre-dispatch
  full-repository hash baseline (270 files): exactly one changed file (this
  task card) and one added file (`docs/evidence/TASK-5A-verification.md`), zero
  deletions. No source, test, configuration, or migration file was touched.
- [VERIFIED] The coordinator independently re-ran a plain TCP probe to
  `localhost:5432` from this machine and reproduced `ConnectionRefusedError`,
  confirming the executor's reachability finding. No authentication was
  attempted and no credential value was read or printed.
- [VERIFIED] Step 5 (coordinator independent re-run of the gated tests) cannot
  be performed: no test executed and `crm_test` was never created, so there is
  no result to reproduce. Step 5 remains PENDING on the same blocker.
- [VERIFIED] Root cause of the blocker, established by coordinator inspection
  after the executor's stop and recorded in
  `docs/evidence/TASK-5A-ORCHESTRATION-ANALYSIS.md`: the production PostgreSQL
  is loopback-bound by design (`listen_addresses=localhost`), and that
  non-exposure was verified as a passing gate result in W2, W3, and G4. The
  option selected in `DEC-0068` — connect to the server's database port while
  `DEC-0067` point 5's SSH/host prohibition remains in force — is therefore
  internally unsatisfiable. The executor's fail-closed stop was the correct
  outcome of a contradictory instruction, not an execution defect;
  responsibility lies with the coordinator that drafted the option set.
- [PROPOSAL] The unblock is narrower than the three options presented when this
  card was written: the database actions themselves (create empty `crm_test`,
  migrate `crm_test` only, run the gated tests there) are already authorized by
  `DEC-0068` points 1(b)-(d). What is missing is authorization to use the
  project's established SSH transport as the carrier for those already
  authorized actions. Widening `listen_addresses` or opening the database port
  is withdrawn by the coordinator and is not proposed, because it would reverse
  the accepted security property above.
- Coordinator model change recorded per `DEC-0066` (agent and model layers
  recorded separately; never a gate): the coordinator role continues under the
  runtime model identifier
  `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5`, succeeding the earlier
  Kimi-K3 coordinator turns in this task after that runtime reached its usage
  limit, per the product owner's instruction on 2026-08-02
  ("kimi已经到了5h限额，切换为opus5继续"). Earlier Kimi-K3 records remain
  factual history and are not rewritten.
