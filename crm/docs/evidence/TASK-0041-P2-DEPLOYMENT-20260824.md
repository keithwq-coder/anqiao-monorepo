# TASK-0041 P2 — Production deployment evidence (2026-08-24)

- Task: TASK-0041 (opportunity-production-rollout)
- Phase completed: **P2 production deployment** to `crm.aibrain.wiki`, with the
  deterministic fallback reason (no real `glm-5.2` call — see Remaining).
- Executor: this session (zcode / GLM-5.2), continuing
  `sess_b6dfe7fc-f0ed-480d-8572-4674dba4df92`.
- Authorization: `DEC-0162` + `DEC-0163` (batch P0+P1+P2); product-owner
  direction 2026-08-24 "现在部署(兜底)" (deploy now with fallback; enable real
  `glm-5.2` later when the API key is supplied).
- P0 dependency reconciliation: **N/A** — prior pre-flight found production
  `pip check` clean (`fastapi 0.136.3` / `starlette 1.6.0`), so the
  TASK-0027 fail-closed mismatch did not apply to the current runtime.

## What was deployed

Files were pushed to `/opt/anqiao-crm` in the prior session via
`scripts/w4_deploy.py` (TASK-0040 `ai/` package, `application/opportunity.py`,
migrations `0008`–`0013`). This session's addition was a one-line **fix to
migration `0008`** (see Blocker below), pushed surgically via `scp`
(only that file; the rest of the tree was already correct from the prior
deploy).

## Blocker found and resolved

**Symptom:** `alembic upgrade 0013` died at `0008_deprecate_agent_role` with
`psycopg.errors.CheckViolation` on `role_grants`. The whole 0008 transaction
rolled back (PostgreSQL DDL is transactional), so production stayed safely at
`0007`.

**Root cause [VERIFIED]:** migration `0008`'s docstring says *"Remove the
deprecated agent role from role_grants,"* but its `upgrade()` only swapped the
check constraint (`role IN (...)` dropping `'agent'`) — it never deleted the
existing `agent` rows. Production `role_grants` had **1 row with `role='agent'`**
(user `zxx` / 张先侠, `status='disabled'`, granted 2026-08-13, not revoked).
When the stricter constraint was added, Postgres validated all 28 rows and
rejected the 1 `agent` row. The `agent` role is deprecated by `DEC-0149`/
`DEC-0153` (no longer a legal login role), so the row is legacy and safe to
remove.

**Fix:** added `DELETE FROM role_grants WHERE role = :role` (bind param
`agent`) **before** `create_check_constraint` in `0008_deprecate_agent_role.py`
`upgrade()`. This makes the code match its own stated intent and the SPEC.

**Implementation note:** `op.execute()` in Alembic takes `(sql,
execution_options)`, not a params dict — binding the value via
`sa.text(...).bindparams(role="agent")` is the correct form.

## Commands run and results [VERIFIED]

| Step | Command (summary) | Result |
|------|-------------------|--------|
| Pre-deploy file snapshot | `tar czf /tmp/anqiao-crm-pre-TASK0041-20260824-155409.tar.gz /opt/anqiao-crm` | 124 MB, contains `./src` `./migrations` `./templates`, incl. pre-deploy `discovery.py` (rollback-ready) |
| Push 0008 fix | `scp migrations/versions/0008_deprecate_agent_role.py bri-server:/opt/anqiao-crm/migrations/versions/` | OK; `grep` confirmed `DELETE FROM role_grants WHERE role = :role` present on server |
| Pre-migration DB dump | `pg_dump -F c -> /tmp/anqiao_crm-pre-0008fix-20260824-163339.dump` | 80 KB custom-format dump (rollback insurance) |
| Migrate | `alembic upgrade 0013` | ran `0007->0008->...->0013` clean |
| `alembic current` | — | `0013_drop_legacy_opportunity_reminders (head)` |
| `role_grants` role counts | `SELECT role, count(*) ...` | `business_user 24, administrator 2, general_manager 1` (0 `agent`) |
| `opportunity_candidates` exists | `to_regclass('public.opportunity_candidates')` | `opportunity_candidates` (table present) |
| Restart | `sudo systemctl restart anqiao-crm` | `systemctl is-active` = `active` |
| Health | `curl /health` | **HTTP 200** `{"status":"healthy","service":"anqiao-crm-api","version":"0.1.0"}` |
| Homepage | `curl /` | **HTTP 302** (redirect to login — expected for auth-gated app) |
| Routes wired | introspect `crm.web.main:app` | 49 routes; new AI-opportunity routes present: `/api/discovery/candidates`, `/api/discovery/candidates/run`, `/api/discovery/candidates/{id}/adjudicate`, `/discovery`, etc. |

## Rollback path (kept)

- File rollback: `/tmp/anqiao-crm-pre-TASK0041-20260824-155409.tar.gz` on server
  (pre-deploy app tree, ubuntu-owned).
- DB rollback: `/tmp/anqiao_crm-pre-0008fix-20260824-163339.dump` (pre-migration
  `pg_dump -F c`). To restore the deleted `agent` row specifically, re-insert it
  from the dump or `alembic downgrade 0007` (re-adds the `agent`-allowed
  constraint; does not re-insert the row — re-insert manually if required).
- Service rollback: `sudo systemctl restart anqiao-crm` after restoring files/DB.

## Remaining (not done this session)

- **P1 real `glm-5.2` reason: BLOCKED.** No API key supplied; `config.py`
  `ai_enabled` validator still hard-blocks `True`. Production runs with
  `ai_enabled=False` → deterministic local fallback reasons (clustering logic).
  To enable: supply `glm-5.2` key via runtime env + open the `ai_enabled` config
  gate + re-run P1 real-execution per `DEC-0158` gate 2. This is a separate,
  separately-authorized step.
- **Migration `0008` fix is NOT committed to git** (the file is untracked in the
  working tree). Commit/push only under separate authorization per TASK-0041
  out-of-scope note. The fix is live on production; consistency with the
  repository should be closed by a commit.
- **P3 G7/V1/R2 acceptance** is the product owner's, recorded separately.
