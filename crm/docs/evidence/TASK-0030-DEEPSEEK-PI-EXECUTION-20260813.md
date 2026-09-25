# TASK-0030 DeepSeek-in-PI execution record (2026-08-13)

- Task: TASK-0030 (production environment rebuild + service switch, DEC-0137)
- Status: **EXECUTED — BLOCKED (switch failed, rolled back; service restored)
  — awaiting Codex independent review (NOT self-accepted)**
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Authority: `DEC-0137`; approved `SPEC-0012 v0.2.0`

## Sequence executed

1. **Phase 1 (local wheelhouse)** — completed: 39 exact frozen versions
   downloaded as Linux wheels (manylinux_2_28/2_17 cp312); `linux-requirements.lock`
   built (ASCII, hash-pinned); offline `--require-hashes` dry-run exit 0;
   tampered-hash negative test exit 1.
2. **Phase 2 (server preflight)** — completed: identity ubuntu/VM-0-17-ubuntu;
   glibc 2.39; 9.4G disk; current venv `pip check` reproduced the
   fastapi/starlette mismatch; start.sh references `venv/bin/uvicorn`;
   Python 3.12.3.
3. **Phase 3 (transfer)** — completed: 39 wheels + lock scp'd to
   `/tmp/task0030/`; remote lock hash `0f3f98d9…` matches local.
4. **Phase 4 (fresh venv)** — completed: `python3.12 -m venv
   /opt/anqiao-crm/venv-new`; offline hash-enforced install exit 0 (39
   packages, exact frozen versions).
5. **Phase 5 (validate)** — completed: pip check 0; fastapi 0.136.3 /
   starlette 1.6.0; deps import OK; app import needs runtime secrets
   (expected fail-closed, deferred to post-switch health check).
6. **Phase 6 (switch)** — plain `systemctl` required interactive auth (exit
   1); used the established `sudo -n` path (`sudo -n systemctl restart
   anqiao-crm` → OK) after the venv swap (`venv`→`venv-broken-20260813022251`,
   `venv-new`→`venv`). Service did not come up (http 000 for ~70s).
7. **Phase 7 (rollback)** — `sudo -n systemctl stop`; `venv`→
   `venv-failed-20260813022501`; `venv-broken-20260813022251`→`venv`; start;
   **HTTP 200** on `/login` — prior running state restored.

## Root-cause finding

The frozen-lock venv (tested against release source `59101b80…`) does not run
the currently deployed server code; the deployed code ran with the old venv
and the service was up before this task. Restoring the old venv restored the
service. Environment rebuild alone is insufficient: code + DB (0001→0005) must
advance together with the venv — the bounded W5 release scope remains a
separate, separately-authorized prerequisite. Exact startup failure reason is
[UNKNOWN] (no logs read, per boundary).

## Evidence

- `docs/evidence/TASK-0030-PRODUCTION-ENVIRONMENT-REBUILD-20260813.md`
  (phase-by-phase record)
- this execution record
- Task card: `docs/tasks/active/TASK-0030-production-environment-rebuild.md`
- Handoff: `docs/handoffs/HANDOFF-20260813-DEEPSEEK-PI-TASK-0030-PRODUCTION-ENV-REBUILD.md`
- Status/index: `docs/NOW.md`, `docs/tasks/TASKS.md`

## Attestations

No log command; no secret/environment/database value read; no database action;
no nginx/DNS/TLS change; no source/configuration change beyond the authorized
venv swap; no commit/push. Mutations limited to the venv directory renames and
`anqiao-crm` restart (all authorized by DEC-0137, with mandatory rollback
executed).

## Awaiting

`CODEX_INDEPENDENT_REVIEW`
