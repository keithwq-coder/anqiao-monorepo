# TASK-0029: Isolated reproducible dependency artifacts

- Task ID: TASK-0029
- Status: ACTIVE / **EXECUTED 2026-08-13 (PARTS A+B+C COMPLETED) — AWAITS CODEX INDEPENDENT REVIEW — NOT SELF-ACCEPTED**
- Task type: VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0135`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-12 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Fixed release input: commit `59101b80b6420155bf8aec26b14ea7800979db86`,
  fixed `pyproject.toml` SHA-256
  `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`
- Depends on: `DEC-0135`; approved SPEC-0012 hash match; fixed release commit
  `59101b80b6420155bf8aec26b14ea7800979db86`; a local Python 3.12 interpreter
  (observed `py -3.12` present on 2026-08-12; repository `.venv` is CPython
  3.12.8); TASK-0028A's `[VERIFIED]` local baseline (fixed source has no
  complete transitive lock and no wheel-hash manifest) as the reason this
  package exists. This package must not use any unaccepted remote assertion
  (TASK-0028B) as a prerequisite (DEC-0135 point 2).

## Goal

Create reproducibility evidence from the fixed release input without touching
production: a complete, hash-verified dependency artifact manifest; two fresh
offline local reconstructions using only that artifact set; and a separately
labeled Linux CPython 3.12 wheel-availability/offline-resolution result.

## Sequential parts

1. **TASK-0029A - Resolve and manifest.** In a new task-owned workspace
   outside the repository, extract the fixed commit, resolve only its runtime
   plus `test` extras through public PyPI, build a local project wheel, and
   produce fully pinned, hash-verified lock and wheel-manifest artifacts. No
   package binary belongs in the repository.
2. **TASK-0029B - Reconstruct twice offline.** Create two new task-owned
   local Python 3.12 virtual environments. Each must install only from the
   TASK-0029A wheelhouse with network disabled and hash enforcement enabled,
   then pass `pip check`, compilation, and the fixed-source automated tests.
   Compare the resolved non-bootstrap package sets.
3. **TASK-0029C - Linux-target availability.** Independently acquire and
   hash-manifest Linux `manylinux_2_17_x86_64` CPython 3.12 binary artifacts
   for the same fixed declarations, then run an offline resolver check against
   that artifact set. This is not a Linux execution, service, or production
   verification.

## Exclusive repository write paths

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md`
- `docs/evidence/TASK-0029-REPRODUCIBLE-DEPENDENCY-BUNDLE-20260812.md`
- `docs/evidence/TASK-0029-REPRODUCIBILITY-VERIFICATION-20260812.md`
- `docs/evidence/TASK-0029-LINUX-CP312-ARTIFACT-CHECK-20260812.md`
- `docs/evidence/TASK-0029-DEEPSEEK-PI-EXECUTION-20260812.md`
- `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0029-REPRODUCIBILITY-PACKAGE.md`

All application, migration, test, dependency declaration, SPEC, decision-log,
and other repository paths are read-only to the executor. Wheelhouses,
venvs, extracted source, reports, and scratch scripts must remain in the
external task-owned workspace, not the repository.

## Hard boundaries

- Use only a newly created external task-owned workspace. Never reuse or read
  a global/local package cache. Set non-interactive no-cache pip configuration
  and use only `https://pypi.org/simple`; no extra, private, configured, or
  credentialed package source is allowed.
- A Python 3.12 interpreter is required. If absent, stop `BLOCKED`; do not
  install an interpreter or use another version.
- Network is allowed only for public PyPI dependency resolution/download in
  TASK-0029A and TASK-0029C. TASK-0029B must have network disabled and use
  only the prior wheelhouse.
- Package installation is allowed only in fresh external TASK-0029 virtual
  environments. Do not modify global Python, the repository `.venv`, any
  existing venv, or package cache.
- No SSH, production host, public endpoint, service, database, migration,
  deployment, backup, nginx/DNS/TLS, log, runtime configuration, credential,
  business-data, commit, push, reset, clean, or checkout action.
- Do not self-accept. Do not call the result a production build, production
  repair, production-compatible runtime, or release-ready proof.

## Prerequisites and completion gate

- Every artifact manifest includes exact command, exit code, canonical package
  name/version, wheel filename, SHA-256, source URL domain, and fixed-input
  hash. No secret, token, cache content, or environment value may be recorded.
- The native lock is fully version-pinned and `--require-hashes` compatible.
  Every package used by either offline reconstruction must be represented.
- Both fresh offline reconstructions pass the named local checks and have the
  same non-bootstrap resolved package set. Any discrepancy is `BLOCKED`.
- The Linux target result distinguishes wheel availability/offline resolution
  from a Linux runtime test. Missing compatible wheels or an offline resolver
  failure is `BLOCKED`, not substituted with a source build.
- Run `git diff --check`, `git status --short`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
  The task ends `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent
  Codex review.

## Execution record

### TASK-0029A (2026-08-13, DeepSeek in PI)

- Preconditions passed: dirty worktree preserved; SPEC-0012 SHA-256
  `621131c0…dac1192` matches approval JSON; fixed commit
  `59101b80b6420155bf8aec26b14ea7800979db86` exists and is HEAD; `py -3.12`
  → Python 3.12.8.
- External workspace `C:\Users\K\AppData\Local\Temp\task-0029-20260813-001225`;
  LF-faithful extraction of the fixed commit (355 files) via
  `git -c core.autocrlf=false -c core.eol=lf archive`; extracted
  `pyproject.toml` SHA-256 `93b3f4bf…d09195` matches the fixed-input hash.
- Isolated pip config (`PIP_CONFIG_FILE` empty conf, `PIP_INDEX_URL`=
  `https://pypi.org/simple`, `PIP_NO_CACHE_DIR=true`, non-interactive); fresh
  Python 3.12.8 venv (pip 24.3.1).
- `pip install --dry-run --report` exit 0 → 39 packages resolved (notable:
  today's resolution selects `starlette==1.6.0`, the exact lock-missing drift
  the package is designed to expose). `pip download` exit 0 → 39 wheels;
  `pip wheel <src> --no-deps` exit 0 → `anqiao_crm-0.1.0-py3-none-any.whl`.
- Generated `requirements.lock` (40 pinned lines, all `--hash=sha256:…`,
  `--require-hashes` compatible) + `wheel-manifest.txt` (40 rows).
  Completion-gate self-checks: offline `--require-hashes` dry-run exit 0;
  tampered-hash negative test exit 1 (hash enforcement confirmed).
- Evidence: `docs/evidence/TASK-0029-REPRODUCIBLE-DEPENDENCY-BUNDLE-20260812.md`.
- No log command, no secret access, no production write, no commit/push;
  artifacts stay in the external workspace. **Not self-accepted.**

### TASK-0029B (2026-08-13, DeepSeek in PI)

- Two fresh Python 3.12.8 venvs (`venv-b1`, `venv-b2`) created; each installed
  offline (`--no-index`, `PIP_NO_INDEX=true`) from the part-A wheelhouse with
  `--require-hashes`; both exit 0, 40 packages each.
- Per reconstruction: `pip check` exit 0; application compile
  (`compileall src tests migrations scripts`) exit 0; fixed-source pytest
  exit 0 — **341 passed, 28 skipped** in both (identical; skips are the
  PostgreSQL-gated tests).
- Whole-tree `compileall` exits 1 with exactly one error: the legacy doc
  artifact under the repository's `99-legacy` snapshot (a non-Python doc
  file with a `.py` extension; not application code) — recorded, not a defect.
- Non-bootstrap package sets: b1 == b2 (40 = 40, identical), and exactly
  equal the part-A lock (no missing, no extra).
- Evidence: `docs/evidence/TASK-0029-REPRODUCIBILITY-VERIFICATION-20260812.md`.
- No log command, no secret access, no network, no production write, no
  commit/push. **Not self-accepted.**

### TASK-0029C (2026-08-13, DeepSeek in PI)

- Acquired 39 Linux `manylinux_2_17_x86_64` CPython 3.12 binary artifacts
  from `pypi.org/simple` via cross-platform `pip download --platform
  manylinux_2_17_x86_64 --implementation cp --python-version 312 --abi cp312
  --only-binary=:all:` (exit 0; first attempt hit pip's 15s read timeout on
  the slow link, retried with `--timeout 600 --retries 10`). No Linux binary
  was executed.
- **Platform drift finding**: greenlet resolves to 3.2.5 (Linux) vs 3.5.5
  (Windows), argon2-cffi-bindings to 21.2.0 (Linux) vs 25.1.0 (Windows),
  because the newer versions ship no `manylinux_2_17` cp312 wheel. Both are
  successful resolutions — the concrete cross-platform drift the package
  exists to expose.
- Offline resolution checks (network disabled, target-platform flags):
  fixed declarations from the Linux set only → exit 0; hash-enforced
  `linux-requirements.lock` → exit 0. No missing wheel, no offline resolver
  failure, no source-build substitution.
- Evidence: `docs/evidence/TASK-0029-LINUX-CP312-ARTIFACT-CHECK-20260812.md`.
- No log command, no secret access, no Linux execution, no production write,
  no commit/push. **Not self-accepted.**
