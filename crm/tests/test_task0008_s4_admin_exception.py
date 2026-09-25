"""TASK-0008 S4 / SPEC-0002 v0.4.0 R-008: administrator global full read.

Local-only, synthetic state; reuses the S5 in-memory environment pattern
(memory repositories + central policy projection + in-memory auth).

Covered (R-008 replaces the old audited exception-read model of 0.7.0 R-015):
- an administrator reads full detail WITHOUT a reason (no denial), and no
  exception audit event is written for a reasonless read;
- a voluntarily supplied reason still produces an ``admin.exception_read``
  audit event (optional trace, never required);
- a non-administrator supplying a reason is never escalated (the policy only
  opens the full-detail branch for ADMINISTRATOR);
- the list path behaves identically: the administrator sees every record,
  with an optional trace per record when a reason is supplied;
- the page detail path behaves identically to the JSON API (R-030).
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s4_test")
os.environ.setdefault("DATABASE_USER", "s4_test")
os.environ.setdefault("DATABASE_PASSWORD", "s4-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s4-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from test_s5_pages_api_parity import (  # noqa: E402
    MemoryActivityRepository,
    MemoryContactRepository,
    MemoryInstitutionRepository,
)
from test_task0007_inmemory_fakes import (  # noqa: E402
    InMemoryAuditRepository,
    InMemoryRoleGrantRepository,
    InMemorySessionRepository,
    InMemoryUserRepository,
)

from crm.application.queries import QueryService  # noqa: E402
from crm.domain.models import Role, UserIdentity, UserStatus  # noqa: E402
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


@pytest.fixture
def s4_env():
    """App with in-memory auth + memory business repos, three identities:
    an administrator-only user, a record owner, and another business user."""
    from crm.web.main import app

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    audit_repo = InMemoryAuditRepository()
    role_repo = InMemoryRoleGrantRepository()

    inst_repo = MemoryInstitutionRepository()
    contact_repo = MemoryContactRepository()
    activity_repo = MemoryActivityRepository()

    auth_service = AuthenticationService(
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=5,
            csrf_token_lifetime_hours=1,
        ),
    )
    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    admin_only = UserIdentity(
        username="s4admin",
        display_name="S4 Admin Only",
        password_hash=hash_password("s4adminpass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(admin_only)
    role_repo.set_grants(admin_only.id, [Role.ADMINISTRATOR])

    owner = UserIdentity(
        username="s4owner",
        display_name="S4 Owner",
        password_hash=hash_password("s4ownerpass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(owner)
    role_repo.set_grants(owner.id, [Role.BUSINESS_USER])

    other = UserIdentity(
        username="s4other",
        display_name="S4 Other",
        password_hash=hash_password("s4otherpass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(other)
    role_repo.set_grants(other.id, [Role.BUSINESS_USER])

    app.state.user_repository = user_repo
    app.state.session_repository = session_repo
    app.state.audit_repository = audit_repo
    app.state.role_grant_repository = role_repo
    app.state.auth_service = auth_service
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service

    def _login(username, password):
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"username": username, "password": password})
        assert resp.status_code == 200, resp.text
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        return client

    owner_client = _login("s4owner", "s4ownerpass123")
    inst = owner_client.post(
        "/api/institutions",
        json={
            "name": "S4 管理员例外机构",
            "source_description": "S4 敏感来源描述",
            "source_kind": "manual",
            "idempotency_key": "s4-inst",
        },
    )
    assert inst.status_code == 201, inst.text
    inst_id = inst.json()["id"]
    contact = owner_client.post(
        f"/api/institutions/{inst_id}/contacts",
        json={
            "name": "S4 敏感联系人",
            "role_label": "院长",
            "phone": "13800000000",
            "contactability_status": "available",
            "idempotency_key": "s4-contact",
        },
    )
    assert contact.status_code == 201, contact.text
    activity = owner_client.post(
        f"/api/institutions/{inst_id}/activities",
        json={
            "occurred_at": datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc).isoformat(),
            "interaction_method": "电话",
            "factual_body": "S4 敏感跟进正文",
            "idempotency_key": "s4-activity",
        },
    )
    assert activity.status_code == 201, activity.text

    yield {
        "audit_repo": audit_repo,
        "inst_id": inst_id,
        "admin_id": admin_only.id,
        "owner_id": owner.id,
        "other_id": other.id,
        "admin_client": _login("s4admin", "s4adminpass123"),
        "owner_client": owner_client,
        "other_client": _login("s4other", "s4otherpass123"),
    }


def _exception_events(audit_repo):
    return [e for e in audit_repo.events if e["action"] == "admin.exception_read"]


# ============ Detail path ============


def test_admin_without_reason_detail_full_view_no_audit(s4_env) -> None:
    """R-008: an administrator reads full detail WITHOUT a reason; no
    exception audit event is written for the reasonless read."""
    client = s4_env["admin_client"]
    inst_id = s4_env["inst_id"]

    resp = client.get(f"/api/institutions/{inst_id}")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["source_description"] == "S4 敏感来源描述"
    assert any(c.get("name") == "S4 敏感联系人" and c.get("phone") == "13800000000" for c in data["contacts"])
    assert any(a.get("factual_body") == "S4 敏感跟进正文" for a in data["activities"])

    assert _exception_events(s4_env["audit_repo"]) == []


def test_admin_with_blank_reason_detail_full_view_no_audit(s4_env) -> None:
    """A blank reason is treated as omitted: full view, no audit."""
    client = s4_env["admin_client"]
    inst_id = s4_env["inst_id"]

    resp = client.get(f"/api/institutions/{inst_id}?administrator_reason=%20%20")
    assert resp.status_code == 200, resp.text
    assert resp.json()["source_description"] == "S4 敏感来源描述"
    assert _exception_events(s4_env["audit_repo"]) == []


def test_admin_with_reason_detail_full_view_and_audit(s4_env) -> None:
    """A voluntarily supplied reason still produces the optional
    ``admin.exception_read`` audit event (actor / target / time / reason)."""
    client = s4_env["admin_client"]
    inst_id = s4_env["inst_id"]
    audit_repo = s4_env["audit_repo"]

    resp = client.get(f"/api/institutions/{inst_id}?administrator_reason=投诉核查")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["source_description"] == "S4 敏感来源描述"
    assert any(c.get("name") == "S4 敏感联系人" and c.get("phone") == "13800000000" for c in data["contacts"])
    assert any(a.get("factual_body") == "S4 敏感跟进正文" for a in data["activities"])

    events = _exception_events(audit_repo)
    assert len(events) == 1
    ev = events[0]
    assert ev["outcome"] == "success"
    assert ev["actor_user_id"] == s4_env["admin_id"]
    assert ev["target_id"] == UUID(inst_id)
    assert ev["target_type"] == "institution"
    assert ev["reason"] == "投诉核查"
    assert ev["at"] is not None  # access time recorded


def test_non_admin_with_reason_is_not_escalated(s4_env) -> None:
    """A business user supplying a reason is not upgraded: the response stays
    the masked collaborator view and no exception audit is written."""
    client = s4_env["other_client"]
    inst_id = s4_env["inst_id"]

    resp = client.get(f"/api/institutions/{inst_id}?administrator_reason=越权尝试")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Collaborator projection: no protected detail.
    assert data.get("source_description") is None
    assert "S4 敏感来源描述" not in resp.text
    assert "S4 敏感联系人" not in resp.text
    assert "13800000000" not in resp.text
    assert _exception_events(s4_env["audit_repo"]) == []


def test_owner_reading_own_record_is_unaffected_by_reason(s4_env) -> None:
    """An owner reading their own record gets the owner view either way; the
    reason parameter does not change or break the normal path."""
    client = s4_env["owner_client"]
    inst_id = s4_env["inst_id"]

    normal = client.get(f"/api/institutions/{inst_id}")
    assert normal.status_code == 200
    assert normal.json()["source_description"] == "S4 敏感来源描述"

    with_reason = client.get(f"/api/institutions/{inst_id}?administrator_reason=自查")
    assert with_reason.status_code == 200
    assert with_reason.json()["source_description"] == "S4 敏感来源描述"
    # Owner read is not an exception read: no exception audit.
    assert _exception_events(s4_env["audit_repo"]) == []


# ============ List path ============


def test_admin_list_without_reason_shows_all_records_no_audit(s4_env) -> None:
    """R-008: an administrator-only subject sees every record in the list
    without a reason; no exception audit is written for the reasonless read."""
    client = s4_env["admin_client"]

    resp = client.get("/api/institutions")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "S4 管理员例外机构"
    assert _exception_events(s4_env["audit_repo"]) == []


def test_admin_list_with_reason_shows_records_and_audits_each(s4_env) -> None:
    """With a supplied reason, each returned record carries the optional
    exception trace."""
    client = s4_env["admin_client"]
    audit_repo = s4_env["audit_repo"]

    resp = client.get("/api/institutions?administrator_reason=月度检查")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "S4 管理员例外机构"

    events = _exception_events(audit_repo)
    assert len(events) == 1
    ev = events[0]
    assert ev["actor_user_id"] == s4_env["admin_id"]
    assert ev["target_id"] == UUID(s4_env["inst_id"])
    assert ev["reason"] == "月度检查"
    assert ev["outcome"] == "success"


# ============ Page path (R-030 parity) ============


def test_admin_page_detail_full_view_without_reason_and_optional_trace(s4_env) -> None:
    """The server-rendered page path behaves like the JSON API (R-030): full
    view without a reason; with a reason, the optional exception trace."""
    client = s4_env["admin_client"]
    inst_id = s4_env["inst_id"]

    # Without a reason: full view, no audit.
    full = client.get(f"/institutions/{inst_id}")
    assert full.status_code == 200, full.text
    assert "S4 敏感来源描述" in full.text
    assert "S4 敏感跟进正文" in full.text
    assert _exception_events(s4_env["audit_repo"]) == []

    with_reason = client.get(f"/institutions/{inst_id}?administrator_reason=页面核查")
    assert with_reason.status_code == 200, with_reason.text
    assert "S4 敏感来源描述" in with_reason.text
    assert "S4 敏感跟进正文" in with_reason.text

    events = _exception_events(s4_env["audit_repo"])
    assert len(events) == 1
    assert events[0]["reason"] == "页面核查"
    assert events[0]["actor_user_id"] == s4_env["admin_id"]
