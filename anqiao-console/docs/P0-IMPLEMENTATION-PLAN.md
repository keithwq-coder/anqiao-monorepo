# P0 护理院打样 · 任务级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Goal:** 落地《多业态租户与角色工作台总体设计》v0.4（已批准）的 P0 五项交付：租户模型扩展、两级登录、康宁护理院演示租户、护理院全栈角色工作台、销售客户资产视图较完整版。
> **Architecture:** 在既有授权链（auth.js → ltc.js authorizedWorkspacesFor → index.js 登录发放）与租户注册表（seed.js TENANT_CONFIGS/TENANT_DATA）上做**加法扩展**，不重构；前端在 ConsoleLogin/WorkspaceShell 既有结构上扩展。
> **Tech Stack:** Node 20 ESM + node:test（spawn 真实后端实测）、Vue 3 SFC、MySQL（mysql2，双模式）。

## Global Constraints（每个任务隐含遵守）

- 硬件库 `api_health_track`（37 表）与硬件 API 8000 **只读零影响**；不重启 8000/8081/7557/8888；本地 vite 进程（PID 8332/37344 等）勿杀；
- 严禁安装 PostgreSQL/Redis；argon2 不可用（scrypt 已兼容，**不再尝试安装**）；
- Zero Fake Data：真实域零捏造；演示域虚构名（康宁护理院等已批准拟名）+ 常驻「演示」标识；**演示域代码/文案禁现真实品牌**（含变量名残留 `KAIJIAN_*`，T2 改名）。**豁免**：自营真实设备点位名（PRD §2.2 唯一合法清单，如 `ANQIAO_DEVICES`/`anqiaoDevices.ts` 的「凯健国际·404」标签与地址）属真实域数据，不在清理范围——品牌名扫描仅针对演示域新增代码（见 T5 Step 3）；
- git **定点 add**（勿 `git add -A`；另一会话双大屏在途改动勿提交勿覆盖）；CRLF 警告无害；
- SDD：新路由先登记 `docs/API-CONTRACT.md`（下一个编号 **N21**，N17–N20 已实现），后实现；
- 测试体系：`npm test` = `node --test --test-concurrency=1`（15 个既有文件）；测试子进程自生成随机 `SEED_ACCOUNT_PASSWORD`，不入库；
- 每任务完成即定点 commit（`feat(multi-vertical): ...`），红测未绿不 commit。

---

### Task 1: 租户模型扩展（vertical/template/deployment）

**Files:**
- Modify: `server/seed.js`（TENANT_CONFIGS 11 条目 + 3 个 getter）
- Create: `server/test-multi-vertical.mjs`
- Modify: `package.json`（test 脚本追加新测试文件）

**Interfaces:**
- Produces: `getTenantVertical(tenantId)` / `getTenantTemplate(tenantId)` / `getTenantDeployment(tenantId)`（未知租户回退 `'nursing_home'`/`null`/`'saas'`，与既有 `getTenantKind` 同风格）；TENANT_CONFIGS 每条目新增 `vertical` / `template` / `deployment` 字段。

- [ ] **Step 1 红测**：`server/test-multi-vertical.mjs` 断言 `TENANT_IDS` 全部条目可取出三字段且康宁条目存在（此时不存在 → FAIL）
- [ ] **Step 2 实现**：TENANT_CONFIGS 补字段——`platform`/`anqiao`→`vertical:'platform'`；`bureau`/`bureau_suqian`/`bureau_moumou`/`insurer`/`insurer_suqian`/`assessor_suqian`/`assessor_org`→`vertical:'ltc_ecosystem'`；`partner_p1`→`vertical:'partner'`；`cust_org01`（示范区康养示范中心，演示客户机构）→`vertical:'nursing_home'`（**假设标注：康养中心归入护理院业态，如业主有异议改一行**）；全部 `deployment:'saas'`、`template:null`；三个 getter 仿照 `getTenantKind`（seed.js:1262）
- [ ] **Step 3 绿测**：`node --test server/test-multi-vertical.mjs` PASS；`npm test` 既有 15 文件无回归
- [ ] **Step 4 Commit**：`git add server/seed.js server/test-multi-vertical.mjs package.json docs/P0-IMPLEMENTATION-PLAN.md docs/MULTI-VERTICAL-TENANT-DESIGN.md && git commit -m "feat(multi-vertical): tenant model vertical/template/deployment fields"`

### Task 2: 康宁护理院演示租户（首个机构照护型租户）

**Files:**
- Modify: `server/seed.js`（KAIJIAN_* → NURSING_DEMO_* 改名；TENANT_CONFIGS.kangning；TENANT_DATA 注册）
- Modify: `server/test-multi-vertical.mjs`

**Interfaces:**
- Produces: 租户 `kangning`（name `康宁护理院（演示）`，kind `nursing_home`，vertical `nursing_home`，template `nursing_home_v1`，deployment `saas`，seed `20260926`，alertIdBase `81001`，nurses `12`，inBedRatio `0.85`，abnormalPlan `[]`，occupiedBeds/floorWards/floorCare = 改名后 NURSING_DEMO_* 常量）。

- [ ] **Step 1 前置阅读**：✔ 已完成——`listBeds`（seed.js:1549）消费 `cfg.vacantBeds`（空床机制现成）；`buildAlerts` 需 `cfg.alertTypes/alertStatuses/patientTotal`；`requireNursingTenant` 无 kind 门槛（occupiedBeds 即过）。结论：**config 需含 vacantBeds**
- [ ] **Step 2 红测**：断言 `getTenantData('kangning')` 非空、patients>0、`getTenantName('kangning')` 含「演示」、`cfg.occupiedBeds.length===87`
- [ ] **Step 3 实现**：改名 KAIJIAN_* 四组常量（全局仅定义处，零引用，安全）；注册 config + `TENANT_DATA.kangning = buildTenant(...)`（走 occupiedBeds 分支，seed.js:1186）
- [ ] **Step 4 绿测 + 全量回归**
- [ ] **Step 5 Commit**：`feat(multi-vertical): kangning demo nursing-home tenant (fictional, demo-marked)`

### Task 3: 后端角色扩展（六职能 + customer_view 授权修正）

**Files:**
- Modify: `server/auth.js`（WORKSPACES +6；ROLE_WORKSPACE_MAP/ROLE_DATA_SCOPE_MAP/ROLE_PERMISSIONS 各 +6）
- Modify: `server/ltc.js`（authorizedWorkspacesFor：`extras.business_user` 修正 + 全量列表 +6）
- Modify: `server/test-multi-vertical.mjs`

**Interfaces:**
- Produces: 工作台常量 `facility_doctor_studio`/`facility_hr_studio`/`facility_finance_studio`/`facility_marketing_studio`/`facility_admin_studio`/`facility_it_studio`；角色 `facility_doctor`/`facility_hr`/`facility_finance`/`facility_marketing`/`facility_admin`/`facility_it`，scope 均 `'org'`；permissions 组（§3.3 提案口径）：doctor=`patient:read,telemetry:read,alert:read,rounds:write,order:write`；hr=`staff:read,shift:read,shift:write,attendance:read`；finance=`bill:read,ltc:read,reports:read,settlement:write`；marketing=`beds:read,admission:write`；admin=`affairs:write,device:read`；it=`device:read,network:read,account:read`。

- [ ] **Step 1 红测**：断言 `workspaceOf('facility_doctor')==='facility_doctor_studio'`、`permissionsOf` 六角色非空、`authorizedWorkspacesFor('business_user',{workspace:'customer_view'})` 返回含 `customer_view`（现返回 `nursing_home_admin` → FAIL）
- [ ] **Step 2 实现**：auth.js 三表各 +6；ltc.js `extras` 增 `business_user:['customer_view']` 并保留既有键；`all` 数组 +6（ltc.js:5569）
- [ ] **Step 3 绿测 + 全量回归**
- [ ] **Step 4 Commit**：`feat(multi-vertical): six facility roles + customer_view authorization fix`

### Task 4: 康宁演示席位账号（全栈 17 席）

**Files:**
- Modify: `server/seed.js`（ACCOUNTS 追加康宁段）
- Modify: `server/test-multi-vertical.mjs`

**Interfaces:**
- Produces: 17 个演示席位（口令走 `SEED_ACCOUNT_PASSWORD` 统一机制）：`kangning_station`(nursing_station/care_desk)、`kangning_head`(nursing_head/care_desk)、`kangning_nurse`(nursing_nurse/nursing_staff)、`kangning_caregiver`(nursing_caregiver/nursing_staff)、`kangning_admin`(nursing_admin/nursing_home_admin)、`kangning_dossier`(patient_dossier)、`kangning_ops`(device_monitoring)、`kangning_reports`(reports_center)、`kangning_rehab`(rehab_therapist)、`kangning_dementia`(dementia_specialist)、`kangning_doctor`(facility_doctor)、`kangning_hr`(facility_hr)、`kangning_finance`(facility_finance)、`kangning_marketing`(facility_marketing)、`kangning_affairs`(facility_admin)、`kangning_it`(facility_it)，tenant_id/org_id=`kangning`，staff_name 虚构（康宁·某姓，不带真实人名）。

- [ ] **Step 1 红测**：spawn 后端登录 `kangning_admin`，断言 principal.org_id/workspace；断言 ACCOUNTS 中 kangning 前缀恰 16 条（含 dossier/ops/reports/dementia）
- [ ] **Step 2 实现**：仿既有演示席位字段结构（assigned_title 带「演示席位」字样）
- [ ] **Step 3 绿测 + 全量回归**
- [ ] **Step 4 Commit**：`feat(multi-vertical): kangning demo seats for full nursing-home role stack`

### Task 5: 登录页「业态 → 角色」两级重构

**Files:**
- Modify: `src/views/console/ConsoleLogin.vue`（DEM O_CATEGORIES → 两级结构 LEVEL1_GROUPS）

**Interfaces:**
- Produces: Level-1 七入口组：护理院 / 养老社区 / 居家养老 / 大健康（占位「业态定义中」，点击不展开）/ 长护险生态（下分 宿迁试点·真实 / 演示统筹区·模拟）/ 中科安樵自营（内部）/ 家属与设备用户；Level-2 角色卡按组渲染 42 存量席位 + 康宁 16 席（体验演示卡保留快捷口令 2026 + 演示徽标；**真实席位卡一律不内嵌口令**，提示改「口令由管理员分配」——消除现卡内 `pw:'123'` 与统一口令 2026 的陈旧矛盾）。

- [ ] **Step 1 实现**：组结构 + 两级交互（Level1 选中 → Level2 角色卡栅格）；大健康占位卡置灰
- [ ] **Step 2 手动验收清单**：七组渲染、两级切换、演示徽标常驻、真实卡无内嵌口令、全部 42+16 席位可达、大健康占位不可进
- [ ] **Step 3 全局扫描**：演示域新增代码（ConsoleLogin.vue、康宁相关文件、登录文案）`凯健|居家乐` 零命中；**自营真实点位标签（anqiaoDevices.ts / seed.js ANQIAO_DEVICES）豁免**（PRD §2.2 真实域）
- [ ] **Step 4 Commit**：`feat(multi-vertical): two-level vertical->role login`

### Task 6: 六职能工作台组件（骨架 + 6 配置）

**Files:**
- Create: `src/views/console/workspaces/FacilityStudioShell.vue`（左 SOP 树 + 右工作间骨架，props: role-config）
- Create: `src/features/facility/facility-workbench-configs.ts`（6 份岗位配置：SOP 节点 + 面板挂载清单，面板优先复用既有 feature 组件）
- Modify: `src/views/console/WorkspaceShell.vue`（组件 map +6（815-836 区）、workspace meta +6）

- [ ] **Step 1 骨架 + 配置结构**（SOP 节点按 §3.3 各角色"看什么/办什么"）
- [ ] **Step 2 六席位逐个手动验收**：登录渲染、无权限工作台不可达、`npm run build` 通过
- [ ] **Step 3 Commit**：`feat(multi-vertical): facility studio shell + six role workbenches`

### Task 7: API-CONTRACT 契约登记（SDD 先行于 Task 8）

**Files:**
- Modify: `docs/API-CONTRACT.md`（新增 N21–N27）

**Interfaces:**
- N21 `GET /v1/sales/institutions`（`sales`+`su`/`platform_admin`；直读 `anqiao_crm.institutions` + `institution_owner_history` 归属过滤；越权 404）
- N22 `GET /v1/sales/institutions/{id}/devices`（`device_registry` 按 customer_org）
- N23 `GET /v1/sales/institutions/{id}/vitals-summary`（**脱敏**：趋势/异常标记，姓名仅姓+称谓，无诊断）
- N24 `GET /v1/sales/institutions/{id}/alerts`（告警历史，只读）
- N25 `GET /v1/sales/institutions/{id}/telemetry`（硬件代理只读转发）
- N26 `GET /v1/tenants`（`su`/`platform_admin`；含 vertical/template/deployment）
- N27 `POST /v1/admin/tenants`（守卫 `username==='吴'`；选业态模板开租户）

- [ ] **Step 1 登记**（含权限矩阵、403/404 语义、脱敏字段说明）→ **Step 2 Commit**：`docs(contract): N21-N27 sales asset view & tenant admin`

### Task 8: 销售客户资产视图（后端路由 + CustomerViewApp）

**Files:**
- Modify: `server/index.js`（N21–N25 路由；CRM 跨库只读：mysqlPool 上 `anqiao_crm.institutions` 限定名查询——**先验证 mysql.env 用户对 anqiao_crm 库有 SELECT 权，无则部署时 GRANT（只加 SELECT）**）
- Create: `src/views/console/workspaces/CustomerViewApp.vue`（机构列表/设备在线/脱敏体征/告警历史/遥测曲线 五面板）
- Modify: `src/views/console/WorkspaceShell.vue`（map + `customer_view: CustomerViewApp`）
- Create: `server/test-sales-view.mjs`（本地无 CRM 数据：断言结构/空数组/403/404/归属过滤逻辑）

- [ ] **Step 1 契约核对 → Step 2 后端路由（含越权 404/403）→ Step 3 前端组件与映射 → Step 4 测试红绿 → Step 5 Commit**：`feat(multi-vertical): sales customer asset view (CRM read-only)`

### Task 9: P0 验收

- [ ] `npm test` 全绿（15 既有 + test-multi-vertical + test-sales-view）
- [ ] `npm run build` 通过
- [ ] 人工全链路：两级登录 → 康宁 16 席位逐个进入对应工作台 → 演示标识常驻 → 销售视图五面板
- [ ] 红线审计：硬件域零写入、`凯健|居家乐` 零命中、无 PG/Redis、git 历史无 `add -A`
- [ ] 部署**不在本计划内**：部署前必读 `.agents/skills/huaweicloud-deploy/SKILL.md`，另起部署窗口
