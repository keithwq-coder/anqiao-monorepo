# TASK-0017 Coordinator Audit (Round 1) — 2026-08-06

- Auditor: current coordinator
- Subject: GLM TASK-0017 implementation report (SPEC-0011 lifecycle, erasure,
  propagation)
- Basis: `docs/tasks/active/TASK-0017-data-lifecycle-erasure.md`,
  `SPEC-0011 v0.2.0` (approval hash re-verified), `DEC-0104`, `DEC-0105`
- Verdict: **REMEDIATION-REQUIRED** (one blocking finding F1; two
  non-blocking observations F2/F3)

## 1. Independent re-verification (all re-run by coordinator)

| Check | Command | Result |
|---|---|---|
| Focused tests | `.venv/Scripts/python.exe -m pytest tests/test_task0017_lifecycle.py -q` | `13 passed` [VERIFIED] |
| Full suite | `.venv/Scripts/python.exe -m pytest tests -q` | `257 passed, 28 skipped, 1 warning` (244 baseline + 13 new, 0 regression) [VERIFIED] |
| Compile | `.venv/Scripts/python.exe -m compileall -q src tests` | exit 0 [VERIFIED] |
| Governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | `[PASS]` (7 SPECs, 13 tasks, 1 manifest) [VERIFIED] |

GLM's reported numbers match coordinator's independent runs.

## 2. Implementation files inspected

- `src/crm/application/lifecycle_commands.py` — `EraseInstitutionCommand`;
  in-place blanking of institution + contact personal fields; erasure record
  with `propagate_by = erased_at + 30d`; audit with field-presence flags only.
  [VERIFIED]
- `src/crm/web/routes/admin.py` — `EraseInstitutionRequest` +
  `POST /api/admin/institutions/{id}/erase`; admin-only via `_require_admin`;
  `confirm=true` enforced before command. [VERIFIED]
- `src/crm/persistence/models.py` — `ErasureRecordModel` with CHECK
  constraints (non-blank reason, propagate_by > erased_at, status enum,
  verified_at/status coherence). [VERIFIED]
- `migrations/versions/0002_erasure_records.py` — bounded migration matching
  the model. [VERIFIED]
- `scripts/synthetic_backup_rehearsal.py` — local temp-dir SQLite rehearsal
  only; no remote resources. [VERIFIED]
- `tests/test_task0017_lifecycle.py` — 13 tests covering authorization,
  confirm/reason, irreversibility, audit hygiene, archive-vs-erasure
  boundary, propagation deadline/status, rehearsal, request fulfillment,
  post-erasure masking. [VERIFIED]

## 3. Acceptance cross-check (task card "Required acceptance")

| Item | Verdict |
|---|---|
| Normal correction remains archive, not hard delete | MET — `test_normal_correction_still_uses_archive`; archive path untouched [VERIFIED] |
| Erasure: admin + explicit reason + confirmation; irreversible; audit without personal values | **PARTIAL** — covered except whitespace-only reason (F1) |
| Request-fulfillment record retains no deleted content | MET — `test_request_fulfillment_recorded_without_content` [VERIFIED] |
| Propagation proven within bounded window or marked incomplete; never by assumption | MET — `propagation_status` starts `pending`; rehearsal flips to `verified` only after post-erasure backup check [VERIFIED] |
| Restore/backup rehearsal proves synthetic recovery path | MET with observation F2 |

## 4. Findings

### F1 (BLOCKING): whitespace-only erase reason crashes with 500 instead of clean rejection

- Reproduced by coordinator (temporary adversarial test, since deleted):
  `POST /api/admin/institutions/{id}/erase` with `{"reason": "   ",
  "confirm": true}` passes Pydantic (`min_length=1` counts whitespace),
  blanks personal fields in-transaction, then fails the
  `ck_erasure_records_erasure_reason_not_blank` CHECK → `IntegrityError` →
  HTTP 500.
- Rollback verified [VERIFIED]: the institution row keeps its original
  values and no erasure_records row is written (transaction atomicity
  satisfies §8 "audit write failure → erasure must not appear successful").
- Why blocking: DEC-0096 established the repository-wide rule that
  whitespace-only reasons are treated as absent and must be rejected/
  normalized at the boundary. The erasure endpoint is the most sensitive
  reason field in the system; a 500 on it is a defect in TASK-0017 owned
  paths, and no regression test pins the behavior.
- Required fix (owned paths only): reject whitespace-only `reason` with a
  clean 4xx before any DB work (route or Pydantic validation, e.g. strip-then-
  validate), plus a focused regression test asserting (a) 4xx status,
  (b) institution values unchanged, (c) zero erasure_records rows.
- Do NOT change: erase scope, propagation semantics, archive path, or any
  file outside TASK-0017 owned paths.

### F2 (non-blocking observation): rehearsal backup omits audit_events

`scripts/synthetic_backup_rehearsal.py::model_name_to_query` serializes only
5 of 10 tables; `audit_events` is not in the map, so the post-erasure backup
check cannot detect personal values leaked through audit rows. Mitigated by
the dedicated audit-hygiene test (`test_erasure_audit_has_no_personal_values`)
[VERIFIED]. Recorded as an improvement candidate; not required for
acceptance.

### F3 (non-blocking observation / product-scope note): follow-up free text out of erasure scope

Erasure blanks institution and contact fields only. Follow-up activity
bodies are free text and may mention a person; SPEC-0011's minimum data
contract does not cover them and the task card does not require them.
Whether free-text mentions must be searched/scrubbed is a product/compliance
decision (DEC-0037 assigns legal judgment to the product owner). Recorded as
an open item in `docs/NOW.md`; no code change authorized.

## 5. Residuals unchanged (already on record, not reopened)

- `/api/institutions/<non-UUID>` 500 (R1) and the same uncaught-UUID pattern
  on admin routes (D3) — future hardening task.
- Management summary `archived` dead field (D2); batch-transfer failure
  audit gap (D5).

## 6. Verdict and next step

- REMEDIATION-REQUIRED (`DEC-0106`): F1 only. After GLM remediates, the
  coordinator re-audits F1 + reruns the full suite; on pass, TASK-0017 is
  accepted and TASK-0011 activation proceeds.
- Not verified (unchanged): production PostgreSQL `pg_dump`, remote/SSH,
  deployment, real data, browser visual acceptance.
