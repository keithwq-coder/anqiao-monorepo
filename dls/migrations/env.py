"""Alembic 环境。运行时 URL 来自 channel.config.Settings。

离线模式渲染 SQL 时不包含仓库内密钥：URL 由环境变量实时构建，
本仓库不存储任何真实凭据（.env 不入库，见 .gitignore）。
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from channel.config import Settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ORM metadata 在后续任务（实体引入）时接入
target_metadata = None


def run_migrations_offline() -> None:
    """离线模式：不连接数据库，仅输出 SQL。"""
    settings = Settings()
    context.configure(
        url=settings.database_url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：连接数据库执行迁移。"""
    settings = Settings()
    engine = create_engine(settings.database_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
