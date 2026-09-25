# HANDOFF-20260813: TASK-0033 V1 verification + loopback to DeepSeek in PI

- Task: TASK-0033 (V1 production business verification + loopback tightening)
- From tool/model: orchestrator (Codex architecture/review role) in PI —
  model `opencode-go/deepseek-v4-pro` (gateway selector only)
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL PRODUCTION VERIFICATION PACKAGE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Production target: `ubuntu@124.222.212.159` (hostname `VM-0-17-ubuntu`,
  Ubuntu 24.04)
- Written at: 2026-08-13 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the bounded TASK-0033 V1 verification in
`D:\Project\中科安樵\crm`. Execute the phases strictly in order. Stop
fail-closed at the first unmet precondition; do not skip ahead or use a
substitute route. Your maximum result is `HANDOFF-ONLY`, `PARTIAL`, or
`BLOCKED`. Codex is the only reviewer and acceptance decision-maker; you never
self-accept.

Read in full before any action:

- `AGENTS.md`
- `docs/NOW.md` (this also documents the synthetic business-user account)
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0142` and `DEC-0143`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0033-v1-business-verification-loopback.md`
- this handoff

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands or handle secrets.

## Verification-first discipline

This task authors no application code; the discipline is verification-first:
write each check and expected outcome before running, record exit codes and
results, and only then advance. Business-flow checks are read-only by design.

## Package-wide prohibitions

- Never create, update, or delete a business row (institution, contact,
  follow-up, etc.). The only database write permitted is the ephemeral
  server-session row created by the synthetic-account login.
- Never read, print, copy, store, or report a credential, secret, private key,
  session token, cookie value, runtime environment value, business-row value,
  or the content of `/opt/anqiao-crm/shared/database.env`. The synthetic
  account credentials are used only to POST the login form; they are never
  displayed or stored in evidence.
- Never run `journalctl`, `systemctl status`, `tail`, a `/var/log` path, or a
  log query. (`systemctl restart|start|stop anqiao-crm` is allowed; verify
  health only via HTTP, never logs.)
- No nginx edit/reload; no DNS/TLS change; no database restore/downgrade; no
  commit/push/reset/clean/checkout.
- The start-script edit is limited to the single `--host` value.

## Phase 1 — Local preparation

Verify SPEC-0012 SHA-256 against its approval JSON; confirm HEAD is
`59101b80b6420155bf8aec26b14ea7800979db86`; run governance; record
`git status --short`.

## Phase 2 — Read-only re-verification

Strict SSH as `ubuntu@124.222.212.159`; first `id -un; hostname` (expect
`ubuntu` / `VM-0-17-ubuntu`). Then:

1. `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8200/login` → 200.
2. DB revision: `sudo -n -u postgres psql -d anqiao_crm -X -t -c "SELECT
   version_num FROM alembic_version;"` → `0005_opportunity_reminders_ai_reasoning`.
3. New tables queryable (read-only counts only, no column values):
   `sudo -n -u postgres psql -d anqiao_crm -X -t -c "SELECT tablename FROM
   pg_tables WHERE schemaname='public' ORDER BY tablename;"` and a read-only
   `SELECT count(*)` for `erasure_records`, `import_batches`,
   `opportunity_reminders`.
4. Frozen deps: `/opt/anqiao-crm/venv/bin/pip show fastapi starlette | grep
   -E "^(Name|Version):"`; `/opt/anqiao-crm/venv/bin/pip check`.
5. Listener before tightening: `ss -ltn | awk '$4 ~ /:8200$/ {print}'` —
   expect `0.0.0.0:8200`.

## Phase 3 — Authenticated GET-only flow (synthetic business user)

Using the synthetic business user documented in `docs/NOW.md` (never display
the credentials):

1. `GET /login` → 200; capture the cookie jar and the form's CSRF token
   (without printing the token or any cookie value).
2. `POST /login` with the synthetic username/password + CSRF token → follow
   the redirect; record only the resulting HTTP status (not the session
   cookie value).
3. Using GET only, navigate and record the status + masking observations:
   - institution list page (200; other-owner rows show masked fields);
   - one institution detail page (200; contact methods/follow-up detail masked
     for a non-owner);
   - search results page (200; results obey the same masking).
4. Do NOT POST/PUT/DELETE any business data. Do not record any business-row
   value; record only that masking was or was not observed per field group.

If the login fails or any page is not reachable, record the fact and continue
to Phase 4 (the verification finding is reported, not fixed).

## Phase 4 — Loopback tightening

1. Confirm the exact current line in `/opt/anqiao-crm/scripts/start.sh` that
   sets the uvicorn host (e.g. `--host 0.0.0.0`). If it is not present, stop
   `BLOCKED` (do not guess).
2. Edit that one value to `127.0.0.1` (bounded sed/edit of the single line).
3. `sudo -n systemctl restart anqiao-crm`.
4. Verify: `curl -sS -o /dev/null -w "%{http_code}\n"
   http://127.0.0.1:8200/login` → 200; and `ss -ltn | awk '$4 ~ /:8200$/ {print}'`
   → `127.0.0.1:8200` (no longer `0.0.0.0:8200`).
5. Public HTTPS still serves: `curl -sS -o /dev/null -w "%{http_code}\n"
   https://crm.aibrain.wiki/login` → 200 (through nginx).

## Phase 5 — Rollback of the bind change on failure

If health fails after the bind change: revert the start-script line to its
original value; `sudo -n systemctl restart anqiao-crm`; verify 200; report
`BLOCKED`.

## Final evidence and governance

Write only:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0033-v1-business-verification-loopback.md` (final status)
- `docs/evidence/TASK-0033-V1-BUSINESS-VERIFICATION-20260813.md`
- `docs/evidence/TASK-0033-DEEPSEEK-PI-EXECUTION-20260813.md`

Run and record:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
git diff --check
git status --short
```

Run a scoped secret-pattern scan over only the TASK-0033 evidence/status
paths. Confirm: no log command, no credential/session-token/business-value
printed or stored, no business-data mutation, no nginx/DNS/TLS change, no
commit/push. End `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED`; await Codex review.

## Required final response

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
phase1_local: <completed | blocked | not-started>
phase2_verify: <completed | blocked | not-started; health + revision + deps>
phase3_auth_flow: <completed | blocked | not-started; list/detail/search status + masking observations>
phase4_loopback: <completed | blocked | not-started; listener now 127.0.0.1:8200>
phase5_rollback: <not-needed | executed>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
