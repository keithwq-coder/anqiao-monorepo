# TASK-0001 S6 gate-dependencies independent audit (2026-08-03)

- Task: TASK-0001 (`docs/tasks/active/TASK-0001-manual-core-record-activity.md`)
- Audited report: `docs/evidence/TASK-0001-S6-gate-dependencies.md` (executor:
  Reasonix, 2026-08-02)
- Auditor role: coordinator / architect (ZCode agent). Model identity recorded
  as executor self-report or UNKNOWN per `DEC-0066`.
- EXECUTOR_RUNTIME_ID: UNKNOWN - runtime identifier not exposed
- Audit date: 2026-08-03
- Verdict: **PARTIAL** (reclassified from the report's self-declared `passed`)

## 1. Independently reproduced

| Check | Command | Result |
|---|---|---|
| Local full suite | `.venv/Scripts/python.exe -m pytest tests/ -q` | `119 passed, 28 skipped, 2 warnings`, 0 error — matches the report exactly |
| Governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` (7 approved SPECs, 6 active tasks, 1 legacy manifest) |
| Gated collection | `CRM_RUN_POSTGRESQL_TESTS=1 pytest tests/test_s6_integration.py --collect-only -q` | `19 tests collected`, 0 collection error — the reported collection repair is real |

## 2. Code claims verified by reading the files

All four reported application-code repairs are real defects really fixed, not
cosmetic edits:

- `src/crm/web/routes/institutions.py:44-46` — `_get_query_service(request)`
  exists; the previous `Depends(lambda: request.app.state.query_service)`
  closures referenced an unbound `request` and would have raised on every
  route call.
- Same file, lines 105-106, 152-153, 189-190 — the caller's real roles and
  management scope keys are now passed. The previous hardcoded `frozenset()`
  guaranteed default-deny against the fail-closed policy layer.
- `src/crm/application/commands.py:77-80,175-176,282-284` — the
  `crm.domain.identity` import is gone and account-status validation is
  preserved behind `if user is not None`. Route-layer
  `Depends(get_current_user)` still enforces authentication.
- `src/crm/application/queries.py` — `InstitutionSummary.from_projection` and
  `InstitutionDetail.from_projection` are defined.

Authorization of `scripts/dev-test.ps1`: IN SCOPE. The task card lists
`scripts/dev-test.ps1` as an owned path
(`docs/tasks/active/TASK-0001-manual-core-record-activity.md:163`), so authoring
it falls under `DEC-0046`. `DEC-0069`'s closing line means "not authorized *by
DEC-0069*", not prohibited. An earlier audit reading that treated this as a
violation was wrong and is corrected here.

`test_delete_institution_admin_only` removal: DEFENSIBLE. No DELETE route
exists anywhere under `src/crm/web/` (verified by grep).

Self-reported `main.py` defect: CONFIRMED REAL. `src/crm/web/main.py:270-272`
reads `settings.debug_mode` / `settings.production_mode`, neither of which is
defined in `src/crm/config.py`, and slices `settings.database_url[:50]` where
`database_url` returns a SQLAlchemy `URL` object. Lines 284-285 read
`settings.debug_mode` again. Honest disclosure of a defect the executor left
alone; still open.

Credential hygiene: `.env.crm_test_local` exists locally and is ignored by
`.gitignore:3` (`git check-ignore -v` confirms). No commit exists on this
branch. No credential value appears in any evidence file.

## 3. Findings

### P1-A — the 25-test `crm_test` result is single-sourced and unreproducible

The SSH forward was terminated, no run log or artifact was retained, and the
report does not record the run output. Per `AGENTS.md` section 3 this is
`[UNVERIFIED — single source]`, not evidence. The task card currently derives
`S4 PASSED` (line 282) and `S6 PARTIAL` (line 284) from it.

### P1-B — two scope expansions have no recorded authorization

`DEC-0069` point 3 is written as exhaustive: create the empty `crm_test`, open
the port forward, run read-only isolation checks. Two executed actions fall
outside it:

1. Seeding a synthetic `admin` account plus `role_grants` writes into
   `crm_test`.
2. Running the 19 `test_s6_integration.py` tests. `DEC-0068` authorized six
   `CRM_RUN_POSTGRESQL_TESTS`-gated tests, scoped to TASK-5A, now closed.

The report cites "产品负责人 2026-08-02 明确授权". The decision log ends at
`DEC-0069`; there is no `DEC-0070`. If the product owner did authorize this in
conversation, the acts were legitimate and the defect is the missing record:
chat history is not repository memory (`AGENTS.md` section 7), so no later tool
can see that authorization. UNRESOLVED — awaiting product-owner confirmation.

### P1-C — response-time test name contradicted its assertion (FIXED)

`test_api_response_time_under_500ms` asserted `elapsed < 5.0`. The name and
docstring claimed 500ms while the behavior allowed 5s, a 10x gap that persists
in local runs where SSH RTT is not a factor. Renamed to
`test_api_response_time_within_transport_budget` with the docstring stating the
real 5s budget and that SPEC-0001 sets no response-time SLA. The threshold
itself is unchanged; only the misreporting is removed.

### P1-D — no-external-call test asserted nothing (FIXED)

`test_no_external_network_calls` imported `unittest.mock`, never used it, and
asserted only `status_code == 201`. It could not fail if an external call
occurred, while S6's gate text requires no-external-call verification. Rewritten
to patch `socket.socket.connect` and `socket.create_connection` for the duration
of the request, record every non-loopback destination, and fail on any.

Known limit of this method, stated rather than implied: `psycopg2` connects
through libpq at the C level, so database traffic is not observed by
Python-level socket patching. The check therefore covers Python-level outbound
connections (the realistic path for an accidental HTTP client), not all syscall
traffic. It is a positive check where none existed, not a complete egress proof.

### P2 — sequencing inversion

The task card makes S5 the prerequisite for S6 (line 284) and S5 is `PENDING`.
S6 dependency work ran ahead of it, and `S4 PASSED` cites
`TASK-0001-S6-gate-dependencies.md` — S4 evidence recorded in a file named for
a later stage. Traceability defect, not a correctness defect.

### P3 — pre-existing defects in touched code, deliberately not fixed

Left alone under `AGENTS.md` section 6 (surgical changes; no opportunistic
cleanup). Recorded so S5 can address them under its own scope:

- `src/crm/web/routes/institutions.py:88` — comment says
  `# Will check auth via get_current_user`, describing the code path deleted
  from `commands.py`; the comment is now stale.
- Same file line 65 — `deps_get_current_user` imported and unused.
- Same file line 160 — `total = len(institutions) + offset` is incorrect for
  any page; it cannot report a true total.
- `src/crm/web/main.py:270-272,284-285` — the `__main__` block defects above.

## 4. Verification of this audit's own edits

- Files changed by this audit: `tests/test_s6_integration.py` (two tests),
  this evidence file, and the task-card status lines. All inside TASK-0001
  owned paths (`tests/`, `docs/evidence/TASK-0001-*`, the task card).
- `python -m py_compile tests/test_s6_integration.py` → OK.
- `pytest tests/ -q` → `119 passed, 28 skipped`, 0 error (unchanged; both
  edited tests remain gated and skipped locally).
- `CRM_RUN_POSTGRESQL_TESTS=1 pytest tests/test_s6_integration.py
  --collect-only -q` → `19 tests collected`, 0 error.

## 5. NOT VERIFIED by this audit

1. Both edited tests were NOT executed against a real database. They are gated
   on `CRM_RUN_POSTGRESQL_TESTS=1` and this audit had no `crm_test`
   authorization. Their runtime behavior on `crm_test` is UNVERIFIED, including
   whether the rewritten no-external-call test passes there.
2. The reported 25 gated passes on `crm_test` — see P1-A.
3. S5 gate, S6 restart-persistence, S6 formal acceptance.
4. W4 formal acceptance, G5 migration authorization, release/nginx/TLS/DNS/cutover.
5. Online production database and service state — UNKNOWN; no network access
   this round.
6. Human business/visual acceptance.

## 6. Boundary compliance for this audit

Read-only against production. No network access. No SSH. No database
connection of any kind. No git commit or push. No dependency change. No service
restart. No credential read or print. Edits confined to two test functions,
this evidence file, and task-card status text.
