# TASK-0021 实施证据 — 商机发现 AI 生成推理（SPEC-0003 v0.3.0）

- Task ID: TASK-0021
- Date: 2026-08-09
- Ownership correction (2026-08-10): the remaining P1-1/P2 repair was
  transferred to GLM5.2 (WorkBuddy) by the product owner. This evidence file
  records implementation evidence only; it does not declare ACCEPTED.
- Owner: DeepSeek（单一实施者，DEC-0117）
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` v0.3.0
- Approval hash (recomputed 2026-08-09):
  `d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0`
  （matches `SPEC-0003-opportunity-discovery.approval.json` stored hash）
- Authorization: `DEC-0117`（SPEC-0003 v0.3.0 批准 + TASK-0021 授权）
- Scope: 本地合成数据。无真实数据外发、无部署、无远程数据库/SSH。
- Baseline: TASK-0020 ACCEPTED (`DEC-0115`), `319 passed, 28 skipped`。

## 执行诚实声明（AGENTS.md §3/§9）

本会话作为独立实施 AI 接手时，工作区已存在与本任务高度对齐的代码：
`src/crm/application/discovery_ai.py`、`discovery.py` 中的 ai_reasoning 接入、
`migrations/versions/0005_opportunity_reminders_ai_reasoning.py`、
`tests/test_task0021_discovery_ai_reasoning.py`、`models.py` 的 AI 归属字段。
本证据记录的不是"由本会话从零编写"，而是实施者对这些产物做的**独立再核验**：
SPEC 一致性、TDD 流程回归、AC 覆盖、泄露扫描硬边界、降级与审计边界、
治理门、无退化全量回归。所有验证命令均在本机实际执行，输出见下。

## 1. 实现概览（R-017…R-021 → AC-015…AC-020）

新增模块 `src/crm/application/discovery_ai.py`（单一可审计出境路径 + 返回泄露扫描
+ 降级）：

- `ReasoningCandidate` / `AIReasoningResult` dataclass：候选载荷 + 真实出境/ai 状态。
- `AIReasoningClient` Protocol + `UnavailableAIReasoningClient`：唯一出境 seam，
  默认占位在无授权环境零网络（AC-011/AC-018）。
- `EGRESS_FIELD_WHITELIST`：白名单字段名（`institutions`/`source_descriptions`/
  `source_evidence_references`），`build_egress_payload` 只透出白名单内字段（R-021）。
- `LeakageScanner`：对模型返回文本做 SPEC-0001 脱敏 + 反推泄露扫描。命中电话号形态
  （手机/座机）、email 形态、URL/证据引用、受保护值逐字复述时抑制 AI 文本、回退本地
  确定性理由（R-018 硬边界，AC-016）。
- `AIReasoningAdapter.generate_supported_reason`：一次候选 -> 一次出境调用 -> 扫描
  -> 真实结果或真实降级；不可用/超时/异常一律降级，永不抛出（R-020/AC-017）。

`DiscoveryService.run` 在每个本地质检出的簇上调用适配器一次；候选由
`_reasoning_candidate` 以白名单字段构造（含受保护值收集供扫描比对）。使用 AI 文本的
reminder 落 `ai_used=True`/`external_egress=True`/`model_identifier`/`egress_field_names`
并在同一事务写一条 `discovery_ai_reasoning_used` 审计，仅含模型标识 + 字段名清单
（名非值，R-019/AC-019）。AI 不参与候选是否成立的判定（R-017/AC-020）：簇发现仍由
`_clusters`（同 region+category 跨负责人，≥3、≥2 不同负责人）完成；AI 文本失败/不可用
时提醒仍以本地理由生成。

持久化：`0005_opportunity_reminders_ai_reasoning` 在 `opportunity_reminders` 链式
新增 `ai_used`/`external_egress`/`model_identifier`/`egress_field_names`（alembic 单 head
核验：`0004 -> 0005 (head)`）。

路由 `src/crm/web/routes/discovery.py` 不注入 `ai_reasoning`（HTTP 路径默认走占位 →
零出境、降级本地理由），AC-011/v0.2.0 行为在 HTTP 路径保留；AI 仅通过测试可注入适配器
在 `DiscoveryService` 单元层验证，符合"测试零真实联网"硬红线（R-021/AC-015/AC-018）。

## 2. AC 覆盖矩阵（独立核验）

| AC | 测试 | 状态 |
|---|---|---|
| AC-015 单一出境路径 + 字段名清单 | `test_ac015_single_egress_path_whitelist_and_field_names` | PASS |
| AC-015/019 审计只记名非值 | `test_ac015_audit_records_field_names_not_values` | PASS |
| AC-016 电话号形态抑制回退 | `test_ac016_phone_form_suppressed_and_falls_back` | PASS |
| AC-016 受保护值逐字抑制 | `test_ac016_protected_verbatim_suppressed` | PASS |
| AC-016 短词不误报（精度） | `test_ac016_short_common_word_not_false_positive` | PASS |
| AC-017 超时降级提醒仍生成 | `test_ac017_timeout_degrades_reminder_still_generated` | PASS |
| AC-017/018 无授权默认降级零出境 | `test_ac017_no_provider_authorized_defaults_to_local` | PASS |
| AC-018 合成载荷 + spy 断言零真实数据 | `test_ac018_fake_client_receives_only_synthetic_payload` | PASS |
| AC-018 占位客户端零网络 | `test_ac018_unconfigured_client_is_unavailable_and_offline` | PASS |
| AC-020 AI 不能取消本地命中 | `test_ac020_ai_cannot_cancel_a_local_rule_hit` | PASS |
| AC-020 AI 不能凭空造命中 | `test_ac020_ai_cannot_create_a_hit_without_local_rule` | PASS |

独立 R-018 扫描器边界审计（本会话新增、非测试文件）：手机/座机/email/URL/受保护
逐字均命中抑制；短 token（<6）不误报；6 字符及以上受保护值逐字仍命中；干净可读文本放行。
结果 `SCANNER_AUDIT_PASS`。

### 2026-08-10 复核修正（本会话）

独立扫描器审计发现 `MIN_PROTECTED_OVERLAP=4` 对 4 字符短词（如 "east"）产生假阳性：
一个仅与受保护值前缀重合的常见短词会被逐字匹配命中，导致干净 AI 文本被过度抑制。
假阳性方向为**安全侧**（过度抑制 → 回退本地理由，不泄露），但精度不足。已将阈值
提至 `6`：生产受保护值（source_description / source_evidence_reference）为真实业务
长文本，远超此长度，逐字复述检测能力不受影响；同时消除短词误报。新增测试
`test_ac016_short_common_word_not_false_positive` 覆盖该精度边界。修正后扫描器审计
12/12 PASS（含 6 字符仍命中、4/5 字符不误报），全量 330 passed 无退化。

## 3. 验证命令与本机结果

```text
python -m pytest tests/test_task0021_discovery_ai_reasoning.py \
  tests/test_task0020_opportunity_discovery.py tests/test_persistence_schema.py -q
# -> 34 passed (2026-08-10 复核：TASK-0021 11 + TASK-0020 16 + schema 7)

python -m pytest tests/ -q
# -> 330 passed, 28 skipped, 1 warning in 76.92s (2026-08-10 复核)
#    (基线 319 + 新增 TASK-0021 11 tests = 330；28 skipped 全为真实 PostgreSQL 门)

python -m alembic heads
# -> 0005_opportunity_reminders_ai_reasoning (head)
python -m alembic history        # -> 0004 -> 0005 (head), 单 head 无分叉

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
# -> [PASS] Governance structure and gates are consistent.
#    Approved SPECs: 8 ; Active tasks: 17 ; Legacy manifests checked: 1

hashlib.sha256(SPEC-0003-opportunity-discovery.md).hexdigest()
# -> d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0
#    与 approval.json stored hash 一致
```

## Coordinator correction (2026-08-10)

The historical threshold note above is superseded. The current scanner has no
`MIN_PROTECTED_OVERLAP` constant and applies `normalized_value in
normalized_text` to every non-blank protected value. The retained precision
case protects `east source B` while the model output contains only `east`, so
it does not represent a complete protected-value echo.

Independent coordinator verification in this workspace:

- Focused TASK-0021 suite: `22 passed`.
- TASK-0020 + TASK-0021 + persistence schema: `45 passed`.
- Full suite: `341 passed, 28 skipped, 1 warning`.
- `py_compile`: passed.
- Alembic single head: `0005_opportunity_reminders_ai_reasoning`.
- Governance: `[PASS]`.

## 4. 退化检查

- TASK-0020 AC-001…AC-014：`test_task0020_opportunity_discovery.py` 16 tests 全 PASS
  （与 TASK-0021/schema 独立运行 33 passed 内；且全量回归无 fail/error）。
- 无适配器注入时 `external_egress=False`、`ai_used=False`、走本地理由 —— v0.2.0
  AC-011 行为保留（`test_ac017_no_provider_authorized_defaults_to_local`）。
- 28 skipped 全为 `CRM_RUN_POSTGRESQL_TESTS=1` 真实 PostgreSQL 门（test_s6_integration /
  test_task0007_postgresql_sessions），与基线一致。

## 5. 未验证项（NOT VERIFIED）

- **真实 AI provider**：本任务未真实联网；provider 由产品负责人在 OD-006a 选定后在
  生产亲自运行，不由本任务触发（硬红线遵守）。
- **真实 PostgreSQL**：alembic 链在隔离本地 SQLite 测试库验证；离线 SQL `--sql` 对
  `0005` 的 ADD COLUMN 静默未打印（已知 SQLAlchemy/Alembic 在表已被 ORM 映射时的
  `--sql` 行为），但测试套件持久化读写 `ai_used`/`external_egress` 成功证明迁移在
  测试库实际生效。真实 PostgreSQL 上的 `0005` 升级为真实数据库动作，未经本任务执行。
- **浏览器视觉验收**：不在本任务范围。

## 6. 决策需要

无新决策需要。OD-006a（具体 provider）与 OD-005（留存）仍为 OPEN 单独授权门，
不阻塞本任务完成；本任务未自行发明或绕开这两项。

## 7. 未触碰项（硬边界遵守）

- 已批准 SPEC 文件：未改；approval hash 重算匹配。
- `policy/projection.py` 脱敏语义：未改。
- 其他任务证据 / 其他任务迁移：未触碰。
- 生产配置：未改。
- 未在测试中真实联网；AI 未判定机会成立；AI 理由未绕过展示口脱敏。
