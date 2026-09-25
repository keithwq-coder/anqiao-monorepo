# TASK-0040: Isolated opportunity crawler and external-model integration

- Task ID: TASK-0040
  - Status: **ACCEPTED — 独立评审 PASSED，正式接受（zcode/GLM-5.2 评审，DEC-0161，2026-08-23）；覆盖本地实现 + 真实外部调用腿 + 多轮评审修复 + 真实 LLM reason 生成 + 省市站点清单 38 个**（2026-08-23）
- Task type: IMPLEMENTATION / VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
- Authorization: `DEC-0158`; execution-owner change to deepseek-v4-flash-0731 recorded in `DEC-0159`; review-owner change to Qwen3.8-max recorded in `DEC-0160`; review-owner re-designation to zcode/GLM-5.2 recorded in `DEC-0161`
- Execution owner: deepseek-v4-flash-0731 (per `DEC-0159`, 2026-08-21; was Codex)
- Review/acceptance owner: zcode / GLM-5.2 independent review (per `DEC-0161`, 2026-08-23; was Qwen3.8-max per `DEC-0160`; was Codex)
- Depends on: `TASK-0038`, `TASK-0039`, `DEC-0158`, `DEC-0159`

## Goal

Implement and verify one audited integration path for public procurement
announcements and the selected DeepSeek model, while preserving candidate-only
semantics, leak protection, human adjudication, and deterministic degradation.

## Owned scope

- Runtime-configured provider adapter and public-source crawler adapter.
- One whitelist-enforcing egress boundary.
- Audit records containing model identifier and outbound field names only.
- Timeout, provider-error, malformed-response, and leak-detection fallback.
- Synthetic/controlled fixtures and focused regression tests.
- Evidence documenting exact requests, responses, and secrets handling without
  storing secrets or protected values.

## Outbound contract

Allowed fields: announcement title, announcement body or abstract only when
needed for classification, source URL, publication timestamp, announcement
type, and non-sensitive technical metadata required for audit.

Forbidden fields: customer names, phone numbers, contact details, follow-up
bodies, CRM notes, raw customer evidence, credentials, and all non-whitelisted
protected fields.

## Required behavior

- Public tender/procurement announcements only.
- No authenticated or private sources.
- Leak scan before display or persistence of model text.
- Audit model identifier and field names, never API keys or full payloads.
- Provider/crawler failure or timeout degrades to a local deterministic reason.
- No automatic customer creation or automatic adoption; human adjudication is
  mandatory.
- Secrets are read only from runtime environment variables.

## Prerequisites and completion gate

- Prerequisites: `TASK-0038` (core done, PARTIAL), `TASK-0039` (ACCEPTED),
  `DEC-0158` authorization, approval-hash match for `SPEC-0003 v0.4.0`.
- Completion gate: focused fixture tests pass; `pytest tests -q` green;
  `python -m compileall -q src tests migrations` exit 0; `git diff --check`
  clean; governance `[PASS]`; evidence file written under `docs/evidence/`;
  Codex independent review recorded. Real external execution is a separate
  evidence leg and is not implied by local test success.

## Execution gates

1. Local isolated fixture verification may proceed without external calls.
2. Any real external request requires immediate product-owner confirmation at
   the point of execution because it may incur provider cost or cross-border
   egress.
3. Production deployment, production migration, real-data mutation, external
   writes, commit, and push are out of scope and require separate authorization.

## Verification

- Focused tests cover whitelist enforcement, leak suppression, audit metadata,
  timeout/error degradation, malformed responses, and human adjudication.
- `pytest tests -q`
- `python -m compileall -q src tests migrations`
- `git diff --check`
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`

## Acceptance gate

Task remains PARTIAL until local verification evidence passes and the provider
and crawler behavior are independently reviewed. Real external execution is a
separate evidence leg and is not implied by local test success.

## Execution record (2026-08-21, deepseek-v4-flash-0731)

All five phases executed locally; see
`docs/evidence/TASK-0040-EXTERNAL-INTEGRATION-20260821.md`:

- Phase 1: approval hash match `[VERIFIED]`; SPEC-BASELINE COMPLETE; baseline
  `356 passed, 28 skipped`; governance `[PASS]`.
- Phase 2: `src/crm/ai/whitelist.py` + `src/crm/ai/provider.py` + `src/crm/ai/audit.py`.
- Phase 3: `src/crm/ai/crawler.py` (public procurement sources, 30-day
  retention, deterministic degradation).
- Phase 4: `src/crm/ai/wiring.py`; `OpportunityService._apply_reason` unified
  R-013 scan/fallback; `crawler_reason_generator` injection; web route wiring.
- Phase 5: 26 new fixture tests; full `382 passed, 28 skipped`; compileall
  exit 0; `git diff --check` clean; governance `[PASS]`.
- Status: **PARTIAL — awaiting Codex independent review** (not self-accepted).
- Real external execution NOT performed: requires (a) rotated DeepSeek API
  key via runtime env, (b) immediate product-owner confirmation, (c) Codex
  review. No commit, no push, no production action.

## Real external-call leg (2026-08-22, deepseek-v4-flash-0731)

Real network requests executed after product-owner immediate confirmation
(DEC-0158 gate 2); see
`docs/evidence/TASK-0040-REAL-EXTERNAL-CALL-20260822.md`:

- Crawler: `make_httpx_fetcher()` + HTML list-page parser
  (`parse_announcement_list_payload`) added; 33 provincial `.gov.cn` candidates
  probed, **11 verified reachable** (2 national + 9 provincial) and kept in
  `DEFAULT_PUBLIC_SOURCES`; 22 unreachable/parse-failed candidates degraded
  and recorded, never fabricated (R-017). Commercial paid aggregator
  `cebpubservice.com` removed per product-owner direction.
- DeepSeek: one real POST to product-owner-specified endpoint
  `https://deepseek.yunjunet.cn/v1/chat/completions` (model
  `deepseek-v4-flash-0731`) with whitelist-only payload; endpoint reached but
  returned **HTTP 402 (Payment Required)** -> `ProviderRequestError` ->
  deterministic local fallback (R-015/AC-007). Audit record generated with
  model identifier + outbound field names only (R-014/AC-008). Reason
  generation itself NOT verified end-to-end until provider billing/quota is
  restored; the key was supplied by the product owner in-session and must be
  rotated again before reuse.
- Full local suite after this leg: `396 passed, 28 skipped`; compileall 0;
  `git diff --check` clean; governance `[PASS]`.
- Self-review remediation (2026-08-22, product-owner authorized): executor
  self-review + isolated review/security_review subagents found 9 issues
  (2 P1: crawler audit dead wiring, assembly chain never attached the real
  fetcher; 5 P2; 1 MED SSRF hardening; 1 LOW). All fixed and covered by
  `tests/test_task0040_fixes.py`; full suite now `421 passed, 28 skipped`;
  compileall 0; `git diff --check` clean; governance `[PASS]`. See
  `docs/evidence/TASK-0040-SELF-REVIEW-20260822.md`.
- Status: **PARTIAL — real external leg executed (crawler OK, DeepSeek 402
  degraded); self-review findings fixed; awaiting Codex independent review
  (not self-accepted).**
- No commit, no push, no production action, no customer creation.

## Real LLM reason-generation leg (2026-08-22, product-owner approved endpoint)

Product owner supplied a real LLM gateway (`http://129.146.135.219:3000/v1`,
model `glm-5.2`; see
`docs/evidence/TASK-0040-REAL-LLM-CALL-20260822.md`):

- **Diagnosis**: the gateway ALWAYS answers in SSE and requires an explicit
  `stream=true` (without it the stream is empty — a bare `[DONE]`); glm-5.2
  text arrives in `delta.content` AND `reasoning_details[].text` (non-standard
  field). The existing non-streaming provider contract could not consume it
  (ReadTimeout).
- **Fix (option A, product-owner approved)**: added `SseStreamingHttpClient`
  in `src/crm/ai/provider.py` — httpx streaming, forces `stream=true`,
  optional `max_tokens`, aggregates `delta.content` +
  `reasoning_details[].text` into the standard chat-completion JSON the
  provider already parses; timeouts/HTTP errors/empty streams degrade to
  recognizable `ProviderError`. 5 fixture tests added
  (`TestSseStreamingHttpClient`).
- **Result [VERIFIED]**: with the product-owner-supplied replacement key,
  one real call succeeded — `degraded=False`, reason 1375 chars, R-013
  `leak_findings=[]`, exactly one success audit (model id + field names only,
  no values/keys). Quota-exhausted key (403) and ReadTimeout paths were also
  exercised and degraded with truthful failure audits.
- Full suite after this leg: `457 passed, 28 skipped`; compileall 0;
  `git diff --check` clean; governance `[PASS]`.
- Status: **PARTIAL — real reason generation VERIFIED end-to-end; awaiting
  independent review (not self-accepted).**
- No commit, no push, no production action, no customer creation.

## Focused fix round (2026-08-22, product-owner instructed)

Four P1/P2 fixes implemented in one focused pass (no new handoff):

1. **P1 adjudication ownership** (`src/crm/application/opportunity.py`):
   `OpportunityService.adjudicate()` now enforces
   `candidate.recipient_user_id == actor_user_id` BEFORE any state change,
   pool creation, or audit write; a non-recipient gets the same generic
   "candidate not found" error as a missing candidate (no existence
   disclosure). Administrator actors are still bound by the service-layer
   check (route-level role checks never bypass it).
2. **P2 audit-storage failure degradation** (`src/crm/ai/provider.py`,
   `src/crm/ai/crawler.py`): provider audit-callback failures become a
   recognizable `ProviderRequestError` (never a raw 500) — on the success
   path an un-audited model text is never returned as success; on an
   already-failing request the audit failure does not mask the primary
   error. Crawler audit failure degrades THAT source and drops its
   announcements but the run continues; a failed audit never fabricates a
   successful fetch.
3. **P2 streaming body-size limit** (`src/crm/ai/crawler.py`): the real
   fetcher streams the response and caps the total at `max_body_bytes`
   while reading — an oversized body raises `ConnectionError` without ever
   materializing the full response. Manual hop-by-hop redirect validation,
   `.gov.cn` host gate, timeout/HTTP-error degradation, GBK/GB2312/UTF-8
   decode fallback, and the 2 MB default cap are all preserved.
4. **P2 government-only detail URLs** (`src/crm/ai/crawler.py`): a unified
   `is_government_public_url()` gate now covers HTML links AND JSON
   `source_url` — only http(s) with a host equal to `gov.cn` or ending in
   `.gov.cn` is kept; rejected detail URLs are dropped or fall back to the
   verified list-page URL, so they never reach
   `external_subject.source_reference`, candidate persistence, or the
   whitelist payload. Relative government paths stay legal.

Tests: `tests/test_task0040_fixes.py` (+P2/P3/P4-URL cases),
`tests/test_task0040_service_integration.py` (+P1 ownership + P2 no-un-audited-text
cases). Full suite `440 passed, 28 skipped`; compileall 0; `git diff --check`
clean (LF/CRLF warnings only); empty-tree whitespace check on the untracked
TASK-0040 files clean; governance `[PASS]`.
- Status: **PARTIAL — fixes applied; awaiting Codex independent review
  (not self-accepted).**
- No commit, no push, no production action, no customer creation, no real
  external call in this round.

## Codex review round (2026-08-22)

Codex review findings addressed in one focused pass:

1. **Source-URL fail-closed** (`src/crm/ai/crawler.py`): the list source URL
   must pass `is_government_public_url()` BEFORE any fetch; a non-government /
   non-http(s) / invalid-host source is skipped, degraded, and audited — it
   never produces announcements, and the fallback can only use the verified
   government list URL. HTML/JSON/plain-text paths stay government-URL
   fail-closed, so a non-government URL can never reach
   `NormalizedAnnouncement.source_url` / `source_reference` / persistence /
   whitelist payload.
2. **No unsafe audit defaults** (`src/crm/ai/audit.py`): `record_ai_outbound()`
   and `record_crawler_fetch()` now REQUIRE `outcome` (removed the
   `"success"` default) — a degraded/failure call can never produce a success
   audit by omission; all call sites and tests updated.
3. **Provider audit on client-raised ProviderError** (`src/crm/ai/provider.py`):
   when `http_client.post()` raises a `ProviderError` after being invoked,
   exactly one failure audit is written and the ORIGINAL `ProviderError` is
   preserved (never masked by an audit failure); fail-closed (no request)
   paths still write no outbound audit.

Regression tests: `tests/test_task0040_fixes.py` (source-url fail-closed ×5,
recorder requires outcome ×4, provider audit on client ProviderError ×3).
Full suite `452 passed, 28 skipped`; compileall 0; `git diff --check` clean;
trailing-whitespace check on untracked TASK-0040 files clean; governance
`[PASS]`.
- Status: **PARTIAL — fixes applied; AWAITS INDEPENDENT REVIEW
  (not self-accepted).**
- No commit, no push, no production action, no customer creation, no real
  external call in this round.

## Acceptance record (2026-08-23, product-owner formal acceptance)

- **Status flipped PARTIAL → ACCEPTED** by the product owner under `DEC-0161`.
- Reviewer: zcode / GLM-5.2 (Zhipu AI) independent review (`DEC-0161`),
  superseding the `DEC-0160` Qwen3.8-max assignment; the product owner
  re-designated GLM-5.2 to perform the final independent review.
- Review conclusion: **PASSED**
  (`docs/evidence/TASK-0040-ZCODE-GLM52-INDEPENDENT-REVIEW-zcode-glm52-20260823.md`):
  10 review points `[VERIFIED]`; rerun `103 passed` (focused) +
  `459 passed, 28 skipped` (full); `compileall` exit 0; `git diff --check`
  exit 0; governance `[PASS]`; `SPEC-0003 v0.4.0` approval hash match; no real
  calls re-run; no secrets stored.
- Reviewer/executor independence: GLM-5.2 (Zhipu AI) vs `deepseek-v4-flash-0731`
  (DeepSeek) — different model lineage.
- **Not opened by this acceptance**: real external execution (real LLM call,
  real site crawl), production deployment, production migration, real-data
  mutation, commit, push. These remain unverified and separately unauthorized
  under `DEC-0158`/`DEC-0159`.
- No implementation file was changed by the acceptance; only `docs/` bookkeeping
  (`DEC-0161`, this card, `TASKS.md`, `NOW.md`) was updated.

## Execution plan (landed 2026-08-21, `DEC-0159`)

Five phases; each phase completes only when its listed verification passes.
Execution owner: deepseek-v4-flash-0731. Independent review: Codex.

1. Governance preflight and ownership handover
   - Verify `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json` SHA-256 matches the current SPEC file; confirm `docs/specs/SPEC-BASELINE.md` is `COMPLETE`.
   - Run baseline: `pytest tests -q`; `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` (must be `[PASS]`).
   - Inspect runtime env vars for DeepSeek endpoint/model config; no external call when unset. Note the local `ALL_PROXY` (7897) proxy state before any real networking (unset proxy env vars for direct connection).
2. DeepSeek provider adapter + outbound whitelist + audit
   - New adapter under `src/crm/ai/`: endpoint/model/api key from runtime env vars only; secrets never in repo/logs/audit; unset config degrades, never calls.
   - Whitelist assembler: outbound payload only announcement title, body/abstract (classification-only), source URL, publication timestamp, announcement type, non-sensitive audit metadata; all other fields dropped at assembly.
   - Audit writes model identifier + outbound field names (names, not values); no protected values, keys, or full payloads (SPEC-0003 R-014 / AC-008).
   - Injectable timeouts; malformed/oversized/non-JSON response detection; failures raise recognizable exceptions for the fallback path.
3. Public-source crawler adapter + 30-day retention
   - Crawler for public tender/procurement announcement sources only; no authenticated/private sources; normalized announcement objects; 30-day retention per `DEC-0152`.
   - Failure/timeout/parse-error degrades to empty or local deterministic reason; never fabricates sources (R-017 / AC-007).
   - Replace the synthetic crawler stub injection in `src/crm/application/opportunity.py`; default (no real source enabled) stays synthetic.
4. OpportunityService wiring and degradation loop
   - Real provider/crawler path: AI reason → R-013 leak scan before persist/display → suppress and fall back to local deterministic reason on suspected protected content (AC-006).
   - Human adjudication semantics unchanged: no automatic customer creation or pool adoption; adoption path unchanged.
   - Single auditable egress path (R-016); with env vars unset the whole chain keeps synthetic-stub default behavior.
5. Fixture tests, full verification, evidence
   - Focused synthetic-fixture tests: whitelist enforcement, leak suppression/fallback, audit metadata only, timeout/malformed degradation, no auto-creation, no external call when unset.
   - Full checks: `pytest tests -q`; `python -m compileall -q src tests migrations`; `git diff --check`; governance `[PASS]`.
   - Evidence file `docs/evidence/TASK-0040-...md` (design, fixtures, sanitized request/response shapes, secret handling); card status → PARTIAL awaiting independent review.
   - Follow-up gate (NOT part of local execution): real external calls need (a) product owner rotates the previously exposed DeepSeek API key and supplies the new value via runtime env var; (b) immediate product-owner confirmation at execution time; (c) Codex independent review. Production deployment, migration, and real-data mutation remain separately authorized.
