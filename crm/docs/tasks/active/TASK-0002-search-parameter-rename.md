# TASK-0002: Search API parameter rename (SPEC-0008)

- Task ID: TASK-0002
- Status: PARTIAL ✓ LOCAL (historical evidence) / ⚠️ REMAINING: AUTHENTICATED SEARCH FILTERING NOT VERIFIED
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0008-search.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0008-search.approval.json` ✅ VALID
- Implementation authorized by: NOT VERIFIED (task authorization/ownership metadata is incomplete)
- Owner: Unassigned
- Depends on: `SPEC-0008`, `TASK-0001`
- Supersedes: this task's former search filter implementation plan

## Current adjudication (2026-08-02, TASK-0006)

- [VERIFIED] The local parameter rename (`search` → `q`) recorded below is
  historical evidence from the prior execution.
- [VERIFIED] The deployment, health-endpoint, auth-gate (401), and server
  observations below are historical claims from the prior execution session,
  not current runtime proof; TASK-0006 did not access the network, server, or
  database.
- [NOT VERIFIED] Authenticated filtering with the `?q=` parameter remains
  unverified; the prior execution never completed an authenticated search
  check, and this behavior is kept separate from the local rename evidence.
- [UNKNOWN] Current online service and database state.
- [VERIFIED] TASK-0002 implementation authorization and current owner metadata
  are incomplete/unassigned; TASK-0002 is not accepted or complete.

## Prerequisites and completion gate

### Prerequisites

1. Governance check passes after this revision.
2. `SPEC-0008` remains approved with valid `.approval.json` SHA-256 ✅ PASSED
3. Server access authorized per `DEC-0059` (public debug) ✅ PASSED
4. Authentication fixes in S4 verified prior to search test ✅ PASSED

### Completion gate

(All ✅ PASSED entries below are historical claims recorded by the prior
execution; they are not current runtime proof.)

1. Code compiles and deploys without errors ✅ PASSED  
2. Health endpoint responds OK ✅ PASSED  
3. Parameter renamed from `search` → `q` ✅ PASSED
4. Auth gate working (401 for unauthenticated) ✅ PASSED
5. **SEARCH FILTERING WITH REAL CREDENTIALS** ⚠️ PENDING (Authenticated search with `?q=` parameter not executed)

## Implementation evidence

### Local changes verified

Before running `check-governance.ps1`, the repository contained:

```bash
$ powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
  - Approved SPECs: 7
  - Active tasks: 2
  - Legacy manifests checked: 1
```

Code change summary:

- `institutions.py`:
  - L127: `q: str | None = Query(None, ...)` (was `search`)
  - L153: `search_terms=q` passed to `find_institutions()`

### Deployment evidence

Server: `ubuntu@124.222.212.159`

```powershell
# scp upload (after retransmit due to port occupation)
scp tmp/institutions.py ubuntu@124.222.212.159:/opt/anqiao-crm/src/crm/web/routes/

# systemd restart (server already had old process; killed & restarted)
ssh ubuntu@124.222.212.159 "systemctl kill --kill-who=main anqiao-crm.service"
ssh ubuntu@124.222.212.159 "systemctl start anqiao-crm.service"
ssh ubuntu@124.222.212.159 "ps aux | grep uvicorn | grep -v grep"
# PID 1827001 listening on 0.0.0.0:8200 (DEC-0059: public debug accepted)

# file content confirmation
ssh ubuntu@124.222.212.159 "grep -n 'q:' /opt/anqiao-crm/src/crm/web/routes/institutions.py"
# Expected output: L127 contains 'q: str'
```

Health check & auth gate verification:

```powershell
curl http://124.222.212.159:8200/health
# { "status": "ok", ... }

curl http://124.222.212.159:8200/api/institutions
# HTTP 401 (expected; unauthenticated)
```

### Verification status (auth-required search NOT tested)

- [x] Health endpoint functional
- [x] Auth gate returns 401 without session
- [ ] Post-authentication search filtering NOT executed: no test with real credentials and `?q=` parameter confirming results are filtered
- [ ] No end-to-end scenario (login → search multiple terms → verify count reduction)

**Finding**: `tmp/test_search.py` is a stub; it passes even when login fails (prints ALL TESTS PASSED on 401 path). This is **NOT VERIFIED** per governance rules.

**Current State (reconciled 2026-08-02)**: The local parameter rename is historical evidence from the prior execution. The deployment, health, and auth-gate observations are historical claims from that session, not current runtime proof; current online state is UNKNOWN. The critical acceptance criterion — authenticated filtering of results with the `?q=` parameter — remains NOT VERIFIED. TASK-0002 is not accepted or complete.

## Acceptance criteria

- [x] Code compile/run locally
- [x] Deployed to server; service up; health OK
- [x] Parameter renamed; backward compatibility removed (expected)
- [x] Authentication required to reach `/api/institutions`
- [ ] **SEARCH FILTERING VERIFIED WITH REAL CREDENTIALS** ← still pending

## Open questions / blocking items

- Pending: Authenticated search verification (`POST /api/auth/login` → `GET /api/institutions?q=term`) not yet executed
- No immediate security risk if left unverified; product owner has high tolerance for dev-phase debugging exposure (DEC-0059, DEC-0060).

## Notable decisions affecting scope

- `DEC-0059`: Public HTTP exposure of debug listener explicitly accepted; not rolled back.
- `DEC-0060`: Data de-identification rejected; console PII logging during import/search not flagged as audit finding.

## Next steps

1. Execute authenticated search verification against cloud DB (`POST /api/auth/login` followed by `GET /api/institutions?q=term`);
2. Update status to COMPLETE once search filtering verified;
3. Create evidence file under `docs/evidence/TASK-0002*.md`.
4. Update `docs/NOW.md` with accurate completion state.

## Related documents

- SPEC: `docs/specs/30-approved/SPEC-0008-search.md`
- Decisions: `docs/decisions/DECISION-LOG.md` (DEC-0059, DEC-0060)
- Handoff: `docs/handoffs/` (none created for this small change yet)
