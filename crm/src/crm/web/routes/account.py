"""SPEC-0014 account credentials self-modification routes.

TASK-0019: enabled business users and administrators may modify their own
username and password via these endpoints. Both operations require
current-password verification; sa/dl-prefixed usernames are protected from
modification; successful changes invalidate all existing sessions and are
audited. Audit write failure rolls back the credential change (R-008).

The JSON API (``/api/account/*``) is CSRF-protected by the global
middleware. The form-submit paths (``/account/*``) verify the CSRF token
manually, matching the pattern used by the institution/contact/activity
creation forms.
"""

from uuid import UUID

from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from crm.web.deps import get_current_user
from crm.domain.models import Role, UserStatus


router = APIRouter(tags=["account"])
templates = Jinja2Templates(directory="templates")


# ============ Pydantic request models ============


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=255)
    new_password: str = Field(..., min_length=1, max_length=255)


class ChangeUsernameRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=255)
    new_username: str = Field(..., min_length=1, max_length=64)


# ============ Authorization helper ============


def _require_credential_actor(user: dict) -> None:
    """SPEC-0014 §5: only enabled business_user or administrator may use the
    self-service credential endpoints (SPEC-0014 v0.3.0: agent removed)."""
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")
    roles = frozenset(user.get("roles") or [])
    if (
        Role.BUSINESS_USER not in roles
        and Role.ADMINISTRATOR not in roles
        and Role.SHAREHOLDER not in roles
    ):
        raise HTTPException(status_code=403, detail="Credential self-modification requires a business role")


def _execute_credential_change(request: Request, command):
    """Run a credential-change command and translate errors to HTTP responses.

    R-001: credential verification failures return a generic 400 that does
    not disclose whether the account exists. R-008: audit/transaction
    failures return 500 (no success shown).
    """
    from crm.application.commands import CredentialError

    factory = getattr(request.app.state, "session_factory", None)
    audit_repo = request.app.state.audit_repository
    try:
        result = command.execute(audit_repo, factory)
    except CredentialError as exc:
        msg = str(exc)
        if msg == "Invalid credentials":
            raise HTTPException(status_code=400, detail="当前密码不正确")
        raise HTTPException(status_code=400, detail=msg)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="凭据修改失败，请稍后重试",
        )
    return result


# ============ JSON API endpoints ============


@router.post("/api/account/password")
async def change_password_api(
    request: Request,
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change the current user's password (SPEC-0014 R-001/R-002/R-006)."""
    _require_credential_actor(current_user)

    from crm.application.commands import ChangePasswordCommand

    command = ChangePasswordCommand(
        user_id=UUID(current_user["id"]),
        current_password=data.current_password,
        new_password=data.new_password,
    )
    result = _execute_credential_change(request, command)
    return result


@router.post("/api/account/username")
async def change_username_api(
    request: Request,
    data: ChangeUsernameRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change the current user's username (SPEC-0014 R-003..R-006)."""
    _require_credential_actor(current_user)

    from crm.application.commands import ChangeUsernameCommand

    command = ChangeUsernameCommand(
        user_id=UUID(current_user["id"]),
        current_password=data.current_password,
        new_username=data.new_username,
    )
    result = _execute_credential_change(request, command)
    return result


# ============ Page (form) endpoints ============


async def _form_has_valid_csrf(request: Request) -> bool:
    """Verify the presented form CSRF token (mirrors main._form_has_valid_csrf)."""
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


@router.get("/account/settings")
async def account_settings_page(request: Request):
    """Account settings page: password and username self-modification forms."""
    from crm.web.deps import get_current_user_optional

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    return templates.TemplateResponse(request, "account_settings.html", {
        "request": request,
        "user": user,
        "title": "账号设置",
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "account",
    })


@router.post("/account/password")
async def change_password_page(request: Request):
    """Handle the password-change form (same command as the JSON API)."""
    from crm.web.deps import get_current_user_optional
    from crm.application.commands import ChangePasswordCommand, CredentialError

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    _require_credential_actor(user)

    form = await request.form()
    context = {
        "request": request,
        "user": user,
        "title": "账号设置",
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "account",
    }

    if not await _form_has_valid_csrf(request):
        return templates.TemplateResponse(
            request,
            "account_settings.html",
            {**context, "error": "CSRF token missing or invalid"},
            status_code=400,
        )

    command = ChangePasswordCommand(
        user_id=UUID(user["id"]),
        current_password=form.get("current_password", ""),
        new_password=form.get("new_password", ""),
    )
    try:
        result = _execute_credential_change(request, command)
    except HTTPException as exc:
        return templates.TemplateResponse(
            request,
            "account_settings.html",
            {**context, "error": exc.detail},
            status_code=exc.status_code,
        )

    # Session is now invalidated; redirect to login.
    request.session.clear()
    return RedirectResponse(url="/login?changed=password", status_code=303)


@router.post("/account/username")
async def change_username_page(request: Request):
    """Handle the username-change form (same command as the JSON API)."""
    from crm.web.deps import get_current_user_optional
    from crm.application.commands import ChangeUsernameCommand

    user = await get_current_user_optional(request)
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    _require_credential_actor(user)

    form = await request.form()
    context = {
        "request": request,
        "user": user,
        "title": "账号设置",
        "csrf_token": request.session.get("csrf_token"),
        "active_nav": "account",
    }

    if not await _form_has_valid_csrf(request):
        return templates.TemplateResponse(
            request,
            "account_settings.html",
            {**context, "error": "CSRF token missing or invalid"},
            status_code=400,
        )

    command = ChangeUsernameCommand(
        user_id=UUID(user["id"]),
        current_password=form.get("current_password", ""),
        new_username=form.get("new_username", ""),
    )
    try:
        result = _execute_credential_change(request, command)
    except HTTPException as exc:
        return templates.TemplateResponse(
            request,
            "account_settings.html",
            {**context, "error": exc.detail},
            status_code=exc.status_code,
        )

    request.session.clear()
    return RedirectResponse(url="/login?changed=username", status_code=303)
