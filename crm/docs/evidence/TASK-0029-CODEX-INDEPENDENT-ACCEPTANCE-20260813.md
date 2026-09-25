# TASK-0029: Codex independent acceptance (2026-08-13)

- Status: **PASSED** — TASK-0029A/B/C accepted for its authorized local-only
  reproducibility-artifact scope only.
- Authority: `DEC-0135`; approved `SPEC-0012 v0.2.0`.
- Executor: DeepSeek in PI through `opencode-go/deepseek-v4-flash` (gateway
  selector only; upstream identity is not asserted).
- Reviewer and acceptance decision-maker: Codex (running as
  `opencode-go/deepseek-v4-pro` in PI; gateway selector only).

## Scope reviewed

The accepted deliverable is the isolated, local-only reproducibility-artifact
package: a hash-verified lock + wheel manifest for the fixed release commit,
two offline local reconstructions, and a Linux CPython 3.12 wheel-availability
/ offline-resolution check. It authorizes no production/SSH action, no source
or configuration change, no repository dependency change, no deployment, no
service/database action, no commit, and no push.

## Independent repository evidence (re-run, not executor prose)

1. [VERIFIED] HEAD is exactly `59101b80b6420155bf8aec26b14ea7800979db86`;
   `git log` shows no new commit. `git status --short` shows the executor's
   writes confined to the eight exclusive paths (four evidence files, the task
   card, the handoff, `docs/NOW.md`, `docs/tasks/TASKS.md`); the pre-existing
   dirty worktree was preserved.
2. [VERIFIED] No application/source/migration/test/decision file was touched
   during the execution window: `src/crm/persistence/models.py`,
   `src/crm/persistence/operation_repository.py`,
   `migrations/versions/0006_operation_records.py`,
   `tests/test_task0018_operations.py`, `tests/test_migrations.py`,
   `tests/test_persistence_schema.py`, and `docs/decisions/DECISION-LOG.md`
   all carry mtimes of 2026-08-11 or earlier (execution ran 2026-08-13
   00:12–01:5x).
3. [VERIFIED] `SPEC-0012 v0.2.0` SHA-256
   `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192` equals
   the approval JSON `spec_sha256`.
4. [VERIFIED] Governance re-run: `powershell -ExecutionPolicy Bypass -File
   scripts/check-governance.ps1` → `[PASS]` (8 approved SPECs, 28 active
   tasks, 1 legacy manifest). `git diff --check` → exit 0 (only pre-existing
   LF/CRLF warnings on TASK-0018 dirty files).
5. [VERIFIED] The evidence manifest tables are byte-identical to the workspace
   manifests: `wheel-manifest.txt` (40 rows) and `linux-wheel-manifest.txt`
   (39 rows) — re-derived and compared, both MATCH.
6. [VERIFIED] `requirements.lock` has 40 `name==version --hash=sha256:<64hex>`
   lines; `linux-requirements.lock` has 39. Re-run of the offline
   `--require-hashes` dry-run against the part-A wheelhouse exits 0; a
   tampered-hash re-run exits 1 (hash enforcement confirmed).
7. [VERIFIED] Re-run `venv-b1` `pip check` → exit 0 "No broken requirements".
   Both `pytest-b1.log` and `pytest-b2.log` end with
   `341 passed, 28 skipped` (the skips are the PostgreSQL-gated tests).
8. [VERIFIED] The whole-tree `compileall` single-error claim is accurate:
   exactly one error, the legacy doc artifact
   `docs/specs/99-legacy/…/01-meddic-scoring.py` (a non-Python doc file with a
   `.py` extension; not application code).
9. [VERIFIED] The platform-drift finding is real: `requirements.lock` pins
   `greenlet==3.5.5` and `argon2-cffi-bindings==25.1.0`; `linux-requirements.lock`
   pins `greenlet==3.2.5` and `argon2-cffi-bindings==21.2.0`. Both locks pin
   `starlette==1.6.0`.
10. [VERIFIED] No secret pattern in any TASK-0029 evidence/card file; the
    handoff's only match is the prohibition wording "private keys, runtime
    environment values, …" (a rule statement, not a secret).
11. [VERIFIED] No self-acceptance: every evidence/card file states
    "NOT self-accepted" and disclaims production build/repair/compatible-runtime
    / release-ready claims.

## Integrity note

The executor's execution record transparently documents that a first draft of
the A and C manifest tables contained hand-typed values, detected and
regenerated programmatically from the workspace manifests, then verified
byte-exact. The reviewer independently reproduced that byte-exact match
(check 5), so the published tables are correct.

## Verdict

`APPROVE_AND_DISPATCH_NEXT_TASK` for TASK-0029 itself (the package is accepted
and its evidence is truthful and complete). The **next** step — rebuilding a
clean immutable environment from the verified artifacts and, separately,
switching the production service — remains `NOT AUTHORIZED` and requires a new
product-owner decision recorded as a new DEC (see DEC-0136).

## Not verified / boundaries

- Production runtime/service/deployment behavior (out of scope, unauthorized).
- TASK-0028B's remote runtime assertions (still unaccepted; not a prerequisite).
- Linux runtime execution (explicitly not performed; availability/offline
  resolution only).
- Product-owner business/visual acceptance (not applicable to this
  verification package; final production release acceptance remains separate).
