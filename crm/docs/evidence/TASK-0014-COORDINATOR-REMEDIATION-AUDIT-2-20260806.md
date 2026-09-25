# TASK-0014 coordinator remediation audit 2

- Date: 2026-08-06 Asia/Shanghai
- Auditor: current coordinator
- Executor under audit: GLM-5.2 (`xopglm52`)
- Verdict: `NOT ACCEPTED / REMEDIATION-REQUIRED`
- Boundary: local synthetic data only. No deployment, remote PostgreSQL/SSH,
  real-data write, credential change, paid service, or external write occurred.

## Scope and authority verified

- Active task: `docs/tasks/active/TASK-0014-core-semantic-security-closure.md`
  remains `ACTIVE / REMEDIATION-REQUIRED`; GLM-5.2 remains its sole executor.
- Authority: `DEC-0089`, `DEC-0093`, and `DEC-0094`.
- The current SHA-256 values of approved `SPEC-0001` and `SPEC-0002` match
  their approval metadata: respectively
  `29bbf28d13911a29db4716c028ca8b166507a4ef0376f83cb1b11e9942215986` and
  `0c313e4f2592ba33bf7331dff7a4f1e73ede5b107436f4446309f3354115b8f4`.

## Findings

### P1: Whitespace-only administrator reasons still grant and audit an exception

The approved policy canonicalizes an optional reason with `strip() or None` at
`src/crm/policy/projection.py:29-33` and grants its exception only if the
normalized result is present at `:149-155`. The TASK-0014 implementation uses
the weaker raw condition `administrator_reason is not None` in the query
service (`src/crm/application/queries.py:228-231`, `:305-308`), JSON API
audit gates (`src/crm/web/routes/institutions.py:201`, `:260`), and page audit
gate (`src/crm/web/main.py:416`). Those paths no longer agree with the policy.

Using the supplied SQLite-backed TASK-0014 fixture, the coordinator granted
the fixture owner both `BUSINESS_USER` and `ADMINISTRATOR`, then requested:

```text
GET /api/institutions/{owned-id}?administrator_reason=%20%20%20
=> 200; withdrawn activity "T14 待撤回跟进" is present

GET /institutions/{owned-id}?administrator_reason=%20%20%20
=> 200; admin.exception_read events have reason "   "
```

The request therefore exposes audited-exception history and writes a success
audit event without the required nonblank authorization reason. The current
14 focused tests omit a principal that is both owner and administrator with a
whitespace-only reason, and omit the page path.

### P1: Archive audit does not retain the authorization reason

The archive route correctly normalizes and checks `administrator_reason` at
`src/crm/web/routes/institutions.py:311-321`, but constructs
`ArchiveInstitutionCommand` with only `archive_reason` at `:330-334`. The
command records that same business archive reason in the transactional audit
event (`src/crm/application/commands.py:572-580`).

The coordinator submitted distinct values through the SQLite fixture:

```text
administrator_reason = "exception_authorization_reason"
archive_reason       = "record_retention_reason"
POST /api/institutions/{id}/archive => 200
institution.archive audit reason    => "record_retention_reason"
```

The audit trail cannot establish the administrator exception that authorized
the write. This fails the existing remediation handoff requirement that the
actual authorization reason be retained without relying on equal request
fields.

## Checks actually run

| Check | Result |
|---|---|
| Whitespace reason adversarial API/page reproduction | failure reproduced as above |
| Distinct archive/authorization reason reproduction | `200`; audit retains only `archive_reason` |
| `PYTHONPATH=src .venv\\Scripts\\python.exe -m pytest tests/test_task0014_core_semantic_security.py -q` | `14 passed in 3.97s` |
| `PYTHONPATH=src .venv\\Scripts\\python.exe -m pytest tests/ -q` | `198 passed, 28 skipped, 1 warning in 28.19s` |
| `PYTHONPATH=src .venv\\Scripts\\python.exe -m compileall -q src tests` | exit 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]`; 7 approved SPECs, 10 active tasks, 1 legacy manifest |

## Decision

`TASK-0014` is not accepted. Passing tests do not compensate for the two
reproduced P1 authorization/audit defects. `TASK-0010`, `TASK-0011`,
`TASK-0015`, and every later task remain unactivated.

The sole required next action is one consolidated GLM-5.2 correction under
`docs/handoffs/HANDOFF-20260806-GLM52-TASK-0014-REMEDIATION.md`. The executor
must not modify application paths outside the existing task ownership.

## Not verified

- Browser visual acceptance.
- Remote PostgreSQL/SSH, deployment, production migration, real-data writes,
  credential changes, paid services, and external writes.

## Coordinator correction

The archive finding above is retracted by `DEC-0096`. On a re-read of the
approved source, `SPEC-0001 R-036` requires only an administrator operation
with a stated reason and an audit record. It does not define separate business
and authorization reasons. `ArchiveInstitutionCommand` already validates,
persists, and transactionally audits its single `archive_reason`; the
different-two-field reproduction demonstrated a remediation-introduced API
design, not a SPEC violation.

The remaining P1 is the whitespace-only read-exception inconsistency. The
corrected handoff also directs removal of the unapproved archive
`administrator_reason` field and restores the single `archive_reason` contract.
