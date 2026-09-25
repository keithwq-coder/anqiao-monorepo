# GLM-5.2 handoff - TASK-0009 remediation

- Task: TASK-0009
- From: coordinator
- To: GLM-5.2 (sole implementation executor)
- Handoff status: HANDOFF-ONLY / READY FOR MESSAGE RELAY
- Authority: DEC-0089 and DEC-0090; user-directed executor reassignment
- Audit evidence: docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md
- Repository state: uncommitted and broadly untracked; preserve all existing files

## Message to forward verbatim

You are GLM-5.2, the sole implementation executor for the TASK-0009
remediation. The coordinator independently audited the previous delivery and
did not accept it. Do this bounded remediation only. Do not start TASK-0014.
The product owner only relays this message and your structured report; they do
not edit files, run commands, merge changes, or decide acceptance.

### Mandatory preflight and stop rule

Read in full:

1. AGENTS.md
2. docs/NOW.md
3. docs/PROJECT.md
4. docs/specs/INDEX.md
5. docs/specs/SPEC-BASELINE.md
6. docs/decisions/DECISION-LOG.md, especially DEC-0089 and DEC-0090
7. docs/tasks/active/TASK-0009-integration-test-baseline.md
8. docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md
9. the actual source files and tests named by the task

If src/crm/web/main.py, templates/, or another path outside TASK-0009 owned
paths must be changed, stop immediately and report:

BLOCKED: OWNERSHIP-RELEASE-REQUIRED

Do not edit out-of-scope files. Do not delete tests, weaken assertions, add
unconditional skips, change governance gates, or turn a real failure into
fabricated evidence.

### Single bounded target

Within TASK-0009 allowed paths, establish a reproducible dependency and
integration-test baseline and resolve these audit findings:

1. Make the dependency truth source match the environment. pyproject.toml
   declares jinja2, but pip check reports missing installation metadata.
   fastapi==0.136.3 and installed starlette==0.44.0 do not satisfy the
   declared constraint. Choose the smallest reproducible fix using current
   package metadata and project declarations, then actually run pip check.
   Do not choose versions from memory.
2. Investigate the first full-suite failure in
   tests/test_s5_pages_api_parity.py::test_non_owner_page_and_api_masked_identically.
   The test passed alone and three later full runs passed, but that does not
   prove determinism. Determine whether shared app state, isolation, collection
   order, or the real implementation is responsible. Fix only in TASK-0009
   owned test/runner/fixture paths. If main.py, templates, or business logic
   must change, stop and report the ownership conflict.
3. Provide repeatable command output for the actual TemplateResponse count in
   src/crm/web/main.py and the installed Starlette version. The audit observed
   23 call sites and Starlette 0.44.0; the previous report claimed 24 and 1.0.0.
   Explain the discrepancy; do not rewrite history.
4. List every path changed by this task. The eight files under
   backup/legacy-scripts/ are not an explicit TASK-0009 destination. Keep an
   archive change only with source paths, stale classification, hashes, and
   reversible restore evidence; otherwise stop and report an ownership conflict.
   Do not delete original or unknown files.

### Allowed paths

Only dependency declarations/lock artifacts, tests and the test runner,
evidence files named docs/evidence/TASK-0009-*, and the TASK-0009 card may be
changed. A root test-script archive is allowed only with evidence-preserving
classification and reversibility. Do not edit src/crm/web/main.py, templates,
domain/policy/persistence/migration files, deployment files, or remote
resources unless the coordinator first resolves the ownership blocker.

### Required verification

Use the repository .venv and PYTHONPATH=src. Record real output for:

- python -m pip check
- dependency/lock files and installed package versions
- focused tests and repeat runs proving isolation/order stability
- powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
- python -m compileall -q src tests when Python files are involved

Do not access remote PostgreSQL/SSH, deploy, migrate production, mutate real
data, change credentials, use paid services, or perform external writes.

### Required report (exact structure)

```text
Task: TASK-0009
Status: PASSED | PARTIAL | BLOCKED
Executor: GLM-5.2
Owned paths changed:
- path: exact change and why it is in TASK-0009

SPEC/task mapping:
- TASK-0009 acceptance item: evidence and test name

Commands actually run:
- command | environment | exit/result | evidence path

Tests and results:
- focused tests: N passed, N failed, N skipped
- full local suite: exact count and repeatability result
- pip check: exact result
- governance: exact [PASS] or failure output

Failed, skipped, or NOT VERIFIED:
- reason and exact remaining check

Scope and safety:
- no deployment/remote DB/real-data/external write: YES or explain stop
- no out-of-scope paths changed: YES or list every conflict

Risks and rollback:
- concrete risk and reversible rollback point

Next bounded action:
- STOP: coordinator audit required; do not start TASK-0014
```

Do not claim TASK-0014 started or that all SPECs are complete. The coordinator
will re-check paths, dependency metadata, test isolation, the full suite, and
governance before activating any successor task.
