# TASK-0001 W2: Native PostgreSQL 16 installation

- Date: 2026-07-27 Asia/Shanghai
- Owner: Codex / GPT-5.6-sol
- Status: PASSED
- Authorization: `DEC-0047`
- Server write: Ubuntu package installation and packaged PostgreSQL service only
- Secret handling: no credential, password, token, private key or client-auth
  value was printed, copied, stored or changed

## Scope delivered

- Installed `postgresql-16` and `postgresql-client-16` version
  `16.14-0ubuntu0.24.04.1` from the server's existing Ubuntu 24.04 repository.
- The completed apt transaction added 11 packages, upgraded 4 existing Perl
  packages and removed no package.
- The packaged PostgreSQL 16 `main` cluster is online on port `5432`.
- PostgreSQL is active and enabled through its packaged systemd units.
- The server reports `listen_addresses=localhost`; the observed TCP endpoint is
  only `127.0.0.1:5432`.

## Attempt and containment evidence

The first post-install validation compared the complete set of running systemd
services byte-for-byte. Package installation had automatically activated
`fwupd.service` and `packagekit.service`, so that over-broad comparison failed.
The predeclared failure trap immediately stopped and disabled PostgreSQL. It did
not uninstall packages, delete the cluster/data directory or downgrade shared
packages.

Read-only follow-up proved that both transient services started inside the apt
transaction window and that protected project services had not restarted. Both
transient services later returned to inactive without intervention. PostgreSQL
was then started/enabled within the already authorized G3 scope, and the final
validation compared the protected service set, its activation timestamps,
ports, nginx/site checksums and W1 resources. That validation passed.

## Checks actually run

| Check | Result |
|---|---|
| package manager locks immediately before each write | PASS; no active apt/dpkg transaction |
| install simulation | PASS; 11 new, 4 upgraded, 0 removed |
| server/client package state and version | PASS; both installed at 16.14 |
| PostgreSQL wrapper/cluster service | PASS; active and enabled |
| cluster and readiness | PASS; `16/main`, port 5432, online; local readiness succeeded |
| network exposure | PASS; `listen_addresses=localhost`; only `127.0.0.1:5432` observed |
| G4 resources absent | PASS; zero `anqiao_crm` databases and zero `anqiao_crm_app` roles |
| nginx syntax and active state | PASS |
| legacy CRM nginx/index checksums | PASS; unchanged from W1 baseline |
| legacy CRM HTTP baseline | PASS; homepage remained `500`, health remained `502` |
| protected running services | PASS; nginx, Docker, supervisor and existing study service stayed active and were not restarted |
| unrelated listening ports | PASS; unchanged; only approved 5432 was added |
| failed systemd units | PASS; zero |
| W1 account/directories | PASS; ownership/mode/emptiness unchanged |
| future application resources | PASS; no application service or candidate nginx site created |

## Corrected baseline detail

The first W2 preflight found that the legacy CRM nginx configuration is a
regular file at `/etc/nginx/sites-enabled/crm`, not a symlink backed by
`/etc/nginx/sites-available/crm` as earlier evidence had implied. Read-only
inspection confirmed its SHA-256 still matched the established legacy baseline.
No nginx file was moved, restored or changed.

## Explicitly not changed

No CRM database, database role, password, migration, seed data, application
release, application systemd service, candidate nginx site, TLS/DNS/firewall
configuration, legacy CRM content or other project resource was created or
changed. No package was purged and no data directory was deleted.

## Next gate

G4 must present the exact dedicated database/role creation, least-privilege
grants, runtime-only secret handling, impact, validation and rollback. W3 may
not begin until the product owner explicitly authorizes that separate gate.
