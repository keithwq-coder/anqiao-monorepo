"""数据库连接 & 会话管理"""

from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import config
from db.models import Base

# 确保数据目录存在
DB_PATH = Path(config.DB_PATH)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# 创建引擎
engine = create_engine(
    config.DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # SQLite 需要
)

# 会话工厂
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db() -> None:
    """初始化数据库：创建所有表，并对已有库幂等补列"""
    Base.metadata.create_all(bind=engine)
    _migrate_columns()


def _migrate_columns() -> None:
    """对已存在的 opportunities 表幂等补充新增列（SQLite ALTER TABLE）"""
    insp = inspect(engine)
    if "opportunities" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("opportunities")}
    migrations = [
        ("grade", "INTEGER"),
        ("grade_reason", "TEXT"),
    ]
    with engine.begin() as conn:
        for col, coltype in migrations:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE opportunities ADD COLUMN {col} {coltype}"))


def get_session():
    """获取数据库会话（用于 FastAPI 依赖注入）"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
