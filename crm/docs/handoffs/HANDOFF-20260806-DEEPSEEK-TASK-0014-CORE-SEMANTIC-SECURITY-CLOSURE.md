# HANDOFF-20260806-TASK-0014

- Task: TASK-0014
- From tool/model: coordinator
- To tool/model: DeepSeek (sole implementation executor)
- Handoff status: HANDOFF-ONLY / READY FOR ACTIVATION
- Repository state: `main`, broadly untracked, no commits; preserve all existing files
- Written at: 2026-08-06 Asia/Shanghai
- Authority: `DEC-0089` and `DEC-0092`; local synthetic data only

## Required reading

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/SPEC-BASELINE.md`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0089` through `DEC-0092`
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md` and matching approval JSON
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` and matching approval JSON
- `docs/tasks/active/TASK-0014-core-semantic-security-closure.md`
- `docs/evidence/TASK-0009-COORDINATOR-ACCEPTANCE-20260806.md`
- Actual source files and tests named by TASK-0014

## Verified current state

- [VERIFIED] TASK-0009 is coordinator-accepted for the local synthetic baseline:
  `184 passed, 28 skipped`, repeated five times; `pip check` and governance pass.
- [VERIFIED] TASK-0009, TASK-0008, TASK-0012, and TASK-0001 local implementation
  ownership is released for the next bounded task under `DEC-0090` and `DEC-0092`.
- [VERIFIED] The seven approved SPEC baseline is complete; `SPEC-0014` remains
  draft-only and is excluded.
- [UNKNOWN] Any behavior-changing ambiguity discovered in the approved SPECs or
  source contracts. Stop and report it; do not invent a rule.

## Goal

Close the approved SPEC-0001/SPEC-0002 semantic and write-authorization gaps
using existing domain concepts only:

1. Disabled and enabled-but-no-business-role users cannot create institutions,
   contacts, or follow-ups without protected-existence leakage.
2. Owner/collaborator classification remains deterministic for UUID/string
   identity representations.
3. Ordinary owner archive is denied where `SPEC-0001 R-036` requires an audited
   administrator exception with reason, actor, target, and timestamp.
4. Withdrawn activities remain auditable but are excluded from normal history
   and progress projections where the SPEC requires it.
5. Existing correction, withdrawal, duplicate, administrator-exception, and
   page/API projection behavior remains green.

## Exclusive owned paths after activation

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
remote resources. If one is required, stop with:
`BLOCKED: SPEC/OWNERSHIP-RELEASE-REQUIRED`.

## Required verification

- Run focused negative tests for every pre-fix behavior and prove they fail
  against the old behavior where practical.
- Run `PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q`.
- Run `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
- Run `PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests` when
  Python files change.
- Report static checks, automated tests, local runtime evidence, and all
  unverified remote/human gates separately.

## Stop and safety rules

- No TASK-0015 or other successor may start from this handoff.
- No deployment, SSH, remote PostgreSQL, production migration, real-data write,
  credential change, paid API, or external write.
- Do not delete tests, weaken assertions, add unconditional skips, or modify
  governance gates.
- If a product decision or approved-SPEC conflict appears, stop and return the
  SPEC to review.

## Required report

Return exact changed paths, SPEC/AC mapping, commands and outputs, failed/skipped/
not-verified checks, scope/safety confirmation, risks and rollback, and one next
bounded action. Do not claim acceptance; the coordinator must independently audit.
