# ADR-0003: Current cloud modular monolith (implemented state)

- Date: 2026-08-12
- Status: ACTIVE
- Decided by: AI engineering owner under `DEC-0003` and `AGENTS.md`; recorded
  in TASK-0022 (architecture and SDD rebaseline)
- Affects: current architecture documentation and future implementation
  planning
- Supersedes: only stale architecture prose in `ADR-0002` where the recorded
  decision, source, migration, test, or deployment record supports the
  replacement. It does not supersede `ADR-0002` as the recorded decision that
  established the cloud-deployed premises.

## Decision scope

This ADR records the current, implemented modular-monolith state as a factual
baseline. It does not authorize a physical package refactor, deployment,
server/database mutation, credentials, real data, or any external side effect.

## Verified context

- [VERIFIED] `DEC-0043` cancels local-first; `DEC-0044` prohibits Docker;
  `ADR-0002` (2026-07-27) records the cloud-deployed modular monolith decision:
  Python package `src/crm/`, FastAPI, Jinja2 server-rendered pages, SQLAlchemy
  with PostgreSQL + Alembic, Pydantic boundaries, server-side session auth,
  Uvicorn behind nginx, central `policy` projection layer.
- [VERIFIED] The current source implements that decision: module boundaries,
  entrypoints, persistence/migration path, and the request/application/policy
  flow are documented with citations in `docs/architecture/ARCHITECTURE.md`
  (TASK-0022, 2026-08-12). `tests/test_module_boundaries.py` pins the six
  module packages and the disabled `ai` marker package
  (`src/crm/ai/__init__.py`); `src/crm/config.py` rejects
  `Settings.ai_enabled=True`. The separately implemented TASK-0021 egress seam
  (`src/crm/application/discovery_ai.py`) contains the provider protocol,
  whitelist, and egress-audit fields; the marker test does not cover it and no
  real provider call or production egress configuration is verified by this
  task.
- [VERIFIED] The migration chain reaches `0006_operation_records` (TASK-0018,
  `SPEC-0012`), and 14 mapped tables exist in
  `src/crm/persistence/models.py`.
- [VERIFIED] Recorded deployment history: `DEC-0083` (TASK-0008) and
  `DEC-0087` (TASK-0012) deployed to `https://crm.aibrain.wiki`. Current
  production runtime state is NOT VERIFIED by this task.
- [VERIFIED] The complete approved SPEC baseline is `Status: COMPLETE`
  (`docs/specs/SPEC-BASELINE.md`); 8 approved SPECs with matching approval
  hashes per the governance checker (2026-08-12).

## Decision

1. The current architecture is a cloud-deployed Python modular monolith with
   one central `policy` projection layer, native PostgreSQL + Alembic,
   server-side sessions, and Uvicorn behind nginx — matching `ADR-0002`'s
   decision. Forward-looking or unimplemented prose in `ADR-0002` (for
   example, resource shapes not yet created, or deployment steps not yet
   authorized) is superseded by this current-state record where the record
   supports it; otherwise it remains historical/planned, not current fact.
2. `ADR-0001` remains SUPERSEDED history and is not cited as current authority.
3. Non-decisions: no physical package refactor is authorized; module boundaries
   stay as implemented; production/runtime claims stay NOT VERIFIED until a
   permitted environment check records them.

## Consequences

- Future tasks cite `docs/architecture/ARCHITECTURE.md` and this ADR for the
  implemented baseline instead of re-deriving module facts from prose.
- Any future refactor, deployment, or runtime change requires its own SPEC/
  task/authorization path and does not follow from this ADR.
- Documentation cross-references now agree on the current state; historical
  evidence files retain their own dates and are not rewritten as current
  runtime assertions.

## Verification and rollback

- Verification: `docs/architecture/ARCHITECTURE.md` path/entrypoint/table/
  migration citations, `tests/test_module_boundaries.py`,
  `scripts/check-governance.ps1`.
- Rollback: documentation-only; revert TASK-0022-owned paths. No approved SPEC
  body, approval metadata, or implementation path is touched.
