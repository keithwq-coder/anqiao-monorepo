# HANDOFF — TASK-0021 商机发现 AI 生成推理（SPEC-0003 v0.3.0）

- Date: 2026-08-08
- Ownership correction (2026-08-10): the remaining P1-1/P2 repair is formally
  transferred to GLM5.2 (WorkBuddy) by the product owner. The transfer covers
  only `src/crm/application/discovery_ai.py` and
  `tests/test_task0021_discovery_ai_reasoning.py`.
- From: Coordinator
- To: GLM5.2（WorkBuddy；2026-08-10 接手剩余 P1-1/P2 修复；原始实现者 DeepSeek）
- Authorization: `DEC-0117`（SPEC-0003 v0.3.0 批准 + TASK-0021 授权）
- Scope: 本地合成数据。无真实数据外发、无部署、无远程数据库/SSH。

## 授权链（执行前自行复核，勿轻信本文件）

1. `SPEC-0003 v0.3.0` 已批准（`DEC-0117`），approval hash:
   `d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0`
   —— 执行前用 `hashlib.sha256` 对
   `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md` 重算比对。
2. `DEC-0116`（OD-006 决定：AI 方法 + 完整出境）、`DEC-0117`（批准 + 授权）
   均在 `docs/decisions/DECISION-LOG.md`。
3. 基线：`319 passed, 28 skipped`（TASK-0020 已验收）。
4. 现行实现在 `src/crm/application/discovery.py` 与
   `src/crm/web/routes/discovery.py`（v0.2.0 本地确定性规则，已验收）。

## 本任务是"在已验收 v0.2.0 实现之上做增量"

不要重写 TASK-0020 的发现逻辑。候选检测（同 region+category 跨负责人
聚类）、脱敏 involved_records、路由、幂等、抑制——全部保留。本任务只加
一层：**用外部 AI 把已产生的候选表述成更可读的理由文本**，并守住 R-017…
R-021 的新边界。

## 必须实现（SPEC-0003 v0.3.0 新增 R-017…R-021 / AC-015…AC-020）

1. **AI 推理适配器**（新模块，单一出境路径，白名单式构造载荷）：
   - 输入：一条候选的字段（按 DEC-0116 完整出境，可含业务原文）。
   - 输出：一段自然语言"支持理由"。
   - AI **不判定**机会是否成立（R-017/AC-020）——成立与否仍由本地可追溯
     关联决定；AI 只生成解释文本。
2. **返回泄露扫描（R-018，硬边界，AC-016）**：AI 返回文本在落库/展示前
   必须再过一次 SPEC-0001 脱敏 + 反推扫描。含电话号形态、被判定为原始
   跟进正文/客户原话/证据引用的内容 → 抑制该 AI 文本，回退本地确定性理由。
   **给 A 看的提醒绝不能因 AI 生成而泄露 B 负责人的受保护字段。**
3. **降级（R-020，AC-017）**：模型不可用/超时/返回不合规 → 回退本地理由，
   提醒仍生成，`ai_used`/`external_egress` 状态如实标注，不伪造、不阻塞。
4. **审计边界（R-019，AC-019）**：使用 AI 理由的提醒审计记录"模型标识 +
   外发字段名清单（字段名，非值）"；不得写入任何受保护值、API key、
   完整外发载荷。
5. **出境集中 + 密钥（R-021，AC-015）**：所有对外调用集中在单一可审计
   代码路径；API key 是运行时机密，从环境读取，不入仓库/日志/审计/测试。

## OD-006a（模型/提供方）——本任务如何处理

- provider 仍 OPEN。**验证阶段只用合成数据**，且**不真正联网**：用一个
  可注入的 AI 客户端接口 + 测试替身（fake）覆盖成功/超时/泄露返回/降级
  各路径。生产真实 provider 由产品负责人另行选定，不在本任务触发真实外发。
- 适配器要设计成 provider 可插拔（接口 + 一个默认实现占位），但测试
  一律走 fake，零真实网络调用。

## 允许修改的文件（Owned paths）

- 新建 `src/crm/application/discovery_ai.py`（AI 适配器 + 泄露扫描 + 降级）
- 修改 `src/crm/application/discovery.py`（在生成 supporting_reason 处接入
  适配器；保留本地理由作为降级）
- 如需持久化 `ai_used`/模型标识/外发字段名清单：新建一个 Alembic 迁移
  （chained 在 `0004_opportunity_reminders` 之后）+ 相应 model 字段
- 修改 `src/crm/persistence/opportunity_repository.py`（如需新字段）
- 新建 `tests/test_task0021_discovery_ai_reasoning.py`（AC-015…AC-020）
- 新建 `docs/evidence/TASK-0021-IMPLEMENTATION-{日期}.md`
- 更新本任务卡与 `tests/test_persistence_schema.py`（若加字段/表）

不得触碰：已批准 SPEC、其他任务证据、其他任务迁移、生产配置、
`policy/projection.py`（脱敏矩阵是既有已批准行为）。

## 完成门 / 关键节点

- TDD：先写 `tests/test_task0021_discovery_ai_reasoning.py` 覆盖
  AC-015…AC-020（含 fake 客户端的成功/超时/泄露返回/降级），跑红灯，
  再实现变绿。
- 全量 `python -m pytest tests/ -q` 无退化（基线 319 passed, 28 skipped）。
- `scripts/check-governance.ps1` → `[PASS]`。
- SPEC-0003 approval hash 重算匹配。
- 写完证据文件后，向协调员发关键节点 1 汇报（格式见任务简报）。

## 硬红线

- **零真实网络调用**：测试全部走 fake 客户端。真实 provider/真实外发是
  产品负责人生产动作，不在本任务发生。
- R-018 泄露扫描是硬边界：出境口放开，展示口脱敏不降低。
- 若发现方法选择实质改变 SPEC-0003 v0.3.0 未定义的产品行为，停止、
  在证据文件写明 UNKNOWN、进入关键节点报告，不得自行发明。
