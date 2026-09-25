# TASK-0008 S3: duplicate-suspicion prompt at create time — R-035 / AC-028

- Task: `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` Step 3
- Author/executor: DeepSeek (implementation); coordinator audits
- Date: 2026-08-04
- Authority: DEC-0081 (Step 3 unlocked after Step 2 ACCEPTED); DEC-0080
  engineering defaults (R-035 exact match, no-leak, confirm-to-continue,
  no auto-merge, no fuzzy/region matching)
- Scope: R-035 / AC-028 only. No merge, no hard delete, no transfer, no
  admin-exception read, no R-029, no forms, no P2 (later steps).
- Evidence grading: per DEC-0073 point 4 — commands and results are
  `[VERIFIED]` (actually run this round) unless labelled otherwise.

## 1. What was implemented

### Duplicate detection (application layer, `queries.py`)

- `normalize_name_for_duplicate(value)`: trim + collapse whitespace (split/
  join collapses runs and edges) + casefold — the R-035 institution basis.
- `normalize_channel_for_duplicate(value)`: trim + casefold — the R-035
  contact channel basis (phone / email / wechat; identifier values compared
  exactly, no fuzzy matching).
- `QueryService.detect_duplicate_institutions(name, user_id, user_status,
  roles, management_scope_keys) -> list[dict]`: exact normalized-name match
  against **non-archived** institutions. Every candidate is projected through
  `project_record` (empty contacts/activities snapshot); `PolicyDenied`
  candidates are skipped. Returned fields are the view-independent minimum:
  `{id, name, category, region}`.
- `QueryService.detect_duplicate_contacts(institution_id, *, phone, email,
  wechat, ...) -> list[dict]`: same institution + same non-empty channel value
  (exact normalized). Contacts without any storable channel are never
  compared. Candidates are projected; skipped on `PolicyDenied`. Returned
  fields: `{id, name_display (name_masked or name), role_label, job_title}`.

### Repository (`repositories.py`)

- `InstitutionRepository.find_active_for_duplicate_check()`: all
  `archived_at IS NULL` institutions — the candidate set for R-035 (archived
  records are not duplicate candidates).

### HTTP contract (routes)

Selected contract: **409 Conflict + `detail` body containing `duplicates` and
a `confirm_required` flag; creation proceeds only with an explicit
`confirm_duplicate: true`**.

- `POST /api/institutions` (`institutions.py`): `InstitutionCreateRequest`
  gains `confirm_duplicate: bool = False`. After the status check and before
  command execution, `query_service.detect_duplicate_institutions` runs; on
  visible candidates without confirmation → 409 with
  `{"duplicates_found": true, "confirm_required": true, "duplicates": [...],
  "message": "..."}`. Nothing is created.
- `POST /api/institutions/{institution_id}/contacts` (`followups.py`):
  `AddContactRequest` gains `confirm_duplicate: bool = False`. The owner-write
  404 check stays first; then `detect_duplicate_contacts` runs (only
  meaningful when a channel value is present); same 409 contract.

No auto-merge, no silent dedup: confirmed creation inserts a second,
independent record with its own id.

## 2. No-leak semantics (AC-028)

`resolve_read_access` (`policy/projection.py:137-187`) makes every
`BUSINESS_USER` at least a COLLABORATOR on any institution, so the candidate
payload a business user receives is always the **collaborator projection** —
institution detail carries no `source_description` / `source_kind` /
`source_evidence_reference`, and contact detail carries `name_masked` and no
channel plaintext. A subject with **no** visibility at all (e.g.
administrator-only without a stated exception reason) hits `PolicyDenied`
and the candidate is skipped entirely — the caller receives no candidate
detail (creation proceeds without existence disclosure).

## 3. Test evidence (local, synthetic; no `crm_test`)

`tests/test_task0008_s3_duplicate_prompt.py` — 12 passed (`[VERIFIED]`,
`.venv/Scripts/python.exe -m pytest tests/test_task0008_s3_duplicate_prompt.py -q`
→ `12 passed in 2.32s`), reusing the S5 in-memory environment (memory
repositories + central policy projection + in-memory auth).

- Normalization units: whitespace/casefold behavior (`2 passed`).
- Query-level: exact normalized match returns the candidate with only
  projected fields; a different name is not a candidate; an administrator-
  only subject (no business role, no reason) receives an empty candidate list
  (`3 passed`).
- Institution HTTP: duplicate without confirm → 409, record not created;
  duplicate with confirm → 201 with a **distinct id** (no merge); distinct
  name → 201; non-owner caller's 409 payload contains **no protected detail**
  (`source_description`/`source_kind`/`evidence` asserted absent from the
  serialized warning) (`4 passed`).
- Contact HTTP: same institution + same normalized phone without confirm →
  409, still exactly one contact; with confirm → 201 with a distinct id (two
  independent records); no-channel contact (`not_yet_obtained`) is not
  compared and creates normally; a different channel is not a duplicate
  (`4 passed`).

### Regression (local ungated; no `CRM_RUN_POSTGRESQL_TESTS`)

- Full suite: `161 passed, 28 skipped` (`[VERIFIED]`,
  `.venv/Scripts/python.exe -m pytest tests/ -q -p no:cacheprovider`).
  Prior S2 baseline was `149 passed, 28 skipped`; the +12 are the new S3
  tests. `tests/test_s5_pages_api_parity.py` gained one memory-repository
  method (`find_active_for_duplicate_check`, in-memory candidate set); no
  existing assertion changed.
- `check-governance.ps1` → `[PASS]` (`[VERIFIED]`, run this round).

## 4. Design notes and boundaries

- The 409 contract is deliberately strict: the default (no flag) refuses
  creation when a visible candidate exists. The flag is explicit and
  per-request; there is no global "disable checks" setting.
- Candidate existence is disclosed only to callers who can see at least one
  candidate (a business user always can, at collaborator level). Callers with
  no visibility are not told a duplicate exists (`[INFERENCE]`: this is the
  strictest reading of AC-028's "no protected detail" and keeps R-035's
  prompt effective for the users who are allowed to create).
- `other_channel` values are not duplicate-compared (DEC-0080 lists phone /
  email / WeChat only); documented here as an implementation boundary.
- The real repository filters archived institutions in SQL
  (`archived_at IS NULL`); the in-memory test repository has no archived
  flag, so that filter is not exercised by local tests (`[NOT VERIFIED]`
  locally; covered by the SQL itself and by the gated real-database suite).
- No route, template, migration, or policy change outside the S3 owned
  paths; no `crm_test`/SSH/server/real data touched (DEC-0081 point 5).

## 5. Status

- Step 3 implementation complete; awaiting coordinator acceptance.
- Step 4 (admin-exception read + audit, R-015/AC-009) stays LOCKED until
  acceptance is recorded.
