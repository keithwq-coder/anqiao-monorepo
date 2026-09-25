# TASK-0007 · 代理商档案域 ORM + 迁移 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师复核；TASK-0008 状态机将随后激活）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0007-agent-profile-orm.md`

## Scope（变更文件 · 3 个）

| 文件 | 内容 |
|---|---|
| `channel/persistence/models.py` | 删 `AgentTier.max_region_grade`（R-009）；新增 5 业务聚合类 + 4 枚举 |
| `migrations/versions/0002_agent_profile_domain.py` | 迁移 0002：5 表 + FK + UNIQUE + DROP COLUMN + 降级 |
| `tests/test_agent_profile_schema.py` | 10 项：模型存在 / 删字段 / 5 表 / 列 / UNIQUE / NOT NULL / 枚举 / 离线 SQL |

## 表设计（对齐 SPEC-0002 R-001~R-005）

| 表 | 业务键/约束 | 关键点 |
|---|---|---|
| party | id | 名称/信用代码/资质/微信 openid/手机号 |
| agent_profile | id, FK party | 档位/区域/承诺/季度分解/生命周期状态 |
| agreement | id, FK agent_profile | 协议条款/有效期/签署状态 |
| region_occupancy | **UNIQUE(city_code, district_code)** | district_code 非空（""=市级），补 AC-004 DB 层 |
| deposit | id, FK agent_profile | 保证金/首批货款，类型+状态枚举 |

**枚举（存字符串 + CHECK）**：lifecycle_status（7 值）、agreement_sign_status、deposit_type、deposit_status。

## TDD 过程

1. 先写 schema 测试（10 项）→ **红**：`ImportError: cannot import name 'AgentProfile'`。
2. 实现（改 models + 迁移 0002）→ 首轮 **收集错误**（我留了死代码 `_check_constraint` 引用未导入的 `CheckConstraint`），删除后全绿。
3. 修复过程如实记录：死代码是我的实现失误，测试收集即拦截。

## Evidence（真实命令输出）

```
.venv/Scripts/python -m pytest tests/test_agent_profile_schema.py -v
→ collected 10 items，全部 PASS

.venv/Scripts/python -m pytest
→ 68 passed in 3.42s  (此前 58 + 本卡 10)

.venv/Scripts/python -m pip check
→ No broken requirements found.
```

### 离线 SQL 核验（迁移 0001+0002 全链）

```
CREATE TABLE party / agent_profile / agreement / region_occupancy / deposit
CREATE UNIQUE INDEX uq_region_occupancy_city_district ON region_occupancy (city_code, district_code);
ALTER TABLE agent_tier DROP COLUMN max_region_grade;   ← R-009 / DEC-0022
```

## 关键实现点（供审计）

- `district_code` 非空 + 默认 `""`（市级）——**避免 PG UNIQUE 对 NULL 失效**的经典陷阱；
- `region_occupancy` UNIQUE(city_code, district_code) 补 SPEC-0001 AC-004 的 DB 层；地级市↔区县互斥语义由应用层 `region_guard`（TASK-0003）保证，双保险；
- `max_region_grade`：0001 保留历史、0002 `DROP COLUMN`（模型层已删除，迁移层做修正）；
- 枚举统一 `native_enum=False + values_callable`（沿用 TASK-0005 修过的枚举 bug 模式）；
- 降级：恢复 `max_region_grade`（server_default='C' 再取消默认，满足 NOT NULL）+ 逆序 drop 5 表。

## Not verified

- **真实 PostgreSQL 在线迁移**（本地无 PG，DEC-0019）：0002 建表/DROP COLUMN 仅离线 SQL 验证。
- 降级（downgrade）真实 DB 未执行。

## Decisions needed

- 无阻塞项。审计点4（状态机）后 TASK-0008 激活。

*实现不替架构师下结论。*
