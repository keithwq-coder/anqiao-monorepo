# TASK-0009 · 档位派生 + 档案创建命令 · 完成证据

- 实现者：v4-flash
- 状态：handoff-only（实现完成，待架构师复核；SPEC-0002 综合验收待编排）
- 日期：2026-08-13
- 对应卡：`docs/tasks/active/TASK-0009-tier-derivation-onboarding.md`
- 依据：SPEC-0002（R-007 / AC-004）、项目约束事实 1/17（DEC-0007 规则即数据）、DEC-0026 放行

## Scope（变更文件 · 2 个，与卡声明一致）

| 文件 | 内容 |
|---|---|
| `channel/application/agent_onboarding.py` | `TierRecord`(Protocol) / `TierDefaults` / `derive_tier_defaults()` / `AgentProfileDraft` / `RegionConflictError(ValueError)` / `create_agent_profile()` |
| `tests/test_agent_onboarding.py` | 3 金样本 + Decimal 输入 + 创建组合 6 项 = 10 项 |

纯函数：仅依赖 `dataclasses` / `decimal` / `typing.Protocol` + 复用 `region_guard`，零 DB/IO。

## TDD 过程

1. 先写 `tests/test_agent_onboarding.py`（3 金样本 + 组合边界）。
2. 跑测试 → **红**：`ModuleNotFoundError: No module named 'channel.application.agent_onboarding'`。
3. 实现 → **绿**：10 passed。

## Evidence（真实命令输出）

### 自检（卡内命令）

```
.venv/Scripts/python -m pytest tests/test_agent_onboarding.py -v
→ collected 10 items
  tests\test_agent_onboarding.py ..........                        [100%]
  ============================== 10 passed in 0.02s ==============================
```

### 全量回归 + 依赖

```
.venv/Scripts/python -m pytest
→ 141 passed in 5.12s   （基线 131 + 本卡 10）
.venv/Scripts/python -m pip check
→ No broken requirements found.
```

## 金样本逐项核验（卡内 3 条）

| # | 断言 | 结果 |
|---|---|---|
| 1 | 区县 `tier_record`（50 万 / 5 万 / 3 万 / 90 天）→ (500000, 50000, 30000, 90, 125000) | PASS |
| 2 | 地级市 `tier_record`（100 万 / 10 万 / 4 万 / 90 天）→ (1000000, 100000, 40000, 90, 250000) | PASS |
| 3 | 非硬编码证明：`tier_record("custom", 999999, 12345, 6789, 45)` → 输出随输入变（quarter_plan=249999.75） | PASS |

## 实现要点（供审计）

- **规则即数据（DEC-0007 / 事实 17）**：`derive_tier_defaults` 全部字段来自传入的 `tier_record`，模块内无任何档位常量；非硬编码由金样本 3 + 额外 Decimal 输入测试证明（输出随输入变）。
- **输入解耦**：`TierRecord` 为结构型 Protocol（tier_code / annual_commitment / deposit_std / first_purchase / trial_days），对齐 `AgentTier` ORM 行（TASK-0004 已定 8 表 schema），应用层不 import 持久化层；测试用轻量替身 `_TierRow` 验证。
- **金额 Decimal 化**：`_as_decimal` 归一化（Decimal 直通，其余走 `str` 转换避浮点误差）；与 DB `Numeric(14,2)` 列一致（对比返利引擎用 float+round2，本域产出物直写 Numeric 列，故用 Decimal）。
- **quarter_plan = annual_commitment / 4**：按卡字面实现，Decimal 除法精确（无浮点尘埃）；非整整除的尾数留给 DB `Numeric(14,2)` 落库时舍入（见 Decisions needed ①）。
- **档案创建组合**：`create_agent_profile` = `derive_tier_defaults` + `region_guard.check_region_conflict`（复用 TASK-0003 互斥语义，手册 v3 第十三条）；冲突 → `RegionConflictError`（新定义 ValueError 子类）；空 city_code → 复用 `RegionValidationError`。返回 flat `AgentProfileDraft`（tier_code / 区域 / 派生五值），字段对齐 `agent_profile` + `agreement`/`deposit` 建账所需。
- **初始状态不写 draft**：`agent_profile.status` 由持久化默认 `intention`（TASK-0007），与 TASK-0008 状态机入口态一致（见 Decisions needed ②）。

## AC-004 / R-007 映射

- **AC-004**（档位数据读自 `agent_tier` 配置，写测试证明非硬编码）：达成——金样本 3 换输入随变 + Decimal 输入测试；派生值全部源自 `tier_record`。
- **R-007**（档位/承诺量/保证金/首批货款从 `agent_tier` 读取）：达成——`annual_commitment`/`deposit_std`/`first_purchase`/`trial_days` 均读自传入配置行。

## Not verified

- 与 `agent_tier` 配置仓储（TASK-0005 `rule_config_repository` 的 active 行查询）及 `agent_profile` 落库的接线——本卡为纯逻辑，持久化接线属后续实现。
- 真实 PostgreSQL 在线迁移与查询（本地无 PG，DEC-0019 既有事实）。

## Decisions needed

1. **quarter_plan 舍入口径**：当前按卡字面 `annual / 4`（Decimal 精确）；非整整除（如 100000.01/4=25000.0025）尾数待 DB `Numeric(14,2)` 落库舍入。是否需要在纯函数内显式 quantize 到分（与返利引擎 round2 口径一致）？请裁决。
2. **draft 不含 status**：初始状态 `intention` 由持久化默认保证（TASK-0007 server_default）。是否要求 `AgentProfileDraft` 显式携带 `status=INTENTION`（组合 TASK-0008 状态机入口）？请裁决。
3. **金额类型约定**：本域产出物用 Decimal（对齐 Numeric 列），与返利引擎 float+round2 并存。是否在仓库级统一金额类型约定？请裁决。

*实现不替架构师下结论；待 v4-pro 复核。*

## 审核结果（DEC-0027）

**审计点5 通过 · TASK-0009 ACCEPTED**。架构师独立复核：10 自检全绿、141 全量回归、`pip check` 无漂移、离线 SQL 全链（8 配置表 + 5 域表 + region_occupancy UNIQUE + DROP COLUMN）、schema 17 全绿、范围合规。三项裁决：① quarter_plan 保持字面 /4（不 quantize）；② draft 不含 status（初始状态走持久化默认 intention）；③ 金额 Decimal 直写 Numeric 列。遗留：档案创建落库 + 查询命令未覆盖 → TASK-0010（proposed）。卡移入 `docs/tasks/closed/`。
