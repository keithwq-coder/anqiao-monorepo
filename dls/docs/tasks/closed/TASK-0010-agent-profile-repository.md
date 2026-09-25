# TASK-0010 · 档案创建落库 + 查询命令（仓储层）

- SPEC：SPEC-0002（范围「档案创建/查询命令」；R-001/R-002）
- 状态：active（DEC-0028 授权）
- 依赖：TASK-0009
- 授权：DEC-0028
- 缺口来源：DEC-0027

## 范围

代理商档案域仓储层：档案创建命令**落库** + 档案**查询**命令。归属文件：
```
channel/persistence/agent_profile_repository.py
tests/test_agent_profile_repository.py
```

## 范围裁决（DEC-0028，实现前必读）

- **创建命令 = 落库 `party` + `agent_profile`（`status=INTENTION`）单事务**；
- **明确排除** `agreement` / `deposit` / `region_occupancy`：
  - `agreement`（R-003）/ `deposit`（R-005）属签约/保证金阶段（`pending_sign → sign → trial`），另开卡；
  - `region_occupancy`（R-004）**只在转正时写入**（R-008：只有转正才占区域）→ 另开 TASK-0011（转正命令，proposed 待授权）；
- 创建时的区域冲突检查 `existing_regions` = 转正代理的 region_occupancy **现占用**（R-008 语义）；最终互斥由 region_occupancy DB UNIQUE + 转正时二次校验兜底；
- 范围裁决 1/2 属 `[INFERENCE]`（从生命周期状态推导），产品方如有异议应在实现前更正（见 DEC-0028）。

## 契约

`AgentProfileRepository(session)`（依赖注入，同 `RuleConfigRepository` 模式）。

- `create_profile(*, party, tier_record, city_code, district_code="", existing_regions=frozenset()) -> AgentProfile`
  - 组合 TASK-0009 `create_agent_profile`（档位派生 + `region_guard` 冲突检查，冲突 → `RegionConflictError`）；
  - 单事务 `session.add(party)` + `session.add(agent_profile)`，返回构造的 `agent_profile`；
  - `agent_profile.status = LifecycleStatus.INTENTION`（DEC-0027 裁决 2）；
  - `annual_commitment` / `quarter_plan` 来自派生值（`quarter_plan = annual_commitment / 4`，Decimal）；
  - `party` 为 `Party` ORM 实例（R-001 字段），由调用方构造。
- 查询命令（均返回 ORM 行 / 空序列）：
  - `find_by_id(profile_id) -> AgentProfile | None`
  - `find_by_party(party_id) -> list[AgentProfile]`
  - `find_by_region(city_code, district_code="") -> list[AgentProfile]`
  - `find_by_tier(tier_code) -> list[AgentProfile]`

## 金样本（自检断言）

1. `create_profile` 冲突（已有地级市 `X` + 候选区县 `X,A`）→ `RegionConflictError`（fake session 不 add）；
2. `create_profile` 无冲突（区县 tier_record 50 万）→ 返回/添加 `AgentProfile`：`status == INTENTION`、`annual_commitment == 500000`、`quarter_plan == Decimal("125000")`；
3. `find_by_region("X", "")` 的 SELECT WHERE 含 `city_code = 'X' AND district_code = ''`（SQL 编译断言）；
4. `find_by_tier("county")` 的 SELECT WHERE 含 `tier_code = 'county'`；
5. `find_by_id(uuid)` / `find_by_party(uuid)` 的 SELECT WHERE 含主键/外键等值条件。

## 自检

```
.venv/Scripts/python -m pytest tests/test_agent_profile_repository.py -v
```

测试方法沿用 TASK-0005（本地无 PG，DEC-0019）：SQL 编译断言（postgresql dialect + literal_binds）+ fake session 记录 `add` 调用与对象属性；真实 DB 执行标 `[NOT VERIFIED]`。

## 审核裁决

**审计点6 通过（DEC-0029）**：TASK-0010 ACCEPTED。独立复核：7 自检全绿、148 全量回归、`pip check` 无漂移、读码契约逐项符合、DEC-0028 范围合规。非阻塞：existing_regions 依赖注入（region_occupancy 转换由调用方负责）、commit 由调用方负责。
