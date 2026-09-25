# HANDOFF-20260821-DEEPSEEK-V4-FLASH-0731-TASK-0040

- Task: TASK-0040 (isolated opportunity crawler and external-model integration)
- From tool/model: Reasonix (planning session)
- To tool/model: deepseek-v4-flash-0731 (new session, execution)
- Handoff status: HANDOFF-ONLY
- Repository state: `uncommitted` worktree (zero-commit history per repo convention); relevant paths: `docs/tasks/active/TASK-0040-opportunity-external-integration.md`, `docs/tasks/TASKS.md`, `docs/decisions/DECISION-LOG.md`, `docs/NOW.md`, this file
- Written at: 2026-08-21 local time (UTC+8)

## Required reading

- `AGENTS.md` (canonical repository contract)
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` + matching `.approval.json`
- `docs/tasks/active/TASK-0040-opportunity-external-integration.md` (contains the landed execution plan)
- `docs/decisions/DECISION-LOG.md` — `DEC-0158` (OD-006a resolution + TASK-0040 authorization), `DEC-0159` (execution-owner change + plan landing)

## Verified current state

- [VERIFIED] `DEC-0158` (2026-08-21) resolves `OD-006a` and authorizes creation and execution of `TASK-0040`: DeepSeek endpoint/model via runtime env vars; crawler limited to public tender/procurement announcements; outbound whitelist (title, body/abstract when needed, source URL, publication timestamp, announcement type, non-sensitive audit metadata); forbidden: customer names, phones, contacts, follow-up bodies, CRM notes, raw evidence, credentials; first execution isolated local with synthetic/controlled fixtures; real external requests need immediate pre-call confirmation; leak scan before display; audit model id + field names only; timeout/error degradation to local deterministic reason; human adjudication before any customer creation or pool adoption. (`docs/decisions/DECISION-LOG.md`)
- [VERIFIED] `TASK-0040` card exists at `docs/tasks/active/TASK-0040-opportunity-external-integration.md`, status `ACTIVE / AUTHORIZED, NOT STARTED`, authorized by `DEC-0158`. Owner updated to deepseek-v4-flash-0731 (this handoff).
- [VERIFIED] `SPEC-0003 v0.4.0` is APPROVED (`DEC-0153`, 2026-08-13); OD-006a is resolved by `DEC-0158`. (`docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`)
- [VERIFIED] Current code ships synthetic stubs: `src/crm/application/opportunity.py` has `SYNTHETIC_AI_MODEL = "synthetic-stub"` and a synthetic crawler source returning no external data; `OpportunityService` already exposes a `crawler_source` injection point and a R-013 leak-scan/fallback path (`grep` on 2026-08-21). TASK-0039 already removed the legacy v0.3.0 reminder infrastructure.
- [VERIFIED] A prior Codex report claiming `OD-006a` was still blocking is OUTDATED: `DEC-0158` was recorded after it. Do not re-request authorization; execute within `DEC-0158` + `DEC-0159`.

## Changes made (by this planning session)

- `docs/handoffs/HANDOFF-20260821-DEEPSEEK-V4-FLASH-0731-TASK-0040.md` — this handoff.
- `docs/tasks/active/TASK-0040-opportunity-external-integration.md` — execution owner changed Codex → deepseek-v4-flash-0731; five-phase execution plan appended.
- `docs/tasks/TASKS.md` — TASK-0040 row owner/status updated.
- `docs/decisions/DECISION-LOG.md` — added `DEC-0159` (owner change + plan landing).
- `docs/NOW.md` — TASK-0040 line notes the owner change and plan landing.

No application code, test, migration, configuration, or evidence file was touched by this planning session.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `date +%Y-%m-%d` | local Windows bash | `2026-08-21` | this handoff date |
| `ls docs/tasks/active/` | local | `TASK-0040-opportunity-external-integration.md` present | shell output 2026-08-21 |
| `git status --short` | local | uncommitted worktree with prior session changes | shell output 2026-08-21 |
| Read `DECISION-LOG.md`, `SPEC-0003` v0.4.0, `TASK-0040` card, `TASKS.md`, `NOW.md` | local | state above | read outputs 2026-08-21 |

## Failed or not verified

- `pytest tests -q`, `compileall`, `git diff --check`, governance script: **NOT RUN by this planning session**. The new session must run the baseline first (execution plan phase 1).
- Approval-hash check (`SPEC-0003-opportunity-discovery.approval.json` vs current SPEC file SHA-256): NOT RUN; do it in phase 1.
- DeepSeek runtime env vars presence: NOT CHECKED; local work must not require them.
- The product owner must rotate the previously exposed DeepSeek API key before any real call; the new key is supplied only as a runtime env var.

## Next bounded action

Start execution plan phase 1 (governance preflight): verify approval hash and `SPEC-BASELINE.md`, run baseline `pytest` and governance checks, then proceed to phase 2. All work stays inside `DEC-0158` boundaries; real external requests require immediate product-owner confirmation; no commit, no push, no production action.
