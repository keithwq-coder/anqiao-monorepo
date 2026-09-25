# TASK-0002 · 返利引擎 TDD（算钱）

- SPEC：SPEC-0001（R-003 / R-004，AC-002）
- 实现者：v4-flash
- 审核者：deepseek-v4-pro
- 状态：active
- 授权：DEC-0017
- 审计检查点：**审计点1**（本卡完成后，架构师审计金样本全绿 + 代码审读才放行 TASK-0003）

## 前置必读

`项目约束.md` → `AGENTS.md` → `SPEC-0001` → 本卡

## Step 0 · venv 重建 Python 3.12（DEC-0016）

```
rm -rf .venv
"D:/project/中科安樵/crm/.venv/Scripts/python.exe" -m venv .venv
.venv/Scripts/python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -e ".[dev]"
.venv/Scripts/python --version   # 必须输出 3.12.x
```

## 范围

**先写失败测试，再实现纯函数**（TDD）。引擎为无副作用纯函数，不含任何 DB/IO/框架依赖。

归属文件（唯一可写）：
```
channel/application/rebate_calculator.py
tests/test_rebate_calculator.py
```

## 契约（输入 → 输出，实现者不得偏离）

输入（dataclass，字段见下）：
- `role`: `"agent" | "dealer"`
- 比例：`quarter_rate` / `annual_rate` / `market_rate` / `process_rate` / `cap_rate`
  - agent：0.03 / 0.02 / 0.01 / 0.01 / 0.07
  - dealer：0.03 / 0.00 / 0.01 / 0.00 / 0.04
- `annual_commitment`: float（年度承诺）
- `quarter_paid`: float（当季实际回款）
- `annual_paid`: float（年初至今实际回款）
- `compliance_ok`: bool（无窜货 + 无低价投诉）
- `process_ok`: bool（培训 + 数据上传 + 报备）
- `settle_period`: `"quarter" | "annual"`
- `severe_violation`: bool = False（情节严重 → 当期全扣）

`quarter_plan = annual_commitment / 4`

输出：
- 返利明细行列表（类型 → 金额）+ 总额（封顶后）

计算规则（引用项目约束事实 4/5，禁止自创）：
1. `severe_violation` → 全部 0。
2. 季度结算（`settle_period="quarter"`）：
   - 季度回款：`quarter_paid >= quarter_plan` → `quarter_rate × quarter_paid`，否则 0
   - 市场秩序：`compliance_ok` → `market_rate × quarter_paid`，否则 0
   - 过程指标：`process_ok` → `process_rate × quarter_paid`，否则 0
   - （年度达标不在季度结算）
3. 年度结算（`settle_period="annual"`）：
   - 年度达标：`annual_paid >= annual_commitment` → `annual_rate × annual_paid`，否则 0
4. 封顶：`total = min(明细和, cap_rate × 基数)`，基数 = 季度用 `quarter_paid`、年度用 `annual_paid`。定义的各比例之和恰等于 cap（agent 7%、dealer 4%），cap 是安全上限。

## 金样本（测试断言，实现前先写）

代理（区县，承诺 50 万，季度分解 12.5 万）：

| 场景 | 输入 | 期望明细 | 期望 total |
|---|---|---|---|
| A | quarter, paid 150000, ok, process ok | 季度 4500 + 秩序 1500 + 过程 1500 | 7500 |
| B | quarter, paid 100000, ok, process ok | 季度 0 + 秩序 1000 + 过程 1000 | 2000 |
| C1 | quarter, paid 150000, 窜货(compliance False), process ok | 季度 4500 + 秩序 0 + 过程 1500 | 6000 |
| C2 | quarter, paid 150000, severe=True | 全 0 | 0 |
| D | annual, annual_paid 550000（≥50万） | 年度达标 11000 | 11000 |

经销（cap 4%）：

| E | quarter, paid 200000, ok | 季度 6000 + 秩序 2000 | 8000 |

## 自检（交证据前必跑，附真实输出）

```
.venv/Scripts/python -m pytest tests/test_rebate_calculator.py -v
```

全绿才可交。证据写 `docs/evidence/TASK-0002-rebate-engine.md`。

## 审核裁决

**审计点1 通过 / ACCEPTED**（DEC-0018，2026-08-13）。独立复核：9 金样本全绿（独立重跑）、14 全量回归、pip check 无漂移、Python 3.12.8、范围合规（仅 2 新增文件）、引擎数据驱动（比例作参数非硬编码，符合 DEC-0007）。附带观察（非阻塞）：承诺量=0 时季度达标恒真，需在 TASK-0004 接真实规则表时校验承诺量>0。
