# ADR-0002: Cloud-deployed modular monolith on the existing Tencent server

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: AI engineering owner under `DEC-0003` and `AGENTS.md`
- Affects: the first implementation task and all later implementation
- Supersedes: `ADR-0001-local-first-modular-monolith.md`

## Decision scope

This is a reversible engineering decision. It does not change approved business
behavior and does not authorize implementation, real data, deployment, server
access, or any external side effect.

## Verified context

- [VERIFIED] `DEC-0043` cancels local-first and directs a cloud-deployed build.
- [VERIFIED] `DEC-0041`/`DEC-0042` fix the target: existing 腾讯云轻量应用服务器,
  subdomain `crm.aibrain.wiki`, nginx + HTTPS, SSH deploy, server-side app.
- [VERIFIED] `SPEC-0002` defines multiple concurrent users (business users,
  record owners, administrators, general manager, other management).
- [VERIFIED] `SPEC-0001` requires identical field-level masking across page,
  search, and API paths, with unmapped fields defaulting to hidden.
- [VERIFIED] `SPEC-0012` R-010 requires a server-side application; a static site
  that ships business data to the browser is excluded.
- [VERIFIED] `ADR-0001` recorded a local toolchain inspection on 2026-07-26
  (Python 3.14.3, FastAPI, SQLAlchemy, Pydantic, Jinja2, Uvicorn, Alembic,
  pytest). That was the development machine, not the server.
- [VERIFIED] `DEC-0044` prohibits Docker and Docker Compose and requires native
  server operation with separately gated server writes.
- [VERIFIED] Read-only inspection on 2026-07-27 observed Ubuntu 24.04, Python
  3.12.3, systemd and active nginx 1.24.0. No PostgreSQL client, PostgreSQL
  systemd unit or listening port `5432` was observed.
- [VERIFIED] The server already has an enabled nginx site for
  `crm.aibrain.wiki`, rooted at `/home/ubuntu/CRM/frontend/dist` and proxying
  `/api/` to an existing service.
- [VERIFIED] `DEC-0045` authorizes staged replacement of that legacy CRM site by
  this repository. It does not authorize an immediate write, deletion or
  cutover; the old site must remain unchanged until its separate release gate.

## Decision

Keep the modular monolith and the central policy layer from `ADR-0001`; change
the runtime, storage, and deployment premises.

- Python application package under `src/crm/`.
- FastAPI for HTTP routing and typed request/response boundaries.
- Jinja2 server-rendered pages for the first usable interface; no separate
  frontend build in the first slice.
- SQLAlchemy with **PostgreSQL** on the server, plus Alembic migrations.
- Pydantic schemas at input/output boundaries.
- Server-side session authentication (see `SPEC-0012` `OD-002`); no client-side
  auth, because masking and permissions must be enforced server-side.
- Run under Uvicorn as a managed service, reverse-proxied by nginx over HTTPS on
  `crm.aibrain.wiki`.
- pytest, HTTPX, and synthetic fixtures for automated acceptance evidence.
- No queue, cache, external model, or third-party business integration
  (`DEC-0028`); the `ai` adapter boundary exists but stays disabled.
- No Docker images, Docker daemon, Compose files, containers or container
  volumes are part of development, test or deployment.

### Native server topology

The proposed deployment shape is deliberately project-specific and reversible:

- a dedicated deployment directory and Python virtual environment that do not
  overlap any existing project path;
- a dedicated unprivileged operating-system service identity;
- a dedicated PostgreSQL database and login role with privileges limited to that
  database;
- a project-specific systemd unit running Uvicorn on an unused loopback port;
- a project-specific nginx site that proxies only the approved CRM hostname;
- runtime secrets supplied outside the repository with restrictive ownership and
  permissions.

The initial isolated names are recorded in
`docs/evidence/TASK-0001-G1-replacement-resource-manifest.md`. Creating any
resource is a server write and requires its own immediately preceding
authorization gate. PostgreSQL installation, database creation, schema
migration, release publication and nginx/DNS/TLS changes are separate gates;
authorizing one does not authorize the next.

### Authentication decision

`DEC-0044` resolves the engineering proposal for `SPEC-0012` `OD-002`: admins
pre-create internal username/password accounts; passwords are stored only as
Argon2id hashes; server-side session state backs `Secure`, `HttpOnly`,
`SameSite` cookies; writes use CSRF protection; login has rate limiting and
security audit; account disablement or permission revocation immediately
invalidates existing sessions. Client-side authentication from the reference
static site is not reused.

### Why PostgreSQL rather than SQLite

[INFERENCE] `SPEC-0002` describes concurrent multi-user access with ownership
transfer and audit writes. SQLite's single-writer model is a poor fit for
concurrent writes on a shared server, and `SPEC-0011` requires deletion to
propagate into backups with verifiable state. PostgreSQL gives standard
concurrent writes, backup/restore tooling, and migration practice. This is
revisable if server constraints make it impractical.

## Module boundaries (carried forward from ADR-0001)

| Module | Responsibility |
|---|---|
| `domain` | Organization, contact, activity, revision, audit, and identity rules |
| `application` | Commands and queries; transaction and correction workflows |
| `policy` | Central role/ownership checks and field-level response projection |
| `persistence` | SQLAlchemy mappings, repositories, migrations, DB lifecycle |
| `web` | Server-rendered pages and API endpoints via the same application/policy layer |
| `ai` | Provider-neutral coaching contract; disabled until a later authorized task |

The UI must never be the only masking layer. Page, search, and API responses
receive already-projected data from `policy`. This is what makes `SPEC-0001`
masking, `SPEC-0002` cross-path consistency, and `SPEC-0003`/`SPEC-0008`
inference protection enforceable in one place.

## Environments

- **Development**: native Python virtual environment and a native PostgreSQL
  database, synthetic data only. It must not silently fall back to SQLite.
- **Server**: `crm.aibrain.wiki` on the existing Tencent Lightweight server.
  Deployment happens only through the staged gates above. `DEC-0045` permits a
  future staged replacement of the currently occupied legacy site, which remains
  unchanged until the separately authorized cutover.
  Secrets are used only through the existing controlled local connection/runtime
  mechanism and are never printed, copied or stored in the repository.

"Local" is now a development environment, not the product's deployment model.

## Data and audit shape (carried forward)

- Organizations/contacts use stable IDs with explicit archive state.
- Activities are append-oriented; corrections create a linked new revision;
  withdrawal changes current visibility while retaining audit evidence
  (`SPEC-0001` R-031).
- Administrative exceptional access and changes create audit events with actor,
  target, time, reason, and action.
- `SPEC-0011` adds administrator-only permanent erasure, distinct from archive,
  audited without retaining erased values, and propagating to backups.

## Verification and rollback

- The task must record the exact package environment it actually uses.
- Domain, policy, repository, HTTP, migration, and acceptance tests run in
  development against synthetic data.
- Restart/reopen tests must prove persistence and stable ordering.
- Development database creation, migration upgrade and migration downgrade are
  verified separately. Destructive database removal needs explicit confirmation.
- Server rollout uses a release directory plus a reversible current-release
  pointer or equivalent atomic activation. Rollback restores the preceding
  release and migration state; it does not overwrite another project's files.
- Before every server mutation, the task records exact resources, impact, backup
  or prior state, rollback commands and the product owner's immediate approval.

## Consequences and remaining boundaries

- [INFERENCE] One runtime and one policy layer minimize permission drift, which
  is the highest-risk area given four approved masking-sensitive SPECs.
- [INFERENCE] Server-rendered pages let the approved manual workflow be tested
  without committing to a permanent frontend framework.
- Backup/restore mechanics (`SPEC-0011` `OD-001`), real data, every server write
  and deployment remain separately gated. The login design is decided, but its
  implementation remains part of an explicitly authorized task.
- The legacy `crm.aibrain.wiki` site is an authorized future replacement target,
  not a disposable resource. Snapshot, cutover and later cleanup remain distinct
  gated actions.
