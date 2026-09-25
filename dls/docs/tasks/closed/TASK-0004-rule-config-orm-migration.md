# TASK-0004 · 规则配置域 ORM + 迁移（定 schema）

- SPEC：SPEC-0001（R-001 / R-002，AC-001）
- 状态：active（DEC-0019 放行）
- 依赖：TASK-0003
- 授权：DEC-0019
- 审计检查点：**审计点2**（本卡完成后审 schema/迁移）
- ⚠️ 环境事实（DEC-0019 记录）：本地 PG 当前无监听（无 psql、127.0.0.1:55432 无响应）→ 自检走 `alembic upgrade head --sql` 离线路径，真实 PG 验证标 [NOT VERIFIED]

## 范围

8 张配置表 + 版本化字段，Alembic 首个迁移。归属文件：
```
channel/persistence/models.py
migrations/versions/0001_rule_config.py
tests/test_persistence_schema.py
```

## 8 张表（字段见 `Phase1-规则配置与返利引擎规格.md` 第 2 节，不得增删表）

`agent_tier` / `price_ladder` / `price_line` / `rebate_rule` / `deposit_rule` / `protection_policy` / `region_grade` / `banned_term`

通用版本化字段（每表）：`id`(UUID) / `effective_from`(tz) / `effective_to`(tz, null) / `version`(int) / `status`(enum: draft/active/superseded) / `created_at` / `updated_at`。

约束：`(业务键, effective_from)` 唯一；同规则同一时刻至多一条 active（应用层保证，DB 加部分唯一索引可选）。

## 自检

```
DLS_DB_HOST=localhost DLS_DB_NAME=dls_test DLS_DB_USER=app DLS_DB_PASSWORD=x .venv/Scripts/alembic upgrade head
.venv/Scripts/python -m pytest tests/test_persistence_schema.py -v
```

> 无本地 PG 时：先跑 `alembic upgrade head --sql` 验证迁移可离线生成，schema 测试标注 `[NOT VERIFIED]` 待真实 PG。

## 审核裁决

**审计点2 通过 / ACCEPTED**（DEC-0020，2026-08-13）。独立复核：schema 测试 7 全绿、39 全量回归、8 表无增删、版本化字段齐全、模型↔迁移列级一致性无漂移（脚本比对）、部分唯一索引 + (业务键, effective_from) 唯一双保险、status CHECK 约束正确。
