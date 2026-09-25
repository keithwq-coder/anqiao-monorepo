# SPEC — 中科安樵经销商赋能培训系统（wiki）

> 本文件是**唯一业务与技术权威**。实施提示词、代码、验证与它冲突时，以本文件为准，并停下来报告冲突。
> 本项目是对旧静态站（`经销商赋能培训体系`，曾部署于 `jk.aibrain.wiki`）的**重构**，验证过真实需求。现作为整合项目的一员，与 `WEB`（官网）、`crm` 同机部署在腾讯云轻量应用服务器。

---

## §0 一句话定义

登录后的**内部**培训与认证系统：7 类角色按权限矩阵学习 16 个模块、做单选测验，系统记录学习/成绩、按角色计算「认证状态」，并对内网暴露一个**只读**认证状态接口供 CRM 以后调用。

---

## §1 范围（v1 做什么 / 不做什么）

### 1.1 v1 必做
1. 账号登录、服务端会话、首次登录强制改密、自助改密与实名资料维护。
2. 角色×模块权限矩阵（`req`/`opt`/`na`）驱动的模块可见性与访问控制。
3. 课件浏览：从**结构化数据**渲染（不搬旧 HTML），套统一设计系统。
4. 在线测验：按角色决定是否需考；服务端判分；记录每次 attempt 与最高分。
5. 学习记录与认证状态计算（及格线 80%、不限重考）。
6. 管理员后台：学员列表、单人明细、统计概览、报表导出（CSV/JSON）、**新建经销商账号**。
7. 只读认证接口 `GET /api/internal/certification`（内网 token 鉴权），供 CRM 只读。
8. 基本技术措施：全站鉴权、密码哈希、会话 cookie、登录限速、HTTPS（见 §2）。

### 1.2 v1 范围外（二期）
- AI 工具（锦囊妙计 / AI 话术助手 / 每日简报）为二期；本期仅在导航留「敬请期待」占位，`/api/ai/` 仅 README。
- 课件与题库为版本化种子数据（`seed/`），改内容直接改文件。CMS 为二期。
- 本期登录方式：username（微信/SSO/手机号为二期，见 B6）。
- CRM 与培训库零耦合：仅一个只读 HTTP 接口（§6.3），CRM 不写培训库。
- 证书 PDF 为二期（见 B1），本期仅显示认证状态。
- 多语言、C 端购买流程为二期。

---

## §2 技术栈与部署（与 WEB 同营）

| 项 | 选择 |
|---|---|
| 框架 | Next.js（App Router）+ TypeScript + Tailwind CSS v4，与 `WEB` 一致 |
| 运行时 | Node 24.x（开发机实测 v24.13.1 / npm 11.13.0） |
| 数据库 | PostgreSQL；**独立 database `anqiao_training` + 专属 role `anqiao_training_app`**；与 CRM 的 `anqiao_crm` **零交叉** |
| 数据访问 | 原生 SQL + `pg`（node-postgres） |
| 迁移 | 纯 `.sql` 文件 + 一个 `scripts/migrate.mjs` 顺序执行器，`schema_migrations` 表记录版本 |
| 密码哈希 | argon2id，用 `@node-rs/argon2`（预编译二进制，免 node-gyp 编译） |
| 会话 | **DB 后端会话**：`sessions` 表 + uuid cookie（HttpOnly/Secure/SameSite=Lax） |
| 校验 | **手写校验**（必填、长度上限、类型、白名单） |
| 部署 | Next `standalone` 产物由 node 直接运行，nginx 反代 `wiki.aibrain.wiki` → `127.0.0.1:2929` |
| 生产数据库连接 | 服务进程经 `DATABASE_URL` 连**服务器原生 Postgres**（同一实例、`anqiao_training` 库） |
| 本地开发数据库 | 用服务器 Postgres（SSH 隧道 + `DATABASE_URL` 指定）；|

### 2.1 依赖锁定（超出即返工）
- 生产依赖仅允许：`next`、`react`、`react-dom`、`pg`、`@node-rs/argon2`。
- devDependencies 仅允许：create-next-app 默认项 + `tsx`（跑 `.mjs`/`.ts` 脚本与自检）。
- 以上清单外的依赖（含 ORM、zod、UI 组件库、图标库、动画库、`next/font/google`）不得引入；字体用系统字体栈。

### 2.2 端口与域名
- 本服务进程监听 `127.0.0.1:2929`（WEB 是 2828，CRM 另在其位，勿冲突）。
- 域名 `wiki.aibrain.wiki`（旧域名 `jk.aibrain.wiki` 已废弃），nginx `location /` 反代到 2929。
- 全站 `X-Robots-Tag: noindex, nofollow`。
- 登录限速：同 IP 60 秒内失败 ≥5 次拒绝 10 分钟（env 可调）。

---

## §3 角色与权限矩阵（种子事实）

7 个角色（`seed/auth.json` → `roles`）：`admin`、`internal_sales`、`internal_tech`、`internal_ops`、`dealer`、`agent`、`reseller`。

- **模块访问**取自 `seed/auth.json` → `module_access`，值域 `req`（必修）/`opt`（选修）/`na`（不可见）。
- **测验是否需考**取自 `seed/auth.json` → `quiz_roles`（布尔）。
- `admin` 角色 `sees_all=true`：可见全部模块与后台；`admin` 本人不计入认证统计口径（管理者视角）。
- 权限矩阵**只从种子导入**，不得手改数值。矩阵原样见 `seed/auth.json`，实施时导入 `module_access`、`module_quiz_required` 两张表。

---

## §4 内容（课件 + 题库，种子数据驱动）

### 4.1 课件
- 源：`seed/courseware.json`，16 个模块（M01…M16），每模块含 `id/title/layer/duration/slides[]`。
- `slides[].type` 至少包含：`highlight`、`points`、`table`、`twocol`（渲染器需覆盖全部出现过的 type；实施前先扫描该文件枚举所有 type，缺一不可，遇未知 type 停下报告）。
- 课件正文**不入库**，作为版本化文件 `src/content/courseware.json`（从 `seed/` 拷入），运行时在服务端读取、以 RSC 渲染。
- 模块元数据（`id`、`title`、`layer`、顺序）入 `modules` 表，供权限与状态计算。

### 4.2 题库
- 源：`seed/quizzes.json`，16 模块，每模块 3–5 道单选，结构 `{q, opts[4], ans:'A'|'B'|'C'|'D'}`。
- **题目总数 = 源文件题数之和（当前 63 题）**，导入后须断言一致。
- 全部入 `quiz_questions` 表。**`answer` 字段绝不随取题接口下发到客户端**（判分只在服务端）。

---

## §5 数据模型（PostgreSQL，权威 schema）

> 命名用 snake_case。所有时间戳 `timestamptz`。以下为字段意图，实施时写成 `.sql` 迁移。

```
schema_migrations(version text primary key, applied_at timestamptz default now())

users(
 id serial primary key,
 username text unique not null,
 password_hash text not null, -- argon2id
 role text not null, -- 7 个角色之一
 name text not null, -- 显示名
 realname text not null default '',
 idcard text not null default '', -- 仅 admin 可见、脱敏展示（见 B5）
 phone text not null default '',
 must_change_password boolean not null default true,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 last_active_at timestamptz
)

modules(
 id text primary key, -- M01..M16
 title text not null,
 layer text,
 ordinal int not null -- 展示顺序
)

module_access(
 module_id text not null references modules(id),
 role text not null,
 access text not null, -- 'req' | 'opt' | 'na'
 primary key(module_id, role)
)

module_quiz_required(
 module_id text not null references modules(id),
 role text not null,
 required boolean not null, -- 取自 quiz_roles
 primary key(module_id, role)
)

quiz_questions(
 id serial primary key,
 module_id text not null references modules(id),
 ordinal int not null,
 question text not null,
 options jsonb not null, -- ["A文本","B文本","C文本","D文本"]
 answer text not null -- 'A'|'B'|'C'|'D'；绝不下发客户端
)

course_views(
 user_id int not null references users(id),
 module_id text not null references modules(id),
 first_viewed_at timestamptz not null default now(),
 last_viewed_at timestamptz not null default now(),
 primary key(user_id, module_id)
)

quiz_attempts(
 id serial primary key,
 user_id int not null references users(id),
 module_id text not null references modules(id),
 score int not null, -- 0..100
 passed boolean not null, -- score >= 80
 answers jsonb, -- 记录本次作答（可选）
 created_at timestamptz not null default now()
)

sessions(
 id uuid primary key default gen_random_uuid(), -- 需 pgcrypto，或 app 侧生成 uuid
 user_id int not null references users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 ip text
)

login_attempts( -- 登录限速用（也可进程内计数，见 §2.2）
 ip text, username text, created_at timestamptz default now()
)
```

---

## §6 学习档案与 CRM 契约（三组差异化）

> 用户拍板（docs/cert-design.md）：内部员工考试为**碎片化学习+测试档案**，非一次性职业认证；分数不设硬性门槛，仅作参考（含入职评估）。

### 6.1 及格与重考
- 单次测验 `passed = score >= 80`。
- **不限重考次数**；每次 attempt 入库；模块最高分/是否通过由 `quiz_attempts` 汇总。
- 分数**不构成硬性认证门槛**（仅为档案记录与参考）。

### 6.2 三组差异化
| 组 | 角色 | 记录 | 门槛 |
|---|---|---|---|
| 管理组 | `admin` | 不归档为考核（个人浏览） | 无 |
| 内部员工组 | `internal_sales/internal_tech/internal_ops` | 全记录（浏览/学完/测验分数） | 无硬性门槛；档案供入职/成长参考 |
| 外部渠道组 | `dealer/agent/reseller` | 全记录（浏览/学完/测验分数） | 无认证；仅参考 |

**学习档案（LearningProfile）字段**：`visibleModules`（可见模块）、`viewedModules`（在 course_views 出现过）、`completedModules`（`has_completed=true`，课件滚动到底标记）、`participationRate`（viewed/visible）、`completionRate`（completed/visible）、`quizBestScores`（各模块最高分）、`quizAttemptCount`、`quizPassedModules`（存在 passed 的模块）、`totalAttempts`、`avgScore`、`lastActiveAt`。

- 模块可见性仍按权限矩阵：`na` 模块对该角色不可见、不可做；`req`/`opt` 仅影响模块徽标（必修/选修），不构成认证门槛。

### 6.3 只读接口（供 CRM）
```
GET /api/internal/certification?username=<u> # 单人（非 admin）
GET /api/internal/certification            # 全部非 admin（内部档案 + 外部参考）
Header: X-Internal-Token: <INTERNAL_API_TOKEN>   # 缺失/不符 → 403
```
返回（单人示例）：
```json
{
  "username": "dl_0001",
  "name": "经销商0001",
  "role": "dealer",
  "tier": "external",
  "viewedModules": ["M02"],
  "completedModules": [],
  "participationRate": 0.1,
  "completionRate": 0,
  "quizBestScores": {"M02": 100},
  "quizAttemptCount": {"M02": 1},
  "quizPassedModules": ["M02"],
  "totalAttempts": 1,
  "avgScore": 100,
  "lastActiveAt": "2026-08-09T12:00:00Z"
}
```
- 该接口**只读**，不接受写；不做跨库联表；CRM 侧后续自行缓存/落库，**不反向写培训库**。
- 该接口不得被搜索引擎索引、不得公网匿名可达（nginx 仅允许内网/带 token）。

### 6.4 选修模块的测验 = 练习
- `access='opt'` 模块的测验不计入任何门槛（本就无门槛）；仍可做、仍判分、仍入 `quiz_attempts`。
- UI 上这类测验标注为"练习"；`na` 模块对该角色不可见、不可做。

---

## §7 页面与路由

| 路由 | 角色 | 说明 |
|---|---|---|
| `/login` | 公开 | 用户名+密码登录；限速；错误信息不区分"用户不存在/密码错" |
| `/` 仪表盘 | 登录 | 按角色过滤的模块卡片（req/opt 徽标、`na` 不显示）；每模块状态（未学/已学/测验已过）；顶部认证状态横幅（已认证/进行中 + 缺口） |
| `/m/[id]` 课件 | 登录 + 该模块非 `na` | 数据驱动渲染 slides；打开即记录 `course_views`（首访写 first，之后更新 last） |
| `/m/[id]/quiz` 测验 | 登录 + 该模块对该角色非 `na`（`req`→必考、计认证；`opt`→练习、不计认证，见 §6.4） | 取题不含答案；提交服务端判分→存 attempt→返回分数与错题位置 |
| `/account` | 登录 | 改密（首登强制）、实名/身份证/手机资料维护 |
| `/admin` | admin | 学员列表、单人明细、统计概览、CSV/JSON 导出、**新建经销商账号** |
| `/api/internal/certification` | token | §6.3 只读接口 |
| `/api/ai/*` | — | **仅占位 README，无实现**（二期） |

---

## §8 账号迁移（种子策略）

- **导入**：`seed/auth.json` 中 `role != 'dealer'` 的 **14 个账号**（1 `admin` + 3 内部 `sales01/tech01/ops01` + 10 实名管理 `wj/wq/gj/zqt/yq/zq/kj/dhg/gsy/zjj`）。
- **丢弃**：99 个 `dl_00xx` 占位假账号，**不导入**。
- 所有导入账号：`must_change_password=true`，临时密码见 B3（默认 `AnQiao@2026`，argon2 哈希后入库）。
- 真实经销商由 admin 在 `/admin` 逐个新建（用户名规则、初始密码由建号流程生成并展示一次）。
- `realname/idcard/phone` 种子为空，登录后自助补。

---

## §9 交付标准（Task 末尾逐条真跑验收，禁止"预计通过"）

1. `npm install && npm run build` 通过、无 TypeScript 错误；`npm run dev` 无报错启动。
2. `scripts/migrate.mjs` 建全部表；`scripts/seed.mjs` 导入后断言：`users`=14 且其中 `dealer`=0；`modules`=16；`quiz_questions`=63（或=源文件题数之和）；`module_access`/`module_quiz_required` 行数与源矩阵一致。
3. 登录流：正确凭据得会话；错误被拒并在阈值后限速；首登被强制改密后方可进其它页。
4. 访问控制：未登录访问任一非 `/login` 路由（含课件、取题接口、后台、内部接口）→ 302/403；某角色打开其 `na` 模块 → 拒绝。
5. 取题接口响应**不含 `answer`**（贴 curl/JSON 证明）；提交后服务端判分、attempt 入库、`>=80` 记 `passed`。
6. 认证（口径 B）：脚本造一个用户看全其角色**必修模块** + 过这些**必修模块的测验** → 状态翻 `certified`；并断言**只做选修模块测验不改变认证、不进 `requiredMissing`**；`/api/internal/certification` 返回结构正确；缺 token → 403。
7. 安全：所有页面响应头含 `X-Robots-Tag: noindex`；`robots.txt` Disallow；会话 cookie 具 `HttpOnly/Secure/SameSite`；日志中无价格/密码/答案。
8. 后台：学员列表显示 14 个种子用户；新建经销商账号可用；CSV 导出可下载且字段正确。
9. 依赖未被污染（§2.1）；`/api/ai/` 仅 README 无 `route.ts`。
10. 交付物：可运行项目 + `README.md`（含"⚠️ 部署前必办：TLS、DATABASE_URL、INTERNAL_API_TOKEN、临时密码分发"）+ `VERIFY.md`（§9 逐条结论，**贴真实命令输出**）。

---

## §10 阻塞点：待业主确认（B 清单，一律占位，不得自行拍板）

- **B1 证书**：结业是否发证书（PDF/编号）？默认**不发**，仅显示认证状态。
- **B2 选修但需考**：已定（业主决策，口径 B）。`access=opt` 的模块测验**不计入认证**，仅作练习（§6.2 / §6.4）。认证只看 `access=req` 模块及其测验。
- **B3 临时密码**：种子账号统一临时密码，默认 `AnQiao@2026`，首登强制改。
- **B4 会话有效期**：默认 **7 天**。
- **B5 身份证存储**：默认存明文、仅 admin 脱敏可见、不加密（加密列二期）。若有合规要求请指定。
- **B6 登录标识**：本期用 **username 登录**（与种子一致）；手机号登录列二期。
- **B7 内部接口消费方**：CRM 何时接、以何频率拉取，属 CRM 侧决策，本期仅提供接口与 token。
