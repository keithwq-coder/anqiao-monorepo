# TASK-0028C: Dependency difference and remediation proposal

- Task ID: TASK-0028C
- Status: ACTIVE / **EXECUTED 2026-08-12 — AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)**
- Task type: REVIEW / VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0134`
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only; upstream identity is not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-12 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: TASK-0028A and TASK-0028B evidence; `DEC-0134`

## Goal

Compare the observed production package facts with the fixed-release dependency
declarations and produce a minimum safe remediation candidate as a proposal
only. No remediation is executed.

## Exclusive local write paths

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0028C-dependency-difference-and-remediation-proposal.md`
- `docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`
- `docs/evidence/TASK-0028-DEEPSEEK-PI-EXECUTION-20260812.md`

All other repository paths are read-only to the executor.

## Hard boundaries

- No new remote, SSH, public endpoint, package, service, database, or deployment
  command. This task analyzes TASK-0028A/B evidence only.
- No application/dependency/lockfile/environment change, package resolution,
  commit, push, reset, clean, or checkout.
- Do not call a package repair safe merely because `pyproject.toml` declares a
  direct version. A direct declaration is not a resolved immutable environment.

## Prerequisites and completion gate

- Compare only evidence produced by TASK-0028A/B and the fixed commit, marking
  each statement `[VERIFIED]`, `[INFERENCE]`, `[PROPOSAL]`, or `[UNKNOWN]`.
- Identify the observed mismatch, if any, without extrapolating missing package
  metadata.
- State whether the fixed `pyproject.toml` supplies a complete lock or
  hash-verified wheel manifest. If not, require one before any proposed repair.
- Present exactly one minimum safe remediation candidate as `[PROPOSAL]`: an
  isolated, immutable environment rebuild from the fixed source after a future
  authorized resolved lock/wheel manifest is generated and independently
  verified. It must not propose in-place production package surgery.
- Run governance and diff checks, write evidence, and leave Codex review
  pending.

## Execution record (2026-08-12, DeepSeek in PI)

- Compared TASK-0028A/B evidence with the fixed commit; each material
  statement labeled `[VERIFIED]`/`[INFERENCE]`/`[PROPOSAL]`/`[UNKNOWN]` in
  `docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`.
- `[VERIFIED]` Fixed source supplies **no** complete resolved transitive
  lock and **no** wheel-hash manifest; precise missing artifact recorded
  (fully pinned transitive lock or hash-verified wheel manifest covering the
  fixed tree). Production `pyproject.toml` hash equals the fixed-release
  hash, yet 5 exact-pinned direct declarations are inconsistent with observed
  runtime metadata and `pip check` fails (fastapi 0.141.0 vs starlette
  0.44.0) — venv was not installed from the current declaration
  (`[INFERENCE]`).
- Exactly one minimum safe `[PROPOSAL]` recorded: after separate
  authorization, generate and independently verify a resolved lock/
  hash-verified wheel manifest from the fixed source in an isolated local
  environment, rebuild an isolated immutable environment, validate it, then
  switch service only under a separate authorized deployment task. No
  in-place production venv surgery proposed.
- Dependency repair, service restart, migration, deployment, production
  acceptance: unverified and unauthorized; W5/G7/V1/R2 remain PENDING.
- Ran and recorded: `scripts/check-governance.ps1`, `git diff --check`,
  `git status --short`, and a scoped secret-pattern scan over only the
  TASK-0028 paths. No new remote command; no log command; no production
  write. **Not self-accepted; Codex independent review pending.**

## Not verified by this task

- That the candidate repair will succeed, preserve all application behavior, or
  be authorized for production.
- Any actual package installation, service restart, migration, deployment,
  database behavior, or human acceptance.
