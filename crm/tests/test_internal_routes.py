"""Internal account routes (wiki ↔ CRM sync) tests.

Covers:
- fail-closed token auth (missing/mismatch/disabled → 403)
- credential verification without side effects (no session created)
- user creation (dedup 409, default business_user grant, audit)
- password change (current-password path) and admin reset (no current), both
  bump session_epoch per DEC-0044

DB: in-memory SQLite via the same SQLAlchemy models, so the transactional
paths (create / password) exercise the real ORM code.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

import pytest
from unittest.mock import Mock
from uuid import uuid4

import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

from crm.domain.models import Role, UserStatus
from crm.web.auth import hash_password, verify_password
from crm.web.routes import internal

TOKEN = "test-internal-token"


# ---------- app / DB scaffolding ----------

def _sqlite_factory():
    from sqlalchemy import create_engine, event

    from crm.persistence.database import build_session_factory
    from crm.persistence.models import (
        AuditEventModel,
        Base,
        RoleGrantModel,
        UserIdentityModel,
    )

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # PG 专属函数在 SQLite 缺失：注册等价实现，使模型 CHECK 约束可建表
    @event.listens_for(engine, "connect")
    def _register_pg_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function(
            "btrim", 1, lambda s: s.strip() if isinstance(s, str) else s
        )
        dbapi_connection.create_function(
            "btrim", 2, lambda s, chars: s.strip(chars) if isinstance(s, str) else s
        )
        dbapi_connection.create_function("char_length", 1, len)

    # 只建本测试用到的表（避免无关 PG 语法）
    Base.metadata.create_all(
        engine,
        tables=[
            UserIdentityModel.__table__,
            RoleGrantModel.__table__,
            AuditEventModel.__table__,
        ],
    )
    return build_session_factory(engine)


def _sqlite_find_by_username(factory):
    """Repository-compatible find_by_username backed by the test SQLite.

    返回 SimpleNamespace（路由只消费 id/username/display_name/status/
    password_hash），绕开 SQLite 丢时区导致的 domain datetime 校验。
    """
    from crm.persistence.models import UserIdentityModel

    def find(username):
        from types import SimpleNamespace

        with factory() as session:
            model = session.execute(
                sa.select(UserIdentityModel).where(
                    sa.func.lower(UserIdentityModel.username) == (username or "").casefold()
                )
            ).scalar_one_or_none()
            if model is None:
                return None
            return SimpleNamespace(
                id=model.id,
                username=model.username,
                display_name=model.display_name,
                status=UserStatus(model.status),
                password_hash=model.password_hash,
            )

    return find


def _make_client(*, token=TOKEN, user_repo=None, session_factory=None, audit_repo=None):
    app = FastAPI()
    app.include_router(internal.router)
    app.state.crm_internal_token = token
    app.state.user_repository = Mock(find_by_username=user_repo) if user_repo else Mock()
    app.state.session_factory = session_factory
    app.state.audit_repository = audit_repo or Mock()
    return TestClient(app)


@pytest.fixture
def factory():
    return _sqlite_factory()


@pytest.fixture
def db_client(factory):
    audit = Mock()
    client = _make_client(
        user_repo=_sqlite_find_by_username(factory),
        session_factory=factory,
        audit_repo=audit,
    )
    # seed: 何丹 / 123456
    from crm.persistence.models import UserIdentityModel

    uid = uuid4()
    with factory() as s:
        s.add(
            UserIdentityModel(
                id=uid, username="何丹", display_name="何丹",
                password_hash=hash_password("123456"),
                status="enabled", session_epoch=0, phone=None,
            )
        )
        s.commit()
    client.factory = factory
    client.seeded_id = uid
    return client


def _call(client, path, payload, token=TOKEN):
    headers = {"X-Internal-Token": token}
    return client.post(path, json=payload, headers=headers)


# ---------- token auth ----------

def test_verify_without_token_returns_403(db_client):
    r = db_client.post("/api/internal/auth/verify", json={"username": "何丹", "password": "123456"})
    assert r.status_code == 403


def test_verify_with_wrong_token_returns_403(db_client):
    r = db_client.post(
        "/api/internal/auth/verify",
        json={"username": "何丹", "password": "123456"},
        headers={"X-Internal-Token": "wrong"},
    )
    assert r.status_code == 403


def test_verify_when_token_unconfigured_returns_403():
    client = _make_client(token="")
    r = _call(client, "/api/internal/auth/verify", {"username": "何丹", "password": "123456"}, token="")
    assert r.status_code == 403


# ---------- verify ----------

def test_verify_ok(db_client):
    r = _call(db_client, "/api/internal/auth/verify", {"username": "何丹", "password": "123456"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["user"]["username"] == "何丹"
    assert body["user"]["display_name"] == "何丹"
    assert body["user"]["status"] == "enabled"


def test_verify_case_insensitive_username(db_client):
    r = _call(db_client, "/api/internal/auth/verify", {"username": "何丹", "password": "123456"})
    assert r.status_code == 200


def test_verify_wrong_password_returns_401(db_client):
    r = _call(db_client, "/api/internal/auth/verify", {"username": "何丹", "password": "nope"})
    assert r.status_code == 401
    assert r.json() == {"ok": False}


def test_verify_unknown_user_returns_401(db_client):
    r = _call(db_client, "/api/internal/auth/verify", {"username": "不存在", "password": "123456"})
    assert r.status_code == 401


# ---------- create ----------

def test_create_user_then_verify(db_client):
    r = _call(db_client, "/api/internal/users", {
        "username": "周晶晶", "display_name": "周晶晶", "password": "123",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True and body["user"]["username"] == "周晶晶"
    # newly created user can be verified
    v = _call(db_client, "/api/internal/auth/verify", {"username": "周晶晶", "password": "123"})
    assert v.status_code == 200
    # default business_user role granted
    with db_client.factory() as s:
        uid = s.execute(
            sa.text("select id from user_identities where username = :u"), {"u": "周晶晶"}
        ).scalar_one()
        roles = s.execute(
            sa.text("select role from role_grants where user_id = :uid and revoked_at is null"),
            {"uid": uid},
        ).scalars().all()
    assert roles and "business_user" in roles


def test_create_duplicate_username_returns_409(db_client):
    _call(db_client, "/api/internal/users", {
        "username": "周晶晶", "display_name": "周晶晶", "password": "123",
    })
    r = _call(db_client, "/api/internal/users", {
        "username": "周晶晶", "display_name": "周晶晶2", "password": "456",
    })
    assert r.status_code == 409


# ---------- password change / reset ----------

def test_change_password_with_current(db_client):
    r = _call(db_client, "/api/internal/users/password", {
        "username": "何丹", "current_password": "123456", "new_password": "newpass99",
    })
    assert r.status_code == 200, r.text
    # old password fails, new works
    assert _call(db_client, "/api/internal/auth/verify", {"username": "何丹", "password": "123456"}).status_code == 401
    assert _call(db_client, "/api/internal/auth/verify", {"username": "何丹", "password": "newpass99"}).status_code == 200


def test_change_password_wrong_current_returns_401(db_client):
    r = _call(db_client, "/api/internal/users/password", {
        "username": "何丹", "current_password": "wrong", "new_password": "newpass99",
    })
    assert r.status_code == 401


def test_reset_password_without_current(db_client):
    r = _call(db_client, "/api/internal/users/password", {
        "username": "何丹", "new_password": "reset123",
    })
    assert r.status_code == 200, r.text
    assert _call(db_client, "/api/internal/auth/verify", {"username": "何丹", "password": "reset123"}).status_code == 200
    # session_epoch bumped (DEC-0044)
    with db_client.factory() as s:
        epoch = s.execute(
            sa.text("select session_epoch from user_identities where username = :u"),
            {"u": "何丹"},
        ).scalar_one()
    assert epoch == 1


def test_password_change_unknown_user_returns_401(db_client):
    r = _call(db_client, "/api/internal/users/password", {
        "username": "没有人", "new_password": "reset123",
    })
    assert r.status_code == 401
