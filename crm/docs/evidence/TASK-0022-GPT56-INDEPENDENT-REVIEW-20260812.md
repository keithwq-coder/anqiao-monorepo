# TASK-0022: Codex independent review (2026-08-12)

- Task ID: TASK-0022
- Reviewer: Codex architecture owner / independent reviewer
- Status: REJECTED FOR ONE CONSOLIDATED CORRECTION PASS
- Review authority: `DEC-0120`, `DEC-0122`, `DEC-0124`
- Executor report reviewed: `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`
- Review method: actual repository files, Git status/diff, executor evidence,
  source inspection, and independently rerun checks. The executor report was
  not treated as acceptance evidence.

## Verified review inputs

- `git status --short` shows the task worktree remains dirty and also contains
  pre-existing TASK-0018 implementation and governance changes. No existing
  worktree change was reverted or normalized during review.
- The original TASK-0022 pass created its declared architecture, ADR, review
  SPEC, control-document, card, and evidence artifacts. Those artifacts are
  present in the worktree.
- The local PI execution session used the selector
  `opencode-go/deepseek-v4-flash`; the earlier official-provider selector
  `deepseek/deepseek-v4-flash` is the attempt that returned `402` in
  `DEC-0126`. The gateway selector does not establish the upstream model
  identity or billing/account state.

## Independent checks

| Check | Result |
|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | Exit 0; `[PASS]`; 8 approved SPECs, 19 active tasks |
| `git diff --check` | Exit 0; no whitespace errors (only existing LF/CRLF warnings on TASK-0018 files) |
| `.venv\Scripts\python.exe -m pytest tests/test_module_boundaries.py tests/test_entrypoint.py tests/test_config.py -q` | Exit 0; `18 passed, 1 warning` |
| Source inspection | `main.py`, `config.py`, `database.py`, `models.py`, `policy/projection.py`, `application/discovery_ai.py`, and test files inspected; architecture baseline is materially grounded but has the AI-boundary defect below |

## Material findings

1. `docs/governance/MODEL-ROUTING.md` retains a legacy compact
   product-owner report template requiring `回复“继续”`. This conflicts with
   `DEC-0124` and the same file's verdict-only communication section, which
   prohibits product-owner task coordination.
2. `docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`
   retains the phrase `message carrier` in its failure behavior. Its own
   section 5 says the product owner does not carry prompts, so the review
   candidate is internally inconsistent.
3. `docs/NOW.md`, `docs/tasks/TASKS.md`,
   `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md`, and
   `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md` claim a `direct
   product-owner invocation`. That event is not established by a decision-log
   record and must not be written as fact. The actual PI selector is known;
   authorization and upstream provider identity must not be invented.
4. `docs/architecture/ARCHITECTURE.md` presents the disabled `crm.ai` marker
   package as the full AI boundary, although
   `src/crm/application/discovery_ai.py` implements a separate external-reasoning
   seam. `tests/test_module_boundaries.py` proves the marker is disabled, not
   that every egress path is disabled.

## Required correction

One complete correction prompt is written at
`docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-CONSOLIDATED-CORRECTION.md`.
It has exclusive documentation paths, all four findings, required commands,
and a HANDOFF-ONLY report contract. No application-code, migration, test,
approved-SPEC, decision-log, deployment, or external-state change is allowed.

## Not verified

- A clean independent full-suite rerun was not captured in this reviewer
  session after the documentation pass; the executor's `368 passed, 28
  skipped, 1 warning` report remains self-verification only. The correction
  changes no application code.
- Current production runtime, database, nginx/TLS/DNS/systemd state, real
  provider invocation, and browser/visual/business acceptance remain outside
  this documentation review.

## Review outcome

`REJECT_AND_DISPATCH_CORRECTION_TASK`

The correction is documentation-only and stays within the one-correction-pass
budget. It will be dispatched to the configured PI selector; a further
material failure will be escalated under `DEC-0122`.
