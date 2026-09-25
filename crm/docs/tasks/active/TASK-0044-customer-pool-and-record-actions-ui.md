# TASK-0044: Public-pool UI + customer record action UI (archive / release / claim / type change / correct / withdraw)

- Task ID: TASK-0044
- Status: **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)**
  (executed 2026-08-25; independent review by glm-5.2 PASSED,
  evidence `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`;
  task evidence `docs/evidence/TASK-0044-POOL-ACTIONS-UI-20260825.md`)
- Task type: IMPLEMENTATION (UI surface only; no business-rule change)
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
  (v0.8.1); list filtering also governed by `SPEC-0008`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Execution owner: deepseek-v4-flash-0713 (via reasonix dispatch)
- Review/acceptance owner: glm-5.2 (independent review, DEC-0174 — unified
  reviewer for this batch; still inspects files and reruns checks per
  SPEC-GOV-0001 R-012); not part of this task.
- Depends on: TASK-0043 (shares `base.html` / `style.css`; reuses its design
  tokens and nav pattern).

## Goal

Expose the already-implemented SPEC-0001 lifecycle APIs that today have no UI:
archive, release-to-pool, claim, customer-type change
(`src/crm/web/routes/institutions.py`), and follow-up correct/withdraw
(`src/crm/web/routes/followups.py`). `institution_detail.html` currently shows
data but has no action buttons; the public pool is only a passive badge.

## Scope

1. **Detail-page actions** (`templates/institution_detail.html`): action
   buttons with reason/confirmation inputs, rendered only for roles the API
   authorizes —
   - 归档 (POST `/api/institutions/{id}/archive`, reason input);
   - 释放进公池 (POST `/api/institutions/{id}/release-to-pool`, admin, reason);
   - 认领 (POST `/api/institutions/{id}/claim`, business_user);
   - 客户类型变更 (POST `/api/institutions/{id}/customer-type`);
   - 跟进更正 / 撤回 (POST `.../activities/{aid}/correct|withdraw`, reason).
2. **Public-pool list page**: pool customers with 认领 buttons. Executor picks
   the simpler route consistent with existing conventions (dedicated `/pool`
   page route, or `/institutions?pool=1` if the existing page route already
   supports it). If a needed filter param does not exist in the backend, STOP
   and report — do not add business logic.
3. **List filters** (`templates/institutions_list.html`): customer-type /
   region / source filters as GET params on the existing page route, only for
   params the backend already supports; same STOP-and-report rule.
4. Reuse TASK-0043 design tokens; add nav entry for the pool page.

## Owned files

- `templates/institution_detail.html`, `templates/institutions_list.html`
- `templates/pool_list.html` (new, if dedicated route chosen)
- `src/crm/web/main.py` (page routes only)
- `static/css/style.css` (additive component styles only)
- `tests/test_task0044_pool_actions_ui.py` (new)

## Out of scope

- Backend business logic or new business API endpoints; policy/masking changes.
- SPEC text or approval.json changes; database migrations.
- Production deployment, commit, push; customer-edit feature.

## Prerequisites and completion gate

- Prerequisites: DEC-0173; TASK-0043 completed or at least its `base.html` /
  `style.css` baseline landed.
- Completion gate:
  1. `python -m pytest tests -q` green (no regression).
  2. `python -m compileall -q src tests migrations` exit 0.
  3. `git diff --check` clean.
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
     `[PASS]`.
  5. New tests cover: role-conditional visibility of every action (e.g.
     release-to-pool hidden from business_user; claim hidden from admin),
     CSRF tokens on all forms, pages render masked data identical to the API
     projection.
  6. Evidence file `docs/evidence/TASK-0044-POOL-ACTIONS-UI-<date>.md`.
  7. No commit, no push.

## Acceptance gate

Same as TASK-0043: completion gate + evidence + independent review PASS.
Browser visual acceptance and production deployment are separate later gates.
