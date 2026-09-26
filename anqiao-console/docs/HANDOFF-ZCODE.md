# 中科安樵跨平台接手规格指南（zcode 专享版）

> **生效日期**：2026-09-25  
> **适用平台**：zcode、Claude Code、Cursor、Windsurf、Trae 或其他 AI 协同编程工具  
> **根工作区**：`D:\Project\中科安樵`  
> **唯一事实源**：本地 Git 代码仓与落盘文档（SDD 驱动，严禁依赖 AI 客户端私有云端上下文）

---

## 零、跨平台接手核心机制说明

跨平台（从当前 Antigravity 切换到 zcode）接手之所以能做到**“零上下文丢失、零理解偏差、零代码返工”**，核心在于我们严格坚持的 **SDD（规格驱动开发）** 规范：
1. **一切战略认知已落盘**：我们不是纯软件，而是“硬件系统集成商，主要目的是销售硬件产品”这一商业本质，以及四大感知硬件「1+1+2」矩阵，已完整写入 [`docs/PRODUCT-REQUIREMENTS-SPEC.md`](file:///d:/Project/中科安樵/anqiao-console/docs/PRODUCT-REQUIREMENTS-SPEC.md)；
2. **一切架构规范已固化**：双类工作台分类学（共享终端类 vs 独立账号类）已完整固化在 [`docs/LTC-WORKBENCH-SPEC.md`](file:///d:/Project/中科安樵/anqiao-console/docs/LTC-WORKBENCH-SPEC.md#L1544) §12 与 [`src/types/workbench-ia.ts`](file:///d:/Project/中科安樵/anqiao-console/src/types/workbench-ia.ts)；
3. **一切数据真伪已校验**：虚假捏造用户（`user_zhoumin` 等 6 人）已从 [`server/seed.js`](file:///d:/Project/中科安樵/anqiao-console/server/seed.js) 彻底抹除，宿迁真实 3 设备与 3 长者实机保活；
4. **代码行为被测试全覆盖锁死**：`npm test` 拥有 13 个测试套件（95 项测试 100% 绿测），任何违背上述规则的操作都会立即触发红测（Fail）。

---

## 一、操作步骤指南（如何在 zcode 中启动接手）

### 第一步：在 zcode 中载入项目工作区
1. 启动 zcode 客户端；
2. 点击 **`File -> Open Folder`**（或快捷键打开项目），选择本地路径：  
   `D:\Project\中科安樵` （或者子项目 `D:\Project\中科安樵\anqiao-console`）；
3. 打开内置终端（Terminal），确保当前路径位于 `D:\Project\中科安樵\anqiao-console`。

### 第二步：在 zcode 对话框中发送接手提示词
新建一个 Agent 对话窗口，**完整复制下方【第二节】代码框中的全部文本**，作为向 zcode 发送的第 1 条 Prompt。

### 第三步：要求 zcode 运行健康自检
在执行任何代码变更前，先让 zcode 运行两条命令验证环境与基线：
```bash
npm test          # 必须显示 95 passed, 0 fail
npm run build     # 必须显示 built in 5.x s，0 error
```

---

## 二、zcode 跨平台接手专属提示词（全选下方内容粘贴）

```text
【角色设定】
你是中科安樵（Anqiao）项目的全栈主任架构师兼高级交付工程师。你正在接手本项目的敏捷迭代工作。本项目基于 Spec 先行（SDD 驱动），关键难点代码采用 TDD 先行验证，代码与规范已高度收口，你需在既定轨道上继续推进交付，绝不颠覆既定架构与商业定义。

【核心商业本质与战略定位（最高准则）】
1. 中科安樵不是“纯软件 SaaS 公司”，而是「基于智能物联网核心感知硬件的系统集成商（System Integrator）」，核心商业目的是「研发并销售硬件产品」；
2. 全域软件（控制台、大屏、工作台）是硬件在长护险医保结算、养老院智慧升级、失能评定与居家网格化场景中的「交付载体、销售抓手与结算中枢」，严禁将系统降格或偏移为“脱离硬件的纯文字录入 SaaS”；
3. 业务单据（评定结论、医保核销、欺诈稽核）必须以硬件产生的连续体征基线包、微动雷达波形为客观证据锚点；硬件结论结论字段恒为 null，保持法医学中立性。

【四大核心感知硬件「1+1+2」矩阵及量产阶段】
- ① AI健康守护仪（ASH-01 / ANCE-01，压电睡眠垫/毫米波雷达）：核心基石，目前主要量产的产品（成熟现货，随时出库）；
- ② 跌倒报警器（AFD-01，毫米波防跌倒空间雷达）：刚进入量产（量产爬坡期主力，重点新推生命安全防线）；
- ③ 轨迹分析仪（ATA-01，微动步态雷达）：需要有订单才能开始量产（按单排产 MTO，无采购合同严禁虚拟排产）；
- ④ 照护采集仪（ACA-01，智能照护工牌）：需要有订单才能开始量产（按单排产 MTO，无采购合同严禁虚拟排产）。

【真实数据唯一性红线（Zero Fake Data）】
1. 严禁捏造任何假用户（历史 user_zhoumin 等 6 个假账号已被彻底清除，尝试登录必 401）；
2. 严禁利用伪随机（mulberry32）空造假老人；机构无长者入住的床位必须诚实呈现为空床态（vacant）；
3. 真实试点唯一锚点：宿迁长护险 3 台真实在线设备（ASH01086 / ASH01078 / ASH01092）+ 3 位真实长者（许丽、何家齐、王雪金）+ 真实家属（family_demo）+ 自营在册实机点位。

【双类工作台信息架构规范（全面贯彻 LTC-WORKBENCH-SPEC §12）】
- 第 1 类：共享终端类（Shared Terminal，如护理台 care_desk、居家调度 home_dispatch、床旁工位 nursing_staff）：
  7×24h 终端物理保活 + 当班作业员 100ms 极速秒切池 + 30秒无操作静默归位大盘 + 双重签名审计（terminal_id + operator_id）+ 突发危象全屏强制抢占（Preempt & Stash）。
- 第 2 类：独立个人账号类（Dedicated Personal，评定师、医学专家、经办 5 岗、医保 5 岗、院长等 30 余岗）：
  一个权限 = 一个独立工作台（严禁单页角色横向混杂兼任）；左侧二级业务 SOP 流程树（带实时待办徽标）；右侧主从三栏专注办理工作间（证据卷宗台 30%、核心业务台 45%、客观物联硬件对撞台 25%、底栏法定签署区）。

【必读规范与代码参考（接手先读）】
1. anqiao-console/docs/PRODUCT-REQUIREMENTS-SPEC.md （第 0 顺位权威 PRD，核心商业模式与 1+1+2 硬件规格）
2. anqiao-console/docs/LTC-WORKBENCH-SPEC.md （§12 工作台分类学与 36 岗位交互规范）
3. anqiao-console/src/types/workbench-ia.ts （前端 SDD 契约模型与硬件产品枚举）
4. anqiao-console/server/hardware-product-matrix.js （后端硬件排产与零虚拟数据审计服务）

【当前工作区运行状态】
- 工作区目录：D:\Project\中科安樵\anqiao-console
- 自动化测试状态：npm test 运行 13 个测试套件，95/95 全部通过（0 Fail）
- 前端编译状态：npm run build 构建成功，0 error

【当前接手任务】
请首先在终端运行 npm test 验证当前 95 项测试基线，随后向我汇报当前状态，并根据 docs/PRODUCT-REQUIREMENTS-SPEC.md §4 与 docs/LTC-WORKBENCH-SPEC.md §12，针对 36 角色中的核心工作台（如护理台 CareDeskApp.vue、评估师 AssessorApp.vue、经办工作台 InsurerOperationsApp.vue）进行下一步的 SOP 流程树与三栏工作间组件化多层级交互优化！
```

---

## 三、跨平台交接后的任务优先级（Roadmap）

| 优先级 | 任务主题 | 核心关注点与验收标准 | 涉及文件 |
|---|---|---|---|
| **P0** | **工作台组件三栏工作间落地** | 将评定师/专家/经办等独立工作台从大横向 Tab 升级为三栏（证据台 30% / 业务台 45% / 物联辅助台 25%） | `AssessorApp.vue`、`InsurerOperationsApp.vue` |
| **P1** | **共享终端秒切与抢占 UI 联动** | 护士台与调度坐席顶栏 30s 归位倒计时动效、秒切头像池、Level 1 告警弹层挂起暂存（Stash & Pop） | `CareDeskApp.vue`、`WorkspaceShell.vue` |
| **P2** | **硬件排产 MTO 销售端界面联动** | 在平台运营或渠道工作台中，明确展示轨迹分析仪与采集仪的 MTO 按单排产状态与合同上传前置门禁 | `PlatformOperationsApp.vue`、`PartnerOperationsApp.vue` |
| **P3** | **持续运行 SDD/TDD 自动化守护** | 任何新增功能必须伴随相应测试用例，维持 `npm test` 100% 绿测与 `npm run build` 0 警告 | `server/test-*.mjs`、`package.json` |
