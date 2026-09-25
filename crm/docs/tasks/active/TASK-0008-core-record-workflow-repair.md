# TASK-0008: Core record, contact, and follow-up workflow repair

- Task ID: TASK-0008
- Status: **ACTIVE / ACCEPTED** (local synthetic) — DEC-0081; Steps 1–6 all
  ACCEPTED by coordinator 2026-08-04; gated `crm_test` + browser visual remain
  NOT VERIFIED
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Also governed by: `SPEC-0002`
- Implementation authorized by: Product owner, `DEC-0081` (2026-08-04)
- Authorization evidence: product owner reply `授权` on 2026-08-04 after
  coordinator clarified that authorization opens DeepSeek implementation, not
  coordinator coding
- Scope confirmation: DEC-0080 (2026-08-04)
- Implementation owner: DeepSeek (bounded steps only; coordinator unlocks one
  step at a time via prompts in
  `docs/handoffs/HANDOFF-20260804-DEEPSEEK-TASK-0008-ORCHESTRATION.md`)
- Coordinator / auditor: opencode / grok-4.5 (orchestration + step acceptance;
  does not implement application code for this task)
- Audit started at: 2026-08-04
- Audit last updated: 2026-08-04 (DEC-0081 authorize; S0 freeze done by
  coordinator; S1 unlocked)
- Depends on: `TASK-0007` (ACCEPTED per DEC-0067)

## Ownership release

`DEC-0090` releases this task's implementation paths for one later
`DEC-0089` task at a time. Its accepted evidence and separate browser visual
acceptance gate remain unchanged.

## Goal

Close the remaining authorized manual-workflow gaps after the S5/S6/TASK-0007
work: (a) factual correction and withdrawal with versioned history and no hard
delete (R-031/AC-025), (b) duplicate-suspicion prompting without leakage or
auto-merge (R-035/AC-028), (c) audited administrator exception access and
exception operations (R-015/AC-009, R-036/AC-029 remainder), (d) the
communication-method category in concise progress (R-029 remainder), and
(e) browser-side creation forms so the four-step flow is complete from the UI,
not only from the JSON API. The record, contact, and follow-up **create** paths
(AC-001~AC-004, R-001~R-006, R-025~R-028) are already closed by S5/S6 and are
regression-only scope here.

## Scope

- SPEC rules remaining open per the gap analysis: `SPEC-0001` R-007 (via
  R-031), R-015 (admin-exception end-to-end), R-029 (method category),
  R-031, R-035, R-036 (correction/withdrawal + admin exception ops);
  `SPEC-0002` R-003/R-006/R-013 apply as governing constraints to every new
  route (no new bypass path).
- Acceptance criteria remaining open: `SPEC-0001` AC-009, AC-025, AC-028,
  AC-029 (admin-exception part). AC-001~AC-008, AC-010~AC-012, AC-021~AC-024
  are closed; they are regression-only.
- Dead/defective code within the workflow slice:
  - the three command `from_dict()` implementations (`application/commands.py:53,144,254`)
    are unreachable and always raise `TypeError` — fix or remove them;
  - the empty contact-projection loop in `application/queries.py:264-277`.
- P2 hardcoded `user_status=UserStatus.ENABLED` (`web/main.py:236,274`;
  `web/routes/institutions.py:105,152,189`): **in scope — repair** (pass
  session-verified status). Currently non-exploitable (`auth.py:371`).
- Engineering defaults locked 2026-08-04 (AI-owned under DEC-0002/DEC-0003;
  product owner reserved only real business-scenario choices; details in
  `docs/evidence/TASK-0008-GAP-ANALYSIS.md` §8):
  - R-029: write-time category field ∈ {电话, 微信, 面谈, 邮件, 其他};
    free-text `interaction_method` remains owner-detail only.
  - R-035: create-time exact match only — institution normalized name;
    contact same-institution + same non-empty channel value; no-leak,
    confirm-to-continue, no auto-merge; no fuzzy/region matching.
  - R-031/R-036 ops in scope: correction, withdrawal, archive, admin-exception
    read+audit. Owner transfer stays out (Non-goals / SPEC-0002 R-009~R-012).
  - AC-012 / R-028: dedicated positive automated tests required.
- Owned files/directories (exclusive while this task holds the step; TASK-0001
  must not edit these paths concurrently):
  - `src/crm/application/commands.py`, `src/crm/application/queries.py`;
  - `src/crm/persistence/repositories.py`, and `src/crm/persistence/database.py`
    only if a shared transaction wrapper is needed for revision+audit atomicity;
  - `src/crm/web/routes/followups.py`, `src/crm/web/routes/institutions.py`,
    `src/crm/web/main.py` (route/wiring + P2 status pass-through);
  - institution/contact/follow-up **form templates** (missing today) and the
    existing detail/list/dashboard templates only for the form entry points;
  - focused domain, persistence, command/query, route, and template tests under
    `tests/` that this task adds or must change for its scope;
  - `docs/evidence/TASK-0008-*` and this task card.

## Non-goals

- No search, bulk import, AI coaching, discovery, export, deployment, or
  real-data change.
- No owner transfer / batch transfer (SPEC-0002 R-009~R-012).
- No hard deletion; archive/withdrawal semantics only.
- No unrelated framework refactor or visual redesign.
- No direct policy bypass in routes or templates.
- No `crm_test` / SSH / server work unless a **separate** DEC names that round.
- Coordinator does not implement application code; DeepSeek does not audit.

## Assumptions and unknowns

- [VERIFIED] S0 freeze check PASSED by coordinator 2026-08-04
  (`docs/evidence/TASK-0008-S0-FREEZE-CHECK.md`): local `106 passed, 1 skipped`;
  gap assertions still hold.
- [VERIFIED] Engineering defaults locked (GAP §8 / DEC-0080).
- [UNKNOWN] Browser visual acceptance of new forms (human, later).
- [UNKNOWN] Any gated `crm_test` leg (needs separate authorization).

## Prerequisites and completion gate

- Prerequisites: TASK-0007 ACCEPTED (done); DEC-0081 implementation authorization
  (done 2026-08-04).
- Exact output: versioned correction/withdrawal/archive, duplicate prompting,
  admin-exception read with audit events, method-category concise progress,
  browser-side creation forms, P2 status pass-through, and the dedicated
  AC-012/R-028 tests — all behind the central policy projection. No owner
  transfer in this task.
- Completion gate: focused tests + local suite green; role matrix including
  new admin-exception audit assertions; coordinator accepts each step before
  the next unlock; human visual acceptance separately recorded.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 0 | DEC-0080 | Coordinator freeze check only | S0 evidence | Suite + assertion re-check | **PASSED** (coordinator) |
| 1 | DEC-0081 | DeepSeek: contracts + dead-code fix + revision+audit txn design | Contract map + code | Compile/tests; baseline hold | **ACCEPTED** (coordinator 2026-08-04) |
| 2 | Step 1 accepted | DeepSeek: correction/withdrawal/archive (R-031/R-036 owner path) | Versioned history | AC-025; no hard delete; txn tests | **ACCEPTED** (coordinator 2026-08-04) |
| 3 | Step 2 accepted | DeepSeek: duplicate prompt (R-035/AC-028) | Non-leaking warning | AC-028 no-leak / no auto-merge | **ACCEPTED** (coordinator 2026-08-04) |
| 4 | Step 3 accepted | DeepSeek: admin-exception read + audit (R-015/AC-009) | Audited exception path | AC-009 actor/target/time/reason | **ACCEPTED** (coordinator 2026-08-04) |
| 5 | Step 4 accepted | DeepSeek: R-029 category + creation forms + AC-012/R-028 tests | UI + categorized progress | R-029 + parity + dedicated tests | **ACCEPTED** (coordinator 2026-08-04) |
| 6 | Step 5 accepted | DeepSeek: P2 ENABLED repair + full local regression + evidence | Acceptance pack | Suite green; role matrix | **ACCEPTED** (coordinator 2026-08-04) |

## Risks and rollback

- Revision persistence can corrupt history if old/current bodies are conflated:
  append-only, never in-place update; synthetic fixtures + rollback tests.
- Admin-exception surface is highest-leakage risk: always `project_record` with
  `administrator_reason`, never raw query.
- Browser forms must not render fields outside policy projection.

## Evidence and result

- Status: ACTIVE / ACCEPTED (local); Steps 1–6 all ACCEPTED by coordinator 2026-08-04
- Final suite: `183 passed, 28 skipped`; governance `[PASS]`; P2 hardcode gone
- Evidence: S0–S6 + `TASK-0008-ACCEPTANCE.md` + `TASK-0008-S6-ACCEPTANCE.md`
- Not verified: browser visual acceptance by product owner
- Gated `crm_test` leg: **PASSED** 2026-08-05 (DEC-0082; 25/25 on real
  PostgreSQL via SSH forward; two test-data edits in
  `test_s6_integration.py` for R-035 interaction; evidence
  `TASK-0008-CRM-TEST-VERIFICATION.md`)
- **Deployed** 2026-08-05 (DEC-0083; `https://crm.aibrain.wiki` running
  TASK-0008 code; evidence `TASK-0008-DEPLOY.md`)
