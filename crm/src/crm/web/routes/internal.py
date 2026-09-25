"""内部账号接口（培训 wiki ↔ CRM 同步，仅限内网/本机调用）。

鉴权：请求头 `X-Internal-Token` 必须等于 `CRM_INTERNAL_TOKEN`
（缺失/不匹配/未配置一律 403，fail-closed）。该路由必须经 nginx
限制为 127.0.0.1/内网来源（见 `deploy/nginx.conf` 的 `/api/internal/` 段）。

用途（SPEC：wiki/docs/crm-auth-sync-spec.md §4）：
  POST /api/internal/auth/verify     —— wiki 登录时验证用户名+密码（不建 CRM 会话）
  POST /api/internal/users           —— wiki 后台建号时同步创建 CRM 账号
  POST /api/internal/users/password  —— wiki 改密/管理员重置时同步 CRM 密码

安全约束：
- 失败信息统一，不区分"用户不存在 / 密码错 / 账号禁用"。
- 任何响应不返回密码或其哈希；审计不记录明文（沿用 SPEC-0002 审计规范）。
- 本接口不做用户级限速（由 wiki 侧登录限速 + nginx 内网限制兜底），
  但每次 verify 都记录审计以便追溯。
"""
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from crm.domain.models import UserStatus
from crm.web.auth import hash_password, verify_password

router = APIRouter(prefix="/api/internal", tags=["internal"])


class VerifyRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=255)


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    display_name: str = Field(..., min_length=1, max_length=160)
    password: str = Field(..., min_length=1, max_length=255)


class ChangePasswordRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    current_password: str = Field(default="", max_length=255)
    new_password: str = Field(..., min_length=1, max_length=255)


def _require_internal_token(request: Request) -> None:
    """Fail-closed token check：未配置或 mismatch 一律 403。"""
    expected = getattr(request.app.state, "crm_internal_token", "") or ""
    if not expected:
        raise HTTPException(status_code=403, detail="internal api disabled")
    presented = request.headers.get("x-internal-token", "") or ""
    if not presented or not secrets.compare_digest(presented, expected):
        raise HTTPException(status_code=403, detail="forbidden")


def _user_payload(user) -> dict:
    return {
        "username": user.username,
        "display_name": user.display_name,
        "status": user.status.value if hasattr(user.status, "value") else str(user.status),
    }


@router.post("/auth/verify")
async def verify_credentials(request: Request, data: VerifyRequest):
    """验证用户名+密码（供 wiki 登录）。不创建会话，不改动任何数据。

    返回 200 {ok:true,user:{...}} 或 401 {ok:false}（信息统一）。
    """
    _require_internal_token(request)
    repo = request.app.state.user_repository

    user = repo.find_by_username(data.username)
    if user is None or user.status != UserStatus.ENABLED:
        return JSONResponse(status_code=401, content={"ok": False})
    if not verify_password(data.password, user.password_hash):
        # verify_password(password, password_hash)——注意参数顺序
        return JSONResponse(status_code=401, content={"ok": False})
    return {"ok": True, "user": _user_payload(user)}


@router.post("/users")
async def create_user(request: Request, data: CreateUserRequest):
    """创建 CRM 账号并授予默认 business_user 角色（与既有业务账号一致）。

    用户名已存在 → 409（幂等冲突，调用方按既有账号处理）。同事务写审计。
    """
    _require_internal_token(request)
    repo = request.app.state.user_repository

    if repo.find_by_username(data.username) is not None:
        raise HTTPException(status_code=409, detail="username exists")

    from sqlalchemy import select

    from crm.persistence.database import transaction_session
    from crm.persistence.models import RoleGrantModel, UserIdentityModel

    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    audit_repo = request.app.state.audit_repository

    uid = uuid4()
    now = datetime.now(timezone.utc)

    with transaction_session(factory) as session:
        # granter：优先 admin（规范账号），否则任意现有用户（与既有脚本一致）
        admin_id = session.execute(
            select(UserIdentityModel.id).where(UserIdentityModel.username == "admin")
        ).scalar_one_or_none()
        if admin_id is None:
            admin_id = session.execute(select(UserIdentityModel.id).limit(1)).scalar_one_or_none()

        session.add(
            UserIdentityModel(
                id=uid,
                username=data.username,
                display_name=data.display_name,
                password_hash=hash_password(data.password),
                status=UserStatus.ENABLED.value,
                session_epoch=0,
                phone=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.flush()
        session.add(
            RoleGrantModel(
                id=uuid4(),
                user_id=uid,
                role="business_user",
                scope_reference=None,
                granted_by_user_id=admin_id,
                granted_at=now,
                reason="internal sync: wiki user create",
            )
        )
        audit_repo.record(
            session=session,
            action="internal.user.create",
            outcome="success",
            target_type="user_identity",
            target_id=uid,
            actor_user_id=admin_id,
            reason="wiki-synced user created",
        )

    return {"ok": True, "user": {"username": data.username, "display_name": data.display_name, "status": UserStatus.ENABLED.value}}


@router.post("/users/password")
async def change_password(request: Request, data: ChangePasswordRequest):
    """修改/重置 CRM 账号密码。

    - 提供了 current_password：先验证当前密码（wiki 用户自助改密）。
    - 未提供 current_password：视为管理员重置（wiki admin 重置密码入口），
      仅校验账号存在且 enabled。
    成功即 bump session_epoch（DEC-0044：使该用户所有 CRM 会话立即失效）。
    """
    _require_internal_token(request)
    repo = request.app.state.user_repository

    user = repo.find_by_username(data.username)
    if user is None or user.status != UserStatus.ENABLED:
        return JSONResponse(status_code=401, content={"ok": False})

    if data.current_password and not verify_password(data.current_password, user.password_hash):
        return JSONResponse(status_code=401, content={"ok": False})

    from crm.persistence.database import transaction_session
    from crm.persistence.models import UserIdentityModel

    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    audit_repo = request.app.state.audit_repository

    with transaction_session(factory) as session:
        model = session.get(UserIdentityModel, user.id)
        if model is None:
            raise HTTPException(status_code=404, detail="user not found")
        model.password_hash = hash_password(data.new_password)
        model.session_epoch = (model.session_epoch or 0) + 1
        model.updated_at = datetime.now(timezone.utc)
        audit_repo.record(
            session=session,
            action="internal.user.password_change",
            outcome="success",
            target_type="user_identity",
            target_id=user.id,
            actor_user_id=user.id,
            reason="password change via wiki",
        )

    return {"ok": True}