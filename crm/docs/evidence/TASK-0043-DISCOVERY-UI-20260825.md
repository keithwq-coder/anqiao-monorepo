# TASK-0043: AI Opportunity Discovery UI — execution evidence

- Task: `docs/tasks/active/TASK-0043-ai-opportunity-discovery-ui.md`
- Authorization: `DEC-0173` (2026-08-25, batch TASK-0043~0047)
- Approved SPEC: `SPEC-0003 v0.4.0` (30-approved, matching approval hash
  verified by `scripts/check-governance.ps1`)
- Executed: 2026-08-25, by Reasonix (this session; the task card records the
  coordinator-designated executor as deepseek-v4-flash-0713 via reasonix
  dispatch — this batch was pasted to this session, which executed it;
  identity field noted for the handoff, no scope difference)
- Status: **EXECUTED — AWAITING INDEPENDENT REVIEW** (NOT SELF-ACCEPTED)

## What was changed

| File | Change |
|---|---|
| `templates/base.html` | Navbar: added 商机 `/discovery` (business_user/administrator only) and 账号设置 `/account/settings` (all signed-in users); **deleted the dead empty conditional block** (former lines 21-22) |
| `static/css/style.css` | **Design-token baseline**: `:root` CSS custom properties (color palette, spacing scale, radius scale, font-size scale, shadows, navbar gradient/height); existing `.card`/`.btn`/table/form/timeline/alert/stat-card etc. unified onto the tokens. Added small additive components: `.status-tag` (pending/accepted/ignored), `.action-group`, `.action-form`, `.inline-actions`, `.alert-inline`. No framework, no CDN, no build step, no new dependency |
| `src/crm/web/main.py` | Replaced the `/discovery` 307 redirect (old main.py:495-498) with real page routes: `GET /discovery` (candidate list + admin-only management view + trigger-run control) and `GET /discovery/candidates/{candidate_id}` (detail + adjudicate form). Page routes only — no new business API, no business-rule change; they call the same `OpportunityService` the JSON API uses |
| `templates/discovery_list.html` | NEW — candidate list (candidate_text title, source label, discovered_at, AI reason excerpt, status tag), admin-only trigger-run button (`POST /api/discovery/candidates/run` via fetch + `X-CSRF-Token`) and admin-only desensitized management view (renders exactly the `list_desensitized()` projection) |
| `templates/discovery_detail.html` | NEW — full candidate detail (reason, key uncertainties, masked involved records, external subject name/region, timestamps, status) + human adjudicate form (采纳/忽略) carrying a hidden CSRF token; submission posts JSON to the existing `POST /api/discovery/candidates/{candidate_id}/adjudicate` with the `X-CSRF-Token` header |
| `tests/test_task0043_discovery_ui.py` | NEW — 9 tests (role visibility, masked-projection parity, admin-only controls, CSRF, nav) |

## Design decisions (recorded per task card)

1. **Write actions reuse the existing `/api/` endpoints** (task card: "POST to
   the existing API"). HTML forms cannot set the `X-CSRF-Token` header, so
   each form carries a hidden `csrf_token` field and a small inline script
   submits via `fetch` with the header — the CSRF middleware (deps.py) then
   validates it exactly as it does for the JSON API. This keeps `main.py`
   page-route-only (hard boundary) and reuses all server-side authorization
   and audit logic unchanged.
2. **Candidate "published_at" mapping**: the SPEC-0003 v0.4.0 candidate
   projection has no `published_at`; the list page shows `discovered_at` as
   the timestamp column (the only timestamp the API returns).
3. **Management view is server-rendered** from `OpportunityService.list_desensitized()`
   — the same method the JSON endpoint `GET /api/discovery/candidates/management`
   calls, so the page projection is identical to the API projection.

## Completion gate (commands actually run)

| Gate | Command | Result |
|---|---|---|
| 1 | `python -m pytest tests -q` | **466 passed, 28 skipped** (baseline before this task measured 457 passed, 28 skipped — see note below; no regression) |
| 2 | `python -m compileall -q src tests migrations` | exit 0 |
| 3 | `git diff --check` | clean |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` — 9 approved SPECs / 46 active tasks / 1 legacy manifest |
| 5 | `python -m pytest tests/test_task0043_discovery_ui.py -q` | **9 passed** — covers: 200 for business_user/administrator, 403 for manager, 302→/login anonymous, page content ⊆ API masked projection (per-candidate id/link/reason excerpt parity, no `recipient_user_id`/`adjudicated_by_user_id`/`model_identifier` leakage into the page), admin-only run button + management view present for admin and absent for business_user, management view renders only the desensitized projection, adjudicate form carries CSRF token and posts to the existing API, nav has 商机/账号设置 and no admin-only entries yet |
| 6 | Evidence file | this file |
| 7 | No commit, no push | honored (work tree only) |

## Baseline number note

The task card cites "459 passed, 28 skipped" as the full-suite baseline; the
pre-change measurement on 2026-08-25 is **457 passed, 28 skipped** (consistent
with the 2026-08-24 role-convergence entry in `docs/NOW.md`, which records 457
after the DEC-0171/0172 changes). The card number predates that convergence.
No regression: 466 = 457 + 9 new.

## NOT VERIFIED

- Browser visual acceptance (product owner, separate later gate).
- Independent review by glm-5.2 (DEC-0174 — unified reviewer for this
  batch; still inspects files and reruns checks per SPEC-GOV-0001 R-012).
  Not yet performed.
- Production deployment — separately unauthorized.
- Real LLM/crawler egress — gated by OD-006a, not exercised (synthetic only).

## Files touched (diff summary)

- `templates/base.html`, `static/css/style.css`, `src/crm/web/main.py`
- `templates/discovery_list.html` (new), `templates/discovery_detail.html` (new)
- `tests/test_task0043_discovery_ui.py` (new)
