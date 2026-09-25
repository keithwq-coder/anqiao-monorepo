# TASK-0008 gap analysis: core record / contact / follow-up workflow

- Task: `docs/tasks/proposed/TASK-0008-core-record-workflow-repair.md` (PROPOSED)
- Prepared: 2026-08-04, authorization-preparation round (no application code)
- Scope: SPEC-0001 R-001~R-016, R-025~R-031, R-035, R-036; SPEC-0002 R-003/R-006/R-013;
  AC-001~AC-012, AC-021~AC-025, AC-028, AC-029
- Evidence grading: per DEC-0073 point 4, wording never exceeds what was actually
  run. `[VERIFIED]` = directly read in a named file or reproduced by a command in
  this round; `[INFERENCE]` = reasoned from verified facts; `[UNKNOWN]` = not
  established; `[NOT VERIFIED]` = requires another environment.
- Status markers: `CLOSED` = behavior present and exercised by an automated test
  (or directly verified in this round); `PARTIAL` = part of the rule present but
  a named piece missing; `OPEN` = not implemented in `src/`.

## 1. Round evidence (what was actually run)

- `[VERIFIED]` Local ungated suite, 2026-08-04:
  `./.venv/Scripts/python.exe -m pytest tests/test_policy_projection.py tests/test_domain_models.py tests/test_s5_pages_api_parity.py tests/test_s4_authentication.py tests/test_task0007_inmemory_fakes.py tests/test_task0007_auth_service.py tests/test_config.py tests/test_entrypoint.py tests/test_module_boundaries.py tests/test_persistence_schema.py tests/test_s6_local_no_external_calls.py tests/test_s6_integration_simple.py -q`
  → `106 passed, 1 skipped` (the skip is the gated PostgreSQL test at
  `tests/test_s4_authentication.py:514-517`, skipped because
  `CRM_RUN_POSTGRESQL_TESTS != 1`). No database was accessed.
- `[VERIFIED]` `from_dict()` behavior reproduced interactively under
  `crm.application.commands`: `hasattr(cls, k)` is `False` for every constructor
  parameter of all three commands; `CreateInstitutionCommand.from_dict({...})`
  raises `TypeError: __init__() missing 5 required positional arguments`.
- `[VERIFIED]` `rg` sweeps over `src/` for `withdraw|correct|archive|duplicate|重复|疑似`
  returned no implementation hits (details in section 4).
- `[NOT VERIFIED]` Gated `crm_test` legs: no database access this round
  (authorization boundary). All real-database statements below are `[UNKNOWN]`.

## 2. Current code baseline (2026-08-04, `src/`)

- Application services: `src/crm/application/commands.py` (3 commands),
  `src/crm/application/queries.py` (QueryService).
- Policy: `src/crm/policy/projection.py` — central `project_record()` with
  OWNER / COLLABORATOR / ADMINISTRATOR_EXCEPTION levels.
- Persistence: `src/crm/persistence/{database,repositories,models,user_repository,session_repository,audit_repository,role_grant_repository}.py`.
- Web: `src/crm/web/main.py`, `src/crm/web/routes/{auth,institutions,followups}.py`,
  `src/crm/web/{auth,deps}.py`.
- Templates (4, not 3 as the old card states): `templates/{login,dashboard,institutions_list,institution_detail}.html`.
- Schema: `migrations/versions/0001_initial_schema.py` already contains
  `follow_up_activity_revisions`, `withdrawn_*` columns, `archived_at`/
  `archive_reason`, `institution_owner_history`, `audit_events`.

## 3. SPEC-0001 rule-by-rule check

| Rule | Status | Evidence (file:line) | Closed by / remaining gap |
|---|---|---|---|
| R-001 manual institution creation | CLOSED | `routes/institutions.py:51-122`; page `main.py:222-247`; test `test_s5_pages_api_parity.py:356` (step 1) | Four-step flow test |
| R-002 stable unique identity | CLOSED | `domain/models.py:120` (UUID pk); `persistence/models.py:78` `uq_institutions_creator_submission` | Stable id + idempotency key |
| R-003 contacts under institution | CLOSED | `routes/followups.py:71-129`; `persistence/models.py:167` FK; test `test_s5_pages_api_parity.py:367-370` | |
| R-004 view current approved info | CLOSED | `queries.py:221-281`; detail page `main.py:250-290` | |
| R-005 append follow-up (occurred_at, method, recorded_at, recorder, body) | CLOSED | `routes/followups.py:132-204`; `repositories.py:322-383`; system fields `recorded_at`/`recorded_by_user_id` | |
| R-006 deterministic history order | CLOSED | `repositories.py:302-308` (`occurred_at DESC, recorded_at DESC, id DESC`); `projection.py:304-315`; test `test_s5_pages_api_parity.py:437-455` | |
| R-007 no silent overwrite | OPEN | No update/correct path exists; revision append not implemented | Depends on R-031; currently "no modification path" rather than "versioned modification" |
| R-008 core flow independent of external deps | CLOSED | no external calls in src; test `test_s6_local_no_external_calls.py:112` | |
| R-009 unauthorized cannot read/write | CLOSED | `deps.py:87-97` (401), policy deny; tests `test_s6_integration.py:328`, `test_s5_pages_api_parity.py:514-551` (404) | |
| R-010 minimum-necessary desensitized views | CLOSED | `projection.py:237-249` collaborator projection; test `test_s5_pages_api_parity.py:554-598` | |
| R-011 concise progress only | CLOSED | `projection.py:318-337` `_concise_progress`; policy tests | |
| R-012 no bypass via export/search/API | CLOSED | page+API share `project_record` (test `test_s5_pages_api_parity.py:394-434`); export removed by DEC-0027; search filtering is TASK-0002 territory | |
| R-013 owner work-necessary detail only | CLOSED | `projection.py:211-234` detailed projection restricted to OWNER/ADMIN levels; test `test_policy_projection.py:114` | |
| R-014 other users masked + concise | CLOSED | `projection.py:237-249`; test `test_policy_projection.py:135`, `test_s5_pages_api_parity.py:554` | |
| R-015 admin exception audited | PARTIAL | policy supports `ADMINISTRATOR_EXCEPTION` + `requires_access_audit` (`projection.py:149-154`); policy test `test_policy_projection.py:210`; **no route passes `administrator_reason`** → no end-to-end trigger of the audit event | Remaining: admin exception read route + audit event |
| R-016 contact without storable channel allowed, explicit | CLOSED | `domain/models.py:156-177` (three `ContactabilityStatus`); validation `followups.py:107-112`; test `test_s5_pages_api_parity.py:458-470` | Positive no-channel save test `[UNKNOWN]` |
| R-025 institution minimum fields (name/source/owner only) | CLOSED | `domain/models.py:110-135`; request model `routes/institutions.py:19-30`; test `test_s6_integration.py:223` | |
| R-026 contact name-or-role + channel status | CLOSED | `domain/models.py:169-175`; test `test_s5_pages_api_parity.py:458` | |
| R-027 activity minimum fields, system-maintained rest | CLOSED | `domain/models.py:204-226`; `repositories.py:322-383` | |
| R-028 next action optional, owner required if present | CLOSED | `domain/models.py:220-224`; DB `ck_..._next_action_complete` (`persistence/models.py:234-240`); command validation `commands.py:272-280` | Dedicated test `[UNKNOWN]` (covered indirectly) |
| R-029 concise progress exact content | PARTIAL | `projection.py:318-337` emits all 5 fields; **`latest_follow_up_method_category` is always `None`**: every call site builds `ActivitySummarySource(activity, None)` (`queries.py:207,253,368`); no category mapping exists | Remaining: communication-method category derivation |
| R-030 same field rules on page/search/export/API | CLOSED | single `project_record` used by page and API; whitelist-built projections default to hidden; test `test_s5_pages_api_parity.py:394` | |
| R-031 correction creates new version, no hard delete, withdrawal keeps audit | OPEN | Schema supports it (`revisions`, `withdrawn_*`, `archived_*` in `persistence/models.py:185-283` and migration); **no repository update/correct/withdraw method, no command, no route, no test** | Largest remaining implementation item |
| R-035 duplicate suspicion prompt | OPEN | No duplicate detection anywhere in `src/` (rg sweep) | Remaining implementation item |
| R-036 owner maintains; others read-only; admin exception ops | PARTIAL | owner-write on create paths `routes/followups.py:88-91,149-152` (404 default deny); other-user read-only via policy; **correction/withdrawal (R-031) and admin exception ops (owner transfer, archive, factual correction) not implemented** | Remaining implementation item |

## 4. SPEC-0002 rule-by-rule check (TASK-0008 scope)

| Rule | Status | Evidence | Notes |
|---|---|---|---|
| R-003 new identity has no data access until enabled + granted | CLOSED | `role_grant_repository.py:20-42` (only `revoked_at IS NULL`); `deps.py:22-48` fail-closed identity; policy deny `projection.py:145-146`; tests `test_task0007_auth_service.py:333,341,346`, `test_policy_projection.py:197-208` | See P2 finding in section 6 — route layer hardcodes `ENABLED` |
| R-006 least privilege, default deny/hide | CLOSED | policy whitelist projections; fail-closed `deps.py` | |
| R-013 one identity/role/field rule across all paths | CLOSED | canonical `load_user_context` (`deps.py:22-48`); page+API parity test; no export/AI/background-task surface exists in this slice | |

## 5. Acceptance-criteria check

| AC | Status | Evidence / gap |
|---|---|---|
| AC-001 stable id + reopen | CLOSED | `test_s5_pages_api_parity.py:356` (step 1+4) |
| AC-002 contact persists under institution | CLOSED | `test_s5_pages_api_parity.py:367-370` |
| AC-003 activity persists with recorder/time | CLOSED | `test_s5_pages_api_parity.py:372-391` |
| AC-004 reproducible order, no cross-record | CLOSED | `test_s5_pages_api_parity.py:437-455`; FK `institution_id` |
| AC-005 missing required → reject with fixable message | CLOSED | pydantic 422 + command 400; `test_s6_integration.py:223`, `test_s5_pages_api_parity.py:473-490` |
| AC-006 masked + concise in ordinary view | CLOSED | `test_policy_projection.py:135`, `test_s5_pages_api_parity.py:554` |
| AC-007 owner work-necessary detail only | CLOSED | `test_policy_projection.py:114` |
| AC-008 cross-path desensitization | CLOSED | `test_s5_pages_api_parity.py:394-434,554-598` |
| AC-009 admin audit record (identity, target, time, reason) | PARTIAL | policy-level test `test_policy_projection.py:210`; audit table exists; **no live admin-exception route → audit event never fired end-to-end** |
| AC-010 unauthorized rejected, no content | CLOSED | `test_policy_projection.py:197-208`, `test_s6_integration.py:328` |
| AC-011 core flow works with externals down | CLOSED | `test_s6_local_no_external_calls.py:112` |
| AC-012 no-channel contact saves, explicit | CLOSED | model + validation; dedicated positive test `[UNKNOWN]` |
| AC-021 minimum institution accepted, no fabrication | CLOSED | model/request validation |
| AC-022 name-or-role contact with explicit channel state | CLOSED | `test_s5_pages_api_parity.py:458-470` |
| AC-023 other user gets no channel/body/quotation | CLOSED | `test_s5_pages_api_parity.py:554-598` |
| AC-024 concise progress without shared summary | CLOSED | `_concise_progress` handles `None` (`projection.py:329-337`) |
| AC-025 correction/withdrawal versioned, no hard delete | OPEN | nothing implemented (same gap as R-031) |
| AC-028 duplicate warning no-leak, no auto-merge | OPEN | nothing implemented (same gap as R-035) |
| AC-029 owner/other/admin change boundary | PARTIAL | owner-write + other read-only implemented/tested; admin exception ops (transfer/archive/correction) not |

## 6. Old-card assumptions re-checked (2026-08-04)

1. **"All three `from_dict()` drop constructor args; the follow-up command
   references an undefined variable"**
   - `[VERIFIED]` All three `from_dict` methods exist: `commands.py:53,144,254`.
   - `[VERIFIED]` Their body is
     `cls(**{k: v for k, v in data.items() if hasattr(cls, k)})`. `hasattr(cls, k)`
     is `False` for every constructor parameter (constructor parameters are not
     class attributes), so every data item is filtered out and
     `from_dict(...)` **always raises `TypeError`** (reproduced interactively).
     The old defect therefore persists in a worse form: not "drops args" but
     "cannot construct at all".
   - `[VERIFIED]` No call site exists (rg shows only the three definitions), so
     current impact is 0 — the methods are dead code. "已实现" (as the handoff
     phrase suggested) is not accurate: the methods exist but have never worked.
   - `[VERIFIED]` The "undefined variable" half is **fixed/absent**: current
     `CreateFollowUpActivityCommand` references no undefined names.
2. **"Repositories commit independently; no atomic Unit of Work"**
   - `[VERIFIED]` Every repository method opens its own `SessionLocal()` and
     commits alone (`repositories.py:113-117,217-221,359-383`; same pattern in
     `user_repository.py`, `session_repository.py`, `audit_repository.py`,
     `role_grant_repository.py`).
   - `[VERIFIED]` `transaction_session` exists (`database.py:86-95`) but has
     zero call sites (exported only by `persistence/__init__.py:4,30`).
   - `[VERIFIED]` Each single `create` is internally atomic (activity row +
     revision row share one session/commit, `repositories.py:359-383`).
   - Assessment: the four-step flow (create institution → contact → activity)
     is three separate HTTP requests; independent commits are the *correct*
     behavior there, so "missing atomicity" is not a defect for the current
     workflow. The real gap is forward-looking: R-031 correction/withdrawal
     operations that must append revision + audit atomically have no
     transaction wrapper designed for them.
3. **"Contact/follow-up/history routes and `/institutions` page absent"**
   - `[VERIFIED]` Present now: list page `main.py:222-247`, detail page
     `main.py:250-290`; contact/activity create routes `followups.py:71-204`;
     history block in `templates/institution_detail.html:96-109`.
   - `[VERIFIED]` Still absent: a standalone contacts route file (contacts live
     inside `followups.py`), any **creation form UI** (no "new institution",
     "add contact", "add follow-up" form page or entry point — API POST
     endpoints exist but no browser form), and dedicated follow-up/history
     templates (history is embedded in the detail page).
   - `[VERIFIED]` Templates are 4, not 3: `login`, `dashboard`,
     `institutions_list`, `institution_detail`.

## 7. Known open items that must not be silently dropped

1. **P2 hardcoded `user_status=UserStatus.ENABLED`** at `main.py:236,274` and
   `routes/institutions.py:105,152,189`: the route layer passes `ENABLED` to
   `QueryService` instead of the session-verified status. Relationship to
   SPEC-0002 R-003/R-006: R-003 requires permission only after explicit
   enablement; this hardcoding bypasses the query layer's status check.
   `[VERIFIED]` currently non-exploitable because `auth.py:371` invalidates any
   session whose user is not `ENABLED`, so the effective subject is always
   enabled. It is a defense-in-depth defect, not a live leak. Whether TASK-0008
   repairs it (pass the real status through) or documents it as accepted needs a
   product-owner call — recorded `[UNKNOWN]` in section 8.
2. **S4's `crm_test` leg remains `[UNVERIFIED — single source]`** (DEC-0070
   point 4). Not a TASK-0008 blocker (prerequisite is TASK-0007, ACCEPTED), but
   any TASK-0008 real-database verification on `crm_test` would re-exercise the
   same database and cannot claim to close S4's acceptance, which is TASK-0001
   territory.

## 8. Prior unknowns — resolved as engineering defaults (2026-08-04)

Product owner standing rule (session 2026-08-04): only real business-scenario
choices go to the product owner; code/engineering defaults are AI-owned under
`DEC-0002`/`DEC-0003`. None of the items below change an approved SPEC rule;
they only fill implementation gaps left open by the SPEC text. Recorded here so
authorization is not blocked on a product questionnaire.

1. **P2 ENABLED semantics** — **REPAIR in TASK-0008.**
   Pass the session-verified `user_status` into `QueryService` at the five call
   sites. Defense-in-depth only; currently non-exploitable (`auth.py:371`).

2. **R-029 communication-method category** — **write-time controlled field.**
   Vocabulary (fixed for this slice): `电话` / `微信` / `面谈` / `邮件` / `其他`.
   Owner still stores free-text `interaction_method` for work-necessary detail;
   concise progress exposes only the category. Expanding the vocabulary later
   needs a SPEC change, not a silent code edit.

3. **R-035 duplicate detection basis** — **minimal exact-match, create-time only.**
   - Institution create: normalized name equality
     (trim + collapse internal whitespace + casefold) against existing
     non-archived institutions; prompt shows only fields the actor may see
     under `project_record`; confirm-to-continue; never auto-merge.
   - Contact create: same parent institution + same non-empty channel value
     (phone / email / WeChat identifier, each compared normalized); same
     no-leak / no-auto-merge rules.
   - No fuzzy/region matching in this task (false-positive risk; reversible later).

4. **R-031/R-036 admin exception operation scope** — **in this task:**
   versioned correction, withdrawal, archive, and audited administrator-exception
   **read** (reason required → audit event). **Out of this task:** owner transfer
   / batch transfer (`SPEC-0002` R-009~R-012; separate future task). Aligns with
   the task card Non-goals.

5. **AC-012 / R-028 positive tests** — **required in TASK-0008.**
   Add dedicated automated positive tests (no-channel contact save; next-action
   content requires owner). Indirect coverage alone is not enough under
   DEC-0073 point 4.
