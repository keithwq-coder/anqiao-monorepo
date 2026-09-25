# TASK-0017 Remediation Report — F1 (whitespace erase reason)

- Date: 2026-08-07
- Executor: GLM (sole executor, DEC-0105)
- Task: TASK-0017 (SPEC-0011 lifecycle, erasure and propagation)
- Remediation basis: DEC-0106 (REMEDIATION-REQUIRED, finding F1 only)
- Audit evidence: `docs/evidence/TASK-0017-COORDINATOR-AUDIT-20260806.md`

## Status: PASSED (pending coordinator re-audit)

## Scope: files changed (TASK-0017 owned paths only)

### F1 fix: whitespace-only reason rejected before DB work

- `src/crm/web/routes/admin.py` — added a `strip()`-then-non-empty check
  after `confirm` validation and before any database operation in the
  `erase_institution` route handler. A whitespace-only `reason` (e.g.
  `"   "`) now returns a clean HTTP 400 with detail "Erasure reason is
  required and must not be blank" instead of passing Pydantic's
  `min_length=1` (which counts whitespace) and crashing with 500 on the
  `ck_erasure_records_erasure_reason_not_blank` CHECK constraint after
  blanking personal fields in-transaction.

  The fix follows the DEC-0096 pattern established by TASK-0014
  (`_normalize_reason` in `queries.py`) and the archive route's inline
  strip check in `institutions.py`: whitespace-only is treated as absent
  and rejected at the boundary.

### Focused regression test

- `tests/test_task0017_lifecycle.py` — new
  `test_whitespace_reason_rejected_cleanly` asserting:
  (a) HTTP 400 status (not 500);
  (b) institution and contact original values unchanged (name, source_description,
  phone, email, contact name all intact);
  (c) zero `erasure_records` rows for the target institution.

## Evidence: commands actually run and their results

| Check | Command | Result |
|---|---|---|
| Focused TASK-0017 | `pytest tests/test_task0017_lifecycle.py -q` | `14 passed` (13 original + 1 new regression) |
| Full local suite | `pytest tests -q` | `258 passed, 28 skipped, 1 warning` (257 baseline + 1 new; 0 regression) |
| Byte-compile | `python -m compileall -q src tests scripts` | exit 0 |
| Governance | `scripts/check-governance.ps1` | `[PASS]` (7 SPECs, 13 tasks) |

## F1 resolution detail

### Before fix (defect)

`EraseInstitutionRequest.reason` used `Field(..., min_length=1)`. Pydantic
counts whitespace characters, so `"   "` passed validation. The
`EraseInstitutionCommand.execute()` then blanked personal fields
in-transaction before writing the `erasure_records` row, which failed the
`ck_erasure_records_erasure_reason_not_blank` CHECK constraint
(`char_length(btrim(erasure_reason)) > 0`), raising an `IntegrityError` →
HTTP 500. Transaction rollback was intact (no data corruption), but the 500
violated DEC-0096's boundary-clean-rejection rule.

### After fix

The route handler now checks `if not (data.reason or "").strip():` before
any database operation. A whitespace-only reason returns HTTP 400 with a
clear message. No personal fields are touched, no erasure_records row is
written, and no 500 is produced.

## Not changed (per DEC-0106 constraints)

- Erase scope: unchanged (institution + contacts personal fields only)
- Propagation semantics: unchanged (30-day window, pending → verified)
- Archive path: unchanged
- No files outside TASK-0017 owned paths were modified

## Not verified

- No production data, remote DB/SSH, real users, credentials, or external
  writes.
- Observations F2 (rehearsal omits audit_events) and F3 (follow-up free
  text) remain non-blocking as recorded in the audit; no code change
  authorized.

STOP: coordinator re-audit required; do not start TASK-0011.
