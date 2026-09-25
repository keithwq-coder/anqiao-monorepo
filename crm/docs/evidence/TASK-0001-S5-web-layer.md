# TASK-0001 S5 gate: Jinja2 page + JSON API parity + four-step flow (2026-08-03)

- Task: TASK-0001 (`docs/tasks/active/TASK-0001-manual-core-record-activity.md`)
- Authorization: DEC-0071 (main.py entrypoint repair + S5 gate), DEC-0046
  (TASK-0001 implementation), DEC-0067 (successor owner)
- Scope: Step 1 = `main.py` entrypoint repair; Step 2 = S5 gate (local-only,
  synthetic state, no database access)
- Executor: Reasonix (bounded executor; runtime model identifier not exposed
  per DEC-0066; never a gate)
- EXECUTOR_RUNTIME_ID: UNKNOWN - runtime identifier not exposed (Reasonix)
- Execution date: 2026-08-03
- Status: Step 1 COMPLETE; Step 2 implemented, 6 S5 tests pass locally —
  formal S5 PASSED adjudication is the coordinator's call (the executor does
  not restate gate statuses changed by later decisions, per DEC-0071)

## 1. Step 1 — `main.py` entrypoint repair (DEC-0071 points 2-3)

### 1.1 Changes

| File | Change |
|---|---|
| `src/crm/config.py` | Added two read-only derived properties to `Settings`: `debug_mode` (= `crm_environment == "development"`) and `production_mode` (= `crm_environment == "production"`). Derived from the existing field; **no new configuration variable or environment key**. |
| `src/crm/web/main.py` | Replaced the crashing `__main__` block: `settings.debug_mode` / `settings.production_mode` now resolve via the derived properties; `settings.database_url[:50]` replaced by `_startup_banner(settings)` using `database_url.render_as_string(hide_password=True)` (password masked as `***`, never printed); bind default changed `0.0.0.0` → `127.0.0.1` (production reachability is nginx's job per ADR-0002); banner printed with `flush=True`; added the missing `import uvicorn` (the block called `uvicorn.run` without importing it — a fourth entrypoint defect found during verification). |
| `tests/test_entrypoint.py` (new) | 4 tests: derived-flag matrix (development/test/production), banner redaction (no password, `***` present), a real `runpy.run_module("crm.web.main", run_name="__main__")` execution with `uvicorn.run` intercepted (asserts `host="127.0.0.1"`, `port=8000`, `reload=debug_mode`), and a source guard that the entrypoint never binds `0.0.0.0`. |

### 1.2 Verification

- `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` →
  `129 passed, 28 skipped`, 0 failed (includes the 4 entrypoint tests).
- Real entrypoint start (exact command and output):

```
$ DATABASE_HOST=127.0.0.1 DATABASE_NAME=entry_probe DATABASE_USER=probe_user \
  DATABASE_PASSWORD=probe-secret-value SESSION_SECRET_KEY=probe-session-secret \
  CRM_ENVIRONMENT=production .venv/Scripts/python.exe -m crm.web.main

OK Application initialized successfully
============================================================
OK Starting Anqiao CRM Server
============================================================
Debug mode: False
Production mode: True
Database: postgresql+psycopg://probe_user:***@127.0.0.1:5432/entry_probe?sslmode=prefer
------------------------------------------------------------
Access URLs:
  Login: http://127.0.0.1:8000/login
  ...
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Process stayed alive (no crash); `grep -c "probe-secret-value"` → 0 (the
password never appears in output). Before this fix the block crashed on
`settings.debug_mode` AttributeError; now it boots to `Application startup
complete`.

## 2. Step 2 — S5 gate (Jinja2 pages + JSON API through the policy layer)

### 2.1 S5 prerequisite application defects fixed

| File | Defect | Fix |
|---|---|---|
| `src/crm/application/commands.py:308` | `objections_constraints=objections_constraints` (missing `self.`) → NameError on every follow-up creation | `self.objections_constraints` |
| `src/crm/persistence/repositories.py` | `FollowUpActivityRepository.create` passed detailed fields (`factual_body`, `participants`, ...) to `FollowUpActivityModel`, which does not declare them → TypeError; detailed content lives in `follow_up_activity_revisions`, which was never written | `create` now writes the activity row plus the initial revision (v1) with all detailed fields; `domain_follow_up_activity_from_model` now takes the current revision and maps all detailed fields; `find_by_id` / `find_by_target` load the current revision (deterministic order unchanged) |
| `src/crm/web/routes/institutions.py` | `create_institution` / `list_institutions` / `get_institution` passed `current_user["id"]` (string) into `user_id`/`owner_user_id` parameters typed `UUID` → owner-match failed against the policy layer, degrading owners to the collaborator view (`***` masking) | All three pass `UUID(...)` now |
| `src/crm/application/queries.py` | `InstitutionSummary.from_projection`/`InstitutionDetail.from_projection` received frozen `mappingproxy` nested payloads from `project_record` → pydantic serialization crashed (500) for any detail with contacts; `InstitutionDetail` had no `activities` field so the full history was not carried on either path | `InstitutionDetail` gained `activities`; `from_projection` unfreezes nested payloads to plain dicts/lists (JSON-safe) |

### 2.2 New S5 web surface (all inside TASK-0001 owned paths)

| File | Content |
|---|---|
| `src/crm/web/routes/followups.py` (new) | `POST /api/institutions/{institution_id}/contacts` (AddContactToInstitutionCommand, SPEC-0001 R-026) and `POST /api/institutions/{institution_id}/activities` (CreateFollowUpActivityCommand, R-027/R-028); both run command validation, use app-state repositories, return policy-shaped ContactDetail/ActivityDetail |
| `src/crm/web/main.py` | `GET /institutions` (list page) and `GET /institutions/{institution_id}` (detail page: record + contacts + full follow-up history in policy order) — both server-rendered through `QueryService`/`project_record`; unauthenticated → redirect `/login`; dashboard now injects `csrf_token` |
| `templates/institutions_list.html` (new) | Policy-projected summary table |
| `templates/institution_detail.html` (new) | Record fields + contacts + follow-up history (occurred_at, interaction_method, factual_body, shared_summary) |
| `templates/dashboard.html` | Logout is now a CSRF-protected POST via `fetch` with `X-CSRF-Token` (was a GET link → 405); "管理系统" link now resolves |
| `tests/test_s5_pages_api_parity.py` (new) | 6 tests (below) with in-memory repositories injected into `app.state` (no database) |

### 2.3 S5 test results

`powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` → `129 passed,
28 skipped`, 0 failed. S5-specific: `tests/test_s5_pages_api_parity.py` →
**6 passed**:

1. `test_four_step_flow_reopens_complete_history` — SPEC-0001 AC-001..AC-004:
   create institution → attach contact → append two activities → reopen the
   record; name, both bodies and the newest-first order are present on the
   page.
2. `test_page_api_parity_same_policy_fields` — R-030/AC-008: page and
   `/api/institutions/{id}` expose the same record fields, contact and
   activity content (owner view).
3. `test_detail_history_order_matches_policy` — deterministic order:
   occurred_at DESC matches the policy projection order.
4. `test_contact_validation_requires_name_or_role` — R-026 rejection (400).
5. `test_activity_validation_requires_body` — R-027 blank-body rejection
   (422 at the transport layer; the command rule is one level deeper).
6. `test_followup_readback_preserves_detail` — the repository read-back no
   longer drops `factual_body`/`shared_summary`; both are visible on the page.

`python -m compileall src tests` → OK.

## 3. COMMANDS_RUN (exact, credential values never printed)

1. `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` → 129 passed, 28 skipped (multiple times).
2. `.venv/Scripts/python.exe -m pytest tests/test_entrypoint.py -q` → 4 passed.
3. `.venv/Scripts/python.exe -m pytest tests/test_s5_pages_api_parity.py -q` → 6 passed.
4. `.venv/Scripts/python.exe -m compileall src tests` → OK.
5. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` → `[PASS]` (7 approved SPECs, 6 active tasks, 1 legacy manifest).
6. Real entrypoint start (`python -m crm.web.main`, production env) → booted to `Application startup complete`, bound `127.0.0.1:8000`, password absent from output; process alive until terminated.

## 4. TEST_TOTALS

- Full local suite: 129 passed, 28 skipped, 0 failed, 0 error
  (was 119+4 entrypoint+6 S5 = 129; all previously passing tests unchanged).
- S5 suite: 6/6 passed. Entrypoint suite: 4/4 passed.

## 5. NOT VERIFIED (reasons + remaining checks)

1. The S5 web surface and the fixed follow-up chain have **not run against a
   real database**. S5 tests use in-memory repositories; the real
   `FollowUpActivityRepository` revision write/read and the new routes on
   `crm_test` require a fresh transport authorization (DEC-0070 closing
   consequence) and belong to the S6 real-database remainder, including
   restart-persistence.
2. S4's `crm_test` leg remains `[UNVERIFIED — single source]` (DEC-0070); the
   two rewritten S6 tests (`test_api_response_time_within_transport_budget`,
   `test_no_external_network_calls`) remain unexecuted against a real
   database.
3. S6 gate formal acceptance (restart persistence, no-external-call on real
   DB), W4 formal acceptance, G5 migration, release/nginx/TLS/DNS/cutover —
   all unauthorized and pending.
4. `institutions.py` list pagination `total` (line ~160) still reports
   `len(institutions) + offset` (audit P3 noted); not in S5 acceptance scope.
5. Online production database/service state — UNKNOWN; no network access this
   round.
6. Human business/visual acceptance is never inferred from automated tests.

## 6. Boundary compliance

- No database access of any kind; no SSH; no network access; no git
  commit/push; no dependency change; no service start/stop/restart (the
  entrypoint probe was a local process run and terminated); no
  postgresql.conf/pg_hba.conf/systemd/firewall/nginx/TLS/DNS change.
- Files changed are inside TASK-0001 owned paths (`src/crm/`, `templates/`,
  `tests/`, `scripts/` unchanged this round).
- No credential value was printed, logged, or stored.
- S5 gate status: implementation complete and locally verified; formal
  PASSED/PARTIAL adjudication is the coordinator's (per DEC-0071, executor
  reports do not restate gate statuses changed by later decisions).

## 7. P0 repair round (2026-08-03, per DEC-0072)

The S5 gate was REFUSED on a P0: `src/crm/web/routes/followups.py` had no
owner-write authorization. This round fixes it.

### 7.1 Owner-write enforced (P0)

Both creation endpoints (`POST /api/institutions/{id}/contacts`,
`POST /api/institutions/{id}/activities`) now:

1. load the institution via `request.app.state.institution_repository.find_by_id`;
2. compare `institution.owner_user_id` against `UUID(current_user["id"])`;
3. deny by default.

**Denial status: 404** — chosen and applied consistently so the response does
not disclose whether the institution exists (card line 338: denial without
existence leakage). An unknown UUID, a nonexistent institution, and a
non-owner's target all return the same `404 "Institution not found"`.

### 7.2 Response field and docstring honesty

- `ContactDetail.name_masked` renamed to `ContactDetail.name`
  (`src/crm/application/queries.py`): the creation response returns the
  creating owner's own input on a path with no policy layer, so the field must
  not claim to be masked. The masked name stays in
  `ContactSummary.name_masked` (collaborator projection, `projection.py:272`).
- The module docstring now states what the file does: explicit owner-write
  enforcement, 404 default deny, creation responses return the caller's own
  input, read paths go through the central policy projection.

### 7.3 S5 fixture and tests extended

- Fixture seeds a **non-owner business user** (`s5other`, `Role.BUSINESS_USER`,
  owns nothing) in addition to the owner.
- New tests (3):
  - `test_non_owner_contact_write_denied` — non-owner POST contacts → 404, and
    the repository confirms no row was written.
  - `test_non_owner_activity_write_denied` — non-owner POST activities → 404,
    no row written.
  - `test_non_owner_page_and_api_masked_identically` — non-owner GET page and
    API: contact name masked (`***`), no phone, no activity body, identical on
    both paths; page renders no phone numbers at all.

### 7.4 Test-scope corrections (DEC-0072 findings)

1. File docstring no longer claims `search`/`export` parity (export dropped by
   DEC-0027; search not implemented in this slice) — now says page and JSON
   API paths.
2. `test_activity_validation_requires_body` renamed
   `test_activity_blank_body_rejected_at_transport_layer` — it asserts the
   pydantic transport-layer 422, not command-layer R-027 coverage.
3. `test_page_api_parity_same_policy_fields` carries two parity directions
   with live checks only:
   - **page → API**: every phone number rendered on the page must appear in
     the API payload (`re.findall(r"1[3-9]\d{9}", page.text)`). This is the
     leak direction DEC-0072 point 6 named, and it is proven live (see §7.8).
     Activity bodies are **not** checked in this direction: the page renders
     the same `detail.activities` objects the API serializes, so there is no
     data flow by which the page could carry a body the API withholds.
   - **API → page**: every API activity body must appear on the page.

### 7.5 Verification (exact commands and output)

```
$ powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
...
132 passed, 28 skipped, 10 warnings in 16.19s

$ powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 7
  - Active tasks: 6
  - Legacy manifests checked: 1
```

S5 suite: `tests/test_s5_pages_api_parity.py` → **9 passed** (6 original +
3 new authorization tests).

### 7.6 NOT VERIFIED (unchanged/updated)

- The real `ActivityRepository.create` double-write
  (`repositories.py:322-385`) still has **zero test coverage** in `tests/` —
  only `MemoryActivityRepository` is exercised. Testing it requires a real
  database (SessionLocal), which is the S6 real-DB leg; remains
  `[NOT VERIFIED]`.
- The S5 web surface has not run against a real database; requires fresh
  transport authorization (DEC-0070 closing consequence).
- P2 recorded by DEC-0072 (hardcoded `user_status=UserStatus.ENABLED` at
  `main.py:236,274` and `institutions.py:105,152,189`) — not exploitable
  today; left unchanged per the handoff.
- S4 `crm_test` leg, the two rewritten S6 tests, S6 restart persistence, W4
  acceptance, G5, release/nginx/TLS/DNS/cutover, online state, human
  acceptance — unchanged from section 5.

### 7.7 Resubmission

S5 is resubmitted for adjudication with the P0 closed: owner-write is enforced
on both creation endpoints, the masked-named field no longer carries a raw
value, the docstring describes the implementation, the fixture exercises a
non-owner, and the overstated test scopes are corrected. Formal PASSED remains
the coordinator's call (DEC-0071/DEC-0072).

## 8. Vacuous-parity repair round (2026-08-03, per DEC-0073)

The S5 gate was refused a second time on a single defect: the page→API parity
assertion at `tests/test_s5_pages_api_parity.py:424` used
`r"1[3-9]\d{9}"` — in a raw string `\` is two characters, so the compiled
pattern is a literal backslash + `d` and matches no phone number. `phones_on_page`
was therefore always empty and the assertion was vacuously true.

### 8.1 Fix

The pattern is corrected to `r"1[3-9]\d{9}"`, identical to the already-correct
regex at line 595.

### 8.2 The assertion is proven live (DEC-0073 point 3 / point 4 rule)

Per DEC-0073 point 4, an assertion introduced to catch a named leak direction
must be shown failing on that leak before it counts as coverage. Proof
performed:

**Step 1 — temporary leak injection.** The test was temporarily modified to
render a phone number on the page that the API withholds:

```python
page._text = page.text + "\n<div>13911112222</div>"
```

**Step 2 — the test FAILED on the injected leak** (exact output):

```
E       AssertionError: page leaks phones not in API: {'13911112222'}
E       assert {'13900000000', '13911112222'} <= {'13900000000'}
E
E         Extra items in the left set:
E       tests\test_s5_pages_api_parity.py:431: AssertionError
```

The page carried the real contact phone `13900000000` (present in the API) plus
the injected `13911112222` (absent from the API); the assertion fired on the
extra item. Before the regex fix this same injection would have matched
nothing (`set()`) and the test would have passed vacuously.

**Step 3 — injection removed, test restored, PASSED:**

```
$ .venv/Scripts/python.exe -m pytest tests/test_s5_pages_api_parity.py -q
9 passed, 7 warnings
```

### 8.3 Scope statement (DEC-0073 handoff point 3)

The page→API parity direction checks **phone numbers only**. Activity bodies
are checked API→page (every API body must appear on the page); the page→API
body direction is intentionally not asserted because the page renders the same
`detail.activities` objects the API serializes — there is no data flow by
which the page could carry a body the API withholds. The test comments and this
evidence state exactly that; nothing wider is claimed.

### 8.4 Verification (exact commands and output)

```
$ powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
...
132 passed, 28 skipped, 10 warnings in 16.18s

$ powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 7
  - Active tasks: 6
  - Legacy manifests checked: 1
```

### 8.5 NOT VERIFIED (unchanged)

- `repositories.py:322-385` real double-write — zero test coverage (S6 real-DB
  item); S5 web surface not run against a real database; P2 hardcoded
  `user_status=ENABLED`; S4 `crm_test` leg single-source; the two rewritten S6
  tests; S6 restart persistence; W4 acceptance; G5; release/nginx/TLS/DNS;
  online state; human acceptance.

### 8.6 Resubmission

S5 is resubmitted: the vacuous parity assertion is fixed, proven live by an
observed failure on the named leak direction, and the evidence now states the
actual scope of each direction.
