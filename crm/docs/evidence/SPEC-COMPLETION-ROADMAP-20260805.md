# Approved SPEC completion roadmap

- Date: 2026-08-05
- Authority: `DEC-0089`
- Status: ORCHESTRATION-READY; no application code changed by this roadmap
- Executor: DeepSeek, one implementation task at a time
- Coordinator/auditor: current coordinator

## Boundary

This roadmap covers the seven approved SPEC files in
`docs/specs/30-approved/` (`SPEC-0001`, `SPEC-0002`, `SPEC-0003`, `SPEC-0008`,
`SPEC-0011`, `SPEC-0012`, `SPEC-0013`). It does not implement or approve draft
`SPEC-0014`.

All implementation and automated verification below use local synthetic data.
Remote PostgreSQL/SSH, deployment, production migration, real-data import,
credentials, billing, and external writes require separate decisions.

## Verified gap map

| Priority | Capability | SPEC | Current evidence | Bounded task |
|---|---|---|---|---|
| P0 | Enabled user without a business role can write records; owner projection has a UUID/string edge | `SPEC-0001`, `SPEC-0002` | `src/crm/web/routes/institutions.py`, `src/crm/web/routes/followups.py`, `src/crm/application/commands.py`; existing negative coverage is incomplete | `TASK-0014` |
| P1 | Archive authority, withdrawn-history projection, and core semantic consistency | `SPEC-0001` | `src/crm/web/routes/institutions.py`, `src/crm/persistence/repositories.py`, `src/crm/application/queries.py` | `TASK-0014` |
| P1 | Search matches hidden `source_description` before projection and paginates before visibility filtering | `SPEC-0008` | `src/crm/persistence/repositories.py:70-95`, `src/crm/application/queries.py:196-242` | existing `TASK-0010` |
| P1 | Role grant/revoke audit, user enable/disable, owner transfer, management summaries | `SPEC-0002` | current routes/services expose authentication and role reads but not the full management capability | `TASK-0015` |
| P1 | Durable deletion, deletion audit/request completion, backup propagation and restore proof | `SPEC-0011` | archive/withdrawal exist; erasure and propagation records do not | `TASK-0017` |
| P1 | Reusable batch identity, row results, duplicate flags, idempotent rerun, conditional undo | `SPEC-0013` | existing one-time import is not a reusable capability | existing `TASK-0011` |
| P1 | Discovery reminders, provenance, masking and no-claim workflow | `SPEC-0003` | no opportunity model/service/route/page/test is present | `TASK-0016` |
| P1 | Periodic backup, restore drill, operations audit, rollback evidence and human acceptance records | `SPEC-0012` | deployment/HTTPS/health evidence exists; backup/restore/ops audit closure is absent | `TASK-0018` |
| P1 | Deterministic dependency and integration-test baseline | cross-cutting | existing `TASK-0009` is proposed and not authorized | existing `TASK-0009` |

The map is a coordination aid, not a substitute for the approved SPECs. If
source inspection contradicts a row, the executor must stop and report the
conflict rather than invent behavior.

## Ordered execution

1. **Ownership and baseline preflight**: completed for `TASK-0009` by
   `DEC-0090`; each successor still requires its own release check.
2. **`TASK-0009`**: establish a reproducible dependency and integration-test
   baseline. This is a prerequisite for security claims from later tasks.
3. **`TASK-0014`**: close P0 write authorization and SPEC-0001 semantic gaps
   using existing domain concepts only; add negative tests first.
4. **`TASK-0010`**: repair actor-aware search predicates and prove no hidden
   field or existence oracle.
5. **`TASK-0015`**: implement the approved SPEC-0002 management/admin surface
   (role/user state audit, owner transfer, concise management visibility).
6. **`TASK-0017`**: implement SPEC-0011 lifecycle records and local synthetic
   deletion/backup propagation proof; do not touch production data.
7. **`TASK-0011`**: implement reusable SPEC-0013 batch import against synthetic
   files only; do not rerun the historical real-data load.
8. **`TASK-0016`**: implement SPEC-0003 discovery reminders using deterministic
   synthetic inputs unless the approved SPEC explicitly permits another source.
9. **`TASK-0018`**: implement the local operational evidence and fail-closed
   release/rollback/backup checks required by SPEC-0012. Deployment remains a
   separate gate.
10. **Coordinator audit**: independently inspect changed files, run focused
    tests, the full local suite, and the governance check for each accepted
    task. A task is `PARTIAL` when any acceptance criterion is unverified.

## Global stop conditions

- A behavior-changing unknown, conflicting approved source, missing approval
  hash, or missing active task is a hard stop.
- Any requested edit outside the task's owned paths is a hard stop.
- Any real-data, remote-server, production, credential, paid-service, or
  external-write action is a hard stop unless separately authorized.
- No task may claim `PASSED` from static inspection alone; tests and runtime
  evidence are reported separately.

## Completion meaning

"All SPECs implemented" is only claimable after every task has a coordinator
acceptance record, every approved acceptance criterion has evidence, the final
governance check is `[PASS]`, and all remaining human/remote gates are listed as
`NOT VERIFIED` rather than inferred.
