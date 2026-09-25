"""TASK-0007 gated PostgreSQL repository tests.

Exercises the REAL ServerSessionRepository, AuditEventRepository, and
RoleGrantRepository against the isolated local PostgreSQL test database,
proving durable hash-only session storage, expiry and invalidation
semantics, durable audit writes, and role/scope loading.

Gated behind CRM_RUN_POSTGRESQL_TESTS=1, matching the existing convention
(tests/test_migrations.py, tests/test_s4_authentication.py). Skipped when
no local PostgreSQL test database is available.
"""

import os
from datetime import timedelta

import pytest
import sqlalchemy as sa

pytestmark = pytest.mark.skipif(
    os.getenv("CRM_RUN_POSTGRESQL_TESTS") != "1",
    reason="requires the isolated local PostgreSQL test database",
)

from crm.domain.models import Role, UserStatus, utc_now
from crm.persistence.database import SessionLocal
from crm.persistence.models import (
    AuditEventModel,
    RoleGrantModel,
    ServerSessionModel,
    UserIdentityModel,
)
from crm.persistence.session_repository import ServerSessionRepository, hash_token
from crm.persistence.audit_repository import AuditEventRepository
from crm.persistence.role_grant_repository import RoleGrantRepository
from crm.persistence.user_repository import UserRepository
from crm.web.auth import AuthSettings, AuthenticationService, hash_password


@pytest.fixture
def user_repo():
    return UserRepository()


@pytest.fixture
def test_user(user_repo):
    from uuid import uuid4

    username = f"task0007_repo_{uuid4().hex[:8]}"
    user = user_repo.create(
        username=username,
        display_name="TASK-0007 Repository Test User",
        password_hash=hash_password("RepoTestPass123!"),
        status=UserStatus.ENABLED,
    )
    yield user
    with SessionLocal() as session:
        session.execute(
            sa.delete(ServerSessionModel).where(ServerSessionModel.user_id == user.id)
        )
        session.execute(
            sa.delete(RoleGrantModel).where(RoleGrantModel.user_id == user.id)
        )
        session.execute(
            sa.delete(AuditEventModel).where(AuditEventModel.actor_user_id == user.id)
        )
        session.execute(
            sa.delete(UserIdentityModel).where(UserIdentityModel.id == user.id)
        )
        session.commit()


def test_server_session_repository_round_trip(test_user):
    """Hash-only storage, active lookup, CSRF rotation, invalidation."""
    repo = ServerSessionRepository()
    session_token = "sess_" + os.urandom(16).hex()
    csrf_token = os.urandom(32).hex()
    created = utc_now()
    expires = created + timedelta(hours=1)

    repo.create_session(
        session_token=session_token,
        csrf_token=csrf_token,
        user_id=test_user.id,
        session_epoch=test_user.session_epoch,
        created_at=created,
        expires_at=expires,
    )

    # Raw tokens must not appear in any persisted column.
    with SessionLocal() as session:
        row = session.execute(
            sa.select(ServerSessionModel).where(
                ServerSessionModel.session_token_hash == hash_token(session_token)
            )
        ).scalar_one()
        assert row.csrf_token_hash == hash_token(csrf_token)
        assert session_token not in str(row.__dict__.values())
        assert csrf_token not in str(row.__dict__.values())
        assert row.invalidated_at is None and row.invalidation_reason is None

    record = repo.find_active_session(session_token)
    assert record is not None
    assert record.user_id == test_user.id
    assert record.session_epoch == test_user.session_epoch
    assert record.csrf_token_hash == hash_token(csrf_token)

    # Unknown or wrong tokens find nothing.
    assert repo.find_active_session("sess_wrong") is None

    # CSRF rotation updates only the hash; the old token no longer matches.
    new_csrf = os.urandom(32).hex()
    assert repo.update_csrf_token_hash(session_token, new_csrf) is True
    record = repo.find_active_session(session_token)
    assert record.csrf_token_hash == hash_token(new_csrf)
    assert record.csrf_token_hash != hash_token(csrf_token)

    # Invalidation persists the complete pair and ends the session.
    assert repo.invalidate_session(session_token, "logout") == test_user.id
    assert repo.find_active_session(session_token) is None
    assert repo.invalidate_session(session_token, "logout") is None
    with SessionLocal() as session:
        row = session.execute(
            sa.select(ServerSessionModel).where(
                ServerSessionModel.session_token_hash == hash_token(session_token)
            )
        ).scalar_one()
        assert row.invalidated_at is not None
        assert row.invalidation_reason == "logout"


def test_server_session_repository_excludes_expired(test_user):
    repo = ServerSessionRepository()
    session_token = "sess_" + os.urandom(16).hex()
    created = utc_now() - timedelta(hours=2)

    repo.create_session(
        session_token=session_token,
        csrf_token=os.urandom(32).hex(),
        user_id=test_user.id,
        session_epoch=test_user.session_epoch,
        created_at=created,
        expires_at=created + timedelta(hours=1),  # already expired
    )

    assert repo.find_active_session(session_token) is None
    assert repo.update_csrf_token_hash(session_token, os.urandom(32).hex()) is False


def test_audit_event_repository_records_outcomes(test_user):
    repo = AuditEventRepository()
    repo.record(
        action="LOGIN_SUCCESS",
        outcome="success",
        actor_user_id=test_user.id,
        target_type="user_identity",
        target_id=test_user.id,
        reason=test_user.username,
    )
    repo.record(
        action="CSRF_FAILED",
        outcome="denied",
        target_type="server_session",
        failure_summary="csrf_cookie_mismatch",
    )

    with SessionLocal() as session:
        rows = session.execute(
            sa.select(AuditEventModel).where(
                AuditEventModel.actor_user_id == test_user.id
            )
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].action == "LOGIN_SUCCESS"
        assert rows[0].outcome == "success"

    with pytest.raises(ValueError):
        repo.record(action="X", outcome="bogus", target_type="server_session")


def test_role_grant_repository_loads_active_roles(test_user):
    from uuid import uuid4

    repo = RoleGrantRepository()
    scope = f"scope-{uuid4().hex[:6]}"

    with SessionLocal() as session:
        session.add(
            RoleGrantModel(
                user_id=test_user.id,
                role=Role.BUSINESS_USER.value,
                granted_by_user_id=test_user.id,
                reason="task0007 test grant",
            )
        )
        session.add(
            RoleGrantModel(
                user_id=test_user.id,
                role=Role.MANAGER.value,
                scope_reference=scope,
                granted_by_user_id=test_user.id,
                reason="task0007 test grant",
            )
        )
        # Revoked grant must be ignored.
        session.add(
            RoleGrantModel(
                user_id=test_user.id,
                role=Role.ADMINISTRATOR.value,
                granted_by_user_id=test_user.id,
                reason="task0007 revoked grant",
                revoked_by_user_id=test_user.id,
                revoked_at=utc_now(),
                revocation_reason="task0007 revocation",
            )
        )
        session.commit()

    roles, scope_keys = repo.find_active_roles(test_user.id)
    assert roles == frozenset({Role.BUSINESS_USER, Role.MANAGER})
    assert scope_keys == frozenset({scope})

    # A user without grants has none (deny-by-default input, R-003).
    from uuid import uuid4 as _uuid4

    roles, scope_keys = repo.find_active_roles(_uuid4())
    assert roles == frozenset()
    assert scope_keys == frozenset()


def test_authentication_service_restart_over_real_database(test_user, user_repo):
    """Two service instances over the real database share durable sessions."""
    session_repo = ServerSessionRepository()
    audit_repo = AuditEventRepository()
    settings = AuthSettings()
    first = AuthenticationService(
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=settings,
    )
    second = AuthenticationService(
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=settings,
    )

    success, result = first.authenticate(test_user.username, "RepoTestPass123!", "127.0.0.1")
    assert success is True
    session_id = result.session.session_id

    # The "restarted" instance validates the session from durable storage.
    validated = second.validate_session(session_id)
    assert validated is not None
    assert validated.user_id == str(test_user.id)

    # Logout via one instance denies validation via the other.
    assert second.invalidate_session(session_id) is True
    assert first.validate_session(session_id) is None
