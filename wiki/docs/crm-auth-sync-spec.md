# 培训 wiki ↔ CRM 账号统一认证与同步 Spec

> 状态：**已确认（v1）**——2026-08-26 业主确认：赵/武=wiki admin；新建账号初始密码统一 123；本期实现验证+建号+改密（删除/禁用同步留二期）；王海燕登录名改为"王海燕"。
> 日期：2026-08-26
> 范围：`wiki`（`D:\Project\中科安樵\wiki`，部署 `wiki.aibrain.wiki`）与 `crm`（同仓库上级目录，部署 `crm.aibrain.wiki`）双端改造

---

## §0 一句话目标

把"培训 wiki 系统"和"CRM 系统"的用户账号收拢为**同一套 9 个账号、同一套登录密码**：密码由 CRM 统一验证，用户名在两库完全一致，任一端建号/改密对另一端生效；同时把两库现有的冗余账号（wiki 种子 113 个 + sa_ 测试号、CRM 的 sa001-sa010 与"何"）清掉。

## §1 背景与现状（已验证事实）

| 项 | wiki（anqiao_training 库） | CRM（anqiao_crm 库） |
|---|---|---|
| 技术栈 | Next.js 16 + `pg` + `@node-rs/argon2` | Python FastAPI + SQLAlchemy/Alembic + `argon2-cffi` |
| 用户表 | `users`（117 个：114 种子 + sa_0001/0002/0003） | `user_identities`（17 个） |
| 密码 | argon2id 哈希（本地验证） | argon2id 哈希（本地验证） |
| 与对方集成 | 仅 `GET /api/internal/certification`（只读档案） | 无 |
| 现状账号间关系 | 与 CRM **零关联**（各自独立建号） | 与 wiki 零关联 |

- 两边密码算法同为 argon2id（标准格式、参数自描述），"密码同一套"在技术上是可行的：**统一由 CRM 验证，wiki 不再本地验密**，天然避免双写不一致。
- wiki 现有 `users.username` 校验 `USERNAME_RE` 只允许 ASCII，CRM 用户名已是中文（赵/武/吴/何丹/张），wiki 需放宽校验以支持中文用户名。

## §2 最终账号清单（两库收敛目标，共 9 个）

> 用户名 = 中文实名（与用户"从 CRM 继承"要求一致）；`ceshi`、`admin` 保持 ASCII。**用户名与显示名相同**。

| 显示名/用户名 | wiki 现状 | CRM 现状 | wiki 动作 | CRM 动作 | wiki 角色（默认值，可调） |
|---|---|---|---|---|---|
| admin | ✓ | ✓（administrator） | 保留 | 保留 | admin |
| 赵 | ✗ | ✓（manager） | 新建 | 保留 | admin（见 §8 问题①） |
| 武 | ✗ | ✓（manager） | 新建 | 保留 | admin（见 §8 问题①） |
| 吴 | ✗ | ✓（administrator） | 新建 | 保留 | admin |
| 何丹 | ✗ | ✓（business_user） | 新建 | 保留 | internal_sales |
| 张楠 | 有 sa_0002（名"张"） | 有"张"（business_user） | sa_0002 改名为"张楠" | "张"改名"张楠" | internal_sales |
| 测试 | 有 sa_0003（nickname=ceshi） | ✗ | sa_0003 改名为"ceshi" | **新建 ceshi** | internal_sales |
| 王海燕 | 有 why | ✗ | why 改名为"王海燕" | **新建"王海燕"** | internal_sales |
| 周晶晶 | ✗ | ✗ | **新建** | **新建** | internal_sales |

### 删除清单（收敛时删除）

- **wiki**：113 个种子账号（admin、why 之外全部，含 sales01、tech01、ops01、10 个实名、99 个 `dl_00xx` 经销商占位）+ `sa_0001`（何）。
  - 影响：`sessions` 20 行（删）、`audit_log` 5 行（admin_id 改挂 admin，保留审计留痕）；`course_views`/`quiz_attempts`/`exams`/`exam_attempts` 对被删用户 0 行（已核实）。
- **CRM**：`sa001`~`sa010`（10 个"合作伙伴"）+ `何`，共 11 个。
  - 影响：已核实全部引用表对被删用户的关联行数 = **0**（无机构、无跟单、无审计），可干净删除。

## §3 目标架构：统一到 CRM 验证登录

```
用户浏览器 ── wiki.aibrain.wiki /login ──► wiki API ──► CRM 内部接口（verify 密码）
                                                │
                          X-Internal-Token（内网/本机）鉴权；仅 127.0.0.1 可达
```

1. **登录**：wiki 收到 username+password → 调 CRM `POST /api/internal/auth/verify` → CRM 验 argon2id（含其自身的限速/审计）→ 通过后 wiki 用本库 `users` 镜像建会话（沿用现有 session/cookie 机制）。
2. **wiki 本地 `users` 表保留**：username、name、role、（学习档案依赖）——仅作授权与数据载体；**`password_hash` 不再参与验证**（兼容保留列，登录路径弃用）。
3. **镜像同步**：CRM 验证通过而 wiki 本地无该用户时，自动 upsert 镜像（name 用 CRM display_name、role 走 §2 映射表默认）；用户名匹配不到的返回 401。
4. **fail-closed**：CRM 不可达/超时 → wiki 登录直接失败提示"暂时无法登录，请稍后再试"，不泄漏细节。

## §4 CRM 侧新增内部接口（wiki → CRM）

> 鉴权：请求头 `X-Internal-Token`，与 CRM 现有 env 隔离，新增 `CRM_INTERNAL_TOKEN`（生产注入 `/opt/anqiao-crm/shared/`，勿入库）；nginx 只放行 `127.0.0.1`/内网来源（仿照现有 `/api/internal/` 做法）。

| 接口 | 方法/路径 | 入参 | 出参 |
|---|---|---|---|
| 验证密码 | `POST /api/internal/auth/verify` | `{username, password}` | 200 `{ok:true, user:{username, display_name, status}}`；401 `{ok:false}`（不区分用户不存在/密码错） |
| 创建用户 | `POST /api/internal/users` | `{username, display_name, password}` | 200 `{ok:true}`；409 用户名已存在 |
| 修改密码 | `POST /api/internal/users/password` | `{username, current_password, new_password}` | 200 `{ok:true}`；401 当前密码错 |
| 查用户 | `GET /api/internal/users?username=` | — | 200 `{ok:true, user}`；404 |

- 复用 CRM 现有 `AuthenticationService.authenticate` 的验密路径（避免重复实现限速/审计），但**不创建 CRM 会话**（纯验证，无副作用）。
- 所有内部调用记 CRM audit（action 前缀 `INTERNAL_`），但**不记录密码明文/哈希**（沿用现有审计规范）。

## §5 wiki 侧改造

### 5.1 登录链路（`src/app/api/auth/login/route.ts`）
- 替换本地 `verifyPassword` → 调用 CRM verify 接口（新增 `CRM_BASE_URL`、`CRM_INTERNAL_TOKEN` env；`src/lib/env.ts` 扩展）。
- 通过后：按 username 查本地 `users`；无则按 §2 映射 upsert（role 默认值）；`is_active=false` 或 CRM 返回 status≠enabled → 拒登。
- 保留现有：登录限速、session 建立。**初始密码改密为“提醒”方式**：登录后直接进系统，界面顶部横幅提醒修改（不再强制拦截）。

### 5.2 校验放宽（`src/lib/validation.ts`）
- `USERNAME_RE` 由 `/^[A-Za-z0-9_]{2,32}$/` 放宽为 `/^[\p{L}\p{N}_]{1,32}$/u`（支持中文，最短 1 字符）。
- `validLoginId` 同步放宽；登录查询已是 `username = $1 or nickname = $1`，中文不受影响。

### 5.3 改密（`/api/account/change-password`）
- 改调 CRM 改密接口（先验当前密码、再写新密码）；成功后再落本地 `must_change_password=false`（新密码哈希不再写本库，或仅保留兼容字段）。

### 5.4 后台建号（`/api/admin/users`）
- 建号 → 先调 CRM 创建（username/display_name/初始密码）→ 成功后在 wiki 本地建镜像（role 按 admin 所选）；CRM 409 时返回"用户名已存在"。

### 5.5 admin 重置密码（`/api/admin/users/[id]/reset-password`）
- 改调 CRM 改密接口（忽略当前密码语义改为重置）；本地置 `must_change_password=true`。

### 5.6 环境变量（生产 `anqiao-wiki.service` Environment 追加）
- `CRM_BASE_URL=https://127.0.0.1:<crm端口>` 或内网地址（nginx 放行）、`CRM_INTERNAL_TOKEN=<强随机>`。

## §6 账号收敛执行方案（一次性，幂等）

> 前置：备份（已做 `/opt/backups/anqiao_crm_.dump`、`anqiao_training_.dump`；执行前再各生成带时间戳备份）。

1. **CRM 库**：
   - `张` → 改名 `张楠`（username + display_name）
   - 新建 `ceshi`（display_name=测试）、`王海燕`、`周晶晶`，初始密码统一 `123`（首登即由用户改；CRM 无 must_change_password 字段，强制改密由 wiki 镜像控制）
   - 删除 `sa001`~`sa010`、`何`（直接 DELETE，已确认无引用）
2. **wiki 库**：
   - `why` → 改名 `王海燕`；`sa_0003` → 改名 `ceshi`（username、nickname 清空）；`sa_0002` → 改名 `张楠`
   - 新建 `赵`、`武`、`吴`、`何丹`、`周晶晶`（role 按 §2 映射；`must_change_password=true`，初始密码 123 仅在 CRM 侧存在——这些账号登录后走改密流程）
   - 删除 113 种子 + `sa_0001`；前置清理 `sessions` 相应 20 行、`audit_log` 5 行 admin_id 归并 admin
3. **顺序**：先 CRM 后 wiki；先建后删；每步单事务，失败回滚当前库操作（不跨库事务，靠顺序+校验兜底）。

## §7 安全与容错

- 内部调用：双向 token 鉴权 + nginx 内网/本机限制；token 不落日志。
- CRM 侧限速、审计沿用现状；wiki 侧限速沿用现状。
- 失败语义：CRM 不可达 = 登录失败（fail-closed），不降级到本地密码。
- 密码明文只在 wiki→CRM 内部通道传输一次（内网 TLS/本机），两库均不新增明文存储。

## §8 已确认决策（2026-08-26 业主拍板）

1. **赵/武（董事长/董事）在 wiki 的角色**：**admin**（全量视图+后台）。
2. **新建账号初始密码**：统一 **123**（王海燕也改为 123，登录后强制改密；原 123123 作废）。
3. **删除/禁用双向同步**：**二期**；本期实现验证、建号、改密三项。
4. **王海燕登录名**：由 `why` 改为 `王海燕`（旧登录名 why 失效；学习记录按 user_id 保留）。

> 附记（会话决策链）：账号最终名单由最初 3 个（ceshi/何/张）先后调整为 7 个、9 个，全部记录于 §2。

## §9 实施顺序

1. CRM 内部接口（§4）开发 + 本地测试
2. wiki 改造（§5）开发 + 本地测试
3. 生产部署 CRM 接口 → 生产部署 wiki 改造（登录先切 CRM 验证）
4. 账号收敛（§6）执行 + 备份
5. 全量验收（§10）

## §10 验收标准

1. `users`（wiki）与 `user_identities`（CRM）的 username 集合完全一致，各 9 个。
2. 两库均无 sa001-sa010、何、dl_00xx、sales01 等旧账号；旧账号登录返回"用户名或密码错误"。
3. `ceshi`/`123` 登录 wiki 成功；`admin` 登录成功；`赵/武/吴/何丹/张楠/王海燕/周晶晶` 用 CRM 密码登录 wiki 成功。
4. 错误密码登录被拒；连续失败触发限速。
5. wiki 改密成功后，用新密码登录 CRM 成功（密码已同步）。
6. CRM 改密成功后，用新密码登录 wiki 成功。
7. wiki 后台建号 → CRM 出现同用户名账号；CRM 已有账号 → wiki 登录自动建立镜像。
8. CRM 接口不可达时 wiki 登录失败且不降级。

## §11 执行记录（2026-08-27 已完成部署与收敛）

- **CRM 侧**：新增 `src/crm/web/routes/internal.py`（`/api/internal/auth/verify`、`/api/internal/users`、`/api/internal/users/password`，X-Internal-Token 鉴权、CSRF 豁免、uvicorn 仅绑 127.0.0.1:8200）；`config.py` 增 `crm_internal_token`；生产 env 注入 `CRM_INTERNAL_TOKEN`（值见 `/opt/anqiao-crm/shared/database.env`）；测试 **517 passed**，新增 `tests/test_internal_routes.py` 13 项全绿。
- **wiki 侧**：`src/lib/crm.ts`（客户端，fail-closed）；登录 `/api/auth/login` 改走 CRM 验证 + 本地镜像自动创建（`admin/赵/武/吴→admin`，其余 internal_sales）；`/api/account/change-password`、`/api/admin/users`（单建/批量）、`/api/admin/users/[id]/reset-password` 全部同步 CRM；`validation.ts` 用户名放开中文；`password_hash` 统一哨兵 `!crm-auth`；tsc 零错误。生产 `anqiao-wiki.service` 注入 `CRM_BASE_URL=http://127.0.0.1:8200` + `CRM_INTERNAL_TOKEN`。
- **账号收敛（两库均 9 个）**：admin、赵、武、吴、何丹、张楠（张→张楠改名）、ceshi（原 sa_0003）、王海燕（原 why 改名）、周晶晶。删除：wiki 113 个种子 + sa_0001(何)；CRM sa001-sa010 + 何。全部账号密码统一 **123**、首登强制改密（`must_change_password=true`）。
- **验收（生产公网全链路）**：9 账号/123 登录全部 200；错误密码、旧账号（sales01、dl_0001）401；建号（wiki→CRM）、管理员重置、自助改密（current+new）双向同步均验证通过（CRM verify 新密码 200 / 旧密码 401）；验收临时账号已清理。
- **补充（2026-08-27 二）**：应业主要求，**首登“强制改密”改为“提醒改密”**——`requirePortalUser` 不再拦截、登录后一律进首页，首页/账号页顶部黄色横幅提示修改初始密码（`must_change_password` 字段保留仅作提醒依据）。生产已重新构建部署并验收（吴、ceshi 登录后 GET / 200 + 横幅可见，错误密码 401）。
- **补充（2026-08-27 三）部署修复**：发现并修复 Next standalone 静态资源部署缺陷——`_next/static` 与 `public` 必须复制进 `standalone/.next/static`、`standalone/public`（此前只解压到 standalone 外部，导致页面 JS 全部 404、登录表单无 JS 响应）。修复后以**真实浏览器（Playwright，逐字键盘输入）**验收：吴/123、ceshi/123 登录成功进入系统首页且横幅可见；错误密码显示"用户名或密码错误"被拒。部署要点已补入 README。
- **备份**：`/opt/backups/anqiao_crm_.dump`、`anqiao_training_.dump`（收敛前）；CRM 代码改动备份 `/opt/anqiao-crm/backup/pre-sync-20260826/`；wiki 部署备份 `/opt/anqiao-wiki/backup/deploy-*/`。
- **注意**：`CRM_INTERNAL_TOKEN` 为敏感凭据，勿入日志/仓库。
## §12 课件内容修订与学习页面改造（2026-08-27）

- **M01**：删除"核心团队"（过时）与"服务体系：问诊与送药"（远景非现实）；挂《产品介绍 V1.0》附件（文件待业主提供至 public/docs/）。
- **M02**：挂《产品介绍 V1.0》附件；问诊/送药类远景表述剔除。
- **M03**：主力产品零售价表移除床下健康监测仪；新增"产品储备（未量产）"说明页；挂 0820 系列价格表（零售报价单/代理价盘/合伙人政策，public/docs/）。
- **M06**：渠道角色改为"合伙人 + 经销商"两类（代理商=经销商别名，不作独立系列）；话术重写为分场合、结合产品特点；经销商加入流程删除保证金步骤。
- **M07**：价盘表新增"优惠零售价"列（SH100=2,480 / D100=1,280）；删除"市场秩序保证金"（本年不收取）；补充"突破价格体系须向领导汇报审批"。
- **M08 / M09 / M10**：改为选修不考（quiz_roles 全角色 false，模块访问 internal_sales req→opt），课件头部标注"仅需了解"；M09 调试清单补 D100 专属检查项。
- **M11（客户服务与回访）**：整模块删除（课件/权限/题库/库数据/学习记录），生产已清。
- **通用文案**：删除"（必考，≥80 分计认证）"，改为陈述式"学完本节后请完成测验"；测验入口按钮改"开始测试"。
- **知识库 → 知识点百科**：/knowledge-base 由题库浏览改为知识点百科（从课件内容提取条目，按模块顺序排列、支持关键词搜索、点击跳转课件），用户界面不再展示题库。
- **学习地图 → 知识点地图**：思维导图语义调整为"知识点在哪里"（根=模块、分支=知识点主题、叶=要点，点击跳课件），入口文案同步。
- **自测 → 模块练习**：/self-test 支持按模块刷题/测试（学完模块后可反复练习、可测试），无分数、结果仅本人可见。
- 生产已构建部署并验证：登录正常、模块 15 个（M11 无）、知识库搜索（"优惠"3 条、"跌倒"21 条）、附件渲染、静态资源部署已按 standalone 规范放置。

## §13 知识库词条化与用户视角修正（2026-08-27 二）

- 知识库重做为**维基百科式词条**：从课件逐条提取知识点（每行/每要点/每个表格格为一个词条，共 339 条），按字母数字排序、支持关键词检索、点击跳转对应课件；模块仅作词条来源标签（非类目列表）。
- 学习地图（mindmap）语义固定为"知识点在哪里"，入口与说明文案统一。
- **自测不再是独立导航入口**：移除仪表盘自测按钮；自测内嵌到模块页（"练习刷题"），每个模块学完之后可反复刷题、可测试。
- 普通用户登录首页**移除"学习档案"横幅板块**（管理员视角板块不上普通用户界面）。
- 清理工程性括号文案（"（必考，≥80 分计认证）"等），以陈述式文案替代。
- 部署规范更新：standalone 静态目录必须"先删后拷"，避免 cp -r 嵌套导致 chunk 404（本日已踩坑并修复）。
