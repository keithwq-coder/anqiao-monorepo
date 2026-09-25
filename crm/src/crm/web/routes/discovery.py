"""SPEC-0003 v0.4.0 opportunity candidate API routes."""

import threading
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from crm.domain.models import Role, UserStatus
from crm.web.deps import get_current_user

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


def _require_discovery_recipient(user: dict) -> None:
    """Only enabled business users and administrators receive reminders.

    Management stays read-only and gets no discovery view (OD-004/R-011);
    users without a business role are denied (default-deny, R-006).
    """
    roles = frozenset(user.get("roles") or [])
    if Role.BUSINESS_USER not in roles and Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        raise HTTPException(status_code=403, detail="Discovery requires a business role")
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")


# ============ SPEC-0003 v0.4.0 opportunity candidates (TASK-0038) ============


def _build_opportunity_service(request: Request):
    """Construct the v0.4.0 OpportunityService from injected deps."""
    from crm.application.opportunity import OpportunityService

    return OpportunityService(
        institution_repo=request.app.state.institution_repository,
        user_repo=request.app.state.user_repository,
        session_factory=getattr(request.app.state, "session_factory", None),
        crawler_source=getattr(request.app.state, "opportunity_crawler_source", None),
        reason_generator=getattr(request.app.state, "opportunity_reason_generator", None),
        crawler_reason_generator=getattr(
            request.app.state, "opportunity_crawler_reason_generator", None
        ),
    )


@router.post("/candidates/run")
async def run_candidates(
    request: Request,
    current_user: dict = Depends(get_current_user),
    trigger: str = "personal",
):
    """Trigger AI candidate discovery asynchronously (SPEC-0003 v0.5.0).

    ``trigger``: ``personal`` (default) — based on caller's own customers;
    ``crawler`` — external public announcement crawl (admin-only).
    """
    _require_discovery_recipient(current_user)

    from crm.domain.models import Role
    roles = frozenset(current_user.get("roles") or [])

    if trigger == "crawler":
        if Role.ADMINISTRATOR not in roles:
            raise HTTPException(status_code=403, detail="Crawler trigger requires administrator role")
    elif trigger not in ("personal", ""):
        raise HTTPException(status_code=400, detail="trigger must be 'personal' or 'crawler'")

    app_state = request.app.state

    if not hasattr(app_state, "crawl_lock"):
        app_state.crawl_lock = threading.Lock()
        app_state.crawl_running = False
        app_state.crawl_last_result = None
        app_state.crawl_last_time = None

    with app_state.crawl_lock:
        if app_state.crawl_running:
            return {"status": "already_running"}
        app_state.crawl_running = True

    user_id = UUID(current_user["id"])

    def _run_in_background() -> None:
        try:
            service = _build_opportunity_service(request)
            if trigger == "crawler":
                result = service.run_crawler(user_id)
            else:
                result = service.run_personal(user_id)
            app_state.crawl_last_result = result
            app_state.crawl_last_time = datetime.now(timezone.utc)
        except Exception:
            import traceback
            traceback.print_exc()
            app_state.crawl_last_result = {"error": "crawl failed"}
            app_state.crawl_last_time = datetime.now(timezone.utc)
        finally:
            with app_state.crawl_lock:
                app_state.crawl_running = False

    threading.Thread(target=_run_in_background, daemon=True).start()
    return {"status": "started", "trigger": trigger}


@router.get("/candidates/status")
async def crawl_status(request: Request):
    """Return the current crawl state (for the async trigger UX).

    Response: ``{"running": bool, "last_result": ...|null, "last_time": "..."|null}``.
    """
    app_state = request.app.state
    running = getattr(app_state, "crawl_running", False)
    last_result = getattr(app_state, "crawl_last_result", None)
    last_time = getattr(app_state, "crawl_last_time", None)
    return {
        "running": running,
        "last_result": last_result,
        "last_time": last_time.isoformat() if last_time else None,
    }


@router.get("/candidates/management")
async def list_management_candidates(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """R-009: general manager desensitized read-only opportunity view.

    Only safe fields (id/source/status/candidate_text/timestamps) are
    returned; reasons, involved records, and external subject references are
    withheld so no protected data leaks. Administrator also allowed."""
    roles = frozenset(current_user.get("roles") or [])
    if Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        raise HTTPException(status_code=403, detail="Administrator role required")
    service = _build_opportunity_service(request)
    return {"items": service.list_desensitized()}


@router.get("/candidates")
async def list_candidates(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """List the current user's opportunity candidates (masked)."""
    _require_discovery_recipient(current_user)
    service = _build_opportunity_service(request)
    items = service.list_candidates(UUID(current_user["id"]))
    return {"items": items}


@router.get("/candidates/{candidate_id}")
async def get_candidate(
    request: Request,
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
):
    """One candidate, scoped to the current recipient (404 otherwise)."""
    _require_discovery_recipient(current_user)
    try:
        cid = UUID(candidate_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Candidate not found")

    service = _build_opportunity_service(request)
    candidate = service.get_candidate(UUID(current_user["id"]), cid)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


class AdjudicateRequest(BaseModel):
    decision: str


@router.post("/candidates/{candidate_id}/adjudicate")
async def adjudicate_candidate(
    request: Request,
    candidate_id: str,
    data: AdjudicateRequest,
    current_user: dict = Depends(get_current_user),
):
    """A human decides 采纳 or 忽略 (R-003: the AI has no final judgment)."""
    _require_discovery_recipient(current_user)
    try:
        cid = UUID(candidate_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Candidate not found")

    service = _build_opportunity_service(request)
    try:
        result = service.adjudicate(
            candidate_id=cid,
            actor_user_id=UUID(current_user["id"]),
            decision=data.decision,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result
