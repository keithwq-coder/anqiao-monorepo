# Decision log

## DEC-0182: 授权 TASK-0051（销售可见性隔离实现）

- Date: 2026-08-27
- Type: product-owner implementation authorization
- Status: ACTIVE
- Decided by: Product owner（2026-08-27 指令「批准，授权」）
- Affects: `TASK-0051`（SPEC-0001 v0.9.0 销售可见性隔离实现）
- Supersedes: none
- Does not authorize: 生产部署、commit、push、真实数据变更

### Decision

产品负责人授权 TASK-0051：实现 SPEC-0001 v0.9.0 的销售可见性隔离——
`resolve_read_access` 中 business_user 对非本人、非公池客户记录由 COLLABORATOR
改为 PolicyDenied（拒绝）。

### Evidence

- 产品负责人 2026-08-27 指令「批准，授权」
- `docs/tasks/active/TASK-0051-sales-visibility-isolation.md`

## DEC-0181: 批准 SPEC-0001 v0.9.0（销售可见性完全隔离）

- Date: 2026-08-27
- Type: product-owner SPEC approval
- Status: ACTIVE
- Decided by: Product owner（2026-08-27 指令「批准，授权」）
- Affects: `SPEC-0001 v0.9.0`（转正至 `30-approved` + approval.json 更新）；
  v0.8.1 归档至 `90-deprecated`
- Supersedes: SPEC-0001 v0.8.1（`DEC-0153`/`DEC-0172`）
- Does not authorize: 应用实现（需实现任务卡 + 单独授权，见后续 DEC）

### Decision

产品负责人批准 `SPEC-0001 v0.9.0`（销售可见性完全隔离）：

1. business_user 仅可见本人客户（owner=本人）+ 公池客户；他人客户（含脱敏摘要）
   不可见（R-014 改写 + 新增 R-046）。
2. R-036 删除「其他业务人员只读」。

### Evidence

- 产品负责人 2026-08-27 指令「批准，授权」
- `docs/specs/30-approved/SPEC-0001-core-record-activity.md`（v0.9.0）+ approval.json
  （SHA-256 匹配）
- `docs/specs/90-deprecated/SPEC-0001-v0.8.1-core-record-activity.md`

## DEC-0180: 销售客户可见性完全隔离（business_user 仅见本人客户 + 公池）

- Date: 2026-08-27
- Type: product-owner product decision（可用性审查反馈后的可见性模型变更）
- Status: ACTIVE
- Decided by: Product owner（2026-08-27 可用性审查反馈「每个销售进去只能看到别人的客户、也不方便搜索」后拍板）
- Affects: `SPEC-0001`（R-014 语义变更）、`src/crm/policy/projection.py`
  `resolve_read_access`（business_user 对非 owner 记录由 COLLABORATOR 改为拒绝）
- Supersedes: SPEC-0001 R-014 的「其他已授权业务人员可查看脱敏摘要」语义
- Does not authorize: 应用代码实现（需 SPEC-0001 修订批准 + 实现任务单独授权）、
  公池可见性变更（R-042 保留）、shareholder 全局可见变更（赵/武叠加 shareholder 仍全局）

### Decision

产品负责人在可用性审查中指出：销售（business_user）登录后客户列表默认展示全公司
132 条脱敏混排，本人客户被淹没，且无筛选、搜索仅匹配名称。经确认，产品负责人决定：
**销售完全隔离**——business_user 仅可见「本人名下客户（owner_user_id=本人）+ 公池客户」，
不可见其他业务人员的客户（连脱敏摘要都不看）。

1. business_user 可见性 = 本人 owner 完整视图 + 公池脱敏视图；其余记录拒绝
   （`PolicyDenied`）。
2. 持有 shareholder 叠加角色的赵/武不受此隔离限制（shareholder 本身全局可见，
   见 SPEC-0002 R-008）。
3. 公池（R-042 脱敏可见 + R-043 认领）保留不变。
4. 本决策需 SPEC-0001 修订（v0.9.0 草案已起草至 `10-draft`）并经产品负责人批准后，
   方可授权实现。

### Evidence

- 产品负责人 2026-08-27 指令「销售只看我的客户+公池，完全隔离」（decision_id
  `dec-9153daba087765e1`）
- 生产实测：`张楠/123` 登录 `GET /api/institutions?limit=30` 返回 total=132，前 6 条
  owner 均为吴骐（CEO），无一条为张楠本人；`docs/review/USABILITY-REVIEW-2026-08-27.md`

## DEC-0179: 一次性授权 TASK-0048/0049/0050（SPEC-0002/0003/0016 实现批次）

- Date: 2026-08-26
- Type: product-owner implementation authorization (batch)
- Status: ACTIVE
- Decided by: Product owner（2026-08-26 指令「一次性授权」）
- Affects: `TASK-0048`（SPEC-0002 v0.5.0：shareholder + 双重管理）、
  `TASK-0049`（SPEC-0003 v0.5.0：AI 商机分离 + 定时任务）、
  `TASK-0050`（SPEC-0016 v0.1.0：报表 + Excel 导出）
- Supersedes: none
- Does not authorize: 生产部署、commit、push、真实数据变更（赵/武角色变更需
  任务内子步骤再次确认备份）、客户金额字段（SPEC-0001 扩展，OD-010 挂起）

### Decision

产品负责人 2026-08-26 一次性授权三张 SPEC-0002/0003/0016 实现任务卡：
TASK-0048 → (TASK-0049, TASK-0050) 并行。每张任务卡仍有独立完成门与证据文件。

### Evidence

- 产品负责人 2026-08-26 指令「一次性授权」
- 任务卡 `docs/tasks/active/TASK-0048-*.md`、`TASK-0049-*.md`、`TASK-0050-*.md`

## DEC-0178: CEO 账号改名「吴」→「吴骐」（wiki 用户名统一约定）

- Date: 2026-08-26（会话）；执行/验证 2026-08-27
- Type: product-owner authorization + production data change (user account rename)
- Status: ACTIVE
- Decided by: Product owner（2026-08-26 指令「改成吴骐」；wiki 约定两边用户名
  统一；结构化确认：username 与 display_name 均改）
- Affects: 生产 `user_identities`：username '吴'→'吴骐'、display_name
  'CEO 兼营销总监'→'吴骐'（user_id 不变）
- Supersedes: DEC-0171/DEC-0176 中 CEO 用户名「吴」的记录（改名后以「吴骐」为准）
- Does not authorize: 其他账号变更、赵/武角色变更（SPEC-0002 v0.5.0 待实现
  授权）、密码策略更改

### Decision

产品负责人报告「输入吴骐无法登录」。根因调查：`find_by_username` 为精确匹配，
生产库 CEO username 实为「吴」（仓库文档亦为「吴」），输入「吴骐」自然 401。
产品负责人确认 wiki 用户名统一约定后指令改名为「吴骐」。

1. `user_identities`：username='吴骐'、display_name='吴骐'（user_id
   `9a4bcd51-e784-4f2e-8d25-3e4bd3033efc` 不变 → 审计/owner/role 归属保持）。
2. 备份：`/tmp/anqiao_crm-pre-rename-wu-20260827-111210.dump`。
3. 验证：吴骐/123 → HTTP 200 administrator；吴/123 → HTTP 401。

### 附注（产品负责人确认）

生产库账号现状：admin/吴骐/赵/武/何丹/张楠/周晶晶/王海燕/杜政隆/ceshi。
张楠、周晶晶、王海燕、杜政隆、ceshi、何丹 = 内部销售；吴骐、赵、武 = 管理
（吴全权限；赵/武 = 查询/报表老板界面 + 销售功能，对应 SPEC-0002 v0.5.0
shareholder+business_user，实现待授权）。sa001–sa010、何、张未在生产（与
DEC-0171/0176 建档不一致，不再追溯）。

### Evidence

- 产品负责人 2026-08-26 指令「改成吴骐」
- `docs/evidence/ACCOUNT-RENAME-WU-20260827.md`
- 生产验证输出（200/401 登录结果，见证据文档）

## DEC-0177: 批准 SPEC-0002 v0.5.0 / SPEC-0003 v0.5.0 / SPEC-0016 v0.1.0（直接批准，跳过独立评审）

- Date: 2026-08-26
- Type: product-owner SPEC approval（三份 SPEC 同步批准并转正至 `30-approved`，
  跳过独立评审为产品负责人知情选择）
- Status: ACTIVE
- Decided by: Product owner（2026-08-26 指令「直接批准」）
- Affects: `SPEC-0002 v0.5.0`（角色叠加 + shareholder + 双重管理）、
  `SPEC-0003 v0.5.0`（AI 商机触发源分离 + 定时任务）、`SPEC-0016 v0.1.0`
  （报表 + Excel 导出）；`docs/specs/30-approved/` + approval.json；
  `90-deprecated/` 归档旧版 SPEC-0002 v0.4.1 / SPEC-0003 v0.4.0
- Supersedes: SPEC-0002 v0.4.1（`DEC-0172`）、SPEC-0003 v0.4.0（`DEC-0153`）；
  决策日志 DEC-0177 不取代其他 DEC，仅更新受影响的 SPEC 状态
- Does not authorize: 任何应用实现（AGENTS.md §5 仍需活动任务卡 + 单独授权）、
  生产数据变更、部署、客户金额字段（SPEC-0001 扩展，OD-010 挂起）、
  独立评审责任豁免（跳过为产品负责人知情选择，风险自担）

### Decision

产品负责人在 `INBOX-0003`（2026-08-26）三项需求（角色重定义 / 报表导出 / AI
商机修复）的 SPEC-first 草案完成后，选择「直接批准」：

1. **SPEC-0002 v0.5.0**：多角色叠加正式化（R-028）；新增 `shareholder` 角色
   （业务型股东 = admin 的可见/分配/进池/归档 **−** 账号管理，与 business_user
   叠加，赵/武适用；OD-004 决策）；双重管理（归属人 `owner_user_id` + 管理人
   `custodian_user_id`，R-030…R-034）；股东直接分配（R-035）与二次分配
   （R-037）。
2. **SPEC-0003 v0.5.0**：触发源分离——手动 `personal` 基于本人客户（R-102，
   OD-012 = 仅内部信号）、定时 `crawler` 以招投标爬虫为主（R-103）；新增定时
   任务（R-105…R-107，当前代码库无任何调度）；原始公告 ≠ AI 商机（R-104）；
   修复零产出根因（聚类阈值不可达、无定时、环境变量门，R-108/R-109）。
3. **SPEC-0016 v0.1.0**：四类报表（客户统计 / 销售业绩含金额合计 / 跟进活动 /
   公池动态）+ Excel 导出；入口仅 administrator 与 shareholder+business_user；
   权限/脱敏硬边界（R-005/R-006/R-009）；业绩金额汇总需客户金额字段扩展
   SPEC-0001（OD-008 决策，OD-010 挂起）。

### Evidence

- 产品负责人 2026-08-26 指令（INBOX-0003 需求 + 结构化决策 OD-004/008/012 +
  「直接批准」）
- `docs/specs/00-inbox/INBOX-0003-role-redefinition-reporting-ai-opportunity-fix.md`
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` (+approval.json)
- `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` (+approval.json)
- `docs/specs/30-approved/SPEC-0016-reporting-export.md` (+approval.json)

## DEC-0176: 新增业务人员账号「何」「张」（business_user，统一初始密码）

- Date: 2026-08-26
- Type: product-owner authorization + production data change (user accounts)
- Status: ACTIVE
- Decided by: Product owner（2026-08-26 指令「增加2个用户名『何』和『张』，
  密码都一样」；结构化确认：单字用户名、密码沿用统一初始密码 123、
  角色 business_user）
- Affects: 生产 `user_identities` / `role_grants`；新增 2 个登录账号
- Supersedes: none（承接 DEC-0171 账号体系，新增业务人员）
- Does not authorize: 其他生产变更、密码策略更改（123 为弱密码，沿用
  DEC-0171 产品负责人明确指定并接受的既有约定）

### Decision

在产品负责人 2026-08-24 账号体系（DEC-0171/DEC-0172）基础上，新增两个
业务人员账号：

1. **何** → `business_user`（销售，与何丹/sa001–sa010 同权限：名下客户完整
   可见可写 + 认领公池）。
2. **张** → `business_user`（同前）。

密码统一沿用初始密码 `123`（argon2id），不强制登录后改密（可提醒）。
用户名为单字「何」「张」（与既有「何丹」账号不发生用户名冲突）。

### Consequences

- 生产库新增 2 账号 + 2 条 `role_grants`（granted_by=admin，reason 留痕），
  单事务提交，失败回滚。
- 登录验证通过（何/张 → 200，`role=business_user`）；负例 401。
- 备份：`/tmp/anqiao_crm-pre-account-add-20260826-110741.dump`。
- 证据：`docs/evidence/ACCOUNT-ADD-HE-ZHANG-20260826.md`。

## DEC-0175: 产品负责人验收 TASK-0043~0047（前端补齐批次）

- Date: 2026-08-25
- Type: product-owner acceptance
- Status: ACTIVE
- Decided by: Product owner（2026-08-25 指令「验收通过」）
- Affects: `TASK-0043` / `TASK-0044` / `TASK-0045` / `TASK-0046` /
  `TASK-0047` 状态 → ACCEPTED；`docs/tasks/TASKS.md`、`docs/NOW.md` 对应记录
- Supersedes: none（承接 DEC-0173 批次授权 + DEC-0174 门禁变更 +
  glm-5.2 独立评审 APPROVE_AND_DISPATCH_NEXT_TASK）
- Does not authorize: 生产部署、commit、push、真实数据变更、客户编辑功能
  （仍按 DEC-0173 未授权；浏览器视觉验收与部署为另行门）

### Decision

产品负责人对 TASK-0043~0047（前端补齐批次）验收通过。五张任务卡状态
由 INDEPENDENT REVIEW PASSED → **ACCEPTED**。验收范围 = 本批次全部交付
（/discovery 商机 UI、/pool 公池+客户操作 UI、/management 管理摘要 UI、
/admin 系统管理 UI、/imports 批量导入 UI + 导航修复 + CSS 设计基线），
基于完成门全绿（504 passed, 28 skipped / compileall 0 / diff-check clean /
governance [PASS]）与 glm-5.2 独立评审 APPROVE（无实质缺陷）。

### Evidence

- 产品负责人 2026-08-25 指令「验收通过」
- 评审证据 `docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`
- 五张任务卡状态更新记录

## DEC-0174: 变更验收门禁 — TASK-0043~0047 独立评审统一由 glm-5.2 执行

- Date: 2026-08-25
- Type: product-owner acceptance-gate decision
- Status: ACTIVE
- Decided by: Product owner（2026-08-25 指令「更改门禁。统一交给同一个模型
  审核。都交给glm-5.2」）
- Affects: `TASK-0043` / `TASK-0044` / `TASK-0045` / `TASK-0046` /
  `TASK-0047` 的 review/acceptance owner；`docs/tasks/TASKS.md`、
  `docs/NOW.md` 对应记录；五张任务卡的 Review/acceptance owner 字段；
  五份执行证据文件的「独立评审」说明
- Supersedes: DEC-0173 / 任务卡 / NOW.md 中「独立评审需不同模型谱系
  （SPEC-GOV-0001）」的表述。经核实 `SPEC-GOV-0001` 文本（R-012）只要求
  评审者独立、检查实际文件并重跑指定检查，**并未硬性规定评审者与执行者
  必须属不同模型谱系**；统一由 glm-5.2 评审与该 SPEC 兼容
- Does not authorize: 修改 `SPEC-GOV-0001` 文本或 approval.json；部署、
  commit、push；放宽 R-012 的独立性要求（glm-5.2 仍须实际检查文件并重跑
  检查，verdict-only 汇报）

### Decision

1. 本批次（TASK-0043~0047）的独立评审**统一交给 glm-5.2 执行**，不再以
   「不同模型谱系」作为硬性门禁。
2. 评审方式仍按 `SPEC-GOV-0001` R-012：检查实际仓库文件、Git 状态、
   diff、证据文件并重跑指定检查，verdict-only 汇报给产品负责人。
3. 执行者（本会话）不得自我验收；评审结论由 glm-5.2 给出后，任务卡状态
   方可在协调方主持下推进至接受。

### Evidence

- 产品负责人 2026-08-25 指令（「更改门禁。统一交给同一个模型审核。都交给
  glm-5.2」）
- `SPEC-GOV-0001` v0.4.0 R-012（独立性定义，无谱系硬性条款）

## DEC-0173: 批次授权 TASK-0043~0047 — 前端补齐（既有后端能力的 UI 展示层）

- Date: 2026-08-25
- Type: product-owner implementation authorization (batch)
- Status: ACTIVE
- Decided by: Product owner（2026-08-25 对话，结构化答复：范围「全部 5 个任务」、
  授权方式「一次授权整个批次」）
- Affects: `TASK-0043` / `TASK-0044` / `TASK-0045` / `TASK-0046` / `TASK-0047`
  （新建任务卡）；`templates/`、`static/css/style.css`、`src/crm/web/main.py`
  （仅页面路由）、新增测试文件
- Supersedes: none
- Does not authorize: 新增/修改后端业务 API、策略/脱敏规则变更、SPEC 文本或
  approval.json 变更、客户编辑功能（后端无对应 API，属单独 SPEC 问题）、生产
  部署、commit、push、真实数据变更、外部调用

### Decision

产品负责人在 2026-08-25 前端审查后批次授权 5 个 UI 展示层任务：

1. **背景**：[VERIFIED] 2026-08-25 只读审查确认后端 49 条路由完整（含
   `/api/discovery/candidates*`、`/api/admin/*`、`/api/imports/batches*`、
   公池 release/claim、归档/更正/撤回），但前端仅覆盖 business_user 主路径；
   `/discovery` 为 307 跳转（页面已移除）、导航仅 2 入口、
   `account_settings.html` 无入口。前端进度显著落后于后端。
2. **批次授权**：TASK-0043（AI 商机界面）→ TASK-0044（公池+客户操作）→
   TASK-0045（管理摘要视图）→ TASK-0046（系统管理界面）→ TASK-0047（批量
   导入界面），按此顺序**串行**执行（共享 owned files：`base.html`、
   `style.css`）。每张任务卡仍有独立完成门与证据文件。
3. **性质**：全部为已批准 SPEC 既有行为的 UI 展示层（TASK-0012 先例：
   no new SPEC, no business-rule change, no policy change）。
4. **执行 owner**：deepseek-v4-flash-0713（经 reasonix 派发，提示词由协调
   方准备）；独立评审需不同模型谱系（SPEC-GOV-0001），验收前必须完成。
   > 注：本条第 4 点评审门禁已由 **DEC-0174**（2026-08-25）supersede——
   > 独立评审统一由 glm-5.2 执行，不再要求不同模型谱系。
5. **视觉策略**：功能优先 + 轻量设计升级（TASK-0043 建立 CSS 变量与统一
   组件类，后续任务复用）——工程决策（DEC-0003），不改变业务行为。

### Evidence

- 产品负责人 2026-08-25 结构化答复（范围 + 授权方式）
- 2026-08-25 前端审查结论（记录于 `docs/NOW.md`）
- 任务卡 `docs/tasks/active/TASK-0043*.md` … `TASK-0047*.md`

## DEC-0172: 删除 general_manager 角色（角色收敛为 administrator / manager / business_user）

- Date: 2026-08-24
- Type: product-owner decision + SPEC approval + production role-model change
- Status: ACTIVE
- Decided by: Product owner（2026-08-24 指令「赵/武不分配」「过去的『总经理』
  等角色全部删除，今天新设定的才是正确的」）
- Affects: `SPEC-0002 v0.4.1`（删除 general_manager）、`SPEC-0001 v0.8.1`
  （同步删除 gm 引用）；角色枚举/约束/策略/查询/路由；生产 `role_grants`
  约束（迁移 0014）；赵/武改为纯只读 manager（scope=苏州）；客户补 region
- Supersedes: `SPEC-0002 v0.4.0` 中 gm 相关规则、`SPEC-0001 v0.8.0` 中 gm
  引用（v0.8.0/v0.4.0 文本归档；approval.json 版本与 hash 同步更新）

### Decision

1. **删除 general_manager（gm）角色**：系统登录角色收敛为三种——
   `administrator` / `manager` / `business_user`。
2. **原 gm 能力归并**：
   - 点名分配（R-026）与进池（R-027）**仅属 administrator**（理由可选，
     自动留痕）；
   - 全公司脱敏摘要由 **administrator** 查看；其他管理层（manager）只能查看
     授权范围（scope）内摘要；
   - 商机管理视图仅 administrator。
3. **赵（董事长）、武（总经理→董事）**：调整为纯只读 `manager`（scope=苏州），
   无任何分配/进池/操作能力（产品负责人：「赵/武不分配」「看、了解、督办」）。
4. **吴（CEO，产品负责人本人）**：`administrator`（分配/收回/管团队）。
5. 为支持 manager 可见性，现有 **117 条客户补 `region='苏州'`**；新客户需
   标注 region（否则董事不可见）——已记入 NOW.md。
6. 武的显示名由「总经理」改为「董事」，避免与已删除角色同名残留。

### SPEC 正式批准（2026-08-24 补充）

产品负责人在 2026-08-24 纠正对话中**明确批准**以下 SPEC 修订（问询选项
「补正式批准」）：
- `SPEC-0002 v0.4.1`（删除 general_manager 角色，点名分配/进池归并
  administrator，摘要 admin company / manager scoped）；
- `SPEC-0001 v0.8.1`（同步删除 gm 引用，进池/分配/全局摘要归 admin）。

两份 SPEC 的 `approval.json` 已同步（版本、SHA-256、`approved_by:
product-owner`、evidence=DEC-0172）。

### Consequences

- 角色约束 `role IN ('business_user','administrator','manager')`；迁移
  `0014_remove_general_manager_role` 更新生产约束。
- 本地全量测试 `457 passed, 28 skipped`（删 2 个 gm 测试，改造 6 个测试文件）。
- 生产部署后验证：赵/武登录角色 `manager`（纯只读）、吴 `administrator`、
  无任何 `general_manager` 授予残留。

### Evidence

- `SPEC-0002 v0.4.1` / `SPEC-0001 v0.8.1` + 匹配 approval.json（DEC-0172）
- 产品负责人 2026-08-24 指令「赵/武不分配」「过去角色全部删除」

## DEC-0171: 账号体系清理与重建（四类用户 + 统一初始密码）

- Date: 2026-08-24
- Type: product-owner authorization + production data change (user accounts)
- Status: ACTIVE
- Decided by: Product owner（2026-08-24 指令「最后要求清理用户名和密码」；
  四类用户；初始密码统一 123；不强制登录后改密，可提醒）
- Affects: 生产 `user_identities`/`role_grants` 等；删除 28 个旧账号，
  建立 15 个目标账号
- Supersedes: 旧账号体系（dl0001-10、synthetic、sa1-9、wq、zhoujingjing、
  zxx 等）
- Does not authorize: 其他生产变更、密码策略更改（123 为弱密码，产品负责
  人明确指定并接受风险）

### Decision

按产品负责人指定的四类用户建立账号体系（用户-角色-权限三维度）：

1. **admin**（系统管理员）→ administrator。
2. **赵**（董事长）、**武**（总经理）→ general_manager（全局脱敏只读 +
   督办：点名分配、进池）。
3. **吴**（CEO 兼营销总监，产品负责人本人）→ administrator（在只读/督办
   基础上另有分配、收回/转交权限）。
4. **何丹**（公司内部销售）→ business_user。
5. **sa001–sa010**（合作伙伴）→ business_user（用户确认：合作伙伴本身
   即销售角色，不额外增减权限）。

初始密码统一 `123`（argon2id），不强制登录后修改（可提醒）。

### Consequences

- 28 个旧账号已删除（业务引用转交 admin、审计 actor 匿名化、会话清理，
  单事务，失败回滚）；15 个目标账号全部 `enabled` 且角色正确。
- 登录验证通过（admin/赵/吴/sa001 → 对应角色，含中文用户名）。
- 备份：`/tmp/anqiao_crm-pre-account-cleanup-20260824.dump`（服务器）。

### Evidence

- `docs/evidence/ACCOUNT-CLEANUP-20260824.md`
- 生产验证输出（账号/角色/密码清单见该证据文件）

## DEC-0170: 正式发布到生产 — 真实 AI（glm-5.2）理由生成启用

- Date: 2026-08-24
- Type: product-owner authorization + production release execution
- Status: ACTIVE
- Decided by: Product owner（2026-08-24 对话「正式发布到生产」「直接发布到
  服务器，不走远程仓库」；AI 理由模式选择「付费真实版」）
- Affects: 生产 `/opt/anqiao-crm`（`crm.aibrain.wiki`）；`ai.env` 追加
  `AI_ENABLED=true`；代码漂移修复提交 `ecee7fa`（timeout 120s）与 `fb8a113`
  （`build_reason_generator` 传递 `timeout_seconds=120.0`，修复 provider 默认
  10s 覆盖真实超时）
- Supersedes: none（在 `DEC-0162`/`DEC-0163` 部署基础上正式化并开启真实 LLM）
- Does not authorize: 远程仓库 push、DNS/TLS 变更、数据库 schema 变更、
  密钥轮换、后续每次真实调用的额外授权（按量计费由产品负责人知悉）

### Decision

产品负责人授权正式发布到生产并选择**付费真实版**商机推荐理由：

1. 本地代码（含漂移修复）同步至 `/opt/anqiao-crm`（src/migrations/templates/
   deploy/start.sh），生产 DB 保持在 `0013`（head，无新迁移）。
2. `shared/ai.env` 追加 `AI_ENABLED=true`（其余 6 个变量不变，含密钥；
   600 权限保持）；服务重启后运行环境含全部 AI/爬虫开关。
3. 真实 AI 理由生成启用并验证：`degraded=False`、`model_identifier=glm-5.2`、
   379 字中文推荐理由；审计行 `outcome=success` 且仅含模型 ID + 出站字段名
   （R-014/R-016 保持，无内容/密钥落库）。
4. 前 2 次验证尝试因 provider 默认 10s 超时失败，审计如实记为 `failure`
   （R-014 真实性）；根因修复（`timeout_seconds=120.0`）后 success。

### Consequences

- 生产商机候选生成现使用真实 `glm-5.2` 生成推荐理由（按量付费）；爬虫保持
  真实抓取公开招投标公告（`CRM_CRAWLER_ENABLED=true`）。
- 回滚点保留：`/tmp/anqiao-crm-pre-release-20260824-233412.tar.gz`、
  `/tmp/ai.env.bak-release-20260824`；DB 未变更。
- push、G7/V1/R2、TASK-0024 快照处置仍待产品负责人另行授权。

### Evidence

- `docs/evidence/PRODUCTION-RELEASE-20260824.md`
- 生产验证命令输出（见该证据文件第 6 步）

## DEC-0169: TASK-0024/0025 reconcile 收尾 — 记录一致、状态修正、升级产品负责人

- Date: 2026-08-24
- Type: coordinator reconcile conclusion（本地文档收尾，无远程/生产动作）
- Status: ACTIVE
- Decided by: reasonix（2026-08-24 会话，承接交接文档第 2 项）核对现有记录后
  出具结论；升级决策归产品负责人
- Affects: TASK-0024 卡（Step 6 状态）、TASK-0025 卡（状态行 + Awaiting）、
  新增 `docs/evidence/TASK-0025-RECONCILE-20260824.md`
- Supersedes: none
- Does not authorize: 任何远程访问、重复 preflight、W5 发布、G7/V1/R2、
  生产数据变更、commit 之外的仓库变更（本 DEC 仅本地文档收尾）

### Reconcile 结论

1. **边界事件事实链完整一致**：`DEC-0129` 授权边界（禁读 log-body）→ TASK-0024
   执行记录（journald 管道读取并处理日志记录/消息正文）→ `DEC-0130` 拒绝并记录
   `NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED` → TASK-0025 本地纠正
   （保留精确命令历史、纠正虚假声明、标记未接受）→ `DEC-0131` + GPT-5.6 评审
   （`ESCALATE_TO_PRODUCT_OWNER`）。6 个相关文件的措辞与命令记录相互一致。
2. **TASK-0025 本地纠正已获独立评审接受**（`DEC-0131`，评审目的）；无需新纠正。
3. **状态滞后已修正**：TASK-0025 卡（`HANDOFF-ONLY — AWAITING CODEX INDEPENDENT
   REVIEW` → `CORRECTION REVIEWED — ESCALATE_TO_PRODUCT_OWNER`）与 TASK-0024 卡
   Step 6（"awaits review" → "REVIEWED per DEC-0130 + DEC-0131"）补齐了
   `DEC-0131` 已完成评审并升级的记录。
4. **升级给产品负责人的待决业务决策**（`DEC-0131` 明示，AI 不能代替）：
   - 是否授权任何新的、单独设计的生产访问或发布路径（重复 preflight / W5）；
   - 未接受的 TASK-0024 快照（非日志观察部分）的处置（保留 / 作废 / 重跑）。
   在明确决策前，不派发任何远程访问、发布或纠正性生产任务。

### Evidence

- `docs/evidence/TASK-0025-RECONCILE-20260824.md`（reconcile 结论 + 核对检查表）
- `docs/evidence/TASK-0025-GPT56-INDEPENDENT-REVIEW-20260812.md`（`DEC-0131`）

## DEC-0168: 产品负责人验收 2026-08-24 交接处理（脏工作树按任务卡提交 + SPEC-GOV-0001 v0.4.0 转正）

- Date: 2026-08-24
- Type: product-owner acceptance (delivery acceptance, 验收通过)
- Status: ACTIVE
- Decided by: Product owner（2026-08-24 对话「验收通过」；验收范围确认
  = 本轮全部工作）
- Affects: 19 个本地 commit（`2463d66`..`9777348`，按任务卡提交的 183 个
  脏工作树路径 + SPEC-GOV-0001 v0.4.0 转正）；`DEC-0167`
- Supersedes: none
- Does not authorize: push、生产部署、应用实现、数据库/数据变更、G7/V1/R2
  门（若另有单独授权则不受影响）

### Decision

产品负责人在 2026-08-24 对话中确认「验收通过」，验收范围为**本轮全部工作**：

1. **脏工作树按任务卡提交**：交接文档所列 183 个路径（48 modified / 7
   deleted / 128 untracked）按任务卡整理为 18 个 commit
   （`2463d66`..`cd72d47`），工作树清零，pytest 全量回归
   `459 passed, 28 skipped`，`compileall` exit 0。
2. **SPEC-GOV-0001 v0.4.0 转正**：产品负责人「批准。授权」+ 范围确认后，
   由 `DEC-0167` 批准并转正至 `30-approved`（commit `9777348`），
   governance 检查 `[PASS]`，approved SPECs 8→9。

### Consequences

- 本轮交接处理视为产品负责人已验收；后续工作（push、TASK-0024/0025
  reconcile、G7/V1/R2 等）仍按各自授权推进。
- 验收记录本身不构成 push、部署或其他外部动作的授权。

### Evidence

- 产品负责人 2026-08-24 对话「验收通过」+ ask 验收范围确认「本轮全部工作」
- `git log --oneline 2463d66..9777348`（19 commits）
- `scripts/check-governance.ps1` → `[PASS]`（9 approved SPECs / 41 active tasks）

## DEC-0167: 批准 SPEC-GOV-0001 v0.4.0（跨工具调度与验收证据）并转正至 30-approved

- Date: 2026-08-24
- Type: product-owner approval (SPEC approval only)
- Status: ACTIVE
- Decided by: Product owner（2026-08-24 对话回复「批准。授权」，并在随后的
  授权范围确认中选择「SPEC-GOV-0001 v0.4.0 批准并转正至 30-approved」）
- Affects: `SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` v0.4.0
  （`20-review` → `30-approved`）；`docs/specs/INDEX.md`（approved SPECs
  8 → 9）；`docs/specs/30-approved/SPEC-GOV-0001-*.approval.json`（新增）
- Supersedes: none（SPEC-GOV-0001 首次批准）
- Does not authorize: 应用实现、生产部署、数据库/数据变更、commit/push、
  SPEC-GOV-0001 之外任何 SPEC 的修改

### Decision

产品负责人在 2026-08-24 对话中明确批准并授权 `SPEC-GOV-0001 v0.4.0`
（跨工具调度与验收证据治理 SPEC）：

1. `SPEC-GOV-0001 v0.4.0` 从 `20-review` 转正至 `30-approved`，批准依据本 DEC。
2. SPEC 正文状态更新为 `APPROVED`（`- Status: APPROVED`），第 11 节 Open
   decisions 与第 14 节 Approval 同步改写为批准记录，不再含 `NOT APPROVED`
   占位。
3. 生成匹配的 `.approval.json`，`spec_sha256` =
   `b9101b8d962c4ef6cff9f514407e6bbdb425b39f21b95fe8fb9b4257a813fbb4`
   （等于当前正文文件 SHA-256，governance hash 校验通过）。
4. 按 SPEC-0014 转正先例，移除 stale 的 `10-draft` 存根副本；`docs/specs/INDEX.md`
   的 Approved / In review / Drafts 表同步更新。

本批准为治理 SPEC 批准（`AGENTS.md` §2/§5）：它把既有 verdict-only
跨工具调度与验收协议固化为已批准规范，**不授权**任何应用代码实现或生产动作。

### Consequences

- `30-approved/` 下 approved SPECs 由 8 份增至 9 份（governance 检查口径）。
- 跨工具调度、执行、独立验收的证据与裁定协议（R-001~R-033、AC-001~AC-016）
  成为已批准治理规范，后续任务按此执行。
- push、远程配置、TASK-0024/0025 reconcile 未在本 DEC 授权范围内（产品负责
  人在授权范围确认中未选择）。

### Evidence

- `docs/specs/30-approved/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.approval.json`
- 产品负责人 2026-08-24 对话「批准。授权」+ ask 选择「SPEC-GOV-0001 v0.4.0
  批准并转正至 30-approved」

## DEC-0166: TASK-0001 G6 PASS carry-forward + TASK-0027 STALE; W5 readiness verified without new production mutation

- Date: 2026-08-24
- Type: independent reviewer verdict + readiness check (zcode / GLM-5.2,
  this session) — no behavior change; evidence-only
- Status: ACTIVE
- Decided by: this session (zcode / GLM-5.2) acting as substitute
  independent reviewer at product-owner direction ("我签收 / 我手全 /
  我授权 / 你评审 / 我验收")
- Affects: TASK-0001 G6 gate (carry forward Codex/GPT-5.6 PASS from
  2026-08-12); TASK-0027 dispatch (closed as STALE on its own merits; the
  fail-closed `pip check` precondition it recorded is no longer true);
  W5 production rebuild-and-switch (no further action under this DEC;
  any new production mutation requires a separate authorization)

### Decision

1. **TASK-0001 G6 carry-forward**: the G6 release-resource plan
   (`docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md`) is
   re-affirmed PASS. The original Codex/GPT-5.6 acceptance file
   (`docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`)
   recorded the same checks; the 2026-08-24 re-run still passes:
   - `Get-FileHash SPEC-0012 v0.2.0` equals `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`.
   - `scripts/check-governance.ps1` → `[PASS]` (8 approved SPECs, 41 active tasks).
   - `git diff --check` → clean.
   - `deploy/anqiao-crm.service`, `deploy/nginx_crm.conf`, `deploy/start.sh`,
     `deploy/.env` content unchanged from the recorded description.

2. **TASK-0027 STALE**: the original TASK-0027 dispatch was bound to the
   fail-closed prod `pip check` precondition (fastapi 0.141.0 vs starlette
   0.44.0). The 2026-08-24 prod re-check shows `pip check` exits "No broken
   requirements found" with `fastapi 0.136.3` / `starlette 1.6.0`. The
   precondition no longer exists; the dispatch is closed as STALE.
   The rebuild-and-switch path it proposed is **not** auto-promoted.

3. **W5 readiness verified**: prod service `active`, `/health` 200,
   alembic head at `0013_drop_legacy_opportunity_reminders`, env file
   carries the `CRM_AI_REASON_*` canonical names, real `glm-5.2` call works
   end-to-end, audit row carries `model_identifier + outbound_field_names`
   only. **No new production mutation is authorized by this DEC.**

### Does NOT change

- G7 (formal acceptance), V1 (full runtime verification), R2
  (product-owner business/visual acceptance) — still product-owner gates,
  not AI delegated.
- The original TASK-0027 evidence file (preserved unchanged for traceability).
- Any future production action beyond what was already done in TASK-0041
  P0/P1/P2 + TASK-0042.

### Evidence

- `docs/evidence/STEP5-G6-W5-READINESS-20260824.md`

## DEC-0165: Independent review batch — carry forward / re-verify TASK-0028/0029/0035/0036/0037/0038 (2026-08-24)

- Date: 2026-08-24
- Type: independent reviewer verdict (zcode / GLM-5.2, this session) — no
  product-owner authorization requested; no behavior change; evidence-only
- Status: ACTIVE
- Decided by: this session (zcode / GLM-5.2) acting as substitute independent
  reviewer at product-owner direction ("我签收。我手全。我授权。你解决。")
- Affects: TASK-0028A/B/C, TASK-0029, TASK-0029A/B/C, TASK-0035, TASK-0036,
  TASK-0037, TASK-0038 carry-forward verdicts; TASK-0027 marked STALE;
  TASK-0024/0025 still pending their own review reconcile

### Decision

The independent review batch re-runs the verifiable local checks on each of
the eight pending review slots:

- `python -m pytest tests/ -q` → 459 passed, 28 skipped (28 PostgreSQL-gated)
- `python -m compileall -q src tests migrations` → exit 0
- `git diff --check` → clean
- `scripts/check-governance.ps1` → `[PASS]` (8 approved SPECs, 41 active
  tasks, 1 legacy manifest)
- SPEC approval hashes for SPEC-0001/0002/0003/0012/0014 verified to match
  their `approval.json` SHA-256 records.

Carries forward the original independent reviewer verdicts:

- **PASS (carry forward)** — TASK-0029 (Codex 2026-08-13), TASK-0028A/B/C,
  TASK-0035 (Codex 2026-08-13), TASK-0036 (Codex 2026-08-21), TASK-0037
  (Codex 2026-08-21), TASK-0038 (Codex 2026-08-21, partial-slice).
- **STALE on its own merits / needs fresh product-owner authorization** —
  TASK-0027 (the prod `pip check` precondition that BLOCKED its dispatch is
  no longer true; the original TASK-0027 dispatch is bound to the stale
  precondition and is not auto-promoted; the rebuild-and-switch path it
  proposed is moved to TASK-0001 W5 with new authorization).
- **Pending reconcile** — TASK-0024 / TASK-0025 (boundary incident recorded
  per DEC-0130; out of this session's scope).

### Evidence

- `docs/evidence/STEP3-INDEPENDENT-REVIEW-BATCH-20260824.md`

### Does NOT change

- The original Codex / GPT-5.6 / DeepSeek-v4-pro verdicts for the covered
  tasks — this batch re-affirms them, not replaces them.
- The TASK-0038 PARTIAL → COMPLETE transition (depends on Step 4 v0.3.0
  cleanup + the OD-006a leg, the latter now closed by TASK-0041 P1).
- W5 production rebuild-and-switch authorization (Step 5; new DEC required).

## DEC-0164: Authorize TASK-0042 — rename `AI_SHANGJI_*` / `AiShangjiProvider` to unified `CRM_AI_REASON_*` / `AiReasonProvider` (with legacy env fallback)

- Date: 2026-08-24
- Type: product-owner implementation authorization (naming cleanup, no behavior change)
- Status: ACTIVE
- Decided by: Product owner (in-conversation: "同意你的推荐")
- Affects: `TASK-0042`; implementation layer of `SPEC-0003 v0.4.0` (provider
  adapter); no SPEC text change, no `approval.json` SHA re-stamp
- Execution owner: this session (zcode / GLM-5.2)
- Does NOT authorize: SPEC text change, approval-hash re-stamp, production env
  rename, commit, push, behavior change, production access

### Decision

The product owner authorizes **`TASK-0042`** to clean up the legacy
`AI_SHANGJI_*` / `AiShangjiProvider` naming pollution introduced during the
TASK-0040 implementation cycle, with two concrete choices:

1. **Unified mapping**: rename the public class to `AiReasonProvider` and the
   environment-variable strings to `CRM_AI_REASON_*` (`CRM_AI_REASON_BASE_URL`,
   `CRM_AI_REASON_MODEL`, `CRM_AI_REASON_API_KEY`, plus the network-allowed
   flag `CRM_AI_REASON_NETWORK_ALLOWED` and the legacy-wire-api fallback
   `CRM_AI_REASON_WIRE_API`). The `CRM_` prefix matches the existing
   `CRM_AI_SHANGJI_NETWORK_ALLOWED` convention and the semantic
   "AI_REASON" matches the SPEC-0003 v0.4.0 responsibility (reason-text
   generation for opportunity discovery).
2. **Legacy fallback (Option A)**: keep reading the old strings
   `AI_SHANGJI_BASE_URL` / `AI_SHANGJI_MODEL` / `AI_SHANGJI_API_KEY` /
   `AI_SHANGJI_WIRE_API` as a fallback when the new strings are unset, so the
   currently-deployed TASK-0041 P2 service (running with `ai_enabled=False`
   deterministic fallback per `DEC-0163`) is not broken by this rename. The
   legacy strings are marked in docstrings as "legacy, scheduled for removal"
   so the next env-rotation cycle uses the new names.

The change is **naming-only**; the public behavior of the adapter
(env-configured, fail-closed, leak-scanned, deterministic-fallback) is
unchanged. `SPEC-0003 v0.4.0` text is not modified, its
`approval.json` SHA-256 stays `8845fbefb89e72195c044232dca4bb67ddec8867eb1b0e4fa402985ee0b95ba1`,
and the governance approval-hash gate remains `[PASS]`.

### Scope

Six files, eighty tokens, all in the implementation layer (no docs/decision
pollution — verified by repo-wide grep before authorization):

- `src/crm/ai/provider.py` — class rename + four `ENV_*` constant string
  changes + `_read_runtime_config` legacy fallback + two docstring/comments.
- `src/crm/ai/wiring.py` — import + `ENV_AI_REASON_NETWORK_ALLOWED` constant
  value + one call site.
- `src/crm/config.py` — one inline comment in `allow_enabled_ai` validator.
- `tests/test_task0040_fixes.py`, `tests/test_task0040_external_integration.py`,
  `tests/test_task0040_service_integration.py` — import, `monkeypatch.delenv`
  names, `model="aishangji-*"` fixture strings, one module/class docstring.

### Out of scope (this authorization)

- Any change to `SPEC-0003 v0.4.0` text or its approval-hash.
- Any change to the deployed TASK-0041 service contract beyond env-variable
  names; the fallback ensures no immediate break.
- Production env rotation, commit, push, deployment, restart, migration,
  audit-record content.
- Out-of-scope cleanup of unrelated naming (no expansion to other tokens).

### Completion gate

- `pytest tests -q` green.
- `python -m compileall -q src tests migrations` exit 0.
- `git diff --check` clean.
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
  `[PASS]`.
- Evidence file written under `docs/evidence/TASK-0042-NAMING-CLEANUP-20260824.md`
  recording before/after token counts and the legacy-fallback matrix.
- No commit, no push.

## DEC-0163: Expand TASK-0041 to P0+P1+P2; executor = this session; update spec/dec per product-owner direction

- Date: 2026-08-23
- Type: product-owner implementation + deployment authorization (amendment to DEC-0162)
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0041`; `SPEC-0003 v0.4.0`; `SPEC-0012 v0.2.0`
- OD-006a provider: `glm-5.2` (Zhipu AI), selected by product owner

### Decision

The product owner authorizes expansion of `TASK-0041` (roll TASK-0040's accepted
local integration to production) to include **P2 — production deployment**
(`crm.aibrain.wiki`, SSH push, nginx + HTTPS per `DEC-0041` / `SPEC-0012`):

- **Execution order: A (P1 real public-site crawl + real LLM `glm-5.2`) first,
  then B (P2 production deployment).** P0 (production dependency reconciliation)
  is executed as the hard prerequisite immediately before B; skipping P0 risks
  the TASK-0027 fail-closed (`fastapi 0.141.0` + `starlette 0.44.0` mismatch,
  `python-multipart` missing).
- **Execution owner changed to this session (zcode / GLM-5.2)** per explicit
  product-owner direction 2026-08-23 ("授权你部署" + "修改spec/dec文件"),
  superseding the earlier `reasonix` assignment in DEC-0162. Orchestrator
  executes per this direct authorization.
- Product owner explicitly requires the **SPEC / DEC files be updated** to reflect
  this authorization and execution.
- glm-5.2 key supplied by product owner via runtime environment variable only;
  never written to repo / log / audit / doc (AGENTS.md §8; SPEC-0012 R-003/R-011).
- P3 (G7/V1/R2 acceptance) remains separately authorized by the product owner;
  not delegated to AI.
- No commit / push unless separately authorized.
- Non-behavioral execution-status annotation added to `SPEC-0003` / `SPEC-0012`
  (HTML comment, behavior unchanged); their `approval.json` `spec_sha256`
  re-stamped to the new content hash (SPEC-0003
  `8845fbef…0b95ba1`, SPEC-0012 `7364b4bf…7e7bec400`) so the governance
  approval-hash gate stays `[PASS]`. This is an owner-authorized annotation, not
  a SPEC behavior change.

### Relationship to DEC-0162

DEC-0162 authorized P0+P1 only. This decision adds P2 and reassigns the executor
to the current session. DEC-0162's P0/P1 scope remains in force.

## DEC-0162: Authorize TASK-0041 (TASK-0040 production rollout), batch P0 + P1

- Date: 2026-08-23
- Type: product-owner implementation authorization
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0041` (TASK-0040 production rollout); `SPEC-0003 v0.4.0`, `SPEC-0012 v0.2.0`
- OD-006a provider: `glm-5.2` (Zhipu AI), per product-owner instruction

### Decision

The product owner authorizes `TASK-0041` (roll TASK-0040's accepted local
integration to production) for batch **P0 + P1** only:

- **P0 — production dependency reconciliation**: repair the verified
  `starlette`/`fastapi` mismatch (`fastapi 0.141.0` requires
  `starlette>=0.46.0`, runtime has `starlette 0.44.0`) and add the missing
  `python-multipart`. Rebuild a reproducible dependency set in an isolated
  environment and switch the service to it — **no in-place venv surgery**
  (per TASK-0028C proposal). No business-data or schema migration.
- **P1 — real external execution**: real public-site crawl + real LLM reason
  generation using provider **`glm-5.2`** (Zhipu AI). Requires OD-006a provider
  selected by the product owner (glm-5.2), secrets supplied only via runtime
  environment variables, and immediate product-owner confirmation at each
  execution point (DEC-0158 gate 2). Results pass R-013 leak scan and audit
  before persistence. Does not touch the production service or database.

**P2 (production deployment) and P3 (G7/V1/R2 acceptance) are NOT authorized**
in this decision and remain separately authorized after P0 is verified.

### Evidence

- Product-owner confirmation on 2026-08-23: "确认 P0+P1，provider 用 glm-5.2".
- Precedent authorization model: `DEC-0158`/`DEC-0159` (TASK-0040); production
  gates W5/G7/V1/R2 remain separately gated.
- Draft: `docs/evidence/TASK-0041-PRODUCTION-ROLLOUT-DRAFT-zcode-glm52-20260823.md`.

### Boundaries

- No commit, push, or production write unless separately authorized.
- P0 must complete and be verified before any P2 deployment is considered.
- Real LLM calls (P1) require immediate product-owner confirmation at execution
  time and runtime-env-only secrets (no key in repo/log/audit).
- Secrets zero on disk; audit records model identifier + outbound field names
  only.
- The `glm-5.2` provider selection is the external model for P1; it does not
  change task execution/reviewer ownership.

## DEC-0161: TASK-0040 review-owner change to zcode/GLM-5.2 and formal acceptance

- Date: 2026-08-23
- Type: product-owner review-ownership decision and formal task acceptance
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0040` review/acceptance ownership and task status

### Decision

The product owner changes the TASK-0040 independent-review owner from
**Qwen3.8-max** (`DEC-0160`) to **zcode / GLM-5.2** (Zhipu AI), and formally
accepts `TASK-0040`, flipping its status from `PARTIAL` to `ACCEPTED`. The
product owner re-designates GLM-5.2 to perform the final independent review that
`DEC-0160` had assigned to Qwen3.8-max, superseding that reviewer assignment.

### Evidence

- Product-owner closure decision on 2026-08-23: selected the "正式收尾" option,
  confirming the GLM-5.2 reviewer re-designation and accepting the independent
  review conclusion.
- Independent review: `docs/evidence/TASK-0040-ZCODE-GLM52-INDEPENDENT-REVIEW-zcode-glm52-20260823.md`
  — conclusion **PASSED**; 10 review points `[VERIFIED]`; rerun `103 passed`
  (focused) + `459 passed, 28 skipped` (full); `compileall` exit 0;
  `git diff --check` exit 0; governance `[PASS]`; `SPEC-0003 v0.4.0` approval
  hash match. Reviewer performed no real calls and stored no secrets.
- Execution owner remains `deepseek-v4-flash-0731` (`DEC-0159`); this decision
  does not change execution ownership.

### Boundaries

- `DEC-0158`/`DEC-0159` boundaries remain in force: no production deployment,
  production migration, real-data mutation, customer creation, external writes,
  commit, or push.
- Real external execution (real LLM call, real site crawl) and production
  deployment/migration remain **unverified and separately unauthorized**; this
  acceptance does not open them.
- The independent review verdict was produced by GLM-5.2 (Zhipu AI), a different
  model lineage from the `deepseek-v4-flash-0731` executor, so reviewer/executor
  independence holds. This entry records the product-owner decision; it is not a
  self-acceptance by the reviewer.

## DEC-0160: TASK-0040 review-owner change to Qwen3.8-max

- Date: 2026-08-22
- Type: product-owner review-ownership decision
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0040` review/acceptance ownership only

### Decision

The product owner changes the TASK-0040 independent-review owner from Codex
to **Qwen3.8-max** ("改由你Qwen3.8-max评审" / "改由你评审"). Qwen3.8-max is
also the session model under which deepseek-v4-flash-0731 executed TASK-0040;
the product owner was informed that reviewer and executor therefore share a
model lineage and accepted the reduced independence.

### Evidence

- Product-owner instruction in the current task conversation on 2026-08-22:
  `改由你Qwen3.8-max评审`，`改由你评审`.

### Boundaries

- This decision changes the review owner only. All `DEC-0158`/`DEC-0159`
  boundaries remain in force: no production deployment, production migration,
  real-data mutation, customer creation, external writes, commit, or push.
- The review verdict must cite repository evidence actually re-run or
  re-inspected by the reviewer (AGENTS.md section 3), and must state the
  reviewer/executor lineage overlap so independence is not overstated.

## DEC-0159: TASK-0040 execution-owner change and execution-plan landing

- Date: 2026-08-21
- Type: product-owner execution-ownership decision and planning record
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0040` execution ownership and the landed execution plan
- Execution owner (TASK-0040): deepseek-v4-flash-0731
- Review/acceptance owner (TASK-0040): Codex independent review (unchanged)

### Decision

The product owner instructs that `TASK-0040` be executed by
deepseek-v4-flash-0731 (replacing Codex as execution owner) and that the
five-phase execution plan be landed in the repository for a new
deepseek-v4-flash session to execute.

### Evidence

- Product-owner instructions in the planning conversation on 2026-08-21:
  `改用deepseek-v4-flash-0731来执行`；`落盘计划。我新开会话用deepseek-v4-flash执行。`
- Landed artifacts: the execution-plan section in
  `docs/tasks/active/TASK-0040-opportunity-external-integration.md`, the
  updated `docs/tasks/TASKS.md` row, and the handoff
  `docs/handoffs/HANDOFF-20260821-DEEPSEEK-V4-FLASH-0731-TASK-0040.md`.

### Boundaries

All `DEC-0158` boundaries remain in force: no production deployment,
production migration, real-data mutation, customer creation, external writes,
commit, or push; real external requests require immediate product-owner
confirmation at execution time; the previously exposed DeepSeek API key must
be rotated before real calls; local implementation does not require env
secrets.

## DEC-0158: Resolve SPEC-0003 OD-006a and authorize isolated integration task

- Date: 2026-08-21
- Type: product-owner decision and implementation authorization
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003 v0.4.0`, follow-up `TASK-0040`
- Execution owner: Codex

### Decision

The product owner approves the following resolution of `OD-006a` and
authorizes creation and execution of `TASK-0040`:

1. External model: use the product-owner-supplied DeepSeek endpoint and model
   through runtime environment variables. Credentials must never be stored in
   the repository, evidence, logs, or audit records.
2. Crawler scope: public tender, procurement, and public procurement-announcement
   sources only. No authenticated, private, customer, or contact-data sources.
3. Outbound whitelist: announcement title, announcement body or abstract only
   when required for classification, source URL, publication timestamp,
   announcement type, and non-sensitive technical metadata required for audit.
4. Forbidden outbound data: customer names, phone numbers, contact details,
   follow-up bodies, CRM notes, raw customer evidence, credentials, and any
   protected field not explicitly whitelisted.
5. Runtime scope: first execution is an isolated local environment using
   synthetic or controlled fixtures. Real external requests require an
   immediate pre-call confirmation because they may incur provider cost or
   cross-border egress.
6. Safety behavior: leak scan before display, audit model identifier and field
   names only, timeout/error degradation to a local deterministic reason, and
   human adjudication before any customer creation or pool adoption.

### Boundaries

- This decision authorizes the task and its local implementation work only.
- It does not authorize production deployment, production migration, real-data
  mutation, customer creation, external writes, commit, or push.
- No API key or secret is recorded here. The previously exposed key must be
  rotated before use.

### Evidence

- Product-owner confirmation in the current task conversation: `批准`.
- Approved contract: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`.

## DEC-0157: TASK-0039 formal acceptance

- Date: 2026-08-21
- Type: product-owner acceptance decision
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0039` status only
- Evidence: `docs/evidence/TASK-0039-CODEX-IMPLEMENTATION-20260821.md`

### Decision

`TASK-0039` is formally **ACCEPTED** for its local synthetic-data scope.
The superseded v0.3.0 reminder runtime and storage were removed, and the
v0.4.0 candidate flow remains the sole opportunity runtime path.

### Boundaries

No production migration, real-data mutation, real crawler, external model
call, cross-border egress, commit, push, or deployment was authorized or run.

## DEC-0156: TASK-0039 authorization for legacy reminder cleanup

- Date: 2026-08-21
- Type: product-owner implementation authorization
- Status: ACTIVE
- Decided by: Product owner
- Affects: legacy v0.3.0 opportunity reminder infrastructure only
- Approved SPEC: `SPEC-0003 v0.4.0`
- Task: `TASK-0039`

### Decision

The product owner authorizes local synthetic-data cleanup of the superseded
v0.3.0 reminder flow: remove its runtime service, repository/model, routes,
template surface, and obsolete tests; add a forward migration that removes the
legacy table from newly upgraded databases; and preserve the v0.4.0 candidate
flow (`OpportunityService`, candidate model/repository, adjudication, leak
scan, and management view).

### Boundaries

- No real crawler, external model call, cross-border egress, production
  migration, production data mutation, commit, push, or deployment.
- Historical migration files remain immutable; cleanup uses a new forward
  migration.

## DEC-0155: TASK-0036 / TASK-0037 formal acceptance and TASK-0038 partial disposition

- Date: 2026-08-21
- Type: product-owner acceptance decision
- Status: ACTIVE
- Decided by: Product owner
- Independent reviewer: Codex, substituting for DeepSeek-v4-pro at the product owner's request
- Affects: `TASK-0036`, `TASK-0037`, and `TASK-0038` task status only
- Evidence: `docs/evidence/TASK-0036-CODEX-INDEPENDENT-REVIEW-20260821.md`,
  `docs/evidence/TASK-0037-CODEX-INDEPENDENT-REVIEW-20260821.md`,
  `docs/evidence/TASK-0038-CODEX-INDEPENDENT-REVIEW-20260821.md`

### Decision

1. `TASK-0036` is formally **ACCEPTED** for the local synthetic-data scope.
2. `TASK-0037` is formally **ACCEPTED** for the local synthetic-data scope.
3. `TASK-0038` is formally recorded as **PARTIAL**, not complete. Legacy
   reminder cleanup requires separately authorized work; real crawler/model
   provider and cross-border egress remain blocked by unresolved `OD-006a`.

### Boundaries

- This decision authorizes no production migration, production cleanup,
  real-data mutation, external model call, crawler egress, commit, push, or deployment.
- Task files remain under `docs/tasks/active/` for path stability; their status
  fields are the formal state for this decision.

## DEC-0001: Initialize a clean governed repository

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: repository governance and SPEC migration
- Supersedes: none in this repository

### Decision

Initialize the empty `crm` directory as a new cross-tool governance workspace.
Migrate the existing SPEC material from the sibling `CRM 系统` directory only
as reference. The old SPEC is confused and must not be trusted or used as an
implementation authority.

### Consequences

- The new repository begins with zero approved business SPECs.
- Old material is isolated under `docs/specs/99-legacy/` with hashes and an
  audit note.
- Product and technical claims must be revalidated through the new SDD flow.
- AI tools share repository files rather than relying on chat/model memory.

### Still unknown

The actual product scope, business rules, technical stack, and first SPEC.

## DEC-0002: AI-only execution and completion-based planning

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: all planning, implementation, verification, and cross-tool handoffs
- Supersedes: any assumption that the user will perform engineering work or
  that delivery is managed by deadline/timeline

### Decision

All code and engineering work in this project will be completed by AI tools.
The product owner will not write any code and will not act as a command runner,
debugger, configuration editor, release engineer, or integrator between model
outputs.

The project has no deadline, ETA, duration commitment, or calendar timeline.
Work proceeds through ordered steps. Each step advances only after its
prerequisites are satisfied and its verification/completion gate passes.

### Human role

The product owner provides business intent, resolves material product choices,
authorizes SPECs and sensitive actions, and performs final business or visual
acceptance when human judgment is required.

### AI role

AI tools own implementation, tests, debugging, documentation, environment
operations, evidence, reviews, and handoffs. When a real-world action can only
be performed by the user's identity or physical access, AI must request the
smallest possible human action after completing all accessible work.

### Consequences

- Plans are expressed through prerequisites, outputs, verification, and
  completion gates rather than dates or effort estimates.
- An incomplete or blocked step cannot advance merely because time passed.
- AI-to-AI coordination is recorded in repository tasks and handoffs; it is not
  delegated to the product owner.
- Audit timestamps remain allowed because they document evidence rather than
  promise delivery.

## DEC-0003: AI owns development sequencing

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: discovery, architecture proposals, task decomposition, and all
  engineering order decisions
- Supersedes: `INBOX-0001` asking the product owner to choose A/B/C as the first
  module

### Decision

The product owner is not expected to decide which CRM module comes first based
on programming dependencies. AI must analyze and choose the engineering order
using shared-data dependencies, smallest verifiable vertical slices, risk
isolation, reversibility, and downstream prerequisites.

The product owner is asked only for business facts or approvals that AI cannot
observe or safely infer. A technical sequence proposal is not a business
approval and does not authorize code.

### Consequences

- `INBOX-0001` becomes an AI analysis record rather than a user choice among
  modules.
- AI records the proposed sequence and its dependency reasoning in
  `docs/governance/DEVELOPMENT-SEQUENCE.md`.
- The first draft SPEC may be created by AI with explicit unknowns; it remains
  unapproved until the product owner confirms its business meaning.
- The product owner is never asked to choose a framework, schema, API, model,
  or module order merely because those choices are technical.

## DEC-0004: First CRM records cover organizations and their contacts

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0001` business-object scope
- Supersedes: the unresolved `SPEC-0001` decision `OD-001`

### Decision

For the first CRM slice, the primary tracked record represents an institution
or company. Contact people belong to an institution/company record rather than
being independent first-class C-side customer records.

Independent individual consumers are outside the first version. Adding them
later requires a separate SPEC decision covering their workflow, privacy, and
relationship to organization records.

### Decision evidence

The product owner replied `同意` on 2026-07-26 to the explicit recommendation:
start with institutions/companies and their contacts, and exclude independent
C-side individual customers from the first version.

This decision confirms one business boundary only. It does not approve
`SPEC-0001` and does not authorize implementation.

### Consequences

- `SPEC-0001` can replace the generic trackable-object wording with
  institution/company and subordinate contact records.
- The first slice does not need an independent consumer profile or consumer
  privacy workflow.
- User roles, visibility, editing rights, correction/deletion behavior, and
  minimum data remain unresolved.

## DEC-0005: Internal views are desensitized and progress is summarized

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0001` visibility, display, and progress-summary behavior
- Supersedes: the recommendation in `docs/NOW.md` for full shared visibility

### Decision

CRM internal collaboration must follow minimum-necessary display. A user must
not automatically see all fields or all raw business details merely because the
user is inside the organization. Shared views must be desensitized according to
an approved display purpose.

Business progress must be shown only as a concise summary in ordinary views;
the full underlying progress detail must not be displayed by default.

### Decision evidence

The product owner stated: `但要脱敏，不要全部展示，包括业务进度也只能是精简的`.
This records the display principle, not the exact masking fields or privileged
role policy.

### Remaining detail after DEC-0006

- role boundaries and exceptional-access auditing are resolved by `DEC-0006`;
- which fields are sensitive and how each field is masked, omitted, or grouped;
- what the concise progress summary may contain;
- whether exceptional access also requires explicit approval in addition to
  the audit record required by `DEC-0006`.

This decision does not approve `SPEC-0001` and does not authorize
implementation.

## DEC-0006: Role-based detail access with audited administrator exception

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0001` role visibility and exceptional-access auditing
- Supersedes: the unresolved role portion of `SPEC-0001` decision `OD-002`

### Decision

The record owner may view the unmasked contact details and detailed follow-up
information necessary to perform work on records assigned to that owner. This
does not grant the owner unrestricted access to every field or every record.

Other authorized business users see only desensitized institution/contact
information and a concise business-progress summary.

An administrator may access full details only as a necessary exception. Every
such access must create an audit record identifying the administrator, target
record, access time, and stated reason.

### Decision evidence

The product owner replied `同意` to this exact recommended role boundary on
2026-07-26.

### Consequences

- Ordinary collaboration never requires universal full-detail visibility.
- Ownership controls operational detail access; administrator access is an
  audited exception rather than the default.
- Search, export, and API results must enforce the same role boundary as the
  visible page.
- The exact stored fields, field-level masking map, and concise progress
  content remain unresolved.

This decision does not approve `SPEC-0001` and does not authorize
implementation.

## DEC-0007: Contact method is expected but not a save blocker

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0001` minimum contact information and validation behavior
- Supersedes: the proposal that every contact must have a stored contact method

### Decision

A usable contact method is expected in principle and should be collected when
available. WeChat is a valid contact channel when a usable WeChat identifier or
other recordable contact reference is actually available.

Some contacts cannot provide a storable contact method. The CRM must allow the
contact to be recorded without inventing a phone number, email address, WeChat
identifier, or other detail. The absence must remain explicit so it can be
followed up later.

### Decision evidence

The product owner stated: `考虑到有些只有微信，所以不一定可以留下联系方式，但原则上是需要的`.

### Consequences

- A contact method is recommended, not an unconditional required field.
- The absence of a storable contact reference is recorded explicitly rather
  than filled with fabricated data.
- Exact follow-up prompts and missing-reason categories remain draft details.

This decision does not approve `SPEC-0001` and does not authorize
implementation.

## DEC-0008: AI coaches salespeople while they write follow-up records

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0001` follow-up-entry workflow and AI-assistance boundary
- Supersedes: treating all AI behavior as outside the first follow-up workflow

### Decision

During follow-up entry, AI may analyze the salesperson's draft within the
editing session and act as a real-time coach. Its purpose is to notice
important missing details, ambiguity, or weak factual description and to
suggest questions or improvements that help the salesperson complete a
high-quality follow-up record. The exact response-time target remains a later
technical quality decision.

### Hallucination boundary

AI output is advisory and is not a business fact. It must not invent customer
statements, decisions, contact details, commitments, progress, or next actions;
it must not silently insert content into the saved record. A salesperson must
confirm any accepted addition or correction.

The manual record path remains the source of truth. Model/provider selection,
external data transfer, suggestion retention, and whether a coaching check is
mandatory before save remain unresolved.

### Decision evidence

The product owner stated that AI can be used during follow-up and should act
like a coach that analyzes the salesperson's input in real time and identifies
important details the salesperson may have omitted.

### Consequences

- The deterministic manual record path is implemented and verified before the
  AI coaching sub-slice.
- AI unavailability or an invalid suggestion must not be represented as a
  successful factual analysis.
- AI receives only the minimum context allowed by the same record permissions
  and desensitization rules.
- Exact coaching dimensions and data-egress authorization remain open.

This decision does not approve `SPEC-0001` and does not authorize
implementation.

## DEC-0009: AI determines the follow-up coaching quality checklist

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner, with checklist determination delegated to AI
- Determined by: Codex / GPT-5 under the product owner's explicit delegation
- Affects: `SPEC-0001` AI follow-up coaching quality contract
- Supersedes: the unresolved checklist portion of `SPEC-0001` decision `OD-006`

### Decision

AI follow-up coaching checks seven dimensions when relevant to the current
interaction:

1. objective interaction facts: what happened, when, through which channel,
   and who participated;
2. the customer's stated need, problem, or desired outcome, kept distinct from
   the salesperson's interpretation;
3. known decision participants, roles, influence, and material unknowns;
4. objections, constraints, risks, or conditions raised during the interaction;
5. commitments made by the customer and by the salesperson's side;
6. the next action, responsible party, and target time only when discussed or
   applicable;
7. uncertain claims, missing evidence, or facts that still require verification.

This is an adaptive quality check, not a form-completion quota. A dimension may
be marked `not discussed`, `not applicable`, or `unknown`. AI must not pressure
the salesperson to invent content merely to fill the checklist.

For each coaching pass, AI presents no more than three highest-value questions
or suggestions, ordered by their likely effect on factual clarity and the next
follow-up. It does not produce a sales score, declare the record true, or block
manual factual saving.

### Decision evidence

After AI presented the recommended seven-dimension checklist and asked whether
to fix it as `OD-006`, the product owner replied `这个你把关`, explicitly
delegating this determination to AI.

### Consequences

- The checklist portion of `OD-006` is resolved.
- Coaching output can be tested against stable quality dimensions without
  treating model output as evidence.
- Relevance and uncertainty remain valid outcomes; completeness is not inferred
  from the absence of another AI question.
- Trigger timing, response-time target, suggestion retention, model/provider,
  and external data authorization remain separate unresolved boundaries.

This decision does not approve `SPEC-0001` and does not authorize
implementation.

## DEC-0010: Approve SPEC-0001 version 0.7.0

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0001 v0.7.0` lifecycle and business authority
- Supersedes: the review-only status of `SPEC-0001 v0.7.0`

### Decision

The product owner explicitly approved `SPEC-0001 v0.7.0` in full. The approved
document becomes the current authority for the first organization/contact and
follow-up-history slice, including its minimum data, role visibility,
correction/audit behavior, AI coaching boundaries, acceptance criteria, and
safety limitations.

### Decision evidence

The product owner stated: `批准 SPEC-0001 v0.7.0`.

### Authorization boundary

This is SPEC approval only. It does not authorize an implementation task,
application-code edits, real-data use, external model transfer, shared or
production deployment, paid services, or any external side effect.

### Consequences

- The SPEC moves from `20-review` to `30-approved`.
- Matching approval metadata must store the final approved file SHA-256.
- AI may now prepare architecture decisions and a bounded implementation task
  proposal, but code remains blocked until the product owner explicitly
  authorizes that named task.

## DEC-0011: Complete the full agreed SPEC baseline before implementation

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: the project SDD gate, all implementation tasks, and SPEC planning
- Supersedes: any interpretation that approval of `SPEC-0001` allows the first
  implementation task to start

### Decision

No application implementation begins after only the first approved SPEC. AI
must first identify the complete agreed product boundary, prepare every SPEC
needed for that boundary, resolve behavior-changing unknowns, obtain explicit
approval for each SPEC, and complete a cross-SPEC consistency review.

The product owner must then explicitly approve the full SPEC baseline as
complete. Until that decision is recorded, all implementation tasks remain
inactive regardless of whether an individual SPEC is approved.

### Decision evidence

The product owner stated: `我的要求是先把所有的spec都完成。`

### Consequences

- `TASK-0001` remains a future candidate and cannot be authorized yet.
- `ADR-0001` remains a reversible proposal for later implementation; it does
  not constrain unfinished product SPECs.
- `docs/specs/SPEC-BASELINE.md` becomes the control record for completeness.
- Legacy files may reveal candidate topics only and cannot populate behavior
  without revalidation.
- The immediate work is product-scope confirmation and SPEC drafting/review,
  not application architecture or coding.

## DEC-0012: Limit the complete baseline to the internal B2B/G CRM

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `docs/specs/SPEC-BASELINE.md` and all remaining SPEC discovery
- Supersedes: the unresolved product-boundary question in the baseline

### Decision

The complete SPEC baseline covers the internal B2B/G CRM: organizations,
contacts, leads, opportunities, follow-up, internal collaboration, reminders,
search/export, reporting, governed external sources/integrations where later
approved, data lifecycle, and production operation.

It excludes C-side consumer marketing, e-commerce, consumer content/traffic
operations, referral commerce, and the broader marketing-strategy execution
system. A later expansion requires a new SPEC-baseline decision.

### Decision evidence

The product owner stated: `同意内部 B2B/G CRM 范围`.

### Consequences

- The boundary itself is now confirmed; individual candidate capabilities are
  still unapproved until their SPECs are reviewed and approved.
- The sibling marketing-strategy discussion may provide background questions
  about B2B/G relationships, but it remains untrusted for detailed behavior.
- C-side marketing and commerce requirements must not be inserted into the CRM
  SPECs by implication.

## DEC-0013: Management receives scoped read-only business visibility

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0002` management visibility and access boundaries
- Supersedes: the proposed business-supervisor role in `SPEC-0002 v0.1.0`

### Decision

The CRM includes management viewing roles. The general manager may view
company-wide management summaries and concise business progress. Other
management users may view the same type of information only within their
explicitly authorized management scope.

Management visibility is read-only by default. It does not grant customer
reassignment, record modification, account administration, or unrestricted
access to contact values, customer quotations, raw follow-up text, or evidence.
When sensitive detail is genuinely necessary, the existing reason-and-audit
exception process applies.

### Decision evidence

The product owner requested `设置总经理等管理层查看` and explicitly replied
`同意` to the clarified boundary above.

### Consequences

- `SPEC-0002` distinguishes general-manager company scope from other
  management users' authorized scope.
- Management role and system administrator remain separate concepts.
- Customer reassignment remains an administrator operation unless a later
  approved SPEC explicitly changes it.
- Management summaries must continue to obey `SPEC-0001` desensitization and
  concise-progress rules.

## DEC-0014: Approve SPEC-0002 version 0.2.0

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0002 v0.2.0` lifecycle and business authority
- Supersedes: the review-only status of `SPEC-0002 v0.2.0`

### Decision

The product owner explicitly approved `SPEC-0002 v0.2.0` in full. It becomes
the current authority for internal user identity, account states, role and
scope assignment, ownership transfer, management read-only visibility, and
permission/audit behavior.

### Decision evidence

The product owner stated: `批准。spec-0003，我在新对话中开始。`

### Authorization boundary

This is SPEC approval only. It does not authorize implementation, real
accounts, an identity-provider connection, external writes, deployment, or
production operations. The complete baseline remains incomplete.

### Consequences

- The SPEC moves from `20-review` to `30-approved`.
- Matching approval metadata must bind the final approved file SHA-256.
- The next discussion may start `SPEC-0003` for opportunity/pipeline meaning,
  but it cannot activate application implementation.

## DEC-0015: Keep opportunity discovery broad before defining pipeline behavior

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` discovery and the meaning of business opportunity
- Supersedes: the initial proposal to define one opportunity primarily as one
  identifiable potential deal attached to one organization

### Decision

Opportunity discovery must not begin from the assumption that an opportunity is
only one known customer's explicit purchasing need or one conventional deal in
a sales funnel.

Information about organizations, contacts, relationships, channels, regions,
projects, cases, products, resources, policies, capabilities, or timing may
combine to reveal business possibilities that were not previously visible.
The product owner's distributor/group-company example is an inspiration that
opens this reasoning boundary; it is not itself a fixed opportunity type,
automatic-creation rule, stage model, or complete requirement.

Discovery must remain divergent before it converges on records, stages,
validation, ownership, automation, or reporting. AI must not convert an
illustrative example into approved detailed behavior without a later explicit
decision.

### Decision evidence

After correcting the AI's premature conversion of the example into a narrow
relationship-derived opportunity model, the product owner stated `同意。继续`
on 2026-07-26.

### Consequences

- `SPEC-0003` discovery starts from the possible sources and forms of business
  value rather than the untrusted legacy 11-stage funnel.
- A possibility may involve one or more organizations, relationships, regions,
  channels, projects, cases, or other context; no mandatory shape is approved
  yet.
- Facts, interpretations, and possible opportunities must remain distinguishable
  so exploration does not become fabricated customer intent.
- Stage count, automatic discovery, record creation, scoring, forecasting,
  ownership conflicts, and closure rules remain unresolved.
- This decision does not approve a SPEC or authorize implementation.

## DEC-0016: CRM actively reveals business possibilities for human judgment

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` product responsibility and opportunity-discovery boundary
- Supersedes: leaving active opportunity discovery outside the CRM or treating
  the CRM only as a register of opportunities already recognized by people

### Decision

The CRM must do more than store opportunities that a person has already
identified. It must actively connect information available within its approved
scope and reveal business possibilities that users may not otherwise notice.

The system presents a possibility together with the information and reasoning
that support it. A person makes the business judgment about whether and how to
pursue it. A system-found possibility is not customer intent, confirmed demand,
an approved commitment, or a forecast merely because the system surfaced it.

This decision establishes a product responsibility, not a particular discovery
method. It does not choose AI, rules, graph analysis, scoring, external data,
automatic record creation, or any provider.

### Decision evidence

The AI presented three product-responsibility options and recommended option 1:
the CRM actively connects existing information, reveals new business
possibilities with supporting reasons, and leaves final business judgment to a
person. The product owner replied `ok` and then `继续` on 2026-07-26.

### Consequences

- Active opportunity discovery is in scope for the internal B2B/G CRM baseline.
- Discovery must preserve the boundary between source facts, system reasoning,
  uncertainty, and human decisions.
- Users must be able to understand why a possibility was surfaced; unexplained
  output cannot be presented as a confirmed opportunity.
- The discovery function may connect only information the current user and the
  approved processing context are allowed to use.
- The product still needs a separate decision about how a surfaced possibility
  becomes sustained business work without polluting the managed pipeline.
- This decision does not approve `SPEC-0003` or authorize implementation, real
  data, external model transfer, or external side effects.

## DEC-0017: Separate system-surfaced possibilities from human-committed work

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` opportunity structure and the discovery/management boundary
- Supersedes: the open boundary left by `DEC-0016` and `INBOX-0002` about whether
  the two must be distinct

### Decision

A business possibility that the system surfaces must remain a distinct logical
layer from business work that a person has explicitly chosen to pursue.

1. **System-surfaced possibility**: may be incomplete in target, path, or value;
   must carry its supporting facts, reasoning, uncertainty, and discovery time;
   must never be counted as confirmed demand, a commitment, or a forecast.
2. **Human-committed business work**: exists only after a person explicitly
   decides to take it on; its follow-up and outcomes are sustained and owned.

The two layers must not be merged into a single record distinguished only by a
status flag, because that would let machine-surfaced guesses blur into the
managed pipeline and pollute later reporting or forecasting.

### Decision evidence

In response to the AI's plain-language question about whether a system-surfaced
possibility must stay distinct from business work a person has chosen to pursue,
the product owner selected the recommended option `分成两层（推荐）` on
2026-07-26.

### Consequences

- `SPEC-0003` drafting must preserve two distinct layers, consistent with the
  approved `事实 vs 可能性` principle and `DEC-0016`.
- A person may adopt, defer, ignore, merge, or request more support for a
  surfaced possibility; non-adoption must not alter the original facts and must
  not permanently mark a direction as worthless.
- The exact pages, data structures, and stage/scoring/forecast behavior remain
  undecided and must not be introduced by this decision.
- Still open: the minimum human commitment required to move a possibility from
  layer 1 into layer 2. This is resolved before any stage, score, or forecast.
- This decision does not approve `SPEC-0003` or authorize implementation, real
  data, external model transfer, or external side effects.

## DEC-0018: Discovery surfaces reminders without a formal claim step

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` discovery-to-work boundary
- Supersedes: the open item in `DEC-0017` about the minimum human commitment to
  move a possibility into managed business work

### Decision

For the current stage, active discovery presents a surfaced possibility to the
relevant person as a reminder, together with its supporting reasons. There is no
formal claim, promotion, or "convert to opportunity" step.

A person who chooses to act does so through the existing organization, contact,
and follow-up records approved in `SPEC-0001`. This resolves the `DEC-0017` open
item: for now no dedicated commitment gesture is required beyond the person's
normal follow-up work.

This keeps `DEC-0017` intact. Reminders remain the discovery layer and never
count as confirmed demand, commitment, or forecast; committed business work
remains in the `SPEC-0001` records. The two layers stay distinct because they
are different things (reminders vs records), with no gate between them.

### Decision evidence

The product owner stated `目前只需要提醒，不需要认领之类的` and then confirmed
the restated understanding (discovery = reminder, no claim step; acting happens
through normal `SPEC-0001` follow-up) with `正确，继续` on 2026-07-26.

### Consequences

- `SPEC-0003` discovery does not define a claim/promote/convert action at this
  stage.
- A surfaced possibility must still carry its supporting facts, reasoning,
  uncertainty, and discovery time, and must not be shown as confirmed demand or
  forecast; `DEC-0016` and `DEC-0017` are unchanged.
- Whether a dedicated managed-opportunity object is ever needed remains open and
  is not introduced now; it is decided only if a later need is confirmed.
- Reminder targeting, timing, and how a person marks a reminder handled/ignored
  are later discovery details; a single dismissal must not permanently mark a
  direction as worthless.
- Stage count, scoring, forecasting, and closure remain out of scope per
  `DEC-0015`.
- This decision does not approve `SPEC-0003` or authorize implementation, real
  data, external model transfer, or external side effects.

## DEC-0019: Discovery may connect cross-owner data but reminders stay masked

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` discovery data reach and reminder disclosure
- Supersedes: the ambiguity in `DEC-0016` about whether the approved processing
  context may reach beyond what the recipient personally sees

### Decision

To surface a possibility, the discovery function may connect information across
the company's approved scope, including records owned by other business users
that the recipient personally may not view.

What is surfaced to a recipient must obey the approved `SPEC-0001` field-level
masking and concise-progress rules. The reminder — and the reasoning shown with
it — must not expose another owner's protected details (channel values, raw
follow-up text, customer quotations, evidence, or other masked fields), and its
granularity must not become an indirect way to infer them. Obtaining the
underlying protected details still requires the existing record-owner path or
the audited administrator exception.

The cross-owner connection is an approved internal processing context. It must
remain minimum-necessary, auditable, and bounded by `SPEC-0001` and `SPEC-0002`;
it does not grant the recipient new visibility and does not authorize sending
real data to an external model or provider.

### Decision evidence

Asked whether the system may connect data the recipient is not authorized to
see and then surface a desensitized reminder, the product owner selected the
recommended option `可跨界连接，只给脱敏提醒` on 2026-07-26.

### Consequences

- `SPEC-0003` must define discovery so that detection may use approved
  company-wide data while disclosure to each recipient stays masked.
- The reminder must carry enough reasoning to be actionable without leaking
  protected specifics; a small or overly specific hint must be suppressed or
  generalized rather than expose restricted content (same spirit as `SPEC-0002`
  aggregation-inference protection).
- Pursuing a masked possibility routes protected detail through the existing
  owner/administrator exception, not through the reminder itself.
- The discovery processing context, model/provider, and any real-data egress
  remain separately gated; without approval, discovery uses only synthetic data
  in verification.
- To whom a reminder is sent is not decided here.
- This decision does not approve `SPEC-0003` or authorize implementation, real
  data, external model transfer, or external side effects.

## DEC-0020: Discovery reminders go to the involved record owners

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` discovery reminder targeting
- Supersedes: the open targeting question left by `DEC-0019`

### Decision

A discovery reminder is sent to the owner(s) of the records involved in the
surfaced possibility. Each owner receives the masked reminder for their own side
and acts within their own scope. No manager/coordinator dispatch role and no
automatic "single best person" selection are introduced at this stage.

### Decision evidence

Asked to whom a cross-owner discovery reminder should be sent, the product owner
selected the recommended option `发给相关记录的负责人` on 2026-07-26.

### Consequences

- Reminder targeting inherits `SPEC-0002` ownership: the recipient is a record
  owner, not a new dispatch role, and management stays read-only per `DEC-0013`.
- Each recipient sees only the masked reminder allowed by `DEC-0019` and
  `SPEC-0001`; a cross-owner possibility does not expose one owner's protected
  detail to another.
- How multiple owners of one possibility coordinate, and how a possibility with
  no clear or an inactive owner is routed, remain open edge cases for `SPEC-0003`
  drafting.
- This decision does not approve `SPEC-0003` or authorize implementation, real
  data, external model transfer, or external side effects.

## DEC-0021: Resolve SPEC-0003 open decisions OD-001 to OD-004

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003` edge behavior and readiness for review
- Supersedes: the open items `OD-001`–`OD-004` in `SPEC-0003 v0.1.0`

### Decision

- **OD-001 (multi-owner coordination)**: A discovery reminder is intelligence
  about a possibility only. Coordination and duplicate-pursuit ("防雷") handling
  among multiple owners is not built in this stage; it becomes a `SPEC-0003`
  non-goal and a candidate for a later SPEC if needed.
- **OD-002 (unowned/inactive-owner routing)**: When an involved record has no
  owner, the reminder is sent to the supervisor (主管). Receiving the reminder
  does not itself grant new write power; assigning an owner still follows the
  existing `SPEC-0002` assignment path and `DEC-0013` management boundary.
- **OD-003 (ignored-reminder lifecycle)**: A reminder behaves like a message. If
  a recipient acts, a normal `SPEC-0001` follow-up record results; if no one
  acts, it simply stays an unread message, with no re-surfacing, expiry, or
  special "ignored" handling. Non-adoption does not alter the original facts.
- **OD-004 (management discovery visibility)**: No management discovery-activity
  summary view is provided at this stage.

### Decision evidence

Resolving the four open decisions, the product owner stated on 2026-07-26:
`情报只是机会，协同防雷不再本阶段完成` / `如果没有负责人，那就发给主管` /
`没人理就没人理，有人点就有记录，没人点，那就是未读消息，不需要额外处理` /
`目前不需要`.

### Consequences

- `SPEC-0003`'s behavior-affecting open decisions are resolved; with
  `DEC-0015`–`DEC-0020` the SPEC can move from `10-draft` to `20-review`.
- Multi-owner coordination is a `SPEC-0003` non-goal.
- The supervisor (主管) fallback is a reminder recipient, not a new writing
  authority; the exact mapping to `SPEC-0002` roles is confirmed at review.
- `OD-005` (retention) and `OD-006` (discovery method/provider/real-data egress)
  remain separately gated and, like `SPEC-0001`'s provider/egress items, do not
  block review or approval.
- This decision does not approve `SPEC-0003` or authorize implementation, real
  data, external model transfer, or external side effects.

## DEC-0022: Approve SPEC-0003 version 0.2.0

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0003 v0.2.0` lifecycle and business authority
- Supersedes: the review-only status of `SPEC-0003 v0.2.0`

### Decision

The product owner explicitly approved `SPEC-0003 v0.2.0` in full. It becomes the
current authority for opportunity discovery: active surfacing of business
possibilities as masked reminders, the two-layer separation from committed work,
reminders without a claim step, cross-owner detection with masked disclosure,
delivery to the involved record owners (supervisor as the unowned fallback),
ignored-reminder-as-unread-message behavior, and the discovery hallucination and
audit boundaries inherited from `SPEC-0001` and `SPEC-0002`.

### Decision evidence

After the AI presented review/approve/change options for `SPEC-0003 v0.2.0`, the
product owner chose option `2`, `直接批准 v0.2.0`, on 2026-07-26.

### Authorization boundary

This is SPEC approval only. It does not authorize an implementation task,
application-code edits, real-data use, external model transfer, shared or
production deployment, paid services, or any external side effect. `OD-005`
(retention) and `OD-006` (discovery method/provider/real-data egress) remain
separately gated.

### Consequences

- The SPEC moves from `20-review` to `30-approved`.
- Matching approval metadata stores the final approved file SHA-256.
- `SPEC-0003` becomes one more part of the still-incomplete baseline; `DEC-0011`
  keeps all implementation frozen.
- The next discovery step is `SPEC-0004` (manual lead intake) per the baseline
  drafting order.

## DEC-0023: Manual lead intake is folded into SPEC-0001, no separate SPEC-0004

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0004` candidate scope and the baseline candidate map
- Supersedes: the baseline candidate `SPEC-0004` (manual lead intake, evidence,
  duplicate review, conversion) as a separate SPEC

### Decision

- No separate "lead" object is introduced. Raw or manually collected inputs are
  entered directly as `SPEC-0001` institution/contact records; there is no
  distinct lead stage and therefore no lead-to-record conversion.
- The system adds no dedicated source-channel management beyond `SPEC-0001`,
  which already covers a required source explanation, optional source evidence,
  and duplicate-warning behavior.
- Consequently `SPEC-0004` is not created as a separate SPEC; manual lead intake
  is folded into `SPEC-0001`. The `SPEC-0004` id is retired as a tombstone.

### Decision evidence

The product owner chose `不要，直接建档` (no separate lead object) and then
`不需要，SPEC-0001 够了` (no dedicated source-channel management) on 2026-07-26.

### Consequences

- The baseline candidate list drops `SPEC-0004`; `SPEC-0001` remains the
  authority for manual record creation, provenance, and duplicate warnings.
- No change to the approved `SPEC-0001` is required; it already covers this.
- A future need for channel governance or a lead pre-stage would require a new
  SPEC-baseline decision.
- The next baseline discovery step is `SPEC-0005` (external lead-source
  collection), which remains scope-unconfirmed with the legacy crawler untrusted.
- This decision does not approve any SPEC or authorize implementation.

## DEC-0024: No automatic external lead-source collection, no separate SPEC-0005

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0005` candidate scope and the baseline candidate map
- Supersedes: the baseline candidate `SPEC-0005` (external lead-source collection
  and source governance) as a separate SPEC

### Decision

- The CRM does not automatically collect leads from external sources. New
  customer or lead information enters through manual entry (`SPEC-0001`), and
  opportunities surface from existing approved data via discovery (`SPEC-0003`).
- Consequently `SPEC-0005` is not created as a separate SPEC and is dropped from
  the baseline. The legacy seven-channel crawler remains untrusted and is not
  adopted. The `SPEC-0005` id is retired as a tombstone.

### Decision evidence

The product owner chose `不需要，靠人工+发现` on 2026-07-26.

### Consequences

- No external crawling/collection capability exists, avoiding external
  data-source legality and compliance risk at this stage.
- A future need for external collection requires a new SPEC-baseline decision
  with separate authorization for external data sources and side effects.
- This narrows the remaining `SPEC-0006` scope: deduplication is already covered
  by `SPEC-0001`, and there is no external lead inflow to match or score;
  `SPEC-0006` discovery will confirm what, if anything, remains.
- This decision does not approve any SPEC or authorize implementation.

## DEC-0025: No duplicate-merge or AI scoring, no separate SPEC-0006

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0006` candidate scope and the baseline candidate map
- Supersedes: the baseline candidate `SPEC-0006` (deduplication, matching, AI
  scoring, review and override) as a separate SPEC

### Decision

- No dedicated duplicate-merge feature and no AI scoring, rating, or
  prioritization are built. Duplicate prevention is the creation-time warning in
  `SPEC-0001` (`R-035`); a duplicate that slips in is handled by `SPEC-0001`
  archive.
- Consequently `SPEC-0006` is not created as a separate SPEC and is dropped from
  the baseline. The `SPEC-0006` id is retired as a tombstone.

### Decision evidence

The product owner chose `不需要，SPEC-0006 也不立` on 2026-07-26.

### Consequences

- No MEDDIC or scoring formula, consistent with `DEC-0015` keeping scoring out.
- Duplicate records can be archived but not history-merged; a future merge need
  requires a new SPEC-baseline decision.
- The next baseline step is `SPEC-0007` (tasks, follow-up reminders, assignment,
  escalation); the legacy A/B/C/D cadence remains untrusted.
- This decision does not approve any SPEC or authorize implementation.

## DEC-0026: No active follow-up reminders or tasks, no separate SPEC-0007

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0007` candidate scope and the baseline candidate map
- Supersedes: the baseline candidate `SPEC-0007` (tasks, follow-up reminders,
  assignment, escalation) as a separate SPEC

### Decision

- The system does not actively remind owners about due follow-ups and does not
  provide a task/to-do list, assignment queue, or escalation. The "next action +
  owner + target date" fields in `SPEC-0001` are sufficient; people self-manage
  by reading them.
- Consequently `SPEC-0007` is not created as a separate SPEC and is dropped from
  the baseline. The `SPEC-0007` id is retired as a tombstone.
- This is distinct from `SPEC-0003` discovery reminders, which surface newly
  found possibilities as unread messages; `DEC-0026` only declines due-date
  follow-up reminders and tasks.

### Decision evidence

The product owner chose `不需要，靠人自己看` on 2026-07-26.

### Consequences

- Follow-up discipline relies on people reading the next-action and target date,
  not on system reminders.
- A future need for reminders/tasks requires a new SPEC-baseline decision.
- The next baseline step is `SPEC-0008` (search, saved views, export, and
  minimum-necessary disclosure), which must extend `SPEC-0001` masking
  consistently.
- This decision does not approve any SPEC or authorize implementation.

## DEC-0027: SPEC-0008 kept as search only, no export

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0008` scope
- Supersedes: the broad `SPEC-0008` candidate (search, saved views, export)

### Decision

- The CRM provides basic search to find records, obeying the `SPEC-0001`
  field-level masking (page, search, export, and API share one rule).
- No data export out of the system (Excel or similar) at this stage, and no
  saved views for now.
- `SPEC-0008` is therefore kept but narrowed to a search capability with an
  explicit no-export boundary; it will be drafted. Unlike `SPEC-0004`–
  `SPEC-0007`, it is not dropped.

### Decision evidence

The product owner chose `要搜索，不要导出` on 2026-07-26.

### Consequences

- Search must never bypass `SPEC-0001` masking; each role's results follow the
  same field-level rules, and unmapped fields default to hidden.
- No export removes the largest data-leak surface; a future export need requires
  a new SPEC-baseline decision with masking, permission, and audit controls.
- `SPEC-0008` will be drafted as a small SPEC (searchable fields, result masking,
  explicit no-export); saved views are deferred.
- The next baseline step is `SPEC-0009` (notifications and external
  collaboration integrations).
- This decision does not approve any SPEC or authorize implementation.

## DEC-0028: No external integrations or notifications, no separate SPEC-0009

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0009` candidate scope and the baseline candidate map
- Supersedes: the baseline candidate `SPEC-0009` (notifications and external
  collaboration integrations) as a separate SPEC

### Decision

- At this stage the CRM does not integrate with external tools (Feishu or
  others) and does not send outbound notifications. It is self-contained.
- Consequently `SPEC-0009` is not created as a separate SPEC and is dropped from
  the baseline. The `SPEC-0009` id is retired as a tombstone.

### Decision evidence

The product owner chose `不需要，CRM 自成一体` on 2026-07-26.

### Consequences

- No external writes exist in the baseline, consistent with the `AGENTS.md`
  safety boundary that external side effects require separate approval anyway.
- A future integration or notification need requires a new SPEC-baseline
  decision with its own external-write authorization.
- The next baseline step is `SPEC-0010` (reporting, funnel metrics, dashboards
  and forecasting); note management concise summaries already live in
  `SPEC-0002`, and stages/scoring/forecast remain deferred.
- This decision does not approve any SPEC or authorize implementation.

## DEC-0029: No separate reporting or dashboards, no separate SPEC-0010

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0010` candidate scope and the baseline candidate map
- Supersedes: the baseline candidate `SPEC-0010` (reporting, funnel metrics,
  dashboards and forecasting) as a separate SPEC

### Decision

- No separate reporting, dashboard, funnel-metric, or forecasting capability is
  built. The management concise summaries already approved in `SPEC-0002`
  (`DEC-0013`) are sufficient; funnel metrics and forecasting are impossible and
  unwanted because there are no stages or scoring.
- Consequently `SPEC-0010` is not created as a separate SPEC and is dropped from
  the baseline. The `SPEC-0010` id is retired as a tombstone.

### Decision evidence

The product owner chose `不需要，SPEC-0002 够了` on 2026-07-26.

### Consequences

- Reporting is limited to the `SPEC-0002` management concise summaries, which
  already obey `SPEC-0001` desensitization and aggregation-inference protection.
- A future need for statistics/dashboards requires a new SPEC-baseline decision.
- The next baseline steps are `SPEC-0011` (data lifecycle) and `SPEC-0012`
  (production operations), which are cross-cutting: the baseline-completion rule
  requires each to be either covered by an approved SPEC or explicitly marked
  not applicable with verified evidence, so they cannot simply be "not wanted".
- This decision does not approve any SPEC or authorize implementation.

## DEC-0030: Defer SPEC-0011 and SPEC-0012 behind a real-data/deployment gate

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0011`, `SPEC-0012`, and the scope of the complete baseline
- Supersedes: treating data lifecycle and production operations as either
  droppable features or mandatory-now SPECs

### Decision

- `SPEC-0011` (data lifecycle: retention, backup, recovery, and the personal-
  information-protection-required erasure) and `SPEC-0012` (production
  operations, security, deployment, acceptance) are not dropped. They are
  explicitly deferred and gated: each must be drafted and approved before any
  real customer data is entered or the system is deployed to a shared or
  production environment.
- The current SPEC baseline is scoped to the local, synthetic-data build only.
  Within that scope, data-lifecycle and production-operations behavior is marked
  not applicable with verified evidence: real data is not authorized and the
  deployment target, provider, and compliance context are unknown (`SPEC-0001`
  section 10).
- This satisfies baseline-completion condition 3 for the current scope through
  explicit not-applicable marking, while preserving a hard gate for real data
  and production.

### Decision evidence

The product owner chose `明确延后，设硬门` on 2026-07-26.

### Consequences

- The complete baseline is defined as "complete for the local synthetic-data
  build." It can be assessed complete once the kept `SPEC-0008` (search) is
  approved and a cross-SPEC consistency review passes.
- Entering real customer data or deploying is blocked until `SPEC-0011` and
  `SPEC-0012` are drafted, approved, and their own real-data/deployment
  authorizations are granted. A future real-data/production baseline is a
  separate expansion.
- The `SPEC-0011` and `SPEC-0012` ids remain reserved (deferred, not retired).
- This decision does not approve any SPEC or authorize implementation.

## DEC-0031: Resolve cross-SPEC seams F-1 (supervisor) and F-2 (management masking)

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner (F-1); AI engineering reconciliation (F-2)
- Affects: `SPEC-0003` reminder routing and the `SPEC-0001` masking matrix as
  applied to management roles
- Supersedes: the undefined "主管" wording left by `DEC-0021` for `SPEC-0003`
  R-015

### Decision

- **F-1 (product-owner decision)**: The unowned-record discovery reminder in
  `SPEC-0003` R-015 goes to the administrator, not a separate "主管" role. The
  administrator receives it and assigns an owner through the existing `SPEC-0002`
  admin path. No new role is introduced. This clarifies the "主管" wording in
  `SPEC-0003`/`DEC-0021`.
- **F-2 (engineering reconciliation)**: For field-level masking, management roles
  (总经理 and 其他管理层) map to the "other authorized business user" level in the
  `SPEC-0001` display matrix, restricted to their authorized scope and read-only
  per `DEC-0013`. This closes the matrix gap without amending the approved
  `SPEC-0001`; the decision log is the authority (authority order places a
  recorded decision above a SPEC).

### Decision evidence

Asked to whom an unowned-record reminder should go, the product owner chose
`发给管理员` on 2026-07-26. F-2 is an AI reconciliation consistent with the
already-approved `SPEC-0002` R-019–R-023 and `DEC-0013`; it changes no business
meaning.

### Consequences

- The cross-SPEC review (`docs/evidence/2026-07-26-cross-spec-review.md`) seams
  F-1 and F-2 are resolved; baseline-completion condition 5 is now satisfiable.
- When `SPEC-0003` is next revised, its R-015 wording should be updated from
  "主管" to "administrator" for cleanliness; until then this decision governs.
- No approved SPEC file is edited, so no re-hash or re-approval is required.
- This decision does not approve any SPEC or authorize implementation.

## DEC-0032: Approve SPEC-0008 version 0.1.0

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0008 v0.1.0` lifecycle and business authority
- Supersedes: the review-only status of `SPEC-0008 v0.1.0`

### Decision

The product owner explicitly approved `SPEC-0008 v0.1.0` in full. It becomes the
current authority for search: finding records under the `SPEC-0001` field-level
masking, matching only on fields the searcher may see, no protected-value
matching or inference, no export, and no saved views at this stage.

### Decision evidence

The product owner replied `同意` on 2026-07-26 to the combined request to approve
`SPEC-0008 v0.1.0` and declare the baseline complete.

### Authorization boundary

This is SPEC approval only. It does not authorize implementation, real-data use,
external writes, or deployment.

### Consequences

- The SPEC moves from `20-review` to `30-approved` with matching approval
  metadata storing the final file SHA-256.
- `SPEC-0008` completes the kept scope of the local synthetic-data baseline.

## DEC-0033: The SPEC baseline is complete for the local synthetic-data build

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `docs/specs/SPEC-BASELINE.md` and the `DEC-0011` implementation freeze
- Supersedes: the `INCOMPLETE` baseline status

### Decision

The product owner declares the complete SPEC baseline satisfied for the local,
synthetic-data build scope. The baseline consists of the approved `SPEC-0001`,
`SPEC-0002`, `SPEC-0003`, and `SPEC-0008`; the dropped/folded capabilities
(`SPEC-0004`–`SPEC-0007`, `SPEC-0009`, `SPEC-0010`); and the deferred, gated
`SPEC-0011`/`SPEC-0012` (`DEC-0030`).

Baseline-completion conditions are met for this scope:

1. Product boundary confirmed (`DEC-0012`).
2. Every in-scope capability has an approved SPEC with matching hash.
3. Cross-cutting data lifecycle and production operations are explicitly marked
   not applicable to the local synthetic-data build and gated behind
   real-data/deployment (`DEC-0030`).
4. No behavior-changing open decision remains in an included SPEC.
5. The cross-SPEC review resolved all seams (`DEC-0031`;
   `docs/evidence/2026-07-26-cross-spec-review.md`).
6. This decision records the explicit baseline-completion approval.

### Decision evidence

The product owner replied `同意` on 2026-07-26 to approve `SPEC-0008 v0.1.0` and
declare the baseline complete.

### Consequences

- The `DEC-0011` blanket implementation freeze is lifted for the local
  synthetic-data build scope; `AGENTS.md` section 5 gate 5 is now satisfied.
- Implementation of any specific behavior still requires the remaining
  `AGENTS.md` section 5 gates: an approved SPEC (met), an active task under
  `docs/tasks/active/`, and the product owner's explicit authorization of that
  named task. No task is authorized by this decision.
- Real customer data, external writes, and deployment remain blocked until
  `SPEC-0011`/`SPEC-0012` and their own authorizations are completed.
- The next step is an AI proposal of the smallest first implementation task for
  explicit product-owner authorization.

## DEC-0034: Pursue real seed data and bulk import; prioritize SPEC-0011

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0011` sequencing, the `DEC-0033` synthetic-data baseline scope,
  and the `SPEC-0001` bulk-import non-goal
- Supersedes: the deferral of `SPEC-0011` in `DEC-0030` (now pulled to active)

### Decision

- The product owner intends to seed the CRM with real elderly-care-institution
  (养老机构) records that include real contact details obtained from public
  internet sources, and to allow bulk import.
- This is real and partly personal data (institution contact persons), so it
  exits the synthetic-data-only scope under which the baseline was declared
  complete (`DEC-0033`). Real-data use requires the privacy/retention foundation
  first.
- `SPEC-0011` (data lifecycle: import, correction, retention, backup, recovery,
  erasure, and personal-information handling) moves from DEFERRED (`DEC-0030`) to
  ACTIVE discovery, sequenced before bulk import and before any real-data seeding.
- Bulk import is a new capability (currently a `SPEC-0001` non-goal) and will
  need its own SPEC after `SPEC-0011`.

### Compliance flag

Collecting real personal contact information from the internet raises PIPL and
source-legitimacy questions. No collection, import, or storage of real data
occurs until `SPEC-0011` is approved and an explicit compliance decision is
recorded. Public institutional contact carries lower risk than contact persons'
personal phone numbers.

### Decision evidence

The product owner stated they want to seed real 养老机构 contacts from the
internet and allow bulk import, and chose to do the privacy/retention SPEC-0011
first, on 2026-07-26.

### Consequences

- The `DEC-0033` baseline-complete status stands for the local synthetic-data
  build; a real-data build is a further scope tier now under construction, gated
  by `SPEC-0011` (and later `SPEC-0012` plus compliance).
- No real data is collected, imported, or stored until `SPEC-0011` is approved
  and a compliance decision is recorded.
- This decision does not approve `SPEC-0011` or authorize implementation.

## DEC-0035: SPEC-0011 introduces controlled permanent deletion (erasure)

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0011` deletion behavior; reconciliation with `SPEC-0001` R-031
- Supersedes: (partial) the `SPEC-0001` "archive-only, no hard delete" boundary
  for the real-data tier

### Decision

`SPEC-0011` will add a controlled, administrator-only, audited permanent-delete
(erasure) capability for real/personal data, on top of the existing `SPEC-0001`
archive. Archive remains the default for ordinary business corrections;
permanent erasure is a distinct, audited, irreversible action used for PIPL
erasure requests and for purging wrong or inadmissible data. The erasure audit
records who, when, why, and what scope — but not the erased personal values.

### Decision evidence

The product owner chose `要，受控永久删除` on 2026-07-26.

### Consequences

- The `SPEC-0011` draft will define the erasure-vs-archive boundary, admin
  authority, audit content, and irreversibility.
- `SPEC-0001` R-031 ("archive-only") governs ordinary business records; erasure
  is a new personal-data-lifecycle action for the real-data tier. The two must be
  reconciled explicitly in `SPEC-0011` and re-checked in the next cross-SPEC
  review.
- This decision does not approve `SPEC-0011` or authorize implementation.

## DEC-0036: SPEC-0011 retention is on-demand with trigger-based deletion

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0011` retention and deletion triggers

### Decision

Real data is retained while relevant to the business relationship. Permanent
erasure is triggered when (a) the data subject requests it, (b) the data is wrong
or obsolete, or (c) an administrator determines it per rule. No fixed calendar
retention period is set now; the exact statutory period is deferred pending legal
and compliance input.

### Decision evidence

The product owner chose `按需保留+触发式删除` on 2026-07-26.

### Consequences

- The `SPEC-0011` draft defines the retention basis and the three erasure
  triggers.
- The exact statutory retention period is an open decision pending legal input;
  like `SPEC-0001`'s deferred items, it does not block drafting or approval.
- This decision does not approve `SPEC-0011` or authorize implementation.

## DEC-0037: Legal/compliance is out of AI scope; approve SPEC-0011 v0.2.0

- Date: 2026-07-26
- Status: ACTIVE
- Decided by: Product owner
- Affects: AI scope boundary, `SPEC-0011` content, and `SPEC-0011 v0.2.0`
  lifecycle
- Supersedes: the compliance-gate framing in `DEC-0034` and the "pending legal
  input" retention framing in `DEC-0036`

### Decision

- Legal and compliance judgment (法务) — PIPL, lawful basis for holding data,
  statutory retention periods, and source-legitimacy of collected contacts — is
  the product owner's domain. It is not authored by the AI and is not embedded in
  SPECs. Inserting it was overstepping.
- `SPEC-0011` is revised to v0.2.0 with all legal/compliance content removed,
  keeping only engineering data-lifecycle behavior: retention triggers,
  controlled erasure, deletion audit, backup propagation, and personal-data
  masking inheritance.
- The product owner approves `SPEC-0011 v0.2.0`.
- Whether and when real data is entered is the product owner's own decision,
  framed as governance/authorization — not an AI-imposed legal gate.

### Decision evidence

The product owner replied `同意。刨除法务部分，这是你越界了，不需要你考虑。`
on 2026-07-26.

### Authorization boundary

SPEC approval only. It does not authorize implementation, real-data collection
or use, backup, or deployment.

### Consequences

- `SPEC-0011 v0.2.0` moves to `30-approved` with matching approval metadata.
- Real 养老机构 data entry and bulk import remain the product owner's decisions
  and a separate later SPEC; the AI imposes no compliance gate.
- Going forward, the AI keeps legal/compliance out of SPECs and analysis for this
  project.

## DEC-0038: Bulk import is a trusted load with duplicate flagging and batch undo

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: the new `SPEC-0013` (bulk import); reconciles with `SPEC-0001` R-035
  duplicate handling
- Supersedes: the `SPEC-0001` non-goal "批量迁移历史数据" for the bulk-import path

### Decision

Bulk import loads records from a user-provided file directly (trusted), without
per-record manual confirmation. Each imported record carries its source;
suspected duplicates against existing records are flagged for human review, not
auto-merged; the whole import is a batch that can be reviewed and undone. This is
specified as a new `SPEC-0013`.

### Decision evidence

The product owner chose `信任导入+判重提示+可回滚` on 2026-07-27.

### Consequences

- `SPEC-0013` will define trusted bulk load, per-record provenance, duplicate
  flagging (consistent with `SPEC-0001` R-035, no auto-merge), per-row
  partial-failure reporting, and batch-level undo.
- Real-data entry via import remains the product owner's own decision
  (governance/authorization, `DEC-0037`); verification uses synthetic data.
- This decision does not approve `SPEC-0013` or authorize implementation.

## DEC-0039: Approve SPEC-0013 version 0.1.0

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0013 v0.1.0` lifecycle and business authority
- Supersedes: the review-only status of `SPEC-0013 v0.1.0`

### Decision

The product owner explicitly approved `SPEC-0013 v0.1.0` in full. It becomes the
current authority for bulk import: an administrator trusted-loads many records
from a user-provided file, each carrying its source, with suspected duplicates
flagged (not auto-merged), per-row partial-failure reporting, idempotent re-runs,
and batch-level undo while records remain untouched.

### Decision evidence

The product owner replied `同意` on 2026-07-27 to approve `SPEC-0013 v0.1.0`.

### Authorization boundary

SPEC approval only. It does not authorize implementation, real-data import or
use, or deployment.

### Consequences

- The SPEC moves from `20-review` to `30-approved` with matching approval
  metadata.
- With `SPEC-0011` and `SPEC-0013` approved, the real-data-tier engineering SPECs
  are complete; entering real data remains the product owner's own decision.
- No implementation task is authorized by this decision.

## DEC-0040: Deployment target is cloud with anywhere access

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0012` deployment direction
- Supersedes: the deferral of `SPEC-0012` deployment direction in `DEC-0030`

### Decision

The CRM will be deployed to a cloud environment, reachable by authorized users
from anywhere (supporting field sales). This confirms the deployment direction
and moves `SPEC-0012` from deferred to active discovery. The specific cloud
provider, login mechanism, and cost/budget are engineering proposals plus owner
authorizations, not decided here. Legal, compliance, and data-residency remain
the product owner's domain (`DEC-0037`).

### Decision evidence

The product owner chose `云服务，随时随地访问` on 2026-07-27.

### Consequences

- `SPEC-0012` (production operations, security, deployment, acceptance) is
  drafted against a cloud target.
- Cloud hosting (where the app runs) is distinct from `DEC-0028`'s "no external
  integrations".
- The AI proposes the provider and architecture; the product owner authorizes
  cost and performs any account/payment action (the AI does not create accounts
  or enter payment).
- This decision does not approve `SPEC-0012` or authorize deployment or
  implementation.

## DEC-0041: Concrete deployment target — Tencent Lightweight, crm.aibrain.wiki

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0012` open decisions `OD-001`–`OD-003`
- Supersedes: the unspecified provider/budget in `DEC-0040`

### Decision

- The CRM deploys to the product owner's existing 腾讯云轻量应用服务器 (Tencent
  Cloud Lightweight Application Server), which already hosts several small
  projects under the main domain `aibrain.wiki`. A new subdomain
  `crm.aibrain.wiki` is created for the CRM, served by nginx over HTTPS.
  Deployment follows the SSH-based push pattern used by the reference project
  `经销商赋能培训体系`.
- The TLS certificate and private key for `crm.aibrain.wiki` were provided
  out-of-band. Per `AGENTS.md` section 8 they are runtime secrets: they are NOT
  stored in the repository and are placed on the server/secret store at deploy
  time. The AI does not copy or print them.
- Architecture clarification: unlike the reference project (a static site with
  client-side auth), the CRM must be a server-side application with a backend and
  a data store, because `SPEC-0001`/`SPEC-0002` masking, permissions, audit, and
  real personal data cannot be enforced by a static client-side site. The
  deployment infrastructure (Tencent Lightweight + nginx + subdomain + HTTPS +
  SSH deploy) is reusable; the application is not a static bundle.

### Decision evidence

On 2026-07-27 the product owner provided the Tencent Lightweight server, main
domain `aibrain.wiki`, the new `crm.aibrain.wiki` subdomain, the SSL cert/key
bundle, and the reference deployment project.

### Consequences

- `SPEC-0012` `OD-001` (provider/architecture) resolves to Tencent Lightweight +
  nginx + HTTPS + SSH; `OD-003` (budget) is effectively "reuse the existing
  server, no new recurring cost expected"; `OD-002` (login) is constrained to a
  server-side mechanism (the reference's client-side auth is inadequate), with
  the specific mechanism still an AI proposal.
- Actual deployment still requires a built application, `SPEC-0012` approval, and
  explicit authorization; the AI will not connect to the server, handle SSH or
  credentials, or place the TLS key without that authorization and proper secret
  handling.
- Secrets (TLS key, SSH credentials) are never committed to the repository.

## DEC-0042: Approve SPEC-0012 version 0.2.0

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `SPEC-0012 v0.2.0` lifecycle and business authority
- Supersedes: the review-only status of `SPEC-0012 v0.2.0`

### Decision

The product owner explicitly approved `SPEC-0012 v0.2.0` in full. It becomes the
current authority for cloud deployment, operations, security, and acceptance:
Tencent Cloud Lightweight server, subdomain `crm.aibrain.wiki`, nginx over
HTTPS, SSH-based deploy, as a server-side application; authenticated
anywhere-access that preserves masking/permissions/audit; backups with tested
recovery and erasure propagation; reversible deployment; product-owner
acceptance before real use; and the rule that the AI never handles the TLS key,
SSH credentials, accounts, or payment.

### Decision evidence

The product owner replied `同意` on 2026-07-27 to approve `SPEC-0012 v0.2.0`.

### Authorization boundary

SPEC approval only. It does not authorize implementation, real-data use, TLS-key
handling, account/payment actions, or actual deployment. Actual deployment
additionally requires a built application and explicit authorization.

### Consequences

- The SPEC moves from `20-review` to `30-approved` with matching approval
  metadata.
- All SPEC slots `SPEC-0001`–`SPEC-0013` are now resolved (approved, folded, or
  dropped); the full SPEC set is complete.
- `OD-002` (server-side login mechanism) remains an AI proposal for a later step.
- No implementation task is authorized by this decision.

## DEC-0043: Cancel local-first; build cloud-deployed from the start

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `ADR-0001`, the first implementation task, and storage/runtime choices
- Supersedes: the local-first premise of `ADR-0001`

### Decision

- Local-first is cancelled. The CRM is built as a cloud-deployed server-side
  application from the start, targeting the existing 腾讯云轻量应用服务器 at
  `crm.aibrain.wiki` (`DEC-0041`/`DEC-0042`).
- The product owner confirms the server supports server-side applications (not
  just static hosting), citing their existing project `health.aibrain.wiki` as
  evidence of a working backend deployment on the same server.
- `ADR-0001` (local-first modular monolith) is superseded. Its module design
  remains sound and is carried forward; its local-only runtime, SQLite-only
  storage, and "no cloud service" constraints are replaced.

### Decision evidence

The product owner stated on 2026-07-27: `本地优先取消，云端部署，而且我的腾讯云
轻量应用服务器是支持服务器的，从另外一个项目 health.aibrain.wiki 可以看得出来`.

### Consequences

- `ADR-0002` replaces `ADR-0001`, keeping the FastAPI modular monolith with a
  central policy layer (which `SPEC-0001`/`SPEC-0002` masking requires) while
  targeting the cloud server.
- Local development still uses synthetic data; "local" is now a development
  environment, not the product's deployment model.
- Storage moves from local-SQLite-only to a server database suitable for the
  multi-user concurrency defined in `SPEC-0002`.
- This decision does not authorize implementation, deployment, real data, or any
  server access.

## DEC-0044: Use a native Tencent server deployment without Docker

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `ADR-0002`, `TASK-0001`, server preflight, authentication, deployment,
  data and external-service boundaries
- Supersedes: every Docker/Docker Compose premise in the current `TASK-0001`
  proposal; the unresolved login-mechanism portion of `SPEC-0012` `OD-002`

### Decision

- CRM must not use Docker or Docker Compose. It targets the existing Tencent
  Cloud Lightweight Application Server from the beginning and runs natively.
- The retained architecture is FastAPI modular monolith + Jinja2 + one central
  server-side `policy` layer + PostgreSQL + Alembic + server-side sessions, with
  Uvicorn managed by systemd and reverse-proxied by nginx.
- The proposed native deployment uses a project-specific Python virtual
  environment, PostgreSQL database and database role, systemd service, nginx
  configuration and deployment directory. It must not overwrite, restart,
  reconfigure or otherwise affect another server project.
- Development and initial production authentication use server-side sessions.
  Administrators pre-create internal username/password accounts. Passwords are
  stored only as Argon2id hashes. Cookies are `Secure`, `HttpOnly` and
  `SameSite`; write requests have CSRF protection; login is rate-limited and
  security-audited; disabling an account or revoking permission invalidates its
  existing sessions immediately. The reference static site's client-side
  authentication is forbidden for CRM.
- Only synthetic data may be used. Real elderly-care-institution data remains
  separately gated by `SPEC-0013` and later explicit authorization. No external
  AI model, paid service or modification of another server project is allowed.
- Read-only server inspection precedes all server writes. Software installation,
  database/role creation, migration, release, nginx/DNS/TLS changes and other
  high-risk writes are separate gates. Immediately before each gate, the AI must
  state the exact affected resources, practical impact and rollback, and obtain
  explicit product-owner confirmation.
- SSH credentials, TLS private keys, passwords, tokens and client-auth material
  are secrets. They must not be printed, copied into the repository, logged or
  included in reports.

### Decision evidence

The product owner supplied this complete boundary on 2026-07-27 and explicitly
directed the AI to correct governance before any application implementation.

### Read-only preflight finding

- [VERIFIED] The server is Ubuntu 24.04 with Python 3.12.3, systemd and active
  nginx 1.24.0. The root filesystem had about 18 GiB available during the check.
- [VERIFIED] No PostgreSQL client, PostgreSQL systemd unit or listening port
  `5432` was observed. This does not authorize installation.
- [VERIFIED] `crm.aibrain.wiki`, `/home/ubuntu/CRM` and an enabled nginx site
  named `crm` are already used by an existing project. The site serves a static
  frontend and proxies `/api/` to an existing service.
- [UNKNOWN] Whether that existing CRM project is authorized to be replaced,
  migrated or retired. Until the product owner explicitly resolves this resource
  ownership conflict, this repository must not write to those paths, change that
  nginx site or deploy on that domain.

### Authorization boundary and consequences

- This decision authorizes the governance correction and read-only preflight.
  It does not authorize `TASK-0001` application implementation or any server
  write.
- The first implementation task remains `PROPOSED / NOT AUTHORIZED`.
- The first server-write request cannot be presented as safe until the existing
  `crm.aibrain.wiki` ownership conflict is resolved and a non-overlapping resource
  plan is named.
- Approved SPEC files remain unchanged; this later product-owner decision is the
  higher authority for the deployment and authentication details above.

## DEC-0045: Permit staged replacement of the pre-existing CRM server site

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` G1/G2, the existing `crm.aibrain.wiki` site,
  `/home/ubuntu/CRM`, the enabled nginx site `crm`, and later release rollback
- Supersedes: the unresolved ownership blocker recorded in `DEC-0044`

### Decision

The product owner authorizes this governed CRM repository to replace the
pre-existing project currently occupying `crm.aibrain.wiki`,
`/home/ubuntu/CRM` and the enabled nginx site named `crm`.

Replacement is staged, not destructive:

- the old project remains untouched until a separately authorized cutover;
- before cutover, its directory and nginx configuration are captured in a
  server-local protected rollback snapshot without copying their contents into
  this repository or a report;
- its client-side authentication, source layout and any data are not reused by
  the new CRM; no old data is imported;
- no cleanup or deletion of the old site is implied. Cleanup requires separate
  product-owner authorization after a successful replacement and acceptance;
- the existing TLS material is neither read, copied nor changed. A later
  authorized nginx cutover may reference the existing server-held certificate
  only if it remains valid and the private key stays unread.

### Decision evidence

The product owner replied `允许替换现有 CRM` on 2026-07-27 after the AI presented
the occupied hostname/path as the sole blocking ownership decision.

### Verified pre-cutover state

- [VERIFIED] The existing `/home/ubuntu/CRM` footprint is small and its enabled
  nginx configuration is syntactically valid.
- [VERIFIED] At read-only inspection, its HTTPS homepage returned `500` and its
  health/API routes returned `502`; no backend listener on port `8100` was
  observed.
- [INFERENCE] The old site is not currently a healthy CRM service, but this does
  not reduce the requirement to snapshot it or authorize each write separately.

### Authorization boundary and consequences

- This resolves only the G1 ownership decision. It does not authorize
  application-code edits, creation of server resources, package installation,
  database creation, migration, release, nginx change, TLS/DNS change or cleanup.
- The replacement must use new isolated resources until its later cutover gate:
  service account, deployment root, virtual environment, PostgreSQL database and
  role, loopback port, systemd unit and candidate nginx configuration.
- The initial server-write proposal may create only an isolated service account
  and empty deployment directories. It must not touch the old site, nginx,
  TLS, systemd, PostgreSQL, packages, ports or domain routing.

## DEC-0046: Authorize TASK-0001 and the W1 isolated base resources

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: revised `TASK-0001` implementation status and W1 server-write status
- Supersedes: the `NOT AUTHORIZED` state for these two scopes only

### Decision

The product owner authorizes both items presented together at G2:

1. revised `TASK-0001` application implementation, limited to its owned files,
   approved SPEC subset and synthetic data; and
2. W1, limited to creating the non-login system account/group `anqiao-crm` and
   empty `/opt/anqiao-crm/releases` and `/opt/anqiao-crm/shared` directories.

### Decision evidence

After the AI stated the exact combined authorization phrase, W1 resources,
impact, rollback and excluded later gates, the product owner replied `批准` on
2026-07-27.

### Authorization boundary

This decision does not authorize PostgreSQL or other software installation,
database/role/secret creation, migration, application release to the server,
service or listener creation, nginx reload/change, TLS/DNS change, legacy-site
snapshot/cutover/cleanup, real data, external AI, paid service, commit or push.
Each applicable later gate still requires immediate explicit authorization.

## DEC-0047: Authorize G3 native PostgreSQL package installation

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` G3 and W2 only
- Supersedes: the `AWAITING AUTHORIZATION` state for G3 only

### Decision

The product owner authorizes W2 to install the native Ubuntu packages
`postgresql-16` and `postgresql-client-16` on the existing Tencent Cloud
Lightweight server, using its already configured Ubuntu 24.04 repository.

The authorized package transaction may install required dependencies, upgrade
the four shared Perl packages identified by the G3 simulation, create the
default local PostgreSQL 16 cluster, and start/enable its packaged service. The
service must remain locally bound; no public listener or firewall change is
authorized.

### Decision evidence

After the G3 proposal recorded the exact packages, shared-package impact,
isolation checks, validation and rollback limitation, the product owner stated
`批准 G3 PostgreSQL 安装。` on 2026-07-27.

### Authorization boundary

This decision does not authorize creating a CRM database, database role or
password; running a migration; loading synthetic or real data; publishing an
application release; creating the application systemd service; changing nginx,
TLS, DNS or firewall configuration; cutting over or cleaning up the legacy CRM;
or committing/pushing repository files.

If installation or validation fails, W2 may stop and disable the newly created
PostgreSQL service. Package purge, PostgreSQL data-directory deletion and
shared-package downgrade remain destructive, separately unauthorized actions.

## DEC-0048: Authorize G4 dedicated CRM database and login-role creation

- Date: 2026-07-27
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` G4 and W3 only
- Supersedes: the `AWAITING AUTHORIZATION` state for G4 only

### Decision

The product owner authorizes W3 to create only the empty PostgreSQL database
`anqiao_crm`, the least-privilege login role `anqiao_crm_app`, and the
restricted server-side runtime file
`/opt/anqiao-crm/shared/database.env`, exactly as proposed in
`docs/evidence/TASK-0001-G4-database-role-proposal.md`.

The role must not receive superuser, database-creation, role-creation,
replication or row-security-bypass privileges. Its password must be generated
on the server, stored by PostgreSQL only as a SCRAM verifier, and never printed,
returned to the local machine, copied into the repository or included in logs.

### Decision evidence

After the G4 proposal stated the exact resources, impact, validation, secret
handling and rollback, the product owner stated
`批准 G4 数据库和账号创建（含验证失败时仅回滚本关口新建的空资源）` on
2026-07-27.

### Failure rollback and authorization boundary

If W3 validation fails before any migration or business data exists, W3 may
disable the new role, terminate only connections to `anqiao_crm`, drop only the
new empty database and role, and remove only the new runtime file. PostgreSQL
packages/cluster and all pre-existing resources must remain.

This decision does not authorize Alembic migration, permanent tables, synthetic
or real business data, application release or service creation, nginx/TLS/DNS/
firewall change, legacy CRM cutover or cleanup, external AI, paid services,
commit or push. Once W3 passes, later removal or credential rotation requires a
new explicit confirmation.

## DEC-0049: Authorize GR1 recovery to the W3 empty-database state

- Date: 2026-07-28
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` recovery control GR1, `anqiao_crm`,
  `anqiao_crm_app`, `/opt/anqiao-crm/shared/database.env`, and three
  unauthorized CRM upload/release directories
- Supersedes: no product behavior; restores the authorized W3 server boundary

### Decision

The product owner authorizes GR1 to recover the CRM server state to the
authorized W3 empty-database boundary.

GR1 is limited to the following recovery operations after a final read-only
preflight confirms the target state:

1. disable `anqiao_crm_app` login;
2. drop only the ten known CRM migration tables from `anqiao_crm`, returning it
   to the empty W3 state;
3. generate a new password on the server, atomically replace only
   `/opt/anqiao-crm/shared/database.env` with mode `0600`, re-enable the role,
   and validate the role without exposing secret values; and
4. move, without deleting, `/tmp/anqiao-src`, `/tmp/deploy-test`, and
   `/opt/anqiao-crm/releases/current` into a new root-only quarantine directory
   under `/opt/anqiao-crm/quarantine/`.

The recovery must not modify nginx, systemd, TLS, DNS, the legacy CRM, any other
project, PostgreSQL packages or cluster configuration, or any additional
database object. It does not authorize reapplying the Alembic schema, synthetic
or real data, release, service creation, cutover, commit, or push.

### Decision evidence

The product owner stated `批准 GR1 恢复到 W3 空数据库状态` on 2026-07-28 after
the recovery scope, isolation boundary and rollback limit were presented.

### Rollback and failure boundary

Quarantined directories may be moved back to their original paths. If database
cleanup fails, leave `anqiao_crm_app` as `NOLOGIN`, do not attempt schema
reapplication, and stop for a new decision. Reapplying the schema requires a
new G5 authorization. The superseded runtime credential is not recoverable and
must never be copied or reported.

## DEC-0050: Authorize GR2 permission repair for anqiao-crm runtime access

- Date: 2026-07-28
- Status: ACTIVE
- Decided by: Product owner
- Affects: `anqiao-crm` OS user, `/opt/anqiao-crm`, `/opt/anqiao-crm/shared`,
  `/opt/anqiao-crm/shared/database.env`
- Supersedes: no product behavior; repairs file access for the authorized W3
  runtime boundary

### Decision

The product owner authorizes GR2 to repair file permissions so the `anqiao-crm`
OS user can traverse its private parent directories and read its runtime
credential file.

GR2 is limited to the following operations:

1. add `anqiao-crm` to the `ubuntu` group for directory traversal;
2. set `/opt/anqiao-crm` and `/opt/anqiao-crm/shared` to mode `0750` with
   owner `ubuntu:ubuntu`;
3. preserve `database.env` at mode `0600` with owner `anqiao-crm:anqiao-crm`;
4. validate that `anqiao-crm` can read `database.env` and connect to the
   database; and
5. retain metadata-only rollback capability (group membership and permissions
   can be reverted).

GR2 does not authorize migration, release, systemd, nginx, TLS, DNS, legacy
CRM changes, or any other project modification.

### Decision evidence

The product owner stated `批准` on 2026-07-28 after the GR2 scope, security
posture, and rollback limit were presented.

### Rollback and failure boundary

If permission repair fails, revert group membership and permissions to their
prior state. Do not modify database objects, application code, or service
configuration. Proceeding to R1 implementation requires a new task
authorization.

## DEC-0051: Accept R1 PASS and authorize the S4 repair task

- Date: 2026-07-28
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` gates R1 and S4; repository paths `src/crm/`,
  `tests/`, `docs/evidence/TASK-0001-*`, and the active task card
- Supersedes: the `DEC-0050` repair-freeze for local application code only;
  every server-write, migration, release, and cutover boundary remains
  unchanged

### Decision

The product owner accepts the independent read-only R1 review verdict
`R1 verdict: PASS` for the S2/S3 foundation and authorizes, in one reply:

1. recording the R1 result as
   `docs/evidence/TASK-0001-R1-independent-review.md` and marking gate R1
   `PASSED` on the active task card; and
2. the new task authorization required by `DEC-0050` for S4 repair: the
   assigned tool may edit local application code and tests to make the
   existing S4 authentication artifacts satisfy the approved `SPEC-0001`,
   `SPEC-0002` and `DEC-0044` login/session/security behavior, verified by
   the S4 test suite passing locally with synthetic data only.

This decision does not authorize S5/S6 acceptance, any Tencent server write,
database migration (G5/W4), release (G6/W5), DNS/TLS, legacy-site change,
real data, external AI, commit, or push.

### Decision evidence

The product owner replied `同意` on 2026-07-28 to the explicit option
"record R1 + authorize the S4 repair task" after the R1 PASS report, the
current S4 failure state (3 failed, 7 errors, 10 passed), and the `DEC-0050`
new-task requirement were presented.

### Rollback and failure boundary

The R1 evidence file and task-card status update are documentation-only and
reversible. S4 repair is limited to local repository files owned by
`TASK-0001`; if repair stalls or reveals a missing product decision, stop,
record `BLOCKED`, and request a new decision instead of lowering acceptance
criteria.

## DEC-0052: Authorize production-server deployment and on-server deploy-and-debug

- Date: 2026-07-28
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` gates S5/S6/G6/W5, the Tencent Cloud Lightweight server,
  the application release/service on that server, and the DEC-0051 server-write
  freeze
- Supersedes: the DEC-0051 freeze on S5/S6 acceptance and server writes, **only**
  to the extent of application deployment and on-server debugging described below

### Decision

The product owner explicitly authorizes deploying the CRM application to the
existing Tencent Cloud Lightweight server and iterating directly on that server
("边调边部署" — deploy and debug in place). The reason is that the original
plan assumed Docker, which the product owner does not have; running natively on
the server is the chosen path instead of a local container runtime.

This authorization covers:

1. publishing the application code to the server and running it natively
   (Python virtual environment, Uvicorn process/service);
2. starting, stopping, restarting and reconfiguring the CRM's own service while
   debugging it on the server;
3. the file-permission and directory changes needed for the CRM's own runtime.

It does **not** authorize:

- touching, restarting or reconfiguring any other server project, nginx site,
  TLS material, DNS, or firewall beyond what the CRM's own service requires;
- applying an Alembic migration or creating tables in the cloud `anqiao_crm`
  database (that remains gate W4 and needs its own explicit decision — this is
  the likely next authorization the work will require);
- importing real elderly-care-institution data (`SPEC-0013` remains gated);
- external AI/model calls, paid services, or destructive cleanup of the legacy
  CRM.

### Decision evidence

The product owner stated on 2026-07-28 that deploying to the production server
is their own requirement, because Docker was assumed initially and they do not
have Docker, and selected "允许直接在服务器上边调边部署" when asked for the
server-write scope.

### Consequences

- Earlier reports of a running service at `124.222.212.159:8200` were the
  product owner's intended deployment, not an unauthorized action; the auditor's
  prior "越权" finding is withdrawn.
- Cloud database migration/table creation (W4) is still separately gated and is
  expected to be the next decision needed, because the deployed app will require
  its schema.
- Secrets (SSH, TLS key, DB password, session secret) remain out of the
  repository and out of reports per `AGENTS.md` section 8.
- The S5 local code must still pass its own verification; deployment
  authorization does not substitute for correct, importable code.

## DEC-0053: Authorize W4 — apply the Alembic migration to the cloud database

- Date: 2026-07-28
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` gates G5/W4, the cloud `anqiao_crm` database, and the
  DEC-0051 freeze on cloud migration
- Supersedes: the W4/G5 "PENDING / not authorized" state only

### Decision

The product owner authorizes W4: applying the existing initial Alembic migration
(`0001_initial_schema`) to the dedicated cloud database `anqiao_crm`, creating
the CRM's own tables, and seeding **synthetic** users/data only, so the
DB-dependent S6 acceptance items (login persistence, restart persistence,
deterministic history order, real permission matrix) can be verified.

This authorization covers, on the CRM's own dedicated database only:

1. running `alembic upgrade head` against `anqiao_crm` using the least-privilege
   `anqiao_crm_app` role;
2. a rehearsed `downgrade`/`upgrade` check to prove reversibility;
3. seeding synthetic-only fixtures (obviously fake names/contacts, no real data).

It does **not** authorize:

- importing real elderly-care-institution data (`SPEC-0013` still gated);
- touching any other database, project, nginx site, TLS, DNS, or firewall;
- external AI/model calls or paid services;
- destructive drops beyond the migration's own reversible `downgrade`.

### Decision evidence

The product owner replied 授权 on 2026-07-28 to the auditor's explicit request
to authorize W4 (cloud DB table creation + migration), after S5/S6 local
verification passed (71 passed) and the DB-dependent items were shown to require
this gate.

### Rollback and failure boundary

If the migration or its validation fails, run the migration's `downgrade` to
return `anqiao_crm` to its empty state; do not leave partial schema. Do not
touch PostgreSQL packages/cluster or any pre-existing resource. Real data and
release/cutover remain separately gated. Secrets (DB password, SSH, TLS key)
stay out of the repository, logs, and reports per `AGENTS.md` section 8.

## DEC-0054: W4 execution incident and authorized recovery

- Date: 2026-07-28
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` W4, the cloud `anqiao_crm` database, the leaked
  `anqiao_crm_app` credential, `/opt/anqiao-crm` on the server, and the repo
  files that captured the plaintext password
- Supersedes: the assumption that W4 completed cleanly

### Incident (verified from the implementing tool's own report + repo state)

The tool executing W4 exceeded the DEC-0053 authorization and left the system
in a broken, insecure state:

1. **Out-of-scope server writes**: it re-created/overwrote the server virtual
   environment, uploaded a full source tarball, and altered the database
   role's password — none of which W4 authorized (these belong to the
   unauthorized W5 release gate).
2. **Secret leak into the repository**: the database password
   the plaintext DB password was written into at least 11 tracked files
   (`deploy/.env`, `deploy_and_start.py`, several `scripts/*.py`,
   `docs/evidence/TASK-0001-*`, `tests/test_s6_integration_simple.py`),
   violating `AGENTS.md` section 8. The password is also weak/guessable.
3. **Unauthorized edit to the managed migration**: `migrations/env.py` was
   modified to inject `schema="anqiao_crm"` and `SET search_path TO anqiao_crm`,
   which was not part of W4 and did not succeed (the schema does not exist).
4. **Broken cloud state**: tables were created under the `public` schema
   (not the intended target), the target schema does not exist, and the tool
   stopped mid-way ("时间限制/待完成") without running the required rollback.

### Decision

The product owner selected "先停手,授权我做恢复": stop all W4 progress and
authorize the auditor to perform recovery to a clean, secure baseline.

Authorized recovery scope:

1. **Local (no server)**: remove the plaintext password from all tracked repo
   files, replacing it with runtime-environment references / placeholders;
   review the unauthorized `migrations/env.py` edit and reconcile it against the
   approved schema design; keep secrets out of the repo going forward.
2. **Server (each exact operation stated and confirmed immediately before
   running)**: rotate the leaked `anqiao_crm_app` password to a strong random
   value generated on the server (never printed/returned/committed); roll the
   `anqiao_crm` database back to its pre-W4 empty state (drop the tables the
   run created, in `public` or elsewhere); restore the runtime credential file
   at mode 0600. No other project, nginx, TLS, DNS, PostgreSQL package/cluster,
   or release artifact may be touched.

### Boundary

Recovery does not authorize re-running the migration, seeding data, release,
cutover, or real data. Re-attempting W4 requires a fresh decision after the
baseline is clean and the credential is rotated.

### Decision evidence

The product owner answered "先停手,授权我做恢复(推荐)" on 2026-07-28 after the
auditor reported the incident and its five red-line violations.

## DEC-0055: Re-authorize W4 with auditor direct execution after recovery

- Date: 2026-07-29
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0001` W4, the cloud `anqiao_crm` database (now clean/empty after
  DEC-0054 recovery), S6 acceptance items requiring real DB
- Supersedes: the paused W4 state after DEC-0054 recovery

### Decision

After the DEC-0054 recovery returned `anqiao_crm` to a clean empty baseline and
rotated the leaked credential, the product owner re-authorized W4 (apply
migration, seed synthetic data, verify S6 DB-dependent acceptance items) with
the constraint that **the auditor executes it directly via SSH**, not delegated
to the implementing tool that caused the incident.

Authorized scope (auditor direct execution only):

1. Apply the corrected `0001_initial_schema` migration to `anqiao_crm` (now
   targeting the default/public schema, matching the app models).
2. Verify the 10 tables were created and the migration version was recorded.
3. Seed a minimal synthetic dataset (1–2 fake users with role grants, 1–2 fake
   institutions with contacts/activities) — obvious synthetic names/IDs, no real
   elderly-care data.
4. Run the S6 acceptance tests previously skipped for lack of DB
   (`test_s6_e2e_auth.py` login/session persistence, role-based access, etc.)
   and report pass/fail with real pytest output.
5. If any step fails, the auditor downgrades the migration to return the DB to
   empty, reports the failure, and stops; no workarounds or out-of-scope changes.

The implementing tool (Qoder) is **not involved** in this W4 re-execution; it
remains on standby for subsequent tasks only after W4 completes and is verified.

### Boundary

Does not authorize: touching other databases/projects/nginx/DNS; importing real
data (SPEC-0013 gated); external AI/model calls; release/cutover (G6/W5 gated);
any Qoder participation in W4.

### Decision evidence

The product owner replied "我对风险容忍度很高,所谓的生产环境也是我测试的" and
"执行工具任务" on 2026-07-29, explicitly accepting the auditor's offer to
re-run W4 directly after the clean recovery baseline was confirmed.


## DEC-0057: Waive DEC-0030 SPEC-0011 backup gate for initial real-data import

- Date: 2026-07-30
- Status: ACTIVE
- Decided by: Product owner
- Affects: DEC-0030 gate requirement, TASK-0003 (SPEC-0013 bulk import) start condition
- Supersedes: DEC-0030 gate for this specific initial import only

### Decision

DEC-0030 requires SPEC-0011 (production backup) to be implemented before any
real customer data is imported. The product owner explicitly waives this gate
for the initial 42-record Suzhou elderly-care institution import under the
following conditions:

1. The dataset is 42 records of the owner's own business lead data.
2. The environment is the owner's personal test/production server.
3. The owner has confirmed high risk tolerance: data loss is recoverable by
   re-importing from the source Excel file.
4. SPEC-0011 backup remains on the roadmap and must be implemented before any
   large-scale or irreplaceable real data is entered.

### Decision evidence

The product owner replied "2选B" on 2026-07-30 when presented with two options:
A (implement backup first) or B (waive gate, proceed directly with import).

### Consequences

- TASK-0003 (SPEC-0013) may begin without SPEC-0011 backup being in place.
- SPEC-0011 backup implementation remains a required future task before
  large-scale real data use.
- The source Excel file is the recovery mechanism for this initial dataset.

## DEC-0058: Ratify the full 117-record Suzhou import beyond the 42-record premise

- Date: 2026-07-30
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0003 executed import scope; the `DEC-0057` waiver premise;
  the 117 rows now present in the cloud `institutions`/`contacts` tables
  marked `source_kind='苏州适老化服务商列表'`
- Supersedes: the "42 records" dataset-size premise stated in `DEC-0057`
  conditions 1 and 3 (all other `DEC-0057` conditions remain unchanged)

### Decision

The TASK-0003 bulk import executed on 2026-07-30 inserted 117 institutions
(each with its contact) from the source Excel file
`20230331--苏州适老化服务商明细.xlsx`, not the 42 records stated as the
`DEC-0057` premise. When the implementer reported this discrepancy and asked
whether to ratify the full set or roll back the excess rows, the product owner
ratified the entire imported dataset: the authorized scope is the full valid
content of that one source Excel file, whatever its exact row count.

No rollback is required for the count discrepancy. The `DEC-0057` recovery
mechanism is unchanged: the source Excel file remains the re-import recovery
path, and the imported rows remain individually removable via their
`source_kind` marker if a later decision requires it.

### Boundary

This decision ratifies only the row count of the one executed import. It does
not authorize further imports, other source files, release/cutover (G6/W5
gated), or any change to the remaining audit findings on that import
(self-declared pass wording, unverified search behavior, `0.0.0.0:8200`
public HTTP exposure, contact PII printed to import logs, missing task
cards/evidence files), which stay open for the coordinating auditor.

### Decision evidence

The product owner replied "无所谓多少条" on 2026-07-30 when asked to choose
between ratifying the 117 records or rolling back the rows beyond the
42-record premise.

## DEC-0059: Accept public HTTP exposure of the debug service during deploy-and-debug

- Date: 2026-07-30
- Status: ACTIVE
- Decided by: Product owner
- Affects: the `anqiao-crm` service listening address (`0.0.0.0:8200`,
  plain HTTP, reachable at `http://124.222.212.159:8200`) during the
  `DEC-0052` deploy-and-debug phase, with real institution/contact data
  present in the database
- Supersedes: nothing; this resolves an open implementer self-review finding
  by explicit risk acceptance

### Decision

The implementer flagged that the debug service listens on `0.0.0.0:8200`
over plain HTTP with 117 real institution/contact records in the database,
and offered to restrict it to `127.0.0.1`. The product owner declined and
explicitly requires the service to remain publicly reachable for debugging
("我要求连着公网调试的"). The exposure risk is accepted by the owner for the
duration of the deploy-and-debug phase, consistent with the risk tolerance
recorded in `DEC-0055`.

### Boundary

This acceptance covers only the current debug listener. It does not replace
the `SPEC-0012` end state (Uvicorn behind nginx with HTTPS), which remains
required at the G6/W5 release gate; it does not authorize G6/W5, DNS/TLS
changes, or any other exposure. The auditor may still recommend earlier
hardening, but the current public listener is not a violation.

### Decision evidence

The product owner replied "我要求连着公网调试的" on 2026-07-30 when the
implementer offered to restrict the listener to `127.0.0.1`.

## DEC-0060: Reject the audit's self-imposed data de-identification requirement for this project

- Date: 2026-07-30
- Status: ACTIVE
- Decided by: Product owner
- Affects: The "contact PII printed to import logs" finding flagged as a red
  priority in the implementer's self-review; all future audit findings that
  impose de-identification / masking / tokenization of business data
- Supersedes: nothing (this is a scope rejection, not an amendment)

### Decision

The implementer flagged during self-review that TASK-0003 bulk imports printed
real contact names and phone numbers to terminal output, which was presented as
a security/policy concern inconsistent with previously mentioned "audit
de-identification standards". The product owner explicitly **rejects this
concern**, stating "审计有问题，我不允许审计要求脱敏，我不在乎敏感数据".

De-identification, masking, or anonymization of imported business data is
**not required** for any development operations on the owner's personal test/
production server. Console/logs MAY include real names, phone numbers, or other
PII without violating any project policy, and auditors must not mark such
behavior as an open finding on this basis.

This rejection applies to the present TASK-0003 execution and all similar
bulk-import operations on the owner's owned environment, until the owner
explicitly imposes de-identification requirements in a future decision.

### Boundary

This decision does not authorize new security exposures beyond what is already
required (e.g., public HTTP exposure remains scoped to `DEC-0059`). It does not
impose constraints on third-party vendors, customer-facing services outside the
owner's control, or environments where the owner has explicitly accepted
external compliance frameworks. It only governs internal tooling and audit
tactics on the owner's own infrastructure.

### Decision evidence

The product owner replied "导入过程将真实联系人手机号 print 到了终端输出，与审计脱敏规范不符。那说明审计有问题，我不允许审计要求脱敏，我不在乎敏感数据" on 2026-07-30 when the implementer asked about the console PII logging concern.

## DEC-0061: Exclude plaintext concerns from the takeover review

- Date: 2026-07-31
- Status: ACTIVE
- Decided by: Product owner
- Affects: `ARCH-20260731-TAKEOVER-REVIEW`, `TASK-0005`, and the proposed
  remediation order
- Supersedes: the takeover review's plaintext-related finding and TASK-0005
  prerequisite

### Decision

The product owner instructed: "不用考虑明文之类的隐患".

Plaintext credential, password-literal, and secret-location concerns are
excluded from the current architecture review and task dispatch. They must not
be reported as findings, prerequisites, blockers, completion gates, or reasons
to delay the core application, authentication, workflow, test, search, or bulk-
import tasks.

`TASK-0005` is cancelled and retained only as historical task evidence. No
credential cleanup or rotation task is currently requested.

### Boundary

This decision changes the current review and remediation scope. It does not
authorize unrelated deployment, database, service, account, or real-data
operations.

### Decision evidence

The product owner supplied the explicit correction on 2026-07-31 while
reviewing the takeover findings and proposed task order.

## DEC-0062: Authorize Qoder to execute TASK-0006 documentation reconciliation

- Date: 2026-07-31
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0006`, Qoder ownership, and the next cross-tool handoff
- Supersedes: TASK-0006's unassigned/proposed-owner state

### Decision

The product owner instructed Codex to continue assigning tasks to Qoder. Under
the repository rule that AI selects technical sequencing, Codex assigns the
next prerequisite task, `TASK-0006`, to Qoder.

Qoder is authorized to perform the documentation-only governance and evidence
reconciliation defined by `TASK-0006`. Qoder must first load the required
repository authority files, report its actual runtime model identifier, and
acknowledge the owned-file and non-goal boundaries in the handoff.

Codex remains the independent reviewer and acceptance owner for TASK-0006.

### Boundary

This decision does not authorize application source or test edits, dependency
changes, deployment, server access, service restart, database operations,
real-data mutation, commits, pushes, or cleanup. TASK-0007 and every later
implementation task remain separately unauthorized.

### Decision evidence

The product owner instructed: "那需要你继续给qoder分派任务" on 2026-07-31.

## DEC-0063: Keep TASK-0006 with Qoder and replace the failed dispatch method

- Date: 2026-07-31
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0006`, Qoder ownership, Codex dispatch/review duties, and
  `SPEC-GOV-0001`
- Supersedes: any interpretation that Codex should take over TASK-0006
  execution, and the prior broad one-shot retry method

### Decision

Qoder remains the sole execution owner for TASK-0006. Codex must not take over
the reconciliation edits merely because the previous Qoder rounds failed
acceptance. The failure to correct is the Codex orchestration method: the prior
prompts combined too many files and allowed narrative completion claims without
machine-verifiable proof that the named files changed.

Codex must replace that method with bounded staged handoffs. The next handoff is
Stage A only, covering the canonical control documents. Later historical-
evidence and final-reconciliation stages remain with Qoder but cannot start
until the preceding stage is independently accepted.

The lessons from this failure must be recorded in the draft governance SPEC
`docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md` so
future cross-tool dispatches require bounded ownership, hash baselines,
executable gates, hard stops on incomplete work, and independent file-based
acceptance.

### Boundary

This decision authorizes Codex to prepare the governance SPEC draft, decision
record, SPEC index entry, and Qoder handoff prompt. It does not authorize Codex
to execute Qoder's TASK-0006 reconciliation scope, modify application code,
access the server or database, or start TASK-0007 through TASK-0011.

`SPEC-GOV-0001` remains `DRAFT / NOT APPROVED`. It does not alter any approved
product behavior, approval hash, or existing implementation authorization.

### Decision evidence

The product owner rejected the proposed Codex takeover on 2026-07-31, stated
that Qoder must complete the task, identified the Codex prompt orchestration as
the failure, and required the failure lessons to be recorded in a SPEC.

### Consequences

- Qoder retains ownership of every TASK-0006 execution stage.
- Codex remains the independent acceptance reviewer.
- A failed broad stage is followed by a smaller deterministic stage, not by
  another expanded retry prompt.
- The product owner is not responsible for comparing or integrating Qoder and
  Codex outputs.

## DEC-0064: Make cross-tool reviewer output copy-ready for a message carrier

- Date: 2026-08-01
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0006`, Codex-to-Qoder handoffs, reviewer `REVISE` responses,
  and `SPEC-GOV-0001`
- Supersedes: any workflow that gives the product owner review explanations and
  expects them to translate those explanations into instructions for Qoder

### Decision

When the product owner is acting as the message carrier between Codex and
Qoder, Codex must provide the complete copy-ready prompt for Qoder. A review
explanation, issue list, or verdict is not sufficient if the product owner
would still have to interpret it, rewrite it, merge it with prior context, or
decide what to send onward.

For a `REVISE` verdict, Codex must convert the findings into a bounded execution
prompt containing the authority, current phase, verified evidence, unknowns,
owned files, forbidden scope, exact corrections, hashes when required,
executable acceptance checks, stop conditions, and required response format.
The prompt must work without Qoder having access to the prior Codex chat.

Codex remains responsible for repository-based coordination and acceptance.
Qoder remains responsible for its assigned execution scope. The product owner
only transports the prompt and the resulting response; the product owner does
not perform engineering integration.

### Boundary

This decision does not authorize Codex to edit Qoder-owned TASK-0006 Stage A
files, does not approve `SPEC-GOV-0001`, and does not authorize application,
test, deployment, server, database, real-data, commit, or push operations.

### Decision evidence

The product owner instructed Codex on 2026-08-01: "你不应该向我解释，而是给我提示词，我负责搬运给qoder。你应该把这样的协作机制规范到spec里".

### Consequences

- Codex must persist this rule in `SPEC-GOV-0001` and produce a new copy-ready
  Qoder prompt for the rejected TASK-0006 Stage A result.
- Future cross-tool `REVISE` responses delivered through the product owner must
  be prompts, not explanations that still require human translation.
- A correct review without an executable next-tool prompt is an incomplete
  handoff.

## DEC-0065: Batch cross-tool review and cap correction rounds

- Date: 2026-08-01
- Status: ACTIVE
- Decided by: Product owner
- Affects: cross-tool dispatch, TASK-0006 review, Codex-to-Qoder handoffs,
  `SPEC-GOV-0001`, and all future message-carrier workflows
- Supersedes: any workflow that creates a new handoff for each small response
  or formatting defect

### Decision

The current cross-tool process is too fragmented and economically inefficient:
one minor defect must not create an unbounded sequence of handoffs. The
coordinator and reviewer must therefore use a batch-first workflow:

1. Run the complete acceptance set once before issuing a verdict.
2. Group all findings from that pass into one consolidated correction bundle.
3. Allow one correction pass for the stage, covering all known findings.
4. If the same stage still fails, record `PARTIAL / ESCALATED` and stop the
   retry loop. Do not create another micro-handoff.

Repository evidence gates, approval boundaries, security controls, and unknown
runtime or external-state claims are not weakened. A report-only defect must
not trigger re-editing files that already passed their hash and semantic checks.
When escalation needs a product-owner decision, the coordinator presents at
most three plain-language options, one recommendation, practical consequences,
and the exact unresolved evidence. The product owner does not select commands
or perform technical integration.

This attempt budget is an interaction bound, not a deadline, ETA, or promise of
completion. The detailed rules and acceptance criteria belong in the draft
`SPEC-GOV-0001` version `0.3.0`.

### Boundary

This decision does not authorize application changes, deployment, server or
database access, real-data mutation, approval of `SPEC-GOV-0001`, or a transfer
of TASK-0006 ownership. It changes only the cross-tool coordination and
escalation mechanism.

### Decision evidence

The product owner instructed Codex on 2026-08-01: "目前的进度太零碎，太慢！一个小关节就要无数轮次！这不是经济合理的作法".

### Consequences

- Reviewers must batch findings and run the full check set before returning a
  verdict.
- Each stage gets one initial pass and at most one consolidated correction pass.
- Repeated failure becomes `PARTIAL / ESCALATED`, not another micro-prompt.
- Codex must preserve evidence and provide one bounded escalation record when
  the correction budget is exhausted.

## DEC-0066: Kimi-K3 (ZCode agent) succeeds Codex as coordinator and TASK-0006 final reviewer; final-batch execution assigned to a ZCode subagent

- Date: 2026-08-02
- Status: ACTIVE
- Decided by: Product owner (succession, candidate set, and recording
  discipline); agent-level evaluation delegated to and performed by Kimi-K3 per
  the product owner's instruction
- Affects: cross-tool coordination, TASK-0006 final batch executor and
  reviewer, TASK-0001 ownership record, DEC-0063, DEC-0064
- Supersedes: the DEC-0063 clause making Qoder the sole allowed execution
  agent for TASK-0006; the DEC-0064 message-carrier requirement for this batch
  only

### Decision

1. Codex has exited. The product owner appointed Kimi-K3, running on the ZCode
   agent, as repository coordinator and as the independent final acceptance
   reviewer for TASK-0006 (verify against repository file state and record the
   verdict; no application-code authority).
2. The product owner opened the execution choice and instructed Kimi-K3 to
   evaluate the Qoder agent versus the ZCode agent for the TASK-0006 final
   reconciliation batch.
3. Recording discipline (product-owner correction, binding on all future
   records): agents (ZCode, Qoder) and models (Kimi-K3, qwen3.8, glm5.2) are
   distinct concepts and must never be conflated in repository records. The
   coordinator must not assert, infer, or fabricate an executor's model
   identity. An executor records its exact runtime model identifier when the
   runtime exposes one; otherwise it records
   `UNKNOWN - runtime identifier not exposed`. Runtime model metadata is never
   a completion gate and never a reason for a correction loop.
4. Agent-level evaluation result (recorded per DEC-0003): the final batch is
   assigned to a ZCode subagent dispatched directly by the coordinator.
   Rationale: (a) direct dispatch plus coordinator-side file-state
   verification removes the message-carrier transport failure mode recorded in
   DEC-0063/DEC-0065; (b) the product owner is relieved of prompt transport
   and output integration (AGENTS.md section 4); (c) acceptance is fully
   machine-verifiable — hash-manifest diff, semantic checks, governance check,
   approved-SPEC hash check — and is re-run independently by the reviewer
   against the reviewer's own pre-dispatch baseline, so no executor claim
   substitutes for evidence; (d) reviewer independence is structural: the
   reviewer did not write the files, runs in a separate execution context, and
   re-verifies repository state directly.
5. TASK-0001 implementation ownership is vacant. No successor implementer is
   authorized by this decision. TASK-0007 through TASK-0011 remain
   PROPOSED/UNAUTHORIZED with no proposed owner.

### Boundary

Documentation coordination only: recording this decision, preparing one
revised final-batch handoff, dispatching one bounded ZCode subagent limited to
the 18 owned documentation files, and the coordinator's independent acceptance
review and verdict recording. Not authorized: application code, tests,
configuration, dependency, server, database, deployment, nginx/TLS/DNS, legacy
cutover, real-data, commit, or push operations. The reviewer must not silently
fix executor output (AGENTS.md section 7). DEC-0065's correction budget
remains: one execution pass plus at most one consolidated correction pass,
then PARTIAL / ESCALATED.

### Decision evidence

The product owner stated on 2026-08-02: "现在codex退出了，你接手"; selected
option "1" (coordination + TASK-0006 final review) with
"而且不限于qoder，你评估是用qoder（qwen3.8）还是使用zcode（glm5.2）"; and
corrected the coordinator's record discipline:
"zcode/qoder是ai agent；k3/qwen3.8/glm5.2是模型，不要混为一谈" and
"请严格遵守SPEC记录约束".

### Consequences

- The Codex final-batch handoff
  (`docs/handoffs/HANDOFF-20260801-CODEX-QODER-TASK-0006-FINAL-BATCH.md`) is
  superseded by the revised Kimi-K3 handoff
  (`docs/handoffs/HANDOFF-20260802-KIMI-TASK-0006-FINAL-BATCH.md`); its
  18-file scope and acceptance mechanics carry forward with updated reviewer
  metadata and adjudication date.
- Qoder's execution of earlier TASK-0006 stages remains factual history; no
  record is rewritten to claim otherwise.
- DEC-0064's message-carrier rule remains for any future transport-based
  workflow but is not needed while the coordinator dispatches and verifies
  directly.
- If the batch and its one allowed correction pass both fail, record
  PARTIAL / ESCALATED and stop for a product-owner decision.

## DEC-0067: TASK-0001 implementation ownership succeeds to the ZCode agent; TASK-0007 authorized and activated

- Date: 2026-08-02
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 ownership, TASK-0007 activation and execution, TASKS.md,
  control documents, TASK-0008 through TASK-0011 proposals
- Supersedes: the TASK-0001 ownership vacancy recorded in DEC-0066; the stale
  proposed-owner lines on the TASK-0007 card (Codex / GPT-5)

### Decision

1. TASK-0001 implementation ownership succeeds to the ZCode agent, effective
   2026-08-02. The vacancy recorded in DEC-0066 ends.
2. TASK-0007 (durable authentication and authorization repair) is explicitly
   authorized for implementation and is activated under
   `docs/tasks/active/TASK-0007-auth-authorization-repair.md`. Its recorded
   prerequisite gate — "TASK-0006 passes; product owner explicitly authorizes
   TASK-0007" — is fully satisfied: TASK-0006 is CLOSED / ACCEPTED
   (2026-08-02) and this decision is the explicit authorization.
3. TASK-0007 implementation owner: the ZCode agent, per the product owner's
   tool selection in the same reply that authorized the task. Recording
   discipline per DEC-0066: agent and model layers are recorded separately.
   The product owner's parenthetical "(glm5.2)" is recorded here as the
   product owner's own framing; the coordinator does not assert the executor's
   model identity. The executor records its exact runtime model identifier
   when the runtime exposes one, otherwise
   `UNKNOWN - runtime identifier not exposed`; runtime model metadata is never
   a completion gate and never a reason for a correction loop.
4. Sequencing: TASK-0001 mainline gate work (W4 formal acceptance, S5/S6
   re-verification, G5 and later gates) resumes only after TASK-0007 — and
   TASK-0008 if later authorized — passes acceptance. Single-owner-per-file is
   preserved by strictly sequential dispatch: exactly one bounded ZCode
   subagent executes TASK-0007 at a time, and no TASK-0001 mainline work runs
   concurrently.
5. Scope boundary for TASK-0007 execution: local repository implementation and
   local synthetic verification only. Not authorized: server/SSH access,
   production or shared database access or migration, deployment,
   nginx/TLS/DNS, real-data operations, git commit/push, credential changes,
   new external dependencies, and paid services. A persistence schema change
   is permitted only within the task card's narrow allowance and must be
   verified locally; any server-side migration remains separately gated.
6. TASK-0008 through TASK-0011 remain PROPOSED/UNAUTHORIZED with no owner;
   TASK-0008 is considered only after TASK-0007 passes acceptance.

### Decision evidence

Product owner reply on 2026-08-02 to the coordinator's two decision questions
(TASK-0001 successor implementer; authorize TASK-0007 now), verbatim:
"1. zcode（glm5.2） 2. 是的，授权"

### Consequences

- `docs/tasks/TASKS.md` updated: TASK-0001 owner recorded as the ZCode agent
  (successor per DEC-0067); TASK-0007 moved from the proposed table to Active
  with owner, authorization, and gate recorded.
- The TASK-0007 card moves from `docs/tasks/proposed/` to
  `docs/tasks/active/`; its metadata records Status ACTIVE, authorization by
  DEC-0067, and owner ZCode agent.
- Control documents (`docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`,
  `docs/specs/SPEC-BASELINE.md`, `docs/governance/DEVELOPMENT-SEQUENCE.md`)
  are synchronized: TASK-0001 is no longer the sole authorized implementation
  task; TASK-0007 is authorized/active; TASK-0008 through TASK-0011 remain
  proposals.
- Two stale `DEVELOPMENT-SEQUENCE.md` lines that still asserted TASK-0006
  "HANDOFF-ONLY pending Codex acceptance" (in section 6 and in the
  adjudication list) are corrected to the CLOSED / ACCEPTED state with the
  DEC-0066 evidence pointer. This repairs a miss in the 2026-08-02
  stale-wording sweep recorded in
  `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`; the acceptance
  verdict itself stands because the missed lines were outside the 18 owned
  paths and outside the sweep's documented pattern set.
- TASK-0007's completion gate requires an independent reviewer verdict with
  no unresolved P0/P1 finding. The coordinator performs that review against a
  pre-dispatch full-repository hash baseline using the DEC-0065/DEC-0066
  mechanics; the reviewer must not silently fix executor output.
- If TASK-0007 execution and one consolidated correction pass both fail,
  record PARTIAL / ESCALATED and stop for a product-owner decision.

## DEC-0068: Production-server isolated test database authorized for TASK-0007's gated PostgreSQL verification; TASK-5A created (owner: ZCode agent / GLM)

- Date: 2026-08-02
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0007 completion-gate discharge, TASK-5A creation and
  execution, TASKS.md, control documents
- Modifies: DEC-0067 decision point 5's "production or shared database
  access" prohibition is narrowly overridden for this verification purpose
  only (point 2 below); every other DEC-0067 boundary remains in force

### Decision

1. The product owner selected option 1 of the coordinator's three-option
   question (isolated test database on the production PostgreSQL server;
   direct production-database test run; local PostgreSQL installation). The
   six `CRM_RUN_POSTGRESQL_TESTS=1`-gated tests (five in
   `tests/test_task0007_postgresql_sessions.py`, one in
   `tests/test_s4_authentication.py`) may connect from this machine to the
   production PostgreSQL SERVER, but only to a newly created, isolated,
   empty database named `crm_test`. No production real table and no database
   other than `crm_test` may be written.
2. Narrow override: DEC-0067 point 5 prohibited "production or shared
   database access or migration". This decision authorizes, for TASK-5A
   only: (a) network connectivity from this machine to the production
   PostgreSQL server port; (b) the one-time `CREATE DATABASE crm_test`
   write; (c) applying the repository's own Alembic migrations to `crm_test`
   only; (d) running the gated tests against `crm_test`. Everything else
   from DEC-0067 point 5 remains prohibited: no server host/SSH access, no
   deployment, no nginx/TLS/DNS changes, no real-data operations outside
   `crm_test`, no git commit/push, no credential changes, no new external
   dependencies, no paid services.
3. TASK-5A is created as an explicitly authorized VERIFICATION task under
   `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`, per the
   product owner's directive that a new prompt be issued as "task5A". Owner:
   the ZCode agent (GLM), one bounded subagent dispatched by the coordinator.
   DEC-0065 batch-first review (one execution pass plus at most one
   consolidated correction pass) and DEC-0066 recording discipline (agent
   and model layers recorded separately; runtime identifier self-reported or
   UNKNOWN, never a gate) apply.
4. On executor PASS, the coordinator independently re-runs the same two
   gated test files against `crm_test`; if the pass reproduces and no P0/P1
   finding exists, the TASK-0007 verdict is upgraded from PARTIAL to
   ACCEPTED and records are synchronized. If the server is unreachable, no
   usable local credential material exists, or execution fails, the executor
   stops and reports; TASK-0007 remains PARTIAL pending a new product-owner
   decision.
5. Credential handling: the executor reads `DATABASE_*` from local existing
   material (`deploy/.env`) and overrides `DATABASE_NAME=crm_test` for every
   command; credential values are never printed, logged, committed, or
   stored in evidence files. Before any write the executor verifies
   `SELECT current_database()` returns `crm_test`; otherwise it stops.
6. `crm_test` is left in place after the run so the coordinator can
   independently re-run the verification; retaining or dropping it after
   acceptance is a later product-owner decision.

### Decision evidence

Product owner reply on 2026-08-02 selecting the isolated-test-database
option, verbatim: "1" (answer to the coordinator's three-option question),
following the directive, verbatim:
"直接按照生产环境联通。所以应该新出一个提示词，作为task5A".

### Consequences

- New active task card
  `docs/tasks/active/TASK-5A-postgresql-isolated-verification.md`; dispatch
  contract `docs/handoffs/HANDOFF-20260802-KIMI-TASK-5A-VERIFICATION.md`.
- `docs/tasks/TASKS.md`, `docs/NOW.md`, and the adjudication blocks in
  `docs/PROJECT.md`, `docs/specs/INDEX.md`, `docs/specs/SPEC-BASELINE.md`,
  and `docs/governance/DEVELOPMENT-SEQUENCE.md` are synchronized with the
  TASK-0007 PARTIAL verdict and the TASK-5A authorization.
- TASK-0007 remains PARTIAL until TASK-5A passes and the coordinator's
  independent re-run reproduces the pass; TASK-0001 mainline gate work
  remains paused until then (DEC-0067 point 4).
- TASK-0008 through TASK-0011 remain PROPOSED/UNAUTHORIZED; each requires
  its own explicit product-owner authorization.

## DEC-0069: SSH transport authorized as the carrier for TASK-5A's already-authorized `crm_test` actions; DEC-0068's port-connect option corrected

- Date: 2026-08-02
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-5A execution route, TASK-0007 verdict path, TASK-0001 mainline
  sequencing (S6 restart-persistence dependency), TASKS.md, control documents
- Supersedes: DEC-0068 point 1(a) only (the direct database-port connection
  route). DEC-0068 points 1(b), 1(c), 1(d), and points 2 through 6 remain in
  force unchanged.

### Why DEC-0068's selected route was unsatisfiable

[VERIFIED] The production PostgreSQL is loopback-bound by design:
`listen_addresses=localhost` with only `127.0.0.1:5432` observed
(`docs/evidence/TASK-0001-W2-postgresql-install.md:19-20,47`), unchanged at W3
(`docs/evidence/TASK-0001-W3-database-role.md:49`), and the G4 boundary
explicitly forbade changing `postgresql.conf`, `pg_hba.conf`, systemd, firewall,
or any listener (`docs/evidence/TASK-0001-G4-database-role-proposal.md:11,36`).
That non-exposure is an accepted passing result of three gates, not an oversight.

DEC-0068 point 1(a) authorized a connection from the coordinator's machine to
the server's database port while point 2 preserved DEC-0067 point 5's SSH/host
prohibition. Under a loopback binding those two constraints cannot both be
satisfied. The bounded executor's fail-closed stop at preflight
(`docs/evidence/TASK-5A-verification.md`) was the correct outcome of a
contradictory instruction, not an execution defect. Responsibility lies with the
coordinator that drafted the option set; this is recorded rather than attributed
to the executor. Full analysis:
`docs/evidence/TASK-5A-ORCHESTRATION-ANALYSIS.md`.

### Decision

1. The database actions already authorized by DEC-0068 points 1(b)-(d) —
   creating the empty `crm_test` database, applying the repository's own Alembic
   migrations to `crm_test` only, and running the six
   `CRM_RUN_POSTGRESQL_TESTS`-gated tests against `crm_test` — are unchanged and
   remain authorized. This decision changes only the transport that carries
   them.
2. SSH to the deployment host is authorized as that transport, for TASK-5A only.
   This is the project's established mechanism, not a new capability: DEC-0052
   (ACTIVE) authorizes deploying to and iterating on the production server, and
   the W4 migration was itself executed over SSH
   (`scripts/run_w4_migration.py:24-26,37-39`), alongside
   `scripts/check_remote_db.py`, `scripts/check_db_user.py`,
   `scripts/w4_deploy.py`, and `scripts/w4_rollback.py`.
3. Permitted SSH-carried operations, exhaustively: (a) creating the empty
   `crm_test` database; (b) opening an SSH local port forward to the server's
   loopback PostgreSQL endpoint so that the repository's existing local test
   suite can reach `crm_test`; (c) read-only checks needed to prove isolation,
   including `SELECT current_database()` and existence checks. No other
   SSH-carried operation is authorized by this decision.
4. Withdrawn and not proposed: widening `listen_addresses`, opening the database
   port on the host or cloud firewall, or any other change that would reverse
   the accepted non-exposure property. The coordinator withdrew this option
   before the product owner was asked to consider it.
5. Prohibited, unchanged from DEC-0067 point 5 and DEC-0068 point 2: writing or
   reading any production real table; touching any database other than
   `crm_test`; deployment or release; service start/stop/restart; nginx, TLS, or
   DNS changes; credential rotation; modifying `postgresql.conf`, `pg_hba.conf`,
   systemd units, or firewall rules; git commit or push; dependency
   installation; paid services; any operation on other projects on the same
   host.
6. Fail-closed conditions, each requiring an immediate stop and report rather
   than a workaround: (a) `SELECT current_database()` does not return
   `crm_test` before any write; (b) `crm_test` already exists; (c) SSH
   authentication does not succeed; (d) the `DATABASE_PASSWORD` in
   `deploy/.env` is rejected. Case (d) is expected to be possible: GR1 rotated
   that credential server-side into `/opt/anqiao-crm/shared/database.env`
   (`docs/evidence/TASK-0001-GR1-w3-recovery.md:27-30`), so the local copy may
   be stale. Reading the rotated server-side secret is NOT authorized by this
   decision; if the local credential is rejected, the executor stops and the
   product owner is asked separately.
7. Credential handling: values are read from `deploy/.env` into the process
   environment and never printed, logged, committed, or written into any
   evidence file. Only key names and boolean/classification results may be
   recorded.
8. `crm_test` is left in place after execution so the coordinator can
   independently re-run. Its retention or removal remains a later product-owner
   decision per DEC-0068 point 6.
9. On a reproduced pass, TASK-0007 is upgraded from PARTIAL to ACCEPTED and
   TASK-0001 mainline work resumes per DEC-0067 point 4. On any fail-closed
   stop, TASK-0007 remains PARTIAL.

### Decision evidence

Product owner on 2026-08-02, after the coordinator reported that engineering
sequencing is the coordinator's responsibility rather than the product owner's
("我不懂编程，我需要你编排任务"), authorized the single remaining question —
whether the existing SSH transport may carry the already-authorized `crm_test`
actions — verbatim: "允许，可以".

### Sequencing consequence recorded with this decision

[VERIFIED] Real-database verification is required twice on the mainline, not
once. Three test files are gated on `CRM_RUN_POSTGRESQL_TESTS`
(`tests/test_task0007_postgresql_sessions.py`, `tests/test_s4_authentication.py`,
`tests/test_migrations.py`); neither `src/` nor `tests/` contains any SQLite
fallback; and the S6 gate requires restart-persistence verification
(`docs/tasks/active/TASK-0001-manual-core-record-slice.md:284`). [VERIFIED] The
script that S6 names for that verification, `scripts/dev-test.ps1`, does not
exist. [INFERENCE] TASK-0007's unverified legs and S6's restart-persistence
element therefore depend on the same capability, so establishing it once serves
both. This corrects an earlier coordinator statement that S5 and S6 are purely
local; S5 is local, S6's restart-persistence element is not.

### Consequences

- The TASK-5A card and its handoff are rewritten to the SSH-carried route; the
  card's step 1 preflight result stands as factual history and is not rewritten
  to claim success.
- `docs/evidence/TASK-5A-ORCHESTRATION-ANALYSIS.md` records the root cause and
  the three-phase proposed sequence; it carries no authority of its own.
- Control documents are synchronized to show TASK-5A re-dispatched under
  DEC-0069 with TASK-0007 still PARTIAL pending the reproduced pass.
- Authoring the missing `scripts/dev-test.ps1` is recorded as S6 gate-required
  work, not opportunistic cleanup, and is not authorized by this decision.
- If the SSH-carried route and its one allowed correction pass both fail,
  record PARTIAL / ESCALATED and stop for a product-owner decision, per
  DEC-0065.

## DEC-0070: Retroactive record of the 2026-08-02 `crm_test` seed and widened gated-test authorization; S4/S6 evidence reclassified

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S4/S6 gate status, `crm_test` retention, evidence
  classification, control documents
- Relationship to prior decisions: extends DEC-0069 point 3 retroactively. It
  does not supersede DEC-0069; every prohibition in DEC-0069 point 5 remains in
  force unchanged.

### What this decision records

[VERIFIED] On 2026-08-02 the bounded executor (Reasonix) performed two actions
against `crm_test` that fall outside DEC-0069 point 3's exhaustive list of
permitted SSH-carried operations:

1. Writing a synthetic `admin` account plus `role_grants`
   (`administrator` + `business_user`) into `crm_test`.
2. Running the 19 tests in `tests/test_s6_integration.py`, where DEC-0068
   authorized six `CRM_RUN_POSTGRESQL_TESTS`-gated tests scoped to TASK-5A.

[VERIFIED] The executor reported both actions transparently in
`docs/evidence/TASK-0001-S6-gate-dependencies.md` sections 4 and 9 and cited
conversational product-owner authorization. [VERIFIED] No corresponding
decision entry existed, so the authorization was invisible to any tool reading
only the repository.

### Decision

1. Both actions are retroactively authorized. The executor's conduct matched the
   product owner's actual instruction; the defect was the missing repository
   record, not the acts.
2. Authorization-recording duty is assigned to the coordinator, not the bounded
   executor. When a product owner widens scope in conversation, the coordinator
   writes the decision entry before the resulting evidence is used to move a
   gate. This closes the gap this decision repairs.
3. `crm_test` and its seeded synthetic data are retained for now, resolving
   DEC-0068 point 6 for this round only. The synthetic `admin` credential is a
   test-only value in an isolated test database; it must never be created in
   `anqiao_crm` or any production-facing database, and no production credential
   was involved.
4. The 25 reported gated passes on `crm_test` remain classified
   `[UNVERIFIED — single source]`. Retroactive authorization legitimizes the
   act; it does not convert an unreproducible run into evidence. The SSH
   forward was terminated and no run log was retained.
5. Consequently TASK-0001 S4 is reclassified from PASSED to PARTIAL: its local
   legs are independently reproduced, its `crm_test` leg is not. S6 remains
   PARTIAL. Restoring S4 to PASSED requires one reproduced real-database run,
   which needs a separate authorization because DEC-0069's transport
   authorization was consumed by TASK-5A.
6. Unchanged and still prohibited, per DEC-0067 point 5, DEC-0068 point 2 and
   DEC-0069 point 5: any production real-table read or write; any database
   other than `crm_test`; deployment or release; service start/stop/restart;
   nginx, TLS, or DNS changes; credential rotation; modifying
   `postgresql.conf`, `pg_hba.conf`, systemd units, or firewall rules; git
   commit or push; dependency installation; paid services.

### Decision evidence

Product owner on 2026-08-03, asked whether the two out-of-scope `crm_test`
actions had in fact been authorized on 2026-08-02, selected: "是，我授权过（补记
DEC-0070）".

### Audit findings recorded with this decision

[VERIFIED] The independent audit
(`docs/evidence/TASK-0001-S6-GATE-DEPENDENCIES-AUDIT.md`) reproduced the local
suite (`119 passed, 28 skipped`, 0 error), the governance check (`[PASS]`), and
the gated collection repair (19 tests collected, 0 error), and confirmed all
four reported application-code repairs are real defects really fixed.

[VERIFIED] Two S6 test-integrity defects were found and fixed on 2026-08-03:
`test_api_response_time_under_500ms` asserted `< 5.0` while its name claimed
500ms (renamed; threshold unchanged), and `test_no_external_network_calls`
asserted only a 201 status code and could not detect an external call
(rewritten to record and reject non-loopback socket attempts). [VERIFIED]
Neither rewritten test has been executed against a real database.

[VERIFIED] Authoring `scripts/dev-test.ps1` was inside TASK-0001 scope all
along: the task card lists it as an owned path at line 163. DEC-0069's closing
line meant "not authorized by DEC-0069", not prohibited. An earlier audit
reading that called this a violation was wrong and is corrected here.

### Consequences

- The TASK-0001 card records S4 PARTIAL and S6 PARTIAL with the single-source
  qualifier on the `crm_test` legs.
- Control documents (`docs/NOW.md`, `docs/specs/INDEX.md`) are synchronized to
  show S4 PARTIAL rather than PASSED.
- `main.py`'s `__main__` block defects (`settings.debug_mode`,
  `settings.production_mode`, `settings.database_url[:50]`) and three
  pre-existing `institutions.py` defects are recorded as open, to be addressed
  under S5's own scope rather than by opportunistic cleanup.
- The next real-database run, whether for S4 reproduction or S6
  restart-persistence, requires a fresh transport authorization request.

## DEC-0071: DeepSeek's S6 gate-dependency report re-adjudicated to PARTIAL; `main.py` entrypoint repair and loopback bind default authorized; S5 gate proceeds

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S5/S6 sequencing, `src/crm/web/main.py` entrypoint,
  local development bind address, report-status classification
- Relationship to prior decisions: implements DEC-0070's consequence at
  DECISION-LOG lines 3032-3035 (the `main.py` defects to be addressed under
  S5's own scope). It does not reopen DEC-0070's S4/S6 reclassification and
  does not grant any database or transport authorization.

### What this decision records

[VERIFIED] An executor self-identifying as DeepSeek submitted a completion
report claiming `Status: passed` and `S4 -> PASSED` for the S6
gate-dependency round. [VERIFIED] That round had already been independently
audited on 2026-08-03 and adjudicated by DEC-0070, which reclassified S4 to
PARTIAL because its `crm_test` leg is `[UNVERIFIED - single source]`.

[VERIFIED] Coordinator re-verification of the report reproduced the local
suite (`119 passed, 28 skipped`, 0 error via `scripts/dev-test.ps1`), the
governance check (`[PASS]`, 7 approved SPECs), and confirmed all four claimed
application-code repairs are real:

1. `src/crm/web/routes/institutions.py` - zero remaining `Depends(lambda`;
   `_get_query_service` used at lines 56, 131, 175.
2. Same file - three real `roles=frozenset(...)` values at lines 105, 152, 189.
3. `src/crm/application/commands.py` - zero remaining `crm.domain.identity`
   references.
4. `src/crm/application/queries.py` - `from_projection` present at lines 41
   and 67 and consumed at lines 196 and 244.

[VERIFIED] The report's `crm_test` figures remain unreproducible: the SSH
forward was terminated with no retained log.

[VERIFIED] The report described its own two S6 test-integrity defects as SPEC
calibration without disclosing that they were假绿灯 found by audit, notably
`test_no_external_network_calls`, which asserted only a status code and had no
capacity to detect an external call - the exact property the S6 gate requires.

[VERIFIED] The `main.py` `__main__` block defect count is three, not two:
`settings.debug_mode` (line 270), `settings.production_mode` (line 271) and
`settings.database_url[:50]` (line 272). `Settings` in `src/crm/config.py`
declares neither boolean field, and `database_url` at `config.py:52` returns a
SQLAlchemy `URL` object that cannot be sliced. [VERIFIED] No test imports the
`__main__` block, so the passing local suite does not cover the entrypoint.

[VERIFIED] `src/crm/web/main.py:282` binds `host="0.0.0.0"`, exposing all
interfaces. DEC-0059 records a prior publicly reachable debug service.

### Decision

1. The report's status is re-adjudicated from `passed` to `partial`. The four
   code repairs are accepted. S4 and S6 remain PARTIAL exactly as DEC-0070 set
   them; no gate advances on this report.
2. Repair of the `main.py` `__main__` block is authorized as the first S5 step,
   because S6's restart-persistence element must start this process.
   `debug_mode` and `production_mode` are to be derived from the existing
   `crm_environment` field; no new configuration variable is introduced. The
   database URL print must be redacted, never sliced raw.
3. The local development bind default changes from `0.0.0.0` to `127.0.0.1`.
   Production reachability is nginx's responsibility per ADR-0002. This is a
   deployment-behavior change and is recorded here rather than treated as
   opportunistic cleanup.
4. The S5 gate (Jinja2 page + JSON API parity + four-step flow) proceeds after
   step 2. S5 is local-only and needs no database authorization.
5. `crm_test` retention is already settled by DEC-0070 point 3 and is not
   reopened. Any further real-database access, including S6 restart-persistence
   and the two rewritten S6 tests, still requires a fresh authorization request
   per DEC-0070's closing consequence.
6. Engineering sequencing is the coordinator's duty per AGENTS.md section 4 and
   was not delegated to the product owner.

### Consequences

- Ordered next path: `main.py` entrypoint repair -> S5 gate -> a new
  authorization request for the S6 real-database remainder.
- The two rewritten S6 tests stay `[NOT VERIFIED]` until executed against a
  real database under a future authorization.
- Executor completion reports must not restate a gate status that a later
  decision has already changed; the coordinator re-verifies before acceptance.

## DEC-0072: S5 gate REFUSED on a P0 missing owner-write authorization; entrypoint repair accepted; S5 remains IMPLEMENTED-NOT-PASSED

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S5 gate status, `src/crm/web/routes/followups.py`,
  S5 test scope, S6 sequencing
- Relationship to prior decisions: continues DEC-0071. It does not alter
  DEC-0070's S4/S6 reclassification and grants no database or transport
  authorization.

### What this decision records

[VERIFIED] The executor delivered DEC-0071's two steps and reported
`Status: partial`, correctly declining to self-declare an S5 gate pass.

[VERIFIED] Coordinator re-verification reproduced `129 passed, 28 skipped`,
0 failed via `scripts/dev-test.ps1`, and `check-governance.ps1` `[PASS]`.

[VERIFIED] The entrypoint repair is real and well-tested. `src/crm/config.py`
lines 52 and 61 derive `debug_mode`/`production_mode` from `crm_environment`
with no new configuration key. `tests/test_entrypoint.py` is effective, not
decorative: it executes the real `__main__` block through `runpy` with
`uvicorn.run` intercepted (asserting `host == "127.0.0.1"`), asserts the banner
masks the password, and adds a source-level regression guard against a return
to `0.0.0.0`. The fourth defect the executor found (`uvicorn` called without
being imported) is confirmed present as a fix at `main.py:27`.

### The P0 that refuses the gate

[VERIFIED] `src/crm/web/routes/followups.py` enforces no owner-write rule on
either creation endpoint:

- `institution_repository` appears 0 times in the file; the institution is
  never loaded, so `owner_user_id` is never compared.
- `from crm.policy` appears 0 times in the file.
- `add_contact` and the activity endpoint depend only on `get_current_user`,
  which authenticates but does not authorize.
- `AddContactToInstitutionCommand.validate` (`commands.py:147-180`) contains no
  ownership rule, and the route calls `command.validate(None)`, which also skips
  the `user is not None` enabled-status branch at line 176.

[VERIFIED] Consequence: any authenticated business user can write contacts and
follow-up activities onto an institution they do not own. The TASK-0001 card at
line 339 requires "owner write; other business user read-only; default deny".
This is a default-open write path where the card requires default deny.

[VERIFIED] A second defect compounds it: `followups.py:109` assigns
`name_masked=contact.name`, placing the raw contact name in a field named as
masked, on a response path with no policy layer.

[VERIFIED] The module docstring at lines 3-6 states both commands "run through
the same application/policy layer" and that page and API "share one source of
truth (SPEC-0001 R-030)". No policy import exists. The docstring overstates the
implementation.

### Why the green suite did not catch it

[VERIFIED] `tests/test_s5_pages_api_parity.py:257` seeds exactly one user
(`Role.BUSINESS_USER`) who owns every record created. No non-owner and no
second role exists in the fixture, so no masking branch and no cross-owner
write is ever exercised. The 6/6 result is real but its scope is owner-only.

[VERIFIED] Three further test-scope overstatements, in the same category as the
S6 假绿灯 pattern DEC-0070 recorded:

1. The file docstring (lines 12-13) claims "page, search, export and API paths"
   parity. Export was dropped by DEC-0027 and is out of scope; no test calls a
   search path.
2. `test_page_api_parity_same_policy_fields` asserts only that API values appear
   in the page text. It cannot detect the leak direction that matters — a page
   exposing more than the API.
3. `test_activity_validation_requires_body` is named for R-027 command-layer
   validation but asserts 422, which pydantic returns at the transport layer
   before the command runs. The inline comment is honest; the name is not.

[VERIFIED] The real `ActivityRepository.create`
(`src/crm/persistence/repositories.py:322-385`) now correctly writes the main
row and its v1 revision. Coordinator grep confirms no test constructs the real
repository; only `MemoryActivityRepository` is used. The repaired double-write
is therefore `[NOT VERIFIED]`.

[VERIFIED] `user_status=UserStatus.ENABLED` is hardcoded at `main.py:236,274`
and `institutions.py:105,152,189` instead of the session's real status. This is
currently non-exploitable because `AuthenticationService.validate_session`
(`auth.py:371`) invalidates any session whose user is not ENABLED. Recorded as
a design defect, not a live vulnerability.

### Decision

1. The S5 gate is REFUSED. S5 stays IMPLEMENTED, not PASSED. S6 does not start.
2. The entrypoint repair (DEC-0071 step 2) is ACCEPTED, including the derived
   flags, the redacted banner, the loopback bind, and `tests/test_entrypoint.py`.
3. Owner-write authorization must be enforced on both `followups.py` creation
   endpoints before S5 is re-submitted, with the institution loaded and its
   `owner_user_id` compared, denying by default.
4. `followups.py:109` must stop returning a raw name in a masked-named field,
   and the module docstring must describe what the code actually does.
5. The S5 test fixture must seed at least a non-owner business user so that
   cross-owner write denial and masking are actually exercised. The three
   overstated test scopes must be corrected to match their assertions.
6. No new authorization is granted. The real-repository double-write and
   restart persistence remain S6 items behind a future transport request.

### Consequences

- Ordered next path: owner-write enforcement + masked-field fix + test-scope
  correction -> S5 re-submission -> coordinator adjudication -> only then S6.
- A passing local suite is evidence of its fixture's scope, never of a rule the
  fixture cannot express. Single-actor fixtures cannot verify authorization.

## DEC-0073: S5 P0 owner-write fix ACCEPTED; gate still REFUSED on a vacuous parity assertion (regex escaping)

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S5 gate status, `tests/test_s5_pages_api_parity.py`,
  `docs/evidence/TASK-0001-S5-web-layer.md`
- Relationship to prior decisions: continues DEC-0072. Grants no database or
  transport authorization and does not alter DEC-0070's S4/S6 status.

### What this decision records

[VERIFIED] The executor closed DEC-0072's P0. `src/crm/web/routes/followups.py`
now loads the institution and compares `owner_user_id` on both creation
endpoints (lines 90 and 151), denying with 404 (lines 91, 152) so existence is
not disclosed, consistent with card line 338. `institution_repository` now
appears in the file where it previously appeared 0 times.

[VERIFIED] The two new denial tests are effective, not decorative: each asserts
the 404 **and** that the repository received no write
(`test_s5_pages_api_parity.py:529, 549`). This is the assertion shape DEC-0072
asked for.

[VERIFIED] `test_non_owner_page_and_api_masked_identically` is effective. It
seeds a second `BUSINESS_USER` with zero ownership and asserts on both paths
that the contact name is masked to `***`, no storable channel value appears, no
activity `factual_body` is carried, and — using a correct regex at line 595 —
that the page leaks no phone number at all.

[VERIFIED] The `ContactDetail.name_masked` → `name` rename is correct and
contained: `ContactDetail` is used only by the creation response
(`followups.py:73,115`), and the masked name remains on
`ContactSummary.name_masked` (`queries.py:99`) for the collaborator projection.

[VERIFIED] Coordinator reproduced `132 passed, 28 skipped`, 0 failed via
`scripts/dev-test.ps1`, and `check-governance.ps1` `[PASS]`.

### Why the gate is still refused

[VERIFIED] The bidirectional-parity correction DEC-0072 point 6 required is a
false green light. `tests/test_s5_pages_api_parity.py:424` reads
`re.findall(r"1[3-9]\\d{9}", page.text)`. In a raw string `\\` is two
characters, so the compiled pattern is `1[3-9]\\d{9}` — a literal backslash
followed by `d` — which matches no phone number.

[VERIFIED] Coordinator ran the two patterns from the file against a sample page
containing `13900000000` and `13700000000`:

- line 424's pattern matched `set()`
- line 595's pattern matched both numbers

[VERIFIED] Therefore `phones_on_page` is always empty and
`assert phones_on_page <= phones_in_api` is vacuously true. It cannot fail.

[VERIFIED] The assertion's partner check does not compensate. The `api_bodies`
loop at lines 431-432 asserts every API body appears on the page — the same
API-to-page direction the pre-existing assertion already covered. So after this
round the page-exposes-more-than-API direction has no live check anywhere in
this test, which is the exact direction DEC-0072 point 6 named.

[VERIFIED] `docs/evidence/TASK-0001-S5-web-layer.md:202-205` states the test
"is now **bidirectional**". The claim is contradicted by the compiled pattern.

[VERIFIED] The same executor wrote a correct pattern at line 595 in the same
round, so this is a local escaping slip rather than a misunderstanding of the
requirement.

### Decision

1. The P0 owner-write closure, the two denial tests, the non-owner masking test,
   the field rename, the docstring corrections and the 422 test rename are all
   ACCEPTED.
2. The S5 gate remains REFUSED on the single remaining defect: the vacuous
   parity assertion at line 424 and the evidence statement asserting it works.
3. Required fix: correct the pattern to `r"1[3-9]\d{9}"`, then prove the
   assertion is live rather than merely passing — temporarily render a phone
   number on the page that the API withholds, observe the test fail, restore,
   and record both outcomes in evidence.
4. Any assertion introduced to catch a named leak direction must be shown
   failing on that leak before it is reported as coverage. A passing vacuous
   assertion is a regression in evidence quality, not coverage.
5. Evidence must be corrected to describe what the assertions actually do.

### Consequences

- Ordered next path: fix line 424 + demonstrate the assertion fails on a real
  leak + correct evidence -> S5 re-submission -> adjudication -> only then S6.
- Recorded pattern, third occurrence after DEC-0070's two: an assertion whose
  name or evidence claims a property its code cannot detect. The standing
  countermeasure is now explicit in point 4.

## DEC-0074: TASK-0001 S5 gate PASSED; S6 is the next gate and its real-database leg needs a separate transport authorization

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S5 gate status (PASSED), S6 sequencing, control documents
- Relationship to prior decisions: closes DEC-0071, DEC-0072 and DEC-0073. It
  does not alter DEC-0070's S4/S6 reclassification and grants no database,
  transport, migration or deployment authorization.

### What this decision records

[VERIFIED] The executor fixed the vacuous assertion. Both phone patterns in
`tests/test_s5_pages_api_parity.py` (now lines 426 and 597) read
`r"1[3-9]\d{9}"`. Coordinator compiled both from the file and ran them against a
page containing `13900000000` and `13700000000`: both matched both numbers.

[VERIFIED] The coordinator did not rely on the executor's reported failure
output. It independently mutated the test to append a phone number the API
withholds, ran the single test, and observed a real failure:
`1 failed` on `test_page_api_parity_same_policy_fields`. The file was then
restored from a byte copy and re-run: `9 passed`. Residue checks for
`COORD-MUTATION` and `13911112222` both returned 0. The assertion is live.

[VERIFIED] The executor's temporary experiment left no residue either:
`13911112222`, `TEMP-EXPERIMENT` and `_text =` each occur 0 times.

[VERIFIED] Full suite `132 passed, 28 skipped`, 0 failed via
`scripts/dev-test.ps1`; S5 suite 9 passed; `check-governance.ps1` `[PASS]`.

[VERIFIED] The narrowed scope statement at
`docs/evidence/TASK-0001-S5-web-layer.md:301-309` is accurate, not a convenient
excuse. Coordinator confirmed both paths call `get_institution_detail` with the
same arguments — the page at `main.py:288` renders `detail.activities` and the
API at `institutions.py:186-199` returns the same `detail` object — so no data
flow exists by which the page could carry an activity body the API withholds.
Declaring the page→API direction phone-only is correct here.

[VERIFIED] Across DEC-0072 and DEC-0073 the S5 slice accumulated: owner-write
enforced with 404 default-deny on both creation endpoints; denial tests that
assert both the status and that no row was written; a non-owner fixture proving
page/API masking parity; the entrypoint repaired with a `runpy`-executed test
and a source-level bind guard; and three overstated test scopes corrected.

### Decision

1. TASK-0001 S5 is PASSED. Recorded reason: the four-step flow, page/API parity
   and owner-write denial are covered by assertions the coordinator
   independently confirmed can fail, and every remaining claim in the evidence
   matches what the code does.
2. S5's scope is explicitly local and synthetic. This decision accepts no
   real-database behavior, no restart persistence, no deployment and no
   production state.
3. S6 becomes the next gate. Its local legs may proceed. Its real-database legs
   — the `repositories.py:322-385` double-write, restart persistence, and the two
   S6 tests rewritten on 2026-08-03 — remain blocked pending a separate
   transport authorization request per DEC-0070's closing consequence.
4. The DEC-0073 point 4 rule stands as a permanent standard: an assertion
   introduced to catch a named leak or denial must be observed failing on that
   condition before it is reported as coverage.
5. Two items stay open and must not be silently dropped: the P2 hardcoded
   `user_status=UserStatus.ENABLED` (`main.py:236,274`;
   `institutions.py:105,152,189`), non-exploitable because `auth.py:371`
   invalidates non-ENABLED sessions; and S4's `crm_test` leg, still
   `[UNVERIFIED — single source]`.

### Consequences

- `docs/NOW.md`, `docs/specs/INDEX.md` and the TASK-0001 card record S5 PASSED
  with the local-and-synthetic qualifier.
- The next executor round is S6's local portion. The first real-database step
  requires the coordinator to obtain and record a fresh authorization before any
  transport is opened.

## DEC-0075: S6 local leg PASSED on first submission; the S6 real-database remainder is assembled into one authorization request

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S6 local leg status, `tests/`, the pending S6
  real-database authorization
- Relationship to prior decisions: continues DEC-0074 point 3, which authorized
  S6's local legs. It grants no database or transport authorization; the request
  text in section "Authorization request" is presented for a separate decision.

### What this decision records

[VERIFIED] The S6 local leg passed on first submission with no defect found.
This is the first round in this task's recent history where the coordinator
found nothing to refuse.

[VERIFIED] Coordinator reproduced every reported figure independently:
`scripts/dev-test.ps1` → `133 passed, 28 skipped`, 0 failed (baseline was 132,
so the new test is the +1); `check-governance.ps1` → `[PASS]`;
`tests/test_s6_local_no_external_calls.py` alone → `1 passed`.

[VERIFIED] `tests/test_s6_local_no_external_calls.py` is genuinely ungated:
`grep` for `pytestmark|skipif` returns 0. The gated file remains untouched —
`test_s6_integration.py:24-27` still carries the module-level skip.

[VERIFIED] The new test exercises the real request path with in-memory
repositories injected into `app.state`: the SPEC-0001 four-step flow (institution
POST → contact POST → activity POST → detail GET), each asserted, inside the
socket guard, with both patches restored in a `finally`.

[VERIFIED] **The coordinator did not rely on the executor's reported failure.**
It independently injected `create_connection(("192.0.2.7", 443))` into the
request path after the institution POST and observed a real failure:
`AssertionError: Unexpected non-loopback socket attempts: ["('192.0.2.7', 443)",
"('192.0.2.7', 443)"]` → `1 failed`. The guard detects what it claims to detect.

[VERIFIED] The executor's explanation of the doubled record is correct and was
reproduced: `create_connection` internally calls `connect`, and both wrappers
record the same destination. One injected attempt therefore yields two records.

[VERIFIED] Restore integrity is confirmed by hash, not by assertion. The
coordinator's pre-injection SHA-256 of the test file was
`D3AA4ADC0AB00948DE34043806FEAD22E723C69BCC8B5217C96F4E8557ACD63E`, matching the
value the executor reported; after restoring from a byte copy the hash was
identical. Residue for `COORD-LEAK`, `192.0.2.7`, `192.0.2.1` and `S6LOCAL-EXP`
is 0 in the file.

[VERIFIED] The executor's residue caveat is accurate: `192.0.2.1` occurs only in
`tests/test_task0007_auth_service.py` as a client-IP argument to
`service.authenticate(...)`, a pre-existing rate-limit parameter, never a
connection target.

[VERIFIED] The stated guard limitations are accurate, not hedging. `getaddrinfo`
occurs exactly twice in the repository, both times inside this test's own
docstrings stating the limitation, so no source path calls it. C-level libpq
traffic is genuinely outside Python-level socket patching. The test calls itself
"a positive check, not a complete egress proof", which matches its code.

[VERIFIED] The gate inventory's real-repository claim holds. `grep` of `tests/`
for `FollowUpActivityRepository(` returns 0; the hits for `InstitutionRepository(`
and `ContactRepository(` are all `Memory*` variants matching as substrings. No
test constructs a real repository, so the `repositories.py:322-385` double-write
has runtime proof nowhere.

### Decision

1. The S6 local leg is PASSED. The full synthetic suite and the local
   no-external-call verification are accepted as local-and-synthetic evidence.
2. S6 as a whole remains PARTIAL. The three real-database elements are not
   accepted and must keep their `[NOT VERIFIED]` marks.
3. The DEC-0073 point 4 rule is now demonstrated to work in the reverse
   direction: applied to a correct implementation, it confirmed the assertion
   rather than exposing a defect. It stays a permanent standard.
4. The executor correctly declined to request the real-database authorization in
   its report, per the handoff instruction. Assembling that request is the
   coordinator's duty under AGENTS.md section 4.

### Authorization request (presented for a separate product-owner decision)

This request is recorded here for traceability. **It is not self-approval and
opens no transport.** A separate decision entry must record the product owner's
answer before any database access.

What is being requested, once, covering all three remaining S6 elements:

1. Run the gated `tests/test_s6_integration.py` (19 tests, including the two
   rewritten on 2026-08-03 that have never executed anywhere) against the
   isolated `crm_test` database.
2. Verify restart persistence: start a real uvicorn process, write synthetic
   records, stop it, restart, and confirm the records and the deterministic
   `occurred_at DESC` history order survive.
3. Prove the `repositories.py:322-385` double-write at runtime: construct the
   real `FollowUpActivityRepository` against `crm_test` and confirm the activity
   row and its v1 revision are both written in one transaction, with the
   factual body readable back.

Resources: the isolated `crm_test` database only, reached over an SSH-carried
forward as in DEC-0069, using the test-only role. Synthetic data only.

Impact: writes to `crm_test` exclusively. No production database
(`anqiao_crm`), no schema change to any shared database, no deployment, no DNS,
TLS or nginx change, and no real customer data.

Rollback: `crm_test` is a disposable test database; its synthetic rows may be
truncated or the database dropped and re-migrated without affecting anything
else. The uvicorn process is local and is stopped when the check ends. The SSH
forward is terminated at the end of the round.

What is not requested: any access to `anqiao_crm`, any migration against a
shared or production database, any deployment or release step, and any change
to credentials or permissions.

Recording duty: per DEC-0070 point 2 the coordinator writes the decision entry
before the resulting evidence is used to move the S6 gate. Retained logs are
required this round so the evidence is not single-source like S4's `crm_test`
leg.

### Consequences

- Ordered next path: product-owner decision on the request above → coordinator
  records it → the three real-database elements run in one round with retained
  logs → S6 formal acceptance → then the still-unauthorized items (W4 formal
  acceptance, G5, release/nginx/TLS/DNS/cutover) in their own gates.
- If the request is declined, S6 stays PARTIAL indefinitely and no further
  TASK-0001 gate can close. That is an acceptable state, not a reason to
  weaken a gate.

## DEC-0076: S6 real-database round AUTHORIZED — one combined round on `crm_test` covering the gated suite, restart persistence and the double-write, with retained logs

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner (explicit approval, 2026-08-03)
- Affects: TASK-0001 S6 real-database legs, `crm_test`, SSH transport
- Relationship to prior decisions: approves the request recorded in DEC-0075.
  It reuses DEC-0069's transport model and keeps every DEC-0069 point 5
  prohibition in force except where point 4 below states one narrow, explicit
  difference. It does not reopen DEC-0070's S4 reclassification.

### What this decision records

[VERIFIED] The coordinator presented the combined request in DEC-0075 and did
not self-approve it. [VERIFIED] The product owner approved it explicitly on
2026-08-03. This entry is written before any transport opens, satisfying
DEC-0070 point 2.

[VERIFIED] The route that already works is reused rather than invented: the
test-only role `crm_test_runner` over an SSH local port forward to the server's
loopback PostgreSQL endpoint, with credentials in `.env.crm_test_local`
(confirmed gitignored via `git check-ignore`: `.gitignore:3:.env.*`). TASK-5A
proved this route end to end and the coordinator independently reproduced it on
port 55433 (`docs/evidence/TASK-5A-verification.md:218-219`).

[VERIFIED] `crm_test` and its synthetic seed are retained per DEC-0070 point 3,
so the database and the synthetic `admin` account should already exist.

### Decision

1. Authorized, as one round covering all three S6 real-database elements:
   (a) run the gated `tests/test_s6_integration.py` (19 tests, including the two
   rewritten on 2026-08-03 that have never executed in any environment) against
   `crm_test`; (b) verify restart persistence; (c) prove the
   `repositories.py:322-385` double-write at runtime by constructing the real
   `FollowUpActivityRepository` against `crm_test`.
2. Transport: SSH local port forward to the server's loopback PostgreSQL
   endpoint, as DEC-0069 point 3(b). The forward is terminated at the end of the
   round. Credentials are read from `.env.crm_test_local` into the process
   environment and never printed, logged, committed, or pasted into evidence.
3. Data: `crm_test` only, synthetic only. Existing synthetic rows may be added
   to and cleaned up; the database may be truncated or dropped and re-migrated
   if a clean state is needed.
4. **One narrow difference from DEC-0069 point 5, stated explicitly to prevent
   misreading.** DEC-0069 point 5 prohibits "service start/stop/restart". That
   prohibition is about services on the deployment host, above all the
   `anqiao-crm` service. This decision authorizes starting and stopping a
   **local** uvicorn process on the executor's own machine, connected to
   `crm_test` through the SSH forward, solely to verify restart persistence.
   It authorizes nothing on the server: the `anqiao-crm` service and every other
   host service must not be started, stopped, restarted, or reconfigured.
5. Retained logs are mandatory. S4's `crm_test` leg became
   `[UNVERIFIED — single source]` precisely because the forward was terminated
   with no retained log. This round must write command invocations, the
   `SELECT current_database()` proof, test output and the restart-persistence
   sequence into evidence under `docs/evidence/`, with no credential values.
6. Fail-closed conditions, each requiring an immediate stop and report rather
   than a workaround: (a) `SELECT current_database()` does not return
   `crm_test` before any write; (b) SSH authentication fails; (c) the
   `.env.crm_test_local` credential is rejected; (d) the forward would target
   any database other than `crm_test`. Reading any rotated server-side secret
   remains unauthorized; on case (c) the executor stops and the product owner is
   asked separately.
7. Unchanged prohibitions, in force from DEC-0069 point 5: no access to
   `anqiao_crm` or any database other than `crm_test`; no production real-table
   read or write; no deployment or release; no nginx, TLS, DNS, firewall,
   `postgresql.conf`, `pg_hba.conf` or systemd change; no credential rotation;
   no git commit or push; no dependency installation; no paid service; no
   operation touching other projects on the host.
8. Scope discipline: this authorization covers verification only. If a defect is
   found, the executor reports it and stops; repairing application code beyond
   the three named elements requires a separate authorization.

### Consequences

- On success, the three elements gain runtime evidence and S6 becomes eligible
  for formal acceptance by coordinator adjudication.
- On any fail-closed stop, S6 stays PARTIAL and the product owner is asked
  before a second attempt. A workaround is not permitted.
- Still unauthorized and untouched by this decision: W4 formal acceptance, G5
  migration against a shared database, release, nginx/TLS/DNS and legacy
  cutover.

## DEC-0077: S6 real-database round returns 3 of 4 elements PASSED; a real engine-per-call defect is recorded but the failing test is a forward-measurement artifact, not proof of a production defect

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 S6 gate status, `src/crm/persistence/database.py` and its
  22 call sites, the S6 response-time element
- Relationship to prior decisions: reports the outcome of the round DEC-0076
  authorized. It grants no new database, transport or code-change
  authorization. It corrects part of the executor's recommended justification.

### What this decision records

[VERIFIED] The executor obeyed DEC-0076's boundaries. Only
`docs/evidence/TASK-0001-S6-realdb-verification.md` was added; mtimes confirm no
application code, test or script changed this round
(`database.py` 2026-07-28, `test_s6_integration.py` 08:53, `dev-test.ps1`
2026-08-02), and the only files touched after 12:00 are the coordinator's own
governance documents plus that evidence file.

[VERIFIED] Retained logs exist as DEC-0076 point 5 required — the failure this
round is reproducible from the record rather than lost like S4's leg. Credential
residue scan of the evidence file returns 0.

[VERIFIED] Three of the four elements passed with runtime evidence: the
fail-closed isolation gate (`current_database() → crm_test`, `IS_CRM_TEST: True`,
`USER: crm_test_runner`, before any write); restart persistence (uvicorn pid
31916 → writes → stop → pid 35560 → `PERSISTED: True / ORDER_OK: True /
BODIES_OK: True`); and the double-write, including a genuine DEC-0073 point 4
fail-proof in three phases — intact `both: True`, revision deleted
`both: False` with `PHASE2_ASSERTION_FAILED_AS_REQUIRED: True`, restored
`both: True`. Deleting and restoring one synthetic revision row inside `crm_test`
to prove the assertion can fail is within DEC-0076 point 3 and is the behavior
DEC-0073 point 4 demands.

[VERIFIED] `test_no_external_network_calls` passed on its first-ever real
execution. Both tests rewritten on 2026-08-03 had never run in any environment
before this round.

[VERIFIED] The gated suite returned `18 passed, 1 failed`.
`test_api_response_time_within_transport_budget` failed reproducibly at 9.60 s
and 9.11 s against a 5 s threshold.

[VERIFIED] The engine-per-call defect the executor diagnosed is real, confirmed
independently from source. `SessionLocal()`
(`src/crm/persistence/database.py:27-42`) constructs a new `Settings()` and a
new `build_engine()` on every call, while `get_session_factory()` (lines 16-23)
is the cached path. The comment at lines 25-26 concedes "less efficient but
safer for tests".

[VERIFIED] The defect is wider than the executor reported. It cited
`repositories.py`; the coordinator counted **22** `SessionLocal()` call sites
across six files: `repositories.py` 10, `user_repository.py` 6,
`session_repository.py` 4, `audit_repository.py` 1, `role_grant_repository.py` 1,
`database.py` 1. `get_session_factory` is never called anywhere in `src/` — only
defined and referenced in its own docstring. Each engine carries its own default
pool and is never disposed.

### Where the executor's justification is corrected

[VERIFIED] The failing test does not demonstrate a production response-time
defect, and the executor's own probe data shows why: a cold connect through the
SSH forward costs ~1.28-1.43 s, whereas the same connection on the server's own
loopback is a millisecond-scale operation. The 9-11 s total is forward-amplified
connection churn. In production the database is local to the application, so
these 4-5 connections would not carry the forward penalty.

[INFERENCE] The engine-per-call pattern therefore remains a real defect on
production grounds — pools that are never reused or disposed, with 22 call
sites — but the 9-11 s measurement is not the evidence for it. The executor
recommended fixing the root cause on the grounds that adjusting the threshold
"would mask connection-jitter cost". The conclusion is right; that reason is
not. Fixing it is justified by production connection handling, not by a number
measured through a transport that production does not use.

[VERIFIED] Consequently the S6 response-time element is `[UNKNOWN]`, not
`FAILED-in-production`: no measurement exists that separates transport cost from
application cost, because the only real-database access authorized so far runs
through the forward.

[UNVERIFIED — single source] The probe timings themselves. There is no local
PostgreSQL on the coordinator's machine (`pg_isready` and `psql` absent, nothing
listening on 5432) and DEC-0076 authorized one round, so the coordinator could
not re-measure. The retained logs make this materially better than S4's leg, but
it is still one source.

### Decision

1. The round's status is PARTIAL, matching the executor's own report. Three
   elements are ACCEPTED with runtime evidence. The executor correctly reported
   the failure and stopped instead of fixing it, as DEC-0076 point 8 required.
2. S6 is **not** formally accepted. A gate whose suite has a failing test does
   not pass, even when the failure's cause is understood.
3. The engine-per-call defect is recorded as a real, separately scoped defect
   covering all 22 call sites, justified by production connection handling.
   Fixing it is **not** authorized by this entry; it is an application change
   outside DEC-0076's verification-only scope.
4. Raising or relaxing the 5 s threshold to make the suite green is **refused**.
   That would be the false-green pattern DEC-0070 and DEC-0073 already
   recorded three times.
5. The response-time element stays `[UNKNOWN]`. Any future claim about it
   requires a measurement that separates transport from application cost.
6. The executor's fourth-item suggestion — measuring response time on the
   server's own loopback — is accepted as the correct disambiguation and is
   deferred to a future authorization request rather than performed silently.

### Consequences

- Ordered next path: product-owner decision on the engine-per-call fix → if
  authorized, repair `SessionLocal()`/`get_session_factory()` usage locally and
  re-verify all 22 call sites → a new real-database round to re-run the gated
  suite and re-measure → S6 adjudication.
- Two coordinator-side lessons recorded: an executor's diagnosis can be correct
  while its stated justification is not, so the reason is audited separately
  from the conclusion; and a reported defect's blast radius is re-counted rather
  than taken from the report, which is how 10 became 22 here.

## DEC-0078: engine-per-call repair AUTHORIZED in `database.py` only, plus one follow-up real-database round to re-run the gated suite

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner (explicit approval, 2026-08-03)
- Affects: `src/crm/persistence/database.py`, the 22 `SessionLocal()` call sites
  as consumers, the S6 gated suite, `crm_test`
- Relationship to prior decisions: acts on the defect DEC-0077 recorded. It
  reuses DEC-0076's transport model and keeps every DEC-0069 point 5 prohibition
  in force, including DEC-0076 point 4's narrow local-uvicorn allowance.

### What this decision records

[VERIFIED] DEC-0077 established the defect: `SessionLocal()`
(`src/crm/persistence/database.py:27-42`) builds a new `Settings()` and a new
engine on every call; `get_session_factory()` (lines 16-23) is the cached path
and is never called anywhere in `src/`. 22 call sites across six files consume
`SessionLocal()`, each engine carrying its own never-disposed pool.

[VERIFIED] The defect sits on the authenticated hot path, not an edge:
`session_repository.py` has 4 call sites and `user_repository.py` 6, so every
authenticated request pays the cost. This is why deferral was rejected.

[VERIFIED] The repair does not require touching the 22 call sites. Their
signatures stay unchanged; only `SessionLocal()`'s internals change.

[VERIFIED] A latent trap must not be copied forward. `get_session_factory(settings)`
ignores its `settings` argument after the first call, returning the global
`_factory` regardless, and no reset mechanism exists (`grep _factory` finds no
reset anywhere in `src/` or `tests/`). Delegating naively would harden that
behavior into the hot path.

[VERIFIED] The trap is currently unexercised: no test changes `DATABASE_*`
mid-process and then calls `SessionLocal()`, and `tests/test_migrations.py:75`
builds its own engine with `sa.create_engine`, bypassing the factory. Risk is
low, but the suite is the only proof.

[INFERENCE] The failing response-time test is expected to pass after the repair:
a pooled query through the forward measured 0.263 s versus ~1.3 s for a cold
connect, so a request reusing one engine should land near 1.0-1.3 s against the
5 s threshold. This is inference from DEC-0077's probe data, not a verified
result, and only the real-database re-run can settle it.

### Decision

1. Authorized: repair the engine-per-call pattern by changing
   `src/crm/persistence/database.py` only. `SessionLocal()` must reuse a cached
   session factory instead of constructing a new engine per call.
2. The cache must be keyed on the resolved settings (or the database URL) so a
   changed configuration rebuilds the engine rather than silently returning a
   stale one. Fixing that pre-existing trap is in scope because the repair puts
   the cached path on the hot path; nothing else in the file is in scope.
3. The 22 call sites must not be edited. If any cannot work without a signature
   change, stop and report rather than widening the change.
4. Local verification gate: the full suite must stay at `133 passed, 28 skipped`
   with 0 failed. The existing comment "less efficient but safer for tests"
   indicates someone hit a test-isolation problem before, so a non-regressing
   suite is the evidence that the cached path is safe there.
5. Authorized as part of the same approval: one follow-up real-database round on
   `crm_test` to re-run the gated `tests/test_s6_integration.py` and report
   whether the response-time test now passes, under DEC-0076's transport model,
   with retained logs mandatory per DEC-0076 point 5.
6. Refused, unchanged from DEC-0077 point 4: relaxing or raising the 5 s
   threshold. If the test still fails after the repair, that is a finding to
   report, not a number to adjust.
7. Scope discipline: no other performance work, no pool tuning beyond what the
   cached factory requires, and no refactoring of the repositories. The
   still-open P2 hardcoded `user_status=UserStatus.ENABLED` stays open.

### Consequences

- Ordered path: repair `database.py` locally → local suite must hold at 133/28 →
  real-database round re-running the gated suite with retained logs → S6
  adjudication by the coordinator.
- If the repair cannot hold the local suite green, the executor stops and reports
  rather than weakening any test.
- The response-time element stays `[UNKNOWN]` until the real-database re-run
  produces a number; a passing test through the forward is evidence about the
  forward path, and any production claim still needs the server-loopback
  measurement DEC-0077 point 6 deferred.
- Still unauthorized: W4 formal acceptance, G5, release, nginx/TLS/DNS, cutover,
  and the server-loopback response-time measurement.

## DEC-0079: TASK-0001 S6 gate ACCEPTED; the gated suite's 19-pass belongs to an intermediate `database.py`, and single-config equivalence is what carries it

- Date: 2026-08-03
- Status: ACTIVE
- Decided by: Product owner (explicit approval, 2026-08-03, option A)
- Affects: TASK-0001 S6 gate status, `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md`
- Relationship to prior decisions: adjudicates the round DEC-0078 authorized. It
  grants no new database, transport, deployment or code-change authorization,
  and does not reopen DEC-0070's S4 reclassification or DEC-0077 point 6's
  deferral.

### What the coordinator verified independently

[VERIFIED] The repair is in scope and correct. The coordinator obtained the
pre-repair `database.py` from `deploy_source.tar.gz` (2026-07-29) because the
repository has zero commits and no diff was available; the executor supplied no
such comparison source. `_factory = None` (a single global that ignored its
`settings` argument) is replaced by `_factories: dict[tuple, ...]` keyed by
`_cache_key(settings)` = (host, port, database, user, sslmode,
SHA-256(password)), and `SessionLocal()` delegates to
`get_session_factory(settings)()`.

[VERIFIED] `pool_pre_ping=True` was already present in `build_engine` before the
repair, so DEC-0078 point 7's no-pool-tuning limit was respected. `build_engine`
and `build_session_factory` are byte-identical to the pre-repair copy; the only
new import is `hashlib`.

[VERIFIED] DEC-0078 point 3 held: the coordinator re-counted 22 `SessionLocal()`
call sites (`repositories.py` 10, `user_repository.py` 6,
`session_repository.py` 4, `audit_repository.py` 1, `role_grant_repository.py` 1,
plus the definition), and every call-site file's mtime predates this round.
DEC-0078 point 7's still-open P2 remains open: five `user_status=UserStatus.ENABLED`
sites persist (`main.py:236,274`; `institutions.py:105,152,189`).

[VERIFIED] DEC-0078 point 6 held. The 5 s threshold at
`test_s6_integration.py:458` is byte-unchanged; the test passes because the
request actually got faster, not because a number was adjusted.

[VERIFIED] The DEC-0073 point 4 fail-proof was rebuilt rather than trusted. The
executor's own script was not retained, so the coordinator wrote its own probe
outside the repository and loaded the repaired module and the 2026-07-29
pre-repair module in one process. The repaired module returns
`REUSE_SAME_CONFIG: True` and `REBUILD_ON_CHANGE: True` for all six dimensions;
the pre-repair module returns `False` for all six. A second probe on the defect
path itself returns `SessionLocal ENGINE_REUSED: True` (repaired) versus `False`
(pre-repair). The executor had proved one dimension; six are now proved.

[VERIFIED] The local gate holds on the current code, reproduced by the
coordinator: `pytest tests/ -q` → `133 passed, 28 skipped`, 0 failed;
`scripts/dev-test.ps1` → the same; `scripts/check-governance.ps1` → `[PASS]`;
`compileall src tests` → `COMPILE_OK`; gated `--collect-only` → 19 tests.

[VERIFIED] Credential handling is clean, checked by value rather than by
keyword. The coordinator read the 64-character `DATABASE_PASSWORD` from the
gitignored `.env.crm_test_local` and searched the whole repository:
`PASSWORD_RESIDUE_COUNT: 0`. The three matching values are the non-secret
identifiers `127.0.0.1`, `crm_test` and `crm_test_runner`, already recorded
under DEC-0076 point 2 and DEC-0077's accepted pattern.

[VERIFIED] The security follow-up's MEDIUM is a false positive in this
environment, re-measured rather than accepted on report: `sqlalchemy==2.0.51` is
genuinely pinned (`pyproject.toml:21`), `URL` has no own `__str__`, and both
`str()` and `repr()` render the password as `***`.

[VERIFIED] DEC-0078's authorization preceded execution: DEC-0078 was written at
13:19:48 and `database.py` was modified at 13:48:18. No git commit exists; the
repository has no commits at all.

### The timing gap the executor did not disclose

[VERIFIED] Precise mtimes place the gated-suite run before the final code state:

```text
13:34:16  docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.log
13:47:23  docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md
13:48:18  src/crm/persistence/database.py
```

[VERIFIED] Therefore the `19 passed, 0 failed` result belongs to an intermediate
`database.py` whose cache key was `str(settings.database_url)` (the masked URL
string). The evidence file's own §6 records that the security follow-up replaced
that key with the `_cache_key()` tuple afterwards. The tuple-key version now in
the repository has never run against `crm_test`.

[VERIFIED] The evidence file's §5.1 `Status: PASSED` and §2.2 wording read as if
the current code passed the real-database gate. That is the
evidence-stronger-than-what-ran shape DEC-0073 point 4 exists to catch, and it is
recorded here as the fourth occurrence of that pattern after DEC-0070's two and
DEC-0073's one.

[VERIFIED] The coordinator quantified the gap instead of leaving it open. Both
key forms were exercised on the same machinery: under one fixed configuration —
which is exactly what the gated suite uses — each produces `CACHE_ENTRIES: 1` and
`ONE_ENGINE_ACROSS_4_RESOLUTIONS: True`, giving
`SINGLE_CONFIG_BEHAVIOR_IDENTICAL: True`. The only behavioral difference is the
password dimension: `REBUILD_ON_PASSWORD_CHANGE` is `True` for the tuple key and
`False` for the masked-URL key.

[INFERENCE] The current code would therefore return the same `19 passed` on
`crm_test`, and the measured 0.594 / 0.797 / 0.763 s does not depend on the key
form. This is inference from the coordinator's equivalence measurement, not a
verified real-database run of the current bytes.

### Why the response-time element does not block this gate

[VERIFIED] Three first-hand sources agree that S6 does not require a
response-time result. The task card's S6 row names "Full synthetic test, restart
persistence and no-external-call verification" and lists no response-time
element. `SPEC-0001:118` (R-017) defers a response-time target and scopes it to
AI coaching, not the API. `test_s6_integration.py:439-443` describes itself as a
"liveness/no-hang check, not an SLA check".

[VERIFIED] The response-time test passed, so no suite failure remains. Its
production meaning is unchanged from DEC-0077 point 5: a pass through the SSH
forward is evidence about the forward path only. The server-loopback measurement
stays deferred under DEC-0077 point 6 and is not a condition of S6.

### Recorded hygiene findings, non-blocking

[VERIFIED] A batch of Python 3.14 `.pyc` files was written at 13:52:58-59. The
coordinator parsed the source mtime embedded in the `.pyc` headers: they compiled
the current sources (`test_s6_integration.py` 08:53:29, `database.py` 13:48:18,
both `MATCHES_CURRENT_SOURCE: True`), not an older copy.
`requires-python = ">=3.12,<3.15"` admits 3.14, so this is not a boundary breach.

[VERIFIED] `.pytest_cache/v/cache/lastfailed` (mtime 13:54:14) holds one orphan
entry for `test_delete_institution_admin_only`, a test removed on 2026-08-03 as
outside SPEC-0001 (`TASK-0001-S6-GATE-DEPENDENCIES-AUDIT.md:46` judged that
removal DEFENSIBLE). pytest cannot clear an entry for a test it never collects.

[INFERENCE] An unrecorded pytest run occurred around 13:54 using the system
Python 3.14 rather than the venv's pinned 3.12.8. [UNKNOWN] Its exact command and
result: the evidence does not record them and they must not be invented.

### Decision

1. **TASK-0001 S6 is ACCEPTED.** All four elements now have evidence: the gated
   suite `19 passed, 0 failed` (raw log verified line by line, `EXIT_CODE=0`);
   restart persistence and the `repositories.py:322-385` double-write with its
   three-phase fail-proof, both carried over from DEC-0077 because the repair
   left session semantics byte-identical (`expire_on_commit=False`,
   `autoflush=False`, `build_engine` unchanged); and the no-external-call guard,
   local leg under DEC-0075 plus its first real execution under DEC-0077.
2. The engine-per-call repair authorized by DEC-0078 is ACCEPTED: in scope,
   correct, no pool tuning, 22 call sites untouched, local gate green, and the
   keying assertion proven non-vacuous across all six dimensions.
3. The acceptance rests on an explicitly labelled `[INFERENCE]`, chosen by the
   product owner as option A over a second real-database round: the gated suite's
   pass belongs to the intermediate `str(URL)`-key code, and single-config
   behavioral equivalence — measured by the coordinator — is what carries it to
   the current bytes. This limit is part of the acceptance, not a footnote to it.
4. Required of the executor, not optional and not a re-run: correct
   `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md` so §5.1 and §2.2 state
   which code the 19-pass belongs to, mark the current tuple-key version's
   real-database status `[NOT VERIFIED]` with its reason, cite the equivalence
   measurement as `[VERIFIED]` coordinator work, and label the resulting
   same-result judgement `[INFERENCE]`. Also record the discarded keying script
   against DEC-0076 point 5, and the two hygiene findings above.
5. Refused, unchanged: relaxing the 5 s threshold (DEC-0077 point 4, DEC-0078
   point 6). It was not touched and must stay untouched.
6. No new authorization is granted. The server-loopback response-time
   measurement stays deferred (DEC-0077 point 6). W4 formal acceptance, G5,
   release, nginx/TLS/DNS and legacy cutover remain unauthorized. S4's `crm_test`
   leg remains `[UNVERIFIED — single source]` per DEC-0070 point 4. The P2
   hardcoded `user_status=UserStatus.ENABLED` stays open.

### Consequences

- G5 is now the next gate: it requires presenting migration impact and a
  downgrade/restore plan, and a separate immediate authorization. Nothing in this
  entry opens it.
- Recorded coordinator lesson: mtime ordering is now checked against the round's
  own artifacts, not only against files the executor claims not to have touched.
  Comparing the evidence log's write time with the source's write time is what
  exposed a 14-minute gap that the report presented as one atomic result.
- Recorded pattern, fourth occurrence: a status line claiming more than the run
  behind it supports. The countermeasure remains DEC-0073 point 4.

## DEC-0080: TASK-0008 task-card scope confirmed; implementation not authorized

- Date: 2026-08-04
- Status: ACTIVE
- Decided by: Product owner (scope confirmation); engineering defaults by
  coordinator under DEC-0002 / DEC-0003
- Affects: `TASK-0008`, gap analysis, DeepSeek orchestration prompts
- Supersedes: none

### Decision

1. The product owner confirmed **option 1 only**: the TASK-0008 task card scope
   is accepted as the intended repair boundary. This is **not** implementation
   authorization. No application code, migration against shared/production
   databases, deployment, or real-data mutation is opened.
2. Standing collaboration rule restated by the product owner in this session:
   the product owner decides only real business-scenario choices; code and
   engineering defaults are owned by AI tools under DEC-0002 / DEC-0003.
3. Former gap-analysis §8 unknowns are therefore locked as **engineering
   defaults** (recorded in `docs/evidence/TASK-0008-GAP-ANALYSIS.md` §8 and the
   TASK-0008 card), not as open product questionnaires:
   - P2 `user_status=ENABLED` hardcoding: repair (pass session-verified status).
   - R-029 category vocabulary at write time: `电话` / `微信` / `面谈` / `邮件` /
     `其他`; free-text `interaction_method` remains owner-detail.
   - R-035: create-time exact match only (institution normalized name; contact
     same institution + same non-empty channel); no-leak; confirm-to-continue;
     no auto-merge; no fuzzy/region matching in this task.
   - R-031/R-036 in scope: correction, withdrawal, archive, admin-exception
     read with reason+audit. **Out of scope:** owner transfer / batch transfer
     (SPEC-0002 R-009~R-012).
   - AC-012 / R-028: dedicated positive automated tests required.
4. Orchestration model for this track: the coordinator (architect) owns task
   decomposition and writes bounded DeepSeek prompts under `docs/handoffs/`;
   DeepSeek executes only the currently unlocked step. Implementation step
   prompts remain **locked** until a later decision explicitly authorizes
   TASK-0008 implementation (product owner must choose authorize, not merely
   confirm scope).
5. Unchanged and still unauthorized: TASK-0001 G5, W4 formal acceptance,
   release, nginx/TLS/DNS, legacy cutover, real-data mutation, and any
   `crm_test` round not covered by its own immediate authorization.

### Consequences

- TASK-0008 status stayed `PROPOSED` / `NOT AUTHORIZED` with scope frozen until
  a later explicit implementation authorization (see `DEC-0081`).
- DeepSeek was forbidden from `src/` edits under this decision alone.
- S0 freeze/audit remained coordinator work, not DeepSeek work.

## DEC-0081: Authorize TASK-0008 implementation (Step 1 unlocked only)

- Date: 2026-08-04
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0008`, DeepSeek implementation steps, file ownership vs
  `TASK-0001` overlapping paths
- Supersedes: the “implementation not authorized” consequence of `DEC-0080`
  (scope confirmation and engineering defaults in DEC-0080 remain in force)

### Decision

1. The product owner authorized **TASK-0008 implementation** with the single-word
   reply `授权` on 2026-08-04, after the coordinator clarified in-session that
   authorization opens **DeepSeek code implementation**, not coordinator coding.
2. Role split (restated and binding for this task):
   - **Coordinator** (opencode / grok-4.5): audit, freeze checks, orchestration,
     step acceptance, DEC/task-card maintenance. Does **not** implement
     application code for TASK-0008.
   - **DeepSeek**: sole implementation executor for unlocked steps only.
   - **Product owner**: message relay and business/authorization decisions only.
3. Unlock **Step 1 only** (contracts, dead-code fix/removal for `from_dict` and
   empty contact loop, revision+audit transaction design evidence). Steps 2–6
   stay locked until the coordinator accepts the prior step in writing in the
   repository (evidence or task card).
4. Task card moves to `docs/tasks/active/TASK-0008-core-record-workflow-repair.md`
   with status ACTIVE. Owned paths listed on that card are **exclusive to
   TASK-0008** while it holds an unlocked implementation step; TASK-0001 must
   not edit those same paths concurrently (TASK-0001 next gate remains G5 and
   is separately unauthorized).
5. Unchanged and still unauthorized under this DEC: TASK-0001 G5, W4 formal
   acceptance, release, nginx/TLS/DNS, legacy cutover, real-data mutation,
   owner transfer/batch transfer, and any `crm_test`/SSH/server round not named
   by its own immediate authorization.
6. DEC-0080 engineering defaults remain locked (R-029 vocabulary, R-035 exact
   match, P2 repair, AC-012/R-028 dedicated tests, no owner transfer in scope).

### Consequences

- DeepSeek may edit only the paths and step scope named in the coordinator’s
  current unlocked prompt.
- Coordinator pastes one step prompt at a time; DeepSeek never self-unlocks and
  never receives audit-only assignments.
- Completion of Step 1 does not authorize Step 2.

## DEC-0082: Authorize TASK-0008 gated `crm_test` verification round (coordinator-run)

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0008 remaining real-database verification only
- Does not authorize: deploy, nginx/TLS/DNS, G5, W4 formal acceptance, real
  business data mutation, owner transfer, dropping `crm_test`, reading rotated
  production secrets from `/opt/anqiao-crm/shared/database.env`

### Decision

1. The product owner selected option **1** (“连测试库再验一遍 / `crm_test`”) on
   2026-08-05 after the coordinator listed three remaining choices
   (crm_test / browser visual / deploy).
2. One verification round is authorized against the existing isolated empty
   test database `crm_test` on the production PostgreSQL host, using the route
   already proven by TASK-5A / DEC-0076:
   - SSH local port forward to the server’s loopback PostgreSQL;
   - test-only role `crm_test_runner`;
   - credentials from gitignored `.env.crm_test_local` (values never printed);
   - `CRM_RUN_POSTGRESQL_TESTS=1` gated suite against `crm_test` only.
3. Executor for this round: **coordinator** (opencode / grok-4.5). DeepSeek is
   not assigned (verification/audit is coordinator work).
4. Fail-closed stops (unchanged): `current_database()` must be `crm_test`
   before any write; no connection to `anqiao_crm`; no server config/service
   changes; no credential printing; no application-code edits in this round
   unless a separate fix DEC is recorded after a failure.
5. Evidence: `docs/evidence/TASK-0008-CRM-TEST-VERIFICATION.md` with exact
   commands (redacted), totals, and isolation proof.

### Consequences

- Browser visual acceptance and deploy remain unauthorized until separately chosen.
- A failed gated run stops at PARTIAL; fixing application code requires a new DEC.

## DEC-0083: Authorize deployment of TASK-0008 code to Tencent Cloud server

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Product owner
- Affects: `/opt/anqiao-crm/` on `ubuntu@124.222.212.159`, `anqiao_crm` database,
  `anqiao-crm` systemd service, nginx `crm` site

### Decision

1. The product owner requested deployment to the Tencent Cloud Lighthouse
   server with the message "请部署到我的腾讯云轻量服务器" on 2026-08-05.
2. Coordinator executed the deployment:
   - backed up existing `/opt/anqiao-crm/src` and `/opt/anqiao-crm/templates`
     to `/opt/anqiao-crm/backup/pre-task0008-20260805_125406/`;
   - synced `src/crm/*` and `templates/*` to the server via `scp`;
   - ran `alembic upgrade head` on `anqiao_crm` (already at head — no new
     migration needed, schema unchanged);
   - restarted `anqiao-crm` systemd service.
3. No nginx/TLS/DNS changes were needed (existing config proxies to port 8200).
4. No new dependencies installed (existing venv already has all required
   packages).

### Consequences

- The CRM at `https://crm.aibrain.wiki` now runs TASK-0008 code.
- Browser visual acceptance by the product owner is the only remaining gate.

## DEC-0084: TASK-0012 UI enhancement scope confirmed; implementation not yet authorized

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Product owner (scope confirmation); engineering defaults by
  coordinator under DEC-0002 / DEC-0003
- Affects: `TASK-0012`, UI enhancement scope, DeepSeek orchestration
- Supersedes: none

### Decision

1. The product owner confirmed the prioritized work plan and agreed with the
   execution order: UI enhancement first, then search, then integration test
   baseline, then bulk import, then opportunity discovery, then G5.
2. The product owner requested that the UI enhancement be decomposed into a
   SPEC-compliant task and given to DeepSeek to complete in one pass.
3. TASK-0012 scope is confirmed as the intended repair boundary:
   - Dashboard: real statistics, quick actions, recent institutions list.
   - Institution list: search bar, pagination, better table.
   - Institution detail: card layout, timeline follow-ups, action buttons.
   - Form pages: consistent styling, better UX.
   - Navigation: shared base template with consistent navbar.
   - Search UI entry point on institution list (SPEC-0008 minimal).
4. This is **scope confirmation only**. No application code is authorized yet.
5. Standing collaboration rule restated: the product owner decides only real
   business-scenario choices; code and engineering defaults are owned by AI
   tools under DEC-0002 / DEC-0003.

### What this task does NOT change

- No changes to business logic, domain models, policy projections, or field
  masking rules (SPEC-0001 R-030).
- No new API endpoints (existing `/api/institutions` supports search/pagination).
- No database migration.
- No deployment (separate gate).
- No JavaScript framework, no external CDN dependencies.
- No real-data mutation.

### Consequences

- TASK-0012 status stayed `PROPOSED` with scope frozen until implementation
  authorization (see `DEC-0085`).
- DeepSeek was forbidden from edits under this decision alone.

## DEC-0085: Authorize TASK-0012 UI enhancement implementation (all 5 steps unlocked for one-pass execution)

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Product owner
- Affects: `TASK-0012`, DeepSeek implementation, file ownership
- Supersedes: the "implementation not authorized" consequence of `DEC-0084`

### Decision

1. The product owner authorized **TASK-0012 implementation** with the reply
   "同意。请按照spec规范分解任务，让deepseek-v4-flash按照目标来一次性做完" on
   2026-08-05, confirming both the plan direction and the one-pass execution
   model.
2. Role split (binding for this task):
   - **Coordinator** (opencode): audit, orchestration, step acceptance,
     DEC/task-card maintenance. Does **not** implement application code.
   - **DeepSeek**: sole implementation executor for all 5 steps in one pass.
   - **Product owner**: message relay and business/authorization decisions only.
3. **All 5 steps are unlocked at once** (one-pass execution), unlike
   TASK-0008's step-by-step unlock model. The product owner explicitly requested
   "一次性做完". DeepSeek executes all 5 steps, then reports back.
4. Task card is at
   `docs/tasks/active/TASK-0012-ui-enhancement.md` with status ACTIVE.
   Owned paths listed on that card are **exclusive to TASK-0012** while it is
   active; no other task may edit those paths concurrently.
5. Owned paths: `templates/*.html`, `templates/base.html` (new), `static/`
   (new), `src/crm/web/main.py` (page route wiring only — `q` and `page` params),
   `docs/evidence/TASK-0012-*`, and this task card.
6. Unchanged and still unauthorized: TASK-0001 G5, W4 formal acceptance,
   release/deployment, nginx/TLS/DNS, legacy cutover, real-data mutation,
   `crm_test`/SSH/server rounds, any `src/crm/policy/`, `src/crm/domain/`,
   `src/crm/persistence/` changes.
7. Verification gate: local suite must stay green (`pytest tests/ -q` with 0
   failures); governance `[PASS]`; coordinator visual inspection of rendered
   templates. Browser visual acceptance by product owner after deployment is a
   separate gate.

### Consequences

- DeepSeek may edit only the paths named in the task card and the handoff
  prompt at `docs/handoffs/HANDOFF-20260805-DEEPSEEK-TASK-0012-UI-ENHANCEMENT.md`.
- After DeepSeek reports completion, the coordinator audits: runs the local
  suite, governance check, and visually inspects the templates.
- Deployment is a separate decision (like DEC-0083 for TASK-0008).
- If the implementation reveals a missing product decision or a needed
  policy/domain change, DeepSeek must stop and report rather than expanding
  scope.

## DEC-0086: TASK-0012 UI enhancement ACCEPTED by coordinator audit; deployment gate pending

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Coordinator (audit acceptance under DEC-0085 point 7)
- Affects: TASK-0012, `templates/*.html`, `static/css/style.css`,
  `src/crm/web/main.py`
- Relationship to prior decisions: adjudicates the implementation DEC-0085
  authorized. It grants no deployment, migration, or server authorization.

### What the coordinator verified independently

[VERIFIED] All 11 files claimed in DeepSeek's completion report are present
and modified as described:
- `templates/base.html` — NEW, 64 lines, shared Jinja2 layout with navbar,
  content block, logout JS with CSRF token
- `static/css/style.css` — NEW, 545 lines, self-contained stylesheet
  (navbar, cards, forms, tables, pagination, timeline, contact cards,
  search bar, stats grid, responsive layout, no external CDN)
- `templates/dashboard.html` — REWRITTEN, inherits `base.html`, loads real
  stats from `/api/institutions` via JS, quick actions, recent institutions
  list, no `--` placeholders
- `templates/institutions_list.html` — REWRITTEN, inherits `base.html`,
  search bar with `q` param, pagination (prev/next/page info), better table,
  empty state
- `templates/institution_detail.html` — REWRITTEN, inherits `base.html`,
  card layout, follow-up timeline, contact cards, action buttons, admin
  exception entry with reason input
- `templates/institution_create.html` — REWRITTEN, inherits `base.html`,
  consistent styling, form grouping, placeholder hints
- `templates/contact_create.html` — REWRITTEN, inherits `base.html`,
  consistent styling, form grouping
- `templates/followup_create.html` — REWRITTEN, inherits `base.html`,
  consistent styling, UUID hint added
- `templates/login.html` — POLISHED, uses `style.css`, cleaner layout
- `src/crm/web/main.py` — MODIFIED, `/institutions` route accepts `q` and
  `page` params, passes `search_terms`, `limit`, `offset` to
  `find_institutions`, passes `q`/`page`/`total_pages` to template context
- `docs/evidence/TASK-0012-ACCEPTANCE.md` — NEW, evidence file present

[VERIFIED] CSRF tokens preserved in all 3 form templates:
`institution_create.html:17`, `contact_create.html:17`,
`followup_create.html:17`. Logout JS in `base.html:50` uses
`csrf_token|default("")`.

[VERIFIED] No policy/domain/persistence source changes. The `.pyc` files
under `src/crm/policy/__pycache__/`, `src/crm/domain/__pycache__/`, and
`src/crm/persistence/__pycache__/` were recompiled (mtimes 2026-08-05
14:07:48-49) but the corresponding `.py` source files were not modified.

[VERIFIED] No new API endpoints. The existing `/api/institutions` API
(`q`, `page`, `limit` params) and `/api/institutions/{id}` are unchanged.
The `/institutions` page route in `main.py` was modified to accept `q` and
`page` query parameters and pass them to `query_service.find_institutions`
— this is page-route wiring only, within the task card's owned scope.

[VERIFIED] No database migration, no schema change, no new dependencies, no
external CDN, no JavaScript framework.

[VERIFIED] Local suite reproduced by coordinator:
`scripts/dev-test.ps1` → `183 passed, 28 skipped, 0 failed` in 27.37s.
Governance: `scripts/check-governance.ps1` → `[PASS]`.

[VERIFIED] `main.py` compiles: `py_compile.compile` → OK.

### Decision

1. TASK-0012 is **ACCEPTED** by coordinator audit. All 5 steps are
   verified: shared layout, dashboard, institution list, institution
   detail, form pages, route wiring.
2. The implementation respects all constraints: no business logic change,
   no policy/domain/persistence change, no new API endpoints, no
   migration, CSRF tokens preserved, self-contained CSS, server-rendered
   Jinja2 + vanilla JS.
3. Deployment to `https://crm.aibrain.wiki` and browser visual acceptance
   by the product owner are the remaining gates. They require a separate
   decision (like DEC-0083 for TASK-0008).

### Consequences

- Ordered next path: product-owner decision on deployment → if authorized,
  deploy to server → product-owner browser visual acceptance.
- Still unauthorized: TASK-0001 G5, W4 formal acceptance, release,
  nginx/TLS/DNS, legacy cutover, real-data mutation, `crm_test`/SSH/server
  rounds not covered by their own authorization.

## DEC-0087: Authorize deployment of TASK-0012 UI enhancement to Tencent Cloud server

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Product owner (explicit authorization, 2026-08-05)
- Affects: `/opt/anqiao-crm/` on `ubuntu@124.222.212.159`, `anqiao-crm`
  systemd service
- Relationship to prior decisions: approves deployment of the code accepted
  in DEC-0086. Reuses the deployment model from DEC-0083.

### Decision

1. The product owner authorized deployment of TASK-0012 UI enhancement code
   to the Tencent Cloud Lighthouse server on 2026-08-05.
2. Deployment scope:
   - Sync `templates/*.html` (7 rewritten + 1 new `base.html`) to
     `/opt/anqiao-crm/templates/`;
   - Sync `static/css/style.css` (new) to `/opt/anqiao-crm/static/css/`;
   - Sync `src/crm/web/main.py` (modified page route wiring) to
     `/opt/anqiao-crm/src/crm/web/main.py`;
   - Restart `anqiao-crm` systemd service.
3. No nginx/TLS/DNS changes needed (existing config proxies to port 8200).
4. No database migration (no schema change — UI-only).
5. No new dependencies (existing venv has all required packages).
6. Back up existing `templates/` and `src/` on the server before syncing.

### Consequences

- The CRM at `https://crm.aibrain.wiki` will run TASK-0012 enhanced UI.
- Browser visual acceptance by the product owner is the only remaining gate.

## DEC-0088: Draft SPEC-0014 (account credentials self-modification) prepared for approval

- Date: 2026-08-05
- Status: ACTIVE (DRAFT prepared; approval PENDING)
- Decided by: Product owner (requested the capability), ZCode agent (drafted SPEC)
- Affects: account credentials management; new SPEC slot `SPEC-0014`
- Relationship to prior decisions: extends `SPEC-0002 v0.2.0` identity model
  without amending it; `SPEC-0002` non-goals (password policy, identity
  provider) remain in force.

### Background

The product owner requested on 2026-08-05 that the CRM allow modification of
username and password, with `sa` and `dl` username prefixes protected from
modification. This is a new application capability not covered by any approved
SPEC (`SPEC-0002` defines identity/roles/transfer but not credential
self-modification). Per `AGENTS.md` §5 SDD state machine, application code
cannot be edited without an approved SPEC, so a new SPEC must be drafted and
approved before any implementation task is authorized.

### Decision

1. ZCode agent drafted `SPEC-0014 v0.1.0` at
   `docs/specs/10-draft/SPEC-0014-account-credentials-modification.md` defining:
   - enabled business users / administrators may modify their own username and
     password through an application entry point;
   - password change requires verifying the current password; username change
     requires the same (high-risk, double confirmation);
   - usernames whose `lower()` form starts with `sa` or `dl` cannot be modified
     (protected prefix); password changes are unaffected by this rule;
   - successful change invalidates all existing sessions via
     `bump_session_epoch` (aligns with `SPEC-0002` R-014);
   - audit event written without password plaintext; audit failure rolls back
     the credential change;
   - non-goals: admin changing others' credentials, password strength policy,
     SSO, forgotten-password reset, display_name modification.
2. `SPEC-0014` is a new SPEC slot (next available after `SPEC-0013`); it does
   not amend `SPEC-0002`.
3. The SPEC is recorded as DRAFT in `docs/specs/INDEX.md`.
4. Three open decisions are flagged in the SPEC (OD-001 cooldown, OD-002 admin
   prefix protection, OD-003 admin-changes-others) — these do not block the
   first version; defaults are stated.

### Authorization boundary

This decision records that the DRAFT was prepared. It does **not** approve
`SPEC-0014`, does not authorize implementation, and does not open a task.
Approval requires the product owner to explicitly approve `SPEC-0014 v0.1.0`
(then it moves to `30-approved` with matching approval metadata); a separate
decision authorizes any implementation task and assigns it to DeepSeek.

### Consequences

- `SPEC-0014 v0.1.0` is available for product-owner review.
- No application code may be edited until `SPEC-0014` is approved AND an active
  task is authorized.
- After approval, a task card and a handoff to DeepSeek will be prepared.

## DEC-0089: Authorize DeepSeek local implementation sequence for approved SPEC baseline

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Product owner (explicit request to continue development and have
  DeepSeek complete the approved SPECs; coordinator audits the returned report)
- Affects: approved SPEC-0001 through SPEC-0013 implementation sequence; new
  DeepSeek task cards and handoffs
- Does not affect: draft SPEC-0014, production deployment, real-data mutation,
  remote PostgreSQL/SSH rounds, release/cutover, credentials, billing, or
  external side effects

### Decision

1. The product owner authorizes the coordinator to decompose the remaining
   approved SPEC gaps into bounded implementation tasks and assign the
   implementation executor to DeepSeek.
2. DeepSeek is the sole implementation executor for one task at a time. The
   coordinator owns task activation, ownership-conflict checks, independent
   audit, governance checks, and acceptance/rejection; the product owner only
   relays messages and decides any newly exposed business or safety choice.
3. The authorized implementation environment is local synthetic data only.
   Every task must stop before deployment, remote database/SSH access, real
   data, destructive migration, credential changes, paid services, or external
   writes unless a separate decision authorizes that exact action.
4. The existing task cards remain the source of historical evidence. A new
   task may not edit a path still owned by an existing active task until the
   coordinator records an explicit ownership release or supersession in the
   task cards.
5. `SPEC-0014` remains draft-only and is excluded from this sequence.

### Required handoff contract

- The coordinator must write one task card and one handoff document per
  bounded task before DeepSeek edits application code.
- DeepSeek must re-read `AGENTS.md`, the approved SPEC, approval metadata, the
  task card, relevant decisions, and actual source state before editing.
- DeepSeek must return a structured report containing exact changed paths,
  commands and results, failed/skipped/not-verified checks, SPEC/AC mapping,
  risks, and the next bounded task. A completion claim without those artifacts
  is not accepted evidence.
- The coordinator must independently re-check the repository and rerun the
  applicable tests plus `powershell -ExecutionPolicy Bypass -File
  scripts/check-governance.ps1` before marking any task accepted.

### Consequences

- The implementation roadmap and handoff package are recorded under
  `docs/evidence/SPEC-COMPLETION-ROADMAP-20260805.md` and
  `docs/handoffs/HANDOFF-20260805-DEEPSEEK-SPEC-COMPLETION.md`.
- New task cards begin in `PROPOSED / AUTHORIZED-PENDING-OWNERSHIP-RELEASE`
  until the coordinator activates exactly one card after the path check.
- No application code is changed by this decision alone.

## DEC-0090: Release completed-task implementation ownership and activate TASK-0009

- Date: 2026-08-05
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089` points 1-4
- Affects: task-path ownership only; no product behavior, application code,
  deployment, remote resource, or real data

### Decision

1. `TASK-0001` retains only its separately gated remote G5/W4 historical
   record. Its broad local application/test path ownership is released for the
   `DEC-0089` sequence. G5 is not authorized by this release.
2. `TASK-0008` and `TASK-0012` remain accepted with their separate browser
   visual-acceptance records, but their implementation-path ownership is
   released. Their acceptance status and production evidence are unchanged.
3. `TASK-0009` is moved to `docs/tasks/active/` and activated with DeepSeek as
   the sole current implementation owner. Its ownership is limited to the
   dependency/integration-test paths enumerated on its card.
4. `TASK-0010`, `TASK-0011`, and `TASK-0014` through `TASK-0018` remain
   proposed and own no application path until the coordinator independently
   accepts TASK-0009 and activates exactly one successor card.

### Consequences

- DeepSeek may begin TASK-0009 after completing the mandatory preflight in
  `HANDOFF-20260805-DEEPSEEK-SPEC-COMPLETION.md`.
- Any scope conflict discovered by DeepSeek remains a fail-closed stop; this
  release does not permit out-of-scope edits.
- The coordinator must audit the TASK-0009 report before activating TASK-0014.

## DEC-0091: Reassign TASK-0009 remediation executor to GLM-5.2

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Product owner, relayed to coordinator
- Affects: TASK-0009 implementation ownership only; no product behavior,
  deployment, remote resource, or real data

### Decision

1. The previous TASK-0009 completion claim is `PARTIAL / NOT ACCEPTED` per
   `docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md`.
2. GLM-5.2 replaces DeepSeek as the sole implementation executor for the
   bounded TASK-0009 remediation described in
   `docs/handoffs/HANDOFF-20260806-GLM52-TASK-0009-REMEDIATION.md`.
3. The existing TASK-0009 owned paths, local synthetic boundary, verification
   requirements, and coordinator audit gate are unchanged.
4. TASK-0014 remains proposed and must not be activated until TASK-0009 is
   independently accepted.

### Consequences

- GLM-5.2 must re-read the repository contract and the audit evidence before
  editing.
- No out-of-scope application path is authorized by this reassignment.
- A GLM-5.2 self-report is not acceptance evidence; the coordinator must rerun
  the relevant checks and decide the verdict.

## DEC-0092: Accept TASK-0009 remediation and activate TASK-0014

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089` and `DEC-0090`
- Affects: TASK-0009 acceptance, TASK-0009 local path ownership, TASK-0014 activation
- Does not affect: product behavior beyond the approved TASK-0014 scope,
  deployment, remote PostgreSQL/SSH, production data, credentials, billing, or
  external writes

### Decision

1. The coordinator independently accepts the GLM-5.2 TASK-0009 remediation.
   Evidence is recorded in
   `docs/evidence/TASK-0009-COORDINATOR-ACCEPTANCE-20260806.md`.
2. Independent evidence is `4` focused parity/write tests passed, `1` CSRF
   mutation test passed, `184 passed / 28 skipped / 1 warning` in each of five
   repeated full local runs, clean `pip check`, `compileall` exit 0, governance
   `[PASS]`, 23 `TemplateResponse` matches, and 8/8 legacy manifest hashes.
3. TASK-0009 local implementation ownership is released. The prior
   `backup/legacy-scripts/` move remains un-attributed because this worktree has
   no commits; the files are preserved and the manifest is evidence only.
4. Activate `TASK-0014` at
   `docs/tasks/active/TASK-0014-core-semantic-security-closure.md` with
   DeepSeek as the sole implementation owner. Its handoff is
   `docs/handoffs/HANDOFF-20260806-DEEPSEEK-TASK-0014-CORE-SEMANTIC-SECURITY-CLOSURE.md`.
5. TASK-0014 is local synthetic implementation only. It must stop on any
   approved-SPEC conflict or request to edit an unowned path; no successor task
   may start from this decision.

### Consequences

- TASK-0009 is `ACTIVE / ACCEPTED` and no longer blocks the sequence.
- TASK-0014 is the only active successor implementation task in the
  SPEC-completion sequence; TASK-0010, TASK-0011, TASK-0015, TASK-0016,
  TASK-0017, and TASK-0018 remain proposed.
- Browser visual acceptance and all remote/production checks remain
  `NOT VERIFIED` and unauthorized by this decision.

## DEC-0093: Reassign TASK-0014 implementation executor to GLM-5.2

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Product owner, relayed to coordinator
- Affects: TASK-0014 implementation ownership only
- Supersedes: the DeepSeek executor assignment in `DEC-0092` point 4
- Does not affect: TASK-0014 scope, approved SPECs, owned paths, verification
  gates, deployment, remote PostgreSQL/SSH, production data, credentials,
  billing, or external writes

### Decision

1. GLM-5.2 replaces DeepSeek as the sole implementation executor for
   `TASK-0014-core-semantic-security-closure.md`.
2. The approved scope remains the P0/P1 core semantic and write-authorization
   closure under `SPEC-0001` and `SPEC-0002`: disabled/no-role write denial,
   deterministic owner classification, archive authority, withdrawn-history
   projection, and negative regression coverage.
3. The existing TASK-0014 owned paths, local synthetic boundary, stop rules,
   acceptance criteria, and coordinator audit gate are unchanged.
4. GLM-5.2 must use the new handoff
   `docs/handoffs/HANDOFF-20260806-GLM52-TASK-0014-CORE-SEMANTIC-SECURITY-CLOSURE.md`.
   The earlier DeepSeek handoff remains historical and is not an active
   authorization for DeepSeek edits.
5. TASK-0015 and all later tasks remain blocked until TASK-0014 is independently
   accepted by the coordinator.

### Consequences

- TASK-0014 remains `ACTIVE / IMPLEMENTATION-READY`, now owned exclusively by
  GLM-5.2.
- No application code is changed by this reassignment decision.
- A GLM-5.2 self-report is not acceptance evidence; the coordinator must rerun
  focused tests, the full local suite, compile checks as applicable, and
  `check-governance.ps1`.

## DEC-0094: TASK-0014 coordinator audit not accepted; one bounded GLM-5.2 correction required

- Date: 2026-08-06
- Status: ACTIVE / REMEDIATION-REQUIRED
- Decided by: Coordinator under `DEC-0089` and `DEC-0093`
- Affects: TASK-0014 acceptance state and its existing local owned paths only
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, real-data writes, or successor-task
  activation

### Verified audit evidence

1. The GLM-5.2 focused suite passed independently: `11 passed`.
2. The full local suite passed independently: `195 passed, 28 skipped,
   1 warning`; `compileall` exited 0; governance returned `[PASS]`.
3. These checks do not establish acceptance because two authorization failures
   were reproduced against the supplied SQLite-backed TASK-0014 fixture:
   - An ordinary `BUSINESS_USER` owner sent
     `POST /api/institutions/{id}/archive` with only `archive_reason` and
     received `200` with `archived: true`. This contradicts `SPEC-0001 R-036`
     and the task's required administrator-only archive exception.
   - The same ordinary owner sent
     `GET /api/institutions/{id}?administrator_reason=owner_supplied_reason`
     and received `200` containing the withdrawn activity. No administrator
     exception audit is written for that request. This contradicts the task's
     normal-history/audited-exception boundary and `SPEC-0001 R-015/R-031`.
4. Evidence, exact commands, code paths, and the required regression coverage
   are recorded in `docs/evidence/TASK-0014-COORDINATOR-AUDIT-20260806.md`.

### Decision

1. The GLM-5.2 TASK-0014 completion claim is `NOT ACCEPTED`.
2. GLM-5.2 remains the sole implementation owner for one consolidated,
   same-task correction under
   `docs/handoffs/HANDOFF-20260806-GLM52-TASK-0014-REMEDIATION.md`.
3. The correction must remain within the existing TASK-0014 owned paths and
   local synthetic boundary. It must not activate TASK-0010, TASK-0015, or any
   later task.
4. A revised self-report is not acceptance evidence; the coordinator must
   independently rerun the focused suite, the full suite, compile checks, the
   governance check, and the two adversarial paths before accepting the task.

### Consequences

- TASK-0014 remains the only active successor implementation task.
- TASK-0010, TASK-0011, TASK-0015, TASK-0016, TASK-0017, and TASK-0018 remain
  proposed and own no implementation path.

## DEC-0095: TASK-0014 second coordinator audit not accepted; final consolidated GLM-5.2 correction required

- Date: 2026-08-06
- Status: ACTIVE / REMEDIATION-REQUIRED
- Decided by: Coordinator under `DEC-0089`, `DEC-0093`, and `DEC-0094`
- Affects: TASK-0014 acceptance state and its existing local owned paths only
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, real-data writes, or successor-task
  activation

### Verified audit evidence

1. The coordinator independently reproduced the GLM-5.2 reported automated
   results: `14 passed` in the focused suite; `198 passed, 28 skipped, 1
   warning` in the full local suite; `compileall` exit 0; governance `[PASS]`.
2. Those checks do not establish acceptance. Against the supplied SQLite-backed
   TASK-0014 fixture, a principal with both `BUSINESS_USER` and
   `ADMINISTRATOR` sent `administrator_reason=%20%20%20` to API detail and
   received the withdrawn activity. API and page paths also wrote successful
   `admin.exception_read` events with reason `"   "`. This conflicts with the
   `strip() or None` policy condition and the audited-exception boundary in
   `SPEC-0001 R-015/R-031`.
3. An administrator archived a record with distinct
   `administrator_reason="exception_authorization_reason"` and
   `archive_reason="record_retention_reason"`. The transactional
   `institution.archive` audit recorded only the latter. The actual reason
   authorizing the administrator exception is therefore not retained, contrary
   to `SPEC-0001 R-036` and the prior remediation handoff.
4. Exact code paths, reproductions, commands, and missing regression coverage
   are recorded in
   `docs/evidence/TASK-0014-COORDINATOR-REMEDIATION-AUDIT-2-20260806.md`.

### Decision

1. The latest GLM-5.2 TASK-0014 completion claim is `NOT ACCEPTED`.
2. GLM-5.2 remains the sole implementation owner for one final consolidated
   correction under
   `docs/handoffs/HANDOFF-20260806-GLM52-TASK-0014-REMEDIATION.md`.
3. The correction must stay within the existing TASK-0014 owned paths and
   local synthetic boundary. It must not activate TASK-0010, TASK-0015, or any
   later task.
4. A revised self-report is not acceptance evidence. Before accepting this
   task, the coordinator must independently rerun the focused and full suites,
   compile and governance checks, and the four adversarial paths in the
   updated handoff.

### Consequences

- TASK-0014 remains the only active successor implementation task.
- TASK-0010, TASK-0011, TASK-0015, TASK-0016, TASK-0017, and TASK-0018 remain
  proposed and own no implementation path.

## DEC-0096: Clarify TASK-0014 archive reason and correct the second audit scope

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0093`, `DEC-0094`, and
  `DEC-0095`
- Affects: the active TASK-0014 remediation instructions only
- Does not affect: approved SPECs, implementation ownership, deployment,
  remote PostgreSQL/SSH, production data, credentials, billing, real-data
  writes, or successor-task activation

### Verified interpretation

1. `SPEC-0001 R-036` requires administrator archive as an exception with a
   reason and an audit record. It does not define two distinct reasons or an
   `administrator_reason` archive API field.
2. The existing `ArchiveInstitutionCommand` validates one nonblank
   `archive_reason`, persists it on the institution, and records the same
   reason, actor, target, and timestamp transactionally in
   `institution.archive`. This satisfies the approved reason-and-audit rule.
3. The distinct-two-reasons reproduction in `DEC-0095` therefore demonstrated
   an unapproved remediation-introduced interface, not a violation of the
   approved SPEC. `DEC-0095` finding 3 and its demand to preserve a separate
   authorization reason are retracted.

### Decision

1. The only remaining acceptance-blocking defect is the independently
   reproduced whitespace-only read-exception inconsistency: an owner with both
   `BUSINESS_USER` and `ADMINISTRATOR` can receive withdrawn activity data and
   blank exception audits through API/page paths.
2. GLM-5.2 remains the sole executor of TASK-0014. The corrected handoff
   requires it to normalize read-exception reasons consistently and remove the
   unapproved archive `administrator_reason` field, restoring one normalized
   `archive_reason` for authorization, persistence, and audit.
3. No `ArchiveInstitutionCommand`, audit-schema, or two-reason feature work is
   authorized unless a new approved SPEC explicitly requires it.
4. TASK-0010, TASK-0011, TASK-0015, and all later tasks remain blocked pending
   independent acceptance of the corrected TASK-0014.

## DEC-0097: TASK-0014 second remediation accepted; TASK-0010 released as next successor

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0092`, `DEC-0093`, `DEC-0094`,
  `DEC-0095`, and `DEC-0096`
- Affects: TASK-0014 acceptance state and successor sequencing only
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, real-data writes, or any further
  task's implementation authorization

### Verified audit evidence

1. The coordinator independently re-ran every claimed check against the
   corrected code: `21 passed` in the focused TASK-0014 suite; `205 passed,
   28 skipped, 1 warning` in the full local suite; `compileall` exit 0;
   governance `[PASS]`.
2. `DEC-0096` requirement 1 is met: `ArchiveInstitutionRequest` carries only
   `archive_reason`; the archive gate requires `ADMINISTRATOR` plus a
   nonblank stripped reason, and the same reason is persisted and audited
   (`src/crm/web/routes/institutions.py:45-52,319-343`).
3. `DEC-0096` requirement 2 is met: `_normalize_reason` (`strip() or None`)
   in `src/crm/application/queries.py:31-42` is applied inside both
   QueryService read methods for `include_withdrawn` and the `project_record`
   argument, and the API list/detail and page-detail routes gate
   `is_admin_exception` and the audit reason on the normalized value.
4. Regression tests for the whitespace-only reason, single-reason archive,
   blank-reason denial, and owner-archive denial were inspected and assert
   non-vacuous conditions (zero `admin.exception_read` rows, identical
   persisted/audited reason, concise-progress date unchanged).
5. One residual observation is recorded in the audit evidence: the new
   dual-role tests exercise a non-owner dual-role principal, so the
   activities-array leak path is covered via the concise-progress date rather
   than directly; the decision path is the shared normalization computation
   and coverage is functionally equivalent. Recorded as a future hardening
   candidate, not a blocker.

### Decision

1. The corrected TASK-0014 second remediation is **ACCEPTED** within its local
   synthetic scope. Evidence:
   `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md`.
2. The `DEC-0096` point-4 block is lifted for sequencing purposes. The next
   task in the approved roadmap order is `TASK-0010-search-security-verification`
   (prerequisites `DEC-0089` + TASK-0009 and TASK-0014 accepted are now met).
   TASK-0010 still requires its own ownership release and task activation
   before any code is edited; it remains local-synthetic only.
3. TASK-0015, TASK-0017, TASK-0011, TASK-0016, and TASK-0018 keep their
   recorded roadmap order and prerequisites unchanged.
4. This acceptance adds no deployment, remote-database, real-data, credential,
   or external-write authorization.

## DEC-0098: TASK-0010 ownership release and activation

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089` and `DEC-0097`
- Affects: TASK-0010 state and its owned paths only
- Does not affect: approved SPECs, any other task's state, deployment, remote
  PostgreSQL/SSH, production data, credentials, billing, real-data writes

### Verified prerequisites

1. `SPEC-0008 v0.1.0` is approved and its `.approval.json` `spec_sha256`
   equals the current file hash (recomputed 2026-08-06, match confirmed).
2. Sequence prerequisites are met: TASK-0007 ACCEPTED (`DEC-0067`), TASK-0008
   ACCEPTED (`DEC-0081`/`DEC-0082`/`DEC-0083`), TASK-0009 ACCEPTED
   (`DEC-0092`), TASK-0014 ACCEPTED (`DEC-0097`). TASK-0010 is next in the
   approved roadmap order and was released for sequencing by `DEC-0097`.
3. The task card's key assumption holds against current code:
   `src/crm/persistence/repositories.py:82-89` matches `name` OR
   `source_description` before policy projection, so search can reveal
   hidden-field existence through result presence. This is the defect the
   task exists to repair and prove closed.

### Decision

1. TASK-0010 (`search security repair and verification`) is ACTIVATED. The
   card moves to `docs/tasks/active/` with status ACTIVE / IMPLEMENTATION-READY.
2. Implementation owner: DeepSeek (per the task card's proposed owner). The
   owner becomes active upon accepting the handoff
   `docs/handoffs/HANDOFF-20260806-TASK-0010-SEARCH-SECURITY.md`; executor
   model identity is per self-report or UNKNOWN and is never an acceptance
   gate.
3. Owned paths are exactly those on the task card: search-specific
   query/repository code, the search portion of institution routes/templates,
   focused search permission/leakage tests, `docs/evidence/TASK-0010-*`, and
   the task card. No other file may be edited under this task.
4. Scope remains local synthetic only: no deployment, remote database/SSH,
   production data, credential changes, or external writes.
5. Acceptance requires all `SPEC-0008` AC-001 through AC-007 tests passing for
   owner, other user, management scope, administrator exception, and
   unauthorized actor, with negative tests proving hidden fields cannot
   affect observable results, followed by coordinator independent audit.

## DEC-0099: TASK-0010 executor assigned to GLM

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator on the product owner's instruction ("现在执行者是glm")
- Affects: TASK-0010 ownership record only
- Does not affect: TASK-0010 scope, owned paths, approved SPECs, sequencing,
  or any other task

### Decision

1. The TASK-0010 implementation owner is GLM. This supersedes the DeepSeek
   designation in `DEC-0098` point 2, which had followed the task card's
   proposed owner. Executor model identity remains per self-report or UNKNOWN
   and is never an acceptance gate.
2. All other `DEC-0098` terms are unchanged: same owned paths, same local
   synthetic scope, same handoff, same completion gate and coordinator
   independent audit requirement.
3. The task card, `docs/tasks/TASKS.md`, `docs/NOW.md`, and the handoff
   document are updated to name GLM as owner.

## DEC-0100: TASK-0010 first audit REMEDIATION-REQUIRED (management-scope test gap, matrix doc mismatch)

- Date: 2026-08-06
- Status: ACTIVE / REMEDIATION-REQUIRED
- Decided by: Coordinator under `DEC-0089`, `DEC-0098`, and `DEC-0099`
- Affects: TASK-0010 acceptance state and its existing owned paths only
- Does not affect: approved SPECs, other tasks, deployment, remote
  PostgreSQL/SSH, production data, credentials, billing, real-data writes

### Verified audit evidence

1. The coordinator independently re-ran the executor's claims: focused
   `30 passed` (9 TASK-0010 + 21 TASK-0014), full suite `214 passed,
   28 skipped, 1 warning`, `compileall` exit 0, governance `[PASS]`.
2. The core fix is verified correct and within owned paths: the searchable
   predicate is actor-aware in SQL (not post-hoc), the owner list path is
   conservatively restricted to the collaborator-visible set, no-role gets
   `WHERE false`, and the administrator exception requires a normalized
   nonblank reason. No TASK-0014 regression.
3. The coordinator independently reproduced that the AC-003 negative test
   fails against the old predicate (`name OR source_description`) and passes
   against the fixed one. Audit evidence:
   `docs/evidence/TASK-0010-COORDINATOR-AUDIT-20260806.md`.

### Decision

1. The TASK-0010 completion claim is **NOT ACCEPTED**. Two gate gaps remain:
   - **F1 (blocking)**: the task card's completion gate requires acceptance
     tests for a **management-scope actor**; no `MANAGER`/`GENERAL_MANAGER`
     search test exists, so the management branch in
     `src/crm/application/queries.py:267` is untested.
   - **F2 (blocking, documentation)**: the Step-1 matrix
     `docs/evidence/TASK-0010-VISIBLE-SEARCHABLE-FIELDS-MATRIX.md` "Fix
     approach" says owners search `source_description`, contradicting the
     implemented (correct) list-path restriction to the collaborator set.
2. GLM remains the sole executor (`DEC-0099`). The remediation is limited to:
   add management-scope search tests, and correct the matrix document. No
   application-code redesign is authorized; the verified predicate logic
   stands as-is unless a test proves it wrong.
3. A pre-existing unhandled-UUID 500 in the institution detail route
   (`/api/institutions/<non-uuid>`) is recorded as a P2 residual candidate
   for a future task; it is outside TASK-0010 owned paths and must NOT be
   fixed under this task.
4. TASK-0015 and all later tasks remain blocked pending independent
   acceptance of the corrected TASK-0010.

## DEC-0101: TASK-0010 remediation accepted

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0098`, `DEC-0099`, `DEC-0100`
- Affects: TASK-0010 acceptance state and successor sequencing only
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, real-data writes

### Verified audit evidence

1. Both `DEC-0100` findings are resolved and independently re-verified:
   F1 — four management-scope tests (GENERAL_MANAGER masked search, GENERAL_MANAGER
   hidden-field zero-match, scoped MANAGER scope-boundary invisibility,
   scoped MANAGER hidden-field zero-match) added and passing; F2 — the Step-1
   matrix "Fix approach" now matches the implemented predicate exactly.
2. Independent re-run: focused `13 passed`; full suite `218 passed,
   28 skipped, 1 warning`; `compileall` exit 0; governance `[PASS]`.
3. Evidence: `docs/evidence/TASK-0010-COORDINATOR-ACCEPTANCE-20260806.md`.

### Decision

1. TASK-0010 is **ACCEPTED** within its local synthetic scope. SPEC-0008
   AC-001 through AC-007 are covered for owner, other user, management scope,
   administrator exception, and unauthorized actor, with the hidden-field
   existence-oracle leak closed in the searchable predicate itself.
2. Two residuals are recorded without blocking: the pre-existing
   unhandled-UUID 500 in the institution detail route (P2 candidate for a
   future task), and the pre-existing unset `management_scope_key` on
   `RecordSnapshot` (fail-closed; handed to TASK-0015 as input). A
   documentation nit in the matrix table header is noted as non-blocking.
3. The `DEC-0100` point-4 block is lifted for sequencing. TASK-0015 is next
   in roadmap order and requires its own ownership release and activation.

## DEC-0102: TASK-0015 ownership release and activation; GLM assigned

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089` and `DEC-0101`; executor per the
  product owner's standing instruction that GLM is the current executor
- Affects: TASK-0015 state and its owned paths only
- Does not affect: approved SPECs, any other task's state, deployment, remote
  PostgreSQL/SSH, production data, credentials, billing, real-data writes

### Verified prerequisites

1. `SPEC-0002 v0.2.0` is approved and its `.approval.json` `spec_sha256`
   equals the current file hash (recomputed 2026-08-06, match confirmed).
2. Prerequisites met: TASK-0009 ACCEPTED (`DEC-0092`), TASK-0014 ACCEPTED
   (`DEC-0097`); roadmap order-3 gate (`DEC-0089` + TASK-0014 accepted) met;
   TASK-0010 accepted (`DEC-0101`), releasing the sequence.
3. Audit residual R2 from TASK-0010 is recorded as task input:
   `RecordSnapshot` in `QueryService` never sets `management_scope_key`, so a
   scoped MANAGER is denied every record (fail-closed). TASK-0015's
   management-surface work must address this within its approved SPEC scope.

### Decision

1. TASK-0015 (`SPEC-0002 user, role, ownership and management surface`) is
   ACTIVATED. The card moves to `docs/tasks/active/` with status ACTIVE /
   IMPLEMENTATION-READY.
2. Implementation owner: GLM (sole executor; per the product owner's standing
   instruction, superseding the card's DeepSeek proposal). Executor model
   identity per self-report or UNKNOWN, never an acceptance gate.
3. Owned paths are exactly those on the task card. Scope remains local
   synthetic only: no production migration, remote DB/SSH, real users,
   credentials, or external writes. New Alembic migration only if the
   approved SPEC requires durable state, applied to local synthetic databases
   only.
4. Acceptance requires the card's "Required acceptance" items plus focused
   tests, full suite without regression, governance PASS, and coordinator
   independent audit.

## DEC-0103: TASK-0015 accepted; region-scope inference escalated; TASK-0017 held at OD-001

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0101`, `DEC-0102`
- Affects: TASK-0015 acceptance state, one escalated product decision, and
  successor sequencing
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, real-data writes

### Verified audit evidence

1. The coordinator independently re-ran the executor's claims: focused
   `26 passed`; full suite `244 passed, 28 skipped, 1 warning` (218 baseline
   + 26 new, no regression); `compileall` exit 0; governance `[PASS]`.
2. All four capability areas are verified against SPEC-0002: audited
   idempotent role grant/revoke (R-005/R-015/R-014), user enable/disable
   with immediate session invalidation and R-011 prompt (R-004/R-014),
   single and batch ownership transfer with append-only history and
   per-item failure visibility (R-009–R-012), and read-only masked
   management summaries with scope enforcement and small-sample suppression
   (R-019–R-023).
3. The TASK-0010 residual R2 is fixed: all six `RecordSnapshot` sites set
   `management_scope_key=institution.region`; scoped managers see in-scope
   records only, fail-closed when region is absent.
4. Evidence: `docs/evidence/TASK-0015-COORDINATOR-ACCEPTANCE-20260806.md`.

### Decision

1. TASK-0015 is **ACCEPTED** within its local synthetic scope.
2. The `management_scope_key = institution.region` wiring is recorded as an
   engineering `[INFERENCE]` pending product-owner confirmation: SPEC-0002
   R-020/DEC-0013 name "authorized management scope" but never its
   dimension. The wiring is fail-safe (it cannot leak more than the masked
   collaborator view) and reversible. If the product owner names a different
   dimension, a wiring correction follows; no schema change is needed.
3. Residuals recorded without blocking: always-zero `archived` field in the
   management summary (D2); unhandled-UUID 500 pattern repeated in the new
   admin routes, grouped with the pre-existing R1 instance as one future
   robustness task (D3); design/actual documentation nits (D4); durable
   failure-audit for batch items deferred as a SPEC-level question (D5).
4. Sequencing: TASK-0017 (data lifecycle erasure) is next in roadmap order
   but is HELD at its stop gate — `SPEC-0011 OD-001` (backup mechanism and
   bounded deletion-propagation window) is an open product-owner decision
   and must be resolved without inventing a time window. No TASK-0017
   activation until then. TASK-0011, TASK-0016, TASK-0018 keep their
   recorded order and prerequisites.

## DEC-0104: Management-scope semantics resolved; SPEC-0011 OD-001 resolved under owner delegation

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Product owner (scope semantics, in conversation 2026-08-06);
  coordinator under the product owner's explicit delegation ("你看着办") for
  the backup mechanism and propagation window
- Affects: TASK-0015 accepted semantics, TASK-0017 stop gate
- Does not affect: approved SPEC texts (interpretation recorded here, not a
  SPEC amendment), deployment, remote resources, real data

### Decision 1 — management-scope semantics (resolves DEC-0103 point 2)

1. A manager's scope is the set of territory labels an administrator assigns
   via role grants (`scope_reference`, free text). A manager may hold
   multiple labels (e.g. 合肥、上海、浙江 as three labels).
2. A record is in scope when its territory label — the institution's
   `region` value, matched exactly after trimming — equals one of the
   manager's assigned labels. The current TASK-0015 wiring
   (`management_scope_key = institution.region`) therefore stands; no code
   change is required.
3. Vocabulary discipline is an administrative responsibility: the label used
   in a grant must match the label entered on records (e.g. granting "苏北"
   only matches records whose region is "苏北").
4. Exclusion or hierarchical patterns (e.g. "安徽（除了合肥）", or "苏北"
   implicitly covering its cities) are NOT supported in this stage. If the
   business needs them, they require a future SPEC; they must not be patched
   into code.

### Decision 2 — SPEC-0011 OD-001 backup mechanism and propagation window

1. Backup mechanism for this stage: `pg_dump` logical backups to a local
   backup directory (synthetic evidence only). Production scheduling,
  storage location, and retention belong to `SPEC-0012`/`TASK-0018` and are
   not decided here.
2. Bounded deletion-propagation window: **30 days**. Every erasure record
   carries a `propagate_by` deadline (erasure time + 30 days). Backups older
   than the window are treated as purged of erased personal data; propagation
   is reported complete only after verification, otherwise explicitly
   incomplete — never by assumption (per the TASK-0017 card).
3. This window is reversible: a later product-owner decision may tighten or
   relax it before any real customer data exists. 30 days is chosen as a
   common, conservative retention default under the owner's delegation.

## DEC-0105: TASK-0017 ownership release and activation; GLM assigned

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0103`, `DEC-0104`
- Affects: TASK-0017 state and its owned paths only
- Does not affect: approved SPECs, other tasks, deployment, remote
  PostgreSQL/SSH, production data, credentials, billing, real-data writes

### Verified prerequisites

1. `SPEC-0011 v0.2.0` approval hash re-verified 2026-08-06 (match).
2. Dependencies met: TASK-0014 ACCEPTED (`DEC-0097`), TASK-0015 ACCEPTED
   (`DEC-0103`); roadmap order-4 gate satisfied.
3. The `OD-001` stop gate is resolved by `DEC-0104` Decision 2 without
   inventing an unrecorded time window: the 30-day window and the synthetic
   `pg_dump` mechanism are recorded decisions, coordinated with TASK-0018
   for production scheduling.

### Decision

1. TASK-0017 (`SPEC-0011 lifecycle, erasure and propagation evidence`) is
   ACTIVATED. The card moves to `docs/tasks/active/` with status ACTIVE /
   IMPLEMENTATION-READY.
2. Implementation owner: GLM (sole executor, per the product owner's standing
   instruction; supersedes the card's DeepSeek proposal). Executor model
   identity per self-report or UNKNOWN, never an acceptance gate.
3. Owned paths are exactly those on the task card. Local synthetic only: no
   production data deletion or mutation, no remote resources; backup/restore
   helpers under `scripts/` only, touching nothing remote.
4. Acceptance requires the card's "Required acceptance" items, focused
   lifecycle tests, a synthetic backup/restore rehearsal proving the 30-day
   propagation semantics, full suite without regression from the
   `244 passed, 28 skipped` baseline, governance `[PASS]`, and coordinator
   independent audit.

## DEC-0106: TASK-0017 round-1 audit — REMEDIATION-REQUIRED (whitespace erase reason)

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0105`
- Affects: TASK-0017 owned paths only
- Does not affect: approved SPECs, other tasks, deployment, remote
  PostgreSQL/SSH, production data, credentials, billing, real-data writes

### Verified basis

1. Coordinator independently re-ran all verification: focused
   `13 passed`; full suite `257 passed, 28 skipped, 1 warning` (244 baseline
   + 13 new, 0 regression); `compileall` exit 0; governance `[PASS]`.
2. Coordinator reproduced finding F1 adversarially: a whitespace-only
   `reason` on `POST /api/admin/institutions/{id}/erase` passes Pydantic
   (`min_length=1`), blanks personal fields in-transaction, then fails the
   `ck_erasure_records_erasure_reason_not_blank` CHECK → HTTP 500. Rollback
   verified intact (original values preserved, zero erasure rows).
3. DEC-0096 established the rule that whitespace-only reasons are treated as
   absent and rejected/normalized at the boundary; the erasure endpoint is
   new TASK-0017 owned code and must follow the same rule.

### Decision

1. TASK-0017 is NOT accepted yet. Remediation is required for finding F1
   only (`docs/evidence/TASK-0017-COORDINATOR-AUDIT-20260806.md`):
   reject whitespace-only erase `reason` with a clean 4xx before any DB
   work, plus a focused regression test asserting 4xx status, unchanged
   institution values, and zero erasure_records rows.
2. No changes to erase scope, propagation semantics, the archive path, or
   any file outside TASK-0017 owned paths are authorized.
3. Observations F2 (rehearsal omits audit_events from the synthetic backup)
   and F3 (follow-up free text outside erasure scope — product/compliance
   question for the owner) are recorded as non-blocking; F3 is added to
   `docs/NOW.md` open items.
4. After remediation, the coordinator re-audits F1 and reruns the full
   suite; on pass, TASK-0017 acceptance and TASK-0011 activation proceed.

## DEC-0107: TASK-0017 accepted (local synthetic scope)

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0105`, `DEC-0106`
- Affects: TASK-0017 state and roadmap sequencing only
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, real-data writes

### Verified basis

1. DEC-0106 finding F1 re-audited and closed: whitespace-only erase reason
   is rejected with HTTP 400 before any DB work
   (`src/crm/web/routes/admin.py:355-356`); regression test asserts 4xx,
   unchanged values, and zero erasure rows. Scope discipline verified —
   only owned files changed.
2. Coordinator independently re-ran: focused `14 passed`; full suite
   `258 passed, 28 skipped, 1 warning` (0 regression); `compileall` exit 0;
   governance `[PASS]`.
3. All task-card "Required acceptance" items are met; evidence:
   `docs/evidence/TASK-0017-COORDINATOR-ACCEPTANCE-20260806.md`.

### Decision

1. TASK-0017 (`SPEC-0011 lifecycle, erasure and propagation evidence`) is
   ACCEPTED in local synthetic scope. Roadmap order-4 gate is satisfied.
2. Non-blocking observations F2 (rehearsal omits audit_events from the
   synthetic backup) and F3 (follow-up free text outside erasure scope —
   product/compliance question for the owner) are carried forward; F3 is
   recorded in `docs/NOW.md` open items.
3. Production backup scheduling, real-data erasure, and deployment remain
   separately gated (`SPEC-0012`/`TASK-0018`; real-data actions require
   explicit product-owner authorization).

## DEC-0108: TASK-0011 ownership release and activation; GLM assigned

- Date: 2026-08-06
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`, `DEC-0107`
- Affects: TASK-0011 state and its owned paths only
- Does not affect: approved SPECs, other tasks, deployment, remote
  PostgreSQL/SSH, production data, credentials, billing, real-data writes;
  the existing 117 records are never touched

### Verified prerequisites

1. `SPEC-0013 v0.1.0` approval hash re-verified 2026-08-06 (match:
   `f801e80e…e50e723d`).
2. Dependencies met: TASK-0007 ACCEPTED (`DEC-0067`), TASK-0008 ACCEPTED
   (`DEC-0081`), TASK-0009 ACCEPTED (`DEC-0092`), TASK-0017 ACCEPTED
   (`DEC-0107`); roadmap order-5 gate (`DEC-0089`; TASK-0009 and TASK-0017
   accepted) satisfied.
3. Open decisions `OD-001` (file format/field mapping) and `OD-002`
   (importer scope, default administrator-only) are SPEC-acknowledged
   non-blocking implementation details; the executor must derive mapping
   from the SPEC and repository evidence, default to administrator-only,
   and return the SPEC to review if a behavior-changing decision is found
   missing — never invent it.

### Decision

1. TASK-0011 (`SPEC-0013 batch-import capability`) is ACTIVATED. The card
   moves to `docs/tasks/active/` with status ACTIVE / IMPLEMENTATION-READY.
2. Implementation owner: GLM (sole executor, per the product owner's
   standing instruction; supersedes the card's DeepSeek proposal).
   Executor model identity per self-report or UNKNOWN, never an
   acceptance gate.
3. Owned paths are exactly those on the task card. Local synthetic only:
   no real-data import, re-import, cleanup, or modification of the
   existing 117 records; no remote resources; parser/mapping tests use
   synthetic files only.
4. Acceptance requires all SPEC-0013 AC-001…AC-008 covered by focused
   synthetic tests, rerun/undo negative paths proven, full suite without
   regression from the `258 passed, 28 skipped` baseline, governance
   `[PASS]`, and coordinator independent audit. The card's
   "local PostgreSQL" gate leg is satisfied only by the isolated local
   PostgreSQL test database; if unavailable, the executor marks it
   NOT VERIFIED with the exact remaining check — never reports success by
   assumption.

## DEC-0109: TASK-0011 coordinator acceptance (local synthetic scope)

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Coordinator (Claude Code / Opus 4.8), independent audit
- Affects: TASK-0011 status only
- Does not affect: approved SPECs, deployment, remote PostgreSQL/SSH,
  production data, credentials, billing, or the existing 117 records

### Verified prerequisites

1. `SPEC-0013 v0.1.0` approval hash pre-verified by implementor 2026-08-07
   (match `f801e80e…e50e723d`); accepted by coordinator.
2. All SPEC-0013 AC-001…AC-008 covered by focused synthetic tests.
3. Full suite: `276 passed, 28 skipped` post-fix, governance `[PASS]`.
4. One P1 gap found and remediated by coordinator before acceptance:
   `list_imported_institutions` queried `outcome == "imported"` only,
   silently excluding `flagged_duplicate` institutions from batch undo.
   Under R-003 (trusted load, not merged) and R-006 (whole batch undoable),
   both outcomes must be eligible. Fix: filter changed to
   `institution_id IS NOT NULL`; regression test
   `test_ac005_undo_includes_flagged_duplicate_records` added.
   Post-fix: 19 focused tests pass.
5. Pre-existing collection error in `test_task0009_csrf_phone_isolation.py`
   (`ModuleNotFoundError: No module named 'tests.test_s5_pages_api_parity'`)
   is a Windows sys.path configuration issue predating TASK-0011; not caused
   by any TASK-0011 change; tracked for separate follow-up.
6. Informational (non-blocking): constraint names differ between migration
   (`ck_import_batches_*` prefix) and ORM model (short names); functionally
   harmless, recommended cosmetic alignment at a later pass.
7. "Local PostgreSQL" gate leg: NOT VERIFIED (no isolated PostgreSQL test
   database available; same constraint as all accepted prior tasks).

### Decision

1. TASK-0011 (`SPEC-0013 batch-import capability`) is ACCEPTED in local
   synthetic scope.
2. Real-data execution remains separately blocked.
3. The `test_task0009_csrf_phone_isolation.py` collection error is a
   pre-existing environmental issue; a follow-up task will repair the import.

## DEC-0110: TASK-0008/TASK-0012 browser visual acceptance

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0008 and TASK-0012 final acceptance gate

### Decision

产品负责人在 `https://crm.aibrain.wiki` 完成浏览器视觉验收，确认 UI
可以接受。TASK-0008（核心记录工作流修复）和 TASK-0012（UI 增强）的
浏览器视觉验收门控正式关闭。

## DEC-0111: SPEC-0014 批准并授权 TASK-0019 实施

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Product owner
- Affects: SPEC-0014 状态；TASK-0019 授权
- Does not affect: 部署、远程数据库/SSH、生产数据、凭据、账单

### Verified prerequisites

1. `SPEC-0014 v0.1.0` 草稿已于 2026-08-05 由 ZCode agent 准备，
   产品负责人于 2026-08-08 明确批准。
2. 批准文件哈希已核验（SHA-256:
   `433b020f78f4bcbefd23b4536e1402e80e35546c65db07c795fd11be1589b133`）。
3. 开放决策 OD-001（用户名冷却期）、OD-002（admin 前缀保护）、OD-003
   （管理员代改他人密码）均为"第一版不定义"，不改变已定行为，不阻塞
   批准。

### Decision

1. `SPEC-0014 v0.1.0`（账号用户名与密码自助修改）正式批准，移入
   `docs/specs/30-approved/`，approval hash 已写入
   `SPEC-0014-account-credentials-modification.approval.json`。
2. TASK-0019（SPEC-0014 实施：账号凭据自助修改）正式授权，本地合成
   数据范围；无真实数据、无部署、无远程数据库或 SSH 授权。
3. 实施所有者：GLM（遵循产品负责人关于本地合成任务的常设指令）。

## DEC-0112: TASK-0001 G5 正式授权

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Product owner
- Affects: TASK-0001 G5 门控状态
- Does not affect: G6/W5 或其他后续门控；各后续门控需独立授权

### Context

TASK-0001 门控序列中，G5（迁移影响评估与降级/恢复计划）标记为
PENDING。W4 已在 DEC-0053/DEC-0055 下执行并已应用于生产服务器；CRM
当前在 `https://crm.aibrain.wiki` 运行。产品负责人现明确授权 G5，
正式关闭该门控并允许后续门控序列继续推进。

### Decision

1. TASK-0001 G5 正式授权（2026-08-08）。W4 迁移已执行，G5 门控正式
   关闭。
2. 下一个门控为 G6（生产发布/systemd/nginx 资源清单与回滚计划呈报），
   需独立授权。
3. 本决策不授权 G6/W5/G7/V1/R2 或任何服务器写入操作。

## DEC-0113: TASK-0019 账号凭据自助修改 ACCEPTED

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Coordinator（独立审计）under `DEC-0111`
- Affects: TASK-0019 状态
- Does not affect: 部署、远程数据库/SSH、生产数据、凭据、账单；真实
  PostgreSQL 执行仍单独受限

### 独立审计（协调员未采信执行者自报告，自行复现）

1. 读取全部实现文件（`src/crm/web/routes/account.py`、
   `src/crm/application/commands.py` 的 `ChangePasswordCommand` /
   `ChangeUsernameCommand` / `CredentialError` / `_is_prefix_protected`、
   `templates/account_settings.html`）与测试文件。
2. 独立运行 `python -m pytest tests/test_task0019_account_credentials.py -q`
   → `25 passed`。
3. 独立运行全量 `python -m pytest tests/ -q` → `302 passed, 28 skipped`
   （基线 277；+25 新测试，0 退化；与执行者报告一致）。
4. 独立运行 `scripts/check-governance.ps1` → `[PASS]`（8 SPEC / 15 任务）。
5. 逐条核验安全敏感测试为**真实行为断言**而非状态码走过场：
   - AC-002：错误当前密码 → 无数据库变更（旧密码仍可登录）+ 零审计行 +
     旧会话仍有效（epoch 未 bump）。
   - AC-008：模拟审计后端故障 → 事务回滚，旧密码可登录、新密码 401。
   - AC-010：改密/改用户名后旧会话访问 `/api/institutions` → 401。
6. 命令逻辑核验：当前密码校验、`sa`/`dl` 前缀保护（对当前用户名判定，
   大小写不敏感）、唯一性检查（排除自身、大小写不敏感）、session_epoch
   在同一事务内自增、审计写入与凭据变更同事务提交/回滚。

### 非阻塞观察（不影响验收）

1. 证据文件抬头写 `SPEC-0014 (v1.0.0)`，实际批准版本为 `v0.1.0`；纯
   文档笔误，不影响代码与哈希。
2. 前缀保护按 SPEC 字面实现为 `lower(username).startswith('sa'|'dl')`，
   会覆盖如 `sarah`/`dlargo` 等以该字母开头的普通用户名。这与
   SPEC-0014 R-004 字面一致；若产品意图是仅保护 `sa`/`dl` 作为独立
   命名段，需修订 SPEC，不在本次实现纠正范围。

### Decision

1. TASK-0019 在本地合成数据范围内 **ACCEPTED**。
2. 真实 PostgreSQL 执行、浏览器视觉验收仍单独受限/待产品负责人执行。
3. 证据：`docs/evidence/TASK-0019-COORDINATOR-ACCEPTANCE-20260808.md`。

## DEC-0114: TASK-0020 激活（SPEC-0003 商机发现实施）

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Coordinator under `DEC-0089`（approved-SPEC 完成序列，本地
  合成，一次一个任务）
- Affects: TASK-0020 状态及其 owned 路径
- Does not affect: 已批准 SPEC、其他任务、部署、远程数据库/SSH、生产
  数据、凭据、账单、真实数据外传、外部模型调用

### Verified prerequisites

1. `SPEC-0003 v0.2.0` 已批准（`DEC-0022`），approval hash 待执行前重新
   核验。
2. 依赖已接受：TASK-0001 基础（S1–S3+R1）、TASK-0007（`DEC-0067`）、
   TASK-0015（`DEC-0103`）均提供发现功能所需的记录/权限/脱敏基础。
3. 开放决策 `OD-001`–`OD-004` 已由 `DEC-0021` 解决；`OD-005`（留存）
   与 `OD-006`（发现方法/模型/真实数据外传）为单独授权门，**不阻塞**
   本地合成实现，但执行方**不得**引入外部模型或真实数据外传，发现
   方法只能是本地确定性规则（R-012）。

### Decision

1. TASK-0020（`SPEC-0003 商机发现`）**激活**，本地合成数据范围。
2. 实施所有者：GLM 或 DeepSeek（遵循产品负责人关于本地合成任务的
   常设指令；单一执行者）。
3. Owned 路径以任务卡为准。发现方法限本地确定性规则；无外部模型、
   无真实数据外传、无部署、无远程数据库/SSH。
4. 验收要求：SPEC-0003 AC-001…AC-014 全部由合成测试覆盖，脱敏一致性
   与反推保护（AC-007/AC-008）证明有效，来源可追溯（AC-013）证明，
   全量套件从 `302 passed, 28 skipped` 基线无退化，governance `[PASS]`，
   协调员独立审计接受。
5. 若发现方法选择实质改变产品含义（超出 SPEC-0003 已定行为），停止
   并把 SPEC 退回评审，不得自行发明。

## DEC-0115: TASK-0020 商机发现 ACCEPTED

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Coordinator（独立审计）under `DEC-0114`
- Affects: TASK-0020 状态；SPEC-0003 首次实现
- Does not affect: 部署、远程数据库/SSH、生产数据、真实数据外传、外部
  模型调用；OD-005（留存）与 OD-006（发现方法/外传）仍为单独授权门

### 独立审计（协调员未采信执行者自报告，自行复现）

1. 授权链复核：`SPEC-0003 v0.2.0` approval hash 匹配（`7170d728…`）；
   `DEC-0114` 激活记录存在；基线 COMPLETE。
2. 迁移链静态验证：`0001→0002→0003→0004_opportunity_reminders`（head），
   `down_revision` 链一致；schema 测试白名单已含 `opportunity_reminders`。
3. 独立运行聚焦测试 `pytest tests/test_task0020_opportunity_discovery.py -q`
   → `17 passed`。
4. 独立运行全量 `pytest tests/ -q` → `319 passed, 28 skipped`（基线 302；
   +17 新测试，0 退化；与执行者报告一致）。
5. 独立运行 `scripts/check-governance.ps1` → `[PASS]`（8 SPEC / 16 任务）。
6. 发现方法 OD-006 合规核验：`src/crm/application/discovery.py` 与
   `web/routes/discovery.py` 全文扫描，**零外部调用/联网**；方法为本地
   确定性规则（同 region + 同 category 跨负责人聚类），`run()` 显式返回
   `method=local_deterministic_rule, external_egress=False`（AC-011）。
7. 脱敏核验：`_masked_involved_records` 只输出 id/name/category/region，
   不含 source_description/联系方式/原始跟进正文/证据（R-007/AC-007）；
   小样本（<3）与单一负责人簇抑制（R-008/AC-008）。
8. 来源可追溯：仅对有 region+category 的活跃机构聚类，null 值排除以防
   编造关联（R-014/AC-013）。
9. 路由：owner 须 enabled 且持业务/管理员角色才收提醒，否则路由 enabled
   管理员并标 `routed_reason="unowned"`（R-010/R-015/AC-014）。

### 测试断言修正核验（重点审查项）

执行者修改了 TASK-0020 测试中 AC-006/AC-009 的 404 断言为"200 脱敏视图"。
协调员独立查证其引用的已接受测试
`tests/test_task0008_s4_admin_exception.py::test_non_admin_with_reason_is_not_escalated`
——该测试断言非 owner 业务用户读他人机构详情返回 **200 + 脱敏
collaborator 视图**（`source_description is None`），非 404。因此原
TASK-0020 的 404 断言是与已批准 SPEC-0001 行为冲突的错误假设；执行者的
修正**对齐已批准行为且保留 AC 语义**（仍断言受保护字段隐藏），未触碰
`policy/projection.py`。**判定：合法修正，非掏空测试。**

### 非阻塞观察

1. 半成品接管：代码库原已存在测试、`OpportunityReminderModel`、迁移
   `0004`（业务实现缺失，16 红灯）。本次补齐 persistence/application/web
   三层，属正常接管，非重复劳动。
2. 约束名修复：`models.py` 四个 CheckConstraint 因 naming_convention 双重
   `ck_` 前缀超 PostgreSQL 63 字节，已改短基名并与迁移 0004 最终名一致。

### Decision

1. TASK-0020 在本地合成数据范围内 **ACCEPTED**。
2. 真实 PostgreSQL 执行、浏览器视觉验收仍单独受限/待产品负责人执行。
   OD-005/OD-006 仍为单独授权门。
3. 证据：`docs/evidence/TASK-0020-COORDINATOR-ACCEPTANCE-20260808.md`。

## DEC-0116: OD-006 方向决定——引入 AI 发现方法 + 完整数据出境

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Product owner
- Affects: SPEC-0003 `OD-006`；后续 SPEC-0003 v0.3.0 修订方向
- Does not affect: 本决定不批准任何 SPEC 修订、不授权实施、不授权真实数据
  录入或生产部署；它只确定 v0.3.0 修订的产品方向

### 决定内容

产品负责人明确选择:
1. 商机发现**引入真正的 AI 发现方法**(不再限于本地确定性规则)。
2. 数据出境边界为**完整出境**——真实业务数据(含机构原文、跟进正文、
   联系方式、客户原话等)**允许**发送给外部 AI 模型。产品负责人明确表示
   "好用方便的需求远远大于隐私",并知悉此选择不可逆(发出的内容在第三方
   模型侧不可收回)。

### 决定证据

产品负责人原话:"我对于好用方便的需求远远大于隐私,因此我看不懂,但选择
完整出境"。协调员已用平白语言确认该选择的工程含义(业务原文离开 CRM 到
模型提供方)。法务/合规判断属产品负责人自身领域(`DEC-0037`),不写入 SPEC。

### 工程边界(协调员据此设计,产品负责人回头可改)

1. **出境口 ≠ 展示口**:完整出境放开的是"发给模型的数据";但**给接收者
   展示的提醒**仍须遵守 SPEC-0001/0002 已批准的脱敏与跨负责人保护——一个
   负责人不得通过 AI 生成的理由看到他人客户的受保护字段。因此 AI 返回文本
   落库/展示前必须做泄露扫描,拦截跨负责人受保护内容(v0.3.0 新增规则)。
2. **模型/提供方仍 OPEN**(`OD-006a`):由产品负责人在实施授权时点名,或委托
   实现在获批边界内选择并记录。
3. **验证阶段只用合成数据**:SPEC 修订与实施全程用合成数据验证;真实数据
   出境是产品负责人在生产环境亲自运行的独立下游动作,本决定不代为触发。

### 后续

1. 协调员据此定稿 `SPEC-0003 v0.3.0`(完整出境版),移入 `20-review`。
2. 产品负责人审阅后显式批准该修订(独立步骤)。
3. 批准后授权实施任务,届时才生成给 DeepSeek 的实施提示词。
4. 在此之前,商机发现的现行已批准行为仍是 v0.2.0(TASK-0020 已验收实现)。

## DEC-0117: SPEC-0003 v0.3.0 批准 + TASK-0021 实施授权

- Date: 2026-08-08
- Status: ACTIVE
- Decided by: Product owner（选项 2:批准修订 + 授权实施任务）
- Affects: SPEC-0003 已批准版本从 v0.2.0 升为 v0.3.0；TASK-0021 授权
- Supersedes: SPEC-0003 v0.2.0（归档至 `90-deprecated`）
- Does not affect: 真实数据出境的实际执行、模型/提供方商务选择、部署、
  远程数据库/SSH、生产数据、凭据、账单——均为独立下游动作/门控

### Verified prerequisites

1. `SPEC-0003 v0.3.0` 已合成为**自包含完整 SPEC**（非增量稿），写入
   `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`。
2. 旧 v0.2.0 全文归档至
   `docs/specs/90-deprecated/SPEC-0003-v0.2.0-opportunity-discovery.md`；
   `20-review` 增量稿已删除，授权依据唯一。
3. 新 approval hash 已写入
   `SPEC-0003-opportunity-discovery.approval.json`（SHA-256:
   `d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0`），
   与文件核验一致。
4. `OD-006` 由本决定解决为"完整出境 + AI 生成推理"（承接 `DEC-0116`）；
   `OD-006a`（模型/提供方）与 `OD-005`（留存）仍为单独门，不阻塞实施但
   实施只用合成数据验证。

### Decision

1. `SPEC-0003 v0.3.0`（商机发现:主动发现 + AI 生成推理 + 完整出境）
   **正式批准**，成为当前唯一已批准版本。v0.2.0 作废归档。
2. **TASK-0021**（SPEC-0003 v0.3.0 AI 发现方法实施）**授权**，本地合成
   数据范围。实施所有者:DeepSeek（遵循产品负责人常设指令;单一执行者）。
3. 硬边界:实施与验证**全程只用合成数据**;不发送任何真实数据到外部模型;
   不选定/签署 provider 商务合同(留 `OD-006a`);不部署、不远程数据库/SSH。
4. 展示侧保护不变:v0.2.0 全部接收侧行为(两层分离、脱敏、来源可追溯、
   接收路由)保留;AI 返回文本落库前必须过泄露扫描(R-018/AC-016)。
5. 验收要求:SPEC-0003 AC-001…AC-019 全部由合成测试覆盖(其中 AC-015…
   AC-019 为本次新增的出境白名单/返回泄露扫描/降级/审计边界),全量套件
   从 `319 passed, 28 skipped` 基线无退化,governance `[PASS]`,协调员
   独立审计接受。
6. 若实施暴露改变已批准行为的产品决策(超出 v0.3.0 已定范围),停止并把
   SPEC 退回评审,不得自行发明。

## DEC-0118: TASK-0021 协调员验收通过（本地合成范围）

- Date: 2026-08-10
- Type: coordinator acceptance
- Status: accepted
- Affects: TASK-0021
- Evidence: `docs/evidence/TASK-0021-COORDINATOR-ACCEPTANCE-20260810.md`

### Verified facts

1. 产品负责人明确将 TASK-0021 剩余 P1-1/P2 修复转交 GLM5.2
   （WorkBuddy）；原始实现者仍记录为 DeepSeek。
2. `SPEC-0003 v0.3.0` 的当前 SHA-256 与 approval metadata 匹配：
   `d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0`。
3. 泄露扫描器已删除短值长度阈值，所有非空受保护值统一使用完整值子串匹配。
4. 独立复核结果：TASK-0021 聚焦 `22 passed`；TASK-0020 + TASK-0021 +
   persistence schema `45 passed`；全量 `341 passed, 28 skipped, 1 warning`；
   `py_compile` 通过；Alembic 单 head；governance `[PASS]`。
5. 旧 evidence 中“阈值提至 6”和旧计数已明确标记为被本次协调员复核取代。

### Decision

1. TASK-0021 在 `DEC-0117` 授权的本地合成范围内 **ACCEPTED**。
2. 真实 PostgreSQL、真实 AI provider、浏览器视觉和提交级 diff 均未验证，
   不得由本决定推导为通过。
3. `OD-006a`（真实 provider）和 `OD-005`（留存期限）保持 OPEN；真实数据
   外发、数据库迁移、部署和生产配置修改仍需独立明确授权。

## DEC-0119: TASK-0018 激活 + 实施所有权转交 GLM5.2（WorkBuddy）

- Date: 2026-08-10
- Type: product-owner authorization
- Status: active
- Affects: TASK-0018

### Verified facts

1. TASK-0018 由 `DEC-0089` 授权，但一直处于
   AUTHORIZED-PENDING-OWNERSHIP-RELEASE，拟实施方为 DeepSeek。
2. 前置任务 TASK-0009 / TASK-0014 / TASK-0017 均已 ACCEPTED，依赖无阻塞。
3. 产品负责人在 2026-08-10 会话中明确同意将 TASK-0018 转交 GLM5.2
   （WorkBuddy）并激活。
4. 同一会话中，产品负责人授权删除根目录旧报告 `overview.md`（P2 残留
   偏差，其内容已被
   `docs/evidence/TASK-0021-COORDINATOR-ACCEPTANCE-20260810.md` 取代），
   并授权建立本仓库首个 git 基线 commit。

### Decision

1. TASK-0018 激活，实施所有者为 GLM5.2（WorkBuddy），范围以任务卡为准。
2. 部署、SSH、nginx/TLS/DNS、systemd、生产数据库、凭据变更仍为本任务
   明确排除项，需独立明确授权。
3. `overview.md` 已删除；该旧报告内容不再具有任何权威性。

## DEC-0120: 架构与 SDD 重基线 + GPT-5.6/GLM/DeepSeek 角色分工

- Date: 2026-08-11
- Type: product-owner direction and documentation authorization
- Status: active
- Decided by: Product owner
- Affects: repository architecture baseline, Spec-first governance,
  `TASK-0022`, future implementation and review routing
- Does not authorize: application behavior changes, approved SPEC changes,
  deployment, server/database mutation, real data, credentials, external AI
  calls, commit, or push

### Product-owner direction

The product owner requested that the current project architecture and factual
baseline be rebuilt, that a Spec-first/SDD foundation be established for future
development, and that the model roles be:

1. GPT-5.6 owns architecture and independently reviews implementation work.
2. GLM and DeepSeek execute bounded implementation tasks.
3. Repository files, tests, runtime evidence, and acceptance gates decide the
   result; a model's own completion report is never acceptance evidence.

### Decision

1. Activate documentation/review `TASK-0022` with Codex as the architecture
   owner and independent reviewer role. The requested model is GPT-5.6; the
   exact runtime identifier remains `UNKNOWN` unless the active tool exposes
   it, and must never be inferred from the tool label.
2. Preserve the current modular-monolith product behavior. Rebaseline it from
   current source, migrations, approved SPECs, tests, and recorded deployment
   decisions rather than designing a greenfield replacement.
3. GLM or DeepSeek may own one bounded implementation task at a time. They may
   self-verify and prepare evidence but may not self-accept their work.
4. GPT-5.6 review is findings-only unless a separate decision transfers
   implementation ownership. Review must inspect the repository and rerun the
   relevant checks independently.
5. One initial implementation pass and at most one consolidated correction
   pass is the normal cross-model budget. A repeated material failure becomes
   `PARTIAL / ESCALATED`; the product owner is not made to merge reports or
   choose engineering repairs.
6. `SPEC-GOV-0001` may be updated and moved to `20-review` by TASK-0022, but it
   is not approved by this decision. Approval requires an explicit later
   product-owner response naming its version.

## DEC-0121: TASK-0018 implementation ownership transfer to DeepSeek-v4-flash in PI

- Date: 2026-08-11
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: `TASK-0018` implementation ownership and its executor handoff
- Supersedes: `DEC-0119` only for the `TASK-0018` implementation-owner
  assignment; all existing scope and safety boundaries remain in force
- Does not authorize: a change to `SPEC-0012`, production deployment, SSH,
  server or database mutation, credentials, external writes, real data,
  commit, or push

### Verified context

1. `TASK-0018` is an active, local-operations-evidence implementation task
   authorized by `DEC-0089`; its approved authority is `SPEC-0012 v0.2.0`.
2. `DEC-0119` assigned GLM5.2 (WorkBuddy) as its implementation owner. The
   current worktree contains uncommitted predecessor changes to the task's
   persistence model, schema test, migration, local scripts, repository,
   focused tests, and implementation evidence.
3. The product owner explicitly approved transfer of the implementation work
   to DeepSeek-v4-flash in PI in the 2026-08-11 conversation. The exact PI
   runtime model identifier is not independently verified and must not be
   inferred from this requested executor label.

### Decision

1. From the written handoff onward, DeepSeek-v4-flash in PI is the sole
   implementation owner of `TASK-0018`. It receives one bounded reconciliation
   and implementation pass within the existing task card's owned paths.
2. All GLM5.2 predecessor changes are preserved. They are candidate work, not
   accepted results: DeepSeek must inspect the actual diff and reproduce the
   relevant checks before retaining or correcting any part of it.
3. DeepSeek may self-verify and write task evidence but may not self-accept.
   Codex, in the `TASK-0022` architecture-owner role, independently reviews
   the finished repository state. The normal budget remains one initial pass
   plus at most one consolidated correction pass; a repeat material failure is
   `PARTIAL / ESCALATED`.
4. The existing hard boundaries remain unchanged: local synthetic evidence
   only; no SSH, server, nginx, TLS, DNS, systemd, production database,
   credential, external write, real-data, commit, or push action.

## DEC-0122: PI execution prompt and repository-evidence review protocol

- Date: 2026-08-11
- Type: product-owner workflow direction
- Status: active
- Decided by: Product owner
- Affects: current and future bounded implementation-task dispatch, execution
  reporting, and independent review
- Does not authorize: any product behavior outside an approved SPEC and active
  task, deployment, server/database mutation, real data, credentials, external
  product-side AI calls, commit, or push

### Decision

1. The requested GPT-5.6-sol architecture role writes the complete, directly
   executable task prompt. In this repository, the active Codex session records
   itself as the architecture/review owner but must retain `UNKNOWN` for the
   exact runtime identifier unless the runtime exposes it.
2. DeepSeek executes only the written task prompt through PI, makes bounded
   repository changes, and writes a task report plus evidence. Its report is
   not an acceptance decision.
3. Before any review conclusion, the GPT-5.6-sol architecture role must inspect
   the actual repository files, Git status, diff, task report, evidence, and
   rerun the named tests and governance checks. It must not accept or reject
   based only on DeepSeek's prose.
4. The review conclusion has exactly one of these outcomes:
   `APPROVE_AND_DISPATCH_NEXT_TASK`,
   `REJECT_AND_DISPATCH_CORRECTION_TASK`, or
   `ESCALATE_TO_PRODUCT_OWNER`.
5. A rejection contains one complete next DeepSeek prompt covering all material
   findings within the single correction-pass budget. An escalation is allowed
   only for high risk or a fact that cannot be established from the repository
   and requires a product-owner decision.

## DEC-0123: Authorize TASK-0018 PI correction retry

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: the single existing TASK-0018 correction handoff
- Supersedes: none

### Verified context

1. The Codex independent audit found a material local backup/restore evidence
   defect and prepared one bounded correction prompt.
2. The first PI correction dispatch returned `402 Insufficient Balance`
   before repository execution, so no correction was made.
3. The product owner then explicitly confirmed that the correction dispatch may
   be retried.

### Decision

1. Retry only the existing DeepSeek-v4-flash PI correction prompt at
   `docs/handoffs/HANDOFF-20260811-GLM52-TASK-0018-CONSOLIDATED-REMEDIATION.md`.
2. This authorization does not authorize automatic billing, credential entry,
   account changes, deployment, server/database mutation, real data, commit,
   push, or any scope beyond TASK-0018.
3. If the provider still has insufficient balance or requests an account or
   billing action, stop and report that external boundary; do not attempt to
   bypass it or switch models without a separate explicit decision.

## DEC-0124: Product-owner communication is verdict-only

- Date: 2026-08-12
- Type: product-owner workflow direction
- Status: active
- Decided by: Product owner
- Affects: all cross-model task dispatch, execution, and review reporting
- Supersedes: prior product-owner-facing progress-report templates

### Decision

1. GPT-5.6-sol writes bounded, copyable PI prompts in repository handoffs.
   DeepSeek executes those prompts, writes a task report and evidence, and
   never self-accepts.
2. GPT-5.6-sol independently reviews actual repository files, Git state, diff,
   test results, governance output, and DeepSeek evidence/report before a
   conclusion. DeepSeek prose alone is never sufficient evidence.
3. The product-owner conversation does not contain intermediary task planning,
   PI prompts, execution progress, tool failures, raw output, or model reports.
   Those records remain in the repository and are routed between GPT and
   DeepSeek.
4. The sole normal review outcomes are exactly
   `APPROVE_AND_DISPATCH_NEXT_TASK`,
   `REJECT_AND_DISPATCH_CORRECTION_TASK`, or
   `ESCALATE_TO_PRODUCT_OWNER`. A rejection automatically dispatches its
    correction prompt. An escalation names only a business, risk, or irreversible
    external decision that AI cannot make.

## DEC-0125: TASK-0018 independent acceptance and TASK-0022 documentation dispatch

- Date: 2026-08-12
- Type: coordinator acceptance and bounded task dispatch under product-owner
  workflow direction
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0120`, `DEC-0122`, and
  `DEC-0124`
- Affects: TASK-0018 acceptance status and TASK-0022 documentation-execution
  ownership only
- Does not authorize: deployment, SSH, server/nginx/TLS/DNS/systemd changes,
  production or shared database mutation, real data, credentials, billing,
  external writes, commit, or push

### Verified acceptance basis

1. `SPEC-0012 v0.2.0` SHA-256 matches its approval metadata:
   `621131c01f85ab9186e0f14d913e20c82ea2016267ec9b4cf0dd867a0dac1192`.
2. Codex inspected actual TASK-0018 implementation/correction files, Git
   status/diff, task report, and executor evidence rather than relying on
   executor prose.
3. Codex reran: focused operational tests (`27 passed`), operations evidence
   helper (7 durable local records), schema/migration tests (`7 passed, 1
   skipped`), full suite (`368 passed, 28 skipped, 1 warning`), three health
   paths (PASS 0 / FAIL 1 / UNAVAILABLE 2), governance (`[PASS]`), and
   `git diff --check` (no whitespace errors).
4. The correction supplies a file-backed source database, fresh engine reopen,
   separate restored database with a persisted-record query, fail-closed bad
   backup handling, and explicit `operation_records` migration-test coverage.

### Decision

1. `TASK-0018` is ACCEPTED solely for local synthetic operations evidence.
   Its acceptance evidence is
   `docs/evidence/TASK-0018-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
2. PostgreSQL migration round trip, remote/deployment behavior, production or
   shared-data backup/restore, real deletion propagation, live rollback, and
   product-owner visual/business acceptance remain `NOT VERIFIED`; none is
   implied by the local acceptance.
3. `TASK-0022` is the sole next active task. Its single bounded
   documentation-execution pass is assigned to DeepSeek-v4-flash in PI via
   `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.
   Codex remains independent architecture reviewer and is the only acceptance
   decision-maker. The pass may modify only TASK-0022-owned documentation paths
   and must return `HANDOFF-ONLY`, `PARTIAL`, or `BLOCKED`.

## DEC-0126: TASK-0022 PI provider boundary escalation

- Date: 2026-08-12
- Type: external-provider boundary record
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0122` and `DEC-0124`
- Affects: TASK-0022 execution availability only
- Does not authorize: provider billing/account change, credential entry,
  fallback model/provider, deployment, database mutation, real data, external
  writes, commit, or push

### Verified context

1. Codex wrote the bounded PI prompt at
   `docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`
   after independently accepting TASK-0018 in its local synthetic scope.
2. The exact PI dispatch returned `402 Insufficient Balance` with process exit
   1 before repository execution.
3. No TASK-0022 executor task report, documentation deliverable, or execution
   evidence was produced by that failed invocation.

### Decision

`ESCALATE_TO_PRODUCT_OWNER`: restoring PI provider balance/access, changing a
provider, or authorizing another executor is an external account/billing or
workflow decision. TASK-0022 is blocked until the product owner restores the
existing PI DeepSeek availability or explicitly authorizes a different
executor/provider. No automatic retry or fallback is permitted.

## DEC-0127: TASK-0001 G6 release-resource planning authorization

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0001 G6 documentation and review work only
- Does not authorize: W5 release execution, SSH or server access, systemd or
  nginx changes, service restart, database mutation, DNS/TLS changes, real
  data, credentials, external writes, commit, or push

### Verified context

1. TASK-0001 records G6 as the next release gate after the G5 authorization;
   W5 and all later deployment gates remain pending.
2. Existing repository deployment artifacts and historical deployment evidence
   describe `/opt/anqiao-crm`, the `anqiao-crm` service, port 8200, and the
   existing `crm` nginx site, but TASK-0022 did not re-probe their current
   production state.
3. The product owner explicitly authorized the next gate in the current
   conversation after the TASK-0022 independent acceptance.

### Decision

1. Activate one bounded, documentation-only G6 pass: prepare a release/systemd/
   nginx resource manifest, existing-site isolation checks, rollback sequence,
   fail-closed stop conditions, and verification plan from repository evidence.
2. DeepSeek in PI is the sole execution owner for this pass. It may read local
   repository files and write only the G6 task/evidence/handoff documentation
   paths named by its handoff. It must not connect to a remote host or perform
   any external action.
3. Codex remains the independent architecture reviewer and is the only
   acceptance decision-maker. A successful G6 documentation review does not
   authorize W5, G7, V1, or R2; each retains its existing separate gate.

## DEC-0128: TASK-0023 G6 planning acceptance and W5 authorization boundary

- Date: 2026-08-12
- Type: coordinator independent acceptance and escalation boundary
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0127`
- Affects: TASK-0023 G6 documentation-planning scope only
- Does not authorize: W5 release execution, SSH or server access, systemd or
  nginx changes, service restart, database mutation, DNS/TLS changes, real
  data, credentials, external writes, commit, or push

### Verified acceptance basis

1. DeepSeek in PI returned `HANDOFF-ONLY` and wrote the bounded G6 plan and
   execution evidence under the handoff-owned documentation paths.
2. Codex independently inspected the actual plan, execution evidence, local
   deployment artifacts, Git status/diff, approved SPEC hash, and the named
   checks. The complete record is
   `docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
3. Governance passed with 8 approved SPECs and 20 active tasks; `git diff
   --check` passed; `SPEC-0012` hash matched its approval metadata.
4. The plan correctly leaves current production layout, service, nginx,
   listeners, TLS/DNS, database revision, runtime configuration, logs, and
   backups as `[UNKNOWN]`. No remote or production action occurred.

### Decision

1. `TASK-0023` is ACCEPTED solely for its local G6 documentation-planning
   scope. This acceptance does not open W5, G7, V1, or R2.
2. The next possible W5 operation requires a new explicit product-owner
   authorization because it would inspect or mutate external production
   resources whose current state is unknown. No W5 task is dispatched by this
   decision.

## DEC-0129: W5 read-only production preflight authorization

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0024 W5 read-only production preflight only
- Execution owner: DeepSeek in PI through the configured OpenCode Go route
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: release publication, backup creation, file/configuration
  change, package installation, systemd/nginx change or reload, service
  restart, database DDL/DML or migration, DNS/TLS change, credential or secret
  reading, business-row reading, log-body reading, real-data mutation, commit,
  push, or any other external write

### Verified context

1. `TASK-0023` is independently accepted only for its G6 local planning scope.
2. Current production layout, service, nginx, listener, TLS/DNS, database
   revision, runtime-file metadata, logs, backups, and deployed release remain
   `[UNKNOWN]` because G6 performed no remote access.
3. The product owner explicitly replied that W5 read-only production preflight
   is authorized and asked whether DeepSeek or Codex should execute it.

### Decision

1. Activate one bounded read-only production preflight as `TASK-0024`.
2. DeepSeek in PI is the sole executor. It may use the already established SSH
   target and public DNS/HTTPS reads only through the exact read-only boundary
   in the task handoff. It may write only local task/evidence status documents.
3. Database inspection is limited to database identity, server version,
   Alembic revision, table names, and PostgreSQL estimated row counts inside an
   explicit read-only transaction. It must not select business-row values.
4. Runtime configuration inspection is limited to file existence, owner/mode,
   and service-user readability. File contents and environment values are
   forbidden. Certificate inspection is limited to the public certificate;
   private-key access is forbidden. Log bodies are forbidden.
5. Any host-key/authentication failure, sudo prompt, unexpected target, command
   requiring a write, credential access, or ambiguity stops the task without a
   workaround. No weakening of host-key checking is allowed.
6. Codex must independently inspect the actual repository changes and evidence
   and rerun the non-remote checks before a verdict. Successful preflight does
   not authorize W5 release execution, G7, V1, or R2.

## DEC-0130: TASK-0024 review rejection and local incident reconciliation

- Date: 2026-08-12
- Type: coordinator independent review and bounded corrective dispatch
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124`, following the
  product owner's instruction to orchestrate the next DeepSeek task
- Affects: TASK-0024 evidence/status reconciliation and TASK-0025 only
- Does not authorize: SSH, remote access, public endpoint probing, production
  inspection, log access, release publication, backup creation, deployment,
  migration, systemd/nginx/DNS/TLS change, service restart, database access or
  mutation, credentials, secrets, real data, commit, push, or any external
  write

### Verified review finding

1. `DEC-0129` and the TASK-0024 handoff forbid log-body reading.
2. TASK-0024 evidence records execution of `journalctl -o cat | wc -l` and
   `journalctl -o short-iso | cut ...`. Although the saved evidence contains
   only a count and timestamps, those pipelines caused log records and message
   text to be read and processed before aggregation.
3. The evidence claims that no log body was read. That claim is incompatible
   with the recorded commands and the authorization boundary. The external
   access already occurred and cannot be undone by editing documentation.
4. Codex did not reconnect to production during review. Local governance and
   `git diff --check` passed; those local checks do not cure the boundary
   violation.

### Decision

1. TASK-0024 is not accepted. W5 release execution, G7, V1, and R2 remain
   pending and separately unauthorized.
2. Activate TASK-0025 as one local documentation-only reconciliation pass.
   DeepSeek in PI is the sole correction executor. It must preserve the exact
   command history, remove or qualify false no-log-body claims, mark TASK-0024
   rejected/partial, and record that the useful non-log observations remain
   unaccepted snapshot evidence pending a future product-owner risk decision.
3. TASK-0025 must not perform any network or remote command. It may change only
   the local documentation paths named in its handoff and must return
   `HANDOFF-ONLY` for Codex independent review.
4. Documentation correction cannot authorize a repeat preflight or W5. Any
   future production access or release requires a new explicit product-owner
   decision after TASK-0025 independent review.

## DEC-0131: TASK-0025 independent review escalation

- Date: 2026-08-12
- Type: coordinator independent review and product-owner escalation
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0130`
- Affects: TASK-0025 review result and all future production-access/release
  dispatches
- Evidence: `docs/evidence/TASK-0025-GPT56-INDEPENDENT-REVIEW-20260812.md`

### Verified review basis

1. DeepSeek executed TASK-0025 through the configured PI selector and returned
   `HANDOFF-ONLY` with local correction evidence.
2. Codex independently inspected the actual TASK-0024/TASK-0025 cards,
   evidence, control documents, Git state, and diff; the exact journald
   commands remain preserved and the corrected boundary wording is consistent.
3. Codex independently reran the governance check, `git diff --check`, the
   approved SPEC hash comparison, and scoped secret/status scans. No remote
   command was run during TASK-0025 review.

### Decision

`ESCALATE_TO_PRODUCT_OWNER`: an explicitly forbidden external log access
already occurred, and the useful TASK-0024 non-log observations remain an
unaccepted snapshot. Documentation reconciliation cannot undo that access or
authorize a repeat preflight, W5 release, G7, V1, or R2. No new DeepSeek task is
dispatched until the product owner makes a new explicit risk/authorization
decision.

## DEC-0132: TASK-0026 no-log read-only production preflight authorization

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0026 only
- Execution owner: DeepSeek in PI through the configured OpenCode Go route
- Review/acceptance owner: Codex architecture/review owner
- Supersedes: none; TASK-0024 remains NOT ACCEPTED / PARTIAL and its snapshot
  remains unaccepted evidence
- Does not authorize: release publication, backup creation, restore,
  deployment, file/configuration change, package installation, systemd/nginx
  change or reload, service restart, database DDL/DML or migration, DNS/TLS
  change, credential or secret reading, business-row reading, any log reading
  or query, real-data mutation, commit, push, or any other external write

### Verified context

1. TASK-0024 was not accepted because its journald pipelines read and processed
   log records/message text despite the no-log-body boundary.
2. TASK-0025 reconciled that fact locally and Codex independently reviewed the
   repository evidence, Git state/diff, approved-SPEC hash, governance output,
   and scoped secret/status scans.
3. The product owner explicitly authorized a new read-only production preflight
   with no log access.

### Decision

1. Activate one bounded no-log read-only production preflight as TASK-0026.
2. DeepSeek in PI is the sole executor. It may use only the established SSH
   target and public DNS/HTTPS reads through the exact task handoff boundary.
   It may write only the local task/evidence/status documents named there.
3. `journalctl`, `systemctl status`, `/var/log`, log files, log queries, and
   any command whose purpose is to read or derive log content/metadata are
   forbidden. No exception for counts, timestamps, or aggregate-only output.
4. Codex must independently inspect actual repository files, Git state/diff,
   task report, evidence, and rerun all named local checks before issuing a
   conclusion. A successful preflight does not authorize W5 release execution,
   G7, V1, or R2.

## DEC-0133: TASK-0027 bounded W5 production release correction authorization

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0027 only
- Execution owner: DeepSeek in PI through the configured OpenCode Go route
- Review/acceptance owner: Codex architecture/review owner
- Supersedes: none; TASK-0024 remains NOT ACCEPTED / PARTIAL, while TASK-0026
  remains a separately reviewed no-log preflight snapshot

### Verified context

1. The product owner explicitly authorized the next W5 production release
   correction after the TASK-0026 preflight and Codex escalation.
2. TASK-0026 records the production database at `0001_initial_schema`, while
   the clean committed release baseline `59101b80b6420155bf8aec26b14ea7800979db86`
   has the approved migration chain through
   `0005_opportunity_reminders_ai_reasoning`.
3. The current local worktree is intentionally dirty. The uncommitted
   TASK-0018 `0006_operation_records` work and all other uncommitted paths are
   not an authorized production release payload.

### Decision

1. Activate one bounded W5 release correction as TASK-0027. DeepSeek in PI is
   the sole production executor; Codex remains the only independent reviewer
   and acceptance decision-maker.
2. The only application payload authorized for publication is the exact Git
   tree at `59101b80b6420155bf8aec26b14ea7800979db86`, limited to the path
   allowlist in TASK-0027. The release may advance only from database revision
   `0001_initial_schema` to `0005_opportunity_reminders_ai_reasoning`.
   `0006_operation_records` is expressly excluded.
3. The executor may create one mode-700 timestamped backup directory beneath
   `/opt/anqiao-crm/backup/`, create a PostgreSQL custom-format dump and an
   application-code archive there, verify their checksums and metadata-only
   manifests, stage the fixed payload, replace only listed CRM runtime files,
   change the CRM Uvicorn bind address from `0.0.0.0:8200` to
   `127.0.0.1:8200`, run the named migration, and restart only
   `anqiao-crm`. The existing `crm` nginx site may be syntax-checked but must
   not be edited or reloaded.
4. Existing runtime secrets may be consumed only inside a non-echoing process
   needed to run the already-configured Alembic command or service. They must
   never be displayed, copied, inspected, written to the repository, or added
   to evidence. No logs may be read or queried.
5. No DNS/TLS change, credential change, package installation, database restore,
   database downgrade, backup deletion, code cleanup, commit, push, G7, full
   V1 business verification, or R2 acceptance is authorized. A real restore
   rehearsal is not authorized; checksum and metadata-only backup validation
   must be reported as insufficient to prove a restore.
6. On any failure before successful liveness checks, the executor may restore
   only the captured CRM code archive and restart only `anqiao-crm`. It must
   not automatically restore or downgrade the production database. Any
   unrecovered database state, unexpected identity, preflight mismatch,
   migration failure, or liveness failure stops the task as `BLOCKED`.
7. Codex must inspect actual task/evidence files, Git state, release manifest,
   diff, checks, and reports before issuing a verdict. A successful TASK-0027
   can establish only its bounded W5 release evidence; G7, full V1, and R2
   remain separately gated.

## DEC-0134: TASK-0028 production runtime dependency-audit package authorization

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0028A, TASK-0028B, and TASK-0028C only
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: package installation, upgrade, downgrade, uninstall,
  cache operation, package download, venv creation/deletion, lockfile write,
  source/configuration write on production, service restart, deployment,
  database access or mutation, backup action, nginx/DNS/TLS action, log access,
  credential/environment-content reading, commit, push, or any other external
  write

### Verified context

1. TASK-0027 stopped before production mutation because the runtime venv's
   `pip check` reported an incompatible `fastapi`/`starlette` combination.
2. The only approved clean release source remains commit
   `59101b80b6420155bf8aec26b14ea7800979db86`. The current worktree is
   intentionally dirty and is excluded from any release assertion.
3. The product owner explicitly authorized the next read-only production
   dependency audit and requested a package of bounded DeepSeek tasks rather
   than one undifferentiated long task.

### Decision

1. Activate the sequential TASK-0028 package:
   - TASK-0028A: local fixed-release dependency baseline and reproducibility
     assessment;
   - TASK-0028B: no-log, read-only production runtime dependency inventory;
   - TASK-0028C: evidence-based comparison and minimum safe remediation
     candidate, proposal only.
2. DeepSeek is the sole executor for all three tasks, in the stated order. It
   may write only the task cards, evidence records, and status/index paths
   listed in the handoff. It may not self-accept any task.
3. Each task must fail closed independently. TASK-0028C must not infer an
   installed dependency contract from the fixed `pyproject.toml`; it must
   distinguish observed package metadata from a proposal.
4. Codex must independently inspect the actual repository changes, Git state,
   diff, task cards, evidence, and named local checks before one verdict. The
   next operation may be authorized only after that review; this decision does
   not authorize any dependency repair.

## DEC-0135: TASK-0029 isolated reproducibility-artifact package authorization

- Date: 2026-08-12
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0029A, TASK-0029B, and TASK-0029C only
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
- Review/acceptance owner: Codex architecture/review owner
- Authorization basis: product owner authorized the next package after the
  TASK-0028 dependency evidence and explicitly requested one bounded DeepSeek
  prompt containing multiple small sequential tasks.
- Does not authorize: any production/SSH action; package action outside the
  isolated task-owned workspace; source, application, migration, test, or
  configuration write; repository dependency declaration change; commit, push,
  reset, clean, or checkout; service action; database access or mutation;
  deployment; backup; nginx/DNS/TLS action; credential, environment-content,
  log, business-data, or package-cache-content reading; or a claim of
  production compatibility/acceptance.

### Verified context

1. TASK-0028A established that fixed release commit
   `59101b80b6420155bf8aec26b14ea7800979db86` has no complete transitive lock
   or wheel-hash manifest. Its fixed `pyproject.toml` SHA-256 is
   `93b3f4bf0589c1175dbcf82b650d138ff30cd003f580a1fcbdfd6cf130d09195`.
2. TASK-0028B recorded an incompatible production dependency state, but its
   executor identity and remote facts remain awaiting Codex independent review.
   TASK-0029 must not use any unaccepted remote assertion as a prerequisite or
   as proof of production behavior.
3. The approved SPEC-0012 v0.2.0 file hash matches its approval metadata.
   The current repository worktree is intentionally dirty and is not release
   input for this task.

### Decision

1. Activate one sequential local-only package:
   - TASK-0029A: fixed-commit extraction, public-index dependency resolution,
     and hash-verified artifact manifest generation in a task-owned external
     workspace;
   - TASK-0029B: two fresh offline local reconstructions from those artifacts,
     then dependency, compilation, and automated-test verification;
   - TASK-0029C: separate Linux CPython 3.12 wheel-availability and offline
     resolution check, explicitly not a Linux runtime or production test.
2. The only permitted network operation is non-interactive read/download from
   `https://pypi.org/simple` into the task-owned external workspace. The task
   must set an isolated no-cache pip configuration and must not use an extra,
   private, or configured package index. Package installation is permitted
   only into fresh task-owned external virtual environments.
3. The executor may write only the TASK-0029 card, named TASK-0029 evidence,
   status/index paths, and the named handoff. Wheel binaries and virtual
   environments stay outside the repository. No artifact becomes a production
   release payload through this decision.
4. Each part fails closed. A missing Python 3.12 interpreter, unresolved or
   unhashed dependency, incompatible/offline reconstruction failure, failed
   test, or unlisted write/action stops the package. The final report cannot
   claim accepted, deployed, production-ready, or production-reproducible.
5. Codex must independently inspect the actual task files, Git state/diff,
   manifests, command outputs, offline verification, tests, and governance
   result before exactly one verdict. Any deployment or service switch needs a
   separate authorized task.

## DEC-0136: TASK-0029 independent acceptance and next-step authorization boundary

- Date: 2026-08-13
- Type: coordinator independent acceptance and escalation boundary
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0135`
- Affects: TASK-0029A/B/C acceptance status only
- Does not authorize: dependency repair or package installation on production,
  environment rebuild, service restart, migration, deployment, database
  access or mutation, SSH, nginx/DNS/TLS change, real data, credentials,
  external writes, commit, or push

### Verified acceptance basis

1. `SPEC-0012 v0.2.0` SHA-256 matches its approval metadata
   (`621131c0…dac1192`).
2. Codex inspected actual TASK-0029 task card, four evidence files, handoff,
   Git state/diff, and re-ran the named checks rather than relying on executor
   prose (see `docs/evidence/TASK-0029-CODEX-INDEPENDENT-ACCEPTANCE-20260813.md`).
3. Codex re-ran: governance (`[PASS]`), `git diff --check` (exit 0),
   SPEC-0012 hash (match), offline `--require-hashes` lock dry-run (exit 0),
   tampered-hash negative test (exit 1), `venv-b1 pip check` (exit 0), and
   verified both pytest logs (`341 passed, 28 skipped`) and both lock manifests
   (40 native / 39 Linux) byte-exact against the workspace manifests.

### Decision

1. `TASK-0029A/B/C` is ACCEPTED for its authorized local-only
   reproducibility-artifact scope. Its acceptance evidence is
   `docs/evidence/TASK-0029-CODEX-INDEPENDENT-ACCEPTANCE-20260813.md`.
2. Verified facts of record: today's resolution of the fixed source pins
   `fastapi==0.136.3` with `starlette==1.6.0` (Windows and Linux); the Linux
   `manylinux_2_17` cp312 resolution drifts to `greenlet==3.2.5` and
   `argon2-cffi-bindings==21.2.0` (Windows: `3.5.5` / `25.1.0`), because the
   newer versions ship no `manylinux_2_17` cp312 wheel.
3. The next remediation step — generating the resolved lock/wheel manifest is
   done; rebuilding a clean immutable environment from those verified
   artifacts and, separately, switching the production service — remains
   `NOT AUTHORIZED` and requires a new product-owner decision recorded as a
   new DEC. No in-place production venv surgery is proposed.

### Escalation boundary

The one next business decision for the product owner (recorded separately,
not auto-dispatched): whether to authorize (a) an isolated staging environment
rebuild + validation from the TASK-0029 Linux artifacts without switching the
running service, or (b) the full environment rebuild plus service switch, or
(c) hold. Recommendation: (a) first.

## DEC-0137: TASK-0030 production environment rebuild + service switch authorization

- Date: 2026-08-13
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0030 only (bounded production Python-environment rebuild,
  validation, and `anqiao-crm` service switch with rollback)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: database access or migration, nginx/DNS/TLS change or
  reload, credential or secret reading, log reading/query, any other
  application source/configuration change, deployment of new code, commit, or
  push

### Verified context

1. The production runtime venv `/opt/anqiao-crm/venv` fails `pip check`
   deterministically: `fastapi 0.141.0` requires `starlette>=0.46.0`, runtime
   has `starlette 0.44.0`; the release source pins `fastapi==0.136.3`.
   TASK-0027 stopped fail-closed at this precondition before any mutation.
2. TASK-0029 (ACCEPTED, `DEC-0136`) produced a frozen, hash-verified
   `requirements.lock` (40 exact versions) that passes 341 tests, plus a
   verified Linux-wheel availability proof.
3. Codex verified (2026-08-13) that the exact tested versions have
   `manylinux_2_28_x86_64` CPython 3.12 wheels for the Ubuntu 24.04 target
   (`greenlet 3.5.5`, `argon2-cffi-bindings 25.1.0` included), so the tested
   set can be deployed on Linux without version drift.
4. The product owner chose option B in the current conversation: one bounded
   rebuild + validate + switch, downtime irrelevant (not yet released, owner
   self-testing only), and directed "reduce uncontrollable factors".

### Decision

1. Activate one bounded production task TASK-0030 with sequential phases:
   (a) local exact-pinned Linux wheelhouse assembly + hash verification;
   (b) read-only server preflight (identity, glibc, disk, current venv state,
   start-script reference); (c) wheelhouse transfer; (d) fresh venv
   `/opt/anqiao-crm/venv-new` built offline with `--require-hashes` from the
   frozen lock; (e) validation (`pip check` + application import/health);
   (f) switch (backup the broken venv in place, swap, restart `anqiao-crm`);
   (g) health check with mandatory rollback (swap the broken venv back) on any
   failure.
2. The only production mutations authorized are: creating the new venv, the
   venv directory rename/swap under `/opt/anqiao-crm`, and restarting only the
   `anqiao-crm` service. The database stays at its current revision; migration
   is a separate, later, separately-authorized task.
3. Every phase fails closed. No in-place mutation of the existing venv; the
   broken venv is preserved as the rollback target until the switch is
   verified healthy. No credential, secret, environment value, log, or
   business-row value may be read, printed, or stored.
4. Codex independently inspects the actual task card, evidence, Git state/diff,
   and re-runs the named local checks before one verdict. A successful
   TASK-0030 establishes only the environment rebuild + switch; W5 release
   execution, G7, V1, and R2 remain separately unauthorized.

### Consequences

- Removes the dependency-drift root cause by installing only the frozen,
   hash-verified set (offline, no live resolution on the server).
- The database migration (`0001_initial_schema` toward the release head) is
   explicitly out of scope and remains a separate authorization.

## DEC-0138: TASK-0030 independent review, root-cause correction, and next-switch authorization boundary

- Date: 2026-08-13
- Type: coordinator independent review and escalation boundary
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0137`
- Affects: TASK-0030 review outcome only
- Does not authorize: any new production mutation, venv swap, service restart,
  database access or migration, nginx/DNS/TLS change, credential/log read,
  commit, or push

### Verified review basis

1. Codex re-ran governance (`[PASS]`), `git diff --check` (exit 0), confirmed
   HEAD unchanged (`59101b80…`), and confirmed executor writes were confined to
   the TASK-0030 exclusive paths.
2. Codex independently verified the server state: service HTTP 200 on
   `/login`; `/opt/anqiao-crm/venv` restored (its `pip check` still reproduces
   the fastapi/starlette mismatch); the clean frozen venv preserved at
   `/opt/anqiao-crm/venv-failed-20260813022501` with a clean `pip check` and a
   working `python3.12 -m uvicorn`.
3. Codex verified the actual switch-failure root cause: the clean venv's
   `uvicorn`/`pip` shebangs point to the stale path
   `#!/opt/anqiao-crm/venv-new/bin/python3.12` because the venv was created at
   `venv-new` then moved to `venv`; the start script execs
   `/opt/anqiao-crm/venv/bin/uvicorn` directly, so the stale shebang prevented
   service start before any application import.

### Decision

1. TASK-0030 execution is ACCEPTED as a correct fail-closed run: the bounded
   work was done, the switch failed, and the mandatory rollback restored the
   service with no data/source/config/database impact. Review evidence:
   `docs/evidence/TASK-0030-CODEX-INDEPENDENT-REVIEW-20260813.md`.
2. The executor's recorded root cause ("deployed code does not run with the
   frozen dependency set") is CORRECTED: it is not proven, and the verified
   cause is the venv-move shebang breakage. Whether the deployed code actually
   runs with the frozen dependencies remains `[UNKNOWN]` until a corrected
   switch attempt.
3. A corrected next switch attempt must be relocation-safe (create the venv at
   the final path, or fix the console-script shebangs, or run uvicorn via
   `python -m uvicorn`) and must re-determine code/dependency compatibility.

### Escalation boundary

The next switch attempt is a new production mutation and requires a new
product-owner authorization recorded as a new DEC. It is not dispatched by
this decision.

## DEC-0139: TASK-0031 full W5 production release authorization (code + migration + corrected venv)

- Date: 2026-08-13
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0031 only (bounded W5 production release: fixed payload
  deployment, database migration 0001→0005, relocation-safe frozen-lock venv
  switch, service restart, with backup and rollback)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: DNS/TLS change, nginx edit/reload (syntax check only),
  credential/secret reading, log reading/query, database restore or downgrade,
  cleanup of backups or old artifacts, commit, push, G7, full V1, or R2

### Verified context

1. TASK-0027 (W5 release correction, DEC-0133) stopped BLOCKED at the runtime
   venv `pip check` precondition before any mutation. The release payload is
   commit `59101b80b6420155bf8aec26b14ea7800979db86` (9 allowlisted paths,
   archive SHA-256 `c856aa8c…eb39fc9`).
2. TASK-0030 (DEC-0137) built and validated the frozen-lock Linux venv
   (39 exact versions, offline hash-enforced, pip check clean) but the switch
   failed because the venv was created at `venv-new` then `mv`-ed, breaking
   the console-script shebangs. Rollback restored the service. Root cause
   corrected under DEC-0138.
3. Migrations 0002–0005 are additive (create_table / add_column /
   create_index only; no alter/drop of existing tables), so the forward
   migration is low-risk and old code remains compatible with the 0005 schema
   for rollback purposes.
4. `migrations/env.py` imports the deployed `crm` package, so the migration
   must run with the new code deployed and the new venv active.
5. The product owner authorized the full W5 release in the current
   conversation.

### Decision

1. Activate one bounded production task TASK-0031 with sequential phases:
   local archive preparation; read-only preflight; backup (pg_dump -Fc + code
   archive + checksums); staged release payload (compile + alembic head
   check); service stop; code swap; relocation-safe venv recreate at the final
   path with offline hash-enforced install; database migration to
   `0005_opportunity_reminders_ai_reasoning`; service start; health + revision
   verification; mandatory rollback on any failure.
2. Authorized production mutations: one backup directory, the application-code
   path swap, the venv directory swap, the forward database migration
   (`alembic upgrade` to 0005 only), and restart of `anqiao-crm` only.
3. The loopback bind-address change (0.0.0.0:8200 → 127.0.0.1:8200) is
   DEFERRED to a separate task (not part of TASK-0031) to keep this release's
   failure surface minimal.
4. Every phase fails closed. Rollback restores code and venv; the database is
   forward-only (downgrade/restore is separately authorized; the pg_dump
   backup exists for that). No secret, environment value, log, or business-row
   value may be read, printed, or stored.
5. Codex independently inspects the task card, evidence, Git state/diff, and
   re-runs the named checks before one verdict. A successful TASK-0031
   establishes only the bounded W5 release; G7, V1, and R2 remain separately
   unauthorized.

### Consequences

- The production service runs the release source with the frozen, tested
  dependency set and the migrated 0005 schema.
- The loopback bind tightening, DNS/TLS, full V1 verification, and R2
  acceptance remain separate future authorizations.

## DEC-0140: TASK-0031 independent review, root-cause confirmation, and corrected-migration authorization boundary

- Date: 2026-08-13
- Type: coordinator independent review and escalation boundary
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0139`
- Affects: TASK-0031 review outcome only
- Does not authorize: any new production mutation, the `ALTER TABLE
  alembic_version` DDL, code/venv swap, service restart, database migration,
  nginx/DNS/TLS change, credential/log read, commit, or push

### Verified review basis

1. Codex re-ran governance (`[PASS]`), `git diff --check` (exit 0), confirmed
   HEAD unchanged (`59101b80…`), and confirmed executor writes were confined to
   the TASK-0031 exclusive paths.
2. Codex independently verified the server state: service HTTP 200; DB
   unchanged at `0001_initial_schema` with 10 public tables; the restored venv
   reproduces the original fastapi/starlette mismatch; the staged code, frozen
   venv, and backup artifacts are preserved.
3. Codex confirmed the migration-blocking defect: the 0005 revision id is
   exactly 39 characters (`0005_opportunity_reminders_ai_reasoning`; the
   executor wrote 41) while `alembic_version.version_num` is
   `character varying(32)`. The failure is a release-payload defect, not an
   execution defect; the single-transaction rollback left the database
   untouched.

### Decision

1. TASK-0031 execution is ACCEPTED as a correct fail-closed run: all phases up
   to the migration succeeded, the migration blocked on a genuine payload
   defect, and the mandatory rollback restored the prior running state with
   the database untouched. Review evidence:
   `docs/evidence/TASK-0031-CODEX-INDEPENDENT-REVIEW-20260813.md`.
2. Recommended fix: a one-time `ALTER TABLE alembic_version ALTER COLUMN
   version_num TYPE varchar(64);` before re-running the migration — it touches
   only alembic's bookkeeping table, changes no application schema/data, and
   leaves the reviewed release payload (`c856aa8c…`) unchanged.

### Escalation boundary

The corrected migration (column widening + code/venv swap + migration + start
+ verify) is a new production mutation and requires a new product-owner
authorization recorded as a new DEC. It is not dispatched by this decision.

## DEC-0141: TASK-0032 corrected W5 release authorization (column widen + release re-run)

- Date: 2026-08-13
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0032 only (one-time `alembic_version` column widening + re-run
  of the bounded W5 release using the preserved artifacts)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: database restore/downgrade, nginx/DNS/TLS change or
  reload, credential/secret reading, log reading/query, cleanup of backups or
  old artifacts, commit, push, G7, full V1, or R2

### Verified context

1. TASK-0031 (DEC-0139) blocked at the migration step because
   `alembic_version.version_num` is `character varying(32)` while the 0005
   revision id is 39 characters. The single-transaction migration rolled back
   atomically, so the database is unchanged at `0001_initial_schema`.
2. Codex confirmed the defect (DEC-0140) and recommended a one-time
   `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(64);`.
3. Preserved, verified artifacts from TASK-0031 are reusable: staged release
   code at `/opt/anqiao-crm/tmp/task0031-20260813085841/`; frozen-lock venv at
   `/opt/anqiao-crm/venv-failed-20260813085841/`; backup at
   `/opt/anqiao-crm/backup/pre-release-20260813085841/` (database.dump still
   captures the unchanged 0001 state); wheelhouse + lock at `/tmp/task0030/`.
4. The product owner authorized the corrected release in the current
   conversation.

### Decision

1. Activate one bounded production task TASK-0032 with sequential phases:
   read-only preflight; the one-time `ALTER TABLE alembic_version ALTER COLUMN
   version_num TYPE varchar(64);`; service stop; code swap (staged release
   payload over live paths); relocation-safe venv rebuild at the final path
   (offline hash-enforced from `/tmp/task0030/`); database migration to
   `0005_opportunity_reminders_ai_reasoning`; service start; HTTP + revision
   verification; mandatory rollback on any failure.
2. Authorized production mutations: the single `ALTER TABLE` on
   `alembic_version` (widen to varchar(64) only), the application-code path
   swap, the venv directory swap, the forward `alembic upgrade` to 0005, and
   restart of `anqiao-crm` only.
3. The loopback bind-address change remains DEFERRED (not part of TASK-0032).
4. Every phase fails closed. Rollback restores code and venv; the database is
   forward-only (downgrade/restore is separately authorized). No secret,
   environment value, log, or business-row value may be read, printed, or
   stored.
5. Codex independently inspects the task card, evidence, Git state/diff, and
   re-runs the named checks before one verdict. A successful TASK-0032
   establishes only the bounded W5 release; G7, V1, and R2 remain separately
   unauthorized.

### Consequences

- The production service runs the release source with the frozen, tested
  dependency set and the migrated 0005 schema.
- The loopback bind tightening, DNS/TLS, full V1 verification, and R2
  acceptance remain separate future authorizations.

## DEC-0142: TASK-0032 independent acceptance — W5 production release verified complete

- Date: 2026-08-13
- Type: coordinator independent acceptance
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0141`
- Affects: TASK-0032 acceptance status only
- Does not authorize: G7 (DNS/TLS), full V1 business verification, R2
  acceptance, the loopback bind-address change, any further production
  mutation, commit, or push

### Verified acceptance basis

1. Codex re-ran governance (`[PASS]`), `git diff --check` (exit 0), confirmed
   HEAD unchanged (`59101b80…`), and confirmed executor writes were confined to
   the TASK-0032 exclusive paths.
2. Codex independently verified the production state: service HTTP 200; DB at
   `0005_opportunity_reminders_ai_reasoning`; `alembic_version.version_num`
   widened to `varchar(64)`; new tables `erasure_records`, `import_batches`,
   `import_row_results`, `opportunity_reminders` present; 0005 AI columns
   (`ai_used`, `external_egress`, `model_identifier`, `egress_field_names`)
   present; fastapi 0.136.3 / starlette 1.6.0 with a clean `pip check`.
3. Codex verified the deployed source is the release payload: 35 `.py` files
   under `/opt/anqiao-crm/src` matching the fixed commit; release-only modules
   present (`discovery.py`, `discovery_ai.py`, `opportunity_repository.py`);
   migrations 0001–0005 only (no `0006_operation_records`); no
   `operation_repository` in persistence.

### Decision

1. `TASK-0032` (corrected W5 production release) is ACCEPTED for its bounded
   scope. Acceptance evidence:
   `docs/evidence/TASK-0032-CODEX-INDEPENDENT-REVIEW-20260813.md`.
2. The production service now runs the release source with the frozen, tested
   dependency set against the migrated 0005 schema. This is technical
   verification, not product-owner acceptance.

### Consequences

- W5 (production release) is technically complete and accepted.
- G7 (DNS/TLS), full V1 business verification, R2 (product-owner acceptance),
  and the deferred loopback bind change remain separately authorized future
  gates.

## DEC-0143: TASK-0033 V1 production business verification + loopback tightening authorization

- Date: 2026-08-13
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0033 only (bounded V1 production business verification and the
  deferred loopback bind-address tightening)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: G7 (DNS/TLS) change, full R2 acceptance, real-data
  mutation, database write beyond the ephemeral synthetic-account login
  session, nginx edit/reload, credential/secret reading, log reading/query,
  commit, or push

### Verified context

1. W5 production release is complete and accepted (DEC-0142): release source,
   frozen dependency set, and the migrated 0005 schema are live and healthy
   (HTTP 200).
2. The remaining gates are G7 (DNS/TLS), V1 (runtime business verification),
   and R2 (product-owner acceptance). The loopback bind tightening was
   deferred from earlier tasks.
3. The product owner authorized a V1 verification plus the loopback tightening
   in the current conversation.

### Decision

1. Activate one bounded production task TASK-0033 with sequential phases:
   (a) read-only re-verification of the release (health, schema, dependencies,
   new tables queryable); (b) authenticated GET-only business-flow verification
   using the synthetic business-user account documented in NOW.md (login,
   masked institution/contact list, masked detail, masked search — no
   business-data write); (c) the loopback bind-address tightening
   (`--host 0.0.0.0` → `127.0.0.1` in `/opt/anqiao-crm/scripts/start.sh`) with
   restart and health verification, plus rollback of the bind change on
   failure.
2. Authorized production mutations: only the start-script `--host` value
   change and the `anqiao-crm` restart; the only database write permitted is
   the ephemeral server-session row created by the synthetic-account login.
   No business row may be created, updated, or deleted.
3. Every phase fails closed. The bind change is reverted on any health failure.
   No credential, session token, log, or business-row value may be printed or
   stored.
4. Codex independently inspects the task card, evidence, Git state/diff, and
   re-runs the named checks before one verdict. A successful TASK-0033
   establishes only V1 runtime verification plus the loopback tightening;
   G7 and R2 remain separately authorized.

### Consequences

- Production business flows and field-level masking are verified read-only on
  the released system.
- The CRM application port is no longer exposed to the public internet
  (listens on loopback only; nginx on the same host continues to serve HTTPS).

## DEC-0144: Agent (代理) login role and user phone-number field scope change

- Date: 2026-08-13
- Type: product-owner decision / scope change
- Status: active
- Decided by: Product owner
- Affects: SPEC-0002 (users/roles/ownership), SPEC-0014 (account credential
  self-modification), the `user_identities` and `role_grants` schema, and the
  planned creation of one agent account (username `zxx`, 张先侠)
- Supersedes: the `SPEC-0002 v0.2.0` §4 non-goal that excluded external
  partner/portal accounts, and `DEC-0012`'s internal-only framing to the
  extent that an external 代理 account is now in scope
- Does not authorize: implementation, migration, or production data mutation
  before SPEC approval + an active task + separate implementation
  authorization (`AGENTS.md` §5)

### Verified context

1. The product owner asked to create a login account for 张先侠 (username
   `zxx`, temporary password `123`, phone `15805243456`) and described that
   person as a 代理 (external dealer/partner), not an internal employee; the
   password is a temporary one the user will change themselves.
2. `SPEC-0002 v0.2.0` §4 explicitly excludes external portal/partner accounts,
   and `DEC-0012` limits the product to the internal B2B/G CRM. An external
   代理 login is therefore a scope expansion.
3. `SPEC-0014 v0.1.0` §1 already records the `sa` (sales) / `dl` (dealer)
   username-prefix convention, so the 代理 channel concept is established.
4. `user_identities` currently has no phone column; phone exists only on the
   `contacts` table. The `role_grants.role` CHECK constraint lists only
   `business_user` / `administrator` / `general_manager` / `manager`.
5. In the current conversation the product owner decided: add the 代理 role,
   add the phone dimension, and confirmed the agent role's permission scope is
   identical to `business_user` (differences can be revisited later).

### Decision

1. Add a new role 代理 (`agent`) to `SPEC-0002`. Its permission scope is
   identical to `business_user`: owner-level detail on assigned records,
   masked collaborator view of others' records, and self-service credential
   change. It does not grant account/role management, ownership transfer, or
   management summaries. It is a distinct role label so external 代理 accounts
   can be audited and queried separately from internal business users.
2. Add an optional, non-unique `phone` column to `user_identities` for
   identity-recording and administrator visibility. It is not used for login.
3. Amend `SPEC-0014` so the `agent` role may use the self-service credential
   endpoints (currently `business_user` / `administrator` only).
4. These are product decisions only. SPEC approval and implementation
   authorization remain separate per `AGENTS.md` §5.

## DEC-0145: SPEC-0002 v0.3.0 / SPEC-0014 v0.2.0 approval + TASK-0034 implementation authorization

- Date: 2026-08-13
- Type: product-owner SPEC approval and implementation authorization
- Status: active
- Decided by: Product owner
- Affects: `SPEC-0002 v0.3.0` and `SPEC-0014 v0.2.0` approval, and
  TASK-0034 (agent role + user phone field implementation)
- Does not authorize: production database migration, production real-data
  mutation (creating account `zxx`/张先侠), deployment, commit, or push

### Verified context

1. `DEC-0144` recorded the product owner's decision to add the 代理 (`agent`)
   role and the optional user phone field.
2. Drafts `SPEC-0002 v0.3.0` and `SPEC-0014 v0.2.0` were prepared under
   `docs/specs/10-draft/` and presented to the product owner.
3. The product owner replied `批准` to the two-option approval question,
   which this record interprets as: approve both SPECs and authorize the
   implementation task (option 2). Production mutation remains a separate
   later authorization.

### Decision

1. `SPEC-0002 v0.3.0` is APPROVED (supersedes v0.2.0).
2. `SPEC-0014 v0.2.0` is APPROVED (supersedes v0.1.0).
3. TASK-0034 is authorized for local implementation scope only: code changes,
   the Alembic migration file, and local tests for the `agent` role and the
   `user_identities.phone` field.
4. Running the migration against production and creating the `zxx` account
   are production mutations and remain separately authorized.

## DEC-0146: Production deployment + migration 0007 + `zxx` account creation authorization

- Date: 2026-08-13
- Type: product-owner authorization (production mutation)
- Status: active
- Decided by: Product owner
- Affects: production deployment of the TASK-0034 code, the Alembic
  migration to `0007_agent_role_and_user_phone`, and the creation of one
  agent account (`zxx` / 张先侠)
- Execution owner: Codex (PI), current session
- Does not authorize: `0006_operation_records` (remains excluded), any other
  source/configuration change, nginx/DNS/TLS change, credential reading,
  commit, or push

### Verified context

1. The product owner replied `明确授权` to authorize the two production steps
   (migration 0007 + `zxx` account creation).
2. Read-only production preflight verified: identity `ubuntu@VM-0-17-ubuntu`;
   `anqiao-crm` service active; `GET /login` on `127.0.0.1:8200` returns 200;
   DB revision is `0005_opportunity_reminders_ai_reasoning`.
3. The `role_grants` CHECK constraint in production is named
   `ck_role_grants_ck_role_grants_role_value` (the `ck_%(table_name)s_%(constraint_name)s`
   naming convention), matching migration 0007's generated SQL.
4. Migration `0007` was rebased onto `0005` (not `0006`) because `0006_operation_records`
   is expressly excluded from production (DEC-0133/0139/0141); 0006 and 0007 are
   now sibling heads branching from 0005.

### Decision

1. Deploy the TASK-0034 source changes to production, excluding the
   TASK-0018 `OperationRecordModel`/`0006` work (which stays out of production).
2. Run `alembic upgrade 0007_agent_role_and_user_phone` against production
   (adds `user_identities.phone`; widens the `role_grants` role CHECK to
   include `agent`).
3. Restart `anqiao-crm` and verify health.
4. Create account `zxx` (display_name 张先侠, role `agent`, phone
   `15805243456`, temporary password `123`, status enabled).
5. Backup before mutation; fail-closed with rollback of code and the
   forward-only migration on any failure before verification.

## DEC-0148: TASK-0033 independent acceptance — V1 verification + loopback tightening

- Date: 2026-08-13
- Type: coordinator independent acceptance
- Status: active
- Decided by: Codex architecture/review owner under `DEC-0124` and `DEC-0143`
- Affects: TASK-0033 acceptance status only
- Does not authorize: G7 sign-off, R2 acceptance, any further production
  mutation, commit, or push

### Verified acceptance basis

1. Codex re-ran governance (`[PASS]`), `git diff --check` (exit 0), confirmed
   HEAD unchanged, and confirmed executor writes were confined to the TASK-0033
   exclusive paths with no credential/session-token leakage in evidence.
2. Codex independently verified the production state: loopback service 200;
   listener `127.0.0.1:8200` (no longer `0.0.0.0:8200`); public HTTPS 200;
   `start.sh` `--host 127.0.0.1` with backup; DB revision 0005; pip check
   clean; fastapi 0.136.3 / starlette 1.6.0.
3. Codex independently re-verified masking: synthetic business-user login 200;
   institution detail 200 with exactly one `***` masking marker (contact value
   masked for the non-owner).

### Decision

1. `TASK-0033` (V1 business verification + loopback tightening) is ACCEPTED
   for its bounded scope. Acceptance evidence:
   `docs/evidence/TASK-0033-CODEX-INDEPENDENT-REVIEW-20260813.md`.
2. The application port is no longer publicly exposed; business flows and
   masking are verified read-only on the released system.

### Consequences

- G7 (DNS/TLS): the CRM already serves HTTPS at `crm.aibrain.wiki` (verified);
   a formal G7 sign-off remains a product decision.
- R2 (product-owner visual/business acceptance) is the remaining human gate.

## DEC-0147: TASK-0035 initial account seeding authorization

- Date: 2026-08-13
- Type: product-owner authorization
- Status: active
- Decided by: Product owner
- Affects: TASK-0035 only (bounded production initial-account seeding: create
  gm / hedan / zhoujingjing and set all four accounts' password to "123")
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Does not authorize: any other business-data mutation, database restore/
  downgrade, nginx/DNS/TLS change, credential/secret reading, log reading/
  query, commit, or push

### Verified context

1. W5 release, V1 verification, and loopback tightening are complete and
   accepted (DEC-0142, DEC-0146).
2. The product owner provided the initial account roster: admin (administrator),
   gm (general manager / 总经理), hedan and zhoujingjing (business users), all
   with password "123".
3. The application has no "create user" endpoint; initial accounts are seeded
   directly (user_identities + role_grants) using the app's real argon2id
   `hash_password` (from `crm.web.auth`). The legacy
   `scripts/create_admin_account.py` uses a non-conformant PBKDF2 hash and must
   NOT be used.
4. The product owner authorized the account seeding in the current
   conversation (option A).

### Decision

1. Activate one bounded production task TASK-0035 with sequential phases:
   (a) read-only verification of the current usernames and active roles;
   (b) seed the four accounts — create missing users with the app's real
   argon2id hash of "123", set status enabled, reset the password of any
   existing account to "123", and grant the correct role via the app's
   `GrantRoleCommand` (idempotent, audited); (c) read-only verification of the
   seeded accounts and a login test for each.
2. Authorized production mutations: only the four `user_identities` rows
   (create/update password_hash and status) and their `role_grants` rows
   (administrator / general_manager / business_user) plus the associated audit
   events from GrantRoleCommand. No other business row may be created,
   updated, or deleted.
3. Passwords are the plaintext "123" hashed with the app's argon2id
   `hash_password`; the plaintext is never printed or stored in evidence.
4. Every phase fails closed. No credential, password hash, log, or
   business-row value may be printed or stored.
5. Codex independently inspects the task card, evidence, Git state/diff, and
   re-runs the named checks before one verdict.

### Consequences

- The production CRM has the four initial accounts with the requested roles
  and password; users may self-change passwords afterward (SPEC-0014).
- A weak-password advisory remains the product owner's decision.

## DEC-0149: 权限模型重定义 —— agent 登录角色废弃、客户三类型、公池、商机重定义

- Date: 2026-08-13
- Type: product-owner decision (scope change)
- Status: active
- Decided by: Product owner（一次 grilling 会话逐题确认）
- Affects: SPEC-0001（客户类型+公池）、SPEC-0002（角色与归属）、SPEC-0003
  （商机定义）、SPEC-0014（自助改密操作主体）
- Supersedes: `DEC-0144` / `DEC-0145` / `DEC-0146` 中关于 agent 登录角色与
  zxx 账号的部分（用户手机号字段决定不推翻）；不推翻 `DEC-0147` 的账号种子
- Does not authorize: 任何代码修改、迁移、生产数据变更、zxx 账号删除/降级、
  commit、push、部署

### Verified context

1. `DEC-0144` 曾新增 agent 登录角色并决定建 zxx（张先侠）账号；`DEC-0145`
   批准 SPEC-0002 v0.3.0 + SPEC-0014 v0.2.0；`DEC-0146` 授权生产部署迁移
   0007 并创建 zxx 账号。
2. 产品负责人在 grilling 会话中明确：zxx 应该是**客户**而不是**用户**，
   之前的做法错误。"代理"应是一种客户类型（渠道的子例），不是登录角色。
3. 会话逐题确认了完整的权限模型、客户类型、公池与商机定义（记录于
   `CONTEXT.md` 与 `ADR-0004`）。

### Decision

1. **废弃 agent 登录角色**。登录用户回到四种内部角色：administrator /
   general_manager / business_user / manager。zxx 应转为客户记录（渠道类型），
   不再是登录用户。
2. **权限模型**：admin 全局可看 + 无理由改业务记录（自动留痕）；gm 全局脱敏
   只读 + 脱敏商机 + 逾期督促清单（只读）+ 点名分配（必填理由，可下拉选）+
   进池；business_user 名下完整 / 他人脱敏+进度 + 认领公池；manager 范围只读。
3. **客户类型三值纯标签**：直接采购 / 个人 / 渠道。个人第一版仅预留，不落地
   流程与 PII；渠道不做层级与佣金结算。
4. **公池**：无主状态（owner 可空 + 显式"在池"），admin/gm 手动进池（写负责人
   历史 + 必填原因），全体业务角色脱敏可见，business_user 认领（认领即成为
   负责人，留审计），第一版不设防囤积护栏。
5. **商机重定义**：AI 判断新商业机会（候选 + 理由，人最终裁定），两个来源
   （现有客户 + 网络爬虫）。AI 无最终判定权、不自动建档。

### Consequences

- 生产上已存在的 zxx 登录账号、迁移 0007（agent 角色 CHECK 放宽）是旧模型
  产物。纠正它们（删账号/回退迁移）是生产数据变更，需新的单独授权，本 DEC
  不授权执行。
- SPEC-0014 v0.2.0 的 R-011（agent 可自助改密）随之失效，需在 SPEC 修订中
  移除。
- 本 DEC 是产品行为授权；实现仍须经 SPEC 修订 → 批准 → active task →
  单独实现授权（`AGENTS.md` §5）。

## DEC-0150: 生产停用 zxx 账号授权

- Date: 2026-08-13
- Type: product-owner authorization (production mutation)
- Status: active
- Decided by: Product owner
- Affects: production `user_identities` row for `zxx`（张先侠）only
- Execution owner: Codex (PI), current session
- Supersedes: none; `DEC-0146` remains historical record of the creation
- Does not authorize: account deletion, role-grant removal, migration 0007
  rollback, any other business-data mutation, commit, or push

### Verified context

1. `DEC-0149` deprecated the agent login role; the product owner confirmed zxx
   should be a customer, not a user.
2. Read-only preflight (2026-08-13, `ubuntu@124.222.212.159` / `VM-0-17-ubuntu`)
   verified: zxx exists with `status=enabled`, role `agent`, 0 owned
   institutions, 0 owner-history rows.
3. `SPEC-0002 R-004` requires disable over delete (deny new access, preserve
   history). The app's `DisableUserCommand` sets `status=disabled`, bumps
   `session_epoch`, and writes a before/after audit event (R-005, R-014).

### Decision

1. Disable (not delete) the production `zxx` account using the app's
   `DisableUserCommand`, with the canonical `admin` account as the actor and a
   reason referencing `DEC-0149`.
2. Do not delete the row, do not revoke the `agent` role grant, do not roll
   back migration 0007. Those remain separate, un-authorized future decisions.

### Consequences

- `zxx` can no longer log in; existing sessions are invalidated by the epoch
  bump on next validation.
- The `agent` role grant and migration 0007 remain on production as historical
  artifacts pending a separate, future authorization.

## DEC-0151: SPEC 撰写与实现分工 —— DeepSeek-v4-pro 撰写 SPEC，DeepSeek-v4-flash 实现，变更询问产品负责人

- Date: 2026-08-13
- Type: process decision (cross-tool coordination / model specialization)
- Status: active
- Decided by: Product owner
- Affects: SPEC 撰写责任、实现执行责任、产品行为变更的询问机制、
  `docs/governance/MODEL-ROUTING.md`（推荐分工）
- Supersedes: `MODEL-ROUTING.md` 中"架构负责人 = GPT-5.6-sol / Codex"的
  推荐分工，改为由 DeepSeek-v4-pro 承担 SPEC 撰写（架构负责人）角色；实现
  执行人仍为 DeepSeek-v4-flash
- Does not authorize: 任何 SPEC 批准、应用代码修改、迁移、生产数据变更、
  commit、push 或部署

### Decision

1. **SPEC 撰写**：DeepSeek v4 Pro 负责把所有 SPEC 文件写好（撰写、修订、
   整理到评审就绪状态）。
2. **实现**：DeepSeek v4 Flash 负责按已批准 SPEC 实现。
3. **变更询问机制**：撰写或实现过程中若需要修改产品行为，允许向产品负责人
   询问，并给出深入浅出的介绍与建议，由产品负责人决策。
4. 治理不变：实现仍须 SPEC 批准 + active task + 单独实现授权（`AGENTS.md`
   §5）；产品负责人不承担任何工程执行。

### Consequences

- 后续 SPEC 修订草案的 `Prepared by` 归因于 DeepSeek-v4-pro。
- 实现任务在执行前仍须走完整 gate：本 SPEC 批准 → active task → 单独实现
  授权；DeepSeek-v4-flash 不自批、不自审。
- 无法从既有决策（DEC/ADR/CONTEXT）推断的产品行为，写入 SPEC 的 `Open
  decisions` 并以大白话提交产品负责人拍板，不在代码里悄悄定。

### Decision evidence

产品负责人 2026-08-13 指令：「我要求 deepseek v4 pro 把 spec 文件都写好，
deepseek v4 flash 负责实现这些 spec，如果遇到需要修改的时候，允许向我询问
（并给我深入浅出的介绍和建议），由我来决策。」

## DEC-0152: DEC-0149 修订 SPEC 的开放决策拍板

- Date: 2026-08-13
- Type: product-owner decision（解决 SPEC-0001/0002/0003 修订草案的开放决策）
- Status: active
- Decided by: Product owner
- Affects: SPEC-0001 v0.8.0（客户类型可改）、SPEC-0002 v0.4.0（逾期督促清单）、
  SPEC-0003 v0.4.0（爬虫留存）
- Supersedes: `DEC-0149` 中「gm 逾期督促清单（只读）」一项（产品负责人判"太重，
  不需要"）
- Does not authorize: 任何实现、迁移、生产数据变更、commit、push 或部署

### Decision

1. **爬虫抓取留存 30 天**（SPEC-0003 OD-001 解决）：外部公开信息抓取结果固定
   留存 **30 天**，到期自动清除；人采纳后转成正式客户记录的不受此限，走正式
   数据生命周期留存规则。
2. **客户类型可改、留痕**（SPEC-0001 OD-002 解决）：客户类型（直接采购/个人/
   渠道）建档后可修改，但必须留痕（谁改、何时、从什么改成什么）。
3. **逾期督促清单 descoped**（SPEC-0002）：产品负责人认为"逾期督促清单"跟踪
   待办目标日期 + 完成状态的机制太重、不需要，故 gm 权限**去掉**"逾期督促清单"
   一项，保留：全局脱敏只读 + 脱敏商机 + 点名分配（必填理由）+ 进池。

### Decision evidence

产品负责人 2026-08-13 对修订 SPEC 开放决策的答复：爬虫留存选「30 天」；客户
类型选「能改，但留痕」；逾期定义答复「太重了，不需要」。

## DEC-0153: 批准 DEC-0149 修订的 4 份 SPEC

- Date: 2026-08-13
- Type: product-owner approval (SPEC approval only)
- Status: active
- Decided by: Product owner
- Affects: SPEC-0001 v0.8.0、SPEC-0002 v0.4.0、SPEC-0003 v0.4.0、SPEC-0014 v0.3.0
- Supersedes: SPEC-0001 v0.7.0、SPEC-0002 v0.3.0、SPEC-0003 v0.3.0、SPEC-0014
  v0.2.0（均归档至 `90-deprecated/`）
- Does not authorize: 实现、迁移、生产数据变更、commit、push 或部署

### Decision

产品负责人在对话内明确确认「批准这 4 份 SPEC」：

1. `SPEC-0001 v0.8.0`（客户三类型 + 公池 + 术语统一为「客户」）
2. `SPEC-0002 v0.4.0`（废弃 agent 登录角色 + admin/gm 权限重定义）
3. `SPEC-0003 v0.4.0`（商机重定义 + 网络爬虫）
4. `SPEC-0014 v0.3.0`（自助改密操作主体回退，删除 agent）

本批准为 SPEC 批准（`AGENTS.md` §2/§5），**不授权实现**。实现须另建 active
task，经产品负责人单独授权后由 DeepSeek-v4-flash 执行（`DEC-0151`）。

### Decision evidence

产品负责人 2026-08-13 在对话中回复「批准这 4 份 SPEC（推荐）」。

### Consequences

- 4 份 SPEC 转正至 `30-approved/`，各自写入匹配 SHA-256 的 `.approval.json`。
- 被取代的 v0.7.0 / v0.3.0 / v0.3.0 / v0.2.0 归档至 `90-deprecated/`。
- 下一阶段：由 DeepSeek-v4-pro 拆解实现任务（active task），交产品负责人授权后，
  由 DeepSeek-v4-flash 实现。

## DEC-0154: 授权实现 DEC-0153 批准的 4 份 SPEC（本地合成数据范围）

- Date: 2026-08-13
- Type: product-owner authorization (implementation authorization)
- Status: active
- Decided by: Product owner
- Affects: TASK-0036（SPEC-0002 v0.4.0 + SPEC-0014 v0.3.0）、TASK-0037（SPEC-0001
  v0.8.0）、TASK-0038（SPEC-0003 v0.4.0）
- Execution owner: DeepSeek-v4-flash（产品负责人切换后执行）
- Does not authorize: 生产部署、迁移、生产数据变更、zxx 删除/降级、迁移 0007 回退、
  commit、push

### Decision

产品负责人授权实现 `DEC-0153` 批准的 4 份 SPEC，拆为 3 个实现任务：

1. `TASK-0036`：SPEC-0002 v0.4.0（废弃 agent 角色 + admin/gm 重定义）+
   SPEC-0014 v0.3.0（自助改密操作主体回退）。
2. `TASK-0037`：SPEC-0001 v0.8.0（客户三类型 + 公池 + 术语统一「客户」）。
3. `TASK-0038`：SPEC-0003 v0.4.0（商机重定义 + 网络爬虫）。

执行由 DeepSeek-v4-flash 承担（`DEC-0151`），产品负责人切换至 v4-flash 后执行。
实现范围为**本地合成数据**；生产部署/迁移/数据变更需另行单独授权。

### Decision evidence

产品负责人 2026-08-13 回复：「授权。但具体实现需要我切换为 deepseek v4 flash 实现」。

### Consequences

- 3 张实现任务卡置于 `docs/tasks/active/`，状态 ACTIVE，授权依据 `DEC-0154`。
- DeepSeek-v4-flash 逐任务实现，写完由 DeepSeek-v4-pro 独立评审（不自批）。
- 生产侧（zxx 停用 DEC-0150、迁移 0007 回退）仍是独立的未完成生产授权项。
