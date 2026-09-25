# TASK-0005 · 规则版本化查询 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师复核；与 TASK-0006 一起进入审计点3）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0005-rule-config-versioned-query.md`

## Scope（变更文件 · 2 个）

| 文件 | 内容 |
|---|---|
| `channel/persistence/rule_config_repository.py` | `RuleConfigRepository` + `model_for` / `business_key_conditions` / `resolve_single` / `RuleVersioningError` |
| `tests/test_rule_config_repository.py` | 8 项：8 表映射 + 业务键 + active/快照 SQL 断言 + 多版本检测 |

## 契约实现

- `get_active(table, business_key)`：`effective_from <= now AND (effective_to IS NULL OR effective_to > now) AND status='active'`，按 `effective_from DESC` 取最新。
- `get_snapshot(table, business_key, at_time)`：仅时间重叠（`effective_from <= at_time AND (effective_to IS NULL OR effective_to > at_time)`），**不按当前 status 过滤**——历史版本可能是 superseded。
- 读时断言：同一规则同一时刻命中多条 → `RuleVersioningError`。

## TDD 过程

1. 先写测试（SQL 编译断言 + 映射 + 多版本检测）。
2. 跑 → **红**：`ModuleNotFoundError: channel.persistence.rule_config_repository`。
3. 实现 → 首轮 **1 failed**：测试抓出**枚举存储 bug**（见下），修复后全绿。

## 测试抓出的真 Bug（重要）

`Enum(RuleStatus)` 默认用枚举**名字**（`'ACTIVE'`）存储，而迁移 CHECK 约束期望**值**（`'active'`）——ORM 插入将违反 CHECK。修复：`values_callable=lambda cls: [m.value for m in cls]`，ORM 改为存储枚举值。

```
修复后复核：ORM 枚举值 ['active','draft','superseded'] == 迁移 CHECK ('draft','active','superseded') ✓
```

## Evidence（真实命令输出）

```
.venv/Scripts/python -m pytest tests/test_rule_config_repository.py tests/test_credit.py tests/test_banned_terms.py -q
→ ...................  [100%]  (19 passed: 仓库8 + 抵扣5 + 禁用词6)
.venv/Scripts/python -m pytest -q
→ ..........................................................  [100%]  (58 passed)
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 关键 SQL 断言（编译级，literal_binds）

- active：`WHERE ... effective_from <= ... AND (effective_to IS NULL OR ...) AND status = 'active'`
- snapshot：`WHERE ... effective_from <= ... AND (effective_to IS NULL OR ...)`（**无 status**）

## Not verified

- **真实 PostgreSQL 执行**（本地无 PG，DEC-0019）：仓库 SQL 仅做编译断言，未真实查询。`get_active`/`get_snapshot` 的 DB 端行为待真实 PG 验证。

## Decisions needed

- 无阻塞项。进入审计点3（与 TASK-0006 一起综合验收 SPEC-0001）。

*实现不替架构师下结论。*
