"""Lifecycle commands for SPEC-0011 permanent erasure and propagation.

TASK-0017: administrator-only, audited, irreversible permanent erasure of
personal data. The erasure blanks personal fields on the live record, writes
an erasure_records row (with propagate_by = erased_at + 30 days per
DEC-0104), and writes an audit event — all in one transaction. The audit
before_state/after_state carry field-presence flags only, never personal
values (R-004).

Authorization (ADMINISTRATOR-only) and confirmation (confirm=true) are
enforced by the route layer before the command runs.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from crm.persistence.models import (
    AuditEventModel,
    ContactModel,
    ErasureRecordModel,
    InstitutionModel,
)

# DEC-0104 Decision 2: 30-day propagation window.
PROPAGATION_WINDOW_DAYS = 30

# Non-personal placeholder replacing erased field values. Satisfies NOT NULL
# and non-blank CHECK constraints without retaining any personal data.
ERASED_MARKER = "[已删除]"


def _default_session_factory():
    from crm.config import Settings
    from crm.persistence.database import get_session_factory
    return get_session_factory(Settings())


def _audit_erasure(session, action, actor_id, target_type, target_id, reason,
                   before_flags, after_state):
    """Write an audit event with field-presence flags only (R-004: no personal values)."""
    session.add(AuditEventModel(
        actor_user_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        outcome="success",
        reason=reason,
        before_state=before_flags,
        after_state=after_state,
    ))


class EraseInstitutionCommand:
    """Permanently erase personal data from an institution and its contacts
    (SPEC-0011 R-003, R-004, R-005, AC-001, AC-002).

    Irreversible in the application: personal fields are blanked to a
    non-personal marker or null. The institution row is not deleted (FK
    constraints prevent clean deletion); the personal values are destroyed
    in-place. An erasure_records row and audit event are written in the same
    transaction (§8: audit write failure rolls back the erasure).
    """

    def __init__(
        self,
        institution_id: UUID,
        erased_by_user_id: UUID,
        reason: str,
        is_request_fulfillment: bool = False,
        request_reference: str | None = None,
    ):
        self.institution_id = institution_id
        self.erased_by_user_id = erased_by_user_id
        self.reason = reason
        self.is_request_fulfillment = is_request_fulfillment
        self.request_reference = request_reference

    def execute(self, session_factory=None) -> dict:
        from crm.persistence.database import transaction_session

        factory = session_factory or _default_session_factory()
        with transaction_session(factory) as session:
            inst = session.get(InstitutionModel, self.institution_id)
            if inst is None:
                raise ValueError("institution not found")

            # R-004: before_state carries field-presence flags, never values.
            contacts = (
                session.query(ContactModel)
                .filter_by(institution_id=self.institution_id)
                .all()
            )
            before_flags = {
                "institution_name_present": inst.name is not None and inst.name != ERASED_MARKER,
                "source_description_present": inst.source_description is not None and inst.source_description != ERASED_MARKER,
                "source_kind_present": inst.source_kind is not None,
                "category_present": inst.category is not None,
                "region_present": inst.region is not None,
                "source_evidence_present": inst.source_evidence_reference is not None,
                "contact_count": len(contacts),
                "contacts_with_phone": sum(1 for c in contacts if c.phone),
                "contacts_with_email": sum(1 for c in contacts if c.email),
                "contacts_with_wechat": sum(1 for c in contacts if c.wechat),
                "contacts_with_name": sum(1 for c in contacts if c.name),
            }

            # Erase institution personal fields in-place.
            inst.name = ERASED_MARKER
            inst.source_description = ERASED_MARKER
            inst.source_kind = None
            inst.category = None
            inst.region = None
            inst.source_evidence_reference = None
            inst.updated_at = datetime.now(timezone.utc)

            # Erase contact personal fields in-place.
            contact_fields_erased = 0
            for contact in contacts:
                if contact.name is not None:
                    contact.name = ERASED_MARKER
                if contact.phone is not None:
                    contact.phone = None
                    contact_fields_erased += 1
                if contact.email is not None:
                    contact.email = None
                    contact_fields_erased += 1
                if contact.wechat is not None:
                    contact.wechat = None
                    contact_fields_erased += 1
                if contact.other_channel is not None:
                    contact.other_channel = None
                    contact_fields_erased += 1
                if contact.channel_notes is not None:
                    contact.channel_notes = None
                    contact_fields_erased += 1
                if contact.role_label is not None:
                    contact.role_label = ERASED_MARKER
                if contact.job_title is not None:
                    contact.job_title = None
                # Set contactability_status to not_provided_or_not_storable
                # since all channels are now null.
                contact.contactability_status = "not_provided_or_not_storable"
                contact.updated_at = datetime.now(timezone.utc)

            # Write the erasure record with propagate_by deadline.
            erased_at = datetime.now(timezone.utc)
            propagate_by = erased_at + timedelta(days=PROPAGATION_WINDOW_DAYS)
            erasure_scope = (
                "institution:name,source_description,source_kind,category,region,"
                "source_evidence_reference;contacts:name,phone,email,wechat,"
                "other_channel,channel_notes,role_label,job_title"
            )
            erasure_record = ErasureRecordModel(
                target_type="institution",
                target_id=self.institution_id,
                erased_by_user_id=self.erased_by_user_id,
                erasure_reason=self.reason,
                erasure_scope=erasure_scope,
                erased_at=erased_at,
                propagate_by=propagate_by,
                propagation_status="pending",
                is_request_fulfillment=self.is_request_fulfillment,
                request_reference=self.request_reference,
            )
            session.add(erasure_record)
            session.flush()

            after_state = {
                "erased": True,
                "propagate_by": propagate_by.isoformat(),
                "propagation_status": "pending",
                "is_request_fulfillment": self.is_request_fulfillment,
                "contact_fields_erased": contact_fields_erased,
            }

            _audit_erasure(
                session,
                action="institution.erasure",
                actor_id=self.erased_by_user_id,
                target_type="institution",
                target_id=self.institution_id,
                reason=self.reason,
                before_flags=before_flags,
                after_state=after_state,
            )

            return {
                "institution_id": str(self.institution_id),
                "erased": True,
                "erased_at": erased_at.isoformat(),
                "propagate_by": propagate_by.isoformat(),
                "propagation_status": "pending",
                "is_request_fulfillment": self.is_request_fulfillment,
                "erasure_record_id": str(erasure_record.id),
            }
