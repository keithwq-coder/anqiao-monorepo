# TASK-0014 Second Remediation — Coordinator Independent Audit (DEC-0096)

- Date: 2026-08-06
- Auditor: coordinator (Kimi Code)
- Scope: independent re-verification of GLM-5.2's second-remediation completion
  claim against `DEC-0096` (whitespace read-exception normalization; single
  `archive_reason` contract restoration).
- Verdict: **ACCEPTED** (local synthetic scope only). Successor gate released
  per `DEC-0096` point 4; see `DEC-0097`.

## Requirements checked (DEC-0096)

| # | Requirement | Result |
|---|---|---|
| 1 | Remove unapproved `ArchiveInstitutionRequest.administrator_reason`; restore one normalized `archive_reason` for authorization, persistence, and audit | [VERIFIED] `src/crm/web/routes/institutions.py:45-52` — only `archive_reason` remains; gate at lines 319-332 requires `ADMINISTRATOR` + nonblank stripped reason, else non-disclosing 404; the same value is passed to `ArchiveInstitutionCommand` (line 343) |
| 2 | Normalize read-exception reason (`strip() or None`) at the QueryService layer, not only routes | [VERIFIED] `src/crm/application/queries.py:31-42` (`_normalize_reason`); used in `find_institutions` (lines 242-250, 276) and `get_institution_detail` (lines 321-331, 350) for both `include_withdrawn` and the `project_record` argument |
| 3 | Blank reason must not produce withdrawn data, `ADMINISTRATOR_EXCEPTION` view, or `admin.exception_read` audit at any owned boundary | [VERIFIED] API list `institutions.py:200-215`, API detail `:264-294` (audit writes `reason=normalized_reason`), page detail `src/crm/web/main.py:405-427` — all gate on the normalized value |

## Independent evidence re-run (this audit, not the executor's report)

| Check | Command | Result |
|---|---|---|
| Focused suite | `.venv/Scripts/python.exe -m pytest tests/test_task0014_core_semantic_security.py -q` | `21 passed` (matches executor claim) |
| Full local suite | `.venv/Scripts/python.exe -m pytest tests -q` | `205 passed, 28 skipped, 1 warning` (matches executor claim; skips are the labelled isolated-PostgreSQL gates) |
| Byte-compile | `.venv/Scripts/python.exe -m compileall -q src` | exit 0 |
| Governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` (7 approved SPECs, 10 active tasks) |

Regression tests inspected (non-vacuous assertions confirmed):

- `test_dual_role_whitespace_reason_api_detail_no_withdrawn` — asserts the
  withdrawn factual body is absent from the response and zero
  `admin.exception_read` rows exist after the request.
- `test_dual_role_whitespace_reason_api_list_no_withdrawn`,
  `test_dual_role_whitespace_reason_page_detail_no_withdrawn` — same boundary
  checks on list and page paths.
- `test_queryservice_whitespace_reason_direct_no_withdrawn` — direct
  QueryService call with `"   "` returns concise_progress latest date
  `2026-08-05` (the normal activity), not the withdrawn one (`2026-08-06`),
  proving route-layer normalization is not the sole defense.
- `test_admin_archive_single_reason_succeeds_and_audits` — persisted
  `archive_reason` and the `institution.archive` audit reason are the same
  value; exactly one audit row.
- `test_admin_archive_blank_reason_denied`,
  `test_owner_archive_with_only_archive_reason_denied` — blank reason and
  owner archive both denied.

## Residual observation (recorded, not blocking)

- The new dual-role tests use a dual-role **non-owner** principal, whose
  collaborator projection never exposes the activities array regardless of
  `include_withdrawn`; the withdrawn-leak path is covered through the
  `concise_progress` date assertion. `DEC-0095`'s exact reproduction was an
  **owner** holding both roles. The `include_withdrawn` flag is computed
  identically for owner and collaborator projections, so the coverage is
  functionally equivalent, but a dedicated owner+dual-role whitespace
  regression test would be tighter. Candidate for a future hardening pass; it
  does not block acceptance because the defect's decision path is the shared
  `_normalize_reason` computation verified above.
- The archive route normalizes inline (`(data.archive_reason or "").strip()`)
  rather than via `_normalize_reason`; behaviorally equivalent, stylistically
  inconsistent. No change required.

## Boundaries confirmed

- No deployment, remote PostgreSQL/SSH, production data, credential, billing,
  or real-data-write actions were taken or authorized by this audit.
- `ArchiveInstitutionCommand`, audit schema, and any two-reason feature remain
  untouched per `DEC-0096` point 3.

## Gate release

Per `DEC-0096` point 4, the corrected TASK-0014 having passed independent
acceptance, the block on `TASK-0010`, `TASK-0011`, `TASK-0015`, and later
tasks is lifted **for sequencing purposes only**. Each successor still
requires its own ownership release and activation; the next task in the
approved roadmap order is `proposed/TASK-0010-search-security-verification.md`
(prerequisites: `DEC-0089`; TASK-0009 and TASK-0014 accepted — both now met).
