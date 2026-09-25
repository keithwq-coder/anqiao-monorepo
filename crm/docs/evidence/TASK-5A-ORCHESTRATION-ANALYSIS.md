# TASK-5A orchestration analysis and corrected sequencing

- Record type: coordinator analysis (no new authority is created by this file)
- Scope: the TASK-5A blocker root cause, and the sequencing consequences for
  TASK-0007 and the TASK-0001 mainline gates S5/S6
- Coordinator: ZCode session, runtime model identifier
  `98ea8b3a-ff90-4106-99ba-97f58f6959e7/claude-opus-5` (recorded per `DEC-0066`;
  never a gate)
- Date: 2026-08-02
- Basis: `DEC-0067`, `DEC-0068`, `docs/evidence/TASK-5A-verification.md`,
  repository inspection recorded below
- Authority: none. `AGENTS.md` section 2 authority order is unchanged. This
  file records verified facts and a `[PROPOSAL]` sequence; it authorizes
  nothing.

## 1. Why this record exists

The bounded TASK-5A executor stopped fail-closed at preflight. The coordinator
independently reproduced that result and then inspected what the repository
already records about server access. That inspection produced three facts that
change task planning, so they are recorded here rather than left in session
context.

## 2. Verified findings

### F1 — The production PostgreSQL is loopback-bound by design, and that
binding was verified as a passing gate result

- [VERIFIED] `docs/evidence/TASK-0001-W2-postgresql-install.md:19-20` and
  line 47: `listen_addresses=localhost`; only `127.0.0.1:5432` observed;
  recorded as `network exposure | PASS`.
- [VERIFIED] `docs/evidence/TASK-0001-W3-database-role.md:49`:
  `listen_addresses` remained `localhost`; no public port 5432 listener
  appeared.
- [VERIFIED] `docs/evidence/TASK-0001-G4-database-role-proposal.md:11,36`: the
  authorized boundary explicitly forbade changing `postgresql.conf`,
  `pg_hba.conf`, systemd, firewall, or any listener.

The database port is not merely unexposed; its non-exposure is an accepted
security property of three passed gates.

### F2 — `DEC-0068`'s selected option was internally unsatisfiable

`DEC-0068` point 1 authorized network connectivity from this machine to the
production PostgreSQL server port, while point 2 preserved `DEC-0067` point 5's
prohibition on server host/SSH access
([VERIFIED] `docs/decisions/DECISION-LOG.md:2765-2771`).

Given F1, no combination of those two constraints can succeed: the only
transport that reaches a loopback-bound port is an on-host session or a
forwarded connection, and both require the prohibited host access. The
executor's fail-closed stop was therefore the correct outcome of a
contradictory instruction, not an execution defect. Responsibility for the
contradiction lies with the coordinator that drafted the option set, and is
recorded here rather than attributed to the executor.

### F3 — SSH to the deployment host is the project's established mechanism,
already authorized, and this machine appears provisioned for it

- [VERIFIED] `DEC-0052` (Status: ACTIVE, `docs/decisions/DECISION-LOG.md:1996`)
  authorizes deploying to the production server and iterating on it in place;
  it does not authorize Alembic migration of the cloud database
  (lines 2027-2029).
- [VERIFIED] `DEC-0053` authorized the W4 migration, and the W4 migration was
  in fact executed over SSH: `scripts/run_w4_migration.py:24-26,37-39` invokes
  `ssh -o StrictHostKeyChecking=no -o BatchMode=yes ubuntu@124.222.212.159`
  wrapping `sudo -u postgres psql`.
- [VERIFIED] The same transport appears in `scripts/check_remote_db.py:8-11`,
  `scripts/check_db_user.py:7-9`, `scripts/w4_deploy.py:75`,
  `scripts/w4_rollback.py:10`, and `deploy_fix_step1.ps1:8,24`.
- [VERIFIED] On this machine, an SSH client is present, `~/.ssh` contains
  private-key files (names only; no key material was read, and no key is named
  here), and `~/.ssh/known_hosts` contains 3 entries matching
  `124.222.212.159`. No connection was attempted.
- [UNKNOWN] Whether key-based authentication to that host currently succeeds.
  Establishing this requires an outward-facing connection and is therefore
  withheld pending explicit product-owner authorization.

`BatchMode=yes` throughout those scripts means the recorded mechanism is
non-interactive key authentication, which is consistent with F3's local
observation but does not by itself prove current validity.

### F4 — Real-database verification is required twice on the mainline, not once

- [VERIFIED] Three test files are gated on `CRM_RUN_POSTGRESQL_TESTS`:
  `tests/test_task0007_postgresql_sessions.py`, `tests/test_s4_authentication.py`,
  and `tests/test_migrations.py`.
- [VERIFIED] Neither `src/` nor `tests/` contains any SQLite usage; there is no
  local database fallback. Persistence is proven either against in-memory fakes
  implementing the repository contracts, or against a real PostgreSQL instance.
- [VERIFIED] The S6 gate in
  `docs/tasks/active/TASK-0001-manual-core-record-slice.md:284` requires
  "Full synthetic test, restart persistence and no-external-call verification"
  with verification via `scripts/dev-test.ps1`.
- [VERIFIED] `scripts/dev-test.ps1` does not exist. The `scripts/` directory
  contains 13 files and none is `dev-test.ps1`.

[INFERENCE] S6's restart-persistence requirement and TASK-0007's unverified
real-PostgreSQL legs depend on the same capability: an isolated PostgreSQL
database that tests may migrate and write. Establishing that capability once
serves both, whereas deferring it moves the identical blocker onto S6.

This corrects an earlier coordinator statement in session that S5 and S6 are
purely local and need no server access. S5 is local; S6's restart-persistence
element is not, absent a local PostgreSQL instance.

## 3. Consequences for the recorded plan

- TASK-0007 remains PARTIAL. Its only unverified element is the
  real-PostgreSQL legs (`docs/evidence/TASK-0007-KIMI-ACCEPTANCE.md`).
- TASK-5A remains ACTIVE / PARTIAL and cannot proceed under `DEC-0068`'s
  current option as written, per F2.
- `DEC-0068` point 4 already designates a new product-owner decision as the
  unblock path. That decision is now narrower than the three options presented
  earlier: the database actions themselves (create empty `crm_test`, migrate
  `crm_test` only, run the gated tests there) are already authorized by
  `DEC-0068` points 1(b)-(d); what is missing is authorization to use SSH as
  the transport for those already-authorized actions.
- [PROPOSAL] The option to widen `listen_addresses` or open the database port
  is withdrawn by the coordinator. It would reverse the accepted security
  property recorded in F1 and is not proposed.

## 4. Proposed sequence (`[PROPOSAL]`, authorizes nothing)

Phase 1 — establish isolated real-database verification capability.
Revised TASK-5A over the established SSH transport: create empty `crm_test`,
apply the repository's own Alembic migrations to `crm_test` only, run the six
gated tests there. `SELECT current_database()` must return `crm_test` before any
write. No production real table is read or written. Gate: six tests pass and the
coordinator independently reproduces the result. Output: TASK-0007 upgraded
PARTIAL -> ACCEPTED, plus a reusable verification path for S6.

Phase 2 — mainline, local. S4 completion (command/query owner-write
acceptance), then S5 (Jinja2 pages and JSON API through the same policy layer),
then S6 (full synthetic test, restart persistence, no-external-call
verification). S6 includes authoring the missing `scripts/dev-test.ps1`, which
its own recorded gate requires; this is gate-required work, not opportunistic
cleanup.

Phase 3 — production, one immediate authorization per gate, never batched.
G5 (migration impact and downgrade/restore plan) -> W4 formal acceptance -> G6
-> W5 (release) -> G7 -> V1 -> R2. Only then does order 4 pass and order 5
(AI coaching) unblock.

## 5. Decision required

One authorization, stated in the smallest form that unblocks Phase 1: may the
coordinator use this machine's existing SSH transport to perform the
`DEC-0068`-authorized `crm_test` actions on the production server?

Until that authorization is recorded, no connection is attempted, TASK-5A stays
PARTIAL, and TASK-0007 stays PARTIAL.

## 6. Not verified

- Current validity of key-based SSH authentication to the deployment host.
- Whether `deploy/.env`'s `DATABASE_PASSWORD` is still current; the credential
  was rotated server-side into `/opt/anqiao-crm/shared/database.env` per
  `docs/evidence/TASK-0001-GR1-w3-recovery.md:27-30`, so the local value may be
  stale. Phase 1 must treat stale credentials as a fail-closed stop condition,
  not as grounds to search for credentials elsewhere.
- Tencent Cloud security-group posture for port 5432. Not established, and not
  needed under the Phase 1 proposal.
- All six gated tests, plus `tests/test_migrations.py`'s round-trip, remain
  unexecuted against any real database.

