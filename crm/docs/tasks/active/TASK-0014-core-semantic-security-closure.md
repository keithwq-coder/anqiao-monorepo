# TASK-0014: Core semantic and write-authorization closure

- Task ID: TASK-0014
- Status: ACTIVE / REMEDIATION-REQUIRED (`DEC-0094`)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Also governed by: `SPEC-0002 v0.2.0` and its matching approval metadata
- Implementation authorized by: `DEC-0089` (local synthetic implementation
  sequence only); activated by `DEC-0092`; executor reassigned by `DEC-0093`
- Implementation owner: GLM-5.2 (sole executor)
- Coordinator/auditor: current coordinator
- Depends on: `TASK-0009`; ownership release from `TASK-0001`/`TASK-0008`

## Goal

Close the verified P0/P1 gaps in the already implemented core workflow without
adding new product concepts: only enabled business users may write; owner
projection must be deterministic; archive must follow the approved authority;
withdrawn activities must not appear as normal history; and all paths must use
the central policy projection.

## Owned paths (exclusive after activation)

- `src/crm/application/commands.py`
- `src/crm/application/queries.py`
- `src/crm/persistence/repositories.py`
- `src/crm/web/routes/institutions.py`
- `src/crm/web/routes/followups.py`
- `src/crm/web/main.py` only where required for this behavior
- focused tests under `tests/` for these contracts
- `docs/evidence/TASK-0014-*` and this task card

Do not edit `src/crm/policy/`, `src/crm/domain/`, `src/crm/persistence/models.py`,
templates, migrations, deployment files, or remote resources without a new
bounded decision. If a model or migration is necessary, stop and report the
SPEC/decision gap.

## Prerequisites and completion gate

- Prerequisites: `TASK-0009` is coordinator-accepted under `DEC-0092`;
  `TASK-0001`/`TASK-0008` local ownership is released; approved SPEC-0001 and
  SPEC-0002 approval metadata hashes remain valid.
- Completion gate: focused negative tests cover every listed write,
  classification, archive, and withdrawn-history behavior; the full local
  suite is green; `compileall` passes when Python files change; and the
  governance check returns `[PASS]`.
- No remote PostgreSQL/SSH, deployment, production migration, real-data write,
  credential change, paid service, or external write is part of this task.
- Any behavior-changing unknown, approved-SPEC conflict, or request to edit an
  unowned path is a fail-closed stop and requires coordinator review.

## Required acceptance

- Disabled and enabled-but-no-business-role users cannot create institutions,
  contacts, or follow-ups; denial does not reveal protected existence.
- A UUID/string identity cannot change owner/collaborator classification.
- Ordinary owner archive is denied when `SPEC-0001 R-036` requires an audited
  administrator exception; reason, actor, target, and timestamp are retained.
- Withdrawn activity rows are retained for audit but excluded from normal
  history/progress projections, with an explicit audited view only where the
  SPEC permits it.
- Existing correction/withdrawal/duplicate/admin-exception behavior remains
  green and page/API projection parity is preserved.
- Add negative tests that would fail against each pre-fix behavior.

## Verification

Run focused tests, `pytest tests/ -q`, and
`powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
Report static, automated, local runtime, remote, and human visual evidence
separately. No deployment or real-data write is part of this task.

## Coordinator audit status

- `DEC-0094` did not accept the GLM-5.2 completion claim. The correction is
  limited to the existing owned paths and must address the two reproduced
  authorization failures recorded in
  `docs/evidence/TASK-0014-COORDINATOR-AUDIT-20260806.md`.
- `DEC-0095` did not accept the subsequent remediation claim because a
  whitespace-only administrator reason remains inconsistent across
  query/API/page/audit paths; see
  `docs/evidence/TASK-0014-COORDINATOR-REMEDIATION-AUDIT-2-20260806.md`.
- `DEC-0096` retracts the separate-reason interpretation: R-036 has one
  `archive_reason`, retained on the record and in its transactional audit. The
  remaining correction is the whitespace-only read-exception inconsistency and
  removal of the remediation-introduced archive `administrator_reason` field.
- GLM-5.2 remains the sole implementation owner. No successor task is active
  until a new independent coordinator audit accepts this task.
