# anqiao-console

中科安樵 · 安守护 综合业务底座与 SaaS 管理控制台（Vite + Vue 3 + TypeScript + 零依赖 Node 后端）。

本系统承载两大核心职责：
1. **多机构 SaaS 管理平台**：提供 9 大角色专属工作台（系统超管、医保监管、长护经办、现场评估、机构运营、值班护士、厂商运营、设备监控、合作伙伴与家属端），承载长护险全闭环工作流、设备生命周期与实时告警处置。
2. **全系统唯一业务底座与后台**：作为 `suqian-dashboard`（宿迁长护险 100 寸驾驶舱）和 `anqiao-dashboard`（凯健/全国态势看板）的唯一直属后端与数据中枢，提供统一的 REST `/v1` 契约（楼层、病区、床位、体征、画像统计、项目元配置）与 WebSocket 实时推送。

> 架构拓扑与部署基线见 `docs/INTEGRATION-SPEC.md`；多组织与平台承载见 `docs/PLATFORM-SPEC.md`；利益相关方工作台规格见 `docs/LTC-WORKBENCH-SPEC.md`；数据层契约见 `docs/API-CONTRACT.md`。

## 目录

```
server/                   多租户后端（零依赖，node >= 18）
  index.js                http + websocket 服务（认证/告警状态机/体征推送）
  seed.js                 种子数据（凯健护理院 + 中科安樵厂商租户）
  store.js                内存态存储
  test-ws.mjs  WS 冒烟脚本
src/
  main.ts                 入口：直接挂载控制台（无大屏分流）
  styles/console.css      浅色品牌风控制台样式（设计令牌自带，独立于大屏）
  views/console/          控制台视图（hash 子路由）
    ConsoleApp.vue        外壳：侧边栏/顶栏/会话/实时通道/子路由
    ConsoleLogin.vue       登录（POST /v1/auth/login）
    ConsoleDashboard.vue  值班工作台
    ConsoleAlerts.vue     告警中心（状态机：triggered→handling→handled）
    ConsolePatients.vue   长者监护
    ConsolePatientDetail.vue 长者详情（24h 曲线/睡眠/慢病/告警历史）
    ConsoleNation.vue     全国地图（厂商租户）
    ConsoleDevices.vue    设备管理（厂商租户）
  components/FlatChinaMap.vue  控制台端 ECharts 全国矢量地图
  api/
    client.ts             接口唯一入口（已登录走真实后端，失败回退 mock 兜底）
    http.ts               REST 客户端 + 令牌会话（同源相对路径，VITE_API_BASE 可覆盖）
    realtime.ts           WebSocket（指数退避重连 + 重连后 REST 全量补偿）
    mock.ts               凯健护理院演示口径兜底 mock
    types.ts              数据模型（依据 docs/API-CONTRACT.md）
docs/API-CONTRACT.md      前后端数据契约（数据层唯一依据）
```

## 命令

```bash
npm install
npm run server   # 后端：127.0.0.1:8080（env PORT / TOKEN_SECRET / SEED_ACCOUNT_PASSWORD / WS_ALERT_FAST 可配）
npm run dev      # 前端：vite dev，/v1（含 WebSocket）已代理到 8080
npm run build    # 类型检查 + 构建到 dist/
```

访问 `http://localhost:5173/saas/`（开发；生产基路径 `/saas/`，可经 `VITE_BASE` 覆盖）。

### 账号矩阵（初始密码由部署环境变量 `SEED_ACCOUNT_PASSWORD` 注入，**上线后必须立即修改**）

| 账号 | 角色 | 姓名 | 组织 |
|---|---|---|---|
| `su01` | `su` 超级管理员 | 超级管理员 | 系统组织 |
| `admin01` | `admin` 机构管理员 | 中科安樵管理员 | 中科安樵组织 |
| `user01` | `user` 机构普通用户 | 设备监控用户 | 中科安樵组织 |
| `medical01` | `medical_insurance_staff` 医保局监管 | 医保局监管人员 | 医保局组织 |
| `insurer01` | `insurer_staff` 长护险经办 | 太平洋保险经办人员 | 太平洋保险组织 |
| `assessor01` | `assessor` 失能评估 | 长护险评估人员 | 评估机构（太平洋保险关联）组织 |

> 完整权限与数据范围见 `docs/ACCOUNT-MATRIX.md`。`family_contact` 为联系人实体、**非登录账号**。
> 旧账号 `nurse01` / `ops01` / `hq01` 已移除，登录将失败；账号一账号一组织，已取消跨租户切换白名单。

### 控制台模块（hash 子路由）

- **值班工作台** `#/console/dashboard`：待办告警区（triggered+handling，SLA 响应计时 1/2/3 级 3/10/30 分钟，超时红色标记；接单/处置就地完成）、今日概览 KPI、班次卡、重点关注长者。
- **告警中心** `#/console/alerts`：状态分组 tab + 级别筛选 + 分页；行内 SLA 计时与接单/处置按钮。
- **长者监护** `#/console/patients`：楼层/状态筛选 + 搜索，异常长者优先；详情页含近 24h hr/br/tp 曲线、睡眠摘要、慢病标签、告警历史。
- **全国地图 / 设备管理**（厂商租户）：ECharts 全国矢量地图（`FlatChinaMap`）渲染设备分布与告警热力 + 设备清单。

### 告警状态机（先接单再处置）

`triggered 待响应 → (POST /claim) handling 处理中 → (POST /handle) handled 已闭环`，终态 `missed 已超时`。
仅 triggered 可接单、仅 handling 可处置；handled 告警带完整 occurred → claimed → handled 链路。

### 后端接口（server/index.js）

`POST /v1/auth/login`、`GET /v1/overview`、`GET /v1/alerts`、`POST /v1/alerts/{id}/claim`、
`POST /v1/alerts/{id}/handle`、`GET /v1/patients`、`GET /v1/patients/{id}`、`GET /v1/shift`、
`GET /v1/geo/cities`、`GET /v1/geo/devices`（geo 仅 vendor 租户）、`GET /v1/ws`（WebSocket）。

统一约定：响应包 `{code,msg,data}`；Bearer 令牌 = base64url 三段 + HMAC-SHA256（8h）；`tenant_id`
后端从令牌解析；登录限速同 IP 60s 失败 ≥5 次锁 10 分钟；跨租户访问他人数据返回 404。
WebSocket `/v1/ws?token=...` 按租户推送 `vitals`（3s）、`alert`（45-75s 真实写入，`WS_ALERT_FAST=1` 缩至 5-8s）、`overview`（30s）。

mock 兜底：控制台未登录或真实接口失败时读接口回退 `src/api/mock.ts`，vendor 租户数据域与护理院严格隔离
（不回退、走空态/错误态，避免虚构长者数据串租户泄漏）。

## 生产化待办

- 内存态 → 数据库（租户/账号/告警/处置记录持久化）
- scrypt → argon2id + 随机 salt
- HMAC 对称令牌 → 平台 JWT 体系对齐，`TOKEN_SECRET` 必须经 env 注入；WS 握手 token 由 query 改子协议/首帧鉴权
- HTTP → HTTPS；登录限速内存 Map → Redis；审计日志；WS 多实例发布订阅