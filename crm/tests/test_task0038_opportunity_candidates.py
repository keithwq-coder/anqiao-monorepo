"""TASK-0038 (SPEC-0003 v0.4.0): opportunity candidates + human adjudication.

Local-only, synthetic. The AI is a synthetic stub (real provider / egress
gated by OD-006a); the crawler source is injected for the crawler path.
"""

import os
import time
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t38_test")
os.environ.setdefault("DATABASE_USER", "t38_test")
os.environ.setdefault("DATABASE_PASSWORD", "t38-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t38-test-secret-not-for-production")
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
    OpportunityCandidateModel,
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
def t38_env():
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

    owner = _identity("t38owner", "Owner", [Role.BUSINESS_USER])
    other = _identity("t38other", "Other", [Role.BUSINESS_USER])
    gm = _identity("t38gm", "GM", [Role.MANAGER])
    admin = _identity("t38admin", "Admin", [Role.ADMINISTRATOR])

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
        # 3 institutions in east/养老机构 with 2 owners -> existing_customer candidate.
        for i, oid in enumerate((owner.id, owner.id, other.id)):
            session.add(InstitutionModel(
                id=_uuid.uuid4(), name=f"T38 机构{i}", source_description="s38",
                customer_type="direct_purchase", owner_user_id=oid, in_pool=False,
                created_by_user_id=owner.id, idempotency_key=f"t38-inst-{i}",
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

    # Minimal session-backed institution repo for the pool landing.
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

    def _login(username):
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"username": username, "password": f"{username}pass123"})
        assert resp.status_code == 200, resp.text
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        return client

    yield {
        "app": app,
        "factory": factory,
        "owner_id": owner.id,
        "other_id": other.id,
        "gm_id": gm.id,
        "admin_id": admin.id,
        "owner_client": _login("t38owner"),
        "other_client": _login("t38other"),
        "gm_client": _login("t38gm"),
        "admin_client": _login("t38admin"),
    }
    engine.dispose()


def _candidates_for(env, client):
    resp = client.get("/api/discovery/candidates")
    assert resp.status_code == 200, resp.text
    return resp.json()["items"]


def _trigger_crawl(client, timeout: float = 30.0, trigger: str = "personal") -> dict:
    """Trigger an async crawl and poll until it completes (test helper).

    ``trigger``: ``personal`` or ``crawler`` (SPEC-0003 v0.5.0).
    Returns the final ``last_result`` from ``GET /candidates/status``.
    """
    resp = client.post(f"/api/discovery/candidates/run?trigger={trigger}")
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


def test_run_surfaces_existing_customer_candidate(t38_env):
    """R-005: an existing-customer AI candidate surfaces for the involved
    reporter; it is a '待处理' candidate (no auto-filing)."""
    env = t38_env
    result = _trigger_crawl(env["owner_client"])
    assert result["generated"] >= 1

    items = _candidates_for(env, env["owner_client"])
    occ = [c for c in items if c["source"] == "existing_customer"]
    assert occ, items
    cand = occ[0]
    assert cand["status"] == "待处理"
    assert cand["ai_used"] is True
    assert cand["model_identifier"] == "synthetic-stub"
    assert cand["supporting_reason"]


def test_crawler_candidate_has_30_day_retention(t38_env):
    """R-006 / OD-001: a crawler candidate carries a 30-day expiry."""
    env = t38_env
    from datetime import timedelta
    env["app"].state.opportunity_crawler_source = _FakeCrawler([
        {"name": "苏州市集中采购项目2026", "category": "直接采购", "region": "suzhou",
         "source_reference": "招投标公告#T38-001"},
    ])

    _trigger_crawl(env["admin_client"], trigger="crawler")

    items = _candidates_for(env, env["admin_client"])
    crawler = [c for c in items if c["source"] == "crawler"]
    assert crawler, items
    cand = crawler[0]
    assert cand["expires_at"] is not None
    expires = datetime.fromisoformat(cand["expires_at"])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    assert abs((expires - now) - timedelta(days=30)) < timedelta(hours=1)


def test_adjudicate_ignored(t38_env):
    """R-003: a human may ignore a candidate (AI has no final judgment)."""
    env = t38_env
    _trigger_crawl(env["owner_client"])
    items = _candidates_for(env, env["owner_client"])
    cand = next(c for c in items if c["source"] == "existing_customer")

    resp = env["owner_client"].post(
        f"/api/discovery/candidates/{cand['id']}/adjudicate",
        json={"decision": "忽略"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "忽略"

    # Re-adjudication is rejected.
    again = env["owner_client"].post(
        f"/api/discovery/candidates/{cand['id']}/adjudicate",
        json={"decision": "采纳"},
    )
    assert again.status_code == 400


def test_adjudicate_accept_crawler_lands_to_pool(t38_env):
    """R-008: adopting a crawler new subject releases it to the public pool
    (owner NULL + in_pool), so a business user can claim it."""
    env = t38_env
    env["app"].state.opportunity_crawler_source = _FakeCrawler([
        {"name": "潍坊市养老机构集采2026", "category": "直接采购", "region": "weifang",
         "source_reference": "集采公告#T38-002"},
    ])
    _trigger_crawl(env["admin_client"], trigger="crawler")
    items = _candidates_for(env, env["admin_client"])
    cand = next(c for c in items if c["source"] == "crawler")

    resp = env["admin_client"].post(
        f"/api/discovery/candidates/{cand['id']}/adjudicate",
        json={"decision": "采纳"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "采纳"
    assert resp.json()["landed_as_pool"] is True

    with transaction_session(env["factory"]) as session:
        pool = session.execute(
            sa_select(InstitutionModel).where(
                InstitutionModel.name == "潍坊市养老机构集采2026"
            )
        ).scalars().all()
    assert len(pool) == 1
    assert pool[0].owner_user_id is None
    assert pool[0].in_pool is True
    assert pool[0].customer_type == "direct_purchase"


def test_ai_never_auto_files(t38_env):
    """R-003/R-017: the AI never creates a customer on its own; a candidate
    stays '待处理' until a human adjudicates it."""
    env = t38_env
    _trigger_crawl(env["owner_client"])
    items = _candidates_for(env, env["owner_client"])
    for cand in items:
        assert cand["status"] == "待处理"


def test_leak_scan_detects_phone_and_protected_values():
    """R-013: leak_scan flags phone-shaped values and protected echoes."""
    from crm.application.opportunity import leak_scan, resembles_phone

    assert resembles_phone("联系电话 13812345678 待跟进") is True
    assert resembles_phone("这是普通文本") is False

    assert leak_scan("理由提到 13900000000 请核实", []) == ["phone-like value"]
    assert leak_scan("该机构的来源是 S3 敏感来源", ["S3 敏感来源"]) == ["protected value echo"]
    assert leak_scan("完全安全的理由", ["S3 敏感来源"]) == []


def test_leaky_ai_reason_is_suppressed_by_r13(t38_env):
    """R-013: an AI reason that echoes another owner's protected value is
    suppressed and falls back to a sanitized reason (ai_used=False)."""
    env = t38_env

    def leaky_reason(inst):
        return f"AI 判断：{inst.name} 的{inst.source_description}值得跟进"

    env["app"].state.opportunity_reason_generator = leaky_reason
    _trigger_crawl(env["owner_client"])

    items = _candidates_for(env, env["owner_client"])
    occ = [c for c in items if c["source"] == "existing_customer"]
    assert occ
    cand = occ[0]
    # The protected source_description ("s38") must not appear; ai_used=False.
    assert "s38" not in cand["supporting_reason"]
    assert cand["ai_used"] is False
    assert "值得关注" in cand["supporting_reason"]


def test_admin_desensitized_management_view(t38_env):
    """R-009: administrator sees a desensitized read-only opportunity view with
    no reasons, involved records, or external subject references; business_user
    and manager are denied."""
    env = t38_env
    _trigger_crawl(env["owner_client"])

    resp = env["admin_client"].get("/api/discovery/candidates/management")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert items

    cand = items[0]
    assert "supporting_reason" not in cand
    assert "involved_records" not in cand
    assert "external_subject" not in cand
    assert "candidate_text" in cand
    assert cand["status"]

    # A business user (not admin) is denied the management view.
    denied = env["owner_client"].get("/api/discovery/candidates/management")
    assert denied.status_code == 403
    # A manager (read-only, scoped) is also denied the management view.
    denied_mgr = env["gm_client"].get("/api/discovery/candidates/management")
    assert denied_mgr.status_code == 403