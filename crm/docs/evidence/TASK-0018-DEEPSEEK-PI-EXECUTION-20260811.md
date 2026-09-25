# TASK-0018: DeepSeek-v4-flash in PI execution evidence (2026-08-11)

- Task ID: TASK-0018
- SPEC: SPEC-0012 v0.2.0 (approval SHA-256 verified
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`)
- Executor: DeepSeek-v4-flash in PI (sole implementation owner under
  `DEC-0121`; handoff `HANDOFF-20260811-GLM52-TO-DEEPSEEKV4FLASH-PI-TASK-0018.md`)
- Runtime model identifier: `PI_MODEL=deepseek-v4-flash`, `PI_PROVIDER=deepseek`
  (exposed by the PI runtime environment on 2026-08-11; no longer `UNKNOWN`)
- Date: 2026-08-11 (Asia/Shanghai)
- Pass type: one bounded local reconciliation/implementation pass
- Status: SELF-VERIFIED ONLY — NOT ACCEPTED (Codex independent review pending)

## 1. Current Git status

Captured before any edit (`git status --short --branch`):

```text
## main
 M docs/NOW.md
 M docs/decisions/DECISION-LOG.md
 M docs/governance/MODEL-ROUTING.md
 M docs/governance/WORKFLOW.md
 M docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md
 M docs/tasks/TASKS.md
 M docs/tasks/active/TASK-0018-deployment-operations-evidence.md
 M src/crm/persistence/models.py
 M tests/test_persistence_schema.py
?? docs/evidence/TASK-0018-IMPLEMENTATION.md
?? docs/handoffs/HANDOFF-20260811-GLM52-TO-DEEPSEEKV4FLASH-PI-TASK-0018.md
?? docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md
?? migrations/versions/0006_operation_records.py
?? scripts/check_operations_health.py
?? scripts/operations_evidence.py
?? src/crm/persistence/operation_repository.py
?? tests/test_task0018_operations.py
```

(Note: the status above was captured by the executor with
`git status --short --branch` before any edit; the post-pass status is
identical except that `docs/evidence/TASK-0018-*` now includes this file and
the TASK-0018 card received a factual note — see sections 9 and 10. No
unrelated dirty or untracked file was touched, added, or removed by this
pass.)

## 2. Governance read-before-edit

Per AGENTS.md section 1, the following were read in full before editing:
`AGENTS.md`, `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`,
`docs/decisions/DECISION-LOG.md` (DEC-0089, DEC-0119, DEC-0120, DEC-0121,
DEC-0122), `docs/specs/30-approved/SPEC-0012-deployment-operations.md` and its
`.approval.json`, `docs/tasks/active/TASK-0018-deployment-operations-evidence.md`,
`docs/specs/SPEC-BASELINE.md` (`Status: COMPLETE`).

- [VERIFIED] SPEC-0012 file SHA-256 matches the approval JSON
  (`621131c0...dac1192`); command:
  `certutil -hashfile docs/specs/30-approved/SPEC-0012-deployment-operations.md SHA256`
- [VERIFIED] TASK-0018 is ACTIVE under DEC-0089/DEC-0121 with owned paths as
  recorded in the card; SPEC-BASELINE `Status: COMPLETE`; prerequisites
  TASK-0009/TASK-0014/TASK-0017 ACCEPTED per the card.
- [VERIFIED] Predecessor candidates were inspected (not trusted) in the actual
  worktree before any edit: `src/crm/persistence/models.py`,
  `tests/test_persistence_schema.py`, `migrations/versions/0006_operation_records.py`,
  `scripts/check_operations_health.py`, `scripts/operations_evidence.py`,
  `src/crm/persistence/operation_repository.py`,
  `tests/test_task0018_operations.py`, `docs/evidence/TASK-0018-IMPLEMENTATION.md`.

## 3. Reconciliation result — one verified defect fixed

The predecessor's implementation was reproduced first (see section 5 for the
reproduction commands). Reconciliation against SPEC-0012 and the TASK-0018
card's four Required acceptance rules found one material defect in scope:

- TASK-0018 card, Required acceptance 3, requires "Backup, restore rehearsal,
  **deletion propagation status**, deployment change, rollback, and operations
  audit records are durable and inspectable locally."
- SPEC-0012 R-005 / AC-005 / §8 / §7 minimum data contract require a
  SPEC-0011 permanent deletion to be recorded as propagated to the backup
  within a bounded window **or marked incomplete** — never success when
  unverified.
- SPEC-0011 R-005 / AC-004 define the same fail-closed "propagated or marked
  incomplete" contract; `erasure_records` (TASK-0017) already tracks per-erasure
  `propagation_status` (`pending|verified|incomplete`).

The predecessor's `operation_records` model, migration, repository, evidence
script, and focused tests only covered `backup`, `restore`, `deployment_change`,
`rollback`; no `deletion_propagation` operation type existed and no deletion
propagation evidence was produced. That is a verified gap against the approved
contract.

Fix applied (surgical, owned paths only):

1. `src/crm/persistence/models.py` — `OperationRecordModel.operation_type`
   CHECK constraint extended with `'deletion_propagation'`; docstring updated.
   Outcome semantics unchanged: `success` = verified propagation (requires
   `completed_at`), `unverified` = marked incomplete (`completed_at` NULL),
   `failed` = propagation failed. The existing `completed_at_consistency`
   CHECK already enforces the fail-closed pairing.
2. `migrations/versions/0006_operation_records.py` — same CHECK extension.
   This migration is untracked and never applied to any database (local
   synthetic only); correcting it keeps model ↔ migration consistent.
3. `src/crm/persistence/operation_repository.py` — `deletion_propagation`
   added to `_ALLOWED_OPERATION_TYPES`.
4. `scripts/operations_evidence.py` — backup dump now includes
   `erasure_records`; new `_simulate_deletion_propagation` step seeds two
   synthetic SPEC-0011 erasure records, writes them into the backup copy,
   marks one `verified` (propagated within the bounded 30-day window) and
   leaves the other `pending`. The evidence sequence records
   `deletion_propagation` `success` for the verified one and
   `deletion_propagation` `unverified` for the incomplete one (never success).
   Record count 5 → 7; `passed` logic updated to require the propagation
   checks, the unverified record, and a failed rollback.
5. `tests/test_task0018_operations.py` — added
   `test_deletion_propagation_record_durable_and_inspectable`,
   `test_deletion_propagation_success_accepted_by_repository`,
   `test_deletion_propagation_unverified_accepted_by_repository`, and updated
   `test_script_produces_durable_records` to 7 records including the verified
   and marked-incomplete propagation records (19 → 22 focused tests).

No other candidate change was found defective: the `operation_records` table,
fail-closed health check (FAIL/UNAVAILABLE/PASS with exit codes 1/2/0), the
schema-allowlist sync (`operation_records` in `test_persistence_schema.py`),
and the repository validation were all reproduced and retained.

## 4. Exact changed paths (this pass)

Corrected/edited (all owned by TASK-0018; all were already dirty or untracked
predecessor candidates):

- `src/crm/persistence/models.py`
- `migrations/versions/0006_operation_records.py`
- `src/crm/persistence/operation_repository.py`
- `scripts/operations_evidence.py`
- `tests/test_task0018_operations.py`

Created (owned by TASK-0018):

- `docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md` (this file)

Factual note added (owned path — TASK-0018 card):

- `docs/tasks/active/TASK-0018-deployment-operations-evidence.md`

Retained unchanged from predecessor (reproduced, no defect found):

- `tests/test_persistence_schema.py` (+1 line `operation_records` in
  `EXPECTED_TABLES`)
- `scripts/check_operations_health.py`
- `docs/evidence/TASK-0018-IMPLEMENTATION.md` (predecessor historical record;
  supersession addendum appended, see section 10)

Untouched by this pass (preserved as found): `docs/NOW.md`,
`docs/decisions/DECISION-LOG.md`, `docs/governance/MODEL-ROUTING.md`,
`docs/governance/WORKFLOW.md`, `docs/specs/10-draft/SPEC-GOV-0001-...`,
`docs/tasks/TASKS.md`, `docs/handoffs/HANDOFF-20260811-...`,
`docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md`. No approved
SPEC, no approval JSON, and no other task's evidence was edited.

## 5. Literal commands, exit codes, and material output

### 5.1 Focused TASK-0018 tests (post-fix)

```
.venv/Scripts/python.exe -m pytest tests/test_task0018_operations.py -q
......................                                                     [100%]
22 passed in 12.33s
```
Exit code 0.

### 5.2 Operations evidence script (post-fix)

```
.venv/Scripts/python.exe scripts/operations_evidence.py
  Records written: 7
  [unverified] deletion_propagation synthetic_erasure_propagation_pending
  [   success] deployment_change    synthetic_config_update
  [    failed] rollback             synthetic_rollback_attempt
  [   success] rollback             synthetic_rollback_completed
  [   success] deletion_propagation synthetic_erasure_propagated_to_backup
  [   success] restore              synthetic_restore_rehearsal
  [   success] backup               synthetic_full_backup
RESULT: PASSED — all operation records durable and inspectable
```
Exit code 0. Fail-closed rollback failure recorded as `failed`, deletion
propagation incomplete recorded as `unverified` (no `completed_at`), never
`success`.

### 5.3 Health check script (fail-closed paths)

Complete config (env-injected synthetic values):

```
.venv/Scripts/python.exe scripts/check_operations_health.py
  [        PASS] DATABASE_HOST            present
  [        PASS] DATABASE_NAME            present
  [        PASS] DATABASE_USER            present
  [        PASS] DATABASE_PASSWORD        present (value hidden)
  [        PASS] CRM_ENVIRONMENT          test
  [        PASS] AI_ENABLED               disabled
  [        PASS] SESSION_SECRET_KEY       present (value hidden)
  [        PASS] Settings.load            loaded (environment=test)
RESULT: PASS
```
Exit code 0.

Missing secret (password and session secret unset):

```
RESULT: FAIL
```
Exit code 1 (password check FAIL; Settings.load FAIL — ValidationError).

Unreachable database with `--probe-database`:

```
  [ UNAVAILABLE] database.connect         database not reachable (dependency unavailable)
RESULT: UNAVAILABLE
```
Exit code 2. Unavailable dependency is distinguished from FAIL and PASS.

### 5.4 Schema + migration tests

```
.venv/Scripts/python.exe -m pytest tests/test_persistence_schema.py tests/test_migrations.py -q
.......s                                                                  [100%]
7 passed, 1 skipped in 1.29s
```
Exit code 0. The single skip is the PostgreSQL round-trip
(`CRM_RUN_POSTGRESQL_TESTS` not set) — expected and unchanged from baseline.

### 5.5 Full regression

```
.venv/Scripts/python.exe -m pytest tests/ -q
363 passed, 28 skipped, 1 warning in 104.95s (0:01:44)
```
Exit code 0. Baseline per the task card is `341 passed, 28 skipped`;
predecessor reported `360 passed, 28 skipped`; this pass reports
`363 passed, 28 skipped` (360 + 3 new deletion-propagation tests). No
pre-existing test regressed. The 28 skips are unchanged PostgreSQL-gated
tests.

### 5.6 Scoped no-secret scan

Pattern scan over all TASK-0018 deliverables (`models.py`,
`operation_repository.py`, `0006_operation_records.py`,
`check_operations_health.py`, `operations_evidence.py`,
`test_task0018_operations.py`, `test_persistence_schema.py`,
`TASK-0018-IMPLEMENTATION.md`) for `BEGIN (RSA|EC|OPENSSH)? PRIVATE KEY`,
`api[_-]?key`, `access[_-]?token`, `AKIA[0-9A-Z]{16}`, and
`password|secret|token = '<value>'` assignments:

- No secret-like assignments found (all synthetic values use
  `synthetic`/`placeholder`/`t18-` markers; health check shows
  `(value hidden)` and never prints the password).
- `aibrain`/`crm.aibrain.wiki` appear only inside negative assertions in the
  test file; no real domain, credential, or private key in any deliverable.

### 5.7 Governance check

```
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 8
  - Active tasks: 19
  - Legacy manifests checked: 1
```
Exit code 0.

### 5.8 Whitespace/conflict check

```
git diff --check
```
Clean (only LF→CRLF warnings pre-existing for `models.py` and
`test_persistence_schema.py`).

## 6. Requirement-to-evidence mapping

| Task card Required acceptance | Evidence |
|---|---|
| No secret in code, docs, evidence, or logs | 5.6 scan clean; `check_operations_health.py` never prints secrets (`value hidden`); `OperationRecordModel` has no secret field (`TestNoSecretsInEvidence`); scripts use synthetic placeholders only |
| Health/auth checks fail closed; distinguish unavailable dependencies from successful login/backup | 5.3: missing password → FAIL (exit 1); unreachable DB → UNAVAILABLE (exit 2); complete config → PASS (exit 0); `AI_ENABLED=true` → FAIL; `TestFailClosedHealthCheck` (4 tests) |
| Backup, restore rehearsal, deletion propagation status, deployment change, rollback, and operations audit records durable and inspectable locally | `operation_records` table + migration; `TestOperationRecordsDurable` incl. new `test_deletion_propagation_record_durable_and_inspectable`; `scripts/operations_evidence.py` now produces 7 durable records covering all five operation types incl. `deletion_propagation` success and `unverified` (5.2) |
| Automated acceptance and product-owner browser/visual acceptance are separate records with no inferred human pass | `TestAcceptanceSeparation` (2 tests): `unverified` distinct from `success`; `detail_summary` explicitly marks human acceptance `NOT VERIFIED`; this report's status is `SELF-VERIFIED ONLY — NOT ACCEPTED` |

SPEC-0012 mapping: R-005/AC-005 (deletion propagation recorded verified or
marked incomplete) — new `deletion_propagation` type + evidence; R-009/AC-009
(admin operations auditable) — actor/FK + type/actor indexes + inspectability
tests; §7 data contract (backup/restore record carries SPEC-0011 deletion
propagation status) — `erasure_records` included in backup dump and
propagation verified against it; §8 (fail-closed; never report failure as
success; incomplete propagation marked incomplete) — outcome vocabulary +
CHECK constraints + repository validation.

## 7. Failures

None during this pass. All five required checks passed on the corrected state.

## 8. NOT VERIFIED boundaries

- Remote/server/SSH/nginx/TLS/DNS/systemd behavior — out of scope; no remote
  resource was contacted.
- Production database backup/restore and real deletion propagation — only
  local SQLite synthetic rehearsal was run.
- Real deployment rollback on a live server — only local synthetic rollback
  evidence.
- Product-owner browser/visual/business acceptance — explicitly separate;
  not inferred from any automated check.
- The PostgreSQL-gated migration round-trip
  (`tests/test_migrations.py::test_postgresql_upgrade_downgrade_upgrade_round_trip`)
  was not run (`CRM_RUN_POSTGRESQL_TESTS` unset); it remains a skipped,
  environment-gated check.

## 9. Task card update

`docs/tasks/active/TASK-0018-deployment-operations-evidence.md` received only
a factual self-verification note for this pass (no status change to ACCEPTED,
no ownership change). See the card for the note text.

## 10. Predecessor evidence supersession

`docs/evidence/TASK-0018-IMPLEMENTATION.md` (GLM5.2/WorkBuddy) is retained as
the historical predecessor record with a factual addendum at its top stating
that: (a) the DeepSeek pass reproduced its checks, (b) one material gap
(deletion propagation status records) was found and corrected, and (c) its
test-count (19), record-count (5), and full-suite figures (360/28) describe
the pre-correction state and are superseded by this file.

## 11. Awaiting

`CODEX_INDEPENDENT_REVIEW` — this report is self-verification only and does
not constitute acceptance of TASK-0018.
