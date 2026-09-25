# TASK-0018 independent repository acceptance (2026-08-12)

- Task ID: TASK-0018
- Status: PASSED / ACCEPTED for the local synthetic scope only
- Review verdict: `APPROVE_AND_DISPATCH_NEXT_TASK`
- Architecture/review owner: Codex, requested GPT-5.6-sol role
- Implementation executor reviewed: DeepSeek in PI; exact runtime label remains
  executor-reported only and is not an acceptance criterion
- Authority: `SPEC-0012 v0.2.0`, `DEC-0089`, `DEC-0121`, `DEC-0122`,
  `DEC-0123`, and `DEC-0124`
- Review date: 2026-08-12 Asia/Shanghai

## Scope and decision boundary

This is an independent review of the completed DeepSeek correction pass, not a
restatement of the executor report. It accepts only the task card's local,
synthetic operations-evidence scope. It does not accept remote operations,
deployment, a production or shared database, real data, credentials, external
writes, commits, or pushes.

## Repository facts inspected

- [VERIFIED] The approved SPEC file hash equals its approval metadata hash:
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`.
- [VERIFIED] `docs/specs/SPEC-BASELINE.md` declares `Status: COMPLETE`; its
  implementation gate remains limited to specifically authorized synthetic-data
  tasks.
- [VERIFIED] `docs/tasks/active/TASK-0018-deployment-operations-evidence.md`
  names the approved SPEC, scope, exclusive paths, verification, and DeepSeek
  ownership under `DEC-0121`.
- [VERIFIED] The worktree is dirty on `main`. Existing unrelated governance
  edits and all untracked files were preserved. No commit, reset, clean, delete,
  push, deployment, remote access, or real-data action was performed in this
  review.
- [VERIFIED] The actual correction paths contain five new file-backed restore
  regression tests and `operation_records` in the migration test table set.
  The implementation paths were inspected directly: the evidence helper uses
  a file SQLite URL, creates a separate restore database, verifies `ops_admin`
  from that database, then reopens the source database through a fresh engine.

## Independent checks rerun

| Check | Actual result | Scope boundary |
|---|---|---|
| `.venv\\Scripts\\python.exe -m pytest tests/test_task0018_operations.py -q` | Exit 0; `27 passed` | Local synthetic SQLite only |
| `.venv\\Scripts\\python.exe scripts/operations_evidence.py` | Exit 0; 7 records: backup, restore, verified and unverified deletion propagation, deployment change, failed rollback, successful rollback | Temporary local SQLite/files only |
| `.venv\\Scripts\\python.exe -m pytest tests/test_persistence_schema.py tests/test_migrations.py -q` | Exit 0; `7 passed, 1 skipped` | PostgreSQL round trip was correctly skipped |
| `.venv\\Scripts\\python.exe -m pytest tests -q` | Exit 0; `368 passed, 28 skipped, 1 warning` | Local test environment only |
| Health check, complete synthetic configuration | Exit 0; `RESULT: PASS`; secret values shown as hidden | No DB probe |
| Health check, missing password and session secret | Exit 1; `RESULT: FAIL`; no secret value printed | Fail-closed path |
| Health check, unreachable synthetic DB with `--probe-database` | Exit 2; `RESULT: UNAVAILABLE` | Dependency-unavailable path, not a remote check |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | Exit 0; `[PASS]`, 8 approved SPECs, 19 active tasks | Governance structure |
| `git diff --check` | Exit 0; no whitespace errors; only pre-existing LF/CRLF warnings | Current dirty worktree |

## Acceptance mapping

| Required acceptance | Independent finding |
|---|---|
| No secret in code, evidence, or logs | [VERIFIED] The focused no-secret tests pass; the health script prints `value hidden`; review output contains only synthetic placeholders. |
| Fail closed and distinguish unavailable | [VERIFIED] PASS, FAIL, and UNAVAILABLE produce distinct outcomes and exit codes 0, 1, and 2. |
| Backup/restore/deletion propagation/deployment/rollback audit is durable and inspectable locally | [VERIFIED] The source and restore databases are file-backed; a fresh source reopen has 7 records; a fresh restore-database query finds `ops_admin`; missing, corrupt, and key-only backups return failure. The unverified propagation record has no `completed_at`. |
| Automated and human acceptance stay separate | [VERIFIED] Local automated evidence is labelled local only. The task card and executor evidence retain product-owner visual/business acceptance as `NOT VERIFIED`. |

## Decision

TASK-0018 is accepted for its explicit local synthetic scope. The material
defects in the prior audit are corrected: persistence/restore proof is no
longer an in-memory or JSON-key-only assertion, and the PostgreSQL-gated test
explicitly expects `operation_records` when that separate environment is
available. The executor report was corroborated by repository inspection and
independent reruns.

## Not verified

- PostgreSQL upgrade/downgrade/upgrade round trip for `operation_records`:
  `CRM_RUN_POSTGRESQL_TESTS` is unset, so the isolated test is skipped.
- Remote/server/SSH/nginx/TLS/DNS/systemd behavior.
- Production/shared-database backup and restore, real deletion propagation, and
  live rollback.
- Product-owner browser, visual, and business acceptance.

These remain outside TASK-0018's accepted scope and must not be inferred from
the local synthetic checks above.
