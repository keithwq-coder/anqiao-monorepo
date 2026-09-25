# TASK-0001 P0: Redacted server and reference-project preflight

- Date: 2026-07-27 Asia/Shanghai
- Mode: READ-ONLY
- Owner: Codex / GPT-5.6-sol
- Scope: repository state, approved hashes, reference deployment shape and
  Tencent server capability/isolation inventory
- Server mutation: none
- Secret handling: credential/auth/private-key values were not printed, copied,
  committed or recorded in this evidence

## Sources actually inspected

- Repository governance entry files, baseline, decision log, `ADR-0002`, task
  index, active `TASK-0001`, handoff and governance script.
- Seven approved SPEC files and seven approval metadata files.
- Git/file inventory for application-package existence.
- Reference project directory and deploy-package file names. Files named
  `deploy_key.py` and `_ssh_cmd.py` were inspected structurally under local
  control; `auth.json`, `auth.js` and deployment archives were treated as
  untrusted secret-bearing inputs and their contents were not reproduced.
- Server OS/runtime/resource, nginx/site, process/service, listening-port,
  directory-boundary and PostgreSQL-presence inventories through the existing
  controlled read-only connection path.

## Verified repository facts

- [VERIFIED] Seven approved SPEC files have matching approval metadata and
  SHA-256 values.
- [VERIFIED] `SPEC-BASELINE.md` is `COMPLETE`.
- [VERIFIED] `TASK-0001` was `PROPOSED / NOT AUTHORIZED / NOT STARTED` before
  this governance correction and remains unauthorized.
- [VERIFIED] The Git branch has no commits and all repository content is
  untracked. No tracked baseline is available for rollback.
- [VERIFIED] No `src/`, `tests/`, `migrations/`, `templates/`, `pyproject.toml`
  or `alembic.ini` existed. No CRM application implementation was found.

## What the reference project proves

- [VERIFIED] It contains a static HTML/image release with client authentication
  files.
- [VERIFIED] Its deployment tooling uses SSH/SFTP and remote commands to publish
  an archive to the same server family/infrastructure.
- [VERIFIED] It provides infrastructure evidence for a connection route and a
  prior publication pattern.

It does not prove:

- that client-side authentication is suitable for CRM;
- that CRM can be static;
- that Python, PostgreSQL, systemd or an unused application port are available;
- that an old remote path, hostname or nginx site is free to overwrite;
- that any credential or `auth.json` value may be reused, copied or disclosed.

## Verified server facts

| Area | Observed read-only result | Decision effect |
|---|---|---|
| OS | Ubuntu 24.04 LTS, x86_64 | Native Ubuntu deployment is technically plausible |
| Python | `/usr/bin/python3`, Python 3.12.3 | A project virtualenv can be proposed; creation is not authorized |
| Init | systemd running | A project-specific systemd unit can be proposed |
| nginx | nginx 1.24.0 active | Reverse proxy is present; its configs are protected resources |
| Disk | 40 GiB root, about 18 GiB available at inspection | No immediate disk blocker observed; recheck before writes |
| Memory | 3.6 GiB total, about 1.8 GiB available at inspection | Capacity is shared and must be rechecked before deployment |
| PostgreSQL | no `psql`, unit or 5432 listener observed | Availability not proven; install/create are separate write gates |
| Listening ports | 22, 80, 443, 3000, 7280, 8080 observed | Do not reuse without a fresh collision check |
| Existing apps | multiple directories/processes/sites under shared locations | Every other project is an isolation boundary |
| Target name | `crm.aibrain.wiki`, nginx site `crm`, `/home/ubuntu/CRM` occupied | Deployment is blocked pending ownership decision |

The enabled `crm.aibrain.wiki` site was observed serving an existing static
frontend and proxying `/api/` to an existing backend service. This is evidence
of an occupied deployment boundary, not evidence that it may be replaced.

## Native deployment proposal

Subject to task authorization and separate write gates:

1. use a project-specific non-overlapping release directory and virtualenv;
2. run as a dedicated unprivileged OS service identity;
3. use a dedicated PostgreSQL database and least-privilege login role;
4. run Uvicorn under a project-specific systemd unit on an unused loopback port;
5. proxy only through an explicitly approved nginx hostname/site;
6. supply runtime secrets outside the repository with restricted permissions;
7. activate releases reversibly and prove other sites unchanged before/after.

No exact resource name is proposed while the existing CRM boundary remains
unresolved, because naming it now could imply unauthorized replacement.

## Not verified

- PostgreSQL installation/version/configuration and backup capability;
- permission to replace or retire the existing CRM site;
- final hostname, directories, service identity, database/role, port and unit;
- application dependencies, tests, migrations, authentication and behavior;
- deployment, HTTPS/DNS changes, external reachability and human acceptance.

## Blocking decision

The product owner must state whether the existing project currently occupying
`crm.aibrain.wiki` and `/home/ubuntu/CRM` is replaceable by this repository or
must remain untouched. Until then, all server writes and deployment naming are
blocked. Application implementation also remains blocked until revised
`TASK-0001` is explicitly authorized.

## G1 decision update

- [VERIFIED] The product owner resolved the preceding blocking question on
  2026-07-27: the existing CRM may be replaced. See `DEC-0045`.
- [VERIFIED] This changes the resource owner boundary only. It does not grant
  permission to modify the site, its directory, nginx, TLS, DNS, services,
  database or application code.
- [VERIFIED] A later cutover must snapshot the legacy directory and nginx
  configuration server-locally first, retain it for rollback, and leave cleanup
  for a separate authorization.
- [VERIFIED] Read-only post-decision health checks observed HTTPS status `500`
  for the old homepage and `502` for the old health/API routes. These are
  baseline observations, not a claim that replacement is already authorized.
