# TASK-0001: 手工机构 / 联系人 / 跟进事实闭环（腾讯云原生运行）

- Task ID: TASK-0001
- Status: ACTIVE; S1/W1-W3/S2/S3/R1 PASSED; S4 PARTIAL (local legs reproduced 2026-08-03; `crm_test` leg unverified/single-source per audit); S5 IMPLEMENTED — P0 FIXED and ACCEPTED; **VACUOUS PARITY FIXED 2026-08-03, RESUBMITTED** (pattern corrected to `r"1[3-9]\d{9}"` matching line 595; assertion **proven live by an observed failure on an injected leak** per DEC-0073 point 4 — page with `13911112222` not in API failed, restored pass; evidence §8.2 records both outputs; scope now states page→API checks phone numbers only); S5 suite 9/9, `132 passed, 28 skipped` full suite); **S5 PASSED 2026-08-03 per `DEC-0074`** (local and synthetic only; coordinator independently mutated the assertion, observed it fail, restored and re-ran 9 passed); **S6 ACCEPTED 2026-08-03 per `DEC-0079`** (gated suite `19 passed, 0 failed` on `crm_test`; the DEC-0078 engine-per-call repair accepted with it; acceptance carries one labelled limit — the 19-pass belongs to an intermediate `database.py` (13:34) while the current tuple-key version (13:48) has only passed the local gate, and coordinator-measured single-config equivalence carries it, so the current bytes' real-database result is `[INFERENCE]`; DEC-0079 point 4 requires an evidence-wording correction, not a re-run); **G5 is the next gate**, PENDING its own immediate authorization; W4 EXECUTED under DEC-0053/DEC-0055, formal acceptance NOT VERIFIED
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Also governed by: `SPEC-0002 v0.2.0`, `SPEC-0012 v0.2.0`, `DEC-0044`,
  `ADR-0002`
- Implementation authorized by: Product owner, `DEC-0046`
- Authorization evidence: direct `批准` reply on 2026-07-27 to the exact combined
  G2 request
- Server-write authorization: W2 COMPLETED under `DEC-0047`; G4/W3 COMPLETED
  under `DEC-0048`; GR1 COMPLETED under `DEC-0049`; GR2 COMPLETED under
  `DEC-0050`; the W4 migration write was later authorized under `DEC-0053` and
  re-authorized under `DEC-0055` after recovery; no server write beyond W4 is
  authorized
- Local S4-repair authorization: GRANTED under `DEC-0051`; local repository
  files only, no server write
- Real-data authorization: `DEC-0058` ratified one one-time 117-record import
  executed on 2026-07-30; this is not a reusable capability and no further
  real-data write is authorized
- Existing-site replacement authority: `DEC-0045` only; cutover remains
  separately unauthorized
- Implementation owner: ZCode agent, successor implementer appointed by the
  product owner on 2026-08-02 per `DEC-0067`; model identity is recorded only
  as executor self-report or UNKNOWN per `DEC-0066` (historical owner: Codex /
  GPT-5.6-sol, retained as history only). For the S6 local round beginning
  2026-08-03 the product owner states the executing model is
  `DeepSeek V4 Flash`; this is a product-owner statement, not an independently
  verified model identifier, and per `DEC-0066` model reputation is never
  evidence — output is judged only against the SPEC and the verification
  commands. The coordinator (ZCode agent) retains adjudication.
- Governance revision owner: VACANT per `DEC-0066` (historical: Codex /
  GPT-5.6-sol, retained as history only)
- Reviewer: Qoder International / user-designated `qwen3.8max-prview`, assigned
  only to the read-only R1 eligibility review; it must report its actual model
  identifier and independence before issuing an R1 verdict
- Audit started at: 2026-07-27 10:43:37 +08:00
- Audit last updated: 2026-08-02 (DEC-0067 ownership succession recorded)
- Depends on: `DEC-0010`, `DEC-0014`, `DEC-0031`, `DEC-0033`, `DEC-0043`,
  `DEC-0044`, `ADR-0002`
- Supersedes: this task's former Docker Compose development plan

## Ownership release

`DEC-0090` releases this task's broad local application and test path
ownership to the coordinator's `DEC-0089` sequence. Its G5/W4 remote gate,
historic evidence, and unverified items are unchanged; this task does not
authorize a remote or application-code edit.

## Goal

Using synthetic data only, deliver the smallest server-side workflow:

1. an enabled business user manually creates an institution/company record;
2. the user attaches a contact, including an explicit no-storable-channel state;
3. the user appends a factual follow-up activity;
4. after application restart and reopening, the complete history remains present
   in a deterministic order.

Every page and API response must receive fields from the same server-side
`policy` projection. Authorization, field masking, audit and data access are
never delegated to browser code.

## Current phase and authorization boundary

- [VERIFIED] The complete SPEC baseline is `COMPLETE`; all seven approved SPEC
  hashes match their approval metadata.
- [VERIFIED] This task is `ACTIVE` and authorized by `DEC-0046`;
  implementation ownership succeeded to the ZCode agent per `DEC-0067`
  (2026-08-02).
- [VERIFIED] S1 created the native Python 3.12 project skeleton, isolated
  environment, module-boundary test suite and disabled AI adapter.
- [VERIFIED] S2 added fail-closed PostgreSQL configuration, domain/identity
  invariants, SQLAlchemy mappings and the initial Alembic migration. Compile,
  dependency, offline SQL and isolated local PostgreSQL upgrade/downgrade
  checks passed with synthetic state only. Evidence:
  `docs/evidence/TASK-0001-S2-foundation.md`.
- [VERIFIED] S3 added one central, fail-closed policy projection for owner,
  collaborator/management and administrator-exception record views. The full
  local role/field matrix passed with synthetic state only. Evidence:
  `docs/evidence/TASK-0001-S3-policy-projection.md`.
- [VERIFIED] Read-only server preflight is complete enough to identify the first
  isolation blocker. It did not modify the server.
- [VERIFIED] `DEC-0045` resolves the old-site ownership boundary: this repository
  may replace the existing CRM only through a staged snapshot and cutover. It
  does not authorize application implementation or any server write.
- [VERIFIED] GR1 under `DEC-0049` dropped only the ten known migration tables,
  rotated the dedicated role credential, atomically replaced the one runtime
  file, and moved three unauthorized CRM directories to root-only quarantine.
  The dedicated database now has zero public tables; no migration, seed, release,
  systemd unit, nginx change or legacy cutover was performed.
- [VERIFIED] GR2 under `DEC-0050` repaired the authorized parent-directory
  traversal boundary and recorded a service-identity runtime-file-read and
  database-connection check without exposing a credential. Evidence:
  `docs/evidence/TASK-0001-GR2-permission-repair.md`. GR2 did not authorize a
  migration, release, systemd, nginx, TLS, DNS or legacy-site change.
- [VERIFIED] R1 was performed on 2026-07-28 as an independent read-only review
  by the assigned Qoder reviewer and returned `R1 verdict: PASS` with no
  unresolved finding. Evidence:
  `docs/evidence/TASK-0001-R1-independent-review.md`. The product owner
  accepted the result under `DEC-0051`.
- [VERIFIED] A prior local collection-only run stopped on the four required
  runtime database settings in `tests/test_s6_integration.py`; a targeted S4
  run produced three failed tests and seven setup errors. These are current
  source facts, not accepted S4/S6 completion evidence.
- [VERIFIED] The local S4 authentication repair authorized by `DEC-0051` was
  completed on 2026-07-28: the S4 suite reports `20 passed`, the regression
  run excluding the pre-broken S6 module reports `64 passed, 1 skipped,
  3 errors` (all three errors are pre-existing S5-era `main.py` defects),
  and the governance check passes. Evidence:
  `docs/evidence/TASK-0001-S4R-local-auth-repair.md`.
- [INFERENCE] These S4 local test results demonstrate auth logic works in
  isolation but do NOT establish S4/S5/S6 acceptance per AGENTS.md section 6;
  full synthetic end-to-end verification requires database-backed session
  persistence and the complete page/API workflow.
- [VERIFIED] `DEC-0051` grants the new task authorization required by
  `DEC-0050` for local S4 repair only. S5/S6 acceptance, release and cutover
  remain unauthorized; the W4 migration write was later authorized under
  `DEC-0053` and re-authorized under `DEC-0055`.
- [VERIFIED] `DEC-0053` authorized W4 and `DEC-0055` re-authorized W4 after
  recovery; W4 formal acceptance remains NOT VERIFIED.
- [VERIFIED] `DEC-0058` ratified one one-time 117-record import executed on
  2026-07-30; this is historical and is not a reusable import capability.
- [VERIFIED] Implementation ownership of this task succeeded to the ZCode
  agent per `DEC-0067` (2026-08-02). The historical owner entry is retained as
  history only.
- [UNKNOWN] Current online database/service state is UNKNOWN; TASK-0006 did
  not access the network, server, or database.
- [NOT VERIFIED] S5/S6 accepted gate status is NOT VERIFIED; W4/S5/S6 must not
  be marked PASSED.
- [VERIFIED] `TASK-0024` W5 read-only production preflight was **EXECUTED on 2026-08-12** by DeepSeek in PI under `DEC-0129` but is **NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED per `DEC-0130`**: its journald pipelines (`journalctl -o cat | wc -l`; `-o short-iso | cut …`) read and processed log records and message text before aggregation, exceeding the no-log-body boundary. The snapshot (`docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md`) is preserved as unaccepted evidence only; TASK-0025 reconciles the local record. No production mutation occurred; **W5 release execution, G7, V1, and R2 remain PENDING and separately unauthorized**.
- [VERIFIED] Release, nginx/TLS/DNS, and legacy cutover remain unauthorized.

## Scope

### Included behavior

- `SPEC-0001` manual institution creation, subordinate contacts, append-only
  follow-up creation, deterministic history, minimum data validation, owner vs
  other-business-user visibility, concise progress and disabled AI boundary.
- `SPEC-0002` stable internal user identity, enabled/disabled account checks,
  business-user role subset and immediate session invalidation.
- Server-side username/password login per `DEC-0044`: admin-created accounts,
  Argon2id hashes, server-side sessions, secure cookie attributes, CSRF, login
  rate limiting and security audit.
- FastAPI modular monolith, Jinja2, central `policy`, PostgreSQL, Alembic,
  Uvicorn + systemd + nginx, without Docker or Compose.
- Synthetic data and automated permission, masking, migration and persistence
  verification.

### Non-goals

- real elderly-care-institution data or any `SPEC-0013` import;
- external AI/model calls, paid services or third-party business integration;
- AI follow-up coaching, search, opportunity discovery, bulk import, permanent
  erasure or production backup implementation;
- administrator full-detail exception UI, ownership transfer, management
  dashboards, corrections, withdrawals, archive or duplicate handling;
- replacing, modifying or restarting another server project;
- DNS, TLS certificate/private-key changes or live release without separate
  authorization;
- commits, pushes or destructive cleanup without explicit authorization.

## Owned files and resources

Ownership becomes effective only after this task is explicitly authorized and
an implementation owner is recorded.

### Repository paths

- `pyproject.toml`, `alembic.ini`, `.env.example`;
- `.gitignore` only for task-generated local artifacts;
- `src/crm/`, `migrations/`, `templates/`, `tests/`;
- `scripts/dev-run.ps1`, `scripts/dev-test.ps1`, `scripts/server-preflight.ps1`;
- `deploy/` for non-secret systemd/nginx/release templates only;
- `docs/evidence/TASK-0001-*`;
- this task card for status and evidence updates.

`docker-compose.dev.yml`, Dockerfiles and container scripts are forbidden.
Approved SPECs, legacy snapshots and other governance files are not owned.

### Server resources

W1 created the `anqiao-crm` non-login identity and empty
`/opt/anqiao-crm/{releases,shared}` tree. W2 installed the Ubuntu PostgreSQL 16.14
server/client packages and its localhost-only `16/main` cluster. The shared
PostgreSQL service is not permission to create a project database or role.

Database `anqiao_crm`, role `anqiao_crm_app` and the restricted runtime file now
exist under `DEC-0048`; the database is empty and has no permanent user object.
Application virtual environment, loopback port, application systemd unit,
release and candidate nginx site remain absent and unauthorized. W3 evidence is
in `docs/evidence/TASK-0001-W3-database-role.md`.

## Verified preflight evidence

Read-only inspection used the reference project's existing local SSH mechanism.
No credential, private key, password, token or client-auth value was printed,
copied or stored.

- [VERIFIED] Server: Ubuntu 24.04 LTS, Linux x86_64, Python 3.12.3, systemd
  running, nginx 1.24.0 active.
- [VERIFIED] Capacity snapshot: 40 GiB root filesystem, about 18 GiB available;
  3.6 GiB RAM with about 1.8 GiB available; swap exists. This is a snapshot,
  not a capacity guarantee.
- [VERIFIED] Ports observed listening included 22, 80, 443, 3000, 7280 and
  8080. Port selection must be rechecked immediately before any write.
- [VERIFIED] Initial preflight found no PostgreSQL package/unit/listener. W2,
  authorized by `DEC-0047`, installed PostgreSQL 16.14; its `16/main` cluster is
  active/enabled/ready and bound only to localhost on 5432. W3, authorized by
  `DEC-0048`, subsequently created the empty dedicated database, role and
  restricted runtime file without changing that binding.
- [VERIFIED] `crm.aibrain.wiki`, nginx site `crm` and `/home/ubuntu/CRM` are
  already occupied by an existing project. Its nginx shape is static frontend
  plus an `/api/` proxy to an existing service.
- [VERIFIED] Multiple unrelated applications exist under `/opt`, `/var/www` and
  `/home/ubuntu`; their directories, processes, nginx sites and ports are
  protected boundaries.
- [VERIFIED] The reference `经销商赋能培训体系` package is a static HTML release
  with client authentication files. Its deployment scripts demonstrate SSH/
  SFTP and remote-command publication only. They do not prove that its auth or
  application design is suitable for CRM.
- [VERIFIED] `DEC-0045` permits staged replacement of the legacy CRM, but it
  remains untouched until the later separately authorized cutover.

## Assumptions and unknowns

### Assumptions

- [VERIFIED] `DEC-0046` authorizes TASK-0001 and completed W1; `DEC-0047`
  authorizes completed W2; `DEC-0048` authorized completed W3 only. The W4
  migration write was later authorized under `DEC-0053` and re-authorized
  under `DEC-0055`; no server write beyond W4 is authorized.
- [ASSUMPTION] Synthetic fixtures may model roles and organizations but must not
  contain copied real names, contact values or production secrets.
- [ASSUMPTION] Pure engineering choices that do not change business meaning will
  be selected by the implementation owner and documented in evidence.

### Non-blocking technical unknowns until their gates

- PostgreSQL backup mechanics and `SPEC-0011` deletion propagation;
- application loopback port, systemd unit and nginx cutover;
- package versions proven compatible with Python 3.12.3;
- exact rate-limit thresholds and session lifetime, which must be measurable,
  conservative and tested without changing the approved login behavior.

If implementation exposes an unknown that changes approved business behavior,
stop and return the affected SPEC to review.

## Prerequisites and completion gate

### Prerequisites

1. Governance check passes after this revision.
2. `DEC-0045` replacement authority remains active and the old site remains
   untouched until the later cutover gate.
3. The product owner explicitly authorizes revised `TASK-0001`.
4. An implementation owner and exact repository ownership are recorded.
5. Before the first server write, a resource manifest states exact names/paths,
   impact, isolation checks, rollback and immediate product-owner authorization.
6. Each later high-risk server gate obtains its own immediate authorization.

### Completion gate

- all implementation and verification steps below pass with recorded evidence;
- permission matrix and page/API masking consistency tests pass;
- Alembic upgrade and downgrade pass against PostgreSQL;
- application/process restart preserves data and deterministic history order;
- no external model/network business integration is called;
- no other site/process/configuration is changed and pre/post health evidence
  for existing sites matches;
- governance check passes;
- human business/visual acceptance remains separately recorded and is never
  inferred from automated tests.

## Ordered gates and steps

| ID | Prerequisite | Action and output | Verification | Status |
|---|---|---|---|---|
| P0 | Governance sources read | Read-only repository/reference/server preflight | Evidence in this task; no server mutation | PASSED |
| G0 | P0 | Revise decision, ADR and task to remove Docker | Governance check | PASSED |
| G1 | G0 | Resolve existing `crm.aibrain.wiki` and `/home/ubuntu/CRM` ownership | `DEC-0045` | PASSED |
| G2 | G1 | Request revised `TASK-0001` authorization and W1 isolated-base-resource authorization together | `DEC-0046` | PASSED |
| S1 | G2 task authorization | Create native Python project skeleton and exact dependency lock; AI adapter disabled | compile/import smoke and targeted tests | PASSED |
| W1 | G2 first-write authorization | Create only approved isolated account and empty deployment directories; do not install software or touch existing CRM/nginx | existence/ownership checks; existing-site config/checksums/responses unchanged | PASSED |
| G3 | W1 | Present PostgreSQL installation impact and rollback | Immediate installation authorization; `DEC-0047` | PASSED |
| W2 | G3 | Install pinned native PostgreSQL packages only if absent | package/service/version evidence; unrelated services unchanged | PASSED |
| G4 | W2 | Present dedicated DB/role creation impact and rollback | Immediate DB-create authorization; `DEC-0048` | PASSED |
| W3 | G4 | Create least-privilege database and role; secrets runtime-only | privilege/connection checks without printing secrets | PASSED |
| S2 | S1 + W3 | Implement config, domain, identity, persistence and initial migration | unit/integration tests; Alembic upgrade/downgrade | PASSED |
| S3 | S2 | Implement central policy projection, masking and concise progress | full role/field matrix and fail-closed tests | PASSED |
| R1 | S3 | Independent foundation review | SPEC mapping, test effectiveness, scope review | PASSED |
| S4 | R1 passed | Implement commands/queries and server-side login/session/security controls | owner/write, disabled-session, CSRF, rate-limit and audit tests | PARTIAL (local 32 passed/1 gated skip INDEPENDENTLY REPRODUCED 2026-08-03; the `crm_test` CRUD/owner-write leg is [UNVERIFIED — single source], SSH forward terminated with no retained log, and its authorization is unrecorded — see audit P1-A/P1-B; evidence: `docs/evidence/TASK-0001-S6-gate-dependencies.md` + audit `docs/evidence/TASK-0001-S6-GATE-DEPENDENCIES-AUDIT.md`) |
| S5 | S4 | Implement Jinja2 pages and JSON API through same application/policy layer | four-step flow and page/API consistency tests | IMPLEMENTED — GATE REFUSED 2026-08-03 per `DEC-0072`; P0 FIXED 2026-08-03; **VACUOUS PARITY FIXED 2026-08-03, RESUBMITTED** per `DEC-0073`. P0 repair accepted: both `followups.py` creation endpoints load the institution and compare `owner_user_id`, deny with 404 (no existence leakage, line 338); `ContactDetail.name_masked`→`name`; docstring rewritten; non-owner fixture + 3 effective tests (404 + no-write + masking parity); docstring drops search/export; 422 test renamed. DEC-0073 repair: parity regex at `test_s5_pages_api_parity.py:424` corrected from `r"1[3-9]\\d{9}"` (compiled to literal backslash+d, matched nothing) to `r"1[3-9]\d{9}"` matching line 595; the page→API direction is **proven live**: temporarily rendering `13911112222` on the page (API withholds it) made the test FAIL with `page leaks phones not in API: {'13911112222'}`; injection removed, 9/9 pass again — both outputs recorded in evidence §8.2. Scope made exact: page→API checks phone numbers only; API→page checks activity bodies; evidence §7.4.3 corrected accordingly. Verification: `dev-test.ps1` → `132 passed, 28 skipped`; S5 suite 9/9; governance `[PASS]`. **PASSED 2026-08-03 per `DEC-0074`**, local and synthetic only: the coordinator did not rely on the executor's reported failure output — it independently injected a page-only phone number, observed `1 failed`, restored from a byte copy, re-ran `9 passed`, and confirmed zero mutation residue. The narrowed page→API phone-only scope was verified correct: `main.py:288` and `institutions.py:186-199` both render/return the same `get_institution_detail` result, so no flow exists by which the page could carry an activity body the API withholds. Evidence: `docs/evidence/TASK-0001-S5-web-layer.md` §7 + §8 + `DEC-0073` + `DEC-0074` |
| S6 | S5 | Full synthetic test, restart persistence and no-external-call verification | `scripts/dev-test.ps1` and evidence | **ACCEPTED 2026-08-03 per `DEC-0079`** (history retained below. Dependencies done 2026-08-02: `dev-test.ps1` exists and runs, test_s6 collection repaired — both INDEPENDENTLY REPRODUCED 2026-08-03 (119 passed/28 skipped; 19 gated tests collected). The 25 gated `crm_test` passes are [UNVERIFIED — single source]. No-external-call test rewritten 2026-08-03 to assert positively (was status-code-only); NOT executed against a real database. **LOCAL LEG PASSED 2026-08-03 per `DEC-0075`** (first submission, no defect found): `tests/test_s6_local_no_external_calls.py` is a new ungated local mirror of the no-external-call guard using the S5 in-memory fixture, running the SPEC-0001 four-step flow through the real request path with no database; the gated file is untouched. Coordinator reproduced `133 passed, 28 skipped` (baseline 132), governance `[PASS]`, and did not rely on the executor's reported failure — it independently injected `create_connection(("192.0.2.7", 443))` and observed `AssertionError: Unexpected non-loopback socket attempts`, then restored from a byte copy to the same SHA-256 `D3AA4ADC…ACD63E` with zero residue. Limitations verified accurate: records `connect`/`create_connection` only, so pure DNS (`getaddrinfo`, absent from all source paths) and C-level libpq traffic are uncovered. **Real-database remainder NOT ACCEPTED**, all `[NOT VERIFIED]`: the gated 19-test run (the two tests rewritten 2026-08-03 have never executed anywhere), restart persistence, and the `repositories.py:322-385` double-write (no test constructs a real repository — `FollowUpActivityRepository(` has 0 hits in `tests/`). The combined request in `DEC-0075` was APPROVED and recorded as `DEC-0076`; the round ran 2026-08-03. **Result per `DEC-0077`: 3 of 4 elements PASSED with runtime evidence** — fail-closed isolation (`current_database() → crm_test` before any write), restart persistence (uvicorn pid 31916 → stop → pid 35560, `PERSISTED/ORDER_OK/BODIES_OK` all True), and the double-write with a genuine three-phase DEC-0073 point 4 fail-proof (intact `both: True` → revision deleted `both: False` → restored `both: True`). `test_no_external_network_calls` passed its first-ever real execution. **S6 NOT formally accepted**: the gated suite returned `18 passed, 1 failed` — `test_api_response_time_within_transport_budget` failed reproducibly at 9.60s/9.11s against 5s. Root cause confirmed independently from source: `SessionLocal()` (`database.py:27-42`) builds a new `Settings()` and engine on **every** call while the cached `get_session_factory()` (lines 16-23) is never called anywhere in `src/`; the coordinator re-counted the blast radius as **22 call sites across 6 files** (executor reported only `repositories.py`'s 10). Per `DEC-0077` the failure is a forward-measurement artifact, not proof of a production defect — a cold connect costs ~1.3s through the SSH forward versus milliseconds on the server's own loopback — so the response-time element is `[UNKNOWN]`, not failed-in-production. Threshold relaxation is REFUSED as the false-green pattern. The repair was then AUTHORIZED by `DEC-0078` (scoped to `database.py` only, 22 call sites untouched, threshold relaxation refused). **The repair round then returned `19 passed, 0 failed` on `crm_test` and `DEC-0079` ACCEPTS S6 and the repair.** Coordinator independent verification: the pre-repair `database.py` was recovered from `deploy_source.tar.gz` (2026-07-29) because the repository has zero commits and no diff exists, proving `pool_pre_ping=True` predates the repair (DEC-0078 point 7 held), `build_engine`/`build_session_factory` byte-identical, `hashlib` the only new import; 22 call sites re-counted untouched; the 5 s threshold at line 458 byte-unchanged so the pass comes from real speedup (0.594/0.797/0.763 s); the DEC-0073 point 4 fail-proof was **rebuilt** because the executor's script was not retained — repaired module gives `REUSE_SAME_CONFIG: True` + `REBUILD_ON_CHANGE: True` on all six dimensions, pre-repair gives `False` on all six, and `SessionLocal ENGINE_REUSED` is `True` vs `False`; local gate `133 passed, 28 skipped` 0 failed via both `pytest tests/ -q` and `dev-test.ps1`, governance `[PASS]`, `COMPILE_OK`, 19 gated collected; credential residue checked **by value** — the 64-char password returns `PASSWORD_RESIDUE_COUNT: 0` repository-wide. **The acceptance carries one labelled limit**: mtimes place the gated log at 13:34:16 and `database.py` at 13:48:18, so the 19-pass belongs to the intermediate `str(settings.database_url)`-key version and the current `_cache_key()` tuple version has never run against `crm_test`; the coordinator measured `SINGLE_CONFIG_BEHAVIOR_IDENTICAL: True` (both forms give `CACHE_ENTRIES: 1`, `ONE_ENGINE_ACROSS_4_RESOLUTIONS: True`) with the password dimension as the sole difference, so the same-result judgement is `[INFERENCE]`, chosen by the product owner as option A over a second real-database round. Response time does not gate S6 (this row names only full synthetic test, restart persistence and no-external-call; `SPEC-0001:118`/R-017 defers the target to AI coaching; the test self-describes as a liveness check) and the server-loopback measurement stays deferred per `DEC-0077` point 6. `DEC-0079` point 4 requires an evidence-wording correction, not a re-run. Evidence: `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md` + its retained `.log` + `docs/evidence/TASK-0001-S6-realdb-verification.md` + `docs/evidence/TASK-0001-S6-local-no-external-call.md` + `docs/evidence/TASK-0001-S6-gate-dependencies.md` + audit `docs/evidence/TASK-0001-S6-GATE-DEPENDENCIES-AUDIT.md` + `DEC-0075`/`DEC-0076`/`DEC-0077`/`DEC-0078`/`DEC-0079`) |
| G5 | S6 | Present migration impact and downgrade/restore plan | Immediate migration authorization | **AUTHORIZED 2026-08-08 per DEC-0112** (W4 已执行，G5 门控正式关闭) |
| W4 | G5 + immediate authorization | Apply migration to dedicated empty database and seed synthetic users/data only | schema/version/seed evidence; downgrade rehearsal as approved | EXECUTED under DEC-0053/DEC-0055; formal acceptance NOT VERIFIED |
| G6 | W4 | Present release/systemd/nginx resources, existing-site isolation and rollback | Immediate release authorization | ACCEPTED 2026-08-12 for the DEC-0127 local documentation-planning scope only (independent review: `docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`; plan: `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md`); W5/G7/V1/R2 remain PENDING and no production action has occurred |
| W5 | G6 | Snapshot legacy CRM, publish isolated release/virtualenv/systemd unit, then replace only the authorized `crm` nginx site | config tests, health, rollback rehearsal; no other site impact | **TASK-0027 EXECUTED 2026-08-12 — BLOCKED at remote precondition 6 before any production mutation** (runtime venv `pip check` failed: `fastapi 0.141.0` requires `starlette>=0.46.0`, runtime has `starlette 0.44.0`, payload pins `fastapi==0.136.3`). Local release preparation of committed payload `59101b80b6420155bf8aec26b14ea7800979db86` completed (archive SHA-256 `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`; extracted-tree compile OK; Alembic head `0005_opportunity_reminders_ai_reasoning` only); no backup, transfer, migration, restart, or liveness step ran; no production write occurred. TASK-0024 remains unaccepted incident history; TASK-0026 remains separate no-log preflight evidence. nginx/DNS/TLS edits, logs, credential inspection, database restore/downgrade, G7, full V1, and R2 are not authorized. Awaiting Codex independent review of TASK-0027. |
| G7 | W5 | Separate DNS/TLS request if still required | Explicit DNS/TLS authorization | PENDING |
| V1 | Relevant deployment gates | Verify process, DB/migration, unauthenticated denial, owner/other-user masking, page/API parity, four-step flow, restart persistence and other-site health | Deployment evidence by category | PENDING |
| R2 | V1 | Independent final review and product-owner business/visual acceptance | Findings reconciled; human acceptance recorded separately | PENDING |

No gate authorizes a later gate. A failed check stops advancement and records
`BLOCKED`; it does not lower acceptance criteria.

## G2 / W1 resource manifest

The following is the complete proposed first server write. It is deliberately
smaller than installation, database creation or cutover.

| Resource | Current read-only state | Proposed W1 action | Explicitly not done in W1 |
|---|---|---|---|
| OS account `anqiao-crm` | free | create a non-login system account/group | no service is started |
| `/opt/anqiao-crm` | free | create empty `releases/` and `shared/` directories, owned by that account | no code or virtualenv is installed |
| `/home/ubuntu/CRM` | authorized for later replacement by `DEC-0045` | untouched | no copy, rename, delete or overwrite |
| nginx site `crm` | existing authorized legacy cutover target | untouched | no config, certificate, DNS or reload change |
| `anqiao-crm.service` | free | untouched | no systemd unit or daemon reload |
| port `8200` | free at read-only check | untouched | no listener or firewall change |
| PostgreSQL database/role | PostgreSQL absent/unverified | untouched | no package, database, role or secret creation |

W1 impact is one disabled service identity and empty isolated directories; no
expected user-visible interruption. Its rollback is removal of that still-unused
account and empty `/opt/anqiao-crm` tree after explicit confirmation. It does
not touch the legacy CRM or any other project.

W1 verification captures before/after directory ownership, confirms the account
has no login shell, reruns `nginx -t`, compares the legacy CRM nginx/file
checksums and confirms its observed HTTP response codes did not change. A
pre-existing `500`/`502` is recorded as unchanged, never reported as healthy.

## Required server-write request format

Immediately before each high-risk write, the AI must report:

1. exact resources to create/change and resources explicitly untouched;
2. user-visible and operational impact, including expected interruption;
3. pre-change evidence and isolation checks;
4. rollback steps and what data/configuration they restore;
5. validation that proves both CRM health and no regression to other projects;
6. one explicit yes/no authorization request for that gate.

Secrets and secret-bearing file contents are never included.

## Acceptance and verification matrix

- **Core data**: institution/contact/activity required and optional fields,
  idempotent submission, deterministic `occurred_at DESC, recorded_at DESC, id
  DESC` history and restart persistence.
- **Authorization**: unauthenticated/disabled/unassigned denial without existence
  leakage; owner write; other business user read-only; default deny.
- **Masking**: every `SPEC-0001` field group across owner, other business user
  and unauthorized viewer; missing mappings and projection failures hide data.
- **Authentication**: Argon2id storage, no plaintext password logging, server-side
  sessions, cookie flags, CSRF, rate limiting, security audit and immediate
  invalidation on disable/revocation.
- **Migration**: empty PostgreSQL upgrade to head and downgrade to base; migration
  failure does not report success.
- **Cross-path**: Jinja2 page and JSON API expose equivalent authorized fields
  through the same application/policy functions.
- **Synthetic-only**: fixtures are obviously synthetic; real-data/import paths
  are absent or hard-disabled.
- **External isolation**: AI adapter disabled; no paid service or external model;
  no other server directory, process, database, nginx site or domain modified.

### Verification commands after implementation

```powershell
python -m compileall src tests
python -m pytest -q
powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
```

Server verification commands are written only after exact approved resource
names exist. They must be read-only except within the explicitly authorized
gate and must never echo environment values or secrets.

## Risks and rollback

- **Legacy-site replacement**: `DEC-0045` authorizes a future replacement, not
  destructive change. Mitigation: isolated W1 resources first, protected legacy
  snapshot before W5, atomic activation and separate cleanup authorization.
- **Permission/masking drift**: all reads go through one policy projection;
  unmapped/error states hide data; cross-path tests enforce parity.
- **Native package/service conflict**: package installation is its own gate;
  inventory and existing-site health are captured before and after.
- **Migration failure**: dedicated empty database, upgrade/downgrade evidence and
  predeclared recovery; never run against another project's database.
- **Secret exposure**: secrets remain outside repository/logs/replies; tests use
  placeholders and assert redaction.
- **Release failure**: isolated versioned release and reversible activation;
  rollback restores prior CRM release without touching other projects.

No destructive cleanup is implied by rollback. Database deletion, package
removal, release removal or credential rotation requires its own confirmation.

## Evidence and result

- Status: ACTIVE; S1 PASSED; W1 PASSED; G3 PASSED; W2 PASSED; G4 PASSED; W3
  PASSED; S2 PASSED; S3 PASSED; GR1 PASSED; GR2 PASSED; R1 PASSED;
  S4 PARTIAL (per DEC-0070/DEC-0071: local legs reproduced 2026-08-03, `crm_test`
  leg single-source/unreproducible; this historical block is superseded by
  lines 4 and 282-284); S5 IMPLEMENTED — GATE REFUSED per `DEC-0072`
  (P0 missing owner-write in `followups.py`; entrypoint repair accepted —
  `docs/evidence/TASK-0001-S5-web-layer.md`);
  S6 PARTIAL (dependencies done 2026-08-02, formal acceptance incl. restart
  persistence pending S5); G5 PENDING; W4 EXECUTED under DEC-0053/DEC-0055,
  formal acceptance NOT VERIFIED.
- Commands actually run: repository inventory, Git status, approval-hash check,
  governance check, reference package structural inspection and redacted
  read-only server inventory; S1 isolated-environment install, compile, import,
  dependency and pytest checks; W1 create/rollback/retry/isolation checks; G3
  read-only package simulation; W2 native package installation, failure
  containment and final package/service/network/isolation validation; W3
  database/role/runtime-file creation, rollback probe, connection test and
  independent isolation recheck; S2 compile, full local test suite, dependency
  check, offline Alembic SQL generation and isolated local PostgreSQL
  `upgrade -> downgrade -> upgrade` plus `alembic check`; S3 full role/field
  matrix, default-deny, administrator-exception and management-scope tests;
  GR1 controlled-SSH preflight, exact-table cleanup, credential rotation,
  quarantine and post-state checks; GR2 parent-directory traversal repair plus
  service-identity runtime-file and database checks. Evidence:
  `docs/evidence/TASK-0001-GR1-w3-recovery.md` and
  `docs/evidence/TASK-0001-GR2-permission-repair.md`; S4R local
  authentication repair pytest runs and governance check, evidence:
  `docs/evidence/TASK-0001-S4R-local-auth-repair.md`.
- Result artifacts: governance updates; exact-pinned `pyproject.toml`; six module
  packages; AI-disabled boundary; module-boundary tests; W1 isolated server base;
  W2 PostgreSQL 16.14 installation; W3 empty dedicated database, least-privilege
  login role and restricted runtime file; S2 configuration/domain/persistence
  foundation and initial migration; S3 central policy projection and masking;
  GR1 empty Tencent database and root-only quarantine; GR2 repaired runtime
  access. Later application files are not accepted evidence of completed gates
  until R1 and their specified tests pass.
- Not verified: the remaining S4 command/query owner-write scope and the
  unaccepted S5-S6 application artifacts (including the pre-existing
  S5-era `main.py` breakage); business workflow, authentication
  endpoint behavior, page/API parity, Tencent-server migration, deployment,
  DNS/TLS, backup/restore and human acceptance.
- **Current phase per TASK-0006 reconciliation (updated 2026-08-02)**:
  Foundation work (S1-S3+R1) complete. Local auth repair (partial S4)
  documented. W4 was authorized under `DEC-0053`, re-authorized under
  `DEC-0055`, and executed; its formal acceptance remains NOT VERIFIED.
  S5/S6 accepted gate status remains NOT VERIFIED. Implementation ownership
  succeeded to the ZCode agent per `DEC-0067` (2026-08-02); mainline gate work
  resumes after TASK-0007 acceptance per `DEC-0067` sequencing. Current online
  database/service state is UNKNOWN. Release, nginx/TLS/DNS, and legacy cutover
  remain unauthorized. See TAKEOVER REVIEW for P0/P1 runtime defects that block
  S5 acceptance.
