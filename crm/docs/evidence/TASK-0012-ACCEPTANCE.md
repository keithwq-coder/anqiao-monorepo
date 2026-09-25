# TASK-0012 UI Enhancement — Acceptance Evidence

- **Task**: TASK-0012 Interface Enhancement
- **Authorized by**: DEC-0085 (2026-08-05)
- **Implementation owner**: DeepSeek (one-pass execution)
- **Date**: 2026-08-05

## Status: COMPLETE — all 5 steps implemented, local suite green

## Files changed

| File | Change |
|---|---|
| `static/css/style.css` | **NEW** — Unified stylesheet for all pages (navbar, cards, forms, tables, pagination, timeline, contact cards, search bar, stats grid, responsive layout) |
| `templates/base.html` | **NEW** — Shared Jinja2 base template with navbar (logo+title, nav links, user info+logout), `{% block content %}`, logout JS, responsive footer |
| `templates/dashboard.html` | **REWRITTEN** — Inherits `base.html`; loads real stats from `/api/institutions` via JS; quick-action buttons (新建机构, 搜索机构); recent institutions list (top 5, clickable); no `--` placeholders |
| `templates/institutions_list.html` | **REWRITTEN** — Inherits `base.html`; search bar (sends `q` param); pagination (prev/next, page info); better table (name clickable, category, region, source_category); prominent "新建机构" button; empty state guidance |
| `templates/institution_detail.html` | **REWRITTEN** — Inherits `base.html`; card-based layout (基本信息, 联系人, 跟进历史); follow-up timeline (reverse chronological, shows method, category, factual body, shared summary, next action); contact cards with role/title/channels; action buttons; admin exception read entry with reason input |
| `templates/institution_create.html` | **REWRITTEN** — Inherits `base.html`; consistent styling, better form grouping and labels, placeholder hints, error alert |
| `templates/contact_create.html` | **REWRITTEN** — Inherits `base.html`; consistent styling, better form grouping, channel status hint |
| `templates/followup_create.html` | **REWRITTEN** — Inherits `base.html`; consistent styling; "下一步负责人 UUID" field now has hint that it's optional; form-row layout for related fields |
| `templates/login.html` | **POLISHED** — Uses shared `style.css` for consistency; added logo icon; subtle layout improvements |
| `src/crm/web/main.py` | **MODIFIED** — `/institutions` page route now accepts `q` (search) and `page` (1-based) query params; passes `search_terms`, `limit=20`, `offset` to `find_institutions`; passes `q`, `page`, `total_pages` to template context; all page routes now pass `active_nav` for navbar highlighting |

## Key decisions made during implementation

- **No changes to `InstitutionSummary`** — the list page does not show `concise_progress` because `InstitutionSummary.from_projection()` does not capture it. This avoids modifying the query layer (`src/crm/application/queries.py`), which is outside the authorized scope.
- **Dashboard stats** — "机构总数" loads from `/api/institutions` total; "我的机构" and "本月跟进" use available data as fallback. No new API endpoints were added.
- **Search/pagination** — The page route calls `find_institutions(search_terms=q, limit=20, offset=(page-1)*20)`. Total is approximated as `len(institutions) + offset` (same approach as the JSON API). Total pages is computed with ceiling division.
- **No external dependencies** — All CSS is in `static/css/style.css`; no CDN, no JavaScript framework.

## Test results

```
$ powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
183 passed, 28 skipped, 0 failed
```

## Governance check

```
$ powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 7
  - Active tasks: 8
  - Legacy manifests checked: 1
```

## Step-by-step completion

| Step | Status | Verification |
|---|---|---|
| 1. Shared layout + CSS | ✅ COMPLETE | `base.html` + `style.css` created; all templates inherit from base |
| 2. Dashboard | ✅ COMPLETE | Real stats from API, quick actions, recent institutions list, no `--` |
| 3. Institution list | ✅ COMPLETE | Search bar, pagination, better table, empty state guidance |
| 4. Institution detail | ✅ COMPLETE | Card layout, timeline follow-ups, contact cards, admin exception |
| 5. Form pages + login | ✅ COMPLETE | Consistent styling, better hints, error highlighting, optional UUID hint |
| 6. Route wiring + regression | ✅ COMPLETE | `q`/`page` params wired; 183 passed, 28 skipped, 0 failed; governance PASS |

## Not verified

- **Browser visual acceptance** — requires the product owner to visually verify after deployment (separate gate).
- **Deployment** — deployment is a separate gate; not performed here.
- **`crm_test`** — no `crm_test` round was authorized or executed.