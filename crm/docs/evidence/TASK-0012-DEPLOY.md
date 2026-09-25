# TASK-0012 Deployment Evidence

- **Task**: TASK-0012 Interface Enhancement
- **Authorized by**: DEC-0087 (2026-08-05, product owner explicit authorization)
- **Executor**: Coordinator (opencode) — deployment is coordinator work
- **Date**: 2026-08-05
- **Target**: `ubuntu@124.222.212.159` / `/opt/anqiao-crm/`

## Status: DEPLOYED — service active, health check passing, HTTPS accessible

## Pre-deployment backup

[VERIFIED] Backed up existing `templates/` and `src/` to
`/opt/anqiao-crm/backup/pre-task0012-20260805/` before syncing.

## Files deployed

| File | Destination | Verification |
|---|---|---|
| `templates/base.html` (new) | `/opt/anqiao-crm/templates/base.html` | 2237 bytes, mtime 14:29 |
| `templates/dashboard.html` (rewritten) | `/opt/anqiao-crm/templates/dashboard.html` | 4381 bytes, mtime 14:30, starts with `{% extends "base.html" %}` |
| `templates/institutions_list.html` (rewritten) | `/opt/anqiao-crm/templates/institutions_list.html` | 2846 bytes, mtime 14:30, extends base |
| `templates/institution_detail.html` (rewritten) | `/opt/anqiao-crm/templates/institution_detail.html` | 6239 bytes, mtime 14:30, extends base |
| `templates/institution_create.html` (rewritten) | `/opt/anqiao-crm/templates/institution_create.html` | 3100 bytes, mtime 14:30, extends base |
| `templates/contact_create.html` (rewritten) | `/opt/anqiao-crm/templates/contact_create.html` | 4190 bytes, mtime 14:30, extends base |
| `templates/followup_create.html` (rewritten) | `/opt/anqiao-crm/templates/followup_create.html` | 3995 bytes, mtime 14:30, extends base |
| `templates/login.html` (polished) | `/opt/anqiao-crm/templates/login.html` | 4399 bytes, mtime 14:30, references style.css |
| `static/css/style.css` (new) | `/opt/anqiao-crm/static/css/style.css` | 11191 bytes, mtime 14:31 |
| `src/crm/web/main.py` (modified) | `/opt/anqiao-crm/src/crm/web/main.py` | 27842 bytes, mtime 14:31 |

## Service restart and health verification

[VERIFIED] `sudo systemctl restart anqiao-crm` → service `active`

[VERIFIED] Health check: `curl http://127.0.0.1:8200/health` →
`{"status":"healthy","service":"anqiao-crm-api","version":"0.1.0"}`

[VERIFIED] Page rendering (loopback):
- `/login` → HTTP 200, references `style.css`
- `/dashboard` → HTTP 200
- `/static/css/style.css` → HTTP 200

[VERIFIED] External HTTPS access:
- `https://crm.aibrain.wiki/login` → HTTP 200, references `style.css`
- `https://crm.aibrain.wiki/static/css/style.css` → HTTP 200

## What was NOT changed

- No nginx/TLS/DNS changes (existing config proxies to port 8200)
- No database migration (no schema change — UI-only)
- No new dependencies (existing venv has all required packages)
- No `alembic upgrade head` needed (no migration)

## Login credentials for visual acceptance

- Administrator: `admin` / `admin123`
- Business user: `user_synthetic` / `user123`
- URL: `https://crm.aibrain.wiki`

## Remaining gate

Browser visual acceptance by the product owner.
