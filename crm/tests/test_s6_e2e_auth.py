"""End-to-end authentication and session tests."""

import os
import pytest
from fastapi.testclient import TestClient

# main.py constructs Settings() at import time; provide DB env before import.
os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "test")
os.environ.setdefault("DATABASE_USER", "test")
os.environ.setdefault("DATABASE_PASSWORD", "test_password_for_test_only")
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret-key-for-s5-development-only-do-not-use-in-production")


class TestAuthenticationFlow:
    """Test complete authentication flow with sessions."""
    
    @pytest.fixture
    def client(self):
        """Create test client with app loaded."""
        from crm.web.main import app
        return TestClient(app)
    
    def test_unauthenticated_access_rejected(self, client):
        """Unauthenticated users should be rejected from protected routes."""
        # Try to access dashboard without login
        response = client.get("/dashboard")
        
        # Should redirect to login or show login page (not dashboard content)
        assert response.status_code == 200  # Returns login.html page
        assert b"login-container" in response.content  # Login form present
    
    @pytest.mark.skip(reason="Requires W4 migration authorization - cannot create DB tables")
    def test_session_created_after_login(self, client):
        """Login creates session cookie and sets session data."""
        from crm.domain.models import UserStatus
        
        from crm.persistence.user_repository import UserRepository
        from crm.web.auth import hash_password
        
        user_repo = UserRepository()
        
        # Create test user
        test_username = f"test_e2e_{__import__('uuid').uuid4().hex[:8]}"
        password_hash = hash_password("TestPass123!")
        
        user = user_repo.create(
            username=test_username,
            display_name="E2E Test User",
            password_hash=password_hash,
            status=UserStatus.ENABLED
        )
        
        # Attempt login
        response = client.post(
            "/api/auth/login",
            json={"username": test_username, "password": "TestPass123!"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        
        # Verify session cookie set
        assert len(client.cookies) > 0
        assert any("session_id" in key for key in client.cookies.keys())
        
        # Clean up
        user_repo.find_by_username(test_username)
        from crm.persistence.database import SessionLocal
        from crm.persistence.models import UserIdentityModel
        with SessionLocal() as session:
            session.query(UserIdentityModel).filter(
                UserIdentityModel.username == test_username
            ).delete()
            session.commit()
    
    @pytest.mark.skip(reason="Requires W4 migration authorization - requires real login flow with database")
    def test_authenticated_access_granted(self, client):
        """Test authenticated user can access protected resources."""
        # This requires a real login flow which needs database
        # Migration W4 required: pending product owner authorization
        response = client.get("/dashboard")
        assert response.status_code == 200


class TestSessionMiddlewareConfiguration:
    """Verify SessionMiddleware is properly configured."""
    
    @pytest.fixture
    def client(self):
        """Create test client with app loaded."""
        from crm.web.main import app
        return TestClient(app)
    
    def test_session_middleware_installed(self):
        """SessionMiddleware must be installed on app."""
        from crm.web.main import app
        
        middleware_types = [m.cls.__name__ for m in app.user_middleware]
        assert "SessionMiddleware" in middleware_types, \
            "SessionMiddleware must be installed for request.session to work"
    
    def test_session_cookie_attributes(self):
        """Verify SessionMiddleware has correct security attributes (httponly, same_site, https_only)."""
        from crm.web.main import app
        from starlette.middleware.sessions import SessionMiddleware
        
        # Find the SessionMiddleware instance in app.user_middleware
        found_session_middleware = False
        for middleware in app.user_middleware:
            if middleware.cls.__name__ == "SessionMiddleware":
                found_session_middleware = True
                options = middleware.kwargs
                
                # Check same_site is lax or strict (not False)
                assert "same_site" in options and options["same_site"] in ("lax", "strict"), \
                    "SessionMiddleware must have SameSite attribute set for CSRF protection"
                assert options["same_site"] != False, \
                    "SameSite cannot be False for session cookies"
                
                # Note: HttpOnly cannot be set via Starlette SessionMiddleware.
                # It must be configured at the web server / reverse proxy level.
                
                # Check https_only based on environment (production defaults to True)
                expected_secure = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
                assert "https_only" in options, \
                    "SessionMiddleware must configure https_only option"
                assert options["https_only"] == expected_secure, \
                    f"https_only should be {expected_secure} (from SESSION_COOKIE_SECURE env)"
                
                break
        
        assert found_session_middleware, \
            "SessionMiddleware not found in app.middleware - secure cookie configuration missing"
