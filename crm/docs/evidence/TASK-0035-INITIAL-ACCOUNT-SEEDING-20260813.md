# TASK-0035: Initial account seeding — evidence (2026-08-13)

- Status: **EXECUTED — ACCOUNTS SEEDED (HANDOFF-ONLY) — awaiting Codex
  independent review (NOT self-accepted)**
- Authority: `DEC-0147` (product-owner authorization, 2026-08-13)
- Approved SPEC: `SPEC-0002 v0.3.0` (SHA-256 matches approval JSON)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.

## Outcome

The four initial accounts are seeded: admin (password reset to "123",
administrator), gm (created, general_manager), hedan (created, business_user),
zhoujingjing (created, business_user). All four log in with "123" (HTTP 200).
The plaintext password and hashes were never printed or stored.

## Phase 1 — Local preparation (completed)

- SPEC-0002 v0.3.0 SHA-256 matches approval JSON; HEAD =
  `59101b80b6420155bf8aec26b14ea7800979db86`; governance PASS.

## Phase 2 — Read-only current state (completed)

Observed (no password_hash selected): 26 user_identities (admin, admin@example.com,
admin_synthetic, dl0001–dl0010, sa1–sa9, testuser_real, user_synthetic, wq,
zxx, and the four targets where present). Active roles include administrator
(admin, admin_synthetic), business_user (dl*/sa*/others), and agent (zxx,
created by the parallel DEC-0144–0146 track). The targets gm / hedan /
zhoujingjing were absent; admin was present with the administrator role.

## Phase 3 — Seed accounts (completed)

A script on the server (`/tmp/task0035_seed.py`, deleted afterward) ran with
the app venv, `PYTHONPATH=/opt/anqiao-crm/src`, and `database.env` sourced,
using the application's own primitives:

- `crm.web.auth.hash_password("123")` → argon2id (never printed).
- `UserRepository.create(username, display_name, hash, status=ENABLED)` for new
  users; direct `UserIdentityModel` update (password_hash, status, session_epoch)
  for existing users.
- `GrantRoleCommand(target_user_id, role, granted_by_user_id=admin_uid,
  reason="initial account seed", scope_reference=None).execute()` — idempotent,
  audited.

Results (exact, no secrets):
- `RESET admin role=administrator granted=False idempotent=True`
- `CREATED gm role=general_manager granted=True idempotent=False`
- `CREATED hedan role=business_user granted=True idempotent=False`
- `CREATED zhoujingjing role=business_user granted=True idempotent=False`
- `SEED_DONE` (exit 0)

## Phase 4 — Verify (all passed)

| username | status | role | login (pw 123) |
|---|---|---|---|
| admin | enabled | administrator | 200 |
| gm | enabled | general_manager | 200 |
| hedan | enabled | business_user | 200 |
| zhoujingjing | enabled | business_user | 200 |

## Phase 5 — Cleanup (completed)

- `/tmp/task0035_seed.py` deleted from the server; local scratch removed.
- Governance `[PASS]`; `git diff --check` exit 0.

## No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN**; login verified only via HTTP status.
- **NO SECRET WAS PRINTED OR STORED**: the plaintext "123" was used only as
  the argument to `hash_password`; no hash, session token, or cookie value was
  recorded.
- **MUTATIONS LIMITED TO**: the four `user_identities` rows (admin password
  reset; gm/hedan/zhoujingjing creation) and their `role_grants` rows plus the
  GrantRoleCommand audit events. No other business data was touched.
- No commit/push; no nginx/DNS/TLS change.

## Not verified / boundaries

- The zxx (agent) account was created by the parallel DEC-0144–0146 track, not
  this task; this task created only the four internal accounts.
- R2 (product-owner acceptance) and the parallel track's independent review
  remain separate.
- Codex independent review is pending; the task is NOT self-accepted.
