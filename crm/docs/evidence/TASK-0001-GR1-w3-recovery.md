# TASK-0001 GR1: Recovery to the W3 empty-database state

- Date: 2026-07-28 Asia/Shanghai
- Status: PARTIAL
- Authorization: `DEC-0049`
- Scope: only `anqiao_crm`, `anqiao_crm_app`,
  `/opt/anqiao-crm/shared/database.env`, and the three named unauthorized CRM
  upload/release directories
- Secret handling: no SSH credential, database password, verifier, token, TLS
  key, or runtime-file content was printed, copied into the repository, or
  recorded here

## Commands and results

All server actions used the existing controlled local SSH helper with `py -3.14`
and its privileged mode. The remote command payload was constructed locally and
did not include a secret. The following checks and actions were actually run:

1. A read-only PostgreSQL/systemd/path preflight confirmed the service was
   inactive, the three source directories existed, `anqiao_crm_app` had only
   login privilege, and the database had exactly ten public migration tables.
   `alembic_version` contained `0001_initial_schema`; each of the nine CRM data
   tables had zero rows.
2. GR1 disabled `anqiao_crm_app`, rechecked the exact ten-table set and zero
   active database connections, then dropped only those ten named tables without
   `CASCADE`.
3. GR1 generated a new server-local 256-bit password, updated PostgreSQL through
   standard input, atomically replaced only
   `/opt/anqiao-crm/shared/database.env`, set it to `anqiao-crm:anqiao-crm`
   mode `0600`, and re-enabled the role.
4. GR1 moved, without deletion, `/tmp/anqiao-src`, `/tmp/deploy-test`, and
   `/opt/anqiao-crm/releases/current` into
   `/opt/anqiao-crm/quarantine/gr1-w3-20260728/`, which is root-owned mode
   `0700`.
5. Post-checks confirmed the role is login-enabled, non-superuser, cannot create
   databases or roles, cannot replicate or bypass RLS, has connection limit 20,
   and has a SCRAM verifier; `anqiao_crm` has zero public tables; all three
   original paths are absent; and `anqiao-crm.service` remains inactive.
6. A root-only runtime-file connection test successfully connected to
   `anqiao_crm` as `anqiao_crm_app` without outputting the credential. `nginx -t`
   also passed. No nginx configuration, systemd configuration, TLS, DNS, legacy
   CRM resource, or other project was modified.

## Blocking validation result

The intended validation as OS identity `anqiao-crm` failed before it could use
the database credential. Read-only diagnostics showed that
`/opt/anqiao-crm` and `/opt/anqiao-crm/shared` are pre-existing
`ubuntu:ubuntu` mode `0750` directories. The service identity has neither
traverse nor read access through those parents, even though
`database.env` itself is mode `0600` and owned by `anqiao-crm`.

GR1 did not alter those parent-directory permissions because its authorization
only covered the runtime file, database recovery, and quarantine. This prevents
claiming the service-account runtime validation passed.

## What this proves

- The database schema was returned to zero public tables; no CRM business rows,
  Alembic metadata table, synthetic seed, application release, or service was
  retained.
- The new database role credential works when read by root from the restricted
  runtime file, and PostgreSQL retains only a SCRAM verifier.
- The unauthorized uploads/releases are recoverable from root-only quarantine.
- No application service or nginx configuration was changed.

## Not verified

- Reading the runtime file and connecting as the `anqiao-crm` OS identity.
- Any Alembic reapplication, synthetic data, application process, API/page flow,
  authentication, masking, audit behavior, legacy cutover, DNS/TLS, backup or
  human acceptance.

## Required next decision

A new narrow server-write authorization is required before changing only the
permissions/ownership of `/opt/anqiao-crm` and `/opt/anqiao-crm/shared` so the
`anqiao-crm` service identity can traverse them. It must state the intended
owner/group/mode, confirm no other project shares those paths, and include a
metadata-only rollback. It does not need or authorize a migration, release,
systemd, nginx, TLS, DNS, or legacy-site change.
