"""SPEC-0003 v0.4.0 persistence for opportunity candidates.

Each row in ``opportunity_candidates`` is one AI-surfaced opportunity
candidate (source existing_customer/crawler) with a supporting reason that a
HUMAN adjudicates (待处理/采纳/忽略). Methods take the caller's ``session``;
the caller owns the transaction.
"""

from datetime import datetime, timezone
from uuid import UUID

import sqlalchemy as sa

from crm.persistence.models import OpportunityCandidateModel


class OpportunityCandidateRepository:
    """Read/write access to ``opportunity_candidates`` inside a session."""

    def list_for_recipient(self, *, session, recipient_user_id: UUID) -> list:
        models = session.execute(
            sa.select(OpportunityCandidateModel)
            .where(OpportunityCandidateModel.recipient_user_id == recipient_user_id)
            .order_by(OpportunityCandidateModel.discovered_at.desc())
        ).scalars().all()
        return list(models)

    def find_by_id(self, *, session, candidate_id: UUID):
        return session.get(OpportunityCandidateModel, candidate_id)

    def create(
        self,
        *,
        session,
        recipient_user_id: UUID,
        source: str,
        candidate_text: str,
        supporting_reason: str,
        key_uncertainties: str,
        involved_records: list | None = None,
        external_subject: dict | None = None,
        expires_at: datetime | None = None,
        ai_used: bool = False,
        model_identifier: str | None = None,
    ) -> OpportunityCandidateModel:
        model = OpportunityCandidateModel(
            recipient_user_id=recipient_user_id,
            source=source,
            status="待处理",
            candidate_text=candidate_text,
            supporting_reason=supporting_reason,
            key_uncertainties=key_uncertainties,
            involved_records=involved_records,
            external_subject=external_subject,
            discovered_at=datetime.now(timezone.utc),
            expires_at=expires_at,
            ai_used=ai_used,
            model_identifier=model_identifier,
        )
        session.add(model)
        session.flush()
        return model

    def adjudicate(
        self,
        *,
        session,
        candidate: OpportunityCandidateModel,
        status: str,
        actor_user_id: UUID,
    ) -> OpportunityCandidateModel:
        candidate.status = status
        candidate.adjudicated_at = datetime.now(timezone.utc)
        candidate.adjudicated_by_user_id = actor_user_id
        session.flush()
        return candidate
