# TASK-0031: W5 production release — evidence (2026-08-13)

- Status: **EXECUTED — BLOCKED at database migration (revision-id length
  defect); full clean rollback executed; service restored — awaiting Codex
  independent review (NOT self-accepted)**
- Authority: `DEC-0139` (product-owner authorization, 2026-08-13)
- Approved SPEC: `SPEC-0012 v0.2.0` (SHA-256 matches approval JSON)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.

## Outcome

All release steps succeeded up to and including the venv rebuild; the database
migration **blocked** because `alembic_version.version_num` is
`character varying(32)` while the 0005 revision id
`0005_opportunity_reminders_ai_reasoning` is 41 characters. Alembic's single
transaction (env.py wraps all migrations) rolled back atomically, so the
database is **unchanged** at `0001_initial_schema`. Code and venv were rolled
back; the service was restored to its prior running state (HTTP 200).

## Phase 1 — Local preparation (completed)

- SPEC-0012 SHA-256 matches approval JSON.
- HEAD = `59101b80b6420155bf8aec26b14ea7800979db86`.
- Release archive recreated (80 entries; migrations 0001–0005 only, no 0006);
  SHA-256 `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`
  — identical to the TASK-0027-reviewed payload.
- Note: a first `git archive -o` attempt wrote the archive into the repo
  (MSYS/`-C` path interaction); the stray file was removed immediately and
  the archive recreated via stdout redirection into the task workspace. No
  repo residue.

## Phase 2 — Server preflight (completed)

| Check | Result |
|---|---|
| Identity | `ubuntu` / `VM-0-17-ubuntu` |
| glibc | 2.39 |
| Disk | 9.3G available |
| DB revision | `0001_initial_schema` |
| Current venv pip check | exit 1 (fastapi 0.141.0 / starlette 0.44.0) |
| Wheelhouse / lock | 39 wheels + `linux-requirements.lock` present |

## Phase 3 — Backup (completed)

- `/opt/anqiao-crm/backup/pre-release-20260813085841/` (mode 0700).
- `database.dump` (pg_dump -Fc; 62,099 bytes;
  SHA-256 `42358275b2f0559321483b07ff5fa11546715f8e58eefeb0c148c0d5f7c77005`).
- `app-code-old.tar.gz` (live code archive; 240,135 bytes;
  SHA-256 `dc31613e1b5eab925fca61cd1f6608224603bb227b36a022f295523228ed89b8`).
- Note: pg_dump as `postgres` cannot write into the ubuntu-owned 0700 dir, and
  `/tmp` sticky bit blocks ubuntu moving a postgres-owned file; the dump was
  written to `/tmp` then moved via `sudo -n mv`.

## Phase 4 — Stage release payload (completed)

- Archive transferred; remote SHA-256 `c856aa8c…` matches.
- Extracted to `/opt/anqiao-crm/tmp/task0031-20260813085841/`.
- `python3.12 -m compileall -q <staged>/src` → exit 0.
- Migrations 0001–0005 only (no 0006).

## Phase 5 — Stop service (completed)

`sudo -n systemctl stop anqiao-crm` → exit 0.

## Phase 6 — Swap code (completed)

Live `src/ templates/ static/ migrations/ alembic.ini pyproject.toml` replaced
with the staged release paths. `scripts/ shared/ venv/ backup/` untouched.

## Phase 7 — Recreate venv at the final path (completed; relocation-safe)

- Old venv → `venv-pre-release-20260813085841`.
- `python3.12 -m venv /opt/anqiao-crm/venv` (created at the final path).
- Offline hash-enforced install from `/tmp/task0030/wheelhouse` → exit 0
  (39 packages, exact frozen versions: fastapi 0.136.3, starlette 1.6.0,
  greenlet 3.5.5, argon2-cffi-bindings 25.1.0).
- `pip check` → exit 0. `uvicorn` shebang
  `#!/opt/anqiao-crm/venv/bin/python3.12` — correct (TASK-0030 shebang
  defect avoided).

Phase 7.5 — `alembic heads` → `0005_opportunity_reminders_ai_reasoning (head)`
only.

## Phase 8 — Database migration (BLOCKED)

- Command: `source shared/database.env` (values never printed) +
  `PYTHONPATH=/opt/anqiao-crm/src venv/bin/python -m alembic upgrade
  0005_opportunity_reminders_ai_reasoning` → **exit 1**.
- Error: `sqlalchemy.exc.DataError: (psycopg.errors.StringDataRightTruncation)
  value too long for type character varying(32)` on
  `UPDATE alembic_version SET version_num='0005_opportunity_reminders_ai_reasoning'`.
- `[VERIFIED]` `alembic_version.version_num` is `character varying(32)`; the
  0005 revision id is 41 characters.
- `[VERIFIED]` Because `migrations/env.py` wraps all migrations in one
  transaction (`context.begin_transaction()`), the failure rolled back the
  whole upgrade atomically: DB is unchanged at `0001_initial_schema`, no new
  tables (read-only psql confirmed: alembic_version, audit_events, contacts,
  follow_up_activities, follow_up_activity_revisions, institution_owner_history,
  institutions, role_grants, server_sessions, user_identities only; no
  erasure_records / import_batches / opportunity_reminders).
- `[INFERENCE]` TASK-0029B's 341 tests did not catch this because the local
  suite runs on SQLite, which does not enforce `varchar(32)` length; PostgreSQL
  does. This is a release-payload defect (revision id longer than alembic's
  default version column).
- No workaround was attempted: widening `alembic_version.version_num` would be
  a database DDL beyond the authorized "forward alembic upgrade", and editing
  the 0005 revision id would change the release payload. Both are separately
  authorized decisions.

## Phase 9–10 — Not reached (blocked at Phase 8)

Service start and verification were skipped because the migration was blocked;
rollback was executed instead.

## Phase 11 — Rollback (executed, successful)

| Step | Command | Result |
|---|---|---|
| Restore code | `rm -rf src templates static migrations alembic.ini pyproject.toml`; `tar xzf backup/.../app-code-old.tar.gz -C /opt/anqiao-crm` | OK |
| Restore venv | `mv venv venv-failed-20260813085841`; `mv venv-pre-release-20260813085841 venv` | OK |
| Start | `sudo -n systemctl start anqiao-crm` | OK |
| Health | `curl http://127.0.0.1:8200/login` | **http_code=200** |
| DB | `SELECT version_num FROM alembic_version` | `0001_initial_schema` (unchanged) |

## Current server state (post-rollback)

- Service running and healthy (HTTP 200) with the restored original code and
  venv.
- Database unchanged at `0001_initial_schema`.
- Release artifacts preserved for a corrected next attempt: staged code at
  `/opt/anqiao-crm/tmp/task0031-20260813085841/`; frozen-lock venv with correct
  shebangs at `/opt/anqiao-crm/venv-failed-20260813085841/`; backup at
  `/opt/anqiao-crm/backup/pre-release-20260813085841/`.
- No database mutation, no nginx/DNS/TLS change, no credential/log read, no
  commit/push.

## No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, or substitute; health verified only via HTTP.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — `shared/database.env`
  was sourced for the migration process (as `start.sh` does) but its values
  were never displayed, logged, or stored.
- **NO MUTATION beyond the authorized sequence** — the only database
  transaction was the atomic alembic upgrade attempt (fully rolled back); the
  only filesystem changes were the code/venv swaps and the backup directory,
  all authorized, all rolled back to the prior state.

## Not verified / boundaries

- The correct fix for the revision-id length defect (widen
  `alembic_version.version_num`, or shorten/relabel the 0005 revision id, or
  another authorized approach) is a separate product-owner/engineering
  decision.
- W5 release completion, G7, V1, R2 remain PENDING and separately
  unauthorized.
- The loopback bind-address change remains deferred (not part of this task).
- Codex independent review is pending; the task is NOT self-accepted.
