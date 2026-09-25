# HANDOFF-20260803-DEEPSEEK-MAIN-REPAIR-S5

- Task: TASK-0001 (manual core record/activity)
- From tool/model: ZCode agent (coordinator/architect role); model identity is
  executor self-report or UNKNOWN per DEC-0066
- To tool/model: DeepSeek (implementation executor, self-reported)
- Handoff status: HANDOFF-ONLY
- Repository state: branch `main`, **no commits yet** (`git log` reports
  "does not have any commits yet"); working tree entirely untracked
- Written at: 2026-08-03, local time

## Required reading

- `AGENTS.md` (full)
- `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`
- `docs/decisions/DECISION-LOG.md` — **DEC-0071** (this round's authorization),
  DEC-0070 (S4/S6 reclassification), DEC-0069/DEC-0068 (transport limits),
  DEC-0046 (TASK-0001 authorization), DEC-0059 (public debug service risk)
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — S5/S6 rows at
  lines 282-284; owned paths at line 163
- `docs/specs/30-approved/` — SPEC-0001, SPEC-0002, SPEC-0008
- `docs/evidence/TASK-0001-S6-GATE-DEPENDENCIES-AUDIT.md`

## Verified current state

- [VERIFIED] `scripts/dev-test.ps1` run by the coordinator on 2026-08-03:
  `119 passed, 28 skipped, 2 warnings`, 0 error.
- [VERIFIED] `scripts/check-governance.ps1`: `[PASS]`, 7 approved SPECs,
  6 active tasks, 1 legacy manifest.
- [VERIFIED] Four prior code repairs confirmed real:
  `src/crm/web/routes/institutions.py` has zero `Depends(lambda` and uses
  `_get_query_service` (lines 56, 131, 175) with real `roles=frozenset(...)`
  (lines 105, 152, 189); `src/crm/application/commands.py` has zero
  `crm.domain.identity` references; `src/crm/application/queries.py` defines
  `from_projection` (lines 41, 67), consumed at lines 196, 244.
- [VERIFIED] S4 is PARTIAL and S6 is PARTIAL per DEC-0070. The prior report's
  `S4 -> PASSED` claim was re-adjudicated to `partial` by DEC-0071.
- [VERIFIED] `src/crm/web/main.py:266-286` `__main__` block has three defects:
  `settings.debug_mode` (270), `settings.production_mode` (271),
  `settings.database_url[:50]` (272). `Settings` in `src/crm/config.py:11-27`
  declares neither boolean; `database_url` (`config.py:52`) returns a SQLAlchemy
  `URL` object, not a sliceable string.
- [VERIFIED] `src/crm/web/main.py:282` binds `host="0.0.0.0"`.
- [VERIFIED] No test imports the `__main__` block, so the green local suite does
  not cover the entrypoint.
- [VERIFIED] `docs/tasks/active/TASK-0001-...md:389-395` still contains a stale
  historical status block saying `S4 PASSED`. Lines 4 and 282 are authoritative.

## Changes made

None by this handoff. The coordinator wrote only:

- `docs/decisions/DECISION-LOG.md` — added DEC-0071.
- `docs/handoffs/HANDOFF-20260803-DEEPSEEK-MAIN-REPAIR-S5.md` — this file.

No application code was touched by the coordinator.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `powershell -File scripts/dev-test.ps1` | local Windows, no PG gates | 119 passed, 28 skipped, 0 error | this file |
| `powershell -File scripts/check-governance.ps1` | local | `[PASS]` | this file |
| `grep` audit of the four claimed repairs | local | all four confirmed | this file |
| `grep`/`Read` of `main.py` + `config.py` | local | three entrypoint defects confirmed | this file |

## Failed or not verified

- [UNVERIFIED — single source] The prior round's 25 gated `crm_test` passes. The
  SSH forward was terminated with no retained log; not reproducible.
- [NOT VERIFIED] The two rewritten S6 tests
  (`test_api_response_time_within_transport_budget`,
  `test_no_external_network_calls`) have never run against a real database.
- [NOT VERIFIED] S5 gate; S6 restart-persistence; S6 formal acceptance.
- [NOT VERIFIED] W4 formal acceptance; G5 migration; release, nginx/TLS/DNS,
  legacy cutover — all remain unauthorized.
- [UNKNOWN] Online production database and service state. No network access.

## Next bounded action

Two steps, in order, both local-only and both inside DEC-0071's authorization.

**Step 1 — repair the `main.py` entrypoint** (`src/crm/web/main.py:266-286`):

- Derive `debug_mode` and `production_mode` from the existing
  `crm_environment` field in `src/crm/config.py`. Do not add a new
  configuration variable or environment key.
- Replace `settings.database_url[:50]` with a redacted rendering. The password
  is a `SecretStr` and must never be printed.
- Change the bind default from `0.0.0.0` to `127.0.0.1` per DEC-0071 point 3.
- Add a test that actually imports and exercises the entrypoint-configuration
  path, since none exists today.
- Verify: `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` and
  a real `python -m crm.web.main`-equivalent start that currently crashes must
  stop crashing. Report the exact command and output.

**Step 2 — S5 gate**: Jinja2 page + JSON API parity + four-step flow against
SPEC-0001/SPEC-0002, local-only, synthetic state only.

**Prohibited without a new decision entry**: any `crm_test` or production
database access, any SSH transport, any commit, any deployment, and any change
outside the TASK-0001 owned paths.
