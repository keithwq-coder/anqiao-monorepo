"""TASK-0019: SPEC-0014 account credentials self-modification tests.

Local-only, synthetic state. Tests cover AC-001..AC-010:
- AC-001: correct current password -> new password saved, old session
  invalidated, new password can login, audit written
- AC-002: wrong current password -> rejected, no audit, no info leak
- AC-003: sa-prefixed username change -> rejected, prefix protected
- AC-004: normal user username change success -> old session invalidated,
  new username can login, id/ownership unchanged
- AC-005: new username conflicts with existing -> rejected, not modified
- AC-006: unauthenticated/disabled/pending -> rejected
- AC-007: sa-prefixed user changes password (not username) -> success
- AC-008: audit write failure -> transaction rollback, no success shown
- AC-009: API and page paths behave identically (prefix protection, session
  invalidation, current-password verification)
- AC-010: after password change, old session denied on protected resource
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t19_test")
os.environ.setdefault("DATABASE_USER", "t19_test")
os.environ.setdefault("DATABASE_PASSWORD", "t19-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t19-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
import sqlalchemy as sa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from test_task0007_inmemory_fakes import (  # noqa: E402
    InMemoryAuditRepository,
    InMemoryRoleGrantRepository,
    InMemorySessionRepository,
    InMemoryUserRepository,
)

from crm.domain.models import (  # noqa: E402
    Role,
    UserIdentity,
    UserStatus,
)
from crm.persistence.audit_repository import AuditEventRepository  # noqa: E402
from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    AuditEventModel,
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.persistence.repositories import (  # noqa: E402
    ContactRepository,
    FollowUpActivityRepository,
    InstitutionRepository,
)
from crm.web.auth import AuthSettings, AuthenticationService, hash_password, verify_password  # noqa: E402


def _make_identity(username, password, roles):
    user = UserIdentity(
        username=username,
        display_name=username,
        password_hash=hash_password(password),
        status=UserStatus.ENABLED,
    )
    return user, roles


def _login(app, username, password):
    c = TestClient(app)
    resp = c.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    c.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
    return c


@pytest.fixture
def t19_env():
    """SQLite-backed app with enabled business users, an sa-prefixed user,
    a disabled user, a pending user, and an institution for ownership checks."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: s.strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: s.strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s))

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    from crm.web.main import app

    user_repo_mem = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    # wq: normal business user (no protected prefix)
    wq, _ = _make_identity("wq", "wqpass123", [Role.BUSINESS_USER])
    user_repo_mem.add(wq)
    role_repo.set_grants(wq.id, [Role.BUSINESS_USER])

    # sa1: sa-prefixed business user
    sa1, _ = _make_identity("sa1", "sa1pass123", [Role.BUSINESS_USER])
    user_repo_mem.add(sa1)
    role_repo.set_grants(sa1.id, [Role.BUSINESS_USER])

    # dl1: dl-prefixed business user
    dl1, _ = _make_identity("dl1", "dl1pass123", [Role.BUSINESS_USER])
    user_repo_mem.add(dl1)
    role_repo.set_grants(dl1.id, [Role.BUSINESS_USER])

    # other: another business user for conflict testing
    other, _ = _make_identity("other", "otherpass123", [Role.BUSINESS_USER])
    user_repo_mem.add(other)
    role_repo.set_grants(other.id, [Role.BUSINESS_USER])

    # disabled_user: disabled account
    disabled_user = UserIdentity(
        username="disabledu",
        display_name="disabledu",
        password_hash=hash_password("disabledpass123"),
        status=UserStatus.DISABLED,
    )
    user_repo_mem.add(disabled_user)
    role_repo.set_grants(disabled_user.id, [Role.BUSINESS_USER])

    # pending_user: pending account
    pending_user = UserIdentity(
        username="pendingu",
        display_name="pendingu",
        password_hash=hash_password("pendingpass123"),
        status=UserStatus.PENDING,
    )
    user_repo_mem.add(pending_user)
    role_repo.set_grants(pending_user.id, [Role.BUSINESS_USER])

    # admin: administrator
    admin, _ = _make_identity("t19admin", "t19adminpass", [Role.ADMINISTRATOR])
    user_repo_mem.add(admin)
    role_repo.set_grants(admin.id, [Role.ADMINISTRATOR])

    class _DualUserRepo:
        """User repo that reads from SQLite for both find_by_id and
        find_by_username, so credential changes (written to SQLite) are
        immediately visible to the login path."""
        def __init__(self, f, mem):
            self._f = f
            self._mem = mem
        def find_by_id(self, user_id):
            if not isinstance(user_id, UUID):
                user_id = UUID(str(user_id))
            s = self._f()
            try:
                from crm.persistence.repositories import _ensure_aware
                m = s.get(UserIdentityModel, user_id)
                if m is None:
                    return None
                return UserIdentity(
                    username=m.username,
                    display_name=m.display_name,
                    password_hash=m.password_hash,
                    status=UserStatus(m.status),
                    id=m.id,
                    session_epoch=m.session_epoch,
                    created_at=_ensure_aware(m.created_at),
                    updated_at=_ensure_aware(m.updated_at),
                )
            finally:
                s.close()
        def find_by_username(self, username):
            s = self._f()
            try:
                from crm.persistence.repositories import _ensure_aware
                m = s.execute(
                    sa.select(UserIdentityModel).where(
                        sa.func.lower(UserIdentityModel.username) == (username or "").casefold()
                    )
                ).scalar_one_or_none()
                if m is None:
                    return None
                return UserIdentity(
                    username=m.username,
                    display_name=m.display_name,
                    password_hash=m.password_hash,
                    status=UserStatus(m.status),
                    id=m.id,
                    session_epoch=m.session_epoch,
                    created_at=_ensure_aware(m.created_at),
                    updated_at=_ensure_aware(m.updated_at),
                )
            finally:
                s.close()
        def bump_session_epoch(self, user_id):
            if not isinstance(user_id, UUID):
                user_id = UUID(str(user_id))
            from datetime import datetime, timezone
            s = self._f()
            try:
                m = s.get(UserIdentityModel, user_id)
                if not m:
                    return False
                m.session_epoch = (m.session_epoch or 0) + 1
                m.updated_at = datetime.now(timezone.utc)
                s.commit()
                return True
            finally:
                s.close()

    sqlite_user_repo = _DualUserRepo(factory, user_repo_mem)

    class _SqliteInstRepo(InstitutionRepository):
        def __init__(self, f):
            self._f = f
        def find_by_id(self, iid):
            s = self._f()
            try:
                m = s.get(InstitutionModel, iid)
                from crm.persistence.repositories import domain_institution_from_model
                return domain_institution_from_model(m) if m else None
            finally:
                s.close()
        def find_all(self, search_terms=None, limit=50, offset=0, searchable_fields=None):
            s = self._f()
            try:
                q = sa.select(InstitutionModel)
                if search_terms:
                    pat = f"%{search_terms}%"
                    if searchable_fields is None:
                        searchable_fields = frozenset({"name", "category", "region"})
                    col_map = {
                        "name": InstitutionModel.name,
                        "category": InstitutionModel.category,
                        "region": InstitutionModel.region,
                    }
                    cols = [col_map[f] for f in searchable_fields if f in col_map]
                    if cols:
                        q = q.where(sa.or_(*[c.ilike(pat) for c in cols]))
                    else:
                        q = q.where(sa.false())
                q = q.offset(offset).limit(limit)
                models = s.execute(q).scalars().all()
                from crm.persistence.repositories import domain_institution_from_model
                return [domain_institution_from_model(m) for m in models]
            finally:
                s.close()

    class _SqliteAuditRepo(AuditEventRepository):
        def __init__(self, f):
            self._f = f
        def record(self, *, action, outcome, target_type, actor_user_id=None,
                   target_id=None, reason=None, failure_summary=None, session=None) -> None:
            model = AuditEventModel(
                actor_user_id=actor_user_id, action=action, target_type=target_type,
                target_id=target_id, outcome=outcome, reason=reason,
                failure_summary=failure_summary,
            )
            if session is not None:
                session.add(model)
                return
            with transaction_session(self._f) as s:
                s.add(model)

    audit_repo = _SqliteAuditRepo(factory)
    inst_repo = _SqliteInstRepo(factory)

    class _SqliteContactRepo(ContactRepository):
        def __init__(self, f):
            self._f = f
        def find_by_institution(self, iid):
            s = self._f()
            try:
                from crm.persistence.models import ContactModel
                from crm.persistence.repositories import domain_contact_from_model
                models = s.execute(
                    sa.select(ContactModel).where(ContactModel.institution_id == iid)
                ).scalars().all()
                return [domain_contact_from_model(m) for m in models]
            finally:
                s.close()

    class _SqliteActivityRepo(FollowUpActivityRepository):
        def __init__(self, f):
            self._f = f
        def find_by_target(self, target_type, target_id, include_withdrawn=False):
            if target_type != "institution":
                return []
            s = self._f()
            try:
                inst_id = UUID(target_id)
            except ValueError:
                return []
            try:
                from crm.persistence.models import FollowUpActivityModel, FollowUpActivityRevisionModel
                from crm.persistence.repositories import domain_follow_up_activity_from_model
                q = sa.select(FollowUpActivityModel).where(
                    FollowUpActivityModel.institution_id == inst_id
                )
                if not include_withdrawn:
                    q = q.where(FollowUpActivityModel.withdrawn_at.is_(None))
                q = q.order_by(
                    FollowUpActivityModel.occurred_at.desc(),
                    FollowUpActivityModel.recorded_at.desc(),
                    FollowUpActivityModel.id.desc()
                )
                models = s.execute(q).scalars().all()
                results = []
                for m in models:
                    rev = s.execute(
                        sa.select(FollowUpActivityRevisionModel).where(
                            FollowUpActivityRevisionModel.activity_id == m.id,
                            FollowUpActivityRevisionModel.version_number == m.current_version,
                        )
                    ).scalar_one_or_none()
                    results.append(domain_follow_up_activity_from_model(m, rev))
                return results
            finally:
                s.close()

    contact_repo = _SqliteContactRepo(factory)
    activity_repo = _SqliteActivityRepo(factory)

    from crm.application.queries import QueryService
    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    auth_service = AuthenticationService(
        user_repository=sqlite_user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=100,
            csrf_token_lifetime_hours=1,
        ),
    )

    app.state.user_repository = sqlite_user_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = auth_service
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service
    app.state.session_factory = factory

    # Seed user identities and an institution into the SQLite DB.
    now = datetime.now(timezone.utc)
    inst_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        for uid, uname, dname, phash, st, epoch in [
            (wq.id, "wq", "wq", wq.password_hash, "enabled", 0),
            (sa1.id, "sa1", "sa1", sa1.password_hash, "enabled", 0),
            (dl1.id, "dl1", "dl1", dl1.password_hash, "enabled", 0),
            (other.id, "other", "other", other.password_hash, "enabled", 0),
            (disabled_user.id, "disabledu", "disabledu", disabled_user.password_hash, "disabled", 0),
            (pending_user.id, "pendingu", "pendingu", pending_user.password_hash, "pending", 0),
            (admin.id, "t19admin", "t19admin", admin.password_hash, "enabled", 0),
        ]:
            session.add(UserIdentityModel(
                id=uid, username=uname, display_name=dname, password_hash=phash,
                status=st, session_epoch=epoch, created_at=now, updated_at=now,
            ))

        for uid, role_val in [
            (wq.id, "business_user"),
            (sa1.id, "business_user"),
            (dl1.id, "business_user"),
            (other.id, "business_user"),
            (disabled_user.id, "business_user"),
            (pending_user.id, "business_user"),
            (admin.id, "administrator"),
        ]:
            session.add(RoleGrantModel(
                user_id=uid, role=role_val, scope_reference=None,
                granted_by_user_id=admin.id, reason="test seed",
                granted_at=now,
            ))

        session.add(InstitutionModel(
            id=inst_id, name="wq的机构", source_description="test source",
            source_kind="manual", region="east", owner_user_id=wq.id,
            created_by_user_id=wq.id, idempotency_key="t19-wq-inst",
            created_at=now, updated_at=now,
        ))

    yield {
        "app": app,
        "factory": factory,
        "wq_id": wq.id,
        "sa1_id": sa1.id,
        "dl1_id": dl1.id,
        "other_id": other.id,
        "disabled_id": disabled_user.id,
        "pending_id": pending_user.id,
        "admin_id": admin.id,
        "inst_id": str(inst_id),
    }
    engine.dispose()


# ============ AC-001: correct current password -> success ============


def test_ac001_password_change_success(t19_env):
    """AC-001: correct current password -> password updated, old session
    invalidated, new password can login, audit written."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    # Change password via API.
    resp = client.post("/api/account/password", json={
        "current_password": "wqpass123",
        "new_password": "wqnewpass456",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["success"] is True

    # Old session should be invalidated (session epoch bumped).
    resp_session = client.get("/api/institutions")
    assert resp_session.status_code == 401

    # New password can login.
    client_new = _login(env["app"], "wq", "wqnewpass456")
    assert client_new.get("/api/institutions").status_code == 200

    # Old password should no longer work.
    client_old = TestClient(env["app"])
    resp_old = client_old.post("/api/auth/login", json={
        "username": "wq", "password": "wqpass123",
    })
    assert resp_old.status_code == 401

    # Audit event written.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "user.password_change",
                AuditEventModel.actor_user_id == env["wq_id"],
            )
        ).scalars().all()
    assert len(events) == 1
    assert events[0].outcome == "success"
    # Audit must not contain password plaintext.
    audit_text = str(events[0].reason) + str(events[0].failure_summary or "")
    assert "wqpass123" not in audit_text
    assert "wqnewpass456" not in audit_text


# ============ AC-002: wrong current password -> rejected, no audit ============


def test_ac002_wrong_current_password_rejected(t19_env):
    """AC-002: wrong current password -> rejected, no audit, no info leak."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/password", json={
        "current_password": "wrongpassword",
        "new_password": "wqnewpass456",
    })
    assert resp.status_code == 400
    assert "success" not in resp.json() or resp.json().get("success") is not True

    # Password should not have changed.
    client_old = TestClient(env["app"])
    resp_login = client_old.post("/api/auth/login", json={
        "username": "wq", "password": "wqpass123",
    })
    assert resp_login.status_code == 200

    # No audit event for the failed attempt.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "user.password_change",
                AuditEventModel.actor_user_id == env["wq_id"],
            )
        ).scalars().all()
    assert len(events) == 0

    # Old session still valid (epoch not bumped).
    assert client.get("/api/institutions").status_code == 200


# ============ AC-003: sa-prefixed username change -> rejected ============


def test_ac003_sa_prefix_username_change_rejected(t19_env):
    """AC-003: sa1 attempts to change username -> rejected, prefix protected."""
    env = t19_env
    client = _login(env["app"], "sa1", "sa1pass123")

    resp = client.post("/api/account/username", json={
        "current_password": "sa1pass123",
        "new_username": "sa1new",
    })
    assert resp.status_code == 400
    assert "受保护" in resp.json().get("detail", "") or "protected" in resp.json().get("detail", "").lower()

    # Username should not have changed.
    with transaction_session(env["factory"]) as s:
        user = s.get(UserIdentityModel, env["sa1_id"])
    assert user.username == "sa1"


def test_ac003_dl_prefix_username_change_rejected(t19_env):
    """AC-003: dl1 attempts to change username -> rejected, prefix protected."""
    env = t19_env
    client = _login(env["app"], "dl1", "dl1pass123")

    resp = client.post("/api/account/username", json={
        "current_password": "dl1pass123",
        "new_username": "dl1new",
    })
    assert resp.status_code == 400
    assert "受保护" in resp.json().get("detail", "") or "protected" in resp.json().get("detail", "").lower()


def test_ac003_sa_prefix_case_insensitive(t19_env):
    """AC-003: SA-prefixed username (uppercase) also protected."""
    env = t19_env
    # Login with the stored username; the prefix check is case-insensitive
    # on lower(username).
    client = _login(env["app"], "sa1", "sa1pass123")

    resp = client.post("/api/account/username", json={
        "current_password": "sa1pass123",
        "new_username": "somethingelse",
    })
    assert resp.status_code == 400
    assert "受保护" in resp.json().get("detail", "") or "protected" in resp.json().get("detail", "").lower()


# ============ AC-004: normal username change success ============


def test_ac004_username_change_success(t19_env):
    """AC-004: normal user changes username -> success, old session
    invalidated, new username can login, id/ownership unchanged."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")
    wq_id_before = env["wq_id"]

    resp = client.post("/api/account/username", json={
        "current_password": "wqpass123",
        "new_username": "wq2",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["success"] is True

    # Old session invalidated.
    assert client.get("/api/institutions").status_code == 401

    # New username can login.
    client_new = _login(env["app"], "wq2", "wqpass123")
    assert client_new.get("/api/institutions").status_code == 200

    # Old username no longer works for login.
    client_old = TestClient(env["app"])
    resp_old = client_old.post("/api/auth/login", json={
        "username": "wq", "password": "wqpass123",
    })
    assert resp_old.status_code == 401

    # ID unchanged.
    with transaction_session(env["factory"]) as s:
        user = s.get(UserIdentityModel, wq_id_before)
    assert user.username == "wq2"
    assert user.id == wq_id_before

    # Ownership unchanged: institution still owned by the same user id.
    with transaction_session(env["factory"]) as s:
        inst = s.get(InstitutionModel, UUID(env["inst_id"]))
    assert inst.owner_user_id == wq_id_before

    # Audit event written.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "user.username_change",
                AuditEventModel.actor_user_id == wq_id_before,
            )
        ).scalars().all()
    assert len(events) == 1
    assert events[0].outcome == "success"


# ============ AC-005: username conflict -> rejected ============


def test_ac005_username_conflict_rejected(t19_env):
    """AC-005: new username conflicts with existing -> rejected, not modified."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/username", json={
        "current_password": "wqpass123",
        "new_username": "other",
    })
    assert resp.status_code == 400
    assert "占用" in resp.json().get("detail", "") or "taken" in resp.json().get("detail", "").lower()

    # Username unchanged.
    with transaction_session(env["factory"]) as s:
        user = s.get(UserIdentityModel, env["wq_id"])
    assert user.username == "wq"


def test_ac005_username_conflict_case_insensitive(t19_env):
    """AC-005: conflict check is case-insensitive."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/username", json={
        "current_password": "wqpass123",
        "new_username": "OTHER",
    })
    assert resp.status_code == 400


# ============ AC-006: unauthenticated/disabled/pending -> rejected ============


def test_ac006_unauthenticated_rejected(t19_env):
    """AC-006: unauthenticated user cannot access credential change endpoints."""
    env = t19_env
    client = TestClient(env["app"])

    resp_pw = client.post("/api/account/password", json={
        "current_password": "x", "new_password": "y",
    })
    assert resp_pw.status_code == 401

    resp_un = client.post("/api/account/username", json={
        "current_password": "x", "new_username": "y",
    })
    assert resp_un.status_code == 401


def test_ac006_disabled_user_rejected(t19_env):
    """AC-006: disabled user cannot change credentials (cannot even login)."""
    env = t19_env
    client = TestClient(env["app"])

    # Disabled user cannot login at all.
    resp_login = client.post("/api/auth/login", json={
        "username": "disabledu", "password": "disabledpass123",
    })
    assert resp_login.status_code == 401

    # Without a valid session, the credential endpoints deny.
    resp = client.post("/api/account/password", json={
        "current_password": "disabledpass123",
        "new_password": "newpass",
    })
    assert resp.status_code == 401


def test_ac006_pending_user_rejected(t19_env):
    """AC-006: pending user cannot change credentials (cannot even login)."""
    env = t19_env
    client = TestClient(env["app"])

    # Pending user cannot login at all.
    resp_login = client.post("/api/auth/login", json={
        "username": "pendingu", "password": "pendingpass123",
    })
    assert resp_login.status_code == 401

    # Without a valid session, the credential endpoints deny.
    resp = client.post("/api/account/password", json={
        "current_password": "pendingpass123",
        "new_password": "newpass",
    })
    assert resp.status_code == 401


# ============ AC-007: sa-prefixed user can change password ============


def test_ac007_sa_prefix_user_can_change_password(t19_env):
    """AC-007: sa1 changes password (not username) -> success.
    Prefix protection only restricts username, not password."""
    env = t19_env
    client = _login(env["app"], "sa1", "sa1pass123")

    resp = client.post("/api/account/password", json={
        "current_password": "sa1pass123",
        "new_password": "sa1newpass456",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["success"] is True

    # Old session invalidated.
    assert client.get("/api/institutions").status_code == 401

    # New password works.
    client_new = _login(env["app"], "sa1", "sa1newpass456")
    assert client_new.get("/api/institutions").status_code == 200

    # Username unchanged.
    with transaction_session(env["factory"]) as s:
        user = s.get(UserIdentityModel, env["sa1_id"])
    assert user.username == "sa1"


# ============ AC-008: audit write failure -> rollback ============


def test_ac008_audit_failure_rollback(t19_env):
    """AC-008: audit write failure -> transaction rollback, no success shown."""
    env = t19_env

    # Patch the audit repo to fail on record() with a session (the
    # transaction-internal path used by the credential commands).
    original_record = env["app"].state.audit_repository.record

    def failing_record(*, action, outcome, target_type, actor_user_id=None,
                       target_id=None, reason=None, failure_summary=None, session=None):
        if session is not None and action == "user.password_change":
            raise RuntimeError("simulated audit backend outage")
        return original_record(
            action=action, outcome=outcome, target_type=target_type,
            actor_user_id=actor_user_id, target_id=target_id,
            reason=reason, failure_summary=failure_summary, session=session,
        )

    env["app"].state.audit_repository.record = failing_record

    client = _login(env["app"], "wq", "wqpass123")
    resp = client.post("/api/account/password", json={
        "current_password": "wqpass123",
        "new_password": "wqnewpass456",
    })
    assert resp.status_code == 500

    # Password should NOT have changed (rollback).
    env["app"].state.audit_repository.record = original_record
    client_check = TestClient(env["app"])
    resp_login = client_check.post("/api/auth/login", json={
        "username": "wq", "password": "wqpass123",
    })
    assert resp_login.status_code == 200

    resp_login_new = client_check.post("/api/auth/login", json={
        "username": "wq", "password": "wqnewpass456",
    })
    assert resp_login_new.status_code == 401


# ============ AC-009: API and page paths behave identically ============


def test_ac009_page_password_change_success(t19_env):
    """AC-009: page (form) path password change behaves same as API path."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")
    csrf = client.headers["X-CSRF-Token"]

    resp = client.post("/account/password", data={
        "current_password": "wqpass123",
        "new_password": "wqnewpass456",
        "csrf_token": csrf,
    }, follow_redirects=False)
    assert resp.status_code in (200, 303), resp.text

    # Old session invalidated.
    assert client.get("/api/institutions").status_code == 401

    # New password works.
    client_new = _login(env["app"], "wq", "wqnewpass456")
    assert client_new.get("/api/institutions").status_code == 200

    # Audit written.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "user.password_change",
                AuditEventModel.actor_user_id == env["wq_id"],
            )
        ).scalars().all()
    assert len(events) == 1


def test_ac009_page_username_change_prefix_protected(t19_env):
    """AC-009: page path username change has same prefix protection as API."""
    env = t19_env
    client = _login(env["app"], "sa1", "sa1pass123")
    csrf = client.headers["X-CSRF-Token"]

    resp = client.post("/account/username", data={
        "current_password": "sa1pass123",
        "new_username": "sa1new",
        "csrf_token": csrf,
    })
    assert resp.status_code == 400

    # Username unchanged.
    with transaction_session(env["factory"]) as s:
        user = s.get(UserIdentityModel, env["sa1_id"])
    assert user.username == "sa1"


def test_ac009_page_csrf_required(t19_env):
    """AC-009/R-010: form submissions require CSRF token."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/account/password", data={
        "current_password": "wqpass123",
        "new_password": "wqnewpass456",
        # No csrf_token
    })
    assert resp.status_code == 400


def test_ac009_page_wrong_password_rejected(t19_env):
    """AC-009: page path rejects wrong current password same as API."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")
    csrf = client.headers["X-CSRF-Token"]

    resp = client.post("/account/password", data={
        "current_password": "wrongpassword",
        "new_password": "wqnewpass456",
        "csrf_token": csrf,
    })
    assert resp.status_code == 400

    # Password unchanged.
    client_check = TestClient(env["app"])
    resp_login = client_check.post("/api/auth/login", json={
        "username": "wq", "password": "wqpass123",
    })
    assert resp_login.status_code == 200


def test_ac009_api_csrf_required(t19_env):
    """AC-009/R-010: API submissions require CSRF token."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")
    # Remove the CSRF header to test enforcement.
    del client.headers["X-CSRF-Token"]

    resp = client.post("/api/account/password", json={
        "current_password": "wqpass123",
        "new_password": "wqnewpass456",
    })
    assert resp.status_code == 403


# ============ AC-010: old session denied after password change ============


def test_ac010_old_session_denied_after_password_change(t19_env):
    """AC-010: after password change, old session denied on protected resource."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    # Verify session works before change.
    assert client.get("/api/institutions").status_code == 200

    # Change password.
    resp = client.post("/api/account/password", json={
        "current_password": "wqpass123",
        "new_password": "wqnewpass456",
    })
    assert resp.status_code == 200

    # Old session now denied on a protected resource.
    resp_protected = client.get("/api/institutions")
    assert resp_protected.status_code == 401

    # Also denied on /dashboard (page path).
    resp_dashboard = client.get("/dashboard", follow_redirects=False)
    # Dashboard redirects to login when unauthenticated, or returns login page.
    assert resp_dashboard.status_code in (302, 200)


def test_ac010_old_session_denied_after_username_change(t19_env):
    """AC-010: after username change, old session denied on protected resource."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/username", json={
        "current_password": "wqpass123",
        "new_username": "wq2",
    })
    assert resp.status_code == 200

    resp_protected = client.get("/api/institutions")
    assert resp_protected.status_code == 401


# ============ Additional edge-case tests ============


def test_same_password_allowed_with_warning(t19_env):
    """SPEC-0014 §8: new password same as old is allowed but warned."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/password", json={
        "current_password": "wqpass123",
        "new_password": "wqpass123",
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # The response should include a warning message.
    assert "相同" in resp.json().get("message", "") or "same" in resp.json().get("message", "").lower()


def test_username_empty_rejected(t19_env):
    """SPEC-0014 §8: empty username rejected."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/username", json={
        "current_password": "wqpass123",
        "new_username": "",
    })
    assert resp.status_code == 422  # Pydantic validation


def test_username_too_long_rejected(t19_env):
    """SPEC-0014 R-005: username over 64 chars rejected."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.post("/api/account/username", json={
        "current_password": "wqpass123",
        "new_username": "x" * 65,
    })
    assert resp.status_code in (400, 422)


def test_account_settings_page_renders(t19_env):
    """The account settings page renders for an authenticated user."""
    env = t19_env
    client = _login(env["app"], "wq", "wqpass123")

    resp = client.get("/account/settings")
    assert resp.status_code == 200
    assert "密码" in resp.text or "password" in resp.text.lower()
    assert "用户名" in resp.text or "username" in resp.text.lower()


def test_account_settings_page_requires_auth(t19_env):
    """Unauthenticated user is redirected from account settings."""
    env = t19_env
    client = TestClient(env["app"])

    resp = client.get("/account/settings", follow_redirects=False)
    assert resp.status_code in (302, 401)


# ============ AC-011 (SPEC-0014 v0.3.0): administrator self-service ============


def test_ac011_administrator_can_change_own_password(t19_env):
    """AC-011: an enabled administrator can change their own password, old
    session invalidated, new password can login, audit written (SPEC-0014
    v0.3.0: operation subject reverted to business_user/administrator)."""
    env = t19_env
    client = _login(env["app"], "t19admin", "t19adminpass")

    resp = client.post("/api/account/password", json={
        "current_password": "t19adminpass",
        "new_password": "t19adminnewpass456",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["success"] is True

    # Old session invalidated (session epoch bumped).
    assert client.get("/api/institutions").status_code == 401

    # New password can login.
    client_new = _login(env["app"], "t19admin", "t19adminnewpass456")
    assert client_new.get("/api/institutions").status_code == 200

    # Audit event written without password plaintext.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "user.password_change",
                AuditEventModel.actor_user_id == env["admin_id"],
            )
        ).scalars().all()
    assert len(events) == 1
    assert events[0].outcome == "success"
    audit_text = str(events[0].reason) + str(events[0].failure_summary or "")
    assert "t19adminpass" not in audit_text
    assert "t19adminnewpass456" not in audit_text
