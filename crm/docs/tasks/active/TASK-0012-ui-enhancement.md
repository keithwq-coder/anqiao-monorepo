# TASK-0012: Interface enhancement — dashboard, list, detail, forms, navigation

- Task ID: TASK-0012
- Status: ACTIVE / **ACCEPTED** (coordinator audit 2026-08-05; local suite
  green; governance PASS; all 5 steps verified; browser visual acceptance
  pending after deployment)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Also governed by: `SPEC-0002 v0.2.0`, `SPEC-0008 v0.1.0` (R-030 page/API
  parity, R-029 concise progress, search obeying masking)
- Implementation authorized by: Product owner, `DEC-0085` (2026-08-05)
- Scope confirmation: `DEC-0084` (2026-08-05)
- Implementation owner: DeepSeek (bounded steps; coordinator unlocks one step
  at a time via prompts in
  `docs/handoffs/HANDOFF-20260805-DEEPSEEK-TASK-0012-UI-ENHANCEMENT.md`)
- Coordinator / auditor: opencode (audit + step acceptance; does not implement
  application code for this task)
- Audit started at: 2026-08-05
- Depends on: `TASK-0008` (ACCEPTED, deployed)

## Ownership release

`DEC-0090` releases this task's UI implementation paths for one later
`DEC-0089` task at a time. Its accepted evidence and separate browser visual
acceptance gate remain unchanged.

## Goal

Transform the CRM from a "functional verification page" into a usable
commercial-grade interface, without changing any approved business behavior or
field-level visibility rules. The product owner reports the current UI looks
unfinished: dashboard is an empty shell with placeholder `--` statistics,
institution list/detail pages are rough, feature entry points are not obvious,
and the gap to a commercial product is large.

## What this task does NOT change

- No changes to business logic, domain models, policy projections, or field
  masking rules (SPEC-0001 R-030: page and API share one visibility rule).
- No changes to authentication, authorization, session management, or CSRF.
- No new API endpoints (existing `/api/institutions` with `q`, `page`, `limit`
  already supports search and pagination; the page just does not use it yet).
- No changes to database schema or migrations.
- No changes to the policy layer (`src/crm/policy/`).
- No real-data mutation, no deployment (deployment is a separate gate).

## Scope — what changes

### 1. Dashboard (`templates/dashboard.html`)

Current: three stat cards showing `--` placeholders; one "管理系统" button.

Target:
- Real statistics loaded from the existing `/api/institutions` API: "我的机构"
  count (total from API response), "本月跟进" count (derive from institution
  details or a lightweight API call), "待处理事项" (institutions with
  `next_action` but no recent follow-up — if computable from existing API; if
  not, show "我的机构" + "机构总数" + "本月新建" instead).
- Quick-action buttons: 新建机构, 搜索机构, (if admin) 管理功能.
- A "最近机构" list (top 5 institutions from the API, clickable to detail).
- Responsive layout.

### 2. Institution list (`templates/institutions_list.html`)

Current: plain table, no search, no pagination.

Target:
- Search bar at top (sends `q` to the existing `/api/institutions?q=...` API
  or the page route `/institutions?q=...`).
- Pagination controls (page/limit, using existing API pagination).
- Better table: name (clickable link to detail), category, region,
  source_category, concise_progress if available.
- "新建机构" button prominently placed.
- Empty state with guidance ("暂无可见机构记录，点击新建机构添加").
- Responsive layout.

### 3. Institution detail (`templates/institution_detail.html`)

Current: basic field list, contacts list, follow-up history list.

Target:
- Cleaner card-based layout with sections: 基本信息, 联系人, 跟进历史.
- Follow-up history as a timeline (reverse chronological, already `occurred_at
  DESC`).
- Each follow-up shows: date, communication method category, factual body,
  shared summary, next action (if any).
- Contact cards with role/title and available contact channels.
- Action buttons: 添加联系人, 添加跟进, (owner) 修正/撤回 links if applicable.
- Admin exception read link (if administrator role) with reason input.
- Responsive layout.

### 4. Form pages (`institution_create.html`, `contact_create.html`,
   `followup_create.html`)

Current: functional but visually rough.

Target:
- Consistent styling with the rest of the app.
- Better form labels, hints, and grouping.
- `followup_create.html`: the "下一步负责人 UUID" field is technical — add a
  hint that it is optional, or pre-fill with the current user's id if
  possible.
- Error states clearly highlighted.
- Success redirect with a brief confirmation.
- Responsive layout.

### 5. Login page (`templates/login.html`)

Current: already decent. Minor polish only if needed.

### 6. Navigation — shared layout

Current: each page has its own navbar with different buttons.

Target:
- Consistent navbar across all pages: logo/title left, user info right,
  navigation links (仪表盘, 机构列表, 退出登录) in between.
- Consider a shared base template (`base.html`) with `{% block content %}`
  to avoid duplicating the navbar CSS in every file. This is an engineering
  choice (AI-owned under DEC-0002/DEC-0003) — Jinja2 template inheritance is
  the natural approach for this codebase.

### 7. Search UI (SPEC-0008 minimal)

The backend already supports `q` in `find_institutions`. This task adds the
search bar to the institution list page (item 2 above). A full TASK-0010
search-security verification task remains separate, but the UI entry point is
included here so the product owner sees search working.

## Owned files/directories (exclusive while this task holds an unlocked step)

- `templates/dashboard.html`
- `templates/institutions_list.html`
- `templates/institution_detail.html`
- `templates/institution_create.html`
- `templates/contact_create.html`
- `templates/followup_create.html`
- `templates/login.html` (minor polish only)
- `templates/base.html` (new, if template inheritance is used)
- `static/` directory (new — CSS/JS assets if extracted from inline)
- `src/crm/web/main.py` — page routes only (pass search/pagination params to
  templates; no new API endpoints, no logic changes beyond wiring template
  context)
- `src/crm/web/routes/institutions.py` — only if a page-level search route is
  needed (the `/institutions` page route in `main.py` may need to accept `q`
  and `page` query params and pass them to the template)
- Focused template/UI tests under `tests/` (if any are added)
- `docs/evidence/TASK-0012-*` and this task card

## Non-goals

- No new SPEC, no business-rule change, no policy change.
- No new API endpoints beyond what already exists.
- No database migration.
- No deployment (separate gate after acceptance).
- No real-data mutation.
- No JavaScript framework (React/Vue/etc.) — server-rendered Jinja2 + vanilla
  JS + CSS only, consistent with ADR-0002.
- No external CSS/JS CDN dependencies (self-contained).
- No AI coaching, no opportunity discovery, no bulk import — those are
  separate tasks.
- No changes to `src/crm/policy/`, `src/crm/domain/`, `src/crm/persistence/`
  (unless a template needs a new field from an existing projection, in which
  case stop and ask).
- No `crm_test` / SSH / server work unless a separate DEC names that round.

## Assumptions and unknowns

- [VERIFIED] The existing `/api/institutions` API supports `q`, `page`,
  `limit`, and returns `{ items, total, limit, offset }`.
- [VERIFIED] The existing `/api/institutions/{id}` API returns full detail
  with contacts and activities.
- [VERIFIED] `find_institutions` in `queries.py` already supports
  `search_terms`, `limit`, `offset`.
- [VERIFIED] The page route `/institutions` in `main.py` calls
  `query_service.find_institutions` but does not pass `search_terms` or
  pagination — this wiring needs to be added.
- [INFERENCE] Dashboard statistics can be computed from the existing
  `/api/institutions` response (total count) and potentially from institution
  details (follow-up counts). If a statistic cannot be computed from existing
  API data without a new endpoint, it should be omitted rather than adding a
  new API.
- [UNKNOWN] Whether the product owner has specific visual/design preferences
  (colors, layout style). The current purple gradient theme is retained
  unless the product owner objects.
- [UNKNOWN] Browser visual acceptance — the product owner must visually verify
  after deployment.

## Prerequisites and completion gate

- Prerequisites: TASK-0008 ACCEPTED (done); DEC-0085 implementation
  authorization (done 2026-08-05).
- Exact output: all 7 template files enhanced, consistent navigation, real
  dashboard stats, search bar on institution list, pagination, cleaner detail
  and form pages — all behind the existing policy projection with zero
  changes to field-level visibility rules.
- Completion gate: local suite green (`pytest tests/ -q` with 0 failures);
  governance `[PASS]`; coordinator visual inspection of rendered templates;
  product owner browser visual acceptance after deployment (separate gate).

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | DEC-0085 | DeepSeek: create `base.html` shared layout + enhance dashboard with real stats + quick actions + recent institutions | Enhanced dashboard | Suite green; template renders; stats load from API | **ACCEPTED** |
| 2 | Step 1 accepted | DeepSeek: enhance institution list with search bar + pagination + better table | Enhanced list page | Suite green; search works via `q` param; pagination works | **ACCEPTED** |
| 3 | Step 2 accepted | DeepSeek: enhance institution detail with card layout + timeline follow-ups + action buttons | Enhanced detail page | Suite green; detail renders correctly for owner/non-owner/admin | **ACCEPTED** |
| 4 | Step 3 accepted | DeepSeek: polish all form pages for consistency + better UX | Enhanced forms | Suite green; forms submit correctly; errors display | **ACCEPTED** |
| 5 | Step 4 accepted | DeepSeek: wire `/institutions` page route to accept `q` and `page` params + full local regression + evidence | Acceptance pack | Suite green; governance PASS; evidence complete | **ACCEPTED** |

## Risks and rollback

- Template changes can break CSRF token rendering or form submission — verify
  every form still carries the `csrf_token` hidden field.
- Search/pagination wiring must not bypass the policy projection (the
  `find_institutions` call already goes through `project_record`; the page
  route must pass the same user context).
- Extracting CSS to `static/` requires the `StaticFiles` mount to work (it is
  already mounted at `/static` in `main.py:109`).
- If a template references a field not in the projection, it will show blank
  or error — do not add fields to the projection; only use what the policy
  already exposes.

## Evidence and result

- Status: ACTIVE / **ACCEPTED** (coordinator audit 2026-08-05)
- Final suite: `183 passed, 28 skipped, 0 failed` (coordinator independent
  re-run via `scripts/dev-test.ps1`)
- Governance: `[PASS]` (coordinator independent re-run)
- Files changed: 11 (2 new: `base.html`, `style.css`; 7 rewritten templates;
  1 modified: `main.py`; 1 new evidence: `TASK-0012-ACCEPTANCE.md`)
- CSRF tokens: verified preserved in all 3 form templates
  (`institution_create.html:17`, `contact_create.html:17`,
  `followup_create.html:17`) and in `base.html:50` for logout JS
- Policy/domain/persistence: no source changes (only `.pyc` recompilation)
- No new API endpoints, no database migration, no external dependencies
- Evidence: `docs/evidence/TASK-0012-ACCEPTANCE.md`,
  `docs/handoffs/HANDOFF-20260805-DEEPSEEK-TASK-0012-TO-COORDINATOR.md`
- Not verified: browser visual acceptance by product owner (requires deployment
  — separate gate)
