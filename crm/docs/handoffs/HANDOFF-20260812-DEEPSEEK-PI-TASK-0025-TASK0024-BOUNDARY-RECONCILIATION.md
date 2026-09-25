# HANDOFF-20260812: TASK-0025 TASK-0024 boundary reconciliation

- Task: TASK-0025
- From tool/model: Codex architecture/review owner
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE LOCAL DOCUMENTATION CORRECTION PASS
- Repository state: `main`, intentionally dirty; preserve all existing work
- Written at: 2026-08-12 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for TASK-0025 in
`D:\Project\中科安樵\crm`. Other work already exists in this dirty worktree.
Do not revert, overwrite, normalize, delete, or claim changes outside the
exclusive owned paths below. Your maximum outcome is `HANDOFF-ONLY`; Codex is
the only reviewer and acceptance decision-maker.

Before editing, read in full:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0124`, `DEC-0129`, and
  `DEC-0130`
- `docs/governance/MODEL-ROUTING.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0024-w5-read-only-production-preflight.md`
- `docs/tasks/active/TASK-0025-task0024-boundary-incident-reconciliation.md`
- `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0024-W5-READ-ONLY-PREFLIGHT.md`
- `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md`
- `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md`

State your phase, scope, assumptions, and unknowns internally before editing.
Do not ask the product owner to run commands, compare reports, or make an
engineering choice.

Exclusive writable paths:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0024-w5-read-only-production-preflight.md`
- `docs/tasks/active/TASK-0025-task0024-boundary-incident-reconciliation.md`
- `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md`
- `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md`
- `docs/evidence/TASK-0025-DEEPSEEK-PI-CORRECTION-20260812.md`

All other paths are read-only. Do not edit the decision log, handoffs, SPECs,
approval JSON, architecture, application code, tests, migrations, scripts,
deployment files, or configuration.

Hard prohibition: this is a local documentation correction only. Do not run
SSH, DNS, HTTPS, curl, remote shell, network probes, production reads, log
access, database access, deployment/migration/service commands, or any
external write. Do not read or print credentials or secrets. Do not reset,
clean, checkout, restore, mutate stashes, commit, push, merge, broadly format,
or delete evidence.

Verified defect to reconcile:

- `DEC-0129` and the TASK-0024 handoff forbid log-body reading.
- The recorded commands include
  `journalctl -u anqiao-crm --no-pager -q -o cat | wc -l` and
  `journalctl -u anqiao-crm --no-pager -q -o short-iso | cut ...`.
- Even though only counts/timestamps reached the saved evidence, the pipelines
  caused log records and message text to be read and processed before
  aggregation. Therefore statements that no log body was read are false or
  materially incomplete. The access already occurred and cannot be undone.

Required work:

1. Inspect actual Git status and diffs without changing unrelated work.
2. Preserve the exact commands, results, and chronology. Never erase the audit
   trail or claim that documentation repairs the external access.
3. Correct the two TASK-0024 evidence files. Add a prominent review/correction
   notice and replace absolute no-log-body claims with the accurate boundary:
   no message text is evidenced as printed or stored in repository evidence,
   but message text was read and processed inside the pipelines.
4. Reconcile NOW, TASKS, TASK-0001, and TASK-0024 to say TASK-0024 is
   `NOT ACCEPTED / PARTIAL - BOUNDARY INCIDENT RECORDED`, not awaiting a clean
   acceptance. Preserve useful non-log observations only as an unaccepted
   snapshot. Do not claim its fail-closed conditions all passed.
5. Update TASK-0025 to `HANDOFF-ONLY / AWAITING CODEX INDEPENDENT REVIEW`.
6. Create
   `docs/evidence/TASK-0025-DEEPSEEK-PI-CORRECTION-20260812.md` containing:
   Status, Scope, exact changed paths, the corrected fact, commands/checks and
   exit codes, Not verified, Decisions needed, a no-network/no-remote
   statement, and `awaiting: CODEX_INDEPENDENT_REVIEW`.
7. Keep W5 release execution, G7, V1, and R2 pending and separately
   unauthorized. Do not draft or dispatch another production task.

Required local verification:

- `git status --short`
- scoped `git diff --` for every owned existing path
- scoped `rg` over all owned paths for `journalctl`, `log body`, `TASK-0024`,
  `not accepted`, `W5`, `G7`, `V1`, and `R2`
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
- `git diff --check`

If any required correction needs an unowned path, remote evidence, secret,
network call, production access, destructive action, or broader authorization,
stop and report `BLOCKED`. Do not work around the boundary.

Return only this contract after writing the repository evidence:

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one line per path>
checks: <one line per command with exit code and concise result>
evidence: docs/evidence/TASK-0025-DEEPSEEK-PI-CORRECTION-20260812.md
not_verified: <one line per remaining item>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

Never output secrets, raw logs, business data, a release prompt, or an
acceptance verdict.
