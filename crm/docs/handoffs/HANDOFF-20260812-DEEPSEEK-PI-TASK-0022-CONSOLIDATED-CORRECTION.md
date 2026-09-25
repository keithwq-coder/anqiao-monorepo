# HANDOFF-20260812: TASK-0022 consolidated documentation correction to DeepSeek in PI

- Task: TASK-0022
- From: Codex architecture owner / independent reviewer
- To: DeepSeek-v4-flash in PI through the configured OpenCode Go provider
- Handoff status: READY FOR THE ONE ALLOWED CORRECTION PASS
- Repository state: `main`, intentionally dirty; preserve all existing work
- Authority: `DEC-0120`, `DEC-0122`, `DEC-0124`, and the TASK-0022 execution
  protocol. This is the single correction pass permitted by `DEC-0122`.

## PI execution prompt

```text
You are the sole documentation-execution owner for the one consolidated
TASK-0022 correction pass in D:\Project\中科安樵\crm. Make the corrections in
the repository. Do not provide only an explanation. Your maximum outcome is
HANDOFF-ONLY; Codex remains the independent reviewer and only acceptance
decision-maker.

Read in full before editing:
- AGENTS.md
- docs/NOW.md
- docs/PROJECT.md
- docs/specs/INDEX.md
- docs/decisions/DECISION-LOG.md, especially DEC-0120, DEC-0122, DEC-0124,
  DEC-0125, DEC-0126
- docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md
- docs/governance/MODEL-ROUTING.md
- docs/governance/WORKFLOW.md
- docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md
- docs/architecture/ARCHITECTURE.md
- docs/decisions/ADR-0003-current-cloud-modular-monolith.md
- docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md
- this handoff in full

Current phase and scope:
- TASK-0022 is documentation/review only.
- This is one correction pass for factual and workflow-document defects found
  by independent review. It does not modify application behavior, approve a
  SPEC, or authorize external activity.
- Preserve the dirty worktree. Do not reset, clean, delete, commit, push,
  deploy, access SSH/server/nginx/TLS/DNS/systemd, mutate a database, use real
  data or credentials, call an external AI, or print/store secrets.

Exclusive owned paths for this correction:
- docs/NOW.md
- docs/architecture/ARCHITECTURE.md
- docs/decisions/ADR-0003-current-cloud-modular-monolith.md
- docs/governance/MODEL-ROUTING.md
- docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md
- docs/tasks/TASKS.md
- docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md
- docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md
- docs/evidence/TASK-0022-DEEPSEEK-PI-CORRECTION-20260812.md

Do not edit any other path. In particular, do not edit README.md,
docs/PROJECT.md, docs/decisions/DECISION-LOG.md, an approved SPEC or approval
JSON, the 10-draft SPEC-GOV pointer, any existing handoff, application code,
tests, migrations, deploy scripts, or TASK-0018-owned paths.

Correct all findings below in one pass:

1. `docs/governance/MODEL-ROUTING.md` still has a legacy compact
   product-owner template that ends in `需要你做：回复“继续”...`. This directly
   conflicts with DEC-0124 and the document's own verdict-only section.
   Remove the entire obsolete compact template. The document must instead say
   that the only normal product-owner-facing response is exactly one of:
   `APPROVE_AND_DISPATCH_NEXT_TASK`,
   `REJECT_AND_DISPATCH_CORRECTION_TASK`, or
   `ESCALATE_TO_PRODUCT_OWNER`. Do not ask the product owner to reply
   `继续`, copy a prompt, manage a retry, or transport engineering information.

2. `docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`
   still says `message carrier` in its failure behavior even though its users
   section says the product owner never carries prompts. Replace that failure
   case with repository-routed wording: the failure is that the coordinating
   AI has not written the necessary executable handoff, not that a product
   owner failed to carry a message. Preserve the rule IDs and the review-ready,
   NOT APPROVED status.

3. The following files falsely state that the successful pass was executed
   under a `direct product-owner invocation`:
   `docs/NOW.md`, `docs/tasks/TASKS.md`,
   `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md`, and
   `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.
   Remove that claim everywhere. Do not invent, amend, or reinterpret a user
   authorization. The factual record is: the initial PI attempt named the
   official `deepseek/deepseek-v4-flash` provider and returned 402 before
   repository execution (DEC-0126); the completed pass used the configured
   PI selector `opencode-go/deepseek-v4-flash`. This identifies the PI gateway
   selection only; it does not prove or claim the upstream model identity,
   provider billing state, or a new decision-log authorization. Keep the task
   `HANDOFF-ONLY` and awaiting Codex review.

4. `docs/architecture/ARCHITECTURE.md` misstates the `crm.ai` marker package
   as the whole AI boundary being `hard-disabled until a later authorized
   task`. The source also contains the separately implemented
   `src/crm/application/discovery_ai.py` egress seam from TASK-0021. Correct
   the architecture baseline and, if needed for consistent consequence prose,
   ADR-0003:
   - `src/crm/ai/__init__.py` is a disabled marker (`AI_ENABLED = False`), and
     `Settings.ai_enabled=True` is rejected by `src/crm/config.py`.
   - `src/crm/application/discovery_ai.py` separately contains the implemented
     provider protocol, whitelist, and egress-audit fields.
   - `tests/test_module_boundaries.py` proves the marker package is disabled;
     it does not prove that every possible egress path is unavailable.
   - No real provider call or current production egress configuration is
     verified by this task.
   Do not claim the external AI seam is either enabled in production or absent.

5. Update the original TASK-0022 execution evidence with a concise correction
   note that supersedes its corrected factual claims. Write the separate
   correction evidence file with changed paths, each finding-to-fix mapping,
   actual commands and exit codes, provider/model-selection boundary, and NOT
   VERIFIED boundaries. Do not write ACCEPTED or change any decision log.

Run and record actual commands, exit codes, and material results:
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
- git diff --check
- .venv/Scripts/python.exe -m pytest tests/test_module_boundaries.py tests/test_entrypoint.py tests/test_config.py -q
- a focused `rg` over the correction-owned documents proving there is no
  `回复“继续”`, `message carrier`, `direct product-owner invocation`, or
  `hard-disabled until a later authorized task` statement
- inspect `src/crm/ai/__init__.py`, `src/crm/config.py`, and
  `src/crm/application/discovery_ai.py` to support the corrected AI boundary
  text

Final response format, and nothing else:
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, result per line>
evidence: docs/evidence/TASK-0022-DEEPSEEK-PI-CORRECTION-20260812.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

## Independent-review basis

- [VERIFIED] `scripts/check-governance.ps1` passed during independent review:
  8 approved SPECs and 19 active tasks.
- [VERIFIED] `git diff --check` passed during independent review.
- [VERIFIED] Independent focused tests passed: `18 passed, 1 warning`.
- [VERIFIED] The original pass's documentation contains the four consolidated
  defects listed above. Correcting them requires documentation only.

## Completion boundary

Return one factual HANDOFF-ONLY, PARTIAL, or BLOCKED report. Codex will again
inspect actual repository files, Git state, diff, evidence, and rerun the
named checks. A remaining material defect after this correction pass is
escalated; do not begin a third pass.
