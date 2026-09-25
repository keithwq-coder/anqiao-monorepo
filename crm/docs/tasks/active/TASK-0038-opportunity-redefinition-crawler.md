# TASK-0038: 商机重定义 + 网络爬虫

- Task ID: TASK-0038
- Status: **COMPLETE** for the covered slice. Codex independent review
  re-affirmed by zcode/GLM-5.2 STEP-3 batch on 2026-08-24 (DEC-0165). The
  residual "old v0.3.0 reminder cleanup" item is COMPLETE under TASK-0039
  with `0013_drop_legacy_opportunity_reminders` (migration applied on prod
  during TASK-0041 P2). The OD-006a real LLM leg is COMPLETE under
  TASK-0041 P1 with verified real `glm-5.2` egress. Was: ACTIVE / PARTIAL
  (`DEC-0155`).
- Formal disposition: product owner accepted the PARTIAL result on 2026-08-21; STEP-3 carry-forward + the v0.3.0 cleanup migration + the real LLM rollout close the remaining items on 2026-08-24.
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0154`（产品负责人 2026-08-13 回复「授权」）
- Execution owner: DeepSeek-v4-flash（产品负责人切换后执行）
- Review/acceptance owner: DeepSeek-v4-pro（独立评审，不自批）
- Audit started at: 2026-08-13 Asia/Shanghai
- Depends on: TASK-0036（角色/可见性）、TASK-0037（公池：新主体落点）

## Goal

实现 `SPEC-0003 v0.4.0`：商机 = AI 给候选 + 理由、人最终裁定；两个信息源（现有
客户 + 网络爬虫）；落点（老客户命中通知负责人 / 新主体进公池）；爬虫抓取结果留存
30 天。

## Scope

- 规则：R-001~R-004（候选+理由+人裁定）、R-005/R-006（两个来源）、R-007/R-008
  （落点）、R-009~R-013（脱敏/反推/泄露扫描硬边界）、R-014~R-017（审计/降级/可追溯）。
- 验收标准：AC-001~AC-010。
- 注意：OD-006a（模型/提供方）未定；验证用合成数据，真实爬虫抓取/出境在单独
  授权前不执行。

## Owned files

- `src/crm/application/discovery.py`（重定义候选、来源、落点、人裁定状态）
- `src/crm/web/routes/discovery.py`
- 新增爬虫模块（公开招投标/集采公告，留存 30 天；查重只做候选+相似度提示）
- `src/crm/policy/projection.py`（gm 商机脱敏只读）
- `tests/`（候选/来源/人裁定/落点/泄露扫描/降级/审计）

## Non-goals

- 不自动建档、不自动「转正」、不把外部主体直接建为客户（守防幻觉边界）。
- 真实爬虫抓取、外部模型调用、出境在单独授权前不执行（仅合成数据）。
- 不 commit / push / reset。

## Assumptions and unknowns

- [VERIFIED] 现有 `discovery.py` 实现 v0.3.0「本地规则 + AI 只写理由」模型；本任务
  重定义为「AI 给候选+理由、人裁定」，需重构而非增量。
- [UNKNOWN] 具体 AI 模型/提供方与爬虫服务（OD-006a）；实施可用合成桩，边界留待
  产品负责人点名。

## Prerequisites and completion gate

- 本地 pytest 通过。
- `python -m compileall` 通过。
- `git diff --check` 通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` 通过。

## Risks and rollback

- 展示口脱敏约束不因引入爬虫/出境口降低（R-013 硬边界）；任何 AI 文本展示前必须
  过泄露扫描。
- 真实爬虫/出境在单独授权前必须硬禁用，仅合成数据可验证。

## Evidence and result

- Status: PARTIAL（核心「AI 候选 + 人裁定」+ 爬虫桩 + 30 天留存 + 采纳进公池 +
  R-013 泄露扫描 + R-009 gm 脱敏只读视图 完成并验证）
- Commands actually run:
  - `pytest tests -q` → 全量回归绿色（见 `docs/evidence/TASK-0038-IMPLEMENTATION-20260813.md`）
  - `python -m compileall -q src tests migrations` → exit 0
  - `git diff --check` → exit 0
  - `scripts/check-governance.ps1` → `[PASS]`
- Result artifacts:
  - `docs/evidence/TASK-0038-IMPLEMENTATION-20260813.md`
  - `tests/test_task0038_opportunity_candidates.py`（8 用例）
  - `migrations/versions/0012_opportunity_candidates.py`
  - 新增：persistence.models.OpportunityCandidateModel、
    persistence/opportunity_candidate_repository.py、
    application/opportunity.py（OpportunityService + leak_scan）、
    web/routes/discovery.py 候选端点 + gm 管理视图
- Remaining:
  - 旧 v0.3.0 提醒基建/测试（opportunity_reminders、v0.3.0 DiscoveryService、
    test_task0020/0021）的取代清理
  - 真实爬虫/出境（OD-006a 开放授权门）
- Not verified: 生产迁移、独立评审（DeepSeek-v4-pro）
