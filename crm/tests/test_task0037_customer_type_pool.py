"""TASK-0037 (SPEC-0001 v0.8.0): customer type + public pool (R-037..R-045).

Local-only, synthetic state. SQLite-backed so the pool/type commands (which
use transaction_session) run end-to-end; in-memory auth for login.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t37_test")
os.environ.setdefault("DATABASE_USER", "t37_test")
os.environ.setdefault("DATABASE_PASSWORD", "t37-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t37-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, select as sa_select  # noqa: E402
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
)

from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.repositories import domain_institution_from_model  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    AuditEventModel,
    InstitutionModel,
    InstitutionOwnerHistoryModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.domain import CustomerType, Role, UserIdentity, UserStatus  # noqa: E402
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402
from crm.application.commands import (  # noqa: E402
    ChangeCustomerTypeCommand,
    CreateInstitutionCommand,
)
from crm.application.management_commands import (  # noqa: E402
    ClaimFromPoolCommand,
    ReleaseToPoolCommand,
)


def _hash(pw):
    return hash_password(pw)


class _SqliteInstRepo:
    """Minimal session-backed institution repo for the create/pool paths."""

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
                q = q.where(InstitutionModel.name.ilike(f"%{search_terms}%"))
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

    def create(
        self,
        name,
        source_description,
        owner_user_id,
        created_by_user_id,
        idempotency_key,
        customer_type=CustomerType.DIRECT_PURCHASE,
        category=None,
        region=None,
        source_kind=None,
        source_evidence_reference=None,
        custodian_user_id=None,
        amount=None,
    ):
        now = datetime.now(timezone.utc)
        m = InstitutionModel(
            id=_uuid.uuid4(), name=name, source_description=source_description,
            customer_type=customer_type.value, owner_user_id=owner_user_id,
            custodian_user_id=custodian_user_id, amount=amount, in_pool=False,
            created_by_user_id=created_by_user_id, idempotency_key=idempotency_key,
            category=category, region=region, source_kind=source_kind,
            source_evidence_reference=source_evidence_reference,
            created_at=now, updated_at=now,
        )
        s = self._f()
        try:
            s.add(m)
            s.commit()
            s.refresh(m)
            return domain_institution_from_model(m)
        finally:
            s.close()


@pytest.fixture
def t37_env():
    """SQLite-backed app: users (owner/other/gm/admin) + one institution."""
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
    from crm.application.queries import QueryService

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    audit_repo = InMemoryAuditRepository()
    role_repo = InMemoryRoleGrantRepository()
    inst_repo = _SqliteInstRepo(factory)
    contact_repo = MemoryContactRepository()
    activity_repo = MemoryActivityRepository()
    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    def _identity(username, display, roles):
        ident = UserIdentity(
            username=username,
            display_name=display,
            password_hash=_hash(f"{username}pass123"),
            status=UserStatus.ENABLED,
        )
        user_repo.add(ident)
        role_repo.set_grants(ident.id, roles)
        return ident

    identities = {
        "owner": (Role.BUSINESS_USER,),
        "other": (Role.BUSINESS_USER,),
        "gm": (Role.MANAGER,),
        "admin": (Role.ADMINISTRATOR,),
    }
    created = {key: _identity(f"t37{key}", key, list(roles)) for key, roles in identities.items()}
    owner = created["owner"]
    other = created["other"]
    gm = created["gm"]
    admin = created["admin"]

    now = datetime.now(timezone.utc)
    inst_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        for key, ident in created.items():
            session.add(UserIdentityModel(
                id=ident.id, username=ident.username, display_name=ident.display_name,
                password_hash=ident.password_hash, status="enabled",
                session_epoch=0, created_at=now, updated_at=now,
            ))
            for role in identities[key]:
                session.add(RoleGrantModel(
                    user_id=ident.id, role=role.value,
                    scope_reference="苏州" if role is Role.MANAGER else None,
                    granted_by_user_id=admin.id, reason="test seed", granted_at=now,
                ))
        session.add(InstitutionModel(
            id=inst_id, name="T37 机构", source_description="T37 来源",
            customer_type="direct_purchase", owner_user_id=owner.id, in_pool=False,
            created_by_user_id=owner.id, idempotency_key="t37-inst",
            created_at=now, updated_at=now,
        ))

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

    yield {
        "app": app,
        "factory": factory,
        "inst_id": str(inst_id),
        "owner_id": owner.id,
        "other_id": other.id,
        "gm_id": gm.id,
        "admin_id": admin.id,
        "owner_client": _login("t37owner"),
        "other_client": _login("t37other"),
        "gm_client": _login("t37gm"),
        "admin_client": _login("t37admin"),
    }
    engine.dispose()


def _get_institution(factory, inst_id):
    with transaction_session(factory) as session:
        m = session.get(InstitutionModel, UUID(inst_id))
        return m


# ============ Customer type (R-037/R-038/R-039/R-039a) ============


def test_create_institution_with_customer_type(t37_env):
    """R-037: a customer type is stored on creation."""
    env = t37_env
    client = env["owner_client"]
    resp = client.post("/api/institutions", json={
        "name": "T37 渠道客户",
        "source_description": "T37 来源二",
        "customer_type": "channel",
        "idempotency_key": "t37-channel",
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["customer_type"] == "channel"


def test_create_institution_invalid_customer_type_rejected(t37_env):
    """R-037: an invalid customer type label is rejected with 422."""
    env = t37_env
    client = env["owner_client"]
    resp = client.post("/api/institutions", json={
        "name": "T37 非法类型",
        "source_description": "T37 来源三",
        "customer_type": "vip",
        "idempotency_key": "t37-vip",
    })
    assert resp.status_code == 422, resp.text


def test_change_customer_type_by_owner_audited(t37_env):
    """R-039a: the owner may change the type; the change is auto-traced."""
    env = t37_env
    resp = env["owner_client"].post(
        f"/api/institutions/{env['inst_id']}/customer-type",
        json={"customer_type": "channel"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["customer_type"] == "channel"

    model = _get_institution(env["factory"], env["inst_id"])
    assert model.customer_type == "channel"

    with transaction_session(env["factory"]) as session:
        events = session.execute(
            sa_select(AuditEventModel).where(
                AuditEventModel.action == "institution.customer_type_change"
            )
        ).scalars().all()
    assert len(events) == 1
    assert events[0].actor_user_id == env["owner_id"]
    assert events[0].before_state == {"customer_type": "direct_purchase"}
    assert events[0].after_state == {"customer_type": "channel"}


def test_change_customer_type_non_owner_denied(t37_env):
    """R-036/R-039a: a non-owner business user cannot change the type."""
    env = t37_env
    resp = env["other_client"].post(
        f"/api/institutions/{env['inst_id']}/customer-type",
        json={"customer_type": "individual"},
    )
    assert resp.status_code == 403, resp.text


# ============ Public pool (R-040..R-045) ============


def test_release_to_pool_by_admin(t37_env):
    """R-041: admin releases a customer to the pool; owner history + audit."""
    env = t37_env
    resp = env["admin_client"].post(
        f"/api/institutions/{env['inst_id']}/release-to-pool",
        json={"reason": "区域调整"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["released"] is True
    assert resp.json()["previous_owner_user_id"] == str(env["owner_id"])

    model = _get_institution(env["factory"], env["inst_id"])
    assert model.owner_user_id is None
    assert model.in_pool is True

    with transaction_session(env["factory"]) as session:
        hist = session.execute(
            sa_select(InstitutionOwnerHistoryModel).where(
                InstitutionOwnerHistoryModel.institution_id == UUID(env["inst_id"])
            )
        ).scalars().all()
        events = session.execute(
            sa_select(AuditEventModel).where(
                AuditEventModel.action == "institution.release_to_pool"
            )
        ).scalars().all()
    assert len(hist) == 1
    assert hist[0].previous_owner_user_id == env["owner_id"]
    assert hist[0].new_owner_user_id is None
    assert len(events) == 1


def test_release_to_pool_requires_reason(t37_env):
    """R-041: releasing to the pool requires a reason."""
    env = t37_env
    resp = env["admin_client"].post(
        f"/api/institutions/{env['inst_id']}/release-to-pool",
        json={"reason": "   "},
    )
    assert resp.status_code == 400, resp.text
    model = _get_institution(env["factory"], env["inst_id"])
    assert model.in_pool is False


def test_business_user_cannot_release_to_pool(t37_env):
    """R-041: only admin may release to the pool."""
    env = t37_env
    resp = env["owner_client"].post(
        f"/api/institutions/{env['inst_id']}/release-to-pool",
        json={"reason": "尝试"},
    )
    assert resp.status_code == 403, resp.text


def test_claim_from_pool_by_business_user(t37_env):
    """R-043: a business user claims a pool customer and becomes the owner."""
    env = t37_env
    ReleaseToPoolCommand(
        institution_id=UUID(env["inst_id"]),
        released_by_user_id=env["admin_id"],
        reason="测试进池",
    ).execute(env["factory"])

    resp = env["other_client"].post(f"/api/institutions/{env['inst_id']}/claim")
    assert resp.status_code == 200, resp.text
    assert resp.json()["claimed"] is True
    assert resp.json()["new_owner_user_id"] == str(env["other_id"])

    model = _get_institution(env["factory"], env["inst_id"])
    assert model.owner_user_id == env["other_id"]
    assert model.in_pool is False

    with transaction_session(env["factory"]) as session:
        hist = session.execute(
            sa_select(InstitutionOwnerHistoryModel).where(
                InstitutionOwnerHistoryModel.institution_id == UUID(env["inst_id"])
            )
        ).scalars().all()
        events = session.execute(
            sa_select(AuditEventModel).where(
                AuditEventModel.action == "institution.claim_from_pool"
            )
        ).scalars().all()
    assert len(hist) == 2  # release + claim
    pairs = {(h.previous_owner_user_id, h.new_owner_user_id) for h in hist}
    assert (env["owner_id"], None) in pairs   # release: prev owner -> None
    assert (None, env["other_id"]) in pairs   # claim: None -> claimant
    assert len(events) == 1


def test_claim_non_pool_customer_fails(t37_env):
    """R-043: claiming a customer that is not in the pool fails."""
    env = t37_env
    resp = env["other_client"].post(f"/api/institutions/{env['inst_id']}/claim")
    assert resp.status_code == 400, resp.text


def test_admin_and_manager_cannot_claim(t37_env):
    """R-044: admin/manager do not claim; admin uses 点名分配 (transfer)."""
    env = t37_env
    ReleaseToPoolCommand(
        institution_id=UUID(env["inst_id"]),
        released_by_user_id=env["admin_id"],
        reason="测试进池",
    ).execute(env["factory"])

    assert env["admin_client"].post(f"/api/institutions/{env['inst_id']}/claim").status_code == 403
    assert env["gm_client"].post(f"/api/institutions/{env['inst_id']}/claim").status_code == 403


def test_pool_customer_is_desensitized_for_business_roles(t37_env):
    """R-042/R-045: a pool customer is desensitized-visible to business roles
    (no channel/raw values), and no business user receives full detail."""
    env = t37_env
    ReleaseToPoolCommand(
        institution_id=UUID(env["inst_id"]),
        released_by_user_id=env["admin_id"],
        reason="测试进池",
    ).execute(env["factory"])

    from crm.application.queries import QueryService
    from crm.policy import PolicySubject, RecordSnapshot, project_record

    # Build a snapshot from the DB row and project it for a non-owner
    # business user: must be COLLABORATOR (desensitized), not denied.
    with transaction_session(env["factory"]) as session:
        model = session.get(InstitutionModel, UUID(env["inst_id"]))
        from crm.persistence.repositories import domain_institution_from_model
        inst = domain_institution_from_model(model)

    snapshot = RecordSnapshot(institution=inst, contacts=(), activities=())
    subject = PolicySubject(
        user_id=env["other_id"],
        status=UserStatus.ENABLED,
        roles=frozenset({Role.BUSINESS_USER}),
    )
    projection = project_record(subject, snapshot)
    assert projection.decision.view_level.value == "collaborator"
    assert projection.data["institution"]["in_pool"] is True
    assert projection.data["institution"]["owner_user_id"] is None
    assert projection.data["institution"]["customer_type"] == "direct_purchase"
    assert "source_description" not in projection.data["institution"]
