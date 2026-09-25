# TASK-0028A: Local fixed-release dependency baseline — evidence (2026-08-12)

- Status: **EXECUTED — awaiting Codex independent review (NOT self-accepted)**
- Authority: `DEC-0134` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0` (hash matches approval metadata, see §1)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved. HEAD is exactly commit
  `59101b80b6420155bf8aec26b14ea7800979db86`.
- Scope: local, read-only inventory of the fixed-release dependency
  declarations and reproducibility evidence. **No network, SSH, package,
  source, lockfile, or environment change occurred; no file outside the
  TASK-0028A exclusive write paths was modified.**

## 1. Prerequisite checks (all local, read-only)

| Check | Command | Exit | Result |
|---|---|---|---|
| Git state | `git status --short` | 0 | Pre-existing dirty worktree preserved (modified README/docs/task files, `src/crm/persistence/models.py`, `tests/`, plus untracked TASK-0018/0022/0023/0024/0025/0026/0027 material, `migrations/versions/0006_operation_records.py`, and the TASK-0028 cards/handoff). No existing change was altered, staged, reverted, or cleaned. HEAD = `59101b80b6420155bf8aec26b14ea7800979db86` |
| Approved SPEC hash | `powershell -NoProfile -Command "Get-FileHash docs/specs/30-approved/SPEC-0012-deployment-operations.md -Algorithm SHA256 \| Select-Object -ExpandProperty Hash"` | 0 | `621131C01F85AB9186E0F14D913E20C82EA2016267EC9B4CF0DD867A0DAC1192` — case-insensitive match with approval JSON `spec_sha256` `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`; no file changed |
| Fixed commit exists | `git cat-file -t 59101b80b6420155bf8aec26b14ea7800979db86`; `git rev-parse 59101b80b6420155bf8aec26b14ea7800979db86` | 0 | Type `commit`; full SHA resolves to `59101b80b6420155bf8aec26b14ea7800979db86` |

## 2. Fixed-release `pyproject.toml` baseline

- Source (exact): `git show 59101b80b6420155bf8aec26b14ea7800979db86:pyproject.toml`
- File SHA-256 (of exactly that committed blob):
  `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`
  (command: `git show <commit>:pyproject.toml | sha256sum`; exit 0; 37 lines)
- Build-system declaration `[VERIFIED]`:
  - `requires = ["setuptools==82.0.1"]`
  - `build-backend = "setuptools.build_meta"`
- `requires-python` `[VERIFIED]`: `>=3.12,<3.15`
- Direct dependency declarations `[VERIFIED]` (from `[project].dependencies`):
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
- Optional `test` declarations `[VERIFIED]`: `httpx==0.28.1`, `pytest==9.0.2`
- No secrets, tokens, passwords, or private keys appear in the committed
  file; none were printed, copied, or stored.

## 3. Complete transitive lock / wheel-hash manifest determination

- `[VERIFIED]` The fixed `pyproject.toml` contains no lock section, no
  resolved transitive pin set, and no wheel-hash manifest. Two direct
  declarations are version ranges (`itsdangerous>=2.1.2`;
  `jinja2>=3.1.2,<3.1.5`), and every pinned direct dependency has transitive
  dependencies that are not declared anywhere in the file.
- `[VERIFIED]` Full committed tree inspection
  (`git ls-tree -r --name-only 59101b80…db86 | sort`, exit 0) plus a scoped
  name scan (`grep -iE "lock|require|pipfile|poetry|pdm|uv\.|constraint|hashes|hash"`,
  exit 0) found only two manifest-like files at the fixed commit:
  - `package-lock.json` — an **npm** lockfile for `package.json`
    (`dependencies: xlsx ^0.18.5`); it does not describe the Python
    application runtime and is not a Python transitive lock.
  - `src/anqiao_crm.egg-info/requires.txt` — a generated setuptools artifact
    that mirrors only the direct declarations above (plus the `[test]`
    section); it contains no transitive resolution and no hashes.
- `[VERIFIED]` Therefore the fixed release source does **not** supply a
  complete resolved transitive lock or a wheel-hash manifest for the Python
  application. Absence was established from files actually inspected, not
  inferred from package knowledge. No such artifact was created.
- `[INFERENCE]` A `pyproject.toml` with version ranges (and no complete
  resolved lock) cannot, by itself, guarantee that a fresh environment
  resolved today reproduces byte-identical immutable dependencies. This
  inference is used only as the reproducibility assessment; no resolution was
  run to test it (running a resolver is prohibited).

## 4. Writes performed (exclusive TASK-0028A paths only)

- `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`
  (this file) — created.
- `docs/tasks/active/TASK-0028A-local-release-dependency-baseline.md` —
  status updated to the factual executed state; **not self-accepted**.
- No other repository path was written.

## 5. No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, no `systemctl status`, no
  `tail`, no `/var/log` path, no log file/query, no substitute.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential,
  private key, runtime-environment value, cookie, session, business row,
  database value, or HTTP body was accessed.
- **NO MUTATION** — no network/SSH action, no package command, no lockfile
  generation/write, no source/environment/test modification, no commit,
  push, reset, clean, or checkout.

## 6. Not verified by this task

- The production runtime's installed packages or service behavior
  (TASK-0028B).
- Whether a future environment resolved from the fixed declaration would
  reproduce the existing production environment.
- Any remediation, deployment, restart, migration, or database behavior.
- TASK-0028A does not self-accept; Codex independent review is pending.
