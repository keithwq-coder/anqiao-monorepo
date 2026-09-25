# HANDOFF-20260803-DEEPSEEK-S5-P0-OWNER-WRITE

- Task: TASK-0001 (manual core record/activity)
- From tool/model: ZCode agent (coordinator/architect); model identity is
  executor self-report or UNKNOWN per DEC-0066
- To tool/model: DeepSeek (implementation executor, self-reported)
- Handoff status: HANDOFF-ONLY
- Repository state: branch `main`, **no commits yet**; working tree untracked
- Written at: 2026-08-03, local time

## Required reading

- `AGENTS.md` (full)
- `docs/decisions/DECISION-LOG.md` — **DEC-0072** (this adjudication),
  DEC-0071, DEC-0070, DEC-0069/0068, DEC-0046, DEC-0027 (export dropped)
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — line 4,
  lines 282-284, and **line 339** (`owner write; other business user
  read-only; default deny`)
- `docs/specs/30-approved/` — SPEC-0001 (R-026, R-027, R-030, AC-008)
- `docs/evidence/TASK-0001-S5-web-layer.md`

## Verified current state

- [VERIFIED] `scripts/dev-test.ps1`: `129 passed, 28 skipped`, 0 failed.
- [VERIFIED] `scripts/check-governance.ps1`: `[PASS]`.
- [VERIFIED] Entrypoint repair ACCEPTED: `config.py:52,61` derive
  `debug_mode`/`production_mode` from `crm_environment` with no new config key;
  `main.py:27` adds the missing `import uvicorn`; the banner masks the password;
  bind is `127.0.0.1`. `tests/test_entrypoint.py` genuinely covers this via
  `runpy` execution of the real `__main__` block plus a source-level bind guard.
- [VERIFIED] **P0 — no owner-write authorization** in
  `src/crm/web/routes/followups.py`: `institution_repository` appears 0 times,
  `from crm.policy` appears 0 times, both POST routes depend only on
  `get_current_user`, and `command.validate(None)` skips even the
  enabled-status branch at `commands.py:176`. Any authenticated business user
  can write to an institution they do not own.
- [VERIFIED] `followups.py:109` sets `name_masked=contact.name` — raw name in a
  masked-named field, on a path with no policy layer.
- [VERIFIED] `followups.py:3-6` docstring claims a policy layer that is absent.
- [VERIFIED] Why 6/6 missed it: `tests/test_s5_pages_api_parity.py:257` seeds
  exactly one `Role.BUSINESS_USER` who owns everything. No non-owner exists, so
  no masking branch and no cross-owner write is exercised.
- [VERIFIED] `repositories.py:322-385` double-write is now correct but has zero
  test coverage; only `MemoryActivityRepository` is used anywhere in `tests/`.
- [VERIFIED] Hardcoded `user_status=UserStatus.ENABLED` at `main.py:236,274`
  and `institutions.py:105,152,189`; non-exploitable today because
  `auth.py:371` invalidates non-ENABLED sessions. Design defect, P2.

## Changes made

None to application code by this handoff. The coordinator wrote only:

- `docs/decisions/DECISION-LOG.md` — added DEC-0072.
- `docs/handoffs/HANDOFF-20260803-DEEPSEEK-S5-P0-OWNER-WRITE.md` — this file.
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — S5 row and
  status line annotated REFUSED per DEC-0072.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `powershell -File scripts/dev-test.ps1` | local, no PG gates | 129 passed, 28 skipped, 0 failed | this file |
| `powershell -File scripts/check-governance.ps1` | local | `[PASS]` | this file |
| `Read tests/test_entrypoint.py` | local | effective, real `runpy` run | this file |
| `grep` for `institution_repository` / `from crm.policy` in `followups.py` | local | 0 and 0 | DEC-0072 |
| `Read commands.py:147-180` | local | no ownership rule; `validate(None)` skips status branch | DEC-0072 |
| `grep Role.` in S5 test | local | single `BUSINESS_USER` seed | DEC-0072 |
| `grep` real `ActivityRepository` use in `tests/` | local | none | DEC-0072 |

## Failed or not verified

- [NOT VERIFIED] S5 gate — REFUSED on the P0 above.
- [NOT VERIFIED] `repositories.py` repaired double-write (no real-repo test).
- [NOT VERIFIED] Masking across owner / other business user / unauthorized.
- [NOT VERIFIED] The two rewritten S6 tests against a real database.
- [UNVERIFIED — single source] S4's `crm_test` leg.
- [NOT VERIFIED] S6 restart persistence; W4 acceptance; G5; release/nginx/TLS.
- [UNKNOWN] Online production database and service state.

## Next bounded action

Local-only, inside TASK-0001 owned paths, no new authorization needed.

1. Enforce owner-write on both `followups.py` creation endpoints: load the
   institution, compare `owner_user_id`, deny by default. Decide and document
   whether the denial is 404 (no existence leakage, consistent with card line
   338) or 403, then apply it consistently.
2. Fix `followups.py:109` so a masked-named field is never given a raw value,
   and correct the module docstring to describe the real implementation.
3. Extend the S5 fixture with a non-owner business user; add tests that a
   non-owner's contact/activity POST is denied and that the non-owner's page
   and API views are masked identically.
4. Correct the three overstated test scopes: drop `search`/`export` from the
   file docstring (export was dropped by DEC-0027), rename the 422 transport
   test so it no longer claims command-layer R-027 coverage, and make the
   parity assertion bidirectional so a page exposing more than the API fails.
5. Re-run `scripts/dev-test.ps1` and `scripts/check-governance.ps1`; report
   exact commands and output; resubmit S5 for adjudication.

**Prohibited without a new decision entry**: `crm_test` or production database
access, SSH transport, commits, deployment, and any change outside TASK-0001
owned paths.
