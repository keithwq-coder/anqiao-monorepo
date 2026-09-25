# HANDOFF-20260731-QODER-TASK-0006

- Task: `TASK-0006` governance, task, and evidence reconciliation
- From tool/model: Codex / GPT-5, architecture and acceptance owner
- To tool/model: Qoder / exact runtime model must be self-reported
- Handoff status: HANDOFF-ONLY / TASK ASSIGNED BY `DEC-0062`
- Repository state: `main`, no commits, all current repository files untracked;
  preserve the worktree and do not clean, reset, commit, push, delete, restore,
  or overwrite unrelated files
- Written at: 2026-07-31 19:36:38 +08:00

## Qoder first response gate

Before editing any file, Qoder must return all of the following:

1. exact Qoder tool/version and actual runtime model identifier;
2. confirmation that every required-reading file below was loaded;
3. `git status --short` summary without cleaning or changing anything;
4. current phase: documentation reconciliation only;
5. assumptions and unknowns;
6. exact owned files and explicit non-goals from TASK-0006.

If Qoder cannot report its actual model or a required file is missing/conflicts,
it must stop and report the blocker. It must not infer or substitute facts.

## Required reading

- `AGENTS.md` in full;
- `QODER.md`;
- `docs/NOW.md`, `docs/PROJECT.md`;
- `docs/specs/INDEX.md`, `docs/specs/SPEC-BASELINE.md`;
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0061` and `DEC-0062`;
- `docs/evidence/ARCH-20260731-TAKEOVER-REVIEW.md`;
- `docs/tasks/TASKS.md`;
- `docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md`;
- all files under `docs/tasks/active/`;
- `docs/tasks/proposed/TASK-0004-fix-query-service.md`, including the
  coordinating adjudication at the top;
- relevant status/evidence documents under `docs/evidence/` referenced by
  TASK-0001, TASK-0002, TASK-0003, and TASK-0004.

Do not use `docs/specs/99-legacy/`, Qoder memory, prior chat claims, or server
logs quoted by another model as current authority.

## Verified current state

- [VERIFIED] Governance structure passes but does not detect semantic conflicts
  among task cards, control panels, evidence, and current code behavior.
- [VERIFIED] Three old task files remain under `docs/tasks/active/`; their
  completion states are disputed and must not be used as passed prerequisites.
- [VERIFIED] TASK-0004's attachment conclusion is rejected. A fresh local
  `TestClient` request returned HTTP 500 because
  `src/crm/web/routes/institutions.py:126` evaluates a lambda containing an
  undefined `request` name.
- [VERIFIED] The one-time Suzhou data load was ratified by DEC-0058, but it is
  not completion evidence for the reusable SPEC-0013 product capability.
- [VERIFIED] TASK-0005 is cancelled by DEC-0061 and is not part of this work.

## Authorized changes

Qoder owns only the documentation paths listed in TASK-0006:

- `docs/NOW.md`, `docs/PROJECT.md`;
- `docs/governance/DEVELOPMENT-SEQUENCE.md`;
- status prose in `docs/specs/INDEX.md` and `docs/specs/SPEC-BASELINE.md`;
- `docs/tasks/TASKS.md`;
- TASK-0001, TASK-0002, TASK-0003, TASK-0004, and TASK-0006 task cards;
- affected evidence status headers under `docs/evidence/`;
- `docs/evidence/TASK-0006-*`;
- Qoder's TASK-0006 completion handoff under `docs/handoffs/`.

Before the first substantive edit, update the TASK-0006 card with the exact
runtime model and acknowledge ownership. Do not change any approved SPEC body or
approval metadata/hash.

## Required work

1. Build a claim-to-evidence matrix covering every claimed gate/status for
   TASK-0001 through TASK-0004.
2. Classify each claim as `VERIFIED`, `CONTRADICTED`, `NOT VERIFIED`, or
   `HISTORICAL ONLY`, with paths and commands.
3. Reconcile NOW, PROJECT, development sequence, SPEC status prose, task index,
   active task cards, and affected evidence headers to one current phase.
4. Preserve historical observations. Append current adjudication rather than
   rewriting history as though an execution never occurred.
5. Keep the one-time TASK-0003 data-load decision separate from completion of
   SPEC-0013 capability.
6. Keep TASK-0007 and later tasks proposed and unauthorized.
7. Run the required verification and prepare a completion handoff for Codex.

## Forbidden work

- No changes under `src/`, `tests/`, `templates/`, `migrations/`, `deploy/`,
  `scripts/`, `opt/`, root runtime/debug scripts, dependencies, or archives.
- No server/SSH/network access, deployment, restart, database operation, or
  real-data read/write.
- No approved SPEC or approval JSON edits.
- No new product or technical behavior decisions.
- No commit, push, reset, clean, deletion, broad formatting, or unrelated
  metadata churn.
- Do not declare application, authentication, search, import, S5, or S6 passed.

## Checks actually required

| Command/check | Environment | Required result |
|---|---|---|
| `git status --short` | local repository | Preserve all pre-existing files; report task-owned changes separately |
| targeted `rg` status/claim searches | local repository | No conflicting current ACTIVE/COMPLETE claims for TASK-0001 through TASK-0004 |
| approved SPEC hash comparison | local repository | All seven approval hashes unchanged |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | local repository | PASS |

## Required completion output

Qoder must finish with:

1. `Status`: passed, partial, blocked, or handoff-only;
2. `Scope`: exact files changed;
3. `Evidence`: commands and exact results;
4. `Not verified`;
5. `Decisions needed`;
6. the actual Qoder model identifier;
7. a new repository handoff file to Codex.

Qoder must not self-approve TASK-0006. Codex will independently inspect the
diff, rerun governance/consistency checks, and issue the acceptance verdict.

## Next bounded action

Qoder performs only the first-response gate, then TASK-0006 documentation
reconciliation. Any request to repair application behavior returns to Codex for
separate task authorization and ownership assignment.
