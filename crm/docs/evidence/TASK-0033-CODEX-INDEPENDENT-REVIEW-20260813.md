# TASK-0033: Codex independent review — V1 verification + loopback acceptance (2026-08-13)

- Status: **PASSED — V1 business verification and loopback tightening
  ACCEPTED**.
- Authority: `DEC-0143`; approved `SPEC-0012 v0.2.0`.
- Executor: DeepSeek in PI through `opencode-go/deepseek-v4-flash` (gateway
  selector only, upstream identity not asserted).
- Reviewer and acceptance decision-maker: Codex (running as
  `opencode-go/deepseek-v4-pro` in PI; gateway selector only).

## Independent repository evidence

1. [VERIFIED] HEAD is `59101b80b6420155bf8aec26b14ea7800979db86`; no new
   commit. Application/migration/test files untouched during the execution
   window. Writes confined to the TASK-0033 exclusive paths. Governance
   `[PASS]` (32 active tasks); `git diff --check` exit 0. No secret, session
   token, or credential value in the TASK-0033 evidence/card files (the only
   grep hits were the "NOT self-accepted" wording).

## Independent server verification (read-only)

1. [VERIFIED] Loopback service healthy: `curl http://127.0.0.1:8200/login` →
   200.
2. [VERIFIED] Listener tightened: `ss -ltn` shows `127.0.0.1:8200` only
   (`0.0.0.0:8200` is gone).
3. [VERIFIED] Public HTTPS still serves: `curl https://crm.aibrain.wiki/login`
   → 200 (via nginx → loopback).
4. [VERIFIED] `start.sh` line 33 is now `--host 127.0.0.1`; the backup
   `start.sh.bak-v1` is present for reversibility.
5. [VERIFIED] Database revision `0005_opportunity_reminders_ai_reasoning`;
   `pip check` clean; fastapi 0.136.3 / starlette 1.6.0.
6. [VERIFIED — independent re-check] Masking active: re-login as the synthetic
   business user (200) → institution detail page returns 200 with exactly one
   `***` masking marker (a contact value masked for the non-owner), confirming
   the executor's masking observation.

## Verdict

`APPROVE_AND_DISPATCH_NEXT_TASK` for the bounded scope: TASK-0033 is
**ACCEPTED**. The released production system serves the business flows with
field-level masking active, and the application port is no longer publicly
exposed.

## Boundaries / not verified (remaining gates)

- A full per-field masking matrix walkthrough (all roles × all fields) was not
  performed; the verification confirms masking is active for a non-owner
  business user on a contact value.
- G7 (DNS/TLS): the CRM already serves HTTPS at `crm.aibrain.wiki` (verified
  200), so there is no observed pending DNS/TLS change; a formal G7 sign-off
  remains a product decision.
- R2 (product-owner visual/business acceptance) is the remaining human gate
  and is separate.
