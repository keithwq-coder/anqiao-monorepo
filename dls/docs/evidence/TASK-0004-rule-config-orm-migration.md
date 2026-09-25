# TASK-0004 · 规则配置域 ORM + 迁移 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，停在**审计点2**，待架构师审 schema/迁移）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0004-rule-config-orm-migration.md`

## Scope（变更文件 · 3 个）

| 文件 | 内容 |
|---|---|
| `channel/persistence/models.py` | `Base` + `RuleStatus` + `RuleConfigMixin` + 8 张表 ORM（SQLAlchemy 2.0 `Mapped` 风格） |
| `migrations/versions/0001_rule_config.py` | Alembic 首个迁移：8 表 + 版本化唯一索引 + 部分唯一索引 + 降级 |
| `tests/test_persistence_schema.py` | 7 项：元数据断言 + 离线 SQL 断言 |

## 表设计（对齐 Phase1 第 2 节）

| 表 | 业务键 | 业务字段 |
|---|---|---|
| agent_tier | tier_code | tier_name, annual_commitment, deposit_std, first_purchase, rebate_cap_rate, max_region_grade, trial_days |
| price_ladder | product_code + ladder_tier | monthly_qty_min/max, unit_price, is_negotiable |
| price_line | product_code + line_type | amount |
| rebate_rule | role + rebate_type | rate, trigger_condition, settle_period, settle_method |
| deposit_rule | role + deposit_type | amount, refundable, reducible, deferrable |
| protection_policy | customer_type | protection_days, extendable_days, renewal_condition |
| region_grade | grade | definition |
| banned_term | term | scope |

通用版本化字段（每表）：`id`(UUID) / `effective_from`(tz) / `effective_to`(tz,null) / `version` / `status`(draft/active/superseded) / `created_at` / `updated_at`。

**约束（DB 层双保险）**：
- `uq_<table>_key_eff`：业务键 + `effective_from` 唯一（版本化不冲突）；
- `uq_<table>_key_active`：业务键 + `WHERE status='active'` **部分唯一索引**（同一规则同一时刻至多一条 active，应用层校验在 TASK-0005）。

## TDD 过程

1. 先写 `tests/test_persistence_schema.py`（元数据 + 离线 SQL 断言）。
2. 跑 → **红**：`ModuleNotFoundError: channel.persistence.models`。
3. 实现 models.py + 迁移 → **绿**。

## Evidence（真实命令输出）

### 自检

```
.venv/Scripts/python -m pytest tests/test_persistence_schema.py -v
→ collected 7 items
  tests\test_persistence_schema.py .......  [100%]
  ============================== 7 passed in 2.71s ==============================
```

### 离线迁移 SQL（卡要求路径，本地无 PG）

```
DLS_DB_* env .venv/Scripts/alembic upgrade head --sql
→ CREATE TABLE alembic_version
  CREATE TABLE agent_tier / price_ladder / price_line / rebate_rule /
             deposit_rule / protection_policy / region_grade / banned_term
  每表：CONSTRAINT rule_status CHECK (status IN ('draft','active','superseded'))
  CREATE UNIQUE INDEX uq_*_key_eff ON ... (业务键, effective_from);
  CREATE UNIQUE INDEX uq_*_key_active ON ... WHERE status = 'active';
```

### 全量回归 + 依赖

```
.venv/Scripts/python -m pytest -q
→ .......................................  [100%]  (39 passed: 5+9+12+6+7)
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 实现要点（供审计）

- **`status` 用 `native_enum=False` + CHECK**：避免 PG 原生 ENUM 类型在离线迁移/降级中的麻烦，CHECK 约束等效保证合法值（draft/active/superseded）。
- **部分唯一索引**在 ORM `__table_args__` 与迁移中成对存在，DB 层强制"同一业务键同一时刻至多一条 active"。
- **金额 `Numeric(12,2)`/`Numeric(14,2)`、比例 `Numeric(6,4)`**：不落浮点。
- **降级**按逆序 drop 8 表。
- 业务键/字段严格对齐 Phase1 规格第 2 节，无增删表。

## Not verified

- **真实 PostgreSQL 建表与迁移**（`alembic upgrade head` 在线路径）：本地无 PG（DEC-0019），仅验证离线 SQL 生成正确 + 元数据断言。
- 降级（`downgrade`）在真实 DB 上未执行。

## Decisions needed

- 无阻塞项。审计点2 后接 TASK-0005（版本化查询，应用层保证"至多一条 active"）。

*实现不替架构师下结论；审计点2 待 v4-pro 审 schema/迁移。*
