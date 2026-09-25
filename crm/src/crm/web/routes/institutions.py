"""Institution CRUD API routes."""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Request, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

# Import from shared deps module to avoid circular import
from crm.web.deps import get_current_user_optional, get_current_user
from crm.application.commands import ArchiveInstitutionCommand, CreateInstitutionCommand
from crm.application.queries import InstitutionSummary, InstitutionDetail, QueryService
from crm.domain.models import Role, UserStatus


router = APIRouter(prefix="/api/institutions", tags=["institutions"])


# ============ Pydantic Models ============

class InstitutionCreateRequest(BaseModel):
    """Request body for creating an institution.

    Fields aligned with S2/S3 domain model - no industry/address/tags.
    ``confirm_duplicate`` must be true to create when R-035 duplicate
    candidates were found; the default is to refuse creation.
    ``customer_type`` (R-037) defaults to ``direct_purchase`` for legacy
    clients; the domain always stores one of the three approved labels.
    """
    name: str = Field(..., min_length=2, max_length=500)
    source_description: str = Field(..., min_length=1, max_length=None)
    customer_type: str | None = Field(None, max_length=32)
    category: str | None = Field(None, max_length=120)
    region: str | None = Field(None, max_length=160)
    source_kind: str | None = Field(None, max_length=64)
    source_evidence_reference: str | None = Field(None, max_length=None)
    idempotency_key: str = Field(..., min_length=1, max_length=128)
    confirm_duplicate: bool = False


class InstitutionListResponse(BaseModel):
    """Paginated list of institutions."""
    items: list[InstitutionSummary]
    total: int
    limit: int
    offset: int


class ArchiveInstitutionRequest(BaseModel):
    """Request body for archiving an institution (SPEC-0001 R-031/R-036).

    Archive is administrator-only. Per SPEC-0002 v0.4.0 R-008, the
    administrator may archive without a reason (auto-traced); the
    ``archive_reason`` is an optional persistence field.
    """

    archive_reason: str = Field(default="", max_length=1000)


# ============ Helper Functions ============


def _get_query_service(request: Request) -> QueryService:
    """FastAPI dependency: resolve the application's QueryService from state."""
    return request.app.state.query_service


def _denied_if_not_business_writer(user: dict) -> HTTPException | None:
    """SPEC-0002 R-003/R-006: only enabled users with an explicit business
    or administrator role may write. Management roles are read-only
    (R-021); no-role defaults to deny. Returns an HTTPException to raise
    or None when the caller is allowed.
    """
    if user.get("status") != UserStatus.ENABLED.value:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not enabled")
    roles = frozenset(user.get("roles") or [])
    if Role.BUSINESS_USER not in roles and Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write requires a business role")
    return None


# ============ Routes ============

@router.post("", response_model=InstitutionDetail, status_code=status.HTTP_201_CREATED)
async def create_institution(
    request: Request,
    data: InstitutionCreateRequest,
    current_user: dict = Depends(get_current_user),
    query_service: QueryService = Depends(_get_query_service)
):
    """
    Create a new institution record.
    
    Uses S4 command pattern aligned with domain model.
    Fields: name, source_description, idempotency_key required.
    """
    # SPEC-0002 R-003/R-006: write requires an enabled account with an
    # explicit business or administrator role. Management is read-only (R-021).
    denied = _denied_if_not_business_writer(current_user)
    if denied is not None:
        raise denied

    # R-035 duplicate suspicion: exact normalized-name match against existing
    # non-archived institutions. Refuse to create unless explicitly confirmed
    # (no auto-merge, no silent dedup). Only candidates the caller may see are
    # listed (project_record), so no protected detail leaks (AC-028).
    duplicates = query_service.detect_duplicate_institutions(
        name=data.name,
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
                "message": "Possible duplicate institution found; set confirm_duplicate=true to create anyway",
            },
        )
    
    # Execute S4 command (command contract requires UUID ids; the identity
    # context stores them as strings). R-037: customer_type defaults to
    # direct_purchase for legacy clients; an invalid label is a 422.
    from crm.domain.models import CustomerType

    try:
        customer_type = (
            CustomerType(data.customer_type)
            if data.customer_type
            else CustomerType.DIRECT_PURCHASE
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="customer_type must be one of direct_purchase/individual/channel",
        )

    command = CreateInstitutionCommand(
        name=data.name,
        source_description=data.source_description,
        owner_user_id=UUID(current_user["id"]),
        created_by_user_id=UUID(current_user["id"]),
        idempotency_key=data.idempotency_key,
        customer_type=customer_type,
        category=data.category,
        region=data.region,
        source_kind=data.source_kind,
        source_evidence_reference=data.source_evidence_reference
    )
    
    # Validate command with actual user object
    valid, errors = command.validate(None)  # Will check auth via get_current_user
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed: {'; '.join(errors)}"
        )
    
    # Execute command
    try:
        institution_repo = request.app.state.institution_repository
        institution = command.execute(institution_repo)
        
        # Use proper policy-based query with the caller's real roles
        detail = query_service.get_institution_detail(
            institution_id=institution.id,
            user_id=UUID(current_user["id"]),
            user_status=current_user["status"],
            roles=frozenset(current_user.get("roles") or []),
            management_scope_keys=frozenset(current_user.get("management_scope_keys") or []),
        )
        
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created institution"
            )
        
        return detail
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=InstitutionListResponse)
async def list_institutions(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
    administrator_reason: str | None = Query(None),
    current_user_data: dict | None = Depends(get_current_user_optional),
    query_service: QueryService = Depends(_get_query_service)
):
    """
    List institutions with pagination.
    
    Access control applied automatically by QueryService via policy projection.
    ``administrator_reason`` (SPEC-0002 v0.4.0 R-008): optional trace value.
    The administrator reads every record in full detail without a reason; when
    a reason is supplied, each returned record is audited with actor/target/
    reason.
    """
    from crm.domain.models import Role
    
    # Re-get user (for type safety)
    user = current_user_data
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Calculate offset
    offset = (page - 1) * limit
    
    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    # R-015: normalize the reason so whitespace-only is treated as omitted.
    from crm.application.queries import _normalize_reason
    normalized_reason = _normalize_reason(administrator_reason)
    is_admin_exception = (
        normalized_reason is not None and Role.ADMINISTRATOR in roles
    )

    # Fetch paginated results with policy masking and search
    institutions = query_service.find_institutions(
        user_id=UUID(user["id"]),
        user_status=user["status"],
        roles=roles,
        management_scope_keys=frozenset(user.get("management_scope_keys") or []),
        search_terms=q,
        limit=limit,
        offset=offset,
        administrator_reason=normalized_reason,
    )

    # Audited exception read (R-015): record every visible target when the
    # administrator-exception view was used.
    if is_admin_exception and institutions:
        audit_repo = request.app.state.audit_repository
        for inst in institutions:
            audit_repo.record(
                action="admin.exception_read",
                outcome="success",
                target_type="institution",
                target_id=inst.id,
                actor_user_id=UUID(user["id"]),
                reason=normalized_reason,
            )
    
    # Get total count via policy projection count
    total = query_service.count_visible_institutions(
        user_id=UUID(user["id"]),
        user_status=user["status"],
        roles=roles,
        management_scope_keys=frozenset(user.get("management_scope_keys") or []),
    )
    
    return InstitutionListResponse(
        items=institutions,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/{institution_id}", response_model=InstitutionDetail)
async def get_institution(
    request: Request,
    institution_id: str,
    administrator_reason: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    query_service: QueryService = Depends(_get_query_service)
):
    """
    Get detailed information about a specific institution.
    
    **Field Masking:**
    Applied automatically by QueryService via project_record() policy.
    ``administrator_reason`` (SPEC-0002 v0.4.0 R-008): optional trace value.
    The administrator reads full detail without a reason; when a reason is
    supplied, an ``admin.exception_read`` audit event is written with
    actor/target/time/reason.
    """
    from crm.domain.models import Role

    roles = frozenset(Role(role) for role in (current_user.get("roles") or []))
    # R-015: normalize the reason so whitespace-only is treated as omitted.
    from crm.application.queries import _normalize_reason
    normalized_reason = _normalize_reason(administrator_reason)
    is_admin_exception = (
        normalized_reason is not None and Role.ADMINISTRATOR in roles
    )

    detail = query_service.get_institution_detail(
        institution_id=UUID(institution_id),
        user_id=UUID(current_user["id"]),
        user_status=current_user["status"],
        roles=roles,
        management_scope_keys=frozenset(current_user.get("management_scope_keys") or []),
        administrator_reason=normalized_reason,
    )

    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution not found or access denied"
        )

    # Audited exception read (R-015): record the access after a successful
    # administrator-exception projection.
    if is_admin_exception:
        request.app.state.audit_repository.record(
            action="admin.exception_read",
            outcome="success",
            target_type="institution",
            target_id=UUID(institution_id),
            actor_user_id=UUID(current_user["id"]),
            reason=normalized_reason,
        )
    
    return detail


@router.post("/{institution_id}/archive")
async def archive_institution(
    request: Request,
    institution_id: str,
    data: ArchiveInstitutionRequest,
    current_user: dict = Depends(get_current_user),
):
    """Archive an institution record (SPEC-0001 R-031/R-036, owner path).

    Owner-only: a non-owner gets 404 before any write. The archive pair
    (``archived_at`` + ``archive_reason``) and the audit event commit in one
    transaction; the record is never deleted.
    """
    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")

    roles = frozenset(Role(role) for role in (current_user.get("roles") or []))
    # R-008 (SPEC-0002 v0.4.0): the administrator may archive without a
    # reason (auto-traced); archive_reason is an optional persistence field.
    # A non-administrator — even the owner — gets a non-disclosing 404.
    if Role.ADMINISTRATOR not in roles:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")

    # The target record must exist (checked after the authorization gate so
    # denial does not disclose existence).
    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")

    command = ArchiveInstitutionCommand(
        institution_id=inst_uuid,
        archived_by_user_id=UUID(current_user["id"]),
        archive_reason=data.archive_reason,
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
            request.app.state.institution_repository,
            request.app.state.audit_repository,
            factory,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return result


# ============ Public pool (SPEC-0001 v0.8.0 R-040..R-045) ============


class ReleaseToPoolRequest(BaseModel):
    """R-041: releasing a customer to the pool requires a reason."""

    reason: str = Field(..., min_length=1, max_length=1000)


@router.post("/{institution_id}/release-to-pool")
async def release_to_pool(
    request: Request,
    institution_id: str,
    data: ReleaseToPoolRequest,
    current_user: dict = Depends(get_current_user),
):
    """Release a customer to the public pool (R-041). Administrator or
    general manager only; the reason is required; owner history + audit are
    written in one transaction."""
    from crm.application.management_commands import ReleaseToPoolCommand

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")

    if current_user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not enabled")
    roles = frozenset(Role(role) for role in (current_user.get("roles") or []))
    if Role.ADMINISTRATOR not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Release to pool requires administrator role",
        )

    command = ReleaseToPoolCommand(
        institution_id=inst_uuid,
        released_by_user_id=UUID(current_user["id"]),
        reason=data.reason,
    )
    try:
        factory = getattr(request.app.state, "session_factory", None)
        result = command.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return result


@router.post("/{institution_id}/claim")
async def claim_from_pool(
    request: Request,
    institution_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Claim a pool customer (R-043). business_user only; the claimant
    becomes the owner; owner history + audit are written in one transaction.
    R-044: admin/gm do not claim — they use 点名分配 (transfer) instead."""
    from crm.application.management_commands import ClaimFromPoolCommand

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")

    if current_user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not enabled")
    roles = frozenset(Role(role) for role in (current_user.get("roles") or []))
    if Role.BUSINESS_USER not in roles or Role.ADMINISTRATOR in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Claim requires a business user role",
        )

    command = ClaimFromPoolCommand(
        institution_id=inst_uuid,
        claimant_user_id=UUID(current_user["id"]),
    )
    try:
        factory = getattr(request.app.state, "session_factory", None)
        result = command.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return result


class ChangeCustomerTypeRequest(BaseModel):
    """R-039a: change a customer's type (three approved labels only)."""

    customer_type: str = Field(..., min_length=1, max_length=32)


@router.post("/{institution_id}/customer-type")
async def change_customer_type(
    request: Request,
    institution_id: str,
    data: ChangeCustomerTypeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change a customer's type (R-039a). The type is a pure label; the
    change is auto-traced (who/when/from/to). The owner or an administrator
    may change it; other business users are read-only."""
    from crm.application.commands import ChangeCustomerTypeCommand
    from crm.domain.models import CustomerType

    try:
        inst_uuid = UUID(institution_id)
        new_type = CustomerType(data.customer_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid id or customer_type",
        )

    if current_user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not enabled")

    # R-036/R-039a: the owner maintains their own customer's type; the
    # administrator may modify any record (R-008).
    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")
    roles = frozenset(Role(role) for role in (current_user.get("roles") or []))
    is_owner = institution.owner_user_id == UUID(current_user["id"])
    if not (is_owner or Role.ADMINISTRATOR in roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner or an administrator may change the customer type",
        )

    command = ChangeCustomerTypeCommand(
        institution_id=inst_uuid,
        changed_by_user_id=UUID(current_user["id"]),
        new_customer_type=new_type,
    )
    try:
        factory = getattr(request.app.state, "session_factory", None)
        result = command.execute(
            request.app.state.institution_repository,
            request.app.state.audit_repository,
            factory,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return result


@router.post("/{institution_id}/change-custodian")
async def change_custodian(
    request: Request,
    institution_id: str,
    current_user: dict = Depends(get_current_user),
):
    """SPEC-0002 v0.5.0 R-031: change the custodian (管理人) of an institution."""
    from crm.persistence.database import transaction_session
    from crm.persistence.models import InstitutionModel, AuditEventModel
    from crm.domain.models import Role

    denied = _denied_if_not_business_writer(current_user)
    if denied is not None:
        raise denied

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Institution not found")

    body = await request.json()
    custodian_raw = body.get("custodian_user_id")
    new_custodian: UUID | None = None
    if custodian_raw is not None:
        try:
            new_custodian = UUID(custodian_raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid custodian_user_id")

    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(status_code=500, detail="Database session factory not available")

    with transaction_session(factory) as session:
        inst = session.get(InstitutionModel, inst_uuid)
        if inst is None:
            raise HTTPException(status_code=404, detail="Institution not found")

        user_id = UUID(current_user["id"])
        roles = frozenset(current_user.get("roles") or [])
        is_admin = Role.ADMINISTRATOR in roles
        is_shareholder = Role.SHAREHOLDER in roles
        is_owner = inst.owner_user_id == user_id
        is_custodian = inst.custodian_user_id == user_id
        if not (is_owner or is_custodian or is_admin or is_shareholder):
            raise HTTPException(status_code=403, detail="Only owner, custodian, or administrator may change custodian")

        old = inst.custodian_user_id
        if old == new_custodian:
            return {"changed": False, "custodian_user_id": str(old) if old else None}

        inst.custodian_user_id = new_custodian
        session.add(AuditEventModel(
            actor_user_id=user_id,
            action="custodian.change",
            target_type="institution",
            target_id=inst_uuid,
            outcome="success",
            reason="管理人变更",
            before_state={"custodian_user_id": str(old) if old else None},
            after_state={"custodian_user_id": str(new_custodian) if new_custodian else None},
        ))
        return {"changed": True, "custodian_user_id": str(new_custodian) if new_custodian else None}

