# TASK-0001 S4R: Local authentication repair evidence

- Date: 2026-07-28 (audit timestamp only, not a schedule)
- Task: `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- Authorization: `DEC-0051` (local repository files only; no server write,
  no migration, no release, no commit/push)
- Owner: Qoder (this session)
- Status: PASSED (repair acceptance criterion met)

## Scope of change

Files changed, all local:

- `src/crm/web/auth.py` — full rewrite of the S4 authentication module:
  - `hash_password(password) -> str` now returns the Argon2id encoded hash
    string (`$argon2id$...`, salt embedded), matching the domain
    `UserIdentity.password_hash` invariant; the previous implementation
    ignored the salt in the argon2 branch and could never verify, and it
    contained an unsafe silent PBKDF2 fallback (removed).
  - `verify_password(password, password_hash) -> bool` uses
    `PasswordHasher.verify` and fails closed on any verification error.
  - Removed the hard-coded database password block (fail-closed violation).
  - `AuthenticationService` gains the `user_repository` constructor
    parameter and a complete synchronous `authenticate()` implementation
    (lock check, user lookup, disabled check, Argon2id verification,
    session + CSRF creation, audit logging). Synchronous by design: the
    persistence stack is synchronous SQLAlchemy/psycopg and no
    pytest-asyncio dependency exists or was added.
  - All `datetime.utcnow()` replaced with timezone-aware
    `datetime.now(timezone.utc)`.
  - Login rate limit default aligned to 5 attempts/hour; threshold now
    parameterized from `AuthSettings.login_rate_limit_per_hour`.
  - Audit logging appends to an in-memory list and never records
    passwords, hashes or token values.
- `tests/test_s4_authentication.py` — adapted to the corrected API:
  single-return `hash_password`, two-argument `verify_password`,
  synchronous service tests (async markers removed), plain `Mock()` users
  (the domain has `UserIdentity`, not `User`), timezone-aware datetimes.
- `src/crm/web/routes/auth.py` — removed `await` on the now-synchronous
  `authenticate` call.
- `src/crm/web/main.py` — removed `await` on the synchronous
  `validate_session` call (single-line change; the file's pre-existing
  S5-era breakage is out of scope, see below).
- `scripts/create-admin.py`, `tests/test_s6_integration.py` — adapted the
  `hash_password` call sites to the single return value and dropped the
  nonexistent `password_salt` field usage (signature adaptation only;
  these files retain pre-existing S5/S6-era defects such as importing a
  nonexistent `User` class).

## Verification actually run

1. `[VERIFIED]` S4 suite:
   `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\test_s4_authentication.py`
   → `20 passed` (previously 3 failed / 7 errors / 10 passed).
2. `[VERIFIED]` Regression excluding the pre-broken S6 module:
   `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\ --ignore=tests\test_s6_integration.py`
   → `64 passed, 1 skipped, 3 errors`. The skip is the PostgreSQL
   migration round-trip test (needs the isolated local database). The
   3 errors are all in `tests/test_s6_integration_simple.py` and are
   caused by pre-existing S5-era defects in `src/crm/web/main.py`
   (circular import with `crm.web.routes.auth`; `app` used before
   definition at line 98), not by this repair.
3. `[VERIFIED]` `tests/test_s6_integration.py` fails at collection because
   module-level `Settings()` in `main.py` requires the four database
   environment variables (fail-closed config). Pre-existing; unchanged by
   this repair.
4. `[VERIFIED]` `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
   → `[PASS] Governance structure and gates are consistent.`

## Boundaries respected

- No server write, no database migration, no deployment, no DNS/TLS, no
  real data, no external AI calls, no commit, no push.
- The S4 gate as defined in the task ("commands/queries and server-side
  login/session/security controls" with owner/write tests) is NOT declared
  fully passed by this repair: the authentication/session/CSRF/rate-limit/
  audit tests pass, but command/query owner-write acceptance belongs to
  the remaining S4/S5 work and the S5-era `main.py` breakage is untouched.
- `tmp_create_admin.py` / `tmp_create_admin.sql` /
  `tmp_simple_create_admin.py` remain in place (flagged for cleanup in the
  R1 evidence; cleanup was not authorized under `DEC-0051`).

## Round 2: audit-finding remediation (2026-07-28)

An independent read-only audit of this repair returned `FAIL` with a single
Medium finding: `test_audit_does_not_expose_passwords` in
`tests/test_s4_authentication.py` was a tautology (the try branch only
asserted `assert True`; the audit-content security property had no
effective coverage). Remediation performed by the same owner under the
same `DEC-0051` boundary:

- `tests/test_s4_authentication.py` — rewrote the test into real
  assertions: it drives one failed login, one successful login and one
  logout through `authenticate`/`invalidate_session` with a known
  plaintext password, confirms the `LOGIN_FAILED`/`LOGIN_SUCCESS`/`LOGOUT`
  events were recorded, then serializes every `audit_log` entry (including
  `extra`) and asserts the plaintext password, any `$argon2id$` hash, the
  raw session id and the raw CSRF token never appear. No other test was
  modified; the other 19 tests are unchanged.
- `src/crm/web/auth.py` — the honest fix the new assertions require: the
  audit `extra` payloads previously recorded the raw session id on
  `LOGIN_SUCCESS`/`LOGOUT`. Added `_token_ref()` (SHA-256 digest, first 12
  hex chars) and audit events now record `session_ref` instead of the raw
  token. No other behavior changed.
- Out-of-scope items left untouched as required: the S5-era defects in
  `src/crm/web/main.py` (circular import, `app` used before definition,
  CORS, `role == "admin"` mismatch) and the known defects in
  `scripts/create-admin.py`.

Verification actually re-run:

1. `[VERIFIED]` `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\test_s4_authentication.py`
   → `20 passed in 5.85s`.
2. `[VERIFIED]` `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests\ --ignore=tests\test_s6_integration.py`
   → `64 passed, 1 skipped, 1 warning, 3 errors in 7.16s`; the 3 errors
   are unchanged and all remain in `tests/test_s6_integration_simple.py`
   (`test_health_check`, `test_login_page_exists`,
   `test_api_docs_available`), caused by the pre-existing S5-era
   circular-import defect in `src/crm/web/main.py`. No new or changed
   errors.

Status after round 2: remediation complete locally; awaiting re-audit.
No commit, no push, no server access.
