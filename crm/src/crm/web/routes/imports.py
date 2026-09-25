"""TASK-0011 (SPEC-0013): administrator bulk-import API routes.

Administrator-only endpoints for running a CSV import batch, listing
batches, viewing a batch's per-row results, and conditionally undoing a
batch. Non-administrators are denied (AC-008). All writes require the
X-CSRF-Token synchronizer token (enforced by the CSRF middleware).
"""

from uuid import UUID
from fastapi import APIRouter, Request, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field

from crm.web.deps import get_current_user
from crm.domain.models import Role, UserStatus


router = APIRouter(prefix="/api/imports", tags=["bulk-import"])


# ============ Authorization ============


def _require_admin(user: dict) -> None:
    """R-001/OD-002/AC-008: only an enabled ADMINISTRATOR may import."""
    roles = frozenset(user.get("roles") or [])
    if Role.ADMINISTRATOR not in roles:
        raise HTTPException(status_code=403, detail="Administrator role required")
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")


# ============ Response models ============


class RowResultResponse(BaseModel):
    line_number: int
    outcome: str
    institution_id: str | None = None
    duplicate_of_institution_id: str | None = None
    reason: str | None = None


class ImportBatchResponse(BaseModel):
    batch_id: str
    source_file_name: str
    row_count: int
    imported_count: int
    duplicate_count: int
    failed_count: int
    idempotent_replay: bool
    row_results: list[RowResultResponse] = Field(default_factory=list)


class BatchSummaryResponse(BaseModel):
    batch_id: str
    source_file_name: str
    status: str
    row_count: int
    imported_count: int
    duplicate_count: int
    failed_count: int
    imported_at: str
    undone_at: str | None = None


class UndoRequest(BaseModel):
    undo_reason: str = Field(..., min_length=1)


class UndoResponse(BaseModel):
    batch_id: str
    undone: bool
    undone_at: str
    undo_reason: str
    undone_count: int
    excluded_count: int
    excluded: list


# ============ Routes ============


def _row_result_to_response(m) -> RowResultResponse:
    return RowResultResponse(
        line_number=m.line_number,
        outcome=m.outcome,
        institution_id=str(m.institution_id) if m.institution_id else None,
        duplicate_of_institution_id=(
            str(m.duplicate_of_institution_id) if m.duplicate_of_institution_id else None
        ),
        reason=m.reason,
    )


@router.post("/batches", response_model=ImportBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_import_batch(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Run one administrator import batch (SPEC-0013 R-001).

    Accepts a multipart CSV upload. Idempotent on file-content fingerprint
    (AC-004): re-uploading the same bytes returns the existing batch.
    """
    _require_admin(current_user)

    content = await file.read()
    source_file_name = file.filename or "upload.csv"
    actor_uid = UUID(current_user["id"])

    from crm.persistence.repositories import ImportBatchService, ImportValidationError
    factory = getattr(request.app.state, "session_factory", None)
    service = ImportBatchService()
    try:
        result = service.run(
            imported_by_user_id=actor_uid,
            source_file_name=source_file_name,
            source_file_content=content,
            session_factory=factory,
        )
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Audit the import attempt (success). The audit carries no personal
    # values beyond what SPEC-0001 already permits (file name + counts).
    audit_repo = getattr(request.app.state, "audit_repository", None)
    if audit_repo is not None:
        audit_repo.record(
            action="import.batch.run",
            outcome="success",
            target_type="import_batch",
            target_id=result.batch_id,
            actor_user_id=actor_uid,
            reason=f"{source_file_name}: {result.imported_count}/{result.row_count} imported",
        )

    return ImportBatchResponse(
        batch_id=str(result.batch_id),
        source_file_name=result.source_file_name,
        row_count=result.row_count,
        imported_count=result.imported_count,
        duplicate_count=result.duplicate_count,
        failed_count=result.failed_count,
        idempotent_replay=result.idempotent_replay,
        row_results=[
            RowResultResponse(
                line_number=r.line_number,
                outcome=r.outcome,
                institution_id=str(r.institution_id) if r.institution_id else None,
                duplicate_of_institution_id=(
                    str(r.duplicate_of_institution_id) if r.duplicate_of_institution_id else None
                ),
                reason=r.reason,
            )
            for r in result.row_results
        ],
    )


@router.get("/batches", response_model=list[BatchSummaryResponse])
async def list_import_batches(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """List all import batches (administrator review surface)."""
    _require_admin(current_user)

    import sqlalchemy as sa
    from crm.persistence.models import ImportBatchModel
    from crm.persistence.database import transaction_session

    factory = getattr(request.app.state, "session_factory", None)
    summaries: list = []
    with transaction_session(factory) as session:
        models = session.execute(
            sa.select(ImportBatchModel).order_by(ImportBatchModel.imported_at.desc())
        ).scalars().all()
        for m in models:
            summaries.append(
                BatchSummaryResponse(
                    batch_id=str(m.id),
                    source_file_name=m.source_file_name,
                    status=m.status,
                    row_count=m.row_count,
                    imported_count=m.imported_count,
                    duplicate_count=m.duplicate_count,
                    failed_count=m.failed_count,
                    imported_at=m.imported_at.isoformat(),
                    undone_at=m.undone_at.isoformat() if m.undone_at else None,
                )
            )
    return summaries


@router.get("/batches/{batch_id}", response_model=ImportBatchResponse)
async def get_import_batch(
    request: Request,
    batch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """View one batch and its per-row results (review surface)."""
    _require_admin(current_user)

    import sqlalchemy as sa
    from crm.persistence.models import ImportBatchModel
    from crm.persistence.repositories import ImportBatchRepository
    from crm.persistence.database import transaction_session

    try:
        bid = UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch id")

    factory = getattr(request.app.state, "session_factory", None)
    with transaction_session(factory) as session:
        batch = session.get(ImportBatchModel, bid)
        if batch is None:
            raise HTTPException(status_code=404, detail="Import batch not found")
        repo = ImportBatchRepository()
        row_models = repo.list_row_results(session=session, batch_id=bid)

    return ImportBatchResponse(
        batch_id=str(batch.id),
        source_file_name=batch.source_file_name,
        row_count=batch.row_count,
        imported_count=batch.imported_count,
        duplicate_count=batch.duplicate_count,
        failed_count=batch.failed_count,
        idempotent_replay=False,
        row_results=[_row_result_to_response(m) for m in row_models],
    )


@router.post("/batches/{batch_id}/undo", response_model=UndoResponse)
async def undo_import_batch(
    request: Request,
    batch_id: str,
    data: UndoRequest,
    current_user: dict = Depends(get_current_user),
):
    """Conditionally undo an import batch (SPEC-0013 R-006, AC-005/AC-006).

    Only records not modified since import are eligible. Ineligible records
    are excluded and reported. Fail-closed on any post-import modification.
    """
    _require_admin(current_user)

    # DEC-0096: whitespace-only reason is rejected before any DB work.
    if not (data.undo_reason or "").strip():
        raise HTTPException(status_code=400, detail="Undo reason is required and must not be blank")

    try:
        bid = UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch id")

    actor_uid = UUID(current_user["id"])
    from crm.persistence.repositories import ImportBatchService
    factory = getattr(request.app.state, "session_factory", None)
    service = ImportBatchService()
    try:
        result = service.undo(
            batch_id=bid,
            undone_by_user_id=actor_uid,
            undo_reason=data.undo_reason,
            session_factory=factory,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Audit the undo (success). No personal values.
    audit_repo = getattr(request.app.state, "audit_repository", None)
    if audit_repo is not None:
        audit_repo.record(
            action="import.batch.undo",
            outcome="success",
            target_type="import_batch",
            target_id=bid,
            actor_user_id=actor_uid,
            reason=f"{data.undo_reason}: {result['undone_count']} undone, {result['excluded_count']} excluded",
        )

    return UndoResponse(**result)
