# Task index

## SPEefirst 实现任务卡草稿 (2026-08-26)

三张新任务卡按 SPEC-0002/0003/0016（DEC-0177 批准）创建，**状态均为 DRAFT——
待产品负责人明确授权（AGENTS.md §5）**：

| Task | SPEC | 内容 | 依赖 |
|------|------|------|------|
| `active/TASK-0048-role-shareholder-dual-management.md` | SPEC-0002 v0.5.0 | shareholder 角色 + 多角色叠加 + 双重管理（custodian） | 无 |
| `active/TASK-0049-ai-opportunity-trigger-separation.md` | SPEC-0003 v0.5.0 | AI 商机触发源分离（personal/crawler）+ 定时任务 | TASK-0048 |
| `active/TASK-0050-reporting-export.md` | SPEC-0016 v0.1.0 | 四类报表 + Excel 导出（金额字段待 SPEC-0001 扩展） | TASK-0048；金额挂起 |

执行顺序：TASK-0048 → (TASK-0049, TASK-0050) 并行。TASK-0050 金额合计列为
"待 SPEC-0001 扩展"标记（OD-010 挂起）。

## Formal acceptance update (2026-08-21)

- `TASK-0036`: ACCEPTED for local synthetic-data scope under `DEC-0155`.
- `TASK-0037`: ACCEPTED for local synthetic-data scope under `DEC-0155`.
- `TASK-0038`: PARTIAL under `DEC-0155`; legacy reminder cleanup and OD-006a
  provider/egress decision remain open.
- `TASK-0039`: ACCEPTED for local synthetic-data scope under `DEC-0157`.

Last updated: 2026-08-25 (**DEC-0173 批次授权 TASK-0043~0047 前端补齐**
（AI 商机/公池操作/管理摘要/系统管理/批量导入 UI，既有 approved SPEC 的
展示层，串行执行；**2026-08-25 五卡全部 EXECUTED — AWAITING INDEPENDENT
REVIEW**（Reasonix 实际执行，NOT SELF-ACCEPTED；**独立评审统一为 glm-5.2，
DEC-0174 变更门禁**；
证据 `docs/evidence/TASK-0043/0044/0045/0046/0047-*-20260825.md`）；全量
`504 passed, 28 skipped`、compileall 0、`git diff --check` 0、governance
`[PASS]`；部署/commit/push 未授权）。)

**2026-08-25 独立评审**：glm-5.2 实测五卡全 PASS（证据
`docs/evidence/TASK-0043~0047-INDEPENDENT-REVIEW-GLM52-20260825.md`），批次
verdict `APPROVE_AND_DISPATCH_NEXT_TASK`（无实质缺陷，5 条报告性文档项已
落实：卡基线 459→457、DEC-0173 加 DEC-0174 supersede 注、Acceptance 段
改 glm-5.2、0045/0046/0047 证据补 style.css 说明、NOW.md 导航 8 入口）；
**2026-08-25 产品负责人「验收通过」（DEC-0175）→ 五卡状态 ACCEPTED**；
部署/commit/push/客户编辑仍按 DEC-0173 未授权。

Previous update 2026-08-13 (historical): TASK-0036/0037/0038 EXECUTED（本地合成数据范围，
由 DeepSeek-v4-flash 执行，DeepSeek-v4-pro 独立评审，NOT SELF-ACCEPTED）：
TASK-0036 COMPLETE、TASK-0037 COMPLETE、TASK-0038 PARTIAL；任务卡自报
`375/387 passed, 28 skipped` + 全量回归绿色；本地复核实跑 2026-08-13 全量
`395 passed, 28 skipped`、compileall exit 0、`git diff --check` exit 0、
governance `[PASS]`；生产迁移/部署/数据变更未授权。** 历史：DEC-0153 批准
DEC-0149 修订的 4 份 SPEC（SPEC-0001 v0.8.0 / SPEC-0002 v0.4.0 /
SPEC-0003 v0.4.0 / SPEC-0014 v0.3.0）、DEC-0154 授权实现；W5 生产发布已完成
（DEC-0142）、V1 验证已通过（DEC-0148）；TASK-0028/0029 等生产依赖审计待
Codex 评审。）

## Active

| Task | Type | Status | Approved authority | Owner | Gate |
|---|---|---|---|---|---|
| `active/TASK-0043-ai-opportunity-discovery-ui.md` | IMPLEMENTATION (UI) | **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)** | `SPEC-0003 v0.4.0` + approval hash; authorized by `DEC-0173` | deepseek-v4-flash-0713 via reasonix (execution); independent review: glm-5.2 (DEC-0174) | Restore `/discovery` candidate list/detail/adjudicate UI + admin run/management view; nav repair; design-token baseline in `style.css`; pytest full green, compileall 0, `git diff --check` 0, governance `[PASS]`, evidence file; no commit/push/deploy |
| `active/TASK-0044-customer-pool-and-record-actions-ui.md` | IMPLEMENTATION (UI) | **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)** | `SPEC-0001 v0.8.1` + `SPEC-0008` + approval hash; authorized by `DEC-0173` | deepseek-v4-flash-0713 via reasonix (execution); independent review: glm-5.2 (DEC-0174) | Detail-page actions (archive/release/claim/type-change/correct/withdraw), public-pool list page, list filters; same completion gate; depends on TASK-0043 baseline |
| `active/TASK-0045-management-summary-ui.md` | IMPLEMENTATION (UI) | **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)** | `SPEC-0002 v0.4.1` (+ `SPEC-0003 v0.4.0` link) + approval hash; authorized by `DEC-0173` | deepseek-v4-flash-0713 via reasonix (execution); independent review: glm-5.2 (DEC-0174) | Read-only `/management` page: admin company-wide / manager scoped masked summary from `GET /api/admin/summary`; same completion gate |
| `active/TASK-0046-admin-user-role-management-ui.md` | IMPLEMENTATION (UI) | **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)** | `SPEC-0002 v0.4.1` + `SPEC-0011 v0.2.0` + approval hash; authorized by `DEC-0173` | deepseek-v4-flash-0713 via reasonix (execution); independent review: glm-5.2 (DEC-0174) | Admin-only `/admin` UI: role grant/revoke (3 roles only), enable/disable, transfer single/batch, erasure with reason+confirmation; same completion gate |
| `active/TASK-0047-bulk-import-ui.md` | IMPLEMENTATION (UI) | **ACCEPTED (DEC-0175, 2026-08-25 — product-owner acceptance)** | `SPEC-0013 v0.1.0` + approval hash; authorized by `DEC-0173` | deepseek-v4-flash-0713 via reasonix (execution); independent review: glm-5.2 (DEC-0174) | Admin-only `/imports` UI: upload (multipart), batch list/detail, undo with confirmation; synthetic files only; same completion gate |
| `active/TASK-0040-opportunity-external-integration.md` | IMPLEMENTATION / VERIFICATION | **ACCEPTED — 独立评审 PASSED（zcode/GLM-5.2，DEC-0161，2026-08-23）；覆盖本地实现 + 真实外部调用腿 + 多轮评审修复 + 真实 LLM reason 生成 + 省市站点清单 38 个；真实抓取/生产迁移/部署未授权未执行** | `SPEC-0003 v0.4.0` + approval hash; authorized by `DEC-0158` (`DEC-0159` owner change, `DEC-0160` → `DEC-0161` review-owner change to zcode/GLM-5.2) | deepseek-v4-flash-0731 (implementation, `DEC-0159`); zcode/GLM-5.2 (independent review, `DEC-0161`; was Qwen3.8-max per `DEC-0160`) | Isolated provider/crawler integration with whitelist, leak scan, audit, deterministic degradation, human adjudication; local `459 passed, 28 skipped`, compileall 0, `git diff --check` 0, governance `[PASS]`; 省市站点清单 2026-08-23 按产品负责人指令扩展至 38 个（2 国家级 + 14 省级 + 22 地市级，全部从官方导航页发现并真实验证可达，非编造；287 地市候选 → 36 交易平台可达；未达省市如实降级）; 真实 LLM reason 生成已验证成功（glm-5.2 SSE 网关，SseStreamingHttpClient 适配，reason 1375 字符，R-013 零命中，审计 success 仅模型标识+字段名；配额耗尽 key 403 路径如实降级）; self-review 9 findings fixed; focused round fixed P1 裁决越权 + P2 审计降级/流式上限/政府域名门; Codex review round fixed 源 URL fail-closed + audit outcome 必填 + provider 客户端 ProviderError 审计; no production or external writes |
| `active/TASK-0041-opportunity-production-rollout.md` | IMPLEMENTATION / VERIFICATION / DEPLOYMENT-PREP | ACTIVE / **AUTHORIZED — P0+P1（P2/P3 待定），DEC-0162，2026-08-23** | `SPEC-0003 v0.4.0` + `SPEC-0012 v0.2.0` + approval hash; authorized by `DEC-0162` (batch P0+P1; P2/P3 未授权) | reasonix (implementation, per product-owner direction); independent review TBD (different lineage from reasonix) | P0 生产依赖对账（修复 starlette/fastapi 不一致 + 补 python-multipart，隔离重建不就地 venv 手术）；P1 真实抓取 + 真实 LLM(glm-5.2，OD-006a 选定) 受控环境执行（密钥走运行期环境变量；执行前即时确认 DEC-0158 门2；R-013 泄露扫描 + 审计）；P2 生产部署 / P3 G7/V1/R2 验收未授权 |
| `active/TASK-0036-deprecate-agent-admin-gm-roles.md` | IMPLEMENTATION | ACTIVE / **EXECUTED 2026-08-13 — COMPLETE（本地合成数据；R-027 进池交叉引用至 TASK-0037）— AWAITS INDEPENDENT REVIEW (DeepSeek-v4-pro; NOT SELF-ACCEPTED)** | `SPEC-0002 v0.4.0` + `SPEC-0014 v0.3.0` + approval hash; authorized by `DEC-0154` | DeepSeek-v4-flash (execution); DeepSeek-v4-pro (independent review) | 废弃 agent 角色 + admin/gm 重定义 + 自助改密回退；任务卡自报 `375 passed, 28 skipped`；本地复核实跑 2026-08-13 全量 `395 passed, 28 skipped`、compileall 0、`git diff --check` 0、governance `[PASS]`；生产迁移/部署未授权 |
| `active/TASK-0037-customer-type-public-pool.md` | IMPLEMENTATION | ACTIVE / **EXECUTED 2026-08-13 — COMPLETE（本地合成数据）— AWAITS INDEPENDENT REVIEW (DeepSeek-v4-pro; NOT SELF-ACCEPTED)** | `SPEC-0001 v0.8.0` + approval hash; authorized by `DEC-0154` | DeepSeek-v4-flash (execution); DeepSeek-v4-pro (independent review) | 客户三类型 + 公池 + 术语统一「客户」；依赖 TASK-0036；任务卡自报 `387 passed, 28 skipped`（test_task0037 11 用例）；本地复核实跑 2026-08-13 全量 `395 passed, 28 skipped`；生产迁移/部署未授权 |
| `active/TASK-0038-opportunity-redefinition-crawler.md` | IMPLEMENTATION | ACTIVE / **EXECUTED 2026-08-13 — PARTIAL（核心完成：AI 候选+人裁定、爬虫桩、30 天留存、采纳进公池、R-013 泄露扫描、gm 脱敏只读；剩余：旧 v0.3.0 提醒基建清理 + 真实爬虫/出境 OD-006a 门）— AWAITS INDEPENDENT REVIEW (DeepSeek-v4-pro; NOT SELF-ACCEPTED)** | `SPEC-0003 v0.4.0` + approval hash; authorized by `DEC-0154` | DeepSeek-v4-flash (execution); DeepSeek-v4-pro (independent review) | 商机重定义 + 网络爬虫；依赖 TASK-0036/0037；全量回归绿色（test_task0038 8 用例）；本地复核实跑 2026-08-13 全量 `395 passed, 28 skipped`；真实爬虫/出境（OD-006a）未授权 |
| `active/TASK-0001-manual-core-record-activity.md` | IMPLEMENTATION | ACTIVE FILE / PARTIAL (local auth repair under DEC-0051) | `SPEC-0001 v0.7.0` + approval hash; authorized by `DEC-0046`; W4 authorized under `DEC-0053` and re-authorized under `DEC-0055` | ZCode agent (successor implementer per `DEC-0067`, appointed 2026-08-02; model identity per executor self-report or UNKNOWN, never asserted; historical owner: Codex, retained as history on the task card) | Authorized implementation task (TASK-0007 is also authorized per `DEC-0067`); foundation work (S1-S3+R1) complete; S4 partial; W4/S5/S6 accepted gate status NOT VERIFIED; mainline gate work resumes after TASK-0007 acceptance per `DEC-0067` sequencing |
| `active/TASK-0002-search-parameter-rename.md` | IMPLEMENTATION | ACTIVE FILE / PARTIAL (local rename is historical evidence; authenticated filtering NOT VERIFIED) | `SPEC-0008 v0.1.0` + approval hash; task authorization/ownership metadata incomplete | Unassigned | Local parameter rename is historical evidence; authenticated filtering with `?q=` remains NOT VERIFIED |
| `active/TASK-0003-bulk-import-suzhou-institutions.md` | IMPLEMENTATION | ACTIVE FILE / ONE-TIME LOAD RATIFIED (DEC-0058) / CAPABILITY NOT IMPLEMENTED | `SPEC-0013 v0.1.0` + approval hash; `DEC-0058` ratifies only the executed one-time import | Unassigned | `DEC-0058` ratified only the one-time import; reusable SPEC-0013 capability is not implemented or authorized |
| `active/TASK-0006-governance-evidence-reconciliation.md` | DOCUMENTATION | CLOSED / ACCEPTED (final batch accepted by Kimi-K3, 2026-08-02; card file retained under `active/` for path stability) | `DEC-0062`-`DEC-0066`; documentation-only reconciliation against approved SPECs and current evidence | Final batch executor: ZCode subagent dispatched by the coordinator per `DEC-0066` | Stage A accepted by Codex (historical); final batch executed by a ZCode subagent and independently accepted by Kimi-K3 per `DEC-0066` (evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`) |
| `active/TASK-0007-auth-authorization-repair.md` | IMPLEMENTATION | ACTIVE / ACCEPTED (steps 1-5 complete; independent review verdict ACCEPTED 2026-08-02 — all 6 gated PostgreSQL tests pass; coordinator independent re-run 6/6 passed 2026-08-02; TASK-0001 mainline resumes per DEC-0067 point 4) | `SPEC-0002 v0.2.0` + approval hash; authorized by `DEC-0067`; also governed by `SPEC-0001`, `SPEC-0012`, `DEC-0044` | ZCode agent (per `DEC-0067`; one bounded subagent dispatched by the coordinator; model identity per executor self-report or UNKNOWN, never a gate) | Gate satisfied: TASK-0006 passed 2026-08-02 plus explicit authorization `DEC-0067`; local implementation and synthetic verification only — no server/DB/deploy/real-data/git writes; focused tests + role matrix + contract-level restart proof pass (69 passed / 6 skipped, reviewer re-run); real-PostgreSQL durability legs VERIFIED by TASK-5A (`docs/evidence/TASK-5A-verification.md`) |
| `active/TASK-5A-postgresql-isolated-verification.md` | VERIFICATION | ACTIVE (re-dispatched 2026-08-02 under `DEC-0069`; attempt 1 stopped fail-closed at preflight because `DEC-0068`'s port-connect route was unsatisfiable against a loopback-bound listener — not an execution defect; attempt 2 runs the same authorized actions over the project's established SSH transport) | `SPEC-0002 v0.2.0` + approval hash; authorized by `DEC-0068` (database actions) + `DEC-0069` (SSH transport); also governed by `SPEC-0001`, `SPEC-0012`, `DEC-0044`, `DEC-0065`, `DEC-0066`, `DEC-0067` | ZCode agent / GLM (one bounded subagent dispatched by the coordinator; model identity per executor self-report or UNKNOWN, never a gate) | Gate satisfied: TASK-0007 reviewed PARTIAL with only the real-PostgreSQL legs unverified, plus explicit authorizations `DEC-0068` and `DEC-0069`; six gated tests run against a newly created isolated empty `crm_test` database over the established SSH transport; no production real table may be read or written; widening `listen_addresses` or opening the database port is withdrawn and not proposed; four fail-closed stops apply including a possibly stale local `DATABASE_PASSWORD`; all other `DEC-0067` boundaries remain in force |
| `active/TASK-0008-core-record-workflow-repair.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED** (local synthetic 2026-08-04; crm_test 25/25 PASSED 2026-08-05 DEC-0082; deployed to production 2026-08-05 DEC-0083); Steps 1–6 done; browser visual NOT VERIFIED | `SPEC-0001 v0.7.0` + approval hash; scope `DEC-0080`; implementation `DEC-0081`; also governed by `SPEC-0002` R-003/R-006/R-013 | DeepSeek (implementation); coordinator opencode/grok-4.5 (audit) | Local suite `183 passed, 28 skipped`; governance PASS; crm_test `25 passed`; deployed to `https://crm.aibrain.wiki`; evidence `TASK-0008-ACCEPTANCE.md` + `TASK-0008-S6-ACCEPTANCE.md` + `TASK-0008-CRM-TEST-VERIFICATION.md` + `TASK-0008-DEPLOY.md`; browser visual acceptance remaining |
| `active/TASK-0012-ui-enhancement.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED + DEPLOYED** (coordinator audit 2026-08-05 DEC-0086; deployed 2026-08-05 DEC-0087; service active; browser visual pending) | `SPEC-0001 v0.7.0` (R-030/R-029), `SPEC-0002 v0.2.0`, `SPEC-0008 v0.1.0`; scope `DEC-0084`; implementation `DEC-0085`; deployment `DEC-0087` | DeepSeek (implementation, one-pass); coordinator opencode (audit+deploy) | Local suite `183 passed, 28 skipped`; governance PASS; 11 files changed; deployed to `https://crm.aibrain.wiki`; evidence `TASK-0012-ACCEPTANCE.md` + `TASK-0012-DEPLOY.md`; browser visual acceptance remaining |
| `active/TASK-0009-integration-test-baseline.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED** (`DEC-0092`) | `SPEC-0001` + related approved workflow SPECs; local synthetic authorization `DEC-0089`; remediation executor GLM-5.2 | GLM-5.2 (remediation); coordinator (independent audit) | `184 passed, 28 skipped` in 5/5 runs; pip check and governance PASS; no deployment/remote/real-data work |
| `active/TASK-0014-core-semantic-security-closure.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED** (`DEC-0097`, second remediation; local synthetic only) | `SPEC-0001` + `SPEC-0002`; local synthetic authorization `DEC-0089`; ownership release/activation `DEC-0092`; executor reassignment `DEC-0093`; remediation requirements `DEC-0095`/`DEC-0096` | GLM-5.2 (sole implementation executor); coordinator (independent audit, accepted) | P0/P1 write-authorization and semantic closure verified: `21 passed` focused, `205 passed, 28 skipped` full suite, compileall exit 0, governance PASS; whitespace read-exception normalization + single `archive_reason` contract confirmed; evidence `docs/evidence/TASK-0014-COORDINATOR-ACCEPTANCE-2-20260806.md`; no deployment/remote/real-data work |
| `active/TASK-0010-search-security-verification.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED** (`DEC-0101`; remediation of `DEC-0100` verified) | `SPEC-0008 v0.1.0` + approval hash (re-verified 2026-08-06); also governed by `SPEC-0001`, `SPEC-0002`; local synthetic authorization `DEC-0089`; activation `DEC-0098`; executor `DEC-0099` | GLM (implementation); coordinator (independent audit, accepted) | Actor-aware searchable predicate closes hidden-field existence oracle; AC-001–AC-007 covered for all five actor classes; `13 passed` focused, `218 passed, 28 skipped` full suite, governance PASS; evidence `docs/evidence/TASK-0010-COORDINATOR-ACCEPTANCE-20260806.md`; residuals: unhandled-UUID 500 (P2 future task), unset `management_scope_key` (input to TASK-0015) |
| `active/TASK-0015-user-role-management.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED** (`DEC-0103`) | `SPEC-0002 v0.2.0` + approval hash (re-verified 2026-08-06); local synthetic authorization `DEC-0089`; activation `DEC-0102` | GLM (implementation); coordinator (independent audit, accepted) | Four capability areas verified: `26 passed` focused, `244 passed, 28 skipped` full suite, governance PASS; evidence `docs/evidence/TASK-0015-COORDINATOR-ACCEPTANCE-20260806.md`; residuals D2/D3 recorded; scope semantics resolved by `DEC-0104` (assigned territory labels matched to record region) |
| `active/TASK-0017-data-lifecycle-erasure.md` | IMPLEMENTATION | ACTIVE / **ACCEPTED** (`DEC-0107`; round-1 audit `DEC-0106` remediation verified) | `SPEC-0011 v0.2.0` + approval hash (re-verified 2026-08-06); local synthetic authorization `DEC-0089`; `OD-001` resolved `DEC-0104`; activation `DEC-0105` | GLM (sole executor, per `DEC-0105`); coordinator (independent audit, accepted) | Audited irreversible erasure + request-completion records + 30-day backup propagation evidence + synthetic restore rehearsal; `14 passed` focused, `258 passed, 28 skipped` full suite, governance PASS; evidence `docs/evidence/TASK-0017-COORDINATOR-ACCEPTANCE-20260806.md`; observations F2 (rehearsal omits audit_events) / F3 (follow-up free text outside erasure scope — owner question) carried forward |
| `active/TASK-0011-bulk-import-capability.md` | IMPLEMENTATION | ACTIVE / IMPLEMENTATION-READY (`DEC-0108`) | `SPEC-0013 v0.1.0` + approval hash (re-verified 2026-08-06, match); also governed by `SPEC-0001`, `SPEC-0002`, `SPEC-0011`; local synthetic authorization `DEC-0089`; activation `DEC-0108` | GLM (sole executor, per `DEC-0108`); coordinator (audit) | Reusable administrator batch-import capability: durable batch + row results, duplicate flags, partial success, idempotent rerun, conditional undo; synthetic files only — the existing 117 records are never touched |
| `active/TASK-0022-architecture-sdd-rebaseline.md` | DOCUMENTATION / REVIEW | ACTIVE / **ACCEPTED** (documentation/review scope independently accepted 2026-08-12; executed via the configured PI selector `opencode-go/deepseek-v4-flash`, gateway selection only, upstream identity unclaimed) | `SPEC-0012 v0.2.0` (TASK-0018 review boundary only; TASK-0022 changes no product behavior); product SPEC authority is the existing approved baseline; governance SPEC `SPEC-GOV-0001 v0.4.0` prepared for review, NOT approved | DeepSeek-v4-flash in PI (one bounded pass, `DEC-0125`); Codex (independent reviewer / acceptance decision-maker) | Architecture baseline (`docs/architecture/`), `ADR-0003`, review-ready `SPEC-GOV-0001` in `20-review`, reconciled control documents; independent acceptance `docs/evidence/TASK-0022-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`; provider block recorded `DEC-0126` |
| `active/TASK-0023-g6-release-resource-plan.md` | DOCUMENTATION / REVIEW | ACTIVE / **ACCEPTED** (G6 local documentation-planning scope only) | `SPEC-0012 v0.2.0`; `DEC-0127` authorizes G6 planning only | DeepSeek in PI (one bounded pass); Codex (independent reviewer / acceptance decision-maker) | Local resource manifest, isolation/rollback plan, and future W5 evidence contract only. Independent acceptance: `docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`. No SSH, release, production inspection, systemd/nginx/DNS/TLS change, service restart, database mutation, or real data. W5/G7/V1/R2 remain separately unauthorized. |
| `active/TASK-0024-w5-read-only-production-preflight.md` | VERIFICATION | ACTIVE / **NOT ACCEPTED / PARTIAL — BOUNDARY INCIDENT RECORDED** (`DEC-0130`, 2026-08-12) | `SPEC-0012 v0.2.0`; `DEC-0129` authorizes read-only production preflight only | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Executed 2026-08-12; the recorded journald pipelines read/processed log records and message text before aggregation, exceeding the no-log-body boundary. Snapshot and execution record are preserved as unaccepted evidence (`docs/evidence/TASK-0024-W5-READ-ONLY-PREFLIGHT-20260812.md`, `docs/evidence/TASK-0024-DEEPSEEK-PI-EXECUTION-20260812.md`); local record reconciled by TASK-0025. No credentials, business-row values, release, restart, configuration/database write, commit, or push. W5 release/G7/V1/R2 remain unauthorized. |
| `active/TASK-0026-w5-no-log-read-only-production-preflight.md` | VERIFICATION | ACTIVE / **EXECUTED 2026-08-12 (HANDOFF-ONLY) — AWAITS CODEX INDEPENDENT REVIEW** | `SPEC-0012 v0.2.0`; `DEC-0132` authorizes exactly one no-log read-only production preflight | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Executed 2026-08-12 with **NO LOG COMMAND RAN**; snapshot and execution record at `docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md` and `docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md`. No credentials, business-row values, log facts, release, restart, configuration/database write, commit, or push. W5 release/G7/V1/R2 remain PENDING and separately unauthorized. |
| `active/TASK-0027-w5-production-release-correction.md` | DEPLOYMENT / VERIFICATION | ACTIVE / **EXECUTED 2026-08-12 — BLOCKED at remote precondition 6 (runtime venv `pip check` failed) before any production mutation — AWAITS CODEX INDEPENDENT REVIEW** | `SPEC-0012 v0.2.0`; `DEC-0133` authorizes one bounded W5 correction only | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Exact committed payload `59101b80b6420155bf8aec26b14ea7800979db86` prepared locally (archive SHA-256 `c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`; extracted-tree compile OK; Alembic head `0005_opportunity_reminders_ai_reasoning` only). Remote preconditions 1–6 verified (identity, service, runtime file, nginx, listeners, DB at `0001_initial_schema`); **precondition 6 `pip check` FAILED**: `fastapi 0.141.0` requires `starlette>=0.46.0`, runtime has `starlette 0.44.0`, payload pins `fastapi==0.136.3`. Stopped fail-closed per handoff/DEC-0133; no backup, transfer, migration, restart, or liveness step ran; no production write occurred; no log command and no secret access. Evidence: `docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`, `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md`. No dirty-worktree payload, `0006`, nginx/DNS/TLS edit, credential inspection, log query, database restore/downgrade, cleanup, or later-gate acceptance. |
| `active/TASK-0028A-local-release-dependency-baseline.md` | VERIFICATION | ACTIVE / **EXECUTED 2026-08-12 — AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)** | `SPEC-0012 v0.2.0`; `DEC-0134` authorizes the first read-only package step | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Fixed commit `59101b80b6420155bf8aec26b14ea7800979db86` dependency declaration inventory and immutable-environment evidence only; no network, package, source, or environment change. Evidence: `docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`. |
| `active/TASK-0028B-production-runtime-dependency-inventory.md` | VERIFICATION | ACTIVE / **EXECUTED 2026-08-12 — AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)** | `SPEC-0012 v0.2.0`; `DEC-0134` authorizes the second no-log, read-only package step | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Strict-SSH Python/package metadata and `pyproject.toml` hash only; no package operation, configuration/environment read, service/database action, log access, or production write. Evidence: `docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`. |
| `active/TASK-0028C-dependency-difference-and-remediation-proposal.md` | REVIEW / VERIFICATION | ACTIVE / **EXECUTED 2026-08-12 — AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)** | `SPEC-0012 v0.2.0`; `DEC-0134` authorizes package evidence comparison only | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Compare TASK-0028A/B facts and create one non-executed remediation proposal; no new remote action or dependency repair. Evidence: `docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`. |
| `active/TASK-0029-reproducible-dependency-artifacts.md` | VERIFICATION | ACTIVE / **ACCEPTED 2026-08-13 (DEC-0136, Codex independent acceptance; local-only reproducibility-artifact scope)** | `SPEC-0012 v0.2.0`; `DEC-0135` authorized this local-only package | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | TASK-0029A/B/C: fixed-commit resolution and hash manifest, two fresh offline local reconstructions, and separate Linux CPython 3.12 wheel-availability check. Public PyPI download and external temporary venvs only; no production/SSH, source/configuration, deployment, or repository dependency write. Key finding: Linux/Windows version drift for greenlet (3.2.5 vs 3.5.5) and argon2-cffi-bindings (21.2.0 vs 25.1.0). Next remediation step (environment rebuild + service switch) remains separately unauthorized. |
| `active/TASK-0030-production-environment-rebuild.md` | DEPLOYMENT | ACTIVE / **REVIEWED 2026-08-13 (DEC-0138): execution accepted as correct fail-closed (BLOCKED + successful rollback); root cause CORRECTED to venv-move shebang breakage (not proven code incompatibility)** | `SPEC-0012 v0.2.0`; `DEC-0137` authorized the bounded switch | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Frozen-lock venv built + validated (pip check 0; fastapi 0.136.3/starlette 1.6.0); switch failed because `mv` broke the venv console-script shebangs (`#!/opt/anqiao-crm/venv-new/bin/python3.12` stale); rolled back (service 200). Clean venv preserved at `/opt/anqiao-crm/venv-failed-20260813022501`. Corrected next switch must be relocation-safe; code/deps runtime compatibility still [UNKNOWN]. Next switch = new production mutation = new authorization. |
| `active/TASK-0031-full-w5-production-release.md` | DEPLOYMENT | ACTIVE / **REVIEWED 2026-08-13 (DEC-0140): execution accepted as correct fail-closed; root cause CONFIRMED (0005 revision id = 39 chars > varchar(32); char count corrected from 41)** | `SPEC-0012 v0.2.0`; `DEC-0139` authorized the bounded full W5 release | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | Phases 1–7 OK; migration BLOCKED on payload defect (revision id 39 chars > alembic_version varchar(32)); atomic rollback left DB unchanged; rollback OK (service 200). Recommended fix: one-time `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(64)` then re-run release (reusing preserved artifacts). Needs new authorization. |
| `active/TASK-0032-corrected-w5-production-release.md` | DEPLOYMENT | ACTIVE / **ACCEPTED 2026-08-13 (DEC-0142, Codex independent acceptance: W5 release verified complete)** | `SPEC-0012 v0.2.0`; `DEC-0141` authorized the corrected W5 release | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | W5 release complete: column varchar(64); migration 0001→0005; release source (35 .py) + frozen venv live; GET /login 200; fastapi 0.136.3 / starlette 1.6.0; pip check clean; migrations 0001–0005 (no 0006). G7/V1/R2 and loopback bind change remain separately unauthorized. |
| `active/TASK-0033-v1-business-verification-loopback.md` | VERIFICATION | ACTIVE / **ACCEPTED 2026-08-13 (DEC-0148, Codex independent acceptance: V1 verification + loopback tightening)** | `SPEC-0012 v0.2.0`; `DEC-0143` authorized the bounded V1 verification + loopback tightening | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | V1 verification passed (login/list/detail/search 200; masking confirmed); loopback tightened (port 8200 now 127.0.0.1; HTTPS still 200). G7 (HTTPS already live) and R2 (owner acceptance) remain. |
| `active/TASK-0035-initial-account-seeding.md` | DEPLOYMENT | ACTIVE / **EXECUTED 2026-08-13 — ACCOUNTS SEEDED (HANDOFF-ONLY: admin pw reset, gm/hedan/zhoujingjing created, all login 200) — AWAITS CODEX INDEPENDENT REVIEW (NOT SELF-ACCEPTED)** | `SPEC-0002 v0.3.0`; `DEC-0147` authorizes the bounded initial account seeding | DeepSeek in PI (sole executor); Codex (independent reviewer / acceptance decision-maker) | 4 internal accounts seeded: admin (administrator, pw reset), gm (general_manager), hedan & zhoujingjing (business_user); all login 200. No other business data touched. zxx (agent) was created by the parallel track. |
| `active/TASK-0034-agent-role-user-phone.md` | IMPLEMENTATION | ACTIVE / **EXECUTED 2026-08-13 (DEC-0146): 本地实现 + 生产部署/迁移0007/建账号完成 — AWAITS INDEPENDENT REVIEW (NOT SELF-ACCEPTED)** | `SPEC-0002 v0.3.0` + `SPEC-0014 v0.2.0`; `DEC-0145` 本地实现授权；`DEC-0146` 生产授权 | Codex (PI), current session; review/acceptance owner TBD | 代理（agent）角色 + `user_identities.phone` 字段 + 迁移 `0007`；本地 `375 passed, 28 skipped`；生产迁移 0007 + 部署 + `zxx`/张先侠（agent/15805243456/临时密码123）账号创建并验证登录/角色端到端 200。 |

> [VERIFIED] The takeover review at
> `docs/evidence/ARCH-20260731-TAKEOVER-REVIEW.md` found that these active task
> files and later evidence/status documents conflict with current source and
> runtime probes. They are historical and must be reconciled by TASK-0006 before
> any implementation task uses them as prerequisites.
>
> **Current reconciled state**:
> - TASK-0001: explicitly authorized implementation task (TASK-0007 is also
>   authorized per `DEC-0067`); foundation complete (S1-S3+R1), partial S4;
>   W4 authorized under `DEC-0053`/`DEC-0055`; W4/S5/S6 accepted gate status
>   NOT VERIFIED; implementation ownership succeeded to the ZCode agent per
>   `DEC-0067`; mainline gate work resumes after TASK-0007 acceptance
> - TASK-0002: authorization/ownership metadata incomplete; local rename is
>   historical evidence; authenticated `?q=` filtering NOT VERIFIED
> - TASK-0003: `DEC-0058` ratified only the one-time import; reusable
>   capability not implemented or authorized
> - TASK-0006: CLOSED / ACCEPTED — Stage A accepted by Codex (historical); the
>   final reconciliation batch was executed by a ZCode subagent and independently
>   accepted by Kimi-K3 on 2026-08-02 per `DEC-0066`
> - TASK-0007: ACTIVE / ACCEPTED under `DEC-0067` (owner: ZCode agent); durable
>   authentication/authorization repair implemented and locally verified;
>   independent review 2026-08-02 found no unresolved P0/P1; coordinator
>   independent re-run of 6 gated PostgreSQL tests on `crm_test` confirmed
>   ACCEPTED (2026-08-02); TASK-0001 mainline resumes per DEC-0067 point 4
> - TASK-5A: ACTIVE, re-dispatched under `DEC-0069` (owner: ZCode agent / GLM);
>   attempt 1 stopped fail-closed at preflight because `DEC-0068`'s
>   port-connect route was unsatisfiable against a loopback-bound listener whose
>   non-exposure is a passing W2/W3/G4 gate result — an unsatisfiable
>   instruction, not an execution defect; attempt 2 carries the same authorized
>   actions over the project's established SSH transport
>   (`docs/evidence/TASK-5A-ORCHESTRATION-ANALYSIS.md`)
> - No implementation task may treat W4/S5/S6 as passed until independently
>   verified

## Proposed recovery and implementation tasks

TASK-0007 was authorized and activated under `DEC-0067` (see Active above).
TASK-5A was authorized as a verification task under `DEC-0068` and re-routed
under `DEC-0069` (see Active above). TASK-0008 was authorized under `DEC-0081`
and is ACCEPTED (DEC-0082/DEC-0083). TASK-0012 was authorized under `DEC-0085`
for one-pass DeepSeek execution. Under `DEC-0089`, TASK-0009 through TASK-0011
and the new completion cards are authorized for local synthetic implementation.
TASK-0009 is accepted and TASK-0014 is now active under `DEC-0092`; later tasks
remain pending their own prerequisites and ownership release.
Only one implementation task may own an affected file at a time.

Current override (2026-08-12): `TASK-0018` is ACCEPTED only for its local
synthetic operations-evidence scope under `DEC-0125`; its remote, production,
PostgreSQL-gated, and product-owner acceptance boundaries remain NOT VERIFIED.
`TASK-0022` is the sole active documentation/review pass: after an initial PI
dispatch returned `402 Insufficient Balance` (recorded `DEC-0126`;
`docs/evidence/TASK-0022-PI-DISPATCH-BLOCKED-20260812.md`), the bounded pass
was then executed via the configured PI selector `opencode-go/deepseek-v4-flash`
from the handoff at
`docs/handoffs/HANDOFF-20260812-DEEPSEEK-PI-TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.
The selector identifies the PI gateway selection only; it does not prove or
claim the upstream model identity, provider billing state, or a new
decision-log authorization.
Result status is `HANDOFF-ONLY`; Codex remains the only acceptance
decision-maker. Evidence:
`docs/evidence/TASK-0022-ARCHITECTURE-SDD-REBASELINE.md`.
`TASK-0023` (G6 release-resource planning, `DEC-0127`) is **ACCEPTED only for
its single bounded local documentation-planning pass** after Codex independent
review. No production action occurred; W5/G7/V1/R2 remain PENDING and
separately unauthorized. The plan evidence is
`docs/evidence/TASK-0001-G6-release-resource-plan-20260812.md`, the execution
evidence is `docs/evidence/TASK-0023-DEEPSEEK-PI-G6-PLAN-20260812.md`, and the
independent acceptance is
`docs/evidence/TASK-0023-GPT56-INDEPENDENT-ACCEPTANCE-20260812.md`.
`TASK-0024` (W5 read-only production preflight, `DEC-0129`) was **EXECUTED on
2026-08-12** by DeepSeek in PI (result `HANDOFF-ONLY`) but is **NOT ACCEPTED
/ PARTIAL — BOUNDARY INCIDENT RECORDED per `DEC-0130`**: its journald
pipelines read/processed log records and message text before aggregation,
exceeding the no-log-body boundary. Snapshot and execution evidence under
`docs/evidence/` are preserved as unaccepted evidence; the local record is
reconciled by TASK-0025 and **awaits Codex independent review**. No
production mutation occurred; W5 release execution, G7, V1, and R2 remain
PENDING and separately unauthorized.
`TASK-0026` (W5 no-log read-only production preflight, `DEC-0132`) was
**EXECUTED on 2026-08-12** by DeepSeek in PI (result `HANDOFF-ONLY`; **NO
LOG COMMAND RAN**) and **awaits Codex independent review**. Evidence:
`docs/evidence/TASK-0026-W5-NO-LOG-READ-ONLY-PREFLIGHT-20260812.md` and
`docs/evidence/TASK-0026-DEEPSEEK-PI-EXECUTION-20260812.md`. No mutation
occurred; W5 release execution, G7, V1, and R2 remain PENDING and separately
unauthorized.
`TASK-0027` (W5 bounded production release correction, `DEC-0133`) was
**EXECUTED on 2026-08-12** by DeepSeek in PI and **STOPPED `BLOCKED` at
remote precondition 6 before any production mutation**: the runtime venv
`pip check` fails deterministically (`fastapi 0.141.0` requires
`starlette>=0.46.0`, runtime has `starlette 0.44.0`; the release payload
pins `fastapi==0.136.3`). Local release preparation completed (exact commit
archive `59101b80…db86`, SHA-256
`c856aa8c8164c26b8f232a487706bb4ae0b3d4beb383050949238c15feb39fc9`,
extracted-tree compile OK, Alembic head
`0005_opportunity_reminders_ai_reasoning` only). **No production write,
backup, transfer, migration, restart, or liveness probe occurred; no log
command ran; no secret was accessed.** Evidence:
`docs/evidence/TASK-0027-W5-PRODUCTION-RELEASE-20260812.md`; execution
record: `docs/evidence/TASK-0027-DEEPSEEK-PI-EXECUTION-20260812.md`.
Awaiting Codex independent review; W5 release execution, G7, V1, and R2
remain PENDING and separately unauthorized.
`TASK-0028` (production runtime dependency-audit package, `DEC-0134`) was
**EXECUTED on 2026-08-12** by DeepSeek in PI (result `HANDOFF-ONLY`) and
**awaits Codex independent review**. TASK-0028A established the local
fixed-release dependency baseline (`[VERIFIED]`: no complete transitive
lock and no wheel-hash manifest in the fixed source; fixed `pyproject.toml`
SHA-256 `93b3f4bf…d09195`). TASK-0028B obtained the no-log read-only
runtime inventory over strict SSH (identity `ubuntu`/`VM-0-17-ubuntu`
passed; `pip check` FAILED exit 1 deterministic; 12-name metadata
inventory complete; production `pyproject.toml` hash identical to the
fixed-release file). TASK-0028C produced the difference analysis and
exactly one minimum safe `[PROPOSAL]` (post-authorization resolved
lock/hash-verified wheel manifest from the fixed source → isolated
immutable environment rebuild → validation → service switch only under a
separate authorized deployment task; no in-place production venv surgery).
Dependency repair, service restart, migration, deployment, and production
acceptance remain unverified and unauthorized; no log command ran; no
production write occurred. Evidence:
`docs/evidence/TASK-0028A-LOCAL-RELEASE-DEPENDENCY-BASELINE-20260812.md`,
`docs/evidence/TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY-20260812.md`,
`docs/evidence/TASK-0028C-DEPENDENCY-DIFFERENCE-AND-REMEDIATION-PROPOSAL-20260812.md`;
execution record: `docs/evidence/TASK-0028-DEEPSEEK-PI-EXECUTION-20260812.md`.

| Order | Task | Type | Proposed owner | Prerequisite / gate |
|---|---|---|---|---|
| 1 | `active/TASK-0014-core-semantic-security-closure.md` | IMPLEMENTATION | DeepSeek | `DEC-0092`; TASK-0009 accepted |
| 2 | `active/TASK-0010-search-security-verification.md` | IMPLEMENTATION | GLM (activated, `DEC-0098`/`DEC-0099`) | `DEC-0089`; TASK-0009 and TASK-0014 accepted — gate met |
| 3 | `active/TASK-0015-user-role-management.md` | IMPLEMENTATION | GLM (activated, `DEC-0102`) | `DEC-0089`; TASK-0014 accepted — gate met |
| 4 | `active/TASK-0017-data-lifecycle-erasure.md` | IMPLEMENTATION | GLM (activated, `DEC-0105`) | `DEC-0089`; TASK-0014/0015 accepted; OD-001 resolved (`DEC-0104`) — gate met |
| 5 | `active/TASK-0011-bulk-import-capability.md` | IMPLEMENTATION | GLM (activated, `DEC-0108`) | `DEC-0089`; TASK-0009 and TASK-0017 accepted — gate met |
| 6 | `proposed/TASK-0016-opportunity-discovery.md` | IMPLEMENTATION | DeepSeek after ownership release | `DEC-0089`; TASK-0010 and TASK-0015 accepted; OD-005/006 stop gate |
| 7 | `active/TASK-0018-deployment-operations-evidence.md` | IMPLEMENTATION / ACCEPTED (LOCAL SYNTHETIC ONLY) | DeepSeek-v4-flash in PI (`DEC-0121`); Codex independent acceptance (`DEC-0125`) | `DEC-0089`; local-only operations evidence passed; PostgreSQL-gated, remote/deployment, production/shared-data, and human acceptance separately NOT VERIFIED |

The complete order, gap evidence, stop conditions, and report contract are in
`docs/evidence/SPEC-COMPLETION-ROADMAP-20260805.md`.

## Superseded proposals

| Task | Reason |
|---|---|
| `TASK-0001-manual-core-record-activity.md` | Written against `ADR-0001` (local-first, SQLite) and the `DEC-0011` freeze; replaced by the `ADR-0002` version under `active/` |
| `proposed/TASK-0004-fix-query-service.md` | Incorrect root cause and unauthorized deployment assumptions; superseded by TASK-0006 through TASK-0010 after the 2026-07-31 takeover review |
| `proposed/TASK-0005-credential-containment.md` | Cancelled by product-owner correction `DEC-0061`; plaintext concerns are excluded from this review and dispatch |

## Closed

| Task | Closed at | Result |
|---|---|---|
| `active/TASK-0006-governance-evidence-reconciliation.md` | 2026-08-02 | Final reconciliation accepted by Kimi-K3 (`DEC-0066`); evidence: `docs/evidence/TASK-0006-FINAL-BATCH-KIMI-ACCEPTANCE.md`; card file retained under `active/` for path stability |
