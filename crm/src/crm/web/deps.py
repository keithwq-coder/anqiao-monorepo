"""Shared dependencies and utilities for web layer.

This module provides thread-local user context, the canonical authenticated
identity loader (identity plus roles/scopes per SPEC-0002 R-013), and the
CSRF enforcement helper for write requests (DEC-0044), to break circular
import issues between main.py and route modules.
"""

import secrets
from contextvars import ContextVar
from typing import Optional
from uuid import UUID

from fastapi import Request
from fastapi.responses import JSONResponse


# Thread-local storage for current authenticated user
current_user_var: ContextVar[Optional[dict]] = ContextVar("current_user", default=None)


def load_user_context(app_state, user) -> Optional[dict]:
    """Build the canonical identity dict for an authenticated user.

    Includes roles and management scope keys loaded from active role
    grants (SPEC-0002 R-013, AC-009). Fail-closed: if grants cannot be
    loaded, the identity cannot be established and access is denied
    (returns None) rather than silently widening or guessing (R-003/R-006).
    """
    role_repo = getattr(app_state, "role_grant_repository", None)
    if role_repo is None:
        return None

    try:
        roles, scope_keys = role_repo.find_active_roles(user.id)
    except Exception:
        return None

    sorted_roles = sorted(role.value for role in roles)
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "status": user.status,  # Already StrEnum, no .value needed
        "role": sorted_roles[0] if sorted_roles else None,
        "roles": sorted_roles,
        "management_scope_keys": sorted(scope_keys),
    }


async def get_current_user_optional(request: Request) -> Optional[dict]:
    """Get current authenticated user or None.

    This is the shared implementation to avoid circular imports.
    Returns the canonical user dict (identity plus roles/scopes), or None
    when unauthenticated or when any identity component fails (fail-closed).
    """
    session_id = request.session.get("session_id")
    if not session_id:
        return None

    # Get auth service from app state
    auth_service = getattr(request.app.state, "auth_service", None)
    if not auth_service:
        return None

    # Validate session
    session = auth_service.validate_session(session_id)
    if not session:
        return None

    # Get user from repository
    user_repo = getattr(request.app.state, "user_repository", None)
    if not user_repo:
        return None

    try:
        user = user_repo.find_by_id(UUID(session.user_id))
    except Exception:
        return None
    if not user:
        return None

    return load_user_context(request.app.state, user)


async def get_current_user(request: Request) -> dict:
    """Get current authenticated user, raise 401 if not authenticated."""
    user = await get_current_user_optional(request)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ============ CSRF enforcement (DEC-0044) ============

CSRF_PROTECTED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
CSRF_EXEMPT_PATHS = frozenset({"/api/auth/login", "/api/auth/logout"})
# 内部账号接口（wiki ↔ CRM 同步）：机器调用、无浏览器会话，另行 token 鉴权，豁免 CSRF
CSRF_EXEMPT_PREFIXES = frozenset({"/api/internal/"})


def _csrf_forbidden() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"detail": "CSRF token missing or invalid"},
    )


async def enforce_csrf(request: Request) -> Optional[JSONResponse]:
    """Enforce the synchronizer-token CSRF pattern on write requests.

    Applies to mutating ``/api/`` requests except the login endpoint (which
    cannot hold a token yet and is rate-limited with generic failures).
    The ``X-CSRF-Token`` header must match both the signed-cookie copy
    (constant-time) and the persisted server-side hash of an active
    session. Returns a 403 response on failure, None to allow the request.
    Unauthenticated requests pass through; route-level auth denies them.
    """
    if request.method not in CSRF_PROTECTED_METHODS:
        return None

    path = request.url.path
    if (
        not path.startswith("/api/")
        or path in CSRF_EXEMPT_PATHS
        or any(path.startswith(prefix) for prefix in CSRF_EXEMPT_PREFIXES)
    ):
        return None

    session_id = request.session.get("session_id")
    if not session_id:
        # Unauthenticated: no CSRF decision to make; the route's auth
        # dependency will deny with 401.
        return None

    auth_service = getattr(request.app.state, "auth_service", None)
    if auth_service is None:
        return _csrf_forbidden()

    presented = request.headers.get("X-CSRF-Token")
    cookie_token = request.session.get("csrf_token")
    if (
        not presented
        or not cookie_token
        or not secrets.compare_digest(presented, cookie_token)
    ):
        auth_service._audit(
            "CSRF_FAILED",
            outcome="denied",
            failure_summary="csrf_cookie_mismatch",
        )
        return _csrf_forbidden()

    if not auth_service.validate_csrf_token(session_id, presented):
        auth_service._audit(
            "CSRF_FAILED",
            outcome="denied",
            failure_summary="csrf_hash_mismatch",
        )
        return _csrf_forbidden()

    return None
