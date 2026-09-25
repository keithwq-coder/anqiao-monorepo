# Current control panel

## CEO 账号改名「吴」→「吴骐」 + 登录问题修复 (2026-08-26/27)

- [VERIFIED] **产品负责人报告「输入吴骐无法登录」→ 根因：`find_by_username`
  精确匹配，生产库 username 实为「吴」（文档亦为「吴」），输入「吴骐」401**。
- [VERIFIED] **生产库改名已执行（DEC-0178，产品负责人授权「改成吴骐」+ wiki
  用户名统一约定）**：`user_identities` username '吴'→'吴骐'、display_name
  'CEO 兼营销总监'→'吴骐'（user_id `9a4bcd51…` 不变）；备份
  `/tmp/anqiao_crm-pre-rename-wu-20260827-111210.dump`；验证：吴骐/123 →
  HTTP 200 administrator，吴/123 → HTTP 401；证据
  `docs/evidence/ACCOUNT-RENAME-WU-20260827.md`。
- [VERIFIED] **生产库账号现状盘点（产品负责人已确认）**：admin/吴骐/赵/武/
  何丹/张楠/周晶晶/王海燕/杜政隆/ceshi 共 10 个；张楠等 7 个 business_user =
  内部销售；吴骐=administrator（全权限）；赵/武=manager（老板查询/报表界面 +
  销售功能 → SPEC-0002 v0.5.0 shareholder+business_user 实现待授权）。
  sa001–sa010、何、张未在生产（与 DEC-0171/0176 建档不一致，不再追溯）。

## 产品需求变更 INBOX-0003：角色重定义 / 报表导出 / AI 商机修复 (2026-08-26)

- [VERIFIED] **产品负责人 2026-08-26 指令**录入 `INBOX-0003`，覆盖三项变更：
  ① 赵/武为股东（全局可见 + 录入客户 + 可直接分配客户）并支持双重管理
  （归属人 owner + 管理人 custodian）；② 赵/武/吴界面新增报表（全功能调研 +
  Excel 导出）；③ 修复 AI 商机（当前手动/定时均零产出，逻辑需分离：个人点击
  = 基于该销售自身客户；定时 = 招投标爬虫为主；AI 商机 ≠ 原始公告抓取）。
- [VERIFIED] **产品负责人决策**（2026-08-26 结构化确认）：赵/武 = 叠加现有角色
  （administrator + business_user）；赵/武可直接分配客户；双重管理 = 新增管理人
  字段；执行顺序 = 先排查 AI 商机根因。
- [VERIFIED] **AI 商机根因**（已定位，见 INBOX-0003 §四）：① 聚类阈值
  `MIN_CLUSTER_SIZE=3/MIN_DISTINCT_OWNERS=2` 在当前 ~122 条客户下不可达 →
  手动触发零产出；② 定时「每天自动」状态存疑——git 仓库无调度实现，但工作树
  存在**未跟踪**的 systemd timer 草案
  （`deploy/anqiao-crm-crawl.{service,timer}` + `scripts/crawl_opportunities.py`，
  2026-08-26 凌晨创建），生产是否已启用 **UNKNOWN**（该草案调用 v0.4.0 混合
  `run()`，未区分触发源）；③ 爬虫依赖 `CRM_CRAWLER_ENABLED` 环境变量，未设置则
  爬虫源整体跳过；④ 逻辑混淆：两个来源共用一个 `run()`，手动/定时无区分，
  原始公告被当作商机本体。
- [VERIFIED] **三份 SPEC 草案已生成（10-draft，均不授权实现，待 review）**：
  - `docs/specs/10-draft/SPEC-0002-role-dual-management.md`（v0.5.0：多角色叠加
    正式化 + 双重管理字段 + 股东分配能力）；
  - `docs/specs/10-draft/SPEC-0016-reporting-export.md`（报表四类：客户统计/
    销售业绩/跟进活动/公池动态 + Excel 导出，权限=administrator 含叠加赵/武）；
  - `docs/specs/10-draft/SPEC-0003-opportunity-discovery-v0.5.0.md`（触发源分离
    personal/crawler + 定时任务 + 配置门 + 原始公告≠商机）。
- [VERIFIED] **同行 CRM 报表调研**（2026-08-26 官网抓取）：销售易「分析云」
  `https://www.xiaoshouyi.com/fxy`（目标闭环/业绩拆分/榜单/漏斗/趋势）；
  纷享销客「分析平台 BI」`https://www.fxiaoke.com`（自助分析/决策执行效果）。
  系统无销售阶段/评分/金额（DEC-0025/DEC-0029），故报表不含漏斗/预测/金额。
- 状态：**三份 SPEC 已批准（DEC-0177）**；实现任务卡已草拟（TASK-0048/0049/0050，
  均为 DRAFT），**待产品负责人明确授权**（AGENTS.md §5：活动任务卡 + 单独授权）。
  执行顺序：TASK-0048（SPEC-0002 v0.5.0：角色/双重管理）→ 并行 TASK-0049
  （SPEC-0003 v0.5.0：AI 商机分离）+ TASK-0050（SPEC-0016：报表/导出）。
  TASK-0050 金额合计列为"待 SPEC-0001 扩展"标记（OD-010 挂起）。
- [VERIFIED] **关键决策已拍板（2026-08-26）**，三份草案已据此修订：
  - **OD-004**：赵/武 = **业务型股东**（新增 `shareholder` 角色，与
    `business_user` 叠加）：全可见 + 写 + 分配 + 进池/归档，**不含**账号管理/
    停用/批量导入/数据擦除（推翻最初"叠加 administrator"的粗选，因 admin
    含账号管理能力）；
  - **OD-008**：业绩报表**需要金额汇总** → 客户表新增可选金额字段（需扩展
    SPEC-0001）；
  - **OD-012**：个人商机 = **仅内部信号**（不结合外部公告），外部关联只在定时
    爬虫流程。
- [UNKNOWN] 待确认小项：OD-005（管理人变更是否需归属人同意）、OD-006（业绩
  口径默认归属人）、OD-007（报表是否向 manager 开放，默认不开放）、OD-010
  （客户金额录入/显示规则，随 SPEC-0001 扩展确定）。
- 额外修复（同日，此前问题）：前端 manager 角色误显示写操作按钮已全面按角色
  条件隐藏（`institutions_list.html`/`dashboard.html`/`institution_detail.html`
  共 9 处 + `main.py` 3 个 GET 写表单路由加后端门禁）；测试 `504 passed, 28
  skipped` 无回归。

## 新增业务人员账号「何」「张」 (2026-08-26)

- [VERIFIED] **产品负责人指令「增加2个用户名『何』和『张』，密码都一样」已执行**
  （`DEC-0176`，结构化确认：单字用户名、密码沿用统一初始密码 123、
  角色 business_user）：
  - 生产 `anqiao_crm` 新增 **何 / 张**（business_user，与何丹/sa001–sa010
    同权限：名下客户完整可见可写 + 认领公池）；granted_by=admin，reason 留痕；
  - 登录验证：何/123、张/123 → `success=True role=business_user`；
    负例 401；argon2id 校验通过；
  - 备份：`/tmp/anqiao_crm-pre-account-add-20260826-110741.dump`；
  - 证据：`docs/evidence/ACCOUNT-ADD-HE-ZHANG-20260826.md`。

## 前端补齐批次授权 (2026-08-25)

- [VERIFIED] **生产部署（2026-08-25，DEC-0175 验收后经产品负责人授权）**：
  批次 UI 已部署至 `crm.aibrain.wiki`（tencent-lighthouse /opt/anqiao-crm，
  直接文件同步 + systemd restart）：模板 10→19（新增 discovery_list/detail、
  pool_list、management_summary、admin_users/transfer/erase、
  imports_list/detail）、`main.py`、`style.css`、`base.html`、
  `institution_detail.html`；回滚点 `/tmp/anqiao-crm-frontend-pre-deploy-20260825/`。
  部署验证暴露并修复既有装配缺陷：`app.state.session_factory` 从未装配，
  事务型端点（imports/archive/correct 等）在生产 500——已在
  `setup_app_dependencies()` 挂载 `SessionLocal`（无业务规则变更，本地
  `504 passed` 无回归，commit `1f5fa9b`）。部署后实测：7 个新页面
  （/discovery /management /admin /admin/transfer /admin/erase /imports
  /pool）全部 200、health 200、admin 登录正常。
- [VERIFIED] **前端审查结论**：后端 49 条路由完整（AI 商机
  `/api/discovery/candidates*`、公池 release/claim、归档/更正/撤回、
  `/api/admin/*`、`/api/imports/batches*` 均已实现并在生产运行），但前端
  仅覆盖 business_user 主路径（登录→仪表盘→客户列表/新建/详情→加联系人/
  跟进）；`/discovery` 为 307 跳转（页面已移除）、导航仅 2 入口、
  `account_settings.html` 无入口、无任何模板引用 `/api/discovery` 或
  `/api/imports`。**前端进度显著落后于后端**（产品负责人口测结论经审查证实）。
- [VERIFIED] **批次授权 `DEC-0173`**：TASK-0043（AI 商机界面）→ TASK-0044
  （公池+客户操作）→ TASK-0045（管理摘要视图）→ TASK-0046（系统管理界面）
  → TASK-0047（批量导入界面），串行执行（共享 `base.html`/`style.css`）；
  全部为既有 approved SPEC 行为的 UI 展示层（TASK-0012 先例，无需新 SPEC）；
  执行 owner = deepseek-v4-flash-0713（reasonix 派发）；独立评审统一为
  glm-5.2（DEC-0174 变更门禁，不再要求不同模型谱系）；视觉策略 = 功能优先
  + 轻量设计升级（TASK-0043 建 CSS 变量基线）。
- 状态：**五卡全部 ACCEPTED（DEC-0175，2026-08-25 产品负责人「验收通过」）**
  （Reasonix 实际执行；独立评审 glm-5.2 PASSED——评审证据
  `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`，
  批次 verdict `APPROVE_AND_DISPATCH_NEXT_TASK`，无实质缺陷；
  评审整改包 5 条报告性文档项已全部落实；验收范围 = 本批次全部交付，
  部署/commit/push/客户编辑按 DEC-0173 仍未授权）。
  执行结果：`/discovery` 商机列表/详情/裁决 + admin run/管理视图；`/pool`
  公池列表 + 详情页 归档/释放/认领/客户类型/更正/撤回 操作（按角色条件）；
  `/management` 只读摘要（admin 全公司 / manager scope）；`/admin` 用户角色
  授予收回/停用 + 单批转移 + 数据擦除（理由+不可逆确认）；`/imports` 上传/
  批次列表/详情/撤销（仅 active 批次）；导航 8 入口（仪表盘/客户列表/商机/
  公池/管理摘要/系统管理/批量导入 + 账号设置）+ CSS 变量设计基线。
  完成门实测：全量 `504 passed, 28 skipped`（基线 457→504，新增 47 测试）、
  compileall exit 0、`git diff --check` clean、governance `[PASS]`；
  证据：`docs/evidence/TASK-0043~0047-*-20260825.md`。
  STOP-and-report：列表筛选（客户类型/地区/来源）后端无过滤参数未实现；
  公池页为既有投影的视图层过滤；停用用户无启用 UI 入口（后端仅暴露启用
  用户列表）。部署/commit/push/客户编辑功能未授权（客户编辑后端无 API，
  属单独 SPEC 问题）。

## 角色收敛：删除「总经理」角色 (2026-08-24)

- [VERIFIED] **产品负责人指令「赵/武不分配」「过去角色全部删除」已执行**（`DEC-0172`）：
  - 系统角色收敛为 **administrator / manager / business_user** 三种；
    `general_manager`（总经理）角色从枚举/约束/策略/文档中删除；
  - 点名分配/进池归并 **admin**；全公司摘要归 admin；manager 纯只读（scope）；
  - **赵（董事长）/武（董事）**：纯只读 manager（scope=苏州），无分配/操作能力；
    117 条客户补 `region='苏州'`（新客户需标 region 否则董事不可见）；
  - **吴（CEO）**：administrator；何丹/sa001–sa010：business_user；
  - 迁移 `0014_remove_general_manager_role` 已应用（生产 DB 在 0014；
    `role_grants` 约束仅含三角色、gm 行归零）；
  - 验证：赵/武/吴/admin/sa001 登录 200 且角色正确；服务 active、health 200；
  - 本地全量测试 `457 passed, 28 skipped`；
  - SPEC-0002 v0.4.1 / SPEC-0001 v0.8.1 已批准（approval.json 同步）。

## 账号体系清理与重建 (2026-08-24)

- [VERIFIED] **产品负责人指令「清理用户名和密码」已执行**（`DEC-0171`）：
  - 删除 28 个旧账号（dl0001-10、synthetic、sa1-9、wq、zhoujingjing、zxx 等；
    业务引用转交 admin、审计 actor 匿名化、会话清理，单事务）；
  - 建立 15 个登录账号：admin（系统管理员）/ 赵·武（董事长·总经理，
    general_manager）/ 吴（CEO，administrator）/ 何丹（销售）/ sa001–sa010
    （合作伙伴，business_user）；
  - 初始密码统一 123（argon2id），不强制改密可提醒；
  - 登录验证通过（admin/赵/吴/sa001 → 对应角色，中文用户名正常）；
  - 备份：`/tmp/anqiao_crm-pre-account-cleanup-20260824.dump`；
  - 证据：`docs/evidence/ACCOUNT-CLEANUP-20260824.md`。

## 正式发布到生产 (2026-08-24)

- [VERIFIED] **产品负责人「正式发布到生产」授权 + 付费真实版 AI 理由**（`DEC-0170`）：
  - 本地代码（含漂移修复）已同步至 `/opt/anqiao-crm`；生产 DB 在 `0013`（head）；
  - `ai.env` 追加 `AI_ENABLED=true`（密钥与 600 权限不变）；
  - 真实 `glm-5.2` 理由生成验证通过：`degraded=False`、379 字中文理由、
    审计 `success` 且仅含模型 ID + 出站字段名（R-014/R-016 保持）；
  - 修复两个漂移：main.py timeout 30→120（`ecee7fa`）；provider 默认 10s 超时
    被真实调用覆盖问题（`fb8a113`，`timeout_seconds=120.0`）；
  - 服务 active、`/health` 200、`pip check` clean；
  - 回滚点：`/tmp/anqiao-crm-pre-release-20260824-233412.tar.gz`、
    `/tmp/ai.env.bak-release-20260824`；
  - 证据：`docs/evidence/PRODUCTION-RELEASE-20260824.md`。

## 交接处理验收 (2026-08-24)

- [VERIFIED] **产品负责人「验收通过」**（`DEC-0168`，验收范围 = 本轮全部工作）：
  - 交接文档 `HANDOFF-20260824-GLM53-TO-REASONIX` 所列 **183 个脏工作树路径**
    （48 modified / 7 deleted / 128 untracked）已按任务卡整理为 **18 个 commit**
    （`2463d66`..`cd72d47`），工作树清零；
  - **SPEC-GOV-0001 v0.4.0** 由产品负责人「批准。授权」经 `DEC-0167` 转正至
    `30-approved`（commit `9777348`），approved SPECs 8→9；
  - 终验：`pytest` 全量 `459 passed, 28 skipped`、`compileall` exit 0、
    `check-governance.ps1` `[PASS]`（9 approved SPECs / 41 active tasks /
    1 legacy manifest）、`git diff --check` clean；
  - **未 push**（仓库无 `origin` remote）、未触碰生产、未授权新实现；
    G7/V1/R2 门与 TASK-0024/0025 reconcile 仍按各自授权待办。

## Formal acceptance update (2026-08-21)

- `TASK-0036`: ACCEPTED for local synthetic-data scope under `DEC-0155`.
- `TASK-0037`: ACCEPTED for local synthetic-data scope under `DEC-0155`.
- `TASK-0038`: PARTIAL; legacy reminder cleanup and OD-006a remain open.
- `TASK-0039`: ACCEPTED for local synthetic-data scope under `DEC-0157`.
- `TASK-0040`: **ACCEPTED** under `DEC-0161` (independent review PASSED by
  zcode/GLM-5.2; reviewer re-designated from Qwen3.8-max per `DEC-0160`); local
  isolated integration complete, real external execution / production migration
  remain unverified and separately unauthorized.
- `TASK-0040` execution owner changed to deepseek-v4-flash-0731 and the
  five-phase execution plan was landed on 2026-08-21 (`DEC-0159`; handoff
  `docs/handoffs/HANDOFF-20260821-DEEPSEEK-V4-FLASH-0731-TASK-0040.md`).
- `TASK-0041`: AUTHORIZED for **P0+P1+P2** under `DEC-0162` + `DEC-0163`
  (2026-08-23) — P0 production dependency reconciliation (`starlette`/`fastapi`
  mismatch + `python-multipart`), P1 real crawl + real LLM (`glm-5.2`, OD-006a
  selected), P2 production deployment to `crm.aibrain.wiki` (SSH push, nginx +
  HTTPS per `DEC-0041`/`SPEC-0012`); executor = this session (zcode/GLM-5.2) per
  explicit product-owner direction. P3 G7/V1/R2 acceptance remains separately
  authorized by product owner. Depends on TASK-0040 ACCEPTED (`DEC-0161`).

Last updated: 2026-08-13 (**TASK-0036/0037/0038 EXECUTED — 本地合成数据实现完成
（DeepSeek-v4-flash 执行，AWAITS DeepSeek-v4-pro 独立评审，NOT SELF-ACCEPTED）：
TASK-0036 COMPLETE（废弃 agent 角色 + admin/gm 重定义 + 自助改密回退）、
TASK-0037 COMPLETE（客户三类型 + 公池 + 术语统一「客户」）、TASK-0038 PARTIAL
（商机重定义 + 爬虫桩 + 30 天留存 + 采纳进公池 + 泄露扫描；旧 v0.3.0 基建清理与
真实爬虫/出境 OD-006a 门剩余）。任务卡自报 `375/387 passed, 28 skipped` + 全量
回归绿色；本地复核实跑 2026-08-13：全量 `395 passed, 28 skipped`（跳过项为
PostgreSQL 门控测试）、compileall exit 0、`git diff --check` exit 0、governance
`[PASS]`（8 approved SPECs / 37 active tasks）。生产迁移/部署/数据变更未授权、
未执行；无 commit/push。** DEC-0153 批准 4 份修订 SPEC（SPEC-0001 v0.8.0 /
SPEC-0002 v0.4.0 / SPEC-0003 v0.4.0 / SPEC-0014 v0.3.0），DEC-0154 授权实现；
W5 生产发布 ACCEPTED（DEC-0142）、V1 验证 + 端口收紧 ACCEPTED（DEC-0148）、
初始账号已种子（TASK-0035，待 Codex 评审）、zxx 账号已停用（DEC-0150）；迁移
0007 / agent 角色授予回退仍为未授权生产项。）

## TASK-0041 P1 real-LLM rollout (2026-08-24)

- [VERIFIED] **TASK-0041 P1 LLM PASS** — real `glm-5.2` call via the deployed
  `crm.ai.wiring.build_reason_generator()` returned
  `degraded=False`, `model_identifier=glm-5.2`, non-empty text
  (e.g. "你提供了一段招标公告的元数据..."). Three small source/config edits
  applied on `/opt/anqiao-crm`:
  (1) `web/main.py:194-197` injects `httpx.Client(timeout=120.0)` into both
      `build_reason_generator` calls (transport was missing, so `generate_reason`
      degraded before any egress);
  (2) `shared/ai.env` `AI_SHANGJI_BASE_URL` set to
      `http://129.146.135.219:3000/v1/chat/completions` (was missing the path);
  (3) `crm/ai/provider.py` request JSON adds `"stream": False` (gateway default
      is SSE; `stream:false` returns plain JSON parseable by `json.loads`).
  Backups at `/tmp/main.py.bak-0041`, `/tmp/provider.py.bak-0041`,
  `/tmp/ai.env.bak-0041`.
- [VERIFIED] **SSE-vs-plain-JSON reconciled** — fresh probe on 2026-08-24: the
  gateway returns SSE (`Content-Type: text/event-stream`, `data: {"object":
  "chat.completion.chunk",...}` followed by `[DONE]`) when `stream` is absent,
  and `application/json` plain chat-completion when `stream:false`. The
  `SseStreamingHttpClient` docstring in `provider.py` ("gateway ALWAYS streams
  regardless of stream flag") is inaccurate for this gateway profile; the
  `stream:false` plain-JSON path is the one used in production.
- [VERIFIED] **Audit truthful + leak-safe** — two new audit rows
  (`opportunity.ai_reason.outbound`, `outcome=success/failure`) carry
  `reason='{"model_identifier":"glm-5.2","outbound_field_names":["published_at",
  "title"]}'`. No key/value/body content is stored; R-014/R-016 hold.
- [VERIFIED] **Crawler still healthy** — `fetch_announcements()` returns
  **3218** non-degraded announcements from `ggzy.gov.cn` (more sources fetched
  than the prior 23; counts vary as the live page changes; `degraded=False`).
  `https://crm.aibrain.wiki/health` → HTTP 200.
- [VERIFIED] **Governance `[PASS]`** — `scripts/check-governance.ps1` →
  `8 approved SPECs / 41 active tasks / 1 legacy manifest`.
- [VERIFIED] **Key via runtime env only** — `AI_SHANGJI_API_KEY` loaded from
  `/opt/anqiao-crm/shared/ai.env` (600, ubuntu:ubuntu); running PID environ
  carries it; no repo/log/audit/evidence file holds the value. The P1 run
  consumed the in-place key per product-owner direction 2026-08-24.
- [VERIFIED] **Authorization honored** — `DEC-0162` + `DEC-0163`
  (product-owner "确认 P0+P1，provider 用 glm-5.2" 2026-08-23) + `DEC-0158`
  gate 2 (real-execution confirmation + runtime-env-only secrets).
- Evidence: `docs/evidence/TASK-0041-P1-REAL-VERIFICATION-20260824.md`,
  this session's live verification via `AiShangjiProvider(http_client=…)`
  with the patched code path; `docs/handoffs/HANDOFF-20260824-GLM52-TO-GLM53-TASK-0041.md`
  carries the prior handoff.

## Production deployment update (2026-08-24)

- [VERIFIED] **TASK-0041 P2 COMPLETE** — TASK-0040 AI-opportunity code deployed
  to `crm.aibrain.wiki`; `alembic upgrade 0013` applied (DB at
  `0013_drop_legacy_opportunity_reminders`); `anqiao-crm` restarted;
  `/health` → **HTTP 200 healthy**; homepage `/` → **HTTP 302** (login
  redirect, expected); 49 routes wired incl. new `/api/discovery/candidates*`
  AI-opportunity endpoints. Runs with `ai_enabled=False` → deterministic
  fallback reasons (product-owner "现在部署(兜底)" choice 2026-08-24).
- [VERIFIED] **Migration blocker fixed:** `0008_deprecate_agent_role` failed with
  `CheckViolation` (it tightened the `role_grants` role constraint without
  deleting the 1 legacy `agent` row — user `zxx`/张先侠, `disabled`; `agent`
  deprecated by `DEC-0149`/`DEC-0153`). Fix: `DELETE FROM role_grants WHERE role
  = :role` (bind param `agent`) before `create_check_constraint` in `0008`
  `upgrade()`. Transaction had rolled back, so prod was safely still at `0007`
  before the fix.
- [VERIFIED] **Rollback kept:** file snapshot
  `/tmp/anqiao-crm-pre-TASK0041-20260824-155409.tar.gz`; pre-migration DB dump
  `/tmp/anqiao_crm-pre-0008fix-20260824-163339.dump`.
- [VERIFIED] **P0 N/A** — production `pip check` clean (`fastapi 0.136.3` /
  `starlette 1.6.0`); the TASK-0027 fail-closed mismatch did not apply.
- [NOT VERIFIED] **P1 real `glm-5.2` reason BLOCKED** — no API key supplied;
  `config.py` `ai_enabled` validator still hard-blocks `True`. Enabling real LLM
  reason is a separate, separately-authorized step (supply key via runtime env +
  open config gate + re-run P1 per `DEC-0158` gate 2). Until then the deployed
  feature uses local deterministic fallback reasons.
- [UNKNOWN] The `0008` fix is live on production but **not committed to git**
  (untracked in working tree); commit/push only under separate authorization.
- Evidence: `docs/evidence/TASK-0041-P2-DEPLOYMENT-20260824.md`.

## Current status

### Coordinator update (2026-08-13)

- [VERIFIED] `DEC-0153` 批准 `DEC-0149` 修订的 4 份 SPEC（SPEC-0001 v0.8.0 客户
  三类型+公池、SPEC-0002 v0.4.0 废弃 agent + admin/gm 重定义、SPEC-0003 v0.4.0
  商机重定义+爬虫、SPEC-0014 v0.3.0 自助改密回退）；`DEC-0154` 授权实现，拆为
  TASK-0036/0037/0038，由 DeepSeek-v4-flash 执行（本地合成数据范围），
  DeepSeek-v4-pro 独立评审（不自批）。
- [VERIFIED] 任务卡自报状态：TASK-0036 **COMPLETE**（`375 passed, 28 skipped`；
  R-027 进池交叉引用至 TASK-0037）；TASK-0037 **COMPLETE**
  （`387 passed, 28 skipped`；`tests/test_task0037_customer_type_pool.py`
  11 用例）；TASK-0038 **PARTIAL**（核心完成：AI 候选+人裁定、爬虫桩、30 天留存、
  采纳进公池、R-013 泄露扫描、gm 脱敏只读视图；`tests/test_task0038_opportunity_candidates.py`
  8 用例；剩余：旧 v0.3.0 提醒基建/测试取代清理 + 真实爬虫/出境 OD-006a 门）。
- [VERIFIED] 本地复核实跑 2026-08-13：`pytest tests -q` → **`395 passed,
  28 skipped`**（跳过项为 PostgreSQL 门控测试）；`python -m compileall -q src
  tests migrations` → exit 0；`git diff --check` → exit 0；
  `scripts/check-governance.ps1` → **`[PASS]`**（8 approved SPECs / 37 active
  tasks）。新增迁移 `0008_deprecate_agent_role` 至 `0012_opportunity_candidates`
  （本地未应用）。
- [VERIFIED] 三任务卡均已标注 "Not verified: 生产迁移、独立评审
  （DeepSeek-v4-pro）"；生产侧 zxx 停用（DEC-0150）已完成，迁移 0007 / agent
  角色授予回退仍为未授权生产项。
- [VERIFIED] 控制文档同步：`docs/tasks/TASKS.md` Active 表 TASK-0036/0037/0038
  由「ACTIVE / NOT STARTED」更新为「EXECUTED — COMPLETE / COMPLETE / PARTIAL，
  AWAITS DeepSeek-v4-pro 独立评审」。
- **Remaining:** TASK-0036/0037/0038 独立评审（DeepSeek-v4-pro）；TASK-0038 收尾
  （旧 v0.3.0 基建清理）；生产 zxx/迁移 0007 清理授权；TASK-0035 待 Codex 评审；
  G7 正式签署 + R2 产品负责人验收。

### Coordinator update (2026-08-12)

- [VERIFIED] `DEC-0135` authorizes one sequential local-only
  **TASK-0029A/B/C** package owned by DeepSeek in PI. It may resolve/download
  public PyPI artifacts and create fresh external task-owned virtual
  environments, then prove two offline local reconstructions. It also requires
  a separately labeled Linux CPython 3.12 wheel-availability/offline-resolution
  check. It authorizes no production/SSH action, source/configuration change,
  repository dependency change, deployment, database action, service action,
  logs, credentials, commit, or push. **EXECUTED 2026-08-13 (HANDOFF-ONLY;
  parts A+B+C completed, local-only); Codex independent review is mandatory
  and the package is NOT self-accepted.** Evidence:
  `docs/evidence/TASK-0029-REPRODUCIBLE-DEPENDENCY-BUNDLE-20260812.md`,
  `docs/evidence/TASK-0029-REPRODUCIBILITY-VERIFICATION-20260812.md`,
  `docs/evidence/TASK-0029-LINUX-CP312-ARTIFACT-CHECK-20260812.md`,
  `docs/evidence/TASK-0029-DEEPSEEK-PI-EXECUTION-20260812.md`.

- [VERIFIED] **TASK-0028A/B/C** (sequential, no-log, read-only production
  dependency-audit package under `DEC-0134`) was **EXECUTED on 2026-08-12**
  by DeepSeek in PI (result `HANDOFF-ONLY`) and **awaits Codex independent
  review**. TASK-0028A: fixed-release dependency baseline — SPEC-0012 hash
  matches approval JSON; commit `59101b80b6420155bf8aec26b14ea7800979db86`
  exists locally and is HEAD; fixed `pyproject.toml` SHA-256
  `93b3f4bf…d09195`; `[VERIFIED]` the fixed release source contains **no**
  complete transitive lock and **no** wheel-hash manifest. TASK-0028B:
  strict-SSH identity `ubuntu`/`VM-0-17-ubuntu` passed; runtime inventory —
  Python 3.12.3, pip 26.1.2, systemd loaded/active/running; **`pip check`
  FAILED (exit 1, deterministic: `fastapi 0.141.0` requires
  `starlette>=0.46.0`, runtime has `starlette 0.44.0`)**; 12-name
  `importlib.metadata` inventory complete (fastapi 0.141.0, starlette 0.44.0,
  uvicorn 0.52.0, alembic 1.18.5, SQLAlchemy 2.0.51, psycopg 3.3.4, pydantic
  2.13.4, pydantic-settings 2.14.2, Jinja2 3.1.4, itsdangerous 2.2.0,
  argon2-cffi 25.1.0, **python-multipart NOT_FOUND**); production
  `pyproject.toml` SHA-256 equals the fixed-release hash (content not
  printed). TASK-0028C: difference analysis and exactly one minimum safe
  `[PROPOSAL]` (post-authorization: generate and independently verify a
  resolved lock/hash-verified wheel manifest from the fixed source in an
  isolated local environment, rebuild an isolated immutable environment,
  validate, then switch service only under a separate authorized deployment
  task; **no in-place production venv surgery proposed**). Dependency repair,
  restart, migration, deployment, and production acceptance remain unverified
  and unauthorized; W5/G7/V1/R2 remain PENDING. No log command ran; no
  production write occurred. Evidence:
  `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`,
  `docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`,
  `docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`;
  execution record:
  `docs/evidence/TASK-0028-DEEPSEEK-PI-EXECUTION-20260812.md`.

- [VERIFIED] `DEC-0134` activates the sequential, no-log, read-only
  `TASK-0028A/B/C` production dependency-audit package. It is limited to a
  fixed-release local baseline, remote Python/package metadata inventory, and
  a local remediation proposal. Package repair, venv changes, restart,
  deployment, database access, logs, credentials, and every production write
  remain unauthorized. DeepSeek in PI is the sole executor; Codex must inspect
  actual repository evidence and checks before a verdict.
- [VERIFIED] `TASK-0027` (bounded W5 production release correction under
  `DEC-0133`) was **EXECUTED on 2026-08-12** by DeepSeek in PI and **STOPPED
  `BLOCKED` at remote precondition 6 before any production mutation**: the
  runtime venv `/opt/anqiao-crm/venv/bin/python -m pip check` fails
  deterministically (`fastapi 0.141.0` requires `starlette>=0.46.0`, runtime
  has `starlette 0.44.0`; the release payload pins `fastapi==0.136.3`), a
  fail-closed precondition per the TASK-0027 handoff and DEC-0133 point 6;
  no workaround was attempted (installing/upgrading packages is prohibited).
  Local release preparation (exact commit archive
  `59101b80b6420155bf8aec26b14ea7800979db86`, SHA-256
  `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`,
  extracted-tree compile OK, Alembic head
  `0005_opportunity_reminders_ai_reasoning` only) completed; **no backup,
  transfer, migration, restart, or liveness step ran** and no production
  write occurred. Evidence:
  `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`; execution
  record: `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md`.
  Awaiting Codex independent review. W5 release execution, G7, V1, and R2
  remain PENDING and separately unauthorized.
- [VERIFIED] `TASK-0026` (W5 no-log read-only production preflight under
  `DEC-0132`) was **EXECUTED on 2026-08-12** by DeepSeek in PI (result
  `HANDOFF-ONLY`; no log command ran) and **awaits Codex independent review**.
  Evidence: `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md`;
  execution record:
  `docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md`. W5 release
  execution, G7, V1, and R2 remain PENDING and separately unauthorized; no
  mutation occurred.
- [VERIFIED] `TASK-0027` is the sole authorized W5 production release
  correction under `DEC-0133`. It is dispatch-ready for DeepSeek in PI and is
  restricted to the clean committed payload
  `59101b80b6420155bf8aec26b14ea7800979db86`, a bounded backup, the
  production migration transition `0001_initial_schema` through
  `0005_opportunity_reminders_ai_reasoning`, a loopback-only CRM listener, and
  restart of `anqiao-crm`. The dirty worktree and `0006_operation_records` are
  excluded. nginx/DNS/TLS edits, logs, credential inspection, database restore
  or downgrade, G7, full V1, and R2 remain unauthorized.
- [VERIFIED] `TASK-0018` is ACCEPTED for its explicitly authorized local
  synthetic operations-evidence scope under `DEC-0125`. Codex independently
  inspected the repository and reran focused, schema/migration, full-suite,
  health-path, diff, and governance checks. Evidence:
  `docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
- [NOT VERIFIED] This acceptance does not cover the PostgreSQL-gated migration
  round trip, remote/deployment behavior, production/shared backup and restore,
  real deletion propagation, live rollback, or product-owner visual/business
  acceptance.
- [VERIFIED] `TASK-0022` (architecture and SDD rebaseline, DOCUMENTATION /
  REVIEW) is accepted for its documentation/review scope after a bounded pass
  under `DEC-0120`/`DEC-0125`; the
  worktree was preserved. Earlier, the first DeepSeek-in-PI dispatch returned
  `402 Insufficient Balance` before repository execution and `DEC-0126`
  recorded that external provider boundary (evidence:
  `docs/evidence/TASK-0022-PI-DISPATCH-BLOCKED-20260812.md`); the completed
  pass used the configured PI selector `opencode-go/deepseek-v4-flash` from
  the handoff at
  `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.
  That selector identifies the PI gateway selection only; it does not prove or
  claim the upstream model identity, provider billing state, or a new
  decision-log authorization.
  Deliverables: architecture baseline (`docs/architecture/`), `ADR-0003`,
  review-ready `SPEC-GOV-0001` in `20-review`, and reconciled control
  documents. Independent acceptance evidence:
  `docs/evidence/TASK-0022-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
  `SPEC-GOV-0001 v0.4.0` remains `NOT APPROVED`. This update
  supersedes older TASK-0018/TASK-0022 status prose below.
- [VERIFIED] `TASK-0023` is the sole active G6 planning pass under `DEC-0127`.
  It may create only a local release-resource plan, isolation checks, rollback
  plan, and evidence contract. SSH, production inspection, W5 release,
  systemd/nginx/DNS/TLS changes, service restart, database mutation, and real
  data remain unauthorized.
- [VERIFIED] `TASK-0023` G6 plan is **ACCEPTED 2026-08-12 for its local
  documentation-planning scope only** after Codex independently inspected the
  actual plan, execution evidence, local deployment artifacts, Git state/diff,
  approved-SPEC hash, and governance checks. Evidence:
  `docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`. The pass
  performed no SSH/server/network/DNS/TLS/systemd/nginx/service/database access
  or mutation, release or restart, or credential read. W5/G7/V1/R2 remain
  PENDING and separately unauthorized; this acceptance does not open them
  (DEC-0127 point 3).
- [VERIFIED] `TASK-0024` W5 read-only production preflight was **EXECUTED on
  2026-08-12** by DeepSeek in PI under `DEC-0129` (strict non-interactive SSH
  identity + hostname matched; systemd, listeners, `/opt/anqiao-crm`
  metadata, nginx hashes/syntax/directives, public certificate metadata, DNS,
  unauthenticated health status, runtime env-file metadata/readability, and
  PostgreSQL identity/version/revision/tables/estimates in one explicit
  read-only transaction were captured) but is **NOT ACCEPTED / PARTIAL —
  BOUNDARY INCIDENT RECORDED per `DEC-0130`**: the recorded journald
  pipelines (`journalctl -o cat | wc -l`; `-o short-iso | cut …`) read and
  processed log records and message text before aggregation, exceeding the
  no-log-body boundary; only counts/timestamps are evidenced as
  printed/stored. The snapshot and execution record
  (`docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md`,
  `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md`) are preserved
  as unaccepted evidence; TASK-0025 reconciles the local record and awaits
  **Codex independent review**. No production mutation occurred. W5 release
  execution, G7, V1, and R2 remain PENDING and separately unauthorized.

The full recorded SPEC baseline is complete (baseline SPECs
SPEC-0001/0002/0003/0008/0011/0012/0013; `SPEC-0014` additionally approved under
`DEC-0111`, 8 approved SPECs total). TASK-0001 is active under DEC-0046;
S1–S3+R1 complete; S4 PARTIAL; S5 PASSED; S6 ACCEPTED (DEC-0079). TASK-0007 is
ACCEPTED (DEC-0067). TASK-0008 is fully ACCEPTED (DEC-0081 implementation;
DEC-0082 crm_test 25/25; DEC-0083 deployed to `https://crm.aibrain.wiki`).
**TASK-0012 (UI enhancement) is ACCEPTED and DEPLOYED** (coordinator audit
2026-08-05 DEC-0086; deployed to production 2026-08-05 DEC-0087; local suite
183/28/0, governance PASS, all 5 steps verified; service active, health check
passing, HTTPS accessible) — browser visual acceptance by product owner is the
only remaining gate.

TASK-0008 delivered: versioned correction/withdrawal/archive (R-031/R-036),
duplicate-suspicion prompting (R-035), audited administrator exception read
(R-015), communication-method category in concise progress (R-029), browser-side
creation forms for institution/contact/follow-up, P2 `user_status` hardcode
repair, and dedicated AC-012/R-028 tests. Local suite: `183 passed, 28 skipped`.
Gated crm_test: `25 passed, 0 failed`. Production deployment: code synced,
`alembic upgrade head` confirmed at head, `anqiao-crm` service restarted.

GR1 under DEC-0049 removed the unauthorized Tencent database schema and uploads,
rotated the dedicated database credential, and restored the database to its
recorded empty recovery state. GR2 under DEC-0050 repaired directory permissions
so the anqiao-crm service identity can read its runtime file and connect to the
database.

**Remaining open items:**

- **TASK-0001 G5** — **正式授权（DEC-0112, 2026-08-08）**。G5 门控已关闭。
  **G6** 资源计划文档已于 2026-08-12 在 DEC-0127 下准备好（
  `docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md`），待 Codex
  独立评审；W5（生产发布/systemd/nginx）仍需独立授权。
- **TASK-0019**（SPEC-0014 账号凭据自助修改）— **ACCEPTED** under `DEC-0113`
  (coordinator independent audit 2026-08-08; GLM 实现属实核验通过；302 passed,
  28 skipped, governance PASS; AC-001…AC-010 全覆盖，安全敏感项为真实行为断言。
  未验证项：真实 PostgreSQL 与浏览器视觉验收。证据：
  `docs/evidence/TASK-0019-COORDINATOR-ACCEPTANCE-20260808.md`)。
- **TASK-0020**（SPEC-0003 商机发现）— **ACCEPTED** under `DEC-0115`
  (coordinator independent audit 2026-08-08; 319 passed, 28 skipped, governance
  PASS; AC-001…AC-014 全覆盖；发现方法为本地确定性规则（同区域+同类别+跨负责人
  聚类，簇≥3、负责人≥2），零外部调用/外传，脱敏一致性与来源可追溯证明有效；
  无负责人路由主管。执行方修改了两处测试断言（AC-006/AC-009 的 404→200 脱敏
  视图），经核验对齐已批准 SPEC-0001 行为、保留 AC 语义，非削弱。OD-005/OD-006
  仍为 OPEN 单独授权门。未验证项：真实 PostgreSQL 与浏览器视觉验收。证据：
  `docs/evidence/TASK-0020-COORDINATOR-ACCEPTANCE-20260808.md`)。
- **TASK-0021**（SPEC-0003 v0.3.0 AI 生成推理）— **ACCEPTED** under `DEC-0118`
  （本地合成范围；原始实现 DeepSeek，剩余 P1-1/P2 修复由 GLM5.2/WorkBuddy
  完成；协调员独立复核 `22 passed` 聚焦、`341 passed, 28 skipped` 全量、
  governance `[PASS]`；证据
  `docs/evidence/TASK-0021-COORDINATOR-ACCEPTANCE-20260810.md`）。
  在 TASK-0020 本地确定性发现之上新增外部 AI 生成理由文本；R-012 出境口按
  `DEC-0116` 放开（完整出境），但 R-018 展示口脱敏/返回泄露扫描为硬边界不变。
  验证全程合成数据；真实数据出境是产品负责人选定 provider（OD-006a OPEN）后在
  生产亲自运行的独立下游动作，不由本任务自动触发。AC-015…AC-020 需覆盖。
- **TASK-0016** — proposed and not active. **TASK-0018** — **ACCEPTED** under
  `DEC-0125` (2026-08-12) for its explicitly authorized local synthetic
  operations-evidence scope only; evidence
  `docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
  PostgreSQL migration round trip, remote/deployment behavior,
  production/shared backup and restore, real deletion propagation, live
  rollback, and product-owner visual/business acceptance remain NOT
  VERIFIED. **TASK-0011** — **ACCEPTED**
  under `DEC-0109` (coordinator independent audit 2026-08-08).
  Real-data execution remains separately blocked.
- **Erasure scope question for the owner (F3, non-blocking)** — permanent
  erasure blanks institution and contact fields only; follow-up free text may
  still mention a person. Whether free text must be searched/scrubbed is a
  product/compliance decision (DEC-0037), recorded from the TASK-0017 audit.
- **TASK-0014** — **ACCEPTED** under `DEC-0097` (second remediation, local
  synthetic only): whitespace read-exception reasons are normalized
  (`strip() or None`) at the QueryService layer and all owned routes; the
  unapproved `administrator_reason` archive field is removed and one
  `archive_reason` serves authorization, persistence, and audit. Evidence:
  `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md`.
  **TASK-0010-search-security-verification** — **ACCEPTED** under `DEC-0101`
  (remediation of `DEC-0100` verified: management-scope tests added, matrix
  doc corrected; hidden-field existence-oracle leak closed in the searchable
  predicate; `218 passed, 28 skipped`).
  **Next successor: `TASK-0015-user-role-management`** — ACTIVATED under
  `DEC-0102` (owner GLM; handoff
  `docs/handoffs/HANDOFF-20260806-TASK-0015-USER-ROLE-MANAGEMENT.md`).
- **SPEC-0003** (opportunity discovery) — approved SPEC, no implementation.
- **S4 `crm_test` leg** — still `[UNVERIFIED — single source]` per DEC-0070.
- **P2 hardcoded `user_status`** — repaired in TASK-0008 Step 6 (was open since
  DEC-0072; now closed).
- Release, nginx/TLS/DNS, and legacy cutover remain unauthorized.

DEC-0059 recorded public debug service risk acceptance for debugging purposes
only. The CRM now runs behind nginx with HTTPS at `crm.aibrain.wiki`.

## Current adjudication (2026-08-05, post-TASK-0008 deployment)

> Historical snapshot. This block records the 2026-08-05 adjudication. Later
> decisions supersede parts of it: SPEC-0014 is now APPROVED (`DEC-0111`) and
> TASK-0019 is ACCEPTED (`DEC-0113`); TASK-0018 is accepted for its local
> synthetic scope (`DEC-0125`); TASK-0022 is the current documentation pass.

- [VERIFIED] TASK-0008 is **fully ACCEPTED**: Steps 1–6 ACCEPTED by coordinator
  2026-08-04; gated `crm_test` round PASSED 25/25 (DEC-0082, 2026-08-05); code
  deployed to `https://crm.aibrain.wiki` (DEC-0083, 2026-08-05). Evidence:
  `docs/evidence/TASK-0008-ACCEPTANCE.md`, `TASK-0008-S6-ACCEPTANCE.md`,
  `TASK-0008-CRM-TEST-VERIFICATION.md`, `TASK-0008-DEPLOY.md`.
- [VERIFIED] TASK-0007 is ACCEPTED (DEC-0067, 2026-08-02). All 6 gated
  PostgreSQL tests passed on `crm_test`; coordinator independent re-run 6/6
  confirmed.
- [VERIFIED] TASK-0001 S5 is PASSED (DEC-0074, local and synthetic only). S6 is
  ACCEPTED (DEC-0079). S4 is PARTIAL — its `crm_test` leg is
  `[UNVERIFIED — single source]` per DEC-0070. G5 is the next TASK-0001 gate
  and needs its own authorization.
- [VERIFIED] TASK-0006 is CLOSED / ACCEPTED (DEC-0066, 2026-08-02).
- [VERIFIED] TASK-0009 is coordinator-accepted under `DEC-0092`; evidence:
  `docs/evidence/TASK-0009-COORDINATOR-ACCEPTANCE-20260806.md`.
- [VERIFIED] TASK-0014 second remediation is **ACCEPTED** under `DEC-0097`
  (local synthetic scope; evidence:
  `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md`). The
  `DEC-0096` successor block is lifted for sequencing;
  `TASK-0010-search-security-verification` is **ACCEPTED** (`DEC-0101`;
  search security closed, AC-001–AC-007 verified for all actor classes).
  `TASK-0015-user-role-management` is **ACCEPTED** (`DEC-0103`; four
  capability areas verified, `244 passed, 28 skipped`). Management-scope
  semantics resolved by `DEC-0104` (assigned territory labels matched to the
  record's region value; exclusion patterns unsupported this stage);
  `SPEC-0011 OD-001` resolved by `DEC-0104` under owner delegation
  (synthetic `pg_dump`; 30-day propagation window, reversible).
  `TASK-0017-data-lifecycle-erasure` is **ACCEPTED** under `DEC-0107`
  (round-1 audit `DEC-0106` found a whitespace-reason 500 on the erase
  endpoint; remediation verified — clean 4xx before any DB work, regression
  test pins unchanged values and zero erasure rows; `258 passed,
  28 skipped`; evidence:
  `docs/evidence/TASK-0017-COORDINATOR-ACCEPTANCE-20260806.md`).
  `TASK-0011-bulk-import-capability` is ACTIVATED under `DEC-0108` (owner
  GLM; handoff `docs/handoffs/HANDOFF-20260806-TASK-0011-BULK-IMPORT.md`).
  [VERIFIED — historical 2026-08-05 snapshot] TASK-0016 and TASK-0018 then
  remained proposed. Current TASK-0018 status is the later `DEC-0121`
  DeepSeek-v4-flash in PI transfer recorded above.
- [VERIFIED] SPEC-0003 (opportunity discovery) is approved (DEC-0022) but has no
  implementation task.
- [VERIFIED] Browser visual acceptance of TASK-0008 by the product owner has
  NOT been recorded. The product owner reports the UI is unfinished: dashboard
  is an empty shell, institution pages are rough, feature entry points are not
  obvious, and the gap to a commercial product is large.
- [VERIFIED] `crm_test` is retained on the production PostgreSQL server for
  future verification rounds.
- [VERIFIED] The CRM at `https://crm.aibrain.wiki` runs TASK-0008 code behind
  nginx/HTTPS. Login: admin/admin123 (administrator), user_synthetic/user123
  (business user).

## What is true now

- [VERIFIED] This is an independent Git repository at
  `D:\Project\中科安樵\crm`.
- [VERIFIED] The repository contains governance plus the implemented
  cloud-deployed modular monolith: domain/identity model, SQLAlchemy mappings,
  Alembic migrations `0001`–`0006`, a central fail-closed server-side policy
  projection, server-side sessions/CSRF, and accepted local synthetic
  implementation tasks (TASK-0007/0008/0012/0014/0015/0017/0019/0020/0021;
  TASK-0018 accepted for its local synthetic scope under `DEC-0125`). Current
  production runtime state is NOT VERIFIED without a permitted environment
  check. Historical notes: earlier S1–S3+R1 foundation evidence and the
  2026-07-31 takeover review remain archived evidence, not current runtime
  assertions.
- [VERIFIED] Previous CRM SPEC material has been copied into
  `docs/specs/99-legacy/` and classified as untrusted reference.
- [VERIFIED] There are eight approved SPECs (`SPEC-0001/0002/0003/0008/0011/
  0012/0013/0014`) with matching approval hashes per the governance checker
  (2026-08-12). Implementation proceeds only through explicitly authorized
  tasks; TASK-0007 and TASK-0008 are ACCEPTED; TASK-0001's S5 is PASSED and
  S6 is ACCEPTED; G5 is the next TASK-0001 gate.
- [VERIFIED] W1 created only the isolated `anqiao-crm` service identity and empty
  deployment directories. W2 installed native PostgreSQL 16.14 under `DEC-0047`.  
  GR1 under `DEC-0049` removed the ten migration tables from `anqiao_crm`,
  rotated the least-privilege `anqiao_crm_app` credential, atomically replaced
  the restricted runtime file and quarantined three unauthorized CRM directories.
  GR2 under `DEC-0050` added `anqiao-crm` to the `ubuntu` group, set parent
  directories to mode `0750`, and verified the service identity can read its
  runtime file and connect to the database. Historical record: GR1 returned the
  database to its empty recovery state per the recorded baseline; DEC-0053
  authorized W4; DEC-0055 re-authorized W4; DEC-0058 recorded a one-time
  117-record import on 2026-07-30. Actual cloud database state is UNKNOWN without network access.
- [VERIFIED] S2 passed compile, dependency, offline Alembic SQL and isolated
  local PostgreSQL `upgrade -> downgrade -> upgrade` verification using only
  synthetic test state. Evidence: `docs/evidence/TASK-0001-S2-foundation.md`.
- [VERIFIED] S3 passed the role/field masking matrix with default denial,
  management scope and administrator-exception tests. The policy is server-side
  and has no browser fallback. Evidence:
  `docs/evidence/TASK-0001-S3-policy-projection.md`.
- [VERIFIED] `DEC-0011` requires the entire agreed product SPEC baseline to be
  completed and explicitly approved before any application implementation.
- [VERIFIED] `DEC-0012` limits that baseline to the internal B2B/G CRM and
  excludes C-side consumer marketing, commerce, and broader marketing execution.
- [VERIFIED] `DEC-0013` gives the general manager company-wide concise
  management visibility and other management users scoped concise visibility;
  management is read-only by default and does not bypass sensitive-data rules.
- [VERIFIED] All engineering execution will be performed by AI tools. The
  product owner will not write code, edit configuration, run engineering
  commands, or integrate model outputs.
- [VERIFIED] Progress is governed by ordered steps and evidence-based completion
  gates, not deadlines, ETAs, or a calendar timeline.
- [VERIFIED] AI selected the first engineering path as a deterministic manual
  business-record/activity-history slice, followed by a separately verified AI
  follow-up-coaching slice. Opportunity/pipeline behavior comes afterward. The
  dependency reasoning is in `docs/governance/DEVELOPMENT-SEQUENCE.md`.
- [VERIFIED] `SPEC-0001 v0.7.0` is approved under `DEC-0010` with matching
  approval metadata. Approval does not authorize application code.
- [VERIFIED] `SPEC-0002 v0.2.0` is approved under `DEC-0014` with matching
  approval metadata (users, roles, ownership transfer, and management read-only
  visibility). Approval does not authorize application code.
- [VERIFIED] `DEC-0004` confirms that the first CRM records cover
  institutions/companies and their contacts. Independent C-side individual
  customers are outside the first version.
- [VERIFIED] `DEC-0005` requires desensitized minimum-necessary internal views;
  ordinary business progress is concise only and must not be fully displayed
  by default.
- [VERIFIED] `DEC-0006` confirms role-based visibility: record owners receive
  only work-necessary details for assigned records, other business users receive
  masked summaries, and administrator full-detail access is an audited
  exception.
- [VERIFIED] `DEC-0007` makes a contact method expected but non-blocking;
  WeChat is a valid channel, and missing contactability must remain explicit
  rather than fabricated.
- [VERIFIED] `DEC-0008` adds AI coaching during follow-up editing to identify
  omissions and weak factual detail; unconfirmed AI output is not a business
  fact and cannot be silently saved.
- [VERIFIED] `DEC-0009` fixes the adaptive seven-dimension coaching checklist:
  at most three prioritized prompts per pass, with `not discussed`, `not
  applicable`, and `unknown` accepted rather than replaced by invented facts.
- [VERIFIED] `DEC-0015` requires `SPEC-0003` opportunity discovery to remain
  broad before converging on records, stages, automation, or reporting. An
  illustrative relationship example is not a fixed product rule.
- [VERIFIED] `INBOX-0002` is the active divergent discovery record for broad
  opportunity meaning. It has no SPEC or implementation authority.
- [VERIFIED] `DEC-0016` makes active opportunity discovery a CRM product
  responsibility: the system connects approved information and explains
  possible business value, while a person makes the final business judgment.
- [VERIFIED] `DEC-0017` requires a system-surfaced possibility to stay a
  distinct layer from business work a person has explicitly chosen to pursue;
  the two must not be merged into one status-flagged record.
- [VERIFIED] `DEC-0018` sets the current-stage discovery-to-work bridge:
  possibilities are surfaced as reminders with supporting reasons, with no
  formal claim/promotion step; a person acts through the existing `SPEC-0001`
  follow-up records.
- [VERIFIED] `DEC-0019` lets discovery connect approved company-wide data across
  owners to detect a possibility, while the reminder and its reasoning stay
  masked per `SPEC-0001`; protected detail still routes through the existing
  owner/administrator exception.
- [VERIFIED] `DEC-0020` sends a discovery reminder to the involved record
  owner(s), each within their own masked scope; no dispatch role and no
  automatic single-recipient selection are added now.
- [VERIFIED] `DEC-0021` resolves the `SPEC-0003` edge cases: multi-owner
  coordination is out of scope, unowned records route to the supervisor,
  ignored reminders stay as unread messages, and management gets no discovery
  view for now.
- [VERIFIED] `SPEC-0003 v0.2.0` is approved under `DEC-0022` with matching
  approval metadata. Approval does not authorize application code.
- [VERIFIED] `DEC-0023` folds manual lead intake into `SPEC-0001` (no separate
  lead object and no separate `SPEC-0004`); `SPEC-0001` already covers source,
  evidence, and duplicate warnings.
- [VERIFIED] `DEC-0024` drops automatic external lead-source collection (no
  separate `SPEC-0005`); new information comes from manual entry plus `SPEC-0003`
  discovery.
- [VERIFIED] `DEC-0025` drops the duplicate-merge feature and AI scoring (no
  separate `SPEC-0006`); dedup is the `SPEC-0001` creation-time warning and
  archive.
- [VERIFIED] `DEC-0026` drops active follow-up reminders and tasks (no separate
  `SPEC-0007`); people read the `SPEC-0001` next-action + target date. This is
  distinct from `SPEC-0003` discovery reminders.
- [VERIFIED] `DEC-0027` keeps `SPEC-0008` but narrows it to search only (no
  export, saved views deferred), obeying `SPEC-0001` masking; now approved.
- [VERIFIED] `DEC-0028` drops external integrations and outbound notifications
  (no separate `SPEC-0009`); the CRM is self-contained.
- [VERIFIED] `DEC-0029` drops separate reporting/dashboards/forecasting (no
  separate `SPEC-0010`); management concise summaries in `SPEC-0002` suffice.
- [VERIFIED] `DEC-0030` defers `SPEC-0011` (data lifecycle) and `SPEC-0012`
  (production operations) behind a hard gate: both are required before any real
  customer data or deployment, and are not applicable to the local synthetic-
  data build.
- [VERIFIED] `DEC-0031` resolves the cross-SPEC review seams (unowned-record
  reminders go to the administrator; management maps to the other-business-user
  masking level within scope).
- [VERIFIED] `SPEC-0008 v0.1.0` (search) is approved under `DEC-0032`, and
  `DEC-0033` declares the SPEC baseline complete for the local synthetic-data
  build. The `DEC-0011` freeze is lifted for this scope.
- [VERIFIED] `DEC-0034` opens a real-data tier: the product owner wants real
  养老机构 seed data plus bulk import.
- [VERIFIED] `SPEC-0011 v0.2.0` (retention, controlled erasure, backup
  propagation) is approved under `DEC-0037`, which also records that
  legal/compliance is the product owner's domain and is excluded from SPECs.
- [VERIFIED] `DEC-0038` sets bulk import as a trusted load with duplicate
  flagging and batch undo; `SPEC-0013 v0.1.0` (bulk import) is approved under
  `DEC-0039`. With `SPEC-0011` and `SPEC-0013` approved, the real-data-tier
  engineering SPECs are complete; entering real data is the owner's own decision.
- [VERIFIED] `DEC-0040` sets the deployment target to cloud with anywhere access;
  `DEC-0041` makes it concrete: the existing 腾讯云轻量 server, subdomain
  `crm.aibrain.wiki`, nginx + HTTPS, SSH deploy, as a server-side app (not a
  static site). TLS certs/key are runtime secrets kept out of the repo.
  `SPEC-0012 v0.2.0` is approved under `DEC-0042`; `OD-002` (server-side login)
  is the only open item. AI does not handle the server, credentials, or TLS key.
- [VERIFIED] All SPEC slots `SPEC-0001`–`SPEC-0013` are resolved (approved,
  folded, or dropped); the full SPEC set is complete.
- [VERIFIED] `DEC-0043` cancels local-first: the CRM is built cloud-deployed from
  the start, and the owner confirms the server runs server-side apps (evidence:
  their `health.aibrain.wiki`). `ADR-0001` is SUPERSEDED by `ADR-0002`
  (FastAPI modular monolith, Jinja2 server-rendered, central `policy` layer,
  PostgreSQL + Alembic, server-side sessions, Uvicorn behind nginx). Do not
  implement from `ADR-0001`.

## What is not decided

- [VERIFIED] `SPEC-0001 v0.7.0` approves minimum fields, AI trigger/retention
  behavior, modification rules, field-level display, and exact concise-progress
  content for its bounded first slice.
- [UNKNOWN] The model/provider and any real-data egress authorization.
- [UNKNOWN] Which statements, if any, from the old CRM material remain valid.
- [UNKNOWN] The exact upstream GitHub repository/version of the `CLAUDE.md`
  whose general principles were requested as inspiration; no external source
  is treated as authority without a verifiable URL and retrieval record.
- [UNKNOWN] Remaining workflow detail, data sources, integrations,
  security/compliance requirements, technical stack, and deployment target.

## Next human decision

> Historical note: this UI direction request predates the accepted UI work
> (`TASK-0012`, deployed 2026-08-05 `DEC-0087`) and later task acceptances.
> Current open business decisions are recorded in `docs/decisions/DECISION-LOG.md`
> (`DEC-0112` TASK-0001 G5 authorization, `DEC-0116`/`OD-006a` provider
> selection, `OD-005` retention) and in `docs/tasks/TASKS.md`.

The product owner has reviewed the deployed CRM at `https://crm.aibrain.wiki`
and reports the UI is unfinished — dashboard is an empty shell, institution
pages are rough, feature entry points are not obvious, and the gap to a
commercial product is large. The product owner requests "继续把还没做完的部分做完".

The coordinator has prepared a prioritized work plan (see below) for product-
owner direction confirmation before any code changes begin. No application
code may be edited without SPEC coverage → task card → explicit authorization.

This file does not authorize migration, release, nginx/TLS/DNS, legacy cutover
or cleanup. Real data remains separately excluded from TASK-0001.

## Drafted pending approval (2026-08-05)

> Historical snapshot. SPEC-0014 is now APPROVED (`DEC-0111`, 2026-08-08) and
> implemented under TASK-0019 (ACCEPTED, `DEC-0113`).
