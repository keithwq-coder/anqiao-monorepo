# HANDOFF: TASK-0007 durable auth/authorization repair — bounded implementation dispatch

- Handoff ID: HANDOFF-20260802-KIMI-TASK-0007-IMPLEMENTATION
- Date: 2026-08-02
- From: Kimi-K3 (ZCode agent), repository coordinator
- To: one bounded ZCode subagent (implementation executor for TASK-0007)
- Authority: `DEC-0067` (explicit TASK-0007 authorization and ZCode ownership),
  under `DEC-0065` (batch-first review) and `DEC-0066` (recording discipline and
  dispatch/verification mechanics)
- Task card: `docs/tasks/active/TASK-0007-auth-authorization-repair.md`
- Approved SPEC authority: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
  with matching `.approval.json`; also governed by `SPEC-0001`, `SPEC-0012`,
  `DEC-0044`

## 1. Purpose

Execute TASK-0007 steps 1-4 (design mapping, durable PostgreSQL-backed
session/audit repositories and canonical identity/roles/scopes, CSRF and
normalized rate limiting with enumeration removal, restart/cookie-environment
verification). Step 5 (independent read-only review) is performed by the
coordinator after execution and is not part of this dispatch.

## 2. Required reading before any edit

1. `AGENTS.md` (full).
2. The TASK-0007 task card (full).
3. This handoff (full).
4. `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` — at minimum the
   rules R-001 through R-006, R-013, R-014, R-017 and acceptance criteria
   AC-001 through AC-004, AC-009, AC-011, AC-012 cited by the card.
5. `docs/decisions/DECISION-LOG.md` entries `DEC-0044`, `DEC-0051`, `DEC-0065`,
   `DEC-0066`, `DEC-0067` (locate by heading search).
6. The current source under `src/crm/web/`, `src/crm/persistence/`, and the
   existing `tests/test_s4_authentication.py` before designing changes.

## 3. Owned files (exclusive)

- `src/crm/web/auth.py`, `src/crm/web/deps.py`;
- `src/crm/web/routes/auth.py`, auth wiring in `src/crm/web/main.py`;
- auth/session/audit repositories under `src/crm/persistence/` (new repository
  modules are allowed here);
- narrowly required persistence model / migration changes under `src/crm/` and
  `migrations/`, ONLY if the current approved schema cannot support the SPEC,
  with the justification recorded in evidence;
- `tests/test_s4_authentication.py` and new focused auth HTTP tests under
  `tests/` (new `tests/test_task0007_*` files are allowed);
- `docs/evidence/TASK-0007-*` (new evidence files);
- the task card itself (status and evidence sections only; do not rewrite its
  scope, gates, or history).

Everything else is forbidden, including but not limited to: `docs/NOW.md`,
`docs/PROJECT.md`, `docs/specs/**`, `docs/decisions/**`, `docs/tasks/TASKS.md`,
other task cards, governance scripts, `pyproject.toml`/lockfiles (see §5),
deployment files, and any file outside the repository.

## 4. Hard boundaries

- Local repository implementation and local synthetic verification only.
- NO network, server, SSH, cloud host, or remote database access of any kind.
  Any database used by tests must be local (localhost) and synthetic.
- NO git operations (no commit, push, branch, reset, clean, or config change).
- NO secrets: never print, log, or store real credentials; synthetic fixtures
  only; do not reuse or log current operational credentials during testing.
- NO weakening of security, tests, audit logging, or approval gates; cookie
  security behavior must be explicit per environment and tested, never
  silently weakened.
- Fail-closed: unauthenticated/unknown/disabled identities and missing role
  grants must deny by default; credential failure messages must be generic
  (no user-existence enumeration); only token hashes may be persisted.
- Do not add Redis, and do not serialize session objects to pickle or disk
  files; the card's recorded proposal is the existing PostgreSQL
  `server_sessions` table plus an explicit session repository.

## 5. Dependencies and environment

- Use the repository's existing environment (`.venv` exists at the repository
  root; `psql` is not on PATH). Discover how the existing test suite obtains
  its database (inspect `tests/conftest.py`, `scripts/dev-test.ps1`,
  `.env.example`, and existing persistence tests) and follow that pattern.
- Do NOT install, upgrade, or remove dependencies. If a change appears to
  require one, STOP, record the blocker in evidence, and end with PARTIAL.
- If a local database required by the verification cannot be provided by the
  existing test infrastructure, run every check that CAN run, and record the
  remainder as `NOT VERIFIED` with the exact reason and the exact remaining
  check. Never fabricate a pass.

## 6. Execution contract

1. Preflight: record Python/venv facts, the test-database mechanism, and the
   existence of every owned file, in `docs/evidence/TASK-0007-preflight.md`.
2. Follow the card's ordered steps 1-4. Keep the step-1 design note (call
   graph and schema facts, with file citations) in
   `docs/evidence/TASK-0007-design-note.md` before editing source.
3. Make surgical changes only; match surrounding code style; no unrelated
   cleanup, renames, formatting sweeps, or speculative abstractions.
4. Verification (record exact commands and summarized outputs in
   `docs/evidence/TASK-0007-verification.md`):
   - `python -m compileall src tests`
   - focused auth tests (the S4 suite plus new auth HTTP tests)
   - the full local `python -m pytest -q` run
   - the restart/session-persistence proof required by the card step 4
   - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
   State clearly which Python interpreter was used for each command.
5. Update the task card: per-step Status values in the ordered-steps table and
   the "Evidence and result" section (commands actually run, result artifacts,
   not-verified list). Do not touch any other card.
6. Self-report your exact runtime model identifier if the runtime exposes one;
   otherwise record `UNKNOWN - runtime identifier not exposed`. This is never
   a gate.

## 7. Result message format (final reply to the coordinator)

- `EXECUTOR_RUNTIME_ID`: exact identifier or UNKNOWN line.
- `CHANGED_PATHS`: full list of files created or modified (relative paths).
- `COMMANDS_RUN`: each command, interpreter, and pass/fail result.
- `TEST_TOTALS`: numbers as reported by the tools (e.g., `N passed, M failed`).
- `NOT_VERIFIED`: anything not verified, with reason and remaining check.
- `DESIGN_DECISIONS`: engineering choices made, each with its SPEC rule or
  card citation.
- `BLOCKERS`: anything that stopped or limited execution.

## 8. Acceptance (coordinator-side, read-only)

The coordinator will independently: diff the full repository against a
pre-dispatch hash baseline and require that every changed path is inside §3;
re-run the verification commands; re-check approved-SPEC hashes; re-run the
governance check; and review the design against the cited SPEC rules and
acceptance criteria. The verdict (ACCEPTED / PARTIAL / ESCALATED) is recorded
in `docs/evidence/`. The reviewer does not silently fix executor output;
findings return as one consolidated correction bundle at most (DEC-0065).
