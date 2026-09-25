# TASK-0010 Step 1: visible searchable fields matrix per actor

- Task: TASK-0010 (search security repair and verification)
- Executor: GLM (`xopglm52`, assigned by `DEC-0099`)
- Authority: `DEC-0089`, `DEC-0097`, `DEC-0098`, `DEC-0099`
- Date: 2026-08-06 Asia/Shanghai
- Environment: local synthetic only

## Derivation method

Each actor's searchable fields are derived from the fields that
`project_record` (`src/crm/policy/projection.py`) exposes in that actor's
projection. A field is searchable only if the actor can see its value in the
normal (non-exception) projection; searching on a hidden field would reveal
its existence through result presence or count (SPEC-0008 R-003/R-008).

## Matrix

| Actor | view_level | Searchable institution fields | Hidden (not searchable) |
|---|---|---|---|
| Record owner | OWNER (`_detailed_projection`) | `name`, `category`, `region`, `source_description`, `source_kind`, `source_evidence_reference` | none (owner sees all institution fields) |
| Other business user | COLLABORATOR (`_collaborator_projection`) | `name`, `category`, `region` | `source_description`, `source_kind`, `source_evidence_reference`, contact channel values, raw follow-up text |
| General manager | COLLABORATOR | `name`, `category`, `region` | same as other business user |
| Manager (scoped) | COLLABORATOR | `name`, `category`, `region` | same as other business user |
| Administrator exception | ADMINISTRATOR_EXCEPTION (`_detailed_projection`) | `name`, `category`, `region`, `source_description`, `source_kind`, `source_evidence_reference` | none (exception sees all) |
| Unauthorized / no-role / disabled | denied | (search denied) | all |

## Confirmed defect

`InstitutionRepository.find_all` (`src/crm/persistence/repositories.py:82-89`)
matches `name OR source_description` for every caller. `source_description`
is hidden from collaborator/management projections, so a collaborator
searching for a `source_description` fragment would receive matching
records — revealing hidden-field existence through result presence. This
violates SPEC-0008 R-003/R-008 and SPEC-0001 R-012/R-030.

## Fix approach

The searchable predicate must be actor-aware: `find_all` receives the set
of fields the caller may search, and the SQL `WHERE` clause only matches on
those fields. This enforces visibility in the predicate itself (not as
post-hoc filtering), satisfying the task card's risk note.

- **Administrator exception** (ADMINISTRATOR + nonblank normalized reason):
  match on `name`, `category`, `region`, `source_description`, `source_kind`
  (the detailed-visible set — the exception view exposes these fields).
- **Business user (owner or collaborator) / GENERAL_MANAGER / MANAGER**:
  match on `name`, `category`, `region` only (the collaborator-visible set).
  The owner list path uses the collaborator set, not the detailed set,
  because the list returns `InstitutionSummary` for all records — an owner
  searching `source_description` could match another owner's hidden field
  via result presence, violating R-003/R-008.
- **Unauthorized / no-role**: `frozenset()` — no field is searchable; if
  `search_terms` is provided, the SQL uses `WHERE false` (zero rows).

The `search_terms` parameter stays as-is (free-text input); the change is
which columns it is matched against, determined by the caller's role set.

## Acceptance criteria mapping

| AC | Test approach |
|---|---|
| AC-001 | Owner searches by visible field → finds own record with full detail |
| AC-002 | Other business user searches → gets masked results, no source_description |
| AC-003 | Any user searches by hidden field value (source_description) → no match (field not in predicate) |
| AC-004 | No export endpoint exists (assertion on routes) |
| AC-005 | Unauthorized user → search denied, no existence leak |
| AC-006 | Page and API search use the same QueryService path → same fields visible |
| AC-007 | Small-sample / existence probe → searching hidden value returns no results |
