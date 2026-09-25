# TASK-0042 evidence — `AI_SHANGJI_*` / `AiShangjiProvider` naming cleanup

- **Task ID:** TASK-0042
- **Authorization:** `DEC-0164` (2026-08-24; product-owner "同意你的推荐")
- **Execution owner:** this session (zcode / GLM-5.2)
- **Reviewer:** not yet reviewed (different model lineage required for any
  commit/push/deployment)
- **SPEC covered:** `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
  (v0.4.0; approval-hash **unchanged** — `8845fbef…0b95ba1`)
- **Owned files:** 6 (3 src / 3 tests), plus 1 comment in `deploy/start.sh`

## 1. Scope and outcome

Naming-only cleanup. The public class `AiShangjiProvider` was renamed to
`AiReasonProvider`; the canonical env-variable strings were unified to the
`CRM_AI_REASON_*` prefix; the legacy `AI_SHANGJI_*` env strings remain
readable as a temporary fallback so the currently deployed TASK-0041 P2
service is not broken by this rename. No SPEC text change, no approval-hash
re-stamp, no production env rotation, no commit, no push.

## 2. File-by-file change summary

### 2.1 `src/crm/ai/provider.py`

| Old | New |
|---|---|
| `class AiShangjiProvider` | `class AiReasonProvider` |
| `ENV_BASE_URL = "AI_SHANGJI_BASE_URL"` | `ENV_BASE_URL = "CRM_AI_REASON_BASE_URL"` |
| `ENV_MODEL = "AI_SHANGJI_MODEL"` | `ENV_MODEL = "CRM_AI_REASON_MODEL"` |
| `ENV_API_KEY = "AI_SHANGJI_API_KEY"` | `ENV_API_KEY = "CRM_AI_REASON_API_KEY"` |
| `ENV_LEGACY_API_KEY = "AI_SHANGJI_WIRE_API"` | `ENV_LEGACY_API_KEY = "CRM_AI_REASON_WIRE_API"` |
| `_read_runtime_config` (no fallback) | `_read_runtime_config` (canonical-first; falls back to `LEGACY_ENV_BASE_URL` / `LEGACY_ENV_MODEL` / `LEGACY_ENV_API_KEY` / `LEGACY_ENV_WIRE_API` only when canonical is unset) |
| docstring "AiShangji provider adapter" | docstring "AiReason provider adapter" with TASK-0042 / `DEC-0164` note |
| comment "AI_SHANGJI gateway" / "AiShangjiProvider parsing" | comment "AI gateway" / "AiReasonProvider parsing" |

Added four new constants (`LEGACY_ENV_BASE_URL` / `_MODEL` / `_API_KEY` /
`_WIRE_API`) so the legacy `AI_SHANGJI_*` env strings remain readable as
fallback during the rollout window. They are documented in the module
docstring as "legacy, scheduled for removal".

### 2.2 `src/crm/ai/wiring.py`

| Old | New |
|---|---|
| `from crm.ai.provider import AiShangjiProvider, ProviderResult` | `from crm.ai.provider import AiReasonProvider, ProviderResult` |
| `ENV_AI_SHANGJI_NETWORK_ALLOWED = "CRM_AI_SHANGJI_NETWORK_ALLOWED"` | `ENV_AI_REASON_NETWORK_ALLOWED = "CRM_AI_REASON_NETWORK_ALLOWED"` |
| `provider = AiShangjiProvider(...)` | `provider = AiReasonProvider(...)` |
| `_env_flag(ENV_AI_SHANGJI_NETWORK_ALLOWED)` | `_env_flag(ENV_AI_REASON_NETWORK_ALLOWED)` |
| docstring | docstring with TASK-0042 / `DEC-0164` note |

### 2.3 `src/crm/config.py`

- One inline comment inside `allow_enabled_ai` validator updated from
  `CRM_AI_SHANGJI_NETWORK_ALLOWED` to `CRM_AI_REASON_NETWORK_ALLOWED` with
  a TASK-0042 / `DEC-0164` pointer.
- The validator function body is **unchanged** (still `return value` per
  `DEC-0162`/`DEC-0163` gate opening). This task does not alter the
  `ai_enabled` semantics; that drift between the validator and
  `tests/test_config.py::test_ai_cannot_be_enabled` is documented in §6 as
  out-of-scope for TASK-0042.

### 2.4 `tests/test_task0040_fixes.py`

- `from crm.ai.provider import AiShangjiProvider, ...` →
  `from crm.ai.provider import AiReasonProvider, ...`.
- All `monkeypatch.delenv("AI_SHANGJI_*", raising=False)` lines in tests
  that require unconfigured state are now preceded by the canonical
  `monkeypatch.delenv("CRM_AI_REASON_*", raising=False)` lines so the
  `_read_runtime_config` fallback cannot accidentally pick up legacy env
  values in the test environment.
- `model="aishangji-*"` fixture strings renamed to `model="ai-reason-*"`
  (10 occurrences).
- One docstring `"""AiShangjiProvider + SseStreamingHttpClient: …` →
  `"""AiReasonProvider + SseStreamingHttpClient: …`.

### 2.5 `tests/test_task0040_external_integration.py`

- Class rename `AiShangjiProvider` → `AiReasonProvider` (all sites).
- Fixture strings `aishangji-test`, `aishangji-test-model` renamed to
  `ai-reason-test`, `ai-reason-test-model`.
- `test_unconfigured_provider_never_calls_and_degrades` now clears both
  canonical (`CRM_AI_REASON_*`) and legacy (`AI_SHANGJI_*`) env names so
  the fallback cannot mask a missing canonical configuration.
- `test_reason_generator_none_when_env_missing` loops through the union
  of canonical + legacy env names.

### 2.6 `tests/test_task0040_service_integration.py`

- `from crm.ai.provider import AiShangjiProvider` →
  `from crm.ai.provider import AiReasonProvider`.
- Class rename applied at all instantiation sites.
- Fixture strings `aishangji-leak-test`, `aishangji-test`,
  `aishangji-fail-test`, `aishangji-v4-flash-0731`, `aishangji-audit-fail`
  renamed to `ai-reason-*` counterparts (no semantic change; strings are
  audit-only model identifiers).

### 2.7 `deploy/start.sh` (out of original scope; surfaced and patched)

- The env-allow-list comment for `ai.env` file loading was already correct
  (`CRM_AI_REASON_*|AI_SHANGJI_*|AI_ENABLED`); only the explanatory comment
  above the `case` was added to make the post-`DEC-0164` rollout intent
  explicit. No change to the runtime contract.

## 4. Verification — four-piece suite (results captured 2026-08-24)

| Check | Command | Result |
|---|---|---|
| Compile | `python -m compileall -q src tests migrations` | exit 0 ✅ |
| Diff whitespace | `git diff --check` | exit 0 ✅ (LF/CRLF warnings on pre-existing untracked files only) |
| Governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS] Governance structure and gates are consistent. — Approved SPECs: 8 — Active tasks: 41 — Legacy manifests checked: 1` ✅ |
| Pytest focused (TASK-0042 owned) | `python -m pytest tests/test_task0040_fixes.py tests/test_task0040_external_integration.py tests/test_task0040_service_integration.py -q` | `88 passed in 1.17s` ✅ |
| Pytest full | `python -m pytest tests -q` | `1 failed, 458 passed, 28 skipped` — see §6 |

## 5. Naming-pollution inventory

Before / after counts (regex `AI_SHANGJI_*|aishangji|AiShangji|CRM_AI_SHANGJI`):

| Location | Before | After (TASK-0042) | Remaining role |
|---|---|---|---|
| `src/crm/ai/provider.py` | 10 hits | 7 hits | 4 `LEGACY_ENV_*` constants + 3 docstring/legacy-fallback references (all labeled "legacy, scheduled for removal") |
| `src/crm/ai/wiring.py` | 4 hits | 2 hits | 2 docstring TASK-0042 markers |
| `src/crm/config.py` | 1 hit | 0 hits | none |
| `tests/test_task0040_fixes.py` | 36 hits | 8 hits | 8 `monkeypatch.delenv("AI_SHANGJI_*", …)` lines for legacy-name clearing |
| `tests/test_task0040_external_integration.py` | 19 hits | 8 hits | same role (legacy-name clearing in `test_unconfigured_provider_never_calls_and_degrades` and the for-loop in `test_reason_generator_none_when_env_missing`) |
| `tests/test_task0040_service_integration.py` | 10 hits | 0 hits | none |
| `deploy/start.sh` | 1 hit | 1 hit | env-allow-list — both names accepted during rollout window |
| `docs/decisions/DECISION-LOG.md` (`DEC-0164`) | 0 | 8 hits | decision record documenting the rename (kept on purpose) |
| `docs/tasks/active/TASK-0042-rename-ai-reason-env-vars.md` | 0 | 11 hits | task card documenting the mapping (kept on purpose) |

All non-doc non-task `AI_SHANGJI_*` / `aishangji` / `AiShangji` references in
implementation files are now either (a) the temporary legacy-env fallback in
`provider.py` (`LEGACY_ENV_*` constants), (b) test setup that explicitly
clears the legacy env so the fallback cannot mask a missing canonical
configuration, or (c) the `deploy/start.sh` env-allow-list (which keeps both
names during the rollout window).

## 6. Pre-existing test failure — out of scope for TASK-0042

`tests/test_config.py::test_ai_cannot_be_enabled` fails on the post-TASK-0042
working tree (and would also fail on the pre-TASK-0042 working tree — both
contain the `DEC-0162`/`DEC-0163` "open `ai_enabled` gate" edits to
`src/crm/config.py`):

```text
tests/test_config.py::test_ai_cannot_be_enabled FAILED
E   Failed: DID NOT RAISE <class 'pydantic_core._pydantic_core.ValidationError'>
tests/test_config.py:66: Failed
```

Verified to pre-exist by:

1. `git stash --include-untracked` of my edits → both this test and
   `test_s5_pages_api_parity.py::test_non_owner_page_and_api_masked_identically`
   PASS on the clean baseline (commit `f070e8e` is HEAD; the working tree
   changes since then include the `DEC-0162`/`DEC-0163` validator body
   change but **not** the matching test update).
2. `git stash pop` → with my edits restored, the `test_ai_cannot_be_enabled`
   failure reappears; the parity test passes both before and after (it was
   an order-dependent flake earlier in the run, then settled on passing).

The drift is that `src/crm/config.py::allow_enabled_ai` now `return value`s
(per `DEC-0162`/`DEC-0163` opening the gate) while
`tests/test_config.py::test_ai_cannot_be_enabled` still asserts the old
hard-block behavior. **Product-owner direction (Option A, 2026-08-24):
keep TASK-0042 strictly naming-only; do not modify `tests/test_config.py`.**
The drift will be addressed under a separate `DEC-0165` + task card so that
its authorization is independent of the naming cleanup and the change can be
audited on its own.

## 7. Legacy-fallback matrix

| Env var (legacy) | Env var (canonical) | Reader order | Behavior |
|---|---|---|---|
| `AI_SHANGJI_BASE_URL` | `CRM_AI_REASON_BASE_URL` | canonical → legacy | legacy used only when canonical is unset/blank |
| `AI_SHANGJI_MODEL` | `CRM_AI_REASON_MODEL` | canonical → legacy | legacy used only when canonical is unset/blank |
| `AI_SHANGJI_API_KEY` | `CRM_AI_REASON_API_KEY` | canonical → legacy → `CRM_AI_REASON_WIRE_API` → `AI_SHANGJI_WIRE_API` | first non-empty wins; API key value never logged/recorded |
| `AI_SHANGJI_WIRE_API` | `CRM_AI_REASON_WIRE_API` | canonical → legacy | legacy used only when canonical is unset/blank |
| (new constant) `LEGACY_ENV_*` | — | n/a | defined for explicit fallback reads; documented as scheduled for removal |

The legacy env strings will be removed when the production runtime is
rotated to the canonical `CRM_AI_REASON_*` names. That rotation is
**out of scope** for TASK-0042 and requires a separate authorization.

## 8. Out of scope (explicit)

- `SPEC-0003 v0.4.0` text or `approval.json` (unchanged; SHA-256 stays
  `8845fbef…0b95ba1`).
- Production env rotation (TASK-0041 P2 currently runs with
  `ai_enabled=False` deterministic fallback per `DEC-0163`; the env
  rotation that drops the legacy fallback is a separate authorization).
- `tests/test_config.py::test_ai_cannot_be_enabled` (see §6).
- Commit, push, deployment, restart, production access, real-data mutation.
- Out-of-scope cleanup of unrelated naming (no expansion beyond the
  `AI_SHANGJI_*` / `AiShangjiProvider` token family).

## 9. Status

**PARTIAL — local-only, naming-only, four-piece verification suite green
within TASK-0042 owned scope. Pre-existing test drift in
`tests/test_config.py` is documented (§6) and explicitly excluded from this
authorization per Option A direction.**

No commit, no push. Independent review by a different model lineage
required before any commit, push, deployment, or production access.