# TASK-0022 consolidated correction pass — evidence (2026-08-12)

- Task ID: TASK-0022
- Status: HANDOFF-ONLY (one consolidated documentation correction pass
  executed; no claim of feature completion; awaiting Codex independent review)
- Task type: DOCUMENTATION / REVIEW (correction pass)
- Executor: DeepSeek-v4-flash in PI through the configured OpenCode Go
  provider (PI gateway selection only; exact upstream runtime model identifier
  UNKNOWN; a requested label is never assumed active)
- Authority: `DEC-0120`, `DEC-0122`, `DEC-0124`, and the TASK-0022 execution
  protocol. This is the single correction pass permitted by `DEC-0122`.
- Handoff: `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-CONSOLIDATED-CORRECTION.md`
- Written at: 2026-08-12 Asia/Shanghai

## Scope

Documentation/review correction only. No application, test, migration, deploy,
or runtime file was changed; no commit/push/deployment/server/database action
was performed. The worktree remains intentionally dirty; all pre-existing
changes and untracked files are preserved. No decision-log entry, approval
record, or acceptance status was written or changed. This evidence file
supersedes the corrected factual claims of the original pass record
(`docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`), which carries a
matching correction note.

## Provider / model-selection boundary

- [VERIFIED] The initial PI attempt for TASK-0022 named the official
  `deepseek/deepseek-v4-flash` provider and returned `402 Insufficient Balance`
  before any repository execution; `DEC-0126` recorded that external provider
  boundary (evidence: `docs/evidence/TASK-0022-PI-DISPATCH-BLOCKED-20260812.md`).
- [VERIFIED] The completed pass used the configured PI selector
  `opencode-go/deepseek-v4-flash`. That selector identifies the PI gateway
  selection only.
- [NOT CLAIMED] The selector does not prove or claim the upstream model
  identity, the provider billing state, or a new decision-log authorization. No
  such authorization was requested, invented, amended, or recorded by this
  pass.

## Changed paths (exclusive owned set of the correction handoff)

1. `docs/NOW.md`
2. `docs/architecture/ARCHITECTURE.md`
3. `docs/decisions/ADR-0003-current-cloud-modular-monolith.md`
4. `docs/governance/MODEL-ROUTING.md`
5. `docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`
6. `docs/tasks/TASKS.md`
7. `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md`
8. `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`
9. `docs/evidence/TASK-0022-DEEPSEEK-PI-CORRECTION-20260812.md` (this file)

No other path was modified. Approved SPEC bodies, approval metadata,
`DECISION-LOG.md`, README.md, `docs/PROJECT.md`, the `10-draft` SPEC-GOV
pointer, existing handoffs, application code, tests, migrations, deploy
scripts, and TASK-0018-owned paths were not touched.

## Finding-to-fix mapping

- Finding 1 — `MODEL-ROUTING.md` still contained a legacy compact
  product-owner report template that ended by instructing the product owner to
  reply with a continue word, conflicting with `DEC-0124` and the document's
  own verdict-only section. Fix: removed the entire obsolete compact template.
  The document now states that the only normal product-owner-facing response is
  exactly one of `APPROVE_AND_DISPATCH_NEXT_TASK`,
  `REJECT_AND_DISPATCH_CORRECTION_TASK`, or `ESCALATE_TO_PRODUCT_OWNER`, and
  that the product owner is never asked to reply with a continue word, copy a
  prompt, manage a retry, or transport engineering information.
- Finding 2 — `SPEC-GOV-0001` section 8 failure behavior still described the
  product owner as a message transporter even though the users section says the
  product owner never carries prompts. Fix: replaced that failure case with
  repository-routed wording — the failure is that the coordinating AI has not
  written the necessary executable handoff into the repository, not that a
  product owner failed to carry a message. Rule IDs, review-ready status, and
  `NOT APPROVED` were preserved.
- Finding 3 — four documents claimed the successful pass was invoked by the
  product owner directly: `docs/NOW.md`, `docs/tasks/TASKS.md`,
  `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md`, and
  `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`. Fix: removed that
  claim everywhere and replaced it with the factual provider boundary recorded
  above (initial 402 on the official provider name per `DEC-0126`; completed
  pass via the configured PI selector `opencode-go/deepseek-v4-flash`, gateway
  selection only). The task remains HANDOFF-ONLY and awaiting Codex review.
- Finding 4 — `ARCHITECTURE.md` misstated the `crm.ai` marker package as the
  whole AI boundary being disabled pending a later task, ignoring the
  separately implemented `src/crm/application/discovery_ai.py` egress seam from
  TASK-0021. Fix: corrected the architecture baseline and the consistent
  consequence prose in `ADR-0003`:
  - `src/crm/ai/__init__.py` is a disabled marker (`AI_ENABLED = False`), and
    `Settings.ai_enabled=True` is rejected by `src/crm/config.py`
    (`reject_enabled_ai`: "external AI integration is not authorized").
  - `src/crm/application/discovery_ai.py` separately contains the implemented
    provider protocol, whitelist (`EGRESS_FIELD_WHITELIST`), and egress-audit
    fields (`ai_used`, `external_egress`, `model_identifier`,
    `egress_field_names`).
  - `tests/test_module_boundaries.py` proves the marker package is disabled; it
    does not prove that every possible egress path is unavailable.
  - No real provider call or current production egress configuration is
    verified by this task. The corrected baseline neither claims the external
    AI seam is enabled in production nor that it is absent.
- Finding 5 — evidence supersession. Fix: the original TASK-0022 execution
  evidence now carries a concise correction note that supersedes its corrected
  factual claims; this file records the changed paths, finding-to-fix mapping,
  actual commands, provider boundary, and NOT VERIFIED boundaries.

## Commands actually run and results

| Command/check | Exit | Result |
|---|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | 0 | `[PASS]`; Approved SPECs: 8; Active tasks: 19; Legacy manifests checked: 1 |
| `git diff --check` | 0 | No whitespace errors (pre-existing LF/CRLF warnings on TASK-0018-owned files only) |
| `.venv/Scripts/python.exe -m pytest tests/test_module_boundaries.py tests/test_entrypoint.py tests/test_config.py -q` | 0 | `18 passed, 1 warning` |
| Focused `rg` over the correction-owned documents for the four corrected statements (see below) | 1 | No match (exit 1 = no matches): none of the four statements remains in the owned documents |
| Source inspection: `src/crm/ai/__init__.py`, `src/crm/config.py`, `src/crm/application/discovery_ai.py`, `tests/test_module_boundaries.py` | 0 | Claims above cite the inspected files |

Focused `rg` targets (owned documents only): the continue-word reply
instruction, the message-transporter failure phrase, the product-owner
invocation claim, and the disabled-until-a-later-task AI-boundary phrasing. The
same phrases may still exist in non-owned historical files (for example
`DECISION-LOG.md`, existing handoffs, and the independent-review evidence);
those files were not in scope and were not modified.

## Not verified

- Current production runtime: service activity, PostgreSQL version/state,
  nginx/TLS/DNS, systemd units, online database contents.
- PostgreSQL migration upgrade/downgrade/upgrade round trip for
  `operation_records` (`CRM_RUN_POSTGRESQL_TESTS` unset; test skipped).
- Remote/deployment behavior, production/shared-data backup/restore, real
  deletion propagation, live rollback.
- Whether a real external AI provider call, a current production egress
  configuration, or the upstream model identity behind the configured PI
  selector exists or is active — none is verified or claimed.
- Product-owner browser, visual, and business acceptance.
- Exact runtime model identifier of this executor session.

## Decisions needed

None from this pass. `SPEC-GOV-0001 v0.4.0` approval still requires an explicit
product-owner decision naming the SPEC id and version (`DEC-0120`); provider
selection (`OD-006a`) and retention (`OD-005`) remain open single-authorization
gates recorded in the decision log.

## Blocker

None within the authorized documentation scope.

## Result

`HANDOFF-ONLY` — awaiting `CODEX_INDEPENDENT_REVIEW`. No acceptance status is
written by this pass; Codex remains the only acceptance decision-maker.
