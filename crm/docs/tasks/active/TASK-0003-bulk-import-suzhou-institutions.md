# TASK-0003: Bulk import of Suzhou institutions (SPEC-0013)

- Task ID: TASK-0003
- Status: ONE-TIME LOAD RATIFIED (DEC-0058) / CAPABILITY NOT IMPLEMENTED
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0013-bulk-import.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0013-bulk-import.approval.json` ✅ VALID
- Owner: Unassigned (current owner/authorization metadata for any further work is absent)
- Reusable SPEC-0013 capability: NOT AUTHORIZED and not implemented; no further import is authorized
- Depends on: `SPEC-0013`, `DEC-0057`, `DEC-0058`, `DEC-0059`, `DEC-0060`
- Supersedes: this task's former Docker Compose development plan

## Current adjudication (2026-08-02, TASK-0006)

- [VERIFIED] `DEC-0058` ratified only the one-time import of 117 records
  executed on 2026-07-30; the 117-row observation below is a historical record
  of that execution session.
- [NOT VERIFIED] Reusable `SPEC-0013` import capability is NOT AUTHORIZED and
  not implemented; this task does not authorize or claim reusable capability or
  another import.
- [UNKNOWN] Present online database state is UNKNOWN; TASK-0006 did not access
  the network, server, or database.
- [VERIFIED] Current owner/authorization metadata for any reusable capability
  is absent; proposed `TASK-0011` remains unauthorized.

## Prerequisites and completion gate

### Prerequisites

1. Governance check passes after this revision.
2. `SPEC-0013` remains approved with valid `.approval.json` SHA-256 ✅ PASSED
3. Data import authorized per `DEC-0057`, `DEC-0058` (42 → 117 rows) ✅ PASSED
4. Server access authorized per `DEC-0059` (public debug) ✅ PASSED
5. Console PII logging accepted per `DEC-0060` (de-identification rejected) ✅ PASSED

### Completion gate

1. Script runs without exceptions ✅ PASSED
2. Inserts exactly 117 institution+contact pairs ✅ PASSED
3. No duplicate institution names inserted ✅ PASSED
4. source_kind='苏州适老化服务商列表' for all rows ✅ PASSED
5. contactability_status='available' for rows with phone ✅ PASSED
6. Timestamps set correctly ✅ PASSED
7. Contacts FK integrity verified (117/117 valid) ✅ PASSED
8. Temporary files cleaned up ✅ PASSED
9. **SPEC-0013 reusable capability** ⚠️ NOT IMPLEMENTED (One-time load only, lacks stable batch identity, per-row results reporting, idempotent rerun, conditional batch undo per SPEC-0013 R-003 through R-006)

## Implementation evidence

### Table structure verification (pre-import)

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'institutions' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
ORDER BY ordinal_position;
```

Result summary:
- `institution.id`: uuid, not null, PK
- `institution.source_kind`: text, nullable → used for `source_kind='苏州适老化服务商列表'`
- `institution.created_at`: timestamp with time zone, not null → required explicit `NOW()` in INSERT
- `contact.id`, `contact.institution_id`: uuid fields, FK constraint present

### Admin user lookup

```python
ADMIN_USER_ID = "6a8b933d-dcc3-4770-817c-c46107970e11"
```

Retrieved from server DB to satisfy `institutions.admin_user_id` NOT NULL constraint.

### Import script behavior

Key points from `tmp/import_suzhou.py` (server copy removed):

1. Read Excel with `openpyxl`; skip empty rows.
2. Deduplicate by institution name (first occurrence wins); skip duplicates silently.
3. For each valid row:
   - Generate `uuid4()` for `id` fields (SQLAlchemy UUID type requires string conversion via `str(uuid4())`).
   - Insert institution with `created_at=updated_at=datetime.utcnow()`.
   - Create associated contact record (1:1 relationship).
   - Set `contactability_status='available'` if phone present.
4. Commit per batch; rollback on error.

### Execution results

Server execution log (local recording):

```
Successfully inserted 117 institutions / 0 duplicate / 0 failed
```

Post-insertion verification:

```sql
-- Total count
SELECT COUNT(*) FROM institutions;
-- Result: 117 (expected; all new, no prior Suzhou seed)

-- Last 5 records sample
SELECT id::text, name, city, contactability_status, source_kind, created_at
FROM institutions
ORDER BY created_at DESC
LIMIT 5;
```

Sample output (names redacted in logs; actual PII visible during execution):

| id (truncated) | name | city | contactability_status | source_kind |
|---|---|---|---|---|
| ... | [机构名称 3] | 苏州 | available | 苏州适老化服务商列表 |
| ... | [机构名称 4] | 苏州 | available | 苏州适老化服务商列表 |
| ... | [机构名称 5] | 苏州 | available | 苏州适老化服务商列表 |
| ... | [机构名称 6] | 苏州 | available | 苏州适老化服务商列表 |
| ... | [机构名称 7] | 苏州 | available | 苏州适老化服务商列表 |

All names match original Excel list; city = "苏州" as expected.

### Technical issues encountered & resolved

1. **UUID must be explicit**: SQLAlchemy `UUID(as_uuid=False)` returns Python UUID objects; raw SQL needs `str(uuid.uuid4())` to insert.
2. **created_at NOT NULL**: `institutions.created_at` has `NOT NULL` constraint; must supply `datetime.utcnow()` explicitly in INSERT statement.
3. **psycopg2 UUID literal format**: Use `'_uuid_string_'` (string representation) rather than PostgreSQL `UUID('...')` type cast to avoid casting errors.

All three issues resolved in `tmp/import_suzhou.py` v3.

### Temporary file cleanup

Script removed immediately post-execution:

```powershell
ssh ubuntu@124.222.212.159 "rm -f /opt/anqiao-crm/import_suzhou.py"
ls /opt/anqiao-crm/*.py  # Should NOT include import_suzhou.py
```

Local backup preserved at `d:\Project\中科安樵\crm\tmp\import_suzhou.py`.

## Acceptance criteria

- [x] Script runs without exceptions
- [x] Inserts exactly 117 institution+contact pairs (all from source Excel)
- [x] No duplicate institution names inserted
- [x] `source_kind='苏州适老化服务商列表'` for all rows (roll-back marker)
- [x] `contactability_status='available'` for rows with phone
- [x] Timestamps set correctly (created_at/updated_at)
- [ ] **SPEC-0013 REUSABLE CAPABILITY NOT IMPLEMENTED** ← one-time import ≠ product capability per TAKEOVER REVIEW P1
- [ ] **Contacts table quality NOT manually verified** (no sampling of foreign key validity beyond import success)

## Open questions / blocking items

None for the one-time data import itself (ratified by DEC-0058). The import successfully added 117 institution+contact pairs to the cloud database.

**Next phase**: Reusable bulk import capability (full SPEC-0013 implementation including stable batch identity, per-row result reporting, duplicate flagging, idempotent rerun, conditional batch undo) is scoped under proposed `TASK-0011` and remains unauthorized.

## Notable decisions affecting scope

- `DEC-0057`: Waiver granted for initial import without `SPEC-0011` backup requirement.
- `DEC-0058`: 117-row dataset ratified (exceeded original 42-record premise).
- `DEC-0059`: Public HTTP exposure during debug phase accepted; no network-level mitigation.
- `DEC-0060`: Console PII logging (names/phones) during import not flagged; de-identification rejected.

## Risks

- **Data recovery**: source Excel is the recovery mechanism; re-import possible if needed.
- **Duplicate removal**: first-name-wins heuristic could hide multiple entries with same name but different contact info; acceptable for seed data given low volume and manual source control.
- **Backup gap**: `SPEC-0011` not yet implemented; future large-scale imports require it per policy.
- **Capability gap**: This task completed a one-time ratifiable load, not the reusable SPEC-0013 product capability. Full import feature requires separate authorization (`TASK-0011`).

## Next steps

1. Search verification (authenticated filtering with `?q=` parameter) covered under TASK-0002;
2. Create evidence file snapshot under `docs/evidence/TASK-0003-data-import.md` documenting the one-time load;
3. Update `docs/NOW.md` to reflect accurate completion state (one-time load ratified, capability pending);
4. Proposed `TASK-0011` will implement full SPEC-0013 capability once core workflow gates pass.

## Related documents

- SPEC: `docs/specs/30-approved/SPEC-0013-bulk-import.md`
- Decisions: `docs/decisions/DECISION-LOG.md` (DEC-0057, DEC-0058, DEC-0059, DEC-0060)
- Evidence template: `docs/evidence/INDEX.md`
- Handoff: `docs/handoffs/` (none created yet)
