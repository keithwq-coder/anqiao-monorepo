# TASK-0026: W5 no-log read-only production preflight

- Task ID: TASK-0026
- Status: ACTIVE / **EXECUTED 2026-08-12 (HANDOFF-ONLY) / AWAITS CODEX INDEPENDENT REVIEW**
- Task type: VERIFICATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0132`
- Execution owner: DeepSeek in PI through
  `opencode-go/deepseek-v4-flash` (gateway selector only; upstream identity is
  not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Started: 2026-08-12 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: TASK-0023 G6 plan accepted under `DEC-0128`; TASK-0025 independent
  review under `DEC-0131`; explicit TASK-0026 authorization `DEC-0132`

## Goal

Obtain a new, independently reviewable snapshot for a future W5 release
decision without reading any logs and without changing or exposing the
production environment. TASK-0024 remains unaccepted history and cannot be
used as this task's production evidence.

## Scope

- Strict non-interactive SSH identity/hostname verification on the established
  target.
- Service metadata excluding unit content, environment, `ExecStart`, and logs.
- TCP listener addresses/ports without process command lines.
- Fixed-path deployment metadata, runtime-file metadata/readability only,
  nginx selected public routing metadata and syntax check, public certificate
  metadata, DNS resolution, and unauthenticated HTTP HEAD status metadata.
- PostgreSQL database identity/version/Alembic revision/table names/estimated
  row counts in one explicit read-only transaction; no business-row values.
- Local evidence and control-document updates only.

## Exclusive owned paths

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0026-w5-no-log-read-only-production-preflight.md`
- `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md`
- `docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md`

All other files, including the decision log, task handoffs, approved SPECs,
application code, tests, migrations, scripts, deployment artifacts, and all
TASK-0024/TASK-0025 evidence, are read-only to the executor.

## Non-goals and hard boundaries

- No release, deployment, backup creation, restore, migration, database write,
  file/configuration write, package operation, chmod/chown, systemctl start,
  stop, restart, reload, enable, nginx reload, DNS/TLS change, commit, or push.
- No credential, secret, private key, runtime environment content, process
  environment, business row, authenticated page, cookie, session, or HTTP body
  reading.
- No `journalctl`, `systemctl status`, `/var/log` path, log file, log query,
  access log, error log, log metadata, `tail`, or command intended to read or
  derive log content. Aggregate log counts/timestamps are also forbidden.
- No `StrictHostKeyChecking=no`, host-key replacement, password prompt,
  interactive sudo, port forward, tunnel, agent forwarding, fallback host, or
  production workaround.
- No acceptance or dispatch of W5 release execution, G7, V1, or R2.

## Assumptions and unknowns

- [VERIFIED] Historical repository evidence names SSH target
  `ubuntu@124.222.212.159`, service `anqiao-crm`, path `/opt/anqiao-crm`,
  database `anqiao_crm`, site `crm.aibrain.wiki`, and port 8200.
- [VERIFIED] TASK-0024 is unaccepted and must not be used as current proof.
- [UNKNOWN] Current production facts until independently observed by this task.
- [UNKNOWN] The current service user. The executor must observe it from the
  allowlisted `systemctl show` properties and must not assume it is `ubuntu`.

## Prerequisites and completion gate

- Prerequisites: `DEC-0132`; valid approved-SPEC hash; existing known-host
  trust; non-interactive authentication and sudo; every remote command matches
  the no-log allowlist in the handoff.
- Exact output: two local evidence files that label facts `[VERIFIED]`,
  `[UNKNOWN]`, or `[BLOCKED]`, retain exact commands and exit codes, contain no
  secrets/business values/log facts, and state that no log command ran.
- Completion gate: every authorized non-log category is attempted or recorded
  blocked; the evidence contains no log command/output; later gates stay
  unauthorized; governance and `git diff --check` pass; Codex independently
  reviews the repository and evidence.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | DEC-0132 | Check approved hash, Git state, known-host record, and task boundary locally | Preflight record | Hash matches; no host-key mutation | PENDING |
| 2 | Step 1 | Establish strict SSH; verify identity and hostname only | Identity record | Expected target or fail closed | PENDING |
| 3 | Step 2 | Read only allowlisted non-log service, listener, deployment, nginx, certificate, DNS, and HTTP HEAD metadata | Resource snapshot | Commands/exit codes; no writes or logs | PENDING |
| 4 | Step 2 | Read runtime-file metadata/access and bounded PostgreSQL metadata | Config/DB snapshot | No contents or row values | PENDING |
| 5 | Steps 3-4 | Write evidence/status documents and no-log attestation | Evidence/report | Local checks pass | DONE 2026-08-12 |
| 6 | Step 5 | Codex independent review | Review verdict | Actual files/Git/diff/checks reviewed | PENDING |

## Risks and rollback

## Execution status (2026-08-12)

TASK-0026 executed a bounded no-log read-only production preflight under
`DEC-0132` on 2026-08-12 and returned `HANDOFF-ONLY`. Evidence:
`docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md`;
execution record:
`docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md`. **NO LOG COMMAND
RAN.** W5 release execution, G7, V1, and R2 remain PENDING and separately
unauthorized. Awaiting Codex independent review; this task does not
self-accept.

- The task is observation-only. SSH/HTTP requests can create normal server-side
  audit/access records, but the executor must never retrieve any log.
- Any host-key/authentication/sudo failure, unexpected identity, attempted
  command outside the allowlist, secret/business value exposure, or ambiguity
  stops the task. Do not work around it.
