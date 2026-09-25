"""TASK-0001 骨架冒烟测试：模块可导入、config fail-closed、无 SQLite 兜底。

验收对应：AC-001 / AC-002 / AC-003（卡 docs/tasks/active/TASK-0001-skeleton.md）。
"""

import pytest


def test_package_imports() -> None:
    """AC-001/AC-002：全部模块可导入。"""
    import channel
    from channel import application, config, domain, persistence, policy, web

    assert channel.__version__ == "0.1.0"
    for module in (config, domain, application, policy, persistence, web):
        assert module is not None


def test_config_rejects_missing_db_fields() -> None:
    """AC-003a：缺必填 DB 字段 → 抛异常。"""
    from channel.config import Settings

    with pytest.raises(ValueError, match="missing required database settings"):
        Settings(db_host="", db_name="", db_user="", db_password="")


def test_config_rejects_blank_password() -> None:
    """AC-003b：密码为空 → 抛异常。"""
    from channel.config import Settings

    with pytest.raises(ValueError, match="db_password must not be blank"):
        Settings(db_host="localhost", db_name="dls", db_user="app", db_password="")


def test_config_rejects_sqlite() -> None:
    """AC-003c：无 SQLite 兜底。"""
    from channel.config import Settings

    with pytest.raises(ValueError, match="sqlite is not a supported backend"):
        Settings(
            db_host="localhost",
            db_name="sqlite.db",
            db_user="app",
            db_password="secret",
        )


def test_config_builds_postgres_url() -> None:
    """AC-003d：合法配置 → PostgreSQL 连接串。"""
    from channel.config import Settings

    settings = Settings(
        db_host="localhost",
        db_port=5432,
        db_name="dls",
        db_user="app",
        db_password="secret",
        db_sslmode="require",
    )
    assert settings.database_url == (
        "postgresql+psycopg://app:secret@localhost:5432/dls?sslmode=require"
    )
    assert "sqlite" not in settings.database_url
