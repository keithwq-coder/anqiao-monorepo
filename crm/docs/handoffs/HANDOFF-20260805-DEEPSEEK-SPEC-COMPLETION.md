# HANDOFF-20260805-DEEPSEEK-SPEC-COMPLETION

- Task: approved SPEC completion sequence (`TASK-0009` through `TASK-0018`)
- From tool/model: coordinator
- To tool/model: DeepSeek (implementation executor)
- Handoff status: HANDOFF-ONLY / READY FOR MESSAGE RELAY
- Repository state: uncommitted; all repository paths are currently
  untracked, so preserve the worktree and do not reset or clean it
- Written at: 2026-08-05 +08:00
- Authority: `DEC-0089`

## Message to forward verbatim

You are the sole implementation executor for this repository's approved-SPEC
completion sequence. The coordinator will independently audit every result.
The product owner only relays this message and your report; do not ask the
product owner to edit files, run commands, merge changes, or resolve conflicts.

### Mandatory first action: governance preflight

Before editing anything, read in full:

1. `AGENTS.md`
2. `docs/NOW.md`
3. `docs/PROJECT.md`
4. `docs/specs/INDEX.md`
5. `docs/specs/SPEC-BASELINE.md`
6. `docs/decisions/DECISION-LOG.md`, especially `DEC-0089`
7. the selected approved SPEC and matching `.approval.json`
8. the selected task card under `docs/tasks/`
9. actual source files and existing tests named by that task

Run a read-only ownership check. The worktree is uncommitted and contains
pre-existing files. Do not use `git reset`, `git checkout`, `git clean`, broad
formatting, or deletion to make it look clean. If a path is still owned by an
active/accepted task, stop before editing and report `BLOCKED:
OWNERSHIP-RELEASE-REQUIRED` with the conflicting task and path.

### Non-negotiable scope

- Implement only approved SPECs `SPEC-0001` through `SPEC-0013` listed in the
  roadmap. `SPEC-0014` is draft-only and must not be implemented.
- Use local synthetic fixtures/data only.
- Never deploy, SSH, access remote PostgreSQL, run a production migration,
  mutate real data, change credentials, call paid services, send external
  messages, or change DNS/TLS/nginx/systemd without a separate decision.
- Do not weaken assertions, convert failed tests to skips, or claim a pass from
  static inspection.
- If an approved SPEC, decision, task card, and source behavior conflict, stop
  and report the conflict. Do not invent a business rule.
- Keep one implementation task active at a time. Finish and report the current
  task before touching the next task's owned paths.

### Execution order and task boundaries

Follow `docs/evidence/SPEC-COMPLETION-ROADMAP-20260805.md` exactly:

1. `TASK-0009` integration/dependency baseline
2. `TASK-0014` core semantic and write-authorization closure
3. `TASK-0010` actor-aware search security
4. `TASK-0015` user/role/ownership management
5. `TASK-0017` lifecycle/erasure and propagation evidence
6. `TASK-0011` reusable synthetic batch import
7. `TASK-0016` opportunity discovery
8. `TASK-0018` local operations evidence

For each task, edit only the task card's owned paths. Do not bundle unrelated
cleanup or UI redesign. A database model/migration is allowed only when the
approved SPEC and task card explicitly require durable state; otherwise stop
and report why it is needed.

### Required implementation discipline

- Inspect callers and consumers before changing shared behavior.
- Add a focused negative test for every security/visibility defect before
  declaring it fixed.
- Preserve the central server-side policy projection; page, search, API, and
  management views must not create browser-only authorization.
- Keep personal/protected values out of audit records, evidence, logs, and test
  output.
- Record engineering defaults and any stop condition in the task evidence.

### Required report after every task

Return one report per task, using this exact structure:

```text
Task: TASK-XXXX
Status: PASSED | PARTIAL | BLOCKED
Executor: DeepSeek (model identifier only if actually known)
Owned paths changed:
- absolute or repository-relative path: exact behavior change

SPEC mapping:
- SPEC-XXXX R-xxx / AC-xxx: evidence and test name

Commands actually run:
- command | environment | result | evidence path

Tests and results:
- focused tests: N passed, N failed, N skipped
- full local suite: exact result or NOT RUN
- governance: exact `[PASS]`/failure output from
  `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`

Failed, skipped, or NOT VERIFIED:
- include the reason and the exact remaining check

Safety and scope confirmation:
- no deployment/remote DB/real-data/external write: YES or explain stop
- no out-of-scope paths changed: YES or explain stop

Risks and rollback:
- concrete risk and reversible rollback point

Next bounded action:
- one next task only, or `STOP: product/authorization decision required`
```

Do not write `PASSED` if any acceptance criterion is unverified. A report is
not an acceptance decision; the coordinator will re-read the source, rerun the
checks, inspect the diff/content, and decide `ACCEPTED`, `PARTIAL`, or
`REJECTED`.

## Verified current state supplied to DeepSeek

- `docs/specs/SPEC-BASELINE.md` says `Status: COMPLETE`; that means the SPEC
  baseline is complete, not that all application behavior is implemented.
- Local evidence currently records `183 passed, 28 skipped` and governance
  `[PASS]`; this is a baseline to reproduce, not proof of future changes.
- `TASK-0008` and `TASK-0012` are accepted/deployed but still retain active
  task-card history and browser acceptance notes. Ownership must be checked
  before reusing their paths.
- Existing proposed cards `TASK-0009`, `TASK-0010`, and `TASK-0011` must be
  re-read and their owned paths honored.
- `SPEC-0014` at `docs/specs/10-draft/` is not part of this handoff.

## Coordinator audit contract

After the report arrives, the coordinator will independently:

1. re-check the worktree and exact changed paths;
2. compare implementation to the approved SPEC, approval hash, task card, and
   decision log;
3. run focused tests, `pytest tests/ -q`, and the governance check as applicable;
4. inspect for hidden-field leakage, unauthorized writes, skipped assertions,
   secrets, migrations, remote calls, and scope drift;
5. write `docs/evidence/TASK-XXXX-ACCEPTANCE.md` only if evidence supports it;
6. activate the next task only after recording the prior task's verdict and
   ownership release.

Do not treat this handoff, a DeepSeek self-report, or a green partial test run
as final acceptance.
