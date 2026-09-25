# HANDOFF: TASK-0020 商机发现（SPEC-0003）

- Date: 2026-08-08
- From: 协调员
- To: DeepSeek 或 GLM（单一执行者）
- Task card: `docs/tasks/active/TASK-0020-opportunity-discovery.md`
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
- Authorization: `DEC-0089`（本地合成完成序列）+ `DEC-0114`（本任务激活）

## 接手方必须重新核验（不得信任本摘要）

1. 重新读取 `AGENTS.md` 全文、`docs/NOW.md`、SPEC-0003 全文、本任务卡。
2. 重新核验 SPEC-0003 approval hash 与 `.approval.json` match。
3. 独立确认当前测试基线：`python -m pytest tests/ -q` → 期望
   `302 passed, 28 skipped`。

## 关键约束（最容易出错处）

- **OD-006 未授权**：禁止任何外部模型/AI 调用/真实数据外传。发现方法只能是
  本地确定性规则。每条可能性必须可追溯到实际获批信息（R-014，AC-013）。
- **脱敏是核心风险**：跨负责人连接（R-006）与提醒脱敏（R-007/008）是两回事。
  识别可以用全公司数据，但推给接收者的内容必须过 `SPEC-0001` 脱敏矩阵 +
  反推保护。参照既有 `src/crm/application/queries.py` 的 policy 投影与
  `detect_duplicate_*` 模式。
- **两层分离**（R-003，AC-003）：发现的可能性绝不能进入任何已确认/漏斗/预测
  视图，也不能与 `SPEC-0001` 记录合并成状态标记。
- **无认领动作**（R-004，AC-004）：只呈现提醒，推进走既有跟进。

## 复用的既有代码

- `src/crm/application/queries.py`：`QueryService`、policy 投影、脱敏、
  `detect_duplicate_institutions/contacts`。
- `src/crm/persistence/audit_repository.py`：审计写入（同事务模式）。
- `src/crm/web/routes/` 下已接受的路由（如 imports.py / management）作为
  路由 + 授权 + CSRF 的参照模式。
- 测试参照 `tests/test_task0011_bulk_import.py` / `test_task0015_management.py`
  的内存 SQLite harness 风格。

## 遇到 UNKNOWN

若发现 SPEC-0003 未定义但影响行为的决策（尤其发现方法的产品含义），停止，
在证据文件写明 UNKNOWN，向协调员报告，不得自行发明。

## 完成后

- 全部 14 条 AC 聚焦测试通过；全量 pytest 无退化；governance `[PASS]`。
- 写 `docs/evidence/TASK-0020-IMPLEMENTATION-{日期}.md`。
- 任务卡状态改 "IMPLEMENTATION COMPLETE — awaiting coordinator audit"。
- 向协调员发关键节点汇报（测试结果 / AC 覆盖 / governance / 未验证项）。
