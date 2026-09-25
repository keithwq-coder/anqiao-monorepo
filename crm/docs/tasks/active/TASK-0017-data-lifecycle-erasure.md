# TASK-0017: SPEC-0011 lifecycle, erasure and propagation evidence

- Task ID: TASK-0017
- Status: ACTIVE / **ACCEPTED** (`DEC-0107`, local synthetic scope; round-1
  audit `DEC-0106` remediation verified)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0011-data-lifecycle.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0011-data-lifecycle.approval.json`
  (hash re-verified 2026-08-06)
- Authorization: `DEC-0089`; `SPEC-0011 OD-001` resolved by `DEC-0104`
  (synthetic `pg_dump` mechanism; 30-day propagation window, reversible);
  ownership release and activation `DEC-0105`
- Implementation owner: GLM (sole executor, per `DEC-0105`; supersedes the
  original DeepSeek proposal; active on handoff acceptance)
- Owner model: executor self-report or UNKNOWN
- Coordinator/auditor: current coordinator
- Depends on: `TASK-0014` (ACCEPTED, `DEC-0097`), `TASK-0015` (ACCEPTED,
  `DEC-0103`); production backup scheduling remains with TASK-0018/SPEC-0012

## Prerequisites and completion gate

- Prerequisites: `DEC-0089`; TASK-0014 and TASK-0015 accepted; `OD-001`
  resolved. All met (`DEC-0097`, `DEC-0103`, `DEC-0104`, `DEC-0105`).
- Completion gate: every "Required acceptance" item below is covered by
  focused tests plus a synthetic backup/restore rehearsal; full
  `pytest tests/ -q` passes without regression from the `244 passed,
  28 skipped` baseline; governance `[PASS]`; coordinator independent audit
  accepts.

## Goal

Implement controlled, administrator-only, audited permanent erasure and
request-completion records while preserving ordinary archive/correction
behavior. Record backup propagation status and restore verification using local
synthetic backups only.

## Owned paths (exclusive after activation)

- lifecycle command/query/service modules under `src/crm/`
- `src/crm/persistence/models.py`, repositories, and bounded Alembic migration
- lifecycle/admin routes and templates
- local backup/restore evidence helpers under `scripts/` only if they do not
  touch remote or production resources
- focused synthetic lifecycle tests under `tests/`
- `docs/evidence/TASK-0017-*` and this task card

## Required acceptance

- Normal business correction remains archive, not hard delete.
- Permanent deletion requires administrator authorization, explicit reason and
  confirmation, is irreversible in the application, and writes an audit record
  without deleted personal values.
- Deletion request completion is recorded without retaining deleted content.
- Backup propagation is either proven within the approved bounded window or
  explicitly marked incomplete; never report success by assumption.
- Restore rehearsal proves the documented synthetic recovery path.

## Verification

Run lifecycle-focused tests, synthetic backup/restore rehearsal, full local
suite, and governance check. Do not delete or mutate production/real data.
