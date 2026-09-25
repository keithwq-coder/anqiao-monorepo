"""代理商档案仓储：创建命令落库 + 查询命令（SPEC-0002「档案创建/查询命令」）。

依据：SPEC-0002 R-001/R-002、DEC-0028 范围裁决（创建 = `party` + `agent_profile`
单事务；`agreement`/`deposit` 属签约/保证金阶段、`region_occupancy` 只在转正写入
（R-008）——均不随建档落库）、TASK-0010 契约。
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select

from channel.application.agent_onboarding import (
    TierRecord,
    create_agent_profile as build_profile_draft,
)
from channel.application.region_guard import Region
from channel.persistence.models import AgentProfile, LifecycleStatus, Party


class AgentProfileRepository:
    """代理商档案仓储（依赖注入 session，便于测试；提交（commit）由调用方负责）。"""

    def __init__(self, session: Any) -> None:
        self._session = session

    # ---- 创建命令 ----

    def create_profile(
        self,
        *,
        party: Party,
        tier_record: TierRecord,
        city_code: str,
        district_code: str = "",
        existing_regions: set[Region] | frozenset[Region] = frozenset(),
    ) -> AgentProfile:
        """创建代理商档案（单事务 add `party` + `agent_profile`，返回档案）。

        组合 TASK-0009 `create_agent_profile`（纯逻辑）：
        - 档位派生（`quarter_plan = annual_commitment / 4`，Decimal）；
        - `region_guard` 区域互斥检查，冲突 → `RegionConflictError`（不落库）；
        - 初始状态 `status = LifecycleStatus.INTENTION`（DEC-0027 裁决 2）。
        """
        draft = build_profile_draft(
            tier_record,
            city_code=city_code,
            district_code=district_code,
            existing_regions=existing_regions,
        )
        profile = AgentProfile(
            party_id=party.id,
            tier_code=draft.tier_code,
            city_code=draft.city_code,
            district_code=draft.district_code,
            annual_commitment=draft.annual_commitment,
            quarter_plan=draft.quarter_plan,
            status=LifecycleStatus.INTENTION,
        )
        self._session.add(party)
        self._session.add(profile)
        return profile

    # ---- 查询命令（语句构造器独立，便于 SQL 编译断言测试） ----

    def _find_by_id_stmt(self, profile_id: UUID) -> Any:
        return select(AgentProfile).where(AgentProfile.id == profile_id)

    def _find_by_party_stmt(self, party_id: UUID) -> Any:
        return select(AgentProfile).where(AgentProfile.party_id == party_id)

    def _find_by_region_stmt(self, city_code: str, district_code: str = "") -> Any:
        return select(AgentProfile).where(
            AgentProfile.city_code == city_code,
            AgentProfile.district_code == district_code,
        )

    def _find_by_tier_stmt(self, tier_code: str) -> Any:
        return select(AgentProfile).where(AgentProfile.tier_code == tier_code)

    def find_by_id(self, profile_id: UUID) -> AgentProfile | None:
        """按档案 id 查询（主键等值）。"""
        return self._session.scalars(self._find_by_id_stmt(profile_id)).one_or_none()

    def find_by_party(self, party_id: UUID) -> list[AgentProfile]:
        """按合作方查询档案（一合作方可持多重身份）。"""
        return list(self._session.scalars(self._find_by_party_stmt(party_id)).all())

    def find_by_region(self, city_code: str, district_code: str = "") -> list[AgentProfile]:
        """按区域查询档案（district_code 空串 = 市级）。"""
        return list(
            self._session.scalars(self._find_by_region_stmt(city_code, district_code)).all()
        )

    def find_by_tier(self, tier_code: str) -> list[AgentProfile]:
        """按档位查询档案。"""
        return list(self._session.scalars(self._find_by_tier_stmt(tier_code)).all())
