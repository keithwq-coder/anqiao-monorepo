# HANDOFF-20260806-TASK-0017-DATA-LIFECYCLE

- Task: TASK-0017 (SPEC-0011 lifecycle, erasure and propagation evidence)
- From tool/model: coordinator (Kimi Code)
- To tool/model: GLM (sole executor, assigned by `DEC-0105`; executor model
  identity per self-report or UNKNOWN, never an acceptance gate)
- Handoff status: HANDOFF-ONLY
- Repository state: `uncommitted` (zero-commit worktree); coordinator changes
  are governance records only — application code is exactly what GLM left at
  TASK-0015 acceptance
- Written at: 2026-08-06 (local)

## Required reading

- `AGENTS.md` (full; the non-negotiable start sequence applies to you)
- `docs/specs/30-approved/SPEC-0011-data-lifecycle.md` and its
  `.approval.json` (hash re-verified 2026-08-06)
- `docs/tasks/active/TASK-0017-data-lifecycle-erasure.md` (your task card;
  owned paths and required acceptance are defined there)
- `docs/decisions/DECISION-LOG.md`: `DEC-0089`, `DEC-0103`, `DEC-0104`
  (scope semantics + your OD-001 parameters), `DEC-0105`
- `docs/NOW.md`, `docs/tasks/TASKS.md`
- Recent accepted work you must not regress:
  `docs/evidence/TASK-0015-COORDINATOR-ACCEPTANCE-20260806.md` (management
  surface, audit patterns, residuals D2/D3)

## Verified current state

- [VERIFIED] Baseline at handoff: full suite `244 passed, 28 skipped,
  1 warning`; `compileall` exit 0; governance `[PASS]` (coordinator re-run
  2026-08-06).
- [VERIFIED] `SPEC-0011 OD-001` is resolved by `DEC-0104` Decision 2:
  backup mechanism for this stage is `pg_dump` logical backups to a local
  directory (synthetic only); the bounded deletion-propagation window is
  **30 days**; every erasure record carries a `propagate_by` deadline;
  propagation is reported complete only after verification, otherwise
  explicitly incomplete — never by assumption.
- [VERIFIED] Existing behavior to preserve: ordinary correction stays
  archive + versioned revisions (TASK-0008, SPEC-0001 R-031/R-036); the
  single-`archive_reason` contract and `_normalize_reason` semantics
  (TASK-0014); the actor-aware searchable predicate (TASK-0010); the
  management surface and its audit patterns (TASK-0015).
- [VERIFIED] The existing schema has `audit_events` with
  `before_state`/`after_state` JSON and archive columns; the card permits a
  bounded Alembic migration if erasure/propagation needs durable state —
  local synthetic databases only.

## Changes made

Coordinator governance changes only (no application code):

- `docs/decisions/DECISION-LOG.md` — `DEC-0104` (scope semantics + OD-001),
  `DEC-0105` (TASK-0017 activation + GLM assignment).
- `docs/tasks/active/TASK-0017-data-lifecycle-erasure.md` — moved from
  `proposed/`; status ACTIVE / IMPLEMENTATION-READY; prerequisites and
  completion gate recorded.
- `docs/tasks/TASKS.md`, `docs/NOW.md` — synchronized.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `pytest tests -q` | local `.venv` | `244 passed, 28 skipped, 1 warning` | TASK-0015 audit |
| `python -m compileall -q src tests` | local `.venv` | exit 0 | TASK-0015 audit |
| `scripts/check-governance.ps1` | local | `[PASS]` | TASK-0015 audit |
| SPEC-0011 approval hash recompute | local | match | `DEC-0105` |

## Failed or not verified

- TASK-0017 itself: NOT STARTED. All "Required acceptance" items unverified.
- 28 skipped tests are the labelled isolated-PostgreSQL gates; out of scope.
- Production backup scheduling/retention belongs to TASK-0018/SPEC-0012 —
  not your scope.

## Next bounded action

Start with a design record under `docs/evidence/TASK-0017-*`: map each
"Required acceptance" item to the exact SPEC-0011 rule (R-001–R-009,
AC-001–AC-006) and define the erasure record shape, including the
`propagate_by` deadline (erasure time + 30 days per `DEC-0104`), the
no-personal-values audit payload, and the propagation complete/incomplete
marking. Then implement the smallest slices: administrator-only erasure
command + route (explicit reason and confirmation, irreversible in-app),
request-completion record, synthetic `pg_dump` backup/restore rehearsal
script under `scripts/` proving erased values are absent from post-window
backups, and focused negative tests (non-admin denied, missing reason
denied, normal correction still archive). Stay inside the card's owned
paths; report per `AGENTS.md` §9 and end with
`STOP: coordinator audit required`.
