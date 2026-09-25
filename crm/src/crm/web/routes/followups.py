"""Contact and follow-up activity creation endpoints (S5 web layer).

Both creation endpoints enforce explicit owner-write authorization: the target
institution is loaded and its ``owner_user_id`` is compared against the
authenticated caller before any write (SPEC-0001 R-026/R-027; TASK-0001 card
line 339: owner write, other business user read-only, default deny). Denial is
404 so the response does not disclose whether the institution exists (card
line 338: no existence leakage). The creation responses return the caller's
own input; read paths (page and API) go through the central policy projection.
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from crm.application.commands import (
    AddContactToInstitutionCommand,
    CorrectFollowUpActivityCommand,
    CreateFollowUpActivityCommand,
    WithdrawFollowUpActivityCommand,
)
from crm.application.queries import ActivityDetail, ContactDetail
from crm.domain.models import (
    ContactabilityStatus,
    ContentAttribution,
    Role,
    UserStatus,
    split_stored_interaction_method,
)
from crm.web.deps import get_current_user


router = APIRouter(prefix="/api/institutions", tags=["followups"])


def _denied_if_not_business_writer(user: dict) -> HTTPException | None:
    """SPEC-0002 R-003/R-006: only enabled users with an explicit business
    or administrator role may write. Management is read-only (R-021);
    no-role defaults to deny. Returns an HTTPException to raise or None.
    """
    if user.get("status") != UserStatus.ENABLED.value:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not enabled")
    roles = frozenset(user.get("roles") or [])
    if Role.BUSINESS_USER not in roles and Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write requires a business role")
    return None


# ============ Pydantic Models ============


class AddContactRequest(BaseModel):
    """Request body for adding a contact (SPEC-0001 R-026).

    ``confirm_duplicate`` must be true to create when R-035 duplicate
    candidates were found; the default is to refuse creation.
    """

    contactability_status: ContactabilityStatus
    idempotency_key: str = Field(..., min_length=1, max_length=128)
    name: Optional[str] = Field(None, max_length=120)
    role_label: Optional[str] = Field(None, max_length=120)
    job_title: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=254)
    wechat: Optional[str] = Field(None, max_length=120)
    other_channel: Optional[str] = Field(None, max_length=120)
    channel_notes: Optional[str] = Field(None, max_length=1000)
    confirm_duplicate: bool = False


class AddActivityRequest(BaseModel):
    """Request body for appending a follow-up activity (SPEC-0001 R-027)."""

    occurred_at: datetime
    interaction_method: str = Field(..., min_length=1, max_length=80)
    communication_method_category: Optional[str] = None
    factual_body: str = Field(..., min_length=1)
    idempotency_key: str = Field(..., min_length=1, max_length=128)
    participants: Optional[str] = Field(None, max_length=2000)
    customer_needs: Optional[str] = Field(None, max_length=2000)
    decision_participants: Optional[str] = Field(None, max_length=2000)
    objections_constraints: Optional[str] = Field(None, max_length=2000)
    commitments: Optional[str] = Field(None, max_length=2000)
    next_action: Optional[str] = Field(None, max_length=2000)
    next_action_owner_user_id: Optional[str] = None
    next_action_target_date: Optional[date] = None
    facts_to_verify: Optional[str] = Field(None, max_length=2000)
    evidence_reference: Optional[str] = Field(None, max_length=2000)
    shared_summary: Optional[str] = Field(None, max_length=1000)
    content_attribution: ContentAttribution = ContentAttribution.SALESPERSON_INPUT


class CorrectActivityRequest(BaseModel):
    """Request body for correcting a follow-up activity (SPEC-0001 R-031).

    The corrected content replaces the current version's detail by appending a
    new revision; the prior revision stays readable and auditable.
    """

    change_reason: str = Field(..., min_length=1, max_length=1000)
    factual_body: str = Field(..., min_length=1)
    participants: Optional[str] = Field(None, max_length=2000)
    customer_needs: Optional[str] = Field(None, max_length=2000)
    decision_participants: Optional[str] = Field(None, max_length=2000)
    objections_constraints: Optional[str] = Field(None, max_length=2000)
    commitments: Optional[str] = Field(None, max_length=2000)
    next_action: Optional[str] = Field(None, max_length=2000)
    next_action_owner_user_id: Optional[str] = None
    next_action_target_date: Optional[date] = None
    facts_to_verify: Optional[str] = Field(None, max_length=2000)
    evidence_reference: Optional[str] = Field(None, max_length=2000)
    shared_summary: Optional[str] = Field(None, max_length=1000)
    content_attribution: ContentAttribution = ContentAttribution.SALESPERSON_INPUT


class WithdrawActivityRequest(BaseModel):
    """Request body for withdrawing a follow-up activity (SPEC-0001 R-031)."""

    withdrawal_reason: str = Field(..., min_length=1, max_length=1000)


# ============ Routes ============
@router.post(
    "/{institution_id}/contacts",
    response_model=ContactDetail,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact(
    request: Request,
    institution_id: str,
    data: AddContactRequest,
    current_user: dict = Depends(get_current_user),
):
    """Add a subordinate contact to an institution (SPEC-0001 R-026)."""
    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _denied_if_not_business_writer(current_user)
    if denied is not None:
        raise denied

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid institution id")

    # Owner-write authorization (default deny; 404 to avoid existence leakage).
    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None or institution.owner_user_id != UUID(current_user["id"]):
        raise HTTPException(status_code=404, detail="Institution not found")

    # R-035 duplicate suspicion: same institution + same non-empty channel
    # value (phone / email / wechat, exact normalized match). Refuse to create
    # unless explicitly confirmed; no auto-merge (AC-028).
    duplicates = request.app.state.query_service.detect_duplicate_contacts(
        inst_uuid,
        phone=data.phone,
        email=data.email,
        wechat=data.wechat,
        user_id=UUID(current_user["id"]),
        user_status=current_user["status"],
        roles=frozenset(current_user.get("roles") or []),
        management_scope_keys=frozenset(current_user.get("management_scope_keys") or []),
    )
    if duplicates and not data.confirm_duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "duplicates_found": True,
                "confirm_required": True,
                "duplicates": duplicates,
                "message": "Possible duplicate contact found; set confirm_duplicate=true to create anyway",
            },
        )

    command = AddContactToInstitutionCommand(
        institution_id=inst_uuid,
        created_by_user_id=UUID(current_user["id"]),
        contactability_status=data.contactability_status,
        idempotency_key=data.idempotency_key,
        name=data.name,
        role_label=data.role_label,
        job_title=data.job_title,
        phone=data.phone,
        email=data.email,
        wechat=data.wechat,
        other_channel=data.other_channel,
        channel_notes=data.channel_notes,
    )
    valid, errors = command.validate(None)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation failed: " + "; ".join(errors),
        )

    contact = command.execute(request.app.state.contact_repository)
    return ContactDetail(
        id=contact.id,
        name=contact.name,
        role_label=contact.role_label,
        job_title=contact.job_title,
        phone=contact.phone,
        email=contact.email,
        wechat=contact.wechat,
        other_channel=contact.other_channel,
        channel_notes=contact.channel_notes,
        contactability_status=contact.contactability_status.value,
        institution_id=contact.institution_id,
        created_at=contact.created_at.isoformat(),
        updated_at=contact.updated_at.isoformat(),
    )


@router.post(
    "/{institution_id}/activities",
    response_model=ActivityDetail,
    status_code=status.HTTP_201_CREATED,
)
async def add_activity(
    request: Request,
    institution_id: str,
    data: AddActivityRequest,
    current_user: dict = Depends(get_current_user),
):
    """Append a follow-up activity (SPEC-0001 R-027/R-028)."""
    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _denied_if_not_business_writer(current_user)
    if denied is not None:
        raise denied

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid institution id")

    # Owner-write authorization (default deny; 404 to avoid existence leakage).
    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None or institution.owner_user_id != UUID(current_user["id"]):
        raise HTTPException(status_code=404, detail="Institution not found")

    next_action_owner = (
        UUID(data.next_action_owner_user_id)
        if data.next_action_owner_user_id
        else None
    )
    command = CreateFollowUpActivityCommand(
        institution_id=inst_uuid,
        recorded_by_user_id=UUID(current_user["id"]),
        occurred_at=data.occurred_at,
        interaction_method=data.interaction_method,
        communication_method_category=data.communication_method_category,
        factual_body=data.factual_body,
        idempotency_key=data.idempotency_key,
        participants=data.participants,
        customer_needs=data.customer_needs,
        decision_participants=data.decision_participants,
        objections_constraints=data.objections_constraints,
        commitments=data.commitments,
        next_action=data.next_action,
        next_action_owner_user_id=next_action_owner,
        next_action_target_date=data.next_action_target_date,
        facts_to_verify=data.facts_to_verify,
        evidence_reference=data.evidence_reference,
        shared_summary=data.shared_summary,
        content_attribution=data.content_attribution,
    )
    valid, errors = command.validate(None)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation failed: " + "; ".join(errors),
        )

    activity = command.execute(request.app.state.activity_repository)
    _, display_method = split_stored_interaction_method(activity.interaction_method)
    return ActivityDetail(
        id=activity.id,
        occurred_at=activity.occurred_at.isoformat(),
        interaction_method=display_method,
        factual_body=activity.factual_body,
        participants=activity.participants,
        customer_needs=activity.customer_needs,
        decision_participants=activity.decision_participants,
        objections_constraints=activity.objections_constraints,
        commitments=activity.commitments,
        next_action=activity.next_action,
        facts_to_verify=activity.facts_to_verify,
        evidence_reference=activity.evidence_reference,
        shared_summary=activity.shared_summary,
        content_attribution=activity.content_attribution.value,
        ai_review_status=activity.ai_review_status.value,
        recorded_at=activity.recorded_at.isoformat(),
    )


# ============ R-031 correction / withdrawal (owner path) ============

@router.post(
    "/{institution_id}/activities/{activity_id}/correct",
    response_model=ActivityDetail,
)
async def correct_activity(
    request: Request,
    institution_id: str,
    activity_id: str,
    data: CorrectActivityRequest,
    current_user: dict = Depends(get_current_user),
):
    """Append a corrected version of a follow-up activity (SPEC-0001 R-031).

    Owner-only: a non-owner gets 404 before any write. The new revision and
    the audit event commit in one transaction; the prior revision remains
    readable and auditable (AC-025).
    """
    try:
        inst_uuid = UUID(institution_id)
        act_uuid = UUID(activity_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")

    # Owner-write authorization (default deny; 404 to avoid existence leakage).
    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None or institution.owner_user_id != UUID(current_user["id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")

    # The activity must belong to this institution (no cross-record correction).
    activity = request.app.state.activity_repository.find_by_id(act_uuid)
    if activity is None or activity.institution_id != inst_uuid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    next_action_owner = (
        UUID(data.next_action_owner_user_id)
        if data.next_action_owner_user_id
        else None
    )
    command = CorrectFollowUpActivityCommand(
        activity_id=act_uuid,
        corrected_by_user_id=UUID(current_user["id"]),
        change_reason=data.change_reason,
        factual_body=data.factual_body,
        participants=data.participants,
        customer_needs=data.customer_needs,
        decision_participants=data.decision_participants,
        objections_constraints=data.objections_constraints,
        commitments=data.commitments,
        next_action=data.next_action,
        next_action_owner_user_id=next_action_owner,
        next_action_target_date=data.next_action_target_date,
        facts_to_verify=data.facts_to_verify,
        evidence_reference=data.evidence_reference,
        shared_summary=data.shared_summary,
        content_attribution=data.content_attribution,
    )
    valid, errors = command.validate(None)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation failed: " + "; ".join(errors),
        )

    try:
        factory = getattr(request.app.state, "session_factory", None)
        updated = command.execute(
            request.app.state.activity_repository,
            request.app.state.audit_repository,
            factory,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return ActivityDetail(
        id=updated.id,
        occurred_at=updated.occurred_at.isoformat(),
        interaction_method=split_stored_interaction_method(updated.interaction_method)[1],
        factual_body=updated.factual_body,
        participants=updated.participants,
        customer_needs=updated.customer_needs,
        decision_participants=updated.decision_participants,
        objections_constraints=updated.objections_constraints,
        commitments=updated.commitments,
        next_action=updated.next_action,
        facts_to_verify=updated.facts_to_verify,
        evidence_reference=updated.evidence_reference,
        shared_summary=updated.shared_summary,
        content_attribution=updated.content_attribution.value,
        ai_review_status=updated.ai_review_status.value,
        recorded_at=updated.recorded_at.isoformat(),
    )


@router.post(
    "/{institution_id}/activities/{activity_id}/withdraw",
)
async def withdraw_activity(
    request: Request,
    institution_id: str,
    activity_id: str,
    data: WithdrawActivityRequest,
    current_user: dict = Depends(get_current_user),
):
    """Withdraw a follow-up activity, keeping the row and audit history (R-031).

    Owner-only: a non-owner gets 404 before any write. The withdrawal triple
    and the audit event commit in one transaction; the row is never deleted.
    """
    try:
        inst_uuid = UUID(institution_id)
        act_uuid = UUID(activity_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")

    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None or institution.owner_user_id != UUID(current_user["id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")

    activity = request.app.state.activity_repository.find_by_id(act_uuid)
    if activity is None or activity.institution_id != inst_uuid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    command = WithdrawFollowUpActivityCommand(
        activity_id=act_uuid,
        withdrawn_by_user_id=UUID(current_user["id"]),
        withdrawal_reason=data.withdrawal_reason,
    )
    valid, errors = command.validate(None)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation failed: " + "; ".join(errors),
        )

    try:
        factory = getattr(request.app.state, "session_factory", None)
        result = command.execute(
            request.app.state.activity_repository,
            request.app.state.audit_repository,
            factory,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return result
