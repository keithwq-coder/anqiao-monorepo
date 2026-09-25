# TASK-0037 独立评审证据（DeepSeek-v4-pro）

- 评审身份：DeepSeek-v4-pro（`deepseek-v4-pro-0813`），独立评审角色，非本任务实现者。
- 评审依据：AGENTS.md §7（评审只报告证据与发现，不修改实现、不自我验收）。
- 评审对象：`docs/tasks/active/TASK-0037-customer-type-public-pool.md`（卡片状态 COMPLETE）
  对 `SPEC-0001 v0.8.0` R-037..R-045 / AC-030..AC-039 的实现一致性。
- 评审日期：2026-08-13（与执行证据同窗期）。

## 结论

**PASS（本地合成数据范围内）**

客户三类型（direct_purchase/individual/channel）与公池（owner 可空 + 显式
`in_pool`）在领域模型、迁移、命令与投影四层一致落地；进池（admin/gm，必填原因）、
认领（仅 business_user）、非 owner 脱敏可见等规则与 SPEC-0001 v0.8.0 及
SPEC-0002 v0.4.0 R-027 对齐。本卡同时关闭 TASK-0036 的 R-027。

## 证据明细

### 1. 客户类型三值（R-037/R-038/R-039/R-039a）

- `[VERIFIED]` `src/crm/domain/models.py:26-37` `CustomerType(StrEnum)` 三值
  `direct_purchase / individual / channel`；注释明确 `individual` 第一版保留
  （R-038）、`channel` 为纯标签（R-039）。
- `[VERIFIED]` `migrations/versions/0011_customer_type_and_public_pool.py`
  新增 `customer_type NOT NULL DEFAULT 'direct_purchase'`，并建
  `ck_institutions_customer_type_value` 三值 CHECK；存量回填 `direct_purchase`。
- `[VERIFIED]` `src/crm/web/routes/institutions.py` 创建接口接受可选
  `customer_type`（默认 direct_purchase），非法值被 422 拒绝
  （`test_create_institution_invalid_customer_type_rejected`）。
- `[VERIFIED]` `/{id}/customer-type` 路由仅 owner 或 admin 可改，改动写审计
  （`action="institution.customer_type_change"`，before/after 状态），非 owner
  业务角色 403（`test_change_customer_type_non_owner_denied`）。

### 2. 公池：owner 可空 + 显式 in_pool（R-040）

- `[VERIFIED]` `src/crm/domain/models.py:168-195` `Institution` 域对象
  `owner_user_id: UUID | None`、`in_pool: bool = False`，`__post_init__` 强制
  不变量 `in_pool == (owner_user_id is None)`（R-040）。
- `[VERIFIED]` `migrations/versions/0011...`：`institutions.owner_user_id` 置为
  可空、新增 `in_pool NOT NULL DEFAULT false`，并建
  `ck_institutions_pool_state_consistent`（在池 ⇔ 无主）CHECK；同时
  `institution_owner_history.new_owner_user_id` 置可空以记录「原负责人 → 进池」。

### 3. 进池（R-041，含 SPEC-0002 R-027）

- `[VERIFIED]` `src/crm/web/routes/institutions.py` `/release-to-pool` 仅
  admin/gm 可调用，理由必填（空串/纯空白 → 400）。
- `[VERIFIED]` `src/crm/application/management_commands.py` `ReleaseToPoolCommand`
  写负责人历史（原负责人 → None）、置 `owner=None + in_pool=True`、写审计。
- `[VERIFIED]` `test_release_to_pool_by_admin`（历史+审计断言）、
  `test_release_to_pool_requires_reason`（空理由 400）、
  `test_business_user_cannot_release_to_pool`（业务角色 403）。
- `[INFERENCE]` R-041「必填原因（可下拉选）」与 R-026 不同——进池对 admin/gm
  均要求理由，实现与 SPEC-0001 R-041/AC-033 一致。

### 4. 认领（R-043/R-044）

- `[VERIFIED]` `/claim` 路由仅 `business_user` 可认领，admin/gm 被拒（R-044）。
- `[VERIFIED]` `ClaimFromPoolCommand`：`in_pool=False`、`owner=claimant`，写
  负责人历史（None → 认领人）+ 审计。
- `[VERIFIED]` `test_claim_from_pool_by_business_user`（历史含
  「release: prev→None」与「claim: None→认领人」两段）、
  `test_claim_non_pool_customer_fails`（非池认领 400）、
  `test_admin_and_gm_cannot_claim`（admin/gm 403）。

### 5. 池中客户脱敏可见（R-042/R-045）

- `[VERIFIED]` `src/crm/policy/projection.py` 详情与协作两套投影均含
  `customer_type / in_pool / owner_user_id`；协作投影只给 `source_category`
  不含原文 `source_description`（`:245-259`），联系人姓名掩码 `***`。
- `[VERIFIED]` 非 owner 业务角色对池中客户的投影为 `COLLABORATOR`（脱敏），
  `source_description` 不出现在投影中（`test_pool_customer_is_desensitized_for_business_roles`）。

## 验证命令与结果（本次评审实际执行）

- `python -m pytest tests -q` → **395 passed, 28 skipped, 2 warnings**（exit 0，111.75s）。
  含 `tests/test_task0037_customer_type_pool.py` 11 例全通过。
- `python -m compileall -q src tests migrations` → OK。
- `git diff --check` → clean。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` →
  `[PASS] Governance structure and gates are consistent`。

## 发现 / 风险

- `[VERIFIED]` 测试均基于 SQLite 合成数据；PostgreSQL 门控用例为 skip，生产库
  上的 CHECK 约束行为（UUID 可空、CHECK 三值/池态一致）未在生产实例验证。
- `[UNKNOWN]` R-043「并发认领后到者失败、不得双负责人」的并发护栏：迁移层
  `ck_institutions_pool_state_consistent` 与 `in_pool` 置位提供数据库级一致性，
  但本次本地测试未做真实并发压测（SPEC-0001 已注明并发要求；单测未覆盖真并发）。

## 未验证项（非本次授权范围）

- 生产数据库迁移执行（`0011` 及其前置链）——未对共享/生产库执行。
- 真实 PostgreSQL 上的 UUID 可空与 CHECK 约束行为。

## 待决策项

- 无（本卡范围内无需新决策）。

## 评审边界声明

本文件只记录证据与发现，不将 `TASK-0037` 翻转为 ACCEPTED；卡片验收由产品负责人
在其验收流程中作出。
