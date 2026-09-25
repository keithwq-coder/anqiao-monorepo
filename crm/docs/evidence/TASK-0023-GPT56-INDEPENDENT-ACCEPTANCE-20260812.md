# TASK-0023: GPT-5.6 independent acceptance (2026-08-12)

- Status: **PASSED** for the G6 local documentation-planning scope only.
- Authority: `DEC-0127`; approved `SPEC-0012 v0.2.0`.
- Executor: DeepSeek in PI through `opencode-go/deepseek-v4-flash` (gateway
  selector only; upstream identity is not asserted).
- Reviewer and acceptance decision-maker: Codex.

## Scope reviewed

The accepted deliverable is a local, factual release-resource, isolation,
rollback, and future-evidence plan. It authorizes no remote preflight, W5
release, G7 DNS/TLS work, V1 runtime verification, R2 acceptance, credential
access, database action, deploy-script execution, service restart, or other
external operation.

## Independent repository evidence

1. [VERIFIED] The PI report claims `HANDOFF-ONLY` and its actual changed paths
   are limited to the TASK-0023 documentation scope. The reviewer inspected
   `git status --short`, `git diff --name-only`, `git diff --stat`, and the
   full relevant diff; the pre-existing dirty worktree was retained.
2. [VERIFIED] The plan at
   `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md` distinguishes
   local artifact facts and recorded deployment history from current production
   `[UNKNOWN]` facts. It explicitly identifies the template mismatch between
   `deploy/start.sh` binding `0.0.0.0:8200` and the proposed loopback-only W5
   listener as a future stop condition, rather than silently treating either
   as the live state.
3. [VERIFIED] The reviewer read `deploy/anqiao-crm.service`,
   `deploy/nginx_crm.conf`, and `deploy/start.sh`. Their recorded unit,
   proxy, environment-file-location, TLS-path, and listener references match
   the plan's local-artifact descriptions. `deploy/.env` was not read.
4. [VERIFIED] Historical deployment assertions in the plan are attributed to
   `docs/evidence/TASK-0008-DEPLOY.md` and
   `docs/evidence/TASK-0012-DEPLOY.md`; the plan marks all present service,
   nginx, TLS/DNS, listener, database-revision, runtime-file, log, and backup
   state as `[UNKNOWN]` pending a separately authorized read-only preflight.
5. [VERIFIED] The plan retains W5/G7/V1/R2 as separately unauthorized and
   states fail-closed stop conditions for resource ownership, listeners,
   release layout, service mismatch, nginx validation, runtime configuration,
   database/migration mismatch, credential use, and destructive actions.

## Checks rerun by the reviewer

| Check | Result |
|---|---|
| `Get-FileHash docs/specs/30-approved/SPEC-0012-deployment-operations.md -Algorithm SHA256` compared with its approval JSON | PASS: both are `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192` |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS, exit 0: 8 approved SPECs, 20 active tasks |
| `git diff --check` | PASS, exit 0; only pre-existing LF/CRLF warnings for persistence/test files |
| `rg -n "anqiao-crm|crm.aibrain.wiki|8200|systemd|nginx|rollback" deploy docs/evidence/TASK-0008-DEPLOY.md docs/evidence/TASK-0012-DEPLOY.md docs/evidence/TASK-0001-G5-migration-authorization-request.md` | PASS, exit 0; local and historical sources found |
| `rg -n "W5|G7|V1|R2|PENDING|AUTHORIZED" docs/tasks/active/TASK-0001-manual-core-record-activity.md docs/NOW.md docs/tasks/TASKS.md` | PASS, exit 0; later gates remain pending |

## Not verified

- Current remote host, service, nginx, TLS/DNS, listener, database, runtime
  configuration, logs, backup inventory, and deployed release state.
- Any W5 release or rollback rehearsal, G7 DNS/TLS action, V1 runtime check,
  R2 independent/human acceptance, browser visual acceptance, or real-data
  action.
- The PI gateway selector does not prove the upstream model identity or provider
  billing state.

## Acceptance boundary

`TASK-0023` is accepted only as a completed G6 planning document. The next
possible operation would touch external production resources whose actual state
is unknown; it requires a new, explicit product-owner authorization after this
document is reviewed. This acceptance does not dispatch W5.
