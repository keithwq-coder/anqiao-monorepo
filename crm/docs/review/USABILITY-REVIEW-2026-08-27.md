# 中科安樵 CRM 可用性审查报告（v2 修订：销售视角）

- 审查角色：用户体验馆（站在真实用户角度）
- 审查日期：2026-08-27（v2 修订同日，纠正审查视角）
- 审查方式：静态代码/模板审查 + 生产环境实测（只读走查）
- 生产地址：https://crm.aibrain.wiki（在线可达）
- 证据等级：[VERIFIED] 已观察 / [INFERENCE] 由已核实事实推断 / [PROPOSAL] 建议方案

## 0. 核心结论（v2 纠正）

v1 报告用「老板（admin）视角」审查统计卡片、管理页、报表等边缘界面，方向错误。
本系统的真实核心用户是**销售（business_user，7 人）**，老板/股东是少数。销售的核心
工作流是「登录 → 看/搜/登记自己的客户 → 跟进」，而这条主链路存在致命可用性断裂：

> **销售登录后，客户列表默认是全公司 132 条脱敏混排，自己的客户被淹没；且销售没有
> 任何筛选栏，搜索只匹配客户名称。**

产品负责人已拍板（2026-08-27）：**销售完全隔离，只看「我的客户（owner=本人）+ 公池」，
看不到其他业务人员的客户（连脱敏都不看）。**

## 1. 销售视角实测证据

- [VERIFIED] `张楠/123` 登录 → HTTP 200，`role=business_user`。
- [VERIFIED] `GET /api/institutions?limit=30` → `total=132`；返回前 6 条客户
  `owner_user_id` 全部为 `9a4bcd51…`（吴骐/CEO），**没有一条是张楠自己的**；且这些
  他人客户 `source_category=None`（脱敏投影下的空值）。
- [VERIFIED] 销售无筛选栏：`institutions_list.html:23` 的 owner/custodian/type/region
  筛选栏仅 `administrator`/`shareholder` 可见；搜索仅 `q in name`（`main.py:337-339`）。

结论：销售「进去登记自己的客户，结果发现别人的客户，且不方便搜索」完全属实。

## 2. 问题清单（按销售工作流重排）

### P0 — 销售核心工作流断裂

**P0-1 客户列表 = 全公司脱敏混排（核心）** — [VERIFIED]
- 现象：business_user 的列表展示所有「project_record 不拒绝」的机构（`main.py:324-334`，
  而 `resolve_read_access` 对非 owner 返回 COLLABORATOR 而非拒绝），销售看到 132 条全公司
  客户，自己的客户被淹没；点进别人的客户是一堆 `***` 与空值。
- 方案 [PROPOSAL，产品负责人已拍板]：销售完全隔离——列表默认仅 `owner_user_id=本人`
  的客户 + 公池（`in_pool=true`）；不展示其他业务人员的客户。

**P0-2 搜索能力弱** — [VERIFIED] `institutions_list.html:16` + `main.py:337-339`
- 现象：销售只有一个搜索框，且仅按客户名称子串匹配；不能按地区/类别/来源/联系人搜索，
  也没有「只看我的」入口（隔离后列表本身即「我的」，但仍需支持地区/类别搜索）。
- 方案 [PROPOSAL]：搜索扩展匹配 region/category/source_kind（遵守 SPEC-0008 R-003 字段级
  脱敏）；隔离后搜索在「我的客户 + 公池」范围内进行。

**P0-3 仪表盘统计对销售无意义且错误** — [VERIFIED] `dashboard.html:66-82`
- 现象：「客户总数」与「我的客户」都显示同一个 `total`（=132，全公司可见数），「本月跟进」
  实为「最近 5 条里有跟进日期的条数」。
- 方案 [PROPOSAL]：隔离后，销售仪表盘显示「我的客户数、本月跟进（本人权限内）」等真实
  个人数据；不再显示全公司总数。

### P1 — 销售流程受阻

- **P1-1 下一步负责人手填用户 UUID** — [VERIFIED] `followup_create.html:62-64`：输入框提示
  「可指定负责人 UUID」，销售无法知道 UUID。方案：改为用户下拉选择。
- **P1-2 联系渠道状态英文枚举** — [VERIFIED] `contact_create.html:38-40`：下拉选项
  「available（已有可留存渠道）…」英文枚举混排。方案：文案改纯中文。
- **P1-3 登录失败提示累积** — [VERIFIED] `login.html:107-112`：每次失败 insertBefore 新
  error div 不清旧，多次失败堆叠。方案：复用同一错误容器先清后插。

### P2 — 老板/管理视角（次要，非销售主链路）

- **P2-1 股东（shareholder）无分配客户入口** — [VERIFIED]：SPEC-0002 R-035 授予 shareholder
  分配能力，但 `/admin/transfer` 仅 administrator 可进；shareholder 打开非本人客户详情时
  「客户操作」不显示。方案：为 shareholder 开放分配入口。
- **P2-2 系统管理无法授予 shareholder 角色** — [VERIFIED] `admin_users.html:48`：
  live_roles 硬编码仅 3 种。方案：增加 shareholder。
- **P2-3 报表销售业绩英文列名 + 金额列恒空** — [VERIFIED] `reporting.html:121`：
  表头 hardcode 英文键名；amount_total 因客户金额字段未实现（OD-010）恒空。
- **P2-4 客户列表翻页丢失筛选** — [VERIFIED] `institutions_list.html:91-102`：分页仅带 q。
- **P2-5 术语不一致** — [VERIFIED] `main.py:374/407`：页面 title「机构列表/新建机构」vs 导航「客户」。
- **P2-6 归档/释放进公池无二次确认** — [VERIFIED] `institution_detail.html:90-103`。
- **P2-7 地区筛选为自由文本 / 导航无响应式** — [VERIFIED] `institutions_list.html:44`、`base.html:13-46`。

## 3. SPEC 影响（重要，需走流程）

「销售完全隔离」**修改了 SPEC-0001 既有脱敏可见性设计的语义**：

- `SPEC-0001 R-014`（其他已授权业务人员只能查看脱敏后的客户/联系人信息和精简进度）——
  被「业务人员仅可见自己名下 + 公池」取代，需修订。
- `SPEC-0001 R-042`（池中客户对全体业务角色脱敏可见）——保留（公池仍是销售可见范围）。
- 涉及 `resolve_read_access`（`src/crm/policy/projection.py:173-184`）中 business_user 对
  非 owner 记录返回 COLLABORATOR 的逻辑，需改为拒绝（PolicyDenied），仅 owner 与公池通过。

[PROPOSAL] 该决策需：① 记入 `docs/decisions/DECISION-LOG.md`；② 修订 SPEC-0001（新增隔离
规则，含 R-014 语义变更）；③ 按 SDD 流程（draft → review → approved → task）授权实现。
本报告不直接改 SPEC/代码。

## 4. 未验证项（NOT VERIFIED）

- 浏览器截图/视觉走查未做；仅 administrator + 一名 business_user（张楠）实测。
- 移动端/窄屏响应式未实测；商机触发、报表导出、批量导入等写操作未在生产执行（只读）。

## 5. 建议处理顺序

1. P0-1 销售隔离（核心，已拍板）——需先走 SPEC-0001 修订 + 决策记录。
2. P0-2 搜索增强 + P0-3 销售仪表盘真实统计。
3. P1 销售流程（UUID 下拉、中文枚举、登录提示）。
4. P2 管理视角项。
