# TASK-0009: Dependency lock and integration-test baseline

- Task ID: TASK-0009
- Status: ACTIVE / ACCEPTED (coordinator audit 2026-08-06; `DEC-0092`)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Also governed by: all approved SPECs exercised by the accepted workflow
- Implementation authorized by: `DEC-0089` (local synthetic implementation
  sequence only); activated by `DEC-0090`
- Implementation owner: GLM-5.2 (user-directed reassignment for bounded remediation;
  model identity is user-provided and implementation evidence is still required)
- Coordinator/auditor: current coordinator
- Depends on: `TASK-0007`, `TASK-0008`; ownership release confirmed by
  `DEC-0090`

## Goal

Establish a reproducible dependency and integration-test baseline that proves
the currently accepted core workflow and security boundaries before further
SPEC implementation expands the codebase.

## Scope and owned paths

- `pyproject.toml` and any existing lock/constraints artifact strictly required
  for one dependency truth source;
- `tests/test_s6_integration.py`, `tests/test_s6_e2e_auth.py`, and new bounded
  integration fixtures/tests;
- test-runner scripts required for deterministic local execution;
- obsolete root test scripts only after evidence-preserving classification;
- `docs/evidence/TASK-0009-*` and this task card.

## Non-goals

- No product feature behavior change except a documented minimal testability
  hook that does not change production behavior.
- No weakening assertions, blanket skips, passing on login/search failure,
  deployment, remote testing, or real-data test.

## Current assumptions and unknowns

- [VERIFIED] Existing local evidence records `183 passed, 28 skipped`; the
  executor must reproduce it rather than treat it as current proof.
- [UNKNOWN] Whether dependency declarations, lock artifacts, and legacy root
  test scripts form one coherent current truth source; inspect before changing.
- [UNKNOWN] Whether stale integration modules remain; collection and mutation
  checks, not filenames, decide this task's scope.

## Required acceptance and verification

- Produce one compatible dependency truth source and report `pip check`.
- Full collection and local suite have no stale import/contract failures.
- Integration tests target current routes/contracts and include effective
  negative or mutation checks for authentication and core write boundaries.
- Run focused tests, full `pytest tests/ -q`, and
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`.
- Report exact commands/results, failed/skipped checks, and evidence paths.
- Coordinator independently reviews test effectiveness before accepting or
  activating a successor task.

## Prerequisites and completion gate

- Prerequisites: `DEC-0089` and `DEC-0090`; TASK-0007/TASK-0008 focused gates
  remain the baseline; the coordinator has released conflicting local path
  ownership. No remote or production authorization is implied.
- Completion gate: one dependency truth source, clean `pip check`, current
  test collection, full local suite, effective negative/mutation evidence,
  governance `[PASS]`, and a structured DeepSeek report. Human visual
  acceptance and remote/production checks remain separate and `NOT VERIFIED`.

## Ordered steps

| Step | Action | Completion evidence |
|---|---|---|
| 1 | Inventory dependency and test truth sources | Version/source matrix |
| 2 | Apply smallest compatible dependency/test-runner correction | Clean install and `pip check` |
| 3 | Repair stale integration tests against current contracts | Collection and focused pass/fail proof |
| 4 | Run full suite and targeted mutation checks | Exact output and evidence |
| 5 | Submit structured DeepSeek report | Coordinator audit handoff |

## Evidence and result

- Status: ACCEPTED (GLM-5.2 remediation; coordinator audit `DEC-0092`)
- Prior executor (DeepSeek) report was not accepted per
  `docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md`.
- GLM-5.2 remediation evidence:
  `docs/evidence/TASK-0009-GLM52-REMEDIATION-20260806.md` and
  `docs/evidence/TASK-0009-LEGACY-SCRIPTS-ARCHIVE-MANIFEST.md`.
- Coordinator independently verified: focused parity/write tests 4 passed;
  mutation test 1 passed; full suite 184 passed, 28 skipped, 1 warning in
  5/5 repeated runs; pip check clean; dev-test.ps1 and check-governance.ps1
  [PASS]; compileall exit 0; 23 TemplateResponse matches; 8/8 legacy hashes.
- Coordinator acceptance record:
  `docs/evidence/TASK-0009-COORDINATOR-ACCEPTANCE-20260806.md`.
- Not verified: browser visual acceptance; remote/production checks.
