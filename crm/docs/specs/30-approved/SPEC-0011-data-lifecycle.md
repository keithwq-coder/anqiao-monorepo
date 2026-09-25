# SPEC-0011: 数据留存、删除与备份传播

- Spec ID: SPEC-0011
- Version: 0.2.0
- Status: APPROVED
- Product owner: User
- Prepared by: Claude Code / Opus 4.8
- Last updated: 2026-07-26
- Supersedes: none

## 1. Problem

一旦 CRM 存入真实、且部分为个人信息的数据（例如养老机构联系人的姓名与
电话），系统必须能负责任地管理这些数据的生命周期：保留多久、何时以及如何
真正删除、删除如何覆盖备份。

本 SPEC 定义留存、永久删除（erasure）与备份删除传播的工程行为合同。它不预设
具体存储、备份或部署技术。法律与合规判断由产品负责人负责，不在本 SPEC 范围
内。本 SPEC 的批准不含实施授权。

## 2. Verified context

- [VERIFIED] `DEC-0034` 开启真实数据档位：产品负责人希望录入真实养老机构
  数据（含联系方式）并允许批量录入；真实数据使用前需先有留存/删除基础。
- [VERIFIED] `DEC-0035` 确认在现有"归档"之上引入受控、管理员操作、可审计、
  不可逆的"永久删除"，用于删除请求与清除错误/不当数据。
- [VERIFIED] `DEC-0036` 确认按需保留 + 触发式删除，不设固定年限。
- [VERIFIED] `DEC-0037` 确认法务/合规由产品负责人负责，不写入本 SPEC。
- [VERIFIED] `SPEC-0001` R-031：普通业务记录只归档、不硬删除，更正生成可
  审计版本。
- [VERIFIED] `SPEC-0001`/`SPEC-0002` 已批准字段级脱敏、权限与例外访问审计。
- [VERIFIED] `DEC-0028` 确认 CRM 自成一体，不连接外部系统。
- [UNKNOWN] 部署与备份技术、以及真实数据录入的启用时机（由产品负责人决定）。

## 3. Goal and success measure

真实数据只在与业务相关期间保留；当事人要求删除、数据错误或过时、或管理员
按规则判定时，可由管理员执行受控、可审计、不可逆的永久删除，且删除会覆盖
备份。

非技术人员可以这样判断成功：一条真实联系人被"永久删除"后，系统里（含备份）
确实不再有其个人信息，只留下"谁、何时、为何、删了什么范围"的审计。

## 4. Non-goals

- 批量导入机制本身（属 `DEC-0034` 后续单独 SPEC）；
- 具体备份/恢复技术方案与部署（属延后的 `SPEC-0012`）；
- 更改 `SPEC-0001` 普通业务记录的归档/更正版本机制；
- 选择存储引擎、加密方案或云服务商；
- 法律与合规判断（由产品负责人负责，`DEC-0037`）。

## 5. Users and permissions

沿用 `SPEC-0002` 身份与权限。

- [VERIFIED] **管理员**：永久删除的唯一执行者，每次删除必须留痕（谁/何时/
  何因/何范围）。
- [VERIFIED] **记录负责人/其他业务人员/管理层**：不能执行永久删除；仍按
  `SPEC-0001` 归档、脱敏与例外访问规则操作。
- [VERIFIED] **未授权主体**：不能触发或查看删除相关操作。

## 6. Required behavior

- R-001: 真实/个人数据仅在与业务关系相关期间保留，没有超出该依据的无限期
  默认留存。
- R-002: 永久删除由以下任一触发：当事人要求、数据错误或过时、管理员按规则
  判定（`DEC-0036`）。
- R-003: 永久删除是独立于 `SPEC-0001` 归档的、管理员专属、可审计、不可逆的
  操作；普通业务更正默认仍用归档（`DEC-0035`，与 `SPEC-0001` R-031 协调）。
- R-004: 永久删除审计记录操作者、时间、原因与删除范围，但不保留被删除的
  个人信息值本身。
- R-005: 永久删除必须在有界、可验证的过程内传播到派生副本与备份，使被删除
  的个人信息不在备份中无限期留存；具体备份机制延后至 `SPEC-0012`（`OD-001`）。
- R-006: 个人信息（联系人姓名、电话等标识/联系字段）继续遵守 `SPEC-0001`
  字段级脱敏与最小必要展示；本 SPEC 管理其生命周期，不新增披露。
- R-007: 数据更正继续沿用 `SPEC-0001` 可审计版本机制，本 SPEC 不改变更正的
  记录方式。
- R-008: 当事人删除请求被满足后，本身要留下"请求已被满足"的记录，但不保留
  被删除的内容。
- R-009: 批量导入不在本 SPEC 范围内（`DEC-0034` 后续单独 SPEC）；本 SPEC 假定
  记录已存在，管理其生命周期。

## 7. Data and integrations

### Data concepts

- **留存依据**：某条真实数据为何仍被保留（业务关系有效）。
- **删除记录**：永久删除的操作者、时间、原因、范围与备份传播状态；不含被删
  内容。
- **备份传播状态**：某次永久删除是否已覆盖到备份，或标记为未完成。

### Minimum data contract

| 对象 | 必需信息 | 系统维护信息 |
|---|---|---|
| 删除记录 | 操作者、原因、删除范围 | 时间、备份传播状态、是否源自当事人请求（不含被删内容） |

- 外部集成：`Not applicable`（`DEC-0028`）。
- 存储、加密与备份技术属 `SPEC-0012`，本 SPEC 只定义业务级留存/删除行为。

## 8. Failure and edge behavior

- 永久删除无法完全传播到某个备份时，系统标记该删除为"未完成"，不得报告为
  已完成。
- 永久删除不可逆，执行前必须由管理员明确确认。
- 删除审计写入失败时，删除操作不得显示为成功。
- 验证阶段只使用合成数据；真实数据录入由产品负责人另行决定。

## 9. Acceptance criteria

- AC-001: Given 一条真实/个人数据满足删除触发条件，when 管理员执行永久删除，
  then 删除被记录、不可逆，且个人信息值不再保留。
- AC-002: Given 一次永久删除，when 查看审计，then 显示操作者/时间/原因/范围，
  但不含被删除的个人信息值。
- AC-003: Given 一次普通业务更正，when 处理，then 默认使用归档而非永久删除；
  永久删除是独立的管理员操作。
- AC-004: Given 存在备份，when 执行永久删除，then 删除在有界可验证过程内传播
  到备份，或被明确标记为未完成。
- AC-005: Given 当事人删除请求被满足，when 记录，then 显示请求已满足而不保留
  被删内容。
- AC-006: Given 个人字段，when 展示，then 仍适用 `SPEC-0001` 脱敏，本 SPEC 不
  新增披露。

自动化删除/留存/传播检查与人工业务验收必须分别记录。

## 10. Constraints and safety

- 继续执行 `SPEC-0001`/`SPEC-0002` 的脱敏、权限与审计。
- 只允许本地合成数据验证；真实数据、备份与部署需相应授权。
- 实现必须遵守 `AGENTS.md` 第 5 节的全部实现门槛。

## 11. Open decisions

> 以下开放决策不改变本 SPEC 已定的行为规则（留存依据、删除触发、审计、
> 备份传播原则），因此不阻塞批准；它们各自被单独门控。

### OD-001: 备份/恢复机制与删除传播窗口

- **Status**: OPEN（与 `SPEC-0012` 协调）。
- **Decision needed**: 备份/恢复技术与"有界传播窗口"的具体时限。R-005 的
  "删除必须传播到备份"原则已定。

## 12. References

- `docs/decisions/DECISION-LOG.md#dec-0034-pursue-real-seed-data-and-bulk-import-prioritize-spec-0011` -
  VERIFIED - 真实数据档位与优先级。
- `docs/decisions/DECISION-LOG.md#dec-0035-spec-0011-introduces-controlled-permanent-deletion-erasure` -
  VERIFIED - 受控永久删除。
- `docs/decisions/DECISION-LOG.md#dec-0036-spec-0011-retention-is-on-demand-with-trigger-based-deletion` -
  VERIFIED - 按需保留 + 触发式删除。
- `docs/decisions/DECISION-LOG.md#dec-0037-legal-compliance-is-out-of-ai-scope-approve-spec-0011-v020` -
  VERIFIED - 法务出范围；批准 v0.2.0。
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md` - VERIFIED -
  归档/更正版本机制与脱敏矩阵。
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` - VERIFIED -
  管理员权限与审计。

## 13. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-001 | 触发条件下永久删除且不可逆测试 | Local/test | To be recorded after authorization |
| AC-002 | 删除审计不含被删内容测试 | Local/test | To be recorded after authorization |
| AC-003 | 归档 vs 永久删除边界测试 | Local/test | To be recorded after authorization |
| AC-004 | 删除向备份传播/未完成标记测试 | Local/test | To be recorded after authorization |
| AC-005 | 当事人请求满足记录测试 | Local/test | To be recorded after authorization |
| AC-006 | 个人字段仍守脱敏测试 | Local/test | To be recorded after authorization |

## 14. Approval

`APPROVED by DEC-0037 on 2026-07-26`

本批准针对 `SPEC-0011 v0.2.0`（已剔除法务/合规内容）。`OD-001`（备份机制）
属单独门控，不阻塞本批准。批准不包含实施授权、真实数据采集/使用、备份或
部署授权。真实养老机构数据的录入与批量导入由产品负责人另行决定并另立 SPEC。
