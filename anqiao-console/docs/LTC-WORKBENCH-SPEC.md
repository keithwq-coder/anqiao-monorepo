# 安樵长护险利益相关方工作台实现规格

实现入口提示词：读取 anqiao-console/docs/LTC-WORKBENCH-SPEC.md 及关联 Spec，按阶段 A→D 实施长护险账号群工作台完善；Spec 先行；每阶段运行现有测试与 npm run build，汇报改动文件、接口对齐结果与 AC 结果。

## 0. 文档元信息

| 项目 | 定义 |
|---|---|
| 文件名与落盘位置 | anqiao-console/docs/LTC-WORKBENCH-SPEC.md |
| 状态 | 产品行为规格完整稿；阶段 A 完成仓内接口、权限、枚举及路径核定后进入实现 |
| 日期 | 2026-09-24 |
| 读者 | 产品、前端、后端、业务方、接续实现代理 |
| 唯一主题 | 长护险利益相关方账号群登录后的各自工作台：完善、调整与优化 |
| 实现范围 | 登录分流、导航收敛、首屏任务、角色内页流、权限的界面表达，以及与既有 /v1 契约的对接 |
| 证据基础 | 本文现状来自任务提供的基线；仓内文件内容、实际路由、权限码和枚举由阶段 A 读取核定 |
| 实现记录 | 在本文第 9 节维护实际路径、验证命令、AC 结果和契约对齐状态 |

### 0.1 仓库拓扑

- 路径：`D:\Project\中科安樵`。
- `anqiao-console` = 唯一业务后端（`server/`）+ 管理控制台前端（`src/`）+ 全部 Spec（`docs/`）。
- `anqiao-dashboard` = 大屏纯前端；`suqian-dashboard` = 待归档分叉（只读，不接功能开发）。
- 业务数据只经 `/v1`；前端持有显式本地开发开关；vendor/platform 租户保持真实接口口径。
- 跨仓大屏通过既有契约消费数据；工作台新增业务归入 anqiao-console。

### 0.2 文档优先级

冲突时按以下顺序裁决：

| 顺序 | 文档 | 权威范围 |
|---|---|---|
| 1 | docs/INTEGRATION-SPEC.md | 仓库边界、端口、切换窗口、回滚、日间/夜间纪律 |
| 2 | docs/API-CONTRACT.md | 接口路径、字段、响应包 `{code,msg,data}` 的唯一来源 |
| 3 | docs/PLATFORM-SPEC.md | 组织/角色/权限/数据范围/工作台承载边界 |
| 4 | docs/LTC-INSURANCE-SPEC.md | 长护险流程、状态机、设备介入、反欺诈门禁 |
| 5 | docs/ACCOUNT-MATRIX.md | 现有登录账号矩阵与 data_scope |
| 6 | docs/DOMAIN-GLOSSARY.md | 术语 |
| 7 | docs/LTC-WORKBENCH-SPEC.md | 上述约束之下的工作台产品行为与信息架构 |
| 8 | docs/HOME-CARE-SPEC.md | 社区居家养老机构（虚拟养老院）空间网格、账号与工作台行为 |

**Spec 先行；实现与 Spec 不一致视为缺陷；代码与旧文档冲突时，先改本 Spec 再改代码。**涉及上位 Spec 的差异，先按裁决顺序对齐上位 Spec，并同步本 Spec，然后实现。

阶段 A 为每个接口、权限语义键和状态语义建立实际绑定。本文的候选路径和语义键提供核对入口；实际 HTTP 路径、权限值和状态枚举在核对后固定。本 Spec 的产品行为、对象关系、交接与验收要求从落盘起生效。

### 0.3 既定硬性基线

| 基线 | 实现要求 |
|---|---|
| 生产窗口 | 日间 06:00–23:00 生产站点保持可看；中断性变更仅在 23:00–06:00 窗口执行。窗口时区遵循 INTEGRATION-SPEC。 |
| 凭据 | 令牌密钥与种子口令经环境变量注入。浏览器只接收合法会话所需的令牌；签名密钥保留在服务端。 |
| 授权 | 越权读他人数据返回 404；无权限动作返回 403；授权在服务端完成。 |
| 设备数据 | 设备监测结论字段保持空值语义；设备数据服务评估与监管，等级与待遇由正式流程责任主体产出。 |
| 设备口径 | 宿迁试点在册设备维持 3 台口径；云扫描仅比对。 |
| 家属准入 | family_contact 的授权方式为：绑定关系 + 本人/监护人授权后进入家属工作台；本 Spec 将其定义为可登录账号形态的落地细则。 |

### 0.4 现状基线

- 登录返回 workspace / principal / permissions / data_scope。
- WorkspaceShell.vue 按 session.workspace 挂载 9 个工作台组件。
- 医保、经办、评估师三个长护险工作台已有业务页，覆盖工单、申请、任务、档案、设备比对等。
- 后端 /v1/ltc/* 覆盖被评估人、病历、申请、任务、快照、洞察处置、工单流转、结算、监管案件、报告生成、遥测摘要。
- 账号矩阵含 medical01 / insurer01 / assessor01 及统筹区专员账号。
- 阶段 A 复用既有组件、服务及测试，阶段 B 保持九个既有工作台的兼容挂载；家属组件按平台承载规则接入。

## 1. 目标与非目标

### 1.1 目标

| 场景 | 可验收结果 |
|---|---|
| 医保监管 | 登录即见所辖待终审、抽审、暂缓、申诉和逾期事项；从待办进入证据链并完成合法处置，收到回执。 |
| 经办办理 | 受理、补正、派单、审核、结算初审连续可达；每次交接明确对象、接收角色、材料版本和时限。 |
| 现场评估 | 评估师按本人任务完成现场记录、快照、洞察处置和提交；退回修改与任务退回均有明确接收方。 |
| 家属申报 | 有效绑定与授权下完成申报、补正、进度、正式结果和申诉闭环；每一阶段显示下一步。 |
| 机构与技术协同 | 机构在同一对象上下文维护代申报、材料、病历和设备绑定；技术提供方配置标签与项目，监管按标签查询统计。 |

统一验收口径：每个长护险角色默认首页为该角色“今日必做”任务流；侧栏和顶栏展示获授入口；筛选、状态、SLA、角标和回执采用第 3 节统一语言；查询与报表在相应对象或工作台内一键进入。

### 1.2 非目标与关联依赖

| 关联工作 | 本迭代边界与依赖 |
|---|---|
| 数据层生产化 | 本迭代复用既有存储和服务结构；所需字段与接口扩展按 API-CONTRACT 落地，生产化工程由关联计划承接。 |
| 生产窗口执行 | 本迭代交付代码、Spec、测试和构建；生产切换遵循 INTEGRATION-SPEC 的窗口及回滚流程。 |
| 大屏新视觉 | 大屏继续使用 /v1；视觉重构、跨仓发布及部署窗口列入关联计划。 |
| 通用账号平台 | 本迭代补齐 family_contact 登录与授权准入，账号全生命周期复用现有平台能力。 |
| 规则决策 | 等级、待遇、申诉期限、SLA 与反欺诈门禁采用正式流程规则。 |

## 2. 角色 × 工作台 × 数据范围矩阵

data_scope 的实际枚举和层级展开方式以平台与账号矩阵为准。下表定义有效对象范围；服务端将租户边界、组织范围、对象关系、任务分配、授权有效期和动作权限共同用于裁剪。

| role | 默认 workspace | data_scope 语义 | 登录账号示例 | 首屏主题 | 允许的关键动作 | 只读能力 |
|---|---|---|---|---|---|---|
| medical_insurance_staff | medical_supervision | 获授统筹区、下级区域及案件；区域继承按平台规则 | medical01、矩阵中的统筹区专员 | 今日监管与终审 | 抽审、工单、暂缓/解除、终审核定、申诉终审、监管报告 | 范围内申请、材料、评估证据、结算初审、设备比对 |
| insurer_staff | insurer_operations | 所属经办机构受托区域与案件 | insurer01 | 今日经办 | 受理、补正退回、派单/改派、审核、结算初审、申诉受理与协办 | 正式结果、监管要求、对象设备摘要 |
| assessor | assessor_workspace | 本人获指派任务；组任务以明确的读取/领取授权为准 | assessor01 | 我的评估任务 | 接单、现场记录、快照、洞察处置、退回/提交、报告 | 当前任务所需的申请、病历、材料、设备摘要 |
| family_contact | family_workspace | 当前有效绑定且取得本人/监护人授权的对象及公开资料 | family_demo 为拟新增种子账号名 | 我的申报与进度 | 草稿、申报、补正、公开结果、申诉 | 本对象公开节点、正式报告与公开答复 |
| admin | 保持会话返回的机构 workspace，增加长护险入口 | 所属机构且具有有效代办授权的对象；设备在获授机构项目内 | 取 ACCOUNT-MATRIX 实际账号 | 机构代申报待办 | 按权限代提交、档案维护、材料、设备绑定 | 本机构获授权进度与设备状态 |
| user | 保持会话返回的机构 workspace，增加长护险入口 | 平台授予的机构子范围及具体代办对象 | 取 ACCOUNT-MATRIX 实际账号 | 我的代办事项 | 按权限代提交、补正、档案和设备协同 | 获授对象与设备 |
| su / 平台与技术提供方 | 保持会话返回的平台/技术 workspace | 获授租户、项目与设备资产；医疗资料另行按业务权限授权 | 取 ACCOUNT-MATRIX 实际账号 | 项目与设备配置 | 标签、项目配置、项目下发、范围内统计 | 配置回执、设备运行、授权比对摘要 |

多角色账号的权限合并规则复用 PLATFORM-SPEC；当前工作台只显示本工作台允许的能力。前端使用服务端确定的 workspace 和 permissions；用户名只用于账号识别。

## 3. 统一工作台外壳规范

### 3.1 登录、准入与默认首页

1. 登录成功后，会话保存 workspace、principal、permissions、data_scope；WorkspaceShell 按映射挂载工作台。
2. 全新登录进入角色“今日必做”。当前会话刷新保留已授权子路由；登录前的深链接在恢复会话并完成授权后打开。
3. family_contact 先完成账号认证，再核验绑定与授权；至少一个有效对象满足准入条件时进入 family_workspace。其他情况进入“关系与授权”准入页，显示状态、补齐要求及办理入口。
4. 一个家属账号有多个授权对象时，顶栏对象切换器展示获授权对象；切换后重新请求该对象数据。无对象跨会话复用的前端缓存。
5. 多工作台切换器只展示服务端获授列表；切换执行平台既有切换契约，清理原工作台敏感缓存并重新获取范围、导航和待办。
6. 退出清理会话、对象缓存、敏感筛选和实时订阅；再次进入受保护页面执行登录。
7. 开发开关默认使用真实接口，只有本地开发环境显式开启后使用本地样例。生产构建与 vendor/platform 租户始终采用真实接口。

### 3.2 导航分组与可见性

| 分组 | 内容 | 可见依据 |
|---|---|---|
| 今日必做 | 待办、临期、逾期、最近回执 | workspace 访问权限 |
| 业务办理 | 本角色申请、任务、工单、结算、申诉 | 各列表读取权限 |
| 对象档案 | 被评估人、材料、病历、设备关联 | 对象范围与分项读取权限 |
| 查询与报告 | 历史查询、报告生成/查询、导出记录 | 独立查询、生成、下载权限 |
| 监管与配置 | 监管案件、设备比对、标签、项目配置 | 各专项权限 |

静态权限决定入口是否出现；当前状态、材料齐备程度和业务门禁决定动作是否可执行。有权限且前置条件待满足的动作显示禁用原因和补齐入口。侧栏、页内按钮、快捷卡片、右键入口与深链接使用同一权限映射。服务端每次读取和写入重新授权。

### 3.3 顶栏

| 元素 | 行为 |
|---|---|
| 组织与工作台 | 展示当前组织、工作台名称；可切换项来自授权列表。 |
| 人员 | 展示姓名、岗位/角色；账号详情沿用平台现有入口。 |
| 数据范围徽标 | 展示统筹区、机构、本人任务、授权对象或项目范围；展开后呈现可理解的范围说明。 |
| 当前对象 | 家属始终可见；其他角色在对象详情展示。 |
| 实时状态 | “实时已连接”“正在重连”“定时刷新”配合最后刷新时间；只在实际建立连接后显示已连接。 |
| 退出 | 清理本会话和订阅并回到登录页。 |

实时通道复用既有能力；服务端尚未提供事件通道时采用可配置的定时刷新与手动刷新。临期、倒计时使用服务端时钟或其偏差校正值。

### 3.4 全局交互语言

| 元素 | 可验收行为 |
|---|---|
| 状态胶囊 | 显示中文业务状态，文本与颜色同时表达；后端原始状态保存于数据模型。 |
| 待办角标 | 统计服务端范围内的待办事项数，零值隐藏；事项按待办 ID 去重。 |
| 优先级 | 默认顺序为逾期、临期、今日到期、其他待办；组内按截止时间、创建时间排序。无期限事项单独标注“待处理”。 |
| 搜索/筛选 | 输入后按提交或防抖触发；分页由服务端完成；显示已选条件与清除按钮。 |
| 空态 | “今日待办已完成”“当前筛选无结果”“暂无授权对象”“资料待补齐”各有明确下一动作。加载失败保留错误态。 |
| 错误回执 | 显示可理解的原因、恢复动作和契约提供的追踪号；表单输入保留。 |
| 二次确认 | 提交、退回、暂缓、解除、终审、申诉、设备绑定和项目下发展示对象、目标状态、接收方及必要原因。 |
| 审计提示 | 操作前显示“本次操作将记录经办人、时间和处理意见”；详情呈现实际审计结果。 |
| 成功回执 | 展示对象号、动作、新状态、发生时间、下一责任方、回执号和返回/继续入口。 |
| 并发与重试 | 显示提交中并抑制重复点击；超时先查询动作结果或使用同一幂等标识重试；版本冲突先刷新并比较差异。 |
| 未保存离开 | 离开存在修改的表单时，提供保存后离开、放弃本次修改、继续编辑。 |
| 可访问性 | 关键操作可通过键盘执行；状态和错误具有文字说明；窄屏表格提供列收纳或横向滚动。 |

### 3.5 子路由与对象详情

路由沿用当前项目体系；新增子路由采用 workspace → 对象类型 → 对象 ID → 页签的语义结构。URL 使用业务 ID 和可共享的筛选参数，姓名、证件号等敏感搜索值保存在当前会话状态中。

| 对象 | 固定上下文 | 详情页签 |
|---|---|---|
| 被评估人 | 对象号、脱敏身份、机构、授权摘要 | 申请、材料、病历、设备、历史 |
| 申请 | 申请号、对象、来源、状态、责任方、截止时间 | 材料版本、任务、审核、正式结果、申诉、报告、时间线 |
| 工单 | 工单号、申请、发起/接收方、时限 | 处理要求、附件、交接、回执 |
| 任务 | 任务号、申请、对象、评估师、状态 | 现场记录、快照、洞察、设备摘要、提交记录 |
| 监管案件/申诉 | 案件号、原申请、原正式结果、责任方 | 理由、证据、处理记录、正式答复 |

列表进入详情保留来源列表的筛选、分页和滚动位置；刷新详情仍可按 ID 加载。详情之间的跳转保持申请与对象关联。对象授权失效时清除已展示的数据并显示“该记录当前不可访问”；返回入口指向本工作台授权列表。

### 3.6 对象关系、SLA 与审计

- 同一申请关联同一被评估人；任务、工单、案件、申诉、快照和报告记录各自 ID 与申请 ID。
- 时间线引用提交时的材料与快照版本；后续补正追加版本并保存原记录。
- SLA 使用正式流程的起算点、暂停条件、工作日历、时区与截止时间；页面分别显示时限状态和业务状态。
- 服务端返回动作结果后刷新详情、当前队列和首屏统计；通过事件/轮询在接收角色页面更新待办。
- 独立读取权限控制病历、设备摘要、报告和内部意见。家属公开时间线由服务端裁剪字段。

## 4. 分角色工作台规格

本章接口编号与第 8 节对应。P.* 表示权限语义键，阶段 A 映射到实际权限码。领域状态描述对应 LTC-INSURANCE-SPEC 的既有枚举；前端维护映射表，业务迁移由服务端执行。成功和失败反馈统一继承第 3 节，各角色补充如下。

### 4.1 医保监管：medical_supervision

#### 4.1.1 业务目标与成功标准

医保人员在所辖范围内完成工单、抽审、暂缓与解除、终审核定、申诉正式处理。首屏每条任务具有明确对象、当前责任方、截止时间与下一动作；完成后接收方能看到新节点和回执。

#### 4.1.2 典型场景走查

1. 经办提交审核结果，医保“待终审”出现同一申请。
2. 医保打开申请，按材料版本 → 评估快照 → 洞察处置 → 经办意见 → 结算初审记录顺序查阅。
3. 发现需要核验的证据时，建立抽审案件或暂缓决定，填写核验要求、接收方和时限。
4. 经办/评估师按工单补证；医保待办显示“补证已回复”，可比较新增与原证据。
5. 医保依据正式门禁解除暂缓，完成终审核定；家属获得正式发布结果，经办获得终审回执。
6. 申诉经受理后进入医保处理队列，正式答复关联原结果；复评通过新任务版本进入评估流程。
7. 医保从当前筛选生成监管报告，进入报告任务查询。

#### 4.1.3 信息架构

| 模块树 | 优先级 | 默认入口 |
|---|---|---|
| 今日监管 → 待终审/抽审/暂缓复核/申诉/临期逾期 | P0 | 今日必做 |
| 业务办理 → 申请/工单/监管案件 | P0 | 当前有责任的事项 |
| 对象档案 → 材料/病历/评估证据/设备关联 | P1 | 从申请进入 |
| 查询报告 → 监管报告/历史核定/导出 | P1 | 最近任务 |
| 设备监管 → 比对摘要/标签统计 | P1 | 所辖项目 |

#### 4.1.4 首屏布局

| 区域 | 组件与信息 | 数据源 |
|---|---|---|
| 顶部 | 所辖区域、人员、5 类队列计数、最后刷新时间 | 会话；N01 摘要 |
| 主区 | 逾期/临期待办，列出申请号、机构、办理节点、责任人、截止时间 | N02 待办；K03 申请；K09 工单 |
| 侧区 | 补证回复、申诉、暂缓复核、最近回执 | N02；K11 监管案件；N08 申诉 |
| 底部 | 设备比对提示、监管报告入口 | K12 遥测；N12 标签统计；K13 报告 |

#### 4.1.5 核心页流

列表 → 按区域、机构、节点、时间、风险线索、SLA、项目标签筛选 → 打开申请或案件 → 查看版本化证据 → 选择抽审/暂缓/解除/终审 → 确认原因与接收方 → 接收回执 → 刷新原列表。

风险线索使用“待核验”标记。终审确认显示本次正式意见、责任主体、证据版本和门禁校验结果。正式答复显示发布状态；发布动作使用有权限的正式流程接口。

#### 4.1.6 动作与权限

| 动作 | HTTP/接口编号 | 权限语义键 | 成功/失败反馈 |
|---|---|---|---|
| 查询申请、工单、案件 | GET K03/K09/K11 | P.application.read / P.work_order.read / P.case.read | 显示所辖数据；越权读取 404 |
| 发起抽审/核验工单 | POST K11/K09 | P.case.create / P.work_order.create | 返回案件/工单号及接收队列 |
| 暂缓/解除 | POST K11 动作 | P.case.hold / P.case.release | 返回新状态、回执；缺失条件显示待核清单 |
| 终审核定 | POST K04 正式核定动作 | P.application.finalize | 返回正式结果版本；并发或门禁失败保留输入 |
| 申诉正式处理/发布 | POST N09 | P.appeal.decide / P.appeal.publish | 返回处理记录与公开答复版本 |
| 生成/下载报告 | POST/GET K13 | P.report.regulatory.create / P.report.download | 返回任务或下载结果；权限失效 403 |

#### 4.1.7 状态机映射

| 页面文案 | 领域状态语义 | 进入条件与后续 |
|---|---|---|
| 待终审 | 申请已完成规定审核，等待核定 | 经办移交 → 医保核定 |
| 抽审中 | 监管案件进入核验阶段 | 核验立案 → 补证/处置 |
| 监管暂缓 | 有效暂缓决定约束指定办理节点 | 暂缓 → 补证 → 解除复核 |
| 待解除暂缓 | 补证已回复且等待医保决定 | 复核通过 → 恢复原流程 |
| 已核定 | 正式核定已落库 | 按发布规则进入家属公开结果 |
| 申诉待处理/已答复 | 申诉处于受理后处理/正式答复状态 | 协办或复评 → 正式答复 |

暂缓是独立监管状态；申请主状态与监管状态分别显示，服务端按正式规则决定受约束的动作。

#### 4.1.8 空态与异常

无任务显示“今日监管待办已完成”和历史入口；材料更新显示版本差异；正式核定遇到有效暂缓时显示案件及解除条件；设备缺少数据时显示“暂无监测数据”及时间范围；报告失败显示原因和重新生成入口。

#### 4.1.9 验收标准

~~~gherkin
AC-M01 Given 所辖范围有待终审申请 When medical01 登录 Then 首屏显示该任务、截止时间与数据范围徽标。
AC-M02 Given 申请属于授权范围之外 When 医保读取详情 Then 服务端返回 404，页面清除对象数据并提供返回入口。
AC-M03 Given 医保具备抽审权限 When 提交核验要求 Then 产生案件号、审计记录和指定接收方待办。
AC-M04 Given 申请存在有效暂缓门禁 When 提交受约束的终审动作 Then 服务端返回门禁原因并保持当前状态。
AC-M05 Given 补证完成且具备解除权限 When 解除暂缓 Then 原申请恢复适用办理条件，双方队列刷新且历史完整。
AC-M06 Given 核定条件满足 When 医保确认核定 Then 形成正式结果版本和回执，并按发布规则向家属公开。
AC-M07 Given 申诉已完成协办 When 有权限医保人员发布答复 Then 申诉转入已答复，家属收到公开答复节点。
AC-M08 Given 医保具备报告权限 When 在筛选结果上生成报告 Then 报告任务保存相同范围并可查询状态。
~~~

### 4.2 经办机构：insurer_operations

#### 4.2.1 业务目标与成功标准

经办人员完成受理、补正、派单、审核、结算初审、工单响应及申诉受理。每个队列能定位当前责任事项，材料与评估记录在同一申请内可查。

#### 4.2.2 典型场景走查

1. 家属或机构提交后，申请进入经办“待受理”。
2. 经办核对关系授权、申请表和材料清单；按材料项填写补正要求并交回提交方。
3. 提交方补正后，经办比较新版本，完成受理并选择获授评估师派单。
4. 评估师提交后，经办核对评估快照、洞察处置、设备摘要和报告，形成审核记录。
5. 需完善评估时退回原任务并指明项；审核通过后按正式顺序开展结算初审或移交终审。
6. 监管补证工单和申诉分别进入队列；经办记录协办意见后交回有权责任方。

#### 4.2.3 信息架构

| 模块树 | 优先级 | 默认入口 |
|---|---|---|
| 今日经办 → 待受理/补正回复/待派单/待审核/结算初审/监管协办 | P0 | 今日必做 |
| 申请办理 → 申请/材料/档案 | P0 | 待受理 |
| 任务管理 → 派单/改派/退回任务 | P0 | 待派单 |
| 结算办理 → 初审/退回补齐/历史 | P1 | 待初审 |
| 申诉与工单 → 受理/协办/授权核验 | P1 | 待处理 |
| 查询报告 → 经办报告/正式结果/导出 | P1 | 最近任务 |

#### 4.2.4 首屏布局

| 区域 | 组件与信息 | 数据源 |
|---|---|---|
| 顶部 | 受托机构与范围、各队列数量 | 会话；N01 |
| 主区 | 最紧急事项、申请来源、材料状态、提交时间、当前责任人 | N02；K03 |
| 侧区 | 评估提交、监管要求、任务退回、申诉和绑定核验 | K06/K09/K11；N04/N08 |
| 底部 | 结算初审与报告快捷入口 | K10；K13 |

#### 4.2.5 核心页流

申请列表 → 来源/机构/状态/时间/材料/SLA 筛选 → 申请详情 → 核验、受理或补正 → 回执。派单页在同一申请上下文选择有资格且在范围内的评估人员，展示时限与任务说明后确认。审核页显示提交快照与待核项，审核结果和任务退回各自留痕。

结算初审展示服务期间、费用明细、规则依据及校验结果；正式金额和规则由后端契约校验。申诉处理页展示原正式结果、理由与材料，受理后可请求协办或按正式规则进入复评任务。

#### 4.2.6 动作与权限

| 动作 | HTTP/接口编号 | 权限语义键 | 成功/失败反馈 |
|---|---|---|---|
| 受理/材料补正退回 | POST K04 | P.application.accept / P.application.return_materials | 显示新状态、材料项、接收方与回执 |
| 派单/改派 | POST K06 | P.task.assign / P.task.reassign | 返回任务号、评估师和期限；候选范围错误显示原因 |
| 经办审核/评估退回 | POST K04/K06 | P.application.review / P.task.return_for_revision | 返回审核或退回记录，定位需修改项 |
| 结算初审 | POST K10 | P.settlement.pre_review | 返回初审结果和回执；逐项展示校验错误 |
| 工单回复 | POST K09 | P.work_order.respond | 返回证据版本、下一责任方 |
| 申诉受理/协办 | POST N09 | P.appeal.accept / P.appeal.assist | 返回申诉状态与接收方 |
| 绑定核验 | POST N05 | P.family_binding.verify | 返回核验结果；账号获授权范围随有效关系更新 |

#### 4.2.7 状态机映射

| 页面文案 | 领域状态语义 | 后续责任方 |
|---|---|---|
| 待受理 | 已提交且等待受理 | 经办 |
| 待补正/补正已回复 | 申请材料退回/新版本已提交 | 家属或机构/经办 |
| 待派单 | 受理完成且待分配评估任务 | 经办 |
| 评估中 | 有效评估任务正在进行 | 评估师 |
| 待审核 | 评估提交完成 | 经办 |
| 待结算初审 | 满足正式流程的结算初审条件 | 经办 |
| 待医保终审 | 经办规定审核已完成并移交 | 医保 |
| 申诉待受理/协办中 | 申诉已提交/正在补充核验 | 经办及获指派人员 |

结算与核定的实际顺序由 LTC-INSURANCE-SPEC 决定；页面只开放当时合法的动作。

#### 4.2.8 空态与异常

派单候选为空时说明范围和资格条件；材料更新冲突提示重新比较；重复受理显示当前处理人及结果；结算错误逐项定位；本人授权核验依据待补齐时，显示材料要求并保留核验记录。

#### 4.2.9 验收标准

~~~gherkin
AC-I01 Given 受托范围内新申请已提交 When 经办登录 Then 待受理计数与列表 total 一致。
AC-I02 Given 材料存在需补正项 When 经办填写逐项要求并退回 Then 原提交方收到同一申请的补正待办。
AC-I03 Given 提交方完成补正 When 经办打开材料页 Then 可查看新旧版本、上传者和时间。
AC-I04 Given 申请满足派单条件 When 选择获授评估师并提交 Then 生成任务号并进入该评估师队列。
AC-I05 Given 评估师已提交 When 经办要求修改指定记录 Then 原任务显示退回原因且评估师收到待办。
AC-I06 Given 结算初审合法 When 经办确认 Then 显示初审结果、责任人、时间及下一节点。
AC-I07 Given 有待受理申诉 When 经办受理并请求复核 Then 新复核任务关联申诉、原申请和原结果。
AC-I08 Given 用户缺少派单权限 When 直接调用派单接口 Then 服务端返回 403。
~~~

### 4.3 评估师：assessor_workspace

#### 4.3.1 业务目标与成功标准

评估师在本人获指派范围内完成接单、现场记录、快照、洞察处置和正式提交。页面准确显示草稿保存、已提交版本和退回修改要求。

#### 4.3.2 典型场景走查

1. 经办派单后，评估师查看地点、时间、材料和授权病历。
2. 接单后进入现场评估，按正式评估表填写记录并保存。
3. 查看任务对应监测周期、数据完整度、设备摘要；无数据时按正式流程显示待补条件或继续人工记录。
4. 保存快照，对每条需要处置的 AI 洞察查看证据、记录决定及理由。
5. 完成提交前校验，确认提交版本，交经办审核。
6. 现场条件不满足时退回经办；审核退回时在原任务中新建修改版本后重提。

#### 4.3.3 信息架构

| 模块树 | 优先级 | 默认入口 |
|---|---|---|
| 我的任务 → 待接/今日现场/待提交/退回修改/临期逾期 | P0 | 今日必做 |
| 任务详情 → 现场记录/快照/洞察/材料/设备摘要 | P0 | 当前处理任务 |
| 历史任务 → 已提交/已办结/退回经办 | P1 | 最近提交 |
| 报告 → 生成/查询/回执 | P1 | 本人任务 |

#### 4.3.4 首屏布局

| 区域 | 组件与信息 | 数据源 |
|---|---|---|
| 顶部 | 今日任务、待接、退回修改与逾期数量 | N01 |
| 主区 | 任务卡：对象、地点、预约信息、截止时间、当前状态 | N02；K06 |
| 侧区 | 待处理洞察、待提交检查、最近保存/提交回执 | K07/K08；N02 |
| 底部 | 历史任务、报告查询 | K06；K13 |

#### 4.3.5 核心页流

列表 → 按任务号/日期/状态/区域筛选 → 任务详情 → 接单 → 现场记录保存 → 快照 → 洞察处置 → 提交校验 → 确认 → 回执。

现场表单显示“已保存至服务端”及时间；请求仍在处理时显示“保存中”；失败时显示“本次修改待保存”和重试。当前页面保留待保存内容，业务事实以服务端版本为准。洞察决定采用领域枚举及必需原因；正式评估意见由评估师依据流程填写并署名。

#### 4.3.6 动作与权限

| 动作 | HTTP/接口编号 | 权限语义键 | 成功/失败反馈 |
|---|---|---|---|
| 查看本人任务 | GET K06 | P.task.read_assigned | 返回获指派任务；越权读取 404 |
| 接单/退回/提交 | POST K06 | P.task.accept / P.task.return / P.task.submit | 返回版本、回执、接收人；状态冲突显示当前状态 |
| 保存现场记录与快照 | PATCH/POST K07 | P.assessment.write / P.snapshot.create | 返回服务端保存时间、快照版本 |
| 洞察处置 | POST K08 | P.insight.dispose | 返回处置 ID、理由与证据关联 |
| 报告生成/查询 | POST/GET K13 | P.report.assessment.create / P.report.read | 返回本任务报告版本；缺失条件逐项显示 |

#### 4.3.7 状态机映射

| 页面文案 | 领域状态语义 | 后续 |
|---|---|---|
| 待接任务 | 任务已分配、待确认 | 接单 |
| 评估中 | 已接单且现场资料可编辑 | 保存/提交 |
| 待完善证据 | 当前任务合法提交条件待满足 | 补齐指定项；属于视图分组 |
| 退回经办 | 评估师退回任务 | 经办调整任务 |
| 已提交审核 | 已提交版本固定 | 经办审核 |
| 退回修改 | 经办要求修订 | 评估师追加修订版本 |
| 复评任务 | 因复核/申诉生成的任务类型 | 独立任务 ID 关联原结果 |

“待完善证据”与“复评任务”分别是提交条件分组和任务类型，保留原有任务状态机。

#### 4.3.8 空态与异常

无任务提供历史入口；病历权限不足显示该分项授权说明；设备无数据、数据缺段与正常监测分别呈现；洞察服务错误显示失败状态及重试；提交缺项直达具体记录；任务改派后停止提交并显示现有处理结果。

#### 4.3.9 验收标准

~~~gherkin
AC-A01 Given assessor01 获指派任务 When 登录 Then 首屏显示对象、地点、截止时间及任务号。
AC-A02 Given 任务指派给其他评估师 When 请求详情 Then 返回 404。
AC-A03 Given 任务可编辑 When 保存现场记录 Then 页面显示服务端保存时间与版本。
AC-A04 Given 洞察要求人工处置 When 提交决定和理由 Then 处置记录关联证据并进入时间线。
AC-A05 Given 提交缺少必需快照 When 点击提交 Then 服务端返回具体缺项，页面定位至补齐入口。
AC-A06 Given 任务满足提交条件 When 确认提交 Then 经办新增待审核，评估师取得提交版本和回执。
AC-A07 Given 现场条件不满足 When 填写原因退回 Then 经办收到原申请关联的任务与原因。
AC-A08 Given 设备结论为 null When 查看摘要或生成报告 Then 保留空值语义，显示缺少结论的实际状态。
~~~

### 4.4 家属/申请人：family_workspace

#### 4.4.1 业务目标与成功标准

family_contact 作为真实可登录账号，在有效绑定和本人/监护人授权下完成申报、材料补正、进度查询、正式结果和申诉。对象、当前阶段、下一步和处理责任方在首屏明确呈现。

#### 4.4.2 典型场景走查

1. 账号通过现有平台认证；服务端检查绑定与授权。有待核验关系时进入准入页，显示材料要求与当前核验状态。
2. 绑定申请提交给项目配置的核验角色；核验依据包含平台已验证身份、关系凭证及本人/监护人授权凭证，服务端形成有效关系。
3. 家属进入工作台并选择授权对象，填写申请、关联病历和上传材料。
4. 提交前查看材料清单和授权主体，确认后获得申请号、受理责任方及回执。
5. 经办退回指定材料时，从首屏卡直接补正对应项并重提。
6. 正式结果发布后查看责任主体、版本和报告；符合申诉条件时提交理由及材料。
7. 申诉被受理、复核及正式答复时，在同一申请下查看进度和公开回执。

#### 4.4.3 信息架构

| 模块树 | 优先级 | 默认入口 |
|---|---|---|
| 我的申报 → 待提交/待补正/办理中 | P0 | 当前待完成事项 |
| 进度与结果 → 办理时间线/正式结果/报告 | P0 | 当前申请 |
| 申诉 → 发起/补充材料/处理进度/正式答复 | P1 | 当前申诉 |
| 我的资料 → 材料版本/公开病历 | P1 | 当前授权对象 |
| 关系与授权 → 绑定申请/有效期/授权记录 | P1 | 关系状态 |
| 历史 → 既往申请/回执 | P2 | 按时间排序 |

#### 4.4.4 首屏布局

| 区域 | 组件与信息 | 数据源 |
|---|---|---|
| 顶部 | 当前对象、关系、授权有效期 | N03；会话 |
| 主区 | 待提交/待补正卡；当前阶段、更新时间、下一步 | N01/N02；K03；N06 |
| 侧区 | 材料要求、可公开通知、正式结果 | K05；N06；K04/K13 |
| 底部 | 发起申报、历史、申诉、关系与授权 | K03；N04/N08 |

移动窄屏优先显示“当前对象—待办—下一步—进度”，主要操作固定在可见操作区。

#### 4.4.5 核心页流

授权对象 → 草稿 → 分步填写 → 材料上传 → 完整性检查 → 提交确认 → 申请号和回执。申请详情的材料页保留每次补正要求及材料版本；进度时间线显示已完成、当前、后续节点，后续节点依据正式流程定义。

正式结果 → 可申诉条件与截止时间 → 申诉理由和材料 → 确认 → 申诉号 → 处理时间线 → 正式答复。内部监管线索、内部意见和草稿在各自内部权限中展示；家属使用服务端公开投影。

#### 4.4.6 动作与权限

| 动作 | HTTP/接口编号 | 权限语义键 | 成功/失败反馈 |
|---|---|---|---|
| 查看绑定/申请核验 | GET N03、POST/GET N04 | P.family_binding.read_self / request | 显示申请号和核验状态；身份核验缺项显示补齐入口 |
| 草稿保存/提交 | POST/PATCH K03、POST K04 | P.application.create_self / edit_self / submit_self | 返回草稿版本或申请号与回执 |
| 上传/补正材料 | POST K05 | P.material.write_self | 返回材料 ID、版本和校验结果 |
| 公开进度/结果 | GET N06、GET K13 | P.application.read_self / P.report.read_published_self | 返回公开字段；越权读取 404 |
| 申诉/补充材料 | POST N07/N09 | P.appeal.create_self / supplement_self | 返回申诉号、新状态及回执 |
| 查询申诉答复 | GET N08 | P.appeal.read_self | 显示公开答复、主体、时间与结果版本 |

绑定审核与授权有效标记由可信核验流程写入。账号传入 subject_id 仅表达绑定申请目标，数据访问以服务端已生效关系为依据。

#### 4.4.7 状态机映射

| 页面文案 | 领域状态语义 | 家属动作 |
|---|---|---|
| 关系待核验/待授权 | 绑定申请处理中/授权要件待满足 | 按要求补齐 |
| 待提交 | 申请草稿 | 继续填写/提交 |
| 待补正 | 经办退回指定材料 | 补正/重提 |
| 已受理/评估中 | 已受理/进入评估阶段 | 查看公开进度 |
| 审核中 | 经办审核、监管处理或终审的公开阶段 | 查看时间与公开要求 |
| 结果已发布 | 正式结果具有公开发布记录 | 查看结果/按条件申诉 |
| 申诉待受理/处理中/已答复 | 申诉正式流程对应状态 | 补充材料/查看进度/查看答复 |

公开阶段允许多个内部状态映射到同一文案；原始正式结果和申诉结果分别显示并关联版本。

#### 4.4.8 空态与异常

无有效关系显示“完成关系与授权”；无申请显示“发起申报”；文件上传失败可重试并保留填写内容；提交期间授权失效时服务端拒绝并引导重新授权；申诉期限和重复申诉校验由服务端返回具体依据；家属切换对象后重新获取其完整上下文。

#### 4.4.9 验收标准

~~~gherkin
AC-F01 Given 身份认证成功且绑定与授权均有效 When 登录 Then 进入 family_workspace 并只加载获授权对象。
AC-F02 Given 绑定存在且授权待完成 When 登录 Then 展示关系与授权准入页及办理入口。
AC-F03 Given 家属提交绑定核验申请 When 审核完成并记录有效授权 Then 服务端开放相应对象范围且保留审核证据。
AC-F04 Given 申请必需材料齐备 When 家属确认提交 Then 返回申请号、接收责任方及回执。
AC-F05 Given 经办退回指定材料 When 家属点击待补正 Then 直接进入对应材料项与退回说明。
AC-F06 Given 补正已提交 When 经办查询 Then 新版本关联原申请且旧版本可追溯。
AC-F07 Given 正式结果已公开发布 When 家属查看 Then 显示发布主体、时间、版本和适用申诉条件。
AC-F08 Given 其他家庭对象存在 When 当前家属请求其申请或报告 Then 服务端返回 404。
AC-F09 Given 申诉满足规则 When 提交理由和材料 Then 返回申诉号并在受理方队列出现。
AC-F10 Given 授权被撤销 When 继续访问原对象 Then 服务端拒绝访问，界面清除原对象数据并进入准入页。
~~~

### 4.5 机构代申报：admin/user 入口增强

#### 4.5.1 业务目标与成功标准

机构工作人员在既有机构工作台完成获授权对象的代申报、材料和病历维护、设备关联。提交来源、代理人、授权依据和对象关系全程可追溯。

#### 4.5.2 典型场景走查

1. 工作人员从“长护险代申报”进入机构对象列表，查看对象授权是否有效。
2. 在对象详情维护病历、材料，检查设备绑定及其生效区间。
3. 填写申请并确认代办人、授权依据和材料清单，交经办受理。
4. 经办补正要求回到当前合法代办人/代办队列；工作人员上传新材料版本后重提。
5. 设备迁移或解绑时填写原因，记录有效时间；历史监测仍按原生效区间与对象关联。
6. 机构查询进度，家属按自身授权读取相同申请的公开结果。

#### 4.5.3 信息架构

| 模块树 | 优先级 | 默认入口 |
|---|---|---|
| 机构今日待办 → 代申报/补正/授权到期/设备绑定待处理 | P0 | 机构首页增强卡 |
| 长护险代申报 → 对象/草稿/提交/历史 | P0 | 当前代办 |
| 对象档案 → 材料/病历/设备关联 | P1 | 选中对象 |
| 进度与报告 → 正式结果/可见报告 | P1 | 本机构授权申请 |

#### 4.5.4 首屏布局

| 区域 | 组件与信息 | 数据源 |
|---|---|---|
| 原机构首页获授卡位 | 待提交、待补正、授权临期、绑定事项 | N01/N02 |
| 代申报主区 | 对象、授权、材料、申请来源与当前状态 | K02/K03/K05 |
| 对象设备区 | 当前设备、项目、生效区间、比对摘要 | N13/N14；K12 |
| 查询区 | 已提交申请及可公开结果 | K03/K13 |

#### 4.5.5 核心页流

机构对象列表 → 机构/授权状态/办理状态筛选 → 对象详情 → 材料/病历/设备页签 → 代申报或补正 → 确认代理关系 → 回执。设备绑定页先加载范围内台账设备，再校验项目、占用规则、授权及生效区间。解除绑定结束该段关联并保留历史。

#### 4.5.6 动作与权限

| 动作 | HTTP/接口编号 | 权限语义键 | 成功/失败反馈 |
|---|---|---|---|
| 查询机构对象 | GET K02 | P.subject.read_org | 返回授权对象；越权读取 404 |
| 维护病历/材料 | POST/PATCH K02/K05 | P.record.write_org / P.material.write_org | 返回记录版本与保存回执 |
| 草稿与代提交 | POST/PATCH K03、POST K04 | P.application.create_on_behalf / submit_on_behalf | 返回申请号、代理信息和接收方 |
| 绑定/解除设备 | POST N14/N15 | P.device_binding.write_org | 返回绑定记录及生效区间；冲突提示规则 |
| 查询进度/报告 | GET K03/K13 | P.application.read_org / P.report.read_org | 返回机构授权范围内信息 |

#### 4.5.7 状态机映射

| 页面文案 | 领域状态语义 | 下一步 |
|---|---|---|
| 授权待完成 | 代办关系提交条件待满足 | 办理授权 |
| 待提交/待补正 | 草稿/指定材料补正 | 机构完善并提交 |
| 办理中 | 申请进入经办及后续流程 | 查询进度 |
| 绑定待核/已生效/已结束 | 设备绑定对应领域状态 | 处理核验/查询/新增后续绑定 |
| 已办结 | 正式流程完成 | 查询正式结果 |

#### 4.5.8 空态与异常

无授权对象显示授权办理入口；可用设备为空显示当前项目条件；设备占用冲突提供规则说明和设备详情；代办授权过期保留草稿并提示续授权；多人同时编辑产生版本冲突提示及差异。

#### 4.5.9 验收标准

~~~gherkin
AC-O01 Given admin 有代申报权限 When 打开机构首页 Then 显示本机构受权代办卡片。
AC-O02 Given user 具备读取权限且缺少代提交权限 When 查看申请 Then 可查详情且提交入口按权限收敛。
AC-O03 Given 其他机构对象存在 When 请求其详情 Then 服务端返回 404。
AC-O04 Given 委托授权与材料齐备 When 机构代提交 Then 经办收到来源为机构代申报的申请和代理记录。
AC-O05 Given 申请被退回补正 When 机构重新提交 Then 新版本关联原申请和补正要求。
AC-O06 Given 设备符合绑定规则 When 提交绑定 Then 对象详情显示设备、项目、生效区间与回执。
AC-O07 Given 设备绑定已结束 When 查看过去监测摘要 Then 历史数据按原生效区间关联原对象。
AC-O08 Given 代办授权已失效 When 提交申请 Then 服务端拒绝动作，页面保留输入并提示续授权。
~~~

### 4.6 技术提供方：标签与项目配置增强

#### 4.6.1 业务目标与成功标准

su 及获授平台技术人员在既有工作台管理项目、标签和下发回执；监管按相同维度筛选设备摘要。设备资产、实际部署地、业主和环境属性可独立统计。

#### 4.6.2 典型场景走查

1. 技术人员打开获授项目，查看台账设备、配置版本、标签完整度和最近下发状态。
2. 按地域、项目、业主、部署环境和业务阶段筛选。
3. 修改标签，核对前后值和目标设备，填写原因并提交版本校验。
4. 编辑项目配置，查看变更摘要和目标设备清单；按权限下发。
5. 接收逐设备回执，重试失败项并查询最终结果。
6. 查看宿迁试点与苏州部署机群；监管使用所属范围内的同一标签查询比对摘要。

#### 4.6.3 信息架构

| 模块树 | 优先级 | 默认入口 |
|---|---|---|
| 项目与设备 → 待处理配置/下发失败/标签待完善 | P0 | 平台首页增强卡 |
| 设备台账 → 标签筛选/设备详情/变更历史 | P0 | 当前项目 |
| 项目配置 → 查看/编辑/下发/回执 | P0 | 当前有效版本 |
| 比对与统计 → 台账统计/云扫描比对 | P1 | 当前项目及环境 |
| 审计 → 标签/配置/下发操作 | P1 | 最近操作 |

#### 4.6.4 首屏布局

| 区域 | 组件与信息 | 数据源 |
|---|---|---|
| 顶部 | 当前项目、获授范围、待处理数量 | 会话；K14；N01 |
| 主区 | 项目设备、标签完整度、配置版本和下发状态 | K15；N10/N11；K14 |
| 侧区 | 下发失败项、标签变更、配置回执 | K14；审计 |
| 底部 | 台账/云扫描分列统计与比对入口 | N12；K12 |

#### 4.6.5 核心页流

项目选择 → 设备筛选 → 设备详情 → 标签编辑 → 版本及目标确认 → 保存回执。项目配置 → 保存草稿/版本 → 核对下发目标 → 确认下发 → 逐设备回执。范围与环境属性变化后重新计算列表与统计。

标签修改只更新标签字段；设备主键、在册状态与登记来源由台账权威字段承载。

#### 4.6.6 动作与权限

| 动作 | HTTP/接口编号 | 权限语义键 | 成功/失败反馈 |
|---|---|---|---|
| 查看/编辑项目配置 | GET/契约规定写方法 K14 | P.project_config.read / write | 返回版本；冲突展示新旧差异 |
| 下发/查询回执 | 契约规定动作/GET K14 | P.project_config.dispatch / read | 返回批次与逐设备结果 |
| 标签查询/统计 | GET N10/N12 | P.device_label.read | 返回受权范围和统计时间 |
| 标签修改 | PATCH N11 | P.device_label.write | 返回标签版本、操作者、回执 |
| 台账/遥测比对 | GET K15/K12 | P.device.read / P.telemetry.compare_read | 分列台账与扫描数据；缺少数据如实显示 |

#### 4.6.7 状态机映射

| 页面文案 | 领域状态语义 | 后续 |
|---|---|---|
| 标签待完善 | 必需标签校验待满足，属于视图分组 | 补齐标签 |
| 标签已保存 | 标签版本写入成功 | 筛选/统计 |
| 配置待下发 | 配置已保存并具有可下发版本 | 确认下发 |
| 下发中/部分成功/完成/失败 | 对应现有下发任务及逐设备状态 | 查询/重试失败项 |
| 台账已匹配/待核对 | 云扫描与在册设备匹配结果 | 查看差异 |

#### 4.6.8 空态与异常

无获授项目显示范围说明；标签无结果显示清除筛选；配置版本冲突要求核对后重新提交；部分失败可定位设备；云扫描出现新 ID 时显示“待核对记录”和发现时间；在册数量继续来自台账。

#### 4.6.9 验收标准

~~~gherkin
AC-T01 Given 技术人员仅获授项目 A When 打开工作台 Then 列表、计数和报告均只覆盖项目 A。
AC-T02 Given 对象在获授范围之外 When 读取设备详情 Then 返回 404；When 执行无权限标签动作 Then 返回 403。
AC-T03 Given 标签修改权限有效 When 提交前后值和原因 Then 保存新版本并产生审计回执。
AC-T04 Given 使用相同地域、项目和环境筛选 When 查询设备与统计 Then total 与同口径统计一致。
AC-T05 Given 宿迁试点台账有 3 台 When 云扫描发现更多记录 Then 在册仍为 3 台，扫描记录单独展示。
AC-T06 Given 项目下发部分失败 When 打开回执 Then 可查看每台设备结果并只重试失败目标。
AC-T07 Given 医保获授设备比对权限 When 按标签筛选 Then 仅返回所辖设备摘要。
AC-T08 Given 技术账号仅有设备配置权限 When 请求病历或正式评估资料 Then 服务端按业务权限拒绝访问。
~~~

## 5. 跨角色流程缝合

### 5.1 阶段 × 角色矩阵

| 阶段 | 家属/申请人 | 机构代申报 | 经办 | 评估师 | 医保 | 技术提供方 |
|---|---|---|---|---|---|---|
| 绑定授权 | 提交可信核验材料，查看状态 | 维护获授代办关系 | 按获授核验权限处理 | 读取任务必要授权摘要 | 按权限监督 | 维护账号/项目配置能力 |
| 申请提交 | 提交并获得申请号 | 代提交并记录代理信息 | 待受理 | 按任务分配后读取 | 范围内查询 | 读取获授权统计 |
| 材料退回 | 本人责任项进入待补正 | 机构责任项进入待补正 | 等待补正；回复后进入待核验 | 读取可见版本 | 查询交接历史 | — |
| 派单 | 查看公开评估阶段 | 查询机构申报进度 | 选择人员、时限并生成任务 | 待接/现场任务 | 查询进度 | — |
| 任务退回 | 查看公开办理阶段 | 查询需要协作的事项 | 原派单队列收到原因并处理 | 保留退回回执 | 查询历史 | — |
| 评估提交/审核退回 | 查看审核阶段 | 查询进度 | 待审核；退回时逐项说明 | 提交回执/退回修改待办 | 查阅权限范围证据 | — |
| 监管暂缓与补证 | 查看公开阶段与本人补证要求 | 收到获指派协作项 | 原申请关联的监管工单 | 经任务/工单获指派补证 | 暂缓、补证复核、解除 | 提供授权比对摘要 |
| 结算初审与终审 | 查看正式公开节点 | 查询获授权结果 | 结算初审/移交终审/接收回执 | 查询本人任务结果范围 | 正式核定及发布 | — |
| 申诉受理与复核 | 发起/补充/查询进度 | 按获授关系协助材料 | 受理/协办/按规则派复核任务 | 处理独立复核任务 | 正式处置/发布答复 | 提供获授权技术证据 |
| 结果发布与办结 | 公开正式结果/答复/报告 | 获授正式结果 | 正式回执及后续办理 | 历史任务 | 历史监管记录 | 配置/设备侧统计 |

“—”表示该阶段的主动待办为空；对象读取仍按权限裁剪。

### 5.2 交接共同字段和规则

每条交接保存申请 ID、对象 ID、可选任务/工单/案件/申诉 ID、来源动作、原责任方、新责任方、原因、材料版本、截止时间、发生时间与回执。

- 材料退回明确每项要求与当前补正责任方。家属和机构共同获授时，以服务端当前有效的代办关系及补正分派确定写入责任。
- 派单接收方取得任务所需最小资料；改派后，原评估师的编辑权限按状态与平台规则更新。
- 任务退回经办使用“退回经办”；经办要求评估师修订使用“退回修改”。两者的队列和回执分开。
- 暂缓记录作用范围、原因、解除条件及 SLA 处理规则；解除后恢复原申请的合法节点。
- 终审读取当前有效提交版本。证据在确认前更新时，服务端返回版本冲突并要求重核。
- 申诉以独立对象关联原申请与正式结果，复核任务具有独立 ID；新正式结果关联原结果，历史版本保持可追溯。
- 多人共用处理队列采用现有领取机制；存在领取契约时首屏显示领取人，完成动作进行版本校验。
- 交接结果与待办变更基于同一次成功业务状态迁移。事件或轮询使接收端获取新状态；界面回执以服务端已持久化结果为依据。

### 5.3 SLA 与更新

当前责任队列显示到期时间、临期或逾期；上游详情显示当前责任角色及最近更新时间。项目配置提供规则、日历和时区。规则缺失时显示“时限待配置”，任务仍在待办列表中可办理。暂停期间显示暂停原因与时间；恢复后的期限由服务端计算。

实时更新事件只提供对象标识、类型、版本和发生时间，前端再请求获授权数据。轮询复用现有配置；默认建议 30 秒，页面隐藏暂停，恢复可见后立即刷新，业务方确认后进入配置。

## 6. 查询、报表与导出

### 6.1 筛选、搜索与历史

| 维度 | 适用范围 | 行为 |
|---|---|---|
| 状态、办理节点、时间 | 全部业务列表 | 时间范围明确按创建/提交/更新/发生时间筛选；标签显示当前字段。 |
| 统筹区、机构、项目 | 获授权范围 | 选项由服务端提供；选择后继续应用 data_scope。 |
| 责任人、来源、任务类型 | 医保/经办/评估师 | 评估师候选仅限其有权查阅的人员。 |
| SLA、暂缓、风险线索 | 医保/经办 | 与领域状态并列筛选；风险线索标明待核验。 |
| 申请号、任务号、工单号、案件号 | 对应列表 | 支持精确搜索；显示搜索命中的对象类型。 |
| 姓名、证件/联系电话 | 有明确敏感字段搜索权限的角色 | 服务端脱敏返回；搜索值保存在当前会话。 |
| 设备标签 | 监管、技术和机构设备视图 | 地域、项目、业主、部署环境、业务阶段及部署点可组合。 |

服务端分页采用契约参数及上限；列表 data 为 {list,total}。分页前完成范围裁剪和筛选。历史查询保留所有已授权状态，按更新时间倒序，支持进入材料和结果历史版本。

### 6.2 报告类型与角色可见性

| 报告类型 | 医保 | 经办 | 评估师 | 家属 | 机构 | 技术 |
|---|---|---|---|---|---|---|
| 监管/抽审 | 范围内生成、查阅、导出 | 被授权协办部分 | 获指派证据部分 | 公开处理节点 | 获授协办部分 | 获授技术证据 |
| 申请流程/办理统计 | 范围内查询或生成 | 受托范围查询或生成 | 本人任务部分 | 本对象公开进度 | 本机构授权部分 | 获授去标识统计 |
| 评估报告 | 正式版本 | 审核所需版本 | 本人任务、按权限生成 | 正式发布版本 | 获授正式版本 | 单独获授范围 |
| 结算报告 | 监管范围 | 初审范围 | 按独立权限 | 契约允许的公开信息 | 机构获授部分 | 单独获授范围 |
| 设备比对/标签统计 | 所辖范围 | 案件关联摘要 | 任务关联摘要 | 按独立公开权限 | 本机构获授设备 | 获授项目 |

报告类型码、模板、生成参数、文件格式、同步/异步返回及下载契约逐项核对 API-CONTRACT 报告章节。本文新增的一键入口复用实际报告服务。

### 6.3 报告页流与导出

1. 当前对象或查询列表点击“生成报告”，自动带入对象 ID、筛选条件及范围摘要。
2. 用户确认报告类型和合法参数；服务端再次校验权限、范围和材料版本。
3. 同步结果直接展示下载入口；异步结果展示任务号、状态、创建时间、生成者和刷新入口。
4. 生成成功后显示模板/数据版本、统计时间及输出格式；失败显示业务原因和重试。
5. 下载时重新核验权限与当前授权关系；导出任务生成与下载均留下审计记录。
6. 当前页导出与全部筛选结果导出分别命名，显示预计范围及权限允许的条数；大批量使用契约已有导出任务。
7. 打开的报告与列表使用相同范围快照；生成过程中源数据变化时记录报告采用的数据截止时间与版本。
8. 缺失监测值保持空值并明确可读文案；正式等级与待遇取正式结果字段。

## 7. 设备标签与项目配置（技术提供方）

### 7.1 维度与字段建议

| 维度 | 字段建议 | 类型/值来源 | 规则 |
|---|---|---|---|
| 设备身份 | device_id | 现有台账主键 | 连接标签、遥测、绑定和下发记录。 |
| 资产所属项目 | project_id | /v1/project/config 对应项目 | 设备当前主项目来自台账权威关系。 |
| 部署地域 | region_code | 既有地域编码字典 | 表达实际部署地域；监管数据范围仍由授权规则决定。 |
| 部署点 | deployment_site_id | 机构/场所字典 | 关联当前部署位置。 |
| 业主属性 | owner_type | 项目字典 | 建议政府、经办机构、养老/护理机构、企业、自有测试等受控枚举。 |
| 业主主体 | owner_org_id | 现有组织 ID | 区分同一属性下的不同业主。 |
| 部署环境 | environment_type | production / test / demo 建议值 | 表达生产、测试或演示环境。 |
| 业务阶段 | program_stage | pilot / formal 建议值 | 试点与正式阶段独立于部署环境；真实试点可为 production + pilot。 |
| 在册状态 | registry_status | 台账现有枚举 | 只读引用台账事实。 |
| 自由标签 | tags | 经配置约束的数组 | 用于补充设备属性，保留长度和数量上限。 |
| 标签版本 | version | 服务端版本 | 并发校验和审计依据。 |
| 审计 | updated_at / updated_by / reason | 服务端和本次原因 | 保存前后值及操作者。 |

原有项目/地域字段已满足时直接复用；阶段 A 将字段映射到权威数据源。标签编辑中的项目变更调用已有项目归属服务并执行授权校验；保存后台账、标签与配置保持同一项目关系。

### 7.2 与项目配置、设备台账的衔接

/v1/project/config 提供项目身份、授权范围、可用字典、标签必填规则、下发参数及版本。设备台账提供在册资产集合；标签补充筛选维度；遥测摘要按 device_id 与数据时间关联。

服务端统计先按有效权限裁剪台账，再按标签过滤并聚合。项目下发先生成目标快照，确认页显示目标数量、设备列表、配置版本及环境；回执保存逐设备状态。跨环境目标按明确选择执行，演示环境在所有相关页显示环境徽标。

### 7.3 宿迁与苏州口径

| 视图 | 计数与展示规则 |
|---|---|
| 宿迁试点在册设备 | 来源为既有宿迁试点台账及正式项目筛选，当前固定事实为 3 台；数字从台账查询得出。 |
| 宿迁云扫描 | 单列扫描时间、发现记录、匹配/未匹配/待核对数量；扫描结果仅产生比对记录。 |
| 苏州部署机群 | 按实际苏州部署地域与获授项目查询；展示台账数量、业主、环境、业务阶段和在线摘要。 |
| 跨项目统计 | 显示采用的地域、项目、环境和业务阶段；计数以授权 device_id 去重，并注明时点。 |
| 设备迁移 | 当前展示使用当前有效归属；历史报告和对象监测按当时生效区间计算。 |

## 8. 与既有接口的对接表

### 8.1 核定方法

K 表表示任务基线已描述的能力与定位候选，具体路径仍需读取仓内 API-CONTRACT；候选用于代码搜索和绑定核对。N 表表示本次补齐行为所需契约草案。已有同等能力时复用并记录实际路径；存在字段差异时先修订 API-CONTRACT，再接入。

阶段 A 对每行登记：实际 HTTP/路径、请求和响应类型、真实权限码、状态枚举、对应服务文件和测试。阶段 A 的完成条件是全部已实现能力完成绑定，新增项完成契约定义；其后前端只调用核定过的 API 服务层。

### 8.2 既有能力映射

| ID | 工作台能力 | HTTP 与定位候选路径 | 必需语义与角色 |
|---|---|---|---|
| K01 | 登录、恢复、退出、切换 | 现有 /v1 登录/会话/工作台切换契约；在 API-CONTRACT 核定实际路径 | workspace/principal/permissions/data_scope；全部角色 |
| K02 | 对象、病历 | GET/POST/PATCH /v1/ltc/subjects、/v1/ltc/subjects/{id}、/v1/ltc/medical-records 候选 | 对象授权、病历版本；医保/经办/评估师/机构 |
| K03 | 申请列表、详情、草稿 | GET/POST /v1/ltc/applications；GET/PATCH /v1/ltc/applications/{id} 候选 | 来源、对象、版本、责任方；获授角色 |
| K04 | 申请提交、受理、审核、核定/发布 | POST /v1/ltc/applications/{id}/actions 候选；沿用现有各动作实际路径 | 动作权限、状态门禁、正式结果、发布；家属/机构/经办/医保 |
| K05 | 材料上传、版本、下载 | GET/POST /v1/ltc/applications/{id}/materials；GET /v1/ltc/materials/{id}/download 候选 | 上传机制、文件校验、版本、访问鉴权；获授角色 |
| K06 | 任务列表、派单、动作 | GET/POST /v1/ltc/tasks；GET /v1/ltc/tasks/{id}；POST /v1/ltc/tasks/{id}/actions 候选 | 任务分配、接单、退回、提交；经办/评估师/医保 |
| K07 | 现场记录、快照 | PATCH /v1/ltc/tasks/{id}/assessment；GET/POST /v1/ltc/tasks/{id}/snapshots 候选 | 记录保存、证据版本；评估师 |
| K08 | 洞察与处置 | GET /v1/ltc/tasks/{id}/insights；POST /v1/ltc/insights/{id}/dispositions 候选 | 决定、理由、证据、人员；评估师及获授审核人 |
| K09 | 工单与流转 | GET/POST /v1/ltc/work-orders；GET /v1/ltc/work-orders/{id}；POST /v1/ltc/work-orders/{id}/actions 候选 | 接收方、时限、回复与回执；医保/经办/获指派人 |
| K10 | 结算与初审 | GET /v1/ltc/settlements；GET /v1/ltc/settlements/{id}；POST /v1/ltc/settlements/{id}/actions 候选 | 费用、规则、审核记录；经办/医保 |
| K11 | 监管案件 | GET/POST /v1/ltc/supervision/cases；GET /v1/ltc/supervision/cases/{id}；POST /v1/ltc/supervision/cases/{id}/actions 候选 | 抽审、暂缓、解除、证据；医保/获授协办方 |
| K12 | 遥测摘要、设备比对 | GET /v1/ltc/telemetry/summary 候选 | 设备、对象、生效区间、数据完整度、空值结论；获授角色 |
| K13 | 报告生成、查询、下载 | POST/GET /v1/ltc/reports；GET /v1/ltc/reports/{id}；GET /v1/ltc/reports/{id}/download 候选 | 严格采用 API-CONTRACT 报告章节实际契约 |
| K14 | 项目配置及下发 | /v1/project/config；读取/更新方法及下发路径采用 API-CONTRACT | 项目、配置版本、下发回执；获授技术人员 |
| K15 | 设备台账及项目归属 | 现有 /v1 设备台账契约；候选 GET /v1/devices、GET /v1/devices/{id} | 在册集合、项目、环境、设备身份；获授角色 |

实际路径不同于候选时，阶段 A 将该行直接改成实际值。全部业务调用继续通过 /v1。

### 8.3 新增/扩展接口与权限

| ID | 方法与草案路径 | 权限语义键 | 作用 |
|---|---|---|---|
| N01 | GET /v1/ltc/workbench/summary | P.workbench.read | 工作台队列计数、SLA、最近回执 |
| N02 | GET /v1/ltc/workbench/todos | P.workbench.read | 服务端已授权待办分页 |
| N03 | GET /v1/ltc/family/bindings | P.family_binding.read_self | 家属有效/失效关系及准入状态 |
| N04 | POST/GET /v1/ltc/family/binding-requests | P.family_binding.request / read_request | 提交和查询可信核验申请 |
| N05 | POST /v1/ltc/family/binding-requests/{id}/actions | P.family_binding.verify / revoke | 核验、补件、批准、撤销对应授权关系 |
| N06 | GET /v1/ltc/family/applications/{id}/timeline | P.application.read_self | 服务端公开时间线、下一步、已发布结果 |
| N07 | POST /v1/ltc/appeals | P.appeal.create_self | 创建申诉 |
| N08 | GET /v1/ltc/appeals、GET /v1/ltc/appeals/{id} | P.appeal.read_self / read_case | 申诉列表、详情与公开/内部投影 |
| N09 | POST /v1/ltc/appeals/{id}/actions | P.appeal.accept / assist / decide / publish / supplement_self | 受理、补正、协办、复核请求、正式答复及发布 |
| N10 | GET /v1/ltc/device-labels | P.device_label.read | 标签字典、设备标签分页筛选 |
| N11 | PATCH /v1/ltc/devices/{id}/labels | P.device_label.write | 版本化标签修改 |
| N12 | GET /v1/ltc/device-labels/stats | P.device_label.read | 台账口径和扫描比对统计 |
| N13 | GET /v1/ltc/device-bindings | P.device_binding.read_org / read_assigned | 对象设备当前/历史绑定 |
| N14 | POST /v1/ltc/device-bindings | P.device_binding.write_org | 创建授权对象设备关联 |
| N15 | POST /v1/ltc/device-bindings/{id}/actions | P.device_binding.write_org | 按规则批准、结束或更正生效区间 |

角色本身只映射候选能力；授权服务根据具体权限、数据范围和对象关系作出最终决定。

### 8.4 共用请求、响应与错误

以下 TypeScript 结构描述字段草案；实际字段类型沿用 API-CONTRACT 已定义类型。DomainState 与 DomainAction 绑定正式领域枚举；PermissionCode 绑定平台权限码。

~~~typescript
type Id = string;
type Timestamp = string; // ISO 8601，包含时区
type Envelope<T> = { code: ContractCode; msg: string; data: T };
type Page<T> = { list: T[]; total: number };
type MutationControl = {
  expected_version?: string | number; // 更新已有对象时必填
  client_request_id: string;          // 重试沿用同一值
};
type Receipt = {
  receipt_id: Id;
  object_id: Id;
  state: DomainState;
  version: string | number;
  occurred_at: Timestamp;
  next_owner_role: string | null;
};
type PageQuery = { page: number; page_size: number };
~~~

服务端从会话推导租户与授权范围。客户端 workspace、project_id、subject_id 等参数只能缩小合法查询集合。服务端校验分页上限、字段白名单、文件关联、对象版本与动作合法性。

| 情况 | HTTP/契约处理 | 界面结果 |
|---|---|---|
| 会话失效 | 401 与现有认证契约 | 清理会话并进入登录 |
| 越权读取他人对象 | 404 | 通用不可访问提示 |
| 动作权限不足 | 403 | 显示权限变化与返回入口 |
| 状态/版本冲突 | 按契约冲突码，新增建议 409 | 展示当前状态/版本并重新核对 |
| 参数/材料校验失败 | 按契约校验错误 | 定位字段并保留表单 |
| 服务暂不可用 | 按契约服务错误 | 展示重试与最后成功刷新时间 |
| 重复幂等请求 | 返回原操作结果 | 使用同一回执刷新页面 |

成功 code、业务错误 code 与 HTTP 的映射以 API-CONTRACT 为准。新增接口一并定义这三个值的对应关系。

### 8.5 工作台与家属接口字段草案

~~~typescript
// N01 GET：workspace 取当前已授权工作台；筛选为可选的合法范围缩小条件。
type SummaryQuery = { workspace: string; project_id?: Id; subject_id?: Id };
type SummaryData = {
  workspace: string;
  scope_label: string;
  as_of: Timestamp;
  total: number;
  groups: { key: string; label: string; total: number; due_soon: number; overdue: number }[];
  recent_receipts: Receipt[];
};

// N02 GET：summary 与 todos 采用相同的权限、筛选和待办去重口径。
type TodoQuery = PageQuery & SummaryQuery & {
  group?: string; sla_status?: string; sort?: string;
};
type Todo = {
  id: Id; object_type: string; object_id: Id; application_id: Id | null;
  title: string; state: DomainState; assigned_to: Id | null;
  next_owner_role: string; due_at: Timestamp | null; updated_at: Timestamp;
  action_key: string; route_key: string;
};
// Response = Envelope<Page<Todo>>

// N03 GET：只查询当前登录家属；核验人员使用核验申请查询权限。
type FamilyBinding = {
  binding_id: Id; subject_id: Id; display_name: string; relationship: string;
  binding_status: DomainState; authorization_status: DomainState;
  valid_from: Timestamp | null; valid_until: Timestamp | null;
};
// Response = Envelope<Page<FamilyBinding>>

// N04 POST：引用已完成身份验证流程的凭证和已授权上传的材料。
type BindingRequest = MutationControl & {
  identity_verification_ref: Id;
  relationship: string;
  subject_identity_ref: Id;
  authorization_basis: string;
  authorization_evidence_ids: Id[];
  relationship_evidence_ids: Id[];
};
type BindingRequestResult = Receipt & { binding_request_id: Id };
// N04 GET：PageQuery + state；Response = Envelope<Page<BindingRequestSummary>>

// N05 POST：审核人、审核权限和可信验证结果由服务端确认。
type BindingReviewAction = MutationControl & {
  action: DomainAction; reason: string;
  verification_evidence_refs?: Id[];
  valid_from?: Timestamp; valid_until?: Timestamp | null;
};
// Response = Envelope<Receipt & { binding_id: Id | null }>

// N06 GET：PageQuery；内部备注留在内部投影。
type PublicTimelineData = Page<{
  event_id: Id; label: string; occurred_at: Timestamp;
  responsible_role: string; public_description: string; receipt_id: Id | null;
}> & {
  application_id: Id; public_state: string; updated_at: Timestamp;
  next_action: { key: string; label: string; due_at: Timestamp | null } | null;
  published_result: {
    result_id: Id; version: string | number; publisher: string;
    published_at: Timestamp; summary: string;
  } | null;
};
~~~

关系批准要求绑定证据与授权证据同时有效；撤销立即终止后续读取、提交和报告下载权限。现有账号的身份认证与核验服务直接复用，新增页面承接相关状态。

### 8.6 申诉接口字段草案

~~~typescript
// N07 POST
type AppealCreate = MutationControl & {
  application_id: Id; result_id: Id; reason: string; material_ids: Id[];
};
type AppealCreateResult = Receipt & {
  appeal_id: Id; application_id: Id; result_id: Id;
};

// N08 GET list：PageQuery + application_id/state/created_from/created_to
type AppealSummary = {
  appeal_id: Id; application_id: Id; result_id: Id;
  state: DomainState; submitted_at: Timestamp; updated_at: Timestamp;
  next_owner_role: string; due_at: Timestamp | null;
};
// Response = Envelope<Page<AppealSummary>>
// GET detail：按角色投影理由、材料、时间线、协办记录和已发布答复。
type AppealDetail = AppealSummary & {
  reason: string; material_ids: Id[];
  public_reply: {
    reply_id: Id; version: string | number; content: string;
    publisher: string; published_at: Timestamp; resulting_result_id: Id | null;
  } | null;
  allowed_actions: string[];
};

// N09 POST：正式动作绑定领域状态机；补正、受理、协办与发布各自授权。
type AppealAction = MutationControl & {
  action: DomainAction; reason: string;
  material_ids?: Id[];
  assignee_id?: Id;
  due_at?: Timestamp;
  review_task_id?: Id;
  reply_content?: string;
  resulting_result_id?: Id;
};
// Response = Envelope<Receipt & { appeal_id: Id; review_task_id: Id | null }>
~~~

申诉受理校验原结果确属申请、已正式发布、满足申诉期限及重复规则。复评任务使用 K06 创建并保存申诉关联。发布要求有正式答复记录及相应发布权限；家属公开结果只引用已发布答复。

### 8.7 标签和绑定接口字段草案

~~~typescript
// N10 GET：PageQuery + region_code/project_id/owner_type/owner_org_id/
// environment_type/program_stage/deployment_site_id/registry_status
type DeviceLabel = {
  device_id: Id; project_id: Id; region_code: string | null;
  owner_type: string | null; owner_org_id: Id | null;
  environment_type: string | null; program_stage: string | null;
  deployment_site_id: Id | null; registry_status: DomainState;
  tags: string[]; version: string | number;
  updated_at: Timestamp; updated_by: Id;
};
// Response = Envelope<Page<DeviceLabel>>

// N11 PATCH：PATCH 中缺省字段保留，null 仅适用于字典允许清空的字段。
type DeviceLabelPatch = MutationControl & {
  region_code?: string | null; project_id?: Id;
  owner_type?: string | null; owner_org_id?: Id | null;
  environment_type?: string; program_stage?: string;
  deployment_site_id?: Id | null; tags?: string[]; reason: string;
};
// Response = Envelope<{ device: DeviceLabel; receipt: Receipt }>

// N12 GET：与 N10 相同筛选 + group_by（服务端白名单）
type DeviceStats = {
  as_of: Timestamp; registered_total: number;
  scan_record_total: number; scan_matched_total: number; scan_unmatched_total: number;
  list: { key: string; label: string; total: number }[];
  total: number; // 分组项数量
};

// N13 GET：PageQuery + subject_id/device_id/state/valid_at
type DeviceBinding = {
  binding_id: Id; subject_id: Id; device_id: Id; project_id: Id;
  state: DomainState; valid_from: Timestamp; valid_until: Timestamp | null;
  version: string | number; updated_at: Timestamp;
};
// Response = Envelope<Page<DeviceBinding>>

// N14 POST
type DeviceBindingCreate = MutationControl & {
  subject_id: Id; device_id: Id; project_id: Id;
  valid_from: Timestamp; valid_until?: Timestamp | null;
  authorization_ref: Id; reason: string;
};
// Response = Envelope<{ binding: DeviceBinding; receipt: Receipt }>

// N15 POST
type DeviceBindingAction = MutationControl & {
  action: DomainAction; reason: string;
  valid_from?: Timestamp; valid_until?: Timestamp;
};
// Response = Envelope<{ binding: DeviceBinding; receipt: Receipt }>
~~~

设备绑定校验设备范围、对象授权、项目归属、生效区间和领域允许的并存规则。所有列表保持 {list,total}；所有 JSON 接口最外层保持 {code,msg,data}。

## 9. 实施计划（给实现代理）

### 9.1 共同行为

按 A → B → C → D 顺序执行。每阶段先修订 Spec，再实施；日间只做代码与本地验证。实现代理直接读取仓内文件完成路径和字段核定，日常实现判断依据本 Spec 及上位 Spec 推进。

命名与落位优先沿用现有组织方式。下表“拟新增”路径是可直接采用的文件组织建议；现有等价模块存在时修改该模块，并在本节记录真实路径。既有源码定位通过 rg 完成：

~~~powershell
Set-Location 'D:\Project\中科安樵\anqiao-console'
rg --files -g AGENTS.md -g package.json -g "*WorkspaceShell*" -g "*workspace*" -g "*ltc*" -g "*test*" src server docs
rg -n "medical_supervision|insurer_operations|assessor_workspace|family_contact|data_scope" src server docs
npm run
npm run build
~~~

阶段 A 同时读取根目录与 server 的实际 package.json 和项目测试说明，确定前端、后端、契约测试的单次运行命令。每阶段实际执行已核定的现有测试命令和 npm run build。命令失败即记录失败；脚本不存在记录为验证缺口，并用仓内现有测试框架补上本迭代所需回归，完成后再通过阶段门禁。

### 9.2 阶段 A：Spec 落盘与文档对齐

| 项目 | 要求 |
|---|---|
| 文件 | docs/LTC-WORKBENCH-SPEC.md；按实际差异修订 docs/API-CONTRACT.md、docs/PLATFORM-SPEC.md、docs/LTC-INSURANCE-SPEC.md、docs/ACCOUNT-MATRIX.md、docs/DOMAIN-GLOSSARY.md |
| 读取依赖 | docs/INTEGRATION-SPEC.md、所有适用 AGENTS.md、根与 server/package.json、登录/权限/路由/状态机/报告代码 |
| 任务 | 将 K/N 接口映射为实际契约；P.* 映射到实际权限；状态表映射到真实枚举；定位原有九个工作台和既有测试；定义家属准入及申诉动作 |
| 验证命令 | 核定见下表「测试命令」；`npm run build` |
| DoD | 所有契约有来源；新增项完成 API-CONTRACT 定义；九工作台承载清单明确；权限/状态/测试命令均已核定；基线结果记录完整 |

#### 9.2.1 阶段 A 核定结论（2026-09-24 落盘）

**仓库与命令**

| 项 | 实际值 |
|---|---|
| 根 package.json | 仅 `dev` / `build` / `preview` / `server`；**无统一 `test` 脚本** |
| 前端验证 | `npm run build`（`vue-tsc -b && vite build`） |
| 后端契约/单元测试 | `node --test server/test-ltc.mjs`、`node --test server/test-account-matrix.mjs`、`node --test server/test-device-ltc.mjs`、`node --test server/test-real-devices-seed.mjs` |
| WS 冒烟（需先起服） | 前置 `WS_ALERT_FAST=1 npm run server`；运行 `node server/ws-smoke.mjs`（不纳入 `node --test`） |
| 既有测试文件 | `server/test-ltc.mjs`、`server/test-account-matrix.mjs`、`server/test-device-ltc.mjs`、`server/test-real-devices-seed.mjs`、`server/test-ws.mjs`、`server/ws-smoke.mjs` |
| 前端单测 | **无**独立前端单测框架；类型与构建门禁由 `vue-tsc` + `vite build` 承担 |
| 环境变量 | `TOKEN_SECRET`、`SEED_ACCOUNT_PASSWORD`、`PORT`、`VITE_API_BASE`、`VITE_BASE`（见 `.env.example`） |
| 本地样例开关 | 控制台 `useRealApi() = !!getToken()`：有 token 走真实 `/v1`；无 token 走 mock。vendor 租户失败**不**回退凯健 mock。未发现独立 `VITE_USE_MOCK` 开关；阶段 B 需按 §3.1.7 补显式本地开发开关 |

**九工作台承载清单（`src/views/console/WorkspaceShell.vue`）**

| workspace key | 组件 | 角色入口 |
|---|---|---|
| `system_admin` | `workspaces/SystemAdminApp.vue` | su |
| `platform_operations` | `workspaces/PlatformOperationsApp.vue` | platform_admin / admin |
| `device_monitoring` | `workspaces/DeviceMonitoringApp.vue` | device_user / user |
| `medical_supervision` | `workspaces/MedicalSupervisionApp.vue` | medical_insurance_staff / medical_supervisor |
| `insurer_operations` | `workspaces/InsurerOperationsApp.vue` | insurer_staff / insurer_operator |
| `assessor_workspace` | `workspaces/AssessorApp.vue` | assessor |
| `nursing_home_admin` | `workspaces/NursingHomeAdminApp.vue` | nursing_admin |
| `nursing_staff` | `workspaces/NursingStaffApp.vue` | nursing_nurse |
| `partner_operations` | `workspaces/PartnerOperationsApp.vue` | partner_admin |

- **缺口**：`WORKSPACES` / `ROLE_WORKSPACE_MAP` / `WORKSPACE_METAS` **均无** `family_workspace`；`family_contact` 有 `ROLE_DATA_SCOPE_MAP` 与 `ROLE_PERMISSIONS`，但 **无 workspace 映射、无登录种子账号**（ACCOUNT-MATRIX 明确为非登录联系人实体）。
- 会话/登录/切换/退出：`server/index.js` `handleLogin` / `handleTenantSwitch`；退出为前端 `clearSession()`（`src/api/http.ts` + `ConsoleApp.vue`），**无服务端 logout 路由**。
- 会话 store：`localStorage` key `anqiao_saas_token` / `anqiao_saas_session`（`src/api/http.ts`）。

**K01–K15 契约核定**

| ID | 实际 HTTP | 方法 | 服务文件 | 权限/授权 | 对应测试 | 状态 |
|---|---|---|---|---|---|---|
| K01 | `/v1/auth/login`、`/v1/auth/switch` | POST | `server/index.js` | 令牌 HMAC；switch 仅同组织 | `test-account-matrix.mjs` | ✅ 与 API-CONTRACT §3 一致；退出仅前端清会话 |
| K01b | 会话恢复 | — | `src/api/http.ts` `getSession()` | localStorage | 无独立测试 | 前端本地恢复；无 `/v1/auth/session` |
| K02 | `/v1/ltc/assessed-persons`、`/v1/ltc/assessed-persons/{id}/medical-record`、`/v1/ltc/medical-records` | GET | `server/ltc.js` `listAssessedPersons` / `getPersonMedicalRecord` / `listMedicalRecords` | `assessed_person:read` | `test-device-ltc.mjs`、`test-real-devices-seed.mjs` | ✅ 读路径齐；**无** subjects/病历 POST/PATCH 写接口 |
| K03 | `/v1/ltc/applications`、`/v1/ltc/applications/{id}`、`/v1/ltc/applications/{id}/submit` | GET/POST | `createApplication` / `listApplications` / `getApplication` / `submitApplication` | `application:create` / `application:submit` / `application:read` | `test-ltc.mjs` | ⚠️ 无 PATCH 草稿更新；提交仅 `submit` 动词 |
| K04 | 申请动作分散：`…/submit`；结果审核 `POST /v1/ltc/reviews/{id}/approve`；暂缓经监管案件 `createSupervisionCase({action:suspend})`；工单 `POST …/work-orders/{id}/action` | POST | `server/ltc.js` + `index.js` | `application:submit`、`result:approve`、`supervision:create/operate` | `test-ltc.mjs` | ⚠️ **无统一** `applications/{id}/actions`；受理/补正/终审核定/发布尚未独立路由（终审相关走 `approveReview` + 工单 ratify 写 `medical_ratified_level`） |
| K05 | — | — | — | — | — | ❌ **材料上传/版本/下载接口不存在**；仅有证据类型 `evidence_material`（`POST /v1/ltc/tasks/{id}/evidence`）。须在 API-CONTRACT 新增后再实现 |
| K06 | `/v1/ltc/tasks`（别名 `/v1/ltc/assessment-tasks`）列表/创建；`POST …/{id}/(accept\|start\|evidence\|submit\|return)` | GET/POST | `listAssessmentTasks` / `createAssessmentTask` / `acceptTask` / … | `task:dispatch`、`task:operate`、`result:submit`、`result:return` | `test-ltc.mjs`、`test-device-ltc.mjs` | ⚠️ 服务函数 `getAssessmentTask` 存在；**路由层缺 GET 详情**（API-CONTRACT §3.4 已声明）。阶段 A 补接线 |
| K07 | `POST /v1/ltc/snapshots`、`GET /v1/ltc/snapshots/{id}`；现场记录经 `POST …/tasks/{id}/evidence` | POST/GET | `createAssessmentSnapshot` / `getAssessmentSnapshot` / `addEvidence` | `evidence:write`、`snapshot` 经任务本人 | `test-device-ltc.mjs` | ⚠️ 无独立 `PATCH tasks/{id}/assessment`；以 evidence 写入承载 |
| K08 | `POST /v1/ltc/insights/{id}/handle` | POST | `handleInsight` | `insight:handle` | `test-device-ltc.mjs` | ⚠️ 仅处置；**无 GET insights 列表**路由（详情随任务/快照内嵌） |
| K09 | `GET /v1/ltc/work-orders`、`POST /v1/ltc/work-orders/{id}/action` | GET/POST | `listWorkOrders` / `actionWorkOrder` | `supervision:read` / `supervision:operate` | `test-device-ltc.mjs`（间接） | ✅ 动作：`ratify\|approve\|suspend\|investigate` |
| K10 | `GET /v1/ltc/settlements`、`POST /v1/ltc/settlements/{id}/review` | GET/POST | `listSettlements` / `reviewSettlement` | `settlement:read` / `settlement:review` | `test-device-ltc.mjs` | ✅ 四步：`pre_review\|re_review\|disburse` |
| K11 | `GET/POST /v1/ltc/supervision-cases` | GET/POST | `listSupervisionCases` / `createSupervisionCase` | `supervision:read` / `supervision:create` | `test-ltc.mjs` | ⚠️ 暂缓在 create 的 `action=suspend` 内；**无** cases/{id}/actions 解除/补证复核独立端点 |
| K12 | `GET /v1/ltc/devices/{device_id}/telemetry` | GET | `getDeviceLiveTelemetry` | 会话令牌；跨租户 404 | `test-real-devices-seed.mjs`（设备域） | ✅ 候选路径与实现一致 |
| K13 | `POST/GET /v1/ltc/reports/generate`、`GET /v1/ltc/reports/{id}` | GET/POST | `generateReport` / `getReport` | `report:generate` / `report:read` | `test-ltc.mjs` | ⚠️ 无 `/download`；API-CONTRACT §10.1 的 `GET /v1/ltc/reports/{type}` 与 `{id}` 同形，实现侧按 id 匹配，type 查询须走 `generate?type=` |
| K14 | `GET /v1/project/config` | GET | `server/index.js` `getProjectConfig` | 有效令牌；跨项目 404 | `test-account-matrix.mjs` | ⚠️ **只读**；无配置写/下发/回执端点 |
| K15 | `GET /v1/devices`、`GET /v1/devices/lifecycle-logs`、`POST /v1/devices/{id}/lifecycle` | GET/POST | `handleDevicesList` / lifecycle | 设备读写权限 | `test-device-ltc.mjs` | ⚠️ 无 `GET /v1/devices/{id}` 单设备详情路由（列表内可取） |

**N01–N15 契约核定（全部为新增）**

| ID | 决议 | 实际/草案路径 | 权限语义键 → 实际码 | 说明 |
|---|---|---|---|---|
| N01 | **新增** | `GET /v1/ltc/workbench/summary` | `P.workbench.read` → 新码 `workbench:read` | 阶段 B 实现；加入 API-CONTRACT |
| N02 | **新增** | `GET /v1/ltc/workbench/todos` | `workbench:read` | 阶段 B |
| N03 | **新增** | `GET /v1/ltc/family/bindings` | `family_binding:read_self` | 阶段 D；依赖 family 可登录 |
| N04 | **新增** | `POST/GET /v1/ltc/family/binding-requests` | `family_binding:request` / `family_binding:read_request` | 阶段 D |
| N05 | **新增** | `POST /v1/ltc/family/binding-requests/{id}/actions` | `family_binding:verify` / `family_binding:revoke` | 阶段 D |
| N06 | **新增** | `GET /v1/ltc/family/applications/{id}/timeline` | `application:read`（self 投影） | 阶段 D |
| N07 | **新增** | `POST /v1/ltc/appeals` | `appeal:file`（已有能力码，作 create_self） | 阶段 D；`ROLE_PERMISSIONS.family_contact` 已含 `appeal:file` |
| N08 | **新增** | `GET /v1/ltc/appeals`、`GET /v1/ltc/appeals/{id}` | `appeal:read_self` / 内部 `supervision:read` 或 `application:read` | 阶段 D |
| N09 | **新增** | `POST /v1/ltc/appeals/{id}/actions` | `appeal:accept` 等 → 建议并入现有 `supervision:operate` / `result:approve` / `appeal:file` | 阶段 D；动作枚举见 API-CONTRACT |
| N10 | **新增** | `GET /v1/ltc/device-labels` | `device:read` | 阶段 D |
| N11 | **新增** | `PATCH /v1/ltc/devices/{id}/labels` | `device:write` | 阶段 D |
| N12 | **新增** | `GET /v1/ltc/device-labels/stats` | `device:read` | 阶段 D；宿迁在册 3 台与云扫描分列 |
| N13 | **新增** | `GET /v1/ltc/device-bindings` | `device:read`（org/任务投影） | 阶段 D |
| N14 | **新增** | `POST /v1/ltc/device-bindings` | `device:write` | 阶段 D |
| N15 | **新增** | `POST /v1/ltc/device-bindings/{id}/actions` | `device:write` | 阶段 D |

**P.* → 实际权限码映射**（源：`server/auth.js` `ROLE_PERMISSIONS` + `server/ltc.js` `assertPerm`）

| Spec 语义键 | 实际权限码 | 主要角色 |
|---|---|---|
| P.application.read | `application:read` | medical/insurer/admin/user |
| P.application.create_self / create_on_behalf | `application:create` | family_contact/admin/user/insurer |
| P.application.submit_self / submit_on_behalf | `application:submit` | 同上 |
| P.application.accept / return_materials / review / finalize | **待新增或映射** `result:approve` / `result:return` / 工单动作 | insurer / medical（阶段 C 扩展） |
| P.task.read_assigned / read | `task:read` | assessor/insurer/medical |
| P.task.assign / reassign | `task:dispatch` | insurer/admin |
| P.task.accept / return / submit / operate | `task:operate` + `result:submit` / `result:return` | assessor |
| P.assessment.write | `evidence:write` | assessor |
| P.snapshot.create / read | 任务本人 evidence 路径；读 `evidence:read` | assessor |
| P.insight.dispose | `insight:handle` | assessor |
| P.work_order.read / create / respond | `supervision:read` / `supervision:create` / `supervision:operate` | medical |
| P.case.read / create / hold / release | `supervision:read` / `supervision:create` / `supervision:operate` | medical |
| P.settlement.pre_review | `settlement:review` | insurer/medical |
| P.appeal.create_self | `appeal:file` | family_contact |
| P.appeal.accept / assist / decide / publish | **待新增**（建议 `appeal:decide` 等）或阶段 D 前并入 `supervision:operate` | insurer/medical |
| P.report.regulatory.create / assessment.create / read / download | `report:generate` / `report:read`（download 并入 read） | 按角色 |
| P.family_binding.* | **待新增** | family/insurer 核验 |
| P.device_label.read / write | 映射 `device:read` / `device:write`（或独立码） | su/admin |
| P.device_binding.read_org / write_org | `device:read` / `device:write` | admin/user |
| P.workbench.read | **待新增** `workbench:read` | 全部登录角色 |
| P.subject.read_org / record.write_org / material.write_* | 读 `assessed_person:read`；写 **待新增** `material:write` 等 | admin/user |

> 权限为**冒号能力点**（如 `application:read`），不是点分 `P.*`。`P.*` 仅为本 Spec 语义键；实现与测试一律使用 `ROLE_PERMISSIONS` 实际字符串。

**状态映射（原始枚举 → 页面文案 → 可执行动作）**

| 对象 | 原始枚举（代码/上位 Spec） | 页面文案（本 Spec） | 主要动作 |
|---|---|---|---|
| 申请 application | `draft` | 待提交 | submit |
| | `submitted` | 待受理/已提交 | 经办受理→材料核验 |
| | `materials_review` | 材料审核中 | materials_pass / materials_rejected |
| | `materials_rejected` | 待补正 | 提交人重提→draft 路径可 submit |
| | `materials_pass` | 待派单 | task dispatch |
| | `assess_pending` | 评估中 | 派单已建任务 |
| | `suspended` | 监管暂缓（公开可映射「审核中」） | 解除暂缓 |
| | `approved` | 已核定 | 按发布规则公开 |
| 任务 task | `assigned` | 待接任务 | accept |
| | `assessing` | 评估中 | evidence / submit / return |
| | `completed` | 已提交审核 | 经办 approve / return |
| | `returned` | 退回修改或退回经办 | 视 return 方向区分队列 |
| 结果 result | `pending_review` | 待审核 | approve / return |
| | `public_notice` | 公示中 | 公示后 approve |
| | `approved` | 结果已发布 | 家属可见 |
| | `returned` | 退回修改 | 重提 |
| | `suspended` | 监管暂缓 | 解除 |
| 结算 settlement | `declared` | 待结算初审 | pre_review |
| | `pre_reviewed` | 待复核 | re_review |
| | `re_reviewed` | 待拨付 | disburse |
| | `disbursed` | 已拨付 | — |
| 工单 work_order | `investigating` | 抽审/调查中 | 补证/处置 |
| | `ratified` | 已核准 | 关联申请推进 |
| | `suspended` | 暂缓中 | 解除复核 |
| 监管案件 | `action=suspend` 写入申请/结果 `suspended` | 监管暂缓 | 补证→解除 |
| 洞察 insight | `handling_status`: `pending` → `confirmed\|adopted\|rejected\|needs_manual_review` | 待处置/已处置 | handle |
| 快照 snapshot | `frozen` | 已冻结 | 只读证据 |
| 服务证据 | `matched\|partial\|mismatch\|unavailable` | 比对结果 | — |
| 申诉（上位 Spec，代码待建） | `appeal_requested → appeal_reviewing → appeal_approved / appeal_overruled` | 待受理/处理中/已答复 | N07–N09 |

**实际源码路径**

| 关注点 | 路径 |
|---|---|
| 工作台外壳 | `src/views/console/WorkspaceShell.vue` |
| 九工作台组件 | `src/views/console/workspaces/*App.vue` |
| 登录/会话/退出 | `src/views/console/ConsoleApp.vue`、`ConsoleLogin.vue`、`src/api/http.ts`、`src/api/client.ts` |
| 前端 LTC 客户端 | `src/api/client.ts`（ltc* 导出） |
| 授权核心 | `server/auth.js` |
| LTC 领域 | `server/ltc.js` |
| HTTP 路由 | `server/index.js`（`routeLtc` / auth） |
| 种子账号 | `server/seed.js` `ACCOUNTS` |
| Spec 文档 | `docs/LTC-WORKBENCH-SPEC.md` 及上位 Spec |

**阶段 A 基线结果（2026-09-24）**

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test server/test-ltc.mjs` | 0 | 17 pass / 0 fail |
| `node --test server/test-account-matrix.mjs` | 0 | 10 pass / 0 fail |
| `node --test server/test-device-ltc.mjs` | 0 | 12 pass / 0 fail |
| `node --test server/test-real-devices-seed.mjs` | 0 | 7 pass / 0 fail |
| `npm run build` | 0 | vue-tsc + vite build 成功（chunk>500kB 警告保留） |
| `node server/ws-smoke.mjs` | 未执行 | 需活服；记为验证缺口（非本迭代阻塞） |
| 前端单测 | 未执行 | 无框架；记为验证缺口，阶段 B 起用现有 node:test 覆盖 access/navigation 纯函数 |

**阶段 A 遗留缺口（进入 B/C/D 前须知）**

1. `family_contact` 非登录账号 ↔ 本 Spec 要求可登录 `family_workspace`：须改 ACCOUNT-MATRIX + seed + `ROLE_WORKSPACE_MAP`（阶段 D，Spec 先行已在 §0.3/§4.4 声明）。
2. K05 材料域、K04 统一动作、N01–N15 全部未实现：API-CONTRACT 须正式登记字段后实现。
3. GET 任务详情服务函数已备、HTTP 路由缺失：阶段 A 对齐 API-CONTRACT 补路由。
4. 无服务端 logout、无 `/v1/auth/session` 恢复端点：阶段 B 按 §3.1 评估是否扩展。
5. 前端 mock 开关非显式 env：阶段 B 补本地开发开关且生产恒真实接口。
6. 医保终审/申诉正式发布、解除暂缓完整链路依赖 K04/K11 扩展（阶段 C）。

#### 9.2.2 核定维护要求

| 分类 | 实际值记录要求 |
|---|---|
| K01–K15 | 实际路径、方法、类型、服务文件、对应测试 |
| N01–N15 | 复用接口或正式新增接口、权限和字段 |
| P.* | 平台实际权限码与账号矩阵归属 |
| 状态映射 | 原始枚举 → 页面文案 → 可执行动作 |
| 路径 | WorkspaceShell、会话、路由、各角色组件和服务端模块的实际位置 |
| 测试 | 前端单次运行命令、后端单次运行命令、契约/端到端命令及覆盖范围 |

后续阶段若发现与上表不符，**先改本表与 API-CONTRACT，再改代码**。

### 9.3 阶段 B：外壳与导航收敛

| 项目 | 要求 |
|---|---|
| 既有文件 | 阶段 A 定位的 src 内 WorkspaceShell.vue、会话 store、路由、导航配置和登录页 |
| 拟新增文件 | src/features/ltc-workbench/access.ts；src/features/ltc-workbench/navigation.ts；src/features/ltc-workbench/state-labels.ts；src/features/ltc-workbench/components/TodayTodoList.vue；ScopeBadge.vue；ActionReceipt.vue；StatusPill.vue；src/api/ltc-workbench.ts |
| 服务端 | 既有授权中间件与工作台服务；需要补齐时在现有 server 目录约定下新增 workbench-summary 与 workbench-todos 服务 |
| 任务 | 登录分流、准入页、导航可见性、顶栏、列表恢复、未保存提示、回执、摘要与待办接线 |
| 验证命令 | 阶段 A 核定的现有前后端测试命令；对应路由/授权测试命令；npm run build |
| DoD | 第 3 节行为通过；九个既有工作台兼容；六类角色入口一致；深链接及所有数据读取均有服务端授权；构建通过 |

#### 9.3.1 阶段 B 实施报告（2026-09-24）

**改动文件**

| 类型 | 路径 |
|---|---|
| 新增前端模块 | `src/features/ltc-workbench/access.ts`、`navigation.ts`、`state-labels.ts` |
| 新增组件 | `components/TodayTodoList.vue`、`ScopeBadge.vue`、`ActionReceipt.vue`、`StatusPill.vue` |
| 新增页面 | `pages/FamilyAccess.vue`（家属准入占位） |
| 新增 API | `src/api/ltc-workbench.ts`（N01/N02） |
| 改外壳 | `src/views/console/WorkspaceShell.vue`（获授工作台过滤、今日必做、范围徽标、实时态、导航、家属门禁、退出清理） |
| 改会话 | `src/api/http.ts`、`src/api/client.ts`、`src/api/types.ts`（`workspaces` 字段；`VITE_USE_LOCAL_MOCK` 开关） |
| 服务端 | `server/ltc.js`（`getWorkbenchSummary` / `listWorkbenchTodos` / `authorizedWorkspacesFor`）；`server/index.js`（N01/N02 路由 + 登录返回 `workspaces`） |
| 环境 | `.env.example` 增加 `VITE_USE_LOCAL_MOCK` |
| 测试 | `server/test-workbench.mjs` |
| 文档 | 本节报告；API-CONTRACT §3.4.1（阶段 A 已定义 N 接口） |

**行为对齐（§3）**

| Spec 点 | 结果 |
|---|---|
| 登录返回 workspace/permissions/data_scope + 获授 workspaces | 通过 |
| 多工作台切换器只展示获授列表 | 通过（服务端 `authorizedWorkspacesFor` + 前端 `filterWorkspaceGroups`） |
| 顶栏范围徽标 | 通过（`ScopeBadge`） |
| 实时状态仅连接后显示已连接 | 通过（初始 false，事件驱动） |
| 今日必做首屏 + 队列计数 + 待办 | 通过（N01/N02 接线） |
| 导航五组按静态权限可见 | 通过（`filterNavGroups`） |
| 家属无有效绑定 → 准入页 | 骨架通过（`FamilyAccess`；N03 阶段 D 接真数据） |
| 九工作台兼容挂载 | 通过（map 未拆） |
| 退出清理会话与摘要缓存 | 通过（`handleLogout`） |
| 本地样例显式开关 | 通过（`VITE_USE_LOCAL_MOCK=1` 且 DEV） |
| 未保存离开提示 / 列表筛选恢复 | 未做（阶段 C 表单与列表页） |

**验证命令与退出码**

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test server/test-ltc.mjs` | 0 | 17 pass |
| `node --test server/test-account-matrix.mjs` | 0 | 10 pass |
| `node --test server/test-device-ltc.mjs` | 0 | 12 pass |
| `node --test server/test-real-devices-seed.mjs` | 0 | 7 pass |
| `node --test server/test-workbench.mjs` | 0 | 4 pass |
| `npm run build` | 0 | vue-tsc + vite 成功 |

**AC 状态（阶段 B 范围）**：登录/导航/权限基线由既有矩阵测试覆盖 → **通过**；AC-M/I/A/F/O/T 页流项 → **未执行（阶段 C/D）**。

**剩余阻塞**

1. 家属真实绑定数据与 N03 → 阶段 D。
2. 待办 `open` 尚未路由到对象详情 → 阶段 C。
3. 列表筛选持久化、未保存离开、二次确认回执组件场景接入 → 阶段 C。
4. `ActionReceipt` 已建组件，待页流动作回执接线 → 阶段 C。

### 9.4 阶段 C：分角色页流与接口联调

| 项目 | 要求 |
|---|---|
| 既有文件 | 医保、经办、评估师工作台与申请/任务/工单/结算/报告模块；src/api 下既有 LTC 客户端；server 内对应控制器与服务 |
| 拟新增文件 | src/features/ltc-workbench/pages/MedicalToday.vue；InsurerToday.vue；AssessorToday.vue；src/features/ltc-workbench/components/ObjectContextHeader.vue；MaterialVersionList.vue；HandoffTimeline.vue |
| 服务端补齐 | 现有 /v1/ltc 聚合查询、动作回执、范围校验、SLA 读取；保持原有领域服务为权威 |
| 任务 | 首屏任务、统一对象上下文、材料版本、现场快照、洞察处置、监管暂缓、正式核定、报表入口 |
| 验证命令 | 阶段 A 核定的现有测试；LTC 契约、跨范围访问、状态迁移、报告权限回归；npm run build |
| DoD | AC-M、AC-I、AC-A 中本阶段能力通过；申诉/绑定相关 AC 在阶段 D 完成；统计与列表同口径；空值和正式结果语义正确 |

#### 9.4.1 阶段 C 实施报告（2026-09-24）

**改动文件**

| 类型 | 路径 |
|---|---|
| 服务端 | `server/ltc.js`：`applicationAction`（accept / return_materials / materials_pass / finalize / read）、`listApplicationMaterials`、`listApplicationTimeline`、`applicationSla`；supervision `release` 解除 `suspended` |
| 路由 | `server/index.js`：`POST …/applications/{id}/actions`、`GET …/materials`、`…/timeline`、`…/sla` |
| 新增页面 | `pages/MedicalToday.vue`、`InsurerToday.vue`、`AssessorToday.vue` |
| 共享组件 | `ObjectContextHeader`、`MaterialVersionList`、`HandoffTimeline`（复用 `ActionReceipt` / `StatusPill`） |
| API | `src/api/ltc-application.ts` |
| 接线 | 三工作台挂载 Today；`WorkspaceShell.openTodo` 打开申请上下文（材料+时间线） |
| 测试 | `server/test-phase-c.mjs` |
| 标签 | `state-labels.ts` 增加 material 枚举 |

**行为对齐**

| Spec 点 | 结果 |
|---|---|
| 医保：终审 / 暂缓 / 解除 / 抽审 + 证据链入口 + 回执 | 通过 |
| 经办：受理 / 补正退回 / 派单 / 审核通过 / 结算初审 + 二次确认 | 通过 |
| 评估师：接单 / 快照 / 洞察处置 / 提交 / 退回 + 缺项提示 | 通过 |
| 材料版本与办理时间线 | 通过（最小清单视图 + timeline） |
| SLA 显示 | 通过（DEFAULT_3D；缺规则时「时限待配置」） |
| 待办 → 对象上下文 | 通过 |
| 设备 conclusion null | 通过（快照展示空值语义） |
| 申诉 / 家属绑定 AC | 未执行（阶段 D） |

**验证命令与退出码**

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test server/test-ltc.mjs` | 0 | 17 pass |
| `node --test server/test-account-matrix.mjs` | 0 | 10 pass |
| `node --test server/test-device-ltc.mjs` | 0 | 12 pass |
| `node --test server/test-real-devices-seed.mjs` | 0 | 7 pass |
| `node --test server/test-workbench.mjs` | 0 | 4 pass |
| `node --test server/test-phase-c.mjs` | 0 | 6 pass |
| `npm run build` | 0 | vue-tsc + vite 成功 |

**AC 状态（阶段 C）**

| AC | 结果 | 证据 |
|---|---|---|
| AC-I01 待受理计数与列表 | 通过 | `test-phase-c` 受理测试 + InsurerToday 队列 |
| AC-I02 材料补正退回 | 通过 | `test-phase-c` return_materials |
| AC-I03 新旧材料版本 | 部分通过 | 材料清单含版本与退回原因；文件上传仍为内存路径（K05 完整上传后续） |
| AC-I04 派单生成任务 | 通过 | InsurerToday 派单 + 既有 device-ltc 派单测试 |
| AC-I05 评估退回 | 通过 | 经办 return + reason 门禁（既有 ltc 测试） |
| AC-I06 结算初审 | 通过 | InsurerToday + 既有四步分离测试 |
| AC-I08 无派单权限 403 | 通过 | 既有 account-matrix / ltc 测试 |
| AC-M01 待终审首屏 | 通过 | MedicalToday 队列 + N01 分组 |
| AC-M02 越权 404 | 通过 | 既有越权测试 |
| AC-M03 抽审案件 | 通过 | MedicalToday 抽审 + createSupervisionCase |
| AC-M04 暂缓门禁 | 通过 | `test-phase-c` suspend → finalize 拒绝 |
| AC-M05 解除暂缓 | 通过 | release 清除 suspended 并恢复 |
| AC-M06 终审核定回执 | 通过 | applicationAction finalize + receipt |
| AC-A01/A02/A05/A06/A07 | 通过 | AssessorToday + 既有任务测试 |
| AC-A08 设备 null | 通过 | 既有红线测试 + 快照 UI |
| AC-M07/M08 申诉发布、报告筛选 | 未执行 | 阶段 D / 报告入口部分 |

**剩余阻塞**

1. 完整材料文件上传/下载（K05）与真实版本 diff → 后续窗口或阶段 D 评估。
2. 报告「从当前筛选生成」一键入口 → 报告模块增强。
3. 申诉 AC → 阶段 D。
4. 列表筛选 URL 持久化、未保存离开守卫 → 可选增强。

### 9.5 阶段 D：家属工作台、机构入口与标签能力

| 项目 | 要求 |
|---|---|
| 既有文件 | 家属角色与账号配置、机构工作台、平台工作台、项目配置、设备台账、服务端相关授权/业务模块 |
| 拟新增文件 | src/features/ltc-workbench/pages/FamilyWorkspace.vue；FamilyAccess.vue；AppealDetail.vue；InstitutionLtcEntry.vue；DeviceLabels.vue；src/api/ltc-family.ts；src/api/ltc-appeals.ts；src/api/ltc-device-labels.ts |
| 服务端补齐 | 现有 server 架构下的 family-bindings、appeals、device-labels、device-bindings 模块；对应种子账号环境注入 |
| 任务 | 完整家属申报/补正/申诉闭环；核验队列；机构代理关系与设备绑定；标签与统计；项目下发回执 |
| 验证命令 | 阶段 A 核定的现有测试；家属隔离/授权撤销/申诉闭环/机构委托/设备区间/标签范围回归；npm run build |
| DoD | AC-F、AC-O、AC-T 通过；AC-M/AC-I 的申诉与授权核验项通过；全部 AC 有证据；宿迁在册 3 台与扫描口径独立；构建通过 |

#### 9.5.1 阶段 D 实施报告（2026-09-24）

**改动文件**

| 类型 | 路径 |
|---|---|
| 种子/权限 | `server/seed.js` `family_demo`；`server/auth.js` `FAMILY_WORKSPACE`；nursing_admin 扩展 device/application |
| 服务端 N03–N15 | `server/ltc.js` family bindings / appeals / device-labels / device-bindings |
| 路由 | `server/index.js` 对应 `/v1/ltc/family|appeals|device-labels|device-bindings` |
| API | `src/api/ltc-family.ts`；`http.patch` |
| 页面 | `FamilyWorkspace.vue`、`DeviceLabels.vue`、`InstitutionLtcEntry.vue` |
| 接线 | Shell `family_workspace`；平台/系统/设备挂标签；护理院与平台挂代申报 |
| 测试 | `server/test-phase-d.mjs`（11） |
| 文档 | `ACCOUNT-MATRIX.md` family_demo |

**行为对齐**：AC-F01/F03/F07/F08/F09/F10、AC-T01–T05、AC-O06/O07 → **通过**；AC-M07/AC-I07 申诉闭环服务端 → **通过**；K05 文件上传、K14 下发回执、云扫描真实通道 → **部分/后续**。

**验证退出码**：test-ltc 17 / matrix 10 / device-ltc 12 / seed 7 / workbench 4 / phase-c 6 / phase-d 11 / build 0（family_workspace 期望修正后重跑）。

**剩余**：材料真上传、项目下发回执、生产夜间窗口发布。

### 9.6 验证与阶段报告

每阶段报告包含：实际改动文件、修订 Spec、实际执行命令及退出码、AC 结果、剩余阻塞及影响范围。使用通过/失败/未执行三种结果，测试输出与截图可作为证据。

最低回归集合：

| 类别 | 必须验证的行为 |
|---|---|
| 登录/导航 | 六类角色默认工作台、既有九工作台兼容、多工作台切换、退出及深链接 |
| 权限 | 同角色跨区域、跨机构、其他评估师、其他家庭、跨项目；详情/列表/计数/报告/导出分别验证 |
| 页流 | 材料补正、任务退回、监管暂缓/解除、终审、申诉与正式答复 |
| 一致性 | 版本冲突、重复提交、材料历史、并发处理、摘要与列表口径 |
| 设备 | null 语义、历史绑定区间、宿迁 3 台、云扫描只比对、苏州项目与环境筛选 |
| 反馈 | 空态、加载失败、保存失败、实时断开、报告失败与下发部分失败 |

## 10. 风险、依赖与回滚

| 风险/依赖 | 控制与完成条件 |
|---|---|
| 未核实的仓内契约 | 阶段 A 逐项绑定实际 API、权限和状态；原始候选在核定后替换。 |
| 权限差异 | 服务端统一校验角色能力与对象关系；计数、报告和下载接受相同范围测试。 |
| 家属准入依赖 | 复用可信身份与授权核验，审核角色由项目规则确定；待核验账号通过准入页继续办理。 |
| 申诉责任边界 | 采用正式流程责任方、期限、复评规则与发布权限；推荐值在第 11 节明确。 |
| 设备字段误用 | 展示监测证据与正式结果来源；null 保持空值；正式等级与待遇来自责任主体的结果记录。 |
| 环境及种子 | 密钥与口令仅由环境注入；本地样例开关受环境限制，vendor/platform 使用真实接口。 |
| 测试基线 | 阶段 A 记录实际基线；缺失门禁补齐后进入下一阶段。 |
| 发布依赖 | 生产日间保持可看；中断性操作使用 INTEGRATION-SPEC 规定的时区和夜间窗口。 |
| 大屏依赖 | 既有 /v1 兼容性作为回归项；anqiao-dashboard 的新视觉及发布由关联计划承接；suqian-dashboard 保持只读。 |

回滚以代码与静态构建为准：

1. 发布前记录稳定代码版本、静态构建产物及其配置版本，按 INTEGRATION-SPEC 留存。
2. 新增接口保持既有消费者兼容；新增字段与页面发布按现有功能开关/配置机制控制。
3. 发现回归时恢复上一稳定前后端代码与静态构建，执行规定健康检查和已有业务路径验证。
4. 业务记录、授权记录、材料版本和审计历史保持持久化；结构变更采用关联迁移计划及可兼容回滚步骤。
5. 配置回退引用上一个有效版本并保存回退审计；设备已收到的配置以逐设备回执核验。
6. 回滚演练在本地/验证环境完成；生产执行遵守既定窗口和现有授权流程。

## 11. 附录

### 11.1 术语

| 术语 | 工作台使用定义 |
|---|---|
| 工作台 | 会话授予的角色任务入口，具有对应导航与数据范围。 |
| 被评估人 | 长护险申请和评估所指向的对象。 |
| 家属/申请人 | 经身份认证、有效绑定及本人/监护人授权进入家属工作台的账号。 |
| 代申报 | 获授权机构工作人员代表对象提交申请的行为，保存代理关系。 |
| 申请 | 关联对象、材料版本、任务、正式结果和申诉的业务主对象。 |
| 任务 | 分配给评估人员、承载现场记录与提交的对象。 |
| 工单 | 承载处理要求、接收方、时限和回执的交接对象。 |
| 快照 | 特定提交时点的评估证据版本。 |
| AI 洞察 | 供责任人员查看证据并作出处置的辅助信息。 |
| 监管暂缓 | 约束指定业务动作并具有解除条件的监管决定。 |
| 正式结果 | 正式流程责任主体形成并按权限发布的等级、待遇或相关核定记录。 |
| 申诉 | 对已发布正式结果提出理由和材料、进入正式处理的独立对象。 |
| 在册设备 | 满足台账及项目统计条件的设备资产。 |
| 云扫描比对 | 将扫描记录与台账和部署事实进行匹配、核对的能力。 |
| SLA | 由正式规则定义的起算、日历、暂停、恢复与截止时限。 |

用字及正式定义以 DOMAIN-GLOSSARY 为准，阶段 A 将新增术语同步到该文档。

### 11.2 账号与演示口令注入

先读取仓内现有环境变量名并复用。下列是缺少定义时的命名建议，阶段 A 将最终名称写入环境模板、账号矩阵和种子脚本。环境模板只记录名称及空值。

| 用途 | 建议环境变量名 | 读取位置 |
|---|---|---|
| 令牌签名密钥 | ANQIAO_TOKEN_SECRET | 服务端认证配置 |
| 医保种子口令 | ANQIAO_SEED_MEDICAL_PASSWORD | 服务端种子脚本 |
| 经办种子口令 | ANQIAO_SEED_INSURER_PASSWORD | 服务端种子脚本 |
| 评估师种子口令 | ANQIAO_SEED_ASSESSOR_PASSWORD | 服务端种子脚本 |
| 家属种子口令 | ANQIAO_SEED_FAMILY_PASSWORD | 服务端种子脚本 |
| 机构 admin 种子口令 | ANQIAO_SEED_ORG_ADMIN_PASSWORD | 服务端种子脚本 |
| 机构 user 种子口令 | ANQIAO_SEED_ORG_USER_PASSWORD | 服务端种子脚本 |
| 技术账号种子口令 | ANQIAO_SEED_SU_PASSWORD | 服务端种子脚本 |

medical01、insurer01、assessor01 及统筹区专员沿用账号矩阵。family_demo 为建议的开发种子名，种子账号同时关联明确的测试对象、有效期及授权凭证。生产账号创建采用平台现有流程。测试环境中的授权记录与演示项目/环境属性保持一致。

### 11.3 需业务方拍板的开放问题

上位 Spec 已定义的事项直接采用其规则。以下推荐值用于上位 Spec 未覆盖时的产品设计和本地验证；正式业务动作生效前由业务责任方确认并写入领域规则或配置。

| 问题 | 推荐默认值 | 确认落点 |
|---|---|---|
| 绑定与授权核验责任方 | 当前受托经办机构中获授核验权限的人员；机构提供代办资料 | PLATFORM-SPEC、项目配置 |
| 监护/亲属关系证据与有效期 | 复用现有业务认定方式，记录凭证引用、生效日、到期日和撤销记录 | LTC-INSURANCE-SPEC、API-CONTRACT |
| 多名家属的动作边界 | 分别授权；主申请联系人接收补正待办，其他联系人按授权只读或协作 | 账号/关系授权规则 |
| 家属与机构共同可见的申请 | 同一申请对象；当前有效补正责任人提交，其他获授方查阅公开进度 | 代办与材料规则 |
| 申诉受理与正式答复责任方 | 经办受理和协办，医保按正式权限形成/发布答复 | LTC-INSURANCE-SPEC |
| 申诉期限及次数 | 直接采用统筹区正式规则；规则待配置时显示办理指引并进入人工处理入口 | 流程配置 |
| 任务退回接收方 | 返回原派单经办队列；改派保留原任务历史 | 任务状态机 |
| 暂缓期间公开文案 | “审核中”，显示公开补证要求与更新时间 | 公开状态映射 |
| SLA 缺失项 | 展示“时限待配置”并继续显示待办；业务方补齐规则后服务端计算 | 流程配置 |
| 实时通道降级刷新 | 复用现有配置；建议可见页面每 30 秒刷新，后台暂停 | 前端/项目配置 |
| 标签环境与试点关系 | environment_type 与 program_stage 两个独立维度 | 项目标签字典 |
| 苏州机群归属 | 按台账真实项目和部署地域，分别统计生产、测试、演示 | 设备台账 |
| 设备并存/占用规则 | 采用现有设备与监测场景规则；校验设备、对象和生效区间 | LTC-INSURANCE-SPEC |
| 报告格式、有效期与字段脱敏 | 沿用 API-CONTRACT 报告章节及角色字段授权 | API-CONTRACT |
| 多工作台默认入口 | 登录响应 workspace 为默认；主动切换在当前会话生效 | PLATFORM-SPEC |

### 11.4 最终交付验收

- docs 中本文件与关联 Spec 一致，接口、权限、状态和实际源码路径均已核定。
- 六类角色的工作台行为、对象上下文和交接闭环按本文件实现。
- 各角色 AC、跨范围授权、原有测试及 npm run build 有真实结果记录。
- 等级与待遇的正式责任主体、设备 null 语义、宿迁 3 台及云扫描比对口径满足硬性基线。
- 实现报告包含改动文件、测试命令、AC 结果、构建结果与仍需业务确认的事项。

