# TASK-0028B: Production runtime dependency inventory — evidence (2026-08-12)

- Status: **EXECUTED — awaiting Codex independent review (NOT self-accepted)**
- Authority: `DEC-0134` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.
- Scope: one no-log, read-only production runtime dependency inventory.
  **No package operation, configuration/environment read, service/database
  action, log access, or production write occurred.** Allowed facts recorded:
  package metadata (names, versions, declared requirements) and the
  `pyproject.toml` SHA-256. No runtime configuration value, package location,
  environment value, or log detail is stored.

## 1. Local known-host confirmation (before connecting)

| Check | Command | Exit | Result |
|---|---|---|---|
| Existing known-host entry | `ssh-keygen -F 124.222.212.159` | 0 | Existing `ssh-ed25519`, `ssh-rsa`, and `ecdsa-sha2-nistp256` entries found; **no host key added, replaced, or removed** |

## 2. Strict identity check (first remote command only)

Connection: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o
ConnectTimeout=15 ubuntu@124.222.212.159 '<command>'` for every remote item.

| Command | Exit | Result |
|---|---|---|
| `id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ` | 0 | user `ubuntu`; hostname `VM-0-17-ubuntu`; UTC `2026-08-12T14:13:08Z` — matches the expected target; no prompt, no auth problem |

## 3. Remote allowlist (in exact order)

| # | Command | Exit | Result (allowed facts only) |
|---|---|---|---|
| 1 | `systemctl show anqiao-crm --no-pager --property=LoadState,ActiveState,SubState,User,Group,WorkingDirectory,MainPID` | 0 | `LoadState=loaded`; `ActiveState=active`; `SubState=running`; `User=ubuntu`; `Group=ubuntu`; `WorkingDirectory=/opt/anqiao-crm`; `MainPID=3154799` |
| 2 | `/opt/anqiao-crm/venv/bin/python --version` | 0 | `Python 3.12.3` |
| 3 | `/opt/anqiao-crm/venv/bin/python -m pip --version` | 0 | `pip 26.1.2 (python 3.12)` — package location detail not stored |
| 4 | `/opt/anqiao-crm/venv/bin/python -m pip check; echo "PIP_CHECK_EXIT=$?"` | 0 (ssh); PIP_CHECK_EXIT=1 | **FAILED (deterministic, matches TASK-0027):** `fastapi 0.141.0 has requirement starlette>=0.46.0, but you have starlette 0.44.0.` |
| 5 | `/opt/anqiao-crm/venv/bin/python -m pip show fastapi starlette uvicorn alembic sqlalchemy psycopg pydantic pydantic-settings jinja2 itsdangerous python-multipart argon2-cffi \| grep -E "^(Name\|Version\|Requires-Dist):"` | PIP_SHOW_EXIT=0 | `WARNING: Package(s) not found: python-multipart`; observed versions below (output filtered to Name/Version; `pip show` has no `Requires-Dist` field — requirements captured via the item-6 fallback). **Output incomplete for the 12-name list → fallback item 6 required.** |
| 6 | `/opt/anqiao-crm/venv/bin/python -c "<read-only importlib.metadata script, same 12-name list, prints only distribution name, version, declared Requires-Dist values; no CRM code imported>"` | run 1: 1 (unhandled `PackageNotFoundError` on `python-multipart`, which is itself factual — distribution absent); run 2 (same script with per-name `PackageNotFoundError` handling): **0** | Complete 12-name inventory, see §4 |
| 7 | `sha256sum /opt/anqiao-crm/pyproject.toml` | 0 | `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195` — identical to the fixed-release committed `pyproject.toml` (TASK-0028A). File content was **not** printed or copied |

## 4. Observed installed distribution metadata (importlib.metadata, item 6)

`Requires-Dist` values are recorded verbatim as declared distribution
metadata (allowed facts). No value from any runtime configuration,
environment, or log is recorded.

| Distribution | Version | Declared Requires-Dist (base) |
|---|---|---|
| fastapi | 0.141.0 | `starlette>=0.46.0; pydantic>=2.9.0; typing-extensions>=4.8.0; typing-inspection>=0.4.2; annotated-doc>=0.0.2` (plus `extra == "standard"/"standard-no-fastapi-cloud-cli"/"all"` markers: `fastapi-cli[standard]>=0.0.32`, `fastar>=0.9.0`, `httpx<1.0.0,>=0.23.0`, `jinja2>=3.1.5`, `python-multipart>=0.0.18`, `email-validator>=2.0.0`, `uvicorn[standard]>=0.12.0`, `pydantic-settings>=2.0.0`, `pydantic-extra-types>=2.0.0`, `itsdangerous>=1.1.0`, `pyyaml>=5.3.1`) |
| starlette | 0.44.0 | `anyio<5,>=3.4.0; typing-extensions>=3.10.0` (plus `python_version < '3.10'` marker; `extra == 'full'` markers: `httpx<0.29.0,>=0.27.0`, `itsdangerous`, `jinja2`, `python-multipart>=0.0.18`, `pyyaml`) |
| uvicorn | 0.52.0 | `click>=7.0; h11>=0.8; typing-extensions>=4.0` (plus `extra == 'standard'` markers: `httptools>=0.8.0`, `python-dotenv>=0.13`, `pyyaml>=5.1`, `uvloop>=0.15.1`, `watchfiles>=0.20`, `websockets>=13.0`) |
| alembic | 1.18.5 | `SQLAlchemy>=1.4.23; Mako; typing-extensions>=4.12` (plus markers: `tomli` on `python_version < "3.11"`; `tzdata` on `extra == "tz"`) |
| SQLAlchemy | 2.0.51 | `typing-extensions>=4.6.0` (plus platform/extra markers: `greenlet>=1`, `importlib-metadata` on old Python, and the `postgresql-*`, `asyncio`, `mypy` etc. extra markers) |
| psycopg | 3.3.4 | `typing-extensions>=4.6` (plus markers: `tzdata` on `python_version < "3.13"`; `psycopg-c==3.3.4` / `psycopg-binary==3.3.4` extras; dev/test/docs extra markers) |
| pydantic | 2.13.4 | `annotated-types>=0.6.0; pydantic-core==2.46.4; typing-extensions>=4.14.1; typing-inspection>=0.4.2` (plus `email-validator>=2.0.0` / `tzdata` extra markers) |
| pydantic-settings | 2.14.2 | `pydantic>=2.7.0; python-dotenv>=0.21.0; typing-inspection>=0.4.0` (plus secret-manager/toml/yaml extra markers) |
| Jinja2 | 3.1.4 | `MarkupSafe>=2.0` (plus `Babel>=2.7` on `extra == "i18n"`) |
| itsdangerous | 2.2.0 | (none) |
| python-multipart | **NOT_FOUND** | (not installed as a distribution; declared in fixed release as `python-multipart==0.0.22`) |
| argon2-cffi | 25.1.0 | `argon2-cffi-bindings` |

## 5. Consistency of fixed-release direct declarations vs observed runtime metadata

Fixed-release direct declarations (from TASK-0028A evidence,
`93b3f4bf…d09195`, identical file hash in production):

| Fixed-release declaration | Observed runtime | Consistent? |
|---|---|---|
| `fastapi==0.136.3` | fastapi 0.141.0 | **INCONSISTENT** (exact pin not met) |
| `uvicorn==0.43.0` | uvicorn 0.52.0 | **INCONSISTENT** (exact pin not met) |
| `alembic==1.18.4` | alembic 1.18.5 | **INCONSISTENT** (exact pin not met) |
| `pydantic==2.12.5` | pydantic 2.13.4 | **INCONSISTENT** (exact pin not met) |
| `python-multipart==0.0.22` | NOT installed | **INCONSISTENT** (declared, absent) |
| `sqlalchemy==2.0.51` | SQLAlchemy 2.0.51 | CONSISTENT |
| `psycopg[binary]==3.3.4` | psycopg 3.3.4 | CONSISTENT (psycopg-binary presence not queried — `[UNKNOWN]`, not speculated) |
| `pydantic-settings==2.14.2` | pydantic-settings 2.14.2 | CONSISTENT |
| `argon2-cffi==25.1.0` | argon2-cffi 25.1.0 | CONSISTENT |
| `jinja2>=3.1.2,<3.1.5` | Jinja2 3.1.4 | CONSISTENT (range satisfied) |
| `itsdangerous>=2.1.2` | itsdangerous 2.2.0 | CONSISTENT (range satisfied) |

- `starlette 0.44.0` is **not** a fixed-release direct declaration; it is
  observed runtime metadata. The `pip check` conflict
  (`fastapi 0.141.0` requires `starlette>=0.46.0`) is recorded as observed
  runtime metadata only; no speculation about unobserved transitive
  dependencies is made.
- `[INFERENCE]` The production `pyproject.toml` is byte-identical to the
  fixed-release declaration (`[VERIFIED]` by SHA-256), yet several installed
  exact-pinned direct dependencies differ from the declaration and one
  declared direct dependency is absent; therefore the runtime venv was not
  installed/resolved from the current declaration. No package operation was
  run to test or alter this.

## 6. No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, no `systemctl status`, no
  `tail`, no `/var/log` path, no log file/query, no substitute or aggregate
  log command.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential,
  private key, runtime-environment value, cookie, session, business row,
  database value, or HTTP body was accessed. `sha256sum` of the production
  `pyproject.toml` was recorded; its content was not printed or copied.
- **NO PRODUCTION WRITE AND NO MUTATION** — no package install/upgrade/
  downgrade/uninstall/download/cache operation, venv change, file/
  configuration write, service action, database access, backup,
  nginx/DNS/TLS action, credential change, commit, push, reset, clean, or
  checkout. No CRM application code was imported.
- Remote commands were limited to the handoff allowlist (items 1–7), plus
  the local `ssh-keygen -F` known-host check and the required
  `importlib.metadata` fallback (item 6) triggered by the incomplete
  `pip show` output.

## 7. Writes performed (exclusive TASK-0028B paths only)

- `docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`
  (this file) — created.
- `docs/tasks/active/TASK-0028B-production-runtime-dependency-inventory.md` —
  status updated to the factual executed state; **not self-accepted**.
- No other repository path was written.

## 8. Not verified by this task

- Runtime configuration values, application import behavior, dependency
  repair, full service health, migration state, and any business or visual
  behavior.
- Presence/versions of any distribution not in the 12-name list (including
  `psycopg-binary`, `pydantic-core`, and starlette's transitive set) —
  deliberately not queried or speculated.
- TASK-0028B does not self-accept; Codex independent review is pending.
