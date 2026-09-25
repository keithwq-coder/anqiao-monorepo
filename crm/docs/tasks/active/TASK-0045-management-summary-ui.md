# TASK-0045: Management summary UI (administrator company-wide / manager scoped, read-only)

- Task ID: TASK-0045
- Status: **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)**
  (executed 2026-08-25; independent review by glm-5.2 PASSED,
  evidence `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`;
  task evidence `docs/evidence/TASK-0045-MANAGEMENT-SUMMARY-UI-20260825.md`)
- Task type: IMPLEMENTATION (UI surface only; no business-rule change)
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
  (v0.4.1); the admin opportunity-management link is governed by
  `SPEC-0003 v0.4.0`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Execution owner: deepseek-v4-flash-0713 (via reasonix dispatch)
- Review/acceptance owner: glm-5.2 (independent review, DEC-0174 — unified
  reviewer for this batch; still inspects files and reruns checks per
  SPEC-GOV-0001 R-012); not part of this task.
- Depends on: TASK-0043 (design baseline / nav pattern).

## Goal

Expose the already-implemented management summary API
(`GET /api/admin/summary`, src/crm/web/routes/admin.py:327 — masked
collaborator projection) through a read-only page. Post-DEC-0172 semantics:
administrator sees the company-wide masked summary; manager (e.g. 赵/武,
scope=苏州) sees only the authorized-scope masked summary; business_user gets
403/redirect. Management is read-only by default.

## Scope

1. New `/management` page route + `templates/management_summary.html`:
   renders exactly the masked projection the API returns — no extra fields,
   no unmasking, no action controls beyond navigation.
2. Role-conditional nav entry (administrator / manager only).
3. Link/section entry to the admin opportunity-management view delivered in
   TASK-0043 (admin only).
4. Reuse TASK-0043 design tokens.

## Owned files

- `templates/management_summary.html` (new)
- `templates/base.html` (nav entry)
- `src/crm/web/main.py` (page route only)
- `static/css/style.css` (additive only)
- `tests/test_task0045_management_summary_ui.py` (new)

## Out of scope

- Backend business logic or new business API endpoints; policy/masking changes
  (page must not widen what the API returns).
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
  5. New tests cover: administrator sees company-wide summary; manager sees
     scoped summary only (region-scoped data, no company-wide figures);
     business_user gets 403/redirect; page fields ⊆ API masked projection.
  6. Evidence file `docs/evidence/TASK-0045-MANAGEMENT-SUMMARY-UI-<date>.md`.
  7. No commit, no push.

## Acceptance gate

Same as TASK-0043: completion gate + evidence + independent review PASS.
Browser visual acceptance and production deployment are separate later gates.
