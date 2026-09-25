# TASK-0015: SPEC-0002 user, role, ownership and management surface

- Task ID: TASK-0015
- Status: ACTIVE / **ACCEPTED** (`DEC-0103`, local synthetic scope)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
  (hash re-verified 2026-08-06)
- Authorization: `DEC-0089`; sequencing released by `DEC-0101`; ownership
  release and activation `DEC-0102`
- Implementation owner: GLM (sole executor, per `DEC-0102`; supersedes the
  original DeepSeek proposal; active on handoff acceptance)
- Owner model: executor self-report or UNKNOWN
- Coordinator/auditor: current coordinator
- Depends on: `TASK-0009`, `TASK-0014` (both ACCEPTED)
- Task input from audit: `RecordSnapshot` in `QueryService` never sets
  `management_scope_key`, so a scoped MANAGER is denied every record
  (fail-closed, pre-existing). Management-surface work must address this
  within the approved SPEC scope (residual R2,
  `docs/evidence/TASK-0010-COORDINATOR-ACCEPTANCE-20260806.md`).

## Goal

Implement the approved management capabilities currently absent: audited role
grant/revoke, user enable/disable, single and batch ownership transfer with
reason, and read-only management summaries that respect scope and masking.

## Owned paths (exclusive after activation)

- `src/crm/application/commands.py`, `src/crm/application/queries.py`
- `src/crm/persistence/repositories.py`, `src/crm/persistence/models.py`
- new Alembic migration only if the approved SPEC requires durable state
- `src/crm/web/routes/` management routes and `src/crm/web/main.py` wiring
- `templates/` management pages only
- focused tests under `tests/`
- `docs/evidence/TASK-0015-*` and this task card

## Prerequisites and completion gate

- Prerequisites: `DEC-0089`; TASK-0009 and TASK-0014 accepted; coordinator
  ownership release. All met (`DEC-0092`, `DEC-0097`, `DEC-0101`, `DEC-0102`).
- Completion gate: every "Required acceptance" item below is covered by
  focused tests; full `pytest tests/ -q` passes without regression from the
  `218 passed, 28 skipped` baseline; governance `[PASS]`; coordinator
  independent audit accepts.

## Required acceptance

- Administrator-only role grant/revoke and user enable/disable are audited,
  idempotent where the SPEC requires, and fail closed for unauthorized users.
- Ownership transfer records old owner, new owner, actor, reason, timestamp,
  and applies to single and batch operations without partial silent success.
- General manager and scoped management views are concise/read-only and never
  reveal protected contact/source/original-progress fields by role alone.
- Disabled users lose access immediately while historical audit remains.
- Tests cover unauthorized, disabled, stale-session, duplicate/idempotency,
  and mixed-batch failure paths.

## Verification

Focused role/transfer tests, full `pytest tests/ -q`, governance check, and
local synthetic restart/session evidence. No production migration, remote DB,
or real users.
