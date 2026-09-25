# TASK-0033: V1 production business verification + loopback tightening — evidence (2026-08-13)

- Status: **EXECUTED — V1 VERIFICATION COMPLETE + LOOPBACK TIGHTENED
  (HANDOFF-ONLY) — awaiting Codex independent review (NOT self-accepted)**
- Authority: `DEC-0143` (product-owner authorization, 2026-08-13)
- Approved SPEC: `SPEC-0012 v0.2.0` (SHA-256 matches approval JSON)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.

## Outcome

The released production system serves the approved business flows with
field-level masking active (verified read-only with the synthetic business
user), and the loopback bind-address tightening was applied successfully:
port 8200 now listens on `127.0.0.1` only, public HTTPS still serves via
nginx. No rollback needed.

## Phase 1 — Local preparation (completed)

- SPEC-0012 SHA-256 matches approval JSON; HEAD =
  `59101b80b6420155bf8aec26b14ea7800979db86`; governance PASS.

## Phase 2 — Read-only re-verification (all passed)

| Check | Result |
|---|---|
| Identity | `ubuntu` / `VM-0-17-ubuntu` |
| `GET http://127.0.0.1:8200/login` | **200** |
| DB revision | `0005_opportunity_reminders_ai_reasoning` |
| New tables queryable (read-only counts) | `erasure_records`=0, `import_batches`=0, `opportunity_reminders`=0 (present, empty, queryable) |
| Frozen deps | fastapi **0.136.3**, starlette **1.6.0** |
| `pip check` | clean |
| Listener (before) | `0.0.0.0:8200` |

## Phase 3 — Authenticated GET-only flow (synthetic business user; completed)

- Login: `POST /api/auth/login` (JSON) as the synthetic business user
  documented in NOW.md → **200** (role `business_user`). The login's
  server-session row is the only database write; no session token or
  credential value was printed or stored.
- Institution list: `GET /institutions` → **200** (20 data rows; headers:
  名称 / 类别 / 地区 / 来源分类 / 操作).
- Institution detail: `GET /institutions/<id>` → **200**; **masking observed**:
  a contact value in the contacts section is rendered as `***` for the
  non-owner business user (evidence that field-level masking is active on
  production).
- Search: `GET /institutions?q=…` → **200** (results filtered; flow works).
- All requests after login were GET-only; no business row was created,
  updated, or deleted. No business-row value was recorded.

## Phase 4 — Loopback tightening (completed)

| Step | Result |
|---|---|
| Current line | `/opt/anqiao-crm/scripts/start.sh` line 33: `--host 0.0.0.0` |
| Change | `--host 127.0.0.1` (single-line edit; backup `start.sh.bak-v1` saved) |
| Restart | `sudo -n systemctl restart anqiao-crm` → exit 0 |
| Loopback health | `GET http://127.0.0.1:8200/login` → **200** |
| Listener | `127.0.0.1:8200` (no longer `0.0.0.0:8200`) |
| Public HTTPS | `GET https://crm.aibrain.wiki/login` → **200** (via nginx → loopback) |

## Phase 5 — Rollback

Not needed (all phases succeeded). The bind-change backup
(`/opt/anqiao-crm/scripts/start.sh.bak-v1`) is retained for reversibility.

## Current production state

- Service healthy on loopback; port 8200 no longer publicly exposed.
- Public HTTPS (`crm.aibrain.wiki`) serves via nginx.
- Business flows verified read-only; masking confirmed active.

## No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, or substitute; health verified only via HTTP.
- **NO SECRET/SESSION VALUE WAS PRINTED OR STORED** — credentials were used
  only for the login POST; the returned CSRF/session tokens were never
  recorded; the temporary cookie jar and downloaded pages on the server were
  deleted after use.
- **NO BUSINESS-DATA MUTATION** — the only database write is the ephemeral
  server-session row from the synthetic-account login. The only filesystem
  change is the single `--host` value in `start.sh` (with backup). No
  nginx/DNS/TLS change, no commit/push.

## Not verified / boundaries

- G7 (DNS/TLS) and R2 (product-owner visual/business acceptance) remain
  separately authorized and PENDING.
- A complete per-field masking matrix walkthrough (all roles × all fields) was
  not performed; the observation confirms masking is active for a non-owner
  business user on a contact value.
- Codex independent review is pending; the task is NOT self-accepted.
