# HANDOFF: TASK-5A attempt 2 — isolated `crm_test` verification over the SSH transport

- Date: 2026-08-02
- From: coordinator (ZCode session, runtime model identifier
  `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5`; recorded per `DEC-0066`,
  never a gate)
- To: one bounded ZCode subagent (executor)
- Task: `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`
- Authorization: `DEC-0068` (the database actions) + `DEC-0069` (the SSH
  transport that carries them)
- Supersedes: `docs/handoffs/HANDOFF-20260802-KIMI-TASK-5A-VERIFICATION.md`
  (attempt 1, direct database-port route)

## 1. Purpose and what changed since attempt 1

Execute steps A1-A4 of the task card. Step A5 belongs to the coordinator; do not
attempt it.

Attempt 1 stopped fail-closed at preflight and that was correct behavior. The
root cause was an unsatisfiable instruction, not an execution defect: the
production PostgreSQL is loopback-bound by design
(`listen_addresses=localhost`, verified as a passing gate result in W2, W3, and
G4), while `DEC-0068` simultaneously required connecting to its port and
prohibited SSH. `DEC-0069` resolves this by authorizing the SSH transport that
the project already uses everywhere else. Read
`docs/evidence/TASK-5A-ORCHESTRATION-ANALYSIS.md` for the full analysis.

Do not rewrite attempt 1's recorded result. It stands as factual history.

## 2. Required reading, in order

1. `AGENTS.md` in full.
2. `docs/decisions/DECISION-LOG.md`: `DEC-0065` (correction budget), `DEC-0066`
   (agent/model recording), `DEC-0067` point 5 (boundaries), `DEC-0068`,
   `DEC-0069`.
3. `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` in full.
4. `docs/evidence/TASK-5A-ORCHESTRATION-ANALYSIS.md`.
5. `docs/evidence/TASK-5A-verification.md` (attempt 1's evidence; you will
   append to it, not overwrite it).
6. `src/crm/config.py`, `src/crm/persistence/database.py`, `migrations/env.py`.

## 3. Owned actions — exhaustive

You may do exactly these, and nothing else:

1. Read-only inspection of any repository file.
2. Read `deploy/.env` into the process environment. Never print, echo, log,
   commit, or write any value from it. Key names only.
3. SSH to the deployment host using an existing local identity, for exactly the
   three purposes `DEC-0069` point 3 permits: (a) create the empty `crm_test`
   database; (b) open a local port forward to the server's loopback PostgreSQL
   endpoint; (c) read-only checks proving isolation.
4. Apply the repository's own Alembic migrations to `crm_test` only.
5. Run the two gated test files against `crm_test`.
6. Write `docs/evidence/TASK-5A-verification.md` (append an "Attempt 2" section)
   and update only the Attempt 2 step Status cells in the task card.

## 4. Hard boundaries — fail-closed

Four stop conditions. Each requires an immediate stop and a report. None may be
worked around, retried with a substitute, or resolved by improvisation:

- **(a)** `SELECT current_database()` does not return `crm_test` before any
  write.
- **(b)** `crm_test` already exists. Do not reuse it, do not drop it.
- **(c)** SSH authentication does not succeed. Do not try alternative hosts,
  ports, keys, or password prompts.
- **(d)** The `DATABASE_PASSWORD` in `deploy/.env` is rejected by PostgreSQL.
  This is a realistic outcome: GR1 rotated that credential server-side into
  `/opt/anqiao-crm/shared/database.env`
  (`docs/evidence/TASK-0001-GR1-w3-recovery.md:27-30`), so the local copy may be
  stale. **Reading that server-side file is NOT authorized.** Stop and report.

Never do any of these:

- print or store any credential value, in any file, log, or command echo;
- read or write any production real table, or any database other than
  `crm_test`;
- modify `postgresql.conf`, `pg_hba.conf`, systemd units, or firewall rules;
- start, stop, restart, or reconfigure any service;
- deploy, release, or change nginx/TLS/DNS;
- edit any application source, test, configuration, or migration file;
- run any git write command (no add, commit, push, reset, clean, checkout);
- install any dependency, locally or on the server;
- drop `crm_test` (retention is a later product-owner decision);
- touch anything belonging to another project on that host.

`DEC-0065` correction budget: one execution pass plus at most one consolidated
correction pass, and corrections are limited to environment/mechanics. If it
still does not pass, report PARTIAL / ESCALATED and stop.

## 5. Environment facts (verified; do not re-derive by guessing)

- Repository root is the working directory. Python is `.venv/Scripts/python.exe`
  (3.12.8). `alembic.ini` sets `script_location = migrations`.
- Deployment host and OS user appear throughout `scripts/run_w4_migration.py`,
  `scripts/check_remote_db.py`, and `deploy_and_start.py`. Reuse the same host
  and user those scripts use. Those scripts also show the established flag set
  (`-o StrictHostKeyChecking=no -o BatchMode=yes`) and the
  `sudo -u postgres psql` pattern that W4 used successfully.
- The database role recorded for application access is `anqiao_crm_app`
  (`docs/evidence/TASK-0001-W4-database-migration.md:20,38`). Authentication over
  the loopback TCP socket is md5 (same file, line 111).
- `deploy/.env` contains exactly four keys: `DATABASE_HOST`, `DATABASE_NAME`,
  `DATABASE_USER`, `DATABASE_PASSWORD`. There is no `DATABASE_PORT` key, so
  `Settings`' default 5432 applies; no `DATABASE_SSLMODE` key, so `prefer`
  applies.
- `Settings` (`src/crm/config.py:11`) reads uppercase field names from the
  environment. `SessionLocal()` in `src/crm/persistence/database.py` builds a
  fresh engine from `Settings()` on each call, so environment overrides take
  effect per command. `migrations/env.py` builds its URL from the same
  `Settings()`.
- The gated tests do NOT create tables. The schema must already exist in
  `crm_test` via Alembic before step A4, or the tests will fail for the wrong
  reason.
- The gated tests skip unless `CRM_RUN_POSTGRESQL_TESTS=1`
  (`tests/test_task0007_postgresql_sessions.py:19-20`;
  `tests/test_s4_authentication.py:514-515`). A "skipped" result is not a pass —
  report totals honestly and treat unexpected skips as a failure to investigate.
- `.env.test` is NOT a credential source for this task.
- Because the server's PostgreSQL is loopback-bound, the local test suite reaches
  `crm_test` through the SSH local port forward. Choose a local port that is
  free on this machine and record which one you used. `sslmode=prefer` over a
  forwarded connection is acceptable; the SSH tunnel provides the transport
  encryption.

## 6. Required result format

Append an "Attempt 2" section to `docs/evidence/TASK-5A-verification.md`
containing exactly these labelled fields:

- `EXECUTOR_RUNTIME_ID`: your exact runtime model identifier, verbatim, or
  `UNKNOWN - runtime identifier not exposed`. Never a gate.
- `COMMANDS_RUN`: every command actually run, verbatim, with credential values
  replaced by `<redacted>` if any would otherwise appear. Include the SSH
  invocations and the local forward port you chose.
- `CURRENT_DATABASE_PROOF`: the `SELECT current_database()` result observed
  immediately before the first write, and the point in the sequence where it was
  taken.
- `TEST_TOTALS`: per-file passed/failed/skipped counts and wall time, plus the
  exact pytest invocation.
- `NOT_VERIFIED`: anything still unproven, with the exact remaining check.
- `BLOCKERS`: empty if none, otherwise the precise missing condition.
- `BOUNDARY_COMPLIANCE`: an explicit statement covering credentials, databases
  touched, files edited, and git/dependency/service operations.

Then update only the Attempt 2 step Status cells in the task card. Do not edit
any other section of the card, and do not touch any other repository file.

## 7. Coordinator-side acceptance (not yours)

The coordinator will diff the repository against a pre-dispatch full-repository
hash baseline, independently re-run the same two test files against `crm_test`
through its own forward, re-run `scripts/check-governance.ps1`, and decide the
TASK-0007 verdict upgrade. Report honestly; a fail-closed stop with a precise
missing condition is a better outcome than an ambiguous partial success.

