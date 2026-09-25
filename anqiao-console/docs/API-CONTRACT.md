# 安守护护理院系统 · API 数据契约 v0.3

> 状态：基线（v0.2 起作为三仓整合的唯一接口契约生效；v0.3 补齐实现态路由与项目配置下发）
> 日期：2026-09-23（v0.1：2026-09-19；v0.2：2026-09-23）
> 读者：后端、前端工程师
> 原则：**界面上的每个数字必须有且仅有一个来源**；本契约是前后端联调的唯一依据，字段变更必须改文档再改代码。
> v0.2 变更：①明确唯一业务后端为 `anqiao-console/server`，大屏与管理控制台均为纯前端消费方（仓库拓扑/部署/切换窗口以 `docs/INTEGRATION-SPEC.md` 为唯一来源）；②新增 §3.1 路由实现状态索引；③§5 补充硬件云凭据服务端化的目标态口径。
> v0.3 变更：①登录/切换响应补齐 `workspace`/`principal`/`permissions`/`data_scope`；②§3.2 固化设备资产与合作伙伴渠道字段（原 🆕）；③§3.3 定义 `GET /v1/project/config`（对齐 INTEGRATION-SPEC §5.1）；④§3.4 列出 `/v1/ltc/*` 已实现路由全集（流程细节仍以 `LTC-INSURANCE-SPEC` 为唯一来源）；⑤§7 标注授权/工作台实现态；⑥Data Scope 补 `channel`。

---

## 1. 总体结构

```
硬件设备 → 安樵平台 API（现有，api.health-track.anqiaokj.com）
                ↓ 数据同步/聚合（目标态：业务后端服务端持有凭据，见 §5）
        护理院业务后端（= anqiao-console/server，本契约定义）
                ↓ REST + WebSocket
        管理控制台前端 / 凯健大屏 / 宿迁大屏 / 家属端（预留）
```

- 设备原始数据（心率/呼吸/体温/在床/睡眠）继续走**安樵平台现有 API**，业务后端消费平台数据（推送或定时拉取），不在本契约重复定义。
- 本契约定义业务后端对上层应用提供的 **B 端（护理院维度）聚合 API**：护理院 → 楼层 → 专区 → 床位 → 长者 → 设备，以及实时推送通道。
- **上层消费方一律为纯前端**：大屏、控制台、家属端不得自带后端服务或业务数据种子，全部经本契约接入；mock 数据仅限本地开发显式开关（纪律见 INTEGRATION-SPEC 硬性基线 5）。
- 鉴权复用平台机制：登录获取 JWT Bearer，令牌有效期以平台为准；请求头 `Authorization: Bearer {token}`。
- 多租户：所有业务接口隐含当前登录账号所属护理院（`tenant_id`），由后端从令牌解析，**前端不传递租户参数**。

## 2. 数据模型

### 2.1 核心实体关系

```
护理院 Tenant ─┬─ 楼层 Floor ─┬─ 专区 Ward（认知障碍/术后康复/…）
               │              └─ 床位 Bed ── 长者 Patient ── 设备绑定 DeviceBinding
               ├─ 员工 Staff（护士/医生）
               └─ 告警 Alert ── 处置记录 AlertHandle
```

- `Bed` 与 `Patient` 为当前入住关系（可空置）；`Patient` 与设备为绑定关系（`device_id` 对应平台设备）。
- 床位号是全局唯一业务键，如 `404-A`。

### 2.2 字段定义

**Bed（床位）**

```json
{
  "bed_id": "404-A",
  "floor": "4F",
  "ward": "完全失能专区",
  "status": "occupied | vacant",
  "patient_id": "P00084",
  "device": { "device_id": "HG2024xxxx", "type": "health_guardian", "online": true, "last_data_time": "2026-09-19T18:20:00+08:00" }
}
```

**Patient（长者，列表/卡片视图用）**

```json
{
  "patient_id": "P00084",
  "name": "孙*某",            // 界面脱敏由后端输出，前端不再处理
  "gender": "male | female",
  "age": 84,
  "care_level": "特级护理 | 一级护理 | 二级护理",
  "ward": "完全失能专区",
  "bed_id": "404-A",
  "nurse": "李晓芳 护士",
  "doctor": "孙医生（主治）",
  "vitals": {                 // 最新一条，来源于平台 hardware/latest_data
    "hr": 94, "br": 22, "tp": 36.9,
    "in_bed": false,
    "body_movement": 1,
    "recorded_at": "2026-09-19T18:20:00+08:00"
  },
  "abnormal": { "fall": true, "types": ["fall"] }   // 当前处于告警状态的类型，无则 null
}
```

**Alert（告警）**

```json
{
  "alert_id": "A10231",
  "bed_id": "404-A",
  "patient_id": "P00084",
  "type": "fall | off_bed | hr | br | tp",
  "level": 1,                 // 1=紧急 2=中危 3=关注
  "status": "triggered | handling | handled | missed",
  "title": "卫浴跌倒预警",
  "detail": "毫米波雷达监测姿态突变…",
  "occurred_at": "2026-09-19T03:22:15+08:00",
  "claimed_by": "李晓芳 护士",
  "claimed_at": "2026-09-19T03:22:40+08:00",
  "handled_by": "李晓芳 护士",
  "handled_at": "2026-09-19T03:23:03+08:00",
  "handle_note": "到场排查，体征平稳，已双人过床",
  "city": null,               // 厂商租户：告警所属城市（护理院租户为 null）
  "customer": null            // 厂商租户：设备所属客户机构（护理院租户为 null）
}
```

告警状态机：`triggered 待响应 → (接单 claim) handling 处理中 → (处置 handle) handled 已闭环`，以及终态 `missed 已超时`。
`handled` 的完整链路为 occurred → claimed → handled（三个时间点齐备）；SLA 目标响应时间：1 级 3 分钟 / 2 级 10 分钟 / 3 级 30 分钟。

**Overview（大屏顶部 KPI，全部实时计算，禁止前端硬编码）**

```json
{
  "device_total": 248,
  "device_online": 247,
  "device_online_rate": 99.6,
  "patient_total": 87,
  "patient_male": 41,
  "patient_female": 46,
  "bed_occupied": 87,
  "bed_total": 96,
  "alerts_today": 17,
  "alerts_closed_today": 17,
  "in_bed_count": 44,
  "in_bed_rate": 50.6,
  "generated_at": "2026-09-19T18:53:00+08:00"
}
```

## 3. REST 接口

统一响应包：`{ "code": 200, "msg": "ok", "data": ... }`，错误码与平台对齐（400/401/403/404/500）。时间一律 ISO 8601 东八区。

| 方法 | 路径 | 说明 | 关键参数 |
|---|---|---|---|
| POST | `/v1/auth/login` | 登录获取令牌，body `{username, password}`。成功返回 `{token, staff:{name, role}, tenant:{tenant_id, name, kind}, workspace, principal, permissions, data_scope}`（`kind`: `vendor` 厂商 / `nursing_home` 护理院 / 其他组织类型见 PLATFORM-SPEC §4；`workspace` 由角色映射见 PLATFORM-SPEC §5；`permissions` 为能力点数组；`data_scope` ∈ `global/org/assigned/pool/task/applicant/channel`）。切片实现为 HMAC-SHA256 签名令牌（8h），同 IP 60s 失败 ≥5 次锁 10 分钟（429） | `username`, `password` |
| POST | `/v1/auth/switch` | 组织内会话刷新；**已取消跨租户白名单**，目标 `tenant_id` 必须等于当前账号组织，否则 403。返回结构同 login（不含新 token 时沿用原令牌） | `tenant_id` |
| GET | `/v1/overview` | 大屏 KPI 聚合（§2.2 Overview；厂商租户返回全国设备聚合，另含 `city_count` 覆盖城市数） | — |
| GET | `/v1/floors` | 楼层列表 `[{floor, ward_count, bed_total, bed_occupied}]` | — |
| GET | `/v1/wards` | 专区列表，含护理配比/在床统计 | `floor` 可选 |
| GET | `/v1/beds` | 床位列表（含设备状态） | `floor`, `ward` 可选 |
| GET | `/v1/patients` | 长者卡片列表 | `floor`, `ward`, `status`(in_bed/off_bed/abnormal), `q`(姓名/床位号搜索), 分页 |
| GET | `/v1/patients/{patient_id}` | 长者画像详情（生命体征曲线、睡眠、慢病、告警历史） | `date` 可选 |
| GET | `/v1/alerts` | 告警列表/流水 | `status`, `level`, `date`, 分页 |
| POST | `/v1/alerts/{alert_id}/claim` | 接单：`triggered` → `handling`，记录 `claimed_by`（令牌解析）/`claimed_at`；非 triggered 返回 400 | — |
| POST | `/v1/alerts/{alert_id}/handle` | 标记处置：仅 `handling` 可处置（先接单再处置），`triggered` 直接处置返回 400 | `note` |
| GET | `/v1/shift` | 当前班次卡（切片新增）：`{shift_name, shift_range, nurses: [{name, floor}], carry_over_open}`，夜班 22:00-06:00 / 早班 06:00-14:00 / 中班 14:00-22:00 | — |
| GET | `/v1/stats/demographics` | 人口统计（性别/年龄分布/护理等级） | — |
| GET | `/v1/stats/rankings` | 三大排行榜（睡眠/跌倒风险/体征波动） | — |
| GET | `/v1/geo/cities` | 厂商租户（切片新增）：各城市聚合 `[{city, lon, lat, device_total, device_online, alerts_today, customers}]`；非厂商租户 403 | — |
| GET | `/v1/geo/devices` | 厂商租户（切片新增）：设备点 `{list: [{device_id, type, city, customer, lon, lat, online, alerting, last_data_time}], total}`；非厂商租户 403 | `city` 可选 |

设备资产、合作伙伴、项目配置与长护险路由见 §3.2–§3.4。

### 3.1 路由实现状态索引

> 大屏/控制台按本索引决定接真接口还是走显式 mock 开关（切换顺序见 INTEGRATION-SPEC §4）。状态口径：✅=console 已实现可接入；⏳=契约有效、console 待实现。v0.3 起 🆕 已清零（字段见 §3.2–§3.4）。

| 路由 | 状态 | 说明 |
|---|---|---|
| `POST /v1/auth/login`、`POST /v1/auth/switch` | ✅ | 大屏/控制台统一复用；响应含 workspace/permissions/data_scope |
| `GET /v1/overview`、`GET /v1/shift` | ✅ | 大屏第一批接入 |
| `GET /v1/alerts`、claim/handle | ✅ | 大屏第一批接入 |
| `GET /v1/patients`、`/v1/patients/{id}` | ✅ | 大屏第一批接入 |
| `GET /v1/geo/cities`、`/v1/geo/devices` | ✅ | 厂商租户大屏第一批接入 |
| `GET /v1/ws` | ✅ | vitals/alert/overview 三类推送 |
| `GET /v1/floors`、`/v1/wards`、`/v1/beds` | ✅ | 契约有效（§3 表），console 已从 seed 内存态聚合 |
| `GET /v1/stats/demographics`、`/v1/stats/rankings` | ✅ | 同上，字段见 §3 表 |
| `GET /v1/devices`、`POST /v1/devices/{id}/lifecycle`、`GET /v1/devices/lifecycle-logs` | ✅ | 设备资产域，字段见 §3.2 |
| `GET /v1/partner/channels` | ✅ | 合作伙伴渠道域，字段见 §3.2 |
| `GET /v1/project/config` | ✅ | 项目配置下发，字段定义见 §3.3；suqian `cloudScanMode=compare_only`、devices 恒 3 台 |
| `/v1/ltc/*` 长护险全家桶 | ✅ | 路由全集见 §3.4；流程/状态机以 `docs/LTC-INSURANCE-SPEC.md` 为唯一来源 |
| `GET /v1/hardware/*` 硬件云代理 | ✅ | 服务端持有凭据转发（§5.1）；浏览器不直连硬件云 |

### 3.5 硬件云服务端代理（v0.4 / 阶段四）

> 目标态：硬件云凭据仅存业务后端 env（`HW_API_BASE` / `HW_ACCOUNT` / `HW_PASSWORD` / `HW_TOKEN` / `HW_USER_ID`），上层前端只带业务 `Authorization: Bearer` 访问本表路由；**禁止**前端直连 `api.health-track.anqiaokj.com` 或持有硬件云口令/长期 JWT（INTEGRATION-SPEC §6-1、§8 阶段四）。未注入硬件云凭据时返回 503，不得静默 mock。

| 方法 | 路径 | 转发上游 | 关键参数 |
|---|---|---|---|
| GET | `/v1/hardware/devices` | `POST /api/v1/device/list` | `user_id`（默认 env `HW_USER_ID`） |
| GET | `/v1/hardware/devices/raw` | 同上（原始包，云扫描容错） | `user_id` |
| GET | `/v1/hardware/status` | `POST /api/v1/hardware/status` | `page_size`,`page_current` |
| GET | `/v1/hardware/latest` | `POST /api/v1/hardware/latest_data` | `device_id` |
| GET | `/v1/hardware/today` | `POST /api/v1/hardware/today_data` | `device_id` |
| GET | `/v1/hardware/sleep` | `POST /api/v1/hardware/sleep_stats` | `device_id`,`date` |
| GET | `/v1/hardware/report-dates` | `POST /api/v1/hardware/report_dates` | `device_id` |
| GET | `/v1/hardware/alarms` | `POST /api/v1/alarm/list` | `user_id`,`page`,`page_size` |

统一响应包 `{code,msg,data}`；`data` 为上游业务字段（或本契约包装后的列表）。权限：登录后任意有效令牌可读（与大屏/控制台既有数据域一致）；写回硬件云不在本表（suqian `cloudScanMode=compare_only` 红线不变）。

### 3.2 设备资产与合作伙伴渠道（v0.3 固化）

#### GET `/v1/devices`

查询参数：`partner`（按渠道组织过滤）、`status`（按 `lifecycle_status` 过滤）。`partner_admin` 强制只返回 `partner_org_id == 本组织` 的设备。

```json
{
  "list": [{
    "device_id": "ANCE00001",
    "sn": "ANCE00001",
    "label": "AI健康守护仪-01",
    "type": "health_guardian",
    "hardware_asset_owner": "anqiao",
    "operator_partner_id": "partner_p1",
    "procurement_channel": "direct | partner",
    "service_provider_org_id": "anqiao",
    "custodian_org_id": "anqiao",
    "monitored_subject_id": null,
    "device_placement_location": "江苏苏州…",
    "lifecycle_status": "stocked | shipped | installed | monitoring | returned | retired",
    "online": true,
    "last_data_time": "2026-09-23T10:00:00+08:00",
    "category": null, "scene": null, "assessment_usage": null,
    "lon": null, "lat": null
  }],
  "total": 1
}
```

> 七维归属模型（PLATFORM-SPEC §8.1/§9）：`hardware_asset_owner` / `operator_partner_id` / `procurement_channel` / `service_provider_org_id` / `custodian_org_id` / `monitored_subject_id` / `device_placement_location`。设备资产所有权绑定 `anqiao_ops`，不随渠道/客户转移。

#### POST `/v1/devices/{device_id}/lifecycle`

body：`{ "to_status": "<lifecycle_status>", "remark": "…", "location": "…" }`  
权限：`device:lifecycle`。非法跳跃 400；无权限 403；成功写入 `DeviceLifecycleLog` 并返回更新后的 `DeviceAsset`。

#### GET `/v1/devices/lifecycle-logs`

查询参数：`device_id` 可选。返回 `{list:[DeviceLifecycleLog], total}`：

```json
{
  "log_id": "…", "device_id": "ANCE00001",
  "from_status": "installed", "to_status": "monitoring",
  "operator_id": "user01", "organization_id": "anqiao",
  "occurred_at": "…", "location": "…", "remark": "…"
}
```

#### GET `/v1/partner/channels`

`partner_admin` 强制只返回本组织渠道。响应：

```json
{
  "partner_id": "partner_p1",
  "list": [{
    "channel_id": "CH-001",
    "partner_org_id": "partner_p1",
    "partner_name": "…",
    "developed_customers": [{ "org_id": "…", "org_name": "…", "contact": "…", "phone": "…", "devices_count": 3, "active_monitoring": 2, "created_at": "…", "referrer_partner_id": "partner_p1" }],
    "leads": [{ "lead_id": "…", "title": "…", "status": "…", "created_at": "…" }]
  }],
  "customers": [ /* 展平的 developed_customers */ ],
  "leads": [ /* 展平的 leads */ ],
  "total": 1
}
```

> 红线：`partner_*` **不见客户数据正文**（长者/体征/告警详情），仅渠道组织、设备计数与线索元数据。

### 3.3 项目配置下发（目标态）

#### GET `/v1/project/config`

按登录租户/项目下发前端配置包（构建期 `src/projects/<id>/config` 的运行期替代）。未实现前大屏继续用 `VITE_PROJECT` 构建期配置（INTEGRATION-SPEC §5.1）。

```json
{
  "projectId": "kaijian | suqian",
  "projectTitle": "凯健护理院安守护驾驶舱",
  "basePath": "/dash/",
  "multiOrg": true,
  "ltciArchivePanel": false,
  "ltciScreen": false,
  "cloudScanMode": "writable | compare_only",
  "devices": [ /* AnqiaoDevice[]，在册台账唯一来源；suqian 恒 3 台 */ ],
  "orgs": [ /* OrgProfile[] */ ],
  "geo": [ /* CityHierarchy[] */ ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `projectId` | `'kaijian'\|'suqian'` | 项目标识 |
| `projectTitle` | string | 文档标题/顶栏 |
| `basePath` | string | 部署基路径，同 `VITE_BASE` |
| `multiOrg` | boolean | 多机构切换；`false` 锁定单一项目 |
| `ltciArchivePanel` | boolean | 长护险参保档案面板 |
| `ltciScreen` | boolean | 第六屏长护险监管屏 |
| `cloudScanMode` | `'writable'\|'compare_only'` | **红线**：suqian 恒 `compare_only`（只比对不写回） |
| `devices` | `AnqiaoDevice[]` | 在册台账；suqian 恒 3 台 ASH01086/ASH01078/ASH01092 |
| `orgs` | `OrgProfile[]` | 项目内组织 |
| `geo` | `CityHierarchy[]` | 地理层级 |

权限：登录后任意有效令牌可读本项目配置；跨项目配置 404。响应须与构建期配置包字段同构，前端优先吃本接口、失败回退构建期包（**不得回退假业务数据**）。

### 3.4 长护险 `/v1/ltc/*` 路由全集（已实现）

> 流程、状态机、反欺诈门禁与验收以 `docs/LTC-INSURANCE-SPEC.md` 为唯一来源；本表只固化**路径与动词语义**，字段以该 Spec §5–§13 为准。统一 `{code,msg,data}`；列表包 `{list,total}`。

| 方法 | 路径 | 语义 |
|---|---|---|
| GET | `/v1/ltc/assessed-persons` | 被评估对象列表（按 data_scope 过滤） |
| GET | `/v1/ltc/assessed-persons/{person_id}/medical-record` | 本人病历档案 |
| GET | `/v1/ltc/medical-records` | 病历列表 |
| GET/POST | `/v1/ltc/applications` | 申请列表 / 创建申请 |
| GET/POST | `/v1/ltc/applications/{id}`、`…/submit` | 申请详情 / 提交 |
| GET/POST | `/v1/ltc/assessment-tasks`（别名 `/v1/ltc/tasks`） | 任务列表 / 派单创建 |
| GET | `/v1/ltc/assessment-tasks/{id}` | 任务详情 |
| POST | `/v1/ltc/assessment-tasks/{id}/accept`、`…/start`、`…/submit`、`…/return` | 接单 / 开始 / 提交结果 / 退回（须 `reason`） |
| GET | `/v1/ltc/evidence?task_id=` | 任务证据列表 |
| POST | `/v1/ltc/snapshots`、GET `/v1/ltc/snapshots/{id}` | 设备介入快照生成 / 查询（`conclusion` 恒 null） |
| POST | `/v1/ltc/insights/{id}/handle` | AI 洞察处置：`confirmed\|adopted\|rejected\|needs_manual_review` |
| GET | `/v1/ltc/assessors`、`/v1/ltc/assessment-orgs` | 评估员 / 评估机构 |
| GET | `/v1/ltc/work-orders`；POST `…/{id}/action` | 工单列表 / 流转 |
| GET | `/v1/ltc/service-plans`、`/v1/ltc/service-visits`、`/v1/ltc/service-evidence` | 服务域只读 |
| GET | `/v1/ltc/settlements`；POST `…/{id}/review` | 结算列表 / 四步审核 |
| GET | `/v1/ltc/quality-events`；POST `…/{id}/dispose` | 质量事件 / 处置 |
| GET/POST | `/v1/ltc/supervision-cases` | 监管案件 |
| GET/POST | `/v1/ltc/reports/generate`、GET `/v1/ltc/reports/{id}` | 报告生成 / 取报告 |
| GET | `/v1/ltc/devices/{device_id}/telemetry` | 设备实时遥测摘要 |

> **阶段 A 核定注记（LTC-WORKBENCH-SPEC §9.2）**：上表为已实现路由。`GET /v1/ltc/tasks/{id}`（及 `assessment-tasks` 别名）服务函数 `getAssessmentTask` 已存在并已接线。材料域 K05、统一申请动作 K04、`/download`、项目写下发等见下节「待实现契约」。

### 3.4.1 工作台新增契约（N01–N15，阶段 B/D 实现前定义）

> 依据 `docs/LTC-WORKBENCH-SPEC.md` §8.3/§8.5–§8.7。字段草案见该 Spec；本节固化路径、方法、权限码与响应包。全部响应：`{code,msg,data}`；列表：`data = {list,total}`。越权读 404、无权动作 403、版本冲突建议 409。

| ID | 方法与路径 | 权限码（实际字符串） | 作用 | 计划阶段 |
|---|---|---|---|---|
| N01 | GET `/v1/ltc/workbench/summary` | `workbench:read`（新增） | 队列计数、SLA、最近回执 | B |
| N02 | GET `/v1/ltc/workbench/todos` | `workbench:read` | 已授权待办分页 | B |
| N03 | GET `/v1/ltc/family/bindings` | `family_binding:read_self`（新增） | 家属绑定与准入状态 | D |
| N04 | POST/GET `/v1/ltc/family/binding-requests` | `family_binding:request` / `family_binding:read_request` | 绑定核验申请 | D |
| N05 | POST `/v1/ltc/family/binding-requests/{id}/actions` | `family_binding:verify` / `family_binding:revoke` | 核验/补件/批准/撤销 | D |
| N06 | GET `/v1/ltc/family/applications/{id}/timeline` | `application:read`（self 投影） | 公开时间线与下一步 | D |
| N07 | POST `/v1/ltc/appeals` | `appeal:file` | 创建申诉 | D |
| N08 | GET `/v1/ltc/appeals`、GET `/v1/ltc/appeals/{id}` | `appeal:read_self`；内部 `application:read`/`supervision:read` | 申诉列表/详情投影 | D |
| N09 | POST `/v1/ltc/appeals/{id}/actions` | `appeal:accept` 等（新增或映射 `supervision:operate`/`result:approve`） | 受理/协办/答复/发布 | D |
| N10 | GET `/v1/ltc/device-labels` | `device:read` | 标签分页筛选 | D |
| N11 | PATCH `/v1/ltc/devices/{id}/labels` | `device:write` | 版本化标签修改 | D |
| N12 | GET `/v1/ltc/device-labels/stats` | `device:read` | 台账/扫描比对统计 | D |
| N13 | GET `/v1/ltc/device-bindings` | `device:read` | 对象设备绑定 | D |
| N14 | POST `/v1/ltc/device-bindings` | `device:write` | 创建绑定 | D |
| N15 | POST `/v1/ltc/device-bindings/{id}/actions` | `device:write` | 批准/结束/更正区间 | D |

**K 域待实现（须先于页流联调定义字段，阶段 C）**

| ID | 建议路径 | 说明 |
|---|---|---|
| K04x | `POST /v1/ltc/applications/{id}/actions` | 统一动作：受理、补正退回、终审核定、发布；body.action 白名单 |
| K05 | `GET/POST /v1/ltc/applications/{id}/materials`；`GET /v1/ltc/materials/{id}/download` | 材料版本与下载（当前不存在） |
| K11x | `POST /v1/ltc/supervision/cases` 或 `/supervision-cases/{id}/actions` | 解除暂缓、补证复核独立动作 |
| K13x | `GET /v1/ltc/reports/{id}/download` | 报告下载；与 generate 的 type 查询区分 |
| K14w | 项目配置写 / 下发 / 回执 | 仅 GET `/v1/project/config` 已存在 |
| K01x | 可选 `POST /v1/auth/logout`、`GET /v1/auth/session` | 当前退出仅前端 clearSession |

**family_contact 登录形态（阶段 D）**

- 现状：ACCOUNT-MATRIX 规定为**非登录**联系人实体；`ROLE_WORKSPACE_MAP` 无 `family_workspace`。
- 目标：可登录账号 + 绑定/授权准入后进入 `family_workspace`（见 LTC-WORKBENCH-SPEC §0.3、§4.4）。
- 变更顺序：先改 ACCOUNT-MATRIX / PLATFORM-SPEC / 本契约，再改 seed 与 `auth.js` 映射。

## 4. WebSocket 实时通道

- 路径：`/v1/ws`，协议 JSON，鉴权同 REST（握手 URL query 携带令牌：`/v1/ws?token=...`，无效令牌握手直接 401 关闭）。
- 服务端推送三类消息：

```json
{ "event": "vitals",   "data": { "bed_id": "404-A", "hr": 94, "br": 22, "tp": 36.9, "in_bed": false, "body_movement": 1, "recorded_at": "..." } }
{ "event": "alert",    "data": { /* Alert 对象 */ } }
{ "event": "overview", "data": { /* Overview 对象，低频（≥30s）或指标变化时推送 */ } }
```

- 前端断线须自动重连，重连后先拉一次 REST 全量补偿。

## 5. 与安樵平台现有 API 的对应关系

> **目标态口径（v0.2 新增）**：硬件云凭据由业务后端**服务端持有**，平台数据的拉取/订阅、聚合与缓存均在服务端完成，上层前端一律经本契约 `/v1` 获取数据，浏览器不直连硬件云、不持有平台凭据（切换规范与安全基线见 INTEGRATION-SPEC §2/§6）。过渡期内的演示构建若保留浏览器直连，严禁硬编码任何凭据。

| 本契约数据 | 平台 API 来源 |
|---|---|
| `vitals` | `/api/v1/hardware/latest_data`、`today_data` |
| `Alert`（hr/br/tp/off_bed 类型） | `/api/v1/alarm/list` + 数据推送 |
| 睡眠数据/周报 | `/api/v1/hardware/sleep_stats`、`/api/v1/health/report/weekly` |
| `device.online` / `last_data_time` | `/api/v1/device/list` |
| 电话告警 | 平台内置（华为云语音回调），业务后端订阅结果用于 `status` 更新 |

**平台 API 未覆盖、需业务后端新增的**：楼层/专区/床位/长者档案（含护士、医生绑定）、`fall` 类型告警、聚合统计（Overview/demographics/rankings）、WebSocket 推送。

## 6. 待定项

| # | 事项 |
|---|---|
| 1 | 业务后端获取平台数据的方式：订阅平台数据推送（需平台侧开放推送配置）vs 定时轮询；待后端评估 |
| 2 | 护理院账号与平台账号体系的映射（一户一平台账号 vs 一户多账号） |
| 3 | 长者档案、楼层床位结构的管理界面（管理后台范围） |
| 4 | 家属端是否复用平台现有 APP，还是独立开发 |

---

## 7. 账号与组织基线

> 本节建立后续长护险阶段复用的**账号与授权基线**。角色是文档基线；`server/auth.js` 已实现 `authorize()`（RBAC+PBAC+ABAC+Data Scope）与 `ROLE_*` 映射，`/v1/ltc/*`、设备与渠道接口已按本节语义强制授权（对齐 PLATFORM-SPEC §6）。
>
> 原则：**角色是一切授权的唯一依据**，禁止按账号个体硬编码权限；多租户（`tenant_id`）仍由令牌解析，前端不传递租户参数。Data Scope 枚举：`global / org / assigned / pool / task / applicant / channel`（`channel` 为合作伙伴渠道范围，见 PLATFORM-SPEC §2.2）。

### 7.1 组织模型

```
平台 Operator
 ├── 机构 Org（护理院/照护服务商，kind=nursing_home）
 │      ├── 楼层/专区/床位 → 长者
 │      └── 员工账号（su/admin/user）
 ├── 医保局 Bureau（监管侧账号 medical_insurance_staff）
 └── 长护险经办机构 Insurer（医保经办/商保经办，
                             经办侧账号 insurer_staff）

长者 Applicant（参保/长护险申请对象）
 └── 家属联系人 family_contact（非员工账号，绑定一位或多位长者）
失能评估员 assessor（第三方独立评估账号，跨机构）
```

### 7.2 账号角色

| 角色（role） | 平台定位 | 登录身份 | 当前代码映射 | 说明 |
|---|---|---|---|---|
| `su` | 平台超级管理员 | 平台运维账号 | `role=su`（su01） | 系统组织直属，管理平台/机构/医保局/经办机构/评估机构；不直接经办业务 |
| `admin` | 机构管理员 | 机构员工账号 | `role=admin`（admin01） | 机构内全部运营数据与配置（中科安樵组织） |
| `user` | 机构普通用户 | 机构员工账号 | `role=user`（user01） | 设备监控等日常运营（中科安樵组织）；本人经手数据 |
| `family_contact` | 家属联系人 | 非员工账号，绑定长者 | 非登录账号（仅联系人实体） | 仅查看所绑定长者本人数据，需本人/监护人授权 |
| `medical_insurance_staff` | 医保局经办人员 | 监管侧账号 | `role=medical_insurance_staff`（medical01） | 长护险统筹监管、抽审、投诉受理；跨机构只读（医保局组织） |
| `insurer_staff` | 长护险经办机构经办人员 | 经办侧账号 | `role=insurer_staff`（insurer01） | 待遇经办、受理、结算对账；限本统筹区（太平洋保险组织） |
| `assessor` | 失能评估员 | 独立评估账号 | `role=assessor`（assessor01） | 仅评估任务与评估记录；评估当日回避利益相关机构（评估机构/关联组织） |

### 7.3 账号-角色-组织约束

- 一个账号属于且仅属于一个主体（机构/监管/经办/评估机构）；`su` 直属平台。
- `family_contact` 不得为平台员工，与其长者绑定关系由 `admin` 在长者档案内建立并存证。
- 评估回避：`assessor` 不得对其本人/亲属受雇机构的长者执行评估；该约束由后端在派单时校验。
- 变更留痕：账号创建、角色调整、组织归属调整均写入审计日志（`who/when/what/before/after`）。

## 8. 长护险核心领域

> 本节为长护险业务领域的**领域基线**，术语定义见 `docs/DOMAIN-GLOSSARY.md`，完整流程、状态机、验收标准见 `docs/LTC-INSURANCE-SPEC.md`。本节只固化领域实体与其关系，接口在长护险阶段按 Spec 追加。

### 8.1 领域实体关系

```
Applicant 长者 ─┬─ Application 长护险申请（一长者多申请，分期）
                ├─ Material 申请材料（清单化，版本化附件）
                ├─ AssessmentTask 评估任务（一申请一任务，可多次评估轮次）
                │      └─ AssessmentScale 量表（版本化）
                │      │      └─ 计分项
                │      ├─ AssessmentResult 评估结果
                │      └─ Evidence 评估证据（人为判定依据）
                └─ MonitoringEvidence 设备监测证据（辅助证据）

Application ── 经办审核 ── 医保局监管/抽审 ── 复核/申诉
Application ──（预留服务）照护服务计划 ──（预留结算）待遇结算
```

### 8.2 领域数据流

```
申请提交 → 材料核验 → 评估派单 → 现场评估（量表+证据）→ 评估结论分级
  → 经办审核 → 医保局监管/抽审 → 结果公示/告知 → 待遇（服务/结算，预留）
  └── 异议 → 复核/申诉（可回退重评）
```

### 8.3 硬件设备在本领域的定位

本领域的穿戴/床垫/雷达设备数据（心率/呼吸/体温/在床/睡眠/夜间离床/跌倒姿态）继续由**安樵平台现有 API**提供，业务后端起**监测证据**作用。**原则：监测证据只能作为辅助证据，不得单凭设备数据自动决定失能等级或待遇**（详见第 9 节）。

## 9. 设备监测证据

### 9.1 定位与红线

- 设备数据用于：申请时的照护情况佐证、评估档案的补充材料、机构服务是否落地的比对、投诉/申诉的复核参照、长期趋势画像。
- **红线（必须遵守）：**
  1. 设备数据**不能自动决定**：失能等级（评估等级）、长护险待遇类别与额度、机构照护服务是否履约的结论。
  2. 设备数据不得替代《评估量表》中需由评估员现场判定的条目；凡量表条目必须人工录入并留证。
  3. 涉及待遇决定时，设备证据必须被**结论引用链**收敛到人工评估结果之后，方可作为支撑材料呈现。
  4. 设备信号与时序必须与**实际服务记录/人工核查**交叉验证后才可下结论，禁止单一设备报告的因果断言。

### 9.2 证据类型

| 证据类型 | 来源 | 能否独立助评 | 校验要求 |
|---|---|---|---|
| `evidence_assessment` 评估证据 | 评估员现场录入（量表分+佐证照片/影像/文书） | 是（主证据） | 评估员签名+时间戳 |
| `evidence_material` 材料证据 | 申请人/家属提交的纸质材料影像 | 是（申请前置） | 材料核验通过 |
| `evidence_monitoring` 监测证据 | 安樵平台设备数据聚合 | 否（辅助） | 时段覆盖、设备在线、与人工记录交叉验证 |

### 9.3 监测证据数据结构（形态示例）

```json
{
  "evidence_id": "EV-M-20260922-0001",
  "type": "evidence_monitoring",
  "applicant_id": "P00084",
  "assessment_result_id": "AR-20260922-0105",
  "device_source": "platform",
  "period": { "from": "2026-08-01", "to": "2026-08-31" },
  "metrics": {
    "night_trips": 43, "in_bed_rate_pct": 61.2,
    "bed_leave_15min_count": 12, "fall_pose_events": 1,
    "hr_abnormal_days": 7, "tp_abnormal_days": 5
  },
  "conclusion": null,               // 本字段禁止填充任何待遇性结论，仅保留观察性汇总
  "cross_verified": true,           // 已与人工记录/现场核查交叉验证
  "verified_by": "孙医生（主治）",
  "attached_to_conclusion": true    // 已附于人工评估结论的引用链
}
```

> `conclusion` 由系统固定为 `null`，任何自动判定结果禁止写入该字段，以确保红线 1/2 在数据层即不可违反。

## 10. 报告接口与权限矩阵

### 10.1 报告接口（长护险阶段追加，本阶段仅固化权限语义）

报告类接口统一：`GET /v1/ltc/reports/{type}?applicant_id=&period=&scale_version=`，返回 `{code,msg,data}`，时间 ISO 8601 东八区。类型枚举：

| type | 说明 | 主要角色 |
|---|---|---|
| `application` | 申请受理汇总（受理量/材料齐备率/时限） | admin/user/medical_insurance_staff/insurer_staff |
| `assessment` | 评估明细与分布（评估量/等级分布/转评估） | admin/assessor/insurer_staff |
| `monitoring` | 设备监测证据汇总（辅助证据视图） | admin/user |
| `result` | 待遇决定结果与公示/告知状态 | insurer_staff/medical_insurance_staff |
| `appeal` | 异议复核/申诉处理量 | insurer_staff/medical_insurance_staff |

### 10.2 权限矩阵（R=读，W=写/经办，A=审，X=禁止）

| 能力 \ 角色 | su | admin | user | family_contact | medical_insurance_staff | insurer_staff | assessor |
|---|---|---|---|---|---|---|---|
| 长者档案读/写 | W | W | R(本机构) | R(本人绑定) | R(统筹区) | R(统筹区) | X |
| 长护险申请提交/材料上传 | A | W | W(代提交) | W(本人) | R | R | X |
| 评估派单 | A | W | X | X | R | R | X |
| 现场评估录入（量表+证据） | X | X | X | X | X | X | W(任务内) |
| 评估结果确认/分级 | X | X | X | X | R | A(W) | R(本人) |
| 经办审核 | X | X | X | X | A | W | X |
| 医保局监管/抽审 | X | X | X | X | W | R | X |
| 复核/申诉受理 | A | R | R | W(提出) | R | W | R |
| 监测证据查看 | R | R | R(本机构) | R(本人绑定) | R | X | R(任务内) |
| 报告查看 | R | R | R(本机构) | R(本人) | R | R | R(评估明细) |
| 结算/对账（预留） | A | R | X | X | R | W | X |

> 说明：`family_contact` 全程仅本人所绑定长者范畴且需授权；`assessor` 仅评估任务/评估记录范畴；`medical_insurance_staff` 面向全统筹区只读监管；结算/服务为预留能力，本期不实现。

### 10.3 权限执行规则

- 接口层统一：令牌解析角色 → 匹配矩阵 → 拒绝返回 403；越权读取他人数据返回 404（与既有跨租户口径一致）。
- 报告访问一律携带 `applicant_id`/`period` 约束，禁止整表导出。
- 涉及待遇结论的报告（`result`）仅在结论人工确认后才能生成，`monitoring` 报告必须内嵌“仅辅助证据”水印与免责说明。
