# TASK-0010: Search security repair and verification

- Task ID: TASK-0010
- Status: ACTIVE / IMPLEMENTATION-READY (`DEC-0098`)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0008-search.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0008-search.approval.json`
- Also governed by: `SPEC-0001`, `SPEC-0002`
- Implementation authorized by: `DEC-0089` (local synthetic implementation
  sequence only); sequencing released by `DEC-0097`; ownership release and
  activation `DEC-0098`
- Authorization evidence: product owner request recorded by `DEC-0089`
- Owner tool: GLM (assigned by `DEC-0099` on the product owner's instruction;
  supersedes the card's original DeepSeek proposal; becomes active on handoff
  acceptance)
- Owner model: executor self-report or UNKNOWN
- Handoff: `docs/handoffs/HANDOFF-20260806-TASK-0010-SEARCH-SECURITY.md`
- Implementation started at: 2026-08-06 (ownership release)
- Audit started at: not started
- Audit last updated: 2026-08-06
- Depends on: `TASK-0007`, `TASK-0008`, `TASK-0009`, `TASK-0014` (all ACCEPTED)

## Goal

Verify and, only where required, repair search so it matches only fields visible
to the current actor and cannot reveal hidden-field existence through result
presence, count, or detail.

## Scope

- SPEC rules: `SPEC-0008` R-001 through R-008.
- Acceptance criteria: `SPEC-0008` AC-001 through AC-007.
- Owned files/directories:
  - search-specific query/repository code;
  - the search portion of institution routes/templates;
  - focused search permission/leakage tests;
  - `docs/evidence/TASK-0010-*` and this task card.

## Non-goals

- No export, saved views, reports, bulk import, or unrelated core workflow work.
- No live deployment or real-data probing without separate authorization.

## Assumptions and unknowns

- [VERIFIED 2026-08-06] Current repository matching
  (`src/crm/persistence/repositories.py:82-89`) includes `source_description`
  before policy projection and therefore does not satisfy visible-field-only
  search. Confirmed by the coordinator at ownership release.
- [VERIFIED] The actor/role/scope contract is settled by TASK-0007 (accepted)
  and the projection/repository contract by TASK-0008/TASK-0014 (accepted);
  search must reuse `QueryService.find_institutions` + `project_record` and
  must not bypass the policy layer.

## Prerequisites and completion gate

- Prerequisites: TASK-0007 through TASK-0009 pass; TASK-0014 accepted;
  ownership release recorded. All met (`DEC-0097`, `DEC-0098`).
- Exact output: actor-aware search plan and implementation with no hidden-field
  oracle.
- Completion gate: all `SPEC-0008` acceptance tests pass for owner, other user,
  management scope, administrator exception, and unauthorized actor; negative
  tests prove phone/source/hidden detail cannot affect observable results.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | Task authorized | Derive visible searchable fields per actor | Search matrix | Matrix matches policy projection | PENDING |
| 2 | Step 1 passed | Implement smallest actor-aware query path | Search patch | Focused repository/HTTP tests | PENDING |
| 3 | Step 2 passed | Add hidden-field and existence-oracle negative tests | Security evidence | Tests fail against old behavior and pass after fix | PENDING |
| 4 | Step 3 passed | Independent review | Review verdict | No unresolved P0/P1 | PENDING |

## Risks and rollback

- Filtering after a broad hidden-field match is not acceptable because result
  existence already leaks information. Enforce visibility in the searchable
  predicate itself.

## Evidence and result

- Status: NOT STARTED
- Commands actually run: none for implementation
- Result artifacts: none
- Not verified: all search acceptance and leakage criteria
