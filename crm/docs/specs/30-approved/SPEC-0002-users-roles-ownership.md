# SPEC-0002: 用户、角色、归属与访问管理

- Spec ID: SPEC-0002
- Version: 0.5.0
- Status: APPROVED
- Approved: DEC-0177（2026-08-26，产品负责人直接批准）
- Implemented: 2026-08-27（DEC-0179，TASK-0048；生产已部署）
- Product owner: User
- Prepared by: Reasonix（2026-08-26；INBOX-0003）
- Last updated: 2026-08-27（实现后状态更新）
- 来源: INBOX-0003（2026-08-26 产品负责人指令：赵/武为股东+销售+可分配；双重管理；
  报表）

## 0. 版本说明（本草案对 v0.4.1 的变更）

1. **多角色叠加成为正式模型**：一个用户可同时持有多个角色，权限取并集。现有
   `role_grants` 数据模型已支持（`user_id` 非唯一），本草案将"叠加"从隐式能力
   明确为业务规则。
2. **赵、武角色变更**：从纯只读 `manager`（scope=苏州）调整为**业务型股东**——
   全局完整可见 + 写客户 + 分配客户 + 进池/归档，**不含**账号管理/停用/数据
   擦除。实现上新增 `shareholder`（股东）角色，能力 = administrator 的
   可见/分配/进池/归档（不含账号管理）+ business_user 的写能力。
   > 产品负责人 2026-08-26 决策（OD-004）：赵/武**不继承** administrator 的
   > 账号管理、停用、批量导入、数据擦除能力，限定为「业务型股东」。
3. **双重管理**：客户记录新增「管理人」（`custodian_user_id`）字段，与「归属人」
   （`owner_user_id`）并存。归属人 = 业绩归属；管理人 = 日常跟进管理。两者可为
   同一人，也可不同人（如归属于赵、管理人是何）。
4. **导出/报表前提**：报表（见 SPEC-0016）需要按归属人或管理人聚合，本草案提供
   该数据基础。

## 1. Problem

内部 B2B/G CRM 的权限模型（v0.4.1）把股东（赵、武）限定为纯只读 manager，
不符合真实业务：股东既需要全局可见（公司治理、「了解、督办」），又承担销售
任务（录入自己的客户），还有权把客户分配给销售团队。同时，业绩归属与日常管
理可能是两个人（双经理），当前单一 `owner_user_id` 无法表达，导致报表无法按
归属/管理两个维度核算。

## 2. Verified context

- [VERIFIED] `role_grants` 表结构：`user_id` 非唯一，一个用户可有多个
  `(role, scope_reference)` 记录；角色约束为
  `business_user / administrator / manager`（`src/crm/persistence/models.py:38-66`）。
- [VERIFIED] `manager` 角色必须有 `scope_reference`（约束
  `manager_scope_required`，同上）。
- [VERIFIED] `DEC-0172`（2026-08-24）把赵/武设为纯只读 manager（scope=苏州）、
  吴为 administrator；本草案经产品负责人 2026-08-26 指令修订（INBOX-0003）。
- [VERIFIED] `InstitutionModel` 当前仅有 `owner_user_id`（`models.py:99`），无
  管理人字段。
- [VERIFIED] 点名分配（R-026）与进池（R-027）当前仅属 administrator
  （SPEC-0002 v0.4.1）。
- [UNKNOWN] 赵/武是否需要 administrator 的全部能力（账号管理、停用、批量导入、
  数据擦除），还是仅需「全局可见 + 分配 + 写」的子集（见 Open Decisions）。

## 3. Goal and success measure

任何客户记录的「归属人」与「管理人」都能独立表达、可追溯；股东（赵、武）在
系统内能看到全部客户、能写自己的客户、能直接把客户分配给任意销售；业绩核算
可按归属人或管理人拉取。非技术验收：赵登录后能看到所有客户并新建自己的客户；
赵可以把某个客户直接转给何丹；「归属于赵、管理人是何」的客户在报表里能按两
个维度各拉一次。

## 4. Non-goals

- 不定义佣金/提成计算规则（仅提供归属/管理维度供报表统计，计算规则属于
  财务/绩效 SPEC，本版本不含）。
- 不做角色自定义编辑器（用户能否自定义任意权限组合不在本版本）。
- 不改变 business_user / administrator 既有规则，除非本草案明确覆盖。
- 不定义「股东」作为第四个角色的名称——产品负责人已选择「叠加现有角色」。

## 5. Users and permissions

| 主体 | 角色组合 | 可见 | 可写 | 可分配 |
|---|---|---|---|---|
| 吴 | administrator | 全局完整可见 | 任意记录（自动留痕） | 是（R-026） |
| 赵 | shareholder + business_user | 全局完整可见 | 全局 + 名下客户 | 是（R-026） |
| 武 | shareholder + business_user | 全局完整可见 | 全局 + 名下客户 | 是（R-026） |
| 何丹/何/张/sa001–010 | business_user | 名下客户完整；他人客户脱敏 | 名下客户 | 否 |
| （无） | manager | 保留：授权 scope 脱敏只读 | 否 | 否 |

> 决策记录（OD-004，2026-08-26）：赵/武为「业务型股东」——**不继承**
> administrator 的账号管理、停用、批量导入、数据擦除能力；只取其全局可见、
> 点名分配、进池/归档。孤立的 `shareholder` 角色本身无意义，必须与
> `business_user` 叠加使用（叠加模型见 R-028）。

## 6. Required behavior

### 6.1 多角色叠加

- R-028: 一个用户可同时持有多个角色；有效权限 = 各角色权限的并集；任一角色
  被停用不影响其他角色；用户整体状态（enabled/disabled）仍按 `user_identities`
  主记录。
- R-029: 权限判定统一按「当前用户全部有效角色的并集」计算，所有界面、API、
  搜索、导出、报表、AI 上下文使用同一判定（沿用 R-013）。

### 6.2 双重管理（归属人 + 管理人）

- R-030: 客户记录新增可选字段「管理人」（`custodian_user_id`，可空）；「归属人」
  沿用 `owner_user_id`。管理人可为空、可等于归属人、可等于他人。
- R-031: 创建客户时，管理人默认等于归属人（若未指定）；创建后可由归属人、
  管理人（若为业务角色）或 administrator 变更管理人；变更写审计（谁/何时/
  前后值）。
- R-032: 「管理人」不作为业绩归属依据；业绩归属仅按 `owner_user_id`。
  报表（SPEC-0016）可按归属人或管理人分别聚合，两者不混用。
- R-033: 公池客户（`owner_user_id IS NULL`）无归属人；认领后归属人 = 认领者
  （沿用 R-043 认领规则），管理人默认 = 认领者。
- R-034: 归属人转交（既有 R-009/R-010）不改变管理人；管理人更换不改变归属人。
  两者独立、可追溯。

### 6.3 股东分配能力

- R-035: administrator 与 shareholder（叠加了 business_user 的赵/武）可把客户
  直接分配给任意启用中的业务角色用户（R-026 点名分配扩展：目标不限于「具体
  业务人员」，仍必须为启用用户；分配写负责人历史 + 审计）。
- R-036: 被分配客户的归属人 = 新负责人（沿用转交语义）；若需「归属赵、管理
  人何」的业务形态，应先分配归属、再设置管理人（R-031），或由具备权限者一次
  完成（分配归属 + 设管理人，两条审计）。
- R-037: 赵/武也可把客户交给吴，由吴再次分配（吴为 administrator，天然可以
  二次分配）。

## 7. Acceptance criteria

- AC-027: 赵/武登录后角色集合 = `{shareholder, business_user}`；能看到全部
  客户（含全公司列表），可新建/编辑自己的客户；**不能**进账号管理/停用/批量
  导入/数据擦除页面（403）。
- AC-028: 赵把客户 X 直接分配给何丹，X 的归属人变为何丹，负责人历史 + 审计
  可追溯；何丹获得完整访问权，赵（股东全局可见）仍可见。
- AC-029: 客户 X 归属=赵、管理人=何，两字段独立存储；报表按归属人（赵）与按
  管理人（何）各能拉出 X（SPEC-0016 验收联测）。
- AC-030: 转交归属不改变管理人；更换管理人不改变归属人（双向独立）。
- AC-031: 公池客户认领后归属人=管理人=认领者。
- AC-032: 全量 `pytest tests -q` 不回退（基线 504 passed, 28 skipped）。

## 8. Constraints and safety

- 继续执行 `SPEC-0001` 最小必要展示、脱敏矩阵；administrator 全局可见与
  R-008 例外访问审计不变。
- 多角色并集不得突破 `SPEC-0001` 字段级脱敏硬边界（R-018：后续 SPEC 可以
  更窄，不得静默扩大敏感字段可见范围）。
- `shareholder` 的全局可见遵循 admin 的全公司视图规则（R-008/R-019），但
  账号/角色管理（R-005/R-011/R-015）**不属于 shareholder**；赵/武的账号管理
  权限必须显式登录吴的 administrator 账号执行。
- 真实账号数据修改（赵/武角色、双重管理字段）需生产授权与备份（AGENTS.md §8）；
  本草案不授权任何数据变更。

## 9. Open decisions

- **OD-004（已决策，2026-08-26）**: 赵/武 = 「业务型股东」（shareholder +
  business_user）：全可见 + 写 + 分配 + 进池/归档，**不含**账号管理/停用/
  批量导入/数据擦除。实现上新增 `shareholder` 角色（与 `business_user` 叠加）。
- **OD-005**: 「管理人」变更是否需要归属人同意/通知？（默认：不需要，仅审计。）
- **OD-006**: 报表（SPEC-0016）的业绩口径按 `owner_user_id` 还是
  `custodian_user_id`？（本草案默认业绩=归属人；管理维度=管理人。）

## 10. References

- `docs/decisions/DECISION-LOG.md` DEC-0013、DEC-0149、DEC-0152、DEC-0172。
- `docs/specs/00-inbox/INBOX-0003-role-redefinition-reporting-ai-opportunity-fix.md`。
- `CONTEXT.md`（领域词汇表）。

## 11. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-027…AC-031 | 角色叠加 / 双重管理 / 分配测试 | Local/test（PostgreSQL 门控） | 授权任务后记录 |
| AC-032 | 全量 pytest | Local | 授权任务后记录 |

> 本草案为 DRAFT：不授权实现。需 review → 30-approved（approval.json hash
> 匹配）→ 活动任务卡 → 单独实现授权（AGENTS.md §5）。