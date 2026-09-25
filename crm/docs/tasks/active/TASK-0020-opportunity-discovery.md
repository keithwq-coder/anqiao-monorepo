# TASK-0020: SPEC-0003 商机发现（主动发现与脱敏提醒）

- Task ID: TASK-0020
- Status: **ACCEPTED** (`DEC-0115`, coordinator independent audit 2026-08-08; local synthetic scope)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0003-opportunity-discovery.approval.json`
  (实施前由执行方重新核验哈希，必须 match)
- Also governed by: `SPEC-0001`, `SPEC-0002`
- Implementation authorized by: `DEC-0089`（approved-SPEC 完成序列，本地合成，
  一次一个任务，需协调员独立审计）
- Implementation owner: DeepSeek 或 GLM（单一执行者；产品负责人指定；移交
  接受后生效）
- Coordinator/auditor: 当前协调员
- Depends on: TASK-0015 (ACCEPTED, DEC-0103), TASK-0019 (ACCEPTED, DEC-0113)

## Goal

实现 `SPEC-0003` 的商机发现：系统主动连接获批范围内的记录，向相关负责人
揭示其原本可能忽略的商业可能性，附脱敏支持理由，并把"系统发现的可能性"
与"人已投入经营的 `SPEC-0001` 记录"保持为两个不同层次。发现结果以"提醒"
（类似站内消息）呈现，不设认领/升级动作。

## 关键授权边界（不可逾越）

- **OD-006 仍 OPEN（单独授权门）**：不得引入任何外部模型、AI 调用或真实
  数据外传。发现方法必须是**本地确定性规则**（例如：同区域 + 同类别的跨
  负责人机构关联，或同一联系渠道跨机构复现等可追溯规则）。R-012/R-014
  要求每条可能性可追溯到实际使用的获批信息，禁止编造关联。
- **OD-005 仍 OPEN（留存）**：发现结果与响应状态的长期留存归属数据生命
  周期 SPEC，本任务只做当前必要的持久化，不做留存策略决策。
- 若发现方法的选择会实质改变产品行为（超出 SPEC-0003 已定规则），**停止
  并把 SPEC 退回 review**，不得在代码里发明行为。
- 本地合成数据；无部署、无远程数据库/SSH、无真实数据、无凭据、无外部写入。

## Owned paths（激活后独占）

- 新建：发现服务/仓储代码（application + persistence 层，遵循既有 QueryService
  / policy 投影模式）
- 新建：如 SPEC 要求持久化"发现的可能性/提醒/响应状态"，则新增受限 Alembic
  迁移 + 模型
- 新建：`src/crm/web/routes/` 下发现提醒的只读呈现路由 + 页面
- 修改：`src/crm/web/main.py`（挂载路由）
- 新建：`tests/test_task0020_opportunity_discovery.py`
- 新建：`docs/evidence/TASK-0020-*` 和本任务卡
- 不得触碰：已批准 SPEC 文件、其他任务证据、生产配置

## Required acceptance（来自 SPEC-0003 AC-001…AC-014）

必须由聚焦测试覆盖全部 14 条 AC，重点：
- 跨负责人数据连接识别可能性（AC-001/006），但推送给接收者的提醒严格遵守
  `SPEC-0001` 脱敏矩阵，不泄露他人受保护字段（AC-007）；
- 过细提示的反推保护：泛化或抑制，而非照原样展示（AC-008，小样本/反推测试）；
- 发现层与经营层分离，不入任何已确认/漏斗类视图（AC-003）；
- 无认领/升级动作，推进走既有 `SPEC-0001` 跟进（AC-004）；
- 每条可能性携带支持事实/推理/关键不确定项/发现时间，且来源可追溯、无编造
  关联（AC-005/013）；
- 提醒发给相关记录负责人；无负责人时发给主管；管理层只读（AC-010/014）；
- 无外传路线时零真实数据外发、只用合成数据、不可用时明确降级（AC-011）；
- 未处理提醒保持未读、原始事实不被篡改（AC-012）。

## Prerequisites and completion gate

- Prerequisites: `DEC-0089`；依赖任务已接受；协调员移交接受；SPEC-0003
  approval hash 重新核验 match。
- Completion gate: 全部 14 条 AC 由聚焦测试覆盖；全量 `pytest tests/ -q`
  相对 `302 passed, 28 skipped` 基线无退化；governance `[PASS]`；协调员独立
  审计接受。"本地 PostgreSQL" 腿若无隔离实例则标注 NOT VERIFIED 并写明确切
  剩余检查，绝不按假设报成功。

## Verification

聚焦发现/脱敏/反推/来源可追溯测试；全量 pytest；governance 检查；本地合成
数据。无生产迁移、远程 DB 或真实数据。
