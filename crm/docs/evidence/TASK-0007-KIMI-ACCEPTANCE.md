# TASK-0007 independent acceptance review — verdict: PARTIAL

- Reviewer: repository coordinator (architecture and delivery coordination role)
- Task: `docs/tasks/active/TASK-0007-auth-authorization-repair.md` (step 5)
- Dispatch contract: `docs/handoffs/HANDOFF-20260802-KIMI-TASK-0007-IMPLEMENTATION.md`
- Executor: one bounded ZCode subagent (DEC-0067)
- Executor runtime identifier (verbatim per DEC-0066/DEC-0067; never a gate):
  `5f121e6f-b747-4f1e-8162-dd0214cef1d2/k3-256k`
- Review date: 2026-08-02
- Verdict: **PARTIAL** — implementation locally verified to the maximum extent
  the authorized environment permits; no unresolved P0/P1 finding; the
  real-PostgreSQL durability/restart execution proof is NOT VERIFIED because
  the authorized boundaries (no dependency installation, no network/remote
  database) make the required local PostgreSQL unavailable.

## 1. Scope reviewed

Everything the executor changed, checked against the pre-dispatch full-repo
hash baseline (257 files; exclusion regex
`.git|.venv|node_modules|__pycache__|.playwright-mcp|.qoder|.claude|.cursor|.pytest_cache`;
baseline stored at `%TEMP%\TASK-0007-KIMI-REVIEWER-baseline.json`).

Diff result — exactly the 16 owned paths, none out of scope, 0 deletions:

- CHANGED (6): `docs/tasks/active/TASK-0007-auth-authorization-repair.md`,
  `src/crm/web/auth.py`, `src/crm/web/deps.py`, `src/crm/web/main.py`,
  `src/crm/web/routes/auth.py`, `tests/test_s4_authentication.py`
- ADDED (10): `docs/evidence/TASK-0007-preflight.md`,
  `docs/evidence/TASK-0007-design-note.md`,
  `docs/evidence/TASK-0007-verification.md`,
  `src/crm/persistence/session_repository.py`,
  `src/crm/persistence/audit_repository.py`,
  `src/crm/persistence/role_grant_repository.py`,
  `tests/test_task0007_inmemory_fakes.py`,
  `tests/test_task0007_auth_service.py`,
  `tests/test_task0007_auth_http.py`,
  `tests/test_task0007_postgresql_sessions.py`
- DELETED: 0

No s6 file, no `tests/conftest.py`, no migration, no schema model, no config,
no deployment file was touched. [VERIFIED by reviewer-side hash diff]

## 2. Evidence — commands personally re-run by the reviewer

All from repository root with `.venv/Scripts/python.exe` (Python 3.12.8):

| # | Command | Reviewer result |
|---|---|---|
| 1 | `.venv/Scripts/python.exe -m compileall -q src tests` | PASS — exit 0 |
| 2 | `.venv/Scripts/python.exe -m pytest tests/test_s4_authentication.py tests/test_task0007_auth_service.py tests/test_task0007_auth_http.py tests/test_task0007_postgresql_sessions.py tests/test_task0007_inmemory_fakes.py -q` | PASS — 69 passed, 6 skipped in 11.56s (skips = 5 PostgreSQL-gated + 1 s4 PostgreSQL-gated) |
| 3 | `.venv/Scripts/python.exe -m pytest -q --ignore=tests/test_s6_integration.py --ignore=tests/test_s6_integration_simple.py` | PASS — 116 passed, 9 skipped in 12.52s |
| 4 | `.venv/Scripts/python.exe -m pytest -q` (no ignores) | Interrupted by the identical pre-existing collection error at `tests/test_s6_integration.py:18` (pydantic `ValidationError` from `Settings()` at `crm/web/main.py:19`) — byte-identical root cause to the pre-dispatch baseline; not a regression |
| 5 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS — `Governance structure and gates are consistent.` (Approved SPECs: 7 with hash verification, Active tasks: 5) |

The executor's claimed numbers (69/6, 116/9) match the reviewer's
independent runs exactly. [VERIFIED]

Approved-SPEC hash control: governance PASS includes SHA-256 re-verification
of all 7 approval JSONs; SPEC-0002 v0.2.0 hash
`0c313e4f2592ba33bf7331dff7a4f1e73ede5b107436f4446309f3354115b8f4` matches
its approval metadata. [VERIFIED via command 5]

## 3. Semantic spot-checks (reviewer-read source, cited lines)

- Hash-only persistence: `src/crm/persistence/session_repository.py:20-27,64-79`
  — only `hashlib.sha256` hex digests (64 chars) are persisted; raw tokens
  never reach the database. [VERIFIED]
- No Redis, no pickle anywhere under `src/crm/` (grep). [VERIFIED]
- Generic credential failure: `src/crm/web/auth.py:30`
  `GENERIC_CREDENTIAL_FAILURE = "Invalid credentials"`; no account-state
  disclosure in the failure path. [VERIFIED]
- Timing equalization: `src/crm/web/auth.py:288,458-464` — dummy Argon2id
  hash verification for unknown/disabled accounts. [VERIFIED]
- Casefold-keyed rate limiting: `src/crm/web/auth.py:258`. [VERIFIED]
- Session-epoch forced logout: capture at login `src/crm/web/auth.py:314-320`;
  per-request re-validation and invalidation on mismatch
  `src/crm/web/auth.py:365-385` (`session_epoch_mismatch` reason). [VERIFIED]
- CSRF: `secrets.compare_digest` against the persisted hash
  `src/crm/web/auth.py:451`; `deps.enforce_csrf` at `src/crm/web/deps.py:113-145`.
  [VERIFIED]
- Production cookie guard: `src/crm/web/main.py:68-82` —
  `SESSION_COOKIE_SECURE=false` with `CRM_ENVIRONMENT=production` raises
  RuntimeError at startup; default is secure. [VERIFIED]
- Task card integrity: metadata block, scope, owned-files list, and
  `## Prerequisites and completion gate` preserved verbatim from activation;
  executor changed only per-step Status values and the
  `## Evidence and result` section (governance re-validated after the edit).
  [VERIFIED]
- Design note (`docs/evidence/TASK-0007-design-note.md`): call graph, schema
  facts, and defect map D1-D8 cite verified lines; conclusion that the
  approved schema needs no migration is corroborated by
  `tests/test_persistence_schema.py` passing inside the 116-test run.
  [VERIFIED]

## 4. Findings

- P0: none. P1: none.
- P2 (observation, non-blocking): `tests/test_task0007_auth_http.py` sets
  synthetic `DATABASE_*`/`SESSION_*` env vars at module top (same pattern as
  the pre-existing `tests/test_s6_integration_simple.py:10-13`). In a
  full-suite run this import-time side effect makes 3 pre-broken s6 tests
  pass; in isolation those s6 tests fail exactly as the pre-dispatch
  baseline. No s6 file was edited; the root cause pre-exists in non-owned
  files (`Settings()` evaluated at import time in `crm/web/main.py:19`,
  deferred imports in `tests/test_s6_e2e_auth.py`). Executor disclosed this
  transparently in `TASK-0007-verification.md` section 2; reviewer
  independently confirmed the isolation behavior matches the baseline
  signature. Values are synthetic fixtures; no real credential is involved.
  Removing the side effect would require editing non-owned files and is
  out of this task's scope.
- Honesty check: every executor claim re-run by the reviewer matched
  (commands, totals, skip reasons, NOT VERIFIED list). The
  `tests/test_task0007_inmemory_fakes.py` module contains no test functions
  (contract-exact fakes only), as the executor stated. [VERIFIED]

## 5. Verdict reasoning against the completion gate

Gate: "focused unit and HTTP integration tests pass, the restart test proves
the session behavior required by the SPEC, the role matrix passes, and an
independent reviewer reports no unresolved P0/P1 finding."

1. Focused unit + HTTP integration tests pass — SATISFIED (69 passed,
   0 failed, reviewer re-run).
2. Role matrix passes — SATISFIED (role-grant loading, revocation exclusion,
   and scope tests within the passing suites; deny-by-default paths covered).
3. Restart test proves session behavior required by the SPEC — PARTIALLY
   SATISFIED. Cross-instance restart survival, expiry, invalidation pairs,
   epoch-mismatch forced logout, and CSRF rotation are behaviorally proven
   against contract-exact in-memory fakes (69 passing tests), and the
   HTTP-level restart proof passes. The PostgreSQL-backed execution of those
   same contracts (5 gated tests in
   `tests/test_task0007_postgresql_sessions.py` + 1 gated test in
   `tests/test_s4_authentication.py`) is NOT VERIFIED — see section 6. Step
   4's verification column names "Local PostgreSQL HTTP integration", and no
   local PostgreSQL exists on this machine.
4. Independent reviewer reports no unresolved P0/P1 — SATISFIED (section 4).

Because gate element 3 has an unverified leg, and "never say a test passed
unless it was actually run" (AGENTS.md section 3), the verdict cannot be
ACCEPTED. Because the shortfall is an environment boundary set by the
authorization itself (DEC-0067: local synthetic verification only; no
dependency installation; no network/remote database) and not an executor
failure, the verdict is not ESCALATED. Verdict: PARTIAL, with the exact
remaining check named below and the environment decision returned to the
product owner.

## 6. Not verified (exact reason and exact remaining check)

Reason for all items: no local PostgreSQL is available on this machine
(executor preflight probes: `psql` not on PATH, no PostgreSQL
service/process/install directory, TCP probe to localhost:5432 timed out).
Installing PostgreSQL would exceed the no-install boundary; a remote
database would exceed the no-network boundary. Both boundaries are part of
the DEC-0067 authorization, so the executor correctly stopped.

1. `tests/test_task0007_postgresql_sessions.py` (5 tests) — real-PostgreSQL
   proofs of hash-only persisted columns, active-session lookup, expiry
   exclusion, CSRF-hash rotation, invalidation reason pairs, audit outcome
   validation, role-grant loading with revocation, and a two-instance
   restart proof over the real `server_sessions` table.
   Remaining check: set `CRM_RUN_POSTGRESQL_TESTS=1` with `DATABASE_*`
   pointing at an isolated local `*_test` PostgreSQL, then run
   `.venv/Scripts/python.exe -m pytest tests/test_task0007_postgresql_sessions.py -q`.
2. `tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use`
   (1 test) — real-PostgreSQL forced-logout/epoch-invalidation proof.
   Remaining check: same gate, run against `tests/test_s4_authentication.py -q`.
3. `tests/test_migrations.py` gated round-trip (1 pre-existing skip,
   unrelated to this task's changes) — same isolated-database requirement.
4. Deployed runtime and real browser behavior — unverified by design (task
   authorization is local synthetic verification only).

## 7. Decisions needed (product owner)

Exactly one decision blocks converting this PARTIAL into ACCEPTED:

How to provide the real-PostgreSQL verification environment for the 6 gated
tests (section 6 items 1-2):

- Option A (recommended): authorize installation of a local PostgreSQL
  instance on this machine, used solely as an isolated `*_test` database for
  the gated tests. Effect: the durability/restart proofs execute against the
  real engine; reversible (uninstall); no network, no shared data, no cost.
- Option B: explicitly defer the real-PostgreSQL legs to a later authorized
  gate and accept TASK-0007 on the contract-level (in-memory) proofs now.
  Effect: faster closure, but the durable-behavior claim over the real
  engine stays unproven until that later gate; this weakens the evidence for
  DEC-0044 "server-side sessions" until discharged.

TASK-0008 through TASK-0011 remain PROPOSED/UNAUTHORIZED regardless of this
decision; each needs its own explicit authorization.
