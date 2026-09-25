# TASK-0006: Governance, task, and evidence reconciliation

- Task ID: TASK-0006
- Status: CLOSED / ACCEPTED (final batch accepted by Kimi-K3, 2026-08-02)
- Task type: DOCUMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0062` (initial assignment), `DEC-0063` through
  `DEC-0065` (orchestration and review budget), `DEC-0066` (succession:
  Kimi-K3 coordinator and independent final reviewer; final reconciliation
  batch assigned to a ZCode subagent)
- Owner tool: Qoder executed the earlier stages (factual history per
  `DEC-0066`); the final reconciliation batch is executed by a ZCode subagent
  dispatched directly by the coordinator
- Owner model (earlier stages, historical Qoder self-report): Qwen3.8-max-preview
- Final batch executor runtime model: recorded verbatim in the executor's final
  result; `UNKNOWN - runtime identifier not exposed` when the runtime does not
  expose one (per `DEC-0066` recording discipline; agents and models are never
  conflated)
- Reviewer: Kimi-K3 on the ZCode agent, coordinator and independent final
  acceptance reviewer per `DEC-0066` (read-only verdict against repository file
  state)
- Stage A acceptance record: `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`
- Audit started at: 2026-07-31 19:36:38 +08:00
- Audit last updated: 2026-08-02 (final reconciliation batch accepted by
  Kimi-K3)
- Depends on: architecture takeover review, `DEC-0061`, `DEC-0062`, `DEC-0066`

## Goal

Make every current-status document, task card, and evidence claim describe the
same verified phase, with unsupported completion claims clearly withdrawn while
preserving the historical record.

## Scope

- SPEC rules: evidence and acceptance statements for `SPEC-0001`, `SPEC-0002`,
  `SPEC-0008`, `SPEC-0012`, and `SPEC-0013`.
- Owned files/directories (earlier stages, historical):
  - `docs/NOW.md`, `docs/PROJECT.md`;
  - `docs/governance/DEVELOPMENT-SEQUENCE.md`;
  - `docs/specs/INDEX.md`, `docs/specs/SPEC-BASELINE.md` status prose only;
  - `docs/tasks/TASKS.md`;
  - current task cards under `docs/tasks/active/` and the invalid
    `docs/tasks/proposed/TASK-0004-fix-query-service.md`;
  - affected evidence status headers under `docs/evidence/`;
  - `docs/evidence/TASK-0006-*` and this task card.
- Owned files (final batch, per
  `docs/handoffs/HANDOFF-20260802-KIMI-TASK-0006-FINAL-BATCH.md`): exactly 18
  files — 5 Group A task/control files (`docs/tasks/TASKS.md` and the four
  active task cards TASK-0001/0002/0003/0006) and 13 Group B historical
  evidence files, each receiving one uniform adjudication header with the
  original body preserved.

Approved SPEC bodies and approval metadata are not owned.

## Non-goals

- No source, test, deployment, server, database, or real-data change.
- Do not erase prior evidence. Mark superseded, contradicted, or not verified
  with a pointer to the takeover review.
- Do not invent replacement pass evidence.

## Assumptions and unknowns

- [VERIFIED] Current control documents and task cards conflict about active
  tasks, completed gates, and next work.
- [VERIFIED] TASK-0002/TASK-0003 do not satisfy the task template's ownership
  and authorization metadata requirements.
- [UNKNOWN] Live-server parity remains outside this documentation task.

## Stage and succession record

- [VERIFIED] The Stage A repository result (the five canonical control
  documents) was accepted by Codex on 2026-08-01; that acceptance is
  historical fact and is recorded in
  `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`.
- [VERIFIED] The Stage A transport-report defect is closed as
  `PARTIAL / ESCALATED` under `DEC-0065`; it is non-blocking and no runtime
  fact is derived from it.
- [VERIFIED] Succession per `DEC-0066`: Codex has exited; Kimi-K3 on the ZCode
  agent is the coordinator and independent final reviewer; the final
  reconciliation batch is executed by a ZCode subagent; Qoder's execution of
  the earlier stages remains factual history.

## Prerequisites and completion gate

- Prerequisites: `DEC-0062`/`DEC-0063` authorized the earlier stages (executed
  by Qoder, factual history); `DEC-0066` records the succession and assigns
  the final batch to a ZCode subagent; the executor verifies the 18 input
  hashes from the final-batch handoff before editing.
- Exact output: one consistent current phase, one authoritative ordered task
  list, explicit status for every prior completion claim, and one uniform
  historical-evidence adjudication header in each Group B evidence file.
- Completion gate: the consolidated acceptance sweep passes (changed-path audit
  equals exactly the 18 owned files, Group B header checks, required-text and
  forbidden-text checks, seven approved-SPEC hash checks, and
  `scripts/check-governance.ps1` PASS), followed by the independent final
  acceptance review by Kimi-K3.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| Earlier stages (1-5) | `DEC-0062`/`DEC-0063` | Historical execution by Qoder across the earlier stages | Historical evidence and Stage A control-document reconciliation | Stage A repository result independently accepted by Codex on 2026-08-01 (`docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`) | HISTORICAL / STAGE A ACCEPTED |
| Final batch | Stage A accepted (historical) | Execute the final consolidated reconciliation: 5 Group A task/control edits + 13 Group B uniform adjudication headers, per `docs/handoffs/HANDOFF-20260802-KIMI-TASK-0006-FINAL-BATCH.md` | 18 owned files reconciled | Consolidated acceptance sweep (hash-manifest diff, header/semantic checks, approved-SPEC hash checks, governance PASS) + independent final review by Kimi-K3 (`docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`) | ACCEPTED (Kimi-K3, 2026-08-02) |

Overall Task Result: ACCEPTED (Kimi-K3 final acceptance, 2026-08-02; evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`)

## Risks and rollback

- Historical evidence can be damaged if rewritten as though it never occurred.
  Preserve original observations and append a clear current verdict.
- Approved SPEC hashes must not change.

## Evidence and result

- Status: ACCEPTED — the final batch was executed by a ZCode subagent and
  independently accepted by Kimi-K3 on 2026-08-02
  (`docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`).
- Commands actually run (final batch):
  - Preflight input-hash verification: 18/18 owned input SHA-256 values matched
    the final-batch handoff; baseline manifest recorded outside the repository.
  - Consolidated acceptance sweep: changed-path audit, Group B header checks,
    required/forbidden text checks, seven approved-SPEC hash checks, and
    `powershell -ExecutionPolicy Bypass -File scripts\check-governance.ps1`.
- Result artifacts (final batch):
  - Updated: `docs/tasks/TASKS.md`;
    `docs/tasks/active/TASK-0001-manual-core-record-activity.md`;
    `docs/tasks/active/TASK-0002-search-parameter-rename.md`;
    `docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md`;
    this task card.
  - Updated: 13 historical evidence files under `docs/evidence/`, each with
    exactly one uniform adjudication header inserted after the first H1;
    original bodies preserved.
  - Stage A files (`docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`,
    `docs/specs/SPEC-BASELINE.md`, `docs/governance/DEVELOPMENT-SEQUENCE.md`)
    were not edited in this batch.
- Result artifacts (earlier stages, historical):
  - `docs/evidence/TASK-0006-governance-evidence-matrix.md` (created)
  - `docs/handoffs/HANDOFF-20260731-QODER-TASK-0006-REVISED.md` (revised handoff document)
  - Updated: NOW.md, PROJECT.md, DEVELOPMENT-SEQUENCE.md, INDEX.md, SPEC-BASELINE.md
  - Updated: affected task cards and evidence file status headers
- Not verified: current online database/service state; W4/S5/S6 acceptance;
  authenticated `?q=` filtering.
- Decisions needed: none; TASK-0006 is closed. TASK-0007 through TASK-0011
  remain PROPOSED/UNAUTHORIZED pending explicit product-owner authorization.
