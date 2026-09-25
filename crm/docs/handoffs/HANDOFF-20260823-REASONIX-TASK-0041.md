# Handoff — TASK-0041 (TASK-0040 production rollout, P0+P1) → reasonix

- Date: 2026-08-23
- From: orchestrator (zcode / GLM-5.2)
- To: **reasonix** (implementation agent) — orchestrator does NOT implement
- Task: `docs/tasks/active/TASK-0041-opportunity-production-rollout.md`
- Authorization: `DEC-0162` (batch P0+P1; P2/P3 NOT authorized)
- Spec-first: implement strictly against `SPEC-0003 v0.4.0` (behavior) +
  `SPEC-0012 v0.2.0` (deployment). Do not invent behavior beyond the SPEC.

## Verified facts (orchestrator, read-only)

- **Local `.venv` is healthy**: Python 3.12.8; `pip check` → *No broken
  requirements*; `fastapi 0.136.3` + `starlette 0.46.2` (satisfies `>=0.46.0`);
  `python-multipart 0.0.22` present; `httpx 0.28.1`. TASK-0040 code runs green
  locally (459 passed, 28 skipped).
- **The dependency break is PRODUCTION-ONLY** (TASK-0028B, 2026-08-12 inventory):
  production runtime had `fastapi 0.141.0` + `starlette 0.44.0` (mismatch) +
  `python-multipart` NOT_FOUND. => **P0 is a production-server fix, not a local
  one.**
- TASK-0040 is ACCEPTED (`DEC-0161`); its integration added `src/crm/ai/*` with
  **no new migration**; `glm-5.2` SSE client (`SseStreamingHttpClient`) already
  proven end-to-end in TASK-0040's real-LLM leg.

## Scope you own (P0 + P1 only)

- **P0 — production dependency reconciliation**: repair the production
  `starlette`/`fastapi` mismatch + add `python-multipart`, by rebuilding a
  reproducible dependency set in an **isolated** environment and switching the
  service to it. **No in-place venv surgery** (TASK-0028C proposal). No
  business-data or schema migration.
- **P1 — real external execution (controlled, no production touch)**: real
  public-site crawl + real LLM reason via provider **`glm-5.2`** (OD-006a,
  selected by product owner). Whitelist egress; R-013 leak scan before persist;
  audit model id + field names only.

## Execution gates you must respect (do NOT self-clear)

1. **P0 needs separate production-access authorization.** Before any SSH/prod
   action, get the product owner's explicit confirmation of the exact step.
   Recommended sequence: (a) read-only prod dependency inventory → (b) isolated
   local rebuild + `pip check` clean + app import → (c) switch service under a
   separate explicit prod-access confirmation, with rollback kept.
2. **P1 real calls need immediate product-owner confirmation at execution time**
   (DEC-0158 gate 2) — may incur provider cost / cross-border egress. Secrets via
   runtime env vars ONLY; never in repo/log/audit.
3. **P2 (production deployment) / P3 (G7/V1/R2 acceptance) are NOT authorized.**
   Stop at P0+P1.

## Inputs you need from the product owner (orchestrator cannot supply)

- P0: explicit production SSH-access confirmation (per step above).
- P1: the `glm-5.2` endpoint + rotated key via runtime env. Confirm whether to
  reuse the 2026-08-22 gateway (`http://129.146.135.219:3000/v1`) or a new one.

## Required verification (on completion)

- P0: prod `pip check` exit 0; import inventory complete; service health
  unchanged.
- P1: real-call audit assertions (model id + field names, no values/keys);
  R-013 `leak_findings=[]`; degraded paths honest; `pytest tests -q` green;
  `compileall` 0; `git diff --check` clean; governance `[PASS]`.
- Independent review recorded (assign a reviewer of different lineage from you).

## Handoff note

Re-check the repository yourself (do not trust this summary): confirm
`DEC-0162`, the TASK-0041 card status, `SPEC-0003`/`SPEC-0012` approval-hash
match, and current local vs production dependency state before acting.
