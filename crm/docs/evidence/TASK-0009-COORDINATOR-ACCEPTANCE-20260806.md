# TASK-0009 coordinator acceptance

- Date: 2026-08-06
- Status: ACCEPTED
- Scope: independent audit of the GLM-5.2 remediation
- Authority: `DEC-0089`, `DEC-0090`, `DEC-0091`; acceptance recorded by `DEC-0092`
- Environment: local Windows worktree, repository `.venv`, `PYTHONPATH=src`,
  synthetic/local tests only

## Verdict

`TASK-0009` is **ACCEPTED** for its local synthetic dependency and integration-
test baseline. No application behavior, migration, deployment, remote resource,
credential, or real-data operation was authorized or performed.

## Independent evidence

| Check | Result |
|---|---|
| Focused parity/write tests | `4 passed, 0 failed` |
| CSRF phone-isolation mutation test | `1 passed, 0 failed` |
| `scripts/dev-test.ps1` | `184 passed, 28 skipped, 1 warning`, exit 0 |
| Repeated full local suite | 5/5 runs: `184 passed, 28 skipped, 1 warning`, exit 0 |
| `pip check` | `No broken requirements found.`, exit 0 |
| `compileall -q src tests` | exit 0 |
| `scripts/check-governance.ps1` before successor activation | `[PASS]`, 7 approved SPECs, 9 active tasks, 1 legacy manifest |
| `scripts/check-governance.ps1` after TASK-0014 activation | `[PASS]`, 7 approved SPECs, 10 active tasks, 1 legacy manifest |
| `TemplateResponse` inventory | 23 matches in `src/crm/web/main.py` |
| Installed versions | `fastapi 0.136.3`, `starlette 0.46.2`, `jinja2 3.1.4` |
| Legacy archive hashes | 8/8 manifest SHA-256 values match current files |

Commands independently run:

```text
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_s5_pages_api_parity.py::test_page_api_parity_same_policy_fields tests/test_s5_pages_api_parity.py::test_non_owner_page_and_api_masked_identically tests/test_s5_pages_api_parity.py::test_non_owner_contact_write_denied tests/test_s5_pages_api_parity.py::test_non_owner_activity_write_denied -q
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests/test_task0009_csrf_phone_isolation.py -q
powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
PYTHONPATH=src .venv\Scripts\python.exe -m pytest tests -q  # repeated 5 times
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
PYTHONPATH=src .venv\Scripts\python.exe -m compileall -q src tests
.venv\Scripts\python.exe -m pip check
```

## Scope review

- [VERIFIED] The changed test paths use `_phones_in_page()` at both phone-leak
  assertion sites (`tests/test_s5_pages_api_parity.py:450` and `:619`).
- [VERIFIED] The mutation fixture forces a phone-shaped CSRF token and the
  helper excludes that token; the focused parity and default-deny write tests
  also pass independently.
- [VERIFIED] Current editable-install metadata matches `pyproject.toml`; no
  `pyproject.toml`, application source, template, migration, policy, domain,
  persistence, deployment, or remote file was changed by this remediation.
- [VERIFIED] The eight files under `backup/legacy-scripts/` remain present and
  their manifest hashes match. The prior move cannot be attributed from Git
  because this worktree is broadly untracked and has no commits; this acceptance
  does not endorse or reverse that prior move.
- [INFERENCE] The manifest's `183 passed` wording predates the newly added
  mutation test; the current and authoritative independent count is `184/28`.
  This is documentation staleness, not a failed acceptance criterion.

## Not verified

- Browser visual acceptance.
- Remote PostgreSQL/SSH, deployment, production migration, real-data writes,
  credential changes, paid services, and external writes.

## Next bounded action

Per `SPEC-COMPLETION-ROADMAP-20260805.md` and `DEC-0090`, release TASK-0009's
local path ownership and activate `TASK-0014` for local synthetic implementation.
The TASK-0014 handoff is `docs/handoffs/HANDOFF-20260806-DEEPSEEK-TASK-0014-CORE-SEMANTIC-SECURITY-CLOSURE.md`.
