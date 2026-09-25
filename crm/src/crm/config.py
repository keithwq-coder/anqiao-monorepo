"""Fail-closed runtime configuration for MySQL environments."""

from functools import cached_property
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    """Configuration loaded from process environment or explicit test values."""

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
        frozen=True,
    )

    crm_environment: Literal["development", "test", "production"] = "development"
    database_host: str
    database_port: int = Field(default=3306, ge=1, le=65535)
    database_name: str
    database_user: str
    database_password: SecretStr
    database_sslmode: Literal["disable", "prefer", "require"] = "prefer"  # PG 遗留字段，MySQL 驱动不再使用
    ai_enabled: bool = False
    # 培训 wiki ↔ CRM 内部同步接口的鉴权 token（空 = 禁用内部接口，一律 403）
    crm_internal_token: SecretStr = SecretStr("")

    @field_validator("database_host", "database_name", "database_user")
    @classmethod
    def reject_blank_database_values(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("database configuration values must not be blank")
        return normalized

    @field_validator("database_password")
    @classmethod
    def reject_blank_password(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value():
            raise ValueError("database password must be supplied at runtime")
        return value

    @field_validator("ai_enabled")
    @classmethod
    def allow_enabled_ai(cls, value: bool) -> bool:
        # Gate opened per product-owner authorization (DEC-0162/DEC-0163,
        # 2026-08-24): real external AI integration is permitted when configured
        # via runtime env. Fail-closed behavior is still enforced by the
        # provider/network gates in `crm.ai.wiring`
        # (`CRM_AI_REASON_NETWORK_ALLOWED`, per TASK-0042 / DEC-0164) and by
        # `reject_blank_*` validators; the API key is never in repo/logs.
        return value

    @property
    def debug_mode(self) -> bool:
        """Derived from ``crm_environment``; true only for development.

        Drives local reload/logging behavior. Not a configuration variable:
        it is never read from the environment.
        """
        return self.crm_environment == "development"

    @property
    def production_mode(self) -> bool:
        """Derived from ``crm_environment``; true only for production.

        Not a configuration variable: it is never read from the environment.
        """
        return self.crm_environment == "production"

    @cached_property
    def database_url(self) -> URL:
        return URL.create(
            drivername="mysql+pymysql",
            username=self.database_user,
            password=self.database_password.get_secret_value(),
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
            query={"charset": "utf8mb4"},
        )

    @cached_property
    def offline_database_url(self) -> URL:
        """Return a secret-free MySQL URL for offline SQL generation."""
        return URL.create(
            drivername="mysql+pymysql",
            username=self.database_user,
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
            query={"charset": "utf8mb4"},
        )
