# HANDOFF-20260812: TASK-0029 reproducibility-artifact package to DeepSeek in PI

- Package: TASK-0029A, TASK-0029B, TASK-0029C
- From tool/model: orchestrator (Codex architecture/review role) in PI —
  model `opencode-go/deepseek-v4-pro` (gateway selector only; upstream
  identity is not asserted)
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL LOCAL-ONLY PACKAGE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Fixed release source: commit `59101b80b6420155bf8aec26b14ea7800979db86`,
  fixed `pyproject.toml` SHA-256
  `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`
- Written at: 2026-08-12 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the sequential TASK-0029 reproducibility
package in `D:\Project\中科安樵\crm`. Other work already exists in this dirty
worktree. Do not revert, overwrite, normalize, delete, commit, push, reset,
clean, or claim any unrelated change. You must execute TASK-0029A, then
TASK-0029B, then TASK-0029C. Stop at the first blocked prerequisite; do not
skip ahead or use a substitute route. Your maximum result is `HANDOFF-ONLY`,
`PARTIAL`, or `BLOCKED`. Codex is the only reviewer and acceptance
decision-maker; you never self-accept.

Read in full before any action:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0134` and `DEC-0135`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md`
- `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`
- this handoff

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands, inspect reports, choose
an engineering route, or handle secrets.

## Verification-first discipline (TDD note)

This package edits no application code, so test-first development (TDD) does
not apply. The equivalent mandatory discipline is **verification-first**: for
every sub-task, write down the exact check command and its expected outcome
before running it, then run it, record the exit code and the factual result,
and only then mark the sub-task complete. The fixed-source automated test
suite in TASK-0029B is the executable acceptance criterion; it is run against
a reconstructed environment, and any failure is `BLOCKED`, never patched or
re-run to a pass. You never self-accept.

## Package-wide prohibitions

- Never print, read, copy, write, rotate, or report credentials, secrets,
  private keys, runtime environment values, cookies, sessions, business rows,
  database values, HTTP bodies, or package-cache contents.
- Never run `journalctl`, `systemctl status`, `tail`, a `/var/log` path, a log
  file/query, or any command intended to read or derive log content or
  metadata. Do not substitute an aggregate command.
- Network is allowed only for non-interactive read/download from
  `https://pypi.org/simple` into the task-owned external workspace, in
  TASK-0029A and TASK-0029C only. No other host, endpoint, SSH, public URL, or
  DNS/TLS action is allowed. TASK-0029B must have network disabled.
- Use only a newly created external task-owned workspace. Never reuse, read,
  or mutate the global/local pip cache, the repository `.venv`, any existing
  venv, or any pre-existing package cache. Set a fresh no-cache pip
  configuration for the package.
- Use only `https://pypi.org/simple`. No extra, private, configured,
  credentialed, or corporate package index is allowed.
- A Python 3.12 interpreter is required. Use `py -3.12` (observed present on
  this machine; the repository `.venv` is CPython 3.12.8). If a Python 3.12
  interpreter is absent, stop `BLOCKED`; do not install an interpreter and do
  not use 3.10 or 3.14.
- No SSH, production host, public endpoint, service, database, migration,
  deployment, backup, nginx/DNS/TLS, log, runtime configuration, credential,
  business-data, commit, push, reset, clean, or checkout action.
- Do not modify global Python, the repository `.venv`, any existing venv, or
  any package cache. Package installation happens only in fresh external
  TASK-0029 virtual environments.
- Do not self-accept. Do not call any result a production build, production
  repair, production-compatible runtime, or release-ready proof.

## TASK-0029A: Resolve and manifest

Write only:

- `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md` (status)
- `docs/evidence/TASK-0029-REPRODUCIBLE-DEPENDENCY-BUNDLE-20260812.md`

1. Preconditions (record each command and exit code): `git status --short`
   (preserve every existing change); verify the SHA-256 of the approved
   `SPEC-0012` against its approval JSON; confirm the fixed commit
   `59101b80b6420155bf8aec26b14ea7800979db86` exists locally and is HEAD;
   confirm a Python 3.12 interpreter via `py -3.12 --version`.
2. Create a fresh external task-owned workspace outside the repository (for
   example under `$env:TEMP` with a name beginning `task-0029-`), record its
   absolute path, and do not place it inside `D:\Project\中科安樵\crm`.
3. Configure a fresh non-interactive no-cache pip configuration pointing only
   at `https://pypi.org/simple`; record the exact environment variables set.
4. Extract the fixed commit source into the workspace (for example
   `git archive 59101b80b6420155bf8aec26b14ea7800979db86 | tar -x -C
   <workspace>/src`), record the extraction, and compute a SHA-256 for the
   extracted `pyproject.toml`; it must equal
   `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`.
5. Create a fresh external Python 3.12 venv, then resolve the fixed source's
   runtime plus `test` extras through the public index, build a local project
   wheel, and produce a **fully version-pinned, hash-verified lock** and a
   **wheel manifest** of every resolved package. Do not place any package
   binary inside the repository.
6. The lock must be `--require-hashes` compatible. The wheel manifest must
   record, for every package: exact command, exit code, canonical package
   name/version, wheel filename, SHA-256, source URL domain, and the
   fixed-input hash. No secret, token, cache content, or environment value may
   be recorded.
7. Update only the task card status. Do not self-accept.

If any precondition fails, write the evidence and final package report as
`BLOCKED`. Do not start TASK-0029B.

## TASK-0029B: Reconstruct twice offline

Write only:

- `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md` (status)
- `docs/evidence/TASK-0029-REPRODUCIBILITY-VERIFICATION-20260812.md`

1. Create two new fresh external Python 3.12 virtual environments (for example
   `<workspace>/venv-b1` and `<workspace>/venv-b2`).
2. Install into each, **with network disabled and hash enforcement enabled**,
   using only the TASK-0029A wheelhouse (for example `pip install --no-index
   --find-links <wheelhouse> --require-hashes -r <lock>`). Record the exact
   command and exit code for both.
3. In each reconstruction run and record: `pip check` (must exit 0), a
   compile check (for example `python -m compileall` over the fixed source),
   and the fixed-source automated test suite (`pytest`) against the extracted
   fixed-commit tree. A failure in either reconstruction is `BLOCKED`; do not
   patch the source or re-run to a pass.
4. Compare the resolved non-bootstrap package sets of the two reconstructions.
   They must be identical; any discrepancy is `BLOCKED`.
5. Update only the task card status. Do not self-accept.

If TASK-0029A was blocked, do not run TASK-0029B.

## TASK-0029C: Linux-target availability

Write only:

- `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md` (status)
- `docs/evidence/TASK-0029-LINUX-CP312-ARTIFACT-CHECK-20260812.md`

1. Independently acquire and hash-manifest the Linux
   `manylinux_2_17_x86_64` CPython 3.12 binary artifacts for the same fixed
   declarations (the resolved package set from TASK-0029A). Acquisition is a
   read/download from `https://pypi.org/simple` into the workspace only; use a
   cross-platform download mechanism (for example `pip download --platform
   manylinux_2_17_x86_64 --implementation cp --python-version 312
   --only-binary=:all:` with `--abi cp312`) so that no Linux binary is
   executed.
2. Run an offline resolver/install check against that Linux artifact set only
   (for example `pip install --dry-run --no-index --find-links
   <linux-wheelhouse> -r <lock>`), and record its exit code and result.
3. The evidence must clearly distinguish **wheel availability / offline
   resolution** from a **Linux runtime test**. This is not a Linux execution,
   service, or production verification. A missing compatible wheel, an
   unresolvable dependency, or an offline resolver failure is `BLOCKED` — it
   must never be substituted with a source build or a different platform.
4. Update only the task card status. Do not self-accept.

## Final evidence and governance

Write only:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md` (final
  status)
- `docs/evidence/TASK-0029-DEEPSEEK-PI-EXECUTION-20260812.md`

Run and record:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
git diff --check
git status --short
```

Also run a scoped secret-pattern scan over only the TASK-0029 evidence/status
paths. Do not scan or print environment files. Confirm in the execution record
that no log command ran, no production write occurred, no secret was accessed,
and no commit/push/reset/clean/checkout happened. The package ends
`HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` and awaits independent Codex review.

## Required final response

After complete execution or the first failure, return only this exact form:

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
task_0029a: <completed | blocked | not-started; evidence path>
task_0029b: <completed | blocked | not-started; evidence path>
task_0029c: <completed | blocked | not-started; evidence path>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
