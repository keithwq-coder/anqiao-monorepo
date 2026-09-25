# TASK-0028A: Local fixed-release dependency baseline

- Task ID: TASK-0028A
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
- Depends on: `DEC-0134`; approved SPEC-0012 hash match; fixed release commit
  `59101b80b6420155bf8aec26b14ea7800979db86`

## Goal

Create a local, reproducible inventory of the direct dependency declarations in
the only approved release source, and establish whether that declaration alone
can recreate an immutable runtime environment. This task makes no package or
source change.

## Exclusive local write paths

- `docs/tasks/active/TASK-0028A-local-release-dependency-baseline.md`
- `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`

All other repository paths are read-only to the executor.

## Hard boundaries

- No network or SSH action.
- No application/dependency/lockfile/test/environment modification, package
  command, commit, push, reset, clean, or checkout.
- Do not treat current dirty-worktree dependency files as release authority.
- Do not claim a package version is installed unless observed in a later task.

## Prerequisites and completion gate

- Verify SPEC-0012 approval hash, fixed release commit existence, and dirty Git
  state before analysis.
- Read `pyproject.toml` only from the fixed commit. Record a SHA-256 of that
  exact file and its direct dependency declarations without printing secrets.
- State whether the declaration includes a complete resolved transitive lock or
  wheel hash manifest. Absence must be recorded as `NOT VERIFIED`, not filled
  in from package knowledge.
- Write the named evidence record with exact local commands and exit codes.

## Execution record (2026-08-12, DeepSeek in PI)

- Executed the local read-only baseline: `git status --short` preserved the
  pre-existing dirty worktree; SPEC-0012 SHA-256
  `621131c0…dac1192` matches the approval JSON; fixed commit
  `59101b80b6420155bf8aec26b14ea7800979db86` exists locally and is HEAD.
- Fixed-release `pyproject.toml` read only via `git show <commit>:pyproject.toml`;
  SHA-256 `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`;
  direct declarations and build-system declaration recorded in
  `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`.
- `[VERIFIED]` No complete transitive lock or wheel-hash manifest exists in the
  fixed release source (tree + scoped scan; `package-lock.json` is npm,
  `src/anqiao_crm.egg-info/requires.txt` mirrors direct declarations only).
- No network/SSH/package/lockfile/source/environment change; no log command;
  no secret access; no commit/push/reset/clean/checkout. Writes limited to the
  exclusive paths. **Not self-accepted; Codex independent review pending.**

## Not verified by this task

- The production runtime's installed packages or service behavior.
- Whether an environment resolved from the fixed declaration would reproduce
  the existing production environment.
- Any remediation, deployment, restart, or database behavior.
