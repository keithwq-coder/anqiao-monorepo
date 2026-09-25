# HANDOFF-20260803-DEEPSEEK-S5-VACUOUS-PARITY

- Task: TASK-0001 (manual core record/activity)
- From tool/model: ZCode agent (coordinator/architect); model identity is
  executor self-report or UNKNOWN per DEC-0066
- To tool/model: DeepSeek (implementation executor, self-reported)
- Handoff status: HANDOFF-ONLY
- Repository state: branch `main`, **no commits yet**; working tree untracked
- Written at: 2026-08-03, local time

## Required reading

- `AGENTS.md` (full)
- `docs/decisions/DECISION-LOG.md` — **DEC-0073** (this adjudication),
  DEC-0072, DEC-0071, DEC-0070, DEC-0027
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — line 4, line 283
- `docs/evidence/TASK-0001-S5-web-layer.md` — §7, and lines 202-205 which must
  be corrected

## Verified current state

- [VERIFIED] `scripts/dev-test.ps1`: `132 passed, 28 skipped`, 0 failed.
- [VERIFIED] `scripts/check-governance.ps1`: `[PASS]`.
- [VERIFIED] **P0 closed and ACCEPTED.** `followups.py:90,151` load the
  institution and compare `owner_user_id`; `followups.py:91,152` deny with 404.
  `institution_repository` now appears in the file (was 0 hits).
- [VERIFIED] Both denial tests are effective: they assert the 404 **and** that
  the repository received no write (`test_s5_pages_api_parity.py:529,549`).
- [VERIFIED] `test_non_owner_page_and_api_masked_identically` is effective:
  second `BUSINESS_USER` with zero ownership, name masked to `***` on both
  paths, no channel values, no `factual_body`, and a correct phone regex at
  line 595 asserting zero leakage.
- [VERIFIED] `ContactDetail.name_masked` → `name` rename is correct and
  contained (`followups.py:73,115`); the masked name stays on
  `ContactSummary.name_masked` (`queries.py:99`).
- [VERIFIED] **The one remaining defect.** `test_s5_pages_api_parity.py:424`
  uses `r"1[3-9]\\d{9}"`. In a raw string `\\` is two characters, so the
  compiled pattern is a literal backslash followed by `d` and matches no phone
  number. Coordinator ran both patterns from the file against a page containing
  `13900000000` and `13700000000`: line 424 matched `set()`, line 595 matched
  both. So `phones_on_page` is always empty and
  `assert phones_on_page <= phones_in_api` cannot fail.
- [VERIFIED] The partner `api_bodies` loop (lines 431-432) checks the API→page
  direction, which the pre-existing assertion already covered. The
  page-exposes-more-than-API direction therefore has no live check.
- [VERIFIED] `docs/evidence/TASK-0001-S5-web-layer.md:202-205` claims the test
  "is now **bidirectional**", contradicted by the compiled pattern.

## Changes made

None to application code. The coordinator wrote only:

- `docs/decisions/DECISION-LOG.md` — added DEC-0073.
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — line 4 and the
  S5 row updated to GATE STILL REFUSED with the reason.
- `docs/handoffs/HANDOFF-20260803-DEEPSEEK-S5-VACUOUS-PARITY.md` — this file.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `powershell -File scripts/dev-test.ps1` | local, no PG gates | 132 passed, 28 skipped, 0 failed | this file |
| `powershell -File scripts/check-governance.ps1` | local | `[PASS]` | this file |
| `grep institution_repository` / `owner_user_id` / `404` in `followups.py` | local | present at 90, 151, 91, 152 | DEC-0073 |
| Compiled both file patterns against a sample page | local Python | line 424 → `set()`; line 595 → both numbers | DEC-0073 |
| `Read` denial + masking tests | local | effective (404 + no-write; masking both paths) | DEC-0073 |
| `grep ContactDetail` in `src/` | local | only creation response; rename contained | DEC-0073 |

## Failed or not verified

- [NOT VERIFIED] S5 gate — REFUSED on the vacuous parity assertion.
- [NOT VERIFIED] `repositories.py:322-385` double-write; no test constructs the
  real repository (S6 real-database item).
- [NOT VERIFIED] The two rewritten S6 tests against a real database.
- [UNVERIFIED — single source] S4's `crm_test` leg.
- [NOT VERIFIED] S6 restart persistence; W4 acceptance; G5; release/nginx/TLS.
- [OPEN, P2] Hardcoded `user_status=UserStatus.ENABLED` at `main.py:236,274`
  and `institutions.py:105,152,189`; non-exploitable because `auth.py:371`
  invalidates non-ENABLED sessions.
- [UNKNOWN] Online production database and service state.

## Next bounded action

Local-only, inside TASK-0001 owned paths, no new authorization needed. Small
scope — do only this.

1. Fix `tests/test_s5_pages_api_parity.py:424` to `r"1[3-9]\d{9}"`, matching the
   already-correct line 595.
2. Prove the assertion is live, not merely passing: temporarily make the page
   render a phone number the API withholds, run the test, observe it **fail**,
   then restore. Record the failing output and the restored pass in evidence.
   A passing assertion you have never seen fail is not coverage.
3. Either make the parity check cover the page→API direction for activity
   bodies too, or state plainly in evidence that only phone numbers are checked
   in that direction. Do not describe a scope wider than the assertions.
4. Correct `docs/evidence/TASK-0001-S5-web-layer.md:202-205` to describe what
   the assertions actually do.
5. Re-run `scripts/dev-test.ps1` and `scripts/check-governance.ps1`; report
   exact commands and output; resubmit S5.

**Prohibited without a new decision entry**: `crm_test` or production database
access, SSH transport, commits, deployment, and any change outside TASK-0001
owned paths. Do not refactor anything else in this round.
