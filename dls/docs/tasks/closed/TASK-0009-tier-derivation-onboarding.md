# TASK-0009 · 档位派生 + 档案创建命令（非硬编码）

- SPEC：SPEC-0002（R-007；AC-004）
- 状态：active（DEC-0026 放行）
- 依赖：TASK-0007

## 范围

档位派生（读 `agent_tier` 配置、非硬编码）+ 档案创建纯逻辑（组合 `region_guard`）。归属文件：
```
channel/application/agent_onboarding.py
tests/test_agent_onboarding.py
```

## 契约

`derive_tier_defaults(tier_record) -> TierDefaults(annual_commitment, deposit_std, first_purchase, trial_days, quarter_plan)`

- `quarter_plan = annual_commitment / 4`；
- 全部字段来自传入的 `tier_record`（agent_tier 配置行），**零硬编码**（DEC-0007、项目约束事实 17）；
- 档案创建：档位派生 + `region_guard.check_region_conflict` 组合，区域冲突 → 拒绝创建。

## 金样本（自检断言）

- 区县 `tier_record`（承诺 50 万 / 保证金 5 万 / 首批 3 万 / 试销 90 天）→ 派生 (500000, 50000, 30000, 90, 125000)
- 地级市 `tier_record`（承诺 100 万 / 保证金 10 万 / 首批 4 万 / 试销 90 天）→ 派生 (1000000, 100000, 40000, 90, 250000)
- 非硬编码证明：换一组 `tier_record` 输入 → 输出随输入变。

## 自检

```
.venv/Scripts/python -m pytest tests/test_agent_onboarding.py -v
```

## 审核裁决

**审计点5 通过（DEC-0027）**：TASK-0009 ACCEPTED。独立复核：10 自检全绿、141 全量回归、`pip check` 无漂移、离线 SQL 全链、schema 17 全绿、范围合规。三项裁决：quarter_plan 保持字面 /4；draft 不含 status（初始状态走持久化默认 intention）；金额 Decimal 直写 Numeric 列。
