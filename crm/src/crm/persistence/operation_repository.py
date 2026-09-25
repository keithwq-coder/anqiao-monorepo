"""Durable operations audit persistence (SPEC-0012 §7, R-009/AC-009).

Writes ``operation_records`` rows for backup, restore rehearsal,
deployment change, and rollback actions. Operation records must never
contain plaintext passwords, tokens, connection strings, or any secret;
internal failure detail goes into ``failure_summary`` as a non-sensitive
classification string only (SPEC-0012 §10).
"""

from typing import Optional
from uuid import UUID

from crm.persistence.models import OperationRecordModel

_ALLOWED_OPERATION_TYPES = frozenset(
    {"backup", "restore", "deployment_change", "rollback", "deletion_propagation"}
)
_ALLOWED_OUTCOMES = frozenset({"success", "failed", "unverified"})


class OperationRecordRepository:
    """Repository for durable operations audit records over
    ``operation_records``.

    The repository is fail-closed: an outcome of ``success`` is only
    permitted when the caller can verify the operation completed. An
    operation that could not be verified must use ``unverified`` or
    ``failed`` (SPEC-0012 §8).
    """

    def record(
        self,
        *,
        operation_type: str,
        action: str,
        target_description: str,
        outcome: str,
        actor_user_id: Optional[UUID] = None,
        detail_summary: Optional[str] = None,
        failure_summary: Optional[str] = None,
        completed_at=None,
        session=None,
    ) -> OperationRecordModel:
        """Persist one operation record.

        ``operation_type`` must be one of backup/restore/deployment_change/
        rollback. ``outcome`` must be one of success/failed/unverified. A
        ``success`` outcome must not carry a ``failure_summary``; a
        ``completed_at`` timestamp is required for any non-``unverified``
        outcome (enforced by schema CHECK constraints and validated here so
        misuse fails before the database round trip).

        Returns the persisted model (useful for tests and inspection).
        """
        if operation_type not in _ALLOWED_OPERATION_TYPES:
            raise ValueError(
                f"operation_type must be one of {sorted(_ALLOWED_OPERATION_TYPES)}"
            )
        if outcome not in _ALLOWED_OUTCOMES:
            raise ValueError(
                f"outcome must be one of {sorted(_ALLOWED_OUTCOMES)}"
            )
        if outcome == "success" and failure_summary is not None:
            raise ValueError("a success outcome must not carry a failure_summary")
        if outcome != "unverified" and completed_at is None:
            raise ValueError(
                "completed_at is required for any outcome other than 'unverified'"
            )

        model = OperationRecordModel(
            operation_type=operation_type,
            actor_user_id=actor_user_id,
            action=action,
            target_description=target_description,
            outcome=outcome,
            detail_summary=detail_summary,
            failure_summary=failure_summary,
            completed_at=completed_at,
        )

        if session is not None:
            session.add(model)
            return model

        from crm.persistence.database import SessionLocal

        with SessionLocal() as s:
            s.add(model)
            s.commit()
            s.refresh(model)
            return model

    def list_by_type(
        self,
        *,
        operation_type: str,
        session=None,
    ) -> list[OperationRecordModel]:
        """Return all records of the given operation type, newest first."""
        if operation_type not in _ALLOWED_OPERATION_TYPES:
            raise ValueError(
                f"operation_type must be one of {sorted(_ALLOWED_OPERATION_TYPES)}"
            )

        from sqlalchemy import select

        stmt = (
            select(OperationRecordModel)
            .where(OperationRecordModel.operation_type == operation_type)
            .order_by(OperationRecordModel.occurred_at.desc())
        )

        if session is not None:
            return list(session.execute(stmt).scalars().all())

        from crm.persistence.database import SessionLocal

        with SessionLocal() as s:
            return list(s.execute(stmt).scalars().all())
