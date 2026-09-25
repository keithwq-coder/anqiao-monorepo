# HANDOFF-20260728-S4R-READONLY-AUDIT

- Task: `TASK-0001` / independent read-only audit of the DEC-0051 local S4
  authentication repair
- From tool/model: Qoder (S4R repair owner, this session)
- To tool/model: user-designated Claude Code or Codex instance
- Handoff status: HANDOFF-ONLY
- Repository state: uncommitted (the repository has no commits yet); preserve
  the dirty worktree and do not commit, push, clean, reset, delete, restore,
  or overwrite files
- Written at: 2026-07-28 Asia/Shanghai

## Required reading

Report whether each of these files was actually loaded:

- `AGENTS.md`
- `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0050` and `DEC-0051`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/evidence/TASK-0001-R1-independent-review.md`
- `docs/evidence/TASK-0001-S4R-local-auth-repair.md`
- The repaired and adapted files:
  `src/crm/web/auth.py`, `tests/test_s4_authentication.py`,
  `src/crm/web/routes/auth.py`, `src/crm/web/main.py`,
  `scripts/create-admin.py`, `tests/test_s6_integration.py`
- The domain invariant source: `src/crm/domain/models.py`
- Dependency truth: `pyproject.toml`

## Verified current state

- [VERIFIED] `DEC-0051` authorized a local-only S4 authentication repair with
  acceptance = the S4 test suite passing locally with synthetic data. It did
  not authorize S5/S6 acceptance, server writes, migration, release, DNS/TLS,
  real data, external AI calls, commit, or push.
- [VERIFIED] The repair owner rewrote `src/crm/web/auth.py` and adapted the
  five call-site files listed above. Full change description:
  `docs/evidence/TASK-0001-S4R-local-auth-repair.md`.
- [VERIFIED] `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider
  tests\test_s4_authentication.py` → `20 passed` (was 3 failed / 7 errors /
  10 passed before the repair).
- [VERIFIED] Regression excluding the pre-broken S6 module reported
  `64 passed, 1 skipped, 3 errors`; the 3 errors are pre-existing S5-era
  defects in `src/crm/web/main.py` (circular import with
  `crm.web.routes.auth`; `app` used at line 98 before its definition).
- [VERIFIED] `scripts/check-governance.ps1` → PASS after all document
  updates.

## Changes made

- Application repair under `DEC-0051` as described in
  `docs/evidence/TASK-0001-S4R-local-auth-repair.md`.
- Governance records: `DEC-0051` in the decision log, R1 evidence file, S4R
  evidence file, and task-card status updates.
- This handoff assigns only a read-only audit. The auditor must not modify
  any file.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\test_s4_authentication.py` | local repository | PASS: 20 passed | local command output, 2026-07-28 |
| `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\ --ignore=tests\test_s6_integration.py` | local repository | 64 passed, 1 skipped, 3 errors (pre-existing S5-era) | local command output, 2026-07-28 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | local repository | PASS | local command output, 2026-07-28 |

## Required auditor output

1. Identify the auditing tool/model and confirm the required files were
   loaded.
2. Declare whether this auditor instance authored any part of the S4R repair.
   If it did, it is not eligible and must stop after a scope inventory.
3. Audit the repair against these checkpoints:
   a. `hash_password`/`verify_password` correctness and consistency with the
      domain `$argon2id$` invariant in `src/crm/domain/models.py`;
   b. no hard-coded secrets or silent fallback paths remain in
      `src/crm/web/auth.py`;
   c. fail-closed behavior: generic error for unknown user vs wrong password,
      disabled-account rejection, lockout after the configured threshold,
      CSRF one-time consumption, session expiry/invalidation;
   d. timezone-aware timestamps throughout;
   e. audit logging never records passwords, hashes or token values;
   f. the adapted call sites match the new synchronous single-return API;
   g. test effectiveness: the 20 tests actually exercise the claimed
      behavior and are not weakened (no removed assertions, no tautologies);
   h. scope discipline: no change outside the `DEC-0051` boundary, and the
      pre-existing S5-era defects were left untouched as claimed.
4. Re-run locally, read-only side effects only:
   `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\test_s4_authentication.py`
   and
   `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\ --ignore=tests\test_s6_integration.py`
   and report the exact output.
5. Lead with findings ordered by severity (High/Medium/Low/Info). Every
   finding needs an absolute path and line number. End with exactly one
   `S4R audit verdict: PASS` or `S4R audit verdict: FAIL`. A PASS is allowed
   only with no unresolved High or Medium finding.
6. Do not edit files, create evidence, update task status, run migrations,
   access any server, read secret-bearing files, start the application, call
   an external service, or attempt to fix any defect. Return the audit report
   to the user, who will relay it to the coordinating agent.

## Failed or not verified

- The full S4 gate (command/query owner-write scope) is not passed; only the
  authentication repair sub-task is complete.
- `tests/test_s6_integration.py` still fails at collection and
  `tests/test_s6_integration_simple.py` has 3 errors, both from pre-existing
  S5-era defects in `src/crm/web/main.py`; repairing them is not authorized.
- Tencent migration, release, systemd, nginx, TLS/DNS, legacy cutover, real
  data, external AI, and human acceptance remain unauthorized.

## Next bounded action

Perform only the read-only S4R audit above. If the verdict is `FAIL`, do not
repair anything; the coordinating agent will reconcile the findings and, if
needed, request further authorization from the product owner before any new
repair is assigned.
