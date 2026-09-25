# TASK-0021: SPEC-0003 v0.3.0 商机发现 AI 生成推理

- Task ID: TASK-0021
- Status: ACCEPTED (local synthetic scope; coordinator audit 2026-08-10,
  `DEC-0118`; evidence
  `docs/evidence/TASK-0021-COORDINATOR-ACCEPTANCE-20260810.md`)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`（v0.3.0）
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
  （hash 核验 2026-08-08: `d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0`）
- 也受约束于: `SPEC-0001`、`SPEC-0002`
- Implementation authorized by: `DEC-0117`（2026-08-08）
- Implementation owner: GLM5.2（WorkBuddy；剩余 P1-1/P2 修复由产品负责人于
  2026-08-10 明确转交；原始实现由 DeepSeek 完成）
- Coordinator/auditor: 当前协调员
- Depends on: TASK-0020（ACCEPTED, `DEC-0115`；v0.2.0 本地确定性发现已交付）

## Current ownership correction (2026-08-10)

The earlier DeepSeek owner entry is superseded for the remaining repair scope.
Per the product owner's explicit transfer, GLM5.2 (WorkBuddy) owns the P1-1
short protected-value leakage fix and its focused regression tests. Scope is
limited to `src/crm/application/discovery_ai.py` and
`tests/test_task0021_discovery_ai_reasoning.py`; no acceptance decision is
recorded by the implementation owner.

## Goal

在 TASK-0020 已交付的本地确定性发现之上，实现 SPEC-0003 v0.3.0 新增的
R-017…R-021：允许外部 AI 把"已由本地规则产生的候选关联"表述成更可读的
推理文本，同时用返回泄露扫描守住展示口脱敏边界。

## Owned paths（激活后独占）

- `src/crm/application/discovery.py`（在既有 DiscoveryService 上扩展 AI 推理）
- 新建 `src/crm/application/ai_reasoning.py`（唯一出境路径 + 返回泄露扫描）
- `src/crm/web/routes/discovery.py`（如需暴露 ai_used/降级状态）
- `src/crm/persistence/models.py` 与 `migrations/`（如需在 opportunity_reminders
  上加 `ai_used` / `external_egress` / 外发字段名清单等最小字段，新建 chained 迁移）
- `tests/test_task0021_discovery_ai_reasoning.py`
- `docs/evidence/TASK-0021-*` 与本任务卡

不得触碰：已批准 SPEC 文件、其他任务证据、其他任务迁移、生产配置、
`policy/projection.py`（脱敏投影是既有已批准行为）。

## Required acceptance（SPEC-0003 v0.3.0）

- R-017 / AC-020：AI 只生成解释文本，无机会成立判定权；候选检测与来源可
  追溯仍由本地规则完成。
- R-018 / AC-016：模型返回文本在落库/展示前必经 SPEC-0001 脱敏 + 反推泄露
  扫描；含电话号形态/原始跟进正文/客户原话/证据引用时抑制该 AI 文本并回退
  本地确定性理由。**硬边界：给无权接收者的展示绝不因 AI 生成而泄露。**
- R-019 / AC-019：使用 AI 理由的提醒审计记录"模型标识 + 外发字段名清单
  （名，非值）"；不含任何受保护值、API key 或完整外发载荷。
- R-020 / AC-017：模型不可用/超时/返回不合规 → 降级本地理由，提醒不失败，
  `ai_used` / `external_egress` 状态如实标注。
- R-021 / AC-015：出境调用集中在单一可审计白名单路径；API key 运行时机密，
  不入仓库/日志/审计。
- AC-018：验证环境零真实数据外发，只用合成数据（模型客户端在测试中被
  fake/stub，绝不真调外部）。

## Non-goals

- 不选定具体 provider 的商务合同（`OD-006a` 由产品负责人点名或实施在边界内
  选定并记录）；测试用 fake 客户端。
- 不真实调用外部模型、不外发真实数据（那是产品负责人选定 provider 后在
  生产亲自运行的独立动作）。
- 不改动 TASK-0020 已验收的本地确定性发现语义（AC-001…AC-014 不得退化）。
- 不引入 AI 对"是否真实机会"的判定权。

## Prerequisites and completion gate

- Prerequisites：TASK-0020 ACCEPTED（`DEC-0115`）；SPEC-0003 v0.3.0 approved
  （`DEC-0117`）；hash 匹配。全部满足。
- Completion gate：R-017…R-021 与 AC-015…AC-020 全部由聚焦合成测试覆盖，
  AC-001…AC-014 无退化；全量 `pytest tests/ -q` 从 `319 passed, 28 skipped`
  基线无退化；governance `[PASS]`；协调员独立审计接受。
- "本地 PostgreSQL" 腿若无隔离测试库则标 NOT VERIFIED + 确切剩余检查，
  绝不假设通过。

## Verification

聚焦 AI 推理/泄露扫描/降级/审计边界测试，全量回归，governance 检查，
本地合成验证。无真实模型调用、无真实数据外发、无远程数据库、无部署。
