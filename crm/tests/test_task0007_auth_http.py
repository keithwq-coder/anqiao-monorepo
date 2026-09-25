"""TASK-0007 HTTP integration tests over the real FastAPI app.

Uses TestClient with the app's auth components swapped for in-memory fakes
(same repository contracts), proving end to end:
- login/session/logout flows with the durable service (steps 2-3)
- enforced CSRF on mutating /api/ requests, login exempt (DEC-0044)
- generic credential failure messages at the HTTP boundary (SPEC-0002 section 8)
- normalized rate limiting at the HTTP boundary
- restart survival at HTTP level: a NEW service instance over the SAME
  backend keeps the cookie session valid
- explicit per-environment session-cookie security behavior

Environment is set BEFORE importing crm.web.main so the fail-closed
Settings() at import time has values; DATABASE_* point at a non-existent
local database that these tests never touch (fakes replace all auth
persistence; the tested requests never reach business repositories).
"""

import os
from types import SimpleNamespace

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_PORT", "5432")
os.environ.setdefault("DATABASE_NAME", "task0007_http_test")
os.environ.setdefault("DATABASE_USER", "task0007_http_test")
os.environ.setdefault("DATABASE_PASSWORD", "task0007-synthetic-not-a-secret")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
# Insecure cookie allowed here only because CRM_ENVIRONMENT != production;
# TestClient talks plain http to the test server.
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")
os.environ.setdefault(
    "SESSION_SECRET_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)

import pytest
from fastapi.testclient import TestClient

from crm.domain.models import Role, UserIdentity, UserStatus
from crm.web.auth import AuthSettings, AuthenticationService, hash_password
from test_task0007_inmemory_fakes import (
    InMemoryAuditRepository,
    InMemoryRoleGrantRepository,
    InMemorySessionRepository,
    InMemoryUserRepository,
)

PASSWORD = "CorrectHorseBattery9!"
WRONG = "wrong-" + PASSWORD


def _build_user(username, status=UserStatus.ENABLED):
    return UserIdentity(
        username=username,
        display_name=f"HTTP {username}",
        password_hash=hash_password(PASSWORD),
        status=status,
    )


@pytest.fixture
def http():
    from crm.web.main import app

    user = _build_user("httpuser")
    disabled = _build_user("disableduser", status=UserStatus.DISABLED)
    user_repo = InMemoryUserRepository([user, disabled])
    session_repo = InMemorySessionRepository()
    audit_repo = InMemoryAuditRepository()
    role_repo = InMemoryRoleGrantRepository(
        {user.id: (frozenset({Role.BUSINESS_USER}), frozenset())}
    )
    auth_service = AuthenticationService(
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(),
    )

    saved = {
        name: getattr(app.state, name, None)
        for name in ("auth_service", "user_repository", "role_grant_repository")
    }
    app.state.auth_service = auth_service
    app.state.user_repository = user_repo
    app.state.role_grant_repository = role_repo
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(
                client=client,
                app=app,
                user=user,
                disabled=disabled,
                user_repo=user_repo,
                session_repo=session_repo,
                audit_repo=audit_repo,
                role_repo=role_repo,
                auth_service=auth_service,
            )
    finally:
        for name, value in saved.items():
            setattr(app.state, name, value)


def _login(client, username="httpuser", password=PASSWORD):
    return client.post("/api/auth/login", json={"username": username, "password": password})


# ============ Login / session / logout flows ============

class TestHttpAuthFlows:

    def test_login_success_returns_identity_roles_and_csrf(self, http):
        response = _login(http.client)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["user_id"] == str(http.user.id)
        assert body["username"] == "httpuser"
        assert body["roles"] == ["business_user"]
        assert body["role"] == "business_user"
        assert body["csrf_token"]
        # Session cookie was set by the middleware.
        assert "session_id" in response.cookies

    def test_session_endpoint_reports_canonical_identity(self, http):
        _login(http.client)
        response = http.client.get("/api/auth/session")
        assert response.status_code == 200
        body = response.json()
        assert body["is_authenticated"] is True
        assert body["user_id"] == str(http.user.id)
        assert body["roles"] == ["business_user"]
        assert body["csrf_token"]

    def test_session_endpoint_unauthenticated(self, http):
        response = http.client.get("/api/auth/session")
        assert response.status_code == 200
        assert response.json()["is_authenticated"] is False

    def test_logout_with_csrf_invalidates_session(self, http):
        login = _login(http.client)
        csrf = login.json()["csrf_token"]

        response = http.client.post(
            "/api/auth/logout", headers={"X-CSRF-Token": csrf}
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Server-side session is durably invalidated: even a fresh session
        # lookup is unauthenticated.
        assert http.client.get("/api/auth/session").json()["is_authenticated"] is False

    def test_wrong_password_generic_401(self, http):
        response = _login(http.client, password=WRONG)
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"

    def test_unknown_user_same_message_as_wrong_password(self, http):
        wrong_pw = _login(http.client, password=WRONG)
        unknown = _login(http.client, username="ghost", password=WRONG)
        assert wrong_pw.status_code == unknown.status_code == 401
        assert wrong_pw.json()["detail"] == unknown.json()["detail"] == "Invalid credentials"

    def test_disabled_user_gets_generic_message(self, http):
        response = _login(http.client, username="disableduser")
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"

    def test_rate_limit_locks_identifier_at_http(self, http):
        for _ in range(5):
            response = _login(http.client, password=WRONG)
            assert response.status_code == 401
            assert response.json()["detail"] == "Invalid credentials"
        response = _login(http.client, password=WRONG)
        assert response.status_code == 401
        assert "Too many failed attempts" in response.json()["detail"]

    def test_rate_limit_applies_to_unknown_users_at_http(self, http):
        for _ in range(5):
            _login(http.client, username="ghost", password=WRONG)
        response = _login(http.client, username="ghost", password=WRONG)
        assert response.status_code == 401
        assert "Too many failed attempts" in response.json()["detail"]


# ============ CSRF enforcement on write requests (DEC-0044) ============

class TestHttpCsrfEnforcement:

    def test_write_without_csrf_header_forbidden(self, http):
        _login(http.client)
        response = http.client.post("/api/institutions", json={})
        assert response.status_code == 403
        assert response.json()["detail"] == "CSRF token missing or invalid"

    def test_write_with_wrong_csrf_forbidden(self, http):
        _login(http.client)
        response = http.client.post(
            "/api/institutions",
            json={},
            headers={"X-CSRF-Token": "deadbeefdeadbeef"},
        )
        assert response.status_code == 403

    def test_csrf_denial_is_audited(self, http):
        _login(http.client)
        http.client.post("/api/institutions", json={})
        assert "CSRF_FAILED" in http.audit_repo.actions()
        event = http.audit_repo.events[-1]
        assert event["outcome"] == "denied"

    def test_logout_requires_csrf_and_keeps_session_on_denial(self, http):
        _login(http.client)
        response = http.client.post("/api/auth/logout")
        assert response.status_code == 403
        # The denied attempt did not invalidate the session.
        assert http.client.get("/api/auth/session").json()["is_authenticated"] is True

    def test_read_requests_do_not_require_csrf(self, http):
        _login(http.client)
        response = http.client.get("/api/auth/session")
        assert response.status_code == 200

    def test_unauthenticated_write_passes_csrf_and_gets_401(self, http):
        # No session: CSRF middleware defers to route auth, which denies.
        response = http.client.post("/api/institutions", json={})
        assert response.status_code == 401

    def test_login_endpoint_is_csrf_exempt(self, http):
        # Login itself is a POST without a CSRF token and must work.
        response = _login(http.client)
        assert response.status_code == 200


# ============ Restart survival at HTTP level ============

class TestHttpRestartSurvival:

    def test_session_survives_new_service_instance(self, http):
        login = _login(http.client)
        assert login.status_code == 200
        csrf = login.json()["csrf_token"]

        # Simulate a process restart: a brand-new AuthenticationService over
        # the SAME durable backend. The signed cookie stays with the client.
        restarted = AuthenticationService(
            user_repository=http.user_repo,
            session_repository=http.session_repo,
            audit_repository=http.audit_repo,
            auth_settings=AuthSettings(),
        )
        http.app.state.auth_service = restarted

        session = http.client.get("/api/auth/session")
        assert session.json()["is_authenticated"] is True
        assert session.json()["user_id"] == str(http.user.id)

        # A write request with the previously issued CSRF token still works
        # after the "restart" (logout succeeds via the new instance).
        response = http.client.post(
            "/api/auth/logout", headers={"X-CSRF-Token": csrf}
        )
        assert response.status_code == 200
        assert http.client.get("/api/auth/session").json()["is_authenticated"] is False


# ============ Explicit cookie security per environment ============

class TestCookieEnvironmentBehavior:

    def test_production_defaults_secure(self, monkeypatch):
        from crm.web.main import resolve_session_cookie_https_only

        monkeypatch.setenv("CRM_ENVIRONMENT", "production")
        monkeypatch.delenv("SESSION_COOKIE_SECURE", raising=False)
        assert resolve_session_cookie_https_only() is True

    def test_production_rejects_insecure_override(self, monkeypatch):
        from crm.web.main import resolve_session_cookie_https_only

        monkeypatch.setenv("CRM_ENVIRONMENT", "production")
        monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
        with pytest.raises(RuntimeError):
            resolve_session_cookie_https_only()

    def test_production_accepts_explicit_secure(self, monkeypatch):
        from crm.web.main import resolve_session_cookie_https_only

        monkeypatch.setenv("CRM_ENVIRONMENT", "production")
        monkeypatch.setenv("SESSION_COOKIE_SECURE", "true")
        assert resolve_session_cookie_https_only() is True

    def test_development_defaults_secure(self, monkeypatch):
        from crm.web.main import resolve_session_cookie_https_only

        monkeypatch.setenv("CRM_ENVIRONMENT", "development")
        monkeypatch.delenv("SESSION_COOKIE_SECURE", raising=False)
        assert resolve_session_cookie_https_only() is True

    def test_development_honors_insecure_override(self, monkeypatch):
        from crm.web.main import resolve_session_cookie_https_only

        monkeypatch.setenv("CRM_ENVIRONMENT", "development")
        monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
        assert resolve_session_cookie_https_only() is False

    def test_test_environment_honors_insecure_override(self, monkeypatch):
        from crm.web.main import resolve_session_cookie_https_only

        monkeypatch.setenv("CRM_ENVIRONMENT", "test")
        monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
        assert resolve_session_cookie_https_only() is False
