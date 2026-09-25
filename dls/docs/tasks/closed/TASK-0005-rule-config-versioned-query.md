# TASK-0005 · 规则版本化查询（active 版本 + 快照）

- SPEC：SPEC-0001（R-002，AC-001）
- 状态：active（DEC-0020 放行）
- 依赖：TASK-0004
- 授权：DEC-0020

## 范围

规则配置的版本化读取。归属文件：
```
channel/persistence/rule_config_repository.py
tests/test_rule_config_repository.py
```

## 契约

- `get_active(table, business_key)` → 当前生效版本（`effective_from <= now < effective_to` 且 status=active）。
- `get_snapshot(table, business_key, at_time)` → 某时点生效版本（历史对账用，引用项目约束"规则取历史版本"）。
- 同规则同一时刻至多一条 active（读时断言，发现重叠报错）。

## 自检

```
.venv/Scripts/python -m pytest tests/test_rule_config_repository.py -v
```

> 依赖 DB，无本地 PG 时用 SQLite 冒烟？否——项目约束事实 20 禁用 SQLite，用 `[NOT VERIFIED]` 标注待真实 PG。

## 审核裁决

**ACCEPTED**（DEC-0021，2026-08-13）。独立复核：8 项全绿、58 全量回归、SQL 编译断言正确、TDD 抓出并修复枚举存储 bug（ORM 值=迁移 CHECK 值）。真实 PG 执行待验（[NOT VERIFIED]，DEC-0019）。
