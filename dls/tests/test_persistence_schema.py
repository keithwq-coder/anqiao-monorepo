"""TASK-0004 规则配置域 schema 测试。

元数据级断言（无 DB 可跑）+ 离线迁移 SQL 断言（alembic upgrade head --sql）。
真实 PostgreSQL 建表验证：本地无 PG → [NOT VERIFIED]（DEC-0019 环境事实）。
"""

import os
import subprocess
import sys
from pathlib import Path

from channel.persistence.models import Base, RuleStatus

REPO_ROOT = Path(__file__).resolve().parents[1]

EXPECTED_TABLES = {
    "agent_tier",
    "price_ladder",
    "price_line",
    "rebate_rule",
    "deposit_rule",
    "protection_policy",
    "region_grade",
    "banned_term",
}

VERSIONED_COLUMNS = {
    "id",
    "effective_from",
    "effective_to",
    "version",
    "status",
    "created_at",
    "updated_at",
}

BUSINESS_KEYS = {
    "agent_tier": {"tier_code"},
    "price_ladder": {"product_code", "ladder_tier"},
    "price_line": {"product_code", "line_type"},
    "rebate_rule": {"role", "rebate_type"},
    "deposit_rule": {"role", "deposit_type"},
    "protection_policy": {"customer_type"},
    "region_grade": {"grade"},
    "banned_term": {"term"},
}


def test_metadata_has_8_tables() -> None:
    assert EXPECTED_TABLES <= set(Base.metadata.tables)


def test_each_table_has_versioning_columns() -> None:
    for name in EXPECTED_TABLES:
        table = Base.metadata.tables[name]
        columns = set(table.columns.keys())
        assert VERSIONED_COLUMNS <= columns, name


def test_each_table_has_business_keys() -> None:
    for name, keys in BUSINESS_KEYS.items():
        table = Base.metadata.tables[name]
        assert keys <= set(table.columns.keys()), name


def test_rule_status_enum_values() -> None:
    assert {item.value for item in RuleStatus} == {"draft", "active", "superseded"}


def test_partial_active_unique_index_present() -> None:
    """每表有 'active' 部分唯一索引（DB 层保证同一规则同一时刻至多一条 active）。"""
    for name in EXPECTED_TABLES:
        table = Base.metadata.tables[name]
        assert any("active" in index.name for index in table.indexes), name


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


def test_offline_sql_creates_all_tables() -> None:
    sql = _offline_sql()
    for name in EXPECTED_TABLES:
        assert f"CREATE TABLE {name}" in sql, name


def test_offline_sql_has_partial_active_index() -> None:
    sql = _offline_sql()
    assert "WHERE status = 'active'" in sql
