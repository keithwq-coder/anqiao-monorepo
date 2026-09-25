# HANDOFF-20260812: TASK-0024 W5 read-only preflight to DeepSeek in PI

- Task: TASK-0024
- From tool/model: Codex architecture/review owner
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE BOUNDED READ-ONLY PRODUCTION PASS
- Repository state: `main`, intentionally dirty; preserve all existing work
- Written at: 2026-08-12 Asia/Shanghai

## PI execution prompt

```text
You are the sole execution owner for TASK-0024 in
D:\Project\中科安樵\crm. Perform exactly one bounded W5 read-only production
preflight. Your maximum outcome is HANDOFF-ONLY. Codex remains the independent
reviewer and the only acceptance decision-maker.

Read in full before any remote access:
- AGENTS.md
- docs/NOW.md
- docs/PROJECT.md
- docs/specs/INDEX.md
- docs/specs/30-approved/SPEC-0012-deployment-operations.md
- docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json
- docs/decisions/DECISION-LOG.md, especially DEC-0124 and DEC-0127 through DEC-0129
- docs/tasks/active/TASK-0001-manual-core-record-activity.md
- docs/tasks/active/TASK-0024-w5-read-only-production-preflight.md
- docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md
- docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md
- deploy/anqiao-crm.service
- deploy/nginx_crm.conf
- deploy/start.sh
- this handoff in full

Authority and hard boundary:
- DEC-0129 authorizes only read-only SSH/public DNS/HTTPS production preflight.
- Never release, deploy, create a backup, restore, migrate, write a file,
  install a package, chmod/chown, alter systemd/nginx/DNS/TLS, start/stop/
  restart/reload/enable a service, write a database, commit, or push.
- Never read or print a credential, secret, private key, runtime environment
  contents, process environment, log body, business-row value, authenticated
  page, cookie, or session.
- Never use StrictHostKeyChecking=no, replace a host key, enter a password,
  use interactive sudo, create a port forward/tunnel, forward an agent, or use
  another host. Use BatchMode=yes, StrictHostKeyChecking=yes, ConnectTimeout=15.
- If authentication/trust/sudo fails, the host or identity differs, a command
  needs a write or secret, or any boundary is ambiguous: stop and report
  BLOCKED or PARTIAL. Do not work around it.
- SSH login may create a normal server audit record; no cleanup is authorized.

Exclusive local write paths:
- docs/NOW.md
- docs/tasks/TASKS.md
- docs/tasks/active/TASK-0001-manual-core-record-activity.md
- docs/tasks/active/TASK-0024-w5-read-only-production-preflight.md
- docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md
- docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md

Do not edit DECISION-LOG.md, this handoff, approved SPECs/approval JSON,
application code, tests, migrations, deploy files, or any other path.

Execution sequence:
1. Record local `git status --short`, validate the SPEC-0012 SHA-256 against its
   approval JSON, and verify the existing known-host entry with `ssh-keygen -F
   124.222.212.159`. Do not add or replace a host key.
2. Establish one strict non-interactive SSH command to
   `ubuntu@124.222.212.159`. Verify only: `id -un`, `hostname`, and UTC/local
   timestamp. Expected user is `ubuntu`; historical hostname is
   `VM-0-17-ubuntu`. A mismatch stops the task.
3. Using only non-interactive read commands, capture:
   - systemd properties for `anqiao-crm`: LoadState, ActiveState, SubState,
     FragmentPath, User, Group, ExecStart, WorkingDirectory, MainPID. Do not
     request Environment or EnvironmentFiles values and do not print logs.
   - listening TCP sockets/process names for ports 22, 80, 443, 3000, 7280,
     8080, 8200, and 5432.
   - names, types, owners, modes, sizes, and symlink targets at depth <= 2
     under `/opt/anqiao-crm`; do not read file contents. List backup/release
     names only.
   - existence/owner/group/mode/size of
     `/opt/anqiao-crm/shared/database.env`, and whether the observed systemd
     service user can read it. Never output its contents or values.
   - nginx enabled-site names/symlink targets and SHA-256 hashes, the resolved
     `crm` site path/hash, selected non-secret directives for server_name,
     listen, proxy_pass, ssl_certificate, and ssl_certificate_key path only,
     plus `sudo -n nginx -t`. Never run reload and never print unrelated config
     contents.
   - public certificate metadata only: subject, issuer, notBefore/notAfter,
     SHA-256 fingerprint, and SAN from the public certificate path. Never open
     the private key.
   - DNS A/AAAA resolution for `crm.aibrain.wiki`; unauthenticated response
     status/redirect/content-type only for loopback `/health` and public
     `/health` and `/login`. Do not authenticate and do not save bodies.
4. Database inspection must use local peer/sudo access and one explicit
   read-only PostgreSQL transaction against `anqiao_crm`. Output only:
   current_database(), server_version, the Alembic revision string, user table
   names, and `pg_stat_user_tables.n_live_tup` estimated counts. Do not select
   any application columns or row values. If the table/revision query is absent
   or denied, record that fact; do not broaden access.
5. Do not print log bodies. You may record only whether journald has entries for
   the unit and a count/timestamp range if this can be obtained without message
   content; otherwise mark log metadata NOT VERIFIED.
6. Write `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md` with:
   exact commands (secrets absent), exit codes, `[VERIFIED]` current facts,
   `[UNKNOWN]`/`[BLOCKED]` items, comparison with the G6 proposal, deviations,
   and explicit W5 stop conditions. Do not claim W5 release authorization.
7. Update TASK-0001, TASK-0024, NOW, and TASKS consistently to say only that
   the read-only preflight was executed and awaits Codex independent review;
   W5 release/G7/V1/R2 remain PENDING and unauthorized.
8. Write `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md` with exact
   local changed paths, remote commands and exit codes, no-write/no-secret
   statement, failed/not-verified items, and HANDOFF-ONLY/PARTIAL/BLOCKED.
9. Run locally and record:
   - powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
   - git diff --check
   - git status --short
   - a scoped secret-pattern scan over only TASK-0024 evidence/status files

Final response format, and nothing else:
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, factual result per line>
evidence: docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

## Completion boundary

The executor returns evidence only. Codex will inspect actual files, Git state,
diff, remote-evidence consistency, and rerun local checks. No report or
successful preflight authorizes W5 release execution or any mutation.
