"""Authentication service for login, session management, and CSRF protection.

Implements the DEC-0044 server-side authentication behavior:
Argon2id password hashing, durable server-side sessions persisted via the
session repository (only SHA-256 token hashes are stored), CSRF token
issuance and validation, normalized per-identifier login rate limiting
applied uniformly to existing, unknown, and disabled accounts, and durable
security audit records that never store plaintext passwords, password
hashes, session ids, or CSRF token values.

Fail-closed rules (SPEC-0002 sections 7-8, R-017): credential failures all
return one generic message; identity-backend or durable session/audit write
failures never produce a login success.
"""

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash

from crm.domain.models import UserStatus, utc_now
from crm.persistence.session_repository import hash_token

# Single message for every credential failure: no account-existence or
# account-state disclosure (SPEC-0002 section 8, deny without disclosure).
GENERIC_CREDENTIAL_FAILURE = "Invalid credentials"


@dataclass(frozen=True)
class UserSession:
    """Server-side user session.

    Contains session_epoch for detecting forced logout: when a user's
    session_epoch increments (e.g., admin revokes all sessions), any
    existing session with stale epoch is invalidated.
    """

    session_id: str
    user_id: str  # UUID string
    session_epoch: int  # User's session_epoch at login time
    created_at: datetime
    expires_at: datetime
    username: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    @classmethod
    def create(
        cls,
        user_id: str,
        username: Optional[str] = None,
        max_age_seconds: int = 3600,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_epoch: int = 0,  # Capture user's current session_epoch
        **kwargs,
    ) -> "UserSession":
        """Factory method for creating a session with an auto-generated id.

        Args:
            session_epoch: The user's current session_epoch value. Must be
                captured at login time to detect forced logout via epoch mismatch.
        """
        now = utc_now()
        return cls(
            session_id=f"sess_{secrets.token_hex(16)}",
            user_id=user_id,
            session_epoch=session_epoch,
            username=username,
            created_at=now,
            expires_at=now + timedelta(seconds=max_age_seconds),
            ip_address=ip_address,
            user_agent=user_agent,
        )

    @property
    def is_active(self) -> bool:
        """True while the session has not expired."""
        return utc_now() < self.expires_at

    def is_expired(self) -> bool:
        """True once the session has reached or passed its expiry."""
        return utc_now() >= self.expires_at


@dataclass(frozen=True)
class CsrfTokenPair:
    """CSRF token bound to a session with its own lifetime."""

    csrf_token: str
    session_id: str
    created_at: datetime
    expires_at: datetime

    @classmethod
    def generate(cls, session_id: str, lifetime_hours: int = 1) -> "CsrfTokenPair":
        """Generate a fresh CSRF token for a session."""
        now = utc_now()
        return cls(
            csrf_token=secrets.token_hex(32),
            session_id=session_id,
            created_at=now,
            expires_at=now + timedelta(hours=lifetime_hours),
        )

    def is_expired(self) -> bool:
        """True once the token has reached or passed its expiry."""
        return utc_now() >= self.expires_at


@dataclass(frozen=True)
class AuthenticatedLogin:
    """Successful login payload: the new session and its CSRF token pair."""

    session: UserSession
    csrf_pair: CsrfTokenPair


@dataclass
class LoginAttemptTracker:
    """Per-identifier failed-login tracker for rate limiting."""

    identifier: str
    max_attempts: int = 5
    lock_minutes: int = 5
    failed_attempts: list = field(default_factory=list)
    lock_until: Optional[datetime] = None

    def record_failure(self, ip_address: Optional[str] = None) -> None:
        """Record a failed attempt and lock once the threshold is reached."""
        self.failed_attempts.append(
            {"at": utc_now(), "ip_address": ip_address}
        )
        if len(self.failed_attempts) >= self.max_attempts:
            self.lock_until = utc_now() + timedelta(minutes=self.lock_minutes)

    @property
    def is_locked(self) -> bool:
        """True while a lock is set and has not yet expired."""
        if self.lock_until is None:
            return False
        if utc_now() >= self.lock_until:
            # Lock window elapsed; clear it so attempts may resume.
            self.lock_until = None
            self.failed_attempts = []
            return False
        return True

    def can_attempt(self) -> tuple[bool, str]:
        """Return whether a new attempt is allowed and a human message."""
        if self.is_locked:
            return False, "Too many failed attempts. Please try again later."
        return True, ""

    def reset_failures(self) -> None:
        """Clear all failure state after a successful login."""
        self.failed_attempts = []
        self.lock_until = None


@dataclass(frozen=True)
class AuthSettings:
    """Authentication configuration settings."""

    session_max_age_seconds: int = 3600
    login_rate_limit_per_hour: int = 5
    csrf_token_lifetime_hours: int = 1


class AuthenticationService:
    """Authentication service with Argon2id password hashing.

    Durable state (sessions, CSRF token hashes, audit events) is delegated
    to the injected repositories; this service itself keeps only the
    per-process login attempt trackers.
    """

    def __init__(
        self,
        user_repository,
        session_repository,
        audit_repository,
        auth_settings: AuthSettings,
        login_trackers: Optional[dict] = None,
    ):
        self.user_repository = user_repository
        self.session_repository = session_repository
        self.audit_repository = audit_repository
        self.auth_settings = auth_settings
        self.login_trackers = login_trackers if login_trackers is not None else {}
        self.password_hasher = PasswordHasher()

    # -- audit -------------------------------------------------------------

    def _audit(
        self,
        action: str,
        *,
        outcome: str,
        user=None,
        actor_user_id=None,
        username: Optional[str] = None,
        failure_summary: Optional[str] = None,
        strict: bool = False,
    ) -> None:
        """Record a security event in the durable audit repository.

        Never stores plaintext passwords, Argon2id hashes, session ids, or
        CSRF token values. ``reason`` carries only the non-secret username;
        internal detail is a non-sensitive ``failure_summary`` classification.
        With ``strict=True`` a persistence failure propagates so callers can
        refuse to show success (SPEC-0002 section 8).
        """
        actor_id = user.id if user is not None else actor_user_id
        try:
            self.audit_repository.record(
                action=action,
                outcome=outcome,
                actor_user_id=actor_id,
                target_type="user_identity" if actor_id is not None else "server_session",
                target_id=actor_id,
                reason=username if username is not None else (user.username if user is not None else None),
                failure_summary=failure_summary,
            )
        except Exception:
            if strict:
                raise

    # -- login -------------------------------------------------------------

    def _get_tracker(self, identifier: str) -> LoginAttemptTracker:
        tracker = self.login_trackers.get(identifier)
        if tracker is None:
            tracker = LoginAttemptTracker(
                identifier=identifier,
                max_attempts=self.auth_settings.login_rate_limit_per_hour,
            )
            self.login_trackers[identifier] = tracker
        return tracker

    def authenticate(
        self, username: str, password: str, ip_address: str
    ) -> tuple[bool, "AuthenticatedLogin | str"]:
        """Authenticate a user with username/password.

        Returns ``(True, AuthenticatedLogin)`` on success or
        ``(False, error_message)`` on failure. Every credential failure
        returns the same generic message, and rate limiting is applied
        uniformly to existing, unknown, and disabled accounts, so the
        response never reveals whether the username exists.
        """
        # Normalized identifier: case-insensitive rate limiting that matches
        # the case-insensitive username lookup in the user repository.
        normalized = (username or "").casefold()

        # Rate limiting applies before any identity lookup so unknown and
        # existing accounts are throttled identically (no enumeration oracle).
        tracker = self._get_tracker(normalized)
        allowed, message = tracker.can_attempt()
        if not allowed:
            self._audit(
                "LOGIN_RATE_LIMITED",
                outcome="denied",
                username=normalized,
                failure_summary="rate_limited",
            )
            return False, message

        try:
            user = self.user_repository.find_by_username(normalized)
        except Exception:
            # Identity backend unavailable: no faked success (SPEC-0002 R-017).
            tracker.record_failure(ip_address)
            self._audit(
                "LOGIN_FAILED",
                outcome="failure",
                username=normalized,
                failure_summary="identity_lookup_unavailable",
            )
            return False, GENERIC_CREDENTIAL_FAILURE

        if user is None or user.status != UserStatus.ENABLED:
            # Uniform handling for unknown and disabled accounts: verify
            # against a dummy hash so verification timing does not reveal
            # account existence either.
            verify_password(password, _dummy_password_hash())
            tracker.record_failure(ip_address)
            self._audit(
                "LOGIN_FAILED",
                outcome="failure",
                user=user,
                username=normalized,
                failure_summary="invalid_credentials" if user is None else "account_not_enabled",
            )
            return False, GENERIC_CREDENTIAL_FAILURE

        if not verify_password(password, user.password_hash):
            tracker.record_failure(ip_address)
            self._audit(
                "LOGIN_FAILED",
                outcome="failure",
                user=user,
                failure_summary="invalid_credentials",
            )
            return False, GENERIC_CREDENTIAL_FAILURE

        # Successful login: clear failure state and create a session.
        tracker.reset_failures()

        # Capture user's current session_epoch for forced logout detection.
        session = UserSession.create(
            user_id=str(user.id),
            username=user.username,
            max_age_seconds=self.auth_settings.session_max_age_seconds,
            ip_address=ip_address,
            session_epoch=user.session_epoch,
        )
        csrf_pair = CsrfTokenPair.generate(
            session.session_id,
            lifetime_hours=self.auth_settings.csrf_token_lifetime_hours,
        )

        try:
            self.session_repository.create_session(
                session_token=session.session_id,
                csrf_token=csrf_pair.csrf_token,
                user_id=user.id,
                session_epoch=user.session_epoch,
                created_at=session.created_at,
                expires_at=session.expires_at,
            )
            # SPEC-0002 section 8: if the durable audit write fails, the
            # login must not be shown as successful.
            self._audit("LOGIN_SUCCESS", outcome="success", user=user, strict=True)
        except Exception:
            return False, GENERIC_CREDENTIAL_FAILURE

        return True, AuthenticatedLogin(session=session, csrf_pair=csrf_pair)

    # -- session lifecycle -------------------------------------------------

    def validate_session(self, session_id: str) -> Optional[UserSession]:
        """Return the session if present, unexpired, and user still ENABLED.

        Per DEC-0044: disabling an account or revoking permission must
        invalidate existing sessions immediately. We re-check the user's
        status AND session_epoch against what was recorded at login time,
        and persist the invalidation with a reason when they diverge.
        Any backend failure denies (fail-closed).
        """
        if not session_id:
            return None

        try:
            record = self.session_repository.find_active_session(session_id)
        except Exception:
            return None
        if record is None:
            return None

        # Re-validate user status AND session_epoch.
        try:
            fresh_user = self.user_repository.find_by_id(record.user_id)
        except Exception:
            return None

        if not fresh_user or fresh_user.status != UserStatus.ENABLED:
            # Account disabled/revoked; invalidate the session immediately.
            self._invalidate_with_reason(session_id, "user_not_enabled", user=fresh_user)
            return None

        # Check session_epoch: if user's epoch changed (e.g., forced logout),
        # this session's epoch will be stale -> invalidate it.
        if fresh_user.session_epoch != record.session_epoch:
            self._invalidate_with_reason(session_id, "session_epoch_mismatch", user=fresh_user)
            return None

        return UserSession(
            session_id=session_id,
            user_id=str(record.user_id),
            session_epoch=record.session_epoch,
            created_at=record.created_at,
            expires_at=record.expires_at,
        )

    def _invalidate_with_reason(self, session_id: str, reason: str, *, user=None) -> None:
        try:
            self.session_repository.invalidate_session(session_id, reason=reason)
        except Exception:
            return
        self._audit(
            "SESSION_INVALIDATED",
            outcome="denied",
            user=user,
            failure_summary=reason,
        )

    def invalidate_session(self, session_id: str, *, reason: str = "logout") -> bool:
        """Invalidate a session (and thereby its CSRF token); audit it."""
        if not session_id:
            return False
        try:
            user_id = self.session_repository.invalidate_session(session_id, reason=reason)
        except Exception:
            return False
        if user_id is None:
            return False
        self._audit("LOGOUT", outcome="success", actor_user_id=user_id)
        return True

    # -- csrf --------------------------------------------------------------

    def issue_csrf_token(self, session_id: str) -> Optional[CsrfTokenPair]:
        """Generate a fresh CSRF token and persist its hash for the session.

        Only the SHA-256 digest is stored server-side, so a previously
        issued raw token can never be read back; issuing rotates the token.
        Returns None when the session is not active or the backend fails.
        """
        if not session_id:
            return None
        pair = CsrfTokenPair.generate(
            session_id,
            lifetime_hours=self.auth_settings.csrf_token_lifetime_hours,
        )
        try:
            updated = self.session_repository.update_csrf_token_hash(
                session_id, pair.csrf_token
            )
        except Exception:
            return None
        if not updated:
            return None
        return pair

    def validate_csrf_token(self, session_id: str, presented_token: str) -> bool:
        """Constant-time check of a presented CSRF token against the
        persisted hash of an active session. Any failure denies."""
        if not session_id or not presented_token:
            return False
        try:
            record = self.session_repository.find_active_session(session_id)
        except Exception:
            return False
        if record is None:
            return False
        return secrets.compare_digest(record.csrf_token_hash, hash_token(presented_token))


_DUMMY_PASSWORD_HASH: Optional[str] = None


def _dummy_password_hash() -> str:
    """Argon2id hash used to equalize verification timing for unknown or
    disabled accounts, so login timing does not reveal account existence.
    Not a credential: the plaintext is a fixed non-secret string."""
    global _DUMMY_PASSWORD_HASH
    if _DUMMY_PASSWORD_HASH is None:
        _DUMMY_PASSWORD_HASH = PasswordHasher().hash(
            "dummy-password-for-timing-equalization"
        )
    return _DUMMY_PASSWORD_HASH


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return PasswordHasher().hash(password)


def verify_password(password: str, password_hash) -> bool:
    """Verify a password against an Argon2id hash."""
    try:
        PasswordHasher().verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHash):
        return False
