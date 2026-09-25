# TASK-0001 G4: Dedicated database and login-role proposal

- Date: 2026-07-27 Asia/Shanghai
- Status: PASSED under `DEC-0048`; W3 PASSED
- Mode so far: read-only PostgreSQL catalog and authentication inspection
- Prerequisite: W2 PASSED under `DEC-0047`

## Read-only evidence

- PostgreSQL server/client 16.14 are installed; the `16/main` cluster is active,
  enabled, ready and bound only to localhost on port 5432.
- Password storage defaults to `scram-sha-256`; localhost TCP host rules require
  `scram-sha-256`; PostgreSQL SSL is enabled.
- The default database encoding and locale are UTF-8 / `en_US.UTF-8`.
- Database `anqiao_crm`, role `anqiao_crm_app` and runtime file
  `/opt/anqiao-crm/shared/database.env` are absent.
- The W1 directories remain empty and mode `0750`; the legacy CRM and protected
  services remain unchanged.

## Proposed W3 write

Create only these resources:

1. PostgreSQL login role `anqiao_crm_app` with `NOSUPERUSER`, `NOCREATEDB`,
   `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS` and a connection limit of 20.
2. Empty UTF-8 database `anqiao_crm`, owned by that dedicated role. Revoke
   database/schema creation access from `PUBLIC`; only the dedicated owner may
   create the later Alembic-managed schema.
3. `/opt/anqiao-crm/shared/database.env`, owned by `anqiao-crm`, mode `0600`.
   It contains the localhost database connection settings and a server-generated
   256-bit random password. The password is passed to PostgreSQL through process
   input, never a command argument, and is never printed, returned locally or
   written to repository evidence. PostgreSQL stores only its SCRAM verifier.

The existing localhost SCRAM rules already support this connection. W3 does not
change `postgresql.conf`, `pg_hba.conf`, systemd, firewall or any listener.

## Practical impact

- No expected user-visible interruption and no service restart.
- PostgreSQL catalog state gains one role and one empty database; the W1 shared
  directory gains one restricted runtime-secret file.
- No existing database or role is changed. No migration, table, seed record or
  real/synthetic business data is created.

## Failure rollback requested with this gate

If W3 validation fails before any migration or data exists, the same operation
will disable the new role, terminate only connections to `anqiao_crm`, drop only
the newly created empty database and role, and remove only the newly created
runtime file. PostgreSQL packages/cluster and every pre-existing resource remain.

This automatic failure rollback is part of the requested G4 authorization. Once
W3 passes, any later database/role/file removal is destructive and requires a
new explicit confirmation.

## Validation after authorization

- role flags and connection limit exactly match the proposal;
- the stored password verifier is SCRAM without displaying it;
- database owner, UTF-8 encoding/locale and public-access revocation match;
- the runtime file is `anqiao-crm:anqiao-crm`, mode `0600`, without reading its
  value into output;
- the `anqiao-crm` OS identity can connect through localhost as
  `anqiao_crm_app` using the runtime file;
- a create/write probe runs inside a transaction and rolls back, leaving the
  database empty;
- all pre-existing database/role inventory, PostgreSQL service/binding, W1
  resources, protected services, nginx/legacy checksums and HTTP baselines stay
  unchanged.

## Not authorized by G4

Alembic migration, permanent table/schema creation, synthetic seed data,
application implementation beyond the already authorized repository task,
application release/systemd service, nginx/TLS/DNS/firewall change, legacy CRM
cutover/cleanup, real data, external AI and paid services remain unauthorized.

## Exact authorization request

`批准 G4 数据库和账号创建（含验证失败时仅回滚本关口新建的空资源）。`

## Authorization evidence

The product owner gave the exact authorization above on 2026-07-27.
`DEC-0048` limits that authorization to G4/W3 and includes rollback of only the
new empty resources if validation fails.

W3 completed without invoking rollback. Its redacted execution and independent
post-check evidence is in `docs/evidence/TASK-0001-W3-database-role.md`.
