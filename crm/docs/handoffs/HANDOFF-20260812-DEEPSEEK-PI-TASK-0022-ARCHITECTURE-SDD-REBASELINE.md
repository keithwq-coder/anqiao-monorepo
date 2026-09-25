# HANDOFF-20260812: TASK-0022 architecture and SDD rebaseline to DeepSeek in PI

- Task: TASK-0022
- From tool/model: Codex architecture owner and independent reviewer
- To tool/model: DeepSeek-v4-flash in PI
- Handoff status: READY FOR ONE DOCUMENTATION/REVIEW PASS
- Repository state: `main`, dirty worktree preserved; no commit or push
- Written at: 2026-08-12 Asia/Shanghai
- Authority: `DEC-0120`, `DEC-0122`, `DEC-0124`, and the product owner's
  current cross-model direction. This task changes no approved product behavior.

## PI execution prompt

```text
You are the sole documentation-execution owner for one bounded TASK-0022 pass
in D:\Project\中科安樵\crm. Execute the task in the repository; do not only
describe a plan. Your report is HANDOFF-ONLY. Codex remains the independent
architecture reviewer and the only acceptance decision-maker.

Read before editing, in full:
- AGENTS.md
- docs/NOW.md
- docs/PROJECT.md
- docs/specs/INDEX.md
- docs/decisions/DECISION-LOG.md, especially DEC-0120, DEC-0121, DEC-0122,
  DEC-0124, and the new DEC-0125
- docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md
- docs/tasks/TASKS.md
- docs/governance/MODEL-ROUTING.md
- docs/governance/WORKFLOW.md
- docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md
- docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md
- docs/handoffs/HANDOFF-TEMPLATE.md
- this handoff in full

State in your evidence: current phase, exact documentation scope, assumptions,
and unknowns. Inspect the real working tree before writing. The repository is
dirty: preserve every existing change and untracked file.

Confirmed starting facts:
1. TASK-0018 is ACCEPTED only for local synthetic operations evidence under
   DEC-0125. PostgreSQL migration round trip, remote/deployment behavior,
   production/shared-data backup/restore, live rollback, and product-owner
   visual/business acceptance remain NOT VERIFIED.
2. TASK-0022 is an active DOCUMENTATION / REVIEW task. It must not change
   application behavior or accept an implementation from executor prose.
3. `docs/PROJECT.md` reports a cloud-deployed Python modular monolith, while
   `README.md` and control indexes contain older or conflicting status prose.
   Resolve factual contradictions only when the named source, migration, test,
   or recorded decision supports the replacement; otherwise label UNKNOWN or
   historical. Do not invent a current production/runtime fact.
4. There is no current `docs/architecture/` directory. Create only factual
   architecture baseline documents from current source, migrations, approved
   SPECs, tests, and recorded decisions.

Exclusive owned paths for this pass:
- README.md
- docs/NOW.md
- docs/PROJECT.md
- docs/architecture/**
- docs/decisions/ADR-0003-current-cloud-modular-monolith.md
- docs/governance/MODEL-ROUTING.md
- docs/governance/WORKFLOW.md
- docs/specs/INDEX.md
- docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md
- docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md
- docs/tasks/TASKS.md
- docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md
- docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md

Do not edit any other path. In particular, do not edit application code,
tests, migrations, deploy scripts, approved SPECs, approval JSON, TASK-0018
implementation/evidence/task-card paths, DECISION-LOG.md, or any existing
handoff. Do not reset, clean, delete, commit, push, deploy, access SSH/server,
nginx/TLS/DNS/systemd, mutate any database, use real data or credentials, call
external AI, install dependencies, or execute a paid/external side effect.
Never print or store secrets.

Required deliverables:
1. Create a factual architecture baseline under docs/architecture/ that names
   the actual module boundaries, primary entrypoints, persistence/migration
   path, request/application/policy flow, and stated external/runtime facts.
   Each material fact must cite a repository path, command, or decision. Mark
   current production runtime state as NOT VERIFIED unless you actually inspect
   a permitted local source that establishes only a historical fact.
2. Create ADR-0003-current-cloud-modular-monolith.md. It supersedes only stale
   architecture prose where the record supports it, records the current
   modular-monolith decision and non-decisions, and does not authorize a
   physical package refactor or deployment.
3. Reconcile README.md, PROJECT.md, NOW.md, SPEC index, task index, and the
   model-routing/workflow documents so their active/current statements agree
   with the approved SPECs, DEC-0124 verdict-only protocol, DEC-0125
   TASK-0018 acceptance boundary, and the active TASK-0022 task. Keep clearly
   labelled history; do not rewrite historical evidence as a current runtime
   assertion.
4. Review SPEC-GOV-0001 for internal completeness. Move it to 20-review only
   if its text is internally complete, has no behavior-changing unresolved
   placeholder, and its status/references can be supported. Do not approve it,
   create approval metadata, or change any approved product SPEC. If it is not
   review-ready, leave it in 10-draft and report the exact gap.
5. Update the TASK-0022 card with factual completed/pending step status only.
   Create docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md with changed
   paths, facts cited, cross-reference findings, commands, results, NOT
   VERIFIED boundaries, and the final HANDOFF-ONLY status.

Verification to run and record with exit code and material result:
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
- git diff --check
- focused repository searches proving that active TASK-0018, TASK-0022,
  DEC-0124, DEC-0125, architecture, and SPEC-GOV references are not stale or
  contradictory across the control documents you own
- inspect current source/migrations/tests needed to support architecture claims

Do not claim tests, deployment, PostgreSQL, browser, or production acceptance
passed unless you actually ran the relevant permitted check. Documentation-only
work does not require application code changes. If a material fact conflicts
or cannot be established without a product decision, preserve the conflict in
evidence and return PARTIAL; do not invent a resolution.

Final response format, and nothing else:
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, result per line>
evidence: docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

## Verified handoff state

- The task is documentation/review only. It has no authorization to modify
  application behavior or any external state.
- TASK-0018 is accepted in the local synthetic scope; this is recorded in
  `docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
- The worktree remains intentionally dirty and must not be normalized or
  committed by the executor.

## Completion boundary

Return one factual `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED` report. Codex will
inspect the actual repository state, evidence, diff, and governance output
before issuing the next verdict.
