# TASKS 管线 · SPEC-0001 实现

SPEC-0001（规则配置域 + 返利引擎，30-approved）的实现管线。批量编排，带审计检查点与任务自检。

## 管线图

```
TASK-0002 返利引擎 TDD（算钱）
   │  [审计点1] 金样本全绿 + 代码审读
   ▼
TASK-0003 价盘阶梯 + 区域互斥（纯函数）
   ▼
TASK-0004 规则配置域 ORM + 迁移（8 表定 schema）
   │  [审计点2] schema + 迁移审读
   ▼
TASK-0005 规则版本化查询（active 版本 + 快照）
   ▼
TASK-0006 返利抵扣额度 + 报备时间戳 + 禁用词
   │  [审计点3] SPEC-0001 综合验收（AC-001~006 全达成）
   ▼
SPEC-0001 关闭
```

## 审计检查点（v4-pro 审计，通过才放行下一段）

| 检查点 | 位置 | 审什么 |
|---|---|---|
| 审计点1 | TASK-0002 后 | 返利引擎 = 全系统唯一算钱处；金样本 A~E 全绿 + 代码审读 |
| 审计点2 | TASK-0004 后 | ORM schema + Alembic 迁移 = 数据模型定型；审 schema/迁移 |
| 审计点3 | TASK-0006 后 | SPEC-0001 全 AC 达成；综合验收 |

## 任务清单

| 卡 | 状态 | 依赖 | 归属文件 | 自检 |
|---|---|---|---|---|
| TASK-0002 返利引擎 | active | venv 3.12 | `channel/application/rebate_calculator.py` + 测试 | `pytest tests/test_rebate_calculator.py` |
| TASK-0003 价盘+互斥 | proposed | TASK-0002 | `channel/application/price_ladder.py` + `region_guard.py` + 测试 | `pytest` |
| TASK-0004 ORM+迁移 | proposed | TASK-0003 | `channel/persistence/models.py` + `migrations/versions/0001_*.py` | `alembic upgrade head` + schema 测试 |
| TASK-0005 版本查询 | proposed | TASK-0004 | `channel/persistence/rule_config_repository.py` + 测试 | `pytest` |
| TASK-0006 抵扣+报备+禁用词 | proposed | TASK-0005 | `channel/application/credit.py` + `banned_terms.py` + 测试 | `pytest` |

## 管线前置

- TASK-0002 Step 0：venv 重建 Python 3.12（DEC-0016，用 `crm/.venv/Scripts/python.exe`）。

---

## SPEC-0001 验收结论（审计点3，DEC-0021）

SPEC-0001（规则配置域 + 返利引擎）**核心达成、已关闭**：8 表 + 返利引擎 + 价盘阶梯 + 区域互斥（应用层）+ 抵扣 + 禁用词全部落地，58 测试全绿。

**3 个跨域缺口（非 SPEC-0001 范围，移交后续 SPEC）**：

| 缺口 | 归属后续 SPEC |
|---|---|
| AC-001「后台增改」UI | 管理后台域（Jinja2 CRUD + 审核签约） |
| AC-004「DB 唯一索引」（region 占用表） | 代理商档案域（SPEC-0002，TASK-0007 补齐） |
| AC-005「抵扣流水扣减」持久化 | 订单账务域（Order/Payment/Rebate 结算） |

---

## SPEC-0002 实现管线（DEC-0024）

```
TASK-0007 ORM+迁移（5 表 + region_occupancy 唯一索引 + 删 max_region_grade）
   ↓
TASK-0008 试销期状态机（纯函数 TDD）──[审计点4·生命周期规则]──
   ↓
TASK-0009 档位派生 + 档案命令（非硬编码）
```

| 卡 | 状态 | 依赖 |
|---|---|---|
| TASK-0007 ORM+迁移 | closed（DEC-0025） | — |
| TASK-0008 状态机 | closed（DEC-0026） | TASK-0007 |
| TASK-0009 档位派生 | closed（DEC-0027） | TASK-0007 |
| TASK-0010 档案落库+查询命令 | closed（DEC-0029） | TASK-0009 |
| TASK-0011 转正命令（写 region_occupancy，R-008） | proposed（待授权） | TASK-0010 |

## SPEC-0002 审计点4 结论（DEC-0026）

TASK-0008（试销期状态机）**ACCEPTED**：产品方同意「未届满 → 不变」由调用侧（订单域）保证、`region_protection_active()` 供 TASK-0009 复用；63 测试全绿 + 131 全量回归 + `pip check` 无漂移。TASK-0009 转 active。

## SPEC-0002 验收结论（审计点5，DEC-0027）

TASK-0009 **ACCEPTED**。AC-001~004 全部达成（离线 SQL + schema 17 / 状态机 63 / region_occupancy UNIQUE + region_guard / 档位非硬编码）。遗留同域缺口：档案创建**落库** + 档案**查询**命令（SPEC-0002 范围声明但未拆卡）→ 新开 TASK-0010（proposed）。

## SPEC-0002 收尾结论（审计点6，DEC-0029）

TASK-0010 **ACCEPTED**。SPEC-0002 声明范围 4 项全部交付（5 表 ORM+迁移 / 状态机 / 区域互斥 DB+应用层 / 档案创建+查询命令），AC-001~004 全达成。剩余 TASK-0011（转正命令写 region_occupancy）= R-008 操作化，是否属闭环待产品方定。
