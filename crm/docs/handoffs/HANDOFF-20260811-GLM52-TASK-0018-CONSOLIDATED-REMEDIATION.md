# HANDOFF-20260812: TASK-0018 consolidated correction to DeepSeek-v4-flash in PI

- Task: TASK-0018
- From tool/model: Codex architecture owner / independent reviewer
- To tool/model: DeepSeek-v4-flash in PI
- Handoff status: READY FOR ONE CORRECTION PASS
- Repository state: `main` at `59101b8`, uncommitted TASK-0018 candidate work and unrelated governance changes preserved
- Written at: 2026-08-12 Asia/Shanghai
- Authority: `DEC-0089`, `DEC-0121`, `DEC-0122`, `DEC-0123`, and approved `SPEC-0012 v0.2.0`
- Prior pass: `docs/evidence/TASK-0018-DEEPSEEK-PI-EXECUTION-20260811.md` is self-verification only

## PI execution prompt

```text
You are the sole implementation owner for the one authorized TASK-0018
correction pass in D:\Project\中科安樵\crm. Execute the correction; do not
only describe it. This is the single consolidated correction pass under
DEC-0122. Your report is not acceptance; Codex will independently recheck
the repository afterward.

Read before editing:
- AGENTS.md
- docs/specs/30-approved/SPEC-0012-deployment-operations.md and its approval JSON
- docs/tasks/active/TASK-0018-deployment-operations-evidence.md
- docs/decisions/DECISION-LOG.md: DEC-0089, DEC-0121, DEC-0122, DEC-0123
- docs/evidence/TASK-0018-GPT56-INDEPENDENT-AUDIT-20260811.md
- this handoff in full

Scope and exclusive owned paths for this correction:
- scripts/operations_evidence.py
- tests/test_task0018_operations.py
- tests/test_migrations.py
- docs/evidence/TASK-0018-DEEPSEEK-PI-CORRECTION-20260812.md
- docs/tasks/active/TASK-0018-deployment-operations-evidence.md, factual
  self-verification note only

Do not modify approved SPECs, approval JSON, TASK-0022-owned audit/governance
files, the correction handoff, unrelated application paths, or prior evidence.
Preserve every existing dirty/untracked file. Do not reset, clean, delete,
commit, push, deploy, access SSH/server/nginx/TLS/DNS/systemd, mutate a
production/shared database, use real data or credentials, or call external AI.
Never print or store a secret.

Verified defects to fix:
1. `scripts/operations_evidence.py` uses an in-memory SQLite engine, tests
   only that a JSON object has an `operation_records` key, and deletes its
   temporary artifact. This does not prove durable local records or a restore
   rehearsal (TASK-0018 acceptance 3; SPEC-0012 R-004/AC-004).
2. `tests/test_migrations.py` omits `operation_records` from `USER_TABLES`,
   so the optional PostgreSQL round-trip does not assert this new table
   explicitly through upgrade, downgrade, and second upgrade.

Required behavior:
1. Make the evidence sequence use a file-backed local SQLite source database,
   not `sqlite://`/`StaticPool`, for the operation-record proof. It may use a
   caller-provided temporary working directory in tests. Do not commit any
   generated database or backup artifact.
2. Make backup and restore a real local rehearsal. Create a backup artifact,
   restore it into a separate fresh database/engine, and verify at least one
   seeded persisted record from the restored database. A JSON key, table name,
   or in-memory object is insufficient evidence.
3. Prove the seven operation records are durable: close the source engine and
   reopen the file with a fresh engine/session before listing/asserting the
   records. The evidence must include backup, restore, verified deletion
   propagation, unverified deletion propagation, deployment change, failed
   rollback, and successful rollback.
4. Continue to use the backup artifact itself to verify deletion-propagation
   state. A propagation that is not verified must have `unverified` outcome
   and no `completed_at`; do not report it as success.
5. Add focused tests that fail against the old implementation and prove:
   - restored data is queried from a fresh restored database;
   - records survive a close/reopen of the source database; and
   - a missing/corrupt backup does not yield a successful restore record.
   Keep all data synthetic and cleanup confined to test temporary directories.
6. Add `operation_records` to `tests/test_migrations.py` `USER_TABLES`.
   Do not claim the PostgreSQL-gated round trip passed unless it actually runs.
7. Keep all fail-closed health behavior, no-secret handling, operation type
   constraints, and human-acceptance separation intact.

Run and record actual commands, exit codes, and material output:
- .venv/Scripts/python.exe -m pytest tests/test_task0018_operations.py -q
- .venv/Scripts/python.exe scripts/operations_evidence.py
- .venv/Scripts/python.exe -m pytest tests/test_persistence_schema.py tests/test_migrations.py -q
- .venv/Scripts/python.exe -m pytest tests/ -q
- the health script with synthetic complete, missing-secret, and unavailable
  database cases; report PASS/FAIL/UNAVAILABLE and actual child exit codes
- a scoped no-secret scan of all TASK-0018 deliverables
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
- git diff --check

Write docs/evidence/TASK-0018-DEEPSEEK-PI-CORRECTION-20260812.md with exact
changed paths, requirements-to-evidence mapping, commands, exit codes,
material output, failures, and NOT VERIFIED boundaries. Update the TASK-0018
card only with factual self-verification. Do not write ACCEPTED.

Final response format, and nothing else:
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, result per line>
evidence: docs/evidence/TASK-0018-DEEPSEEK-PI-CORRECTION-20260812.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

## Verified current state

- `scripts/operations_evidence.py:65-69` uses in-memory SQLite.
- `scripts/operations_evidence.py:271-277` treats a JSON key as a successful
  restore; `:361-363` reads the live in-memory state and deletes the artifact.
- The independent audit reproduced `22 passed` focused tests, `363 passed, 28
  skipped` full tests, governance PASS, and health PASS/FAIL/UNAVAILABLE
  behavior. Passing checks do not cure the semantic defect.
- `tests/test_migrations.py` must add the new table to `USER_TABLES`; the
  PostgreSQL-gated test remains NOT VERIFIED unless the isolated environment
  is actually enabled.

## Completion boundary

Return one factual `HANDOFF-ONLY` report. Codex will inspect the actual diff,
files, evidence, and test results. A second material failure is escalated to
the product owner under `DEC-0122`; do not invent a third repair loop.
