# HANDOFF-20260802-TASK-5A-A5-COORDINATOR-AUDIT — coordinator independent re-run and TASK-0007 verdict decision

- Task: `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` (step A5)
- Authorized by: `DEC-0068` (database actions) + `DEC-0069` (SSH transport) +
  product-owner instruction "找到失败的原因，解决" (find the failure cause,
  solve it — this authorized the Attempt 3 correction pass that edited the test
  file, expanding the original TASK-5A boundary)
- To: the coordinator (runtime
  `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5`, recorded per
  `DEC-0066`; never a gate)
- From: the TASK-5A Attempt 3 bounded executor (runtime
  `96183061-777e-4cb4-998a-fd38d960838e/xopglm52`, recorded per `DEC-0066`;
  never a gate)
- Date: 2026-08-02
- Supersedes: none (this is the A5 audit handoff; Attempts 1-2 had their own
  handoffs)
- Binding contract: This handoff is the binding audit contract. If any
  instruction here conflicts with the task card or `DEC-0068`/`DEC-0069`, STOP
  and report; the decision log outranks this document.

## 1. Purpose

You are the coordinator. Execute step A5 of TASK-5A: independently re-run the
six `CRM_RUN_POSTGRESQL_TESTS=1`-gated tests against `crm_test` on the
production PostgreSQL server, audit the Attempt 3 execution pass and its
correction pass, and decide whether TASK-0007's verdict upgrades from PARTIAL
to ACCEPTED.

Per the task card completion gate (lines 135-139): "On pass, the TASK-0007
verdict is upgraded from PARTIAL to ACCEPTED." Per `DEC-0069` point 9: "On a
reproduced pass, TASK-0007 is upgraded from PARTIAL to ACCEPTED and TASK-0001
mainline work resumes per DEC-0067 point 4. On any fail-closed stop, TASK-0007
remains PARTIAL."

This is your step. The executor has finished. You are not dispatched by anyone;
you are the independent reviewer.

## 2. Required reading (in order)

1. `AGENTS.md` (full — the operating contract).
2. `docs/decisions/DECISION-LOG.md` — `DEC-0065` (correction budget),
   `DEC-0066` (recording discipline), `DEC-0067` point 5 (scope boundary),
   `DEC-0068` (full), `DEC-0069` (full). These define what was authorized and
   what was not.
3. `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` — the task
   card, including the Attempt 3 step table and the two prior "Coordinator
   independent check" sections (Attempts 1 and 2).
4. `docs/evidence/TASK-5A-verification.md` — the full evidence file. Attempt 3
   starts at "## Attempt 3"; the correction-pass section starts at "## Attempt
   3 — Correction pass". Read both in full. This is what you are auditing.
5. `tests/test_s4_authentication.py` — the test file that was edited in the
   correction pass. Key locations:
   - line 534: `AuditEventModel` added to imports (Defect 1 fix)
   - lines 562-568: `db_session_rows()` with `.order_by(...)` (Defect 2 fix)
   - lines 648-665: `finally` cleanup block with the `audit_events` delete
     inserted before `user_identities` (Defect 1 fix)
6. `src/crm/web/auth.py` lines 346-388 — `validate_session`. A temporary
   diagnostic `print` was added during investigation and removed. Confirm no
   behavioral change remains.
7. `src/crm/config.py`, `src/crm/persistence/database.py`,
   `migrations/env.py` — the runtime configuration and migration environment,
   cited in Attempt 3's preflight.
8. `.gitignore` lines 1-4 — confirm `.env.crm_test_local` is excluded by the
   `.env.*` rule.

## 3. Coordinator audit steps (yours; the executor does not participate)

These are your own operations. You may do exactly these, and nothing else.

### (a) File-state diff (write scope verification)

Inspect the full repository file state. The executor's correction pass was
authorized by the product owner's "找到失败的原因，解决" instruction. Verify
the changed file set is exactly:

1. `tests/test_s4_authentication.py` — two test-code fixes (cleanup order +
   ORDER BY); all diagnostic `print`/`import` statements added during
   investigation were removed.
2. `src/crm/web/auth.py` — temporary diagnostic `print` in `validate_session`
   added and removed; confirm **no behavioral change** (read lines 346-388;
   the function must match the pre-edit logic exactly).
3. `docs/evidence/TASK-5A-verification.md` — Attempt 3 + correction-pass
   sections appended; Attempts 1-2 unaltered.
4. `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` — Attempt 3
   step table and Status cells updated.
5. `.env.crm_test_local` — gitignored local credential material (not a source
   file; not committed). Confirm it is excluded by `git check-ignore`.

No application source logic, migration, or configuration file other than
`src/crm/web/auth.py` (diagnostic-only, removed) may have been changed. If any
other source/migration/config file was modified, STOP and report.

### (b) Independent re-run of the 6 gated tests

Open your own SSH local port forward to the server's loopback PostgreSQL
endpoint on a **different local port** (e.g. 55433 or 55434) to avoid collision.
Use the `.env.crm_test_local` credential file created by the executor (it
points to `crm_test_runner` on `127.0.0.1:<your port>` / `crm_test`).

Before any write, verify `SELECT current_database()` returns `crm_test` through
your forward. If it does not, STOP — fail-closed condition (a).

Then run both gated test files with `CRM_RUN_POSTGRESQL_TESTS=1`:

```
set -a && . .env.crm_test_local && set +a && export DATABASE_HOST=127.0.0.1 DATABASE_PORT=<your port> && CRM_RUN_POSTGRESQL_TESTS=1 .venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py "tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use" -q
```

The success criterion is **6 passed / 0 failed / 0 skipped**. One skipped or
one error does not count as a pass.

If `crm_test` has residue data from prior runs that interferes, you may clean it
over SSH: `DELETE FROM server_sessions; DELETE FROM audit_events; DELETE FROM
user_identities WHERE username LIKE 'integ_test_%' OR username LIKE
'task0007_repo_%';` (this is a write to `crm_test` only, authorized by
`DEC-0068`; verify `current_database()` = `crm_test` first).

### (c) Governance check

Run `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
It must report `[PASS]`.

### (d) Semantic review of the two test-code fixes

Read both fixes and confirm they are genuine test-quality defects, not masks
for an application bug:

- **Defect 1** (`tests/test_s4_authentication.py` finally block, lines
  648-665): the cleanup deleted `user_identities` while `audit_events` rows
  still referenced it via `fk_audit_events_actor_user_id_user_identities`
  (`ondelete="RESTRICT"`, defined in `migrations/versions/0001_initial_schema.py`
  line 202). The fix inserts a `DELETE FROM audit_events` before the
  `DELETE FROM user_identities`, matching the cleanup pattern already used in
  `tests/test_task0007_postgresql_sessions.py` lines 56-69. Confirm this is a
  test-cleanup-completeness defect, not an application bug.

- **Defect 2** (`tests/test_s4_authentication.py` `db_session_rows()`, lines
  562-568): the `SELECT ... WHERE session_token_hash IN (...)` lacked
  `ORDER BY`. PostgreSQL does not guarantee row return order without an
  explicit `ORDER BY`. The test indexed `rows[0..2]` assuming creation order,
  but PostgreSQL intermittently returned rows in a different order, causing
  `rows[2]` to land on the session invalidated with `user_not_enabled` instead
  of the one invalidated with `session_epoch_mismatch`. The fix adds
  `.order_by(ServerSessionModel.created_at)`. The evidence file's
  correction-pass section records the diagnostic output that proved the
  application logic was correct (`status=enabled, epoch=2, record_epoch=1`)
  and only the test's row-order assumption was wrong. Confirm this.

### (e) Boundary compliance audit

Verify against `DEC-0069` point 6 and `DEC-0068` point 5:

- **Credentials**: the `crm_test_runner` password was generated with
  `secrets.token_hex(32)`, stored only in `.env.crm_test_local` (gitignored),
  piped to remote `psql` via SSH stdin (never on a command line), and consumed
  inside Python via `os.environ`. It never appeared in any command output,
  evidence file, or log. The stale `deploy/.env` password and the rotated
  server-side secret at `/opt/anqiao-crm/shared/database.env` were not read.
  Confirm by scanning the evidence file for any password value — none should
  exist.
- **Databases touched**: `crm_test` only. While connected to `postgres`, the
  only statements were `CREATE ROLE crm_test_runner`, `GRANT`s scoped to
  `crm_test`, and read-only catalog queries. `anqiao_crm` was never connected
  to. No production real table was read or written.
- **SSH-carried operations**: confined to the three `DEC-0069` point 3
  purposes — (a) `CREATE ROLE`/`GRANT` on `crm_test` only, (b) one local port
  forward, (c) read-only isolation checks. Nothing else.
- **Files edited**: the four files listed in step (a) above, plus
  `.env.crm_test_local` (gitignored). No other source, test, config, or
  migration file was touched.
- **Git / dependencies / services**: no git command, no dependency installed,
  no service started/stopped/restarted, no `postgresql.conf`/`pg_hba.conf`/
  systemd/firewall change.

### (f) Scope-expansion adjudication

The original TASK-5A boundary (task card "Scope", `DEC-0069` point 5) prohibited
editing test files. The correction pass edited `tests/test_s4_authentication.py`
and temporarily edited `src/crm/web/auth.py`. This was authorized by the
product owner's instruction "找到失败的原因，解决" (find the failure cause,
solve it), delivered after the Attempt 3 execution pass reported PARTIAL.

Record whether you consider this authorization valid:
- The instruction explicitly authorized finding and solving the failure, which
  necessarily implied editing the failing test file.
- `src/crm/web/auth.py` was only temporarily modified for diagnostics and
  restored; confirm no behavioral change remains (read lines 346-388).
- The `DEC-0065` correction budget states "at most one consolidated correction
  pass." The correction pass was one pass. It edited test code (not strictly
  "environment/mechanics"), but the product owner's instruction superseded the
  mechanics-only constraint for this pass. Record your adjudication.

## 4. Required verdict format

Write a new subsection in `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`
under `## Evidence and result`, following the pattern of the two prior
"Coordinator independent check" sections:

```
### Coordinator independent check — attempt 3 (2026-08-02)
```

Cover each item with a `[VERIFIED]` / `[NOT VERIFIED]` / `[UNKNOWN]` tag:

1. Executor write scope (file-state diff result; exact changed files).
2. Independent reproduction of the 6/6 test pass (your own forward, your own
   port, exact totals).
3. `current_database()` proof through your own forward.
4. Governance check result.
5. Semantic review of Defect 1 (cleanup order) — genuine test defect, not an
   app bug.
6. Semantic review of Defect 2 (missing ORDER BY) — genuine test defect, not an
   app bug; the application's `validate_session` logic is correct.
7. Boundary compliance (credentials, databases, SSH ops, files, git/deps/
   services).
8. Scope-expansion adjudication (product-owner authorization valid; `auth.py`
   behaviorally unchanged).
9. `DEC-0065` correction-budget adjudication.
10. Executor runtime identifier, recorded verbatim per `DEC-0066`, never a
    gate: `96183061-777e-4cb4-998a-fd38d960838e/xopglm52`.

End with a verdict line:

```
- Verdict on attempt 3: ACCEPTED — the 6 gated tests pass independently, both
  test-code fixes are genuine defects, boundary compliance holds, and the
  product owner authorized the correction pass. TASK-0007 is upgraded from
  PARTIAL to ACCEPTED.
```

Or, if any item fails:

```
- Verdict on attempt 3: PARTIAL / ESCALATED — <exact reason>. TASK-0007
  remains PARTIAL.
```

If ACCEPTED: update the A5 Status cell to `PASSED`, and per `DEC-0069` point 9
and the task card completion gate, upgrade TASK-0007's verdict from PARTIAL to
ACCEPTED in `docs/tasks/TASKS.md`, `docs/NOW.md`, and the adjudication blocks
in `docs/PROJECT.md`, `docs/specs/INDEX.md`, `docs/specs/SPEC-BASELINE.md`, and
`docs/governance/DEVELOPMENT-SEQUENCE.md`. TASK-0001 mainline work may resume
per `DEC-0067` point 4.

## 5. Key facts for the coordinator (verified; do not re-derive by guessing)

- `.env.crm_test_local` exists and is gitignored (`.gitignore` lines 2-3:
  `.env` and `.env.*` rules; `!.env.example` is the only exception). It
  contains `DATABASE_HOST=127.0.0.1`, `DATABASE_PORT=55432`,
  `DATABASE_NAME=crm_test`, `DATABASE_USER=crm_test_runner`,
  `DATABASE_PASSWORD=<redacted>`. Key names only — never print the value.
- The `crm_test_runner` role exists on the production PostgreSQL server
  (`rolcanlogin=t`, `has_pw=t`), created by the executor via SSH
  `sudo -u postgres psql`. It has `GRANT USAGE, CREATE ON SCHEMA public` and
  `ALTER DEFAULT PRIVILEGES` on `crm_test`'s `public` schema.
- `crm_test` exists, owner `anqiao_crm_app`, and has been migrated to Alembic
  head `0001_initial_schema` (10 non-system tables: 9 business tables +
  `alembic_version`). It may contain test residue from the executor's runs;
  clean it as described in step 3(b) before your re-run if needed.
- `crm_test_runner` is a test-only role scoped to `crm_test` only. It cannot
  access `anqiao_crm` or any other database.
- SSH to `ubuntu@124.222.212.159` succeeds non-interactively
  (`BatchMode=yes`).
- The production PostgreSQL is loopback-bound
  (`listen_addresses=localhost`); the SSH local forward is the only way to
  reach it from this machine.
- The two test-code fixes are at:
  - `tests/test_s4_authentication.py:534` — `AuditEventModel` import
  - `tests/test_s4_authentication.py:562-568` — `db_session_rows()` with
    `.order_by(ServerSessionModel.created_at)`
  - `tests/test_s4_authentication.py:648-665` — `finally` cleanup block with
    `audit_events` delete before `user_identities` delete
- `src/crm/web/auth.py:346-388` (`validate_session`) was temporarily modified
  for diagnostics and restored. Confirm no trace remains.
- The executor's stability run was 15 consecutive passes with 0 failures.

## 6. Boundary note for the coordinator

Your audit operations are limited to:

- read-only file inspection;
- opening your own SSH local forward on a different port;
- `SELECT current_database()` and the read-only isolation checks;
- cleaning `crm_test` residue (write to `crm_test` only, authorized by
  `DEC-0068`);
- running the two gated test files with `CRM_RUN_POSTGRESQL_TESTS=1`;
- running `scripts/check-governance.ps1`;
- writing the verdict subsection and Status cell in the task card;
- if ACCEPTED, synchronizing control documents for the TASK-0007 verdict
  upgrade.

You must not:

- modify any application source, test, migration, or configuration file;
- read `/opt/anqiao-crm/shared/database.env` or any other server-side secret;
- print or store any credential value;
- touch any database other than `crm_test`;
- modify `postgresql.conf`, `pg_hba.conf`, systemd, or firewall;
- start/stop/restart any service;
- run git commit/push;
- install dependencies;
- drop `crm_test` (retention is a later product-owner decision per
  `DEC-0068` point 6).

## 7. Honest reporting

If your independent re-run does not reproduce 6/6, report PARTIAL / ESCALATED
with the exact totals and stop. Do not declare ACCEPTED unless you personally
ran the tests and saw 6 passed. Honest reporting is more valuable than a vague
success.
