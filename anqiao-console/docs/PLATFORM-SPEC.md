# 中科安樵多机构长护险与大健康平台总体 Spec

> 状态：**总体基线 Spec v0.1（平台承载边界）**；评估执行规则、状态机与验收以 `docs/LTC-INSURANCE-SPEC.md` 为唯一来源，本 Spec 仅定义多组织/多域/权限/数据范围的承载边界；接口细节见 `docs/API-CONTRACT.md`。
> 日期：2026-09-22
> 读者：产品、后端、前端、业务方（政府/医保局/经办/照护机构/合作伙伴）
> 关联：`docs/API-CONTRACT.md`（账号/组织/报告基线）、`docs/LTC-INSURANCE-SPEC.md`（流程/状态机/验收）、`docs/RESEARCH-LTC-ANTI-FRAUD.md`（政策与监管调研，反欺诈条款的一手来源）、`docs/DOMAIN-GLOSSARY.md`（术语）、`docs/ACCOUNT-MATRIX.md`（现状账号矩阵）、`docs/INTEGRATION-SPEC.md`（仓库拓扑/部署/切换窗口基线）
>
> ⚠️ **硬性基线（贯穿全文档）**
> 1. **全国评估/监管标准优先于地方假设**：失能等级判定统一执行全国评估标准与《评估操作指南》（国家医保局/民政部，见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §1 文号清单），国家文件**明确**的要求是硬性门禁，地方仅在差异处做**配置化假定**；禁止把地方支付比例、待遇起点、有效期等写成代码或 Spec 缺省。本 Spec 只定义**平台承载边界**，评估执行与设备介入的可执行约束、状态机与验收一律以 `docs/LTC-INSURANCE-SPEC.md` 为唯一来源；未定口径见 §14 开放项。
> 2. **反欺诈为强制门禁**：评估阶段（§11.4）与服务实施/结算阶段（§11.5）的全国性反欺诈要求为**阻断项**，不满足即禁止进入下一环节；可配置的口径（抽审比例、公示范围、时限等）一律入配置注册表（`docs/LTC-INSURANCE-SPEC.md` §14/§15），国家未给固定值的不硬编码。
> 3. **正式医保/经办评分规则以配置为准**：凡涉及失能等级分档、待遇额度的规则经配置（`SCORE_RULE`）注入；量表版本、规则版本可配置并留痕。
> 4. **设备介入为正式业务能力，执行细节唯一引用 `docs/LTC-INSURANCE-SPEC.md`**：AI 健康守护仪是长护险评估与服务监管的**连续性监测工具**，为评估师提供客观状态摘要、为经办/医保局提供可追溯交叉验证证据、为服务实施提供过程数据支撑。**本 Spec 只定义平台承载关系**：设备资产中心以 `monitoring_evidence`（监测证据）、`assistant_insight`（评估师助手洞察）、`cross_validation`（交叉验证）、`risk_signal`（风险线索）四类数据产品提供给长护险域；其生成、结构、处理动作、交叉验证规则、报告结构等执行细节以 `docs/LTC-INSURANCE-SPEC.md`（§5–§13）为唯一来源，本 Spec 不复述。
> 5. **职责分工（正向）**：评估师依据国家/地方正式量表、现场观察、询问与材料证据形成评估意见；经办与医保监管对评估结论、待遇资格作审核与核定；设备介入为上述环节提供数据摘要、证据完整性、前后一致性提示与风险线索。评估等级、待遇资格与最终核定由正式评估与审核流程中的相应责任主体产出。

---

## 1. 产品定位

中科安樵平台从前身「护理院 SaaS（单护理院大屏监测）」升级为：

> **一个承载多个业务域、多机构、多租户的产业平台**：「护理院」只是其中的一类服务机构与一套工作台（workbench），不再是唯一或默认的产品形态。

- **业务域（多域）**：长护险监管、护理/养老服务、大健康运营、设备资产运营、合作伙伴渠道。各域共享账号/组织/权限/审计底座，但领域实体各自独立（见 §8 身份分离）。
- **机构（多机构/多租户）**：医保局、经办机构、评估机构、护理院、养老机构、健康管理/运营机构、合作伙伴、亲属联系人均可接入；每类机构有各自的组织类型、角色集与工作台。
- **厂商自营**：中科安樵运营组织同时承担「自营设备运营方」与「平台设备资产所有者/发货方」两个身份上下文。
- **默认首页由「角色 + 工作台」决定**：登录后进入的是该账号所属角色的工作台首页，**不再把护理院大屏（`ConsoleApp`/`ConsoleDashboard`）作为所有角色的默认首页**（见 §13 阶段一）。

### 1.1 单底座双端展现矩阵（管理端 vs 数据驾驶舱大屏）

`anqiao-console/server/` 作为全系统的单一权威业务底座与后台，向下连接物联设备云与 SQLite 持久化层，向上同时为两大前端展现形态提供统一的 `/v1` REST + WebSocket 服务：

| 展现层维度 | SaaS 管理端控制台 (`anqiao-console`) | 数据驾驶舱大屏端 (`suqian-dashboard` / `anqiao-dashboard`) |
|---|---|---|
| **产品定位** | 多角色日常事务处理与闭环管理平台 | 空间孪生、实时巡查与宏观运行态势展示大屏 |
| **部署入口** | `/saas/` | 宿迁长护险 `/suqian-dash/`；凯健/全国看板 `/dash/` |
| **交互形态** | 强交互、深度表单、多标签页切换、审批流转、审计留痕 | 100寸大屏自适应等比缩放、无人值守自动巡航、波形可视化、矢量地图 |
| **目标角色** | 9 大岗位（系统超管、医保监管、长护经办、现场评估、机构院长、责任护士、厂商运营、设备监控、合作伙伴/家属） | 决策层汇报、监控值班室大屏、展厅接待、医保监管巡视屏 |
| **鉴权模型** | 严格 Bearer JWT 令牌；基于 RBAC + 7 种 Data Scope 细粒度收敛 | 同源反代 `/v1`，使用只读会话；严禁包含业务写操作 |
| **契约消费** | `/v1/auth/*`、`/v1/ltc/*`、`/v1/alerts` (+claim/handle)、`/v1/ws` | `/v1/project/config`、`/v1/floors`、`/v1/wards`、`/v1/beds`、`/v1/stats/*`、`/v1/overview`、`/v1/patients`、`/v1/alerts`、`/v1/ws` |
| **合规红线** | 证据链锁定、不可篡改、越权 404/403、AI 洞察人工闭环确认 | 宿迁恒 3 台设备、云扫描只比对不写回；零静默 mock 假数据回退 |

## 2. 术语与层次模型

> 词汇唯一权威定义以 `docs/DOMAIN-GLOSSARY.md` 为准；本节补充**平台层次模型**，用于厘清几组纠缠概念。三大纠结点：
> - **账号 ≠ 角色**：账号是可登录主体；角色是账号获得的权限集合。同一角色可有多个账号，同一账号在一个主体内绑定唯一角色。
> - **角色 ≠ 组织**：组织是主体的归属容器；角色不决定组织，仅是主体在组织内的授权身份。`assessor` 属于评估机构组织，但评估的数据范围是「本人任务」，与其组织归属不同。
> - **组织 ≠ 数据范围**：数据范围（Data Scope）决定「可见哪些数据」，由角色策略决定，不一定等于「本组织」。`medical_supervisor` 在医保局组织，但数据范围是「统筹区 pool」。

### 2.1 层次对象

| 对象 | 标识 | 定义 | 关键约束 |
|---|---|---|---|
| **Principal（主体）** | `principal_id` | 一个可登录/可被授权的身份主体。登录请求携带账号解析为主体。 | 与账号一一对应；响应中携带 `principal`（见 ACCOUNT-MATRIX §2） |
| **Account（账号）** | `username/account_id` | 平台登录身份实体，密码/令牌载体。 | 一账号仅属一个组织；`family_contact` 为联系人实体，非登录账号 |
| **Organization（组织）** | `org_id / tenant_id` | 机构的归属容器；`tenant_id == org_id`。 | 多租户隔离维度（见 §4 组织类型表） |
| **Tenant（租户）** | `tenant_id` | 一个独立隔离的数据域，对应一个组织。 | 由令牌解析，**前端不传租户参数** |
| **Role（角色）** | `role` | 授权身份（职权集合）。 | 角色是授权入口，不是数据边界本身 |
| **Permission（能力）** | `permission` | 原子能力，形如 `application:submit`。 | 角色 → 能力集合（`ROLE_PERMISSIONS`） |
| **Policy（策略）** | — | 决定「授予/拒绝某能力」的规则，由权限检查函数承载。 | `authorize(principal, action, resource, context)`（见 §6） |
| **Data Scope（数据范围）** | `data_scope` | 可见数据边界。 | `global/org/pool/task/applicant/assigned/channel`（见 §2.2） |
| **Workspace（工作台）** | `workspace` | 一个角色登录后的默认界面集合与导航。 | 由「角色 × 组织类型」决定（见 §5 表2） |

### 2.2 Data Scope 枚举

| 值 | 含义 | 典型角色 |
|---|---|---|
| `global` | 平台全量 | `su` |
| `org` | 本组织全量 | `nursing_admin`、`platform_operator`、`elderly_care_admin`、`health_admin`（本组织） |
| `assigned` | 已分配给我的对象/楼层/床位 | `nursing_nurse`、`kaijian_nurse01/02` |
| `pool` | 统筹区（协调区）跨机构全量 | `medical_supervisor`、`insurer_operator` |
| `task` | 仅本人任务 | `assessor` |
| `applicant` | 仅所绑定被评估对象/长者 | `family_contact` |
| `channel` | 仅本渠道组织发展的客户/线索/设备（不见客户数据正文） | `partner_admin` / `partner_operator` |

### 2.3 一句话记忆

**Principal** 是被判定身份，**Role** 是身份拿到的职权，**Policy** 用职权在 **resource** 上按 **Data Scope** 收敛后**才**放行 —— 任何「前端把按钮藏掉」都不构成授权；授权只在后端做（见 §6.4）。

---

## 3. 平台基本定位（与既有文档对齐）

- 多租户沿用 `tenant_id == org_id`，由后端从令牌解析，前端不传递租户参数（对齐 API-CONTRACT §1/§7、ACCOUNT-MATRIX §2/§4）。
- 账号-组织-角色——现状（`server/seed.js` `ACCOUNTS`、`server/ltc.js` `ORGS/ROLES`）已固化 `platform / kaijian / anqiao / bureau / insurer / assessor_org` 六组织；本 Spec 把它们视为组织类型的首批实例（见 §4 表1），并入统一的组织类型枚举。
- 越权语义：**越权读他人数据返回 404，无权限动作返回 403**（平台既定口径，本 Spec 沿用）。

---

## 4. 组织类型（表 1）

**组织类型（org kind）是组织类型枚举；具体实例见「示例组织」列。** 既有实例在现状 seed 已存在。

| 组织类型 (kind) | 说明 | 主要负责工作台/角色 | 示例组织（现状/规划） | 现状 (seed) |
|---|---|---|---|---|
| `platform` | 平台系统组织，`su` 直属 | 平台配置、全局限权、审计 | 系统组织 | `platform` ✅ |
| `anqiao_ops` | 中科安樵自营运营组织（设备运营 + 大健康自营） | 平台运营、设备监控、大健康运营、设备资产 | 中科安樵·自营运营中心 | `anqiao`（现 kind=`vendor`） |
| `medical_bureau` | 医保局（监管方） | 长护险监管、统筹区只读、抽审/暂缓 | 苏州市医疗保障局 | `bureau` ✅ |
| `insurer` | 长护险经办机构（医保经办/商保经办） | 经办审核、待遇/结算、受理 | 太平洋保险（苏州长护经办） | `insurer` ✅ |
| `assessment_org` | 独立评估机构 | 评估任务执行 | 太平洋保险评估机构 | `assessor_org` ✅ |
| `nursing_home` | 护理院（服务机构类型之一） | 护理院内照护运营、护理大屏 | 凯健护理院 | `kaijian` ✅ |
| `elderly_care_org` | 养老/社区照护机构 | 养老运营、养老服务对象管理 | （规划） | — |
| `health_management` | 健康管理机构/大健康运营方 | 大健康运营、健康档案/慢病管理 | （规划，可与 `anqiao_ops` 复用能力） | — |
| `partner` | 合作伙伴（渠道/服务/设备渠道商） | 合作伙伴渠道、客户线索 | （规划） | — |
| `family` | 亲属/家属联系人关系（非独立登录组织） | 绑定被评估对象/长者的查看 | 联系人实体 | `family_contact`（非登录账号） |

> **预留类型（未启用，仅允许后续扩展）**：`hospital`（医院）、`community`（社区照护）、`care_provider`（通用照护服务商）。预留类型不预设字段，纳入统一组织注册表后按需实例化。

**组织类型约束**
- 一个组织实例有且仅有一个 `kind`。（默认 kind 语义）
- 设备资产的所有者/发货方身份绑定「中科安樵运营组织」（`anqiao_ops`），不随合作伙伴/客户组织转移（见 §9）。

---

## 5. 角色 / 工作台 / 数据范围（表 2）

> **角色枚举（统一目标形态）**。标 ✅ 的为已在 `server/auth.js` 落地映射的角色（`ROLE_WORKSPACE_MAP`/`ROLE_PERMISSIONS`/`ROLE_DATA_SCOPE_MAP`，兼容别名见「现状角色对照」）；其余为待落地扩展。工作台 UI 位于 `src/views/console/workspaces/`（九工作台已实现壳层）。

| 统一角色 (role) | 所属组织类型 | 工作台（默认首页） | 数据范围 | 主要能力 |
|---|---|---|---|---|
| `su` ✅ | platform | 平台警卫台（组织/角色/审计/全局） | global | 组织与角色配置、全局限权、审计查阅；不直接经办业务 |
| `platform_admin` ✅ | anqiao_ops / platform | 中科安樵平台运维工作台 | global / org | 平台配置、租户开通、角色授权、监管基线 |
| `platform_operator` ✅ | anqiao_ops | 平台/大健康运营工作台 | org | 每日运营、大健康内容/档案、跨机构数据视图（只读） |
| `device_user` ✅ | anqiao_ops | 设备运营工作台（设备资产、geo、运维告警） | org（设备资产） | 设备资产台账、发货/安装/退货、运维告警 |
| `medical_supervisor` ✅ | medical_bureau | 医保局监管工作台（统筹区监管报表、抽审/暂缓） | pool | 申请/评估/结果只读监管、抽样、`suspend`、监管报表 |
| `insurer_operator` ✅ | insurer | 经办工作台（受理、材料核验、派单、经办审核、待遇/结算） | pool | 申请受理、材料核验、派单、`approve/return/request_more`、结算对账 |
| `assessor` ✅ | assessment_org | 评估任务工作台（任务列表、量表、证据、提交结果） | task | 仅本任务量表/证据/结果提交；**不得最终确认等级** |
| `nursing_admin` ✅ | nursing_home | 护理院管理工作台（全院概览、楼层/专区/床位/告警首页） | org | 全院运营、护理配置、种子数据核对 |
| `nursing_nurse` ✅ | nursing_home | 护理员工作台（分配对象/楼层告警） | assigned | 本人负责楼层/对象的体征、告警接处置 |
| `elderly_care_admin` | elderly_care_org | 养老运营工作台 | org | 养老服务对象、服务计划（对接 LTC 服务域） |
| `elderly_care_staff` | elderly_care_org | 养老照护工作台 | assigned | 本人照护对象 |
| `health_admin` | health_management | 大健康运营工作台 | org | 健康档案/慢病、趋势、报告 |
| `health_operator` | health_management | 大健康运营工作台 | org | 内容运营、数据视图 |
| `partner_admin` ✅ | partner | 合作伙伴工作台（渠道/客户线索） | channel | 渠道管理、客户线索查看 |
| `partner_operator` | partner | 合作伙伴工作台 | channel | 线索跟进（不拥有客户数据） |
| `family_contact` ✅ | family（联系人） | 亲属查看首页（绑定对象档案/监测视图） | applicant | 仅绑定被评估对象/长者；需授权 |

**现状角色对照（避免与 ACCOUNT-MATRIX 冲突）**：现状 `admin` ≈ 机构管理员（`anqiao` 实例即中科安樵运营组织管理员，目标并入 `platform_operator`/`health_admin`）；现状 `user` ≈ 运营/设备用户（并入 `device_user`/`platform_operator`）；`medical_insurance_staff` → `medical_supervisor`；`insurer_staff` → `insurer_operator`；`nursing_admin`/`nursing_nurse` 为**目标新增角色**（凯健阶段落地）。

### 5.1 各代表账号登录后的默认首页与数据

| 登录账号 | 统一角色 | 归属组织 | 默认首页 / 数据 |
|---|---|---|---|
| `medical01` | medical_supervisor | 医保局（bureau） | **医保局监管工作台**：对被评估对象及评估/定级/服务/结算/风险做统筹区监管数据、抽审/暂缓、监管报表。**不显示**凯健/各护理院楼层、床位、在床率、设备大屏 KPI（对他人护理院页面只读，不串租户） |
| `insurer01` | insurer_operator | 太平洋保险（insurer） | **经办工作台**：受理/材料核验/派单/经办审核/结算对账。数据范围本统筹区 |
| `assessor01` | assessor | 评估机构（assessor_org） | **评估任务工作台**：任务列表、量表/证据录入、结果提交；无任务时为空态；**不显示统览护理院 KPI、不能最终确认等级** |
| `admin01` | platform_operator（目标；现状 admin） | 中科安樵运营（anqiao） | **中科安樵运营/大健康工作台**：自营设备 capsule、geo、健康/大健康数据视图 |
| `kaijian_admin`（规划账号） | nursing_admin | 凯健护理院（kaijian） | **护理院管理工作台（全院）**：楼层/专区/床位/长者/告警/在床首页；全院数据 |
| `kaijian_nurse01 / kaijian_nurse02`（规划账号） | nursing_nurse | 凯健护理院（kaijian） | **护理员工作台（分配）**：本人负责楼层或分配对象；只能看到被分配对象/楼层，**看不到全院总览** |

> 硬性隔离（延续 ACCOUNT-MATRIX §4）：`medical01/insurer01/assessor01` 的令牌租户为各自组织，访问凯健/厂商照护与设备接口返回 `404`；**医保局与其他租户不得看到凯健护理院页面数据**。

---

## 6. 权限模型：RBAC + ABAC + PBAC + Data Scope

采用**四层复合模型**，授权在**后端**逐层判断，任何一层不过即拒绝。

1. **RBAC（角色基）**：`principal.role` 决定基准能力集合 `ROLE_PERMISSIONS`（已实现）。
2. **PBAC（策略基）**：用显式策略判定「角色 × 动作 × 资源」是否放行；是 RBAC 能力集合的运行时求值层，承载业务约束（如评估回避、监测证据红线）。
3. **ABAC（属性基）**：资源属性（`resource.tenant_id`、`resource.owner`、`resource.assigned_nurse`、`resource.pool_id`、对象 `assessor.account_id` 等）参与判定。
4. **Data Scope（数据范围）**：决定查询/响应中被过滤到哪一档（`global/org/assigned/pool/task/applicant/channel`）。

### 6.1 统一判定函数（策略示例）

```
authorize(principal, action, resource, context) -> allow | deny
  1. RBAC:  action ∈ permissionsOf(principal.role) ?  ∘  :  deny(403)
  2. PBAC:  业务策略（如 assessor 回避、monitoring 红线）通过 ?  ∘  :  deny(403/409)
  3. ABAC:  资源属性命中 principal 上下文 ?  ∘  :  deny(原则 404，避免枚举存在性)
  4. DSL:   scope(principal.role) 覆盖 resource ?  allow  :  deny(404)
```

**约束**：`allow` 必须四层全部通过；`fall` 任一失败即拒绝。**前端只能隐藏界面，不能授权**；任何 API 必须全量执行该函数（后端强制），不得依赖前端传参。

示例（伪代码，非既成实现）：

```
fn authorize(p, action, r, ctx):
    if action not in permissionsOf(p.role):      # RBAC
        return deny(403)
    if not policyOk(p, action, r, ctx):          # PBAC（回避/红线）
        return deny(ctx.policy_code ?? 403)
    if not attrOk(p, r):                          # ABAC（租户/归属/分配）
        return deny(404)                          # 越权读他人数据一律 404
    if not scopeCovers(scopeOf(p.role), r):       # Data Scope
        return deny(404)
    return allow
```

### 6.2 对象级判定要点

- `assessor`：仅 `task.assessor.account_id == principal`（任务内）；其他人读到他人任务 404。
- `nursing_nurse`：仅 resource 的 `assigned_nurse/floor` 命中；未分配对象 404。
- `medical_supervisor` / `insurer_operator`：`resource.pool_id / 统筹区` 命中才可见；跨统筹区 404。
- `family_contact`：`applicant_id ∈ principal.applicant_ids` 才可见；需本人/监护人授权。

### 6.3 设备介入承载与数据产品（对齐 `LTC-INSURANCE-SPEC` §6）

平台承载关系：设备资产中心把 AI 健康守护仪数据加工为四类**数据产品**交付长护险域——`monitoring_evidence`（监测证据）、`assistant_insight`（评估师助手洞察）、`cross_validation`（交叉验证）、`risk_signal`（风险线索）。数据层强制：`evidence_monitoring.conclusion` 恒为 `null`；任何 `disability_level`/待遇字段不被设备数据写回；设备证据经 `cross_verified` 且 `attached_to_conclusion` 后随人工结论呈现。设备数据、AI 分析与评估师人工结论**分别存储、可追溯关联**；`assessment_result`（含 `disability_level`）由评估师基于量表与证据形成，`benefit_decision` 由经办/监管核定产出。四类数据产品的生成、结构、评估师处理动作（`confirmed/adopted/rejected/needs_manual_review`）、交叉验证规则、服务证据与报告结构，执行细节以 `docs/LTC-INSURANCE-SPEC.md` §5–§13 为唯一来源。

### 6.4 后端强制授权

授权**只在后端执行**：令牌解析 → `authorize()` → 放行或 `403/404`。前端路由与按钮渲染仅做体验优化；**不得把「前端隐藏入口」当作安全边界**（明示，避免被作既成事实）。

---

## 7. 主业务域

| 域 | 域内主要子域 | 组织类型 | 关键状态对象 |
|---|---|---|---|
| **长护险监管** | 被评估对象、申请等级、评估师判定等级、经办建议、最终核定等级、服务计划、服务记录、结算、监管风险 | medical_bureau / insurer / assessment_org / nursing_home | Application、AssessmentTask、AssessmentResult、ServicePlan、Settlement、Supervision |
| **护理/养老服务** | 护理院内照护（楼层/专区/床位/告警）、养老服务对象与计划 | nursing_home / elderly_care_org | 床位/对象、告警、服务计划、服务记录 |
| **大健康** | 健康档案、慢病、趋势、健康监测、报告 | health_management / anqiao_ops | 健康档案、慢病标签、趋势 |
| **设备资产** | 设备台账、生命周期、发货安装、运维监控 | anqiao_ops（所有者/发货方） | Device、DeviceLifecycle、运维告警 |
| **合作伙伴渠道** | 渠道、客户线索 | partner | PartnerChannel、Lead |

> 域之间**通过统一身份/权限底座共享账号与数据范围，但不共享领域主键语义**（见 §8）。长护险主流程状态机以 `docs/LTC-INSURANCE-SPEC.md` §4 为准。
> 领域边界（AI/设备不介入判定链）：`评估师判定等级`、`经办建议`、`最终核定等级`仅能由 `assessor`/`insurer_operator` 等人工角色产出；设备与 AI（`device_user`/规则引擎/数据分析）只产出 `assistant_insight` / `cross_validation` / `risk_signal` / `monitoring_evidence`，不产出自上三等级，也不具备待遇判定权（对齐 §头硬性基线 5–7）。

---

## 8. 核心实体关系与身份分离（核心）

**核心要求：不能用统一的 `patient_id` 抹平不同域的对象身份。** 同一自然人可能在多个域扮演不同角色，各域的对象是不同实体：

| 实体 | 域 | 定义 | 关键约束 |
|---|---|---|---|
| **AssessedPerson**（被评估对象） | 长护险监管 | 长护险申请/被评估的自然人 | 绑定 Application/AssessmentTask；与申请人同指 |
| **ServiceSubject**（服务对象） | 护理/养老、大健康 | 接受照护/健康服务的对象 | 绑定服务计划/记录；可绑定床位/机构 |
| **MonitoredSubject / Person**（被监测/被照护者） | 设备与照护监测 | 被监测体征/告警的对象 | 绑定设备、床位、告警；归属于机构 |

> 三者在实务中常是**同一自然人**，但必须作为**独立实体域对象**分别建模与授权（对应 ACCOUNT-MATRIX/DOMAIN-GLOSSARY 中 `Patient` 与 `Applicant` 的同实务不同上下文），禁止用单一 `patient_id` 统一替代，否则会把不同域的授权边界和责任链抹平。

### 8.1 设备资产的多种归属（分开，不混）

| 维度 | 说明 |
|---|---|
| **设备资产归属**（owner） | 中科安樵运营组织（发货/统一管理方） |
| **平台管理归属**（managed_by） | 平台/厂商（运维、固件、数据采集） |
| **客户使用归属**（customer/used_by） | 实际使用机构/家庭（照护使用方） |
| **合作伙伴渠道归属**（channel） | 由哪个合作伙伴引荐/交付（不影响数据权属） |
| **安装位置**（site） | 实际安装地点（机构/家庭/点位） |
| **监控用户/被监测对象**（monitored） | 绑定到 MonitoredSubject/床位 |

以上六项**全部独立字段/关系**，禁止合并；`device_user` 只读「客户使用归属 + 安装位置 + 监控用户」用于运维，不代表数据权属转移。

### 8.2 核心实体关系（ASCII）

```
                            ┌─────────────────────────── 长护险监管域 ─────────────────────────────┐
        AssessedPerson ── Application ── AssessmentTask ── AssessmentResult(建议等级)
              │              │                │                │
              │           Material        Assessor(回避校验)  Scale(版本化/SCORE_RULE)
              │                                                    │
              │       ┌────────────────────────────────────────────┘
              │       ▼             ┌── evidence_assessment(主/人工签名)
              │      AssessmentResult ─ evidence_material(申请前置)
              │                    └── evidence_monitoring(辅助/红线)──┐
              │                                                       │
              ▼   申请等级      评估师判定等级        最终核定等级        医保局监管/暂缓
         application.scale  result(assessor) → insurer approve/confirm → 待遇决定链
                                   │
                        ServicePlan(服务计划) → ServiceRecord(服务记录) → Settlement(结算)
                                   └── 复用 ServiceSubject（服务域）──────────┘

  ┌────────────────────────── 护理/养老 + 大健康 + 设备 域 ──────────────────────────┐
  ServiceSubject ── 入住机构/床位(facility_bed) ── 服务计划/服务记录
        │
        └── 健康档案/慢病标签（大健康域） ── 趋势/报告
        │
  DeviceDevice(资产, owner=anqiao_ops)
    ├── 发货/安装/运维（device_user）
    ├── 使用归属(客户机构/家庭) × 安装位置 × 被监测对象(MonitoredSubject/床位)
    └── 生命周期 stocked→…→retired
  合作伙伴渠道 PartnerChannel → 引荐客户(独立组织) → 设备由 anqiao_ops 发货统一管理
```

> 图内虚线表明**域间经授权/引用链关联**，仍保持各自实体独立；红色/虚线边界为授权接线，非主键合并。
> 判定权边界：`AssessmentResult(建议等级)` 仅由**评估师**产出；设备/AI 输出为 `assistant_insight` / `cross_validation` / `risk_signal` / `monitoring_evidence`，只能附着于人工结论的引用链（`attached_to_conclusion` + `cross_verified`），不产生 `disability_level`/`benefit_decision`（对齐 §头硬性基线 5–7）。

---

## 9. 设备资产与合作伙伴渠道

### 9.1 设备生命周期（状态机枚举）

`stocked 在库 → reserved 预留 → shipped 已发货 → delivered 已送达 → installed 已安装 → activated 已激活 → assigned 已分配(绑定对象/床位) → monitoring 监测中 → suspended 暂停 → returned 退回 → repaired 维修 → retired 退役`

- 允许边：*suspended ↔ monitoring；suspended → repaired → monitoring；monitoring/assigned → suspended；任意运维异常可在合理状态间以审计留痕迁移（默认状态机为主，异常迁移需 `device_user`/`platform_admin` 授权并留痕）。*
- **统一管理**：设备一律由中科安樵（`anqiao_ops`）发货并作为资产统一管理；合作伙伴/客户不持有设备资产权。
- 状态迁移写审计日志（`who/when/before/after`）。

### 9.2 合作伙伴渠道

- **合作伙伴发展的客户独立成组织**（独立 `tenant_id == org_id`），不是合作伙伴的子数据。
- **合作伙伴不拥有客户数据**：渠道关系仅记录「引荐/交付链路」；客户的数据权属归客户组织本身，`partner_*` 仅能查看渠道线索/概览，不能读客户业务数据正文。
- 设备交付：合作伙伴引荐/交付 → 设备仍由 `anqiao_ops` 发货、统一管理（见 §9.1）。

### 9.3 设备资产中心对长护险域的数据产品承载（边界）

设备资产中心（`anqiao_ops`）向长护险域承载 AI 健康守护仪的能力输出，交付四类**数据产品**：

- `monitoring_evidence`（监测证据）——被监测对象的冻结快照（在床/离床/体征/睡眠/跌倒姿态），含 `assessment_window/snapshot_id/coverage/metrics/alerts/sleep_summary/raw_refs`。
- `assistant_insight`（评估师助手洞察）——针对评估窗口的客观状态摘要与提示。
- `cross_validation`（交叉验证）——设备摘要与现场观察/量表答案的对应结果（`consistent/discrepancy/insufficient/device_anomaly/needs_review`）。
- `risk_signal`（风险线索）——用于抽审/复核/申诉的风险线索。

**承载边界**：设备数据、AI 分析与评估师人工结论分别存储、可追溯关联；`assessment_result`（含 `disability_level`）由评估师形成，`benefit_decision` 由经办/监管核定，四类数据产品服务于上述正式流程。**执行细节唯一引用 `docs/LTC-INSURANCE-SPEC.md`**：四类数据产品的生成流水线、JSON 结构、评估师处理动作（`confirmed/adopted/rejected/needs_manual_review`）、交叉验证规则表（§7）、服务实施数据包（§8）、设备数据质量（§9）、API 契约（§11）、验收标准（§12）与报告结构（§13）均由 `docs/LTC-INSURANCE-SPEC.md` 定义，本 Spec 不展开实现细节。

---

## 10. 凯健数据迁移 / 种子

**目标**：凯健护理院（`kaijian`，kind=`nursing_home`）作为**正式护理院租户**，承载护理院工作台，并与长护险/大健康/设备域联动。

### 10.1 种子内容（导入看板既有数据）

| 数据 | 来源 | 说明 |
|---|---|---|
| 楼层 / 专区 / 床位 | 凯健大屏（87 在住 / 96 床位；4F 完全失能、3F 认知障碍、2F 术后康复、1F 慢病颐养） | 与 `server/seed.js` 凯健配置对账一致 |
| 服务对象（ServiceSubject） | 凯健长者在住档案 | 迁移为护理/服务域对象 |
| 设备 | 安樵平台设备绑定到床位/对象 | 进入设备资产台账 |
| 告警 / 处置记录 | 凯健大屏告警与处置流水 | 保留 `triggered→handling→handled/missed` 语义 |

### 10.2 凯健账号与权限（规划）

| 账号 | 角色 | 数据范围 | 首页 |
|---|---|---|---|
| `kaijian_admin` | nursing_admin | org（全院） | 护理院管理/全院概览工作台 |
| `kaijian_nurse01` | nursing_nurse | assigned（分配对象/楼层） | 护理员工作台，只读本人负责对象/楼层 |

### 10.3 隔离约束（硬性）

- `medical01/insurer01/assessor01`（及任何其他租户）**不得看到凯健护理院页面数据**：跨租户访问返回 `404`，监管侧仅能经**跨机构只读监管**视图看到已经过授权、脱敏、纳入统筹区的监管对象，不裸看护理院运营数据。
- 凯健首页（在床率、床位占用、告警 KPI）只对 `kaijian_*` 本租户可见。

---

## 11. 长护险流程与反欺保监管

### 11.1 主流程

```
申请 → 材料 → 评估 → 评估师结果 → 经办审核 → 最终定级 → 服务 → 结算 → 医保监管
```

- 完整状态机（Application/AssessmentTask/AssessmentResult/Appeal）以 `docs/LTC-INSURANCE-SPEC.md` §4 为准；本 Spec 只固化流程骨架与三个「等级」的分离。

### 11.2 三个等级必须分开（核心约束）

| 术语 | 对象/阶段 | 产出方 | 说明 |
|---|---|---|---|
| **申请等级** | Application 申请时申报的等级倾向 | 申请人/机构 | 仅申报，不构成结论 |
| **评估师判定等级** | AssessmentResult（评估阶段） | `assessor` 现场量表+主证据 | 评估员判定；需经办审核 |
| **最终核定等级** | 待遇决定链（经办审核后） | `insurer_operator` 确认 | 生效的待遇决定依据；医保局可监管/暂缓 |

> 全链：`评估师判定等级`必须经`经办审核`且 `SCORE_RULE` 启用 + 人工确认，才转为`最终核定等级`；任何环节 `disability_level` 不得被设备数据自动写入。

### 11.3 反欺保证据异常模式（已确认判定线索）

**评估证据异常**
- 同一评估师对高度同质样本给出完全一致分档（分布集中度异常）。
- 量表条目与佐证影像不一致、影像缺少时间/地点、评估时长低于合理阈值。
- 评估师与被评者机构存在回避关系未触发。

**服务证据异常**
- 服务记录与 `ServicePlan`/最终核定等级不符（如轻度但超高强度服务频次）。
- 同一服务对多个对象同时段打卡、服务时长异常集中。
- 服务记录与监测对象体征/在场交叉验证不符（如明明离院却记录在床履约）。

**设备证据异常**
- 设备在线率/数据覆盖率异常低，仍被作为待遇支撑。
- 同一设备同时监控需核对设备绑定是否与对象/床位对应。
- 设备监测证据未经 `cross_verified`、未 `attached_to_conclusion` 却被引用。

> 上述异常模式用于**风险提示/抽审入参**，任何一条都不单独构成欺保结论，需人工核查；不自动定级、不自动扣费。

### 11.4 评估阶段反欺诈强制门禁（全国硬性；对 `docs/LTC-INSURANCE-SPEC.md` §15）

> 依据：医保办发〔2021〕37号（评估标准）、医保发〔2023〕29号（评估管理办法）、医保发〔2024〕13号（评估机构定点管理），条款详见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §4。**以下为阻断项（NATIONAL_MANDATORY）**：不满足即禁止申请/派单/提交/确认进入下一环节。量级与固定计分以官方版本配置，不在此写死具体分值。

**评估对象与申请门槛**
- 评估工具：**3 个一级指标 + 17 个二级指标、6 级划分（0–5 级）**，以官方版本（医保办发〔2021〕37号）**配置**为唯一事实；地方对评估标准的「细化完善」仅作 `LOCAL_CONFIG`，不得覆盖计分表与等级划分本身。
- **自评门槛（表B）**：申请前须由申请人自评达依赖门槛（E/F/G 级）方可受理；未达门槛的申请 `reject`，抑制申请权滥用。
- 受评对象身份核验：受理与现场均核验参保人/被评估对象有效身份凭证（`identity_verification`），身份不符拒绝受理/评估。

**现场评估门禁（提交前置，缺项阻断 `pending_review`）**
- **双人上门且至少一名评估专家**在场（`assessor_ids` 记录上门人员，评估专家另置 `expert_confirmation`）。
- **至少一名监护人或代理人在场**（`guardian_present=true`），否则不得开展/提交。
- **现场时间**（`onsite_at`）与**全程影像完整性**（`video_evidence` 含时间/地点/时长达阈值）为提交硬门禁；影像缺时间/地点、时长过低从风险线索升级为**阻断项**。
- 走访调查笔录与病历/诊断书等佐证按 `evidence_material` 采集留痕。

**结论与公示**
- 结论须经**至少两名评估专家确认**（`expert_confirmation`），平台不再由单一 `assessor` 直接产出正式等级；未双专家确认禁止 `approved`。
- **利益回避**：评估机构不得同时承担护理服务或经办（职能隔离）；评估人员与被评估对象亲属/利害关系回避；复评须初次评估机构与人员回避。
- **公示**：达待遇等级的结论须**公示接受社会监督**（`public_notice`），公示期/范围入配置，公示后才 `approve`。
- **有效期/复评**：评估结论有效期（重度失能 ≤2 年）入配置，到期前自动触发重新评估；满 6 个月、状态与结论不符、经办/医保局**抽查发现变化**均应组织重新评估。

### 11.5 服务实施与结算反欺诈强制门禁（全国硬性；对 `docs/LTC-INSURANCE-SPEC.md` §16）

> 依据：医保办发〔2024〕21号（护理服务机构定点管理）、医保办发〔2024〕22号（经办规程）、医保函〔2025〕300号、国务院令第735号、法发〔2024〕6号，条款详见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §5。**以下为阻断项（NATIONAL_MANDATORY）**。

- **护理服务计划须经参保人确认**才实施（`care_plan_confirmation`），未确认不得开始服务。
- **一人一档 + 服务实名与身份核验**：按参保人建档，服务前核验参保人性身份、护理服务人员实名制（`service_visit.identity`）；服务**如实记录**，`ServiceRecord` 强制与 `ServicePlan` 的类型/频次/时长/配比一致（`service_plan_consistency`），不符即阻断/进筛查。
- **时间/地点/频次异常筛查**：服务打卡记录 `service_visit.time`/`location`，对时间地点频次异常（同一护理员同时段多对象、服务时长异常集中、地点与对象/床位不符）作筛查入参。
- **结算分离**：结算**申报→初审→复核→拨付**四步分离（`settlement.review_separation`），初审/复核发现申报违规的**不予支付**；机构对费用清单真实性负责。
- **暂停/取消待遇**：参保人违规可暂停联网结算、暂停/取消待遇；机构违约**追回违规费用、机构负责人 5 年禁业、相关人员暂停支付资格**。
- **医保监管抽查**：经办日常核查 + 定期对评估结论与服务结算**抽查**（比例入配置 `SUPERVISION_SAMPLE_RATE`）；涉嫌犯罪按「追回→行政→司法」移送并处置留痕。

### 11.6 设备介入在长护险流程中的平台承载（边界）

平台承载关系（对齐 §头硬性基线 4–5、§6.3）：设备资产中心把 AI 健康守护仪能力以四类数据产品交付长护险域——`monitoring_evidence` / `assistant_insight` / `cross_validation` / `risk_signal`，作为评估、服务与监管环节的客观数据支撑。

- **评估师是专业责任主体**：失能等级与评估意见由评估师经现场/远程评估，依据国家/地方正式量表、现场观察、询问、材料和证据形成。
- **设备介入职责**：提供数据摘要、证据完整性、前后一致性提示与风险线索；评估等级、待遇资格与最终核定由评估师与经办/监管按正式流程产出。
- **独立存储与可追溯**：设备数据、AI 分析、评估师人工结论分别存储、可追溯关联；`assessment_result`（含 `disability_level`）由评估师形成，`benefit_decision` 由经办/监管核定。
- **执行细节唯一来源**：四类数据产品的生成、结构、评估师处理动作（`confirmed/adopted/rejected/needs_manual_review`）、交叉验证规则、服务证据、质量事件与报告结构，执行细节以 `docs/LTC-INSURANCE-SPEC.md` §5–§13 为唯一来源；本 Spec 只定义承载边界。
- **反欺诈规则定位**：§11.3 异常模式与门禁拦截项均为**风险筛查/案件线索**，由经办/医保监管按流程调查认定（对齐 §头硬性基线 4–5、§6.3）。

---

## 12. 报告与工作台

| 报告类型 | 主要角色/工作台 | 数据范围 | 内容 |
|---|---|---|---|
| 医保局监管报表 | medical_supervisor | pool（统筹区） | 申请/评估/结果/待遇监管、抽审比例、暂缓、反欺保异常线索 |
| 经办报表 | insurer_operator | pool | 受理量、材料核验、审核时限、应办结未办结 |
| 评估人员任务报表 | assessor / 评估机构管理 | task / org(评估机构) | 任务量、完成时限、等级分布、回避合规 |
| 护理/养老机构运营报表 | nursing_admin / elderly_care_admin | org | 在住、床位、告警闭环、服务计划执行率 |
| 大健康运营报表 | health_admin / platform_operator | org | 健康档案覆盖、慢病趋势、监测覆盖 |
| 平台设备运营报表 | device_user / platform_operator | org（设备资产） | 设备台账、生命周期分布、在线率、运维告警闭环 |
| 合作伙伴渠道报告 | partner_admin | org(渠道) | 线索量、交付量、成交概览（不含客户数据正文） |

**报告数据范围与来源声明**：每份报告必须标注 `data_scope`；报告值来源分三种——**真实库（业务域实际数据）**、**模拟种子（凯健/演示确定性数据）**、**混合（说明哪些口径为真/为模拟）**。报告不得在无来源时虚构数字；监测类报告强制内嵌“仅辅助证据”水印（对齐 API-CONTRACT §10.3）。

**报告模块定位（边界，平台承载）**：报告模块/数据分析/AI 产物以四类数据产品（`monitoring_evidence` / `assistant_insight` / `cross_validation` / `risk_signal`）承载，用于数据摘要、证据完整性、前后一致性提示与风险线索；`assessment_result`（含 `disability_level`）由评估师形成，`benefit_decision` 由经办/监管核定。监管与经办报告中的「异常线索」定位为**风险筛查/案件线索**，由经办/监管按流程认定；AI 建议须留痕并经评估师/经办确认、采纳、驳回或标记「需人工核查」（对齐 §头硬性基线 4–5、§11.6）。报告数据结构与生成流程以 `docs/LTC-INSURANCE-SPEC.md` §13 为唯一来源。

---

## 13. 分阶段实施与验收标准

> 阶段顺序与「把护理院大屏设成所有角色默认首页」的纠正点绑定。每个阶段完成需通过该阶段验收。

### 阶段一：文档 / 领域模型
- 产出：本 Spec + DOMAIN-GLOSSARY + API-CONTRACT/LTC-INSURANCE-SPEC 一致；领域对象与身份分离（§8）在文档成型。
- **验收**：文档间无矛盾；术语表覆盖；组织类型/角色/数据范围表齐全。

### 阶段二：权限与工作台（默认首页纠正）
- 落地：统一授权 `authorize()`（RBAC+PBAC+ABAC+Data Scope）后端强制；按角色路由到各自工作台首页。
- **验收**：**任何角色登录都不再把 `ConsoleApp.vue` 护理院首页当作默认首页**；`medical01/insurer01/assessor01/admin01` 首页与数据范围符合 §5.1；越权 403/404 校验通过；前端隐藏不构成授权（后端仍然拒绝）。

### 阶段三：凯健种子迁移
- 落地：`kaijian` 作为正式 nursing_home 租户，导入楼层/专区/床位/服务对象/设备/告警；`kaijian_admin` 全院、`kaijian_nurse01/02` 按分配。
- **验收**：凯健首页数据对账一致；「医保局/其他租户看不到凯健页面数据」通过（跨租户 404）；`kaijian_nurse01/02` 只见分配对象/楼层，见不到全院总览。

### 阶段四：设备资产与合作伙伴
- 落地：设备生命周期状态机（§9.1）、资产归属维度（§8.1）、合作伙伴独立组织与渠道（§9.2）。
- **验收**：设备由 `anqiao_ops` 发货统一管理；合作伙伴发展客户独立成 org；`partner_*` 不见客户数据正文；生命周期非法迁移被拒。

### 阶段五：长护险闭环
- 落地：申请→材料→评估→经办审核→最终定级→服务→结算→监管全链（完整状态机对齐 LTC-INSURANCE-SPEC §4）；评估阶段强制门禁（§11.4）与服务/结算强制门禁（§11.5）作为阻断项生效。
- **验收**：三等级分离、设备介入承载、反欺保线索、评估/服务/结算强制门禁、医保局暂缓均生效；`score_rule` 未启用不产正式等级；量表/规则版本可配置并留痕。**设备介入承载**：设备资产中心向长护险域提供 `monitoring_evidence` / `assistant_insight` / `cross_validation` / `risk_signal` 四类数据产品；设备数据/AI 分析/评估师人工结论分别存储、可追溯关联；AI 建议留痕并经评估师/经办确认/采纳/驳回或标记「需人工核查」；执行细节唯一引用 `docs/LTC-INSURANCE-SPEC.md` §5–§13（对齐 §头硬性基线 4–5、§9.3）。

### 阶段六：报告
- 落地：§12 报告族，标注 `data_scope` 与模拟/真实来源。
- **验收**：指定角色可读相应报告、数据范围正确、监测报告含辅助证据水印。**报告边界**：报告模块/数据分析/AI 输出命名为 `assistant_insight` / `cross_validation` / `risk_signal` / `monitoring_evidence`，不产出 `assessment_result` / `disability_level` / `benefit_decision`；报告中的异常项标注为风险线索，不含自动欺保认定（对齐 §12 报告定位）。

> 上述阶段是**执行顺序约定**；各阶段详细验收用例脚本在对应阶段实现时补入（如 `server/test-ltc.mjs`）。
>
> **实现状态快照（2026-09-23，供接手核对，不替代阶段验收）**：
> - 阶段一：文档已齐（本 Spec + DOMAIN-GLOSSARY + API-CONTRACT v0.3 + LTC-INSURANCE-SPEC）。
> - 阶段二：`server/auth.js` `authorize()` + 九工作台 `WorkspaceShell`/`workspaces/*` 已落地；`test-account-matrix.mjs` / `test-device-ltc.mjs` 覆盖默认首页分流与越权。
> - 阶段三：凯健种子与楼层隔离在 `seed.js` + 测试覆盖（护士楼层 404、跨机构 404）。
> - 阶段四：设备生命周期状态机 + 七维归属 + 合作伙伴渠道已落地（`/v1/devices*`、`/v1/partner/channels`）。
> - 阶段五：长护险全链（申请→评估→审核→服务→结算→监管）已在 `server/ltc.js` + `/v1/ltc/*` 落地并测通；强制门禁有测试。
> - 阶段六：报告生成接口已有（`/v1/ltc/reports/*`），`data_scope`/来源声明/水印的完整产品化与 INTEGRATION-SPEC 阶段四数据层生产化待后续窗口。
> - 契约补齐：`/v1/project/config`、`/v1/floors|wards|beds`、`/v1/stats/*` 已实现（API-CONTRACT §3.1 ✅）；`authorize()` 已含 `data_scope=channel` 分支并有测试锁定。
>
> **已知实现缺口（须补代码，不得改 Spec 迁就）**：无阻塞项（原 §13 缺口 `channel` 分支与 ⏳ 路由已清）；INTEGRATION-SPEC 阶段四数据层生产化（sqlite/argon2id/硬件云凭据服务端化）仍待后续窗口。

---

## 14. 未决项（Open Items）

| # | 未决项 | 说明/倾向 |
|---|---|---|
| 1 | 现状角色→统一角色别名迁移 | `admin/user/medical_insurance_staff/insurer_staff`→统一角色迁移时间点与兼容策略待定 |
| 2 | 中科安樵运营组织 kind 规范化 | 现 kind=`vendor`，目标 `anqiao_ops`；是否改值、是否兼容旧值待定 |
| 3 | `kaijian_admin/kaijian_nurse01/02` 账号是否入正式 seed | 规划；是否随凯健种子一并固化待定 |
| 4 | 统一 `authorize()` 作为既有接口的执行层 | 现状为角色/数据访问函数分散校验；收敛为统一判定函数的迁移范围与兼容待定 |
| 5 | 设备生命周期非法迁移的默认放行程度 | 见 §9.1「异常迁移」授权面；是否收紧待定 |
| 6 | 报告生成时序与缓存 | 真实库/模拟来源口径、刷新频率待定 |
| 7 | `health_management / elderly_care_org / partner` 组织的首批实例 | 仅预留类型；何时实例化待定 |
| 8 | 反欺保证据异常模式的阈值/算法 | §11.3 仅列线索，阈值与抽审加权待配置 |
| 9 | `family_contact` 授权方式 | 绑定关系与本人/监护人授权流程待细化 |
| 10 | 全国评估/监管细节依赖一手文件核实 | 评估操作指南全文、待遇起点实际口径、全国统一平台长护模块接口、医保函〔2025〕300号终稿等，见 `docs/RESEARCH-LTC-ANTI-FRAUD.md` §9 未决项；落地门禁时需再核 |

---

## 15. 仓库拓扑与部署边界（引用）

三仓整合后的仓库边界（唯一业务后端 = `anqiao-console/server`，大屏为纯前端消费方）、端口与 nginx 路由分配、生产切换窗口（日间 06:00–23:00 冻结、夜间窗口操作与回滚纪律）、安全清退清单与分阶段迁移计划，**唯一来源为 `docs/INTEGRATION-SPEC.md`**，本 Spec 不复述。本 Spec 与之相关的要求仅重申两条：

- 「护理院大屏不是任何角色的默认首页」（§1、§13 阶段二）在整合后依然成立：大屏是独立部署的纯前端产物，不作为控制台内嵌页存在。
- 大屏/控制台对 `/v1` 的消费严格遵守 §6.4：授权只在后端执行；大屏免登录形态的决策（INTEGRATION-SPEC §9 未决项 1）不得突破本节授权边界。

---

## 附：本 Spec 与既有文档的冲突校验

- **身份分离**（§8）⇒ 补充而非推翻 DOMAIN-GLOSSARY 的 `Patient` vs `Applicant` 区分。
- **设备介入承载**（§6.3/§9.3）⇒ 四类数据产品与 API-CONTRACT §9 / LTC-INSURANCE-SPEC §6 一致，本 Spec 仅重申平台承载基线。
- **评分以配置为准**（§头）⇒ 与 LTC-INSURANCE-SPEC `SCORE_RULE` 声明一致。
- **账号矩阵**（§5.1/§10）⇒ 现状账号以 ACCOUNT-MATRIX/seed 为准；新账号（`kaijian_*`）与统一角色为**规划目标**，列入未决项而不断言已实现。