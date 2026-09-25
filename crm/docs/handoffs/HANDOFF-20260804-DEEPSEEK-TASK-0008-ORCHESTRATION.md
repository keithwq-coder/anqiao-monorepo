# HANDOFF-20260804-DEEPSEEK-TASK-0008-ORCHESTRATION

- Task: TASK-0008 (core record / contact / follow-up workflow repair)
- From tool/model: coordinator / architect (opencode, grok-4.5)
- To tool/model: DeepSeek (product-owner-stated executor; reputation is not evidence)
- Handoff status: **CLOSED** — Steps 1–6 all ACCEPTED by coordinator 2026-08-04;
  no further DeepSeek step
- Repository state: working tree; do not assume clean git history
- Written at: 2026-08-04
- Authority: DEC-0080 (scope); DEC-0081 (implementation); coordinator S1 accept
- Role split (product owner, 2026-08-04): **coordinator = audit + orchestration**;
  **DeepSeek = implementation code only**. DeepSeek never receives review-only,
  freeze-check, or acceptance prompts.

## Required reading (every DeepSeek implementation step)

1. `AGENTS.md` (full)
2. `docs/NOW.md`
3. `docs/decisions/DECISION-LOG.md` — DEC-0080, implementation DEC, DEC-0073 point 4
4. `docs/tasks/proposed/TASK-0008-core-record-workflow-repair.md` (or active path)
5. `docs/evidence/TASK-0008-GAP-ANALYSIS.md`
6. `docs/evidence/TASK-0008-S0-FREEZE-CHECK.md` (coordinator baseline)
7. `docs/specs/30-approved/SPEC-0001-core-record-activity.md` (+ approval json)
8. `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` (R-003/R-006/R-013 only)

## Orchestration map

| Step | Who | Unlock condition | May edit | Output |
|---|---|---|---|---|
| S0 freeze check | **coordinator only** | DEC-0080 | evidence only | `TASK-0008-S0-FREEZE-CHECK.md` — **DONE 2026-08-04** |
| S1 contracts + dead code | DeepSeek | DEC-0081 | commands/queries + tests + evidence | **ACCEPTED** 2026-08-04 |
| S2 correction/withdrawal/archive | DeepSeek | S1 accepted | repositories, audit_repository, commands, necessary routes, tests, evidence | **ACCEPTED** 2026-08-04 |
| S3 duplicate prompt | DeepSeek | S2 accepted | create paths + tests | **ACCEPTED** 2026-08-04 |
| S4 admin-exception read+audit | DeepSeek | S3 accepted | routes, audit, queries, tests | **ACCEPTED** 2026-08-04 |
| S5 R-029 category + forms + AC-012/R-028 | DeepSeek | S4 accepted | domain/web/templates/tests | **ACCEPTED** 2026-08-04 |
| S6 P2 ENABLED + full regression | DeepSeek | S5 accepted | five status sites + evidence | **ACCEPTED** 2026-08-04 |
| Accept each step | **coordinator only** | step completion report | none (or evidence correction) | unlock next prompt |

Coordinator accepts each step before unlocking the next. DeepSeek never self-unlocks
and never runs audit/freeze/acceptance rounds.

## Hard boundaries (all steps)

- No `crm_test` / SSH / server / deploy / nginx / TLS / DNS / real data unless a
  **separate** DEC names that round.
- No owner transfer / batch transfer.
- No policy bypass; every read goes through `project_record`.
- No hard delete.
- Evidence never claims more than the command that was run (DEC-0073 point 4).
- Standing product rule: do not ask the product owner engineering questions;
  escalate only true business-scenario blockers to the coordinator.

## Locked engineering defaults (DEC-0080)

- R-029 categories: `电话` | `微信` | `面谈` | `邮件` | `其他`
- R-035: exact normalized institution name; contact = same institution + same
  non-empty channel; confirm-to-continue; no auto-merge; no fuzzy match
- P2: repair (pass real `user_status`)
- Tests: dedicated AC-012 and R-028 positives required

---

## S0 — coordinator only (DONE 2026-08-04)

**Do not paste S0 to DeepSeek.** Evidence:
`docs/evidence/TASK-0008-S0-FREEZE-CHECK.md`
Result: freeze assertions still hold; `106 passed, 1 skipped`; governance PASS.

---

## PROMPT S1 — UNLOCKED (DEC-0081) — paste to DeepSeek now

```text
你是 DeepSeek，本轮唯一实现执行者。协调器负责审计与编排；你只写代码与实现证据。
执行 TASK-0008 Step 1 only。做完即停，不要自启 Step 2，不要做审查/冻结检查。

## 授权（对不上则整轮停止，零改动）
- 打开 docs/decisions/DECISION-LOG.md，确认 DEC-0081：授权 TASK-0008 实现。
- 任务卡必须在 docs/tasks/active/TASK-0008-core-record-workflow-repair.md 且 ACTIVE。
- DEC-0080 只确认范围；实现授权是 DEC-0081。

## 本步唯一目标（实现）
1. 契约对齐并落地死代码处理：
   - 修复或删除三个 from_dict（commands.py）；不得保留恒 TypeError 的死方法
   - 清理 queries.py 空 contact 投影循环（若仍在）
2. 写出 revision+audit 同事务的可执行设计，落到
   docs/evidence/TASK-0008-S1-CONTRACT-MAP.md（必须点名将如何调用
   transaction_session 或等价包装；本步可只设计不接 R-031 业务）
3. 为本步改动补/改单测

## 允许修改的路径（越界即失败）
- src/crm/application/commands.py
- src/crm/application/queries.py
- 对应 tests/
- docs/evidence/TASK-0008-S1-*.md
- docs/tasks/active/TASK-0008-core-record-workflow-repair.md 的进度字段 only

## 禁止
- R-031/R-035/R-015/R-029 业务实现、路由、模板、迁移
- crm_test / SSH / 服务器 / 部署 / 真实数据
- 负责人转交
- 审查类工作、改 GAP 范围、解锁后续步骤、向产品负责人提工程选择题

## 必读
AGENTS.md
docs/decisions/DECISION-LOG.md（DEC-0081、DEC-0080、DEC-0073 point 4）
docs/tasks/active/TASK-0008-core-record-workflow-repair.md
docs/evidence/TASK-0008-GAP-ANALYSIS.md
docs/evidence/TASK-0008-S0-FREEZE-CHECK.md
docs/handoffs/HANDOFF-20260804-DEEPSEEK-TASK-0008-ORCHESTRATION.md
docs/specs/30-approved/SPEC-0001-core-record-activity.md（R-007/R-031 相关）
docs/specs/30-approved/SPEC-0002-users-roles-ownership.md（R-003/R-006/R-013）

## 工程默认（不得改）
GAP-ANALYSIS §8 / DEC-0080（R-029 词表、R-035 精确匹配、P2 修复、AC-012/R-028 专用测）

## 验证（你必须实测）
- 相关单测 + 本地 ungated 基线不回退（不要 CRM_RUN_POSTGRESQL_TESTS=1）
- powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 → PASS

## 完成报告（贴回协调器；不要写“请产品负责人…”）
1. Status: passed | partial | blocked
2. Scope: 改动文件列表
3. Evidence: 命令与 passed/failed 计数
4. Not verified
5. Decisions needed: none（有业务阻塞才写，否则 none）
```

---

## PROMPT S2 — UNLOCKED (S1 accepted) — paste to DeepSeek now

```text
你是 DeepSeek，本轮唯一实现执行者。协调器审计/编排；你只写代码与实现证据。
执行 TASK-0008 Step 2 only。做完即停；不要自启 Step 3；不要做审查轮。

## 授权
- DEC-0081 + 任务卡 Step 1 状态必须为 ACCEPTED；Step 2 UNLOCKED。
- 对不上则停止、零改动。

## 本步唯一目标（R-031/AC-025 + R-036 负责人路径）
实现事实更正、撤回、归档；禁止硬删。按
docs/evidence/TASK-0008-S1-CONTRACT-MAP.md 使用 transaction_session 同事务写入。

必须交付：
1. session-taking 仓储方法（在既有 SessionLocal 方法旁新增，不破坏现有签名）：
   - FollowUpActivityRepository：append_revision + bump_current_version（或等价原子组合）
   - 撤回：写齐 withdrawn_at / withdrawn_by_user_id / withdrawal_reason
   - Institution（及如需要 Contact）archive：archived_at + archive_reason
   - AuditEventRepository：session-taking record 变体
2. 应用命令（commands.py）：CorrectFollowUp / WithdrawFollowUp / ArchiveInstitution
   （命名可等价，但语义必须清晰）
   - 默认仅记录负责人（owner）可写；非负责人拒绝
   - 本步若做管理员写：必须 reason + audit；否则把管理员写留给 Step 4
   - 推荐本步只做 owner 路径，管理员例外写留给 Step 4（更干净）
3. 必要 API 路由（followups.py / institutions.py）接通上述命令；须走现有 deps 身份
4. 测试（本地合成，不要 crm_test）：
   - AC-025：更正产生新版本、旧版本仍在；撤回保留行+完整 withdrawn 三元组；无 DELETE
   - 事务回滚证明（DEC-0073 point 4）：先制造失败看到 revision/audit 未提交，再证明成功路径
   - 非负责人写被拒绝
5. docs/evidence/TASK-0008-S2-*.md + 任务卡进度字段

## 允许路径
- src/crm/application/commands.py
- src/crm/persistence/repositories.py
- src/crm/persistence/audit_repository.py
- src/crm/persistence/database.py（仅当事务包装必须时）
- src/crm/web/routes/followups.py
- src/crm/web/routes/institutions.py
- tests/（本步相关）
- docs/evidence/TASK-0008-S2-*.md
- docs/tasks/active/TASK-0008-core-record-workflow-repair.md 进度字段 only

## 禁止
- 硬删除任何业务行
- 负责人转交 / batch transfer
- R-035 重复提示、R-029 大类、创建表单 UI、P2 ENABLED（后续步）
- 管理员例外读路由（Step 4）
- crm_test / SSH / 服务器 / 迁移新文件（schema 已有 revisions/withdrawn/archived）
- 改 GAP 范围、向产品负责人提工程题

## 必读
AGENTS.md；DEC-0081；TASK-0008 卡；GAP-ANALYSIS；S1-CONTRACT-MAP；
SPEC-0001 R-007/R-031/R-036/AC-025；现有 repositories.py create 双写先例；
audit_repository.py；database.transaction_session

## 验证
- 新测 + 本地 ungated 全量不回退（不要 CRM_RUN_POSTGRESQL_TESTS=1）
- check-governance.ps1 → PASS

## 完成报告
1. Status  2. Scope  3. Evidence（命令与计数）  4. Not verified  5. Decisions needed: none
```

---

## PROMPT S3 — UNLOCKED (S2 accepted) — paste to DeepSeek now

```text
你是 DeepSeek，本轮唯一实现执行者。协调器审计/编排；你只写代码与实现证据。
执行 TASK-0008 Step 3 only。做完即停；不要自启 Step 4；不要做审查轮。

## 授权
- 任务卡 Steps 1–2 必须为 ACCEPTED；Step 3 UNLOCKED。对不上则停止。

## 本步唯一目标（R-035 / AC-028）
创建时重复嫌疑提示；禁止自动合并；禁止向无权者泄露候选详情。

工程默认（DEC-0080，不得改）：
- 机构：规范化名称精确匹配（trim + 折叠内部空白 + casefold）对已有非归档机构
- 联系人：同一机构 + 同一非空渠道值精确匹配（phone / email / WeChat，各自规范化）
- 只提示、确认后可继续创建；无 fuzzy / 地区匹配

必须交付：
1. 查重逻辑（application 或 repository 查询均可，须可测）
2. 创建路径接通：机构创建、联系人创建在疑似重复时返回明确警告结构
   （HTTP：可用 409 或约定 body 含 duplicates + 需 confirm 标志；选定一种并测稳）
   确认后续建必须显式（如 confirm_duplicate=true），默认不创建
3. 警告中展示的字段必须经 project_record：无权候选不得出现姓名/电话等敏感明文
4. 测试：
   - 命中重复 → 无 confirm 不创建
   - confirm 后可创建（不自动合并成一条）
   - 非负责人/无权视角：候选列表不泄露其不可见字段（AC-028 no-leak）
5. docs/evidence/TASK-0008-S3-*.md + 任务卡进度字段

## 允许路径
- src/crm/application/commands.py
- src/crm/application/queries.py（若查重放查询侧）
- src/crm/persistence/repositories.py
- src/crm/web/routes/followups.py
- src/crm/web/routes/institutions.py
- tests/（本步相关）
- docs/evidence/TASK-0008-S3-*.md
- docs/tasks/active/TASK-0008-core-record-workflow-repair.md 进度字段 only

## 禁止
- 自动合并 / 静默去重
- 硬删、转交、R-031 再改范围、管理员例外读、R-029、表单 UI、P2
- crm_test / 服务器 / 新迁移
- 向产品负责人提工程题

## 必读
AGENTS.md；TASK-0008 卡；GAP-ANALYSIS §8 R-035；SPEC-0001 R-035/AC-028；
S2 路由/命令风格（保持一致）

## 验证
- 新测 + 全量本地 ungated 不回退（149→应增加；不要 CRM_RUN_POSTGRESQL_TESTS=1）
- check-governance.ps1 → PASS

## 完成报告
1. Status  2. Scope  3. Evidence  4. Not verified  5. Decisions needed: none
```

---

## PROMPT S4 — UNLOCKED (S3 accepted) — paste to DeepSeek now

```text
你是 DeepSeek，本轮唯一实现执行者。协调器审计/编排；你只写代码与实现证据。
执行 TASK-0008 Step 4 only。做完即停；不要自启 Step 5；不要做审查轮。

## 授权
- 任务卡 Steps 1–3 必须为 ACCEPTED；Step 4 UNLOCKED。对不上则停止。

## 本步唯一目标（R-015 / AC-009 管理员例外读）
打通管理员例外读端到端：无 reason 拒绝；有 reason 经 project_record(..., administrator_reason=...) 投影，并写 audit_events。

必须交付：
1. 查询/路由路径：管理员对非自有记录的详情/列表读，必须能传入 administrator_reason
   （API 建议：查询参数或请求头/ body 字段 reason；选定一种并测稳）
2. 无 reason 或空白 reason → 403/404（与现有默认拒绝风格一致，选定并测）；不得返回业务正文
3. 有有效 reason → project_record(..., administrator_reason=reason) 返回管理员例外视图；
   同时写 audit：至少 actor_user_id、action、target_type、target_id、reason、outcome=success、时间
4. 禁止任何绕过 project_record 的原始详情查询
5. 测试（DEC-0073 point 4）：
   - 无 reason：拒绝，且 audit 不得记 success 业务读（denied 可选）
   - 有 reason：可读 + audit 含 actor/target/time/reason（AC-009）
   - 非管理员带 reason 不得升级权限
6. docs/evidence/TASK-0008-S4-*.md + 任务卡进度字段

## 允许路径
- src/crm/application/queries.py
- src/crm/persistence/audit_repository.py（若需）
- src/crm/web/routes/institutions.py
- src/crm/web/routes/followups.py（若详情在此）
- src/crm/web/main.py（仅当页面详情入口必须接线 reason 时）
- src/crm/policy/projection.py（仅当接口签名缺口必须补；禁止放宽规则）
- tests/（本步相关）
- docs/evidence/TASK-0008-S4-*.md
- docs/tasks/active/TASK-0008-core-record-workflow-repair.md 进度字段 only

## 禁止
- 管理员写操作扩大（更正/撤回/归档的 admin 写若做，必须 reason+audit；可选本步或明确不做并写在 evidence）
- 负责人转交、R-035/R-029/表单/P2
- crm_test / 服务器 / 新迁移
- 向产品负责人提工程题

## 必读
AGENTS.md；TASK-0008 卡；GAP-ANALYSIS R-015/AC-009；
SPEC-0001 R-015；policy/projection.py ADMINISTRATOR_EXCEPTION；
现有 QueryService.get_institution_detail

## 验证
- 新测 + 全量本地 ungated 不回退（161 基线应增加；不要 CRM_RUN_POSTGRESQL_TESTS=1）
- check-governance.ps1 → PASS

## 完成报告
1. Status  2. Scope  3. Evidence  4. Not verified  5. Decisions needed: none
```

---

## PROMPT S5 — UNLOCKED (S4 accepted) — paste to DeepSeek now

```text
你是 DeepSeek，本轮唯一实现执行者。协调器审计/编排；你只写代码与实现证据。
执行 TASK-0008 Step 5 only。做完即停；不要自启 Step 6；不要做审查轮。

## 授权
- 任务卡 Steps 1–4 必须为 ACCEPTED；Step 5 UNLOCKED。对不上则停止。

## 本步唯一目标
1) R-029 沟通方式大类  2) 浏览器创建表单  3) AC-012 / R-028 专用正向测试

### A. R-029（DEC-0080 词表，不得改）
- 写入时大类字段 ∈ {电话, 微信, 面谈, 邮件, 其他}
- free-text interaction_method 仍可作负责人工作细节
- 精简进度 latest_follow_up_method_category 必须出大类，不得恒为 None
  （修复 queries.py 里 ActivitySummarySource(activity, None) 三处）
- 若需 schema 新列：优先用现有列能表达则不新增迁移；若必须新列，本步仍禁止
  新 migration 文件——用写入时映射到 ActivitySummarySource 第二参，或存入
  已有可扩展字段并在证据说明。首选：命令/路由接收 category，投影时传入
  ActivitySummarySource，不强制新表列（除非你证明现有模型已有列可存）。

### B. 浏览器创建表单
- 机构 / 联系人 / 跟进 三个创建表单（HTML 模板）+ 列表/详情入口链接
- 字段不得超出 policy projection 允许展示/采集范围
- 提交走已有 API 或同源 form POST（CSRF 与现有 auth 一致）
- 含 confirm_duplicate 时的 409 提示可简化为页面可读错误（不要求华丽 UI）

### C. 专用测试
- AC-012：无渠道联系人（not_yet_obtained / not_applicable）可保存且状态显式
- R-028：next_action 有内容则 next_action_owner 必填（正向+拒绝）
- R-029：创建跟进后 concise progress 含正确大类
- 表单入口至少有一个可自动化检查（状态码 200 + 关键字段名出现）

## 允许路径
- src/crm/domain/（若枚举/字段必须）
- src/crm/application/commands.py, queries.py
- src/crm/persistence/repositories.py, models.py（无新 migration）
- src/crm/web/routes/*.py, src/crm/web/main.py
- templates/**
- src/crm/policy/projection.py（仅当 concise progress 接线必须；禁止放宽脱敏）
- tests/
- docs/evidence/TASK-0008-S5-*.md
- docs/tasks/active/TASK-0008-core-record-workflow-repair.md 进度字段 only

## 禁止
- P2 ENABLED 五处修复（Step 6）
- crm_test / 服务器 / 新 alembic revision
- 转交、自动合并、绕过 project_record
- 向产品负责人提工程题

## 必读
AGENTS.md；TASK-0008 卡；GAP-ANALYSIS §8 R-029；SPEC-0001 R-029/AC-012/R-028；
projection.py _concise_progress；现有 templates/

## 验证
- 新测 + 全量本地 ungated 不回退（169 基线应增加；不要 CRM_RUN_POSTGRESQL_TESTS=1）
- check-governance.ps1 → PASS

## 完成报告
1. Status  2. Scope  3. Evidence  4. Not verified  5. Decisions needed: none
```

---

## PROMPT S6 — UNLOCKED (S5 accepted) — paste to DeepSeek now

```text
你是 DeepSeek，本轮唯一实现执行者。协调器审计/编排；你只写代码与实现证据。
执行 TASK-0008 Step 6 only（本任务最后一步）。做完即停；不要做审查轮。

## 授权
- 任务卡 Steps 1–5 必须为 ACCEPTED；Step 6 UNLOCKED。对不上则停止。

## 本步唯一目标
1. 修复五处 user_status=UserStatus.ENABLED 硬编码，改为会话已校验的真实状态：
   - src/crm/web/main.py（约 2 处）
   - src/crm/web/routes/institutions.py（约 3 处）
   - 用 get_current_user / 已解析 UserIdentity.status，禁止再写死 ENABLED
2. 全量本地 ungated 回归（不要 CRM_RUN_POSTGRESQL_TESTS=1）
3. 角色矩阵抽检（含 admin.exception_read 审计、owner 写、非 owner 404）
   — 可复用既有测试，不要求新写全套
4. 写 docs/evidence/TASK-0008-ACCEPTANCE.md（实现侧汇总，非协调器终审）
5. 更新任务卡：Step 6 COMPLETED (impl) — awaiting acceptance；列证据路径

## 允许路径
- src/crm/web/main.py
- src/crm/web/routes/institutions.py
- tests/（仅当 P2 修复需要补测）
- docs/evidence/TASK-0008-ACCEPTANCE.md
- docs/evidence/TASK-0008-S6-*.md（可选）
- docs/tasks/active/TASK-0008-core-record-workflow-repair.md 进度字段 only

## 禁止
- crm_test / SSH / 服务器 / 部署 / 新 migration
- 扩大范围（转交、视觉改版、新功能）
- 向产品负责人提工程题
- 自称“任务已最终验收”（终验由协调器做）

## 必读
AGENTS.md；TASK-0008 卡；GAP-ANALYSIS P2；auth.py 会话状态校验路径

## 验证
- 全量 tests/ 不回退（当前基线 183 passed, 28 skipped 应保持或增加）
- rg 确认 src/ 内业务路由不再硬编码 user_status=UserStatus.ENABLED（测试夹具除外）
- check-governance.ps1 → PASS

## 完成报告
1. Status  2. Scope  3. Evidence  4. Not verified  5. Decisions needed: none
```

---

## Coordinator acceptance checklist (per step)

- [ ] Owned-file diff only
- [ ] Evidence labels match actual commands
- [ ] No scope creep (especially transfer / deploy / real DB)
- [ ] Tests non-vacuous where they claim to catch a named leak (DEC-0073 §4)
- [ ] governance PASS
- [ ] Unlock next prompt only after the above

## Next human decision

DEC-0081 already authorized implementation. No further product decision is
required for S1. After DeepSeek returns S1, coordinator accepts or rejects;
product owner only relays messages unless a true business blocker appears.
