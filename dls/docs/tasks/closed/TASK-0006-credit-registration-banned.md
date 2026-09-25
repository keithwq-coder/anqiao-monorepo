# TASK-0006 · 返利抵扣额度 + 报备时间戳 + 禁用词

- SPEC：SPEC-0001（R-007 / R-008，AC-005 / AC-006）
- 状态：active（DEC-0020 放行）
- 依赖：TASK-0005
- 授权：DEC-0020
- 审计检查点：**审计点3**（SPEC-0001 综合验收，AC-001~006 全达成后关闭）

## 范围

纯函数为主。归属文件：
```
channel/application/credit.py          # 返利抵扣额度（AC-005）
channel/application/banned_terms.py    # 合规禁用词扫描（AC-006）
tests/test_credit.py
tests/test_banned_terms.py
```

## 契约

**抵扣**（引用项目约束事实 15）：`apply_credit(payable, credit_balance)` → `(wechat_pay, credit_used, remaining)`。
`credit_used = min(credit_balance, payable)`；`wechat_pay = payable - credit_used`；全抵扣则 `wechat_pay=0`。

**禁用词**（引用项目约束事实 13）：`scan_banned(text, terms)` → 命中列表。
terms 来自 `banned_term` 配置（医疗级/诊断/治疗/医疗器械(产品级)），代码不硬编码。

## 金样本（自检断言）

- `apply_credit(100000, 5000)` → `(95000, 5000, 0)`（对应 AC-005）
- `apply_credit(3000, 5000)` → `(0, 3000, 2000)`（全抵扣）
- `scan_banned("本产品医疗级精准")` 命中"医疗级"；`scan_banned("精准健康监测")` 空。

## 自检

```
.venv/Scripts/python -m pytest tests/test_credit.py tests/test_banned_terms.py -v
```

## 审核裁决

**ACCEPTED**（DEC-0021，2026-08-13）。独立复核：抵扣/禁用词金样本全绿。抵扣流水持久化属账务域，移交后续 SPEC（见 DEC-0021）。
