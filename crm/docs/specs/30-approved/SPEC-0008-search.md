# SPEC-0008: 搜索（不含导出）

- Spec ID: SPEC-0008
- Version: 0.1.0
- Status: APPROVED
- Product owner: User
- Prepared by: Claude Code / Opus 4.8
- Last updated: 2026-07-26
- Supersedes: none

## 1. Problem

客户和跟进记录变多后，使用者需要能快速找到某条记录。搜索必须严格继承
`SPEC-0001` 的脱敏与权限边界：它既不能显示、也不能被用来反推使用者无权
查看的受保护信息，并且不提供把数据导出到系统外的能力。

本 SPEC 目前是草稿；批准与实施授权都是独立步骤，均未发生。

## 2. Verified context

- [VERIFIED] `DEC-0027` 将 `SPEC-0008` 收窄为"只搜索、不导出"，保存的视图
  延后。
- [VERIFIED] `SPEC-0001` R-012/R-030/AC-008：页面、搜索、导出和接口执行同一
  字段级可见规则，缺少显示规则时默认隐藏。
- [VERIFIED] `SPEC-0002` R-013：页面、搜索、接口、AI 上下文和后台任务使用
  同一身份、角色、归属和字段可见规则；R-023 提供聚合反推保护。
- [VERIFIED] `SPEC-0003` R-008：呈现颗粒度不得成为反推受保护信息的通道。
- [VERIFIED] `DEC-0028` 确认 CRM 自成一体，不连接外部系统。
- [VERIFIED] `DEC-0011` 冻结实现；本 SPEC 仅允许本地合成数据验证。

## 3. Goal and success measure

有权限的使用者能按自己可见的字段找到记录，搜索结果按其角色脱敏；使用者
既看不到、也无法通过搜索反推自己无权查看的内容；数据不能被导出到系统外。

非技术人员可以这样判断成功：用不同身份搜同一批客户，能搜到的和看到的都
符合分工；界面上没有"导出/下载"这类把数据带走的入口。

## 4. Non-goals

- 导出或下载记录/搜索结果；
- 保存的视图、自定义看板或自定义报表；
- 对客户原话、原始跟进正文等受保护内容的全文检索；
- 跨系统或外部数据源搜索；
- 搜索结果的评分、排序推荐或优先级。

## 5. Users and permissions

沿用 `SPEC-0002` 身份与权限。

- [VERIFIED] **记录负责人**：可搜索并以完整明细查看本人负责的记录。
- [VERIFIED] **其他已授权业务人员**：可搜索到他人负责的机构/联系人，但只
  得到 `SPEC-0001` 脱敏后的信息与精简进度。
- [VERIFIED] **总经理/其他管理层**：默认只读，按 `DEC-0013` 授权范围与
  精简边界，搜索不放大其敏感字段可见性。
- [VERIFIED] **未授权主体**：不能搜索，也不能通过搜索确认记录是否存在。

## 6. Required behavior

- R-001: 有权限使用者可通过搜索查找其有权查看的机构/联系人记录。
- R-002: 搜索结果按搜索者角色的 `SPEC-0001` 字段级脱敏呈现，页面、搜索与
  接口结果一致。
- R-003: 搜索只能匹配搜索者有权查看其值的字段；不得以受保护字段值（联系
  方式、客户原话、原始跟进正文、证据等）作为查询条件或返回，避免成为确认
  或反推受保护信息的通道。
- R-004: 不提供把记录或搜索结果导出/下载到系统外的能力。
- R-005: 未授权主体不能搜索，也不能通过搜索结果确认某条记录是否存在。
- R-006: 本阶段不提供保存的视图、自定义看板或自定义报表。
- R-007: 搜索与页面、接口使用同一身份、权限与字段可见规则（`SPEC-0002`
  R-013）。
- R-008: 搜索结果的数量、存在性或颗粒度不得成为反推受保护信息的间接通道
  （与 `SPEC-0002` R-023、`SPEC-0003` R-008 同向）。

## 7. Data and integrations

搜索是只读能力，不产生新的业务对象。可搜索字段限于搜索者有权查看其值的
非敏感字段（例如机构名称、类别、地区、负责人；本人负责记录可及于其可见的
明细）。搜索不连接外部系统，也不导出数据。

- 外部集成：`Not applicable`（由 `DEC-0028` 确认，CRM 自成一体）。
- 数据留存与生产存储边界属延后的 `SPEC-0011`/`SPEC-0012`（`DEC-0030`）。

## 8. Failure and edge behavior

- 无匹配时返回空结果，不泄露是否存在使用者无权查看的记录。
- 使用者尝试按无权查看的字段查询时，系统忽略该条件或拒绝，不返回受保护值。
- 脱敏无法安全应用时，隐藏该记录或字段，而不是回退为完整数据。
- 无权限搜索被拒绝，且不泄露记录存在性。

## 9. Acceptance criteria

- AC-001: Given 有权限使用者，when 按可见字段搜索，then 返回其有权查看的
  匹配记录，并按角色脱敏。
- AC-002: Given 其他业务人员，when 搜索他人负责的机构，then 只返回脱敏
  机构/联系人信息与精简进度，不含渠道值、原始跟进正文、客户原话或证据。
- AC-003: Given 任一使用者，when 尝试用受保护字段值（如手机号）搜索，then
  系统不以该值匹配，也不确认其存在。
- AC-004: Given 任一使用者，when 使用搜索，then 不存在导出或下载记录/结果
  的能力。
- AC-005: Given 未授权主体，when 请求搜索，then 被拒绝且不泄露记录是否存在。
- AC-006: Given 页面、搜索、接口，when 同一身份访问同一记录，then 字段可见
  结果一致。
- AC-007: Given 小样本或存在性探测，when 结果可能反推受保护信息，then 系统
  隐藏或泛化而不是泄露。

自动化权限/脱敏一致性检查与人工业务验收必须分别记录。

## 10. Constraints and safety

- 继续执行 `SPEC-0001`/`SPEC-0002` 的最小必要展示、字段默认隐藏与例外访问
  审计。
- 只允许本地合成数据验证；不导出、不外传、不部署，直至相应授权。
- 实现必须遵守 `AGENTS.md` 第 5 节的全部实现门槛（含 baseline 冻结）。

## 11. Open decisions

无影响行为或验收的开放决策。可搜索字段规则由 R-003 确定（只匹配搜索者
有权查看其值的字段），无需另设开放决策。

## 12. References

- `docs/decisions/DECISION-LOG.md#dec-0027-spec-0008-kept-as-search-only-no-export` -
  VERIFIED - 只搜索、不导出的范围。
- `docs/decisions/DECISION-LOG.md#dec-0028-no-external-integrations-or-notifications-no-separate-spec-0009` -
  VERIFIED - CRM 自成一体，外部集成不适用。
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md` - VERIFIED -
  字段级脱敏矩阵、跨路径一致性、缺省隐藏。
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` - VERIFIED -
  身份/权限跨路径一致与聚合反推保护。
- `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` - VERIFIED -
  颗粒度反推保护同向原则。

## 13. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-001 | 按可见字段搜索与角色脱敏测试 | Local/test | To be recorded after authorization |
| AC-002 | 他人记录脱敏结果测试 | Local/test | To be recorded after authorization |
| AC-003 | 受保护字段值不可作为查询/确认测试 | Local/test | To be recorded after authorization |
| AC-004 | 无导出能力测试 | Local/test | To be recorded after authorization |
| AC-005 | 未授权搜索拒绝且不泄露存在性测试 | Local/test | To be recorded after authorization |
| AC-006 | 页面/搜索/接口字段可见一致性测试 | Local/test | To be recorded after authorization |
| AC-007 | 小样本/存在性反推保护测试 | Local/test | To be recorded after authorization |

## 14. Approval

`APPROVED by DEC-0032 on 2026-07-26`

本批准针对 `SPEC-0008 v0.1.0`。批准不包含实施授权、真实数据使用、外部写入
或部署授权；完整 SPEC 基线的完工由 `DEC-0033` 单独记录。
