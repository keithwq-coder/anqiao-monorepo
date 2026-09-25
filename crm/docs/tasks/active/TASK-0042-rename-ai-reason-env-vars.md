# TASK-0042: Rename `AI_SHANGJI_*` / `AiShangjiProvider` to unified `CRM_AI_REASON_*` / `AiReasonProvider`

- Task ID: TASK-0042
- Status: ACTIVE
- Task type: NAMING CLEANUP (no behavior change)
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
  (covers the AI reason-generation behavior; this task changes naming only)
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
  — SHA-256 **unchanged** (`8845fbef…0b95ba1`)
- Authorization: `DEC-0164` (2026-08-24; product-owner "同意你的推荐")
- Execution owner: this session (zcode / GLM-5.2)
- Review/acceptance owner: independent review required (different model
  lineage); not part of this task.
- Depends on: TASK-0040 ACCEPTED (`DEC-0161`); TASK-0041 P0 N/A + P1 BLOCKED
  + P2 COMPLETE (production deployed with `ai_enabled=False` per `DEC-0163`)

## Goal

Remove the legacy `AI_SHANGJI_*` / `AiShangjiProvider` naming pollution from the
implementation layer of `SPEC-0003 v0.4.0`, while preserving the deployed
production service contract via a temporary legacy-env fallback. Behavior of the
adapter (env-configured, fail-closed, leak-scanned, deterministic-fallback)
is unchanged.

## Unified mapping (per `DEC-0164`)

| Old token | New token | Notes |
|---|---|---|
| `class AiShangjiProvider` | `class AiReasonProvider` | Public class; import path unchanged (`crm.ai.provider`) |
| `ENV_BASE_URL = "AI_SHANGJI_BASE_URL"` | `"CRM_AI_REASON_BASE_URL"` | New canonical env string |
| `ENV_MODEL = "AI_SHANGJI_MODEL"` | `"CRM_AI_REASON_MODEL"` | New canonical env string |
| `ENV_API_KEY = "AI_SHANGJI_API_KEY"` | `"CRM_AI_REASON_API_KEY"` | New canonical env string |
| `ENV_LEGACY_API_KEY = "AI_SHANGJI_WIRE_API"` | `"CRM_AI_REASON_WIRE_API"` | Renamed **constant**; legacy env-string still readable |
| `ENV_AI_SHANGJI_NETWORK_ALLOWED = "CRM_AI_SHANGJI_NETWORK_ALLOWED"` | `"CRM_AI_REASON_NETWORK_ALLOWED"` | Constant renamed; new canonical env string |
| `model="aishangji-*"` (tests) | `model="ai-reason-*"` | Test fixture strings |
| docstring "AI_SHANGJI gateway" / "AiShangjiProvider parsing" | "AI gateway" / "AiReasonProvider parsing" | Comment polish |
| `_read_runtime_config` legacy fallback | **kept** | Old `AI_SHANGJI_*` env strings remain readable when new strings unset; docstring marks them "legacy, scheduled for removal" |

## Owned files (six)

1. `src/crm/ai/provider.py` — class rename, four `ENV_*` constant string
   changes, `_read_runtime_config` extended with legacy fallback, two
   docstrings updated.
2. `src/crm/ai/wiring.py` — import updated; `ENV_AI_REASON_NETWORK_ALLOWED`
   constant value updated; `AiReasonProvider` instantiation.
3. `src/crm/config.py` — one inline comment in `allow_enabled_ai` validator
   references the new env name.
4. `tests/test_task0040_fixes.py` — import, `monkeypatch.delenv` names,
   `model="aishangji-*"` fixtures, one docstring.
5. `tests/test_task0040_external_integration.py` — same shape.
6. `tests/test_task0040_service_integration.py` — same shape.

## Out of scope

- `SPEC-0003 v0.4.0` text or `approval.json` (unchanged).
- Production env rotation (left to the next deployment cycle).
- Production access, deployment, restart, migration, audit-record content.
- Other naming pollution unrelated to `AI_SHANGJI_*` / `AiShangjiProvider`.
- Commit, push (separately authorized).

## Prerequisites and completion gate

- Prerequisites: TASK-0040 ACCEPTED; TASK-0041 P2 deployed; `DEC-0164`; no
  in-flight change to the same six files.
- Completion gate:
  1. `pytest tests -q` green.
  2. `python -m compileall -q src tests migrations` exit 0.
  3. `git diff --check` clean.
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
     `[PASS]`.
  5. Evidence file `docs/evidence/TASK-0042-NAMING-CLEANUP-20260824.md`
     records before/after token counts, the six-file modification summary,
     and the legacy-fallback matrix.
  6. No commit, no push.

## Execution record (2026-08-24, zcode / GLM-5.2)

Implementation completed in this session under `DEC-0164`. The four-piece
verification suite is run after all six files are edited. Evidence file
records the verification commands and outputs. No commit, no push, no
production access.

## Acceptance gate

Task remains ACCEPTED (locally; no production re-verification implied) once
the four-piece verification passes and evidence is on disk. Independent
review by a different model lineage is required for any deployment or
commit. Production env rotation to drop the legacy fallback is a separate
authorization.