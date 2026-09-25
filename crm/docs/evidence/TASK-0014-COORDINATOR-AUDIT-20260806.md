# TASK-0014 coordinator audit

- Date: 2026-08-06 Asia/Shanghai
- Auditor: current coordinator
- Executor under audit: GLM-5.2 (`xopglm52`)
- Verdict: `NOT ACCEPTED / REMEDIATION-REQUIRED`
- Boundary: local synthetic data only; no deployment, remote PostgreSQL/SSH,
  real-data write, credential change, paid service, or external write

## Scope inspected

- Active task: `docs/tasks/active/TASK-0014-core-semantic-security-closure.md`
- Approved sources: `SPEC-0001 v0.2.0`, `SPEC-0002 v0.2.0`, and matching
  approval metadata. The current hashes match their metadata:
  `29bbf28d13911a29db4716c028ca8b166507a4ef0376f83cb1b11e9942215986` and
  `0c313e4f2592ba33bf7331dff7a4f1e73ede5b107436f4446309f3354115b8f4`.
- Reviewed changed implementation/test paths listed by GLM-5.2, their policy,
  command, authentication, persistence, and existing parity-test consumers.

## Findings

### P1: Ordinary record owners can still archive records

`src/crm/web/routes/institutions.py:321-325` accepts an archive request when
the caller is the owner. The administrator exception is added as an additional
allow path, rather than replacing the unapproved owner archive path.

This conflicts with `SPEC-0001 R-036` and the active task: archive is an
administrator exception requiring reason and audit; the owner may maintain
current institution/contact facts and correct or withdraw activities, but may
not archive.

Reproduction used the GLM-supplied `t14_sqlite_env` fixture, logged in as its
ordinary `BUSINESS_USER` owner, then posted:

```text
POST /api/institutions/{owned-id}/archive
{"archive_reason":"owner_supplied_reason"}
=> 200
=> {"archived": true, ...}
```

The existing tests cover an administrator without a reason and a non-owner
non-administrator, but do not cover the required owner-denied case.

### P1: Any owner can expose withdrawn activities with a user-supplied reason

`src/crm/application/queries.py:225-239` and `:298-305` derive
`include_withdrawn` from `administrator_reason is not None` before policy
projection. The API routes pass that untrusted query parameter into the query
service. Their route-local `is_admin_exception` flag checks the administrator
role only for audit recording, not for data retrieval.

Reproduction used the same SQLite fixture and ordinary owner:

```text
GET /api/institutions/{owned-id}?administrator_reason=owner_supplied_reason
=> 200
=> activity_bodies = ["T14 withdrawn follow-up", "T14 normal follow-up"]
```

The request did not qualify as an administrator exception and therefore did
not receive its required `admin.exception_read` audit event. This violates the
task's normal-history versus explicit audited-view boundary and `SPEC-0001
R-015/R-031`. The current tests cover only the administrator success path.

## Checks actually run

| Check | Result |
|---|---|
| Adversarial owner archive reproduction | `200`, archived record returned (failure reproduced) |
| Adversarial owner withdrawn-history reproduction | `200`, withdrawn activity returned (failure reproduced) |
| `PYTHONPATH=src .venv\\Scripts\\python.exe -m pytest tests/test_task0014_core_semantic_security.py -q` | `11 passed` |
| `PYTHONPATH=src .venv\\Scripts\\python.exe -m pytest tests/ -q` | `195 passed, 28 skipped, 1 warning` |
| `PYTHONPATH=src .venv\\Scripts\\python.exe -m compileall -q src tests` | exit 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]`, 7 approved SPECs, 10 active tasks, 1 legacy manifest |

## Not verified

- Browser visual acceptance.
- Remote PostgreSQL/SSH, deployment, production migration, real-data writes,
  credential changes, paid services, and external writes.

## Required correction gate

See `docs/handoffs/HANDOFF-20260806-GLM52-TASK-0014-REMEDIATION.md`. Do not
start a successor task before an independent coordinator audit accepts the
corrected TASK-0014 implementation.
