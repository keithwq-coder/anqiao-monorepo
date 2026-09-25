# TASK-0001 G3: Native PostgreSQL installation proposal

- Date: 2026-07-27 Asia/Shanghai
- Status: PASSED; authorized by `DEC-0047`
- Mode so far: read-only package metadata and install simulation
- Proposed source: existing Tencent Cloud Ubuntu 24.04 mirror

## Proposed write

Install Ubuntu packages `postgresql-16` and `postgresql-client-16`. The current
candidate is PostgreSQL 16.14 from the configured Noble updates repository. No
third-party repository is added.

The package transaction simulation reported:

- 11 new packages, including PostgreSQL server/client/common, `libpq5`,
  `libllvm17t64`, JSON/Perl helpers and `ssl-cert`;
- 4 shared Perl packages upgraded to the current Ubuntu security/update version;
- no package removal;
- PostgreSQL server/client archives of roughly 17 MB combined, plus dependencies;
- about 18 GiB filesystem space was available before installation.

## Practical impact

- This changes global Ubuntu package state, including four shared Perl packages.
- Ubuntu packaging is expected to create a local PostgreSQL 16 cluster and start
  its service, normally listening on loopback port 5432. No external firewall or
  public listener is requested.
- Existing projects are not configured to use it. W1 directories and the legacy
  CRM/nginx site are not part of this write.
- No CRM database, application role or password is created at G3/W2; those remain
  the separate G4/W3 gate.

## Pre-change evidence

- no installed PostgreSQL server/client package, service unit or port 5432
  listener was observed;
- no apt/dpkg transaction was running at the check;
- nginx syntax passed and legacy CRM checksum/HTTP baselines were recorded;
- W1 account and directory ownership were reverified.

## Rollback and limitation

If installation or validation fails before any CRM database is created:

1. stop and disable the newly created PostgreSQL cluster/service;
2. preserve package logs and verify other sites/processes before any removal;
3. request separate destructive confirmation before purging PostgreSQL packages
   or deleting `/var/lib/postgresql`;
4. do not automatically downgrade the four shared Perl packages, because package
   downgrades can destabilize unrelated software.

This means the package transaction is reversible at the service/data level but
not guaranteed to restore every shared package byte-for-byte. That residual risk
is why G3 requires an explicit immediate authorization.

## Validation after authorized installation

- package and server version report PostgreSQL 16.14;
- service is active and enabled;
- `pg_isready` succeeds locally;
- port 5432 is not publicly bound;
- no CRM database or role exists yet;
- `nginx -t`, legacy checksums/HTTP baseline and unrelated listening ports remain
  unchanged;
- no secret value is printed.

## Not authorized by G3

Database/role/password creation, migrations, synthetic seed data, application
release, systemd application service, nginx/TLS/DNS change, legacy-site cutover
and cleanup remain unauthorized.

## Authorization evidence

The product owner stated `批准 G3 PostgreSQL 安装。` on 2026-07-27 after
the exact transaction impact, rollback limitation and excluded later gates were
presented. `DEC-0047` records that authorization. W2 may now install only the
two named PostgreSQL packages and their repository-resolved dependencies.
