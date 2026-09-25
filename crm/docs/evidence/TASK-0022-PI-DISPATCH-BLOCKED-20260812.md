# TASK-0022 PI dispatch boundary (2026-08-12)

- Task ID: TASK-0022
- Status: BLOCKED before repository execution
- Review outcome: `ESCALATE_TO_PRODUCT_OWNER`
- Requested executor: DeepSeek-v4-flash in PI
- Authority: `DEC-0120`, `DEC-0122`, `DEC-0124`, `DEC-0125`

## Dispatch evidence

The complete bounded prompt is stored in
`docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.

| Check | Result |
|---|---|
| `pi --model deepseek/deepseek-v4-flash --approve -p @docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md "Execute exactly the PI execution prompt in the attached handoff. Perform the repository task, then return only the specified TASK_REPORT."` | Exit 1; provider returned `402 Insufficient Balance` before repository execution. |
| Git working tree recheck | No TASK-0022 executor output, architecture document, ADR, review SPEC move, task report, or TASK-0022 execution evidence was produced by the failed PI invocation. |

## Boundary

Restoring provider balance, changing a provider, entering credentials, or making
an account/billing action is an external account action. It is outside the
repository and cannot be performed or inferred by the architecture reviewer.
No fallback model is authorized for this task.

## Not verified

- All TASK-0022 documentation deliverables and completion checks.
- Any PI model execution or actual runtime model identifier.

## Required external decision

`ESCALATE_TO_PRODUCT_OWNER`: restore the PI DeepSeek provider's available
balance/access, or explicitly authorize a different executor/provider for this
task. Until one of those external choices is made, TASK-0022 remains blocked.
