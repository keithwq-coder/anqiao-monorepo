# TASK-0008 S0 freeze check (coordinator-owned)

- Owner: coordinator / architect (opencode, grok-4.5)
- Executor role: **not DeepSeek** — audit/freeze is coordinator work
- Date: 2026-08-04
- Authority: DEC-0080 (scope confirmed; implementation NOT authorized)

## Role correction

DeepSeek implements code only after an implementation DEC. Read-only freeze
checks, gap re-verification, and step acceptance are coordinator duties.

## Suite / governance (this round)

- Local ungated: `106 passed, 1 skipped` (no `CRM_RUN_POSTGRESQL_TESTS`, no DB)
- `scripts/check-governance.ps1` → `[PASS]`

## Freeze assertions vs `src/`

| Assertion | Result | Evidence |
|---|---|---|
| three `from_dict` exist | VERIFIED | `commands.py:53,144,254` |
| `ActivitySummarySource(..., None)` ×3 | VERIFIED | `queries.py:207,253,368` |
| P2 `user_status=ENABLED` ×5 | VERIFIED | `main.py:236,274`; `institutions.py:105,152,189` |
| `transaction_session` exported, no business callers | VERIFIED | `database.py:87`; `__init__.py` export only |
| R-031 correct/withdraw routes absent | VERIFIED | no business withdraw/correct impl beyond schema columns |
| R-035 duplicate prompt absent | VERIFIED | no duplicate/疑似 create-path logic |
| schema supports revision/archive/withdraw | VERIFIED | `models.py` archive/withdrawal constraints |

## Status

- S0: **PASSED** (coordinator)
- Implementation: still **LOCKED** until product owner authorizes TASK-0008
