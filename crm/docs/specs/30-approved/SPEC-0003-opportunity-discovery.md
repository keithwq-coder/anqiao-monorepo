# SPEC-0003: 商机发现

- Spec ID: SPEC-0003
- Version: 0.5.0
- Status: APPROVED
- Approved: DEC-0177（2026-08-26，产品负责人直接批准）
- Implemented: 2026-08-27（DEC-0179，TASK-0049；生产已部署）
- Last updated: 2026-08-27（实现后状态更新）
- Supersedes: v0.4.0（已归档 `90-deprecated/`，如本版被取代）
- 来源: INBOX-0003（2026-08-26 产品负责人指令：「ai商机系统并未生效……如果是
  个人点击，那就是应该根据这个销售自身的客户为基础，而定时的则是以抓取招投标
  项目为主，不能把ai商机=招投标项目信息抓取」）

## 0. 版本说明（本草案对 v0.4.0 的变更）

1. **触发源分离**：手动触发与定时触发运行**不同的发现流程**，不再共用同一个
   `run()`：
   - **手动触发（个人商机）**：仅基于**该销售自身客户**（`owner_user_id = 当前用户`
     或 SPEC-0002 v0.5.0 管理人 `custodian_user_id = 当前用户`）生成 AI 候选。
   - **定时触发（招投标爬虫）**：仅运行网络爬虫抓取外部公开招投标/集采公告，
     产出候选。
2. **AI 商机 ≠ 招投标信息抓取**：爬虫抓到的原始公告**不是商机**，只是输入源。
   商机是「AI 对已有客户与外部信息关联的分析结果（候选 + 理由，人裁定）」。
   定时触发的爬虫产出候选前必须与**现有客户**做关联匹配（老客户命中）或被
   判定为新主体候选；原始公告列表本身不得直接展示为「AI 商机」。
3. **修复实际不工作问题**（根因，见 §2）：
   - 移除对全公司客户聚类加 `MIN_CLUSTER_SIZE=3 / MIN_DISTINCT_OWNERS=2` 阈值的
     依赖（该阈值对当前数据量不可达，且语义不匹配"个人商机"）。
   - 新增真正的**定时任务**（见 §2：工作树存在未跟踪的 systemd timer 草案
     `deploy/anqiao-crm-crawl.{service,timer}` + `scripts/crawl_opportunities.py`
     但生产启用状态 UNKNOWN；v0.5.0 需将其整合为「定时 = 仅爬虫流程」并验证部署）。
   - 明确爬虫/模型的生产环境配置门（`CRM_CRAWLER_ENABLED` 等）。
4. 保留 v0.4.0 的所有硬边界：AI 无最终判定权（R-003）、脱敏与反推保护
  （R-009/R-010/R-013）、审计与降级（R-014…R-017）、30 天留存（DEC-0152）。

## 1. Problem

v0.4.0 把「基于现有客户」与「网络爬虫」两个信息源合并进同一个 `run()`，无论
谁触发都跑同一流程。结果是：① 手动点击时跑的是全公司聚类（阈值不可达 → 无
候选）；② 定时"每天自动"是不可验证的——git 仓库无调度实现，工作树存在未跟踪
的 systemd timer 草案（`deploy/anqiao-crm-crawl.{service,timer}` +
`scripts/crawl_opportunities.py`，2026-08-26 创建），生产是否已启用 UNKNOWN；
③ 爬虫产出被当作商机本体，混淆了「外部原始信息」与「AI 商业机会判断」。
产品负责人 2026-08-26 明确：个人点击应基于该销售自身客户；定时应以抓取招投标
项目为主；原始公告不等于 AI 商机。

## 2. Verified context

- [VERIFIED] `run()` 源码（`src/crm/application/opportunity.py:109-230`）：用一个
  方法同时处理 existing_customer（聚类）与 crawler 两个来源；手动触发与定时都会
  走同一路径。
- [VERIFIED] 聚类阈值 `MIN_CLUSTER_SIZE = 3`、`MIN_DISTINCT_OWNERS = 2`
  （`opportunity.py:30-31`），且 `_clusters()` 跳过无 region/category 的客户
  （`:414`）。当前 ~122 条客户分散，几乎无法形成 ≥3 条且 ≥2 负责人的同区同类组，
  → 手动触发基本零产出。
- [VERIFIED] 爬虫启用依赖环境变量 `CRM_CRAWLER_ENABLED in {1,true,yes}`
  （`src/crm/ai/crawler.py:389-391`）；未设置时 `build_crawler_source` 返回 None
  （`src/crm/ai/wiring.py:119-124`）→ 爬虫来源整体跳过。
- [VERIFIED] **git 仓库内无任何应用内调度**（grep cron/apscheduler/schedule/
  BackgroundTasks 无实现；`main.py` 无 lifespan 定时器）；但工作树存在**未跟踪**
  的定时任务草案：`deploy/anqiao-crm-crawl.service`（systemd oneshot，每 6 小时
  执行 `/opt/anqiao-crm/scripts/crawl_opportunities.py`）、
  `deploy/anqiao-crm-crawl.timer`（OnCalendar 00/06/12/18 UTC）、
  `scripts/crawl_opportunities.py`（CLI：加载环境 → 构建 crawler+reason
  generators → 以第一个 enabled administrator 身份跑 `service.run(admin_id)`，
  fail-closed 降级，2026-08-26 00:xx 创建）。**生产是否已部署/启用该 timer
  为 UNKNOWN**；该草案调用的是 v0.4.0 混合 `run()`，未区分 personal/crawler
  触发——与 v0.5.0 需整合改造。
- [VERIFIED] 手动触发端点 `POST /api/discovery/candidates/run` 仅面向
  business_user/administrator（`src/crm/web/routes/discovery.py:16-26`）；爬虫
  候选 recipient 为触发者本人（`opportunity.py:188`）。
- [VERIFIED] `receipt user` 概念：SPEC-0002 v0.5.0 新增 `custodian_user_id`
  （管理人）后，「该销售自身客户」应定义为「归属人 **或** 管理人 = 当前用户」。

## 3. Goal and success measure

手动触发时，销售得到基于**自己客户**的 AI 候选（例如：你名下区域/类别 A 的
客户与外部信息存在关联可能）；定时触发时，系统以爬虫抓取招投标公告为主，公告
经 AI 关联分析后才成为候选，原始公告不直接冒充商机。系统实际能产生候选（不再
零产出），且仍保持 AI 无判定权、脱敏、审计硬边界。非技术验收：何丹登录点
「生成商机」能基于她的客户产出候选；系统配置定时任务后每天自动产出爬虫候选；
列表里不会出现"一条原始公告文本"冒充商机。

## 4. Non-goals

- 不改变 v0.4.0 的落点规则（老客户命中通知负责人 / 新主体进公池待认领，R-007/
  R-008）。
- 不做销售阶段/评分/预测/漏斗（DEC-0029 维持）。
- 不做前端 UI 之外的推送渠道（飞书/短信/邮件外部写入需单独授权）。
- 不决定真实爬虫目标站点清单（工程/合规决策，实现任务内与产品负责人确认；
  本系统 `DEFAULT_PUBLIC_SOURCES` 为技术配置）。

## 5. Users and permissions

沿用 SPEC-0002 v0.5.0 权限模型（多角色叠加后含赵/武）：

| 主体 | 手动触发（个人商机） | 定时触发（招投标爬虫） | 可见 |
|---|---|---|---|
| business_user（何丹/何/张/sa001-010） | 基于本人客户 | 接收 admin 定时产出的候选 | 本人候选 + 脱敏 |
| administrator + business_user（赵/武叠加） | 基于本人客户 | 同上 | 同上 + 管理视图 |
| administrator（吴） | 基于本人客户（可空） | 可手动触发全量爬虫 / 管理定时 | 全局 |

- 手动触发路径的输入范围 = 当前用户有权完整查看的**自身客户**
  （`owner_user_id` 或 `custodian_user_id` = 当前用户）。
- 定时爬虫产出的新主体候选进入公池待认领（沿用 R-008）；老客户命中走负责人
  通知（R-007）。

## 6. Required behavior

### 6.1 触发源分离

- R-101: 提供两种触发入口，逻辑互不影响：
  - `POST /api/discovery/candidates/run?trigger=personal`（手动、个人商机）；
  - `POST /api/discovery/candidates/run?trigger=crawler`（手动触发一次爬虫，
    管理员可用）；定时任务内部调用同一爬虫流程。
  - 省略 `trigger` 时默认 `personal`（向后兼容语义，但不再隐含爬虫）。
- R-102: **个人商机（personal）**：候选输入 = 当前用户的自身客户
  （`owner_user_id == user.id` 或 `custodian_user_id == user.id`，SPEC-0002
  v0.5.0 R-030）。对每名客户的字段子集（类型/类别/地区/来源/精简进度）做
  关联信号分析并 AI 生成"候选 + 理由"；不再使用全公司聚类及
  `MIN_CLUSTER_SIZE/MIN_DISTINCT_OWNERS` 阈值（删除或降为 min=1 且仅限本人，
  工程实现确定）。
- R-103: **招投标爬虫（crawler）**：定时/手动触发爬虫抓取外部公开公告；抓取
  结果先落临时存储（30 天留存，DEC-0152），并与现有客户做匹配分析：
  - 匹配到老客户（名称/类别/地区信号）→ 生成新主体候选或老客户命中候选，
    AI 生成理由，按 R-007/R-008 落点；
  - 未匹配 → 作为新主体候选进入公池待认领。
- R-104: **原始公告 ≠ 商机**：任何 UI/API 不得把未经 AI 关联分析的原始公告文本
  直接展示为"AI 商机"；爬虫候选必须体现"关联对象 + 理由"（至少是"新主体，
  可进入公池"的判断），否则不进入候选列表（降级为纯爬虫日志，不打扰用户）。

### 6.2 定时任务

- R-105: 定时任务作为第一等能力交付并部署验证（调度方案为工程决策：
  apscheduler / systemd timer / 应用内异步循环；工作树已有未跟踪的 systemd
  timer 草案 `deploy/anqiao-crm-crawl.{service,timer}` +
  `scripts/crawl_opportunities.py`，实现任务内审查、整合改造并确认生产启用），
  默认每日抓取招投标公告；频次/时间可配置；失败自动重试或次日补跑，不堆积。
- R-106: 定时任务运行主体按系统配置（默认 administrator 视角），不依赖任何
  登录会话；审计记录任务执行（开始/结束/产出数/错误摘要）。
- R-107: 定时只在爬虫流程，不触发个人商机聚类。

### 6.3 修复与配置门

- R-108: 生产环境必须显式配置 `CRM_CRAWLER_ENABLED`（=true）与
  `CRM_CRAWLER_NETWORK_ALLOWED`、`CRM_AI_REASON_NETWORK_ALLOWED` 方启用真实爬虫
  与真实模型；未配置时系统如实降级（合成 stub）并**在状态接口标出 degraded 与
  原因**，不得表现为"已生成"。此条为部署/运维验收门（与 SPEC-0012 联动）。
- R-109: 删除/替换不可达的聚类阈值逻辑后，`run(personal)` 在至少 1 条自身客户
  存在时即可能产生候选（候选需通过 R-013 脱敏扫描才算有效）。

### 6.4 保留硬边界（v0.4.0 沿用）

- R-110: AI 只给候选 + 理由，人裁定采纳/忽略（v0.4.0 R-001/R-003）。
- R-111: 理由与候选在落库/展示前必须经 R-013 脱敏与反推扫描；含电话形态或
  他人受保护字段原文时抑制并回退本地确定性理由。
- R-112: 每条 AI 候选审计"外部模型 + 外发字段名 + 模型标识"（R-014）；抓取与
  出境集中在单一可审计路径（R-016）。

## 7. Acceptance criteria

- AC-001: 登录何丹 → 手动触发 `trigger=personal` → 基于她名下/管理的客户产出
  至少 1 条候选（若她名下客户 ≥1 且通过脱敏扫描）；不再因聚类阈值零产出。
- AC-002: 手动触发 `trigger=personal` 不触发爬虫（无外部网络出站、不产生
  crawler 候选）；`trigger=crawler` 不跑个人聚类。
- AC-003: 定时任务注册成功并可触发一次（本地可验证：手动调用调度器/或设置极短
  间隔），产出 crawler 候选；候选文本含"关联对象 + 理由"，不是原始公告原文。
- AC-004: 未配置 `CRM_CRAWLER_ENABLED` 时，状态接口如实返回 degraded + 原因，
  不表现"已生成"。
- AC-005: 爬虫候选 30 天过期清理（既有 R-019 时效不变）。
- AC-006: 全量 `pytest tests -q` 不回退（基线 504 passed, 28 skipped）；爬虫/
  真实模型相关测试维持环境门控。
- AC-007: 赵/武（SPEC-0002 v0.5.0 叠加 admin+business_user）可登录、手动触
  发个人商机与查看管理视图（联动验收）。

## 8. Risks / open questions

- OD-010: 定时任务调度技术选型（apscheduler vs systemd timer vs 应用内循环）属
  工程决策，在实现任务内确定；需与 SPEC-0012 部署运维协作。
- OD-011: 爬虫目标站点清单与频率（`DEFAULT_PUBLIC_SOURCES` 现为技术配置）是否
  需要产品负责人确认站点范围（合规/robots/反爬策略），不影响本 SPEC 的业务
  合同。
- OD-012（已决策，2026-08-26）: 个人商机 = **仅内部信号**（基于该销售自身客户
  档案，不结合外部公告）；外部招投标关联只存在于定时爬虫流程。R-102 输入范围
  维持"仅客户档案内部信号"。
- 本草案为 DRAFT：不授权实现。需 review → 30-approved（approval.json hash
  匹配）→ 活动任务卡 → 单独实现授权（AGENTS.md §5）。

## 9. References

- `docs/specs/00-inbox/INBOX-0003-role-redefinition-reporting-ai-opportunity-fix.md`
- `src/crm/application/opportunity.py`（v0.4.0 实现，核查 2026-08-26）
- `src/crm/ai/wiring.py`、`src/crm/ai/crawler.py`（核查 2026-08-26）
- `docs/decisions/DECISION-LOG.md` DEC-0149、DEC-0152（30 天留存）、DEC-0158
  （真实网络需执行时确认）。
- `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`（v0.4.0 批准版）。