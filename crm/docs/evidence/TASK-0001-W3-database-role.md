# TASK-0001 W3: Dedicated PostgreSQL database and login role

- Date: 2026-07-27 Asia/Shanghai
- Owner: Codex / GPT-5.6-sol
- Status: PASSED
- Authorization: `DEC-0048`
- Server write: one empty database, one least-privilege login role and one
  restricted runtime configuration file
- Secret handling: the database password was generated and retained on the
  server; no password, verifier, credential, token or private-key value was
  printed, returned locally, copied into the repository or written to evidence

## Resources created

| Resource | Verified state |
|---|---|
| PostgreSQL database `anqiao_crm` | empty; UTF-8 with `en_US.UTF-8`; owned by the dedicated role; no `PUBLIC` database privileges |
| PostgreSQL role `anqiao_crm_app` | login enabled; connection limit 20; no superuser, database-create, role-create, replication or row-security-bypass privilege; no role membership |
| `/opt/anqiao-crm/shared/database.env` | owner/group `anqiao-crm`; mode `0600`; localhost-only connection settings and server-generated 256-bit password |

PostgreSQL stores the password only as a SCRAM-SHA-256 verifier. The runtime
file uses separate connection fields so the application service can consume it
later without placing the password in a process argument.

## Write and validation evidence

- A fresh read-only preflight confirmed PostgreSQL active/enabled/ready,
  localhost-only binding, SCRAM authentication, zero other user databases and
  absence of all three target resources.
- W3 generated the password with server-side cryptographic randomness and sent
  the role-creation statement to PostgreSQL through standard input.
- `PUBLIC` privileges were revoked on the new database and `PUBLIC` schema;
  the dedicated owner retained schema usage/create for later Alembic migration.
- The `anqiao-crm` OS identity connected over `127.0.0.1` using only the
  restricted runtime file.
- A create/insert probe ran inside a transaction and rolled back. A separate
  catalog check confirmed zero permanent user objects afterward.
- A second SSH session independently rechecked the database, role, verifier,
  file metadata, OS-identity login, empty catalog and isolation boundaries.

The role has no explicit grant on any database other than `anqiao_crm`, and the
cluster currently has no other user database. PostgreSQL's pre-existing default
catalog databases and their default `PUBLIC` privileges were not changed, as
required by the approved boundary.

## Isolation evidence

- PostgreSQL remained active/enabled and did not restart.
- `listen_addresses` remained `localhost`; no public port 5432 listener appeared.
- `postgresql.conf` and `pg_hba.conf` checksums were unchanged.
- Pre-existing database and role inventories, excluding the new authorized
  names, were unchanged.
- Running protected services and listening ports were unchanged; no failed
  systemd unit appeared.
- nginx syntax passed; the existing `crm` nginx configuration and legacy CRM
  tree were unchanged.
- The legacy HTTPS baseline remained homepage `500` and health `502`; this is
  unchanged evidence, not a claim that the old CRM is healthy.
- W1 directory ownership/modes remained `0750`; releases stayed empty and the
  shared directory contains only `database.env`.
- No application systemd service, application listener, candidate nginx site,
  migration, table, seed record or release was created.

## Failure rollback

The authorized failure trap was armed but not invoked because all write-time
and independent post-write checks passed. Future removal of the database, role
or runtime file is now destructive and requires a new explicit confirmation.

## Next boundary

S2 may implement repository-side configuration, domain/identity/persistence and
the initial Alembic migration under the already authorized `TASK-0001`. Applying
that migration to this server database remains blocked at G5. Real data,
synthetic server seed data, release/systemd/nginx/TLS/DNS/firewall change,
legacy cutover/cleanup, external AI and paid services remain unauthorized.
