import pytest
from pydantic import ValidationError

from crm.config import Settings


BASE_VALUES = {
    "crm_environment": "test",
    "database_host": "127.0.0.1",
    "database_port": 5432,
    "database_name": "anqiao_crm_synthetic_test",
    "database_user": "anqiao_crm_test",
    "database_password": "synthetic-test-password",
    "database_sslmode": "disable",
    "ai_enabled": False,
}


def build_settings(**overrides: object) -> Settings:
    values = BASE_VALUES | overrides
    return Settings(**values)


@pytest.mark.parametrize(
    "field_name",
    ["database_host", "database_name", "database_user", "database_password"],
)
def test_required_database_value_cannot_be_missing(
    field_name: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(field_name.upper(), raising=False)
    values = BASE_VALUES.copy()
    del values[field_name]

    with pytest.raises(ValidationError):
        Settings(**values)


def test_database_url_hides_password_and_offline_url_omits_it() -> None:
    settings = build_settings(database_password="synthetic-visible-only-to-test")

    assert "synthetic-visible-only-to-test" not in str(settings.database_url)
    assert "***" in str(settings.database_url)
    assert settings.offline_database_url.password is None
    assert "synthetic-visible-only-to-test" not in repr(settings)


def test_false_ai_environment_value_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in {
        "CRM_ENVIRONMENT": "test",
        "DATABASE_HOST": "127.0.0.1",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "anqiao_crm_synthetic_test",
        "DATABASE_USER": "anqiao_crm_test",
        "DATABASE_PASSWORD": "synthetic-test-password",
        "DATABASE_SSLMODE": "disable",
        "AI_ENABLED": "false",
    }.items():
        monkeypatch.setenv(name, value)

    assert Settings().ai_enabled is False


def test_ai_enabled_per_dec_0162_0163() -> None:
    # DEC-0162 + DEC-0163 (product-owner "确认 P0+P1，provider 用 glm-5.2",
    # 2026-08-23) authorize real external AI integration when configured via
    # runtime env. `ai_enabled` is the config gate; the
    # `CRM_AI_REASON_NETWORK_ALLOWED` flag (TASK-0042 / DEC-0164) plus the
    # blank-value validators enforce fail-closed behavior. The legacy
    # `reject_enabled_ai` validator was removed in this change.
    settings = build_settings(ai_enabled=True)

    assert settings.ai_enabled is True
