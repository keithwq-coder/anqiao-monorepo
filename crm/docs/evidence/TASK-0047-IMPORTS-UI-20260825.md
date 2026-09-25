# TASK-0047: Bulk-import UI — execution evidence

- Task: `docs/tasks/active/TASK-0047-bulk-import-ui.md`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Approved SPEC: `SPEC-0013 v0.1.0`, 30-approved with matching approval
  hash (verified by `scripts/check-governance.ps1`)
- Executed: 2026-08-25, by Reasonix (see TASK-0043 evidence for the executor
  identity note)
- Status: **EXECUTED — AWAITING INDEPENDENT REVIEW** (NOT SELF-ACCEPTED)

## What was changed

| File | Change |
|---|---|
| `src/crm/web/main.py` | Added admin-only page routes (page routes only): `GET /imports` (upload form + batch list) and `GET /imports/{batch_id}` (batch detail + per-row results). Page data reads the same `ImportBatchModel` / `ImportBatchRepository` sources the JSON API uses (`GET /api/imports/batches`, `GET /api/imports/batches/{id}`), so fields match the API shape. `undo_eligible` derives from the API's `status` field (`status == 'active'`); the API exposes no separate undo-eligible flag |
| `templates/imports_list.html` | NEW — multipart upload form (`enctype="multipart/form-data"`, file input, CSRF token; JS `fetch` sends `FormData` + `X-CSRF-Token` to `POST /api/imports/batches` and then navigates to the new batch) + batch table (file name, status, row/imported/duplicate/failed counts, imported_at) with per-row 详情 link and, only for `undo_eligible` batches, an inline undo form (mandatory undo_reason + JS confirm → `POST /api/imports/batches/{id}/undo`) |
| `templates/imports_detail.html` | NEW — batch metadata (file/status/counts/imported_at/undone_at/undo_reason) + row-results table (line_number / outcome with labels 已导入·重复标记·失败 / institution_id / duplicate_of_institution_id / reason) + undo form gated on `undo_eligible` |
| `templates/base.html` | Added 批量导入 `/imports` nav entry (administrator only) |
| `tests/test_task0047_imports_ui.py` | NEW — 11 tests (page access control, upload form presence, batch-list fields match API, undo control gating on list and detail, duplicate flags in detail, synthetic-CSV upload, idempotent replay, undo API path incl. blank-reason rejection, nav gating) |

## Design decisions

1. **Template consolidation**: the card lists imports_list / imports_detail /
   imports_upload as possible files; the upload form was merged into the
   list page (one fewer page, same surface), leaving two templates —
   recorded here per card instruction.
2. **Undo eligibility**: the API returns no explicit `undo_eligible` flag;
   the page derives it from `status == 'active'` (the API's own undo path
   rejects non-active batches with "already undone"). This is a derived
   view of an API field, not new data.
3. **Synthetic files only**: verification CSV bytes are generated inline;
   no real customer data is used (hard boundary).

## Completion gate (commands actually run)

| Gate | Command | Result |
|---|---|---|
| 1 | `python -m pytest tests -q` | **504 passed, 28 skipped** (previous: 493; no regression) |
| 2 | `python -m compileall -q src tests migrations` | exit 0 |
| 3 | `git diff --check` | clean (exit 0) |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` — 9 approved SPECs / 46 active tasks / 1 legacy manifest |
| 5 | `python -m pytest tests/test_task0047_imports_ui.py -q` | **11 passed** — /imports + /imports/{id} 200 for administrator and 403 for manager/business_user, 302→/login anonymous; upload form carries multipart + file input + CSRF; batch list fields match `GET /api/imports/batches` (no sha fingerprint leak); undo control rendered only for active batches (list and detail); detail shows duplicate flags; synthetic CSV upload → 201; identical-bytes re-upload → idempotent replay (AC-004); undo → 200, re-undo → 400, blank reason → 400; 批量导入 nav gated to administrator |
| 6 | Evidence file | this file |
| 7 | No commit, no push | honored (work tree only) |

## NOT VERIFIED

- Browser visual acceptance (product owner, separate later gate).
- Independent review by glm-5.2 (DEC-0174 — unified reviewer for this
  batch; still inspects files and reruns checks per SPEC-GOV-0001 R-012).
  Not yet performed.
- Production deployment — separately unauthorized.
- Real PostgreSQL execution (fixture is SQLite-backed per repo convention).
- Real customer-data imports (excluded by task scope; synthetic only).

## Files touched

- `src/crm/web/main.py`, `templates/base.html`,
  `templates/imports_list.html` (new), `templates/imports_detail.html` (new),
  `tests/test_task0047_imports_ui.py` (new)

> `static/css/style.css` was not modified by this task (the TASK-0043
> design-token baseline already carries all styles these pages need; the task
> card lists it as an owned file — a permission, not a mandatory change).
