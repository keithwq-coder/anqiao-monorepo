"""TASK-0007 代理商档案域 schema 测试。

元数据级断言（无 DB 可跑）+ 离线迁移 SQL 断言（alembic upgrade head --sql）。
真实 PostgreSQL 建表验证：本地无 PG → [NOT VERIFIED]（DEC-0019）。
"""

import os
import subprocess
import sys
from pathlib import Path

from channel.persistence.models import (
    AgentTier,
    AgentProfile,
    Agreement,
    Base,
    Deposit,
    LifecycleStatus,
    Party,
    RegionOccupancy,
)

REPO_ROOT = Path(__file__).resolve().parents[1]

EXPECTED_TABLES = {
    "party",
    "agent_profile",
    "agreement",
    "region_occupancy",
    "deposit",
}

AGENT_PROFILE_COLUMNS = {
    "id",
    "party_id",
    "tier_code",
    "city_code",
    "district_code",
    "annual_commitment",
    "quarter_plan",
    "status",
    "created_at",
    "updated_at",
}

REGION_OCCUPANCY_COLUMNS = {
    "id",
    "city_code",
    "district_code",
    "agent_profile_id",
    "occupied_at",
}


def test_models_exist() -> None:
    for cls in (Party, AgentProfile, Agreement, RegionOccupancy, Deposit):
        assert cls is not None


def test_agent_tier_no_longer_has_max_region_grade() -> None:
    """R-009：max_region_grade 已从模型删除（S/A/B/C 作废，DEC-0022）。"""
    assert "max_region_grade" not in AgentTier.__table__.columns


def test_metadata_has_5_tables() -> None:
    assert EXPECTED_TABLES <= set(Base.metadata.tables)


def test_agent_profile_columns() -> None:
    table = Base.metadata.tables["agent_profile"]
    assert AGENT_PROFILE_COLUMNS <= set(table.columns.keys())


def test_region_occupancy_columns_and_unique() -> None:
    table = Base.metadata.tables["region_occupancy"]
    assert REGION_OCCUPANCY_COLUMNS <= set(table.columns.keys())
    assert any(
        index.unique and {"city_code", "district_code"} <= set(index.columns.keys())
        for index in table.indexes
    ), "region_occupancy 需 UNIQUE(city_code, district_code)"


def test_region_occupancy_district_code_not_null() -> None:
    """district_code 不可 NULL（空串=市级，避免 PG UNIQUE 对 NULL 失效）。"""
    column = Base.metadata.tables["region_occupancy"].columns["district_code"]
    assert column.nullable is False


def test_lifecycle_status_values() -> None:
    assert {item.value for item in LifecycleStatus} == {
        "intention",
        "reviewing",
        "pending_sign",
        "trial",
        "converted",
        "dissolved",
        "rejected",
    }


def _offline_sql() -> str:
    env = os.environ.copy()
    env.update(
        {
            "DLS_DB_HOST": "localhost",
            "DLS_DB_NAME": "dls_test",
            "DLS_DB_USER": "app",
            "DLS_DB_PASSWORD": "x",
        }
    )
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout


def test_offline_sql_creates_5_tables() -> None:
    sql = _offline_sql()
    for name in EXPECTED_TABLES:
        assert f"CREATE TABLE {name}" in sql, name


def test_offline_sql_drops_max_region_grade() -> None:
    sql = _offline_sql()
    assert "DROP COLUMN max_region_grade" in sql, "迁移 0002 需删除 max_region_grade"


def test_offline_sql_has_region_unique() -> None:
    sql = _offline_sql()
    assert "uq_region_occupancy_city_district" in sql
