# HANDOFF — TASK-0021 审计 + 架构决策（Kimi-K3）

- Date: 2026-08-10
- From: Coordinator（当前会话）
- To: Kimi-K3
- Role: **架构师 + 独立审计员**（不只是跑测试，是基于全局状态做架构判断和下一步决策）
- Handoff status: HANDOFF-ONLY
- Repository: D:\Project\中科安樵\crm
- Written at: 2026-08-10 13:40 GMT+8

---

## 0. 为什么是你

你在 2026-08-02 独立审计接受了 TASK-0006 最终批次（DEC-0066），对这个仓库的治理体系和证据链已有上下文。现在你需要再做一次类似的事——但范围更大：

1. **审计 TASK-0021**（SPEC-0003 v0.3.0 AI 生成推理）的实施是否可接受；
2. **俯瞰整个项目的当前状态**，判断还差什么才能算"本地合成范围内 SPEC 全覆盖实施完成"；
3. **给出下一步任务排序和架构判断**——哪些任务该启动、哪些该合并、哪些该作废、哪些需要产品负责人决策才能解锁。

你不是单纯的测试执行者。你的架构判断会直接决定项目接下来的走向。

---

## 1. 项目背景（如果你需要刷新记忆）

这是一个 SPEC-first 驱动的内部 B2B/G CRM 系统（养老机构客户管理）。

- 技术栈：FastAPI 模块化单体 + Jinja2 服务端渲染 + PostgreSQL/Alembic + Uvicorn/systemd + nginx，已部署在 https://crm.aibrain.wiki
- 治理规则：所有行为变更必须有已批准 SPEC 覆盖 + 活跃任务卡 + 显式授权
- 产品负责人不写代码，只做产品决策和验收
- 治理权威文件：AGENTS.md

---

## 2. 你必须先读的文件（按优先级）

### 2.1 治理与全局状态

- AGENTS.md — 仓库治理宪法
- docs/NOW.md — **当前控制面板，先读这个**
- docs/PROJECT.md — 项目事实与未知项
- docs/specs/INDEX.md — SPEC 索引
- docs/specs/SPEC-BASELINE.md — 基线完成状态
- docs/tasks/TASKS.md — 全部任务的状态索引
- docs/decisions/DECISION-LOG.md — 决策日志（5546 行，重点看 DEC-0089 之后的）
- docs/governance/DEVELOPMENT-SEQUENCE.md — 开发依赖排序（PROPOSAL，非权威）
- docs/governance/WORKFLOW.md — 人机协作工作流

### 2.2 TASK-0021 审计相关

- docs/specs/30-approved/SPEC-0003-opportunity-discovery.md — 被审计的 SPEC v0.3.0（权威）
- docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json — 批准元数据 + hash
- docs/tasks/active/TASK-0021-opportunity-discovery-ai-reasoning.md — 任务卡
- docs/evidence/TASK-0021-IMPLEMENTATION-20260809.md — 实施者自报告（**不采信，需自行核验**）
- docs/handoffs/HANDOFF-20260808-TASK-0021-DISCOVERY-AI-REASONING.md — 原始实施 handoff

### 2.3 被审计的代码

- src/crm/application/discovery_ai.py — 新增：AI 推理适配器 + 泄露扫描 + 降级
- src/crm/application/discovery.py — 修改：DiscoveryService 接入 AI 适配器
- migrations/versions/0005_opportunity_reminders_ai_reasoning.py — 新增迁移
- tests/test_task0021_discovery_ai_reasoning.py — 新增测试（声称 11 tests）
- src/crm/web/routes/discovery.py — 路由层（确认 HTTP 路径默认零出境）
- src/crm/persistence/models.py — 确认 AI 归属字段定义

### 2.4 退化检查基准

- tests/test_task0020_opportunity_discovery.py — TASK-0020 测试（16 tests，必须全 PASS）
- src/crm/policy/projection.py — 脱敏投影（**不得被修改**）

---

## 3. 当前项目全局状态（Coordinator 视角，供你校验）

### 3.1 SPEC 基线：8 个已批准

| SPEC | 版本 | 内容 |
|------|------|------|
| SPEC-0001 | v0.7.0 | 机构/联系人/跟进/可见性/审计/AI辅导 |
| SPEC-0002 | v0.2.0 | 用户/角色/所有权转移/管理只读 |
| SPEC-0003 | v0.3.0 | 商机发现（AI推理+完整出境） |
| SPEC-0008 | v0.1.0 | 搜索（最小披露，无导出） |
| SPEC-0011 | v0.2.0 | 数据生命周期（留存/擦除/备份） |
| SPEC-0012 | v0.2.0 | 云部署运维 |
| SPEC-0013 | v0.1.0 | 批量导入 |
| SPEC-0014 | v0.1.0 | 账号凭据自助修改 |

SPEC-0004~0007/0009/0010 已折叠或丢弃。基线 COMPLETE。

### 3.2 任务状态总览

**已验收 14 个**：TASK-0001(S1-S3+R1完成, S4部分, S5通过, S6接受, G5授权, G6待授权), TASK-5A, TASK-0006, TASK-0007, TASK-0008(已部署), TASK-0009, TASK-0010, TASK-0011(实施就绪), TASK-0012(已部署), TASK-0014, TASK-0015, TASK-0017, TASK-0019, TASK-0020

**进行中 1 个**：TASK-0021（实施完成，待你审计）

**未启动 2 个**：
- TASK-0016（商机发现）——已被 TASK-0020/0021 取代，可能可作废
- TASK-0018（部署运维证据）——依赖已满足，待激活

**当前测试基线**：声称 330 passed, 28 skipped（28 skipped 全为真实 PostgreSQL 门控）

### 3.3 关键未决项（需产品负责人决策，AI 无法自行决定）

1. **OD-006a**：AI 模型/提供方选择——SPEC-0003 v0.3.0 已批准完整出境方向，但具体用哪个 provider 未定
2. **OD-005**：商机发现提醒的留存期限
3. **G6 门控**：生产发布（systemd/nginx 资源清单与回滚计划，需独立授权）
4. **浏览器视觉验收**：TASK-0008/0012 已部署，但产品负责人反馈 UI 差距大
5. **真实 PostgreSQL 验证**：28 个 skipped 测试
6. **F3**：擦除范围——跟进自由文本中的人名是否需清理（产品/合规决策）

---

## 4. 第一项职责：审计 TASK-0021

### 4.1 授权链

- SPEC-0003 v0.3.0 批准 + TASK-0021 授权：DEC-0117（2026-08-08）
- OD-006 方向决定（AI 方法 + 完整出境）：DEC-0116
- 前置任务 TASK-0020 已验收：DEC-0115
- 实施所有者：DeepSeek（单一执行者）
- 实施范围：本地合成数据。无真实数据外发、无部署、无远程数据库/SSH。

### 4.2 审计检查清单

#### A. 授权链复核

1. SPEC-0003 v0.3.0 approval.json 中的 SHA-256 与文件实际 SHA-256 是否匹配
2. DEC-0117 是否确实批准了 SPEC v0.3.0 并授权 TASK-0021
3. SPEC-BASELINE.md Status 是否为 COMPLETE
4. 前置 TASK-0020 是否确实 ACCEPTED

#### B. 迁移链静态验证

1. alembic heads 是否为单一 head（0005_opportunity_reminders_ai_reasoning）
2. alembic history 链是否为 0001 -> 0002 -> 0003 -> 0004 -> 0005，down_revision 一致
3. 0005 迁移内容是否仅新增 ai_used / external_egress / model_identifier / egress_field_names
4. schema 测试白名单是否已含 opportunity_reminders 的新字段

#### C. 独立运行测试（核心，不采信执行者报告）

1. 聚焦测试：python -m pytest tests/test_task0021_discovery_ai_reasoning.py -q
   预期：11 passed
2. TASK-0020 退化检查：python -m pytest tests/test_task0020_opportunity_discovery.py -q
   预期：16 passed（AC-001 至 AC-014 无退化）
3. 全量回归：python -m pytest tests/ -q
   预期：330 passed, 28 skipped（基线 319 + 11 新测试）
   28 skipped 必须全为 CRM_RUN_POSTGRESQL_TESTS=1 真实 PG 门控
4. governance 检查：powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
   预期：[PASS]

#### D. AC 覆盖矩阵核验

逐条对照 SPEC-0003 v0.3.0 第 9 节，对 AC-015 至 AC-020 每一条找到对应测试，确认测试逻辑是否真正覆盖 AC 语义。

**AC-015（单一出境路径 + 字段名清单审计）**：
- 外发载荷是否只含白名单字段（institutions / source_descriptions / source_evidence_references）
- 审计记录是否只含字段名清单而非值
- 是否存在单一可审计代码路径（而非多处出境）

**AC-016（返回泄露扫描，R-018 硬边界，最重要）**：
- 模型返回含电话号形态（手机/座机）时是否抑制
- 模型返回含 email 形态时是否抑制
- 模型返回含 URL / 证据引用时是否抑制
- 模型返回含受保护值逐字复述时是否抑制
- 抑制后是否回退本地确定性理由
- 短词不误报（MIN_PROTECTED_OVERLAP=6 的精度边界）
- 重点审查：扫描器是否有绕过路径？是否存在 AI 文本未经扫描直接落库/展示的情况？

**AC-017（降级，模型不可用/超时/返回不合规）**：
- 超时时提醒是否仍生成
- 无 provider 时是否默认降级零出境
- ai_used / external_egress 状态是否如实标注
- 降级是否使提醒本身失败（不得失败）

**AC-018（验证环境零真实数据外发）**：
- 测试中是否用 fake / stub 客户端
- 是否存在任何真实网络调用的可能
- 占位客户端是否零网络

**AC-019（审计边界，无受保护值/key/完整载荷）**：
- 审计记录是否只含模型标识 + 字段名清单
- 是否含任何受保护值、API key 或完整外发载荷

**AC-020（AI 无机会判定权）**：
- AI 是否能取消本地规则的命中
- AI 是否能凭空造出本地规则未检出的命中
- 候选检测是否仍完全由 _clusters（同 region + category 跨负责人，>=3 簇、>=2 负责人）完成

#### E. 退化检查

1. TASK-0020 AC-001 至 AC-014 行为是否退化（16 tests 全 PASS）
2. 无适配器注入时 external_egress=False、ai_used=False、走本地理由
3. policy/projection.py 脱敏语义是否被修改（不得修改）
4. 已批准 SPEC 文件是否被修改（不得修改）
5. 其他任务的迁移文件是否被触碰（不得触碰）

#### F. 硬边界遵守

1. 测试中是否有任何真实联网调用（硬红线）
2. AI 是否参与机会成立判定（不得参与）
3. AI 理由是否绕过展示口脱敏（不得绕过）
4. API key 是否出现在代码/日志/审计中（不得出现）
5. 生产配置是否被修改（不得修改）

### 4.3 未验证项（如实标注，不需你执行但需在报告中明确）

- 真实 AI provider 调用（OD-006a 由产品负责人选定后在生产亲自运行）
- 真实 PostgreSQL 上的 0005 迁移升级（本任务只验证本地测试库）
- 浏览器视觉验收（不在本任务范围）

### 4.4 TASK-0021 审计结论格式

请对 TASK-0021 给出明确结论：ACCEPTED 或 REJECTED，附理由。
如果发现 P0/P1 问题，明确标注是源码问题还是测试问题，给出具体文件和行号。
审计报告写入 docs/evidence/TASK-0021-COORDINATOR-ACCEPTANCE-YYYYMMDD.md。

---

## 5. 第二项职责：架构判断和下一步决策（更重要）

审计 TASK-0021 之后，请俯瞰整个项目，给出你的架构判断。

### 5.1 你需要回答的问题

**问题 1：本地合成范围内，SPEC 全覆盖实施完成了吗？**

8 个已批准 SPEC 各自的实施状态是什么？哪些 SPEC 的全部 AC 已被已验收任务的测试覆盖？哪些还有缺口？

请逐 SPEC 列出：
- SPEC-0001：覆盖任务列表，是否有未覆盖的 AC
- SPEC-0002：同上
- SPEC-0003：同上（含 v0.3.0 新增部分）
- SPEC-0008：同上
- SPEC-0011：同上
- SPEC-0012：同上
- SPEC-0013：同上
- SPEC-0014：同上

**问题 2：TASK-0016 是否应该作废？**

TASK-0016（proposed，商机发现）的原始目标已被 TASK-0020（本地确定性发现）+ TASK-0021（AI 推理）覆盖。TASK-0016 是否还有存在价值？如果应该作废，请明确建议。

**问题 3：TASK-0018（部署运维证据）是否应该现在激活？**

它的前置依赖（TASK-0009, TASK-0014, TASK-0017）已全部满足。它闭合本地 fail-closed 运维契约（配置校验、备份/恢复记录、操作审计、回滚证据）。这是否是下一步最优先的实施任务？

**问题 4：TASK-0011（批量导入能力）状态是什么？**

TASKS.md 标注为实施就绪（IMPLEMENTATION-READY）。它到底是已实施完成待审计，还是尚未实施？如果已实施，是否需要独立审计？

**问题 5：哪些门控需要产品负责人决策，哪些可以 AI 自行推进？**

请把 3.3 节的 6 个未决项分成两类：
- AI 可以在本地合成范围内自行推进的
- 必须产品负责人决策才能解锁的

对于必须产品负责人决策的，请用平白语言（不涉及框架术语）说明：
- 需要决策什么
- 有哪些选项
- 你推荐哪个选项，为什么
- 不决策会阻塞什么

**问题 6：下一步任务排序建议**

基于以上分析，给出你建议的下一步任务执行顺序（1, 2, 3...），每个步骤说明：
- 做什么
- 为什么这个顺序
- 谁来做（哪个 AI 模型/工具）
- 什么条件下可以开始

### 5.2 架构判断输出格式

请写入 docs/evidence/ARCHITECTURE-REVIEW-20260810-KIMI-K3.md，结构：

1. TASK-0021 审计结论（ACCEPTED / REJECTED + 理由）
2. SPEC 覆盖矩阵（8 个 SPEC 逐条状态）
3. TASK-0016 处置建议（作废 / 保留 + 理由）
4. TASK-0018 激活建议（现在激活 / 等待 + 理由）
5. TASK-0011 状态澄清
6. 未决项分类（AI 可推进 vs 需产品负责人决策）
7. 下一步任务排序建议（含执行者分配）
8. 风险和注意事项

---

## 6. 硬红线（适用于两部分）

- 所有审计结论必须基于你独立运行/核验的结果，不采信执行者自报告
- 不得修改任何已批准 SPEC 文件
- 不得修改 policy/projection.py
- 不得触碰其他任务的迁移文件
- 不得执行真实数据外发、真实 AI provider 调用、部署、远程数据库操作
- 如果发现实施者改变了 SPEC 未定义的产品行为，停止并在报告中标注 UNKNOWN，把 SPEC 退回评审，不得自行发明

---

## 7. 完成后的汇报

完成两部分工作后，请向 Coordinator 发回：
1. TASK-0021 审计结论（ACCEPTED / REJECTED）
2. 架构判断报告路径
3. 下一步任务排序建议摘要

Coordinator 会根据你的结论决定：
- 是否发 DEC 接受 TASK-0021
- 是否激活 TASK-0018
- 是否作废 TASK-0016
- 哪些未决项需要提交产品负责人决策