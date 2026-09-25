"""Durable security audit persistence (SPEC-0002 section 7).

Writes ``audit_events`` rows. Audit records must never contain plaintext
passwords, password hashes, raw session/CSRF tokens, or token digests;
internal failure detail goes into ``failure_summary`` as a non-sensitive
classification string only.
"""

from typing import Optional
from uuid import UUID

from crm.persistence.models import AuditEventModel

_ALLOWED_OUTCOMES = frozenset({"success", "denied", "failure"})


class AuditEventRepository:
    """Repository for durable audit events over ``audit_events``."""

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
        session=None,
    ) -> None:
        """Persist one audit event.

        ``outcome`` must be one of success/denied/failure (enforced by the
        schema CHECK constraint; validated here as well so misuse fails
        before the database round trip).

        When ``session`` is given, the event is added to the caller's
        session and the caller owns the transaction (used inside
        ``transaction_session`` so revision + audit commit or roll back
        together, R-031/AC-009). Without ``session`` the event is written in
        its own ``SessionLocal()`` transaction (original behavior).
        """
        if outcome not in _ALLOWED_OUTCOMES:
            raise ValueError(f"audit outcome must be one of {sorted(_ALLOWED_OUTCOMES)}")

        model = AuditEventModel(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            outcome=outcome,
            reason=reason,
            failure_summary=failure_summary,
        )

        if session is not None:
            session.add(model)
            return

        from crm.persistence.database import SessionLocal

        with SessionLocal() as s:
            s.add(model)
            s.commit()
