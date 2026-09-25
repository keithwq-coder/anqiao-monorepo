# TASK-0009 GLM-5.2 remediation — completion evidence

- Date: 2026-08-06
- Executor: GLM-5.2 (model identity `xopglm52`)
- Authority: DEC-0089, DEC-0090, DEC-0091; TASK-0009 card
- Handoff: `docs/handoffs/HANDOFF-20260806-GLM52-TASK-0009-REMEDIATION.md`
- Prior audit: `docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md`
- Environment: local Windows worktree, repository `.venv`, `PYTHONPATH=src`,
  synthetic/local tests only

## Structured report (handoff contract)

```text
Task: TASK-0009
Status: PASSED
Executor: GLM-5.2

Owned paths changed:
- tests/test_s5_pages_api_parity.py: added _phones_in_page() helper that strips
  the per-session CSRF token before phone-regex scanning; updated the two
  phone-leak assertions (test_page_api_parity_same_policy_fields and
  test_non_owner_page_and_api_masked_identically) to use it. Fixes the
  intermittent false-positive root cause (audit finding 2). In TASK-0009 owned
  test path; no main.py/template/business-logic change.
- tests/test_task0009_csrf_phone_isolation.py: NEW mutation/effectiveness
  check that forces a phone-shaped CSRF token and proves the assertion no
  longer false-triggers. In TASK-0009 owned test path.
- docs/evidence/TASK-0009-LEGACY-SCRIPTS-ARCHIVE-MANIFEST.md: NEW
  evidence-preserving manifest for backup/legacy-scripts/ (audit finding 4).
  Records source paths, stale classification, SHA-256 hashes, and a reversible
  restore path. No file under backup/ was deleted, moved, or modified.
- docs/evidence/TASK-0009-GLM52-REMEDIATION-20260806.md: this evidence file.
- docs/tasks/active/TASK-0009-integration-test-baseline.md: Evidence/result
  section updated to reflect remediation submission.

No pyproject.toml edit was required: the on-disk declaration
jinja2>=3.1.2,<3.1.5 is already correct and is the sole dependency truth
source. The venv was out of sync with it; reinstalling the editable package
regenerated dist-info metadata to match.

SPEC/task mapping:
- TASK-0009 acceptance "Produce one compatible dependency truth source and
  report pip check": pip check = "No broken requirements found." (exit 0).
  Evidence below.
- TASK-0009 acceptance "Full collection and local suite have no stale
  import/contract failures": 184 passed, 28 skipped, deterministic across 10
  full-suite runs.
- TASK-0009 acceptance "effective negative or mutation checks for
  authentication and core write boundaries": the existing
  test_non_owner_contact_write_denied / test_non_owner_activity_write_denied
  (default-deny 404) remain green; the new
  test_non_owner_masking_stable_with_phone_shaped_csrf mutation check proves
  the masking assertion is robust under a forced false-positive trigger.
- TASK-0009 acceptance "governance [PASS]": check-governance.ps1 = [PASS].

Commands actually run:
- .venv\Scripts\python.exe -m pip install "jinja2>=3.1.2,<3.1.5"
  "starlette>=0.46.0,<0.47.0" | .venv | exit 0 | installed jinja2 3.1.4,
  starlette 0.46.2
- .venv\Scripts\python.exe -m pip install -e . | .venv | exit 0 | regenerated
  anqiao-crm dist-info from current pyproject.toml
- .venv\Scripts\python.exe -m pip check | .venv | "No broken requirements
  found." exit 0
- PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests -q | .venv | 184
  passed, 28 skipped, 1 warning, exit 0 (repeated 10x, identical)
- PYTHONPATH=src .venv\Scripts\python.exe -m pytest
  tests/test_task0009_csrf_phone_isolation.py -q | .venv | 1 passed, exit 0
- powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1 | .venv | 184
  passed, 28 skipped, exit 0
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 |
  .venv | [PASS], 7 approved SPECs, 9 active tasks, 1 legacy manifest, exit 0
- PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests | .venv |
  exit 0

Tests and results:
- focused tests: 2 passed, 0 failed, 0 skipped
  (test_page_api_parity_same_policy_fields,
  test_non_owner_page_and_api_masked_identically)
- full local suite: 184 passed, 28 skipped, 1 warning; repeated 10 times with
  identical results (deterministic; the prior intermittent failure is
  eliminated)
- pip check: "No broken requirements found." (exit 0)
- governance: [PASS]

Failed, skipped, or NOT VERIFIED:
- 28 skipped are the PostgreSQL-gated tests (require
  CRM_RUN_POSTGRESQL_TESTS=1 and a real crm_test database); not in scope for
  local synthetic baseline.
- NOT VERIFIED: coordinator independent re-run of the suite and pip check.
- NOT VERIFIED: browser visual acceptance.
- NOT VERIFIED: remote PostgreSQL/SSH/deployment/real-data checks (not
  authorized and not attempted).

Scope and safety:
- no deployment/remote DB/real-data/external write: YES — none attempted.
- no out-of-scope paths changed: YES — pyproject.toml, src/crm/web/main.py,
  templates/, domain/policy/persistence/migration/deploy files were NOT
  edited by GLM-5.2 (mtimes confirm main.py = 2026-08-05 21:47, pyproject.toml
  = 2026-07-29 18:36, both pre-date this session).

Risks and rollback:
- Risk: the test fix changes how two assertions scan page text (strip CSRF
  token before phone regex). Rollback: revert tests/test_s5_pages_api_parity.py
  to remove _phones_in_page and restore the raw re.findall calls. The fix does
  not touch production code.
- Risk: dependency versions changed in the venv (jinja2 3.1.4 added;
  starlette 0.44.0 -> 0.46.2). Rollback: .venv\Scripts\python.exe -m pip
  install "starlette==0.44.0" && .venv\Scripts\python.exe -m pip uninstall -y
  jinja2. This restores the pre-remediation venv state (pip check would then
  fail again, as before).
- Risk: backup/legacy-scripts/ manifest classifies but does not move files.
  Rollback: no action needed; the manifest is additive evidence only.

Next bounded action:
- STOP: coordinator audit required; do not start TASK-0014.
```

## Audit finding resolution

### Finding 1 — dependency truth source vs environment

[VERIFIED] Root cause: the installed `anqiao-crm` editable dist-info metadata
was stale — it declared `jinja2==3.1.6`, diverging from the on-disk
`pyproject.toml` which declares `jinja2>=3.1.2,<3.1.5`. Additionally jinja2
was not installed at all, and installed starlette 0.44.0 did not satisfy
fastapi 0.136.3's metadata requirement `starlette>=0.46.0`.

Fix (no pyproject.toml edit — it is already correct):
1. `pip install "jinja2>=3.1.2,<3.1.5"` -> jinja2 3.1.4
2. `pip install "starlette>=0.46.0,<0.47.0"` -> starlette 0.46.2
3. `pip install -e .` -> regenerated anqiao-crm dist-info from current
   pyproject.toml (now declares `jinja2<3.1.5,>=3.1.2`, matching disk)

Result: `pip check` = "No broken requirements found." (exit 0).

Versions chosen from current package metadata via `pip index`, not from
memory: jinja2 3.1.4 is the latest in the declared `<3.1.5` range; starlette
0.46.2 is the latest 0.46.x patch, the smallest jump from 0.44.0 that
satisfies fastapi's `>=0.46.0`.

### Finding 2 — intermittent test failure

[VERIFIED] Root cause: test isolation defect in
`tests/test_s5_pages_api_parity.py`, NOT a business-logic bug. The phone-leak
assertion `set(re.findall(r"1[3-9]\d{9}", page.text))` scanned the entire page
HTML, which includes the per-session CSRF token (`secrets.token_hex(32)`, a
64-char hex string) rendered in `templates/base.html` line 50
(`var csrf = '{{ csrf_token|default("") }}';`). A probability check showed
~2.0% of random `token_hex(32)` tokens contain a digit run matching the phone
regex, causing a false "phone leak" ~2% of runs — consistent with the audit's
1-failure-in-4 observation (small-sample variance).

The test passed alone (30/30) and in fixed collection order (10/10) because
the flake is triggered only when a specific CSRF token happens to match — a
random per-run event, not an ordering or shared-state event.

Fix: added `_phones_in_page(page_text, client)` helper that strips the known
CSRF token (from the client's `X-CSRF-Token` header) before scanning. The
assertion's intent (detect real phone-number leaks) is preserved: a real phone
number in business content is still detected.

Effectiveness proof: a mutation check
(`tests/test_task0009_csrf_phone_isolation.py`) forces `secrets.token_hex` to
return a token containing `18374650291` (matches the regex) and confirms the
assertion no longer false-triggers. The old code would have false-failed on
this input.

### Finding 3 — TemplateResponse count and Starlette version

[VERIFIED] `grep -c TemplateResponse src/crm/web/main.py` = **23** call sites
(lines 209, 215, 260, 281, 313, 330, 350, 360, 420, 442, 448, 489, 533, 552,
575, 585, 600, 644, 654, 663, 672, 692, 702). The audit's count of 23 is
correct. The previous DeepSeek report's claim of 24 was an error.

[VERIFIED] Installed Starlette is now **0.46.2** (was 0.44.0 before
remediation). The previous report's claim of "Starlette 1.0.0" was not
independently verifiable and was incorrect — no Starlette 1.0.0 was installed.
The discrepancy is not rewritten: the prior claim stands as a recorded error,
and this report states the verified facts.

### Finding 4 — backup/legacy-scripts changed paths

[VERIFIED] The eight files under `backup/legacy-scripts/` were moved there by
the prior (rejected) TASK-0009 execution (directory mtime 2026-08-05 21:52;
file content dates 2026-07-29 to 2026-07-31). They are stale root-level ad-hoc
test/scratch scripts, NOT collected by pytest (`testpaths = ["tests"]`).

GLM-5.2 did NOT delete, move, rename, or restore these files. An
evidence-preserving manifest was written to
`docs/evidence/TASK-0009-LEGACY-SCRIPTS-ARCHIVE-MANIFEST.md` recording each
file's SHA-256, stale classification, and a reversible restore path. The
coordinator must decide whether to accept the archive as-is or reverse the
prior move.

## Final installed package versions

| Package | Version |
|---|---|
| fastapi | 0.136.3 |
| starlette | 0.46.2 (was 0.44.0) |
| jinja2 | 3.1.4 (was: not installed) |
| uvicorn | 0.43.0 |
| sqlalchemy | 2.0.51 |
| pydantic | 2.12.5 |
| pydantic-settings | 2.14.2 |
| alembic | 1.18.4 |
| psycopg | 3.3.4 |
| argon2-cffi | 25.1.0 |
| itsdangerous | 2.2.0 |
| python-multipart | 0.0.22 |
| httpx | 0.28.1 |
| pytest | 9.0.2 |
| markupsafe | 3.0.3 |
