# HANDOFF-20260802-KIMI-TASK-5A-VERIFICATION — bounded execution contract

- Task: TASK-5A (`docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`)
- Authorized by: `DEC-0068` (2026-08-02)
- Executor: one bounded ZCode subagent (GLM), dispatched by the coordinator
- This handoff is the binding execution contract. If any instruction here
  conflicts with the task card or `DEC-0068`, STOP and report; the decision
  log outranks this document.

## 1. Purpose

Execute steps 1-4 of the TASK-5A card only. Step 5 (independent re-run and
the TASK-0007 verdict decision) belongs to the coordinator and is not yours.

You are proving, on the real PostgreSQL engine of the production server,
that TASK-0007's durable authentication persistence works — against a newly
created, isolated, empty database named `crm_test`, never against production
real tables.

## 2. Required reading (in order)

1. `AGENTS.md` (repository operating contract);
2. `docs/decisions/DECISION-LOG.md` — `DEC-0065`, `DEC-0066`, `DEC-0067`
   point 5, and `DEC-0068` in full;
3. `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md` (the card);
4. This handoff;
5. `docs/evidence/TASK-0007-verification.md` section 3 (the exact remaining
   checks you are discharging) and
   `docs/evidence/TASK-0007-KIMI-ACCEPTANCE.md` section 6.

## 3. Owned actions (exclusive)

1. Preflight (card step 1):
   - Cite the exact `Settings` environment variable names from
     `src/crm/config.py` (fields `database_host`, `database_port` default
     5432, `database_name`, `database_user`, `database_password` — verify,
     do not assume).
   - Confirm `deploy/.env` exists and contains the `DATABASE_HOST`,
     `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` keys — list key
     names only, NEVER print values.
   - Probe TCP reachability of the server PostgreSQL port from this machine
     (host from `deploy/.env`, port 5432 unless `src/crm/config.py` or the
     env says otherwise). No authentication attempt is needed for the probe.
   - If any preflight item fails: STOP; write
     `docs/evidence/TASK-5A-verification.md` with the exact missing
     condition; report PARTIAL.
2. Create the empty `crm_test` database on the production PostgreSQL server
   (card step 2; one-time write authorized by `DEC-0068`):
   - Use the credentials from `deploy/.env` without printing them (e.g.,
     `set -a; . deploy/.env; set +a` in bash, then use the variables).
   - While connected to any database OTHER than `crm_test`, the only
     statements you may execute are `CREATE DATABASE crm_test;` and
     read-only `SELECT current_database();` checks. No SELECT, INSERT,
     UPDATE, DELETE, or DDL against production tables.
   - If `crm_test` already exists, STOP and report — do not drop or reuse it
     without coordinator instruction.
3. Apply the repository's own Alembic migrations to `crm_test` ONLY:
   - `DATABASE_NAME=crm_test` override plus the other `DATABASE_*` values,
     then `alembic upgrade head` from the repository root
     (`migrations/env.py` builds its URL from the same `Settings`).
   - Before the migration write, verify `SELECT current_database()` returns
     `crm_test` on the connection you are about to use.
4. Run the gated tests (card step 3), from the repository root with
   interpreter `.venv/Scripts/python.exe`:
   - `CRM_RUN_POSTGRESQL_TESTS=1`, `DATABASE_NAME=crm_test`, other
     `DATABASE_*` from `deploy/.env`;
   - `.venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`
   - `.venv/Scripts/python.exe -m pytest tests/test_s4_authentication.py -q`
     (the whole file runs; only its one gated test exercises the real
     database — record full totals).
   - Capture exact commands and pass/skip/fail totals.
5. Evidence and card update (card step 4):
   - Write `docs/evidence/TASK-5A-verification.md` with every command
     actually run, its result, and the section-7 result block.
   - Update ONLY the per-step Status values and the `## Evidence and result`
     section of the TASK-5A card. Do not touch the metadata block, scope,
     boundaries, or gate sections.

## 4. Hard boundaries (fail-closed)

- NEVER print, log, commit, or store credential values — not in terminal
  output captures, evidence files, or the final report. Key names only.
- Before ANY write against `crm_test`, verify `SELECT current_database()`
  returns `crm_test`; otherwise STOP and report.
- No application source, test, configuration, migration, or deployment file
  may be edited. The gated tests are already written and reviewed.
- No server host/SSH access, no deployment, no nginx/TLS/DNS changes, no git
  operations, no dependency installation, no paid services.
- Do not drop `crm_test` afterwards; leave it in place for the coordinator's
  independent re-run (`DEC-0068` point 6).
- One execution pass plus at most one consolidated correction pass is
  allowed (`DEC-0065`). A correction pass may adjust environment/mechanics
  only (e.g., how the schema is applied or how env vars are supplied); it
  must never edit source or test files. After that, report PARTIAL /
  ESCALATED and stop.

## 5. Environment facts (verified by the coordinator on 2026-08-02)

- Repository root: `D:\Project\中科安樵\crm`; interpreter:
  `.venv/Scripts/python.exe` (Python 3.12.8). Do not install anything.
- `src/crm/persistence/database.py` `SessionLocal()` builds a fresh engine
  from `Settings()` on each call — the tests therefore connect using the
  `DATABASE_*` environment variables you export.
- The gated tests do NOT create tables; the schema must exist in `crm_test`
  before the test run (step 3 above).
- `deploy/.env` holds the four production `DATABASE_*` keys (no
  `DATABASE_PORT` key; the `Settings` default is 5432 — confirm in
  `src/crm/config.py`).
- `.env.test` holds `CRM_DATABASE_*` synthetic keys; it is NOT your
  credential source.

## 6. Result format (end of `docs/evidence/TASK-5A-verification.md`)

- `EXECUTOR_RUNTIME_ID`: your exact runtime model identifier if exposed,
  otherwise `UNKNOWN - runtime identifier not exposed` (never a gate);
- `COMMANDS_RUN`: every command, verbatim, with pass/fail (credential values
  redacted as `<redacted>`);
- `TEST_TOTALS`: per file and combined (passed/skipped/failed);
- `CURRENT_DATABASE_PROOF`: how you verified `crm_test` before each write;
- `NOT_VERIFIED`: anything not run, with exact reason and remaining check;
- `BLOCKERS`: exact missing conditions, if any.

## 7. Coordinator-side acceptance (not yours)

The coordinator will independently re-run the same two test files against
`crm_test`, re-run the governance check, and decide the TASK-0007 verdict
upgrade (PARTIAL → ACCEPTED) recorded in `docs/evidence/`.
