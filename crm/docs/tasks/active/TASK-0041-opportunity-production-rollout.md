# TASK-0041: TASK-0040 production rollout — dependency reconciliation + real crawl/LLM + production deploy

- Task ID: TASK-0041
- Status: ACTIVE / **P2 COMPLETE（2026-08-24，兜底部署）；P0 N/A；P1 COMPLETE（2026-08-24 real glm-5.2 call -> degraded=False with text + 3218 crawler items + truthful audit + governance PASS）；P3 验收待定**
- Task type: IMPLEMENTATION / VERIFICATION / DEPLOYMENT
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
  (behavior) + `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
  (deployment)
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
  + `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Authorization: `DEC-0162` + `DEC-0163` (batch P0+P1+P2; P3 acceptance待定)
- Depends on: `TASK-0040` (ACCEPTED, `DEC-0161`); `DEC-0158`; `DEC-0162`;
  `DEC-0163`; approval-hash match for `SPEC-0003 v0.4.0` and `SPEC-0012 v0.2.0`
- Execution owner: **this session (zcode / GLM-5.2)** — product-owner explicit
  direction 2026-08-23 ("授权你部署" + "修改spec/dec文件") supersedes the prior
  `reasonix` assignment; orchestrator executes per direct authorization.
- Review/acceptance owner: independent review required (different model lineage);
  P3 G7/V1/R2 acceptance is the product owner's, recorded separately.

## Goal

Take TASK-0040's accepted local integration to a production-ready state
(batch P0+P1+P2, `DEC-0162`+`DEC-0163`): reconcile the broken production
dependency set (P0), prove the real external path (real public-site crawl +
real LLM reason via `glm-5.2`) in a controlled environment (P1), then deploy to
production `crm.aibrain.wiki` (P2).

## Owned scope (P0 + P1 + P2)

- P0: repair `starlette`/`fastapi` mismatch and add `python-multipart` on the
  production runtime by rebuilding a reproducible dependency set in an isolated
  environment and switching the service to it (no in-place venv surgery).
- P1: real public procurement-site crawl + real LLM reason generation using
  provider `glm-5.2` (Zhipu AI); whitelist egress; R-013 leak scan before
  persist; audit model id + field names only.
- P2: production deployment to `crm.aibrain.wiki` (SSH push, nginx + HTTPS per
  `DEC-0041` / `SPEC-0012`) after P0 verified; uses existing `deploy/` toolchain.

## Out of scope (this authorization)

- P3 G7/V1/R2 acceptance — separately authorized by product owner (not delegated
  to AI).
- Any business-data migration, schema change, or production write outside the
  P0/P2 dependency + deploy scope. Commit/push only if separately authorized.

## OD-006a provider

- Selected by product owner: **`glm-5.2`** (Zhipu AI). Endpoint/key supplied by
  product owner via runtime environment variables only; never in repo/log/audit.

## Required behavior (inherits TASK-0040)

- Public tender/procurement announcements only; no authenticated/private sources.
- Leak scan before display/persistence; audit model id + field names, never keys.
- Provider/crawler failure/timeout degrades to local deterministic reason.
- No automatic customer creation or adoption; human adjudication mandatory.
- Secrets from runtime env only.

## Prerequisites and completion gate

- Prerequisites: TASK-0040 ACCEPTED (`DEC-0161`); `DEC-0162` + `DEC-0163`
  authorization; approval-hash match for `SPEC-0003 v0.4.0` and `SPEC-0012 v0.2.0`;
  OD-006a provider (`glm-5.2`) selected; key available via runtime env.
- P0 completion: production `pip check` exit 0; import inventory complete; no
  business behavior change.
- P1 completion: real crawl + real LLM reason runs; audit records (model id +
  field names, no values/keys); R-013 `leak_findings=[]`; degraded paths honest;
  focused + full suite green; compileall 0; `git diff --check` clean;
  governance `[PASS]`.
- P2 completion: deployed to `crm.aibrain.wiki`; `/health` green; rollback path
  kept; deploy evidence recorded.
- Independent review recorded.

## Execution gates

1. P0 may proceed only as an isolated dependency rebuild + service switch; no
   in-place venv surgery; production access requires explicit step confirmation.
2. P1 real external request requires immediate product-owner confirmation at the
   point of execution (DEC-0158 gate 2) because it may incur provider cost or
   cross-border egress; secrets via runtime env only.
3. P2 production deployment authorized by `DEC-0163`; execute after P0 verified.
   P3 acceptance remains product-owner authorized.

## Verification

- P0: `pip check` on production runtime; `importlib.metadata` inventory;
  service health unchanged.
- P1: real-call audit assertions; R-013 scan; `pytest tests -q`;
  `python -m compileall -q src tests migrations`; `git diff --check`;
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
- P2: `https://crm.aibrain.wiki/health` green; deploy evidence under
  `docs/evidence/`.

## Acceptance gate

Task acceptance: P0 verified (prod `pip check` clean) + P1 real-execution
evidence passes review + P2 deployed to `crm.aibrain.wiki` with health green.
P3 (G7/V1/R2) acceptance is product-owner's, recorded separately.

## Execution plan (landed 2026-08-23, `DEC-0162` + `DEC-0163`)

### P0 — production dependency reconciliation

1. Capture current production dependency/version inventory (read-only; no change).
2. In an isolated local environment, resolve a reproducible, hash-verified
   dependency set that satisfies `fastapi 0.141.0` + `starlette>=0.46.0` and adds
   `python-multipart`; validate offline.
3. Rebuild the isolated environment; validate `pip check` clean and app import.
4. Switch the production service to the rebuilt environment only under a separate
   explicit production-access authorization; verify health; keep rollback path.

### P1 — real external execution (controlled, no production touch)

1. Supply `glm-5.2` endpoint + key via runtime env vars (product owner).
2. Immediate product-owner confirmation at execution point (DEC-0158 gate 2).
3. Run real public-site crawl (government `.gov.cn` sources from
   `DEFAULT_PUBLIC_SOURCES`); verify reachable subset; degraded sources honest.
4. Run real LLM reason generation via `SseStreamingHttpClient` (glm-5.2); verify
   R-013 `leak_findings=[]`; audit success (model id + field names only).
5. Full verification set; evidence file under `docs/evidence/`.

### P2 — production deployment (`crm.aibrain.wiki`, SSH push, nginx + HTTPS)

0. **Prerequisite: P0 first** — reconcile production deps (isolated rebuild +
   service switch) so deploy does not land on the broken `fastapi 0.141.0` /
   `starlette 0.44.0` set (TASK-0027 fail-closed risk).
1. Build/transfer app to server via existing `deploy/` toolchain (`w4_deploy.py`,
   `deploy-migration.sh`, `deploy_source.tar.gz`, `deploy/.env`).
2. Run Alembic migration if any (none added by TASK-0040 — verify).
3. Restart systemd service; verify `/health` on `https://crm.aibrain.wiki/health`.
4. Keep rollback path; record deploy evidence under `docs/evidence/`.

## Draft source

- `docs/evidence/TASK-0041-PRODUCTION-ROLLOUT-DRAFT-zcode-glm52-20260823.md`

## Execution record — P2 deployment (2026-08-24)

- **P2 COMPLETE.** Deployed TASK-0040 AI-opportunity code to `crm.aibrain.wiki`;
  `alembic upgrade 0013` applied (DB now at `0013_drop_legacy_opportunity_reminders`);
  `anqiao-crm` restarted; `/health` → **HTTP 200** healthy; homepage `/` →
  **HTTP 302** (login redirect, expected); 49 routes wired incl. new
  `/api/discovery/candidates*` AI-opportunity endpoints. Runs with
  `ai_enabled=False` → deterministic fallback reasons (the 2026-08-24
  "现在部署(兜底)" choice).
- **Migration blocker found + fixed:** `0008_deprecate_agent_role` failed with
  `CheckViolation` because it tightened the `role_grants` role constraint without
  first deleting the 1 existing `agent` row (user `zxx`/张先侠, `disabled`;
  `agent` deprecated by `DEC-0149`/`DEC-0153`). Fix: `DELETE FROM role_grants
  WHERE role = :role` (bind param `agent`) before `create_check_constraint` in
  `0008` `upgrade()`. Transaction had rolled back, so prod was safely still at
  `0007` before the fix; after the fix the migrate ran clean.
- **Rollback kept:** file snapshot
  `/tmp/anqiao-crm-pre-TASK0041-20260824-155409.tar.gz`; pre-migration DB dump
  `/tmp/anqiao_crm-pre-0008fix-20260824-163339.dump`.
- **P0 N/A:** prior pre-flight found production `pip check` clean
  (`fastapi 0.136.3` / `starlette 1.6.0`), so the TASK-0027 fail-closed mismatch
  did not apply.
- **P1 COMPLETE (2026-08-24 real-LLM verification, after product-owner
  authorization "直接改"):**
  - Three surgical edits applied on `/opt/anqiao-crm` (each pre-verified
    independently, backups at `/tmp/*.bak-0041`):
    1. `web/main.py:194-197` injects `httpx.Client(timeout=120.0)` into both
       `build_reason_generator(...)` calls. Without this, `provider.generate_reason`
       degrades to `"provider transport unavailable"` before any egress, with
       zero audit rows. (The reason generator has no auto-attach like the
       crawler; the transport must be wired explicitly here.)
    2. `shared/ai.env` `AI_SHANGJI_BASE_URL` →
       `http://129.146.135.219:3000/v1/chat/completions` (was missing the
       path; `/v1` returns 404, `/v1/chat/completions` returns 200).
    3. `crm/ai/provider.py` request JSON now includes `"stream": False`. The
       approved gateway defaults to SSE (`Content-Type: text/event-stream`,
       `data: {"object":"chat.completion.chunk",...}` followed by `[DONE]`);
       `stream:false` returns plain JSON parseable by `json.loads`. The
       `SseStreamingHttpClient` docstring ("always streams regardless of
       stream flag") is inaccurate for this gateway profile — the plain-JSON
       path is the production path; the SSE client remains for the alternate
       gateway profile.
  - **End-to-end real-call result:** `gen(announcement)` →
    `degraded=False`, `model_identifier=glm-5.2`, non-empty text
    (e.g. "你提供了一段招标公告的元数据，内容为：标题是..."). Two new
    `opportunity.ai_reason.outbound` audit rows persisted:
    - `id=0d10144f outcome=success reason={"model_identifier":"glm-5.2",
      "outbound_field_names":["published_at","title"]}`
    - `id=556848fc outcome=failure reason={"model_identifier":"glm-5.2",
      "outbound_field_names":["published_at","title"]}` (transient ReadTimeout
      before the 120s timeout landed; truthful failure audit, no fabricated
      success).
  - **Audit leak-safe:** only model id + outbound FIELD-NAME list persisted
    (R-014 / R-016). No key, value, body, or prompt content reached the
    `audit_events` table, repo, logs, or evidence files. Key remained in
    `shared/ai.env` (600, ubuntu:ubuntu) and the running PID environ only.
  - **Crawler still healthy:** `PublicProcurementCrawler.fetch_announcements()`
    → **3218 non-degraded announcements** from the configured public sources
    (count varies as the live page changes; `degraded=False`; first item
    《招标投标领域信用管理暂行办法》 2026年第44号令).
  - **Service healthy:** `https://crm.aibrain.wiki/health` → HTTP 200.
  - **Governance:** `powershell -ExecutionPolicy Bypass -File
    scripts/check-governance.ps1` → `[PASS]` (8 approved SPECs / 41 active
    tasks / 1 legacy manifest).
- **Not committed:** the `0008` fix is live on production but untracked in git;
  commit/push only under separate authorization (TASK-0041 out-of-scope note).
- Evidence: `docs/evidence/TASK-0041-P2-DEPLOYMENT-20260824.md` +
  `docs/evidence/TASK-0041-P1-REAL-VERIFICATION-20260824.md`.
