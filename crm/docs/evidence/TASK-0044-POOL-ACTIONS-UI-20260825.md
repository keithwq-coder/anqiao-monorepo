# TASK-0044: Public-pool UI + customer record action UI — execution evidence

- Task: `docs/tasks/active/TASK-0044-customer-pool-and-record-actions-ui.md`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Approved SPEC: `SPEC-0001 v0.8.1` (+ `SPEC-0008`), 30-approved with matching
  approval hash (verified by `scripts/check-governance.ps1`)
- Executed: 2026-08-25, by Reasonix (see TASK-0043 evidence for the executor
  identity note)
- Status: **EXECUTED — AWAITING INDEPENDENT REVIEW** (NOT SELF-ACCEPTED)

## What was changed

| File | Change |
|---|---|
| `templates/institution_detail.html` | Added role-conditional **客户操作** card (rendered only when at least one action applies): 认领 (business_user + `in_pool`, POST `/api/institutions/{id}/claim`), 释放进公池 (admin + not in pool, mandatory reason, POST `.../release-to-pool`), 归档 (admin, optional reason, POST `.../archive`), 客户类型变更 (owner or admin, three approved labels, POST `.../customer-type`). Each follow-up timeline item gains owner-only 撤回 (mandatory withdrawal_reason, POST `.../activities/{aid}/withdraw`) and a collapsible 更正 form (mandatory change_reason + factual_body, POST `.../activities/{aid}/correct`). Every form carries a hidden `csrf_token`; a shared inline script submits via `fetch` with the `X-CSRF-Token` header to the existing APIs |
| `templates/pool_list.html` | NEW — public-pool customer list (name/customer_type/category/region/source_category — the API summary projection only) with 认领 buttons rendered for business_user only (R-043/R-044); admin sees a read-only list |
| `templates/base.html` | Added 公池 `/pool` nav entry (business_user / administrator only) |
| `src/crm/web/main.py` | Added `GET /pool` page route (page route only). View-layer filter over the existing policy-projected listing: rows the caller may see AND `in_pool == True` are rendered; no backend parameter or query was added |
| `static/css/style.css` | Additive only: `.action-form`, `.action-details`, `.alert-inline` (TASK-0043 tokens reused) |
| `tests/test_task0044_pool_actions_ui.py` | NEW — 10 tests (role-conditional visibility of every action, CSRF on all forms, pool page role gating + claim-button gating, API action paths respect roles, masked-projection parity) |

## STOP-and-report (task-card rule, no backend parameter exists)

1. **List filters** (`institutions_list.html`): the card scopes filters to
   "params the backend already supports". `QueryService.find_institutions`
   and `InstitutionRepository.find_all` accept only `q` (search) + limit/offset
   ([VERIFIED] `src/crm/application/queries.py:218`, `src/crm/persistence/repositories.py:73`).
   **No** customer_type / region / source filter parameter exists in the
   backend, so those dropdown filters were **NOT implemented** and **no
   backend parameter was added** (hard boundary: no business logic / API
   change). The existing search bar (`q`) remains the supported filter.
2. **Public-pool page**: the backend exposes no `pool` query parameter or
   pool-list endpoint, so the `/pool` page route applies a **view-layer
   filter** to the already-projected rows (`in_pool` is a field of the API
   projection, `InstitutionSummary`). This is the "dedicated `/pool` page
   route" option the card allows; it adds no backend capability and no
   business rule. Records are fetched in batches of 200 (up to 1000) through
   the same `query_service.find_institutions` the list page and API use, then
   filtered by `in_pool` — the page can therefore show pool customers that
   would otherwise sit beyond a single page. Documented here as the chosen
   trade-off.

## Design decisions

1. **Write actions reuse the existing `/api/` endpoints** — identical
   pattern to TASK-0043: hidden `csrf_token` field + inline `fetch` with the
   `X-CSRF-Token` header, so the CSRF middleware (deps.py) validates exactly
   as for the JSON API; server-side authorization/audit is untouched.
2. **Action visibility mirrors the API authorization rules**:
   - 归档: administrator only (`routes/institutions.py:345` 404-for-others);
   - 释放进公池: administrator only, reason required (`:388`);
   - 认领: business_user only, admin excluded (`:427` R-044);
   - 客户类型变更: owner or administrator (`:470`);
   - 跟进更正/撤回: owner only, non-owner 404 (`routes/followups.py:301/394`).
   The page computes `is_owner` from the projected `owner_user_id`, so it
   never widens what the API allows.
3. **No empty action card**: the 客户操作 card renders only when at least one
   action applies to the current user+record combination.

## Completion gate (commands actually run)

| Gate | Command | Result |
|---|---|---|
| 1 | `python -m pytest tests -q` | **476 passed, 28 skipped** (previous: 466; no regression) |
| 2 | `python -m compileall -q src tests migrations` | exit 0 |
| 3 | `git diff --check` | clean (exit 0; one LF→CRLF advisory line, no whitespace errors) |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` — 9 approved SPECs / 46 active tasks / 1 legacy manifest |
| 5 | `python -m pytest tests/test_task0044_pool_actions_ui.py -q` | **10 passed** — owner sees only owner actions; admin sees only admin actions; non-owner business_user sees no action controls; claim rendered only for pool records and only for business_user; every action form carries CSRF; API paths enforce roles (release 403 for business_user, archive 404 for business_user, claim 403 for admin, correct/withdraw 404 for non-owner); `/pool` 200 for business_user/admin with claim button only for business_user, 403 for manager, 302→/login anonymous; pool page shows only summary-projection fields (no `source_description` leak); detail page matches the API masked projection |
| 6 | Evidence file | this file |
| 7 | No commit, no push | honored (work tree only) |

## Debugging note (fixture)

The initial test run hung on the follow-up correct path: the fixture's
`_SqliteActivityRepo` subclass did not override `find_by_id`, so the route's
`activity_repo.find_by_id(...)` inherited the production implementation which
opens `SessionLocal()` (a real PostgreSQL engine) — on this machine the
connect attempt waits indefinitely (no listening PostgreSQL). Fixed by
overriding `find_by_id` to read through the injected SQLite session. Root
cause confirmed via a faulthandler thread dump (`psycopg.connect` on the
asyncio-portal thread); the diagnostic script was removed after the fix.

## NOT VERIFIED

- Browser visual acceptance (product owner, separate later gate).
- Independent review by glm-5.2 (DEC-0174 — unified reviewer for this
  batch; still inspects files and reruns checks per SPEC-GOV-0001 R-012).
  Not yet performed.
- Production deployment — separately unauthorized.
- Real PostgreSQL execution of the new pages (fixture is SQLite-backed, per
  the established in-repo test convention).

## Files touched

- `templates/institution_detail.html`, `templates/pool_list.html` (new),
  `templates/base.html`, `src/crm/web/main.py`, `static/css/style.css`
  (additive), `tests/test_task0044_pool_actions_ui.py` (new)
