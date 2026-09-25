# TASK-0007: Durable authentication and authorization repair

- Task ID: TASK-0007
- Status: ACTIVE
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Also governed by: `SPEC-0001`, `SPEC-0012`, `DEC-0044`
- Implementation authorized by: Product owner, `DEC-0067` (2026-08-02)
- Authorization evidence: `DEC-0067` (verbatim product-owner reply:
  "1. zcode（glm5.2） 2. 是的，授权")
- Owner tool: ZCode agent (one bounded subagent dispatched by the coordinator
  per `DEC-0067`)
- Owner model: UNKNOWN until executor self-report; recorded verbatim and never
  a gate per `DEC-0066`/`DEC-0067`
- Ownership effective: 2026-08-02 upon `DEC-0067` authorization
- Audit started at: 2026-08-02
- Audit last updated: 2026-08-02 (activation under `DEC-0067`)
- Depends on: `TASK-0006` (CLOSED / ACCEPTED 2026-08-02)

## Goal

Provide one durable, fail-closed authenticated identity and role/scope context
for page, API, search, and policy decisions, with enforced CSRF and measurable
session/rate-limit behavior.

## Scope

- SPEC rules: `SPEC-0002` R-001 through R-006, R-013, R-014, R-017;
  `SPEC-0001` R-009/R-030; `SPEC-0012` R-002/R-003/R-009.
- Acceptance criteria: `SPEC-0002` AC-001 through AC-004, AC-009, AC-011,
  AC-012; `SPEC-0012` AC-001 through AC-003 and AC-009.
- Owned files/directories:
  - `src/crm/web/auth.py`, `src/crm/web/deps.py`;
  - `src/crm/web/routes/auth.py`, auth wiring in `src/crm/web/main.py`;
  - auth/session/audit repositories under `src/crm/persistence/`;
  - narrowly required persistence models/migration changes, only if current
    approved schema cannot support the SPEC;
  - `tests/test_s4_authentication.py` and new focused auth HTTP tests;
  - `docs/evidence/TASK-0007-*` and this task card.

## Non-goals

- No institution/contact/follow-up feature repair.
- No search behavior repair.
- No deployment, public-listener change, database migration on the server, or
  real-data operation without separate authorization.
- No new identity provider or self-registration.

## Assumptions and unknowns

- [VERIFIED] Persistent session and audit models exist but are not used by the
  authentication service.
- [VERIFIED] `ServerSessionModel` and the approved initial migration already
  provide hashed session/CSRF tokens, user session epoch, expiry, last-seen, and
  explicit invalidation fields. No repository currently uses this table.
- [VERIFIED] Role grants exist in persistence but no loader supplies them to the
  web policy context.
- [UNKNOWN] Whether the current approved schema fully supports durable rate
  limiting. Prefer the smallest schema-compatible solution; a schema change
  requires explicit task scope and migration verification.
- [UNKNOWN] The intended public-debug cookie behavior. The implementation must
  not silently weaken production cookie security; environment behavior must be
  explicit and tested.
- [PROPOSAL] The smallest architecture-compatible persistence path is the
  existing PostgreSQL `server_sessions` table and an explicit session
  repository. Do not add Redis and do not serialize session objects to pickle
  or disk files unless a later approved architecture decision requires it.

## Prerequisites and completion gate

- Prerequisites: TASK-0006 passes; product owner explicitly authorizes
  TASK-0007; exact owned files are confirmed against the live
  worktree.
- Exact output: consistent login/session identity, loaded roles/scopes,
  PostgreSQL-backed durable sessions/audit, enforced CSRF, normalized rate
  limiting, generic credential failure messages, and explicit cookie behavior
  by environment. Only token hashes may be persisted.
- Completion gate: focused unit + HTTP integration tests pass, restart test
  proves session behavior required by the SPEC, role matrix passes, and an
  independent reviewer reports no unresolved P0/P1 finding.

## Ordered steps and verification

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | Task authorized | Map current auth contracts and persistence callers | Design note | Call graph and schema facts cited | DONE |
| 2 | Step 1 passed | Implement PostgreSQL session/audit repositories and canonical identity/roles/scopes | Bounded source patch | Repository tests prove hashed tokens, expiry, invalidation, and role loading | DONE |
| 3 | Step 2 passed | Enforce CSRF and normalized rate limiting; remove enumeration | Security behavior | Negative HTTP tests | DONE |
| 4 | Step 3 passed | Verify restart/multi-request and cookie environment behavior | Runtime evidence | Local PostgreSQL HTTP integration | DONE (HTTP-level restart proof; real-DB legs NOT VERIFIED, see evidence) |
| 5 | Step 4 passed | Independent read-only review | Review verdict | No unresolved P0/P1 | DONE (verdict: PARTIAL — no unresolved P0/P1; real-PostgreSQL legs NOT VERIFIED; see acceptance record) |

## Risks and rollback

- Authentication changes can lock out all users. Maintain a local synthetic
  recovery fixture and test fail-closed behavior before any deployment.
- Do not reuse or log current operational credentials during testing.

## Evidence and result

- Status: STEPS 1-4 COMPLETE (executor); step 5 independent review COMPLETE
  with verdict **PARTIAL** on 2026-08-02 (no unresolved P0/P1; real-PostgreSQL
  legs NOT VERIFIED — environment boundary, decision returned to the product
  owner). Acceptance record: `docs/evidence/TASK-0007-KIMI-ACCEPTANCE.md`.
- Executor runtime identifier (verbatim per DEC-0066/DEC-0067; never a gate):
  `5f121e6f-b747-4f1e-8162-dd0214cef1d2/k3-256k`.
- Commands actually run, with interpreter, pass/fail, and test totals:
  `docs/evidence/TASK-0007-verification.md` (compileall PASS; focused auth
  suites 69 passed / 6 skipped / 0 failed; baseline-comparable full suite
  116 passed / 9 skipped / 0 failed; governance check PASS before and after
  this card update).
- Result artifacts:
  - `docs/evidence/TASK-0007-preflight.md` (baseline and boundary facts);
  - `docs/evidence/TASK-0007-design-note.md` (step 1 call graph, schema facts,
    defect map, design decisions);
  - `docs/evidence/TASK-0007-verification.md` (steps 2-4 verification record);
  - `src/crm/persistence/session_repository.py`,
    `src/crm/persistence/audit_repository.py`,
    `src/crm/persistence/role_grant_repository.py` (new, hash-only durable
    persistence);
  - `src/crm/web/auth.py`, `src/crm/web/deps.py`,
    `src/crm/web/routes/auth.py`, `src/crm/web/main.py` (durable service,
    canonical identity/roles/scopes context, enforced CSRF, generic credential
    failures, explicit per-environment cookie behavior);
  - `tests/test_s4_authentication.py` (adapted), and new
    `tests/test_task0007_inmemory_fakes.py`,
    `tests/test_task0007_auth_service.py`,
    `tests/test_task0007_auth_http.py`,
    `tests/test_task0007_postgresql_sessions.py`.
- Not verified: the six `CRM_RUN_POSTGRESQL_TESTS=1`-gated tests (five in
  `tests/test_task0007_postgresql_sessions.py`, one in
  `tests/test_s4_authentication.py`) and the pre-existing gated
  `tests/test_migrations.py` round-trip. Exact reason and exact remaining
  check: `docs/evidence/TASK-0007-verification.md` section 3 (no local
  PostgreSQL; installation forbidden by the no-install boundary, remote
  database forbidden by the no-network boundary). Deployed runtime and real
  browser behavior remain unverified by design (local synthetic verification
  only).
