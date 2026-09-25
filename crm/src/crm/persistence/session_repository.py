"""Durable server-side session persistence (DEC-0044).

Sessions live in the ``server_sessions`` table. Only SHA-256 hex digests of
session and CSRF tokens are persisted; raw tokens never reach the database
(task card: "Only token hashes may be persisted").
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID

import sqlalchemy as sa

from crm.domain.models import utc_now
from crm.persistence.models import ServerSessionModel


def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest of a raw token.

    64 lowercase hex characters, fitting ``server_sessions`` String(64)
    columns. This is the only representation of a token that may be
    persisted.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class PersistedSession:
    """Active session row as read back from durable storage."""

    user_id: UUID
    session_epoch: int
    created_at: datetime
    expires_at: datetime
    csrf_token_hash: str


def _persisted_from_model(model: ServerSessionModel) -> PersistedSession:
    return PersistedSession(
        user_id=model.user_id,
        session_epoch=model.user_session_epoch,
        created_at=model.created_at,
        expires_at=model.expires_at,
        csrf_token_hash=model.csrf_token_hash,
    )


class ServerSessionRepository:
    """Repository for durable server-side sessions over ``server_sessions``."""

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
        """Persist a new session row; only token hashes are stored."""
        from crm.persistence.database import SessionLocal

        model = ServerSessionModel(
            session_token_hash=hash_token(session_token),
            csrf_token_hash=hash_token(csrf_token),
            user_id=user_id,
            user_session_epoch=session_epoch,
            created_at=created_at,
            expires_at=expires_at,
            last_seen_at=created_at,
        )

        with SessionLocal() as session:
            session.add(model)
            session.commit()

    def find_active_session(self, session_token: str) -> Optional[PersistedSession]:
        """Return the active session for a raw token, or None.

        Active means not invalidated and not expired. A successful lookup
        also touches ``last_seen_at`` so activity is observable.
        """
        from crm.persistence.database import SessionLocal

        with SessionLocal() as session:
            model = session.execute(
                sa.select(ServerSessionModel).where(
                    ServerSessionModel.session_token_hash == hash_token(session_token),
                    ServerSessionModel.invalidated_at.is_(None),
                    ServerSessionModel.expires_at > utc_now(),
                )
            ).scalar_one_or_none()

            if model is None:
                return None

            model.last_seen_at = utc_now()
            session.commit()
            return _persisted_from_model(model)

    def update_csrf_token_hash(self, session_token: str, csrf_token: str) -> bool:
        """Rotate the CSRF token hash of an active session.

        Returns True when an active session was updated, False otherwise.
        """
        from crm.persistence.database import SessionLocal

        with SessionLocal() as session:
            model = session.execute(
                sa.select(ServerSessionModel).where(
                    ServerSessionModel.session_token_hash == hash_token(session_token),
                    ServerSessionModel.invalidated_at.is_(None),
                    ServerSessionModel.expires_at > utc_now(),
                )
            ).scalar_one_or_none()

            if model is None:
                return False

            model.csrf_token_hash = hash_token(csrf_token)
            session.commit()
            return True

    def invalidate_session(self, session_token: str, reason: str) -> Optional[UUID]:
        """Invalidate the session for a raw token with an audit reason.

        Returns the owning user's id when a live session was invalidated,
        None when no live session matched.
        """
        from crm.persistence.database import SessionLocal

        with SessionLocal() as session:
            model = session.execute(
                sa.select(ServerSessionModel).where(
                    ServerSessionModel.session_token_hash == hash_token(session_token),
                    ServerSessionModel.invalidated_at.is_(None),
                )
            ).scalar_one_or_none()

            if model is None:
                return None

            model.invalidated_at = utc_now()
            model.invalidation_reason = reason
            session.commit()
            return model.user_id
