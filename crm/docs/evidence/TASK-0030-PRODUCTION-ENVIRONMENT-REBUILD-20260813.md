# TASK-0030: Production environment rebuild — evidence (2026-08-13)

- Status: **EXECUTED — BLOCKED (switch failed, rolled back; service restored
  to its prior running state) — awaiting Codex independent review (NOT
  self-accepted)**
- Authority: `DEC-0137` (product-owner authorization, 2026-08-13)
- Approved SPEC: `SPEC-0012 v0.2.0` (SHA-256 matches approval JSON)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.

## Goal and outcome

Goal: replace the broken production venv (fastapi 0.141.0 + starlette 0.44.0)
with a fresh environment built strictly from the frozen TASK-0029 lock,
validate, and switch `anqiao-crm` with rollback. Outcome: the rebuild and all
local checks passed; the **switch failed** (service did not come up with the
new venv); **rollback executed successfully** and the service was restored to
its prior running state (HTTP 200 on `/login`). The task ends `BLOCKED`.

## Phase 1 — Local wheelhouse (completed)

- Derived 39 `name==version` pins from the frozen `requirements.lock`
  (anqiao-crm excluded — server runs deployed source via PYTHONPATH).
- Downloaded Linux wheels for the EXACT frozen versions targeting
  `manylinux_2_28_x86_64` + `manylinux_2_17_x86_64`, cp312, only-binary, from
  `https://pypi.org/simple` (exit 0, 39 files). Confirmed the exact tested
  versions are available as Linux wheels: `greenlet-3.5.5-cp312-cp312-…-
  manylinux_2_28_x86_64.whl`, `argon2_cffi_bindings-25.1.0-cp39-abi3-…-
  manylinux_2_28_x86_64.whl`.
- Generated `linux-requirements.lock` (ASCII, 39 pinned lines, each
  `--hash=sha256:…`). Offline hash-enforced dry-run: exit 0. Tampered-hash
  negative test: exit 1.

## Phase 2 — Server read-only preflight (completed)

| Check | Result |
|---|---|
| Identity | `ubuntu` / `VM-0-17-ubuntu` (strict SSH, known-host confirmed) |
| glibc | `glibc 2.39` (manylinux_2_28 compatible) |
| Disk | `/dev/vda2` 9.4G available |
| Current venv `pip check` | **exit 1** — `fastapi 0.141.0 has requirement starlette>=0.46.0, but you have starlette 0.44.0` (broken state reproduced) |
| Start-script reference | `/opt/anqiao-crm/scripts/start.sh` contains `venv/bin/uvicorn` (1 occurrence) |
| Python | `python3.12 --version` = 3.12.3 (system and venv) |

## Phase 3 — Transfer (completed)

- scp 39 wheels + `linux-requirements.lock` to `/tmp/task0030/` on the server
  (exit 0). Remote lock SHA-256 `0f3f98d9…2358e98` equals the local hash
  (byte-identical).

## Phase 4 — Fresh venv, offline install (completed)

- `python3.12 -m venv /opt/anqiao-crm/venv-new` → OK.
- `venv-new/bin/pip install --no-index --find-links /tmp/task0030/wheelhouse
  --require-hashes -r /tmp/task0030/linux-requirements.lock` → **exit 0**;
  39 packages installed with exact frozen versions.

## Phase 5 — Validate (completed, before switch)

| Check | Result |
|---|---|
| `venv-new/bin/pip check` | exit 0 — "No broken requirements found." |
| `pip show fastapi starlette` | fastapi **0.136.3**, starlette **1.6.0** (exact frozen versions) |
| Deps import | `import fastapi, starlette, sqlalchemy, pydantic, alembic, uvicorn, psycopg, argon2` → OK |
| App import | `PYTHONPATH=/opt/anqiao-crm/src python -c "import crm.web.main"` → fails at pydantic-settings validation (requires runtime secrets `database_password` etc.) — expected fail-closed without the runtime environment; NOT a venv defect. Full app validation was deferred to the post-switch health check under the real runtime env. |

## Phase 6 — Switch (executed; service did not come up)

- `systemctl stop anqiao-crm` as `ubuntu` → "Interactive authentication
  required" (exit 1). Directory swap was executed first:
  `venv` → `venv-broken-20260813022251`; `venv-new` → `venv` (both OK).
- Confirmed the established non-interactive sudo path works
  (`sudo -n true` → OK, consistent with prior tasks' `sudo -n nginx -t`).
- `sudo -n systemctl restart anqiao-crm` → exit 0 (service started against the
  new venv).
- Health check: `curl http://127.0.0.1:8200/login` and `/health` →
  `http_code=000` (connection refused) for 6 attempts over ~70 seconds. The
  service did not come up with the new venv.

## Phase 7 — Mandatory rollback (executed, successful)

| Step | Command | Result |
|---|---|---|
| Stop | `sudo -n systemctl stop anqiao-crm` | OK |
| Preserve failed env | `mv venv venv-failed-20260813022501` | OK |
| Restore original | `mv venv-broken-20260813022251 venv` | OK |
| Start | `sudo -n systemctl start anqiao-crm` | OK |
| Health | `curl http://127.0.0.1:8200/login` | **http_code=200** (service restored to its prior running state) |

## Root-cause finding (recorded, not patched)

- `[VERIFIED]` The frozen-lock venv (fastapi 0.136.3, starlette 1.6.0, greenlet
  3.5.5, argon2-cffi-bindings 25.1.0) is the dependency set the RELEASE source
  `59101b80…` was tested against (341 tests passed in TASK-0029B).
- `[VERIFIED]` The previously deployed server code was running with the old
  venv (fastapi 0.141.0 / starlette 0.44.0), and the service was up before
  this task. The ONLY variable changed by the switch was the venv, and the
  service then failed to start; restoring the old venv brought it back to 200.
- `[INFERENCE]` The code currently deployed under `/opt/anqiao-crm/src` is not
  the release source `59101b80…` and does not run with the frozen dependency
  set. The environment rebuild alone cannot bring the running service to the
  frozen state; the deployed code and the database revision (currently
  `0001_initial_schema`) must advance together with the venv — i.e., the
  bounded W5 release scope (fixed payload transfer + migration + restart) is a
  prerequisite, not this task's scope.
- `[UNKNOWN]` The exact startup failure reason (no logs read, per boundary).

## Current server state (post-rollback)

- Service `anqiao-crm` running and responding (HTTP 200 on `/login`),
  using the restored original venv (`/opt/anqiao-crm/venv`).
- The clean frozen-lock venv is preserved at
  `/opt/anqiao-crm/venv-failed-20260813022501` (available for the future
  release task to reuse after code + DB are advanced).
- Transfer artifacts remain at `/tmp/task0030/` on the server.
- No database access, no nginx/DNS/TLS change, no credential/log read, no
  commit/push.

## No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, or substitute. Service state was verified only via the HTTP
  health endpoint.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential,
  environment value (including `database.env` content), session, business-row,
  or database value was accessed. The app import failure proves the runtime
  secrets were not supplied.
- **NO MUTATION beyond the authorized switch/rollback** — venv directory
  renames and `anqiao-crm` restart only; no database action, no
  source/configuration change, no nginx/DNS/TLS change, no commit/push.

## Not verified / boundaries

- Whether the deployed code + frozen deps can ever start together without
  advancing code/DB (out of scope, separately authorized).
- W5 release execution (fixed payload transfer + migration + restart), G7, V1,
  R2 remain separately unauthorized and PENDING.
- Codex independent review of this task is pending; the task is NOT
  self-accepted.
