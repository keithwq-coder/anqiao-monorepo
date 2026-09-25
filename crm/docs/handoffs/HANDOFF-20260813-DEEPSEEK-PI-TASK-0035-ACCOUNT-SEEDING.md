# HANDOFF-20260813: TASK-0035 initial account seeding to DeepSeek in PI

- Task: TASK-0035 (initial account seeding: gm / hedan / zhoujingjing + password reset)
- From tool/model: orchestrator (Codex architecture/review role) in PI —
  model `opencode-go/deepseek-v4-pro` (gateway selector only)
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL PRODUCTION SEEDING PACKAGE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Production target: `ubuntu@124.222.212.159` (hostname `VM-0-17-ubuntu`)
- Written at: 2026-08-13 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the bounded TASK-0035 account seeding in
`D:\Project\中科安樵\crm`. Execute the phases strictly in order. Stop
fail-closed at the first unmet precondition. Your maximum result is
`HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED`. Codex is the only reviewer and
acceptance decision-maker; you never self-accept.

Read in full before any action:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0147`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0035-initial-account-seeding.md`
- `src/crm/domain/models.py` (Role, UserStatus, UserIdentity, RoleGrant)
- `src/crm/web/auth.py` (hash_password)
- `src/crm/persistence/user_repository.py` (UserRepository)
- `src/crm/application/management_commands.py` (GrantRoleCommand)
- this handoff

## Verification-first discipline

Read the current state before writing; write each check and expected outcome;
record exit codes and results; only then advance. The seed is idempotent.

## Package-wide prohibitions

- Never print, store, or report the plaintext "123", any password hash, any
  session token, any cookie value, or any business-row value. The plaintext is
  used only as the argument to `hash_password`.
- Never read/print `/opt/anqiao-crm/shared/database.env` content; it is
  sourced for the DB connection only.
- Never run `journalctl`, `systemctl status`, `tail`, `/var/log`, or a log
  query. Verify login only via HTTP status.
- Do NOT use `scripts/create_admin_account.py` (its hash is not argon2id and
  would break verification).
- Only the four named `user_identities` rows and their `role_grants` rows are
  mutated. No other business data. No commit/push/reset/clean/checkout.

## Phase 1 — Local preparation

Verify SPEC-0002 SHA-256 against its approval JSON; confirm HEAD is
`59101b80b6420155bf8aec26b14ea7800979db86`; run governance.

## Phase 2 — Read-only current state

Strict SSH as `ubuntu@124.222.212.159` (`id -un; hostname` first). Then, never
selecting the `password_hash` column:

```sql
SELECT username, status FROM user_identities ORDER BY username;
SELECT u.username, rg.role FROM role_grants rg JOIN user_identities u ON rg.user_id=u.id WHERE rg.revoked_at IS NULL ORDER BY u.username, rg.role;
```

Record usernames and active roles only.

## Phase 3 — Seed accounts

Write a script under a task-owned path on the server (e.g.
`/tmp/task0034_seed.py`), run with:

```bash
cd /opt/anqiao-crm && set -a && source shared/database.env && set +a && \
export DATABASE_HOST=localhost DATABASE_NAME=anqiao_crm DATABASE_USER=anqiao_crm_app \
PYTHONPATH=/opt/anqiao-crm/src && \
/opt/anqiao-crm/venv/bin/python /tmp/task0034_seed.py
```

The script must use the application's own primitives:

```python
from uuid import UUID
from crm.web.auth import hash_password
from crm.domain.models import Role, UserStatus
from crm.persistence.user_repository import UserRepository
from crm.application.management_commands import GrantRoleCommand

ACCOUNTS = [
    ("admin", "管理员", Role.ADMINISTRATOR),
    ("gm", "总经理", Role.GENERAL_MANAGER),
    ("hedan", "hedan", Role.BUSINESS_USER),
    ("zhoujingjing", "zhoujingjing", Role.BUSINESS_USER),
]
pw = hash_password("123")   # argon2id; never print pw or "123"
```

For each `(username, display_name, role)`:
1. `existing = UserRepository().find_by_username(username)`.
2. If `existing is None`, create via `UserRepository().create(username,
   display_name, pw, status=UserStatus.ENABLED)`; use the returned user's id.
3. If present, set `password_hash = pw`, `status = 'enabled'`,
   `session_epoch = 0`, `updated_at = now` via a direct session update
   (import `SessionLocal` and `UserIdentityModel` from
   `crm.persistence.database` / `crm.persistence.models`).
4. Grant the role idempotently:
   `GrantRoleCommand(target_user_id=uid, role=role,
   granted_by_user_id=admin_uid, reason="initial account seed",
   scope_reference=None).execute()` — where `admin_uid` is the admin user's
   UUID (use the admin's own id as the grantor, matching the initial-admin
   pattern). Record only the returned `granted` boolean and role, not any id.

Commit after each account. Never print `pw`, `"123"`, or any hash.

## Phase 4 — Verify

1. Read-only query (no password_hash):
   `SELECT u.username, u.status, rg.role FROM user_identities u LEFT JOIN
   role_grants rg ON rg.user_id=u.id AND rg.revoked_at IS NULL WHERE
   u.username IN ('admin','gm','hedan','zhoujingjing') ORDER BY u.username;`
   — expect the four usernames, status enabled, correct roles.
2. Login test for each account (record HTTP status only, never any token):
   `POST /api/auth/login` with JSON `{"username": "<u>", "password": "123"}`
   → expect 200. Do not print the response body.

## Phase 5 — Cleanup + evidence

Delete the `/tmp/task0034_seed.py` script and any temp files. Write the
repository evidence/status files (exclusive paths below), run governance,
`git diff --check`, `git status --short`, and a scoped secret-pattern scan
over the TASK-0035 evidence/status paths. Confirm no plaintext password, hash,
token, or log content was recorded. End `HANDOFF-ONLY`, `PARTIAL`, or
`BLOCKED`.

## Exclusive repository write paths

- `docs/tasks/active/TASK-0035-initial-account-seeding.md`
- `docs/evidence/TASK-0035-INITIAL-ACCOUNT-SEEDING-20260813.md`
- `docs/evidence/TASK-0035-DEEPSEEK-PI-EXECUTION-20260813.md`
- `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0035-ACCOUNT-SEEDING.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`

## Required final response

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
phase1_local: <completed | blocked | not-started>
phase2_read_state: <completed | blocked | not-started; usernames+roles observed>
phase3_seed: <completed | blocked | not-started; created/updated/reset per account>
phase4_verify: <completed | blocked | not-started; 4 accounts enabled + roles + login 200>
phase5_cleanup: <completed | blocked | not-started>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
