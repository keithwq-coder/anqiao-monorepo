# TASK-0031: Codex independent review (2026-08-13)

- Status: **EXECUTION ACCEPTED as correct fail-closed (BLOCKED at migration,
  clean rollback, DB untouched); root cause CONFIRMED (char count corrected to
  39)**.
- Authority: `DEC-0139`; approved `SPEC-0012 v0.2.0`.
- Executor: DeepSeek in PI through `opencode-go/deepseek-v4-flash` (gateway
  selector only, upstream identity not asserted).
- Reviewer and acceptance decision-maker: Codex (running as
  `opencode-go/deepseek-v4-pro` in PI; gateway selector only).

## Independent repository evidence

1. [VERIFIED] HEAD is `59101b80b6420155bf8aec26b14ea7800979db86`; no new
   commit. Application/migration/test files untouched during the execution
   window. Writes confined to the TASK-0031 exclusive paths (two evidence
   files, task card, handoff, NOW.md, TASKS.md). Governance `[PASS]`
   (30 active tasks); `git diff --check` exit 0. No secret pattern in the
   TASK-0031 evidence/card files.

## Independent server verification (read-only)

1. [VERIFIED] Service healthy: `curl http://127.0.0.1:8200/login` → HTTP 200.
2. [VERIFIED] Database untouched: `alembic_version` = `0001_initial_schema`;
   public table count = 10 (the original set; no erasure_records /
   import_batches / opportunity_reminders). The executor's claim of an atomic
   rollback is correct — `migrations/env.py` wraps all migrations in a single
   transaction, so the failed `0005` update rolled back 0002–0005 together.
3. [VERIFIED] `alembic_version.version_num` is `character varying(32)`.
4. [VERIFIED] Restored venv is the original broken one (its `pip check` still
   reproduces the fastapi 0.141.0 / starlette 0.44.0 mismatch).
5. [VERIFIED] Preserved artifacts present: staged release code at
   `/opt/anqiao-crm/tmp/task0031-20260813085841/`; frozen-lock venv at
   `/opt/anqiao-crm/venv-failed-20260813085841/`; backup at
   `/opt/anqiao-crm/backup/pre-release-20260813085841/`.

## Root cause (confirmed; char count corrected)

- [VERIFIED] The 0005 revision id is exactly
  `0005_opportunity_reminders_ai_reasoning` = **39 characters** (the executor
  wrote 41; the substantive finding is unchanged: 39 > 32). All earlier
  revision ids are ≤ 26 characters and would have fit.
- [VERIFIED] Alembic creates `alembic_version.version_num` as
  `varchar(32)`; the 39-character id exceeds it, so the final version-record
  UPDATE raises `StringDataRightTruncation` on PostgreSQL.
- [INFERENCE] TASK-0029B's 341-test suite did not catch this because it runs
  on SQLite, which does not enforce `varchar` length. This is a release-payload
  defect, not an execution defect.

## Fix recommendation

Widen the bookkeeping column as a one-time DDL before re-running the migration:

```sql
ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(64);
```

This touches only alembic's one-row version table, changes no application
schema or data, leaves the reviewed release payload (`c856aa8c…`) byte-
identical, and gives permanent headroom for future verbose revision ids. It
does NOT change the release archive. (The alternative — shortening the 0005
revision id — would change the release payload and require a new archive and
re-review.)

## Verdict

`APPROVE_AND_DISPATCH_NEXT_TASK` for the bounded scope: the TASK-0031
execution was correct, within boundaries, and the mandatory rollback restored
the prior running state with the database untouched. The next corrected release
must (a) authorize and run the one-time `varchar(64)` column widening, then
(b) redo the code+venv swap (reusing the preserved artifacts), (c) re-run the
migration to `0005`, and (d) start + verify.

## Boundaries / not verified

- The `ALTER TABLE alembic_version` is a database DDL beyond the prior "forward
  alembic upgrade" scope and requires a new product-owner authorization.
- W5 release completion, G7, V1, R2 remain separately unauthorized and
  PENDING.
- The loopback bind-address change remains deferred.
