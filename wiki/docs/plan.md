# 实施计划 — 中科安樵经销商赋能培训系统（wiki）

> 依据：SPEC.md（唯一权威）+ seed/auth.json + seed/courseware.json + seed/quizzes.json + 用户拍板决策。
> 目录：`D:\Project\中科安樵\wiki`（非 git 仓库，全程不执行任何 git 命令）。
> 域名：`wiki.aibrain.wiki`（严禁 jk）。

## 0. 决策记录（用户拍板 / SPEC 默认，冲突处已确认）

| # | 决策点 | 结论 | 来源 |
|---|---|---|---|
| D1 | 10 个实名账号（wj/wq/gj/zqt/yq/zq/kj/dhg/gsy/zjj）角色 | **降级为 `internal_sales`**（用户："wiki 给涉及销售的人员使用"；未逐个指定，取最贴合其意图的角色） | 用户拍板，本计划待确认 |
| D2 | 99 个 dl_00xx 占位 | **全部导入为真实 `dealer` 账号**（与提示词铁律/SPEC §9 冲突，用户两次确认导入）。风险：这 99 个占位账号均可登录（首登强制改密 AnQiao@2026） | 用户拍板 |
| D3 | 新建账号规则 | admin 在 /admin 新建，角色可选 `dealer/agent/reseller`（dl_ 前缀）或 `internal_sales`（sa_ 前缀）；用户名 `dl_XXXX`/`sa_XXXX` 4 位数字自动递增；随机初始密码（10 位）展示一次；must_change_password=true。**用户名生成后不可改**（admin 也不可改） | 用户拍板 |
| D4 | dl 编号起点 | 99 个占位已占满 0001–0099 → **新建 dl 从 `dl_0100` 递增**；sa 从 `sa0001` 递增 | 由 D2 推导 |
| D5 | admin 做测验 | 可以，作为"练习"，判分入库但不计认证（sees_all） | 用户拍板 |
| D6 | CSV 导出字段 | username,name,role,realname,phone,idcard(脱敏),status,completionRate,viewedModules,passedModules,lastActiveAt | 用户授权按实际调整 |
| D7 | slides type | 枚举 6 种：highlight(17)/points(32)/table(13)/twocol(6)/tip(14)/point(1)，渲染器全覆盖 | 事实扫描 |
| D13 | 昵称登录 | username 不可改；users 表新增 `nickname` 列（text，唯一，可空）。终端用户在 /account 可设置/修改自己的昵称，**登录时支持 username 或 nickname 二选一**。昵称格式校验（1–20 字符、字母/数字/中文/下划线），不得与任何 username 重复 | 用户拍板（对 SPEC §5/§9 的扩展） |
| D8 | 内部接口鉴权 | `/api/internal/certification` 仅 X-Internal-Token 鉴权（不要求会话 cookie，CRM 无浏览器会话），缺 token→403 | SPEC §6.3 |
| D9 | 会话校验位置 | middleware 仅做"无 cookie 即拦截"（Edge 无法连 pg）；DB 会话校验放服务端 RSC/API 层（withAuth helper） | 技术现实 |
| D10 | cookie Secure | 默认 `Secure; HttpOnly; SameSite=Lax` 恒定；提供 `COOKIE_SECURE=false` env 供本地 http 开发（curl 验收仍验证默认带 Secure） | SPEC §7.6 |
| D11 | 登录限速 | 进程内计数：同 IP 60 秒内失败 ≥5 次 → 拒绝 10 分钟（阈值/时长 env 可配）；login_attempts 表仍建 | SPEC §7.7 |
| D12 | 开发数据库 | 直接连服务器原生 Postgres（SSH 隧道 15432→5432，库 anqiao_training，专属 role anqiao_training_app） | 用户拍板 + 环境实测 |

## 1. 数据库断言基准（种子事实）

- users = **113**（1 admin + 10 实名 internal_sales + sales01/tech01/ops01 + 99 dealer），dealer = **99**；users 表含 `nickname` 列（种子用户默认空）
- modules = 16（M01–M16）
- quiz_questions = **63**
- module_access = 96 行（16 × 6 角色，无 admin 行）；module_quiz_required = 96 行
- 矩阵事实核对（口径 B）：sales 10/10、tech 5/5、ops 4/4、dealer 10/10、agent 10/10、reseller 7/7 ✓（已脚本验证）
- 导入账号统一 must_change_password=true、临时密码 `AnQiao@2026`（argon2id 哈希入库，不使用 seed 明文密码）

## 2. 任务清单（每步末尾有真实可跑的验证命令与预期输出）

### T0 环境准备：PostgreSQL（服务器直连）
- [x] 用户拍板：直接连服务器（腾讯云轻量 124.222.212.159，PostgreSQL 16.14 原生、仅监听 127.0.0.1:5432）。
- [x] SSH 隧道：本机 `ssh -N -L 15432:127.0.0.1:5432 bri-server`（后台任务 bash-5）。
- [x] 服务器建 `anqiao_training` 库 + 专属 role `anqiao_training_app`（随机密码，存 .pgpass_training + .env.local，不回显）。
- 验证：`node --env-file=.env.local -e ...` → `CONNECT OK: anqiao_training | anqiao_training_app`（已跑过）

### T1 脚手架
- [x] `create-next-app` 生成到子目录（非空目录限制），再移内容到根目录；装 `pg` `@node-rs/argon2`，devDep 加 `tsx`；`.env.local` 配 DATABASE_URL/INTERNAL_API_TOKEN/SESSION_TTL_SECONDS。
- 注意：npm 前先 `unset ALL_PROXY HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`（本机 clash 未运行时 7897 会劫持）。
- 验证：`npm ls next react react-dom pg @node-rs/argon2` 输出正确版本；`npm run build` 通过。（已跑过）

### T2 数据库迁移
- [x] `migrations/001_init.sql`（按 SPEC §5 全部表 + **users 表加 `nickname text unique` 列**（D13）+ pgcrypto 扩展 + role 授权）；`scripts/migrate.mjs` 顺序执行并记 schema_migrations。
- 验证：`node --env-file=.env.local scripts/migrate.mjs` → `applied 001_init.sql`；再跑 → `no pending migrations`；服务器 psql 列 10 张表。（已跑过）

### T3 种子导入
- [x] `scripts/seed.mjs`：读三个 seed 文件；导入 modules、module_access、module_quiz_required、quiz_questions(63)、113 个账号（argon2 哈希 AnQiao@2026、must_change_password=true）；打印断言。
- 验证：脚本输出 `ASSERT OK`，users=113、dealers=99、admins=1、modules=16、quiz=63、矩阵 96/96、6 角色事实核对全过。（已跑过）

### T4 数据访问层 + 密码/会话库
- [x] `src/lib/db.ts`（pg Pool）、`src/lib/env.ts`、`src/lib/password.ts`（argon2id）、`src/lib/session.ts`（crypto.randomUUID 生成 session id、cookie 读写、DB 会话校验）、`src/lib/auth.ts`、`src/lib/rate-limit.ts`、`src/lib/validation.ts`、`src/lib/types.ts`。
- 验证：argon2 hash+verify 自检已跑通；DB 连接自检 `CONNECT OK: anqiao_training | anqiao_training_app`（已跑过）。

### T5 登录 / 登出 / 改密 / 限速
- [x] `POST /api/auth/login`（**WHERE username=$1 OR nickname=$1**，错误信息不区分用户不存在/密码错；限速；成功写 sessions + 设 cookie）、`POST /api/auth/logout`、`POST /api/account/change-password`（首登强制）、`src/lib/rate-limit.ts`（进程内）。
- 验证：- `curl -sS --noproxy '*' -c jar -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"sales01","password":"AnQiao@2026"}'` → `{"ok":true,...}` 且 Set-Cookie 含 `HttpOnly; Secure; SameSite=Lax`
 - 连续 5 次错密码后第 6 次 → 429 限速
 - 改密后旧密码登录被拒、新密码可登录

### T6 权限中间件 + 安全头
- [x] `src/middleware.ts`：matcher 覆盖 `/`、`/m/:path*`、`/account`、`/admin/:path*`、`/api/:path*`；放行 `/login`、`/_next/*`、`robots.txt`、`favicon`、静态；无 cookie 的页面请求 → 302 `/login`，API 请求 → 401 JSON；全站响应加 `X-Robots-Tag: noindex, nofollow`。
- 验证：- `curl -sS --noproxy '*' -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:3000/m/M01` → `302 .../login`
 - `curl -sS --noproxy '*' -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/quiz/M01` → `401`
 - `curl -sS --noproxy '*' -I http://127.0.0.1:3000/login` 响应头含 `x-robots-tag: noindex, nofollow`

### T7 服务端会话校验 + 强制改密门
- [x] `src/lib/auth.ts`（requireUser 供 RSC/API 用，DB 校验会话；must_change_password=true 时除 /account 与登出外一律跳 /account）。
- [x] `/account` 增加**昵称设置/修改**（D13）：POST /api/account/nickname；校验格式 + 唯一（不得撞任何 username）；改后可用昵称登录。
- 验证：登录后带 cookie 访问 `/` → 200；`admin` 账号（首登必须改密）带 cookie 访问 `/m/M01` → 302 `/account`。

### T8 课件渲染 + 浏览记录
- [x] `src/content/courseware.json`（从 seed 拷入，不入库）；`/m/[id]` RSC 渲染 6 种 slide type（highlight/points/table/twocol/tip/point）；打开记录 course_views（首访 first、后续 last）；na 模块 → 拒绝（403 页或重定向）。
- 验证：登录后 `curl --noproxy '*' -b jar http://127.0.0.1:3000/m/M01` → 200 且含模块标题；`psql ... -c "select * from course_views"` 有记录；`curl` 访问 `na` 模块（如 ops01 访问 M04）→ 非 200。

### T9 测验（取题不含答案 + 服务端判分）
- [x] `GET /api/quiz/[moduleId]`（登录 + 非 na；返回题干/选项/题型元数据，**delete answer**）；`POST /api/quiz/[moduleId]/submit`（服务端判分 → 写 quiz_attempts → 返回分数与错题位置）。
- 验证：- `curl --noproxy '*' -b jar http://127.0.0.1:3000/api/quiz/M02` → JSON 中 grep `answer` 无命中
 - 提交全对 → score=100、passed=true 入库；提交错 2 题 → score 按比例、返回错题位置；opt 模块测验照常判分入库

### T10 认证状态计算（口径 B）+ 仪表盘
- [x] `src/lib/certification.ts`：required_modules / required_quizzes / viewed / passed / certified / completionRate / requiredMissing（**opt 测验不进 requiredMissing、不影响认证**）；`/` 仪表盘：模块卡片（req/opt 徽标、na 隐藏）+ 认证状态横幅。
- 验证：临时脚本对某角色用户模拟：看全必修+过必修测验 → certified；只做 opt 测验 → 状态不变、requiredMissing.quizzes 不含 opt 模块。

### T11 内部只读接口
- [x] `GET /api/internal/certification?username=`（单人）/ 无参（全部非 admin）；X-Internal-Token 校验；只读。
- 验证：带 token → 200 且 JSON 结构符合 §6.3；`curl ... -H 'X-Internal-Token: wrong'` → 403；无 token → 403。

### T12 后台 /admin
- [x] 学员列表（113 个账号）、单人明细、统计概览（按角色）、CSV 导出（GET 下载，字段见 D6）、JSON 导出、新建账号（角色可选 + 前缀自动 + 随机密码展示一次，**用户名不可改**）。仅 admin 可访问。
- 验证：登录 admin 后列表含 113 行；新建 `dl_0100`（dealer）成功 → 用展示的密码可登录且首登强制改密；CSV 响应头 `Content-Disposition: attachment` 且字段正确；非 admin 访问 /admin → 拒绝。

### T13 安全加固
- [x] `public/robots.txt` 全站 Disallow；`src/app/api/ai/README.md` 占位（无 route.ts）；cookie 属性复核；日志不打印密码/价格/答案；课件不落 public/；禁目录列举（nginx 侧）。
- 验证：`curl --noproxy '*' http://127.0.0.1:3000/robots.txt` 含 `Disallow: /`；grep 运行日志无 `AnQiao@2026`/价格数字/`"answer"`；`ls src/app/api/ai/` 仅 README.md。

### T14 部署配置
- [x] Next `standalone` 产物由 node 直接运行（监听 `127.0.0.1:2929`，经 DATABASE_URL 连服务器 PG）+ `deploy/nginx.conf`（wiki.aibrain.wiki → 2929，强制 HTTPS，`/api/internal/` 限来源 allow 127.0.0.1/deny all）。
- 验证：nginx -t 语义人工核对（本机无 nginx 可略，标注）。

### T15 文档 + 最终验收
- [x] `README.md`（含"⚠️ 部署前必办：nginx TLS、DATABASE_URL、INTERNAL_API_TOKEN、临时密码 AnQiao@2026 分发与首登改密"）、`VERIFY.md`（§10 逐条真跑贴输出）、本计划勾选。
- 验证：按 §10 1–11 逐条执行并贴真实命令输出；`npm run build` 无 TS 错误。

## 3. 阻塞点（SPEC §11 B1–B7）处理
- B1 证书：不发，仅显示认证状态。
- B2 选修需考：口径 B（opt 测验=练习，不计认证）——已按 D7/D6 实现。
- B3 临时密码：AnQiao@2026，首登强制改。
- B4 会话有效期：7 天（env 可调）。
- B5 身份证：明文存、仅 admin 脱敏可见。
- B6 登录标识：username。
- B7 内部接口：本期只提供接口与 token。

## 4. 风险与备注
- D2 导入 99 占位 → 验收断言按 users=113 / dealer=99（与 SPEC §10 原文"users=14"不同，已在 §1 明示）；后台列表 113 行。
- dl 新建编号从 0100 起（0001–0099 已被占位占满）。
- 数据库：直接用服务器原生 Postgres（SSH 隧道）。
- npm/网络命令先 unset 代理（本机 ALL_PROXY 指向未运行的 clash 7897）。
- curl 打本地一律 `--noproxy '*'`。
