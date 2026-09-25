"""运行时配置。fail-closed：数据库配置必填、拒绝空值、无 SQLite 兜底。

依据：DEC-0011（PostgreSQL 为唯一后端）、项目约束.md 第 2 节事实 20。
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REQUIRED_DB_FIELDS = ("db_host", "db_name", "db_user")


class Settings(BaseSettings):
    """应用配置，从环境变量（前缀 DLS_）或 .env 加载。

    数据库连接项全部必填且非空；**不存在 SQLite 或其他后端兜底**。
    空值或非法后端在配置加载时即抛异常（fail-closed）。
    """

    model_config = SettingsConfigDict(
        env_prefix="DLS_",
        env_file=".env",
        extra="ignore",
    )

    db_host: str = ""
    db_port: int = 5432
    db_name: str = ""
    db_user: str = ""
    db_password: str = ""
    db_sslmode: str = "require"
    debug_mode: bool = False

    @model_validator(mode="after")
    def _fail_closed(self) -> "Settings":
        missing = [name for name in REQUIRED_DB_FIELDS if not getattr(self, name)]
        if missing:
            raise ValueError(
                f"missing required database settings: {', '.join(missing)}"
            )
        if not self.db_password:
            raise ValueError("db_password must not be blank")
        lowered = (self.db_host + self.db_name).lower()
        if "sqlite" in lowered:
            raise ValueError("sqlite is not a supported backend")
        return self

    @property
    def database_url(self) -> str:
        """PostgreSQL 连接串（psycopg3 驱动）。"""
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )
