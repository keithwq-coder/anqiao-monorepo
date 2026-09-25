# HANDOFF-20260812: TASK-0026 W5 no-log production preflight to DeepSeek in PI

- Task: TASK-0026
- From tool/model: GPT-5.6-sol / Codex architecture and review owner
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE BOUNDED NO-LOG READ-ONLY PRODUCTION PASS
- Repository state: `main`, intentionally dirty; preserve all existing work
- Written at: 2026-08-12 Asia/Shanghai

## PI execution prompt

You are the sole execution owner for TASK-0026 in `D:\Project\中科安樵\crm`.
Other work already exists in this dirty worktree. Do not revert, overwrite,
normalize, delete, or claim changes outside your exclusive owned paths. Your
maximum outcome is `HANDOFF-ONLY`; GPT-5.6-sol / Codex is the only reviewer and
acceptance decision-maker.

Read in full before editing or any remote access:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0124`, `DEC-0129`,
  `DEC-0130`, `DEC-0131`, and `DEC-0132`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0023-g6-release-resource-plan.md`
- `docs/tasks/active/TASK-0026-w5-no-log-read-only-production-preflight.md`
- `docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`
- `docs/evidence/TASK-0025-GPT56-INDEPENDENT-REVIEW-20260812.md`
- `deploy/anqiao-crm.service`
- `deploy/nginx_crm.conf`
- `deploy/start.sh`
- this handoff in full

State the current phase, scope, assumptions, and unknowns internally before
acting. Never ask the product owner to operate tools, compare reports, or make
an engineering choice.

Authority: `DEC-0132` authorizes exactly one no-log read-only production
preflight. TASK-0024 is unaccepted history. Do not rely on it as current proof
and do not try to repair it.

Exclusive local write paths:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0026-w5-no-log-read-only-production-preflight.md`
- `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md`
- `docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md`

All other paths are read-only. Do not edit the decision log, this handoff,
TASK-0024/TASK-0025 files, approved SPECs/approval JSON, architecture,
application code, tests, migrations, scripts, deployment files, or
configuration.

Hard prohibitions:

- Never release, deploy, create a backup, restore, migrate, write a file,
  install a package, chmod/chown, alter systemd/nginx/DNS/TLS, start/stop/
  restart/reload/enable a service, write a database, commit, or push.
- Never read or print a credential, secret, private key, runtime environment
  contents, process environment, business-row value, authenticated page,
  cookie, session, or HTTP response body.
- Never run `journalctl`, `systemctl status`, `tail`, any `/var/log` path, any
  log file/query, access/error log inspection, or command intended to derive
  log content/metadata. This includes counts and timestamps. Do not use a
  substitute log interface.
- Never use `StrictHostKeyChecking=no`, replace a host key, enter a password,
  use interactive sudo, create a port forward/tunnel, forward an agent, or use
  another host.
- A remote command not explicitly allowlisted below is forbidden. On any
  ambiguity, stop `BLOCKED` without a workaround.

Required local preparation:

1. Record `git status --short`.
2. Hash `SPEC-0012` and compare it to its approval JSON. Do not change either.
3. Run `ssh-keygen -F 124.222.212.159` only to confirm an existing known-host
   entry. Do not add or replace a host key.

Remote access rules:

- Use only `ubuntu@124.222.212.159` with `BatchMode=yes`,
  `StrictHostKeyChecking=yes`, and `ConnectTimeout=15`.
- First SSH command may run only `id -un; hostname; date -u
  +%Y-%m-%dT%H:%M:%SZ; date +%Y-%m-%dT%H:%M:%S%z`. Expected user is `ubuntu`.
  If user or hostname differs from the historical target, stop and report it.
- SSH login or HTTP HEAD may write normal server-side audit/access records. Do
  not retrieve or inspect them.

Allowlisted remote commands after identity matches:

1. Service metadata only:

```sh
systemctl show anqiao-crm --no-pager \
  --property=LoadState,ActiveState,SubState,FragmentPath,User,Group,WorkingDirectory,MainPID
```

Do not use `systemctl status`, `cat`, or `show` properties beyond this list.
Do not request `ExecStart`, `Environment`, or `EnvironmentFiles`.

2. TCP listener addresses and ports only. Use `ss -ltn` and filter only the
ports `22`, `80`, `443`, `3000`, `7280`, `8080`, `8200`, and `5432`. Do not use
`-p`, process command lines, or any other socket category.

3. Deployment metadata only. Run a depth-2 `find` beneath `/opt/anqiao-crm`
that outputs type, owner/group, numeric mode, size, path, and symlink target.
Do not read contents. Do not traverse outside that root. For
`/opt/anqiao-crm/shared/database.env`, run only `stat` for owner/group/mode/size
and a `test -r` as the observed systemd User. If systemd User is not `ubuntu`,
record the discrepancy and do not substitute another user or broaden sudo.

4. nginx metadata only. List names under `/etc/nginx/sites-enabled`, collect
each enabled entry's resolved path and SHA-256 hash, and from the resolved
`crm` site print only directives matching `server_name`, `listen`, `proxy_pass`,
`ssl_certificate`, or `ssl_certificate_key`. Run `sudo -n nginx -t` only. Do
not reload nginx or print unrelated configuration.

5. Public certificate metadata only. Use `openssl x509` against only
`/etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem` with `-noout -subject
-issuer -dates -fingerprint -sha256 -ext subjectAltName`. Do not open the
private key. A direct permission denial is a fact; a `sudo -n` retry is allowed
only for this same public certificate metadata command.

6. DNS and HTTP metadata only. Query A/AAAA for `crm.aibrain.wiki`. For
loopback `http://127.0.0.1:8200/health` and public
`https://crm.aibrain.wiki/health` and `/login`, issue unauthenticated HTTP
`HEAD` requests only and record status, redirect, and content type. Never send
cookies/authentication or read/store a response body.

7. Database metadata only. Use `sudo -n -u postgres psql -d anqiao_crm` with
one explicit `BEGIN READ ONLY; ... COMMIT;` transaction. Output only:
`current_database()`, `server_version`, Alembic revision string, `pg_tables`
public user table names, and `pg_stat_user_tables.n_live_tup` estimated counts.
Never select application columns, row values, configuration settings, or
credentials.

The executor must not run any command that reads logs. In the evidence, state
`NO LOG COMMAND RAN` and list the full remote command inventory so Codex can
audit it. Do not write a journal/log section or report log counts/timestamps.

Required local output and checks:

1. Write `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md`
with exact commands (secrets absent), exit codes, verified current facts,
unknown/blocked items, G6 comparison, deviations, no-log attestation, and
later-gate stop conditions. Do not claim W5 authorization.
2. Update TASK-0001, TASK-0026, NOW, and TASKS to say only that TASK-0026
executed and awaits Codex independent review. W5 release/G7/V1/R2 remain
PENDING and separately unauthorized.
3. Write `docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md` with exact
changed paths, remote command inventory/exit codes, no-write/no-secret/no-log
statement, failed/not-verified items, and `HANDOFF-ONLY`, `PARTIAL`, or
`BLOCKED` result.
4. Run and record:
   - `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
   - `git diff --check`
   - `git status --short`
   - scoped secret-pattern scan over only TASK-0026 status/evidence files
   - scoped command scan proving no `journalctl`, `systemctl status`, `/var/log`,
     or log-file path appears in the command inventory except when explicitly
     documenting the prohibition (not a command run)

Final response must contain only:

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, factual result per line>
evidence: docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

Never output secrets, raw logs, business data, a release prompt, or an
acceptance verdict.
