# HANDOFF-20260812: TASK-0028 production dependency-audit package to DeepSeek in PI

- Package: TASK-0028A, TASK-0028B, TASK-0028C
- From tool/model: Codex architecture and review owner
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE SEQUENTIAL READ-ONLY AUDIT PACKAGE
- Repository state: `main`, intentionally dirty; preserve all existing work
- Fixed release source: `59101b80b6420155bf8aec26b14ea7800979db86`
- Written at: 2026-08-12 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for the sequential TASK-0028 audit package in
`D:\Project\中科安樵\crm`. Other work already exists in this dirty worktree.
Do not revert, overwrite, normalize, delete, commit, push, reset, clean, or
claim any unrelated change. You must execute TASK-0028A, then TASK-0028B, then
TASK-0028C. Stop at the first blocked prerequisite; do not skip ahead or use a
substitute route. Your maximum result is `HANDOFF-ONLY`, `PARTIAL`, or
`BLOCKED`. Codex is the only reviewer and acceptance decision-maker.

Read in full before any action:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0133` and `DEC-0134`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0027-w5-production-release-correction.md`
- `docs/tasks/active/TASK-0028A-local-release-dependency-baseline.md`
- `docs/tasks/active/TASK-0028B-production-runtime-dependency-inventory.md`
- `docs/tasks/active/TASK-0028C-dependency-difference-and-remediation-proposal.md`
- `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`
- this handoff

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands, inspect reports, choose
an engineering route, or handle secrets.

## Package-wide prohibitions

- Never print, read, copy, write, rotate, or report credentials, secrets,
  private keys, runtime environment values, cookies, sessions, business rows,
  database values, HTTP bodies, or package-cache contents.
- Never run `journalctl`, `systemctl status`, `tail`, a `/var/log` path, a log
  file/query, or any command intended to read or derive log content or
  metadata. Do not substitute an aggregate command.
- Never run `pip install`, `pip uninstall`, `pip download`, upgrade, downgrade,
  cache operations, venv creation/deletion, lockfile generation/writing, or a
  package resolver. Do not use a Python tool that can mutate the environment.
- Never modify production files/configuration, restart/reload/start/stop a
  service, access a database, create a backup, alter nginx/DNS/TLS, deploy,
  transfer files, use port forwarding/tunnels/agent forwarding, weaken host-key
  checking, or use another host.
- Never commit/push/reset/clean/checkout. Never edit an approved SPEC, decision
  log, handoff, application source, migration, test, `pyproject.toml`, or any
  file outside the exclusive paths for the current task.

## TASK-0028A: Local fixed-release dependency baseline

Write only:

- `docs/tasks/active/TASK-0028A-local-release-dependency-baseline.md`
- `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`

1. Record `git status --short`, but preserve every existing change.
2. Verify the SHA-256 of the approved `SPEC-0012` against its approval JSON.
3. Confirm `59101b80b6420155bf8aec26b14ea7800979db86` exists locally.
4. Read `pyproject.toml` only through
   `git show 59101b80b6420155bf8aec26b14ea7800979db86:pyproject.toml` and
   calculate a SHA-256 for exactly that file. Record only the dependency
   declarations and build-system declaration.
5. Determine from that exact file whether a complete transitive lock or a
   wheel-hash manifest exists. Do not create one or infer absent resolution
   data from package knowledge. In the evidence, label the answer as
   `[VERIFIED]` or `[UNKNOWN]` based on files actually inspected.
6. Update the task card to the factual handoff state. Do not self-accept.

If this task fails, write its evidence and final package report as `BLOCKED`.
Do not start TASK-0028B.

## TASK-0028B: Production runtime dependency inventory

Write only:

- `docs/tasks/active/TASK-0028B-production-runtime-dependency-inventory.md`
- `docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`

Before connecting, use only `ssh-keygen -F 124.222.212.159` to confirm an
existing known-host entry. Do not add, replace, or remove a host key.

Connect only as `ubuntu@124.222.212.159` using `BatchMode=yes`,
`StrictHostKeyChecking=yes`, and `ConnectTimeout=15`. First run only:

```sh
id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ
```

Expected user is `ubuntu`; expected hostname is `VM-0-17-ubuntu`. A mismatch,
host-key issue, authentication prompt, sudo prompt, permission problem, or
unlisted command stops TASK-0028B as `BLOCKED`. Do not work around it.

After identity passes, the remote allowlist is exactly:

1. `systemctl show anqiao-crm --no-pager` restricted to the properties
   `LoadState,ActiveState,SubState,User,Group,WorkingDirectory,MainPID`.
2. `/opt/anqiao-crm/venv/bin/python --version`.
3. `/opt/anqiao-crm/venv/bin/python -m pip --version`.
4. `/opt/anqiao-crm/venv/bin/python -m pip check`.
5. `/opt/anqiao-crm/venv/bin/python -m pip show` for exactly these package
   names and no others: `fastapi`, `starlette`, `uvicorn`, `alembic`,
   `sqlalchemy`, `psycopg`, `pydantic`, `pydantic-settings`, `jinja2`,
   `itsdangerous`, `python-multipart`, `argon2-cffi`.
6. If a `pip show` output is incomplete, run one read-only
   `importlib.metadata` script against exactly the same package list, printing
   only distribution name, version, and declared `Requires-Dist` values.
   Do not import CRM code.
7. `sha256sum /opt/anqiao-crm/pyproject.toml` only. Do not print or copy the
   production file's content.

Record every actual command and exit code in evidence. Package metadata, names,
versions, requirements, and the `pyproject.toml` hash are allowed facts.
No runtime configuration, package location, environment, or log detail may be
stored. State explicitly whether any of the fixed-release direct declaration
versions are inconsistent with observed runtime metadata, but do not speculate
about unobserved transitive dependencies. Update the TASK-0028B task card only.

## TASK-0028C: Difference and proposal

Write only:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0028C-dependency-difference-and-remediation-proposal.md`
- `docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`
- `docs/evidence/TASK-0028-DEEPSEEK-PI-EXECUTION-20260812.md`

Do not run any new remote command in TASK-0028C. Compare only the evidence from
TASK-0028A and TASK-0028B with the fixed commit. Label each material statement
`[VERIFIED]`, `[INFERENCE]`, `[PROPOSAL]`, or `[UNKNOWN]`.

The evidence must:

1. Separate observed installed package metadata from the fixed-release direct
   declarations.
2. State whether the fixed source supplies a fully resolved immutable
   environment contract. A `pyproject.toml` with version ranges or without a
   complete resolved transitive lock/wheel-hash manifest is not enough; record
   the precise missing artifact.
3. Give exactly one `[PROPOSAL]` for minimum safe remediation: after separate
   authorization, generate and independently verify a resolved lock or
   hash-verified wheel manifest for the fixed release source, then rebuild an
   isolated immutable environment and validate it before any service switch.
   Do not propose in-place surgery on the production venv.
4. State that dependency repair, service restart, migration, deployment, and
   production acceptance remain unverified and unauthorized.

Run and record:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
git diff --check
git status --short
```

Also run a scoped secret-pattern scan over only the TASK-0028 evidence/status
paths. Do not scan or print environment files. Confirm in evidence that no log
command ran and no production write occurred.

## Required final response

After complete execution or the first failure, return only this exact form:

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
task_0028a: <completed | blocked | not-started; evidence path>
task_0028b: <completed | blocked | not-started; evidence path>
task_0028c: <completed | blocked | not-started; evidence path>
changed_paths: <one path per line>
checks: <one line per command: command; exit code; factual result>
evidence: <one path per evidence file>
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```
