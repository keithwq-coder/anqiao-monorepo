# TASK-0027: W5 bounded production release correction — evidence (2026-08-12)

- Status: **BLOCKED — stopped at remote precondition 6 (runtime venv `pip
  check` failed) before any production mutation**
- Authority: `DEC-0133` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0` (hash matches approval metadata, see §1)
- Execution owner: DeepSeek in PI through the configured OpenCode Go route
  (`opencode-go/deepseek-v4-flash`; gateway selector only, upstream identity
  not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved. HEAD is exactly commit
  `59101b80b6420155bf8aec26b14ea7800979db86`.
- Scope: one bounded W5 production release correction. The task stopped
  `BLOCKED` at the strict remote preconditions, before the authorized
  mutation sequence. **No production write, backup, transfer, migration,
  restart, or rollback occurred.**

> This task does not claim W5 acceptance and does not self-accept. W5 release
> execution, G7, V1, and R2 remain PENDING and separately unauthorized. Codex
> independent review is pending.

## 1. Local release preparation (pre-flight record)

| Check | Command | Exit | Result |
|---|---|---|---|
| Git state | `git status --short` | 0 | Pre-existing dirty worktree preserved; HEAD `59101b80…db86`; uncommitted TASK-0018 `0006_operation_records` and other uncommitted paths recorded, excluded from payload |
| Approved SPEC hash | `powershell -NoProfile -Command "Get-FileHash docs/specs/30-approved/SPEC-0012-deployment-operations.md -Algorithm SHA256"` | 0 | `621131C01F85AB9186E0F14D913E20C82EA2016267EC9B4CF0DD867A0DAC1192`, case-insensitive match with approval JSON `621131c0…dac1192`; no file changed |
| Known-host check | `ssh-keygen -F 124.222.212.159` | 0 | Existing ed25519/rsa/ecdsa known-host entries found; no host key added or replaced |
| Commit tree allowlist | `git ls-tree -r --name-only 59101b80 … -- <9 allowlisted paths>` | 0 | Only allowlisted paths exist at the commit: `src/` (40 files), `templates/` (10), `static/` (2), `migrations/` (7: env.py, script.py.mako, versions 0001–0005), `alembic.ini`, `pyproject.toml`, `deploy/start.sh`, `deploy/anqiao-crm.service`, `deploy/nginx_crm.conf`; **no `0006_operation_records`** |
| Archive creation | `git archive 59101b80… <9 allowlisted paths> -o release-source.tar` | 0 | 80 tar entries (64 files + directories), all inside the allowlist; manifest recorded |

- Source commit (exact): `59101b80b6420155bf8aec26b14ea7800979db86`
- Local archive path: `/tmp/task0027-20260812T123443Z/release-source.tar`
  (unique local temporary directory outside the repository)
- Archive SHA-256:
  `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`
- Top-level manifest: 1× alembic.ini, 4× deploy entries, 9× migrations
  entries, 1× pyproject.toml, 50× src entries, 4× static entries, 11×
  templates entries (directory entries included). Migrations in archive:
  `0001_initial_schema` … `0005_opportunity_reminders_ai_reasoning` only.

### Archived-tree validation (independent of the dirty worktree)

- Extract: `tar -xf release-source.tar` into
  `/tmp/task0027-20260812T123443Z/extracted` → exit 0.
- Compile: repo `.venv` Python 3.12.8
  (`/d/Project/中科安樵/crm/.venv/Scripts/python.exe -m compileall -q
  extracted/src`) → exit 0.
- Alembic heads from the extracted tree (repo `.venv`, alembic 1.18.4,
  `PYTHONPATH=extracted/src`):
  `0005_opportunity_reminders_ai_reasoning (head)` → only head; exit 0.
- **Tests: NOT RUN from the extracted tree.** Exact reason: the release
  payload allowlist excludes `tests/`, so the archive contains no tests to
  run; running current-worktree tests would not be release-payload evidence
  (handoff forbids substitution). No worktree tests were used as release
  evidence.

## 2. Strict remote preconditions (no-log, read-only only)

All remote commands: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes
-o ConnectTimeout=15 ubuntu@124.222.212.159 '<command>'`.

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ` | 0 | user `ubuntu`; hostname `VM-0-17-ubuntu`; UTC `2026-08-12T12:35:20Z` — matches expected target |
| 2 | `systemctl show anqiao-crm --no-pager --property=LoadState,ActiveState,SubState,FragmentPath,User,Group,WorkingDirectory,MainPID` | 0 | loaded / active / running; FragmentPath=/etc/systemd/system/anqiao-crm.service; User=ubuntu; Group=ubuntu; WorkingDirectory=/opt/anqiao-crm; MainPID=3154799 |
| 3 | `stat -c "%U %G %a %s %n" /opt/anqiao-crm/shared/database.env; if test -r …` | 0 | `ubuntu ubuntu 600 231 /opt/anqiao-crm/shared/database.env`; READABLE_AS_SERVICE_USER=yes; **not read** |
| 4 | `grep -E "^\s*(server_name|listen|proxy_pass|ssl_certificate_key|ssl_certificate)\b" /etc/nginx/sites-enabled/crm; sudo -n nginx -t` | 0 | crm directives: `server_name crm.aibrain.wiki;` `proxy_pass http://127.0.0.1:8200;` `listen 443 ssl;` `ssl_certificate /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem;` `ssl_certificate_key /etc/letsencrypt/live/crm.aibrain.wiki/privkey.pem;` `listen 80;`; `nginx -t` → `syntax is ok` / `test is successful`; nginx not changed/reloaded |
| 5 | `ss -ltn | awk … :(22|80|443|8200|5432)$ …` (no `-p`) | 0 | `0.0.0.0:8200` (CRM, currently 0.0.0.0 — the loopback change was the authorized later step, not performed), `0.0.0.0:80`, `0.0.0.0:443`, `127.0.0.1:5432`, `*:22` |
| 6 | `sudo -n -u postgres psql -d anqiao_crm -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(); SELECT version_num FROM alembic_version; SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename; SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY schemaname, relname; COMMIT;"` | 0 | current_database `anqiao_crm`; `alembic_version` = `0001_initial_schema`; 10 public tables: alembic_version, audit_events, contacts, follow_up_activities, follow_up_activity_revisions, institution_owner_history, institutions, role_grants, server_sessions, user_identities; estimated n_live_tup: alembic_version 1, audit_events 17, contacts 117, follow_up_activities 0, follow_up_activity_revisions 0, institution_owner_history 20, institutions 117, role_grants 24, server_sessions 8, user_identities 25. No application column/row value selected |
| 7 | `test -d /opt/anqiao-crm/backup && echo BACKUP_PARENT_EXISTS=yes …; test -x /opt/anqiao-crm/venv/bin/python …; /opt/anqiao-crm/venv/bin/python -m pip check` | 1 | BACKUP_PARENT_EXISTS=yes; VENV_PYTHON_EXISTS=yes; **`pip check` FAILED**: `fastapi 0.141.0 has requirement starlette>=0.46.0, but you have starlette 0.44.0.` |
| 7b | `/opt/anqiao-crm/venv/bin/python -m pip check; echo PIP_CHECK_EXIT=$?` (re-run) | 0 (ssh); PIP_CHECK_EXIT=1 | Same failure reproduced: `fastapi 0.141.0 … starlette 0.44.0.` — deterministic |

## 3. BLOCKING condition (fail-closed)

Precondition 6 of the handoff's strict remote preconditions and the
TASK-0027 card both require: "the runtime venv passes
`/opt/anqiao-crm/venv/bin/python -m pip check`."

Observed (deterministic, two runs):

```
fastapi 0.141.0 has requirement starlette>=0.46.0, but you have starlette 0.44.0.
```

Additional non-secret observation: the release payload
`pyproject.toml` at commit `59101b80…` pins `fastapi==0.136.3`, while the
runtime venv has `fastapi 0.141.0` with `starlette 0.44.0` — the installed
runtime dependency set is inconsistent with the committed release manifest.

Per the handoff, "Any mismatch, permission failure, or condition outside this
allowlist stops `BLOCKED` before production mutation. Do not work around it."
Installing/upgrading packages in the runtime venv is a hard prohibition
("install packages"). Therefore the task stopped `BLOCKED` before the first
production write. No workaround was attempted.

## 4. Authorized mutation sequence — NOT PERFORMED

| Step | Status |
|---|---|
| 1. Create `/opt/anqiao-crm/backup/pre-task0027-$TS` (0700) | NOT PERFORMED — blocked before mutation |
| 2. `pg_dump -Fc -d anqiao_crm` → `database.dump` | NOT PERFORMED |
| 3. Live code archive | NOT PERFORMED |
| 4. Transfer/stage local archive | NOT PERFORMED |
| 5. Staged compile + Alembic head check | NOT PERFORMED remotely (local extracted-tree validation passed, §1) |
| 6. Copy allowlisted staged paths + `--host` 0.0.0.0→127.0.0.1 | NOT PERFORMED |
| 7. Alembic `upgrade 0005_opportunity_reminders_ai_reasoning` | NOT PERFORMED |
| 8. `systemctl restart anqiao-crm` + liveness probes | NOT PERFORMED |
| 9. Re-run `nginx -t` + CRM site checksum compare | NOT PERFORMED (nginx unchanged; pre-write syntax already verified) |

No backup files, no staged/deployed checksums, no migration revision change,
no restart, no liveness metadata, no recovery were produced because no
production write occurred. There is nothing to roll back.

## 5. No-log / no-secret attestation

**NO LOG COMMAND RAN.** The executor ran no `journalctl`, no `systemctl
status`, no `tail`, no `/var/log` path, no log file, no log query, and no
command intended to read or derive log content or metadata (including counts
and timestamps). No substitute log interface was used. This document contains
no log facts, counts, timestamps, or bodies.

**NO SECRET WAS READ, PRINTED, COPIED, OR STORED.** `/opt/anqiao-crm/shared/
database.env` was inspected for metadata/readability only (owner, group,
mode, size, name). No credential, secret, private key, runtime-environment
value, cookie, session, business-row value, backup content, or HTTP response
body was read, printed, copied, or persisted. No business request beyond the
allowlisted metadata commands was made (no liveness probe was performed).

Full remote command inventory (for Codex audit): items 1–7b in §2, all
no-log and read-only. No command reads logs; no command mutates anything.

## 6. Remaining unverified items (not claimed by this task)

- Restore rehearsal of a production backup (explicitly NOT authorized and NOT
  performed; checksum/metadata-only validation would not prove a restore).
- Full V1 behavior, authenticated workflows, data masking, restart
  persistence, other-site user journeys, product-owner visual/business
  acceptance.
- Any DNS/TLS change or long-term backup/deletion-propagation behavior.
- Runtime venv consistency: `pip check` failure and the installed
  fastapi/starlette versions vs the release payload's pinned
  `fastapi==0.136.3` — an open precondition for any future W5 attempt.
- All items in the TASK-0027 "Not verified by this task" list remain not
  verified.

## 7. Later-gate stop conditions (recorded, not acted on)

- W5 release execution, G7 (DNS/TLS), V1 (runtime verification), and R2
  (independent/human acceptance) remain PENDING and separately unauthorized.
- The runtime venv `pip check` failure is a blocking precondition for any
  future W5 attempt under this or a successor authorization; it was not
  worked around.
