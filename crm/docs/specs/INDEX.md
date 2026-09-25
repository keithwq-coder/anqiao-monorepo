# SPEC index

Last updated: 2026-08-26（`DEC-0177` 产品负责人直接批准 `SPEC-0002 v0.5.0` /
`SPEC-0003 v0.5.0` / `SPEC-0016 v0.1.0` 并转正至 `30-approved`，9→10 份 approved
SPECs——SPEC-0002/0003 为版本替换（旧版归档 `90-deprecated`），SPEC-0016 为
新 SPEC（SPEC-0010 仍为 retired tombstone）；跳过独立评审为产品负责人知情选择；
实现待单独授权）

## Baseline gate

| Control file | Status | Authority | Effect |
|---|---|---|---|
| `SPEC-BASELINE.md` | COMPLETE (local synthetic-data build) | `DEC-0033` records completion; `DEC-0011` freeze lifted for this scope | An implementation task may be authorized per `AGENTS.md` section 5 gates 1–4 |

## Inbox / discovery

| File | Status | Authority | Next gate |
|---|---|---|---|
| `00-inbox/INBOX-0001-first-product-problem.md` | AI ANALYSIS COMPLETE | None | Engineering conclusion transferred to SPEC-0001 |
| `00-inbox/INBOX-0002-opportunity-discovery.md` | COMPLETE — converged into `SPEC-0003` | `DEC-0015`–`DEC-0022` | Discovery converged into approved `SPEC-0003 v0.2.0`; begin `SPEC-0004` discovery next |

## Approved

| File | Status | Authority | Next gate |
|---|---|---|---|
| `30-approved/SPEC-0001-core-record-activity.md` | APPROVED (v0.9.0) | `DEC-0181` + matching approval hash (v0.8.1 superseded by DEC-0181, archived in `90-deprecated`) | 客户三类型 + 公池 + 术语统一为「客户」；v0.9.0 销售可见性完全隔离（business_user 仅见本人客户 + 公池，R-014 改写 + R-046）；实现待单独授权（`AGENTS.md` §5） |
| `30-approved/SPEC-0002-users-roles-ownership.md` | APPROVED (v0.5.0) | `DEC-0177` + matching approval hash（v0.4.1 superseded，已归档 `90-deprecated`） | 多角色叠加正式化；新增 `shareholder`（业务型股东，赵/武=shareholder+business_user，不含账号管理）；双重管理（归属人 owner + 管理人 custodian）；股东直接分配；实现待单独授权 |
| `30-approved/SPEC-0003-opportunity-discovery.md` | APPROVED (v0.5.0) | `DEC-0177` + matching approval hash（v0.4.0 superseded，已归档 `90-deprecated`） | 触发源分离（手动=个人商机基于本人客户/定时=招投标爬虫）；新增定时任务；原始公告≠AI 商机；修复零产出根因；实现待单独授权 |
| `30-approved/SPEC-0008-search.md` | APPROVED | `DEC-0032` + matching approval hash | Part of complete baseline; no implementation authorization |
| `30-approved/SPEC-0011-data-lifecycle.md` | APPROVED | `DEC-0037` + matching approval hash | Real-data-tier data lifecycle approved; no implementation authorization |
| `30-approved/SPEC-0013-bulk-import.md` | APPROVED | `DEC-0039` + matching approval hash | Bulk import for the real-data tier approved; HISTORICAL ONLY one-time import executed per DEC-0058, reusable capability pending formal TASK-0011 authorization |
| `30-approved/SPEC-0012-deployment-operations.md` | APPROVED | `DEC-0042` + matching approval hash | Cloud deployment/ops; actual deployment needs a built app + authorization |
| `30-approved/SPEC-0014-account-credentials-modification.md` | APPROVED (v0.3.0) | `DEC-0153` + matching approval hash (v0.2.0 superseded, archived in `90-deprecated`) | 自助改密操作主体回退为 business_user/administrator（删除 agent）；实现待单独授权 |
| `30-approved/SPEC-0016-reporting-export.md` | APPROVED (v0.1.0) | `DEC-0177` + matching approval hash（新 SPEC；SPEC-0010 仍为 retired tombstone） | 四类报表（客户统计/销售业绩含金额/跟进活动/公池动态）+ Excel 导出；业绩金额需客户金额字段（SPEC-0001 扩展，OD-010）；实现待单独授权 |
| `30-approved/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` | APPROVED (v0.4.0) | `DEC-0167` + matching approval hash | 跨工具调度与验收证据治理 SPEC（verdict-only 协议）；批准为治理规范，不授权应用实现 |

## Candidate map

The baseline is complete for the local synthetic-data build (`DEC-0033`).
`SPEC-0001`/`SPEC-0002`/`SPEC-0003`/`SPEC-0008`/`SPEC-0011` are approved
(`30-approved`);
`SPEC-0004` is folded into `SPEC-0001` (`DEC-0023`);
`SPEC-0005`/`SPEC-0006`/`SPEC-0007`/`SPEC-0009`/`SPEC-0010` are dropped
(`DEC-0024`/`DEC-0025`/`DEC-0026`/`DEC-0028`/`DEC-0029`); `SPEC-0011` (data lifecycle: retention,
erasure, backup propagation) is approved v0.2.0 (`DEC-0037`); `SPEC-0013` (bulk
import) is approved v0.1.0 (`DEC-0039`); `SPEC-0012` (cloud deployment) is
approved v0.2.0 (`DEC-0042`). All SPEC slots `SPEC-0001`–`SPEC-0013` are now
resolved.

## In review

| File | Status | Authority | Next gate |
|---|---|---|---|
| _(empty — the last review candidate `SPEC-GOV-0001` was approved under `DEC-0167` on 2026-08-24 and moved to `30-approved`)_ | — | — | — |

(The prior `SPEC-0003 v0.3.0` review entry was approved under `DEC-0117` on
2026-08-08 and moved to `30-approved`, superseding v0.2.0 which is archived in
`90-deprecated`.)

## Current adjudication (2026-07-31, TASK-0006)

- [VERIFIED] DEC-0058 records that 117 imported records were present in the cloud database on 2026-07-30.
- [VERIFIED] DEC-0059 records the product owner's risk acceptance for the publicly reachable debug service reported at that time.
- [UNKNOWN] TASK-0006 did not access the network; the current online database and service state is unknown.
- [VERIFIED] TASK-0001 S5 is PASSED as of 2026-08-03 per `DEC-0074`, local and
  synthetic only. W4 and S6 do not currently have accepted gate status.
- [VERIFIED] TASK-0001 and TASK-0007 are the explicitly authorized implementation tasks (DEC-0046; DEC-0067).
- [NOT VERIFIED] TASK-0002 has incomplete authorization and ownership metadata and is not currently accepted.
- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable import capability remains unauthorized.
- [VERIFIED] TASK-0006 is a documentation task, CLOSED / ACCEPTED: the final reconciliation batch was executed by a ZCode subagent and independently accepted by Kimi-K3 on 2026-08-02 per DEC-0066 (evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`); earlier stages executed by Qoder remain factual history.
- [VERIFIED] TASK-0007 is authorized and ACTIVE under DEC-0067 (owner: ZCode agent); steps 1-5 complete; independent review verdict ACCEPTED (2026-08-02) — no unresolved P0/P1; all 6 gated PostgreSQL tests passed on real `crm_test`; coordinator independent re-run 6/6 confirmed (evidence: `docs/evidence/TASK-5A-verification.md`).
- [VERIFIED] TASK-5A (owner: ZCode agent / GLM) is COMPLETE. Coordinator independent re-run (port 55433) reproduced 6/6 passed on 2026-08-02. TASK-0007 verdict upgraded to ACCEPTED. TASK-0001 mainline work resumes per DEC-0067 point 4. [PROPOSAL] TASK-0008 through TASK-0011 remain PROPOSED/UNAUTHORIZED.
- [VERIFIED] `DEC-0070` (2026-08-03) retroactively records the 2026-08-02 `crm_test` seed and widened gated-test authorization, assigns authorization-recording duty to the coordinator rather than the bounded executor, and reclassifies TASK-0001 S4 from PASSED to PARTIAL because its `crm_test` leg is `[UNVERIFIED — single source]`. The round's local results are independently reproduced and its four application-code repairs are real. Audit: `docs/evidence/TASK-0001-S6-GATE-DEPENDENCIES-AUDIT.md`.

Stage A was accepted by Codex on 2026-08-01 (historical); the final reconciliation batch was accepted by Kimi-K3 on 2026-08-02 (DEC-0066).

## Drafts

### DEC-0149 revision drafts — APPROVED（已转正至 `30-approved`）

`DEC-0153`（2026-08-13）批准了 4 份修订版 SPEC，已转正至 `30-approved/`（见
Approved 表）；`10-draft/` 中对应的草案文件已随转正移除。分工依据 `DEC-0151`：
DeepSeek-v4-pro 撰写 SPEC，DeepSeek-v4-flash 实现，变更询问产品负责人。

### 历史草稿（已归档/取代）

| File | Status | Authority | Next gate |
|---|---|---|---|
| `10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` | SUPERSEDED — REMOVED on promotion | `DEC-0063` required the failure lessons to be recorded; TASK-0022 moved the reconciled v0.4.0 review candidate to `20-review` on 2026-08-12; approved under `DEC-0167` on 2026-08-24 and moved to `30-approved`; the stale `10-draft` copy was removed with the promotion (SPEC-0014 convention) | None — authority is the `30-approved` copy + its approval metadata |
| `10-draft/SPEC-0014-account-credentials-modification.md` | SUPERSEDED (approved copy in `30-approved`) | Approved as v0.1.0 under `DEC-0111` (2026-08-08); the `10-draft` copy is a stale pre-approval artifact | None — authority is the `30-approved` copy + its approval metadata |
| _(SPEC-0003 v0.3.0 moved to `20-review` on 2026-08-08 per `DEC-0116`; see the In review section above)_ | — | — | — |

## Legacy references

| Snapshot | Status | Authority | Notes |
|---|---|---|---|
| `99-legacy/2026-07-26-crm-system/` | MIGRATED | None | Exact copy of selected prior governance/planning files and `docs/SPEC`; see migration note and manifest |

An index row does not change a document's lifecycle status. Directory state,
approval metadata, hash verification, and the decision log must all agree.
