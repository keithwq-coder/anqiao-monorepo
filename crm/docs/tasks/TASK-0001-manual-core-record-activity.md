# TASK-0001: Manual organization, contact, and activity fact loop

> SUPERSEDED. This proposal was written against `ADR-0001` (local-first,
> SQLite-only) and the `DEC-0011` freeze. `DEC-0043` cancelled local-first and
> `ADR-0002` replaced `ADR-0001`; `DEC-0033` lifted the freeze. Do not implement
> from this file. The current proposal is
> `docs/tasks/active/TASK-0001-manual-core-record-activity.md`.

- Task ID: TASK-0001
- Status: SUPERSEDED
- Superseded by: `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Implementation authorized by: NOT AUTHORIZED
- Authorization evidence: none
- Architecture owner: Codex / GPT-5.6-sol (proposed; actual model must be reported)
- Implementation owner: ZCode / GLM-5.1 (proposed; actual model must be reported)
- Key-node reviewer: Codex / GPT-5.6-sol (proposed; actual model must be reported)
- Audit started at: not started
- Audit last updated: 2026-07-26
- Depends on: `DEC-0010`, `ADR-0001`
- Blocked by: `DEC-0011`; complete SPEC baseline is not approved
- Execution routing: `docs/governance/MODEL-ROUTING.md` (proposal)

## Goal

Using synthetic local data, an authorized record owner can create and reopen an
organization, optionally add a contact, add a factual follow-up activity, view
deterministically ordered history, and exercise the approved visibility,
correction, withdrawal, archive, duplicate-warning, and audit boundaries.

## Scope

- SPEC rules: `R-001` through `R-016`, `R-025` through `R-031`, `R-035`,
  `R-036`.
- Acceptance criteria: `AC-001` through `AC-012`, `AC-021` through `AC-025`,
  `AC-028`, `AC-029`.
- Owned files/directories after authorization:
  - `pyproject.toml`
  - `alembic.ini`
  - `src/crm/`
  - `migrations/`
  - `tests/`
  - `scripts/run-local.ps1`
  - `scripts/test-local.ps1`
  - `var/.gitkeep`
  - `.gitignore` entries limited to generated local application state
  - `docs/evidence/TASK-0001-*`

## Non-goals

- AI coaching behavior in `R-017` through `R-024`, `R-032` through `R-034`;
- external model/provider integration or real-data transfer;
- real authentication provider, production identity, or shared-user rollout;
- opportunity/pipeline stages, lead ingestion, scoring, reminders, reporting,
  messaging, external integrations, deployment, or historical-data migration;
- changing the approved SPEC, governance gates, or legacy snapshot;
- committing, deploying, or using real business data.

## Assumptions and unknowns

- [VERIFIED] The approved manual path must work without AI or external systems.
- [VERIFIED] Python and the selected local libraries are installed on this
  machine; the task must record the environment actually used.
- [VERIFIED] Only synthetic fixture data is authorized.
- [INFERENCE] A local persona fixture can supply owner/other-user/administrator
  contexts for automated policy tests without pretending production
  authentication exists.
- [UNKNOWN] Production authentication, deployment, backup, legal retention, and
  real-data classifications. They are out of scope and must not be inferred.

No unknown above changes the authorized local synthetic-data behavior. Any new
unknown that changes a SPEC rule or acceptance criterion blocks implementation
and returns the SPEC to review.

## Prerequisites and completion gate

- Prerequisites:
  - approval metadata hash matches `SPEC-0001 v0.7.0`;
  - `ADR-0001` remains active;
  - the product owner explicitly authorizes `TASK-0001`;
  - `docs/specs/SPEC-BASELINE.md` is COMPLETE with recorded product-owner
    approval;
  - no other active task owns the listed paths.
- Exact output: a local modular-monolith vertical slice plus migrations,
  synthetic fixtures, automated tests, launch/test scripts, and evidence.
- Completion gate: all named automated checks pass; a local HTTP smoke confirms
  create/reopen/history behavior; business and visual checks are recorded
  separately; governance check passes.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | Task authorized and ownership clear | Confirm actual tool/model, record package environment, and scaffold package/test boundaries | package skeleton and test harness | environment report; import/compile smoke | PENDING |
| 2 | Step 1 passes and product owner replies `继续` | Implement organization/contact/activity identities and minimum validation | focused domain behavior | focused domain tests | PENDING |
| 3 | Step 2 passes and product owner replies `继续` | Implement correction versions, withdrawal/archive, and audit events | deterministic change history | revision/audit tests | PENDING |
| 4 | Step 3 passes and product owner replies `继续` | Implement SQLite migrations, repositories, and synthetic fixtures | local persistence | fresh migration, repository, and reopen tests | PENDING |
| 5 | Step 4 passes and product owner replies `继续` | Implement central role/ownership policy and field projections | one shared permission boundary | owner/other/admin/unauthorized matrix tests | PENDING |
| 6 | Steps 1-5 pass | Stop implementation for the foundation key-node review | GPT review evidence | independent SPEC, architecture, security, and test review | PENDING |
| 7 | Step 6 findings resolved and product owner replies `继续` | Implement organization/contact creation and reopen pages/API | first visible local workflow | HTTP acceptance tests | PENDING |
| 8 | Step 7 passes and product owner replies `继续` | Implement activity entry, deterministic history, and concise progress | complete primary fact loop | HTTP history/projection tests | PENDING |
| 9 | Step 8 passes and product owner replies `继续` | Implement duplicate warning and correction/withdrawal/archive/admin-reason flows | approved edge workflows | HTTP and audit tests | PENDING |
| 10 | Steps 7-9 pass | Stop implementation for the usable-flow key-node review | GPT review evidence | independent end-to-end, permission, masking, and regression review | PENDING |
| 11 | Step 10 findings resolved and product owner replies `继续` | Run full checks, restart persistence smoke, and record human-check boundary | release-candidate local slice and evidence | `scripts/test-local.ps1`; local smoke; governance check | PENDING |
| 12 | Step 11 passes | Stop for GPT closure review and product-owner business/visual acceptance | closure review and concise acceptance brief | all evidence reconciled; no unverified claim presented as passed | PENDING |

After each implementation checkpoint, ZCode/GLM stops and sends the compact
plain-language report defined by `docs/governance/MODEL-ROUTING.md`. The
product owner's `继续` advances only within this task's approved scope.

Proposed verification commands after authorization:

```powershell
python -m compileall src tests
python -m pytest -q
powershell -ExecutionPolicy Bypass -File scripts/test-local.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
```

## Risks and rollback

- Generated SQLite data may contain only synthetic fixtures and stays under
  ignored `var/`.
- Authorization and masking are centralized; endpoints may not return raw ORM
  objects directly.
- Migration tests start from an empty temporary database and never target a
  shared or production database.
- Rollback removes generated task-owned application files and local generated
  data. It does not modify the approved SPEC or legacy snapshot.

## Evidence and result

- Status: NOT STARTED
- Commands actually run: none
- Result artifacts: none
- Not verified: all implementation and acceptance criteria
