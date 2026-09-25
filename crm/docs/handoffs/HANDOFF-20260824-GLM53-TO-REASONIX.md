# HANDOFF-20260824-GLM53-TO-REASONIX

- Task: TASK-0041 (TASK-0040 production rollout) follow-through plus
  TASK-0042 rename + STEP-3/4/5 review and readiness evidence
- From tool/model: zcode / GLM-5.3 (this session, continuing `sess_ea1152f6`
  ← `sess_b2bde06b` ← `sess_bb88b84a`)
- To tool/model: reasonix
- Handoff status: HANDOFF-ONLY
- Repository state: 6 commits landed this session on `main` (NOT pushed —
  there is no `origin` remote; `git remote -v` is empty). The working tree
  also contains ~183 modified / untracked / deleted paths from prior
  sessions that this session did NOT touch and did NOT commit.
- Written at: 2026-08-24 (timezone +0800)

## Required reading

- `AGENTS.md` — non-negotiable start sequence; SDD state machine; safety
  boundaries; completion-report format.
- The prior handoff this session continued:
  `docs/handoffs/HANDOFF-20260824-GLM52-TO-GLM53-TASK-0041.md`.
- Approved SPEC + metadata relevant to this handover:
  - `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
    (`.approval.json`, v0.4.0).
  - `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
    (`.approval.json`, v0.2.0).
- Decision records:
  - `DEC-0162` + `DEC-0163` — batch P0+P1+P2 authorization, product-owner
    2026-08-23 "确认 P0+P1，provider 用 glm-5.2" / "是的，授权".
  - `DEC-0158` — gate 2 (real-execution confirmation + runtime-env-only secrets).
  - `DEC-0164` — TASK-0042 rename authorization.
  - `DEC-0165` (this session) — independent review batch carry-forward /
    re-verify verdict on TASK-0028 / TASK-0029 / TASK-0035 / TASK-0036 /
    TASK-0037 / TASK-0038; TASK-0027 marked STALE.
  - `DEC-0166` (this session) — TASK-0001 G6 PASS carry-forward + TASK-0027
    STALE closure + W5 readiness verified (no new production mutation
    authorized by this DEC).
- Evidence files (this session):
  - `docs/evidence/TASK-0041-P1-LLM-COMPLETION-20260824.md`
  - `docs/evidence/TASK-0042-NAMING-CLEANUP-20260824.md` (pre-existing)
  - `docs/evidence/STEP3-INDEPENDENT-REVIEW-BATCH-20260824.md`
  - `docs/evidence/STEP5-G6-W5-READINESS-20260824.md`

## Verified current state

### 1. Commits landed this session (NOT pushed; `origin` remote is empty)

```
bbb01d3 STEP-5: TASK-0001 G6 PASS carry-forward + TASK-0027 STALE; W5 readiness verified
0c0adcf STEP-4: TASK-0038 PARTIAL -> COMPLETE (residual items closed)
5956f6f STEP-3: independent review batch (DEC-0165)
5ab2095 TASK-0042: unify CRM_AI_REASON_* env names + AiReasonProvider class
3191c41 TASK-0041 P2 + align config gate to DEC-0162/0163
b69c4f0 TASK-0041 P1: enable real glm-5.2 reasoning on production (DEC-0162 + DEC-0163)
```

Plus the two pre-existing baseline commits:

```
59101b8 TASK-0018: add prerequisites/completion gate section required for active tasks
f070e8e Baseline: governance + SPEC implementation through DEC-0119
```

### 2. Production server state (`/opt/anqiao-crm`)

- Service `anqiao-crm` active (PID restarted in this session).
- `https://crm.aibrain.wiki/health` → HTTP 200 healthy.
- `pip check` (prod `/opt/anqiao-crm/venv`) → "No broken requirements found".
- Runtime versions: `fastapi 0.136.3` / `starlette 1.6.0` /
  `sqlalchemy 2.0.51` / `alembic 1.18.4` / `psycopg 3.3.4`.
- Alembic head: `0013_drop_legacy_opportunity_reminders`.
- `/opt/anqiao-crm/shared/ai.env` (600, `ubuntu:ubuntu`) holds 6 lines, all
  in canonical `CRM_AI_REASON_*` form (this session renamed from
  `AI_SHANGJI_*`); running PID environ contains all 6 vars by name.
- Backups on prod server:
  - `/tmp/main.py.bak-0041`
  - `/tmp/provider.py.bak-0041`
  - `/tmp/ai.env.bak-0041`
- Code files actually deployed this session (NOT just edited in repo):
  - `/opt/anqiao-crm/src/crm/web/main.py` — injects
    `httpx.Client(timeout=120.0)` into both `build_reason_generator` calls.
  - `/opt/anqiao-crm/src/crm/ai/provider.py` — `AiReasonProvider` class +
    `"stream": False` in the request JSON + reconciled `SseStreamingHttpClient`
    docstring (the docstring claim "always streams regardless of stream flag"
    is inaccurate for this gateway profile; plain-JSON path is production).
  - `/opt/anqiao-crm/src/crm/ai/wiring.py` — unified `CRM_AI_REASON_*` naming.

### 3. Real-LLM egress (TASK-0041 P1) — VERIFIED LIVE

- `AiReasonProvider(http_client=httpx.Client(timeout=180.0), network_allowed=True)`
  → `degraded=False`, `model_identifier=glm-5.2`, 176 chars of Chinese text.
- Two `opportunity.ai_reason.outbound` audit rows persisted in
  `audit_events`:
  - `id=6ed8e3ef outcome=success reason={"model_identifier":"glm-5.2",
    "outbound_field_names":["published_at","title"]}`
  - `id=0d10144f outcome=success reason={"model_identifier":"glm-5.2",
    "outbound_field_names":["published_at","title"]}`
- Audit carries **only** model id + outbound field-name list (R-014 / R-016).
  No key, value, body, or prompt content reached the `audit_events` table,
  the repo, logs, or any evidence file.
- Key (`AI_SHANGJI_API_KEY` ⇒ `CRM_AI_REASON_API_KEY`) lives in
  `/opt/anqiao-crm/shared/ai.env` (600, ubuntu:ubuntu) and the running PID
  environ only.

### 4. Real crawler (TASK-0041 P1) — VERIFIED LIVE

- `PublicProcurementCrawler(sources=DEFAULT_PUBLIC_SOURCES, fetcher=make_httpx_fetcher(), network_allowed=True)`
  → `CRAWL count: 3216 degraded: False` (first item 《招标投标领域信用管理暂行办法》
  2026年第44号令).
- SSRF whitelist (`.gov.cn` only) + `is_government_public_url` pre-check +
  parse all functioned.

### 5. Working tree state (NOT committed by this session)

`git status --short` reports ~183 paths: 55 modified, 7 deleted,
129 untracked. This session did NOT touch any of them. They come from
prior sessions (TASK-0001 task card, TASK-0018 evidence task card,
SPEC-0001/0002/0003/0012/0014 text + approval.json edits, README.md,
PROJECT.md, MODEL-ROUTING.md, WORKFLOW.md, INDEX.md, TASKS.md,
templates/*, tests/test_task0008_*, test_task0011, test_task0014,
test_task0015, test_task0017, test_task0018, test_task0036 etc., and a
large number of `src/crm/{application,config,domain,persistence,policy,
web,ai}/*.py` paths that were already in the dirty tree before this
session started).

**These are NOT this session's responsibility.** Re-run
`git status --short` after this session to confirm the inventory; commit
them only under their own task cards (TASK-0001, TASK-0018, SPEC-0014 v0.3.0
amendment, etc.) with their own authorizations.

## Decisions taken this session

### DEC-0165 (independent review batch)
Carry-forward PASS verdicts on:
- TASK-0029 (Codex 2026-08-13 acceptance re-affirmed)
- TASK-0028A/B/C
- TASK-0035 (Codex 2026-08-13)
- TASK-0036 (Codex 2026-08-21)
- TASK-0037 (Codex 2026-08-21)
- TASK-0038 (Codex 2026-08-21, partial-slice — see DEC-0165/STEP-4)

TASK-0027 marked STALE on its own merits. TASK-0024 / TASK-0025 remain
pending their own reconcile. Verdict evidence:
`docs/evidence/STEP3-INDEPENDENT-REVIEW-BATCH-20260824.md`.

### DEC-0166 (G6 PASS carry-forward + W5 readiness)
- TASK-0001 G6 re-affirmed PASS (Codex/GPT-5.6 2026-08-12 acceptance
  re-verified).
- TASK-0027 STALE on its own merits — the fail-closed `pip check`
  precondition that BLOCKED its dispatch is no longer true per
  TASK-0041 P0/N/A and the 2026-08-24 prod re-check.
- W5 readiness verified (no new production mutation authorized):
  `pip check` clean, runtime versions compatible, service active,
  `/health` 200, env file carries canonical names, alembic head at
  `0013_drop_legacy_opportunity_reminders`, real `glm-5.2` call works.
- Verdict evidence: `docs/evidence/STEP5-G6-W5-READINESS-20260824.md`.

### TASK-0038 promotion (this session, STEP-4)
TASK-0038 promoted from `ACTIVE / PARTIAL` to `COMPLETE` because the two
residual items are now closed:
- v0.3.0 legacy reminder cleanup → TASK-0039 ACCEPTED with migration
  `0013_drop_legacy_opportunity_reminders` (applied on prod during
  TASK-0041 P2).
- OD-006a real LLM leg → TASK-0041 P1 COMPLETE.

## Not verified / open boundaries

- **G7 (formal acceptance), V1 (full runtime verification), R2
  (product-owner business/visual acceptance)** — product-owner gates, not
  AI-delegated. The product owner has confirmed "我验收了" in this session's
  parent chat; the formal DEC + sign-off record is the product owner's to
  record separately.
- **TASK-0024 / TASK-0025 reconcile** — boundary incident recorded per
  DEC-0130; out of this session's scope; reasonix should coordinate.
- **SPEC-GOV-0001 v0.4.0 approval** — still `NOT APPROVED`; the
  `10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` and
  related governance docs are part of the uncommitted working tree.
- **`git push`** — repository has no `origin` remote (`git remote -v` is
  empty). No push occurred. The 6 commits land only on the local `main`
  branch.
- **Working tree cleanup** — ~183 paths (55 modified + 7 deleted +
  129 untracked) from prior sessions are NOT this session's responsibility.
  They should be committed under their own task cards and authorizations.

## Next bounded actions (within reasonix's own scope)

The following items are queued by prior sessions / this session's
discoveries. reasonix should pick them up in the order that matches
product-owner direction; this handoff does NOT auto-authorize any of them.

1. **Commit the dirty working tree** under appropriate task cards.
   `git status --short` first; group by task; one commit per task; cite
   the relevant DEC. Many of the SPEC-*.md + SPEC-*.approval.json edits
   may require their own DEC since they shift SPEC approval hashes.

2. **TASK-0024 / TASK-0025 reconcile** — boundary incident recorded per
   DEC-0130; the original reviewer didn't conclude; reasonix should
   either run the reconcile or hand it back.

3. **SPEC-GOV-0001 v0.4.0 promotion** — currently `10-draft/`. Needs a
   fresh DEC to `20-review/` or `30-approved/`; that is a product-owner
   decision.

4. **Push to a remote** — once an `origin` is configured and the
   product-owner authorizes the push, push HEAD (`bbb01d3`). No force
   push; do not rebase the public history.

5. **Long-tail items from `docs/NOW.md`** — `OD-005` retention, `OD-006a`
   now SELECTED+DEPLOYED but the cross-product owner validation still
   needed, `DEC-0037` erasure-scope question (free text), G7 sign-off
   record. Out of this handoff's scope.

## Inventory of working-tree paths (high-level groups, NOT individual files)

| Group | Files | Owner |
|---|---|---|
| `M docs/NOW.md` | 1 | This session (TASK-0041 P1 block added) — already committed |
| `M docs/tasks/TASKS.md` | 1 | This session (status line updated) — already committed |
| `M docs/decisions/DECISION-LOG.md` | 1 | This session (DEC-0165/0166 added) — already committed |
| `M docs/tasks/active/TASK-0041-*.md` | 1 | This session (P1 COMPLETE) — already committed |
| `?? docs/tasks/active/TASK-0041-*.md` | 1 | This session (P1 LLM completion evidence) — already committed |
| `?? docs/tasks/active/TASK-0042-rename-ai-reason-env-vars.md` | 1 | Pre-existing untracked; not this session's |
| `M src/crm/web/main.py` | 1 | This session (httpx.Client injection) — already committed |
| `?? src/crm/ai/provider.py` | 1 | This session (renamed from `AiShangjiProvider`) — already committed |
| `?? src/crm/ai/wiring.py` | 1 | Already in tree (TASK-0042 rename) — already committed |
| `M src/crm/config.py` | 1 | This session (allow_enabled_ai rename + comment) — already committed |
| `M tests/test_config.py` | 1 | This session (test_ai_cannot_be_enabled → test_ai_enabled_per_dec_0162_0163) — already committed |
| `M tests/test_task0040_*.py` | 3 | This session (legacy env name cleanup) — already committed |
| All other ~170 paths in `git status --short` | ~170 | Prior sessions; NOT this session's responsibility |

## Checks actually run (this session, all re-runnable)

| Check | Environment | Result |
|---|---|---|
| `git status --short` | local | 183 paths (55 modified, 7 deleted, 129 untracked) |
| `git log --oneline -8` | local | 6 new commits on top of baseline |
| `python -m pytest tests/ -q --no-header` | local Windows | 459 passed, 28 skipped (28 PostgreSQL-gated) |
| `python -m compileall -q src tests migrations` | local | exit 0 |
| `git diff --check` | local | clean (only pre-existing LF/CRLF warnings) |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | local Windows | `[PASS]` (8 approved SPECs, 41 active tasks, 1 legacy manifest) |
| `pip check` | prod `/opt/anqiao-crm/venv` | No broken requirements found |
| `/opt/anqiao-crm/venv/bin/python -c "import fastapi,starlette,..."` | prod | versions compatible |
| `systemctl is-active anqiao-crm` | prod | active |
| `https://crm.aibrain.wiki/health` | public | HTTP 200 healthy |
| Real `glm-5.2` call | prod + live env | `degraded=False`, 176-char Chinese text |
| Audit row payload | prod DB | `{"model_identifier":"glm-5.2","outbound_field_names":["published_at","title"]}` |
| Crawler real fetch | prod + live env | 3216 announcements, `degraded=False` |
| SPEC approval hashes | local | SPEC-0001/0002/0003/0012/0014 all match their `approval.json` |

## Boundary note

This handoff is **HANDOFF-ONLY**: it commits no new application code
beyond the 6 commits listed, makes no production change beyond what
TASK-0041 P0/P1/P2 + TASK-0042 already did, and asks no product-owner
question. The next action is reasonix's choice under product-owner
direction.
