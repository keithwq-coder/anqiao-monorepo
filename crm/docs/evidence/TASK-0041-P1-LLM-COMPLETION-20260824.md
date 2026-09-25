# TASK-0041 P1 — Real `glm-5.2` LLM rollout completion (2026-08-24)

- Executor: zcode / GLM-5.2 (this takeover session, continuing
  `sess_ea1152f6` ← `sess_b2bde06b` ← `sess_bb88b84a`).
- Authorization: `DEC-0162` + `DEC-0163` (P0+P1+P2 batch, product-owner
  2026-08-23 "确认 P0+P1，provider 用 glm-5.2" / "是的，授权"); `DEC-0158`
  gate 2 (real-execution confirmation + runtime-env-only secrets); the
  product-owner's 2026-08-24 direct instruction "A，直接改" selected the
  surgical in-place patch route.
- Scope: P1 real external path (real public-site crawl + real LLM reason
  via `glm-5.2`); three minimal source/config edits on `/opt/anqiao-crm`;
  restart `anqiao-crm`; verify real-call success + crawler + audit + service
  health + governance.

## Changes applied on `/opt/anqiao-crm`

Backups before each edit at `/tmp/{main,provider}.py.bak-0041`,
`/tmp/ai.env.bak-0041`.

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `/opt/anqiao-crm/src/crm/web/main.py` | Inject `import httpx; _reason_http_client = httpx.Client(timeout=120.0)` and pass `http_client=_reason_http_client` to **both** `build_reason_generator(...)` calls. | The reason generator has no auto-attach for an HTTP client (unlike `build_crawler_source`, which auto-attaches `make_httpx_fetcher()`); without this, `provider.generate_reason` returns `degraded=True, "provider transport unavailable"` **before** any egress, so no real call is attempted and no audit row is written. |
| 2 | `/opt/anqiao-crm/shared/ai.env` | `AI_SHANGJI_BASE_URL` → `http://129.146.135.219:3000/v1/chat/completions`. | `provider.generate_reason` POSTs to `self._base_url` with no path append. The original `/v1` returns HTTP 404 (verified probe); `/v1/chat/completions` returns 200. |
| 3 | `/opt/anqiao-crm/src/crm/ai/provider.py` | Add `"stream": False` to the request JSON body. | The approved gateway defaults to **SSE** (`Content-Type: text/event-stream`, `data: {"object":"chat.completion.chunk",...}` then `[DONE]`). The provider parses `response.text` as a single JSON via `json.loads(...)`, so the SSE body raises `ProviderMalformedResponseError`. Empirical probe 2026-08-24: with `stream:false` the gateway returns `application/json` plain chat-completion that the existing `json.loads(...)` parser already handles. |

The local repo copies (`src/crm/web/main.py`, `src/crm/ai/provider.py`) were
edited via Edit to match (governance + traceability). The `SseStreamingHttpClient`
docstring claim ("gateway ALWAYS streams regardless of the stream flag") is
inaccurate for this gateway profile; the SSE client is retained for an
alternate gateway profile, the plain-JSON path is the production path.

## Live verification (2026-08-24)

All runs below used the deployed `/opt/anqiao-crm/src` path, the running
service's `ai.env` (no manual env override except where the system service
file is honored), and the production database.

### Real LLM call (end-to-end with audit)

```
/opt/anqiao-crm/venv/bin/python - <<PYEOF
import os, sys, json
sys.path.insert(0, "/opt/anqiao-crm/src")
from crm.ai.wiring import build_reason_generator
from crm.persistence.database import SessionLocal
from crm.persistence.audit_repository import AuditEventRepository
from crm.persistence.models import AuditEventModel

import httpx
http_client = httpx.Client(timeout=180.0)
gen = build_reason_generator(audit_repository=AuditEventRepository(), http_client=http_client)
print("gen:", type(gen).__name__ if gen else None)
announcement = {
    "title": "招标公告：信息化设备采购项目",
    "url": "https://www.ggzy.gov.cn/notice/abc123",
    "source": "ggzy.gov.cn",
    "published_at": "2026-08-24T00:00:00Z",
    "summary": "采购台式机、笔记本、打印机若干。",
}
result = gen(announcement)
print("degraded:", result.degraded)
print("model_identifier:", result.model_identifier)
print("text_len:", len(result.text))
print("text_preview:", repr(result.text[:200]))
PYEOF
```

Result:

```
gen: method
degraded: False
model_identifier: glm-5.2
text_len: 119
text_preview: '你提供了一段招标公告的元数据，内容为：标题是《招标公告：信息化设备采购项目》，发布时间标注为2026年8月24日（UTC时间）。...'
```

Two new audit rows persisted (`opportunity.ai_reason.outbound`):

```
id=0d10144f  outcome=success  reason={"model_identifier":"glm-5.2","outbound_field_names":["published_at","title"]}
id=556848fc  outcome=failure  reason={"model_identifier":"glm-5.2","outbound_field_names":["published_at","title"]}
```

The failure row was the transient `ReadTimeout` from the first call before
the 120 s timeout landed in `main.py`; it was recorded truthfully (no
fabricated success — R-014) and the success row replaced it on the retry.
No key, value, body, or prompt content reached the `audit_events` table, the
repo, logs, or this evidence file (R-013 / R-016).

### Crawler

```
/opt/anqiao-crm/venv/bin/python - <<PYEOF
import os, sys
sys.path.insert(0, "/opt/anqiao-crm/src")
from crm.ai.crawler import PublicProcurementCrawler, DEFAULT_PUBLIC_SOURCES, make_httpx_fetcher
crawler = PublicProcurementCrawler(sources=DEFAULT_PUBLIC_SOURCES, fetcher=make_httpx_fetcher(), network_allowed=True)
result = crawler.fetch_announcements()
print("CRAWL count:", len(result.announcements), "degraded:", result.degraded, "reason:", result.degraded_reason)
print("FIRST_TITLE:", result.announcements[0].title if result.announcements else None)
PYEOF
```

Result: `CRAWL count: 3218 degraded: False reason:`;
`FIRST_TITLE: 《招标投标领域信用管理暂行办法》 2026年第44号令`.

### Service health + governance

- `https://crm.aibrain.wiki/health` → HTTP 200,
  `{"status":"healthy","service":"anqiao-crm-api","version":"0.1.0"}`.
- Running PID `216085` environ contains all six required variables
  (`AI_SHANGJI_BASE_URL` / `AI_SHANGJI_MODEL` / `AI_SHANGJI_API_KEY` /
  `CRM_AI_SHANGJI_NETWORK_ALLOWED=true` / `CRM_CRAWLER_ENABLED=true` /
  `CRM_CRAWLER_NETWORK_ALLOWED=true`); the new base URL is loaded.
- `scripts/check-governance.ps1` → `[PASS]` (8 approved SPECs, 41 active
  tasks, 1 legacy manifest).

## Checks actually run

| Check | Environment | Result |
|-------|-------------|--------|
| Provider is_configured + base_url post-patch | prod `/opt/anqiao-crm` venv | `True`, `…/v1/chat/completions` |
| Real `glm-5.2` call via deployed wiring + audit | prod `/opt/anqiao-crm` venv + live DB | `degraded=False`, text 119 chars, model `glm-5.2` |
| Audit row payload | prod DB | `{"model_identifier":"glm-5.2","outbound_field_names":["published_at","title"]}` (no key/value) |
| Crawler real fetch | prod `/opt/anqiao-crm` venv | 3218 items, `degraded=False` |
| `https://crm.aibrain.wiki/health` | public HTTPS | HTTP 200 healthy |
| Service unit `EnvironmentFile=` `/opt/anqiao-crm/shared/ai.env` | systemd | still set |
| `check-governance.ps1` | local Windows | `[PASS]` |

## Reconciliation note

The local (TASK-0042) `SseStreamingHttpClient` docstring says the gateway
"ALWAYS streams regardless of stream flag". Empirical probe 2026-08-24
contradicts that: with `stream:false` the gateway returns parseable plain
JSON. The plain-JSON path is the production path (and is what the
preexisting `provider.generate_reason` parser already handles). The SSE
client remains for the alternate gateway profile. Reconciliation item: update
the docstring (or remove the inaccurate claim) as part of TASK-0042 cleanup
— not in scope of TASK-0041 P1.

## Not verified / remaining

- **P3 G7/V1/R2 acceptance** — separately authorized, not delegated to AI.
- The `0008` migration fix that landed on production is still untracked in
  git; commit/push only under separate authorization (TASK-0041 out-of-scope
  note in the task card).
- The repo working tree was modified (local source files mirror the prod
  edits); no commit/push happened.
- Real-LLM cost / cross-border egress is a per-call environment fact; the
  gateway behavior was re-measured at execution.
