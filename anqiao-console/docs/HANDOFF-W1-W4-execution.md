# 中科安樵 · PRD §2.3 实现工作流交接文档（执行者：GLM-5.3-Flash）

> 交接日期：2026-09-26 ｜ 交接人：上一会话的架构师代理
> 本文档按「小步执行 + 每步验证 + 失败即停」设计，专为长上下文推理能力有限的执行模型编写。
> **铁律：一次只做一个工作流（W1→W2→W3→W4），每个步骤执行后立即运行该步骤的验证命令，验证失败两次即停止并汇报，禁止即兴发挥。**

---

## 一、角色与使命

你是中科安樵（Anqiao）项目的实现工程师。项目基于 SDD（规格驱动）+ TDD（红绿测试）纪律。你的任务是完成 PRD §2.3 定义的四个实现工作流。商业与产品背景**不要**自行推断，一律以下列文件为准。

## 二、必读文件（开工前按序读取，只需读标注部分）

| 顺序 | 文件（路径基于 `D:\Project\中科安樵\anqiao-console\`） | 读什么 |
|---|---|---|
| 1 | `docs/PRODUCT-REQUIREMENTS-SPEC.md` §2.3 全节 | 三域模型、四工作流要求与验收标准（你的任务来源，权威） |
| 2 | `docs/API-CONTRACT.md` §3.4.1（N16 行附近） | 契约登记格式范例；W2/W3 需仿照此格式新增契约行 |
| 3 | `server/seed.js` `ACCOUNTS` 数组 + `DEVICE_ASSETS` 数组 | 账号种子与设备资产（只读理解，W1 删账号行） |
| 4 | `server/ltc.js` 开头 `ORGS` 常量 | 组织注册表（W1 删 kaijian 条目、W4 改 insurer 条目） |
| 5 | `docs/LTC-WORKBENCH-SPEC.md` §9.5.2 | 上一批已完成的工作（SOP 树+三栏工作间），**不要重做、不要改坏** |

## 三、环境与基线

- 工作目录：`D:\Project\中科安樵\anqiao-console`；Shell 为 Windows Git Bash（路径用正斜杠）。
- **开工基线**（第一步必做）：
  ```bash
  cd "D:/Project/中科安樵/anqiao-console" && npm test
  ```
  预期：**101 项测试，0 fail**，14 个套件（含 `test-workbench-sop-studio.mjs`）。任何基线不绿 → 停止汇报，勿开工。
- 前端验证：`npx vue-tsc -b`（预期 0 error）＋ `npm run build`（预期 built 成功）。
- 种子口令 `SEED_ACCOUNT_PASSWORD` 由环境注入，测试脚本会自设临时值；**任何文件中不得出现明文口令**。

## 四、纪律红线（违反任意一条 = 立即停止）

1. 只改步骤明确列出的文件与行；看到无关代码问题，写进汇报的「发现」栏，**不修**。
2. 不新增任何模拟业务数据（患者/长者/申请/工单）；体验域数据按 PRD §2.3.3 于验收后统一制作。
3. 不删除、不改名 `DEVICE_ASSETS` 中任何设备（48 台为真实资产）。
4. 不动宿迁真实试点实体：3 位长者（许丽/何家齐/王雪金）、3 台设备（ASH01086/ASH01078/ASH01092）、机构 `bureau_suqian` / `insurer_suqian` / `assessor_suqian` / `family_demo`。
5. 不动 `insurer_suqian` 机构名（太保寿险宿迁经办专班是 PRD §2.2 认定的真实试点机构）。
6. 不重做已完成工作：N16 流程树接口、`SopWorkflowTree/MasterQueueList/MasterDetailStudio` 组件、AssessorApp/InsurerOperationsApp/CareDeskApp 的三栏改造。
7. 汇报只写陈述句：改了什么文件、跑了什么命令、退出码与结果、剩余阻塞。不写推理过程。

## 五、工作流 W1：账号矩阵收敛

**目标（PRD §2.3.3 + §2.3.5 第一行）**：种子矩阵仅余三类账号（宿迁真实试点 / 演示统筹区某某市 / 平台自营）。

### W1-步骤

1. **基线**：`npm test` → 101 pass。
2. **删账号**（`server/seed.js` `ACCOUNTS` 数组中删除下列 **45 行**，一行一个账号）：
   - 凯健租户 27 个：`kaijian_admin, kaijian_nursing_dir, kaijian_ltc_officer, headnurse_4f, headnurse_3f, headnurse_2f, headnurse_1f, ward_4f_station, ward_3f_station, ward_2f_station, ward_1f_station, kaijian_nurse01, kaijian_nurse02, kaijian_cg_4f_01, kaijian_cg_4f_02, kaijian_cg_4f_03, kaijian_cg_4f_04, kaijian_cg_3f_01, kaijian_cg_3f_02, kaijian_cg_3f_03, kaijian_cg_2f_01, kaijian_cg_2f_02, kaijian_cg_2f_03, kaijian_cg_1f_01, kaijian_cg_1f_02, kaijian_cg_1f_03, kaijian_rehab01`
   - 姑苏居家租户 18 个：`station_master, dispatch_center, cg_canglang_01, cg_canglang_02, cg_canglang_03, cg_canglang_04, cg_shuangta_01, cg_shuangta_02, cg_sanxiang_01, cg_sanxiang_02, rehab_chen, nurse_shenyaping, pt_chenjianxin, dementia_zhufang, cm_xumeiling, tech_zhanghongbo, qc_jiangguoqiang, biller_zhouliping`
3. **删组织与租户店**：
   - `server/ltc.js` `ORGS` 中删除 `kaijian` 条目（`home_care_gusu` 无条目，跳过）。
   - `server/seed.js`：删除 `TENANT_CONFIGS` 中 `kaijian` 与 `home_care_gusu` 两项及对应 `buildTenant` 产物引用；删除 `NURSES`（6 名凯健护工花名，先 `grep -n "NURSES" server/` 确认仅被凯健租户使用）。
   - `server/seed.js` 中 `TENANT_IDS` / 租户→项目映射函数中同步移除这两个租户 ID。
4. **前端诚实空态**：
   - `src/features/ltc-workbench/ward-staff.ts`：`allStaffList` 清为 `[]`，并保留导出接口不变；`CareDeskApp.vue` 秒切池区域加空态文案「本班次暂无在册护工」（模板中 `v-if="onDutyCaregivers.length === 0"`）。
   - `src/views/console/WorkspaceShell.vue` `WORKSPACE_GROUPS_CATALOG`：desc 中「87位在管长者」「72位在管」字样删除，改为「在管长者全景档案」类中性描述。
   - `src/views/console/workspaces/PatientDossierApp.vue`、`ReportsCenterApp.vue`、`DeviceMonitoringApp.vue`、`NursingStaffApp.vue`、`NursingHomeAdminApp.vue` 中硬编码「凯健国际护理院」→ 使用 `src/features/ltc-workbench/org-identity.ts` 的 `useOrgIdentity().orgName`（接线范例见 `CareDeskApp.vue` 的 `orgName` computed）。
5. **文档同步**：`docs/ACCOUNT-MATRIX.md` 删除上述 45 个账号行；在文首加一句「体验域角色群账号于系统验收后统一制作（PRD §2.3.3）」。
6. **验证与修复循环**：`npm test` 逐个修复失败套件（处置规则见下表），直至 0 fail；再跑 `npx vue-tsc -b` 与 `npm run build`。

### W1-失败测试处置规则（确定性指令）

| 套件 | 处置 |
|---|---|
| `test-home-care.mjs` | 姑苏租户已删、居家域无宿迁锚点：从 `package.json` test 脚本移除该文件；在 `docs/HOME-CARE-SPEC.md` 文末登记一行「体验数据与测试于系统验收后重建（PRD §2.3.3）」 |
| `test-shared-terminal-fsm.mjs` | 纯状态机测试：把用例里的 `kaijian_nurse01` 等操作员 ID/姓名改为通用值（如 `op_001` / 「当班护工甲」），断言逻辑不变 |
| `test-device-ltc.mjs`、`test-account-matrix.mjs`、`test-ltc.mjs`、`test-phase-d.mjs` | 先跑再读失败信息：引用被删账号的，改锚定到保留账号（演示区 `assessor01`/`insurer01`/`medical01` 均保留；真实域用 `assessor_suqian`、`suqian_expert`）；矩阵类断言按删除后的账号集合调整预期数量 |

## 六、工作流 W2：设备全生命周期管理（增/改/删）

**目标（PRD §2.3.2 + §2.3.5 第二行）**：`POST/PATCH/DELETE` 设备接口，写操作带权限校验与审计。

1. **契约先行**：`docs/API-CONTRACT.md` 设备章节新增三行（仿照 N16 行格式）：`POST /v1/devices`（device:write）、`PATCH /v1/devices/{id}`（device:write）、`DELETE /v1/devices/{id}`（device:write，宿迁 3 台受保护返回 403）。
2. **定位运行时设备存储**：`grep -n "DEVICE_ASSETS\|handleDevicesList\|lifecycle" server/index.js server/hw.js server/seed.js` —— 找到设备列表与生命周期日志的现有实现路径，新 CRUD 沿用同一存储与权限模式（`authorize(ctx, 'device:write')`）。
3. **TDD 红测**：新建 `server/test-device-crud.mjs`（复制 `server/test-workbench.mjs` 的 env 前缀与 import 骨架），断言：
   - `su` 或 `admin01` 可 POST 新建设备（新 device_id）→ 列表可查到；
   - 重复 device_id → 409；
   - `family_contact` 或无 `device:write` 角色 → 403；
   - PATCH 修改 label/type → 读取反映变更 + 生命周期日志追加一条；
   - DELETE 普通设备 → 列表移除 + 日志留痕；
   - DELETE `ASH01086`（或 ASH01078/092）→ 403 且提示「宿迁试点设备受保护」。
   运行确认**全红**（接口不存在）。
4. **实现转绿**：路由与逻辑写入 `server/index.js`（照既有 `/v1/devices` 路由的写法）；存储沿用步骤 2 定位的位置。
5. **接入回归**：`package.json` test 脚本追加 `server/test-device-crud.mjs`；`npm test` 全绿。

## 七、工作流 W3：设备 ↔ 体验角色群分配（N:M）

**目标（PRD §2.3.2 + §2.3.5 第三行）**：分配关系持久化，一台设备可属多个角色群。

1. **契约**：`docs/API-CONTRACT.md` 新增：`GET /v1/device-assignments`（device:read）、`POST /v1/device-assignments`（body: `device_id` + `role_group`，device:write）、`DELETE /v1/device-assignments/{assignment_id}`（device:write）。附一行约束说明「宿迁试点 3 台仅限真实域，分配返回 403」。
2. **TDD 红测** `server/test-device-assignment.mjs`：
   - 同一 `device_id` 分配到两个不同 `role_group` 均成功（N:M 断言）；
   - 同设备同群重复分配 → 409；
   - 分配 `ASH01086` → 403；
   - 无权限角色 → 403；
   - 列表查询返回全部分配关系。
3. **实现**：分配关系存入 `server/ltc.js` 既有 `state` 对象（新增 `state.deviceAssignments = []`，参照 `state.insurerInspections` 的读写与持久化模式）。
4. **接入** `package.json` + 全量回归。

## 八、工作流 W4：体验域标识

**目标（PRD §2.3.1 体验域行 + §2.3.5 第四行）**：演示统筹区机构名全部虚构 + 体验态常驻演示标识。

1. **更名（服务端）**：`server/ltc.js` `ORGS.insurer` 的 name 由「中国太平洋人寿保险股份有限公司 · 某某市长护险受托经办中心」改为「**惠生人寿保险股份有限公司（演示）· 某某市长护险受托经办中心**」；`server/seed.js` 中 `insurer01` 的 `staff_name`「太平洋保险经办人员」改「演示经办人员」。`insurer_suqian` 及宿迁池**保持原名**（红线 5）。
2. **前端去真实机构名**：`grep -n "太保\|太平洋" src/views/console/workspaces/*.vue`，逐处替换为 `orgName`（`useOrgIdentity`）或通用文案「经办机构」；`InsurerOperationsApp.vue` 凭证印章区「中国太平洋人寿保险…」→ `orgName` 驱动；`MedicalSupervisionApp.vue`「受托方: 中国太保」→ 动态取经办机构名；`NursingHomeAdminApp.vue`「经办机构 (太保) 复核」→「经办机构复核」。
3. **演示标识条**：新建 `src/features/ltc-workbench/components/DemoPoolBanner.vue`——固定顶部条，红底白字，文案「演示统筹区：客户与业务数据为模拟；设备遥测为真实物联数据」；在 `WorkspaceShell.vue` 挂载，`v-if` 条件为 `session?.principal?.pool_id === 'moumou'`。
4. **验证**：`grep -rn "太平洋\|太保" server/ src/`（排除 `insurer_suqian` 与 `docs/`）应无残留；`npx vue-tsc -b`、`npm run build`、`npm test` 全绿（若 `test-account-matrix` 断言了旧机构名，同步改新名）。

## 九、失败处理协议

- 任何验证命令**连续两次失败**：停止该工作流，输出「失败步骤 + 命令 + 错误原文」后等待用户，禁止继续改代码碰运气。
- 修改导致无关测试变红且 5 分钟内无法定位：`git diff` 记录现场 → `git checkout -- <文件>` 还原该步 → 汇报后跳过。
- 对需求有疑问：引用 PRD §2.3 原文提问，不自行解释。

## 十、汇报格式（每工作流结束必交）

```
工作流：W1
改动文件：server/seed.js、server/ltc.js、…（逐个列出）
验证命令与结果：npm test → 101+X pass / 0 fail；vue-tsc → 0 error；build → 成功
发现（未处理）：…
剩余阻塞：…
```

## 十一、建议技能（Skill）

执行本任务时建议调用以下技能辅助流程：

- `superpowers:executing-plans` —— 按本文档步骤逐项执行的主循环方法
- `superpowers:test-driven-development` —— W2/W3 的红绿纪律
- `superpowers:verification-before-completion` —— 每个工作流汇报前自检
- `diagnosing-bugs` —— 验证失败时的定位（替代试错）

## 十二、敏感信息

本文档不含任何口令与密钥；种子口令经 `SEED_ACCOUNT_PASSWORD` 环境变量注入，仓库内不得出现明文。
