# TASK-0008 implementation acceptance pack (DeepSeek side summary)

- Task: `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` Step 6
  (final implementation step)
- Author: DeepSeek (implementation executor). **This is the implementation-side
  summary, not the coordinator's final acceptance** — the coordinator audits
  and accepts each step independently.
- Date: 2026-08-04
- Authority: DEC-0081 (TASK-0008 implementation); DEC-0080 (scope + defaults);
  steps unlocked sequentially by coordinator acceptances (S1–S5 ACCEPTED).
- Evidence grading: all counts below were actually run this round or in the
  recorded step (`[VERIFIED]`).

## 1. Delivered behavior (per step)

| Step | Delivered | Evidence artifact | Tests |
|---|---|---|---|
| S1 | dead `from_dict` removed; empty projection loop removed; revision+audit txn design | `TASK-0008-S1-CONTRACT-MAP.md` | `test_task0008_s1_contracts.py` 6 |
| S2 | correction / withdrawal / archive (R-031/R-036 owner path), append-only, no hard delete, txn atomicity | `TASK-0008-S2-REVISION-WITHDRAW-ARCHIVE.md` | `test_task0008_s2_workflow.py` 10 |
| S3 | duplicate-suspicion prompt (R-035/AC-028): 409+confirm contract, no-merge, no-leak | `TASK-0008-S3-DUPLICATE-PROMPT.md` | `test_task0008_s3_duplicate_prompt.py` 12 |
| S4 | audited admin-exception read (R-015/AC-009): `administrator_reason` query contract, AC-009 audit | `TASK-0008-S4-ADMIN-EXCEPTION-READ.md` | `test_task0008_s4_admin_exception.py` 8 |
| S5 | R-029 category in concise progress; institution/contact/follow-up browser creation forms; AC-012/R-028 dedicated positives | `TASK-0008-S5-FORMS-CATEGORY.md` | `test_task0008_s5_forms_category.py` 14 |
| S6 | P2 `user_status=ENABLED` hardcoding removed (9 sites incl. later steps' additions); session-verified status passed | this file | regression-only (see §3) |

## 2. P2 repair (Step 6)

- Removed every `user_status=UserStatus.ENABLED` argument in business routes;
  the caller's session-verified status (`current_user["status"]` /
  `user["status"]`, loaded by `deps.load_user_context` from the authenticated
  `UserIdentity`) is passed instead. This makes the policy fail-closed on the
  real status rather than a hardcoded constant.
- `rg` sweep: `user_status=UserStatus.ENABLED` → **0 matches in `src/`**
  (tests fixtures excluded, as the instruction allows).
- The only remaining `UserStatus` reference in the routes is the **explicit**
  403 guard in `create_institution`
  (`institutions.py:78`: `current_user.get("status") != UserStatus.ENABLED.value`
  → 403), which is a deliberate denial check, not a hardcoded pass-through.

## 3. Regression and role-matrix spot checks

- Full local ungated suite (no `CRM_RUN_POSTGRESQL_TESTS`):
  `183 passed, 28 skipped` (211 collected; skips are PostgreSQL-gated), run
  via `.venv/Scripts/python.exe -m pytest tests/ -q -p no:cacheprovider`.
  Baseline evolution: S0 106 → S1 112/139 → S2 149 → S3 161 → S4 169 →
  S5/S6 183; no existing test changed behavior.
- Role-matrix spot checks reuse existing live tests:
  - admin.exception_read audit with actor/target/time/reason:
    `test_task0008_s4_admin_exception.py` (8 passed);
  - owner write + non-owner 404 default deny:
    `test_task0008_s2_workflow.py` (10 passed),
    `test_task0008_s3_duplicate_prompt.py` (12 passed),
    `test_s5_pages_api_parity.py`;
  - non-admin reason never escalates: `test_task0008_s4_admin_exception.py`.
- `scripts/check-governance.ps1` → `[PASS]` (Approved SPECs: 7, Active tasks: 7).
- Reviews run this task: `review` (S5: shippable) and `security_review`
  (S5: no blocking issues; Low/Info notes recorded in
  `TASK-0008-S5-FORMS-CATEGORY.md` §4 and this pack's §5).

## 4. Boundaries honored

- No `crm_test` / SSH / server / deploy / real data (DEC-0081 point 5);
  gated legs remain for the coordinator's gated round.
- No owner transfer / batch transfer; no hard delete; no new migration
  (R-029 category encoded in the existing `interaction_method` column);
  every read still goes through `project_record`.
- Implementation side stops here: final acceptance, role-matrix review, and
  the gated `crm_test` leg are coordinator work.

## 5. Open items for the coordinator (non-blocking, from reviews)

- `followups.py` `communication_method_category` field lacks `max_length`
  (command-layer vocabulary validation already guards it).
- Form routes check owner (404) before CSRF (ordering differs from the
  institution form; no security impact).
- `ContactabilityStatus(form value)` without try/except → 500 on invalid
  enum (availability only).
- `datetime-local` input is interpreted as UTC; an explicit offset in the
  input would be silently dropped.
- A user-typed literal `【电话】` prefix in `interaction_method` is not
  distinguishable from the storage encoding (display strips it; no code
  execution surface).

## 6. Status

- Implementation: **complete** (Steps 1–6). Task card Step 6 marked
  `COMPLETED (impl) — awaiting acceptance`.
- Coordinator final acceptance and any gated round remain outstanding.
