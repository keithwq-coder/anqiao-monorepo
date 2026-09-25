# HANDOFF-20260813: TASK-0032 corrected W5 release to DeepSeek in PI

- Task: TASK-0032 (corrected W5 production release: column widen + release re-run)
- From tool/model: orchestrator (Codex architecture/review role) in PI —
  model `opencode-go/deepseek-v4-pro` (gateway selector only)
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL PRODUCTION RELEASE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Fixed release source: commit `59101b80b6420155bf8aec26b14ea7800979db86`
- Production target: `ubuntu@124.222.212.159` (hostname `VM-0-17-ubuntu`,
  Ubuntu 24.04)
- Written at: 2026-08-13 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the bounded TASK-0032 corrected W5
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
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0139`, `DEC-0140`,
  `DEC-0141`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0032-corrected-w5-production-release.md`
- `docs/evidence/TASK-0031-CODEX-INDEPENDENT-REVIEW-20260813.md`
- this handoff

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands or handle secrets.

## Verification-first discipline

No application code is authored here; the discipline is verification-first:
write each check command and expected outcome before running, record exit codes
and results, and only then advance. The preserved TASK-0031 artifacts are the
input; do not recreate the release archive or re-download packages.

## Package-wide prohibitions

- Never read, print, copy, store, or report a credential, secret, private key,
  runtime environment value, cookie, session, business-row value, database
  value, or the content of `/opt/anqiao-crm/shared/database.env`. It may be
  `source`d for the migration exactly as `start.sh` does, but its values are
  never displayed.
- Never run `journalctl`, `systemctl status`, `tail`, a `/var/log` path, or a
  log query. (`systemctl stop|start|restart anqiao-crm` is allowed; verify
  health only via the HTTP endpoint, never logs.)
- No DNS/TLS change; nginx syntax check only, no edit or reload.
- No database restore/downgrade. The only database mutations are the single
  `ALTER TABLE alembic_version` widening and the forward `alembic upgrade` to
  `0005_opportunity_reminders_ai_reasoning`.
- No cleanup of backups or old artifacts; no commit/push/reset/clean/checkout.
- The `0006_operation_records` migration and all dirty-worktree paths are
  excluded.

## Phase 1 — Local preparation

- Verify SPEC-0012 SHA-256 against its approval JSON; confirm HEAD is
  `59101b80b6420155bf8aec26b14ea7800979db86`; run governance; record
  `git status --short`.

## Phase 2 — Server preflight (read-only)

Strict SSH as `ubuntu@124.222.212.159`; first `id -un; hostname` (expect
`ubuntu` / `VM-0-17-ubuntu`). Then:

1. DB revision: `sudo -n -u postgres psql -d anqiao_crm -X -t -c "SELECT
   version_num FROM alembic_version;"` — expect `0001_initial_schema`.
2. `sudo -n -u postgres psql -d anqiao_crm -X -t -c "SELECT data_type,
   character_maximum_length FROM information_schema.columns WHERE
   table_name='alembic_version' AND column_name='version_num';"` — expect
   `character varying` / `32`.
3. Staged code present: `ls /opt/anqiao-crm/tmp/task0031-20260813085841/src`
   and confirm it compiles (`python3.12 -m compileall -q
   /opt/anqiao-crm/tmp/task0031-20260813085841/src` → 0).
4. Wheelhouse + lock: `ls /tmp/task0030/wheelhouse | wc -l` = 39 and
   `ls /tmp/task0030/linux-requirements.lock`.
5. Backup validity: `sha256sum
   /opt/anqiao-crm/backup/pre-release-20260813085841/database.dump` — expect
   `42358275b2f0559321483b07ff5fa11546715f8e58eefeb0c148c0d5f7c77005`.

## Phase 3 — Widen the version column (one-time DDL)

`sudo -n -u postgres psql -d anqiao_crm -X -c "ALTER TABLE alembic_version
ALTER COLUMN version_num TYPE varchar(64);"` → exit 0. Re-verify the column is
now `character varying(64)`.

## Phase 4 — Stop service

`sudo -n systemctl stop anqiao-crm` (exit 0).

## Phase 5 — Swap code

Replace live `src/ templates/ static/ migrations/ alembic.ini pyproject.toml`
with the staged release paths under `/opt/anqiao-crm/tmp/task0031-20260813085841/`.
Do NOT touch `scripts/`, `shared/`, `venv/`, `backup/`, `data/`.

## Phase 6 — Rebuild venv at the final path (relocation-safe)

1. `TS=$(date +%Y%m%d%H%M%S)`; `sudo -n mv /opt/anqiao-crm/venv
   /opt/anqiao-crm/venv-pre-release-2-$TS`.
2. `sudo -n python3.12 -m venv /opt/anqiao-crm/venv`.
3. `sudo -n /opt/anqiao-crm/venv/bin/pip install --no-index --find-links
   /tmp/task0030/wheelhouse --require-hashes -r /tmp/task0030/linux-requirements.lock`
   (exit 0).
4. `/opt/anqiao-crm/venv/bin/pip check` → exit 0; `head -1
   /opt/anqiao-crm/venv/bin/uvicorn` must show
   `#!/opt/anqiao-crm/venv/bin/python3.12`.

## Phase 7 — Migrate database

`cd /opt/anqiao-crm && set -a && source shared/database.env && set +a &&
export DATABASE_HOST=localhost DATABASE_NAME=anqiao_crm
DATABASE_USER=anqiao_crm_app PYTHONPATH=/opt/anqiao-crm/src &&
/opt/anqiao-crm/venv/bin/python -m alembic upgrade
0005_opportunity_reminders_ai_reasoning` — record exit code and the final
revision line only.

## Phase 8 — Start service

`sudo -n systemctl start anqiao-crm` (exit 0).

## Phase 9 — Verify

- `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8200/login` →
  200 (retry briefly if still booting; no logs).
- `sudo -n -u postgres psql -d anqiao_crm -X -t -c "SELECT version_num FROM
  alembic_version;"` → `0005_opportunity_reminders_ai_reasoning`.
- `pip check` on the live venv → clean.

## Phase 10 — Rollback on any failure

If any of Phases 3–9 fails: `sudo -n systemctl stop anqiao-crm`; restore the
old code from
`/opt/anqiao-crm/backup/pre-release-20260813085841/app-code-old.tar.gz`; restore
the old venv (`sudo -n mv /opt/anqiao-crm/venv /opt/anqiao-crm/venv-failed-2-$TS`
then `sudo -n mv /opt/anqiao-crm/venv-pre-release-2-$TS /opt/anqiao-crm/venv`);
`sudo -n systemctl start anqiao-crm`; verify HTTP 200. The database is
forward-only (a migration failure is atomic and leaves the DB unchanged; a
post-migration service failure leaves DB at 0005, which is additive and
old-code-compatible). End `BLOCKED`.

## Final evidence and governance

Write only:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0032-corrected-w5-production-release.md` (final status)
- `docs/evidence/TASK-0032-W5-PRODUCTION-RELEASE-20260813.md`
- `docs/evidence/TASK-0032-DEEPSEEK-PI-EXECUTION-20260813.md`

Run and record:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
git diff --check
git status --short
```

Run a scoped secret-pattern scan over only the TASK-0032 evidence/status
paths. Confirm: no log command, no secret/environment value read, no DNS/TLS
change, no nginx edit, no database restore/downgrade, no commit/push. End
`HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED`; await Codex independent review.

## Required final response

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
phase1_local: <completed | blocked | not-started>
phase2_preflight: <completed | blocked | not-started>
phase3_widen: <completed | blocked | not-started; column type>
phase4_stop: <completed | blocked | not-started>
phase5_code_swap: <completed | blocked | not-started>
phase6_venv: <completed | blocked | not-started>
phase7_migrate: <completed | blocked | not-started; final revision>
phase8_start: <completed | blocked | not-started>
phase9_verify: <completed | blocked | not-started; http code + revision>
phase10_rollback: <not-needed | executed; restored state>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
