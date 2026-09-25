# TASK-0011 — Coordinator Acceptance Evidence

- Date: 2026-08-08
- Coordinator: Claude Code (Opus 4.8) — independent audit
- Decision: DEC-0109
- Scope: local synthetic only (no production database, no real data)

## Audit summary

The implementation was reviewed end-to-end: migration DDL, ORM models,
`ImportBatchRepository`, `ImportBatchService`, API routes, and all 18
focused AC tests.

**One P1 gap found and remediated before acceptance:**

`ImportBatchRepository.list_imported_institutions` queried only
`outcome == "imported"` rows. `flagged_duplicate` rows also create real
SPEC-0001 institution records (R-003: trusted load, not merged) and must
be included in batch-undo eligibility per R-006. The filter was narrowed
to `institution_id IS NOT NULL`, which covers both outcomes correctly.
One regression test was added to pin the behaviour:
`test_ac005_undo_includes_flagged_duplicate_records`.

All other behavior — idempotent rerun, per-row isolation, duplicate
flagging, fail-closed undo, authorization, whitespace-reason rejection,
audit events, masking/ownership — was verified correct against the SPEC.

## Verification commands run by coordinator

| Check | Command | Result |
|---|---|---|
| SPEC-0013 hash | pre-verified by implementor 2026-08-07 (match) | accepted |
| Alembic chain | pre-verified by implementor 2026-08-07 (head = `0003_import_batches`) | accepted |
| Offline DDL | pre-verified by implementor 2026-08-07 | accepted |
| compileall | pre-verified by implementor 2026-08-07 (exit 0) | accepted |
| Focused AC tests (pre-fix) | `python -m pytest tests/test_task0011_bulk_import.py -q` | 18 passed |
| Focused AC tests (post-fix) | `python -m pytest tests/test_task0011_bulk_import.py -q` | 19 passed |
| Full suite (post-fix) | `python -m pytest tests -q` (excluding pre-existing collection-error file) | 276 passed, 28 skipped |
| Governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` |

## AC coverage confirmed

- AC-001 ✓ batch identity returned, records created as SPEC-0001 rows
- AC-002 ✓ partial failure: valid rows import, invalid rows reported per-row, "all success" never shown
- AC-003 ✓ duplicate flagged, not merged; second institution created (trusted load)
- AC-004 ✓ idempotent rerun returns existing batch, no re-import
- AC-005 ✓ unmodified batch fully undone; **new test pins flagged_duplicate inclusion**
- AC-006 ✓ modified/archived records excluded, eligible records still undone
- AC-007 ✓ imported records obey SPEC-0001 masking/ownership (non-owner biz user sees no source_description)
- AC-008 ✓ business user, no-role user, and non-admin undo all denied

Negative paths verified: idempotent second undo rejected; whitespace undo
reason rejected (4xx) before any DB work; unparseable file rejected, no
half-batch; unknown owner_username fails the row; mixed eligible/ineligible
undo fail-closed.

## Informational (non-blocking)

Constraint names differ between the migration (`ck_import_batches_*` prefix)
and the ORM model (short names). The DB behaviour is identical; Alembic
autogenerate may emit spurious `ALTER CONSTRAINT RENAME` statements in
future if the model is ever compared to the live schema. Recommended: align
at a later cosmetic pass, not in this task.

## Pre-existing collection error (not introduced by TASK-0011)

`tests/test_task0009_csrf_phone_isolation.py` fails to collect with
`ModuleNotFoundError: No module named 'tests.test_s5_pages_api_parity'`
on Windows due to a `sys.path` configuration difference. The file existed
before TASK-0011 and is not caused by any TASK-0011 change. With that file
excluded, the suite is `276 passed, 28 skipped` — matching the implementor's
reported result. This will be repaired as a separate follow-up.

## Not verified

- The "local PostgreSQL" gate leg (28 skipped tests; no isolated PostgreSQL
  test database available in this environment). Same constraint applied to
  all accepted prior tasks. Marked NOT VERIFIED per task card instructions.

## Verdict

**ACCEPTED** under DEC-0109.

TASK-0011 bulk-import capability is complete for the local synthetic scope.
Real-data execution remains separately blocked.
