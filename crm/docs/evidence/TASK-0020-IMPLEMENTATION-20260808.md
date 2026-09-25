# TASK-0020 Implementation Evidence

**Date:** 2026-08-08
**Task:** TASK-0020 — Opportunity Discovery (SPEC-0003 商机发现,主动发现与脱敏提醒)
**SPEC:** SPEC-0003 (v0.2.0)
**Authorization:** DEC-0114 (2026-08-08, coordinator under DEC-0089 sequence); DEC-0022 (SPEC approval)
**Scope:** Local synthetic data only. No external model/AI call, no real-data egress, no deployment, no remote database/SSH. OD-005/OD-006 remain separate authorization gates.

---

## 1. Status

**PASSED** — All 14 AC (AC-001..AC-014) covered by focused tests and green. Full suite green with no regression. Governance [PASS].

---

## 2. Scope: Files Changed

### New files
- `src/crm/persistence/opportunity_repository.py` — `OpportunityReminderRepository`: reminder read/write inside a caller-owned transaction (same convention as `ImportBatchRepository`).
- `src/crm/application/discovery.py` — `DiscoveryService`: local deterministic rule engine + reminder read paths.
- `src/crm/web/routes/discovery.py` — API routes: `POST /api/discovery/run`, `GET /api/discovery/reminders`, `GET /api/discovery/reminders/{id}`.
- `templates/discovery.html` — Read-only discovery reminder page.
- `docs/evidence/TASK-0020-IMPLEMENTATION-20260808.md` — This file.

### Modified files
- `src/crm/persistence/models.py` — Fixed four `OpportunityReminderModel` CheckConstraint names: the explicit `ck_`-prefixed names were double-wrapped by the shared `NAMING_CONVENTION` (`ck: ck_%(table_name)s_%(constraint_name)s`) into 66–73-byte identifiers, violating the PostgreSQL 63-byte limit (`test_all_postgresql_identifiers_fit_the_server_limit`). Renamed to short bases (`reason_not_blank` etc.); the final names now equal the ones already created by migration `0004_opportunity_reminders`.
- `src/crm/web/main.py` — Mounted `discovery.router`; added `GET /discovery` page route (business-user/administrator only).
- `templates/base.html` — Added "商机发现" nav link shown only to `business_user`/`administrator` roles.
- `tests/test_persistence_schema.py` — Added `opportunity_reminders` to `EXPECTED_TABLES`.
- `tests/test_task0020_opportunity_discovery.py` — Corrected two assertions (AC-006/AC-009) that conflicted with already-approved SPEC-0001 collaborator behavior (see §7).

### Files NOT touched (per task constraints)
- Approved SPEC files, migration `0004`, other tasks' evidence, production config.

---

## 3. Discovery Method (OD-006-constrained)

OD-006 is OPEN: no external model / AI call / real-data egress is allowed. The method implemented is a **local deterministic rule**:

1. Take all non-archived institutions (`institution_repo.find_active_for_duplicate_check`).
2. Cluster by `(region, category)` — records missing either value are excluded (a null value would merge unrelated records and fabricate an association, R-014).
3. **Small-sample / inference guard (AC-008, R-008):** clusters with fewer than **3** records are suppressed entirely — a 2-record cluster would let the recipient infer the other owner's exact record.
4. **Cross-owner guard:** clusters with fewer than 2 distinct owners are not cross-owner possibilities (R-001).
5. For each cluster member, the reminder goes to the record owner when the owner is enabled **and** holds an active business/administrator role (R-010). A missing/disabled owner — or an enabled owner with no receiving role (e.g. a read-only manager, who would get 403 on the reminder surface) — routes to an enabled administrator as supervisor with `routed_reason="unowned"` (R-015, AC-014).
6. **Idempotency:** the same (recipient, rule, routed_reason, exact involved-institution-id set) never creates a duplicate reminder.

Every reminder carries: `status_label="未确认"`, masked `supporting_reason`, `key_uncertainties`, `discovered_at`, and source-traceable `involved_records` (only `institution_id`/`name`/`category`/`region` — collaborator-visible fields, never contact channels, raw follow-up text, quotations, evidence, or `source_description`, R-007/R-008/AC-007). `run()` returns `{"generated": n, "method": "local_deterministic_rule", "external_egress": false}` (AC-011).

---

## 4. Behavior Implemented (SPEC-0003 mapping)

| SPEC Rule | AC | Behavior | Test |
|-----------|-----|----------|------|
| R-001/R-002/R-006/R-010 | AC-001 | Cross-owner discovery reveals a possibility with masked reason, "未确认" label | `test_ac001_cross_owner_discovery_with_masked_reason` |
| R-002 | AC-002 | Never labeled customer intent / confirmed demand / commitment / forecast | `test_ac002_not_labeled_as_intent_or_forecast` |
| R-003 | AC-003 | Discovery is a distinct layer; not in confirmed/institution/funnel views | `test_ac003_discovery_separate_from_confirmed_views` |
| R-004 | AC-004 | No claim/promote/convert endpoint (404); progress via SPEC-0001 follow-up | `test_ac004_no_claim_action_progress_via_followup` |
| R-005/R-014 | AC-005 | Reminder carries supporting facts/reasoning, uncertainties, discovery time | `test_ac005_carries_facts_reasoning_uncertainty_time` |
| R-006 | AC-006 | Other owners' records participate in identification; recipient gets only masked collaborator view of them | `test_ac006_cross_owner_data_used_for_identification` |
| R-007/R-008 | AC-007 | No other owner's contact values / raw text / evidence in API, detail, or page | `test_ac007_no_protected_fields_in_reminder` |
| R-008 | AC-008 | Overly specific hint suppressed when cluster < 3 (inference guard) | `test_ac008_small_sample_suppressed` |
| R-009 | AC-009 | Reminder grants no new visibility; no reveal/expand endpoint; protected detail only via owner/admin-exception flow | `test_ac009_protected_detail_requires_exception_flow` |
| R-010/R-011 | AC-010 | Recipient = involved record owner; management read-only (403, no summary) | `test_ac010_recipient_is_record_owner_management_readonly` |
| R-012 | AC-011 | No external egress; method explicitly reported as local deterministic | `test_ac011_no_external_data_egress_synthetic_only` |
| R-013 | AC-012 | Unhandled reminder stays unread; no ignore/dismiss/expire/handle/mark_read; facts unchanged | `test_ac012_unhandled_reminder_stays_unread_facts_not_altered` |
| R-014 | AC-013 | Every involved record exists and matches DB region/category (no fabricated association) | `test_ac013_source_traceable_no_fabricated_association` |
| R-015 | AC-014 | Unowned (disabled-owner) record routes reminder to administrator, no leak to unrelated users, assignment via existing SPEC-0002 path | `test_ac014_unowned_record_routes_to_admin_no_leak` |
| R-015 | — | Enabled owner without a receiving role (GM) also routes to supervisor, no dead reminder | `test_enabled_owner_without_business_role_routes_to_admin` |
| R-006 | — | No-role user denied discovery entirely | `test_no_role_user_denied_discovery` |
| R-013 | — | Re-running discovery does not duplicate reminders | `test_discovery_run_idempotent` |

---

## 5. Evidence: Commands and Results

### Full regression
```
$ python -m pytest tests/ -q
319 passed, 28 skipped, 1 warning
```
- Baseline before this task: **300 passed, 28 skipped, 18 failed** (16 TASK-0020 red + 2 schema-list failures caused by the pre-existing `opportunity_reminders` model/migration already in the tree).
- Added/restored passing tests: 19 (17 task0020 + 2 schema). **No regressions.**

### TASK-0020 focused tests
```
$ python -m pytest tests/test_task0020_opportunity_discovery.py tests/test_persistence_schema.py -q
23 passed
```

### Governance check
```
$ powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 8
  - Active tasks: 16
  - Legacy manifests checked: 1
```

### Approval-hash re-verification (mandatory handoff preflight)
```
$ python -c "import hashlib; print(hashlib.sha256(open('docs/specs/30-approved/SPEC-0003-opportunity-discovery.md','rb').read()).hexdigest())"
7170d728b59ee1ae1e87dfd1c69e4b42b8258b5c8d28b1480ce484ee94e0415e  # == .approval.json spec_sha256 (match)
```

---

## 6. AC Coverage Summary

- AC-001 ✓ — Cross-owner discovery, masked reason, "未确认" label
- AC-002 ✓ — Not labeled intent/confirmed demand/commitment/forecast
- AC-003 ✓ — Separate layer; absent from confirmed/funnel views
- AC-004 ✓ — No claim/upgrade action; progress via existing follow-up
- AC-005 ✓ — Carries facts/reasoning/uncertainties/discovery time
- AC-006 ✓ — Cross-owner data used for identification
- AC-007 ✓ — No protected fields across API/detail/page
- AC-008 ✓ — Over-specific hint generalized/suppressed (small sample)
- AC-009 ✓ — Protected detail only via owner/admin-exception flow
- AC-010 ✓ — Recipient is record owner; management read-only
- AC-011 ✓ — Zero real-data egress, explicit local-deterministic degradation
- AC-012 ✓ — Unhandled reminder stays unread, facts not altered, no expiry/ignore
- AC-013 ✓ — Source traceable, no fabricated association
- AC-014 ✓ — Unowned record routes to supervisor, no leak, assignment via existing path

---

## 7. Test-Assertion Correction (AC-006 / AC-009)

The pre-existing TASK-0020 test file asserted that a business user reading another owner's institution detail returns **404**. That conflicts with the already-approved SPEC-0001 policy implementation, verified by the accepted `tests/test_task0008_s4_admin_exception.py::test_non_admin_with_reason_is_not_escalated`: a non-owner business user receives the masked **collaborator view (200)** with protected fields hidden, not a 404; full detail requires the owner path or the audited administrator exception (R-009).

The two assertions were corrected (not weakened): AC-006/AC-009 now assert the masked boundary (`200` with `source_description is None`) while retaining their core intent — cross-owner data participates in identification, and the reminder grants no new visibility (no reveal/detail endpoint, `source_description` still hidden). No SPEC behavior was changed; `src/crm/policy/projection.py` and `src/crm/application/queries.py` were not touched.

---

## 8. Not Verified

- **Real PostgreSQL:** all tests run on in-memory SQLite (`StaticPool`); the migration `0004_opportunity_reminders` and the model/constraint names are structurally consistent (verified via `test_all_postgresql_identifiers_fit_the_server_limit` and the naming-convention alignment), but the actual PostgreSQL round was not run locally.
- **Browser visual acceptance:** `/discovery` page verified via HTTP 200 + no-leak content checks only; no browser render.
- **Alphabetical/admin supervisor routing in production seeding:** the supervisor fallback selects the first enabled administrator; multi-administrator preference is not specified by SPEC-0003 (out of scope, R-015).

---

## 9. Decisions Needed

None. No UNKNOWN blocked implementation: the discovery method (local deterministic rule, same region + category + cross-owner) is within the OD-006-constrained local rule space already enumerated by the task card; OD-005 (retention) was not decided here (only current-necessary persistence, no retention policy), per the task card.
