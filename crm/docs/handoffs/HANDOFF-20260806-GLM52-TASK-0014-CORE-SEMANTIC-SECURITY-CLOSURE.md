# HANDOFF-20260806-GLM52-TASK-0014

- Task: TASK-0014
- From tool/model: coordinator
- To tool/model: GLM-5.2 (`xopglm52`)
- Handoff status: HANDOFF-ONLY / READY FOR IMPLEMENTATION
- Repository state: `main`, broadly untracked, no commits; preserve all existing files
- Written at: 2026-08-06 Asia/Shanghai
- Authority: `DEC-0089`, `DEC-0092`, and `DEC-0093`
- Environment boundary: local synthetic data only

## Required reading

Read these files in full before editing:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/SPEC-BASELINE.md`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0089` through `DEC-0093`
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- `docs/tasks/active/TASK-0014-core-semantic-security-closure.md`
- `docs/evidence/TASK-0009-COORDINATOR-ACCEPTANCE-20260806.md`
- The actual source files and tests named below, plus their callers/consumers

## Verified starting state

- [VERIFIED] TASK-0009 is coordinator-accepted: `184 passed, 28 skipped`,
  repeated five times; `pip check` and governance pass.
- [VERIFIED] TASK-0014 is the only active successor implementation task.
- [VERIFIED] GLM-5.2 is the sole implementation owner under `DEC-0093`.
- [VERIFIED] The approved SPEC baseline is complete; draft `SPEC-0014` is
  excluded.
- [UNKNOWN] Any behavior-changing ambiguity exposed by current source/spec
  inspection. Stop and report it; do not invent a rule.

## Goal

Close only the approved SPEC-0001/SPEC-0002 P0/P1 gaps using existing domain
concepts:

1. Disabled and enabled-but-no-business-role users cannot create institutions,
   contacts, or follow-ups, with no protected-existence leakage.
2. Owner/collaborator classification is deterministic for UUID and string
   identity representations.
3. Ordinary owner archive is denied where `SPEC-0001 R-036` requires an audited
   administrator exception retaining reason, actor, target, and timestamp.
4. Withdrawn activity rows remain auditable but are excluded from normal history
   and progress projections where the SPEC requires it.
5. Existing correction, withdrawal, duplicate, administrator-exception, and
   page/API projection behavior remains green.

## Exclusive owned paths

- `src/crm/application/commands.py`
- `src/crm/application/queries.py`
- `src/crm/persistence/repositories.py`
- `src/crm/web/routes/institutions.py`
- `src/crm/web/routes/followups.py`
- `src/crm/web/main.py` only where required for this behavior
- focused tests under `tests/`
- `docs/evidence/TASK-0014-*` and this task card

Do not edit `src/crm/policy/`, `src/crm/domain/`,
`src/crm/persistence/models.py`, templates, migrations, deployment files, or
remote resources. If a model, migration, policy/domain change, or other
unowned path is required, stop with:
`BLOCKED: SPEC/OWNERSHIP-RELEASE-REQUIRED`.

## Required implementation discipline

- Inspect current source and callers before editing.
- Add negative tests that would fail against each pre-fix behavior.
- Do not add new product concepts, weaken assertions, delete tests, add
  unconditional skips, alter governance gates, or broaden the task.
- Preserve all existing user files and untracked artifacts.
- Do not start TASK-0015 or any other successor.

## Required verification

Run and record exact results:

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest <focused TASK-0014 tests> -q
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q
PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
```

Separate static checks, automated tests, local runtime evidence, remote checks,
and human visual acceptance. Do not claim acceptance; the coordinator owns the
independent audit.

## Safety boundary

No deployment, SSH, remote PostgreSQL, production migration, real-data write,
credential change, paid service, or external write is authorized. If an
approved-SPEC conflict, missing business decision, or ownership conflict is
found, stop and report it before editing.

## Required completion report

Return one structured report with exact changed paths, SPEC/AC mapping, commands
and results, failures/skips/NOT VERIFIED items, scope and safety confirmation,
risks/rollback, and the next bounded action. The next action must be:
`STOP: coordinator audit required; do not start TASK-0015`.
