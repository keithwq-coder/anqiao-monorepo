# TASK-0001 G6: release-resource plan (documentation pass, 2026-08-12)

- Task: TASK-0001 gate G6 — "Present release/systemd/nginx resources,
  existing-site isolation and rollback | Immediate release authorization"
- Status: **PLAN PREPARED — AWAITING CODEX INDEPENDENT REVIEW**. This document
  is a planning deliverable only. It does not authorize W5, G7, V1, or R2.
- Authority: `DEC-0127` (product-owner authorization for G6 planning only);
  approved `SPEC-0012 v0.2.0` (`DEC-0042`, approval hash
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`);
  `AGENTS.md` sections 1–8.
- Prepared by: DeepSeek in PI (TASK-0023 execution owner, one bounded
  documentation pass per the handoff
  `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0023-G6-PLAN.md`)
- Review/acceptance owner: Codex architecture owner and independent reviewer
- Execution record: `docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md`

## 0. Scope and method

This pass is local-repository planning only. No SSH, server, network, DNS,
TLS, systemd, nginx, service, database, or production-data access or mutation
was performed; no release, restart, migration, backup, deploy-script
execution, commit, push, or credential read/change occurred. Every statement
below is labeled `[VERIFIED]` (observed in a named repository path, recorded
decision, or command output this session), `[INFERENCE]` (reasoned from
verified facts), `[PROPOSAL]` (suggested, not approved), or `[UNKNOWN]`
(not established, must not be invented).

## 1. Fact classification

### 1.1 Local artifact facts `[VERIFIED]` (observed in this worktree on 2026-08-12)

- `deploy/anqiao-crm.service` exists (343 bytes). Contents:
  `Type=simple`, `User=ubuntu`, `Group=ubuntu`,
  `WorkingDirectory=/opt/anqiao-crm`,
  `ExecStart=/opt/anqiao-crm/scripts/start.sh`, `Restart=always`,
  `RestartSec=10`, `StandardOutput=journal`, `StandardError=journal`,
  `After=network.target postgresql.service`, `WantedBy=multi-user.target`.
- `deploy/nginx_crm.conf` exists (948 bytes). Contents:
  `server_name crm.aibrain.wiki;` a `location /.well-known/acme-challenge/`
  with root `/var/www/certbot`; a `location /` block with
  `proxy_pass http://127.0.0.1:8200` plus `X-Forwarded-*` headers;
  `listen 443 ssl` with
  `ssl_certificate /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem` and
  `ssl_certificate_key /etc/letsencrypt/live/crm.aibrain.wiki/privkey.pem`,
  `include /etc/letsencrypt/options-ssl-nginx.conf`,
  `ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem`; a second `server` block on
  `listen 80` that returns `301 https://$host$request_uri`.
- `deploy/start.sh` exists (956 bytes). Contents: `cd /opt/anqiao-crm`;
  requires `/opt/anqiao-crm/shared/database.env` to exist and exit 1 with an
  error message otherwise; sources every `key=value` line from that file and
  exports it; then exports `DATABASE_HOST=localhost`,
  `DATABASE_NAME=anqiao_crm`, `DATABASE_USER=anqiao_crm_app`,
  `PYTHONPATH=/opt/anqiao-crm/src`, `SESSION_COOKIE_SECURE=true`; requires
  `DATABASE_PASSWORD` and `SESSION_SECRET_KEY` to be set; finally
  `exec /opt/anqiao-crm/venv/bin/uvicorn crm.web.main:app --host 0.0.0.0
  --port 8200 --log-level info`.
- `deploy/start_crm.sh` exists (323 bytes): references
  `/opt/anqiao-crm/venv/bin/python -m uvicorn crm.web.main:app
  --host 0.0.0.0 --port 8200`; the copy in this worktree contains a
  redacted placeholder for the database password (no value is reproduced
  in this or any other document).
- `deploy/debug_env.sh` and `deploy/test_settings.py` exist; both reference
  `/opt/anqiao-crm` paths (`shared/database.env`, `/opt/anqiao-crm/src`,
  `/tmp/test_settings.py`). They are local template artifacts, not runtime
  proof.
- `deploy/.env` exists (133 bytes). Its contents were NOT read this pass to
  avoid secret handling; only existence is recorded `[VERIFIED]`.
- `migrations/versions/` contains `0001_initial_schema.py` through
  `0006_operation_records.py` (six migration files; `0006` is the
  TASK-0018 `operation_records` migration). Local Alembic head is therefore
  `0006_operation_records`.
- `src/crm/web/main.py` health endpoint returns
  `{"status": "healthy", "service": "anqiao-crm-api", "version": "0.1.0"}`
  and the direct-run entrypoint binds loopback `127.0.0.1:8000`
  (`docs/architecture/ARCHITECTURE.md` §3, 2026-08-12 baseline). External
  reachability is nginx's responsibility per `ADR-0002`.
- Local non-repo directories `data/seed`, `backup/legacy-scripts`, and
  `opt/run_auth_test.py` exist in the worktree. They are local artifacts and
  are NOT runtime proof of production layout.
- `git status` on 2026-08-12: worktree is intentionally dirty on `main` with
  many modified/untracked TASK-0018/TASK-0022/TASK-0023 files; `git diff
  --check` exits 0 (LF→CRLF warnings only). This pass preserves that state.

### 1.2 Recorded historical facts `[VERIFIED — recorded history]`

- `docs/evidence/TASK-0008-DEPLOY.md` (DEC-0083, 2026-08-05): TASK-0008 code
  was deployed to server `ubuntu@124.222.212.159` (Tencent Cloud Lighthouse),
  target `/opt/anqiao-crm/`, database `anqiao_crm`, port 8200, nginx site
  `crm`; a pre-task backup was copied to
  `/opt/anqiao-crm/backup/pre-task0008-20260805_125406/`; `alembic upgrade
  head` was already at head at that time; `sudo systemctl restart
  anqiao-crm` → active; `https://crm.aibrain.wiki/health` → 200.
- `docs/evidence/TASK-0012-DEPLOY.md` (DEC-0087, 2026-08-05): UI templates
  and `main.py` synced to `/opt/anqiao-crm/templates|src` after a backup at
  `/opt/anqiao-crm/backup/pre-task0012-20260805/`; service restart →
  active; loopback health `curl http://127.0.0.1:8200/health` →
  `{"status":"healthy","service":"anqiao-crm-api","version":"0.1.0"}`;
  external HTTPS 200; **no nginx/TLS/DNS change, no migration, no new
  dependencies**.
- TASK-0001 card: W1 (DEC-0046) created the `anqiao-crm` non-login system
  identity and an empty `/opt/anqiao-crm/{releases,shared}` tree; W2
  (DEC-0047) installed PostgreSQL 16.14 with a localhost-only `16/main`
  cluster; W3 (DEC-0048) created the empty dedicated database `anqiao_crm`,
  least-privilege role `anqiao_crm_app`, and the restricted runtime file;
  GR1 (DEC-0049) returned the database to the empty recovery state and
  rotated the credential; GR2 (DEC-0050) added `anqiao-crm` to the `ubuntu`
  group, set parent directories to `0750`, and verified the service identity
  can read its runtime file and connect.
- `DEC-0045`: the existing `crm` nginx site and `/home/ubuntu/CRM` are the
  authorized staged-replacement targets; they remain untouched until the
  later cutover.
- `DEC-0053`/`DEC-0055`: W4 migration (`0001_initial_schema`) applied to
  `anqiao_crm` with synthetic seed only; `DEC-0058`: 117 real rows imported
  on 2026-07-30; `DEC-0112` (2026-08-08): G5 authorized/closed.
- `docs/evidence/TASK-0001-G5-migration-authorization-request.md` (2026-08-03)
  recorded the then-current production assumption: `alembic_version =
  0001_initial_schema`, 10 tables, 117 real rows; it explicitly states the
  actual state was `[UNKNOWN]` without network verification.

### 1.3 Current production facts `[UNKNOWN]` (not established; not to be invented)

- Active release layout and contents under `/opt/anqiao-crm` (whether
  `src/`, `templates/`, `venv/`, `scripts/`, `shared/`, `backup/`,
  `releases/` exist and what they contain).
- Service `anqiao-crm` activity, PID, systemd unit file contents, and user.
- nginx active configuration, site list, and the real `crm` site file.
- TLS certificate/key state, expiry, and DNS resolution of
  `crm.aibrain.wiki`.
- Listening sockets on the server (including whether 8200 is bound and to
  which address).
- Database migration state of `anqiao_crm` (which revision is recorded in
  `alembic_version`; whether `0002`–`0006` are applied) and current row
  counts.
- Contents of `/opt/anqiao-crm/shared/database.env` (values are secrets and
  must never be reproduced; their existence and schema are inferred from
  `deploy/start.sh`).
- Journald/nginx log state and backup/snapshot inventory.

## 2. Proposed W5 resource manifest (PROPOSAL — does not exist now)

The manifest below names the resources the future W5 release would use, based
only on the local artifacts and recorded history above. Every row is a
proposal until an authorized W5 request confirms it against the read-only
preflight (§3). "Proposed W5 state" is the target; "Current production state"
is `[UNKNOWN]` until the preflight runs.

| Resource | Local artifact / historical basis `[VERIFIED]` | Proposed W5 state `[PROPOSAL]` | Current production state |
|---|---|---|---|
| Release path | W1 created empty `/opt/anqiao-crm/releases`; historical deployments synced code directly into `/opt/anqiao-crm/src` and `/opt/anqiao-crm/templates` | `/opt/anqiao-crm/releases/<version-marker>/` containing the authorized build; a version marker (release label and/or build SHA) must be fixed in the W5 request and stored in a `RELEASE` marker file so activation and rollback identify the exact build | `[UNKNOWN]` |
| Virtual environment | `deploy/start.sh` and `deploy/start_crm.sh` reference `/opt/anqiao-crm/venv/bin/uvicorn`; `ARCHITECTURE.md` §3 | `/opt/anqiao-crm/venv` (per-release or shared — fixed in the W5 request; must match the activation script) | `[UNKNOWN]` |
| Runtime environment file (location only; no values) | `deploy/start.sh` requires `/opt/anqiao-crm/shared/database.env` and the variables `DATABASE_PASSWORD`, `SESSION_SECRET_KEY` | `/opt/anqiao-crm/shared/database.env` — never created, edited, printed, or stored by AI; only existence and read-access by the service identity are verified | `[UNKNOWN]` |
| systemd unit | `deploy/anqiao-crm.service`: `Type=simple`, `User=ubuntu`, `Group=ubuntu`, `WorkingDirectory=/opt/anqiao-crm`, `ExecStart=/opt/anqiao-crm/scripts/start.sh`, journald logging | Unit name `anqiao-crm.service`; **open decision**: W1 created a non-login `anqiao-crm` identity and GR2 added it to the `ubuntu` group, but the template unit runs as `ubuntu` — the W5 request must state the exact service user and resolve this mismatch | `[UNKNOWN]` |
| Loopback listener | `deploy/nginx_crm.conf` proxies to `http://127.0.0.1:8200`; `ARCHITECTURE.md` §3 states external reachability is nginx's job | uvicorn bound to `127.0.0.1:8200` only (loopback). Note: `deploy/start.sh`/`start_crm.sh` templates bind `0.0.0.0:8200`; the W5 request must fix the bind address to loopback-only or separately justify and authorize otherwise | `[UNKNOWN]` |
| nginx site / proxy path | `deploy/nginx_crm.conf` (`server_name crm.aibrain.wiki`, `location /` → `127.0.0.1:8200`, ACME challenge, port 80→443 redirect); `DEC-0045` names the existing `crm` site as the replacement target | Replace only the authorized `crm` site; every other site untouched; `nginx -t` before and after | `[UNKNOWN]` |
| Existing TLS/DNS boundary | `deploy/nginx_crm.conf` references `/etc/letsencrypt/live/crm.aibrain.wiki/{fullchain,privkey}.pem`; `DEC-0041` fixed the subdomain `crm.aibrain.wiki` | Reuse the existing certificate boundary; no TLS/DNS change in W5 unless a separate G7 authorization exists | `[UNKNOWN]` |
| Database migration state | Local head is `0006_operation_records`; recorded production history ends at `0001_initial_schema` + 117 real rows (DEC-0058) | `alembic upgrade head` only if the read-only preflight matches the authorized premise; otherwise stop and report (stop conditions §4) | `[UNKNOWN]` |
| Log locations | `deploy/anqiao-crm.service` sets `StandardOutput=journal` / `StandardError=journal` | journald for the service; nginx access/error logs at the default nginx paths `[INFERENCE — not verified]` | `[UNKNOWN]` |
| Backup / snapshot location | Historical backups under `/opt/anqiao-crm/backup/pre-<task>-<timestamp>` (TASK-0008/0012 evidence) | A verified, restorable snapshot (legacy CRM files, current release, and database `pg_dump` or equivalent) under `/opt/anqiao-crm/backup/pre-w5-<timestamp>/` before any W5 mutation; restore must be rehearsed and recorded | `[UNKNOWN]` |

## 3. Future read-only preflight snapshot (content for the W5 authorization request)

Before any W5 mutation, the authorized executor must capture, read-only, all of
the following and compare it to this plan. Each item is a check, not a change.

1. Identity proof for the authorized transport (no credential printed).
2. `systemctl status anqiao-crm` / unit file contents and the active
   `ExecStart` path.
3. Listener inventory (`ss`/`netstat`): what is bound on 8200, 80, 443, and
   the port set recorded in the TASK-0001 preflight (22, 80, 443, 3000, 7280,
   8080), and by which process/user.
4. `/opt/anqiao-crm` directory inventory: `releases/`, `shared/`, `venv/`,
   `src/`, `templates/`, `scripts/`, `backup/`, and any `RELEASE` marker.
5. Existence (not contents) and read-access of
   `/opt/anqiao-crm/shared/database.env`.
6. nginx: active site list, the real `crm` site file, and `nginx -t`.
7. TLS: certificate paths, expiry, issuer, and SANs; DNS resolution of
   `crm.aibrain.wiki`.
8. Database, read-only: `alembic current` against the authorized target,
   table inventory, row counts, and `pg_dump` feasibility (no dump executed
   unless authorized).
9. Existing-site health: loopback and HTTPS response codes and content
   hashes for the legacy CRM and for every other site, before and after.
10. `git` state of the repository used for the release build (the exact build
    SHA/version marker to be published).

## 4. Explicit stop conditions (fail-closed; report and stop, never work around)

1. **Unexpected site ownership**: the `crm` site, `/home/ubuntu/CRM`, or any
   other nginx site/directory is owned by or serves content different from
   the `DEC-0045` authorized premise.
2. **Listener collision**: port 8200 (or any proposed port) is bound by a
   different process, or any listener on 80/443 is not the expected nginx.
3. **Unknown release layout**: `/opt/anqiao-crm` layout, `venv`, or release
   marker differs from the preflight/authorized premise.
4. **Unavailable or mismatched service**: `anqiao-crm` unit absent, disabled,
   or its `ExecStart`/user differs from the authorized premise.
5. **nginx syntax failure**: `nginx -t` fails at any point.
6. **Missing runtime configuration**: `/opt/anqiao-crm/shared/database.env`
   missing or not readable by the service identity; any required variable
   (`DATABASE_PASSWORD`, `SESSION_SECRET_KEY`) unset.
7. **Database/migration mismatch**: `alembic current` or table/row inventory
   differs from the authorized premise; unknown objects present; the target
   database is not the authorized one.
8. **Credential requirement outside authorization**: any action that would
   read, print, copy, change, or rotate a credential/secret/TLS key without
   a separate explicit authorization.
9. **Destructive action outside authorization**: any DROP, DELETE, overwrite,
   snapshot-restore, package removal, release removal, or cleanup beyond the
   named authorized scope.
10. **Preflight deviation generally**: any difference between the observed
    preflight snapshot (§3) and the authorized premise that is not itself
    explicitly authorized.

## 5. Proposed future W5 sequence (PROPOSAL only — no executable commands)

Ordered outcomes with gates; each step finishes only when its recorded
evidence passes. This sequence contains no credential-bearing or destructive
commands by design; the authorized W5 request will name exact commands within
the approved scope.

1. **Verified backup/snapshot**: capture and verify a restorable snapshot of
   the legacy CRM, the current release, and the database (per §2
   "Backup/snapshot location"); record a restore rehearsal result.
2. **Isolated release publication**: place the authorized build under
   `/opt/anqiao-crm/releases/<version-marker>/` and record the marker; do not
   touch any other project or the live service.
3. **Dependency/config validation**: validate the pinned dependencies and the
   runtime configuration against the authorized premise (existence/read-only
   checks only; no secret values).
4. **systemd setup**: define/verify the unit per the resolved service-user
   decision; validate unit syntax and the activation script path without
   starting or restarting the service until the activation step.
5. **nginx validation and limited change only if separately authorized**:
   `nginx -t`; the only permitted nginx change in W5 is replacing the
   authorized `crm` site, and only with a separate explicit authorization
   naming that exact change; no other site, no TLS/DNS change.
6. **Health checks**: loopback health, unauthenticated denial, HTTPS access,
   migration state, and other-site health before/after activation.
7. **Rollback order** (if any step fails): (a) stop the new activation and
   restore the previous release from the verified snapshot; (b) revert the
   `crm` site change to the pre-W5 state if it was changed; (c) restore the
   database from the verified backup if the migration was applied; (d)
   re-run health checks and confirm no other site changed. Rollback restores
   the prior state; it is not permission for cleanup, deletion, or
   credential rotation — those remain separately gated.

## 6. Gate separation (nothing is authorized by this pass)

| Gate | Meaning | Status after this pass |
|---|---|---|
| G6 | Release-resource plan, isolation checks, rollback plan, evidence contract | PLAN PREPARED — AWAITING CODEX INDEPENDENT REVIEW; not accepted by this pass |
| W5 | Release execution (snapshot, publication, systemd, nginx cutover) | REMAINS PENDING and separately unauthorized |
| G7 | DNS/TLS changes if still required | REMAINS PENDING and separately unauthorized |
| V1 | Runtime verification on the deployed environment | REMAINS PENDING and separately unauthorized |
| R2 | Independent final review and product-owner business/visual acceptance | REMAINS PENDING and separately unauthorized |

A successful G6 review by Codex does not open any later gate; each requires
its own explicit authorization (`DEC-0112` point 3, `DEC-0127` point 3).

## 7. Concise risk register (for the future authorized W5 review)

| Risk | Consequence | Mitigation (proposal) |
|---|---|---|
| Legacy-site replacement damage | Losing the existing CRM or another project | Verified snapshot before any mutation; only the authorized `crm` site may change; other sites hash-checked before/after |
| Listener collision on 8200/80/443 | Service or other-site outage | Preflight listener inventory; fail-closed stop condition §4.2 |
| Service identity mismatch (`ubuntu` vs `anqiao-crm`) | Runtime file/DB read failure or privilege drift | Resolve in the W5 request before any systemd change (open decision, §2) |
| Credential/secret exposure | Security incident | No AI read/print/change of secrets; placeholders only; runtime env file location-only |
| Database/migration mismatch | Wrong target or partial migration | Read-only `alembic current`/inventory preflight; transactional DDL; stop conditions §4.7 |
| Half-online state on failure | Users see a broken site | Atomic activation; rollback order §5.7; failure never reported as success |
| Other-site regression | Unrelated service outage | Full other-site health/hash before and after; no other site touched |

## 8. Required evidence categories for the future authorized W5 review

The W5 authorization request must produce, and the W5 review must verify:

1. Preflight snapshot (§3) recorded before any mutation, with matching
   authorization premise.
2. Snapshot/backup existence, verification, and restore-rehearsal record.
3. Release marker and published build identity (build SHA/version marker).
4. systemd unit definition and the resolved service-user decision.
5. `nginx -t` output and the exact before/after `crm` site change (if
   separately authorized).
6. Health checks: loopback, HTTPS, unauthenticated denial, migration state,
   restart persistence, and other-site health.
7. Rollback rehearsal record and rollback order as executed.
8. Governance check and `git diff --check` results after the W5 evidence pass.
9. Explicit statement of which gates (W5/G7/V1/R2) the evidence covers and
   which remain separately unauthorized.

## 9. Non-decision statements

- No production action has occurred as a result of this planning pass.
- `[UNKNOWN]` production facts in §1.3 must be established only through a
  separately authorized read-only preflight, never inferred from this
  document's historical records.
- No executable command in this document carries credentials, and no
  destructive cleanup command is included by design.
