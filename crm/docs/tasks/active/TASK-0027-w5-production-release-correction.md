# TASK-0027: W5 bounded production release correction

- Task ID: TASK-0027
- Status: ACTIVE / **EXECUTED 2026-08-12 — BLOCKED at remote precondition 6
  (runtime venv `pip check` failed) before any production mutation — AWAITS
  CODEX INDEPENDENT REVIEW**
- Task type: DEPLOYMENT / VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0133`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-12 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Release source: exact committed tree
  `59101b80b6420155bf8aec26b14ea7800979db86`
- Depends on: TASK-0023 G6 planning acceptance, TASK-0026 no-log preflight,
  and explicit TASK-0027 authorization `DEC-0133`

## Goal

Publish one bounded correction of the CRM currently served by `anqiao-crm`
without releasing any local dirty-worktree content, while retaining a
metadata-verified backup before the first production write. The task does not
claim full production acceptance or a proven restore rehearsal.

## Authorized scope

1. Use strict non-interactive SSH to the established target only after the
   current identity, host, service metadata, runtime-file metadata, nginx
   syntax, and database revision match this task's preconditions.
2. Create exactly one new `0700` timestamped directory under
   `/opt/anqiao-crm/backup/pre-task0027-*` containing:
   - a PostgreSQL custom-format dump of `anqiao_crm`, owned/readable only by
     `postgres` or root;
   - a tar archive of only the current CRM runtime code/config path allowlist;
   - a manifest of file names, sizes, checksums, dump checksum, and
     `pg_restore --list` metadata. No backup content or business values may be
     printed or copied into the repository.
3. Build, hash, transfer, and stage only this source allowlist from commit
   `59101b80b6420155bf8aec26b14ea7800979db86`:
   `src/`, `templates/`, `static/`, `migrations/`, `alembic.ini`,
   `pyproject.toml`, `deploy/start.sh`, `deploy/anqiao-crm.service`, and
   `deploy/nginx_crm.conf`.
4. Replace only the corresponding runtime paths beneath `/opt/anqiao-crm`.
   Do not use an operation that deletes unlisted paths. The sole permitted
   deviation from the committed payload is changing the Uvicorn bind argument
   in the deployed `scripts/start.sh` from `0.0.0.0` to `127.0.0.1`; record
   the exact post-change checksum.
5. With the pre-existing runtime environment consumed only inside a
   non-echoing subshell, run Alembic from exactly
   `0001_initial_schema` through `0005_opportunity_reminders_ai_reasoning`.
   Then restart only `anqiao-crm` and perform no-body GET liveness checks for
   loopback and public HTTPS `/health` plus listener/config metadata checks.

## Exclusive local write paths

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0027-w5-production-release-correction.md`
- `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`
- `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md`

All other repository paths are read-only to the executor. In particular, do
not edit the decision log, handoff, approved SPECs, application code, tests,
migrations, deployment templates, or any TASK-0018/TASK-0022 through TASK-0026
artifact locally.

## Hard boundaries

- Do not release any uncommitted file, including
  `0006_operation_records.py`, `operation_repository.py`,
  `operations_evidence.py`, or `test_task0018_operations.py`.
- Do not read, print, copy, alter, rotate, or persist a credential, secret,
  private key, runtime-environment value, cookie, session, or business-row
  value. Existing secrets may only be consumed by the non-echoing Alembic or
  service process.
- Do not run `journalctl`, `systemctl status`, `tail`, use `/var/log`, inspect
  any log file/query, or derive log counts or timestamps.
- Do not change, reload, or replace nginx; do not change DNS or TLS; do not
  install packages; do not change users/groups/permissions outside the newly
  created backup directory; do not touch another service, site, port, database,
  or host.
- Do not run `rsync --delete`, remove backups/staging paths, execute
  `pg_restore`, run an Alembic downgrade, restore the database, commit, or
  push. Do not make any real business request beyond a body-discarded unauthenticated
  `/health` GET.
- G7, full V1 verification, and R2 acceptance remain out of scope.

## Prerequisites and completion gate

Before the first production write, all of these must be true:

1. Strict SSH identity matches `ubuntu@124.222.212.159` and the expected host.
2. `anqiao-crm` is loaded/running as `ubuntu`, working from
   `/opt/anqiao-crm`; the existing runtime file is mode 600 and readable by
   that service user, without reading it.
3. The current database is `anqiao_crm` at `0001_initial_schema`; its public
   tables match the TASK-0026 baseline. Any other revision, unexpected target,
   or migration state stops the task before a write.
4. Existing `crm` nginx directives still proxy to `127.0.0.1:8200` and
   `sudo -n nginx -t` passes. nginx is not changed.
5. The current `/opt/anqiao-crm` direct-layout premise and backup parent exist;
   the source commit archive hash is recorded and matches after transfer.
6. The existing runtime venv passes `pip check`, and the staged source compiles
   and reports exactly the `0005_opportunity_reminders_ai_reasoning` Alembic
   head before any runtime path replacement.

Any failed precondition, backup/transfer checksum mismatch, migration error,
restart error, listener mismatch, or liveness failure is `BLOCKED`. The
executor may restore only the captured code archive and restart
`anqiao-crm`; it must never automatically restore or downgrade the database.
If that code-only recovery cannot complete, stop and report the exact state.

## Completion gate

The output must contain a redacted evidence record with exact commands and
exit codes, the fixed source commit/hash, backup manifest checksums and
metadata-only validation, confirmed migration revision `0005`, deployed
runtime-file checksums, post-restart loopback/public health status, listener
metadata, unchanged nginx metadata, and explicit remaining limitations.
`git diff --check` and `scripts/check-governance.ps1` must pass locally.
Codex must independently review actual repository files, Git state/diff,
release evidence, and local checks before a verdict.

## Not verified by this task

- Restoring the current production backup into an isolated database.
- Full V1 behavior, authenticated workflows, data masking, restart persistence,
  other-site user journeys, and product-owner visual/business acceptance.
- Any DNS/TLS change or long-term backup/deletion-propagation behavior.

## Execution status (2026-08-12)

TASK-0027 was executed under `DEC-0133` on 2026-08-12 and **STOPPED `BLOCKED`
at remote precondition 6 before any production mutation**: the runtime venv
`/opt/anqiao-crm/venv/bin/python -m pip check` fails deterministically
(`fastapi 0.141.0` requires `starlette>=0.46.0`, runtime has `starlette
0.44.0`; the release payload pins `fastapi==0.136.3`). Local release
preparation completed: exact-commit archive
`59101b80b6420155bf8aec26b14ea7800979db86` (SHA-256
`c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`),
extracted-tree `src/` compile OK, Alembic head
`0005_opportunity_reminders_ai_reasoning` only. All other remote
preconditions (identity, service metadata, runtime-file metadata, nginx
syntax/directives, listeners, PostgreSQL `anqiao_crm` at `0001_initial_schema`)
passed. **No backup, transfer, migration, restart, or liveness probe ran; no
production write occurred; no log command ran; no secret was accessed.**
Evidence: `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`;
execution record: `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md`.
Awaiting Codex independent review; this task does not self-accept. W5 release
execution, G7, V1, and R2 remain PENDING and separately unauthorized.
