# TASK-0039: Legacy v0.3.0 reminder cleanup

- Task ID: TASK-0039
- Status: ACTIVE / ACCEPTED (local synthetic-data scope; `DEC-0157`)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
- Implementation authorization: `DEC-0156`
- Execution owner: Codex
- Review/acceptance owner: Codex, with product-owner acceptance after evidence
- Scope: local synthetic-data cleanup only
- Depends on: `TASK-0038`, `DEC-0156`, and approved `SPEC-0003 v0.4.0`

## Goal

Remove the superseded v0.3.0 reminder workflow so the repository has one
opportunity path: v0.4.0 candidates with human adjudication.

## Owned scope

- Remove old reminder runtime model/repository/service/AI adapter, old routes,
  old template surface, and obsolete TASK-0020/TASK-0021 tests.
- Add a forward Alembic migration dropping `opportunity_reminders` and its
  indexes; do not edit historical migrations.
- Update schema/table assertions and imports so the v0.4.0 candidate flow is
  unchanged.

## Non-goals

- No real crawler or external model call; OD-006a remains unresolved.
- No production migration, real-data mutation, deployment, commit, or push.

## Verification

- Focused candidate/security tests pass.
- Full `pytest -q` passes with only documented environment-gated skips.
- `python -m compileall -q src tests migrations` passes.
- `git diff --check` passes.
- `scripts/check-governance.ps1` passes.

## Prerequisites and completion gate

- Approved SPEC and matching approval metadata are present.
- `DEC-0156` explicitly authorizes this local cleanup.
- No production, real-data, external-model, or crawler action is performed.
- All verification commands above pass and the legacy runtime references are
  absent from `src`, `templates`, and `tests`.
