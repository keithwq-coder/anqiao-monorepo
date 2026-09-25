"""S6 local leg: no-external-call guard that runs WITHOUT a real database.

Ungated (no CRM_RUN_POSTGRESQL_TESTS requirement). Reuses the S5 in-memory
repository fixture pattern (tests/test_s5_pages_api_parity.py): in-memory
repositories are injected into ``app.state``, so the whole request path runs
locally with synthetic state only. The gated S6 test
(``test_s6_integration.py::test_no_external_network_calls``) stays untouched;
this file is the local mirror of the same guard.

Guard scope, stated honestly:

- It records ``socket.socket.connect`` and ``socket.create_connection`` calls
  made from Python during the request path, and fails on any non-loopback
  destination.
- It does NOT cover a pure DNS lookup that never reaches a connect:
  ``getaddrinfo`` appears nowhere in ``src/`` or ``tests/`` today, so that
  path is not exercised (and would not be recorded if it were).
- Connections made at the C level (e.g. libpq/psycopg database traffic) are
  not observed by Python-level socket patching; with the in-memory fixture
  no database traffic occurs at all in this test.

This is a positive check where none existed locally before, not a complete
egress proof (same limitation as the gated version).
"""

import os

# main.py constructs Settings() at import time; provide DB env before import
# (same pattern as test_s5_pages_api_parity.py).
os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s6_local_test")
os.environ.setdefault("DATABASE_USER", "s6_local_test")
os.environ.setdefault("DATABASE_PASSWORD", "s6-local-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s6-local-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import uuid as _uuid  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def s6_local_env():
    """Inject in-memory repositories into app.state and return a logged-in
    TestClient (same pattern as test_s5_pages_api_parity.s5_env)."""
    from test_s5_pages_api_parity import (
        MemoryActivityRepository,
        MemoryContactRepository,
        MemoryInstitutionRepository,
    )
    from test_task0007_inmemory_fakes import (
        InMemoryAuditRepository,
        InMemoryRoleGrantRepository,
        InMemorySessionRepository,
        InMemoryUserRepository,
    )
    from crm.application.queries import QueryService
    from crm.domain.models import Role, UserIdentity, UserStatus
    from crm.web.auth import AuthenticationService, AuthSettings, hash_password
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

    owner = UserIdentity(
        username="s6local",
        display_name="S6 Local Owner",
        password_hash=hash_password("s6localpass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(owner)
    role_repo.set_grants(owner.id, [Role.BUSINESS_USER])

    app.state.user_repository = user_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = auth_service
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service

    client = TestClient(app)
    login = client.post("/api/auth/login", json={"username": "s6local", "password": "s6localpass123"})
    assert login.status_code == 200, login.text
    csrf = login.json()["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf

    return client


def test_local_request_path_opens_no_external_socket(s6_local_env):
    """The SPEC-0001 four-step flow through the real request path opens no
    socket outside loopback (local, ungated, no database).

    Guard: records every non-loopback destination seen by
    ``socket.socket.connect`` and ``socket.create_connection`` during the
    flow, restores both in a ``finally``, and fails on any record.

    Scope (honest): only Python-level ``connect``/``create_connection`` calls
    are recorded. A DNS lookup that never reaches a connect is not covered
    (``getaddrinfo`` appears nowhere in ``src/`` or ``tests/`` today), and
    C-level connections (libpq/psycopg) are not observed by Python-level
    patching. Positive check, not a complete egress proof.
    """
    import socket

    client = s6_local_env

    attempted: list[str] = []
    real_connect = socket.socket.connect
    real_create_connection = socket.create_connection

    def _loopback(address) -> bool:
        # Non-INET targets (e.g. AF_UNIX paths) are not external network.
        if not isinstance(address, tuple) or not address:
            return True
        host = str(address[0])
        return host in ("127.0.0.1", "::1", "localhost", "0.0.0.0", "")

    def recording_connect(self, address):
        if not _loopback(address):
            attempted.append(repr(address))
        return real_connect(self, address)

    def recording_create_connection(address, *args, **kwargs):
        if not _loopback(address):
            attempted.append(repr(address))
        return real_create_connection(address, *args, **kwargs)

    socket.socket.connect = recording_connect
    socket.create_connection = recording_create_connection
    try:
        # SPEC-0001 four-step flow: create institution -> contact -> activity -> reopen
        inst = client.post(
            "/api/institutions",
            json={
                "name": "S6 本地无外部调用机构",
                "source_description": "S6 本地合成来源",
                "category": "养老服务",
                "region": "苏州市",
                "source_kind": "manual",
                "idempotency_key": f"s6local-inst-{_uuid.uuid4().hex[:8]}",
            },
        )
        assert inst.status_code == 201, inst.text
        inst_id = inst.json()["id"]

        contact = client.post(
            f"/api/institutions/{inst_id}/contacts",
            json={
                "name": "赵六",
                "role_label": "院长",
                "phone": "13800000000",
                "contactability_status": "available",
                "idempotency_key": f"s6local-contact-{_uuid.uuid4().hex[:8]}",
            },
        )
        assert contact.status_code == 201, contact.text

        activity = client.post(
            f"/api/institutions/{inst_id}/activities",
            json={
                "occurred_at": "2026-08-01T09:00:00+00:00",
                "interaction_method": "电话",
                "factual_body": "S6 本地跟进正文",
                "idempotency_key": f"s6local-activity-{_uuid.uuid4().hex[:8]}",
            },
        )
        assert activity.status_code == 201, activity.text

        detail = client.get(f"/institutions/{inst_id}")
        assert detail.status_code == 200
    finally:
        socket.socket.connect = real_connect
        socket.create_connection = real_create_connection

    assert attempted == [], f"Unexpected non-loopback socket attempts: {attempted}"
