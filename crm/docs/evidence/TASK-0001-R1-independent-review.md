# TASK-0001 R1: Independent read-only foundation review

- Date: 2026-07-28 Asia/Shanghai
- Reviewer: Qoder International / user-designated `qwen3.8max-prview` (the
  runtime model identifier is withheld by the reviewer tool's operating rules;
  the product owner accepted the review output on that basis)
- Status: PASSED
- Verdict: `R1 verdict: PASS`
- Authorization: read-only review assigned by
  `docs/handoffs/HANDOFF-20260728-QODER-R1-READONLY-REVIEW.md`; result recorded
  under the product owner's explicit `同意` reply on 2026-07-28 (`DEC-0051`)
- Server write: none
- File writes during review: none; this evidence file was written only after
  the product owner authorized recording the result
- Data boundary: repository files only; no server connection, no secret-bearing
  file read, no test execution, no application start

## Independence declaration

The reviewing session declared that it did not author or edit any S2/S3
foundation code, tests, migrations or policy code, and was therefore eligible
to issue the independent R1 verdict.

## Required reading confirmation

All files in the handoff's required-reading list were loaded and read:
`AGENTS.md`, `QODER.md`, `docs/NOW.md`, `docs/PROJECT.md`,
`docs/specs/INDEX.md`, `docs/specs/SPEC-BASELINE.md`,
`docs/decisions/DECISION-LOG.md` (including `DEC-0044`–`DEC-0050`),
`docs/tasks/TASKS.md`, the active task card, all seven approved SPEC files and
their `.approval.json` files, the S2/S3/GR1/GR2 evidence files,
`src/crm/config.py`, `src/crm/domain/`, `src/crm/persistence/`,
`src/crm/policy/`, `src/crm/ai/`, `migrations/`, `alembic.ini` and the complete
`tests/` directory.

## Review results by contract point

1. **SPEC/decision/task mapping**: all seven approved SPEC `.approval.json`
   `spec_sha256` values were recomputed with `hashlib.sha256` against the
   current SPEC files and matched exactly. `SPEC-BASELINE.md` is `COMPLETE`.
2. **Fail-closed configuration**: `src/crm/config.py` requires all PostgreSQL
   connection values, rejects blank values, hides the password behind
   `SecretStr`, exposes a secret-free offline URL, and rejects
   `ai_enabled=True` with a validator error. A repository-wide search found no
   SQLite reference and no fallback default.
3. **No auto-create backdoor**: no `create_all` or `Base.metadata.create` call
   exists in `src/` or `tests/`; `migrations/env.py` routes only through
   Alembic using runtime `Settings`.
4. **Domain/ORM parity**: the frozen domain invariants in
   `src/crm/domain/models.py` (casefold username, Argon2id prefix,
   timezone-aware timestamps, contactability/channel exclusivity, next-action
   consistency) correspond one-to-one with the check constraints in
   `src/crm/persistence/models.py`.
5. **ORM/migration alignment**: `migrations/versions/0001_initial_schema.py`
   creates exactly the nine mapped tables with explicit short FK names matching
   the ORM, `ondelete="RESTRICT"` everywhere, idempotency unique constraints on
   the three submission tables, the deterministic history index
   `(institution_id, occurred_at DESC, recorded_at DESC, id DESC)`, and a
   complete reverse-order downgrade.
6. **Identifier length**: `tests/test_persistence_schema.py` enforces the
   63-byte PostgreSQL identifier limit across all tables, columns, constraints
   and indexes.
7. **Policy projection**: `src/crm/policy/projection.py` denies by default,
   requires a nonblank administrator-exception reason with an audit
   instruction, gives owners full detail, masks collaborator/management views
   (fixed `***` contact-name mask, hidden source/raw-channel/activity/history
   fields), rejects cross-institution children in
   `RecordSnapshot.__post_init__`, and freezes outputs with
   `MappingProxyType`.
8. **Test and scope boundary**: all tests use synthetic data only; the AI
   adapter is hard-disabled (`AI_ENABLED = False`) with a boundary test; no
   Docker/Compose artifact exists; the unaccepted S4–S6 artifacts were treated
   as out of R1 scope per the handoff.

## Findings

- **High/Medium**: none.
- **Low-1**: `src/crm/persistence/base.py` line 11 — the generic FK naming
  convention could exceed 63 bytes for future long table-name combinations.
  Currently mitigated by explicit short FK names and the identifier-length
  test. Forward-looking note only; not blocking.
- **Info-1**: the PostgreSQL round-trip test in `tests/test_migrations.py` is
  opt-in via an environment variable and was not re-executed by this read-only
  review; its prior execution rests on the S2 evidence record.
- **Info-2 (out of scope)**: root-level `tmp_create_admin.py`,
  `tmp_create_admin.sql` and `tmp_simple_create_admin.py` are S4-era temporary
  artifacts; cleanup belongs to a later stage.

## Not verified

- Runtime execution of any test (read-only constraint; static review only).
- Tencent server database state (no server connection was made).
- The unaccepted S4–S6 application artifacts, which remain outside R1.

## Verdict

R1 verdict: PASS
