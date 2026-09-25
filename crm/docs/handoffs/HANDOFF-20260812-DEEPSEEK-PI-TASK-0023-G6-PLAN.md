# HANDOFF-20260812: TASK-0023 G6 release-resource plan to DeepSeek in PI

- Task: TASK-0023
- From: Codex architecture owner / independent reviewer
- To: DeepSeek in PI through the configured OpenCode Go route
- Handoff status: READY FOR ONE BOUNDED DOCUMENTATION PASS
- Repository state: `main`, intentionally dirty; preserve all existing work
- Authority: `DEC-0127`, `AGENTS.md`, and the approved `SPEC-0012 v0.2.0`

## PI execution prompt

```text
You are the sole documentation-execution owner for TASK-0023 in
D:\Project\中科安樵\crm. Implement the bounded G6 planning task in the repository.
Your maximum outcome is HANDOFF-ONLY. Codex remains the independent reviewer
and the only acceptance decision-maker.

Read in full before editing:
- AGENTS.md
- docs/NOW.md
- docs/PROJECT.md
- docs/specs/INDEX.md
- docs/specs/30-approved/SPEC-0012-deployment-operations.md
- docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json
- docs/decisions/DECISION-LOG.md, especially DEC-0112, DEC-0120, DEC-0122,
  DEC-0124, DEC-0125, and DEC-0127
- docs/tasks/active/TASK-0001-manual-core-record-activity.md
- docs/tasks/active/TASK-0023-g6-release-resource-plan.md
- docs/architecture/ARCHITECTURE.md
- deploy/anqiao-crm.service
- deploy/nginx_crm.conf
- deploy/start.sh
- docs/evidence/TASK-0008-DEPLOY.md
- docs/evidence/TASK-0012-DEPLOY.md
- docs/evidence/TASK-0001-G5-migration-authorization-request.md
- this handoff in full

Current phase and scope:
- G6 is planning only: prepare the release/systemd/nginx resource manifest,
  existing-site isolation checks, rollback plan, stop conditions, and the
  evidence plan required before a future W5 release.
- The product owner authorized this planning pass in DEC-0127. This does not
  authorize a release or any external action.
- Preserve the dirty worktree. Never reset, clean, delete, commit, push,
  access SSH/server/network, read or print credentials, call an external API,
  mutate a database, modify systemd/nginx/DNS/TLS, restart a service, run any
  deploy/rollback script, or use real data.

Exclusive owned paths:
- docs/NOW.md
- docs/tasks/TASKS.md
- docs/tasks/active/TASK-0001-manual-core-record-activity.md
- docs/tasks/active/TASK-0023-g6-release-resource-plan.md
- docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md
- docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md

Do not edit any other path. In particular, do not edit DECISION-LOG.md, this
handoff, an approved SPEC or approval JSON, application code, tests, migrations,
deployment scripts, or existing TASK-0018/TASK-0022 evidence.

Required deliverable:
1. Write docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md. It must:
   - distinguish [VERIFIED] local artifact facts and recorded historical facts
     from [UNKNOWN] current production facts;
   - enumerate the proposed W5 resource manifest without claiming it exists
     now: release path/version marker, virtual environment, runtime environment
     file location without values, systemd unit name and user, loopback listener,
     nginx site/proxy path, existing TLS/DNS boundary, database migration state,
     log locations, and backup/snapshot location;
   - define a future read-only preflight snapshot and explicit stop conditions,
     including unexpected site ownership, listener collision, unknown release
     layout, unavailable or mismatched service, nginx syntax failure, missing
     runtime configuration, database/migration mismatch, and any condition
     requiring a credential or destructive action outside authorization;
   - define a future W5 sequence as a proposal only: verified backup/snapshot,
     isolated release publication, dependency/config validation, systemd setup,
     nginx validation and limited change only if separately authorized, health
     checks, and rollback order. Do not include executable credential-bearing
     commands or destructive cleanup commands;
   - distinguish G6 planning acceptance from W5 release, G7 DNS/TLS, V1 runtime
     verification, and R2 independent/human acceptance; state that each remains
     separately unauthorized after this pass;
   - include a concise risk register and required evidence categories for the
     future authorized W5 review.
2. Update TASK-0001's G6 row to state that the documentation plan is prepared
   and awaiting Codex independent review, while W5/G7/V1/R2 remain PENDING.
3. Update docs/NOW.md and docs/tasks/TASKS.md consistently: TASK-0023 is the
   sole active G6 planning pass and no production action has occurred.
4. Write docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md with changed
   paths, factual source list, checks and exit codes, no-external-action
   statement, NOT VERIFIED boundaries, and HANDOFF-ONLY result.

Run and record actual commands, exit codes, and results:
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
- git diff --check
- rg -n "anqiao-crm|crm.aibrain.wiki|8200|systemd|nginx|rollback" deploy
  docs/evidence/TASK-0008-DEPLOY.md docs/evidence/TASK-0012-DEPLOY.md
  docs/evidence/TASK-0001-G5-migration-authorization-request.md
- rg -n "W5|G7|V1|R2|PENDING|AUTHORIZED" docs/tasks/active/TASK-0001-manual-core-record-activity.md
  docs/NOW.md docs/tasks/TASKS.md

Final response format, and nothing else:
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, result per line>
evidence: docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

## Completion boundary

The executor must return one factual HANDOFF-ONLY, PARTIAL, or BLOCKED report.
Codex will independently inspect the actual documents, Git state/diff, report,
and evidence, then rerun the named governance and diff checks. No PI report can
authorize W5 or any remote action.
