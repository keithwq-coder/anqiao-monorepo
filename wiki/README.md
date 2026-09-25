# 中科安樵 · 经销商赋能培训系统（wiki）

登录后的**内部**培训与学习档案系统：7 类角色按权限矩阵学习 16 个模块、做单选测验，系统记录学习/测验档案（浏览、学完、分数），按**管理/内部员工/外部渠道**三组差异化呈现，并对内网暴露一个**只读**学习档案接口供 CRM 调用。

- 技术栈：Next.js 16（App Router）+ TypeScript + Tailwind CSS v4 + PostgreSQL（原生 SQL + `pg`）
- 密码哈希：argon2id（`@node-rs/argon2`）
- 会话：DB 后端会话（`sessions` 表 + uuid cookie，HttpOnly/Secure/SameSite=Lax）
- 业务与技术权威：`SPEC.md`；种子数据：`seed/`（勿手改，导入走 `scripts/seed.mjs`）

## 目录

```
migrations/ 纯 SQL 迁移（001_init.sql）
scripts/ migrate.mjs（迁移执行器）/ seed.mjs（种子导入+断言）
seed/ 权威种子：auth.json / courseware.json / quizzes.json
src/content/ courseware.json（从 seed 拷入，运行时服务端读取，不入库）
src/lib/ db / env / password / session / auth / rate-limit / validation / certification / admin / types
src/app/ 页面与 API（App Router）
deploy/nginx.conf 生产反代配置
```

## 快速开始（开发）

前置：可用的 PostgreSQL（本开发环境为服务器 16.14，经 SSH 隧道 15432→5432）。

```bash
npm install
# 配置环境变量（见 .env.example 说明）：# DATABASE_URL=postgres://anqiao_training_app:xxx@127.0.0.1:5432/anqiao_training
# INTERNAL_API_TOKEN=xxx
# SESSION_TTL_SECONDS=604800
# COOKIE_SECURE=true # 本地 http 调试可设 false
node --env-file=.env.local scripts/migrate.mjs # 建表
node --env-file=.env.local scripts/seed.mjs # 导入种子并打印断言（必须全 PASS）
npm run dev # http://localhost:3000
```

本地冒烟注意：本机存在 `ALL_PROXY=http://127.0.0.1:7897`（clash 未启动时 7897 无监听），
联网命令（npm 等）先 `unset ALL_PROXY HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`；
curl 打本地一律 `curl -sS --noproxy '*' http://127.0.0.1:3000/...`。

## 账号与初始密码

- 种子导入 113 个账号（1 `admin` + 10 实名管理降级为 `internal_sales` + `sales01/tech01/ops01` + 99 个 `dl_0001..dl_0099` 经销商占位）。
- 全部账号初始密码统一为 `AnQiao@2026`，**首登强制修改密码**后才能访问其它页面。
- 用户名规则：`dl_XXXX`（经销商/代理商/代销商）、`sa_XXXX`（内部销售），由 admin 在后台新建时自动生成递增，**不可修改**；用户可自行设置**昵称**，昵称可代替用户名登录。

> ⚠️ **部署前必办**：> 1. nginx TLS 证书就绪并强制 HTTPS（`deploy/nginx.conf`）；
> 2. `DATABASE_URL` 指向 `anqiao_training` 库（专属 role `anqiao_training_app`，与 CRM 的 `anqiao_crm` 零交叉）；
> 3. `INTERNAL_API_TOKEN` 设为强随机值（env 注入，不硬编码、不入库、不入日志）；
> 4. 临时密码 `AnQiao@2026` 分发后，务必督促每个账号首登改密（系统强制）。

## 部署（）

```bash
# 1) 在服务器建库建角色（一次性）
# CREATE ROLE anqiao_training_app LOGIN PASSWORD '<强密码>';
# CREATE DATABASE anqiao_training OWNER anqiao_training_app;
# 2) 迁移 + 种子（在服务器上执行）
# node --env-file=.env.local scripts/migrate.mjs
# node --env-file=.env.local scripts/seed.mjs
# 3) 构建并直接运行（standalone）
npm run build
# 重要：Next standalone 部署必须把静态资源复制进 standalone 内部，否则页面 JS 404
# （登录等交互全部失效）。生产 systemd WorkingDirectory=/opt/anqiao-wiki/.next/standalone：
#   注意：必须先删除旧目录再拷贝（目标已存在时 cp -r 会嵌套复制，导致 chunk 404）
#   rm -rf /opt/anqiao-wiki/.next/standalone/.next/static /opt/anqiao-wiki/.next/standalone/public
#   cp -r .next/static /opt/anqiao-wiki/.next/standalone/.next/static
#   cp -r public     /opt/anqiao-wiki/.next/standalone/public
HOSTNAME=127.0.0.1 PORT=2929 DATABASE_URL=... INTERNAL_API_TOKEN=... node .next/standalone/server.js
# （守护建议：pm2 start node --name wiki -- .next/standalone/server.js 或 systemd unit）
# 4) nginx 反代 wiki.aibrain.wiki → 127.0.0.1:2929（强制 HTTPS，/api/internal/ 限本机来源）
```

服务进程经 `DATABASE_URL` 连服务器原生 Postgres（同一实例、`anqiao_training` 库，与 `anqiao_crm` 零交叉）。统一认证后还需注入 `CRM_BASE_URL=http://127.0.0.1:8200`、`CRM_INTERNAL_TOKEN=<与 CRM 同值>`（见 docs/crm-auth-sync-spec.md）。

## 关键安全设计（SPEC §7）

- 全站鉴权：`src/proxy.ts` 统一拦截，除 `/login`、静态资源、登录接口、`/api/internal/*`（token 鉴权）外，无会话一律 302 `/login`（API 401）。
- 课件不裸露：`src/content/courseware.json` 仅服务端读取、RSC 渲染，不在 `public/`。
- 答案不出服务端：取题接口不含 `answer`，判分只在服务端。
- 不被索引：全站 `X-Robots-Tag: noindex, nofollow` + `robots.txt` Disallow。
- 登录限速：同 IP 60 秒内失败 ≥5 次拒绝 10 分钟（env 可调）。
- 三组差异化（docs/cert-design.md）：管理组不归档；内部员工组与外部渠道组记录学习档案（浏览/学完/分数），**无硬性认证门槛**，分数仅供入职评估与参考；`na` 模块不可见，`req/opt` 仅影响必修/选修标注。

## 内部只读接口（供 CRM）

```
GET /api/internal/certification?username=<u> # 单人（非 admin）
GET /api/internal/certification # 全部非 admin
Header: X-Internal-Token: <INTERNAL_API_TOKEN> # 缺失/不符 → 403
```

只读、不跨库、CRM 侧自行缓存，不反向写培训库。返回字段：tier / viewedModules / completedModules / participationRate / completionRate / quizBestScores / quizPassedModules / avgScore / lastActiveAt。

## /api/ai/*

仅占位 README（二期：锦囊妙计 / 话术助手 / 每日简报），本期**无实现**。
