# TASK-0011: SPEC-0013 batch-import capability

- Task ID: TASK-0011
- Status: ACTIVE / **ACCEPTED** (`DEC-0109`, coordinator independent audit 2026-08-08)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0013-bulk-import.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0013-bulk-import.approval.json`
  (hash re-verified 2026-08-06, match)
- Also governed by: `SPEC-0001`, `SPEC-0002`, `SPEC-0011`
- Implementation authorized by: `DEC-0089` (local synthetic implementation
  sequence only)
- Authorization evidence: product owner request recorded by `DEC-0089`
- Implementation owner: GLM (sole executor, per `DEC-0108`; supersedes the
  original DeepSeek proposal; active on handoff acceptance)
- Owner model: executor self-report or UNKNOWN
- Coordinator/auditor: current coordinator
- Audit started at: not started
- Audit last updated: 2026-08-06
- Depends on: `TASK-0007` (ACCEPTED, `DEC-0067`), `TASK-0008` (ACCEPTED,
  `DEC-0081`), `TASK-0009` (ACCEPTED, `DEC-0092`), `TASK-0017` (ACCEPTED,
  `DEC-0107`); activation `DEC-0108`

## Goal

Implement the reusable administrator batch-import product capability required by
`SPEC-0013`, separately from the already executed one-time Suzhou data load.

## Scope

- SPEC rules: `SPEC-0013` R-001 through R-009.
- Acceptance criteria: `SPEC-0013` AC-001 through AC-008.
- Owned files/directories:
  - new bounded application/import service and repository code;
  - narrowly required import batch/row-result persistence and migration;
  - administrator import route/page;
  - parser/mapping, duplicate-flag, idempotency, partial-failure, and undo tests;
  - `docs/evidence/TASK-0011-*` and this task card.

## Non-goals

- No new real-data import, re-import, cleanup, or modification of the existing
  117 records without separate immediate authorization.
- No search, export, external integration, or automatic source collection.
- No silently treating source-name deduplication as the approved duplicate
  review behavior.

## Assumptions and unknowns

- [VERIFIED] The prior temporary script did not implement stable batch identity,
  row results, duplicate flags, idempotent rerun, or conditional batch undo.
- [VERIFIED] The temporary script did not use per-row savepoints and silently
  skipped duplicates, so its counters cannot establish the SPEC partial-failure
  and duplicate-review contracts.
- [VERIFIED] The existing 117-row operation was separately ratified by
  `DEC-0058`; that decision does not prove the product capability.
- [UNKNOWN] The final approved file format/field mapping must be derived from
  `SPEC-0013` OD resolutions and current implementation evidence. If a product
  decision remains open, return the SPEC to review rather than inventing it.

## Prerequisites and completion gate

- Prerequisites: core identity/workflow/test baseline passes; product owner
  explicitly authorizes TASK-0011; any remaining behavior-changing import
  decision is resolved in an approved SPEC revision. Authorization and
  dependency gates are met (`DEC-0067`, `DEC-0081`, `DEC-0089`, `DEC-0092`,
  `DEC-0107`, `DEC-0108`). `OD-001`/`OD-002` are SPEC-acknowledged
  non-blocking implementation details: derive the mapping from the SPEC and
  repository evidence, default to administrator-only import, and return the
  SPEC to review if a behavior-changing decision is found missing.
- Exact output: durable batch + row-result model, administrator-only import,
  duplicate flags, partial success, idempotent rerun, and conditional undo.
- Completion gate: all `SPEC-0013` acceptance criteria pass with synthetic
  files; rerun/undo negative paths are proven; full
  `pytest tests/ -q` passes without regression from the `258 passed,
  28 skipped` baseline; governance `[PASS]`; coordinator independent audit
  accepts. The "local PostgreSQL" leg is satisfied only by the isolated
  local PostgreSQL test database; if unavailable, mark it NOT VERIFIED with
  the exact remaining check — never report success by assumption
  (`DEC-0108`). Real-data execution remains separately blocked.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | Task authorized | Resolve/import contract and schema facts | Contract map | No behavior-changing UNKNOWN remains | PASSED |
| 2 | Step 1 passed | Implement batch and row-result persistence | Durable import state | Migration + repository tests | PASSED |
| 3 | Step 2 passed | Implement parsing, validation, duplicate flag, partial success, idempotency | Import service | Synthetic file tests | PASSED |
| 4 | Step 3 passed | Implement conditional batch review/undo | Admin workflow | Modified/unmodified undo tests | PASSED |
| 5 | Step 4 passed | Run full integration and independent review | Evidence + verdict | All ACs pass; no unresolved P0/P1 | PASSED (awaiting coordinator audit) |

## Risks and rollback

- Batch undo can delete records that have entered normal work if modification
  state is computed incorrectly. Fail closed and test mixed eligible/ineligible
  batches transactionally.
- No test may use or mutate the existing real dataset.

## Evidence and result

- Status: ACCEPTED — coordinator independent audit complete 2026-08-08.
- Implementation evidence: `docs/evidence/TASK-0011-IMPLEMENTATION-20260807.md`.
- Coordinator acceptance evidence: `docs/evidence/TASK-0011-COORDINATOR-ACCEPTANCE-20260808.md`.
- Commands actually run (coordinator):
  - `python -m pytest tests/test_task0011_bulk_import.py -q` → 19 passed (post-fix)
  - `python -m pytest tests -q` (excluding pre-existing collection-error file) → `276 passed, 28 skipped`
  - `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` → `[PASS]`
- P1 fix applied by coordinator: `list_imported_institutions` now includes
  `flagged_duplicate` institution rows in undo eligibility; regression test
  `test_ac005_undo_includes_flagged_duplicate_records` added.
- Not verified: local PostgreSQL leg (28 skipped; no isolated PostgreSQL
  test database available; same constraint as all accepted prior tasks).
