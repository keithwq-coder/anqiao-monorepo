"""TASK-0044 (SPEC-0001 v0.8.1 / SPEC-0008): public-pool UI + customer record
action UI.

Role-conditional visibility of every action on the detail page (archive /
release-to-pool / claim / customer-type change / follow-up correct /
withdraw), the public-pool list page with claim buttons, CSRF tokens on all
forms, and page data matching the API masked projection. Local-only,
synthetic.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t44_test")
os.environ.setdefault("DATABASE_USER", "t44_test")
os.environ.setdefault("DATABASE_PASSWORD", "t44-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t44-test-secret-not-for-production")
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
def t44_env():
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
    from crm.persistence.repositories import (
        ContactRepository,
        FollowUpActivityRepository,
        InstitutionRepository,
        _ensure_aware,
        domain_follow_up_activity_from_model,
        domain_institution_from_model,
    )
    from crm.persistence.audit_repository import AuditEventRepository

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    def _identity(username, display, roles):
        ident = UserIdentity(
            username=username,
            display_name=display,
            password_hash=hash_password(f"{username}pass123"),
            status=UserStatus.ENABLED,
        )
        user_repo.add(ident)
        role_repo.set_grants(ident.id, roles)
        return ident

    owner = _identity("t44owner", "Owner", [Role.BUSINESS_USER])
    other = _identity("t44other", "Other", [Role.BUSINESS_USER])
    gm = _identity("t44gm", "GM", [Role.MANAGER])
    admin = _identity("t44admin", "Admin", [Role.ADMINISTRATOR])

    now = datetime.now(timezone.utc)

    class _DualUserRepo:
        """find_by_id reads SQLite (so management-command status changes are
        visible); find_by_username falls back to the in-memory fake (login)."""

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

        def find_by_id(self, activity_id):
            s = self._f()
            try:
                m = s.get(FollowUpActivityModel, activity_id)
                if m is None:
                    return None
                rev = s.execute(
                    sa_select(FollowUpActivityRevisionModel).where(
                        FollowUpActivityRevisionModel.activity_id == activity_id,
                        FollowUpActivityRevisionModel.version_number == m.current_version,
                    )
                ).scalar_one_or_none()
                return domain_follow_up_activity_from_model(m, rev)
            finally:
                s.close()

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
                q = q.order_by(
                    FollowUpActivityModel.occurred_at.desc(),
                    FollowUpActivityModel.recorded_at.desc(),
                    FollowUpActivityModel.id.desc(),
                )
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
        for ident in (owner, other, gm, admin):
            session.add(UserIdentityModel(
                id=ident.id, username=ident.username, display_name=ident.display_name,
                password_hash=ident.password_hash, status="enabled",
                session_epoch=0, created_at=now, updated_at=now,
            ))
            grants = {
                owner.id: ("business_user", None),
                other.id: ("business_user", None),
                gm.id: ("manager", "east"),
                admin.id: ("administrator", None),
            }
            session.add(RoleGrantModel(
                user_id=ident.id, role=grants[ident.id][0], scope_reference=grants[ident.id][1],
                granted_by_user_id=admin.id, reason="seed", granted_at=now,
            ))
        inst_owned = InstitutionModel(
            id=_uuid.uuid4(), name="T44 自有机构", source_description="s44a",
            customer_type="direct_purchase", owner_user_id=owner.id, in_pool=False,
            created_by_user_id=owner.id, idempotency_key="t44-inst-owned",
            region="east", category="养老机构", created_at=now, updated_at=now,
        )
        inst_pool = InstitutionModel(
            id=_uuid.uuid4(), name="T44 公池机构", source_description="s44b",
            customer_type="channel", owner_user_id=None, in_pool=True,
            created_by_user_id=owner.id, idempotency_key="t44-inst-pool",
            region="east", category="养老机构", created_at=now, updated_at=now,
        )
        inst_other = InstitutionModel(
            id=_uuid.uuid4(), name="T44 他人机构", source_description="s44c",
            customer_type="individual", owner_user_id=other.id, in_pool=False,
            created_by_user_id=other.id, idempotency_key="t44-inst-other",
            region="east", category="养老机构", created_at=now, updated_at=now,
        )
        session.add_all([inst_owned, inst_pool, inst_other])
        session.flush()
        act = FollowUpActivityModel(
            id=_uuid.uuid4(), institution_id=inst_owned.id, recorded_by_user_id=owner.id,
            occurred_at=now, interaction_method="【电话】沟通", recorded_at=now,
            current_version=1, ai_review_status="not_requested",
            idempotency_key="t44-act-1",
        )
        session.add(act)
        session.flush()
        session.add(FollowUpActivityRevisionModel(
            activity_id=act.id, version_number=1,
            factual_body="T44 跟进正文 v1",
            content_attribution=ContentAttribution.SALESPERSON_INPUT.value,
            created_by_user_id=owner.id, change_reason="initial creation",
        ))

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

    owner_client = _login("t44owner")
    other_client = _login("t44other")
    gm_client = _login("t44gm")
    admin_client = _login("t44admin")
    anonymous_client = TestClient(app)

    yield {
        "app": app,
        "inst_owned_id": str(inst_owned.id),
        "inst_pool_id": str(inst_pool.id),
        "inst_other_id": str(inst_other.id),
        "owner_client": owner_client,
        "other_client": other_client,
        "gm_client": gm_client,
        "admin_client": admin_client,
        "anonymous_client": anonymous_client,
    }
    for c in (owner_client, other_client, gm_client, admin_client, anonymous_client):
        c.close()
    engine.dispose()


# ============ Detail-page action visibility ============

def test_owner_sees_owner_actions_only(t44_env):
    """Owner sees customer-type change + follow-up correct/withdraw; admin-only
    release/archive and pool-only claim are hidden."""
    env = t44_env
    body = env["owner_client"].get(f"/institutions/{env['inst_owned_id']}").text

    assert 'data-action="customer-type"' in body
    assert 'data-action="correct"' in body
    assert 'data-action="withdraw"' in body
    assert 'data-action="release"' not in body
    assert 'data-action="archive"' not in body
    assert 'data-action="claim"' not in body


def test_admin_sees_admin_actions_only(t44_env):
    """Administrator sees archive + release-to-pool + customer-type change;
    owner-only follow-up actions are hidden (admin is not the owner)."""
    env = t44_env
    body = env["admin_client"].get(f"/institutions/{env['inst_owned_id']}").text

    assert 'data-action="archive"' in body
    assert 'data-action="release"' in body
    assert 'data-action="customer-type"' in body
    assert 'data-action="correct"' not in body
    assert 'data-action="withdraw"' not in body
    assert 'data-action="claim"' not in body


def test_other_business_user_sees_no_actions(t44_env):
    """A non-owner business_user sees no action controls on another's record
    (read-only collaborator view; no empty action card)."""
    env = t44_env
    body = env["other_client"].get(f"/institutions/{env['inst_owned_id']}").text
    assert 'data-action=' not in body
    assert "客户操作" not in body


def test_claim_visible_only_for_pool_record(t44_env):
    """Claim button renders only for a pool record and only for
    business_user (R-043/R-044: admin/gm do not claim)."""
    env = t44_env
    pool_body = env["owner_client"].get(f"/institutions/{env['inst_pool_id']}").text
    assert 'data-action="claim"' in pool_body

    admin_pool = env["admin_client"].get(f"/institutions/{env['inst_pool_id']}").text
    assert 'data-action="claim"' not in admin_pool
    assert 'data-action="archive"' in admin_pool


def test_all_action_forms_carry_csrf_token(t44_env):
    """Every mutating action form embeds the synchronizer CSRF token."""
    env = t44_env
    body = env["owner_client"].get(f"/institutions/{env['inst_owned_id']}").text
    csrf_fields = body.count('name="csrf_token"')
    action_forms = body.count('data-action=')
    assert action_forms >= 3  # customer-type + correct + withdraw
    assert csrf_fields >= action_forms


# ============ API action paths (form POST targets) ============

def test_api_action_paths_respect_roles(t44_env):
    """The form POST targets enforce the same role rules as the buttons
    suggest (owner-write / admin-only)."""
    env = t44_env

    # customer-type change: owner may change own record.
    r = env["owner_client"].post(
        f"/api/institutions/{env['inst_owned_id']}/customer-type",
        json={"customer_type": "individual"},
    )
    assert r.status_code == 200, r.text

    # release-to-pool: admin ok (reason required), business_user denied.
    r = env["admin_client"].post(
        f"/api/institutions/{env['inst_owned_id']}/release-to-pool",
        json={"reason": "客户已移交，释放回公池"},
    )
    assert r.status_code == 200, r.text
    r = env["owner_client"].post(
        f"/api/institutions/{env['inst_owned_id']}/release-to-pool",
        json={"reason": "x"},
    )
    assert r.status_code == 403

    # archive: admin only; a business_user gets 404 (no existence leak).
    r = env["admin_client"].post(
        f"/api/institutions/{env['inst_other_id']}/archive",
        json={"archive_reason": "业务终止"},
    )
    assert r.status_code == 200, r.text
    r = env["owner_client"].post(
        f"/api/institutions/{env['inst_other_id']}/archive",
        json={"archive_reason": "x"},
    )
    assert r.status_code == 404

    # claim: business_user only; admin denied (R-044).
    r = env["owner_client"].post(f"/api/institutions/{env['inst_pool_id']}/claim")
    assert r.status_code == 200, r.text
    r = env["admin_client"].post(f"/api/institutions/{env['inst_pool_id']}/claim")
    assert r.status_code == 403


def test_followup_correct_and_withdraw_api_paths(t44_env):
    """Owner-only correct/withdraw endpoints work for the owner and 404 for
    a non-owner (no existence leak)."""
    env = t44_env
    detail = env["owner_client"].get(f"/api/institutions/{env['inst_owned_id']}").json()
    act_id = detail["activities"][0]["id"]

    r = env["owner_client"].post(
        f"/api/institutions/{env['inst_owned_id']}/activities/{act_id}/correct",
        json={"change_reason": "记录有误，更正", "factual_body": "更正后的正文"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["factual_body"] == "更正后的正文"

    r = env["owner_client"].post(
        f"/api/institutions/{env['inst_owned_id']}/activities/{act_id}/withdraw",
        json={"withdrawal_reason": "此条跟进作废"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["withdrawn"] is True

    r = env["other_client"].post(
        f"/api/institutions/{env['inst_owned_id']}/activities/{act_id}/withdraw",
        json={"withdrawal_reason": "x"},
    )
    assert r.status_code == 404


# ============ Public-pool page ============

def test_pool_page_role_visibility(t44_env):
    """/pool 200 for business_user + administrator (claim button only for
    business_user), 403 for manager, 302→/login anonymous."""
    env = t44_env

    business = env["owner_client"].get("/pool")
    assert business.status_code == 200, business.text
    assert "T44 公池机构" in business.text
    assert 'claim-btn"' in business.text
    # A non-pool record must not leak into the pool page.
    assert "T44 自有机构" not in business.text

    admin = env["admin_client"].get("/pool")
    assert admin.status_code == 200, admin.text
    assert "T44 公池机构" in admin.text
    assert 'claim-btn"' not in admin.text

    gm = env["gm_client"].get("/pool")
    assert gm.status_code == 403

    anon = env["anonymous_client"].get("/pool", follow_redirects=False)
    assert anon.status_code == 302
    assert anon.headers["location"] == "/login"


def test_pool_page_masked_data_matches_api_projection(t44_env):
    """Pool page renders only API-projected summary fields, no raw detail
    fields (source_description must not leak)."""
    env = t44_env
    api = env["owner_client"].get("/api/institutions")
    assert api.status_code == 200, api.text
    api_items = {str(i["id"]): i for i in api.json()["items"]}
    assert env["inst_pool_id"] in api_items
    api_item = api_items[env["inst_pool_id"]]

    body = env["owner_client"].get("/pool").text
    assert api_item["name"] in body
    # source_description is a detail-only field; the summary projection
    # must not render it anywhere on the pool page.
    assert "s44b" not in body


# ============ Detail page masked parity ============

def test_detail_page_masked_data_matches_api(t44_env):
    """Detail page content matches the API masked projection (same query
    service, no extra fields)."""
    env = t44_env
    api = env["owner_client"].get(f"/api/institutions/{env['inst_owned_id']}")
    assert api.status_code == 200, api.text
    api_detail = api.json()
    assert api_detail["name"] == "T44 自有机构"

    body = env["owner_client"].get(f"/institutions/{env['inst_owned_id']}").text
    assert api_detail["name"] in body
    assert (api_detail.get("region") or "-") in body
    assert (api_detail.get("category") or "-") in body
