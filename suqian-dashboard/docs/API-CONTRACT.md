# 安守护护理院系统 · API 数据契约 v0.1

> ⚠️ **已冻结（2026-09-23）**：本文件不再演进。接口契约唯一来源已迁至 `anqiao-console/docs/API-CONTRACT.md`（v0.2+）；仓库边界、部署拓扑与切换窗口以 `anqiao-console/docs/INTEGRATION-SPEC.md` 为准。本仓定位为**待归档的宿迁分叉仓**，有效改动将合回 `anqiao-dashboard`（INTEGRATION-SPEC §3/§8 阶段三）。以下内容仅作历史参考。

> 状态：草案（待后端评审确认）
> 日期：2026-09-19
> 读者：后端、前端工程师
> 原则：**界面上的每个数字必须有且仅有一个来源**；本契约是前后端联调的唯一依据，字段变更必须改文档再改代码。

---

## 1. 总体结构

```
硬件设备 → 安樵平台 API（现有，api.health-track.anqiaokj.com）
                ↓ 数据同步/聚合
        护理院业务后端（新增，本契约定义）
                ↓ REST + WebSocket
        大屏前端 / 管理后台 / 家属端
```

- 设备原始数据（心率/呼吸/体温/在床/睡眠）继续走**安樵平台现有 API**，业务后端消费平台数据（推送或定时拉取），不在本契约重复定义。
- 本契约定义业务后端对上层应用提供的 **B 端（护理院维度）聚合 API**：护理院 → 楼层 → 专区 → 床位 → 长者 → 设备，以及实时推送通道。
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
| POST | `/v1/auth/login` | 登录获取令牌，body `{username, password}`；成功返回 `{token, staff: {name, role}, tenant: {tenant_id, name, kind}}`（`kind`: `vendor` 厂商 / `nursing_home` 护理院）；切片实现为 HMAC-SHA256 签名令牌（8h），同 IP 60s 失败 ≥5 次锁 10 分钟（429） | `username`, `password` |
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
