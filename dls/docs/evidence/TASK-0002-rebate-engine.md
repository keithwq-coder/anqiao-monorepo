# TASK-0002 · 返利引擎 TDD · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，停在**审计点1**，待架构师复核）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0002-rebate-engine-tdd.md`

## Scope（变更文件 · 2 个）

| 文件 | 内容 |
|---|---|
| `channel/application/rebate_calculator.py` | 返利引擎纯函数：`RebateInput` / `RebateLine` / `RebateResult` / `calculate_rebate` |
| `tests/test_rebate_calculator.py` | 9 项测试：金样本 A/B/C1/C2/D/E + 封顶 + 非法角色/周期校验 |

零 DB/IO/框架依赖，无副作用。

## TDD 过程

1. 先写 `tests/test_rebate_calculator.py`（金样本 A~E 落成断言 + 封顶 + 契约校验）。
2. 跑测试 → **红**：`ModuleNotFoundError: No module named 'channel.application.rebate_calculator'`（收集即失败，符合预期）。
3. 实现 `rebate_calculator.py` → 跑测试 → **绿**。

## Evidence（真实命令输出）

### Step 0 · venv 重建 Python 3.12（DEC-0016）

```
rm -rf .venv
"D:/project/中科安樵/crm/.venv/Scripts/python.exe" -m venv .venv
.venv/Scripts/python --version
→ Python 3.12.8
.venv/Scripts/python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -e ".[dev]"
→ Successfully installed fastapi-0.141.1 sqlalchemy-2.0.52 alembic-1.19.1 ...
```

### 自检（金样本）

```
.venv/Scripts/python -m pytest tests/test_rebate_calculator.py -v
→ collected 9 items
  tests\test_rebate_calculator.py .........  [100%]
  ============================== 9 passed in 0.05s ==============================
```

### 全量回归 + 依赖

```
.venv/Scripts/python -m pytest -q
→ ..............  [100%]  (14 passed: 骨架 5 + 返利 9)
.venv/Scripts/python -m pip check
→ No broken requirements found.
.venv/Scripts/python --version → Python 3.12.8
```

## 金样本逐项核验（9 项）

| # | 场景 | 断言 | 结果 |
|---|---|---|---|
| 1 | A 全达标 | 季度4500+秩序1500+过程1500=7500 | PASS |
| 2 | B 未达分解 | 季度0+秩序1000+过程1000=2000 | PASS |
| 3 | C1 窜货 | 季度4500+秩序0+过程1500=6000 | PASS |
| 4 | C2 情节严重 | 全 0、明细空 | PASS |
| 5 | D 年度达标 | 年度2%×55万=11000 | PASS |
| 6 | E 经销 | 季度6000+秩序2000=8000 | PASS |
| 7 | 封顶 | agent ≤7%、dealer ≤4%（定义比例恰等于 cap，安全上限不越界） | PASS |
| 8 | 非法角色 | ValueError | PASS |
| 9 | 非法结算周期 | ValueError | PASS |

## 实现要点（供审计）

- **金额四舍五入到分**（`_round2`）：`0.03×150000` 等浮点尘埃不进入账务。
- **行类型按比例 >0 输出**：agent 三行（含金额为 0 的行，匹配场景 B）、dealer 无 process 行（匹配场景 E）、annual 仅年度达标行。
- **封顶**：`min(明细和, cap_rate × 基数)`，基数=quarter_paid（季）/annual_paid（年）。
- **契约校验**：非法 role / settle_period / 负值 → `RebateValidationError`（ValueError 子类）。

## Not verified

- 与真实规则配置快照（TASK-0004/0005 的 `rebate_rule` 表）的接线——本卡引擎接收显式参数，未接 DB。
- 生产环境。

## Decisions needed

- 无阻塞项。返利引擎契约已按卡落定，可进入 TASK-0003。

*实现不替架构师下结论；审计点1 待 v4-pro 裁决。*
