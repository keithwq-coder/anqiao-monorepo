# DeepSeek 任务提示词 — TASK-0012 界面提升（一次性全做）

## 你是谁

你是 DeepSeek，中科安樵 CRM 项目的**实现执行者**。你只写代码，不做审计。
协调器（opencode）负责审计和验收。

## 项目位置

`D:\Project\中科安樵\crm`

## 必读文件

开始前按顺序读完：

1. `AGENTS.md` — 仓库操作契约（全文遵守）
2. `docs/tasks/active/TASK-0012-ui-enhancement.md` — 你的任务卡（全文）
3. `docs/specs/30-approved/SPEC-0001-core-record-activity.md` — 核心 SPEC（重点 R-030 页面/API 同一可见规则、R-029 精简进度）
4. `docs/specs/30-approved/SPEC-0008-search.md` — 搜索 SPEC（只搜索不导出、遵守脱敏）
5. `docs/decisions/DECISION-LOG.md` — 读 DEC-0084 和 DEC-0085

## 你的任务

TASK-0012：界面提升。把 CRM 从"功能验证页"变成"可用的商业级界面"。

**目标**：产品负责人反馈当前界面像半成品——仪表盘是空壳，机构列表/详情页粗糙，功能入口不明显。你要一次性把所有 5 步做完。

## 重要约束

1. **不改变业务行为**：不改策略层（`src/crm/policy/`）、不改领域模型（`src/crm/domain/`）、不改持久层（`src/crm/persistence/`）、不改 API 端点的业务逻辑。
2. **不改字段可见规则**：SPEC-0001 R-030 要求页面和 API 执行同一字段级可见规则。你只改呈现方式，不改哪些字段可见。
3. **不加新 API 端点**：现有 `/api/institutions` 已支持 `q`（搜索）、`page`、`limit`（分页）。页面只需要用起来。
4. **不用 JavaScript 框架**：服务端渲染 Jinja2 + 原生 JS + CSS，与 ADR-0002 一致。
5. **不引外部 CDN**：自包含，CSS/JS 放 `static/` 目录。
6. **不改数据库**：无迁移、无 schema 变更。
7. **不部署**：部署是单独的门，你做完后协调器验收再部署。
8. **CSRF 令牌**：每个表单必须保留 `csrf_token` 隐藏字段。
9. **不碰 `crm_test`/服务器**：除非有单独的 DEC 授权。

## 5 步全做（一次性完成）

### 第 1 步：共享布局 + 仪表盘

1. 创建 `templates/base.html`：
   - 统一导航栏：左侧 logo+标题，中间导航链接（仪表盘、机构列表），右侧用户信息+退出登录
   - `{% block content %}` 内容区
   - 统一 CSS（可内联或放 `static/css/style.css`）
   - 退出登录的 JS 逻辑（POST + CSRF token）保留现有实现

2. 重做 `templates/dashboard.html`（继承 `base.html`）：
   - 统计卡片加载真实数据：从 `/api/institutions` API 获取总数；"本月跟进"可从机构详情或简单统计获取（如果无法从现有 API 算出就改为"机构总数"或"我的机构"）
   - 快捷操作按钮：新建机构、搜索机构
   - "最近机构"列表：从 `/api/institutions` 取前 5 条，可点击跳转详情
   - 不要用 `--` 占位符

### 第 2 步：机构列表页

重做 `templates/institutions_list.html`（继承 `base.html`）：
- 顶部搜索栏：`<form method="get" action="/institutions"><input name="q" ...><button>搜索</button></form>`
- 分页控件：上一页/下一页，显示当前页/总页数
- 表格：名称（可点击跳详情）、类别、地区、来源分类、精简进度（如果有）
- "新建机构"按钮放在显眼位置
- 空状态提示："暂无可见机构记录，点击新建机构添加"

### 第 3 步：机构详情页

重做 `templates/institution_detail.html`（继承 `base.html`）：
- 卡片式布局，分区块：基本信息、联系人、跟进历史
- 跟进历史按时间线倒序展示（后端已返回 `occurred_at DESC`）
- 每条跟进显示：时间、沟通方式大类、事实正文、共享摘要、下一步行动（如有）
- 联系人卡片：姓名、身份/角色、职位、可用联系渠道
- 操作按钮：添加联系人、添加跟进
- 管理员角色可见"管理员例外查看"入口（带原因输入框，跳 `?administrator_reason=xxx`）

### 第 4 步：表单页面

统一润色 `institution_create.html`、`contact_create.html`、`followup_create.html`（都继承 `base.html`）：
- 统一样式
- 更好的表单分组和标签提示
- `followup_create.html` 的"下一步负责人 UUID"字段加提示说明它是可选的
- 错误状态清晰高亮
- 提交成功后跳转详情页（现有逻辑保留）
- 润色 `login.html`（小幅调整即可，已经还行）

### 第 5 步：页面路由接线 + 全量回归

1. 修改 `src/crm/web/main.py` 的 `/institutions` 页面路由：
   - 接受 `q`（搜索词）和 `page`（页码）查询参数
   - 传给 `query_service.find_institutions(search_terms=q, limit=20, offset=(page-1)*20)`
   - 把 `q`、`page`、`total_pages` 传给模板上下文

2. 运行全量本地测试：
   ```
   powershell -ExecutionPolicy Bypass -File scripts\dev-test.ps1
   ```
   确保 `0 failed`。预期 `183 passed, 28 skipped` 或更多（如果你加了测试）。

3. 运行治理检查：
   ```
   powershell -ExecutionPolicy Bypass -File scripts\check-governance.ps1
   ```
   确保 `[PASS]`。

4. 写验收证据文件 `docs/evidence/TASK-0012-ACCEPTANCE.md`：
   - Status
   - 改了哪些文件
   - 测试结果（粘贴 pytest 输出）
   - 治理检查结果
   - 每步的完成确认

## 验证要求

- 每步做完后，先运行 `scripts\dev-test.ps1` 确保测试不挂
- 最后一步做全量回归
- 不要跳过任何测试
- 如果某个模板引用了策略投影里没有的字段，不要往投影里加字段——只用已有的

## 完成后

写完所有 5 步后，回报：
1. 改了哪些文件（列清单）
2. 测试结果（pytest 总数）
3. 治理检查结果
4. 有没有遇到问题或需要协调器决策的地方

**不要自作主张部署到服务器。部署是协调器的活，需要单独授权。**
