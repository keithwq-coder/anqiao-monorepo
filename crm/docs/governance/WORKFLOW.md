# Human-AI SDD workflow

## Purpose

This workflow turns an imprecise idea into verified software without requiring
the product owner to understand programming frameworks. The current active
documentation/review pass is `TASK-0022` (architecture and SDD rebaseline);
the governance SPEC for cross-tool dispatch is `SPEC-GOV-0001` (v0.4.0,
`20-review`, NOT approved).

## Responsibility model

AI tools are responsible for all engineering execution:

- repository inspection and fact verification;
- SPEC drafting and consistency checking;
- architecture proposals in plain language;
- implementation, tests, debugging, refactoring within approved scope;
- environment setup, commands, logs, migrations, deployment preparation, and
  verification when authorized and technically accessible;
- cross-tool assignment, review reconciliation, and durable handoffs.

The product owner supplies product meaning, chooses material options, approves
SPECs and sensitive actions, and performs business/visual acceptance when human
judgment is essential. The product owner must not be used as a substitute shell
operator, programmer, debugger, release engineer, or multi-model integrator.

If an action genuinely requires the user's identity, account confirmation, a
physical device, or an inaccessible external system, the AI must first complete
everything it can, explain the boundary, and request only the minimal human
action.

## How AI chooses development order

The product owner is not asked to choose a module order. AI derives the order
from the repository evidence using this priority:

1. shared identifiers and domain contracts used by multiple later capabilities;
2. the smallest deterministic vertical slice that can be verified locally;
3. state transitions and history needed by downstream views and automation;
4. manual input/review paths before external ingestion or autonomous actions;
5. automation, scoring, integrations, analytics, and forecasting after their
   source data and failure boundaries are real.

For each proposed order, AI records the dependency, the reason the step is
reversible or bounded, and the gate that proves it is ready for the next step.
This is an engineering proposal, not a product approval request. A product
question is raised only when the order depends on an unknown business meaning,
permission, legal boundary, cost, or irreversible side effect.

## Completion-based planning

This project has no deadline, delivery timeline, ETA, sprint velocity, or
effort estimate. Dates exist only for provenance and audit.

Every plan is an ordered dependency graph expressed as:

| Field | Meaning |
|---|---|
| Prerequisite | Verified condition required before the step starts |
| Action | Bounded work performed by an AI owner |
| Output | Exact repository artifact or runtime result |
| Verification | Command, evidence, or human acceptance procedure |
| Completion gate | Objective condition that allows the next step |
| Status | PENDING, READY, IN PROGRESS, BLOCKED, or PASSED |

A later step does not become valid because time passed. It begins only after
its prerequisites and the prior completion gate are satisfied. Independent
steps may run in parallel only when their owned files and decisions do not
conflict.

## Phase gates

### 1. Discover

AI actions:

- inspect repository facts and relevant source material;
- separate verified facts, inferences, proposals, and unknowns;
- ask one blocking product question at a time;
- put raw notes in `docs/specs/00-inbox/` when persistence is useful.

Allowed output: questions, evidence summaries, and candidate problem framing.
Application edits are forbidden.

### 2. Draft the SPEC

AI actions:

- use `docs/specs/templates/SPEC-TEMPLATE.md`;
- describe behavior and acceptance in plain language before technical design;
- state non-goals and unresolved decisions;
- cite every imported legacy or external statement as unverified until checked.

The file belongs in `10-draft`. Application edits are forbidden.

### 3. Review the SPEC

A SPEC may move to `20-review` only when:

- no placeholder affects product behavior;
- goals, non-goals, rules, failure behavior, and acceptance checks are present;
- material risks and irreversible choices are visible;
- the product owner can understand the decision without knowing code.

The AI gives a decision brief:

```text
Decision needed: <one sentence>
Recommended choice: <one option>
Why: <business effect, cost, risk, reversibility>
Other options: <maximum two>
Still unknown: <facts that remain unverified>
Approval requested: Approve SPEC-xxx version x.y only, or approve and implement TASK-xxx?
```

### 4. Approve

Approval requires an explicit user decision naming the SPEC id/version. The AI
then records the decision, places the final document in `30-approved`, creates
the paired `.approval.json`, and runs the governance checker.

Moving a file is not approval. An approval JSON with a stale hash is invalid.

### 5. Plan and implement

An active task must name:

- one approved SPEC and approval file;
- the exact behavior and file ownership;
- the implementation owner tool/model;
- verification commands and any human checks;
- the user's explicit implementation authorization.

Plans must use prerequisites and completion gates. They must not contain
deadlines, ETAs, duration estimates, or pressure-based shortcuts.

Discovery during implementation may reveal a missing decision. Stop, return to
SPEC review, and preserve the partial work without inventing the answer.

### 6. Verify and hand off

Run the checks named by the SPEC/task. Record exact commands, environments,
results, failures, and unverified areas. Write a handoff whenever another tool
or model will continue the work.

The receiving tool re-runs relevant checks. It does not inherit trust from the
previous model.

### 7. PI execution and independent review

For a bounded implementation task, the architecture owner writes a complete PI
prompt into a repository handoff. DeepSeek executes that prompt, writes
repository evidence and a task report, and never self-accepts. The architecture
owner then inspects actual repository files, Git status, diff, report, and
evidence and reruns the named checks. The review verdict must be exactly one
of:

- `APPROVE_AND_DISPATCH_NEXT_TASK`
- `REJECT_AND_DISPATCH_CORRECTION_TASK`
- `ESCALATE_TO_PRODUCT_OWNER`

The second verdict must include one complete correction prompt written into
the repository. The third is reserved for high risk or a fact that the
repository cannot establish and that requires a product-owner decision, or an
external provider/account boundary (`DEC-0126` pattern). No intermediary
technical explanation is a substitute for a prompt, repository evidence, or
verdict.

### 8. Product-owner communication boundary

During a dispatched checkpoint, do not expose execution progress, task
assignment, prompts, commands, tool failures, raw logs, or model reports in
the product-owner conversation. GPT writes prompts into repository handoffs;
DeepSeek executes them and writes evidence; GPT reviews from the repository.

The product-owner-facing result is only one exact verdict from section 7. A
rejection automatically dispatches its repository correction prompt. Only an
escalation may request one unavoidable business or external-account decision;
it must not transfer technical coordination to the product owner.

## Status language

Use only these completion states:

- `PASSED`: all named checks passed in the stated environment.
- `PARTIAL`: some outputs or checks completed; remaining work is explicit.
- `BLOCKED`: a decision or external condition prevents progress.
- `DRAFT-ONLY`: documentation/proposal work; no implementation authorization.
- `HANDOFF-ONLY`: no claim that the underlying feature is complete.
