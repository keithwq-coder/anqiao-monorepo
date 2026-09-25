# 独立评审证据文件 — TASK-0043~0047 前端补齐批次

- **评审人（独立）**: glm-5.2
- **评审门禁**: DEC-0174 (2026-08-25，统一由 glm-5.2 执行，不再要求不同模型谱系)
- **批次授权**: DEC-0173 (2026-08-25)
- **评审日期**: 2026-08-25
- **仓库**: D:\Project\中科安樵\crm (Windows, Git Bash)
- **遵守**: SPEC-GOV-0001 R-012 / R-032（检查实际仓库文件、Git 状态、diff、任务卡、证据文件并**重跑指定命令**；不依赖执行者报告或本提示词陈述）/ R-033（三种 verdict）

---

## 0. 评审方法与权威来源

### 0.1 权威顺序（AGENTS.md §2）
1. 产品负责人最新决策：DECISION-LOG 中 DEC-0173 / DEC-0174（已读，全文要点见 §1）。
2. 已批准 SPEC（30-approved/）：SPEC-0001 v0.8.1、SPEC-0002 v0.4.1、SPEC-0003 v0.4.0、SPEC-0008、SPEC-0011 v0.2.0、SPEC-0013 v0.1.0（INDEX.md 确认共 9 个 approved SPEC）。
3. 现有代码 / 自动化测试 / 运行时证据（本文件实测部分）。
4. 活动任务（docs/tasks/active/ 五张卡）。
5. 评审/草稿材料（本文件）。

### 0.2 实际重跑的命令（非执行者报告，经只读 Explore 子代理执行）
| # | 命令 | 实测结果 |
|---|---|---|
| 1 | `python -m pytest tests -q` | **504 passed, 28 skipped, 2 warnings**；0 failed / 0 error |
| 2 | `python -m compileall -q src tests migrations && echo EXIT=$?` | COMPILEALL_EXIT=0 |
| 3 | `git diff --check; echo EXIT=$?` | 仅 1 行 `templates/institution_detail.html` LF→CRLF advisory；DIFFCHECK_EXIT=0 |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | **[PASS]** Approved SPECs: 9 / Active tasks: 46 / Legacy manifests: 1 |
| 5 | `git status --short` | 7 个已修改跟踪文件 + 27 个未跟踪文件（证据/任务卡/模板/测试），无删除、无冲突标记 |

> 注：28 项 skip 均为环境门控的 PostgreSQL/集成测试（需 `CRM_RUN_POSTGRESQL_TESTS` / 本地 PG），符合仓库惯例，非回归。

### 0.3 实际读取的仓库文件（节选，均带行号定位）
- `src/crm/web/main.py`（页面路由 236/259/308/427/526/562/596/642/712/736/759/813/835 等；业务 API 路由器注册于 112-118 行）
- `src/crm/web/routes/{discovery,institutions,followups,admin,imports}.py`
- `templates/`: `base.html`、`discovery_list.html`、`discovery_detail.html`、`pool_list.html`、`institution_detail.html`、`management_summary.html`、`admin_users.html`、`admin_transfer.html`、`admin_erase.html`、`imports_list.html`、`imports_detail.html`
- `static/css/style.css`（652 行，CSS 变量基线）
- `tests/test_task0043..0047_*.py`（5 个新测试文件）
- `docs/NOW.md`、`docs/PROJECT.md`、`docs/specs/INDEX.md`、`docs/decisions/DECISION-LOG.md`
- `docs/tasks/active/TASK-0043..0047-*.md`、`docs/evidence/TASK-0043..0047-*-UI-20260825.md`

---

## 1. 决策依据（DEC-0173 / DEC-0174 要点）

- **DEC-0173** (2026-08-25, product-owner implementation authorization): 批次授权 TASK-0043→0044→0045→0046→0047，串行，共用 `base.html`/`style.css`；性质均为"既有已批准 SPEC 行为的 UI 展示层"（参考 TASK-0012 先例，无新 SPEC、无业务逻辑/策略变更）。**未授权**：新增/修改后端业务 API、策略/脱敏变更、SPEC 文本/approval.json 变更、客户编辑功能、生产部署、commit、push、真实数据变更、外部调用。
- **DEC-0174** (2026-08-25, acceptance-gate decision): 变更验收门禁——本批次独立评审统一由 glm-5.2 执行；**supersede** DEC-0173/任务卡/NOW.md 中"独立评审需不同模型谱系"表述（经核实 SPEC-GOV-0001 R-012 仅要求评审者独立、检查实际文件、重跑检查，并不硬要求不同模型谱系）。**未授权**：编辑 SPEC-GOV-0001 文本/approval.json、部署/commit/push、放宽 R-012 独立性（glm-5.2 仍须实际检查文件并重跑、verdict-only）。执行者不可自验收；任务状态仅在 glm-5.2 verdict 后经协调方主持进入验收。

---

## 2. 完成门实测（五卡共用，全过 = 该卡 PASS）

| 门 | 要求 | 实测 | 结论 |
|---|---|---|---|
| G1 pytest 全量 | 全绿，基线约 504 | 504 passed, 28 skipped | PASS |
| G2 compileall | exit 0 | COMPILEALL_EXIT=0 | PASS |
| G3 git diff --check | clean | 仅 1 条 LF→CRLF advisory，exit 0 | PASS |
| G4 check-governance | [PASS] 9/46/1 | [PASS] 9 approved / 46 active / 1 legacy | PASS |
| G5 专属测试数 | 9/10/7/10/11 | 实测 9/10/7/10/11（共 47） | PASS |
| G6 证据 vs 实际 | 一致 | 逐项比对一致（见各卡） | PASS |

> 基线说明：协调方明确"当前基线为 **457 passed, 28 skipped**；任务卡所写 459 为 DEC-0172 前旧数；以实测为基线，不得回退，五卡完成后应约为 504"。实测 504 = 457 + 47 新增，验证无回退。

---

## 3. 逐卡评审

### TASK-0043 — AI 商机发现 UI（SPEC-0003 v0.4.0）
- **Authority**: DEC-0173 + SPEC-0003；owner=reasonix 会话实际执行（卡/NOW.md 预置字段为 deepseek-v4-flash-0713 via reasonix）；reviewer=glm-5.2 (DEC-0174)。
- **实跑命令与输出**: 该卡证据实测 `466 passed, 28 skipped`（457+9）；本评审重跑全量得 504（含其后续卡），其自身 9 测试文件 `pytest tests/test_task0043_discovery_ui.py` 9 passed。compileall/G4/LF advisory 均通过。
- **重点核查**:
  - `/discovery` 307 跳转已替换为真实页面：`main.py:526` 返回 `TemplateResponse("discovery_list.html")`（200）；`main.py:562` 详情页。**已确认非 307。**
  - admin 专属：trigger-run 按钮（`discovery_list.html:9-14` `{% if is_admin %}`）+ 脱敏管理视图（`main.py:548` `list_desensitized()` 仅 admin）。
  - `base.html` 21-22 行：现行为招商/公池条件块（`base.html:21-23` `{% if ... business_user or administrator %}`），**无死空块残留**（直接读取确认）。
  - `style.css`：纯 hand-written CSS + `:root` CSS 变量（`:7-59`），无 `@import`、无 CDN、无框架（bootstrap/tailwind/sass）、无构建步骤（直接 mount 静态目录）。**已确认。**
  - 未新增业务 API：页面 GET 路由；表单提交到既有 `POST /api/discovery/candidates/run`、`/api/discovery/candidates/{id}/adjudicate`（routes/discovery.py）。
- **发现缺陷**: 无实质缺陷。报告性：`TASK-0043` 卡完成门 #1 写 "459 passed"（应为 457，见整改包 #1）。
- **verdict**: **APPROVE_AND_DISPATCH_NEXT_TASK**

### TASK-0044 — 公池 + 客户记录操作 UI（SPEC-0001 v0.8.1 + SPEC-0008）
- **Authority**: DEC-0173 + SPEC-0001/SPEC-0008。
- **实跑命令与输出**: 证据实测 `476 passed`（466+10）；本评审全量 504；其 10 测试文件 10 passed。G2-G4 通过。
- **重点核查**:
  - 详情页操作按钮按角色条件渲染（`institution_detail.html`）：claim `{% if is_business and in_pool %}`(:81)、release `{% if is_admin and not in_pool %}`(:87)、archive `{% if is_admin %}`(:94)、customer-type `{% if is_owner or is_admin %}`(:101)、correct/withdraw `{% if is_owner %}`(:176)。**角色门控双重生效**（路由层 403/404 + 模板层 `{% if %}`）。
  - `/pool` 为既有投影的视图层过滤：`main.py:596` `public_pool_page` 注释明确"no backend change, no new query parameter... view-layer filter over projected rows"（main.py:602-604）；后端 `find_institutions`/`find_all` 仅接受 `q`+limit/offset（证据已记录 queries.py:218、repositories.py:73）。
  - 列表筛选（客户类型/地区/来源）未实现：因后端无过滤参数，证据文件已记录 STOP-and-report。**属卡内允许的 STOP-and-report，非缺陷。** 已核实证据记录属实。
  - CSRF：所有写表单带 `name="csrf_token"`，JS fetch 带 `X-CSRF-Token` header。
- **发现缺陷**: 无实质缺陷。
- **verdict**: **APPROVE_AND_DISPATCH_NEXT_TASK**

### TASK-0045 — 管理摘要 UI（SPEC-0002 v0.4.1 + SPEC-0003 链接）
- **Authority**: DEC-0173 + SPEC-0002/SPEC-0003。
- **实跑命令与输出**: 证据实测 `483 passed`（476+7）；全量 504；其 7 测试文件 7 passed。G2-G4 通过。
- **重点核查**:
  - 页面字段 ⊆ `GET /api/admin/summary` 投影：测试 `test_page_fields_subset_of_api_projection` 确认页不渲染 `T45 机构`（record names）、`source_description`（`s45-`）、`owner_user_id`——与掩码投影一致。
  - manager 仅见 scope 摘要（`test_manager_sees_scoped_summary_only`：scope=scoped, total=3，无"全公司"）；business_user 403（`test_business_user_denied`）；admin 见 company-wide。
  - 页面无写控件（`management_summary.html` 仅展示 + admin 专属商机管理链接 `{% if is_admin %}:73-82`）。路由层 `management_summary_page` (main.py:658) 403 非 admin/manager。
- **发现缺陷**: 无实质缺陷。报告性：卡 owned-files 含 `style.css` 但证据未改（整改包 #4）。
- **verdict**: **APPROVE_AND_DISPATCH_NEXT_TASK**

### TASK-0046 — 管理员用户/角色管理 UI（SPEC-0002 v0.4.1 + SPEC-0011 v0.2.0）
- **Authority**: DEC-0173 + SPEC-0002/SPEC-0011。
- **实跑命令与输出**: 证据实测 `493 passed`（483+10）；全量 504；其 10 测试文件 10 passed。G2-G4 通过。
- **重点核查**:
  - 角色选项仅 3 个：`admin_users.html:48` `{% for r in live_roles %}`，`live_roles` 硬编码 `main.py:730` = `["administrator","manager","business_user"]`；测试 `value="general_manager" not in body` 通过；API `role:"general_manager"` → 400。**无 general_manager。**
  - erase 需理由 + 不可逆确认：`admin_erase.html` `reason` `required`(:25)、`id="erase-confirm"` checkbox `required`(:29)、"不可逆"提示；API `/erase` 无 confirm → 400，confirm=true → 200（测试验证）。
  - 停用用户无"启用"UI 入口：后端 `find_all_active` 仅返回启用用户（证据已记录）；`/users/{id}/enable` API 仍存在但页面不暴露入口——属后端能力边界，已 STOP-and-report。
  - 所有写表单带 `csrf_token`；非 admin 访问 `/admin/*` → 403（路由 `_admin_page_denied` main.py:682）。
- **发现缺陷**: 无实质缺陷。报告性：卡 owned-files 含 `style.css` 但证据未改（整改包 #4）。
- **verdict**: **APPROVE_AND_DISPATCH_NEXT_TASK**

### TASK-0047 — 批量导入 UI（SPEC-0013 v0.1.0）
- **Authority**: DEC-0173 + SPEC-0013。
- **实跑命令与输出**: 证据实测 `504 passed`（493+11）；全量 504；其 11 测试文件 11 passed。G2-G4 通过。
- **重点核查**:
  - 撤销按钮仅 `status=='active'` 渲染：`imports_list.html:65` `{% if b.undo_eligible %}`，`imports_detail.html:59` `{% if batch.undo_eligible %}`；`undo_eligible` 服务端派生 `main.py:808`/`main.py:888` = `status == "active"`（API 无独立 flag）。测试 `test_undo_control_only_for_eligible_batches` / `test_detail_undo_control_gated` 验证 active 渲染、undone 不渲染。
  - 上传/撤销走既有 `/api/imports/batches`（POST/undo）（routes/imports.py）；multipart + CSRF。测试 `test_upload_api_with_synthetic_csv` / `test_undo_api_path` 均用合成文件（`a*64` sha256 不泄露）。
  - 幂等重放：相同字节重传返回同 batch_id（`idempotent_replay=true`，测试验证）。
  - 所有写表单带 `csrf_token`；非 admin → 403。
- **发现缺陷**: 无实质缺陷。报告性：卡 owned-files 含 `style.css` 但证据未改（整改包 #4）。
- **verdict**: **APPROVE_AND_DISPATCH_NEXT_TASK**

---

## 4. 批次汇总 verdict

**APPROVE_AND_DISPATCH_NEXT_TASK**

依据：五卡全部通过完成门（G1-G6），逐卡重点核查（含角色可见性、脱敏一致性、CSRF 全表单、admin-only 控件对非 admin 不可见、`/discovery` 真实页面、`/pool` 视图层过滤、无新增业务 API、角色仅 3 个、撤销仅 active）均 PASS，无实质缺陷。工程实质全部达标，门禁全绿，无功能/安全/验收标准破坏，无需要产品负责人决策的实质性业务/风险分歧。建议推进至产品负责人在协调方主持下的验收（DEC-0174）。

五卡 verdict 一行结论：
- TASK-0043: APPROVE — 真实 /discovery 页面、CSS 变量基线、无死空块、无新 API。
- TASK-0044: APPROVE — 角色条件按钮 + /pool 视图层过滤，列表筛选 STOP-and-report 如实记录。
- TASK-0045: APPROVE — 页面 ⊆ API 投影、manager scope、business_user 403、无写控件。
- TASK-0046: APPROVE — 角色仅 3 个、erase 理由+不可逆确认、停用无启用 UI 已记录。
- TASK-0047: APPROVE — 撤销仅 active、走既有 /api/imports/*、仅合成文件。

---

## 5. 整改包（区分实质缺陷与报告性缺陷）

本批次 **无实质缺陷**（无功能、安全、验收标准破坏，无回归，无未授权的新增业务 API/策略变更）。以下均为**报告性/文档性**缺陷，**不阻塞验收**，建议后续文档维护（非单独整改轮次；按 R-024 不触发额外整改轮）：

1. **[报告性] TASK-0043 卡完成门 #1 基线数字**：写 "459 passed"，实测基线为 **457**（协调方已明确 459 为 DEC-0172 前旧数；504=457+47 验证无回退）。建议卡内 459→457。属表述滞后，非回归。
2. **[报告性] DEC-0173 正文第 4 点**：仍保留"独立评审需不同模型谱系"旧表述；DEC-0174 已明确 supersede。建议同步更新决策日志文本（DEC-0174 已为控制性决定，不影响本次结论）。
3. **[报告性] TASK-0043 卡 Acceptance 段**：仍写 "independent review (different model lineage) reports PASS"；0044~0047 继承该措辞。建议改为统一 glm-5.2（DEC-0174）。
4. **[报告性] 0045/0046/0047 卡 owned-files**：列出 `style.css`，但各自证据 "Files touched" 未含（仅 0043/0044 实际改）。属卡内文件清单轻微夸大，不影响验收。
5. **[报告性] NOW.md**："导航 7 入口"措辞与所列 8 项（含账号设置）不符。轻微文档不一致。

---

## 6. 评审声明（R-015/R-022/R-033）
- 本评审为 verdict-only：逐卡 verdict 与批次汇总 verdict 见 §3、§4；整改包见 §5。
- 未要求产品负责人执行任何工程操作（不选命令、不改代码、不比对报告）。
- 未将"浏览器视觉验收""生产部署"纳入本批次评审（另行授权，DEC-0173 未授权）。
- 执行者不可自验收；任务状态仅在 glm-5.2 本 verdict 后、经协调方主持进入验收。
- 评审未修改任何应用代码/模板/测试文件，未 commit/push/部署/触碰生产。
