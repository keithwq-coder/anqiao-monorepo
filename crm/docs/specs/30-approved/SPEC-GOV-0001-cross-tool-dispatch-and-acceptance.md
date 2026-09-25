# SPEC-GOV-0001: Cross-tool dispatch and acceptance evidence

- Spec ID: SPEC-GOV-0001
- Version: 0.4.0
- Status: APPROVED
- Product owner: User
- Prepared by: Codex / requested GPT-5.6-sol architecture role; reconciled to
  the current verdict-only protocol by TASK-0022 (2026-08-12)
- Last updated: 2026-08-24
- Supersedes: none

## 1. Problem

Cross-tool work can appear complete in a model report while the repository
still contains unchanged or contradictory files. Broad retry prompts make this
worse by combining fact reconciliation, mechanical edits, evidence production,
and final acceptance into one large response. The product owner then receives
repeated completion narratives but no dependable repository result.

## 2. Verified context

- [VERIFIED] `AGENTS.md` makes repository files and verification evidence the
  shared source of truth and makes AI tools, not the product owner, responsible
  for cross-tool coordination and output integration.
- [VERIFIED] `DEC-0062` assigns documentation-only `TASK-0006` to Qoder and
  assigns independent acceptance review to Codex.
- [VERIFIED] The Qoder TASK-0006 reports in
  `docs/handoffs/HANDOFF-20260731-QODER-TASK-0006-REVISED.md` claim that several
  control files were corrected, while the current repository versions of
  `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/SPEC-BASELINE.md`, and
  `docs/governance/DEVELOPMENT-SEQUENCE.md` still contained the disputed claims.
  This is the verified historical failure pattern this SPEC governs.
- [VERIFIED] `DEC-0063` keeps Qoder as TASK-0006 owner and requires Codex to
  replace the failed broad dispatch with bounded, deterministic stages.
- [VERIFIED] `DEC-0064` requires the coordinating or reviewing AI to convert
  every cross-tool next action into a complete copy-ready prompt.
- [VERIFIED] `DEC-0065` requires batch-first review, consolidated findings, and
  a bounded correction budget so minor transport defects do not create an
  unbounded sequence of micro-handoffs.
- [VERIFIED] `DEC-0120` establishes the current role split: the architecture
  owner (requested GPT-5.6-sol / Codex) writes one complete PI task prompt and
  independently reviews; GLM or DeepSeek execute one bounded implementation
  task at a time and never self-accept; repository files, tests, runtime
  evidence, and acceptance gates decide the result.
- [VERIFIED] `DEC-0121` transfers TASK-0018 implementation ownership to
  DeepSeek-v4-flash in PI; `DEC-0122` fixes the execution/review protocol:
  the executor runs only the written prompt, and review requires inspecting
  actual repository files, Git state, diff, report, and evidence and rerunning
  named checks; `DEC-0124` makes product-owner communication verdict-only and
  routes prompts and progress through repository handoffs.
- [VERIFIED] `DEC-0125` records TASK-0018 independent acceptance for its local
  synthetic scope only, with PostgreSQL-gated, remote, production, and human
  acceptance boundaries explicitly NOT VERIFIED.
- [UNKNOWN] The exact runtime model identifier of any tool session remains
  unknown unless the active tool exposes it; a requested model label is never
  assumed to be active.

## 3. Goal and success measure

Provide a cross-tool dispatch contract in which each stage has a bounded file
set, a recorded input baseline, executable acceptance checks, and an
independent review. A non-technical product owner can recognize success because
the next tool either produces repository changes that pass the named checks or
reports a specific blocker without claiming completion.

The AI-to-AI prompt is written into a repository handoff by the coordinating
AI. The product owner does not translate findings, reconstruct missing context,
merge reports, or turn a review explanation into instructions for the next
tool.

## 4. Non-goals

- This SPEC does not define CRM product behavior.
- This SPEC does not authorize application, test, deployment, database, or
  real-data changes.
- This SPEC does not transfer TASK-0006 ownership from Qoder to Codex.
- This SPEC does not approve itself or modify any approved product SPEC.
- This SPEC does not establish deadlines, time limits, or model-output limits.

## 5. Users and permissions

- Product owner: supplies product decisions and approves SPECs and sensitive
  operations. Under `DEC-0124`, the product-owner conversation contains only
  the review verdicts; it does not carry prompts, plans, progress, commands,
  tool failures, or model reports. The product owner is never asked to
  transport prompts, compare reports, run commands, or integrate outputs.
- Coordinating AI (architecture owner): defines stages, records authority and
  input evidence, writes complete directly executable PI prompts into
  repository handoffs, and prepares copy-ready correction prompts. It does not
  silently take over the assigned owner's files.
- Execution owner: edits only the current stage's owned files and runs the
  specified checks. The owner reports actual repository changes, command
  results, and evidence; it never self-accepts.
- Independent reviewer: re-reads actual repository files, reruns the checks,
  and issues exactly one verdict
  (`APPROVE_AND_DISPATCH_NEXT_TASK`,
  `REJECT_AND_DISPATCH_CORRECTION_TASK`, or
  `ESCALATE_TO_PRODUCT_OWNER`). A rejection is converted into the next bounded
  execution prompt before it is placed in the repository. The reviewer does not
  rely on the owner's completion narrative.

## 6. Required behavior

- R-001: Every task and every stage has exactly one execution owner.
- R-002: Five files is a default review-size guideline, not a mandatory split.
  A stage may own a larger enumerated set when every file has the same owner,
  authority, fact baseline, rollback boundary, and consolidated acceptance
  sweep. Split only when those boundaries differ or concurrent edits would
  create real integration risk.
- R-003: Every dispatch names the authority, current phase, verified facts,
  unknowns, exact owned files, forbidden files, expected repository result,
  checks, stop conditions, and reviewer.
- R-004: The execution owner reads every owned file before editing it and stops
  if the file is absent or contradicts a higher authority.
- R-005: When Git cannot provide a baseline, the coordinating AI records a
  SHA-256 hash for every owned input in the handoff. The execution owner must
  verify those hashes before editing and report `BLOCKED` on any mismatch.
- R-006: After editing, the execution owner reports the actual SHA-256 of every
  owned file. A claimed edit is invalid when the resulting file content and
  hash do not show the required change.
- R-007: Every stage includes an executable acceptance block that exits nonzero
  for a missing required statement, a forbidden statement, an unchanged
  required target, or a changed path outside the owned set when a changed-path
  audit is available.
- R-008: Actual repository content and command output take precedence over a
  model's prose report, checklist, status badge, or assertion that a command
  passed.
- R-009: If any required edit or check is skipped, cannot run, or fails, the
  execution owner stops with `BLOCKED` or `PARTIAL`. It must not claim that the
  stage or task is complete.
- R-010: Time, context, response-length, or token limits must never be used to
  skip required work and then claim completion. The owner must stop at the last
  verified boundary and identify the remaining item.
- R-011: After a broad dispatch fails, the coordinator must reduce the next
  dispatch into smaller deterministic stages. It must not repeat the same broad
  prompt with additional narrative instructions.
- R-012: The reviewer remains independent and accepts a stage only after
  inspecting actual files and rerunning the named checks.
- R-013: A later stage cannot start until the prior stage is accepted or its
  blocking condition is explicitly resolved.
- R-014: Until independent acceptance, the execution owner's maximum status is
  `HANDOFF-ONLY / AWAITING INDEPENDENT REVIEW`.
- R-015: The product owner must never be asked to compare reports, merge model
  outputs, run commands, or determine whether repository edits really occurred.
- R-016: Command evidence includes the literal command, exit code, and material
  output. A paraphrased result is not acceptance evidence.
- R-017: The coordinating AI writes every next-tool action as one
  self-contained, copy-ready prompt placed in a repository handoff. Review
  commentary outside the prompt must not be required to execute it.
- R-018: A reviewer that returns `REJECT_AND_DISPATCH_CORRECTION_TASK` must
  translate every accepted finding into an exact revision requirement,
  owned-file boundary, forbidden scope, preflight, executable acceptance
  check, stop condition, and required result format. It must not ask the
  product owner to explain the findings to the execution owner.
- R-019: A handoff prompt must be executable without access to the prior chat.
  It names repository authority, current phase, verified facts, unknowns,
  exact paths, hashes when required, and the next acceptance owner.
- R-020: The coordinating AI persists the governing decision, SPEC update, and
  handoff file in the repository before execution begins. Prompts and evidence
  are routed between AI tools through the repository, not through the product
  owner.
- R-021: After the execution owner responds, the independent reviewer must
  either accept the stage or produce the next copy-ready revision prompt. It
  must not leave the product owner with a prose verdict that still needs to be
  operationalized.
- R-022: A review response must not require the product owner to select
  commands, rewrite technical language, decide file ownership, or determine
  which parts of a review should be sent onward.
- R-023: The reviewer must run the complete stage acceptance set before issuing
  a verdict. Findings from that run must be grouped into one consolidated
  correction bundle; the reviewer must not create one handoff per symptom,
  formatting defect, or missing output line.
- R-024: A normal stage has one execution pass and at most one consolidated
  correction pass. This is an attempt budget, not a deadline or schedule.
  Independent evidence checks remain mandatory in both passes.
- R-025: A correction bundle must separate material repository defects from
  transport/report defects. A transport defect must not require re-editing or
  re-baselining files that already passed repository checks.
- R-026: If the same stage still fails after the single correction pass, the
  reviewer records `PARTIAL / ESCALATED`, preserves all verified evidence, and
  sends one escalation decision record to the coordinator. It must not generate
  another micro-handoff for the same stage.
- R-027: Escalation must present at most three options, one recommendation, the
  practical risk, and the exact unresolved evidence. The product owner chooses
  only a business, risk, cost, or irreversible-action decision; the product
  owner does not choose commands or technical repair steps.
- R-028: A stage may be accepted with a separate non-material reporting defect
  only when the repository acceptance checks pass, the defect is explicitly
  recorded as follow-up work, and no approval, security, data, or runtime fact
  is being asserted from the defective report.
- R-029: The coordinator must prefer one larger bounded prompt that covers all
  known corrections over multiple sequential prompts when the target files,
  evidence, and acceptance owner are unchanged.
- R-030: The architecture owner writes a complete, directly executable PI
  prompt before DeepSeek begins a bounded implementation task.
- R-031: DeepSeek's required outputs are the actual repository change, a task
  report, and repository evidence; its prose cannot self-accept the task.
- R-032: The independent reviewer inspects repository files, Git status, diff,
  task report, and evidence and reruns named checks before every verdict.
- R-033: A review verdict is exactly one of
  `APPROVE_AND_DISPATCH_NEXT_TASK`,
  `REJECT_AND_DISPATCH_CORRECTION_TASK`, or
  `ESCALATE_TO_PRODUCT_OWNER`.

## 7. Data and integrations

Inputs are repository authority files, owned target files, decisions, hashes,
and command output. Outputs are handoff files, bounded repository edits, and
review evidence. No external integration or side effect is required. Temporary
hash manifests may be stored outside the repository for the duration of a stage
and must not contain secrets or business data.

## 8. Failure and edge behavior

- If an input hash differs from the handoff baseline, stop as `BLOCKED` and
  identify the path; do not overwrite the newer content.
- If two authority files conflict, stop at the conflict and request the one
  material decision needed.
- If a required check is unavailable, report `NOT VERIFIED`, the reason, and
  the exact remaining command.
- If an edit partially succeeds, preserve the worktree, list the verified
  changes, and report `PARTIAL`; do not broaden the scope to compensate.
- If the execution owner reports completion without matching file evidence,
  the reviewer rejects the stage and the next dispatch must be smaller.
- If a target list is too large for reliable review, split it before execution
  rather than accepting a weaker gate.
- If the coordinating AI writes only findings or explanations into the
  repository handoff and no executable prompt, the cross-tool dispatch has
  failed even when the findings are correct. The failure is that the
  coordinating AI has not written the necessary executable handoff; it is not
  a product-owner failure to carry a message.
- If the handoff prompt depends on omitted chat context, the receiver must stop
  as `BLOCKED`; the coordinator must repair the prompt rather than asking the
  product owner to supply the missing engineering context.
- If multiple findings are discovered in one review, the reviewer must merge
  them into one correction bundle before returning to the execution owner.
- If a stage exceeds its one-pass plus one-correction budget, the reviewer must
  stop the retry loop and record `PARTIAL / ESCALATED`; repeated prompts are not
  an acceptable recovery strategy.
- If repository checks pass but only the response format is defective, the
  reviewer must not re-run file edits. It may issue one read-only consolidated
  response-correction prompt, then apply R-026 if the defect recurs.
- If an external provider (for example the PI provider) is unavailable or
  requires an account/billing action, the coordinator stops and records the
  external boundary; no automatic retry, fallback model, or billing action is
  permitted without a separate explicit decision (`DEC-0126` pattern).

## 9. Acceptance criteria

- AC-001 Given a repository without a Git commit baseline, when a stage is
  dispatched, then the handoff records SHA-256 values for every owned input and
  the owner verifies them before editing.
- AC-002 Given a multi-file documentation task, when work is dispatched, then
  the owned paths are explicitly enumerated and share one authority, owner,
  rollback boundary, and consolidated acceptance sweep; file count alone does
  not force another stage.
- AC-003 Given a required reconciliation, when the owner finishes a stage, then
  an executable acceptance block exits zero and the report includes its actual
  command output and after hashes.
- AC-004 Given a skipped edit or failed check, when the owner reports status,
  then the status is `BLOCKED` or `PARTIAL` and contains no completion claim.
- AC-005 Given an owner completion report, when the reviewer evaluates it, then
  the verdict is based on actual repository contents and rerun commands rather
  than the report's wording.
- AC-006 Given a failed broad dispatch, when the coordinator retries, then the
  new handoff is divided into smaller stages with narrower owned-file sets.
- AC-007 Given a cross-tool handoff, when the result is produced, then no
  engineering integration or command execution is assigned to the product
  owner.
- AC-008 Given a `REJECT_AND_DISPATCH_CORRECTION_TASK` verdict, when the
  reviewer responds, then the response contains a standalone prompt written
  into a repository handoff for the execution owner.
- AC-009 Given a handoff prompt, when the execution owner receives it without
  prior chat, then the prompt contains enough authority, scope, evidence,
  hashes, edits, checks, and stop conditions to execute or report a concrete
  blocker.
- AC-010 Given correct review findings, when no copy-ready next-tool prompt is
  supplied, then the cross-tool handoff is not accepted as complete.
- AC-011 Given an execution-owner response, when further revision is required,
  then the reviewer produces the next bounded prompt without assigning any
  integration step to the product owner.
- AC-012 Given a completed stage response, when the reviewer checks it, then
  all material and transport findings are collected in one review pass before
  any revision prompt is issued.
- AC-013 Given a stage with defects, when a revision is dispatched, then it is
  one consolidated correction pass covering all known defects for that stage.
- AC-014 Given a second failure of the same stage after its correction pass,
  when the reviewer responds, then the status is `PARTIAL / ESCALATED` and no
  third micro-handoff is issued.
- AC-015 Given repository checks that pass and a non-material reporting defect,
  when the reviewer evaluates the stage, then no repository re-edit or hash
  re-baseline is requested solely to repair the report.
- AC-016 Given an escalation, when a product-owner decision is needed, then
  the coordinator presents at most three plain-language options, one
  recommendation, practical consequences, and the unresolved evidence.

## 10. Constraints and safety

- Approved product SPEC bodies and approval metadata remain unchanged unless a
  separate product-owner approval process authorizes a new version.
- Review authority does not imply edit authority over another tool's active
  stage.
- Dirty and untracked worktrees must be preserved; no reset, clean, commit,
  push, deletion, or broad formatting is implied.
- Runtime, server, database, browser, and deployment claims require evidence
  from that environment. Local source cannot prove deployment, and a historical
  decision cannot prove current online state.
- Product-owner communication is verdict-only (`DEC-0124`): prompts, plans,
  progress, tool failures, and model reports stay in repository handoffs and
  evidence.

## 11. Open decisions

None for the required behavior of this SPEC. The product owner approved
SPEC-GOV-0001 v0.4.0 on 2026-08-24 (`DEC-0167`); the SPEC is promoted to
`30-approved` with matching approval metadata.

## 12. References

- `AGENTS.md` - VERIFIED - repository authority, evidence, ownership, and
  handoff rules.
- `docs/decisions/DECISION-LOG.md` (`DEC-0062` through `DEC-0065`) - VERIFIED -
  Qoder ownership, Codex reviewer role, bounded orchestration, prompt-only
  transport responsibility, and the correction budget.
- `docs/decisions/DECISION-LOG.md` (`DEC-0120`, `DEC-0121`, `DEC-0122`,
  `DEC-0124`, `DEC-0125`) - VERIFIED - current role split, PI execution
  protocol, verdict-only product-owner communication, and the TASK-0018
  local-synthetic acceptance boundary.
- `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md` - VERIFIED -
  active documentation/review task that prepared this SPEC for review.
- `docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md` -
  VERIFIED - current example of repository-based independent acceptance with
  explicit NOT VERIFIED boundaries.
- `docs/governance/MODEL-ROUTING.md`, `docs/governance/WORKFLOW.md` - VERIFIED -
  current routing and workflow statements of the verdict-only protocol.
- `docs/evidence/ARCH-20260731-TAKEOVER-REVIEW.md` - VERIFIED - historical
  review findings and evidence boundaries.
- `docs/handoffs/HANDOFF-20260731-QODER-TASK-0006-REVISED.md` - VERIFIED AS
  HISTORICAL REPORT - source of claims that must be checked against files.

## 13. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-001 | Compare handoff SHA-256 baseline with pre-edit file hashes | Local | Stage handoff and reviewer evidence |
| AC-002 | Confirm every owned file is enumerated and shares one authority, owner, rollback boundary, and acceptance sweep | Local | Stage handoff |
| AC-003 | Run the stage-specific PowerShell acceptance block | Local | Owner output and reviewer rerun |
| AC-004 | Inspect status and failed-check output | Local | Stage handoff report |
| AC-005 | Reviewer re-reads files and reruns checks | Local | Independent review evidence |
| AC-006 | Compare failed and replacement handoff scopes | Local | Handoff history |
| AC-007 | Review the owner and user action sections | Local | Handoff and completion report |
| AC-008 | Confirm a rejection response contains a standalone next-tool prompt in a repository handoff | Local | Reviewer evidence and handoff file |
| AC-009 | Execute the prompt in a fresh tool context without prior chat | Receiving tool | Execution preflight output |
| AC-010 | Reject explanation-only reviewer output | Local | Acceptance verdict |
| AC-011 | Confirm any repeated revision is returned as another bounded prompt | Local | Reviewer evidence and handoff history |
| AC-012 | Confirm the reviewer batches all findings before issuing a revision | Local | Reviewer evidence |
| AC-013 | Confirm one consolidated correction pass covers the complete defect set | Local | Handoff and response |
| AC-014 | Confirm a repeated failure becomes `PARTIAL / ESCALATED` without a third micro-handoff | Local | Escalation record |
| AC-015 | Confirm passed repository evidence is not re-edited for a report-only defect | Local | Hash and path audit |
| AC-016 | Confirm escalation presents bounded plain-language decisions | Local | Coordinator decision record |

## 14. Approval

`APPROVED` — v0.4.0

Approved by the product owner on 2026-08-24 (`DEC-0167`), moving this
governance SPEC from `20-review` to `30-approved`. It records the failure
lessons requested by the product owner and the current verdict-only dispatch
protocol. It does not authorize application implementation; it governs how
cross-tool dispatch, execution, and independent acceptance evidence are
recorded and verified. Matching approval metadata:
`docs/specs/30-approved/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.approval.json`.
