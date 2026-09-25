# TASK-0034 production execution evidence (2026-08-13)

- Executor: Codex in PI (current session). Review/acceptance: TBD
  (independent).
- Authorization: `DEC-0145` (SPEC approval + local implementation),
  `DEC-0146` (production deployment + migration 0007 + account creation).

## Verified facts (production, 2026-08-13)

- Identity: `ubuntu@VM-0-17-ubuntu` (SSH key `tencent-lighthouse`,
  `BatchMode=yes`, no agent forwarding).
- Service: `anqiao-crm` active; `GET /login` on `127.0.0.1:8200` → 200 before
  and after.
- Database revision: `0005_opportunity_reminders_ai_reasoning` → after migration
  `0007_agent_role_and_user_phone`.
- `role_grants` CHECK constraint (production name
  `ck_role_grants_ck_role_grants_role_value`) now allows `agent`.
- `user_identities.phone` column added (VARCHAR(80), nullable).
- Backup (before mutation): `/opt/anqiao-crm/backup/pre-agent-20260813/`
  — `anqiao_crm.dump` (pg_dump -Fc) + `src-backup.tgz` (source) +
  `agent-deploy.tgz` (staged payload).
- Deployment: 13 source/template files + `migrations/versions/0007_...py`.
  `models.py` was staged from HEAD + exactly two changes (phone column, agent
  role) — no `OperationRecordModel` (TASK-0018 excluded from production).
- Migration: `alembic upgrade 0007_agent_role_and_user_phone` exit 0
  (transactional DDL).
- Account: `zxx` / 张先侠 / role `agent` / phone `15805243456` / status
  enabled / id `490a09ef-be6c-48f0-b5ae-73d1ee5cf356`; password hash is
  argon2id (password not stored or printed).
- End-to-end: login `zxx` → 200 `success:true`; `GET /institutions`,
  `/discovery`, `/account/settings` → 200; HTTPS `crm.aibrain.wiki/login` → 200.

## Local checks

- pytest: `375 passed, 28 skipped`.
- `python -m compileall` exit 0; `git diff --check` exit 0.
- `scripts/check-governance.ps1` → `[PASS]` (Approved SPECs: 8, Active tasks:
  34).

## Rollback notes

- Code rollback: restore `/opt/anqiao-crm/backup/pre-agent-20260813/src-backup.tgz`
  then `systemctl restart anqiao-crm`.
- Database rollback (not performed; forward-only migration): the
  `anqiao_crm.dump` (custom format) exists; a downgrade would require separate
  authorization.

## Not verified / remaining

- Independent review and product-owner visual/business acceptance.
- The temporary password `123` should be changed by the user via
  `/account/settings` on first login.
