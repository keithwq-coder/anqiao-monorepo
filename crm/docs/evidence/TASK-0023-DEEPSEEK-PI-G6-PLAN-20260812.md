# TASK-0023: DeepSeek-in-PI G6 planning execution evidence (2026-08-12)

- Task: TASK-0023 (TASK-0001 gate G6 release-resource planning)
- Type: DOCUMENTATION / REVIEW
- Authority: `DEC-0127`; approved `SPEC-0012 v0.2.0` (hash
  `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`);
  handoff `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0023-G6-PLAN.md`
- Execution owner: DeepSeek in PI (one bounded pass; maximum outcome
  HANDOFF-ONLY)
- Review/acceptance owner: Codex (only acceptance decision-maker)
- Result: **HANDOFF-ONLY** — awaiting Codex independent review
- Date: 2026-08-12

## 1. Changed paths

- `docs/NOW.md` — updated (coordinator update + open-items reconciliation:
  G6 plan prepared, awaiting Codex independent review; no production action)
- `docs/tasks/TASKS.md` — updated (TASK-0023 status row and override note)
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — updated
  (G6 gate row only: plan prepared, awaiting Codex independent review;
  W5/G7/V1/R2 remain PENDING)
- `docs/tasks/active/TASK-0023-g6-release-resource-plan.md` — updated
  (status line: plan prepared, awaiting Codex independent review)
- `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md` — created
  (G6 deliverable)
- `docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md` — created (this
  file)

No other path was edited. The dirty worktree was preserved: no reset, clean,
commit, push, merge, or overwrite of other files.

## 2. Factual source list (read in full before editing)

- `AGENTS.md`
- `docs/NOW.md`, `docs/PROJECT.md`
- `docs/specs/INDEX.md`,
  `docs/specs/30-approved/SPEC-0012-deployment-operations.md`,
  `docs/specs/30-approved/SPEC-0012-deployment-operations.approval.json`
- `docs/decisions/DECISION-LOG.md` (DEC-0112, DEC-0113–0115 skimmed for
  context, DEC-0120, DEC-0121, DEC-0122, DEC-0123, DEC-0124, DEC-0125,
  DEC-0126, DEC-0127 read in full)
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/tasks/active/TASK-0023-g6-release-resource-plan.md`
- `docs/architecture/ARCHITECTURE.md`
- `deploy/anqiao-crm.service`, `deploy/nginx_crm.conf`, `deploy/start.sh`,
  `deploy/start_crm.sh`, `deploy/debug_env.sh`, `deploy/test_settings.py`
  (contents read; `deploy/.env` existence only, contents NOT read)
- `docs/evidence/TASK-0008-DEPLOY.md`,
  `docs/evidence/TASK-0012-DEPLOY.md`,
  `docs/evidence/TASK-0001-G5-migration-authorization-request.md`
- `scripts/check-governance.ps1` (read to confirm what it validates)
- The handoff in full
- Repository state inspection: `git status --short`, `git branch
  --show-current`, `git log --oneline -5`, directory inventory of
  `deploy/`, `docs/evidence/`, `docs/handoffs/`, `migrations/versions/`,
  `scripts/`, and top-level paths

## 3. Checks and exit codes (actually run)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | 0 | `[PASS] Governance structure and gates are consistent.` — Approved SPECs: 8, Active tasks: 20, Legacy manifests checked: 1 |
| 2 | `git diff --check` | 0 | no whitespace errors (LF→CRLF warnings only for `src/crm/persistence/models.py`, `tests/test_migrations.py`, `tests/test_persistence_schema.py`) |
| 3 | `rg -n "anqiao-crm\|crm.aibrain.wiki\|8200\|systemd\|nginx\|rollback" deploy docs/evidence/TASK-0008-DEPLOY.md docs/evidence/TASK-0012-DEPLOY.md docs/evidence/TASK-0001-G5-migration-authorization-request.md` | 0 | matches found across all three evidence files and `deploy/` (`nginx_crm.conf` proxy_pass `127.0.0.1:8200`; `start.sh` `--port 8200`; `anqiao-crm.service`; historical server `ubuntu@124.222.212.159`; nginx site `crm`) |
| 4 | `rg -n "W5\|G7\|V1\|R2\|PENDING\|AUTHORIZED" docs/tasks/active/TASK-0001-manual-core-record-activity.md docs/NOW.md docs/tasks/TASKS.md` | 0 | matches found; G5 row `AUTHORIZED 2026-08-08 per DEC-0112`; G6/W5/G7/V1/R2 rows PENDING before this pass |
| 5 | auxiliary inventory: `ls -la deploy/`, `ls docs/evidence/`, `ls docs/handoffs/`, `ls migrations/versions/`, `git status --short` | 0 | see §2 |

## 4. No-external-action statement

This pass performed **no** SSH, server, network, DNS, TLS, systemd, nginx,
service, database, or production-data access or mutation; no release,
restart, migration, backup, deploy/rollback script execution; no commit,
push, or credential read/change; no external API call; no real-data use.
`deploy/.env` contents were not read. No credential-bearing or destructive
commands are included in the G6 plan document.

## 5. NOT VERIFIED boundaries (unchanged by this pass)

- Current production state of `/opt/anqiao-crm` layout, `anqiao-crm` service,
  nginx sites, TLS/DNS, listeners, `anqiao_crm` migration state, runtime env
  file, and logs — `[UNKNOWN]`, to be established only by a separately
  authorized read-only preflight.
- W5 release, G7 DNS/TLS, V1 runtime verification, and R2 acceptance — each
  remains PENDING and separately unauthorized.
- Codex independent review of this plan and the actual repository documents —
  not yet performed; this report is not acceptance evidence.
- No test suite, build, or runtime verification was run (planning-only pass;
  none was required or authorized).

## 6. Deliverable summary

1. `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md` — fact
   classification (`[VERIFIED]` local/historical vs `[UNKNOWN]` production),
   proposed W5 resource manifest, future read-only preflight snapshot,
   explicit stop conditions, proposed W5 sequence and rollback order (no
   credential-bearing or destructive commands), gate separation table, risk
   register, and required W5 evidence categories.
2. TASK-0001 G6 row updated: plan prepared, awaiting Codex independent
   review; W5/G7/V1/R2 remain PENDING.
3. `docs/NOW.md` and `docs/tasks/TASKS.md` updated consistently; TASK-0023 is
   the sole active G6 planning pass and no production action has occurred.
4. This execution evidence file.

## 7. Result

`HANDOFF-ONLY`. Awaiting `CODEX_INDEPENDENT_REVIEW`.
