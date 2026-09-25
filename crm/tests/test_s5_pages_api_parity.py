"""S5 gate: Jinja2 page + JSON API parity and the SPEC-0001 four-step flow.

Local-only, synthetic state only. In-memory repositories are injected into
``app.state`` so no database is required (real-database persistence belongs to
S6). The four-step flow per SPEC-0001 AC-001..AC-004:

1. an enabled business user creates an institution record;
2. a subordinate contact is attached and re-visible;
3. a factual follow-up activity is appended and re-visible (recorder/time);
4. reopening the record shows the complete history in deterministic order.

R-030 / AC-008: the page and JSON API paths must enforce the same field-level
visibility rules (search is not implemented in this slice; export was dropped
by DEC-0027).
"""

import os
import uuid as _uuid
from datetime import datetime, date, timezone
from typing import Optional
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

# main.py constructs Settings() at import time; provide DB env before import.
os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s5_test")
os.environ.setdefault("DATABASE_USER", "s5_test")
os.environ.setdefault("DATABASE_PASSWORD", "s5-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s5-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from crm.domain.models import (  # noqa: E402
    Contact,
    ContactabilityStatus,
    ContentAttribution,
    AiReviewStatus,
    FollowUpActivity,
    Institution,
    Role,
    UserIdentity,
    UserStatus,
    CustomerType,
)
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


# ============ In-memory business repositories (same contracts as persistence) ============


class MemoryInstitutionRepository:
    def __init__(self):
        self._by_id: dict = {}

    def find_by_id(self, institution_id):
        return self._by_id.get(institution_id)

    def find_all(self, search_terms=None, limit=50, offset=0, searchable_fields=None):
        items = sorted(self._by_id.values(), key=lambda i: i.created_at, reverse=True)
        if search_terms:
            # In-memory search matches on name only (the common visible field);
            # the real repository enforces actor-aware field filtering in SQL.
            items = [i for i in items if search_terms.lower() in i.name.lower()]
        return items[offset:offset + limit]

    def find_by_owner(self, user_id):
        return [i for i in self._by_id.values() if i.owner_user_id == user_id]

    def find_active_for_duplicate_check(self):
        """Duplicate-check candidates (R-035): all stored institutions.

        The in-memory domain objects carry no archived flag; the real
        repository filters ``archived_at IS NULL`` in SQL.
        """
        return list(self._by_id.values())

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
        inst = Institution(
            id=_uuid.uuid4(),
            name=name,
            source_description=source_description,
            customer_type=customer_type,
            owner_user_id=owner_user_id,
            custodian_user_id=custodian_user_id,
            amount=amount,
            created_by_user_id=created_by_user_id,
            idempotency_key=idempotency_key,
            category=category,
            region=region,
            source_kind=source_kind,
            source_evidence_reference=source_evidence_reference,
        )
        self._by_id[inst.id] = inst
        return inst


class MemoryContactRepository:
    def __init__(self):
        self._by_id: dict = {}
        self._by_institution: dict = {}

    def find_by_id(self, contact_id):
        return self._by_id.get(contact_id)

    def find_by_institution(self, institution_id):
        return sorted(
            self._by_institution.get(institution_id, []),
            key=lambda c: c.created_at,
        )

    def create(
        self,
        institution_id,
        created_by_user_id,
        contactability_status,
        idempotency_key,
        name=None,
        role_label=None,
        job_title=None,
        phone=None,
        email=None,
        wechat=None,
        other_channel=None,
        channel_notes=None,
    ):
        contact = Contact(
            id=_uuid.uuid4(),
            institution_id=institution_id,
            created_by_user_id=created_by_user_id,
            contactability_status=contactability_status,
            idempotency_key=idempotency_key,
            name=name,
            role_label=role_label,
            job_title=job_title,
            phone=phone,
            email=email,
            wechat=wechat,
            other_channel=other_channel,
            channel_notes=channel_notes,
        )
        self._by_id[contact.id] = contact
        self._by_institution.setdefault(institution_id, []).append(contact)
        return contact


class MemoryActivityRepository:
    def __init__(self):
        self._by_id: dict = {}
        self._by_target: dict = {}

    def find_by_id(self, activity_id):
        return self._by_id.get(activity_id)

    def find_by_target(self, target_type, target_id, include_withdrawn=False):
        if target_type != "institution":
            return []
        activities = self._by_target.get(str(target_id), [])
        # Same deterministic order as the real repository: occurred_at DESC,
        # recorded_at DESC, id DESC.
        # In-memory activities do not carry a withdrawn flag; the parameter
        # is accepted for interface compatibility with the real repository.
        return sorted(
            activities,
            key=lambda a: (a.occurred_at, a.recorded_at, str(a.id)),
            reverse=True,
        )

    def create(
        self,
        institution_id,
        recorded_by_user_id,
        occurred_at,
        interaction_method,
        factual_body,
        idempotency_key,
        participants=None,
        customer_needs=None,
        decision_participants=None,
        objections_constraints=None,
        commitments=None,
        next_action=None,
        next_action_owner_user_id=None,
        next_action_target_date=None,
        facts_to_verify=None,
        evidence_reference=None,
        shared_summary=None,
        content_attribution=ContentAttribution.SALESPERSON_INPUT,
        ai_review_status=AiReviewStatus.UNAVAILABLE,
    ):
        activity = FollowUpActivity(
            id=_uuid.uuid4(),
            institution_id=institution_id,
            recorded_by_user_id=recorded_by_user_id,
            occurred_at=occurred_at,
            interaction_method=interaction_method,
            factual_body=factual_body,
            idempotency_key=idempotency_key,
            participants=participants,
            customer_needs=customer_needs,
            decision_participants=decision_participants,
            objections_constraints=objections_constraints,
            commitments=commitments,
            next_action=next_action,
            next_action_owner_user_id=next_action_owner_user_id,
            next_action_target_date=next_action_target_date,
            facts_to_verify=facts_to_verify,
            evidence_reference=evidence_reference,
            shared_summary=shared_summary,
            content_attribution=content_attribution,
            ai_review_status=ai_review_status,
        )
        self._by_id[activity.id] = activity
        self._by_target.setdefault(str(institution_id), []).append(activity)
        return activity


# ============ Fixture: app with in-memory state ============


@pytest.fixture
def s5_env():
    """Inject in-memory repositories into app.state and return the client helpers."""
    from test_task0007_inmemory_fakes import (
        InMemoryAuditRepository,
        InMemoryRoleGrantRepository,
        InMemorySessionRepository,
        InMemoryUserRepository,
    )
    from crm.web.main import app
    from crm.application.queries import QueryService
    from crm.persistence.session_repository import PersistedSession

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

    # Seed the owner (business_user role) for the flow.
    admin = UserIdentity(
        username="s5admin",
        display_name="S5 Test Admin",
        password_hash=hash_password("s5pass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(admin)
    role_repo.set_grants(admin.id, [Role.BUSINESS_USER])

    # Seed a second business user who owns nothing: every cross-owner write
    # denial and masking assertion runs against this identity.
    other = UserIdentity(
        username="s5other",
        display_name="S5 Other User",
        password_hash=hash_password("s5other123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(other)
    role_repo.set_grants(other.id, [Role.BUSINESS_USER])

    app.state.user_repository = user_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = auth_service
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service

    client = TestClient(app)
    login = client.post("/api/auth/login", json={"username": "s5admin", "password": "s5pass123"})
    assert login.status_code == 200, login.text
    csrf = login.json()["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf

    yield {
        "client": client,
        "inst_repo": inst_repo,
        "contact_repo": contact_repo,
        "activity_repo": activity_repo,
        "admin": admin,
        "other": other,
    }


def _login_as(username, password):
    """Return a fresh TestClient logged in as the given user (CSRF set)."""
    from crm.web.main import app
    c = TestClient(app)
    resp = c.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    c.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
    return c


def _phones_in_page(page_text, client):
    """Phone numbers in rendered page content, excluding security tokens.

    The page template renders the per-session CSRF token (a random hex string
    from ``secrets.token_hex``) into a ``<script>`` block in ``base.html``.
    ~2% of such tokens contain a digit run that matches the phone regex
    ``1[3-9]\\d{9}``, producing a false "phone leak" that is unrelated to the
    business masking under test. The token is known (it is sent back on every
    request via the ``X-CSRF-Token`` header), so it is stripped before scanning
    so the assertion checks rendered business content only.
    """
    import re
    csrf_token = client.headers.get("X-CSRF-Token", "")
    scanned = page_text.replace(csrf_token, "") if csrf_token else page_text
    return set(re.findall(r"1[3-9]\d{9}", scanned))


def _create_institution(client, name="测试机构 - S5"):
    resp = client.post(
        "/api/institutions",
        json={
            "name": name,
            "source_description": "S5 合成来源说明",
            "category": "养老服务",
            "region": "苏州市",
            "source_kind": "manual",
            "idempotency_key": f"s5-inst-{_uuid.uuid4().hex[:8]}",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_contact(client, inst_id, name="张三", phone="13800000000"):
    resp = client.post(
        f"/api/institutions/{inst_id}/contacts",
        json={
            "name": name,
            "role_label": "院长",
            "phone": phone,
            "contactability_status": "available",
            "idempotency_key": f"s5-contact-{_uuid.uuid4().hex[:8]}",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_activity(client, inst_id, occurred_at, body, shared_summary=None):
    resp = client.post(
        f"/api/institutions/{inst_id}/activities",
        json={
            "occurred_at": occurred_at.isoformat(),
            "interaction_method": "电话",
            "factual_body": body,
            "shared_summary": shared_summary,
            "idempotency_key": f"s5-act-{_uuid.uuid4().hex[:8]}",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ============ S5 tests ============


def test_four_step_flow_reopens_complete_history(s5_env):
    """SPEC-0001 AC-001..AC-004: create -> contact -> activities -> reopen."""
    client = s5_env["client"]

    # Step 1: create institution, reopen via list page
    inst = _create_institution(client)
    list_page = client.get("/institutions")
    assert list_page.status_code == 200
    assert inst["name"] in list_page.text

    # Step 2: attach a contact, re-visible on the detail page
    contact = _add_contact(client, inst["id"])
    detail = client.get(f"/institutions/{inst['id']}")
    assert detail.status_code == 200
    assert contact["name"] in detail.text

    # Step 3: append two follow-up activities at known times
    a1 = _add_activity(
        client, inst["id"],
        datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc),
        "第一次跟进：确认合作意向", "首次电话沟通，确认意向",
    )
    a2 = _add_activity(
        client, inst["id"],
        datetime(2026, 8, 2, 14, 30, tzinfo=timezone.utc),
        "第二次跟进：提交方案", "已提交服务方案",
    )

    # Step 4: reopen the record — full history present in deterministic order
    detail = client.get(f"/institutions/{inst['id']}")
    assert detail.status_code == 200
    assert "确认合作意向" in detail.text
    assert "提交方案" in detail.text
    # Newest activity appears before the older one on the page
    assert detail.text.index("提交方案") < detail.text.index("确认合作意向")
    assert str(a1["id"]) in detail.text or a1["shared_summary"] in detail.text


def test_page_api_parity_same_policy_fields(s5_env):
    """R-030 / AC-008: page and API expose the same policy-projected fields."""
    client = s5_env["client"]
    inst = _create_institution(client, name="一致性机构")
    _add_contact(client, inst["id"], name="李四", phone="13900000000")
    _add_activity(client, inst["id"], datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc), "跟进正文-一致性")

    api = client.get(f"/api/institutions/{inst['id']}")
    assert api.status_code == 200
    api_data = api.json()

    page = client.get(f"/institutions/{inst['id']}")
    assert page.status_code == 200

    # Core record fields visible on both paths
    for field in ("name", "category", "region", "source_description"):
        assert str(api_data.get(field)) in page.text, f"page missing {field}"

    # The attached contact is visible on both paths
    assert "李四" in page.text
    assert any(c.get("name") == "李四" for c in api_data["contacts"])

    # Activity content is visible on the page (read-back preserves detail)
    assert "跟进正文-一致性" in page.text

    # Bidirectional parity, live checks only:
    #  - page -> API: every PHONE NUMBER rendered on the page must appear in the
    #    API payload (this is the leak direction DEC-0072 point 6 named; activity
    #    bodies are not checked in this direction because the page renders the
    #    same detail.activities objects the API serializes).
    #  - API -> page: every API activity body must appear on the page.
    phones_on_page = _phones_in_page(page.text, client)
    phones_in_api = {c.get("phone") for c in api_data.get("contacts", []) if c.get("phone")}
    assert phones_on_page <= phones_in_api, f"page leaks phones not in API: {phones_on_page - phones_in_api}"

    api_bodies = {
        a.get("factual_body") for a in api_data.get("activities", []) if a.get("factual_body")
    }
    for body in api_bodies:
        assert body in page.text, f"page missing API activity body: {body}"


def test_detail_history_order_matches_policy(s5_env):
    """History order on the page equals the policy projection order (deterministic)."""
    client = s5_env["client"]
    inst = _create_institution(client, name="顺序机构")

    times = [
        datetime(2026, 7, 30, 8, 0, tzinfo=timezone.utc),
        datetime(2026, 7, 31, 8, 0, tzinfo=timezone.utc),
        datetime(2026, 8, 1, 8, 0, tzinfo=timezone.utc),
    ]
    bodies = ["最早跟进", "中间跟进", "最新跟进"]
    for t, b in zip(times, bodies):
        _add_activity(client, inst["id"], t, b)

    page = client.get(f"/institutions/{inst['id']}")
    assert page.status_code == 200
    positions = [page.text.index(b) for b in bodies]
    # Policy order is occurred_at DESC: the newest activity appears first.
    assert positions[2] < positions[1] < positions[0]


def test_contact_validation_requires_name_or_role(s5_env):
    """SPEC-0001 R-026: a contact needs a name or an identifiable role."""
    client = s5_env["client"]
    inst = _create_institution(client)
    resp = client.post(
        f"/api/institutions/{inst['id']}/contacts",
        json={
            "contactability_status": "not_provided_or_not_storable",
            "idempotency_key": f"s5-c-{_uuid.uuid4().hex[:8]}",
        },
    )
    assert resp.status_code == 400
    assert "name or identifiable role" in resp.json()["detail"]


def test_activity_blank_body_rejected_at_transport_layer(s5_env):
    """A blank factual body is rejected by the transport layer (pydantic
    min_length=1 -> 422) before the command runs; the command-layer R-027 rule
    is the same requirement one level deeper."""
    client = s5_env["client"]
    inst = _create_institution(client)
    resp = client.post(
        f"/api/institutions/{inst['id']}/activities",
        json={
            "occurred_at": datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc).isoformat(),
            "interaction_method": "电话",
            "factual_body": "",
            "idempotency_key": f"s5-a-{_uuid.uuid4().hex[:8]}",
        },
    )
    # The transport layer (pydantic min_length=1) rejects a blank body with 422;
    # the command-layer validation (R-027) is the same rule one level deeper.
    assert resp.status_code == 422


def test_followup_readback_preserves_detail(s5_env):
    """The repository read-back must not drop the factual body / detail fields."""
    client = s5_env["client"]
    inst = _create_institution(client)
    created = _add_activity(
        client, inst["id"],
        datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc),
        "正文应被完整读回",
        shared_summary="共享摘要应保留",
    )
    assert created["factual_body"] == "正文应被完整读回"
    assert created["shared_summary"] == "共享摘要应保留"

    # read back through the repository (page path uses it)
    detail = client.get(f"/institutions/{inst['id']}")
    assert "正文应被完整读回" in detail.text


# ============ Cross-owner authorization (P0: default deny) ============


def test_non_owner_contact_write_denied(s5_env):
    """A non-owner business user cannot write a contact onto another's
    institution: default deny, 404 (no existence leakage, card line 338)."""
    client = s5_env["client"]
    inst = _create_institution(client)  # owned by s5admin
    other = _login_as("s5other", "s5other123")

    resp = other.post(
        f"/api/institutions/{inst['id']}/contacts",
        json={
            "name": "跨主写入者",
            "contactability_status": "not_provided_or_not_storable",
            "idempotency_key": f"s5-x-{_uuid.uuid4().hex[:8]}",
        },
    )
    assert resp.status_code == 404, resp.text
    # the write must not have landed
    assert len(s5_env["contact_repo"].find_by_institution(UUID(inst["id"]))) == 0


def test_non_owner_activity_write_denied(s5_env):
    """A non-owner business user cannot append a follow-up onto another's
    institution: default deny, 404."""
    client = s5_env["client"]
    inst = _create_institution(client)
    other = _login_as("s5other", "s5other123")

    resp = other.post(
        f"/api/institutions/{inst['id']}/activities",
        json={
            "occurred_at": datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc).isoformat(),
            "interaction_method": "电话",
            "factual_body": "跨主跟进",
            "idempotency_key": f"s5-xa-{_uuid.uuid4().hex[:8]}",
        },
    )
    assert resp.status_code == 404, resp.text
    assert len(s5_env["activity_repo"].find_by_target("institution", str(inst["id"]))) == 0


def test_non_owner_page_and_api_masked_identically(s5_env):
    """AC-008: a non-owner business user gets only the desensitized view, and
    the page and API mask identically (name masked, no channel values, no
    detailed activity body)."""
    client = s5_env["client"]
    inst = _create_institution(client, name="脱敏机构")
    _add_contact(client, inst["id"], name="王五", phone="13700000000")
    _add_activity(
        client, inst["id"],
        datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc),
        "owner 专属跟进正文",
        shared_summary="共享摘要可见",
    )

    other = _login_as("s5other", "s5other123")
    api = other.get(f"/api/institutions/{inst['id']}")
    page = other.get(f"/institutions/{inst['id']}")
    assert api.status_code == 200
    assert page.status_code == 200

    api_data = api.json()
    # collaborator projection: the contact name is masked on both paths
    assert "王五" not in page.text
    assert "王五" not in api.text
    api_contacts = api_data.get("contacts") or []
    assert api_contacts, "collaborator view must still show the masked contact"
    assert all(c.get("name_masked") == "***" for c in api_contacts)
    assert "***" in page.text

    # no storable channel values on either path
    assert "13700000000" not in page.text
    assert "13700000000" not in api.text
    assert not any(c.get("phone") for c in api_contacts)

    # no detailed activity body on either path (concise summary only)
    assert "owner 专属跟进正文" not in page.text
    assert not any(
        a.get("factual_body") for a in api_data.get("activities", [])
    ), "collaborator API view must not carry activity bodies"
    assert "暂无跟进记录" in page.text or "共享摘要可见" in page.text
    # the shared summary (R-029 concise progress content) may appear on both
    page_phones = _phones_in_page(page.text, other)
    assert page_phones == set(), f"page leaked phone numbers: {page_phones}"
