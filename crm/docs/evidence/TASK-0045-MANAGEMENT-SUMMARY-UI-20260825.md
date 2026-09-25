# TASK-0045: Management summary UI — execution evidence

- Task: `docs/tasks/active/TASK-0045-management-summary-ui.md`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Approved SPEC: `SPEC-0002 v0.4.1` (+ `SPEC-0003 v0.4.0` link), 30-approved
  with matching approval hash (verified by `scripts/check-governance.ps1`)
- Executed: 2026-08-25, by Reasonix (see TASK-0043 evidence for the executor
  identity note)
- Status: **EXECUTED — AWAITING INDEPENDENT REVIEW** (NOT SELF-ACCEPTED)

## What was changed

| File | Change |
|---|---|
| `src/crm/web/main.py` | Added `GET /management` page route (page route only). Authorization mirrors `routes/admin.py._require_management_viewer`: administrator or manager + enabled; business_user → 403; anonymous → 302 `/login`. Renders `query_service.get_management_summary(...)` — the same method the JSON endpoint `GET /api/admin/summary` calls, so the page projection is identical |
| `templates/management_summary.html` | NEW — read-only page rendering exactly the API masked projection: scope tag (全公司 / 授权范围), stat cards `total` / `active` / `archived` / `has_next_action`, optional `breakdown` table (with the small-sample suppression notice), and an admin-only 商机管理 link to the TASK-0043 opportunity management view (`/discovery`). No action controls (read-only, R-021/AC-015) |
| `templates/base.html` | Added 管理摘要 `/management` nav entry (administrator / manager only) |
| `tests/test_task0045_management_summary_ui.py` | NEW — 7 tests (role visibility, scoped-vs-company, field ⊆ API projection, admin-only link, nav gating) |

## Design decisions

1. **No field beyond the API projection**: the page binds only
   `summary.total/active/archived/has_next_action/scope/breakdown` — the
   exact keys `get_management_summary` returns. Metric display labels are
   static Chinese text, not data.
2. **Admin-only opportunity link**: the card renders only when the caller
   has the ADMINISTRATOR role (the TASK-0043 management view is admin-only
   per SPEC-0003 R-009); manager does not get the link.

## Completion gate (commands actually run)

| Gate | Command | Result |
|---|---|---|
| 1 | `python -m pytest tests -q` | **483 passed, 28 skipped** (previous: 476; no regression) |
| 2 | `python -m compileall -q src tests migrations` | exit 0 |
| 3 | `git diff --check` | clean (one LF→CRLF advisory line, no whitespace errors) |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` — 9 approved SPECs / 46 active tasks / 1 legacy manifest |
| 5 | `python -m pytest tests/test_task0045_management_summary_ui.py -q` | **7 passed** — administrator 200 with company-wide numbers equal to the API; scoped manager (scope=east) 200 with only the 3 east records and no company-wide figures; business_user 403; anonymous 302→/login; page renders no record names / source_description / raw identifiers (fields ⊆ API masked projection); admin-only opportunity link present for admin and absent for manager; 管理摘要 nav entry gated to administrator/manager |
| 6 | Evidence file | this file |
| 7 | No commit, no push | honored (work tree only) |

## NOT VERIFIED

- Browser visual acceptance (product owner, separate later gate).
- Independent review by glm-5.2 (DEC-0174 — unified reviewer for this
  batch; still inspects files and reruns checks per SPEC-GOV-0001 R-012).
  Not yet performed.
- Production deployment — separately unauthorized.
- Real PostgreSQL execution (fixture is SQLite-backed per repo convention).

## Files touched

- `src/crm/web/main.py`, `templates/base.html`,
  `templates/management_summary.html` (new),
  `tests/test_task0045_management_summary_ui.py` (new)

> `static/css/style.css` was not modified by this task (the TASK-0043
> design-token baseline already carries all styles this page needs; the task
> card lists it as an owned file — a permission, not a mandatory change).
