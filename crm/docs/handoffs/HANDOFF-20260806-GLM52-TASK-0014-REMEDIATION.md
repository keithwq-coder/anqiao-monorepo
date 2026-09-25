# HANDOFF-20260806-GLM52-TASK-0014-REMEDIATION

- Task: TASK-0014 (same task, one consolidated correction pass)
- From tool/model: coordinator
- To tool/model: GLM-5.2 (`xopglm52`)
- Handoff status: HANDOFF-ONLY / REMEDIATION-REQUIRED
- Repository state: broadly untracked, no commits; preserve all existing files
- Written at: 2026-08-06 Asia/Shanghai
- Authority: `DEC-0089`, `DEC-0093`, `DEC-0094`, `DEC-0095`, and `DEC-0096`
- Boundary: local synthetic data only

## Required reading

- `AGENTS.md`
- `docs/NOW.md`
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md` and approval metadata
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` and approval metadata
- `docs/tasks/active/TASK-0014-core-semantic-security-closure.md`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0093` through `DEC-0096`
- `docs/evidence/TASK-0014-COORDINATOR-AUDIT-20260806.md`
- `docs/evidence/TASK-0014-COORDINATOR-REMEDIATION-AUDIT-2-20260806.md`
- Current code and tests named below before editing

## Verified current state

- The previous TASK-0014 claim is not accepted. Both the focused suite
  (`11 passed`) and full local suite (`195 passed, 28 skipped, 1 warning`) are
  green, but they miss two reproduced P1 authorization defects.
- GLM-5.2 remains the sole implementation owner. The task card's existing
  owned paths remain exclusive; no path outside them is authorized.
- The approved SPEC hashes remain valid. No deployment, remote database/SSH,
  real data, migration, credential, billing, paid-service, or external write
  is authorized.
- The latest GLM-5.2 claim remains unaccepted despite `14 passed` focused and
  `198 passed, 28 skipped, 1 warning` full results. The coordinator reproduced
  whitespace-only administrator reasons exposing withdrawn data and writing
  blank exception audits.
- `DEC-0096` retracts the prior two-reason archive interpretation. The approved
  contract has one nonblank `archive_reason`, which is both persisted on the
  record and stored in the transactional archive audit.

## Required consolidated correction

### 0. Establish one canonical reason value at every owned boundary

The policy already treats a reason as `value.strip() or None`; all owned paths
must use the same semantics without changing `src/crm/policy/`. Add one small,
testable normalizer in an existing owned application module, then use its
normalized output defensively inside both `QueryService` methods as well as at
the API and page ingress/audit paths. It is not sufficient to normalize only
in a route: direct `QueryService` callers must be safe too.

The only current call sites are JSON list/detail in
`src/crm/web/routes/institutions.py`, page detail in `src/crm/web/main.py`,
and the two query methods in `src/crm/application/queries.py`. Search again
before editing and apply the same normalized value for projection, withdrawn
retrieval, exception decision, and read-exception audit reason. A whitespace-only
value must behave exactly like omitted input: it cannot include withdrawn
activities, cannot produce an `ADMINISTRATOR_EXCEPTION` view, and cannot
write `admin.exception_read`.

### 1. Restore the approved single-reason archive contract

`SPEC-0001 R-036` requires an administrator, a reason, and an audit trail. It
does not define separate archive and administrator-authorization reasons.
Remove the remediation-introduced `administrator_reason` field from
`ArchiveInstitutionRequest` and authorize archive only when the caller has
`Role.ADMINISTRATOR`, the normalized `archive_reason` is nonblank, and the
target exists. All denials remain non-disclosing.

Keep the existing `ArchiveInstitutionCommand` contract: the same normalized
`archive_reason` is persisted on the institution and recorded with actor,
target, timestamp, and success in the transactional `institution.archive`
audit. Do not add a second reason field or change the audit schema.

Tests must use only `archive_reason`: ordinary owner is denied with no state or
success-audit change; administrator with a nonblank reason succeeds and the
persisted reason equals the audit reason; blank reason is denied.

### 2. Make whitespace-only read exceptions equivalent to omitted input

In `src/crm/application/queries.py`, do not derive `include_withdrawn` from
the mere presence of `administrator_reason`. It may be true only for the same
canonical condition used by the policy exception: `Role.ADMINISTRATOR` plus a
nonblank normalized reason. Apply the condition consistently in both
`find_institutions` and `get_institution_detail`.

Do not change `project_record` or other unowned policy/domain/model paths. The
normal owner and any non-administrator passing `administrator_reason` must
continue to receive normal projection data, without withdrawn activities and
without a successful administrator-exception audit. The administrator exception
with a real reason must retain the audited withdrawn-history view.

Add all of these regression checks using the existing SQLite-backed fixture;
they must fail against the current implementation before the fix:

- owner detail request with `administrator_reason` does not contain the
  withdrawn activity and leaves no `admin.exception_read` success audit;
- owner list request with that parameter does not let the withdrawn activity
  advance concise progress;
- administrator detail request with a nonblank reason still includes withdrawn
  activity and records the exception audit.
- A principal with both `BUSINESS_USER` and `ADMINISTRATOR` requests API
  detail, API list, and page detail with a whitespace-only reason: no withdrawn
  data, no administrator-exception audit, and no blank audit reason.
- Direct `QueryService.find_institutions` and `get_institution_detail` calls
  with administrator role plus whitespace-only reason retain the normal
  projection, proving route normalization is not the sole defense.

Retain the existing ordinary-owner archive denial, administrator-without-reason
denial, normal administrator exception, and non-administrator reason-injection
tests. Do not weaken, delete, or skip existing coverage.

## Allowed paths

- `src/crm/application/queries.py`
- `src/crm/web/routes/institutions.py`
- `src/crm/web/main.py` only where required to apply the same canonical
  administrator-exception/audit condition to the institution-detail page
- focused tests under `tests/`
- `docs/evidence/TASK-0014-*` and the task card

Read-only dependencies may be inspected, but do not edit `src/crm/policy/`,
`src/crm/domain/`, `src/crm/persistence/models.py`, templates, migrations,
deployment files, remote resources, or unrelated tests. Do not change
`repositories.py` unless a minimal interface-compatible correction is shown to
be necessary; none is currently expected.

## Required verification

Run and report exact results:

```text
PYTHONPATH=src .venv\\Scripts\\python.exe -m pytest tests/test_task0014_core_semantic_security.py -q
PYTHONPATH=src .venv\\Scripts\\python.exe -m pytest tests/ -q
PYTHONPATH=src .venv\\Scripts\\python.exe -m compileall -q src tests
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
```

Also run and report all of these adversarial paths against synthetic state:

1. owner plus administrator with a whitespace-only reason through API detail,
   API list, and page detail;
2. ordinary owner archive with a nonblank archive reason;
3. administrator archive with one genuine `archive_reason`;
4. administrator detail with a genuine nonblank reason.

For each, report status, withdrawn-data visibility, archive state where
applicable, and exact audit action/reason. Do not claim acceptance.

## Next bounded action

Return one structured completion report with exact changed paths, pre-fix test
failures, commands/results, skipped and not-verified checks, risks/rollback,
and this final line:

`STOP: coordinator audit required; do not start TASK-0010 or TASK-0015.`
