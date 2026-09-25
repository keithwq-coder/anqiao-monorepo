# VERIFY — §10 交付标准逐条验收（真实命令输出）

> 验收时间：2026-08-22（开发环境：Windows / Git Bash；数据库：服务器 PostgreSQL 16.14，
> 经 SSH 隧道 `ssh -N -L 15432:127.0.0.1:5432 bri-server` 连接 `anqiao_training` 库）。
> 所有命令均为真实执行，输出为真实结果。本机 curl 一律 `--noproxy '*'`（本机 ALL_PROXY 指向未运行的 clash 7897）。

## §10.1 构建与启动

```bash
$ npm run build
▲ Next.js 16.3.0 (Turbopack)
✓ Compiled successfully in 3.0s
 Running TypeScript ...
 Finished TypeScript in 8.7s ...
✓ Generating static pages using 15 workers (8/8) in 99ms
Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /account
├ ƒ /admin
├ ƒ /api/account/change-password
├ ƒ /api/account/nickname
├ ƒ /api/account/profile
├ ƒ /api/admin/export/[fmt]
├ ƒ /api/admin/users
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/internal/certification
├ ƒ /api/quiz/[moduleId]
├ ƒ /api/quiz/[moduleId]/submit
├ ƒ /login
├ ƒ /m/[id]
└ ƒ /m/[id]/quiz
ƒ Proxy (Middleware)
```
✅ 构建通过、无 TypeScript 错误；`npm run dev` 多次启动无报错（`✓ Ready`）。
注：生产启动用 `node .next/standalone/server.js`（`output: standalone`，`next start` 会提示改用）。

## §10.2 迁移与种子断言

```bash
$ node --env-file=.env.local scripts/migrate.mjs
applied 001_init.sql
$ node --env-file=.env.local scripts/migrate.mjs # 幂等
no pending migrations

$ node --env-file=.env.local scripts/seed.mjs
PASS users: got=113 want=113
PASS dealers: got=99 want=99
PASS admins: got=1 want=1
PASS modules: got=16 want=16
PASS quiz_questions: got=63 want=63
PASS module_access rows: got=96 want=96
PASS module_quiz_required rows: got=96 want=96
PASS fact internal_sales: req=10 req_quiz=10 want=10
PASS fact internal_tech: req=5 req_quiz=5 want=5
PASS fact internal_ops: req=4 req_quiz=4 want=4
PASS fact dealer: req=10 req_quiz=10 want=10
PASS fact agent: req=10 req_quiz=10 want=10
PASS fact reseller: req=7 req_quiz=7 want=7
PASS nickname all null: got=0
ASSERT OK
```
✅ 表齐全（10 张）；users=113（dealer=99、admin=1）、modules=16、quiz_questions=63、矩阵 96/96、6 角色事实核对全过。
> 说明：users=113 是 seed 初始化断言（用户拍板导入全部 99 个 dl 占位，D2）。运行期 admin 在后台新建账号会使总数增加（属预期业务行为）。

## §10.3 登录流

```bash
# 正确凭据
$ curl -sS --noproxy '*' -c jar -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"sales01","password":"AnQiao@2026"}'
{"ok":true,"mustChangePassword":true,"username":"sales01","role":"internal_sales","name":"内部销售"} HTTP 200

# 错误凭据（不区分用户不存在/密码错）
$ curl ... -d '{"username":"sales01","password":"wrongpass"}'
{"error":"用户名或密码错误"} HTTP 401

# 限速：同 IP 60 秒内失败 ≥5 次 → 拒绝
attempt 1..4 -> HTTP 401
attempt 5 -> HTTP 429
attempt 6 -> HTTP 429
（blocked 期间正确密码也 429：{"error":"尝试过于频繁，请稍后再试"}）

# 改密链路（首登强制）
未登录改密 -> 401；当前密码错 -> 400；改密成功 -> 200（must_change_password 置 false）
旧密码登录 -> 401；新密码登录 -> 200（mustChangePassword=false）；登出 -> 200；登出后旧 cookie -> 401

# 强制改密门：must_change_password=true 时访问 / → 重定向 /account；改密后 → 200
```
✅ 登录、错误拒绝、限速、首登强制改密、自助改密全部通过。

## §10.4 访问控制

```bash
# 未登录访问受保护路由（proxy 统一拦截）
$ curl --noproxy '*' -o /dev/null -w '%{http_code} -> %{redirect_url}' http://127.0.0.1:3000/m/M01
302 -> http://127.0.0.1:3000/login
/ -> 302 /login；/m/M01/quiz -> 302 /login；/account -> 302 /login；/admin -> 302 /login

# 未登录访问 API
/api/quiz/M01 -> 401；/api/account/change-password -> 401

# na 模块拒绝（tech01 的 na 模块 M10）
GET /api/quiz/M10 -> 403 {"ok":false,"error":"无权限访问该模块"}
/m/M10 页面 -> 渲染"无权限访问该模块"提示页

# 非 admin 调后台 API
GET /api/admin/users（sales01 会话）-> 403
```
✅ 未登录 302/401、na 模块 403/拒绝页、非 admin 后台 403。

## §10.5 取题不含答案 + 服务端判分

```bash
# 取题响应 grep 无 answer 字段
$ curl -sS --noproxy '*' -b jar http://127.0.0.1:3000/api/quiz/M02 | grep -o '"answer"' | wc -l
0
# 响应结构：{"ok":true,"moduleId":"M02","mode":"required","questions":[{"id":5,...,"options":[...]}]}（无 answer）

# 全对提交
$ curl ... -X POST http://127.0.0.1:3000/api/quiz/M02/submit -d '{"answers":[{"id":5,"answer":"C"},...]}'
{"ok":true,"moduleId":"M02","mode":"required","score":100,"passed":true,"correctCount":4,"total":4,"wrongOrdinals":[]}

# 错 2 题提交
{"ok":true,...,"score":50,"passed":false,"correctCount":2,"total":4,"wrongOrdinals":[1,3]}

# attempt 入库
$ node ... "select module_id, score, passed from quiz_attempts ..."
[{"module_id":"M02","score":100,"passed":true},{"module_id":"M02","score":50,"passed":false}]

# 选修模块（tech01 的 M15）mode=practice；必考模块 mode=required
```
✅ 取题无 answer、判分只在服务端、attempt 入库、≥80 记 passed。

## §10.6 认证（口径 B）

```bash
# 当前状态（只浏览过 M02、M02 测验已过）
GET /api/internal/certification?username=tech01
{"username":"tech01","name":"内部技术","role":"internal_tech","status":"in_progress","completionRate":0.2,
 "viewedModules":["M02"],"passedModules":["M02"],
 "requiredMissing":{"modules":["M01","M03","M04","M09"],"quizzes":["M01","M03","M04","M09"]},...}

# 脚本模拟：只做选修测验 M15（opt+quiz=true）
STEP1 只做选修M15 → status: in_progress | M15 不进 passedModules: PASS | M15 不进 requiredMissing.quizzes: PASS
 requiredMissing.quizzes: ["M01","M03","M04","M09"] # 选修不计入认证门槛（口径 B）

# 脚本模拟：看全必修 + 过必修测验
STEP2 看全必修+过必修测验 → status: certified | completionRate: 1 | 应为 certified 满分: PASS
 requiredMissing: {"modules":[],"quizzes":[]}

# 翻转后 internal 接口
GET /api/internal/certification?username=tech01 → status: "certified", completionRate: 1,
 viewedModules/passedModules 均 = [M01,M02,M03,M04,M09]

# 缺 token / 错 token
GET /api/internal/certification?username=tech01（无 X-Internal-Token）-> 403
GET /api/internal/certification（错 token）-> 403

# 全部非 admin
GET /api/internal/certification -> {"users":[...]}（114 个非 admin 用户）
```
✅ 口径 B 全通过：选修测验不影响认证、不进 requiredMissing；必修看完+测验过 → certified；接口结构正确、缺 token 403、只读。

## §10.7 安全

```bash
# 全站响应头
$ curl -sS --noproxy '*' -I http://127.0.0.1:3000/login | grep -i x-robots-tag
x-robots-tag: noindex, nofollow
（/ 及其它所有页面同）

# robots.txt
User-agent: *
Disallow: /

# 生产模式会话 cookie（COOKIE_SECURE=true）
set-cookie: wiki_session=8b1bfa9c-...; Path=/; Expires=Sat, 29 Aug 2026 ...; Max-Age=604800; Secure; HttpOnly; SameSite=lax

# 日志：dev/prod server 日志仅请求行，grep 无密码/价格/答案；源码无 console.log 泄露；
# 取题接口 SELECT 不含 answer 列；课件 JSON 仅 src/content（public 下无课件、无目录列举）
```
✅ 不被索引、cookie 三属性齐备、敏感内容不外溢。

## §10.8 后台

```bash
# 学员列表（admin 会话）
GET /api/admin/users -> {"users":[...115 条...]}（113 种子 + 运行期新建）

# 新建经销商（自动编号 dl_XXXX）
POST /api/admin/users {"role":"dealer","name":"测试经销商"}
{"ok":true,"user":{"username":"dl_0100","name":"测试经销商","role":"dealer"},"initialPassword":"cuGzDfpAdb"}
# 该初始密码登录成功且 mustChangePassword=true；访问 / → 重定向 /account
# 再建经销商 → dl_0101；再建销售 → sa_0001（internal_sales 前缀 sa_，修复 SQL 通配符后从 0001 起）

# 非法角色
POST {"role":"admin"} -> 400 {"ok":false,"error":"角色不合法"}

# CSV 导出（GET /api/admin/export/csv）
content-disposition: attachment; filename="certification-export-2026-08-22.csv"
content-type: text/csv; charset=utf-8
username,name,role,realname,phone,idcard,status,completionRate,viewedModules,passedModules,lastActiveAt
admin,管理员,admin,管理员,13800000000,1101********01,in_progress,1,,,2026-08-22T...
# idcard 已脱敏；JSON 导出同路径 /api/admin/export/json

# 非 admin 访问 /admin 页面 → 无权限提示；调后台 API → 403
```
✅ 列表、新建（自动编号+随机密码展示一次）、CSV 字段与脱敏正确。

## §10.9 依赖纯净 + /api/ai 占位

```bash
$ npm ls --depth=0
+-- @node-rs/argon2@2.0.2
+-- next@16.3.0
+-- pg@8.23.0
+-- react@19.2.8
+-- react-dom@19.2.8
+-- @tailwindcss/postcss / @types/* / eslint / eslint-config-next / tailwindcss / typescript / tsx（dev）

package.json dependencies = { @node-rs/argon2, next, pg, react, react-dom } # 仅允许的 5 个
devDependencies = create-next-app 默认 + tsx # 无 ORM / zod / UI 库

$ find src/app/api/ai -type f
src/app/api/ai/README.md # 仅占位说明，无 route.ts
```
✅ 依赖未污染；`/api/ai/` 仅 README。

## §10.10 交付物

- 可运行项目（本仓库）+ `README.md`（含"⚠️ 部署前必办"清单）+ 本 `VERIFY.md` + `docs/plan.md`（已勾选完成）。

## §10.11 部署配置

- `output: standalone` 构建产物由 node 直接运行，服务进程监听 `127.0.0.1:2929`，经 `DATABASE_URL` 连服务器原生 Postgres（`anqiao_training` 库、专属 role `anqiao_training_app`）。
 ```bash
 $ npm run build # standalone 构建通过（§10.1）
 $ HOSTNAME=127.0.0.1 PORT=2929 node .next/standalone/server.js # 直接运行
 ```
- `deploy/nginx.conf`：反代 `wiki.aibrain.wiki` → 127.0.0.1:2929；80→443 强制 HTTPS；`/api/internal/` 限来源（allow 127.0.0.1; deny all）；`autoindex off`。
- 说明：部署方案：standalone + node 直接运行 + nginx 反代。

## 已知差异（与 SPEC 原文不同，均为用户拍板）

| 项 | SPEC 原文 | 实施（用户拍板） |
|---|---|---|
| 种子账号 | 导入 14、丢弃 99 占位 | 导入全部 113（99 占位为 dealer），断言 users=113 |
| 10 个实名账号 | role=admin | 降级为 internal_sales（"wiki 给销售用"） |
| 用户名 | 不可改 | 不可改 + 新增昵称（D13，可登录） |
| 新建账号编号 | — | dl_0100 起（0001-0099 被占位占满）、sa_0001 起 |


---

## 档案化改造验收（三组差异化，2026-08 用户拍板）

### 三组差异化（docs/cert-design.md §六）
- 管理组（admin）：不归档为考核，个人浏览。
- 内部员工组（internal_sales/tech/ops）：记录学习档案（浏览/学完/分数），**无硬性认证门槛**，供入职评估参考。
- 外部渠道组（dealer/agent/reseller）：记录学习进度 + 自测分数，仅参考。

### 真实验收输出（本轮实施后真跑）

```bash
# 内部组仪表盘（tech01 登录后 /）
参与 55%  |  学习档案  |  已浏览        # 档案横幅 + 状态标签

# 外部组仪表盘（dl_0001 登录后 /）
外部渠道组  |  学习进度                    # 无认证，仅进度

# 后台列表默认排除占位（admin）
GET /api/admin/users                      # 返回 19 个非占位用户（113 种子 - 99 占位 + 运行期新建）
GET /api/admin/users?placeholder=only     # 99 个占位账号

# 管理员重置密码（I-2）
POST /api/admin/users/16/reset-password
{"ok":true,"user":{"username":"dl_0001"},"initialPassword":"WYn6m3jCwA"}   HTTP 200
（非 admin 调用 → HTTP 403；重置后旧会话全部失效）

# 学完信号（has_completed，I-4）
POST /api/course/M02/complete            {"ok":true,"moduleId":"M02"}      HTTP 200
POST /api/course/M10/complete（na 模块）                                   HTTP 403

# 内部接口档案化（§6.3）
GET /api/internal/certification?username=tech01（X-Internal-Token）
{"username":"tech01","name":"内部技术","role":"internal_tech","tier":"internal",
 "viewedModules":["M02","M05","M01","M03","M04","M09"],"completedModules":["M02"],
 "participationRate":0.545,"completionRate":0.091,
 "quizBestScores":{"M01":100,"M02":100,"M03":100,"M04":100,"M09":100,"M15":100},
 "quizPassedModules":["M02","M15","M01","M03","M04","M09"],
 "totalAttempts":8,"avgScore":93.8, ...}
```

### 影响说明
- 原"认证状态（certified/in_progress）"语义已由用户拍板取消（docs/improvements.md I-6）：改为学习档案，分数无硬门槛。
- 后台统计按管理/内部/外部三组展示，默认排除种子占位账号。
- 数据库新增列：`users.is_placeholder`、`course_views.has_completed`（migration 002）。
