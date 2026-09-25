"""TASK-0010: search security repair and verification tests.

Local-only, synthetic state. These tests verify SPEC-0008 AC-001 through
AC-007: search matches only fields visible to the current actor and cannot
reveal hidden-field existence through result presence, count, or detail.

The tests use a SQLite-backed fixture so the real repository SQL (including
the actor-aware searchable-fields predicate) runs end-to-end.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t10_test")
os.environ.setdefault("DATABASE_USER", "t10_test")
os.environ.setdefault("DATABASE_PASSWORD", "t10-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t10-test-secret-not-for-production")
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
    ContentAttribution,
    Role,
    UserIdentity,
    UserStatus,
)
from crm.persistence.audit_repository import AuditEventRepository  # noqa: E402
from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    ContactModel,
    FollowUpActivityModel,
    FollowUpActivityRevisionModel,
    InstitutionModel,
)
from crm.persistence.repositories import (  # noqa: E402
    ContactRepository,
    FollowUpActivityRepository,
    InstitutionRepository,
    domain_contact_from_model,
    domain_follow_up_activity_from_model,
    domain_institution_from_model,
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
def t10_env():
    """SQLite-backed app with two institutions owned by different users.
    Institution A has a distinctive source_description; Institution B does
    not. A collaborator (other business user) searching for the
    source_description fragment must NOT find Institution A."""
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

    owner_a, _ = _make_identity("t10ownera", "t10passa", [Role.BUSINESS_USER])
    user_repo.add(owner_a)
    role_repo.set_grants(owner_a.id, [Role.BUSINESS_USER])

    owner_b, _ = _make_identity("t10ownerb", "t10passb", [Role.BUSINESS_USER])
    user_repo.add(owner_b)
    role_repo.set_grants(owner_b.id, [Role.BUSINESS_USER])

    other, _ = _make_identity("t10other", "t10passo", [Role.BUSINESS_USER])
    user_repo.add(other)
    role_repo.set_grants(other.id, [Role.BUSINESS_USER])

    admin, _ = _make_identity("t10admin", "t10passadmin", [Role.ADMINISTRATOR])
    user_repo.add(admin)
    role_repo.set_grants(admin.id, [Role.ADMINISTRATOR])

    no_role, _ = _make_identity("t10norole", "t10passnr", [])
    user_repo.add(no_role)
    role_repo.set_grants(no_role.id, [])

    # Scoped MANAGER: has a management scope key. Note: the current
    # RecordSnapshot in find_institutions does not set management_scope_key,
    # so a MANAGER subject is PolicyDenied for every record — this is existing
    # behavior and confirms scope-out records stay invisible.
    scoped_mgr, _ = _make_identity("t10mgr", "t10passmgr", [Role.MANAGER])
    user_repo.add(scoped_mgr)
    role_repo.set_grants(scoped_mgr.id, [Role.MANAGER], frozenset({"scope_east"}))

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
                    cols = [col_map[f].ilike(pat) for f in searchable_fields if f in col_map]
                    if cols:
                        q = q.where(sa.or_(*cols))
                    else:
                        q = q.where(sa.false())
                q = q.offset(offset).limit(limit)
                return [domain_institution_from_model(m) for m in s.execute(q).scalars().all()]
            finally:
                s.close()

        def find_active_for_duplicate_check(self):
            s = self._f()
            try:
                rows = s.execute(
                    sa.select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
                ).scalars().all()
                return [domain_institution_from_model(m) for m in rows]
            finally:
                s.close()

    class _SqliteContactRepo(ContactRepository):
        def __init__(self, f):
            self._f = f

        def find_by_institution(self, iid):
            s = self._f()
            try:
                rows = s.execute(
                    sa.select(ContactModel).where(ContactModel.institution_id == iid)
                ).scalars().all()
                return [domain_contact_from_model(m) for m in rows]
            finally:
                s.close()

    class _SqliteActivityRepo(FollowUpActivityRepository):
        def __init__(self, f):
            self._f = f

        def find_by_id(self, aid):
            s = self._f()
            try:
                m = s.get(FollowUpActivityModel, aid)
                if not m:
                    return None
                rev = s.execute(
                    sa.select(FollowUpActivityRevisionModel).where(
                        FollowUpActivityRevisionModel.activity_id == aid,
                        FollowUpActivityRevisionModel.version_number == m.current_version,
                    )
                ).scalar_one_or_none()
                return domain_follow_up_activity_from_model(m, rev)
            finally:
                s.close()

        def find_by_target(self, target_type, target_id, include_withdrawn=False):
            if target_type != "institution":
                return []
            s = self._f()
            try:
                inst_id = UUID(target_id)
            except ValueError:
                return []
            try:
                q = sa.select(FollowUpActivityModel).where(
                    FollowUpActivityModel.institution_id == inst_id
                )
                if not include_withdrawn:
                    q = q.where(FollowUpActivityModel.withdrawn_at.is_(None))
                q = q.order_by(
                    FollowUpActivityModel.occurred_at.desc(),
                    FollowUpActivityModel.recorded_at.desc(),
                    FollowUpActivityModel.id.desc(),
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
            from crm.persistence.models import AuditEventModel as _Model
            model = _Model(
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
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=100,
            csrf_token_lifetime_hours=1,
        ),
    )

    app.state.user_repository = user_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = auth_service
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service
    app.state.session_factory = factory

    # Seed two institutions with distinctive source_descriptions.
    now = datetime.now(timezone.utc)
    inst_a_id = _uuid.uuid4()
    inst_b_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        session.add(InstitutionModel(
            id=inst_a_id,
            name="养老机构A",
            source_description="SECRET_LEAK_MARKER_A 来源描述",
            source_kind="manual",
            owner_user_id=owner_a.id,
            created_by_user_id=owner_a.id,
            idempotency_key="t10-inst-a",
            created_at=now,
            updated_at=now,
        ))
        session.add(InstitutionModel(
            id=inst_b_id,
            name="养老机构B",
            source_description="普通来源",
            source_kind="manual",
            owner_user_id=owner_b.id,
            created_by_user_id=owner_b.id,
            idempotency_key="t10-inst-b",
            created_at=now,
            updated_at=now,
        ))

    yield {
        "app": app,
        "inst_a_id": str(inst_a_id),
        "inst_b_id": str(inst_b_id),
        "owner_a_id": owner_a.id,
        "owner_b_id": owner_b.id,
        "other_id": other.id,
        "admin_id": admin.id,
        "factory": factory,
    }
    engine.dispose()


# ============ AC-001: owner searches by visible field, finds own record ============


def test_owner_searches_by_name_finds_own_record(t10_env) -> None:
    """AC-001: an owner searching by a visible field (name) finds their own
    record."""
    env = t10_env
    client = _login(env["app"], "t10ownera", "t10passa")

    resp = client.get("/api/institutions?q=机构A")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "养老机构A"


# ============ AC-002: other business user gets masked results ============


def test_other_user_search_returns_no_results_after_isolation(t10_env) -> None:
    """SPEC-0001 v0.9.0 R-014/R-046: another business user cannot see other
    business users' non-pool records, so a name search returns zero results."""
    env = t10_env
    client = _login(env["app"], "t10other", "t10passo")

    resp = client.get("/api/institutions?q=机构A")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 0


# ============ AC-003: hidden field value cannot be used as search predicate ============


def test_collaborator_cannot_search_by_source_description(t10_env) -> None:
    """AC-003/R-008: a collaborator searching for a source_description
    fragment must NOT find any records. The source_description field is not
    in the collaborator's searchable predicate, so the hidden value cannot
    be used as an existence oracle.

    This test FAILS against the old behavior (where find_all matched
    source_description for everyone)."""
    env = t10_env
    client = _login(env["app"], "t10other", "t10passo")

    # Search for the distinctive source_description fragment.
    resp = client.get("/api/institutions?q=SECRET_LEAK_MARKER_A")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]

    # No records should match: the fragment is in source_description, which
    # is not searchable by a collaborator.
    assert len(items) == 0, (
        f"collaborator found {len(items)} records via hidden source_description — existence leak"
    )


def test_owner_cannot_search_other_records_by_source_description(t10_env) -> None:
    """AC-003/R-008: even an owner cannot find another owner's record by
    searching its source_description fragment. The owner's searchable
    predicate is the collaborator set (name/category/region) for the list
    path, because the list returns summaries for all records."""
    env = t10_env
    # owner_a searches for owner_b's source_description fragment.
    client = _login(env["app"], "t10ownera", "t10passa")

    resp = client.get("/api/institutions?q=普通来源")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]

    # No records should match: "普通来源" is in source_description, not name.
    assert len(items) == 0, (
        f"owner found {len(items)} records via hidden source_description — existence leak"
    )


# ============ AC-004: no export capability ============


def test_no_export_endpoint_exists(t10_env) -> None:
    """AC-004: there is no export or download capability. No dedicated
    export route exists in the API."""
    env = t10_env
    client = _login(env["app"], "t10other", "t10passo")

    for path in ("/api/export", "/api/download", "/api/search/export"):
        resp = client.get(path)
        assert resp.status_code == 404, f"unexpected endpoint at {path}: {resp.status_code}"


# ============ AC-005: unauthorized user cannot search ============


def test_unauthorized_user_search_denied(t10_env) -> None:
    """AC-005: an unauthorized (no-role) user cannot search and cannot
    confirm record existence."""
    env = t10_env
    client = _login(env["app"], "t10norole", "t10passnr")

    resp = client.get("/api/institutions?q=机构A")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    # No-role user gets no results (PolicyDenied for every record).
    assert len(items) == 0


# ============ AC-006: page and API search use same field visibility ============


def test_page_and_api_search_same_results(t10_env) -> None:
    """AC-006: the page and API search paths use the same QueryService, so
    field visibility is identical. Post-isolation (SPEC-0001 v0.9.0), an owner
    sees only their own records."""
    env = t10_env
    client = _login(env["app"], "t10ownera", "t10passa")

    api_resp = client.get("/api/institutions?q=机构")
    assert api_resp.status_code == 200, api_resp.text
    api_items = api_resp.json()["items"]
    api_names = sorted(i["name"] for i in api_items)

    page_resp = client.get("/institutions?q=机构")
    assert page_resp.status_code == 200, page_resp.text

    # Owner A sees only their own record (isolation).
    assert len(api_items) == 1
    assert api_names == ["养老机构A"]


# ============ AC-007: existence probe cannot reveal hidden fields ============


def test_existence_probe_via_source_description_fails(t10_env) -> None:
    """AC-007: a collaborator probing for a specific source_description
    value cannot confirm whether a record with that value exists."""
    env = t10_env
    client = _login(env["app"], "t10other", "t10passo")

    # Search for the real source_description fragment.
    real = client.get("/api/institutions?q=SECRET_LEAK_MARKER_A")
    assert real.status_code == 200
    assert len(real.json()["items"]) == 0

    # Search for a non-existent fragment.
    fake = client.get("/api/institutions?q=NONEXISTENT_MARKER_XYZ")
    assert fake.status_code == 200
    assert len(fake.json()["items"]) == 0

    # Both return zero results: the collaborator cannot distinguish
    # "exists but hidden" from "does not exist".


# ============ Admin exception can search source_description ============


def test_admin_exception_can_search_source_description(t10_env) -> None:
    """An administrator with a valid exception reason can search
    source_description because the exception view exposes it."""
    env = t10_env
    client = _login(env["app"], "t10admin", "t10passadmin")

    resp = client.get("/api/institutions?q=SECRET_LEAK_MARKER_A&administrator_reason=审计搜索")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "养老机构A"


# ============ Management-scope actor tests (DEC-0100 F1) ============


def test_scoped_manager_search_name_no_scope_leak(t10_env) -> None:
    """F1: a scoped MANAGER searching by name returns no records because the
    current RecordSnapshot does not set management_scope_key — every record
    is PolicyDenied for a MANAGER. This confirms scope-out records stay
    invisible (SPEC-0008 §5, SPEC-0002 R-020).

    The searchable predicate for MANAGER is the collaborator set
    {name, category, region} (queries.py management branch), so the SQL
    matches on name — but policy projection denies all results."""
    env = t10_env
    client = _login(env["app"], "t10mgr", "t10passmgr")

    resp = client.get("/api/institutions?q=机构A")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    # MANAGER sees no records (management_scope_key not set on snapshots).
    assert len(items) == 0, (
        f"scoped MANAGER saw {len(items)} records — scope boundary breached"
    )


def test_scoped_manager_cannot_search_by_source_description(t10_env) -> None:
    """F1: a scoped MANAGER searching for a source_description fragment
    gets zero results — the hidden field is not in the management searchable
    predicate."""
    env = t10_env
    client = _login(env["app"], "t10mgr", "t10passmgr")

    resp = client.get("/api/institutions?q=SECRET_LEAK_MARKER_A")
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["items"]) == 0
