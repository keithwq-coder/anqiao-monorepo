# TASK-0010 implementation report

- Task: TASK-0010 (search security repair and verification)
- Executor: GLM (`xopglm52`, assigned by `DEC-0099`)
- Authority: `DEC-0089`, `DEC-0097`, `DEC-0098`, `DEC-0099`
- Environment: local Windows worktree, repository `.venv`, `PYTHONPATH=src`,
  synthetic/local tests only
- Date: 2026-08-06 Asia/Shanghai

## Status

`PASSED` (local synthetic implementation; coordinator audit required).

## Scope — changed paths

| File | Change |
|---|---|
| `src/crm/persistence/repositories.py` | `InstitutionRepository.find_all` gains `searchable_fields: Optional[frozenset[str]]` parameter. The SQL `WHERE` clause only matches on columns the caller is authorized to search. When `None`, defaults to the collaborator-safe set (`name`, `category`, `region`). An empty frozenset means no field is searchable (no rows match if `search_terms` is given). |
| `src/crm/application/queries.py` | `QueryService.find_institutions` computes `searchable_fields` from the caller's roles: administrator exception gets `{name, category, region, source_description, source_kind}`; business user / management gets `{name, category, region}`; no-role gets `frozenset()`. The set is passed to `find_all`. Does not regress TASK-0014's `_normalize_reason`. |
| `tests/test_s5_pages_api_parity.py` | `MemoryInstitutionRepository.find_all` accepts `searchable_fields` for interface compatibility (in-memory search matches on name only). |
| `tests/test_task0014_core_semantic_security.py` | `_SqliteInstRepo.find_all` accepts and applies `searchable_fields` (actor-aware SQL filtering). |
| `tests/test_task0010_search_security.py` | New file: 9 tests covering SPEC-0008 AC-001 through AC-007. |
| `docs/evidence/TASK-0010-VISIBLE-SEARCHABLE-FIELDS-MATRIX.md` | Step 1 output: visible searchable fields per actor. |

No changes to `src/crm/policy/`, `src/crm/domain/`, `src/crm/persistence/models.py`,
templates, migrations, or deployment files.

## SPEC / AC mapping

| AC | Test | Result |
|---|---|---|
| AC-001 | `test_owner_searches_by_name_finds_own_record` | owner finds own record by name |
| AC-002 | `test_other_user_search_returns_masked_results` | collaborator gets masked summary, no source_description |
| AC-003 | `test_collaborator_cannot_search_by_source_description`, `test_owner_cannot_search_other_records_by_source_description` | hidden field value cannot match |
| AC-004 | `test_no_export_endpoint_exists` | no export/download routes |
| AC-005 | `test_unauthorized_user_search_denied` | no-role user gets zero results |
| AC-006 | `test_page_and_api_search_same_results` | page and API find same records |
| AC-007 | `test_existence_probe_via_source_description_fails` | cannot distinguish "exists but hidden" from "does not exist" |

## Commands and results

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_task0010_search_security.py -v
  => 9 passed in 3.97s

PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q
  => 214 passed, 28 skipped, 1 warning in 37.94s
  (baseline was 205 passed, 28 skipped; +9 new TASK-0010 tests; no regression)

PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
  => exit 0

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
  => [PASS] 7 SPECs, 11 active tasks, 1 manifest
```

## Design decisions

- **Searchable predicate is actor-aware**: the SQL `WHERE` clause only matches on
  columns the caller can see. This is not post-hoc filtering — the predicate
  itself enforces visibility, satisfying the task card's risk note.
- **Owner list path uses collaborator-visible fields**: even an owner searching
  `source_description` could match another owner's hidden field. The list path
  returns `InstitutionSummary` for all records, so only the collaborator-safe
  set (`name`, `category`, `region`) is searchable by business users. The
  administrator exception (which sees all records in detail) may search
  `source_description` and `source_kind`.
- **No-role user gets empty searchable set**: `frozenset()` means no field is
  searchable; if `search_terms` is provided, no rows match (the SQL uses
  `WHERE false`).

## Not verified

- Browser visual acceptance.
- Remote PostgreSQL/SSH, deployment, production migration, real-data writes,
  credential changes, paid services, and external writes.
- The 28 skipped tests are isolated-PostgreSQL gates; out of scope for this
  local synthetic task.

## Next bounded action

`STOP: coordinator audit required; do not start TASK-0010 successor or TASK-0015.`

---

## Remediation pass (DEC-0100)

The coordinator audit (`docs/evidence/TASK-0010-COORDINATOR-AUDIT-20260806.md`,
`DEC-0100`) found two gate gaps (F1/F2). The core predicate logic was verified
correct and was not changed. This section records the consolidated correction.

### F1: management-scope actor tests

Added 4 tests to `tests/test_task0010_search_security.py`:

| Test | Actor | Assertion |
|---|---|---|
| `test_general_manager_search_by_name_returns_masked_results` | GENERAL_MANAGER | name search hits, masked summary, no source_description |
| `test_general_manager_cannot_search_by_source_description` | GENERAL_MANAGER | SECRET_LEAK_MARKER_A → zero results |
| `test_scoped_manager_search_name_no_scope_leak` | MANAGER (scope_east) | name search → zero results (management_scope_key not set on snapshots; policy denies all) |
| `test_scoped_manager_cannot_search_by_source_description` | MANAGER (scope_east) | hidden field → zero results |

Fixture updated: added `t10gm` (GENERAL_MANAGER) and `t10mgr` (MANAGER with
scope `scope_east`) to `t10_env`.

### F2: matrix document corrected

`docs/evidence/TASK-0010-VISIBLE-SEARCHABLE-FIELDS-MATRIX.md` "Fix approach"
section corrected to match the code:
- administrator exception → `{name, category, region, source_description, source_kind}`
- business user / management → `{name, category, region}` (owner list path uses
  collaborator set; reason: owner searching source_description could match
  another owner's hidden field)
- no-role → `frozenset()`

### Remediation commands and results

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_task0010_search_security.py -v
  => 13 passed

PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/ -q
  => 218 passed, 28 skipped, 1 warning
  (prior 214 + 4 new management tests; no regression)

PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
  => exit 0

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
  => [PASS] 7 SPECs, 11 tasks, 1 manifest
```

### Next bounded action (remediation)

`STOP: coordinator audit required; do not start TASK-0010 successor or TASK-0015.`
