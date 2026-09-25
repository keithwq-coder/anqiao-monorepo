# TASK-0016: SPEC-0003 opportunity discovery

- Task ID: TASK-0016
- Status: PROPOSED / AUTHORIZED-PENDING-OWNERSHIP-RELEASE
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
- Authorization: `DEC-0089`; `OD-005` and `OD-006` remain separately gated;
  use synthetic/local deterministic discovery only
- Proposed implementation owner: DeepSeek
- Coordinator/auditor: current coordinator
- Depends on: `TASK-0014`, `TASK-0015`, `TASK-0010`

## Goal

Add the approved discovery/reminder layer without creating a claim, pipeline,
forecast, external integration, or automatic write. Discovery must preserve
source provenance, remain masked, route reminders to the related record owner
or manager per the approved decisions, and require human judgment before any
normal follow-up is created.

## Owned paths (exclusive after activation)

- new bounded discovery domain/application modules under `src/crm/`
- `src/crm/persistence/models.py`, repositories, and one migration only if
  durable discovery state is required by the approved SPEC
- discovery routes/templates and `src/crm/web/main.py` wiring
- focused synthetic discovery/masking/provenance tests under `tests/`
- `docs/evidence/TASK-0016-*` and this task card

## Required acceptance

- Cross-owner signals can be used for detection but reminders contain only
  masked/minimum-necessary data for the recipient.
- No claim/convert action or automatic business commitment is added.
- Unconfirmed possibilities are clearly distinguished from factual follow-up;
  accepted follow-up uses existing `SPEC-0001` creation rules.
- Provenance is traceable to the approved synthetic source without fabricated
  associations; no external model or network call occurs.
- Unread/handled behavior matches the approved reminder rules and unowned
  records route only to the manager path.

## Verification

Run all SPEC-0003 acceptance tests with synthetic fixtures, full local suite,
governance check, and coordinator review of page/search/API parity. Any need to
resolve `OD-005`/`OD-006` is a hard stop.
