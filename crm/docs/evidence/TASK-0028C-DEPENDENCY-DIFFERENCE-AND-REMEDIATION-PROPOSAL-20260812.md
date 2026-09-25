# TASK-0028C: Dependency difference and remediation proposal — evidence (2026-08-12)

- Status: **EXECUTED — awaiting Codex independent review (NOT self-accepted)**
- Authority: `DEC-0134` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.
- Scope: evidence-based comparison of TASK-0028A (fixed-release declaration)
  and TASK-0028B (observed production runtime metadata) with the fixed commit
  `59101b80b6420155bf8aec26b14ea7800979db86`, plus exactly one minimum safe
  remediation candidate as a **proposal only**. **No new remote, SSH, public
  endpoint, package, service, database, or deployment command ran; no
  remediation was executed.**

## 1. Fixed-release direct dependency declarations — `[VERIFIED]`

Source: TASK-0028A evidence
(`docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`),
from `git show 59101b80b6420155bf8aec26b14ea7800979db86:pyproject.toml`
(SHA-256 `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`;
37 lines; build-system `setuptools==82.0.1` /
`setuptools.build_meta`; `requires-python >=3.12,<3.15`):

| Package | Declared constraint |
|---|---|
| alembic | `==1.18.4` |
| argon2-cffi | `==25.1.0` |
| fastapi | `==0.136.3` |
| itsdangerous | `>=2.1.2` |
| jinja2 | `>=3.1.2,<3.1.5` |
| psycopg[binary] | `==3.3.4` |
| pydantic | `==2.12.5` |
| pydantic-settings | `==2.14.2` |
| python-multipart | `==0.0.22` |
| sqlalchemy | `==2.0.51` |
| uvicorn | `==0.43.0` |
| (optional `test`) | `httpx==0.28.1`, `pytest==9.0.2` |

## 2. Observed production runtime metadata — `[VERIFIED]`

Source: TASK-0028B evidence
(`docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`),
read-only strict-SSH allowlist (identity `ubuntu` / `VM-0-17-ubuntu`
passed):

- Python 3.12.3; pip 26.1.2 (path detail not stored).
- `anqiao-crm` systemd: loaded/active/running; User/Group `ubuntu`;
  WorkingDirectory `/opt/anqiao-crm`; MainPID 3154799.
- `pip check` **FAILED** (exit 1, deterministic): `fastapi 0.141.0 has
  requirement starlette>=0.46.0, but you have starlette 0.44.0.`
- Installed distributions (importlib.metadata, complete 12-name inventory,
  exit 0): fastapi 0.141.0, starlette 0.44.0, uvicorn 0.52.0, alembic 1.18.5,
  SQLAlchemy 2.0.51, psycopg 3.3.4, pydantic 2.13.4, pydantic-settings
  2.14.2, Jinja2 3.1.4, itsdangerous 2.2.0, argon2-cffi 25.1.0,
  **python-multipart NOT_FOUND**.
- `sha256sum /opt/anqiao-crm/pyproject.toml` =
  `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195` —
  byte-identical to the fixed-release committed `pyproject.toml`.

## 3. Observed differences (observed metadata vs fixed-release direct declarations)

| Direct declaration | Observed runtime | Assessment |
|---|---|---|
| `fastapi==0.136.3` | fastapi 0.141.0 | INCONSISTENT (exact pin not met) |
| `uvicorn==0.43.0` | uvicorn 0.52.0 | INCONSISTENT (exact pin not met) |
| `alembic==1.18.4` | alembic 1.18.5 | INCONSISTENT (exact pin not met) |
| `pydantic==2.12.5` | pydantic 2.13.4 | INCONSISTENT (exact pin not met) |
| `python-multipart==0.0.22` | not installed | INCONSISTENT (declared, absent) |
| `sqlalchemy==2.0.51` | SQLAlchemy 2.0.51 | CONSISTENT |
| `psycopg[binary]==3.3.4` | psycopg 3.3.4 | CONSISTENT; `psycopg-binary` presence `[UNKNOWN]` (not queried) |
| `pydantic-settings==2.14.2` | pydantic-settings 2.14.2 | CONSISTENT |
| `argon2-cffi==25.1.0` | argon2-cffi 25.1.0 | CONSISTENT |
| `jinja2>=3.1.2,<3.1.5` | Jinja2 3.1.4 | CONSISTENT (range satisfied) |
| `itsdangerous>=2.1.2` | itsdangerous 2.2.0 | CONSISTENT (range satisfied) |

- `starlette 0.44.0` is not a fixed-release direct declaration; the `pip
  check` conflict is observed runtime metadata only. No speculation about
  unobserved transitive dependencies is made.
- `[INFERENCE]` The production `pyproject.toml` is byte-identical to the
  fixed-release declaration (SHA-256 match), yet installed exact-pinned
  direct dependencies differ and one declared direct dependency is absent;
  therefore the runtime venv was not installed/resolved from the current
  declaration. No package operation was run to test or change this.
- `[UNKNOWN]` Versions/presence of any distribution outside the audited
  12-name list (including `psycopg-binary`, `pydantic-core`, starlette's
  transitive set, `click`, `h11`, etc.) — deliberately not queried.

## 4. Does the fixed source supply a fully resolved immutable environment contract?

- `[VERIFIED]` **No.** The fixed release source does not contain a complete
  resolved transitive lock and does not contain a hash-verified wheel
  manifest.
- `[VERIFIED]` Precise missing artifact: a complete resolved transitive lock
  (for example a fully pinned transitive `requirements.txt` / `pip-compile`
  output, `uv.lock`, `poetry.lock`, or `Pipfile.lock`) **or** a wheel-hash
  manifest (for example `pip download --require-hashes` output or a lockfile
  carrying a SHA-256 hash for every resolved distribution), both covering the
  fixed-release source tree at commit `59101b80b6420155bf8aec26b14ea7800979db86`.
- `[VERIFIED]` The fixed `pyproject.toml` itself declares two version ranges
  (`itsdangerous>=2.1.2`; `jinja2>=3.1.2,<3.1.5`), pins no transitive
  dependencies, and contains no lock section or hashes.
- `[VERIFIED]` The only manifest-like files at the fixed commit are
  `package-lock.json` (an **npm** lockfile, `xlsx ^0.18.5` — not a Python
  runtime lock) and `src/anqiao_crm.egg-info/requires.txt` (a generated
  artifact mirroring only the direct declarations; no transitive resolution,
  no hashes).
- `[INFERENCE]` A declaration without a resolved lock/hash manifest cannot
  guarantee a byte-identical immutable environment when resolved at a later
  time; additionally, the **current** production environment is not a valid
  baseline either, because `pip check` fails and installed versions drift
  from the declaration (`[VERIFIED]` observations in §2–§3).
- Conclusion `[VERIFIED]`: neither the fixed source nor the current runtime
  supplies a fully resolved immutable environment contract today; the
  precise missing artifact is stated above.

## 5. Exactly one minimum safe remediation candidate — `[PROPOSAL]` (NOT EXECUTED)

After **separate explicit authorization** (not granted by `DEC-0134`):

1. In an isolated, disposable **local** environment (never the production
   host), generate a resolved lock **or** hash-verified wheel manifest from
   the fixed release source at commit
   `59101b80b6420155bf8aec26b14ea7800979db86`, honoring the declared direct
   constraints and `requires-python >=3.12,<3.15`.
2. Independently verify that manifest (a reviewer re-resolves/hash-checks
   deterministically and validates it against the declared constraints and
   the application's import surface) **before** any environment build.
3. Rebuild an **isolated, immutable** environment (e.g., a new virtual
   environment) from that manifest and validated artifacts — **not** in-place
   surgery on the existing `/opt/anqiao-crm/venv`.
4. Validate the rebuilt environment (installation from the manifest only,
   clean `pip check`, compile/import and application health checks, migration
   dry-run against test state) before any service switch.
5. Only then, under a **separate** authorized deployment task, switch the
   service to the validated environment and complete the remaining release
   gates.

This is the single remediation candidate. In-place package surgery on the
production venv is explicitly **not** proposed.

## 6. Unverified and unauthorized (recorded, not acted on)

- `[VERIFIED]` Dependency repair, service restart, migration, deployment,
  and production acceptance remain **unverified and unauthorized**.
- `[VERIFIED]` `DEC-0134` does not authorize any dependency repair; W5
  release execution, G7 (DNS/TLS), V1 (runtime verification), and R2
  (acceptance) remain PENDING and separately unauthorized.
- `[VERIFIED]` The runtime `pip check` failure remains an open blocking
  precondition for any future W5 attempt.

## 7. Local checks run (recorded below in execution record and §8)

- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
- `git diff --check`
- `git status --short`
- Scoped secret-pattern scan over only the TASK-0028 evidence/status paths
  (no environment files scanned).

## 8. No-log / no-secret / no-write attestation

- **NO LOG COMMAND RAN** in any TASK-0028 task — no `journalctl`, no
  `systemctl status`, no `tail`, no `/var/log` path, no log file/query, no
  substitute or aggregate log command.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential,
  private key, runtime-environment value, cookie, session, business row,
  database value, or HTTP body was accessed; production `pyproject.toml`
  content was never printed or copied (hash only).
- **NO PRODUCTION WRITE OCCURRED** — TASK-0028C ran no remote command at
  all; the package made no package/service/database/deployment/config
  change; repository writes were limited to the exclusive TASK-0028A/B/C
  paths.
