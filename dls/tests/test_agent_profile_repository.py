"""TASK-0010 档案创建落库 + 查询命令金样本测试（TDD：先红后绿）。

契约来源：docs/tasks/active/TASK-0010-agent-profile-repository.md
（SPEC-0002 R-001/R-002；DEC-0028 范围裁决：创建 = party + agent_profile 单事务，
agreement/deposit/region_occupancy 不随建档落库）。

本地无真实 PostgreSQL（DEC-0019），测试沿用 TASK-0005 模式：
SQL 编译断言（postgresql dialect + literal_binds）+ fake session 记录 add 调用。
真实 DB 执行标 [NOT VERIFIED]。
"""

from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from channel.application.agent_onboarding import RegionConflictError
from channel.application.region_guard import Region
from channel.persistence.agent_profile_repository import AgentProfileRepository
from channel.persistence.models import AgentProfile, LifecycleStatus, Party


@dataclass(frozen=True)
class _TierRow:
    """agent_tier 配置行（结构对齐 ORM 行，满足 TierRecord Protocol）。"""

    tier_code: str
    annual_commitment: object
    deposit_std: object
    first_purchase: object
    trial_days: int


# 区县档位（承诺 50 万 / 保证金 5 万 / 首批 3 万 / 试销 90 天）
COUNTY = _TierRow("county", 500000, 50000, 30000, 90)


class _FakeSession:
    """记录 add 调用；真实 DB 执行标 NOT VERIFIED。"""

    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj: object) -> None:
        self.added.append(obj)


def _compile(stmt) -> str:
    return str(
        stmt.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )


def _where(sql: str) -> str:
    return sql.split("WHERE", 1)[1] if "WHERE" in sql else ""


def _party() -> Party:
    return Party(id=uuid4(), name="甲合作方")


# ---- 金样本 1：区域冲突拒绝创建 ----

def test_create_profile_conflict_rejected() -> None:
    """已有地级市(X) + 候选区县(X, A) → RegionConflictError，不落库。"""
    session = _FakeSession()
    repo = AgentProfileRepository(session)
    existing = {Region(city_code="X", district_code="")}
    with pytest.raises(RegionConflictError):
        repo.create_profile(
            party=_party(),
            tier_record=COUNTY,
            city_code="X",
            district_code="A",
            existing_regions=existing,
        )
    assert session.added == []


# ---- 金样本 2：无冲突创建（status=INTENTION + 派生值） ----

def test_create_profile_persists_party_and_profile() -> None:
    """无冲突 → 单事务 add party + agent_profile，status=INTENTION，派生值正确。"""
    session = _FakeSession()
    repo = AgentProfileRepository(session)
    party = _party()
    profile = repo.create_profile(
        party=party,
        tier_record=COUNTY,
        city_code="X",
        district_code="A",
    )
    assert session.added == [party, profile]
    assert profile.party_id == party.id
    assert profile.tier_code == "county"
    assert profile.city_code == "X"
    assert profile.district_code == "A"
    assert profile.status is LifecycleStatus.INTENTION  # DEC-0027 裁决 2
    assert profile.annual_commitment == 500000
    assert profile.quarter_plan == Decimal("125000")  # annual / 4


def test_create_profile_city_level_district_empty() -> None:
    """地级市代理：district_code 缺省空串；初始状态仍为 INTENTION。"""
    session = _FakeSession()
    repo = AgentProfileRepository(session)
    party = _party()
    profile = repo.create_profile(party=party, tier_record=COUNTY, city_code="X")
    assert profile.district_code == ""
    assert profile.status is LifecycleStatus.INTENTION
    assert session.added == [party, profile]


# ---- 金样本 3~5：查询 SQL 编译断言 ----

def test_find_by_region_sql() -> None:
    """find_by_region('X','') → WHERE city_code = 'X' AND district_code = ''。"""
    repo = AgentProfileRepository(session=None)
    stmt = repo._find_by_region_stmt("X", "")
    where = _where(_compile(stmt))
    assert "city_code = 'X'" in where
    assert "district_code = ''" in where


def test_find_by_tier_sql() -> None:
    """find_by_tier('county') → WHERE tier_code = 'county'。"""
    repo = AgentProfileRepository(session=None)
    stmt = repo._find_by_tier_stmt("county")
    where = _where(_compile(stmt))
    assert "tier_code = 'county'" in where


def test_find_by_id_sql() -> None:
    """find_by_id(uuid) → WHERE agent_profile.id = <uuid>（主键等值）。"""
    repo = AgentProfileRepository(session=None)
    profile_id = uuid4()
    stmt = repo._find_by_id_stmt(profile_id)
    where = _where(_compile(stmt))
    assert "agent_profile.id" in where
    assert str(profile_id) in where


def test_find_by_party_sql() -> None:
    """find_by_party(uuid) → WHERE agent_profile.party_id = <uuid>（外键等值）。"""
    repo = AgentProfileRepository(session=None)
    party_id = uuid4()
    stmt = repo._find_by_party_stmt(party_id)
    where = _where(_compile(stmt))
    assert "agent_profile.party_id" in where
    assert str(party_id) in where
