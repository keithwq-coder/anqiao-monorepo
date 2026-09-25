# HANDOFF: TASK-0011 — SPEC-0013 batch-import capability

- Date: 2026-08-06
- From: coordinator
- To: GLM (implementation owner, per `DEC-0108`; sole executor)
- Task card: `docs/tasks/active/TASK-0011-bulk-import-capability.md`
- Approved SPEC: `docs/specs/30-approved/SPEC-0013-bulk-import.md`
  (approval hash re-verified 2026-08-06, match)
- Authorization: `DEC-0089` (local synthetic sequence); activation `DEC-0108`

## Verified state you can rely on (re-check anyway)

- Baseline: full suite `258 passed, 28 skipped, 1 warning`
  (`.venv/Scripts/python.exe -m pytest tests -q`).
- TASK-0007/0008/0009/0014/0010/0015/0017 are all ACCEPTED. The application
  already has: auth + role grants, policy projection, actor-aware search,
  archive/correction workflow, admin management surface
  (`src/crm/web/routes/admin.py`), and audited permanent erasure
  (`src/crm/application/lifecycle_commands.py`).
- Migrations: `0001_initial_schema`, `0002_erasure_records` (chained).
- A one-time 117-record Suzhou import was executed by a temporary script and
  separately ratified (`DEC-0058`); it does NOT prove the product capability
  and its approach (no batch identity, no row results, silent duplicate
  skips, no per-row savepoints) must not be copied.

## What to build (SPEC-0013 R-001…R-009, AC-001…AC-008)

Reusable administrator-only batch import: durable batch + per-row result
persistence (bounded migration), parsing/validation, duplicate flagging,
partial success with per-row isolation, idempotent rerun, and conditional
batch undo. Owned paths are exactly those on the task card.

## Hard boundaries

1. Local synthetic only. Never touch the existing 117 records, any real
   data, remote resources, or production. Parser/mapping tests use synthetic
   files only.
2. Administrator-only import (OD-002 default). Non-admin and no-role actors
   must be denied and that denial tested.
3. `OD-001` (file format/field mapping) is an implementation detail: derive
   it from `SPEC-0013` + `SPEC-0001` minimum data contract and existing
   model evidence. If you find a behavior-changing product decision missing,
   STOP and return the SPEC to review — do not invent it.
4. Batch undo is dangerous: only records not modified since import are
   eligible. Fail closed; test mixed eligible/ineligible batches
   transactionally (task card "Risks and rollback").
5. Reason fields follow DEC-0096 semantics: whitespace-only reasons are
   treated as absent and rejected/normalized at the boundary.
6. Audit writes carry no personal values beyond what SPEC-0001 already
   permits; consistent with the erasure-era audit hygiene.

## Verification contract

- Focused synthetic tests for every AC, including rerun/undo negative paths.
- Full suite without regression from `258 passed, 28 skipped`.
- `python -m compileall -q src tests` exit 0.
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` `[PASS]`.
- The card's "local PostgreSQL" leg: only the isolated local PostgreSQL
  test database satisfies it. If unavailable, mark NOT VERIFIED with the
  exact remaining check — never report success by assumption.
- Completion report per `AGENTS.md` §9: Status / Scope / Evidence /
  Not verified / Decisions needed.

STOP: coordinator audit required after your report; do not start TASK-0016
or any successor.
