# TASK-0018: DeepSeek in PI correction evidence (2026-08-12)

- Task ID: TASK-0018
- SPEC: SPEC-0012 v0.2.0 (approval SHA-256 verified
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`)
- Correction scope: the single consolidated correction pass authorized by
  `DEC-0122` / `DEC-0123` via
  `docs/handoffs/HANDOFF-20260811-GLM52-TASK-0018-CONSOLIDATED-REMEDIATION.md`
- Executor: DeepSeek in PI (sole implementation owner under `DEC-0121`)
- Date: 2026-08-12 (Asia/Shanghai)
- Status: HANDOFF-ONLY — self-verification, NOT acceptance. Codex performs
  the independent repository re-check.

## 1. Read-before-edit

Read in full before any edit: `AGENTS.md`, `docs/NOW.md`, `docs/PROJECT.md`,
`docs/specs/INDEX.md`, `docs/decisions/DECISION-LOG.md` (DEC-0089,
DEC-0121, DEC-0122, DEC-0123), `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
and its `.approval.json`, `docs/tasks/active/TASK-0018-deployment-operations-evidence.md`,
`docs/evidence/TASK-0018-GPT56-INDEPENDENT-AUDIT-20260811.md`, and the
correction handoff in full.

- [VERIFIED] SPEC-0012 file SHA-256 matches the approval JSON
  (`621131c0...dac1192`).
- [VERIFIED] Worktree inspected before editing; all pre-existing dirty and
  untracked files preserved (no reset, clean, delete, commit, or push).

## 2. Repository state at start of this pass

The audit `TASK-0018-GPT56-INDEPENDENT-AUDIT-20260811.md` described
`scripts/operations_evidence.py:65-69` as an in-memory SQLite engine
(`sqlite://` with `StaticPool`), `:271-277` as a JSON-key-only restore, and
`:361-363` as live in-memory listing. This pass re-inspected the actual file
(552 lines) rather than trusting the audit prose:

- [VERIFIED] `scripts/operations_evidence.py` line 77 uses
  `create_engine("sqlite:///" + path)` — a file-backed SQLite engine. No
  `StaticPool` is imported or used anywhere in the script (grep:
  `StaticPool` appears only inside a docstring that explicitly disclaims it).
- [VERIFIED] `perform_restore_rehearsal` (lines ~240-320) reads the backup
  artifact, deletes any prior restore file, creates a brand-new file-backed
  database at `restore_db_path`, inserts the serialized rows, and verifies
  the seeded `ops_admin` user from the restored database.
- [VERIFIED] `run_evidence` step 8 disposes the source engine, reopens the
  same file with a fresh engine/session, and lists the seven records from
  the reopened database.
- [VERIFIED] Runtime probe (see section 6.3): source DB file 233472 bytes,
  restore DB file 233472 bytes, backup artifact 3289 bytes; seven records
  readable from a fresh reopen of the source file; `ops_admin` readable
  from the fresh reopened restore file.

Conclusion: the file-backed/durable behavior the audit required was already
present in the working tree for the evidence script. The remaining gaps from
the audit's required correction were (a) focused regression tests that
provably fail against the old in-memory/JSON-key semantics and (b) the
`operation_records` table missing from `USER_TABLES` in
`tests/test_migrations.py`.

## 3. Changed paths (this pass)

- `tests/test_task0018_operations.py` — added five regression tests in a new
  `TestFileBackedRestoreAndDurability` class:
  1. `test_source_records_survive_close_and_reopen` — closes/reopens the
     file-backed source DB with a fresh engine and asserts all seven
     operation records and all five operation types are readable.
  2. `test_restored_data_is_readable_from_fresh_restored_database` — opens
     the restored database file with a fresh engine and asserts the seeded
     `ops_admin` persisted record is actually readable from it (a JSON key
     or table name alone is not a restore).
  3. `test_missing_backup_restore_is_never_success` — a missing backup
     yields `(False, reason)`, never a successful restore.
  4. `test_corrupt_backup_restore_is_never_success` — a corrupt backup
     yields `(False, reason)`, never a successful restore.
  5. `test_json_key_alone_is_not_a_successful_restore` — a backup JSON that
     carries an `operation_records` key but no restored seeded data must
     NOT be treated as a successful restore.
- `tests/test_migrations.py` — added `"operation_records"` to `USER_TABLES`
  so the PostgreSQL-gated round-trip test's explicit expected-table set
  includes the new table (upgrade, downgrade, second upgrade).
- `scripts/operations_evidence.py` — no change required; verified
  file-backed and durable as-is (evidence in section 2/6).
- Created `docs/evidence/TASK-0018-DEEPSEEK-PI-CORRECTION-20260812.md`
  (this file).
- `docs/tasks/active/TASK-0018-deployment-operations-evidence.md` — appended
  a factual self-verification note only (no status change, no ACCEPTED).

No other file was modified. The pre-existing dirty files
(`docs/NOW.md`, `docs/decisions/DECISION-LOG.md`,
`docs/governance/MODEL-ROUTING.md`, `docs/governance/WORKFLOW.md`,
`docs/specs/10-draft/SPEC-GOV-0001-...`, `docs/tasks/TASKS.md`,
`src/crm/persistence/models.py`, `tests/test_persistence_schema.py`) and all
pre-existing untracked files were left untouched by this pass.

## 4. Requirements-to-evidence mapping

| Correction requirement | Where satisfied | Evidence |
|---|---|---|
| 1. File-backed SQLite source DB; no `sqlite://`/`StaticPool` for the persistence proof | `scripts/operations_evidence.py` `create_sqlite_engine` | grep: only `sqlite:///`+file path; no StaticPool import; runtime probe 6.3 |
| 2. Real backup artifact restored into a separate fresh DB/engine; at least one seeded record queried from the restored DB | `perform_restore_rehearsal` + new test `test_restored_data_is_readable_from_fresh_restored_database` | test pass; probe shows `ops_admin` readable from reopened restore file |
| 3. Close source engine, reopen with fresh engine, prove seven records readable | `run_evidence` step 8 + new test `test_source_records_survive_close_and_reopen` | test pass; probe shows 7 records from fresh reopen |
| 4. Deletion propagation checked against the backup artifact; unverified recorded as `unverified` with `completed_at` null, never `success` | `_simulate_deletion_propagation` + `_record_operation` (`completed_at = now if outcome != "unverified" else None`) | evidence script output shows `[unverified] deletion_propagation`; existing test `test_deletion_propagation_record_durable_and_inspectable` asserts `completed_at is None` |
| 5. Tests that fail against the old implementation | new `TestFileBackedRestoreAndDurability` (5 tests) | old-semantics simulation 6.4 shows all three failure modes |
| 6. `operation_records` in `tests/test_migrations.py` `USER_TABLES` | `tests/test_migrations.py` | diff shows `+ "operation_records"` |
| 7. Fail-closed health check, no secrets, human/automated acceptance separation preserved | unchanged `scripts/check_operations_health.py`, `TestNoSecretsInEvidence`, `TestAcceptanceSeparation`, `TestFailClosedHealthCheck` | 6.5, 6.6, 6.7 |

## 5. Literal commands, exit codes, and material output

### 5.1 Focused TASK-0018 tests (post-change)

```
.venv/Scripts/python.exe -m pytest tests/test_task0018_operations.py -q
...........................................                      [100%]
27 passed in 3.18s
```
Exit code 0. (22 pre-existing + 5 new regression tests.)

### 5.2 Operations evidence script (post-change)

```
.venv/Scripts/python.exe scripts/operations_evidence.py
  Records written: 7
  [   success] rollback             synthetic_rollback_completed
  [    failed] rollback             synthetic_rollback_attempt
  [   success] deployment_change    synthetic_config_update
  [unverified] deletion_propagation synthetic_erasure_propagation_pending
  [   success] deletion_propagation synthetic_erasure_propagated_to_backup
  [   success] restore              synthetic_restore_rehearsal
  [   success] backup               synthetic_full_backup
RESULT: PASSED — all operation records durable and inspectable
```
Exit code 0. Deletion propagation incomplete recorded as `unverified`
(no `completed_at`), never `success`.

### 5.3 Runtime probe of durability/restore (fresh engines, on-disk files)

```
passed: True
source_db exists: True size: 233472
restore_db exists: True size: 233472
backup exists: True size: 3289
records from fresh reopen of source: 7
types: ['backup', 'deletion_propagation', 'deployment_change', 'restore', 'rollback']
admin in restored db: True
missing backup -> ok: False failure: backup could not be read or parsed: FileNotFoundError
corrupt backup -> ok: False failure: backup could not be read or parsed: JSONDecodeError
key-only backup -> ok: False failure: restored database contains no seeded persisted user record
```
Exit code 0. The restore success depends on an actual seeded record being
readable from the restored database, not on a JSON key.

### 5.4 Schema + migration tests (post-change)

```
.venv/Scripts/python.exe -m pytest tests/test_persistence_schema.py tests/test_migrations.py -q
.......s                                                                  [100%]
7 passed, 1 skipped in 1.11s
```
Exit code 0. The single skip is the PostgreSQL round-trip
(`CRM_RUN_POSTGRESQL_TESTS` not set) — environment-gated, unchanged.
Combined focused run including the new tests:

```
.venv/Scripts/python.exe -m pytest tests/test_task0018_operations.py tests/test_persistence_schema.py tests/test_migrations.py -q
..................................s                                      [100%]
34 passed, 1 skipped in 4.21s
```
Exit code 0.

### 5.5 Full regression

```
.venv/Scripts/python.exe -m pytest tests/ -q
368 passed, 28 skipped, 1 warning in 79.99s (0:01:19)
```
Exit code 0. Baseline per the task card is `341 passed, 28 skipped`;
predecessor `360 passed, 28 skipped`; prior DeepSeek pass
`363 passed, 28 skipped`; this pass `368 passed, 28 skipped`
(363 + 5 new regression tests; no regression).

### 5.6 Health check fail-closed paths (child process exit codes)

Case 1 — complete synthetic config (no DB probe):
```
RESULT: PASS
```
Child process exit code 0. (DATABASE_PASSWORD and SESSION_SECRET_KEY shown
as `present (value hidden)`; never printed.)

Case 2 — missing secrets:
```
  [        FAIL] DATABASE_PASSWORD        missing — must be supplied at runtime
  [        FAIL] SESSION_SECRET_KEY       missing — must be supplied at runtime
  [        FAIL] Settings.load            Settings validation rejected: ValidationError
RESULT: FAIL
```
Child process exit code 1. Fail-closed: missing secret is FAIL, not PASS.

Case 3 — synthetic unreachable database with `--probe-database`:
```
  [ UNAVAILABLE] database.connect         database not reachable (dependency unavailable)
RESULT: UNAVAILABLE
```
Child process exit code 2. Unavailable dependency is distinguished from
FAIL and PASS (SPEC-0012 §8).

### 5.7 Scoped no-secret scan

Pattern scan over all TASK-0018 deliverables and this correction scope
(`scripts/operations_evidence.py`, `scripts/check_operations_health.py`,
`tests/test_task0018_operations.py`, `tests/test_migrations.py`,
`src/crm/persistence/models.py`, `src/crm/persistence/operation_repository.py`,
`migrations/versions/0006_operation_records.py`) for
`BEGIN (RSA|EC|OPENSSH)? PRIVATE KEY`, `AKIA[0-9A-Z]{16}`,
`api[_-]?key`/`access[_-]?token`/`password`/`secret` assignments with
12+-char literal values:

```
rg ... ; echo $?
RG_EXIT=1
```
Exit code 1 (no matches). All values in the evidence path are synthetic
placeholders (`t18-...`, `...synthetic...`, `...placeholder...`); the health
script prints `(value hidden)` and never prints the password.

### 5.8 Governance check

```
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 8
  - Active tasks: 19
  - Legacy manifests checked: 1
```
Exit code 0.

### 5.9 Whitespace/conflict check

```
git diff --check
```
Clean. Only pre-existing LF→CRLF warnings for `src/crm/persistence/models.py`,
`tests/test_persistence_schema.py`, `tests/test_migrations.py`; no
whitespace errors.

## 6. Verification of "fails against the old implementation"

The audit described the old implementation as: in-memory SQLite source
(no durable file) and restore success determined solely by the presence of
an `operation_records` key in the parsed JSON. A simulation of those exact
semantics (section 6.4) plus the new tests demonstrate the failure modes:

### 6.1 Restored data is actually read from the restored database

New test `test_restored_data_is_readable_from_fresh_restored_database`
creates a fresh engine on the on-disk `restore.sqlite3` produced by the
evidence run and asserts the seeded `ops_admin` row is readable. Under the
old implementation no restored database with data exists, so the assertion
fails.

### 6.2 Records survive close/reopen of the source database

New test `test_source_records_survive_close_and_reopen` asserts
`os.path.exists(result["source_db_path"])` and that a fresh engine over that
file yields all seven records and all five operation types. Under the old
in-memory implementation no file exists and no records survive the process,
so the test fails.

### 6.3 Missing/corrupt backup can never be a successful restore

New tests `test_missing_backup_restore_is_never_success`,
`test_corrupt_backup_restore_is_never_success`, and
`test_json_key_alone_is_not_a_successful_restore` assert
`perform_restore_rehearsal` returns `(False, reason)`. The runtime probe
confirmed: `FileNotFoundError`, `JSONDecodeError`, and
"restored database contains no seeded persisted user record" respectively.

### 6.4 Old-semantics simulation (executed)

```
old impl restore of key-only backup -> ok: True
new test asserts ok is False -> old impl FAILS this test: True
old impl (in-memory) creates no source file -> exists: False
new test asserts file exists and reopen yields 7 records -> old impl FAILS
old impl creates no restored DB with seeded data -> exists: False
new test asserts seeded admin readable from restored DB -> old impl FAILS
```
Exit code 0. All three new failure-mode tests are shown to fail under the
old semantics.

## 7. Failures

None during this pass. All required checks passed on the corrected state.

## 8. NOT VERIFIED boundaries

- PostgreSQL-gated migration round-trip
  (`tests/test_migrations.py::test_postgresql_upgrade_downgrade_upgrade_round_trip`)
  was NOT run: `CRM_RUN_POSTGRESQL_TESTS` is unset, so the test is skipped
  (1 skip). The `operation_records` table was added to `USER_TABLES`, but no
  real PostgreSQL upgrade/downgrade/upgrade was executed. NOT VERIFIED.
- Remote/server/SSH/nginx/TLS/DNS/systemd behavior — out of scope; no remote
  resource was contacted.
- Production or shared database backup/restore and real deletion propagation —
  local SQLite synthetic rehearsal only.
- Real deployment rollback on a live server — local synthetic evidence only.
- Product-owner browser/visual/business acceptance — separate record; not
  inferred from any automated check (per SPEC-0012 §9 and the task card).
- The audit's description of `scripts/operations_evidence.py` as in-memory at
  lines 65-69/271-277/361-363 does not match the current file; this pass
  verified the actual file and behavior directly rather than relying on the
  audit's line references.

## 9. Task card update

`docs/tasks/active/TASK-0018-deployment-operations-evidence.md` received only
a factual self-verification note for this correction pass. No status change
to ACCEPTED, no ownership change.

## 10. Awaiting

`CODEX_INDEPENDENT_REVIEW` — this report is self-verification only and does
not constitute acceptance of TASK-0018.
