# TASK-0037: 客户三类型 + 公池 + 术语统一「客户」

- Task ID: TASK-0037
- Status: ACTIVE / ACCEPTED (local synthetic-data scope; `DEC-0155`)
- Formal acceptance: product owner accepted the Codex independent review on 2026-08-21.
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0154`（产品负责人 2026-08-13 回复「授权」）
- Execution owner: DeepSeek-v4-flash（产品负责人切换后执行）
- Review/acceptance owner: DeepSeek-v4-pro（独立评审，不自批）
- Audit started at: 2026-08-13 Asia/Shanghai
- Depends on: TASK-0036（角色模型：公池认领/进池依赖四角色定义）

## Goal

实现 `SPEC-0001 v0.8.0`：客户类型三值字段（直接采购 / 个人 / 渠道）+ 公池（无主
状态、进池/认领）+ 术语统一为「客户」。

## Scope

- 规则：R-037（客户类型必填三值）、R-038（个人仅预留）、R-039（渠道纯标签）、
  R-039a（类型可改留痕）、R-040~R-045（公池：owner 可空 + 在池、进池、认领、
  脱敏投影）。
- 验收标准：AC-030~AC-039。
- 术语：产品展示统一「客户」；内部表名/代码/历史数据中「机构」叫法是否同步迁移
  属实现细节（SPEC-0001 OD-001），不改变产品行为。

## Owned files

- `src/crm/domain/models.py`（客户类型枚举；owner 可空 + 在池状态）
- `src/crm/persistence/models.py`（institution 模型加 customer_type、owner 可空）
- `src/crm/policy/projection.py`（公池脱敏投影：owner 为空的可见性单独定义）
- `src/crm/application/queries.py`、`src/crm/application/management_commands.py`
  （认领、进池、类型变更留痕）
- `src/crm/web/routes/institutions.py`、`templates/`（客户类型字段、术语「客户」）
- `migrations/versions/`（customer_type 列、owner 可空、在池状态）
- `tests/`（客户类型、公池、脱敏投影）

## Non-goals

- 不启用「个人」类型流程（仅预留类型值，不接 PII）。
- 不做「渠道」层级/佣金。
- 不动商机（TASK-0038）、角色（TASK-0036）。
- 不 commit / push / reset。

## Assumptions and unknowns

- [VERIFIED] 现有主记录为 `institutions`（owner 隐含 NOT NULL）；本任务改 owner
  可空 + 显式「在池」状态。
- [UNKNOWN] 「在池」状态用 owner 空 + 独立状态列，还是仅 owner 空判定——实现细节，
  由实施者选最小方案并测试。

## Prerequisites and completion gate

- 本地 pytest 通过。
- `python -m compileall` 通过。
- `git diff --check` 通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` 通过。

## Risks and rollback

- owner 置空会影响所有按 `owner_user_id == user.id` 的投影与统计；必须按 R-045
  为无主客户单独定义可见性，不得拒绝所有人或放开完整详情。
- 认领并发：两人同时认领须后到者失败，不产生双负责人。

## Evidence and result

- Status: COMPLETE
- Commands actually run:
  - `pytest tests -q` → `387 passed, 28 skipped`
  - `python -m compileall -q src tests` → exit 0
  - `git diff --check` → exit 0
  - `scripts/check-governance.ps1` → `[PASS]`
- Result artifacts:
  - `docs/evidence/TASK-0037-IMPLEMENTATION-20260813.md`
  - `tests/test_task0037_customer_type_pool.py`（11 用例）
  - `migrations/versions/0011_customer_type_and_public_pool.py`
  - 改动：domain/models.py、persistence/{models,repositories}.py、policy/projection.py、
    application/{commands,management_commands,queries}.py、web/main.py、
    web/routes/institutions.py、templates/*，
    以及 test_domain_models / test_persistence_schema / test_task0037 等测试
- This task also closes TASK-0036's cross-referenced R-027（进池）.
- Not verified: 生产迁移、独立评审（DeepSeek-v4-pro）
