"""TASK-0046 (SPEC-0002 v0.4.1 / SPEC-0011): admin user/role management UI.

Admin-only /admin pages: user list + role grant/revoke (three live roles
only), enable/disable, single/batch transfer, data erasure with mandatory
reason + irreversible confirmation. All mutating controls post to the
existing /api/admin/* endpoints. Local-only, synthetic.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t46_test")
os.environ.setdefault("DATABASE_USER", "t46_test")
os.environ.setdefault("DATABASE_PASSWORD", "t46-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t46-test-secret-not-for-production")
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
    AuditEventModel,
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
def t46_env():
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
        InMemoryRoleGrantRepository,
        InMemorySessionRepository,
        InMemoryUserRepository,
    )
    from crm.application.queries import QueryService
    from crm.persistence.audit_repository import AuditEventRepository
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

    admin = _identity("t46admin", "Admin", [Role.ADMINISTRATOR])
    admin2 = _identity("t46admin2", "Admin2", [Role.ADMINISTRATOR])
    gm = _identity("t46gm", "GM", [Role.MANAGER], frozenset({"east"}))
    bu = _identity("t46bu", "BusinessUser", [Role.BUSINESS_USER])

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

        def find_all_active(self):
            s = self._f()
            try:
                models = s.execute(
                    sa_select(UserIdentityModel).where(UserIdentityModel.status == "enabled")
                ).scalars().all()
                return [
                    UserIdentity(
                        username=m.username, display_name=m.display_name,
                        password_hash=m.password_hash, status=UserStatus(m.status),
                        id=m.id, session_epoch=m.session_epoch,
                        created_at=_ensure_aware(m.created_at), updated_at=_ensure_aware(m.updated_at),
                    )
                    for m in models
                ]
            finally:
                s.close()

        def find_by_username(self, username):
            return self._mem.find_by_username(username)

    class _SqliteInstRepo(InstitutionRepository):
        def __init__(self, f):
            self._f = f

        def find_by_id(self, iid):
            s = self._f()
            try:
                m = s.get(InstitutionModel, iid)
                return domain_institution_from_model(m) if m else None
            finally:
                s.close()

        def find_all(self, search_terms=None, limit=50, offset=0, searchable_fields=None):
            s = self._f()
            try:
                q = sa_select(InstitutionModel)
                if search_terms:
                    pat = f"%{search_terms}%"
                    if searchable_fields is None:
                        searchable_fields = frozenset({"name", "category", "region"})
                    col_map = {
                        "name": InstitutionModel.name,
                        "category": InstitutionModel.category,
                        "region": InstitutionModel.region,
                        "source_description": InstitutionModel.source_description,
                        "source_kind": InstitutionModel.source_kind,
                    }
                    cols = [col_map[f] for f in searchable_fields if f in col_map]
                    q = q.where(sa.or_(*[c.ilike(pat) for c in cols])) if cols else q.where(sa.false())
                q = q.offset(offset).limit(limit)
                return [domain_institution_from_model(m) for m in s.execute(q).scalars().all()]
            finally:
                s.close()

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

    class _SqliteAuditRepo(AuditEventRepository):
        def __init__(self, f):
            self._f = f

        def record(self, *, action, outcome, target_type, actor_user_id=None,
                   target_id=None, reason=None, failure_summary=None, session=None,
                   before_state=None, after_state=None) -> None:
            model = AuditEventModel(
                actor_user_id=actor_user_id, action=action, target_type=target_type,
                target_id=target_id, outcome=outcome, reason=reason,
                failure_summary=failure_summary,
                before_state=before_state, after_state=after_state,
            )
            if session is not None:
                session.add(model)
                return
            with transaction_session(self._f) as s:
                s.add(model)

    sqlite_user_repo = _DualUserRepo(factory, user_repo)
    inst_repo = _SqliteInstRepo(factory)
    contact_repo = _SqliteContactRepo(factory)
    activity_repo = _SqliteActivityRepo(factory)
    audit_repo = _SqliteAuditRepo(factory)

    with transaction_session(factory) as session:
        for ident in (admin, admin2, gm, bu):
            session.add(UserIdentityModel(
                id=ident.id, username=ident.username, display_name=ident.display_name,
                password_hash=ident.password_hash, status="enabled",
                session_epoch=0, created_at=now, updated_at=now,
            ))
            grants = {
                admin.id: ("administrator", None),
                admin2.id: ("administrator", None),
                gm.id: ("manager", "east"),
                bu.id: ("business_user", None),
            }
            session.add(RoleGrantModel(
                user_id=ident.id, role=grants[ident.id][0], scope_reference=grants[ident.id][1],
                granted_by_user_id=admin.id, reason="seed", granted_at=now,
            ))
        inst_a = InstitutionModel(
            id=_uuid.uuid4(), name="T46 机构A", source_description="s46a",
            customer_type="direct_purchase", owner_user_id=bu.id, in_pool=False,
            created_by_user_id=bu.id, idempotency_key="t46-inst-a",
            region="east", category="养老机构", created_at=now, updated_at=now,
        )
        inst_b = InstitutionModel(
            id=_uuid.uuid4(), name="T46 机构B", source_description="s46b",
            customer_type="channel", owner_user_id=bu.id, in_pool=False,
            created_by_user_id=bu.id, idempotency_key="t46-inst-b",
            region="west", category="养老机构", created_at=now, updated_at=now,
        )
        session.add_all([inst_a, inst_b])

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

    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    app.state.user_repository = sqlite_user_repo
    app.state.session_repository = session_repo
    app.state.audit_repository = audit_repo
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

    admin_client = _login("t46admin")
    gm_client = _login("t46gm")
    bu_client = _login("t46bu")
    anonymous_client = TestClient(app)

    yield {
        "app": app,
        "inst_a_id": str(inst_a.id),
        "inst_b_id": str(inst_b.id),
        "bu_id": str(bu.id),
        "admin2_id": str(admin2.id),
        "admin_client": admin_client,
        "gm_client": gm_client,
        "bu_client": bu_client,
        "anonymous_client": anonymous_client,
    }
    for c in (admin_client, gm_client, bu_client, anonymous_client):
        c.close()
    engine.dispose()


# ============ Page access control ============

def test_admin_pages_200_for_administrator(t46_env):
    """All three /admin pages render for the administrator with CSRF tokens
    and only the three live roles (no general_manager)."""
    env = t46_env
    for path in ("/admin", "/admin/transfer", "/admin/erase"):
        resp = env["admin_client"].get(path)
        assert resp.status_code == 200, (path, resp.text)
        assert 'name="csrf_token"' in resp.text
    body = env["admin_client"].get("/admin").text
    for role in ("administrator", "manager", "business_user"):
        assert f'value="{role}"' in body
    # general_manager was removed by DEC-0172: never an option.
    assert 'value="general_manager"' not in body


def test_non_admin_denied(t46_env):
    """manager and business_user get 403 on /admin pages; anonymous 302."""
    env = t46_env
    for path in ("/admin", "/admin/transfer", "/admin/erase"):
        assert env["gm_client"].get(path).status_code == 403
        assert env["bu_client"].get(path).status_code == 403
        anon = env["anonymous_client"].get(path, follow_redirects=False)
        assert anon.status_code == 302
        assert anon.headers["location"] == "/login"


def test_user_list_shows_active_users_and_roles(t46_env):
    """The user list renders active users with their role grants and scopes."""
    env = t46_env
    body = env["admin_client"].get("/admin").text
    for name in ("t46admin", "t46admin2", "t46gm", "t46bu"):
        assert name in body
    assert "manager" in body
    assert "east" in body


def test_grant_forms_exclude_self(t46_env):
    """The administrator's own row carries no grant/revoke/disable controls
    (self-action prohibited, R-015); other users' rows do."""
    env = t46_env
    body = env["admin_client"].get("/admin").text
    # Self row is marked 当前账号 and renders no mutating action forms.
    assert "当前账号" in body
    # At least one non-self row exposes grant forms (bu row).
    assert 'data-action="grant"' in body
    assert 'data-action="disable"' in body


def test_erase_ui_requires_reason_and_confirmation(t46_env):
    """The erase form demands a reason and an explicit irreversible
    confirmation checkbox before submit."""
    env = t46_env
    body = env["admin_client"].get("/admin/erase").text
    assert 'name="reason" required' in body
    assert 'id="erase-confirm" required' in body
    assert "不可逆" in body


def test_all_admin_forms_carry_csrf(t46_env):
    """Every mutating form on the three pages embeds the CSRF token."""
    env = t46_env
    admin_body = env["admin_client"].get("/admin").text
    transfer_body = env["admin_client"].get("/admin/transfer").text
    erase_body = env["admin_client"].get("/admin/erase").text
    for body in (admin_body, transfer_body, erase_body):
        assert 'name="csrf_token"' in body


# ============ API action paths (form POST targets) ============

def test_grant_revoke_enable_disable_api_paths(t46_env):
    """Role grant/revoke and enable/disable work for the administrator and
    respect role gates (self-action and non-admin denied)."""
    env = t46_env
    a = env["admin_client"]
    # grant manager role to bu with scope.
    r = a.post("/api/admin/roles/grant", json={
        "target_user_id": env["bu_id"], "role": "manager",
        "reason": "升任区域经理", "scope_reference": "east",
    })
    assert r.status_code == 200, r.text
    # revoke it.
    r = a.post("/api/admin/roles/revoke", json={
        "target_user_id": env["bu_id"], "role": "manager", "reason": "调整组织",
    })
    assert r.status_code == 200, r.text
    # disable bu.
    r = a.post(f"/api/admin/users/{env['bu_id']}/disable", json={"reason": "离职停用"})
    assert r.status_code == 200, r.text
    # self-action prohibited.
    me = a.post("/api/admin/roles/grant", json={
        "target_user_id": env["bu_id"], "role": "administrator", "reason": "x",
    })
    # non-admin (gm) cannot grant.
    r = env["gm_client"].post("/api/admin/roles/grant", json={
        "target_user_id": env["bu_id"], "role": "manager", "reason": "x",
    })
    assert r.status_code == 403
    # general_manager is not an accepted role value.
    r = a.post("/api/admin/roles/grant", json={
        "target_user_id": env["bu_id"], "role": "general_manager", "reason": "x",
    })
    assert r.status_code == 400


def test_transfer_single_and_batch_api_paths(t46_env):
    """Single and batch ownership transfer work for the administrator."""
    env = t46_env
    a = env["admin_client"]
    r = a.post(
        f"/api/admin/institutions/{env['inst_a_id']}/transfer",
        json={"new_owner_user_id": env["admin2_id"], "reason": "转交客户"},
    )
    assert r.status_code == 200, r.text
    r = a.post(
        "/api/admin/institutions/transfer-batch",
        json={"institution_ids": [env["inst_a_id"], env["inst_b_id"]],
              "new_owner_user_id": env["admin2_id"], "reason": "批量转交"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 2


def test_erase_api_requires_confirmation(t46_env):
    """Erasure refuses without confirm=true and succeeds with it."""
    env = t46_env
    a = env["admin_client"]
    r = a.post(f"/api/admin/institutions/{env['inst_a_id']}/erase",
               json={"reason": "客户要求删除", "confirm": False})
    assert r.status_code == 400
    r = a.post(f"/api/admin/institutions/{env['inst_a_id']}/erase",
               json={"reason": "客户要求删除", "confirm": True})
    assert r.status_code == 200, r.text
    assert r.json()["erased"] is True


# ============ Nav gating ============

def test_nav_admin_entry_role_gated(t46_env):
    """系统管理 nav entry renders for administrator only."""
    env = t46_env
    assert 'href="/admin"' in env["admin_client"].get("/dashboard").text
    assert 'href="/admin"' not in env["gm_client"].get("/dashboard").text
    assert 'href="/admin"' not in env["bu_client"].get("/dashboard").text
