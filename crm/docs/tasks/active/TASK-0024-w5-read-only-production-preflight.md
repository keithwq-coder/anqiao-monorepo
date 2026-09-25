# TASK-0024: W5 read-only production preflight

- Task ID: TASK-0024
- Status: ACTIVE / **NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED** (2026-08-12, `DEC-0130`): the journald pipelines processed log records/message text despite the no-log-body boundary; the snapshot is preserved as unaccepted evidence; TASK-0025 reconciles the record locally. W5 release/G7/V1/R2 remain PENDING and unauthorized)
- Task type: VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0129`
- Owner tool: PI through the configured OpenCode Go route
- Owner model: `opencode-go/deepseek-v4-flash` gateway selector; upstream
  provider/model identity remains UNKNOWN unless independently evidenced
- Review/acceptance owner: Codex
- Audit started at: 2026-08-12
- Audit last updated: 2026-08-12
- Depends on: TASK-0023 accepted under `DEC-0128`; W5 release remains pending

## Goal

Replace the G6 plan's production `[UNKNOWN]` resource facts with a bounded,
read-only snapshot sufficient for a later W5 release-authorization decision,
without changing or exposing the production environment.

## Scope

- Read-only SSH identity and host snapshot for the established production host.
- Read-only systemd service metadata, listener inventory, release-directory
  names/metadata, nginx site names/hashes and syntax validation, public
  certificate metadata, DNS resolution, and unauthenticated health status.
- Runtime environment file existence, owner/mode, and service-user readability
  only; never contents or values.
- PostgreSQL identity, version, Alembic revision, user-table names, and estimated
  row counts only, inside an explicit read-only transaction; no business values.
- Local evidence and control-document reconciliation only.

## Exclusive owned paths

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0024-w5-read-only-production-preflight.md`
- `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md`
- `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md`

## Non-goals

- No release, backup creation, restore, migration, deployment, file write,
  chmod/chown, package operation, systemctl start/stop/restart/reload/enable,
  nginx reload, database write, DNS/TLS change, commit, or push.
- No reading credentials, private keys, runtime environment contents, process
  environments, log bodies, application row values, user/contact/institution/
  follow-up values, cookies, sessions, or authenticated application pages.
- No `StrictHostKeyChecking=no`, host-key replacement, password prompt,
  interactive sudo, port forward, tunnel, agent forwarding, or fallback host.
- No acceptance or dispatch of W5 release execution, G7, V1, or R2.

## Assumptions and unknowns

- [VERIFIED] Historical evidence names SSH target `ubuntu@124.222.212.159`,
  path `/opt/anqiao-crm`, service `anqiao-crm`, database `anqiao_crm`, port
  8200, and site `crm.aibrain.wiki`.
- [VERIFIED] Local `ssh.exe` exists and its configuration resolves that target;
  successful current authentication is not assumed.
- [UNKNOWN] All current production facts until this task observes them.

## Prerequisites and completion gate

- Prerequisites: `DEC-0129`, valid approved-SPEC hash, existing known-host
  trust, non-interactive authentication, and non-interactive read-only sudo.
- Exact output: two local evidence files that label each fact `[VERIFIED]`,
  `[UNKNOWN]`, or `[BLOCKED]`, include commands/exit codes, and contain no
  secret or business-row values.
- Completion gate: all authorized read-only categories attempted; deviations
  and stop conditions recorded; governance and `git diff --check` pass; Codex
  independently reviews repository files, Git state/diff, and evidence.
- A completed preflight does not authorize any production mutation.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | DEC-0129 | Verify approved hash, Git state, known-host entry, and task boundary | Local preflight record | Hash match and no secret read | COMPLETE (2026-08-12; §1 of evidence) |
| 2 | Step 1 | Establish strict, non-interactive SSH and verify identity/hostname | Identity evidence | Expected user/host or fail closed | COMPLETE (ubuntu / VM-0-17-ubuntu matched) |
| 3 | Step 2 | Read service, listeners, release paths, nginx hashes/syntax, public certificate/DNS/health metadata | Resource snapshot | Commands and exit codes; no writes | COMPLETE (§3–§9 of evidence) |
| 4 | Step 2 | Read runtime-file metadata/access and bounded PostgreSQL metadata/count estimates | Config/DB snapshot | No contents or row values | COMPLETE (§6, §10 of evidence) |
| 5 | Steps 3-4 | Reconcile deviations, stop conditions, and later-gate status | Evidence/report files | Governance and diff check | COMPLETE (§12–§14 of evidence; checks in execution record) |
| 6 | Step 5 | Codex independent review | Independent verdict | Actual repository/evidence review | **REVIEWED per `DEC-0130` + `DEC-0131`**: TASK-0024 REJECTED (NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED); TASK-0025 local correction reviewed by GPT-5.6/Codex (2026-08-12) -> `ESCALATE_TO_PRODUCT_OWNER`; remaining production access/release decision awaits a new explicit product-owner decision (`DEC-0131`). Reconcile 2026-08-24: `docs/evidence/TASK-0025-RECONCILE-20260824.md` |

## Risks and rollback

- The task is observation-only and has no intended persistent remote change.
- If any command would write, reveal a secret/business value, request a
  password, or require relaxed trust, stop before it runs.
- SSH access itself may be logged by the host. No remote cleanup is authorized.

## Evidence and result

- Status: **NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED** (`DEC-0130`,
  2026-08-12). Original record: preflight executed 2026-08-12; the journald
  pipelines (`journalctl -o cat | wc -l`; `-o short-iso | cut …`) read and
  processed log records and message text before aggregation, exceeding the
  `DEC-0129` no-log-body boundary. The snapshot is preserved as unaccepted
  evidence only; do not treat its fail-closed statements as accepted.
- Commands actually run: see `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md` (exact commands, secrets absent, exit codes) and `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md` (execution record); plus `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`, `git diff --check`, `git status --short`, and a scoped secret-pattern scan
- Result artifacts: `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md` (snapshot: systemd, listeners, `/opt/anqiao-crm` metadata, `database.env` metadata/readability, nginx hashes/syntax/directives, public certificate metadata, DNS, unauthenticated HTTP status, PostgreSQL identity/version/revision/tables/estimates in one read-only transaction, journald metadata)
- Not verified: file contents under `/opt/anqiao-crm`, `quarantine/` contents (root:root 0700), `admin_password.txt` contents, private key, log bodies (message text read/processed in the journald pipelines — boundary incident `DEC-0130`; none evidenced as printed/stored), `anqiao-crm` OS-account file readability (unit runs as ubuntu), and all later gates — W5 release execution, G7, V1, R2 remain PENDING and separately unauthorized
