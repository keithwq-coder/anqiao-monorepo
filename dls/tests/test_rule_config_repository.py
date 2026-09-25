"""TASK-0005 规则版本化查询测试。

本地无真实 PostgreSQL（DEC-0019 环境事实），采用 SQL 编译断言
（postgresql dialect + literal_binds 校验 WHERE 条件）。
真实 DB 执行标 [NOT VERIFIED]。
"""

from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from channel.persistence.rule_config_repository import (
    RuleConfigRepository,
    RuleVersioningError,
    business_key_conditions,
    model_for,
    resolve_single,
)

TABLE_NAMES = {
    "agent_tier",
    "price_ladder",
    "price_line",
    "rebate_rule",
    "deposit_rule",
    "protection_policy",
    "region_grade",
    "banned_term",
}

AT = datetime(2026, 8, 1, tzinfo=timezone.utc)


def _compile(stmt) -> str:
    return str(
        stmt.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )


def _where(sql: str) -> str:
    return sql.split("WHERE", 1)[1] if "WHERE" in sql else ""


def test_model_for_maps_all_8_tables() -> None:
    for name in TABLE_NAMES:
        assert model_for(name).__tablename__ == name


def test_model_for_unknown_table_rejected() -> None:
    with pytest.raises(KeyError):
        model_for("not_a_table")


def test_business_key_conditions_mapping() -> None:
    model = model_for("agent_tier")
    conditions = business_key_conditions(model, {"tier_code": "county"})
    stmt = sa.select(model).where(*conditions)
    sql = _compile(stmt)
    assert "tier_code = 'county'" in _where(sql)


def test_business_key_unknown_column_rejected() -> None:
    with pytest.raises(KeyError):
        business_key_conditions(model_for("agent_tier"), {"nope": 1})


def test_active_statement_conditions() -> None:
    """AC 对应：get_active = 时间重叠 + status='active'。"""
    repo = RuleConfigRepository(session=None)
    stmt = repo._statement(
        model_for("agent_tier"),
        {"tier_code": "county"},
        at_time=AT,
        require_active=True,
    )
    where = _where(_compile(stmt))
    assert "effective_from <=" in where
    assert "effective_to IS NULL" in where
    assert "status = 'active'" in where


def test_snapshot_statement_no_status_filter() -> None:
    """get_snapshot：仅时间重叠，不按当前 status 过滤（历史版本可能是 superseded）。"""
    repo = RuleConfigRepository(session=None)
    stmt = repo._statement(
        model_for("agent_tier"),
        {"tier_code": "county"},
        at_time=AT,
        require_active=False,
    )
    where = _where(_compile(stmt))
    assert "effective_from <=" in where
    assert "effective_to IS NULL" in where
    assert "status" not in where


def test_resolve_single_multi_raises() -> None:
    """多活动版本 → RuleVersioningError（读时断言）。"""
    class _Fake:
        pass

    with pytest.raises(RuleVersioningError):
        resolve_single([_Fake(), _Fake()])


def test_resolve_single_single_or_none() -> None:
    class _Fake:
        pass

    assert resolve_single([_Fake()]) is not None
    assert resolve_single([]) is None
