"""SQLAlchemy 引擎与会话工厂接线（import 时不建立真实连接）。

依据：DEC-0011（PostgreSQL 16 + Alembic）。
"""

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from channel.config import Settings


def build_engine(settings: Settings) -> Engine:
    """从已验证的 Settings 创建 PostgreSQL 引擎。"""
    return create_engine(settings.database_url, pool_pre_ping=True)


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    """创建绑定到指定引擎的会话工厂。"""
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
