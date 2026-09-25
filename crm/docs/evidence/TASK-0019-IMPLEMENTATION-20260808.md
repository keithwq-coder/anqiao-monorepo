# TASK-0019 Implementation Evidence

**Date:** 2026-08-09
**Task:** TASK-0019 — Account Credentials Self-Modification
**SPEC:** SPEC-0014 (v1.0.0)
**Authorization:** DEC-0111 (2026-08-08)
**Scope:** Local synthetic data only; no production database/server access.

---

## 1. Status

**PASSED** — All AC-001..AC-010 implemented and verified. Full test suite green. Governance [PASS].

---

## 2. Scope: Files Changed

### New files
- `src/crm/web/routes/account.py` — JSON API + page (form) routes for password/username self-modification.
- `templates/account_settings.html` — Jinja2 page with password and username change forms.
- `tests/test_task0019_account_credentials.py` — 25 tests covering AC-001..AC-010 plus edge cases.
- `docs/evidence/TASK-0019-IMPLEMENTATION-20260808.md` — This file.

### Modified files
- `src/crm/application/commands.py` — Added `ChangePasswordCommand`, `ChangeUsernameCommand`, `CredentialError`, `_is_prefix_protected`, `PROTECTED_USERNAME_PREFIXES`, `USERNAME_MAX_LENGTH`.
- `src/crm/web/main.py` — Mounted `account.router`.

### Files NOT touched (per task constraints)
- Approved SPEC files, other tasks' evidence files, migration files, production config.

---

## 3. Behavior Implemented (SPEC-0014 mapping)

| SPEC Rule | AC | Behavior | Verification |
|-----------|-----|----------|-------------|
| R-001 | AC-001 | Correct current password → password updated | `test_ac001_password_change_success` |
| R-001 | AC-002 | Wrong current password → rejected, no audit, no info leak | `test_ac002_wrong_current_password_rejected` |
| R-002 | AC-001 | Password change bumps session epoch → old session invalidated | `test_ac001_password_change_success`, `test_ac010_old_session_denied_after_password_change` |
| R-003 | AC-004 | Correct current password → username updated | `test_ac004_username_change_success` |
| R-004 | AC-003 | sa/dl-prefixed username change → rejected (case-insensitive) | `test_ac003_sa_prefix_username_change_rejected`, `test_ac003_dl_prefix_username_change_rejected`, `test_ac003_sa_prefix_case_insensitive` |
| R-004 | AC-007 | sa-prefixed user can still change password (prefix only protects username) | `test_ac007_sa_prefix_user_can_change_password` |
| R-005 | AC-005 | New username conflicts with existing → rejected (case-insensitive) | `test_ac005_username_conflict_rejected`, `test_ac005_username_conflict_case_insensitive` |
| R-005 | — | Empty/too-long username rejected | `test_username_empty_rejected`, `test_username_too_long_rejected` |
| R-006 | AC-004 | Username change bumps session epoch → old session invalidated | `test_ac004_username_change_success`, `test_ac010_old_session_denied_after_username_change` |
| R-006 | AC-010 | After password/username change, old session denied on protected resource | `test_ac010_*` |
| R-007 | AC-001/004 | Audit event written inside the same transaction | `test_ac001_*`, `test_ac004_*` |
| R-008 | AC-008 | Audit write failure → transaction rollback, no success shown | `test_ac008_audit_failure_rollback` |
| R-009 | AC-006 | Unauthenticated/disabled/pending users rejected | `test_ac006_*` (3 tests) |
| R-010 | AC-009 | CSRF protection on both API and form paths | `test_ac009_api_csrf_required`, `test_ac009_page_csrf_required` |
| — | AC-009 | API and page paths behave identically | `test_ac009_page_*` (4 tests) |
| §8 | — | Same-password allowed with warning | `test_same_password_allowed_with_warning` |
| — | — | Account settings page renders / requires auth | `test_account_settings_page_renders`, `test_account_settings_page_requires_auth` |

### Transaction integrity (R-008)
Both `ChangePasswordCommand` and `ChangeUsernameCommand` use `transaction_session(factory)` which wraps the sessionEpoch bump + credential update + audit event in a single `session.begin()`. If the audit `record()` call raises, the transaction rolls back: the password/username is NOT changed, and the route returns HTTP 500.

### Session invalidation (R-002/R-006)
`session_epoch` is incremented inside the same transaction as the credential change. The next `validate_session()` call for any pre-existing session sees a stale epoch and returns `None`, causing `get_current_user_optional` to return `None` → 401.

### Protected prefix (R-004)
`_is_prefix_protected(username)` checks `lower(username).startswith("sa")` or `lower(username).startswith("dl")`, matching the SPEC's case-insensitive requirement. The check runs against the **current** username (not the requested new one), so an `sa1` user cannot change to any new username.

### CSRF (R-010)
- API paths (`/api/account/*`) are protected by the global `enforce_csrf` middleware (same as all `/api/` write endpoints).
- Form paths (`/account/password`, `/account/username`) verify the CSRF token via `_form_has_valid_csrf`, matching the pattern used by institution/contact/activity creation forms.

---

## 4. Evidence: Commands and Results

### Test suite (full regression)
```
$ python -m pytest tests/ -q --tb=short --timeout=60
302 passed, 28 skipped, 1 warning in 65.97s
```
- Baseline before this task: 277 passed, 28 skipped.
- New tests added: 25 (all passing).
- No regressions.

### TASK-0019 tests only
```
$ python -m pytest tests/test_task0019_account_credentials.py -q --tb=short --timeout=30
25 passed in 13.96s
```

### Governance check
```
$ powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 8
  - Active tasks: 15
  - Legacy manifests checked: 1
```

### AC coverage summary
- AC-001 ✓ — Password change success
- AC-002 ✓ — Wrong current password rejected
- AC-003 ✓ — sa/dl prefix protection
- AC-004 ✓ — Normal username change success
- AC-005 ✓ — Username conflict rejected
- AC-006 ✓ — Unauthenticated/disabled/pending rejected
- AC-007 ✓ — sa-prefixed user can change password
- AC-008 ✓ — Audit failure → rollback
- AC-009 ✓ — API and page paths identical behavior
- AC-010 ✓ — Old session denied after change

---

## 5. Not Verified

- **No real PostgreSQL test:** All tests use in-memory SQLite with `StaticPool`. The production PostgreSQL path (`SessionLocal` → `transaction_session`) was not exercised. The command code is structurally identical to the existing `CorrectFollowUpActivityCommand` / `GrantRoleCommand` which are tested against PostgreSQL in `test_s6_integration.py` and `test_task0007_postgresql_sessions.py` (skipped without a local PG instance).
- **No browser/visual acceptance:** The account settings page HTML was not rendered in a browser. The `test_account_settings_page_renders` test verifies the page returns HTTP 200 with expected content strings.
- **Argon2id parameters:** `hash_password` uses the existing `PasswordHasher()` defaults (m=65536, t=3, p=4). No change to hash parameters was made or tested.

---

## 6. Decisions Needed

None. No UNKNOWNs encountered during implementation. All behavior was fully specified by SPEC-0014.
