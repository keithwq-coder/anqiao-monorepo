# HANDOFF-20260813: TASK-0031 full W5 production release to DeepSeek in PI

- Task: TASK-0031 (full W5 production release: code + migration + corrected venv)
- From tool/model: orchestrator (Codex architecture/review role) in PI —
  model `opencode-go/deepseek-v4-pro` (gateway selector only)
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL PRODUCTION RELEASE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Fixed release source: commit `59101b80b6420155bf8aec26b14ea7800979db86`
  (release archive SHA-256
  `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`)
- Production target: `ubuntu@124.222.212.159` (hostname `VM-0-17-ubuntu`,
  Ubuntu 24.04)
- Written at: 2026-08-13 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the bounded TASK-0031 W5 production
release in `D:\Project\中科安樵\crm`. Execute the phases strictly in order.
Stop fail-closed at the first unmet precondition; do not skip ahead or use a
substitute route. Your maximum result is `HANDOFF-ONLY`, `PARTIAL`, or
`BLOCKED`. Codex is the only reviewer and acceptance decision-maker; you never
self-accept.

Read in full before any action:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0133`, `DEC-0137`,
  `DEC-0138`, `DEC-0139`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0031-full-w5-production-release.md`
- `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`
- `docs/evidence/TASK-0030-CODEX-INDEPENDENT-REVIEW-20260813.md`
- this handoff

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands or handle secrets.

## Verification-first discipline

No application code is authored here, so TDD does not apply; the equivalent
discipline is verification-first: write each check command and expected
outcome before running, record exit codes and results, and only then advance.
Every mutation is preceded by a backup and has a rollback path.

## Package-wide prohibitions

- Never read, print, copy, store, or report a credential, secret, private key,
  runtime environment value, cookie, session, business-row value, database
  value, or the content of `/opt/anqiao-crm/shared/database.env`. It may be
  `source`d for the migration exactly as `start.sh` does, but its values are
  never displayed.
- Never run `journalctl`, `systemctl status`, `tail`, a `/var/log` path, or a
  log query. (`systemctl stop|start|restart anqiao-crm` is allowed; verify
  health only via the HTTP endpoint, never logs.)
- No DNS/TLS change; nginx syntax check only (`sudo -n nginx -t`), no edit or
  reload.
- No database restore/downgrade. The only database mutation is the forward
  `alembic upgrade` to `0005_opportunity_reminders_ai_reasoning`.
- No cleanup of backups or old artifacts; no commit/push/reset/clean/checkout.
- The `0006_operation_records` migration and all dirty-worktree paths are
  excluded from the payload.

## Phase 1 — Local preparation (no production)

- Verify SPEC-0012 SHA-256 against its approval JSON.
- Confirm `59101b80b6420155bf8aec26b14ea7800979db86` is HEAD.
- Recreate the release archive and confirm its SHA-256:
  `git -c core.autocrlf=false -c core.eol=lf archive
  59101b80b6420155bf8aec26b14ea7800979db86 -- src templates static migrations
  alembic.ini pyproject.toml deploy/start.sh deploy/anqiao-crm.service
  deploy/nginx_crm.conf -o <ws>/release-source.tar` then
  `sha256sum <ws>/release-source.tar` — must equal
  `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`.
- Record `git status --short` (preserve dirty worktree) and run governance.

## Phase 2 — Server preflight (read-only)

Strict SSH (`BatchMode=yes`, `StrictHostKeyChecking=yes`, `ConnectTimeout=15`)
as `ubuntu@124.222.212.159`. First `id -un; hostname` (expect `ubuntu` /
`VM-0-17-ubuntu`). Then allowlisted read-only checks:

1. `getconf GNU_LIBC_VERSION` (expect ≥ 2.28).
2. `df -h /opt/anqiao-crm | tail -1`.
3. Database revision: `sudo -n -u postgres psql -d anqiao_crm -X -c "SELECT
   version_num FROM alembic_version;"` — expect `0001_initial_schema`.
4. Current venv: `/opt/anqiao-crm/venv/bin/python -m pip check` — expect the
   known failure (exit 1).
5. Confirm `/tmp/task0030/wheelhouse` (39 wheels) and
   `/tmp/task0030/linux-requirements.lock` exist.

## Phase 3 — Backup (before any mutation)

- `TS=$(date +%Y%m%d%H%M%S)`; `sudo -n mkdir -m 700
  /opt/anqiao-crm/backup/pre-release-$TS` (record the exact path).
- `sudo -n -u postgres pg_dump -Fc -d anqiao_crm -f
  /opt/anqiao-crm/backup/pre-release-$TS/database.dump`.
- Archive live code: `sudo -n tar czf
  /opt/anqiao-crm/backup/pre-release-$TS/app-code-old.tar.gz -C /opt/anqiao-crm
  src templates static migrations alembic.ini pyproject.toml scripts`.
- Record `sha256sum` of both artifacts and a metadata manifest (names, sizes,
  hashes). Do not print database values or archive contents.

## Phase 4 — Stage release payload

- Transfer the release archive (scp) to `/opt/anqiao-crm/tmp/` and extract to
  a task-owned staging dir (e.g. `/opt/anqiao-crm/tmp/task0031-$TS/`).
- `python3.12 -m compileall -q <staged>/src` — exit 0.
- Alembic head check is deferred until the new venv exists (Phase 7.5).

## Phase 5 — Stop service

`sudo -n systemctl stop anqiao-crm` (exit 0).

## Phase 6 — Swap code

Replace the live paths with the staged release paths (old code already backed
up in Phase 3). Only these paths: `src/`, `templates/`, `static/`,
`migrations/`, `alembic.ini`, `pyproject.toml`. Do NOT touch `scripts/`,
`shared/`, `venv/`, `backup/`, `data/`, or `deploy/`.

## Phase 7 — Recreate venv at the final path (relocation-safe)

1. `sudo -n mv /opt/anqiao-crm/venv /opt/anqiao-crm/venv-pre-release-$TS`.
2. `sudo -n python3.12 -m venv /opt/anqiao-crm/venv` (created AT the final
   path, so shebangs are correct — do NOT move it afterward).
3. `sudo -n /opt/anqiao-crm/venv/bin/pip install --no-index --find-links
   /tmp/task0030/wheelhouse --require-hashes -r /tmp/task0030/linux-requirements.lock`
   (exit 0; if the venv pip needs its own upgrade, install from the wheelhouse
   only).
4. `/opt/anqiao-crm/venv/bin/pip check` → exit 0; `head -1
   /opt/anqiao-crm/venv/bin/uvicorn` must show
   `#!/opt/anqiao-crm/venv/bin/python3.12` (correct, not stale).

Phase 7.5 — `PYTHONPATH=<staged>/src
   /opt/anqiao-crm/venv/bin/python -m alembic heads` → exactly
   `0005_opportunity_reminders_ai_reasoning`.

## Phase 8 — Migrate database

`cd /opt/anqiao-crm && set -a && source shared/database.env && set +a &&
export DATABASE_HOST=localhost DATABASE_NAME=anqiao_crm
DATABASE_USER=anqiao_crm_app PYTHONPATH=/opt/anqiao-crm/src &&
/opt/anqiao-crm/venv/bin/python -m alembic upgrade
0005_opportunity_reminders_ai_reasoning` — record exit code and the final
revision line only (never any secret value).

## Phase 9 — Start service

`sudo -n systemctl start anqiao-crm` (exit 0).

## Phase 10 — Verify

- HTTP: `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8200/login`
  → expect 200 (retry briefly if the service is still booting; no logs).
- Database revision (read-only): `sudo -n -u postgres psql -d anqiao_crm -X
  -c "SELECT version_num FROM alembic_version;"` → `0005_opportunity_reminders_ai_reasoning`.
- `pip check` on the live venv → clean.

## Phase 11 — Rollback on any failure

If any of Phases 6–10 fails: `sudo -n systemctl stop anqiao-crm`; restore the
old code from the Phase 3 archive; restore the old venv
(`sudo -n mv /opt/anqiao-crm/venv /opt/anqiao-crm/venv-failed-$TS` then
`sudo -n mv /opt/anqiao-crm/venv-pre-release-$TS /opt/anqiao-crm/venv`);
`sudo -n systemctl start anqiao-crm`; verify HTTP 200. The database is
forward-only (do NOT downgrade or restore it); record that the pg_dump backup
exists for any separately-authorized restore. End `BLOCKED`.

## Final evidence and governance

Write only:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0031-full-w5-production-release.md` (final status)
- `docs/evidence/TASK-0031-W5-PRODUCTION-RELEASE-20260813.md` (phase-by-phase)
- `docs/evidence/TASK-0031-DEEPSEEK-PI-EXECUTION-20260813.md`

Run and record:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
git diff --check
git status --short
```

Run a scoped secret-pattern scan over only the TASK-0031 evidence/status
paths. Confirm: no log command, no secret/environment value read, no DNS/TLS
change, no nginx edit, no database restore/downgrade, no commit/push. End
`HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED`; await Codex independent review.

## Required final response

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
phase1_local: <completed | blocked | not-started>
phase2_preflight: <completed | blocked | not-started>
phase3_backup: <completed | blocked | not-started; backup dir path>
phase4_stage: <completed | blocked | not-started>
phase5_stop: <completed | blocked | not-started>
phase6_code_swap: <completed | blocked | not-started>
phase7_venv: <completed | blocked | not-started>
phase8_migrate: <completed | blocked | not-started; final revision>
phase9_start: <completed | blocked | not-started>
phase10_verify: <completed | blocked | not-started; http code + revision>
phase11_rollback: <not-needed | executed; restored state>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
