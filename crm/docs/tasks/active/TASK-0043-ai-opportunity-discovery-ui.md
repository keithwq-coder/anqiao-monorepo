# TASK-0043: AI Opportunity Discovery UI (restore `/discovery`) + navigation repair + lightweight design baseline

- Task ID: TASK-0043
- Status: **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)**
  (executed 2026-08-25; independent review by glm-5.2 PASSED,
  evidence `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`;
  task evidence `docs/evidence/TASK-0043-DISCOVERY-UI-20260825.md`)
- Task type: IMPLEMENTATION (UI surface only; no business-rule change)
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` (v0.4.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Execution owner: deepseek-v4-flash-0713 (via reasonix dispatch)
- Review/acceptance owner: glm-5.2 (independent review, DEC-0174 — unified
  reviewer for this batch; still inspects files and reruns checks per
  SPEC-GOV-0001 R-012); not part of this task.
- Depends on: TASK-0040 ACCEPTED (DEC-0161); TASK-0041 P2 deployed; first of
  the DEC-0173 batch (later tasks depend on its design baseline).

## Goal

Expose the already-implemented SPEC-0003 v0.4.0 opportunity-discovery backend
(`src/crm/web/routes/discovery.py`: candidate run/list/detail/adjudicate,
management view) through server-rendered pages. Today `GET /discovery` is a
307 redirect to `/institutions` (main.py:495-498) and no template references
`/api/discovery`. Also repair navigation and establish the shared lightweight
design baseline that TASK-0044~0047 reuse.

## Scope

1. **Discovery pages** (new templates, page routes in `src/crm/web/main.py`):
   - `/discovery` — candidate list: title, source, published_at, AI reason
     excerpt, status (pending/采纳/忽略). Visible to roles the API allows;
     masked exactly as the API projection.
   - `/discovery/candidates/{id}` — detail page: full AI reason text, source
     URL, metadata; adjudicate form (采纳 / 忽略 → POST
     `/api/discovery/candidates/{id}/adjudicate`) for authorized roles.
   - Admin-only: trigger-run control (POST `/api/discovery/candidates/run`)
     and management view section (GET `/api/discovery/candidates/management`).
2. **Navigation repair** (`templates/base.html`): add 商机 (`/discovery`) and
   账号设置 (`/account/settings`) entries; role-conditional rendering where the
   backend requires admin; delete the dead empty conditional block at
   base.html:21-22.
3. **Design baseline** (`static/css/style.css`): introduce CSS custom
   properties (color, spacing, radius, font-size scale); unify existing
   `.card`/`.btn`/table/form classes onto the tokens. No framework, no CDN,
   no build step, no new dependencies. Visual refresh only — no layout
   rewrite of existing pages beyond token adoption.

## Owned files

- `templates/discovery_list.html` (new), `templates/discovery_detail.html` (new)
- `templates/base.html` (nav)
- `src/crm/web/main.py` (page routes only; replace the `/discovery` redirect)
- `static/css/style.css` (design tokens)
- `tests/test_task0043_discovery_ui.py` (new)

## Out of scope

- Backend business logic, new business API endpoints, crawler/LLM behavior.
- Policy/masking changes; SPEC text or approval.json changes.
- Database migrations, production deployment, commit, push.
- Customer-edit feature (no backend API exists; separate SPEC question).

## Prerequisites and completion gate

- Prerequisites: DEC-0173; no in-flight change to the owned files.
- Completion gate:
  1. `python -m pytest tests -q` green (full suite must not regress from
     457 passed, 28 skipped; the 459 figure in earlier drafts predates
     DEC-0172 — 457 is the measured post-convergence baseline).
  2. `python -m compileall -q src tests migrations` exit 0.
  3. `git diff --check` clean.
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
     `[PASS]`.
  5. New tests cover: discovery pages 200 for authorized roles and 403/redirect
     for unauthorized; page content matches the API masked projection (no extra
     fields); admin-only controls absent for business_user/manager; CSRF token
     present on the adjudicate form.
  6. Evidence file `docs/evidence/TASK-0043-DISCOVERY-UI-<date>.md` with
     commands actually run and outputs.
  7. No commit, no push.

## Acceptance gate

ACCEPTED only after the completion gate passes, evidence is on disk, and
independent review by glm-5.2 (DEC-0174, unified reviewer for this batch)
reports PASS. Browser visual
acceptance by the product owner is a separate later gate. Production
deployment is separately unauthorized.
