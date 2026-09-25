# TASK-0008 S2: correction / withdrawal / archive — R-031 owner path (implementation)

- Task: `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` Step 2
- Author/executor: DeepSeek (implementation); coordinator audits
- Date: 2026-08-04
- Authority: DEC-0081 (Step 2 unlocked after Step 1 ACCEPTED by coordinator)
- Scope: R-031 / R-036 owner path; AC-025; no hard delete; transaction design
  from `docs/evidence/TASK-0008-S1-CONTRACT-MAP.md` §3 implemented as-is.
- Evidence grading: per DEC-0073 point 4 — commands and results below are
  `[VERIFIED]` (actually run this round) unless labelled otherwise.

## 1. What was implemented

### Persistence (session-taking methods beside the existing ones; no existing
signature changed)

- `FollowUpActivityRepository.append_revision(*, session, activity_id,
  factual_body, change_reason, created_by_user_id, ...) -> int`
  (`repositories.py`): computes `version_number = current_version + 1`,
  inserts the new `follow_up_activity_revisions` row, `session.flush()` so it
  is visible inside the caller's transaction. Append-only: the prior revision
  is never modified. Concurrent double correction is rejected by
  `uq_follow_up_activity_revision_version`.
- `FollowUpActivityRepository.bump_current_version(*, session, activity_id,
  new_version)`: advances `current_version`; the row is never rewritten in
  place beyond this counter.
- `FollowUpActivityRepository.find_in_session(*, session, activity_id)`: the
  transaction-internal read twin of `find_by_id`, used so the correction
  command reads back the new current version without a second session.
- `FollowUpActivityRepository.withdraw(*, session, activity_id,
  withdrawn_by_user_id, withdrawal_reason) -> datetime`: writes the complete
  withdrawn triple (`withdrawal_complete` constraint
  `models.py:194-199`), keeps the row, returns `withdrawn_at`.
- `InstitutionRepository.archive(*, session, institution_id,
  archive_reason) -> datetime`: writes the complete
  `archived_at`/`archive_reason` pair (`ck_institutions_archive_complete`),
  keeps the row.
- `AuditEventRepository.record(..., session=None)`: when `session` is given
  the event joins the caller's transaction (no commit); without `session` the
  original self-committing `SessionLocal()` path is unchanged — no existing
  call site was touched.

### Application commands (`commands.py`)

- `CorrectFollowUpActivityCommand`: validates change_reason/factual_body and
  the R-028 next-action/owner rule; executes inside
  `transaction_session(factory)` — `append_revision` + `bump_current_version`
  + `audit_repo.record(session=..., action="activity.correct", ...)` +
  `find_in_session` read-back, all in one transaction.
- `WithdrawFollowUpActivityCommand`: `withdraw` + audit
  (`action="activity.withdraw"`), returns the confirmation payload
  (`activity_id`, `withdrawn`, `withdrawn_at`, `withdrawal_reason`).
- `ArchiveInstitutionCommand`: `archive` + audit
  (`action="institution.archive"`), returns the confirmation payload.
- All three take an optional `session_factory` (tests inject the SQLite
  factory; production defaults to `get_session_factory(Settings())`), exactly
  the call shape named in the S1 contract map §3:
  `with transaction_session(factory) as session: ...`.

### Routes (owner-write, 404 default deny — no existence leakage)

- `POST /api/institutions/{institution_id}/activities/{activity_id}/correct`
  (`followups.py`): owner check on the institution, activity must belong to
  the institution (no cross-record correction), returns `ActivityDetail` with
  the corrected content.
- `POST /api/institutions/{institution_id}/activities/{activity_id}/withdraw`
  (`followups.py`): same owner/belonging checks, returns the confirmation
  payload.
- `POST /api/institutions/{institution_id}/archive` (`institutions.py`):
  owner check, returns the confirmation payload.
- All pass `request.app.state.session_factory` (absent in production →
  command default) and the state-provided repositories; identity comes from
  the existing `Depends(get_current_user)`.

## 2. Transaction semantics (S1 contract map §3 executed)

`transaction_session(factory)` (`database.py:86-95`) is the only write
boundary: `session.begin()` commits on clean exit; any exception rolls back
and re-raises; `finally` closes. The revision, the version bump, and the
audit event commit or roll back together. No repository method added here
commits on its own; each is a pure session-taking operation.

## 3. Test evidence (local, synthetic; no `crm_test`)

`tests/test_task0008_s2_workflow.py` — 10 passed (`[VERIFIED]`,
`.venv/Scripts/python.exe -m pytest tests/test_task0008_s2_workflow.py -q`
→ `10 passed in 1.50s`). SQLite in-memory schema (StaticPool) with the
PostgreSQL-only `btrim`/`char_length` registered for the SQLite dialect; the
real repositories run against it, so the rollback proof uses real
transaction semantics.

- AC-025 positive: correction appends revision v2, keeps v1 byte-identical
  (`change_reason="initial creation"` intact), bumps `current_version` to 2,
  audit event carries `(actor, reason)` — `test_correct_appends_new_version_and_keeps_prior`.
- **Rollback proof (DEC-0073 point 4 shape):** a failing audit write
  (`_FailingAuditRepository.record` raises) inside the transaction leaves
  `current_version == 1` and exactly one revision (`v1 原始正文`) — the
  v2 row and the version bump did not commit —
  `test_correct_rolls_back_when_audit_fails`.
- Withdrawal keeps the row and writes the full triple (at/by/reason); no
  DELETE anywhere (`test_withdraw_keeps_row_and_writes_complete_triple`);
  re-withdraw and re-correct on a withdrawn activity are rejected
  (`test_withdraw_rejects_already_withdrawn`,
  `test_correct_rejects_withdrawn_activity`); re-archive rejected
  (`test_archive_rejects_already_archived`).
- Archive sets the pair + audit, row kept (`test_archive_sets_pair_and_audit`).
- Blank reasons rejected on all three commands (`test_commands_reject_blank_reasons`).
- R-036 owner boundary over HTTP: non-owner gets 404 on all three paths with
  zero business writes and zero business audit events
  (`test_non_owner_write_paths_are_denied_with_404`); owner full flow over
  HTTP produces exactly `activity.correct` / `activity.withdraw` /
  `institution.archive` audit events attributed to the owner
  (`test_owner_correct_withdraw_archive_flow`).

### Regression (local ungated; no `CRM_RUN_POSTGRESQL_TESTS`)

- Full suite: `149 passed, 28 skipped` (`[VERIFIED]`,
  `.venv/Scripts/python.exe -m pytest tests/ -q -p no:cacheprovider`).
  Prior S1 baseline was `139 passed, 28 skipped`; the +10 are the new S2
  tests. No existing test changed behavior.
- `check-governance.ps1` → `[PASS]` (`[VERIFIED]`, run this round).

## 4. Design notes and boundaries

- Domain datetimes: `repositories.py` conversion helpers now normalize a
  naive stored datetime to UTC (`_ensure_aware`) so the domain contract
  (aware datetimes) holds regardless of the storage dialect. PostgreSQL
  `timestamptz` always round-trips aware, so production paths are unaffected
  (`[INFERENCE]`, the SQLite test store is the only naive source).
- `interaction_method` stays on the activity head (not versioned): the
  versioned revision table does not carry it, so corrections cover the
  revision content fields (factual_body, seven-dimension fields, shared
  summary, attribution). This matches the schema boundary; a method-category
  change is R-029 territory (Step 5).
- Contact archive is not implemented: R-031 archive applies to the business
  record (institution); contacts are subordinate children and remain
  readable with the institution. No schema column exists for contact archive.
- Administrator-exception writes (R-036 admin ops) stay out of this step and
  are Step 4 territory.
- No route, template, migration, or policy change outside the S2 owned
  paths; no `crm_test`/SSH/server/real data touched (DEC-0081 point 5).

## 5. Status

- Step 2 implementation complete; awaiting coordinator acceptance.
- Step 3 (R-035 duplicate prompt) stays LOCKED until acceptance is recorded.
