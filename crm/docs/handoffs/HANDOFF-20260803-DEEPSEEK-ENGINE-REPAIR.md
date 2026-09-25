# HANDOFF-20260803-DEEPSEEK-ENGINE-REPAIR

- Task: TASK-0001 (manual core record/activity)
- From tool/model: ZCode agent (coordinator/architect)
- To tool/model: DeepSeek V4 Flash (product-owner-stated identity; per DEC-0066
  reputation is not evidence)
- Handoff status: HANDOFF-ONLY
- Repository state: branch `main`, **no commits yet**; working tree untracked
- Written at: 2026-08-03, local time

## Required reading

- `AGENTS.md` (full)
- `docs/decisions/DECISION-LOG.md` — **DEC-0078** (this round's authorization),
  **DEC-0077** (the defect and the corrected justification), DEC-0076
  (transport model, including point 4's local-uvicorn allowance), DEC-0069
  (prohibitions), DEC-0073 point 4 (standing evidence rule)
- `docs/NOW.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — line 4, S6 row
- `docs/evidence/TASK-0001-S6-realdb-verification.md` — your own prior round;
  section 2.3 holds the probe data this round builds on

## Verified current state

- [VERIFIED] `scripts/dev-test.ps1`: `133 passed, 28 skipped`, 0 failed.
- [VERIFIED] `scripts/check-governance.ps1`: `[PASS]`.
- [VERIFIED] The defect: `SessionLocal()` (`database.py:27-42`) builds a new
  `Settings()` and a new engine per call. `get_session_factory()` (lines 16-23)
  is the cached path and is called **nowhere** in `src/`.
- [VERIFIED] Blast radius is 22 call sites across six files, re-counted by the
  coordinator: `repositories.py` 10, `user_repository.py` 6,
  `session_repository.py` 4, `audit_repository.py` 1,
  `role_grant_repository.py` 1, `database.py` 1. Your prior report cited only
  `repositories.py`'s 10.
- [VERIFIED] It is on the authenticated hot path — `session_repository.py` 4 and
  `user_repository.py` 6 — so every authenticated request pays the cost.
- [VERIFIED] **The trap you must not copy forward**: `get_session_factory(settings)`
  ignores its `settings` argument after the first call and returns the global
  `_factory`; `grep _factory` finds no reset mechanism anywhere in `src/` or
  `tests/`.
- [VERIFIED] The trap is currently unexercised: no test changes `DATABASE_*`
  mid-process and then calls `SessionLocal()`; `tests/test_migrations.py:75`
  builds its own engine via `sa.create_engine`, bypassing the factory.
- [VERIFIED] Your 3 passed S6 elements stand (DEC-0077): isolation gate, restart
  persistence, double-write with the three-phase fail-proof.

## Changes made

None to application code. The coordinator wrote only:

- `docs/decisions/DECISION-LOG.md` — added DEC-0078.
- `docs/handoffs/HANDOFF-20260803-DEEPSEEK-ENGINE-REPAIR.md` — this file.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `powershell -File scripts/dev-test.ps1` | local | 133 passed, 28 skipped, 0 failed | this file |
| `powershell -File scripts/check-governance.ps1` | local | `[PASS]` | this file |
| `Read src/crm/persistence/database.py:1-70` | local | engine-per-call confirmed at 27-42; cached path at 16-23 | DEC-0077 |
| `SessionLocal()` count per file across `src/crm/persistence/` | local | 22 total across 6 files | DEC-0077 |
| `grep -rn get_session_factory src/` | local | defined + own docstring only; never called | DEC-0077 |
| `grep _factory` in `src/` and `tests/` | local | no reset mechanism | DEC-0078 |
| mtime check of app code after the prior round | local | unchanged; boundaries held | DEC-0077 |

## Failed or not verified

- [UNKNOWN] The S6 response-time element. No measurement separates transport
  cost from application cost.
- [UNVERIFIED — single source] Your probe timings; the coordinator has no local
  PostgreSQL (`pg_isready`/`psql` absent, nothing on 5432) and only one round
  was authorized.
- [NOT VERIFIED] S6 formal acceptance; the gated suite is `18 passed, 1 failed`.
- [UNVERIFIED — single source] S4's `crm_test` leg (DEC-0070 point 4).
- [OPEN, P2] Hardcoded `user_status=UserStatus.ENABLED` (`main.py:236,274`;
  `institutions.py:105,152,189`). Leave it open.
- [NOT VERIFIED] W4 formal acceptance; G5; release, nginx/TLS/DNS, cutover; the
  server-loopback response-time measurement (deferred by DEC-0077 point 6).

## Next bounded action

Two phases, in order. Phase 1 is local. Phase 2 needs the transport.

**Phase 1 — repair `src/crm/persistence/database.py` (this file only)**

1. Change `SessionLocal()` so it reuses a cached session factory instead of
   building a new engine per call.
2. Key the cache on the resolved settings (or the database URL) so a changed
   configuration rebuilds the engine instead of silently returning a stale one.
   Fixing that pre-existing trap is in scope precisely because this repair puts
   the cached path on the hot path.
3. **Do not edit the 22 call sites.** Their signatures stay as they are. If one
   genuinely cannot work without a signature change, stop and report rather than
   widening the change.
4. Local gate: the full suite must stay at `133 passed, 28 skipped`, 0 failed.
   The existing comment "less efficient but safer for tests" says someone hit a
   test-isolation problem before; a non-regressing suite is your evidence that
   the cached path is safe. If it regresses, stop and report — do not weaken any
   test.
5. Per DEC-0073 point 4, if you add any assertion about engine reuse, show it
   failing when the engine is not reused before reporting it as coverage.

**Phase 2 — real-database re-run (after Phase 1's local gate holds)**

6. Open your own SSH local port forward; record the port. Prove
   `SELECT current_database()` returns `crm_test` **before any write**. Stop on
   any fail-closed condition (auth failure, rejected credential, wrong
   database); do not work around, do not read any rotated server-side secret.
7. Re-run the gated `tests/test_s6_integration.py` against `crm_test` and report
   all 19 results, calling out
   `test_api_response_time_within_transport_budget` explicitly with its measured
   time.
8. Retained logs are mandatory. Record invocations, the `current_database()`
   proof and full test output in a new evidence file under `docs/evidence/`.
   **No credential values anywhere.**
9. Terminate the forward at the end and say so.
10. Re-run `scripts/dev-test.ps1` and `scripts/check-governance.ps1` locally.

**If the response-time test still fails**, that is a finding: report the measured
number and stop. Raising or relaxing the 5 s threshold is refused (DEC-0078
point 6). Note that a pass here is evidence about the forward path only; a
production claim still needs the server-loopback measurement, which is not
authorized.

**Prohibited, unchanged from DEC-0069 point 5**: any access to `anqiao_crm` or
any database other than `crm_test`; production real-table read or write;
deployment or release; starting, stopping, restarting or reconfiguring any
service on the server (DEC-0076 point 4 allows only a **local** uvicorn on your
own machine); nginx, TLS, DNS, firewall, `postgresql.conf`, `pg_hba.conf` or
systemd changes; credential rotation; git commit or push; dependency
installation; paid services; anything touching other projects on the host.

No pool tuning beyond what the cached factory needs, no repository refactoring,
and do not fix the P2 hardcoded `ENABLED`.
