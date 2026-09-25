# TASK-0038 Codex independent review

- Reviewer: Codex (substitute independent reviewer at product-owner request)
- Review date: 2026-08-21 Asia/Shanghai
- Scope: local synthetic-data implementation only, under `DEC-0154`
- Approved SPEC: `SPEC-0003 v0.4.0`
- Review boundary: no real crawler, external model call, cross-border egress, production migration, commit, push, or deployment

## Verdict

**PARTIAL (local synthetic-data scope).**

The new candidate model, two candidate sources, human adjudication, retention
metadata, leak scanning, GM desensitized management view, and crawler-candidate
pool landing are implemented and covered by tests. The task remains partial
because the legacy v0.3.0 reminder infrastructure is still present and the
real crawler/model provider path remains disabled behind OD-006a.

## Evidence

- `tests/test_task0038_opportunity_candidates.py` and related security/policy
  tests passed; the focused TASK-0037/0038 set completed `19 passed`.
- Full local regression: `395 passed, 28 skipped, 2 warnings` (exit code 0).
- `python -m compileall -q src tests migrations`: exit code 0.
- `git diff --check`: exit code 0.
- `scripts/check-governance.ps1`: `[PASS]`, 8 approved SPECs and 37 active tasks.

## Required follow-up before task completion

1. Remove or separately authorize cleanup of the legacy reminder routes,
   service, table, and tests.
2. Resolve OD-006a before enabling any real crawler, external model provider,
   or cross-border egress.

Production migration and real external-source behavior remain unverified and
unauthorized. This is an independent review record. It does not change the
task card's formal acceptance status.
