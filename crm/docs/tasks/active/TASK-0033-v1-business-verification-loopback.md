# TASK-0033: V1 production business verification + loopback tightening

- Task ID: TASK-0033
- Status: ACTIVE / **EXECUTED 2026-08-13 — V1 VERIFICATION COMPLETE + LOOPBACK
  TIGHTENED (HANDOFF-ONLY) — AWAITS CODEX INDEPENDENT REVIEW (NOT
  SELF-ACCEPTED)**
- Task type: VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0143`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-13 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: `DEC-0143`; the accepted W5 release (DEC-0142); the synthetic
  business-user account documented in `docs/NOW.md`; the deferred loopback
  bind change.

## Goal

Verify, read-only, that the released production system actually serves the
approved business flows with correct field-level masking, and apply the
deferred loopback bind-address tightening so the application port is no longer
exposed to the public internet. No business data is written, modified, or
deleted.

## Sequential phases

1. **Local preparation**: verify SPEC-0012 hash and HEAD; run governance.
2. **Read-only re-verification**: service health (GET /login → 200); DB
   revision = `0005_opportunity_reminders_ai_reasoning`; new tables
   (`erasure_records`, `import_batches`, `opportunity_reminders`) present and
   queryable; frozen deps (fastapi 0.136.3, starlette 1.6.0) and `pip check`
   clean; current listener on `0.0.0.0:8200`.
3. **Authenticated GET-only flow (synthetic business user)**: log in as the
   synthetic business user documented in NOW.md; then, using GET requests
   only, navigate: institution list (masked), an institution detail (masked),
   and search results (masked). Record HTTP status codes and masking
   observations. No POST/PUT/DELETE of business data. Never print the
   credentials or any session token/cookie.
4. **Loopback tightening**: edit `/opt/anqiao-crm/scripts/start.sh` so the
   uvicorn `--host` value becomes `127.0.0.1` (verify the exact current line
   first); `sudo -n systemctl restart anqiao-crm`; verify `GET /login` on
   `127.0.0.1:8200` → 200 and that `0.0.0.0:8200` is no longer listening.
5. **Rollback on failure**: if the bind change breaks health, revert the
   start-script line and restart; report `BLOCKED`.

## Exclusive repository write paths

- `docs/tasks/active/TASK-0033-v1-business-verification-loopback.md`
- `docs/evidence/TASK-0033-V1-BUSINESS-VERIFICATION-20260813.md`
- `docs/evidence/TASK-0033-DEEPSEEK-PI-EXECUTION-20260813.md`
- `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0033-V1-VERIFICATION.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`

All application, migration, test, dependency-declaration, SPEC, decision-log,
and other repository paths are read-only to the executor.

## Hard boundaries

- No business-row create/update/delete; the only permitted database write is
  the ephemeral server-session row from the synthetic-account login.
- No nginx edit/reload; no DNS/TLS change; no credential/secret/session-token
  reading, printing, or storing; no log reading/query.
- No database restore/downgrade; no commit/push/reset/clean/checkout.
- The start-script edit is limited to the single `--host` value; no other
  configuration change.

## Prerequisites and completion gate

- Service healthy before and after the bind change (HTTP 200 on
  `127.0.0.1:8200/login`).
- Authenticated flow returns 200 for the list/detail/search views and the
  masking observations are recorded (masked fields shown as masked for a
  non-owner business user).
- After tightening, `ss`/listener check shows `8200` bound to `127.0.0.1`
  (not `0.0.0.0`); the public HTTPS path still serves (nginx proxies to
  loopback).
- Any failure rolls back the bind change and ends `BLOCKED`.
- Run `git diff --check`, `git status --short`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
  The task ends `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent
  Codex review.

## Execution record (2026-08-13, DeepSeek in PI)

- Phases 1–4 completed: read-only re-verification (health 200, DB 0005, new
  tables queryable, frozen deps, pip check clean); authenticated GET-only flow
  as synthetic business user (login 200; list 200/20 rows; detail 200 with
  **masking observed** — contact value rendered `***` for the non-owner;
  search 200); loopback tightening (`--host 0.0.0.0` → `127.0.0.1`, backup
  saved, listener now `127.0.0.1:8200`, public HTTPS still 200).
- Phase 5 (rollback): not needed. No business-data mutation (only the ephemeral
  login session row); no credential/session value recorded. **NOT
  self-accepted.**
