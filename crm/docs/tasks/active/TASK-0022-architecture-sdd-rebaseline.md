# TASK-0022: Architecture and SDD governance rebaseline

- Task ID: TASK-0022
- Status: ACTIVE / ACCEPTED (documentation/review scope independently accepted
  2026-08-12; card retained under `active/` for repository path stability)
- Task type: DOCUMENTATION / REVIEW
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
  (TASK-0018 review boundary only; TASK-0022 changes no product behavior)
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Product SPEC authority: existing approved product SPEC baseline; no product
  behavior is changed by this task
- Governance SPEC: `SPEC-GOV-0001 v0.4.0` prepared for review and moved to
  `20-review`; it is not approved by this task
- Implementation authorized by: Product owner, 2026-08-11 request to rebuild
  the architecture/baseline and establish Spec-first SDD governance
- Authorization evidence: `DEC-0120`
- Documentation execution owner: DeepSeek-v4-flash in PI (one bounded pass
  authorized under `DEC-0125`). The initial dispatch returned `402 Insufficient
  Balance` before repository execution (`DEC-0126`); the completed pass used
  the configured PI selector `opencode-go/deepseek-v4-flash` from
  `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.
  The selector identifies the PI gateway selection only; it does not prove or
  claim the upstream model identity, provider billing state, or a new
  decision-log authorization. Exact runtime model identity remains unverified.
- Review/acceptance owner: Codex architecture owner and independent reviewer
- Requested owner model: GPT-5.6
- Runtime model identifier: UNKNOWN unless the active tool exposes it
- Audit started at: 2026-08-11
- Audit last updated: 2026-08-12
- Depends on: current repository, eight approved SPECs, `DEC-0120`, `DEC-0121`,
  `DEC-0125`

## Goal

Create a factual, current architecture baseline and a review-ready Spec-first
governance contract without changing approved business behavior or application
code. Independently audit the active TASK-0018 implementation and
prepare one consolidated remediation handoff when material defects exist.

## Scope

- Architecture baseline and module contracts under `docs/architecture/`.
- A superseding architecture decision under `docs/decisions/`.
- Model routing and SDD workflow documentation under `docs/governance/`.
- `SPEC-GOV-0001 v0.4.0` moved to review-ready state, without approval.
- Current-control, project, SPEC, task, README, evidence, and handoff documents.
- TASK-0018 review evidence, ownership transfer, task-status correction, and
  execution handoff only; no implementation edits to TASK-0018-owned
  application, migration, script, or test files.

## Owned paths

> The executed 2026-08-12 pass followed the narrower exclusive owned paths of
> `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`:
> README.md, docs/NOW.md, docs/PROJECT.md, docs/architecture/**, ADR-0003,
> MODEL-ROUTING.md, WORKFLOW.md, specs/INDEX.md, the two SPEC-GOV-0001 paths,
> tasks/TASKS.md, the TASK-0022 card, and the TASK-0022 evidence file. The
> remaining paths below remain within the task's broader scope for later
> authorized passes; none was modified by this pass.

- `README.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/architecture/**`
- `docs/decisions/ADR-0002-cloud-deployed-modular-monolith.md`
- `docs/decisions/ADR-0003-current-cloud-modular-monolith.md`
- `docs/decisions/DECISION-LOG.md`
- `docs/governance/MODEL-ROUTING.md`
- `docs/governance/WORKFLOW.md`
- `docs/specs/INDEX.md`
- `docs/specs/SPEC-BASELINE.md`
- `docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`
- `docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0018-deployment-operations-evidence.md`
- `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md`
- `docs/evidence/TASK-0018-GPT56-INDEPENDENT-AUDIT-20260811.md`
- `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`
- `docs/handoffs/HANDOFF-20260811-GLM52-TASK-0018-CONSOLIDATED-REMEDIATION.md`
- `docs/handoffs/HANDOFF-20260811-GLM52-TO-DEEPSEEKV4FLASH-PI-TASK-0018.md`

## Non-goals

- No application, migration, deployment script, test, or runtime change.
- No commit, push, deployment, server access, database mutation, credential
  change, real-data access, external AI call, or production acceptance.
- No change to an approved product SPEC or its approval metadata/hash.
- No physical package refactor; architecture debt is recorded, not repaired.
- No acceptance of TASK-0018 based on its executor report or passing tests.

## Assumptions and unknowns

- [VERIFIED] The repository is a mature FastAPI/PostgreSQL modular monolith,
  not a greenfield project.
- [VERIFIED] Eight approved product SPECs currently have matching approval
  metadata according to the governance checker.
- [VERIFIED] TASK-0018 implementation ownership was transferred from
  GLM5.2/WorkBuddy to DeepSeek-v4-flash in PI under `DEC-0121`; predecessor
  changes remain unaccepted pending the bounded reconciliation pass.
- [UNKNOWN] The exact runtime model identifier of this Codex session is not
  independently exposed in repository evidence.
- [UNKNOWN] Current production runtime, database, TLS, DNS, nginx, and systemd
  state are not re-probed by this documentation-only task.

## Prerequisites and completion gate

- Prerequisites: repository operating contract read; required control files
  inspected; current Git/worktree state captured; approved SPEC hashes checked;
  relevant implementation and tests inspected.
- Exact output: current architecture baseline, module contracts, superseding
  ADR, active model routing, review-ready governance SPEC, reconciled control
  indexes, independent TASK-0018 audit, and one remediation handoff.
- Completion gate: documentation cross-references agree; no TASK-0018
  implementation path changed by this task; `git diff --check` passes; focused
  and full tests are reported accurately; governance check returns `[PASS]`.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | TASK-0018 worktree captured | Run independent standards and SPEC review plus adversarial probes | Audit findings | Reproductions and two-axis review | PASSED (recorded `DEC-0125`) |
| 2 | Current code/module inventory captured | Write factual architecture and interface contracts | Architecture docs + ADR | Path/import/table/entrypoint inspection | PASSED (2026-08-12): `docs/architecture/ARCHITECTURE.md`, `docs/architecture/README.md`, `docs/decisions/ADR-0003-current-cloud-modular-monolith.md` |
| 3 | User role decision recorded | Update routing and prepare governance SPEC | Routing + review SPEC | Cross-reference inspection | PASSED (2026-08-12): `SPEC-GOV-0001 v0.4.0` reconciled and moved to `20-review` (NOT approved); `MODEL-ROUTING.md`/`WORKFLOW.md` updated to verdict-only protocol |
| 4 | Current authority reconciled | Refresh control documents and indexes | NOW/PROJECT/SPEC/TASK/README | Search for stale counts/statuses | PASSED (2026-08-12): README.md, NOW.md, PROJECT.md, specs/INDEX.md, tasks/TASKS.md reconciled |
| 5 | All documentation edits complete | Run final checks and write evidence | TASK-0022 evidence | diff, tests, governance | PASSED (2026-08-12): governance `[PASS]`, `git diff --check` clean, evidence written; result is HANDOFF-ONLY |

## Risks and rollback

The main risk is replacing historical status prose with claims that exceed
current evidence. Every runtime claim therefore remains explicitly historical
or NOT VERIFIED. Rollback is documentation-only: revert TASK-0022-owned paths;
approved SPEC bodies, approval metadata, and TASK-0018 implementation remain
untouched.

## Evidence and result

- Status: ACCEPTED for the documentation/review scope (bounded pass executed
  2026-08-12; the initial PI
  dispatch under `DEC-0125` returned `402 Insufficient Balance` — evidence:
  `docs/evidence/TASK-0022-PI-DISPATCH-BLOCKED-20260812.md`, `DEC-0126` — and
  the completed pass used the configured PI selector
  `opencode-go/deepseek-v4-flash`, a PI gateway selection only that does not
  prove or claim the upstream model identity, provider billing state, or a new
  decision-log authorization). Codex retains independent architecture review
  and acceptance.
- Commands actually run: recorded in
  `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md` (governance
  `[PASS]` 8 approved SPECs / 19 active tasks; `git diff --check` clean;
  focused cross-reference searches; source/migration/test inspection)
- Result artifacts: `docs/architecture/` baseline, `ADR-0003`, review-ready
  `SPEC-GOV-0001` in `20-review`, reconciled README/NOW/PROJECT/SPEC-index/
  task-index/governance documents
- Not verified: production/runtime/database/TLS/DNS/nginx/systemd state,
  PostgreSQL-gated migration round trip, and human/visual acceptance
- Independent acceptance: `docs/evidence/TASK-0022-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
  `SPEC-GOV-0001 v0.4.0` remains `NOT APPROVED`; the next mainline gate is
  TASK-0001 G6 and requires separate authorization.
