# HANDOFF-20260813: TASK-0030 production environment rebuild to DeepSeek in PI

- Task: TASK-0030 (production environment rebuild + service switch)
- From tool/model: orchestrator (Codex architecture/review role) in PI —
  model `opencode-go/deepseek-v4-pro` (gateway selector only)
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL PRODUCTION PACKAGE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Fixed release source: commit `59101b80b6420155bf8aec26b14ea7800979db86`
- Production target: `ubuntu@124.222.212.159` (hostname `VM-0-17-ubuntu`,
  Ubuntu 24.04)
- Written at: 2026-08-13 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the bounded TASK-0030 production
environment rebuild in `D:\Project\中科安樵\crm`. Execute the phases strictly
in order. Stop fail-closed at the first unmet precondition; do not skip ahead
or use a substitute route. Your maximum result is `HANDOFF-ONLY`, `PARTIAL`,
or `BLOCKED`. Codex is the only reviewer and acceptance decision-maker; you
never self-accept.

Read in full before any action:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0133` through `DEC-0137`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0030-production-environment-rebuild.md`
- `docs/evidence/TASK-0029-CODEX-INDEPENDENT-ACCEPTANCE-20260813.md`
- this handoff

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands or handle secrets.

## Verification-first discipline

This task makes no application-code change, so test-first development (TDD)
does not apply. The equivalent mandatory discipline is verification-first:
for every phase, write the check command and expected outcome before running,
record exit codes and factual results, and only then mark the phase complete.
The frozen `requirements.lock` (40 exact versions, 341 tests passed) is the
only dependency authority; any deviation is `BLOCKED`, never patched.

## Package-wide prohibitions

- Never read, print, copy, store, or report a credential, secret, private key,
  runtime environment value, cookie, session, business row, database value,
  or the content of `/opt/anqiao-crm/shared/database.env`.
- Never run `journalctl`, `systemctl status`, `tail`, a `/var/log` path, a log
  file/query, or any command intended to read or derive log content/metadata.
  (`systemctl stop|start|restart anqiao-crm` is allowed; `status`/`show` is
  not. After restart, verify health only via the HTTP health endpoint, not
  logs.)
- No database access or migration. The database stays at its current revision.
- No nginx/DNS/TLS change or reload. No `sudo` broadening beyond what the
  commands below explicitly require.
- No new application code deployment, no source/configuration change beyond the
  venv directory rename/swap, no commit/push/reset/clean/checkout.
- The existing broken venv is never modified in place; rename it, preserve it,
  and only swap it back as rollback.

## Phase 1 — Local wheelhouse (no production, network to pypi.org/simple only)

Write only:

- `docs/evidence/TASK-0030-PRODUCTION-ENVIRONMENT-REBUILD-20260813.md` (phase 1
  section)
- `docs/tasks/active/TASK-0030-production-environment-rebuild.md` (status)

1. Reuse or create a fresh external workspace (not the repository). Derive
   `name==version` pins from the TASK-0029 `requirements.lock` (strip hashes).
2. Download the Linux wheels for those EXACT 40 versions targeting the Ubuntu
   24.04 platform, e.g.:
   `python -m pip download --timeout 600 --retries 10
   --platform manylinux_2_28_x86_64 --platform manylinux_2_17_x86_64
   --implementation cp --python-version 312 --only-binary=:all:
   -r <pinned.txt> -d <linux-wheelhouse>`
   (abi3 wheels such as `argon2-cffi-bindings` are acceptable). Use only
   `https://pypi.org/simple`, no cache, isolated config.
3. Verify all 40 exact versions resolve to Linux cp312 wheels. If any exact
   pinned version lacks a compatible Linux wheel, stop `BLOCKED` — do not
   substitute a different version.
4. Compute SHA-256 for every downloaded wheel; write `linux-requirements.lock`
   (40 exact versions, each `--hash=sha256:…`).
5. Offline check:
   `python -m pip install --dry-run --ignore-installed --no-index
   --find-links <linux-wheelhouse> --platform manylinux_2_28_x86_64
   --implementation cp --python-version 312 --only-binary=:all:
   --require-hashes -r <linux-requirements.lock>` — must exit 0.

## Phase 2 — Server read-only preflight

Before connecting: `ssh-keygen -F 124.222.212.159` to confirm an existing
known-host entry; do not add/replace a host key.

Connect only as `ubuntu@124.222.212.159` with `BatchMode=yes`,
`StrictHostKeyChecking=yes`, `ConnectTimeout=15`. First run only
`id -un; hostname` (expect `ubuntu` / `VM-0-17-ubuntu`; mismatch stops
`BLOCKED`).

Allowlisted read-only commands (record each exit code):

1. `getconf GNU_LIBC_VERSION` or `ldd --version | head -1` (expect glibc ≥
   2.28; record exact value).
2. `df -h /opt/anqiao-crm` (record available space; a fresh venv needs roughly
   the size of the wheelhouse plus ~1 GB).
3. `/opt/anqiao-crm/venv/bin/python -m pip check` (expect non-zero, reproducing
   the known `fastapi`/`starlette` mismatch — this is the reason for the task).
4. `ls -1 /opt/anqiao-crm/venv/bin/uvicorn` and
   `readlink -f /opt/anqiao-crm/scripts/start.sh`; record whether the start
   script references `/opt/anqiao-crm/venv` (do not print its full content or
   any environment value).
5. Confirm the server Python 3.12 interpreter path exists (e.g.
   `python3.12 --version` or the venv's interpreter).

No `journalctl`, no `systemctl status`, no `/var/log`, no `sudo` beyond the
commands listed.

## Phase 3 — Transfer

`scp -o BatchMode=yes -o StrictHostKeyChecking=yes` the Linux wheelhouse and
`linux-requirements.lock` to a task-owned path under `/opt/anqiao-crm/tmp/`
(or `/tmp/`). Record transfer exit codes and the target path. Do not place
anything under the existing `/opt/anqiao-crm/venv`.

## Phase 4 — Fresh venv, offline install

1. Create the new environment:
   `python3.12 -m venv /opt/anqiao-crm/venv-new` (use the same interpreter
   family as the current venv; record `python3.12 --version`).
2. Offline hash-enforced install:
   `/opt/anqiao-crm/venv-new/bin/pip install --no-index
   --find-links <wheelhouse> --require-hashes -r <linux-requirements.lock>`
   — must exit 0. (If the fresh venv's pip needs upgrading, install from the
   wheelhouse only, never from a live index.)

## Phase 5 — Validate (before any switch)

1. `/opt/anqiao-crm/venv-new/bin/pip check` — must exit 0.
2. Import smoke, e.g.:
   `cd /opt/anqiao-crm && /opt/anqiao-crm/venv-new/bin/python -c "import crm.web.main"` —
   must exit 0. Record the exact result; do not read environment values.
3. Record the new venv's `fastapi`/`starlette` versions via `pip show`
   (metadata only) to confirm they match the frozen lock.

## Phase 6 — Switch (bounded mutation)

1. `systemctl stop anqiao-crm` (exit 0).
2. `mv /opt/anqiao-crm/venv /opt/anqiao-crm/venv-broken-<timestamp>`.
3. `mv /opt/anqiao-crm/venv-new /opt/anqiao-crm/venv`.
4. `systemctl start anqiao-crm`.

## Phase 7 — Health + mandatory rollback

1. Health check only via the HTTP endpoint (no logs): an unauthenticated GET
   that the app serves, e.g. `curl -sS -o /dev/null -w "%{http_code}\n"
   http://127.0.0.1:8200/login` or `/health` (record status code; expect a
   normal app response, not a 5xx loop). Do not send credentials or read
   response bodies.
2. If the health check is not a normal app response, roll back immediately:
   `systemctl stop anqiao-crm`; `mv /opt/anqiao-crm/venv
   /opt/anqiao-crm/venv-failed-<timestamp>`;
   `mv /opt/anqiao-crm/venv-broken-<timestamp> /opt/anqiao-crm/venv`;
   `systemctl start anqiao-crm`; record the rollback and end `BLOCKED`.
3. If healthy, leave the broken venv in place as `venv-broken-<timestamp>` and
   do not delete it; note that it remains the rollback target until Codex
   accepts the switch.

## Final evidence and governance

Write only:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0030-production-environment-rebuild.md` (final status)
- `docs/evidence/TASK-0030-PRODUCTION-ENVIRONMENT-REBUILD-20260813.md`
  (full phase-by-phase record)
- `docs/evidence/TASK-0030-DEEPSEEK-PI-EXECUTION-20260813.md`

Run and record:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
git diff --check
git status --short
```

Run a scoped secret-pattern scan over only the TASK-0030 evidence/status
paths. Confirm: no log command ran, no secret/environment value was accessed,
no database action, no nginx/DNS/TLS change, no commit/push. The package ends
`HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits Codex independent review.

## Required final response

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
phase1_local_wheelhouse: <completed | blocked | not-started; linux-requirements.lock path>
phase2_preflight: <completed | blocked | not-started>
phase3_transfer: <completed | blocked | not-started>
phase4_fresh_venv: <completed | blocked | not-started>
phase5_validate: <completed | blocked | not-started>
phase6_switch: <completed | blocked | not-started>
phase7_health_rollback: <completed | blocked | not-started; healthy | rolled-back>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
