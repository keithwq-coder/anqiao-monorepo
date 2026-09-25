# Architecture and code takeover review

- Review status: PARTIAL / IMPLEMENTATION BLOCKED
- Review date: 2026-07-31
- Review owner: Codex / GPT-5
- Review mode: read-only code, test, task, evidence, and governance review
- Repository state: `main`, no commits, all current files untracked
- Application, server, database, and real-data changes: none

## Assumptions and unknowns

- [VERIFIED] The product owner asked Codex to take over the architecture and
  reviewer responsibilities previously held by Claude Code and Qoder.
- [ASSUMPTION] This authorizes review, architectural adjudication, and proposed
  task dispatch. It does not authorize application repair, deployment,
  database operations, or real-data mutation.
- [UNKNOWN] The local checkout and the public debug service may have diverged.
  No live-server source-parity check was authorized or performed in this
  review.

## Executive verdict

[VERIFIED] Governance structure passes, but the application cannot be accepted
as a working `SPEC-0001` core workflow. The current repository has multiple
independent P0/P1 failures across task/evidence truth, application commands,
persistence, authorization, authentication, routing, and integration tests.

[VERIFIED] Existing completion claims for S5/S6, TASK-0002, and TASK-0003 are
not reliable completion evidence. They conflict with current source, current
tests, or the approved SPEC acceptance criteria. No downstream task may use
those claims as a passed prerequisite until the proposed recovery tasks below
are authorized, executed, and independently verified.

## Findings

### P0: all core write-command paths fail at runtime

- [VERIFIED] All three commands in `src/crm/application/commands.py` validate
  with a missing actor and import nonexistent `crm.domain.identity`; focused
  probes reproduce `ModuleNotFoundError`.
- [VERIFIED] Each `from_dict()` filters out its constructor arguments, producing
  missing-argument `TypeError` paths, and the follow-up command references an
  undefined `objections_constraints` variable.

### P1: query and persistence contracts fail at runtime

- [VERIFIED] `src/crm/application/queries.py` calls nonexistent
  `InstitutionSummary.from_projection()` and
  `InstitutionDetail.from_projection()`; projected reads raise
  `AttributeError`.
- [VERIFIED] `src/crm/persistence/repositories.py` does not correctly map
  follow-up revisions into `FollowUpActivityModel` or reconstruct the current
  factual body. A focused runtime probe rejected `factual_body` as an invalid
  model argument on the affected path.
- [VERIFIED] `src/crm/persistence/database.py` constructs a new engine/pool per
  session-factory call and repositories commit independently. There is no
  usable Unit of Work for atomic institution/contact/activity/revision/audit
  operations.

### P1: web dependency injection and authorization are disconnected

- [VERIFIED] `src/crm/web/routes/institutions.py` uses
  `Depends(lambda: request.app.state.query_service)` where `request` is not
  defined in the dependency scope. Authenticated institution requests
  reproduce HTTP 500.
- [VERIFIED] `src/crm/web/deps.py` does not load role grants or access scope;
  institution handlers pass empty roles/scopes to the central policy.
- [VERIFIED] Legitimate reads therefore fail closed, while the write path does
  not yet enforce the approved role authorization contract once its current
  runtime blockers are removed.
- [VERIFIED] Search filtering matches `source_description` before projection.
  That can reveal whether a hidden field matches and violates `SPEC-0008`
  R-003/R-008.

### P1: authentication security state is incomplete

- [VERIFIED] Login returns random session-handle material as `user_id` and
  hard-codes role `user`; session inspection later returns the real user id and
  no role.
- [VERIFIED] CSRF tokens are generated but never validated on state-changing
  routes.
- [VERIFIED] Rate limiting is keyed by raw username while user lookup is
  case-insensitive, allowing a casing bypass.
- [VERIFIED] Sessions, CSRF state, rate-limit state, and security audit events
  are process-local even though persistent session/audit models exist.
- [VERIFIED locally] `SESSION_COOKIE_SECURE=true` prevents the approved plain
  HTTP debug endpoint from maintaining a login session. Live-server parity was
  not checked.

### P1: approved business workflow is absent

- [VERIFIED] Only institution create/list/get API routes exist. Contact
  creation, follow-up append, deterministic history, and the corresponding
  institution page are missing.
- [VERIFIED] `templates/dashboard.html` links to nonexistent `/institutions`
  and uses GET for logout while the backend accepts only POST.
- [VERIFIED] The four-step `SPEC-0001` workflow therefore has no complete web
  path.

### P1: TASK-0003 is not a SPEC-0013 implementation

- [VERIFIED] The recorded execution inserted one dataset through a temporary
  script.
- [VERIFIED] The repository does not implement stable batch identity, per-row
  result reporting, duplicate flagging, idempotent rerun, or conditional batch
  undo required by `SPEC-0013` R-003 through R-006 and AC-002 through AC-006.
- [VERIFIED] The temporary import catches row SQL errors without savepoints; a
  PostgreSQL transaction error can invalidate the transaction while the script
  continues reporting row-level progress. Duplicate rows are silently skipped
  instead of being marked for review.
- [VERIFIED] The one-time import may remain a ratified data operation under
  `DEC-0057`/`DEC-0058`, but it must not be represented as completion of the
  product capability.

### P2: tests and evidence cannot support completion

- [VERIFIED] Full test collection fails because
  `tests/test_s6_integration.py` imports nonexistent `crm.config.settings` and
  asserts obsolete payloads/endpoints.
- [VERIFIED] Real login E2E tests remain skipped, and current tests do not prove
  role loading, CSRF enforcement, session persistence, or the four-step web
  workflow.
- [VERIFIED] `docs/evidence/TASK-0001-S5-web-layer.md` declares completion while
  also recording missing CSRF, roles, contact, and follow-up behavior.
- [VERIFIED] `.venv` uses Python 3.12.8 with an incompatible FastAPI/Starlette
  combination; `pip check` fails. Dependency truth must be locked before a new
  full-suite result is accepted.

### P2: task and control-panel state has drifted

- [VERIFIED] `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`,
  `docs/governance/DEVELOPMENT-SEQUENCE.md`, `docs/tasks/TASKS.md`, and active
  task cards describe different current phases and completion states.
- [VERIFIED] `TASK-0002` and `TASK-0003` omit required authorization/ownership
  metadata and contain unsupported completion claims.
- [VERIFIED] `TASK-0004` is based on an incorrect root cause, references a
  nonexistent source path, and assumes deployment authority that was not
  granted.

### Product-owner correction

- [VERIFIED] `DEC-0061` removes plaintext-credential concerns from this review
  and remediation dispatch. They are not findings, prerequisites, blockers, or
  acceptance gates for the tasks below.

### Attachment audit: TASK-0004 handoff

- [VERIFIED] The attached handoff claims that the `query_service` dependency is
  correct because `app.state.query_service` is initialized. That is not a valid
  proof of FastAPI dependency resolution.
- [VERIFIED] A fresh local `TestClient` probe with synthetic environment values
  returned HTTP 500 for `GET /api/institutions`; the traceback ends at
  `src/crm/web/routes/institutions.py:126` with `NameError: name 'request' is not
  defined` while FastAPI evaluates the lambda dependency.
- [INFERENCE] The reported live-server 401 may also involve the process-local
  session store, but the attachment does not prove that it is the only cause.
  The local 500 dependency defect remains independently actionable.
- [VERIFIED] The attachment's suggested pickle/disk persistence workaround is
  not an approved implementation. Durable sessions belong to proposed
  `TASK-0007` and require explicit authorization plus a persistence and security
  design review.

## Evidence actually run

| Check | Result |
|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS: 7 approved SPECs, 3 active tasks, 1 legacy manifest |
| `.venv` full test collection | BLOCKED after 75 collected items by missing `crm.config.settings` |
| `.venv` selected web tests | PASS: 6 passed, 2 skipped, 2 warnings |
| System Python focused unit tests | PASS: 57 passed, 1 skipped |
| Focused command/query/follow-up probes | FAIL as described above |
| Unauthenticated `/api/institutions` probe | FAIL: HTTP 500, not the task-card claim of HTTP 401 |
| Web/auth specialist targeted S4 checks | PASS: 21 passed |
| Web/auth specialist selected non-DB E2E checks | PASS: 3 passed; runtime defects reproduced separately |

These checks are separate evidence classes. Passing focused unit tests does not
establish database, deployed-server, browser, or business acceptance.

## Dispatch order

1. `TASK-0006`: reconcile governance, task, and evidence truth before any
   application repair starts.
2. `TASK-0007`: repair durable authentication, role/scope authorization, CSRF,
   rate limiting, and identity response consistency.
3. `TASK-0008`: repair application commands, queries, revision persistence,
   institution/contact/follow-up routes, and the complete core page flow.
4. `TASK-0009`: rebuild integration coverage in the locked dependency
   environment and run independent verification.
5. `TASK-0010`: verify and, if necessary, repair search only after the core
   identity/policy/workflow gate passes.
6. `TASK-0011`: implement the actual `SPEC-0013` batch-import capability,
   explicitly separate from the already executed one-time data load.

Only one implementation task may own an affected file at a time. Each task is
`PROPOSED`; application work and server writes remain blocked until the product
owner explicitly authorizes the named task.

## Completion report

- Status: PARTIAL
- Scope: read-only architecture, code, test, evidence, and task review; proposed
  dispatch only
- Evidence: commands and reproduced failures listed above
- Not verified: local/live source parity, deployed HTTPS/nginx behavior,
  browser acceptance, database-backed session/audit behavior, restart behavior,
  and human visual/business acceptance
- Decisions needed: explicit authorization for `TASK-0006`; later, explicit
  authorization for each proposed implementation task
