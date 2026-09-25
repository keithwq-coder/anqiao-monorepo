# TASK-0001 G1: Authorized legacy-site replacement boundary

- Date: 2026-07-27 Asia/Shanghai
- Decision authority: `DEC-0045`
- Status: G1 PASSED; G2 authorization pending
- Server mutation: none
- Secret handling: no secret value, credential, TLS private-key content or
  client-auth content is included

## Decision resolved

The product owner permits this repository to replace the legacy project using
`crm.aibrain.wiki`, `/home/ubuntu/CRM` and nginx site `crm`.

This is limited to a later staged cutover. It does not authorize application
implementation, account creation, directory creation, package installation,
PostgreSQL setup, migration, service start, nginx change, DNS/TLS change,
cleanup or deletion.

## Read-only resource evidence

| Resource | Result |
|---|---|
| legacy CRM directory | exists and is owned by `ubuntu`; not modified |
| legacy nginx site | exists, syntactically valid, and is the only authorized eventual cutover target |
| legacy service health | homepage was `500`; health/API were `502`; port `8100` was not listening |
| existing TLS | certificate metadata showed a currently valid certificate; private key was not read |
| `anqiao-crm` system account | absent/free |
| `/opt/anqiao-crm` | absent/free |
| `/etc/systemd/system/anqiao-crm.service` | absent/free |
| `/etc/nginx/sites-available/anqiao-crm` | absent/free |
| `/etc/nginx/sites-enabled/anqiao-crm` | absent/free |
| loopback candidates | ports `8100`, `8200`, `8201`, `8202` were unbound at inspection |
| PostgreSQL | no client, unit or listener observed; installation and database names remain unverified |

## Staged replacement plan

1. **W1, separate authorization**: create only the `anqiao-crm` non-login
   service account and empty `/opt/anqiao-crm/releases` and
   `/opt/anqiao-crm/shared` directories.
2. **Later database gates**: install PostgreSQL only after a dedicated approval,
   then create an isolated `anqiao_crm` database and `anqiao_crm_app` role only
   after a separate approval. Password material stays runtime-only.
3. **Later cutover gate**: capture the legacy CRM directory and nginx
   configuration into a protected server-local rollback snapshot, deploy the new
   verified release, and replace only the legacy `crm` nginx site. Existing TLS
   material is referenced without reading or copying its private key.
4. **Later acceptance and cleanup gate**: keep the snapshot until automated
   checks, isolation checks and product-owner acceptance complete. Deletion of
   any legacy content is a separate irreversible authorization.

## W1 impact and rollback

- Impact: a disabled non-login OS identity and empty isolated directories only.
  No listener, package, database, service, nginx configuration, domain route,
  TLS object or legacy path changes.
- Rollback: after explicit confirmation, remove the unused account and empty
  `/opt/anqiao-crm` tree. No legacy resource is involved.
- Evidence after W1: account/shell/ownership checks, legacy config/file
  checksums, nginx syntax check and unchanged legacy HTTP response baseline.

## G2 authorization needed

Two distinct approvals are required before advancing:

1. authorize revised `TASK-0001` application implementation with synthetic data
   only; and
2. authorize W1 exactly as described above.

Neither approval authorizes PostgreSQL installation, database creation,
migration, release, nginx/DNS/TLS changes, old-site snapshot or cleanup.
