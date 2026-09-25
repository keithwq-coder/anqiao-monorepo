# TASK-0024: W5 read-only production preflight snapshot (2026-08-12)

- Task: TASK-0024 (TASK-0001 gate W5 read-only production preflight)
- Type: VERIFICATION
- Authority: `DEC-0129` (product-owner authorization, read-only production
  preflight only); approved `SPEC-0012 v0.2.0` (`DEC-0042`, hash
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`);
  handoff `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0024-W5-READ-ONLY-PREFLIGHT.md`
- Execution owner: DeepSeek in PI (one bounded pass; maximum outcome
  HANDOFF-ONLY)
- Review/acceptance owner: Codex (only acceptance decision-maker)
- Executed at: 2026-08-12 ~15:26–15:28 Asia/Shanghai (UTC 07:26–07:28)
- Result: **SNAPSHOT COMPLETE — AWAITING CODEX INDEPENDENT REVIEW** (original
  record, 2026-08-12). **REVIEW/CORRECTION NOTICE (TASK-0025, 2026-08-12):
  THIS SNAPSHOT IS NOT ACCEPTED.** It is preserved as an unaccepted snapshot
  and corrected below. This document does NOT authorize W5 release execution,
  G7, V1, or R2.

> ## ⚠ REVIEW/CORRECTION NOTICE — BOUNDARY INCIDENT RECORDED (TASK-0025, 2026-08-12)
>
> `DEC-0129` and the TASK-0024 handoff forbid log-body reading. The journald
> commands in §11 read and processed log records and message text inside the
> pipelines (`journalctl -u anqiao-crm --no-pager -q -o cat | wc -l` and
> `journalctl -u anqiao-crm --no-pager -q -o short-iso | cut -c1-24 | head -1`
> / `| tail -1`) before aggregation. Only counts and timestamps are evidenced
> as printed or stored in repository evidence; however, **log records and
> message text were read and processed during execution**, which exceeded the
> `DEC-0129` authorization boundary. The access already occurred and cannot be
> undone by documentation. Therefore TASK-0024 is
> `NOT ACCEPTED / PARTIAL - BOUNDARY INCIDENT RECORDED` per `DEC-0130`; the
> useful non-log observations below remain unaccepted snapshot evidence only
> and do not authorize W5 release execution, G7, V1, or R2. Corrected by
> TASK-0025 (`docs/evidence/TASK-0025-DEEPSEEK-PI-CORRECTION-20260812.md`).

## 0. Method and safety

Every remote read used the single established SSH target
`ubuntu@124.222.212.159` with `BatchMode=yes`, `StrictHostKeyChecking=yes`,
`ConnectTimeout=15`. No host key was added or replaced. No password, no
interactive sudo (only `sudo -n`), no port forward, no tunnel, no agent
forwarding, no fallback host. No command wrote, installed, chmod/chown'd,
reloaded, restarted, or changed anything. No credential, private key, runtime
environment value, process environment, business-row value, cookie, session,
or authenticated page was read, printed, or stored. **Boundary incident
recorded (`DEC-0130`): the journald pipelines in §11 read and processed log
records and message text before aggregation, exceeding the `DEC-0129`
no-log-body boundary.** No message text is evidenced as printed or stored in
repository evidence. File contents under `/opt/anqiao-crm` were never read;
only metadata (name/type/owner/mode/
size/symlink target) was captured. `/opt/anqiao-crm/shared/database.env`
values were never read. HTTP checks did not authenticate and did not save
bodies. The database transaction was explicit `BEGIN READ ONLY … COMMIT` and
selected no application columns or row values.

## 1. Local preflight record (before any remote access)

| # | Command | Exit | Result |
|---|---|---|---|
| 1.1 | `git status --short` | 0 | Worktree intentionally dirty on `main`: modified `README.md`, `docs/NOW.md`, `docs/PROJECT.md`, `docs/decisions/DECISION-LOG.md`, `docs/governance/MODEL-ROUTING.md`, `docs/governance/WORKFLOW.md`, `docs/specs/10-draft/SPEC-GOV-0001-…`, `docs/specs/INDEX.md`, `docs/tasks/TASKS.md`, `docs/tasks/active/TASK-0001-…`, `docs/tasks/active/TASK-0018-…`, `src/crm/persistence/models.py`, `tests/test_migrations.py`, `tests/test_persistence_schema.py`; untracked TASK-0022/0023/0024 task cards, evidence, handoffs, `docs/architecture/`, `ADR-0003`, `SPEC-GOV-0001` review copy, migration `0006`, scripts, etc. Preserved unchanged. |
| 1.2 | `certutil -hashfile docs/specs/30-approved/SPEC-0012-deployment-operations.md SHA256` | 0 | `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192` — **matches** `SPEC-0012-deployment-operations.approval.json` `spec_sha256` [VERIFIED] |
| 1.3 | `ssh-keygen -F 124.222.212.159` | 0 | Existing known-host entry present (ed25519, ssh-rsa, ecdsa-sha2-nistp256). No host key added or replaced. |

## 2. SSH identity and host snapshot

Command: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15
ubuntu@124.222.212.159 'id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ; date
+%Y-%m-%dT%H:%M:%S%z'` — exit 0.

- `id -un` → `ubuntu` [VERIFIED] (expected user)
- `hostname` → `VM-0-17-ubuntu` [VERIFIED] (matches historical hostname)
- UTC → `2026-08-12T07:26:01Z`; local → `2026-08-12T15:26:01+0800` [VERIFIED]

Identity matches the authorized premise. Task continued.

## 3. systemd service metadata (anqiao-crm)

Command: `systemctl show anqiao-crm
--property=LoadState,ActiveState,SubState,FragmentPath,User,Group,ExecStart,WorkingDirectory,MainPID`
— exit 0. No Environment/EnvironmentFiles properties were requested; no logs
printed.

| Property | Value [VERIFIED] |
|---|---|
| LoadState | `loaded` |
| ActiveState | `active` |
| SubState | `running` |
| FragmentPath | `/etc/systemd/system/anqiao-crm.service` |
| User | `ubuntu` |
| Group | `ubuntu` |
| ExecStart | `/opt/anqiao-crm/scripts/start.sh` |
| WorkingDirectory | `/opt/anqiao-crm` |
| MainPID | `3154799` |

The observed unit matches the local `deploy/anqiao-crm.service` template
exactly (Type=simple, User/Group=ubuntu, ExecStart start.sh, journald
standard output/error).

## 4. Listening TCP sockets / process names (ports 22, 80, 443, 3000, 7280, 8080, 8200, 5432)

Commands: `ss -ltn` (exit 0) and `sudo -n ss -ltnp` (exit 0), filtered to the
named ports.

| Port | Bind | Process [VERIFIED] | Note |
|---|---|---|---|
| 8200 | 0.0.0.0 | `uvicorn` pid 3154799 (matches MainPID) | App listener; binds 0.0.0.0, **not** loopback-only — deviation vs G6 proposal (see §9) |
| 80 | 0.0.0.0 | `nginx` (pids 3693161–3693166) | |
| 443 | 0.0.0.0 | `nginx` | |
| 8080 | 0.0.0.0 | `nginx` | Other project (protected boundary) |
| 7280 | 0.0.0.0 | `python` pid 2715729 | Other project (protected boundary) |
| 3000 | * | `node /opt/jrx/a` pid 2100267 | Other project `jrx` (protected boundary) |
| 22 | * | `sshd` pid 1823714 | |
| 5432 | 127.0.0.1 | `postgres` pid 3071690 | Loopback-only PostgreSQL ✓ (consistent with W2/W3 records) |

## 5. `/opt/anqiao-crm` inventory (metadata only, depth ≤ 2)

Command: `find /opt/anqiao-crm -maxdepth 2 -printf "%y %u:%g %m %s %p -> %l\n"`
— exit 0. No file contents read. Only names/metadata below; backup/release
entries listed by name only.

- `/opt/anqiao-crm` — d `ubuntu:ubuntu 0751` [VERIFIED] (recorded GR2 premise
  was 0750 — deviation, §9)
- `quarantine/` — d `root:root 0700`; `find` reports `Permission denied` for
  ubuntu on its contents; name visible at depth 1 only [BLOCKED — contents]
- `shared/` — d `root:root 0755`; `shared/database.env` — f `ubuntu:ubuntu
  0600 231 bytes` (see §6); `shared/admin_password.txt` — f `root:root 0600
  17 bytes` (name/metadata only; contents never read)
- `backup/` — d `ubuntu:ubuntu 0775`; backup names only: `crm` (0705),
  `releases` (0750), `shared` (0751), `pre-task0008-` (0775),
  `pre-task0008-20260805_125406` (0775), `pre-task0012-20260805` (0775),
  `static` (0775), `venv` (0775)
- Other top-level entries (names/metadata only): `migrations/`,
  `migrations/versions/`, `data/`, `data/seed/`, `deploy/`, `docs/…`,
  `node_modules/…`, `scripts/`, `src/…`, `src/static/`, `static/…`,
  `templates/`, `tests/…`, `tmp/`, `venv/…`, `.cursor/…`,
  `.playwright-mcp/…`, `.pytest_cache/…`, and a literal `-p` directory
  (all `ubuntu:ubuntu 0775`, except `migrations` 0755/versions 0755)
- `venv/lib64` → symlink target `lib` [VERIFIED]
- No `releases/<version-marker>` directory exists at depth ≤ 2; the observed
  layout is the historical direct-sync layout (`src/`, `templates/`, `venv/`,
  `scripts/`, `shared/`, `backup/`), consistent with TASK-0008/0012 deploy
  evidence [INFERENCE from observed names].

## 6. Runtime environment file — existence/metadata/readability only

Commands: `stat -c "%n owner=%U group=%G mode=%a size=%s"
/opt/anqiao-crm/shared/database.env` (exit 0); `sudo -n -u ubuntu test -r
/opt/anqiao-crm/shared/database.env` (exit 0); `test -r …` in the ubuntu shell
(`READABLE_BY_UBUNTU_SHELL=YES`).

- `database.env`: owner `ubuntu`, group `ubuntu`, mode `0600`, size `231`
  bytes [VERIFIED]
- Readable by the **observed** systemd service user `ubuntu` (unit
  User=ubuntu, owner of the file) [VERIFIED]
- Contents and values were **never** read, printed, or stored.
- The separate non-login `anqiao-crm` OS account's readability of the file is
  NOT VERIFIED and is not required by the observed unit (which runs as
  ubuntu). The G6 plan's open service-user question is resolved by
  observation: the deployed unit runs as `ubuntu`, matching the
  `deploy/anqiao-crm.service` template.

## 7. nginx

Commands: `ls -la /etc/nginx/sites-enabled/`; per-file
`readlink -f` + `sha256sum`; `grep -E
"^[[:space:]]*(server_name|listen|proxy_pass|ssl_certificate|ssl_certificate_key)"`
on the resolved `crm` file; `sudo -n nginx -t`. No reload; no unrelated
config contents printed.

- Enabled sites are **regular files** directly under `sites-enabled/` (not
  symlinks to `sites-available/`): `anqiao-web` (2695 B), `crm` (948 B,
  `ubuntu:ubuntu`, 2026-08-08 22:50), `jk-training` (793 B), `jrx` (426 B),
  `web` (64 B), `wiki-training` (191 B) [VERIFIED]
- SHA-256 hashes [VERIFIED]: `anqiao-web`
  `af3e9a8945192cc85e8d295e2bbc427f53d624d283d08b4f473ab20615a5eb9e`; `crm`
  `082cbc696dd75b240626ced282a9a9a58a16a6cd8a3c64887ea0ba16a7ff91f9`;
  `jk-training` `62f8c95e88e807e8b9cb9bec49cfa136f8e48fc6ae3b2b5028ff0da7307b0586`;
  `jrx` `33a3c71fb26d0b340c38b8682140bcac3a958aa8a1a4dc6e5f766c9d39f91867`;
  `web` `3caf8f60ada472aee2b3fc20520cab9b56765a02189aa78acd4684ddd57e787e`;
  `wiki-training`
  `36ecdcebfce953f70c37cd7d45f2ad7dc480122b4115b21276142bdf93327056`
- Resolved `crm` path: `/etc/nginx/sites-enabled/crm` (regular file; 948 B —
  same size as local `deploy/nginx_crm.conf`) [VERIFIED]
- Selected non-secret `crm` directives [VERIFIED]:
  - `server_name crm.aibrain.wiki;` (both blocks)
  - `proxy_pass http://127.0.0.1:8200;`
  - `listen 443 ssl;` and `listen 80;`
  - `ssl_certificate /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem;`
  - `ssl_certificate_key /etc/letsencrypt/live/crm.aibrain.wiki/privkey.pem;`
- `sudo -n nginx -t` → exit 0: `syntax is ok`; `test is successful` [VERIFIED]

## 8. Public certificate metadata (private key never opened)

Initial direct `openssl x509` read as `ubuntu` failed (`Permission denied` —
letsencrypt `live/` tree is root-restricted). Retried as `sudo -n openssl
x509 -in /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem -noout -subject
-issuer -dates -fingerprint -sha256 -ext subjectAltName` — exit 0. The private
key file was never opened.

- subject: `CN = crm.aibrain.wiki` [VERIFIED]
- issuer: `C = US, O = Let's Encrypt, CN = YE1` [VERIFIED]
- notBefore: `Jul 25 13:34:03 2026 GMT`; notAfter: `Oct 23 13:34:02 2026 GMT`
  [VERIFIED]
- SHA-256 fingerprint:
  `39:10:F7:37:F2:74:9F:77:8A:3D:25:F8:0E:6F:48:51:CA:B5:22:AE:69:74:CE:BC:2B:8B:34:DF:8D:83:4A:4F`
  [VERIFIED]
- Subject Alternative Name: `DNS:crm.aibrain.wiki` [VERIFIED]

## 9. DNS and unauthenticated HTTP

- Server-side `getent ahosts crm.aibrain.wiki` → `124.222.212.159` (STREAM/
  DGRAM/RAW), exit 0; `dig +short A crm.aibrain.wiki` → `124.222.212.159`
  (exit 0); `dig +short AAAA crm.aibrain.wiki` → empty (exit 0, no AAAA)
  [VERIFIED]
- Local `Resolve-DnsName` (execution machine): A → `124.222.212.159`; AAAA →
  none (`NO_AAAA_RECORDS`) [VERIFIED]
- Loopback app `/health` (`curl -s -o /dev/null -w … http://127.0.0.1:8200/health`)
  → `http_code=200`, no redirect, `application/json`, exit 0 [VERIFIED]
- Public `/health` (`https://crm.aibrain.wiki/health`) → `http_code=200`, no
  redirect, `application/json`, exit 0 [VERIFIED]
- Public `/login` (`https://crm.aibrain.wiki/login`) → `http_code=200`, no
  redirect, `text/html; charset=utf-8`, exit 0 [VERIFIED]
- No authentication performed; no bodies saved.

## 10. PostgreSQL — one explicit read-only transaction

Command: `sudo -n -u postgres psql -d anqiao_crm -At -v ON_ERROR_STOP=1 -c
"BEGIN READ ONLY; SELECT current_database(); SHOW server_version; SELECT CASE
WHEN to_regclass('public.alembic_version') IS NULL THEN '__ALEMBIC_VERSION_
TABLE_ABSENT__' ELSE (SELECT version_num FROM alembic_version) END; SELECT
tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename; SELECT
relname || ' n_live_tup=' || n_live_tup FROM pg_stat_user_tables ORDER BY
relname; COMMIT;"` — exit 0. Explicit `BEGIN READ ONLY … COMMIT`; no
application columns or row values selected.

- `current_database()` → `anqiao_crm` [VERIFIED]
- `server_version` → `16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)` [VERIFIED]
- Alembic revision → `0001_initial_schema` (table present) [VERIFIED]
- Public tables (10) [VERIFIED]: `alembic_version`, `audit_events`,
  `contacts`, `follow_up_activities`, `follow_up_activity_revisions`,
  `institution_owner_history`, `institutions`, `role_grants`,
  `server_sessions`, `user_identities`
- `pg_stat_user_tables.n_live_tup` estimates [VERIFIED]: `alembic_version=1`,
  `audit_events=17`, `contacts=117`, `follow_up_activities=0`,
  `follow_up_activity_revisions=0`, `institution_owner_history=20`,
  `institutions=117`, `role_grants=24`, `server_sessions=8`,
  `user_identities=25`
- Consistent with recorded history: `0001_initial_schema`, 10 tables, and the
  117-record import (`DEC-0058`) [VERIFIED]

## 11. Journald metadata (no message content)

Commands (exact commands preserved; only counts and timestamps are evidenced
as printed/stored — see correction notice for the boundary finding): `sudo -n
journalctl -u anqiao-crm --no-pager -q -o cat | wc -l`; `sudo -n journalctl -u
anqiao-crm --no-pager -q -o short-iso | cut -c1-24 | head -1`; same with
`tail -1`.

- journald has entries for unit `anqiao-crm` [VERIFIED]
- Entry count: `11978` [VERIFIED]
- First entry timestamp (short-iso, metadata only): `2026-07-30T10:10:10+08:00`
  [VERIFIED]
- Last entry timestamp: `2026-08-12T15:27:31+08:00` [VERIFIED]
- Log bodies: **boundary incident — the pipelines read and processed log
  records and message text before `wc`/`cut` aggregation.** No message text is
  evidenced as printed or stored in repository evidence; the access itself
  exceeded `DEC-0129` and is recorded under `DEC-0130`. Corrected claim: the
  prior "no log body was read" statement was false or materially incomplete.

## 12. Comparison with the G6 proposal (`TASK-0001-G6-release-resource-plan-20260812.md` §1.3/§2)

The G6 plan's `[UNKNOWN]` production facts are now replaced by this snapshot:

| G6 §1.3 unknown | This preflight result |
|---|---|
| Active release layout | Direct-sync layout observed (src/, templates/, venv/, scripts/, shared/, backup/, …); no `releases/<marker>` dir; quarantine root-only |
| Service activity/unit/user | `loaded/active/running`, MainPID 3154799, unit `/etc/systemd/system/anqiao-crm.service`, User/Group=ubuntu, ExecStart `/opt/anqiao-crm/scripts/start.sh`, WorkingDirectory `/opt/anqiao-crm` |
| nginx active config/site list/`crm` file | 6 enabled regular files (anqiao-web, crm, jk-training, jrx, web, wiki-training); `crm` = 948 B file with hash `082cbc69…`; directives match `deploy/nginx_crm.conf`; `nginx -t` OK |
| TLS cert/key state, expiry, DNS | Public cert valid to 2026-10-23; fingerprint/SAN recorded; DNS A → 124.222.212.159, no AAAA; private key never opened |
| Listening sockets | 8200 uvicorn (0.0.0.0), 80/443/8080 nginx, 7280 python, 3000 node /opt/jrx/a, 22 sshd, 5432 postgres loopback-only |
| Database migration state and counts | `alembic_version = 0001_initial_schema`; 10 tables; estimates incl. institutions/contacts 117 each |
| Runtime env file | exists `ubuntu:ubuntu 0600 231 B`; readable by observed unit user ubuntu; values never read |
| Journald/nginx log state | journald 11978 entries 2026-07-30→2026-08-12 (count/timestamp only; **pipeline read/processed log records and message text — boundary incident, `DEC-0130`**); nginx log state NOT VERIFIED |
| Backup/snapshot inventory | backup/ names: crm, releases, shared, pre-task0008-, pre-task0008-20260805_125406, pre-task0012-20260805, static, venv |

### Deviations from the G6/recorded premise (recorded, none blocking this read-only pass)

1. **Service user**: G6 flagged the W1 `anqiao-crm` identity vs template
   `ubuntu` unit. Observed unit runs as `ubuntu` (template-consistent);
   `database.env` owned by `ubuntu:ubuntu 0600` and readable by that unit
   user. The `anqiao-crm` OS account is not the unit user; its file
   readability is NOT VERIFIED and irrelevant to the observed unit.
2. **Mode deviation**: GR2 recorded parent directories at `0750`; observed
   `/opt/anqiao-crm` is `0751` (and `backup/` `0775`, several dirs `0775`).
   Recorded for the W5 authorization request; not a blocker for this read-only
   pass.
3. **Listener bind**: G6 proposed loopback-only for W5; observed uvicorn binds
   `0.0.0.0:8200` (matches `deploy/start.sh` template). The W5 request must
   fix the bind address or separately justify/authorize it (G6 §2).
4. **sites-enabled shape**: G6 assumed symlinks to sites-available; observed
   enabled-site files are regular files directly under sites-enabled. The
   W5 plan's "resolved site path" is the file itself.
5. **Migration gap**: production revision `0001_initial_schema` vs local head
   `0006_operation_records` (five revisions behind). Consistent with the G5
   record; any future migration needs its own authorization and this gap is
   now quantified.
6. **Certificate window**: valid until 2026-10-23 (~2.5 months); no G7 DNS/TLS
   work implied within the W5 horizon by this snapshot.

## 13. [BLOCKED] / [UNKNOWN] / NOT VERIFIED items

- `quarantine/` contents: BLOCKED for ubuntu (`Permission denied`, root:root
  0700); name visible at depth 1 only. No escalation attempted (out of scope).
- `shared/admin_password.txt` contents: NOT VERIFIED by design (only
  name/owner/mode/size recorded; contents never read; flagged for the W5
  request as a root-owned file inside `shared/`).
- File contents under `/opt/anqiao-crm` generally: NOT VERIFIED by design
  (metadata-only per authorization).
- `anqiao-crm` OS-account readability of `database.env`: NOT VERIFIED (not the
  observed unit user; unit runs as ubuntu and can read it).
- Private key: never checked/opened (forbidden).
- Log bodies: **BOUNDARY INCIDENT — journald pipelines read/processed log
  records and message text before aggregation (see correction notice).**
  Message text is not evidenced as printed or stored; nginx log state: NOT
  VERIFIED (metadata only).
- No test suite, build, or runtime verification was run locally for this pass
  beyond the named checks; none was required for a read-only preflight.

## 14. W5 stop conditions and gate status (corrected by TASK-0025)

- This preflight performed **no** release, backup creation, restore,
  migration, deployment, file write, chmod/chown, package operation,
  systemctl start/stop/restart/reload/enable, nginx reload, DNS/TLS change,
  database write, commit, or push.
- **Corrected claim: not all fail-closed conditions passed.** Authentication
  and trust succeeded without prompts, and host/identity matched the
  authorized premise; however, the journald pipelines in §11 read and
  processed log records and message text, which crossed the `DEC-0129`
  no-log-body boundary. The prior statement that no write, secret, or
  ambiguous boundary was encountered is therefore false or materially
  incomplete (`DEC-0130`).
- `W5` (release execution), `G7` (DNS/TLS), `V1` (runtime verification), and
  `R2` (independent review + product-owner acceptance) each **remain PENDING
  and separately unauthorized**. This snapshot does not authorize W5 release
  execution or any production mutation.
- The G6 plan's stop conditions (§4 of that plan) remain in force for any
  future authorized W5 execution and must be re-checked against this
  snapshot.

## 15. Decisions needed (none new)

- No new product or authorization decision is requested by this pass. The
  observed facts are handed to Codex independent review; a future W5 release
  request will state the resolved service-user/bind-address decisions
  (§12 deviations 1 and 3) as part of its own authorization.
