# Complete SPEC baseline

- Status: COMPLETE
- Scope: complete agreed internal B2B/G CRM SPEC set; implementation remains
  limited by each task's explicit authorization and safety boundaries
- Authority: `DEC-0033` records the product owner's baseline-completion
  approval; `DEC-0037`, `DEC-0039`, and `DEC-0042` approve the later gated
  SPECs; `DEC-0042` records that every `SPEC-0001`–`SPEC-0013` slot is resolved;
  `DEC-0043` replaces the local-first implementation premise
- Last updated: 2026-07-27
- Implementation gate: OPEN for a specifically authorized synthetic-data task — a specific
  implementation task still requires its own active task and explicit
  authorization per `AGENTS.md` section 5

## Meaning of complete

`All SPECs are complete` means all of the following are true:

1. The product owner has confirmed the product boundary covered by this
   baseline.
2. Every capability inside that boundary has a SPEC in `30-approved/` with
   matching approval metadata and hash.
3. Cross-cutting identity, permissions, privacy, audit, data lifecycle, import/
   export, integration, and operational behavior are either covered by an
   approved SPEC or explicitly marked not applicable with verified evidence.
4. No behavior-changing open decision remains in any included SPEC.
5. An AI cross-SPEC review finds no conflicting terms, roles, states, data
   ownership, permissions, or acceptance criteria.
6. The product owner explicitly approves the baseline as complete, and the
   decision log records that approval.

Writing a file, copying legacy text, or listing a candidate does not satisfy
this gate.

## Current verified state

- [VERIFIED] `SPEC-0001 v0.7.0` is approved and covers organizations,
  subordinate contacts, follow-up history, core visibility/audit behavior, and
  the bounded AI follow-up-coaching contract.
- [VERIFIED] `SPEC-0002 v0.2.0` (`DEC-0014`), `SPEC-0003 v0.2.0` (`DEC-0022`),
  and `SPEC-0008 v0.1.0` (`DEC-0032`) are approved, covering identity/roles/
  ownership, opportunity discovery, and search. The baseline is complete for the
  local synthetic-data build (`DEC-0033`).
- [VERIFIED] `TASK-0001` is active and authorized by `DEC-0046`. S1, W1, W2 and
  W3 have passed; the repository has a native Python module skeleton and the
  server state per DEC-0033 for synthetic-data build scope; W4/S5/S6 do not have accepted gate status; historical record: DEC-0058 recorded a one-time
  117-record import on 2026-07-30; current online database/service state is UNKNOWN without network access.
- [VERIFIED] The product owner requires all SPECs in the agreed product
  baseline to be completed before any application implementation starts.
- [VERIFIED] `DEC-0012` limits this baseline to the internal B2B/G CRM and
  excludes C-side consumer marketing/commerce and broader marketing execution.
- [UNKNOWN] Which capabilities from the legacy CRM plan remain desired. Legacy
  files can identify questions but cannot establish scope or behavior.

## Current adjudication (2026-07-31, TASK-0006)

- [VERIFIED] DEC-0058 records that 117 imported records were present in the cloud database on 2026-07-30.
- [VERIFIED] DEC-0059 records the product owner's risk acceptance for the publicly reachable debug service reported at that time.
- [UNKNOWN] TASK-0006 did not access the network; the current online database and service state is unknown.
- [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
- [VERIFIED] TASK-0001 and TASK-0007 are the explicitly authorized implementation tasks (DEC-0046; DEC-0067).
- [NOT VERIFIED] TASK-0002 has incomplete authorization and ownership metadata and is not currently accepted.
- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable import capability remains unauthorized.
- [VERIFIED] TASK-0006 is a documentation task, CLOSED / ACCEPTED: the final reconciliation batch was executed by a ZCode subagent and independently accepted by Kimi-K3 on 2026-08-02 per DEC-0066 (evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`); earlier stages executed by Qoder remain factual history.
- [VERIFIED] TASK-0007 is authorized and ACTIVE under DEC-0067 (owner: ZCode agent); steps 1-5 complete; independent review verdict ACCEPTED (2026-08-02) — no unresolved P0/P1; all 6 gated PostgreSQL tests passed on real `crm_test`; coordinator independent re-run 6/6 confirmed (evidence: `docs/evidence/TASK-5A-verification.md`).
- [VERIFIED] TASK-5A (owner: ZCode agent / GLM) is COMPLETE. Coordinator independent re-run (port 55433) reproduced 6/6 passed on 2026-08-02. TASK-0007 verdict upgraded to ACCEPTED. TASK-0001 mainline work resumes per DEC-0067 point 4. [PROPOSAL] TASK-0008 through TASK-0011 remain PROPOSED/UNAUTHORIZED.

## Candidate SPEC map

The following is an AI proposal for discovering a complete internal CRM
baseline. IDs reserve discussion order only; they do not approve the feature.

| Candidate | Business capability | Current status | Known boundary |
|---|---|---|---|
| `SPEC-0001` | Organizations, contacts, follow-up facts, visibility, audit, AI follow-up coach | APPROVED v0.7.0 | No implementation authorization |
| `SPEC-0002` | Users, identity, roles, ownership transfer, access administration | APPROVED v0.2.0 | `DEC-0014` + matching approval hash; no login provider selected |
| `SPEC-0003` | Opportunity discovery: active surfacing of possibilities as masked reminders to record owners | APPROVED v0.2.0 | `DEC-0022` + matching approval hash; `OD-005`/`OD-006` separately gated; stages/scoring/forecast/closure deferred |
| `SPEC-0004` | Manual lead intake, evidence, duplicate review, conversion | FOLDED INTO SPEC-0001 (`DEC-0023`) | No separate lead object or SPEC; covered by approved `SPEC-0001` |
| `SPEC-0005` | External lead-source collection and source governance | DROPPED (`DEC-0024`) | No automatic external collection; manual entry + `SPEC-0003` discovery instead |
| `SPEC-0006` | Deduplication, matching, AI scoring, review and override | DROPPED (`DEC-0025`) | Dedup covered by `SPEC-0001`; no merge feature and no AI scoring |
| `SPEC-0007` | Tasks, follow-up reminders, assignment and escalation | DROPPED (`DEC-0026`) | No active reminders/tasks; people read the `SPEC-0001` next-action + date |
| `SPEC-0008` | Search (no export) under minimum-necessary disclosure | APPROVED v0.1.0 (`DEC-0032`) | Search only, obeys `SPEC-0001` masking; no export, saved views deferred |
| `SPEC-0009` | Notifications and external collaboration integrations | DROPPED (`DEC-0028`) | CRM is self-contained; no external integrations or outbound notifications |
| `SPEC-0010` | Reporting, funnel metrics, dashboards and forecasting | DROPPED (`DEC-0029`) | Management concise summaries in `SPEC-0002` suffice; no funnel/forecast |
| `SPEC-0011` | Data lifecycle: retention, controlled erasure, backup propagation | APPROVED v0.2.0 (`DEC-0037`) | Legal/compliance excluded per owner; bulk import and real-data entry are the owner's separate decisions |
| `SPEC-0012` | Cloud deployment, operations, security, acceptance | APPROVED v0.2.0 (`DEC-0042`) | Tencent Lightweight + `crm.aibrain.wiki` + nginx/HTTPS + SSH; server-side app; TLS key kept out of repo; legal/data-residency is the owner's |
| `SPEC-0013` | Bulk import (trusted load, duplicate flagging, batch undo) | APPROVED v0.1.0 (`DEC-0039`) | Real-data-tier import capability; real-data entry is the owner's separate decision |

Potential C-side consumer marketing, commerce, referral, content, and
channel-campaign capabilities are excluded by `DEC-0012`. Partner organizations
may still be B2B/G CRM records, but commercial settlement is not included
unless a later approved SPEC explicitly adds it.

## Drafting order

The drafting order follows information dependency, not implementation order or
time:

1. Confirm the baseline product boundary. **PASSED by `DEC-0012`.**
2. Draft identity/roles because every later SPEC needs a stable actor and
   permission vocabulary.
3. Draft opportunity discovery (done: `SPEC-0003`). Manual lead intake is folded
   into `SPEC-0001` (`DEC-0023`); there is no separate lead conversion.
4. External data-source collection is dropped (`DEC-0024`) and
   deduplication/matching/scoring (`SPEC-0006`) is dropped (`DEC-0025`); dedup
   lives in `SPEC-0001` and there is no external inflow or scoring.
5. Tasks/reminders (`SPEC-0007`) are dropped (`DEC-0026`). Draft search/export
   (`SPEC-0008`) and any integrations against the approved record and permission
   contracts.
6. Reporting/forecasting (`SPEC-0010`) is dropped (`DEC-0029`); management
   concise summaries live in `SPEC-0002`.
7. Data lifecycle (`SPEC-0011`) and production operations (`SPEC-0012`) are
   deferred behind a hard gate (`DEC-0030`): required before any real data or
   deployment, marked not applicable to the local synthetic-data build.
8. Draft the kept `SPEC-0008` (search), then run the cross-SPEC consistency
   review, resolve every behavior-changing unknown, and request explicit
   baseline-completion approval for the local synthetic-data build.

No application implementation task may become active during these steps.

## Next blocking product decision

`SPEC-0003 v0.2.0` is approved (`DEC-0022`); `SPEC-0004` is folded into
`SPEC-0001` (`DEC-0023`); `SPEC-0005` is dropped (`DEC-0024`); `SPEC-0006` is
dropped (`DEC-0025`); `SPEC-0007` is dropped (`DEC-0026`); `SPEC-0008` is
kept but narrowed to search-only with no export (`DEC-0027`, to be drafted); `SPEC-0009` is dropped (`DEC-0028`); `SPEC-0010` is dropped (`DEC-0029`); and
`SPEC-0010` is dropped (`DEC-0029`); `SPEC-0012` remains deferred behind a
deployment gate (`DEC-0030`). `SPEC-0008` is approved (`DEC-0032`), the
cross-SPEC review is resolved (`DEC-0031`), and the baseline is declared complete
for the local synthetic-data build (`DEC-0033`).

`DEC-0034` opens a further scope tier: the product owner wants a real-data build
seeded with real 养老机构 records plus bulk import. `SPEC-0011` (data lifecycle,
privacy, PIPL erasure, personal-information handling) is therefore pulled to
ACTIVE discovery and must be approved before any real data is collected,
imported, or stored; a bulk-import SPEC and an explicit compliance decision
follow it. The synthetic-data baseline (`DEC-0033`) stands; the real-data tier is
under construction. The next step is `SPEC-0011` discovery
(`AGENTS.md` section 5 gates 1–4 still apply). Stages/scoring/forecast stay
deferred.
