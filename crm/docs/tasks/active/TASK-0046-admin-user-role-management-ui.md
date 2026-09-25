# TASK-0046: Admin user/role management UI (grant/revoke, enable/disable, transfer, erasure)

- Task ID: TASK-0046
- Status: **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)**
  (executed 2026-08-25; independent review by glm-5.2 PASSED,
  evidence `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`;
  task evidence `docs/evidence/TASK-0046-ADMIN-UI-20260825.md`)
- Task type: IMPLEMENTATION (UI surface only; no business-rule change)
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
  (v0.4.1); erasure leg governed by
  `docs/specs/30-approved/SPEC-0011-data-lifecycle.md` (v0.2.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
  and `docs/specs/30-approved/SPEC-0011-data-lifecycle.approval.json`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Execution owner: deepseek-v4-flash-0713 (via reasonix dispatch)
- Review/acceptance owner: glm-5.2 (independent review, DEC-0174 — unified
  reviewer for this batch; still inspects files and reruns checks per
  SPEC-GOV-0001 R-012); not part of this task.
- Depends on: TASK-0043 (design baseline / nav pattern).

## Goal

Expose the already-implemented admin APIs (`src/crm/web/routes/admin.py`:
roles grant/revoke :122/:156, users enable/disable :193/:221, institution
transfer single/batch :266/:297, erasure :355) through an admin-only UI.
Today all of them are API-only.

## Scope

1. New admin-only `/admin` section (page routes + templates):
   - **User list**: users with their roles; grant/revoke role
     (administrator / manager / business_user only — general_manager was
     removed by DEC-0172), enable/disable.
   - **Customer transfer**: single and batch transfer forms with mandatory
     reason input.
   - **Data erasure** (SPEC-0011): per-institution erase action with
     mandatory reason + explicit irreversible confirmation text.
2. Every mutating control posts to the existing `/api/admin/*` endpoints with
   the reason fields the API requires; **no new backend endpoints**.
3. Admin-only nav entry; non-admin roles get 403/redirect.
4. Reuse TASK-0043 design tokens.

## Owned files

- `templates/admin_users.html` (new), `templates/admin_transfer.html` (new),
  `templates/admin_erase.html` (new) — executor may consolidate into fewer
  templates if simpler; record the choice in the evidence file.
- `templates/base.html` (nav entry)
- `src/crm/web/main.py` (page routes only)
- `static/css/style.css` (additive only)
- `tests/test_task0046_admin_ui.py` (new)

## Out of scope

- Backend business logic or new business API endpoints; policy/masking changes.
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
  5. New tests cover: admin pages 200 for administrator and 403/redirect for
     manager/business_user; grant/revoke offers only the three live roles;
     erase UI requires reason + confirmation before submit; CSRF tokens on
     all forms.
  6. Evidence file `docs/evidence/TASK-0046-ADMIN-UI-<date>.md`.
  7. No commit, no push.

## Acceptance gate

Same as TASK-0043: completion gate + evidence + independent review PASS.
Browser visual acceptance and production deployment are separate later gates.
