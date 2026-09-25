# TASK-0015 Coordinator Audit — Round 1 (ACCEPTED, with residuals and one product decision)

- Date: 2026-08-06
- Auditor: coordinator (Kimi Code)
- Subject: GLM TASK-0015 completion claim,
  `docs/evidence/TASK-0015-COMPLETION-20260806.md` and
  `docs/evidence/TASK-0015-DESIGN-20260806.md`
- Verdict: **ACCEPTED** (local synthetic scope). One business-semantics
  decision escalated to the product owner (region as management-scope
  dimension). See `DEC-0103`.

## Independently re-run checks (this audit, not the executor's report)

| Check | Result |
|---|---|
| Focused TASK-0015 | `26 passed` |
| Full local suite | `244 passed, 28 skipped, 1 warning` (218 baseline + 26 new; no regression) |
| Byte-compile | exit 0 |
| Governance | `[PASS]` (7 SPECs, 12 tasks) |

## Verified implementation facts

- [VERIFIED] **Area A (role grant/revoke)**: administrator-only route gate,
  self-action prohibition (R-015), idempotent duplicate grant/revoke (no
  duplicate row, no second audit), MANAGER grant requires scope, audit with
  operator/target/time/reason/before/after in one transaction; revoke bumps
  `session_epoch` (R-014). Tests: unauthorized, non-admin, self-grant,
  idempotency, epoch bump — all present and non-vacuous.
- [VERIFIED] **Area B (enable/disable)**: disabled user loses access
  immediately via epoch bump (`test_disable_user_invalidates_session`,
  `test_stale_session_after_role_revoke`); self-disable denied; R-011
  outstanding-responsibility prompt returns owned institution ids; history
  never deleted.
- [VERIFIED] **Area C (single transfer)**: append-only
  `institution_owner_history` + owner update + audit in one transaction
  (R-009/R-010); invalid/disabled/no-business-role new owner fails with
  original owner unchanged (AC-006); no-op transfer idempotent, no duplicate
  history (verified by row count in `test_batch_transfer_idempotent_retry`).
- [VERIFIED] **Area D (batch transfer)**: per-item transactions; mixed
  valid/invalid batch returns per-item success/failure without disguising
  the batch as all-success (R-012); retry of successful items is idempotent.
- [VERIFIED] **Area E (management summary)**: GET-only route; GENERAL_MANAGER
  company-wide, scoped MANAGER scope-only (total==1 for east scope);
  collaborator-projection aggregates only — no contact/source/factual_body
  (asserted by substring absence); small-sample breakdown suppression (<3);
  business and no-role users get 403.
- [VERIFIED] **R2 residual fix**: all six `RecordSnapshot` construction sites
  in `QueryService` now set `management_scope_key=institution.region`;
  scoped MANAGER sees in-scope records (`test_scoped_manager_sees_in_scope_records`)
  and not out-of-scope ones. Fail-closed preserved when `region` is None.
- [VERIFIED] Changed paths within the card's owned set. No migration needed
  (schema already complete); no changes to `src/crm/policy/` or
  `src/crm/domain/models.py`.

## Findings and residuals

- **D1 (product decision escalated, not blocking)**: SPEC-0002 R-020/DEC-0013
  define "authorized management scope" but never name the scope *dimension*.
  GLM wired the record side to `institution.region` and flagged it
  `[INFERENCE]`. The wiring is fail-safe (a wrong dimension cannot leak more
  than the masked collaborator view), reversible (no schema change), and the
  only scope-like field on institutions. Recorded as pending product-owner
  confirmation; if the dimension is wrong, the fix is a wiring change only.
- **D2 (P2, recorded)**: `get_management_summary` sources only non-archived
  institutions, so its `archived` field is always 0 — a dead/misleading
  field. No leak; cosmetic. Candidate for a future polish task.
- **D3 (P2, recorded)**: the new admin routes parse `UUID(...)` without
  try/except, so malformed ids return 500 — the same pre-existing pattern as
  residual R1 from TASK-0010 (`/api/institutions/<non-uuid>`). Both are
  gathered as candidates for one future robustness task.
- **D4 (design/actual doc nits, recorded)**: the design record names
  `src/crm/application/commands.py` but the implementation is the new sibling
  module `management_commands.py` (reasonable, same layer); it also mentions
  `templates/admin_*.html`, which were not created — the management surface
  is API-only in this slice. The card's acceptance does not require pages;
  browser visual acceptance remains a separate product-owner gate.
- **D5 (observation, no action)**: failed batch-transfer items are recorded
  per-item in the response but no durable failure audit event is written.
  R-012's letter (per-item recording, no disguised all-success, per-item
  retry) is satisfied; if the product owner wants durable failure records,
  that is a SPEC-level clarification, not an implementation defect.

## Boundaries confirmed

No deployment, remote PostgreSQL/SSH, production data, credential, billing,
real-data, or external-write actions were taken or authorized. The Mimosa
false-positive note in the executor's report is informational; the audited
code uses parameterized SQLAlchemy ORM queries consistent with the existing
codebase.

## Sequencing

Next in roadmap order is `TASK-0017-data-lifecycle-erasure` (order 4). Its
gate includes `SPEC-0011 OD-001` (backup mechanism and bounded deletion-
propagation window), which is an **open product-owner decision** ("must be
resolved without inventing a time window"). TASK-0017 therefore cannot be
activated until the product owner resolves OD-001.
