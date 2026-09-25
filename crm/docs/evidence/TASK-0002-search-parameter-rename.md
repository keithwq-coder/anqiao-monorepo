# TASK-0002 Evidence: Search API parameter rename (SPEC-0008)

> **Current adjudication (2026-08-02, TASK-0006)**
>
> This file is retained as historical execution evidence. Its original observations do not establish current online service/database state or current gate acceptance.
>
> - [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
> - [NOT VERIFIED] TASK-0002 authenticated filtering with `?q=` is not accepted.
> - [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable SPEC-0013 capability remains unauthorized and not implemented.
> - [UNKNOWN] TASK-0006 did not verify the current online database or service state.
> - [AUTHORITY] Current status is governed by `docs/NOW.md`, `docs/tasks/TASKS.md`, and `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`; coordinator/reviewer succession is recorded in `DEC-0066`.

**Date**: 2026-07-30  
**Task**: TASK-0002  
**SPEC**: SPEC-0008 (approved)  
**Evidence type**: Deployment logs, health check, authentication gate verification  

---

## Summary

Search capability implemented via `institutions.py` parameter rename (`search` → `q`) and deployed to cloud server. Service is running (PID 1827001) on `0.0.0.0:8200`. Authentication gate returns 401 as expected. **Auth-required search filtering NOT verified**.

---

## Verification commands & outputs

### Health endpoint

```powershell
curl http://124.222.212.159:8200/health
{
  "status": "ok",
  "service": "anqiao-crm",
  ...
}
```

✅ PASS — service up

---

### Authentication gate (unauthenticated access)

```powershell
curl -i http://124.222.212.159:8200/api/institutions
HTTP/1.1 401 Unauthorized
Content-Type: application/json
...
{"detail":"Authentication required"}
```

✅ PASS — 401 returned without valid session

---

### Parameter name confirmation (server file content)

```powershell
ssh ubuntu@124.222.212.159 "grep -n 'q:' /opt/anqiao-crm/src/crm/web/routes/institutions.py"
127:    q: str | None = Query(None, description="Search term for institutions")
```

✅ PASS — L127 shows `q:` instead of `search`

---

## Known gaps

### Authenticated search filtering not tested

`tmp/test_search.py` passes even when login fails; no evidence of `?q=` returning filtered results after a successful POST `/api/login`. This is the only blocker before marking this task COMPLETE.

**Recommendation**: Run manual curl test with real admin credentials:

```powershell
# Login first (captured session cookie)
curl -v -c cookies.txt -X POST http://124.222.212.159:8200/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"<admin_password>"}'

# Use session to test search
curl -v -b cookies.txt "http://124.222.212.159:8200/api/institutions?q=苏州"
# Expected: count <= total institutions, all matching "苏州" in searchable fields
```

---

## Decisions affecting acceptance

- `DEC-0059`: Public HTTP exposure accepted; no TLS/nginx requirement for debug phase.
- `DEC-0060`: Console PII logging during import not flagged as audit finding.

---

## Conclusion

Status: **NOT VERIFIED** (blocked by missing authenticated search test). All other criteria met (compile, deploy, auth gate OK). Update to COMPLETE once `?q=` filtering confirmed with real credentials.
