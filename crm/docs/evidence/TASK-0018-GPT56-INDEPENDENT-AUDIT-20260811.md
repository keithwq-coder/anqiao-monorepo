# TASK-0018 independent repository audit

- Status: BLOCKED
- Audit role: Codex architecture owner / independent reviewer under `TASK-0022`
- Audit date: 2026-08-12 Asia/Shanghai
- Authority: `SPEC-0012 v0.2.0`, `DEC-0089`, `DEC-0121`, and `DEC-0122`
- Final review verdict: `ESCALATE_TO_PRODUCT_OWNER`

## Scope and boundary

This audit reviewed the actual local worktree and DeepSeek self-verification.
It did not access a remote host, production or shared database, credentials,
real data, external AI, or deployment systems. All checks used local synthetic
configuration and test state.

## Repository facts

- [VERIFIED] Branch: `main`, base commit `59101b8`.
- [VERIFIED] The worktree is dirty. TASK-0018 candidates include
  `src/crm/persistence/models.py`, migration `0006_operation_records.py`,
  `src/crm/persistence/operation_repository.py`, the two operations scripts,
  `tests/test_task0018_operations.py`, `tests/test_persistence_schema.py`,
  and the TASK-0018 evidence files. Unrelated dirty governance files were
  preserved.
- [VERIFIED] `docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md`
  reports `HANDOFF-ONLY`; it is self-verification, not acceptance.
- [VERIFIED] `git diff --check` completed cleanly (only existing LF-to-CRLF
  warnings for two tracked files).

## Independent checks

| Check | Actual result | Boundary |
|---|---|---|
| `.venv\\Scripts\\python.exe -m pytest tests/test_task0018_operations.py -q` | `22 passed` | Local SQLite synthetic only |
| `.venv\\Scripts\\python.exe scripts/operations_evidence.py` | Exit 0; reported 7 records | Semantics rejected below |
| `.venv\\Scripts\\python.exe -m pytest tests/test_persistence_schema.py -q` | `6 passed` | Metadata only |
| `.venv\\Scripts\\python.exe -m pytest tests/test_migrations.py -q` | `1 passed, 1 skipped` | PostgreSQL round trip skipped |
| `.venv\\Scripts\\python.exe -m pytest tests/ -q` | `363 passed, 28 skipped, 1 warning` | Completed locally in 109.02 seconds |
| `scripts/check_operations_health.py` with complete synthetic config | PASS, process exit 0 | No database probe |
| Same health check with missing secrets | FAIL, process exit 1 | No secret value printed |
| Same health check with a synthetic unavailable database and `--probe-database` | UNAVAILABLE, direct child process exit 2 | No remote resource contacted |
| Scoped credential-signature scan | No output / rg exit 1 | Source inspection found synthetic placeholders only |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS; 8 approved SPECs, 19 active tasks | Governance structure only |

## Material findings

### P1: The claimed backup/restore evidence is not durable or a restore rehearsal

- [VERIFIED] `scripts/operations_evidence.py:65-69` creates only an in-memory
  SQLite database (`sqlite://` with `StaticPool`). Its operation records cease
  to exist when the process ends.
- [VERIFIED] The purported restore at
  `scripts/operations_evidence.py:271-277` declares success solely when the
  parsed JSON has an `operation_records` key. It never restores data into a
  fresh database or verifies a restored record.
- [VERIFIED] `scripts/operations_evidence.py:361-363` lists records only from
  the still-live in-memory engine and then deletes the only backup artifact.
  It provides no reopen/restart proof of durable, locally inspectable records.
- [VERIFIED] This conflicts with TASK-0018 required acceptance 3 and
  `SPEC-0012` R-004/AC-004: backup and recovery must be verified, not merely
  represented by a JSON schema key. It also makes the DeepSeek report's claim
  that all seven records are durable and inspectable unsupported.

### P2: PostgreSQL round-trip table coverage omits the new table explicitly

- [VERIFIED] `tests/test_migrations.py:13-24` defines `USER_TABLES` without
  `operation_records`; the PostgreSQL round-trip assertions at lines 78, 84,
  and 93 therefore omit it from their explicit expected-table set.
- [INFERENCE] `alembic check` may catch some forms of drift when the gated test
  runs, but the required new table should still be part of the test's direct
  upgrade/downgrade contract. This is a focused coverage correction, not a
  claim that a PostgreSQL migration was run.

## Required correction

The initial independent result was `REJECT_AND_DISPATCH_CORRECTION_TASK`.
One bounded DeepSeek correction pass was prepared in
`docs/handoffs/HANDOFF-20260811-GLM52-TASK-0018-CONSOLIDATED-REMEDIATION.md`.
It is the only approved remediation scope: correct the two findings above,
update factual TASK-0018 evidence, and return `HANDOFF-ONLY` for a second
independent review.

## Correction dispatch outcome

- [VERIFIED] On 2026-08-12, the correction prompt was submitted to local PI
  with requested model `deepseek/deepseek-v4-flash` and execution approval.
- [VERIFIED] PI ended before repository execution. Its captured provider result
  was `402: Insufficient Balance`.
- [VERIFIED] No correction evidence file, TASK-0018 card update, or owned
  implementation diff was produced after the dispatch attempt.
- [BLOCKED] Restoring provider balance or changing an external model provider
  can incur a cost or alter account/billing state. `AGENTS.md` requires explicit
  product-owner confirmation immediately before that action. The product owner
  supplied a retry authorization recorded as `DEC-0123`.
- [VERIFIED] The `DEC-0123` retry used the same bounded handoff and again ended
  before repository execution with `402: Insufficient Balance`. No correction
  evidence, TASK-0018 card update, or owned implementation diff was produced.
- [BLOCKED] Actual provider-balance restoration or an account/provider change
  remains an external billing operation that cannot be performed from this
  repository without the product owner's account action.
- [ESCALATION] `ESCALATE_TO_PRODUCT_OWNER`: authorize a provider-balance or
  model-availability remedy and make that external account state available,
  then rerun this exact repository handoff. The current TASK-0018
  implementation remains unaccepted.

## Not verified

- PostgreSQL migration upgrade/downgrade/upgrade round trip.
- Remote/server/SSH/nginx/TLS/DNS/systemd behavior.
- Production backup/restore, real deletion propagation, or live rollback.
- Product-owner browser, visual, and business acceptance.
