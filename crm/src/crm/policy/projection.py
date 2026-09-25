"""Central fail-closed read policy and field projection for CRM records."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum
from types import MappingProxyType
from typing import Any
from uuid import UUID

from crm.domain import Contact, ContactabilityStatus, FollowUpActivity, Institution, Role, UserStatus
from crm.domain.models import split_stored_interaction_method


class PolicyDenied(PermissionError):
    """Raised when a subject has no approved visibility for a record."""


class PolicyInputError(ValueError):
    """Raised when a record snapshot is internally inconsistent."""


class RecordViewLevel(StrEnum):
    OWNER = "owner"
    COLLABORATOR = "collaborator"
    ADMINISTRATOR_EXCEPTION = "administrator_exception"


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


@dataclass(frozen=True, slots=True)
class PolicySubject:
    """Effective server-side identity and access scope for one request."""

    user_id: UUID
    status: UserStatus
    roles: frozenset[Role] = field(default_factory=frozenset)
    management_scope_keys: frozenset[str] = field(default_factory=frozenset)

    def __post_init__(self) -> None:
        object.__setattr__(self, "roles", frozenset(Role(role) for role in self.roles))
        object.__setattr__(
            self,
            "management_scope_keys",
            frozenset(
                normalized
                for scope_key in self.management_scope_keys
                if (normalized := _optional_text(scope_key)) is not None
            ),
        )


@dataclass(frozen=True, slots=True)
class ActivitySummarySource:
    """An activity with an explicitly safe category for concise collaboration."""

    activity: FollowUpActivity
    communication_method_category: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "communication_method_category",
            _optional_text(self.communication_method_category),
        )


@dataclass(frozen=True, slots=True)
class RecordSnapshot:
    """A record aggregate validated before it enters the policy layer."""

    institution: Institution
    contacts: tuple[Contact, ...] = ()
    activities: tuple[ActivitySummarySource, ...] = ()
    business_history: tuple[Mapping[str, Any], ...] = ()
    audit_history: tuple[Mapping[str, Any], ...] = ()
    collaborator_source_category: str | None = None
    management_scope_key: str | None = None

    def __post_init__(self) -> None:
        contacts = tuple(self.contacts)
        activities = tuple(self.activities)
        business_history = tuple(self.business_history)
        audit_history = tuple(self.audit_history)

        for contact in contacts:
            if contact.institution_id != self.institution.id:
                raise PolicyInputError("contact belongs to a different institution")
        for activity_source in activities:
            if activity_source.activity.institution_id != self.institution.id:
                raise PolicyInputError("activity belongs to a different institution")
        if any(not isinstance(item, Mapping) for item in (*business_history, *audit_history)):
            raise PolicyInputError("history entries must be mappings")

        object.__setattr__(self, "contacts", contacts)
        object.__setattr__(self, "activities", activities)
        object.__setattr__(self, "business_history", business_history)
        object.__setattr__(self, "audit_history", audit_history)
        object.__setattr__(
            self,
            "collaborator_source_category",
            _optional_text(self.collaborator_source_category),
        )
        object.__setattr__(
            self,
            "management_scope_key",
            _optional_text(self.management_scope_key),
        )


@dataclass(frozen=True, slots=True)
class AccessDecision:
    """The policy result required before any page or API can receive data."""

    view_level: RecordViewLevel
    requires_access_audit: bool
    access_reason: str | None

    @property
    def read_only(self) -> bool:
        """S3 grants no write ability; commands are introduced in S4."""
        return True


@dataclass(frozen=True, slots=True)
class RecordProjection:
    """A field-filtered record payload and the non-client audit instruction."""

    decision: AccessDecision
    data: Mapping[str, Any]


def resolve_read_access(
    subject: PolicySubject,
    record: RecordSnapshot,
    *,
    administrator_reason: str | None = None,
) -> AccessDecision:
    """Return the approved read level or deny without disclosing record facts."""

    if subject.status is not UserStatus.ENABLED:
        raise PolicyDenied("record access denied")

    reason = _optional_text(administrator_reason)
    if Role.ADMINISTRATOR in subject.roles:
        # SPEC-0002 v0.4.0 R-008: the administrator has global full
        # visibility of every record without needing an exception reason; a
        # voluntarily supplied reason is retained on the decision for
        # optional tracing. The old "exception read requires a reason"
        # behavior (0.7.0 R-015) is removed.
        return AccessDecision(
            view_level=RecordViewLevel.ADMINISTRATOR_EXCEPTION,
            requires_access_audit=True,
            access_reason=reason,
        )

    if Role.SHAREHOLDER in subject.roles:
        # SPEC-0002 v0.5.0: shareholder (赵/武) has the same global
        # visibility as administrator (R-008) but without account
        # management capabilities. The same ADMINISTRATOR_EXCEPTION level
        # is applied for full record visibility.
        return AccessDecision(
            view_level=RecordViewLevel.ADMINISTRATOR_EXCEPTION,
            requires_access_audit=True,
            access_reason=reason,
        )

    if Role.BUSINESS_USER in subject.roles:
        if subject.user_id == record.institution.owner_user_id:
            return AccessDecision(
                view_level=RecordViewLevel.OWNER,
                requires_access_audit=False,
                access_reason=None,
            )
        if record.institution.in_pool:
            return AccessDecision(
                view_level=RecordViewLevel.COLLABORATOR,
                requires_access_audit=False,
                access_reason=None,
            )
        raise PolicyDenied("record access denied")

    if (
        Role.MANAGER in subject.roles
        and record.management_scope_key is not None
        and record.management_scope_key in subject.management_scope_keys
    ):
        return AccessDecision(
            view_level=RecordViewLevel.COLLABORATOR,
            requires_access_audit=False,
            access_reason=None,
        )

    raise PolicyDenied("record access denied")


def project_record(
    subject: PolicySubject,
    record: RecordSnapshot,
    *,
    administrator_reason: str | None = None,
) -> RecordProjection:
    """Return the sole read payload for page/API callers, with no raw fallback."""

    decision = resolve_read_access(
        subject,
        record,
        administrator_reason=administrator_reason,
    )
    if decision.view_level is RecordViewLevel.COLLABORATOR:
        data = _collaborator_projection(record)
    else:
        data = _detailed_projection(record, include_audit=decision.requires_access_audit)

    return RecordProjection(decision=decision, data=_freeze_mapping(data))


def _detailed_projection(record: RecordSnapshot, *, include_audit: bool) -> dict[str, Any]:
    data: dict[str, Any] = {
        "institution": {
            "id": record.institution.id,
            "name": record.institution.name,
            "customer_type": record.institution.customer_type,
            "in_pool": record.institution.in_pool,
            "category": record.institution.category,
            "region": record.institution.region,
            "owner_user_id": record.institution.owner_user_id,
            "source_description": record.institution.source_description,
            "source_kind": record.institution.source_kind,
            "source_evidence_reference": record.institution.source_evidence_reference,
            "created_at": record.institution.created_at,
            "updated_at": record.institution.updated_at,
        },
        "contacts": tuple(_detailed_contact(contact) for contact in record.contacts),
        "activities": tuple(
            _detailed_activity(activity_source.activity) for activity_source in _ordered_activities(record)
        ),
        "business_history": record.business_history,
        "concise_progress": _concise_progress(record),
    }
    if include_audit:
        data["audit_history"] = record.audit_history
    return data


def _collaborator_projection(record: RecordSnapshot) -> dict[str, Any]:
    return {
        "institution": {
            "id": record.institution.id,
            "name": record.institution.name,
            "customer_type": record.institution.customer_type,
            "in_pool": record.institution.in_pool,
            "category": record.institution.category,
            "region": record.institution.region,
            "owner_user_id": record.institution.owner_user_id,
            "source_category": record.collaborator_source_category,
        },
        "contacts": tuple(_collaborator_contact(contact) for contact in record.contacts),
        "concise_progress": _concise_progress(record),
    }


def _detailed_contact(contact: Contact) -> dict[str, Any]:
    return {
        "id": contact.id,
        "name": contact.name,
        "role_label": contact.role_label,
        "job_title": contact.job_title,
        "contactability_status": contact.contactability_status,
        "phone": contact.phone,
        "email": contact.email,
        "wechat": contact.wechat,
        "other_channel": contact.other_channel,
        "channel_notes": contact.channel_notes,
        "created_at": contact.created_at,
        "updated_at": contact.updated_at,
    }


def _collaborator_contact(contact: Contact) -> dict[str, Any]:
    return {
        "id": contact.id,
        "name_masked": "***" if contact.name is not None else None,
        "role_label": contact.role_label,
        "job_title": contact.job_title,
        "has_storable_channel": contact.contactability_status
        is ContactabilityStatus.AVAILABLE,
    }


def _detailed_activity(activity: FollowUpActivity) -> dict[str, Any]:
    # R-029: display the free-text interaction detail; the stored
    # 【category】 prefix is the persistence encoding and stays out of views.
    _, display_method = split_stored_interaction_method(activity.interaction_method)
    return {
        "id": activity.id,
        "occurred_at": activity.occurred_at,
        "interaction_method": display_method,
        "recorded_at": activity.recorded_at,
        "recorded_by_user_id": activity.recorded_by_user_id,
        "factual_body": activity.factual_body,
        "participants": activity.participants,
        "customer_needs": activity.customer_needs,
        "decision_participants": activity.decision_participants,
        "objections_constraints": activity.objections_constraints,
        "commitments": activity.commitments,
        "next_action": activity.next_action,
        "next_action_owner_user_id": activity.next_action_owner_user_id,
        "next_action_target_date": activity.next_action_target_date,
        "facts_to_verify": activity.facts_to_verify,
        "evidence_reference": activity.evidence_reference,
        "shared_summary": activity.shared_summary,
        "content_attribution": activity.content_attribution,
        "ai_review_status": activity.ai_review_status,
    }


def _ordered_activities(record: RecordSnapshot) -> tuple[ActivitySummarySource, ...]:
    return tuple(
        sorted(
            record.activities,
            key=lambda item: (
                item.activity.occurred_at,
                item.activity.recorded_at,
                str(item.activity.id),
            ),
            reverse=True,
        )
    )


def _concise_progress(record: RecordSnapshot) -> dict[str, date | str | bool | None]:
    ordered_activities = _ordered_activities(record)
    if not ordered_activities:
        return {
            "latest_follow_up_date": None,
            "latest_follow_up_method_category": None,
            "shared_summary": None,
            "has_next_action": False,
            "next_action_target_date": None,
        }

    latest = ordered_activities[0]
    activity = latest.activity
    return {
        "latest_follow_up_date": activity.occurred_at.date(),
        "latest_follow_up_method_category": latest.communication_method_category,
        "shared_summary": activity.shared_summary,
        "has_next_action": activity.next_action is not None,
        "next_action_target_date": activity.next_action_target_date,
    }


def _freeze_mapping(value: Mapping[str, Any]) -> Mapping[str, Any]:
    return MappingProxyType({key: _freeze_value(item) for key, item in value.items()})


def _freeze_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return _freeze_mapping(value)
    if isinstance(value, tuple):
        return tuple(_freeze_value(item) for item in value)
    if isinstance(value, list):
        return tuple(_freeze_value(item) for item in value)
    return value
