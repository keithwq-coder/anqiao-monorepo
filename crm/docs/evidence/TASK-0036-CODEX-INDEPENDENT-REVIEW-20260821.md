# TASK-0036 Codex independent review

- Reviewer: Codex (substitute independent reviewer at product-owner request)
- Review date: 2026-08-21 Asia/Shanghai
- Scope: local synthetic-data implementation only, under `DEC-0154`
- Approved SPECs: `SPEC-0002 v0.4.0`, `SPEC-0014 v0.3.0`
- Review boundary: no production migration, production cleanup, commit, push, or deployment

## Verdict

**PASS (local synthetic-data scope).**

The implementation aligns with the approved role and credential behavior: the
`agent` role is removed from the domain/persistence authorization surface;
administrator full-read behavior no longer requires a reason; general-manager
views remain desensitized; transfer-to-pool and credential self-service actors
match the approved SPECs; and the phone field remains present.

## Evidence

- Focused tests covering role, projection, admin behavior, credentials,
  persistence, migrations, and the TASK-0037/0038 integration surface passed:
  `86 passed, 1 skipped`.
- Full local regression: `395 passed, 28 skipped, 2 warnings` (exit code 0).
- `python -m compileall -q src tests migrations`: exit code 0.
- `git diff --check`: exit code 0.
- `scripts/check-governance.ps1`: `[PASS]`, 8 approved SPECs and 37 active tasks.

## Not verified

- PostgreSQL-gated migration/runtime behavior.
- Production migration or cleanup of any historical `agent` grant.

This is an independent review record. It does not change the task card's
formal acceptance status.
