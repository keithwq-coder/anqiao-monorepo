# TASK-0009 — backup/legacy-scripts archive manifest

- Date: 2026-08-06
- Author: GLM-5.2 (TASK-0009 remediation executor)
- Authority: DEC-0089, DEC-0090, DEC-0091; TASK-0009 card
- Purpose: evidence-preserving classification of the eight files under
  `backup/legacy-scripts/` that the coordinator audit (2026-08-06) flagged as
  "not an explicit TASK-0009 destination."

## Context

The repository working tree is uncommitted and broadly untracked; there is no
git history to attribute file moves. The `backup/legacy-scripts/` directory
was created 2026-08-05 21:52 (filesystem mtime), coincident with the prior
(rejected) DeepSeek TASK-0009 execution. The eight files inside it carry
content timestamps of 2026-07-29 through 2026-07-31, predating TASK-0009.

These are stale root-level ad-hoc test/scratch scripts from the S5/TASK-0007
development period. They are NOT collected by pytest: `pyproject.toml` sets
`testpaths = ["tests"]`, and these files live outside `tests/`. The current
test suite under `tests/` supersedes them.

## No deletion or further move performed

Per the handoff contract, GLM-5.2 did NOT delete, move, rename, or restore
these files. They are preserved exactly as found. This manifest records their
classification and a reversible restore path so the coordinator can decide
whether the archive is acceptable or should be reversed.

## Inventory (hashes recorded 2026-08-06)

| File | SHA-256 | Content date | Classification |
|---|---|---|---|
| `backup/legacy-scripts/test_app_import.py` | `253bf2ab543632558682539fecf719fae9138c77e11f924551125117ef317341` | 2026-07-29 | stale ad-hoc import smoke test; superseded by `tests/test_entrypoint.py` |
| `backup/legacy-scripts/test_localhost.py` | `0faaece7cb7909314ca4a699eeb29939004db237e262187158ef7d206e5c28bb` | 2026-07-31 | stale manual localhost probe; not a unit test |
| `backup/legacy-scripts/test_query_service_fix.py` | `06e8a582d24816c9a35182f7dfe11fbcd2cbd903bf06884d88c44d92ea637340` | 2026-07-31 | stale query-service scratch; superseded by `tests/test_s5_pages_api_parity.py` and `tests/test_task0008_s2_workflow.py` |
| `backup/legacy-scripts/test_s5_e2e.py` | `c0f0c19e2a66cf6ae382dc1c5c915fbe7cba1bc1da980aa0aed27a22f0da015c` | 2026-07-29 | stale S5 e2e scratch; superseded by `tests/test_s6_e2e_auth.py` |
| `backup/legacy-scripts/test_s5_final.py` | `3f25806c1b1bafb1b016f3a9488f191468afdf3ac30c4c25a8c16bfadb5b163e` | 2026-07-29 | stale S5 scratch |
| `backup/legacy-scripts/test_s5_fixes.py` | `1635a3a7e11151b74581b566b90b172ae381e6ca9d1232c8112769eba4caa3be` | 2026-07-29 | stale S5 scratch |
| `backup/legacy-scripts/test_s5_imports.py` | `f089d832dcfbe0f83282068147961a4cb9577cf53d859bddf93dc69934501815` | 2026-07-29 | stale S5 import smoke; superseded by `tests/test_module_boundaries.py` |
| `backup/legacy-scripts/test_session_id.py` | `6adadc5bf58c059ac9325ede1e8be8cff9e6357f8baa1088d82d555b7734ff8f` | 2026-07-31 | stale session-id scratch; superseded by `tests/test_task0007_postgresql_sessions.py` |

## Reversible restore path

If the coordinator decides the archive should be reversed, restore each file
to the repository root (their original location before the prior TASK-0009
move) with:

```bash
# From repository root. Reverses the prior move; no content is changed.
for f in test_app_import test_localhost test_query_service_fix test_s5_e2e \
         test_s5_final test_s5_fixes test_s5_imports test_session_id; do
  mv "backup/legacy-scripts/$f.py" "./$f.py"
done
rmdir backup/legacy-scripts
```

Because the hashes above are recorded, integrity after restore can be
re-verified with `sha256sum ./*.py` against this manifest.

## Verification that these files are inert

- `pyproject.toml` `[tool.pytest.ini_options]` sets `testpaths = ["tests"]`,
  so pytest never collects files under `backup/`.
- `python -m compileall -q src tests` (the TASK-0009 required check) does not
  touch `backup/`.
- The full local suite (`183 passed, 28 skipped` after the fix) does not
  import or execute any file under `backup/legacy-scripts/`.

## Decision requested from coordinator

This manifest classifies the archive but does NOT delete or move the files.
The coordinator must decide whether to (a) accept the archive as-is with this
manifest, or (b) reverse the prior move using the restore path above. GLM-5.2
takes no further action on these files without an explicit coordinator
decision.
