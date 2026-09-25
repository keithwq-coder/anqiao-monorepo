# TASK-0003 · 价盘阶梯 + 区域互斥 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师复核；TASK-0004 将随审计点2 一起激活）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0003-price-ladder-region-guard.md`

## Scope（变更文件 · 4 个）

| 文件 | 内容 |
|---|---|
| `channel/application/price_ladder.py` | `LadderBand` / `lookup_unit_price` + 阶梯配置校验 |
| `channel/application/region_guard.py` | `Region` / `check_region_conflict` |
| `tests/test_price_ladder.py` | 8 参数化边界 + 4 配置校验 = 12 项 |
| `tests/test_region_guard.py` | 6 项互斥场景 |

纯函数，零 DB/IO/框架依赖。

## TDD 过程

1. 先写两个测试文件（金样本 + 校验断言）。
2. 跑测试 → **红**：两模块均 `ModuleNotFoundError`（收集失败，符合预期）。
3. 实现两模块 → **绿**：18 passed。

## Evidence（真实命令输出）

### 自检（金样本）

```
.venv/Scripts/python -m pytest tests/test_price_ladder.py tests/test_region_guard.py -v
→ collected 18 items
  tests\test_price_ladder.py ............  [66%]
  tests\test_region_guard.py ......       [100%]
  ============================== 18 passed in 0.03s ==============================
```

### 全量回归 + 依赖

```
.venv/Scripts/python -m pytest -q
→ ................................  [100%]  (32 passed: 骨架5 + 返利9 + 价盘12 + 互斥6)
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 金样本逐项核验

**价盘**（0730 口径，[下限含, 上限不含]）：

| 月累计 | 期望 | 结果 |
|---|---|---|
| 150 / 199 | 1380 | PASS |
| 200 / 500 | 1280 | PASS |
| 700 / 1599 | 1180 | PASS |
| 1600 / 1800 | None（面议，禁止自动出价） | PASS |
| 负采购量 | ValueError | PASS |
| 重叠档位 / 空档 | ValueError（配置防呆） | PASS |

**互斥**：

| 场景 | 期望 | 结果 |
|---|---|---|
| 已有地级市(X) + 候选区县(X,A) | 冲突 | PASS |
| 已有区县(X,A) + 候选地级市(X) | 冲突 | PASS |
| 已有区县(X,A) + 候选区县(X,B) | 不冲突 | PASS |
| 已有区县(X,A) + 候选区县(Y,A) | 不冲突 | PASS |
| 空既有 / 多区县+候选地级市 | 不冲突 / 冲突 | PASS |

## 实现要点（供审计）

- **价盘数据驱动**：阶梯作参数传入，代码零硬编码（DEC-0007）；开放档（`upper=None`）收尾且**单价必须 None**，命中即返回面议、绝不回落上一档（AC-003 禁止自动出价）。
- **阶梯配置防呆**：必须从 0 起、连续无重叠无空档、开放档只能最后——配置错了当场报错，不让歧义进账务。
- **互斥规则**：候选地级市=同市任何既有都冲突；候选区县=仅同市地级市冲突；同市异区县、异市均放行（手册 v3 第十三条）。

## Not verified

- 与 `region` / `price_ladder` 配置表的接线（TASK-0004 落表）。
- 真实数据库约束（TASK-0004 迁移时做唯一索引，手册要求 DB+应用双保险——应用层校验已就绪）。

## Decisions needed

- 无阻塞项。TASK-0003 完成后即达 TASK-0004（审计点2：schema 定型）前置。

*实现不替架构师下结论；待 v4-pro 复核。*
