# HANDOFF-20260812: TASK-0027 bounded W5 production release correction to DeepSeek in PI

- Task: TASK-0027
- From tool/model: GPT-5.6-sol / Codex architecture and review owner
- To tool/model: DeepSeek in PI via `opencode-go/deepseek-v4-flash`
- Handoff status: READY FOR ONE BOUNDED PRODUCTION RELEASE CORRECTION
- Repository state: `main`, intentionally dirty; preserve all existing work
- Release source: exact commit `59101b80b6420155bf8aec26b14ea7800979db86`
- Written at: 2026-08-12 Asia/Shanghai

## PI execution prompt

You are the sole production execution owner for TASK-0027 in
`D:\Project\中科安樵\crm`. Other work already exists in this dirty worktree.
Do not revert, overwrite, normalize, delete, or claim changes outside your
exclusive local paths. Your maximum outcome is `HANDOFF-ONLY`, `PARTIAL`, or
`BLOCKED`; GPT-5.6-sol / Codex is the only reviewer and acceptance
decision-maker.

Read in full before editing or production access:

- `AGENTS.md`
- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.md`
- `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0127` through `DEC-0133`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0023-g6-release-resource-plan.md`
- `docs/tasks/active/TASK-0026-w5-no-log-read-only-production-preflight.md`
- `docs/tasks/active/TASK-0027-w5-production-release-correction.md`
- `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md`
- `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md`
- `deploy/anqiao-crm.service`, `deploy/nginx_crm.conf`, and `deploy/start.sh`
- this handoff in full

State the current phase, scope, assumptions, and unknowns internally before
acting. Do not ask the product owner to run commands, inspect reports, choose
an engineering route, or handle secrets.

Authority: `DEC-0133` authorizes exactly one bounded W5 correction. The only
source payload is Git commit `59101b80b6420155bf8aec26b14ea7800979db86`.
Never publish any current worktree file. In particular, `0006_operation_records`
and all TASK-0018 operation-evidence implementation files are excluded.

Exclusive local write paths:

- `docs/NOW.md`
- `docs/tasks/TASKS.md`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0027-w5-production-release-correction.md`
- `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`
- `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md`

All other repository paths are read-only. Do not edit the decision log, this
handoff, approved SPECs, local application code, local migrations, tests,
deployment templates, or any prior task/evidence file.

### Hard prohibitions

- Never print, inspect, copy, write, rotate, or report a credential, secret,
  private key, runtime env value, cookie, session, business row value, backup
  content, or HTTP response body. An existing runtime env file may be consumed
  only in a non-echoing subprocess to run the already-configured Alembic
  command or service.
- Never run `journalctl`, `systemctl status`, `tail`, any `/var/log` path, any
  log query/file, or an indirect command intended to derive log contents,
  counts, or timestamps. Do not use a substitute log interface.
- Never modify/reload nginx, modify DNS/TLS, install packages, alter users or
  service permissions, touch another database/site/service/host, use a port
  forward/tunnel/agent forwarding, weaken host-key checking, or use a fallback
  host. Do not commit or push.
- Never use `rsync --delete`, remove any file/directory, run `pg_restore`,
  execute an Alembic downgrade, restore the database, or perform cleanup.
- Do not do full V1, G7, or R2 work. Body-discarded unauthenticated `GET`
  probes to CRM `/health` only are allowed for deployment liveness.

### Local release preparation

1. Record `git status --short` before doing anything. It is intentionally
   dirty; do not clean it.
2. Verify the `SPEC-0012` SHA-256 against its approval JSON.
3. Confirm the known-host entry with `ssh-keygen -F 124.222.212.159` only; do
   not add/replace it.
4. In a unique local temporary directory outside the repository, make an
   archive from exactly commit `59101b80b6420155bf8aec26b14ea7800979db86` and
   exactly these paths: `src/`, `templates/`, `static/`, `migrations/`,
   `alembic.ini`, `pyproject.toml`, `deploy/start.sh`,
   `deploy/anqiao-crm.service`, `deploy/nginx_crm.conf`. Record the commit and
   archive SHA-256. No other path may be in the archive.
5. Validate the archived tree locally without using the dirty worktree source:
   compile its `src/`, inspect Alembic heads (must be
   `0005_opportunity_reminders_ai_reasoning`), and run its tests with the
   repository `.venv` only if they can be run from the temporary extracted tree
   without modifying the repository. If they cannot, record the exact reason;
   do not substitute current-worktree tests as release-payload evidence.

### Strict remote preconditions

Use only `ubuntu@124.222.212.159` with `BatchMode=yes`,
`StrictHostKeyChecking=yes`, and `ConnectTimeout=15`. First run only:

```sh
id -un; hostname; date -u +%Y-%m-%dT%H:%M:%SZ
```

Expected user is `ubuntu` and expected host is `VM-0-17-ubuntu`. Any mismatch
stops before a write.

Before the first production write, run only the no-log metadata commands needed
to establish these exact facts:

1. `systemctl show anqiao-crm --no-pager` with only
   `LoadState,ActiveState,SubState,FragmentPath,User,Group,WorkingDirectory,MainPID`.
2. `stat` and `test -r` only for `/opt/anqiao-crm/shared/database.env` as
   `ubuntu`; do not read it.
3. `sudo -n nginx -t` plus only the selected `crm` directives
   `server_name`, `listen`, `proxy_pass`, `ssl_certificate`, and
   `ssl_certificate_key`; do not change/reload nginx.
4. `ss -ltn` filtered only to `22`, `80`, `443`, `8200`, and `5432`, without
   `-p`.
5. One `sudo -n -u postgres psql -d anqiao_crm` `BEGIN READ ONLY` transaction
   outputting only current database name, Alembic revision, public table names,
   and estimated table counts. It must find exactly
   `anqiao_crm` at `0001_initial_schema`. Do not select application columns or
   row values.
6. Confirm the backup parent exists and the runtime venv passes
   `/opt/anqiao-crm/venv/bin/python -m pip check`.

Any mismatch, permission failure, or condition outside this allowlist stops
`BLOCKED` before production mutation. Do not work around it.

### Authorized mutation sequence

Use a unique UTC timestamp marker `TS` and retain all generated backup/staging
paths. Do not delete them at the end.

1. Create `/opt/anqiao-crm/backup/pre-task0027-$TS` with mode `0700` using
   `sudo -n`. No other permission change is allowed.
2. Create `database.dump` there with
   `sudo -n -u postgres pg_dump -Fc -d anqiao_crm`. Set its owner/mode only so
   `postgres`/root can read it. Verify only its SHA-256, size, and
   `pg_restore --list` metadata; never restore it or output data.
3. Create a code-only archive there containing only the currently live
   `/opt/anqiao-crm` paths that this task may replace:
   `src`, `templates`, `static`, `migrations`, `alembic.ini`, `pyproject.toml`,
   `scripts/start.sh`, `deploy/anqiao-crm.service`, and
   `deploy/nginx_crm.conf`. Exclude `shared`, `backup`, `quarantine`,
   `deploy/.env`, and every unlisted path. Verify archive checksum and names
   only; do not read contents in evidence.
4. Transfer the locally built archive using strict SCP/SSH to a new unique
   staging path under the backup directory. Compare remote SHA-256 with the
   local manifest. Extract only there. Do not extract into the live directory
   before the checksum matches.
5. From the staged source, compile `src` and inspect Alembic heads. The only
   head may be `0005_opportunity_reminders_ai_reasoning`; otherwise stop before
   activation.
6. Copy only the allowlisted staged paths over their corresponding paths under
   `/opt/anqiao-crm`. Do not use a delete/prune option. Preserve all unlisted
   paths. Then change only the Uvicorn `--host` argument in deployed
   `/opt/anqiao-crm/scripts/start.sh` from `0.0.0.0` to `127.0.0.1`; record
   the checksum of the deployed script and prove the expected host argument
   without showing runtime environment values.
7. Run Alembic as `ubuntu` in a non-echoing shell that sources only the
   existing `/opt/anqiao-crm/shared/database.env`, exports the existing fixed
   host/name/user/PYTHONPATH variables, and executes:

```sh
/opt/anqiao-crm/venv/bin/alembic -c /opt/anqiao-crm/alembic.ini upgrade 0005_opportunity_reminders_ai_reasoning
```

Do not add `set -x`, print environment variables, or capture them. Afterward,
use a fresh read-only PostgreSQL query to confirm only the expected revision
and schema object names.
8. Run `sudo -n systemctl restart anqiao-crm` only. Then use `systemctl show`
   allowlisted metadata, `ss -ltn`, and unauthenticated
   `curl -sS -o /dev/null` GET requests to only
   `http://127.0.0.1:8200/health` and `https://crm.aibrain.wiki/health`. Record
   HTTP status, content type, redirect, and exit code only. Expected HTTP
   status is 200 and listener is `127.0.0.1:8200`; never store a body.
9. Re-run `sudo -n nginx -t` and compare the selected CRM site checksum with
   its pre-write value. It must be unchanged; do not reload nginx.

### Failure response

If a failure occurs after runtime-path replacement but before the successful
two liveness probes, you may extract only the captured code archive back over
the listed CRM runtime paths and restart only `anqiao-crm`. Recheck service
metadata and the two liveness probes. Do **not** automatically restore the
database or run an Alembic downgrade. If code recovery or its liveness check
fails, stop `BLOCKED` and report the exact non-secret condition.

### Evidence and local control updates

1. Write `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md` with the
   command inventory and exit codes; exact source commit/archive hash; backup
   file names, sizes, checksums, and metadata-only validation; staged/deployed
   checksum records; migration revisions; restart/service/listener/liveness
   metadata; nginx unchanged proof; no-log/no-secret attestation; any recovery;
   and all remaining unverified items. Do not include secrets, business values,
   backup data, or HTTP bodies.
2. Update the named task/status documents only. State execution and that Codex
   independent review is pending. Do not self-accept W5 and do not claim G7,
   full V1, or R2.
3. Write `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md` listing
   changed local paths, remote command inventory/exit codes, authorized writes,
   backup/recovery outcome, and `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED`.
4. Run and record:
   - `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
   - `git diff --check`
   - `git status --short`
   - scoped secret-pattern scan over TASK-0027 status/evidence files
   - scoped command scan proving no log command was run

Final response must contain only:

```text
TASK_REPORT
status: HANDOFF-ONLY | PARTIAL | BLOCKED
changed_paths: <one path per line>
checks: <command, exit code, factual result per line>
evidence: docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md
not_verified: <one item per line>
blocker: <NONE or exact blocker>
awaiting: CODEX_INDEPENDENT_REVIEW
```

Never output secrets, raw logs, business data, backup data, an acceptance
verdict, or a next-task prompt.
