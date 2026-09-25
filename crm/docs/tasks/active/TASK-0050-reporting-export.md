# TASK-0050: 报表与 Excel 导出实现（SPEC-0016 v0.1.0）

- Task ID: TASK-0050
- Status: **IMPLEMENTATION（DEC-0179，产品负责人一次性授权 TASK-0048/0049/0050）**
- Task type: IMPLEMENTATION（后端报表聚合 + API + 导出 + 前端页面）
- Approved SPEC: `docs/specs/30-approved/SPEC-0016-reporting-export.md` (v0.1.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0016-reporting-export.approval.json`
- Authorization: `DEC-0179`（2026-08-26，批次 TASK-0048/0049/0050 一次性授权）
- Execution owner: 待指定
- Review/acceptance owner: 待指定
- Depends on: TASK-0048（SPEC-0002 v0.5.0：custodian_user_id 聚合、shareholder
  角色权限）；**金额字段依赖 SPEC-0001 扩展**（OD-010 挂起——本任务先做不含
  金额的报表版本，金额合计列为"待 SPEC-0001 扩展"标记）

## Goal

按 SPEC-0016 v0.1.0 实现：① 四类报表（客户统计 / 销售业绩 / 跟进活动 / 公池
动态）的聚合查询 + API + 页面；② Excel 导出（`.xlsx`，遵循脱敏与权限硬边界）；
③ 导航新增「报表」入口，仅对 administrator 与 shareholder+business_user（赵/武）
可见。

## Scope

### 1. 报表聚合查询（四类）

- `src/crm/application/queries.py`（或新增 `src/crm/application/reporting.py`）：
  - **客户统计（R-001）**：`customer_stats(time_range, filter_dimensions)` →
    按客户类型/地区/来源分类聚合 count，按时间范围筛选新增数。
  - **销售业绩（R-002）**：`sales_performance(time_range, by_owner=True|False)`
    → 按归属人（owner）或管理人（custodian）聚合客户数、新增客户数、当前
    有效跟进数；**金额合计列为"待 SPEC-0001 扩展"**（金额字段挂起时显示
    `—` 并标注）。
    排序支持榜单（按客户数降序）。
  - **跟进活动（R-003）**：`followup_stats(time_range, filter_dimensions)` →
    按跟进方式类别/跟进人员/月份聚合次数；概览"有跟进客户数/无跟进客户数"。
  - **公池动态（R-004）**：`pool_stats(time_range)` → 公池客户总数、按地区/
    类型分布、认领/释放/进池记录数。
- 所有聚合只使用 `project_record` 有权查看的记录计算（R-005 硬边界）；不使用
  管理摘要假设。

### 2. API 端点

- `src/crm/web/routes/reporting.py`（新建）：
  - `GET /api/reporting/customer-stats?time_range=...&dimension=...`
  - `GET /api/reporting/sales-performance?by=owner|custodian&time_range=...`
  - `GET /api/reporting/followup-stats?time_range=...`
  - `GET /api/reporting/pool-stats?time_range=...`
  - `GET /api/reporting/export?report=...&format=xlsx&time_range=...`（R-008
    导出端点，返回 `.xlsx` 文件流）
- 权限门：仅 administrator 与 shareholder+business_user（R-011）；非授权角色
  → 403。

### 3. Excel 导出（R-008…R-010）

- 服务端生成 `.xlsx`（UTF-8），文件含报表名 + 日期；内容 = 当前筛选条件下的
  聚合统计，不含联系方式明细（R-006）。
- 导出走与页面同一权限 + 服务端逻辑（R-009），不允许前端拼接数据绕过。
- 导出动作写审计（actor/报表/筛选条件/时间，不记录明细值）。
- 行数上限保护（R-010）。
- 新依赖：`openpyxl`（工程决策，实现任务内确定版本并纳入 `requirements.txt`）。

### 4. 前端页面

- `templates/reporting.html`（新建）：
  - 四类报表的 Tab 切换或分区；时间范围筛选（近 7/30/90 天、自定义起止）；
    维度筛选（客户类型/地区/来源分类）。
  - 每类报表含「导出 Excel」按钮。
  - 空结果与无权场景区分提示（R-012）。
- `templates/base.html`：导航新增「报表」入口，条件：
  `{% if user.roles and ('administrator' in user.roles or 'shareholder' in user.roles) %}`
  （R-011）。
- `src/crm/web/main.py`：新增 `/reporting` 页面路由。

### 5. 权限与脱敏

- 所有报表遵循 R-005/R-006/R-007（投影计算 + 不展示联系方式明细 + 摘要逻辑
  重新校验）。
- 导出文件同样遵守脱敏矩阵。

## Owned files

- `src/crm/application/reporting.py`（新建，报表聚合查询）
- `src/crm/web/routes/reporting.py`（新建，API 端点）
- `src/crm/web/main.py`（页面路由 `/reporting`）
- `templates/reporting.html`（新建）
- `templates/base.html`（导航「报表」入口）
- `requirements.txt`（openpyxl）
- `tests/`（新测试）

## Out of scope

- 客户金额字段实现（SPEC-0001 扩展，OD-010 挂起——本任务报表金额列标记为
  「待实现」；金额字段落地后重新激活金额合计）。
- 拖拽式 BI 自助建模/自定义图表（第一版固定报表）。
- 目标值录入与达成率（无目标管理模块）。
- 实时推送/订阅。
- 向 manager 开放报表（OD-007，默认不开放）。
- 生产部署、commit、push。

## Prerequisites and completion gate

- Prerequisites: TASK-0048 完成；产品负责人明确授权；基线 504 passed, 28 skipped。
- Completion gate：
  1. `python -m pytest tests -q` 全量绿色。
  2. `python -m compileall -q src tests` exit 0。
  3. `git diff --check` clean。
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
     `[PASS]`。
  5. 新测试覆盖：四类报表 API 返回正确聚合数、权限拒绝（business_user/manager
     → 403）、导出 Excel 文件可打开且与页面一致、不含联系方式明细。
  6. 浏览器验证：吴骐/赵/武登录后可见「报表」入口；何丹不可见。
  7. 证据文件 `docs/evidence/TASK-0050-*.md`。

## Steps

1. 报表聚合查询（reporting.py）
2. API 端点（routes/reporting.py）
3. Excel 导出（openpyxl 集成）
4. 前端页面（reporting.html + 导航入口）
5. 权限门 + 脱敏校验
6. 测试