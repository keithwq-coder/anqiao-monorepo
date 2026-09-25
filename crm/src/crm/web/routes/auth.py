"""Authentication API routes with login, logout, and session management."""

from uuid import UUID

from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Import from shared deps module to avoid circular import
from crm.web.deps import get_current_user_optional, load_user_context


router = APIRouter(prefix="/api/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    """Request model for login endpoint."""
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)

class LoginResponse(BaseModel):
    """Login response with session info."""
    success: bool
    user_id: str | None = None
    username: str | None = None
    role: str | None = None
    roles: list[str] | None = None
    csrf_token: str | None = None
    message: str | None = None


class LogoutResponse(BaseModel):
    """Logout response."""
    success: bool
    message: str


class SessionResponse(BaseModel):
    """Current session information."""
    is_authenticated: bool
    user_id: str | None = None
    username: str | None = None
    role: str | None = None
    roles: list[str] | None = None
    csrf_token: str | None = None


# ============ Routes ============

@router.post("/login", response_model=LoginResponse)
async def login(request: Request, data: LoginRequest):
    """
    Authenticate user and create session.

    **Requirements:**
    - Username must exist in database
    - Password must match (Argon2id verification)
    - Account must be enabled
    - Rate limiting enforced uniformly for all identifiers

    **Response:**
    - Sets session cookie on success
    - Returns user identity, roles, and csrf_token
    - On failure: no state change, generic error (no account disclosure)
    """
    auth_service = request.app.state.auth_service

    # Execute authentication
    success, result = auth_service.authenticate(
        username=data.username,
        password=data.password,
        ip_address=request.client.host
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result,  # Generic error message from auth service
            headers={"WWW-Authenticate": "Bearer"},
        )

    login_result = result  # AuthenticatedLogin with session + CSRF pair
    session = login_result.session

    # Set session cookie values (signed by SessionMiddleware)
    request.session["session_id"] = session.session_id
    request.session["csrf_token"] = login_result.csrf_pair.csrf_token

    # Build the canonical identity context (roles/scopes). Fail-closed:
    # if the context cannot be established, the login is not shown as
    # successful.
    user_repo = request.app.state.user_repository
    user = user_repo.find_by_id(UUID(session.user_id))
    context = load_user_context(request.app.state, user) if user else None
    if context is None:
        auth_service.invalidate_session(session.session_id, reason="context_unavailable")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return LoginResponse(
        success=True,
        user_id=context["id"],
        username=context["username"],
        role=context["role"],
        roles=context["roles"],
        csrf_token=login_result.csrf_pair.csrf_token,
        message="Login successful"
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(request: Request):
    """
    Invalidate current session.

    **Effects:**
    - Invalidates the durable server-side session
    - Clears session cookie
    - Logs audit event
    """
    session_id = request.session.get("session_id")

    if not session_id:
        response = JSONResponse(
            content={"success": True, "message": "No active session"}
        )
        response.delete_cookie("session")
        return response

    auth_service = request.app.state.auth_service
    invalidated = auth_service.invalidate_session(session_id)

    # Clear session data and delete the session cookie on the response.
    request.session.clear()
    response = JSONResponse(
        content={"success": True, "message": "Logged out successfully" if invalidated else "Session cleared"}
    )
    response.delete_cookie("session")
    return response


@router.get("/session", response_model=SessionResponse)
async def get_session(request: Request):
    """
    Get current authenticated user information.

    **Returns:**
    - User ID, username, roles if authenticated
    - Empty fields if not authenticated
    - CSRF token if available
    """
    user = await get_current_user_optional(request)

    if not user:
        return SessionResponse(is_authenticated=False)

    # The raw CSRF token lives only in the signed cookie; the server keeps
    # its hash. Re-issue (rotate) only when the cookie copy is absent.
    session_id = request.session.get("session_id")
    csrf_token = request.session.get("csrf_token")

    if not csrf_token and session_id:
        auth_service = request.app.state.auth_service
        csrf_pair = auth_service.issue_csrf_token(session_id)
        if csrf_pair:
            request.session["csrf_token"] = csrf_pair.csrf_token
            csrf_token = csrf_pair.csrf_token

    return SessionResponse(
        is_authenticated=True,
        user_id=user.get("id"),
        username=user.get("username"),
        role=user.get("role"),
        roles=user.get("roles"),
        csrf_token=csrf_token
    )


# ============ Dependency Injection Helpers ============

def require_auth():
    """Dependency that requires authentication."""
    async def dependency(request: Request):
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        return user

    return dependency
