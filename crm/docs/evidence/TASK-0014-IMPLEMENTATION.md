# TASK-0014 implementation report

- Task: TASK-0014 (core semantic and write-authorization closure)
- Executor: GLM-5.2 (`xopglm52`)
- Authority: `DEC-0089`, `DEC-0092`, `DEC-0093`, `DEC-0094` (remediation)
- Environment: local Windows worktree, repository `.venv`, `PYTHONPATH=src`,
  synthetic/local tests only
- Date: 2026-08-06 Asia/Shanghai (initial); remediation same day

## Status

`PASSED` (local synthetic implementation, post-remediation; coordinator audit
required).

## Scope — changed paths

| File | Change |
|---|---|
| `src/crm/web/routes/institutions.py` | Defect 2: fixed `user_id=current_user["id"]` (string) → `user_id=UUID(current_user["id"])` on the post-create re-read. Defect 1: added `_denied_if_not_business_writer` helper and applied it to the institution creation route. Defect 3: added `administrator_reason` to `ArchiveInstitutionRequest` and the archive route so an administrator may archive a record they do not own with an audited reason. |
| `src/crm/web/routes/followups.py` | Defect 1: added `_denied_if_not_business_writer` helper and applied it to the contact and activity creation routes. |
| `src/crm/application/queries.py` | Defect 4: `find_institutions` and `get_institution_detail` now pass `include_withdrawn` to `find_by_target` based on whether `administrator_reason` is set, so withdrawn activities are excluded from normal history but retained in the administrator exception view. |
| `src/crm/persistence/repositories.py` | Defect 4: `FollowUpActivityRepository.find_by_target` gains `include_withdrawn: bool = False`; when False, withdrawn activities are filtered out by `withdrawn_at IS NULL`. |
| `src/crm/web/main.py` | Defect 1: added `_form_denied_if_not_business_writer` helper and applied it to the three form-submit routes (`institution_create_submit`, `contact_create_submit`, `activity_create_submit`). Restored the owner-write check on `contact_create_submit` that was displaced during the edit. |
| `tests/test_s5_pages_api_parity.py` | Updated `MemoryActivityRepository.find_by_target` to accept `include_withdrawn` for interface compatibility (in-memory activities carry no withdrawn flag; the parameter is accepted but has no effect). |
| `tests/test_task0014_core_semantic_security.py` | New file: 11 negative regression tests covering all four defect categories. |

No changes to `src/crm/policy/`, `src/crm/domain/`, `src/crm/persistence/models.py`,
templates, migrations, or deployment files.

## SPEC / AC mapping

| Defect | SPEC rule | AC | Test |
|---|---|---|---|
| 1: no-role/read-only-role write denial | SPEC-0002 R-003, R-006, R-021 | AC-001 (SPEC-0002) | `test_enabled_no_role_user_cannot_create_institution`, `test_general_manager_cannot_create_institution`, `test_no_role_user_cannot_create_contact`, `test_no_role_user_cannot_create_activity` |
| 2: UUID/string owner classification | SPEC-0001 R-013, R-036 | AC-007 | `test_create_institution_owner_gets_owner_view` |
| 3: archive administrator exception | SPEC-0001 R-036 | AC-029 | `test_admin_can_archive_with_reason_and_audit`, `test_admin_archive_without_reason_denied`, `test_non_owner_non_admin_archive_denied` |
| 4: withdrawn activity projection | SPEC-0001 R-031 | AC-025 | `test_withdrawn_activity_excluded_from_normal_history`, `test_withdrawn_activity_excluded_from_concise_progress`, `test_withdrawn_activity_visible_in_admin_exception_view` |

## Commands and results

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_task0014_core_semantic_security.py -v
  => 11 passed in 2.99s

PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q
  => 195 passed, 28 skipped, 1 warning in 27.75s

PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
  => exit 0

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
  => [PASS] Governance structure and gates are consistent.
     Approved SPECs: 7, Active tasks: 10, Legacy manifests checked: 1
```

The prior baseline was `184 passed, 28 skipped` (TASK-0009 acceptance). The
current `195 passed` adds exactly the 11 new TASK-0014 tests; no existing test
was deleted, weakened, or unconditionally skipped.

## Scope and safety confirmation

- [VERIFIED] Only owned paths were edited; `policy/`, `domain/`,
  `persistence/models.py`, templates, migrations, and deployment files were
  not touched.
- [VERIFIED] No new product concepts were introduced; the fixes close existing
  P0/P1 gaps using existing domain concepts.
- [VERIFIED] No deployment, SSH, remote PostgreSQL, production migration,
  real-data write, credential change, paid service, or external write was
  performed.
- [VERIFIED] The approved SPEC-0001 and SPEC-0002 hashes remain valid (verified
  before editing: `29bbf28d...` and `0c313e4f...`).
- [VERIFIED] Disabled users are already blocked at the auth layer
  (`validate_session` rejects non-ENABLED users); the route-layer role check
  adds defense-in-depth for enabled-but-no-role and read-only-role users.

## Not verified

- Browser visual acceptance.
- Remote PostgreSQL/SSH, deployment, production migration, real-data writes,
  credential changes, paid services, and external writes.
- The `MemoryInstitutionRepository` in test fixtures does not implement the
  `archive` method (it requires a real `transaction_session`); archive tests
  therefore use the SQLite-backed fixture.

## Risks and rollback

- The `find_by_target` signature change (`include_withdrawn` parameter) is
  backward-compatible (defaults to `False`); existing callers are unaffected.
- The `ArchiveInstitutionRequest` gains an optional `administrator_reason`
  field; existing API clients that omit it are unaffected.
- Rollback: revert the 7 changed files; no migration or data change needs
  reversal.

## Design decisions

- **Write authorization gate**: `status == ENABLED` AND (`BUSINESS_USER` OR
  `ADMINISTRATOR`) in roles. Management roles (GENERAL_MANAGER, MANAGER) are
  read-only per SPEC-0002 R-021. This is the narrowest gate that satisfies
  R-003/R-006 (default deny; explicit allow only).
- **Withdrawn projection filter location**: in `repositories.py:find_by_target`
  (owned path) rather than `policy/projection.py` (not owned). The
  `include_withdrawn` flag is set by `queries.py` based on whether
  `administrator_reason` is present — the same indicator the policy layer uses
  to open the administrator exception branch.
- **Disabled user testing**: disabled users cannot be tested via HTTP because
  the auth layer (`validate_session`) already invalidates their sessions. The
  negative tests therefore cover enabled-but-no-role and read-only-role users,
  which are the realistic bypass scenarios.

## Next bounded action

`STOP: coordinator audit required; do not start TASK-0015.`

---

## Remediation pass (DEC-0094)

The coordinator audit (`docs/evidence/TASK-0014-COORDINATOR-AUDIT-20260806.md`)
found two P1 authorization defects reproduced against the initial implementation.
This section records the consolidated correction.

### P1 defects and corrections

**P1-A: Ordinary owner could archive records**

- Root cause: `institutions.py` archive route allowed the owner path
  (`owner_user_id == caller`) in addition to the administrator exception.
- Fix: removed the owner allow path. Archive is now administrator-only:
  `Role.ADMINISTRATOR` + nonblank trimmed `administrator_reason`. Every other
  caller (including the owner) gets the non-disclosing 404.

**P1-B: Any caller could expose withdrawn activities via `administrator_reason`**

- Root cause: `queries.py` derived `include_withdrawn` from
  `administrator_reason is not None` without checking the caller's role.
- Fix: `include_withdrawn` is now `Role.ADMINISTRATOR in roles and
  administrator_reason is not None` — the same canonical condition the policy
  layer uses to open the exception branch. Applied in both `find_institutions`
  and `get_institution_detail`.

### Additional changed paths (remediation)

| File | Change |
|---|---|
| `src/crm/web/routes/institutions.py` | Archive route: owner path removed; administrator-only gate before existence check. |
| `src/crm/application/queries.py` | `include_withdrawn` gated on `ADMINISTRATOR in roles + nonblank reason` in both `find_institutions` and `get_institution_detail`. |
| `tests/test_task0014_core_semantic_security.py` | 3 new negative regression tests: owner archive denied, owner-with-reason cannot see withdrawn, owner list-with-reason does not alter visibility or write exception audit. |
| `tests/test_task0008_s2_workflow.py` | `test_owner_correct_withdraw_archive_flow` updated: owner archive now denied (404); administrator archives with reason; audit actor assertions updated. The correct/withdraw owner path is unchanged. |

### Remediation commands and results

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_task0014_core_semantic_security.py -q
  => 14 passed in 3.58s

PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q
  => 198 passed, 28 skipped, 1 warning in 29.55s

PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
  => exit 0

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
  => [PASS] 7 SPECs, 10 tasks, 1 manifest
```

### Adversarial reproduction results (post-fix)

| Path | Status | Withdrawn visible | Audit |
|---|---|---|---|
| Owner POST archive | 404 | n/a | no success archive audit |
| Owner GET detail with `administrator_reason` | 200 | No | no `admin.exception_read` |
| Owner GET list with `administrator_reason` | 200 | n/a (summary) | no `admin.exception_read` |
| Admin GET detail with reason | 200 | Yes | `admin.exception_read` written |
| Admin POST archive with reason | 200 | n/a | `institution.archive` written |

### Remediation scope and safety confirmation

- [VERIFIED] Only owned paths were edited; `policy/`, `domain/`,
  `persistence/models.py`, templates, migrations, and deployment files were
  not touched.
- [VERIFIED] `repositories.py` was not changed in the remediation pass (the
  `include_withdrawn` parameter added in the initial pass is sufficient; the
  fix is in `queries.py` where the flag is computed).
- [VERIFIED] The S2 test update changes the archive actor from owner to
  administrator because R-036 requires it; the owner correct/withdraw path is
  unchanged.
- [VERIFIED] No deployment, SSH, remote PostgreSQL, production migration,
  real-data write, credential change, paid service, or external write was
  performed.

### Next bounded action (remediation)

`STOP: coordinator audit required; do not start TASK-0010 or TASK-0015.`

---

## Second remediation pass (DEC-0096)

`DEC-0096` retracted the prior two-reason archive interpretation and clarified
the remaining defect: a whitespace-only `administrator_reason` could expose
withdrawn data and write blank exception audits. This section records the
consolidated correction.

### Corrections

**Restore single `archive_reason` contract (DEC-0096 point 1)**

- Removed the remediation-introduced `administrator_reason` field from
  `ArchiveInstitutionRequest`. Archive authorization now uses the single
  `archive_reason` (normalized: `strip() or nonblank`).
- `ArchiveInstitutionCommand` is unchanged; the same `archive_reason` is
  persisted on the institution and recorded transactionally in
  `institution.archive` with actor, target, timestamp, and success.

**Canonical reason normalization at every owned boundary (DEC-0096 point 0)**

- Added `_normalize_reason(value)` in `queries.py` — mirrors policy's
  `_optional_text` (`strip() or None`).
- Applied in `QueryService.find_institutions` and `get_institution_detail`:
  the normalized value controls `include_withdrawn`, is passed to
  `project_record`, and is the sole basis for the `ADMINISTRATOR_EXCEPTION`
  condition. A whitespace-only reason behaves exactly like omitted input.
- Applied in `institutions.py` API list/detail routes and `main.py` page
  detail route: `is_admin_exception` and the `admin.exception_read` audit
  reason use the normalized value.

### Additional changed paths (second remediation)

| File | Change |
|---|---|
| `src/crm/application/queries.py` | Added `_normalize_reason`; both query methods normalize `administrator_reason` before `include_withdrawn`, `project_record`, and the exception condition. |
| `src/crm/web/routes/institutions.py` | Removed `administrator_reason` from `ArchiveInstitutionRequest`; archive authorizes on `ADMINISTRATOR + nonblank archive_reason`. API list/detail routes normalize reason for `is_admin_exception` and audit. |
| `src/crm/web/main.py` | Page detail route normalizes reason for `is_admin_exception` and audit. |
| `tests/test_task0014_core_semantic_security.py` | 7 new regression tests: whitespace reason through API detail/list/page, direct QueryService call, single-reason archive (owner denied, admin succeeds, blank denied). Updated existing archive tests to use single `archive_reason`. |
| `tests/test_task0008_s2_workflow.py` | Updated `test_owner_correct_withdraw_archive_flow` to use single `archive_reason` (removed `administrator_reason`). |

### Second remediation commands and results

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_task0014_core_semantic_security.py -q
  => 21 passed in 5.67s

PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q
  => 205 passed, 28 skipped, 1 warning in 29.34s

PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
  => exit 0

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
  => [PASS] 7 SPECs, 10 tasks, 1 manifest
```

### Adversarial reproduction results (post-second-remediation)

| Path | Status | Withdrawn visible | Audit |
|---|---|---|---|
| Dual-role whitespace reason → API detail | 200 | No | no `admin.exception_read` |
| Dual-role whitespace reason → API list | 200 | No | no `admin.exception_read` |
| Dual-role whitespace reason → page detail | 200 | No | no `admin.exception_read` |
| Direct QueryService whitespace reason | 200 | No (concise_progress = 2026-08-05) | n/a |
| Owner archive (single `archive_reason`) | 404 | n/a | no success archive audit |
| Admin archive (single `archive_reason`) | 200 | n/a | `institution.archive` (reason = `archive_reason`) |
| Admin archive blank `archive_reason` | 404 | n/a | no success archive audit |
| Admin detail with genuine reason | 200 | Yes | `admin.exception_read` written |

### Next bounded action (second remediation)

`STOP: coordinator audit required; do not start TASK-0010 or TASK-0015.`
