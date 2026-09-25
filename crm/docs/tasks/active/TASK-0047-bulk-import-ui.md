# TASK-0047: Bulk-import UI (upload, batch list/detail, undo)

- Task ID: TASK-0047
- Status: **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)**
  (executed 2026-08-25; independent review by glm-5.2 PASSED,
  evidence `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`;
  task evidence `docs/evidence/TASK-0047-IMPORTS-UI-20260825.md`)
- Task type: IMPLEMENTATION (UI surface only; no business-rule change)
- Approved SPEC: `docs/specs/30-approved/SPEC-0013-bulk-import.md` (v0.1.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0013-bulk-import.approval.json`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Execution owner: deepseek-v4-flash-0713 (via reasonix dispatch)
- Review/acceptance owner: glm-5.2 (independent review, DEC-0174 — unified
  reviewer for this batch; still inspects files and reruns checks per
  SPEC-GOV-0001 R-012); not part of this task.
- Depends on: TASK-0043 (design baseline / nav pattern); TASK-0011 import
  capability backend (already implemented).

## Goal

Expose the already-implemented bulk-import API
(`src/crm/web/routes/imports.py`: create batch :95, list :163, detail :198,
undo :237) through an admin-only UI. Today zero templates reference
`/api/imports`.

## Scope

1. New admin-only `/imports` pages (page routes + templates):
   - **Upload form**: file upload posting multipart to
     `POST /api/imports/batches`; show the accepted file format(s) exactly as
     the backend accepts them.
   - **Batch list**: batches with status, row counts, duplicate-flag counts,
     undo-eligibility — exactly as the API returns.
   - **Batch detail**: row results incl. duplicate flags.
   - **Undo**: `POST /api/imports/batches/{id}/undo` with explicit
     confirmation; shown only when the API marks the batch undo-eligible.
2. Admin-only nav entry; non-admin roles get 403/redirect.
3. Reuse TASK-0043 design tokens.

## Owned files

- `templates/imports_list.html` (new), `templates/imports_detail.html` (new),
  `templates/imports_upload.html` (new) — executor may consolidate; record the
  choice in the evidence file.
- `templates/base.html` (nav entry)
- `src/crm/web/main.py` (page routes only)
- `static/css/style.css` (additive only)
- `tests/test_task0047_imports_ui.py` (new)

## Out of scope

- Backend import logic changes; new business API endpoints.
- Real customer data imports (UI verification uses synthetic files only).
- SPEC text or approval.json changes; database migrations.
- Production deployment, commit, push.

## Prerequisites and completion gate

- Prerequisites: DEC-0173; TASK-0043 baseline landed.
- Completion gate:
  1. `python -m pytest tests -q` green (no regression).
  2. `python -m compileall -q src tests migrations` exit 0.
  3. `git diff --check` clean.
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
     `[PASS]`.
  5. New tests cover: pages 200 for administrator, 403/redirect for others;
     upload form posts multipart with CSRF token; undo control rendered only
     for undo-eligible batches; batch fields match the API response shape.
  6. Evidence file `docs/evidence/TASK-0047-IMPORTS-UI-<date>.md`.
  7. No commit, no push.

## Acceptance gate

Same as TASK-0043: completion gate + evidence + independent review PASS.
Browser visual acceptance and production deployment are separate later gates.
