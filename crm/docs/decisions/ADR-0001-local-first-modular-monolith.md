# ADR-0001: Local-first modular monolith for the first CRM slice

- Date: 2026-07-26
- Status: SUPERSEDED by `ADR-0002` on 2026-07-27 (`DEC-0043`)
- Decided by: AI engineering owner under `DEC-0003` and `AGENTS.md`
- Affects: `SPEC-0001 v0.7.0`, proposed `TASK-0001`
- Supersedes: none

> **SUPERSEDED.** `DEC-0043` cancelled the local-first premise; the CRM is built
> cloud-deployed from the start. The module boundaries, policy-layer rule, and
> audit/revision shape below are carried forward into
> `ADR-0002-cloud-deployed-modular-monolith.md`. The local-only runtime,
> SQLite-only storage, and "no cloud service" constraints no longer apply. Do not
> implement from this file.

## Decision scope

This is a reversible engineering decision. It does not change approved business
behavior and does not authorize implementation, real data, external model
transfer, deployment, or any external side effect.

## Verified context

- [VERIFIED] `SPEC-0001 v0.7.0` is approved with matching SHA-256 metadata.
- [VERIFIED] The repository has no application code and no active task.
- [VERIFIED] Local inspection on 2026-07-26 found Python `3.14.3`, FastAPI
  `0.136.3`, SQLAlchemy `2.0.51`, Pydantic `2.12.5`, Jinja2 `3.1.6`, Uvicorn
  `0.43.0`, Alembic `1.18.4`, HTTPX `0.28.1`, and pytest `9.0.2` installed.
- [VERIFIED] The approved SPEC requires a deterministic manual path that works
  without an external model or message platform.
- [VERIFIED] Real business data, shared environments, external model transfer,
  and deployment are not authorized.

## Options considered

1. **Local-first Python modular monolith.** One process owns server-rendered
   pages, API endpoints, authorization policy, persistence, audit history, and
   tests. SQLite and synthetic fixtures keep the first slice reversible.
2. **Separate browser application and API service.** This creates additional
   build, deployment, authentication, and cross-service failure boundaries
   before the core facts are verified.
3. **Spreadsheet or no-code store.** This is quick for manual entry but cannot
   reliably enforce the approved cross-page/API visibility, immutable revision,
   duplicate-warning, and audit requirements as one contract.

## Decision

Use option 1 for the first implementation slice:

- Python application package under `src/crm/`;
- FastAPI for local HTTP routing and typed request/response boundaries;
- Jinja2 server-rendered pages for the first usable interface;
- SQLAlchemy with a local SQLite database and Alembic migrations;
- Pydantic schemas at input/output boundaries;
- pytest, HTTPX, and synthetic fixtures for automated acceptance evidence;
- no separate frontend build, queue, cache, cloud service, or external model;
- an `ai` adapter boundary exists in the module design but remains disabled and
  is not implemented by the manual-core task.

## Module boundaries

| Module | Responsibility |
|---|---|
| `domain` | Organization, contact, activity, revision, audit, and identity rules |
| `application` | Commands and queries; transaction and correction workflows |
| `policy` | Central role/ownership checks and field-level response projection |
| `persistence` | SQLAlchemy mappings, repositories, migrations, SQLite lifecycle |
| `web` | Server-rendered pages and API endpoints using the same application/policy layer |
| `ai` | Provider-neutral coaching contract; disabled until a later authorized task |

The UI must never be the only masking layer. Page, search, export, and API
responses receive already-projected data from `policy`.

## Data and audit shape

- Current organization/contact values use stable IDs and explicit archive
  state.
- Activities are append-oriented. Corrections create a new revision linked to
  the prior revision; withdrawal changes current visibility but retains audit
  evidence.
- Administrative exceptional access and exceptional changes create explicit
  audit events with actor, target, time, reason, and action.
- The local database lives under generated `var/` and contains synthetic data
  only. It is excluded from version control.

## Verification and rollback

- The task must pin or record the exact package environment it actually uses.
- Domain, policy, repository, HTTP, migration, and acceptance tests run locally.
- Restart/reopen tests must prove persistence and stable ordering.
- Rollback is deletion of generated application files and the generated local
  SQLite database. No remote state exists in this architecture stage.

## Consequences and remaining boundaries

- [INFERENCE] A single runtime and one policy layer reduce coordination and
  permission drift for the first slice.
- [INFERENCE] Server-rendered pages are sufficient to test the approved manual
  workflow without committing the product to a permanent frontend framework.
- A production database, authentication provider, deployment environment,
  external AI provider, real-data migration, and operational retention policy
  remain outside this decision and require later evidence/authorization.

