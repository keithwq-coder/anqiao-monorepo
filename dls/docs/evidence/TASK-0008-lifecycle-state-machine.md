# TASK-0008 · 试销期状态机 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师复核；审计点4 生命周期规则）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0008-lifecycle-state-machine.md`
- 依据：SPEC-0002（R-006 / R-008 / AC-002）、项目约束事实 9（手册 v3 第十八条）、DEC-0025

## Scope（变更文件 · 2 个，与卡声明一致）

| 文件 | 内容 |
|---|---|
| `channel/application/lifecycle.py` | `LifecycleState` / `LifecycleEvent` / `LifecycleTransitionError(ValueError)` / `transition()` / `region_protection_active()` |
| `tests/test_lifecycle.py` | 9 金样本 + 终态穷举 15 + 全表穷举 35 + 字符串兼容 + R-008 + 枚举漂移防护 = 63 项 |

纯函数：仅依赖 `enum.StrEnum`，零 DB/IO/框架导入。

## TDD 过程

1. 先写 `tests/test_lifecycle.py`（9 金样本 + 边界覆盖）。
2. 跑测试 → **红**：`ModuleNotFoundError: No module named 'channel.application.lifecycle'`（收集失败，符合预期）。
3. 实现 `channel/application/lifecycle.py` → **绿**：63 passed。

## Evidence（真实命令输出）

### 自检（卡内命令）

```
.venv/Scripts/python -m pytest tests/test_lifecycle.py -v
→ collected 63 items
  tests\test_lifecycle.py ................................................ [ 76%]
  ...............                                                          [100%]
  ============================== 63 passed in 0.31s ==============================
```

### 全量回归 + 依赖

```
.venv/Scripts/python -m pytest
→ 131 passed in 3.30s   （基线 68 + 本卡 63；基线=DEC-0025 验收时的 68）
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 金样本逐项核验（卡内 9 条）

| # | 断言 | 结果 |
|---|---|---|
| 1 | `transition(intention, submit)` → reviewing | PASS |
| 2 | `transition(reviewing, approve)` → pending_sign | PASS |
| 3 | `transition(reviewing, reject)` → rejected | PASS |
| 4 | `transition(pending_sign, sign)` → trial | PASS |
| 5 | `transition(trial, trial_expire, 首批✓, 销售✓)` → converted | PASS |
| 6 | `transition(trial, trial_expire, 首批✗)` → dissolved | PASS |
| 7 | `transition(trial, trial_expire, 首批✓, 销售✗)` → dissolved | PASS |
| 8 | `transition(converted, sign)` → LifecycleTransitionError（终态） | PASS |
| 9 | `transition(trial, approve)` → LifecycleTransitionError（非法事件） | PASS |

## AC-002 映射

| AC-002 断言 | 落地 | 证据 |
|---|---|---|
| 届满+首批✓+销售✓ → 转正 | transition 分支 | 金样本 5 |
| 首批✗ → 解除 | 分支缺任一信号 → dissolved | 金样本 6、穷举 (False, True) |
| 销售✗ → 解除 | 同上 | 金样本 7 |
| 未届满 → 不变 | **调用侧**：`trial_expire` 事件本身即"届满"信号（SPEC-0002 技术要点：信号来自订单域）；届满前不发送该事件，状态恒为 trial，无自动推进 | trial 态收到任何非 `trial_expire` 事件（submit/approve/reject/sign 共 4 个）全部报错（穷举覆盖），证明届满前无旁路可改状态 |
| 非法迁移 → 报错 | 终态拦截 + 表外组合拦截 | 金样本 8/9 + 35 项穷举 |

## 实现要点（供审计）

- **转换表数据化**：`_TRANSITION_TABLE` 四行 + trial_expire 分支，严格按卡内转换表，未自创路径。
- **终态守卫**：`converted / dissolved / rejected` 在任何事件前先拦截（15 项参数化覆盖），错误信息标明"terminal state"。
- **trial_expire 语义**：`has_first_purchase and has_terminal_sale` → converted，否则 → dissolved（含 (False, True) 场景：首批✗ 销售✓ 仍解除——转正两个条件缺一不可，手册 v3 第十八条）。
- **R-008 区域保护**：`region_protection_active(state)` 仅对 converted 返回 True；TASK-0009 写 `region_occupancy` 前可直接复用，无需重复判状态。
- **字符串兼容**：`transition`/`region_protection_active` 接受枚举成员或字符串值（DB 列存 StrEnum 值），未知值 → `LifecycleTransitionError`（统一错误契约）。
- **防双定义漂移**：`LifecycleState` 与 TASK-0007 已定 `models.LifecycleStatus` 名称+值逐项相等有测试守护（应用层保持零持久化依赖，一致性由测试而非 import 耦合保证）。
- **"未届满 → 不变"的纯函数边界**：本模块无时钟（SPEC-0002 技术要点：无副作用纯函数），届满判定在调用侧（订单域，SPEC-0003）；已在证据中显式标注，请审计确认此边界符合预期。

## Not verified

- `converted` 与 `region_occupancy` 写入的实际接线（TASK-0009 档案命令实现时校验 `region_protection_active`）。
- `trial_expire` 信号的实际触发（试销期届满计时/届满判定属订单域 SPEC-0003，本域不实现）。
- 真实 PostgreSQL 在线迁移与查询（本地无 PG，DEC-0019 既有事实）。

## Decisions needed

- 无阻塞项。请架构师确认：① "未届满 → 不变"由调用侧（订单域）保证的边界是否接受；② `region_protection_active` 作为本域公开谓词是否纳入 TASK-0009 复用（当前实现已就绪）。
- 卡完成后即达审计点4（生命周期规则 = 核心业务逻辑），待 v4-pro 独立复核。

## 审核结果（DEC-0026）

**审计点4 通过 · TASK-0008 ACCEPTED**（产品方同意）。两个开放项裁决：①「未届满 → 不变」由调用侧（订单域 SPEC-0003）保证；② `region_protection_active()` 供 TASK-0009 写 `region_occupancy` 前复用。卡移入 `docs/tasks/closed/`；TASK-0009 转 active。

*实现不替架构师下结论；待 v4-pro 复核。*
