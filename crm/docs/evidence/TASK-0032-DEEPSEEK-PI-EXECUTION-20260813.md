# TASK-0032 DeepSeek-in-PI execution record (2026-08-13)

- Task: TASK-0032 (corrected W5 production release, DEC-0141)
- Status: **EXECUTED — W5 RELEASE COMPLETE (HANDOFF-ONLY) — awaiting Codex
  independent review (NOT self-accepted)**
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Authority: `DEC-0141`; approved `SPEC-0012 v0.2.0`

## Sequence executed

1. **Phase 1 (local)** — SPEC-0012 hash match; HEAD `59101b80…`; governance
   PASS.
2. **Phase 2 (preflight)** — identity/glibc; DB `0001_initial_schema`;
   `alembic_version.version_num` varchar(32); staged code compiles; wheelhouse
   (39) + lock present; backup dump sha256 `42358275…` valid.
3. **Phase 3 (widen)** — `ALTER TABLE alembic_version ALTER COLUMN version_num
   TYPE varchar(64);` → exit 0; re-verified varchar(64).
4. **Phase 4 (stop)** — `sudo -n systemctl stop anqiao-crm` → 0.
5. **Phase 5 (code swap)** — staged release paths over live
   src/templates/static/migrations/alembic.ini/pyproject.toml; scripts/shared/
   venv/backup untouched.
6. **Phase 6 (venv)** — old venv → `venv-pre-release-2-20260813092950`; venv
   recreated at final path; offline hash-enforced install exit 0 (39 exact
   frozen versions); pip check 0; uvicorn shebang correct.
7. **Phase 7 (migrate)** — `alembic upgrade 0005…` → **exit 0**; chain
   0001→0002→0003→0004→0005 applied (erasure_records, import_batches +
   import_row_results, opportunity_reminders, AI-reasoning columns).
8. **Phase 8 (start)** — `sudo -n systemctl start anqiao-crm` → 0.
9. **Phase 9 (verify)** — `GET /login` → **200**; DB revision =
   `0005_opportunity_reminders_ai_reasoning`; new tables present; `pip check`
   clean; fastapi 0.136.3 / starlette 1.6.0.
10. **Phase 10 (rollback)** — not needed.

## Attestations

No log command; no secret/environment value read or printed (database.env
sourced for the migration only); mutations limited to the authorized ALTER,
code/venv swaps, forward migration, and service restart; no nginx/DNS/TLS
change; no database restore/downgrade; no commit/push.

## Evidence

- `docs/evidence/TASK-0032-W5-PRODUCTION-RELEASE-20260813.md`
- this execution record
- Task card: `docs/tasks/active/TASK-0032-corrected-w5-production-release.md`
- Handoff: `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0032-W5-PRODUCTION-RELEASE.md`
- Status/index: `docs/NOW.md`, `docs/tasks/TASKS.md`

## Awaiting

`CODEX_INDEPENDENT_REVIEW`
