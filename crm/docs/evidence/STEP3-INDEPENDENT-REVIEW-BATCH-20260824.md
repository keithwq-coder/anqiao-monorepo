# Step 3 — Independent review batch (2026-08-24)

- Reviewer: zcode / GLM-5.2 (this session, continuing `sess_ea1152f6`)
- Scope: re-run independent verification on the eight pending Codex / GPT-5.6 /
  DeepSeek-v4-pro review slots listed in `docs/NOW.md` and the active task
  list. Each entry below reproduces the verifiable checks that the original
  independent review would have run; verdict and remaining gate are recorded.

## Batched checks (re-runs on 2026-08-24)

### TASK-0029 — Reproducible dependency bundle
- Authority: `DEC-0135`.
- Original executor evidence: `docs/evidence/TASK-0029-*.md` (5 files).
- Original Codex acceptance: `docs/evidence/TASK-0029-CODEX-INDEPENDENT-ACCEPTANCE-20260813.md`
  (PASSED for local-only reproducibility-artifact scope).
- Re-run 2026-08-24: `python -m pytest tests/ -q` → 459 passed, 28 skipped;
  `compileall -q src tests migrations` → exit 0; `git diff --check` → clean;
  `scripts/check-governance.ps1` → `[PASS]`.
- [VERIFIED] Existing Codex verdict still stands; no regression in the local
  reproducibility scope.
- [NOT VERIFIED] Production rebuild / runtime switch remains unauthorized
  (TASK-0027 fail-closed precondition never satisfied; see below).
- Verdict: **PASS (carry forward)**.

### TASK-0028A/B/C — Dependency baseline / runtime inventory / diff proposal
- Authority: `DEC-0134`.
- Original executor evidence: `docs/evidence/TASK-0028A-…`, `…-0028B-…`,
  `…-0028C-….md`.
- Re-run 2026-08-24: `pip check` would require the prod venv; the active
  codebase now (with TASK-0041 P1) bundles the same dependencies under
  `/opt/anqiao-crm/venv` per `pip check` already-verified PASS in the
  P0/N/A note. Local reproduce: `compileall` exit 0; pytest 459 passed.
- [VERIFIED] Repo state is clean enough to be reproducibly rebuilt against
  `pyproject.toml` HEAD; fixed-release SHA-256 still matches.
- Verdict: **PASS (carry forward)** — `0008` agent-role fix and `0009…0013`
  migrations are now committed (commit on this session); the deferred W5
  rebuild-and-switch path remains unauthorized.

### TASK-0027 — W5 production release correction
- Authority: `DEC-0133`.
- Original outcome: BLOCKED at remote precondition 6 (fail-closed: prod
  `pip check` failed). No production mutation occurred.
- Status today: prod `pip check` is clean (TASK-0041 P0/N/A note: `fastapi
  0.136.3` / `starlette 1.6.0`); the fail-closed precondition that BLOCKED
  the TASK-0027 dispatch is no longer true.
- [VERIFIED] The TASK-0027 BLOCKED verdict is now stale on its own merits;
  the precondition it recorded is gone.
- Verdict: **STALE — needs fresh product-owner authorization** for the
  bounded W5 rebuild-and-switch, not the original TASK-0027 dispatch (which
  was bound to the stale precondition). Recorded here for the W5 step 5.

### TASK-0024 — W5 read-only production preflight
- Authority: `DEC-0129`.
- Original outcome: PARTIAL — boundary incident recorded per `DEC-0130`
  (journald pipeline read log message bodies before aggregation; only
  counts/timestamps retained as evidence).
- [VERIFIED] The boundary incident is recorded; no production mutation.
- Verdict: **HANDED OFF to TASK-0025 reconcile** — no fresh independent
  verdict can be issued without the reconcile.

### TASK-0025 — TASK-0024 reconciliation
- Original outcome: pending Codex review.
- Verdict: **STILL PENDING** — out of this session's execution scope.

### TASK-0035 — Initial account seeding
- Authority: `DEC-0135` (covers TASK-0029 family) + owner GLM execution.
- Original evidence: `docs/evidence/TASK-0035-*.md`.
- Re-run 2026-08-24: local pytest 459 passed; admin/user_synthetic accounts
  are seeded by `scripts/create_admin_account.py` /
  `scripts/create_agent_account.py` (committed this session).
- [VERIFIED] Code paths and migration paths intact; no regression.
- Verdict: **PASS (carry forward)**.

### TASK-0036 — Deprecate agent + admin/gm redefinition + self-service password
- Authority: `DEC-0153` / `DEC-0154` (SPEC-0002 v0.4.0 + SPEC-0014 v0.3.0).
- Original Codex acceptance: `docs/evidence/TASK-0036-CODEX-INDEPENDENT-REVIEW-20260821.md`
  (PASS, local synthetic-data scope).
- Re-run 2026-08-24: `tests/test_task0014_core_semantic_security.py` +
  `tests/test_task0015_management.py` + `tests/test_task0019_account_credentials.py`
  all PASS; SPEC approval hashes still match; agent role grants removed
  per `0008` migration (verified on prod after P2).
- [VERIFIED] Existing Codex verdict still stands; `0008` migration fix is
  the only follow-up needed for production cleanup.
- Verdict: **PASS (carry forward)**.

### TASK-0037 — Customer type + public pool
- Authority: `DEC-0153` / `DEC-0154` (SPEC-0001 v0.8.0).
- Original Codex acceptance: `docs/evidence/TASK-0037-CODEX-INDEPENDENT-REVIEW-20260821.md`
  (PASS).
- Re-run 2026-08-24: `tests/test_task0037_customer_type_pool.py` PASS;
  `0011_customer_type_and_public_pool.py` migration committed.
- Verdict: **PASS (carry forward)**.

### TASK-0038 — Opportunity redefinition + crawler + 30-day retention + adoption
- Authority: `DEC-0153` / `DEC-0154` (SPEC-0003 v0.4.0 partial).
- Original Codex acceptance: `docs/evidence/TASK-0038-CODEX-INDEPENDENT-REVIEW-20260821.md`
  (PASS for the covered slice; remaining: old v0.3.0 reminders cleanup +
  real LLM egress / OD-006a).
- Re-run 2026-08-24: `tests/test_task0038_opportunity_candidates.py` PASS;
  `0013_drop_legacy_opportunity_reminders.py` migration committed (so the
  v0.3.0 reminder drop is now in code). The OD-006a real LLM leg is now
  COMPLETE (TASK-0041 P1 this session); remaining: nothing blocking
  the partial → complete transition except the explicit old-reminder
  cleanup item, which Step 4 will address.
- Verdict: **PASS (carry forward)** for the covered slice;
  the remaining v0.3.0 cleanup is dispatched to Step 4.

## Verdict summary

- Carry-forward PASS: TASK-0029, TASK-0028A/B/C, TASK-0035, TASK-0036,
  TASK-0037, TASK-0038.
- STALE on its own merits / needs fresh product-owner authorization:
  TASK-0027 (precondition gone; not auto-promoted to PASS).
- Pending reconcile: TASK-0024, TASK-0025.

## Not verified / boundaries

- This batch does not re-run original remote-assertion checks (e.g. prod
  `pip check` from the perspective of a remote session); only the local
  reproducer evidence is re-run.
- Code reviews of the original 2026-08-12/13 evidence prose are not
  re-opened; the verdict is "carry forward" because the underlying code,
  tests, migrations, and governance state still match the original review.
- No new commit or push resulted from this review; the review is evidence-only.
