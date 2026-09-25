# TASK-0001 S2: Configuration, domain model, persistence and initial migration

- Date: 2026-07-27 Asia/Shanghai
- Owner: Codex / GPT-5.6-sol
- Status: PASSED
- Authorization: `TASK-0001` under `DEC-0046`
- Server write: none
- Data boundary: synthetic local test only; no real institution data, seed data,
  Tencent database migration, release or server configuration change

## Scope delivered

- Fail-closed PostgreSQL runtime settings with required connection values, a
  secret-safe URL representation and a hard-disabled external-AI switch.
- Domain invariants for internal identities, role grants, institutions,
  subordinate contacts and follow-up facts, including timezone-aware timestamps,
  explicit no-channel contact states and next-action consistency.
- SQLAlchemy mappings for identity, role grants, institution ownership history,
  contacts, append-only follow-up revisions, audit events, server-session token
  hashes and idempotency keys.
- Initial Alembic schema migration with PostgreSQL-safe identifier names and the
  approved deterministic activity-history index:
  `institution_id, occurred_at DESC, recorded_at DESC, id DESC`.

## Checks actually run

| Check | Environment | Result |
|---|---|---|
| `python -m compileall -q src tests migrations` | local native Python 3.12 environment | PASS |
| `python -m pytest -q` | local native Python plus isolated local PostgreSQL test database | `34 passed` |
| `python -m pip check` | local native Python 3.12 environment | `No broken requirements found` |
| `alembic upgrade head --sql` | local offline PostgreSQL SQL generation | PASS; all initial tables and revision SQL generated; test password sentinel absent from output |
| Alembic `upgrade -> downgrade -> upgrade`, then `alembic check` | isolated local WSL PostgreSQL 16.14 test database | PASS; no migration drift reported |
| `scripts/check-governance.ps1` before S2 status update | repository | PASS; 7 approved SPECs and 1 active task |

The local PostgreSQL service is bound only to its local loopback interface.
Test credentials were generated per process, used only for the test connection,
and were neither printed nor stored in the repository, evidence or server.

## Failure correction during S2

The first offline SQL generation correctly exposed two startup/schema defects:

1. generated foreign-key names exceeded PostgreSQL's 63-byte identifier limit;
2. `AI_ENABLED=false` from an environment variable was rejected before settings
   validation could enforce the disabled-only boundary.

The migration and SQLAlchemy mapping now use explicit short foreign-key names;
all generated schema identifiers are at or below the PostgreSQL limit. The
setting now parses a normal boolean and rejects only an attempt to enable AI.
Both corrections are covered by the test suite and the PostgreSQL migration
round trip above.

## Explicitly not done

- No migration was applied to the Tencent server's `anqiao_crm` database.
- No synthetic or real business record was inserted into that server database.
- No `policy` projection, role masking, command/query behavior, login/session
  endpoints, Jinja2 page, JSON API, Uvicorn service, systemd unit or nginx
  configuration was created.
- No Docker/Compose artifact, external AI call, paid service, DNS/TLS change or
  legacy CRM change occurred.

## Next boundary

S3 may implement the central server-side policy projection, owner/other-user
masking and concise-progress rules under the active task. Applying the existing
initial migration to the Tencent server remains blocked at G5 and needs a new
immediate product-owner authorization.
