# INBOX-0001: AI analysis of the first development target

- Type: DISCOVERY ANALYSIS
- Status: ANALYSIS COMPLETE
- Authority: none
- Prepared by: AI
- Source boundary: current repository, untrusted legacy snapshot, and named
  sibling discussion material
- Implementation authority: none

## 1. Correction recorded

[VERIFIED] `DEC-0003` records that the product owner does not choose the first
module based on programming dependencies. AI owns that analysis.

The previous A/B/C request was therefore the wrong decision boundary. It mixed
a technical ordering question with business-priority language and transferred
engineering responsibility to a non-programmer.

## 2. Engineering selection

**[PROPOSAL] Start with a minimal manual business-record and activity-history
vertical slice.** In plain language, an authorized user can create one thing
that the business follows, add a follow-up note/event, and later see the ordered
history.

This slice comes before the old candidate areas for these reasons:

- external lead discovery needs a stable destination record, evidence format,
  duplicate rule, and ownership boundary;
- a sales funnel needs trusted records and state-change history before it can
  calculate stages or conversion;
- reminders and integrations need a real action/history model before they can
  create safe side effects;
- analytics and forecasting need accumulated verified data rather than
  invented sample meanings.

The full dependency analysis is recorded in
`docs/governance/DEVELOPMENT-SEQUENCE.md`.

## 3. Verified and unverified context

- [VERIFIED] The legacy plan contains the labels lead collection, customer
  management, and sales-funnel analysis. Source:
  `docs/specs/99-legacy/2026-07-26-crm-system/source/docs/PLAN.md`.
- [VERIFIED] The legacy material contains no evidence of current users, actual
  records, current workflows, or approved business rules.
- [VERIFIED] The sibling file
  `D:\Project\中科安樵\中科安樵营销策略方案-讨论稿.md` discusses C-side,
  B-side, and G-side markets, institutions, partners, contacts, and projects.
- [UNKNOWN] Whether that discussion draft is current, complete, or intended to
  define this CRM. Its content is not approval.

## 4. What AI has decided

- [PROPOSAL] The first code-bearing task will be a vertical slice, not a whole
  module and not a crawler-first or dashboard-first build.
- [PROPOSAL] Manual entry and deterministic validation precede autonomous data
  collection or model scoring.
- [PROPOSAL] Stable identity, ownership/visibility, and activity history are
  prerequisites for later pipeline, integration, and analytics work.
- [PROPOSAL] Technology selection will be made by AI only after the approved
  product constraints are known; the product owner will not be asked to select
  a framework, database, or API style.

## 5. What remains a business decision

These are not programming-order questions:

- [UNKNOWN] Whether the first trackable record represents an organization or
  institution, an individual, or both with an explicit relationship.
- [UNKNOWN] Which human roles use the CRM and what each role may see or change.
- [UNKNOWN] What minimum information makes a record and a follow-up meaningful
  in the real business.
- [UNKNOWN] Whether records may be corrected or deleted, and what history must
  remain visible.

AI will raise these one at a time while refining `SPEC-0001`. They are not
permission to implement.

## 6. Result

The A/B/C module choice is retired. This inbox item hands its engineering
conclusion to `docs/specs/10-draft/SPEC-0001-core-record-activity.md`.

No application code, approved SPEC, or active implementation task is created
by this analysis.
