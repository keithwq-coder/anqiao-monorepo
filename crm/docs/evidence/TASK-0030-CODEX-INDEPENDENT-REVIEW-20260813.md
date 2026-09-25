# TASK-0030: Codex independent review (2026-08-13)

- Status: **EXECUTION ACCEPTED as correct fail-closed (BLOCKED + successful
  rollback); recorded root cause CORRECTED** — see below.
- Authority: `DEC-0137`; approved `SPEC-0012 v0.2.0`.
- Executor: DeepSeek in PI through `opencode-go/deepseek-v4-flash` (gateway
  selector only, upstream identity not asserted).
- Reviewer and acceptance decision-maker: Codex (running as
  `opencode-go/deepseek-v4-pro` in PI; gateway selector only).

## Independent repository evidence

1. [VERIFIED] HEAD is `59101b80b6420155bf8aec26b14ea7800979db86`; no new
   commit. Application/migration/test files untouched during the execution
   window (mtimes 2026-08-11/12). Writes confined to the task's exclusive
   paths (two evidence files, task card, handoff, NOW.md, TASKS.md).
2. [VERIFIED] Governance re-run: `[PASS]` (29 active tasks). `git diff --check`
   exit 0. SPEC-0012 hash matches approval JSON. No secret pattern in the
   TASK-0030 evidence/card files.

## Independent server verification (read-only)

1. [VERIFIED] Service healthy: `curl http://127.0.0.1:8200/login` →
   `http_code=200`. Rollback restored the prior running state.
2. [VERIFIED] `/opt/anqiao-crm/venv` is the restored original (its `pip check`
   still fails with the known fastapi 0.141.0/starlette 0.44.0 mismatch).
3. [VERIFIED] The clean frozen-lock venv is preserved at
   `/opt/anqiao-crm/venv-failed-20260813022501`; its `python3.12 -m pip check`
   → "No broken requirements found.", and `python3.12 -m uvicorn --version`
   → "Running uvicorn 0.43.0 with CPython 3.12.3 on Linux".

## Root-cause correction (material)

- The executor's recorded root cause was `[INFERENCE]`: the deployed code does
  not run with the frozen dependency set.
- Codex independently verified a different, concrete root cause:
  `[VERIFIED]` the clean venv's console-script shebangs point to the stale
  path `#!/opt/anqiao-crm/venv-new/bin/python3.12` (both `uvicorn` and `pip`),
  because the venv was created at `venv-new` and then `mv`-ed to `venv`. The
  service's start script execs `/opt/anqiao-crm/venv/bin/uvicorn` directly, so
  the stale shebang produced "required file not found" and the service failed
  to start before any application code could be imported.
- `[VERIFIED]` The restored original venv's `uvicorn` shebang is
  `#!/opt/anqiao-crm/venv/bin/python3` (valid), which is why the pre-switch
  service ran.
- `[UNKNOWN]` Whether the deployed code would actually run with the frozen
  dependency set is therefore NOT established by this task — the service never
  reached application import. The executor's "code incompatibility"
  conclusion is not proven and must not be treated as fact.

## Verdict

`APPROVE_AND_DISPATCH_NEXT_TASK` for the bounded scope: the execution was
correct, within boundaries, and the mandatory rollback was successful (service
restored, no data/source/config/database impact). The recorded root cause is
corrected to the shebang-breakage defect. The next switch attempt must use a
relocation-safe mechanism (create the venv directly at the final path, or
regenerate/fix the console-script shebangs, or run uvicorn via
`python -m uvicorn`), and must re-determine whether the deployed code actually
runs with the frozen dependencies.

## Boundaries / not verified

- Whether deployed code + frozen deps are runtime-compatible: [UNKNOWN], to be
  determined by the corrected next attempt, not assumed.
- W5 release execution (fixed payload + migration 0001→0005 + restart), G7,
  V1, R2: still separately unauthorized and PENDING.
- The next switch attempt is a new production mutation and requires a new
  product-owner authorization recorded as a new DEC.
