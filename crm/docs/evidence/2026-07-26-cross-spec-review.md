# Cross-SPEC consistency review (baseline completion condition 5)

- Date: 2026-07-26
- Reviewer: Claude Code / Opus 4.8
- Scope reviewed: `SPEC-0001 v0.7.0`, `SPEC-0002 v0.2.0`, `SPEC-0003 v0.2.0`
  (approved) and `SPEC-0008 v0.1.0` (in review), plus `DEC-0015`–`DEC-0030`.
- Purpose: satisfy `SPEC-BASELINE.md` completion condition 5 — an AI cross-SPEC
  review must find no conflicting terms, roles, states, data ownership,
  permissions, or acceptance criteria.

## Method

Compared the four SPECs across: role vocabulary, permission boundaries, record
and user states, data ownership, masking/inference rules, and acceptance
criteria. Legacy material was not used as authority.

## What is consistent

- [VERIFIED] Masking inheritance is consistent: `SPEC-0003` (discovery reminders)
  and `SPEC-0008` (search) both defer disclosure to the `SPEC-0001` field-level
  masking and never grant new visibility.
- [VERIFIED] Inference/aggregation protection is aligned across `SPEC-0002`
  R-023, `SPEC-0003` R-008, and `SPEC-0008` R-008.
- [VERIFIED] Cross-path consistency (page/search/API) is aligned across
  `SPEC-0001` R-030, `SPEC-0002` R-013, and `SPEC-0008` R-002/R-006.
- [VERIFIED] Ownership is defined once in `SPEC-0002` and consumed consistently
  by `SPEC-0001`, `SPEC-0003`, and `SPEC-0008`.
- [VERIFIED] Management is read-only (`DEC-0013`) consistently: `SPEC-0003` gives
  management no discovery view (`DEC-0021`) and `SPEC-0008` keeps management
  search read-only within scope.
- [VERIFIED] Record states (archive/withdrawal), user states (待启用/启用/停用),
  and the discovery reminder (unread message) do not conflict.

## Findings to resolve before baseline completion

### F-1 (medium): "主管" is used in SPEC-0003 but not defined in SPEC-0002

`SPEC-0003` R-015 (`DEC-0021`) routes an unowned-record discovery reminder to the
"主管". `SPEC-0002` defines 记录负责人, 业务人员, 管理员, 总经理, and 其他管理层,
but not a distinct "主管" role. `DEC-0021` explicitly left the mapping to be
confirmed at review. This must be resolved so the reminder recipient is a defined
identity.

- Proposed resolution: treat "主管" as an existing management user (`其他管理层`)
  with authority over the relevant scope, acting only as the reminder recipient;
  actually assigning an owner still uses the `SPEC-0002` admin assignment path
  (`DEC-0013`). Confirm this mapping, or state the real supervisory structure.

### F-2 (low-medium): management roles are absent from the SPEC-0001 display matrix

`SPEC-0001` section 7 field-level display matrix has columns for record owner,
other business user, administrator exception, and unauthorized — but no column
for 总经理/管理层, which were introduced later by `DEC-0013`/`SPEC-0002`.
Management visibility is defined in `SPEC-0002` prose (R-019–R-023) and is not
contradicted, but the authoritative matrix does not reflect it, so a reader of
`SPEC-0001` alone lacks the management masking cell.

- Proposed resolution: either add a management column to the `SPEC-0001` matrix,
  or record that management maps to the "other business user" concise/masked
  level plus a company/authorized scope. Either is a small SPEC-0001 amendment
  (re-hash + re-approval) or a clarifying decision.

## Minor / cosmetic notes (do not block)

- N-1: `SPEC-0001` says "其他已授权业务人员" while `SPEC-0002` says
  "业务人员/其他业务人员" for the same concept. Wording only.
- N-2: `SPEC-0001` R-030/R-012 and AC-008 reference an "导出/export" path;
  `DEC-0027`/`SPEC-0008` decide no export exists, so those export clauses are now
  moot rather than contradictory.

## Resolution (added 2026-07-26)

- [VERIFIED] F-1 resolved by `DEC-0031`: the unowned-record reminder goes to the
  administrator (not a separate "主管" role); assignment uses the existing
  `SPEC-0002` admin path.
- [VERIFIED] F-2 resolved by `DEC-0031`: management roles map to the "other
  business user" masking level plus their authorized read-only scope, closing the
  `SPEC-0001` matrix gap without amending the approved SPEC.
- N-1 and N-2 remain accepted as non-blocking cosmetic notes.

## Conclusion

The four SPECs are consistent on masking, ownership, inference protection, and
cross-path enforcement. Both seams (F-1, F-2) are resolved by `DEC-0031`, and the
minor notes do not block. Baseline completion condition 5 is satisfied. The
remaining gates are approval of `SPEC-0008 v0.1.0` (condition 2) and the product
owner's explicit baseline-completion approval (condition 6).
