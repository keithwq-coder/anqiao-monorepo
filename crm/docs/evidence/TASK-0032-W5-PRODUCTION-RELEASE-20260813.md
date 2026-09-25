# TASK-0032: Corrected W5 production release — evidence (2026-08-13)

- Status: **EXECUTED — W5 RELEASE COMPLETE (HANDOFF-ONLY) — awaiting Codex
  independent review (NOT self-accepted)**
- Authority: `DEC-0141` (product-owner authorization, 2026-08-13)
- Approved SPEC: `SPEC-0012 v0.2.0` (SHA-256 matches approval JSON)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.

## Outcome

The corrected W5 release **succeeded**. The one-time
`ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(64);`
unblocked the migration; the database advanced from `0001_initial_schema` to
`0005_opportunity_reminders_ai_reasoning`; the release code and the frozen-lock
venv are live; the service is healthy (HTTP 200). No rollback was needed.

## Phase 1 — Local preparation (completed)

- SPEC-0012 SHA-256 matches approval JSON; HEAD =
  `59101b80b6420155bf8aec26b14ea7800979db86`; governance PASS.

## Phase 2 — Server preflight (completed)

| Check | Result |
|---|---|
| Identity | `ubuntu` / `VM-0-17-ubuntu` |
| DB revision | `0001_initial_schema` |
| `alembic_version.version_num` | `character varying(32)` (defect present) |
| Staged code compile | exit 0 |
| Wheelhouse / lock | 39 wheels + `linux-requirements.lock` present |
| Backup `database.dump` SHA-256 | `42358275b2f0559321483b07ff5fa11546715f8e58eefeb0c148c0d5f7c77005` (valid) |

## Phase 3 — Widen the version column (completed)

- `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(64);`
  → exit 0 (`ALTER TABLE`).
- Re-verified: `character varying(64)`.

## Phase 4 — Stop service (completed)

`sudo -n systemctl stop anqiao-crm` → exit 0.

## Phase 5 — Swap code (completed)

Live `src/ templates/ static/ migrations/ alembic.ini pyproject.toml` replaced
with the staged release paths
(`/opt/anqiao-crm/tmp/task0031-20260813085841/`). `scripts/ shared/ venv/
backup/` untouched.

## Phase 6 — Rebuild venv at the final path (completed; relocation-safe)

- Old venv → `venv-pre-release-2-20260813092950`.
- `python3.12 -m venv /opt/anqiao-crm/venv` (final path).
- Offline hash-enforced install from `/tmp/task0030/wheelhouse` → exit 0
  (39 packages, exact frozen versions).
- `pip check` → exit 0. `uvicorn` shebang
  `#!/opt/anqiao-crm/venv/bin/python3.12` (correct).

## Phase 7 — Migrate database (completed)

`source shared/database.env` (values never printed) +
`PYTHONPATH=/opt/anqiao-crm/src venv/bin/python -m alembic upgrade
0005_opportunity_reminders_ai_reasoning` → **exit 0**:

- `0001_initial_schema -> 0002_erasure_records` (Create erasure_records table)
- `0002_erasure_records -> 0003_import_batches` (Create import_batches and
  import_row_results)
- `0003_import_batches -> 0004_opportunity_reminders` (Create
  opportunity_reminders)
- `0004_opportunity_reminders -> 0005_opportunity_reminders_ai_reasoning`
  (Add AI-reasoning attribution columns)

## Phase 8 — Start service (completed)

`sudo -n systemctl start anqiao-crm` → exit 0.

## Phase 9 — Verify (all passed)

| Check | Result |
|---|---|
| `curl http://127.0.0.1:8200/login` | **http_code=200** (first retry) |
| `SELECT version_num FROM alembic_version` | `0005_opportunity_reminders_ai_reasoning` |
| New tables | `erasure_records`, `import_batches`, `opportunity_reminders` present |
| `pip check` | exit 0 — clean |
| `pip show fastapi starlette` | fastapi **0.136.3**, starlette **1.6.0** (frozen versions) |

## Phase 10 — Rollback

Not needed (all phases succeeded).

## Current production state

- Service `anqiao-crm` running the **release source** with the **frozen
  dependency set** (fastapi 0.136.3, starlette 1.6.0, greenlet 3.5.5,
  argon2-cffi-bindings 25.1.0) against the **migrated 0005 schema**.
- Preserved: old code/venv backups under
  `/opt/anqiao-crm/backup/pre-release-20260813085841/` and
  `venv-pre-release-2-20260813092950`; the pg_dump backup exists for any
  separately-authorized restore.

## No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, or substitute; health verified only via HTTP.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — `shared/database.env`
  was sourced for the migration process only; its values were never displayed,
  logged, or stored.
- **NO MUTATION beyond the authorized sequence** — the single `ALTER TABLE`
  widening, the code/venv swaps, the forward `alembic upgrade`, and the
  `anqiao-crm` restart only. No nginx/DNS/TLS change, no database
  restore/downgrade, no commit/push.

## Not verified / boundaries

- G7 (DNS/TLS), full V1 business verification, and R2 acceptance remain
  separately unauthorized and PENDING.
- The loopback bind-address change (0.0.0.0:8200 → 127.0.0.1:8200) remains
  DEFERRED (not part of this task).
- Product-owner visual/business acceptance is separate.
- Codex independent review is pending; the task is NOT self-accepted.
