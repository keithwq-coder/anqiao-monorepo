"""TASK-0007 durable authentication service tests.

Runs the real AuthenticationService over the in-memory repository fakes
(same contracts as the PostgreSQL repositories) and proves:
- only token hashes are persisted (task card: "Only token hashes may be persisted")
- session expiry, invalidation with reasons, and epoch capture
- restart survival: a NEW service instance over the SAME backend sees the
  sessions and invalidations created by the previous instance
- normalized, enumeration-free rate limiting (uniform for existing,
  unknown, and disabled accounts)
- generic credential failure messages (no account-state disclosure)
- fail-closed login when the durable session or audit write fails
  (SPEC-0002 section 8, R-017)
- canonical role/scope loading with deny-on-failure (R-003/R-006/R-013)
"""

import json
import time
from types import SimpleNamespace
from uuid import uuid4

import pytest

from crm.domain.models import Role, UserIdentity, UserStatus
from crm.web.auth import (
    AuthenticationService,
    AuthSettings,
    GENERIC_CREDENTIAL_FAILURE,
    hash_password,
)
from crm.web.deps import load_user_context
from crm.persistence.session_repository import hash_token
from test_task0007_inmemory_fakes import (
    InMemoryAuditRepository,
    InMemoryRoleGrantRepository,
    InMemorySessionRepository,
    InMemoryUserRepository,
)

PASSWORD = "CorrectHorseBattery9!"


def _user(username="alice", status=UserStatus.ENABLED, session_epoch=0):
    return UserIdentity(
        username=username,
        display_name=f"User {username}",
        password_hash=hash_password(PASSWORD),
        status=status,
        session_epoch=session_epoch,
    )


@pytest.fixture
def backend():
    user = _user()
    user_repo = InMemoryUserRepository([user])
    session_repo = InMemorySessionRepository()
    audit_repo = InMemoryAuditRepository()
    role_repo = InMemoryRoleGrantRepository()
    return SimpleNamespace(
        user=user,
        user_repo=user_repo,
        session_repo=session_repo,
        audit_repo=audit_repo,
        role_repo=role_repo,
    )


@pytest.fixture
def service(backend):
    return AuthenticationService(
        user_repository=backend.user_repo,
        session_repository=backend.session_repo,
        audit_repository=backend.audit_repo,
        auth_settings=AuthSettings(),
    )


def _login(service, username="alice", password=PASSWORD):
    return service.authenticate(username, password, "192.0.2.1")


# ============ Durable session persistence ============

class TestDurableSessions:

    def test_only_token_hashes_are_persisted(self, service, backend):
        """The session store must contain SHA-256 digests only."""
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id
        csrf_token = result.csrf_pair.csrf_token

        stored = backend.session_repo.stored_values()
        assert hash_token(session_id) in stored
        assert hash_token(csrf_token) in stored

        # Raw tokens must not appear anywhere in the persisted values.
        serialized = json.dumps(stored)
        assert session_id not in serialized
        assert csrf_token not in serialized
        # Digests are 64-char lowercase hex (fits String(64) columns).
        assert all(len(v) != 64 or all(c in "0123456789abcdef" for c in v)
                   for v in (hash_token(session_id), hash_token(csrf_token)))

    def test_new_service_instance_sees_existing_session(self, service, backend):
        """Restart proof: a fresh service instance over the same backend
        validates a session created by the previous instance."""
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id

        restarted = AuthenticationService(
            user_repository=backend.user_repo,
            session_repository=backend.session_repo,
            audit_repository=backend.audit_repo,
            auth_settings=AuthSettings(),
        )
        validated = restarted.validate_session(session_id)
        assert validated is not None
        assert validated.user_id == str(backend.user.id)
        assert validated.session_epoch == backend.user.session_epoch

    def test_invalidation_visible_across_instances(self, service, backend):
        """A logout performed by one instance denies validation by another."""
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id

        restarted = AuthenticationService(
            user_repository=backend.user_repo,
            session_repository=backend.session_repo,
            audit_repository=backend.audit_repo,
            auth_settings=AuthSettings(),
        )
        assert restarted.invalidate_session(session_id) is True

        assert service.validate_session(session_id) is None
        assert restarted.validate_session(session_id) is None
        assert backend.session_repo.invalidation_reason(session_id) == "logout"

    def test_expired_session_is_denied(self, backend):
        """Sessions past expires_at must not validate (R-014)."""
        short_lived = AuthenticationService(
            user_repository=backend.user_repo,
            session_repository=backend.session_repo,
            audit_repository=backend.audit_repo,
            auth_settings=AuthSettings(session_max_age_seconds=1),
        )
        success, result = _login(short_lived)
        assert success is True
        session_id = result.session.session_id

        time.sleep(1.2)
        assert short_lived.validate_session(session_id) is None

    def test_double_logout_reports_false(self, service, backend):
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id

        assert service.invalidate_session(session_id) is True
        assert service.invalidate_session(session_id) is False

    def test_unknown_session_validates_none(self, service):
        assert service.validate_session("sess_does_not_exist") is None
        assert service.validate_session("") is None


# ============ Enumeration removal and normalized rate limiting ============

class TestEnumerationResistance:

    def test_disabled_account_gets_generic_message(self, backend, service):
        disabled = _user(username="disabledbob", status=UserStatus.DISABLED)
        backend.user_repo.add(disabled)

        success, error = service.authenticate("disabledbob", PASSWORD, "192.0.2.1")
        assert success is False
        assert error == GENERIC_CREDENTIAL_FAILURE
        # The internal classification exists in the durable audit but is
        # never part of the caller-visible message.
        event = backend.audit_repo.events[-1]
        assert event["failure_summary"] == "account_not_enabled"
        assert event["outcome"] == "failure"

    def test_unknown_account_gets_same_message_as_wrong_password(self, service):
        wrong_pw = service.authenticate("alice", "nope-" + PASSWORD, "192.0.2.1")
        unknown = service.authenticate("ghost_user", "nope-" + PASSWORD, "192.0.2.1")
        assert wrong_pw[0] is False and unknown[0] is False
        assert wrong_pw[1] == unknown[1] == GENERIC_CREDENTIAL_FAILURE

    def test_rate_limit_applies_uniformly_to_unknown_accounts(self, service):
        """Unknown usernames lock out exactly like existing ones (no oracle)."""
        for _ in range(5):
            assert service.authenticate("ghost_user", "bad", "192.0.2.1")[0] is False
        success, error = service.authenticate("ghost_user", "bad", "192.0.2.1")
        assert success is False
        assert "Too many failed attempts" in error

        # Existing account behaves identically.
        for _ in range(5):
            assert service.authenticate("alice", "bad", "192.0.2.1")[0] is False
        success, error = service.authenticate("alice", "bad", "192.0.2.1")
        assert success is False
        assert "Too many failed attempts" in error

    def test_rate_limit_identifier_is_casefold_normalized(self, service):
        """ALICE and alice share one tracker (matches case-insensitive lookup)."""
        for _ in range(3):
            service.authenticate("ALICE", "bad", "192.0.2.1")
        for _ in range(2):
            service.authenticate("alice", "bad", "192.0.2.1")
        success, error = service.authenticate("Alice", "bad", "192.0.2.1")
        assert success is False
        assert "Too many failed attempts" in error

    def test_locked_identifier_does_not_lock_others(self, service):
        for _ in range(5):
            service.authenticate("alice", "bad", "192.0.2.1")
        # A different identifier is unaffected.
        success, _ = service.authenticate("ghost_user", "bad", "192.0.2.1")
        assert success is False  # credential failure, not a lock message


# ============ Fail-closed durable writes ============

class TestFailClosedWrites:

    def test_audit_write_failure_blocks_login_success(self, backend, service):
        """SPEC-0002 section 8: no login success is shown when the durable
        audit write fails."""
        backend.audit_repo.fail_writes = True
        success, error = _login(service)
        assert success is False
        assert error == GENERIC_CREDENTIAL_FAILURE
        assert "LOGIN_SUCCESS" not in backend.audit_repo.actions()

    def test_session_write_failure_blocks_login_success(self, backend, service):
        """R-017: no faked success when the session backend is unavailable."""
        backend.session_repo.fail_writes = True
        success, error = _login(service)
        assert success is False
        assert error == GENERIC_CREDENTIAL_FAILURE
        assert backend.session_repo.count() == 0

    def test_identity_lookup_failure_is_generic(self, backend, service):
        class ExplodingUserRepository:
            def find_by_username(self, username):
                raise RuntimeError("identity backend unavailable")

        service.user_repository = ExplodingUserRepository()
        success, error = _login(service)
        assert success is False
        assert error == GENERIC_CREDENTIAL_FAILURE
        event = backend.audit_repo.events[-1]
        assert event["failure_summary"] == "identity_lookup_unavailable"

    def test_session_backend_outage_denies_validation(self, service, backend):
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id

        class ExplodingSessionRepository:
            def find_active_session(self, token):
                raise RuntimeError("session backend unavailable")

        service.session_repository = ExplodingSessionRepository()
        assert service.validate_session(session_id) is None
        assert service.validate_csrf_token(session_id, "anything") is False


# ============ CSRF lifecycle ============

class TestCsrfLifecycle:

    def test_issued_token_validates(self, service, backend):
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id
        csrf_token = result.csrf_pair.csrf_token

        assert service.validate_csrf_token(session_id, csrf_token) is True
        assert service.validate_csrf_token(session_id, "wrong-token") is False

    def test_rotation_invalidates_previous_token(self, service, backend):
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id
        first = result.csrf_pair.csrf_token

        rotated = service.issue_csrf_token(session_id)
        assert rotated is not None
        assert rotated.csrf_token != first
        assert service.validate_csrf_token(session_id, rotated.csrf_token) is True
        assert service.validate_csrf_token(session_id, first) is False

    def test_issue_fails_for_unknown_or_invalidated_session(self, service, backend):
        assert service.issue_csrf_token("sess_does_not_exist") is None

        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id
        service.invalidate_session(session_id)
        assert service.issue_csrf_token(session_id) is None
        assert service.validate_csrf_token(session_id, result.csrf_pair.csrf_token) is False

    def test_validate_csrf_rejects_empty_inputs(self, service):
        assert service.validate_csrf_token("", "token") is False
        assert service.validate_csrf_token("sess_x", "") is False


# ============ Canonical identity context (roles/scopes) ============

class TestCanonicalIdentityContext:

    def test_roles_and_scopes_loaded_from_grants(self, backend):
        backend.role_repo.set_grants(
            backend.user.id,
            roles={Role.BUSINESS_USER, Role.MANAGER},
            scope_keys={"scope-abc"},
        )
        app_state = SimpleNamespace(role_grant_repository=backend.role_repo)
        context = load_user_context(app_state, backend.user)

        assert context is not None
        assert context["roles"] == ["business_user", "manager"]
        assert context["role"] == "business_user"  # first sorted role
        assert context["management_scope_keys"] == ["scope-abc"]
        assert context["id"] == str(backend.user.id)
        assert context["username"] == backend.user.username

    def test_user_without_grants_has_empty_roles(self, backend):
        app_state = SimpleNamespace(role_grant_repository=backend.role_repo)
        context = load_user_context(app_state, backend.user)
        assert context is not None
        assert context["roles"] == []
        assert context["role"] is None
        assert context["management_scope_keys"] == []

    def test_grant_backend_failure_denies(self, backend):
        backend.role_repo.fail_reads = True
        app_state = SimpleNamespace(role_grant_repository=backend.role_repo)
        assert load_user_context(app_state, backend.user) is None

    def test_missing_grant_repository_denies(self, backend):
        assert load_user_context(SimpleNamespace(), backend.user) is None


# ============ Durable audit content ============

class TestDurableAudit:

    def test_full_flow_events_and_non_leakage(self, service, backend):
        success, result = _login(service)
        assert success is True
        session_id = result.session.session_id
        csrf_token = result.csrf_pair.csrf_token

        service.authenticate("alice", "wrong", "192.0.2.1")
        service.invalidate_session(session_id)

        actions = backend.audit_repo.actions()
        assert actions[0] == "LOGIN_SUCCESS"
        assert "LOGIN_FAILED" in actions
        assert "LOGOUT" in actions

        for event in backend.audit_repo.events:
            assert event["outcome"] in ("success", "denied", "failure")
            serialized = json.dumps(event, default=str)
            assert PASSWORD not in serialized
            assert "$argon2id$" not in serialized
            assert session_id not in serialized
            assert csrf_token not in serialized

    def test_login_success_event_targets_user_identity(self, service, backend):
        success, _ = _login(service)
        assert success is True
        event = backend.audit_repo.events[-1]
        assert event["action"] == "LOGIN_SUCCESS"
        assert event["outcome"] == "success"
        assert event["actor_user_id"] == backend.user.id
        assert event["target_type"] == "user_identity"
        assert event["target_id"] == backend.user.id
