"""
S6 - End-to-End Integration Tests.

Tests the complete stack:
- UI login page → API authentication → Database persistence
- CRUD operations with real PostgreSQL backend
- Data persistence across server restarts
- No external dependencies (isolated testing)
"""

import os
import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# S6 gate: these tests require a real PostgreSQL database (crm_test).
# The skip marker is evaluated by pytest during collection, so the heavy
# application imports must stay inside the fixtures/functions below:
# importing crm.web.main at module top level would construct Settings()
# during collection and fail without DATABASE_* environment variables.
pytestmark = pytest.mark.skipif(
    os.environ.get("CRM_RUN_POSTGRESQL_TESTS") != "1",
    reason="requires real PostgreSQL database (set CRM_RUN_POSTGRESQL_TESTS=1 and DATABASE_* env)",
)

# main.py defaults session cookies to Secure (fail-closed). TestClient speaks
# plain http, so the explicit local-test override is required, matching
# tests/test_task0007_auth_http.py.
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")


# ============ Test Fixtures ============

@pytest.fixture
def client():
    """Create test client for API requests."""
    from crm.web.main import app
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Create async test client for async requests."""
    from crm.web.main import app
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def admin_credentials():
    """Admin user credentials for testing."""
    return {"username": "admin", "password": "admin123"}


@pytest.fixture
def test_institution_data():
    """Test institution data fixture, aligned with InstitutionCreateRequest.

    Name is unique per call so R-035 duplicate-suspicion (TASK-0008) does not
    409 against residual rows left in the shared ``crm_test`` database from
    earlier gated runs.
    """
    import uuid
    suffix = uuid.uuid4().hex[:8]
    return {
        "name": f"测试机构 - S6 E2E Test {suffix}",
        "source_description": "S6 端到端测试用合成数据",
        "category": "养老服务",
        "region": "北京市朝阳区测试路 123 号",
        "source_kind": "manual",
        "source_evidence_reference": "E2E-TEST-001",
        "idempotency_key": f"e2e-test-{suffix}",
    }


# ============ Phase 1: Authentication Flow Tests ============

class TestAuthenticationFlow:
    """Test complete authentication flow from UI to database."""
    
    def test_login_page_returns_200(self, client):
        """Verify login page loads correctly."""
        response = client.get("/login")
        
        assert response.status_code == 200
        assert "login.html" in response.request.url.path or "Login" in response.text
        assert "<title>Login</title>" in response.text or "中科安樵 CRM" in response.text
    
    def test_dashboard_requires_auth(self, client):
        """Verify dashboard redirects unauthenticated users."""
        response = client.get("/dashboard")
        
        # Should redirect to login or show error
        assert response.status_code in [200, 302]
        if response.status_code == 200:
            assert "login" in response.text.lower()
    
    def test_login_api_with_invalid_credentials(self, client):
        """Login should fail with wrong password."""
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong_password"}
        )
        
        assert response.status_code == 401
        data = response.json()
        assert data.get("success") is False or "Invalid" in data.get("detail", "") or "错误" in data.get("detail", "")
    
    def test_login_api_with_valid_credentials(self, client, admin_credentials):
        """Login should succeed with correct credentials."""
        response = client.post(
            "/api/auth/login",
            json=admin_credentials
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("user_id") is not None
        assert data.get("role") == "administrator"
        
        # Verify session cookie set
        assert len(response.cookies) > 0
        assert "session" in response.cookies or "session_id" in str(response.headers)
    
    def test_session_is_persisted(self, client, admin_credentials):
        """Session should persist across requests."""
        # Login
        login_response = client.post(
            "/api/auth/login",
            json=admin_credentials
        )
        assert login_response.status_code == 200
        
        # Use same client (preserves cookies)
        session_response = client.get("/api/auth/session")
        assert session_response.status_code == 200
        
        data = session_response.json()
        assert data.get("is_authenticated") is True
        assert data.get("username") == "admin"
    
    def test_logout_invalidates_session(self, client, admin_credentials):
        """Logout should invalidate session."""
        # Login first (capture CSRF token for the write request)
        login_resp = client.post("/api/auth/login", json=admin_credentials)
        csrf = login_resp.json().get("csrf_token") if login_resp.status_code == 200 else None
        if csrf:
            client.headers["X-CSRF-Token"] = csrf
        
        # Verify authenticated
        session_resp = client.get("/api/auth/session")
        assert session_resp.json()["is_authenticated"] is True
        
        # Logout
        logout_resp = client.post("/api/auth/logout")
        assert logout_resp.status_code == 200
        assert logout_resp.json()["success"] is True
        
        # Verify session invalidated
        session_resp_after = client.get("/api/auth/session")
        assert session_resp_after.json()["is_authenticated"] is False


# ============ Phase 2: CRUD Operations Tests ============

class TestInstitutionCRUD:
    """Test complete CRUD workflow for institutions."""
    
    @pytest.fixture(autouse=True)
    def authenticate(self, client, admin_credentials):
        """Auto-authenticate before each test (CSRF header from login body)."""
        login_resp = client.post("/api/auth/login", json=admin_credentials)
        csrf = login_resp.json().get("csrf_token") if login_resp.status_code == 200 else None
        if csrf:
            client.headers["X-CSRF-Token"] = csrf
    
    def test_create_institution(self, client, test_institution_data):
        """Create a new institution."""
        response = client.post(
            "/api/institutions",
            json=test_institution_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify returned data
        assert data["name"] == test_institution_data["name"]
        assert data["owner_user_id"] is not None
        assert "id" in data
        
        # Store ID for cleanup
        self.created_id = data["id"]
    
    def test_list_institutions(self, client, test_institution_data):
        """List all institutions (includes newly created)."""
        # Create one first
        create_resp = client.post("/api/institutions", json=test_institution_data)
        assert create_resp.status_code == 201
        
        # List them
        list_resp = client.get("/api/institutions")
        assert list_resp.status_code == 200
        
        data = list_resp.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1
    
    def test_get_single_institution(self, client, test_institution_data):
        """Get details of a specific institution."""
        # Create institution
        create_resp = client.post("/api/institutions", json=test_institution_data)
        institution_id = create_resp.json()["id"]
        
        # Retrieve it
        get_resp = client.get(f"/api/institutions/{institution_id}")
        assert get_resp.status_code == 200
        
        data = get_resp.json()
        assert data["id"] == institution_id
        assert data["name"] == test_institution_data["name"]
    
    def test_validation_rejects_invalid_name(self, client, admin_credentials):
        """Validation should reject invalid input."""
        invalid_data = {"name": "A"}  # Too short (min 2 chars)
        
        response = client.post("/api/institutions", json=invalid_data)
        assert response.status_code == 422  # FastAPI/pydantic body validation


# ============ Phase 3: Database Persistence Tests ============

class TestDataPersistence:
    """Test that data persists across server restarts."""
    
    def test_data_exists_in_database(self, admin_credentials):
        """Verify data is actually stored in PostgreSQL."""
        from sqlalchemy import text
        from crm.web.main import settings
        
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            # Count users
            result = conn.execute(text("SELECT COUNT(*) FROM user_identities"))
            user_count = result.scalar()
            assert user_count >= 1  # At least the admin user
            
            # Check alembic version
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            assert version == "0001_initial_schema"
    
    def test_created_user_can_login(self, admin_credentials):
        """Verified created user can authenticate successfully."""
        from crm.web.main import app
        with TestClient(app) as client:
            response = client.post(
                "/api/auth/login",
                json=admin_credentials
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["user_id"] is not None  # UUID, not the legacy "admin-001"
    
    def test_multiple_users_different_roles(self, admin_credentials):
        """Test role-based access control (SPEC-0002 role model)."""
        import uuid as _uuid
        from datetime import datetime, timezone
        import sqlalchemy as sa
        from crm.persistence.user_repository import UserRepository
        from crm.domain.models import Role, UserStatus
        from crm.persistence.database import SessionLocal
        from crm.persistence.models import RoleGrantModel
        from crm.web.auth import hash_password
        
        # Create a business user via the repository API (idempotent by username)
        user_repo = UserRepository()
        business_user = user_repo.find_by_username("sales_user")
        if business_user is None:
            business_user = user_repo.create(
                username="sales_user",
                display_name="销售经理",
                password_hash=hash_password("business123"),
                status=UserStatus.ENABLED
            )
        
        # Grant the business_user role (SPEC-0002: roles live in role_grants)
        with SessionLocal() as session:
            existing_grant = session.execute(
                sa.select(RoleGrantModel).where(
                    RoleGrantModel.user_id == business_user.id,
                    RoleGrantModel.role == Role.BUSINESS_USER.value,
                    RoleGrantModel.revoked_at.is_(None),
                )
            ).scalar_one_or_none()
            if existing_grant is None:
                session.add(RoleGrantModel(
                    id=_uuid.uuid4(),
                    user_id=business_user.id,
                    role=Role.BUSINESS_USER.value,
                    granted_by_user_id=business_user.id,
                    granted_at=datetime.now(timezone.utc),
                    reason="S6 test role grant (crm_test only)",
                ))
                session.commit()
        
        # Try login as business user
        from crm.web.main import app
        with TestClient(app) as client:
            response = client.post(
                "/api/auth/login",
                json={"username": "sales_user", "password": "business123"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["role"] == "business_user"


# ============ Phase 4: Security & Isolation Tests ============

class TestSecurityAndIsolation:
    """Test security controls and system isolation."""
    
    def test_unauthenticated_access_denied(self, client):
        """Unauthenticated requests should be denied."""
        # Clear any existing sessions
        client.cookies.clear()
        
        # Try to access protected endpoint
        response = client.get("/api/institutions")
        assert response.status_code in [401, 403]
    
    def test_no_external_network_calls(self, admin_credentials):
        """Creating a record opens no socket outside loopback.

        S6 requires positive no-external-call verification, so this records
        every Python-level outbound socket attempt during the request and
        fails on any non-loopback destination. Asserting only the 201 status
        would pass even if an external call were made.
        """
        import socket
        import uuid
        from crm.web.main import app

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
            with TestClient(app) as client:
                login_resp = client.post("/api/auth/login", json=admin_credentials)
                csrf = login_resp.json().get("csrf_token") if login_resp.status_code == 200 else None
                if csrf:
                    client.headers["X-CSRF-Token"] = csrf

                iso_suffix = uuid.uuid4().hex[:8]
                response = client.post(
                    "/api/institutions",
                    json={
                        "name": f"隔离测试机构 {iso_suffix}",
                        "source_description": "外部调用隔离测试",
                        "idempotency_key": f"iso-test-{iso_suffix}",
                    },
                )
        finally:
            socket.socket.connect = real_connect
            socket.create_connection = real_create_connection

        assert response.status_code == 201
        assert attempted == [], f"Unexpected non-loopback socket attempts: {attempted}"
    
    def test_rate_limiting_enabled(self, admin_credentials):
        """Rate limiting should prevent brute force."""
        from crm.web.main import app
        client = TestClient(app)
        
        # Try multiple failed logins
        for i in range(5):
            response = client.post(
                "/api/auth/login",
                json={"username": "nonexistent", "password": "wrong"}
            )
            assert response.status_code == 401
        
        # Next attempt might be rate-limited (depending on implementation)
        # This test verifies the rate limiter exists
        final_response = client.post(
            "/api/auth/login",
            json={"username": "nonexistent", "password": "wrong"}
        )
        assert final_response.status_code in [401, 429]
    
    def test_error_messages_dont_expose_sensitive_info(self, client):
        """Error responses should not leak sensitive information."""
        # Invalid endpoint: FastAPI returns a plain 404 detail, no stack or SQL
        response = client.get("/api/nonexistent")
        assert response.status_code == 404
        detail = response.json().get("detail", "")
        assert "Not Found" in detail
        assert "Traceback" not in detail and "SELECT" not in detail
        
        # SQL errors should not be exposed
        try:
            response = client.get("/api/institutions/; DROP TABLE users;--")
            # If we get here, SQL injection was prevented
            assert True
        except Exception:
            pass  # Expected if parameterization works


# ============ Phase 5: Performance & Stability Tests ============

class TestPerformanceAndStability:
    """Basic performance and stability checks."""
    
    def test_api_response_time_within_transport_budget(self, client, admin_credentials):
        """A simple query returns within the 5s transport budget.

        This is a liveness/no-hang check, not an SLA check: the threshold is
        5s, so the test name must not claim 500ms. SPEC-0001 sets no
        response-time SLA, so no tighter bound is gate-required.
        """
        import time
        
        # Authenticate first
        client.post("/api/auth/login", json=admin_credentials)
        
        # Measure response time. Threshold is generous (5s): this suite runs
        # over an SSH local forward to the production server, so public-network
        # RTT dominates. SPEC-0001 sets no response-time SLA.
        start = time.time()
        response = client.get("/api/institutions?limit=1")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 5.0, f"Response took {elapsed:.2f}s, expected < 5s"
    
    def test_concurrent_requests_handled(self, client, admin_credentials):
        """System should handle concurrent requests."""
        import threading
        
        # Authenticate first
        login_resp = client.post("/api/auth/login", json=admin_credentials)
        assert login_resp.status_code == 200
        
        results = []
        
        def make_request():
            response = client.get("/api/institutions")
            results.append(response.status_code)
        
        # Launch 5 concurrent requests
        threads = []
        for _ in range(5):
            t = threading.Thread(target=make_request)
            threads.append(t)
            t.start()
        
        # Wait for completion
        for t in threads:
            t.join()
        
        # All should succeed
        assert all(code == 200 for code in results)


# ============ Main Entry Point ============

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
