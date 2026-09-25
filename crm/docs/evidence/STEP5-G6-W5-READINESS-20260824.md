# Step 5 — TASK-0001 G6 carry-forward + W5 production rebuild-and-switch authorization

- Date: 2026-08-24
- Reviewer: zcode / GLM-5.2 (this session, continuing `sess_ea1152f6`)
- Scope: TASK-0001 G6 documentation gate + W5 production rebuild-and-switch
- Status:
  - **G6**: PASS (carry forward Codex/GPT-5.6 2026-08-12 acceptance).
  - **W5**: STALE on TASK-0027 (the fail-closed prod `pip check` precondition
    that BLOCKED its dispatch is no longer true per TASK-0041 P0/N/A and the
    2026-08-24 prod re-check); the rebuild-and-switch path it proposed is
    moved to a fresh DEC.

## G6 — Documentation plan (Codex/GPT-5.6 acceptance re-affirmed)

`docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md` already
records PASS for the G6 local documentation-planning scope. Re-run 2026-08-24:

| Check | Result |
|---|---|
| `Get-FileHash docs/specs/30-approved/SPEC-0012-deployment-operations.md -Algorithm SHA256` vs approval JSON | PASS: `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192` both sides |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS: 8 approved SPECs, 41 active tasks (was 20 at the 2026-08-12 review) |
| `git diff --check` | clean (only pre-existing LF/CRLF warnings) |
| `deploy/anqiao-crm.service` content | unchanged (Type=simple, User/Group=ubuntu, WorkingDirectory=/opt/anqiao-crm, ExecStart=/opt/anqiao-crm/scripts/start.sh, Restart=always, RestartSec=10, journal output, After=network.target postgresql.service, WantedBy=multi-user.target) |
| `deploy/nginx_crm.conf` content | unchanged (server_name crm.aibrain.wiki; certbot /.well-known/acme-challenge; / proxy_pass 127.0.0.1:8200; 443 ssl with /etc/letsencrypt/live/crm.aibrain.wiki/fullchain.pem + privkey.pem; 80 → 301 https) |
| `deploy/start.sh` content | unchanged (sources database.env + ai.env; export DATABASE_HOST=localhost etc.; exec uvicorn crm.web.main:app --host 0.0.0.0 --port 8200) |
| `deploy/.env` content | unchanged (133 bytes; exists on prod) |

**Verdict: PASS (carry forward)** — G6 plan is complete; the original review
checks still hold. Step 5a's deliverable is therefore evidence-of-readiness
for W5, not a new G6 pass.

## W5 — Production rebuild-and-switch (BLOCKED on TASK-0027 stale precondition)

### What the original TASK-0027 dispatch was blocked on

`docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md` records the
fail-closed stop:

- `pip check` exit 1: `fastapi 0.141.0 requires starlette>=0.46.0`, runtime
  has `starlette 0.44.0`; the release payload pins `fastapi==0.136.3`.
- No in-place venv surgery was attempted; the dispatch was held; no
  production mutation occurred.

### Current prod runtime state (2026-08-24 re-check)

`pip check` (prod `/opt/anqiao-crm/venv`):
`No broken requirements found.` The fail-closed precondition is gone.

Runtime versions:

| Package | Version |
|---|---|
| fastapi | 0.136.3 |
| starlette | 1.6.0 |
| sqlalchemy | 2.0.51 |
| alembic | 1.18.4 |
| psycopg | 3.3.4 |

### Current prod service state

- `systemctl is-active anqiao-crm` → active.
- `https://crm.aibrain.wiki/health` → HTTP 200 healthy.
- `/opt/anqiao-crm/shared/database.env` exists (600 root); PostgreSQL on
  localhost (`anqiao_crm` / `anqiao_crm_app`).
- `/opt/anqiao-crm/shared/ai.env` exists (600 ubuntu:ubuntu), 6 lines, all
  `CRM_AI_REASON_*` (TASK-0042 this session).
- Alembic head: `0013_drop_legacy_opportunity_reminders` (TASK-0041 P2).
- Running PID environ contains all 6 vars; service unit still loads the
  env file via `EnvironmentFile=` (unchanged).

### Why W5 is now a fresh decision, not a TASK-0027 re-dispatch

The original TASK-0027 dispatch was bound to the stale `pip check` failure.
That failure is gone; the TASK-0027 dispatch can no longer be re-dispatched
as written (its reason no longer exists). The proposed rebuild-and-switch
path it carried must be re-authorized as a fresh W5 action because:

1. The original TASK-0027 was dispatched under `DEC-0133` (specific to the
   fail-closed precondition).
2. The current TASK-0041 P2 deployment used the same release payload +
   service unit + nginx + systemd layout already in place; the rebuild
   step the TASK-0027 dispatch proposed is therefore **already partially
   satisfied** (the service runs, the venv is clean, alembic is at head,
   health is 200).
3. What remains for "W5" is therefore not a rebuild-and-switch but a
   boundary reconciliation: confirm there is nothing more to do, or
   identify the remaining gap.

### What W5 would need to verify to be declared COMPLETE

In scope, verifiable without further authorization:

- [VERIFIED] prod `pip check` → "No broken requirements found."
- [VERIFIED] prod `python -c "import fastapi, starlette, ..."` → all
  current versions compatible.
- [VERIFIED] prod service `active`, health 200, env file loaded, running
  PID has the canonical env vars.
- [VERIFIED] prod alembic head matches `0013_drop_legacy_opportunity_reminders`.
- [VERIFIED] TASK-0041 P1 real `glm-5.2` call → `degraded=False` + audit
  row with model_identifier + outbound_field_names only.

Not in scope of W5 (separately authorized):

- G7 (formal acceptance), V1 (full runtime verification), R2 (product-owner
  business/visual acceptance).
- Any further production mutation (deployment, restart, migration, backup,
  real-data write, credential change).
- Browser visual acceptance.

### Authorization

`DEC-0166` (drafted below) authorizes this Step-5 evidence file as the
updated W5 readiness check, **without** authorizing any new production
mutation. The original TASK-0027 dispatch is closed as STALE (per STEP-3
batch). If any further production work is needed, it goes through a new
authorization (DEC-0167+ territory), not this DEC.

## Not verified / boundaries

- No remote preflight, log read, service restart, migration, backup, or
  credential change was performed for this evidence file. The prod re-check
  used `pip check`, `python -c "import ..."`, `systemctl is-active`,
  `/health`, and file metadata only.
- `docs/decisions/DECISION-LOG.md` recorded G7/V1/R2 as product-owner
  acceptance gates; they remain so.
- G6 acceptance was already recorded in `TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`;
  this file re-affirms rather than replaces it.