# TASK-0025: TASK-0024 boundary-incident reconciliation — correction evidence (2026-08-12)

- Task: TASK-0025 (TASK-0024 boundary-incident local documentation correction)
- Type: DOCUMENTATION / CORRECTION
- Authority: `DEC-0124`, `DEC-0129`, `DEC-0130`; approved `SPEC-0012 v0.2.0`
  (hash `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`)
- Execution owner: DeepSeek in PI (one bounded local documentation pass;
  maximum outcome HANDOFF-ONLY)
- Review/acceptance owner: Codex (only acceptance decision-maker)
- Executed at: 2026-08-12 Asia/Shanghai
- Repository state: `main`, intentionally dirty; all existing work preserved

## Status

`HANDOFF-ONLY` — local documentation correction executed; TASK-0024 is
recorded as `NOT ACCEPTED / PARTIAL - BOUNDARY INCIDENT RECORDED` per
`DEC-0130`. Nothing in this pass is an acceptance verdict, and TASK-0025 is
not self-accepted. Awaiting: `CODEX_INDEPENDENT_REVIEW`.

## Scope

- Local repository documentation only, strictly within the exclusive owned
  paths below. No other path was edited.
- No SSH, DNS, HTTPS, curl, remote shell, network probe, production read, log
  access, database access, deployment, migration, service action, or any
  external write was performed during this pass.
- No reset, clean, checkout, restore, stash mutation, commit, push, merge,
  broad formatting, or deletion of existing evidence occurred.

## Corrected fact

`DEC-0129` and the TASK-0024 handoff forbid log-body reading. The recorded
TASK-0024 commands

- `sudo -n journalctl -u anqiao-crm --no-pager -q -o cat | wc -l`
- `sudo -n journalctl -u anqiao-crm --no-pager -q -o short-iso | cut -c1-24 | head -1` (and the same with `| tail -1`)

read and processed log records and message text inside the pipelines before
`wc`/`cut` aggregation. Only counts and timestamps are evidenced as printed or
stored in repository evidence; however, the pipelines necessarily read and
processed log records and message text during execution. Prior statements that
no log body was read are therefore false or materially incomplete. The external
access already occurred and cannot be undone by documentation. Per `DEC-0130`,
TASK-0024 is `NOT ACCEPTED / PARTIAL - BOUNDARY INCIDENT RECORDED`, and its
useful non-log observations are preserved only as an unaccepted snapshot.

## Exact changed paths

- `docs/NOW.md` — header + TASK-0024 bullet reconciled to
  `NOT ACCEPTED / PARTIAL - BOUNDARY INCIDENT RECORDED` per `DEC-0130`;
  TASK-0025 correction noted; W5/G7/V1/R2 remain PENDING and unauthorized
- `docs/tasks/TASKS.md` — header, TASK-0024 status row, and override note
  reconciled to the boundary-incident status; TASK-0025 correction noted
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md` — W5 gate row
  and current-phase bullet: TASK-0024 preflight executed but NOT ACCEPTED /
  PARTIAL — BOUNDARY INCIDENT RECORDED; snapshot is unaccepted evidence;
  W5/G7/V1/R2 remain PENDING and unauthorized
- `docs/tasks/active/TASK-0024-w5-read-only-production-preflight.md` —
  status line, step 6 row, Evidence and result section, and Not-verified line
  reconciled to the boundary-incident status
- `docs/tasks/active/TASK-0025-task0024-boundary-incident-reconciliation.md`
  — status updated to `HANDOFF-ONLY / AWAITING CODEX INDEPENDENT REVIEW`;
  execution-result section added
- `docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md` — prominent
  review/correction notice added; §0 method claim, §11 journald section,
  §12 comparison row, §13 NOT-VERIFIED item, and §14 fail-closed claim
  corrected to the accurate boundary; exact commands/results/chronology
  preserved
- `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md` — prominent
  review/correction notice added; §2 row 11, §3 no-write/no-secret statement,
  §4 not-verified item, and §6 result corrected to the accurate boundary;
  exact commands/results/chronology preserved
- `docs/evidence/TASK-0025-DEEPSEEK-PI-CORRECTION-20260812.md` — created
  (this file)

No other path was changed. No decision log, handoff, SPEC, approval JSON,
architecture document, application code, test, migration, script, deployment
file, or configuration was edited.

## Commands and checks actually run (local only)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `git status --short` | 0 | Worktree intentionally dirty on `main`; owned-path changes listed above; no unrelated file touched by this pass |
| 2 | `git diff -- docs/NOW.md docs/tasks/TASKS.md docs/tasks/active/TASK-0001-manual-core-record-activity.md` | 0 | Scoped diff inspected; only the reconciled TASK-0024/TASK-0025 status and boundary-incident wording changed. Owned untracked paths (`TASK-0024`/`TASK-0025` cards, both TASK-0024 evidence files) are untracked files with no `git diff` output; their full content is the correction itself |
| 3 | Scoped `rg` over all owned paths for `journalctl`, `log body`, `TASK-0024`, `not accepted`, `W5`, `G7`, `V1`, `R2` | 0 (matches found) | 126 matches; exact journald commands preserved in both evidence files; `NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED` present in NOW, TASKS, TASK-0001, TASK-0024; `HANDOFF-ONLY / AWAITING CODEX INDEPENDENT REVIEW` present in TASK-0025; W5/G7/V1/R2 remain PENDING/unauthorized in every owned file; no false no-log-body claim remains (remaining `log body` hits are the correction notices quoting the corrected claims) |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | 0 | `[PASS]` — Governance structure and gates are consistent; 8 approved SPECs, 22 active tasks, 1 legacy manifest checked |
| 5 | `git diff --check` | 0 | No whitespace errors (only pre-existing LF→CRLF notices for unrelated tracked files) |

## No-network / no-remote statement

This TASK-0025 pass performed no SSH, DNS, HTTPS, curl, remote shell, network
probe, production read, log access, database access, deployment, migration,
service action, credential/secret read, or any other external action or write.
It is a local repository documentation correction only. No secrets, raw logs,
or business data were read, printed, or stored.

## Not verified

- Codex independent review of the TASK-0025 correction: NOT YET PERFORMED —
  this file is not acceptance evidence.
- The TASK-0024 snapshot's non-log observations remain an **unaccepted
  snapshot**; their factual validity has not been re-established by this
  documentation pass.
- W5 release execution, G7 (DNS/TLS), V1 (runtime verification), and R2
  (independent final review + product-owner acceptance) remain PENDING and
  separately unauthorized; a future production access or release requires a
  new explicit product-owner decision after TASK-0025 independent review
  (`DEC-0130` point 4).

## Decisions needed

- None new from this pass. The next decision is Codex's independent review
  verdict on this correction. A future decision about whether any repeat
  preflight or W5 operation may occur, and the disposition of the unaccepted
  TASK-0024 snapshot, belongs to the product owner after Codex review.

## Awaiting

`CODEX_INDEPENDENT_REVIEW`
