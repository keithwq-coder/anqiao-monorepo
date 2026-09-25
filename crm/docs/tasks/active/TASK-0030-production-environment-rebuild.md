# TASK-0030: Production environment rebuild + service switch

- Task ID: TASK-0030
- Status: ACTIVE / **EXECUTED 2026-08-13 — BLOCKED (switch failed, rolled
  back, service restored) — AWAITS CODEX INDEPENDENT REVIEW (NOT
  SELF-ACCEPTED)**
- Task type: DEPLOYMENT
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0137`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-13 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: `DEC-0137`; approved SPEC-0012 hash match; TASK-0029 frozen
  `requirements.lock` (40 exact versions, hash-verified, 341 tests passed);
  Codex-verified Linux wheel availability for the exact versions on Ubuntu
  24.04 (`greenlet 3.5.5` and `argon2-cffi-bindings 25.1.0` have
  `manylinux_2_28_x86_64` wheels); a local Python 3.12 interpreter for the
  local wheelhouse phase; the production target `ubuntu@124.222.212.159`
  (hostname `VM-0-17-ubuntu`).

## Goal

Replace the broken production Python environment
(`/opt/anqiao-crm/venv`, where `pip check` fails because `fastapi 0.141.0`
requires `starlette>=0.46.0` while `starlette 0.44.0` is installed) with a
fresh environment built strictly from the frozen, hash-verified TASK-0029
lock, validate it, and switch the `anqiao-crm` service to it — with the broken
venv preserved as an instant rollback target. Reduce uncontrollable factors:
no live dependency resolution on the server, no version drift, offline
hash-enforced install, rollback available at every step.

## Sequential phases

1. **Local wheelhouse (no production)**: derive `name==version` pins from the
   frozen `requirements.lock`; download the Linux wheels for those EXACT
   versions targeting `manylinux_2_28_x86_64` + `manylinux_2_17_x86_64`
   CPython 3.12 (Ubuntu 24.04); hash-verify; build `linux-requirements.lock`
   (exact versions + Linux wheel hashes); offline `--require-hashes`
   resolution check. If any exact pinned version lacks a compatible Linux
   cp312 wheel, stop `BLOCKED` (no version substitution).
2. **Server read-only preflight**: strict SSH identity/hostname; glibc version;
   disk space; current `/opt/anqiao-crm/venv` `pip check` (confirm broken);
   confirm the start script references `/opt/anqiao-crm/venv`.
3. **Transfer**: copy the wheelhouse + lock to the server (task-owned temp
   path).
4. **Fresh venv**: create `/opt/anqiao-crm/venv-new` with the server's
   Python 3.12; install offline from the wheelhouse with `--require-hashes`.
5. **Validate**: `venv-new/bin/pip check` (must pass); application import/health
   smoke check.
6. **Switch**: `systemctl stop anqiao-crm`; move `venv` →
   `venv-broken-<ts>`; move `venv-new` → `venv`; `systemctl start anqiao-crm`.
7. **Health + rollback**: verify the service is healthy; on any failure, stop,
   swap the broken venv back, restart, and report `BLOCKED`.

## Exclusive repository write paths

- `docs/tasks/active/TASK-0030-production-environment-rebuild.md`
- `docs/evidence/TASK-0030-PRODUCTION-ENVIRONMENT-REBUILD-20260813.md`
- `docs/evidence/TASK-0030-DEEPSEEK-PI-EXECUTION-20260813.md`
- `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0030-PRODUCTION-ENV-REBUILD.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`

All application, migration, test, dependency-declaration, SPEC, decision-log,
and other repository paths are read-only to the executor. Wheelhouses, venvs,
and scratch artifacts stay in the external workspace (local) and under
`/opt/anqiao-crm` (server).

## Hard boundaries

- No database access or migration; the database stays at its current revision.
- No nginx/DNS/TLS change or reload; no credential or secret reading; no log
  reading or query (`journalctl`, `systemctl status`, `tail`, `/var/log`).
- No new application code deployment, no source/configuration change beyond
  the venv directory rename/swap, no commit, push, reset, clean, or checkout.
- The existing broken venv is never modified in place; it is renamed and
  preserved as the rollback target until the switch is verified healthy.
- Do not self-accept. Do not claim W5 release, migration, or production
  acceptance.

## Prerequisites and completion gate

- Local wheelhouse: every one of the 40 exact versions resolves to a Linux
  cp312 wheel and is hash-verified; `linux-requirements.lock` is
  `--require-hashes` compatible; offline dry-run exits 0.
- Server preflight: identity/hostname match; glibc ≥ 2.28; the current venv's
  `pip check` failure is reproduced before any mutation.
- Fresh venv: `pip check` exits 0; application import/health smoke passes.
- Switch: service restarts and health check passes; the broken venv backup and
  the new venv swap are both recorded with exact commands and exit codes.
- Rollback: any failure restores the broken venv and restarts the service;
  the task then ends `BLOCKED`.
- Run `git diff --check`, `git status --short`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
  The task ends `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent
  Codex review.
