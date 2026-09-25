# TASK-0037 执行证据（客户三类型 + 公池 + 术语统一「客户」）

- Task: TASK-0037（SPEC-0001 v0.8.0：客户三类型、公池、术语统一「客户」）
- Executed by: DeepSeek-v4-flash（2026-08-13）
- Authority: `DEC-0153`（SPEC 批准）、`DEC-0154`（实现授权）
- Scope: 本地合成数据；不碰生产、不 commit
- Status: COMPLETE

## 变更内容

### 1. 客户类型字段（R-037 / R-038 / R-039 / R-039a）
- `src/crm/domain/models.py`：新增 `CustomerType` 枚举（direct_purchase/individual/
  channel）；`Institution` 增加必填 `customer_type`、`owner_user_id` 改为可空、
  新增 `in_pool` 标记；领域校验 `in_pool == (owner is None)`。
- `src/crm/persistence/models.py`：`InstitutionModel` 加 `customer_type` 列 +
  `customer_type_value` CHECK + `in_pool` 列 + `pool_state_consistent` CHECK；
  `owner_user_id` 改为可空；`institution_owner_history.new_owner_user_id` 改为可空。
- `src/crm/persistence/repositories.py`：`domain_institution_from_model` 带上
  customer_type/in_pool；`create` 接受 customer_type；导入路径设为 direct_purchase。
- `src/crm/policy/projection.py`：详细/协作投影带 customer_type/in_pool。
- `src/crm/application/{commands,management_commands}.py`：
  - `CreateInstitutionCommand` 接收 customer_type（默认 direct_purchase，兼容旧客户端）。
  - `ChangeCustomerTypeCommand`（R-039a）：类型变更写审计（谁/何时/从哪到哪）。
  - `ReleaseToPoolCommand`（R-041 进池）、`ClaimFromPoolCommand`（R-043 认领），
    均在事务内写负责人历史 + 审计。
- `src/crm/application/queries.py`：`InstitutionSummary`/`InstitutionDetail` 增加
  customer_type/in_pool 字段。
- `src/crm/web/routes/institutions.py`：创建路由接收 customer_type（非法标签 422）；
  新增 `/release-to-pool`（admin/gm，必填原因）、`/claim`（business_user 认领，
  admin/gm 拒绝）、`/{id}/customer-type`（负责人或 admin，自动留痕）。
- `src/crm/web/main.py`：表单创建处理器接收 customer_type。
- `migrations/versions/0011_customer_type_and_public_pool.py`（新增）：
  加 customer_type（server_default direct_purchase 回填存量）、in_pool、
  owner_user_id 可空、owner_history.new_owner_user_id 可空 + CHECK。

### 2. 公池（R-040..R-045）
- owner 可空 + 显式 in_pool 标记；进池（admin/gm，写负责人历史+必填原因+审计）；
  认领（business_user，认领即成为负责人+留审计，管理员/总经理不参与认领）；
  无主客户对业务角色脱敏可见（投影层：owner 为空 → 恒 COLLABORATOR）。
- 术语表（CONTEXT.md/ADR-0004）落地。

### 3. 术语统一「客户」
- 模板 base.html / institutions_list / institution_detail / dashboard /
  institution_create 改为「客户」；`institution_create` 加客户类型下拉；
  移除过时的高管「例外查看」卡片（R-008 已让 admin 默认完整可见）；
  base.html 移除残留的 `agent` 角色判断。

## 测试

- 新增 `tests/test_task0037_customer_type_pool.py`（11 个用例）：
  建客户带类型、非法类型 422、负责人改类型留痕、非负责人改类型拒、
  admin 进池、进池必填原因、非 admin/gm 不能进池、business_user 认领、
  认领非公池客户失败、admin/gm 不能认领、公池客户对业务角色脱敏可见。
- `tests/test_domain_models.py`：新增公池状态一致性测试（R-040）。
- `tests/test_persistence_schema.py`：邮箱/约束随模型更新。

## 验证结果（实际运行）

| Check | Result |
|---|---|
| 全量本地 pytest | `387 passed, 28 skipped` |
| `python -m compileall -q src tests` | exit 0 |
| `git diff --check` | exit 0 |
| `scripts/check-governance.ps1` | `[PASS]` |

## 边界

- 未 commit / push / reset。
- 未碰生产。
- 同时关闭了 TASK-0036 的 R-027（进池）交叉引用。
- 内部表名仍为 `institutions`（SPEC-0001 OD-001：内部命名迁移属实现细节，
  不改变产品行为；产品展示统一为「客户」）。
- NOT SELF-ACCEPTED；待 DeepSeek-v4-pro 独立评审。
