# TASK-0008 S1 contract map: revision + audit in one transaction (design)

- Task: `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` Step 1
- Author/executor: DeepSeek (implementation); coordinator audits
- Date: 2026-08-04
- Authority: DEC-0081 (Step 1 unlocked only); DEC-0080 (scope + engineering defaults)
- Scope of this file: **design only**. R-031 / R-015 / R-036 business behavior
  is implemented in Step 2+, not here. Nothing in this file authorizes code
  outside the S1 owned paths.
- Evidence grading: per DEC-0073 point 4, statements below are `[VERIFIED]`
  (read in a named file) or `[INFERENCE]` (reasoned from verified facts).

## 1. What Step 1 changed (code)

- `src/crm/application/commands.py`: removed the three `from_dict()`
  classmethods (`CreateInstitutionCommand`, `AddContactToInstitutionCommand`,
  `CreateFollowUpActivityCommand`). They had **zero call sites** in `src/` and
  `tests/` and always raised `TypeError` (`hasattr(cls, k)` is `False` for
  every constructor parameter, so the dict comprehension filtered out every
  item). Verified by GAP-ANALYSIS §6.1 and re-checked this round via repository
  grep. The route layer constructs the commands directly
  (`routes/institutions.py:76`, `routes/followups.py:93,159`), so removal
  changes no behavior.
- `src/crm/application/queries.py`: removed the empty contact re-projection
  loop in `QueryService.get_institution_detail` (was lines 264-277). The loop
  called `project_record()` per contact and discarded every result (`pass`);
  `detail.contacts` already comes from `InstitutionDetail.from_projection` on
  the full snapshot projection (`queries.py:90`). Removal changes no behavior.
- `tests/test_task0008_s1_contracts.py` (new): locks the surviving contracts —
  direct-construction `validate()`/`execute()` for the three commands, the
  R-028 next-action/owner rule, and owner-unmasked / collaborator-masked
  contact projection through `get_institution_detail`.

## 2. Transaction requirement (R-031 / R-015 / R-036)

The Step 2+ operations that must be **atomic within one transaction**:

| Operation | Writes | Must be atomic with |
|---|---|---|
| Factual correction (R-031) | new `follow_up_activity_revisions` row (`version_number = current_version + 1`, `change_reason`, `created_by_user_id`) + `follow_up_activities.current_version += 1` | an `audit_events` row when the actor is an administrator-exception operation (R-036) |
| Withdrawal (R-031) | `follow_up_activities` `withdrawn_at` / `withdrawn_by_user_id` / `withdrawal_reason` (complete triple, enforced by the `withdrawal_complete` check constraint, `persistence/models.py:194-199`) | an `audit_events` row (withdrawal keeps audit history) |
| Archive (R-036) | `institutions` `archived_at` / `archive_reason` (`persistence/models.py:181-182`) | an `audit_events` row when performed as an exception operation |

Current state `[VERIFIED]`:
- Every repository method opens its own `SessionLocal()` and commits alone
  (`repositories.py:113-117, 217-221, 359-383`; same pattern in
  `user_repository.py`, `session_repository.py`, `audit_repository.py`,
  `role_grant_repository.py`) — no method accepts an external session.
- `transaction_session(factory)` exists at `persistence/database.py:86-95`,
  is exported by `persistence/__init__.py:4,30`, and has **zero business call
  sites** (S0 freeze check verified this).
- `FollowUpActivityRepository.create` is the existing precedent for two writes
  in one session: activity row + initial revision share one `SessionLocal()`
  and one `commit()` (`repositories.py:359-383`). It is a single-method
  transaction, not a cross-repository one.

## 3. Executable design: `transaction_session` as the unit-of-work boundary

**Chosen boundary: the command layer holds a session factory and wraps each
multi-write operation in `transaction_session`; repositories that participate
in that operation expose a session-taking variant of their method.**

Call shape (this is the invocation the Step 2 implementation must use):

```python
from crm.config import Settings
from crm.persistence.database import get_session_factory, transaction_session

# factory is built once from resolved settings (engine + pool are cached and
# keyed on every configuration dimension, database.py:20-50).
factory = get_session_factory(Settings())

with transaction_session(factory) as session:
    revision = activity_repo.append_revision(
        session=session,
        activity_id=...,
        version_number=...,
        change_reason=...,
        created_by_user_id=...,
        ...
    )
    activity_repo.bump_current_version(session=session, activity_id=..., new_version=...)
    audit_repo.record(
        session=session,
        actor_user_id=...,
        action="activity.correct",
        target_type="institution",
        target_id=...,
        outcome="success",
        reason=...,
        before_state=...,
        after_state=...,
    )
```

Semantics relied on `[VERIFIED]` (`database.py:86-95`):

- `session.begin()` commits automatically when the `with` block exits without
  an exception;
- any exception triggers `session.rollback()` and re-raises — the revision,
  the `current_version` bump, and the audit row are all rolled back together;
- `session.close()` in `finally` returns the pooled connection.

Why the command layer is the boundary, not each repository `[INFERENCE]`:

- a correction/withdrawal is one business operation that writes two tables at
  minimum (revision/withdrawal state + audit), sometimes three (revision +
  version bump + audit); only the command layer sees the whole write set;
- the existing per-method `SessionLocal()` pattern stays valid for single-write
  reads/creates and is **not** retrofitted;
- the repository stays stateless and testable: the in-memory fakes used by
  `tests/` implement the same session-taking method signatures, so the command
  logic is verifiable without a database (Step 2 will add the rollback test).

Repository contract addition (design, not yet implemented):

- `FollowUpActivityRepository.append_revision(*, session, ...) -> revision`
  and `bump_current_version(*, session, activity_id, new_version)` — new
  methods, existing `create`/`find_*` untouched;
- `AuditRepository.record(*, session, ...)` — new session-taking variant
  mirroring the existing audit write contract (`audit_repository.py`);
- alternative equivalent wrapper if the Step 2 executor prefers one entry
  point: a `repository.transaction()` context manager that internally calls
  `transaction_session(factory)` with the repository's own factory. The
  command-layer form above is the primary recommendation because it keeps one
  factory construction per operation and matches the existing
  `get_session_factory(Settings())` call site pattern already used by
  `SessionLocal()`.

Concurrency note `[INFERENCE]`: the `uq_follow_up_activity_revision_version`
unique constraint (`persistence/models.py:241`) makes a concurrent double
correction fail loudly (IntegrityError → rollback) rather than silently
corrupt history; no row locking is added in this design.

## 4. Verification plan for Step 2 (must be run there, not now)

- **Rollback proof (DEC-0073 point 4 shape):** inside `transaction_session`,
  append a revision, then force the audit write to raise; assert the revision
  row is absent afterwards (observe the failure condition first, then assert
  coverage). Also the reverse order: audit written, revision raises.
- **Positive proof:** correction appends version N+1, keeps version N intact,
  bumps `current_version`, and (for exception operations) persists an
  `audit_events` row with actor/target/time/reason (AC-009).
- **No hard delete:** withdrawal persists the complete withdrawn triple and
  never removes rows (AC-025).
- Existing S0 baseline `106 passed, 1 skipped` must hold (S1 suite adds the
  new contract file; full local ungated regression re-run this round:
  see completion report).

## 5. Boundaries

- This file designs the transaction wrapper only; no R-031/R-015/R-036 business
  code, route, template, or migration was written in Step 1.
- No `crm_test` / SSH / server / real data was touched (DEC-0081 point 5).
- Step 2 stays LOCKED until the coordinator accepts Step 1 in writing.
