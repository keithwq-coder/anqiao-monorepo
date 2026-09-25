# Project facts and unknowns

This file deliberately contains fewer facts than the old documents. Missing
facts stay missing until the product owner confirms them.

## Confirmed facts

| Item | Status | Evidence |
|---|---|---|
| Workspace name is `crm` | VERIFIED | Repository path |
| Development uses SPEC-driven gates | VERIFIED | User instruction, 2026-07-26 |
| Multiple tools/models will collaborate | VERIFIED | User named Codex, ZCode, Qoder, Cursor, GPT, GLM, Qwen, and Grok |
| The product owner does not program | VERIFIED | User instruction, 2026-07-26 |
| All engineering work is completed by AI tools | VERIFIED | User instruction, 2026-07-26 |
| The product owner is not responsible for commands, code, logs, or AI-output integration | VERIFIED | User instruction, 2026-07-26 |
| AI determines engineering order and technical task decomposition | VERIFIED | User instruction, 2026-07-26 |
| The project has no deadline, ETA, or calendar timeline | VERIFIED | User instruction, 2026-07-26 |
| Planning follows ordered steps, prerequisites, verification, and completion gates | VERIFIED | User instruction, 2026-07-26 |
| Human-AI collaboration must be emphasized | VERIFIED | User instruction, 2026-07-26 |
| AI hallucination is the primary process risk | VERIFIED | User instruction, 2026-07-26 |
| Previous SPEC files are reference only | VERIFIED | User instruction, 2026-07-26 |
| First CRM records represent institutions/companies with subordinate contacts; independent C-side consumers are excluded from the first version | VERIFIED | `DEC-0004` |
| Internal views are desensitized and ordinary business progress is concise only | VERIFIED | `DEC-0005` |
| Record owners receive work-necessary detail for assigned records; other business users receive masked summaries; administrator full-detail access is audited | VERIFIED | `DEC-0006` |
| Contact methods are expected but not mandatory; WeChat is valid and missing contactability must not be fabricated | VERIFIED | `DEC-0007` |
| AI coaching is allowed during follow-up editing to identify missing or weak factual detail; unconfirmed AI output is not a business fact | VERIFIED | `DEC-0008` |
| AI owns the adaptive seven-dimension coaching checklist; each pass shows at most three prioritized prompts and accepts not-discussed/not-applicable/unknown states | VERIFIED | `DEC-0009` |
| `SPEC-0001 v0.7.0` is approved without implementation authorization | VERIFIED | `DEC-0010` and matching approval metadata |
| All SPECs in the agreed product baseline must be completed and explicitly approved before implementation | VERIFIED | `DEC-0011` |
| The baseline covers the internal B2B/G CRM and excludes C-side consumer marketing/commerce | VERIFIED | `DEC-0012` |
| General manager sees company-wide concise management information; other management sees authorized scope; management is read-only by default | VERIFIED | `DEC-0013` |
| `SPEC-0002 v0.2.0` is approved without implementation authorization | VERIFIED | `DEC-0014` and matching approval metadata |
| Opportunity discovery must remain broad before records, stages, automation, or reporting are fixed; examples are inspiration rather than complete rules | VERIFIED | `DEC-0015` |
| The CRM actively connects approved information to reveal possible business value with supporting reasons; a person makes the final business judgment | VERIFIED | `DEC-0016` |
| The active implementation architecture is a cloud-deployed Python modular monolith with one central policy layer, native PostgreSQL/Alembic, server-side sessions, Uvicorn/systemd and nginx, without Docker | VERIFIED | `DEC-0043`, `DEC-0044`, `ADR-0002`; current implemented state documented with citations in `docs/architecture/ARCHITECTURE.md` and `ADR-0003` (2026-08-12). Current production runtime state is NOT VERIFIED by documentation |
| `TASK-0001` is authorized; S1, W1, W2 and W3 have passed; W4/S5/S6 do not have accepted gate status; TASK-0006 did not verify current online database/service state | VERIFIED | `DEC-0046`, `DEC-0047`, `DEC-0048`, active task and W2/W3 evidence |

## Current adjudication (2026-07-31, TASK-0006)

> Historical snapshot of the 2026-07-31 TASK-0006 adjudication. Current
> status is in `docs/NOW.md` and `docs/tasks/TASKS.md`; the current
> architecture baseline is in `docs/architecture/ARCHITECTURE.md` (TASK-0022,
> 2026-08-12).

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

## Not yet confirmed

The following are `UNKNOWN`, even if legacy documents state otherwise:

- product goal, model/provider and real-data egress boundary, production
  compliance requirements, and success metrics;
- CRM workflows, stages, ratings, scoring formulas, and ownership rules;
- whether a system-surfaced possibility remains distinct from business work a
  person has explicitly chosen to pursue, and what human commitment crosses
  that boundary;
- data sources, crawling targets, volumes, retention, and data quality rules;
- integrations, including Feishu or any external service;
- authentication, authorization, privacy, security, and compliance boundaries;
- frontend, backend, database, analytics, queue, and deployment technologies;
- budget, hosting, production environment, domain, and release process;
- remaining business workflow boundaries and acceptance thresholds;
- whether the sibling marketing-strategy discussion draft represents current
  CRM scope;
- the exact upstream GitHub repository and version of the referenced
  `CLAUDE.md`; it was not provided as a verifiable source in this repository;
- the final product meaning inside each proposed engineering step. The
  dependency sequence itself is an AI proposal recorded in
  `docs/governance/DEVELOPMENT-SEQUENCE.md`.

## Unverified context sources

- `docs/specs/99-legacy/2026-07-26-crm-system/` is untrusted legacy and has no
  authority.
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md` is the approved
  authority for the bounded first slice. It does not authorize implementation,
  real data, external model transfer, or deployment.
- `D:\Project\中科安樵\中科安樵营销策略方案-讨论稿.md` was inspected on
  2026-07-26. It describes C-side, B-side, and G-side markets, but its title is
  a discussion draft and the product owner has not confirmed it as current CRM
  scope. It may generate questions and proposals, never approved facts.

## How a fact becomes confirmed

1. An AI presents the issue and evidence in plain language.
2. The product owner explicitly decides.
3. The decision is recorded in `docs/decisions/DECISION-LOG.md`.
4. If it affects product behavior, the decision is incorporated into a SPEC.
5. The SPEC enters `30-approved` only after explicit approval.

Silence, old files, model memory, and plausible industry practice do not
confirm a fact.
