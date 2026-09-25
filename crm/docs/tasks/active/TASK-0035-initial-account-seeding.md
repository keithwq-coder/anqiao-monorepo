# TASK-0035: Initial account seeding (gm / hedan / zhoujingjing + password reset)

- Task ID: TASK-0035
- Status: ACTIVE / **EXECUTED 2026-08-13 — ACCOUNTS SEEDED (HANDOFF-ONLY) —
  AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)**
- Task type: DEPLOYMENT
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0147`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-13 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: `DEC-0147`; the accepted W5 release (DEC-0142); the app's real
  argon2id `hash_password` (`crm.web.auth`) and `GrantRoleCommand`
  (`crm.application.management_commands`); the product-owner account roster.

## Goal

Seed the four initial production accounts with password "123" and the correct
roles: admin (administrator), gm (general_manager / 总经理), hedan and
zhoujingjing (business_user / 销售). Use the application's own argon2id
`hash_password` and idempotent `GrantRoleCommand`. No other business data is
touched.

## Account roster

| username | display_name | role |
|---|---|---|
| admin | 管理员 | administrator |
| gm | 总经理 | general_manager |
| hedan | hedan | business_user |
| zhoujingjing | zhoujingjing | business_user |

## Sequential phases

1. **Local preparation**: verify SPEC-0002 hash; HEAD; run governance.
2. **Read-only current state**: query `user_identities` (username, status) and
   active `role_grants` (role) — never the password_hash column.
3. **Seed accounts**: a Python script run on the server with the app venv and
   `PYTHONPATH=/opt/anqiao-crm/src`, using:
   - `from crm.web.auth import hash_password`
   - `from crm.persistence.user_repository import UserRepository`
   - `from crm.application.management_commands import GrantRoleCommand`
   - `from crm.domain.models import Role, UserStatus`
   For each account: if the username is absent, create it
   (`UserRepository().create(username, display_name, hash_password("123"),
   status=UserStatus.ENABLED)`); if present, set its `password_hash` to
   `hash_password("123")` and `status='enabled'` (direct session update).
   Then grant the role idempotently via
   `GrantRoleCommand(target_user_id, Role(<role>), granted_by_user_id=<admin
   uuid>, reason="initial account seed", scope_reference=None).execute()`.
   The plaintext "123" is never printed or stored.
4. **Verify**: read-only query of the four accounts (username, status, active
   role) and a login test for each (record only HTTP status, never tokens).
5. **Rollback**: not applicable to data seeding beyond re-verifying; any
   failure stops `BLOCKED` with the exact state recorded.

## Exclusive repository write paths

- `docs/tasks/active/TASK-0035-initial-account-seeding.md`
- `docs/evidence/TASK-0035-INITIAL-ACCOUNT-SEEDING-20260813.md`
- `docs/evidence/TASK-0035-DEEPSEEK-PI-EXECUTION-20260813.md`
- `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0035-ACCOUNT-SEEDING.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`

All application, migration, test, dependency-declaration, SPEC, decision-log,
and other repository paths are read-only to the executor. The seed script is
written under a task-owned path on the server (`/tmp`), not in the repository.

## Hard boundaries

- Only the four `user_identities` rows and their `role_grants` rows (plus
  GrantRoleCommand audit events) are mutated. No other business data.
- Passwords: plaintext "123" is used only as the input to `hash_password` and
  is never printed, logged, or stored; the stored value is the argon2id hash.
- No credential/secret/hash/log/business-row value is printed or stored.
- The legacy `scripts/create_admin_account.py` (PBKDF2 substitute hash) must
  NOT be used.
- No commit/push/reset/clean/checkout; no nginx/DNS/TLS change.

## Prerequisites and completion gate

- All four usernames exist with `status='enabled'` and the correct active role
  (read-only query).
- Each account's password verifies as "123" (login test → 200, no token
  printed).
- Run `git diff --check`, `git status --short`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
  The task ends `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent
  Codex review.

## Execution record (2026-08-13, DeepSeek in PI)

- Phases 1–5 completed: admin password RESET to 123 (role already granted,
  idempotent); gm/hedan/zhoujingjing CREATED with roles
  general_manager/business_user/business_user; all four logins with 123 → HTTP
  200; enabled status verified read-only. Plaintext/hash never printed.
- No other business data touched. **NOT self-accepted.**
