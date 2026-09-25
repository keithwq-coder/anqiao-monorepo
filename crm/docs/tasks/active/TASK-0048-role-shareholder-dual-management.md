# TASK-0048: 角色叠加 + shareholder 角色 + 双重管理实现（SPEC-0002 v0.5.0）

- Task ID: TASK-0048
- Status: **ACCEPTED（DEC-0179，2026-08-26 授权；2026-08-27 完成 + 生产部署）**
- Task type: IMPLEMENTATION（后端数据模型迁移 + 业务逻辑 + 策略 + 前端角色条件）
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` (v0.5.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Authorization: `DEC-0179`（2026-08-26，批次 TASK-0048/0049/0050 一次性授权）
- Execution owner: 待指定
- Review/acceptance owner: 待指定
- Depends on: 无（本任务为其他两个任务的数据基础）；基线 504 passed, 28 skipped

## Goal

按 SPEC-0002 v0.5.0 实现：① `shareholder`（股东）角色（可见/分配/进池/归档，
不含账号管理）+ 多角色叠加正式化；② 客户记录新增「管理人」`custodian_user_id`
字段（归属人 owner ≠ 管理人 custodian）；③ 股东可直接分配客户给任意销售。

## Scope

### 1. 数据模型迁移（Alembic）

- 新增迁移 `####_add_shareholder_role_and_custodian.py`：
  - `role_grants` CheckConstraint 角色枚举扩展：`business_user / administrator /
    manager / shareholder`（新增 shareholder）；
  - `institutions` 表新增 `custodian_user_id` 列（UUID nullable，FK →
    user_identities.id，RESTRICT）；
  - 索引：`ix_institutions_custodian`。

### 2. 领域模型与角色枚举

- `src/crm/domain/models.py`：`Role` 枚举新增 `SHAREHOLDER = "shareholder"`。
- 角色约束更新：`src/crm/persistence/models.py` 第 42 行扩展。

### 3. 策略层

- `src/crm/application/queries.py`：`PolicySubject` 及 `project_record` 策略
  更新——shareholder 获得与 administrator 相同的可见性（R-008 全公司视图），
  但**不包含**账号管理（R-005/R-011/R-015 拒绝路径）。
- 多角色叠加：`project_record` 的权限判定统一按用户全部有效角色的**并集**计算
  （R-028/R-029）。

### 4. 命令层

- 新增 `ChangeCustodianCommand`（设置/变更管理人；R-031：归属人或管理人自身或
  administrator 可变更；审计写 actor/前后值）。
- 扩展 `CreateInstitutionCommand`：`custodian_user_id` 默认 = 归属人（R-031）。
- 点名分配 `R-026` 扩展：分配目标可为任意启用中的业务角色用户（R-035；
  shareholder 与 administrator 均可执行）。
- 公池认领 `R-033`：认领后归属人 = 管理人 = 认领者。

### 5. API 端点

- `src/crm/web/routes/institutions.py`：新增
  `POST /api/institutions/{id}/change-custodian`（R-031）。
- 现有端点按 shareholder 角色更新权限门（`_denied_if_not_business_writer` 等
  互斥函数扩展为 `business_user / administrator / shareholder 并集`）。
- 账号管理/停用/批量导入/数据擦除端点：**拒绝 shareholder**（403，R-035 约束）。

### 6. 前端角色条件

- `templates/base.html`：导航栏 shareholder 可见：报表（TASK-0050 联调）、客户
  列表、管理摘要；不可见：系统管理/批量导入（账号管理不含）。
- `templates/institutions_list.html`、`dashboard.html`、`institution_detail.html`：
  新建客户、添加联系人/跟进按钮对 shareholder 可见（已通过此前修复使用
  `business_user/administrator` 条件，需更新为含 shareholder）。
- 客户详情页：「管理人」字段可编辑控件（owner/admin/shareholder 可见）。

### 7. 生产账号变更

- 赵、武：role_grants 新增 `shareholder` + `business_user`（移除旧 `manager`
  角色授予，或保留 manager 但不再依赖——scope=苏州 的 manager 授予因 shareholder
  全局可见而不再需要；保留为无害冗余）。
- 授权变更需备份 + 验证（遵循 DEC-0176/0178 先例）。

## Owned files

- `src/crm/domain/models.py`（Role 枚举）
- `src/crm/persistence/models.py`（约束 + InstitutionModel 列）
- `src/crm/persistence/repositories.py`（新增 custodian 查询）
- `src/crm/application/queries.py`（策略）
- `src/crm/application/commands.py`（新增 ChangeCustodianCommand）
- `src/crm/web/routes/institutions.py`（API）
- `src/crm/web/main.py`（页面路由角色门）
- `migrations/versions/`（新增迁移）
- `templates/`（角色条件）
- `tests/`（新测试 + 适应既有测试）

## Out of scope

- 报表功能（TASK-0050）、AI 商机（TASK-0049）。
- 客户金额字段（SPEC-0001 扩展，OD-010 挂起）。
- 生产部署、commit、push（任务卡完成门不含部署）。
- 赵/武的 UI 界面改造（查询/报表/老板界面——属单独前端任务，不在本任务卡；本
  任务卡只做后端权限 + 数据模型）。

## Prerequisites and completion gate

- Prerequisites: 基线 504 passed, 28 skipped；产品负责人明确授权。
- Completion gate：
  1. `python -m pytest tests -q` 全量绿色（新增 + 适应测试，基线不回退）。
  2. `python -m compileall -q src tests migrations` exit 0。
  3. `git diff --check` clean。
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
     `[PASS]`。
  5. 新测试覆盖：shareholder 可见/不可见边界、custodian 独立于 owner、分配
     权限、账号管理拒绝。
  6. 证据文件 `docs/evidence/TASK-0048-*.md`。

## Steps

1. 数据模型迁移（Alembic 新增版本）
2. 领域模型枚举 + 约束更新
3. 策略层 shareholder 集成
4. 命令层（ChangeCustodian + 命令扩展）
5. API 端点（change-custodian + 权限门更新）
6. 前端角色条件
7. 测试
8. 生产账号变更（赵/武）——单独子步骤，需备份 + 验证