"""
S4 Authentication and Authorization Tests.

Tests for:
- User login with rate limiting
- Session management
- CSRF token protection
- Password hashing security
- Disabled account handling

Adapted for TASK-0007: AuthenticationService is now durable via injected
session/audit repositories; these tests run it over the in-memory fakes
from tests/test_task0007_inmemory_fakes.py (same repository contracts).
"""

import pytest
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, MagicMock
from uuid import uuid4

from crm.web.auth import (
    UserSession,
    CsrfTokenPair,
    LoginAttemptTracker,
    AuthenticationService,
    AuthSettings,
    hash_password,
    verify_password
)
from test_task0007_inmemory_fakes import (
    InMemorySessionRepository,
    InMemoryAuditRepository,
)


# ============ Test Fixtures ============

@pytest.fixture
def auth_settings():
    """Test authentication settings."""
    return AuthSettings(
        session_max_age_seconds=3600,
        login_rate_limit_per_hour=5,
        csrf_token_lifetime_hours=1
    )


@pytest.fixture
def mock_repositories():
    """Create mock user repository plus in-memory durable fakes."""
    user_repository = Mock()
    session_repository = InMemorySessionRepository()
    audit_repository = InMemoryAuditRepository()
    login_trackers = {}

    return Mock(
        user_repository=user_repository,
        session_repository=session_repository,
        audit_repository=audit_repository,
        login_trackers=login_trackers
    )


@pytest.fixture
def auth_service(mock_repositories, auth_settings):
    """Create authentication service instance."""
    return AuthenticationService(
        user_repository=mock_repositories.user_repository,
        session_repository=mock_repositories.session_repository,
        audit_repository=mock_repositories.audit_repository,
        auth_settings=auth_settings,
        login_trackers=mock_repositories.login_trackers
    )


def _make_enabled_user(password="SecurePass123!", session_epoch=0):
    """Mock user shaped like a domain UserIdentity for service tests."""
    from crm.domain.models import Role, UserStatus

    mock_user = Mock()
    mock_user.id = uuid4()
    mock_user.username = "testuser"
    mock_user.status = UserStatus.ENABLED
    mock_user.role = Role.BUSINESS_USER
    mock_user.session_epoch = session_epoch
    mock_user.password_hash = hash_password(password)
    return mock_user


# ============ Unit Tests: Core Security Functions ============

class TestPasswordHashing:
    """Test password hashing functionality."""

    def test_hash_generates_different_hashes(self):
        """Same password should produce different hashes each time."""
        password = "test_password_123"

        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Hashes should be different (due to random salt embedded in the encoding)
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)

    def test_different_passwords_produce_different_hashes(self):
        """Different passwords should produce different hashes."""
        hash1 = hash_password("password_one")
        hash2 = hash_password("password_two")

        assert hash1 != hash2

    def test_wrong_password_fails_verification(self):
        """Verify that wrong password fails verification."""
        password = "correct_password"
        wrong_password = "wrong_password"

        hashed = hash_password(password)

        assert verify_password(password, hashed)
        assert not verify_password(wrong_password, hashed)


# ============ Unit Tests: Session Management ============

class TestUserSession:
    """Test user session creation and validation."""

    def test_session_creation(self):
        """Verify session is created with correct properties."""
        session = UserSession.create(
            user_id="user_123",
            max_age_seconds=3600,
            ip_address="192.168.1.1"
        )

        assert session.user_id == "user_123"
        assert session.ip_address == "192.168.1.1"
        assert session.is_active is True
        assert session.session_id.startswith("sess_")

    def test_session_expiration(self):
        """Verify session expiration logic."""
        # Short-lived session for testing
        session = UserSession.create(
            user_id="user_123",
            max_age_seconds=1  # 1 second expiry
        )

        # Should not be expired initially
        assert session.is_expired() is False

        # After expiry time has passed
        import time
        time.sleep(2)

        assert session.is_expired() is True

    def test_session_with_user_agent(self):
        """Test session captures user agent."""
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

        session = UserSession.create(
            user_id="user_123",
            user_agent=user_agent
        )

        assert session.user_agent == user_agent


# ============ Unit Tests: CSRF Protection ============

class TestCsrfToken:
    """Test CSRF token generation and validation."""

    def test_csrf_token_generation(self):
        """Verify CSRF token pair is generated correctly."""
        session_id = "session_123"

        token_pair = CsrfTokenPair.generate(session_id)

        assert len(token_pair.csrf_token) > 0
        assert token_pair.session_id == session_id
        assert token_pair.is_expired() is False

    def test_csrf_token_uniqueness(self):
        """Multiple CSRF tokens should be unique."""
        tokens = [CsrfTokenPair.generate(f"session_{i}") for i in range(10)]

        token_values = [t.csrf_token for t in tokens]
        assert len(set(token_values)) == 10  # All unique

    def test_csrf_token_expiration(self):
        """CSRF token should expire after configured time."""
        # Very short lifetime for testing
        token_pair = CsrfTokenPair.generate("session_123", lifetime_hours=0)

        import time
        time.sleep(1)

        assert token_pair.is_expired() is True


# ============ Unit Tests: Rate Limiting ============

class TestLoginRateLimiting:
    """Test failed login attempt tracking and locking."""

    def test_failed_attempt_tracking(self):
        """Track failed login attempts correctly."""
        tracker = LoginAttemptTracker(identifier="user@example.com")

        # Initially no failures
        assert tracker.failed_attempts == []

        # Record failures
        tracker.record_failure("192.168.1.1")
        tracker.record_failure("192.168.1.2")

        assert len(tracker.failed_attempts) == 2

    def test_account_lockout_threshold(self):
        """Account should lock after maximum failed attempts."""
        tracker = LoginAttemptTracker(identifier="user@example.com")

        # Lock threshold is 5 failures per hour
        for i in range(5):
            tracker.record_failure("192.168.1.1")

        assert tracker.is_locked is True
        assert tracker.lock_until is not None

        # Should not allow more attempts
        allowed, message = tracker.can_attempt()
        assert allowed is False
        assert "Too many failed attempts" in message

    def test_reset_on_success(self):
        """Failed attempts should reset on successful login."""
        tracker = LoginAttemptTracker(identifier="user@example.com")

        for i in range(5):
            tracker.record_failure("192.168.1.1")

        assert tracker.is_locked is True

        # Reset on success
        tracker.reset_failures()

        assert tracker.is_locked is False
        assert tracker.failed_attempts == []

    def test_lock_expiry(self):
        """Lock should expire after lock duration."""
        tracker = LoginAttemptTracker(identifier="user@example.com")

        for i in range(5):
            tracker.record_failure("192.168.1.1")

        assert tracker.is_locked is True

        # Manually set lock time in the past
        tracker.lock_until = datetime.now(timezone.utc) - timedelta(minutes=1)

        # Should allow attempt after lock expiry
        allowed, _ = tracker.can_attempt()
        assert allowed is True
        assert tracker.is_locked is False


# ============ Integration Tests: Authentication Service ============

class TestAuthenticationService:
    """End-to-end authentication service tests over in-memory fakes."""

    def test_successful_login_creates_session(self, auth_service, mock_repositories):
        """Successful login should create session and CSRF token."""
        mock_user = _make_enabled_user()
        password = "SecurePass123!"

        mock_repositories.user_repository.find_by_username.return_value = mock_user

        # Execute login
        success, result = auth_service.authenticate("testuser", password, "192.168.1.1")

        # Verify results
        assert success is True
        assert result.session.session_id.startswith("sess_")  # Session ID returned
        assert len(result.csrf_pair.csrf_token) > 0

        # Verify session persisted (via the durable repository fake)
        assert mock_repositories.session_repository.count() == 1

        # Verify durable audit event recorded
        assert "LOGIN_SUCCESS" in mock_repositories.audit_repository.actions()

    def test_invalid_credentials_rejected(self, auth_service, mock_repositories):
        """Login with invalid credentials should fail."""
        # Non-existent user
        mock_repositories.user_repository.find_by_username.return_value = None

        success, error = auth_service.authenticate("nonexistent", "password", "192.168.1.1")

        assert success is False
        assert error == "Invalid credentials"

    def test_disabled_account_session_revoked(self, auth_service, mock_repositories):
        """Disabled account should invalidate active sessions immediately.

        Per DEC-0044: disabling an account must invalidate existing sessions.
        This test logs in successfully with ENABLED status, then disables
        the account and verifies that subsequent validate_session calls return None.
        """
        from crm.domain.models import UserStatus

        # Create a mock user who is initially ENABLED
        mock_user = _make_enabled_user()
        password = "SecurePass123!"

        # Setup: use side_effect to simulate status change after login
        def find_by_username_side_effect(username):
            return mock_user

        def find_by_id_side_effect(user_id):
            # After login + first validation succeeds, check if user still enabled
            # When test sets status to DISABLED, all subsequent calls return DISABLED
            return mock_user if mock_user.status == UserStatus.ENABLED else None

        mock_repositories.user_repository.find_by_username.side_effect = find_by_username_side_effect
        mock_repositories.user_repository.find_by_id.side_effect = find_by_id_side_effect

        # Login succeeds with ENABLED status
        success, result = auth_service.authenticate("testuser", password, "192.168.1.1")
        assert success is True, f"Login should succeed with ENABLED account, got: {result}"
        session_id = result.session.session_id
        assert session_id.startswith("sess_"), "Session ID should start with sess_"

        # Verify session is active
        validated = auth_service.validate_session(session_id)
        assert validated is not None, "Session should be valid immediately after login"
        assert validated.is_active, "Session should be active"

        # Disable the account (simulate admin action or status change)
        mock_user.status = UserStatus.DISABLED

        # Now validate_session should fail because user is DISABLED
        validated = auth_service.validate_session(session_id)

        # Account was disabled; session must be revoked
        assert validated is None, "validate_session should return None for DISABLED account"

        # Verify the invalidation was persisted with a reason
        assert mock_repositories.session_repository.is_invalidated(session_id), \
            "Session should be durably invalidated"
        assert mock_repositories.session_repository.invalidation_reason(session_id) == \
            "user_not_enabled"

    def test_session_epoch_invalidation(self, auth_service, mock_repositories):
        """session_epoch mismatch should invalidate sessions (forced logout).

        Per DEC-0044: when user.session_epoch changes (e.g., admin revokes
        all sessions), any existing session with stale epoch must be
        invalidated on next validation.
        """
        mock_user = _make_enabled_user(session_epoch=5)
        password = "SecurePass123!"

        def find_by_username_side_effect(username):
            return mock_user

        def find_by_id_side_effect(user_id):
            # Return user as-is; epoch change simulated by test modifying mock_user.session_epoch
            return mock_user

        mock_repositories.user_repository.find_by_username.side_effect = find_by_username_side_effect
        mock_repositories.user_repository.find_by_id.side_effect = find_by_id_side_effect

        # Login succeeds with session_epoch=5
        success, result = auth_service.authenticate("testuser", password, "192.168.1.1")
        assert success is True, f"Login should succeed, got: {result}"
        session_id = result.session.session_id

        # The created session captured epoch=5
        assert result.session.session_epoch == 5, \
            f"Session should capture epoch=5, got {result.session.session_epoch}"

        # First validation should succeed (epoch matches)
        validated = auth_service.validate_session(session_id)
        assert validated is not None, "First validation should succeed"

        # Simulate forced logout: admin increments user's session_epoch
        mock_user.session_epoch = 6  # Admin revokes all sessions

        # Next validation should fail due to epoch mismatch
        validated = auth_service.validate_session(session_id)
        assert validated is None, "validate_session should fail when session_epoch mismatched"

        # Invalidation persisted with the epoch-mismatch reason
        assert mock_repositories.session_repository.is_invalidated(session_id), \
            "Session should be durably invalidated on epoch mismatch"
        assert mock_repositories.session_repository.invalidation_reason(session_id) == \
            "session_epoch_mismatch"

    def test_rate_limit_blocks_attempts(self, auth_service, mock_repositories):
        """Repeated failed attempts should trigger rate limiting."""
        # User exists but incorrect password
        mock_user = _make_enabled_user()

        # Invalid password hash -> verification fails every time
        mock_user.password_hash = b"invalid_hash"

        mock_repositories.user_repository.find_by_username.return_value = mock_user

        # Try multiple wrong passwords
        for i in range(5):
            success, _ = auth_service.authenticate("testuser", "wrong_password", "192.168.1.1")
            assert success is False

        # Next attempt should be blocked by rate limit
        success, error = auth_service.authenticate("testuser", "wrong_password", "192.168.1.1")

        assert success is False
        assert "Too many failed attempts" in error or "locked" in error.lower()

    def test_valid_session_is_revalidated(self, auth_service, mock_repositories):
        """Valid session should pass validation."""
        # First login to create session
        mock_user = _make_enabled_user()
        password = "SecurePass123!"

        mock_repositories.user_repository.find_by_username.return_value = mock_user
        mock_repositories.user_repository.find_by_id.return_value = mock_user

        success, result = auth_service.authenticate("testuser", password, "192.168.1.1")
        assert success is True
        session_id = result.session.session_id

        # Revalidate session
        validated_session = auth_service.validate_session(session_id)

        assert validated_session is not None
        assert validated_session.user_id == str(mock_user.id)
        assert validated_session.is_active is True

    def test_logout_invalidates_session(self, auth_service, mock_repositories):
        """Logout should invalidate session."""
        mock_user = _make_enabled_user()
        password = "SecurePass123!"

        mock_repositories.user_repository.find_by_username.return_value = mock_user

        # Login
        success, result = auth_service.authenticate("testuser", password, "192.168.1.1")
        assert success is True
        session_id = result.session.session_id

        # Logout
        invalidated = auth_service.invalidate_session(session_id)

        assert invalidated is True
        assert mock_repositories.session_repository.is_invalidated(session_id)

        # Session should fail validation
        validated = auth_service.validate_session(session_id)
        assert validated is None


# ============ Security Audit Tests ============

class TestSecurityAuditLogging:
    """Test that security events are audited without exposing sensitive data."""

    def test_audit_does_not_expose_passwords(self, auth_service, mock_repositories):
        """Audit records must never contain plaintext passwords,
        Argon2id hashes, or raw session/CSRF token values."""
        import json

        password = "Sup3rSecretPassw0rd!"
        mock_user = _make_enabled_user(password=password)

        mock_repositories.user_repository.find_by_username.return_value = mock_user

        audit_events = mock_repositories.audit_repository.events

        # Produce real audit events: one failure, one success, one logout
        success, _ = auth_service.authenticate("testuser", "wrong_" + password, "192.168.1.1")
        assert success is False

        success, result = auth_service.authenticate("testuser", password, "192.168.1.1")
        assert success is True
        session_id = result.session.session_id
        csrf_token = result.csrf_pair.csrf_token

        assert auth_service.invalidate_session(session_id) is True

        # Failure, success and logout events must all have been recorded
        actions = [entry["action"] for entry in audit_events]
        assert "LOGIN_FAILED" in actions
        assert "LOGIN_SUCCESS" in actions
        assert "LOGOUT" in actions

        # No audit record (including extra data) may leak sensitive values
        for entry in audit_events:
            serialized = json.dumps(entry, default=str)
            assert password not in serialized
            assert "$argon2id$" not in serialized
            assert session_id not in serialized
            assert csrf_token not in serialized

    @pytest.mark.skipif(
        os.getenv("CRM_RUN_POSTGRESQL_TESTS") != "1",
        reason="requires the isolated local PostgreSQL test database",
    )
    def test_session_epoch_during_production_use(self):
        """Integration test with real repositories + DB to verify DEC-0044.

        Per DEC-0044: disabling a user or incrementing session_epoch must
        invalidate existing sessions immediately. This test:
        1. Creates a real user with UserRepository.create()
        2. Logs in -> durable session row in server_sessions
        3. Disables the account OR bumps session_epoch via real repo methods
        4. Verifies validate_session() returns None on next call and the
           invalidation is persisted in the database

        Uses the real local PostgreSQL database from environment variables.
        Requires CRM_RUN_POSTGRESQL_TESTS=1; skipped otherwise.
        """
        import sqlalchemy as sa
        from crm.persistence.database import SessionLocal
        from crm.persistence.models import UserIdentityModel, ServerSessionModel, AuditEventModel
        from crm.domain.models import UserStatus
        from uuid import uuid4

        # Setup: use real repositories and DB
        from crm.persistence.user_repository import UserRepository
        from crm.persistence.session_repository import (
            ServerSessionRepository,
            hash_token,
        )
        from crm.persistence.audit_repository import AuditEventRepository
        from crm.web.auth import AuthenticationService, AuthSettings

        user_repo = UserRepository()
        session_repo = ServerSessionRepository()
        audit_repo = AuditEventRepository()
        auth_settings = AuthSettings()

        auth_service = AuthenticationService(
            user_repository=user_repo,
            session_repository=session_repo,
            audit_repository=audit_repo,
            auth_settings=auth_settings,
        )

        test_username = f"integ_test_{uuid4().hex[:8]}"
        created_session_hashes = []

        def db_session_rows():
            with SessionLocal() as session:
                return session.execute(
                    sa.select(ServerSessionModel)
                    .where(ServerSessionModel.session_token_hash.in_(created_session_hashes))
                    .order_by(ServerSessionModel.created_at)
                ).scalars().all()

        try:
            # Step 1: Create user via real repository (not mock)
            password = "SecureTestPass123!"
            password_hash = hash_password(password)

            user = user_repo.create(
                username=test_username,
                display_name="Integration Test User",
                password_hash=password_hash,
                status=UserStatus.ENABLED
            )

            assert user is not None
            assert user.status == UserStatus.ENABLED
            initial_epoch = user.session_epoch

            # Step 2: Login -> durable session row
            success, result = auth_service.authenticate(test_username, password, "127.0.0.1")
            assert success is True, f"Login should succeed, got: {result}"
            session_id = result.session.session_id
            assert session_id.startswith("sess_")
            created_session_hashes.append(hash_token(session_id))

            # Verify session persisted as hashes only with the captured epoch
            rows = db_session_rows()
            assert len(rows) == 1
            assert rows[0].session_token_hash == hash_token(session_id)
            assert rows[0].user_session_epoch == initial_epoch
            assert rows[0].invalidated_at is None

            # Step 3a: logout invalidates the durable session
            invalidated = auth_service.invalidate_session(session_id)
            assert invalidated is True
            rows = db_session_rows()
            assert rows[0].invalidated_at is not None
            assert rows[0].invalidation_reason == "logout"

            # Re-login after logout
            success, result = auth_service.authenticate(test_username, password, "127.0.0.1")
            assert success is True
            session_id = result.session.session_id
            created_session_hashes.append(hash_token(session_id))

            # Disable the account via real repository method
            disabled = user_repo.disable_user(user.id)
            assert disabled is True

            # Next validation should fail because user is DISABLED
            validated = auth_service.validate_session(session_id)
            assert validated is None, "Session should be invalidated when account is DISABLED"
            rows = db_session_rows()
            assert rows[1].invalidated_at is not None
            assert rows[1].invalidation_reason == "user_not_enabled"

            # Step 3b: Re-enable user and test bump_session_epoch
            with SessionLocal() as session:
                model = session.get(UserIdentityModel, user.id)
                model.status = UserStatus.ENABLED.value
                model.session_epoch = model.session_epoch + 1 if model.session_epoch else 1
                session.commit()

            # Re-login
            success, result = auth_service.authenticate(test_username, password, "127.0.0.1")
            assert success is True
            session_id = result.session.session_id
            created_session_hashes.append(hash_token(session_id))

            # Bump session_epoch via real repository method (simulates admin revoking all sessions)
            bumped = user_repo.bump_session_epoch(user.id)
            assert bumped is True, "Epoch should be incremented"

            # Next validation should fail due to epoch mismatch
            validated = auth_service.validate_session(session_id)
            assert validated is None, "Session should be invalidated when session_epoch changed"
            rows = db_session_rows()
            assert rows[2].invalidated_at is not None
            assert rows[2].invalidation_reason == "session_epoch_mismatch"

        finally:
            # Cleanup: delete test sessions, audit events, and user
            with SessionLocal() as session:
                session.execute(
                    sa.delete(ServerSessionModel).where(
                        ServerSessionModel.session_token_hash.in_(created_session_hashes)
                    )
                )
                session.execute(
                    sa.delete(AuditEventModel).where(
                        AuditEventModel.actor_user_id == user.id
                    )
                )
                session.execute(
                    sa.delete(UserIdentityModel).where(
                        UserIdentityModel.username == test_username
                    )
                )
                session.commit()
