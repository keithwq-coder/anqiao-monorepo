"""TASK-0045 (SPEC-0002 v0.4.1): management summary UI.

Read-only /management page: administrator sees the company-wide masked
summary; scoped manager sees only the authorized-scope summary; business_user
is denied; page fields ⊆ the /api/admin/summary masked projection; admin-only
opportunity-management link. Local-only, synthetic.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t45_test")
os.environ.setdefault("DATABASE_USER", "t45_test")
os.environ.setdefault("DATABASE_PASSWORD", "t45-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t45-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, select as sa_select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    ContactModel,
    FollowUpActivityModel,
    FollowUpActivityRevisionModel,
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.domain import ContentAttribution, Role, UserIdentity, UserStatus  # noqa: E402
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


@pytest.fixture
def t45_env():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _reg(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: s.strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: s.strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s))

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    from crm.web.main import app

    from test_task0007_inmemory_fakes import (
        InMemoryAuditRepository,
        InMemoryRoleGrantRepository,
        InMemorySessionRepository,
        InMemoryUserRepository,
    )
    from crm.application.queries import QueryService
    from crm.persistence.repositories import (
        ContactRepository,
        FollowUpActivityRepository,
        InstitutionRepository,
        _ensure_aware,
        domain_follow_up_activity_from_model,
        domain_institution_from_model,
    )

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    def _identity(username, display, roles, scope_keys=frozenset()):
        ident = UserIdentity(
            username=username,
            display_name=display,
            password_hash=hash_password(f"{username}pass123"),
            status=UserStatus.ENABLED,
        )
        user_repo.add(ident)
        role_repo.set_grants(ident.id, roles, scope_keys)
        return ident

    owner = _identity("t45owner", "Owner", [Role.BUSINESS_USER])
    gm = _identity("t45gm", "GM", [Role.MANAGER], frozenset({"east"}))
    admin = _identity("t45admin", "Admin", [Role.ADMINISTRATOR])

    now = datetime.now(timezone.utc)

    class _DualUserRepo:
        def __init__(self, f, mem):
            self._f = f
            self._mem = mem

        def find_by_id(self, user_id):
            if not isinstance(user_id, UUID):
                user_id = UUID(str(user_id))
            s = self._f()
            try:
                m = s.get(UserIdentityModel, user_id)
                if m is None:
                    return None
                return UserIdentity(
                    username=m.username, display_name=m.display_name,
                    password_hash=m.password_hash, status=UserStatus(m.status),
                    id=m.id, session_epoch=m.session_epoch,
                    created_at=_ensure_aware(m.created_at), updated_at=_ensure_aware(m.updated_at),
                )
            finally:
                s.close()

        def find_by_username(self, username):
            return self._mem.find_by_username(username)

    class _SqliteInstRepo(InstitutionRepository):
        def __init__(self, f):
            self._f = f

        def find_active_for_duplicate_check(self):
            s = self._f()
            try:
                return [
                    domain_institution_from_model(m)
                    for m in s.execute(
                        sa_select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
                    ).scalars().all()
                ]
            finally:
                s.close()

    class _SqliteContactRepo(ContactRepository):
        def __init__(self, f):
            self._f = f

        def find_by_institution(self, iid):
            s = self._f()
            try:
                from crm.persistence.repositories import domain_contact_from_model
                return [domain_contact_from_model(m) for m in s.execute(
                    sa_select(ContactModel).where(ContactModel.institution_id == iid)
                ).scalars().all()]
            finally:
                s.close()

    class _SqliteActivityRepo(FollowUpActivityRepository):
        def __init__(self, f):
            self._f = f

        def find_by_target(self, target_type, target_id, include_withdrawn=False):
            if target_type != "institution":
                return []
            try:
                inst_id = UUID(target_id)
            except ValueError:
                return []
            s = self._f()
            try:
                q = sa_select(FollowUpActivityModel).where(
                    FollowUpActivityModel.institution_id == inst_id
                )
                if not include_withdrawn:
                    q = q.where(FollowUpActivityModel.withdrawn_at.is_(None))
                results = []
                for m in s.execute(q).scalars().all():
                    rev = s.execute(
                        sa_select(FollowUpActivityRevisionModel).where(
                            FollowUpActivityRevisionModel.activity_id == m.id,
                            FollowUpActivityRevisionModel.version_number == m.current_version,
                        )
                    ).scalar_one_or_none()
                    results.append(domain_follow_up_activity_from_model(m, rev))
                return results
            finally:
                s.close()

    sqlite_user_repo = _DualUserRepo(factory, user_repo)
    inst_repo = _SqliteInstRepo(factory)
    contact_repo = _SqliteContactRepo(factory)
    activity_repo = _SqliteActivityRepo(factory)

    with transaction_session(factory) as session:
        for ident in (owner, gm, admin):
            session.add(UserIdentityModel(
                id=ident.id, username=ident.username, display_name=ident.display_name,
                password_hash=ident.password_hash, status="enabled",
                session_epoch=0, created_at=now, updated_at=now,
            ))
            grants = {
                owner.id: ("business_user", None),
                gm.id: ("manager", "east"),
                admin.id: ("administrator", None),
            }
            session.add(RoleGrantModel(
                user_id=ident.id, role=grants[ident.id][0], scope_reference=grants[ident.id][1],
                granted_by_user_id=admin.id, reason="seed", granted_at=now,
            ))
        # 3 east (manager's scope) + 1 west (out of manager scope).
        for i, region in enumerate(["east", "east", "east", "west"]):
            session.add(InstitutionModel(
                id=_uuid.uuid4(), name=f"T45 机构{i}", source_description=f"s45-{i}",
                customer_type="direct_purchase", owner_user_id=owner.id, in_pool=False,
                created_by_user_id=owner.id, idempotency_key=f"t45-inst-{i}",
                region=region, category="养老机构", created_at=now, updated_at=now,
            ))
        session.flush()

    auth_service = AuthenticationService(
        user_repository=sqlite_user_repo,
        session_repository=session_repo,
        audit_repository=InMemoryAuditRepository(),
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=100,
            csrf_token_lifetime_hours=1,
        ),
    )

    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    app.state.user_repository = sqlite_user_repo
    app.state.session_repository = session_repo
    app.state.role_grant_repository = role_repo
    app.state.auth_service = auth_service
    app.state.session_factory = factory
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service

    def _login(username):
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"username": username, "password": f"{username}pass123"})
        assert resp.status_code == 200, resp.text
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        return client

    owner_client = _login("t45owner")
    gm_client = _login("t45gm")
    admin_client = _login("t45admin")
    anonymous_client = TestClient(app)

    yield {
        "app": app,
        "owner_client": owner_client,
        "gm_client": gm_client,
        "admin_client": admin_client,
        "anonymous_client": anonymous_client,
    }
    for c in (owner_client, gm_client, admin_client, anonymous_client):
        c.close()
    engine.dispose()


def _api_summary(client):
    resp = client.get("/api/admin/summary")
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_admin_sees_company_wide_summary(t45_env):
    """Administrator sees the company-wide masked summary; page numbers equal
    the API projection (all 4 records)."""
    env = t45_env
    api = _api_summary(env["admin_client"])
    assert api["scope"] == "company"
    assert api["total"] == 4

    resp = env["admin_client"].get("/management")
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert "全公司" in body
    for key in ("total", "active", "archived", "has_next_action"):
        assert f'number">{api[key]}<' in body


def test_manager_sees_scoped_summary_only(t45_env):
    """Scoped manager sees only the authorized-scope (east) summary — 3
    records — and no company-wide figures."""
    env = t45_env
    api = _api_summary(env["gm_client"])
    assert api["scope"] == "scoped"
    assert api["total"] == 3

    resp = env["gm_client"].get("/management")
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert "授权范围" in body
    assert "全公司" not in body
    assert f'number">{api["total"]}<' in body
    # Manager must not see company-wide totals (the west record is invisible).
    assert 'number">4<' not in body


def test_business_user_denied(t45_env):
    """business_user gets 403 on /management (read-only management)."""
    env = t45_env
    resp = env["owner_client"].get("/management")
    assert resp.status_code == 403


def test_anonymous_redirected_to_login(t45_env):
    """Unauthenticated access redirects to /login."""
    env = t45_env
    resp = env["anonymous_client"].get("/management", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"] == "/login"


def test_page_fields_subset_of_api_projection(t45_env):
    """The page renders no field beyond the API masked projection: no
    institution names, no source_description, no contact values."""
    env = t45_env
    api = _api_summary(env["admin_client"])
    api_keys = set(api.keys())
    assert {"total", "active", "archived", "has_next_action", "scope", "breakdown"} <= api_keys

    body = env["admin_client"].get("/management").text
    assert "T45 机构" not in body          # no record names
    assert "s45-" not in body              # no source_description
    assert "owner_user_id" not in body     # no raw identifiers


def test_admin_opportunity_link_present_admin_only(t45_env):
    """The admin-only opportunity-management link renders for administrator
    and is absent for manager."""
    env = t45_env
    admin_body = env["admin_client"].get("/management").text
    assert "商机管理" in admin_body
    assert 'href="/discovery"' in admin_body

    gm_body = env["gm_client"].get("/management").text
    assert "商机管理" not in gm_body


def test_nav_management_entry_role_gated(t45_env):
    """管理摘要 nav entry renders for administrator/manager, absent for
    business_user."""
    env = t45_env
    admin_nav = env["admin_client"].get("/dashboard").text
    gm_nav = env["gm_client"].get("/dashboard").text
    owner_nav = env["owner_client"].get("/dashboard").text
    assert 'href="/management"' in admin_nav
    assert 'href="/management"' in gm_nav
    assert 'href="/management"' not in owner_nav
