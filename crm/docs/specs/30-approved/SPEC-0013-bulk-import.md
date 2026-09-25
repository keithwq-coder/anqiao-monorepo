# SPEC-0013: 批量导入

- Spec ID: SPEC-0013
- Version: 0.1.0
- Status: APPROVED
- Product owner: User
- Prepared by: Claude Code / Opus 4.8
- Last updated: 2026-07-27
- Supersedes: none

## 1. Problem

需要一次性把很多条机构/联系人记录从一个用户提供的文件载入 CRM，而不是逐条
手工录入。载入必须保留每条记录的来源、对疑似重复给出提示、在部分行有问题时
不阻塞其余行，并允许把整批载入回看与撤销。

本 SPEC 定义批量导入的工程行为合同，不预设文件格式解析或存储技术。是否录入
真实数据由产品负责人自行决定，不在本 SPEC 范围内。本 SPEC 目前是草稿；批准
与实施授权都是独立步骤，均未发生。

## 2. Verified context

- [VERIFIED] `DEC-0038` 确认批量导入为"信任导入 + 判重提示 + 整批可回滚"，
  不逐条人工确认，疑似重复只提示不自动合并。
- [VERIFIED] `DEC-0034` 记录产品负责人希望批量录入（真实养老机构数据的录入
  是其自行决定）。
- [VERIFIED] `SPEC-0001` R-025/R-035：机构建档至少需名称、来源说明、负责人；
  疑似重复应提示且不自动合并。
- [VERIFIED] `SPEC-0002`：管理员为特权操作者；身份/权限/审计跨路径一致。
- [VERIFIED] `SPEC-0011`：留存与受控永久删除。
- [VERIFIED] `DEC-0028`：CRM 自成一体，不连接外部系统。
- [VERIFIED] `DEC-0037`：法务/合规由产品负责人负责，不写入 SPEC。
- [UNKNOWN] 具体文件格式与字段映射、以及真实数据录入时机（由产品负责人
  决定）。

## 3. Goal and success measure

管理员能用一个用户提供的文件，一次性把很多条机构/联系人载入为 `SPEC-0001`
记录；每条带来源；疑似重复被提示；无效行被逐条报告而不阻塞有效行；整批在
其记录未被改动前可以撤销。

非技术人员可以这样判断成功：导入 100 条，其中 3 条格式不对——系统导入了
97 条、清楚列出那 3 条的原因；重复的被标出来让人看，而不是偷偷合并；发现
导错了，可以把这一整批撤掉（只要还没被人动过）。

## 4. Non-goals

- 外部/实时数据源采集（`DEC-0028`，自成一体）；
- 自动合并重复记录或 AI 评分；
- 把导入记录映射为商机或漏斗；
- 选择文件格式解析引擎、存储或加密方案；
- 法律与合规判断（由产品负责人负责，`DEC-0037`）。

## 5. Users and permissions

沿用 `SPEC-0002` 身份与权限。

- [VERIFIED] **管理员**：批量导入的执行者（特权操作），每批留痕。
- [VERIFIED] **记录负责人/其他业务人员/管理层**：默认不能执行批量导入。
- [VERIFIED] 导入后的记录按 `SPEC-0001`/`SPEC-0002` 的归属、脱敏与审计规则
  存在，导入不新增可见性。
- [UNKNOWN] 是否允许管理员以外的角色导入（默认仅管理员；见 `OD-002`）。

## 6. Required behavior

- R-001: 管理员可用一个用户提供的文件，在一次操作中导入多条机构/联系人记录。
- R-002: 每条导入记录必须带来源（`SPEC-0001` 来源说明）；缺少获批最小必填
  信息的行被逐行拒绝，不阻塞其他行。
- R-003: 导入为信任载入，不逐条人工确认；但与既有记录疑似重复的，标记供
  人工复核，绝不自动合并（与 `SPEC-0001` R-035 一致）。
- R-004: 部分失败时，有效行照常导入，无效行逐条报告原因；系统不得在有行
  失败时显示"全部成功"，且重复运行同一文件不得重复导入已成功的行。
- R-005: 每次导入是一个有稳定身份的批次，记录导入者、时间、来源文件引用，
  以及导入/标记重复/失败的计数。
- R-006: 整批可在其记录仍未被改动前回看并撤销；已被修改、已进入负责人工作
  或被引用的记录不在撤销范围内，且须清楚报告。
- R-007: 导入记录进入后适用同一 `SPEC-0001`/`SPEC-0002` 脱敏、归属与审计
  规则；导入不授予新的可见性。
- R-008: 验证使用合成数据；是否导入真实数据是产品负责人的自行决定，不在
  本 SPEC 决定。
- R-009: 导入记录之后即为普通 `SPEC-0001` 记录（非独立对象）；重复标记是
  提示性的，通过既有归档/撤回处理，不自动合并。

## 7. Data and integrations

### Data concepts

- **导入批次**：一次导入的稳定身份、导入者、时间、来源文件引用、计数与状态。
- **行结果**：每行是导入成功、被标记疑似重复、还是失败（含原因）。

### Minimum data contract

| 对象 | 必需信息 | 系统维护信息 |
|---|---|---|
| 导入批次 | 导入者、来源文件引用 | 稳定身份、时间、导入/重复/失败计数、批次状态、可撤销范围 |

- 外部集成：`Not applicable`（`DEC-0028`）。
- 文件格式与字段到 `SPEC-0001` 的映射属实现细节（`OD-001`）。

## 8. Failure and edge behavior

- 文件无法解析或整体不符合约定时，拒绝并说明原因，不产生半成品批次。
- 疑似重复只标记不合并；用户可据既有归档/撤回处理。
- 撤销时遇到已被改动的记录，将其排除并报告，不静默删除他人已处理的工作。
- 导入或撤销的审计写入失败时，操作不得显示为成功。

## 9. Acceptance criteria

- AC-001: Given 一个含多条有效记录的文件，when 管理员导入，then 每条成为
  带来源的 `SPEC-0001` 记录，并返回批次身份。
- AC-002: Given 文件中部分行缺少必填信息，when 导入，then 有效行导入、无效
  行逐条报告原因，且不显示"全部成功"。
- AC-003: Given 文件中的记录与既有记录疑似重复，when 导入，then 被标记供
  复核，不自动合并。
- AC-004: Given 同一文件被重复导入，when 再次运行，then 已成功的行不被重复
  导入。
- AC-005: Given 一个批次的记录仍未被改动，when 管理员撤销该批，then 这些
  记录被移除且可审计。
- AC-006: Given 批次中部分记录已被修改或进入工作，when 撤销，then 这些记录
  被排除并报告，其余可撤销。
- AC-007: Given 导入记录，when 由不同角色查看，then 仍适用 `SPEC-0001` 脱敏
  与归属，导入不新增可见性。
- AC-008: Given 非管理员，when 尝试批量导入，then 被拒绝。

自动化导入/失败/撤销/权限检查与人工业务验收必须分别记录。

## 10. Constraints and safety

- 继续执行 `SPEC-0001`/`SPEC-0002`/`SPEC-0011` 的脱敏、权限、审计与生命周期。
- 只允许本地合成数据验证；真实数据录入由产品负责人另行决定。
- 实现必须遵守 `AGENTS.md` 第 5 节的全部实现门槛。

## 11. Open decisions

> 以下开放决策不改变本 SPEC 已定的行为规则（信任导入、逐行结果、判重提示、
> 批次撤销原则、权限），因此不阻塞进入 `20-review`。

### OD-001: 文件格式与字段映射

- **Status**: OPEN（实现细节）。
- **Decision needed**: 具体文件格式与字段到 `SPEC-0001` 最小合同的映射。行为
  规则不受影响。

### OD-002: 导入执行者范围

- **Status**: OPEN。
- **Decision needed**: 是否允许管理员以外的角色导入。默认仅管理员（R-001/
  R-008 前提）。

## 12. References

- `docs/decisions/DECISION-LOG.md#dec-0038-bulk-import-is-a-trusted-load-with-duplicate-flagging-and-batch-undo` -
  VERIFIED - 信任导入 + 判重 + 可回滚。
- `docs/decisions/DECISION-LOG.md#dec-0034-pursue-real-seed-data-and-bulk-import-prioritize-spec-0011` -
  VERIFIED - 批量录入需求来源。
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md` - VERIFIED -
  最小字段、来源说明、判重提示、归档。
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` - VERIFIED -
  管理员权限与跨路径一致审计。
- `docs/specs/30-approved/SPEC-0011-data-lifecycle.md` - VERIFIED -
  留存与受控删除。

## 13. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-001 | 多条有效记录导入与批次身份测试 | Local/test | To be recorded after authorization |
| AC-002 | 部分失败逐行报告、不误报全成功测试 | Local/test | To be recorded after authorization |
| AC-003 | 疑似重复标记不合并测试 | Local/test | To be recorded after authorization |
| AC-004 | 重复运行幂等测试 | Local/test | To be recorded after authorization |
| AC-005 | 未改动批次撤销测试 | Local/test | To be recorded after authorization |
| AC-006 | 撤销排除已改动记录测试 | Local/test | To be recorded after authorization |
| AC-007 | 导入记录脱敏/归属一致测试 | Local/test | To be recorded after authorization |
| AC-008 | 非管理员导入拒绝测试 | Local/test | To be recorded after authorization |

## 14. Approval

`APPROVED by DEC-0039 on 2026-07-27`

本批准针对 `SPEC-0013 v0.1.0`。开放决策（`OD-001`–`OD-002`）不改变已定行为，
不阻塞本批准。批准不包含实施授权、真实数据导入或部署授权；真实数据的录入
由产品负责人另行决定。
