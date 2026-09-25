# TASK-0008 deployment evidence (DEC-0083)

- Date: 2026-08-05
- Executor: coordinator (opencode / grok-4.5)
- Authority: DEC-0083 (product owner explicit request)
- Server: `ubuntu@124.222.212.159` (Tencent Cloud Lighthouse)
- Target: `/opt/anqiao-crm/`, `anqiao_crm` database, port 8200, nginx `crm` site

## Steps

1. **Backup**: `cp -a /opt/anqiao-crm/src /opt/anqiao-crm/templates
   /opt/anqiao-crm/backup/pre-task0008-20260805_125406/` — DONE
2. **Code sync**: `scp src/crm/* ...:/opt/anqiao-crm/src/crm/` and
   `scp templates/* ...:/opt/anqiao-crm/templates/` — DONE
3. **Key files verified on server**:
   - `followups.py` (was absent) — present
   - `audit_repository.py` (was absent) — present
   - `institution_create.html` (new) — present
   - `commands.py` 587 lines (was 343) — matches local
   - `main.py` 726 lines (was 248) — matches local
4. **Migration**: `alembic upgrade head` on `anqiao_crm` — already at head
   (`0001_initial_schema`), no new migration needed — EXIT=0
5. **Service restart**: `sudo systemctl restart anqiao-crm` — active, PID 3088216
6. **Health check**: `GET /health` → 200 (local and HTTPS)

## Verification

- `https://crm.aibrain.wiki/login` → **200** `[VERIFIED]`
- `https://crm.aibrain.wiki/health` → **200** `[VERIFIED]`
- `GET /institutions/new` → **302** (redirect to login — correct, unauthenticated)
- No errors in journalctl after restart
- Application startup complete, uvicorn running on 0.0.0.0:8200

## What changed

All TASK-0008 features are now live:
- R-031: correction / withdrawal / archive (owner path)
- R-035: duplicate-suspicion prompt (409 + confirm)
- R-015: administrator-exception read with audit
- R-029: communication-method category in concise progress
- Browser creation forms (institution / contact / follow-up)
- P2: session-verified user_status pass-through (no more hardcoded ENABLED)

## Not verified

- Browser visual acceptance by product owner (human check)
- `anqiao_crm` production data state (no real data was inspected or mutated)
