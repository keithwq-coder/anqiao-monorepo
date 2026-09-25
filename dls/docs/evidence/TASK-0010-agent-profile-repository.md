# TASK-0010 · 档案创建落库 + 查询命令 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师复核；SPEC-0002 收尾）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0010-agent-profile-repository.md`
- 依据：SPEC-0002（R-001/R-002）、DEC-0028（授权 + 范围裁决）、DEC-0027（裁决 2：status=INTENTION）

## Scope（变更文件 · 2 个，与卡声明一致）

| 文件 | 内容 |
|---|---|
| `channel/persistence/agent_profile_repository.py` | `AgentProfileRepository`：`create_profile`（创建落库）+ 4 查询命令 + 语句构造器 |
| `tests/test_agent_profile_repository.py` | 5 金样本 + 地级市边界 = 7 项 |

仓储层依赖：`sqlalchemy` + 组合 `channel.application.agent_onboarding` / `region_guard`；无真实 DB 依赖（测试 fake session）。

## TDD 过程

1. 先写测试（5 金样本 + 边界）→ **红**：`ModuleNotFoundError: No module named 'channel.persistence.agent_profile_repository'`。
2. 实现 → 首轮 **1 failed**：地级市边界测试断言写错（`session.added` 实为 `[party, profile]`，我误断言 `[profile]`）——测试缺陷，非实现缺陷；修正断言后 **7 passed**（如实记录）。
3. 全量回归 → 148 passed；`pip check` 无漂移。

## Evidence（真实命令输出）

### 自检（卡内命令）

```
.venv/Scripts/python -m pytest tests/test_agent_profile_repository.py -v
→ collected 7 items
  tests\test_agent_profile_repository.py .......                       [100%]
  ============================== 7 passed in 0.47s ==============================
```

### 全量回归 + 依赖

```
.venv/Scripts/python -m pytest
→ 148 passed in 5.49s   （基线 141 + 本卡 7）
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 金样本逐项核验（卡内 5 条）

| # | 断言 | 结果 |
|---|---|---|
| 1 | 冲突（已有地级市 X + 候选区县 X,A）→ `RegionConflictError`，fake session 不 add | PASS |
| 2 | 无冲突（区县 50 万）→ `status == INTENTION`、`annual_commitment == 500000`、`quarter_plan == Decimal("125000")` | PASS |
| 3 | `find_by_region("X","")` WHERE 含 `city_code = 'X' AND district_code = ''` | PASS |
| 4 | `find_by_tier("county")` WHERE 含 `tier_code = 'county'` | PASS |
| 5 | `find_by_id` / `find_by_party` WHERE 含主键/外键等值（`agent_profile.id` / `agent_profile.party_id` + uuid 值） | PASS |

## 实现要点（供审计）

- **范围合规（DEC-0028）**：`create_profile` 仅落库 `party` + `agent_profile`（单事务两次 `session.add`），**不** 写 `agreement`/`deposit`/`region_occupancy`——与范围裁决一致；`region_occupancy` 留待 TASK-0011（转正命令）。
- **组合 TASK-0009**：`create_profile` 内部调用纯逻辑 `create_agent_profile`（`build_profile_draft` 别名），档位派生 + `region_guard` 冲突检查在构造 ORM 对象前完成——冲突时零副作用（`session.added == []` 已断言）。
- **status=INTENTION**（DEC-0027 裁决 2）：构造 `AgentProfile` 时显式 `status=LifecycleStatus.INTENTION`，与 TASK-0007 `server_default` 及 TASK-0008 状态机入口态一致。
- **查询命令**：4 个 `find_by_*`，返回 ORM 行（卡契约）；语句构造器 `_find_by_*_stmt` 独立于 session，使测试可做 SQL 编译断言（沿用 TASK-0005 模式，本地无 PG）。
- **提交责任**：`session.add` 后不 commit（与 `RuleConfigRepository` 一致，提交由调用方/上层事务负责）——单事务语义由调用方开启，仓储只负责将两对象纳入同一 session。

## Not verified

- 真实 PostgreSQL 在线执行（create/query 落库与读取）——本地无 PG（DEC-0019），测试为 fake session + SQL 编译断言。
- `create_profile` 与上层（管理后台/小程序 API）的接线。

## Decisions needed

- 无阻塞项。备注：查询命令返回 ORM 行（卡契约既定）；如需领域对象（非 ORM）返回形状，属后续「查询命令返回形状」裁定（TASK-0010 卡开放点 3，已在 DEC-0028 范围内维持 ORM 行）。
- 卡完成后即达 SPEC-0002 收尾（TASK-0011 转正命令待授权），待架构师复核。

*实现不替架构师下结论；待 v4-pro 复核。*

## 审核结果（DEC-0029）

**审计点6 通过 · TASK-0010 ACCEPTED**。架构师独立复核：7 自检全绿、148 全量回归、`pip check` 无漂移、读码契约逐项符合、DEC-0028 范围合规。非阻塞观察：existing_regions 依赖注入（region_occupancy→Region 转换由调用方负责，属 TASK-0011/命令层）、commit 由调用方负责。SPEC-0002 声明范围全部达成。卡移入 `docs/tasks/closed/`。
