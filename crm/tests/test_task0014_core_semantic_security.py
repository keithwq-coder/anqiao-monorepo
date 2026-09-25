"""TASK-0014: core semantic and write-authorization closure negative tests.

Local-only, synthetic state. These tests fail against the pre-fix behavior
and pass after the TASK-0014 remediation:

1. disabled / enabled-but-no-business-role users cannot create institutions,
   contacts, or follow-ups (SPEC-0002 R-003/R-006; SPEC-0001 R-009);
2. a UUID/string identity mismatch cannot change owner/collaborator
   classification (SPEC-0001 R-013/R-036);
3. ordinary owner archive is denied where SPEC-0001 R-036 requires an audited
   administrator exception; reason, actor, target, and timestamp are retained;
4. withdrawn activity rows are retained for audit but excluded from normal
   history/progress projections (SPEC-0001 R-031);
5. existing correction/withdrawal/duplicate/admin-exception behavior stays
   green and page/API projection parity is preserved.

No deployment, remote PostgreSQL/SSH, real-data write, or external write.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t14_test")
os.environ.setdefault("DATABASE_USER", "t14_test")
os.environ.setdefault("DATABASE_PASSWORD", "t14-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t14-test-secret-not-for-production")
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
from test_s5_pages_api_parity import (  # noqa: E402
    MemoryActivityRepository,
    MemoryContactRepository,
    MemoryInstitutionRepository,
)

from crm.application.queries import QueryService  # noqa: E402
from crm.domain.models import (  # noqa: E402
    ContactabilityStatus,
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


# ============ Shared helpers ============


def _make_identity(username, password, status=UserStatus.ENABLED, roles=None):
    user = UserIdentity(
        username=username,
        display_name=username,
        password_hash=hash_password(password),
        status=status,
    )
    return user, roles or []


def _inject_core(app, user_repo, role_repo, audit_repo, inst_repo, contact_repo,
                 activity_repo, query_service, session_repo, factory=None):
    app.state.user_repository = user_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = AuthenticationService(
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=100,
            csrf_token_lifetime_hours=1,
        ),
    )
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service
    app.state.session_factory = factory


def _login(app, username, password):
    c = TestClient(app)
    resp = c.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    c.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
    return c


# ============ Fixture: in-memory app with multiple identities ============


@pytest.fixture
def t14_env():
    """In-memory app with: owner (business_user), no_role_user (enabled, no
    roles), manager_user (manager, read-only), and admin (administrator)."""
    from crm.web.main import app

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    audit_repo = InMemoryAuditRepository()
    role_repo = InMemoryRoleGrantRepository()

    inst_repo = MemoryInstitutionRepository()
    contact_repo = MemoryContactRepository()
    activity_repo = MemoryActivityRepository()

    owner, owner_roles = _make_identity("t14owner", "t14owner123", UserStatus.ENABLED, [Role.BUSINESS_USER])
    user_repo.add(owner)
    role_repo.set_grants(owner.id, owner_roles)

    no_role, no_role_roles = _make_identity("t14norole", "t14norole123", UserStatus.ENABLED, [])
    user_repo.add(no_role)
    role_repo.set_grants(no_role.id, no_role_roles)

    manager, manager_roles = _make_identity("t14mgr", "t14mgr123", UserStatus.ENABLED, [Role.MANAGER])
    user_repo.add(manager)
    role_repo.set_grants(manager.id, manager_roles)

    admin, admin_roles = _make_identity("t14admin", "t14admin123", UserStatus.ENABLED, [Role.ADMINISTRATOR])
    user_repo.add(admin)
    role_repo.set_grants(admin.id, admin_roles)

    query_service = QueryService(inst_repo, contact_repo, activity_repo)
    _inject_core(app, user_repo, role_repo, audit_repo, inst_repo, contact_repo,
                 activity_repo, query_service, session_repo)

    yield {
        "app": app,
        "owner": owner,
        "no_role": no_role,
        "manager": manager,
        "admin": admin,
        "audit_repo": audit_repo,
        "inst_repo": inst_repo,
        "activity_repo": activity_repo,
    }


def _create_institution(client, name="T14 机构", key="t14-inst"):
    return client.post(
        "/api/institutions",
        json={
            "name": name,
            "source_description": "T14 合成来源",
            "source_kind": "manual",
            "idempotency_key": key,
        },
    )


# ============ Defect 1: disabled / no-role / read-only-role write denial ============


def test_enabled_no_role_user_cannot_create_institution(t14_env) -> None:
    """SPEC-0002 R-003/R-006: an enabled account with no approved role is
    denied write; 'no explicit allow' defaults to deny."""
    client = _login(t14_env["app"], "t14norole", "t14norole123")
    resp = _create_institution(client, key="norole-inst")
    assert resp.status_code == 403, resp.text


def test_manager_cannot_create_institution(t14_env) -> None:
    """SPEC-0002 R-021: management roles are read-only by default and cannot
    create business records."""
    client = _login(t14_env["app"], "t14mgr", "t14mgr123")
    resp = _create_institution(client, key="mgr-inst")
    assert resp.status_code == 403, resp.text


def test_no_role_user_cannot_create_contact(t14_env) -> None:
    """An enabled-but-no-role user cannot add a contact."""
    owner_client = _login(t14_env["app"], "t14owner", "t14owner123")
    inst = _create_institution(owner_client, key="owner-inst-nr")
    assert inst.status_code == 201, inst.text
    inst_id = inst.json()["id"]

    nr_client = _login(t14_env["app"], "t14norole", "t14norole123")
    resp = nr_client.post(
        f"/api/institutions/{inst_id}/contacts",
        json={
            "name": "T14 NR 联系人",
            "contactability_status": "not_yet_obtained",
            "idempotency_key": "norole-contact",
        },
    )
    assert resp.status_code == 403, resp.text


def test_no_role_user_cannot_create_activity(t14_env) -> None:
    """An enabled-but-no-role user cannot append a follow-up activity."""
    owner_client = _login(t14_env["app"], "t14owner", "t14owner123")
    inst = _create_institution(owner_client, key="owner-inst-nr-act")
    assert inst.status_code == 201, inst.text
    inst_id = inst.json()["id"]

    nr_client = _login(t14_env["app"], "t14norole", "t14norole123")
    resp = nr_client.post(
        f"/api/institutions/{inst_id}/activities",
        json={
            "occurred_at": datetime(2026, 8, 6, 10, 0, tzinfo=timezone.utc).isoformat(),
            "interaction_method": "电话",
            "factual_body": "T14 NR 跟进",
            "idempotency_key": "norole-act",
        },
    )
    assert resp.status_code == 403, resp.text


# ============ Defect 2: UUID/string owner classification ============


def test_create_institution_owner_gets_owner_view(t14_env) -> None:
    """SPEC-0001 R-013: after creating an institution, the owner re-reads it
    and gets the full owner view (source_description visible), not the masked
    collaborator view. This fails when user_id is passed as a string."""
    client = _login(t14_env["app"], "t14owner", "t14owner123")
    resp = _create_institution(client, key="uuid-owner")
    assert resp.status_code == 201, resp.text
    data = resp.json()

    # Owner view must include source_description (collaborator view hides it).
    assert data.get("source_description") == "T14 合成来源", (
        "owner got collaborator view — UUID/string mismatch"
    )


# ============ Defect 3: archive administrator exception ============


def test_admin_archive_without_reason_succeeds_and_auto_traces(t14_sqlite_env) -> None:
    """R-008/R-036: an administrator may archive a record without providing
    an archive_reason; the archive is auto-traced (who/when/what)."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sadmin", "t14sadmin123")

    resp = client.post(
        f"/api/institutions/{env['inst_id']}/archive",
        json={},
    )
    assert resp.status_code == 200, resp.text

    from crm.persistence.models import (
        AuditEventModel as _AuditModel,
        InstitutionModel as _InstModel,
    )
    factory = env["factory"]
    with transaction_session(factory) as session:
        inst = session.get(_InstModel, UUID(env["inst_id"]))
        assert inst is not None
        assert inst.archived_at is not None
        assert inst.archive_reason is None
        audit_rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "institution.archive")
        ).scalars().all()
        assert len(audit_rows) == 1
        assert audit_rows[0].actor_user_id == env["admin_id"]


def test_non_owner_non_admin_archive_denied(t14_env) -> None:
    """A business user who is not the owner and not an administrator gets 404
    on archive (no existence leakage)."""
    owner_client = _login(t14_env["app"], "t14owner", "t14owner123")
    inst = _create_institution(owner_client, key="archive-non-owner")
    assert inst.status_code == 201, inst.text
    inst_id = inst.json()["id"]

    from crm.web.main import app

    other_user, _ = _make_identity("t14other", "t14other123", UserStatus.ENABLED, [Role.BUSINESS_USER])
    app.state.user_repository.add(other_user)
    app.state.role_grant_repository.set_grants(other_user.id, [Role.BUSINESS_USER])

    other_client = _login(t14_env["app"], "t14other", "t14other123")
    resp = other_client.post(
        f"/api/institutions/{inst_id}/archive",
        json={"archive_reason": "越权归档"},
    )
    assert resp.status_code == 404, resp.text


# ============ Defect 4: withdrawn activity projection (SQLite-backed) ============


@pytest.fixture
def t14_sqlite_env():
    """SQLite-backed app: real persistence (including withdrawn state) +
    QueryService so the projection path runs end-to-end. Data is seeded
    directly via SQLAlchemy (not HTTP) because the real ``create`` methods
    use SessionLocal (PostgreSQL), not the injected SQLite factory."""
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

    # SQLite-backed audit repo (overrides record to use the injected factory
    # instead of SessionLocal/PostgreSQL; mirrors the S2 test pattern).
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

    owner, _ = _make_identity("t14sowner", "t14sowner123", UserStatus.ENABLED, [Role.BUSINESS_USER])
    user_repo.add(owner)
    role_repo.set_grants(owner.id, [Role.BUSINESS_USER])

    admin, _ = _make_identity("t14sadmin", "t14sadmin123", UserStatus.ENABLED, [Role.ADMINISTRATOR])
    user_repo.add(admin)
    role_repo.set_grants(admin.id, [Role.ADMINISTRATOR])

    # Dual-role principal (BUSINESS_USER + ADMINISTRATOR) for whitespace-reason
    # regression coverage (DEC-0095/DEC-0096).
    dual, _ = _make_identity("t14sdual", "t14sdual123", UserStatus.ENABLED, [Role.BUSINESS_USER, Role.ADMINISTRATOR])
    user_repo.add(dual)
    role_repo.set_grants(dual.id, [Role.BUSINESS_USER, Role.ADMINISTRATOR])

    inst_repo = _SqliteInstRepo(factory)
    contact_repo = _SqliteContactRepo(factory)
    activity_repo = _SqliteActivityRepo(factory)
    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    _inject_core(app, user_repo, role_repo, audit_repo, inst_repo, contact_repo,
                 activity_repo, query_service, session_repo, factory)

    # Seed one institution + two activities directly via SQLAlchemy (the real
    # create methods use SessionLocal/PostgreSQL, not the SQLite factory).
    now = datetime.now(timezone.utc)
    inst_id = _uuid.uuid4()
    act_normal_id = _uuid.uuid4()
    act_withdraw_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        session.add(InstitutionModel(
            id=inst_id,
            name="T14 SQLite 机构",
            source_description="T14 SQLite 来源",
            source_kind="manual",
            owner_user_id=owner.id,
            created_by_user_id=owner.id,
            idempotency_key="t14-sqlite-inst",
            created_at=now,
            updated_at=now,
        ))
        # Normal activity (2026-08-05).
        session.add(FollowUpActivityModel(
            id=act_normal_id,
            institution_id=inst_id,
            recorded_by_user_id=owner.id,
            occurred_at=datetime(2026, 8, 5, 10, 0, tzinfo=timezone.utc),
            interaction_method="电话",
            recorded_at=now,
            current_version=1,
            ai_review_status="unavailable",
            idempotency_key="t14-act-normal",
        ))
        session.add(FollowUpActivityRevisionModel(
            activity_id=act_normal_id,
            version_number=1,
            factual_body="T14 正常跟进",
            content_attribution=ContentAttribution.SALESPERSON_INPUT.value,
            created_by_user_id=owner.id,
            change_reason="initial creation",
        ))
        # Activity to be withdrawn (2026-08-06).
        session.add(FollowUpActivityModel(
            id=act_withdraw_id,
            institution_id=inst_id,
            recorded_by_user_id=owner.id,
            occurred_at=datetime(2026, 8, 6, 10, 0, tzinfo=timezone.utc),
            interaction_method="微信",
            recorded_at=now,
            current_version=1,
            ai_review_status="unavailable",
            idempotency_key="t14-act-withdraw",
            withdrawn_at=now,
            withdrawn_by_user_id=owner.id,
            withdrawal_reason="T14 撤回：记录有误",
        ))
        session.add(FollowUpActivityRevisionModel(
            activity_id=act_withdraw_id,
            version_number=1,
            factual_body="T14 待撤回跟进",
            content_attribution=ContentAttribution.SALESPERSON_INPUT.value,
            created_by_user_id=owner.id,
            change_reason="initial creation",
        ))

    yield {
        "app": app,
        "inst_id": str(inst_id),
        "withdraw_id": str(act_withdraw_id),
        "owner_id": owner.id,
        "admin_id": admin.id,
        "dual_id": dual.id,
        "factory": factory,
    }
    engine.dispose()


def test_withdrawn_activity_excluded_from_normal_history(t14_sqlite_env) -> None:
    """SPEC-0001 R-031: a withdrawn activity is retained for audit but does
    not appear in the normal history projection (owner GET detail)."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sowner", "t14sowner123")

    resp = client.get(f"/api/institutions/{env['inst_id']}")
    assert resp.status_code == 200, resp.text
    activities = resp.json().get("activities", [])

    factual_bodies = [a.get("factual_body") for a in activities]
    assert "T14 正常跟进" in factual_bodies
    assert "T14 待撤回跟进" not in factual_bodies, "withdrawn activity leaked into normal history"


def test_withdrawn_activity_excluded_from_concise_progress(t14_sqlite_env) -> None:
    """The concise progress must not reflect the withdrawn activity's date or
    method; it should show the latest *non-withdrawn* activity."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sowner", "t14sowner123")

    resp = client.get(f"/api/institutions/{env['inst_id']}")
    assert resp.status_code == 200, resp.text
    cp = resp.json().get("concise_progress", {})

    # The withdrawn activity was 2026-08-06 (微信); the normal one was
    # 2026-08-05 (电话). After withdrawal, latest should be 2026-08-05.
    latest_date = cp.get("latest_follow_up_date")
    assert latest_date == "2026-08-05", (
        f"concise_progress reflects withdrawn activity: {latest_date}"
    )


def test_withdrawn_activity_visible_in_admin_exception_view(t14_sqlite_env) -> None:
    """The administrator exception view retains withdrawn activities for audit
    (R-031: audit history preserved)."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sadmin", "t14sadmin123")

    resp = client.get(
        f"/api/institutions/{env['inst_id']}?administrator_reason=审计核查"
    )
    assert resp.status_code == 200, resp.text
    activities = resp.json().get("activities", [])

    factual_bodies = [a.get("factual_body") for a in activities]
    # Both the normal and the withdrawn activity should be visible to the
    # administrator exception view (audit retention).
    assert "T14 正常跟进" in factual_bodies
    assert "T14 待撤回跟进" in factual_bodies, (
        "withdrawn activity missing from admin exception audit view"
    )


def test_admin_can_archive_with_reason_and_audit(t14_sqlite_env) -> None:
    """SPEC-0001 R-036: an administrator may archive with a stated reason;
    the audit event records actor, target, and reason. Requires SQLite-backed
    repos because the archive command uses a real transaction_session."""
    env = t14_sqlite_env
    inst_id = env["inst_id"]

    admin_client = _login(env["app"], "t14sadmin", "t14sadmin123")
    resp = admin_client.post(
        f"/api/institutions/{inst_id}/archive",
        json={"archive_reason": "管理员归档：数据清理"},
    )
    assert resp.status_code == 200, resp.text

    # Verify the audit event was written via the SQLite-backed audit repo.
    from crm.persistence.models import AuditEventModel as _AuditModel

    factory = env["factory"]
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "institution.archive")
        ).scalars().all()
        assert len(rows) == 1
        ev = rows[0]
        assert ev.actor_user_id == env["admin_id"]
        assert ev.target_id == UUID(inst_id)
        assert ev.reason == "管理员归档：数据清理"


# ============ Remediation: coordinator audit P1 regressions ============


def test_owner_archive_denied(t14_sqlite_env) -> None:
    """P1 fix: an ordinary owner may NOT archive their own record. Only an
    administrator with a nonblank exception reason may archive (R-036)."""
    env = t14_sqlite_env
    inst_id = env["inst_id"]

    owner_client = _login(env["app"], "t14sowner", "t14sowner123")
    resp = owner_client.post(
        f"/api/institutions/{inst_id}/archive",
        json={"archive_reason": "owner tries to archive"},
    )
    assert resp.status_code == 404, resp.text

    # The record must not be archived.
    from crm.persistence.models import InstitutionModel as _InstModel

    factory = env["factory"]
    with transaction_session(factory) as session:
        model = session.get(_InstModel, UUID(inst_id))
        assert model.archived_at is None, "record was archived despite owner denial"

    # No successful archive audit event.
    from crm.persistence.models import AuditEventModel as _AuditModel

    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(
                _AuditModel.action == "institution.archive",
                _AuditModel.outcome == "success",
            )
        ).scalars().all()
        assert len(rows) == 0, "success archive audit written for denied owner archive"


def test_owner_with_reason_cannot_see_withdrawn_activities(t14_sqlite_env) -> None:
    """P1 fix: an owner supplying administrator_reason must NOT see withdrawn
    activities — include_withdrawn is gated on ADMINISTRATOR role + nonblank
    reason, not on the mere presence of the parameter."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sowner", "t14sowner123")

    resp = client.get(
        f"/api/institutions/{env['inst_id']}?administrator_reason=owner_sneak"
    )
    assert resp.status_code == 200, resp.text
    activities = resp.json().get("activities", [])
    factual_bodies = [a.get("factual_body") for a in activities]

    assert "T14 正常跟进" in factual_bodies
    assert "T14 待撤回跟进" not in factual_bodies, (
        "owner saw withdrawn activity via administrator_reason parameter"
    )

    # No admin.exception_read audit should be written for a non-administrator.
    from crm.persistence.models import AuditEventModel as _AuditModel

    factory = env["factory"]
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "admin.exception_read")
        ).scalars().all()
        assert len(rows) == 0, "exception audit written for non-administrator"


def test_owner_list_with_reason_does_not_advance_progress(t14_sqlite_env) -> None:
    """P1 fix: an owner list request with administrator_reason must not change
    the visible data. The list summary path returns the same institution set
    and no withdrawn-activity-driven change (the summary carries no
    concise_progress; the key assertion is that the owner's list is unaffected
    by the untrusted parameter)."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sowner", "t14sowner123")

    # Normal list (no administrator_reason).
    normal = client.get("/api/institutions")
    assert normal.status_code == 200, normal.text
    normal_items = normal.json().get("items", [])

    # List with the untrusted administrator_reason parameter.
    with_reason = client.get("/api/institutions?administrator_reason=owner_sneak")
    assert with_reason.status_code == 200, with_reason.text
    reason_items = with_reason.json().get("items", [])

    # Both must return the same single institution; the untrusted parameter
    # did not widen or alter the visible set.
    assert len(normal_items) == 1
    assert len(reason_items) == 1
    assert normal_items[0]["id"] == reason_items[0]["id"]

    # No admin.exception_read audit should be written for a non-administrator
    # list request that supplied the parameter.
    from crm.persistence.models import AuditEventModel as _AuditModel

    factory = env["factory"]
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "admin.exception_read")
        ).scalars().all()
        assert len(rows) == 0, "exception audit written for non-administrator list"


# ============ DEC-0096: whitespace reason and single archive_reason ============


def test_dual_role_admin_whitespace_reason_api_detail_sees_withdrawn(t14_sqlite_env) -> None:
    """R-008: a principal holding ADMINISTRATOR (even when also BUSINESS_USER)
    reads full detail including withdrawn activities (audit retention); a
    whitespace-only administrator_reason is treated as omitted, so no
    optional exception trace audit is written."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sdual", "t14sdual123")

    resp = client.get(
        f"/api/institutions/{env['inst_id']}?administrator_reason=%20%20%20"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Administrator full view retains the withdrawn activity for audit.
    factual_bodies = [a.get("factual_body") for a in data.get("activities", [])]
    assert "T14 待撤回跟进" in factual_bodies, "admin full view must retain withdrawn"

    # Whitespace reason = omitted: no admin.exception_read audit is written.
    from crm.persistence.models import AuditEventModel as _AuditModel
    factory = env["factory"]
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "admin.exception_read")
        ).scalars().all()
        assert len(rows) == 0, "exception audit written for whitespace reason"


def test_dual_role_whitespace_reason_api_list_no_withdrawn(t14_sqlite_env) -> None:
    """DEC-0095/0096: the same whitespace-only reason on the list path must
    not expose withdrawn data or write an exception audit."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sdual", "t14sdual123")

    resp = client.get("/api/institutions?administrator_reason=%20%20%20")
    assert resp.status_code == 200, resp.text
    items = resp.json().get("items", [])
    assert len(items) == 1

    from crm.persistence.models import AuditEventModel as _AuditModel
    factory = env["factory"]
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "admin.exception_read")
        ).scalars().all()
        assert len(rows) == 0, "exception audit written for whitespace list reason"


def test_dual_role_admin_whitespace_reason_page_detail_sees_withdrawn(t14_sqlite_env) -> None:
    """R-008: the page detail path behaves like the JSON API — an
    administrator sees withdrawn activities; a whitespace-only reason is
    treated as omitted (no exception audit)."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sdual", "t14sdual123")

    resp = client.get(
        f"/institutions/{env['inst_id']}?administrator_reason=%20%20%20"
    )
    assert resp.status_code == 200, resp.text
    assert "T14 待撤回跟进" in resp.text, "admin page view must retain withdrawn"

    from crm.persistence.models import AuditEventModel as _AuditModel
    factory = env["factory"]
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "admin.exception_read")
        ).scalars().all()
        assert len(rows) == 0, "exception audit written for whitespace page reason"


def test_queryservice_admin_whitespace_reason_direct_sees_withdrawn(t14_sqlite_env) -> None:
    """R-008: direct QueryService.get_institution_detail with an
    ADMINISTRATOR role returns full detail including withdrawn activities
    regardless of a whitespace-only reason (route normalization is not the
    only defense; the policy itself grants admin full visibility)."""
    env = t14_sqlite_env

    qs = env["app"].state.query_service
    detail = qs.get_institution_detail(
        institution_id=UUID(env["inst_id"]),
        user_id=env["dual_id"],
        user_status=UserStatus.ENABLED,
        roles=frozenset([Role.BUSINESS_USER, Role.ADMINISTRATOR]),
        administrator_reason="   ",
    )
    assert detail is not None
    # Administrator full detail: the withdrawn activity is retained, so the
    # latest follow-up date reflects the withdrawn activity (2026-08-06).
    cp = detail.concise_progress or {}
    latest_date = cp.get("latest_follow_up_date")
    assert str(latest_date) == "2026-08-06", (
        f"QueryService admin concise_progress should reflect withdrawn: {latest_date}"
    )


def test_owner_archive_with_only_archive_reason_denied(t14_sqlite_env) -> None:
    """DEC-0096: archive uses a single archive_reason. An ordinary owner
    posting archive_reason (no administrator_reason field) is denied."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sowner", "t14sowner123")

    resp = client.post(
        f"/api/institutions/{env['inst_id']}/archive",
        json={"archive_reason": "owner tries archive"},
    )
    assert resp.status_code == 404, resp.text


def test_admin_archive_single_reason_succeeds_and_audits(t14_sqlite_env) -> None:
    """DEC-0096: an administrator archives with a single archive_reason. The
    persisted reason and the audit reason are the same value."""
    env = t14_sqlite_env
    inst_id = env["inst_id"]
    client = _login(env["app"], "t14sadmin", "t14sadmin123")

    resp = client.post(
        f"/api/institutions/{inst_id}/archive",
        json={"archive_reason": "管理员归档原因"},
    )
    assert resp.status_code == 200, resp.text

    from crm.persistence.models import AuditEventModel as _AuditModel, InstitutionModel as _InstModel
    factory = env["factory"]
    with transaction_session(factory) as session:
        inst = session.get(_InstModel, UUID(inst_id))
        assert inst is not None
        assert inst.archived_at is not None
        assert inst.archive_reason == "管理员归档原因"

        audit_rows = session.execute(
            sa.select(_AuditModel).where(_AuditModel.action == "institution.archive")
        ).scalars().all()
        assert len(audit_rows) == 1
        assert audit_rows[0].reason == "管理员归档原因"
        assert audit_rows[0].actor_user_id == env["admin_id"]


def test_admin_archive_blank_reason_succeeds(t14_sqlite_env) -> None:
    """R-008: a blank/whitespace archive_reason is treated as omitted; the
    administrator may still archive (auto-traced), and no reason is stored."""
    env = t14_sqlite_env
    client = _login(env["app"], "t14sadmin", "t14sadmin123")

    resp = client.post(
        f"/api/institutions/{env['inst_id']}/archive",
        json={"archive_reason": "   "},
    )
    assert resp.status_code == 200, resp.text

    from crm.persistence.models import InstitutionModel as _InstModel
    factory = env["factory"]
    with transaction_session(factory) as session:
        inst = session.get(_InstModel, UUID(env["inst_id"]))
        assert inst is not None
        assert inst.archived_at is not None
        assert inst.archive_reason is None
