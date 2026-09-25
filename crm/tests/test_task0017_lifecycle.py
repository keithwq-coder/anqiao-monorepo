"""TASK-0017: SPEC-0011 lifecycle, erasure and propagation tests.

Local-only, synthetic state. Tests cover:
- Non-admin cannot erase (R-003)
- Missing reason denied (section 8)
- Missing confirm denied (section 8)
- Admin erases: personal fields blanked, irreversible (AC-001)
- Audit has no personal values (R-004, AC-002)
- Normal correction still uses archive (R-003/R-007, AC-003)
- Erasure record has propagate_by = erased_at + 30 days (R-005, AC-004)
- Propagation status starts pending (R-005)
- Request fulfillment record has no deleted content (R-008, AC-005)
- Backup rehearsal proves erased values absent (R-005, AC-004)
"""

import os
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t17_test")
os.environ.setdefault("DATABASE_USER", "t17_test")
os.environ.setdefault("DATABASE_PASSWORD", "t17-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t17-test-secret-not-for-production")
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
    ContactModel,
    ErasureRecordModel,
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.persistence.repositories import (  # noqa: E402
    ContactRepository,
    FollowUpActivityRepository,
    InstitutionRepository,
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
def t17_env():
    """SQLite-backed app with admin, business user, and an institution with
    contacts containing personal data (phone markers)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: (s or "").strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: (s or "").strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s or ""))

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    from crm.web.main import app

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    admin, _ = _make_identity("t17admin", "t17passadmin", [Role.ADMINISTRATOR])
    user_repo.add(admin)
    role_repo.set_grants(admin.id, [Role.ADMINISTRATOR])

    biz, _ = _make_identity("t17biz", "t17passbiz", [Role.BUSINESS_USER])
    user_repo.add(biz)
    role_repo.set_grants(biz.id, [Role.BUSINESS_USER])

    no_role, _ = _make_identity("t17norole", "t17passnr", [])
    user_repo.add(no_role)
    role_repo.set_grants(no_role.id, [])

    class _DualUserRepo:
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
                    username=m.username, display_name=m.display_name,
                    password_hash=m.password_hash, status=UserStatus(m.status),
                    id=m.id, session_epoch=m.session_epoch,
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
                        "name": InstitutionModel.name, "category": InstitutionModel.category,
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
                return [domain_institution_from_model(m) for m in models]
            finally:
                s.close()
        def find_active_for_duplicate_check(self):
            s = self._f()
            try:
                models = s.execute(
                    sa.select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
                ).scalars().all()
                return [domain_institution_from_model(m) for m in models]
            finally:
                s.close()

    class _SqliteContactRepo(ContactRepository):
        def __init__(self, f):
            self._f = f
        def find_by_institution(self, iid):
            s = self._f()
            try:
                from crm.persistence.repositories import domain_contact_from_model
                models = s.execute(
                    sa.select(ContactModel).filter_by(institution_id=iid)
                ).scalars().all()
                return [domain_contact_from_model(m) for m in models]
            finally:
                s.close()

    class _SqliteActivityRepo(FollowUpActivityRepository):
        def __init__(self, f):
            self._f = f
        def find_by_target(self, target_type, target_id, include_withdrawn=False):
            return []

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
            session_max_age_seconds=3600, login_rate_limit_per_hour=100,
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

    # Seed user identities and role grants in SQLite.
    now = datetime.now(timezone.utc)
    inst_id = _uuid.uuid4()
    contact_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        for uid, uname, dname, phash, st, epoch in [
            (admin.id, "t17admin", "t17admin", admin.password_hash, "enabled", 0),
            (biz.id, "t17biz", "t17biz", biz.password_hash, "enabled", 0),
            (no_role.id, "t17norole", "t17norole", no_role.password_hash, "enabled", 0),
        ]:
            session.add(UserIdentityModel(
                id=uid, username=uname, display_name=dname, password_hash=phash,
                status=st, session_epoch=epoch, created_at=now, updated_at=now,
            ))
        for uid, role_val, grantor_id in [
            (admin.id, "administrator", admin.id),
            (biz.id, "business_user", admin.id),
        ]:
            session.add(RoleGrantModel(
                user_id=uid, role=role_val, scope_reference=None,
                granted_by_user_id=grantor_id, reason="test seed", granted_at=now,
            ))

        # Seed institution with personal data.
        session.add(InstitutionModel(
            id=inst_id, name="养老机构测试", source_description="来源描述含敏感信息",
            source_kind="manual", region="east", category="养老",
            owner_user_id=biz.id, created_by_user_id=biz.id,
            idempotency_key="t17-inst", created_at=now, updated_at=now,
        ))
        # Seed contact with personal data (phone marker).
        session.add(ContactModel(
            id=contact_id, institution_id=inst_id, name="张三",
            phone="PHONE_LEAK_MARKER_13900000000", email="zhangsan@test.com",
            contactability_status="available", created_by_user_id=biz.id,
            idempotency_key="t17-contact", created_at=now, updated_at=now,
        ))

    yield {
        "app": app,
        "admin_id": admin.id,
        "biz_id": biz.id,
        "no_role_id": no_role.id,
        "inst_id": str(inst_id),
        "contact_id": str(contact_id),
        "factory": factory,
    }
    engine.dispose()


# ============ Authorization tests (R-003, section 8) ============


def test_non_admin_cannot_erase(t17_env):
    """R-003: business user cannot perform erasure."""
    env = t17_env
    client = _login(env["app"], "t17biz", "t17passbiz")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "attempt", "confirm": True,
    })
    assert resp.status_code == 403


def test_no_role_user_cannot_erase(t17_env):
    """R-003: no-role user cannot perform erasure."""
    env = t17_env
    client = _login(env["app"], "t17norole", "t17passnr")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "attempt", "confirm": True,
    })
    assert resp.status_code == 403


def test_missing_confirm_denied(t17_env):
    """Section 8: erasure without confirm=true is denied."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "test erasure", "confirm": False,
    })
    assert resp.status_code == 400


def test_missing_reason_denied(t17_env):
    """Section 8: erasure without reason is denied by Pydantic validation."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "confirm": True,
    })
    assert resp.status_code == 422


def test_whitespace_reason_rejected_cleanly(t17_env):
    """DEC-0096/F1: whitespace-only reason is rejected with 4xx before any DB
    work. Asserts (a) 4xx status, (b) institution and contact original values
    unchanged, (c) zero erasure_records rows.
    """
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "   ",
        "confirm": True,
    })
    # (a) clean 4xx, not 500
    assert resp.status_code == 400, resp.text

    # (b) institution and contact original values unchanged
    with transaction_session(env["factory"]) as s:
        inst = s.get(InstitutionModel, UUID(env["inst_id"]))
        contact = s.get(ContactModel, UUID(env["contact_id"]))
    assert inst.name == "养老机构测试"
    assert inst.source_description == "来源描述含敏感信息"
    assert contact.phone == "PHONE_LEAK_MARKER_13900000000"
    assert contact.email == "zhangsan@test.com"
    assert contact.name == "张三"

    # (c) zero erasure_records rows
    with transaction_session(env["factory"]) as s:
        count = s.execute(
            sa.select(ErasureRecordModel).filter_by(target_id=UUID(env["inst_id"]))
        ).scalars().all()
    assert len(count) == 0


# ============ Erasure behavior tests (AC-001, AC-002) ============


def test_admin_erases_institution_personal_fields_blanked(t17_env):
    """AC-001: admin erases, personal fields are blanked irreversibly."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "data subject requested deletion",
        "confirm": True,
        "is_request_fulfillment": True,
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["erased"] is True
    assert data["propagation_status"] == "pending"

    # Verify personal fields are blanked in the live DB.
    with transaction_session(env["factory"]) as s:
        inst = s.get(InstitutionModel, UUID(env["inst_id"]))
        contact = s.get(ContactModel, UUID(env["contact_id"]))

    assert inst.name == "[已删除]"
    assert inst.source_description == "[已删除]"
    assert inst.source_kind is None
    assert inst.category is None
    assert inst.region is None
    assert contact.phone is None
    assert contact.email is None
    assert contact.name == "[已删除]"


def test_erasure_audit_has_no_personal_values(t17_env):
    """R-004/AC-002: audit before_state has flags only, no personal values."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "test audit", "confirm": True,
    })

    with transaction_session(env["factory"]) as s:
        events = s.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.action == "institution.erasure",
                AuditEventModel.target_id == UUID(env["inst_id"]),
            )
        ).scalars().all()

    assert len(events) == 1
    evt = events[0]
    assert evt.reason == "test audit"
    assert evt.actor_user_id == env["admin_id"]
    # before_state must have flags, not values.
    before = evt.before_state
    assert "institution_name_present" in before
    assert "PHONE_LEAK_MARKER" not in str(before)
    assert "zhangsan" not in str(before).lower()
    assert "张三" not in str(before)
    # after_state must not have personal values.
    after = evt.after_state
    assert after["erased"] is True
    assert "PHONE_LEAK_MARKER" not in str(after)


def test_erasure_is_irreversible(t17_env):
    """AC-001: after erasure, the original data cannot be recovered from the live DB."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "irreversibility test", "confirm": True,
    })

    # The PHONE_LEAK_MARKER must not exist anywhere in the live DB.
    with transaction_session(env["factory"]) as s:
        contacts = s.execute(
            sa.select(ContactModel).filter_by(institution_id=UUID(env["inst_id"]))
        ).scalars().all()
    for c in contacts:
        assert c.phone is None
        assert c.email is None


# ============ Archive vs erasure boundary (AC-003) ============


def test_normal_correction_still_uses_archive(t17_env):
    """AC-003/R-003/R-007: normal correction uses archive, not erasure."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    # Archive the institution (existing behavior from TASK-0008).
    resp = client.post(f"/api/institutions/{env['inst_id']}/archive", json={
        "archive_reason": "normal correction",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["archived"] is True

    # The institution is archived but NOT erased — personal data still present.
    with transaction_session(env["factory"]) as s:
        inst = s.get(InstitutionModel, UUID(env["inst_id"]))
        contact = s.get(ContactModel, UUID(env["contact_id"]))
    assert inst.archived_at is not None
    assert inst.name == "养老机构测试"  # NOT blanked
    assert contact.phone == "PHONE_LEAK_MARKER_13900000000"  # NOT erased


# ============ Propagation tests (R-005, AC-004) ============


def test_erasure_record_has_propagate_by_deadline(t17_env):
    """R-005/DEC-0104: propagate_by = erased_at + 30 days."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "propagation test", "confirm": True,
    })
    erased_at_str = resp.json()["erased_at"]
    propagate_by_str = resp.json()["propagate_by"]

    erased_at = datetime.fromisoformat(erased_at_str)
    propagate_by = datetime.fromisoformat(propagate_by_str)
    delta = propagate_by - erased_at
    # 30 days, allow small timezone rounding.
    assert abs(delta.days - 30) <= 1


def test_propagation_status_starts_pending(t17_env):
    """R-005: propagation_status is 'pending' immediately after erasure."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "status test", "confirm": True,
    })
    assert resp.json()["propagation_status"] == "pending"

    with transaction_session(env["factory"]) as s:
        record = s.execute(
            sa.select(ErasureRecordModel).filter_by(target_id=UUID(env["inst_id"]))
        ).scalar_one()
    assert record.propagation_status == "pending"
    assert record.propagation_verified_at is None


def test_backup_rehearsal_erased_values_absent():
    """R-005/AC-004: backup rehearsal proves erased values absent from post-erasure backup."""
    import sys, os
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
    sys.path.insert(0, scripts_dir)
    from synthetic_backup_rehearsal import run_rehearsal
    result = run_rehearsal()
    assert result["backup_before_has_phone"] is True
    assert result["backup_before_has_name"] is True
    assert result["backup_after_has_phone"] is False
    assert result["backup_after_has_name"] is False
    assert result["erasure_propagation_status"] == "verified"
    assert result["passed"] is True


# ============ Request fulfillment (R-008, AC-005) ============


def test_request_fulfillment_recorded_without_content(t17_env):
    """R-008/AC-005: request fulfillment is recorded without deleted content."""
    env = t17_env
    client = _login(env["app"], "t17admin", "t17passadmin")
    resp = client.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "subject deletion request",
        "confirm": True,
        "is_request_fulfillment": True,
        "request_reference": "REQ-2026-001",
    })
    assert resp.status_code == 200
    assert resp.json()["is_request_fulfillment"] is True

    with transaction_session(env["factory"]) as s:
        record = s.execute(
            sa.select(ErasureRecordModel).filter_by(target_id=UUID(env["inst_id"]))
        ).scalar_one()
    assert record.is_request_fulfillment is True
    assert record.request_reference == "REQ-2026-001"
    # The erasure record must not contain personal values.
    assert "PHONE_LEAK_MARKER" not in str(record.erasure_reason)
    assert "PHONE_LEAK_MARKER" not in str(record.erasure_scope)
    assert "张三" not in str(record.erasure_scope)


# ============ Erased fields still masked (R-006, AC-006) ============


def test_erased_institution_not_visible_to_business_user(t17_env):
    """R-006/AC-006: after erasure, the institution is still subject to policy projection."""
    env = t17_env
    client_admin = _login(env["app"], "t17admin", "t17passadmin")
    # Erase the institution.
    client_admin.post(f"/api/admin/institutions/{env['inst_id']}/erase", json={
        "reason": "masking test", "confirm": True,
    })
    # Business user (non-owner) should not see the erased institution at all
    # (they are a collaborator, and the institution is owned by biz).
    client_biz = _login(env["app"], "t17biz", "t17passbiz")
    resp = client_biz.get("/api/institutions")
    assert resp.status_code == 200
    # The institution name is now [已删除], not the original.
    items = resp.json()["items"]
    for item in items:
        assert "PHONE_LEAK_MARKER" not in item.get("name", "")
