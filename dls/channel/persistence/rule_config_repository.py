"""规则配置版本化读取（SPEC-0001 R-002）。

- `get_active`：当前生效版本（时间重叠 + status='active'）
- `get_snapshot`：某时点生效版本（历史对账，仅时间重叠，不按当前 status 过滤）
- 同一规则同一时刻至多一条生效版本；读到多条 → `RuleVersioningError`（读时断言）

依据：项目约束事实 17（规则即数据·版本化）、TASK-0005 契约。
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select

from channel.persistence.models import (
    AgentTier,
    BannedTerm,
    Base,
    DepositRule,
    PriceLadder,
    PriceLine,
    ProtectionPolicy,
    RebateRule,
    RegionGrade,
    RuleStatus,
)

_MODEL_BY_TABLE: dict[str, type[Base]] = {
    "agent_tier": AgentTier,
    "price_ladder": PriceLadder,
    "price_line": PriceLine,
    "rebate_rule": RebateRule,
    "deposit_rule": DepositRule,
    "protection_policy": ProtectionPolicy,
    "region_grade": RegionGrade,
    "banned_term": BannedTerm,
}


class RuleVersioningError(ValueError):
    """同一规则同一时刻存在多条生效版本（数据完整性违例）。"""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def model_for(table_name: str) -> type[Base]:
    try:
        return _MODEL_BY_TABLE[table_name]
    except KeyError as exc:
        raise KeyError(f"unknown rule config table: {table_name}") from exc


def business_key_conditions(
    model: type[Base], business_key: dict[str, Any]
) -> list[Any]:
    """业务键 → 等值条件列表（未知列拒绝）。"""
    columns = {column.name: column for column in model.__table__.columns}
    unknown = set(business_key) - set(columns)
    if unknown:
        raise KeyError(f"unknown business key columns: {sorted(unknown)}")
    return [columns[name] == value for name, value in business_key.items()]


def resolve_single(rows: list[Any]) -> Any | None:
    """同一规则同一时刻至多一条生效版本。"""
    if len(rows) > 1:
        raise RuleVersioningError(
            "multiple effective versions for the same rule at the same time"
        )
    return rows[0] if rows else None


class RuleConfigRepository:
    """规则配置版本化读取仓库（依赖注入 session，便于测试）。"""

    def __init__(self, session: Any) -> None:
        self._session = session

    def _statement(
        self,
        model: type[Base],
        business_key: dict[str, Any],
        at_time: datetime,
        *,
        require_active: bool,
    ) -> Any:
        conditions = business_key_conditions(model, business_key)
        conditions.append(model.effective_from <= at_time)
        conditions.append(
            or_(model.effective_to.is_(None), model.effective_to > at_time)
        )
        if require_active:
            conditions.append(model.status == RuleStatus.ACTIVE.value)
        return select(model).where(*conditions).order_by(model.effective_from.desc())

    def get_active(
        self, table_name: str, business_key: dict[str, Any]
    ) -> Any | None:
        model = model_for(table_name)
        stmt = self._statement(model, business_key, utc_now(), require_active=True)
        rows = list(self._session.scalars(stmt).all())
        return resolve_single(rows)

    def get_snapshot(
        self, table_name: str, business_key: dict[str, Any], at_time: datetime
    ) -> Any | None:
        model = model_for(table_name)
        stmt = self._statement(model, business_key, at_time, require_active=False)
        rows = list(self._session.scalars(stmt).all())
        return resolve_single(rows)
