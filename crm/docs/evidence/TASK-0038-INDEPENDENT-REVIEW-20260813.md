# TASK-0038 独立评审证据（DeepSeek-v4-pro）

- 评审身份：DeepSeek-v4-pro（`deepseek-v4-pro-0813`），独立评审角色，非本任务实现者。
- 评审依据：AGENTS.md §7（评审只报告证据与发现，不修改实现、不自我验收）。
- 评审对象：`docs/tasks/active/TASK-0038-opportunity-redefinition-crawler.md`（卡片状态 PARTIAL）
  对 `SPEC-0003 v0.4.0`（R-001..R-017 / AC-001..AC-010）的实现一致性。
- 评审日期：2026-08-13（与执行证据同窗期）。

## 结论

**PARTIAL（本地合成数据范围内）**

v0.4.0 的核心已落地并通过测试：候选（existing_customer / crawler 两来源）+ 人
裁定（待处理/采纳/忽略）+ R-013 泄露扫描 + crawler 30 天留存 + gm 脱敏只读视图 +
采纳 crawler 落公池。剩余两件已知事项维持 PARTIAL：(1) v0.3.0 提醒基础设施未清
理（`opportunity_reminders` 表、旧 `DiscoveryService`、旧 `/run`、`/reminders`
路由、`test_task0020/0021`），执行者采用「增量叠加」以不破坏既有测试；(2) 真实
爬虫/模型外呼仍被 OD-006a 硬门控，仅合成桩。二者均为卡片自述的「Not verified /
剩余工作」，与本评审一致。

## 证据明细

### 1. 候选模型与迁移（R-001/R-002/R-005）

- `[VERIFIED]` `src/crm/persistence/models.py` 新增 `OpportunityCandidateModel`
  （source / status / candidate_text / supporting_reason / key_uncertainties /
  involved_records / external_subject / discovered_at / expires_at / ai_used /
  model_identifier / adjudicated_at / adjudicated_by）。
- `[VERIFIED]` `migrations/versions/0012_opportunity_candidates.py`：建表 + 两外键 +
  `source IN ('existing_customer','crawler')` CHECK + `status IN
  ('待处理','采纳','忽略')` CHECK + 理由非空 CHECK + recipient/expiry 索引。

### 2. 候选生成（两来源，R-005/R-006/OD-001）

- `[VERIFIED]` `src/crm/application/opportunity.py` `OpportunityService.run()`
  ：existing_customer 按「同区域+同类别、≥MIN_CLUSTER_SIZE 条、≥MIN_DISTINCT_OWNERS
  个负责人」聚类；crawler 来源由注入的 `crawler_source`（合成桩）提供，
  `expires_at = 30 天`（`CRAWLER_RETENTION_DAYS=30`，OD-001）。
- `[VERIFIED]` `SYNTHETIC_AI_MODEL = "synthetic-stub"`，`reason_generator` /
  `crawler_source` 均为可注入合成桩；真实 provider/egress 未启用（OD-006a 硬门控）。
- `[VERIFIED]` `test_crawler_candidate_has_30_day_retention` 断言 30 天到期（±1h）。

### 3. R-013 泄露扫描

- `[VERIFIED]` `leak_scan()` / `resembles_phone()` 与
  `_PHONE_PATTERN = r"1[3-9]\d{9}"`；生成理由落库前先扫描，命中则回退到
  `_sanitized_reason`（仅区域/类别，不含他主保护值）并置 `ai_used=False`。
- `[VERIFIED]` `test_leak_scan_detects_phone_and_protected_values`、
  `test_leaky_ai_reason_is_suppressed_by_r13`（泄露理由被抑制、`ai_used=False`、
  出现「系统发现」兜底文案）。

### 4. 人裁定（R-003/R-007/R-008/R-017）

- `[VERIFIED]` `OpportunityService.adjudicate()` 仅接受「采纳/忽略」，AI 无最终
  判定；重复裁定 400；裁定写审计 `opportunity_candidate.adjudicate`。
- `[VERIFIED]` 采纳 crawler 新主体 → 新建公池客户
  （`InstitutionModel(owner=None, in_pool=True, customer_type="direct_purchase")`），
  与 SPEC-0003 v0.4.0 §5「爬虫为直接采购型」一致
  （`test_adjudicate_accept_crawler_lands_to_pool`）。
- `[VERIFIED]` AI 从不自动建档（`test_ai_never_auto_files`：运行后候选全部「待处理」）。

### 5. gm 脱敏只读视图（R-009）

- `[VERIFIED]` `list_desensitized()` 仅暴露 id/source/status/candidate_text/
  discovered_at/expires_at，隐藏 supporting_reason/involved_records/
  external_subject。
- `[VERIFIED]` `src/crm/web/routes/discovery.py:128-142`
  `/candidates/management` 仅 gm/admin 可访问，业务角色 403
  （`test_gm_desensitized_management_view`）。

### 6. 路由授权（R-010/R-011/R-015）

- `[VERIFIED]` `discovery.py` 新候选端点复用 `_require_discovery_recipient`
  （仅 business_user / administrator，默认拒绝）。

## 验证命令与结果（本次评审实际执行）

- `python -m pytest tests -q` → **395 passed, 28 skipped, 2 warnings**（exit 0，111.75s）。
  含 `tests/test_task0038_opportunity_candidates.py` 8 例全通过。
- `python -m compileall -q src tests migrations` → OK。
- `git diff --check` → clean。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` →
  `[PASS] Governance structure and gates are consistent`。

## 发现 / 风险（PARTIAL 的实质内容）

- `[VERIFIED]` **旧 v0.3.0 提醒基础设施仍在线**：`src/crm/web/routes/discovery.py`
  仍含旧 `/run`、`/reminders`、`/reminders/{id}` 路由，`crm.application.discovery
  .DiscoveryService` 与 `opportunity_reminders` 表保留，`test_task0020/0021` 未删。
  属执行者自述的「增量叠加」，是 TASK-0038 保持 PARTIAL 的直接原因。
- `[VERIFIED]` **真实爬虫/模型外呼未启用**：`crawler_source` / `reason_generator`
  均为合成桩注入，`_enabled_business_recipients()` 返回空列表（crawler 候选收件人
  回退为路由中的操作者本人，简化 stub）。真实来源需 OD-006a 决策后接入。
- `[UNKNOWN]` OD-006a（模型/供应商）未决议，真实 AI/爬虫能力不得启用——当前合成桩
  行为正确，但真实环境价值尚未验证。

## 未验证项（非本次授权范围）

- 生产数据库迁移执行（`0012`）——未对共享/生产库执行。
- 真实爬虫采集、真实 AI 模型与外部网络出口（OD-006a 硬门控，未启用）。

## 待决策项

- **OD-006a**：机会发现的模型/供应商选型（SPEC-0003 开放项）。在决策前不得启用
  真实 AI/爬虫，维持合成桩。

## 评审边界声明

本文件只记录证据与发现，不将 `TASK-0038` 翻转为 ACCEPTED，也不自行清理旧提醒
基础设施（须另行授权）；卡片验收由产品负责人作出。
