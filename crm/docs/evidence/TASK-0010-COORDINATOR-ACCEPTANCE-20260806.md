# TASK-0010 Coordinator Audit — Round 2 (ACCEPTED)

- Date: 2026-08-06
- Auditor: coordinator (Kimi Code)
- Subject: GLM remediation of `DEC-0100` findings F1/F2
- Verdict: **ACCEPTED** (local synthetic scope). See `DEC-0101`.

## Independently re-run checks (this audit)

| Check | Result |
|---|---|
| Focused TASK-0010 | `13 passed` (9 original + 4 new management tests) |
| Full local suite | `218 passed, 28 skipped, 1 warning` (214 + 4 new; no regression) |
| Byte-compile | exit 0 |
| Governance | `[PASS]` (7 SPECs, 11 tasks) |

## Finding resolution

- **F1 (management-scope test gap) — RESOLVED** [VERIFIED]. Four new tests in
  `tests/test_task0010_search_security.py:518-577`:
  `test_general_manager_search_by_name_returns_masked_results` (name hit,
  masked summary, no `source_description`),
  `test_general_manager_cannot_search_by_source_description` (zero results on
  hidden-field fragment),
  `test_scoped_manager_search_name_no_scope_leak` (scoped MANAGER sees zero
  records — scope boundary holds),
  `test_scoped_manager_cannot_search_by_source_description` (zero results).
  Fixture adds a GENERAL_MANAGER and a scoped MANAGER (`scope_east`) with
  correct role grants. Assertions are non-vacuous. All five actor classes in
  the card's completion gate (owner, other user, management scope,
  administrator exception, unauthorized) are now covered.
- **F2 (matrix doc mismatch) — RESOLVED** [VERIFIED]. The matrix "Fix
  approach" section now states the implemented contract exactly: administrator
  exception searches the detailed set; business/owner/management search
  `{name, category, region}`; unauthorized gets `frozenset()` (`WHERE false`);
  the owner-list-path restriction rationale is recorded.

## Residual observations (recorded, not blocking)

- **R1 (carried from round 1, F3)**: `GET /api/institutions/<non-uuid>`
  returns 500 (unhandled `ValueError` in `get_institution`). Pre-existing,
  outside TASK-0010 owned paths. P2 robustness candidate for a future task.
- **R2 (surfaced by GLM's F1 work, verified by this audit)**: `RecordSnapshot`
  in `QueryService` never sets `management_scope_key`, so a scoped `MANAGER`
  subject is `PolicyDenied` for every record. This is pre-existing,
  fail-closed (no leak), and outside the search-security scope. It is
  functionally relevant to TASK-0015's management-surface work and is handed
  over as an input to that task, not as a TASK-0010 defect.
- **R3 (documentation nit)**: the matrix table's owner row still lists
  `source_description` under the column heading "Searchable institution
  fields" (it is the projection-visibility derivation); the corrected "Fix
  approach" section immediately below documents the actual, narrower
  implemented predicate. The document as a whole is now accurate; no further
  change required.

## Boundaries confirmed

No deployment, remote PostgreSQL/SSH, production data, credential, billing,
or real-data actions were taken or authorized by this audit.

## Gate release

Per `DEC-0100` point 4, the block on successors is lifted for sequencing.
Next in roadmap order: `TASK-0015-user-role-management` (prerequisites
`DEC-0089` + TASK-0014 accepted — met).
