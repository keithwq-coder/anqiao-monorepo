# HANDOFF-20260803-DEEPSEEK-S6-REALDB

- Task: TASK-0001 (manual core record/activity)
- From tool/model: ZCode agent (coordinator/architect)
- To tool/model: DeepSeek V4 Flash (product-owner-stated identity; per DEC-0066
  reputation is not evidence — output is judged only against the SPEC and the
  verification commands)
- Handoff status: HANDOFF-ONLY
- Repository state: branch `main`, **no commits yet**; working tree untracked
- Written at: 2026-08-03, local time

## Required reading

- `AGENTS.md` (full)
- `docs/decisions/DECISION-LOG.md` — **DEC-0076** (this round's authorization),
  **DEC-0075** (S6 local leg PASSED + the request that was approved),
  **DEC-0069** (the transport model and its prohibitions), DEC-0070 (why
  retained logs are mandatory), DEC-0073 point 4 (standing evidence rule)
- `docs/NOW.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — line 4, S6 row
- `docs/evidence/TASK-5A-verification.md` — lines 218-219 and 442-459 record the
  exact working route; reuse it, do not invent a new one
- `docs/evidence/TASK-0001-S6-local-no-external-call.md` — section 4 inventory

## Verified current state

- [VERIFIED] `scripts/dev-test.ps1`: `133 passed, 28 skipped`, 0 failed.
- [VERIFIED] `scripts/check-governance.ps1`: `[PASS]`.
- [VERIFIED] S5 PASSED (DEC-0074). S6 local leg PASSED (DEC-0075). S6 overall
  PARTIAL.
- [VERIFIED] The working route: test-only role `crm_test_runner` over an SSH
  local port forward to the server's loopback PostgreSQL endpoint. Credentials
  live in `.env.crm_test_local`, confirmed gitignored (`.gitignore:3:.env.*`).
  Key names only: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`,
  `DATABASE_USER`, `DATABASE_PASSWORD`.
- [VERIFIED] Prior forwards used local ports 55432 (executor) and 55433/55434
  (coordinator). Pick your own and record it.
- [VERIFIED] `crm_test` and its synthetic seed are retained per DEC-0070 point 3,
  so the database and a synthetic `admin` (`administrator` + `business_user`)
  should already exist.
- [VERIFIED] `tests/test_s6_integration.py` is gated at module level (lines
  24-27) on `CRM_RUN_POSTGRESQL_TESTS=1`; 19 tests collect when enabled.
- [VERIFIED] No test constructs a real repository:
  `grep -rn "FollowUpActivityRepository(" tests/` → 0 hits; the
  `InstitutionRepository(`/`ContactRepository(` hits are all `Memory*` variants.

## Changes made

None to application code. The coordinator wrote only:

- `docs/decisions/DECISION-LOG.md` — added DEC-0076 recording the approval.
- `docs/handoffs/HANDOFF-20260803-DEEPSEEK-S6-REALDB.md` — this file.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `powershell -File scripts/dev-test.ps1` | local, no PG gates | 133 passed, 28 skipped, 0 failed | this file |
| `powershell -File scripts/check-governance.ps1` | local | `[PASS]` | this file |
| Coordinator leak injection into the local S6 guard | local | guard failed as required, restored to identical SHA-256, residue 0 | DEC-0075 |
| `git check-ignore -v .env.crm_test_local` | local | ignored by `.gitignore:3` | this file |
| `grep -rn "FollowUpActivityRepository(" tests/` | local | 0 hits | this file |

## Failed or not verified

- [NOT VERIFIED] All three elements this round is authorized to verify.
- [UNVERIFIED — single source] S4's `crm_test` leg (DEC-0070 point 4).
- [OPEN, P2] Hardcoded `user_status=UserStatus.ENABLED` (`main.py:236,274`;
  `institutions.py:105,152,189`); non-exploitable because `auth.py:371`
  invalidates non-ENABLED sessions. Do not fix it this round.
- [NOT VERIFIED] W4 formal acceptance; G5; release, nginx/TLS/DNS, cutover.
- [UNKNOWN] Online production database and service state.

## Next bounded action

Authorized by DEC-0076. Verification only — if you find a defect, report and
stop; repairing code beyond these three elements needs separate authorization.

**Order matters. Do the isolation proof before any write.**

1. Open your own SSH local port forward to the server's loopback PostgreSQL
   endpoint. Record the local port you chose.
2. **Fail-closed gate first**: prove `SELECT current_database()` returns
   `crm_test` through the forward, before writing anything. If it does not,
   stop and report. Same for SSH auth failure or a rejected
   `.env.crm_test_local` credential — stop, do not work around, do not read any
   rotated server-side secret.
3. Run the gated suite against `crm_test`:
   `CRM_RUN_POSTGRESQL_TESTS=1` with `DATABASE_HOST=127.0.0.1` and your
   forwarded `DATABASE_PORT`. Report the full 19-test outcome. Two of those
   tests were rewritten on 2026-08-03 and have never executed anywhere:
   `test_api_response_time_within_transport_budget` and
   `test_no_external_network_calls`. Call out their individual results.
4. Verify restart persistence: start a **local** uvicorn process against
   `crm_test`, create synthetic records through the API, stop the process,
   restart it, and confirm the records and the deterministic `occurred_at DESC`
   history order survive. Record the exact sequence.
   **This is a local process only.** DEC-0076 point 4 authorizes starting and
   stopping uvicorn on your own machine and nothing on the server: the
   `anqiao-crm` service and every other host service must not be touched.
5. Prove the double-write at runtime: construct the real
   `FollowUpActivityRepository` against `crm_test`, create one activity, and
   confirm both the activity row and its v1 revision were written in one
   transaction and the factual body reads back intact. Per the DEC-0073 point 4
   rule, also show the check can fail — a claim that both rows exist is only
   coverage if you have seen the assertion fail when one is missing.
6. Retained logs are mandatory (DEC-0076 point 5). Write command invocations,
   the `current_database()` proof, test output and the restart sequence into a
   new evidence file under `docs/evidence/`. **No credential values anywhere.**
   S4's leg became single-source because the forward closed with no log; do not
   repeat that.
7. Terminate the SSH forward at the end of the round and say so.
8. Re-run `scripts/dev-test.ps1` and `scripts/check-governance.ps1` locally and
   report their output.

**Prohibited, unchanged from DEC-0069 point 5**: any access to `anqiao_crm` or
any database other than `crm_test`; production real-table read or write;
deployment or release; starting/stopping/restarting or reconfiguring any service
on the server; nginx, TLS, DNS, firewall, `postgresql.conf`, `pg_hba.conf` or
systemd changes; credential rotation; git commit or push; dependency
installation; paid services; anything touching other projects on the host.

Do not fix the P2 hardcoded `ENABLED` and do not refactor anything. If a fourth
element looks worth verifying, name it in `Decisions needed` rather than doing
it.
