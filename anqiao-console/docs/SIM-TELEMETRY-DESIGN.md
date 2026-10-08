# 仿真遥测源与合作伙伴沙箱租户设计（SIM-TELEMETRY）

- 日期：2026-10-08
- 状态：已获业主口头批准方向（"可以"），待本文档确认后实施
- 规格自审修订（2026-10-08，对照代码逐行核验）：明确 SIM SN 构成与生成算法、账号命名与 SN 冲突规避、ltc.js 收口范围为 9 处、buildAlerts 随机源勘误（现状已确定性、缺的是日期分量）、增设「跨日不重启漂移」新验收项；原文多处与代码不符的断言已修正
- 需求来源：业主两项指令——①「模拟的设备、用户等必须和真实的一样，起码一天内的数据得是一样的」②「不同的机构或合作伙伴需要不同的账号群来全方位体验」
- 关键事实裁定（2026-10-08 业主澄清）：
  - 需求 ① 的含义 = **数据稳定性**（同一天内不漂移、重启可复现；隔天自然换新），非结构对齐、非真实数据镜像
  - 需求 ② 的形态 = **合作伙伴登录后看到自己机构的名字**（专属租户沙箱）
  - **完全无真机**：公司当前没有任何部署中的真实设备；演示大屏上显示的设备数据本来就是模拟出来的（与宿迁 3 台真机无关，真实域不在本次范围内）

## 1. 背景与问题

### 1.1 现状

系统按三域模型（真实域 / 体验域 / 交付域，PRD §2.3）组织。硬件遥测的唯一对外通道是 `server/hw.js` 的硬件云只读代理（Base `https://api.health-track.anqiaokj.com`，契约《AI 健康守护仪对接API（V1.0）》2.8 节六个只读查询 + 2.5.1 设备列表 + 2.7.4 告警）。

体验域的模拟数据现状有四个问题：

1. **随机漂移**：`walkVitals` / `generateLiveAlert`（`server/seed.js` L1840/L1860）用 `Math.random` 每次产生不同数据——同一个演示日内刷新页面、重启服务，体征与告警都不一致，不满足"起码一天内的数据得是一样的"。（seed 面注记：`buildAlerts` 的告警集合本身已确定性（mulberry32 定种子），其漂移仅在于日期分量——见 §4.1）
2. **无硬件遥测模拟层**：`/v1/hardware/*` 代理直转硬件云；完全无真机时这些接口查不到数据，大屏设备遥测断流
3. **告警模拟器曾引发生产事故**：`generateLiveAlert`（2026-09-27 生产 502，守卫已补），其生成仍为纯随机；`index.js` L1551 的告警间隔 `delay` 亦用 `Math.random` 取值
4. **伙伴体验通道缺失**：`partner_p1` 渠道租户无角色账号群；无法给合作伙伴开出"登录进去就是自己机构名字"的专属体验环境

### 1.2 目标

- G1（数据稳定性）：同一设备同一天内，任何时刻、任何次数、任何次重启后查询，2.8 六接口 + 平台业务数据（患者体征/告警）完全一致；隔天数据自然更新
- G1a（长运行跨日稳定）：服务器**跨天不重启**时，平台业务数据的"今日"锚点（告警 occurred_at、单据当日号）不得停留在旧日期——按日种子须以查询时当日为准（现状缺口：`TENANT_DATA` 仅进程启动构建一次，seed.js，无按日重建机制，长运行跨天后 seed 告警停在启动日、live 告警带当前时刻，呈混合态）
- G2（真实感）：仿真遥测的形状、字段、节律、医学区间对齐《AI健康守护仪数据指标与医学参考值解读体系规范》，观感"和真机一样"
- G3（伙伴沙箱）：管理侧可为合作伙伴开出专属租户——机构名 = 伙伴自己的名字、完整角色栈账号群、专属 SIM 设备、严格租户隔离、常驻演示标识
- G4（数量解耦）：每租户可挂任意数量演示设备，不受真实设备数量限制

### 1.3 非目标（范围外）

- 宿迁真实域（3 台真机、3 位真实长者、bureau_suqian/insurer_suqian/assessor_suqian 账号）**完全不动**
- 真实硬件云对接能力保留不动（真实 SN 仍走代理），未来真机上线零成本切换
- 不做真实数据脱敏镜像（既有红线：真实 PII 仅限真实环境，模拟人格不得使用真实人名）
- 不做凯健/姑苏等已移除租户的恢复；不改动 LTC 长护险业务面（ltc.js 的单据流转）——仅其中"单号漂移"按 §4.3 收口（范围 9 处，见该节）
- 大屏前端（anqiao-dashboard / suqian-dashboard）改动最小化：仅受益于代理层数据，不改三态判定口径（"绝不模拟，绝不降级掩盖异常"的注释纪律不变——数据源真实性的责任移到后端仿真层）

## 2. 总体架构

```
浏览器（console 工作台 / 演示大屏）
  │  GET /v1/hardware/{latest,daily,today,sleep,report-dates,alarms}?device_id=SN
  ▼
SaaS 后端 server/index.js handleHardwareProxy（既有入口，鉴权不变）
  │ 按 SN 分流
  ├── SN 带 SIM- 前缀 → server/sim-telemetry.js（本设计新增的仿真数据源）
  │                        │ 确定性生成器：seed = f(SN, 日期)
  │                        │ 内存缓存：当日全量数据（懒生成 + 进程内复用）
  │                        ▼
  ├── 真实 SN → server/hw.js 硬件云代理（不动）
  ▼
平台业务数据（患者/床位/告警）server/seed.js
  │ buildPatients/buildAlerts/walkVitals/generateLiveAlert 全部接入按日种子
  ▼
伙伴沙箱租户（G3）
  POST /v1/admin/tenants 扩展（既有端点）
  │ 参数 + 伙伴模式 → registerTenant + 角色栈账号群生成 + SIM 设备挂载
```

分层职责：

| 单元 | 做什么 | 依赖 |
|---|---|---|
| `server/sim-telemetry.js`（新增） | 仿真 2.8 契约数据生成 + 按 (SN, 日期) 确定性 + 进程内缓存 | mulberry32、医学区间常量 |
| `handleHardwareProxy`（改） | SN 分流：`SIM-` 前缀走仿真源，其余走硬件云 | sim-telemetry |
| `server/seed.js`（改） | 平台模拟数据接入按日确定性种子 | mulberry32 |
| 租户开通（改 `registerTenant` + 新增账号群工厂） | 伙伴沙箱：租户 + 账号群 + SIM 设备一次开出 | sim-telemetry、db.js saas_users |
| `device_registry`（复用） | SIM 设备作为资产登记，customer_org_id 指向伙伴租户 | 既有 N21-N27 机制 |

## 3. 仿真遥测源设计（server/sim-telemetry.js）

### 3.1 SN 规则与路由

- 仿真设备 SN 统一前缀 `SIM-`，完整构成 `SIM-<tenantId哈希4位><序号2位>`（如 `SIM-A1B203`），生成算法见 §5.1 步骤 2。`SIM-` 前缀即路由依据，全系统一致（代理层、设备资产、租户配置）
- `handleHardwareProxy` 内：`device_id` 以 `SIM-` 开头 → 调 sim-telemetry；否则走既有 hw.js 代理。分流在**服务端**完成，前端零感知。分流点置于 hw.js 的 502 包装**短路之前**（仿真数据在进程内生成，不经过上游失败包装，hw.js L23-26 对上游 `code!==200` 一律置 502）
- 鉴权不变：公屏只读白名单、`device:read` 权限校验、在册校验对 SIM 设备同等生效——
  - 公屏（screen_viewer/kiosk）：`screenMayReadHardware` 逐端点校验（index.js L851-855），白名单数据源 = 内存 `DEVICE_ASSETS` 的 `sn||device_id`（index.js L844-849，SIM 设备登记进 DEVICE_ASSETS 即在册）；宿迁池公屏例外走硬编码 `SUQIAN_SCREEN_DEVICE_IDS` 三 SN 白名单（index.js L838），不受影响
  - 非公屏 `device:read` 席位：**现状无在册校验**（任意 device_id 直透上游）——SIM 设备同样适用此口径，分流不新增校验、也不收紧现状（是否给非公屏补在册校验属独立安全议题，不在本设计范围）
- 注意：`/v1/hardware/devices`（2.5.1 设备列表）**按 user_id 转发硬件云，无 device_id 维度，不做 SIM 分流**——前端 hardwareApi.ts 确有调用该接口（anqiao-dashboard/suqian-dashboard），实施时须核实 SIM 演示路径上前端如何取得设备清单（见 §8 P-A 待决事项）

### 3.2 确定性生成核心

- 种子函数：`seedOf(sn, date) = hash(sn) ^ hash(date)`（FNV-1a 或同量级稳定哈希，**禁用 Date.now()/Math.random 入种子**）
- 生成器：`mulberry32(seedOf(sn, date))`——仓库已有此 PRNG（seed.js 在用），复用同一实现保证跨模块一致
- **不变量（验收核心）**：同一 (sn, date)，任何进程、任何时刻调用，六接口返回逐字段一致；不同 date 之间数据不同且连续自然（见 3.4 时序衔接）

### 3.3 2.8 六接口仿真规格

全部对齐《对接API V1.0》响应形状（字段名、时间格式 `YYYY-MM-DD HH:mm:ss`、健康判定字段），生成规则对齐医学参考值规范：

| 接口 | 生成规则 |
|---|---|
| latest（2.8.2） | 按当日分钟序列的"当前时刻"取值：心率 = 年龄基线 + 昼夜节律（夜间偏低）+ 有界波动；呼吸 12-20 次/分为主区间；体温 36.0-37.2；体动 0-3 级；在床状态由当日作息曲线决定（就寝段在床、昼间活动段离床） |
| daily（2.8.3） | 晚 20:00 至次日 08:00 逐分钟序列（720 点）：睡眠分期（深睡/浅睡/清醒交替，分期时长符合睡眠生理结构）→ 体征按分期调制（深睡心率低波动小、清醒段体动多） |
| today（2.8.4） | 00:00 至当前时刻逐分钟序列，与 latest 同一条曲线（同源切片，保证互相自洽） |
| sleep stats（2.8.5） | 从 daily 序列统计：总睡眠时长、深睡/浅睡/清醒占比、入睡/醒来时刻、夜间起身次数；占比合计 100% |
| report-dates（2.8.6） | 返回 [今天-30 天, 今天] 内的日期列表（每日都有报告） |
| alarms（2.7.4） | 当日告警列表：按 (sn, date) 种子以合理概率（约 0-3 条/日/床）生成跌倒/离床超时/心率异常/呼吸异常事件，时间点与作息曲线自洽（如离床集中在夜间如厕时段）；含 status 字段（older 告警已 handled，近期 triggered） |

健康区间与告警阈值以《AI健康守护仪数据指标与医学参考值解读体系规范.docx》为准（实施时从该文档提取常量表，不在此预设数值）。

### 3.4 时序衔接与"当前时刻"处理

- 一天的数据曲线在 (sn, date) 确定时**整日一次性生成**（720-1440 点的分钟级序列），latest/today 是这条曲线的切片——因此"当前时刻"取值随真实时钟推进，但**历史点永不变**（查询同一历史时刻两次结果相同）
- 跨日边界：`today` 属于日期 D；`daily`(date=D) 覆盖 D 晚 20:00 至 D+1 早 08:00（对接 API 的夜间窗语义）——D 日深夜与 D+1 日凌晨属于两个日种子的相邻段，实施时用"夜间窗双段拼接"（20:00-24:00 取 D 种子、00:00-08:00 取 D+1 种子）保证曲线在 00:00 处不跳变出格（小幅不连续属真机也有的自然现象，不做平滑处理，保持诚实）
- 进程内缓存：`Map<sn_date, 序列>` 懒生成；同日重复查询 O(1) 读缓存。缓存无需持久化（重启后重新生成结果一致，这正是确定性保证）

### 3.5 与平台业务数据的关系

平台侧（护理院床位患者）已有自建 patients/vitals/alerts 数据面（seed.js）。两类数据并存时的口径：

- 床位患者列表、班次、处置链路 → 平台业务数据（seed.js，本设计 §4 收口）
- 设备遥测详情（点开设备看 latest/夜间报告/睡眠统计）→ sim-telemetry
- 康宁等机构照护租户的告警由平台业务面生成（bed_id 维度），不强制与 SIM 设备告警合并——两个数据面各司其职，前端既有组件已按此分工（与现状一致，不新增合并逻辑）

## 4. 平台模拟数据确定性收口（seed.js）

### 4.1 种子数据按日化

- `buildPatients` / `buildAlerts` 现以固定 cfg.seed 生成——**保持不变**（机构结构、床位布局、长者人格是长期稳定的，本来就不该每天变）
- `buildAlerts` 的 `occurred_at` 已锚定"今日 00:10 起均匀分布"（seed.js L366-380，`minuteOfDay = 10 + (i+0.5)*((24*60-20)/N)`，日期取构建时 `todayStr8()`）。**勘误（自审核验）**：其随机源现状已是 `mulberry32(cfg.seed ^ 0xa1e7)` 确定性生成，**并非** `Math.random`——同日重启后告警集合本就一致；真正的缺口是种子**不含日期分量**（cfg.seed 为常量），"每日重启自然换新"依赖 `todayStr8()` 取构建时日期，且长运行跨天不重启时停在旧日（见下条）。**修复内容据此收窄为**：种子改 `mulberry32(cfg.seed ^ 0xa1e7 ^ dateSeed(today))`（加入日期分量）+ §4.1 末条的按日惰性重建；不同实现语言不引入
- `vitals.recorded_at` 等时间戳同步检查日期分量（实施时核实其现状随机源后同法处理）
- **跨日不重启缺口（自审发现，现状无按日重建机制）**：`TENANT_DATA` 仅进程启动时构建一次（seed.js L1320-1328），全库无午夜 reseed/cron。长运行跨天后：seed 告警 `occurred_at` 停留在启动日、live 告警带当前时刻（`nowIso()`），列表呈"旧日 + 当下"混合态（告警列表端点现状只排序不过滤日期，index.js L568——漂移源是数据本身锚定在构建日，非查询过滤）。收口方案：读取路径加**按日惰性重建**——首次访问发现"数据面构建日 ≠ 请求当日"时，以当日种子重建日敏感数据面（告警等）；结构数据（床位/患者）不重建。此为 G1a 的实现点，具体触发位置实施时在 index.js 查询路径逐个落位

### 4.2 实时通道确定性化

- `walkVitals`（WS 3 秒体征游走，seed.js L1840 `Math.random`）：`Math.random` → `mulberry32(seedOf(tenantId, date) ^ walkSeq)`，walkSeq 为进程内递增计数。效果：单进程内体征按确定序列演进（直播感保留）；**重启后序列回到当日第 0 步重新走**——同日重启前后"当前值"会回到游走序列的早期值，但每一步的值集合一致。这是稳定性与直播感的折中，验收标准为"重启后继续演进、不跳变出格"
- `generateLiveAlert`（45-75 秒低频告警，seed.js L1860 `Math.random`；间隔由 index.js L1548-1551 控制，`delay` 亦用 `Math.random`，同法接入按日种子）：产出的告警插入既有 alerts 数组，告警内容/床位/类型由当日种子决定。502 事故守卫（患者空数组返回 null + try/catch 兜底）**保留不动**

### 4.3 LTC 单号收口

`ltc.js` 中 `Math.random` 共 **9 处**（自审核验，原文"4 处"计数有误）：auth_code ×2（L3056/L3834）、bank_batch_no ×2（L3057/L3835）、督办文号 orderNum（L3377）、处罚文号 docNo（L3450）、receipt_id（L4697）、设备生命周期 log_id（L5295）、assignment_id（L5379）→ 全部改为单据内容 + 时间戳派生的确定性编号（`seedOf(poolId, 单据ID, 秒级时间)`）。编号唯一性由单据 ID 保证，随机性非必需。范围仅此 9 处单号，不碰 ltc.js 其他逻辑。

## 5. 合作伙伴沙箱租户设计

### 5.1 开通流程（管理侧动作）

既有端点 `POST /v1/admin/tenants`（仅 su）扩展请求体：

```jsonc
{
  "tenant_id": "partner_acme",        // 既有校验规则不变
  "name": "XX养老服务有限公司",        // 伙伴的真实机构名
  "vertical": "nursing_home",          // 既有四业态枚举
  "template": "nursing_home_v1",
  "partner_sandbox": {                // 新增，可选
    "sim_device_count": 12,           // 该租户挂载的 SIM 设备数，默认 12
    "demo_disclaimer": true           // 常驻演示标识，恒 true（不可关）
  }
}
```

开通动作（服务端一次完成，全部自动）：

1. `registerTenant`（既有，seed.js L1368-1377）注册租户配置。tenant_id 校验沿用既有正则 `/^[a-z0-9_]{3,64}$/`（index.js L1830）——仅小写字母/数字/下划线，**大写与连字符会被拒**（`partner_acme` 合法，`partner-acme` 不合法）；`vertical` 须属四业态枚举；模板工厂现状仅有 `nursing_home_v1`（seed.js L1359-1366，`VERTICAL_TEMPLATE_FACTORIES`），传其他 vertical 会以 409 拒绝（文案混叠"租户已存在或该业态模板未上线"，index.js L1836）——**伙伴沙箱首期仅支持 nursing_home 业态**，文档如实登记此限制
2. 生成 SIM 设备批次：SN 规则 `SIM-<tenantId哈希4位><序号2位>`（如 `SIM-A1B203`，序号 01 起）。哈希4位 = `fnv1a(tenant_id)` 值域映射到 36 进制 4 位大写字母数字（与 §3.2 种子函数同一 FNV-1a 实现复用）；同 tenant_id 哈希恒定 → SN 恒定可复现，不同 tenant_id 冲突概率可忽略；生成后仍逐一遍历 `DEVICE_ASSETS` 查重防撞（哈希相同或手工登记撞号时序号顺延）。登记进设备资产（`customer_org_id` = 新租户、`hardware_asset_owner` = anqiao、`procurement_channel` = `demo_sim`；登记走既有 `createDeviceAsset` 同构路径，与公屏在册白名单同源——白名单读 `DEVICE_ASSETS` 的 `sn||device_id`，index.js L844-849）
3. 按业态模板生成**完整角色栈账号群**（护理院 = 既有 16 角色，复用康宁的角色定义与 kangning_* 账号同构），账号写入 `saas_users`（既有 db.js 机制），初始密码同 SEED_ACCOUNT_PASSWORD 注入策略，用户名规则 `<tenantId>_<role>`（如 `partner_acme_admin`）。**用户名长度红线**：saas_users.username 上限 64 字符（db.js L168）、登录侧校验同 64（index.js L440）——tenant_id 最长 64，拼 `_admin` 即超限；伙伴沙箱 tenant_id **建议 ≤ 24 字符**（64 − 最长角色后缀余量），请求体超长以 400 拒绝并提示改名
4. 租户数据面：床位/患者结构复用康宁模板布局（87 在住/96 床位规格，seed.js L181-192），长者人格**从既有虚构姓名池派生新组合**（不与康宁重复展示同一批人名），护士/医生花名同池派生
5. 账号群与租户落库后返回账号清单（用户名+角色+workspace），管理侧转交伙伴

> **运行时持久化边界（如实登记）**：账号（saas_users）与设备资产（device_registry 表）持久化，但 `TENANT_CONFIGS/TENANT_DATA` 现状为纯内存（seed.js L1318 自注"生产换 DB"）——运行时开通的伙伴租户**重启即丢**（账号与设备资产仍在库，租户配置与数据面不在）。P-C 不顺带做租户持久化全案（超范围）；实施选择：①接受现状并在开通响应与文档明示"重启后需重开"；②或最小补一条租户配置持久化。取舍在 P-C 开工时向业主提出，不预设。

### 5.2 伙伴登录体验

- 伙伴任意角色登录 → `principal.org_name` = 自己机构名，所有工作台顶栏/身份区显示自己机构名（既有机制，零新开发）
- 角色门控、工作台组件、账号一一对应关系与康宁演示租户完全同构——伙伴"全方位体验"= 从院长登到护工登
- 常驻演示标识：登录后界面显示"演示环境 · 数据为模拟"徽标（康宁已有 `(虚构机构·模拟数据)` assigned_title 机制 + 前端演示标识，沿用既有实现方式）
- 设备遥测：伙伴工作台的设备监测页查 SIM 设备 → 代理层分流 sim-telemetry → 稳定且真实感的体征/夜间报告/睡眠统计

### 5.3 隔离与红线（不变量）

- 租户间数据隔离沿用既有锁池/租户校验（越权 404），伙伴租户间、伙伴与康宁、伙伴与宿迁真实域互不可见
- SIM 设备资产仅归属其伙伴租户；宿迁三台真机 SN 在仓库中硬编码三处（index.js L838 `SUQIAN_SCREEN_DEVICE_IDS`、seed.js L1820-1825 红线断言、ltc.js L5287 `SUQIAN_PROTECTED_DEVICE_IDS`），本次零触碰，三处一致性由 V9 断言看守
- 演示标识恒开（请求体不可传 false 关闭）
- 伙伴机构名 = 客户自己的名字，出现在他自己沙箱属**身份展示**，不违反"模拟数据严禁真实机构名"红线（该红线禁止的是把第三方真实机构名编进演示数据冒充数据来源）

### 5.4 现有 partner_p1 的处置

`partner_p1`（中科智护合作伙伴渠道）保持不动——它是渠道运营工作台（线索/客户管理），与伙伴沙箱（客户体验环境）是两个概念，不合并、不删除。

## 6. API 契约登记

- 新增：本文档 §5.1 请求体扩展（`partner_sandbox` 字段）登记进 API-CONTRACT.md。现状注记：`POST /v1/admin/tenants` 目前在 API-CONTRACT.md 仅一行登记（N27，守卫/409/400 语义），**无请求体字段结构、无 tenant_id 格式正则**——实施时须把既有四字段（tenant_id/name/vertical/template）与新增 partner_sandbox 一并补全，含 `/^[a-z0-9_]{3,64}$/` 正则
- `/v1/hardware/*` 六接口：对外形状不变（内部分流），API-CONTRACT §3.5（已完整登记 8 条路由）补记"SIM- 前缀设备由内置仿真源应答"
- 契约先行纪律：实施前先更新 API-CONTRACT.md，再动代码

## 7. 验收标准（进 npm test，新增 test-sim-telemetry.mjs + 扩展既有测试）

> **挂载警示（自审发现）**：本仓 `npm test` 是**显式文件清单**（package.json：`node --test --test-concurrency=1` + 17 个文件逐一列出），非 glob——`test-sim-telemetry.mjs` 必须手动追加进 test script，否则静默不跑（仓库已有 3 个测试文件漏挂先例：test-home-care / test-medical-departments / test-pool-isolation）。P-A 验收定义含"新测试文件已挂进 package.json test script"。

| # | 用例 | 断言 |
|---|---|---|
| V1 | 确定性 | 同一 (SIM SN, date) 六接口在两次独立全量生成（模拟重启：新进程/重装模块）下逐字段 deep equal |
| V2 | 跨日变化 | 相同 SN 不同 date 的 latest/daily 数据不同（至少 N 字段差异）且区间合法 |
| V3 | 路由 | SIM SN 经 /v1/hardware/latest 返回仿真数据；非 SIM SN 仍转发 hw.js（mock 上游验证转发发生） |
| V4 | 鉴权继承 | screen_viewer 查 SIM 设备：在册（已登记 DEVICE_ASSETS）→200，未登记 SIM SN→403（沿用公屏在册白名单校验；宿迁池公屏仍只认三台真机 SN） |
| V5 | 种子日稳定 | buildAlerts 同日两次重建（模块重载模拟）告警集合一致（回归现状，改动不得破坏）；改种子后不同日重建结果不同且区间合法 |
| V6 | 实时告警健壮性 | generateLiveAlert 在空患者/无租户下返回 null 不抛错（回归 502 守卫）；接入种子后类型/床位由当日种子决定 |
| V7 | 伙伴沙箱开通 | POST /v1/admin/tenants 带 partner_sandbox → 返回租户+账号群清单；账号可登录且 org_name = 伙伴名；16 角色账号全部落 saas_users；tenant_id 含大写/连字符 → 400；用户名拼接后 >64 字符 → 400 |
| V8 | 沙箱隔离 | 伙伴租户 A 的会话查租户 B 的床/患者/设备 → 404；SIM 设备资产归属各自租户 |
| V9 | 红线 | suqian devices 恒 3 台断言不回归（seed.js 红线 + index.js/ltc.js 两处硬编码白名单一致）；宿迁池账号查询行为与改动前一致 |
| V10 | 健康区间 | 仿真 latest/daily 体征落在医学参考值规范区间内（常量表断言） |
| V11 | 长运行跨日（新增） | 模拟"进程不重启、时钟跨日"：查询路径的今日锚点切换为新日期（seed 告警 occurred_at 不停留在旧日、当日单据号用新日期），且新日期数据经按日种子稳定 |

## 8. 实施分期

- **P-A 仿真遥测源**：sim-telemetry.js + 代理分流 + V1-V4、V10（核心价值，独立可交付）
  - 待决事项（实施开工时核实，不预设答案）：`/v1/hardware/devices`（2.5.1）按 user_id 转发、无 device_id 维度，不做 SIM 分流——需核实 SIM 演示路径上前端设备清单来源（是改由平台 `/v1/devices` 资产列表驱动，还是代理层对 devices 也做 SIM 感知）；以"前端零改动"为准绳选定
- **P-B 平台数据收口**：seed.js 按日种子 + 实时通道确定性 + 跨日不重启锚点（G1a）+ LTC 9 处单号 + V5、V6、V11
- **P-C 伙伴沙箱**：开通流程 + 账号群工厂 + SIM 设备挂载 + V7-V9（依赖 P-A）。开工时向业主提出租户持久化取舍（§5.1 注记：接受重启重开 vs 最小持久化补丁），不预设

P-A → P-B → P-C 顺序实施，每期独立验证、独立提交。
