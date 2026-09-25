# TASK-0008 S5: R-029 category + browser creation forms + AC-012/R-028

- Task: `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` Step 5
- Author/executor: DeepSeek (implementation); coordinator audits
- Date: 2026-08-04
- Authority: DEC-0081 (Step 5 unlocked after Step 4 ACCEPTED); DEC-0080
  (R-029 vocabulary 电话/微信/面谈/邮件/其他; AC-012/R-028 dedicated tests)
- Scope: R-029 category in concise progress; institution/contact/follow-up
  browser creation forms; AC-012/R-028 dedicated positive tests.
- Evidence grading: per DEC-0073 point 4 — commands and results are
  `[VERIFIED]` (actually run this round) unless labelled otherwise.

## 1. R-029 communication-method category

### Storage decision (no new migration, no new schema column)

`FollowUpActivityModel` has no category column and no free extensible column
besides `interaction_method` (`models.py:185-222`: interaction_method,
ai_review_status, ai_reviewed_at, idempotency_key, withdrawn_*). No new
migration file is authorized this step. The category therefore lives as a
`【category】` prefix on the stored `interaction_method` value:

- `domain/models.py`: `METHOD_CATEGORIES = frozenset({"电话", "微信", "面谈",
  "邮件", "其他"})` plus `compose_stored_interaction_method(category,
  free_text)` (raises on non-vocabulary category) and
  `split_stored_interaction_method(value) -> (category, free_text)`
  (values without a valid prefix yield `(None, value)`, so legacy and
  category-less data round-trip unchanged).
- `CreateFollowUpActivityCommand` gains `communication_method_category`
  (validated against the vocabulary when given) and composes the stored
  value in `execute`.
- `queries.py`: the three `ActivitySummarySource(activity, None)` call sites
  now pass the parsed category, so
  `concise_progress.latest_follow_up_method_category` carries the category.
- Display strips the prefix: `projection.py:_detailed_activity` emits the
  free text, and the creation/correction API responses do the same — the
  storage encoding never reaches a view.

### Behavior

- Write with `communication_method_category="微信"` → concise progress shows
  `微信`; the free text (`interaction_method` value) is displayed untouched.
- Write without category → concise progress category stays `None`
  (legacy-compatible; e.g. the S5-era value `电话` without prefix is not
  inferred).
- Invalid category (e.g. `视频`) → 400, nothing created.

## 2. Browser creation forms

Three templates (existing inline-CSS style, no new layout framework):

- `templates/institution_create.html` — name, source_description (required),
  category, region, source_kind, source_evidence_reference,
  confirm_duplicate checkbox, hidden csrf_token.
- `templates/contact_create.html` — name, role_label, job_title,
  contactability_status select (available / not_yet_obtained /
  not_provided_or_not_storable), phone, email, wechat, other_channel,
  channel_notes, confirm_duplicate, hidden csrf_token.
- `templates/followup_create.html` — occurred_at (datetime-local),
  communication_method_category select (the fixed vocabulary),
  interaction_method, factual_body (required), shared_summary, next_action,
  next_action_owner_user_id, next_action_target_date, hidden csrf_token.

Entry points: `institutions_list.html` gains a 新建机构 link;
`institution_detail.html` gains 添加联系人 and 添加跟进 links.

Routes (`main.py`; the `/institutions/new` routes are registered **before**
`/institutions/{institution_id}` so Starlette matches the literal path):

- GET `/institutions/new`, POST `/institutions/new`
- GET `/institutions/{id}/contacts/new`, POST `.../contacts/new`
- GET `/institutions/{id}/activities/new`, POST `.../activities/new`

Submit handling: page-form POSTs are outside the `/api/` CSRF middleware, so
every submit verifies the synchronizer token manually
(`_form_has_valid_csrf`: form field vs signed-cookie copy in constant time +
`auth_service.validate_csrf_token` — the same token and validator as the
API path). Idempotency keys are generated server-side. Commands are the same
ones the JSON API uses; owner-write 404 and R-035 duplicate gates apply
identically. Duplicate suspicion renders as a readable page error with the
confirm checkbox (409); confirmation proceeds and never merges. Follow-up
`occurred_at` from `datetime-local` carries no timezone and is interpreted
as UTC (documented behavior). Success redirects 303 to the list/detail page.

## 3. Dedicated AC-012 / R-028 tests

`tests/test_task0008_s5_forms_category.py` — 14 passed (`[VERIFIED]`,
`.venv/Scripts/python.exe -m pytest tests/test_task0008_s5_forms_category.py -q`
→ `14 passed in 3.00s`):

- R-029: category appears in concise progress + prefix never rendered
  (creation response, detail API); no-category stays None; invalid category
  400 with nothing created (3 tests).
- AC-012 dedicated positives: not_yet_obtained and
  not_provided_or_not_storable contacts save with explicit status and no
  fabricated channels; available-without-channel still rejected (3 tests).
- R-028 dedicated: next_action without owner rejected 400; with owner
  accepted 201 (2 tests).
- Forms: GET pages render with key field names (200); institution form
  submit 303 + record visible; missing CSRF → 400; duplicate form without
  confirm → 409 readable error, with confirm → 303 and two independent
  records; contact form submit creates contact; follow-up form submit with
  category → 303, page shows free text without prefix, concise progress
  carries the category (6 tests).

### Regression (local ungated; no `CRM_RUN_POSTGRESQL_TESTS`)

- Full suite: `183 passed, 28 skipped` (`[VERIFIED]`,
  `.venv/Scripts/python.exe -m pytest tests/ -q -p no:cacheprovider`).
  Prior S4 baseline was `169 passed, 28 skipped`; the +14 are the new S5
  tests. No existing test changed behavior.
- `check-governance.ps1` → `[PASS]` (`[VERIFIED]`, run this round).

## 4. Design notes and boundaries

- The `【category】` prefix encoding is a persistence contract documented at
  the domain helpers; display always strips it. Legacy stored values without
  the prefix are untouched and yield no category (no inference).
- Form fields are limited to the fields the policy projection displays /
  collects (institution minimum fields, contact channel fields, follow-up
  activity fields); no field outside the API request models is collected.
- `next_action_owner_user_id` is entered as a UUID text field in the form
  (no user picker exists in this slice).
- No new migration; `models.py` gained constants and helpers only, no column.
- P2 `user_status=ENABLED` five sites remain untouched (Step 6).
- No route, template, or policy rule outside the owned paths; no
  `crm_test`/SSH/server/real data touched (DEC-0081 point 5).

## 5. Status

- Step 5 implementation complete; awaiting coordinator acceptance.
- Step 6 (P2 user_status pass-through + full regression) stays LOCKED until
  acceptance is recorded.
