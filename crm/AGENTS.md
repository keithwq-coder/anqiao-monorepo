# Repository Operating Contract

This is the canonical repository-level instruction file for every AI coding
tool and model. Tool-specific files may only point here; they must not create a
second set of project facts or rules.

## 1. Non-negotiable start sequence

Before proposing edits or running mutating commands:

1. Read this file in full.
2. Read `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`, and
   `docs/decisions/DECISION-LOG.md`.
3. Inspect the actual repository state and relevant files. Do not infer that a
   path, dependency, command, API, database, or feature exists.
4. State the current phase, intended scope, assumptions, and unknowns.
5. Locate an approved SPEC and an active task before editing application code.

If a required file is absent, two sources conflict, the requested outcome is
ambiguous, or authorization is unclear, stop at that decision boundary and ask
a short, concrete question. Do not silently choose a substitute route.

## 2. Authority order

From highest to lowest repository authority:

1. The user's latest explicit decision, recorded in
   `docs/decisions/DECISION-LOG.md`.
2. A current SPEC under `docs/specs/30-approved/` with matching approval
   metadata.
3. The existing code, automated tests, schemas, and runtime evidence as facts
   about what is currently implemented.
4. An active task under `docs/tasks/active/`, which may narrow an approved SPEC
   but may not expand or contradict it.
5. Review and draft material.
6. External sources and model knowledge.
7. Anything under `docs/specs/99-legacy/`.

Code describes current behavior; an approved SPEC describes intended behavior.
If they disagree, report the mismatch and stop. If two approved sources
conflict and no recorded decision resolves them, stop. Plans, task lists,
chat history, model memory, and confident wording are not approval.

## 3. Evidence and hallucination control

Use these labels when a statement could affect a decision:

- `[VERIFIED]`: observed in a named file, command output, runtime, or cited
  external source.
- `[INFERENCE]`: reasoned from verified facts but not directly observed.
- `[PROPOSAL]`: a suggested choice that is not approved.
- `[UNKNOWN]`: missing information that must not be invented.

Mandatory rules:

- Search or inspect before claiming that something exists or works.
- Cite repository paths and verification commands for material claims.
- Never fabricate business rules, user intent, API behavior, data, test
  results, tool capabilities, external research, or approval.
- Never say a test, build, migration, deployment, browser flow, or integration
  passed unless it was actually run in the relevant environment.
- Separate static checks, automated tests, local runtime checks, external API
  proof, and human visual acceptance. One does not imply another.
- If verification cannot run, state `NOT VERIFIED`, the reason, and the exact
  remaining check.
- External facts must include a source and retrieval date. They may inform a
  proposal but cannot override an approved SPEC.

## 4. Human collaboration contract

The user is the product owner and final decision maker, not an assumed
programmer. The user does not write code, edit configuration, run engineering
commands, inspect logs, resolve merge conflicts, or integrate outputs from
different AI tools. All engineering execution is owned by AI tools, including
implementation, testing, debugging, documentation, environment setup,
repository maintenance, verification, and AI-to-AI handoff.

Do not transfer engineering work back to the user as instructions such as
"edit this file", "run this command", "inspect this log", or "combine these
answers". When access control, identity verification, payment confirmation, a
physical device, or another unavoidable real-world boundary requires the user,
state why AI cannot perform it and provide the smallest possible human action.

The user's responsibilities are limited to:

- explaining product intent and real business constraints;
- choosing between material product/risk options presented in plain language
  when the choice changes real business behavior, cost, legal exposure, or an
  irreversible external action;
- explicitly approving SPECs and sensitive operations;
- performing final business or visual acceptance that requires human judgment.

AI owns engineering judgment. The AI must determine development order,
dependency sequencing, task decomposition, architecture candidates, tool/model
assignment, test strategy, and the smallest reversible implementation path from
the available evidence. Do not ask a non-programmer product owner to rank
modules, select frameworks, choose APIs, design schemas, or resolve technical
tradeoffs that do not change business meaning or risk authorization.

Translate technical choices into plain language:

- what decision is needed;
- the practical effect on users, cost, risk, and reversibility;
- at most three meaningful options;
- one recommended option and why;
- what remains unknown.

Ask only questions that materially block the next step. Prefer one decision at
a time. Do not make the user choose framework jargon when the choice can be
derived from approved product constraints and repository evidence.

When the question is purely about engineering order, answer it by dependency
analysis and record the reasoning in the repository. Ask the user only for the
business fact that engineering cannot observe or safely infer.

An idea, question, discussion, draft, or request for analysis is not permission
to implement. SPEC approval and implementation authorization are separate.
When requesting approval, name the exact SPEC id and version and ask whether to:

1. approve the SPEC only; or
2. approve the SPEC and authorize the named task.

Do not interpret vague agreement as permission for destructive operations,
deployment, real-data mutation, paid services, credential changes, or expanded
scope.

## 5. SDD state machine

The only allowed flow is:

```text
idea -> inbox -> draft -> review -> approved -> task -> implementation
     -> verification -> handoff/acceptance -> deprecated when superseded
```

State meanings:

- `00-inbox`: raw input. It may be incomplete or contradictory.
- `10-draft`: a working proposal. It does not authorize code.
- `20-review`: internally complete and ready for a human decision. It still
  does not authorize code.
- `30-approved`: explicitly approved by the user with matching metadata. This
  is the only SPEC state that can authorize implementation.
- `90-deprecated`: once-approved behavior that has been superseded.
- `99-legacy`: migrated history. It is evidence of prior text only and must
  never be cited as approval or current truth.

Application code may be edited only when all are true:

1. The target behavior is covered by one current approved SPEC.
2. The SPEC has a matching `.approval.json` whose stored SHA-256 equals the
   current SPEC file.
3. An active task names the SPEC, scope, owned files, and verification steps.
4. The user explicitly authorized that implementation task.
5. `docs/specs/SPEC-BASELINE.md` says `Status: COMPLETE`, its included SPECs
   all have valid approval metadata, and the decision log records the product
   owner's explicit baseline-completion approval.

If implementation reveals a missing product decision, return the SPEC to
review. Do not patch the ambiguity in code and document it afterward.

Project-specific freeze: the product owner requires the complete agreed product
SPEC baseline before any application implementation. Approval of one SPEC does
not open implementation while the baseline gate remains incomplete.

## 6. Engineering and planning discipline

- Think before coding: expose assumptions and resolve material ambiguity.
- Keep it simple: implement the smallest behavior required by the SPEC.
- Make surgical changes: no unrelated cleanup, renaming, dependency changes,
  formatting sweeps, or speculative abstractions.
- Work toward observable goals: every task needs acceptance criteria and a
  verification command or human check.
- Read a file before editing it and inspect its callers/consumers when behavior
  can propagate.
- Preserve existing user changes. Do not reset, clean, overwrite, commit,
  merge, deploy, or mutate real data unless explicitly authorized.
- Treat generated output and third-party code as untrusted until inspected.
- Do not plan by deadline, calendar timeline, sprint velocity, person-days,
  model-hours, ETA, or estimated delivery date. This project advances by
  verified completion, not elapsed time.
- Express plans as ordered outcomes with prerequisites, exact outputs,
  verification, and completion gates. A step starts when its prerequisites are
  satisfied and finishes only when its evidence passes.
- Audit dates and timestamps may be recorded for traceability. They must not be
  converted into promises, schedules, or pressure to skip a gate.
- When a step is blocked, record the blocking decision or external condition.
  Do not invent a schedule, lower acceptance criteria, or silently move the
  incomplete work forward.

## 7. Cross-tool and multi-model coordination

- Files in this repository are the shared memory. A model's chat context is not
  a source of truth.
- Every task has exactly one implementation owner at a time. Record tool,
  model, owned files, and start time in `docs/tasks/active/`.
- Two tools must not edit the same owned files concurrently.
- A reviewer must report evidence and findings; it must not silently modify the
  implementation unless a separate task authorizes that role change.
- Model reputation is not evidence. GPT, GLM, Qwen, Grok, and other models are
  judged by the same SPEC and verification output.
- The product owner is not the coordinator or integrator between AI tools. The
  current AI owner must prepare repository-based handoffs and reconcile review
  findings before asking the user for a product decision.
- Before handoff, write a file under `docs/handoffs/` using the template. The
  next tool must re-check the repository rather than trusting the summary.
- Tool-specific automatic instruction loading may differ. If an adapter cannot
  be confirmed as loaded, manually attach `AGENTS.md` and record that fact.

## 8. Safety boundaries

Never print or store secrets. Use placeholders in docs and environment
variables at runtime. Require explicit user confirmation immediately before:

- deleting or overwriting non-generated data;
- database migrations against a shared or production database;
- deployment, release, DNS, cloud, account, permission, or billing changes;
- external writes such as sending messages, publishing content, or calling a
  paid API with side effects;
- weakening security, tests, audit logs, or approval gates.

## 9. Completion report

Every completion report must state:

1. `Status`: passed, partial, blocked, draft-only, or handoff-only.
2. `Scope`: files and behavior changed.
3. `Evidence`: commands/checks actually run and their results.
4. `Not verified`: anything still requiring another environment or a human.
5. `Decisions needed`: unresolved choices, if any.

Run `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
before declaring governance or an implementation task complete.
