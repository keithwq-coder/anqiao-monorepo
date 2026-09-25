# TASK-0007 · 代理商档案域 ORM + 迁移（5 表）

- SPEC：SPEC-0002（R-001~R-005、R-009；AC-001、AC-003 DB 层）
- 实现者：v4-flash
- 审核者：deepseek-v4-pro
- 状态：active
- 授权：DEC-0024

## 前置必读

`项目约束.md` → `AGENTS.md` → `SPEC-0002` → 本卡

## 范围

5 张**业务聚合表** ORM + 迁移 0002 + 删除 `agent_tier.max_region_grade`。业务聚合**不用** `RuleConfigMixin`（那是版本化配置域专用）。

归属文件（唯一可写）：
```
channel/persistence/models.py          # 新增 5 类 + 删 AgentTier.max_region_grade
migrations/versions/0002_agent_profile_domain.py
tests/test_agent_profile_schema.py
```

## 5 张表（字段严格如下，不得增删表）

| 表 | 字段 |
|---|---|
| `party` | id, name, credit_code, qualification, wechat_openid, phone, created_at, updated_at |
| `agent_profile` | id, party_id(FK→party), tier_code, city_code, district_code(默认""=市级), annual_commitment, quarter_plan, status, created_at, updated_at |
| `agreement` | id, agent_profile_id(FK→agent_profile), tier_code, city_code, district_code, annual_commitment, deposit_std, first_purchase, valid_from, valid_to, sign_status, created_at, updated_at |
| `region_occupancy` | id, city_code, district_code(默认""=市级), agent_profile_id(FK), occupied_at → **UNIQUE(city_code, district_code)** |
| `deposit` | id, agent_profile_id(FK), deposit_type, amount, paid_amount, status, created_at, updated_at |

**枚举（存字符串 + CHECK）**：
- `agent_profile.status`：intention / reviewing / pending_sign / trial / converted / dissolved / rejected
- `agreement.sign_status`：signed / terminated
- `deposit.status`：paid / waived / deferred / refunded
- `deposit.deposit_type`：deposit / first_purchase

`district_code=""` 表示地级市市级（与 TASK-0003 `region_guard` 约定一致；**不可用 NULL**，否则 UNIQUE 对 NULL 失效）。

## 迁移 0002 必含

1. CREATE 5 表 + FK + `region_occupancy` 的 `UNIQUE(city_code, district_code)`；
2. `ALTER TABLE agent_tier DROP COLUMN max_region_grade`（R-009，DEC-0022）；
3. downgrade：逆序 drop 5 表 + `ADD COLUMN max_region_grade`（恢复）。

## 自检（交证据前必跑）

```
.venv/Scripts/python -m pytest tests/test_agent_profile_schema.py -v
```

断言要点：5 表在 metadata、UNIQUE(city_code,district_code) 存在、离线 SQL 含 `DROP COLUMN max_region_grade`、`AgentTier` 模型已无 `max_region_grade`、生命周期枚举值正确。

## 审核裁决

**ACCEPTED**（DEC-0025，2026-08-13）。独立复核：10 schema 测试全绿、68 全量回归、模型↔迁移列级无漂移、4 枚举 CHECK 正确、`district_code` 非空 `DEFAULT ''`、`max_region_grade` 已删（模型+迁移 DROP）、`region_occupancy` UNIQUE 正确。真实 PG 待验（[NOT VERIFIED]）。
