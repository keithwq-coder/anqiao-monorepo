# TASK-0003 · 价盘阶梯 + 区域互斥（纯函数）

- SPEC：SPEC-0001（R-005 / R-006，AC-003 / AC-004）
- 状态：active（审计点1 已通过，DEC-0018 放行）
- 依赖：TASK-0002
- 授权：DEC-0018

## 范围

纯函数，无 DB/IO。归属文件：
```
channel/application/price_ladder.py
channel/application/region_guard.py
tests/test_price_ladder.py
tests/test_region_guard.py
```

## 契约

**价盘阶梯**（引用项目约束事实 2，阶梯由调用方传入、代码不硬编码）：
`lookup_unit_price(monthly_qty, ladder)` → 单价或 None（>1600 = 面议，禁止自动出价）。
ladder 规则：`[下限含, 上限不含, 单价]`，`上限=None` 表示开放档面议。

**区域互斥**（引用项目约束事实 12）：
`check_region_conflict(existing_regions, candidate)` → bool。
region = `(city_code, district_code)`，`district_code=""` 表示地级市级。
- 已有地级市代理 → 该市任何区县代理都冲突；
- 已有区县代理 → 该市地级市代理冲突；
- 已有区县 A 代理 → 同市区县 B 代理不冲突。

## 金样本（自检断言）

价盘：`150→1380`、`199→1380`、`200→1280`、`500→1280`、`700→1180`、`1599→1180`、`1600→None(面议)`、`1800→None(面议)`。

互斥：
- 已有地级市(city X) + 候选区县(X, A) → 冲突；
- 已有区县(X, A) + 候选地级市(X) → 冲突；
- 已有区县(X, A) + 候选区县(X, B) → 不冲突；
- 已有区县(X, A) + 候选区县(Y, A) → 不冲突（异市）。

## 自检

```
.venv/Scripts/python -m pytest tests/test_price_ladder.py tests/test_region_guard.py -v
```

## 审核裁决

**ACCEPTED**（DEC-0019，2026-08-13）。独立复核：18 金样本全绿、32 全量回归、`pip check` 无漂移、范围合规（application 仅 3 模块）、价盘数据驱动 + 开放档禁止自动出价 + 配置防呆、互斥对齐手册 v3 第十三条。
