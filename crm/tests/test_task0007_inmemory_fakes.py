"""In-memory fakes implementing the TASK-0007 auth persistence interfaces.

These fakes mirror the repository contracts in
``src/crm/persistence/session_repository.py``, ``audit_repository.py``,
``role_grant_repository.py``, and ``user_repository.py`` so the real
``AuthenticationService``, dependency loaders, and HTTP stack can run in
tests without a database. Like production, only SHA-256 token hashes are
stored for sessions and CSRF tokens.

This module intentionally defines no test functions; it is imported by the
TASK-0007 test modules and the adapted S4 authentication tests.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID

from crm.domain.models import utc_now
from crm.persistence.session_repository import PersistedSession, hash_token


@dataclass
class _StoredSession:
    session_token_hash: str
    csrf_token_hash: str
    user_id: UUID
    session_epoch: int
    created_at: datetime
    expires_at: datetime
    last_seen_at: datetime
    invalidated_at: Optional[datetime] = None
    invalidation_reason: Optional[str] = None


class InMemorySessionRepository:
    """Same contract as ServerSessionRepository, backed by a dict."""

    def __init__(self):
        self._sessions: dict[str, _StoredSession] = {}
        # Test hook: simulate a durable-store outage (fail-closed checks).
        self.fail_writes = False

    def create_session(
        self,
        *,
        session_token: str,
        csrf_token: str,
        user_id: UUID,
        session_epoch: int,
        created_at: datetime,
        expires_at: datetime,
    ) -> None:
        if self.fail_writes:
            raise RuntimeError("session backend unavailable")
        key = hash_token(session_token)
        self._sessions[key] = _StoredSession(
            session_token_hash=key,
            csrf_token_hash=hash_token(csrf_token),
            user_id=user_id,
            session_epoch=session_epoch,
            created_at=created_at,
            expires_at=expires_at,
            last_seen_at=created_at,
        )

    def _active(self, session_token: str) -> Optional[_StoredSession]:
        stored = self._sessions.get(hash_token(session_token))
        if stored is None or stored.invalidated_at is not None:
            return None
        if utc_now() >= stored.expires_at:
            return None
        return stored

    def find_active_session(self, session_token: str) -> Optional[PersistedSession]:
        stored = self._active(session_token)
        if stored is None:
            return None
        stored.last_seen_at = utc_now()
        return PersistedSession(
            user_id=stored.user_id,
            session_epoch=stored.session_epoch,
            created_at=stored.created_at,
            expires_at=stored.expires_at,
            csrf_token_hash=stored.csrf_token_hash,
        )

    def update_csrf_token_hash(self, session_token: str, csrf_token: str) -> bool:
        stored = self._active(session_token)
        if stored is None:
            return False
        stored.csrf_token_hash = hash_token(csrf_token)
        return True

    def invalidate_session(self, session_token: str, reason: str) -> Optional[UUID]:
        stored = self._sessions.get(hash_token(session_token))
        if stored is None or stored.invalidated_at is not None:
            return None
        stored.invalidated_at = utc_now()
        stored.invalidation_reason = reason
        return stored.user_id

    # -- test helpers ------------------------------------------------------

    def count(self) -> int:
        return len(self._sessions)

    def is_invalidated(self, session_token: str) -> bool:
        stored = self._sessions.get(hash_token(session_token))
        return stored is not None and stored.invalidated_at is not None

    def invalidation_reason(self, session_token: str) -> Optional[str]:
        stored = self._sessions.get(hash_token(session_token))
        return stored.invalidation_reason if stored else None

    def stored_values(self) -> list:
        """All stored field values, for hash-only persistence assertions."""
        values = []
        for stored in self._sessions.values():
            values.extend(
                [
                    stored.session_token_hash,
                    stored.csrf_token_hash,
                    str(stored.user_id),
                    stored.invalidation_reason or "",
                ]
            )
        return values


class InMemoryAuditRepository:
    """Same contract as AuditEventRepository, backed by a list."""

    def __init__(self):
        self.events: list[dict] = []
        # Test hook: simulate a durable-store outage (fail-closed checks).
        self.fail_writes = False

    def record(
        self,
        *,
        action: str,
        outcome: str,
        target_type: str,
        actor_user_id: Optional[UUID] = None,
        target_id: Optional[UUID] = None,
        reason: Optional[str] = None,
        failure_summary: Optional[str] = None,
    ) -> None:
        if self.fail_writes:
            raise RuntimeError("audit backend unavailable")
        self.events.append(
            {
                "action": action,
                "outcome": outcome,
                "target_type": target_type,
                "actor_user_id": actor_user_id,
                "target_id": target_id,
                "reason": reason,
                "failure_summary": failure_summary,
                "at": utc_now(),
            }
        )

    def actions(self) -> list[str]:
        return [event["action"] for event in self.events]


class InMemoryRoleGrantRepository:
    """Same contract as RoleGrantRepository, backed by a dict."""

    def __init__(self, grants: Optional[dict] = None):
        # user_id (UUID) -> (frozenset[Role], frozenset[str scope keys])
        self._grants: dict = dict(grants or {})
        # Test hook: simulate a backend outage (fail-closed checks).
        self.fail_reads = False

    def set_grants(self, user_id: UUID, roles, scope_keys=frozenset()) -> None:
        self._grants[user_id] = (frozenset(roles), frozenset(scope_keys))

    def find_active_roles(self, user_id: UUID) -> tuple[frozenset, frozenset]:
        if self.fail_reads:
            raise RuntimeError("role grant backend unavailable")
        return self._grants.get(user_id, (frozenset(), frozenset()))


class InMemoryUserRepository:
    """Same read contract as UserRepository, backed by a dict."""

    def __init__(self, users: Optional[list] = None):
        self._users: dict[UUID, object] = {}
        for user in users or []:
            self.add(user)

    def add(self, user) -> None:
        self._users[user.id] = user

    def find_by_id(self, user_id) -> Optional[object]:
        if not isinstance(user_id, UUID):
            user_id = UUID(str(user_id))
        return self._users.get(user_id)

    def find_by_username(self, username: str) -> Optional[object]:
        normalized = (username or "").casefold()
        for user in self._users.values():
            if user.username.casefold() == normalized:
                return user
        return None
