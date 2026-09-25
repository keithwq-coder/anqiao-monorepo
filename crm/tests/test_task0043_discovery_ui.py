"""TASK-0043 (SPEC-0003 v0.4.0): AI opportunity discovery UI pages.

Server-rendered /discovery list + /discovery/candidates/{id} detail with the
human adjudicate form. Page content must match the API masked projection
(no extra fields); admin-only controls (trigger-run, management view) must
be absent for business_user/manager; the adjudicate form must carry a CSRF
token. Local-only, synthetic (no real provider / egress).
"""

import os
import time
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t43_test")
os.environ.setdefault("DATABASE_USER", "t43_test")
os.environ.setdefault("DATABASE_PASSWORD", "t43-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t43-test-secret-not-for-production")
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
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.domain import Role, UserIdentity, UserStatus  # noqa: E402
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


class _FakeCrawler:
    """Synthetic crawler source (real one gated by OD-006a)."""

    def __init__(self, subjects):
        self._subjects = subjects

    def list_external_subjects(self):
        return list(self._subjects)


@pytest.fixture
def t43_env():
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
    from test_s5_pages_api_parity import (
        MemoryActivityRepository,
        MemoryContactRepository,
    )

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    audit_repo = InMemoryAuditRepository()
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

    owner = _identity("t43owner", "Owner", [Role.BUSINESS_USER])
    other = _identity("t43other", "Other", [Role.BUSINESS_USER])
    gm = _identity("t43gm", "GM", [Role.MANAGER])
    admin = _identity("t43admin", "Admin", [Role.ADMINISTRATOR])

    now = datetime.now(timezone.utc)
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
        # 3 institutions in east with 2 owners -> existing_customer candidate.
        for i, oid in enumerate((owner.id, owner.id, other.id)):
            session.add(InstitutionModel(
                id=_uuid.uuid4(), name=f"T43 机构{i}", source_description="s43",
                customer_type="direct_purchase", owner_user_id=oid, in_pool=False,
                created_by_user_id=owner.id, idempotency_key=f"t43-inst-{i}",
                region="east", category="养老机构", created_at=now, updated_at=now,
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

    class _InstRepo:
        def __init__(self, f):
            self._f = f

        def find_active_for_duplicate_check(self):
            s = self._f()
            try:
                from crm.persistence.repositories import domain_institution_from_model
                return [domain_institution_from_model(m) for m in s.execute(
                    sa_select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
                ).scalars().all()]
            finally:
                s.close()

    inst_repo = _InstRepo(factory)
    query_service = QueryService(inst_repo, MemoryContactRepository(), MemoryActivityRepository())

    app.state.user_repository = user_repo
    app.state.session_repository = session_repo
    app.state.audit_repository = audit_repo
    app.state.role_grant_repository = role_repo
    app.state.auth_service = auth_service
    app.state.session_factory = factory
    app.state.institution_repository = inst_repo
    app.state.contact_repository = MemoryContactRepository()
    app.state.activity_repository = MemoryActivityRepository()
    app.state.query_service = query_service
    app.state.opportunity_crawler_source = None
    app.state.opportunity_reason_generator = None
    app.state.opportunity_crawler_reason_generator = None

    def _login(username):
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"username": username, "password": f"{username}pass123"})
        assert resp.status_code == 200, resp.text
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        return client

    yield {
        "app": app,
        "owner_id": owner.id,
        "other_id": other.id,
        "gm_id": gm.id,
        "admin_id": admin.id,
        "owner_client": _login("t43owner"),
        "other_client": _login("t43other"),
        "gm_client": _login("t43gm"),
        "admin_client": _login("t43admin"),
        "anonymous_client": TestClient(app),
    }
    engine.dispose()


def _candidates_for(client):
    resp = client.get("/api/discovery/candidates")
    assert resp.status_code == 200, resp.text
    return resp.json()["items"]


def _trigger_crawl(client, timeout: float = 30.0) -> dict:
    """Trigger an async crawl and poll until it completes (test helper)."""
    resp = client.post("/api/discovery/candidates/run")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] in ("started", "already_running"), data

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status_resp = client.get("/api/discovery/candidates/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        if not status_data["running"]:
            return status_data["last_result"] or {}
        time.sleep(0.2)
    raise TimeoutError(f"crawl did not complete within {timeout}s")


def _seed_candidates(env):
    """Run once so the fixture DB carries candidates for every actor."""
    _trigger_crawl(env["admin_client"])
    _trigger_crawl(env["owner_client"])


def test_discovery_list_200_business_user_matches_api(t43_env):
    """Authorized business_user sees /discovery 200 with exactly the API
    masked projection: every API candidate id appears on the page; page
    renders no fields beyond the API payload."""
    env = t43_env
    _seed_candidates(env)
    items = _candidates_for(env["owner_client"])
    assert items, "expected seeded candidates"

    resp = env["owner_client"].get("/discovery")
    assert resp.status_code == 200, resp.text
    body = resp.text

    # Every API candidate id is linked on the page (same data source).
    for cand in items:
        assert f"/discovery/candidates/{cand['id']}" in body
        assert cand["candidate_text"] in body
    # At least the reason excerpt (first 120 chars) is rendered.
    assert items[0]["supporting_reason"][:120] in body
    # API-internal fields are NOT rendered on the page (no extra display).
    for hidden in ("recipient_user_id", "adjudicated_by_user_id", "model_identifier"):
        assert hidden not in body


def test_discovery_detail_200_with_csrf_and_adjudicate_form(t43_env):
    """Detail page 200 for the recipient; carries the CSRF token and both
    adjudicate actions; matches the API projection."""
    env = t43_env
    _seed_candidates(env)
    items = _candidates_for(env["owner_client"])
    cand = items[0]

    resp = env["owner_client"].get(f"/discovery/candidates/{cand['id']}")
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert cand["candidate_text"] in body
    assert cand["supporting_reason"] in body
    assert 'name="csrf_token"' in body
    assert 'value="采纳"' in body
    assert 'value="忽略"' in body
    assert "/api/discovery/candidates/" in body  # form posts to the existing API


def test_adjudicate_form_path_works_via_api(t43_env):
    """The form's POST target (existing API + X-CSRF-Token header) works:
    a human decision updates the candidate status (R-003)."""
    env = t43_env
    _seed_candidates(env)
    items = _candidates_for(env["owner_client"])
    cand = next(c for c in items if c["status"] == "待处理")

    resp = env["owner_client"].post(
        f"/api/discovery/candidates/{cand['id']}/adjudicate",
        json={"decision": "忽略"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "忽略"

    refreshed = env["owner_client"].get(f"/discovery/candidates/{cand['id']}")
    assert "已忽略" in refreshed.text


def test_discovery_denied_for_manager(t43_env):
    """manager is read-only and gets no discovery view (OD-004/R-011)."""
    env = t43_env
    resp = env["gm_client"].get("/discovery")
    assert resp.status_code == 403


def test_discovery_redirects_anonymous_to_login(t43_env):
    """Unauthenticated page access redirects to /login."""
    env = t43_env
    resp = env["anonymous_client"].get("/discovery", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"] == "/login"


def test_admin_controls_present_for_admin_absent_for_business(t43_env):
    """Trigger-run control and the management view render for
    administrator only; business_user sees neither."""
    env = t43_env
    _seed_candidates(env)

    admin_body = env["admin_client"].get("/discovery").text
    assert "trigger-run-btn" in admin_body
    assert "管理视图（脱敏）" in admin_body

    owner_body = env["owner_client"].get("/discovery").text
    assert "trigger-run-btn" not in owner_body
    assert "管理视图（脱敏）" not in owner_body


def test_management_view_matches_api_desensitized_projection(t43_env):
    """Admin management view renders exactly the /api/discovery/candidates/
    management desensitized projection (id/source/status/candidate_text/
    timestamps only)."""
    env = t43_env
    _seed_candidates(env)

    mgmt = env["admin_client"].get("/api/discovery/candidates/management")
    assert mgmt.status_code == 200, mgmt.text
    api_items = mgmt.json()["items"]

    body = env["admin_client"].get("/discovery").text
    for m in api_items:
        assert m["candidate_text"] in body
    # The management view must not render supporting_reason / involved records.
    assert "supporting_reason" not in body
    assert "involved_records" not in body


def test_nav_has_discovery_and_account_settings(t43_env):
    """base.html navigation now exposes 商机 and 账号设置; business_user nav
    has no admin-only entries."""
    env = t43_env
    body = env["owner_client"].get("/dashboard").text
    assert 'href="/discovery"' in body
    assert ">商机<" in body
    assert 'href="/account/settings"' in body
    assert ">账号设置<" in body
    # Admin-only entries arrive in later tasks; must not leak yet.
    assert 'href="/admin"' not in body
    assert 'href="/imports"' not in body


def test_admin_nav_has_discovery_entry(t43_env):
    """Administrator also sees the 商机 nav entry."""
    env = t43_env
    body = env["admin_client"].get("/dashboard").text
    assert 'href="/discovery"' in body
    assert 'href="/account/settings"' in body
