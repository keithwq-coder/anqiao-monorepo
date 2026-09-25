# TASK-0026: DeepSeek in PI execution record (2026-08-12)

- Result: **HANDOFF-ONLY** (awaits Codex independent review; no self-acceptance)
- Task: TASK-0026 (W5 no-log read-only production preflight, `DEC-0132`)
- Executor: DeepSeek in PI through the configured OpenCode Go route
  (`opencode-go/deepseek-v4-flash`; gateway selector only, upstream identity
  not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved

## Changed paths (exact)

- `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md` (new)
- `docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md` (new, this file)
- `docs/NOW.md` (status: TASK-0026 executed, awaits Codex review)
- `docs/tasks/TASKS.md` (status: TASK-0026 executed, awaits Codex review)
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` (W5 row status)
- `docs/tasks/active/TASK-0026-w5-no-log-read-only-production-preflight.md`
  (task card status)

No other file was created, modified, or deleted. The decision log, this
handoff, TASK-0024/TASK-0025 files, approved SPECs/approval JSON, architecture,
application code, tests, migrations, scripts, deployment files, and
configuration were not touched.

## Remote command inventory and exit codes

All commands ran as `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes
-o ConnectTimeout=15 ubuntu@124.222.212.159 '<command>'`. Full inventory is
listed in the preflight snapshot (§6); summary:

| # | Category | Exit |
|---|---|---|
| 1 | Identity/hostname/date | 0 |
| 2 | `systemctl show anqiao-crm` (allowlisted properties) | 0 |
| 3 | `ss -ltn` filtered to allowlisted ports | 0 |
| 4 | `find /opt/anqiao-crm -maxdepth 2 -printf …` | 1 (root-only `quarantine` traversal denied; recorded, no workaround) |
| 5 | `stat` + `test -r` on `shared/database.env` | 0 |
| 6 | nginx enabled sites: names, resolved paths, SHA-256 | 0 |
| 7 | crm site selected directives; `sudo -n nginx -t` | 0 |
| 8 | `openssl x509` fullchain direct | 1 (permission denied) |
| 9 | `sudo -n openssl x509` fullchain (same command, explicit allowlist retry) | 0 |
| 10 | `getent ahosts crm.aibrain.wiki` (A/AAAA) | 0 |
| 11–13 | unauthenticated HTTP HEAD: loopback `/health`, public `/health`, `/login` | 0 |
| 14 | `sudo -n -u postgres psql -d anqiao_crm` one explicit `BEGIN READ ONLY; …; COMMIT;` | 0 |

## No-write / no-secret / no-log statement

- **No write**: no release, deployment, backup creation, restore, migration,
  database write, file/configuration write, package operation, chmod/chown,
  systemd/nginx change or reload, service start/stop/restart/enable, DNS/TLS
  change, commit, or push was performed. Local writes were limited to the six
  exclusive paths above.
- **No secret**: no credential, secret, private key, runtime environment
  content, process environment, business-row value, authenticated page,
  cookie, session, or HTTP response body was read, printed, or stored.
- **No log**: **NO LOG COMMAND RAN.** No `journalctl`, `systemctl status`,
  `tail`, `/var/log` path, log file/query, or command intended to derive log
  content/metadata (including counts or timestamps) was run. No substitute log
  interface was used. This record contains no log facts.

## Failed / not-verified items

- `find` under `/opt/anqiao-crm` exited 1 because `/opt/anqiao-crm/quarantine`
  (root:root 700) denies traversal to the `ubuntu` user; recorded as a fact,
  no workaround attempted.
- Direct `openssl x509` read of the fullchain was denied by permissions;
  the explicitly allowed `sudo -n` retry of the same public-certificate
  metadata command succeeded.
- HTTP HEAD to `/health` and `/login` returned 405/`application/json`; the
  cause and GET behavior are NOT VERIFIED (GET probing not allowlisted).
- No AAAA records for `crm.aibrain.wiki`.
- Current deployed release content, logs, backup inventory beyond directory
  names, DNS TTL, TLS private key, runtime environment values, and whether the
  running service executes repository HEAD code: NOT VERIFIED / not observed.
- The PI gateway selector does not prove the upstream model identity or
  provider billing state.

## Result

`HANDOFF-ONLY`. TASK-0026 executed a bounded no-log read-only production
preflight and recorded evidence. W5 release execution, G7, V1, and R2 remain
PENDING and separately unauthorized. Acceptance decision rests solely with
Codex independent review.
