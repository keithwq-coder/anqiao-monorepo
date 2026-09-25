# TASK-0049: AI 商机触发源分离 + 定时任务实现（SPEC-0003 v0.5.0）

- Task ID: TASK-0049
- Status: **IMPLEMENTATION (DEC-0179) -- 2026-08-27 executing**
- Task type: IMPLEMENTATION（后端业务逻辑 + 定时调度 + 配置门）
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` (v0.5.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
- Authorization: `DEC-0179`（2026-08-26，批次 TASK-0048/0049/0050 一次性授权）
- Execution owner: 待指定
- Review/acceptance owner: 待指定
- Depends on: TASK-0048（R-102 引用 SPEC-0002 v0.5.0 custodian_user_id；
  个人商机输入范围 = 归属人或管理人 = 当前用户）

## Goal

按 SPEC-0003 v0.5.0 实现：① 手动触发 `trigger=personal` 与定时触发 `trigger=crawler`
分离——不再共用同一个 `run()`；② 手动个人商机离开聚类阈值，改为基于该销售自身
客户（owner 或 custodian = 当前用户）的 AI 候选；③ 定时任务调用爬虫 → 候选
与现有客户匹配 → 人裁定；④ 原始公告 ≠ AI 商机（爬虫产出必须经关联分析才能
成为候选）；⑤ 部署现有 systemd timer 草案或整合。

## Scope

### 1. 触发源分离（R-101…R-104）

- `src/crm/application/opportunity.py`：`run()` 拆分为两个方法——
  `run_personal(user_id)` 与 `run_crawler(actor_id)`。`POST /candidates/run`
  用 `?trigger=personal|crawler` 区分，默认 `personal`。
- `run_personal(R-102)`：输入 = 当前用户的自身客户（`owner_user_id == user.id`
  或 `custodian_user_id == user.id`）；对每个客户做关联信号分析并 AI 生成候选；
  **删除** `MIN_CLUSTER_SIZE=3 / MIN_DISTINCT_OWNERS=2` 阈值（或替换为 min=1 且
  仅限本人客户）。候选不出全公司聚类。
- `run_crawler(R-103)`：运行爬虫抓取外部公告 → 落临时存储 → 与现有客户做匹配
  → 产生候选（匹配老客户 = 老客户命中；未匹配 = 新主体候选进公池）。
- R-104：`run_crawler` 产生的候选必须体现"关联对象 + 理由"，不得把原始公告
  文本直接展示为 AI 商机；爬虫抓取结果中未经 AI 分析的不入库为候选。

### 2. 定时任务（R-105…R-107）

- 审查/整合现有未跟踪的 systemd timer 草案：
  `deploy/anqiao-crm-crawl.service`（每 6 小时 oneshot）+
  `deploy/anqiao-crm-crawl.timer`（OnCalendar 00/06/12/18 UTC）+
  `scripts/crawl_opportunities.py`（当前调用 v0.4.0 混合 `run()`）。
- 改造 `scripts/crawl_opportunities.py`：调用 `run_crawler(admin_id)` 而非
  `run(admin_id)`（仅爬虫，不触发个人聚类）。
- 确认生产 systemd timer 状态（enabled? 上次执行？）并部署/启用。
- 频次/时间可配置；失败重试机制（systemd 的 OnFailure/ExecStartPre 或脚本内
  重试）；审计记录任务执行。

### 3. 配置门（R-108）

- 生产环境显式配置 `CRM_CRAWLER_ENABLED=true`、
  `CRM_CRAWLER_NETWORK_ALLOWED=true`、`CRM_AI_REASON_NETWORK_ALLOWED=true`
  方启用真实爬虫与模型。
- 未配置时系统如实降级（合成 stub），`/api/discovery/candidates/status`
  标出 degraded 与原因。

### 4. 前端适配

- `templates/discovery_list.html`：增 `trigger` 选择（个人/爬虫）或两按钮；
  状态提示区分 degraded 场景。
- 前端不再显示"原始公告原文"冒充商机。

### 5. 保留硬边界

- R-013 脱敏扫描（AI 理由落库前扫描 + 抑制）；R-014 审计（模型+外发字段名）；
  R-016 单一路径出境。
- 30 天留存（爬虫原始公告过期清理，DEC-0152）。

## Owned files

- `src/crm/application/opportunity.py`（拆分 run）
- `src/crm/web/routes/discovery.py`（trigger 参数 + 状态接口）
- `src/crm/ai/crawler.py`（适配）
- `src/crm/ai/wiring.py`（适配）
- `scripts/crawl_opportunities.py`（改造）
- `deploy/anqiao-crm-crawl.service`、`.timer`（审查/更新）
- `templates/discovery_list.html`、`discovery_detail.html`
- `tests/`（新测试 + 适应）

## Out of scope

- 报表功能（TASK-0050）、角色叠加（TASK-0048）。
- 爬虫目标站点清单决策（OD-011，工程/合规，本任务用现有 `DEFAULT_PUBLIC_SOURCES`）。
- 外部推送渠道（飞书/短信/邮件）。
- 生产部署、commit、push（完成门不含部署，但定时任务部署为任务内必需步骤）。

## Prerequisites and completion gate

- Prerequisites: TASK-0048 完成；基线 504 passed, 28 skipped；产品负责人明确授权。
- Completion gate：
  1. `python -m pytest tests -q` 全量绿色。
  2. `python -m compileall -q src tests scripts` exit 0。
  3. `git diff --check` clean。
  4. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` `[PASS]`。
  5. 新测试覆盖：`trigger=personal` 仅基于本人客户、`trigger=crawler` 仅爬虫、
     原始公告不入候选、degraded 状态接口、配置门。
  6. 生产验证：手动触发吴骐 → 有候选产出（若本人客户≥1）；crawl 脚本一次成功
     （本地或生产，degraded 也算成功——zero 候选是合法结果）。
  7. 证据文件 `docs/evidence/TASK-0049-*.md`。

## Steps

1. 拆分 `run()` → `run_personal()` + `run_crawler()`
2. 个人商机：移除聚类阈值，改为基于本人客户（owner/custodian）
3. 爬虫商机：原始公告→匹配分析→候选（R-104）
4. 改造 `scripts/crawl_opportunities.py` 调用 `run_crawler`
5. 审查/更新 `deploy/anqiao-crm-crawl.{service,timer}`
6. 配置门（环境变量 + 状态接口 degraded）
7. 前端适配（trigger 选择 + 状态提示）
8. 测试 + 生产验证