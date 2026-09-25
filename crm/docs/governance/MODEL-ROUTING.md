# Cross-model execution routing

- Status: ACTIVE
- Authority: `DEC-0120`, `DEC-0121`, `DEC-0122`, `DEC-0124`, `DEC-0125`
- Last updated: 2026-08-12
- Applies first to: active `TASK-0022` documentation/review pass; `TASK-0018`
  is ACCEPTED for its local synthetic scope only (`DEC-0125`)

## Recommended operating model

Use model specialization without transferring technical coordination to the
product owner:

| Role | Preferred tool/model | Responsibility |
|---|---|---|
| Architecture owner | Requested GPT-5.6-sol / Codex | Write one complete PI task prompt, set boundaries and acceptance mapping, and own high-risk escalation |
| Implementation owner | DeepSeek-v4-flash in PI | One bounded task pass, actual repository edits, task report, and evidence; never self-accepts |
| Independent reviewer | Requested GPT-5.6-sol / Codex | Inspect actual files, Git state, diff, evidence and report; rerun named checks; issue exactly one execution outcome |

The exact model labels and availability in each tool are [UNKNOWN] until the
relevant tool session reports them. Model reputation is not evidence; every
output must pass the same repository checks.

## Checkpoint loop

1. GPT writes one self-contained, directly executable PI prompt with authority,
   owned files, current evidence, non-goals, checks, evidence paths, stop
   conditions, and a report contract.
2. DeepSeek in PI re-reads the named repository authority, changes only the
   owned paths, runs the required checks, and writes its report plus evidence.
3. GPT independently inspects Git status, actual files, diff, DeepSeek's report
   and evidence, then reruns the named tests and governance checks.
4. GPT emits exactly one verdict: `APPROVE_AND_DISPATCH_NEXT_TASK`,
   `REJECT_AND_DISPATCH_CORRECTION_TASK`, or `ESCALATE_TO_PRODUCT_OWNER`.
5. A rejection includes the next complete PI correction prompt. A repeat
   material failure after that single correction pass becomes
   `ESCALATE_TO_PRODUCT_OWNER`; the product owner never integrates reports.

The product owner is not asked to assess code quality, compare reports, or
transport engineering information. After independent review, the only normal
product-owner-facing response is exactly one of:

- `APPROVE_AND_DISPATCH_NEXT_TASK`
- `REJECT_AND_DISPATCH_CORRECTION_TASK`
- `ESCALATE_TO_PRODUCT_OWNER`

The product owner is never asked to reply with a continue word, copy a prompt,
manage a retry, or carry findings between AI tools. Source code, full logs,
secrets, raw business data, and detailed internal progress are not exposed in a
product-owner report. Full technical evidence stays in the repository for the
next AI tool.

## Product-owner communication boundary

`DEC-0124` supersedes any earlier product-owner-facing progress-report
template. The product owner is not an execution coordinator. During a checkpoint, GPT does
not stream task plans, PI prompts, model availability, command output,
debugging, task reports, handoff details, or progress messages to the product
owner. These belong in repository evidence and the PI handoff for DeepSeek.

After independent review, the only normal product-owner-facing outcome is one
of these exact verdicts:

- `APPROVE_AND_DISPATCH_NEXT_TASK`
- `REJECT_AND_DISPATCH_CORRECTION_TASK`
- `ESCALATE_TO_PRODUCT_OWNER`

`REJECT_AND_DISPATCH_CORRECTION_TASK` automatically includes a complete next
PI prompt in the repository and is dispatched by GPT; it does not ask the
product owner to compare model output, copy a prompt, run a command, or manage
the retry. `ESCALATE_TO_PRODUCT_OWNER` may state only the one business, risk,
or irreversible external decision that AI cannot make. Full technical evidence
stays in the repository for the next AI tool.

## Failure and hallucination control

- Each checkpoint has one implementation owner and exclusive owned paths.
- A tool must report the model it actually used; a requested model name is not
  assumed to be active.
- A checkpoint is not complete merely because files changed. Its named checks
  must pass, or its report must say `PARTIAL` or `BLOCKED`.
- GLM may repair technical defects inside the current checkpoint without asking
  the product owner to make engineering choices.
- A missing business rule, authorization, real-data boundary, external write,
  paid action, or irreversible action stops at the repository gate.
- An external provider unavailability or account/billing boundary stops the
  checkpoint and is recorded as an escalation/blocker (`DEC-0126`); no
  automatic fallback model or billing action is permitted.
- GPT review findings are written to repository evidence. The current
  implementation owner reconciles them; the product owner does not merge or
  compare model outputs.
- Handoffs use `docs/handoffs/HANDOFF-TEMPLATE.md`, and the receiving model
  re-runs relevant checks rather than trusting the summary.

## Key-node review gates for TASK-0001

1. **Foundation gate:** domain facts, local persistence, revisions/audit, and
   permission projections pass their focused tests.
2. **Usable-flow gate:** organization, contact, activity, history, masking, and
   failure paths work through local page/API tests.
3. **Closure gate:** all TASK-0001 acceptance checks, local smoke, restart
   persistence, evidence, and governance checks pass.

GPT review at a key node is a quality gate, not permission to expand the
approved SPEC or use real data, external models, or deployment.
