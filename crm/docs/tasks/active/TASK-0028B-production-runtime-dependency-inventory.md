# TASK-0028B: Production runtime dependency inventory

- Task ID: TASK-0028B
- Status: ACTIVE / **EXECUTED 2026-08-12 — AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)**
- Task type: VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0134`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-12 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: TASK-0028A evidence; `DEC-0134`; known-host trust and strict
  non-interactive access to the established production target

## Goal

Obtain a no-log, read-only inventory of the production CRM runtime's Python and
selected package metadata, without reading runtime configuration, credentials,
business data, or logs.

## Exclusive local write paths

- `docs/tasks/active/TASK-0028B-production-runtime-dependency-inventory.md`
- `docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`

All other repository paths are read-only to the executor.

## Hard boundaries

- Use only `ubuntu@124.222.212.159` with `BatchMode=yes`,
  `StrictHostKeyChecking=yes`, and `ConnectTimeout=15`; do not modify known
  hosts, use a fallback host, a tunnel, or agent forwarding.
- No `journalctl`, `systemctl status`, `/var/log`, log path/query, or substitute
  that reads or derives log content or metadata.
- No package install/upgrade/downgrade/uninstall/download/cache operation, venv
  change, file/configuration write, service action, database access, backup,
  nginx/DNS/TLS action, credential/environment-content reading, commit, or push.
- The production virtual environment may only run the exact read-only commands
  named in the handoff. Do not import CRM application modules.

## Prerequisites and completion gate

- First verify the strict SSH user/hostname identity. Any mismatch, prompt,
  authentication problem, or unexpected command stops the task as `BLOCKED`.
- Record only allowlisted systemd metadata and runtime venv command results.
- Hash `/opt/anqiao-crm/pyproject.toml` without printing its content. Inventory
  only the named Python packages and metadata.
- Write redacted evidence with every actual remote command, exit code, and
  result. Explicitly state that no log command ran and no production write
  occurred.

## Execution record (2026-08-12, DeepSeek in PI)

- Known-host: `ssh-keygen -F 124.222.212.159` found existing ed25519/rsa/ecdsa
  entries (exit 0); no host key added/replaced/removed.
- Strict identity passed: `id -un; hostname; date -u` → `ubuntu` /
  `VM-0-17-ubuntu` / `2026-08-12T14:13:08Z` (exit 0).
- Allowlist executed in order: systemd properties (loaded/active/running;
  User/Group `ubuntu`; WorkingDirectory `/opt/anqiao-crm`; MainPID 3154799);
  Python 3.12.3; pip 26.1.2; **`pip check` FAILED (exit 1, deterministic):
  `fastapi 0.141.0` requires `starlette>=0.46.0`, runtime has `starlette
  0.44.0`**; `pip show` incomplete (python-multipart not found) → read-only
  `importlib.metadata` fallback completed the 12-name inventory (exit 0):
  fastapi 0.141.0, starlette 0.44.0, uvicorn 0.52.0, alembic 1.18.5,
  SQLAlchemy 2.0.51, psycopg 3.3.4, pydantic 2.13.4, pydantic-settings
  2.14.2, Jinja2 3.1.4, itsdangerous 2.2.0, argon2-cffi 25.1.0,
  **python-multipart NOT_FOUND**; `sha256sum /opt/anqiao-crm/pyproject.toml`
  = `93b3f4bf…d09195` (identical to fixed-release committed file, content not
  printed).
- Inconsistent with fixed-release exact pins: fastapi, uvicorn, alembic,
  pydantic, python-multipart (absent); consistent: sqlalchemy, psycopg,
  pydantic-settings, argon2-cffi; range-satisfying: jinja2, itsdangerous.
  Full evidence: `docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`.
- No log command; no secret/config/environment/package-location value stored;
  no package/service/database/write action; no CRM code imported; writes
  limited to exclusive paths. **Not self-accepted; Codex independent review
  pending.**

## Not verified by this task

- Runtime configuration values, application import behavior, dependency repair,
  full service health, migration state, and any business or visual behavior.
