# 长护险业务 Spec · 设备介入与评估协同可执行规格 v0.2

> 状态：可执行基线 v0.2
> 日期：2026-09-22
> 读者：后端、前端工程师、产品、业务方（政府/医保局/经办/照护机构）
> 关联：`docs/API-CONTRACT.md`（账号/组织/报告接口基线）、`docs/DOMAIN-GLOSSARY.md`（术语）、`docs/PLATFORM-SPEC.md`（平台承载边界）、`docs/RESEARCH-LTC-ANTI-FRAUD.md`（政策与监管的一手来源与文号，非交付规范）
>
> **三句硬性声明（本文件定位）**
> 1. **本文件是长护险设备介入与评估协同的可执行规格 v0.2**：它是设备介入（AI 健康守护仪）在评估、服务与监管中的正式业务能力定义，是唯一交付来源。
> 2. **国家评估标准通过 versioned `scale`/`ruleset` 配置接入**：量级、分档、等级判定算法一律由官方版本配置注入并留痕，不在 Spec/代码写死具体分值。
> 3. **设备数据、AI 分析和评估师人工结论分别存储、可追溯关联**：三类记录各自独立落库，通过引用链（snapshot/insight/evidence → assessment_result）双向可追溯，不相互覆盖。
>
> **文档角色（唯一来源）**：本 Spec 是**失能等级评估执行规则、设备介入、服务/结算阶段证据与反欺诈、AI/设备与评估师职责分工的唯一交付来源**。`docs/PLATFORM-SPEC.md` 只定义平台承载边界（多组织/多域/权限/数据范围、设备资产中心的数据产品承载），相关执行细节源引本 Spec；`docs/RESEARCH-LTC-ANTI-FRAUD.md` 仅作证据索引，不作为可执行依据。文档间不一致时以本 Spec 为准。
>
> **原则**：本 Spec 是对**可验收行为**的正向、可执行定义。实现必须与之一致；「待配置」项必须显式落库/入参，不得硬编码假设。
>
> **设备介入定位（正向声明）**：AI 健康守护仪是**长护险评估与服务监管的连续性监测工具**——为评估师提供客观状态摘要，为经办机构/医保局提供可追溯交叉验证证据，为服务实施提供过程数据支撑。评估等级、待遇资格和最终核定由**正式评估与审核流程**中的相应责任主体（评估师、经办、监管）产出，设备介入以其客观、连续、可追溯的数据特性服务上述流程，二者各司其职、相互印证。
>
> **职责分工（正向表述）**：评估师依据国家/地方正式量表、现场观察、询问与材料证据形成评估意见；经办与医保监管对评估结论与待遇资格作审核与核定；设备介入为上述环节持续提供**数据摘要、证据完整性、前后一致性提示与风险线索**，使评估与服务过程客观可证、交叉可查。

---

## 1. 领域范围与术语

- 领域对象与术语唯一权威定义见 `docs/DOMAIN-GLOSSARY.md`；本 Spec 直接引用，不重复定义。
- 核心对象：`Applicant 申请人/参保对象`、`Application 长护险申请`、`Material 申请材料`、`AssessmentTask 评估任务`、`AssessmentScale 量表（版本化）`、`AssessmentResult 评估结果`、`MonitoringBinding 设备绑定`、`DeviceAsset 设备资产`、`MonitoredSubject 被监测对象`、`AssessedPerson 被评估对象`、`ServiceSubject 服务对象`、`ServicePlan 服务计划`、`ServiceVisit 服务到访`。
- 完整状态机见 §4；角色权限见 §4.7；设备介入流程见 §5–§13；验收标准见 §12。

## 2. 设备介入总览

### 2.1 业务目标

设备介入把 AI 健康守护仪的连续性监测转化为三类正式业务产物：

| 业务产物 | 服务对象 | 用途 |
|---|---|---|
| **客观状态摘要** | 评估师 | 在评估任务数据包内呈现被评估对象的连续状态（在床、离床、体征、睡眠、跌倒姿态），供评估师与现场观察、量表答案对照 |
| **可追溯交叉验证证据** | 经办机构/医保局 | 以冻结快照 + 原始引用形式保存，供审核、抽审、复核、申诉时作独立可查证据 |
| **过程数据支撑** | 服务实施 | 与服务到访、护理记录、实名签到关联，支撑服务履约核查与结算对账 |

### 2.2 介入节点

设备介入在以下节点提供产物，各节点均有明确输入与输出（详见对应章节）：

| 介入节点 | 章节 | 输入 | 输出 |
|---|---|---|---|
| 评估任务创建 | §5.1 | 任务绑定 `assessment_id` + 对象 `person_id` | 打开评估窗口 `assessment_window` |
| 评估数据包生成 | §5.2 | 设备原始数据窗口 | `assessment_snapshot`（冻结快照） |
| 评估师处理 | §6 | 快照 + 现场观察/量表答案 | `assistant_insight` + 评估师处理动作 |
| 交叉验证 | §7 | 设备摘要 vs 现场/量表答案 | `cross_validation` 结论 |
| 服务实施 | §8 | 服务到访 + 设备数据窗口 | 服务证据 `service_evidence_status` |
| 质量与报告 | §9/§13 | 设备运行质量 | 质量事件 + 各类报告 |

### 2.3 参与角色

| 角色 | 在设备介入中的职责 |
|---|---|
| `assessor` 评估师 | 查看任务数据包、对照设备摘要、作出处理动作（见 §6.5） |
| `insurer_staff` 经办 | 审核交叉验证证据、查看服务证据、作待遇相关核定 |
| `medical_insurance_staff` 医保局 | 统筹区只读抽审、复核时调取交叉验证证据与报告 |
| `admin`/`user` 机构账号 | 维护设备绑定、查看本机构服务对象与服务证据 |
| `device_user` 设备运营 | 设备资产、安装位置、运维质量、质量事件处置 |
| `su` 平台 | 全局配置、授权、审计查阅 |

### 2.4 输入输出总则

- 设备原始数据由安樵平台现有 API 提供（心率/呼吸/体温/在床/睡眠/离床/跌倒姿态），本 Spec 定义其在长护险域内的消费与固化方式。
- 三类记录**分别存储**：`monitoring_evidence`（设备数据快照）、`assistant_insight`（AI 分析）、`assessment_result`（评估师人工结论），通过引用链可追溯关联（§5/§6）。

## 3. 设备与对象关系

### 3.1 实体职责

| 实体 | 定义 | 关键约束 |
|---|---|---|
| `DeviceAsset` 设备资产 | AI 健康守护仪的资产记录（设备台账） | `owner_org = anqiao_ops`；生命周期 `stocked→…→retired`（见 `PLATFORM-SPEC` §9.1） |
| `MonitoringBinding` 设备绑定 | 一台设备与一个被监测对象的有效绑定关系 | 绑定有效期、授权人、机构、安装位置、责任链（见 §3.3） |
| `MonitoredSubject` 被监测对象 | 被设备连续监测体征/姿态的自然人 | 绑定设备、床位、告警；归属于机构 |
| `AssessedPerson` 被评估对象 | 长护险申请/被评估的自然人 | 绑定 Application/AssessmentTask；与申请人同指 |
| `ServiceSubject` 服务对象 | 接受照护服务的对象 | 绑定服务计划/到访记录 |

> 同一自然人在实务中同时是 `MonitoredSubject`/`AssessedPerson`/`ServiceSubject`，但三者在各自域作为独立实体建模与授权，通过 `MonitoringBinding` 建立可追溯映射（对齐 `DOMAIN-GLOSSARY` 与 `PLATFORM-SPEC` §8）。

### 3.2 主键映射

`MonitoringBinding` 承载以下映射，一次绑定建立全链引用：

```
device_id ──┬─ person_id（对象自然人）
            ├─ assessment_id（评估任务）
            └─ service_plan_id（服务计划）
```

```json
{
  "binding_id": "MB-20260922-0001",
  "device_id": "HG2024xxxx",
  "person_id": "P00084",
  "assessment_id": "AT-20260922-0001",
  "service_plan_id": "SP-20260922-0001",
  "authorized_by": { "role": "insurer_staff", "account_id": "insurer01" },
  "authorized_at": "2026-09-20T09:00:00+08:00",
  "valid_from": "2026-09-20T00:00:00+08:00",
  "valid_to": "2026-12-31T23:59:59+08:00",
  "org_id": "kaijian",
  "site": "凯健护理院 4F-404A",
  "status": "active",
  "active": true
}
```

### 3.3 绑定规则

| 规则 | 说明 |
|---|---|
| 有效期 | `valid_from`/`valid_to` 定义绑定窗口；快照仅在窗口内可生成 |
| 授权人 | 绑定由 `insurer_staff` 或机构 `admin` 授权建立，`authorized_by`/`authorized_at` 留痕 |
| 机构与安装位置 | `org_id`（使用机构）+ `site`（安装位置：机构/床位/点位）记录设备服务环境 |
| 责任链 | 设备资产（`device_user`/`anqiao_ops`）→ 绑定授权（经办/机构）→ 评估结论（`assessor`）→ 待遇核定（`insurer_staff`/监管），各环节责任人可追溯 |
| 唯一性 | 同一窗口内一个 `person_id` 至多一条 `active` 绑定；重复绑定进入质量事件（§9 `duplicate_binding`） |

## 4. 评估主流程（Application → AssessmentResult）

> 本节固化申请→材料→评估→结果→审核→监管的正式流程与门禁；设备介入数据包（§5）在评估任务窗口内生成并随评估档案固化。

### 4.1 申请（Application）

- 发起人：`family_contact`（本人或其家属）或机构 `admin`/`user`（代提交）。
- 一个 `Applicant` 可有多份申请（不同期次），同一期内同一申请类型只允许一份有效申请。
- **自评门槛（NATIONAL_MANDATORY，表B）**：申请前申请人自评达依赖门槛（E/F/G 级）方可受理；门槛档位本身为 `LOCAL_CONFIG`（医保办发〔2021〕37号 表B）。
- **申请身份核验（NATIONAL_MANDATORY）**：受理阶段核验被评估对象有效身份凭证（`identity_verification`）（医保发〔2023〕29号 §20）。
- 状态机：`draft → submitted → materials_review → materials_pass → assess_pending →（materials_rejected → draft）`。

### 4.2 申请材料（Material）

- 材料按**清单模板**收集，模板 `material_template` 版本化；每份材料含 `material_id`、`template_item`、`file_ref`、`status`（`pending/collected/valid/invalid`）、`collected_by`、`validated_by`。
- 核验规则：`required=true` 项齐全方可 `materials_pass`；`valid` 由 `insurer_staff` 确认；材料有效期 `MATERIAL_VALID_DAYS`（默认 90 天）；影像材料不可删改，替换走新版本 `file_ref`。

### 4.3 评估任务（AssessmentTask）

- `materials_pass` 后由 `admin`/`insurer_staff` 派单生成任务，绑定评估员 `assessor`。
- **人员双类（NATIONAL_MANDATORY，医保发〔2023〕29号 §11–13）**：评估员（采集信息/协助现场）与评估专家（现场评估/提出结论/复评）分属两类；任务绑定上门人员 `assessor_ids`（≥2 人，其中 ≥1 名评估专家）。
- **评估回避校验（后端强制）**：`assessor` 与被评估对象所属机构存在利益关系时拒绝派单（409）；复评任务初次评估机构与人员回避（29号 §27）。
- 任务冻结 `scale_version` 于派单时；创建任务即打开设备介入窗口（§5.1）。

### 4.4 版本化量表（AssessmentScale）

- 量表为**不可变版本**：`scale_id` + `scale_version`；修改即新建版本。结构 `Scale → Item → Option`。
- 计分方式（`SCORE_RULE`）包括单条目分值、分域小计、总分、分档阈值、等级判定算法；规则版本与量表版本绑定，`AssessmentResult` 记录 `ruleset_version`。
- 国家评估标准（3 个一级指标 + 17 个二级指标、6 级划分、组合法判定）按官方版本配置接入，`scale_version`/`ruleset_version` 全程留痕。

### 4.5 评估结果（AssessmentResult）

```json
{
  "result_id": "AR-20260922-0105",
  "application_id": "APP-20260922-0001",
  "task_id": "AT-20260922-0001",
  "applicant_id": "P00084",
  "scale_version": "sc-2026-v3",
  "ruleset_version": "sc-2026-v3-r1",
  "domain_scores": { "自理能力": null, "认知": null, "精神行为": null, "感知沟通": null },
  "total_score": null,
  "disability_level": null,
  "evidence_refs": ["EV-A-..."],
  "monitoring_refs": ["EV-M-..."],
  "identity_verification": true,
  "assessor_ids": ["asr_003", "exp_002"],
  "onsite_at": "2026-09-23T10:00:00+08:00",
  "guardian_present": true,
  "video_evidence": "EV-A-VID-...",
  "expert_confirmation": ["exp_002", "exp_005"],
  "public_notice": null,
  "status": "draft",
  "assessor": { "account_id": "asr_003", "name": "王评估师" },
  "assessed_at": null,
  "confirmed_by": null,
  "confirmed_at": null
}
```

**结果状态与门禁**
- 状态流：`draft → submitted → pending_review → public_notice(公示) → approved / returned / suspended`。
- **双专家确认（NATIONAL_MANDATORY，29号 §22）**：结论经 ≥2 名评估专家确认（`expert_confirmation`）方可 `pending_review`。
- **现场门禁（NATIONAL_MANDATORY，37号 §4.5、29号 §21）**：`assessor_ids` ≥2 且含 ≥1 评估专家、`guardian_present=true`、`onsite_at` 存在、`video_evidence` 影像完整，方可 `submitted`。
- **公示门禁（NATIONAL_MANDATORY，29号 §23）**：达待遇等级结论经 `public_notice` 公示后方可 `approved`。
- **等级产出**：`disability_level` 在 `SCORE_RULE` 启用且 `total_score` 可计算时，由系统按规则给出建议等级，由评估师落定、`insurer_staff` 人工确认（`confirmed_by/confirmed_at`）后生效。
- **职责分工**：`disability_level` 由评估师依量表与证据形成，`benefit_decision` 由经办/监管核定产出；设备与 AI 记录独立存储（§6），与评估师结论通过 `monitoring_refs` 可追溯关联，不覆盖评估师判定。
- **有效期/复评（NATIONAL_MANDATORY，29号 §25/§29–30）**：结论有效期（重度失能 ≤2 年）为 `LOCAL_CONFIG`；满 6 个月、状态与结论不符、经办/医保局抽查发现变化触发重新评估。

### 4.6 经办审核 / 医保局监管 / 复核申诉

- **经办审核**：`insurer_staff` 核对评估完整、证据齐备、回避合规、无异常分；动作 `approve`/`return`（附 `reason`）/`request_more`；审核时限 `TIMEOUT_REVIEW_DAYS`（默认 5 工作日）。
- **医保局监管**：`medical_insurance_staff` 对统筹区申请/评估/结果只读抽审（`SUPERVISION_SAMPLE_RATE` 默认 10%）；可 `suspend`；监管记录 `supervision_id/scope/sample/result/remarks` 全量留痕。
- **复核/申诉**：`appeal_requested → appeal_reviewing → appeal_approved / appeal_overruled`；改判生成同申请新评估任务（复评），`assessment_result` 指向复评结果；申诉时限 `APPEAL_DEADLINE_DAYS`（默认 15 天）。

### 4.7 角色权限

（权限矩阵以 `docs/API-CONTRACT.md` §10.2 为准，本 Spec 细化流程级约束。）

| 角色 | 可执行流程动作 |
|---|---|
| `su` | 平台/机构/监管/经办/评估机构配置；全局只读监管 |
| `admin` | 长者档案、代提交申请、材料补录、评估派单（含回避校验）、设备绑定维护 |
| `user` | 代提交申请、上传材料、查看本机构长者与监测证据 |
| `family_contact` | 本人申请提交、材料上传、结果查看、申诉提出（仅绑定长者） |
| `medical_insurance_staff` | 统筹区只读抽审、`suspend`、调取交叉验证证据与监管报告 |
| `insurer_staff` | 材料核验、经办审核、申诉受理、待遇/结算核定、服务证据复核 |
| `assessor` | 本任务量表录入、证据采集、结果提交、设备数据包查看与处理；评估师作出评估意见 |
| `device_user` | 设备资产台账、发货/安装/退货、运维告警、质量事件处置 |

> **职责分工**：`assessor` 依据国家/地方正式量表、现场观察、询问、材料和证据形成评估意见；设备介入（`assistant_insight`/`cross_validation`/`risk_signal`/`monitoring_evidence`）为评估与监管提供客观数据支撑；`insurer_staff` 与监管对评估结论与待遇资格作审核与核定（见 §6/§7）。

## 5. 评估任务设备数据包

设备数据包在评估任务生命周期内生成并固化，形成随评估档案可追溯的 `assessment_snapshot`。

### 5.1 数据包流水线

```
任务创建 → 数据准备 → 窗口冻结 → 快照生成 → 评估师查看 → 交叉验证 → 人工处理 → 随评估档案固化
```

| 步骤 | 说明 |
|---|---|
| **任务创建** | 派单生成 `AssessmentTask` 时打开设备介入窗口 `assessment_window`（`from`=任务创建前回溯窗口起点，`to`=评估日）；窗口范围可由机构/经办按需设定（`LOCAL_CONFIG`） |
| **数据准备** | 采集 `MonitoredSubject` 在该窗口内的设备原始数据（hr/br/tp/isBed/body_movement/睡眠/跌倒姿态） |
| **窗口冻结** | 评估师首次查看或评估师提交结果时冻结窗口；冻结后窗口内数据基线固定，形成只读快照 |
| **快照生成** | 生成 `assessment_snapshot`，写入独立 `monitoring_evidence` 存储 |
| **评估师查看** | 评估师在任务工作台查看快照摘要与原始引用（§6） |
| **交叉验证** | 系统将设备摘要与现场观察/量表答案对照，产出 `cross_validation`（§7） |
| **人工处理** | 评估师对 `assistant_insight`/`cross_validation` 作出处理动作（§6.5） |
| **随评估档案固化** | 快照与处理记录随 `AssessmentResult` 固化，`monitoring_refs` 写入结果引用链 |

### 5.2 快照数据结构

```json
{
  "snapshot_id": "SNAP-20260922-0001",
  "assessment_id": "AT-20260922-0001",
  "person_id": "P00084",
  "binding_id": "MB-20260922-0001",
  "device_id": "HG2024xxxx",
  "assessment_window": { "from": "2026-08-25T00:00:00+08:00", "to": "2026-09-23T10:00:00+08:00" },
  "source_account": "platform",
  "device_status": "online",
  "coverage": { "expected_minutes": 41760, "covered_minutes": 38910, "coverage_pct": 93.2 },
  "missing_intervals": [
    { "from": "2026-09-01T02:00:00+08:00", "to": "2026-09-01T02:15:00+08:00", "reason": "device_offline" }
  ],
  "metrics": {
    "night_trips": 43, "in_bed_rate_pct": 61.2,
    "bed_leave_15min_count": 12, "fall_pose_events": 1,
    "hr_abnormal_days": 7, "tp_abnormal_days": 5,
    "avg_hr": 78.4, "avg_br": 18.2, "avg_tp": 36.7
  },
  "alerts": [
    { "type": "off_bed", "occurred_at": "2026-09-20T03:22:15+08:00", "level": 2, "handled_by": "李晓芳 护士" }
  ],
  "sleep_summary": { "avg_sleep_hours": 7.2, "awake_nights": 4, "fragmentation": "moderate" },
  "raw_refs": [
    { "kind": "vitals", "api": "/api/v1/hardware/latest_data", "ref": "raw://...", "range": "2026-08-25..2026-09-23" }
  ],
  "generated_by": { "role": "system", "account_id": "snapshot-engine" },
  "generated_at": "2026-09-23T10:02:00+08:00",
  "status": "frozen"
}
```

### 5.3 字段定义

| 字段 | 定义 |
|---|---|
| `assessment_window` | 评估数据窗口起止时间 |
| `snapshot_id` | 快照唯一标识，冻结后只读 |
| `source_account` | 数据来源（`platform` 设备平台） |
| `device_status` | 设备运行状态（§9） |
| `coverage` | 期望分钟/覆盖分钟/覆盖率；进入证据完整性判断 |
| `missing_intervals` | 缺失区间列表（起止 + 原因），原因映射 §9 质量状态 |
| `metrics` | 体征与行为统计（在床率、夜间离床、跌倒姿态、异常日数、均值） |
| `alerts` | 窗口内告警摘要（类型/时间/等级/处置人） |
| `sleep_summary` | 睡眠摘要（平均时长/清醒夜数/碎片化程度） |
| `raw_refs` | 原始数据引用（API 路径 + 数据区间），支持回查原文 |

### 5.4 固化与追溯

- 快照与处理记录**独立存储**于 `monitoring_evidence`，`AssessmentResult.monitoring_refs` 仅作引用关联。
- 冻结后窗口基线固定，任何再评估/申诉以同一窗口快照为对照基准；历史快照全量留存。

## 6. 评估师助手界面数据契约

评估师任务工作台以数据包方式呈现设备证据，供评估师查看、对照与处理。

### 6.1 界面字段

| 字段 | 来源 | 说明 |
|---|---|---|
| `hr` / `br` / `tp` | 设备 vitals | 心率/呼吸/体温（均值与最新值） |
| `isBed` | 设备在床 | 当前在床/离床状态 |
| `body_movement` | 设备姿态 | 身体活动度（0–N 级） |
| `online_rate` | §9 | 窗口内设备在线率 |
| `data_integrity` | §5.3 coverage | 数据完整性（覆盖率/缺失区间） |
| `off_bed` | alerts/metrics | 离床摘要（夜间离床次数、长时离床） |
| `sleep_summary` | §5.3 | 睡眠摘要 |
| 时间轴 | raw_refs | 按时间轴回放体征/告警/睡眠，可跳转原始引用 |

### 6.2 四类正式输出结构

设备介入的四类输出各自独立存储、结构正式、可追溯。

**`monitoring_evidence`（监测证据）**

```json
{
  "evidence_id": "EV-M-20260922-0001",
  "type": "monitoring_evidence",
  "snapshot_id": "SNAP-20260922-0001",
  "assessment_id": "AT-20260922-0001",
  "person_id": "P00084",
  "period": { "from": "2026-08-25", "to": "2026-09-23" },
  "metrics": { "night_trips": 43, "in_bed_rate_pct": 61.2 },
  "device_status": "online",
  "quality": { "coverage_pct": 93.2, "missing_intervals": [] },
  "conclusion": null,
  "stored_at": "2026-09-23T10:02:00+08:00"
}
```

> `conclusion` 字段为**观察性汇总占位**，仅保留指标汇总，不含待遇性判定；待遇相关结论由评估师与经办在 `assessment_result`/`benefit_decision` 中产出。

**`assistant_insight`（评估师助手洞察）**

```json
{
  "insight_id": "INS-20260922-0001",
  "type": "assistant_insight",
  "insight_version": "ins-2026-v1",
  "snapshot_id": "SNAP-20260922-0001",
  "assessment_id": "AT-20260922-0001",
  "input_evidence_refs": ["EV-M-20260922-0001"],
  "focus": "离床与跌倒风险",
  "summary": "窗口内夜间离床 43 次，长时离床 12 次，跌倒姿态 1 次",
  "suggestion": "建议评估师核验离床时段的服务响应记录",
  "assessor_handle": { "result": "adopted", "remark": "已核验，与夜班护理记录一致", "handled_by": "asr_003", "handled_at": "2026-09-23T11:00:00+08:00", "signature_ref": "sig://..." }
}
```

**`cross_validation`（交叉验证）**

```json
{
  "cv_id": "CV-20260922-0001",
  "type": "cross_validation",
  "snapshot_id": "SNAP-20260922-0001",
  "assessment_id": "AT-20260922-0001",
  "paired": [
    { "subject": "离床自理", "assessment_answer": "需帮助", "device_summary": "夜间离床 43 次需协助回床", "result": "consistent" }
  ],
  "overall": "consistent",
  "suggestion": "设备摘要与量表答案一致，可作评估参考",
  "generated_at": "2026-09-23T11:05:00+08:00"
}
```

**`risk_signal`（风险线索）**

```json
{
  "signal_id": "RS-20260922-0001",
  "type": "risk_signal",
  "snapshot_id": "SNAP-20260922-0001",
  "source": "cross_validation",
  "pattern": "service_evidence_mismatch",
  "summary": "服务记录离院时段与设备在床摘要不一致",
  "level": "attention",
  "proposed_next": "recheck",       // recheck | request_more | reassess | sample_review
  "generated_at": "2026-09-23T11:06:00+08:00"
}
```

### 6.3 处理动作（assessor_handle）

评估师对每条 `assistant_insight`/`cross_validation` 作处理，动作枚举：

| 动作 | 标识 | 语义 |
|---|---|---|
| 确认 | `confirmed` | 评估师确认设备摘要与现场一致，作为评估参考 |
| 采纳 | `adopted` | 评估师采纳建议并据此核验现场 |
| 驳回 | `rejected` | 评估师驳回建议，附说明理由 |
| 需人工核查 | `needs_manual_review` | 转人工进一步核查 |

每次处理记录 `result`、`remark`（说明）、`handled_by`（处理人）、`handled_at`（时间）、`signature_ref`（签名），随评估档案固化并留痕。

### 6.4 处理与结论链

- 每条 `assistant_insight`/`cross_validation` 必须含评估师处理动作，方随评估档案固化。
- 设备/AI 记录独立存储于 `monitoring_evidence`/`assistant_insight`，评估师在 `AssessmentResult` 中落定等级；`monitoring_refs` 建立引用关联，二者可追溯、不覆盖。
- `risk_signal` 作为风险线索进入监管风险案件（§17），由经办/监管按流程核查。

## 7. 交叉验证规则表

交叉验证将**现场观察/量表答案**与**设备摘要**对应，产出明确结果，每条规则含触发条件、输出、责任人、下一步。

### 7.1 结果枚举

| 结果 | 标识 | 含义 |
|---|---|---|
| 一致 | `consistent` | 设备摘要与现场/量表答案相互印证 |
| 差异 | `discrepancy` | 设备摘要与现场/量表答案存在差异 |
| 数据不足 | `insufficient` | 设备覆盖/质量不足以支撑对照 |
| 设备异常 | `device_anomaly` | 设备运行或绑定状态影响数据可信度 |
| 需要复核 | `needs_review` | 差异或异常需人工复核后决定 |

### 7.2 规则表

| # | 触发条件 | 输出 | 责任人 | 下一步 |
|---|---|---|---|---|
| R1 | 量表「离床/行走自理」答案与设备离床摘要（夜间离床次数/长时离床）量级一致 | `consistent` | 系统 + 评估师确认 | 采纳为评估参考 |
| R2 | 量表「在床/翻身」答案与设备 `in_bed_rate_pct` 明显相左 | `discrepancy` | 系统 + 评估师 | 评估师现场核验并留记录 |
| R3 | 现场观察「跌倒风险」高，设备 `fall_pose_events` 多次命中 | `consistent` + `risk_signal(attention)` | 系统 + 评估师 | 评估师纳入评估意见，转风险线索 |
| R4 | 窗口内设备 `coverage_pct` 低于阈值或 `missing_intervals` 显著 | `insufficient` | 系统 + `device_user` | 补采/说明缺失原因，评估师结合现场判断 |
| R5 | `device_status` 进入 `offline`/`clock_skew` 等质量状态 | `device_anomaly` | `device_user` | 处置质量事件（§9），数据窗口重算或标注 |
| R6 | 设备摘要与量表答案差异且无合理解释 | `needs_review` | 评估师 + 经办 | 评估师复核，必要时转复核/抽审 |
| R7 | 服务时段设备摘要与服务到访记录不一致 | `needs_review` + `risk_signal` | 经办 + 监管 | 服务证据复核（§8），进入监管核查 |

> 交叉验证结果随快照固化，输出 `cross_validation` 记录；`needs_review`/`risk_signal` 进入 §17 监管风险案件，由经办/监管按流程处置。

## 8. 服务实施数据包

服务实施环节以设备过程数据支撑履约核查，形成可复核、可供医保查看的服务证据。

### 8.1 服务实体关联

```
ServicePlan(服务计划) ─┬─ ServiceVisit(服务到访) ── 实名签到/时间/地点/服务对象确认/护理记录
                       └─ MonitoringBinding.device_id ── 设备在线/数据窗口
```

- `ServicePlan` 关联 `service_plan_id`、最终核定等级、服务项目/频次/机构。
- `ServiceVisit` 记录实名签到（`identity`）、时间（`time`）、地点（`location`）、服务对象确认（`care_plan_confirmation`）、护理记录（`care_record`）。
- 设备在线与数据窗口：通过 `MonitoringBinding` 关联设备，取到访时段前后数据窗口作履约比对。

### 8.2 服务证据状态

| 状态 | 标识 | 含义 |
|---|---|---|
| 匹配 | `matched` | 服务到访记录与设备数据窗口、服务对象在位状态一致 |
| 部分匹配 | `partial` | 到访记录与设备数据窗口部分对应（如时长偏差） |
| 不匹配 | `mismatch` | 到访记录与设备数据窗口明显不符（如记录在床履约而设备显示离院） |
| 不可用 | `unavailable` | 设备数据/窗口无法取得（离线、无绑定） |

### 8.3 服务证据形成、复核与医保查看

```json
{
  "service_evidence_id": "SE-20260922-0001",
  "service_plan_id": "SP-20260922-0001",
  "service_visit_id": "SV-20260922-0012",
  "person_id": "P00084",
  "device_id": "HG2024xxxx",
  "visit_time": "2026-09-21T09:00:00+08:00",
  "visit_location": "凯健护理院 4F-404A",
  "identity_verified": true,
  "care_plan_confirmation": { "confirmed_by": "孙**", "confirmed_at": "2026-09-20T10:00:00+08:00" },
  "device_window": { "from": "2026-09-21T08:50:00+08:00", "to": "2026-09-21T09:20:00+08:00", "device_status": "online" },
  "service_evidence_status": "matched",
  "created_at": "2026-09-21T10:00:00+08:00"
}
```

- **形成**：系统在 `ServiceVisit` 落库后关联设备数据窗口，生成服务证据记录。
- **复核**：`insurer_staff` 对 `partial`/`mismatch` 复核，结合护理记录与设备摘要；复核结论留痕。
- **医保查看**：`medical_insurance_staff` 在统筹区监管中只读调取服务证据与设备摘要，作抽审/复核参照。

## 9. 设备数据质量

设备数据质量状态进入证据包与报告，每一状态有明确处置动作与责任人。

### 9.1 质量状态枚举

| 状态 | 标识 | 含义 |
|---|---|---|
| 离线 | `offline` | 设备下线，无数据上报 |
| 缺失窗口 | `missing_window` | 覆盖区间内数据缺失（时长/区间） |
| 时钟偏差 | `clock_skew` | 设备时钟偏移，时间戳不可信 |
| 未绑定 | `unbound` | 设备未建立有效 `MonitoringBinding` |
| 重复绑定 | `duplicate_binding` | 同一对象/窗口存在多条 active 绑定 |
| 延迟上传 | `late_upload` | 数据迟于窗口冻结后上传 |

### 9.2 质量状态处置表

| 状态 | 进入证据包的表现 | 处置动作 | 责任人 |
|---|---|---|---|
| `offline` | 覆盖率下降、`device_status=offline` | 排查恢复在线，恢复后补采或重算窗口 | `device_user` |
| `missing_window` | `missing_intervals` 记录缺失区间 | 补采/标注原因，评估师结合现场判断 | `device_user` + `assessor` |
| `clock_skew` | 时间戳不可信，纳入 `device_anomaly` | 校时/重算时间轴，数据窗口重算 | `device_user` |
| `unbound` | 快照无法关联对象/评估 | 建立或重建有效 `MonitoringBinding` | `insurer_staff`/`admin` |
| `duplicate_binding` | 进入 `insufficient`/`device_anomaly` | 清理冗余绑定，保留有效一条 | `admin`/`device_user` |
| `late_upload` | 冻结后数据不入快照基线 | 冻结后数据作增量存档，基线固定 | 系统 + `device_user` |

### 9.3 质量报告

- 质量状态汇总进入证据包元数据（`quality`）与运营质量报告（§13.4）。
- 报告按状态归类统计并标注责任人处置记录，供 `device_user`/`admin` 运营管理与监管抽查参照。

## 10. 角色工作台视图

各角色工作台呈现其在设备介入中的职责视图。

| 角色 | 工作台视图 | 数据范围 |
|---|---|---|
| `medical01`（medical_insurance_staff） | 被评估对象的设备证据、交叉验证、服务证据、风险线索；统筹区只读抽审 | pool（统筹区） |
| `insurer01`（insurer_staff） | 案件内数据：评估数据包、交叉验证证据、服务证据、审核/复核入口 | pool（本统筹区案件内） |
| `assessor01`（assessor） | 任务数据包（§5/§6）与处理入口（§6.3），对照现场与设备摘要 | task（仅本人任务） |
| `admin01`（platform_operator/现状 admin） | 设备资产与运行质量（台账、在线率、质量事件处置） | org（设备资产） |
| 护理机构账号（nursing_admin/nursing_nurse） | 服务对象与服务证据（§8）、设备绑定与告警 | org / assigned |

> 硬性隔离（延续 `PLATFORM-SPEC` §5.1）：`medical01/insurer01/assessor01` 的令牌租户为各自组织，跨租户访问返回 404；监管侧经跨机构只读监管视图查看已授权、脱敏、纳入统筹区的对象，不裸看护理院运营数据。

## 11. 设备介入 API 契约

统一响应包 `{ code, msg, data }`，错误码 400/401/403/404/500；时间 ISO 8601 东八区；鉴权 Bearer 令牌。

> **路由注册表**：`/v1/ltc/*` **路径全集**以 `docs/API-CONTRACT.md` §3.4 为唯一来源（v0.3）。本节 S1–S6 固化**设备介入子集**的请求/响应与权限语义；其余长护险路由（申请/任务/工单/结算/监管/报告等）的字段与流程仍以本 Spec §4–§18 为准，路径见 API-CONTRACT §3.4。

| # | 方法 | 路径 | 说明 | 请求 | 响应 | 权限 |
|---|---|---|---|---|---|---|
| S1 | POST | `/v1/ltc/snapshots` | 快照生成（窗口冻结 → 生成 `assessment_snapshot`） | `{assessment_id, window:{from,to}}` | `{snapshot_id, status:"frozen", quality}` | `assessor`（本人任务）/`insurer_staff`/`admin` |
| S2 | GET | `/v1/ltc/snapshots/{snapshot_id}` | 快照查询（摘要 + 原始引用） | — | `assessment_snapshot`（§5.2） | `assessor`（本人任务）/`insurer_staff`/`medical_insurance_staff`（统筹区）/`admin` |
| S3 | POST | `/v1/ltc/insights/{insight_id}/handle` | 交叉验证/洞察处理 | `{result: confirmed|adopted|rejected|needs_manual_review, remark, signature_ref}` | `{handle_id, handled_by, handled_at}` | `assessor`（本人任务） |
| S4 | GET | `/v1/ltc/service-evidence` | 服务证据查询 | `{service_plan_id?, service_visit_id?, person_id?, status?, period?}` | `{list:[service_evidence], total}` | `insurer_staff`/`medical_insurance_staff`（统筹区）/护理机构（org） |
| S5 | GET | `/v1/ltc/quality-events` | 质量事件查询 | `{device_id?, status?, from?, to?}` | `{list:[quality_event], total}` | `device_user`/`admin` |
| S6 | GET | `/v1/ltc/reports/{type}` | 报告证据查询 | `{applicant_id?, period?, snapshot_id?, scale_version?}` | `report`（§13） | 按 §13 各报告角色 |

**权限语义**：越权读他人数据返回 404，无权限动作返回 403；`assessor` 仅本人任务，`insurer_staff` 本统筹区案件内，`medical_insurance_staff` 统筹区只读，护理机构账号本组织/分配范围。

## 12. 可执行验收标准（Acceptance Criteria）

> 以下为标准 Given/When/Then 验收，覆盖设备介入全链；实现变更须通过全部用例。

### 12.1 绑定与对象

- [ ] **GWT-1 绑定建立**：Given 有效 `insurer_staff` 与 `device_user`，When 为 `person_id` 建立含 `device_id/assessment_id/service_plan_id` 的 `MonitoringBinding`，Then 返回 `active` 绑定且 `authorized_by/authorized_at/valid_from/valid_to/org_id/site` 完整留痕。
- [ ] **GWT-2 绑定有效期**：Given 窗口超出 `valid_to`，When 请求生成快照，Then 返回 409 并提示绑定窗口外。
- [ ] **GWT-3 重复绑定**：Given 同一窗口已存在 `active` 绑定，When 再次建立，Then 进入 `duplicate_binding` 质量事件且新绑定不生效。
- [ ] **GWT-4 责任链**：Given 一条快照，When 追溯，Then 可关联 `device_user→binding(insurer_staff)→assessor→insurer_staff` 全链责任人。

### 12.2 窗口冻结与快照

- [ ] **GWT-5 窗口打开**：Given 派单创建 `AssessmentTask`，When 任务就绪，Then 打开 `assessment_window` 并允许数据准备。
- [ ] **GWT-6 快照生成**：Given 窗口数据齐备，When 触发快照生成（S1），Then 产出 `assessment_snapshot` 含 `assessment_window/snapshot_id/coverage/metrics/alerts/sleep_summary/raw_refs`。
- [ ] **GWT-7 窗口冻结**：Given 评估师首次查看或提交，When 冻结窗口，Then 快照 `status=frozen`，冻结后数据不入基线。
- [ ] **GWT-8 只读快照**：Given 已冻结快照，When 任意角色修改，Then 修改被拒（400）且历史全量留存。

### 12.3 评估师处理

- [ ] **GWT-9 处理动作**：Given 一条 `assistant_insight`，When 评估师提交 `confirmed/adopted/rejected/needs_manual_review`，Then 记录 `result/remark/handled_by/handled_at/signature_ref`。
- [ ] **GWT-10 结论链追溯**：Given 评估师在 `AssessmentResult` 落定等级，When 调取 `monitoring_refs`，Then 可回溯到快照与 `assistant_insight`，设备记录与人工结论独立存储、互不覆盖。

### 12.4 审计与服务证据

- [ ] **GWT-11 审计留痕**：Given 绑定建立、窗口冻结、快照生成、处理动作，When 任一发生，Then 写入审计日志 `who/when/before/after`。
- [ ] **GWT-12 服务证据形成**：Given `ServiceVisit` 落库，When 关联设备数据窗口，Then 生成 `service_evidence` 且 `service_evidence_status` 为 `matched/partial/mismatch/unavailable` 之一。
- [ ] **GWT-13 服务证据复核**：Given 一条 `mismatch` 服务证据，When `insurer_staff` 复核，Then 复核结论留痕并进入服务监管报告。

### 12.5 权限

- [ ] **GWT-14 角色数据范围**：Given `medical01` 查看服务证据，When 数据属于本统筹区，Then 返回数据；When 跨统筹区，Then 返回 404。
- [ ] **GWT-15 越权与无权限**：Given `assessor01` 访问非本人任务快照，When 读取，Then 返回 404；Given 无权限角色调用处理接口，When 执行，Then 返回 403。

### 12.6 数据质量

- [ ] **GWT-16 质量事件**：Given 设备进入 `offline`/`clock_skew`，When 生成快照，Then 快照 `quality` 标注对应质量状态且进入质量事件（S5）。
- [ ] **GWT-17 质量处置**：Given `duplicate_binding` 质量事件，When `admin` 处置，Then 清理冗余绑定并留痕，证据包质量状态更新。

### 12.7 报告

- [ ] **GWT-18 报告生成**：Given 指定周期与 `snapshot_id`，When 生成报告，Then 报告含 `source/snapshot_id/period/generated_by/review_status` 且按角色返回（§13）。

## 13. 报告数据结构

| 报告类型 | 说明 | 主要角色 |
|---|---|---|
| 用户健康报告 | 被监测对象体征/睡眠/告警趋势画像 | `family_contact`（本人绑定）、`admin`/`user` |
| 长护险评估辅助报告 | 评估窗口设备摘要 + 交叉验证 + 风险线索，随评估档案固化 | `assessor`、`insurer_staff`、`medical_insurance_staff` |
| 服务监管报告 | 服务证据状态统计 + 履约比对 + 复核结果 | `insurer_staff`、`medical_insurance_staff`、护理机构 |
| 运营质量报告 | 设备资产/在线率/质量事件/处置责任人 | `device_user`、`admin` |

统一报告结构：

```json
{
  "report_id": "RP-20260922-0001",
  "report_type": "assessment_support",
  "source": "real",                     // real | seed | mixed
  "snapshot_id": "SNAP-20260922-0001",
  "period": { "from": "2026-08-25", "to": "2026-09-23" },
  "generated_by": { "role": "report-engine", "account_id": "sys" },
  "review_status": "draft",             // draft | reviewing | approved
  "data_scope": "task",
  "content": {}
}
```

- 每份报告标注 `source`（真实库/模拟种子/混合）、`data_scope`、`generated_by`、`review_status`。
- 长护险评估辅助报告、服务监管报告在纳入监管/待遇决定前经相应角色复核（`review_status` 流转）；设备/AI 类报告内容为数据摘要与风险线索，`disability_level`/`benefit_decision` 由评估师/经办产出。

## 14. 待配置项（Config Registry）

> 以下项必须经配置/管理界面注入，禁止硬编码假设当地规则。

| 键 | 默认值 | 说明 |
|---|---|---|
| `TIMEOUT_MATERIALS_DAYS` | 3 | 材料核验时限（工作日） |
| `MATERIAL_VALID_DAYS` | 90 | 材料有效期（天） |
| `TIMEOUT_REVIEW_DAYS` | 5 | 经办审核时限（工作日） |
| `APPEAL_DEADLINE_DAYS` | 15 | 申诉受理截止（天） |
| `ALLOW_REMOTE_ASSESSMENT` | false | 是否允许远程/视频评估 |
| `SUPERVISION_SAMPLE_RATE` | 0.10 | 医保局抽审比例 |
| `SCORE_RULE` | 未启用 | 量表计分/分档/等级算法（依当地医保局，按官方版本医保办发〔2021〕37号 配置） |
| `DOMAIN_WEIGHT` | 等权 | 分域权重 |
| `SELF_ASSESS_THRESHOLD` | E/F/G | 自评表B依赖门槛 |
| `ASSESSOR_ON_SITE_MIN` | 2（含 ≥1 专家） | 上门人数下限（国家 ≥2/≥1 专家为 NATIONAL_MANDATORY） |
| `VIDEO_MIN_DURATION` | 待配置 | 全程影像最低时长阈值 |
| `ASSESSMENT_VALID_MONTHS` | 重度 ≤24 | 评估结论有效期（月） |
| `PUBLIC_NOTICE_DAYS` | 待配置 | 达待遇等级结论公示期 |
| `PAYMENT_RATIO` | 未配置 | 支付比例（禁止硬编码，医保函〔2025〕300号） |
| `BENEFIT_START_LEVEL` | 待配置 | 待遇起点失能等级 |
| `SERVICE_CATALOG_MAP` | 国家目录对照 | 服务项目目录对照映射 |
| `DEVICE_WINDOW_BACKDAYS` | 待配置 | 设备介入窗口回溯天数 |
| `COVERAGE_THRESHOLD_PCT` | 待配置 | 数据完整性达标阈值 |
| `DUPLICATE_BINDING_WINDOW` | 待配置 | 重复绑定判定窗口 |

## 15. 国家标准对齐与评估门禁

> 依据与条款号见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §2/§4。国家评估标准通过 versioned `scale`/`ruleset` 配置接入，本 Spec 不写死具体分值。

| 规则 | 分级 | 可执行条件 |
|---|---|---|
| 评估工具：3 个一级指标 + 17 个二级指标、6 级划分、组合法判定 | NATIONAL_MANDATORY | `AssessmentScale` 按官方版本发布；地方细化仅 LOCAL_CONFIG |
| 自评门槛（表B） | NATIONAL_MANDATORY（档位 LOCAL_CONFIG） | 未达依赖门槛的申请 `reject` |
| 受评对象身份核验 | NATIONAL_MANDATORY | 受理/现场核验 `identity_verification` |
| 双人上门且 ≥1 评估专家 | NATIONAL_MANDATORY | `assessor_ids` ≥2 且含 ≥1 专家 |
| ≥1 监护人或代理人在场 | NATIONAL_MANDATORY | `guardian_present=true` |
| 现场时间 | NATIONAL_MANDATORY | `onsite_at` 存在 |
| 全程影像完整性 | NATIONAL_MANDATORY（时长阈值 LOCAL_CONFIG） | `video_evidence` 含时间/地点/时长 |
| ≥2 名评估专家确认结论 | NATIONAL_MANDATORY | `expert_confirmation` ≥2 名 |
| 利益回避 | NATIONAL_MANDATORY | 评估机构≠护理服务≠经办；复评回避 |
| 公示 | NATIONAL_MANDATORY（期/范围 LOCAL_CONFIG） | 达待遇等级须 `public_notice` |
| 有效期/复评 | 有效期 LOCAL_CONFIG（重度 ≤2 年 NATIONAL_MANDATORY） | 到期前触发复评；满 6 个月/变化触发重评 |
| 定点/协议/退出与失信 | NATIONAL_MANDATORY | 定点评估机构、协议管理、失信联动 |
| 设备介入定位 | NATIONAL_MANDATORY | AI 健康守护仪为连续性监测工具，提供客观状态摘要、交叉验证证据、过程数据支撑 |
| 评估师为专业责任主体 | NATIONAL_MANDATORY | 评估师依量表与证据形成评估意见 |
| 职责分工与独立存储 | NATIONAL_MANDATORY | 设备数据/AI 分析/评估师人工结论分别存储、可追溯关联 |

## 16. 服务实施与结算证据

> 依据：医保办发〔2024〕21号 §16/§17/§19–22、医保办发〔2024〕22号 §28/§31/§34/§36、医保函〔2025〕300号，详见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §5。

| 规则 | 分级 | 可执行条件 |
|---|---|---|
| 护理服务计划经参保人确认 | NATIONAL_MANDATORY | `care_plan_confirmation`（`confirmed_by/confirmed_at`），未确认不实施服务 |
| 一人一档 | NATIONAL_MANDATORY | 服务对象按 `ServicePlan` 建档，服务文书电子档案 |
| 服务实名与身份核验 | NATIONAL_MANDATORY | `service_visit.identity`；护理服务人员实名制 |
| 服务计划一致性 | NATIONAL_MANDATORY | `ServiceVisit` 与 `ServicePlan` 类型/频次/时长/配比一致 |
| 时间/地点/频次异常 | NATIONAL_MANDATORY（阈值 LOCAL_CONFIG） | `service_visit.time/location` 记录；异常进筛查 |
| 结算四步分离 | NATIONAL_MANDATORY | `Settlement` 拆「申报→初审→复核→拨付」，初审/复核发现违规不予支付 |
| 暂停/取消待遇 | NATIONAL_MANDATORY | 参保人违规暂停联网结算、暂停/取消待遇 |
| 违约追回/禁业 | NATIONAL_MANDATORY | 追回违规费用；机构负责人 5 年禁业 |
| 医保监管抽查 | 抽审比例 LOCAL_CONFIG | 经办日常核查 + 定期抽查（`SUPERVISION_SAMPLE_RATE`） |
| 服务项目目录 | LOCAL_CONFIG | `SERVICE_CATALOG_MAP` 国家目录对照 |
| 支付比例/待遇起点 | LOCAL_CONFIG（禁止硬编码） | `PAYMENT_RATIO`、`BENEFIT_START_LEVEL` 入配置 |

> 服务/结算门禁对应 `docs/PLATFORM-SPEC.md` §11.5。服务证据（§8）以设备过程数据支撑履约核查，作为服务监管报告的输入；命中异常的风险线索进入人工核查，最终由经办/医保监管按流程认定。

## 17. 监管风险案件

> 依据：医保发〔2023〕29号 §31–33、医保发〔2024〕13号 §18/§23–24、医保办发〔2024〕22号 §31/§34/§36、国务院令第735号、法发〔2024〕6号，详见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §4/§5/§6。

- **风险案件来源**：评估阶段门禁拦截项、服务/结算证据拦截项、交叉验证 `needs_review`/`risk_signal`、投诉举报/社会监督、评估结论与服务结算抽查。
- **案件闭环**：线索 → 人工核查 → 认定（违规/违约/涉嫌犯罪）→ 处置留痕（追回、暂停/取消待遇、暂停资格、追回+罚款、解约、禁业、移送司法）。
- **处置分级（后端留痕接口）**：
  - 基金损失且属实：按「追回 → 行政 → 司法」路径处置并留痕。
  - 参保人违规：暂停联网结算 3–12 个月、暂停/取消待遇。
  - 机构违约：追回费用、机构负责人 5 年禁业、相关人员暂停支付资格 3–12 个月。
  - 涉嫌犯罪：按法发〔2024〕6号 移送司法。
- **监管记录**：`supervision_id/scope/sample/result/remarks/disposal` 全量留痕；`risk_signal`/`cross_validation` 为风险线索，进入人工核查。
- **处置责任**：风险线索经人工核查后，由经办/医保监管按流程认定并处置留痕。

## 18. 证据字段与留痕

> 字段显式落库并随记录留痕；量表/规则版本绑定 `scale_version`/`ruleset_version`。

| 字段 | 阶段 | 说明 |
|---|---|---|
| `assessor_ids` | 评估 | 上门人员（≥2，含 ≥1 专家） |
| `expert_confirmation` | 评估 | 结论确认的评估专家（≥2 名） |
| `guardian_present` | 评估 | 监护人或代理人在场 |
| `onsite_at` | 评估 | 现场评估时间 |
| `video_evidence` | 评估 | 全程影像（含时间/地点/时长） |
| `identity_verification` | 评估/服务 | 参保人/护理人员身份核验 |
| `public_notice` | 评估 | 达待遇等级结论公示记录 |
| `care_plan_confirmation` | 服务 | 护理服务计划参保人确认 |
| `service_visit.identity` | 服务 | 服务实名（参保人/护理员） |
| `service_visit.time` / `.location` | 服务 | 服务打卡时间/地点（异常筛查） |
| `settlement.review_separation` | 结算 | 申报→初审→复核→拨付四步分离留痕 |
| `assessment_snapshot` | 设备 | 冻结快照（§5.2）含 `assessment_window/snapshot_id/coverage/metrics/alerts/sleep_summary/raw_refs` |
| `assessor_handle` | 设备 | 处理动作 `result/remark/handled_by/handled_at/signature_ref` |
| `service_evidence_status` | 服务 | `matched/partial/mismatch/unavailable` |
| `quality` | 设备 | 质量状态 `offline/missing_window/clock_skew/unbound/duplicate_binding/late_upload` |

**设备/AI 助手记录（独立存储、可追溯）**：`monitoring_evidence`（快照）/`assistant_insight`（AI 分析）/`cross_validation`/`risk_signal` 分别落库，经 `snapshot_id`/`insight_id`/`cv_id`/`signal_id` 与 `assessment_result.monitoring_refs` 双向关联；`insight_version`、`input_evidence_refs`、`assessor_handle`（处理结果/处理人/时间）随记录留痕。
