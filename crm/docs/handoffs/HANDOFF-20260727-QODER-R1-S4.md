# HANDOFF-20260727-QODER-R1-S4

- Task: `TASK-0001` independent R1 review, then S4 only if R1 passes
- From tool/model: Codex / GPT-5.6-sol
- To tool/model: Qoder / Qwen 3.8 or ZCode / GLM 5.1 (receiver must identify itself)
- Handoff status: HANDOFF-ONLY
- Repository state: `main`, no commits, entire repository currently untracked;
  preserve the dirty worktree and do not commit, push, clean or reset
- Written at: 2026-07-27 20:55 Asia/Shanghai

## Required reading

The receiver must load `AGENTS.md` as the project rule manually because
automatic loading of `QODER.md` and `ZCODE.md` is not verified. It must then
read the following files from the repository, not rely on this handoff as
authority:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/SPEC-BASELINE.md`
- `docs/decisions/DECISION-LOG.md`
- `docs/decisions/ADR-0002-cloud-deployed-modular-monolith.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- all seven SPEC files and all seven `.approval.json` files under
  `docs/specs/30-approved/`
- `scripts/check-governance.ps1`
- `docs/evidence/TASK-0001-S1-environment.md`
- `docs/evidence/TASK-0001-W1-isolated-base-resources.md`
- `docs/evidence/TASK-0001-W2-postgresql-install.md`
- `docs/evidence/TASK-0001-W3-database-role.md`
- `docs/evidence/TASK-0001-S2-foundation.md`
- `docs/evidence/TASK-0001-S3-policy-projection.md`
- `src/crm/config.py`, `src/crm/domain/models.py`
- `src/crm/persistence/base.py`, `src/crm/persistence/database.py`,
  `src/crm/persistence/models.py`
- `src/crm/policy/projection.py`
- `migrations/env.py`, `migrations/versions/0001_initial_schema.py`
- all files under `tests/`

The receiver must report which of these files it actually read before changing
anything.

## Verified current state

- [VERIFIED] `docs/specs/SPEC-BASELINE.md` is `Status: COMPLETE`.
- [VERIFIED] Seven approved SPECs exist with matching approval metadata and
  SHA-256 hashes. The governance check passed again on 2026-07-27 with seven
  approved SPECs, one active task and one checked legacy manifest.
- [VERIFIED] `TASK-0001` is `ACTIVE` and implementation is authorized by the
  product owner under `DEC-0046`.
- [VERIFIED] The task sequence records `S1`, `W1`, `W2`, `W3`, `S2` and `S3`
  as `PASSED`. `R1` is `PENDING`. `S4` may not start until an independent R1
  review passes and all findings are reconciled.
- [VERIFIED] `DEC-0045` permits a future staged replacement of the existing CRM
  site. It is not permission to cut over, delete, overwrite or release now.
- [VERIFIED] `DEC-0047` covered the completed native PostgreSQL installation.
  `DEC-0048` covered the completed empty dedicated database and least-privilege
  role creation. Neither decision authorizes a migration or later server write.
- [VERIFIED] The Tencent server currently has the isolated service identity and
  directories, native PostgreSQL 16.14 bound to localhost, and an empty
  dedicated CRM database/role/runtime file. No CRM migration, business record,
  virtual environment, release, systemd application service, nginx change,
  DNS/TLS change or legacy-site cutover has been performed.
- [VERIFIED] S2 implements fail-closed PostgreSQL configuration, domain values,
  SQLAlchemy mappings and the initial Alembic migration for nine tables.
- [VERIFIED] S3 implements a read-only, fail-closed policy projection covering
  owner detail, other-business-user masking, management scope and administrator
  exception access. Administrator full-detail projection returns a requirement
  for an audit write; the actual audit write is intentionally part of S4.
- [VERIFIED] Only synthetic test values are authorized. No real institution
  data or `data/seed/yanglao_seed.*` content may be read into the application,
  tested as fixtures, imported or deployed.
- [VERIFIED] Docker and Docker Compose are forbidden. The approved target is a
  native Python virtual environment, PostgreSQL, Alembic, Uvicorn + systemd and
  nginx reverse proxy, with isolated project resources.
- [VERIFIED] External AI/model calls, paid services and third-party business
  integrations are not authorized.

## Changes made in the interrupted Codex continuation

- No application, migration, test, task-status or server file was changed.
- No server connection or write was made.
- The only new repository artifact is this handoff file.
- A first independent reviewer was tried twice. Both attempts failed before
  review with `503 Service Unavailable: No available channel for model
  gpt-5.4`; neither attempt produced findings or a verdict.
- A second independent reviewer was started and then explicitly interrupted
  when the product owner requested handoff to Qoder/ZCode. It produced no
  findings or verdict.
- Therefore R1 remains `PENDING`; do not infer R1 success from prior tests or
  from this handoff.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | local repository | PASS: 7 approved SPECs, 1 active task, 1 legacy manifest | live command output in this continuation |
| `.\\.venv\\Scripts\\python.exe --version` | repository virtual environment | Python 3.12.8 | live command output |
| `.\\.venv\\Scripts\\python.exe -m compileall -q src tests migrations` | repository virtual environment | PASS | live command output |
| `.\\.venv\\Scripts\\python.exe -m pytest -q` | repository virtual environment without the explicit PostgreSQL integration flag | `44 passed, 1 skipped`; only the isolated PostgreSQL round-trip test was skipped | live command output; skip at `tests/test_migrations.py:62` |
| `.\\.venv\\Scripts\\python.exe -m pip check` | repository virtual environment | `No broken requirements found` | live command output |
| controlled high-confidence private-key/access-key filename scan with values suppressed | local repository | 0 matching files | live command output |
| `git status --short --branch` | local repository | `main`, no commits, all repository files untracked | live command output |

An attempted bare `python -m pytest -q` used the machine-default Python 3.14
without the project environment and failed during collection with
`ModuleNotFoundError: crm`. This is an environment invocation error, not a
passing or failing application test. Use `.venv\\Scripts\\python.exe` as shown
above. Do not hide or rewrite this failed check.

Prior S2 evidence records an actual isolated local PostgreSQL 16.14
`upgrade -> downgrade -> upgrade` and `alembic check` pass. Recheck that evidence
and, if rerunning, keep credentials process-only and suppress their values.

## R1 review contract

R1 is read-only. The reviewer must not edit files, access the server or display
secret-bearing configuration. Review at minimum:

1. approved SPEC/decision/task mapping and matching approval hashes;
2. configuration fail-closed behavior and absence of SQLite/automatic schema
   creation fallback;
3. domain and database invariant consistency;
4. ORM versus migration parity, identifier lengths, downgrade completeness and
   deterministic history order;
5. idempotency constraints and whether tests prove the intended boundary;
6. owner, collaborator, management and administrator-exception policy behavior;
7. existence leakage, cross-record child rejection, raw-field fallbacks,
   administrator audit contract and management-scope handling;
8. test effectiveness, synthetic-only scope, external-AI disabled boundary and
   forbidden Docker/real-data/server-write scope.

The review response must lead with findings ordered by severity and include
absolute file paths plus line numbers. It must end with exactly one explicit
verdict:

- `R1 verdict: PASS`
- `R1 verdict: FAIL`

If the verdict is FAIL, do not begin S4. The implementation owner must make the
smallest approved fix, rerun focused and full checks, and obtain a new
independent R1 verdict. If the verdict is PASS with no unresolved findings,
update the active task's reviewer identity and R1 status plus a new R1 evidence
file, then rerun governance before S4.

## Failed or not verified

- Independent R1 has not passed.
- The explicit PostgreSQL integration test was not rerun in this continuation;
  it was skipped in the current default suite. Prior S2 evidence records the
  successful round trip.
- Commands/queries, authentication services, HTTP endpoints, pages/APIs and the
  four-step workflow do not exist yet.
- No Tencent-server migration, deployment, service health, nginx cutover,
  HTTPS/DNS, restart persistence, page/API parity or human acceptance is
  verified.
- `scripts/dev-test.ps1` and `scripts/dev-run.ps1` are owned future task outputs
  but do not currently exist.
- No commit or push exists, and none is authorized by this handoff.

## Secret and server boundary

The handoff intentionally preserves full non-secret technical detail. It must
not be extended with SSH credentials, private keys, TLS private keys, database
passwords, tokens, `auth.json`, `auth.js`, `deploy_key.py`, `_ssh_cmd.py` or
secret-bearing archive contents. Do not print, copy into the repository, log or
return those values. Existing local connection material may only be used in a
controlled process when a separately authorized gate requires it.

The product owner stated that they can log in to the server if the benefit is
material. No human login is currently necessary: R1 and S4 are local work. Ask
for that minimal human action only if an authorized later server gate cannot use
the existing controlled connection mechanism.

## Next bounded action

Qoder/Qwen 3.8 or ZCode/GLM 5.1 must first perform the independent read-only R1
review above. Only after a real `R1 verdict: PASS`, reconciled findings, updated
task/evidence files and a passing governance check may the implementation owner
begin S4: commands/queries plus server-side username/password authentication,
Argon2id verification, server-side sessions, CSRF protection, login rate
limiting, security audit and immediate session invalidation. S4 remains local
and synthetic-only and does not authorize any server write.
