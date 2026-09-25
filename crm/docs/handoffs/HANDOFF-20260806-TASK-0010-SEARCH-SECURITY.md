# HANDOFF-20260806-TASK-0010-SEARCH-SECURITY

- Task: TASK-0010 (search security repair and verification)
- From tool/model: coordinator (Kimi Code)
- To tool/model: GLM (assigned by `DEC-0099` on the product owner's
  instruction; supersedes the task card's original DeepSeek proposal;
  executor model identity per self-report or UNKNOWN, never an acceptance
  gate)
- Handoff status: HANDOFF-ONLY
- Repository state: `uncommitted`; relevant paths are the governance records
  added/updated by this activation (see "Changes made") — no application code
  was changed by the coordinator
- Written at: 2026-08-06 (local)

## Required reading

- `AGENTS.md` (full; the non-negotiable start sequence applies to you)
- `docs/specs/30-approved/SPEC-0008-search.md` and
  `docs/specs/30-approved/SPEC-0008-search.approval.json`
- `docs/tasks/active/TASK-0010-search-security-verification.md` (your task
  card; owned paths and completion gate are defined there)
- `docs/decisions/DECISION-LOG.md`: `DEC-0089` (local synthetic sequence
  authorization), `DEC-0097` (TASK-0014 acceptance + sequencing release),
  `DEC-0098` (your ownership release and activation), `DEC-0099` (executor
  assignment to GLM)
- `docs/NOW.md`, `docs/tasks/TASKS.md`
- Context on the read path you will touch:
  `src/crm/application/queries.py` (`QueryService.find_institutions`),
  `src/crm/persistence/repositories.py` (`find_all`),
  `src/crm/policy/` (`project_record`), and the recently accepted
  `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md` (the
  normalization patterns your work must not regress)

## Verified current state

- [VERIFIED] `SPEC-0008 v0.1.0` approval metadata hash matches the current
  SPEC file (recomputed 2026-08-06).
- [VERIFIED] The defect your task repairs: `find_all` in
  `src/crm/persistence/repositories.py:82-89` filters on
  `InstitutionModel.name.ilike(...)` OR
  `InstitutionModel.source_description.ilike(...)` **before** policy
  projection. `source_description` visibility is actor-dependent, so result
  presence/count currently leaks hidden-field existence. Per the task card's
  risk note, post-hoc filtering after a broad hidden-field match is NOT an
  acceptable fix — visibility must be enforced in the searchable predicate
  itself.
- [VERIFIED] All read access flows through `project_record`; your search path
  must stay inside `QueryService.find_institutions` and must not bypass the
  policy layer.
- [VERIFIED] Baseline at handoff: full local suite `205 passed, 28 skipped,
  1 warning`; focused TASK-0014 suite `21 passed`; `compileall` exit 0;
  governance `[PASS]` (all re-run by the coordinator 2026-08-06).
- [VERIFIED] Prerequisites TASK-0007, TASK-0008, TASK-0009, TASK-0014 are all
  ACCEPTED. The actor/role/scope and projection contracts are settled; the
  card's former `[UNKNOWN]` on query strategy is resolved on the card.

## Changes made

Coordinator governance changes only (no application code):

- `docs/decisions/DECISION-LOG.md` — appended `DEC-0097` (TASK-0014 second
  remediation accepted) and `DEC-0098` (TASK-0010 ownership release +
  activation).
- `docs/tasks/active/TASK-0010-search-security-verification.md` — moved from
  `proposed/`; status ACTIVE / IMPLEMENTATION-READY; assumptions and
  prerequisites updated to verified state.
- `docs/tasks/TASKS.md`, `docs/NOW.md` — status synchronized.
- `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md` — created
  (independent audit evidence for the preceding task).

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `pytest tests/test_task0014_core_semantic_security.py -q` | local `.venv`, SQLite fixture | `21 passed` | this audit |
| `pytest tests -q` | local `.venv` | `205 passed, 28 skipped, 1 warning` | this audit |
| `python -m compileall -q src` | local `.venv` | exit 0 | this audit |
| `powershell -File scripts/check-governance.ps1` | local | `[PASS]` | this audit |
| SPEC-0008 approval hash recompute | local | match | `DEC-0098` |

## Failed or not verified

- TASK-0010 itself: NOT STARTED. All `SPEC-0008` AC-001–AC-007 acceptance and
  leakage criteria are unverified.
- 28 skipped tests are the labelled isolated-PostgreSQL gates; they are out of
  scope for this local synthetic task.
- Browser visual acceptance, remote PostgreSQL/SSH, deployment, and real-data
  work remain unauthorized for you.

## Next bounded action

Execute the task card's Step 1: derive the visible-searchable-fields matrix
per actor (owner / other business user / management scope / administrator
exception / unauthorized) from `project_record`, and record it under
`docs/evidence/TASK-0010-*` before writing any search code. Then Steps 2–4 in
order: smallest actor-aware query-path change, negative existence-oracle
tests (they must fail against the old behavior), and hand back for
coordinator independent audit. Stay inside the card's owned paths; any scope
beyond them returns to the SPEC workflow.
