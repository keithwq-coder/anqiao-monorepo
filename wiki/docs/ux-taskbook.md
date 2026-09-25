# UX 整改任务书（reasonix 执行版 · deepseek-v4-flash-0731）

> 本文件是本轮 UX 整改的**唯一执行清单**。依据：本次 UX 审查（经销商 / 内部销售 / 管理人员三类视角）+ 既有 `docs/ux-tasks.md`（背景，非执行清单）。
> 业务与技术权威仍是 `SPEC.md`；种子数据在 `seed/`。
> 原则：**surgical 改动**；每项带**真实可跑的验收命令**；认证口径 B（SPEC §6）**一律不动**；依赖锁定（SPEC §2.1）**一律不动**。
> 阻塞项一律**留占位、不代猜、不实现**，标 `BLOCKED`。

---

## 执行顺序（按优先级）

```
P0:  T-A 测验错题回显        （经销商学习闭环，必做）
     T-B 学习路径与续学引导  （经销商首登转化，必做）
P1:  T-C 学完判定加强        （认证严肃性，收尾）
     T-D 后台分页/排序/导出筛选（管理人员规模化，必做）
     T-E 移动端适配          （经销商移动可用性，必做）
     T-F 操作审计            （管理人员治理，新增）
     T-G 批量开户            （管理人员运营效率，新增）
BLOCKED（需业主拍板，本轮不实现）：T-H 管商视图 / T-I 渠道差异化 / T-J 证书凭证 / T-K 趋势
```

---

## P0

### T-A · 测验错题回显（经销商 · 学习闭环）

- **目标**：考不过能看到「第几题、我选了什么、正确答案什么」，形成 测→纠→再测 闭环。
- **范围文件**
  - `src/app/api/quiz/[moduleId]/submit/route.ts`：判分后随结果回显每题明细。
  - `src/app/m/[id]/quiz/page.tsx`：未通过结果卡按题展示错题（题干 + 我的选项 + 正确选项 + 高亮对错）。
- **具体改动**
  1. submit 路由：`select id, answer ...` 改为 `select id, ordinal, question, options, answer from quiz_questions where module_id=$1`，构建 `details`：
     ```ts
     const details = rows.map((r) => ({
       ordinal: r.ordinal,
       question: r.question,
       options: r.options,
       chosen: submitted.get(r.id) ?? null,   // 字母 A/B/C/D
       correct: r.answer,                      // 字母 A/B/C/D
     }));
     ```
     返回体追加 `details`（仅 POST submit 返回，判分后回显一次）。
  2. quiz/page.tsx：结果卡若 `result.details` 存在，逐题渲染；`chosen===correct` 绿、`chosen!==correct` 红，并标明「正确答案：X」。
- **不动的安全边界**：GET `/api/quiz/[moduleId]` **仍只查 `id, module_id, ordinal, question, options`，绝不返回 `answer`**；答案只在 submit 服务端判分后随本次结果回显，不进取题接口、不入日志。
- **验收**
  1. `curl` POST submit 故意错 2 题 → JSON 含 `details`，每题 `chosen` 与 `correct` 为字母且 `correct` 正确。
  2. `curl` GET `/api/quiz/M02 | grep -o '"answer"' | wc -l` → **0**。
  3. 同用户 `/api/internal/certification` 结构不变（口径 B 不受影响）。
- **实测回填（reasonix 2026-08-23，dl_0001 会话）**：
  1. `POST /api/quiz/M02/submit` 故意错 3、4 题 → `score=50 passed=false correctCount=2 total=4 wrongOrdinals=[3,4]`；`details` 4 题逐题含 `{ordinal,question,options,chosen,correct}`，`correct` 与 seed 答案一致（C/B/C/C），`chosen` 为提交字母；题干中文字节级完好（UTF-8 无 U+FFFD）。
  2. `GET /api/quiz/M02` → `grep -o '"answer"' | wc -l` = **0**。
  3. `GET /api/internal/certification?username=dl_0001`（带 X-Internal-Token）→ 字段结构不变（viewedModules/completedModules/rates/quizBestScores/quizAttemptCount/quizPassedModules/totalAttempts/avgScore/lastActiveAt）。
- **依赖**：无。

### T-B · 学习路径与续学引导（经销商 · 首登转化）

- **目标**：新用户不再面对平铺 16 卡，路径清晰、有起点、能续学。
- **范围文件**
  - `src/app/page.tsx`：按 `layer`（文件实测为 `L1/L2/L3`）分组 + 组内按 `ordinal` 排序；首屏顶部加「继续学习」卡与空态引导。
- **具体改动**
  1. 模块列表按 `cw.layer` 分组（L1 基础 / L2 / L3，顺序以 `src/content/courseware.json` 实际 `ordinal` 为准），每组标题 + 标注推荐顺序（组内第 N 个）。
  2. 顶部「继续学习」卡：取该用户「已浏览但未学完」的必修模块中 `ordinal` 最小者；若无则取「未浏览」必修模块中 `ordinal` 最小者；点击跳 `/m/[id]`。全部完成则显示完成态文案。
  3. 首登（无任何 viewed）空态：`na` 隐藏逻辑不变，额外提示「建议从 L1 必修模块开始」。
- **不动**：`na` 模块仍不显示；徽标（必修/选修）语义不变；认证口径 B 不变。
- **验收**
  1. dealer 登录 GET `/` → 响应含「L1」「L2」「L3」分组标题与「继续学习」卡。
  2. 任意角色：学完某模块后再次登录，「继续学习」指向下一个未完成必修。
  3. `npm run build` 通过、无 TS 错误。
- **实测回填（reasonix 2026-08-23，dl_0001）**：
  1. 改密后 `GET /`（HTTP 200）：含 `<h2>L1 基础</h2>`、`<h2>L2</h2>`、`<h2>L3</h2>` 三组标题；L1 基础 3 卡（M01 选修/M02/M03 必修）、L2 8 卡、L3 3 卡（dealer 可见 12 模块）；每卡标注「推荐顺序：第 N 步」；顶部「🚀 继续学习」卡显示「新学员你好，建议从 L1 必修模块开始：M02 行业认知」+「开始学习 →」。
  2. `POST /api/course/M02/complete` 后再次 `GET /`：「继续学习」变为「下一课（必修）：M03」。
  3. `npx tsc --noEmit` 0 错误（`npm run build` 于全部任务后统一执行）。
- **依赖**：无。

---

## P1

### T-C · 学完判定加强（经销商 · 认证严肃性 · 收尾）

- **目标**：避免「打开即完成」「长屏短课件瞬间学完」的弱信号；提供显式学完动作。
- **范围文件**
  - `src/components/CompleteTracker.tsx`：改初始即标记逻辑 + 课件页加「标记已学完」按钮。
- **具体改动**
  1. 删除 `onScroll()` 在 `useEffect` 内的**初始调用**（挂载即判一次 → 长屏短课件瞬间完成）。
  2. 仅当「页面真实可滚动（`scrollHeight > innerHeight + 120`）」且滚动到底（nearBottom）时才自动标记；不可滚动的短课件不自动标记。
  3. 课件页 `src/app/m/[id]/page.tsx` 在测验 CTA 旁加「标记本章已学完」按钮（调用已有 `POST /api/course/[moduleId]/complete`），点击后该模块状态即时翻「已学完」。
- **不动**：`course_views.has_completed` 字段、`markModuleCompleted` 逻辑；认证口径 B 仍按「出现过即 viewed」。
- **验收**
  1. 长屏视口打开短课件 → 不自动标「已学完」（course_views.has_completed 保持 false）。
  2. 点击「标记已学完」按钮 → has_completed=true，仪表盘状态翻「已学完」。
  3. `POST /api/course/[id]/complete`（na 模块）→ 仍 403（既有不变）。
- **实测回填（reasonix 2026-08-23，dl_0001）**：
  1. CDP 驱动 headless Chrome（`http://localhost:3000` 登录 dl_0001）：视口高 5000 打开 `/m/M05`（`scrollable=false`，即长屏视口下的"短课件"），不滚动等待 4s → DB `course_views.has_completed(M05)` 保持 **false**。
  2. 视口恢复 800 后 `window.scrollTo(0, scrollHeight)`（`nearBottom=true`）→ `has_completed(M05)` 变 **true**；`POST /api/course/M03/complete` 后仪表盘 M03 状态即时为「📖 已学完」。
  3. `POST /api/course/M15/complete`（dealer 的 na 模块）→ **HTTP 403**。
  - 附：排查中发现 headless Chrome 经 `127.0.0.1` 访问时 Next 16 dev 对 chunk 请求的 Origin 校验返回 403 致 hydration 失败（`localhost` 正常）；属 dev 环境行为，生产 standalone + nginx 无此检查，未改配置。
- **依赖**：无。

### T-D · 后台分页 / 排序 / 导出筛选（管理人员 · 规模化）

- **目标**：百级用户在后台可用；列表筛选结果能导出。
- **范围文件**
  - `src/app/api/admin/users/route.ts`：GET 增 `page`/`pageSize`/`sort`；服务端 `LIMIT/OFFSET` + `ORDER BY`；返回 `total`。
  - `src/app/api/admin/export/[fmt]/route.ts`：读取 `role`/`q`/`placeholder` 查询参数，与列表同口径过滤后再导出。
  - `src/lib/admin.ts`：`listUsersWithProfile` 支持 `page/pageSize/sort/role/q/placeholder` 过滤；导出改调带参版本。
  - `src/components/AdminPanel.tsx`：分页控件（上一页/下一页/页码）、排序列头；导出链接拼接当前筛选 query。
- **具体改动**
  1. users GET：解析 `page`(默认1)/`pageSize`(默认20)/`sort`(`name|participationRate|completionRate|lastActiveAt`，默认 `id`)；SQL 加 `order by ... limit $n offset $m`；响应加 `total`/`page`/`pageSize`。
  2. export：从 `req.nextUrl.searchParams` 取 `role/q/placeholder`，传入过滤后的 `listUsersWithProfile(includePlaceholder, {role,q,placeholder})`（需给该函数加过滤参数，或在导出内先 `listUsersWithProfile` 再按同逻辑 filter，保持与列表一致）。
  3. AdminPanel：分页按钮 + 导出 `<a href>` 带上 `?role=..&q=..&placeholder=..`。
- **不动**：列字段、`maskIdcard`、脱敏规则、权限（仅 admin）。
- **验收**
  1. `GET /api/admin/users?page=2&pageSize=20` → 返回 20 条 + `total` 为全量（排除占位）。
  2. `GET /api/admin/export/csv?role=dealer` → CSV 仅含 dealer 行（不含占位）。
  3. 前端翻页/排序生效、导出按钮带当前筛选。
- **实测回填（reasonix 2026-08-23，admin 会话）**：
  1. `GET /api/admin/users?page=1&pageSize=10` → 10 条（admin/sales01/why/tech01/ops01/wj/wq/gj/zqt/yq）+ `total=15`；`page=2&pageSize=10` → 5 条（zq/kj/dhg/gsy/zjj）+ `total=15`；均不含占位。
  2. `GET /api/admin/export/csv?role=dealer` → 仅 3 个真实 dealer 行（dl_0100/0101/0102），无占位；`?role=dealer&placeholder=all` → 101 行（99 占位 + 2）；`?q=丙` → 仅 dl_0102（UTF-8 关键字过滤正确）。
  3. CDP 浏览器（/admin）：点击「参与度」列头 → 请求变 `sort=participationRate&order=desc`；选「只看占位」后点「下一页」→ 请求变 `page=2&pageSize=20`；导出链接带 `?role=..&q=..&placeholder=..`。
  - 附：过程中 SSH 隧道（15432）中断过一次（`ECONNREFUSED`），按 `docs/plan.md` 记录用 `ssh -N -L 15432:127.0.0.1:5432 bri-server` 重建后恢复；另发现 Windows `curl.exe` 命令行传中文会按 GBK 误编码（DB 落 U+FFFD），改用 UTF-8 文件体 `--data-binary @file` 建号验证（非代码缺陷）。
- **依赖**：无。

### T-E · 移动端适配（全员 · 经销商为主）

- **目标**：经销商多在手机/平板，最该移动化的群体可用、无横向溢出。
- **范围文件**
  - `src/app/globals.css`：追加响应式类（`.zk-nav`、`.zk-card-grid`、`.zk-admin-table` 等）+ `@media (max-width:640px)` 断点。
  - `src/app/layout.tsx`：顶栏加 `className="zk-nav"`。
  - `src/app/page.tsx`：模块卡片容器加 `className="zk-card-grid"`。
  - `src/components/AdminPanel.tsx`：表格容器加 `className="zk-admin-table"`。
- **具体改动**
  1. 在现有 `globals.css`（当前约 321B 的 reset）**追加**而非重写：
     - `.zk-card-grid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}`；`@media(max-width:640px){.zk-card-grid{grid-template-columns:1fr}}`。
     - `.zk-nav{flex-wrap:wrap}` → 窄屏改为纵向堆叠、字号适配；`.zk-admin-table{overflow-x:auto}` 保留，窄屏字号略缩、`th/td` 最小宽度合理。
  2. 登录页 `src/app/login/page.tsx`：其容器已 `maxWidth:400` 居中，窄屏天然可用，仅确认 `padding` 不溢出。
- **不动**：既有着色/文案；不引入 UI 组件库、不引入 Tailwind 工具类（维持 inline style 现状，仅新增少量 CSS 类）。
- **验收**
  1. `npm run build` 通过。
  2. 浏览器/DevTools 设视口 390px：导航、仪表盘卡片、后台表格均可用、**无横向滚动条**（人工核验，截图或描述）。
- **实测回填（reasonix 2026-08-23）**：
  1. `npm run build` 通过（全部路由编译输出无错误）；`npx tsc --noEmit` 0 错误。
  2. CDP 设 390×844 视口实测：登录页/仪表盘/课件页/后台四页 `scrollWidth=390=innerWidth`，**均无横向滚动**；仪表盘 `.zk-card-grid` 14 卡单列堆叠；`.zk-nav` `flex-direction: column`（导航纵向堆叠）；后台表格字号 12px、`th/td min-width:96px`。
- **依赖**：无。

### T-F · 操作审计（管理人员 · 治理）

- **目标**：建号 / 重置密码 / 改密留痕，100+ 渠道账号体系可审计。
- **范围文件**
  - `migrations/00X_audit.sql`：新增 `audit_log(id serial pk, admin_id int, action text, target text, detail text, created_at timestamptz default now())`。
  - `src/lib/admin.ts`：新增 `recordAudit(adminId, action, target, detail)`。
  - `src/app/api/admin/users/route.ts`（POST 建号、reset-password）：建号/重置后 `recordAudit`。
  - `src/app/api/account/change-password/route.ts`：改密后（若有 admin 上下文可选）记录（用户自助改密记 `self_change`，避免泄露敏感）。
  - `src/app/api/admin/audit/route.ts`：GET 列表（仅 admin），按 `created_at desc`  LIMIT。
  - `src/app/admin/page.tsx`：底部加「操作审计」折叠区，调上述接口。
- **具体改动**
  1. migration 建表；`scripts/migrate.mjs` 顺序执行（沿用 001/002 机制）。
  2. `recordAudit` 简单 insert；在建号成功、重置密码成功处调用（action=`create_user`/`reset_password`，target=新用户名）。
  3. 审计接口仅 admin；返回最近 N 条（默认 50）。
- **不动**：既有建号/重置逻辑与返回；密码不进 `detail`（只记「已重置/已建号」）。
- **验收**
  1. `node --env-file=.env.local scripts/migrate.mjs` 新增 `00X_audit.sql` 应用成功。
  2. admin 建一个账号 → `GET /api/admin/audit` 出现 1 条 `create_user` 记录。
  3. 非 admin 调 `/api/admin/audit` → 403。
- **实测回填（reasonix 2026-08-23，admin 会话）**：
  1. `node --env-file=.env.local scripts/migrate.mjs` → `applied 003_audit.sql`。
  2. admin 建 `dl_0103` → `GET /api/admin/audit` 出现 `create_user/dl_0103/admin`；重置 `dl_0102` → `reset_password/dl_0102/admin`；dealer 自助改密 → `self_change/dl_0001`（`adminUsername=null`，密码未入库）。
  3. dealer 会话 `GET /api/admin/audit` → **HTTP 403**。
- **依赖**：无（新表，不与占位/认证冲突）。

### T-G · 批量开户（管理人员 · 运营效率）

- **目标**：100 个经销商可批量建号，而非逐个点。
- **范围文件**
  - `src/app/api/admin/users/bulk/route.ts`：POST 接受 JSON `[{role,name?}]` 或 CSV 文本，逐个建号（复用 `nextUsername` + `randomPassword` + `hashPassword` + insert），返回 `{created:[{username,initialPassword,name}], failed:[...]}`。
  - `src/components/AdminPanel.tsx`：新建区加「批量建号」文本框（每行 `role 显示名` 或 CSV）+ 提交，结果展示一次性口令。
- **具体改动**
  1. 复用 `src/lib/admin.ts` 的 `nextUsername` 与 `src/app/api/admin/users/route.ts` 的 `randomPassword`/建号逻辑（抽到 `src/lib/admin.ts` 的 `createUser(role,name)` 供单建与批量共用，避免重复）。
  2. 批量上限（如单次 ≤50）防误用；非法 role 计入 `failed`。
  3. 口令仅返回一次，与单建一致；`must_change_password=true`。
- **不动**：用户名规则（`dl_/sa_`）、密码强度、权限（仅 admin）。
- **验收**
  1. POST `/api/admin/users/bulk` 带 3 行 dealer → 返回 3 个新 `dl_XXXX` + 一次性口令；登录可用且 `mustChangePassword=true`。
  2. 含非法 role 行 → 进 `failed`，合法行仍建。
  3. 非 admin → 403。
- **实测回填（reasonix 2026-08-23，admin 会话）**：
  1. `POST /api/admin/users/bulk`（CSV 文本 3 行 dealer）→ `created` 3 个（dl_0104/0105/0106，各带一次性口令）；dl_0104 用口令登录 → `ok:true mustChangePassword:true`。
  2. 同批含 `boss 非法角色` 行 → `failed:[{role:"boss",name:"非法角色",reason:"角色不合法"}]`，合法 3 行仍全部创建。
  3. dealer 会话 `POST /api/admin/users/bulk` → **HTTP 403**。
  - 附：bulk 成功建号同样写审计（`create_user` + `detail:"bulk"`，已按确认口径实现）。
- **依赖**：无。

---

## BLOCKED（需业主拍板，本轮不实现）

| 编号 | 任务 | 阻塞点 | 对应审查项 |
|---|---|---|---|
| T-H | 内部销售「名下经销商进度」视图 | 系统无「经销商→销售」归属字段，需业主定规则（按区域?按建号?全部?） | S1 |
| T-I | 代理商/代销商差异化内容 | 需业主提供渠道专属素材（分级返点、铺货规则等）；实测 dealer/agent 必修 10 模块完全相同 | D3 |
| T-J | 学习凭证 / 证书 | B1 证书范围未定（仅档案摘要 or 含 PDF） | D6 |
| T-K | 趋势与留存 | 方案未定：基于现有时间戳推算 or 新建周期快照表 | M3 |

> 以上四项**不要代猜业务规则**，待业主在 `docs/ux-taskbook.md` 顶部补充决策后，再单独排期。

---

## 全局约束（执行前必读）

1. 工作目录 `D:\Project\中科安樵\wiki`，**非 git 仓库，全程禁 git 命令**。
2. 域名 `wiki.aibrain.wiki`；**严禁 `jk.aibrain.wiki`**。
3. 依赖锁定：`next/react/react-dom/pg/@node-rs/argon2` + 允许 dev 依赖；**禁 ORM/zod/UI 库/动画库/next/font/google**。
4. 认证口径 B 不动；`na` 不可见不可做；GET 取题无 `answer`。
5. 每改完一项，**真实启动 `npm run dev` 用 curl（`curl -sS --noproxy '*' http://127.0.0.1:3000/...`）或浏览器实测**，输出贴回本文件对应任务下，禁止「预计通过」。
6. 环境：Node 24 / Next 16（params、cookies、headers 均 async 需 await）；Git Bash；本机 `ALL_PROXY` 指向未运行 clash，curl 一律 `--noproxy '*'`。
