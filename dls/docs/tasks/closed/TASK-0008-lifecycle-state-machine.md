# TASK-0008 · 试销期状态机（纯函数 TDD）

- SPEC：SPEC-0002（R-006、R-008；AC-002）
- 状态：active（DEC-0025 放行）
- 依赖：TASK-0007
- 授权：DEC-0025
- 审计检查点：**审计点4**（生命周期规则 = 核心业务逻辑，本卡完成后审状态机）

## 范围

生命周期状态机纯函数。归属文件：
```
channel/application/lifecycle.py
tests/test_lifecycle.py
```

## 契约

状态枚举：`intention / reviewing / pending_sign / trial / converted / dissolved / rejected`

事件：`submit / approve / reject / sign / trial_expire`

`transition(state, event, *, has_first_purchase=False, has_terminal_sale=False) -> new_state`

转换表（引用项目约束事实 9、手册 v3 第十八条，禁止自创）：

| 当前态 | 事件 | 次态 |
|---|---|---|
| intention | submit | reviewing |
| reviewing | approve | pending_sign |
| reviewing | reject | rejected |
| pending_sign | sign | trial |
| trial | trial_expire（首批✓ 且 销售✓） | converted |
| trial | trial_expire（否则） | dissolved |

- `converted / dissolved / rejected` 为**终态**，任何事件 → `LifecycleTransitionError`；
- 非法迁移 → `LifecycleTransitionError`（ValueError 子类）；
- 转正 = 区域保护激活（状态 `converted` 时才允许写入 `region_occupancy`，R-008）。

## 金样本（自检断言）

1. `transition(intention, submit)` → reviewing
2. `transition(reviewing, approve)` → pending_sign
3. `transition(reviewing, reject)` → rejected
4. `transition(pending_sign, sign)` → trial
5. `transition(trial, trial_expire, has_first_purchase=True, has_terminal_sale=True)` → converted
6. `transition(trial, trial_expire, has_first_purchase=False)` → dissolved
7. `transition(trial, trial_expire, has_first_purchase=True, has_terminal_sale=False)` → dissolved
8. `transition(converted, sign)` → 报错（终态）
9. `transition(trial, approve)` → 报错（非法事件）

## 自检

```
.venv/Scripts/python -m pytest tests/test_lifecycle.py -v
```

## 审核裁决

**审计点4 通过（DEC-0026）**：TASK-0008 ACCEPTED。产品方同意 evidence 中两个开放项处置：①「未届满 → 不变」由调用侧（订单域 SPEC-0003）保证；② `region_protection_active()` 供 TASK-0009 写 `region_occupancy` 前复用。验收依据：63 测试全绿 + 131 全量回归 + `pip check` 无漂移（真跑过）。
