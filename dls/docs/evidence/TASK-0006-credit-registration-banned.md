# TASK-0006 · 返利抵扣 + 报备时间戳 + 禁用词 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，停在**审计点3**，待架构师综合验收 SPEC-0001）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0006-credit-registration-banned.md`

## Scope（变更文件 · 4 个）

| 文件 | 内容 |
|---|---|
| `channel/application/credit.py` | `apply_credit(payable, credit_balance)` → `(wechat_pay, credit_used, remaining)` |
| `channel/application/banned_terms.py` | `scan_banned(text, terms)` → 命中列表 |
| `tests/test_credit.py` | 5 项（AC-005） |
| `tests/test_banned_terms.py` | 6 项（AC-006） |

纯函数，零 DB/IO/框架依赖。

## 契约实现

**抵扣**（项目约束事实 15）：`credit_used = min(credit_balance, payable)`；`wechat_pay = payable − credit_used`（全抵扣=0）；`remaining = credit_balance − credit_used`。金额四舍五入到分；负值 → `CreditValidationError`。

**禁用词**（项目约束事实 13）：子串匹配，按 terms 传入顺序返回命中；terms 由调用方传入（来自 `banned_term` 配置），**代码不硬编码**（DEC-0007）。

## TDD 过程

1. 先写两个测试文件（金样本 + 边界）。
2. 跑 → **红**：`ModuleNotFoundError` ×3（含仓库模块，一并收集失败）。
3. 实现 3 模块 → **绿**：19 passed。

## Evidence（真实命令输出）

```
.venv/Scripts/python -m pytest tests/test_rule_config_repository.py tests/test_credit.py tests/test_banned_terms.py -v
→ collected 19 items，全部 PASS
.venv/Scripts/python -m pytest -q
→ ..........................................................  [100%]  (58 passed)
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 金样本逐项核验

**抵扣（AC-005）**：

| 输入 | 期望 (wechat_pay, used, remaining) | 结果 |
|---|---|---|
| (100000, 5000) | (95000, 5000, 0) | PASS |
| (3000, 5000) | (0, 3000, 2000) 全抵扣 | PASS |
| (100000, 0) | (100000, 0, 0) | PASS |
| (5000, 5000) | (0, 5000, 0) 恰好覆盖 | PASS |
| 负值 | CreditValidationError | PASS |

**禁用词（AC-006）**：

| 输入 | 期望 | 结果 |
|---|---|---|
| "本产品医疗级精准" | ["医疗级"] | PASS |
| "精准健康监测" | [] | PASS |
| "医疗级诊断治疗" | ["医疗级","诊断","治疗"] 顺序 | PASS |
| "" / terms 空 | [] | PASS |
| "器械清单" | []（不因含"器械"误报"医疗器械(产品级)"） | PASS |

## Not verified

- 与真实 `banned_term` / `protection_policy` 配置表数据联动（TASK-0005 仓库层接线，真实 PG 待验）。

## Decisions needed

- 无阻塞项。**审计点3**：SPEC-0001 AC-001~006 是否全达成、可否关闭，待 v4-pro 裁决。

*实现不替架构师下结论。*
