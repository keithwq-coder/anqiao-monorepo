# TASK-0018: SPEC-0012 Deployment Operations Evidence — Implementation Report

> **Supersession addendum (2026-08-11, DeepSeek-v4-flash in PI)** — This is the
> historical GLM5.2/WorkBuddy record. The DeepSeek reconciliation pass
> (DEC-0121) reproduced its checks, found one material gap, and corrected it:
> the task card's Required acceptance 3 and SPEC-0012 R-005/AC-005/§8 require
> **deletion propagation status** records (propagated to backup or marked
> incomplete, never success when unverified), which the predecessor
> implementation did not cover. The corrected state adds a
> `deletion_propagation` operation type and evidence. Consequently the
> figures in this file (19 focused tests, 5 evidence records, 360 passed /
> 28 skipped full suite) describe the pre-correction state and are superseded
> by `docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md` (22 focused
> tests, 7 evidence records, 363 passed / 28 skipped). The DeepSeek evidence
> file is the current factual record; this file remains valid only as
> predecessor history.

- Task ID: TASK-0018
- SPEC: SPEC-0012 v0.2.0 (SHA-256 verified: `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`)
- Owner: GLM5.2 / WorkBuddy (DEC-0119)
- Date: 2026-08-10
- Git baseline: commit `59101b8`

## Summary

Closed the local fail-closed operational contracts for SPEC-0012 using
purely local synthetic evidence. No SSH, server, nginx, TLS key, DNS,
systemd, production database, or credential was touched.

## SPEC approval verification

- [VERIFIED] `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
  SHA-256 = `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`
- [VERIFIED] `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
  records `spec_sha256` = `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`
- [VERIFIED] The two hashes match (verified via `sha256sum` before any
  code was written).

## Deliverables

### 1. Operation record data model + migration

- `src/crm/persistence/models.py` — added `OperationRecordModel`
  (table `operation_records`). Fields: `id`, `operation_type`
  (backup/restore/deployment_change/rollback), `actor_user_id` (FK to
  `user_identities`), `action`, `target_description`, `outcome`
  (success/failed/unverified), `detail_summary`, `failure_summary`,
  `occurred_at`, `completed_at`. CHECK constraints enforce:
  - `operation_type IN ('backup','restore','deployment_change','rollback')`
  - `outcome IN ('success','failed','unverified')`
  - `action` and `target_description` non-blank
  - `completed_at` is NULL iff outcome = 'unverified'
  - `failure_summary` is NULL when outcome = 'success' (fail-closed)
- `migrations/versions/0006_operation_records.py` — Alembic migration
  creating the `operation_records` table with the same CHECK
  constraints, FK, and indexes. `down_revision = 0005_opportunity_reminders_ai_reasoning`.

### 2. Operations audit repository

- `src/crm/persistence/operation_repository.py` —
  `OperationRecordRepository` with `record()` and `list_by_type()`.
  Validates operation_type, outcome, and fail-closed invariants
  (success has no failure_summary; non-unverified requires completed_at)
  before any database round trip. Never stores secrets.

### 3. Fail-closed configuration health check

- `scripts/check_operations_health.py` — validates runtime configuration
  readiness. Fail-closed semantics:
  - Missing `DATABASE_PASSWORD` or `SESSION_SECRET_KEY` -> FAIL (exit 1)
  - `AI_ENABLED=true` -> FAIL (external AI not authorized)
  - Invalid `CRM_ENVIRONMENT` -> FAIL
  - Database unreachable (when `--probe-database`) -> UNAVAILABLE
    (exit 2), distinguished from FAIL and PASS
  - Complete config -> PASS (exit 0)
  - The password value is never printed ("value hidden" marker).

### 4. Backup/restore/rollback evidence helper

- `scripts/operations_evidence.py` — local SQLite synthetic sequence:
  1. Seed admin user
  2. Take backup -> record success
  3. Restore rehearsal -> verify -> record result
  4. Deployment change -> record success
  5. Failed rollback attempt -> record failure (fail-closed)
  6. Successful rollback after remediation -> record success
  7. List all 5 records for inspection
  Produces durable, locally inspectable evidence. No secret stored.

### 5. Focused operational tests

- `tests/test_task0018_operations.py` — 19 tests covering all four
  Required acceptance criteria:
  - `TestFailClosedHealthCheck` (4 tests): missing password fails closed;
    complete config passes; unavailable dependency distinguished from
    success; AI enabled is fail-closed.
  - `TestOperationRecordsDurable` (5 tests): backup, restore, deployment
    change + rollback, failed operation not recorded as success, records
    inspectable by type and actor.
  - `TestOperationRepositoryValidation` (4 tests): success+failure_summary
    rejected; non-unverified without completed_at rejected; invalid type
    rejected; invalid outcome rejected.
  - `TestNoSecretsInEvidence` (3 tests): evidence script uses placeholders;
    health check never prints password; model has no secret field.
  - `TestAcceptanceSeparation` (2 tests): automated checks do not infer
    human pass; unverified is distinct from success.
  - `TestOperationsEvidenceScript` (1 test): end-to-end script produces 5
    durable records with no secret values.

## Required acceptance coverage

| Acceptance | How covered | Evidence |
|---|---|---|
| No secret in code/docs/evidence/logs | `TestNoSecretsInEvidence`; scripts use placeholders; model has no secret field; health check never prints password | `tests/test_task0018_operations.py`, `scripts/*.py`, `src/crm/persistence/operation_repository.py` |
| Fail-closed; distinguish unavailable from success | `TestFailClosedHealthCheck`; health check returns FAIL/UNAVAILABLE/PASS with distinct exit codes | `scripts/check_operations_health.py` |
| Backup/restore/deployment/rollback records durable & inspectable | `TestOperationRecordsDurable`; `OperationRecordModel` + migration; `operations_evidence.py` end-to-end | `migrations/versions/0006_operation_records.py`, `scripts/operations_evidence.py` |
| Automated vs human acceptance separate; no inferred pass | `TestAcceptanceSeparation`; `unverified` outcome distinct from `success`; detail_summary explicitly marks human acceptance NOT VERIFIED | `tests/test_task0018_operations.py` |

## Verification results

### Focused operational tests

```
.venv/Scripts/python.exe -m pytest tests/test_task0018_operations.py -q
...................                                                      [100%]
19 passed in 12.66s
```

- [VERIFIED] 19 passed, 0 failed.

### Operations evidence script

```
.venv/Scripts/python.exe scripts/operations_evidence.py
  Records written: 5
  [   success] restore              synthetic_restore_rehearsal
  [   success] deployment_change    synthetic_config_update
  [    failed] rollback             synthetic_rollback_attempt
  [   success] rollback             synthetic_rollback_completed
  [   success] backup               synthetic_full_backup
RESULT: PASSED — all operation records durable and inspectable
```

- [VERIFIED] Script exits 0; 5 records produced; fail-closed rollback
  failure recorded as `failed`, not `success`.

### Health check script (complete config)

```
RESULT: PASS
```

- [VERIFIED] Complete config -> PASS; password value hidden.

### Full test suite (no regression)

```
.venv/Scripts/python.exe -m pytest tests/ -q
360 passed, 28 skipped, 1 warning in 70.14s
```

- [VERIFIED] Baseline was `341 passed, 28 skipped`. New total is
  `360 passed, 28 skipped` (341 + 19 new TASK-0018 tests). No
  pre-existing test regressed; one schema-allowlist test
  (`test_metadata_contains_only_the_s2_tables`) was updated to include
  the new `operation_records` table — a necessary sync of the expected
  table set, not a weakening.

### Secret scan

- [VERIFIED] Scanned all TASK-0018 deliverables for hardcoded secrets
  (password/secret/token assignments, API keys, private key blocks).
  No hits. All synthetic values use `synthetic`/`placeholder`/`t18-`
  markers and are set via environment variables at runtime.

### Governance check

```
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 8
  - Active tasks: 18
  - Legacy manifests checked: 1
```

- [VERIFIED] `[PASS]`.

## NOT VERIFIED items (per task hard boundaries)

- [NOT VERIFIED] Remote server / SSH / nginx / TLS / DNS / systemd —
  out of scope; no remote resource touched.
- [NOT VERIFIED] Production database backup/restore — only local SQLite
  synthetic rehearsal was run.
- [NOT VERIFIED] Human visual / business acceptance by product owner —
  explicitly separate; not inferred from automated checks.
- [NOT VERIFIED] Real deployment rollback on a live server — only
  local synthetic rollback evidence.

## Git diff range

Baseline: commit `59101b8`

Modified (tracked):
- `src/crm/persistence/models.py` (+55 lines: `OperationRecordModel`)
- `tests/test_persistence_schema.py` (+1 line: `operation_records`
  added to `EXPECTED_TABLES` — necessary sync of the schema allowlist
  for the new table)

New (untracked):
- `migrations/versions/0006_operation_records.py`
- `scripts/check_operations_health.py`
- `scripts/operations_evidence.py`
- `src/crm/persistence/operation_repository.py`
- `tests/test_task0018_operations.py` (19 tests)
- `docs/evidence/TASK-0018-IMPLEMENTATION.md` (this file)

No other files were modified. No approved SPEC, no other task's
migration, and no other task's evidence was touched.

