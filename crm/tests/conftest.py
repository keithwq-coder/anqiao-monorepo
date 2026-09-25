"""Pytest configuration for testing with minimal setup."""

import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Set environment variables BEFORE any imports
os.environ.setdefault('CRM_DATABASE_HOST', 'localhost')
os.environ.setdefault('CRM_DATABASE_NAME', 'test')
os.environ.setdefault('CRM_DATABASE_USER', 'test')
os.environ.setdefault('CRM_DATABASE_PASSWORD', 'test_password_for_test_only')
os.environ.setdefault('SESSION_SECRET_KEY', 'test-secret-key-for-s5-development-only-do-not-use-in-production')

# Configure database URL format (won't be used in tests anyway)
os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')


def pytest_configure(config):
    """Configure pytest markers and settings."""
    config.addinivalue_line("markers", "postgresql: mark test as requiring PostgreSQL")


# Don't run app initialization in conftest - let individual tests do it when needed
