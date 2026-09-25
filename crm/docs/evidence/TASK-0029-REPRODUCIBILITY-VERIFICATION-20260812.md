# TASK-0029B: Offline reproducibility verification — evidence (2026-08-13)

- Status: **COMPLETED (part B) — awaiting Codex independent review (NOT
  self-accepted)**
- Authority: `DEC-0135` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0` (hash verified in part A, §1)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.
- Scope: two fresh offline reconstructions from the TASK-0029A wheelhouse
  only, with hash enforcement and network disabled. **No network, no
  production action, no source/configuration write, no repository dependency
  change, no commit/push.**

## 1. Inputs (from TASK-0029A, external workspace)

- Wheelhouse (40 artifacts incl. local `anqiao_crm-0.1.0-py3-none-any.whl`):
  `C:\Users\K\AppData\Local\Temp\task-0029-20260813-001225\wheelhouse`
- Lock: `C:\Users\K\AppData\Local\Temp\task-0029-20260813-001225\requirements.lock`
  (40 pinned lines, each with `--hash=sha256:…`, `--require-hashes`
  compatible)
- Extracted fixed-commit tree:
  `C:\Users\K\AppData\Local\Temp\task-0029-20260813-001225\src`
- pip environment for this part: `PIP_NO_INDEX=true`,
  `PIP_CONFIG_FILE=<ws>\pip-empty.conf`, `PIP_NO_CACHE_DIR=true`,
  `PIP_DISABLE_PIP_VERSION_CHECK=1`, `PIP_NO_INPUT=1` — network disabled for
  the whole part.

## 2. Two fresh reconstructions

| Step | Command | Exit | Result |
|---|---|---|---|
| Create venv-b1 | `py -3.12 -m venv <ws>\venv-b1` | 0 | Python 3.12.8 |
| Create venv-b2 | `py -3.12 -m venv <ws>\venv-b2` | 0 | Python 3.12.8 |
| Install b1 | `venv-b1\Scripts\python.exe -m pip install --no-index --find-links <ws>\wheelhouse --require-hashes -r <ws>\requirements.lock` | 0 | 40 packages installed from wheelhouse only |
| Install b2 | same command with `venv-b2` | 0 | 40 packages installed from wheelhouse only |

Install used only the local wheelhouse with hash enforcement; no index was
reachable (`--no-index` + `PIP_NO_INDEX=true`). Both "Successfully installed"
lists contain the same 40 distributions.

## 3. Checks per reconstruction

| Check | b1 | b2 |
|---|---|---|
| `python -m pip check` | exit 0 — "No broken requirements found." | exit 0 — "No broken requirements found." |
| Application compile: `python -m compileall -q src tests migrations scripts` | exit 0 | exit 0 |
| Fixed-source test suite: `cd <ws>\src && python -m pytest -q` | exit 0 — **341 passed, 28 skipped**, 2 warnings, 91.75s | exit 0 — **341 passed, 28 skipped**, 2 warnings, 79.49s |

The 28 skips are the PostgreSQL-gated tests
(`test_task0007_postgresql_sessions.py`: "requires the isolated local
PostgreSQL test database"); they skip cleanly without a database, in both
reconstructions, identically to the historical local-suite baseline.

### Whole-tree compileall note (recorded, not a defect)

`python -m compileall -q <ws>\src` over the entire extracted tree exits 1
with exactly one error:

- `docs\specs\99-legacy\2026-07-26-crm-system\source\docs\SPEC\04-lead-detection\algorithms\01-meddic-scoring.py`
  — `SyntaxError: leading zeros in decimal integer literals…`

That file is a legacy documentation artifact with a misleading `.py`
extension, located under the repository's own `99-legacy` classification
("migrated history… evidence of prior text only", never an implementation
authority). It is not application code and is not part of the release
payload. The application scope (`src/`, `tests/`, `migrations/`, `scripts/`)
compiles cleanly in both reconstructions. The root-level `*.py` dev/debug
scripts are not tracked in the fixed commit (absent from the extracted tree),
so no root `.py` compile applies.

## 4. Non-bootstrap resolved package set comparison

| Check | Command | Exit | Result |
|---|---|---|---|
| b1 set | `venv-b1\Scripts\python.exe -m pip list --format=freeze \| grep -viE "^(pip\|setuptools\|wheel)==" \| sort` | 0 | 40 packages |
| b2 set | same with `venv-b2` | 0 | 40 packages |
| Diff | `diff pkgs-b1.txt pkgs-b2.txt` | 0 | **SETS IDENTICAL** |
| Lock cross-check | script comparing the 40 lock lines vs the installed 40 | — | in-lock-but-not-installed: NONE; installed-but-not-in-lock: NONE |

Both reconstructions resolved byte-identical, hash-verified package sets that
exactly equal the TASK-0029A lock.

## 5. No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, log file/query, or substitute.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential, private
  key, runtime-environment value, cookie, session, business row, database
  value, or HTTP body was accessed. Test output contains no business data.
- **NO MUTATION** — no network access (index disabled), no production/SSH
  action, no source/application/migration/test/configuration write, no
  repository dependency change, no commit, push, reset, clean, or checkout.
  All venvs and artifacts remain in the external workspace.

## 6. Not verified / boundaries

- Part C (Linux CPython 3.12 wheel availability / offline resolution) is the
  next sequential part and is not started here.
- This part does not self-accept; it does not claim a production build,
  production repair, production-compatible runtime, or release-ready proof.
- Codex independent review is pending for the whole package.
