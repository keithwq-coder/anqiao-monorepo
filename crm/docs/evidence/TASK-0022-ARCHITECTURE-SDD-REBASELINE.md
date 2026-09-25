# TASK-0022: Architecture and SDD rebaseline — execution evidence (2026-08-12)

- Task ID: TASK-0022
- Status: HANDOFF-ONLY (documentation/review pass executed; no claim of
  feature completion; awaiting Codex independent review)
- Task type: DOCUMENTATION / REVIEW
- Executor: DeepSeek-v4-flash in PI (exact runtime model identifier UNKNOWN;
  a requested label is never assumed active)
- Authority: `DEC-0120`, `DEC-0125`, and the configured PI selector
  `opencode-go/deepseek-v4-flash` used for the pass from
  `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`
- Written at: 2026-08-12 Asia/Shanghai

## Scope

Documentation/review only. No application, test, migration, deploy, or
runtime file was changed; no commit/push/deployment/server/database action was
performed. The worktree remains intentionally dirty; all pre-existing changes
and untracked files are preserved.

## Changed paths (exclusive owned set of the handoff)

- `README.md` — reconciled current boundary: complete SPEC baseline (8
  approved SPECs), implemented modular monolith, verdict-only cross-tool
  protocol, architecture pointer; directory map extended.
- `docs/NOW.md` — coordinator update records TASK-0022 execution
  (HANDOFF-ONLY) and TASK-0018 acceptance boundary (`DEC-0125`); stale
  "seven approved SPECs" and "no later behavior accepted" prose replaced with
  current facts; historical adjudication blocks labelled as snapshots.
- `docs/PROJECT.md` — architecture row evidence extended (ARCHITECTURE.md,
  ADR-0003; production runtime NOT VERIFIED); 2026-07-31 adjudication labelled
  historical.
- `docs/architecture/README.md` — new; index of the architecture baseline.
- `docs/architecture/ARCHITECTURE.md` — new; factual baseline: module
  boundaries, entrypoints, persistence/migration path, request/application/
  policy flow, external/runtime facts, test surface, non-decisions; every
  material fact cited to a path, command, test, or decision.
- `docs/decisions/ADR-0003-current-cloud-modular-monolith.md` — new; current
  implemented-state decision, supersedes only stale ADR-0002 prose, records
  non-decisions (no refactor/deployment authorization).
- `docs/governance/MODEL-ROUTING.md` — authority list adds `DEC-0125`;
  "applies first to" updated to active TASK-0022; provider-boundary stop
  rule (`DEC-0126` pattern) added.
- `docs/governance/WORKFLOW.md` — purpose notes active TASK-0022 and
  SPEC-GOV-0001 v0.4.0 in `20-review`; section 7 records that prompts are
  written into repository handoffs and escalations include external
  provider/account boundaries.
- `docs/specs/INDEX.md` — SPEC-GOV-0001 moved to `20-review` (REVIEW, not
  approved); `10-draft` copy marked SUPERSEDED stale artifact; "In review"
  section updated; last-updated line refreshed.
- `docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` —
  replaced by a stale pre-move pointer (same convention as the SPEC-0014
  draft artifact); current text lives in `20-review`.
- `docs/specs/20-review/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` —
  new review candidate v0.4.0: reconciled with the verdict-only protocol
  (`DEC-0120/0121/0122/0124/0125`), carrier-era rules reworded to the
  repository-routed model, references and verification plan updated,
  `Status: REVIEW`, `NOT APPROVED`.
- `docs/tasks/TASKS.md` — TASK-0022 row added to the Active table; current
  override updated to executed HANDOFF-ONLY; last-updated line refreshed.
- `docs/tasks/active/TASK-0022-architecture-sdd-rebaseline.md` — card status,
  owner, step table (steps 2–5 PASSED), evidence/result, and a note that the
  executed pass followed the handoff's narrower owned set.
- `docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md` — this file.

## Architecture facts established (with citations)

- Six module packages under `src/crm/` (`domain`, `application`, `policy`,
  `persistence`, `web`, `ai`); importability pinned by
  `tests/test_module_boundaries.py`; AI boundary hard-disabled
  (`src/crm/ai/__init__.py` `AI_ENABLED=False`; `src/crm/config.py` rejects
  `ai_enabled=True`).
- Primary entrypoint: `app = FastAPI(...)` and `setup_app_dependencies()` in
  `src/crm/web/main.py`; `python -m crm.web.main` runs Uvicorn on
  127.0.0.1:8000; routers mounted for auth/institutions/followups/admin/
  imports/account/discovery; Jinja2 templates; `/health` endpoint.
- Persistence: PostgreSQL-only (`postgresql+psycopg` URL in `src/crm/config.py`),
  engine/session-factory caching keyed on full configuration including a
  password digest (`src/crm/persistence/database.py`); 14 mapped tables in
  `src/crm/persistence/models.py`.
- Migrations: `migrations/versions/0001_initial_schema` → `0006_operation_records`
  (chain: erasure_records, import_batches, opportunity_reminders,
  opportunity_reminders_ai_reasoning, operation_records); Alembic env
  `migrations/env.py`.
- Flow: request → middleware (session/CSRF/CORS) → router → session identity
  (`web/deps.py`, `web/auth.py` Argon2id + server-side sessions) →
  application commands/queries → repositories → central `policy/projection.py`
  server-side projection before response; audited administrator-exception reads
  (`audit_repository.record`, `admin.exception_read`).
- Recorded deployment history: `DEC-0083`/`DEC-0087` to
  `https://crm.aibrain.wiki`; `DEC-0058` 117-record historical snapshot.
- Current production runtime/database/TLS/DNS/nginx/systemd state:
  NOT VERIFIED (no server access authorized).

## Cross-reference findings

- No stale "TASK-0022 BLOCKED" or "seven approved SPECs" or "In review: None"
  statements remain in the owned control documents; remaining `402 Insufficient
  Balance` mentions are explicitly framed as the recorded `DEC-0126` provider
  boundary, not current status.
- `SPEC-GOV-0001` status references agree across `docs/specs/INDEX.md`,
  `docs/governance/WORKFLOW.md`, `docs/tasks/TASKS.md`, the TASK-0022 card,
  and the two SPEC files (REVIEW, NOT approved; `10-draft` copy stale).
- TASK-0018 references now agree with `DEC-0125`: accepted for local synthetic
  operations-evidence scope only; PostgreSQL-gated, remote, production, and
  human acceptance boundaries NOT VERIFIED (NOW.md, TASKS.md, TASK-0022 card,
  MODEL-ROUTING.md).
- Approved SPEC bodies, approval metadata, DECISION-LOG.md, TASK-0018
  implementation/evidence/task-card paths, and existing handoffs were not
  modified.

## Commands actually run and results

| Command/check | Exit | Result |
|---|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | 0 | `[PASS]`; Approved SPECs: 8; Active tasks: 19; Legacy manifests checked: 1 |
| `git diff --check` | 0 | No whitespace errors; only pre-existing LF/CRLF warnings on TASK-0018-owned files (`src/crm/persistence/models.py`, `tests/test_migrations.py`, `tests/test_persistence_schema.py`) |
| `.venv/Scripts/python.exe -m pytest tests/test_module_boundaries.py tests/test_entrypoint.py tests/test_config.py -q` | 0 | `18 passed, 1 warning` |
| `.venv/Scripts/python.exe -m pytest tests -q` | 0 | `368 passed, 28 skipped, 1 warning` (matches the state recorded in `DEC-0125` for 2026-08-12) |
| Focused repository searches (stale TASK-0022/SPEC-count/SPEC-GOV status) | 0 | No stale contradictions in owned control documents (results above) |
| Source/migration/test inspection (paths listed in this evidence) | 0 | Claims above cite the inspected files |

## Not verified

- Current production runtime: service activity, PostgreSQL version/state,
  nginx/TLS/DNS, systemd units, online database contents.
- PostgreSQL migration upgrade/downgrade/upgrade round trip for
  `operation_records` (`CRM_RUN_POSTGRESQL_TESTS` unset; test skipped).
- Remote/deployment behavior, production/shared-data backup/restore, real
  deletion propagation, live rollback.
- Product-owner browser, visual, and business acceptance.
- Exact runtime model identifier of this executor session.

## Decisions needed

None from this pass. `SPEC-GOV-0001 v0.4.0` approval requires an explicit
product-owner decision naming the SPEC id and version (`DEC-0120`); provider
selection (`OD-006a`) and retention (`OD-005`) remain open single-authorization
gates recorded in the decision log.

## Blocker

None within the authorized documentation scope.

## Correction note (2026-08-12, consolidated correction pass)

The one consolidated correction pass
(`docs/evidence/TASK-0022-DEEPSEEK-PI-CORRECTION-20260812.md`) supersedes the
following corrected factual claims of the original pass record:

- The claim that the successful pass was invoked by the product owner directly
  is removed. The factual record is: the initial PI attempt named the official
  `deepseek/deepseek-v4-flash` provider and returned `402 Insufficient
  Balance` before repository execution (`DEC-0126`); the completed pass used
  the configured PI selector `opencode-go/deepseek-v4-flash`. That identifies
  the PI gateway selection only; it does not prove or claim the upstream model
  identity, provider billing state, or a new decision-log authorization. No
  user authorization was invented, amended, or reinterpreted.
- The AI-boundary claim that the whole `crm.ai` boundary was disabled pending a
  later task is corrected: `src/crm/ai/__init__.py` is a disabled marker
  (`AI_ENABLED = False`) and `Settings.ai_enabled=True` is rejected by
  `src/crm/config.py`; the separately implemented TASK-0021 egress seam
  `src/crm/application/discovery_ai.py` contains the provider protocol,
  whitelist, and egress-audit fields. `tests/test_module_boundaries.py` proves
  the marker package is disabled; it does not prove every possible egress path
  is unavailable. No real provider call or current production egress
  configuration is verified by this task.
- No decision-log entry, approval record, or acceptance status was written or
  changed by the correction pass. This task remains HANDOFF-ONLY and awaiting
  Codex independent review.

## Result

`HANDOFF-ONLY` — awaiting `CODEX_INDEPENDENT_REVIEW`. Codex is the only
acceptance decision-maker and will inspect the actual repository state, diff,
evidence, and governance output before issuing a verdict.
