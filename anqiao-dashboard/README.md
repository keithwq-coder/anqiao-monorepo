# anqiao-dashboard

凯健护理院安守护系统 · 100寸数据驾驶舱（Vite + Vue 3 + TypeScript 工程）。

从根目录单文件 `index.html` demo 迁移：四屏（全域态势 / 空间孪生 / 实时巡查 / 数字画像）已全部完成迁移。

## 目录

```
src/
  main.ts               入口
  App.vue               应用外壳：缩放引擎、顶部 header-bridge、时钟、底部导航 dock、四屏切换
  styles/global.css     从单文件 demo 原样搬入的全部样式（含 :root 设计令牌，勿拆分改写）
  api/
    types.ts            数据模型（依据 docs/API-CONTRACT.md §2，另含设备/统计/画像扩展类型）
    client.ts           接口函数签名 —— 当前全部委托 mock.ts，切真后端只改这一个文件
    mock.ts             确定性伪随机 mock：87 位长者 / 96 张床位 / 4 条当前告警，各屏数据对账一致
  views/
    ScreenOverview.vue  全域态势屏（screen-1：KPI / IoT 甜甜圈 / 风险曲线 / 分诊流水 / 人口谱系 / 排行榜）
    ScreenTwin.vue      空间孪生屏（screen-0：楼层平面 SVG + 热力 canvas / 告警调度流水线 / 护理负荷）
    ScreenPatrol.vue    实时巡查屏（screen-2：87 体征 pod 卡 + ECG 波形）
    ScreenProfile.vue   数字画像屏（screen-3：五卡画像 / 离床矩阵 / 作息规律 / 长者切换）
  components/
    FloorPlan.vue       空间孪生楼层平面 SVG（房间/床位/卫浴/护士站/动效）
docs/API-CONTRACT.md    前后端数据契约（数据层唯一依据）
```

## 命令

```bash
npm install
npm run dev     # 开发
npm run build   # 类型检查 + 构建到 dist/
```

## mock 与真后端切换

所有组件只 import `src/api/client.ts`。当前 `client.ts` 每个函数直接委托给 `mock.ts`；
联调时将各函数改为 fetch 业务后端 REST（见 `docs/API-CONTRACT.md` §3），组件无需改动。

mock 数据在浏览器 console 中以 `[MOCK]` 前缀打印，便于识别。

## 说明

- 1920×1080 画布由 `App.vue` 中的等比缩放引擎适配任意屏幕（500ms 轮询校正 + 像素级 translate）。
- 原 demo 中约 800KB 的 base64 全息人体图未迁移，数字画像屏中央为占位（"全息画像图（后续替换）"），后续提供图片资源后替换 `ScreenProfile.vue` 中的占位 div。
- 自动巡航默认关闭，可在右下角"巡航"开关打开（14s/屏）。
- 数字画像屏支持 ←/→ 方向键切换长者；输入框聚焦时按键被忽略（键盘守卫）。
## 管理端控制台（已拆分至独立仓库）

> **⚠️ 管理端 SaaS 控制台已拆分到独立仓库 [`anqiao-console`](../anqiao-console)
> （前端 + 零依赖 Node 后端），后续在那边维护，本仓库不再演进该部分。**
>
> 控制台仅依赖本仓库 `docs/API-CONTRACT.md` 与共享的 mock 口径，二者已复制过去保持一致。

下文为拆分前原样保留的切片说明，仅作历史参考：围绕护理院值班工作流组织
值班工作台 → 告警中心 → 长者监护。

### 启动

```bash
npm run server   # 后端：127.0.0.1:8080（env PORT 可改，TOKEN_SECRET 注入令牌密钥）
npm run dev      # 前端：vite dev，/v1 已代理到 8080（含 WebSocket）
```

访问 `http://localhost:5173/dash/#/console`（根路径自动重定向到 `/dash/`），登录后默认进值班工作台。
不带 hash 或 `#/console` 之外的 hash 仍是原有大屏，两者互不影响（控制台挂载时通过
`body.console-mode` 解除大屏的滚动锁定，切回大屏自动还原）。

### 演示账号（首次交付默认密码 `2026`，上线前必须修改）

| 账号 | 姓名 | 租户 |
|---|---|---|
| `nurse01` | 李晓芳 护士 | 凯健护理院（87 长者 / 96 床位 / 17 条今日告警） |
| `admin01` | 王院长 | 凯健护理院 |
| `ops01` | 运营管理员 | 中科安樵（厂商自营，9 台在册 AI健康守护仪） |

### 控制台模块（hash 子路由）

- **值班工作台** `#/console/dashboard`：待办告警区（triggered+handling，按级别与发生时间排序，
  SLA 响应计时：1 级 3 分钟 / 2 级 10 分钟 / 3 级 30 分钟，超时红色标记；接单/处置就地完成）、
  今日概览 KPI（今日告警/已闭环/闭环率/平均响应时长/在床率）、班次卡（当前班次/当值护理组/上一班遗留）、
  重点关注长者（当前异常，点击进详情）。
- **告警中心** `#/console/alerts`：状态分组 tab（待响应/处理中/已闭环/全部，带数量角标）+ 级别筛选 +
  分页；行内 SLA 计时、接单人、处置人、耗时与操作按钮。
- **长者监护** `#/console/patients`：楼层筛选 chips + 状态筛选 + 姓名/床位搜索共存，异常长者优先排序；
  卡片含护理等级徽章、在床/离床状态点、异常徽章，实时体征推送就地更新。
  详情页 `#/console/patients/:id`：基本信息、近 24h hr/br/tp inline SVG 曲线、睡眠摘要、慢病标签、告警历史。

### 告警状态机（先接单再处置）

`triggered 待响应 → (POST /claim) handling 处理中 → (POST /handle) handled 已闭环`，终态 `missed 已超时`。
仅 triggered 可接单、仅 handling 可处置，其余分支返回 400；handled 告警带完整 occurred → claimed → handled 链路。

### 真实接口与切片边界

- **真实接口**（`server/index.js`）：`POST /v1/auth/login`、`GET /v1/overview`、`GET /v1/alerts`、
  `POST /v1/alerts/{id}/claim`、`POST /v1/alerts/{id}/handle`、`GET /v1/patients`、
  `GET /v1/patients/{id}`、`GET /v1/shift`、`GET /v1/ws`（WebSocket）。
- **统一约定**：响应包 `{code,msg,data}`；Bearer 令牌 = base64url 三段 + HMAC-SHA256（8h）；
  tenant_id 后端从令牌解析；登录限速同 IP 60s 失败 ≥5 次锁 10 分钟；跨租户访问他人数据 404。
- **WebSocket** `/v1/ws?token=...`：手写 RFC6455。按租户推送 `vitals`（每 3s 1-3 床位）、
  `alert`（每 45-75s 新告警真实写入，REST 可查；`WS_ALERT_FAST=1` 缩到 5-8s 供冒烟）、
  `overview`（30s 或指标变化时）。前端 `src/api/realtime.ts`：指数退避重连 + 重连后 REST 全量补偿，
  新告警顶部 toast + 待办区/列表实时插入，顶栏有实时连接状态点。
- **仍为 mock**：大屏其余数据（楼层/床位/统计/排行/画像扩展等）继续走 `src/api/mock.ts`；
  `src/api/client.ts` 中已接真的函数在持有 token 时走真实 API，未登录维持 mock。
- 后端为内存态，重启数据重置（种子确定性生成）。
- **WS 冒烟**：`WS_ALERT_FAST=1 npm run server` 后另开终端 `node server/test-ws.mjs`（Node >= 22 全局 WebSocket）。

### 生产化待办（参考 wiki SPEC §1/§2）

- 内存态 → 数据库（租户/账号/告警/处置记录持久化）
- scrypt（固定 salt 种子）→ argon2id + 随机 salt
- HMAC 对称令牌 → 平台 JWT 体系对齐，TOKEN_SECRET 必须经 env 注入；WS 握手 token 由 query 改子协议或首帧鉴权
- HTTP → HTTPS；登录限速内存 Map → Redis 共享存储；审计日志；WS 多实例发布订阅

### 生产部署（anqiao.aibrain.wiki）

- **入口**:`https://anqiao.aibrain.wiki/saas/`（控制台 `#/console`)，演示账号 `nurse01` / `admin01` / `ops01`，密码统一 `2026`（交付默认值，需改）。
- **架构**:nginx vhost `anqiao`(443)内：`location /saas/` → alias 静态目录 `/var/www/anqiao-saas/`;
  `location /saas/api/` → 反代 `http://127.0.0.1:2830/`（含 WS Upgrade,`proxy_read_timeout 3600s`);
  与官网 `/`(Next.js:2828)、大屏 `/dash/`（静态 `/var/www/anqiao-dash/`）并存互不影响。
- **后端**：零依赖 Node（服务器 Node 20),systemd 单元 `anqiao-saas.service`
  (`ExecStart=/usr/bin/node /home/ubuntu/anqiao-saas/server/index.js`,`PORT=2830`,
  `TOKEN_SECRET` 强随机注入,`Restart=always`,`User=ubuntu`)。内存态，`sudo systemctl restart anqiao-saas` 即回种子态。
- **前端构建**:`MSYS_NO_PATHCONV=1 VITE_BASE=/saas/ VITE_API_BASE=/saas/api npm run build`
  （Git Bash 需 `MSYS_NO_PATHCONV=1` 防止 `/saas/` 被路径转换）；默认 `npm run build` 仍是 `/dash/` 大屏构建。
- **更新流程**：本地生产构建 → `scp` dist 到 `/var/www/anqiao-saas/`、server/ 到 `/home/ubuntu/anqiao-saas/`
  → `sudo systemctl restart anqiao-saas`（仅改前端则无需重启）。nginx 改动前先备份
  （已存 `/etc/nginx/sites-available/anqiao.bak-20260920-saas`),`sudo nginx -t && sudo systemctl reload nginx`。

### 厂商自营运营视角（中科安樵）

- **数据主角扩展**：新增 `anqiao` 租户（kind=`vendor`，中科安樵·自营运营中心）。anqiao 为厂商自营视角：
  9 台真实在册 AI健康守护仪，全部部署苏州，经华为云 IoTDA 直连上报数据；
  凯健护理院仅表述为"合作建设中"。护理院租户（凯健，kind=`nursing_home`）体验不变。
- **矢量地图资产**：`scripts/build-china-map.mjs`（可重复执行）读取 DataV GeoAtlas
  `100000_full.json`（已存 `tmp_china.json`），Douglas-Peucker 抽稀至 2486 点，投影=经度线性+纬度×cos(35°)，
  输出 `src/assets/chinaMap.ts`（34 省 path + 城市投影坐标 + 南海诸岛十段线独立 path/bbox，右下角插图渲染）。
- **地图组件**：大屏端 `src/components/TechChinaMap.vue`、控制台端 `src/components/FlatChinaMap.vue`，
  均基于 ECharts + `src/assets/china.json`，按 orgId / 城市数据渲染设备分布与告警热力。
- **大屏第五屏** `ScreenNation.vue`（`screen-4` 全国态势，dock 与巡航已同步）：TechChinaMap + 全国 KPI
  + 城市排行；大屏无登录态，走 `mock.ts` 同构厂商数据（`getNationOverview/getNationCities/getNationDevices`）。
- **控制台厂商工作台**（ops01 登录）：侧边栏按租户 kind 分流 —— 厂商[全国地图(默认)/设备管理/告警中心]，
  护理院[值班工作台/告警中心/长者监护]；顶栏多租户切换器为条件渲染框架（本期账号均单租户）。
- **新接口**（契约 §3）：`GET /v1/geo/cities`、`GET /v1/geo/devices?city=`（geo 接口仅 vendor 租户可访问，其余 403）；
  登录响应 tenant 加 `kind`；Overview 加 `city_count`；Alert 加 `city`/`customer`。
- **账号**：`ops01` / 运营管理员（anqiao 租户），密码 `2026`（交付默认值，需改）。
