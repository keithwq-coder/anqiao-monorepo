# HANDOFF-20260806-TASK-0015-USER-ROLE-MANAGEMENT

- Task: TASK-0015 (SPEC-0002 user, role, ownership and management surface)
- From tool/model: coordinator (Kimi Code)
- To tool/model: GLM (sole executor, assigned by `DEC-0102` per the product
  owner's standing instruction; supersedes the card's DeepSeek proposal;
  executor model identity per self-report or UNKNOWN, never an acceptance
  gate)
- Handoff status: HANDOFF-ONLY
- Repository state: `uncommitted` (zero-commit worktree); coordinator changes
  since TASK-0010 acceptance are governance records only — the application
  code state is exactly what GLM left at TASK-0010 acceptance plus nothing
- Written at: 2026-08-06 (local)

## Required reading

- `AGENTS.md` (full; the non-negotiable start sequence applies to you)
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` and its
  `.approval.json` (hash re-verified 2026-08-06)
- `docs/tasks/active/TASK-0015-user-role-management.md` (your task card;
  owned paths and required acceptance are defined there)
- `docs/decisions/DECISION-LOG.md`: `DEC-0089`, `DEC-0101`, `DEC-0102`
- `docs/NOW.md`, `docs/tasks/TASKS.md`
- Recent accepted work you must not regress:
  `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md`
  (`_normalize_reason` semantics) and
  `docs/evidence/TASK-0010-COORDINATOR-ACCEPTANCE-20260806.md` (actor-aware
  searchable predicate)

## Verified current state

- [VERIFIED] Baseline at handoff: full suite `218 passed, 28 skipped,
  1 warning`; `compileall` exit 0; governance `[PASS]` (all re-run by the
  coordinator 2026-08-06).
- [VERIFIED] Role grants exist (`InMemoryRoleGrantRepository`,
  `src/crm/domain/models.py` `Role` enum: BUSINESS_USER, ADMINISTRATOR,
  GENERAL_MANAGER, MANAGER; a MANAGER grant requires a scope).
- [VERIFIED] Task input from audit residual R2: `RecordSnapshot` built by
  `QueryService` never sets `management_scope_key`, so a scoped MANAGER
  subject is `PolicyDenied` for every record (fail-closed). Your
  management-surface work must address this within SPEC-0002 scope.
- [VERIFIED] Recorded P2 residual, NOT your scope: `GET
  /api/institutions/<non-uuid>` returns 500 (unhandled `ValueError`). Do not
  fix it under this task.

## Changes made

Coordinator governance changes only (no application code):

- `docs/decisions/DECISION-LOG.md` — `DEC-0101` (TASK-0010 accepted),
  `DEC-0102` (TASK-0015 activation + GLM assignment).
- `docs/tasks/active/TASK-0015-user-role-management.md` — moved from
  `proposed/`; status ACTIVE / IMPLEMENTATION-READY.
- `docs/tasks/TASKS.md`, `docs/NOW.md` — synchronized.
- `docs/evidence/TASK-0010-COORDINATOR-ACCEPTANCE-20260806.md` — created.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `pytest tests/test_task0010_search_security.py -q` | local `.venv` | `13 passed` | round-2 audit |
| `pytest tests -q` | local `.venv` | `218 passed, 28 skipped, 1 warning` | round-2 audit |
| `python -m compileall -q src tests` | local `.venv` | exit 0 | round-2 audit |
| `scripts/check-governance.ps1` | local | `[PASS]` | round-2 audit |
| SPEC-0002 approval hash recompute | local | match | `DEC-0102` |

## Failed or not verified

- TASK-0015 itself: NOT STARTED. All "Required acceptance" items on the card
  are unverified.
- 28 skipped tests are the labelled isolated-PostgreSQL gates; out of scope.

## Next bounded action

Start with a Step-1-style design record under `docs/evidence/TASK-0015-*`:
map the card's four capability areas (audited role grant/revoke, user
enable/disable, single+batch ownership transfer with reason, read-only
management summaries) to the exact SPEC-0002 rules each implements, including
how `management_scope_key` will be populated so scoped managers see
in-scope records and nothing else. Then implement the smallest slices in
dependency order with focused tests (unauthorized, disabled, stale-session,
duplicate/idempotency, mixed-batch failure paths). Stay inside the card's
owned paths; local synthetic only; any scope beyond returns to the SPEC
workflow. Report per `AGENTS.md` §9 and end with
`STOP: coordinator audit required`.
