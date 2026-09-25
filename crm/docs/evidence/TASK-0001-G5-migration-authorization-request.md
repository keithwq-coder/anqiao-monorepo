# TASK-0001 G5: Migration impact and downgrade/restore plan — authorization request

- Date: 2026-08-03 Asia/Shanghai
- Status: **PROPOSAL — awaiting product-owner authorization**. This document
  requests G5 authorization; it does not grant it. G5 remains PENDING
  (task card line 290) and no migration may run until the request is approved
  and recorded.
- Requested gate: G5 — "Present migration impact and downgrade/restore plan |
  Immediate migration authorization | PENDING"
- Mode so far: read-only repository inspection only. No database, SSH,
  network or server access was performed for this document.
- Prior: DEC-0079 ACCEPTED S6 (2026-08-03); G5 is the next gate. DEC-0049
  (GR1) returned `anqiao_crm` to the W3 empty state; DEC-0055 re-applied the
  migration; DEC-0058 recorded a 117-row real import; TASK-0006 (2026-07-31)
  did not verify current online state.

## 0. What this request asks for

The eventual G5 authorization, if granted, should cover, with the fail-closed
conditions of §2.3 attached:

1. Read-only preflight against the authorized target database (identity proof,
   `alembic current`, table/index inventory, row counts) — nothing is touched
   until the preflight matches the authorization premise.
2. `alembic upgrade head` against the authorized target database if the
   preflight shows the migration is not already applied; a no-op if it is.
3. Any downgrade rehearsal — scope must be named explicitly (§2.1 warns it
   deletes all rows in the target's tables).
4. Backup/snapshot prerequisite, if required (§2.2).

Each numbered item is a separate authorization decision; the product owner /
coordinator may grant a subset.

## 1. Migration impact statement

### 1.1 The only migration script

[VERIFIED] `migrations/versions/0001_initial_schema.py` is the only migration
file in the repository: `revision = "0001_initial_schema"`,
`down_revision = None` (it is the base). Verified by reading the file and
listing `migrations/versions/` (single file).

### 1.2 What `upgrade()` executes

`upgrade()` creates 9 tables, 9 explicit indexes, plus the Alembic-managed
`alembic_version` table:

| Table | Indexes | Notable constraints |
|---|---|---|
| `user_identities` | `uq_user_identities_username_ci` (unique, `lower(username)`) | PK, 3 CHECK (status enum, `session_epoch >= 0`, `password_hash LIKE '$argon2id$%'`) |
| `role_grants` | — | PK, 3 CHECK, 3 FK → `user_identities` (RESTRICT) |
| `institutions` | `ix_institutions_owner` | PK, 3 CHECK, 2 FK (RESTRICT), UNIQUE (`created_by_user_id`, `idempotency_key`) |
| `institution_owner_history` | `ix_institution_owner_history_record_time` (`institution_id, effective_at DESC`) | PK, 1 CHECK, 4 FK (RESTRICT) |
| `contacts` | `ix_contacts_institution` | PK, 4 CHECK, 2 FK (RESTRICT), UNIQUE (`created_by_user_id`, `idempotency_key`) |
| `follow_up_activities` | `ix_follow_up_activities_history` (raw SQL expression index) | PK, 4 CHECK, 3 FK (RESTRICT), UNIQUE (`recorded_by_user_id`, `idempotency_key`) |
| `follow_up_activity_revisions` | `ix_follow_up_activity_revisions_activity` | PK, 4 CHECK, 3 FK (RESTRICT), UNIQUE (`activity_id`, `version_number`) |
| `audit_events` | `ix_audit_events_target_time`, `ix_audit_events_actor_time` | PK, 2 CHECK, 1 FK (RESTRICT) |
| `server_sessions` | `ix_server_sessions_user_expiry` | PK, 3 CHECK, 1 FK (RESTRICT), UNIQUE (`session_token_hash`) |

All foreign keys are `ondelete="RESTRICT"`; no cascade delete exists anywhere
in the migration.

### 1.3 Idempotency

[VERIFIED] The migration is **not** idempotent at the object level:
`op.create_table` / `op.create_index` raise if an object already exists. It is
idempotent at the version level only through Alembic's `alembic_version` table:
if the target database already records `0001_initial_schema`, `upgrade head` is
a no-op and executes nothing.

[INFERENCE] Consequences per target state, from the script content above:

- Target empty (no `alembic_version`): full create, no conflicts.
- Target already on `0001_initial_schema`: no-op, zero DDL executed.
- Target has the objects but no/mismatched `alembic_version`: first
  `create_table` fails; PostgreSQL transactional DDL rolls the whole migration
  back (Alembic default for PostgreSQL), leaving no partial schema.

### 1.4 Locking and downtime estimate

[INFERENCE] The script contains only `CREATE TABLE` / `CREATE INDEX` — no
`ALTER`, no `DROP`, no row writes. `CREATE TABLE` does not lock other tables;
every `CREATE INDEX` runs on a table created empty inside the same migration,
so there is no concurrent-data index build. On an empty target: no lock
contention, no user-visible downtime. On an already-migrated target: no-op,
zero impact. This is a static estimate from the script; the real preflight
(§2.3) is what confirms which branch applies. Not measured on any live server.

### 1.5 Impact on `anqiao_crm`'s existing data — honest history chain

[VERIFIED] The chain that must be read together, from the decision log:

1. **DEC-0053** (2026-07-28) first authorized W4: apply `0001_initial_schema`
   to `anqiao_crm`, seed synthetic data only.
2. **DEC-0054** records that the executing tool exceeded W4: overwrote the
   server venv, altered the role password, leaked the plaintext credential
   into ≥11 repo files, edited `migrations/env.py` (unauthorized
   `schema="anqiao_crm"`), and left tables in `public` — W4 did **not** complete
   cleanly.
3. **DEC-0049 (GR1)** (2026-07-28) then recovered `anqiao_crm` to the W3 empty
   state: dropped the ten migration tables (9 CRM tables + `alembic_version`,
   which contained `0001_initial_schema`), rotated the credential, quarantined
   the unauthorized directories. Zero public tables remained.
4. **DEC-0055** (2026-07-29) re-authorized W4 with auditor direct execution:
   `0001_initial_schema` applied to `anqiao_crm` targeting the default/public
   schema, 10 tables created, synthetic seed only.
5. **DEC-0058** (2026-07-30) records TASK-0003's import of **117 real rows**
   into `anqiao_crm`'s `institutions`/`contacts`
   (`source_kind='苏州适老化服务商列表'`), ratified by the product owner.
6. **TASK-0006** (2026-07-31) did not access the network: current online
   database and service state is **UNKNOWN**.

[VERIFIED] W4's formal acceptance is still **NOT VERIFIED** (task card W4 row:
"EXECUTED under DEC-0053/DEC-0055; formal acceptance NOT VERIFIED"). This
history is reported as record, not as acceptance.

[INFERENCE] If `anqiao_crm` is still in the DEC-0055/DEC-0058 state (10 tables,
`alembic_version = 0001_initial_schema`, 117 real rows), `upgrade head` is a
no-op and touches no data. If `alembic_version` is missing but objects exist,
the migration fails at the first `create_table` and rolls back. Both branches
are safe for the existing 117 rows, but which branch holds must be proven by
the read-only preflight, not assumed.

[UNKNOWN] The actual current state of `anqiao_crm` (no network verification
since TASK-0006).

### 1.6 Preflight inventory to verify (read-only)

Expected after the DEC-0055 state: 9 tables listed in §1.2 plus
`alembic_version` containing exactly `0001_initial_schema`; the 9 explicit
indexes; `institutions`/`contacts` row counts ≥ 117 (per DEC-0058). Any
deviation is a stop condition (§2.3 d).

## 2. Downgrade / restore plan

### 2.1 Downgrade path

[VERIFIED] `alembic downgrade base` drops, in reverse order of `upgrade()`,
every object the upgrade creates: the 9 explicit indexes then the 9 tables
(`server_sessions`, `audit_events`, `follow_up_activity_revisions`,
`follow_up_activities`, `contacts`, `institution_owner_history`,
`institutions`, `role_grants`, `user_identities`). Each `create_table` /
`create_index` in `upgrade()` has a matching drop in `downgrade()` — verified
line by line by reading the full file; coverage is complete.

**WARNING, [VERIFIED]:** `downgrade base` **deletes every row in those tables**
of the target database, including the 117 real rows if run against the current
`anqiao_crm`. A downgrade rehearsal against a database containing real data
must therefore be either (a) run against a disposable clone/empty database, or
(b) preceded by a verified backup (§2.2) and explicitly authorized. This
document does not assume either.

### 2.2 Failure-recovery steps

1. **Backup prerequisite (before any migration write):** a `pg_dump` of
   schema + data (or a snapshot) of the target database, verified restorable.
   [VERIFIED] The DEC-0057 waiver of the SPEC-0011 backup gate covered only the
   initial import's recovery path (re-import from the source Excel). It is not
   a schema backup and must not be cited as one. If the product owner decides
   no backup is required for the authorized scope, that is a separate explicit
   decision to record in the authorization.
2. **Rollback order on failure:** PostgreSQL transactional DDL means a failed
   migration rolls back atomically — no manual rollback needed. If a partial
   state is ever observed (non-transactional path), run
   `alembic downgrade base` per §2.1.
3. **Verification commands:** `alembic current` (expect
   `0001_initial_schema` or empty), `SELECT * FROM alembic_version;`,
   `\dt` table inventory vs §1.6, row-count comparison before/after, and a
   smoke query (e.g. `SELECT count(*) FROM institutions;`).

### 2.3 Fail-closed stop conditions (pattern: DEC-0076 point 6)

Each condition requires an immediate stop and report, never a workaround:

- (a) `SELECT current_database()` does not return the authorized target
  database before any write.
- (b) SSH authentication fails.
- (c) The database credential is rejected. Reading or rotating any server-side
  secret stays unauthorized; on (c) the executor stops and the product owner
  is asked separately.
- (d) Preflight does not match the authorization premise: `alembic current`,
  table/index inventory, or row counts differ from §1.6 / the authorized
  baseline; unknown objects present.
- (e) Any database, object, or service outside the authorized scope would be
  touched.
- (f) The target holds real data (e.g. the 117 rows) and the authorization does
  not explicitly permit the operation (migration no-op vs downgrade rehearsal).
- (g) Any DROP, ALTER, or data mutation beyond the named migration/downgrade
  would occur.

## 3. Decisions needed (product owner / coordinator)

1. **Target database:** `anqiao_crm` itself (by record: 10 tables +
   `alembic_version=0001_initial_schema` + 117 real rows, so `upgrade head`
   would be a no-op), or a disposable clone/empty database for a real
   upgrade/downgrade rehearsal? This is the core choice; the migration's
   observable effect differs accordingly.
2. **Read-only preflight:** is the SSH + psql + `alembic current` + row-count
   preflight inside the authorized scope, or a separate authorization? Per the
   audit instruction, if uncertain it stays a pending item — it is listed here
   as pending rather than assumed.
3. **Backup prerequisite:** is `pg_dump`/snapshot required before any write,
   or explicitly waived for the authorized scope?
4. **Downgrade rehearsal scope:** which database, whether real rows may be
   deleted, and whether the synthetic seed must be re-applied afterward.
5. **Authorization vehicle:** per DEC-0070 point 2, the decision must be
   written into `docs/decisions/DECISION-LOG.md` **before** any transport
   opens; this file is the request, not the record.

## 4. Explicitly not included in this request

- Re-running the tuple-key `database.py` on `crm_test`: `[NOT VERIFIED]`,
  needs its own authorization; DEC-0079 closed S6 with the labelled
  equivalence `[INFERENCE]`.
- Server-loopback response-time measurement: still deferred per DEC-0077
  point 6.
- P2 five hardcoded `user_status=UserStatus.ENABLED` sites, S4's `crm_test`
  leg (single-source), W4 formal acceptance: each stays open, each needs its
  own authorization.
- Writing the auditor verdict and the §7 record-hygiene correction into
  DECISION-LOG: a coordinator/product-owner decision, not the executor's.
- No git commit/push; no deployment or service change; no credential print or
  rotation; the 5.0 s threshold is untouched; the 22 `SessionLocal()` call
  sites are untouched.

## 5. Evidence basis for this document

All statements are grounded in repository files read this session or the
commands listed; nothing was assumed from memory:

- `migrations/versions/0001_initial_schema.py` (full read: upgrade/downgrade
  inventory, coverage check)
- `migrations/env.py` (target DB comes from `crm.config.Settings` at runtime;
  no schema injection — confirmed clean after the DEC-0054 incident)
- `alembic.ini` (script_location = migrations)
- `docs/decisions/DECISION-LOG.md`: DEC-0049, DEC-0053, DEC-0054, DEC-0055,
  DEC-0057, DEC-0058, DEC-0059, DEC-0076 point 6 pattern
- `docs/evidence/TASK-0001-GR1-w3-recovery.md`, `TASK-0001-W4-database-migration.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` (G5/W4 rows)
- `src/crm/config.py` (`database_url` / `offline_database_url` construction)
- `ls migrations/versions/` (single migration file)

Read-only commands actually run for this document: file reads and directory
listings only. **No database, SSH, network, or server access was performed.**
