# CRM development dependency sequence

- Status: PROPOSAL
- Authority: none
- Basis: `DEC-0003`
- Last updated: 2026-07-31 (TASK-0006 reconciliation)
- Implementation authority: none

## 1. Engineering conclusion

**[PROPOSAL] The first implementation target, after SPEC approval and task
authorization, should be two separately verified sub-slices: first a
deterministic manual fact loop, then AI coaching inside follow-up editing.**

The manual sub-slice creates one trackable business record, adds a factual
follow-up/activity entry, and reopens the record to reproduce its history. The
AI sub-slice analyzes a salesperson's draft, asks about likely omissions, and
keeps every suggestion outside the formal record until the salesperson
confirms it. Manual factual saving remains available when AI is unavailable.

This is not a request for the product owner to choose a CRM module. It is the
engineering dependency shared by later lead collection, opportunity stages,
reminders, integrations, scoring, dashboards, and forecasts.

The first target is deliberately a vertical slice, not a complete "customer
management module." Exact business terms, fields, permissions, and correction
rules remain product decisions and are not approved by this document.

## 2. Verified inputs

- [VERIFIED] The repository contains governance and documentation plus local auth repair work. Evidence: repository inspection on 2026-07-31, TASK-0006 reconciliation.
- [VERIFIED] There are seven approved SPECs and TASK-0001 and TASK-0007 are the authorized implementation tasks (`DEC-0046`; `DEC-0067`) (TASK-0002 authorization is incomplete; TASK-0003 one-time import ratified but reusable capability not implemented). Evidence: `docs/specs/INDEX.md`, `docs/tasks/TASKS.md`, and `scripts/check-governance.ps1`. TASK-0006 final reconciliation was accepted by Kimi-K3 on 2026-08-02 (DEC-0066; evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`).
- [VERIFIED] `DEC-0003` assigns engineering sequencing to AI tools rather than
  the non-technical product owner.
- [VERIFIED] `DEC-0007` makes a contact method expected but non-blocking and
  prohibits fabricated contact details.
- [VERIFIED] `DEC-0008` places real-time AI coaching in the follow-up editing
  experience while keeping unconfirmed model output outside the business
  record.
- [VERIFIED] The legacy plan names lead collection, customer management, and
  sales-funnel analysis. This verifies only what the old file contains, not
  that those modules or their rules are current. Source:
  `docs/specs/99-legacy/2026-07-26-crm-system/source/docs/PLAN.md`.
- [VERIFIED] A sibling discussion draft describes C-side, B-side, and G-side
  markets and several kinds of organizations, partners, contacts, and projects.
  Source: `D:\Project\中科安樵\中科安樵营销策略方案-讨论稿.md`, inspected
  2026-07-26.
- [UNKNOWN] Whether that sibling discussion draft still represents the current
  CRM scope. It is context only and has no approval authority in this
  repository.

## 3. Dependency reasoning

1. **Facts before consumers.** Crawlers, scoring, pipelines, reminders, and
   reports all need stable record identities and validated history to read or
   update.
2. **Manual path before model assistance.** A manual path exposes missing
   fields, duplicate meanings, permissions, and correction rules without
   depending on a model or external service.
3. **Advice must remain downstream of facts.** AI coaching can improve input
   quality only after the system can preserve the salesperson's original facts,
   explicit confirmations, and a non-AI fallback.
4. **History before state analysis.** A funnel or forecast needs trustworthy
   state changes over time; a current-value-only record cannot prove how or why
   a state changed.
5. **Access boundary before shared use or model context.** Ownership and
   visibility must be defined before multiple users, external systems, or AI
   providers can receive business data.
6. **Coaching before autonomous influence.** A suggestion-only coach with
   explicit human confirmation is lower risk and easier to verify than scoring,
   prioritization, or automated sales actions.
7. **Source data before analytics.** Dashboards and forecasts are downstream
   views. Building them first would require invented sample meanings or unstable
   schemas.

## 4. Ordered completion gates

| Order | Outcome | Prerequisite | Exact output | Completion gate | Status |
|---|---|---|---|---|---|
| 0 | Repository governance and legacy isolation | Empty governed workspace | Canonical `AGENTS.md`, lifecycle directories, adapters, hash checker, legacy manifest | Governance checker passes | PASSED |
| 1 | Core business meaning, data boundary, and AI coaching contract | Order 0 | `SPEC-0001` defines the real-world record, activity history, users, visibility, minimum data, correction behavior, coaching checklist, AI fact boundary, and acceptance | SPEC has no behavior-changing unknowns and receives explicit approval with matching hash | PASSED |
| 2 | Complete product SPEC baseline | Approved `SPEC-0001` plus confirmed product boundary | Every in-scope SPEC is approved; cross-SPEC consistency and completeness are reviewed | Product owner explicitly approves `SPEC-BASELINE.md` as COMPLETE | PASSED |
| 3 | Reversible architecture and verification foundation | Complete approved SPEC baseline | Revalidate ADRs and prepare bounded tasks against the complete behavior map | Architecture review and governance checker pass | PASSED |
| 4 | Deterministic manual core-record/activity slice | Authorized manual task after order 3 | Smallest usable UI/API/persistence path for organization, contact, factual activity, permissions, and reproducible history | Manual-path automated acceptance checks pass; business/visual checks are recorded separately | PARTIAL (Foundation S1-S3+R1 complete; S5/S6 pending) |
| 5 | AI follow-up coaching sub-slice | Verified order 4 and an authorized coaching task | In-session omission/ambiguity questions, explicit accept/reject, minimum-context assembly, and a non-blocking manual fallback | Coaching acceptance checks pass without weakening or changing the verified manual fact path | BLOCKED |
| 6 | Opportunity/pipeline state and transition history | Complete baseline and verified core record/activity contract | A bounded implementation task for approved opportunity state changes | Every state and transition has approved meaning and reproducible history tests | BLOCKED |
| 7 | Manual lead intake and conversion | Complete baseline and approved record/opportunity contracts | Manual evidence entry, duplicate review, and explicit conversion into the approved record/opportunity model | Conversion preserves source evidence and never creates silent duplicates | BLOCKED |
| 8 | External ingestion, deduplication, and scoring | Verified manual path and approved source/legal boundaries | One source adapter at a time, deterministic normalization, review queue, then optional model scoring | Source provenance, failure isolation, replay, and human override are verified | BLOCKED |
| 9 | Reminders, messaging, and external integrations | Stable source records and approved side effects | Separately authorized integrations with retry, idempotency, audit, and disable controls | Failure does not corrupt core records; external writes are explicitly authorized | BLOCKED |
| 10 | Analytics and forecasting | Sufficient verified history and approved metric definitions | Reports calculated from real, versioned definitions; forecasting only if evidence supports it | Metrics reproduce from source records and disclose incomplete data | BLOCKED |
| 11 | Deployment and production operations | Approved security, data, backup, and release boundaries | Environment-specific release task, recovery evidence, and human business acceptance | All named production checks pass and sensitive action receives immediate confirmation | BLOCKED |

**BLOCKED** here means the prerequisite has not yet passed. It is not a schedule statement and does not imply that a later outcome has been approved.

## 6. Current Next Action and Authorization Status

[VERIFIED] TASK-0001 and TASK-0007 are the explicitly authorized implementation tasks (DEC-0046; DEC-0067). TASK-0002 has incomplete authorization metadata. TASK-0003 one-time import was ratified historically per DEC-0058 but reusable capability remains unauthorized.

[TASK-0006 DOCUMENTATION] CLOSED / ACCEPTED 2026-08-02: Stage A accepted by Codex (historical); the final reconciliation batch was executed by a ZCode subagent and independently accepted by Kimi-K3 per DEC-0066 (evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`).

[TASK-0007 ACTIVE / ACCEPTED] TASK-0007 is authorized and active under DEC-0067 (owner: ZCode agent); steps 1-5 complete; independent review verdict ACCEPTED (2026-08-02) — no unresolved P0/P1; all 6 gated PostgreSQL tests passed on real `crm_test`; coordinator independent re-run 6/6 confirmed (evidence: `docs/evidence/TASK-5A-verification.md`).

[TASK-5A ACTIVE VERIFICATION / TASK-0008 through TASK-0011 PROPOSED] TASK-5A is authorized under DEC-0068 (the database actions) and DEC-0069 (the SSH transport that carries them), owner ZCode agent / GLM: the six gated TASK-0007 PostgreSQL tests run against a newly created isolated empty `crm_test` database on the production PostgreSQL server; no production real table may be read or written. Attempt 1 stopped fail-closed at preflight because DEC-0068's port-connect route was unsatisfiable against a loopback-bound listener whose non-exposure is itself a passing W2/W3/G4 gate result; DEC-0069 corrects the route without reversing that security property, and explicitly withdraws any option to widen `listen_addresses` or open the database port. Four fail-closed stops apply, including a possibly stale local `DATABASE_PASSWORD` (GR1 rotated it server-side; reading the rotated secret is not authorized). No deployment, service restart, server configuration change, credential change, git write, or dependency installation is authorized. TASK-0008 through TASK-0011 remain PROPOSED and unauthorized; each requires separate explicit product-owner authorization per AGENTS.md section 5 gates before any code changes may begin.

## Current adjudication (2026-07-31, TASK-0006)

- [VERIFIED] DEC-0058 records that 117 imported records were present in the cloud database on 2026-07-30.
- [VERIFIED] DEC-0059 records the product owner's risk acceptance for the publicly reachable debug service reported at that time.
- [UNKNOWN] TASK-0006 did not access the network; the current online database and service state is unknown.
- [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
- [VERIFIED] TASK-0001 and TASK-0007 are the explicitly authorized implementation tasks (DEC-0046; DEC-0067).
- [NOT VERIFIED] TASK-0002 has incomplete authorization and ownership metadata and is not currently accepted.
- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable import capability remains unauthorized.
- [VERIFIED] TASK-0006 is a documentation task, CLOSED / ACCEPTED on 2026-08-02: the final reconciliation batch was executed by a ZCode subagent and independently accepted by Kimi-K3 per DEC-0066 (evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`); Qoder's earlier-stage execution remains factual history.
- [VERIFIED] TASK-0007 is authorized and ACTIVE under DEC-0067 (owner: ZCode agent); steps 1-5 complete; independent review verdict ACCEPTED (2026-08-02) — no unresolved P0/P1; all 6 gated PostgreSQL tests passed on real `crm_test`; coordinator independent re-run 6/6 confirmed (evidence: `docs/evidence/TASK-5A-verification.md`).
- [VERIFIED] TASK-5A (owner: ZCode agent / GLM) is COMPLETE. Coordinator independent re-run (port 55433) reproduced 6/6 passed on 2026-08-02. TASK-0007 verdict upgraded to ACCEPTED. TASK-0001 mainline work resumes per DEC-0067 point 4. [PROPOSAL] TASK-0008 through TASK-0011 remain PROPOSED/UNAUTHORIZED.
- [VERIFIED] Real-database verification is needed twice on the mainline: three test files are gated on `CRM_RUN_POSTGRESQL_TESTS`, no SQLite fallback exists in `src/` or `tests/`, and the S6 gate requires restart-persistence verification via `scripts/dev-test.ps1`, which does not exist. Authoring that script is S6 gate-required work and is not authorized by DEC-0069.
