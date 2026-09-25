# TASK-0038 执行证据（商机重定义核心：AI 候选 + 人裁定；PARTIAL）

- Task: TASK-0038（SPEC-0003 v0.4.0：商机重定义 + 网络爬虫）
- Executed by: DeepSeek-v4-flash（2026-08-13）
- Authority: `DEC-0153`（SPEC 批准）、`DEC-0154`（实现授权）、`DEC-0152`（爬虫留存 30 天）
- Scope: 本地合成数据；不碰生产、不 commit；真实爬虫/出境受 OD-006a 门控
- Status: **PARTIAL** —— 核心「AI 候选 + 人裁定」重定义完成并验证；旧 v0.3.0 提醒
  基建的取代清理、AI 文本泄露扫描（R-013 硬边界补充）、gm 脱敏商机只读视图、真实
  爬虫/出境（OD-006a）剩余

## 已完成（验证通过）

### 商机重定义：AI 候选 + 理由、人最终裁定（R-001..R-004, R-017）
- `src/crm/persistence/models.py`：新增 `OpportunityCandidateModel`（表
  `opportunity_candidates`）：source（existing_customer/crawler）、status
  （待处理/采纳/忽略，人裁定）、candidate_text、supporting_reason、key_uncertainties、
  involved_records（老客户）/external_subject（爬虫新主体）、expires_at（爬虫 30 天）、
  ai_used、adjudicated_at/by。CHECK：source/status 三值、reason 非空。
- `migrations/versions/0012_opportunity_candidates.py`（新增）：建表 + 索引；
  FK 用短名（fk_candidates_*）避免超过 PostgreSQL 63 字节标识符限制。
- `src/crm/persistence/opportunity_candidate_repository.py`（新增）：候选读写 + 裁定。
- `src/crm/application/opportunity.py`（新增）：`OpportunityService`
  - `run()`：从两来源生成候选——
    ① existing_customer：跨负责人同区域/类别簇信号，AI 措辞候选+理由（合成桩）；
    ② crawler：合成爬虫桩（真实源受 OD-006a），30 天 expiry。
  - `adjudicate()`：人裁定 采纳/忽略（AI 无最终判定）；采纳爬虫新主体 → 释放到公池
    （新建 owner NULL + in_pool 客户记录，customer_type=direct_purchase），
    老客户候选保持为通知；均写审计。
- `src/crm/web/routes/discovery.py`：新增 `/candidates/run`、`/candidates`、
  `/candidates/{id}`、`/candidates/{id}/adjudicate` 端点。

### 关键行为
- AI 绝不自动建档（R-003/R-017）：候选保持「待处理」直到人裁定（测试覆盖）。
- 爬虫候选 30 天留存（OD-001/DEC-0152）：expires_at = 创建 + 30 天（测试覆盖）。
- 采纳新主体 → 进公池，业务人员可认领（复用 TASK-0037 公池模型）。

## 测试

- 新增 `tests/test_task0038_opportunity_candidates.py`（5 用例）：
  run 生成老客户候选（ai_used=synthetic-stub）、爬虫候选 30 天留存、裁定「忽略」、
  裁定「采纳」爬虫 → 进公池、AI 绝不自动建档。
- `test_persistence_schema.py`：EXPECTED_TABLES 加 `opportunity_candidates`；
  标识符长度约束通过。

## 验证结果（实际运行）

| Check | Result |
|---|---|
| 全量本地 pytest | 见全量回归（后台运行后确认） |
| `python -m compileall -q src tests migrations` | exit 0 |
| `git diff --check` | exit 0 |
| `scripts/check-governance.ps1` | `[PASS]` |
| `test_task0020`/`test_task0021`（v0.3.0） | 39 passed（新增能力叠加，未破坏旧提醒） |

## 已完成的硬边界与可见性（R-013 / R-009）

- **R-013 泄露扫描**：`opportunity.py` 新增 `leak_scan()`/`resembles_phone()`；
  AI 生成理由在落库/展示前过扫描，命中（电话号形态 / 其他负责人受保护字段回显）时
  抑制并回退到净化理由（`ai_used=False`）。支持注入 `reason_generator` 以便用"泄露型
  AI"验证。测试：`test_leak_scan_detects_phone_and_protected_values`、
  `test_leaky_ai_reason_is_suppressed_by_r13`。
- **R-009 gm 脱敏只读商机视图**：`OpportunityService.list_desensitized()` +
  `GET /api/discovery/candidates/management`（gm/admin），只返回安全字段
  （id/source/status/candidate_text/时间戳），剔除 reason/involved_records/
  external_subject。测试：`test_gm_desensitized_management_view`。

## 剩余工作（下轮/后续）

1. **旧 v0.3.0 提醒基建取代**：`opportunity_reminders` 表、v0.3.0 DiscoveryService、
   test_task0020/0021 —— v0.4.0 已取代该模型，需迁移测试后移除（删除会破坏现有测试，
   故本轮叠加保留）。
2. **真实爬虫/出境（OD-006a）**：开放授权门，当前仅合成桩（`SYNTHETIC_AI_MODEL`）。

## 边界

- 未 commit / push / reset。
- 未碰生产；真实爬虫/外部模型调用在单独授权前硬禁用。
- NOT SELF-ACCEPTED；待 DeepSeek-v4-pro 独立评审。
