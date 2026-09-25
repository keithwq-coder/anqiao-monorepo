# TASK-0028A/B/C: DeepSeek in PI execution record (2026-08-12)

- Status: **HANDOFF-ONLY — executed sequentially, awaiting Codex independent
  review; NOT self-accepted**
- Handoff: `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0028-PRODUCTION-DEPENDENCY-AUDIT-PACKAGE.md`
- Authority: `DEC-0134` (product-owner authorization, 2026-08-12)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner (only acceptance
  decision-maker)
- Repository state: `main`, intentionally dirty; **all pre-existing work
  preserved**; HEAD `59101b80b6420155bf8aec26b14ea7800979db86`.
- Started: 2026-08-12 Asia/Shanghai; remote identity check UTC
  `2026-08-12T14:13:08Z`.

## 1. What was executed, in order

### TASK-0028A — Local fixed-release dependency baseline (COMPLETED)

Local, read-only. Every command and exit code is recorded in
`docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`.

| Check | Command | Exit | Result |
|---|---|---|---|
| Git state | `git status --short` | 0 | Pre-existing dirty worktree preserved; HEAD `59101b80…db86`; no existing change altered/staged/reverted/cleaned |
| SPEC-0012 hash | `powershell -NoProfile -Command "Get-FileHash docs/specs/30-approved/SPEC-0012-deployment-operations.md -Algorithm SHA256 \| Select-Object -ExpandProperty Hash"` | 0 | `621131C01F85AB9186E0F14D913E20C82EA2016267EC9B4CF0DD867A0DAC1192` — matches approval JSON `621131c0…dac1192` (case-insensitive) |
| Fixed commit | `git cat-file -t 59101b80b6420155bf8aec26b14ea7800979db86`; `git rev-parse …` | 0 | Type `commit`; full SHA resolves |
| Fixed pyproject | `git show 59101b80…:pyproject.toml \| sha256sum` | 0 | `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195` (37 lines); build-system + direct declarations recorded |
| Lock/manifest | `git ls-tree -r --name-only 59101b80… \| sort`; scoped name scan | 0 | `[VERIFIED]` No complete transitive lock and no wheel-hash manifest in the fixed release source (`package-lock.json` is npm; `src/anqiao_crm.egg-info/requires.txt` mirrors direct declarations only) |

### TASK-0028B — Production runtime dependency inventory (COMPLETED)

No-log, read-only, strict SSH. Every command and exit code is recorded in
`docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`.

| # | Command (remote unless noted) | Exit | Result |
|---|---|---|---|
| 0 | `ssh-keygen -F 124.222.212.159` (local) | 0 | Existing ed25519/rsa/ecdsa known-host entries; **no host key added/replaced/removed** |
| 1 | `id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ` | 0 | `ubuntu` / `VM-0-17-ubuntu` / `2026-08-12T14:13:08Z` — identity matches |
| 2 | `systemctl show anqiao-crm --no-pager --property=LoadState,ActiveState,SubState,User,Group,WorkingDirectory,MainPID` | 0 | loaded/active/running; User/Group `ubuntu`; WorkingDirectory `/opt/anqiao-crm`; MainPID 3154799 |
| 3 | `/opt/anqiao-crm/venv/bin/python --version` | 0 | Python 3.12.3 |
| 4 | `/opt/anqiao-crm/venv/bin/python -m pip --version` | 0 | pip 26.1.2 (python 3.12); path detail not stored |
| 5 | `/opt/anqiao-crm/venv/bin/python -m pip check; echo "PIP_CHECK_EXIT=$?"` | 0 (ssh); PIP_CHECK_EXIT=1 | **FAILED (deterministic):** `fastapi 0.141.0 has requirement starlette>=0.46.0, but you have starlette 0.44.0.` |
| 6 | `/opt/anqiao-crm/venv/bin/python -m pip show fastapi starlette uvicorn alembic sqlalchemy psycopg pydantic pydantic-settings jinja2 itsdangerous python-multipart argon2-cffi \| grep -E "^(Name\|Version\|Requires-Dist):"` | PIP_SHOW_EXIT=0 | WARNING: Package(s) not found: python-multipart; versions recorded; output incomplete → fallback required |
| 7 | read-only `importlib.metadata` script (same 12 names; name/version/Requires-Dist only; no CRM code import) | run 1: 1 (unhandled `PackageNotFoundError` on python-multipart); run 2 (per-name handling): **0** | Complete 12-name inventory: fastapi 0.141.0, starlette 0.44.0, uvicorn 0.52.0, alembic 1.18.5, SQLAlchemy 2.0.51, psycopg 3.3.4, pydantic 2.13.4, pydantic-settings 2.14.2, Jinja2 3.1.4, itsdangerous 2.2.0, argon2-cffi 25.1.0, python-multipart **NOT_FOUND** |
| 8 | `sha256sum /opt/anqiao-crm/pyproject.toml` | 0 | `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195` — identical to fixed-release committed file; content not printed |

### TASK-0028C — Difference and proposal (COMPLETED)

No new remote command. Evidence:
`docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`.
Key findings labeled `[VERIFIED]`/`[INFERENCE]`/`[PROPOSAL]`/`[UNKNOWN]`:

- `[VERIFIED]` Fixed source supplies **no** fully resolved immutable
  environment contract: no complete transitive lock, no wheel-hash manifest.
  Precise missing artifact: a fully pinned transitive lock (e.g.
  `pip-compile` output / `uv.lock` / `poetry.lock` / `Pipfile.lock`) **or** a
  wheel-hash manifest (`pip download --require-hashes`-style) covering the
  fixed tree at `59101b80…db86`.
- `[VERIFIED]` 5 exact-pinned direct declarations inconsistent with observed
  runtime metadata (fastapi 0.141.0≠0.136.3; uvicorn 0.52.0≠0.43.0; alembic
  1.18.5≠1.18.4; pydantic 2.13.4≠2.12.5; python-multipart absent); 4
  consistent; 2 range-satisfying. Production `pyproject.toml` hash identical
  to the fixed-release file.
- `[INFERENCE]` Runtime venv was not installed/resolved from the current
  declaration.
- `[PROPOSAL]` Exactly one minimum safe remediation: after separate
  authorization, generate and independently verify a resolved
  lock/hash-verified wheel manifest from the fixed source in an isolated
  local environment, rebuild an isolated immutable environment, validate it,
  then switch the service only under a separate authorized deployment task.
  No in-place production venv surgery proposed.
- `[VERIFIED]` Dependency repair, service restart, migration, deployment,
  and production acceptance remain unverified and unauthorized.

## 2. Local checks (TASK-0028C)

| Command | Exit | Result |
|---|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | 0 | `[PASS] Governance structure and gates are consistent.` — Approved SPECs: 8; Active tasks: 27; Legacy manifests checked: 1 |
| `git diff --check` | 0 | Clean; only pre-existing LF→CRLF warnings on `src/crm/persistence/models.py`, `tests/test_migrations.py`, `tests/test_persistence_schema.py` (files untouched by this package) |
| `git status --short` | 0 | Dirty worktree preserved; this package changed only `docs/NOW.md`, `docs/tasks/TASKS.md`, the three TASK-0028 cards, and added the three TASK-0028 evidence files plus this execution record |
| scoped secret-pattern scan over only the TASK-0028 evidence/status paths (`rg -n -i` for `BEGIN …PRIVATE KEY`, `password[:=]`, `secret[:=]`, `api[_-]?key[:=]`, `token[:=]`, `DATABASE_PASSWORD`, `client_secret`, `access_key`, `AKIA[0-9A-Z]{16}`; no environment files scanned) | 1 (no match) | No secret pattern found in any TASK-0028 evidence/status path |

## 3. No-log / no-secret / no-write attestation

- **NO LOG COMMAND RAN** in any TASK-0028 task — no `journalctl`, no
  `systemctl status`, no `tail`, no `/var/log` path, no log file/query, no
  substitute or aggregate command.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential,
  private key, runtime-environment value, cookie, session, business row,
  database value, or HTTP body was accessed; production `pyproject.toml`
  content was never printed or copied (hash only).
- **NO PRODUCTION WRITE OCCURRED** — no package operation, venv change,
  file/config write, service action, database access, backup,
  nginx/DNS/TLS action, deployment, or external write. TASK-0028C ran no
  remote command at all.
- Repository writes were limited to the exclusive TASK-0028A/B/C paths:
  `docs/tasks/active/TASK-0028A-…md`, `docs/evidence/TASK-0028A-…md`,
  `docs/tasks/active/TASK-0028B-…md`, `docs/evidence/TASK-0028B-…md`,
  `docs/NOW.md`, `docs/tasks/TASKS.md`,
  `docs/tasks/active/TASK-0028C-…md`,
  `docs/evidence/TASK-0028C-…md`, and this file.

## 4. Awaiting

- **CODEX_INDEPENDENT_REVIEW** — the only acceptance decision-maker.
- No dependency repair, W5 release execution, G7, V1, or R2 is authorized or
  proposed to proceed before that review.
