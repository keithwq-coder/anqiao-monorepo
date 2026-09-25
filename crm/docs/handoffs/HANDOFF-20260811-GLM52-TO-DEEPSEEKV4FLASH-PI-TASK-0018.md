# HANDOFF-20260811: TASK-0018 implementation transfer to DeepSeek-v4-flash in PI

- Task: TASK-0018
- From tool/model: GLM5.2 (WorkBuddy), predecessor implementation owner
- To tool/model: DeepSeek-v4-flash in PI, requested executor label; record the
  exact PI runtime identifier if exposed, otherwise record `UNKNOWN`
- Handoff status: READY FOR PI EXECUTION
- Repository state: `main`, uncommitted predecessor implementation changes
- Written at: 2026-08-11 Asia/Shanghai
- Authorization: `DEC-0089` scope; ownership transfer `DEC-0121`
- Independent reviewer: Codex architecture owner under `TASK-0022`

## PI execution prompt

```text
You are the sole implementation owner for TASK-0018 in
D:\Project\中科安樵\crm. Execute the task; do not only explain how it could be
done.

Authority and phase:
- Read AGENTS.md, SPEC-0012 and its approval JSON, the active TASK-0018 card,
  and DEC-0089, DEC-0120, DEC-0121, DEC-0122 before editing.
- This is one bounded local-synthetic implementation/reconciliation pass.
- Your report is not acceptance. Codex independently reviews the repository.

Owned implementation paths:
- deploy/ non-secret templates and local validation helpers only
- scripts/ bounded local health, rollback, and backup evidence helpers only
- operations/audit modules under src/crm/ required by SPEC-0012
- focused operational tests under tests/
- docs/evidence/TASK-0018-* and the active TASK-0018 card

Current predecessor candidates to inspect, not trust:
- src/crm/persistence/models.py
- tests/test_persistence_schema.py
- migrations/versions/0006_operation_records.py
- scripts/check_operations_health.py
- scripts/operations_evidence.py
- src/crm/persistence/operation_repository.py
- tests/test_task0018_operations.py
- docs/evidence/TASK-0018-IMPLEMENTATION.md

Do not edit approved SPECs or approval JSON, other task evidence, unrelated
application paths, or Codex-owned architecture/governance documents. Preserve
all unrelated dirty and untracked files.

Hard boundaries:
- No SSH, remote server, nginx, TLS, DNS, systemd, deployment, production or
  shared database mutation, real data, credentials, external product-side AI
  call, commit, push, reset, clean, delete, or broad formatting.
- Never print or store secrets. Do not infer browser, product-owner, runtime,
  or production acceptance from local checks.

Required execution:
1. Capture git status --short --branch and inspect the actual diff.
2. Reconcile the predecessor candidates against all four TASK-0018 required
   acceptance rules and SPEC-0012. Retain correct work; fix only verified
   defects in owned scope.
3. Run and record actual results for:
   - focused TASK-0018 tests;
   - a scoped no-secret scan of all TASK-0018 deliverables;
   - full pytest tests/ regression;
   - powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1;
   - git diff --check.
4. Write docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md containing:
   current Git status; exact changed paths; literal commands, exit codes, and
   material output; requirement-to-evidence mapping; failures; NOT VERIFIED
   boundaries; the actual PI model identifier if exposed, otherwise UNKNOWN.
5. Update the TASK-0018 card only with factual self-verification. Do not write
   ACCEPTED and do not modify task ownership.

Final response format, and nothing else:
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, result per line>
evidence: docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

## Required reading

- `AGENTS.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/tasks/active/TASK-0018-deployment-operations-evidence.md`
- `docs/decisions/DECISION-LOG.md` (`DEC-0089`, `DEC-0119`, `DEC-0120`, and
  `DEC-0121`)

## Verified current state

- The approved SPEC hash is
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`.
- TASK-0018 remains active and local-only. Its required behavior is fail-closed
  local operational evidence, durable local audit records, no stored secrets,
  and a strict distinction between automation and human acceptance.
- The current predecessor candidate paths are:
  `src/crm/persistence/models.py`, `tests/test_persistence_schema.py`,
  `migrations/versions/0006_operation_records.py`,
  `scripts/check_operations_health.py`, `scripts/operations_evidence.py`,
  `src/crm/persistence/operation_repository.py`,
  `tests/test_task0018_operations.py`, and
  `docs/evidence/TASK-0018-IMPLEMENTATION.md`.
- The predecessor reports 19 focused tests and a 360 passed / 28 skipped full
  suite. These reports are not independent acceptance evidence. Reproduce
  rather than trust them.

## Scope and non-goals

Implement or correct only the existing TASK-0018 scope: non-secret local
validation helpers, local operations/audit modules, focused tests, and
TASK-0018 evidence. Preserve unrelated dirty changes.

Do not edit approved SPECs or approval metadata. Do not use SSH, contact any
remote server, deploy, mutate a production database, use real data, handle
credentials, call an external service, commit, or push. Do not claim browser,
business, or production acceptance.

## Required execution order

1. Capture `git status --short --branch` and inspect the predecessor diff.
2. Reconcile every candidate change against SPEC-0012 and the TASK-0018
   acceptance criteria. Preserve correct work; correct only verified defects
   within the task scope.
3. Run focused TASK-0018 tests, an appropriate no-secret scan, the full test
   suite, and `powershell -ExecutionPolicy Bypass -File
   scripts/check-governance.ps1`. Report actual commands and output, including
   any unavailable checks.
4. Update only TASK-0018 evidence and task status with factual results. Do not
   mark the task accepted.
5. Return one concise completion handoff to Codex containing changed paths,
   actual checks, remaining NOT VERIFIED boundaries, and any defect that needs
   a consolidated correction pass.

## Acceptance boundary

Codex independently rechecks the final diff and relevant test/governance
results. PASS from the executor is self-verification only. The task becomes
`ACCEPTED` only after the independent review finds no unresolved material
defect. Remote operations and product-owner visual/business acceptance remain
`NOT VERIFIED` even if all local tests pass.
