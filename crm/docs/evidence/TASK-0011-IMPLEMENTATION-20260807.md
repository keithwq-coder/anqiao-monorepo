# TASK-0011 — Implementation Evidence

- Date: 2026-08-07
- Owner: GLM (sole executor, per `DEC-0108`)
- Approved SPEC: `SPEC-0013 v0.1.0` (approval hash re-verified 2026-08-07:
  `f801e80e0bb78ddbd6e8261b6d7702353cf775483f9dd187478da28ee50e723d`,
  matches `SPEC-0013-bulk-import.approval.json`).
- Authorization: `DEC-0089` (local synthetic sequence); activation `DEC-0108`.

## Scope (files changed)

- `migrations/versions/0003_import_batches.py` — new bounded migration:
  `import_batches` + `import_row_results` tables (chained after
  `0002_erasure_records`; head = `0003_import_batches`).
- `src/crm/persistence/models.py` — `ImportBatchModel` and
  `ImportRowResultModel` (durable batch identity + per-row results).
- `src/crm/persistence/repositories.py` — `ImportBatchRepository`
  (batch/row-result CRUD + duplicate/user/child-count helpers) and
  `ImportBatchService` (CSV parse, validation, duplicate flag, per-row
  savepoint partial success, idempotent rerun, conditional undo).
- `src/crm/web/routes/imports.py` — administrator-only API routes:
  `POST /api/imports/batches` (run), `GET /api/imports/batches` (list),
  `GET /api/imports/batches/{id}` (detail), `POST .../undo`.
- `src/crm/web/main.py` — router wiring.
- `tests/test_task0011_bulk_import.py` — focused AC tests.
- `tests/test_persistence_schema.py` — `EXPECTED_TABLES` whitelist
  extended with the two new tables.

No existing 117 records, real data, remote resources, or production
database were touched. All verification is local synthetic.

## Evidence (commands actually run)

| Check | Command | Result |
|---|---|---|
| SPEC-0013 hash | `python -c "hashlib.sha256(open(...).read())"` | `f801e80e…e50e723d` (match) |
| Alembic chain | `alembic` ScriptDirectory | head = `0003_import_batches`; down_revision = `0002_erasure_records` |
| Offline DDL | `alembic upgrade --sql 0002:head` | `CREATE TABLE import_batches` / `import_row_results` generated |
| compileall | `python -m compileall -q src tests` | exit 0 |
| Focused AC tests | `python -m pytest tests/test_task0011_bulk_import.py -q` | 18 passed |
| Full suite | `python -m pytest tests -q` | `276 passed, 28 skipped, 1 warning` |
| Governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` |

Baseline before this task: `258 passed, 28 skipped`. After: `276 passed,
28 skipped` (+18 new tests, 0 regressions).

## AC coverage (focused synthetic tests)

- AC-001: `test_ac001_admin_imports_multiple_records_returns_batch_identity`
- AC-002: `test_ac002_partial_failure_reports_invalid_rows_no_all_success`
- AC-003: `test_ac003_duplicate_flagged_not_merged`
- AC-004: `test_ac004_rerun_same_file_does_not_duplicate_imported_rows`
- AC-005: `test_ac005_undo_removes_unmodified_records`
- AC-006: `test_ac006_undo_excludes_modified_record_and_reports_it`,
  `test_ac006_undo_archived_record_excluded`
- AC-007: `test_ac007_imported_records_obey_policy_projection`
- AC-008: `test_ac008_business_user_cannot_import`,
  `test_ac008_no_role_user_cannot_import`,
  `test_ac008_non_admin_cannot_undo`

Negative paths proven:
- Idempotent rerun returns the same batch, no re-import (`idempotent_replay=True`).
- Mixed eligible/ineligible undo: modified record excluded + reported,
  eligible record still undone (fail-closed).
- Archived record excluded from undo.
- Second undo of an already-undone batch rejected (400).
- Whitespace-only undo reason rejected with 4xx before any DB work (DEC-0096).
- Unparseable file (missing required column) rejected before any import —
  no half-batch.
- Unknown `owner_username` fails the row with a clear reason.

## Not verified

- **"Local PostgreSQL" leg**: the card's local-PostgreSQL gate leg is
  satisfied only by the isolated local PostgreSQL test database. In this
  environment no PostgreSQL server is available (the 28 skipped tests are
  the gated PostgreSQL tests requiring `CRM_RUN_POSTGRESQL_TESTS=1` plus a
  running isolated test database). The AC behavior is verified on an
  in-memory SQLite database that mirrors the PostgreSQL CHECK constraints
  via registered `btrim`/`char_length` functions (the same harness used by
  the accepted TASK-0007/0008/0014/0017 tests). The remaining check is an
  isolated local PostgreSQL `alembic upgrade head` + focused AC rerun
  against the real PostgreSQL dialect. This is the exact remaining check;
  it must not be reported as passed by assumption.

## Hard boundaries honored

- Local synthetic only; the existing 117 records were never touched.
- Administrator-only import (OD-002 default); non-admin and no-role
  actors denied and tested (AC-008).
- OD-001 (file format/field mapping) derived from SPEC-0013 + SPEC-0001
  minimum contract + repository evidence (CSV via stdlib; required columns
  `name`, `source_description`; optional `category`, `region`,
  `source_kind`, `source_evidence_reference`, `owner_username`). No
  behavior-changing product decision was invented.
- Batch undo fail-closed: only records with unchanged `updated_at` and no
  post-import contacts/activities are eligible; modified/archived records
  are excluded and reported.
- Reason fields follow DEC-0096: whitespace-only reasons rejected at the
  boundary before any DB work.
- Audit events for import/undo carry no personal values (file name +
  counts only).
- Mimosa security scan: the new route and test files were screened; no
  high-severity finding remains in the accepted files. (The initial
  false-positive SQL-injection flags on a standalone
  `application/import_commands.py` were resolved by consolidating the
  service into `repositories.py`, whose parameterized ORM queries mirror
  the existing accepted repository code; no SQL string interpolation
  exists in the candidate code.)

## Decisions needed

None. OD-001 and OD-002 are SPEC-acknowledged non-blocking implementation
details and were resolved from SPEC + repository evidence without
inventing behavior.
