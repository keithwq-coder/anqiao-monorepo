# TASK-0026: W5 no-log read-only production preflight snapshot (2026-08-12)

- Status: EXECUTED — snapshot recorded; **awaits Codex independent review**
- Authority: `DEC-0132` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0` (hash matches approval metadata, see §1)
- Execution owner: DeepSeek in PI through the configured OpenCode Go route
  (`opencode-go/deepseek-v4-flash`; gateway selector only, upstream identity
  not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Scope: one bounded no-log read-only production preflight. No release, no
  write, no log access.
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.

> This task does not claim W5 authorization. W5 release execution, G7, V1, and
> R2 remain PENDING and separately unauthorized. TASK-0024 remains NOT ACCEPTED
> / PARTIAL (boundary incident per `DEC-0130`) and is not used as this task's
> production evidence.

## 1. Local preparation (pre-flight record)

| Check | Command | Exit | Result |
|---|---|---|---|
| Git state | `git status --short` | 0 | Pre-existing dirty worktree preserved; TASK-0026 owns only its six exclusive paths |
| Approved SPEC hash | `powershell -NoProfile -Command "Get-FileHash docs/specs/30-approved/SPEC-0012-deployment-operations.md -Algorithm SHA256"` | 0 | `621131C01F85AB9186E0F14D913E20C82EA2016267EC9B4CF0DD867A0DAC1192`, case-insensitive match with approval JSON `621131c0…dac1192`; no file changed |
| Known-host check | `ssh-keygen -F 124.222.212.159` | 0 | Existing ed25519/rsa/ecdsa known-host entries found; no host key added or replaced |

## 2. Remote identity verification

All remote commands: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes
-o ConnectTimeout=15 ubuntu@124.222.212.159 '<command>'`.

First command: `id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ; date +%Y-%m-%dT%H:%M:%S%z`
- Exit: 0
- Output: user `ubuntu`; hostname `VM-0-17-ubuntu`; UTC `2026-08-12T09:13:41Z`;
  local `2026-08-12T17:13:41+0800`.
- [VERIFIED] User and hostname match the historical target. Proceeded.

## 3. Allowlisted remote observations

### 3.1 Service metadata (systemd, allowlisted properties only)

Command: `systemctl show anqiao-crm --no-pager --property=LoadState,ActiveState,SubState,FragmentPath,User,Group,WorkingDirectory,MainPID`
- Exit: 0
- LoadState=loaded; ActiveState=active; SubState=running
- FragmentPath=/etc/systemd/system/anqiao-crm.service
- User=ubuntu; Group=ubuntu; WorkingDirectory=/opt/anqiao-crm; MainPID=3154799
- [VERIFIED] Service unit present, loaded, and running. `ExecStart`,
  `Environment`, and `EnvironmentFiles` were not requested.

### 3.2 TCP listener addresses/ports only

Command: `ss -ltn | awk 'NR==1 || $4 ~ /:(22|80|443|3000|7280|8080|8200|5432)$/ {print}'`
- Exit: 0
- Observed listeners within the allowlisted port set only:
  - `0.0.0.0:8200` (CRM application)
  - `0.0.0.0:80`, `0.0.0.0:443` (nginx HTTP/HTTPS)
  - `127.0.0.1:5432` (PostgreSQL, loopback-only)
  - `0.0.0.0:8080`, `0.0.0.0:7280`, `*:3000` (other applications)
  - `*:22` (SSH)
- No `-p`, no process command lines, no other socket category used.
- [VERIFIED] `8200` currently listens on `0.0.0.0` (matches the recorded
  historical `deploy/start.sh` template `0.0.0.0:8200`; the G6 plan records
  the loopback-only W5 listener as a future stop condition — noted, not acted
  on).

### 3.3 Deployment metadata (depth-2 find; no contents read)

Command: `find /opt/anqiao-crm -maxdepth 2 -printf "%y %u:%g %m %s %p %l\n"`
- Exit: 1 — because `find` could not traverse
  `/opt/anqiao-crm/quarantine` (`d root:root 700`): `Permission denied`.
  Recorded as a fact; no contents were read and no workaround attempted.
- Selected observed metadata:
  - Top-level layout: `migrations`, `src`, `node_modules`, `quarantine`
    (root:root 700), `docs`, `venv`, `backup`, `tmp`, `scripts`,
    `.pytest_cache`, `deploy`, `data`, `.cursor`, `templates`, `-p`,
    `.playwright-mcp`, `shared`, `static`, `tests` directly under
    `/opt/anqiao-crm`. **No top-level `releases/` directory was observed.**
  - `backup/` contains `venv`, `pre-task0012-20260805`,
    `pre-task0008-`, `pre-task0008-20260805_125406`, `shared`, `static`,
    `crm`, `releases` (directories).
  - `scripts/start.sh` present (`f ubuntu:ubuntu 775 956`).
  - `deploy/anqiao-crm.service` (`664 646`), `deploy/nginx_crm.conf`
    (`664 1376`), `deploy/start_crm.sh` (`664 315`), `deploy/.env`
    (`664 120`; metadata only, **not read**).
  - `shared/database.env` (`f ubuntu:ubuntu 600 231`).
  - `shared/admin_password.txt` (`f root:root 600 17`; metadata only,
    **not read**).
- [VERIFIED] Current deployment layout differs from the G6-plan
  `{releases,shared}` assumption; recorded as an observation for Codex review,
  not acted on.

Runtime-file metadata/access (explicit allowlist item):
- Command:
  `stat -c "%U %G %a %s %n" /opt/anqiao-crm/shared/database.env; if test -r /opt/anqiao-crm/shared/database.env; then echo READABLE_AS_SYSTEMD_USER=yes; else echo READABLE_AS_SYSTEMD_USER=no; fi`
- Exit: 0
- Observed systemd User = `ubuntu`; the SSH identity is `ubuntu`, so no user
  substitution and no sudo broadening was needed.
- Output: `ubuntu ubuntu 600 231 /opt/anqiao-crm/shared/database.env`;
  `READABLE_AS_SYSTEMD_USER=yes`.
- [VERIFIED] Runtime file exists, owned by the systemd user, mode 600, readable
  by the service user. Contents were not read.

### 3.4 nginx metadata

Command A: `ls -1 /etc/nginx/sites-enabled` plus resolved path and SHA-256 per
entry:
- Exit: 0
- Enabled sites (all real files, resolved path = entry path):
  - `anqiao-web` `af3e9a8945192cc85e8d295e2bbc427f53d624d283d08b4f473ab20615a5eb9e`
  - `crm` `082cbc696dd75b240626ced282a9a9a58a16a6cd8a3c64887ea0ba16a7ff91f9`
  - `jk-training` `62f8c95e88e807e8b9cb9bec49cfa136f8e48fc6ae3b2b5028ff0da7307b0586`
  - `jrx` `33a3c71fb26d0b340c38b8682140bcac3a958aa8a1a4dc6e5f766c9d39f91867`
  - `web` `3caf8f60ada472aee2b3fc20520cab9b56765a02189aa78acd4684ddd57e787e`
  - `wiki-training` `36ecdcebfce953f70c37cd7d45f2ad7dc480122b4115b21276142bdf93327056`

Command B (crm site selected directives only, then syntax check):
- `grep -E "^\s*(server_name|listen|proxy_pass|ssl_certificate_key|ssl_certificate)\b" /etc/nginx/sites-enabled/crm`
- `sudo -n nginx -t`
- Exit: 0
- CRM site directives:
  - `server_name crm.aibrain.wiki;`
  - `proxy_pass http://127.0.0.1:8200;`
  - `listen 443 ssl;`
  - `ssl_certificate /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem;`
  - `ssl_certificate_key /etc/letsencrypt/live/crm.aibrain.wiki/privkey.pem;`
  - `listen 80;` and second `server_name crm.aibrain.wiki;` (HTTP→HTTPS block)
- `sudo -n nginx -t`: `syntax is ok` / `test is successful` (exit 0). nginx
  was **not** reloaded.
- [VERIFIED] These match the repository template `deploy/nginx_crm.conf`
  (proxy to 127.0.0.1:8200, same TLS paths, HTTP redirect block).

### 3.5 Public certificate metadata

Command A (direct): `openssl x509 -in /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem -noout -subject -issuer -dates -fingerprint -sha256 -ext subjectAltName`
- Exit: 1 — `Permission denied` opening the fullchain (root-owned path). Direct
  permission denial recorded as a fact.

Command B (explicitly allowed `sudo -n` retry, same command only):
- Exit: 0
- subject: `CN = crm.aibrain.wiki`
- issuer: `C = US, O = Let's Encrypt, CN = YE1`
- notBefore: `Jul 25 13:34:03 2026 GMT`; notAfter: `Oct 23 13:34:02 2026 GMT`
  (in validity window at observation time)
- SHA-256 fingerprint:
  `39:10:F7:37:F2:74:9F:77:8A:3D:25:F8:0E:6F:48:51:CA:B5:22:AE:69:74:CE:BC:2B:8B:34:DF:8D:83:4A:4F`
- subjectAltName: `DNS:crm.aibrain.wiki`
- [VERIFIED] The private key was never opened.

### 3.6 DNS and HTTP HEAD metadata

DNS command: `getent ahosts crm.aibrain.wiki`
- Exit: 0
- A record: `124.222.212.159` (the server itself). No AAAA records returned.

HTTP HEAD commands (unauthenticated; `-o /dev/null`; only status, redirect,
content type recorded; no cookies/auth sent, no response body read or stored):
- `curl -sS -o /dev/null -I -w "http_code=%{http_code} redirect=%{redirect_url} content_type=%{content_type}\n" <url>`
  for `http://127.0.0.1:8200/health`,
  `https://crm.aibrain.wiki/health`, and
  `https://crm.aibrain.wiki/login`
- Exit: 0
- Loopback `/health`: http_code=405, redirect=(none), content_type=application/json
- Public `/health`: http_code=405, redirect=(none), content_type=application/json
- Public `/login`: http_code=405, redirect=(none), content_type=application/json
- [VERIFIED] All three endpoints reject the unauthenticated HEAD method with
  405 and `application/json`; no redirect. Whether GET behaves differently is
  [UNKNOWN] — GET probing is outside the allowlist and was not performed.

### 3.7 PostgreSQL metadata (one explicit read-only transaction)

Command:
`sudo -n -u postgres psql -d anqiao_crm -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(); SHOW server_version; SELECT version_num FROM alembic_version; SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename; SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY schemaname, relname; COMMIT;"`
- Exit: 0
- `BEGIN READ ONLY` … `COMMIT` explicit; ON_ERROR_STOP=1 (fail closed).
- current_database: `anqiao_crm`
- server_version: `16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)`
- Alembic revision string: `0001_initial_schema`
- Public user tables (10): `alembic_version`, `audit_events`, `contacts`,
  `follow_up_activities`, `follow_up_activity_revisions`,
  `institution_owner_history`, `institutions`, `role_grants`,
  `server_sessions`, `user_identities`
- `pg_stat_user_tables.n_live_tup` estimated counts: alembic_version 1,
  audit_events 17, contacts 117, follow_up_activities 0,
  follow_up_activity_revisions 0, institution_owner_history 20,
  institutions 117, role_grants 24, server_sessions 8, user_identities 25
- [VERIFIED] No application column, row value, configuration setting, or
  credential was selected.

## 4. G6 plan comparison (TASK-0023 vs this snapshot)

- The G6 plan marked all current production state `[UNKNOWN]`. This snapshot
  records observed facts (§3); any item not observed remains `[UNKNOWN]`.
- Listener: plan flagged `deploy/start.sh` binding `0.0.0.0:8200` as a future
  stop condition versus a proposed loopback-only W5 listener. Observed: 8200
  currently listens on `0.0.0.0` — consistent with the historical template;
  recorded as a future-gate stop condition, not a defect and not acted on.
- Layout: plan assumed `{releases,shared}` under `/opt/anqiao-crm`; observed
  top-level layout has no `releases/` directory (application files directly
  under the root, historical backups under `backup/`). Mismatch recorded.
- nginx: observed crm site directives match the repository
  `deploy/nginx_crm.conf` template; `sudo -n nginx -t` passes.
- Service: observed unit identity (User=ubuntu, Group=ubuntu,
  WorkingDirectory=/opt/anqiao-crm, loaded/running) matches the repository
  `deploy/anqiao-crm.service` template fields that were allowlisted.
  `ExecStart`/Environment were intentionally not requested.
- Database: observed revision `0001_initial_schema`. The repository contains
  migrations through `0006` (`0006_operation_records.py` exists locally). A
  head-vs-deployed mismatch is a future-gate stop condition per the G6 plan;
  recorded as an observation, not acted on.
- Runtime file: `shared/database.env` readable by the service user (consistent
  with the GR2 repair intent).
- Historical 117-record import (DEC-0058): estimated counts show 117 rows in
  `institutions` and `contacts`; recorded as an estimate, not a business value.

## 5. Deviations and unknowns

- `find` exit 1 due to root-only `/opt/anqiao-crm/quarantine`; recorded, no
  workaround.
- Public certificate direct read denied; the explicitly allowed `sudo -n`
  retry succeeded for the same public-certificate metadata command only.
- All three HTTP HEAD probes returned 405 with `application/json`. This is
  recorded as observed fact; the cause (method not allowed on those routes)
  is [UNKNOWN] and no GET or other method probe was performed.
- No AAAA records for `crm.aibrain.wiki`.
- [UNKNOWN] Anything not listed above (e.g., current deployed release content,
  logs, backups beyond `backup/` directory names, DNS TTL, TLS private key,
  runtime environment values) was not observed and is not asserted.
- [UNKNOWN] Whether the current service runs the repository HEAD code; only
  unit metadata was collected, not contents.

## 6. No-log attestation

**NO LOG COMMAND RAN.** The executor ran no `journalctl`, no
`systemctl status`, no `tail`, no `/var/log` path, no log file, no log query,
and no command intended to read or derive log content or metadata (including
counts and timestamps). No substitute log interface was used. This document
contains no log facts, counts, timestamps, or bodies. SSH login and HTTP HEAD
may have written normal server-side audit/access records; none were retrieved
or inspected.

Full remote command inventory (for Codex audit):

1. `id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ; date +%Y-%m-%dT%H:%M:%S%z` → exit 0
2. `systemctl show anqiao-crm --no-pager --property=LoadState,ActiveState,SubState,FragmentPath,User,Group,WorkingDirectory,MainPID` → exit 0
3. `ss -ltn | awk 'NR==1 || $4 ~ /:(22|80|443|3000|7280|8080|8200|5432)$/ {print}'` → exit 0
4. `find /opt/anqiao-crm -maxdepth 2 -printf "%y %u:%g %m %s %p %l\n"` → exit 1 (quarantine traversal denied)
5. `stat -c "%U %G %a %s %n" /opt/anqiao-crm/shared/database.env; if test -r /opt/anqiao-crm/shared/database.env; then echo READABLE_AS_SYSTEMD_USER=yes; else echo READABLE_AS_SYSTEMD_USER=no; fi` → exit 0
6. `ls -1 /etc/nginx/sites-enabled` + per-entry `readlink -f` + `sha256sum` → exit 0
7. `grep -E "^\s*(server_name|listen|proxy_pass|ssl_certificate_key|ssl_certificate)\b" /etc/nginx/sites-enabled/crm; sudo -n nginx -t` → exit 0
8. `openssl x509 -in /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem -noout -subject -issuer -dates -fingerprint -sha256 -ext subjectAltName` → exit 1 (permission denied)
9. `sudo -n openssl x509 -in /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem -noout -subject -issuer -dates -fingerprint -sha256 -ext subjectAltName` → exit 0
10. `getent ahosts crm.aibrain.wiki` → exit 0
11. `curl -sS -o /dev/null -I -w "http_code=%{http_code} redirect=%{redirect_url} content_type=%{content_type}\n" http://127.0.0.1:8200/health` → exit 0
12. `curl -sS -o /dev/null -I -w "http_code=%{http_code} redirect=%{redirect_url} content_type=%{content_type}\n" https://crm.aibrain.wiki/health` → exit 0
13. `curl -sS -o /dev/null -I -w "http_code=%{http_code} redirect=%{redirect_url} content_type=%{content_type}\n" https://crm.aibrain.wiki/login` → exit 0
14. `sudo -n -u postgres psql -d anqiao_crm -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; …; COMMIT;"` → exit 0

No command above reads logs. No credential, secret, private key, runtime
environment content, process environment, business-row value, authenticated
page, cookie, session, or HTTP response body was read, printed, or stored.

## 7. Later-gate stop conditions (recorded, not acted on)

- W5 release execution, G7 (DNS/TLS), V1 (runtime verification), and R2
  (independent/human acceptance) remain PENDING and separately unauthorized.
- This preflight does not authorize any mutation: no release, backup, restore,
  migration, database write, configuration/package change, chmod/chown,
  systemd/nginx change or reload, service restart, DNS/TLS change, commit, or
  push.
- Observed items flagged for future-gate review: 8200 listening on `0.0.0.0`
  (loopback-only W5 listener is a separate decision); no top-level
  `releases/` directory; deployed Alembic revision `0001_initial_schema`
  versus repository migrations through `0006`; HTTP HEAD 405 on `/health` and
  `/login`.
