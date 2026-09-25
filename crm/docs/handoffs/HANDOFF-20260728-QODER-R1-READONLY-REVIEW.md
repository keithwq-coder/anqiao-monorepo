# HANDOFF-20260728-QODER-R1-READONLY-REVIEW

- Task: `TASK-0001` / R1 eligibility and independent foundation review
- From tool/model: Codex / GPT-5.6-sol
- To tool/model: Qoder International / user-designated `qwen3.8max-prview`
- Handoff status: HANDOFF-ONLY
- Repository state: uncommitted; preserve the dirty worktree and do not commit,
  push, clean, reset, delete, restore, or overwrite files
- Written at: 2026-07-28 Asia/Shanghai

## Required reading

Before any command, manually attach `AGENTS.md` as the Qoder project rule. The
automatic loading of `QODER.md` is not verified. Report whether each of these
files was actually loaded:

- `AGENTS.md` and `QODER.md`
- `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`, and
  `docs/specs/SPEC-BASELINE.md`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0044` through `DEC-0050`
- `docs/tasks/TASKS.md` and
  `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- all approved SPEC files and `.approval.json` files under
  `docs/specs/30-approved/`
- `docs/evidence/TASK-0001-S2-foundation.md`,
  `docs/evidence/TASK-0001-S3-policy-projection.md`,
  `docs/evidence/TASK-0001-GR1-w3-recovery.md`, and
  `docs/evidence/TASK-0001-GR2-permission-repair.md`
- `src/crm/config.py`, `src/crm/domain/`, `src/crm/persistence/`,
  `src/crm/policy/`, `migrations/`, and the complete `tests/` directory

## Verified current state

- [VERIFIED] `TASK-0001` remains active. S1, W1, W2, W3, S2, S3, GR1, and GR2
  are recorded as passed; R1, S4, S5, S6, G5, and W4 remain pending.
- [VERIFIED] GR2 is complete only within `DEC-0050`: it repaired runtime-file
  traversal and validated the service identity's database connection. It did
  not authorize an application migration, release, service, nginx, TLS, DNS,
  legacy-site change, or any application code modification.
- [VERIFIED] `DEC-0050` requires a new task authorization before application
  repair or implementation resumes. This handoff is not that authorization.
- [VERIFIED] Current source contains unaccepted S4-S6-era artifacts. A local
  collection-only run stopped at `tests/test_s6_integration.py` because
  `Settings()` lacks four required database values. A targeted S4 test run
  produced `3 failed, 7 errors, 10 passed`; the failures include undefined
  `argon2_settings` and a constructor/test signature mismatch. These outcomes
  are evidence for review only, not permission to repair.
- [VERIFIED] `powershell -NoProfile -ExecutionPolicy Bypass -File
  scripts/check-governance.ps1` passed in this handoff preparation with seven
  approved SPECs, one active task, and one checked legacy manifest.

## Changes made

- The active task and task index were synchronized with the existing GR2
  evidence and `DEC-0050` boundary.
- This handoff assigns only a read-only eligibility and R1 review. No
  application, migration, test, deployment, server, or decision file changed.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `.venv\\Scripts\\python.exe -B -m pytest -q -p no:cacheprovider --collect-only` | local repository | BLOCKED during collection by missing runtime database settings in `test_s6_integration.py` | local command output, 2026-07-28 |
| `.venv\\Scripts\\python.exe -B -m pytest -q -p no:cacheprovider tests\\test_s4_authentication.py` | local repository | FAIL: 3 failed, 7 errors, 10 passed | local command output, 2026-07-28 |
| `.venv\\Scripts\\python.exe -m pip check` | local repository | PASS: no broken requirements | local command output, 2026-07-28 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\check-governance.ps1` | local repository | PASS | local command output, 2026-07-28 |

## Required Qoder output

1. Identify the actual Qoder model identifier and confirm the required files
   were loaded.
2. Declare whether this Qoder instance authored or edited any S2/S3 foundation
   code, tests, migrations, or policy code. If it did, it is not eligible to
   issue the independent R1 verdict and must stop after a read-only scope
   inventory.
3. If eligible, perform R1 as a read-only review of the approved S2/S3
   foundation. Include SPEC/decision/task mapping, fail-closed configuration,
   domain/ORM/migration parity, idempotency and deterministic ordering, policy
   projection/default-deny behavior, test effectiveness, synthetic-only scope,
   and the unaccepted later-artifact boundary.
4. Lead with findings ordered by severity. Every finding needs an absolute path
   and line number. End with exactly one `R1 verdict: PASS` or `R1 verdict:
   FAIL`. A PASS is allowed only with no unresolved finding.
5. Do not edit files, create evidence, update task status, run migrations,
   access the Tencent server, read secret-bearing files, start an application,
   call an external service, or attempt to fix any defect. Return the review
   report to the coordinating agent.

## Failed or not verified

- R1 has not passed and no independent reviewer identity has yet been verified.
- S4-S6 do not have accepted evidence and their current code/tests are not a
  valid basis for advancing the task.
- Tencent migration, synthetic seed, release, systemd, nginx, TLS/DNS, legacy
  cutover, real data, external AI, and human acceptance remain unauthorized or
  not verified as recorded in the active task.

## Next bounded action

Perform only the read-only R1 eligibility/review above. If the verdict is
`FAIL`, do not repair the code. The coordinating agent will consolidate the
findings and request the separate new task authorization required by
`DEC-0050` before any repair work is assigned.
