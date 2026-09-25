# TASK-0032: Corrected W5 production release (column widen + release re-run)

- Task ID: TASK-0032
- Status: ACTIVE / **EXECUTED 2026-08-13 — W5 RELEASE COMPLETE (HANDOFF-ONLY) —
  AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)**
- Task type: DEPLOYMENT
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0141`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-13 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: `DEC-0141`; approved SPEC-0012 hash match; fixed release commit
  `59101b80b6420155bf8aec26b14ea7800979db86`; the DEC-0140 root-cause
  confirmation (0005 revision id = 39 chars > `varchar(32)`); the preserved
  TASK-0031 artifacts (staged code, frozen venv, backup, wheelhouse + lock).

## Goal

Complete the W5 release by first widening `alembic_version.version_num` from
`varchar(32)` to `varchar(64)` (the one-time fix for the 39-character revision
id), then re-running the release using the preserved artifacts: code swap,
relocation-safe frozen-lock venv rebuild, database migration 0001→0005, service
restart, and verification — with rollback on any failure.

## Sequential phases

1. **Local preparation**: verify SPEC-0012 hash and HEAD; run governance.
2. **Server preflight (read-only)**: strict SSH identity; DB revision is
   `0001_initial_schema`; staged code at `/opt/anqiao-crm/tmp/task0031-20260813085841/`
   present and compiled; wheelhouse + `linux-requirements.lock` at
   `/tmp/task0030/` present; backup at
   `/opt/anqiao-crm/backup/pre-release-20260813085841/` with `database.dump`
   (SHA-256 `42358275b2f0559321483b07ff5fa11546715f8e58eefeb0c148c0d5f7c77005`)
   still valid (DB unchanged since it was taken).
3. **Widen the version column (one-time DDL)**:
   `sudo -n -u postgres psql -d anqiao_crm -X -c "ALTER TABLE alembic_version
   ALTER COLUMN version_num TYPE varchar(64);"` — verify the column is now
   `character varying(64)`.
4. **Stop service**: `sudo -n systemctl stop anqiao-crm`.
5. **Swap code**: replace live `src/ templates/ static/ migrations/
   alembic.ini pyproject.toml` with the staged release paths
   (`/opt/anqiao-crm/tmp/task0031-20260813085841/`). Do NOT touch `scripts/`,
   `shared/`, `venv/`, `backup/`.
6. **Rebuild venv at the final path (relocation-safe)**:
   `sudo -n mv /opt/anqiao-crm/venv /opt/anqiao-crm/venv-pre-release-2-<ts>`;
   `sudo -n python3.12 -m venv /opt/anqiao-crm/venv`; offline hash-enforced
   install from `/tmp/task0030/wheelhouse` with
   `/tmp/task0030/linux-requirements.lock`; `pip check` exit 0; verify
   `uvicorn` shebang is `#!/opt/anqiao-crm/venv/bin/python3.12`.
7. **Migrate database**: source `shared/database.env` (never print values) +
   `PYTHONPATH=/opt/anqiao-crm/src /opt/anqiao-crm/venv/bin/python -m alembic
   upgrade 0005_opportunity_reminders_ai_reasoning`.
8. **Start service**: `sudo -n systemctl start anqiao-crm`.
9. **Verify**: `GET /login` → 200; DB revision → `0005_opportunity_reminders_ai_reasoning`;
   `pip check` clean.
10. **Rollback on any failure**: stop service; restore old code from the
    backup archive; restore old venv; start service; verify 200. The database
    is forward-only (the migration is atomic, so a migration failure leaves the
    DB unchanged; a post-migration service failure leaves DB at 0005, which is
    additive and old-code-compatible).

## Exclusive repository write paths

- `docs/tasks/active/TASK-0032-corrected-w5-production-release.md`
- `docs/evidence/TASK-0032-W5-PRODUCTION-RELEASE-20260813.md`
- `docs/evidence/TASK-0032-DEEPSEEK-PI-EXECUTION-20260813.md`
- `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0032-W5-PRODUCTION-RELEASE.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`

All application, migration, test, dependency-declaration, SPEC, decision-log,
and other repository paths are read-only to the executor.

## Hard boundaries

- The only database DDL authorized is the single `ALTER TABLE alembic_version`
  widening; no other table, column, or schema change.
- No database restore/downgrade; no nginx/DNS/TLS change (syntax check only);
  no credential/secret/environment-value reading; no log reading/query.
- No `0006_operation_records` migration or any dirty-worktree path.
- No cleanup of backups or old artifacts; no commit/push/reset/clean/checkout.
- The loopback bind-address change is DEFERRED.

## Prerequisites and completion gate

- `alembic_version.version_num` is `character varying(64)` after the DDL.
- New venv created at the final path with correct shebangs; `pip check` 0;
  versions match the frozen lock (fastapi 0.136.3, starlette 1.6.0).
- Migration to `0005_opportunity_reminders_ai_reasoning` succeeds; DB revision
  confirmed by read-only psql.
- Service restarts and `GET /login` returns 200.
- Any failure triggers rollback; the task then ends `BLOCKED`.
- Run `git diff --check`, `git status --short`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
  The task ends `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent
  Codex review.

## Execution record (2026-08-13, DeepSeek in PI)

- Phases 1–9 completed: `ALTER TABLE alembic_version ... varchar(64)` (exit
  0); code swap; relocation-safe venv rebuild (pip check 0, shebang correct);
  `alembic upgrade 0005…` **exit 0** (0001→0002→0003→0004→0005 applied);
  service started; `GET /login` **HTTP 200**; DB revision
  `0005_opportunity_reminders_ai_reasoning`; new tables present; fastapi
  0.136.3 / starlette 1.6.0.
- Phase 10 (rollback): not needed. **W5 release complete; NOT self-accepted.**
