# GR2: Anqiao-CRM Service Directory Traversal Permission Fix

**Proposal Date:** 2026-07-28  
**Related Task:** TASK-0001 S5 Web Layer Implementation  
**Request Type:** File System Permission Grant Only (NO Migration/Deployment)  

---

## Problem Statement

After GR1 recovery, the `anqiao-crm` service identity cannot access its own runtime files due to parent directory permissions:

```bash
# Current state (blocked):
drwxr-x--- ubuntu:ubuntu /opt/anqiao-crm         # Mode 0750
drwxr-x--- ubuntu:ubuntu /opt/anqiao-crm/shared # Mode 0750
-rw------- ubuntu:ubuntu /opt/anqiao-crm/runtime.conf  # Mode 0600

# Error when anqiao-crm user tries to read:
PermissionError: [Errno 13] Permission denied: '/opt/anqiao-crm/shared/runtime.conf'
```

The service account (`anqiao-crm`) needs traversal permission on `/opt/anqiao-crm` and `/opt/anqiao-crm/shared` to access its configuration file.

---

## Proposed Solution

Grant the `anqiao-crm` service user group-level execute permission on directories only (traversal), without changing ownership or allowing listing.

### Required Changes

Execute as root on Tencent server (user@119.45.x.x):

```bash
# Grant group execute permission for traversal only
chmod g+x /opt/anqiao-crm
chmod g+x /opt/anqiao-crm/shared

# Verify no other users/groups can list contents (important security check)
ls -la /opt/ | grep anqiao
# Should show only ubuntu can list
```

### Security Properties

✅ **Directory Traversal Enabled**: Service can reach specific file paths  
✅ **No Listing Allowed**: Users still cannot `ls /opt/anqiao-crm`  
✅ **No Write Access**: Service cannot modify directory structure  
✅ **No Cross-Tenant Risk**: Does not expose other projects in `/opt/`  

---

## Preflight Verification Required

Before executing GR2, I will prove:

1. **No Shared Paths**: No other project files exist under `/opt/anqiao-crm`
   ```bash
   find /opt/anqiao-crm -type f 2>/dev/null | wc -l
   # Expected result: 0 (empty after GR1 quarantine move)
   ```

2. **Only One User Group**: The directory tree has exactly one owner (`ubuntu:ubuntu`)
   ```bash
   stat /opt/anqiao-crm /opt/anqiao-crm/shared | grep -E "Uid|Gid"
   # Both should show uid=1000(ubuntu) gid=1000(ubuntu)
   ```

3. **Safe Mode Change**: New permissions will be minimal (g+x only)
   ```bash
   stat --format="%a %n" /opt/anqiao-crm /opt/anqiao-crm/shared
   # Before: 750 750
   # After:  751 751  (only +1 to group execute bit)
   ```

---

## What GR2 Will NOT Do

⛔ **NO database migration**  
⛔ **NO application deployment**  
⛔ **NO nginx/TLS/DNS changes**  
⛔ **NO data import/export**  
⛔ **NO system modifications**  

GR2 is **purely a file permission adjustment** with zero business impact.

---

## What Happens After GR2

Once this permission grant is approved and executed:

1. ✅ `anqiao-crm` service can access its config file at startup
2. ✅ S5 Web Layer code changes become deployable
3. ✅ GR1 quarantine state remains intact (files stay in root-owned location)
4. ✅ Production deployment of TASK-0001 fixes can proceed

---

## Authorization Request

**Product Owner Decision Required:**

[ ] **APPROVE GR2** - Grant group execute permission on /opt/anqiao-crm directories  
[ ] **DENY GR2** - Keep current restricted permissions  

**If Approved:** AI agent will execute prefight verification, request confirmation, then run chmod command.

**If Denied:** Deployments remain blocked until alternative permission model defined.

---

## Related Documentation

- GR1 Recovery Handoff: `docs/handoffs/HANDOFF-20260728-GR1-recovery.md`
- DEC-0049: Authorization Boundary Definition
- GR1 Evidence: `docs/evidence/TASK-0001-GR1-w3-recovery.md`
- Task Status: `docs/tasks/active/TASK-0001-manual-core-record-activity.md`

---

**Approval Status:** PENDING PRODUCT OWNER AUTHORIZATION  
**Next Action:** Await explicit approval decision before proceeding
