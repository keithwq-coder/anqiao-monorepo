# TASK-0023: TASK-0001 G6 release-resource plan

- Task ID: TASK-0023
- Status: ACTIVE / ACCEPTED (G6 local documentation-planning scope only;
  W5/G7/V1/R2 remain pending and separately unauthorized; independent evidence:
  `docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`)
- Task type: DOCUMENTATION / REVIEW
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Product behavior authority: `SPEC-0001 v0.7.0`, `SPEC-0002 v0.2.0`, and
  `SPEC-0012 v0.2.0`; this task changes no product behavior
- Implementation authorized by: `DEC-0127`
- Execution owner: DeepSeek in PI through the configured OpenCode Go route;
  exact upstream model identity is UNKNOWN unless PI reports it
- Review/acceptance owner: Codex architecture owner and independent reviewer
- Depends on: TASK-0001 G5 authorization (`DEC-0112`), TASK-0022 architecture
  baseline acceptance, and the current local deployment artifacts

## Goal

Produce a factual, reviewable G6 release-resource plan for the existing CRM:
the required systemd/nginx/release resources, isolation checks for the existing
site, reversible failure handling, and the exact evidence required before any
separately authorized W5 release.

## Scope

- Local repository inspection only.
- A G6 resource-plan evidence document under `docs/evidence/`.
- This task card and the PI handoff under `docs/handoffs/`.
- Reconcile the current G6 status in `docs/NOW.md` and `docs/tasks/TASKS.md`.

## Exclusive owned paths

- `docs/decisions/DECISION-LOG.md`
- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0023-g6-release-resource-plan.md`
- `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md`
- `docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md`
- `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0023-G6-PLAN.md`

## Non-goals

- No SSH, server, network, DNS, TLS, systemd, nginx, service, database, or
  production-data access or mutation.
- No W5 release, restart, migration, backup, deploy-script execution, commit,
  push, credential read, credential change, or external call.
- No change to an approved SPEC or approval metadata.

## Assumptions and unknowns

- [VERIFIED] Historical repository evidence describes a prior deployment at
  `/opt/anqiao-crm`, service `anqiao-crm`, loopback port 8200, and an existing
  `crm` nginx site.
- [UNKNOWN] Their current production state, current file contents, health,
  certificate state, listeners, service identity, active release, and database
  migration state. This task must not infer them from historical evidence.

## Prerequisites and completion gate

- The plan separates historical facts, local artifact facts, and current
  production unknowns.
- It names a preflight snapshot, explicit resource manifest, isolation checks,
  W5 execution sequence, stop conditions, rollback sequence, and W5/V1
  verification evidence without printing secrets.
- It explicitly preserves the separate authorization gates for W5, G7, V1,
  and R2.
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` and
  `git diff --check` pass.
- Codex independently reviews actual documents, Git state/diff, execution
  evidence, and checks before acceptance. Acceptance of this planning scope
  does not authorize a remote preflight or any later gate.
