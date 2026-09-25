"""PostgreSQL engine and explicit transaction lifecycle."""

import hashlib
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from crm.config import Settings


# Cached session factories, keyed on every resolved configuration dimension
# (host, port, database, user, sslmode, password digest) so a changed
# configuration rebuilds its engine instead of silently reusing a stale one.
# Each factory owns one engine and its connection pool.
_factories: dict[tuple, sessionmaker[Session]] = {}


def _cache_key(settings: Settings) -> tuple:
    """Stable, secret-free cache key covering every resolved configuration
    dimension, including the password as a digest, so a changed configuration
    rebuilds its engine instead of silently reusing a stale one.
    """
    password = settings.database_password.get_secret_value()
    return (
        settings.database_host,
        settings.database_port,
        settings.database_name,
        settings.database_user,
        settings.database_sslmode,
        hashlib.sha256(password.encode("utf-8")).hexdigest(),
    )


def get_session_factory(settings: Settings) -> sessionmaker[Session]:
    """Get or create the cached session factory for the given settings.

    The cache is keyed on every resolved configuration dimension (host, port,
    database, user, sslmode, password digest): calling with a different
    configuration builds a fresh engine rather than returning the cached
    factory for an older configuration.
    """
    key = _cache_key(settings)
    factory = _factories.get(key)
    if factory is None:
        engine = build_engine(settings)
        factory = build_session_factory(engine)
        _factories[key] = factory
    return factory


# For backwards compatibility with existing code that expects SessionLocal.
# Each call still returns a new session, but the underlying engine (and its
# connection pool) is reused per resolved configuration.
def SessionLocal():
    """Create and return a new database session backed by the cached factory.

    Reuses the cached session factory for the resolved settings instead of
    building a new engine (and a new connection pool) on every call.

    Requires environment variables to be set (DATABASE_HOST, DATABASE_NAME, etc.)

    Returns:
        A new SQLAlchemy Session object that can be used in 'with' statements.
    """
    from crm.config import Settings

    # Create settings from environment - will fail if not properly configured
    settings = Settings()
    return get_session_factory(settings)()


def build_engine(settings: Settings, *, echo: bool = False) -> Engine:
    return create_engine(
        settings.database_url,
        echo=echo,
        pool_pre_ping=True,
    )


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


@contextmanager
def transaction_session(factory: sessionmaker[Session]) -> Iterator[Session]:
    session = factory()
    try:
        with session.begin():
            yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
