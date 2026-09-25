# TASK-0029 DeepSeek-in-PI execution record (2026-08-13)

- Package: TASK-0029A/B/C (isolated reproducibility-artifact package,
  `DEC-0135`)
- Status: **EXECUTED — HANDOFF-ONLY — awaiting Codex independent review (NOT
  self-accepted)**
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Authority: `DEC-0135` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0` (SHA-256
  `621131c0…dac1192` matches approval JSON)
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved. HEAD = `59101b80b6420155bf8aec26b14ea7800979db86`.

## What was executed (sequential)

1. **TASK-0029A — Resolve and manifest** (`COMPLETED`):
   - Preconditions passed (dirty worktree preserved; SPEC-0012 hash match;
     fixed commit exists and is HEAD; `py -3.12` = Python 3.12.8).
   - External workspace
     `C:\Users\K\AppData\Local\Temp\task-0029-20260813-001225`; LF-faithful
     extraction of the fixed commit (355 files); extracted `pyproject.toml`
     SHA-256 `93b3f4bf…d09195` matches the fixed-input hash.
   - Isolated pip config (empty `PIP_CONFIG_FILE`, only
     `https://pypi.org/simple`, `PIP_NO_CACHE_DIR=true`, non-interactive).
   - Resolution: 39 packages (direct + transitive) via `pip install
     --dry-run --report` (exit 0); `pip download` (exit 0, 39 wheels);
     local wheel `anqiao_crm-0.1.0-py3-none-any.whl` built (exit 0).
   - Artifacts: `requirements.lock` (40 pinned, `--require-hashes`
     compatible), `wheel-manifest.txt` (40 rows). Completion-gate checks:
     offline lock dry-run exit 0; tampered-hash negative test exit 1.
2. **TASK-0029B — Reconstruct twice offline** (`COMPLETED`):
   - Two fresh Python 3.12.8 venvs installed offline (network disabled) from
     the part-A wheelhouse with `--require-hashes` (both exit 0, 40 packages).
   - Both: `pip check` exit 0; application compile (src/tests/migrations/
     scripts) exit 0; fixed-source pytest **341 passed, 28 skipped** (exit 0,
     identical). Whole-tree compileall's only error is the legacy doc file
     `docs/specs/99-legacy/…/01-meddic-scoring.py` (recorded, not a defect).
   - Non-bootstrap package sets identical (40 = 40) and exactly equal the
     part-A lock.
3. **TASK-0029C — Linux-target availability** (`COMPLETED`):
   - 39 Linux `manylinux_2_17_x86_64` CPython 3.12 wheels acquired
     cross-platform (exit 0; `--timeout 600 --retries 10` after a read-timeout
     retry); no Linux binary executed.
   - **Platform drift finding**: greenlet 3.2.5 (Linux) vs 3.5.5 (Windows);
     argon2-cffi-bindings 21.2.0 (Linux) vs 25.1.0 (Windows) — newer versions
     ship no manylinux_2_17 cp312 wheel. Both are successful resolutions.
   - Offline resolution checks: fixed declarations from the Linux set only
     (exit 0); hash-enforced `linux-requirements.lock` (exit 0). No missing
     wheel, no offline failure, no source-build substitution.

## Evidence produced

- `docs/evidence/TASK-0029-REPRODUCIBLE-DEPENDENCY-BUNDLE-20260812.md` (A)
- `docs/evidence/TASK-0029-REPRODUCIBILITY-VERIFICATION-20260812.md` (B)
- `docs/evidence/TASK-0029-LINUX-CP312-ARTIFACT-CHECK-20260812.md` (C)
- this execution record
- Task card: `docs/tasks/active/TASK-0029-reproducible-dependency-artifacts.md`
- Handoff: `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0029-REPRODUCIBILITY-PACKAGE.md`
- Status/index: `docs/NOW.md`, `docs/tasks/TASKS.md`

## Integrity correction (transparency)

The first draft of the A and C evidence manifest tables contained hand-typed
size/hash values for a subset of rows. That was detected during
self-verification; the tables were regenerated programmatically from the
workspace manifests (`wheel-manifest.txt`, `linux-wheel-manifest.txt`) and
verified byte-exact (A: 40 rows, C: 39 rows). The authoritative record is the
workspace manifest; the repository evidence embeds its exact content.

## No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, log file/query, or substitute.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential, private
  key, runtime-environment value, cookie, session, business row, database
  value, or HTTP body was accessed.
- **NO MUTATION** — no production/SSH action; no source, application,
  migration, test, or configuration write; no repository dependency change;
  no commit, push, reset, clean, or checkout. Network was limited to
  `https://pypi.org/simple` in parts A and C; part B was fully offline. All
  wheelhouses, venvs, extracted source, and scratch scripts remain in the
  external workspace.

## Final checks

- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`:
  result recorded in the TASK_REPORT below.
- `git diff --check`: result recorded in the TASK_REPORT below.
- `git status --short`: result recorded in the TASK_REPORT below.
- Scoped secret-pattern scan over the TASK-0029 evidence/status paths only:
  result recorded in the TASK_REPORT below.

## Not verified / boundaries

- This package is **reproducibility evidence only**. It is not a production
  build, production repair, production-compatible runtime, or release-ready
  proof; it does not self-accept.
- TASK-0028B's remote runtime assertions remain unaccepted and were not used
  as a prerequisite (DEC-0135 point 2).
- Dependency repair, environment rebuild on the target, service restart,
  migration, deployment, and production acceptance remain unverified and
  separately unauthorized.
- The cross-platform version drift (greenlet, argon2-cffi-bindings) must be
  accounted for in any future deployment decision.

## Awaiting

`CODEX_INDEPENDENT_REVIEW`
