# TASK-0008 S4: audited administrator-exception read — R-015 / AC-009

- Task: `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` Step 4
- Author/executor: DeepSeek (implementation); coordinator audits
- Date: 2026-08-04
- Authority: DEC-0081 (Step 4 unlocked after Step 3 ACCEPTED); DEC-0080
  (R-031/R-036 admin ops in scope: correction, withdrawal, archive,
  admin-exception read with reason + audit)
- Scope: R-015 / AC-009 end-to-end admin-exception **read** only. No
  administrator-write expansion, no transfer, no R-035/R-029/forms/P2.
- Evidence grading: per DEC-0073 point 4 — commands and results are
  `[VERIFIED]` (actually run this round) unless labelled otherwise.

## 1. What was implemented

### Query layer (`queries.py`)

- `QueryService.get_institution_detail(..., administrator_reason=None)`:
  the reason is passed through to `project_record(subject, snapshot,
  administrator_reason=...)`. The policy layer (`projection.py:149-154`)
  opens the `ADMINISTRATOR_EXCEPTION` view **only** for `ADMINISTRATOR` +
  non-blank reason; everything else falls through to the existing
  BUSINESS_USER / GENERAL_MANAGER / MANAGER branches or `PolicyDenied`
  (default deny). A non-administrator supplying a reason is never upgraded —
  the policy is the only gate, there is no role check in the query method.
- `QueryService.find_institutions(..., administrator_reason=None)`: same
  pass-through for the list path.

### API routes (`routes/institutions.py`)

Selected contract: **query parameter `administrator_reason`** (GET requests
have no body; the parameter is explicit and testable).

- `GET /api/institutions/{institution_id}`: accepts `?administrator_reason=`.
  No reason / blank reason → the projection denies → 404 with no business
  content. Valid reason + administrator → full detail; after a successful
  exception read the route writes
  `audit_repo.record(action="admin.exception_read", outcome="success",
  target_type="institution", target_id=..., actor_user_id=...,
  reason=administrator_reason)` (occurred_at defaults to now).
- `GET /api/institutions`: accepts `?administrator_reason=`. Every record
  returned through the exception view is audited individually (actor /
  target / reason per record).

### Page route (`main.py`)

- `GET /institutions/{institution_id}`: accepts the same
  `administrator_reason` query parameter, passes it to the same
  `get_institution_detail`, and writes the same audit event — page and API
  enforce the same projection (R-030). No form UI yet (Step 5 owns browser
  forms); the parameter is the wiring entry point.

### Audit event shape (AC-009)

`audit_events` row per successful exception read: `actor_user_id`,
`action="admin.exception_read"`, `target_type="institution"`,
`target_id`, `reason`, `outcome="success"`, `occurred_at` (default now).
Audit writes use the existing `AuditEventRepository.record` self-committing
path — a read operation needs no shared transaction with business writes.

## 2. Deny semantics

- No reason / blank reason (`_optional_text` in policy) + administrator →
  `PolicyDenied` → 404 (same "not found or access denied" style as the
  existing default deny, no existence disclosure).
- The refusal writes **no success audit** (the route audits only after a
  successful exception projection). A denied attempt may optionally be
  audited separately later; it is not part of this step.
- Administrator-only subject, list without reason → empty list (every record
  denied, nothing disclosed).

## 3. Test evidence (local, synthetic; no `crm_test`)

`tests/test_task0008_s4_admin_exception.py` — 8 passed (`[VERIFIED]`,
`.venv/Scripts/python.exe -m pytest tests/test_task0008_s4_admin_exception.py -q`
→ `8 passed in 2.71s`), S5-pattern in-memory environment with three
identities: administrator-only, owner, other business user.

- No reason → 404, refusal body contains no business detail, zero exception
  audit events (`test_admin_without_reason_detail_404_and_no_success_audit`).
- Blank reason → 404, zero audit (`test_admin_with_blank_reason_detail_404`).
- Valid reason → 200 with full detail (source_description, contact name +
  phone, activity factual_body) and exactly one audit event with
  actor/target/reason/outcome/time (AC-009)
  (`test_admin_with_reason_detail_full_view_and_audit`).
- Non-admin + reason → 200 masked collaborator view, `source_description` is
  None, no protected string anywhere, zero exception audit (no escalation)
  (`test_non_admin_with_reason_is_not_escalated`).
- Owner + reason on own record → unchanged owner view, zero exception audit
  (`test_owner_reading_own_record_is_unaffected_by_reason`).
- List without reason → empty; list with reason → records visible and each
  audited (`test_admin_list_without_reason_is_empty`,
  `test_admin_list_with_reason_shows_records_and_audits_each`).
- Page path: without reason 404, with reason full view + audit event,
  matching the API (`test_admin_page_detail_with_reason_full_view_and_audit`).

### Regression (local ungated; no `CRM_RUN_POSTGRESQL_TESTS`)

- Full suite: `169 passed, 28 skipped` (`[VERIFIED]`,
  `.venv/Scripts/python.exe -m pytest tests/ -q -p no:cacheprovider`).
  Prior S3 baseline was `161 passed, 28 skipped`; the +8 are the new S4
  tests. No existing test changed behavior.
- `check-governance.ps1` → `[PASS]` (`[VERIFIED]`, run this round).

## 4. Design notes and boundaries

- The administrator-exception **write** operations (R-036 admin correction /
  withdrawal / archive) are deliberately **not** implemented in this step;
  they would require reason + audit and are recorded as a later decision
  point. Nothing in this step widens any write path.
- No raw query bypass: the query layer has no new repository reads; it only
  passes `administrator_reason` into the existing `project_record`.
- Page list path (`/institutions`) is not wired with `administrator_reason`
  this step (the exception view is primarily a detail read; the browser
  entry points belong to Step 5 forms). API list is wired and tested.
- No route, template, migration, or policy-rule change beyond the owned
  paths; `projection.py` was not modified (the policy already supported
  `administrator_reason` — the gap was the missing call sites). No
  `crm_test`/SSH/server/real data touched (DEC-0081 point 5).

## 5. Status

- Step 4 implementation complete; awaiting coordinator acceptance.
- Step 5 (R-029 category + creation forms + AC-012/R-028 tests) stays
  LOCKED until acceptance is recorded.
