# TASK-0031: Full W5 production release (code + migration + corrected venv)

- Task ID: TASK-0031
- Status: ACTIVE / **EXECUTED 2026-08-13 — BLOCKED at database migration
  (revision-id length defect); clean rollback executed (service restored HTTP
  200, DB unchanged at 0001) — AWAITS CODEX INDEPENDENT REVIEW (NOT
  SELF-ACCEPTED)**
- Task type: DEPLOYMENT
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0139`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-13 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: `DEC-0139`; approved SPEC-0012 hash match; fixed release commit
  `59101b80b6420155bf8aec26b14ea7800979db86` (archive SHA-256
  `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`);
  TASK-0029 frozen lock + TASK-0030 `linux-requirements.lock` (39 exact
  versions) and the server-side wheelhouse at `/tmp/task0030/`; the
  TASK-0030/DEC-0138 shebang root-cause correction (venv must be created at
  the final path, not moved).

## Goal

Complete the bounded W5 production release: deploy the fixed release payload
(`59101b80…`) over the live code, migrate the database from
`0001_initial_schema` to `0005_opportunity_reminders_ai_reasoning`, replace
the broken runtime venv with the frozen-lock venv created at the final path
(relocation-safe), restart `anqiao-crm`, and verify — with a full backup
before mutation and a code+venv rollback path. Downtime is accepted (not yet
released, owner self-testing only); the goal is to remove uncontrollable
factors (dependency drift, stale venv shebangs, unversioned migration state).

## Sequential phases

1. **Local preparation (no production)**: verify SPEC-0012 hash, fixed commit,
   recreate the release archive from `git archive` of the 9 allowlisted paths
   and confirm its SHA-256 equals `c856aa8c…eb39fc9`; run governance.
2. **Server preflight (read-only)**: strict SSH identity/hostname; confirm the
   database revision is `0001_initial_schema`; confirm the service is running
   and the current venv `pip check` still fails (expected).
3. **Backup (before any mutation)**: create a mode-0700 timestamped directory
   under `/opt/anqiao-crm/backup/`; `pg_dump -Fc -d anqiao_crm`; archive the
   live code (`src/`, `templates/`, `static/`, `migrations/`, `alembic.ini`,
   `pyproject.toml`, `scripts/`); record SHA-256 checksums and a metadata
   manifest.
4. **Stage release payload**: transfer + extract the archive under a
   task-owned staging path; `python3.12 -m compileall -q <staged>/src`.
5. **Stop service**: `sudo -n systemctl stop anqiao-crm`.
6. **Swap code**: replace the live `src/ templates/ static/ migrations/
   alembic.ini pyproject.toml` with the staged release paths (old code already
   backed up in phase 3).
7. **Recreate venv at the final path (relocation-safe)**:
   `mv /opt/anqiao-crm/venv /opt/anqiao-crm/venv-pre-release-<ts>`;
   `python3.12 -m venv /opt/anqiao-crm/venv`; offline hash-enforced install
   from `/tmp/task0030/wheelhouse` with
   `/tmp/task0030/linux-requirements.lock`; `pip check` must pass; confirm
   `uvicorn` shebang is `/opt/anqiao-crm/venv/bin/python3.12`.
8. **Migrate database**: load the same environment as `start.sh` (source
   `shared/database.env`, never print values) and run
   `PYTHONPATH=/opt/anqiao-crm/src /opt/anqiao-crm/venv/bin/python -m alembic
   upgrade 0005_opportunity_reminders_ai_reasoning`.
9. **Start service**: `sudo -n systemctl start anqiao-crm`.
10. **Verify**: HTTP health check (`GET /login` → 200); read-only database
    revision check (`alembic_version` = `0005_opportunity_reminders_ai_reasoning`);
    `pip check` clean.
11. **Rollback on any failure**: stop service; restore old code from the
    backup archive; restore old venv (`venv` → `venv-failed-<ts>`,
    `venv-pre-release-<ts>` → `venv`); start service; verify 200. The database
    is forward-only (downgrade/restore is separately authorized; the pg_dump
    exists).

## Exclusive repository write paths

- `docs/tasks/active/TASK-0031-full-w5-production-release.md`
- `docs/evidence/TASK-0031-W5-PRODUCTION-RELEASE-20260813.md`
- `docs/evidence/TASK-0031-DEEPSEEK-PI-EXECUTION-20260813.md`
- `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0031-W5-PRODUCTION-RELEASE.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`

All application, migration, test, dependency-declaration, SPEC, decision-log,
and other repository paths are read-only to the executor.

## Hard boundaries

- No DNS/TLS change; nginx syntax check only (no edit/reload).
- No credential/secret/environment-value reading; `shared/database.env` is
  sourced (like `start.sh` does) but never printed.
- No log reading/query (`journalctl`, `systemctl status`, `tail`, `/var/log`).
- No database restore/downgrade; no cleanup of backups or old artifacts; no
  commit/push/reset/clean/checkout.
- No `0006_operation_records` migration or any dirty-worktree path enters the
  payload.
- The loopback bind-address change is DEFERRED (not part of this task).

## Prerequisites and completion gate

- Release archive SHA-256 equals `c856aa8c…eb39fc9`; staged source compiles;
  `alembic heads` from the staged tree reports only
  `0005_opportunity_reminders_ai_reasoning`.
- Backup directory contains `database.dump` + code archive, each with a
  recorded SHA-256.
- New venv created at `/opt/anqiao-crm/venv` (final path) with correct
  shebangs; `pip check` exits 0; versions match the frozen lock (fastapi
  0.136.3, starlette 1.6.0).
- Database revision after migration is `0005_opportunity_reminders_ai_reasoning`
  (read-only check).
- Service restarts and `GET /login` returns 200.
- Any failure triggers rollback; the task then ends `BLOCKED`.
- Run `git diff --check`, `git status --short`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
  The task ends `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent
  Codex review.

## Execution record (2026-08-13, DeepSeek in PI)

- Phases 1–7 completed (archive sha256 `c856aa8c…`; backup; staged compile;
  service stop; code swap; relocation-safe venv with correct shebangs;
  `alembic heads` = 0005 only).
- **Phase 8 BLOCKED**: `alembic upgrade 0005…` exit 1 —
  `StringDataRightTruncation: value too long for type character varying(32)`
  (revision id 41 chars > varchar(32) on `alembic_version`). env.py wraps all
  migrations in one transaction, so the upgrade rolled back atomically; DB
  unchanged at `0001_initial_schema` (verified).
- **Phase 11 rollback executed**: old code + old venv restored; service HTTP
  200; DB still 0001. Preserved for a corrected next attempt: staged code at
  `/opt/anqiao-crm/tmp/task0031-20260813085841/`, frozen venv at
  `/opt/anqiao-crm/venv-failed-20260813085841/`, backup at
  `/opt/anqiao-crm/backup/pre-release-20260813085841/`.
- Defect root: alembic's default `version_num varchar(32)` vs a 41-char
  revision id; SQLite tests do not enforce varchar length, so TASK-0029B's 341
  tests did not catch it. Fix (widen column or relabel revision) needs separate
  authorization. **Not self-accepted.**
