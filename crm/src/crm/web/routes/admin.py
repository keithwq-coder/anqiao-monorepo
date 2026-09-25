"""Management API routes for SPEC-0002 user, role, and ownership management.

TASK-0015: administrator-only role grant/revoke, user enable/disable, single
and batch ownership transfer, and read-only management summaries. All
mutating routes require the ADMINISTRATOR role; self-action is prohibited
(R-015). The management summary route allows ADMINISTRATOR and scoped
MANAGER roles (R-019/R-020, read-only per R-021).
"""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Request, Depends, HTTPException, status
from pydantic import BaseModel, Field

from crm.web.deps import get_current_user
from crm.domain.models import Role, UserStatus


router = APIRouter(prefix="/api/admin", tags=["administration"])


# ============ Pydantic request models ============


class GrantRoleRequest(BaseModel):
    target_user_id: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)
    scope_reference: str | None = None


class RevokeRoleRequest(BaseModel):
    target_user_id: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)
    scope_reference: str | None = None


class EnableUserRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class DisableUserRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: str = Field(..., min_length=1)
    # R-026: the administrator may assign without a reason; general managers
    # must supply one (enforced in the route).
    reason: str = Field(default="", max_length=1000)


class BatchTransferRequest(BaseModel):
    institution_ids: list[str] = Field(..., min_length=1)
    new_owner_user_id: str = Field(..., min_length=1)
    reason: str = Field(default="", max_length=1000)


class EraseInstitutionRequest(BaseModel):
    """SPEC-0011 §8: erasure requires explicit reason and confirmation.

    ``confirm`` must be ``true`` — the administrator's explicit confirmation
    that the operation is irreversible.
    ``is_request_fulfillment`` marks a当事人 deletion-request satisfaction (R-008).
    ``request_reference`` is an optional non-personal reference to the request.
    """
    reason: str = Field(..., min_length=1)
    confirm: bool = False
    is_request_fulfillment: bool = False
    request_reference: str | None = None


# ============ Authorization helpers ============


def _require_admin(user: dict) -> None:
    """R-006/R-015: only ADMINISTRATOR may perform management operations."""
    roles = frozenset(user.get("roles") or [])
    if Role.ADMINISTRATOR not in roles:
        raise HTTPException(status_code=403, detail="Administrator role required")


def _require_transfer_actor(user: dict) -> frozenset[Role]:
    """R-026 (SPEC-0002 v0.4.1): only administrator may
    点名分配 (assign ownership). Returns the actor's roles so the caller
    can enforce the reason rule."""
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")
    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    if Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        raise HTTPException(
            status_code=403,
            detail="Assignment requires administrator or shareholder role",
        )
    return roles


def _ensure_transfer_reason(roles: frozenset[Role], reason: str) -> None:
    """R-026: administrators may omit an assignment reason (auto-traced)."""
    return


def _require_management_viewer(user: dict) -> None:
    """R-019/R-020: ADMINISTRATOR or MANAGER may view summaries."""
    roles = frozenset(user.get("roles") or [])
    if Role.ADMINISTRATOR not in roles and Role.MANAGER not in roles:
        raise HTTPException(status_code=403, detail="Management role required")
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")


def _denied_if_self(user: dict, target_id: str) -> None:
    """R-015: user cannot perform management actions on themselves."""
    if user["id"] == target_id:
        raise HTTPException(status_code=403, detail="Cannot perform this action on yourself")


# ============ Role grant/revoke (R-005, R-015, AC-003) ============


@router.post("/roles/grant")
async def grant_role(
    request: Request,
    data: GrantRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Grant a role to a user. Administrator-only. Self-grant prohibited."""
    _require_admin(current_user)
    _denied_if_self(current_user, data.target_user_id)

    try:
        role = Role(data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    target_uid = UUID(data.target_user_id)
    actor_uid = UUID(current_user["id"])

    from crm.application.management_commands import GrantRoleCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = GrantRoleCommand(
        target_user_id=target_uid,
        role=role,
        granted_by_user_id=actor_uid,
        reason=data.reason,
        scope_reference=data.scope_reference,
    )
    try:
        result = cmd.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.post("/roles/revoke")
async def revoke_role(
    request: Request,
    data: RevokeRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Revoke a role from a user. Administrator-only. Self-revoke prohibited."""
    _require_admin(current_user)
    _denied_if_self(current_user, data.target_user_id)

    try:
        role = Role(data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    target_uid = UUID(data.target_user_id)
    actor_uid = UUID(current_user["id"])

    from crm.application.management_commands import RevokeRoleCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = RevokeRoleCommand(
        target_user_id=target_uid,
        role=role,
        revoked_by_user_id=actor_uid,
        reason=data.reason,
        scope_reference=data.scope_reference,
    )
    try:
        result = cmd.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


# ============ User enable/disable (R-004, R-005, R-014, AC-003/AC-004) ============


@router.post("/users/{user_id}/enable")
async def enable_user(
    request: Request,
    user_id: str,
    data: EnableUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """Enable a user account. Administrator-only. Self-enable prohibited."""
    _require_admin(current_user)
    _denied_if_self(current_user, user_id)

    target_uid = UUID(user_id)
    actor_uid = UUID(current_user["id"])

    from crm.application.management_commands import EnableUserCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = EnableUserCommand(
        target_user_id=target_uid,
        enabled_by_user_id=actor_uid,
        reason=data.reason,
    )
    try:
        result = cmd.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.post("/users/{user_id}/disable")
async def disable_user(
    request: Request,
    user_id: str,
    data: DisableUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """Disable a user account. Administrator-only. Self-disable prohibited.

    R-011: if the user owns institutions, the response includes
    owned_institution_ids as a prompt for outstanding responsibility.
    """
    _require_admin(current_user)
    _denied_if_self(current_user, user_id)

    target_uid = UUID(user_id)
    actor_uid = UUID(current_user["id"])

    # R-011: find institutions owned by the target user before disabling.
    # Use the app's session_factory (test-injectable) not SessionLocal.
    from crm.persistence.repositories import ManagementRepository
    from crm.persistence.database import transaction_session
    repo = ManagementRepository()
    factory = getattr(request.app.state, "session_factory", None)
    with transaction_session(factory) as s:
        owned_ids = repo.find_institutions_by_owner(session=s, owner_user_id=target_uid)

    from crm.application.management_commands import DisableUserCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = DisableUserCommand(
        target_user_id=target_uid,
        disabled_by_user_id=actor_uid,
        reason=data.reason,
        owned_institution_ids=owned_ids,
    )
    try:
        result = cmd.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="User not found")
    return result


# ============ Ownership transfer (R-009/R-010/R-011/R-012, AC-005/AC-006/AC-007) ============


@router.post("/institutions/{institution_id}/transfer")
async def transfer_ownership(
    request: Request,
    institution_id: str,
    data: TransferOwnershipRequest,
    current_user: dict = Depends(get_current_user),
):
    """Transfer ownership of a single institution. Administrator or general
    manager (R-026); general managers must supply a reason."""
    roles = _require_transfer_actor(current_user)
    _ensure_transfer_reason(roles, data.reason)

    inst_uid = UUID(institution_id)
    new_owner_uid = UUID(data.new_owner_user_id)
    actor_uid = UUID(current_user["id"])

    from crm.application.management_commands import TransferOwnershipCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = TransferOwnershipCommand(
        institution_id=inst_uid,
        new_owner_user_id=new_owner_uid,
        transferred_by_user_id=actor_uid,
        reason=data.reason,
    )
    try:
        result = cmd.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.post("/institutions/transfer-batch")
async def batch_transfer_ownership(
    request: Request,
    data: BatchTransferRequest,
    current_user: dict = Depends(get_current_user),
):
    """Batch transfer ownership of multiple institutions. Administrator or
    general manager (R-026); general managers must supply a reason."""
    roles = _require_transfer_actor(current_user)
    _ensure_transfer_reason(roles, data.reason)

    inst_uids = [UUID(i) for i in data.institution_ids]
    new_owner_uid = UUID(data.new_owner_user_id)
    actor_uid = UUID(current_user["id"])

    from crm.application.management_commands import BatchTransferOwnershipCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = BatchTransferOwnershipCommand(
        institution_ids=inst_uids,
        new_owner_user_id=new_owner_uid,
        transferred_by_user_id=actor_uid,
        reason=data.reason,
    )
    result = cmd.execute(factory)
    return result


# ============ Read-only management summary (R-019/R-020/R-021, AC-013/AC-014/AC-015) ============


@router.get("/summary")
async def management_summary(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Read-only management summary (R-019/R-020/R-021).

    ADMINISTRATOR sees company-wide summaries. Scoped MANAGER sees only
    records within their authorized scope. The summary uses the collaborator
    projection (masked) — no raw contact/source/factual_body (R-022/R-023).
    Read-only: no write capability (R-021/AC-015).
    """
    _require_management_viewer(current_user)

    roles = frozenset(Role(r) for r in (current_user.get("roles") or []))
    query_service = request.app.state.query_service
    summary = query_service.get_management_summary(
        user_id=UUID(current_user["id"]),
        user_status=current_user["status"],
        roles=roles,
        management_scope_keys=frozenset(current_user.get("management_scope_keys") or []),
    )
    return summary


# ============ Permanent erasure (SPEC-0011 R-003/R-004/R-005, AC-001/AC-002) ============


@router.post("/institutions/{institution_id}/erase")
async def erase_institution(
    request: Request,
    institution_id: str,
    data: EraseInstitutionRequest,
    current_user: dict = Depends(get_current_user),
):
    """Permanently erase personal data from an institution (SPEC-0011 R-003).

    Administrator-only. Requires explicit confirm=true (section 8). Irreversible:
    personal fields are blanked in-place; the original values are destroyed.
    An erasure_records row with propagate_by (erased_at + 30 days, DEC-0104)
    and an audit event (no personal values, R-004) are written in the same
    transaction.
    """
    _require_admin(current_user)

    # Section 8: explicit confirmation required.
    if not data.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required: set confirm=true to perform irreversible erasure")

    # DEC-0096: whitespace-only reason is treated as absent and rejected at
    # the boundary before any DB work (the erasure CHECK constraint would
    # otherwise crash with 500 after blanking personal fields in-transaction).
    if not (data.reason or "").strip():
        raise HTTPException(status_code=400, detail="Erasure reason is required and must not be blank")

    inst_uid = UUID(institution_id)
    actor_uid = UUID(current_user["id"])

    from crm.application.lifecycle_commands import EraseInstitutionCommand
    factory = getattr(request.app.state, "session_factory", None)
    cmd = EraseInstitutionCommand(
        institution_id=inst_uid,
        erased_by_user_id=actor_uid,
        reason=data.reason,
        is_request_fulfillment=data.is_request_fulfillment,
        request_reference=data.request_reference,
    )
    try:
        result = cmd.execute(factory)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Institution not found")
    return result
