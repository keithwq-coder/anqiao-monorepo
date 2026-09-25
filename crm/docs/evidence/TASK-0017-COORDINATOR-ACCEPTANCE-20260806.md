# TASK-0017 Coordinator Acceptance — 2026-08-06

- Auditor: current coordinator
- Subject: GLM TASK-0017 remediation of DEC-0106 finding F1 (whitespace erase
  reason), following round-1 audit
  (`docs/evidence/TASK-0017-COORDINATOR-AUDIT-20260806.md`)
- Verdict: **ACCEPTED** (local synthetic scope)

## 1. F1 re-audit

- Fix inspected [VERIFIED]: `src/crm/web/routes/admin.py:355-356` rejects a
  whitespace-only `reason` with HTTP 400 after `_require_admin` and the
  `confirm` check, before any DB work. Semantics match DEC-0096
  (whitespace treated as absent, rejected at the boundary).
- Regression test inspected [VERIFIED]:
  `tests/test_task0017_lifecycle.py::test_whitespace_reason_rejected_cleanly`
  asserts (a) HTTP 400 (not 500), (b) institution and contact original
  values unchanged, (c) zero `erasure_records` rows — exactly the three
  assertions required by DEC-0106.
- Scope discipline [VERIFIED]: only `admin.py` (+4 lines) and the test file
  changed; erase scope, propagation semantics, archive path, and files
  outside owned paths untouched. GLM's report matches the repository.

## 2. Independent re-run (coordinator)

| Check | Result |
|---|---|
| Focused `pytest tests/test_task0017_lifecycle.py -q` | `14 passed` [VERIFIED] |
| Full suite `pytest tests -q` | `258 passed, 28 skipped, 1 warning` (257 remediated baseline + 1 regression test, 0 regression) [VERIFIED] |
| `compileall -q src tests` | exit 0 [VERIFIED] |
| `scripts/check-governance.ps1` | `[PASS]` (7 SPECs, 13 tasks, 1 manifest) [VERIFIED] |

## 3. Final acceptance against the task card

All "Required acceptance" items now MET:

1. Normal correction remains archive, not hard delete — MET (round 1).
2. Erasure requires admin + explicit non-blank reason + confirmation;
   irreversible; audit carries no personal values — MET (F1 closed).
3. Request-fulfillment record retains no deleted content — MET (round 1).
4. Propagation proven within the 30-day window or marked incomplete; never
   by assumption — MET (round 1).
5. Synthetic backup/restore rehearsal proves the documented recovery path —
   MET (round 1).

## 4. Non-blocking items carried forward (unchanged from round 1)

- F2 (observation): rehearsal backup serialization omits `audit_events`;
  audit hygiene is covered by a dedicated test. Improvement candidate.
- F3 (product-scope question): follow-up free text is outside erasure scope;
  recorded in `docs/NOW.md` open items for the product owner.
- Previously recorded residuals (R1/D3 UUID-500 pattern, D2 dead field, D5
  batch-transfer audit gap) remain on the hardening backlog.

## 5. Not verified (unchanged)

Production PostgreSQL `pg_dump`, remote/SSH, deployment, real data, browser
visual acceptance. All evidence is local synthetic.

## 6. Consequence

TASK-0017 is ACCEPTED (`DEC-0107`). Roadmap order-4 gate satisfied;
TASK-0011 activation proceeds under `DEC-0108`.
