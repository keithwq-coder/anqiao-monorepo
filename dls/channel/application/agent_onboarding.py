"""档位派生 + 档案创建纯逻辑（规则即数据，零硬编码）。

依据：项目约束事实 1（区县/地级市两档）、事实 17（规则即数据，DEC-0007）、
SPEC-0002 R-007（档位/承诺量/保证金/首批货款从 agent_tier 配置读取）/ AC-004、
TASK-0009 契约。

- 本模块为无副作用纯函数：tier_record（agent_tier 配置行）由调用方传入，
  不查询 DB；金额统一归一化为 Decimal（与 DB Numeric 列一致）。
- 档案创建 = 档位派生 + region_guard 区域互斥（手册 v3 第十三条），冲突拒绝创建。
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from channel.application.region_guard import Region, check_region_conflict


class RegionConflictError(ValueError):
    """候选区域与既有代理冲突，拒绝创建。"""


class TierRecord(Protocol):
    """agent_tier 配置行（结构对齐 ORM 行；应用层不依赖持久化层）。"""

    tier_code: str
    annual_commitment: Decimal | int
    deposit_std: Decimal | int
    first_purchase: Decimal | int
    trial_days: int


@dataclass(frozen=True, slots=True)
class TierDefaults:
    """档位派生结果（金额为 Decimal，与 DB Numeric 列一致）。"""

    annual_commitment: Decimal
    deposit_std: Decimal
    first_purchase: Decimal
    trial_days: int
    quarter_plan: Decimal


@dataclass(frozen=True, slots=True)
class AgentProfileDraft:
    """档案创建草稿：档位派生值 + 区域 + 档位代号。"""

    tier_code: str
    city_code: str
    district_code: str
    annual_commitment: Decimal
    quarter_plan: Decimal
    deposit_std: Decimal
    first_purchase: Decimal
    trial_days: int


def _as_decimal(value: Decimal | int | float | str) -> Decimal:
    """金额归一化为 Decimal；Decimal 直通，其余经 str 转换（避浮点表示误差）。"""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def derive_tier_defaults(tier_record: TierRecord) -> TierDefaults:
    """从 agent_tier 配置行派生档案默认值（SPEC-0002 R-007，零硬编码）。

    - quarter_plan = annual_commitment / 4；
    - 全部字段来自传入的 tier_record，不读任何常量/配置表（DEC-0007）。
    """
    annual = _as_decimal(tier_record.annual_commitment)
    return TierDefaults(
        annual_commitment=annual,
        deposit_std=_as_decimal(tier_record.deposit_std),
        first_purchase=_as_decimal(tier_record.first_purchase),
        trial_days=tier_record.trial_days,
        quarter_plan=annual / Decimal(4),
    )


def create_agent_profile(
    tier_record: TierRecord,
    *,
    city_code: str,
    district_code: str = "",
    existing_regions: set[Region] | frozenset[Region] = frozenset(),
) -> AgentProfileDraft:
    """创建代理商档案（纯逻辑）：档位派生 + 区域互斥，冲突拒绝创建。

    - 候选区域经 Region 校验（空 city_code → RegionValidationError）；
    - 与既有代理冲突（手册 v3 第十三条，同地级市 地级市/区县互斥）→ RegionConflictError；
    - 通过后返回携带派生值（含 quarter_plan）的草稿。
    """
    candidate = Region(city_code=city_code, district_code=district_code)
    if check_region_conflict(set(existing_regions), candidate):
        raise RegionConflictError(
            f"region conflict: city={candidate.city_code!r} district={candidate.district_code!r}"
        )
    defaults = derive_tier_defaults(tier_record)
    return AgentProfileDraft(
        tier_code=tier_record.tier_code,
        city_code=candidate.city_code,
        district_code=candidate.district_code,
        annual_commitment=defaults.annual_commitment,
        quarter_plan=defaults.quarter_plan,
        deposit_std=defaults.deposit_std,
        first_purchase=defaults.first_purchase,
        trial_days=defaults.trial_days,
    )
