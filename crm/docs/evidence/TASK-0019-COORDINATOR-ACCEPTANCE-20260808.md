# TASK-0019 — Coordinator Independent Acceptance

- Date: 2026-08-08
- Task: TASK-0019 — 账号用户名与密码自助修改 (SPEC-0014 v0.1.0)
- Authorization: DEC-0111 (2026-08-08)
- Implementation owner: GLM
- Coordinator/auditor: current coordinator
- Verdict: **ACCEPTED** (local synthetic scope)

## Scope audited

- `src/crm/web/routes/account.py` (JSON API + form paths)
- `src/crm/application/commands.py` (`ChangePasswordCommand`,
  `ChangeUsernameCommand`, `CredentialError`, `_is_prefix_protected`)
- `templates/account_settings.html`
- `tests/test_task0019_account_credentials.py` (25 tests)
- `src/crm/web/main.py` (router mount)

## Independent verification (coordinator re-run, not executor report)

| Check | Command | Result |
|---|---|---|
| Focused AC tests | `python -m pytest tests/test_task0019_account_credentials.py -q` | 25 passed |
| Full suite | `python -m pytest tests/ -q` | 302 passed, 28 skipped |
| Governance | `scripts/check-governance.ps1` | `[PASS]` (8 approved SPECs, 15 active tasks) |

Baseline before task: 277 passed. After: 302 passed (+25, 0 regressions).

## Security-sensitive AC verification (test bodies read, not trusted)

- **AC-002** (wrong current password): test asserts HTTP 400 + old password
  still logs in + **zero** `user.password_change` audit rows + old session
  still valid (epoch not bumped). Genuine no-leak / no-mutation proof.
- **AC-008** (audit failure rollback): test injects a failing
  `audit_repo.record`, asserts HTTP 500, then proves rollback by confirming
  the **old** password still logs in (200) and the **new** password does not
  (401). Real transactional rollback proof.
- **AC-010** (session invalidation): after change, old session on
  `/api/institutions` returns 401. Confirmed for both password and username.

Command logic confirmed: current-password verified before any write;
`session_epoch` bump + credential update + audit `record(session=...)` all
inside one `transaction_session`, so audit failure rolls back the credential
change (R-008). Prefix protection checks the **current** username
case-insensitively (R-004); uniqueness is case-insensitive and excludes self
(R-005).

## Non-blocking findings (do not block acceptance)

1. Evidence file header says `SPEC-0014 (v1.0.0)`; the approved SPEC is
   `v0.1.0`. Cosmetic, evidence-only — no code impact.
2. `_is_prefix_protected` treats any username *starting with* `sa`/`dl`
   (e.g. `sarah`, `dlink`) as protected. This is literally SPEC-0014 §5/R-004
   (`lower(username).startswith(prefix)`), so it is spec-compliant; if the
   product owner intended only exact `sa`/`dl` channel prefixes, that is a
   future SPEC revision, not a defect here.

## Not verified

- Real PostgreSQL leg (all tests use in-memory SQLite; same constraint as all
  prior accepted tasks; 28 gated PG tests skipped).
- Browser visual acceptance of `account_settings.html` (product-owner gate).

## Result

TASK-0019 is ACCEPTED in local synthetic scope. Real-data, deployment, and
browser visual acceptance remain separately gated.
