"""FastAPI application entry point with authentication and session management.

S5 Web Layer - fixes circular imports by using shared deps module.
All routes import from crm.web.deps instead of main.py directly.
"""

import os
import sys
from pathlib import Path

# Auto-add project root to path if not present (for production deployment)
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import settings FIRST before anything else that might trigger web imports
from crm.config import Settings
settings = Settings()

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import uvicorn  # used by the `python -m crm.web.main` entrypoint

# Import route routers AFTER settings is defined
from crm.web.routes import auth, institutions, followups, admin, imports, account, discovery, reporting, internal


# ============ Application Lifecycle ============

app = FastAPI(
    title="Anqiao CRM API",
    description="Server-side CRM for manual core-record activity",
    version="0.1.0"
)

# Initialize templates BEFORE adding middleware (avoid jinja2 context issues)
templates = Jinja2Templates(directory="templates")

# Fail-closed: SESSION_SECRET_KEY must be provided via environment.
# Random fallback removed — restarting would invalidate all active sessions.
_session_secret = os.environ.get('SESSION_SECRET_KEY')
if not _session_secret:
    raise RuntimeError(
        "SESSION_SECRET_KEY environment variable is required. "
        "Set it to a stable secret (e.g. 64-char hex). "
        "Sessions will be invalidated on every restart without a fixed key."
    )


# CSRF enforcement for write requests (DEC-0044). Registered BEFORE the
# other middleware so it ends up innermost: Starlette's add_middleware and
# the middleware decorator both prepend, so the SessionMiddleware registered
# after this runs first and request.session is available here.
@app.middleware("http")
async def csrf_protection_middleware(request: Request, call_next):
    from crm.web.deps import enforce_csrf

    denial = await enforce_csrf(request)
    if denial is not None:
        return denial
    return await call_next(request)


def resolve_session_cookie_https_only() -> bool:
    """Explicit per-environment session cookie security (fail-closed).

    Default is secure (https_only=True). SESSION_COOKIE_SECURE=false is
    honored only outside production (local http testing); with
    CRM_ENVIRONMENT=production it raises instead of silently weakening
    the cookie.
    """
    environment = os.environ.get('CRM_ENVIRONMENT', 'development').strip().lower() or 'development'
    override = os.environ.get('SESSION_COOKIE_SECURE')
    if environment == 'production':
        if override is not None and override.strip().lower() == 'false':
            raise RuntimeError(
                "SESSION_COOKIE_SECURE=false is forbidden when "
                "CRM_ENVIRONMENT=production; session cookies must stay Secure."
            )
        return True
    return (override or 'true').strip().lower() == 'true'


app.add_middleware(
    SessionMiddleware,
    secret_key=_session_secret,
    session_cookie='session_id',
    max_age=3600,  # 1 hour - matches auth service default
    same_site='lax',  # Prevent CSRF attacks
    # https_only: explicit per environment (see resolve_session_cookie_https_only)
    https_only=resolve_session_cookie_https_only()
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"]
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers AFTER app and middleware setup
app.include_router(auth.router)
app.include_router(institutions.router)
app.include_router(followups.router)
app.include_router(admin.router)
app.include_router(imports.router)
app.include_router(account.router)
app.include_router(discovery.router)
app.include_router(reporting.router)
app.include_router(internal.router)


def setup_app_dependencies():
    """Setup all service dependencies on app state."""
    # Create repositories
    from crm.persistence.repositories import (
        InstitutionRepository,
        ContactRepository,
        FollowUpActivityRepository
    )
    from crm.persistence.user_repository import UserRepository
    from crm.persistence.session_repository import ServerSessionRepository
    from crm.persistence.audit_repository import AuditEventRepository
    from crm.persistence.role_grant_repository import RoleGrantRepository
    from crm.persistence.database import SessionLocal

    user_repository = UserRepository()
    institution_repository = InstitutionRepository()
    contact_repository = ContactRepository()
    activity_repository = FollowUpActivityRepository()
    session_repository = ServerSessionRepository()
    audit_repository = AuditEventRepository()
    role_grant_repository = RoleGrantRepository()

    # Create authentication service with default settings.
    # Sessions, CSRF token hashes, and audit events are durable via the
    # repositories (DEC-0044); only per-process login attempt trackers
    # remain in memory.
    from crm.web.auth import AuthSettings, AuthenticationService

    auth_settings = AuthSettings(
        session_max_age_seconds=3600,
        login_rate_limit_per_hour=5,
        csrf_token_lifetime_hours=1
    )

    auth_service = AuthenticationService(
        user_repository=user_repository,
        session_repository=session_repository,
        audit_repository=audit_repository,
        auth_settings=auth_settings
    )
    
    # Create query service
    from crm.application.queries import QueryService
    from crm.policy.projection import project_record
    
    query_service = QueryService(
        institution_repo=institution_repository,
        contact_repo=contact_repository,
        activity_repo=activity_repository
    )
    
    # Store on app state for global access
    app.state.user_repository = user_repository
    app.state.institution_repository = institution_repository
    app.state.contact_repository = contact_repository
    app.state.activity_repository = activity_repository
    app.state.query_service = query_service
    app.state.auth_service = auth_service
    app.state.role_grant_repository = role_grant_repository
    app.state.audit_repository = audit_repository

    # 内部账号接口（wiki ↔ CRM 同步）鉴权 token；空 = 接口一律 403
    app.state.crm_internal_token = settings.crm_internal_token.get_secret_value()

    # TASK-0047 deployment fix (2026-08-25): transaction-backed endpoints
    # (imports batches, archive/correct/withdraw, admin management commands,
    # opportunity candidates) read session_factory from app.state. It was
    # never wired here, so in the deployed runtime those endpoints received
    # None and failed with 500 (local tests masked this by injecting their
    # own SQLite factory). Wire the production sessionmaker now; no business
    # rule change.
    app.state.session_factory = SessionLocal

    # TASK-0040 opportunity-discovery injectables (SPEC-0003 v0.4.0).
    # Fail-closed wiring: with env unset or network gates closed the builders
    # return None and the synthetic-stub behavior is preserved. Real egress
    # additionally requires the runtime network gates plus product-owner
    # confirmation at execution time (DEC-0158 point 5).
    from crm.ai.wiring import build_crawler_source, build_reason_generator

    # TASK-0041 P1 fix (DEC-0162 + DEC-0163): inject a real HTTP transport
    # into the reason generator so the approved glm-5.2 egress path is
    # actually exercised. Without this, generate_reason degrades to
    # "provider transport unavailable" before any request (R-014 truthful
    # audit). The crawler already auto-attaches make_httpx_fetcher() at
    # wiring.py; the reason generator does not, so we wire it explicitly
    # here. Reverse on rollback: remove the http_client kwarg.
    import httpx
    _reason_http_client = httpx.Client(timeout=120.0)

    app.state.opportunity_crawler_source = build_crawler_source(
        audit_repository=audit_repository
    )
    app.state.opportunity_reason_generator = build_reason_generator(
        audit_repository=audit_repository,
        http_client=_reason_http_client,
        timeout_seconds=120.0,
    )
    app.state.opportunity_crawler_reason_generator = build_reason_generator(
        audit_repository=audit_repository,
        http_client=_reason_http_client,
        timeout_seconds=120.0,
    )
    
    print("OK Application initialized successfully")


setup_app_dependencies()


# ============ Global Exceptions Middleware ============

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to prevent leaking sensitive information."""
    import traceback
    
    traceback.print_exc()
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": "An unexpected error occurred"
        }
    )


@app.get("/dashboard")
async def dashboard(request: Request):
    """Dashboard page after login."""
    from crm.web.deps import get_current_user_optional
    
    user = await get_current_user_optional(request)
    
    if not user:
        return templates.TemplateResponse(
            request,
            "login.html",
            {"request": request, "title": "Login", "error": "Please log in first"}
        )
    
    return templates.TemplateResponse(request, "dashboard.html", {
        "request": request,
        "user": user,
        "title": "Dashboard",
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "dashboard",
    })


@app.get("/institutions")
async def institutions_page(
    request: Request,
    q: str | None = None,
    page: int = 1,
    owner: str | None = None,
    custodian: str | None = None,
    customer_type: str | None = None,
    region: str | None = None,
):
    """Institution list page, server-rendered through the policy projection.

    Accepts ``q`` (search term), ``page`` (1-based), and optional filters
    (owner, custodian, customer_type, region). Limit is fixed at 20 per page.
    """
    from uuid import UUID
    from crm.web.deps import get_current_user_optional
    from crm.policy.projection import project_record, PolicyDenied, RecordSnapshot
    from crm.application.queries import PolicySubject
    from crm.persistence.database import SessionLocal
    from crm.persistence.models import UserIdentityModel
    import sqlalchemy as sa
    
    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    
    user_id = UUID(user["id"])
    roles = frozenset(user.get("roles") or [])
    mgmt_keys = frozenset(user.get("management_scope_keys") or [])
    
    # Build user map for display
    user_map = {}
    with SessionLocal() as s:
        rows = s.execute(sa.select(UserIdentityModel.id, UserIdentityModel.username)).all()
        for row in rows:
            user_map[str(row[0])] = row[1]
    
    # Build username -> id reverse map for owner/custodian filter
    name_to_id = {v: k for k, v in user_map.items()}
    filter_owner_id = name_to_id.get(owner) if owner else None
    filter_custodian_id = name_to_id.get(custodian) if custodian else None
    
    # Get all visible institutions (policy-filtered)
    subject = PolicySubject(
        user_id=user_id,
        status=user["status"],
        roles=roles,
        management_scope_keys=mgmt_keys,
    )
    all_insts = request.app.state.institution_repository.find_active_for_duplicate_check()
    visible = []
    for inst in all_insts:
        try:
            project_record(subject, RecordSnapshot(
                institution=inst, contacts=(), activities=(),
                management_scope_key=inst.region,
            ))
        except PolicyDenied:
            continue
        visible.append(inst)
    
    # Apply search filter
    if q:
        q_lower = q.lower()
        visible = [i for i in visible if q_lower in i.name.lower()]
    
    # Apply column filters
    if filter_owner_id:
        visible = [i for i in visible if str(i.owner_user_id) == filter_owner_id]
    if filter_custodian_id:
        visible = [i for i in visible if str(i.custodian_user_id) == filter_custodian_id]
    if customer_type:
        visible = [i for i in visible if (i.customer_type.value if hasattr(i.customer_type, 'value') else str(i.customer_type)) == customer_type]
    if region:
        visible = [i for i in visible if i.region == region]
    
    total = len(visible)
    limit = 20
    offset = (page - 1) * limit
    total_pages = max(1, (total + limit - 1) // limit)
    page_items = visible[offset:offset + limit]
    
    # Convert to summaries for template
    from crm.application.queries import InstitutionSummary
    summaries = []
    for inst in page_items:
        summaries.append(InstitutionSummary(
            id=inst.id, name=inst.name,
            customer_type=inst.customer_type.value if hasattr(inst.customer_type, 'value') else str(inst.customer_type),
            in_pool=getattr(inst, 'in_pool', False),
            category=inst.category, region=inst.region,
            source_category=inst.source_kind,
            owner_user_id=inst.owner_user_id,
            custodian_user_id=getattr(inst, 'custodian_user_id', None),
        ))
    
    return templates.TemplateResponse(request, "institutions_list.html", {
        "request": request,
        "user": user,
        "title": "机构列表",
        "institutions": summaries,
        "total": total,
        "q": q or "",
        "page": page,
        "total_pages": total_pages,
        "active_nav": "institutions",
        "user_map": user_map,
        "filter_owner": owner or "",
        "filter_custodian": custodian or "",
        "filter_customer_type": customer_type or "",
        "filter_region": region or "",
        "csrf_token": request.session.get("csrf_token"),
    })


@app.get("/institutions/new")
async def institution_create_page(request: Request):
    """Browser form: create an institution (R-001)."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _form_denied_if_not_business_writer(user)
    if denied is not None:
        return JSONResponse(
            status_code=denied.status_code,
            content={"detail": denied.detail},
        )

    return templates.TemplateResponse(request, "institution_create.html", {
        "request": request,
        "user": user,
        "title": "新建机构",
        "csrf_token": request.session.get("csrf_token"),
    })


@app.post("/institutions/new")
async def institution_create_submit(request: Request):
    """Handle the institution creation form; same command and R-035 duplicate
    gate as the JSON API."""
    import uuid as _uuid
    from uuid import UUID

    from crm.domain.models import Role
    from crm.web.deps import get_current_user_optional
    from crm.application.commands import CreateInstitutionCommand

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _form_denied_if_not_business_writer(user)
    if denied is not None:
        return JSONResponse(
            status_code=denied.status_code,
            content={"detail": denied.detail},
        )

    form = await request.form()
    context = {
        "request": request,
        "user": user,
        "title": "新建客户",
        "csrf_token": request.session.get("csrf_token"),
        "form": form,
    }
    if not await _form_has_valid_csrf(request):
        return templates.TemplateResponse(
            request,
            "institution_create.html", {**context, "error": "CSRF token missing or invalid"},
            status_code=400,
        )

    from crm.domain.models import CustomerType

    try:
        customer_type = (
            CustomerType(form.get("customer_type", ""))
            if form.get("customer_type")
            else CustomerType.DIRECT_PURCHASE
        )
    except ValueError:
        return templates.TemplateResponse(
            request,
            "institution_create.html",
            {**context, "error": "客户类型必须是：直接采购 / 个人 / 渠道"},
            status_code=400,
        )

    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    query_service = request.app.state.query_service
    duplicates = query_service.detect_duplicate_institutions(
        name=form.get("name", ""),
        user_id=UUID(user["id"]),
        user_status=user["status"],
        roles=roles,
        management_scope_keys=frozenset(user.get("management_scope_keys") or []),
    )
    confirm_duplicate = form.get("confirm_duplicate") == "true"
    if duplicates and not confirm_duplicate:
        return templates.TemplateResponse(
            request,
            "institution_create.html",
            {**context, "error": "可能存在重复客户，请核对候选后勾选确认再提交（系统不会自动合并）"},
            status_code=409,
        )

    command = CreateInstitutionCommand(
        name=form.get("name", ""),
        source_description=form.get("source_description", ""),
        owner_user_id=UUID(user["id"]),
        created_by_user_id=UUID(user["id"]),
        idempotency_key=f"form-{_uuid.uuid4().hex}",
        customer_type=customer_type,
        category=form.get("category") or None,
        region=form.get("region") or None,
        source_kind=form.get("source_kind") or None,
        source_evidence_reference=form.get("source_evidence_reference") or None,
    )
    valid, errors = command.validate(None)
    if not valid:
        return templates.TemplateResponse(
            request,
            "institution_create.html",
            {**context, "error": "校验失败：" + "; ".join(errors)},
            status_code=400,
        )

    try:
        institution = command.execute(request.app.state.institution_repository)
    except ValueError as e:
        return templates.TemplateResponse(
            request, "institution_create.html", {**context, "error": str(e)}, status_code=400
        )

    return RedirectResponse(url=f"/institutions/{institution.id}", status_code=303)


@app.get("/institutions/{institution_id}")
async def institution_detail_page(
    request: Request,
    institution_id: str,
    administrator_reason: str | None = None,
):
    """Institution detail page: record + contacts + follow-up history in the
    deterministic policy-projection order (SPEC-0001 four-step flow).

    ``administrator_reason`` (SPEC-0002 v0.4.0 R-008): optional trace value.
    The administrator reads full detail without a reason; when a reason is
    supplied, an optional ``admin.exception_read`` audit event is written."""
    from uuid import UUID
    from crm.web.deps import get_current_user_optional
    from crm.domain.models import Role
    
    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    
    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    query_service = request.app.state.query_service
    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    scope_keys = frozenset(user.get("management_scope_keys") or [])

    # R-015: normalize the reason so whitespace-only is treated as omitted.
    from crm.application.queries import _normalize_reason
    normalized_reason = _normalize_reason(administrator_reason)

    detail = query_service.get_institution_detail(
        institution_id=inst_uuid,
        user_id=UUID(user["id"]),
        user_status=user["status"],
        roles=roles,
        management_scope_keys=scope_keys,
        administrator_reason=normalized_reason,
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Institution not found or access denied")

    # Audited exception read (R-015): same audit event as the JSON API path.
    if normalized_reason is not None and Role.ADMINISTRATOR in roles:
        request.app.state.audit_repository.record(
            action="admin.exception_read",
            outcome="success",
            target_type="institution",
            target_id=inst_uuid,
            actor_user_id=UUID(user["id"]),
            reason=normalized_reason,
        )
    
    # The detail payload carries contacts and the full follow-up history in
    # policy-projection order (same source as the JSON API, R-030).
    return templates.TemplateResponse(request, "institution_detail.html", {
        "request": request,
        "user": user,
        "title": detail.name,
        "institution": detail,
        "activities": detail.activities,
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "institutions",
    })


# ============ Opportunity discovery pages (TASK-0043, SPEC-0003 v0.4.0) ============

def _build_opportunity_page_service(request: Request):
    """Build the v0.4.0 OpportunityService from the injected app deps
    (same wiring as the JSON API path in routes/discovery.py)."""
    from crm.application.opportunity import OpportunityService

    return OpportunityService(
        institution_repo=request.app.state.institution_repository,
        user_repo=request.app.state.user_repository,
        session_factory=getattr(request.app.state, "session_factory", None),
        crawler_source=getattr(request.app.state, "opportunity_crawler_source", None),
        reason_generator=getattr(request.app.state, "opportunity_reason_generator", None),
        crawler_reason_generator=getattr(request.app.state, "opportunity_crawler_reason_generator", None),
    )


def _discovery_page_denied(user: dict) -> HTTPException | None:
    """Mirror routes/discovery._require_discovery_recipient for the page
    route: only enabled business users and administrators get the view;
    management stays read-only and is denied (OD-004/R-011, default-deny)."""
    from crm.domain.models import Role, UserStatus

    roles = frozenset(user.get("roles") or [])
    if Role.BUSINESS_USER not in roles and Role.ADMINISTRATOR not in roles:
        return HTTPException(status_code=403, detail="Discovery requires a business role")
    if user.get("status") != UserStatus.ENABLED.value:
        return HTTPException(status_code=403, detail="Account not enabled")
    return None


@app.get("/discovery")
async def discovery_page(request: Request):
    """Opportunity candidate list page (SPEC-0003 v0.4.0).

    Renders the current user's masked candidate list exactly as the JSON
    API projects it (routes/discovery.py list_candidates). Administrator
    additionally sees the desensitized management view (R-009) and the
    manual trigger-run control."""
    from uuid import UUID
    from crm.domain.models import Role
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _discovery_page_denied(user)
    if denied is not None:
        raise denied

    service = _build_opportunity_page_service(request)
    candidates = service.list_candidates(UUID(user["id"]))
    is_admin = Role.ADMINISTRATOR in frozenset(user.get("roles") or [])
    management_candidates = service.list_desensitized() if is_admin else None

    return templates.TemplateResponse(request, "discovery_list.html", {
        "request": request,
        "user": user,
        "title": "AI 商机",
        "candidates": candidates,
        "management_candidates": management_candidates,
        "is_admin": is_admin,
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "discovery",
    })


@app.get("/discovery/candidates/{candidate_id}")
async def discovery_candidate_detail_page(request: Request, candidate_id: str):
    """One opportunity candidate page, scoped to the current recipient
    (404 otherwise — same rule as the JSON API get_candidate)."""
    from uuid import UUID
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _discovery_page_denied(user)
    if denied is not None:
        raise denied

    try:
        cid = UUID(candidate_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Candidate not found")

    service = _build_opportunity_page_service(request)
    candidate = service.get_candidate(UUID(user["id"]), cid)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return templates.TemplateResponse(request, "discovery_detail.html", {
        "request": request,
        "user": user,
        "title": "商机详情",
        "candidate": candidate,
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "discovery",
    })


@app.get("/pool")
async def public_pool_page(request: Request):
    """Public-pool customer list page (SPEC-0001 v0.8.0 R-040..R-045).

    View-layer filter over the existing policy-projected listing: only
    records the caller may see AND currently in the pool are rendered
    (``in_pool`` is part of the API projection; no backend change, no new
    query parameter — the backend exposes no pool filter, so the page route
    applies the filter to the projected rows, see TASK-0044 evidence)."""
    from uuid import UUID
    from crm.domain.models import Role
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    if Role.BUSINESS_USER not in roles and Role.ADMINISTRATOR not in roles:
        raise HTTPException(status_code=403, detail="Pool requires a business role")

    query_service = request.app.state.query_service
    pool_items = []
    batch_size = 200
    for offset in range(0, 1000, batch_size):
        page_items = query_service.find_institutions(
            user_id=UUID(user["id"]),
            user_status=user["status"],
            roles=roles,
            management_scope_keys=frozenset(user.get("management_scope_keys") or []),
            limit=batch_size,
            offset=offset,
        )
        pool_items.extend(i for i in page_items if i.in_pool)
        if len(page_items) < batch_size:
            break

    return templates.TemplateResponse(request, "pool_list.html", {
        "request": request,
        "user": user,
        "title": "客户公池",
        "pool_items": pool_items,
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "pool",
    })


@app.get("/management")
async def management_summary_page(request: Request):
    """Read-only management summary page (SPEC-0002 R-019/R-020/R-021).

    Renders exactly the masked projection of ``GET /api/admin/summary``:
    administrator sees the company-wide summary; scoped manager sees only
    the authorized-scope summary; business_user is denied (403). Read-only:
    no action controls (R-021/AC-015)."""
    from uuid import UUID
    from crm.domain.models import Role, UserStatus
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    if Role.ADMINISTRATOR not in roles and Role.MANAGER not in roles:
        raise HTTPException(status_code=403, detail="Management role required")
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")

    summary = request.app.state.query_service.get_management_summary(
        user_id=UUID(user["id"]),
        user_status=user["status"],
        roles=roles,
        management_scope_keys=frozenset(user.get("management_scope_keys") or []),
    )

    return templates.TemplateResponse(request, "management_summary.html", {
        "request": request,
        "user": user,
        "title": "管理摘要",
        "summary": summary,
        "is_admin": Role.ADMINISTRATOR in roles,
        "active_nav": "management",
    })


@app.get("/reporting")
async def reporting_page(request: Request):
    """SPEC-0016 v0.1.0: reporting page (admin + shareholder only)."""
    from crm.web.deps import get_current_user_optional
    from crm.domain.models import Role

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    roles = frozenset(user.get("roles") or [])
    if Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        return JSONResponse(
            status_code=403,
            content={"detail": "Reporting requires administrator or shareholder role"},
        )

    return templates.TemplateResponse(request, "reporting.html", {
        "request": request,
        "user": user,
        "title": "报表",
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "reporting",
    })


# ============ Admin management pages (TASK-0046, SPEC-0002 v0.4.1 / SPEC-0011) ============

def _admin_page_denied(user: dict) -> HTTPException | None:
    """Administrator-only page gate (SPEC-0002 R-006/R-015)."""
    from crm.domain.models import Role

    if Role.ADMINISTRATOR not in frozenset(user.get("roles") or []):
        return HTTPException(status_code=403, detail="Administrator role required")
    return None


def _admin_user_list(request: Request) -> list[dict]:
    """Active users with their current role grants (page data only; the
    backend exposes no user-list API, so the page reads the repositories
    directly — same sources the management commands act on)."""
    from crm.domain.models import UserStatus

    users = []
    role_repo = request.app.state.role_grant_repository
    for u in request.app.state.user_repository.find_all_active():
        roles, scope_keys = role_repo.find_active_roles(u.id)
        users.append({
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "status": u.status.value if hasattr(u.status, "value") else str(u.status),
            "roles": sorted(r.value for r in roles),
            "scope_keys": sorted(scope_keys),
        })
    return users


@app.get("/admin")
async def admin_users_page(request: Request):
    """Admin user/role management page: active users, role grant/revoke
    (administrator / manager / business_user only), enable/disable."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _admin_page_denied(user)
    if denied is not None:
        raise denied

    return templates.TemplateResponse(request, "admin_users.html", {
        "request": request,
        "user": user,
        "title": "系统管理",
        "users": _admin_user_list(request),
        "live_roles": ["administrator", "manager", "business_user"],
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "admin",
    })


@app.get("/admin/transfer")
async def admin_transfer_page(request: Request):
    """Admin ownership-transfer page: single + batch transfer with a
    mandatory reason input."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _admin_page_denied(user)
    if denied is not None:
        raise denied

    return templates.TemplateResponse(request, "admin_transfer.html", {
        "request": request,
        "user": user,
        "title": "客户转移",
        "users": _admin_user_list(request),
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "admin",
    })


@app.get("/admin/erase")
async def admin_erase_page(request: Request):
    """Admin data-erasure page (SPEC-0011): per-institution erase with a
    mandatory reason and explicit irreversible confirmation."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _admin_page_denied(user)
    if denied is not None:
        raise denied

    return templates.TemplateResponse(request, "admin_erase.html", {
        "request": request,
        "user": user,
        "title": "数据擦除",
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "admin",
    })


# ============ Bulk-import pages (TASK-0047, SPEC-0013) ============

def _import_batch_summaries(request: Request) -> list[dict]:
    """Batch summaries mirroring GET /api/imports/batches (same model, same
    fields). ``undo_eligible`` derives from the API's ``status`` field
    (status == 'active'); the API exposes no separate undo-eligible flag."""
    import sqlalchemy as sa
    from crm.persistence.database import transaction_session
    from crm.persistence.models import ImportBatchModel

    factory = getattr(request.app.state, "session_factory", None)
    summaries = []
    with transaction_session(factory) as session:
        models = session.execute(
            sa.select(ImportBatchModel).order_by(ImportBatchModel.imported_at.desc())
        ).scalars().all()
        for m in models:
            summaries.append({
                "batch_id": str(m.id),
                "source_file_name": m.source_file_name,
                "status": m.status,
                "row_count": m.row_count,
                "imported_count": m.imported_count,
                "duplicate_count": m.duplicate_count,
                "failed_count": m.failed_count,
                "imported_at": m.imported_at.isoformat(),
                "undone_at": m.undone_at.isoformat() if m.undone_at else None,
                "undo_eligible": m.status == "active",
            })
    return summaries


@app.get("/imports")
async def imports_page(request: Request):
    """Admin bulk-import page (SPEC-0013): upload form + batch list."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _admin_page_denied(user)
    if denied is not None:
        raise denied

    return templates.TemplateResponse(request, "imports_list.html", {
        "request": request,
        "user": user,
        "title": "批量导入",
        "batches": _import_batch_summaries(request),
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "imports",
    })


@app.get("/imports/{batch_id}")
async def imports_detail_page(request: Request, batch_id: str):
    """One import batch with its per-row results (SPEC-0013 review surface)."""
    from uuid import UUID
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    denied = _admin_page_denied(user)
    if denied is not None:
        raise denied

    try:
        bid = UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch id")

    import sqlalchemy as sa
    from crm.persistence.database import transaction_session
    from crm.persistence.models import ImportBatchModel
    from crm.persistence.repositories import ImportBatchRepository

    factory = getattr(request.app.state, "session_factory", None)
    with transaction_session(factory) as session:
        batch = session.get(ImportBatchModel, bid)
        if batch is None:
            raise HTTPException(status_code=404, detail="Import batch not found")
        repo = ImportBatchRepository()
        row_models = repo.list_row_results(session=session, batch_id=bid)
        rows = [
            {
                "line_number": r.line_number,
                "outcome": r.outcome,
                "institution_id": str(r.institution_id) if r.institution_id else None,
                "duplicate_of_institution_id": (
                    str(r.duplicate_of_institution_id) if r.duplicate_of_institution_id else None
                ),
                "reason": r.reason,
            }
            for r in row_models
        ]
        detail = {
            "batch_id": str(batch.id),
            "source_file_name": batch.source_file_name,
            "status": batch.status,
            "row_count": batch.row_count,
            "imported_count": batch.imported_count,
            "duplicate_count": batch.duplicate_count,
            "failed_count": batch.failed_count,
            "imported_at": batch.imported_at.isoformat(),
            "undone_at": batch.undone_at.isoformat() if batch.undone_at else None,
            "undo_reason": batch.undo_reason,
            "undo_eligible": batch.status == "active",
            "rows": rows,
        }

    return templates.TemplateResponse(request, "imports_detail.html", {
        "request": request,
        "user": user,
        "title": "导入批次详情",
        "batch": detail,
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "imports",
    })


@app.get("/")
async def root():
    """Redirect root to login page."""
    return RedirectResponse(url="/login", status_code=302)

@app.get("/login")
async def login_page(request: Request):
    """Login page."""
    from crm.web.deps import get_current_user_optional
    
    user = await get_current_user_optional(request)
    if user:
        return templates.TemplateResponse(request, "dashboard.html", {
            "request": request,
            "user": user,
            "title": "Dashboard"
        })
    
    return templates.TemplateResponse(
        request,
        "login.html",
        {"request": request, "title": "Login"}
    )


# ============ Browser creation forms (TASK-0008 Step 5) ============
#
# Page-form POSTs are outside the /api/ CSRF middleware, so every submit
# verifies the synchronizer token manually (same token and validator as the
# API path). Idempotency keys are generated server-side for form submits.


async def _form_has_valid_csrf(request: Request) -> bool:
    """Verify the presented form CSRF token against the session cookie copy
    and the persisted server-side hash (mirrors deps.enforce_csrf)."""
    import secrets as _secrets

    form = await request.form()
    presented = form.get("csrf_token")
    session_id = request.session.get("session_id")
    cookie_token = request.session.get("csrf_token")
    if not presented or not cookie_token or not _secrets.compare_digest(presented, cookie_token):
        return False
    auth_service = getattr(request.app.state, "auth_service", None)
    if auth_service is None:
        return False
    return auth_service.validate_csrf_token(session_id, presented)


def _form_denied_if_not_business_writer(user: dict) -> HTTPException | None:
    """SPEC-0002 R-003/R-006: only enabled users with an explicit business
    or administrator role may write via forms. Management is read-only
    (R-021); no-role defaults to deny."""
    from crm.domain.models import Role, UserStatus

    if user.get("status") != UserStatus.ENABLED.value:
        return HTTPException(status_code=403, detail="Account not enabled")
    roles = frozenset(user.get("roles") or [])
    if Role.BUSINESS_USER not in roles and Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        return HTTPException(status_code=403, detail="Write requires a business role")
    return None




@app.get("/institutions/{institution_id}/contacts/new")
async def contact_create_page(request: Request, institution_id: str):
    """Browser form: add a contact under an institution (R-003)."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _form_denied_if_not_business_writer(user)
    if denied is not None:
        return JSONResponse(
            status_code=denied.status_code,
            content={"detail": denied.detail},
        )

    return templates.TemplateResponse(request, "contact_create.html", {
        "request": request,
        "user": user,
        "title": "添加联系人",
        "institution_id": institution_id,
        "csrf_token": request.session.get("csrf_token"),
    })


@app.post("/institutions/{institution_id}/contacts/new")
async def contact_create_submit(request: Request, institution_id: str):
    """Handle the contact creation form; owner-write and R-035 duplicate gate
    match the JSON API."""
    import uuid as _uuid
    from uuid import UUID

    from crm.domain.models import ContactabilityStatus, Role
    from crm.web.deps import get_current_user_optional
    from crm.application.commands import AddContactToInstitutionCommand

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _form_denied_if_not_business_writer(user)
    if denied is not None:
        return JSONResponse(
            status_code=denied.status_code,
            content={"detail": denied.detail},
        )

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Owner-write authorization (default deny; 404, no existence leakage).
    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None or institution.owner_user_id != UUID(user["id"]):
        raise HTTPException(status_code=404, detail="Institution not found")

    form = await request.form()
    context = {
        "request": request,
        "user": user,
        "title": "添加联系人",
        "institution_id": institution_id,
        "csrf_token": request.session.get("csrf_token"),
        "form": form,
    }
    if not await _form_has_valid_csrf(request):
        return templates.TemplateResponse(
            request,
            "contact_create.html", {**context, "error": "CSRF token missing or invalid"},
            status_code=400,
        )

    roles = frozenset(Role(role) for role in (user.get("roles") or []))
    duplicates = request.app.state.query_service.detect_duplicate_contacts(
        inst_uuid,
        phone=form.get("phone"),
        email=form.get("email"),
        wechat=form.get("wechat"),
        user_id=UUID(user["id"]),
        user_status=user["status"],
        roles=roles,
        management_scope_keys=frozenset(user.get("management_scope_keys") or []),
    )
    confirm_duplicate = form.get("confirm_duplicate") == "true"
    if duplicates and not confirm_duplicate:
        return templates.TemplateResponse(
            request,
            "contact_create.html",
            {**context, "error": "可能存在重复联系人，请核对候选后勾选确认再提交（系统不会自动合并）"},
            status_code=409,
        )

    command = AddContactToInstitutionCommand(
        institution_id=inst_uuid,
        created_by_user_id=UUID(user["id"]),
        contactability_status=ContactabilityStatus(form.get("contactability_status") or "not_yet_obtained"),
        idempotency_key=f"form-{_uuid.uuid4().hex}",
        name=form.get("name") or None,
        role_label=form.get("role_label") or None,
        job_title=form.get("job_title") or None,
        phone=form.get("phone") or None,
        email=form.get("email") or None,
        wechat=form.get("wechat") or None,
        other_channel=form.get("other_channel") or None,
        channel_notes=form.get("channel_notes") or None,
    )
    valid, errors = command.validate(None)
    if not valid:
        return templates.TemplateResponse(
            request,
            "contact_create.html",
            {**context, "error": "校验失败：" + "; ".join(errors)},
            status_code=400,
        )

    try:
        command.execute(request.app.state.contact_repository)
    except ValueError as e:
        return templates.TemplateResponse(
            request, "contact_create.html", {**context, "error": str(e)}, status_code=400
        )

    return RedirectResponse(url=f"/institutions/{institution_id}", status_code=303)


@app.get("/institutions/{institution_id}/activities/new")
async def activity_create_page(request: Request, institution_id: str):
    """Browser form: append a follow-up activity (R-005)."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _form_denied_if_not_business_writer(user)
    if denied is not None:
        return JSONResponse(
            status_code=denied.status_code,
            content={"detail": denied.detail},
        )

    return templates.TemplateResponse(request, "followup_create.html", {
        "request": request,
        "user": user,
        "title": "添加跟进",
        "institution_id": institution_id,
        "csrf_token": request.session.get("csrf_token"),
    })


@app.post("/institutions/{institution_id}/activities/new")
async def activity_create_submit(request: Request, institution_id: str):
    """Handle the follow-up creation form; owner-write and the R-028
    next-action rule match the JSON API."""
    import uuid as _uuid
    from datetime import date, datetime, timezone
    from uuid import UUID

    from crm.domain.models import Role
    from crm.web.deps import get_current_user_optional
    from crm.application.commands import CreateFollowUpActivityCommand

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    # SPEC-0002 R-003/R-006: write requires a business or administrator role.
    denied = _form_denied_if_not_business_writer(user)
    if denied is not None:
        return JSONResponse(
            status_code=denied.status_code,
            content={"detail": denied.detail},
        )

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Institution not found")

    institution = request.app.state.institution_repository.find_by_id(inst_uuid)
    if institution is None or institution.owner_user_id != UUID(user["id"]):
        raise HTTPException(status_code=404, detail="Institution not found")

    form = await request.form()
    context = {
        "request": request,
        "user": user,
        "title": "添加跟进",
        "institution_id": institution_id,
        "csrf_token": request.session.get("csrf_token"),
        "form": form,
    }
    if not await _form_has_valid_csrf(request):
        return templates.TemplateResponse(
            request,
            "followup_create.html", {**context, "error": "CSRF token missing or invalid"},
            status_code=400,
        )

    try:
        # datetime-local input carries no timezone; interpret as UTC.
        occurred_at = datetime.fromisoformat(form.get("occurred_at", "")).replace(tzinfo=timezone.utc)
    except ValueError:
        return templates.TemplateResponse(
            request,
            "followup_create.html", {**context, "error": "无效的发生时间"}, status_code=400
        )

    next_action_owner_raw = form.get("next_action_owner_user_id")
    try:
        next_action_owner = UUID(next_action_owner_raw) if next_action_owner_raw else None
    except ValueError:
        return templates.TemplateResponse(
            request,
            "followup_create.html", {**context, "error": "无效的下一步负责人 UUID"}, status_code=400
        )

    target_date_raw = form.get("next_action_target_date")
    try:
        target_date = date.fromisoformat(target_date_raw) if target_date_raw else None
    except ValueError:
        return templates.TemplateResponse(
            request,
            "followup_create.html", {**context, "error": "无效的下一步目标日期"}, status_code=400
        )

    command = CreateFollowUpActivityCommand(
        institution_id=inst_uuid,
        recorded_by_user_id=UUID(user["id"]),
        occurred_at=occurred_at,
        interaction_method=form.get("interaction_method", ""),
        communication_method_category=form.get("communication_method_category") or None,
        factual_body=form.get("factual_body", ""),
        idempotency_key=f"form-{_uuid.uuid4().hex}",
        shared_summary=form.get("shared_summary") or None,
        next_action=form.get("next_action") or None,
        next_action_owner_user_id=next_action_owner,
        next_action_target_date=target_date,
    )
    valid, errors = command.validate(None)
    if not valid:
        return templates.TemplateResponse(
            request,
            "followup_create.html",
            {**context, "error": "校验失败：" + "; ".join(errors)},
            status_code=400,
        )

    try:
        command.execute(request.app.state.activity_repository)
    except ValueError as e:
        return templates.TemplateResponse(
            request, "followup_create.html", {**context, "error": str(e)}, status_code=400
        )

    return RedirectResponse(url=f"/institutions/{institution_id}", status_code=303)


# ============ Health Check ============

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": "anqiao-crm-api",
        "version": "0.1.0"
    }


# ============ Main Entry Point ============

def _startup_banner(settings: Settings) -> str:
    """Redacted startup banner for the entrypoint (never prints secrets)."""
    redacted_url = settings.database_url.render_as_string(hide_password=True)
    return (
        "=" * 60
        + "\nOK Starting Anqiao CRM Server"
        + "\n" + "=" * 60
        + f"\nDebug mode: {settings.debug_mode}"
        + f"\nProduction mode: {settings.production_mode}"
        + f"\nDatabase: {redacted_url}"
        + "\n" + "-" * 60
        + "\nAccess URLs:"
        + "\n  Login: http://127.0.0.1:8000/login"
        + "\n  API Docs: http://127.0.0.1:8000/docs"
        + "\n  Health: http://127.0.0.1:8000/health"
        + "\n" + "=" * 60
    )


if __name__ == "__main__":
    # Lazy initialization - only when running directly
    import os
    if not any([
        'CRM_DATABASE_HOST' in os.environ,
        'DATABASE_HOST' in os.environ
    ]):
        from dotenv import load_dotenv
        load_dotenv()
    
    settings = Settings()
    print(_startup_banner(settings), flush=True)
    
    # Local development binds loopback only; production reachability is
    # nginx's responsibility per ADR-0002 (DEC-0071 point 3).
    uvicorn.run(
        "crm.web.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.debug_mode,
        log_level="debug" if settings.debug_mode else "info"
    )
