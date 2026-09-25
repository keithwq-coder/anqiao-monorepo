# TASK-0004: Fix Query Service Dependency Injection Issue - SUPERSEDED

**Status**: SUPERSEDED BY TASK-0006 RECONCILIATION  
**Task ID**: TASK-0004  
**Original Owner**: Qwen3.8  
**Created**: 2026-07-30  
**Superseded**: 2026-07-31 by TASK-0006 reconciliation  

---

## Coordination History (Retained for Historical Reference)

This task was superseded during the TASK-0006 governance reconciliation phase. The original attachment conclusion that "query_service dependency injection is working properly" was rejected by the architecture takeover review because a fresh local `TestClient` request returned HTTP 500 with `NameError: name 'request' is not defined`.

The coordinated adjudication at the top of the original file records:

- A fresh local `TestClient` request to `/api/institutions` returned HTTP 500. The traceback ends at `src/crm/web/routes/institutions.py:126` with `NameError: name 'request' is not defined` while FastAPI evaluates `Depends(lambda: request.app.state.query_service)`.
- Current routing: durable authentication/session work belongs to proposed `TASK-0007`; institution/application/query repair belongs to proposed `TASK-0008`. Both require explicit implementation authorization.

Everything below this section is retained as historical external-tool output, not as accepted evidence or an executable task plan.

---

## Original Investigation Results (Historical Only - Not Accepted Evidence)

*See original file at git history for full details.*

---

## TASK-0006 Reconciliation Verdict

**This task is SUPERSEDED and NOT AUTHORIZED for implementation.**

The issues originally attributed to "query_service dependency" are now understood to be symptoms of deeper architectural problems documented in the TAKEOVER REVIEW (P0/P1 defects). These will be addressed through the proposed task sequence:

1. **TASK-0007**: Durable authentication and role/scope authorization
2. **TASK-0008**: Application commands, queries, and core record workflow repair
3. **TASK-0009**: Integration test baseline
4. **TASK-0010**: Search security verification

No implementation may proceed until TASK-0006 completes and each subsequent task receives explicit product-owner authorization.

---

## Historical Record Only

This file exists only as historical reference. Do not use any claims or analysis from the superseded portion as current truth or implementation guidance.

All facts about current repository state must be verified directly from source code and runtime probes, not from model memory or chat context.
