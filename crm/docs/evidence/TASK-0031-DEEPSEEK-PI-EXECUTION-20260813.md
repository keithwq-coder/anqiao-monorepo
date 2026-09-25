# TASK-0031 DeepSeek-in-PI execution record (2026-08-13)

- Task: TASK-0031 (full W5 production release, DEC-0139)
- Status: **EXECUTED — BLOCKED at database migration (revision-id length
  defect); clean rollback executed; service restored HTTP 200; DB unchanged at
  0001 — awaiting Codex independent review (NOT self-accepted)**
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Authority: `DEC-0139`; approved `SPEC-0012 v0.2.0`

## Sequence executed

1. **Phase 1 (local)** — completed: SPEC-0012 hash match; HEAD `59101b80…`;
   release archive SHA-256 `c856aa8c…` (matches TASK-0027-reviewed payload);
   80 entries; migrations 0001–0005 only. (A stray repo artifact from a first
   `git archive -o` attempt was detected and removed immediately.)
2. **Phase 2 (preflight)** — completed: identity/glibc 2.39/9.3G; DB
   `0001_initial_schema`; current venv pip check reproduces the fastapi/
   starlette mismatch; wheelhouse (39) + lock present.
3. **Phase 3 (backup)** — completed:
   `/opt/anqiao-crm/backup/pre-release-20260813085841/` (0700) with
   `database.dump` (sha256 `42358275…`) and `app-code-old.tar.gz`
   (sha256 `dc31613e…`).
4. **Phase 4 (stage)** — completed: archive sha256 match; extracted to
   `/opt/anqiao-crm/tmp/task0031-20260813085841/`; compile exit 0; migrations
   0001–0005.
5. **Phase 5 (stop)** — `sudo -n systemctl stop anqiao-crm` → 0.
6. **Phase 6 (code swap)** — completed: live src/templates/static/migrations/
   alembic.ini/pyproject.toml replaced; scripts/shared/venv/backup untouched.
7. **Phase 7 (venv, relocation-safe)** — completed: venv recreated at
   `/opt/anqiao-crm/venv` final path; offline hash-enforced install exit 0
   (39 exact frozen versions); pip check 0; uvicorn shebang correct.
   Phase 7.5: `alembic heads` = `0005_opportunity_reminders_ai_reasoning`.
8. **Phase 8 (migrate)** — **BLOCKED**: `alembic upgrade
   0005_opportunity_reminders_ai_reasoning` exit 1 —
   `StringDataRightTruncation: value too long for type character varying(32)`
   on the `alembic_version` update (revision id 41 chars > varchar(32)).
   Because env.py wraps all migrations in one transaction, the entire upgrade
   rolled back atomically; DB unchanged at `0001_initial_schema` (read-only
   psql verified: 10 original tables, no new tables).
9. **Phases 9–10** — not reached.
10. **Phase 11 (rollback)** — completed: old code restored from backup; old
    venv restored; service started; **HTTP 200**; DB still `0001`.

## Blocking defect (recorded, not patched)

`alembic_version.version_num` is `character varying(32)` (alembic default);
the 0005 revision id `0005_opportunity_reminders_ai_reasoning` is 41
characters. Fixing requires either widening that column (a database DDL beyond
the authorized "forward alembic upgrade") or changing the 0005 revision id
(a release-payload change) — both are separate, separately-authorized
decisions. The local SQLite test suite does not enforce varchar length, which
is why TASK-0029B's 341 tests did not catch it.

## Preserved artifacts for a corrected next attempt

- Staged release code: `/opt/anqiao-crm/tmp/task0031-20260813085841/`
- Frozen-lock venv (correct shebangs): `/opt/anqiao-crm/venv-failed-20260813085841/`
- Backup: `/opt/anqiao-crm/backup/pre-release-20260813085841/`

## Attestations

No log command; no secret/environment value read or printed (database.env was
sourced for the migration process only); no database mutation persisted (the
single migration transaction rolled back); no nginx/DNS/TLS change; no
commit/push.

## Evidence

- `docs/evidence/TASK-0031-W5-PRODUCTION-RELEASE-20260813.md`
- this execution record
- Task card: `docs/tasks/active/TASK-0031-full-w5-production-release.md`
- Handoff: `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0031-W5-PRODUCTION-RELEASE.md`
- Status/index: `docs/NOW.md`, `docs/tasks/TASKS.md`

## Awaiting

`CODEX_INDEPENDENT_REVIEW`
