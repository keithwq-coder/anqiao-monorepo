"""TASK-0015: SPEC-0002 management surface tests.

Local-only, synthetic state. Tests cover:
- Role grant/revoke: unauthorized, non-admin, self-grant, idempotency, audit
- User enable/disable: disabled session invalidation, self-disable, R-011 prompt
- Ownership transfer: valid, invalid new owner, idempotent, batch mixed
- Management summary: GM company-wide, scoped MANAGER scope-only, read-only
- R2 scope-key fix: scoped MANAGER sees in-scope records
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t15_test")
os.environ.setdefault("DATABASE_USER", "t15_test")
os.environ.setdefault("DATABASE_PASSWORD", "t15-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t15-test-secret-not-for-production")
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

from crm.application.queries import QueryService  # noqa: E402
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
    InstitutionOwnerHistoryModel,
)
from crm.persistence.repositories import (  # noqa: E402
    ContactRepository,
    FollowUpActivityRepository,
    InstitutionRepository,
)
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


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
def t15_env():
    """SQLite-backed app with admin, business users, management roles, and
    institutions with regions for scope-key testing."""
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

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    admin, _ = _make_identity("t15admin", "t15passadmin", [Role.ADMINISTRATOR])
    user_repo.add(admin)
    role_repo.set_grants(admin.id, [Role.ADMINISTRATOR])

    biz_a, _ = _make_identity("t15biza", "t15passa", [Role.BUSINESS_USER])
    user_repo.add(biz_a)
    role_repo.set_grants(biz_a.id, [Role.BUSINESS_USER])

    biz_b, _ = _make_identity("t15bizb", "t15passb", [Role.BUSINESS_USER])
    user_repo.add(biz_b)
    role_repo.set_grants(biz_b.id, [Role.BUSINESS_USER])

    gm, _ = _make_identity("t15gm", "t15passgm", [Role.MANAGER])
    user_repo.add(gm)
    role_repo.set_grants(gm.id, [Role.MANAGER], frozenset({"east", "west"}))

    scoped_mgr, _ = _make_identity("t15mgr", "t15passmgr", [Role.MANAGER])
    user_repo.add(scoped_mgr)
    role_repo.set_grants(scoped_mgr.id, [Role.MANAGER], frozenset({"east"}))

    no_role, _ = _make_identity("t15norole", "t15passnr", [])
    user_repo.add(no_role)
    role_repo.set_grants(no_role.id, [])

    class _DualUserRepo:
        """User repo that reads from SQLite for find_by_id (so session
        validation sees management-command status changes) but falls back
        to the in-memory fake for find_by_username (login)."""
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
            return self._mem.find_by_username(username)

    sqlite_user_repo = _DualUserRepo(factory, user_repo)

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
                        "source_description": InstitutionModel.source_description,
                        "source_kind": InstitutionModel.source_kind,
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
        def find_active_for_duplicate_check(self):
            s = self._f()
            try:
                models = s.execute(
                    sa.select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
                ).scalars().all()
                from crm.persistence.repositories import domain_institution_from_model
                return [domain_institution_from_model(m) for m in models]
            finally:
                s.close()

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
    contact_repo = _SqliteContactRepo(factory)
    activity_repo = _SqliteActivityRepo(factory)
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

    # Seed institutions with regions for scope testing, plus user identities
    # and role grants in the SQLite DB (the management commands query the DB
    # directly via ManagementRepository and session.get(UserIdentityModel)).
    now = datetime.now(timezone.utc)
    inst_east_id = _uuid.uuid4()
    inst_west_id = _uuid.uuid4()
    inst_noregion_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        # Seed user identities into the SQLite DB.
        for uid, uname, dname, phash, st, epoch in [
            (admin.id, "t15admin", "t15admin", admin.password_hash, "enabled", 0),
            (biz_a.id, "t15biza", "t15biza", biz_a.password_hash, "enabled", 0),
            (biz_b.id, "t15bizb", "t15bizb", biz_b.password_hash, "enabled", 0),
            (gm.id, "t15gm", "t15gm", gm.password_hash, "enabled", 0),
            (scoped_mgr.id, "t15mgr", "t15mgr", scoped_mgr.password_hash, "enabled", 0),
            (no_role.id, "t15norole", "t15norole", no_role.password_hash, "enabled", 0),
        ]:
            session.add(UserIdentityModel(
                id=uid, username=uname, display_name=dname, password_hash=phash,
                status=st, session_epoch=epoch, created_at=now, updated_at=now,
            ))

        # Seed role grants into the SQLite DB.
        for uid, role_val, scope_ref, grantor_id in [
            (admin.id, "administrator", None, admin.id),
            (biz_a.id, "business_user", None, admin.id),
            (biz_b.id, "business_user", None, admin.id),
            (gm.id, "manager", "east", admin.id),
            (gm.id, "manager", "west", admin.id),
            (scoped_mgr.id, "manager", "east", admin.id),
        ]:
            session.add(RoleGrantModel(
                user_id=uid, role=role_val, scope_reference=scope_ref,
                granted_by_user_id=grantor_id, reason="test seed",
                granted_at=now,
            ))

        session.add(InstitutionModel(
            id=inst_east_id, name="东部养老机构", source_description="east source",
            source_kind="manual", region="east", owner_user_id=biz_a.id,
            created_by_user_id=biz_a.id, idempotency_key="t15-east",
            created_at=now, updated_at=now,
        ))
        session.add(InstitutionModel(
            id=inst_west_id, name="西部养老机构", source_description="west source",
            source_kind="manual", region="west", owner_user_id=biz_b.id,
            created_by_user_id=biz_b.id, idempotency_key="t15-west",
            created_at=now, updated_at=now,
        ))
        session.add(InstitutionModel(
            id=inst_noregion_id, name="无区域机构", source_description="no region",
            source_kind="manual", region=None, owner_user_id=biz_a.id,
            created_by_user_id=biz_a.id, idempotency_key="t15-noregion",
            created_at=now, updated_at=now,
        ))

    yield {
        "app": app,
        "admin_id": admin.id,
        "biz_a_id": biz_a.id,
        "biz_b_id": biz_b.id,
        "gm_id": gm.id,
        "mgr_id": scoped_mgr.id,
        "no_role_id": no_role.id,
        "inst_east_id": str(inst_east_id),
        "inst_west_id": str(inst_west_id),
        "inst_noregion_id": str(inst_noregion_id),
        "factory": factory,
    }
    engine.dispose()


# ============ R2 scope-key fix tests ============


def test_scoped_manager_sees_in_scope_records(t15_env):
    """R2 fix: a scoped MANAGER with scope 'east' sees the east-region
    institution after the management_scope_key fix."""
    env = t15_env
    client = _login(env["app"], "t15mgr", "t15passmgr")
    resp = client.get("/api/institutions")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    names = [i["name"] for i in items]
    assert "东部养老机构" in names
    assert "西部养老机构" not in names
    assert "无区域机构" not in names


def test_scoped_manager_out_of_scope_invisible(t15_env):
    """R-020: scoped MANAGER cannot see out-of-scope or no-region records."""
    env = t15_env
    client = _login(env["app"], "t15mgr", "t15passmgr")
    resp = client.get(f"/api/institutions/{env['inst_west_id']}")
    assert resp.status_code == 404


def test_manager_sees_authorized_scope_records(t15_env):
    """R-019: scoped MANAGER sees records within its authorized scopes
    (masked); out-of-scope records stay invisible."""
    env = t15_env
    client = _login(env["app"], "t15gm", "t15passgm")
    resp = client.get("/api/institutions")
    assert resp.status_code == 200
    items = resp.json()["items"]
    names = [i["name"] for i in items]
    assert "东部养老机构" in names
    assert "西部养老机构" in names


# ============ Role grant/revoke tests ============


def test_unauthorized_user_cannot_grant_role(t15_env):
    """R-006: no-role user cannot grant roles."""
    env = t15_env
    client = _login(env["app"], "t15norole", "t15passnr")
    resp = client.post("/api/admin/roles/grant", json={
        "target_user_id": str(env["no_role_id"]),
        "role": "business_user",
        "reason": "test",
    })
    assert resp.status_code == 403


def test_business_user_cannot_grant_role(t15_env):
    """R-006/R-021: business user cannot grant roles (admin-only)."""
    env = t15_env
    client = _login(env["app"], "t15biza", "t15passa")
    resp = client.post("/api/admin/roles/grant", json={
        "target_user_id": str(env["no_role_id"]),
        "role": "business_user",
        "reason": "test",
    })
    assert resp.status_code == 403


def test_admin_grant_role_audited(t15_env):
    """R-005/AC-003: admin grants role, audit has before/after state."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post("/api/admin/roles/grant", json={
        "target_user_id": str(env["no_role_id"]),
        "role": "business_user",
        "reason": "assigning business role",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["granted"] is True

    # Verify audit event was written with before/after state.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "role.grant",
                AuditEventModel.target_id == env["no_role_id"],
            )
        ).scalars().all()
    assert len(events) == 1
    assert events[0].before_state is not None
    assert events[0].after_state is not None
    assert events[0].reason == "assigning business role"


def test_duplicate_grant_idempotent(t15_env):
    """R-012 analog: granting an already-active identical role is idempotent."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    # biz_a already has BUSINESS_USER
    resp = client.post("/api/admin/roles/grant", json={
        "target_user_id": str(env["biz_a_id"]),
        "role": "business_user",
        "reason": "re-granting",
    })
    assert resp.status_code == 200
    assert resp.json()["granted"] is False
    assert resp.json()["idempotent"] is True

    # No duplicate audit event.
    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "role.grant",
                AuditEventModel.target_id == env["biz_a_id"],
            )
        ).scalars().all()
    assert len(events) == 0


def test_admin_cannot_grant_to_self(t15_env):
    """R-015/AC-011: admin cannot grant role to self."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post("/api/admin/roles/grant", json={
        "target_user_id": str(env["admin_id"]),
        "role": "business_user",
        "reason": "self elevation",
    })
    assert resp.status_code == 403


def test_revoke_role_idempotent(t15_env):
    """R-012 analog: revoking a non-existent grant is idempotent."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    # no_role has no grants
    resp = client.post("/api/admin/roles/revoke", json={
        "target_user_id": str(env["no_role_id"]),
        "role": "business_user",
        "reason": "cleanup",
    })
    assert resp.status_code == 200
    assert resp.json()["revoked"] is False
    assert resp.json()["idempotent"] is True


def test_revoke_role_bumps_session_epoch(t15_env):
    """R-014: revoking a role bumps session_epoch to invalidate sessions."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post("/api/admin/roles/revoke", json={
        "target_user_id": str(env["biz_a_id"]),
        "role": "business_user",
        "reason": "removing access",
    })
    assert resp.status_code == 200
    assert resp.json()["revoked"] is True

    # Verify session_epoch was bumped.
    with transaction_session(env["factory"]) as s:
        user = s.get(UserIdentityModel, env["biz_a_id"])
    assert user.session_epoch >= 1


# ============ User enable/disable tests ============


def test_disable_user_invalidates_session(t15_env):
    """R-004/R-014/AC-004: disabled user's session is invalidated."""
    env = t15_env
    # Login as biz_a first.
    client_biz = _login(env["app"], "t15biza", "t15passa")
    # Verify session works.
    assert client_biz.get("/api/institutions").status_code == 200

    # Admin disables biz_a.
    client_admin = _login(env["app"], "t15admin", "t15passadmin")
    resp = client_admin.post(f"/api/admin/users/{env['biz_a_id']}/disable", json={
        "reason": "leaving company",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["disabled"] is True

    # biz_a's existing session should now fail (stale session).
    resp2 = client_biz.get("/api/institutions")
    assert resp2.status_code == 401


def test_admin_cannot_disable_self(t15_env):
    """R-015: admin cannot disable own account."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post(f"/api/admin/users/{env['admin_id']}/disable", json={
        "reason": "self disable",
    })
    assert resp.status_code == 403


def test_disable_user_with_owned_institutions_prompts(t15_env):
    """R-011: disabling a user with owned institutions returns the prompt."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post(f"/api/admin/users/{env['biz_a_id']}/disable", json={
        "reason": "transfer needed",
    })
    assert resp.status_code == 200
    owned = resp.json()["owned_institution_ids"]
    assert len(owned) > 0
    assert env["inst_east_id"] in owned


def test_enable_user(t15_env):
    """R-004: admin enables a pending user."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post(f"/api/admin/users/{env['no_role_id']}/enable", json={
        "reason": "activating account",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["enabled"] is True
    assert resp.json()["status"] == "enabled"


# ============ Ownership transfer tests ============


def test_transfer_ownership_success(t15_env):
    """R-009/R-010/AC-005: admin transfers A→B, B gains, history preserved."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "reassignment",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["transferred"] is True
    assert resp.json()["previous_owner_user_id"] == str(env["biz_a_id"])
    assert resp.json()["new_owner_user_id"] == str(env["biz_b_id"])

    # Verify history row.
    with transaction_session(env["factory"]) as s:
        hist = s.execute(
            sa.select(InstitutionOwnerHistoryModel).where(
                InstitutionOwnerHistoryModel.institution_id == UUID(env["inst_east_id"])
            )
        ).scalars().all()
    assert len(hist) == 1
    assert hist[0].previous_owner_user_id == env["biz_a_id"]
    assert hist[0].new_owner_user_id == env["biz_b_id"]
    assert hist[0].reason == "reassignment"


def test_transfer_to_disabled_user_fails(t15_env):
    """AC-006: transfer to disabled user fails, original owner unchanged."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    # Disable biz_b first.
    client.post(f"/api/admin/users/{env['biz_b_id']}/disable", json={"reason": "test"})
    # Now try to transfer to biz_b.
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "should fail",
    })
    assert resp.status_code == 400
    # Original owner unchanged.
    with transaction_session(env["factory"]) as s:
        inst = s.get(InstitutionModel, UUID(env["inst_east_id"]))
    assert inst.owner_user_id == env["biz_a_id"]


def test_transfer_idempotent(t15_env):
    """R-012 analog: transferring to the current owner is idempotent."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    # inst_east is owned by biz_a; transfer to biz_a.
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_a_id"]),
        "reason": "no-op",
    })
    assert resp.status_code == 200
    assert resp.json()["transferred"] is False
    assert resp.json()["idempotent"] is True


def test_non_admin_cannot_transfer(t15_env):
    """R-021/AC-015: business user cannot transfer ownership."""
    env = t15_env
    client = _login(env["app"], "t15biza", "t15passa")
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "attempt",
    })
    assert resp.status_code == 403


def test_manager_cannot_transfer(t15_env):
    """R-026: only administrator may 点名分配; a scoped manager cannot."""
    env = t15_env
    client = _login(env["app"], "t15gm", "t15passgm")
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "区域调整",
    })
    assert resp.status_code == 403, resp.text


def test_manager_transfer_rejected_even_without_reason(t15_env):
    """R-026: a manager cannot assign; reason is irrelevant (admin-only)."""
    env = t15_env
    client = _login(env["app"], "t15gm", "t15passgm")
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "   ",
    })
    assert resp.status_code == 403, resp.text


def test_admin_transfer_without_reason_succeeds_and_traces(t15_env):
    """R-026: an administrator may assign without a reason; the history row
    carries a null reason and the audit event is auto-traced."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["transferred"] is True

    with transaction_session(env["factory"]) as s:
        hist = s.execute(
            sa.select(InstitutionOwnerHistoryModel).where(
                InstitutionOwnerHistoryModel.institution_id == UUID(env["inst_east_id"])
            )
        ).scalars().all()
    assert len(hist) == 1
    assert hist[0].new_owner_user_id == env["biz_b_id"]
    assert hist[0].reason is None


# ============ Batch transfer tests ============


def test_batch_transfer_mixed_success_failure(t15_env):
    """R-012/AC-007: batch with valid and invalid items, per-item results."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    # Disable biz_b so transfer to biz_b fails for some items.
    client.post(f"/api/admin/users/{env['biz_b_id']}/disable", json={"reason": "test"})

    # inst_east is valid (owned by biz_a), inst_west is valid (owned by biz_b),
    # and a non-existent UUID is invalid.
    fake_id = str(_uuid.uuid4())
    resp = client.post("/api/admin/institutions/transfer-batch", json={
        "institution_ids": [env["inst_east_id"], env["inst_west_id"], fake_id],
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "batch reassignment",
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 3
    # inst_east transfer to biz_b (disabled) should fail.
    # inst_west is already owned by biz_b → idempotent success.
    # fake_id → "institution not found" failure.
    results = {r["institution_id"]: r for r in data["results"]}
    assert results[env["inst_west_id"]]["success"] is True
    assert results[env["inst_west_id"]]["idempotent"] is True
    assert results[env["inst_east_id"]]["success"] is False
    assert results[fake_id]["success"] is False
    assert data["failed"] == 2


def test_batch_transfer_idempotent_retry(t15_env):
    """R-012/AC-007: retrying already-transferred items doesn't duplicate history."""
    env = t15_env
    client = _login(env["app"], "t15admin", "t15passadmin")
    # First transfer: inst_east from biz_a to biz_b.
    resp1 = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "first transfer",
    })
    assert resp1.status_code == 200
    assert resp1.json()["transferred"] is True

    # Count history rows.
    with transaction_session(env["factory"]) as s:
        count1 = len(s.execute(
            sa.select(InstitutionOwnerHistoryModel).where(
                InstitutionOwnerHistoryModel.institution_id == UUID(env["inst_east_id"])
            )
        ).scalars().all())

    # Retry: inst_east is now owned by biz_b; transfer to biz_b again.
    resp2 = client.post(f"/api/admin/institutions/{env['inst_east_id']}/transfer", json={
        "new_owner_user_id": str(env["biz_b_id"]),
        "reason": "retry",
    })
    assert resp2.status_code == 200
    assert resp2.json()["transferred"] is False
    assert resp2.json()["idempotent"] is True

    # No new history row.
    with transaction_session(env["factory"]) as s:
        count2 = len(s.execute(
            sa.select(InstitutionOwnerHistoryModel).where(
                InstitutionOwnerHistoryModel.institution_id == UUID(env["inst_east_id"])
            )
        ).scalars().all())
    assert count2 == count1


# ============ Management summary tests ============


def test_manager_summary_scoped(t15_env):
    """R-019/AC-013: scoped manager sees only authorized-scope summary."""
    env = t15_env
    client = _login(env["app"], "t15gm", "t15passgm")
    resp = client.get("/api/admin/summary")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["scope"] == "scoped"
    assert data["total"] >= 2  # east + west in scope
    # No sensitive fields in the summary.
    assert "source_description" not in str(data)
    assert "factual_body" not in str(data)
    assert "phone" not in str(data)


def test_scoped_manager_summary_scope_only(t15_env):
    """R-020/AC-014: scoped MANAGER sees only in-scope records in summary."""
    env = t15_env
    client = _login(env["app"], "t15mgr", "t15passmgr")
    resp = client.get("/api/admin/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scope"] == "scoped"
    # Only the east institution is visible.
    assert data["total"] == 1


def test_management_summary_read_only(t15_env):
    """R-021/AC-015: management summary is GET-only; no write endpoints."""
    env = t15_env
    client = _login(env["app"], "t15gm", "t15passgm")
    # POST to summary should return 405 (method not allowed).
    resp = client.post("/api/admin/summary")
    assert resp.status_code == 405


def test_no_role_user_cannot_access_summary(t15_env):
    """R-006: no-role user cannot access management summary."""
    env = t15_env
    client = _login(env["app"], "t15norole", "t15passnr")
    resp = client.get("/api/admin/summary")
    assert resp.status_code == 403


def test_business_user_cannot_access_summary(t15_env):
    """R-021: business user cannot access management summary."""
    env = t15_env
    client = _login(env["app"], "t15biza", "t15passa")
    resp = client.get("/api/admin/summary")
    assert resp.status_code == 403


# ============ Stale session test ============


def test_stale_session_after_role_revoke(t15_env):
    """R-014: after role revoke (epoch bump), existing session is denied."""
    env = t15_env
    # Login as biz_a.
    client_biz = _login(env["app"], "t15biza", "t15passa")
    assert client_biz.get("/api/institutions").status_code == 200

    # Admin revokes biz_a's role (bumps epoch).
    client_admin = _login(env["app"], "t15admin", "t15passadmin")
    client_admin.post("/api/admin/roles/revoke", json={
        "target_user_id": str(env["biz_a_id"]),
        "role": "business_user",
        "reason": "removing access",
    })

    # biz_a's session should now be denied (stale epoch).
    resp = client_biz.get("/api/institutions")
    assert resp.status_code == 401
