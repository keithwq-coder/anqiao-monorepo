# TASK-0010 Coordinator Audit — Round 1 (REMEDIATION-REQUIRED)

- Date: 2026-08-06
- Auditor: coordinator (Kimi Code)
- Subject: GLM (`xopglm52`) TASK-0010 completion claim,
  `docs/evidence/TASK-0010-IMPLEMENTATION.md`
- Verdict: **REMEDIATION-REQUIRED** — the implementation itself is verified
  correct, but the task card's completion gate is not fully met (findings
  F1/F2 below). See `DEC-0100`.

## Independently re-run checks (this audit, not the executor's report)

| Check | Command | Result |
|---|---|---|
| Focused TASK-0010 + TASK-0014 | `pytest tests/test_task0010_search_security.py tests/test_task0014_core_semantic_security.py -q` | `30 passed` |
| Full local suite | `pytest tests -q` | `214 passed, 28 skipped, 1 warning` (baseline 205 + 9 new; no regression) |
| Byte-compile | `python -m compileall -q src tests` | exit 0 |
| Governance | `scripts/check-governance.ps1` | `[PASS]` (7 SPECs, 11 tasks) |
| Old-behavior reproduction | auditor script: seeded SQLite, OLD predicate (`name OR source_description`) vs NEW collaborator predicate for `SECRET_LEAK_MARKER_A` | OLD returns 1 row (test would FAIL — leak confirmed), NEW returns 0 rows (fixed) |

## Verified implementation facts

- [VERIFIED] `src/crm/persistence/repositories.py:70-119`: `find_all` takes
  `searchable_fields`; the SQL `WHERE` matches only those columns; empty set
  yields `WHERE false`; `None` defaults to the collaborator-safe set
  (fail-safe direction). Visibility is enforced in the predicate itself, not
  post-hoc — satisfies the task card's risk note.
- [VERIFIED] `src/crm/application/queries.py:262-277`: administrator
  exception (role + normalized nonblank reason) gets
  `{name, category, region, source_description, source_kind}`; business /
  GENERAL_MANAGER / MANAGER roles get `{name, category, region}`; no-role
  gets `frozenset()`. Dual-role with whitespace reason falls to the business
  branch — consistent with `DEC-0096` `_normalize_reason` semantics; no
  TASK-0014 regression.
- [VERIFIED] `find_all` has exactly one production caller
  (`QueryService.find_institutions`); page and API paths share it (R-007).
- [VERIFIED] List response `total = len(items) + offset` is computed after
  policy filtering — no match-count leak of hidden records (R-008).
- [VERIFIED] Changed paths are within the card's owned set: `repositories.py`,
  `queries.py`, two shared test-fixture signature updates
  (`test_s5_pages_api_parity.py`, `test_task0014_core_semantic_security.py`
  fixture), new `tests/test_task0010_search_security.py`, two evidence files.
  No policy/domain/model/template/migration/deploy changes.
- [VERIFIED] The owner restriction (owners search the collaborator set on the
  list path) is more conservative than SPEC-0008 §7 permits and is compliant:
  R-003 is an upper bound ("只能匹配…有权查看其值的字段"), not a floor.

## Findings

### F1 — completion-gate gap: no management-scope actor test (blocking)

The task card's completion gate requires acceptance tests "for owner, other
user, **management scope**, administrator exception, and unauthorized actor".
The 9 tests cover owner, other user, administrator exception, and
unauthorized — no test exercises a `MANAGER` or `GENERAL_MANAGER` subject.
The management branch in `queries.py:267` is therefore untested. SPEC-0008 §5
also names 总经理/管理层 explicitly. Required: add management-actor search
tests (masked results; hidden-field predicate does not match; for a scoped
`MANAGER`, out-of-scope records stay invisible).

### F2 — matrix doc contradicts the code (blocking, documentation)

`TASK-0010-VISIBLE-SEARCHABLE-FIELDS-MATRIX.md` "Fix approach" (lines 44-45)
says owner/admin-exception searches match `source_description`, but the
implemented list-path predicate for owners is the collaborator set (correctly
justified in the implementation report's Design decisions). The Step-1 matrix
must be corrected so the recorded contract matches the code.

### F3 — residual, recorded, not blocking: unhandled-UUID 500

GLM found and worked around a pre-existing bug: `GET /api/institutions/export`
(or any non-UUID id) returns 500 because `get_institution`
(`src/crm/web/routes/institutions.py:271`) parses `UUID(institution_id)`
without the try/except the archive route has. This is outside TASK-0010 owned
paths and is NOT fixed by this task; it is recorded here as a P2 robustness
candidate for a future task. AC-004 is still satisfied (no export capability
exists).

### F4 — old-behavior failure evidence supplied by auditor (gate satisfied)

The card's Step 3 requires proof the negative tests fail against the old
behavior; the executor's evidence did not record that run. The coordinator
independently reproduced it (see table above): OLD predicate matches
`SECRET_LEAK_MARKER_A` (1 row), NEW collaborator predicate matches nothing.
Recorded here; no further executor action needed for this item.

## Boundaries confirmed

No deployment, remote PostgreSQL/SSH, production data, credential, billing,
or real-data actions were taken or authorized by this audit.
