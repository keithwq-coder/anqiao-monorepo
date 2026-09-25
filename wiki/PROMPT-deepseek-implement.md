# 粘贴给 DeepSeek / GLM 的实施提示词

> 使用说明（给你自己看，不要粘贴这一段）：> 下面 `====` 分隔线之间的全部内容，整段复制粘贴给 DeepSeek 或 GLM，开新窗口用。
> 业务与技术权威依据是同目录的 `SPEC.md`；种子数据在 `seed/`。本提示词不重复 SPEC 全文，实施者必须先读 SPEC。

====

你是一名资深 Next.js 全栈工程师，为「中科安樵（苏州）科技有限公司」重构**内部经销商赋能培训系统**。这是对旧静态站的重构，需求已验证；现与官网、CRM 同机部署在腾讯云轻量应用服务器。

## 工作目录

`D:\Project\中科安樵\wiki`（Windows / Git Bash）。该目录**不是 git 仓库**，全程不要执行任何 git 命令（不 `git init`、不 `git add`、不 `git commit`）。**严禁使用域名 `jk.aibrain.wiki`**（灾难遗留），本项目域名是 `wiki.aibrain.wiki`。

## 依据文件（先按顺序完整读完，再动手）

1. **`SPEC.md`** —— 唯一业务与技术权威。§1 范围、§5 数据模型、§6 认证与 CRM 契约、§2 技术栈、§9 验收、§10 阻塞点。**与本提示词冲突时以 SPEC.md 为准，并停下来告诉我冲突在哪。**
2. **`seed/auth.json`** —— 7 角色、`module_access`（req/opt/na）、`quiz_roles`（是否需考）、账号。**权限矩阵只从这里导入，不得手改数值。**
3. **`seed/courseware.json`** —— 16 个模块课件（结构化 slides）。
4. **`seed/quizzes.json`** —— 16 模块题库，单选，含 `answer`。

## 你要交付的东西

一个可运行的 Next.js 全栈项目，实现 SPEC §7 的页面与 §1.1 的功能，满足 §9 全部验收；外加 `README.md` 与 `VERIFY.md`。

## 执行方式

- **先做一份实施计划**：把工作拆成有序任务（脚手架 → 数据库迁移 → 种子导入 → 鉴权/会话 → 权限中间件 → 课件渲染 → 测验 → 记录与认证计算 → 内部接口 → 后台 → 安全加固 → 验收），每个任务末尾写**真实可跑的验证命令与预期输出**。计划写到 `docs/plan.md`，每步 `- [ ]`，做完改 `- [x]`。
- **按任务顺序逐个做完**，每个任务末尾的验证命令**必须真跑**，输出与预期一致才算过。不一致就修到一致，不要跳过、不要只声称通过。
- 遇到 SPEC §10 的阻塞点（B1–B7）或任何 SPEC 未覆盖的决策点，**按 SPEC 给的默认值处理并在计划里标注**，不要自创业务规则；若默认值也无法覆盖，停下来问。

## 约束

### 1. 种子为唯一数据源
- 课件正文、题目、答案、角色权限矩阵、账号——**全部来自 `seed/`**，逐字导入，不得改写、补全、"优化"。
- 模块的 title/layer/顺序、题目的选项与答案、`module_access` 与 `quiz_roles` 的每一格，都以种子为准。
- 种子里没有的字段（如实名/身份证/手机初始为空）保持空。

### 2. 严守 v1 范围（SPEC §1.1）
- AI 工具为二期：`/api/ai/*` 仅 README，无 `route.ts`；导航留"敬请期待"占位。
- 在线出题/编课件（CMS）为二期。
- 本期登录方式：username（微信/SSO/手机号为二期）。
- 证书 PDF、多语言、C 端购买为二期。
- CRM 与培训库零耦合：仅一个只读 HTTP 接口（§6.3），CRM 不写培训库。

### 3. 依赖锁定（见 SPEC §2.1）
- 生产依赖仅允许：`next`、`react`、`react-dom`、`pg`、`@node-rs/argon2`。
- devDependencies 仅允许 create-next-app 默认项 + `tsx`。
- 以上清单外的依赖（含 ORM、zod、UI 组件库、图标库、动画库、`next/font/google`）不得引入；字体用系统字体栈。
- 数据库：原生 SQL + `pg`；迁移：`.sql` 文件 + `scripts/migrate.mjs` 顺序执行。

### 4. 技术措施
- 密码：argon2id 哈希（`@node-rs/argon2`）；`must_change_password=true` 强制改密。
- 会话：DB 后端会话，cookie `HttpOnly; Secure; SameSite=Lax`。
- 登录限速：同 IP 60 秒内失败 ≥5 次拒绝 10 分钟（env 可调）。
- 内部接口：`X-Internal-Token` 校验，token 经 env 注入。
- 全站 `X-Robots-Tag: noindex, nofollow`。
### 5. 数据库与种子
- 库名 `anqiao_training`，专属 role `anqiao_training_app`，**与 CRM 的 `anqiao_crm` 零交叉**，不连 CRM 库。
- schema 严格照 SPEC §5。种子导入后**必须断言**：`users`=14（其中 `dealer`=0）、`modules`=16、`quiz_questions`= 源文件题数之和（当前 63）、`module_access`/`module_quiz_required` 行数与源矩阵一致。断言不过就是没做完。
- **只导入 `seed/auth.json` 里 `role != 'dealer'` 的 14 个账号**；99 个 `dl_00xx` 占位账号**丢弃不导**。导入账号一律 `must_change_password=true`、临时密码 `AnQiao@2026`（argon2 哈希入库）。

### 6. 认证状态计算（SPEC §6，整合的心脏，务必按公式实现）—— 口径 B
- 单测验 `passed = score >= 80`；不限重考，每次 attempt 入库；模块"通过"= 存在任一 `passed=true`。
- **口径 B（选修就是真选修）**：角色认证 = 该角色所有 `access='req'` 模块都被浏览 **且** 这些 `req` 模块中 `quiz_roles=true` 的测验都通过 → `certified`，否则 `in_progress`。
- **选修模块(`access='opt'`)的测验不计入认证**，即使 `quiz_roles=true`：仍可做、仍判分、仍入 `quiz_attempts`，但不进 `requiredMissing.quizzes`、不影响 `certified`/`completionRate`。UI 标"练习"，必修测验标"必考"（SPEC §6.4）。
- 种子事实核对：各角色 `|required_modules| == |required_quizzes|`（sales 10、tech 5、ops 4、dealer 10、agent 10、reseller 7）。实现后跑一次断言。
- `/api/internal/certification` 只读、`X-Internal-Token` 鉴权、缺 token → 403、不跨库、不接受写。返回结构照 SPEC §6.3。

## 环境事实（已实测，不要重新假设）

- Node **v24.13.1** / npm **11.13.0**。
- `create-next-app@latest` 当前是 **Next 16 + React 19**。因此：- `params` 与 `searchParams` 是 **Promise**，页面/route 里必须 `await`；
 - `headers()`、`cookies()` 是 **async**，必须 `await`；
 - Turbopack 是默认，不需要 `--turbopack` 标志。
- **`create-next-app` 拒绝非空目录**（本目录已有 `SPEC.md`、`seed/` 等）。可行做法：先生成到子目录（名不能以点开头）再把内容移出来。
- **`"use server"` 文件里不能导出非 async 的值**（类型、常量、选项数组会导致 build 报错）。类型/常量放普通模块（如 `src/lib/*.ts`），Server Action 文件只导出 `async function`。
- 本机有 `ALL_PROXY=http://127.0.0.1:7897`，`curl` 打本地 dev server 会 502。本地冒烟一律写成：```bash
 curl -sS --noproxy '*' http://127.0.0.1:3000/login
 ```
- `npx tsx -e "..."` 带 import 会静默无输出。要自检就写成临时 `.ts`/`.mjs` 文件再 `npx --yes tsx ./check-tmp.mjs`，跑完 `rm`。
- Shell 是 Git Bash。grep 中文模式需加 `LC_ALL=C.UTF-8`。
- 需要一个可用的 PostgreSQL 做开发：用**服务器原生 Postgres**（本机经 SSH 隧道 `ssh -N -L 15432:127.0.0.1:5432 bri-server`，`DATABASE_URL` 指向 `127.0.0.1:15432`）。**不要连 CRM 的库。**

## 已知坑（提前规避）

1. `sessions.id` 用 `gen_random_uuid()` 需 `pgcrypto` 扩展（`create extension if not exists pgcrypto`），否则在 app 侧用 `crypto.randomUUID()` 生成再插入。
2. `@node-rs/argon2` 是预编译二进制，能避开 node-gyp；若某平台无预编译包，改用 `argon2`（直接装预编译包）。二选一，别两个都装。
3. middleware 要覆盖**所有**受保护路由，注意 `matcher` 别漏掉 `/m/:path*`、`/admin/:path*`、`/api/internal/:path*`；`/login`、`robots.txt`、Next 静态资源要放行。
4. RSC 里读课件 JSON 用 `import` 或 `fs` 读服务端文件；不要把 `courseware.json` 放进 `public/`。
5. 取题接口务必在服务端 `delete` 掉每题的 `answer` 再返回；判分用服务端保存的 `answer`。验收会 grep 响应体证明无 `answer`。

## 交付标准（逐条验收，SPEC §9；VERIFY.md 必须贴真实命令输出，禁止"预计通过"）

1. `npm install && npm run build` 通过、无 TS 错误；`npm run dev` 无报错启动。
2. `scripts/migrate.mjs` 建全部表；`scripts/seed.mjs` 导入并**打印断言结果**：users=14 且 dealer=0、modules=16、quiz_questions=63、矩阵行数一致。
3. 登录：正确得会话；错误被拒并在阈值后限速；首登强制改密后方可进其它页。
4. 访问控制：未登录访问任一非 `/login` 路由（含 `/m/*`、`/m/*/quiz`、`/admin`、`/api/internal/*`）→ 302/403；某角色打开其 `na` 模块 → 拒绝。（贴 curl 输出）
5. 取题接口响应**不含 `answer`**（贴 JSON）；提交后服务端判分、attempt 入库、`>=80` 记 `passed`。
6. 认证（口径 B）：脚本造一个用户看全其角色**必修模块** + 过这些**必修模块的测验** → 状态翻 `certified`；再断言**只做选修模块测验不改变认证状态、不进 `requiredMissing`**；`GET /api/internal/certification?username=...` 返回结构正确；缺 `X-Internal-Token` → 403。（贴输出）
7. 安全：任取几个页面响应头含 `X-Robots-Tag: noindex`；`robots.txt` Disallow；会话 cookie 具 `HttpOnly/Secure/SameSite`；grep 日志无价格/密码/答案。
8. 后台：`/admin` 列出 14 个种子用户；新建经销商账号可用；CSV 导出可下载、字段正确。
9. 依赖未污染（只 `next/react/react-dom/pg/@node-rs/argon2` + 允许的 dev 依赖）；`src/app/api/ai/` 仅 README 无 `route.ts`。
10. 交付物：可运行项目 + `README.md`（含"⚠️ 部署前必办：nginx TLS、`DATABASE_URL`、`INTERNAL_API_TOKEN`、临时密码 `AnQiao@2026` 分发与首登改密")+ `VERIFY.md`（§9 逐条结论，贴真实命令输出）+ `docs/plan.md`（勾选完成）。
11. 部署配置：Next `standalone` 产物由 node 直接运行（监听 `127.0.0.1:2929`，经 `DATABASE_URL` 连服务器 Postgres）+ `deploy/nginx.conf`（反代 `wiki.aibrain.wiki` → 2929，强制 HTTPS，`/api/internal/` 限来源）。

开始前，如果 `SPEC.md` 或 `seed/` 有任何你认为矛盾或无法执行的地方，先提出来再动手。做完先给 `docs/plan.md` 让我过目，再执行。

====
