import os
import subprocess
import sys
from pathlib import Path

import pytest
import sqlalchemy as sa

from crm.config import Settings


PROJECT_ROOT = Path(__file__).resolve().parents[1]
USER_TABLES = {
    "audit_events",
    "contacts",
    "follow_up_activities",
    "follow_up_activity_revisions",
    "institution_owner_history",
    "institutions",
    "operation_records",
    "role_grants",
    "server_sessions",
    "user_identities",
}


def offline_environment() -> dict[str, str]:
    return os.environ | {
        "CRM_ENVIRONMENT": "test",
        "DATABASE_HOST": "127.0.0.1",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "anqiao_crm_offline_test",
        "DATABASE_USER": "anqiao_crm_test",
        "DATABASE_PASSWORD": "offline-sentinel-not-secret",
        "DATABASE_SSLMODE": "disable",
        "AI_ENABLED": "false",
    }


def run_alembic(*arguments: str, environment: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "alembic", *arguments],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_offline_upgrade_sql_is_complete_and_secret_free() -> None:
    environment = offline_environment()
    result = run_alembic("upgrade", "heads", "--sql", environment=environment)

    assert result.returncode == 0
    assert "CREATE TABLE user_identities" in result.stdout
    assert "CREATE TABLE server_sessions" in result.stdout
    assert "INSERT INTO alembic_version" in result.stdout
    assert environment["DATABASE_PASSWORD"] not in result.stdout
    assert environment["DATABASE_PASSWORD"] not in result.stderr


@pytest.mark.skipif(
    os.getenv("CRM_RUN_POSTGRESQL_TESTS") != "1",
    reason="requires the isolated local PostgreSQL migration-test database",
)
def test_postgresql_upgrade_downgrade_upgrade_round_trip() -> None:
    settings = Settings()
    assert settings.crm_environment == "test"
    assert settings.database_name.endswith("_test")
    environment = os.environ.copy()

    first_upgrade = run_alembic("upgrade", "head", environment=environment)
    assert first_upgrade.returncode == 0

    engine = sa.create_engine(settings.database_url)
    try:
        with engine.connect() as connection:
            assert USER_TABLES <= set(sa.inspect(connection).get_table_names())

        downgrade = run_alembic("downgrade", "base", environment=environment)
        assert downgrade.returncode == 0

        with engine.connect() as connection:
            assert not (USER_TABLES & set(sa.inspect(connection).get_table_names()))

        second_upgrade = run_alembic("upgrade", "head", environment=environment)
        assert second_upgrade.returncode == 0

        schema_check = run_alembic("check", environment=environment)
        assert schema_check.returncode == 0

        with engine.connect() as connection:
            assert USER_TABLES <= set(sa.inspect(connection).get_table_names())
    finally:
        engine.dispose()
