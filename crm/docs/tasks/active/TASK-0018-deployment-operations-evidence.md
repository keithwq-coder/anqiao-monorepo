# TASK-0018: SPEC-0012 operations and acceptance closure

- Task ID: TASK-0018
- Status: ACTIVE / ACCEPTED (local synthetic scope, `DEC-0125`)
- Task type: IMPLEMENTATION / LOCAL-OPERATIONS-EVIDENCE
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Authorization: `DEC-0089`; deployment and remote operations remain separate
  gates and are excluded here
- Implementation owner: DeepSeek-v4-flash in PI (completed sole executor
  under `DEC-0121`; requested executor label, exact runtime model identifier
  is not an acceptance criterion)
- Predecessor implementation owner: GLM5.2 (WorkBuddy; `DEC-0119`)
- Coordinator/auditor: Codex architecture owner (independent review only)
- Depends on: `TASK-0009`, `TASK-0014`, `TASK-0017`

## Goal

Close the local, fail-closed operational contracts: configuration validation,
backup/restore record model, operations audit, release rollback evidence, and
explicit separation of automated checks from human visual/business acceptance.

## Owned paths (exclusive after activation)

- `deploy/` non-secret templates and local validation scripts only
- `scripts/` bounded local health/rollback/backup evidence helpers only
- operations/audit modules under `src/crm/` if required by the approved SPEC
- focused operational tests under `tests/`
- `docs/evidence/TASK-0018-*` and this task card

No SSH, server, nginx, TLS key, DNS, systemd, production database, credential,
or deployment command is owned by this task.

## Required acceptance

- No secret is stored in code, documentation, generated evidence, or logs.
- Health/auth checks fail closed and distinguish unavailable dependencies from
  successful login or backup.
- Backup, restore rehearsal, deletion propagation status, deployment change,
  rollback, and operations audit records are durable and inspectable locally.
- Automated acceptance and product-owner browser/visual acceptance are separate
  records with no inferred human pass.

## Prerequisites and completion gate

- Prerequisites：TASK-0009 / TASK-0014 / TASK-0017 均已 ACCEPTED（满足）；
  `SPEC-0012 v0.2.0` approved 且 approval hash 匹配；`DEC-0121` 已将唯一
  实施所有权转交 DeepSeek-v4-flash in PI。现有 GLM5.2 工作区改动必须先由新
  执行者复核，不得按前执行者报告推断为通过。
- Completion gate：Required acceptance 四条全部满足；本地运维聚焦测试通过；
  全量 `pytest tests/ -q` 从 `341 passed, 28 skipped` 基线无退化；secret
  scan 无命中；governance `[PASS]`；协调员独立审计接受。远程/部署/人工
  验收一律标 `NOT VERIFIED`，不得推断为通过。

## Verification

Run local operational tests, secret scan appropriate to this repository,
`pytest tests/ -q`, and the governance check. Report remote/deployment and
human acceptance as `NOT VERIFIED`.

## Pre-transfer implementation evidence (GLM5.2 / WorkBuddy, 2026-08-10/11)

The following records are predecessor-supplied evidence, not coordinator
acceptance. DeepSeek-v4-flash in PI must inspect the actual diff and reproduce
the relevant checks before retaining or correcting these changes. The formal
handoff is
`docs/handoffs/HANDOFF-20260811-GLM52-TO-DEEPSEEKV4FLASH-PI-TASK-0018.md`.

- [VERIFIED] SPEC-0012 v0.2.0 approval SHA-256 matches the SPEC file
  (`621131c0...`) before any code was written.
- [VERIFIED] Focused operational tests: `19 passed`
  (`tests/test_task0018_operations.py`), covering all four Required
  acceptance criteria.
- [VERIFIED] `scripts/operations_evidence.py` end-to-end: 5 durable
  records (backup, restore, deployment_change, rollback×2 incl. one
  failed); fail-closed rollback failure recorded as `failed`, not
  `success`.
- [VERIFIED] `scripts/check_operations_health.py`: complete config ->
  PASS; missing password -> FAIL; unavailable DB -> UNAVAILABLE
  (distinguished from success); AI_ENABLED -> FAIL.
- [VERIFIED] Full `pytest tests/ -q`: `360 passed, 28 skipped`
  (baseline `341 passed, 28 skipped` + 19 new TASK-0018 tests; no
  regression). `test_persistence_schema.py` expected-table set updated
  to include `operation_records` (necessary schema-allowlist sync).
- [VERIFIED] Secret scan: no hits across all TASK-0018 deliverables.
- [VERIFIED] `scripts/check-governance.ps1` outputs `[PASS]`.
- [NOT VERIFIED] Remote/server/SSH/nginx/TLS/DNS/systemd — out of scope.
- [NOT VERIFIED] Production database backup/restore — local SQLite
  synthetic only.
- [NOT VERIFIED] Human visual/business acceptance — separate; not
  inferred from automated checks.

Deliverables:
- `src/crm/persistence/models.py` (OperationRecordModel, +55 lines)
- `migrations/versions/0006_operation_records.py`
- `src/crm/persistence/operation_repository.py`
- `scripts/check_operations_health.py`
- `scripts/operations_evidence.py`
- `tests/test_task0018_operations.py` (19 tests)
- `docs/evidence/TASK-0018-IMPLEMENTATION.md`

Status: ownership transferred; predecessor implementation is not accepted.
DeepSeek-v4-flash in PI owns one bounded reconciliation/implementation pass,
followed by Codex independent review. No executor may self-ACCEPT this task.

## Self-verification note (DeepSeek-v4-flash in PI, 2026-08-11)

Factual record of the single reconciliation/implementation pass; NOT
acceptance and no ownership change. Full evidence:
`docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md`.

- [VERIFIED] All predecessor checks reproduced (focused tests, evidence
  script, health check fail-closed paths, schema/migration tests).
- [VERIFIED] One material defect found and corrected within owned scope:
  Required acceptance 3 / SPEC-0012 R-005/AC-005/§8 require **deletion
  propagation status** records (propagated or marked incomplete, never
  success when unverified). Added `deletion_propagation` to the
  operation-record model, migration 0006, repository, evidence script, and
  focused tests. Evidence script now produces 7 durable records covering all
  five operation types, including a verified propagation (`success`) and an
  incomplete propagation (`unverified`, no `completed_at`).
- [VERIFIED] Focused TASK-0018 tests: `22 passed` (was 19).
- [VERIFIED] Full `pytest tests/ -q`: `363 passed, 28 skipped` (baseline
  `341 passed, 28 skipped`; predecessor `360 passed, 28 skipped`; +3 new
  deletion-propagation tests; no regression).
- [VERIFIED] Scoped no-secret scan: no hits across all TASK-0018
  deliverables.
- [VERIFIED] `scripts/check-governance.ps1` outputs `[PASS]` (exit 0);
  `git diff --check` clean.
- [VERIFIED] PI runtime model identifier exposed: `PI_MODEL=deepseek-v4-flash`,
  `PI_PROVIDER=deepseek`.
- [NOT VERIFIED] Remote/SSH/nginx/TLS/DNS/systemd, production database
  backup/restore, real deletion propagation, PostgreSQL-gated migration
  round-trip, and product-owner visual/business acceptance — unchanged
  boundaries; not inferred from local checks.

Status: awaiting Codex independent review; the task is NOT accepted by this
note.

## Independent acceptance (Codex, 2026-08-12)

- [VERIFIED] Codex independently inspected the working tree, actual
  implementation and correction files, approval hash, executor evidence, and
  task report, then reran focused tests, migration/schema tests, the operations
  evidence helper, PASS/FAIL/UNAVAILABLE health paths, the full test suite,
  `git diff --check`, and the governance checker.
- [VERIFIED] Result: `27 passed` focused; `7 passed, 1 skipped` schema/migration;
  `368 passed, 28 skipped, 1 warning` full suite; governance `[PASS]`.
- [VERIFIED] The correction proves file-backed source durability and a fresh
  restore-database query, and migration test coverage now explicitly includes
  `operation_records`.
- [NOT VERIFIED] The PostgreSQL-gated migration round trip, remote/deployment
  behavior, production/shared backup or real deletion propagation, live
  rollback, and product-owner visual/business acceptance remain outside the
  accepted local synthetic scope.

Status: ACCEPTED for local synthetic operations evidence only. Independent
acceptance evidence: `docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.

## Correction-pass self-verification note (DeepSeek in PI, 2026-08-12)

Factual record of the single consolidated correction pass (authority
`DEC-0122`/`DEC-0123`; handoff
`docs/handoffs/HANDOFF-20260811-GLM52-TASK-0018-CONSOLIDATED-REMEDIATION.md`).
NOT acceptance; no ownership change. Full evidence:
`docs/evidence/TASK-0018-DEEPSEEK-PI-CORRECTION-20260812.md`.

- [VERIFIED] The evidence script (`scripts/operations_evidence.py`) is
  file-backed SQLite (`sqlite:///` + on-disk path, no `StaticPool`), performs
  a real restore rehearsal into a separate fresh database and verifies the
  seeded `ops_admin` record from the restored database, and lists the seven
  operation records after closing and reopening the source file with a fresh
  engine. Runtime probe confirmed on-disk files and fresh-reopen reads.
- [VERIFIED] Added five regression tests (`TestFileBackedRestoreAndDurability`
  in `tests/test_task0018_operations.py`) that fail under the old
  in-memory/JSON-key semantics: restored data readable from a fresh restored
  database; records survive close/reopen of the source database; missing,
  corrupt, and key-only backups are never a successful restore. Old-semantics
  simulation executed (exit 0) shows all three failure modes.
- [VERIFIED] `operation_records` added to `USER_TABLES` in
  `tests/test_migrations.py`; schema/migration tests `7 passed, 1 skipped`
  (the skip remains the environment-gated PostgreSQL round-trip).
- [VERIFIED] Focused tests `27 passed`; full `pytest tests/ -q`:
  `368 passed, 28 skipped, 1 warning` (baseline `341 passed, 28 skipped`;
  prior pass `363 passed, 28 skipped`; +5 new tests, no regression).
- [VERIFIED] Health check synthetic paths: PASS exit 0, FAIL exit 1
  (missing secrets, values hidden), UNAVAILABLE exit 2 (unreachable DB),
  distinguished from success.
- [VERIFIED] Scoped no-secret scan: no hits (rg exit 1).
- [VERIFIED] `scripts/check-governance.ps1` outputs `[PASS]` (exit 0);
  `git diff --check` clean (pre-existing LF/CRLF warnings only).
- [NOT VERIFIED] PostgreSQL-gated migration round-trip
  (`CRM_RUN_POSTGRESQL_TESTS` unset — test skipped, not run).
- [NOT VERIFIED] Remote/SSH/nginx/TLS/DNS/systemd, production/shared
  database backup/restore, real deletion propagation, live rollback, and
  product-owner visual/business acceptance — unchanged boundaries.

Status: awaiting Codex independent review; the task is NOT accepted by this
note.
