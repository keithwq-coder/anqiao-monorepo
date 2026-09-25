"""S6 Integration Tests - Simplified Version."""

import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
import os


# Set environment variables before importing anything else
os.environ["DATABASE_HOST"] = "localhost"
os.environ["DATABASE_NAME"] = "anqiao_crm"
os.environ["DATABASE_USER"] = "anqiao_crm_app"
os.environ.setdefault("DATABASE_PASSWORD", os.environ.get("DATABASE_PASSWORD", "test-only-synthetic"))


@pytest.fixture
def client():
    """Create test client."""
    from crm.web.main import app
    return TestClient(app)


class TestBasicIntegration:
    """Basic integration tests without complex dependencies."""
    
    def test_health_check(self, client):
        """Test health endpoint works."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_login_page_exists(self, client):
        """Test login page loads."""
        response = client.get("/login")
        assert response.status_code == 200
        assert "Login" in response.text or "中科安樵" in response.text
    
    def test_api_docs_available(self, client):
        """Test Swagger docs are available."""
        response = client.get("/docs")
        # Should redirect or show error (authentication not required for /docs in dev mode)
        assert response.status_code in [200, 307, 302]
