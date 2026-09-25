# 中科安樵系统整合 Spec（仓库拓扑 / 部署 / 切换基线）

> 状态：**整合实施 Spec v0.2（双系统底座与阶段四验收完成态）**
> 日期：2026-09-24
> 读者：后端、前端、运维、项目管理
> 关联：`docs/PLATFORM-SPEC.md`（平台承载边界）、`docs/API-CONTRACT.md`（接口契约唯一来源）、`docs/LTC-INSURANCE-SPEC.md`（长护险执行细节）、`docs/LTC-WORKBENCH-SPEC.md`（多工作台实现规格）
>
> ⚠️ **硬性基线（贯穿全文档）**
> 1. **唯一后端与双底座基线**：`anqiao-console/server/` 是全系统唯一业务后端与数据底座，同时承载管理端控制台（`anqiao-console`，9 大角色工作台）与数据驾驶舱大屏端（`suqian-dashboard` 宿迁长护险试点大屏 + `anqiao-dashboard` 凯健/全国大屏）。前端一律经 `docs/API-CONTRACT.md` 定义的 `/v1` REST + WebSocket 契约获取数据，禁止自带独立后端进程、禁止内置业务数据种子。
> 2. **日间可用性红线（不可协商）**：生产站点（`anqiao.aibrain.wiki` 的 `/dash/`、`/saas/`、`/suqian-dash/`）在 **06:00–23:00 必须处于可看状态**。一切存在中断风险的变更（nginx 配置变更、systemd 服务启停、端口/路径切换、旧服务下线）**仅允许在 23:00–次日 06:00 的夜间窗口执行**。日间允许的动作见 §7.1 白名单。
> 3. **回滚前置**：任何夜间窗口操作执行前，回滚方案必须已经存在且经过演练确认（旧静态目录保留、旧 service 文件只停不删、nginx 配置每次变更前备份）。无回滚方案不得执行切换。
> 4. **Spec 先行**：先改 Spec 再改代码；代码与 Spec 不一致视为缺陷。本文件是**仓库边界、部署拓扑、端口分配、切换窗口与回滚纪律**的唯一来源，其他文档不复述、不冲突。
> 5. **mock 纪律**：mock 数据仅允许在本地开发以显式开关（`VITE_MOCK=1` 或 `VITE_USE_LOCAL_MOCK=1`）启用；生产构建产物**禁止包含静默 mock 回退**（接口失败必须显式报错/空态，不得悄悄演示假数据）。`vendor`/`platform`/`anqiao_ops` 租户在任何环境下禁止 mock 回退（防串租户泄漏，延续既有红线）。

---

## 1. 现状盘点（2026-09-23 基线）

本 Spec 基于对三个仓库的实际代码调查，现状结论如下（证据见各仓对应文件）：

| 项 | 现状 | 问题 |
|---|---|---|
| 仓库关系 | `anqiao-console` 从 `anqiao-dashboard` 拆分而来；`suqian-dashboard` 是 `anqiao-dashboard` 连工作区复制的分叉（git 历史 SHA 完全一致，宿迁改动全部未提交） | 同源代码三份，各自演进，已开始腐化 |
| 后端实现 | 三仓各有一份零依赖 Node 后端：dashboard 两仓为 663 行旧版子集；console 为 1016 行 + `ltc.js` + `auth.js` 演进版 | "控制台已拆分到 anqiao-console"只停留在 README，代码未拆走 |
| 数据层 | 均无数据库；内存种子 + `store.json` 仅持久化告警状态，重启即重置 | 演示切片阶段，尚未生产化 |
| 前端数据源 | 大屏一律走前端 mock；控制台连各自仓内自带 server | dashboard 对 console 的 API 调用为零 |
| 硬件云链路 | 浏览器直连 `api.health-track.anqiaokj.com`，前端硬编码兜底账号与长期 JWT（`src/api/hardwareApi.ts:87-93`） | 凭据泄漏级安全缺陷 |
| 生产部署 | dashboard 仓以 `anqiao-saas.service` 跑 2830 端口；console 部署脚本同样使用 `anqiao-saas.service` + 2830 | 同一 service 名同一端口，生产互踩，后部署者覆盖先者 |
| 宿迁线上 | nginx 仅有静态 `alias + try_files`，无 API 反代 | 线上大屏靠 mock 运行，控制台功能无后端可用 |
| 部署脚本 | 多个脚本硬编码生产服务器 SSH 明文密码 | 凭据泄漏级安全缺陷 |

---

## 2. 目标拓扑

### 2.1 系统拓扑（已落地态）

```
硬件设备 → 安樵硬件云 API（api.health-track.anqiaokj.com）
                ↑ 服务端持有凭据，定时拉取/代理（server/hw.js，HW_* 环境变量）
        anqiao-console server（唯一业务后端与底座，127.0.0.1:2831）
                │ REST /v1 + WebSocket /v1/ws（统一 Bearer 鉴权，支持双端消费）
        ┌───────┴─────────────────────────────┬───────────────────────────┐
        ▼                                     ▼                           ▼
  console 管理控制台前端              suqian-dashboard 大屏前端        anqiao-dashboard 大屏前端
  路径: /saas/                       路径: /suqian-dash/             路径: /dash/
  9 大角色专属工作台（LTC全闭环）       宿迁试点长护险监管与态势大屏         凯健护理院态势 / 全国设备运营大屏
  （强身份鉴权、RBAC+DataScope）       （纯前端，恒 3 台设备，比对不写回）  （纯前端，无自带后端）
```

- **双底座统一供给**：`anqiao-console/server/` 为 `anqiao-console` 管理端与 `suqian-dashboard` / `anqiao-dashboard` 大屏端提供同源数据底座。大屏所需的所有数据接口（`/v1/project/config`、`/v1/floors`、`/v1/wards`、`/v1/beds`、`/v1/stats/*`、`/v1/overview`、`/v1/patients`、`/v1/alerts`、`/v1/ws`）全部由 `server/index.js` 统一实现与响应。
- 大屏前端与 console 前端**同域部署**，经 nginx 同源反代访问 `/v1`，前端 `VITE_API_BASE` 默认为空串（同源相对路径）。
- 浏览器**禁止直连硬件云**：服务端通过 `server/hw.js` 持有凭据并代理 `/v1/hardware/*`。
- 契约层不变更：`/v1` 路由、响应包、WS 协议以 `docs/API-CONTRACT.md` 为唯一来源。

### 2.2 端口与服务分配（生产就绪态）

| 服务 | systemd unit | 监听 | 状态 | 说明 |
|---|---|---|---|---|
| anqiao-console server | `anqiao-console.service` | `127.0.0.1:2831` | **在服** | 全系统唯一业务后端；Node 22 运行，SQLite 持久化启用，承载双端所有 `/v1` 请求 |
| 旧 dashboard server | `anqiao-saas.service` | `127.0.0.1:2830` | **已下线** | 阶段三与窗口 E 验收后已安全下线，释放端口并保留单元文件作冷备 |
| 管理端静态产物 | —（nginx 直接发） | — | **在服** | `/var/www/anqiao-saas`（反代 `/saas/`） |
| 宿迁大屏静态产物 | —（nginx 直接发） | — | **在服** | `/var/www/suqian-dash`（反代 `/suqian-dash/`） |
| 凯健/全国大屏静态产物 | —（nginx 直接发） | — | **在服** | `/var/www/anqiao-dash`（反代 `/dash/`） |

### 2.3 nginx 路由（目标态）

| location | 指向 | 说明 |
|---|---|---|
| `/saas/` | console 前端静态目录 | 不变 |
| `/v1/` | `proxy_pass http://127.0.0.1:2831` | **新增**：所有前端的统一业务 API 入口；含 WS upgrade |
| `/saas/api/` | `proxy_pass http://127.0.0.1:2831/`（剥前缀） | 过渡期兼容保留；稳定后是否收编见 §9 未决项 2 |
| `/dash/` | 凯健大屏静态目录 | 由整合后的 dashboard 仓 `VITE_PROJECT=kaijian` 构建 |
| `/suqian-dash/` | 宿迁大屏静态目录 | 由整合后的 dashboard 仓 `VITE_PROJECT=suqian` 构建；**补 API 反代**（现状缺失） |

---

## 3. 仓库边界

| 仓库 | 目标定位 | 允许包含 | 禁止包含 |
|---|---|---|---|
| `anqiao-console` | 唯一业务后端 + 管理控制台前端（+ 预留家属端） | `server/`、`src/`（控制台）、`docs/`（全部 Spec） | 大屏页面（大屏不是任何角色的默认首页，对齐 PLATFORM-SPEC §1） |
| `anqiao-dashboard` | 大屏纯前端（凯健/宿迁双项目构建） | `src/`（大屏视图、项目配置）、构建脚本 | `server/`、`src/views/console/`、业务 mock 兜底（除 §5 显式开关）、任何硬编码凭据 |
| `suqian-dashboard` | **迁移完成后归档只读** | — | 不再接受新提交 |

**删除清单（阶段二/三执行时按此核对）**：

- `anqiao-dashboard`：`server/`（整目录）、`src/views/console/`（整目录）、`src/api/client.ts` 中的静默 mock 回退分支、部署脚本中的 SSH 明文密码。
- `suqian-dashboard`：有效改动（`ltciArchive.ts` 参保档案、长护险监管屏、宿迁部署脚本、"在册恒为 3 台"云扫描红线）合回 `anqiao-dashboard` 后，整仓归档。
- 两个 dashboard 仓的 `docs/API-CONTRACT.md` 已降级为指向本仓的指针（不再独立演进）。

**文档归属**：全部 Spec（PLATFORM/API-CONTRACT/LTC/DOMAIN-GLOSSARY/ACCOUNT-MATRIX/INTEGRATION）只在本仓 `docs/` 维护；dashboard 仓 README 链接至本仓。

---

## 4. 大屏数据源切换规范

1. **接入方式**：大屏前端统一经 `src/api/http.ts` 发起请求，`BASE = import.meta.env.VITE_API_BASE ?? ''`（同源相对），生产由 nginx 同源反代至 console server；不再自带任何后端进程。
2. **鉴权**：复用 `POST /v1/auth/login` + `Authorization: Bearer`，WS 握手 `?token=`；token 存储 key 沿用 `anqiao_saas_token`（现状已一致，无需迁移）。电视墙类无人值守大屏的鉴权形态见 §9 未决项 1，在决策前大屏可继续使用**显式 mock 开关**构建。
3. **切换顺序（按 console 实现就绪度）**：
   - 第一批（console 已实现，直接切换）：`/v1/overview`、`/v1/alerts`(+claim/handle)、`/v1/shift`、`/v1/geo/*`、`/v1/patients`、`/v1/ws`。
   - 第二批（✅ console 已实现）：`/v1/floors`、`/v1/wards`、`/v1/beds`、`/v1/stats/*`、`/v1/project/config`（见 API-CONTRACT §3.1）。
4. **空态与红线**：后端未提供的数据一律显示 `null`/「未获取」，**严禁编造数字**（对齐 PLATFORM-SPEC §12 报告来源声明）；宿迁侧"在册设备恒为 3 台"、云扫描"只比对不写回"为业务红线，迁入配置后保持不变。
5. **vendor/platform 租户无 mock 回退**的红线在大屏侧同样生效。

---

## 5. 项目配置化（凯健 / 宿迁合一）

宿迁与凯健的差异**全部收敛为项目配置**，禁止再以代码分叉承载。目标机制：构建期 `VITE_PROJECT` 选择配置包；运行期配置由后端 `/v1/project/config` 下发（目标态，过渡期以构建期为准）。

| 配置项 | kaijian（凯健） | suqian（宿迁） |
|---|---|---|
| base 路径 | `/dash/` | `/suqian-dash/` |
| 项目标题 | 凯健护理院安守护驾驶舱 | 宿迁医保局长护险首批试点 |
| 设备台账来源 | 演示台账（9 台） | 试点台账（**恒为 3 台**：ASH01086/ASH01078/ASH01092） |
| 多机构切换 | 保留 | 关闭（单一项目） |
| 长护险参保档案面板 | 关 | 开（`ltciArchive` 数据源；未获取字段恒为 null） |
| 长护险监管屏（第六屏） | 关 | 开（评估+服务两阶段闭环、防骗保模型 M1-M4；未对接数据标「待医保局平台对接」） |
| 云扫描 | 默认可写回 | **只比对不写回**（红线） |

> 业务数据（台账、档案）最终应入 console 数据层按租户下发（阶段四）；本表是前端配置期的过渡形态，字段口径以 API-CONTRACT 为准。

### 5.1 项目配置包（构建期实现，v0.1 补充）

构建期 `VITE_PROJECT=kaijian|suqian` 选择 `src/projects/<id>/` 配置包；运行期 `/v1/project/config`（✅）就绪后优先吃后端下发。配置包导出：

| 键 | 类型 | kaijian | suqian | 说明 |
|---|---|---|---|---|
| `projectId` | `'kaijian'\|'suqian'` | `kaijian` | `suqian` | |
| `projectTitle` | string | 凯健护理院安守护驾驶舱 | 宿迁医保局长护险首批试点 | 文档标题/顶栏 |
| `basePath` | string | `/dash/` | `/suqian-dash/` | 同 VITE_BASE |
| `multiOrg` | boolean | `true` | `false` | 多机构切换；false 时锁定单一项目 |
| `ltciArchivePanel` | boolean | `false` | `true` | 参保档案面板（ltciArchive 数据源，未获取恒 null） |
| `ltciScreen` | boolean | `false` | `true` | 第六屏长护险监管屏 |
| `cloudScanMode` | `'writable'\|'compare_only'` | `writable` | `compare_only` | **红线**：suqian 只比对不写回 |
| `devices` | `AnqiaoDevice[]` | 演示台账 | 试点台账（**恒 3 台** ASH01086/ASH01078/ASH01092） | 在册台账唯一来源 |
| `orgs` | `OrgProfile[]` | anqiao+kaijian | 仅 anqiao（试点） | |
| `geo` | `CityHierarchy[]` | 苏州/上海层级 | 宿迁试点层级 | |

数据模块（`anqiaoDevices`/`orgData`/`geoHierarchy`/`profileData`/`ltciArchive`）按包分置 `src/projects/<id>/`，`src/projects/index.ts` 按 `__VITE_PROJECT__` 统一再导出；共享件（china.json 等）留在 `src/assets/`。

---

## 6. 安全基线（清退清单）

以下各项为既有缺陷的登记与处置要求；代码修改日间进行，部署随所属阶段窗口执行。

| # | 缺陷 | 位置 | 处置 |
|---|---|---|---|
| 1 | 硬件云兜底账号 `admin/123456` 与长期 JWT 硬编码于前端 | `*/src/api/hardwareApi.ts:91-93` | 立即吊销该 token、修改平台密码；前端删除硬编码；目标态由 console 服务端持有凭据（阶段四）。**代码已实施（stage4）**：大屏改走 `/v1/hardware/*`，凭据仅服务端 `HW_*`；**运维待办：吊销旧 token、轮换平台口令** |
| 2 | 生产服务器 SSH 明文密码硬编码 | `deploy_production.py`、多个 `scripts/*.py` | 改为 SSH 密钥/agent，凭据移出仓库。**已实施**：各仓 `ssh_auth.py`（密钥/agent，`SSH_KEY_PATH` 可选），sudo 走 `sudo -n`（目标机需 NOPASSWD） |
| 3 | `TOKEN_SECRET` 存在开发默认值 | `server/index.js` | 移除默认值，未注入时启动即失败；密钥由 systemd EnvironmentFile 注入。**已实施**：`TOKEN_SECRET` 与 `SEED_ACCOUNT_PASSWORD` 均未注入即拒绝启动 |
| 4 | 登录页直接展示预设账号与初始密码 | `src/views/console/ConsoleLogin.vue` | 移除展示；种子账号密码统一轮换（现状统一 `2026`）。**已实施**：登录页预设账号面板/初始密码提示已撤；种子口令不再入库，统一由 env `SEED_ACCOUNT_PASSWORD` 注入（测试用随机口令），上线后运维侧轮换该环境变量值 |
| 5 | 密码哈希为固定 salt scrypt | `server/seed.js` | 阶段四升级为 argon2id + 随机 salt。**已实施（stage4）**：`upgradeSeedPasswordHashes` + `verifyPassword` 兼容 argon2id/scrypt |
| 6 | CORS 白名单硬编码 | `server/index.js` | 改为环境变量配置，加入大屏/宿迁部署域名 |

---

## 7. 切换窗口与回滚规范

### 7.1 日间（06:00–23:00）允许动作白名单

- 只读操作、本地/测试环境开发与构建、代码提交、Spec 与文档修订。
- **新增式**静态部署：新路径、新文件名的静态产物上传（如 `/dash-v2/`），不动任何在服 nginx 块。
- 对已影子运行的新后端做只读接口验证（GET/WS 观察），不做写操作压测。

### 7.2 夜间窗口（23:00–06:00）操作规范

1. 操作前：备份涉及的全部 nginx 配置块（带时间戳归档）；确认旧静态目录、旧 service 文件在位。
2. 操作中：每步执行后立即 curl 验证关键路径（`/`、`/v1/overview` 健康检查、WS 握手）。
3. 操作后：留守观察 ≥15 分钟；写好当日变更记录（窗口、动作、验证结果、回滚触发条件）。
4. 次日白天：用户验收；验收不过则在下一窗口回滚。

### 7.3 回滚标准动作

- 静态站点：nginx 块指回旧目录并 reload（旧目录自切换之日起保留 ≥7 天）。
- 后端：`systemctl stop` 新 unit、`start` 旧 unit（旧 unit 文件在阶段三验收前只停不删）。
- 回滚决策时限：发现核心页面不可看 ≥10 分钟即触发，不得带病观察过夜。

---

## 8. 分阶段迁移计划

| 阶段 | 内容 | 窗口需求 | 状态 / 验收结论 |
|---|---|---|---|
| 〇 文档与止血 | 本 Spec + API-CONTRACT 生效；安全清退代码改动（移除明文 SSH / 硬件云硬编码） | 部署随阶段一窗口 | ✅ **已验收**（凭据零落盘，代码已合入） |
| 一 后端影子上线 | console server 以 `anqiao-console.service:2831` 部署；nginx 新增 `/v1/` 反代；旧 2830 保持 | **窗口 A** | ✅ **已验收**（c9a81f3 验证通过，`/v1/` 统一反代就绪） |
| 二 凯健大屏纯前端化 | dashboard 仓剥离控制台代码，接 `/v1` 首批接口；发布至 `/dash/` | **窗口 B**（切换）、窗口 C（目录转备） | ✅ **已验收**（a212bca 验证通过，大屏纯前端化上线） |
| 三 宿迁合流与下线 | 宿迁配置合回 dashboard，发布至 `/suqian-dash/` 补 `/v1` 反代；下线旧 `2830` | **窗口 D** | ✅ **已验收**（e8aba39 验证通过，旧服务已停，端口释放） |
| 四 数据层生产化 | console 启用 SQLite 持久化（Node 22 WAL 模式）；服务端对接硬件云代理；口令升级 argon2id | **窗口 E** | ✅ **已验收**（f191d55 验证通过，数据落盘不丢，凭据服务端托管） |
| 五 技术治理与性能优化 | 前端 9 工作台异步懒加载分包、SQLite 定时快照冷备、大屏历史分叉归档 | 日间构建 / 运维配置 | 规划实施中（见 §8.5） |

> 各阶段窗口动作严格串行，一个窗口只做一件事，降低回滚复杂度。

**进度备忘（2026-09-24 验收基线）**：
- **阶段〇至四已全量实施并通过验收**：华为云生产机（`anqiao.aibrain.wiki`）已处于目标拓扑运行态（Node 22 + SQLite 持久化，监听 2831 端口，旧 2830 服务已停用）。
- **长护险工作台全链路就绪**：`LTC-WORKBENCH-SPEC.md` 阶段 A–D 已全部完成实施与测试验证，67/67 单元与集成测试通过，构建 0 错误。
- **双端底座职责固定**：`anqiao-console/server/` 正式作为 `anqiao-console`、`suqian-dashboard` 和 `anqiao-dashboard` 的统一直属后台底座。

---

### 8.5 阶段五：技术治理与性能优化（Phase 5 落地规范）

#### 8.5.1 前端代码分包与懒加载（解决单 Chunk 1.44MB 警告）
1. **现状与瓶颈**：当前生产打包 `dist/assets/index-*.js` 体积达 1.44MB（gzip 后 501KB），主要由于 9 大角色工作台组件（`workspaces/*App.vue`）和大型可视化库（`echarts`）全部内联在同一个主入口 Chunk。
2. **治理改造规范**：
   - **工作台组件异步化**：在 `WorkspaceShell.vue` 中将 9 个工作台组件改为 `defineAsyncComponent(() => import('./workspaces/xxx.vue'))`，实现不同角色登录后仅下载自身所需的工作台代码。
   - **Rollup manualChunks 配置**：在 `vite.config.ts` 中显式划分：
     - `vendor-vue`: `['vue']`
     - `vendor-charts`: `['echarts']`
     - `vendor-common`: 共享工具库与 API 客户端
   - **消除混用导入警告**：规范 `src/api/http.ts` 导入路径，消除动态与静态混入告警。
   - **质量门禁指标**：主 Chunk gzip 体积降至 150KB 以内，任一异步分包解压体积不得超过 350KB。

#### 8.5.2 SQLite 生产持久化与冷备运维策略
1. **环境门禁**：生产环境必须确保 `DATA_LAYER=sqlite`，且运行于 Node ≥ 22。数据库文件位置统一遵循 `DB_PATH=/home/ubuntu/anqiao-saas/server/anqiao.sqlite`。
2. **定时备份纪律**：
   - 编写定时备份任务（cron 每日 03:00 执行），执行 SQLite WAL 检查点并生成压缩快照：`anqiao.sqlite.bak-YYYYMMDD.gz`。
   - 保留策略：服务器本地保留最近 14 天备份，异常重启自动校验 DB 完整性（`PRAGMA integrity_check`）。

#### 8.5.3 大屏仓库彻底解耦与归档
1. **suqian-dashboard 归档**：宿迁长护险试点大屏（在册恒 3 台、比对不写回）已完整合流至生产构建体系，`suqian-dashboard` 仓库即日起设为只读归档，不再接收代码提交。
2. **大屏纯前端化落地**：大屏仓库中已不再演进的旧控制台页面（`src/views/console/`）应全量剔除，严格维持纯前端无状态消费底座 `/v1` 的架构边界。

---

## 9. 状态决议（Resolved & Open Items）

| # | 项 | 状态 | 决议结论 |
|---|---|---|---|
| 1 | 电视墙大屏的鉴权形态 | 暂行 | 生产大屏前端通过专用只读 token 或同域同源访问 `/v1`；电视墙无人值守模式优先使用只读大屏会话，禁止包含业务写操作。 |
| 2 | API 入口最终口径 | **已决议** | 统一为 `/v1/` 直挂（反代至 2831），旧 `/saas/api/` 保持剥前缀兼容器平滑过渡。 |
| 3 | 硬件云数据获取方式 | **已决议** | 由服务端 `server/hw.js` 统一接管（`HW_*` 凭据），前端彻底禁用浏览器直连凭据。 |
| 4 | `suqian-dashboard` 归档 | **已决议** | 阶段三合流已验收，窗口 E 已完成验证，仓库正式归档只读。 |
| 5 | 家属端形态 | **已决议** | 自 LTC-WORKBENCH-SPEC 阶段 D 起，家属端作为可登录账号形态（`family_workspace`，数据范围 `applicant`），统一由 console 承载。 |
