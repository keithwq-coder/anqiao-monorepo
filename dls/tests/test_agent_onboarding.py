"""TASK-0009 档位派生 + 档案创建金样本测试（TDD：先红后绿）。

契约来源：docs/tasks/active/TASK-0009-tier-derivation-onboarding.md
（SPEC-0002 R-007 / AC-004；DEC-0007 规则即数据、项目约束事实 1/17）。
"""

from dataclasses import dataclass
from decimal import Decimal

import pytest

from channel.application.agent_onboarding import (
    AgentProfileDraft,
    RegionConflictError,
    TierDefaults,
    create_agent_profile,
    derive_tier_defaults,
)
from channel.application.region_guard import Region, RegionValidationError


@dataclass(frozen=True)
class _TierRow:
    """agent_tier 配置行（测试替身，结构对齐 ORM 行；应用层不依赖持久化层）。"""

    tier_code: str
    annual_commitment: object
    deposit_std: object
    first_purchase: object
    trial_days: int


# 金样本输入：区县（承诺 50 万 / 保证金 5 万 / 首批 3 万 / 试销 90 天）
COUNTY = _TierRow("county", 500000, 50000, 30000, 90)
# 金样本输入：地级市（承诺 100 万 / 保证金 10 万 / 首批 4 万 / 试销 90 天）
CITY = _TierRow("city", 1000000, 100000, 40000, 90)


# ---- 金样本 1：区县档位派生 ----

def test_derive_county_tier() -> None:
    d = derive_tier_defaults(COUNTY)
    assert isinstance(d, TierDefaults)
    assert d.annual_commitment == 500000
    assert d.deposit_std == 50000
    assert d.first_purchase == 30000
    assert d.trial_days == 90
    assert d.quarter_plan == 125000  # 500000 / 4


# ---- 金样本 2：地级市档位派生 ----

def test_derive_city_tier() -> None:
    d = derive_tier_defaults(CITY)
    assert d.annual_commitment == 1000000
    assert d.deposit_std == 100000
    assert d.first_purchase == 40000
    assert d.trial_days == 90
    assert d.quarter_plan == 250000  # 1000000 / 4


# ---- 金样本 3：非硬编码证明（换输入 → 输出随输入变） ----

def test_derive_follows_input_not_hardcoded() -> None:
    """换一组 tier_record 输入，输出随之变化——证明无硬编码（DEC-0007）。"""
    custom = _TierRow("custom", 999999, 12345, 6789, 45)
    d = derive_tier_defaults(custom)
    assert d.annual_commitment == 999999
    assert d.deposit_std == 12345
    assert d.first_purchase == 6789
    assert d.trial_days == 45
    assert d.quarter_plan == Decimal("249999.75")  # 999999 / 4


def test_derive_accepts_decimal_input() -> None:
    """DB Numeric 列读出的 Decimal 输入同样成立（金额类型归一化为 Decimal）。"""
    row = _TierRow(
        "county",
        Decimal("500000.00"),
        Decimal("50000.00"),
        Decimal("30000.00"),
        90,
    )
    d = derive_tier_defaults(row)
    assert d.annual_commitment == Decimal("500000.00")
    assert d.quarter_plan == Decimal("125000.00")


# ---- 档案创建：档位派生 + region_guard 区域互斥组合 ----

def test_create_profile_no_conflict() -> None:
    """无既有代理 → 创建成功，draft 携带派生值与区域。"""
    draft = create_agent_profile(COUNTY, city_code="X", district_code="A")
    assert isinstance(draft, AgentProfileDraft)
    assert draft.tier_code == "county"
    assert draft.city_code == "X"
    assert draft.district_code == "A"
    assert draft.annual_commitment == 500000
    assert draft.quarter_plan == 125000
    assert draft.deposit_std == 50000
    assert draft.first_purchase == 30000
    assert draft.trial_days == 90


def test_create_profile_city_level_district_default_empty() -> None:
    """地级市代理：district_code 缺省为空串（区县级颗粒度约定）。"""
    draft = create_agent_profile(CITY, city_code="X")
    assert draft.district_code == ""


def test_create_profile_city_blocks_district_same_city() -> None:
    """已有地级市(X) + 候选区县(X, A) → 区域冲突，拒绝创建。"""
    existing = {Region(city_code="X", district_code="")}
    with pytest.raises(RegionConflictError):
        create_agent_profile(
            COUNTY,
            city_code="X",
            district_code="A",
            existing_regions=existing,
        )


def test_create_profile_district_blocks_city_same_city() -> None:
    """已有区县(X, A) + 候选地级市(X) → 区域冲突，拒绝创建。"""
    existing = {Region(city_code="X", district_code="A")}
    with pytest.raises(RegionConflictError):
        create_agent_profile(CITY, city_code="X", existing_regions=existing)


def test_create_profile_sibling_district_allowed() -> None:
    """已有区县(X, A) + 候选区县(X, B) → 同市异区不冲突，可创建。"""
    existing = {Region(city_code="X", district_code="A")}
    draft = create_agent_profile(
        COUNTY,
        city_code="X",
        district_code="B",
        existing_regions=existing,
    )
    assert draft.city_code == "X"
    assert draft.district_code == "B"


def test_create_profile_invalid_region_rejected() -> None:
    """空 city_code → 区域非法（复用 region_guard.RegionValidationError）。"""
    with pytest.raises(RegionValidationError):
        create_agent_profile(COUNTY, city_code="  ")
